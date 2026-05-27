import { SURVEY_QUESTION_TYPES } from './marketResearchSurveyPrompts.js';

export function mapSurveyStatusToClient(status) {
  if (status === 'published') return '进行中';
  if (status === 'withdrawn') return '已撤回';
  return '草稿';
}

export function validateQuestionsInput(questions) {
  if (!Array.isArray(questions) || !questions.length) {
    return { error: '请至少添加一道题目' };
  }
  const normalized = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!q || typeof q !== 'object') return { error: '题目格式无效' };
    const text = String(q.text ?? q.questionText ?? '').trim();
    const type = String(q.type ?? q.questionType ?? '').trim();
    if (!text) return { error: `第 ${i + 1} 题请填写题干` };
    if (!SURVEY_QUESTION_TYPES.includes(type)) return { error: `第 ${i + 1} 题题型无效` };
    let options = Array.isArray(q.options) ? q.options.map((o) => String(o).trim()).filter(Boolean) : [];
    if (type === '单选' || type === '多选') {
      if (options.length < 2) return { error: `第 ${i + 1} 题至少需要 2 个选项` };
      if (options.length > 12) options = options.slice(0, 12);
    } else {
      options = [];
    }
    normalized.push({ text, type, options });
  }
  return { questions: normalized };
}

export async function loadSurveyQuestions(pool, surveyId) {
  const { rows } = await pool.query(
    `SELECT id, question_text, question_type, options, sort_order
     FROM teacher_personal_class_team_survey_questions
     WHERE survey_id = $1
     ORDER BY sort_order ASC, id ASC`,
    [surveyId]
  );
  return rows.map((r) => ({
    id: String(r.id),
    text: r.question_text,
    type: r.question_type,
    options: Array.isArray(r.options) ? r.options : [],
  }));
}

export function mapSurveyRow(row, questions, publicBasePath) {
  const slug = row.public_slug || '';
  const link =
    slug && publicBasePath ? `${publicBasePath.replace(/\/$/, '')}/s/${slug}` : '';
  return {
    id: String(row.id),
    title: row.title || '',
    status: mapSurveyStatusToClient(row.status),
    questions: questions || [],
    collected: Number(row.collected_count || 0),
    link,
    publicSlug: slug,
    source: row.source === 'ai' ? 'ai' : 'manual',
    fromPlan: row.source === 'ai',
    createdAt: row.created_at ? new Date(row.created_at).toLocaleDateString('zh-CN') : '',
  };
}

export async function replaceSurveyQuestions(client, surveyId, questions) {
  await client.query(`DELETE FROM teacher_personal_class_team_survey_questions WHERE survey_id = $1`, [
    surveyId,
  ]);
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    await client.query(
      `INSERT INTO teacher_personal_class_team_survey_questions
         (survey_id, question_text, question_type, options, sort_order)
       VALUES ($1, $2, $3, $4::jsonb, $5)`,
      [surveyId, q.text, q.type, JSON.stringify(q.options || []), i]
    );
  }
}

export async function loadSavedPlanRow(pool, teamId) {
  const { rows } = await pool.query(
    `SELECT goal, methods, plan_start_date, plan_end_date, assignments, saved_at
     FROM teacher_personal_class_team_market_research_plans
     WHERE team_id = $1`,
    [teamId]
  );
  return rows[0] || null;
}

function parseJsonField(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return [];
    }
  }
  return val || [];
}

export function planPayloadFromRow(row, members) {
  if (!row) return null;
  const assignments = parseJsonField(row.assignments);
  const memberMap = new Map((members || []).map((m) => [String(m.id), m.name]));
  const assignmentsReadable = assignments.map((a) => ({
    role: a.role,
    members: (a.memberIds || []).map((id) => memberMap.get(String(id)) || id),
  }));
  return {
    goal: row.goal || '',
    methods: parseJsonField(row.methods),
    startDate: row.plan_start_date ? String(row.plan_start_date).slice(0, 10) : '',
    endDate: row.plan_end_date ? String(row.plan_end_date).slice(0, 10) : '',
    assignments: assignmentsReadable,
  };
}

export async function getSurveyForTeam(pool, surveyId, teamId) {
  const { rows } = await pool.query(
    `SELECT id, team_id, title, status, collected_count, public_slug, source, created_at
     FROM teacher_personal_class_team_surveys
     WHERE id = $1 AND team_id = $2`,
    [surveyId, teamId]
  );
  return rows[0] || null;
}
