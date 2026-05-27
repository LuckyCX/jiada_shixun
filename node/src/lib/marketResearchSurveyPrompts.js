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
- 题目须围绕调研目标与选定方法，不要泛泛的无关题。`;

export const MARKET_SURVEY_SYSTEM_PROMPT = `你是创业实训课程的市场调研助教，擅长根据小组调研计划设计结构化问卷。
${JSON_SCHEMA}`;

export function buildMarketSurveyUserPrompt(planPayload, { questionCount, includeTypes }) {
  return `请根据以下已保存的调研计划设计问卷。

【调研目标】
${planPayload.goal}

【调研方法】
${(planPayload.methods || []).join('、')}

【计划时间】
${planPayload.startDate || ''} 至 ${planPayload.endDate || ''}

【任务分工】
${JSON.stringify(planPayload.assignments || [], null, 2)}

【生成要求】
- 题目数量：${questionCount} 道（必须严格等于该数量）
- 允许使用的题型：${includeTypes.join('、')}
- 题型分布合理，覆盖目标用户、痛点、需求、行为与态度等维度`;
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
  if (questions.length !== expectedCount) {
    return { error: `AI 返回 ${questions.length} 道题，需要 ${expectedCount} 道，请重试` };
  }
  return { title, questions };
}
