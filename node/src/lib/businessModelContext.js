import {
  buildMarketResearchContext,
  formatContextForPrompt,
  projectTopicTextFromRow,
} from './marketResearchContext.js';

const MAX_BUNDLE_CHARS = 14000;

function truncateMiddle(s, max) {
  const t = String(s || '').trim();
  if (t.length <= max) return t;
  const head = Math.floor(max * 0.55);
  const tail = Math.floor(max * 0.35);
  return `${t.slice(0, head)}\n…\n${t.slice(t.length - tail)}（前文已省略）`;
}

function productSuggestionToText(payload) {
  if (!payload || typeof payload !== 'object') return '（暂无产品设计 AI 建议）';
  try {
    return truncateMiddle(JSON.stringify(payload, null, 2), 8000);
  } catch {
    return '（产品设计 AI 建议无法序列化）';
  }
}

/**
 * @param {import('pg').Pool} pool
 * @param {number} teamId
 * @param {string} uploadRoot
 */
export async function assembleBusinessModelAiBundle(pool, teamId, uploadRoot) {
  const { rows: topicRows } = await pool.query(
    `SELECT project_name, project_direction, project_description, target_users, core_value,
            core_problem, solution_overview, market_size, competitive_advantage
     FROM teacher_personal_class_team_project_topics WHERE team_id = $1 LIMIT 1`,
    [teamId]
  );
  const projectTopicText = projectTopicTextFromRow(topicRows[0] || null);

  const mrCtx = await buildMarketResearchContext(pool, teamId, uploadRoot);
  let researchText = formatContextForPrompt(mrCtx);
  researchText = truncateMiddle(researchText, 10000);

  const { rows: ctxRows } = await pool.query(
    `SELECT context_text FROM teacher_personal_class_team_product_context WHERE team_id = $1`,
    [teamId]
  );
  const backgroundText = truncateMiddle(String(ctxRows[0]?.context_text || '').trim() || '（尚未填写产品设计项目背景）', 2000);

  const { rows: sugRows } = await pool.query(
    `SELECT payload FROM teacher_personal_class_team_product_ai_suggestions
     WHERE team_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [teamId]
  );
  const suggestionBlock = sugRows.length ? productSuggestionToText(sugRows[0].payload) : '（本队尚无产品设计 AI 建议记录）';

  const parts = [
    '【项目主题 / 选题信息】',
    projectTopicText,
    '\n【产品设计 · 项目背景】',
    backgroundText,
    '\n【产品设计 · AI 建议（全队最新一条）】',
    suggestionBlock,
    '\n【市场调研与材料汇编】',
    researchText,
  ];
  let bundle = parts.join('\n');
  bundle = truncateMiddle(bundle, MAX_BUNDLE_CHARS);
  return bundle;
}
