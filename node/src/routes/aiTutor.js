import { Router } from 'express';
import { getPool } from '../lib/db.js';
import { logError } from '../lib/logError.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { chatCompletionStream, friendlyLlmErrorMessage, getEnabledProvider } from '../lib/llmGateway.js';
import { sseWrite } from '../lib/marketResearchSse.js';
import { buildAiTutorSystemPrompt, foldTutorHistory } from '../lib/aiTutorPrompts.js';

const router = Router();
const AUDIENCES = new Set(['student', 'teacher', 'both']);

function ok(req, res, data, message = 'OK') {
  return res.json({ code: 0, message, data, traceId: req.traceId });
}

function bad(req, res, status, code, message) {
  return res.status(status).json({ code, message, data: null, traceId: req.traceId });
}

function userIdFromReq(req) {
  const id = Number(req.user?.sub);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function mapEntry(row) {
  return {
    id: String(row.id),
    category: row.category || '',
    audience: row.audience || 'both',
    question: row.question || '',
    answer: row.answer || '',
    isPreset: Boolean(row.is_preset),
    sortOrder: Number(row.sort_order || 0),
    enabled: row.enabled !== false,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : '',
  };
}

function mapMessage(row) {
  return {
    id: String(row.id),
    role: row.role,
    content: row.content || '',
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : '',
  };
}

/** 启用知识库：当前角色 + both */
async function loadKbText(pool, audience) {
  const { rows } = await pool.query(
    `SELECT category, question, answer
     FROM ai_tutor_kb_entries
     WHERE enabled = true AND audience IN ('both', $1)
     ORDER BY sort_order ASC, id ASC`,
    [audience]
  );
  return rows
    .map((r) => `【${r.category || '说明'}】问：${r.question}\n答：${r.answer}`)
    .join('\n\n');
}

function stripThink(text) {
  return String(text || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\/?think>/gi, '')
    .trim();
}

/**
 * 助教流式回答：不推思考片段，只推正文 content。
 * 调用前须已完成鉴权；师生对话的用户消息应已落库。
 * @returns {Promise<string>} 去掉思考标签后的完整正文（含文末拓展）
 */
async function streamTutorReply(res, pool, audience, history, latestUser) {
  const provider = await getEnabledProvider();
  if (!provider) {
    const err = new Error('尚未配置可用的大模型，请在系统配置中启用模型后再试');
    err.status = 503;
    throw err;
  }
  const kbText = await loadKbText(pool, audience);
  const system = buildAiTutorSystemPrompt({ audience, kbText });
  const user = foldTutorHistory(history, latestUser);
  const sep = '─'.repeat(60);
  console.log(`\n[aiTutor] ${sep}`);
  console.log(`[aiTutor] audience=${audience} model=${provider.modelId} kbChars=${kbText.length}`);
  console.log('[aiTutor] --- system ---');
  console.log(system);
  console.log('[aiTutor] --- user ---');
  console.log(user);
  console.log(`[aiTutor] ${sep}\n`);

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  let reply = '';
  await chatCompletionStream({
    provider,
    system,
    user,
    temperature: 0.45,
    streamReasoning: false,
    onEvent: (ev) => {
      if (ev?.kind !== 'content' || !ev.text) return;
      reply += ev.text;
      sseWrite(res, 'content', { text: ev.text });
    },
  });
  return stripThink(reply) || '我暂时没有生成有效回复，请换个说法再试。';
}

router.get('/ai-tutor/presets', requireAuth(), async (req, res) => {
  try {
    const role = req.user?.role;
    if (role !== 'teacher' && role !== 'student') return bad(req, res, 403, 40301, '仅教师或学生可使用助教');
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT id, question FROM ai_tutor_kb_entries
       WHERE enabled = true AND is_preset = true AND audience IN ('both', $1)
       ORDER BY sort_order ASC, id ASC
       LIMIT 12`,
      [role]
    );
    return ok(req, res, {
      presets: rows.map((r) => ({ id: String(r.id), question: r.question || '' })),
    });
  } catch (e) {
    logError(`GET ai-tutor presets traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.get('/ai-tutor/messages', requireAuth(), async (req, res) => {
  try {
    const role = req.user?.role;
    const uid = userIdFromReq(req);
    if ((role !== 'teacher' && role !== 'student') || !uid) {
      return bad(req, res, 403, 40301, '仅教师或学生可使用助教');
    }
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT id, role, content, created_at FROM (
         SELECT id, role, content, created_at
         FROM ai_tutor_messages WHERE user_id = $1
         ORDER BY id DESC LIMIT 40
       ) t ORDER BY id ASC`,
      [uid]
    );
    return ok(req, res, { messages: rows.map(mapMessage) });
  } catch (e) {
    logError(`GET ai-tutor messages traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.post('/ai-tutor/chat', requireAuth(), async (req, res) => {
  const role = req.user?.role;
  const uid = userIdFromReq(req);
  if ((role !== 'teacher' && role !== 'student') || !uid) {
    return bad(req, res, 403, 40301, '仅教师或学生可使用助教');
  }
  const message = String(req.body?.message || '').trim();
  if (!message) return bad(req, res, 400, 40001, '请输入问题');
  if (message.length > 2000) return bad(req, res, 400, 40001, '问题不超过 2000 字');

  const pool = getPool();
  let userMsgId = null;
  try {
    const inserted = await pool.query(
      `INSERT INTO ai_tutor_messages (user_id, role, content) VALUES ($1, 'user', $2) RETURNING id`,
      [uid, message]
    );
    userMsgId = inserted.rows[0]?.id;
    const { rows: histRows } = await pool.query(
      `SELECT role, content FROM (
         SELECT id, role, content FROM ai_tutor_messages
         WHERE user_id = $1 AND id < $2
         ORDER BY id DESC LIMIT 16
       ) t ORDER BY id ASC`,
      [uid, userMsgId]
    );
    const reply = await streamTutorReply(res, pool, role, histRows, message);
    await pool.query(
      `INSERT INTO ai_tutor_messages (user_id, role, content) VALUES ($1, 'assistant', $2)`,
      [uid, reply]
    );
    sseWrite(res, 'done', { reply });
    return res.end();
  } catch (e) {
    logError(`POST ai-tutor chat traceId=${req.traceId}`, e);
    const status = e.status === 503 ? 503 : 500;
    const msg = e.status === 503 ? e.message : friendlyLlmErrorMessage(e) || e.message || '助教暂时无法回答';
    if (res.headersSent) {
      try {
        sseWrite(res, 'error', { message: msg });
      } catch {
        /* 连接已断开 */
      }
      return res.end();
    }
    return bad(req, res, status, status === 503 ? 50301 : 50000, msg);
  }
});

router.get('/admin/ai-tutor/entries', requireAuth(), requireAdmin(), async (req, res) => {
  try {
    const pool = getPool();
    const category = String(req.query.category || '').trim();
    const enabled = String(req.query.enabled || '').trim();
    const params = [];
    const where = [];
    if (category) {
      params.push(category);
      where.push(`category = $${params.length}`);
    }
    if (enabled === '1' || enabled === '0') {
      params.push(enabled === '1');
      where.push(`enabled = $${params.length}`);
    }
    const sql = `SELECT * FROM ai_tutor_kb_entries ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY sort_order ASC, id ASC`;
    const { rows } = await pool.query(sql, params);
    return ok(req, res, { entries: rows.map(mapEntry) });
  } catch (e) {
    logError(`GET admin ai-tutor entries traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

function parseEntryBody(body, partial) {
  const out = {};
  if (!partial || body.category != null) out.category = String(body.category || '').trim().slice(0, 64);
  if (!partial || body.audience != null) {
    const audience = String(body.audience || 'both').trim();
    if (!AUDIENCES.has(audience)) return { error: '受众无效' };
    out.audience = audience;
  }
  if (!partial || body.question != null) {
    out.question = String(body.question || '').trim();
    if (!out.question) return { error: '请填写问题' };
  }
  if (!partial || body.answer != null) {
    out.answer = String(body.answer || '').trim();
    if (!out.answer) return { error: '请填写答案' };
  }
  if (!partial || body.isPreset != null) out.isPreset = Boolean(body.isPreset);
  if (!partial || body.sortOrder != null) {
    const n = Number(body.sortOrder);
    out.sortOrder = Number.isFinite(n) ? Math.round(n) : 0;
  }
  if (!partial || body.enabled != null) out.enabled = body.enabled !== false;
  return { value: out };
}

router.post('/admin/ai-tutor/entries', requireAuth(), requireAdmin(), async (req, res) => {
  try {
    const parsed = parseEntryBody(req.body || {}, false);
    if (parsed.error) return bad(req, res, 400, 40001, parsed.error);
    const v = parsed.value;
    const pool = getPool();
    const { rows } = await pool.query(
      `INSERT INTO ai_tutor_kb_entries (category, audience, question, answer, is_preset, sort_order, enabled)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [v.category, v.audience, v.question, v.answer, v.isPreset, v.sortOrder, v.enabled]
    );
    return ok(req, res, { entry: mapEntry(rows[0]) });
  } catch (e) {
    logError(`POST admin ai-tutor entry traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.patch('/admin/ai-tutor/entries/:id', requireAuth(), requireAdmin(), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return bad(req, res, 400, 40001, '参数无效');
    const parsed = parseEntryBody(req.body || {}, true);
    if (parsed.error) return bad(req, res, 400, 40001, parsed.error);
    const v = parsed.value;
    const sets = [];
    const params = [];
    const push = (col, val) => {
      params.push(val);
      sets.push(`${col} = $${params.length}`);
    };
    if (v.category != null) push('category', v.category);
    if (v.audience != null) push('audience', v.audience);
    if (v.question != null) push('question', v.question);
    if (v.answer != null) push('answer', v.answer);
    if (v.isPreset != null) push('is_preset', v.isPreset);
    if (v.sortOrder != null) push('sort_order', v.sortOrder);
    if (v.enabled != null) push('enabled', v.enabled);
    if (!sets.length) return bad(req, res, 400, 40001, '没有可更新的字段');
    sets.push('updated_at = now()');
    params.push(id);
    const pool = getPool();
    const { rows } = await pool.query(
      `UPDATE ai_tutor_kb_entries SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!rows[0]) return bad(req, res, 404, 40401, '问答不存在');
    return ok(req, res, { entry: mapEntry(rows[0]) });
  } catch (e) {
    logError(`PATCH admin ai-tutor entry traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.delete('/admin/ai-tutor/entries/:id', requireAuth(), requireAdmin(), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return bad(req, res, 400, 40001, '参数无效');
    const pool = getPool();
    const { rowCount } = await pool.query(`DELETE FROM ai_tutor_kb_entries WHERE id = $1`, [id]);
    if (!rowCount) return bad(req, res, 404, 40401, '问答不存在');
    return ok(req, res, { id: String(id) });
  } catch (e) {
    logError(`DELETE admin ai-tutor entry traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

/** 管理端测试：不写入师生对话记录 */
router.post('/admin/ai-tutor/test', requireAuth(), requireAdmin(), async (req, res) => {
  try {
    const audience = String(req.body?.audience || 'student').trim();
    if (audience !== 'student' && audience !== 'teacher') return bad(req, res, 400, 40001, '请选择学生或教师');
    const message = String(req.body?.message || '').trim();
    if (!message) return bad(req, res, 400, 40001, '请输入问题');
    const history = Array.isArray(req.body?.history) ? req.body.history.slice(-16) : [];
    const pool = getPool();
    const reply = await streamTutorReply(res, pool, audience, history, message);
    sseWrite(res, 'done', { reply });
    return res.end();
  } catch (e) {
    logError(`POST admin ai-tutor test traceId=${req.traceId}`, e);
    const status = e.status === 503 ? 503 : 500;
    const msg = e.status === 503 ? e.message : friendlyLlmErrorMessage(e) || e.message || '测试失败';
    if (res.headersSent) {
      try {
        sseWrite(res, 'error', { message: msg });
      } catch {
        /* 连接已断开 */
      }
      return res.end();
    }
    return bad(req, res, status, status === 503 ? 50301 : 50000, msg);
  }
});

export default router;
