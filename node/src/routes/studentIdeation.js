import { Router } from 'express';
import { randomUUID } from 'crypto';
import { getPool } from '../lib/db.js';
import { logError } from '../lib/logError.js';
import { requireAuth, requireStudent, requireTeacher } from '../middleware/auth.js';
import {
  buildNoThinkingExtraBody,
  chatCompletion,
  friendlyLlmErrorMessage,
  getEnabledProvider,
  logPromptToConsole,
} from '../lib/llmGateway.js';
import {
  getIdeationMethodPrompt,
  IDEATION_METHOD_LABELS,
  padIdeationStringList,
} from '../lib/ideationPrompts.js';
import {
  HAT_STUDIO_DRAFT_KEYS,
  HAT_STUDIO_DRAFT_LABELS,
  HAT_STUDIO_ROUND_SYSTEM_PROMPT,
  HAT_STUDIO_SINGLE_REPLY_SYSTEM_PROMPT,
  buildHatStudioRoundOrder,
  buildHatStudioRoundUserPrompt,
  buildHatStudioSingleReplyUserPrompt,
  parseHatStudioRoundFromLlmText,
  parseHatStudioSingleReplyFromLlmText,
  parseMentionedHatFromText,
} from '../lib/ideationHatStudioPrompts.js';
import { evaluateModulePrerequisiteForStudent } from '../lib/trainingModulePrerequisite.js';

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

function teacherIdFromReq(req) {
  const id = Number(String(req.user?.sub || '').trim());
  return Number.isFinite(id) && id > 0 ? id : null;
}

function parseId(param) {
  const id = Number(String(param || '').trim());
  return Number.isFinite(id) && id > 0 ? id : null;
}

function normalizeText(value) {
  return String(value || '').trim();
}

async function studentEnrolledInClass(pool, studentId, classId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM teacher_personal_class_students WHERE teacher_personal_class_id = $1 AND student_id = $2`,
    [classId, studentId]
  );
  return rows.length > 0;
}

async function teacherOwnsClass(pool, teacherId, classId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM teacher_personal_classes WHERE id = $1 AND teacher_id = $2`,
    [classId, teacherId]
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
  return { id: String(rows[0].id), name: rows[0].name };
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

function toScore(value, { min, max, integer = false }) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return integer ? Math.round(n) : Math.round(n * 10) / 10;
}

/** 列表字段与提示词约定一致：恰好 3 项 */
function textArray(value) {
  return padIdeationStringList(
    Array.isArray(value) ? value.map((item) => String(item || '').trim()).filter(Boolean) : []
  );
}

function normalizeAnalysis(parsed) {
  if (!parsed || typeof parsed !== 'object') throw new Error('AI 未返回有效 JSON');
  const overallScore = toScore(parsed.overallScore, { min: 0, max: 100, integer: true });
  const novelty = toScore(parsed.novelty, { min: 0, max: 5 });
  const feasibility = toScore(parsed.feasibility, { min: 0, max: 5 });
  const marketPotential = toScore(parsed.marketPotential, { min: 0, max: 5 });
  const innovation = toScore(parsed.innovation, { min: 0, max: 5 });
  const summary =
    String(parsed.summary || '').trim() ||
    '当前创意描述信息较少，建议补充问题背景、目标用户与初步方案后再评估。';
  return {
    title: String(parsed.title || '').trim(),
    description: String(parsed.description || '').trim(),
    overallScore: overallScore ?? 40,
    novelty: novelty ?? 2,
    feasibility: feasibility ?? 2,
    marketPotential: marketPotential ?? 2,
    innovation: innovation ?? 2,
    summary,
    strengths: textArray(parsed.strengths),
    weaknesses: textArray(parsed.weaknesses),
    suggestions: textArray(parsed.suggestions),
    tags: textArray(parsed.tags),
  };
}

function mapIdeaRow(row) {
  const analysis = row.ai_analysis || {};
  return {
    id: String(row.id),
    methodKey: row.method_key,
    method: row.method_name,
    title: row.title,
    description: row.description,
    formPayload: row.form_payload || {},
    author: row.author_name || row.author_username || '成员',
    authorId: String(row.created_by),
    votes: Number(row.like_count || 0),
    liked: Boolean(row.liked),
    novelty: Number(analysis.novelty || 0),
    feasibility: Number(analysis.feasibility || 0),
    aiAnalysis: {
      overallScore: Number(analysis.overallScore),
      novelty: Number(analysis.novelty),
      feasibility: Number(analysis.feasibility),
      marketPotential: Number(analysis.marketPotential),
      innovation: Number(analysis.innovation),
      summary: String(analysis.summary || ''),
      strengths: Array.isArray(analysis.strengths) ? analysis.strengths : [],
      weaknesses: Array.isArray(analysis.weaknesses) ? analysis.weaknesses : [],
      suggestions: Array.isArray(analysis.suggestions) ? analysis.suggestions : [],
      tags: Array.isArray(analysis.tags) ? analysis.tags : [],
    },
    createdAt: row.created_at,
  };
}

async function loadIdeas(pool, teamId, studentId) {
  const { rows } = await pool.query(
    `SELECT i.*,
            u.real_name AS author_name,
            u.username AS author_username,
            (SELECT COUNT(*)::int FROM teacher_personal_class_team_idea_likes l WHERE l.idea_id = i.id) AS like_count,
            EXISTS (
              SELECT 1 FROM teacher_personal_class_team_idea_likes l
              WHERE l.idea_id = i.id AND l.student_id = $2
            ) AS liked
     FROM teacher_personal_class_team_ideas i
     JOIN users u ON u.id = i.created_by
     WHERE i.team_id = $1
     ORDER BY i.created_at DESC`,
    [teamId, studentId]
  );
  return rows.map(mapIdeaRow);
}

async function loadIdea(pool, ideaId, teamId, studentId) {
  const { rows } = await pool.query(
    `SELECT i.*,
            u.real_name AS author_name,
            u.username AS author_username,
            (SELECT COUNT(*)::int FROM teacher_personal_class_team_idea_likes l WHERE l.idea_id = i.id) AS like_count,
            EXISTS (
              SELECT 1 FROM teacher_personal_class_team_idea_likes l
              WHERE l.idea_id = i.id AND l.student_id = $3
            ) AS liked
     FROM teacher_personal_class_team_ideas i
     JOIN users u ON u.id = i.created_by
     WHERE i.id = $1 AND i.team_id = $2
     LIMIT 1`,
    [ideaId, teamId, studentId]
  );
  return rows[0] ? mapIdeaRow(rows[0]) : null;
}

async function loadDiscussions(pool, teamId) {
  const { rows } = await pool.query(
    `SELECT d.id,
            d.content,
            d.created_at,
            u.id AS student_id,
            u.real_name,
            u.username
     FROM teacher_personal_class_team_discussions d
     JOIN users u ON u.id = d.student_id
     WHERE d.team_id = $1
     ORDER BY d.created_at DESC
     LIMIT 100`,
    [teamId]
  );
  return rows.map((row) => ({
    id: String(row.id),
    text: row.content,
    author: row.real_name || row.username || '成员',
    authorId: String(row.student_id),
    createdAt: row.created_at,
  }));
}

async function loadIncompleteIdeationMembers(pool, teamId) {
  const { rows: members } = await pool.query(
    `SELECT m.student_id, COALESCE(NULLIF(u.real_name, ''), u.username, '成员') AS name
     FROM teacher_personal_class_team_members m
     JOIN users u ON u.id = m.student_id
     WHERE m.team_id = $1
     ORDER BY name ASC`,
    [teamId]
  );
  const incompleteMembers = [];
  for (const row of members) {
    const sid = Number(row.student_id);
    if (!Number.isFinite(sid) || sid <= 0) continue;
    const result = await evaluateModulePrerequisiteForStudent(pool, sid, 'ideation');
    if (!result.allowed) {
      incompleteMembers.push({
        studentId: String(row.student_id),
        name: row.name,
      });
    }
  }
  return incompleteMembers;
}

async function projectDirectionExists(pool, classId, projectDirection) {
  const { rows } = await pool.query(
    `SELECT 1
     FROM teacher_instance_library_categories c
     JOIN teacher_personal_classes pc ON pc.teacher_id = c.teacher_id
     WHERE pc.id = $1 AND c.name = $2
     LIMIT 1`,
    [classId, projectDirection]
  );
  return rows.length > 0;
}

function validateTopicBody(body) {
  const projectName = normalizeText(body?.projectName);
  const projectDirection = normalizeText(body?.projectDirection);
  const projectDescription = normalizeText(body?.projectDescription);
  const coreValue = normalizeText(body?.coreValue);
  const targetUsers = normalizeText(body?.targetUsers);
  const coreProblem = normalizeText(body?.coreProblem);
  const solutionOverview = normalizeText(body?.solutionOverview);
  const marketSize = normalizeText(body?.marketSize);
  const competitiveAdvantage = normalizeText(body?.competitiveAdvantage);

  // 所有文本填入项统一最低 15 字；项目方向为下拉，仅校验必选
  if (projectName.length < 15) return { error: '项目名称至少需要15个字' };
  if (!projectDirection) return { error: '请填写项目方向' };
  if (projectDescription.length < 15) return { error: '项目描述至少需要15个字' };
  if (coreValue.length < 15) return { error: '核心价值主张至少需要15个字' };
  if (targetUsers.length < 15) return { error: '目标用户描述至少需要15个字' };
  if (coreProblem.length < 15) return { error: '解决的核心问题至少需要15个字' };
  if (solutionOverview.length < 15) return { error: '解决方案概述至少需要15个字' };
  if (marketSize.length < 15) return { error: '市场规模至少需要15个字' };
  if (competitiveAdvantage.length < 15) return { error: '竞争优势至少需要15个字' };

  return {
    projectName,
    projectDirection,
    projectDescription,
    coreValue,
    targetUsers,
    coreProblem,
    solutionOverview,
    marketSize,
    competitiveAdvantage,
  };
}

function parseTopicDraftBody(body) {
  return {
    projectName: normalizeText(body?.projectName).slice(0, 256),
    projectDirection: normalizeText(body?.projectDirection).slice(0, 128),
    projectDescription: String(body?.projectDescription ?? '').slice(0, 10000),
    coreValue: String(body?.coreValue ?? '').slice(0, 10000),
    targetUsers: String(body?.targetUsers ?? '').slice(0, 2000),
    coreProblem: String(body?.coreProblem ?? '').slice(0, 10000),
    solutionOverview: String(body?.solutionOverview ?? '').slice(0, 20000),
    marketSize: String(body?.marketSize ?? '').slice(0, 10000),
    competitiveAdvantage: String(body?.competitiveAdvantage ?? '').slice(0, 10000),
  };
}

function mapTopicDraft(row) {
  if (!row) return null;
  return {
    projectName: row.project_name || '',
    projectDirection: row.project_direction || '',
    projectDescription: row.project_description || '',
    coreValue: row.core_value || '',
    targetUsers: row.target_users || '',
    coreProblem: row.core_problem || '',
    solutionOverview: row.solution_overview || '',
    marketSize: row.market_size || '',
    competitiveAdvantage: row.competitive_advantage || '',
    savedAt: row.updated_at ? new Date(row.updated_at).toISOString() : '',
  };
}

async function mapProjectTopic(pool, row) {
  if (!row) return null;
  const { rows: teamRows } = await pool.query(
    `SELECT t.name AS "teamName",
            COALESCE(leader.real_name, leader.username, '') AS "leaderName",
            (SELECT COUNT(*)::int FROM teacher_personal_class_team_members m WHERE m.team_id = t.id) AS "memberCount"
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
     WHERE t.id = $1`,
    [row.team_id]
  );
  const team = teamRows[0] || {};
  return {
    id: String(row.id),
    teamId: String(row.team_id),
    teamName: team.teamName || '',
    leaderName: team.leaderName || '',
    memberCount: Number(team.memberCount || 0),
    projectName: row.project_name,
    projectDirection: row.project_direction,
    projectDescription: row.project_description,
    direction: row.project_direction,
    description: row.project_description,
    targetUsers: row.target_users,
    coreValue: row.core_value,
    coreProblem: row.core_problem,
    solutionOverview: row.solution_overview,
    marketSize: row.market_size,
    competitiveAdvantage: row.competitive_advantage,
    submitTime: row.submitted_at ? new Date(row.submitted_at).toISOString() : '',
    status: row.status,
    reviewComment: row.review_comment || '',
    reviewTime: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : '',
  };
}

async function loadTeamProjectTopic(pool, teamId) {
  const { rows } = await pool.query(
    `SELECT * FROM teacher_personal_class_team_project_topics WHERE team_id = $1 LIMIT 1`,
    [teamId]
  );
  return rows[0] || null;
}

async function loadTeamProjectTopicDraft(pool, teamId) {
  const { rows } = await pool.query(
    `SELECT * FROM teacher_personal_class_team_project_topic_drafts WHERE team_id = $1 LIMIT 1`,
    [teamId]
  );
  return rows[0] || null;
}

async function assertLeaderCanEditTopicDraft(pool, sid, team) {
  const leaderId = await resolveTeamLeaderId(pool, Number(team.id));
  if (String(leaderId || '') !== String(sid)) {
    return { error: '仅队长可保存选题草稿' };
  }
  const existing = await loadTeamProjectTopic(pool, Number(team.id));
  if (existing?.status === 'pending') return { error: '项目选题已提交，待教师审核' };
  if (existing?.status === 'approved') return { error: '项目选题已审核通过' };
  return { existing };
}

router.get('/student/personal-classes/:classId/ideation/workspace', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const sid = studentIdFromReq(req);
    const classId = parseId(req.params.classId);
    if (!sid || !classId) return bad(req, res, 400, 40003, '参数无效');
    const pool = getPool();
    if (!(await studentEnrolledInClass(pool, sid, classId))) {
      return bad(req, res, 403, 40301, '未加入该班级');
    }
    const team = await getConfirmedTeam(pool, sid, classId);
    if (!team) return ok(req, res, { team: null, ideas: [], discussions: [] });
    const [ideas, discussions] = await Promise.all([
      loadIdeas(pool, Number(team.id), sid),
      loadDiscussions(pool, Number(team.id)),
    ]);
    return ok(req, res, { team, ideas, discussions });
  } catch (e) {
    logError(`GET ideation workspace traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.get('/student/personal-classes/:classId/ideation/team-prerequisites', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const sid = studentIdFromReq(req);
    const classId = parseId(req.params.classId);
    if (!sid || !classId) return bad(req, res, 400, 40003, '参数无效');
    const pool = getPool();
    if (!(await studentEnrolledInClass(pool, sid, classId))) {
      return bad(req, res, 403, 40301, '未加入该班级');
    }
    const team = await getConfirmedTeam(pool, sid, classId);
    if (!team) return bad(req, res, 400, 40014, '教师确认组队后可确定项目选题');
    const incompleteMembers = await loadIncompleteIdeationMembers(pool, Number(team.id));
    return ok(req, res, { incompleteMembers });
  } catch (e) {
    logError(`GET ideation team prerequisites traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.get('/student/personal-classes/:classId/ideation/topic', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const sid = studentIdFromReq(req);
    const classId = parseId(req.params.classId);
    if (!sid || !classId) return bad(req, res, 400, 40003, '参数无效');
    const pool = getPool();
    if (!(await studentEnrolledInClass(pool, sid, classId))) {
      return bad(req, res, 403, 40301, '未加入该班级');
    }
    const team = await getConfirmedTeam(pool, sid, classId);
    if (!team) return ok(req, res, { topic: null, draft: null });
    const row = await loadTeamProjectTopic(pool, Number(team.id));
    const draftRow = await loadTeamProjectTopicDraft(pool, Number(team.id));
    return ok(req, res, {
      topic: await mapProjectTopic(pool, row),
      draft: mapTopicDraft(draftRow),
    });
  } catch (e) {
    logError(`GET ideation topic traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.put('/student/personal-classes/:classId/ideation/topic-draft', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const sid = studentIdFromReq(req);
    const classId = parseId(req.params.classId);
    if (!sid || !classId) return bad(req, res, 400, 40003, '参数无效');
    const draft = parseTopicDraftBody(req.body);

    const pool = getPool();
    if (!(await studentEnrolledInClass(pool, sid, classId))) {
      return bad(req, res, 403, 40301, '未加入该班级');
    }
    const team = await getConfirmedTeam(pool, sid, classId);
    if (!team) return bad(req, res, 400, 40014, '教师确认组队后可保存选题草稿');
    const gate = await assertLeaderCanEditTopicDraft(pool, sid, team);
    if (gate.error) return bad(req, res, 403, 40304, gate.error);

    const { rows } = await pool.query(
      `INSERT INTO teacher_personal_class_team_project_topic_drafts
         (teacher_personal_class_id, team_id, saved_by, project_name, project_direction,
          project_description, core_value, target_users, core_problem, solution_overview,
          market_size, competitive_advantage, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())
       ON CONFLICT (team_id) DO UPDATE SET
         teacher_personal_class_id = EXCLUDED.teacher_personal_class_id,
         saved_by = EXCLUDED.saved_by,
         project_name = EXCLUDED.project_name,
         project_direction = EXCLUDED.project_direction,
         project_description = EXCLUDED.project_description,
         core_value = EXCLUDED.core_value,
         target_users = EXCLUDED.target_users,
         core_problem = EXCLUDED.core_problem,
         solution_overview = EXCLUDED.solution_overview,
         market_size = EXCLUDED.market_size,
         competitive_advantage = EXCLUDED.competitive_advantage,
         updated_at = now()
       RETURNING *`,
      [
        classId,
        Number(team.id),
        sid,
        draft.projectName,
        draft.projectDirection,
        draft.projectDescription,
        draft.coreValue,
        draft.targetUsers,
        draft.coreProblem,
        draft.solutionOverview,
        draft.marketSize,
        draft.competitiveAdvantage,
      ]
    );
    return ok(req, res, { draft: mapTopicDraft(rows[0]) });
  } catch (e) {
    logError(`PUT ideation topic-draft traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.post('/student/personal-classes/:classId/ideation/topic', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const sid = studentIdFromReq(req);
    const classId = parseId(req.params.classId);
    if (!sid || !classId) return bad(req, res, 400, 40003, '参数无效');
    const v = validateTopicBody(req.body);
    if (v.error) return bad(req, res, 400, 40004, v.error);

    const pool = getPool();
    if (!(await studentEnrolledInClass(pool, sid, classId))) {
      return bad(req, res, 403, 40301, '未加入该班级');
    }
    const team = await getConfirmedTeam(pool, sid, classId);
    if (!team) return bad(req, res, 400, 40014, '教师确认组队后可提交项目选题');
    const leaderId = await resolveTeamLeaderId(pool, Number(team.id));
    if (String(leaderId || '') !== String(sid)) {
      return bad(req, res, 403, 40304, '仅队长可提交项目选题');
    }
    const incompleteMembers = await loadIncompleteIdeationMembers(pool, Number(team.id));
    if (incompleteMembers.length > 0) {
      return bad(
        req,
        res,
        400,
        40017,
        `小组成员 ${incompleteMembers.map((m) => m.name).join('、')} 尚未完成创新思维环节的实践课程学习及知识点检测`
      );
    }
    const existing = await loadTeamProjectTopic(pool, Number(team.id));
    if (existing?.status === 'pending') return bad(req, res, 400, 40018, '项目选题已提交，待教师审核');
    if (existing?.status === 'approved') return bad(req, res, 400, 40019, '项目选题已审核通过');
    if (!(await projectDirectionExists(pool, classId, v.projectDirection))) {
      return bad(req, res, 400, 40020, '请选择教师创建的项目方向');
    }

    const { rows } = await pool.query(
      `INSERT INTO teacher_personal_class_team_project_topics
         (teacher_personal_class_id, team_id, submitted_by, project_name, project_direction,
          project_description, core_value, target_users, core_problem, solution_overview,
          market_size, competitive_advantage, status, review_comment, reviewed_by, reviewed_at, submitted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending', '', NULL, NULL, now())
       ON CONFLICT (team_id) DO UPDATE SET
         teacher_personal_class_id = EXCLUDED.teacher_personal_class_id,
         submitted_by = EXCLUDED.submitted_by,
         project_name = EXCLUDED.project_name,
         project_direction = EXCLUDED.project_direction,
         project_description = EXCLUDED.project_description,
         core_value = EXCLUDED.core_value,
         target_users = EXCLUDED.target_users,
         core_problem = EXCLUDED.core_problem,
         solution_overview = EXCLUDED.solution_overview,
         market_size = EXCLUDED.market_size,
         competitive_advantage = EXCLUDED.competitive_advantage,
         status = 'pending',
         review_comment = '',
         reviewed_by = NULL,
         reviewed_at = NULL,
         submitted_at = now(),
         updated_at = now()
       RETURNING *`,
      [
        classId,
        Number(team.id),
        sid,
        v.projectName,
        v.projectDirection,
        v.projectDescription,
        v.coreValue,
        v.targetUsers,
        v.coreProblem,
        v.solutionOverview,
        v.marketSize,
        v.competitiveAdvantage,
      ]
    );
    await pool.query(`DELETE FROM teacher_personal_class_team_project_topic_drafts WHERE team_id = $1`, [
      Number(team.id),
    ]);
    return ok(req, res, { topic: await mapProjectTopic(pool, rows[0]) });
  } catch (e) {
    logError(`POST ideation topic traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.get('/teacher/personal-classes/:classId/ideation/topics', requireAuth(), requireTeacher(), async (req, res) => {
  try {
    const tid = teacherIdFromReq(req);
    const classId = parseId(req.params.classId);
    if (!tid || !classId) return bad(req, res, 400, 40003, '参数无效');
    const pool = getPool();
    if (!(await teacherOwnsClass(pool, tid, classId))) {
      return bad(req, res, 404, 40402, '班级不存在或无权操作');
    }
    const { rows } = await pool.query(
      `SELECT *
       FROM teacher_personal_class_team_project_topics
       WHERE teacher_personal_class_id = $1
       ORDER BY submitted_at DESC, id DESC`,
      [classId]
    );
    const topics = [];
    for (const row of rows) topics.push(await mapProjectTopic(pool, row));
    return ok(req, res, { topics });
  } catch (e) {
    logError(`GET teacher ideation topics traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.post('/teacher/personal-classes/:classId/ideation/topics/:topicId/review', requireAuth(), requireTeacher(), async (req, res) => {
  let client;
  let transactionOpen = false;
  try {
    const tid = teacherIdFromReq(req);
    const classId = parseId(req.params.classId);
    const topicId = parseId(req.params.topicId);
    const status = req.body?.status === 'approved' ? 'approved' : req.body?.status === 'rejected' ? 'rejected' : '';
    const comment = normalizeText(req.body?.comment);
    if (!tid || !classId || !topicId || !status) return bad(req, res, 400, 40003, '参数无效');
    if (!comment) return bad(req, res, 400, 40004, '请填写审核意见');
    const pool = getPool();
    if (!(await teacherOwnsClass(pool, tid, classId))) {
      return bad(req, res, 404, 40402, '班级不存在或无权操作');
    }
    client = await pool.connect();
    await client.query('BEGIN');
    transactionOpen = true;
    const { rows } = await client.query(
      `UPDATE teacher_personal_class_team_project_topics
       SET status = $3, review_comment = $4, reviewed_by = $5, reviewed_at = now(), updated_at = now()
       WHERE id = $1 AND teacher_personal_class_id = $2
       RETURNING *`,
      [topicId, classId, status, comment, tid]
    );
    if (!rows.length) {
      await client.query('ROLLBACK');
      transactionOpen = false;
      return bad(req, res, 404, 40403, '选题提交不存在');
    }
    const reviewTitle = status === 'approved' ? '项目选题审核通过' : '项目选题审核退回';
    const reviewContent =
      status === 'approved'
        ? `你的团队项目选题「${rows[0].project_name}」已审核通过。审核意见：${comment}`
        : `你的团队项目选题「${rows[0].project_name}」已退回修改。审核意见：${comment}`;
    await client.query(
      `INSERT INTO notifications (receiver_id, sender_id, type, title, content, related_module, related_link, is_read)
       SELECT m.student_id, $2, 'evaluation', $3, $4, 'ideation_project_topic',
              '/student-center?tab=module-ideation&ideationTab=confirm', false
       FROM teacher_personal_class_team_members m
       WHERE m.team_id = $1`,
      [rows[0].team_id, tid, reviewTitle, reviewContent]
    );
    await client.query('COMMIT');
    transactionOpen = false;
    return ok(req, res, { topic: await mapProjectTopic(pool, rows[0]) });
  } catch (e) {
    if (client && transactionOpen) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        logError(`ROLLBACK teacher ideation topic review traceId=${req.traceId}`, rollbackError);
      }
    }
    logError(`POST teacher ideation topic review traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  } finally {
    if (client) client.release();
  }
});

router.post('/student/personal-classes/:classId/ideation/ideas/analyze', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const sid = studentIdFromReq(req);
    const classId = parseId(req.params.classId);
    const methodKey = String(req.body?.methodKey || '').trim();
    const formPayload = req.body?.formPayload && typeof req.body.formPayload === 'object' ? req.body.formPayload : {};
    if (!sid || !classId || !IDEATION_METHOD_LABELS[methodKey]) return bad(req, res, 400, 40003, '参数无效');

    const pool = getPool();
    if (!(await studentEnrolledInClass(pool, sid, classId))) {
      return bad(req, res, 403, 40301, '未加入该班级');
    }
    const team = await getConfirmedTeam(pool, sid, classId);
    if (!team) return bad(req, res, 400, 40014, '教师确认组队后可提交创意分析');

    const prompt = getIdeationMethodPrompt(methodKey);
    const provider = await getEnabledProvider('multimodal');
    if (!prompt || !provider) return bad(req, res, 400, 40011, '未配置已启用的多模态模型');

    // 六帽创想室：只把工作区笔记交给模型汇总，避免把拼接长文当最终创意
    let userPrompt;
    if (methodKey === 'six_hats') {
      const notes = {
        ideaTitle: String(formPayload.ideaTitle || formPayload.title || '').trim(),
        problemInsight: String(formPayload.problemInsight || '').trim(),
        userValue: String(formPayload.userValue || '').trim(),
        solutionPoints: String(formPayload.solutionPoints || '').trim(),
        riskDiff: String(formPayload.riskDiff || '').trim(),
      };
      const filled = Object.values(notes).filter(Boolean).length;
      if (filled < 2) return bad(req, res, 400, 40016, '请先完善至少 2 个工作区字段，再让 AI 汇总入库');
      userPrompt = `方法：六帽创想室
任务：根据下列「工作区原始笔记」汇总成可入库的创业创意，并完成评分分析。
要求：title 必须是简短创意名；description 必须是你重写的结构化概述，禁止整段复制笔记原文。

工作区原始笔记：
${JSON.stringify(notes, null, 2)}`;
    } else {
      userPrompt = `方法：${IDEATION_METHOD_LABELS[methodKey]}\n学生原始表单：\n${JSON.stringify(formPayload, null, 2)}`;
    }
    logPromptToConsole(provider, prompt, userPrompt);

    let raw;
    try {
      raw = await chatCompletion({
        provider,
        system: prompt,
        user: userPrompt,
        jsonMode: true,
      });
    } catch (e) {
      // 部分模型不支持 json_object；降级为普通文本再抽 JSON
      const sm = String(e?.message || '');
      if (!/response_format|json_object|json mode/i.test(sm)) throw e;
      raw = await chatCompletion({
        provider,
        system: prompt,
        user: userPrompt,
        jsonMode: false,
      });
    }
    const parsed = extractJsonObject(raw);
    if (!parsed) {
      logError(`POST ideation analyze parse-fail preview=${String(raw || '').slice(0, 500)}`, new Error('parse'));
      return bad(req, res, 500, 50011, 'AI 返回无法解析为 JSON，请重试');
    }
    const analysis = normalizeAnalysis(parsed);

    const submittedTitle = String(formPayload.title || formPayload.ideaTitle || '').trim();
    const submittedDescription = String(formPayload.description || formPayload.solution || '').trim();
    // AI创意 / 六帽创想室：入库标题与描述一律用模型汇总结果
    const useAiCopy = methodKey === 'ai' || methodKey === 'six_hats';
    let title = useAiCopy ? analysis.title : submittedTitle;
    let description = useAiCopy ? analysis.description : submittedDescription;
    if (!title || !description) return bad(req, res, 400, 40016, 'AI 未返回有效创意内容');
    // 六帽：标题过长时截断，避免模型偶发把长笔记当成标题
    if (methodKey === 'six_hats' && title.length > 40) {
      title = `${title.slice(0, 40).replace(/[，。；、\s]+$/, '')}…`;
    }
    // 六帽入库：form_payload 保留工作区原文 + AI 汇总；列表展示用 title/description
    const storePayload =
      methodKey === 'six_hats'
        ? {
            ...formPayload,
            workspaceNotes: {
              ideaTitle: String(formPayload.ideaTitle || '').trim(),
              problemInsight: String(formPayload.problemInsight || '').trim(),
              userValue: String(formPayload.userValue || '').trim(),
              solutionPoints: String(formPayload.solutionPoints || '').trim(),
              riskDiff: String(formPayload.riskDiff || '').trim(),
            },
            aiSummarized: true,
            title,
            description,
          }
        : formPayload;

    const { rows } = await pool.query(
      `INSERT INTO teacher_personal_class_team_ideas
       (team_id, method_key, method_name, title, description, form_payload, ai_analysis, created_by)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)
       RETURNING id`,
      [
        Number(team.id),
        methodKey,
        IDEATION_METHOD_LABELS[methodKey],
        title,
        description,
        JSON.stringify(storePayload),
        JSON.stringify({
          overallScore: analysis.overallScore,
          novelty: analysis.novelty,
          feasibility: analysis.feasibility,
          marketPotential: analysis.marketPotential,
          innovation: analysis.innovation,
          summary: analysis.summary,
          strengths: analysis.strengths,
          weaknesses: analysis.weaknesses,
          suggestions: analysis.suggestions,
          tags: analysis.tags,
        }),
        sid,
      ]
    );
    const idea = await loadIdea(pool, rows[0].id, Number(team.id), sid);
    return ok(req, res, idea);
  } catch (e) {
    logError(`POST ideation analyze traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, friendlyLlmErrorMessage(e));
  }
});

router.post('/student/personal-classes/:classId/ideation/ideas/:ideaId/like', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const sid = studentIdFromReq(req);
    const classId = parseId(req.params.classId);
    const ideaId = parseId(req.params.ideaId);
    if (!sid || !classId || !ideaId) return bad(req, res, 400, 40003, '参数无效');
    const pool = getPool();
    if (!(await studentEnrolledInClass(pool, sid, classId))) {
      return bad(req, res, 403, 40301, '未加入该班级');
    }
    const team = await getConfirmedTeam(pool, sid, classId);
    if (!team) return bad(req, res, 400, 40014, '教师确认组队后可点赞');
    const idea = await loadIdea(pool, ideaId, Number(team.id), sid);
    if (!idea) return bad(req, res, 404, 40401, '创意不存在');
    await pool.query(
      `INSERT INTO teacher_personal_class_team_idea_likes (idea_id, student_id)
       VALUES ($1, $2)
       ON CONFLICT (idea_id, student_id) DO NOTHING`,
      [ideaId, sid]
    );
    const next = await loadIdea(pool, ideaId, Number(team.id), sid);
    return ok(req, res, next);
  } catch (e) {
    logError(`POST ideation like traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.delete('/student/personal-classes/:classId/ideation/ideas/:ideaId/like', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const sid = studentIdFromReq(req);
    const classId = parseId(req.params.classId);
    const ideaId = parseId(req.params.ideaId);
    if (!sid || !classId || !ideaId) return bad(req, res, 400, 40003, '参数无效');
    const pool = getPool();
    if (!(await studentEnrolledInClass(pool, sid, classId))) {
      return bad(req, res, 403, 40301, '未加入该班级');
    }
    const team = await getConfirmedTeam(pool, sid, classId);
    if (!team) return bad(req, res, 400, 40014, '教师确认组队后可取消点赞');
    const idea = await loadIdea(pool, ideaId, Number(team.id), sid);
    if (!idea) return bad(req, res, 404, 40401, '创意不存在');
    await pool.query(
      `DELETE FROM teacher_personal_class_team_idea_likes WHERE idea_id = $1 AND student_id = $2`,
      [ideaId, sid]
    );
    const next = await loadIdea(pool, ideaId, Number(team.id), sid);
    return ok(req, res, next);
  } catch (e) {
    logError(`DELETE ideation like traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.post('/student/personal-classes/:classId/ideation/discussions', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const sid = studentIdFromReq(req);
    const classId = parseId(req.params.classId);
    const content = String(req.body?.content || '').trim();
    if (!sid || !classId || !content) return bad(req, res, 400, 40003, '参数无效');
    if (content.length > 1000) return bad(req, res, 400, 40004, '讨论内容过长');
    const pool = getPool();
    if (!(await studentEnrolledInClass(pool, sid, classId))) {
      return bad(req, res, 403, 40301, '未加入该班级');
    }
    const team = await getConfirmedTeam(pool, sid, classId);
    if (!team) return bad(req, res, 400, 40014, '教师确认组队后可参与讨论');
    await pool.query(
      `INSERT INTO teacher_personal_class_team_discussions (team_id, student_id, content)
       VALUES ($1, $2, $3)`,
      [Number(team.id), sid, content]
    );
    const discussions = await loadDiscussions(pool, Number(team.id));
    return ok(req, res, discussions);
  } catch (e) {
    logError(`POST ideation discussion traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

/* ========== 六帽创想室 ========== */

const HAT_STUDIO_UPDATED_BY = {
  white: '白帽 - 数据分析师',
  red: '红帽 - 用户代表',
  black: '黑帽 - 风险预警员',
  yellow: '黄帽 - 乐观倡导者',
  green: '绿帽 - 创意设计师',
  blue: '蓝帽 - 项目经理',
};

function defaultHatStudioDraft() {
  const o = {};
  for (const k of HAT_STUDIO_DRAFT_KEYS) o[k] = { content: '', updatedBy: '' };
  return o;
}

function coerceHatStudioDraft(j) {
  const base = defaultHatStudioDraft();
  if (!j || typeof j !== 'object' || Array.isArray(j)) return base;
  for (const k of HAT_STUDIO_DRAFT_KEYS) {
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

function coerceHatStudioFills(arr) {
  if (!Array.isArray(arr)) return undefined;
  const out = [];
  for (const f of arr) {
    const k = String(f?.targetModule || '').trim();
    const c = String(f?.moduleContent || '').trim();
    if (HAT_STUDIO_DRAFT_KEYS.includes(k) && c) out.push({ targetModule: k, moduleContent: c });
  }
  return out.length ? out : undefined;
}

function coerceHatStudioTranscript(j) {
  const empty = { messages: [], roundCount: 0 };
  if (!j || typeof j !== 'object') return empty;
  const messages = Array.isArray(j.messages)
    ? j.messages.map((m) => ({
        id: String(m.id || randomUUID()),
        hat: String(m.hat || 'white'),
        content: String(m.content || ''),
        targetModule: m.targetModule && HAT_STUDIO_DRAFT_KEYS.includes(m.targetModule) ? m.targetModule : null,
        moduleContent: String(m.moduleContent || ''),
        fills: coerceHatStudioFills(m.fills),
        adoptedModules: Array.isArray(m.adoptedModules)
          ? m.adoptedModules.filter((x) => HAT_STUDIO_DRAFT_KEYS.includes(x))
          : [],
        status:
          m.status === 'adopted' || m.status === 'ignored' || m.status === 'guide' ? m.status : undefined,
        roundIndex: Number(m.roundIndex || 0),
        createdAt: String(m.createdAt || new Date().toISOString()),
      }))
    : [];
  return { messages, roundCount: Number(j.roundCount || 0) };
}

function mapHatStudioMessage(m) {
  return {
    id: m.id,
    hat: m.hat,
    content: m.content,
    targetModule: m.targetModule,
    moduleContent: m.moduleContent,
    fills: m.fills,
    adoptedModules: m.adoptedModules || [],
    status: m.status,
    roundIndex: m.roundIndex,
    createdAt: m.createdAt,
  };
}

function appendHatStudioRound(transcript, roundMessages, roundIndex) {
  const next = { ...transcript, messages: [...transcript.messages] };
  for (const m of roundMessages) {
    next.messages.push({
      id: randomUUID(),
      hat: m.hat,
      content: m.content,
      targetModule: m.targetModule,
      moduleContent: m.moduleContent,
      fills: m.fills,
      adoptedModules: [],
      roundIndex,
      createdAt: new Date().toISOString(),
    });
  }
  next.roundCount = roundIndex + 1;
  return next;
}

async function runHatStudioJsonLlm(provider, system, user, options = {}) {
  const { extraBody } = options;
  logPromptToConsole(provider, system, user);
  try {
    return await chatCompletion({ provider, system, user, jsonMode: true, extraBody });
  } catch (e) {
    const sm = String(e?.message || '');
    if (!/response_format|json_object|json mode/i.test(sm)) throw e;
    return await chatCompletion({ provider, system, user, jsonMode: false, extraBody });
  }
}

async function loadHatStudioContextText(pool, teamId) {
  const { rows } = await pool.query(
    `SELECT title, description, method_name
     FROM teacher_personal_class_team_ideas
     WHERE team_id = $1
     ORDER BY created_at DESC
     LIMIT 8`,
    [teamId]
  );
  if (!rows.length) return '（团队创意库尚无条目，请围绕创业实训场景发散）';
  return rows
    .map((r, i) => `${i + 1}. [${r.method_name}] ${r.title}\n${String(r.description || '').slice(0, 200)}`)
    .join('\n\n');
}

async function loadHatStudioMember(pool, teamId, studentId) {
  const { rows } = await pool.query(
    `SELECT draft_json, transcript_json
     FROM teacher_personal_class_team_hat_studio_member
     WHERE team_id = $1 AND student_id = $2`,
    [teamId, studentId]
  );
  if (!rows.length) {
    return { draft: defaultHatStudioDraft(), transcript: { messages: [], roundCount: 0 } };
  }
  return {
    draft: coerceHatStudioDraft(rows[0].draft_json),
    transcript: coerceHatStudioTranscript(rows[0].transcript_json),
  };
}

async function upsertHatStudioMember(pool, teamId, studentId, draft, transcript) {
  await pool.query(
    `INSERT INTO teacher_personal_class_team_hat_studio_member
       (team_id, student_id, draft_json, transcript_json, updated_at)
     VALUES ($1, $2, $3::jsonb, $4::jsonb, now())
     ON CONFLICT (team_id, student_id) DO UPDATE SET
       draft_json = EXCLUDED.draft_json,
       transcript_json = EXCLUDED.transcript_json,
       updated_at = now()`,
    [teamId, studentId, JSON.stringify(draft), JSON.stringify(transcript)]
  );
}

function buildHatStudioApiPayload(draft, transcript) {
  const filledCount = HAT_STUDIO_DRAFT_KEYS.filter((k) => String(draft[k]?.content || '').trim()).length;
  return {
    draft,
    draftDefs: HAT_STUDIO_DRAFT_KEYS.map((key) => ({ key, label: HAT_STUDIO_DRAFT_LABELS[key] })),
    transcript: {
      messages: transcript.messages.map(mapHatStudioMessage),
      roundCount: transcript.roundCount,
    },
    filledCount,
  };
}

async function requireHatStudioTeam(req, res) {
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
    bad(req, res, 400, 40014, '教师确认组队后可使用六帽创想室');
    return null;
  }
  return { pool, sid, classId, teamId: Number(team.id) };
}

function normalizeHatStudioHat(h) {
  const s = String(h || '').trim().toLowerCase();
  if (['white', 'red', 'black', 'yellow', 'green', 'blue'].includes(s)) return s;
  return parseMentionedHatFromText(`@${h}`);
}

router.get('/student/personal-classes/:classId/ideation/hat-studio', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const ctx = await requireHatStudioTeam(req, res);
    if (!ctx) return;
    const state = await loadHatStudioMember(ctx.pool, ctx.teamId, ctx.sid);
    return ok(req, res, buildHatStudioApiPayload(state.draft, state.transcript));
  } catch (e) {
    logError(`GET ideation hat-studio traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

/** 生成开场引导语（开始 / 重置共用） */
function buildHatStudioGuideMessage(studentDisplayName) {
  const name = String(studentDisplayName || '同学').trim() || '同学';
  return {
    id: randomUUID(),
    hat: 'blue',
    content: `${name}，欢迎进入六帽创想室。请先在下方用几句话描述你的创业创意：想解决什么问题、给谁用、大致怎么做。点击「发送发言」后，六顶思考帽会基于你的内容展开引导式讨论；之后也可 @白帽/@红帽/@黑帽/@黄帽/@绿帽/@蓝帽 追问某一角色，或不 @ 继续多轮讨论。讨论中出现的要点可点「采纳/写入」到右侧创意工作区。`,
    targetModule: null,
    moduleContent: '',
    adoptedModules: [],
    status: 'guide',
    roundIndex: 0,
    createdAt: new Date().toISOString(),
  };
}

router.post(
  '/student/personal-classes/:classId/ideation/hat-studio/debate/start',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireHatStudioTeam(req, res);
      if (!ctx) return;
      const state = await loadHatStudioMember(ctx.pool, ctx.teamId, ctx.sid);
      if (state.transcript.messages.length > 0) {
        return bad(req, res, 400, 40021, '讨论已开始，请在下方继续发言或点击「清空重开」');
      }
      // 开始讨论：不立刻调模型，先插入引导语，等学生描述创意后再进入六帽引导
      const studentDisplayName = String(req.body?.studentDisplayName || '同学').trim() || '同学';
      const guide = buildHatStudioGuideMessage(studentDisplayName);
      const transcript = { messages: [guide], roundCount: 0 };
      await upsertHatStudioMember(ctx.pool, ctx.teamId, ctx.sid, state.draft, transcript);
      return ok(req, res, {
        roundMessages: [mapHatStudioMessage(guide)],
        studio: buildHatStudioApiPayload(state.draft, transcript),
        awaitingStudentIdea: true,
      });
    } catch (e) {
      logError(`POST hat-studio debate/start traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

/** 清空本轮讨论记录并重新插入引导语，便于重新开始 */
router.post(
  '/student/personal-classes/:classId/ideation/hat-studio/reset',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireHatStudioTeam(req, res);
      if (!ctx) return;
      const state = await loadHatStudioMember(ctx.pool, ctx.teamId, ctx.sid);
      const studentDisplayName = String(req.body?.studentDisplayName || '同学').trim() || '同学';
      const clearDraft = req.body?.clearDraft === true;
      const guide = buildHatStudioGuideMessage(studentDisplayName);
      const transcript = { messages: [guide], roundCount: 0 };
      const nextDraft = clearDraft ? defaultHatStudioDraft() : state.draft;
      await upsertHatStudioMember(ctx.pool, ctx.teamId, ctx.sid, nextDraft, transcript);
      return ok(req, res, {
        roundMessages: [mapHatStudioMessage(guide)],
        studio: buildHatStudioApiPayload(nextDraft, transcript),
        awaitingStudentIdea: true,
      });
    } catch (e) {
      logError(`POST hat-studio reset traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.post(
  '/student/personal-classes/:classId/ideation/hat-studio/debate/round',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireHatStudioTeam(req, res);
      if (!ctx) return;
      const userMessage = String(req.body?.userMessage ?? '').trim();
      if (parseMentionedHatFromText(userMessage)) {
        return bad(req, res, 400, 40022, '已 @ 某顶帽子，请使用单帽回复接口');
      }
      if (!userMessage) return bad(req, res, 400, 40004, '请先描述你的创意或继续发言');
      const state = await loadHatStudioMember(ctx.pool, ctx.teamId, ctx.sid);
      if (!state.transcript.messages.length) {
        return bad(req, res, 400, 40023, '请先点击开始讨论');
      }

      let transcript = { ...state.transcript, messages: [...state.transcript.messages] };
      const transcriptStartLen = transcript.messages.length;
      transcript.messages.push({
        id: randomUUID(),
        hat: 'user',
        content: userMessage,
        targetModule: null,
        moduleContent: '',
        adoptedModules: [],
        roundIndex: transcript.roundCount,
        createdAt: new Date().toISOString(),
      });

      const provider = await getEnabledProvider('multimodal');
      if (!provider) return bad(req, res, 400, 40011, '未配置已启用的多模态模型');

      const contextText = await loadHatStudioContextText(ctx.pool, ctx.teamId);
      const studentDisplayName = String(req.body?.studentDisplayName || '同学').trim() || '同学';
      const roundIndex = transcript.roundCount;
      const hatOrder = buildHatStudioRoundOrder();
      // 完整 transcript（含引导语 + 历史 + 本轮学生发言）传入模型，保证多轮不丢上下文
      const user = buildHatStudioRoundUserPrompt({
        contextText,
        transcriptMessages: transcript.messages,
        roundIndex,
        hatOrder,
        studentDisplayName,
        draftSnapshot: state.draft,
      });
      const raw = await runHatStudioJsonLlm(provider, HAT_STUDIO_ROUND_SYSTEM_PROMPT, user, {
        extraBody: buildNoThinkingExtraBody(provider),
      });
      const norm = parseHatStudioRoundFromLlmText(raw, hatOrder);
      if (norm.error) return bad(req, res, 400, 40016, norm.error);

      transcript = appendHatStudioRound(transcript, norm.messages, roundIndex);
      await upsertHatStudioMember(ctx.pool, ctx.teamId, ctx.sid, state.draft, transcript);
      const roundMessages = transcript.messages.slice(transcriptStartLen).map(mapHatStudioMessage);
      return ok(req, res, {
        roundMessages,
        studio: buildHatStudioApiPayload(state.draft, transcript),
      });
    } catch (e) {
      logError(`POST hat-studio debate/round traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, friendlyLlmErrorMessage(e));
    }
  }
);

router.post(
  '/student/personal-classes/:classId/ideation/hat-studio/debate/reply',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireHatStudioTeam(req, res);
      if (!ctx) return;
      const userMessage = String(req.body?.userMessage ?? '').trim();
      if (!userMessage) return bad(req, res, 400, 40004, '请输入发言内容');
      let mentionedHat = normalizeHatStudioHat(req.body?.hat);
      if (!mentionedHat) mentionedHat = parseMentionedHatFromText(userMessage);
      if (!mentionedHat) return bad(req, res, 400, 40024, '请 @ 某一顶帽子后再发言');

      const state = await loadHatStudioMember(ctx.pool, ctx.teamId, ctx.sid);
      if (!state.transcript.messages.length) {
        return bad(req, res, 400, 40023, '请先点击开始讨论');
      }

      let transcript = { ...state.transcript, messages: [...state.transcript.messages] };
      transcript.messages.push({
        id: randomUUID(),
        hat: 'user',
        content: userMessage,
        targetModule: null,
        moduleContent: '',
        adoptedModules: [],
        roundIndex: transcript.roundCount,
        createdAt: new Date().toISOString(),
      });

      const provider = await getEnabledProvider('multimodal');
      if (!provider) return bad(req, res, 400, 40011, '未配置已启用的多模态模型');

      const contextText = await loadHatStudioContextText(ctx.pool, ctx.teamId);
      const studentDisplayName = String(req.body?.studentDisplayName || '同学').trim() || '同学';
      const user = buildHatStudioSingleReplyUserPrompt({
        contextText,
        transcriptMessages: transcript.messages,
        mentionedHat,
        userMessage,
        studentDisplayName,
        draftSnapshot: state.draft,
      });
      const raw = await runHatStudioJsonLlm(provider, HAT_STUDIO_SINGLE_REPLY_SYSTEM_PROMPT, user);
      const norm = parseHatStudioSingleReplyFromLlmText(raw, mentionedHat);
      if (norm.error) return bad(req, res, 400, 40016, norm.error);

      const reply = {
        id: randomUUID(),
        hat: norm.message.hat,
        content: norm.message.content,
        targetModule: norm.message.targetModule,
        moduleContent: norm.message.moduleContent,
        fills: norm.message.fills,
        adoptedModules: [],
        roundIndex: transcript.roundCount,
        createdAt: new Date().toISOString(),
      };
      transcript.messages.push(reply);
      await upsertHatStudioMember(ctx.pool, ctx.teamId, ctx.sid, state.draft, transcript);
      return ok(req, res, {
        message: mapHatStudioMessage(reply),
        studio: buildHatStudioApiPayload(state.draft, transcript),
      });
    } catch (e) {
      logError(`POST hat-studio debate/reply traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, friendlyLlmErrorMessage(e));
    }
  }
);

router.put('/student/personal-classes/:classId/ideation/hat-studio/draft', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const ctx = await requireHatStudioTeam(req, res);
    if (!ctx) return;
    const moduleKey = String(req.body?.moduleKey || '').trim();
    const content = String(req.body?.content ?? '');
    if (!HAT_STUDIO_DRAFT_KEYS.includes(moduleKey)) {
      return bad(req, res, 400, 40004, '无效工作区字段');
    }
    const state = await loadHatStudioMember(ctx.pool, ctx.teamId, ctx.sid);
    state.draft[moduleKey] = { content, updatedBy: '学生编辑' };
    await upsertHatStudioMember(ctx.pool, ctx.teamId, ctx.sid, state.draft, state.transcript);
    return ok(req, res, buildHatStudioApiPayload(state.draft, state.transcript));
  } catch (e) {
    logError(`PUT hat-studio draft traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.post(
  '/student/personal-classes/:classId/ideation/hat-studio/messages/:messageId/adopt',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const ctx = await requireHatStudioTeam(req, res);
      if (!ctx) return;
      const messageId = String(req.params.messageId || '').trim();
      if (!messageId) return bad(req, res, 400, 40004, '参数无效');

      const state = await loadHatStudioMember(ctx.pool, ctx.teamId, ctx.sid);
      const msg = state.transcript.messages.find((m) => m.id === messageId);
      if (!msg) return bad(req, res, 404, 40404, '消息不存在');

      // 支持学生手动选择写入字段；可传 content 覆盖（从发言正文摘选）
      const reqKey = String(req.body?.moduleKey || '').trim();
      const overrideContent = String(req.body?.content || '').trim();
      let moduleKey = reqKey || msg.targetModule;
      let moduleContent = '';
      if (overrideContent) {
        moduleContent = overrideContent;
      } else if (msg.fills?.length && moduleKey) {
        const fill = msg.fills.find((f) => f.targetModule === moduleKey);
        moduleContent = fill?.moduleContent?.trim() || '';
      }
      if (!moduleContent) {
        moduleKey = reqKey || msg.targetModule;
        moduleContent = String(msg.moduleContent || '').trim();
      }
      if (!moduleContent && msg.hat !== 'user' && msg.status !== 'guide') {
        // 无结构化要点时，允许把发言正文写入所选工作区
        moduleContent = String(msg.content || '').trim().slice(0, 2000);
      }
      if (!moduleKey || !moduleContent) {
        return bad(req, res, 400, 40025, '请选择工作区字段，或该消息暂无可写入内容');
      }
      if (!HAT_STUDIO_DRAFT_KEYS.includes(moduleKey)) {
        return bad(req, res, 400, 40004, '无效工作区字段');
      }

      state.draft[moduleKey] = {
        content: moduleContent,
        updatedBy: HAT_STUDIO_UPDATED_BY[msg.hat] || msg.hat,
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
        ...state.transcript,
        messages: state.transcript.messages.map((m) =>
          m.id === messageId
            ? { ...m, adoptedModules, status: allAdopted ? 'adopted' : m.status }
            : m
        ),
      };
      await upsertHatStudioMember(ctx.pool, ctx.teamId, ctx.sid, state.draft, transcript);
      return ok(req, res, buildHatStudioApiPayload(state.draft, transcript));
    } catch (e) {
      logError(`POST hat-studio adopt traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

export default router;
