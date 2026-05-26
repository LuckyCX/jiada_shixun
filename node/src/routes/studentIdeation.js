import { Router } from 'express';
import { getPool } from '../lib/db.js';
import { logError } from '../lib/logError.js';
import { requireAuth, requireStudent } from '../middleware/auth.js';
import { chatCompletion, friendlyLlmErrorMessage, getEnabledProvider, logPromptToConsole } from '../lib/llmGateway.js';
import {
  getIdeationMethodPrompt,
  IDEATION_METHOD_LABELS,
} from '../lib/ideationPrompts.js';

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
  return { id: String(rows[0].id), name: rows[0].name };
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

function textArray(value, field) {
  if (!Array.isArray(value)) throw new Error(`AI 未返回有效 ${field}`);
  const list = value.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 5);
  if (list.length < 2) throw new Error(`AI 返回 ${field} 数量不足`);
  return list;
}

function normalizeAnalysis(parsed) {
  if (!parsed || typeof parsed !== 'object') throw new Error('AI 未返回有效 JSON');
  const overallScore = toScore(parsed.overallScore, { min: 0, max: 100, integer: true });
  const novelty = toScore(parsed.novelty, { min: 0, max: 5 });
  const feasibility = toScore(parsed.feasibility, { min: 0, max: 5 });
  const marketPotential = toScore(parsed.marketPotential, { min: 0, max: 5 });
  const innovation = toScore(parsed.innovation, { min: 0, max: 5 });
  const summary = String(parsed.summary || '').trim();
  if (
    overallScore == null ||
    novelty == null ||
    feasibility == null ||
    marketPotential == null ||
    innovation == null ||
    !summary
  ) {
    throw new Error('AI 返回的评分字段不完整');
  }
  return {
    title: String(parsed.title || '').trim(),
    description: String(parsed.description || '').trim(),
    overallScore,
    novelty,
    feasibility,
    marketPotential,
    innovation,
    summary,
    strengths: textArray(parsed.strengths, 'strengths'),
    weaknesses: textArray(parsed.weaknesses, 'weaknesses'),
    suggestions: textArray(parsed.suggestions, 'suggestions'),
    tags: textArray(parsed.tags, 'tags'),
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
  const { rows } = await pool.query(
    `WITH RECURSIVE
       team_members AS (
         SELECT m.student_id, COALESCE(NULLIF(u.real_name, ''), u.username, '成员') AS name
         FROM teacher_personal_class_team_members m
         JOIN users u ON u.id = m.student_id
         WHERE m.team_id = $1
       ),
       ideation_nodes AS (
         SELECT n.id
         FROM course_resource_nodes n
         WHERE n.module_key = 'ideation'
           AND n.level = 3
           AND n.status = 'published'
       ),
       ideation_resources AS (
         SELECT DISTINCT f.content_hash
         FROM course_resource_files f
         JOIN ideation_nodes n ON n.id = f.node_id
         WHERE COALESCE(f.content_hash, '') <> ''
       ),
       ideation_knowledge AS (
         SELECT DISTINCT l.knowledge_point_id
         FROM course_resource_node_knowledge_points l
         JOIN ideation_nodes n ON n.id = l.node_id
       )
     SELECT DISTINCT tm.student_id AS "studentId", tm.name
     FROM team_members tm
     WHERE EXISTS (
       SELECT 1
       FROM ideation_resources ir
       WHERE NOT EXISTS (
         SELECT 1
         FROM student_course_resource_progress p
         WHERE p.user_id = tm.student_id
           AND p.content_hash = ir.content_hash
           AND p.completed_at IS NOT NULL
       )
     )
     OR EXISTS (
       SELECT 1
       FROM ideation_knowledge ik
       WHERE NOT EXISTS (
         SELECT 1
         FROM quiz_attempts a
         JOIN quizzes q ON q.id = a.quiz_id
         WHERE a.user_id = tm.student_id
           AND a.passed = true
           AND q.knowledge_point_id = ik.knowledge_point_id
       )
     )
     ORDER BY tm.name ASC`,
    [teamId]
  );
  return rows.map((row) => ({
    studentId: String(row.studentId),
    name: row.name,
  }));
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
    if (!team) return bad(req, res, 400, 40014, '教师确认组队后可确定项目主题');
    const incompleteMembers = await loadIncompleteIdeationMembers(pool, Number(team.id));
    return ok(req, res, { incompleteMembers });
  } catch (e) {
    logError(`GET ideation team prerequisites traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
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

    const userPrompt = `方法：${IDEATION_METHOD_LABELS[methodKey]}\n学生原始表单：\n${JSON.stringify(formPayload, null, 2)}`;
    logPromptToConsole(provider, prompt, userPrompt);

    const raw = await chatCompletion({
      provider,
      system: prompt,
      user: userPrompt,
      jsonMode: true,
    });
    const analysis = normalizeAnalysis(extractJsonObject(raw));

    const submittedTitle = String(formPayload.title || '').trim();
    const submittedDescription = String(formPayload.description || formPayload.solution || '').trim();
    const title = methodKey === 'ai' ? analysis.title : submittedTitle;
    const description = methodKey === 'ai' ? analysis.description : submittedDescription;
    if (!title || !description) return bad(req, res, 400, 40016, 'AI 未返回有效创意内容');

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
        JSON.stringify(formPayload),
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

export default router;
