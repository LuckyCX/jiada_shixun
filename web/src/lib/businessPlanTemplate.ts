/** 与后端 businessPlanSections / businessPlanRubric 对齐的前端常量 */

export type BusinessPlanCover = {
  projectName: string;
  leader: string;
  members: string[];
  collegeClass: string;
  advisor: string;
  dateYear: string;
  dateMonth: string;
  dateDay: string;
};

export const BUSINESS_PLAN_SECTION_GROUPS = [
  { key: 'g1', title: '一、市场调研与用户画像' },
  { key: 'g2', title: '二、产品设计：传承与创新' },
  { key: 'g3', title: '三、商业模式与营销策略' },
  { key: 'g4', title: '四、财务成本分析' },
] as const;

export const BUSINESS_PLAN_SECTION_DEFS = [
  { key: 's1_1', title: '1.1 市场痛点与机会分析', groupKey: 'g1', guide: '说明目标用户面临的核心痛点、未被满足的需求，以及由此产生的市场机会。' },
  { key: 's1_2', title: '1.2 目标市场界定与规模预估', groupKey: 'g1', guide: '界定目标市场边界（地域/人群/场景），并给出可核对的规模预估与依据。' },
  { key: 's1_3', title: '1.3 主要竞争对手与替代品分析', groupKey: 'g1', guide: '梳理主要竞品与替代方案，对比产品、定价、渠道与优劣势。' },
  { key: 's1_4_1', title: '1.4.1 基本信息（年龄、职业、收入、地域等）', groupKey: 'g1', guide: '为 1～2 个典型用户角色填写基本人口与社会属性信息。' },
  { key: 's1_4_2', title: '1.4.2 用户场景与核心需求', groupKey: 'g1', guide: '描述典型使用场景、触发条件与核心待办/需求。' },
  { key: 's1_4_3', title: '1.4.3 消费行为与价值观洞察', groupKey: 'g1', guide: '分析消费决策偏好、价格敏感度与价值观取向。' },
  { key: 's2_1', title: '2.1 产品/服务核心价值主张', groupKey: 'g2', guide: '一句话到一段话说清为谁、解决什么、独特价值是什么。' },
  { key: 's2_2', title: '2.2 “传承”要素分析', groupKey: 'g2', guide: '说明对经典文化、传统工艺、现有技术或既有模式的继承点。' },
  { key: 's2_3', title: '2.3 “创新”要素设计', groupKey: 'g2', guide: '说明功能、技术、设计、体验或商业模式上的创新点。' },
  { key: 's2_4', title: '2.4 产品描述与原型展示', groupKey: 'g2', guide: '描述产品形态与关键功能；可图文结合说明原型/界面/流程。' },
  { key: 's3_1', title: '3.1 商业模式画布', groupKey: 'g3', guide: '围绕客户细分、价值主张、渠道、收入与成本等要素说明商业模式。' },
  { key: 's3_2_1', title: '3.2.1 产品策略（线规划、品牌故事）', groupKey: 'g3', guide: '说明产品线规划、品牌定位与品牌故事。' },
  { key: 's3_2_2', title: '3.2.2 价格策略（定价方法与依据）', groupKey: 'g3', guide: '给出定价方法、价格带及依据（成本、竞品、用户支付意愿等）。' },
  { key: 's3_2_3', title: '3.2.3 渠道策略（线上线下销售/分发渠道）', groupKey: 'g3', guide: '说明线上线下销售或分发渠道选择与协同方式。' },
  { key: 's3_2_4', title: '3.2.4 推广策略（启动期关键活动与预算分配）', groupKey: 'g3', guide: '列出启动期关键推广活动及预算分配思路。' },
  { key: 's4_1_1', title: '4.1.1 固定成本（场地、设备、人员工资等）', groupKey: 'g4', guide: '列出主要固定成本项及粗略金额区间。' },
  { key: 's4_1_2', title: '4.1.2 可变成本（原材料、生产、营销费用等）', groupKey: 'g4', guide: '列出随销量变化的主要可变成本项。' },
  { key: 's4_2', title: '4.2 启动资金需求预估', groupKey: 'g4', guide: '汇总启动阶段资金需求，说明用途构成。' },
  { key: 's4_3', title: '4.3 盈亏平衡点初步测算', groupKey: 'g4', guide: '给出盈亏平衡点的初步测算思路与结果（可含假设说明）。' },
] as const;

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
] as const;

/** 日后恢复结构工具 / AI 填充时改为 true */
export const SHOW_BP_STRUCTURE_TOOLS = false;
export const SHOW_BP_AI_FILL = false;

export function defaultCover(): BusinessPlanCover {
  return {
    projectName: '',
    leader: '',
    members: [],
    collegeClass: '',
    advisor: '',
    dateYear: '',
    dateMonth: '',
    dateDay: '',
  };
}

export function guideForSectionKey(key: string): string {
  return BUSINESS_PLAN_SECTION_DEFS.find((d) => d.key === key)?.guide || '';
}
