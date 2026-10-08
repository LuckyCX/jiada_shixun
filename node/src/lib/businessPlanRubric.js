/**
 * 创业计划书评分表（课程模板，满分 100）
 */

export const BUSINESS_PLAN_RUBRIC_DIMENSIONS = [
  {
    key: 'innovation',
    title: '创意和创新',
    max: 20,
    description:
      '创意独特性和创新程度高，提出了具有创新性的解决方案；对市场需求的深入理解，发现了潜在的市场机会；提出的创意与现有解决方案有明显区别，具有商业化潜力；商业模式创新，能够为企业带来长期竞争优势。',
    levels: [
      { label: '优秀', range: '16-20分' },
      { label: '良好', range: '12-15分' },
      { label: '一般', range: '8-11分' },
      { label: '需要改进', range: '0-7分' },
    ],
  },
  {
    key: 'market',
    title: '市场分析与用户画像',
    max: 20,
    description:
      '全面分析了目标市场，包括市场规模、增长趋势和市场细分；描述了目标用户的特征、需求和行为，制定了有效的用户画像；对竞争对手进行了全面的分析，包括其产品、定价策略和市场份额；通过市场调研和用户反馈，得出了准确的市场认知。',
    levels: [
      { label: '优秀', range: '16-20分' },
      { label: '良好', range: '12-15分' },
      { label: '一般', range: '8-11分' },
      { label: '需要改进', range: '0-7分' },
    ],
  },
  {
    key: 'businessModel',
    title: '商业模式',
    max: 15,
    description:
      '商业模式清晰明确，包括收入来源、成本结构和盈利模式；商业模式具有创新性和可行性，能够有效解决市场问题；商业模式稳健可靠，能够适应市场变化和未来发展。',
    levels: [
      { label: '优秀', range: '12-15分' },
      { label: '良好', range: '9-11分' },
      { label: '一般', range: '6-8分' },
      { label: '需要改进', range: '0-5分' },
    ],
  },
  {
    key: 'marketing',
    title: '营销策略',
    max: 15,
    description:
      '列出了具体的营销策略和计划，包括目标市场、定位和推广渠道；考虑到了竞争环境和市场需求，制定了有效的营销策略；设定了合理的营销目标和衡量指标，用于评估营销活动效果；营销策略具有针对性和创新性，能够有效推动产品推广。',
    levels: [
      { label: '优秀', range: '12-15分' },
      { label: '良好', range: '9-11分' },
      { label: '一般', range: '6-8分' },
      { label: '需要改进', range: '0-5分' },
    ],
  },
  {
    key: 'teamwork',
    title: '团队沟通与协作',
    max: 20,
    description:
      '团队成员之间的沟通效果良好，信息传递和反馈顺畅有效；团队成员能够有效合作，协调工作并解决问题；团队内部合作默契，能够共同面对挑战和压力；团队有效利用各自的优势，实现了团队目标。',
    levels: [
      { label: '优秀', range: '16-20分' },
      { label: '良好', range: '12-15分' },
      { label: '一般', range: '8-11分' },
      { label: '需要改进', range: '0-7分' },
    ],
  },
  {
    key: 'writing',
    title: '创业计划书文本撰写',
    max: 10,
    description:
      '创业计划书结构清晰，内容完整，逻辑严谨，语言流畅，创业计划书中包含相关的数据和证据支持，增强了可信度和说服力。',
    levels: [
      { label: '优秀', range: '8-10分' },
      { label: '良好', range: '6-7分' },
      { label: '一般', range: '4-5分' },
      { label: '需要改进', range: '0-3分' },
    ],
  },
];

/**
 * 校验并规范化教师打分
 * @param {unknown} raw
 * @returns {{ error?: string, scores?: Record<string, number>, totalScore?: number }}
 */
export function normalizeRubricScores(raw) {
  if (!raw || typeof raw !== 'object') {
    return { error: '请填写各项评分' };
  }
  const scores = {};
  let total = 0;
  for (const dim of BUSINESS_PLAN_RUBRIC_DIMENSIONS) {
    const rawVal = raw[dim.key];
    // 空值不可当作 0：Number('') === 0
    if (rawVal === '' || rawVal === null || rawVal === undefined) {
      return { error: `请填写「${dim.title}」得分` };
    }
    const n = Number(rawVal);
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      return { error: `「${dim.title}」得分须为整数` };
    }
    if (n < 0) {
      return { error: `「${dim.title}」得分不能小于 0` };
    }
    if (n > dim.max) {
      return { error: `「${dim.title}」得分不能超过 ${dim.max}` };
    }
    scores[dim.key] = n;
    total += n;
  }
  if (total > 100) return { error: '总分不能超过 100' };
  return { scores, totalScore: total };
}
