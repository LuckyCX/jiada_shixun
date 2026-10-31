import { Router } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { getPool } from '../lib/db.js';
import { logError } from '../lib/logError.js';
import { requireAuth, requireStudent } from '../middleware/auth.js';
import { chatCompletion, getEnabledProvider, friendlyLlmErrorMessage, logPromptToConsole, buildNoThinkingExtraBody } from '../lib/llmGateway.js';
// 思考模式关闭逻辑统一由 llmGateway.buildNoThinkingExtraBody 提供
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
  BMC_MODULE_KEYS,
  BUSINESS_MODEL_BMC_SYSTEM_PROMPT,
  buildBusinessModelBmcUserPrompt,
  normalizeBmcPayload,
} from '../lib/businessModelPrompts.js';
import {
  WAR_ROOM_MODULE_KEYS,
  WAR_ROOM_ASK_SYSTEM_PROMPT,
  WAR_ROOM_SINGLE_REPLY_SYSTEM_PROMPT,
  buildWarRoomAskUserPrompt,
  buildWarRoomSingleReplyUserPrompt,
  parseMentionedHatFromText,
  parseWarRoomAskFromLlmText,
  parseWarRoomSingleReplyFromLlmText,
} from '../lib/businessModelWarRoomPrompts.js';
import {
  afterHatStudentAnswer,
  coerceHatSession,
  defaultHatSession,
  markAwaitingAnswer,
  switchHatPerspective,
} from '../lib/sixHatsSession.js';

const router = Router();

const HAT_UPDATED_BY = {
  white: '白帽 - 客观事实｜补信息',
  green: '绿帽 - 发散创新｜找创新',
  yellow: '黄帽 - 正向价值｜判价值',
  black: '黑帽 - 风险批判｜查风险',
  red: '红帽 - 用户共情｜贴需求',
  blue: '蓝帽 - 全局系统｜做统筹',
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

function coerceWarRoomFills(arr) {
  if (!Array.isArray(arr)) return undefined;
  const out = [];
  for (const f of arr) {
    const k = String(f?.targetModule || '').trim();
    const c = String(f?.moduleContent || '').trim();
    if (WAR_ROOM_MODULE_KEYS.includes(k) && c) out.push({ targetModule: k, moduleContent: c });
  }
  return out.length ? out : undefined;
}

function coerceWarRoomTranscript(j) {
  if (!j || typeof j !== 'object' || Array.isArray(j)) {
    return { messages: [], roundCount: 0, hatSession: defaultHatSession() };
  }
  const messages = Array.isArray(j.messages) ? j.messages : [];
  return {
    messages: messages.map((m) => ({
      id: String(m.id || ''),
      hat: String(m.hat || 'blue'),
      content: String(m.content || ''),
      targetModule: m.targetModule ? String(m.targetModule) : null,
      moduleContent: String(m.moduleContent || ''),
      fills: coerceWarRoomFills(m.fills),
      adoptedModules: Array.isArray(m.adoptedModules)
        ? m.adoptedModules.map((k) => String(k)).filter((k) => WAR_ROOM_MODULE_KEYS.includes(k))
        : [],
      status: m.status ? String(m.status) : undefined,
      roundIndex: Number(m.roundIndex) || 0,
      createdAt: m.createdAt ? String(m.createdAt) : new Date().toISOString(),
    })),
    roundCount: Number(j.roundCount) || 0,
    hatSession: coerceHatSession(j.hatSession),
  };
}

function warRoomFilledCount(canvas) {
  return WAR_ROOM_MODULE_KEYS.filter((k) => String(canvas[k]?.content || '').trim()).length;
}

const WAR_ROOM_MODULE_TITLES = {
  customerSegments: '客户细分',
  valueProposition: '价值主张',
  channels: '渠道通路',
  customerRelationships: '客户关系',
  revenueStreams: '收入来源',
  keyResources: '核心资源',
  keyActivities: '关键业务',
  keyPartnerships: '合作伙伴',
  costStructure: '成本结构',
};

function defaultBmc() {
  const o = {};
  for (const k of BMC_MODULE_KEYS) o[k] = '';
  return o;
}

function coerceBmc(j) {
  const base = defaultBmc();
  if (!j || typeof j !== 'object' || Array.isArray(j)) return base;
  for (const k of BMC_MODULE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(j, k)) {
      base[k] = String(j[k] ?? '');
    }
  }
  return base;
}

async function assertBusinessCanvasSubmitReady(pool, teamId) {
  const row = await loadWorkspaceRow(pool, teamId);
  if (!row?.swot_saved_at) {
    return { ok: false, status: 400, code: 40028, message: '请先保存 SWOT 分析' };
  }
  if (!row?.marketing_saved_at) {
    return { ok: false, status: 400, code: 40029, message: '请先保存营销策略' };
  }
  if (!row?.finance_saved_at) {
    return { ok: false, status: 400, code: 40030, message: '请先保存成本与财务分析' };
  }
  // 至少完成 1 次 AI 审查后才允许上传画布给教师
  const { rows: reviewRows } = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM teacher_personal_class_team_bmc_ai_reviews WHERE team_id = $1`,
    [teamId]
  );
  if (Number(reviewRows[0]?.cnt || 0) < 1) {
    return { ok: false, status: 400, code: 40031, message: '请先完成至少 1 次 AI 审查后再上传画布' };
  }
  return { ok: true };
}

async function loadWarRoomSavedRecordsWithCanvas(pool, teamId) {
  const { rows } = await pool.query(
    `SELECT r.student_id, r.canvas_json, COALESCE(u.real_name, u.username) AS name
     FROM teacher_personal_class_team_war_room_saved_record r
     JOIN users u ON u.id = r.student_id
     WHERE r.team_id = $1
     ORDER BY r.student_id`,
    [teamId]
  );
  return rows.map((row) => ({
    studentId: String(row.student_id),
    name: String(row.name || '').trim() || '同学',
    canvas: coerceWarRoomCanvas(row.canvas_json),
  }));
}

function formatWarRoomMemberSections(records) {
  return records
    .map((rec) => {
      const lines = WAR_ROOM_MODULE_KEYS.map((k) => {
        const title = WAR_ROOM_MODULE_TITLES[k] || k;
        const content = String(rec.canvas[k]?.content || '').trim();
        return `  - ${title}：${content || '（空）'}`;
      });
      return `【${rec.name}】\n${lines.join('\n')}`;
    })
    .join('\n\n');
}

function mapMessageToApi(m) {
  return {
    id: m.id,
    hat: m.hat,
    content: m.content,
    targetModule: m.targetModule,
    moduleContent: m.moduleContent,
    fills: m.fills,
    adoptedModules: m.adoptedModules,
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

function badWithData(req, res, status, code, message, data) {
  return res.status(status).json({ code, message, data, traceId: req.traceId });
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
    `SELECT t.id, t.name, t.is_solo AS "isSolo"
     FROM teacher_personal_class_team_members m
     JOIN teacher_personal_class_teams t ON t.id = m.team_id
     WHERE t.teacher_personal_class_id = $1
       AND m.student_id = $2
       AND t.grouping_status = 'confirmed'
     LIMIT 1`,
    [classId, studentId]
  );
  if (!rows.length) return null;
  return {
    id: Number(rows[0].id),
    name: rows[0].name,
    isSolo: Boolean(rows[0].isSolo),
  };
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
  return rows.map((r) => ({ id: String(r.id), name: String(r.name || '').trim() || '同学' }));
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
  const leaderId = await resolveTeamLeaderId(pool, team.id);
  const members = await loadTeamMembers(pool, team.id);
  // 个人公司或仅 1 人：不强制协作锁 / 上传队长门控
  const isSolo = Boolean(team.isSolo) || members.length <= 1;
  return {
    sid,
    classId,
    pool,
    team,
    leaderId,
    members,
    isSolo,
    isTeamLeader: String(leaderId || '') === String(sid),
  };
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

function rowToApi(r, warRoomMember) {
  const canvas = warRoomMember?.canvas ?? defaultWarRoomCanvas();
  const transcript = warRoomMember?.transcript ?? {
    messages: [],
    roundCount: 0,
    hatSession: defaultHatSession(),
  };
  const hatSession = coerceHatSession(transcript.hatSession);
  const teamRecords = warRoomMember?.teamRecords ?? [];
  const bmcBase = {
    bmc: defaultBmc(),
    bmcCanvasSavedAt: '',
    bmcCanvasGeneratedAt: '',
    bmcReviewStatus: 'draft',
    bmcReviewComment: '',
    bmcReviewedAt: '',
  };
  const warRoomPayload = {
    canvas,
    transcript: { ...transcript, hatSession },
    hatSession,
    filledCount: warRoomFilledCount(canvas),
  };
  if (!r) {
    return {
      swot: defaultSwot(),
      marketing: defaultMarketing(),
      finance: { costs: [], revenues: [] },
      swotSavedAt: '',
      marketingSavedAt: '',
      financeSavedAt: '',
      warRoom: warRoomPayload,
      warRoomTeamRecords: teamRecords,
      ...bmcBase,
    };
  }
  return {
    swot: coerceSwot(r.swot_json),
    marketing: coerceMarketing(r.marketing_json),
    finance: coerceFinance(r.finance_json),
    swotSavedAt: r.swot_saved_at ? new Date(r.swot_saved_at).toISOString() : '',
    marketingSavedAt: r.marketing_saved_at ? new Date(r.marketing_saved_at).toISOString() : '',
    financeSavedAt: r.finance_saved_at ? new Date(r.finance_saved_at).toISOString() : '',
    warRoom: warRoomPayload,
    warRoomTeamRecords: teamRecords,
    bmc: coerceBmc(r.bmc_canvas_json),
    bmcCanvasSavedAt: r.bmc_canvas_saved_at ? new Date(r.bmc_canvas_saved_at).toISOString() : '',
    bmcCanvasGeneratedAt: r.bmc_canvas_generated_at
      ? new Date(r.bmc_canvas_generated_at).toISOString()
      : '',
    bmcReviewStatus: String(r.bmc_review_status || 'draft'),
    bmcReviewComment: String(r.bmc_review_comment || ''),
    bmcReviewedAt: r.bmc_reviewed_at ? new Date(r.bmc_reviewed_at).toISOString() : '',
  };
}

const WORKSPACE_SELECT = `SELECT swot_json, marketing_json, finance_json,
            swot_saved_at, marketing_saved_at, finance_saved_at,
            war_room_canvas_json, war_room_transcript_json, war_room_updated_at,
            bmc_canvas_json, bmc_canvas_generated_at, bmc_canvas_saved_at, bmc_canvas_saved_by,
            bmc_review_status, bmc_review_comment, bmc_reviewed_at, bmc_reviewed_by
     FROM teacher_personal_class_team_business_model_workspace`;

async function loadWorkspaceRow(pool, teamId) {
  const { rows } = await pool.query(`${WORKSPACE_SELECT} WHERE team_id = $1`, [teamId]);
  return rows[0] || null;
}

async function loadWarRoomMemberRow(pool, teamId, studentId) {
  const { rows } = await pool.query(
    `SELECT canvas_json, transcript_json
     FROM teacher_personal_class_team_war_room_member
     WHERE team_id = $1 AND student_id = $2`,
    [teamId, studentId]
  );
  return rows[0] || null;
}

async function loadWarRoomTeamRecords(pool, teamId) {
  const { rows } = await pool.query(
    `SELECT r.student_id, u.real_name, r.saved_at, r.canvas_json
     FROM teacher_personal_class_team_war_room_saved_record r
     JOIN users u ON u.id = r.student_id
     WHERE r.team_id = $1
     ORDER BY r.saved_at DESC`,
    [teamId]
  );
  return rows.map((row) => ({
    studentId: String(row.student_id),
    studentName: String(row.real_name || '').trim() || '同学',
    savedAt: row.saved_at ? new Date(row.saved_at).toISOString() : '',
    filledCount: warRoomFilledCount(coerceWarRoomCanvas(row.canvas_json)),
  }));
}

async function buildWorkspaceApi(pool, teamId, studentId) {
  const row = await loadWorkspaceRow(pool, teamId);
  const memberRow = await loadWarRoomMemberRow(pool, teamId, studentId);
  const canvas = memberRow ? coerceWarRoomCanvas(memberRow.canvas_json) : defaultWarRoomCanvas();
  const transcript = memberRow
    ? coerceWarRoomTranscript(memberRow.transcript_json)
    : { messages: [], roundCount: 0 };
  const teamRecords = await loadWarRoomTeamRecords(pool, teamId);
  const leaderId = await resolveTeamLeaderId(pool, teamId);
  const members = await loadTeamMembers(pool, teamId);
  const { rows: teamMeta } = await pool.query(
    `SELECT is_solo AS "isSolo" FROM teacher_personal_class_teams WHERE id = $1`,
    [teamId]
  );
  const isSolo = Boolean(teamMeta[0]?.isSolo) || members.length <= 1;
  return {
    ...rowToApi(row, { canvas, transcript, teamRecords }),
    studentId: String(studentId),
    isTeamLeader: String(leaderId || '') === String(studentId),
    isSolo,
    teamMemberCount: members.length,
    teamMembers: members,
  };
}

async function upsertWarRoomMember(pool, teamId, studentId, canvas, transcript) {
  await pool.query(
    `INSERT INTO teacher_personal_class_team_war_room_member
       (team_id, student_id, canvas_json, transcript_json, updated_at)
     VALUES ($1, $2, $3::jsonb, $4::jsonb, now())
     ON CONFLICT (team_id, student_id) DO UPDATE SET
       canvas_json = EXCLUDED.canvas_json,
       transcript_json = EXCLUDED.transcript_json,
       updated_at = now()`,
    [teamId, studentId, JSON.stringify(canvas), JSON.stringify(transcript)]
  );
}

async function upsertWarRoomFields(pool, teamId, studentId, canvas, transcript) {
  await upsertWarRoomMember(pool, teamId, studentId, canvas, transcript);
}

async function loadWarRoomWorkspaceContext(pool, teamId, studentId) {
  const row = await loadWorkspaceRow(pool, teamId);
  const memberRow = await loadWarRoomMemberRow(pool, teamId, studentId);
  return {
    swot: row ? coerceSwot(row.swot_json) : defaultSwot(),
    marketing: row ? coerceMarketing(row.marketing_json) : defaultMarketing(),
    finance: row ? coerceFinance(row.finance_json) : { costs: [], revenues: [] },
    canvas: memberRow ? coerceWarRoomCanvas(memberRow.canvas_json) : defaultWarRoomCanvas(),
    transcript: memberRow
      ? coerceWarRoomTranscript(memberRow.transcript_json)
      : { messages: [], roundCount: 0, hatSession: defaultHatSession() },
  };
}

async function studentOnTeam(pool, teamId, studentId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM teacher_personal_class_team_members WHERE team_id = $1 AND student_id = $2`,
    [teamId, studentId]
  );
  return rows.length > 0;
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

async function runJsonLlm(provider, system, user, options = {}) {
  const { extraBody } = options;
  logPromptToConsole(provider, system, user);
  // chatCompletion 内部已：注入小写 json 关键字 + json_object 被拒时自动降级
  return await chatCompletion({ provider, system, user, jsonMode: true, extraBody });
}

router.get(
  '/student/personal-classes/:classId/business-model/workspace',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      return ok(req, res, await buildWorkspaceApi(ctx.pool, ctx.team.id, ctx.sid));
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
      return ok(req, res, await buildWorkspaceApi(ctx.pool, ctx.team.id, ctx.sid));
    } catch (e) {
      logError(`PUT business-model workspace traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

/** @param {{ setSaved?: boolean }} [opts] setSaved=false 时只写草稿 JSON，不刷新 *_saved_at（引导填写） */
async function persistSwot(pool, teamId, studentId, payload, opts = {}) {
  const row = await loadWorkspaceRow(pool, teamId);
  const marketing = row ? coerceMarketing(row.marketing_json) : defaultMarketing();
  const finance = row ? coerceFinance(row.finance_json) : { costs: [], revenues: [] };
  const setSaved = opts.setSaved !== false;
  const swotSavedAt = setSaved ? new Date() : row?.swot_saved_at || null;
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

/** @param {{ setSaved?: boolean }} [opts] */
async function persistMarketing(pool, teamId, studentId, payload, opts = {}) {
  const row = await loadWorkspaceRow(pool, teamId);
  const swot = row ? coerceSwot(row.swot_json) : defaultSwot();
  const finance = row ? coerceFinance(row.finance_json) : { costs: [], revenues: [] };
  const setSaved = opts.setSaved !== false;
  const marketingSavedAt = setSaved ? new Date() : row?.marketing_saved_at || null;
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

/** @param {{ setSaved?: boolean }} [opts] */
async function persistFinance(pool, teamId, studentId, payload, opts = {}) {
  const row = await loadWorkspaceRow(pool, teamId);
  const swot = row ? coerceSwot(row.swot_json) : defaultSwot();
  const marketing = row ? coerceMarketing(row.marketing_json) : defaultMarketing();
  const setSaved = opts.setSaved !== false;
  const financeSavedAt = setSaved ? new Date() : row?.finance_saved_at || null;
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

async function logBusinessGuideInteraction(ctx, scene, content, meta = {}) {
  try {
    const { insertTeamAiInteractionLog } = await import('../lib/teamAiInteractionLog.js');
    await insertTeamAiInteractionLog({
      classId: ctx.classId,
      teamId: ctx.team.id,
      studentId: ctx.sid,
      moduleKey: 'business',
      scene,
      role: 'event',
      content: String(content || '').slice(0, 500),
      meta,
    });
  } catch (logErr) {
    logError(`business guide cockpit hook scene=${scene}`, logErr);
  }
}

/** 格锁有效期（与前端心跳配合） */
const BMC_CELL_LOCK_TTL_MS = 90_000;

/**
 * 读取团队未过期的画布格锁
 * @returns {Promise<Map<string, { lockedBy: string, lockedByName: string }>>}
 */
async function loadActiveBmcCellLockMap(pool, teamId) {
  const { rows } = await pool.query(
    `SELECT l.cell_key, l.locked_by, l.heartbeat_at,
            COALESCE(u.real_name, u.username) AS locked_by_name
     FROM teacher_personal_class_team_bmc_cell_locks l
     LEFT JOIN users u ON u.id = l.locked_by
     WHERE l.team_id = $1`,
    [teamId]
  );
  const map = new Map();
  const now = Date.now();
  for (const row of rows) {
    const hb = row.heartbeat_at ? new Date(row.heartbeat_at).getTime() : 0;
    if (now - hb > BMC_CELL_LOCK_TTL_MS) continue;
    map.set(String(row.cell_key), {
      lockedBy: String(row.locked_by),
      lockedByName: String(row.locked_by_name || '同学'),
    });
  }
  return map;
}

/**
 * 多人协作落盘：只合并本人变更格；若变更格被他人锁定则记入 conflicts
 * @param {unknown} incomingRaw
 * @param {string[] | null | undefined} changedKeys
 */
async function mergeTeamBmcCanvas(pool, teamId, studentId, incomingRaw, changedKeys) {
  const row = await loadWorkspaceRow(pool, teamId);
  const current = coerceBmc(row?.bmc_canvas_json);
  const incoming = coerceBmc(incomingRaw);
  const locks = await loadActiveBmcCellLockMap(pool, teamId);
  const keys =
    Array.isArray(changedKeys) && changedKeys.length
      ? changedKeys.map((k) => String(k)).filter((k) => BMC_MODULE_KEYS.includes(k))
      : BMC_MODULE_KEYS.filter((k) => String(incoming[k] || '') !== String(current[k] || ''));
  const out = { ...current };
  /** @type {{ cellKey: string, lockedByName: string }[]} */
  const conflicts = [];
  /** @type {string[]} */
  const appliedKeys = [];
  for (const k of keys) {
    const lock = locks.get(k);
    if (lock && String(lock.lockedBy) !== String(studentId)) {
      conflicts.push({ cellKey: k, lockedByName: lock.lockedByName });
      continue;
    }
    out[k] = incoming[k];
    appliedKeys.push(k);
  }
  return { bmc: out, conflicts, appliedKeys };
}

async function persistBmcFields(pool, teamId, studentId, bmc, opts) {
  const row = await loadWorkspaceRow(pool, teamId);
  const swot = row ? coerceSwot(row.swot_json) : defaultSwot();
  const marketing = row ? coerceMarketing(row.marketing_json) : defaultMarketing();
  const finance = row ? coerceFinance(row.finance_json) : { costs: [], revenues: [] };
  const swotSavedAt = row?.swot_saved_at || null;
  const marketingSavedAt = row?.marketing_saved_at || null;
  const financeSavedAt = row?.finance_saved_at || null;
  const bmcGeneratedAt = opts.setGenerated ? new Date() : row?.bmc_canvas_generated_at || null;
  const bmcSavedAt = opts.setSaved ? new Date() : row?.bmc_canvas_saved_at || null;
  const bmcSavedBy = opts.setSaved ? studentId : row?.bmc_canvas_saved_by || null;
  // 上传画布 → 进入教师待审；仅草稿保存不改审核态
  const reviewStatus = opts.setSaved
    ? 'pending'
    : opts.reviewStatus || row?.bmc_review_status || 'draft';
  const reviewComment = opts.setSaved ? '' : row?.bmc_review_comment || '';
  const reviewedAt = opts.setSaved ? null : row?.bmc_reviewed_at || null;
  const reviewedBy = opts.setSaved ? null : row?.bmc_reviewed_by || null;

  await pool.query(
    `INSERT INTO teacher_personal_class_team_business_model_workspace
       (team_id, swot_json, marketing_json, finance_json,
        swot_saved_at, marketing_saved_at, finance_saved_at,
        bmc_canvas_json, bmc_canvas_generated_at, bmc_canvas_saved_at, bmc_canvas_saved_by,
        bmc_review_status, bmc_review_comment, bmc_reviewed_at, bmc_reviewed_by,
        updated_by, updated_at)
     VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5, $6, $7, $8::jsonb, $9, $10, $11,
             $12, $13, $14, $15, $16, now())
     ON CONFLICT (team_id) DO UPDATE SET
       bmc_canvas_json = EXCLUDED.bmc_canvas_json,
       bmc_canvas_generated_at = EXCLUDED.bmc_canvas_generated_at,
       bmc_canvas_saved_at = EXCLUDED.bmc_canvas_saved_at,
       bmc_canvas_saved_by = EXCLUDED.bmc_canvas_saved_by,
       bmc_review_status = EXCLUDED.bmc_review_status,
       bmc_review_comment = EXCLUDED.bmc_review_comment,
       bmc_reviewed_at = EXCLUDED.bmc_reviewed_at,
       bmc_reviewed_by = EXCLUDED.bmc_reviewed_by,
       updated_by = EXCLUDED.updated_by,
       updated_at = now()`,
    [
      teamId,
      JSON.stringify(swot),
      JSON.stringify(marketing),
      JSON.stringify(finance),
      swotSavedAt,
      marketingSavedAt,
      financeSavedAt,
      JSON.stringify(bmc),
      bmcGeneratedAt,
      bmcSavedAt,
      bmcSavedBy,
      reviewStatus,
      reviewComment,
      reviewedAt,
      reviewedBy,
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

      // 引导填写：写草稿，不刷新 swot_saved_at
      await persistSwot(ctx.pool, ctx.team.id, ctx.sid, norm.payload, { setSaved: false });
      await logBusinessGuideInteraction(
        ctx,
        'swot_ai_guide',
        `SWOT AI 引导填写：${String(norm.payload.strengths || '').slice(0, 120)}`,
        { kind: 'guide' }
      );
      return ok(req, res, await buildWorkspaceApi(ctx.pool, ctx.team.id, ctx.sid));
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
      if (norm.error) {
        // 便于排查模型偶发非字符串字段 / markdown 包裹
        logError(
          `POST business-model ai/marketing normalize fail traceId=${req.traceId} err=${norm.error} raw=${String(raw || '').slice(0, 800)}`
        );
        return bad(req, res, 400, 40016, norm.error);
      }

      await persistMarketing(ctx.pool, ctx.team.id, ctx.sid, norm.payload, { setSaved: false });
      await logBusinessGuideInteraction(
        ctx,
        'marketing_ai_guide',
        `营销 AI 引导填写：${String(norm.payload.product || '').slice(0, 120)}`,
        { kind: 'guide' }
      );
      return ok(req, res, await buildWorkspaceApi(ctx.pool, ctx.team.id, ctx.sid));
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

      await persistFinance(ctx.pool, ctx.team.id, ctx.sid, norm.payload, { setSaved: false });
      await logBusinessGuideInteraction(
        ctx,
        'finance_ai_guide',
        `成本 AI 引导填写：成本 ${norm.payload.costs?.length || 0} 项 / 收入 ${norm.payload.revenues?.length || 0} 项`,
        { kind: 'guide', costCount: norm.payload.costs?.length || 0, revenueCount: norm.payload.revenues?.length || 0 }
      );
      return ok(req, res, await buildWorkspaceApi(ctx.pool, ctx.team.id, ctx.sid));
    } catch (e) {
      logError(`POST business-model ai/finance-items traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, friendlyLlmErrorMessage(e));
    }
  }
);

router.post(
  '/student/personal-classes/:classId/business-model/bmc/ai/generate',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      if (!ctx.isTeamLeader) {
        return bad(req, res, 403, 40303, '仅队长可生成商业画布');
      }
      // 虚拟董事会画布已下线，不再作为生成/上传门槛；有历史保存记录仍可作提示词补充
      const provider = await getEnabledProvider('multimodal');
      if (!provider) return bad(req, res, 400, 40011, '未配置已启用的多模态模型');

      const bundle = await assembleBusinessModelAiBundle(ctx.pool, ctx.team.id, UPLOAD_ROOT);
      const warRecords = await loadWarRoomSavedRecordsWithCanvas(ctx.pool, ctx.team.id);
      const sections = formatWarRoomMemberSections(warRecords);
      const user = buildBusinessModelBmcUserPrompt(bundle, sections);
      const raw = await runJsonLlm(provider, BUSINESS_MODEL_BMC_SYSTEM_PROMPT, user);
      let parsed = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }
      const norm = normalizeBmcPayload(parsed, raw);
      if (norm.error) return bad(req, res, 400, 40016, norm.error);

      await persistBmcFields(ctx.pool, ctx.team.id, ctx.sid, norm.payload, {
        setGenerated: true,
        setSaved: false,
      });
      return ok(req, res, await buildWorkspaceApi(ctx.pool, ctx.team.id, ctx.sid));
    } catch (e) {
      logError(`POST business-model bmc/ai/generate traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, friendlyLlmErrorMessage(e));
    }
  }
);

router.put(
  '/student/personal-classes/:classId/business-model/bmc/save',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      // 团队公司仅组长可上传最终画布；个人公司不受限
      if (!ctx.isSolo && !ctx.isTeamLeader) {
        return bad(req, res, 403, 40303, '仅组长可上传最终商业画布');
      }
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const bmc = coerceBmc(body.bmc);
      const emptyKeys = BMC_MODULE_KEYS.filter((k) => !String(bmc[k] || '').trim());
      if (emptyKeys.length) {
        return bad(req, res, 400, 40004, '请先完善商业模式画布九格内容');
      }
      const ready = await assertBusinessCanvasSubmitReady(ctx.pool, ctx.team.id);
      if (!ready.ok) {
        return bad(req, res, ready.status, ready.code, ready.message);
      }
      await persistBmcFields(ctx.pool, ctx.team.id, ctx.sid, bmc, {
        setGenerated: false,
        setSaved: true,
      });
      try {
        const { insertTeamAiInteractionLog } = await import('../lib/teamAiInteractionLog.js');
        await insertTeamAiInteractionLog({
          classId: ctx.classId,
          teamId: ctx.team.id,
          studentId: ctx.sid,
          moduleKey: 'business',
          scene: 'bmc_save',
          role: 'event',
          content: '提交商业模式画布，等待教师审核',
        });
        // 未审核通过前不触发阶段完成评分；教师通过后再 schedule
      } catch (hookErr) {
        logError('bmc save cockpit hook', hookErr);
      }
      return ok(req, res, await buildWorkspaceApi(ctx.pool, ctx.team.id, ctx.sid));
    } catch (e) {
      logError(`PUT business-model bmc/save traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.post(
  '/student/personal-classes/:classId/business-model/bmc/cell-locks',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      const cellKey = String(req.body?.cellKey || '').trim();
      if (!BMC_MODULE_KEYS.includes(cellKey)) {
        return bad(req, res, 400, 40004, '无效画布格');
      }
      // 释放本人其他格锁
      await ctx.pool.query(
        `DELETE FROM teacher_personal_class_team_bmc_cell_locks
         WHERE team_id = $1 AND locked_by = $2 AND cell_key <> $3`,
        [ctx.team.id, ctx.sid, cellKey]
      );
      const { rows: existing } = await ctx.pool.query(
        `SELECT l.cell_key, l.locked_by, l.locked_at, l.heartbeat_at,
                COALESCE(u.real_name, u.username) AS locked_by_name
         FROM teacher_personal_class_team_bmc_cell_locks l
         LEFT JOIN users u ON u.id = l.locked_by
         WHERE l.team_id = $1 AND l.cell_key = $2`,
        [ctx.team.id, cellKey]
      );
      if (existing.length) {
        const row = existing[0];
        const hb = row.heartbeat_at ? new Date(row.heartbeat_at).getTime() : 0;
        const expired = Date.now() - hb > BMC_CELL_LOCK_TTL_MS;
        if (!expired && String(row.locked_by) !== String(ctx.sid)) {
          return badWithData(req, res, 409, 40901, `格子已被 ${row.locked_by_name || '同学'} 编辑中`, {
            lock: {
              cellKey,
              lockedById: String(row.locked_by),
              lockedByName: String(row.locked_by_name || '同学'),
            },
          });
        }
      }
      await ctx.pool.query(
        `INSERT INTO teacher_personal_class_team_bmc_cell_locks
           (team_id, cell_key, locked_by, locked_at, heartbeat_at)
         VALUES ($1, $2, $3, now(), now())
         ON CONFLICT (team_id, cell_key) DO UPDATE SET
           locked_by = EXCLUDED.locked_by,
           locked_at = CASE
             WHEN teacher_personal_class_team_bmc_cell_locks.locked_by = EXCLUDED.locked_by
               THEN teacher_personal_class_team_bmc_cell_locks.locked_at
             ELSE now() END,
           heartbeat_at = now()`,
        [ctx.team.id, cellKey, ctx.sid]
      );
      return ok(req, res, {
        lock: { cellKey, lockedById: String(ctx.sid), lockedByName: '我' },
        workspace: await buildWorkspaceApi(ctx.pool, ctx.team.id, ctx.sid),
      });
    } catch (e) {
      logError(`POST bmc cell-locks traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.delete(
  '/student/personal-classes/:classId/business-model/bmc/cell-locks/:cellKey',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      const cellKey = String(req.params.cellKey || '').trim();
      await ctx.pool.query(
        `DELETE FROM teacher_personal_class_team_bmc_cell_locks
         WHERE team_id = $1 AND cell_key = $2 AND locked_by = $3`,
        [ctx.team.id, cellKey, ctx.sid]
      );
      return ok(req, res, { released: true });
    } catch (e) {
      logError(`DELETE bmc cell-locks traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

const BMC_AI_REVIEW_SYSTEM = `你是创业实训商业模式画布审查助教。
根据学生九格内容与本轮自述，从九维点评合理性、优缺点，并给出核心建议与 0～100 分。
输出 JSON：
{
  "summary": "总评",
  "score": 0-100,
  "dimensions": [{ "key": "customerSegments", "label": "客户细分", "comment": "点评", "pros": [], "cons": [] }],
  "suggestions": ["建议1", "建议2"]
}
禁止改写学生原文代填；只审查。`;

router.post(
  '/student/personal-classes/:classId/business-model/bmc/ai-review',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      const selfNote = String(req.body?.selfNote || '').trim();
      const incoming = coerceBmc(
        req.body?.bmc || (await loadWorkspaceRow(ctx.pool, ctx.team.id))?.bmc_canvas_json
      );
      const changedKeys = Array.isArray(req.body?.changedKeys) ? req.body.changedKeys : null;
      // 团队：按变更格合并，避免整包覆盖队友正在编辑/已保存的格子
      let bmc = incoming;
      if (!ctx.isSolo) {
        const merged = await mergeTeamBmcCanvas(
          ctx.pool,
          ctx.team.id,
          ctx.sid,
          incoming,
          changedKeys
        );
        if (merged.conflicts.length) {
          const tip = merged.conflicts
            .map((c) => `${c.cellKey}（${c.lockedByName}）`)
            .join('、');
          return badWithData(
            req,
            res,
            409,
            40901,
            `部分格子正在被队友编辑，请稍后再提交审查：${tip}`,
            { conflicts: merged.conflicts }
          );
        }
        bmc = merged.bmc;
      }
      const provider = await getEnabledProvider('multimodal');
      if (!provider) return bad(req, res, 400, 40011, '未配置已启用的多模态模型');
      const bundle = await assembleBusinessModelAiBundle(ctx.pool, ctx.team.id, UPLOAD_ROOT);
      // 空格统一备注「未填写」，便于模型识别未完成维度
      const canvasLines = BMC_MODULE_KEYS.map((k) => {
        const title = WAR_ROOM_MODULE_TITLES[k] || k;
        const text = String(bmc[k] || '').trim();
        return `- ${title}：${text || '未填写'}`;
      }).join('\n');
      const user = `【前置实训文本】\n${bundle}\n\n【本轮自述】\n${selfNote || '（未填写）'}\n\n【九格内容】\n${canvasLines}\n\n请审查并输出 JSON。对标注「未填写」的格子在点评中明确指出尚缺内容。`;
      const raw = await runJsonLlm(provider, BMC_AI_REVIEW_SYSTEM, user);
      let parsed = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = { summary: String(raw || '').slice(0, 2000), score: 60, dimensions: [], suggestions: [] };
      }
      const score = Number(parsed.score);
      const aiScore = Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : null;
      const { rows } = await ctx.pool.query(
        `INSERT INTO teacher_personal_class_team_bmc_ai_reviews
           (team_id, teacher_personal_class_id, submitted_by, self_note, canvas_snapshot, ai_result, ai_score)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)
         RETURNING id, created_at, self_note, ai_result, ai_score, submitted_by`,
        [
          ctx.team.id,
          ctx.classId,
          ctx.sid,
          selfNote,
          JSON.stringify(bmc),
          JSON.stringify(parsed),
          aiScore,
        ]
      );
      const row = rows[0];
      // 同步落盘（团队已合并，不整包覆盖队友格子）
      await persistBmcFields(ctx.pool, ctx.team.id, ctx.sid, bmc, { setGenerated: false, setSaved: false });
      try {
        const { insertTeamAiInteractionLog } = await import('../lib/teamAiInteractionLog.js');
        await insertTeamAiInteractionLog({
          classId: ctx.classId,
          teamId: ctx.team.id,
          studentId: ctx.sid,
          moduleKey: 'business',
          scene: 'bmc_ai_review',
          role: 'event',
          content: `画布 AI 审查${aiScore != null ? ` · 评分 ${aiScore}` : ''}：${String(parsed?.summary || selfNote || '').slice(0, 200)}`,
          meta: { reviewId: row.id, aiScore },
        });
      } catch (logErr) {
        logError('bmc ai-review cockpit hook', logErr);
      }
      return ok(req, res, {
        review: {
          id: String(row.id),
          selfNote: row.self_note,
          aiResult: row.ai_result,
          aiScore: row.ai_score != null ? Number(row.ai_score) : null,
          createdAt: new Date(row.created_at).toISOString(),
          submittedBy: String(row.submitted_by),
        },
        workspace: await buildWorkspaceApi(ctx.pool, ctx.team.id, ctx.sid),
      });
    } catch (e) {
      logError(`POST bmc ai-review traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, friendlyLlmErrorMessage(e));
    }
  }
);

router.get(
  '/student/personal-classes/:classId/business-model/bmc/ai-reviews',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      const { rows } = await ctx.pool.query(
        `SELECT r.id, r.self_note, r.ai_result, r.ai_score, r.created_at, r.submitted_by,
                COALESCE(u.real_name, u.username) AS submitter_name,
                t.name AS team_name
         FROM teacher_personal_class_team_bmc_ai_reviews r
         JOIN users u ON u.id = r.submitted_by
         JOIN teacher_personal_class_teams t ON t.id = r.team_id
         WHERE r.team_id = $1
         ORDER BY r.created_at DESC
         LIMIT 50`,
        [ctx.team.id]
      );
      return ok(req, res, {
        reviews: rows.map((r) => ({
          id: String(r.id),
          selfNote: r.self_note,
          aiResult: r.ai_result,
          aiScore: r.ai_score != null ? Number(r.ai_score) : null,
          createdAt: new Date(r.created_at).toISOString(),
          submittedBy: String(r.submitted_by),
          submitterName: String(r.submitter_name || '').trim() || '同学',
          teamName: String(r.team_name || ''),
        })),
      });
    } catch (e) {
      logError(`GET bmc ai-reviews traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

const BM_SECTION_KEYS = new Set(['swot', 'marketing', 'finance']);
const BM_SECTION_LABEL = { swot: 'SWOT', marketing: '营销策略', finance: '成本分析' };

const BM_SECTION_AI_REVIEW_SYSTEM = `你是创业实训商业模式分节审查助教。
根据学生当前填写内容与本轮自述，对照项目前置信息，点评完整性、合理性与可落地性，给出核心建议与 0～100 分。
输出 JSON：
{
  "summary": "总评",
  "score": 0-100,
  "suggestions": ["建议1", "建议2"]
}
禁止改写学生原文代填；只审查。未填写处须明确指出。`;

function coerceSectionContent(section, body, workspaceRow) {
  if (section === 'swot') {
    return coerceSwot(body?.swot || body?.content || workspaceRow?.swot_json);
  }
  if (section === 'marketing') {
    return coerceMarketing(body?.marketing || body?.content || workspaceRow?.marketing_json);
  }
  return coerceFinance(body?.finance || body?.content || workspaceRow?.finance_json);
}

function formatSectionContentForPrompt(section, content) {
  if (section === 'swot') {
    return [
      `- 优势：${String(content.strengths || '').trim() || '未填写'}`,
      `- 劣势：${String(content.weaknesses || '').trim() || '未填写'}`,
      `- 机会：${String(content.opportunities || '').trim() || '未填写'}`,
      `- 威胁：${String(content.threats || '').trim() || '未填写'}`,
    ].join('\n');
  }
  if (section === 'marketing') {
    return [
      `- 产品：${String(content.product || '').trim() || '未填写'}`,
      `- 价格：${String(content.price || '').trim() || '未填写'}`,
      `- 渠道：${String(content.place || '').trim() || '未填写'}`,
      `- 推广：${String(content.promotion || '').trim() || '未填写'}`,
    ].join('\n');
  }
  const costs = Array.isArray(content.costs) ? content.costs : [];
  const revenues = Array.isArray(content.revenues) ? content.revenues : [];
  const costLines = costs.length
    ? costs
        .map(
          (c) =>
            `  · [${c.category || ''}] ${c.name || ''}：${Number(c.amount) || 0} 元/月`
        )
        .join('\n')
    : '  （无）';
  const revLines = revenues.length
    ? revenues
        .map((r) => `  · ${r.source || ''}：${Number(r.monthly) || 0} 元/月`)
        .join('\n')
    : '  （无）';
  return `- 成本明细：\n${costLines}\n- 收入来源：\n${revLines}`;
}

router.post(
  '/student/personal-classes/:classId/business-model/sections/:section/ai-review',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      const section = String(req.params.section || '').trim();
      if (!BM_SECTION_KEYS.has(section)) {
        return bad(req, res, 400, 40001, 'section 须为 swot|marketing|finance');
      }
      const selfNote = String(req.body?.selfNote || '').trim();
      const wsRow = await loadWorkspaceRow(ctx.pool, ctx.team.id);
      const content = coerceSectionContent(section, req.body, wsRow);
      const provider = await getEnabledProvider('multimodal');
      if (!provider) return bad(req, res, 400, 40011, '未配置已启用的多模态模型');
      const bundle = await assembleBusinessModelAiBundle(ctx.pool, ctx.team.id, UPLOAD_ROOT);
      const label = BM_SECTION_LABEL[section] || section;
      const user = `【前置实训文本】\n${bundle}\n\n【审查分节】${label}\n\n【本轮自述】\n${selfNote || '（未填写）'}\n\n【当前填写】\n${formatSectionContentForPrompt(section, content)}\n\n请审查并输出 JSON。`;
      const raw = await runJsonLlm(provider, BM_SECTION_AI_REVIEW_SYSTEM, user);
      let parsed = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = { summary: String(raw || '').slice(0, 2000), score: 60, suggestions: [] };
      }
      const score = Number(parsed.score);
      const aiScore = Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : null;
      const { rows } = await ctx.pool.query(
        `INSERT INTO teacher_personal_class_team_bm_section_ai_reviews
           (team_id, teacher_personal_class_id, section, submitted_by, self_note, content_snapshot, ai_result, ai_score)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)
         RETURNING id, created_at, self_note, ai_result, ai_score, submitted_by, section`,
        [
          ctx.team.id,
          ctx.classId,
          section,
          ctx.sid,
          selfNote,
          JSON.stringify(content),
          JSON.stringify(parsed),
          aiScore,
        ]
      );
      const row = rows[0];
      // 同步当前填写到草稿（不刷新 saved_at）
      if (section === 'swot') {
        await persistSwot(ctx.pool, ctx.team.id, ctx.sid, content, { setSaved: false });
      } else if (section === 'marketing') {
        await persistMarketing(ctx.pool, ctx.team.id, ctx.sid, content, { setSaved: false });
      } else {
        await persistFinance(ctx.pool, ctx.team.id, ctx.sid, content, { setSaved: false });
      }
      await logBusinessGuideInteraction(
        ctx,
        `${section}_ai_review`,
        `${label} AI 审查${aiScore != null ? ` · 评分 ${aiScore}` : ''}：${String(parsed?.summary || selfNote || '').slice(0, 200)}`,
        { reviewId: row.id, aiScore, section }
      );
      return ok(req, res, {
        review: {
          id: String(row.id),
          section,
          selfNote: row.self_note,
          aiResult: row.ai_result,
          aiScore: row.ai_score != null ? Number(row.ai_score) : null,
          createdAt: new Date(row.created_at).toISOString(),
          submittedBy: String(row.submitted_by),
        },
        workspace: await buildWorkspaceApi(ctx.pool, ctx.team.id, ctx.sid),
      });
    } catch (e) {
      logError(`POST section ai-review traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, friendlyLlmErrorMessage(e));
    }
  }
);

router.get(
  '/student/personal-classes/:classId/business-model/sections/:section/ai-reviews',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      const section = String(req.params.section || '').trim();
      if (!BM_SECTION_KEYS.has(section)) {
        return bad(req, res, 400, 40001, 'section 须为 swot|marketing|finance');
      }
      const { rows } = await ctx.pool.query(
        `SELECT r.id, r.section, r.self_note, r.ai_result, r.ai_score, r.created_at, r.submitted_by,
                COALESCE(u.real_name, u.username) AS submitter_name,
                t.name AS team_name
         FROM teacher_personal_class_team_bm_section_ai_reviews r
         JOIN users u ON u.id = r.submitted_by
         JOIN teacher_personal_class_teams t ON t.id = r.team_id
         WHERE r.team_id = $1 AND r.section = $2
         ORDER BY r.created_at DESC
         LIMIT 50`,
        [ctx.team.id, section]
      );
      return ok(req, res, {
        reviews: rows.map((r) => ({
          id: String(r.id),
          section: r.section,
          selfNote: r.self_note,
          aiResult: r.ai_result,
          aiScore: r.ai_score != null ? Number(r.ai_score) : null,
          createdAt: new Date(r.created_at).toISOString(),
          submittedBy: String(r.submitted_by),
          submitterName: String(r.submitter_name || '').trim() || '同学',
          teamName: String(r.team_name || ''),
        })),
      });
    } catch (e) {
      logError(`GET section ai-reviews traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

async function generateWarRoomAsk(provider, ctx, ws, transcript, activeHat, studentDisplayName) {
  const bundle = await assembleBusinessModelAiBundle(ctx.pool, ctx.team.id, UPLOAD_ROOT);
  const user = buildWarRoomAskUserPrompt({
    bundleText: bundle,
    swot: ws.swot,
    marketing: ws.marketing,
    finance: ws.finance,
    transcriptMessages: transcript.messages,
    activeHat,
    studentDisplayName,
  });
  const raw = await runJsonLlm(provider, WAR_ROOM_ASK_SYSTEM_PROMPT, user, {
    extraBody: buildNoThinkingExtraBody(provider),
  });
  const norm = parseWarRoomAskFromLlmText(raw, activeHat);
  if (norm.error) return { error: norm.error };
  const msg = {
    id: randomUUID(),
    hat: norm.message.hat,
    content: norm.message.content,
    targetModule: null,
    moduleContent: '',
    adoptedModules: [],
    status: 'ask',
    roundIndex: transcript.roundCount,
    createdAt: new Date().toISOString(),
  };
  return {
    transcript: {
      ...transcript,
      messages: [...transcript.messages, msg],
      roundCount: transcript.roundCount + 1,
      hatSession: markAwaitingAnswer(transcript.hatSession, activeHat),
    },
    message: msg,
  };
}

router.post(
  '/student/personal-classes/:classId/business-model/war-room/debate/start',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      const ws = await loadWarRoomWorkspaceContext(ctx.pool, ctx.team.id, ctx.sid);
      if (ws.transcript.messages.length > 0) {
        return bad(req, res, 400, 40021, '辩论已开始，请在下方继续发言或切换帽子视角');
      }
      const provider = await getEnabledProvider('multimodal');
      if (!provider) return bad(req, res, 400, 40011, '未配置已启用的多模态模型');

      const studentDisplayName = String(req.body?.studentDisplayName || '同学').trim() || '同学';
      const guide = {
        id: randomUUID(),
        hat: 'blue',
        content: `${studentDisplayName}，欢迎进入虚拟董事会。将按「白→绿→黄→黑→红→蓝」顺序，每顶帽子提出最多 3 个苏格拉底式追问，并可进行最多 3 轮对话后再进入下一帽，从六维验证你的点子（提问不代改）。也可随时 @某帽 专项深挖。请先简要说明你的创业设想。`,
        targetModule: null,
        moduleContent: '',
        adoptedModules: [],
        status: 'guide',
        roundIndex: 0,
        createdAt: new Date().toISOString(),
      };
      let transcript = {
        messages: [guide],
        roundCount: 0,
        hatSession: defaultHatSession(),
      };
      // 开场后立刻由白帽抛出第一轮追问
      const ask = await generateWarRoomAsk(provider, ctx, ws, transcript, 'white', studentDisplayName);
      if (ask.error) return bad(req, res, 400, 40016, ask.error);
      transcript = ask.transcript;
      await upsertWarRoomFields(ctx.pool, ctx.team.id, ctx.sid, ws.canvas, transcript);
      const workspace = await buildWorkspaceApi(ctx.pool, ctx.team.id, ctx.sid);
      return ok(req, res, {
        roundMessages: transcript.messages.map(mapMessageToApi),
        workspace,
      });
    } catch (e) {
      logError(`POST war-room debate/start traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, friendlyLlmErrorMessage(e));
    }
  }
);

router.post(
  '/student/personal-classes/:classId/business-model/war-room/debate/switch-hat',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      const hat = normalizeHatRoute(req.body?.hat);
      if (!hat) return bad(req, res, 400, 40004, '请选择有效的帽子视角');
      const ws = await loadWarRoomWorkspaceContext(ctx.pool, ctx.team.id, ctx.sid);
      if (!ws.transcript.messages.length) {
        return bad(req, res, 400, 40023, '请先等待白帽开场');
      }
      const switched = switchHatPerspective(ws.transcript.hatSession, hat);
      if (switched.error) return bad(req, res, 400, 40004, switched.error);
      const transcript = { ...ws.transcript, hatSession: switched.session };
      await upsertWarRoomFields(ctx.pool, ctx.team.id, ctx.sid, ws.canvas, transcript);
      return ok(req, res, { workspace: await buildWorkspaceApi(ctx.pool, ctx.team.id, ctx.sid) });
    } catch (e) {
      logError(`POST war-room switch-hat traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

/** 虚拟董事会对话写入驾驶舱 AI 交互日志 */
async function logWarRoomTurn(ctx, userMessage, transcript, transcriptStartLen, activeHat) {
  try {
    const { insertChatTurnLogs } = await import('../lib/teamAiInteractionLog.js');
    const assistantContent = (transcript.messages || [])
      .slice(transcriptStartLen)
      .filter((m) => m && m.hat !== 'user')
      .map((m) => String(m.content || '').trim())
      .filter(Boolean)
      .join('\n')
      .slice(0, 2000);
    await insertChatTurnLogs({
      classId: ctx.classId,
      teamId: ctx.team.id,
      studentId: ctx.sid,
      moduleKey: 'business',
      scene: 'war_room_turn',
      threadId: `war-room-${ctx.team.id}-${ctx.sid}`,
      roundIndex: Math.max(0, Number(transcript.roundCount) || 0),
      userContent: userMessage,
      assistantContent,
      meta: { activeHat: activeHat || transcript.hatSession?.activeHat || null },
    });
  } catch (logErr) {
    logError('war-room turn interaction log', logErr);
  }
}

async function handleWarRoomReply(req, res) {
  const ctx = await requireTeamContext(req, res);
  if (!ctx) return;
  const userMessage = String(req.body?.userMessage ?? '').trim();
  if (!userMessage) return bad(req, res, 400, 40004, '请输入发言内容');

  // @某帽 优先：显式点名只让该帽回复，不自动拉下一顶顺序帽
  const mentionedFromText = parseMentionedHatFromText(userMessage);
  let activeHat =
    mentionedFromText ||
    normalizeHatRoute(req.body?.activeHat) ||
    normalizeHatRoute(req.body?.hat);

  const ws = await loadWarRoomWorkspaceContext(ctx.pool, ctx.team.id, ctx.sid);
  if (!ws.transcript.messages.length) {
    return bad(req, res, 400, 40023, '请先等待白帽开场');
  }

  let transcript = {
    ...ws.transcript,
    messages: [...ws.transcript.messages],
    hatSession: coerceHatSession(ws.transcript.hatSession),
  };
  if (!activeHat) activeHat = transcript.hatSession.activeHat || 'white';
  const explicitMention = Boolean(mentionedFromText);

  const transcriptStartLen = transcript.messages.length;
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
  const studentDisplayName = String(req.body?.studentDisplayName || '同学').trim() || '同学';
  let session = transcript.hatSession;
  const bundle = await assembleBusinessModelAiBundle(ctx.pool, ctx.team.id, UPLOAD_ROOT);

  // 学生 @指定帽子：仅该帽单次回复，不推进顺序、不追加下一帽追问
  if (explicitMention) {
    const switched = switchHatPerspective(session, activeHat);
    if (!switched.error) {
      session = switched.session;
      transcript.hatSession = session;
    }
    const user = buildWarRoomSingleReplyUserPrompt({
      bundleText: bundle,
      swot: ws.swot,
      marketing: ws.marketing,
      finance: ws.finance,
      transcriptMessages: transcript.messages,
      mentionedHat: activeHat,
      userMessage,
      studentDisplayName,
    });
    const raw = await runJsonLlm(provider, WAR_ROOM_SINGLE_REPLY_SYSTEM_PROMPT, user);
    const norm = parseWarRoomSingleReplyFromLlmText(raw, activeHat);
    if (norm.error) return bad(req, res, 400, 40016, norm.error);
    transcript.messages.push({
      id: randomUUID(),
      hat: norm.message.hat,
      content: norm.message.content,
      targetModule: null,
      moduleContent: '',
      adoptedModules: [],
      roundIndex: transcript.roundCount,
      createdAt: new Date().toISOString(),
    });
    transcript.hatSession = { ...session, activeHat, awaitingAnswer: false };
    await upsertWarRoomFields(ctx.pool, ctx.team.id, ctx.sid, ws.canvas, transcript);
    await logWarRoomTurn(ctx, userMessage, transcript, transcriptStartLen, activeHat);
    return ok(req, res, {
      roundMessages: transcript.messages.slice(transcriptStartLen).map(mapMessageToApi),
      message: mapMessageToApi(transcript.messages[transcript.messages.length - 1]),
      workspace: await buildWorkspaceApi(ctx.pool, ctx.team.id, ctx.sid),
    });
  }

  if (session.mode === 'sequential' && !session.sequentialDone && session.awaitingAnswer) {
    const answeredHat = session.activeHat;
    const progressed = afterHatStudentAnswer(session, answeredHat);
    transcript.hatSession = progressed.session;

    // 同帽未满 3 轮：承接作答并继续苏格拉底追问（留在本帽）
    if (progressed.stayOnHat) {
      const user = buildWarRoomSingleReplyUserPrompt({
        bundleText: bundle,
        swot: ws.swot,
        marketing: ws.marketing,
        finance: ws.finance,
        transcriptMessages: transcript.messages,
        mentionedHat: answeredHat,
        userMessage,
        studentDisplayName,
      });
      const raw = await runJsonLlm(provider, WAR_ROOM_SINGLE_REPLY_SYSTEM_PROMPT, user);
      const norm = parseWarRoomSingleReplyFromLlmText(raw, answeredHat);
      if (norm.error) return bad(req, res, 400, 40016, norm.error);
      transcript.messages.push({
        id: randomUUID(),
        hat: norm.message.hat,
        content: norm.message.content,
        targetModule: null,
        moduleContent: '',
        adoptedModules: [],
        status: 'ask',
        roundIndex: transcript.roundCount,
        createdAt: new Date().toISOString(),
      });
      transcript.hatSession = markAwaitingAnswer(progressed.session, answeredHat);
      await upsertWarRoomFields(ctx.pool, ctx.team.id, ctx.sid, ws.canvas, transcript);
      await logWarRoomTurn(ctx, userMessage, transcript, transcriptStartLen, answeredHat);
      return ok(req, res, {
        roundMessages: transcript.messages.slice(transcriptStartLen).map(mapMessageToApi),
        workspace: await buildWorkspaceApi(ctx.pool, ctx.team.id, ctx.sid),
      });
    }

    // 本帽 3 轮已满：简短承接后切下一帽追问
    const user = buildWarRoomSingleReplyUserPrompt({
      bundleText: bundle,
      swot: ws.swot,
      marketing: ws.marketing,
      finance: ws.finance,
      transcriptMessages: transcript.messages,
      mentionedHat: answeredHat,
      userMessage,
      studentDisplayName,
    });
    const raw = await runJsonLlm(provider, WAR_ROOM_SINGLE_REPLY_SYSTEM_PROMPT, user);
    const norm = parseWarRoomSingleReplyFromLlmText(raw, answeredHat);
    if (!norm.error) {
      transcript.messages.push({
        id: randomUUID(),
        hat: norm.message.hat,
        content: norm.message.content,
        targetModule: null,
        moduleContent: '',
        adoptedModules: [],
        roundIndex: transcript.roundCount,
        createdAt: new Date().toISOString(),
      });
    }

    if (!progressed.session.sequentialDone) {
      const nextHat = progressed.session.activeHat;
      const ask = await generateWarRoomAsk(provider, ctx, ws, transcript, nextHat, studentDisplayName);
      if (ask.error) return bad(req, res, 400, 40016, ask.error);
      transcript = ask.transcript;
    } else {
      transcript.hatSession = { ...progressed.session, awaitingAnswer: false };
    }

    await upsertWarRoomFields(ctx.pool, ctx.team.id, ctx.sid, ws.canvas, transcript);
    await logWarRoomTurn(ctx, userMessage, transcript, transcriptStartLen, answeredHat);
    return ok(req, res, {
      roundMessages: transcript.messages.slice(transcriptStartLen).map(mapMessageToApi),
      workspace: await buildWorkspaceApi(ctx.pool, ctx.team.id, ctx.sid),
    });
  }

  const user = buildWarRoomSingleReplyUserPrompt({
    bundleText: bundle,
    swot: ws.swot,
    marketing: ws.marketing,
    finance: ws.finance,
    transcriptMessages: transcript.messages,
    mentionedHat: activeHat,
    userMessage,
    studentDisplayName,
  });
  const raw = await runJsonLlm(provider, WAR_ROOM_SINGLE_REPLY_SYSTEM_PROMPT, user);
  const norm = parseWarRoomSingleReplyFromLlmText(raw, activeHat);
  if (norm.error) return bad(req, res, 400, 40016, norm.error);
  transcript.messages.push({
    id: randomUUID(),
    hat: norm.message.hat,
    content: norm.message.content,
    targetModule: null,
    moduleContent: '',
    adoptedModules: [],
    roundIndex: transcript.roundCount,
    createdAt: new Date().toISOString(),
  });

  // 非 @ 的自由回复：不因 resumeHat 自动拉下一顶顺序帽发言
  transcript.hatSession = { ...session, activeHat, awaitingAnswer: false };

  await upsertWarRoomFields(ctx.pool, ctx.team.id, ctx.sid, ws.canvas, transcript);
  await logWarRoomTurn(ctx, userMessage, transcript, transcriptStartLen, activeHat);
  return ok(req, res, {
    roundMessages: transcript.messages.slice(transcriptStartLen).map(mapMessageToApi),
    message: mapMessageToApi(transcript.messages[transcript.messages.length - 1]),
    workspace: await buildWorkspaceApi(ctx.pool, ctx.team.id, ctx.sid),
  });
}

router.post(
  '/student/personal-classes/:classId/business-model/war-room/debate/reply',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      await handleWarRoomReply(req, res);
    } catch (e) {
      logError(`POST war-room debate/reply traceId=${req.traceId}`, e);
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
      req.body = { ...(req.body || {}), activeHat: req.body?.activeHat || req.body?.hat };
      await handleWarRoomReply(req, res);
    } catch (e) {
      logError(`POST war-room debate/round traceId=${req.traceId}`, e);
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
      const ws = await loadWarRoomWorkspaceContext(ctx.pool, ctx.team.id, ctx.sid);
      ws.canvas[moduleKey] = {
        content,
        updatedBy: '学生编辑',
      };
      await upsertWarRoomFields(ctx.pool, ctx.team.id, ctx.sid, ws.canvas, ws.transcript);
      const workspace = await buildWorkspaceApi(ctx.pool, ctx.team.id, ctx.sid);
      return ok(req, res, workspace);
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

      const ws = await loadWarRoomWorkspaceContext(ctx.pool, ctx.team.id, ctx.sid);
      const msg = ws.transcript.messages.find((m) => m.id === messageId);
      if (!msg) return bad(req, res, 404, 40404, '消息不存在');

      const reqKey = String(req.body?.moduleKey || '').trim();
      let moduleKey = reqKey || msg.targetModule;
      let moduleContent = '';
      if (msg.fills?.length && moduleKey) {
        const fill = msg.fills.find((f) => f.targetModule === moduleKey);
        moduleContent = fill?.moduleContent?.trim() || '';
      }
      if (!moduleContent) {
        moduleKey = msg.targetModule;
        moduleContent = String(msg.moduleContent || '').trim();
      }
      if (!moduleKey || !moduleContent) {
        return bad(req, res, 400, 40025, '该消息无可采纳的画布内容');
      }
      if (!WAR_ROOM_MODULE_KEYS.includes(moduleKey)) {
        return bad(req, res, 400, 40004, '无效画布模块');
      }

      ws.canvas[moduleKey] = {
        content: moduleContent,
        updatedBy: HAT_UPDATED_BY[msg.hat] || msg.hat,
      };
      const adoptedModules = [...new Set([...(msg.adoptedModules || []), moduleKey])];
      const requiredKeys =
        msg.fills?.length > 0
          ? msg.fills.map((f) => f.targetModule)
          : msg.targetModule
            ? [msg.targetModule]
            : [];
      const allAdopted = requiredKeys.length > 0 && requiredKeys.every((k) => adoptedModules.includes(k));
      const transcript = {
        ...ws.transcript,
        messages: ws.transcript.messages.map((m) =>
          m.id === messageId
            ? {
                ...m,
                adoptedModules,
                status: allAdopted ? 'adopted' : m.status,
              }
            : m
        ),
      };
      await upsertWarRoomFields(ctx.pool, ctx.team.id, ctx.sid, ws.canvas, transcript);
      const workspace = await buildWorkspaceApi(ctx.pool, ctx.team.id, ctx.sid);
      return ok(req, res, workspace);
    } catch (e) {
      logError(`POST war-room adopt traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.post(
  '/student/personal-classes/:classId/business-model/war-room/save',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      const ws = await loadWarRoomWorkspaceContext(ctx.pool, ctx.team.id, ctx.sid);
      if (warRoomFilledCount(ws.canvas) < WAR_ROOM_MODULE_KEYS.length) {
        return bad(req, res, 400, 40026, '请先填齐商业模式画布九格后再保存');
      }
      await ctx.pool.query(
        `INSERT INTO teacher_personal_class_team_war_room_saved_record
           (team_id, student_id, canvas_json, saved_at)
         VALUES ($1, $2, $3::jsonb, now())
         ON CONFLICT (team_id, student_id) DO UPDATE SET
           canvas_json = EXCLUDED.canvas_json,
           saved_at = now()`,
        [ctx.team.id, ctx.sid, JSON.stringify(ws.canvas)]
      );
      try {
        const { scheduleScoreTeamStage } = await import('../lib/teamCockpitScoring.js');
        scheduleScoreTeamStage(ctx.classId, ctx.team.id, 'business');
      } catch (hookErr) {
        logError('war-room save cockpit hook', hookErr);
      }
      const workspace = await buildWorkspaceApi(ctx.pool, ctx.team.id, ctx.sid);
      return ok(req, res, workspace);
    } catch (e) {
      logError(`POST war-room save traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.get(
  '/student/personal-classes/:classId/business-model/war-room/records/:studentId',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      const targetId = parseId(req.params.studentId);
      if (!targetId) return bad(req, res, 400, 40003, '参数无效');
      if (!(await studentOnTeam(ctx.pool, ctx.team.id, targetId))) {
        return bad(req, res, 403, 40302, '无权查看该成员记录');
      }
      const { rows } = await ctx.pool.query(
        `SELECT r.canvas_json, r.saved_at, u.real_name
         FROM teacher_personal_class_team_war_room_saved_record r
         JOIN users u ON u.id = r.student_id
         WHERE r.team_id = $1 AND r.student_id = $2`,
        [ctx.team.id, targetId]
      );
      if (!rows.length) return bad(req, res, 404, 40404, '暂无保存记录');
      const row = rows[0];
      const canvas = coerceWarRoomCanvas(row.canvas_json);
      return ok(req, res, {
        studentId: String(targetId),
        studentName: String(row.real_name || '').trim() || '同学',
        savedAt: row.saved_at ? new Date(row.saved_at).toISOString() : '',
        canvas,
        filledCount: warRoomFilledCount(canvas),
      });
    } catch (e) {
      logError(`GET war-room record traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

export default router;

