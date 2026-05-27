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

async function loadSurveyBlocks(pool, teamId, surveyIds = null) {
  const params = [teamId];
  let sql = `SELECT id, title, status, collected_count
     FROM teacher_personal_class_team_surveys WHERE team_id = $1`;
  if (surveyIds?.length) {
    sql += ` AND id = ANY($2::bigint[])`;
    params.push(surveyIds);
  }
  sql += ` ORDER BY id ASC`;
  const { rows: surveyRows } = await pool.query(sql, params);

  let totalCollected = 0;
  let activeSurveyCount = 0;
  const surveyBlocks = [];

  for (const sv of surveyRows) {
    totalCollected += Number(sv.collected_count || 0);
    if (sv.status === 'published') activeSurveyCount += 1;
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

  return { surveyBlocks, stats: { totalCollected, activeSurveyCount } };
}

async function loadUploadBlocks(pool, teamId, uploadRoot) {
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

  return { uploadBlocks, interviewUploadCount };
}

export function projectTopicTextFromRow(row) {
  if (!row) return '（尚未提交项目选题）';
  const lines = [
    `项目名称：${row.project_name || '（未填）'}`,
    `项目方向：${row.project_direction || '（未填）'}`,
    `项目描述：${row.project_description || '（未填）'}`,
    `目标用户：${row.target_users || '（未填）'}`,
    `核心价值主张：${row.core_value || '（未填）'}`,
    `核心问题：${row.core_problem || '（未填）'}`,
    `解决方案概述：${row.solution_overview || '（未填）'}`,
  ];
  if (row.market_size) lines.push(`市场规模：${row.market_size}`);
  if (row.competitive_advantage) lines.push(`竞争优势：${row.competitive_advantage}`);
  return lines.join('\n');
}

export async function buildMarketResearchContext(pool, teamId, uploadRoot) {
  const planRow = await pool.query(
    `SELECT goal, methods, plan_start_date, plan_end_date, assignments
     FROM teacher_personal_class_team_market_research_plans WHERE team_id = $1`,
    [teamId]
  );
  const plan = planRow.rows[0] || null;

  const { surveyBlocks, stats: surveyStats } = await loadSurveyBlocks(pool, teamId);
  const { uploadBlocks, interviewUploadCount } = await loadUploadBlocks(pool, teamId, uploadRoot);

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
      totalCollected: surveyStats.totalCollected,
      activeSurveyCount: surveyStats.activeSurveyCount,
      interviewUploadCount,
    },
    surveys: surveyBlocks,
    uploads: uploadBlocks,
  };
}

export async function buildSurveyOnlyContext(pool, teamId, surveyIds = null) {
  const planRow = await pool.query(
    `SELECT goal, methods, plan_start_date, plan_end_date
     FROM teacher_personal_class_team_market_research_plans WHERE team_id = $1`,
    [teamId]
  );
  const plan = planRow.rows[0] || null;
  const { surveyBlocks, stats } = await loadSurveyBlocks(pool, teamId, surveyIds);
  return {
    planSummary: plan
      ? {
          goal: plan.goal || '',
          startDate: plan.plan_start_date ? String(plan.plan_start_date).slice(0, 10) : '',
          endDate: plan.plan_end_date ? String(plan.plan_end_date).slice(0, 10) : '',
        }
      : null,
    stats,
    surveys: surveyBlocks,
  };
}

function appendSurveySections(lines, ctx) {
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
          lines.push(`- [${agg.type}] ${agg.text} 统计：${JSON.stringify(agg.counts)}`);
        } else {
          lines.push(`- [${agg.type}] ${agg.text} （无有效作答）`);
        }
      }
    }
  }
}

export function formatSurveyOnlyForPrompt(ctx) {
  const lines = [];
  lines.push('【调研计划摘要】');
  if (ctx.planSummary) {
    lines.push(`目标：${ctx.planSummary.goal || '（未填写）'}`);
    lines.push(`时间：${ctx.planSummary.startDate || ''} 至 ${ctx.planSummary.endDate || ''}`);
  } else {
    lines.push('（尚未保存调研计划）');
  }
  appendSurveySections(lines, ctx);
  return lines.join('\n');
}

function countsToChartItems(counts) {
  if (!counts || typeof counts !== 'object') return [];
  return Object.entries(counts)
    .map(([label, value]) => {
      const n = Number(value);
      if (!label.trim() || !Number.isFinite(n) || n < 0) return null;
      return { label: String(label).trim(), value: Math.round(n) };
    })
    .filter(Boolean);
}

function chartSlotForQuestion(text) {
  const t = String(text || '');
  if (/年龄|岁数|年龄段|年级/.test(t)) return 'ageDistribution';
  if (/消费|支出|花费|付费|价格|预算/.test(t)) return 'spendingDistribution';
  if (/满意|满意度/.test(t)) return 'satisfactionDistribution';
  if (/改进|需求|优先|功能|意愿|倾向|痛点|希望/.test(t)) return 'improvementRanking';
  return null;
}

/** 从问卷题目统计补全 AI 未填写的 charts（单选/多选/评分聚合） */
export function deriveChartsFromSurveyBlocks(surveyBlocks) {
  const mergeMap = {
    ageDistribution: new Map(),
    spendingDistribution: new Map(),
    satisfactionDistribution: new Map(),
    improvementRanking: new Map(),
  };

  for (const survey of surveyBlocks || []) {
    for (const agg of survey.questionAggregates || []) {
      const slot = chartSlotForQuestion(agg.text);
      if (!slot) continue;
      const items = countsToChartItems(agg.counts);
      if (!items.length) continue;
      const target = mergeMap[slot];
      for (const { label, value } of items) {
        target.set(label, (target.get(label) || 0) + value);
      }
    }
  }

  const toArr = (map, asPercent = false) => {
    const entries = [...map.entries()].map(([label, value]) => ({ label, value }));
    if (!entries.length) return [];
    if (!asPercent) return entries;
    const max = Math.max(...entries.map((e) => e.value), 1);
    return entries.map((e) => ({ label: e.label, value: Math.round((e.value / max) * 100) }));
  };

  return {
    ageDistribution: toArr(mergeMap.ageDistribution),
    spendingDistribution: toArr(mergeMap.spendingDistribution),
    satisfactionDistribution: toArr(mergeMap.satisfactionDistribution),
    improvementRanking: toArr(mergeMap.improvementRanking, true),
  };
}

export function mergeAnalysisCharts(aiCharts, derived) {
  const keys = [
    'ageDistribution',
    'spendingDistribution',
    'satisfactionDistribution',
    'improvementRanking',
  ];
  const out = { ...(aiCharts || {}) };
  for (const key of keys) {
    const ai = Array.isArray(out[key]) ? out[key] : [];
    const der = Array.isArray(derived?.[key]) ? derived[key] : [];
    out[key] = ai.length ? ai : der;
  }
  return out;
}

export function formatUploadsForPrompt(uploadBlocks) {
  const lines = ['【调研数据上传材料】'];
  if (!uploadBlocks?.length) {
    lines.push('（各方法均无上传文档）');
    return lines.join('\n');
  }
  for (const block of uploadBlocks) {
    lines.push(`\n## ${block.method}`);
    for (const f of block.files) {
      lines.push(`文件：${f.filename} ${f.uploadedAt}${f.truncated ? '（内容已截断）' : ''}`);
      if (f.readError) lines.push(`读取：${f.readError}`);
      else if (f.excerpt) lines.push(f.excerpt);
    }
  }
  return lines.join('\n');
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

  appendSurveySections(lines, ctx);

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
