/**
 * 团队实训驾驶舱：阶段过程分 / 总评 AI
 * 组队不参与评分；略过阶段权重均摊到其余评分阶段。
 */

import { getPool } from './db.js';
import { logError } from './logError.js';
import { getEnabledProvider, chatCompletion } from './llmGateway.js';
import { JSON_OUTPUT_HARD_RULES } from './llmJsonOutputRules.js';
import { loadSkippedModuleKeys } from './courseWorkflow.js';

/** 评分阶段基础权重（相对值，组队不在内；未略过时归一化） */
export const SCORING_BASE_WEIGHTS = {
  ideation: 15,
  market: 15,
  product: 15,
  business: 15,
  simulation: 10,
  plan: 20,
};

export const SCORING_MODULE_KEYS = Object.keys(SCORING_BASE_WEIGHTS);

export const PROCESS_DIMENSIONS = [
  'participationDepth',
  'aiCollaborationQuality',
  'outputCompleteness',
  'logicAndEvidence',
  'innovationAndRisk',
];

export const PROCESS_DIM_WEIGHTS = {
  participationDepth: 0.2,
  aiCollaborationQuality: 0.2,
  outputCompleteness: 0.25,
  logicAndEvidence: 0.2,
  innovationAndRisk: 0.15,
};

const MODULE_LABELS = {
  ideation: '创新思维与创意生成',
  market: '市场调研与用户画像',
  product: '产品设计与原型',
  business: '商业模式设计',
  simulation: '项目仿真与角色推荐',
  plan: '商业计划书与PPT',
};

function extractJsonObject(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    /* continue */
  }
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {
      /* continue */
    }
  }
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * @param {Iterable<string>} enabledScoringKeys 当前未略过的评分模块
 * @returns {Record<string, number>} 各模块权重，合计 1
 */
export function resolveScoringWeights(enabledScoringKeys) {
  const keys = SCORING_MODULE_KEYS.filter((k) => [...enabledScoringKeys].includes(k));
  const out = {};
  if (!keys.length) return out;
  let sum = 0;
  for (const k of keys) sum += SCORING_BASE_WEIGHTS[k] || 0;
  if (sum <= 0) {
    const eq = 1 / keys.length;
    for (const k of keys) out[k] = eq;
    return out;
  }
  for (const k of keys) out[k] = (SCORING_BASE_WEIGHTS[k] || 0) / sum;
  return out;
}

async function runJsonLlm(system, user) {
  const provider = await getEnabledProvider('multimodal');
  if (!provider) throw new Error('未配置已启用的多模态模型');
  let raw;
  try {
    raw = await chatCompletion({ provider, system, user, jsonMode: true });
  } catch (e) {
    const sm = String(e?.message || '');
    if (!/response_format|json_object|json mode/i.test(sm)) throw e;
    raw = await chatCompletion({ provider, system, user, jsonMode: false });
  }
  const parsed = extractJsonObject(raw);
  if (!parsed) throw new Error('AI 返回无法解析为 JSON');
  return { parsed, raw };
}

function clampScore(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v * 10) / 10));
}

function composeTotalFromDimensions(dims) {
  let sum = 0;
  let wSum = 0;
  for (const k of PROCESS_DIMENSIONS) {
    const w = PROCESS_DIM_WEIGHTS[k] || 0;
    sum += clampScore(dims[k]) * w;
    wSum += w;
  }
  return wSum > 0 ? clampScore(sum / wSum) : 0;
}

/**
 * 判断某评分阶段是否已完成（与驾驶舱触发条件一致）
 */
export async function isScoringStageComplete(pool, classId, teamId, moduleKey) {
  const key = String(moduleKey || '');
  if (key === 'ideation') {
    const { rows } = await pool.query(
      `SELECT status FROM teacher_personal_class_team_project_topics WHERE team_id = $1 LIMIT 1`,
      [teamId]
    );
    return rows[0]?.status === 'approved';
  }
  if (key === 'market') {
    const { rowCount } = await pool.query(
      `SELECT 1 FROM teacher_personal_class_team_market_report_uploads WHERE team_id = $1 LIMIT 1`,
      [teamId]
    );
    return rowCount > 0;
  }
  if (key === 'product') {
    const { rowCount } = await pool.query(
      `SELECT 1 FROM teacher_personal_class_team_product_prototype_uploads WHERE team_id = $1 LIMIT 1`,
      [teamId]
    );
    return rowCount > 0;
  }
  if (key === 'business') {
    const { rows: bmRows } = await pool.query(
      `SELECT swot_saved_at, marketing_saved_at, finance_saved_at, bmc_canvas_saved_at, bmc_review_status
       FROM teacher_personal_class_team_business_model_workspace WHERE team_id = $1 LIMIT 1`,
      [teamId]
    );
    const bm = bmRows[0];
    const { rows: reviewRows } = await pool.query(
      `SELECT COUNT(*)::int AS c, COALESCE(AVG(ai_score),0)::float AS avg_score
       FROM teacher_personal_class_team_bmc_ai_reviews WHERE team_id = $1`,
      [teamId]
    ).catch(() => ({ rows: [{ c: 0, avg_score: 0 }] }));
    const reviewCount = Number(reviewRows[0]?.c || 0);
    // 五件套改为：SWOT + 营销 + 财务 + 画布上传 + 教师审核通过（取消战情室九格）
    const parts =
      (bm?.swot_saved_at ? 1 : 0) +
      (bm?.marketing_saved_at ? 1 : 0) +
      (bm?.finance_saved_at ? 1 : 0) +
      (bm?.bmc_canvas_saved_at ? 1 : 0) +
      (String(bm?.bmc_review_status || '') === 'approved' ? 1 : 0);
    // 审查次数仅作过程证据，完成判定仍看五件齐
    void reviewCount;
    return parts >= 5;
  }
  if (key === 'simulation') {
    const { rowCount } = await pool.query(
      `SELECT 1 FROM teacher_personal_class_team_role_simulation_run_records
       WHERE teacher_personal_class_id = $1 AND team_id = $2 LIMIT 1`,
      [classId, teamId]
    );
    return rowCount > 0;
  }
  if (key === 'plan') {
    const { rowCount } = await pool.query(
      `SELECT 1 FROM teacher_personal_class_team_business_plan_submissions
       WHERE teacher_personal_class_id = $1 AND team_id = $2 LIMIT 1`,
      [classId, teamId]
    );
    return rowCount > 0;
  }
  return false;
}

async function buildEvidence(pool, classId, teamId, moduleKey) {
  const evidence = { moduleKey, gatheredAt: new Date().toISOString() };

  const { rows: logStats } = await pool.query(
    `SELECT scene, role, COUNT(*)::int AS c
     FROM teacher_personal_class_team_ai_interaction_logs
     WHERE team_id = $1 AND module_key = $2
     GROUP BY scene, role`,
    [teamId, moduleKey]
  ).catch(() => ({ rows: [] }));
  evidence.interactionStats = logStats || [];

  if (moduleKey === 'ideation') {
    const { rows: topicRows } = await pool.query(
      `SELECT project_name, status, reject_count, review_comment, submitted_at, reviewed_at
       FROM teacher_personal_class_team_project_topics WHERE team_id = $1 LIMIT 1`,
      [teamId]
    );
    evidence.topic = topicRows[0]
      ? {
          projectName: topicRows[0].project_name,
          status: topicRows[0].status,
          rejectCount: Number(topicRows[0].reject_count || 0),
          reviewComment: topicRows[0].review_comment || '',
        }
      : null;
    evidence.topicRejectCount = Number(topicRows[0]?.reject_count || 0);

    const { rows: ideaRows } = await pool.query(
      `SELECT COUNT(*)::int AS c FROM teacher_personal_class_team_ideas WHERE team_id = $1`,
      [teamId]
    );
    evidence.ideaCount = Number(ideaRows[0]?.c || 0);

    const { rows: hatRows } = await pool.query(
      `SELECT COUNT(*)::int AS members,
              COALESCE(SUM(jsonb_array_length(COALESCE(transcript_json->'messages', '[]'::jsonb))), 0)::int AS msgs
       FROM teacher_personal_class_team_hat_studio_member WHERE team_id = $1`,
      [teamId]
    ).catch(() => ({ rows: [{}] }));
    evidence.hatStudio = {
      members: Number(hatRows[0]?.members || 0),
      messageCount: Number(hatRows[0]?.msgs || 0),
    };

    const { rows: chatSample } = await pool.query(
      `SELECT role, LEFT(content, 400) AS content, round_index, scene, created_at
       FROM teacher_personal_class_team_ai_interaction_logs
       WHERE team_id = $1 AND module_key = 'ideation'
       ORDER BY created_at DESC LIMIT 24`,
      [teamId]
    ).catch(() => ({ rows: [] }));
    evidence.recentChats = (chatSample || []).reverse();
  }

  if (moduleKey === 'market') {
    const { rowCount: reportCount } = await pool.query(
      `SELECT 1 FROM teacher_personal_class_team_market_report_uploads WHERE team_id = $1 LIMIT 1`,
      [teamId]
    );
    const { rows: chRows } = await pool.query(
      `SELECT COUNT(*)::int AS sessions,
              COALESCE(SUM(jsonb_array_length(COALESCE(rounds, '[]'::jsonb))), 0)::int AS rounds
       FROM teacher_personal_class_team_market_challenge_sessions WHERE team_id = $1`,
      [teamId]
    ).catch(() => ({ rows: [{}] }));
    evidence.hasReport = reportCount > 0;
    evidence.challenge = {
      sessions: Number(chRows[0]?.sessions || 0),
      rounds: Number(chRows[0]?.rounds || 0),
    };
  }

  if (moduleKey === 'product') {
    const { rows } = await pool.query(
      `SELECT origin_name, size_bytes FROM teacher_personal_class_team_product_prototype_uploads WHERE team_id = $1 LIMIT 1`,
      [teamId]
    );
    evidence.prototype = rows[0]
      ? { name: rows[0].origin_name, sizeBytes: Number(rows[0].size_bytes || 0) }
      : null;
    const { rowCount: sugCount } = await pool.query(
      `SELECT 1 FROM teacher_personal_class_team_product_ai_suggestions WHERE team_id = $1 LIMIT 1`,
      [teamId]
    ).catch(() => ({ rowCount: 0 }));
    evidence.hasAiSuggestions = sugCount > 0;
  }

  if (moduleKey === 'business') {
    const { rows } = await pool.query(
      `SELECT swot_saved_at, marketing_saved_at, finance_saved_at, bmc_canvas_saved_at, bmc_review_status
       FROM teacher_personal_class_team_business_model_workspace WHERE team_id = $1 LIMIT 1`,
      [teamId]
    );
    evidence.workspace = rows[0] || null;
    const { rows: revRows } = await pool.query(
      `SELECT COUNT(*)::int AS c, COALESCE(AVG(ai_score),0)::float AS avg_score
       FROM teacher_personal_class_team_bmc_ai_reviews WHERE team_id = $1`,
      [teamId]
    ).catch(() => ({ rows: [{ c: 0, avg_score: 0 }] }));
    evidence.bmcAiReviewCount = Number(revRows[0]?.c || 0);
    evidence.bmcAiReviewAvgScore = Number(revRows[0]?.avg_score || 0);
    evidence.bmcTeacherApproved = String(rows[0]?.bmc_review_status || '') === 'approved';
  }

  if (moduleKey === 'simulation') {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS runs FROM teacher_personal_class_team_role_simulation_run_records
       WHERE teacher_personal_class_id = $1 AND team_id = $2`,
      [classId, teamId]
    );
    evidence.runCount = Number(rows[0]?.runs || 0);
  }

  if (moduleKey === 'plan') {
    const { rows } = await pool.query(
      `SELECT status, total_score, submitted_at
       FROM teacher_personal_class_team_business_plan_submissions
       WHERE teacher_personal_class_id = $1 AND team_id = $2
       ORDER BY submitted_at DESC NULLS LAST LIMIT 1`,
      [classId, teamId]
    );
    evidence.submission = rows[0]
      ? {
          status: rows[0].status,
          totalScore: rows[0].total_score != null ? Number(rows[0].total_score) : null,
          submittedAt: rows[0].submitted_at,
        }
      : null;
  }

  return evidence;
}

async function scoreStageWithAi(moduleKey, evidence) {
  const system = `#Context#
你是创业实训过程评价官，根据团队在「${MODULE_LABELS[moduleKey] || moduleKey}」环节的过程证据打分。
组队环节不参与评分。选题若曾被退回（topicRejectCount），只作为软性证据体现在维度分与评语中，禁止按固定公式硬扣分。

#Objective#
输出 JSON：五维分数（0-100）、综合总分、短评语（≤120字）。

#Style#
客观、可执行；材料不足时仍给分并说明「材料不足，暂按合理假设」。

#Response#
只输出一个 JSON 对象：
{
  "participationDepth": "number 0-100",
  "aiCollaborationQuality": "number 0-100",
  "outputCompleteness": "number 0-100",
  "logicAndEvidence": "number 0-100",
  "innovationAndRisk": "number 0-100",
  "totalScore": "number 0-100",
  "comment": "string"
}

${JSON_OUTPUT_HARD_RULES}`;

  const user = `环节：${MODULE_LABELS[moduleKey] || moduleKey}\n证据 JSON：\n${JSON.stringify(evidence, null, 2)}`;
  const { parsed, raw } = await runJsonLlm(system, user);
  const dims = {};
  for (const k of PROCESS_DIMENSIONS) dims[k] = clampScore(parsed[k]);
  let total = clampScore(parsed.totalScore);
  if (!Number.isFinite(Number(parsed.totalScore))) total = composeTotalFromDimensions(dims);
  return {
    dimensionScores: dims,
    totalScore: total,
    comment: String(parsed.comment || '').trim().slice(0, 500) || '过程评价已完成。',
    modelRaw: { parsed, rawPreview: String(raw || '').slice(0, 2000) },
  };
}

/**
 * 尝试触发并执行某阶段过程分（异步友好：可 fire-and-forget）
 */
export async function maybeScoreTeamStage(classId, teamId, moduleKey) {
  const cid = Number(classId);
  const tid = Number(teamId);
  const key = String(moduleKey || '').trim();
  if (!cid || !tid || !SCORING_MODULE_KEYS.includes(key)) return { skipped: true, reason: 'invalid' };

  const pool = getPool();
  try {
    const skipped = await loadSkippedModuleKeys(pool, cid);
    if (skipped.has(key)) return { skipped: true, reason: 'module_skipped' };

    const complete = await isScoringStageComplete(pool, cid, tid, key);
    if (!complete) return { skipped: true, reason: 'not_complete' };

    const { rows: existing } = await pool.query(
      `SELECT status FROM teacher_personal_class_team_stage_process_scores
       WHERE team_id = $1 AND module_key = $2 LIMIT 1`,
      [tid, key]
    );
    if (existing[0]?.status === 'scored' || existing[0]?.status === 'scoring') {
      return { skipped: true, reason: 'already_' + existing[0].status };
    }

    const enabled = SCORING_MODULE_KEYS.filter((k) => !skipped.has(k));
    const weights = resolveScoringWeights(enabled);
    const weightApplied = weights[key] ?? 0;

    await pool.query(
      `INSERT INTO teacher_personal_class_team_stage_process_scores
         (class_id, team_id, module_key, status, weight_applied, updated_at)
       VALUES ($1, $2, $3, 'scoring', $4, now())
       ON CONFLICT (team_id, module_key) DO UPDATE SET
         status = 'scoring',
         weight_applied = EXCLUDED.weight_applied,
         updated_at = now()`,
      [cid, tid, key, weightApplied]
    );

    const evidence = await buildEvidence(pool, cid, tid, key);
    await pool.query(
      `UPDATE teacher_personal_class_team_stage_process_scores
       SET evidence_json = $3::jsonb, updated_at = now()
       WHERE team_id = $1 AND module_key = $2`,
      [tid, key, JSON.stringify(evidence)]
    );

    try {
      const scored = await scoreStageWithAi(key, evidence);
      await pool.query(
        `UPDATE teacher_personal_class_team_stage_process_scores
         SET status = 'scored',
             dimension_scores_json = $3::jsonb,
             total_score = $4,
             comment = $5,
             model_raw_json = $6::jsonb,
             scored_at = now(),
             updated_at = now()
         WHERE team_id = $1 AND module_key = $2`,
        [
          tid,
          key,
          JSON.stringify(scored.dimensionScores),
          scored.totalScore,
          scored.comment,
          JSON.stringify(scored.modelRaw),
        ]
      );
    } catch (e) {
      logError(`stage score AI fail team=${tid} module=${key}`, e);
      await pool.query(
        `UPDATE teacher_personal_class_team_stage_process_scores
         SET status = 'failed', comment = $3, updated_at = now()
         WHERE team_id = $1 AND module_key = $2`,
        [tid, key, String(e?.message || '评分失败').slice(0, 500)]
      );
      return { ok: false, error: e.message };
    }

    // 检查是否可总评
    await maybeFinalEvaluateTeam(cid, tid);
    return { ok: true };
  } catch (e) {
    // 表未迁移时静默
    logError(`maybeScoreTeamStage team=${tid} module=${key}`, e);
    return { ok: false, error: e.message };
  }
}

/** 非阻塞触发 */
export function scheduleScoreTeamStage(classId, teamId, moduleKey) {
  setImmediate(() => {
    maybeScoreTeamStage(classId, teamId, moduleKey).catch((e) =>
      logError('scheduleScoreTeamStage', e)
    );
  });
}

async function scoreFinalWithAi({ isSolo, weightedProcessScore, stageScores, weights }) {
  const system = `#Context#
你是创业实训总评官。根据各阶段过程分与摘要，给出跨阶段总评。
单人公司用「自学推进完整性」代替「团队协作贡献」。

#Objective#
输出 JSON：加权过程分仅供参考；另给最终建议分 finalScore（0-100）、七维分数、总评摘要与短评。

#Response#
{
  "participationDepth": "number 0-100",
  "aiCollaborationQuality": "number 0-100",
  "outputCompleteness": "number 0-100",
  "logicAndEvidence": "number 0-100",
  "innovationAndRisk": "number 0-100",
  "crossStageConsistency": "number 0-100",
  "teamCollaborationOrSelfDrive": "number 0-100",
  "finalScore": "number 0-100",
  "summary": "string",
  "comment": "string"
}

${JSON_OUTPUT_HARD_RULES}`;

  const user = JSON.stringify(
    {
      companyType: isSolo ? 'solo' : 'team',
      weightedProcessScore,
      weights,
      stageScores,
    },
    null,
    2
  );
  const { parsed, raw } = await runJsonLlm(system, user);
  const dims = {
    participationDepth: clampScore(parsed.participationDepth),
    aiCollaborationQuality: clampScore(parsed.aiCollaborationQuality),
    outputCompleteness: clampScore(parsed.outputCompleteness),
    logicAndEvidence: clampScore(parsed.logicAndEvidence),
    innovationAndRisk: clampScore(parsed.innovationAndRisk),
    crossStageConsistency: clampScore(parsed.crossStageConsistency),
    teamCollaborationOrSelfDrive: clampScore(parsed.teamCollaborationOrSelfDrive),
  };
  return {
    dimensionScores: dims,
    finalScore: clampScore(parsed.finalScore ?? weightedProcessScore),
    summary: String(parsed.summary || '').trim().slice(0, 800) || '总评已完成。',
    comment: String(parsed.comment || '').trim().slice(0, 500) || '',
    modelRaw: { parsed, rawPreview: String(raw || '').slice(0, 2000) },
  };
}

export async function maybeFinalEvaluateTeam(classId, teamId) {
  const cid = Number(classId);
  const tid = Number(teamId);
  if (!cid || !tid) return { skipped: true };

  const pool = getPool();
  try {
    const skipped = await loadSkippedModuleKeys(pool, cid);
    const enabled = SCORING_MODULE_KEYS.filter((k) => !skipped.has(k));
    if (!enabled.length) return { skipped: true, reason: 'no_modules' };

    const { rows: scoreRows } = await pool.query(
      `SELECT module_key, status, total_score, comment, dimension_scores_json, weight_applied
       FROM teacher_personal_class_team_stage_process_scores
       WHERE team_id = $1 AND module_key = ANY($2::text[])`,
      [tid, enabled]
    );
    const byKey = new Map(scoreRows.map((r) => [r.module_key, r]));
    for (const k of enabled) {
      if (byKey.get(k)?.status !== 'scored') {
        return { skipped: true, reason: 'stages_incomplete' };
      }
    }

    const { rows: finRows } = await pool.query(
      `SELECT status FROM teacher_personal_class_team_final_evaluations WHERE team_id = $1 LIMIT 1`,
      [tid]
    );
    if (finRows[0]?.status === 'scored' || finRows[0]?.status === 'scoring') {
      return { skipped: true, reason: 'already_' + finRows[0].status };
    }

    const weights = resolveScoringWeights(enabled);
    let weighted = 0;
    const stageScores = {};
    for (const k of enabled) {
      const row = byKey.get(k);
      const score = Number(row.total_score || 0);
      const w = weights[k] || 0;
      weighted += score * w;
      stageScores[k] = {
        totalScore: score,
        weight: w,
        comment: row.comment || '',
        dimensions: row.dimension_scores_json || {},
      };
    }
    weighted = clampScore(weighted);

    const { rows: teamRows } = await pool.query(
      `SELECT is_solo FROM teacher_personal_class_teams WHERE id = $1`,
      [tid]
    );
    const isSolo = Boolean(teamRows[0]?.is_solo);

    await pool.query(
      `INSERT INTO teacher_personal_class_team_final_evaluations
         (class_id, team_id, weighted_process_score, status, updated_at)
       VALUES ($1, $2, $3, 'scoring', now())
       ON CONFLICT (team_id) DO UPDATE SET
         weighted_process_score = EXCLUDED.weighted_process_score,
         status = 'scoring',
         updated_at = now()`,
      [cid, tid, weighted]
    );

    try {
      const scored = await scoreFinalWithAi({
        isSolo,
        weightedProcessScore: weighted,
        stageScores,
        weights,
      });
      await pool.query(
        `UPDATE teacher_personal_class_team_final_evaluations
         SET status = 'scored',
             dimension_scores_json = $2::jsonb,
             final_score = $3,
             summary = $4,
             comment = $5,
             model_raw_json = $6::jsonb,
             scored_at = now(),
             updated_at = now()
         WHERE team_id = $1`,
        [
          tid,
          JSON.stringify(scored.dimensionScores),
          scored.finalScore,
          scored.summary,
          scored.comment,
          JSON.stringify(scored.modelRaw),
        ]
      );
      return { ok: true, finalScore: scored.finalScore };
    } catch (e) {
      logError(`final eval AI fail team=${tid}`, e);
      await pool.query(
        `UPDATE teacher_personal_class_team_final_evaluations
         SET status = 'failed', comment = $2, updated_at = now()
         WHERE team_id = $1`,
        [tid, String(e?.message || '总评失败').slice(0, 500)]
      );
      return { ok: false, error: e.message };
    }
  } catch (e) {
    logError(`maybeFinalEvaluateTeam team=${tid}`, e);
    return { ok: false, error: e.message };
  }
}

/**
 * 驾驶舱聚合数据
 */
export async function loadTeamCockpit(pool, classId, teamId) {
  const skipped = await loadSkippedModuleKeys(pool, classId);
  const enabledScoring = SCORING_MODULE_KEYS.filter((k) => !skipped.has(k));
  const weights = resolveScoringWeights(enabledScoring);

  const { rows: teamRows } = await pool.query(
    `SELECT id, name, is_solo, leader_student_id, grouping_status, introduction
     FROM teacher_personal_class_teams
     WHERE id = $1 AND teacher_personal_class_id = $2`,
    [teamId, classId]
  );
  if (!teamRows.length) return null;
  const team = teamRows[0];

  const { rows: memberRows } = await pool.query(
    `SELECT m.student_id, m.ai_matched_role, m.dimension_profile,
            COALESCE(u.real_name, u.username, '') AS name,
            COALESCE(u.avatar_url, '') AS avatar_url
     FROM teacher_personal_class_team_members m
     JOIN users u ON u.id = m.student_id
     WHERE m.team_id = $1
     ORDER BY CASE WHEN m.student_id = $2 THEN 0 ELSE 1 END, m.student_id`,
    [teamId, team.leader_student_id]
  );

  const { rows: scoreRows } = await pool.query(
    `SELECT module_key, status, total_score, comment, dimension_scores_json,
            weight_applied, evidence_json, scored_at, updated_at
     FROM teacher_personal_class_team_stage_process_scores
     WHERE team_id = $1`,
    [teamId]
  ).catch(() => ({ rows: [] }));

  const scoreByKey = new Map((scoreRows || []).map((r) => [r.module_key, r]));

  const stages = [];
  for (const k of SCORING_MODULE_KEYS) {
    const isSkipped = skipped.has(k);
    const row = scoreByKey.get(k);
    const w = isSkipped ? 0 : weights[k] || 0;
    const complete = isSkipped ? false : await isScoringStageComplete(pool, classId, teamId, k);
    const total = row?.status === 'scored' ? Number(row.total_score) : null;
    stages.push({
      key: k,
      name: MODULE_LABELS[k],
      skipped: isSkipped,
      weight: w,
      complete,
      status: row?.status || (complete ? 'pending' : 'incomplete'),
      totalScore: total,
      comment: row?.comment || '',
      dimensionScores: row?.dimension_scores_json || null,
      scoredAt: row?.scored_at ? new Date(row.scored_at).toISOString() : '',
      evidenceSummary: summarizeEvidence(row?.evidence_json),
    });
  }

  const { rows: finRows } = await pool.query(
    `SELECT status, weighted_process_score, final_score, summary, comment,
            dimension_scores_json, scored_at
     FROM teacher_personal_class_team_final_evaluations WHERE team_id = $1 LIMIT 1`,
    [teamId]
  ).catch(() => ({ rows: [] }));
  const fin = finRows[0] || null;

  const { rows: logCountRows } = await pool.query(
    `SELECT module_key, COUNT(*)::int AS c
     FROM teacher_personal_class_team_ai_interaction_logs
     WHERE team_id = $1
     GROUP BY module_key`,
    [teamId]
  ).catch(() => ({ rows: [] }));

  // 按成员 / 场景 / 近14日趋势 / 最近动态，供驾驶舱图表与热度
  const { rows: logByStudentRows } = await pool.query(
    `SELECT student_id, COUNT(*)::int AS c
     FROM teacher_personal_class_team_ai_interaction_logs
     WHERE team_id = $1 AND student_id IS NOT NULL
     GROUP BY student_id`,
    [teamId]
  ).catch(() => ({ rows: [] }));

  const { rows: logBySceneRows } = await pool.query(
    `SELECT scene, COUNT(*)::int AS c
     FROM teacher_personal_class_team_ai_interaction_logs
     WHERE team_id = $1
     GROUP BY scene
     ORDER BY c DESC
     LIMIT 12`,
    [teamId]
  ).catch(() => ({ rows: [] }));

  const { rows: logDailyRows } = await pool.query(
    `SELECT to_char(created_at AT TIME ZONE 'Asia/Shanghai', 'MM-DD') AS day_label,
            (created_at AT TIME ZONE 'Asia/Shanghai')::date AS day_key,
            COUNT(*)::int AS c
     FROM teacher_personal_class_team_ai_interaction_logs
     WHERE team_id = $1
       AND created_at >= (NOW() - INTERVAL '14 days')
     GROUP BY day_key, day_label
     ORDER BY day_key ASC`,
    [teamId]
  ).catch(() => ({ rows: [] }));

  // 多取一些，供驾驶舱按阶段 Tab 分组展示
  const { rows: recentLogRows } = await pool.query(
    `SELECT l.id, l.module_key, l.scene, l.role, l.content, l.created_at, l.student_id,
            COALESCE(u.real_name, u.username, '') AS student_name
     FROM teacher_personal_class_team_ai_interaction_logs l
     LEFT JOIN users u ON u.id = l.student_id
     WHERE l.team_id = $1
     ORDER BY l.created_at DESC
     LIMIT 80`,
    [teamId]
  ).catch(() => ({ rows: [] }));

  const interactionCounts = Object.fromEntries((logCountRows || []).map((r) => [r.module_key, r.c]));
  const totalInteractions = Object.values(interactionCounts).reduce((a, b) => a + Number(b || 0), 0);
  const memberList = memberRows.map((m) => ({
    studentId: Number(m.student_id),
    name: m.name,
    avatarUrl: m.avatar_url || '',
    aiMatchedRole: m.ai_matched_role || '',
    dimensionProfile: m.dimension_profile || null,
  }));
  const countByStudent = new Map((logByStudentRows || []).map((r) => [Number(r.student_id), Number(r.c)]));

  return {
    team: {
      id: Number(team.id),
      name: team.name,
      isSolo: Boolean(team.is_solo),
      leaderStudentId: Number(team.leader_student_id),
      groupingStatus: team.grouping_status,
      introduction: team.introduction || '',
    },
    members: memberList,
    weights,
    stages,
    /** 对已 scored 且未略过阶段按当前权重加权汇总 */
    weightedProcessScore: (() => {
      let s = 0;
      let ok = false;
      for (const st of stages) {
        if (st.skipped || st.totalScore == null) continue;
        s += st.totalScore * (st.weight || 0);
        ok = true;
      }
      return ok ? clampScore(s) : null;
    })(),
    finalEvaluation: fin
      ? {
          status: fin.status,
          weightedProcessScore:
            fin.weighted_process_score != null ? Number(fin.weighted_process_score) : null,
          finalScore: fin.final_score != null ? Number(fin.final_score) : null,
          summary: fin.summary || '',
          comment: fin.comment || '',
          dimensionScores: fin.dimension_scores_json || null,
          scoredAt: fin.scored_at ? new Date(fin.scored_at).toISOString() : '',
        }
      : null,
    interactionCounts,
    interactionStats: {
      total: totalInteractions,
      byModule: Object.entries(interactionCounts).map(([key, count]) => ({
        key,
        name: MODULE_LABELS[key] || key,
        count: Number(count) || 0,
      })),
      byStudent: memberList.map((m) => ({
        studentId: m.studentId,
        name: m.name,
        count: countByStudent.get(m.studentId) || 0,
      })),
      byScene: (logBySceneRows || []).map((r) => ({
        scene: String(r.scene || 'event'),
        count: Number(r.c) || 0,
      })),
      dailyTrend: (logDailyRows || []).map((r) => ({
        day: String(r.day_label || ''),
        count: Number(r.c) || 0,
      })),
      recent: (recentLogRows || []).map((r) => ({
        id: Number(r.id),
        moduleKey: r.module_key,
        moduleName: MODULE_LABELS[r.module_key] || r.module_key,
        scene: r.scene || '',
        role: r.role || '',
        content: String(r.content || '').slice(0, 120),
        studentName: r.student_name || '—',
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : '',
      })),
    },
    allScoringComplete: enabledScoring.every((k) => scoreByKey.get(k)?.status === 'scored'),
  };
}

function summarizeEvidence(ev) {
  if (!ev || typeof ev !== 'object') return null;
  const ws = ev.workspace && typeof ev.workspace === 'object' ? ev.workspace : null;
  return {
    topicRejectCount: ev.topicRejectCount ?? ev.topic?.rejectCount ?? null,
    topicStatus: ev.topic?.status ?? null,
    ideaCount: ev.ideaCount ?? null,
    hatMessageCount: ev.hatStudio?.messageCount ?? null,
    hatMembers: ev.hatStudio?.members ?? null,
    challengeRounds: ev.challenge?.rounds ?? null,
    challengeSessions: ev.challenge?.sessions ?? null,
    hasReport: ev.hasReport ?? null,
    hasAiSuggestions: ev.hasAiSuggestions ?? null,
    hasPrototype: Boolean(ev.prototype),
    prototypeName: ev.prototype?.name ?? null,
    // 商模：AI 审查次数 / 均分 / 教师审核 / 五件套进度
    bmcAiReviewCount: ev.bmcAiReviewCount ?? null,
    bmcAiReviewAvgScore: ev.bmcAiReviewAvgScore != null ? Math.round(Number(ev.bmcAiReviewAvgScore)) : null,
    bmcTeacherApproved: ev.bmcTeacherApproved ?? null,
    bmcUploaded: Boolean(ws?.bmc_canvas_saved_at),
    swotSaved: Boolean(ws?.swot_saved_at),
    marketingSaved: Boolean(ws?.marketing_saved_at),
    financeSaved: Boolean(ws?.finance_saved_at),
    runCount: ev.runCount ?? null,
    planStatus: ev.plan?.status ?? null,
    planScore: ev.plan?.totalScore ?? null,
    interactionStatCount: Array.isArray(ev.interactionStats) ? ev.interactionStats.length : null,
  };
}
