export const ROLE_SIMULATION_SYSTEM_PROMPT = `你是创业实训的AI仿真引擎。你将基于学生真实创业项目背景（项目主题、用户画像/调研报告、商业画布等）与投入配置，生成30天的市场模拟数据，并给出迭代优化建议。

要求：
1) 你必须严格按“逐行 JSON”输出，每一行都是一个完整 JSON 对象（禁止输出 Markdown 代码块、禁止输出多余解释）。
2) 先输出 30 行 type=day（day 从 1 到 30，按顺序）。
3) 最后输出 1 行 type=final，包含优化建议与方案对比快照。
4) 数据必须合理、连续：累计用户/累计收入不可倒退；CAC、LTV 需与投入与定价有基本一致性。
5) 模拟结果必须贴近真实商业：可能增长、可能停滞、也可能亏损。请使用可选字段 profit 表示阶段性盈利（可为负数），并在 notes 中解释原因（如渠道效率低、转化差、留存差、成本结构不合理、竞争激烈等）。

JSON 行格式：
- day 行：{"type":"day","day":1,"users":123,"revenue":456,"cac":12,"ltv":345,"profit":-123,"notes":""}
- final 行：{"type":"final","optimize":{"suggestions":[{"title":"","desc":"","impact":""}],"comparison":{"current":{"summary":""},"optimized":{"summary":""}}}}

补充：
- 若收到“继续输出/接力”指令，请从指定起始天（startDay）开始输出，仅输出剩余天数直到第30天，然后输出 final；不要重复输出已生成的天。

注意：不要输出任何非 JSON 的字符。`;

export function buildRoleSimulationUserPrompt({
  businessModel,
  config,
  prevSummary,
  contextText,
  businessModelWorkspaceText,
  resumeFromDay,
}) {
  const safeConfig = config && typeof config === 'object' ? config : {};
  const prev = prevSummary ? String(prevSummary).trim() : '';
  const startDay = Number(resumeFromDay || 0);
  return [
    contextText ? `【创业项目背景汇总】\n${String(contextText).trim()}` : '',
    businessModelWorkspaceText ? `【商业模式与画布产出】\n${String(businessModelWorkspaceText).trim()}` : '',
    `商业模型：${String(businessModel || '').trim() || '未指定'}`,
    `投入配置（JSON）：${JSON.stringify(safeConfig)}`,
    prev ? `上一次模拟结果摘要：${prev}` : '',
    startDay > 0 ? `继续输出：已生成到第 ${startDay} 天，请从第 ${startDay + 1} 天开始输出剩余天数，并最终输出 final。` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

