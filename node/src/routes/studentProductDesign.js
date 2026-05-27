import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { randomUUID } from 'crypto';
import { getPool } from '../lib/db.js';
import { logError } from '../lib/logError.js';
import { requireAuth, requireStudent } from '../middleware/auth.js';
import { chatCompletionStream, getEnabledProvider, friendlyLlmErrorMessage, logPromptToConsole } from '../lib/llmGateway.js';
import {
  setupSseResponse,
  sseWrite,
  createMarketResearchStreamHandler,
  extractJsonFromLlmText,
  findAllBalancedJsonObjects,
} from '../lib/marketResearchSse.js';
import {
  PRODUCT_DESIGN_SUGGESTION_SYSTEM_PROMPT,
  buildProductDesignUserPrompt,
  parseProductSuggestionFromLlmText,
} from '../lib/productDesignPrompts.js';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_ROOT = path.join(__dirname, '../../uploads/team-product-prototype');
const MAX_ZIP_BYTES = 200 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ZIP_BYTES },
});

function ok(req, res, data, message = 'OK') {
  return res.json({ code: 0, message, data, traceId: req.traceId });
}

function bad(req, res, status, code, message) {
  return res.status(status).json({ code, message, data: null, traceId: req.traceId });
}

function studentIdFromReq(req) {
  const id = Number(String(req.user?.sub || '').trim());
  return Number.isFinite(id) && id > 0 ? id : null;
}

function parseId(param) {
  const id = Number(String(param || '').trim());
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function studentEnrolledInClass(pool, studentId, classId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM teacher_personal_class_students WHERE teacher_personal_class_id = $1 AND student_id = $2`,
    [classId, studentId]
  );
  return rows.length > 0;
}

async function getConfirmedTeam(pool, studentId, classId) {
  const { rows } = await pool.query(
    `SELECT t.id, t.name
     FROM teacher_personal_class_team_members m
     JOIN teacher_personal_class_teams t ON t.id = m.team_id
     WHERE t.teacher_personal_class_id = $1
       AND m.student_id = $2
       AND t.grouping_status = 'confirmed'
     LIMIT 1`,
    [classId, studentId]
  );
  if (!rows.length) return null;
  return { id: Number(rows[0].id), name: rows[0].name };
}

async function resolveTeamLeaderId(pool, teamId) {
  const { rows } = await pool.query(
    `SELECT t.leader_student_id AS "leaderStudentId",
            (
              SELECT m.student_id
              FROM teacher_personal_class_team_members m
              WHERE m.team_id = t.id
              ORDER BY CASE WHEN m.ai_matched_role = 'CEO' THEN 0 ELSE 1 END, m.id ASC
              LIMIT 1
            ) AS "fallbackLeaderId"
     FROM teacher_personal_class_teams t
     WHERE t.id = $1`,
    [teamId]
  );
  const row = rows[0];
  if (!row) return null;
  return row.leaderStudentId || row.fallbackLeaderId || null;
}

async function loadTeamMembers(pool, teamId) {
  const { rows } = await pool.query(
    `SELECT u.id, COALESCE(u.real_name, u.username) AS name
     FROM teacher_personal_class_team_members m
     JOIN users u ON u.id = m.student_id
     WHERE m.team_id = $1
     ORDER BY u.id ASC`,
    [teamId]
  );
  return rows.map((r) => ({ id: String(r.id), name: r.name || '' }));
}

async function requireTeamContext(req, res) {
  const sid = studentIdFromReq(req);
  const classId = parseId(req.params.classId);
  if (!sid || !classId) {
    bad(req, res, 400, 40003, '参数无效');
    return null;
  }
  const pool = getPool();
  if (!(await studentEnrolledInClass(pool, sid, classId))) {
    bad(req, res, 403, 40301, '未加入该班级');
    return null;
  }
  const team = await getConfirmedTeam(pool, sid, classId);
  if (!team) {
    bad(req, res, 400, 40014, '教师确认组队后可使用产品设计');
    return null;
  }
  const leaderId = await resolveTeamLeaderId(pool, team.id);
  const members = await loadTeamMembers(pool, team.id);
  return { sid, classId, pool, team, leaderId, members, isTeamLeader: String(leaderId || '') === String(sid) };
}

async function getMissingSuggestionMembers(pool, teamId, members) {
  const { rows } = await pool.query(
    `SELECT DISTINCT student_id FROM teacher_personal_class_team_product_ai_suggestions WHERE team_id = $1`,
    [teamId]
  );
  const has = new Set(rows.map((r) => String(r.student_id)));
  return members.filter((m) => !has.has(String(m.id)));
}

function normalizeUploadFileName(name) {
  const raw = String(name || 'file').trim() || 'file';
  return raw.replace(/[\\/]/g, '_');
}

function isZipFile(file) {
  const name = String(file.originalname || '').toLowerCase();
  const mime = String(file.mimetype || '').toLowerCase();
  return name.endsWith('.zip') || mime === 'application/zip' || mime === 'application/x-zip-compressed';
}

async function saveTeamProductContext(pool, teamId, studentId, contextText) {
  const text = String(contextText || '').trim().slice(0, 2000);
  await pool.query(
    `INSERT INTO teacher_personal_class_team_product_context (team_id, context_text, updated_by, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (team_id) DO UPDATE SET
       context_text = EXCLUDED.context_text,
       updated_by = EXCLUDED.updated_by,
       updated_at = now()`,
    [teamId, text, studentId]
  );
  return text;
}

async function runProductDesignLlmStream(provider, contextText, streamHandler) {
  const userMsg = buildProductDesignUserPrompt(contextText);
  logPromptToConsole(provider, PRODUCT_DESIGN_SUGGESTION_SYSTEM_PROMPT, userMsg);
  let fullText = '';
  try {
    try {
      fullText = await chatCompletionStream({
        provider,
        system: PRODUCT_DESIGN_SUGGESTION_SYSTEM_PROMPT,
        user: userMsg,
        onEvent: streamHandler.onEvent,
        jsonMode: true,
      });
    } catch (streamErr) {
      const sm = String(streamErr?.message || '');
      if (!/response_format|json_object|json mode/i.test(sm)) throw streamErr;
      fullText = await chatCompletionStream({
        provider,
        system: PRODUCT_DESIGN_SUGGESTION_SYSTEM_PROMPT,
        user: userMsg,
        onEvent: streamHandler.onEvent,
        jsonMode: false,
      });
    }
  } catch (e) {
    throw new Error(friendlyLlmErrorMessage(e));
  }
  const parseText = streamHandler.getParseText(fullText);
  const norm = parseProductSuggestionFromLlmText(
    parseText,
    extractJsonFromLlmText,
    findAllBalancedJsonObjects
  );
  if (norm.error) {
    const err = new Error(!parseText.trim() ? '模型未返回内容' : norm.error);
    err.parsePreview = parseText.slice(0, 500);
    throw err;
  }
  return norm.payload;
}

router.get(
  '/student/personal-classes/:classId/product-design/context',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      const { rows } = await ctx.pool.query(
        `SELECT context_text, updated_by, updated_at FROM teacher_personal_class_team_product_context WHERE team_id = $1`,
        [ctx.team.id]
      );
      if (!rows.length) {
        return ok(req, res, { contextText: '', updatedAt: '', updatedBy: '' });
      }
      const r = rows[0];
      return ok(req, res, {
        contextText: r.context_text || '',
        updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : '',
        updatedBy: String(r.updated_by || ''),
      });
    } catch (e) {
      logError(`GET product-design context traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.put(
  '/student/personal-classes/:classId/product-design/context',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      const contextText = String(req.body?.contextText ?? '').slice(0, 2000);
      await ctx.pool.query(
        `INSERT INTO teacher_personal_class_team_product_context (team_id, context_text, updated_by, updated_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (team_id) DO UPDATE SET
           context_text = EXCLUDED.context_text,
           updated_by = EXCLUDED.updated_by,
           updated_at = now()`,
        [ctx.team.id, contextText, ctx.sid]
      );
      return ok(req, res, { saved: true });
    } catch (e) {
      logError(`PUT product-design context traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.get(
  '/student/personal-classes/:classId/product-design/ai-suggestions/participation',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      const missingMembers = await getMissingSuggestionMembers(ctx.pool, ctx.team.id, ctx.members);
      return ok(req, res, {
        missingMembers: missingMembers.map((m) => ({ id: m.id, name: m.name })),
      });
    } catch (e) {
      logError(`GET product-design participation traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.get(
  '/student/personal-classes/:classId/product-design/ai-suggestions',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      const scope = String(req.query.scope || 'mine');
      if (scope === 'all') {
        const { rows } = await ctx.pool.query(
          `SELECT s.id, s.student_id, s.payload, s.created_at,
                  COALESCE(u.real_name, u.username, '') AS student_name
           FROM teacher_personal_class_team_product_ai_suggestions s
           JOIN users u ON u.id = s.student_id
           WHERE s.team_id = $1
           ORDER BY s.created_at DESC`,
          [ctx.team.id]
        );
        return ok(
          req,
          res,
          rows.map((r) => ({
            id: String(r.id),
            studentId: String(r.student_id),
            studentName: r.student_name || '',
            payload: r.payload || {},
            createdAt: r.created_at ? new Date(r.created_at).toLocaleString('zh-CN') : '',
          }))
        );
      }
      const { rows } = await ctx.pool.query(
        `SELECT id, payload, created_at FROM teacher_personal_class_team_product_ai_suggestions
         WHERE team_id = $1 AND student_id = $2
         ORDER BY created_at DESC
         LIMIT 1`,
        [ctx.team.id, ctx.sid]
      );
      if (!rows.length) return ok(req, res, { latest: null });
      const r = rows[0];
      return ok(req, res, {
        latest: {
          id: String(r.id),
          payload: r.payload || {},
          createdAt: r.created_at ? new Date(r.created_at).toLocaleString('zh-CN') : '',
        },
      });
    } catch (e) {
      logError(`GET product-design ai-suggestions traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.post(
  '/student/personal-classes/:classId/product-design/ai-suggestions/stream',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    setupSseResponse(res);
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return res.end();
      const contextText = String(req.body?.contextText ?? '').trim();
      if (!contextText) {
        sseWrite(res, 'error', { message: '请填写项目背景信息' });
        return res.end();
      }

      const provider = await getEnabledProvider('multimodal');
      if (!provider) {
        sseWrite(res, 'error', { message: '未配置已启用的 LLM 服务' });
        return res.end();
      }

      sseWrite(res, 'status', { message: '正在保存项目背景…' });
      const savedText = await saveTeamProductContext(ctx.pool, ctx.team.id, ctx.sid, contextText);

      sseWrite(res, 'status', { message: '正在连接模型并生成建议…' });
      const streamHandler = createMarketResearchStreamHandler(res);
      let payload;
      try {
        payload = await runProductDesignLlmStream(provider, savedText, streamHandler);
      } catch (e) {
        logError(
          `product-design stream parse traceId=${req.traceId} preview=${e.parsePreview || ''}`,
          e
        );
        sseWrite(res, 'error', { message: e.message || '生成失败' });
        return res.end();
      }

      const { rows } = await ctx.pool.query(
        `INSERT INTO teacher_personal_class_team_product_ai_suggestions (team_id, student_id, payload)
         VALUES ($1, $2, $3)
         RETURNING id, created_at`,
        [ctx.team.id, ctx.sid, JSON.stringify(payload)]
      );
      const r = rows[0];
      sseWrite(res, 'done', {
        id: String(r.id),
        payload,
        createdAt: r.created_at ? new Date(r.created_at).toLocaleString('zh-CN') : '',
      });
      res.end();
    } catch (e) {
      logError(`POST product-design ai-suggestions stream traceId=${req.traceId}`, e);
      sseWrite(res, 'error', { message: e.message || '生成失败' });
      res.end();
    }
  }
);

/** @deprecated 请使用 /ai-suggestions/stream；保留以返回明确提示 */
router.post(
  '/student/personal-classes/:classId/product-design/ai-suggestions',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    return bad(
      req,
      res,
      400,
      40010,
      '请使用流式接口 POST /product-design/ai-suggestions/stream'
    );
  }
);

router.get(
  '/student/personal-classes/:classId/product-design/prototype',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      const { rows } = await ctx.pool.query(
        `SELECT origin_name, uploaded_by, uploaded_at, size_bytes FROM teacher_personal_class_team_product_prototype_uploads
         WHERE team_id = $1`,
        [ctx.team.id]
      );
      if (!rows.length) {
        return ok(req, res, { uploaded: false, originName: '', uploadedAt: '', uploadedBy: '' });
      }
      const r = rows[0];
      return ok(req, res, {
        uploaded: true,
        originName: r.origin_name || '',
        uploadedAt: r.uploaded_at ? new Date(r.uploaded_at).toISOString() : '',
        uploadedBy: String(r.uploaded_by || ''),
        sizeBytes: Number(r.size_bytes || 0),
      });
    } catch (e) {
      logError(`GET product-design prototype traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.post(
  '/student/personal-classes/:classId/product-design/prototype',
  requireAuth(),
  requireStudent(),
  upload.single('file'),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      if (!ctx.isTeamLeader) return bad(req, res, 403, 40304, '仅队长可上传原型');

      const missingMembers = await getMissingSuggestionMembers(ctx.pool, ctx.team.id, ctx.members);
      if (missingMembers.length) {
        const names = missingMembers.map((m) => m.name || m.id).join('、');
        return res.status(400).json({
          code: 40006,
          message: `小组成员${names}还未生成 AI 设计建议，请先通知成员完成 AI 设计建议后再上传`,
          data: { missingMembers: missingMembers.map((m) => ({ id: m.id, name: m.name })) },
          traceId: req.traceId,
        });
      }

      const file = req.file;
      if (!file) return bad(req, res, 400, 40004, '请选择压缩包文件');
      if (!isZipFile(file)) return bad(req, res, 400, 40004, '仅支持上传 ZIP 压缩包');

      const dir = path.join(UPLOAD_ROOT, String(ctx.classId), String(ctx.team.id));
      fs.mkdirSync(dir, { recursive: true });
      const storageName = `${randomUUID()}_${normalizeUploadFileName(file.originalname)}`;
      const storagePath = path.join(String(ctx.classId), String(ctx.team.id), storageName);
      const abs = path.join(UPLOAD_ROOT, storagePath);
      fs.writeFileSync(abs, file.buffer);

      const { rows: old } = await ctx.pool.query(
        `SELECT storage_path FROM teacher_personal_class_team_product_prototype_uploads WHERE team_id = $1`,
        [ctx.team.id]
      );
      if (old[0]?.storage_path) {
        const oldAbs = path.join(UPLOAD_ROOT, old[0].storage_path);
        try {
          if (fs.existsSync(oldAbs)) fs.unlinkSync(oldAbs);
        } catch {
          /* ignore */
        }
      }

      await ctx.pool.query(
        `INSERT INTO teacher_personal_class_team_product_prototype_uploads
           (team_id, origin_name, storage_path, mime_type, size_bytes, uploaded_by, uploaded_at)
         VALUES ($1, $2, $3, $4, $5, $6, now())
         ON CONFLICT (team_id) DO UPDATE SET
           origin_name = EXCLUDED.origin_name,
           storage_path = EXCLUDED.storage_path,
           mime_type = EXCLUDED.mime_type,
           size_bytes = EXCLUDED.size_bytes,
           uploaded_by = EXCLUDED.uploaded_by,
           uploaded_at = now()`,
        [
          ctx.team.id,
          normalizeUploadFileName(file.originalname),
          storagePath.replace(/\\/g, '/'),
          file.mimetype || 'application/zip',
          file.size,
          ctx.sid,
        ]
      );

      return ok(req, res, { uploaded: true });
    } catch (e) {
      logError(`POST product-design prototype traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

export default router;
