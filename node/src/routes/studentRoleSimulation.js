import { Router } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPool } from '../lib/db.js';
import { logError } from '../lib/logError.js';
import { requireAuth, requireStudent } from '../middleware/auth.js';
import { chatCompletionStream, friendlyLlmErrorMessage, getEnabledProvider } from '../lib/llmGateway.js';
import {
  ROLE_SIMULATION_SYSTEM_PROMPT,
  buildRoleSimulationUserPrompt,
  extractJsonObjectsFromBuffer,
  normalizeSimulationDays,
  rollSimulationScenario,
} from '../lib/roleSimulationPrompts.js';
import { assembleBusinessModelAiBundle } from '../lib/businessModelContext.js';
import {
  loadMarketAnalysisTextForPrompt,
  loadMarketPersonasTextForPrompt,
} from '../lib/marketResearchContext.js';
import { evaluateModulePrerequisiteForStudent } from '../lib/trainingModulePrerequisite.js';

const router = Router();
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
  return { id: Number(rows[0].id), name: rows[0].name || '' };
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
    bad(req, res, 400, 40014, '教师确认组队后可使用 AI 仿真模拟');
    return null;
  }
  const members = await loadTeamMembers(pool, team.id);
  return { sid, classId, team, members, pool };
}

async function loadPrerequisiteKnowledgePointIds(pool, moduleKey) {
  const { rows } = await pool.query(
    `WITH published_leaves AS (
       SELECT id
       FROM course_resource_nodes
       WHERE module_key = $1 AND level = 3 AND status = 'published'
     )
     SELECT DISTINCT l.knowledge_point_id AS "knowledgePointId"
     FROM course_resource_node_knowledge_points l
     JOIN published_leaves n ON n.id = l.node_id
     ORDER BY l.knowledge_point_id ASC`,
    [moduleKey]
  );
  return rows.map((r) => Number(r.knowledgePointId)).filter((v) => Number.isFinite(v) && v > 0);
}

async function countPassedKnowledgePoints(pool, studentId, knowledgePointIds) {
  if (!knowledgePointIds.length) return 0;
  const { rows } = await pool.query(
    `SELECT COUNT(DISTINCT q.knowledge_point_id)::int AS c
     FROM quiz_attempts a
     JOIN quizzes q ON q.id = a.quiz_id
     WHERE a.user_id = $1
       AND a.passed = true
       AND q.knowledge_point_id = ANY($2::bigint[])`,
    [studentId, knowledgePointIds]
  );
  return Number(rows[0]?.c || 0);
}

function sseWrite(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
  // 尽量立刻刷到客户端，避免被代理/压缩缓冲导致「不流式」
  if (typeof res.flush === 'function') res.flush();
}

function truncateMiddle(s, max) {
  const t = String(s || '').trim();
  if (t.length <= max) return t;
  const head = Math.floor(max * 0.6);
  const tail = Math.floor(max * 0.3);
  return `${t.slice(0, head)}\n…\n${t.slice(t.length - tail)}（前文已省略）`;
}

async function loadBusinessModelWorkspaceText(pool, teamId) {
  const { rows } = await pool.query(
    `SELECT swot_json, marketing_json, finance_json, bmc_canvas_json
     FROM teacher_personal_class_team_business_model_workspace
     WHERE team_id = $1`,
    [teamId]
  );
  const row = rows[0];
  if (!row) return '';
  const swot = row.swot_json || {};
  const marketing = row.marketing_json || {};
  const finance = row.finance_json || {};
  const bmc = row.bmc_canvas_json || {};
  const text = [
    'SWOT：',
    JSON.stringify(swot, null, 2),
    '\n营销4P：',
    JSON.stringify(marketing, null, 2),
    '\n财务（成本/收入项）：',
    JSON.stringify(finance, null, 2),
    '\n商业画布（BMC）：',
    JSON.stringify(bmc, null, 2),
  ].join('\n');
  return truncateMiddle(text, 8000);
}

async function createRunRecord(ctx, { businessModel, config }) {
  const client = await ctx.pool.connect();
  try {
    await client.query('BEGIN');
    // 避免并发产生相同 run_index：对 team+student 做事务级 advisory lock
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`role-sim:${ctx.team.id}:${ctx.sid}`]);
    const { rows: mx } = await client.query(
      `SELECT COALESCE(MAX(run_index), 0)::int AS m
       FROM teacher_personal_class_team_role_simulation_run_records
       WHERE teacher_personal_class_id = $1 AND team_id = $2 AND student_id = $3`,
      [ctx.classId, ctx.team.id, ctx.sid]
    );
    const runIndex = Number(mx[0]?.m || 0) + 1;
    const { rows: ins } = await client.query(
      `INSERT INTO teacher_personal_class_team_role_simulation_run_records
        (teacher_personal_class_id, team_id, student_id, run_index, config_json, tracking_json, optimize_json, thinking_log_json)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb)
       RETURNING id, created_at`,
      [
        ctx.classId,
        ctx.team.id,
        ctx.sid,
        runIndex,
        JSON.stringify({ businessModel, ...(config || {}) }),
        JSON.stringify({ days: [], users: 0, revenue: 0, cac: 0, ltv: 0 }),
        JSON.stringify({}),
        JSON.stringify([]),
      ]
    );
    await client.query('COMMIT');
    return {
      runId: String(ins[0].id),
      runIndex,
      createdAt: ins[0].created_at ? new Date(ins[0].created_at).toISOString() : '',
    };
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    client.release();
  }
}

async function updateRunTracking(ctx, runId, tracking, thinkingLines) {
  await ctx.pool.query(
    `UPDATE teacher_personal_class_team_role_simulation_run_records
     SET tracking_json = $2::jsonb,
         thinking_log_json = $3::jsonb
     WHERE id = $1`,
    [runId, JSON.stringify(tracking || {}), JSON.stringify(thinkingLines || [])]
  );
}

async function updateRunFinalize(ctx, runId, tracking, optimize, thinkingLines) {
  await ctx.pool.query(
    `UPDATE teacher_personal_class_team_role_simulation_run_records
     SET tracking_json = $2::jsonb,
         optimize_json = $3::jsonb,
         thinking_log_json = $4::jsonb
     WHERE id = $1`,
    [runId, JSON.stringify(tracking || {}), JSON.stringify(optimize || {}), JSON.stringify(thinkingLines || [])]
  );
}

router.get('/student/personal-classes/:classId/role-simulation/entry', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const ctx = await requireTeamContext(req, res);
    if (!ctx) return;

    const prerequisiteModuleKey = 'simulation';
    const result = await evaluateModulePrerequisiteForStudent(ctx.pool, ctx.sid, prerequisiteModuleKey);

    return ok(req, res, {
      allowed: result.allowed,
      prerequisiteModuleKey,
      requiredKnowledgePointCount: result.requiredKnowledgePointCount,
      passedKnowledgePointCount: result.passedKnowledgePointCount,
      summary: result.summary,
    });
  } catch (e) {
    logError(`GET role-simulation entry traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.post('/student/personal-classes/:classId/role-simulation/simulate/stream', requireAuth(), requireStudent(), async (req, res) => {
  const ctx = await requireTeamContext(req, res);
  if (!ctx) return;

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');

  try {
    const prerequisiteModuleKey = 'simulation';
    const prereq = await evaluateModulePrerequisiteForStudent(ctx.pool, ctx.sid, prerequisiteModuleKey);
    if (!prereq.allowed) {
      sseWrite(res, 'error', {
        message: prereq.summary || '请先完成本环节实践课程学习及知识点检测后再开始仿真模拟。',
      });
      return res.end();
    }

    const provider = await getEnabledProvider('multimodal');
    if (!provider) {
      sseWrite(res, 'error', { message: '未配置已启用的多模态模型' });
      return res.end();
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const reqRunId = parseId(body.runId);
    let businessModel = String(body.businessModel || '').trim();
    let config = body.config && typeof body.config === 'object' ? body.config : {};
    const prevRunId = parseId(body.prevRunId);
    let prevSummary = '';
    if (prevRunId) {
      const { rows } = await ctx.pool.query(
        `SELECT tracking_json
         FROM teacher_personal_class_team_role_simulation_run_records
         WHERE id = $1 AND team_id = $2`,
        [prevRunId, ctx.team.id]
      );
      if (rows[0]?.tracking_json) {
        const t = rows[0].tracking_json;
        prevSummary = JSON.stringify({ users: t?.users, revenue: t?.revenue, day30: t?.days?.[29] || null }).slice(0, 2000);
      }
    }

    // 新开模拟：开始即落库；接力续跑：复用已有 runId，不产生新轮次
    let created = null;
    let existingDays = [];
    let resumeFromDay = 0;
    if (reqRunId) {
      const { rows } = await ctx.pool.query(
        `SELECT id, run_index, created_at, config_json, tracking_json
         FROM teacher_personal_class_team_role_simulation_run_records
         WHERE id = $1 AND teacher_personal_class_id = $2 AND team_id = $3 AND student_id = $4`,
        [reqRunId, ctx.classId, ctx.team.id, ctx.sid]
      );
      const row = rows[0];
      if (!row) {
        sseWrite(res, 'error', { message: '接力失败：记录不存在或无权限' });
        return res.end();
      }
      const cfg = row.config_json && typeof row.config_json === 'object' ? row.config_json : {};
      businessModel = String(cfg.businessModel || businessModel || '').trim();
      config = cfg && typeof cfg === 'object' ? cfg : config;
      const tracking = row.tracking_json && typeof row.tracking_json === 'object' ? row.tracking_json : {};
      existingDays = Array.isArray(tracking.days) ? tracking.days : [];
      resumeFromDay = Math.max(0, ...existingDays.map((d) => Number(d?.day || 0)));
      created = {
        runId: String(row.id),
        runIndex: Number(row.run_index || 0),
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : '',
      };
    } else {
      created = await createRunRecord(ctx, { businessModel, config });
    }

    sseWrite(res, 'start', { runId: created.runId, runIndex: created.runIndex, createdAt: created.createdAt });

    const days = [...existingDays].filter((d) => d && typeof d === 'object');
    let finalOptimize = null;
    const thinkingLines = [];
    let jsonBuffer = '';
    const seenDayNos = new Set(days.map((d) => Number(d?.day || 0)).filter((n) => n > 0));
    const bundle = await assembleBusinessModelAiBundle(ctx.pool, ctx.team.id, UPLOAD_ROOT);
    const [analysisText, personasText] = await Promise.all([
      loadMarketAnalysisTextForPrompt(ctx.pool, ctx.team.id, 8000),
      loadMarketPersonasTextForPrompt(ctx.pool, ctx.team.id, 9000),
    ]);
    const contextText = [bundle, analysisText, personasText].filter(Boolean).join('\n\n');
    const businessModelWorkspaceText = await loadBusinessModelWorkspaceText(ctx.pool, ctx.team.id);

    const applyParsedObject = (j, { emit = true } = {}) => {
      if (!j || typeof j !== 'object') return;
      if (j.type === 'day' && Number.isFinite(Number(j.day))) {
        const dayNo = Number(j.day);
        if (resumeFromDay > 0 && dayNo <= resumeFromDay) return;
        const existingIdx = days.findIndex((x) => Number(x?.day || 0) === dayNo);
        if (existingIdx >= 0) days[existingIdx] = j;
        else days.push(j);
        const isNew = !seenDayNos.has(dayNo);
        seenDayNos.add(dayNo);
        if (emit && isNew) {
          sseWrite(res, 'day_result', j);
          const tracking = {
            days,
            users: j?.users ?? 0,
            revenue: j?.revenue ?? 0,
            cac: j?.cac ?? 0,
            ltv: j?.ltv ?? 0,
          };
          void updateRunTracking(ctx, created.runId, tracking, thinkingLines).catch(() => {});
        }
        return;
      }
      if (j.type === 'final') {
        finalOptimize = j?.optimize || null;
        if (emit && finalOptimize) sseWrite(res, 'final_snapshot', { optimize: finalOptimize });
      }
    };

    // 每轮抽样主基调，避免模型默认「一路上涨」；温度略提高以增加轨迹多样性
    const scenario = rollSimulationScenario();
    const mergedText = await chatCompletionStream({
      provider,
      system: ROLE_SIMULATION_SYSTEM_PROMPT,
      user: buildRoleSimulationUserPrompt({
        businessModel,
        config,
        prevSummary,
        contextText,
        businessModelWorkspaceText,
        resumeFromDay,
        scenario,
      }),
      temperature: 0.75,
      onEvent: (ev) => {
        if (!ev?.text) return;
        if (ev.kind === 'thinking') {
          const text = String(ev.text);
          const parts = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
          for (const p of parts) {
            thinkingLines.push(p);
            if (thinkingLines.length > 5) thinkingLines.shift();
            sseWrite(res, 'thinking_delta', { line: p, lines: thinkingLines });
          }
          return;
        }
        if (ev.kind === 'content') {
          // 兼容「单行 NDJSON」与「多行美化 JSON」两种模型输出
          jsonBuffer += String(ev.text);
          const { objects, rest } = extractJsonObjectsFromBuffer(jsonBuffer);
          jsonBuffer = rest;
          for (const j of objects) applyParsedObject(j, { emit: true });
        }
      },
    });

    // 冲刷缓冲 + 若流式阶段一个 day 都没解析到，再从全文兜底解析并补推
    if (jsonBuffer.trim()) {
      const { objects, rest } = extractJsonObjectsFromBuffer(jsonBuffer);
      jsonBuffer = rest;
      for (const j of objects) applyParsedObject(j, { emit: true });
    }
    if (days.length <= existingDays.length && mergedText) {
      const { objects } = extractJsonObjectsFromBuffer(String(mergedText));
      for (const j of objects) applyParsedObject(j, { emit: true });
    }

    // 落库前整形：去锯齿、补平台期；summary.revenue 用累计营收末日值
    const normalizedDays = normalizeSimulationDays(days, {
      price: Number(config?.price || 0),
      tone: scenario.tone,
    });
    days.length = 0;
    days.push(...normalizedDays);
    const lastDay = normalizedDays[normalizedDays.length - 1] || null;
    const tracking = {
      days: normalizedDays,
      users: lastDay?.users ?? 0,
      revenue: lastDay?.revenue ?? 0,
      cac: lastDay?.cac ?? 0,
      ltv: lastDay?.ltv ?? 0,
      raw: mergedText ? String(mergedText).slice(0, 20000) : '',
    };

    await updateRunFinalize(ctx, created.runId, tracking, finalOptimize || {}, thinkingLines);

    try {
      const { scheduleScoreTeamStage } = await import('../lib/teamCockpitScoring.js');
      const { insertTeamAiInteractionLog } = await import('../lib/teamAiInteractionLog.js');
      await insertTeamAiInteractionLog({
        classId: ctx.classId,
        teamId: ctx.team.id,
        studentId: ctx.sid,
        moduleKey: 'simulation',
        scene: 'simulation_run',
        role: 'event',
        content: `完成仿真运行 #${created.runIndex}`,
        meta: { runId: created.runId, runIndex: created.runIndex },
      });
      scheduleScoreTeamStage(ctx.classId, ctx.team.id, 'simulation');
    } catch (hookErr) {
      logError('role-simulation cockpit hook', hookErr);
    }

    sseWrite(res, 'done', {
      runId: created.runId,
      runIndex: created.runIndex,
      createdAt: created.createdAt,
      tracking,
      optimize: finalOptimize || {},
    });
    return res.end();
  } catch (e) {
    logError(`POST role-simulation simulate/stream traceId=${req.traceId}`, e);
    sseWrite(res, 'error', { message: friendlyLlmErrorMessage(e) });
    return res.end();
  }
});

router.get('/student/personal-classes/:classId/role-simulation/records', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const ctx = await requireTeamContext(req, res);
    if (!ctx) return;
    const { rows } = await ctx.pool.query(
      `SELECT r.id, r.student_id, r.run_index, r.created_at, r.tracking_json,
              COALESCE(u.real_name, u.username) AS name
       FROM teacher_personal_class_team_role_simulation_run_records r
       JOIN users u ON u.id = r.student_id
       WHERE r.teacher_personal_class_id = $1 AND r.team_id = $2
       ORDER BY r.created_at DESC, r.id DESC`,
      [ctx.classId, ctx.team.id]
    );

    const byStudent = new Map();
    for (const m of ctx.members) byStudent.set(m.id, { studentId: m.id, studentName: m.name, records: [] });
    for (const row of rows) {
      const sid = String(row.student_id);
      const bucket = byStudent.get(sid) || { studentId: sid, studentName: row.name || '同学', records: [] };
      const tracking = row.tracking_json || {};
      bucket.records.push({
        id: String(row.id),
        runIndex: Number(row.run_index || 0),
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : '',
        summary: {
          users: Number(tracking?.users || 0),
          revenue: Number(tracking?.revenue || 0),
          cac: Number(tracking?.cac || 0),
          ltv: Number(tracking?.ltv || 0),
        },
      });
      byStudent.set(sid, bucket);
    }

    // 进度：有效轮次 = 已完成模拟次数（max run_index）；全员 ≥ 3 轮即达标
    const progress = [];
    let allQualified = true;
    for (const bucket of byStudent.values()) {
      const maxRun = bucket.records.reduce((mx, r) => Math.max(mx, Number(r.runIndex || 0)), 0);
      const effective = Math.max(0, maxRun);
      const qualified = effective >= 3;
      if (!qualified) allQualified = false;
      progress.push({
        studentId: bucket.studentId,
        studentName: bucket.studentName,
        runCount: maxRun,
        effectiveRounds: effective,
        qualified,
      });
    }

    return ok(req, res, { members: Array.from(byStudent.values()), progress, teamQualified: allQualified });
  } catch (e) {
    logError(`GET role-simulation records traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.get('/student/personal-classes/:classId/role-simulation/records/:studentId', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const ctx = await requireTeamContext(req, res);
    if (!ctx) return;
    const targetId = parseId(req.params.studentId);
    if (!targetId) return bad(req, res, 400, 40003, '参数无效');
    if (!ctx.members.some((m) => String(m.id) === String(targetId))) {
      return bad(req, res, 403, 40302, '无权查看该成员记录');
    }
    const { rows } = await ctx.pool.query(
      `SELECT id, run_index, created_at, config_json, tracking_json, optimize_json
       FROM teacher_personal_class_team_role_simulation_run_records
       WHERE teacher_personal_class_id = $1 AND team_id = $2 AND student_id = $3
       ORDER BY created_at DESC, id DESC`,
      [ctx.classId, ctx.team.id, targetId]
    );
    const records = rows.map((r) => ({
      id: String(r.id),
      runIndex: Number(r.run_index || 0),
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : '',
      config: r.config_json || {},
      tracking: r.tracking_json || {},
      optimize: r.optimize_json || {},
    }));
    if (!records.length) return bad(req, res, 404, 40404, '暂无记录');
    return ok(req, res, { studentId: String(targetId), records });
  } catch (e) {
    logError(`GET role-simulation member records traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

export default router;

