/** 三大能力维度（0–100）与角色匹配 */

export const ROLE_ASSIGNMENT_RULES = `
【评分与角色 — 客观优先，禁止「学生点名」定角】
- 三维得分与 matchedRole 必须以问卷中的客观作答为主：单选/多选题所反映的行为倾向、能力选项、场景选择权重最高。
- 简答题、视频转写中的口语表述仅作辅助证据（表达、经历、逻辑、沟通等），用于微调分数，不得单独决定角色。
- 严禁因学生自述「想当/适合/目标是 CEO、领导、销售总监、财务负责人」等职位愿望而直接分配对应角色；此类表述视为意向，须与选择题所体现的能力画像交叉验证，不一致时以选择题与可验证经历描述为准。
- 视频/script 中的套话、模板化自我介绍（如「我负责销售」「我是技术负责人」）若无问卷与具体事例支撑，不得据此抬高对应维度或强行匹配角色。
- 先独立打出 dimensionScores，再按得分规则推导 matchedRole；不得先定角色再凑分数。
`.trim();

export const DIMENSION_SCORING_PROMPT = `
【能力维度评分 — 必填，禁止全 0】
你必须主要依据「问卷客观作答」、辅以「视频转写稿」中的可验证能力与行为描述，为下列三维度打出 0–100 的整数 dimensionScores；strategic、market、techRisk 不能同时为 0，通常 35–95，最高分与最低分相差建议 ≥ 15。
${ROLE_ASSIGNMENT_RULES}

维度 1：战略统筹力（strategic）
核心：全局决策、团队管理、方向把控、资源整合
对应角色：项目 CEO / 创始人
能力标签：领导力、决策力、规划力、统筹协调、对外对接

维度 2：市场运营力（market）
核心：市场调研、推广策划、获客销售、用户运营、商务变现
对应角色：市场总监、营销运营官、销售负责人
能力标签：市场洞察、营销策划、沟通谈判、渠道拓展、流量运营

维度 3：技术风控力（techRisk）
核心：产品研发设计、逻辑拆解、财务核算、成本管控、风险规避
对应角色：产品/研发负责人、财务负责人
能力标签：逻辑思维、产品设计、数据分析、严谨细致、风控预算

【得分匹配逻辑】（服务端会按下列规则用 dimensionScores 确定 matchedRole，你须给出一致且合理的分数与 focus）：
- strategic 最高 → matchedRole: ceo
- market 最高：marketFocus=strategy → market_director；promotion → marketing_ops；sales → sales
- techRisk 最高：techFocus=product → product_rd；finance → finance

JSON 还须包含：marketFocus（strategy|promotion|sales，仅 market 最高时必填）、techFocus（product|finance，仅 techRisk 最高时必填）。

【输出格式 — 严格遵守】
1）先输出 2–8 段中文分析正文（说明问卷与视频如何支撑各维度得分与角色判断，该部分会展示给学生与教师）。
2）正文结束后空一行，最后一行只输出一个 JSON 对象（不要用 markdown 代码块，JSON 内不要换行），必须包含 dimensionScores、matchedRole、summary、videoTranscript 等字段。
`.trim();

export function scoresArePlausible(scores) {
  const { strategic, market, techRisk } = scores;
  const max = Math.max(strategic, market, techRisk);
  return max >= 25 && strategic + market + techRisk >= 60;
}

/** 展示用：去掉末尾 JSON */
export function narrativeBeforeJson(text) {
  const t = String(text || '').trim();
  if (!t) return '';
  const idx = t.search(/\n\s*\{/);
  if (idx >= 0 && /dimensionScores|matchedRole/i.test(t.slice(idx))) {
    return t.slice(0, idx).trim();
  }
  const lastBrace = t.lastIndexOf('{');
  if (lastBrace > 0 && /dimensionScores|matchedRole/i.test(t.slice(lastBrace))) {
    const head = t.slice(0, lastBrace).trim();
    if (head.length > 20) return head;
  }
  return t.replace(/\n\{[\s\S]*"dimensionScores"[\s\S]*$/i, '').trim() || t;
}

function parseJsonObject(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

/** 从模型全文提取 match JSON（含 dimensionScores） */
export function extractTeamFormationMatchJson(text) {
  const t = String(text || '').trim();
  if (!t) return null;

  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    const o = parseJsonObject(fenced[1].trim());
    if (o && (o.dimensionScores || o.matchedRole)) return o;
  }

  const keyed = t.match(/\{[\s\S]*"dimensionScores"[\s\S]*\}/i);
  if (keyed) {
    const o = parseJsonObject(keyed[0]);
    if (o) return o;
  }

  let start = t.lastIndexOf('{');
  while (start >= 0) {
    let depth = 0;
    for (let i = start; i < t.length; i++) {
      if (t[i] === '{') depth++;
      else if (t[i] === '}') {
        depth--;
        if (depth === 0) {
          const o = parseJsonObject(t.slice(start, i + 1));
          if (o && (o.dimensionScores || o.matchedRole || o.summary)) return o;
          break;
        }
      }
    }
    start = t.lastIndexOf('{', start - 1);
  }

  return tryRegexFieldsFromText(t);
}

function tryRegexFieldsFromText(t) {
  const pick = (key) => {
    const m = t.match(new RegExp(`"${key}"\\s*:\\s*(\\d+)`, 'i'));
    return m ? Number(m[1]) : undefined;
  };
  const strategic = pick('strategic');
  const market = pick('market');
  const techRisk = pick('techRisk');
  if (strategic == null && market == null && techRisk == null) return null;
  const roleM = t.match(/"matchedRole"\s*:\s*"([^"]+)"/i);
  const summaryM = t.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/i);
  const vtM = t.match(/"videoTranscript"\s*:\s*"((?:[^"\\]|\\.)*)"/i);
  return {
    dimensionScores: { strategic, market, techRisk },
    matchedRole: roleM?.[1],
    summary: summaryM?.[1]?.replace(/\\n/g, '\n'),
    videoTranscript: vtM?.[1]?.replace(/\\n/g, '\n'),
  };
}

/** 问卷+视频文本启发式兜底（仅当模型未给出有效分数时） */
export function estimateDimensionScoresFromQa(qaText) {
  const t = String(qaText || '');
  let strategic = 38;
  let market = 38;
  let techRisk = 38;
  const add = (re, n) => {
    const m = t.match(re);
    return m ? n * Math.min(m.length, 4) : 0;
  };
  strategic += add(/领导|决策|统筹|管理|战略|CEO|创始人|团队|规划|对外/gi, 8);
  market += add(/市场|营销|运营|推广|销售|获客|商务|渠道|用户运营|流量/gi, 8);
  techRisk += add(/产品|研发|技术|开发|设计|财务|风控|数据|逻辑|预算|成本/gi, 8);
  const scores = {
    strategic: clampDimensionScore(strategic),
    market: clampDimensionScore(market),
    techRisk: clampDimensionScore(techRisk),
  };
  if (!scoresArePlausible(scores)) {
    scores.strategic = 52;
    scores.market = 48;
    scores.techRisk = 45;
  }
  return scores;
}

export function clampDimensionScore(n) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
}

export function parseDimensionScores(parsed) {
  const ds = parsed?.dimensionScores && typeof parsed.dimensionScores === 'object'
    ? parsed.dimensionScores
    : parsed || {};
  return {
    strategic: clampDimensionScore(ds.strategic ?? ds.strategicCoordination),
    market: clampDimensionScore(ds.market ?? ds.marketOperations),
    techRisk: clampDimensionScore(ds.techRisk ?? ds.techRiskControl),
  };
}

/** 团队互补得分：三维能力组内方差越大得分越高（0～100） */
export function computeComplementScore(profiles) {
  if (!profiles?.length) return 0;
  const n = profiles.length;
  const avgS = profiles.reduce((s, p) => s + (p.strategic || 0), 0) / n;
  const avgM = profiles.reduce((s, p) => s + (p.market || 0), 0) / n;
  const avgT = profiles.reduce((s, p) => s + (p.techRisk || 0), 0) / n;
  const varS = profiles.reduce((s, p) => s + (p.strategic - avgS) ** 2, 0) / n;
  const varM = profiles.reduce((s, p) => s + (p.market - avgM) ** 2, 0) / n;
  const varT = profiles.reduce((s, p) => s + (p.techRisk - avgT) ** 2, 0) / n;
  return Math.round(Math.min(100, (varS + varM + varT) / 30));
}

const VALID_MARKET_FOCUS = new Set(['strategy', 'promotion', 'sales']);
const VALID_TECH_FOCUS = new Set(['product', 'finance']);

export function resolveMatchedRoleFromScores(scores, hints = {}) {
  const { strategic, market, techRisk } = scores;
  if (strategic >= market && strategic >= techRisk) return 'ceo';
  if (market >= techRisk) {
    const f = VALID_MARKET_FOCUS.has(hints.marketFocus) ? hints.marketFocus : 'promotion';
    if (f === 'strategy') return 'market_director';
    if (f === 'sales') return 'sales';
    return 'marketing_ops';
  }
  const f = VALID_TECH_FOCUS.has(hints.techFocus) ? hints.techFocus : 'product';
  return f === 'finance' ? 'finance' : 'product_rd';
}

export function profileFromAnalysisRaw(raw) {
  if (!raw || typeof raw !== 'object') {
    return { strategic: 0, market: 0, techRisk: 0 };
  }
  const match = raw.match && typeof raw.match === 'object' ? raw.match : raw;
  return parseDimensionScores(match);
}
