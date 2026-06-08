import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import multer from 'multer';
import { getPool } from '../lib/db.js';
import { logError } from '../lib/logError.js';
import { requireAuth, requireStudent } from '../middleware/auth.js';
import { chatCompletion, chatCompletionStream, getEnabledProvider, friendlyLlmErrorMessage, logPromptToConsole } from '../lib/llmGateway.js';
import { assembleBusinessPlanBundle, bundleForAnalyzeVersion } from '../lib/businessPlanContext.js';
import {
  BUSINESS_PLAN_ANALYZE_SYSTEM_PROMPT,
  BUSINESS_PLAN_ANALYZE_JSON_SYSTEM_PROMPT,
  BUSINESS_PLAN_FILL_SECTION_SYSTEM_PROMPT,
  BUSINESS_PLAN_GENERATE_SYSTEM_PROMPT,
  buildBusinessPlanAnalyzeUserPrompt,
  buildBusinessPlanFillSectionUserPrompt,
  buildBusinessPlanGenerateUserPrompt,
  normalizeBusinessPlanAnalyzePayload,
  normalizeGeneratePayload,
} from '../lib/businessPlanPrompts.js';
import {
  coerceSections,
  countCompletedSections,
  defaultSections,
  sectionsToFullText,
} from '../lib/businessPlanSections.js';
import { evaluateModulePrerequisiteForStudent } from '../lib/trainingModulePrerequisite.js';
import { formatDateTimeZhCN } from '../lib/calendarDate.js';
import {
  createMarketResearchStreamHandler,
  extractJsonFromLlmText,
  findAllBalancedJsonObjects,
  setupSseResponse,
  sseWrite,
} from '../lib/marketResearchSse.js';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_ROOT = path.join(__dirname, '../../uploads/business-plan-submissions');
const MAX_ATTACHMENTS = 10;
const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function normalizeUploadFileName(name) {
  const raw = String(name || 'file').trim() || 'file';
  const decoded = Buffer.from(raw, 'latin1').toString('utf8');
  const looksLatin1Mojibake = /[\u0080-\u00ff]/.test(raw);
  const decodedLooksValid = decoded && decoded !== raw && !decoded.includes('\uFFFD') && /[^\u0000-\u00ff]/.test(decoded);
  return looksLatin1Mojibake && decodedLooksValid ? decoded : raw;
}

function extOf(name) {
  return path.extname(String(name || '')).toLowerCase();
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      ensureDir(UPLOAD_ROOT);
      cb(null, UPLOAD_ROOT);
    },
    filename: (_req, file, cb) => {
      const original = normalizeUploadFileName(file.originalname);
      cb(null, `${randomUUID()}_${original}`);
    },
  }),
  limits: { files: MAX_ATTACHMENTS, fileSize: MAX_ATTACHMENT_BYTES },
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
  return { id: Number(rows[0].id), name: rows[0].name || '' };
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

async function userDisplayName(pool, userId) {
  if (!userId) return '';
  const { rows } = await pool.query(
    `SELECT COALESCE(real_name, username) AS name FROM users WHERE id = $1`,
    [userId]
  );
  return rows[0] ? String(rows[0].name || '').trim() : '';
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
    bad(req, res, 400, 40014, '教师确认组队后可撰写商业计划书');
    return null;
  }
  const leaderId = await resolveTeamLeaderId(pool, team.id);
  const members = await loadTeamMembers(pool, team.id);
  return {
    sid,
    classId,
    pool,
    team,
    leaderId,
    members,
    isTeamLeader: String(leaderId || '') === String(sid),
  };
}

async function assertEntryAllowed(ctx, req, res) {
  const result = await evaluateModulePrerequisiteForStudent(ctx.pool, ctx.sid, 'plan');
  if (!result.allowed) {
    bad(req, res, 403, 40310, result.summary || '请先完成本环节实践课程学习及知识点检测后再开始撰写商业计划书。');
    return false;
  }
  return true;
}

async function loadSubmission(pool, teamId) {
  const { rows } = await pool.query(
    `SELECT s.id, s.version_id, s.status, s.submitted_at, s.review_comment, s.reviewed_at,
            v.version_no AS "versionNo", v.summary AS "versionSummary"
     FROM teacher_personal_class_team_business_plan_submissions s
     JOIN teacher_personal_class_team_business_plan_versions v ON v.id = s.version_id
     WHERE s.team_id = $1`,
    [teamId]
  );
  if (!rows.length) return null;
  const r = rows[0];
  return {
    id: String(r.id),
    versionId: String(r.version_id),
    versionNo: Number(r.versionNo),
    versionSummary: String(r.versionSummary || ''),
    status: String(r.status),
    submittedAt: r.submitted_at ? new Date(r.submitted_at).toISOString() : '',
    reviewComment: String(r.review_comment || ''),
    reviewedAt: r.reviewed_at ? new Date(r.reviewed_at).toISOString() : '',
  };
}

async function isReadOnly(pool, teamId) {
  const sub = await loadSubmission(pool, teamId);
  return sub?.status === 'approved';
}

async function ensureWorkspace(pool, teamId, classId) {
  const { rows } = await pool.query(
    `SELECT sections_json, updated_at, updated_by
     FROM teacher_personal_class_team_business_plan_workspace
     WHERE team_id = $1`,
    [teamId]
  );
  if (rows.length) return rows[0];
  await pool.query(
    `INSERT INTO teacher_personal_class_team_business_plan_workspace
       (team_id, teacher_personal_class_id, sections_json, updated_by)
     VALUES ($1, $2, $3::jsonb, NULL)
     ON CONFLICT (team_id) DO NOTHING`,
    [teamId, classId, JSON.stringify(defaultSections())]
  );
  const { rows: again } = await pool.query(
    `SELECT sections_json, updated_at, updated_by
     FROM teacher_personal_class_team_business_plan_workspace
     WHERE team_id = $1`,
    [teamId]
  );
  return again[0];
}

async function loadVersionSummaries(pool, teamId) {
  const { rows } = await pool.query(
    `SELECT v.id, v.version_no, v.summary, v.saved_at, v.saved_by,
            COALESCE(u.real_name, u.username) AS "savedByName"
     FROM teacher_personal_class_team_business_plan_versions v
     LEFT JOIN users u ON u.id = v.saved_by
     WHERE v.team_id = $1
     ORDER BY v.version_no DESC`,
    [teamId]
  );
  return rows.map((r) => ({
    id: String(r.id),
    versionNumber: Number(r.version_no),
    summary: String(r.summary || ''),
    savedAt: r.saved_at ? formatDateTimeZhCN(r.saved_at) : '',
    operator: String(r.savedByName || '').trim() || '同学',
    savedById: r.saved_by ? String(r.saved_by) : '',
  }));
}

async function buildWorkspacePayload(ctx) {
  const row = await ensureWorkspace(ctx.pool, ctx.team.id, ctx.classId);
  const sections = coerceSections(row?.sections_json);
  const updatedByName = await userDisplayName(ctx.pool, row?.updated_by);
  const versions = await loadVersionSummaries(ctx.pool, ctx.team.id);
  const submission = await loadSubmission(ctx.pool, ctx.team.id);
  const readOnly = submission?.status === 'approved';
  return {
    sections,
    fullText: sectionsToFullText(sections),
    completedSectionCount: countCompletedSections(sections),
    totalSectionCount: sections.length,
    updatedAt: row?.updated_at ? new Date(row.updated_at).toISOString() : '',
    updatedByName,
    versions,
    submission,
    readOnly,
    isTeamLeader: ctx.isTeamLeader,
    teamMemberCount: ctx.members.length,
    trainingEnded: submission?.status === 'approved',
  };
}

function stripHtmlText(s) {
  return String(s || '').replace(/<[^>]+>/g, '').trim();
}

function shouldAllowRenameTitle(oldTitle, nextTitle) {
  const o = String(oldTitle || '').trim();
  const n = String(nextTitle || '').trim();
  if (!n) return false;
  if (!o) return true;
  if (/^新章节\\d+$/i.test(o)) return true;
  return false;
}

function normalizeStreamSectionObject(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const key = String(obj.key || '').trim();
  const title = String(obj.title || '').trim();
  const content = typeof obj.content === 'string' ? obj.content : String(obj.content ?? '');
  if (!key) return null;
  if (!content || !String(content).trim()) return null;
  return { key, title, content: String(content) };
}

router.get('/student/personal-classes/:classId/business-plan/entry', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const ctx = await requireTeamContext(req, res);
    if (!ctx) return;
    const result = await evaluateModulePrerequisiteForStudent(ctx.pool, ctx.sid, 'plan');
    return ok(req, res, {
      allowed: result.allowed,
      prerequisiteModuleKey: 'plan',
      requiredKnowledgePointCount: result.requiredKnowledgePointCount,
      passedKnowledgePointCount: result.passedKnowledgePointCount,
      summary: result.summary,
    });
  } catch (e) {
    logError(`GET business-plan entry traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.get('/student/personal-classes/:classId/business-plan/workspace', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const ctx = await requireTeamContext(req, res);
    if (!ctx) return;
    const payload = await buildWorkspacePayload(ctx);
    return ok(req, res, payload);
  } catch (e) {
    logError(`GET business-plan workspace traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.get('/student/personal-classes/:classId/business-plan/submission', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const ctx = await requireTeamContext(req, res);
    if (!ctx) return;
    const submission = await loadSubmission(ctx.pool, ctx.team.id);
    return ok(req, res, { submission, trainingEnded: submission?.status === 'approved' });
  } catch (e) {
    logError(`GET business-plan submission traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.put('/student/personal-classes/:classId/business-plan/workspace', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const ctx = await requireTeamContext(req, res);
    if (!ctx) return;
    if (!(await assertEntryAllowed(ctx, req, res))) return;
    if (await isReadOnly(ctx.pool, ctx.team.id)) {
      return bad(req, res, 403, 40311, '商业计划书已审核通过，不可再编辑');
    }
    const sections = coerceSections(req.body?.sections);
    await ctx.pool.query(
      `INSERT INTO teacher_personal_class_team_business_plan_workspace
         (team_id, teacher_personal_class_id, sections_json, updated_at, updated_by)
       VALUES ($1, $2, $3::jsonb, now(), $4)
       ON CONFLICT (team_id)
       DO UPDATE SET
         sections_json = EXCLUDED.sections_json,
         updated_at = now(),
         updated_by = EXCLUDED.updated_by`,
      [ctx.team.id, ctx.classId, JSON.stringify(sections), ctx.sid]
    );
    const payload = await buildWorkspacePayload(ctx);
    return ok(req, res, payload);
  } catch (e) {
    logError(`PUT business-plan workspace traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.post('/student/personal-classes/:classId/business-plan/versions', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const ctx = await requireTeamContext(req, res);
    if (!ctx) return;
    if (!(await assertEntryAllowed(ctx, req, res))) return;
    if (await isReadOnly(ctx.pool, ctx.team.id)) {
      return bad(req, res, 403, 40311, '商业计划书已审核通过，不可再保存版本');
    }
    const summary = String(req.body?.summary || '').trim();
    if (!summary) return bad(req, res, 400, 40004, '请填写版本说明');

    const row = await ensureWorkspace(ctx.pool, ctx.team.id, ctx.classId);
    const sections = coerceSections(req.body?.sections ?? row?.sections_json);

    await ctx.pool.query(
      `INSERT INTO teacher_personal_class_team_business_plan_workspace
         (team_id, teacher_personal_class_id, sections_json, updated_at, updated_by)
       VALUES ($1, $2, $3::jsonb, now(), $4)
       ON CONFLICT (team_id)
       DO UPDATE SET sections_json = EXCLUDED.sections_json, updated_at = now(), updated_by = EXCLUDED.updated_by`,
      [ctx.team.id, ctx.classId, JSON.stringify(sections), ctx.sid]
    );

    const { rows: maxRows } = await ctx.pool.query(
      `SELECT COALESCE(MAX(version_no), 0)::int AS m
       FROM teacher_personal_class_team_business_plan_versions
       WHERE team_id = $1`,
      [ctx.team.id]
    );
    const nextNo = Number(maxRows[0]?.m || 0) + 1;
    const { rows: ins } = await ctx.pool.query(
      `INSERT INTO teacher_personal_class_team_business_plan_versions
         (team_id, version_no, summary, sections_json, saved_by)
       VALUES ($1, $2, $3, $4::jsonb, $5)
       RETURNING id, version_no, summary, saved_at`,
      [ctx.team.id, nextNo, summary.slice(0, 500), JSON.stringify(sections), ctx.sid]
    );
    const savedByName = await userDisplayName(ctx.pool, ctx.sid);
    const payload = await buildWorkspacePayload(ctx);
    return ok(req, res, {
      version: {
        id: String(ins[0].id),
        versionNumber: Number(ins[0].version_no),
        summary: String(ins[0].summary),
        savedAt: formatDateTimeZhCN(ins[0].saved_at),
        operator: savedByName || '同学',
        data: { sections },
      },
      workspace: payload,
    });
  } catch (e) {
    logError(`POST business-plan versions traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.post(
  '/student/personal-classes/:classId/business-plan/versions/:versionId/restore-preview',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      const versionId = parseId(req.params.versionId);
      if (!versionId) return bad(req, res, 400, 40003, '参数无效');
      const { rows } = await ctx.pool.query(
        `SELECT sections_json FROM teacher_personal_class_team_business_plan_versions
         WHERE id = $1 AND team_id = $2`,
        [versionId, ctx.team.id]
      );
      if (!rows.length) return bad(req, res, 404, 40402, '版本不存在');
      const sections = coerceSections(rows[0].sections_json);
      return ok(req, res, { sections, fullText: sectionsToFullText(sections) });
    } catch (e) {
      logError(`POST business-plan restore-preview traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.delete(
  '/student/personal-classes/:classId/business-plan/versions/:versionId',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      if (!(await assertEntryAllowed(ctx, req, res))) return;
      if (await isReadOnly(ctx.pool, ctx.team.id)) {
        return bad(req, res, 403, 40311, '商业计划书已审核通过，不可删除版本');
      }
      const versionId = parseId(req.params.versionId);
      if (!versionId) return bad(req, res, 400, 40003, '参数无效');

      const { rows } = await ctx.pool.query(
        `SELECT id, saved_by FROM teacher_personal_class_team_business_plan_versions
         WHERE id = $1 AND team_id = $2`,
        [versionId, ctx.team.id]
      );
      if (!rows.length) return bad(req, res, 404, 40402, '版本不存在');
      const savedBy = rows[0].saved_by ? String(rows[0].saved_by) : '';
      const canDelete = ctx.isTeamLeader || String(ctx.sid) === savedBy;
      if (!canDelete) return bad(req, res, 403, 40301, '无权限删除该版本');

      const sub = await loadSubmission(ctx.pool, ctx.team.id);
      if (sub?.versionId && String(sub.versionId) === String(versionId)) {
        return bad(req, res, 400, 40004, '该版本已用于提交，不可删除');
      }

      await ctx.pool.query(
        `DELETE FROM teacher_personal_class_team_business_plan_versions
         WHERE id = $1 AND team_id = $2`,
        [versionId, ctx.team.id]
      );

      const payload = await buildWorkspacePayload(ctx);
      return ok(req, res, payload);
    } catch (e) {
      logError(`DELETE business-plan versions traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.post('/student/personal-classes/:classId/business-plan/generate', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const ctx = await requireTeamContext(req, res);
    if (!ctx) return;
    if (!(await assertEntryAllowed(ctx, req, res))) return;
    if (await isReadOnly(ctx.pool, ctx.team.id)) {
      return bad(req, res, 403, 40311, '商业计划书已审核通过，不可再生成');
    }
    const provider = await getEnabledProvider('multimodal');
    if (!provider) return bad(req, res, 503, 50301, '未配置 AI 服务');
    const bundle = await assembleBusinessPlanBundle(ctx.pool, ctx.team.id);
    const current = await ensureWorkspace(ctx.pool, ctx.team.id, ctx.classId);
    const inputSections = coerceSections(current?.sections_json);
    const userPrompt = buildBusinessPlanGenerateUserPrompt(bundle, inputSections);
    logPromptToConsole?.('business-plan.generate.system', BUSINESS_PLAN_GENERATE_SYSTEM_PROMPT);
    logPromptToConsole?.('business-plan.generate.user', userPrompt);
    const { text } = await chatCompletion({
      provider,
      system: BUSINESS_PLAN_GENERATE_SYSTEM_PROMPT,
      user: userPrompt,
      jsonMode: true,
    });
    const sections = normalizeGeneratePayload(text);

    await ctx.pool.query(
      `INSERT INTO teacher_personal_class_team_business_plan_workspace
         (team_id, teacher_personal_class_id, sections_json, updated_at, updated_by)
       VALUES ($1, $2, $3::jsonb, now(), $4)
       ON CONFLICT (team_id)
       DO UPDATE SET sections_json = EXCLUDED.sections_json, updated_at = now(), updated_by = EXCLUDED.updated_by`,
      [ctx.team.id, ctx.classId, JSON.stringify(sections), ctx.sid]
    );

    const { rows: cnt } = await ctx.pool.query(
      `SELECT COUNT(*)::int AS c FROM teacher_personal_class_team_business_plan_versions WHERE team_id = $1`,
      [ctx.team.id]
    );
    if (Number(cnt[0]?.c || 0) === 0) {
      await ctx.pool.query(
        `INSERT INTO teacher_personal_class_team_business_plan_versions
           (team_id, version_no, summary, sections_json, saved_by)
         VALUES ($1, 1, $2, $3::jsonb, $4)`,
        [ctx.team.id, 'AI 一键生成初稿', JSON.stringify(sections), ctx.sid]
      );
    }

    const payload = await buildWorkspacePayload(ctx);
    return ok(req, res, payload);
  } catch (e) {
    logError(`POST business-plan generate traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, friendlyLlmErrorMessage(e));
  }
});

router.post('/student/personal-classes/:classId/business-plan/generate/stream', requireAuth(), requireStudent(), async (req, res) => {
  setupSseResponse(res);
  let heartbeat = null;
  try {
    const ctx = await requireTeamContext(req, res);
    if (!ctx) return;
    if (!(await assertEntryAllowed(ctx, req, res))) return;
    if (await isReadOnly(ctx.pool, ctx.team.id)) {
      sseWrite(res, 'error', { message: '商业计划书已审核通过，不可再生成' });
      res.end();
      return;
    }
    const provider = await getEnabledProvider('multimodal');
    if (!provider) {
      sseWrite(res, 'error', { message: '未配置 AI 服务' });
      res.end();
      return;
    }

    const mode = String(req.body?.mode || 'incremental').trim() === 'full' ? 'full' : 'incremental';
    const inputSectionsRaw = Array.isArray(req.body?.sections) ? req.body.sections : null;
    const workspaceRow = await ensureWorkspace(ctx.pool, ctx.team.id, ctx.classId);
    const workspaceSections = coerceSections(workspaceRow?.sections_json);
    const inputSections = coerceSections(inputSectionsRaw || workspaceSections);

    const byKey = new Map(inputSections.map((s) => [s.key, s]));
    const allowedKeys = new Set(inputSections.map((s) => s.key));
    const processedKeys = new Set();

    const shouldFillContent = (key) => {
      const s = byKey.get(key);
      if (!s) return false;
      if (mode === 'full') return true;
      return stripHtmlText(s.content).length === 0;
    };

    sseWrite(res, 'log', {
      text: mode === 'full' ? '开始全量生成：将重写全部章节内容' : '开始增量生成：仅生成缺失章节/优化章节标题',
    });

    heartbeat = setInterval(() => {
      try {
        sseWrite(res, 'log', { text: '生成中…' });
      } catch {
        /* ignore */
      }
    }, 2000);

    if (mode === 'full') {
      const cleared = inputSections.map((s) => ({ ...s, content: '' }));
      await ctx.pool.query(
        `INSERT INTO teacher_personal_class_team_business_plan_workspace
           (team_id, teacher_personal_class_id, sections_json, updated_at, updated_by)
         VALUES ($1, $2, $3::jsonb, now(), $4)
         ON CONFLICT (team_id)
         DO UPDATE SET sections_json = EXCLUDED.sections_json, updated_at = now(), updated_by = EXCLUDED.updated_by`,
        [ctx.team.id, ctx.classId, JSON.stringify(cleared), ctx.sid]
      );
      sseWrite(res, 'log', { text: '已清空当前内容，开始生成…' });
    }

    const bundle = await assembleBusinessPlanBundle(ctx.pool, ctx.team.id);
    const userPrompt = buildBusinessPlanGenerateUserPrompt(bundle, inputSections);

    const streamSystem = `${BUSINESS_PLAN_GENERATE_SYSTEM_PROMPT}

补充要求（流式输出协议）：
- 你将按顺序输出多个 JSON 对象，每次输出一个对象并换行。
- 每个对象必须形如：{ "key": "...", "title": "...", "content": "..." }
- key 必须使用输入章节列表提供的 key；不得输出数组、不得输出 markdown 代码块、不得输出额外文字。`;

    // 仍打印提示词（便于你核对）
    logPromptToConsole?.(provider, streamSystem, userPrompt);

    let buffer = '';
    let savedCount = 0;
    const streamHandler = createMarketResearchStreamHandler(res);

    await chatCompletionStream({
      provider,
      system: streamSystem,
      user: userPrompt,
      jsonMode: false,
      streamReasoning: true,
      onEvent: async (evt) => {
        if (!evt) return;
        // 透传 thinking/content 给前端（参考产品设计模块）
        streamHandler.onEvent(evt);
        if (evt.kind !== 'content') return;
        buffer += evt.text;
        const objs = findAllBalancedJsonObjects(buffer);
        for (const obj of objs) {
          const norm = normalizeStreamSectionObject(obj);
          if (!norm) continue;
          if (!allowedKeys.has(norm.key)) continue;
          if (processedKeys.has(norm.key)) continue;
          processedKeys.add(norm.key);

          const prev = byKey.get(norm.key);
          const nextTitle = shouldAllowRenameTitle(prev?.title, norm.title) ? norm.title : prev?.title;
          const shouldWrite = shouldFillContent(norm.key);
          if (!shouldWrite && nextTitle === prev?.title) continue;

          byKey.set(norm.key, {
            ...prev,
            title: nextTitle,
            content: shouldWrite ? norm.content : prev?.content,
          });
          const nextSections = inputSections.map((s) => byKey.get(s.key) || s);

          await ctx.pool.query(
            `INSERT INTO teacher_personal_class_team_business_plan_workspace
               (team_id, teacher_personal_class_id, sections_json, updated_at, updated_by)
             VALUES ($1, $2, $3::jsonb, now(), $4)
             ON CONFLICT (team_id)
             DO UPDATE SET sections_json = EXCLUDED.sections_json, updated_at = now(), updated_by = EXCLUDED.updated_by`,
            [ctx.team.id, ctx.classId, JSON.stringify(nextSections), ctx.sid]
          );
          savedCount += 1;
          sseWrite(res, 'section', {
            key: norm.key,
            title: nextTitle,
            content: shouldWrite ? norm.content : prev?.content,
            done: true,
          });
          sseWrite(res, 'log', { text: `已生成并保存章节：${nextTitle || norm.key}` });
        }
      },
    });

    if (heartbeat) clearInterval(heartbeat);

    // 生成完成后，自动落一条新版本（便于恢复/对比）
    try {
      const finalRow = await ensureWorkspace(ctx.pool, ctx.team.id, ctx.classId);
      const finalSections = coerceSections(finalRow?.sections_json);
      const { rows: maxRows } = await ctx.pool.query(
        `SELECT COALESCE(MAX(version_no), 0)::int AS m
         FROM teacher_personal_class_team_business_plan_versions
         WHERE team_id = $1`,
        [ctx.team.id]
      );
      const nextNo = Number(maxRows[0]?.m || 0) + 1;
      const summary =
        mode === 'full'
          ? `AI 全量生成 ${formatDateTimeZhCN(new Date())}`
          : `AI 增量生成 ${formatDateTimeZhCN(new Date())}`;
      await ctx.pool.query(
        `INSERT INTO teacher_personal_class_team_business_plan_versions
           (team_id, version_no, summary, sections_json, saved_by)
         VALUES ($1, $2, $3, $4::jsonb, $5)`,
        [ctx.team.id, nextNo, summary.slice(0, 500), JSON.stringify(finalSections), ctx.sid]
      );
    } catch (e) {
      // 不影响生成主流程
      logError(`POST business-plan generate/stream save-version traceId=${req.traceId}`, e);
    }

    sseWrite(res, 'done', { savedCount });
    res.end();
  } catch (e) {
    logError(`POST business-plan generate/stream traceId=${req.traceId}`, e);
    try {
      if (heartbeat) clearInterval(heartbeat);
    } catch {
      /* ignore */
    }
    try {
      sseWrite(res, 'error', { message: friendlyLlmErrorMessage(e) });
      res.end();
    } catch {
      /* ignore */
    }
  }
});

router.post(
  '/student/personal-classes/:classId/business-plan/sections/fill',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      if (!(await assertEntryAllowed(ctx, req, res))) return;
      if (await isReadOnly(ctx.pool, ctx.team.id)) {
        return bad(req, res, 403, 40311, '商业计划书已审核通过，不可再生成');
      }
      const sectionKey = String(req.body?.sectionKey || '').trim();
      if (!sectionKey) return bad(req, res, 400, 40004, '请选择章节');
      const mode = String(req.body?.mode || 'overwrite').trim() === 'expand' ? 'expand' : 'overwrite';
      const sections = coerceSections(req.body?.sections);
      if (!sections.length) return bad(req, res, 400, 40004, '章节内容为空');
      if (!sections.some((s) => String(s.key || '').trim() === sectionKey)) {
        return bad(req, res, 400, 40004, '章节不存在');
      }
      const provider = await getEnabledProvider('multimodal');
      if (!provider) return bad(req, res, 503, 50301, '未配置 AI 服务');
      const bundle = await assembleBusinessPlanBundle(ctx.pool, ctx.team.id);
      const userPrompt = buildBusinessPlanFillSectionUserPrompt(bundle, sections, sectionKey, mode);
      logPromptToConsole(provider, BUSINESS_PLAN_FILL_SECTION_SYSTEM_PROMPT, userPrompt);

      let text = '';
      try {
        text = await chatCompletion({
          provider,
          system: BUSINESS_PLAN_FILL_SECTION_SYSTEM_PROMPT,
          user: userPrompt,
          jsonMode: true,
        });
      } catch (e) {
        const sm = String(e?.message || '');
        if (/response_format|json_object|json mode/i.test(sm)) {
          text = await chatCompletion({
            provider,
            system: BUSINESS_PLAN_FILL_SECTION_SYSTEM_PROMPT,
            user: userPrompt,
            jsonMode: false,
          });
        } else {
          throw e;
        }
      }
      let parsed;
      try {
        parsed = typeof text === 'string' ? JSON.parse(text) : text;
      } catch {
        parsed = extractJsonFromLlmText(String(text || '')) || null;
      }
      const alt = parsed?.data || parsed?.result || parsed?.output || parsed;
      const filledKey = String(alt?.key || sectionKey).trim();
      const filledContent = String(alt?.content || alt?.text || alt?.html || '').trim();
      if (!filledKey || filledKey !== sectionKey || !filledContent) {
        logError(
          `POST business-plan sections/fill parse traceId=${req.traceId} preview=${String(text || '').slice(0, 600)}`,
          new Error('AI 返回格式无效')
        );
        return bad(req, res, 500, 50000, 'AI 返回格式无效，请稍后重试');
      }
      const nextSections = sections.map((s) => (s.key === sectionKey ? { ...s, content: filledContent } : s));

      await ctx.pool.query(
        `INSERT INTO teacher_personal_class_team_business_plan_workspace
           (team_id, teacher_personal_class_id, sections_json, updated_at, updated_by)
         VALUES ($1, $2, $3::jsonb, now(), $4)
         ON CONFLICT (team_id)
         DO UPDATE SET sections_json = EXCLUDED.sections_json, updated_at = now(), updated_by = EXCLUDED.updated_by`,
        [ctx.team.id, ctx.classId, JSON.stringify(nextSections), ctx.sid]
      );

      const payload = await buildWorkspacePayload(ctx);
      return ok(req, res, payload);
    } catch (e) {
      logError(`POST business-plan sections/fill traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, friendlyLlmErrorMessage(e));
    }
  }
);

router.post('/student/personal-classes/:classId/business-plan/analyze', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const ctx = await requireTeamContext(req, res);
    if (!ctx) return;
    if (!(await assertEntryAllowed(ctx, req, res))) return;
    const versionId = parseId(req.body?.versionId);
    if (!versionId) return bad(req, res, 400, 40003, '请选择版本');
    const { rows } = await ctx.pool.query(
      `SELECT sections_json FROM teacher_personal_class_team_business_plan_versions
       WHERE id = $1 AND team_id = $2`,
      [versionId, ctx.team.id]
    );
    if (!rows.length) return bad(req, res, 404, 40402, '版本不存在');
    const sections = coerceSections(rows[0].sections_json);
    const provider = await getEnabledProvider('multimodal');
    if (!provider) return bad(req, res, 503, 50301, '未配置 AI 服务');
    const contextBundle = await assembleBusinessPlanBundle(ctx.pool, ctx.team.id);
    const analyzeBundle = bundleForAnalyzeVersion(sections, contextBundle);
    const userPrompt = buildBusinessPlanAnalyzeUserPrompt(analyzeBundle);
    logPromptToConsole?.('business-plan.analyze.system', BUSINESS_PLAN_ANALYZE_SYSTEM_PROMPT);
    logPromptToConsole?.('business-plan.analyze.user', userPrompt);
    const { text } = await chatCompletion({
      provider,
      system: BUSINESS_PLAN_ANALYZE_SYSTEM_PROMPT,
      user: userPrompt,
    });
    const resultText = String(text || '').trim();
    const { rows: ins } = await ctx.pool.query(
      `INSERT INTO teacher_personal_class_team_business_plan_analyses
         (team_id, version_id, result_text, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id, created_at`,
      [ctx.team.id, versionId, resultText, ctx.sid]
    );
    const { rows: ver } = await ctx.pool.query(
      `SELECT version_no, summary FROM teacher_personal_class_team_business_plan_versions WHERE id = $1`,
      [versionId]
    );
    return ok(req, res, {
      analysis: {
        id: String(ins[0].id),
        versionId: String(versionId),
        versionNumber: Number(ver[0]?.version_no || 0),
        versionSummary: String(ver[0]?.summary || ''),
        result: resultText,
        createdAt: new Date(ins[0].created_at).toLocaleString('zh-CN'),
      },
    });
  } catch (e) {
    logError(`POST business-plan analyze traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, friendlyLlmErrorMessage(e));
  }
});

router.post(
  '/student/personal-classes/:classId/business-plan/analyze/stream',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    setupSseResponse(res);
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return res.end();
      if (!(await assertEntryAllowed(ctx, req, res))) return res.end();
      const versionId = parseId(req.body?.versionId);
      if (!versionId) {
        sseWrite(res, 'error', { message: '请选择版本' });
        return res.end();
      }
      const { rows } = await ctx.pool.query(
        `SELECT sections_json FROM teacher_personal_class_team_business_plan_versions
         WHERE id = $1 AND team_id = $2`,
        [versionId, ctx.team.id]
      );
      if (!rows.length) {
        sseWrite(res, 'error', { message: '版本不存在' });
        return res.end();
      }
      const sections = coerceSections(rows[0].sections_json);
      const provider = await getEnabledProvider('multimodal');
      if (!provider) {
        sseWrite(res, 'error', { message: '未配置 AI 服务' });
        return res.end();
      }

      const contextBundle = await assembleBusinessPlanBundle(ctx.pool, ctx.team.id);
      const analyzeBundle = bundleForAnalyzeVersion(sections, contextBundle);
      const userPrompt = buildBusinessPlanAnalyzeUserPrompt(analyzeBundle);

      const streamHandler = createMarketResearchStreamHandler(res);
      let fullText = '';
      try {
        fullText = await chatCompletionStream({
          provider,
          system: BUSINESS_PLAN_ANALYZE_JSON_SYSTEM_PROMPT,
          user: userPrompt,
          onEvent: streamHandler.onEvent,
          jsonMode: true,
          streamReasoning: true,
        });
      } catch (e) {
        const sm = String(e?.message || '');
        if (/response_format|json_object|json mode/i.test(sm)) {
          fullText = await chatCompletionStream({
            provider,
            system: BUSINESS_PLAN_ANALYZE_JSON_SYSTEM_PROMPT,
            user: userPrompt,
            onEvent: streamHandler.onEvent,
            jsonMode: false,
            streamReasoning: true,
          });
        } else {
          throw e;
        }
      }

      const parseSources = [String(fullText || '').trim(), streamHandler.getParseText('')].filter(Boolean);
      let normalized = null;
      for (const src of parseSources) {
        const parsed = extractJsonFromLlmText(src);
        normalized = normalizeBusinessPlanAnalyzePayload(parsed);
        if (normalized) break;
      }
      if (!normalized) {
        sseWrite(res, 'error', {
          message: parseSources.length ? '分析结果格式无效，请重试' : '模型未返回内容',
        });
        return res.end();
      }

      const resultText = JSON.stringify(normalized);
      const { rows: ins } = await ctx.pool.query(
        `INSERT INTO teacher_personal_class_team_business_plan_analyses
           (team_id, version_id, result_text, created_by)
         VALUES ($1, $2, $3, $4)
         RETURNING id, created_at`,
        [ctx.team.id, versionId, resultText, ctx.sid]
      );

      sseWrite(res, 'done', {
        analysis: normalized,
        analysisId: String(ins[0].id),
        createdAt: formatDateTimeZhCN(ins[0].created_at),
      });
      res.end();
    } catch (e) {
      logError(`POST business-plan analyze/stream traceId=${req.traceId}`, e);
      try {
        sseWrite(res, 'error', { message: friendlyLlmErrorMessage(e) });
        res.end();
      } catch {
        /* ignore */
      }
    }
  }
);

router.get('/student/personal-classes/:classId/business-plan/analyses', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const ctx = await requireTeamContext(req, res);
    if (!ctx) return;
    const { rows } = await ctx.pool.query(
      `SELECT a.id, a.version_id, a.result_text, a.created_at,
              v.version_no, v.summary,
              COALESCE(u.real_name, u.username) AS "createdByName"
       FROM teacher_personal_class_team_business_plan_analyses a
       JOIN teacher_personal_class_team_business_plan_versions v ON v.id = a.version_id
       LEFT JOIN users u ON u.id = a.created_by
       WHERE a.team_id = $1
       ORDER BY a.created_at DESC`,
      [ctx.team.id]
    );
    const analyses = rows.map((r) => ({
      id: String(r.id),
      versionId: String(r.version_id),
      versionNumber: Number(r.version_no),
      versionSummary: String(r.summary || ''),
      result: String(r.result_text || ''),
      createdAt: r.created_at ? new Date(r.created_at).toLocaleString('zh-CN') : '',
      createdByName: String(r.createdByName || '').trim(),
    }));
    return ok(req, res, { analyses });
  } catch (e) {
    logError(`GET business-plan analyses traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.post(
  '/student/personal-classes/:classId/business-plan/submit',
  requireAuth(),
  requireStudent(),
  upload.array('files', MAX_ATTACHMENTS),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      if (!(await assertEntryAllowed(ctx, req, res))) return;
      if (!ctx.isTeamLeader) return bad(req, res, 403, 40303, '仅队长可提交最终商业计划书');

      const versionId = parseId(req.body?.versionId);
      if (!versionId) return bad(req, res, 400, 40003, '请选择要提交的版本');

      const files = Array.isArray(req.files) ? req.files : [];
      const allowedExt = new Set(['.ppt', '.pptx', '.doc', '.docx', '.pdf', '.xls', '.xlsx', '.zip']);
      const normalized = files.map((f) => {
        const originName = normalizeUploadFileName(f.originalname);
        const ext = extOf(originName);
        return {
          originName,
          ext,
          mimeType: String(f.mimetype || ''),
          size: Number(f.size || 0),
          storageKey: path.basename(String(f.filename || '')),
        };
      });
      if (normalized.some((f) => !allowedExt.has(f.ext))) {
        return bad(req, res, 400, 40021, '仅支持上传 PPT/Word/PDF/Excel/ZIP 格式附件');
      }
      const hasPpt = normalized.some((f) => f.ext === '.ppt' || f.ext === '.pptx');
      if (!hasPpt) {
        return bad(req, res, 400, 40022, '请上传商业计划书演示文稿（PPT）');
      }

      const { rows: ver } = await ctx.pool.query(
        `SELECT id FROM teacher_personal_class_team_business_plan_versions
         WHERE id = $1 AND team_id = $2`,
        [versionId, ctx.team.id]
      );
      if (!ver.length) return bad(req, res, 404, 40402, '版本不存在');

      const existing = await loadSubmission(ctx.pool, ctx.team.id);
      if (existing?.status === 'pending') {
        return bad(req, res, 400, 40012, '已有待审核的提交，请等待教师审核');
      }
      if (existing?.status === 'approved') {
        return bad(req, res, 400, 40013, '商业计划书已通过审核');
      }

      // 先写 submission，拿到 submissionId
      if (existing) {
        await ctx.pool.query(
          `UPDATE teacher_personal_class_team_business_plan_submissions
           SET version_id = $2, status = 'pending', submitted_by = $3, submitted_at = now(),
               review_comment = '', reviewed_by = NULL, reviewed_at = NULL
           WHERE team_id = $1`,
          [ctx.team.id, versionId, ctx.sid]
        );
      } else {
        await ctx.pool.query(
          `INSERT INTO teacher_personal_class_team_business_plan_submissions
             (team_id, teacher_personal_class_id, version_id, status, submitted_by)
           VALUES ($1, $2, $3, 'pending', $4)`,
          [ctx.team.id, ctx.classId, versionId, ctx.sid]
        );
      }

      const { rows: subRows } = await ctx.pool.query(
        `SELECT id FROM teacher_personal_class_team_business_plan_submissions WHERE team_id = $1 LIMIT 1`,
        [ctx.team.id]
      );
      const submissionId = subRows[0]?.id;
      if (!submissionId) return bad(req, res, 500, 50010, '提交记录创建失败');

      // 清理旧附件记录（文件不做物理删除，避免误删）
      await ctx.pool.query(
        `DELETE FROM teacher_personal_class_team_business_plan_submission_attachments WHERE submission_id = $1`,
        [submissionId]
      );

      // 插入附件记录
      for (let i = 0; i < normalized.length; i++) {
        const f = normalized[i];
        const isPpt = f.ext === '.ppt' || f.ext === '.pptx';
        await ctx.pool.query(
          `INSERT INTO teacher_personal_class_team_business_plan_submission_attachments
             (submission_id, storage_key, file_name, file_size, mime_type, ext, is_ppt, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [submissionId, f.storageKey, f.originName, f.size, f.mimeType, f.ext, isPpt, i]
        );
      }

      const submission = await loadSubmission(ctx.pool, ctx.team.id);
      return ok(req, res, { submission, trainingEnded: false });
    } catch (e) {
      logError(`POST business-plan submit traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

export default router;
