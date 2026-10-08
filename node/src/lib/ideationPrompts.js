import { buildStructuredSystemPrompt, padStringList } from './llmJsonOutputRules.js';

const IDEATION_SCHEMA = `{
  "title": "字符串",
  "description": "字符串",
  "overallScore": 0-100 整数,
  "novelty": 0-5 数字,
  "feasibility": 0-5 数字,
  "marketPotential": 0-5 数字,
  "innovation": 0-5 数字,
  "summary": "120字以内综合分析，非空",
  "strengths": ["优势1", "优势2", "优势3"],
  "weaknesses": ["待改进1", "待改进2", "待改进3"],
  "suggestions": ["建议1", "建议2", "建议3"],
  "tags": ["标签1", "标签2", "标签3"]
}
固定数量：strengths / weaknesses / suggestions / tags 均恰好 3 项（不得 2 项、不得 4 项以上）。
评分须体现差异，禁止全部满分。`;

const IDEATION_EXAMPLE = `Input 摘要：标题「校园二手教材流转」、描述「同学间按需交换教材」
Output：
{"title":"校园二手教材流转","description":"同学间按需交换教材","overallScore":62,"novelty":3.2,"feasibility":3.5,"marketPotential":3.0,"innovation":3.1,"summary":"方向贴近校园刚需，但差异化与履约机制仍需打磨。","strengths":["场景清晰、用户可达","交易成本较低","利于循环利用"],"weaknesses":["供给不稳定","信任与品控不足","变现路径弱"],"suggestions":["先做单学院试点","建立品相分级与担保","补充履约与售后规则"],"tags":["校园","二手","共享"]}`;

function methodPrompt(roleLine, focusLine) {
  return buildStructuredSystemPrompt({
    context: roleLine,
    objective: `${focusLine}\n根据用户消息中的「方法」与「学生原始表单」完成评估，输出完整 JSON。`,
    style: '专业、具体、可执行；避免空泛套话。',
    schemaBlock: IDEATION_SCHEMA,
    exampleBlock: IDEATION_EXAMPLE,
  });
}

export const IDEATION_METHOD_LABELS = {
  brainstorm: '头脑风暴',
  scamper: 'SCAMPER',
  triz: 'TRIZ',
  ai: 'AI创意',
  six_hats: '六帽创想室',
};

export const IDEATION_METHOD_PROMPTS = {
  brainstorm: methodPrompt(
    '你是创业实训课程的创新教练，使用头脑风暴法评估学生创业创意。',
    '重点评估：发散性、问题价值、目标用户清晰度、初步落地可能性，并给出可执行优化建议。title/description 可与用户表单一致。'
  ),
  scamper: methodPrompt(
    '你是创业实训课程的产品创新顾问，使用 SCAMPER 方法评估学生创意。',
    '结合学生选择的 SCAMPER 维度，判断是否有效体现替代、组合、调整、修改、用途拓展、消除或重组等路径。title/description 可与用户表单一致。'
  ),
  triz: methodPrompt(
    '你是创业实训课程的 TRIZ 创新方法导师。',
    '重点识别问题矛盾、方案与矛盾匹配度、创新原理运用质量、落地风险，并给出改进建议。title/description 可与用户表单一致。'
  ),
  ai: methodPrompt(
    '你是创业实训课程的 AI 创意生成与评估专家。',
    '基于目标领域、目标用户和核心需求生成高质量创业创意并完成结构化评估。title 与 description 必须是你生成的创意内容，不得照抄空泛占位。'
  ),
  six_hats: methodPrompt(
    '你是创业实训课程的六顶思考帽创新教练。学生工作区里是六帽讨论中摘录的原始笔记（可能冗长、口语化、字段错位），你必须先做汇总再评估。',
    [
      '禁止把工作区原文整段复制为 title 或 description。',
      'title：凝练成 8–24 字的创业创意名称（产品/方案名），不得是用户感想长文。',
      'description：用 120–280 字结构化概述，建议包含「问题—用户—方案—差异/风险」四句，语言简洁专业。',
      '评估重点：问题洞察是否扎实、用户价值是否清晰、方案是否可落地、风险与差异是否被认真审视。',
      '评分与 strengths/weaknesses/suggestions/tags 须基于你汇总后的创意，而非照搬笔记。',
    ].join('')
  ),
};

export function getIdeationMethodPrompt(methodKey) {
  return IDEATION_METHOD_PROMPTS[methodKey] || null;
}

/** 供路由 normalize 时对齐「恰好 3 项」 */
export function padIdeationStringList(list) {
  return padStringList(list, 3, ['待补充要点', '需进一步明确', '建议继续验证']).slice(0, 3);
}
