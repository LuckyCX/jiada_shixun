import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getPool } from '../lib/db.js';
import { logError } from '../lib/logError.js';
import { requireAuth, requireTeacher } from '../middleware/auth.js';
import { coerceSections, sectionsToFullText } from '../lib/businessPlanSections.js';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRODUCT_PROTOTYPE_UPLOAD_ROOT = path.join(__dirname, '../../uploads/team-product-prototype');
const BUSINESS_PLAN_UPLOAD_ROOT = path.join(__dirname, '../../uploads/business-plan-submissions');

function ok(req, res, data, message = 'OK') {
  return res.json({ code: 0, message, data, traceId: req.traceId });
}

function bad(req, res, status, code, message) {
  return res.status(status).json({ code, message, data: null, traceId: req.traceId });
}

function parseId(val) {
  const id = Number(String(val || '').trim());
  return Number.isFinite(id) && id > 0 ? id : null;
}

function teacherIdFromReq(req) {
  return parseId(req.user?.sub);
}

async function ownsPersonalClass(pool, teacherId, classId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM teacher_personal_classes WHERE id = $1 AND teacher_id = $2`,
    [classId, teacherId]
  );
  return rows.length > 0;
}

function fmtZh(val) {
  if (!val) return '';
  const d = val instanceof Date ? val : new Date(val);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('zh-CN');
}

function dayLabelZh(d) {
  const w = d.getDay(); // 0 Sun
  return w === 0 ? '周日' : w === 1 ? '周一' : w === 2 ? '周二' : w === 3 ? '周三' : w === 4 ? '周四' : w === 5 ? '周五' : '周六';
}

function clampPct(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, Math.round(x)));
}

function stageLabelByKey(k) {
  switch (k) {
    case 'teamFormation':
      return '组队';
    case 'ideation':
      return '创新思维';
    case 'marketResearch':
      return '市场调研';
    case 'productDesign':
      return '产品设计';
    case 'businessModel':
      return '商业模式';
    case 'roleSimulation':
      return '角色推荐';
    case 'businessPlan':
      return '商业计划';
    default:
      return '';
  }
}

function moduleKeyForStage(stageKey) {
  if (stageKey === 'ideation') return 'ideation';
  if (stageKey === 'marketResearch') return 'market';
  if (stageKey === 'productDesign') return 'product';
  if (stageKey === 'businessModel') return 'business';
  if (stageKey === 'roleSimulation') return 'simulation';
  if (stageKey === 'businessPlan') return 'plan';
  return null;
}

function computeOverallProgress(stageProgress) {
  const keys = [
    'teamFormation',
    'ideation',
    'marketResearch',
    'productDesign',
    'businessModel',
    'roleSimulation',
    'businessPlan',
  ];
  const sum = keys.reduce((s, k) => s + clampPct(stageProgress?.[k] ?? 0), 0);
  return keys.length ? Math.round(sum / keys.length) : 0;
}

function currentStageFromStageProgress(stageProgress) {
  const keys = [
    'teamFormation',
    'ideation',
    'marketResearch',
    'productDesign',
    'businessModel',
    'roleSimulation',
    'businessPlan',
  ];
  if (keys.every((k) => clampPct(stageProgress?.[k] ?? 0) >= 100)) return '已完成';
  for (const k of keys) {
    const v = clampPct(stageProgress?.[k] ?? 0);
    if (v > 0 && v < 100) return stageLabelByKey(k);
  }
  for (let i = keys.length - 1; i >= 0; i--) {
    const k = keys[i];
    const v = clampPct(stageProgress?.[k] ?? 0);
    if (v >= 100) {
      const next = keys[i + 1];
      return next ? stageLabelByKey(next) : stageLabelByKey(k);
    }
  }
  return '组队';
}

function localDateKey(d) {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function loadTeamsForClass(pool, classId) {
  const { rows: teams } = await pool.query(
    `SELECT t.id, t.name, t.grouping_status, t.sort_order,
            COALESCE(leader.real_name, leader.username, '') AS leader_name
     FROM teacher_personal_class_teams t
     LEFT JOIN users leader ON leader.id = COALESCE(
       t.leader_student_id,
       (
         SELECT m.student_id
         FROM teacher_personal_class_team_members m
         WHERE m.team_id = t.id
         ORDER BY CASE WHEN m.ai_matched_role = 'CEO' THEN 0 ELSE 1 END, m.id ASC
         LIMIT 1
       )
     )
     WHERE t.teacher_personal_class_id = $1 AND t.grouping_status IN ('draft', 'confirmed')
     ORDER BY t.sort_order ASC, t.id ASC`,
    [classId]
  );
  if (!teams.length) return [];
  const teamIds = teams.map((t) => t.id);
  const { rows: members } = await pool.query(
    `SELECT m.team_id, u.id AS student_id, COALESCE(u.real_name, u.username, '') AS name
     FROM teacher_personal_class_team_members m
     JOIN users u ON u.id = m.student_id
     WHERE m.team_id = ANY($1::bigint[])
     ORDER BY m.team_id ASC, u.id ASC`,
    [teamIds]
  );
  const byTeam = new Map(teamIds.map((id) => [String(id), []]));
  for (const r of members) {
    byTeam.get(String(r.team_id))?.push({ id: String(r.student_id), name: r.name || '' });
  }
  return teams.map((t) => ({
    id: String(t.id),
    teamName: t.name || '',
    leader: t.leader_name || '',
    groupingStatus: t.grouping_status,
    sortOrder: Number(t.sort_order || 0),
    members: byTeam.get(String(t.id)) || [],
  }));
}

async function stageProgressForTeam(pool, classId, teamId, memberIds) {
  const stageProgress = {
    teamFormation: 0,
    ideation: 0,
    marketResearch: 0,
    productDesign: 0,
    businessModel: 0,
    aiValidation: 0,
    roleSimulation: 0,
    businessPlan: 0,
  };

  stageProgress.teamFormation = memberIds.length ? 100 : 0;

  // 关键产出为准：没产出就没进度（避免“课程/知识点未配置时 required=0 => 100%”的假象）
  const [
    { rowCount: topicCount },
    { rowCount: marketReportCount },
    { rowCount: prototypeCount },
    { rowCount: planCount },
    { rows: bmWsRows },
    { rows: warRoomRows },
    { rows: simRunRows },
  ] = await Promise.all([
    pool.query(
      `SELECT 1 FROM teacher_personal_class_team_project_topics WHERE team_id = $1 LIMIT 1`,
      [teamId]
    ),
    pool.query(
      `SELECT 1 FROM teacher_personal_class_team_market_report_uploads WHERE team_id = $1 LIMIT 1`,
      [teamId]
    ),
    pool.query(
      `SELECT 1 FROM teacher_personal_class_team_product_prototype_uploads WHERE team_id = $1 LIMIT 1`,
      [teamId]
    ),
    pool.query(
      `SELECT 1 FROM teacher_personal_class_team_business_plan_submissions WHERE teacher_personal_class_id = $1 AND team_id = $2 LIMIT 1`,
      [classId, teamId]
    ),
    pool.query(
      `SELECT swot_saved_at, marketing_saved_at, finance_saved_at, bmc_canvas_saved_at
       FROM teacher_personal_class_team_business_model_workspace
       WHERE team_id = $1
       LIMIT 1`,
      [teamId]
    ),
    pool.query(
      `SELECT canvas_json
       FROM teacher_personal_class_team_war_room_saved_record
       WHERE team_id = $1`,
      [teamId]
    ),
    pool.query(
      `SELECT student_id, MAX(run_index)::int AS max_run
       FROM teacher_personal_class_team_role_simulation_run_records
       WHERE teacher_personal_class_id = $1 AND team_id = $2
       GROUP BY student_id`,
      [classId, teamId]
    ),
  ]);

  stageProgress.ideation = topicCount ? 100 : 0;
  stageProgress.marketResearch = marketReportCount ? 100 : 0;
  stageProgress.productDesign = prototypeCount ? 100 : 0;
  stageProgress.businessPlan = planCount ? 100 : 0;

  // 商业模式：对齐学生端完成判定（SWOT/营销/财务/战情室/BMC 共 5 个子项）
  const bm = bmWsRows?.[0] || null;
  const bmDone =
    (bm?.swot_saved_at ? 1 : 0) +
    (bm?.marketing_saved_at ? 1 : 0) +
    (bm?.finance_saved_at ? 1 : 0) +
    (bm?.bmc_canvas_saved_at ? 1 : 0) +
    (() => {
      // 战情室：任一成员保存的画布填充 >= 9 视为完成
      let maxFilled = 0;
      for (const r of warRoomRows || []) {
        const canvas = r?.canvas_json && typeof r.canvas_json === 'object' ? r.canvas_json : {};
        const filled = Object.values(canvas).filter(
          (v) => v && typeof v === 'object' && String(v.content || '').trim()
        ).length;
        if (filled > maxFilled) maxFilled = filled;
      }
      return maxFilled >= 9 ? 1 : 0;
    })();
  stageProgress.businessModel = bmDone >= 5 ? 100 : 0;

  // 角色推荐：对齐学生端 teamQualified（全员有效轮次 >= 3）
  const byStudent = new Map((simRunRows || []).map((r) => [String(r.student_id), Number(r.max_run || 0)]));
  let simAllQualified = memberIds.length > 0;
  for (const sid of memberIds) {
    const maxRun = byStudent.get(String(sid)) || 0;
    const effective = Math.max(0, maxRun - 1);
    if (effective < 3) {
      simAllQualified = false;
      break;
    }
  }
  stageProgress.roleSimulation = simAllQualified ? 100 : 0;

  // AI验证：以“市场调研报告已提交”为进入 AI 验证的门槛（有提交则 100，否则 0）
  stageProgress.aiValidation = marketReportCount ? 100 : 0;

  return stageProgress;
}

async function warningsForTeam(pool, teamId, stageProgress) {
  const warnings = [];
  const now = Date.now();
  const prog = clampPct(computeOverallProgress(stageProgress));
  if (prog < 20) warnings.push('整体进度偏低');
  // 预警应跟随“当前应推进阶段”，避免阶段未开始却提示后续阶段
  const warnKeys = ['ideation', 'marketResearch', 'productDesign', 'businessModel', 'roleSimulation', 'businessPlan'];
  const nextKey = warnKeys.find((k) => clampPct(stageProgress?.[k] ?? 0) < 100) || null;
  if (nextKey) {
    const nextPct = clampPct(stageProgress?.[nextKey] ?? 0);
    if (nextPct < 50) warnings.push(`${stageLabelByKey(nextKey)}环节进度偏低`);
  }

  const { rows: activeRows } = await pool.query(
    `SELECT MAX(ol.created_at) AS last_op
     FROM operation_logs ol
     WHERE ol.operator_id IN (
       SELECT student_id FROM teacher_personal_class_team_members WHERE team_id = $1
     )`,
    [teamId]
  );
  const lastOp = activeRows[0]?.last_op ? new Date(activeRows[0].last_op).getTime() : 0;
  if (lastOp && now - lastOp > 3 * 24 * 60 * 60 * 1000) warnings.push('团队近 3 天缺少操作记录');
  return warnings;
}

function statusFromTeam(stageProgress, warnings) {
  const prog = clampPct(computeOverallProgress(stageProgress));
  if (warnings.length >= 2 || prog < 20) return 'delayed';
  if (warnings.length >= 1 || prog < 50) return 'at-risk';
  return 'on-track';
}

async function countSubmissions(pool, teamId) {
  const promises = [
    pool.query(`SELECT 1 FROM teacher_personal_class_team_project_topics WHERE team_id = $1 LIMIT 1`, [teamId]),
    pool.query(`SELECT 1 FROM teacher_personal_class_team_market_report_uploads WHERE team_id = $1 LIMIT 1`, [teamId]),
    pool.query(`SELECT 1 FROM teacher_personal_class_team_product_prototype_uploads WHERE team_id = $1 LIMIT 1`, [teamId]),
    pool.query(
      `SELECT 1 FROM teacher_personal_class_team_business_plan_submissions WHERE team_id = $1 LIMIT 1`,
      [teamId]
    ),
  ];
  const [topic, market, proto, plan] = await Promise.all(promises);
  return [topic, market, proto, plan].reduce((s, r) => s + (r.rowCount ? 1 : 0), 0);
}

function attachmentDownloadUrl(classId, submissionId, attachmentId) {
  return `/api/teacher/personal-classes/${classId}/business-plan/submissions/${submissionId}/attachments/${attachmentId}/download`;
}

async function businessPlanSubmissionForTeam(pool, classId, teamId) {
  const { rows } = await pool.query(
    `SELECT s.id AS submission_id, s.status, s.submitted_at, s.review_comment, s.reviewed_at,
            v.version_no, v.summary AS version_summary, v.sections_json
     FROM teacher_personal_class_team_business_plan_submissions s
     JOIN teacher_personal_class_team_business_plan_versions v ON v.id = s.version_id
     WHERE s.teacher_personal_class_id = $1 AND s.team_id = $2
     ORDER BY s.submitted_at DESC
     LIMIT 1`,
    [classId, teamId]
  );
  const row = rows[0];
  if (!row) return null;
  const submissionId = String(row.submission_id);
  const { rows: attRows } = await pool.query(
    `SELECT id, file_name, file_size, is_ppt
     FROM teacher_personal_class_team_business_plan_submission_attachments
     WHERE submission_id = $1
     ORDER BY is_ppt DESC, sort_order ASC, id ASC`,
    [submissionId]
  );
  const sections = coerceSections(row.sections_json);
  const fullText = sectionsToFullText(sections);
  return {
    submissionId,
    status: row.status,
    submitTime: fmtZh(row.submitted_at),
    version: row.version_no ? `v${row.version_no}` : '',
    versionSummary: String(row.version_summary || ''),
    reviewComment: String(row.review_comment || ''),
    reviewedAt: fmtZh(row.reviewed_at),
    sections,
    fullText,
    attachments: attRows.map((a) => ({
      id: String(a.id),
      name: String(a.file_name || ''),
      size: Number(a.file_size || 0),
      url: attachmentDownloadUrl(classId, submissionId, String(a.id)),
      isPpt: Boolean(a.is_ppt),
    })),
  };
}

async function productPrototypeForTeam(pool, classId, teamId) {
  const { rows } = await pool.query(
    `SELECT origin_name, storage_path, uploaded_by, uploaded_at, size_bytes
     FROM teacher_personal_class_team_product_prototype_uploads
     WHERE team_id = $1`,
    [teamId]
  );
  const r = rows[0];
  if (!r) return null;
  return {
    originName: String(r.origin_name || ''),
    sizeBytes: Number(r.size_bytes || 0),
    uploadedBy: String(r.uploaded_by || ''),
    uploadedAt: fmtZh(r.uploaded_at),
    downloadUrl: `/api/teacher/personal-classes/${classId}/monitor/teams/${teamId}/product-prototype/download`,
    storagePath: String(r.storage_path || ''),
  };
}

router.get(
  '/teacher/personal-classes/:classId/monitor/teams',
  requireAuth(),
  requireTeacher(),
  async (req, res) => {
    try {
      const tid = teacherIdFromReq(req);
      const classId = parseId(req.params.classId);
      if (!tid || !classId) return bad(req, res, 400, 40003, '参数无效');
      const pool = getPool();
      if (!(await ownsPersonalClass(pool, tid, classId))) {
        return bad(req, res, 404, 40402, '班级不存在或无权操作');
      }

      const teams = await loadTeamsForClass(pool, classId);
      const out = [];
      for (const t of teams) {
        const memberIds = (t.members || []).map((m) => m.id).filter(Boolean);
        const stageProgress = await stageProgressForTeam(pool, classId, Number(t.id), memberIds);
        const warnings = await warningsForTeam(pool, Number(t.id), stageProgress);
        const status = statusFromTeam(stageProgress, warnings);
        const overallProgress = computeOverallProgress(stageProgress);
        const submissionCount = await countSubmissions(pool, Number(t.id));
        out.push({
          id: Number(t.id),
          teamName: t.teamName,
          course: '',
          members: t.members.map((m) => ({ name: m.name, avatar: '' })),
          leader: t.leader,
          currentStage: currentStageFromStageProgress(stageProgress),
          overallProgress,
          stageProgress,
          knowledgeProgress: 0,
          abilityPoints: 0,
          collaborationScore: 0,
          qualityScore: 0,
          lastActive: '',
          status,
          warnings,
          evaluationStatus: 'pending',
          iterationCount: 0,
          submissionCount,
        });
      }
      return ok(req, res, { teams: out });
    } catch (e) {
      logError(`GET teacher monitor teams traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.get(
  '/teacher/personal-classes/:classId/monitor/stats',
  requireAuth(),
  requireTeacher(),
  async (req, res) => {
    try {
      const tid = teacherIdFromReq(req);
      const classId = parseId(req.params.classId);
      if (!tid || !classId) return bad(req, res, 400, 40003, '参数无效');
      const pool = getPool();
      if (!(await ownsPersonalClass(pool, tid, classId))) {
        return bad(req, res, 404, 40402, '班级不存在或无权操作');
      }

      const now = new Date();
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - 6);

      const { rows: memberRows } = await pool.query(
        `SELECT DISTINCT m.student_id
         FROM teacher_personal_class_teams t
         JOIN teacher_personal_class_team_members m ON m.team_id = t.id
         WHERE t.teacher_personal_class_id = $1 AND t.grouping_status IN ('draft', 'confirmed')`,
        [classId]
      );
      const memberIds = memberRows.map((r) => Number(r.student_id)).filter(Boolean);

      const loginCountsByDay = new Map();
      if (memberIds.length) {
        const { rows: loginRows } = await pool.query(
          `SELECT date_trunc('day', u.last_login_at) AS day, COUNT(*)::int AS c
           FROM users u
           WHERE u.id = ANY($1::bigint[]) AND u.last_login_at >= $2
           GROUP BY day
           ORDER BY day ASC`,
          [memberIds, start]
        );
        for (const r of loginRows) {
          const key = r.day ? localDateKey(r.day) : '';
          if (key) loginCountsByDay.set(key, Number(r.c || 0));
        }
      }

      const opCountsByDay = new Map();
      if (memberIds.length) {
        const { rows: opRows } = await pool.query(
          `SELECT date_trunc('day', created_at) AS day, COUNT(*)::int AS c
           FROM operation_logs
           WHERE operator_id = ANY($1::bigint[]) AND created_at >= $2
           GROUP BY day
           ORDER BY day ASC`,
          [memberIds, start]
        );
        for (const r of opRows) {
          const key = r.day ? localDateKey(r.day) : '';
          if (key) opCountsByDay.set(key, Number(r.c || 0));
        }
      }

      const weekly = [];
      for (let i = 0; i < 7; i += 1) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const key = localDateKey(d);
        const login = Number(loginCountsByDay.get(key) || 0);
        const ops = Number(opCountsByDay.get(key) || 0);
        weekly.push({ day: dayLabelZh(d), value: login + ops });
      }

      return ok(req, res, { weeklyActivityData: weekly });
    } catch (e) {
      logError(`GET teacher monitor stats traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.get(
  '/teacher/personal-classes/:classId/monitor/teams/:teamId/submissions',
  requireAuth(),
  requireTeacher(),
  async (req, res) => {
    try {
      const tid = teacherIdFromReq(req);
      const classId = parseId(req.params.classId);
      const teamId = parseId(req.params.teamId);
      if (!tid || !classId || !teamId) return bad(req, res, 400, 40003, '参数无效');
      const pool = getPool();
      if (!(await ownsPersonalClass(pool, tid, classId))) {
        return bad(req, res, 404, 40402, '班级不存在或无权操作');
      }

      const items = [];

      // 2 创新思维：项目选题（数据）
      const { rows: topicRows } = await pool.query(
        `SELECT project_name, project_direction, project_description, target_users, core_value,
                core_problem, solution_overview, market_size, competitive_advantage,
                submitted_at, status, review_comment
         FROM teacher_personal_class_team_project_topics
         WHERE team_id = $1
         ORDER BY submitted_at DESC NULLS LAST, id DESC
         LIMIT 1`,
        [teamId]
      );
      if (topicRows[0]) {
        items.push({
          id: `ideation-topic-${teamId}`,
          stageKey: 'ideation',
          stageName: '创新思维与创意生成',
          submitTime: fmtZh(topicRows[0].submitted_at),
          kind: 'data',
          title: '项目选题',
          payload: {
            projectName: topicRows[0].project_name || '',
            projectDirection: topicRows[0].project_direction || '',
            projectDescription: topicRows[0].project_description || '',
            targetUsers: topicRows[0].target_users || '',
            coreValue: topicRows[0].core_value || '',
            coreProblem: topicRows[0].core_problem || '',
            solutionOverview: topicRows[0].solution_overview || '',
            marketSize: topicRows[0].market_size || '',
            competitiveAdvantage: topicRows[0].competitive_advantage || '',
            status: topicRows[0].status || '',
            reviewComment: topicRows[0].review_comment || '',
          },
        });
      }

      // 3 市场调研：调研报告（数据上传）
      const { rows: marketReportRows } = await pool.query(
        `SELECT uploaded_at, uploaded_by, payload
         FROM teacher_personal_class_team_market_report_uploads
         WHERE team_id = $1
         LIMIT 1`,
        [teamId]
      );
      if (marketReportRows[0]) {
        items.push({
          id: `market-report-${teamId}`,
          stageKey: 'marketResearch',
          stageName: '市场调研与用户画像',
          submitTime: fmtZh(marketReportRows[0].uploaded_at),
          kind: 'data',
          title: '市场调研报告',
          payload: marketReportRows[0].payload || null,
        });
      }

      // 4 产品设计：原型 zip（文件下载）
      const proto = await productPrototypeForTeam(pool, classId, teamId);
      if (proto) {
        items.push({
          id: `product-prototype-${teamId}`,
          stageKey: 'productDesign',
          stageName: '产品设计与原型',
          submitTime: proto.uploadedAt,
          kind: 'file',
          title: '产品原型压缩包',
          file: {
            name: proto.originName,
            downloadUrl: proto.downloadUrl,
          },
        });
      }

      // 7 商业计划书：数据 + 文件（附件下载）
      const plan = await businessPlanSubmissionForTeam(pool, classId, teamId);
      if (plan) {
        items.push({
          id: `business-plan-${teamId}`,
          stageKey: 'businessPlan',
          stageName: '商业计划书与PPT',
          submitTime: plan.submitTime,
          kind: 'mixed',
          title: '商业计划书提交',
          payload: {
            version: plan.version,
            versionSummary: plan.versionSummary,
            status: plan.status,
            reviewComment: plan.reviewComment,
            fullText: plan.fullText,
            sections: plan.sections,
          },
          files: plan.attachments.map((a) => ({
            name: a.name,
            downloadUrl: a.url,
          })),
        });
      }

      return ok(req, res, { submissions: items });
    } catch (e) {
      logError(`GET teacher monitor submissions traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.get(
  '/teacher/personal-classes/:classId/monitor/teams/:teamId/product-prototype/download',
  requireAuth(),
  requireTeacher(),
  async (req, res) => {
    try {
      const tid = teacherIdFromReq(req);
      const classId = parseId(req.params.classId);
      const teamId = parseId(req.params.teamId);
      if (!tid || !classId || !teamId) return bad(req, res, 400, 40003, '参数无效');
      const pool = getPool();
      if (!(await ownsPersonalClass(pool, tid, classId))) {
        return bad(req, res, 404, 40402, '班级不存在或无权操作');
      }
      const { rows } = await pool.query(
        `SELECT origin_name, storage_path
         FROM teacher_personal_class_team_product_prototype_uploads
         WHERE team_id = $1`,
        [teamId]
      );
      if (!rows.length) return bad(req, res, 404, 40404, '文件不存在');
      const r = rows[0];
      const abs = path.join(PRODUCT_PROTOTYPE_UPLOAD_ROOT, String(r.storage_path || ''));
      if (!fs.existsSync(abs)) return bad(req, res, 404, 40405, '文件不存在');
      return res.download(abs, r.origin_name || 'prototype.zip');
    } catch (e) {
      logError(`GET product-prototype download traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.post(
  '/teacher/personal-classes/:classId/monitor/scoring/batch',
  requireAuth(),
  requireTeacher(),
  async (req, res) => {
    try {
      const tid = teacherIdFromReq(req);
      const classId = parseId(req.params.classId);
      if (!tid || !classId) return bad(req, res, 400, 40003, '参数无效');
      const pool = getPool();
      if (!(await ownsPersonalClass(pool, tid, classId))) {
        return bad(req, res, 404, 40402, '班级不存在或无权操作');
      }
      const taskType = String(req.body?.taskType || '').trim();
      const results = Array.isArray(req.body?.results) ? req.body.results : [];
      if (!taskType) return bad(req, res, 400, 40004, '请选择任务类型');
      if (!results.length) return bad(req, res, 400, 40004, '请提交评分结果');
      for (const r of results) {
        const teamId = parseId(r?.teamId);
        const score = Number(r?.score);
        if (!teamId || !Number.isFinite(score) || score < 0 || score > 100) {
          return bad(req, res, 400, 40004, '评分数据无效');
        }
      }
      await pool.query(
        `INSERT INTO operation_logs (operator_id, operator_role, module, action, target_type, target_id, detail)
         VALUES ($1, 'teacher', 'teacher_monitor', 'batch_score', 'personal_class', $2, $3::jsonb)`,
        [
          tid,
          classId,
          JSON.stringify({
            taskType,
            results: results.map((r) => ({
              teamId: Number(r.teamId),
              score: Number(r.score),
              comment: String(r.comment || ''),
            })),
          }),
        ]
      );
      return ok(req, res, { saved: true });
    } catch (e) {
      logError(`POST teacher monitor batch scoring traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

export default router;

