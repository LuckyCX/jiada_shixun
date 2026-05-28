import { extractJsonFromLlmText } from './marketResearchSse.js';
import { coerceSections } from './businessPlanSections.js';

export const BUSINESS_PLAN_GENERATE_JSON_SCHEMA = `
最终必须输出且仅输出一个 JSON 对象（不要用 markdown 代码块包裹）。字段：
{
  "sections": [
    { "key": "与输入章节一致", "title": "章节标题", "content": "..." }
  ]
}
要求：
- sections 必须与「输入的章节列表」一一对应：key 必须使用输入提供的 key；title 使用输入标题（可原样返回）；不得丢章节、不得新增章节。
- 各 content 为非空字符串（可含 \\n 与 • 列表）；内容须基于给定资料，勿编造与资料明显矛盾的数据；资料不足处可简要说明假设。`;

export const BUSINESS_PLAN_GENERATE_SYSTEM_PROMPT = `你是创业实训课程的商业计划书助教。根据小组前期实训产出，按给定章节列表撰写商业计划书要点。

${BUSINESS_PLAN_GENERATE_JSON_SCHEMA}`;

export const BUSINESS_PLAN_FILL_SECTION_SYSTEM_PROMPT = `你是创业实训课程的商业计划书助教。你将只填充一个章节的内容。

最终必须输出且仅输出一个 JSON 对象（不要用 markdown 代码块包裹）。字段：
{
  "key": "章节 key（与输入一致）",
  "content": "章节内容（非空字符串）"
}
要求：
- content 可含 \\n 与列表；内容须基于给定资料，勿编造与资料明显矛盾的数据；资料不足处可简要说明合理假设。`;

export function buildBusinessPlanGenerateUserPrompt(contextBundle, sections) {
  const list = coerceSections(sections).map((s) => ({ key: s.key, title: s.title }));
  return `请基于以下资料，为「输入章节列表」生成对应章节内容。严格按 system 中的 JSON schema 输出。

【输入章节列表（必须逐项生成，key 不得变更）】
${JSON.stringify(list, null, 2)}

${String(contextBundle || '').trim()}`;
}

export function buildBusinessPlanFillSectionUserPrompt(contextBundle, sections, sectionKey, mode) {
  const list = coerceSections(sections).map((s) => ({ key: s.key, title: s.title }));
  const key = String(sectionKey || '').trim();
  const m = String(mode || '').trim() === 'expand' ? 'expand' : 'overwrite';
  const current = coerceSections(sections).find((s) => s.key === key);
  const currentTitle = current?.title || key;
  const currentContent = String(current?.content || '').trim();
  return `你将只生成一个章节（key=${key}）的 content，不要生成其它章节。

【章节填充模式】
- overwrite：整体重写该章节内容
- expand：在已有文案基础上扩写与完善，保留原有信息点并补充细节
本次模式：${m}

【输入章节列表（仅作上下文，key 不得变更）】
${JSON.stringify(list, null, 2)}

【目标章节】
key: ${key}
title: ${currentTitle}
已有内容（可能为空）：
${currentContent || '（空）'}

【输出要求】
- 最终必须输出且仅输出一个 JSON 对象（不要用 markdown 代码块包裹）
- 格式：{ \"key\": \"${key}\", \"content\": \"...\" }
- content 必须为非空字符串，可包含换行与列表；内容须基于给定资料，勿编造与资料明显矛盾的数据；资料不足处可简要说明合理假设。

【前期实训参考资料】
${String(contextBundle || '').trim()}`;
}

export const BUSINESS_PLAN_ANALYZE_SYSTEM_PROMPT = `你是创业实训课程的商业计划书评审助教。根据计划书正文与前期实训资料，输出结构化评审报告（纯文本 Markdown 风格，勿 JSON）。

报告须包含：
一、整体评价（含 0-100 质量分）
二、优点分析（分条）
三、改进建议（分条、可执行）
四、关键指标评估（市场分析、产品服务、商业模式、营销策略、财务规划、团队介绍，各 1-5 星简述）
五、下一步行动建议

语言简洁专业，勿空泛套话。`;

export const BUSINESS_PLAN_ANALYZE_JSON_SYSTEM_PROMPT = `你是创业实训课程的商业计划书评审助教。你需要输出结构化评审数据（JSON），用于页面展示。

最终必须输出且仅输出一个 JSON 对象（不要用 markdown 代码块包裹）。字段：
{
  "score": 0-100 的整数,
  "overall": "整体评价（1-3句话）",
  "strengths": ["优点1", "优点2", "..."],
  "improvements": ["改进建议1", "改进建议2", "..."],
  "metrics": [
    { "name": "市场分析", "stars": 1-5, "comment": "一句简评" },
    { "name": "产品服务", "stars": 1-5, "comment": "一句简评" },
    { "name": "商业模式", "stars": 1-5, "comment": "一句简评" },
    { "name": "营销策略", "stars": 1-5, "comment": "一句简评" },
    { "name": "财务规划", "stars": 1-5, "comment": "一句简评" },
    { "name": "团队介绍", "stars": 1-5, "comment": "一句简评" }
  ],
  "nextActions": ["下一步行动1", "下一步行动2", "..."]
}

要求：
- strengths/improvements/nextActions 每项为可执行的具体表述，避免空泛。
- metrics 必须包含上述 6 个 name，stars 为整数 1-5。`;

export function buildBusinessPlanAnalyzeUserPrompt(analyzeBundle) {
  return String(analyzeBundle || '').trim();
}

export function normalizeGeneratePayload(text) {
  const parsed = extractJsonFromLlmText(String(text || ''));
  if (!parsed || !Array.isArray(parsed.sections)) {
    throw new Error('AI 返回格式无效，请稍后重试');
  }
  return coerceSections(parsed.sections);
}
