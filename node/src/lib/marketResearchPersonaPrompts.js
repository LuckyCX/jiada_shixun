const PERSONA_JSON_SCHEMA = `
仅输出一个 JSON 对象，不要 markdown：
{
  "personas": [
    {
      "name": "姓名",
      "age": 18-30 整数,
      "occupation": "职业/身份",
      "major": "专业或背景",
      "painPoints": ["字符串"],
      "needs": ["字符串"],
      "habits": ["字符串"]
    }
  ]
}
规则：
- personas 数量 1 或 2，须与调研材料一致，不得编造与材料无关的虚构统计。
- 不要输出 avatar URL。`;

export const MARKET_PERSONA_SYSTEM_PROMPT = `你是创业实训课程的用户画像设计助教。仅根据线上问卷的题目设计与回收统计，生成典型用户画像。
${PERSONA_JSON_SCHEMA}`;

export function buildMarketPersonaUserPrompt(contextText) {
  return `请生成 1–2 个用户画像。

${contextText}

输出 JSON。`;
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
    const pickArr = (a) => (Array.isArray(a) ? a.map((s) => String(s).trim()).filter(Boolean) : []);
    const idx = startIndex + personas.length;
    personas.push({
      name,
      age: Number.isFinite(age) && age >= 16 && age <= 40 ? Math.round(age) : 20,
      occupation: String(p.occupation || '').trim() || '学生',
      major: String(p.major || '').trim() || '',
      painPoints: pickArr(p.painPoints),
      needs: pickArr(p.needs),
      habits: pickArr(p.habits),
      borderColor: BORDER_COLORS[idx % BORDER_COLORS.length],
      accentColor: ACCENT_COLORS[idx % ACCENT_COLORS.length],
      fromSurvey: true,
    });
  }
  if (!personas.length) return { error: 'AI 未返回有效画像' };
  return { personas };
}
