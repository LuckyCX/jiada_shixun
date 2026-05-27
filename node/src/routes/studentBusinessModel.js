import { Router } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { getPool } from '../lib/db.js';
import { logError } from '../lib/logError.js';
import { requireAuth, requireStudent } from '../middleware/auth.js';
import { chatCompletion, getEnabledProvider, friendlyLlmErrorMessage, logPromptToConsole } from '../lib/llmGateway.js';
import { assembleBusinessModelAiBundle } from '../lib/businessModelContext.js';
import {
  BUSINESS_MODEL_FINANCE_ITEMS_SYSTEM_PROMPT,
  BUSINESS_MODEL_MARKETING_SYSTEM_PROMPT,
  BUSINESS_MODEL_SWOT_SYSTEM_PROMPT,
  buildBusinessModelFinanceItemsUserPrompt,
  buildBusinessModelMarketingUserPrompt,
  buildBusinessModelSwotUserPrompt,
  normalizeFinanceItemsPayload,
  normalizeMarketingPayload,
  normalizeSwotPayload,
} from '../lib/businessModelPrompts.js';
import {
  WAR_ROOM_MODULE_KEYS,
  WAR_ROOM_ROUND_SYSTEM_PROMPT,
  WAR_ROOM_SINGLE_REPLY_SYSTEM_PROMPT,
  buildRoundHatOrder,
  buildWarRoomRoundUserPrompt,
  buildWarRoomSingleReplyUserPrompt,
  parseMentionedHatFromText,
  parseWarRoomRoundFromLlmText,
  parseWarRoomSingleReplyFromLlmText,
} from '../lib/businessModelWarRoomPrompts.js';

const router = Router();

const HAT_UPDATED_BY = {
  white: '白帽 - 数据分析师',
  red: '红帽 - 用户代表',
  black: '黑帽 - 风险预警员',
  yellow: '黄帽 - 乐观倡导者',
  green: '绿帽 - 创意设计师',
  blue: '蓝帽 - 项目经理',
};

function defaultWarRoomCanvas() {
  const o = {};
  for (const k of WAR_ROOM_MODULE_KEYS) o[k] = { content: '', updatedBy: '' };
  return o;
}

function coerceWarRoomCanvas(j) {
  const base = defaultWarRoomCanvas();
  if (!j || typeof j !== 'object' || Array.isArray(j)) return base;
  for (const k of WAR_ROOM_MODULE_KEYS) {
    const cell = j[k];
    if (cell && typeof cell === 'object') {
      base[k] = {
        content: String(cell.content ?? ''),
        updatedBy: String(cell.updatedBy ?? ''),
      };
    }
  }
  return base;
}

function coerceWarRoomTranscript(j) {
  if (!j || typeof j !== 'object' || Array.isArray(j)) {
    return { messages: [], roundCount: 0 };
  }
  const messages = Array.isArray(j.messages) ? j.messages : [];
  return {
    messages: messages.map((m) => ({
      id: String(m.id || ''),
      hat: String(m.hat || 'blue'),
      content: String(m.content || ''),
      targetModule: m.targetModule ? String(m.targetModule) : null,
      moduleContent: String(m.moduleContent || ''),
      status: m.status ? String(m.status) : undefined,
      roundIndex: Number(m.roundIndex) || 0,
      createdAt: m.createdAt ? String(m.createdAt) : new Date().toISOString(),
    })),
    roundCount: Number(j.roundCount) || 0,
  };
}

function warRoomFilledCount(canvas) {
  return WAR_ROOM_MODULE_KEYS.filter((k) => String(canvas[k]?.content || '').trim()).length;
}

function mapMessageToApi(m) {
  return {
    id: m.id,
    hat: m.hat,
    content: m.content,
    targetModule: m.targetModule,
    moduleContent: m.moduleContent,
    status: m.status,
    roundIndex: m.roundIndex,
    createdAt: m.createdAt,
  };
}
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_ROOT = path.join(__dirname, '../../uploads/market-research');

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
    bad(req, res, 400, 40014, '教师确认组队后可使用商业模式设计');
    return null;
  }
  return { sid, classId, pool, team };
}

function defaultSwot() {
  return { strengths: '', weaknesses: '', opportunities: '', threats: '' };
}

function defaultMarketing() {
  return { product: '', price: '', place: '', promotion: '' };
}

function coerceSwot(j) {
  const x = j && typeof j === 'object' && !Array.isArray(j) ? j : {};
  return {
    strengths: String(x.strengths ?? ''),
    weaknesses: String(x.weaknesses ?? ''),
    opportunities: String(x.opportunities ?? ''),
    threats: String(x.threats ?? ''),
  };
}

function coerceMarketing(j) {
  const x = j && typeof j === 'object' && !Array.isArray(j) ? j : {};
  return {
    product: String(x.product ?? ''),
    price: String(x.price ?? ''),
    place: String(x.place ?? ''),
    promotion: String(x.promotion ?? ''),
  };
}

function coerceFinance(j) {
  const x = j && typeof j === 'object' && !Array.isArray(j) ? j : {};
  const costs = Array.isArray(x.costs) ? x.costs : [];
  const revenues = Array.isArray(x.revenues) ? x.revenues : [];
  const base = Date.now();
  return {
    costs: costs
      .filter((c) => c && typeof c === 'object')
      .map((c, i) => ({
        id: Number(c.id) > 0 ? Number(c.id) : base + i,
        category: c.category === '变动成本' ? '变动成本' : '固定成本',
        name: String(c.name || ''),
        amount: Math.max(0, Math.floor(Number(c.amount) || 0)),
      }))
      .filter((c) => c.name),
    revenues: revenues
      .filter((r) => r && typeof r === 'object')
      .map((r, i) => ({
        id: Number(r.id) > 0 ? Number(r.id) : base + costs.length + i,
        source: String(r.source || ''),
        monthly: Math.max(0, Math.floor(Number(r.monthly) || 0)),
      }))
      .filter((r) => r.source),
  };
}

function rowToApi(r) {
  if (!r) {
    const canvas = defaultWarRoomCanvas();
    return {
      swot: defaultSwot(),
      marketing: defaultMarketing(),
      finance: { costs: [], revenues: [] },
      swotSavedAt: '',
      marketingSavedAt: '',
      financeSavedAt: '',
      warRoom: {
        canvas,
        transcript: { messages: [], roundCount: 0 },
        filledCount: 0,
      },
    };
  }
  const canvas = coerceWarRoomCanvas(r.war_room_canvas_json);
  return {
    swot: coerceSwot(r.swot_json),
    marketing: coerceMarketing(r.marketing_json),
    finance: coerceFinance(r.finance_json),
    swotSavedAt: r.swot_saved_at ? new Date(r.swot_saved_at).toISOString() : '',
    marketingSavedAt: r.marketing_saved_at ? new Date(r.marketing_saved_at).toISOString() : '',
    financeSavedAt: r.finance_saved_at ? new Date(r.finance_saved_at).toISOString() : '',
    warRoom: {
      canvas,
      transcript: coerceWarRoomTranscript(r.war_room_transcript_json),
      filledCount: warRoomFilledCount(canvas),
    },
  };
}

const WORKSPACE_SELECT = `SELECT swot_json, marketing_json, finance_json,
            swot_saved_at, marketing_saved_at, finance_saved_at,
            war_room_canvas_json, war_room_transcript_json, war_room_updated_at
     FROM teacher_personal_class_team_business_model_workspace`;

async function loadWorkspaceRow(pool, teamId) {
  const { rows } = await pool.query(`${WORKSPACE_SELECT} WHERE team_id = $1`, [teamId]);
  return rows[0] || null;
}

async function upsertWarRoomFields(pool, teamId, studentId, canvas, transcript) {
  const row = await loadWorkspaceRow(pool, teamId);
  const swot = row ? coerceSwot(row.swot_json) : defaultSwot();
  const marketing = row ? coerceMarketing(row.marketing_json) : defaultMarketing();
  const finance = row ? coerceFinance(row.finance_json) : { costs: [], revenues: [] };

  await pool.query(
    `INSERT INTO teacher_personal_class_team_business_model_workspace
       (team_id, swot_json, marketing_json, finance_json,
        war_room_canvas_json, war_room_transcript_json,
        war_room_updated_at, updated_by, updated_at)
     VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, now(), $7, now())
     ON CONFLICT (team_id) DO UPDATE SET
       war_room_canvas_json = EXCLUDED.war_room_canvas_json,
       war_room_transcript_json = EXCLUDED.war_room_transcript_json,
       war_room_updated_at = now(),
       updated_by = EXCLUDED.updated_by,
       updated_at = now()`,
    [
      teamId,
      JSON.stringify(swot),
      JSON.stringify(marketing),
      JSON.stringify(finance),
      JSON.stringify(canvas),
      JSON.stringify(transcript),
      studentId,
    ]
  );
}

async function loadWarRoomWorkspaceContext(pool, teamId) {
  const row = await loadWorkspaceRow(pool, teamId);
  return {
    swot: row ? coerceSwot(row.swot_json) : defaultSwot(),
    marketing: row ? coerceMarketing(row.marketing_json) : defaultMarketing(),
    finance: row ? coerceFinance(row.finance_json) : { costs: [], revenues: [] },
    canvas: row ? coerceWarRoomCanvas(row.war_room_canvas_json) : defaultWarRoomCanvas(),
    transcript: row ? coerceWarRoomTranscript(row.war_room_transcript_json) : { messages: [], roundCount: 0 },
  };
}

function appendRoundMessages(transcript, roundMessages, roundIndex) {
  const next = { ...transcript, messages: [...transcript.messages] };
  for (const m of roundMessages) {
    next.messages.push({
      id: randomUUID(),
      hat: m.hat,
      content: m.content,
      targetModule: m.targetModule,
      moduleContent: m.moduleContent,
      roundIndex,
      createdAt: new Date().toISOString(),
    });
  }
  next.roundCount = roundIndex + 1;
  return next;
}

async function runJsonLlm(provider, system, user) {
  logPromptToConsole(provider, system, user);
  try {
    return await chatCompletion({ provider, system, user, jsonMode: true });
  } catch (e) {
    const sm = String(e?.message || '');
    if (!/response_format|json_object|json mode/i.test(sm)) throw e;
    return await chatCompletion({ provider, system, user, jsonMode: false });
  }
}

router.get(
  '/student/personal-classes/:classId/business-model/workspace',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      const row = await loadWorkspaceRow(ctx.pool, ctx.team.id);
      return ok(req, res, rowToApi(row));
    } catch (e) {
      logError(`GET business-model workspace traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.put(
  '/student/personal-classes/:classId/business-model/workspace',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;

      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const hasSwot = Object.prototype.hasOwnProperty.call(body, 'swot');
      const hasMarketing = Object.prototype.hasOwnProperty.call(body, 'marketing');
      const hasFinance = Object.prototype.hasOwnProperty.call(body, 'finance');

      if (!hasSwot && !hasMarketing && !hasFinance) {
        return bad(req, res, 400, 40004, '无效请求体');
      }

      let swot = defaultSwot();
      let marketing = defaultMarketing();
      let finance = { costs: [], revenues: [] };

      const prev = await loadWorkspaceRow(ctx.pool, ctx.team.id);
      let swotSavedAt = null;
      let marketingSavedAt = null;
      let financeSavedAt = null;

      if (prev) {
        swot = coerceSwot(prev.swot_json);
        marketing = coerceMarketing(prev.marketing_json);
        finance = coerceFinance(prev.finance_json);
        swotSavedAt = prev.swot_saved_at;
        marketingSavedAt = prev.marketing_saved_at;
        financeSavedAt = prev.finance_saved_at;
      }

      const nowSql = new Date();

      if (hasSwot) {
        swot = coerceSwot(body.swot);
        swotSavedAt = nowSql;
      }
      if (hasMarketing) {
        marketing = coerceMarketing(body.marketing);
        marketingSavedAt = nowSql;
      }
      if (hasFinance) {
        finance = coerceFinance(body.finance);
        financeSavedAt = nowSql;
      }

      await ctx.pool.query(
        `INSERT INTO teacher_personal_class_team_business_model_workspace
           (team_id, swot_json, marketing_json, finance_json,
            swot_saved_at, marketing_saved_at, finance_saved_at, updated_by, updated_at)
         VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5, $6, $7, $8, now())
         ON CONFLICT (team_id) DO UPDATE SET
           swot_json = EXCLUDED.swot_json,
           marketing_json = EXCLUDED.marketing_json,
           finance_json = EXCLUDED.finance_json,
           swot_saved_at = EXCLUDED.swot_saved_at,
           marketing_saved_at = EXCLUDED.marketing_saved_at,
           finance_saved_at = EXCLUDED.finance_saved_at,
           updated_by = EXCLUDED.updated_by,
           updated_at = now()`,
        [
          ctx.team.id,
          JSON.stringify(swot),
          JSON.stringify(marketing),
          JSON.stringify(finance),
          swotSavedAt,
          marketingSavedAt,
          financeSavedAt,
          ctx.sid,
        ]
      );

      const { rows } = await ctx.pool.query(`${WORKSPACE_SELECT} WHERE team_id = $1`, [ctx.team.id]);
      return ok(req, res, rowToApi(rows[0]));
    } catch (e) {
      logError(`PUT business-model workspace traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

async function persistSwot(pool, teamId, studentId, payload) {
  const row = await loadWorkspaceRow(pool, teamId);
  const marketing = row ? coerceMarketing(row.marketing_json) : defaultMarketing();
  const finance = row ? coerceFinance(row.finance_json) : { costs: [], revenues: [] };
  const swotSavedAt = new Date();
  const marketingSavedAt = row?.marketing_saved_at || null;
  const financeSavedAt = row?.finance_saved_at || null;

  await pool.query(
    `INSERT INTO teacher_personal_class_team_business_model_workspace
       (team_id, swot_json, marketing_json, finance_json,
        swot_saved_at, marketing_saved_at, finance_saved_at, updated_by, updated_at)
     VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5, $6, $7, $8, now())
     ON CONFLICT (team_id) DO UPDATE SET
       swot_json = EXCLUDED.swot_json,
       marketing_json = EXCLUDED.marketing_json,
       finance_json = EXCLUDED.finance_json,
       swot_saved_at = EXCLUDED.swot_saved_at,
       marketing_saved_at = EXCLUDED.marketing_saved_at,
       finance_saved_at = EXCLUDED.finance_saved_at,
       updated_by = EXCLUDED.updated_by,
       updated_at = now()`,
    [
      teamId,
      JSON.stringify(payload),
      JSON.stringify(marketing),
      JSON.stringify(finance),
      swotSavedAt,
      marketingSavedAt,
      financeSavedAt,
      studentId,
    ]
  );
}

async function persistMarketing(pool, teamId, studentId, payload) {
  const row = await loadWorkspaceRow(pool, teamId);
  const swot = row ? coerceSwot(row.swot_json) : defaultSwot();
  const finance = row ? coerceFinance(row.finance_json) : { costs: [], revenues: [] };
  const marketingSavedAt = new Date();
  const swotSavedAt = row?.swot_saved_at || null;
  const financeSavedAt = row?.finance_saved_at || null;

  await pool.query(
    `INSERT INTO teacher_personal_class_team_business_model_workspace
       (team_id, swot_json, marketing_json, finance_json,
        swot_saved_at, marketing_saved_at, finance_saved_at, updated_by, updated_at)
     VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5, $6, $7, $8, now())
     ON CONFLICT (team_id) DO UPDATE SET
       swot_json = EXCLUDED.swot_json,
       marketing_json = EXCLUDED.marketing_json,
       finance_json = EXCLUDED.finance_json,
       swot_saved_at = EXCLUDED.swot_saved_at,
       marketing_saved_at = EXCLUDED.marketing_saved_at,
       finance_saved_at = EXCLUDED.finance_saved_at,
       updated_by = EXCLUDED.updated_by,
       updated_at = now()`,
    [
      teamId,
      JSON.stringify(swot),
      JSON.stringify(payload),
      JSON.stringify(finance),
      swotSavedAt,
      marketingSavedAt,
      financeSavedAt,
      studentId,
    ]
  );
}

async function persistFinance(pool, teamId, studentId, payload) {
  const row = await loadWorkspaceRow(pool, teamId);
  const swot = row ? coerceSwot(row.swot_json) : defaultSwot();
  const marketing = row ? coerceMarketing(row.marketing_json) : defaultMarketing();
  const financeSavedAt = new Date();
  const swotSavedAt = row?.swot_saved_at || null;
  const marketingSavedAt = row?.marketing_saved_at || null;

  await pool.query(
    `INSERT INTO teacher_personal_class_team_business_model_workspace
       (team_id, swot_json, marketing_json, finance_json,
        swot_saved_at, marketing_saved_at, finance_saved_at, updated_by, updated_at)
     VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5, $6, $7, $8, now())
     ON CONFLICT (team_id) DO UPDATE SET
       swot_json = EXCLUDED.swot_json,
       marketing_json = EXCLUDED.marketing_json,
       finance_json = EXCLUDED.finance_json,
       swot_saved_at = EXCLUDED.swot_saved_at,
       marketing_saved_at = EXCLUDED.marketing_saved_at,
       finance_saved_at = EXCLUDED.finance_saved_at,
       updated_by = EXCLUDED.updated_by,
       updated_at = now()`,
    [
      teamId,
      JSON.stringify(swot),
      JSON.stringify(marketing),
      JSON.stringify(payload),
      swotSavedAt,
      marketingSavedAt,
      financeSavedAt,
      studentId,
    ]
  );
}

router.post(
  '/student/personal-classes/:classId/business-model/ai/swot',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      const provider = await getEnabledProvider('multimodal');
      if (!provider) return bad(req, res, 400, 40011, '未配置已启用的多模态模型');

      const bundle = await assembleBusinessModelAiBundle(ctx.pool, ctx.team.id, UPLOAD_ROOT);
      const user = buildBusinessModelSwotUserPrompt(bundle);
      const raw = await runJsonLlm(provider, BUSINESS_MODEL_SWOT_SYSTEM_PROMPT, user);
      let parsed = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }
      const norm = normalizeSwotPayload(parsed, raw);
      if (norm.error) return bad(req, res, 400, 40016, norm.error);

      await persistSwot(ctx.pool, ctx.team.id, ctx.sid, norm.payload);
      const { rows } = await ctx.pool.query(`${WORKSPACE_SELECT} WHERE team_id = $1`, [ctx.team.id]);
      return ok(req, res, rowToApi(rows[0]));
    } catch (e) {
      logError(`POST business-model ai/swot traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, friendlyLlmErrorMessage(e));
    }
  }
);

router.post(
  '/student/personal-classes/:classId/business-model/ai/marketing',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      const provider = await getEnabledProvider('multimodal');
      if (!provider) return bad(req, res, 400, 40011, '未配置已启用的多模态模型');

      const bundle = await assembleBusinessModelAiBundle(ctx.pool, ctx.team.id, UPLOAD_ROOT);
      const user = buildBusinessModelMarketingUserPrompt(bundle);
      const raw = await runJsonLlm(provider, BUSINESS_MODEL_MARKETING_SYSTEM_PROMPT, user);
      let parsed = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }
      const norm = normalizeMarketingPayload(parsed, raw);
      if (norm.error) return bad(req, res, 400, 40016, norm.error);

      await persistMarketing(ctx.pool, ctx.team.id, ctx.sid, norm.payload);
      const { rows } = await ctx.pool.query(`${WORKSPACE_SELECT} WHERE team_id = $1`, [ctx.team.id]);
      return ok(req, res, rowToApi(rows[0]));
    } catch (e) {
      logError(`POST business-model ai/marketing traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, friendlyLlmErrorMessage(e));
    }
  }
);

router.post(
  '/student/personal-classes/:classId/business-model/ai/finance-items',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      const provider = await getEnabledProvider('multimodal');
      if (!provider) return bad(req, res, 400, 40011, '未配置已启用的多模态模型');

      const bundle = await assembleBusinessModelAiBundle(ctx.pool, ctx.team.id, UPLOAD_ROOT);
      const user = buildBusinessModelFinanceItemsUserPrompt(bundle);
      const raw = await runJsonLlm(provider, BUSINESS_MODEL_FINANCE_ITEMS_SYSTEM_PROMPT, user);
      let parsed = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }
      const norm = normalizeFinanceItemsPayload(parsed, raw);
      if (norm.error) return bad(req, res, 400, 40016, norm.error);

      await persistFinance(ctx.pool, ctx.team.id, ctx.sid, norm.payload);
      const { rows } = await ctx.pool.query(`${WORKSPACE_SELECT} WHERE team_id = $1`, [ctx.team.id]);
      return ok(req, res, rowToApi(rows[0]));
    } catch (e) {
      logError(`POST business-model ai/finance-items traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, friendlyLlmErrorMessage(e));
    }
  }
);

router.post(
  '/student/personal-classes/:classId/business-model/war-room/debate/start',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      const ws = await loadWarRoomWorkspaceContext(ctx.pool, ctx.team.id);
      if (ws.transcript.messages.length > 0) {
        return bad(req, res, 400, 40021, '辩论已开始，请在下方继续发言或发起下一轮');
      }
      const provider = await getEnabledProvider('multimodal');
      if (!provider) return bad(req, res, 400, 40011, '未配置已启用的多模态模型');

      const bundle = await assembleBusinessModelAiBundle(ctx.pool, ctx.team.id, UPLOAD_ROOT);
      const studentDisplayName = String(req.body?.studentDisplayName || '同学').trim() || '同学';
      const hatOrder = buildRoundHatOrder(true);
      const user = buildWarRoomRoundUserPrompt({
        bundleText: bundle,
        swot: ws.swot,
        marketing: ws.marketing,
        finance: ws.finance,
        transcriptMessages: [],
        roundIndex: 0,
        hatOrder,
        studentDisplayName,
        canvasSnapshot: ws.canvas,
      });
      const raw = await runJsonLlm(provider, WAR_ROOM_ROUND_SYSTEM_PROMPT, user);
      const norm = parseWarRoomRoundFromLlmText(raw, hatOrder);
      if (norm.error) return bad(req, res, 400, 40016, norm.error);

      const transcript = appendRoundMessages(ws.transcript, norm.messages, 0);
      await upsertWarRoomFields(ctx.pool, ctx.team.id, ctx.sid, ws.canvas, transcript);

      const roundMessages = transcript.messages.slice(-6).map(mapMessageToApi);
      const row = await loadWorkspaceRow(ctx.pool, ctx.team.id);
      return ok(req, res, {
        roundMessages,
        workspace: rowToApi(row),
      });
    } catch (e) {
      logError(`POST war-room debate/start traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, friendlyLlmErrorMessage(e));
    }
  }
);

router.post(
  '/student/personal-classes/:classId/business-model/war-room/debate/round',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      const userMessage = String(req.body?.userMessage ?? '').trim();
      const mentioned = parseMentionedHatFromText(userMessage);
      if (mentioned) {
        return bad(req, res, 400, 40022, '已 @ 某顶帽子，请使用单帽回复接口');
      }

      const ws = await loadWarRoomWorkspaceContext(ctx.pool, ctx.team.id);
      if (!ws.transcript.messages.length) {
        return bad(req, res, 400, 40023, '请先点击开始辩论');
      }

      let transcript = { ...ws.transcript, messages: [...ws.transcript.messages] };
      const transcriptStartLen = transcript.messages.length;
      if (userMessage) {
        transcript.messages.push({
          id: randomUUID(),
          hat: 'user',
          content: userMessage,
          targetModule: null,
          moduleContent: '',
          roundIndex: transcript.roundCount,
          createdAt: new Date().toISOString(),
        });
      }

      const provider = await getEnabledProvider('multimodal');
      if (!provider) return bad(req, res, 400, 40011, '未配置已启用的多模态模型');

      const bundle = await assembleBusinessModelAiBundle(ctx.pool, ctx.team.id, UPLOAD_ROOT);
      const studentDisplayName = String(req.body?.studentDisplayName || '同学').trim() || '同学';
      const roundIndex = transcript.roundCount;
      const hatOrder = buildRoundHatOrder(false);
      const user = buildWarRoomRoundUserPrompt({
        bundleText: bundle,
        swot: ws.swot,
        marketing: ws.marketing,
        finance: ws.finance,
        transcriptMessages: transcript.messages,
        roundIndex,
        hatOrder,
        studentDisplayName,
        canvasSnapshot: ws.canvas,
      });
      const raw = await runJsonLlm(provider, WAR_ROOM_ROUND_SYSTEM_PROMPT, user);
      const norm = parseWarRoomRoundFromLlmText(raw, hatOrder);
      if (norm.error) return bad(req, res, 400, 40016, norm.error);

      transcript = appendRoundMessages(transcript, norm.messages, roundIndex);
      await upsertWarRoomFields(ctx.pool, ctx.team.id, ctx.sid, ws.canvas, transcript);

      const roundMessages = transcript.messages.slice(transcriptStartLen).map(mapMessageToApi);
      const row = await loadWorkspaceRow(ctx.pool, ctx.team.id);
      return ok(req, res, { roundMessages, workspace: rowToApi(row) });
    } catch (e) {
      logError(`POST war-room debate/round traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, friendlyLlmErrorMessage(e));
    }
  }
);

router.post(
  '/student/personal-classes/:classId/business-model/war-room/debate/reply',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      const userMessage = String(req.body?.userMessage ?? '').trim();
      if (!userMessage) return bad(req, res, 400, 40004, '请输入发言内容');
      let mentionedHat = normalizeHatRoute(req.body?.hat);
      if (!mentionedHat) mentionedHat = parseMentionedHatFromText(userMessage);
      if (!mentionedHat) return bad(req, res, 400, 40024, '请 @ 某一顶帽子后再发言');

      const ws = await loadWarRoomWorkspaceContext(ctx.pool, ctx.team.id);
      if (!ws.transcript.messages.length) {
        return bad(req, res, 400, 40023, '请先点击开始辩论');
      }

      let transcript = { ...ws.transcript, messages: [...ws.transcript.messages] };
      transcript.messages.push({
        id: randomUUID(),
        hat: 'user',
        content: userMessage,
        targetModule: null,
        moduleContent: '',
        roundIndex: transcript.roundCount,
        createdAt: new Date().toISOString(),
      });

      const provider = await getEnabledProvider('multimodal');
      if (!provider) return bad(req, res, 400, 40011, '未配置已启用的多模态模型');

      const bundle = await assembleBusinessModelAiBundle(ctx.pool, ctx.team.id, UPLOAD_ROOT);
      const studentDisplayName = String(req.body?.studentDisplayName || '同学').trim() || '同学';
      const user = buildWarRoomSingleReplyUserPrompt({
        bundleText: bundle,
        swot: ws.swot,
        marketing: ws.marketing,
        finance: ws.finance,
        transcriptMessages: transcript.messages,
        mentionedHat,
        userMessage,
        studentDisplayName,
        canvasSnapshot: ws.canvas,
      });
      const raw = await runJsonLlm(provider, WAR_ROOM_SINGLE_REPLY_SYSTEM_PROMPT, user);
      const norm = parseWarRoomSingleReplyFromLlmText(raw, mentionedHat);
      if (norm.error) return bad(req, res, 400, 40016, norm.error);

      const reply = {
        id: randomUUID(),
        hat: norm.message.hat,
        content: norm.message.content,
        targetModule: norm.message.targetModule,
        moduleContent: norm.message.moduleContent,
        roundIndex: transcript.roundCount,
        createdAt: new Date().toISOString(),
      };
      transcript.messages.push(reply);
      await upsertWarRoomFields(ctx.pool, ctx.team.id, ctx.sid, ws.canvas, transcript);

      const row = await loadWorkspaceRow(ctx.pool, ctx.team.id);
      return ok(req, res, { message: mapMessageToApi(reply), workspace: rowToApi(row) });
    } catch (e) {
      logError(`POST war-room debate/reply traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, friendlyLlmErrorMessage(e));
    }
  }
);

function normalizeHatRoute(h) {
  const s = String(h || '').trim().toLowerCase();
  if (['white', 'red', 'black', 'yellow', 'green', 'blue', 'user'].includes(s)) return s === 'user' ? null : s;
  return parseMentionedHatFromText(`@${h}`);
}

router.put(
  '/student/personal-classes/:classId/business-model/war-room/canvas',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      const moduleKey = String(req.body?.moduleKey || '').trim();
      const content = String(req.body?.content ?? '');
      if (!WAR_ROOM_MODULE_KEYS.includes(moduleKey)) {
        return bad(req, res, 400, 40004, '无效画布模块');
      }
      const ws = await loadWarRoomWorkspaceContext(ctx.pool, ctx.team.id);
      ws.canvas[moduleKey] = {
        content,
        updatedBy: '学生编辑',
      };
      await upsertWarRoomFields(ctx.pool, ctx.team.id, ctx.sid, ws.canvas, ws.transcript);
      const row = await loadWorkspaceRow(ctx.pool, ctx.team.id);
      return ok(req, res, rowToApi(row));
    } catch (e) {
      logError(`PUT war-room canvas traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.post(
  '/student/personal-classes/:classId/business-model/war-room/messages/:messageId/adopt',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      const messageId = String(req.params.messageId || '').trim();
      if (!messageId) return bad(req, res, 400, 40004, '参数无效');

      const ws = await loadWarRoomWorkspaceContext(ctx.pool, ctx.team.id);
      const msg = ws.transcript.messages.find((m) => m.id === messageId);
      if (!msg) return bad(req, res, 404, 40404, '消息不存在');
      if (!msg.targetModule || !msg.moduleContent?.trim()) {
        return bad(req, res, 400, 40025, '该消息无可采纳的画布内容');
      }
      if (!WAR_ROOM_MODULE_KEYS.includes(msg.targetModule)) {
        return bad(req, res, 400, 40004, '无效画布模块');
      }

      ws.canvas[msg.targetModule] = {
        content: msg.moduleContent.trim(),
        updatedBy: HAT_UPDATED_BY[msg.hat] || msg.hat,
      };
      const transcript = {
        ...ws.transcript,
        messages: ws.transcript.messages.map((m) =>
          m.id === messageId ? { ...m, status: 'adopted' } : m
        ),
      };
      await upsertWarRoomFields(ctx.pool, ctx.team.id, ctx.sid, ws.canvas, transcript);
      const row = await loadWorkspaceRow(ctx.pool, ctx.team.id);
      return ok(req, res, rowToApi(row));
    } catch (e) {
      logError(`POST war-room adopt traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

export default router;
