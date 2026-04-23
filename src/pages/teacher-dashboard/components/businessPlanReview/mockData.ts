import { BusinessPlan } from './types';

export const mockBusinessPlans: BusinessPlan[] = [
  {
    id: 'bp001',
    teamId: 'team001',
    teamName: '创新先锋队',
    projectName: '智能校园助手',
    submitTime: '2024-01-15 14:30:00',
    status: 'pending',
    executiveSummary: '智能校园助手是一款面向大学生的综合性校园服务平台，通过AI技术整合课程管理、社团活动、校园导航等功能，为学生提供一站式智能服务体验。项目预计在6个月内完成MVP开发，首年目标用户5000人。',
    marketAnalysis: '目标市场为全国高校大学生群体，约4000万潜在用户。当前校园服务类APP市场分散，缺乏综合性解决方案。我们的竞争优势在于AI驱动的个性化推荐和深度整合的校园资源。市场调研显示，78%的学生愿意使用此类产品。',
    productService: '核心功能包括：1) 智能课表管理与提醒 2) 社团活动推荐与报名 3) 校园地图导航 4) 失物招领平台 5) 二手交易市场 6) 学习资源共享。采用微信小程序+APP双端部署，确保用户触达率。',
    marketingStrategy: '采用校园大使推广模式，在10所重点高校建立推广团队。通过社团合作、线下活动、KOL营销等方式快速获客。预计获客成本15元/人，首年营销预算50万元。',
    operationPlan: '团队共8人，包括产品、技术、运营、市场四个部门。开发周期6个月，分三个阶段：MVP开发（2个月）、测试优化（2个月）、规模推广（2个月）。服务器采用云服务，可弹性扩展。',
    financialPlan: '启动资金需求100万元，主要用于产品开发（40万）、市场推广（50万）、运营成本（10万）。收入模式包括广告收入、增值服务、企业合作。预计第二年实现盈亏平衡，第三年营收500万元。',
    teamIntroduction: '创始团队来自计算机、工商管理、设计等专业，具备互补的技能结构。CEO有2年创业经验，CTO曾在腾讯实习，CMO擅长校园营销。团队成员均为全职投入，股权分配合理。',
    riskAnalysis: '主要风险包括：1) 技术开发风险 - 通过敏捷开发和外包降低 2) 市场竞争风险 - 快速迭代保持优势 3) 资金风险 - 寻求天使投资 4) 政策风险 - 确保合规运营。',
    pptUrl: 'https://example.com/business-plan-001.pptx',
    attachments: [
      { name: '商业计划书.pptx', url: 'https://example.com/bp-001.pptx', size: '5.2 MB' },
      { name: '财务预测表.xlsx', url: 'https://example.com/finance-001.xlsx', size: '1.8 MB' }
    ]
  },
  {
    id: 'bp002',
    teamId: 'team002',
    teamName: '绿色未来团队',
    projectName: '环保积分兑换平台',
    submitTime: '2024-01-14 16:45:00',
    status: 'approved',
    reviewComment: '商业计划书内容完整，市场分析深入，财务预测合理。建议在运营计划中补充更详细的风险应对措施。项目具有良好的社会价值和商业潜力，同意进入下一阶段。',
    reviewTime: '2024-01-15 10:20:00',
    reviewer: '张教授',
    executiveSummary: '环保积分兑换平台通过激励机制鼓励用户参与垃圾分类和环保行动，用户可通过环保行为获得积分，兑换商品或服务。项目结合物联网技术和区块链溯源，打造可信的环保生态系统。',
    marketAnalysis: '随着国家垃圾分类政策推进，环保意识提升成为趋势。目标用户为一二线城市居民，约2亿人。现有环保类产品多为公益性质，缺乏商业化运营。我们通过积分经济模型实现可持续发展。',
    productService: '核心功能：智能垃圾分类识别、环保行为记录、积分累积与兑换、环保知识学习、社区环保活动。与社区、商家、回收企业建立合作网络，形成闭环生态。',
    marketingStrategy: '以社区为单位推广，与物业公司合作部署智能回收设备。通过政府补贴、企业赞助降低运营成本。首年目标覆盖50个社区，10万用户。',
    operationPlan: '团队10人，包括技术开发、硬件对接、商务拓展、运营维护。分阶段实施：试点运营（3个月）、区域扩张（6个月）、全国推广（12个月）。',
    financialPlan: '初期投资150万元，用于设备采购（60万）、系统开发（40万）、市场推广（30万）、运营储备（20万）。收入来源：政府补贴、广告收入、数据服务、回收分成。预计18个月回本。',
    teamIntroduction: '团队成员来自环境工程、软件工程、市场营销专业。创始人曾参与多个环保公益项目，具有丰富的行业资源和实践经验。',
    riskAnalysis: '政策依赖风险较高，需密切关注政策变化。技术风险通过与成熟供应商合作降低。用户习惯培养需要时间，前期投入较大。',
    pptUrl: 'https://example.com/business-plan-002.pptx',
    attachments: [
      { name: '商业计划书完整版.pptx', url: 'https://example.com/bp-002.pptx', size: '8.5 MB' }
    ]
  },
  {
    id: 'bp003',
    teamId: 'team003',
    teamName: '健康生活实验室',
    projectName: '智能健康管理系统',
    submitTime: '2024-01-13 09:15:00',
    status: 'rejected',
    reviewComment: '项目创意不错，但商业计划书存在以下问题：1) 市场分析不够深入，缺乏竞品对比 2) 财务预测过于乐观，未充分考虑获客成本 3) 团队医疗背景不足，建议补充专业顾问 4) 盈利模式不清晰。请修改后重新提交。',
    reviewTime: '2024-01-14 15:30:00',
    reviewer: '李教授',
    executiveSummary: '智能健康管理系统通过可穿戴设备和AI算法，为用户提供个性化健康监测和建议。目标用户为关注健康的中青年群体，预计首年用户3万人。',
    marketAnalysis: '健康管理市场规模巨大，用户需求旺盛。我们的产品结合硬件和软件，提供全方位健康服务。',
    productService: '主要功能包括健康数据监测、运动计划制定、饮食建议、睡眠分析等。通过智能手环采集数据，APP端展示分析结果。',
    marketingStrategy: '线上线下结合推广，与健身房、体检中心合作。预计营销费用30万元。',
    operationPlan: '团队6人，开发周期4个月。采用敏捷开发模式，快速迭代。',
    financialPlan: '启动资金80万元，预计第一年营收200万元，第二年实现盈利。',
    teamIntroduction: '团队成员来自计算机和体育专业，对健康管理有浓厚兴趣。',
    riskAnalysis: '主要风险是市场竞争激烈，需要快速占领市场。',
    pptUrl: 'https://example.com/business-plan-003.pptx',
    attachments: [
      { name: '项目计划书.pptx', url: 'https://example.com/bp-003.pptx', size: '3.2 MB' }
    ]
  },
  {
    id: 'bp004',
    teamId: 'team004',
    teamName: '数字教育先锋',
    projectName: '在线编程教育平台',
    submitTime: '2024-01-16 11:20:00',
    status: 'pending',
    executiveSummary: '在线编程教育平台面向K12学生，提供游戏化编程学习体验。通过项目式学习和AI辅导，降低编程学习门槛，培养计算思维。目标首年服务5000名学生，覆盖100所学校。',
    marketAnalysis: '编程教育市场快速增长，政策支持力度大。K12编程教育市场规模超300亿元，年增长率30%。主要竞品包括编程猫、核桃编程等，但市场仍有空间。我们的差异化在于更注重项目实践和创造力培养。',
    productService: '课程体系分为启蒙、基础、进阶三个阶段，涵盖Scratch、Python、Web开发等内容。采用闯关式学习、实时反馈、作品展示等功能。配备AI助教提供24小时答疑。',
    marketingStrategy: 'B2B2C模式，与学校和培训机构合作。通过免费体验课获客，转化率预计20%。线上投放教育类媒体，线下举办编程比赛。首年营销预算60万元。',
    operationPlan: '团队12人，包括课程研发、技术开发、市场销售、客户服务。课程内容由经验丰富的编程教师设计，技术团队负责平台开发和维护。',
    financialPlan: '启动资金120万元，用于课程开发（30万）、平台建设（40万）、市场推广（40万）、运营成本（10万）。收入模式为课程付费，客单价2000元/年。预计第二年营收600万元。',
    teamIntroduction: 'CEO有5年编程教育经验，曾在知名教育机构任教。CTO来自互联网大厂，技术实力强。教研团队由多位资深编程教师组成。',
    riskAnalysis: '市场竞争激烈，需要差异化定位。课程质量是核心竞争力，需持续投入研发。政策变化可能影响市场需求。资金压力较大，需要融资支持。',
    pptUrl: 'https://example.com/business-plan-004.pptx',
    attachments: [
      { name: '商业计划书.pptx', url: 'https://example.com/bp-004.pptx', size: '6.8 MB' },
      { name: '课程大纲.pdf', url: 'https://example.com/course-004.pdf', size: '2.1 MB' }
    ]
  },
  {
    id: 'bp005',
    teamId: 'team005',
    teamName: '智慧农业团队',
    projectName: '农业物联网监测系统',
    submitTime: '2024-01-12 14:00:00',
    status: 'pending',
    executiveSummary: '农业物联网监测系统通过传感器和云平台，实时监测农田环境数据，为农户提供精准种植建议。项目结合大数据分析和专家系统，帮助农户提高产量、降低成本。首期目标服务500个农户。',
    marketAnalysis: '智慧农业是国家重点支持方向，市场潜力巨大。我国有2亿农户，但农业信息化水平较低。现有产品多为高端大型农场设计，价格昂贵。我们针对中小农户，提供性价比高的解决方案。',
    productService: '硬件包括土壤传感器、气象站、摄像头等设备。软件平台提供数据可视化、智能预警、种植建议、病虫害识别等功能。采用订阅制收费，包含设备租赁和平台服务。',
    marketingStrategy: '与农业合作社、农资经销商合作推广。在农业大省建立示范点，通过实际效果吸引用户。政府补贴可覆盖部分成本。首年目标10个县域市场。',
    operationPlan: '团队8人，包括硬件工程师、软件开发、农业专家、市场推广。与农业院校合作，获取专业支持。建立本地化服务团队，提供安装和维护。',
    financialPlan: '初期投资100万元，用于硬件采购（40万）、系统开发（30万）、市场推广（20万）、运营储备（10万）。收费标准1200元/年/户。预计第二年服务2000户，营收240万元。',
    teamIntroduction: '创始人来自农业工程专业，有农村生活经验。技术团队来自物联网和软件工程专业。聘请农业专家作为顾问，确保方案科学性。',
    riskAnalysis: '农户支付能力有限，需要政府补贴支持。设备维护成本较高，需要建立服务网络。农业周期长，回款慢。技术可靠性要求高，需要充分测试。',
    pptUrl: 'https://example.com/business-plan-005.pptx',
    attachments: [
      { name: '商业计划书.pptx', url: 'https://example.com/bp-005.pptx', size: '7.3 MB' },
      { name: '技术方案.pdf', url: 'https://example.com/tech-005.pdf', size: '3.5 MB' }
    ]
  }
];