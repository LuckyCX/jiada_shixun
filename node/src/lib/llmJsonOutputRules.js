/**
 * 千问等模型结构化输出一致性约束（参考平台「文本生成微调」文档）
 * https://platform.qianwenai.com/docs/developer-guides/accuracy-tuning/text-generation
 *
 * 原则：指令清晰、用框架分区、给输出示例、字段数量写死、禁止漏字段/多字段。
 */

/** 所有 JSON 类任务共用的硬约束 */
export const JSON_OUTPUT_HARD_RULES = `
#Response#
- 最终回复只能是一个合法 JSON 对象（或按任务要求的「逐行 JSON」），禁止 markdown 代码块、禁止前言/后记/解释。
- 禁止省略 schema 中的任何键；禁止新增 schema 未列出的键。
- 数组字段必须满足规定的最少/最多条数；不够时用与材料相符的合理补全，不得空数组（除非 schema 明确允许）。
- 字符串字段不得为空串；数字须在规定范围内。
- 若材料信息不足，仍须输出完整 schema，并在对应字段用「材料不足，暂按合理假设：…」类表述，而不是省略字段。`.trim();

/** 用分隔符包裹用户材料 */
export function wrapMaterialBlock(title, body) {
  const t = String(title || '材料').trim();
  const b = String(body || '').trim() || '（无）';
  return `###\n【${t}】\n${b}\n###`;
}

/**
 * 组装 system 提示：Context + Objective +（可选 Style）+ Response schema + 硬规则 +（可选示例）
 */
export function buildStructuredSystemPrompt({
  context,
  objective,
  style = '',
  schemaBlock,
  exampleBlock = '',
}) {
  const parts = [
    `#Context#\n${String(context || '').trim()}`,
    `#Objective#\n${String(objective || '').trim()}`,
  ];
  if (style && String(style).trim()) {
    parts.push(`#Style#\n${String(style).trim()}`);
  }
  parts.push(`#Schema#\n${String(schemaBlock || '').trim()}`);
  if (exampleBlock && String(exampleBlock).trim()) {
    parts.push(`#Examples#\n${String(exampleBlock).trim()}`);
  }
  parts.push(JSON_OUTPUT_HARD_RULES);
  return parts.join('\n\n');
}

/** 将字符串数组补到至少 min 条（用于归一化兜底，与提示词一致） */
export function padStringList(list, min, fallbacks) {
  const out = Array.isArray(list)
    ? list.map((s) => String(s || '').trim()).filter(Boolean)
    : [];
  const fb = Array.isArray(fallbacks) ? fallbacks : ['待补充'];
  let i = 0;
  while (out.length < min && i < 20) {
    const cand = fb[i % fb.length];
    if (!out.includes(cand)) out.push(cand);
    else out.push(`${cand}（${out.length + 1}）`);
    i += 1;
  }
  return out;
}
