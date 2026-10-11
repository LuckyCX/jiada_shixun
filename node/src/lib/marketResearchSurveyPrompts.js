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
- 单选/多选：options 必须是字符串数组，2～8 项；每项为完整、可读、可勾选的中文短语（通常 ≥4 个汉字或「数字+单位+说明」），且与**本题题干语义直接对应**，互斥清晰。
- **严禁**把项目描述里的数字碎片当选项（如从「15分钟」抽出「15」、从「RS485」抽出「485」、从「2-4小时」抽出「2」「4」）；严禁无语义的纯数字、协议号片段、英文缩写单独成选项。
- 金额区间必须写成「500-1500元」或「500～1500元」（中间保留「-」或「～」），严禁「5001500」「5001500元」。
- 年龄区间必须写成「18-22岁」或「18～22岁」，严禁「1822」「1822岁」。
- 支付意愿/费用题：选项须含「元」或「免费」等完整表述，禁止只有数字。
- 痛点/功能/身份/场景题：选项须是完整业务表述（如「协议不互通、调试耗时长」），禁止技术参数残片。
- 评分：options 必须为 []。
- 填空：options 必须为 []。
- 必须包含且计入总题数的 4 道统计维度题（题干关键词须保留）：
  1) 年龄分布：单选，题干含「年龄」或「年龄段」
  2) 月均消费：单选，题干含「月」且含「消费」或「花费」
  3) 满意度：评分，题干含「满意度」
  4) 改进需求：单选或多选，题干含「改进」或「最希望」`;

export const MARKET_SURVEY_SYSTEM_PROMPT = buildStructuredSystemPrompt({
  context:
    '你是创业实训课程的市场调研助教。依据小组【项目信息】与【调研目标】设计结构化线上问卷；上传材料仅作补充，无关配置/代码/更新包内容必须忽略。',
  objective:
    '输出可直接入库的问卷 JSON；题量、题型与 4 道统计维度题必须齐全；每道选择题的选项必须是完整中文语义、紧扣题干与项目主题，禁止数字碎片选项。',
  style:
    '题干具体、选项互斥且可读；围绕目标用户痛点、场景、功能与支付意愿出题；区间选项务必保留连字符。',
  schemaBlock: SURVEY_SCHEMA,
  exampleBlock: `{"title":"IoT协议桥接工具需求调研","questions":[{"text":"您的年龄段是？","type":"单选","options":["18岁以下","18-22岁","23-26岁","27-30岁","30岁以上"]},{"text":"您每月在物联网开发相关工具上的平均消费大约为？","type":"单选","options":["500元以下","500-1500元","1500-3000元","3000元以上"]},{"text":"您对目前异构设备调试体验的整体满意度如何？（1-5 分，5 分最满意）","type":"评分","options":[]},{"text":"您最希望改进或优先获得的功能是？","type":"多选","options":["预编译固件一键烧录","可视化协议配置面板","标准化接线文档","社区配置库与适配速度","其他"]},{"text":"您的主要身份角色是？","type":"单选","options":["高校学生/实验室成员","嵌入式DIY爱好者","智能家居集成商","其他从业者"]},{"text":"搭建异构设备网络时您最常遇到的核心痛点是？","type":"单选","options":["协议不互通、调试复杂","资料零散排错耗时","设备兼容性差","接入流程过长","其他"]}]}
（注意：选项均为完整短语；绝不能出现 ["15","485"] 这类从正文截取的碎片。）`,
});

export function buildMarketSurveyUserPrompt(
  planPayload,
  { questionCount, includeTypes },
  { projectTopicText = '', uploadsText = '' } = {}
) {
  const uploadsSection = uploadsText.trim()
    ? `\n【调研数据上传材料】（仅当内容与调研主题相关时参考；若是软件更新配置、接口 JSON、代码片段等无关材料，请完全忽略，勿抽取其中数字/字段名作为选项）\n${uploadsText}\n`
    : '\n【调研数据上传材料】\n（暂无上传文档，请主要依据项目信息与调研目标出题）\n';

  return `请根据【项目信息】与【调研目标】设计线上问卷（上传材料仅作相关补充）。严格按 system #Schema#：questions 恰好 ${questionCount} 道。

【项目信息】（出题与选项的主要依据）
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
- 若总题数大于 4，其余题围绕本项目的身份/角色、使用场景、核心痛点、功能优先级或支付意愿，选项必须完整可读
- 单选/多选每项选项禁止纯数字或协议号碎片（错误示例：["15","485"]；正确示例：["协议不互通、调试复杂","资料零散排错耗时"]）
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
    // 不用 / 分隔，避免拆坏「Zigbee/MQTT」这类合法短语
    return raw
      .split(/[,，、;；|]/)
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

/** 单条选项是否像从正文截出的无意义碎片（如 15、485） */
function optionLooksFragment(opt) {
  const s = String(opt || '').trim();
  if (!s) return true;
  // 纯数字（含协议号片段）
  if (/^\d{1,6}$/.test(s)) return true;
  // 极短无汉字：如 RS、MQTT 单独项可接受，但纯符号/过短英文数字混合且无汉字视为碎片
  if (!/[\u4e00-\u9fff]/.test(s) && s.length <= 4 && /^\d/.test(s)) return true;
  // 「485元」这类仍缺区间语义，留给 expectMoney 规则；此处拦「15分钟」被截成「15」已由纯数字覆盖
  return false;
}

/** 选项是否明显损坏（粘连数字、碎片数字、过短、无区间语义） */
function optionsLookBroken(options, { expectMoney = false, expectAge = false } = {}) {
  if (!Array.isArray(options) || options.length < 2) return true;
  let fragmentCount = 0;
  let hanCount = 0;
  for (const o of options) {
    const s = String(o || '').trim();
    if (!s) return true;
    if (/[\u4e00-\u9fff]/.test(s)) hanCount += 1;
    // 纯数字粘连：5001500 / 1822
    if (/^\d{5,}$/.test(s)) return true;
    if (/^\d{5,}元$/.test(s) || /^\d{4,}岁$/.test(s)) return true;
    if (optionLooksFragment(s)) fragmentCount += 1;
    if (expectMoney && /^\d+$/.test(s)) return true;
    if (expectAge && /^\d{4,}$/.test(s)) return true;
  }
  // 任一碎片数字选项即视为损坏（非金额/年龄区间题）
  if (fragmentCount > 0) return true;
  // 中文问卷：至少一半选项应含汉字，避免全是协议缩写碎片
  if (hanCount < Math.ceil(options.length / 2)) return true;
  if (expectMoney) {
    const hasRangeOrBound = options.some((o) => /[-～~–—]|以下|以上|元|免费/.test(String(o)));
    if (!hasRangeOrBound) return true;
  }
  return false;
}

/**
 * 非统计维度题选项损坏时，按题干关键词给可读兜底，避免 ["15","485"] 入库
 * @param {string} text
 * @param {'单选'|'多选'} type
 * @returns {string[]}
 */
function fallbackOptionsForQuestion(text, type) {
  const t = String(text || '');
  // 选项文案避免使用顿号/逗号，防止 sanitize 时被二次拆分
  if (/身份|角色|职业|人群/.test(t)) {
    return ['高校学生或实验室成员', '嵌入式DIY爱好者', '智能家居集成商', '其他从业者'];
  }
  if (/痛点|困难|挑战|问题|遇到/.test(t)) {
    return ['协议不互通调试复杂', '资料零散排错耗时', '设备兼容性差', '接入流程过长', '其他'];
  }
  if (/支付|付费|费用|价格|愿意|授权/.test(t)) {
    return ['免费试用即可', '50元以下', '50-200元', '200-500元', '500元以上'];
  }
  if (/场景|用途|使用|搭建/.test(t)) {
    return ['个人学习或创客项目', '课程实验或实验室', '商业集成项目', '尚未实际使用'];
  }
  if (/改进|希望|功能|特性/.test(t)) {
    return ['预编译固件与一键烧录', '可视化配置面板', '标准化接线文档', '社区配置库', '其他'];
  }
  if (/协议|Zigbee|MQTT|RS485|设备/.test(t)) {
    return ['跨协议互通困难', '非标协议适配难', '调试工具门槛高', '文档与社区支持不足', '其他'];
  }
  if (type === '多选') {
    return ['非常需要', '比较需要', '一般', '暂不需要', '其他'];
  }
  return ['非常符合', '比较符合', '一般', '不符合', '不确定'];
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
    const cleaned = sanitizeChoiceOptions(q.options);
    if (optionsLookBroken(cleaned)) {
      return { ...q, options: fallbackOptionsForQuestion(q.text, q.type) };
    }
    return { ...q, options: cleaned };
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
      const expectMoney = /消费|花费|支出|费用|支付|付费|价格/.test(text);
      const expectAge = /年龄|年龄段|岁/.test(text);
      // 选项损坏（含 15/485 类碎片）时：维度题用标准选项，其余按题干关键词兜底
      if (optionsLookBroken(options, { expectMoney, expectAge })) {
        const def = ANALYSIS_DIMENSION_DEFAULTS.find((d) => d.pattern.test(text) && d.options.length);
        options = def ? [...def.options] : fallbackOptionsForQuestion(text, type);
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
