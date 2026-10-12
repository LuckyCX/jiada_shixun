import path from 'path';
import { fileURLToPath } from 'url';
import { assembleBusinessModelAiBundle } from './businessModelContext.js';
import { sectionsToFullText } from './businessPlanSections.js';
import { loadSkippedModuleKeysByTeamId } from './courseWorkflow.js';
import {
  loadMarketAnalysisTextForPrompt,
  loadMarketPersonasTextForPrompt,
} from './marketResearchContext.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_ROOT = path.join(__dirname, '../../uploads/market-research');

function truncateMiddle(s, max) {
  const t = String(s || '').trim();
  if (t.length <= max) return t;
  const head = Math.floor(max * 0.55);
  const tail = Math.floor(max * 0.35);
  return `${t.slice(0, head)}\n…\n${t.slice(t.length - tail)}`;
}

/**
 * @param {import('pg').Pool} pool
 * @param {number} teamId
 */
async function loadBusinessModelWorkspaceText(pool, teamId) {
  const { rows } = await pool.query(
    `SELECT swot_json, marketing_json, finance_json, bmc_canvas_json
     FROM teacher_personal_class_team_business_model_workspace
     WHERE team_id = $1`,
    [teamId]
  );
  if (!rows.length) return '（尚未保存商业模式设计内容）';
  const r = rows[0];
  const parts = [];
  if (r.swot_json && Object.keys(r.swot_json).length) {
    parts.push('【SWOT】\n' + truncateMiddle(JSON.stringify(r.swot_json, null, 2), 2500));
  }
  if (r.marketing_json && Object.keys(r.marketing_json).length) {
    parts.push('【4P 营销】\n' + truncateMiddle(JSON.stringify(r.marketing_json, null, 2), 2000));
  }
  if (r.finance_json) {
    parts.push('【财务条目】\n' + truncateMiddle(JSON.stringify(r.finance_json, null, 2), 2000));
  }
  if (r.bmc_canvas_json && Object.keys(r.bmc_canvas_json).length) {
    parts.push('【商业画布】\n' + truncateMiddle(JSON.stringify(r.bmc_canvas_json, null, 2), 3000));
  }
  return parts.length ? parts.join('\n\n') : '（尚未保存商业模式设计内容）';
}

/**
 * @param {import('pg').Pool} pool
 * @param {number} teamId
 */
async function loadRoleSimulationSummary(pool, teamId) {
  const { rows } = await pool.query(
    `SELECT optimize_json, tracking_json, created_at
     FROM teacher_personal_class_team_role_simulation_run_records
     WHERE team_id = $1
     ORDER BY created_at DESC
     LIMIT 3`,
    [teamId]
  );
  if (!rows.length) return '（暂无 AI 仿真模拟记录）';
  return rows
    .map((r, i) => {
      const opt = r.optimize_json && typeof r.optimize_json === 'object' ? r.optimize_json : {};
      const summary = String(opt.summary || opt.conclusion || opt.advice || '').trim();
      const tracking = r.tracking_json && typeof r.tracking_json === 'object' ? r.tracking_json : {};
      const finalUsers = tracking.finalUsers ?? tracking.users ?? '';
      const finalRevenue = tracking.finalRevenue ?? tracking.revenue ?? '';
      const block = [
        `记录 ${i + 1}（${new Date(r.created_at).toISOString().slice(0, 10)}）`,
        finalUsers !== '' ? `期末用户规模：${finalUsers}` : '',
        finalRevenue !== '' ? `期末收入：${finalRevenue}` : '',
        summary ? `优化建议摘要：${summary}` : '',
      ]
        .filter(Boolean)
        .join('\n');
      return block || `记录 ${i + 1}（无摘要）`;
    })
    .join('\n---\n');
}

/**
 * @param {import('pg').Pool} pool
 * @param {number} teamId
 * @param {string} uploadRoot
 */
export async function assembleBusinessPlanBundle(pool, teamId, uploadRoot = UPLOAD_ROOT) {
  const { skipped } = await loadSkippedModuleKeysByTeamId(pool, teamId);
  const parts = ['【前期实训汇编】', await assembleBusinessModelAiBundle(pool, teamId, uploadRoot)];
  // 浓缩市场成果：分析报告 + 用户画像（计划书章节强依赖）
  if (!skipped.has('market')) {
    const [analysisText, personasText] = await Promise.all([
      loadMarketAnalysisTextForPrompt(pool, teamId, 6000),
      loadMarketPersonasTextForPrompt(pool, teamId, 5000),
    ]);
    parts.push('\n' + analysisText, '\n' + personasText);
  }
  if (!skipped.has('business')) {
    parts.push('\n【商业模式设计（本队已保存）】', await loadBusinessModelWorkspaceText(pool, teamId));
  }
  if (!skipped.has('simulation')) {
    parts.push('\n【AI 仿真模拟（近期记录）】', await loadRoleSimulationSummary(pool, teamId));
  }
  return truncateMiddle(parts.join('\n'), 22000);
}

export function bundleForAnalyzeVersion(sections, contextBundle) {
  const body = sectionsToFullText(sections);
  return `【待分析的商业计划书正文】\n${body || '（正文为空）'}\n\n【前期实训参考资料】\n${String(contextBundle || '').trim()}`;
}
