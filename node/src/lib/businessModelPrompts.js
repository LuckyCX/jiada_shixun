/** 商业模式设计 AI：提示词集中维护（勿写入前端） */
import { extractJsonFromLlmText, findAllBalancedJsonObjects } from './marketResearchSse.js';

export const BUSINESS_MODEL_SWOT_JSON_SCHEMA = `{
  "strengths": "优势（非空，至少 2 条要点，可用 \\n 与 •）",
  "weaknesses": "劣势（非空，至少 2 条要点）",
  "opportunities": "机会（非空，至少 2 条要点）",
  "threats": "威胁（非空，至少 2 条要点）"
}
四键必须齐全，禁止增删键，禁止空字符串。`;

export const BUSINESS_MODEL_SWOT_SYSTEM_PROMPT = `你是创业实训课程的商业模式助教。

#Context#
根据小组项目信息与前期资料生成 SWOT。

#Objective#
输出 SWOT 四维 JSON，供页面直接展示。

#Schema#
${BUSINESS_MODEL_SWOT_JSON_SCHEMA}

#Examples#
{"strengths":"• 场景刚需明确\\n• 获客成本相对可控","weaknesses":"• 供给不稳定\\n• 信任机制不足","opportunities":"• 校园渠道可复制\\n• 政策鼓励循环利用","threats":"• 平台型竞品挤压\\n• 季节性波动"}

#Response#
- 只能输出上述四键 JSON，禁止 markdown / 解释。
- 内容须贴合材料，资料不足处标注合理假设。`;

export function buildBusinessModelSwotUserPrompt(contextBundle) {
  return `请基于以下资料生成 SWOT（严格按 system #Schema#，四键齐全）。

###
${String(contextBundle || '').trim() || '（无）'}
###`;
}

export const BUSINESS_MODEL_MARKETING_JSON_SCHEMA = `{
  "product": "产品策略（非空，至少 2 条要点）",
  "price": "价格策略（非空，至少 2 条要点）",
  "place": "渠道策略（非空，至少 2 条要点）",
  "promotion": "推广策略（非空，至少 2 条要点）"
}
四键必须齐全，禁止增删键。`;

export const BUSINESS_MODEL_MARKETING_SYSTEM_PROMPT = `你是创业实训课程的营销战略助教。

#Context#
根据给定资料输出 4P 营销策略。

#Objective#
输出 Product/Price/Place/Promotion 四段 JSON。

#Schema#
${BUSINESS_MODEL_MARKETING_JSON_SCHEMA}

#Response#
- 只能输出上述四键 JSON，禁止 markdown。
- 每段至少 2 条可执行要点，结合项目实际。`;

export function buildBusinessModelMarketingUserPrompt(contextBundle) {
  return `请基于以下资料生成 4P（严格按 system #Schema#）。

###
${String(contextBundle || '').trim() || '（无）'}
###`;
}

export const BUSINESS_MODEL_FINANCE_ITEMS_JSON_SCHEMA = `{
  "costs": [
    { "category": "固定成本" | "变动成本", "name": "成本项名称（不含金额）" }
  ],
  "revenues": [
    { "source": "收入来源名称（不含金额）" }
  ]
}
固定约束：
- costs 至少 3 条、revenues 至少 2 条。
- category 只能是「固定成本」或「变动成本」。
- 禁止金额、单价、百分比等数值字段。
- 禁止增删顶层键。`;

export const BUSINESS_MODEL_FINANCE_ITEMS_SYSTEM_PROMPT = `你是创业实训课程的财务条目梳理助教。

#Context#
根据项目背景罗列可能发生的成本项与收入来源名称。

#Objective#
仅输出条目名称 JSON，不得出现任何金额。

#Schema#
${BUSINESS_MODEL_FINANCE_ITEMS_JSON_SCHEMA}

#Response#
- 只能输出 costs / revenues 两个键。
- 条目名称具体，避免「其他费用」这类空泛项超过 1 条。`;

export function buildBusinessModelFinanceItemsUserPrompt(contextBundle) {
  return `请基于以下资料生成成本项与收入来源（严格按 system #Schema#；禁止金额）。

###
${String(contextBundle || '').trim() || '（无）'}
###`;
}

function pickSwotCandidate(parsed, text) {
  if (
    parsed &&
    typeof parsed === 'object' &&
    typeof parsed.strengths === 'string' &&
    typeof parsed.weaknesses === 'string'
  )
    return parsed;
  const all = findAllBalancedJsonObjects(String(text || ''));
  for (let i = all.length - 1; i >= 0; i--) {
    const o = all[i];
    if (typeof o?.strengths === 'string' && typeof o?.weaknesses === 'string') return o;
  }
  return null;
}

export function normalizeSwotPayload(parsed, text) {
  const raw = pickSwotCandidate(parsed, text) || pickSwotCandidate(extractJsonFromLlmText(text), text);
  if (!raw || typeof raw !== 'object') return { error: 'AI 返回格式无效' };
  const out = {
    strengths: String(raw.strengths || '').trim(),
    weaknesses: String(raw.weaknesses || '').trim(),
    opportunities: String(raw.opportunities || '').trim(),
    threats: String(raw.threats || '').trim(),
  };
  if (!out.strengths || !out.weaknesses || !out.opportunities || !out.threats) {
    return { error: 'SWOT 四维存在空内容' };
  }
  return { payload: out };
}

function pickMarketingCandidate(parsed, text) {
  if (
    parsed &&
    typeof parsed === 'object' &&
    typeof parsed.product === 'string' &&
    typeof parsed.price === 'string'
  )
    return parsed;
  const all = findAllBalancedJsonObjects(String(text || ''));
  for (let i = all.length - 1; i >= 0; i--) {
    const o = all[i];
    if (typeof o?.product === 'string' && typeof o?.price === 'string') return o;
  }
  return null;
}

export function normalizeMarketingPayload(parsed, text) {
  const raw = pickMarketingCandidate(parsed, text) || pickMarketingCandidate(extractJsonFromLlmText(text), text);
  if (!raw || typeof raw !== 'object') return { error: 'AI 返回格式无效' };
  const out = {
    product: String(raw.product || '').trim(),
    price: String(raw.price || '').trim(),
    place: String(raw.place || '').trim(),
    promotion: String(raw.promotion || '').trim(),
  };
  if (!out.product || !out.price || !out.place || !out.promotion) {
    return { error: '4P 字段存在空内容' };
  }
  return { payload: out };
}

function pickFinanceCandidate(parsed, text) {
  if (
    parsed &&
    typeof parsed === 'object' &&
    Array.isArray(parsed.costs) &&
    Array.isArray(parsed.revenues)
  )
    return parsed;
  const all = findAllBalancedJsonObjects(String(text || ''));
  for (let i = all.length - 1; i >= 0; i--) {
    const o = all[i];
    if (Array.isArray(o?.costs) && Array.isArray(o?.revenues)) return o;
  }
  return null;
}

const ALLOW_COST_CAT = new Set(['固定成本', '变动成本']);

export function normalizeFinanceItemsPayload(parsed, text) {
  const raw = pickFinanceCandidate(parsed, text) || pickFinanceCandidate(extractJsonFromLlmText(text), text);
  if (!raw || typeof raw !== 'object') return { error: 'AI 返回格式无效' };
  const costs = [];
  const revenues = [];
  for (const c of raw.costs || []) {
    if (!c || typeof c !== 'object') continue;
    const cat = String(c.category || '').trim();
    const name = String(c.name || c.title || '').trim();
    if (!name || !ALLOW_COST_CAT.has(cat)) continue;
    costs.push({ category: cat, name });
  }
  for (const r of raw.revenues || []) {
    if (!r || typeof r !== 'object') continue;
    const source = String(r.source || r.name || '').trim();
    if (!source) continue;
    revenues.push({ source });
  }
  if (!costs.length && !revenues.length) {
    return { error: '未生成有效的成本或收入条目' };
  }
  const baseId = Date.now();
  const costsWithIds = costs.map((c, i) => ({
    id: baseId + i,
    category: c.category,
    name: c.name,
    amount: 0,
  }));
  const revenuesWithIds = revenues.map((r, i) => ({
    id: baseId + costsWithIds.length + i,
    source: r.source,
    monthly: 0,
  }));
  return { payload: { costs: costsWithIds, revenues: revenuesWithIds } };
}

export const BMC_MODULE_KEYS = [
  'keyPartnerships',
  'keyActivities',
  'valueProposition',
  'customerRelationships',
  'customerSegments',
  'keyResources',
  'channels',
  'costStructure',
  'revenueStreams',
];

export const BUSINESS_MODEL_BMC_JSON_SCHEMA = `{
  "keyPartnerships": "合作伙伴（非空）",
  "keyActivities": "关键业务（非空）",
  "valueProposition": "价值主张（非空）",
  "customerRelationships": "客户关系（非空）",
  "customerSegments": "客户细分（非空）",
  "keyResources": "核心资源（非空）",
  "channels": "渠道通路（非空）",
  "costStructure": "成本结构（非空）",
  "revenueStreams": "收入来源（非空）"
}
固定约束：上述九键必须齐全且均为非空字符串；禁止增删键；可用 \\n 与 • 列表。`;

export const BUSINESS_MODEL_BMC_SYSTEM_PROMPT = `你是创业实训课程的商业模式画布（BMC）助教。

#Context#
根据项目资料与各组员虚拟董事会已保存九格，综合输出团队最终画布。

#Objective#
输出九格齐全的 BMC JSON，供页面一键写入。

#Schema#
${BUSINESS_MODEL_BMC_JSON_SCHEMA}

#Response#
- 只能输出上述九键 JSON，禁止 markdown。
- 内容可执行、综合组员画布与资料，资料冲突时取可落地共识并简要说明假设。`;

export function buildBusinessModelBmcUserPrompt(contextBundle, warRoomMemberSections) {
  return `请基于以下资料生成团队最终商业模式画布九格（严格按 system #Schema#，九键齐全）。

###
【项目与前期资料】
${String(contextBundle || '').trim() || '（无）'}
###

###
【各组员虚拟董事会已保存画布】
${String(warRoomMemberSections || '').trim() || '（无）'}
###`;
}

function pickBmcCandidate(parsed, text) {
  if (parsed && typeof parsed === 'object' && typeof parsed.valueProposition === 'string') return parsed;
  const all = findAllBalancedJsonObjects(String(text || ''));
  for (let i = all.length - 1; i >= 0; i--) {
    const o = all[i];
    if (typeof o?.valueProposition === 'string' && typeof o?.customerSegments === 'string') return o;
  }
  return null;
}

export function normalizeBmcPayload(parsed, text) {
  const raw = pickBmcCandidate(parsed, text) || pickBmcCandidate(extractJsonFromLlmText(text), text);
  if (!raw || typeof raw !== 'object') return { error: 'AI 返回格式无效' };
  const out = {};
  for (const k of BMC_MODULE_KEYS) {
    out[k] = String(raw[k] || '').trim();
  }
  const empty = BMC_MODULE_KEYS.filter((k) => !out[k]);
  if (empty.length) return { error: `商业模式画布存在空内容：${empty.join('、')}` };
  return { payload: out };
}
