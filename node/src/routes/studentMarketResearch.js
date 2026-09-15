import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { randomUUID } from 'crypto';
import { getPool } from '../lib/db.js';
import { logError } from '../lib/logError.js';
import { requireAuth, requireStudent } from '../middleware/auth.js';
import { chatCompletion, chatCompletionStream, getEnabledProvider, logPromptToConsole, friendlyLlmErrorMessage } from '../lib/llmGateway.js';
import {
  MARKET_SURVEY_SYSTEM_PROMPT,
  buildMarketSurveyUserPrompt,
  validateAiGenerateParams,
  normalizeLlmSurveyPayload,
} from '../lib/marketResearchSurveyPrompts.js';
import {
  validateQuestionsInput,
  loadSurveyQuestions,
  mapSurveyRow,
  replaceSurveyQuestions,
  loadSavedPlanRow,
  planPayloadFromRow,
  getSurveyForTeam,
  validateSurveyClosesAt,
  assertSurveyIdsForTeam,
} from '../lib/marketResearchSurveyDb.js';
import { resolvePublicWebOrigin } from '../lib/publicWebOrigin.js';
import { normalizeUploadFileName } from '../lib/uploadFileName.js';
import {
  buildMarketResearchContext,
  buildSurveyOnlyContext,
  deriveChartsFromSurveyBlocks,
  formatSurveyOnlyForPrompt,
  mergeAnalysisCharts,
  formatUploadsForPrompt,
  projectTopicTextFromRow,
  UPLOAD_METHODS,
} from '../lib/marketResearchContext.js';
import {
  MARKET_ANALYSIS_SYSTEM_PROMPT,
  buildMarketAnalysisUserPrompt,
  normalizeAnalysisResult,
} from '../lib/marketResearchAnalysisPrompts.js';
import {
  MARKET_PERSONA_SYSTEM_PROMPT,
  buildMarketPersonaUserPrompt,
  normalizePersonaPayload,
} from '../lib/marketResearchPersonaPrompts.js';
import {
  agentIdForRound,
  buildChallengeFinalUserPrompt,
  buildChallengeQuestionUserPrompt,
  CHALLENGE_FINAL_REPORT_SYSTEM_PROMPT,
  CHALLENGE_QUESTION_SYSTEM_PROMPT,
  normalizeChallengeFinalReport,
  normalizeChallengeQuestion,
  resolveAgentMeta,
  totalChallengeRounds,
} from '../lib/marketResearchChallengePrompts.js';
import {
  extractJsonFromLlmText,
  setupSseResponse,
  sseWrite,
  createMarketResearchStreamHandler,
} from '../lib/marketResearchSse.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_ROOT = path.join(__dirname, '../../uploads/market-research');
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

const METHODS_ALLOWED = [...UPLOAD_METHODS];
const LEGACY_ONLINE_SURVEY_METHOD = '线上问卷';
const ALLOWED_EXT = new Set(['.txt', '.docx']);
const ALLOWED_MIME = new Set([
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const router = Router();

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

async function getMarketStageDates(pool, classId) {
  const { rows } = await pool.query(
    `SELECT to_char(start_date, 'YYYY-MM-DD') AS start_date,
            to_char(deadline_date, 'YYYY-MM-DD') AS deadline_date
     FROM teacher_personal_class_course_settings
     WHERE teacher_personal_class_id = $1 AND module_key = 'market'`,
    [classId]
  );
  const row = rows[0];
  if (!row?.start_date || !row?.deadline_date) return null;
  return { startDate: String(row.start_date), deadlineDate: String(row.deadline_date) };
}

function dateInRange(dateStr, startDate, deadlineDate) {
  if (!dateStr || !startDate || !deadlineDate) return false;
  const t = new Date(`${dateStr}T00:00:00`).getTime();
  const s = new Date(`${startDate}T00:00:00`).getTime();
  const e = new Date(`${deadlineDate}T00:00:00`).getTime();
  return t >= s && t <= e;
}

function parseJsonArray(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const p = JSON.parse(val);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

function filterPlanMethods(methods) {
  return methods.filter((m) => m !== LEGACY_ONLINE_SURVEY_METHOD && METHODS_ALLOWED.includes(m));
}

function mapPlanRow(row) {
  if (!row) return null;
  return {
    goal: row.goal || '',
    methods: filterPlanMethods(parseJsonArray(row.methods)),
    startDate: row.plan_start_date ? String(row.plan_start_date).slice(0, 10) : '',
    endDate: row.plan_end_date ? String(row.plan_end_date).slice(0, 10) : '',
    assignments: parseJsonArray(row.assignments),
    savedAt: row.saved_at ? new Date(row.saved_at).toLocaleString('zh-CN') : '',
  };
}

function validatePlanBody(body, memberIds, stage) {
  const goal = String(body?.goal || '').trim();
  if (!goal) return { error: '请填写调研目标' };
  const methodsRaw = Array.isArray(body?.methods) ? body.methods.map((m) => String(m).trim()).filter(Boolean) : [];
  const methods = filterPlanMethods(methodsRaw);
  if (!methods.length) return { error: '请至少选择一种调研方法' };
  for (const m of methodsRaw) {
    if (m === LEGACY_ONLINE_SURVEY_METHOD) continue;
    if (!METHODS_ALLOWED.includes(m)) return { error: `无效的调研方法：${m}` };
  }
  const startDate = String(body?.startDate || '').trim();
  const endDate = String(body?.endDate || '').trim();
  if (!startDate || !endDate) return { error: '请设置计划起止时间' };
  if (!stage) return { error: '市场调研环节尚未配置开始与截止日期，请联系教师' };
  if (!dateInRange(startDate, stage.startDate, stage.deadlineDate)) {
    return { error: `开始时间须在实训环节范围内（${stage.startDate} 至 ${stage.deadlineDate}）` };
  }
  if (!dateInRange(endDate, stage.startDate, stage.deadlineDate)) {
    return { error: `结束时间须在实训环节范围内（${stage.startDate} 至 ${stage.deadlineDate}）` };
  }
  if (new Date(`${endDate}T00:00:00`) < new Date(`${startDate}T00:00:00`)) {
    return { error: '结束时间不能早于开始时间' };
  }
  const assignmentsIn = Array.isArray(body?.assignments) ? body.assignments : [];
  const assignments = [];
  for (const item of assignmentsIn) {
    if (!item || typeof item !== 'object') continue;
    const role = String(item.role || '').trim();
    if (!role) return { error: '请填写分工名称' };
    const ids = Array.isArray(item.memberIds)
      ? item.memberIds.map((id) => String(id).trim()).filter(Boolean)
      : [];
    for (const id of ids) {
      if (!memberIds.has(id)) return { error: '分工成员不在本小组内' };
    }
    assignments.push({ role, memberIds: ids });
  }
  if (assignments.length < 1) return { error: '请至少保留一项任务分工' };
  return { goal, methods, startDate, endDate, assignments };
}

function uploadAbsPath(storageKey) {
  return path.join(UPLOAD_ROOT, storageKey);
}

function methodDirSegment(method) {
  return String(method).replace(/[/\\]/g, '_');
}

const uploadStorage = multer.diskStorage({
  destination(req, file, cb) {
    const classId = parseId(req.params.classId);
    const method = String(req.body?.method || '').trim();
    if (!classId || !UPLOAD_METHODS.includes(method)) return cb(new Error('参数无效'));
    (async () => {
      try {
        const pool = getPool();
        const sid = studentIdFromReq(req);
        const team = await getConfirmedTeam(pool, sid, classId);
        if (!team) return cb(new Error('请先完成组队'));
        const dir = path.join(
          UPLOAD_ROOT,
          String(classId),
          String(team.id),
          methodDirSegment(method)
        );
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      } catch (e) {
        cb(e instanceof Error ? e : new Error(String(e)));
      }
    })();
  },
  filename(req, file, cb) {
    const origin = normalizeUploadFileName(file.originalname);
    file.originalname = origin;
    const safe = origin.replace(/[/\\]/g, '_');
    cb(null, `${randomUUID()}_${safe}`);
  },
});

const uploadFile = multer({
  storage: uploadStorage,
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

function fileAllowed(file) {
  const name = normalizeUploadFileName(file.originalname).toLowerCase();
  const ext = path.extname(name);
  if (!ALLOWED_EXT.has(ext)) return false;
  const mime = String(file.mimetype || '').toLowerCase();
  if (mime && !ALLOWED_MIME.has(mime)) return false;
  return true;
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
    bad(req, res, 400, 40014, '教师确认组队后可使用市场调研');
    return null;
  }
  const leaderId = await resolveTeamLeaderId(pool, team.id);
  const members = await loadTeamMembers(pool, team.id);
  return { sid, classId, pool, team, leaderId, members, isTeamLeader: String(leaderId || '') === String(sid) };
}

function extractJsonObject(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

async function mapSurveyWithQuestions(pool, row, req) {
  const questions = await loadSurveyQuestions(pool, row.id);
  const base = await resolvePublicWebOrigin(req);
  return mapSurveyRow(row, questions, base);
}

router.get('/student/personal-classes/:classId/market-research/plan', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const ctx = await requireTeamContext(req, res);
    if (!ctx) return;
    const { rows } = await ctx.pool.query(
      `SELECT goal, methods, plan_start_date, plan_end_date, assignments, saved_at
       FROM teacher_personal_class_team_market_research_plans
       WHERE team_id = $1`,
      [ctx.team.id]
    );
    const stage = await getMarketStageDates(ctx.pool, ctx.classId);
    return ok(req, res, {
      plan: mapPlanRow(rows[0]),
      isTeamLeader: ctx.isTeamLeader,
      teamMembers: ctx.members,
      stagePeriod: stage,
    });
  } catch (e) {
    logError(`GET market-research plan traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.put('/student/personal-classes/:classId/market-research/plan', requireAuth(), requireStudent(), async (req, res) => {
  const client = await getPool().connect();
  let transactionOpen = false;
  try {
    const ctx = await requireTeamContext(req, res);
    if (!ctx) return;
    if (!ctx.isTeamLeader) return bad(req, res, 403, 40304, '仅队长可编辑调研计划');

    const memberIds = new Set(ctx.members.map((m) => m.id));
    const stage = await getMarketStageDates(ctx.pool, ctx.classId);
    const v = validatePlanBody(req.body, memberIds, stage);
    if (v.error) return bad(req, res, 400, 40004, v.error);

    await client.query('BEGIN');
    transactionOpen = true;

    const { rows } = await client.query(
      `INSERT INTO teacher_personal_class_team_market_research_plans
         (team_id, goal, methods, plan_start_date, plan_end_date, assignments, saved_by, saved_at)
       VALUES ($1, $2, $3::jsonb, $4::date, $5::date, $6::jsonb, $7, now())
       ON CONFLICT (team_id) DO UPDATE SET
         goal = EXCLUDED.goal,
         methods = EXCLUDED.methods,
         plan_start_date = EXCLUDED.plan_start_date,
         plan_end_date = EXCLUDED.plan_end_date,
         assignments = EXCLUDED.assignments,
         saved_by = EXCLUDED.saved_by,
         saved_at = now(),
         updated_at = now()
       RETURNING goal, methods, plan_start_date, plan_end_date, assignments, saved_at`,
      [
        ctx.team.id,
        v.goal,
        JSON.stringify(v.methods),
        v.startDate,
        v.endDate,
        JSON.stringify(v.assignments),
        ctx.sid,
      ]
    );

    const roleSummary = v.assignments
      .filter((a) => a.memberIds.length > 0)
      .map((a) => {
        const names = a.memberIds
          .map((id) => ctx.members.find((m) => m.id === id)?.name || id)
          .join('、');
        return `${a.role}：${names}`;
      })
      .join('；');
    const notifyContent = roleSummary
      ? `队长已更新调研计划。分工：${roleSummary}`
      : '队长已更新调研计划，请查看分工与时间节点。';

    await client.query(
      `INSERT INTO notifications (receiver_id, sender_id, type, title, content, related_module, related_link, is_read)
       SELECT m.student_id, $2, 'task', $3, $4, 'market_research_plan',
              '/student-center?tab=module-market&marketTab=methods', false
       FROM teacher_personal_class_team_members m
       WHERE m.team_id = $1 AND m.student_id <> $2`,
      [ctx.team.id, ctx.sid, '调研计划已更新', notifyContent]
    );

    await client.query('COMMIT');
    transactionOpen = false;

    return ok(req, res, {
      plan: mapPlanRow(rows[0]),
      isTeamLeader: true,
      teamMembers: ctx.members,
      stagePeriod: stage,
    });
  } catch (e) {
    if (transactionOpen) await client.query('ROLLBACK').catch(() => {});
    logError(`PUT market-research plan traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  } finally {
    client.release();
  }
});

router.get('/student/personal-classes/:classId/market-research/uploads', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const ctx = await requireTeamContext(req, res);
    if (!ctx) return;
    const method = String(req.query.method || '').trim();
    if (!UPLOAD_METHODS.includes(method)) return bad(req, res, 400, 40003, '无效的调研方法');

    const { rows } = await ctx.pool.query(
      `SELECT u.id, u.original_filename AS "originalFilename", u.file_size AS "fileSize",
              u.created_at AS "createdAt", u.uploaded_by AS "uploadedBy",
              COALESCE(s.real_name, s.username) AS "uploaderName"
       FROM teacher_personal_class_team_market_research_uploads u
       JOIN users s ON s.id = u.uploaded_by
       WHERE u.team_id = $1 AND u.method = $2
       ORDER BY u.created_at DESC`,
      [ctx.team.id, method]
    );
    return ok(
      req,
      res,
      rows.map((r) => ({
        id: String(r.id),
        originalFilename: normalizeUploadFileName(r.originalFilename),
        fileSize: Number(r.fileSize || 0),
        createdAt: r.createdAt ? new Date(r.createdAt).toLocaleString('zh-CN') : '',
        uploaderName: r.uploaderName || '',
        uploadedBy: String(r.uploadedBy),
      }))
    );
  } catch (e) {
    logError(`GET market-research uploads traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.post(
  '/student/personal-classes/:classId/market-research/uploads',
  requireAuth(),
  requireStudent(),
  (req, res, next) => {
    uploadFile.single('file')(req, res, (err) => {
      if (err) return bad(req, res, 400, 40005, err.message || '上传失败');
      next();
    });
  },
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      const method = String(req.body?.method || '').trim();
      if (!UPLOAD_METHODS.includes(method)) return bad(req, res, 400, 40003, '无效的调研方法');
      if (!req.file) return bad(req, res, 400, 40004, '请选择文件');
      if (!fileAllowed(req.file)) return bad(req, res, 400, 40006, '仅支持 txt、docx 格式');

      const rel = path
        .relative(UPLOAD_ROOT, req.file.path)
        .replace(/\\/g, '/');
      const storageKey = rel;

      const { rows } = await ctx.pool.query(
        `INSERT INTO teacher_personal_class_team_market_research_uploads
           (team_id, method, original_filename, storage_key, mime_type, file_size, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          ctx.team.id,
          method,
          normalizeUploadFileName(req.file.originalname || 'file'),
          storageKey,
          req.file.mimetype || '',
          req.file.size || 0,
          ctx.sid,
        ]
      );
      return ok(req, res, { id: String(rows[0].id) });
    } catch (e) {
      logError(`POST market-research upload traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.get(
  '/student/personal-classes/:classId/market-research/uploads/:uploadId/file',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      const uploadId = parseId(req.params.uploadId);
      if (!uploadId) return bad(req, res, 400, 40003, '参数无效');

      const { rows } = await ctx.pool.query(
        `SELECT original_filename, storage_key
         FROM teacher_personal_class_team_market_research_uploads
         WHERE id = $1 AND team_id = $2`,
        [uploadId, ctx.team.id]
      );
      if (!rows.length) return bad(req, res, 404, 40403, '文件不存在');

      const abs = uploadAbsPath(rows[0].storage_key);
      if (!fs.existsSync(abs)) return bad(req, res, 404, 40404, '文件不存在');

      const filename = normalizeUploadFileName(rows[0].original_filename || 'download');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
      res.sendFile(abs);
    } catch (e) {
      logError(`GET market-research file traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.delete(
  '/student/personal-classes/:classId/market-research/uploads/:uploadId',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      const uploadId = parseId(req.params.uploadId);
      if (!uploadId) return bad(req, res, 400, 40003, '参数无效');

      const { rows } = await ctx.pool.query(
        `SELECT storage_key, uploaded_by
         FROM teacher_personal_class_team_market_research_uploads
         WHERE id = $1 AND team_id = $2`,
        [uploadId, ctx.team.id]
      );
      if (!rows.length) return bad(req, res, 404, 40403, '文件不存在');
      if (String(rows[0].uploaded_by) !== String(ctx.sid)) {
        return bad(req, res, 403, 40302, '仅可删除本人上传的文件');
      }

      await ctx.pool.query(
        `DELETE FROM teacher_personal_class_team_market_research_uploads WHERE id = $1 AND team_id = $2`,
        [uploadId, ctx.team.id]
      );
      const abs = uploadAbsPath(rows[0].storage_key);
      if (fs.existsSync(abs)) {
        try {
          fs.unlinkSync(abs);
        } catch (unlinkErr) {
          logError(`unlink market-research file traceId=${req.traceId}`, unlinkErr);
        }
      }
      return ok(req, res, {});
    } catch (e) {
      logError(`DELETE market-research upload traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.post(
  '/student/personal-classes/:classId/market-research/surveys/ai-generate',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      const params = validateAiGenerateParams(req.body);
      if (params.error) return bad(req, res, 400, 40004, params.error);

      const planRow = await loadSavedPlanRow(ctx.pool, ctx.team.id);
      if (!planRow?.saved_at) return bad(req, res, 400, 40015, '请先保存调研计划');
      const planPayload = planPayloadFromRow(planRow, ctx.members);
      planPayload.methods = filterPlanMethods(planPayload.methods || []);
      const { rows: topicRows } = await ctx.pool.query(
        `SELECT project_name, project_direction, project_description, target_users, core_value,
                core_problem, solution_overview, market_size, competitive_advantage
         FROM teacher_personal_class_team_project_topics WHERE team_id = $1 LIMIT 1`,
        [ctx.team.id]
      );
      const projectTopicText = projectTopicTextFromRow(topicRows[0]);
      const fullCtx = await buildMarketResearchContext(ctx.pool, ctx.team.id, UPLOAD_ROOT);
      const uploadsText = formatUploadsForPrompt(fullCtx.uploads);
      const userPrompt = buildMarketSurveyUserPrompt(planPayload, params, {
        projectTopicText,
        uploadsText,
      });
      const provider = await getEnabledProvider('multimodal');
      if (!provider) return bad(req, res, 400, 40011, '未配置已启用的多模态模型');

      logPromptToConsole(provider, MARKET_SURVEY_SYSTEM_PROMPT, userPrompt);
      const raw = await chatCompletion({
        provider,
        system: MARKET_SURVEY_SYSTEM_PROMPT,
        user: userPrompt,
        jsonMode: true,
      });
      const parsed = extractJsonObject(raw);
      const normalized = normalizeLlmSurveyPayload(parsed, params.includeTypes, params.questionCount);
      if (normalized.error) return bad(req, res, 400, 40016, normalized.error);

      return ok(req, res, {
        title: normalized.title,
        questions: normalized.questions.map((q, i) => ({
          id: `gen-${i + 1}`,
          text: q.text,
          type: q.type,
          options: q.options,
        })),
        promptEcho: { system: MARKET_SURVEY_SYSTEM_PROMPT, user: userPrompt },
      });
    } catch (e) {
      logError(`POST market-research ai-generate traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, friendlyLlmErrorMessage(e));
    }
  }
);

router.get(
  '/student/personal-classes/:classId/market-research/surveys',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      const { rows } = await ctx.pool.query(
        `SELECT id, title, status, collected_count, public_slug, source, created_at, published_at, closes_at
         FROM teacher_personal_class_team_surveys
         WHERE team_id = $1
         ORDER BY COALESCE(published_at, created_at) ASC, id ASC`,
        [ctx.team.id]
      );
      const list = [];
      for (const row of rows) {
        list.push(await mapSurveyWithQuestions(ctx.pool, row, req));
      }
      return ok(req, res, list);
    } catch (e) {
      logError(`GET market-research surveys traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.post(
  '/student/personal-classes/:classId/market-research/surveys',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    const client = await getPool().connect();
    let open = false;
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      const title = String(req.body?.title || '').trim();
      if (!title) return bad(req, res, 400, 40004, '请填写问卷标题');
      const v = validateQuestionsInput(req.body?.questions);
      if (v.error) return bad(req, res, 400, 40004, v.error);
      const source = req.body?.source === 'ai' ? 'ai' : 'manual';
      const stage = await getMarketStageDates(ctx.pool, ctx.classId);
      const closesV = validateSurveyClosesAt(req.body?.closesAt, stage);
      if (closesV.error) return bad(req, res, 400, 40004, closesV.error);

      await client.query('BEGIN');
      open = true;
      const { rows } = await client.query(
        `INSERT INTO teacher_personal_class_team_surveys (team_id, title, status, source, created_by, closes_at)
         VALUES ($1, $2, 'draft', $3, $4, $5::timestamptz)
         RETURNING id, title, status, collected_count, public_slug, source, created_at, published_at, closes_at`,
        [ctx.team.id, title, source, ctx.sid, closesV.closesAt]
      );
      const surveyId = rows[0].id;
      await replaceSurveyQuestions(client, surveyId, v.questions);
      await client.query('COMMIT');
      open = false;
      const questions = await loadSurveyQuestions(client, surveyId);
      const base = await resolvePublicWebOrigin(req);
      return ok(req, res, mapSurveyRow(rows[0], questions, base));
    } catch (e) {
      if (open) await client.query('ROLLBACK').catch(() => {});
      logError(`POST market-research survey traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    } finally {
      client.release();
    }
  }
);

router.put(
  '/student/personal-classes/:classId/market-research/surveys/:surveyId',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    const client = await getPool().connect();
    let open = false;
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      const surveyId = parseId(req.params.surveyId);
      if (!surveyId) return bad(req, res, 400, 40003, '参数无效');
      const existing = await getSurveyForTeam(ctx.pool, surveyId, ctx.team.id);
      if (!existing) return bad(req, res, 404, 40403, '问卷不存在');
      if (existing.status === 'published') {
        return bad(req, res, 400, 40005, '已发布问卷不可编辑，请先撤回');
      }
      const title = String(req.body?.title || '').trim();
      if (!title) return bad(req, res, 400, 40004, '请填写问卷标题');
      const v = validateQuestionsInput(req.body?.questions);
      if (v.error) return bad(req, res, 400, 40004, v.error);
      const stage = await getMarketStageDates(ctx.pool, ctx.classId);
      const closesV = validateSurveyClosesAt(req.body?.closesAt, stage);
      if (closesV.error) return bad(req, res, 400, 40004, closesV.error);

      await client.query('BEGIN');
      open = true;
      const { rows } = await client.query(
        `UPDATE teacher_personal_class_team_surveys
         SET title = $3, closes_at = $4::timestamptz, updated_at = now()
         WHERE id = $1 AND team_id = $2
         RETURNING id, title, status, collected_count, public_slug, source, created_at, published_at, closes_at`,
        [surveyId, ctx.team.id, title, closesV.closesAt]
      );
      await replaceSurveyQuestions(client, surveyId, v.questions);
      await client.query('COMMIT');
      open = false;
      const questions = await loadSurveyQuestions(client, surveyId);
      const base = await resolvePublicWebOrigin(req);
      return ok(req, res, mapSurveyRow(rows[0], questions, base));
    } catch (e) {
      if (open) await client.query('ROLLBACK').catch(() => {});
      logError(`PUT market-research survey traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    } finally {
      client.release();
    }
  }
);

router.delete(
  '/student/personal-classes/:classId/market-research/surveys/:surveyId',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      const surveyId = parseId(req.params.surveyId);
      if (!surveyId) return bad(req, res, 400, 40003, '参数无效');
      const existing = await getSurveyForTeam(ctx.pool, surveyId, ctx.team.id);
      if (!existing) return bad(req, res, 404, 40403, '问卷不存在');
      if (existing.status !== 'draft' && existing.status !== 'withdrawn') {
        return bad(req, res, 400, 40005, '仅草稿或已撤回问卷可删除');
      }
      await ctx.pool.query(
        `DELETE FROM teacher_personal_class_team_surveys WHERE id = $1 AND team_id = $2`,
        [surveyId, ctx.team.id]
      );
      return ok(req, res, { id: String(surveyId) });
    } catch (e) {
      logError(`DELETE market-research survey traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.post(
  '/student/personal-classes/:classId/market-research/surveys/:surveyId/publish',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      const surveyId = parseId(req.params.surveyId);
      if (!surveyId) return bad(req, res, 400, 40003, '参数无效');
      const existing = await getSurveyForTeam(ctx.pool, surveyId, ctx.team.id);
      if (!existing) return bad(req, res, 404, 40403, '问卷不存在');
      if (existing.status === 'published') {
        return bad(req, res, 400, 40005, '问卷已发布');
      }
      const questions = await loadSurveyQuestions(ctx.pool, surveyId);
      const v = validateQuestionsInput(questions.map((q) => ({ text: q.text, type: q.type, options: q.options })));
      if (v.error) return bad(req, res, 400, 40004, v.error);
      if (!existing.closes_at) {
        return bad(req, res, 400, 40004, '请先在编辑问卷中设置截止时间后再发布');
      }
      const stage = await getMarketStageDates(ctx.pool, ctx.classId);
      const closesV = validateSurveyClosesAt(
        new Date(existing.closes_at).toISOString(),
        stage
      );
      if (closesV.error) return bad(req, res, 400, 40004, closesV.error);

      let slug = existing.public_slug;
      if (!slug) slug = randomUUID().replace(/-/g, '');

      const { rows } = await ctx.pool.query(
        `UPDATE teacher_personal_class_team_surveys
         SET status = 'published', public_slug = $3, published_at = COALESCE(published_at, now()), updated_at = now()
         WHERE id = $1 AND team_id = $2
         RETURNING id, title, status, collected_count, public_slug, source, created_at, published_at, closes_at`,
        [surveyId, ctx.team.id, slug]
      );
      const base = await resolvePublicWebOrigin(req);
      const mapped = mapSurveyRow(rows[0], questions, base);
      return ok(req, res, {
        ...mapped,
        publicUrl: mapped.link,
        publicSlug: slug,
      });
    } catch (e) {
      logError(`POST market-research publish traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.post(
  '/student/personal-classes/:classId/market-research/surveys/:surveyId/withdraw',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      const surveyId = parseId(req.params.surveyId);
      if (!surveyId) return bad(req, res, 400, 40003, '参数无效');
      const existing = await getSurveyForTeam(ctx.pool, surveyId, ctx.team.id);
      if (!existing) return bad(req, res, 404, 40403, '问卷不存在');
      if (existing.status !== 'published') {
        return bad(req, res, 400, 40005, '仅进行中的问卷可撤回');
      }
      const { rows } = await ctx.pool.query(
        `UPDATE teacher_personal_class_team_surveys
         SET status = 'withdrawn', updated_at = now()
         WHERE id = $1 AND team_id = $2
         RETURNING id, title, status, collected_count, public_slug, source, created_at, published_at, closes_at`,
        [surveyId, ctx.team.id]
      );
      const questions = await loadSurveyQuestions(ctx.pool, surveyId);
      const base = await resolvePublicWebOrigin(req);
      return ok(req, res, mapSurveyRow(rows[0], questions, base));
    } catch (e) {
      logError(`POST market-research withdraw traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

function displayRespondentToken(row) {
  const t = String(row.respondent_token || '').trim();
  if (t) return t;
  return `legacy-${row.id}`;
}

router.get(
  '/student/personal-classes/:classId/market-research/surveys/:surveyId/responses',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      const surveyId = parseId(req.params.surveyId);
      if (!surveyId) return bad(req, res, 400, 40003, '参数无效');
      const existing = await getSurveyForTeam(ctx.pool, surveyId, ctx.team.id);
      if (!existing) return bad(req, res, 404, 40403, '问卷不存在');

      const questions = await loadSurveyQuestions(ctx.pool, surveyId);
      const { rows } = await ctx.pool.query(
        `SELECT id, answers, respondent_token, submitted_at
         FROM teacher_personal_class_team_survey_responses
         WHERE survey_id = $1
         ORDER BY submitted_at DESC`,
        [surveyId]
      );
      return ok(req, res, {
        surveyTitle: existing.title,
        questions,
        responses: rows.map((r) => ({
          id: String(r.id),
          respondentToken: displayRespondentToken(r),
          submittedAt: r.submitted_at ? new Date(r.submitted_at).toLocaleString('zh-CN') : '',
          answers:
            r.answers && typeof r.answers === 'object' && !Array.isArray(r.answers) ? r.answers : {},
        })),
      });
    } catch (e) {
      logError(`GET market-research responses traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.delete(
  '/student/personal-classes/:classId/market-research/surveys/:surveyId/responses/:responseId',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    const client = await getPool().connect();
    let open = false;
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      const surveyId = parseId(req.params.surveyId);
      const responseId = parseId(req.params.responseId);
      if (!surveyId || !responseId) return bad(req, res, 400, 40003, '参数无效');
      const existing = await getSurveyForTeam(ctx.pool, surveyId, ctx.team.id);
      if (!existing) return bad(req, res, 404, 40403, '问卷不存在');

      await client.query('BEGIN');
      open = true;
      const del = await client.query(
        `DELETE FROM teacher_personal_class_team_survey_responses
         WHERE id = $1 AND survey_id = $2
         RETURNING id`,
        [responseId, surveyId]
      );
      if (!del.rowCount) {
        await client.query('ROLLBACK');
        open = false;
        return bad(req, res, 404, 40404, '答卷不存在');
      }
      await client.query(
        `UPDATE teacher_personal_class_team_surveys
         SET collected_count = GREATEST(collected_count - 1, 0), updated_at = now()
         WHERE id = $1 AND team_id = $2`,
        [surveyId, ctx.team.id]
      );
      await client.query('COMMIT');
      open = false;

      const { rows } = await ctx.pool.query(
        `SELECT collected_count FROM teacher_personal_class_team_surveys WHERE id = $1`,
        [surveyId]
      );
      return ok(req, res, { collected: Number(rows[0]?.collected_count || 0) });
    } catch (e) {
      if (open) await client.query('ROLLBACK').catch(() => {});
      logError(`DELETE market-research response traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    } finally {
      client.release();
    }
  }
);

function mapPersonaRow(row) {
  const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
  return {
    id: String(row.id),
    ...payload,
    source: row.source,
  };
}

async function assertMarketPersonaEditable(pool, teamId, req, res) {
  const { rows } = await pool.query(
    `SELECT 1 FROM teacher_personal_class_team_market_report_uploads WHERE team_id = $1 LIMIT 1`,
    [teamId]
  );
  if (rows.length) {
    bad(req, res, 400, 40020, '调研报告已提交，无法再修改用户画像');
    return false;
  }
  return true;
}

async function loadPersonaMap(pool, teamId) {
  const { rows } = await pool.query(
    `SELECT id, payload FROM teacher_personal_class_team_market_personas WHERE team_id = $1`,
    [teamId]
  );
  const map = {};
  for (const r of rows) {
    map[String(r.id)] = { id: String(r.id), ...(r.payload || {}) };
  }
  return map;
}

function analysisSummaryText(result) {
  if (!result || typeof result !== 'object') return '';
  const parts = [];
  if (result.score != null) parts.push(`综合得分：${result.score}`);
  if (Array.isArray(result.conclusions) && result.conclusions.length) {
    parts.push(`结论：${result.conclusions.join('；')}`);
  }
  return parts.join('\n');
}

async function getSessionForTeam(pool, sessionId, teamId) {
  const { rows } = await pool.query(
    `SELECT * FROM teacher_personal_class_team_market_challenge_sessions
     WHERE id = $1 AND team_id = $2`,
    [sessionId, teamId]
  );
  return rows[0] || null;
}

router.get(
  '/student/personal-classes/:classId/market-research/analysis',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      const { rows } = await ctx.pool.query(
        `SELECT result, generated_at FROM teacher_personal_class_team_market_analysis WHERE team_id = $1`,
        [ctx.team.id]
      );
      if (!rows.length) return ok(req, res, { result: null });
      return ok(req, res, {
        result: rows[0].result,
        generatedAt: rows[0].generated_at ? new Date(rows[0].generated_at).toISOString() : '',
      });
    } catch (e) {
      logError(`GET market-research analysis traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.post(
  '/student/personal-classes/:classId/market-research/analysis/stream',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    setupSseResponse(res);
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return res.end();
      const provider = await getEnabledProvider('multimodal');
      if (!provider) {
        sseWrite(res, 'error', { message: '未配置已启用的 LLM 服务' });
        return res.end();
      }
      const picked = await assertSurveyIdsForTeam(ctx.pool, ctx.team.id, req.body?.surveyIds);
      if (picked.error) {
        sseWrite(res, 'error', { message: picked.error });
        return res.end();
      }
      sseWrite(res, 'status', { message: '正在汇总问卷数据…' });
      const mctx = await buildSurveyOnlyContext(ctx.pool, ctx.team.id, picked.surveyIds);
      const contextText = formatSurveyOnlyForPrompt(mctx);
      const hardStats = mctx.stats;
      const userMsg = buildMarketAnalysisUserPrompt(contextText, hardStats);
      logPromptToConsole(provider, MARKET_ANALYSIS_SYSTEM_PROMPT, userMsg);
      sseWrite(res, 'status', { message: '正在连接模型…' });
      const streamHandler = createMarketResearchStreamHandler(res);
      let fullText = '';
      try {
        try {
          fullText = await chatCompletionStream({
            provider,
            system: MARKET_ANALYSIS_SYSTEM_PROMPT,
            user: userMsg,
            onEvent: streamHandler.onEvent,
            jsonMode: true,
          });
        } catch (streamErr) {
          const sm = String(streamErr?.message || '');
          if (!/response_format|json_object|json mode/i.test(sm)) throw streamErr;
          fullText = await chatCompletionStream({
            provider,
            system: MARKET_ANALYSIS_SYSTEM_PROMPT,
            user: userMsg,
            onEvent: streamHandler.onEvent,
            jsonMode: false,
          });
        }
      } catch (e) {
        sseWrite(res, 'error', { message: friendlyLlmErrorMessage(e) });
        return res.end();
      }
      const parseText = streamHandler.getParseText(fullText);
      const parsed = extractJsonFromLlmText(parseText);
      const norm = normalizeAnalysisResult(parsed, hardStats);
      if (norm.error) {
        const hint = !parsed ? 'AI 返回无法解析为 JSON，请重试' : norm.error;
        logError(`analysis parse failed traceId=${req.traceId} len=${parseText.length}`, new Error(hint));
        sseWrite(res, 'error', { message: hint });
        return res.end();
      }
      const derivedCharts = deriveChartsFromSurveyBlocks(mctx.surveys);
      norm.result.charts = mergeAnalysisCharts(norm.result.charts, derivedCharts);
      await ctx.pool.query(
        `INSERT INTO teacher_personal_class_team_market_analysis (team_id, result, generated_by, generated_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (team_id) DO UPDATE SET
           result = EXCLUDED.result,
           generated_by = EXCLUDED.generated_by,
           generated_at = now()`,
        [ctx.team.id, JSON.stringify(norm.result), ctx.sid]
      );
      sseWrite(res, 'done', { result: norm.result });
      res.end();
    } catch (e) {
      logError(`POST market-research analysis stream traceId=${req.traceId}`, e);
      sseWrite(res, 'error', { message: e.message || '分析失败' });
      res.end();
    }
  }
);

router.get(
  '/student/personal-classes/:classId/market-research/personas',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      const { rows } = await ctx.pool.query(
        `SELECT id, payload, source, created_at FROM teacher_personal_class_team_market_personas
         WHERE team_id = $1 ORDER BY created_at ASC`,
        [ctx.team.id]
      );
      return ok(req, res, rows.map(mapPersonaRow));
    } catch (e) {
      logError(`GET market-research personas traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.post(
  '/student/personal-classes/:classId/market-research/personas',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      if (!(await assertMarketPersonaEditable(ctx.pool, ctx.team.id, req, res))) return;
      const body = req.body || {};
      const name = String(body.name || '').trim();
      if (!name) return bad(req, res, 400, 40004, '请填写姓名');
      const payload = {
        name,
        age: Number(body.age) || 20,
        occupation: String(body.occupation || '').trim(),
        major: String(body.major || '').trim(),
        painPoints: Array.isArray(body.painPoints) ? body.painPoints : [],
        needs: Array.isArray(body.needs) ? body.needs : [],
        habits: Array.isArray(body.habits) ? body.habits : [],
        borderColor: String(body.borderColor || 'border-green-200'),
        accentColor: String(body.accentColor || 'text-green-500'),
        fromSurvey: Boolean(body.fromSurvey),
      };
      const { rows } = await ctx.pool.query(
        `INSERT INTO teacher_personal_class_team_market_personas (team_id, payload, source, created_by)
         VALUES ($1, $2, 'manual', $3) RETURNING id, payload, source`,
        [ctx.team.id, JSON.stringify(payload), ctx.sid]
      );
      return ok(req, res, mapPersonaRow(rows[0]));
    } catch (e) {
      logError(`POST market-research persona traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.put(
  '/student/personal-classes/:classId/market-research/personas/:personaId',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      if (!(await assertMarketPersonaEditable(ctx.pool, ctx.team.id, req, res))) return;
      const personaId = parseId(req.params.personaId);
      if (!personaId) return bad(req, res, 400, 40003, '参数无效');
      const body = req.body || {};
      const { rows: existing } = await ctx.pool.query(
        `SELECT id, payload FROM teacher_personal_class_team_market_personas WHERE id = $1 AND team_id = $2`,
        [personaId, ctx.team.id]
      );
      if (!existing.length) return bad(req, res, 404, 40403, '画像不存在');
      const prev = existing[0].payload || {};
      const payload = {
        ...prev,
        name: String(body.name ?? prev.name ?? '').trim(),
        age: Number(body.age ?? prev.age) || 20,
        occupation: String(body.occupation ?? prev.occupation ?? '').trim(),
        major: String(body.major ?? prev.major ?? '').trim(),
        painPoints: Array.isArray(body.painPoints) ? body.painPoints : prev.painPoints || [],
        needs: Array.isArray(body.needs) ? body.needs : prev.needs || [],
        habits: Array.isArray(body.habits) ? body.habits : prev.habits || [],
        borderColor: String(body.borderColor ?? prev.borderColor ?? 'border-green-200'),
        accentColor: String(body.accentColor ?? prev.accentColor ?? 'text-green-500'),
      };
      const { rows } = await ctx.pool.query(
        `UPDATE teacher_personal_class_team_market_personas SET payload = $1 WHERE id = $2 AND team_id = $3
         RETURNING id, payload, source`,
        [JSON.stringify(payload), personaId, ctx.team.id]
      );
      return ok(req, res, mapPersonaRow(rows[0]));
    } catch (e) {
      logError(`PUT market-research persona traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.delete(
  '/student/personal-classes/:classId/market-research/personas/:personaId',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      if (!(await assertMarketPersonaEditable(ctx.pool, ctx.team.id, req, res))) return;
      const personaId = parseId(req.params.personaId);
      if (!personaId) return bad(req, res, 400, 40003, '参数无效');
      const del = await ctx.pool.query(
        `DELETE FROM teacher_personal_class_team_market_personas WHERE id = $1 AND team_id = $2`,
        [personaId, ctx.team.id]
      );
      if (!del.rowCount) return bad(req, res, 404, 40403, '画像不存在');
      return ok(req, res, {});
    } catch (e) {
      logError(`DELETE market-research persona traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.post(
  '/student/personal-classes/:classId/market-research/personas/ai-generate/stream',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    setupSseResponse(res);
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return res.end();
      const { rows: reportLockRows } = await ctx.pool.query(
        `SELECT 1 FROM teacher_personal_class_team_market_report_uploads WHERE team_id = $1 LIMIT 1`,
        [ctx.team.id]
      );
      if (reportLockRows.length) {
        sseWrite(res, 'error', { message: '调研报告已提交，无法再修改用户画像' });
        return res.end();
      }
      const provider = await getEnabledProvider('multimodal');
      if (!provider) {
        sseWrite(res, 'error', { message: '未配置已启用的 LLM 服务' });
        return res.end();
      }
      const { rows: personaCountRows } = await ctx.pool.query(
        `SELECT COUNT(*)::int AS c FROM teacher_personal_class_team_market_personas WHERE team_id = $1`,
        [ctx.team.id]
      );
      const startIndex = Number(personaCountRows[0]?.c || 0);
      const picked = await assertSurveyIdsForTeam(ctx.pool, ctx.team.id, req.body?.surveyIds);
      if (picked.error) {
        sseWrite(res, 'error', { message: picked.error });
        return res.end();
      }
      sseWrite(res, 'status', { message: '正在汇总问卷数据…' });
      const mctx = await buildSurveyOnlyContext(ctx.pool, ctx.team.id, picked.surveyIds);
      const contextText = formatSurveyOnlyForPrompt(mctx);
      const userMsg = buildMarketPersonaUserPrompt(contextText);
      logPromptToConsole(provider, MARKET_PERSONA_SYSTEM_PROMPT, userMsg);
      const streamHandler = createMarketResearchStreamHandler(res);
      let fullText = '';
      try {
        fullText = await chatCompletionStream({
          provider,
          system: MARKET_PERSONA_SYSTEM_PROMPT,
          user: userMsg,
          onEvent: streamHandler.onEvent,
          jsonMode: true,
        });
      } catch (e) {
        sseWrite(res, 'error', { message: friendlyLlmErrorMessage(e) });
        return res.end();
      }
      const parsed = extractJsonFromLlmText(streamHandler.getParseText(fullText));
      const norm = normalizePersonaPayload(parsed, startIndex);
      if (norm.error) {
        sseWrite(res, 'error', { message: norm.error });
        return res.end();
      }
      const inserted = [];
      for (const p of norm.personas) {
        const { rows } = await ctx.pool.query(
          `INSERT INTO teacher_personal_class_team_market_personas (team_id, payload, source, created_by)
           VALUES ($1, $2, 'ai', $3) RETURNING id, payload, source`,
          [ctx.team.id, JSON.stringify(p), ctx.sid]
        );
        inserted.push(mapPersonaRow(rows[0]));
      }
      sseWrite(res, 'done', { personas: inserted });
      res.end();
    } catch (e) {
      logError(`POST market-research persona ai stream traceId=${req.traceId}`, e);
      sseWrite(res, 'error', { message: e.message || '生成失败' });
      res.end();
    }
  }
);

router.post(
  '/student/personal-classes/:classId/market-research/challenge/sessions',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      const projectInfo = req.body?.projectInfo;
      const selectedAgents = Array.isArray(req.body?.selectedAgents)
        ? req.body.selectedAgents.map((a) => String(a).trim()).filter(Boolean)
        : [];
      if (!projectInfo || typeof projectInfo !== 'object') {
        return bad(req, res, 400, 40004, '请填写项目信息');
      }
      if (!selectedAgents.length) return bad(req, res, 400, 40004, '请选择挑战角色');
      if (selectedAgents.length > 5) return bad(req, res, 400, 40004, '最多选择 5 个角色');
      const { rows } = await ctx.pool.query(
        `INSERT INTO teacher_personal_class_team_market_challenge_sessions
           (team_id, student_id, project_info, selected_agents, rounds, status)
         VALUES ($1, $2, $3, $4, '[]'::jsonb, 'in_progress')
         RETURNING id, created_at`,
        [ctx.team.id, ctx.sid, JSON.stringify(projectInfo), JSON.stringify(selectedAgents)]
      );
      return ok(req, res, {
        sessionId: String(rows[0].id),
        totalRounds: totalChallengeRounds(selectedAgents.length),
        createdAt: rows[0].created_at ? new Date(rows[0].created_at).toISOString() : '',
      });
    } catch (e) {
      logError(`POST challenge session traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.get(
  '/student/personal-classes/:classId/market-research/challenge/sessions/me/latest',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      const { rows } = await ctx.pool.query(
        `SELECT id, project_info, selected_agents, rounds, final_report, status, created_at, completed_at
         FROM teacher_personal_class_team_market_challenge_sessions
         WHERE team_id = $1 AND student_id = $2
         ORDER BY created_at DESC
         LIMIT 1`,
        [ctx.team.id, ctx.sid]
      );
      if (!rows[0]) {
        return ok(req, res, { session: null });
      }
      const r = rows[0];
      return ok(req, res, {
        session: {
          id: String(r.id),
          status: r.status,
          projectInfo: r.project_info || {},
          selectedAgents: Array.isArray(r.selected_agents) ? r.selected_agents : [],
          rounds: Array.isArray(r.rounds) ? r.rounds : [],
          finalReport: r.final_report || null,
          createdAt: r.created_at ? new Date(r.created_at).toISOString() : '',
          completedAt: r.completed_at ? new Date(r.completed_at).toISOString() : '',
        },
      });
    } catch (e) {
      logError(`GET challenge session me/latest traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.get(
  '/student/personal-classes/:classId/market-research/challenge/sessions',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      const { rows } = await ctx.pool.query(
        `SELECT s.id, s.student_id, s.project_info, s.selected_agents, s.final_report, s.status,
                s.created_at, s.completed_at,
                COALESCE(u.real_name, u.username, '') AS student_name
         FROM teacher_personal_class_team_market_challenge_sessions s
         JOIN users u ON u.id = s.student_id
         WHERE s.team_id = $1 AND s.status = 'completed'
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
          createdAt: r.created_at ? new Date(r.created_at).toLocaleString('zh-CN') : '',
          completedAt: r.completed_at ? new Date(r.completed_at).toLocaleString('zh-CN') : '',
          finalReport: r.final_report || null,
        }))
      );
    } catch (e) {
      logError(`GET challenge sessions traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.post(
  '/student/personal-classes/:classId/market-research/challenge/sessions/:sessionId/round/stream',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    setupSseResponse(res);
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return res.end();
      const sessionId = parseId(req.params.sessionId);
      if (!sessionId) {
        sseWrite(res, 'error', { message: '参数无效' });
        return res.end();
      }
      const session = await getSessionForTeam(ctx.pool, sessionId, ctx.team.id);
      if (!session) {
        sseWrite(res, 'error', { message: '会话不存在' });
        return res.end();
      }
      if (String(session.student_id) !== String(ctx.sid)) {
        sseWrite(res, 'error', { message: '无权操作该会话' });
        return res.end();
      }
      if (session.status === 'completed') {
        sseWrite(res, 'error', { message: '会话已结束' });
        return res.end();
      }
      const roundIndex = Number(req.body?.roundIndex);
      const answer = req.body?.answer != null ? String(req.body.answer).trim() : '';
      const selectedAgents = Array.isArray(session.selected_agents) ? session.selected_agents : [];
      const totalRounds = totalChallengeRounds(selectedAgents.length);
      if (!Number.isInteger(roundIndex) || roundIndex < 0 || roundIndex >= totalRounds) {
        sseWrite(res, 'error', { message: '轮次无效' });
        return res.end();
      }
      let rounds = Array.isArray(session.rounds) ? [...session.rounds] : [];
      if (roundIndex > 0) {
        if (!answer) {
          sseWrite(res, 'error', { message: '请先提交上一轮回答' });
          return res.end();
        }
        const prev = rounds[roundIndex - 1];
        if (!prev) {
          sseWrite(res, 'error', { message: '对话顺序异常' });
          return res.end();
        }
        rounds[roundIndex - 1] = { ...prev, answer };
      } else if (roundIndex === 0 && rounds.length === 0) {
        /* ok */
      } else if (rounds[roundIndex]?.question) {
        sseWrite(res, 'done', {
          question: rounds[roundIndex].question,
          agentName: rounds[roundIndex].agentName,
          agentRole: rounds[roundIndex].agentRole,
          briefFeedback: rounds[roundIndex].briefFeedback || '',
          roundIndex,
        });
        return res.end();
      }
      const expectedAgent = agentIdForRound(selectedAgents, roundIndex);
      const reqAgent = req.body?.agentId ? String(req.body.agentId) : expectedAgent;
      if (reqAgent !== expectedAgent) {
        sseWrite(res, 'error', { message: '角色顺序不正确' });
        return res.end();
      }
      const personaMap = await loadPersonaMap(ctx.pool, ctx.team.id);
      const agentMeta = resolveAgentMeta(expectedAgent, personaMap);
      const { rows: analysisRows } = await ctx.pool.query(
        `SELECT result FROM teacher_personal_class_team_market_analysis WHERE team_id = $1`,
        [ctx.team.id]
      );
      const analysisSummary = analysisSummaryText(analysisRows[0]?.result);
      const projectInfo = session.project_info || {};
      const userMsg = buildChallengeQuestionUserPrompt({
        projectInfo,
        analysisSummary,
        agentMeta,
        roundIndex,
        totalRounds,
        history: rounds,
      });
      const provider = await getEnabledProvider('multimodal');
      if (!provider) {
        sseWrite(res, 'error', { message: '未配置已启用的 LLM 服务' });
        return res.end();
      }
      logPromptToConsole(provider, CHALLENGE_QUESTION_SYSTEM_PROMPT, userMsg);
      sseWrite(res, 'status', { message: '思考中…' });
      const streamHandler = createMarketResearchStreamHandler(res, { emitSse: false });
      let fullText = '';
      try {
        fullText = await chatCompletionStream({
          provider,
          system: CHALLENGE_QUESTION_SYSTEM_PROMPT,
          user: userMsg,
          onEvent: streamHandler.onEvent,
          jsonMode: true,
          temperature: 0.2,
          maxTokens: 512,
          streamReasoning: false,
        });
      } catch (e) {
        sseWrite(res, 'error', { message: friendlyLlmErrorMessage(e) });
        return res.end();
      }
      const parseSource = streamHandler.getParseText(fullText);
      const parsed = extractJsonFromLlmText(parseSource);
      const q = normalizeChallengeQuestion(parsed, parseSource);
      const roundEntry = {
        agentId: expectedAgent,
        agentName: agentMeta.name,
        agentRole: agentMeta.role,
        question: q.question,
        briefFeedback: q.briefFeedback,
        answer: '',
      };
      if (rounds.length > roundIndex) rounds[roundIndex] = roundEntry;
      else rounds.push(roundEntry);
      await ctx.pool.query(
        `UPDATE teacher_personal_class_team_market_challenge_sessions SET rounds = $1 WHERE id = $2`,
        [JSON.stringify(rounds), sessionId]
      );
      sseWrite(res, 'done', {
        question: q.question,
        agentName: agentMeta.name,
        agentRole: agentMeta.role,
        briefFeedback: q.briefFeedback,
        roundIndex,
      });
      res.end();
    } catch (e) {
      logError(`POST challenge round stream traceId=${req.traceId}`, e);
      sseWrite(res, 'error', { message: e.message || '生成失败' });
      res.end();
    }
  }
);

router.post(
  '/student/personal-classes/:classId/market-research/challenge/sessions/:sessionId/final-report/stream',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    setupSseResponse(res);
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return res.end();
      const sessionId = parseId(req.params.sessionId);
      const lastAnswer = req.body?.answer != null ? String(req.body.answer).trim() : '';
      if (!sessionId) {
        sseWrite(res, 'error', { message: '参数无效' });
        return res.end();
      }
      const session = await getSessionForTeam(ctx.pool, sessionId, ctx.team.id);
      if (!session) {
        sseWrite(res, 'error', { message: '会话不存在' });
        return res.end();
      }
      if (String(session.student_id) !== String(ctx.sid)) {
        sseWrite(res, 'error', { message: '无权操作该会话' });
        return res.end();
      }
      let rounds = Array.isArray(session.rounds) ? [...session.rounds] : [];
      const selectedAgents = Array.isArray(session.selected_agents) ? session.selected_agents : [];
      const totalRounds = totalChallengeRounds(selectedAgents.length);
      if (rounds.length < totalRounds) {
        sseWrite(res, 'error', { message: '尚未完成全部问答' });
        return res.end();
      }
      if (!lastAnswer) {
        sseWrite(res, 'error', { message: '请提交最后一轮回答' });
        return res.end();
      }
      const lastIdx = totalRounds - 1;
      rounds[lastIdx] = { ...rounds[lastIdx], answer: lastAnswer };
      const { rows: analysisRows } = await ctx.pool.query(
        `SELECT result FROM teacher_personal_class_team_market_analysis WHERE team_id = $1`,
        [ctx.team.id]
      );
      const analysisSummary = analysisSummaryText(analysisRows[0]?.result);
      const userMsg = buildChallengeFinalUserPrompt({
        projectInfo: session.project_info || {},
        analysisSummary,
        rounds,
      });
      const provider = await getEnabledProvider('multimodal');
      if (!provider) {
        sseWrite(res, 'error', { message: '未配置已启用的 LLM 服务' });
        return res.end();
      }
      logPromptToConsole(provider, CHALLENGE_FINAL_REPORT_SYSTEM_PROMPT, userMsg);
      sseWrite(res, 'status', { message: '思考中…' });
      const streamHandler = createMarketResearchStreamHandler(res, { emitSse: false });
      let fullText = '';
      try {
        fullText = await chatCompletionStream({
          provider,
          system: CHALLENGE_FINAL_REPORT_SYSTEM_PROMPT,
          user: userMsg,
          onEvent: streamHandler.onEvent,
          jsonMode: true,
          temperature: 0.2,
          maxTokens: 1024,
          streamReasoning: false,
        });
      } catch (e) {
        sseWrite(res, 'error', { message: friendlyLlmErrorMessage(e) });
        return res.end();
      }
      const parsed = extractJsonFromLlmText(streamHandler.getParseText(fullText));
      const norm = normalizeChallengeFinalReport(parsed);
      if (norm.error) {
        sseWrite(res, 'error', { message: norm.error });
        return res.end();
      }
      await ctx.pool.query(
        `UPDATE teacher_personal_class_team_market_challenge_sessions
         SET rounds = $1, final_report = $2, status = 'completed', completed_at = now()
         WHERE id = $3`,
        [JSON.stringify(rounds), JSON.stringify(norm.report), sessionId]
      );
      sseWrite(res, 'done', { report: norm.report });
      res.end();
    } catch (e) {
      logError(`POST challenge final stream traceId=${req.traceId}`, e);
      sseWrite(res, 'error', { message: e.message || '生成失败' });
      res.end();
    }
  }
);

router.get(
  '/student/personal-classes/:classId/market-research/challenge/participation',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      const members = ctx.members || (await loadTeamMembers(ctx.pool, ctx.team.id));
      const { rows: sessionRows } = await ctx.pool.query(
        `SELECT DISTINCT student_id FROM teacher_personal_class_team_market_challenge_sessions WHERE team_id = $1`,
        [ctx.team.id]
      );
      const hasSession = new Set(sessionRows.map((r) => String(r.student_id)));
      const missingMembers = members
        .filter((m) => !hasSession.has(String(m.id)))
        .map((m) => ({ id: String(m.id), name: m.name || '' }));
      return ok(req, res, {
        members: members.map((m) => ({
          id: String(m.id),
          name: m.name || '',
          hasChallengeSession: hasSession.has(String(m.id)),
        })),
        missingMembers,
      });
    } catch (e) {
      logError(`GET challenge participation traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.get(
  '/student/personal-classes/:classId/market-research/report-upload',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      const { rows } = await ctx.pool.query(
        `SELECT uploaded_by, uploaded_at, payload
         FROM teacher_personal_class_team_market_report_uploads
         WHERE team_id = $1`,
        [ctx.team.id]
      );
      if (!rows.length) {
        return ok(req, res, { uploaded: false, uploadedAt: '', uploadedBy: '', payload: null });
      }
      const r = rows[0];
      return ok(req, res, {
        uploaded: true,
        uploadedAt: r.uploaded_at ? new Date(r.uploaded_at).toISOString() : '',
        uploadedBy: String(r.uploaded_by || ''),
        payload: r.payload || null,
      });
    } catch (e) {
      logError(`GET market-research report-upload traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.post(
  '/student/personal-classes/:classId/market-research/report-upload',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireTeamContext(req, res);
      if (!ctx) return;
      if (!ctx.isTeamLeader) return bad(req, res, 403, 40304, '仅队长可上传调研报告');

      const members = ctx.members || (await loadTeamMembers(ctx.pool, ctx.team.id));
      const { rows: sessionRows } = await ctx.pool.query(
        `SELECT DISTINCT student_id FROM teacher_personal_class_team_market_challenge_sessions WHERE team_id = $1`,
        [ctx.team.id]
      );
      const hasSession = new Set(sessionRows.map((r) => String(r.student_id)));
      const missingMembers = members.filter((m) => !hasSession.has(String(m.id)));
      if (missingMembers.length) {
        const names = missingMembers.map((m) => m.name || m.id).join('、');
        return res.status(400).json({
          code: 40006,
          message: `小组成员${names}还未完成对抗优化分析，请先通知成员完成对抗优化分析吧`,
          data: { missingMembers },
          traceId: req.traceId,
        });
      }

      const rawSurveyIds = Array.isArray(req.body?.surveyIds)
        ? req.body.surveyIds.map(parseId).filter(Boolean)
        : [];
      if (!rawSurveyIds.length) {
        return bad(req, res, 400, 40004, '请至少选择 1 份问卷');
      }
      const { rows: surveyRows } = await ctx.pool.query(
        `SELECT id FROM teacher_personal_class_team_surveys
         WHERE team_id = $1 AND id = ANY($2::bigint[])`,
        [ctx.team.id, rawSurveyIds]
      );
      if (surveyRows.length !== rawSurveyIds.length) {
        return bad(req, res, 400, 40004, '所选问卷不存在或不属于本组');
      }

      const { rows: analysisRows } = await ctx.pool.query(
        `SELECT result, generated_at FROM teacher_personal_class_team_market_analysis WHERE team_id = $1`,
        [ctx.team.id]
      );
      if (!analysisRows.length || !analysisRows[0].result) {
        return bad(req, res, 400, 40004, '请先生成调研报告');
      }

      const { rows: personaRows } = await ctx.pool.query(
        `SELECT id FROM teacher_personal_class_team_market_personas WHERE team_id = $1`,
        [ctx.team.id]
      );

      const payload = {
        surveyIds: rawSurveyIds.map(String),
        personaIds: personaRows.map((r) => String(r.id)),
        analysisResult: analysisRows[0].result,
        analysisGeneratedAt: analysisRows[0].generated_at
          ? new Date(analysisRows[0].generated_at).toISOString()
          : '',
      };

      await ctx.pool.query(
        `INSERT INTO teacher_personal_class_team_market_report_uploads (team_id, uploaded_by, payload)
         VALUES ($1, $2, $3)
         ON CONFLICT (team_id) DO UPDATE SET
           uploaded_by = EXCLUDED.uploaded_by,
           uploaded_at = now(),
           payload = EXCLUDED.payload`,
        [ctx.team.id, ctx.sid, JSON.stringify(payload)]
      );

      return ok(req, res, { uploaded: true });
    } catch (e) {
      logError(`POST market-research report-upload traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

export default router;
