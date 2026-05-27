/** 商业模式设计 AI：提示词集中维护（勿写入前端） */
import { extractJsonFromLlmText, findAllBalancedJsonObjects } from './marketResearchSse.js';

export const BUSINESS_MODEL_SWOT_JSON_SCHEMA = `
最终必须输出且仅输出一个 JSON 对象（不要用 markdown 代码块包裹）。字段：
{
  "strengths": "优势分析，多行可使用 \\n，可用 • 开头列表",
  "weaknesses": "劣势分析",
  "opportunities": "机会分析",
  "threats": "威胁分析"
}
四段均须为非空字符串，每段至少 2 条要点。`;

export const BUSINESS_MODEL_SWOT_SYSTEM_PROMPT = `你是创业实训课程的商业模式助教。根据给定的小组项目信息与前期资料，生成 SWOT 分析的四个维度文本。

工作方式：先理解项目定位与竞争环境，再按 schema 输出 JSON，语言简洁、可执行，避免空泛套话。

${BUSINESS_MODEL_SWOT_JSON_SCHEMA}`;

export function buildBusinessModelSwotUserPrompt(contextBundle) {
  return `请基于以下资料生成 SWOT 四个维度（严格按 system 中的 JSON schema 输出）。

${String(contextBundle || '').trim()}`;
}

export const BUSINESS_MODEL_MARKETING_JSON_SCHEMA = `
最终必须输出且仅输出一个 JSON 对象。字段：
{
  "product": "产品策略（Product）",
  "price": "价格策略（Price）",
  "place": "渠道策略（Place）",
  "promotion": "推广策略（Promotion）"
}
四字段均须为非空字符串，每段至少 2 条要点，结合项目实际。`;

export const BUSINESS_MODEL_MARKETING_SYSTEM_PROMPT = `你是创业实训课程的营销战略助教。根据给定资料输出 4P 营销策略。

${BUSINESS_MODEL_MARKETING_JSON_SCHEMA}`;

export function buildBusinessModelMarketingUserPrompt(contextBundle) {
  return `请基于以下资料生成 4P 营销策略（严格按 system 中的 JSON schema 输出）。

${String(contextBundle || '').trim()}`;
}

export const BUSINESS_MODEL_FINANCE_ITEMS_JSON_SCHEMA = `
最终必须输出且仅输出一个 JSON 对象。字段：
{
  "costs": [
    { "category": "固定成本" | "变动成本", "name": "成本项名称（不含金额）" }
  ],
  "revenues": [
    { "source": "收入来源名称（不含金额）" }
  ]
}
严格要求：
- costs、revenues 均为数组；可为空但不会同时为空时应尽量覆盖常见创业场景。
- 禁止出现金额、单价、月供、年费、百分比数字等数值字段。
- category 只能是「固定成本」或「变动成本」。`;

export const BUSINESS_MODEL_FINANCE_ITEMS_SYSTEM_PROMPT = `你是创业实训课程的财务条目梳理助教。根据项目背景仅罗列可能发生的成本项目名称与收入来源名称，**不得输出任何金额或数字单价**。

${BUSINESS_MODEL_FINANCE_ITEMS_JSON_SCHEMA}`;

export function buildBusinessModelFinanceItemsUserPrompt(contextBundle) {
  return `请基于以下资料生成成本项与收入来源条目（严格按 system 中的 JSON schema 输出；禁止金额）。

${String(contextBundle || '').trim()}`;
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
