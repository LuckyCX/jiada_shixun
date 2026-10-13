/** 商业模式设计 AI：提示词集中维护（勿写入前端） */
import { extractJsonFromLlmText, findAllBalancedJsonObjects } from './marketResearchSse.js';

export const BUSINESS_MODEL_SWOT_JSON_SCHEMA = `{
  "strengths": "优势引导（非空，每维 4～6 条，用 \\n 与 •；含切入点+待填问句+建议写什么证据）",
  "weaknesses": "劣势引导（同上）",
  "opportunities": "机会引导（同上）",
  "threats": "威胁引导（同上）"
}
四键必须齐全，禁止增删键，禁止空字符串；四键值必须是字符串。`;

export const BUSINESS_MODEL_SWOT_SYSTEM_PROMPT = `你是创业实训课程的商业模式引导助教。

#Context#
根据小组项目信息与前期资料（选题、调研、产品等），为学生 SWOT 提供「丰富的引导骨架」，帮助学生搭好分析框架，但不要替学生写完整可交作业正文。

#Objective#
输出 SWOT 四维 JSON。每一维须包含 4～6 条引导，结构尽量覆盖：
1）结合资料的切入提示（点出可分析的方向/关键词，勿下最终结论）
2）具体待填问题（请学生用项目事实回答）
3）建议补充的证据类型（数据、案例、访谈、竞品对比等）
4）可对照的对比维度或检验标准（如何判断写得够不够）

#Schema#
${BUSINESS_MODEL_SWOT_JSON_SCHEMA}

#Examples#
{"strengths":"• 【切入】结合你们的目标用户与场景，先写「别人不好抄」的能力，而不是空泛的「团队优秀」\\n• 请填写：相对 1～2 个直接竞品，你们在供给/体验/信任上的差异点各是什么？\\n• 建议证据：团队已有技能、渠道资源、已验证反馈（问卷/访谈原话一句即可）\\n• 请补充：若把核心资源换成别的团队，这项优势是否还成立？为什么？\\n• 可写模板：因为具备【资源/能力】，所以能在【场景】比竞品更快/更稳地【结果】","weaknesses":"• 【切入】劣势要写「会拖慢验证或放大成本」的短板，避免只写态度问题\\n• 请填写：当前最大短板落在供给、获客、信任、资金、合规中的哪一类？具体表现？\\n• 建议证据：失败尝试、未验证假设、关键岗位缺口、依赖外部方的风险点\\n• 请补充：哪些假设一旦不成立，商业模式会最先垮？\\n• 检验：每条劣势能否对应一条「本学期可做的补强动作」","opportunities":"• 【切入】机会要可在 3～12 个月内抓住，写清窗口来自哪里（渠道/政策/场景/技术）\\n• 请填写：最值得先打的细分场景是谁、在什么时间点、靠什么触达？\\n• 建议证据：调研中的高频痛点、可复制渠道、政策/校内资源、季节性需求\\n• 请补充：若只选一个增长杠杆（渠道/产品/合作），优先哪一个？理由？\\n• 可写模板：在【窗口】下，服务【人群】，用【动作】拿到【可衡量结果】","threats":"• 【切入】威胁写「外部力量可能挤压你们」的竞争/合规/替代方案，勿只写宏观空话\\n• 请填写：最可能抢走用户的竞品形态是什么？它的优势对你们杀伤在哪？\\n• 建议证据：竞品定价/功能、用户迁移成本、季节波动、合规门槛\\n• 请补充：若大平台免费做同类能力，你们的护城河还剩什么？\\n• 检验：每条威胁是否对应「监测指标」或「应对预案」一句"}

#Response#
- 只能输出上述四键 JSON，禁止 markdown / 解释；值为字符串（\\n + • 分隔）。
- 须贴合资料关键词；禁止编造具体数据和最终结论；资料不足用「请补充/待验证」引导。
- 禁止写成完整 SWOT 成稿；每条引导宜充实（约 25～80 字），避免只有一句空泛口号。`;

export function buildBusinessModelSwotUserPrompt(contextBundle) {
  return `请基于以下资料输出 SWOT「丰富引导骨架」（严格按 system #Schema#，四键齐全；每维 4～6 条；禁止完整代写）。

###
${String(contextBundle || '').trim() || '（无）'}
###`;
}

export const BUSINESS_MODEL_MARKETING_JSON_SCHEMA = `{
  "product": "产品策略引导（非空，4～6 条，含切入点+待填问句+建议写什么）",
  "price": "价格策略引导（同上）",
  "place": "渠道策略引导（同上）",
  "promotion": "推广策略引导（同上）"
}
四键必须齐全，禁止增删键；四键值必须是字符串。`;

export const BUSINESS_MODEL_MARKETING_SYSTEM_PROMPT = `你是创业实训课程的营销引导助教。

#Context#
根据项目资料（用户、场景、产品形态、调研结论），为学生 4P 提供「丰富的引导骨架」，搭好策略框架，但不要替学生写完整营销文案。

#Objective#
输出 Product/Price/Place/Promotion 四段 JSON。每段 4～6 条引导，尽量覆盖：
1）结合项目的策略切入点（点方向，不下最终方案结论）
2）必须回答的问题（人群、价值、动作、指标）
3）建议写清的要素清单（例如定价结构、渠道漏斗、转化动作）
4）可落地的填写模板或检验标准（怎样算写完整）

#Schema#
${BUSINESS_MODEL_MARKETING_JSON_SCHEMA}

#Examples#
{"product":"• 【切入】先写「为谁解决什么问题到什么可感知效果」，再写功能清单\\n• 请填写：首要用户是谁？其最高频痛点一句话是什么？你们如何可验证地缓解？\\n• 建议写清：核心卖点 1～2 条、首版必做/不做边界、与竞品差异点\\n• 请补充：用户为什么选你们而不是「凑合用现有方案」？\\n• 模板：因为【痛点】，我们提供【方案】，让用户在【场景】获得【可衡量结果】\\n• 检验：陌生人看完能否复述「卖给谁、解决啥、凭什么信」","price":"• 【切入】定价要同时回答：谁付费、付多少、多久付一次、值不值\\n• 请填写：付费主体是个人/机构？客单价区间与对标竞品大致落在哪一档？\\n• 建议写清：定价模式（订阅/单次/抽成/套餐）、免费层与付费层边界、促销规则\\n• 请补充：价格敏感点来自调研的哪一句反馈？如何用套餐降低决策成本？\\n• 模板：【模式】定价，基础档【价】覆盖【权益】，升级档靠【增值】提升 ARPU\\n• 检验：是否写明回本逻辑或「首月可接受的获客成本上限」","place":"• 【切入】渠道按「获客→成交→交付→复购」拆，不要只写「线上+线下」\\n• 请填写：冷启动最可行的 1～2 条获客渠道是什么？谁来执行？\\n• 建议写清：触达方式、转化承接页/话术、交付与售后触点\\n• 请补充：哪条渠道可在 2 周内跑出可复用数据？成功标准是什么？\\n• 模板：通过【渠道】触达【人群】，用【动作】完成首次转化，交付走【路径】\\n• 检验：每条渠道是否对应负责人与关键转化指标","promotion":"• 【切入】推广写「可执行的冷启动动作+衡量指标」，避免只写品牌口号\\n• 请填写：第一周/第一个月各做哪 2～3 个推广动作？预算与人力如何分配？\\n• 建议写清：内容主题、投放/社群/地推选择、转化钩子（试用/优惠/社群）\\n• 请补充：如何衡量曝光→注册→付费的转化？哪个环节最可能卡住？\\n• 模板：用【内容/活动】吸引【人群】，以【钩子】促首单，用【指标】周复盘\\n• 检验：是否能回答「下一周具体做什么、谁做、看什么数」"}

#Response#
- 只能输出上述四键 JSON 对象；值为字符串（\\n + • 分隔），禁止数组、禁止 markdown。
- 须贴合资料；禁止编造不可验证的数据结论；资料不足用待填问题引导。
- 禁止完整代写可交作业长文；每条引导宜充实（约 25～80 字）。`;

export function buildBusinessModelMarketingUserPrompt(contextBundle) {
  return `请基于以下资料输出 4P「丰富引导骨架」（严格按 system #Schema#；四键均为字符串；每段 4～6 条；禁止完整代写）。

###
${String(contextBundle || '').trim() || '（无）'}
###`;
}

/** 引导字段：模型偶发返回 string[] / 嵌套，统一压成多行要点文本 */
function coerceGuideText(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) {
    return v
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object') {
          const t = item.text || item.content || item.tip || item.q || item.question;
          return String(t || JSON.stringify(item)).trim();
        }
        return String(item || '').trim();
      })
      .filter(Boolean)
      .map((line) => (line.startsWith('•') || line.startsWith('-') ? line : `• ${line}`))
      .join('\n');
  }
  if (typeof v === 'object') {
    const t = v.text || v.content || v.tip || v.summary;
    if (t != null) return coerceGuideText(t);
  }
  return String(v).trim();
}

export const BUSINESS_MODEL_FINANCE_ITEMS_JSON_SCHEMA = `{
  "costs": [
    { "category": "固定成本" | "变动成本", "name": "成本项名称", "amount": 月度估算元（正数） }
  ],
  "revenues": [
    { "source": "收入来源名称", "monthly": 月度估算元（正数） }
  ]
}
固定约束：
- costs 至少 5 条、revenues 至少 3 条；条目尽量细化（拆分子项）。
- category 只能是「固定成本」或「变动成本」。
- amount / monthly 必须为正数，单位为元/月的合理量级估算（可基于资料假设）。
- 禁止增删顶层键。`;

export const BUSINESS_MODEL_FINANCE_ITEMS_SYSTEM_PROMPT = `你是创业实训课程的财务引导助教。

#Context#
根据项目背景，为学生罗列可细化的成本项与收入来源，并给出合理月度估算，供学生修改完善。

#Objective#
输出 costs / revenues JSON：条目名称具体 + 正数金额估算（引导用，非最终定稿）。

#Schema#
${BUSINESS_MODEL_FINANCE_ITEMS_JSON_SCHEMA}

#Response#
- 只能输出 costs / revenues 两个键。
- 条目名称具体，避免「其他费用」这类空泛项超过 1 条。
- 金额须 >0，量级贴合校园/初创场景；资料不足时给出合理假设并体现在名称备注中（如「假设…」）。`;

export function buildBusinessModelFinanceItemsUserPrompt(contextBundle) {
  return `请基于以下资料生成细化成本项与收入来源（严格按 system #Schema#；须含正数 amount/monthly）。

###
${String(contextBundle || '').trim() || '（无）'}
###`;
}

function hasSwotShape(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return false;
  return (
    o.strengths != null ||
    o.weaknesses != null ||
    o.opportunities != null ||
    o.threats != null ||
    o['优势'] != null
  );
}

function pickSwotCandidate(parsed, text) {
  if (hasSwotShape(parsed)) return parsed;
  const all = findAllBalancedJsonObjects(String(text || ''));
  for (let i = all.length - 1; i >= 0; i--) {
    if (hasSwotShape(all[i])) return all[i];
  }
  return null;
}

export function normalizeSwotPayload(parsed, text) {
  const raw = pickSwotCandidate(parsed, text) || pickSwotCandidate(extractJsonFromLlmText(text), text);
  if (!raw || typeof raw !== 'object') return { error: 'AI 返回格式无效' };
  const out = {
    strengths: coerceGuideText(raw.strengths ?? raw['优势']),
    weaknesses: coerceGuideText(raw.weaknesses ?? raw['劣势']),
    opportunities: coerceGuideText(raw.opportunities ?? raw['机会']),
    threats: coerceGuideText(raw.threats ?? raw['威胁']),
  };
  if (!out.strengths || !out.weaknesses || !out.opportunities || !out.threats) {
    return { error: 'SWOT 四维存在空内容' };
  }
  return { payload: out };
}

function hasMarketingShape(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return false;
  return (
    o.product != null ||
    o.price != null ||
    o.place != null ||
    o.promotion != null ||
    o.Product != null ||
    o['产品'] != null
  );
}

function pickMarketingCandidate(parsed, text) {
  if (hasMarketingShape(parsed)) return parsed;
  const all = findAllBalancedJsonObjects(String(text || ''));
  for (let i = all.length - 1; i >= 0; i--) {
    if (hasMarketingShape(all[i])) return all[i];
  }
  // extractJsonFromLlmText 偏好带 score 的分析对象，商模引导勿直接依赖其首选结果
  const extracted = extractJsonFromLlmText(text);
  if (hasMarketingShape(extracted)) return extracted;
  return null;
}

export function normalizeMarketingPayload(parsed, text) {
  const raw = pickMarketingCandidate(parsed, text);
  if (!raw || typeof raw !== 'object') return { error: 'AI 返回格式无效' };
  const out = {
    product: coerceGuideText(raw.product ?? raw.Product ?? raw['产品']),
    price: coerceGuideText(raw.price ?? raw.Price ?? raw['价格']),
    place: coerceGuideText(raw.place ?? raw.Place ?? raw.channel ?? raw['渠道']),
    promotion: coerceGuideText(raw.promotion ?? raw.Promotion ?? raw['推广']),
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

function positiveMoney(v, fallback) {
  const n = Number(v);
  if (Number.isFinite(n) && n > 0) return Math.round(n * 100) / 100;
  const fb = Number(fallback);
  return Number.isFinite(fb) && fb > 0 ? fb : 100;
}

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
    // 引导填写须带正数估算；缺省时按类别给默认量级
    const amount = positiveMoney(c.amount ?? c.monthly ?? c.value, cat === '固定成本' ? 2000 : 500);
    costs.push({ category: cat, name, amount });
  }
  for (const r of raw.revenues || []) {
    if (!r || typeof r !== 'object') continue;
    const source = String(r.source || r.name || '').trim();
    if (!source) continue;
    const monthly = positiveMoney(r.monthly ?? r.amount ?? r.value, 3000);
    revenues.push({ source, monthly });
  }
  if (!costs.length && !revenues.length) {
    return { error: '未生成有效的成本或收入条目' };
  }
  const baseId = Date.now();
  const costsWithIds = costs.map((c, i) => ({
    id: baseId + i,
    category: c.category,
    name: c.name,
    amount: c.amount,
  }));
  const revenuesWithIds = revenues.map((r, i) => ({
    id: baseId + costsWithIds.length + i,
    source: r.source,
    monthly: r.monthly,
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
