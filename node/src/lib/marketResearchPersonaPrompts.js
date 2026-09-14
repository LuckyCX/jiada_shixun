import { buildStructuredSystemPrompt, padStringList } from './llmJsonOutputRules.js';

const PERSONA_SCHEMA = `{
  "personas": [
    {
      "name": "中文姓名或昵称",
      "age": 16-40 整数,
      "occupation": "职业/身份，非空",
      "major": "专业或背景，非空（未知时填「未知」）",
      "painPoints": ["痛点1", "痛点2", "痛点3"],
      "needs": ["诉求1", "诉求2", "诉求3"],
      "habits": ["习惯1", "习惯2", "习惯3"]
    }
  ]
}
固定约束：
- personas 长度必须为 1 或 2（不得为 0，不得超过 2）。
- 每个画像的 painPoints / needs / habits 均恰好 3 条非空字符串。
- 禁止输出 avatar、id、borderColor、accentColor 等额外字段。
- 内容必须能被问卷材料支撑，禁止编造与材料无关的统计数字。`;

const PERSONA_EXAMPLE = `Output 示例（结构必须一致）：
{"personas":[{"name":"小A","age":20,"occupation":"大学生","major":"市场营销","painPoints":["信息过载难筛选","工具上手成本高","内容产出耗时"],"needs":["快速生成初稿","一键改风格","可控版权风险"],"habits":["每周制作2-3条短视频","月均工具花费50-200元","偏好免费试用后再付费"]}]}`;

export const MARKET_PERSONA_SYSTEM_PROMPT = buildStructuredSystemPrompt({
  context: '你是创业实训课程的用户画像设计助教。输入仅为线上问卷的题目设计与回收统计。',
  objective:
    '生成 1–2 个典型用户画像，覆盖身份、痛点、诉求与消费/使用习惯，供后续人机对抗与产品设计使用。',
  style: '具体、可验证、避免空泛标签；表述短句化。',
  schemaBlock: PERSONA_SCHEMA,
  exampleBlock: PERSONA_EXAMPLE,
});

export function buildMarketPersonaUserPrompt(contextText) {
  return `请生成 1 或 2 个用户画像（严格按 system #Schema#，数组字段各恰好 3 条）。

###
【问卷与回收材料】
${String(contextText || '').trim() || '（无）'}
###`;
}

const BORDER_COLORS = [
  'border-green-200',
  'border-teal-200',
  'border-pink-200',
  'border-amber-200',
  'border-blue-200',
];
const ACCENT_COLORS = [
  'text-green-500',
  'text-teal-500',
  'text-pink-500',
  'text-amber-500',
  'text-blue-500',
];

export function normalizePersonaPayload(raw, startIndex = 0) {
  const list = raw?.personas ?? (Array.isArray(raw) ? raw : null);
  if (!Array.isArray(list) || !list.length) return { error: 'AI 未返回有效画像' };
  const personas = [];
  for (let i = 0; i < list.length && personas.length < 2; i++) {
    const p = list[i];
    if (!p || typeof p !== 'object') continue;
    const name = String(p.name || '').trim();
    if (!name) continue;
    const age = Number(p.age);
    const pickArr = (a, fallbacks) =>
      padStringList(
        Array.isArray(a) ? a.map((s) => String(s).trim()).filter(Boolean) : [],
        3,
        fallbacks
      ).slice(0, 3);
    const idx = startIndex + personas.length;
    personas.push({
      name,
      age: Number.isFinite(age) && age >= 16 && age <= 40 ? Math.round(age) : 20,
      occupation: String(p.occupation || '').trim() || '学生',
      major: String(p.major || '').trim() || '未知',
      painPoints: pickArr(p.painPoints, ['体验摩擦偏高', '决策信息不足', '时间成本偏高']),
      needs: pickArr(p.needs, ['降低上手成本', '提升产出效率', '结果更可控']),
      habits: pickArr(p.habits, ['习惯先试用再付费', '偏好短平快工具', '高频使用移动端']),
      borderColor: BORDER_COLORS[idx % BORDER_COLORS.length],
      accentColor: ACCENT_COLORS[idx % ACCENT_COLORS.length],
      fromSurvey: true,
    });
  }
  if (!personas.length) return { error: 'AI 未返回有效画像' };
  return { personas };
}
