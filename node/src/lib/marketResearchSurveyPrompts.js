export const SURVEY_QUESTION_TYPES = ['单选', '多选', '评分', '填空'];

const JSON_SCHEMA = `
仅输出一个 JSON 对象，不要 markdown 或解释。结构：
{
  "title": "问卷标题，须贴合调研目标",
  "questions": [
    {
      "text": "题干",
      "type": "单选|多选|评分|填空",
      "options": ["选项1","选项2"]
    }
  ]
}
规则：
- questions 数量必须等于要求的题目数量。
- type 只能使用用户允许的题型集合中的值。
- 单选、多选：options 至少 2 项，最多 8 项，选项互斥清晰。
- 评分：options 可省略或为空数组，表示 1-5 分李克特量表。
- 填空：options 为空数组。
- 题目须围绕项目信息、调研目标与材料，不要泛泛的无关题。
- 必须包含下列 4 道「数据分析统计维度」题（题干关键词须保留，便于系统生成图表），且计入总题数：
  1）年龄分布：单选，题干含「年龄」或「年龄段」，选项为清晰年龄段；
  2）月均消费分布：单选，题干含「月」且含「消费」或「花费」，选项为消费区间；
  3）满意度分布：评分题（1-5 分），题干含「满意度」；
  4）改进需求排行：单选或多选，题干含「改进」或「最希望」，选项为可排序的需求项（多选时 4-6 项）。`;

export const MARKET_SURVEY_SYSTEM_PROMPT = `你是创业实训课程的市场调研助教，擅长根据小组调研计划设计结构化问卷。
${JSON_SCHEMA}`;

export function buildMarketSurveyUserPrompt(
  planPayload,
  { questionCount, includeTypes },
  { projectTopicText = '', uploadsText = '' } = {}
) {
  const uploadsSection = uploadsText.trim()
    ? `\n${uploadsText}\n`
    : '\n【调研数据上传材料】\n（暂无上传文档，请主要依据项目信息与调研目标出题）\n';

  return `请根据项目信息、调研计划与已收集的调研材料设计线上问卷。

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
- 题目数量：${questionCount} 道（必须严格等于该数量）
- 允许使用的题型：${includeTypes.join('、')}
- 题型分布合理，覆盖目标用户、痛点、需求、行为与态度等维度
- 须包含能区分用户画像的题目：至少 3 道，覆盖身份/角色、使用场景、需求优先级或支付意愿等维度，选项须互斥、便于后续聚类
- 上述 4 道数据分析统计维度题为必答题，不可省略；其余题目围绕项目与调研目标展开`;
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
  if (!Number.isFinite(questionCount) || questionCount < 10 || questionCount > 20) {
    return { error: '题目数量须在 10 至 20 之间' };
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
    let options = Array.isArray(q.options) ? q.options.map((o) => String(o).trim()).filter(Boolean) : [];
    if (type === '单选' || type === '多选') {
      if (options.length < 2) return { error: `第 ${i + 1} 题选项不足` };
      if (options.length > 8) options = options.slice(0, 8);
    } else {
      options = [];
    }
    questions.push({ text, type, options });
  }
  let finalQuestions = ensureAnalysisDimensionQuestions(questions, includeTypes, expectedCount);
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
