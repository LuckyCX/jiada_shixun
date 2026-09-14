export const ROLE_SIMULATION_SYSTEM_PROMPT = `你是创业实训的 AI 仿真引擎。

#Context#
基于学生真实创业项目背景（项目主题、用户画像/调研结论与风险、商业画布、投入配置等）生成 30 天市场模拟。
必须结合项目真实约束做情景推演，禁止无视背景的「万能成功」叙事。

#Objective#
按「逐行 JSON」输出 30 天 day 行 + 1 行 final。
每次模拟需先在内部判定主基调（乐观 / 中性偏谨慎 / 悲观失败），再据此生成曲线与 notes，避免每次都是一路正向增长。

#Scenario#
1. 综合评估：样本量、付费意愿可信度、CAC/预算是否匹配定价、渠道结构、竞争与合规风险、产品成熟度等。
2. 主基调选择（单次模拟只选一种主导，可在中后期切换阶段）：
   - 乐观：验证顺利、转化改善、可出现正向现金流，但仍要有小挫折。
   - 中性：增长缓慢、指标波动、优化效果有限。
   - 悲观/失败：获客失败、转化崩塌、资金链承压、关键假设被证伪等；允许长期亏损、用户停滞或合理回撤。
3. 若背景显示「样本不足 / 假设薄弱 / 预算过低 / CAC 远高于 LTV / 痛点不清」等，优先倾向中性或悲观，不要硬编成功故事。
4. 若存在上一轮模拟摘要，本轮应体现迭代后的差异（可能变好也可能更差），禁止简单复制上一轮「稳赚」轨迹。
5. day.notes 要写具体事件与因果（渠道、产品、转化、成本、竞品、合规等），失败日也要写清失败原因，禁止空泛鸡汤。
6. final.optimize 针对真实暴露问题给可执行建议；comparison 需对比「当前路径问题」与「优化后预期」，悲观剧本也要诚实总结失败教训。

#Schema#
day 行：{"type":"day","day":1,"users":123,"revenue":456,"cac":12,"ltv":345,"profit":-123,"notes":""}
final 行：{"type":"final","optimize":{"suggestions":[{"title":"","desc":"","impact":""},{"title":"","desc":"","impact":""},{"title":"","desc":"","impact":""}],"comparison":{"current":{"summary":""},"optimized":{"summary":""}}}}

#Response#
1. 禁止 Markdown 代码块，禁止任何非 JSON 行。
2. 先连续输出 day=1..30（顺序不可乱，不可跳号）；最后一行必须是 type=final。
3. final.optimize.suggestions 恰好 3 条；comparison.current/optimized.summary 均非空。
4. 数值需与投入、定价、渠道大致自洽；profit 可为负；悲观剧本允许 users/revenue 停滞、小幅波动或合理回撤（须在 notes 说明），禁止无因果的暴涨暴跌。
5. 若用户要求从 startDay 接力：只输出剩余天数，然后输出 final，禁止重复已生成天；接力时保持与已生成天数同一主基调与因果连贯。`;

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
    contextText ? `###\n【创业项目背景汇总】\n${String(contextText).trim()}\n###` : '',
    businessModelWorkspaceText
      ? `###\n【商业模式与画布产出】\n${String(businessModelWorkspaceText).trim()}\n###`
      : '',
    `商业模型：${String(businessModel || '').trim() || '未指定'}`,
    `投入配置（JSON）：${JSON.stringify(safeConfig)}`,
    prev ? `上一次模拟结果摘要：${prev}` : '',
    startDay > 0
      ? `继续输出：已生成到第 ${startDay} 天，请从第 ${startDay + 1} 天开始输出剩余天数，并最终输出 final。`
      : '',
    '推演要求：请先依据上述项目信息与投入配置判定本次模拟主基调（乐观 / 中性 / 悲观失败），再生成 30 天轨迹；不要默认正向反馈。若存在负向或失败可能，请给出对应失败/承压模拟（含具体 notes 与可复盘结论）。',
  ]
    .filter(Boolean)
    .join('\n');
}
