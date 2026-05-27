import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import { loadSurveyQuestions } from './marketResearchSurveyDb.js';

const UPLOAD_METHODS = ['用户访谈', '竞品分析', '行业报告', '数据爬取', '实地观察'];
const MAX_FILE_CHARS = 6000;
const MAX_TOTAL_UPLOAD_CHARS = 24000;
const MAX_FILL_SAMPLES = 8;

function uploadAbsPath(uploadRoot, storageKey) {
  return path.join(uploadRoot, storageKey);
}

async function readUploadText(absPath, originalFilename) {
  const ext = path.extname(originalFilename || '').toLowerCase();
  if (ext === '.txt') {
    return fs.readFileSync(absPath, 'utf8');
  }
  if (ext === '.docx') {
    const buf = fs.readFileSync(absPath);
    const { value } = await mammoth.extractRawText({ buffer: buf });
    return value || '';
  }
  return '';
}

function truncateText(text, max) {
  const t = String(text || '').trim();
  if (t.length <= max) return { text: t, truncated: false };
  return { text: `${t.slice(0, max)}…`, truncated: true };
}

function bumpCount(map, key) {
  const k = String(key ?? '').trim() || '（空）';
  map.set(k, (map.get(k) || 0) + 1);
}

function aggregateAnswersForQuestion(q, answersList) {
  const type = q.type;
  const qid = q.id;
  if (type === '填空') {
    const samples = [];
    for (const ans of answersList) {
      const v = ans[qid];
      if (v == null || v === '') continue;
      samples.push(String(v).trim());
      if (samples.length >= MAX_FILL_SAMPLES) break;
    }
    return { type, text: q.text, fillSamples: samples, counts: null };
  }
  const counts = new Map();
  for (const ans of answersList) {
    const v = ans[qid];
    if (v == null || v === '') continue;
    if (type === '多选' && Array.isArray(v)) {
      for (const item of v) bumpCount(counts, item);
    } else {
      bumpCount(counts, v);
    }
  }
  const countsObj = {};
  for (const [k, n] of counts.entries()) countsObj[k] = n;
  return { type, text: q.text, counts: countsObj, fillSamples: null };
}

export async function buildMarketResearchContext(pool, teamId, uploadRoot) {
  const planRow = await pool.query(
    `SELECT goal, methods, plan_start_date, plan_end_date, assignments
     FROM teacher_personal_class_team_market_research_plans WHERE team_id = $1`,
    [teamId]
  );
  const plan = planRow.rows[0] || null;

  const { rows: surveyRows } = await pool.query(
    `SELECT id, title, status, collected_count
     FROM teacher_personal_class_team_surveys WHERE team_id = $1 ORDER BY id ASC`,
    [teamId]
  );

  let totalCollected = 0;
  let activeSurveyCount = 0;
  const surveyBlocks = [];

  for (const sv of surveyRows) {
    totalCollected += Number(sv.collected_count || 0);
    if (sv.status === '进行中') activeSurveyCount += 1;
    const questions = await loadSurveyQuestions(pool, sv.id);
    const { rows: respRows } = await pool.query(
      `SELECT answers FROM teacher_personal_class_team_survey_responses WHERE survey_id = $1`,
      [sv.id]
    );
    const answersList = respRows.map((r) =>
      r.answers && typeof r.answers === 'object' && !Array.isArray(r.answers) ? r.answers : {}
    );
    const aggregates = questions.map((q) => aggregateAnswersForQuestion(q, answersList));
    surveyBlocks.push({
      title: sv.title,
      status: sv.status,
      responseCount: answersList.length,
      questionAggregates: aggregates,
    });
  }

  const uploadBlocks = [];
  let interviewUploadCount = 0;
  let totalUploadChars = 0;

  for (const method of UPLOAD_METHODS) {
    const { rows } = await pool.query(
      `SELECT id, original_filename, storage_key, created_at
       FROM teacher_personal_class_team_market_research_uploads
       WHERE team_id = $1 AND method = $2
       ORDER BY created_at DESC`,
      [teamId, method]
    );
    if (method === '用户访谈') interviewUploadCount = rows.length;
    const files = [];
    for (const row of rows) {
      if (totalUploadChars >= MAX_TOTAL_UPLOAD_CHARS) break;
      const filename = row.original_filename || 'file';
      const abs = uploadAbsPath(uploadRoot, row.storage_key);
      let content = '';
      let readError = '';
      if (fs.existsSync(abs)) {
        try {
          content = await readUploadText(abs, filename);
        } catch (e) {
          readError = e.message || '读取失败';
        }
      } else {
        readError = '文件不存在';
      }
      const budget = Math.min(MAX_FILE_CHARS, MAX_TOTAL_UPLOAD_CHARS - totalUploadChars);
      const { text, truncated } = truncateText(content, budget);
      totalUploadChars += text.length;
      files.push({
        filename,
        uploadedAt: row.created_at ? new Date(row.created_at).toISOString() : '',
        truncated,
        readError: readError || undefined,
        excerpt: text,
      });
    }
    if (files.length) uploadBlocks.push({ method, files });
  }

  return {
    planSummary: plan
      ? {
          goal: plan.goal || '',
          methods: Array.isArray(plan.methods) ? plan.methods : plan.methods,
          startDate: plan.plan_start_date ? String(plan.plan_start_date).slice(0, 10) : '',
          endDate: plan.plan_end_date ? String(plan.plan_end_date).slice(0, 10) : '',
        }
      : null,
    stats: {
      totalCollected,
      activeSurveyCount,
      interviewUploadCount,
    },
    surveys: surveyBlocks,
    uploads: uploadBlocks,
  };
}

export function formatContextForPrompt(ctx) {
  const lines = [];
  lines.push('【调研计划】');
  if (ctx.planSummary) {
    lines.push(`目标：${ctx.planSummary.goal || '（未填写）'}`);
    lines.push(
      `方法：${Array.isArray(ctx.planSummary.methods) ? ctx.planSummary.methods.join('、') : '（未选择）'}`
    );
    lines.push(`时间：${ctx.planSummary.startDate || ''} 至 ${ctx.planSummary.endDate || ''}`);
  } else {
    lines.push('（尚未保存调研计划）');
  }

  lines.push('\n【问卷回收概况】');
  lines.push(`回收总量：${ctx.stats.totalCollected} 份；进行中问卷数：${ctx.stats.activeSurveyCount}`);
  if (!ctx.surveys.length) {
    lines.push('（无问卷）');
  } else {
    for (const s of ctx.surveys) {
      lines.push(`\n问卷《${s.title}》状态=${s.status} 答卷数=${s.responseCount}`);
      for (const agg of s.questionAggregates) {
        if (agg.fillSamples?.length) {
          lines.push(`- [${agg.type}] ${agg.text} 样本：${agg.fillSamples.join(' | ')}`);
        } else if (agg.counts && Object.keys(agg.counts).length) {
          lines.push(
            `- [${agg.type}] ${agg.text} 统计：${JSON.stringify(agg.counts)}`
          );
        } else {
          lines.push(`- [${agg.type}] ${agg.text} （无有效作答）`);
        }
      }
    }
  }

  lines.push('\n【方法上传文档】');
  lines.push(`用户访谈上传文件数：${ctx.stats.interviewUploadCount}`);
  if (!ctx.uploads.length) {
    lines.push('（各方法均无上传文档）');
  } else {
    for (const block of ctx.uploads) {
      lines.push(`\n## ${block.method}`);
      for (const f of block.files) {
        lines.push(`文件：${f.filename} ${f.uploadedAt}${f.truncated ? '（内容已截断）' : ''}`);
        if (f.readError) lines.push(`读取：${f.readError}`);
        else if (f.excerpt) lines.push(f.excerpt);
      }
    }
  }

  return lines.join('\n');
}

export { UPLOAD_METHODS };
