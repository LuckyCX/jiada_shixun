
export interface QuizQuestion {
  id: string;
  type: 'single' | 'multiple' | 'short';
  question: string;
  options?: string[];
  correctAnswer?: number | number[];
  keywords?: string[];
  score: number;
  explanation: string;
}

export interface QuizConfig {
  moduleId: string;
  moduleName: string;
  knowledgeId: string;
  knowledgeName: string;
  questions: QuizQuestion[];
  passingScore: number;
}

/**
 * Centralised quiz bank.
 * The object is typed as `Record<string, QuizConfig>` to guarantee that each entry
 * conforms to the `QuizConfig` interface.
 *
 * All stray XML‑like tags (`<file>`, `</file>`, etc.) have been removed because
 * they are not valid TypeScript/JavaScript syntax and caused the “Unexpected '/'”
 * parsing error at line 312.
 */
export const quizBank: Record<string, QuizConfig> = {
  k_ideation_1: {
    moduleId: 'ideation',
    moduleName: '创新思维与创意生成',
    knowledgeId: 'k_ideation_1',
    knowledgeName: '头脑风暴法',
    passingScore: 60,
    questions: [
      {
        id: 'q1',
        type: 'single',
        score: 25,
        question: '头脑风暴法的核心原则是什么？',
        options: [
          'A. 立即评价每个创意的可行性',
          'B. 延迟判断，在创意生成阶段禁止批评',
          'C. 只允许专家发言，确保质量',
          'D. 限制创意数量，追求精品',
        ],
        correctAnswer: 1,
        explanation:
          '头脑风暴法的核心原则是"延迟判断"——在创意生成阶段，禁止任何批评和评价，以数量带动质量，鼓励自由联想。',
      },
      {
        id: 'q2',
        type: 'single',
        score: 25,
        question: '头脑风暴中出现"从众效应"时，最有效的解决方案是？',
        options: [
          'A. 让最有经验的人先发言',
          'B. 增加参与人数',
          'C. 让每人先独立思考5分钟再开始讨论',
          'D. 缩短讨论时间',
        ],
        correctAnswer: 2,
        explanation:
          '从众效应是指后发言者倾向于附和先发言者。解决方法是让每人先独立思考并记录想法，再进行集体讨论，避免被他人观点影响。',
      },
      {
        id: 'q3',
        type: 'multiple',
        score: 25,
        question: '以下哪些是头脑风暴法的正确实施步骤？（多选）',
        options: [
          'A. 明确问题陈述，确保所有人理解目标',
          'B. 在发散阶段立即筛选掉不可行的创意',
          'C. 鼓励在他人想法基础上进行延伸和组合',
          'D. 对所有创意进行分类整理后再评估',
        ],
        correctAnswer: [0, 2, 3],
        explanation:
          '正确步骤包括：明确问题→热身→发散（不批评）→整理→评估。在发散阶段不应筛选创意，应保留所有想法。',
      },
      {
        id: 'q4',
        type: 'short',
        score: 25,
        question: '请简述"书面头脑风暴（Brainwriting）"的适用场景及其优势。',
        keywords: ['内向', '从众', '独立', '书面', '多元', '匿名'],
        explanation:
          '书面头脑风暴适用于：①团队中有内向成员；②需要避免从众效应；③希望收集更多独立、多元的想法。优势在于每人独立书写，不受他人影响，能产生更多元化的创意。',
      },
    ],
  },

  k_ideation_2: {
    moduleId: 'ideation',
    moduleName: '创新思维与创意生成',
    knowledgeId: 'k_ideation_2',
    knowledgeName: 'SCAMPER创新法',
    passingScore: 60,
    questions: [
      {
        id: 'q1',
        type: 'single',
        score: 25,
        question: 'SCAMPER中的"S"代表什么创新维度？',
        options: [
          'A. 简化（Simplify）',
          'B. 替代（Substitute）',
          'C. 分割（Split）',
          'D. 同步（Synchronize）',
        ],
        correctAnswer: 1,
        explanation:
          'SCAMPER中S代表Substitute（替代），即用其他材料、成分、流程、人员等替换现有元素，从而产生创新。',
      },
      {
        id: 'q2',
        type: 'multiple',
        score: 25,
        question: 'SCAMPER七大维度包含哪些？（多选）',
        options: [
          'A. 替代（Substitute）',
          'B. 组合（Combine）',
          'C. 评估（Assess）',
          'D. 消除（Eliminate）',
          'E. 重组（Rearrange）',
        ],
        correctAnswer: [0, 1, 3, 4],
        explanation:
          'SCAMPER七大维度：替代(S)、组合(C)、调整(A)、修改/放大/缩小(M)、其他用途(P)、消除(E)、重组/反转(R)。评估不在其中。',
      },
      {
        id: 'q3',
        type: 'single',
        score: 25,
        question: '用SCAMPER的"组合"维度分析智能手机，最合适的创新方向是？',
        options: [
          'A. 去掉手机的摄像头功能',
          'B. 将手机与钱包功能合并，实现移动支付',
          'C. 缩小手机屏幕尺寸',
          'D. 改变手机的颜色',
        ],
        correctAnswer: 1,
        explanation:
          '"组合"是将两种或多种事物合并，产生新价值。将手机与钱包功能合并实现移动支付，是典型的组合创新案例。',
      },
      {
        id: 'q4',
        type: 'short',
        score: 25,
        question:
          '请选择一个日常生活中的产品，运用SCAMPER中任意两个维度进行创新分析，说明创新思路。',
        keywords: ['替代', '组合', '调整', '消除', '重组', '创新', '改进'],
        explanation:
          '运用SCAMPER时，需明确选择的维度，并结合具体产品特征提出有针对性的创新方向，如替代材料、组合功能、消除冗余步骤等。',
      },
    ],
  },

  k_market_1: {
    moduleId: 'market',
    moduleName: '市场调研与用户画像',
    knowledgeId: 'k_market_1',
    knowledgeName: '市场调研方法',
    passingScore: 60,
    questions: [
      {
        id: 'q1',
        type: 'single',
        score: 25,
        question: '以下哪种调研方法属于定性研究？',
        options: [
          'A. 大规模问卷调查',
          'B. 用户深度访谈',
          'C. 销售数据统计分析',
          'D. A/B测试',
        ],
        correctAnswer: 1,
        explanation:
          '定性研究关注"为什么"，通过深度访谈、焦点小组等方式获取深层洞察。问卷、数据统计、A/B测试属于定量研究。',
      },
      {
        id: 'q2',
        type: 'multiple',
        score: 25,
        question: '设计调研问卷时，以下哪些做法是正确的？（多选）',
        options: [
          'A. 问题简洁明了，避免专业术语',
          'B. 在一道题中同时问两个问题',
          'C. 提供"不知道/不适用"选项',
          'D. 先问敏感问题，再问基本信息',
          'E. 对问题进行逻辑排序',
        ],
        correctAnswer: [0, 2, 4],
        explanation:
          '好的问卷设计：问题简洁、提供中性选项、逻辑排序。避免双重问题（一题问两事）和先问敏感问题（会导致受访者抵触）。',
      },
      {
        id: 'q3',
        type: 'single',
        score: 25,
        question: '在市场调研中，"样本量"的选择主要取决于什么？',
        options: [
          'A. 调研预算越多，样本量越大越好',
          'B. 目标人群规模、置信水平和误差范围',
          'C. 调研时间，时间越长样本越多',
          'D. 调研人员数量',
        ],
        correctAnswer: 1,
        explanation:
          '样本量的科学确定需考虑：目标总体规模、所需置信水平（通常95%）、可接受的误差范围（通常±5%）。预算和时间是约束条件，不是决定因素。',
      },
      {
        id: 'q4',
        type: 'short',
        score: 25,
        question:
          '请说明"用户访谈"和"问卷调查"各自的优缺点，以及在什么情况下应优先选择用户访谈。',
        keywords: [
          '深度',
          '定性',
          '灵活',
          '成本',
          '样本',
          '洞察',
          '访谈',
        ],
        explanation:
          '用户访谈优点：获取深层洞察、可追问、发现意外信息；缺点：成本高、样本小、主观性强。问卷优点：样本大、成本低、数据量化；缺点：无法深挖。当需要了解用户深层动机、探索未知问题时，优先选访谈。',
      },
    ],
  },

  k_market_2: {
    moduleId: 'market',
    moduleName: '市场调研与用户画像',
    knowledgeId: 'k_market_2',
    knowledgeName: '用户画像构建',
    passingScore: 60,
    questions: [
      {
        id: 'q1',
        type: 'single',
        score: 30,
        question: '用户画像（Persona）的核心作用是什么？',
        options: [
          'A. 统计用户的年龄和性别分布',
          'B. 将抽象的目标用户具象化，帮助团队形成共同认知',
          'C. 替代真实用户调研',
          'D. 用于市场推广的广告投放',
        ],
        correctAnswer: 1,
        explanation:
          '用户画像的核心价值在于将目标用户具象化，让团队成员对"我们在为谁设计"形成统一认知，从而做出更贴近用户需求的决策。',
      },
      {
        id: 'q2',
        type: 'multiple',
        score: 35,
        question: '一个完整的用户画像通常包含哪些维度？（多选）',
        options: [
          'A. 基本人口统计信息（年龄、职业、收入）',
          'B. 行为特征（使用习惯、购买行为）',
          'C. 痛点与需求',
          'D. 公司财务数据',
          'E. 目标与动机',
        ],
        correctAnswer: [0, 1, 2, 4],
        explanation:
          '用户画像包含：人口统计（年龄/职业/收入）、行为特征、痛点需求、目标动机、使用场景等。公司财务数据属于企业内部数据，不属于用户画像范畴。',
      },
      {
        id: 'q3',
        type: 'short',
        score: 35,
        question:
          '请为一款"面向大学生的校园二手交易App"构建一个典型用户画像，包含基本信息、核心痛点和主要需求。',
        keywords: [
          '大学生',
          '痛点',
          '需求',
          '行为',
          '场景',
          '二手',
          '交易',
        ],
        explanation:
          '典型画像示例：张同学，大二学生，月生活费1500元，痛点：教材贵、宿舍物品积压、闲置物品难处理；需求：低价购买二手教材、快速出售闲置物品、交易安全有保障、同校交易方便取货。',
      },
    ],
  },

  k_product_1: {
    moduleId: 'product',
    moduleName: '产品设计与原型',
    knowledgeId: 'k_product_1',
    knowledgeName: '产品原型设计',
    passingScore: 60,
    questions: [
      {
        id: 'q1',
        type: 'single',
        score: 25,
        question: '低保真原型（Lo-Fi Prototype）的主要用途是什么？',
        options: [
          'A. 用于最终产品的开发参考',
          'B. 快速验证产品概念和用户流程，成本低',
          'C. 展示给投资人的精美演示',
          'D. 进行性能压力测试',
        ],
        correctAnswer: 1,
        explanation:
          '低保真原型（如纸质原型、线框图）的核心价值是快速、低成本地验证产品概念和用户流程，便于早期发现问题并迭代修改。',
      },
      {
        id: 'q2',
        type: 'multiple',
        score: 25,
        question: '以下哪些属于产品原型设计的常用工具？（多选）',
        options: [
          'A. Figma',
          'B. Axure RP',
          'C. 纸和笔（纸质原型）',
          'D. Excel表格',
          'E. Sketch',
        ],
        correctAnswer: [0, 1, 2, 4],
        explanation:
          'Figma、Axure RP、Sketch是专业原型设计工具；纸和笔是最简单的低保真原型工具。Excel主要用于数据处理，不是原型设计工具。',
      },
      {
        id: 'q3',
        type: 'single',
        score: 25,
        question: '在产品设计中，"用户旅程地图"的主要作用是？',
        options: [
          'A. 规划产品的技术架构',
          'B. 可视化用户与产品交互的全流程，发现痛点和机会点',
          'C. 统计用户的地理位置分布',
          'D. 制定产品的定价策略',
        ],
        correctAnswer: 1,
        explanation:
          '用户旅程地图通过可视化用户与产品/服务交互的完整过程（包括行为、情绪、痛点），帮助团队发现改进机会，提升用户体验。',
      },
      {
        id: 'q4',
        type: 'short',
        score: 25,
        question:
          '请说明"MVP（最小可行产品）"的概念，以及为什么创业项目应该先做MVP而不是完整产品。',
        keywords: [
          '最小',
          '验证',
          '假设',
          '成本',
          '迭代',
          '用户',
          '反馈',
        ],
        explanation:
          'MVP是包含核心功能、能验证核心假设的最简版本产品。先做MVP的原因：①降低试错成本；②快速获取真实用户反馈；③避免在错误方向上过度投入；④通过迭代逐步完善产品。',
      },
    ],
  },

  k_business_1: {
    moduleId: 'business',
    moduleName: '商业模式设计',
    knowledgeId: 'k_business_1',
    knowledgeName: '商业模式画布',
    passingScore: 60,
    questions: [
      {
        id: 'q1',
        type: 'single',
        score: 20,
        question: '商业模式画布（BMC）由几个模块组成？',
        options: ['A. 6个', 'B. 7个', 'C. 9个', 'D. 12个'],
        correctAnswer: 2,
        explanation:
          '商业模式画布由9个模块组成：客户细分、价值主张、渠道通路、客户关系、收入来源、核心资源、关键业务、重要合作、成本结构。',
      },
      {
        id: 'q2',
        type: 'multiple',
        score: 30,
        question:
          '商业模式画布的9个模块中，属于"右侧（价值/客户）"部分的是？（多选）',
        options: [
          'A. 客户细分',
          'B. 价值主张',
          'C. 成本结构',
          'D. 渠道通路',
          'E. 客户关系',
        ],
        correctAnswer: [0, 1, 3, 4],
        explanation:
          '画布右侧关注价值交付和客户：客户细分、价值主张、渠道通路、客户关系、收入来源。左侧关注运营效率：核心资源、关键业务、重要合作、成本结构。',
      },
      {
        id: 'q3',
        type: 'single',
        score: 25,
        question: '在商业模式画布中，"价值主张"回答的核心问题是？',
        options: [
          'A. 我们如何赚钱？',
          'B. 我们为客户解决什么问题、提供什么价值？',
          'C. 我们需要哪些合作伙伴？',
          'D. 我们的目标客户是谁？',
        ],
        correctAnswer: 1,
        explanation:
          '价值主张是商业模式的核心，回答"我们为客户创造什么价值？解决什么问题？满足什么需求？"，是连接企业与客户的桥梁。',
      },
      {
        id: 'q4',
        type: 'short',
        score: 25,
        question:
          '请用商业模式画布分析"滴滴出行"的商业模式，至少描述其中4个模块的内容。',
        keywords: [
          '客户',
          '价值',
          '渠道',
          '收入',
          '资源',
          '合作',
          '成本',
        ],
        explanation:
          '滴滴示例：客户细分（乘客+司机双边市场）、价值主张（便捷出行/灵活收入）、渠道通路（App）、收入来源（抽佣+广告）、核心资源（平台+数据+司机）、关键业务（平台运营+算法匹配）。',
      },
    ],
  },

  k_simulation_1: {
    moduleId: 'simulation',
    moduleName: 'AI角色推荐与仿真',
    knowledgeId: 'k_simulation_1',
    knowledgeName: 'AI角色推荐方法',
    passingScore: 60,
    questions: [
      {
        id: 'q1',
        type: 'single',
        score: 25,
        question: '在创业团队中，CTO（首席技术官）的核心职责是？',
        options: [
          'A. 负责公司财务管理和融资',
          'B. 负责技术架构设计和研发团队管理',
          'C. 负责市场推广和品牌建设',
          'D. 负责产品规划和用户体验',
        ],
        correctAnswer: 1,
        explanation:
          'CTO（首席技术官）主要负责：技术战略制定、技术架构设计、研发团队管理、技术选型等。财务是CFO，市场是CMO，产品是CPO的职责。',
      },
      {
        id: 'q2',
        type: 'multiple',
        score: 25,
        question: '一个完整的创业团队通常需要哪些核心角色？（多选）',
        options: [
          'A. CEO（首席执行官）',
          'B. CTO（首席技术官）',
          'C. CMO（首席营销官）',
          'D. 法务顾问',
          'E. CFO（首席财务官）',
        ],
        correctAnswer: [0, 1, 2, 4],
        explanation:
          '创业团队核心角色：CEO（战略决策）、CTO（技术研发）、CMO（市场营销）、CFO（财务管理）。法务顾问通常是外聘，不是核心团队必备角色。',
      },
      {
        id: 'q3',
        type: 'single',
        score: 25,
        question:
          'AI角色推荐系统在分析团队成员时，主要考量哪个维度？',
        options: [
          'A. 成员的外貌和形象',
          'B. 成员的技能特长、性格特点与项目需求的匹配度',
          'C. 成员的家庭背景',
          'D. 成员的学历高低',
        ],
        correctAnswer: 1,
        explanation:
          'AI角色推荐的核心逻辑是：分析项目需求→评估成员技能特长和性格特点→计算匹配度→推荐最优角色分配，实现人岗匹配最优化。',
      },
      {
        id: 'q4',
        type: 'short',
        score: 25,
        question:
          '请说明在创业团队中，为什么角色分工明确对项目成功至关重要？并举例说明角色不清晰可能带来的问题。',
        keywords: [
          '分工',
          '责任',
          '效率',
          '冲突',
          '协作',
          '明确',
          '职责',
        ],
        explanation:
          '角色分工明确的重要性：①避免职责重叠导致的资源浪费；②防止责任真空（没人负责）；③提高决策效率；④减少团队内耗。不清晰的问题：互相推诿、重复劳动、决策混乱、团队矛盾。',
      },
    ],
  },

  k_plan_1: {
    moduleId: 'plan',
    moduleName: '商业计划书与PPT',
    knowledgeId: 'k_plan_1',
    knowledgeName: '商业计划书撰写',
    passingScore: 60,
    questions: [
      {
        id: 'q1',
        type: 'single',
        score: 25,
        question: '一份完整的商业计划书，通常以哪个部分开头？',
        options: ['A. 财务预测', 'B. 执行摘要（Executive Summary）', 'C. 团队介绍', 'D. 市场分析'],
        correctAnswer: 1,
        explanation:
          '商业计划书通常以"执行摘要"开头，用1-2页概括整个计划的核心内容（问题、解决方案、市场、团队、财务），让读者快速了解项目全貌。',
      },
      {
        id: 'q2',
        type: 'multiple',
        score: 25,
        question: '商业计划书中"市场分析"部分应包含哪些内容？（多选）',
        options: [
          'A. 目标市场规模（TAM/SAM/SOM）',
          'B. 竞争对手分析',
          'C. 创始人简历',
          'D. 市场增长趋势',
          'E. 目标客户画像',
        ],
        correctAnswer: [0, 1, 3, 4],
        explanation:
          '市场分析包含：市场规模（TAM全部市场/SAM可服务市场/SOM可获取市场）、竞争分析、市场趋势、目标客户。创始人简历属于团队介绍部分。',
      },
      {
        id: 'q3',
        type: 'single',
        score: 25,
        question: '路演PPT中，每张幻灯片的文字量建议控制在多少字以内？',
        options: ['A. 500字', 'B. 300字', 'C. 100字以内', 'D. 没有限制'],
        correctAnswer: 2,
        explanation:
          '路演PPT的核心原则是"少即是多"，每张幻灯片文字应控制在100字以内，用图表、数据、关键词代替大段文字，让观众聚焦于演讲者的讲解。',
      },
      {
        id: 'q4',
        type: 'short',
        score: 25,
        question:
          '请说明商业计划书中"财务预测"部分的重要性，以及在没有历史数据的情况下，如何合理预测未来3年的收入？',
        keywords: ['假设', '市场', '增长', '收入', '成本', '预测', '模型'],
        explanation:
          '财务预测重要性：展示商业可行性、帮助投资人评估回报。无历史数据时的预测方法：①自上而下（市场规模×渗透率）；②自下而上（单价×用户数×频次）；③对标竞品数据；④明确列出关键假设，让预测可验证。',
      },
    ],
  },
};
