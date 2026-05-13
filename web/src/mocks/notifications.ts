export const notifications = [
  {
    id: '1',
    type: 'guidance',
    sender: {
      name: '张教授',
      avatar: 'https://readdy.ai/api/search-image?query=professional%20chinese%20male%20teacher%20portrait%20with%20glasses%20in%20modern%20office%20simple%20clean%20background%20friendly%20smile&width=100&height=100&seq=teacher-zhang-001&orientation=squarish'
    },
    title: '市场调研模块学习建议',
    content: '你在市场调研环节的问卷设计很有针对性，但建议在用户画像分析时增加更多定量数据支撑。可以参考课程资料中的"数据驱动的用户画像构建"章节，结合SPSS等工具进行深度分析。继续加油！',
    moduleLink: '/student-center?module=market-research',
    moduleName: '市场调研与用户画像',
    timestamp: '2024-01-15 14:30',
    isRead: false
  },
  {
    id: '2',
    type: 'reminder',
    sender: {
      name: '系统管理员',
      avatar: 'https://readdy.ai/api/search-image?query=modern%20system%20admin%20icon%20with%20gear%20and%20notification%20bell%20minimalist%20flat%20design%20blue%20gradient%20background&width=100&height=100&seq=admin-system-002&orientation=squarish'
    },
    title: '学习进度督促提醒',
    content: '检测到你的"商业模式设计"模块学习进度滞后，当前完成率仅为45%，低于班级平均水平（78%）。建议本周内完成商业画布和SWOT分析两个知识点的学习与检测，以免影响后续实训环节。',
    moduleLink: '/student-center?module=business-model',
    moduleName: '商业模式设计',
    timestamp: '2024-01-14 09:00',
    isRead: false
  },
  {
    id: '3',
    type: 'evaluation',
    sender: {
      name: '李老师',
      avatar: 'https://readdy.ai/api/search-image?query=professional%20chinese%20female%20teacher%20portrait%20with%20short%20hair%20in%20bright%20classroom%20simple%20background%20warm%20smile&width=100&height=100&seq=teacher-li-003&orientation=squarish'
    },
    title: '产品原型设计任务评价',
    content: '你提交的产品原型设计完成度很高，交互逻辑清晰，UI设计也很美观。特别是用户注册流程的优化很有创意。建议在下一次迭代中增加无障碍设计考虑，提升产品包容性。',
    score: 92,
    taskName: '产品原型设计V1.0',
    moduleLink: '/student-center?module=product-design',
    moduleName: '产品设计与原型',
    timestamp: '2024-01-13 16:45',
    isRead: true
  },
  {
    id: '4',
    type: 'guidance',
    sender: {
      name: '王教授',
      avatar: 'https://readdy.ai/api/search-image?query=senior%20chinese%20male%20professor%20portrait%20with%20grey%20hair%20in%20university%20office%20professional%20attire%20simple%20background&width=100&height=100&seq=teacher-wang-004&orientation=squarish'
    },
    title: '创新思维训练指导',
    content: '在头脑风暴环节，你的创意数量很多，但质量参差不齐。建议使用SCAMPER法则对每个创意进行系统化改进，重点关注"替代"和"重组"两个维度。另外，可以多参考行业内的创新案例，拓宽思路。',
    moduleLink: '/student-center?module=ideation',
    moduleName: '创新思维与创意生成',
    timestamp: '2024-01-12 11:20',
    isRead: true
  },
  {
    id: '5',
    type: 'evaluation',
    sender: {
      name: '张教授',
      avatar: 'https://readdy.ai/api/search-image?query=professional%20chinese%20male%20teacher%20portrait%20with%20glasses%20in%20modern%20office%20simple%20clean%20background%20friendly%20smile&width=100&height=100&seq=teacher-zhang-001&orientation=squarish'
    },
    title: '商业计划书初稿评价',
    content: '商业计划书整体框架完整，财务预测部分数据详实。但市场分析章节略显薄弱，建议补充竞争对手分析和市场进入策略。另外，团队介绍部分可以更突出核心成员的创业经验和行业资源。',
    score: 85,
    taskName: '商业计划书初稿',
    moduleLink: '/student-center?module=business-plan',
    moduleName: '商业计划书与PPT',
    timestamp: '2024-01-11 10:15',
    isRead: true
  },
  {
    id: '6',
    type: 'reminder',
    sender: {
      name: '系统管理员',
      avatar: 'https://readdy.ai/api/search-image?query=modern%20system%20admin%20icon%20with%20gear%20and%20notification%20bell%20minimalist%20flat%20design%20blue%20gradient%20background&width=100&height=100&seq=admin-system-002&orientation=squarish'
    },
    title: '知识点检测待完成提醒',
    content: '你有3个知识点的达标检测尚未完成：商业模式画布、4P营销策略、成本结构分析。完成检测后才能解锁对应的实训任务。建议先复习相关知识点内容，再进行检测答题。',
    moduleLink: '/student-center?tab=knowledge',
    moduleName: '知识-能力体系',
    timestamp: '2024-01-10 08:30',
    isRead: false
  },
  {
    id: '7',
    type: 'guidance',
    sender: {
      name: '李老师',
      avatar: 'https://readdy.ai/api/search-image?query=professional%20chinese%20female%20teacher%20portrait%20with%20short%20hair%20in%20bright%20classroom%20simple%20background%20warm%20smile&width=100&height=100&seq=teacher-li-003&orientation=squarish'
    },
    title: '团队协作建议',
    content: '观察到你们团队在商业模式设计阶段的协作效率较低，建议明确分工并使用项目管理工具跟踪进度。可以尝试每周召开一次线上会议，同步各成员的工作进展，及时解决遇到的问题。',
    moduleLink: '/student-center?tab=team',
    moduleName: '团队协作',
    timestamp: '2024-01-09 15:00',
    isRead: true
  },
  {
    id: '8',
    type: 'evaluation',
    sender: {
      name: '王教授',
      avatar: 'https://readdy.ai/api/search-image?query=senior%20chinese%20male%20professor%20portrait%20with%20grey%20hair%20in%20university%20office%20professional%20attire%20simple%20background&width=100&height=100&seq=teacher-wang-004&orientation=squarish'
    },
    title: '市场调研报告评价',
    content: '市场调研报告数据收集全面，问卷设计合理，用户画像分析深入。特别是对目标用户痛点的挖掘很到位。建议在竞品分析部分增加SWOT对比表格，使结论更加清晰。',
    score: 88,
    taskName: '市场调研报告V1.0',
    moduleLink: '/student-center?module=market-research',
    moduleName: '市场调研与用户画像',
    timestamp: '2024-01-08 14:20',
    isRead: true
  }
];
