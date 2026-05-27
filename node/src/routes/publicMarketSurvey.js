import { Router } from 'express';
import { randomUUID } from 'crypto';
import { getPool } from '../lib/db.js';
import { logError } from '../lib/logError.js';
import { loadSurveyQuestions } from '../lib/marketResearchSurveyDb.js';

const router = Router();

function ok(req, res, data, message = 'OK') {
  return res.json({ code: 0, message, data, traceId: req.traceId });
}

function bad(req, res, status, code, message) {
  return res.status(status).json({ code, message, data: null, traceId: req.traceId });
}

function isSurveyClosed(row) {
  if (!row?.closes_at) return false;
  return new Date(row.closes_at).getTime() <= Date.now();
}

async function loadPublishedSurvey(pool, slug) {
  const { rows } = await pool.query(
    `SELECT id, title, status, collected_count, closes_at
     FROM teacher_personal_class_team_surveys
     WHERE public_slug = $1`,
    [slug]
  );
  return rows[0] || null;
}

function validateAnswers(questions, answers) {
  if (!answers || typeof answers !== 'object') return { error: '请填写问卷' };
  for (const q of questions) {
    const val = answers[q.id];
    if (q.type === '填空') {
      if (!String(val ?? '').trim()) return { error: `请完成：${q.text}` };
      continue;
    }
    if (q.type === '评分') {
      const n = Number(val);
      if (!Number.isFinite(n) || n < 1 || n > 5) return { error: `请完成评分题：${q.text}` };
      continue;
    }
    if (q.type === '单选') {
      if (!String(val ?? '').trim()) return { error: `请选择：${q.text}` };
      continue;
    }
    if (q.type === '多选') {
      if (!Array.isArray(val) || !val.length) return { error: `请选择：${q.text}` };
    }
  }
  return { answers };
}

router.get('/public/market-surveys/:slug', async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim();
    if (!slug) return bad(req, res, 400, 40003, '参数无效');
    const pool = getPool();
    const survey = await loadPublishedSurvey(pool, slug);
    if (!survey) return bad(req, res, 404, 40403, '问卷不存在');
    if (survey.status === 'withdrawn') {
      return ok(req, res, { title: survey.title, status: 'withdrawn', questions: [] });
    }
    if (survey.status !== 'published') {
      return bad(req, res, 404, 40404, '问卷未发布');
    }
    if (isSurveyClosed(survey)) {
      return ok(req, res, { title: survey.title, status: 'expired', questions: [] });
    }
    const questions = await loadSurveyQuestions(pool, survey.id);
    return ok(req, res, {
      title: survey.title,
      status: 'published',
      questions,
    });
  } catch (e) {
    logError(`GET public market-survey traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.post('/public/market-surveys/:slug/responses', async (req, res) => {
  const client = await getPool().connect();
  let open = false;
  try {
    const slug = String(req.params.slug || '').trim();
    if (!slug) return bad(req, res, 400, 40003, '参数无效');
    const survey = await loadPublishedSurvey(client, slug);
    if (!survey) return bad(req, res, 404, 40403, '问卷不存在');
    if (survey.status !== 'published') {
      return bad(req, res, 400, 40005, '问卷已暂停或未发布');
    }
    if (isSurveyClosed(survey)) {
      return bad(req, res, 400, 40006, '问卷已截止，不再接受提交');
    }
    const questions = await loadSurveyQuestions(client, survey.id);
    const v = validateAnswers(questions, req.body?.answers);
    if (v.error) return bad(req, res, 400, 40004, v.error);

    await client.query('BEGIN');
    open = true;
    const respondentToken = randomUUID().replace(/-/g, '');
    await client.query(
      `INSERT INTO teacher_personal_class_team_survey_responses (survey_id, answers, respondent_token)
       VALUES ($1, $2::jsonb, $3)`,
      [survey.id, JSON.stringify(v.answers), respondentToken]
    );
    await client.query(
      `UPDATE teacher_personal_class_team_surveys
       SET collected_count = collected_count + 1, updated_at = now()
       WHERE id = $1`,
      [survey.id]
    );
    await client.query('COMMIT');
    open = false;
    return ok(req, res, { submitted: true });
  } catch (e) {
    if (open) await client.query('ROLLBACK').catch(() => {});
    logError(`POST public market-survey response traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  } finally {
    client.release();
  }
});

export default router;
