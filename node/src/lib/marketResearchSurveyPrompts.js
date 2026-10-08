import { buildStructuredSystemPrompt } from './llmJsonOutputRules.js';

export const SURVEY_QUESTION_TYPES = ['单选', '多选', '评分', '填空'];

const SURVEY_SCHEMA = `{
  "title": "问卷标题（非空，贴合调研目标）",
  "questions": [
    {
      "text": "题干",
      "type": "单选|多选|评分|填空",
      "options": ["选项1","选项2"]
    }
  ]
}
固定约束：
- questions.length 必须严格等于用户要求的题目数量，不得多、不得少。
- type 只能使用用户允许的题型集合中的值。
- 单选/多选：options 必须是字符串数组，2～8 项，互斥清晰；每个选项单独一项，禁止把多项拼进同一个字符串。
- 金额区间必须写成「500-1500元」或「500～1500元」（中间保留「-」或「～」），严禁「5001500」「5001500元」。
- 年龄区间必须写成「18-22岁」或「18～22岁」，严禁「1822」「1822岁」。
- 评分：options 必须为 []。
- 填空：options 必须为 []。
- 必须包含且计入总题数的 4 道统计维度题（题干关键词须保留）：
  1) 年龄分布：单选，题干含「年龄」或「年龄段」
  2) 月均消费：单选，题干含「月」且含「消费」或「花费」
  3) 满意度：评分，题干含「满意度」
  4) 改进需求：单选或多选，题干含「改进」或「最希望」`;

export const MARKET_SURVEY_SYSTEM_PROMPT = buildStructuredSystemPrompt({
  context: '你是创业实训课程的市场调研助教，根据小组调研计划设计结构化线上问卷。',
  objective: '输出可直接入库的问卷 JSON；题量、题型与 4 道统计维度题必须齐全；选项文案规范可读。',
  style: '题干具体、选项互斥，围绕项目与调研目标，避免无关泛题。区间选项务必保留连字符。',
  schemaBlock: SURVEY_SCHEMA,
  exampleBlock: `{"title":"校园内容创作工具需求调研","questions":[{"text":"您的年龄段是？","type":"单选","options":["18岁以下","18-22岁","23-26岁","27-30岁","30岁以上"]},{"text":"您每月可支配消费金额大约为？","type":"单选","options":["500元以下","500-1500元","1500-3000元","3000元以上"]},{"text":"您对相关产品或服务的整体满意度如何？（1-5 分，5 分最满意）","type":"评分","options":[]},{"text":"您最希望改进或优先获得的功能是？","type":"多选","options":["核心功能体验","价格与优惠","客服与售后","内容与教程"]}]}
（示例仅展示维度题结构；实际 questions 总数须等于要求题量。注意 options 中「500-1500元」含连字符，绝不能写成 5001500。）`,
});

export function buildMarketSurveyUserPrompt(
  planPayload,
  { questionCount, includeTypes },
  { projectTopicText = '', uploadsText = '' } = {}
) {
  const uploadsSection = uploadsText.trim()
    ? `\n${uploadsText}\n`
    : '\n【调研数据上传材料】\n（暂无上传文档，请主要依据项目信息与调研目标出题）\n';

  return `请根据项目信息、调研计划与已收集材料设计线上问卷。严格按 system #Schema#：questions 恰好 ${questionCount} 道。

【项目信息】
${projectTopicText || '（尚未提交项目选题）'}

【调研目标】
${planPayload.goal}

【计划采用的调研方法（不含线上问卷本身）】
${(planPayload.methods || []).join('、') || '（未选择）'}

【计划时间】
${planPayload.startDate || ''} 至 ${planPayload.endDate || ''}
${uploadsSection}
【生成要求】
- 题目数量：${questionCount} 道（必须严格等于）
- 允许题型：${includeTypes.join('、')}
- 4 道数据分析统计维度题必须包含且计入上述总题数（不可另加）
- 若总题数大于 4，剩余题目覆盖身份/角色、使用场景、需求优先级或支付意愿等
- 消费/年龄等区间选项必须含「-」或「～」（如 500-1500元、18-22岁），禁止数字粘连（如 5001500）`;
}

/** 常见被模型吃掉连字符的金额/年龄区间 */
const GLUED_RANGE_PAIRS = [
  [500, 1500],
  [1500, 3000],
  [3000, 5000],
  [1000, 2000],
  [1000, 3000],
  [2000, 5000],
  [18, 22],
  [18, 25],
  [22, 25],
  [23, 26],
  [25, 30],
  [27, 30],
];

/**
 * 把 options 统一成字符串数组；兼容模型误把选项写成「A、B、C」单字符串
 * @param {unknown} raw
 * @returns {string[]}
 */
function coerceOptionsArray(raw) {
  if (Array.isArray(raw)) {
    return raw.map((o) => String(o ?? '').trim()).filter(Boolean);
  }
  if (typeof raw === 'string' && raw.trim()) {
    return raw
      .split(/[,，、;；|/]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * 修复「5001500」「5001500元」「1822岁」这类粘连区间
 * @param {string} opt
 */
function repairGluedRangeOption(opt) {
  const trimmed = String(opt || '').trim();
  if (!trimmed) return trimmed;
  // 已有合法区间分隔则只做全角～归一
  if (/[~～\-–—]/.test(trimmed)) {
    return trimmed.replace(/[~～–—]/g, '-');
  }
  const m = trimmed.match(/^(\d+)(元以下|元以上|岁以下|岁以上|元|岁)?$/);
  if (!m) return trimmed;
  const digits = m[1];
  const suffix = m[2] || '';
  // 「500元以下」这类本身合法
  if (suffix.includes('以下') || suffix.includes('以上')) return trimmed;

  for (const [a, b] of GLUED_RANGE_PAIRS) {
    if (digits !== `${a}${b}`) continue;
    const isAge = a >= 10 && a <= 80 && b <= 100;
    if (isAge) return `${a}-${b}岁`;
    return `${a}-${b}元`;
  }
  return trimmed;
}

/**
 * 单选/多选选项清洗：拆串、修粘连、去重
 * @param {unknown} raw
 * @returns {string[]}
 */
function sanitizeChoiceOptions(raw) {
  const coerced = coerceOptionsArray(raw);
  const out = [];
  const seen = new Set();
  for (const item of coerced) {
    // 单项内若仍含顿号，再拆一次
    const parts = /[、，,]/.test(item) ? coerceOptionsArray(item) : [item];
    for (const p of parts) {
      const fixed = repairGluedRangeOption(p);
      if (!fixed || seen.has(fixed)) continue;
      seen.add(fixed);
      out.push(fixed);
    }
  }
  return out;
}

/** 选项是否明显损坏（粘连数字、过短、无区间语义） */
function optionsLookBroken(options, { expectMoney = false, expectAge = false } = {}) {
  if (!Array.isArray(options) || options.length < 2) return true;
  for (const o of options) {
    const s = String(o || '');
    // 纯数字粘连：5001500 / 1822
    if (/^\d{5,}$/.test(s)) return true;
    if (/^\d{5,}元$/.test(s) || /^\d{4,}岁$/.test(s)) return true;
    if (expectMoney && /^\d+$/.test(s)) return true;
    if (expectAge && /^\d{4,}$/.test(s)) return true;
  }
  if (expectMoney) {
    const hasRangeOrBound = options.some((o) => /[-～~–—]|以下|以上|元/.test(String(o)));
    if (!hasRangeOrBound) return true;
  }
  return false;
}

/**
 * 统计维度题若选项损坏，回退为标准选项，避免「5001500」入库
 * @param {Array<{text:string,type:string,options:string[]}>} questions
 */
function repairDimensionQuestionOptions(questions) {
  return questions.map((q) => {
    if (q.type !== '单选' && q.type !== '多选') return q;
    for (const def of ANALYSIS_DIMENSION_DEFAULTS) {
      if (!def.pattern.test(q.text)) continue;
      if (!def.options.length) return q;
      const expectMoney = /消费|花费|支出/.test(def.pattern.source);
      const expectAge = /年龄|年龄段|岁数/.test(def.pattern.source);
      const cleaned = sanitizeChoiceOptions(q.options);
      if (optionsLookBroken(cleaned, { expectMoney, expectAge })) {
        return { ...q, type: def.type === '评分' ? q.type : def.type, options: [...def.options] };
      }
      return { ...q, options: cleaned };
    }
    return { ...q, options: sanitizeChoiceOptions(q.options) };
  });
}

/** 与数据分析图表 deriveChartsFromSurveyBlocks 的关键词规则一致 */
const ANALYSIS_DIMENSION_DEFAULTS = [
  {
    pattern: /年龄|年龄段|岁数/,
    text: '您的年龄段是？',
    type: '单选',
    options: ['18岁以下', '18-22岁', '23-26岁', '27-30岁', '30岁以上'],
  },
  {
    pattern: /消费|花费|支出/,
    text: '您每月可支配消费金额大约为？',
    type: '单选',
    options: ['500元以下', '500-1500元', '1500-3000元', '3000元以上'],
  },
  {
    pattern: /满意/,
    text: '您对相关产品或服务的整体满意度如何？（1-5 分，5 分最满意）',
    type: '评分',
    options: [],
  },
  {
    pattern: /改进|最希望/,
    text: '您最希望改进或优先获得的功能是？',
    type: '多选',
    options: ['核心功能体验', '价格与优惠', '客服与售后', '内容与教程', '协作与组队', '其他'],
  },
];

function hasDimensionQuestion(questions, pattern) {
  return questions.some((q) => pattern.test(String(q.text || '')));
}

function fallbackDimensionDef(def, includeTypes) {
  if (includeTypes.includes(def.type)) return def;
  if (def.type === '评分' && includeTypes.includes('单选') && /满意/.test(def.text)) {
    return {
      ...def,
      type: '单选',
      text: '您对相关产品或服务的整体满意度如何？',
      options: ['1分 非常不满意', '2分', '3分 一般', '4分', '5分 非常满意'],
    };
  }
  if (def.type === '多选' && includeTypes.includes('单选') && /改进|最希望/.test(def.text)) {
    return { ...def, type: '单选', options: def.options.slice(0, 6) };
  }
  return null;
}

function ensureAnalysisDimensionQuestions(questions, includeTypes, expectedCount) {
  let list = [...questions];
  for (const def of ANALYSIS_DIMENSION_DEFAULTS) {
    if (hasDimensionQuestion(list, def.pattern)) continue;
    const use = fallbackDimensionDef(def, includeTypes);
    if (!use) continue;
    list.push({ text: use.text, type: use.type, options: [...use.options] });
  }
  while (list.length > expectedCount) {
    let removed = false;
    for (let i = list.length - 1; i >= 0; i--) {
      const t = list[i].text;
      const isDim = ANALYSIS_DIMENSION_DEFAULTS.some((d) => d.pattern.test(t));
      if (!isDim) {
        list.splice(i, 1);
        removed = true;
        break;
      }
    }
    if (!removed) break;
  }
  return list;
}

export function validateAiGenerateParams(body) {
  const questionCount = Number(body?.questionCount);
  if (!Number.isFinite(questionCount) || questionCount < 4 || questionCount > 20) {
    return { error: '题目数量须在 4 至 20 之间' };
  }
  const includeTypes = Array.isArray(body?.includeTypes)
    ? body.includeTypes.map((t) => String(t).trim()).filter(Boolean)
    : [];
  if (!includeTypes.length) return { error: '请至少选择一种题型' };
  for (const t of includeTypes) {
    if (!SURVEY_QUESTION_TYPES.includes(t)) return { error: `无效题型：${t}` };
  }
  return { questionCount, includeTypes };
}

export function normalizeLlmSurveyPayload(raw, includeTypes, expectedCount) {
  if (!raw || typeof raw !== 'object') return { error: 'AI 返回格式无效' };
  const title = String(raw.title || '').trim();
  if (!title) return { error: 'AI 未返回问卷标题' };
  const questionsIn = Array.isArray(raw.questions) ? raw.questions : [];
  const questions = [];
  for (let i = 0; i < questionsIn.length; i++) {
    const q = questionsIn[i];
    if (!q || typeof q !== 'object') continue;
    const text = String(q.text || '').trim();
    const type = String(q.type || '').trim();
    if (!text) return { error: `第 ${i + 1} 题缺少题干` };
    if (!SURVEY_QUESTION_TYPES.includes(type)) return { error: `第 ${i + 1} 题题型无效` };
    if (!includeTypes.includes(type)) return { error: `第 ${i + 1} 题题型不在所选范围内` };
    let options = [];
    if (type === '单选' || type === '多选') {
      options = sanitizeChoiceOptions(q.options);
      // 消费/年龄题选项仍损坏时，先用标准维度选项兜底，避免直接报错打断生成
      if (optionsLookBroken(options, {
        expectMoney: /消费|花费|支出/.test(text),
        expectAge: /年龄|年龄段|岁/.test(text),
      })) {
        const def = ANALYSIS_DIMENSION_DEFAULTS.find((d) => d.pattern.test(text) && d.options.length);
        if (def) options = [...def.options];
      }
      if (options.length < 2) return { error: `第 ${i + 1} 题选项不足或格式无效，请重试生成` };
      if (options.length > 8) options = options.slice(0, 8);
    }
    questions.push({ text, type, options });
  }
  let finalQuestions = ensureAnalysisDimensionQuestions(questions, includeTypes, expectedCount);
  finalQuestions = repairDimensionQuestionOptions(finalQuestions);
  if (finalQuestions.length < expectedCount) {
    return {
      error: `补全统计维度题后共 ${finalQuestions.length} 道，需要 ${expectedCount} 道，请增加题目数量后重试`,
    };
  }
  if (finalQuestions.length > expectedCount) {
    finalQuestions = finalQuestions.slice(0, expectedCount);
  }
  return { title, questions: finalQuestions };
}
