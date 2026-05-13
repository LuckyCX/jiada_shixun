import { useState } from 'react';
import VersionControl, { Version } from '../../../components/feature/VersionControl';

const learningResources = [
  { title: '创新思维基础理论', type: '视频', duration: '45分钟', progress: 100 },
  { title: 'SCAMPER创新方法详解', type: '文档', duration: '20分钟', progress: 80 },
  { title: '头脑风暴实战案例', type: '视频', duration: '30分钟', progress: 60 },
  { title: 'TRIZ创新原理应用', type: '文档', duration: '25分钟', progress: 0 },
];

const initialIdeas = [
  {
    id: 1,
    title: '智能校园外卖配送机器人',
    description: '利用自动驾驶技术，在校园内实现无人配送，解决高峰期配送慢的问题',
    method: '头脑风暴',
    author: '张明',
    votes: 12,
    novelty: 4.5,
    feasibility: 3.8,
  },
  {
    id: 2,
    title: '大学生二手教材交易平台',
    description: '基于区块链的可信二手书交易平台，解决教材浪费和价格不透明问题',
    method: 'SCAMPER',
    author: '李娜',
    votes: 8,
    novelty: 3.9,
    feasibility: 4.2,
  },
  {
    id: 3,
    title: 'AI驱动的个性化学习助手',
    description: '根据学生学习习惯和知识掌握情况，智能推荐学习内容和路径',
    method: 'AI创意',
    author: '王强',
    votes: 15,
    novelty: 4.8,
    feasibility: 3.5,
  },
];

const chatMessages = [
  { name: '张明', color: 'from-teal-500 to-cyan-500', text: '我觉得校园配送机器人这个方向很有潜力', time: '2分钟前' },
  { name: '李娜', color: 'from-purple-500 to-violet-500', text: '同意，我们可以先做市场调研', time: '5分钟前' },
  { name: '王强', color: 'from-orange-500 to-amber-500', text: 'AI学习助手的需求也很大，值得深入研究', time: '8分钟前' },
];

type AiAnalysis = {
  overallScore: number;
  novelty: number;
  feasibility: number;
  marketPotential: number;
  innovation: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  tags: string[];
};

type Idea = {
  id: number;
  title: string;
  description: string;
  method: string;
  author: string;
  votes: number;
  novelty: number;
  feasibility: number;
  aiAnalysis?: AiAnalysis;
  analyzing?: boolean;
};

// AI分析模拟数据库
const aiAnalysisTemplates: AiAnalysis[] = [
  {
    overallScore: 87,
    novelty: 4.5,
    feasibility: 3.8,
    marketPotential: 4.2,
    innovation: 4.6,
    summary: '该创意具有较强的技术创新性，切中校园配送痛点，市场需求明确。自动驾驶技术在封闭园区内的应用场景成熟度较高，具备落地可行性。',
    strengths: ['解决真实痛点，需求明确', '技术路径清晰，封闭场景降低难度', '可扩展至多校园，规模效应显著'],
    weaknesses: ['初期硬件成本较高', '需要与校方协调场地和政策', '维护运营团队要求较高'],
    suggestions: ['建议先做1-2台机器人的MVP验证', '可与学校后勤部门合作降低准入门槛', '考虑与外卖平台合作引流，降低获客成本'],
    tags: ['硬科技', '校园场景', '自动化'],
  },
  {
    overallScore: 79,
    novelty: 3.9,
    feasibility: 4.2,
    marketPotential: 3.8,
    innovation: 3.7,
    summary: '二手教材交易平台需求真实，区块链赋能可信度提升是亮点。但市场已有竞品，需要在差异化上下功夫，建议聚焦高校特定场景深耕。',
    strengths: ['市场需求验证充分', '区块链增信是差异化亮点', '运营成本低，轻资产模式'],
    weaknesses: ['竞品较多，闲鱼等平台已有布局', '区块链技术门槛较高', '用户教育成本不低'],
    suggestions: ['聚焦单一高校做深，再横向扩展', '简化区块链体验，用户无需感知底层技术', '增加教材评价和笔记共享功能提升粘性'],
    tags: ['平台经济', '区块链', '教育'],
  },
  {
    overallScore: 92,
    novelty: 4.8,
    feasibility: 3.5,
    marketPotential: 4.7,
    innovation: 4.9,
    summary: 'AI个性化学习助手赛道热度极高，技术可行性强。该创意在个性化推荐和知识图谱构建上有明显优势，但需注意数据隐私合规和冷启动问题。',
    strengths: ['AI技术趋势契合，资本关注度高', '个性化需求普遍，用户基数大', '数据飞轮效应强，越用越智能'],
    weaknesses: ['冷启动数据积累周期长', '大厂竞争激烈（字节、腾讯均有布局）', '数据隐私合规要求严格'],
    suggestions: ['选择细分赛道切入，如考研/四六级专项', '与高校合作获取脱敏学习数据', '先做工具型产品积累用户，再做平台化'],
    tags: ['AI+教育', '个性化', '高潜力'],
  },
];

function generateAiAnalysis(idea: Idea): AiAnalysis {
  const template = aiAnalysisTemplates[idea.id % aiAnalysisTemplates.length];
  const titleLen = idea.title.length;
  const descLen = idea.description.length;
  const bonus = Math.min((titleLen + descLen) / 100, 0.3);
  return {
    ...template,
    overallScore: Math.min(99, Math.round(template.overallScore + bonus * 5)),
    novelty: Math.min(5, parseFloat((template.novelty + bonus * 0.2).toFixed(1))),
    feasibility: Math.min(5, parseFloat((template.feasibility + bonus * 0.1).toFixed(1))),
    marketPotential: Math.min(5, parseFloat((template.marketPotential + bonus * 0.15).toFixed(1))),
    innovation: Math.min(5, parseFloat((template.innovation + bonus * 0.2).toFixed(1))),
  };
}

export default function IdeationModule() {
  const [activeTab, setActiveTab] = useState<'examples' | 'methods' | 'confirm'>('examples');
  const [activeMethod, setActiveMethod] = useState<'brainstorm' | 'scamper' | 'triz' | 'ai'>('brainstorm');
  const [ideas, setIdeas] = useState<Idea[]>(initialIdeas);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState(chatMessages);
  const [ideaTitle, setIdeaTitle] = useState('');
  const [ideaDesc, setIdeaDesc] = useState('');
  const [scamperDim, setScamperDim] = useState('替代 - 可以用什么替代？');
  const [trizProblem, setTrizProblem] = useState('');
  const [trizSolution, setTrizSolution] = useState('');
  const [aiDomain, setAiDomain] = useState('');
  const [aiUser, setAiUser] = useState('');
  const [aiNeed, setAiNeed] = useState('');
  const [votedIds, setVotedIds] = useState<number[]>([]);
  const [expandedAnalysis, setExpandedAnalysis] = useState<number | null>(null);

  // 实例库数据 - 每个方向15个案例，描述150字左右
  const exampleCategories = [
    {
      id: 1,
      name: '乡村振兴',
      icon: 'ri-plant-line',
      color: 'from-green-500 to-emerald-500',
      cases: [
        { title: '智慧农业监测系统', description: '利用AI图像识别技术和物联网传感器，实时监测农作物生长状态、土壤湿度和病虫害情况。系统通过大数据分析提供精准施肥、灌溉建议，帮助农户科学种植。同时集成气象预报功能，提前预警极端天气，最大程度减少农业损失。平台支持手机APP远程查看，让农民足不出户掌握田间情况，显著提升农业生产效率和产量。', tags: ['AI视觉', '物联网', '精准农业'], impact: '帮助农户提升30%产量，减少20%农药使用' },
        { title: '农产品溯源区块链平台', description: '基于区块链技术构建农产品全链条溯源体系，从种植、采摘、加工到运输全程记录。消费者扫码即可查看农产品完整生长历程，包括施肥记录、检测报告、物流信息等。平台采用不可篡改的分布式账本，确保数据真实可信。帮助优质农产品建立品牌信任，提升市场竞争力，让消费者吃得放心，农民卖得安心。', tags: ['区块链', '食品安全', '品牌建设'], impact: '提升农产品溢价25%，增强消费者信任度' },
        { title: '乡村电商直播培训平台', description: '针对农村电商人才短缺问题，打造系统化直播带货培训平台。提供从账号运营、内容策划、直播技巧到供应链管理的全套课程。邀请成功案例分享经验，提供一对一导师辅导。平台还整合流量扶持资源，帮助新手快速起步。通过培养本土电商人才，助力农产品上行，带动乡村经济发展，让更多农民掌握数字化营销技能。', tags: ['电商培训', '直播带货', '人才培养'], impact: '培训超5000名乡村主播，带动农产品销售额破亿' },
        { title: '共享农机租赁平台', description: '解决农村农机利用率低、购置成本高的痛点，搭建共享农机租赁平台。农户可通过APP预约附近的拖拉机、收割机、无人机等设备，按需租用。平台提供设备定位、在线支付、保险服务等功能。机主可将闲置农机出租增加收入，租户降低生产成本。通过共享经济模式盘活农村资产，提高农机使用效率，促进农业机械化发展。', tags: ['共享经济', '农机服务', '降本增效'], impact: '农机利用率提升60%，农户成本降低40%' },
        { title: '乡村旅游智慧导览系统', description: '为乡村旅游景点开发AR智慧导览系统，游客通过手机扫描即可看到景点历史故事、文化背景的3D动画展示。系统提供语音讲解、路线规划、特色美食推荐等功能。还可预约农家乐、购买土特产。通过数字化手段提升游客体验，延长停留时间，增加消费。帮助乡村挖掘文化价值，打造特色旅游品牌，带动当地经济发展。', tags: ['AR技术', '文旅融合', '智慧旅游'], impact: '游客停留时间增加50%，旅游收入翻倍' },
        { title: '农村垃圾分类智能回收站', description: '在农村部署智能垃圾分类回收站，采用AI图像识别自动分类，居民投放垃圾可获得积分奖励。积分可兑换生活用品或抵扣水电费。系统实时监控垃圾箱满载情况，优化收运路线。通过数据分析指导垃圾减量和资源化利用。改善农村人居环境，培养环保意识，推动美丽乡村建设，实现垃圾治理的可持续发展。', tags: ['环保科技', '智能分类', '积分激励'], impact: '垃圾分类准确率达85%，回收率提升70%' },
        { title: '乡村留守儿童在线教育平台', description: '针对农村留守儿童教育资源匮乏问题，搭建在线教育平台。提供名师直播课、AI作业辅导、心理健康咨询等服务。平台采用游戏化学习设计，提升学习兴趣。家长可远程查看学习进度，与孩子视频互动。志愿者老师一对一帮扶，关注孩子成长。通过互联网缩小城乡教育差距，让农村孩子享受优质教育资源，健康快乐成长。', tags: ['在线教育', '关爱儿童', '教育公平'], impact: '服务10万+留守儿童，学习成绩平均提升20分' },
        { title: '智能温室大棚控制系统', description: '为现代农业温室大棚配备智能控制系统，自动调节温度、湿度、光照、通风等环境参数。系统根据作物生长需求精准控制，实现无人化管理。集成水肥一体化设备，按需供给营养。通过手机APP远程监控和操作，节省人工成本。数据分析优化种植方案，提高产量和品质。推动设施农业向智能化、精准化方向发展。', tags: ['智能控制', '设施农业', '无人化'], impact: '产量提升35%，人工成本降低50%' },
        { title: '农村电商物流共配中心', description: '整合农村物流资源，建立县乡村三级共配体系。统一收发快递，降低物流成本。配送车辆搭载生鲜冷链设备，保障农产品品质。平台整合电商、供销社、邮政等资源，实现信息共享、线路优化。解决农村物流最后一公里难题，让工业品下乡、农产品进城更便捷。促进农村电商发展，助力乡村振兴。', tags: ['物流整合', '共同配送', '冷链运输'], impact: '物流成本降低30%，配送时效提升50%' },
        { title: '乡村人才回流创业孵化器', description: '打造乡村创业孵化平台，吸引外出务工人员、大学生返乡创业。提供免费办公场地、创业培训、政策咨询、资金对接等服务。组织创业大赛，挖掘优质项目。建立导师团队，提供一对一指导。整合产业资源，帮助项目落地。通过培育本土创业者，带动就业，激发乡村活力，实现人才回流与乡村发展的良性循环。', tags: ['创业孵化', '人才回流', '政策扶持'], impact: '孵化200+创业项目，带动就业3000人' },
        { title: '农业气象灾害预警系统', description: '建立覆盖乡村的气象监测网络，实时采集温度、降雨、风速等数据。结合AI算法预测极端天气，提前发布预警信息。系统通过短信、APP、村广播多渠道通知农户，指导防灾减灾措施。提供历史气象数据分析，辅助农事决策。帮助农民规避自然灾害风险，减少经济损失，保障农业生产安全稳定。', tags: ['气象监测', '灾害预警', '风险防控'], impact: '灾害损失减少60%，预警准确率达90%' },
        { title: '乡村文化数字博物馆', description: '利用VR/AR技术打造乡村文化数字博物馆，展示传统手工艺、民俗文化、历史建筑等。游客可在线虚拟参观，沉浸式体验乡村文化。平台记录老手艺人技艺传承，保护非物质文化遗产。开设文创产品商城，推广乡村特色文化。通过数字化手段传承乡村文脉，讲好乡村故事，提升文化自信，促进文旅融合发展。', tags: ['VR/AR', '文化传承', '数字化保护'], impact: '保护50+非遗项目，线上访问量破百万' },
        { title: '智能养殖管理系统', description: '为畜禽养殖场提供智能化管理解决方案。通过摄像头和传感器监测动物健康状态，AI识别异常行为及时预警疾病。自动投喂系统精准控制饲料用量，降低成本。环境控制系统调节温湿度，改善养殖条件。数据分析优化养殖方案，提高成活率和出栏率。推动养殖业向规模化、标准化、智能化转型升级。', tags: ['智能养殖', 'AI监测', '精准饲喂'], impact: '成活率提升15%，饲料成本降低20%' },
        { title: '农村金融普惠服务平台', description: '针对农村融资难问题，搭建普惠金融服务平台。整合银行、保险、担保等金融资源，提供小额贷款、农业保险、理财服务。利用大数据评估信用，简化审批流程。推出特色农业保险产品，降低种养殖风险。提供金融知识培训，提升农民金融素养。通过科技赋能，让金融服务触达每个农户，助力乡村产业发展。', tags: ['普惠金融', '信用评估', '风险保障'], impact: '服务农户5万+，发放贷款超10亿元' },
        { title: '乡村能源微电网系统', description: '在偏远乡村建设分布式能源微电网，整合光伏、风电、储能等清洁能源。智能调度系统优化能源配置，保障稳定供电。多余电力可并网销售，增加村集体收入。系统还可为电动农机、电动车充电。推动农村能源转型，减少碳排放，实现绿色发展。通过能源自给自足，降低用电成本，改善农村生活品质。', tags: ['清洁能源', '微电网', '绿色发展'], impact: '用电成本降低40%，年减碳5000吨' }
      ]
    },
    {
      id: 2,
      name: '智慧养老',
      icon: 'ri-heart-pulse-line',
      color: 'from-rose-500 to-pink-500',
      cases: [
        { title: '智能健康监测手环', description: '专为老年人设计的智能手环，实时监测心率、血压、血氧、睡眠质量等健康指标。当数据异常时自动预警，并通知家属和医护人员。内置GPS定位和一键SOS功能，防止老人走失。手环防水防摔，续航时间长达7天。配套APP提供健康报告和用药提醒。通过科技守护老人健康，让子女更安心，老人更安全。', tags: ['健康监测', '智能穿戴', '安全守护'], impact: '服务老人10万+，及时发现健康风险5000+次' },
        { title: '社区智慧养老服务平台', description: '整合社区养老资源，提供居家养老、日间照料、助餐助浴、医疗护理等一站式服务。老人通过APP或电话下单，平台派单给服务人员。建立老人健康档案，提供个性化照护方案。定期组织文娱活动，丰富老年生活。志愿者结对帮扶，关爱独居老人。通过互联网+养老模式，让老人在熟悉的社区安享晚年。', tags: ['居家养老', '社区服务', '医养结合'], impact: '覆盖社区500+，服务老人3万+' },
        { title: 'AI陪伴机器人', description: '开发具有情感交互能力的AI陪伴机器人，可与老人聊天解闷，播放戏曲、新闻等内容。机器人能识别老人情绪，主动关怀问候。提供用药提醒、健康咨询、视频通话等功能。语音控制家电，方便老人生活。还可进行简单的认知训练，预防老年痴呆。通过AI技术缓解老人孤独感，提升生活质量，成为老人的贴心伙伴。', tags: ['AI陪伴', '情感交互', '智能助手'], impact: '陪伴老人5万+，孤独感降低70%' },
        { title: '远程医疗问诊系统', description: '为老年人提供便捷的远程医疗服务，通过视频连线专家医生进行问诊。系统支持电子处方、药品配送到家。整合老人历史病历和体检数据，辅助医生诊断。提供慢病管理服务，定期随访提醒。紧急情况可一键呼叫急救。解决老人就医难、排队久的问题，让优质医疗资源触手可及，守护老人健康。', tags: ['远程医疗', '在线问诊', '慢病管理'], impact: '服务老人20万+，就医时间节省80%' },
        { title: '智能适老化家居改造', description: '为老年人家庭提供智能化适老改造服务。安装防滑地板、扶手、感应灯等安全设施。配备智能门锁、燃气报警、漏水检测等设备。语音控制窗帘、空调、电视等家电。卫生间安装紧急呼叫按钮。通过物联网技术打造安全、便捷、舒适的居家环境，降低老人跌倒、煤气泄漏等风险，让老人居家养老更安心。', tags: ['适老改造', '智能家居', '安全防护'], impact: '改造家庭5000+，安全事故减少90%' },
        { title: '老年大学在线学习平台', description: '打造专属老年人的在线学习平台，提供书法、绘画、摄影、舞蹈、养生等丰富课程。采用大字体、简洁界面设计，方便老人操作。支持直播互动和录播回看。组建学习社群，促进老人交流。定期举办线下活动和作品展示。通过终身学习丰富老年生活，培养兴趣爱好，延缓认知衰退，让老人老有所学、老有所乐。', tags: ['在线教育', '兴趣培养', '社交互动'], impact: '注册学员10万+，课程满意度95%' },
        { title: '智慧养老院管理系统', description: '为养老院提供数字化管理解决方案。老人佩戴智能手环，实时定位和健康监测。护理人员通过平板记录护理日志，系统自动生成报表。智能排班优化人力配置。视频监控保障安全。家属可通过APP查看老人状态，远程探视。财务管理、床位管理、膳食管理等功能一应俱全。提升养老院运营效率和服务质量。', tags: ['机构管理', '智能监护', '数字化运营'], impact: '服务养老院200+，管理效率提升50%' },
        { title: '老年人防诈骗AI助手', description: '开发AI防诈骗助手，实时识别诈骗电话和短信，自动拦截预警。当老人接到可疑电话时，AI语音提醒注意防范。分析转账行为，大额转账需家属授权。定期推送防诈骗知识，提升老人防范意识。建立诈骗案例库，及时更新诈骗手法。通过AI技术守护老人钱袋子，减少电信诈骗损失，让老人安心生活。', tags: ['AI防护', '诈骗识别', '安全教育'], impact: '拦截诈骗电话100万+次，挽回损失5000万+' },
        { title: '营养配餐智能推荐系统', description: '根据老年人健康状况、疾病类型、饮食偏好，AI智能推荐个性化营养配餐方案。系统提供详细食谱和烹饪指导，控制盐、糖、油摄入。对接社区食堂和送餐服务，一键订餐配送到家。记录饮食数据，生成营养分析报告。帮助老人科学饮食，预防慢性病，提升身体素质，享受健康美味的晚年生活。', tags: ['营养管理', '个性化配餐', '健康饮食'], impact: '服务老人8万+，慢病控制率提升40%' },
        { title: '老年人出行助手APP', description: '专为老年人设计的出行服务APP，提供大字体导航、语音播报、一键叫车等功能。整合公交、地铁、出租车、网约车等出行方式。推荐无障碍路线，避开台阶和陡坡。提供老年人优惠票价信息。紧急情况可分享位置给家属。志愿者陪同出行服务。让老人出行更便捷、更安全，扩大活动半径，提升生活质量。', tags: ['出行服务', '无障碍导航', '安全陪护'], impact: '服务老人15万+，出行满意度90%' },
        { title: '认知训练游戏平台', description: '开发专业的认知训练游戏，通过记忆力、注意力、逻辑思维等训练，预防和延缓老年痴呆。游戏难度自适应调整，适合不同认知水平的老人。采用趣味化设计，提升参与积极性。系统记录训练数据，生成认知评估报告。医生可根据报告调整训练方案。通过科学训练保持大脑活力，让老人思维敏捷，延缓认知衰退。', tags: ['认知训练', '游戏化', '痴呆预防'], impact: '训练老人5万+，认知能力提升30%' },
        { title: '智能药盒与用药管理', description: '设计智能药盒，按时间分格存放药品，到点自动提醒吃药并语音播报。药盒配备指纹识别，防止误服。漏服或多服时发出警报并通知家属。系统记录用药历史，生成服药依从性报告。对接医院和药店，自动续方配药。解决老人记性差、易忘服药的问题，提高用药安全性和治疗效果。', tags: ['用药管理', '智能提醒', '安全防护'], impact: '服务老人12万+，用药依从性提升60%' },
        { title: '老年人社交兴趣社区', description: '打造专属老年人的线上社交平台，根据兴趣爱好匹配同龄好友。提供广场舞、摄影、旅游、养生等兴趣圈子。组织线下活动，促进面对面交流。分享生活点滴，记录美好时光。子女可加入家庭圈，增进亲子互动。通过社交网络缓解老人孤独感，丰富精神生活，让老年生活更精彩、更有意义。', tags: ['社交平台', '兴趣社群', '情感关怀'], impact: '注册用户50万+，日活跃用户10万+' },
        { title: '康复训练智能辅助系统', description: '为术后康复或慢病老人提供智能康复训练系统。通过体感设备捕捉动作，AI实时纠正姿势。提供个性化康复方案，循序渐进增加训练强度。游戏化设计提升训练趣味性。系统记录康复进度，生成评估报告供医生参考。支持远程康复指导。帮助老人科学康复，加快恢复速度，提升生活自理能力。', tags: ['康复训练', 'AI指导', '体感交互'], impact: '服务老人3万+，康复周期缩短30%' },
        { title: '智慧养老数据中心', description: '建立区域性智慧养老大数据平台，整合健康、服务、消费等多维数据。通过数据分析预测养老需求，优化资源配置。监测老人健康趋势，提前干预风险。为政府决策提供数据支撑，完善养老政策。为企业提供市场洞察，开发适老产品。通过数据驱动提升养老服务质量，推动养老产业高质量发展。', tags: ['大数据', '决策支持', '产业赋能'], impact: '汇聚数据100万+条，支撑政策制定20+项' }
      ]
    },
    {
      id: 3,
      name: '教育科技',
      icon: 'ri-graduation-cap-line',
      color: 'from-blue-500 to-indigo-500',
      cases: [
        { title: '个性化学习路径规划系统', description: '基于AI算法分析学生知识掌握情况、学习习惯和认知特点，为每个学生定制专属学习路径。系统动态调整学习内容和难度，推荐最适合的学习资源。通过知识图谱可视化展示学习进度，明确薄弱环节。提供智能练习题推荐，精准查漏补缺。让每个学生都能按照自己的节奏学习，提升学习效率和成绩，实现因材施教。', tags: ['AI教育', '个性化', '知识图谱'], impact: '学习效率提升40%，成绩平均提高15分' },
        { title: '智能作业批改系统', description: '利用OCR和AI技术自动批改客观题和主观题，识别手写答案并给出评分和详细解析。系统分析错题原因，生成个性化错题本和知识点报告。教师可查看班级整体情况，调整教学重点。支持语文作文、英语作文的智能评分和修改建议。大幅减轻教师批改负担，让老师有更多时间关注学生个体差异，提升教学质量。', tags: ['AI批改', 'OCR识别', '数据分析'], impact: '批改效率提升90%，教师工作量减少60%' },
        { title: '虚拟实验室平台', description: '打造沉浸式虚拟实验室，学生可在VR环境中进行物理、化学、生物等学科实验。系统模拟真实实验场景，支持自由操作和探索。提供实验指导和安全提示，避免危险操作。记录实验过程和数据，自动生成实验报告。解决实验设备不足、耗材昂贵、安全风险等问题。让学生随时随地做实验，培养科学探究能力和创新思维。', tags: ['VR技术', '虚拟实验', '科学教育'], impact: '实验成本降低80%，学生实验次数增加5倍' },
        { title: '在线双师课堂', description: '采用双师教学模式，名师远程直播授课，本地辅导老师课堂管理和答疑。系统支持多方互动、屏幕共享、电子白板等功能。AI助教实时分析学生专注度，提醒走神学生。课后提供录播回看和练习题。让偏远地区学生享受优质教育资源，缩小城乡教育差距。提升教学效果，促进教育公平，让每个孩子都能接受好的教育。', tags: ['双师教学', '远程教育', '教育公平'], impact: '覆盖学校500+，受益学生10万+' },
        { title: '智能排课系统', description: '基于AI算法自动生成最优课表，综合考虑教师时间、教室资源、课程冲突、学生选课等多重约束。支持走班制、分层教学等复杂排课需求。一键调课，自动通知相关师生。生成教师工作量统计和教室利用率报告。大幅提升排课效率，优化资源配置，减少人工排课的繁琐和错误，让学校管理更科学、更高效。', tags: ['智能排课', '资源优化', '教务管理'], impact: '排课时间从1周缩短到10分钟，冲突率降至0' },
        { title: '家校沟通互动平台', description: '搭建家校沟通桥梁，教师可发布作业、通知、成绩等信息，家长实时接收。提供在线请假、成绩查询、课表查看等功能。家长可与教师一对一沟通，了解孩子在校表现。系统推送教育资讯和家庭教育指导。组织线上家长会，提升参与度。通过信息化手段增进家校互信，形成教育合力，共同促进孩子健康成长。', tags: ['家校互动', '信息化', '协同育人'], impact: '覆盖家长50万+，沟通效率提升70%' },
        { title: 'AI口语陪练助手', description: '开发AI英语口语陪练系统，提供真人对话场景模拟。AI根据学生水平调整对话难度，纠正发音和语法错误。提供即时反馈和改进建议。支持多种话题和场景练习，如旅游、商务、日常交流等。记录学习进度，生成口语能力评估报告。让学生随时随地练习口语，克服开口恐惧，提升英语交流能力。', tags: ['AI陪练', '口语训练', '语言学习'], impact: '学生口语水平提升50%，练习时长增加3倍' },
        { title: '智慧图书馆管理系统', description: '采用RFID技术实现图书自助借还，无需人工操作。智能书架实时定位图书位置，方便查找。AI推荐系统根据阅读历史推荐书籍。提供座位预约、电子阅览、数字资源检索等功能。数据分析优化图书采购和资源配置。打造智慧化、人性化的阅读空间，提升图书馆服务效率，培养学生阅读习惯，营造书香校园氛围。', tags: ['RFID', '智能推荐', '数字图书馆'], impact: '借阅效率提升80%，图书利用率提高60%' },
        { title: '学生心理健康监测平台', description: '通过问卷调查、行为分析、社交网络监测等多维度评估学生心理状态。AI识别抑郁、焦虑等心理问题预警信号，及时干预。提供在线心理咨询和情绪疏导服务。组织心理健康教育活动，普及心理知识。建立学生心理档案,跟踪心理健康变化。通过科技手段守护学生心理健康，预防极端事件，促进学生全面发展。', tags: ['心理健康', 'AI预警', '危机干预'], impact: '及时发现心理问题3000+例，干预成功率85%' },
        { title: '编程教育游戏化平台', description: '将编程学习游戏化，通过闯关、任务、奖励等机制激发学习兴趣。提供图形化编程工具，降低入门门槛。从Scratch到Python循序渐进。支持创作分享,学生可展示作品互相学习。举办编程竞赛，培养计算思维。配套教师培训和教学资源。让编程学习变得有趣,培养未来数字时代所需的核心技能。', tags: ['编程教育', '游戏化', 'STEM'], impact: '学生编程兴趣提升80%，参与人数破10万' },
        { title: '智能校园安全监控系统', description: '部署AI视频监控，实时识别校园安全隐患。检测陌生人入侵、学生打架、攀爬围墙等异常行为自动报警。人脸识别实现无感考勤和门禁管理。监测校车运行轨迹，保障接送安全。食堂后厨监控确保食品安全。通过物联网和AI技术构建智慧安防体系，全方位守护校园安全，让家长放心、学校安心。', tags: ['AI监控', '安全防护', '智慧校园'], impact: '安全事故减少90%，响应速度提升10倍' },
        { title: '知识付费教师创作平台', description: '为教师提供知识变现平台，可上传课程、题库、教案等教学资源。平台提供录课工具、直播功能、社群运营等支持。教师自主定价，平台抽取佣金。优质内容获得流量扶持和推荐。建立教师个人品牌，拓展收入渠道。激励教师创作优质内容，促进教育资源共享，让好老师的价值得到更好体现。', tags: ['知识付费', '内容创作', '教师赋能'], impact: '入驻教师5万+，累计收入破亿元' },
        { title: '智能体育训练系统', description: '利用体感设备和AI视频分析技术，实时捕捉学生运动姿态，纠正动作错误。提供个性化训练方案，科学提升体能。记录运动数据，生成体质健康报告。支持跳绳、仰卧起坐、跑步等多种项目。游戏化设计提升锻炼趣味性。帮助学生科学锻炼，提高体育成绩，养成运动习惯，促进身心健康全面发展。', tags: ['体育教育', 'AI分析', '健康管理'], impact: '体育成绩平均提升20%，学生体质达标率提高30%' },
        { title: '教育数据驾驶舱', description: '为教育管理者打造数据可视化平台，实时展示学校运营关键指标。包括教学质量、学生成绩、教师绩效、资源利用等多维度数据。通过数据分析发现问题，辅助科学决策。预测招生趋势，优化资源配置。生成各类统计报表，简化行政工作。通过数据驱动提升教育治理能力，推动学校高质量发展。', tags: ['数据可视化', '决策支持', '教育治理'], impact: '决策效率提升60%，资源利用率提高40%' },
        { title: '特殊教育辅助工具', description: '为特殊儿童开发辅助学习工具，包括语音转文字、文字转语音、图片识别等功能。提供认知训练游戏，改善注意力和记忆力。社交技能训练帮助融入集体。家长和教师可定制训练方案。记录康复进度，调整干预策略。通过科技赋能特殊教育，让每个孩子都能享受适合的教育，实现潜能最大化发展。', tags: ['特殊教育', '辅助技术', '融合教育'], impact: '服务特殊儿童2万+，能力提升显著' }
      ]
    },
    {
      id: 4,
      name: '智慧校园',
      icon: 'ri-school-line',
      color: 'from-cyan-500 to-teal-500',
      cases: [
        { title: '一卡通智能管理系统', description: '打造校园一卡通平台，集成门禁、考勤、消费、借书等多种功能。学生刷卡即可完成食堂就餐、超市购物、图书借阅等操作。家长可通过APP充值和查看消费记录。系统提供消费分析和预警功能，防止过度消费。支持手机NFC和二维码支付。通过一卡通简化校园生活，提升管理效率，打造便捷智慧校园。', tags: ['一卡通', '移动支付', '校园服务'], impact: '覆盖师生10万+，日交易量破百万' },
        { title: '智能教室物联网系统', description: '为教室配备智能物联设备，自动控制灯光、空调、窗帘、投影等设备。根据环境光线和温度自动调节，营造舒适学习环境。人体感应实现无人自动关闭，节约能源。教师可通过平板一键控制所有设备。系统记录设备使用数据，优化能耗管理。打造绿色智慧教室，提升教学体验，降低运营成本。', tags: ['物联网', '智能控制', '节能环保'], impact: '能耗降低30%，设备故障率减少50%' },
        { title: '校园导航与服务小程序', description: '开发校园生活服务小程序，提供AR实景导航、教室查询、课表查看、成绩查询等功能。新生可通过AR导航快速熟悉校园。查询空教室自习，预约场馆设施。失物招领、二手交易、拼车拼团等生活服务。校园资讯、活动报名一站式获取。通过数字化手段提升校园生活便利性，增强学生归属感和幸福感。', tags: ['AR导航', '生活服务', '校园社交'], impact: '用户覆盖率90%，日活跃用户5万+' },
        { title: '智慧食堂管理系统', description: '采用AI视觉识别技术实现食堂自助结算，学生选餐后自动识别菜品和价格，刷脸支付秒级完成。系统分析就餐数据，优化菜品供应和备货量，减少浪费。提供营养分析和健康建议。支持提前订餐和外卖配送。监测食品安全和后厨卫生。通过智能化改造提升就餐体验，保障食品安全,打造智慧食堂。', tags: ['AI识别', '刷脸支付', '食品安全'], impact: '结算效率提升80%，食材浪费减少40%' },
        { title: '校园能源管理平台', description: '建立校园能源监测平台，实时采集水电气等能耗数据。AI分析能耗规律，发现异常及时预警。优化用能策略，错峰用电降低成本。对比各建筑能耗，推动节能改造。生成能耗报表，支撑绿色校园建设。通过科技手段实现精细化能源管理，降低运营成本，践行绿色发展理念，建设节约型校园。', tags: ['能源管理', '数据监测', '绿色校园'], impact: '能耗降低25%，年节约费用500万+' },
        { title: '智能宿舍管理系统', description: '为学生宿舍配备智能门锁、用电监测、环境传感等设备。人脸识别门禁，访客登记管理。监测违规用电，自动断电保障安全。空调、热水器远程控制，节约能源。宿舍报修一键提交，维修进度实时查询。晚归、未归自动预警。通过智能化管理提升宿舍安全性和舒适度，为学生营造温馨家园。', tags: ['智能门锁', '用电安全', '宿舍管理'], impact: '安全事故减少95%，管理效率提升70%' },
        { title: '校园活动管理平台', description: '搭建校园活动全流程管理平台，支持活动发布、报名、签到、评价等功能。学生可浏览感兴趣的活动并在线报名。组织者管理参与名单，统计数据。活动签到支持二维码、人脸识别等方式。自动记录第二课堂学分。生成活动报告和数据分析。激发学生参与热情，丰富校园文化生活，促进学生全面发展。', tags: ['活动管理', '在线报名', '学分记录'], impact: '活动参与率提升60%，管理效率提高80%' },
        { title: '智慧停车管理系统', description: '部署智能停车系统，车牌识别自动抬杆，无需停车取卡。实时显示车位空余情况，引导车辆快速停车。支持线上缴费和包月管理。访客车辆提前预约登记。违停自动识别和通知。优化车位分配，提高利用率。解决校园停车难、管理乱的问题，提升通行效率，打造有序智慧校园交通环境。', tags: ['智能停车', '车牌识别', '交通管理'], impact: '停车效率提升70%，车位利用率提高50%' },
        { title: '校园安全应急指挥系统', description: '建立校园安全应急指挥中心，整合视频监控、消防报警、门禁系统等数据。AI实时分析安全风险，异常情况自动预警。一键启动应急预案，调度安保人员和资源。提供应急疏散路线导航。定期组织应急演练,提升应对能力。通过信息化手段构建安全防护网，快速响应突发事件，保障师生生命财产安全。', tags: ['应急指挥', '安全预警', '智慧安防'], impact: '应急响应速度提升5倍，安全事故零发生' },
        { title: '智能体育场馆预约系统', description: '开发体育场馆在线预约平台，学生可查看场馆空闲时段并预约。支持篮球场、羽毛球馆、游泳池等多种场馆。人脸识别核验预约信息，防止爽约。超时提醒避免占用格口。支持寄件功能,扫码下单快递上门取件。数据分析优化柜机布局。解决快递丢失、冒领、堆积等问题。提升取件便利性和安全性，打造高效智慧物流服务体系。', tags: ['智能快递柜', '自助服务', '物流管理'], impact: '服务师生5万+，快递丢失率降至0' },
        { title: '数字化校史馆', description: '利用VR/AR技术打造沉浸式数字校史馆，展示学校发展历程、杰出校友、重大成就等。访客可虚拟漫游校园,了解历史建筑背后的故事。互动展项增强参与感。线上校史馆突破时空限制，全球校友可随时参观。通过数字化手段传承校园文化，增强师生认同感和自豪感，讲好学校故事。', tags: ['VR/AR', '文化传承', '数字展馆'], impact: '访问量破百万，校友参与度提升80%' },
        { title: '智慧教务管理系统', description: '打造一体化教务管理平台，涵盖选课、排课、考务、成绩、学籍等全流程。学生在线选课，系统自动检测冲突。教师提交成绩，自动计算绩点。支持学分制、弹性学制等复杂教学模式。数据分析辅助教学质量评估。移动端随时查询教务信息。通过信息化提升教务管理效率，优化教学资源配置。', tags: ['教务管理', '信息化', '流程优化'], impact: '管理效率提升80%，师生满意度90%+' },
        { title: '校园舆情监测系统', description: '建立校园网络舆情监测平台，实时抓取校内论坛、社交媒体等信息。AI分析舆情热点和情感倾向，识别负面信息和敏感话题。及时预警舆情风险，辅助应对处置。了解学生关注焦点，改进学校工作。生成舆情分析报告。通过大数据技术掌握校园舆论动态，维护校园和谐稳定，提升治理能力。', tags: ['舆情监测', 'AI分析', '风险预警'], impact: '舆情响应速度提升10倍，负面事件减少70%' },
        { title: '智能会议室预约系统', description: '开发会议室智能预约平台，查看会议室空闲状态并在线预约。会议开始前自动提醒,超时未到自动释放。会议室门口电子屏显示使用情况。集成视频会议、投影设备控制。会后自动生成使用报告。优化会议室资源配置，提高利用率。通过智能化管理提升办公效率，打造高效协作环境。', tags: ['会议管理', '资源预约', '智能办公'], impact: '会议室利用率提升50%，冲突率降至0' }
      ]
    },
    {
      id: 5,
      name: '绿色环保',
      icon: 'ri-leaf-line',
      color: 'from-emerald-500 to-green-500',
      cases: [
        { title: '碳足迹追踪与碳中和平台', description: '为个人和企业提供碳足迹计算工具，记录日常出行、用电、消费等活动的碳排放。AI分析碳排放来源，提供减排建议。支持购买碳信用额度实现碳中和。企业可生成碳排放报告，满足ESG披露要求。推广低碳生活方式，组织植树等碳抵消活动。通过数字化手段推动全民参与碳减排，助力实现双碳目标。', tags: ['碳足迹', '碳中和', 'ESG'], impact: '用户减排100万吨CO2，种植树木50万棵' },
        { title: '智能垃圾分类回收系统', description: '部署AI智能垃圾桶，自动识别垃圾类别并分类投放。居民投放垃圾获得积分奖励，可兑换生活用品。系统监测垃圾箱满载情况，优化收运路线。数据分析指导垃圾减量和资源化利用。建立再生资源回收网络，促进循环经济。通过科技手段提升垃圾分类准确率，培养环保意识，推动垃圾治理现代化。', tags: ['AI分类', '积分激励', '循环经济'], impact: '分类准确率90%，回收率提升80%' },
        { title: '空气质量监测与预警平台', description: '建立城市空气质量监测网络，实时采集PM2.5、PM10、臭氧等污染物数据。AI预测空气质量变化趋势，提前发布预警信息。提供健康防护建议，指导公众出行。分析污染源分布，辅助环保部门精准治理。公开环境数据，接受社会监督。通过科技赋能环境治理，守护蓝天白云，保障公众健康。', tags: ['环境监测', 'AI预测', '数据公开'], impact: '监测点覆盖全市，预警准确率95%' },
        { title: '新能源汽车充电桩共享平台', description: '整合城市充电桩资源，提供充电桩查询、导航、预约、支付一站式服务。实时显示充电桩空闲状态，避免空跑。支持私人充电桩共享，闲时出租增加收入。优惠活动引导错峰充电，平衡电网负荷。数据分析优化充电桩布局。通过共享模式提高充电桩利用率，缓解充电难题,推动新能源汽车普及。', tags: ['共享经济', '新能源', '智能调度'], impact: '充电桩利用率提升70%，服务车主50万+' },
        { title: '水资源智能管理系统', description: '建立水资源监测网络，实时采集水质、水位、流量等数据。AI分析用水规律，优化水资源调度。检测管网漏损，及时维修减少浪费。预测用水需求，保障供水安全。监测水质异常，保障饮用水安全。推广节水技术和器具。通过智能化管理提升水资源利用效率，保护水生态环境，建设节水型社会。', tags: ['水资源', '智能监测', '节水管理'], impact: '节水50%，年节约费用千万+' },
        { title: '绿色建筑能耗优化平台', description: '为建筑配备能耗监测系统，实时采集空调、照明、电梯等设备能耗数据。AI分析能耗规律，优化运行策略。自动调节设备参数，降低能耗。预测设备故障，提前维护。生成能耗报告，支撑绿色建筑认证。通过智能化改造实现建筑节能,降低运营成本,减少碳排放,推动绿色建筑发展。', tags: ['绿色建筑', '能耗优化', '智能控制'], impact: '建筑能耗降低35%，年节约费用千万+' },
        { title: '环保公益活动组织平台', description: '搭建环保公益活动平台，发布植树、净滩、垃圾清理等活动信息。志愿者在线报名参与，记录公益时长。活动打卡分享，传播环保理念。组织环保知识竞赛，提升环保意识。企业可设立绿色出行基金,奖励员工。通过激励机制推广绿色出行,减少碳排放,缓解交通拥堵,改善空气质量。', tags: ['环保公益', '志愿服务', '行为激励'], impact: '组织活动1000+场，参与志愿者10万+' },
        { title: '智慧农业节水灌溉系统', description: '为农田配备土壤湿度传感器和智能灌溉设备，根据作物需水量精准灌溉。系统结合气象预报优化灌溉计划，避免无效灌溉。支持手机远程控制，农民足不出户管理农田。数据分析优化灌溉策略，提高水资源利用效率。通过科技手段实现农业节水,缓解水资源短缺,促进农业可持续发展。', tags: ['智慧农业', '节水灌溉', '精准农业'], impact: '节水50%，作物产量提升20%' },
        { title: '废旧电子产品回收平台', description: '搭建废旧电子产品回收平台，用户在线下单，回收人员上门取件。平台评估设备价值，给予合理回收价格。可回收手机、电脑、家电等多种产品。专业拆解处理，提取贵金属和稀有元素。数据销毁保护隐私。推广以旧换新，促进绿色消费。通过规范回收减少电子垃圾污染,实现资源循环利用。', tags: ['电子回收', '循环经济', '资源再生'], impact: '回收电子产品100万+件，减少污染显著' },
        { title: '绿色出行碳积分系统', description: '鼓励绿色出行，用户选择步行、骑行、公交、地铁等低碳方式可获得碳积分。积分可兑换优惠券、公交卡充值、公益捐赠等。系统记录出行轨迹，计算减排量。排行榜激发参与热情。企业可设立绿色出行基金,奖励员工。通过激励机制推广绿色出行,减少碳排放,缓解交通拥堵,改善空气质量。', tags: ['绿色出行', '碳积分', '行为激励'], impact: '用户减少开车30%，年减排10万吨CO2' },
        { title: '海洋垃圾监测与清理系统', description: '利用无人机和卫星遥感监测海洋垃圾分布，AI识别垃圾类型和密度。部署智能清理船和水下机器人收集垃圾。建立海洋垃圾数据库，分析来源和漂移路径。组织净滩活动，发动公众参与。推动减塑行动，从源头减少海洋垃圾。通过科技手段保护海洋生态,守护蓝色家园,促进海洋可持续发展。', tags: ['海洋保护', '无人机', '海洋垃圾'], impact: '清理海洋垃圾1000吨，保护海洋生物' },
        { title: '企业环保合规管理平台', description: '为企业提供环保合规管理工具，实时监测废水、废气、噪声等排放数据。超标自动预警，辅助整改。生成环保报告，满足监管要求。提供环保法规查询和政策解读。对接环保部门，简化审批流程。帮助企业履行环保责任,降低合规风险,提升绿色竞争力,推动产业绿色转型升级。', tags: ['环保合规', '排放监测', '企业服务'], impact: '服务企业5000+，合规率100%' },
        { title: '生态旅游智慧管理系统', description: '为生态旅游景区提供智慧管理方案，实时监测游客数量，智能调控分流。AI预测客流高峰，提前预警。提供在线购票、导览、讲解、投诉等服务。监控景区安全和环境卫生。数据分析优化运营策略。通过数字化手段提升景区管理效率和服务质量,改善游客体验,推动景区高质量发展。', tags: ['生态旅游', '智慧景区', '旅游管理'], impact: '游客满意度提升40%，运营效率提高60%' },
        { title: '可再生能源交易平台', description: '搭建可再生能源交易平台，居民和企业可出售光伏、风电等绿色电力。平台撮合交易，提供结算服务。发放绿证证明清洁能源使用。数据分析优化能源配置。推动分布式能源发展,提高可再生能源消纳。通过市场化机制激励清洁能源生产和使用,加速能源转型,助力碳中和目标实现。', tags: ['可再生能源', '能源交易', '绿证'], impact: '交易电量10亿度，减排50万吨CO2' },
        { title: '环保数据开放平台', description: '建立环保数据开放平台，公开空气、水质、土壤、噪声等环境监测数据。提供数据API，支持第三方开发应用。数据可视化展示环境质量变化趋势。公众可查询身边环境状况。接受环境问题举报和监督。通过数据开放提升环境治理透明度,保障公众知情权,推动全社会共同参与环境保护。', tags: ['数据开放', '环境监测', '公众参与'], impact: '数据访问量破千万，环境改善显著' }
      ]
    },
    {
      id: 6,
      name: '文化旅游',
      icon: 'ri-map-pin-line',
      color: 'from-purple-500 to-violet-500',
      cases: [
        { title: 'AR文化遗产数字复原', description: '利用AR技术复原历史遗迹和文物，游客通过手机扫描即可看到古建筑原貌、历史场景重现。提供多语言讲解和互动体验，了解文物背后的故事。支持虚拟文物修复，参与文化保护。打造沉浸式文化体验，让历史活起来。通过科技手段传承文化遗产，提升旅游吸引力，促进文旅融合发展。', tags: ['AR技术', '文化遗产', '数字复原'], impact: '游客体验满意度95%，文化传播力提升3倍' },
        { title: '智慧景区全域管理平台', description: '打造景区智慧管理平台，实时监测游客流量，智能调控分流。AI预测客流高峰，提前预警。提供在线购票、导览、讲解、投诉等服务。监控景区安全和环境卫生。数据分析优化运营策略。通过数字化手段提升景区管理效率和服务质量,改善游客体验,推动景区高质量发展。', tags: ['智慧景区', '客流管理', '数字化运营'], impact: '游客满意度提升40%，运营效率提高60%' },
        { title: '文化IP衍生品设计平台', description: '基于文化IP开发衍生品设计平台，AI生成创意设计方案。整合供应链资源，支持小批量定制生产。搭建线上商城销售文创产品。举办设计大赛，挖掘优秀作品。版权保护和授权管理。通过文创产品传播文化,增加景区收入,延伸产业链,推动文化创意产业发展,让文化遗产焕发新活力。', tags: ['文创设计', 'IP开发', '文化传播'], impact: '开发文创产品1000+款，销售额破亿' },
        { title: '个性化旅游路线规划助手', description: '基于AI算法为游客定制个性化旅游路线，根据兴趣偏好、时间预算、出行方式推荐景点和行程。实时导航和语音讲解。推荐特色美食和住宿。动态调整行程应对突发情况。分享游记和攻略。通过智能化服务提升旅游体验,让每次旅行都独一无二，满足游客个性化需求，促进旅游消费升级。', tags: ['AI规划', '个性化', '智能导览'], impact: '服务游客100万+，行程满意度90%+' },
        { title: '非遗文化在线传承平台', description: '搭建非遗文化传承平台,记录传统手工艺、民俗表演、口述历史等。大师在线授课,传授技艺。VR体验非遗制作过程。开设非遗产品商城,帮助手艺人增收。组织非遗进校园活动。通过数字化手段保护和传承非物质文化遗产,让传统文化走进现代生活,培养年轻一代文化自信。', tags: ['非遗保护', '在线教育', '文化传承'], impact: '保护非遗项目200+，培训学员10万+' },
        { title: '智能酒店管理系统', description: '为酒店提供智能化管理方案,在线预订、自助入住、刷脸开门、语音控制客房设备。AI客服24小时服务,机器人送物到房。根据客人偏好调节房间环境。数据分析优化定价策略和资源配置。提升酒店运营效率和客户体验,降低人工成本,打造智慧酒店,增强市场竞争力。', tags: ['智慧酒店', '自助服务', 'AI客服'], impact: '入住效率提升80%，客户满意度95%' },
        { title: '旅游大数据分析平台', description: '建立旅游大数据平台,整合景区、酒店、交通、消费等多维数据。分析游客画像和行为偏好,精准营销。预测旅游趋势,指导产品开发。监测舆情口碑,及时应对危机。为政府提供决策支持,优化旅游规划。通过数据驱动提升旅游产业竞争力,推动旅游业高质量发展。', tags: ['大数据', '游客画像', '精准营销'], impact: '数据覆盖全域，营销转化率提升50%' },
        { title: '红色旅游数字展馆', description: '利用VR/AR技术打造红色旅游数字展馆,重现革命历史场景。游客可虚拟参观纪念馆、战斗遗址,沉浸式体验历史。AI讲解员讲述英雄故事。互动答题学习党史知识。线上展馆突破地域限制,全国人民可参观。通过科技手段传承红色基因,弘扬革命精神,开展爱国主义教育。', tags: ['红色旅游', 'VR/AR', '爱国教育'], impact: '线上参观人次破千万，教育效果显著' },
        { title: '民宿智能运营平台', description: '为民宿主提供智能运营工具,在线房源管理、订单处理、客户沟通。AI动态定价,提升收益。智能门锁远程开门,无需现场交接。提供民宿设计和装修建议。整合清洁、维修等服务资源。数据分析优化运营策略。帮助民宿主提升管理效率和服务质量,增加收入,推动民宿产业规范化发展。', tags: ['民宿运营', '智能管理', '共享经济'], impact: '服务民宿5000+，收益提升40%' },
        { title: '文化主题沉浸式剧场', description: '打造文化主题沉浸式演出,观众不再是旁观者,而是参与剧情的角色。利用全息投影、AR、VR等技术营造梦幻场景。互动剧情根据观众选择变化。融合当地文化元素,讲述地域故事。通过创新演出形式吸引年轻观众,传播传统文化,打造文旅新IP,带动夜间经济发展。', tags: ['沉浸式体验', '文化演出', '科技艺术'], impact: '场场爆满，带动周边消费增长80%' },
        { title: '旅游应急救援系统', description: '建立旅游应急救援平台,游客遇险一键SOS,系统自动定位并通知救援队。整合医疗、消防、公安等救援资源。AI分析风险区域,提前预警。提供旅游保险和紧急医疗服务。建立救援知识库,普及自救技能。通过科技手段保障游客安全,快速响应突发事件,提升旅游目的地安全形象。', tags: ['应急救援', '安全保障', '风险预警'], impact: '救援响应时间缩短70%，游客安全感提升' },
        { title: '美食文化探索平台', description: '打造美食文化平台,展示地方特色美食和烹饪技艺。AI推荐美食路线,寻找隐藏美味。提供美食制作教程,传承饮食文化。组织美食节和厨艺大赛。开设美食商城,销售特产和食材。通过美食连接文化和旅游,吸引美食爱好者,带动餐饮消费,推动美食文化传播和产业发展。', tags: ['美食文化', '特色旅游', '文化传播'], impact: '吸引游客50万+，带动餐饮收入翻倍' },
        { title: '智慧导游服务系统', description: '开发AI智能导游系统,提供景点讲解、路线导航、问题解答等服务。支持多语言和方言讲解。AR识别景点自动播放介绍。根据游客兴趣推荐内容。语音交互自然流畅。解决导游短缺和服务质量参差问题。通过AI技术提升导游服务水平,改善旅游体验,降低旅游成本。', tags: ['AI导游', '智能讲解', '多语言'], impact: '服务游客200万+，讲解满意度95%' },
        { title: '文旅融合创新孵化平台', description: '搭建文旅创新创业孵化平台,支持文旅项目孵化。提供场地、资金、导师、资源对接等服务。举办创新大赛,挖掘优质项目。推动文化科技融合,开发新业态新产品。培育文旅人才,提升行业创新能力。通过创新驱动文旅产业转型升级,激发市场活力,推动文旅经济高质量发展。', tags: ['创新孵化', '文旅融合', '产业升级'], impact: '孵化项目100+，带动就业5000人' },
        { title: '旅游碳中和计划', description: '推出旅游碳中和计划,计算游客旅行碳足迹,包括交通、住宿、餐饮等。提供碳抵消方案,如植树、购买碳信用。推广绿色旅游方式,鼓励低碳出行。景区实施节能减排措施。发放绿色旅游认证。通过碳中和行动推动旅游业绿色转型,保护旅游目的地生态环境,实现可持续发展。', tags: ['碳中和', '绿色旅游', '可持续'], impact: '参与游客10万+，抵消碳排放5000吨' }
      ]
    }
  ];

  const [selectedCategory, setSelectedCategory] = useState(exampleCategories[0]);
  
  // 项目主题表单状态
  const [projectTheme, setProjectTheme] = useState({
    name: '',
    value: '',
    target: '',
    problem: '',
    solution: ''
  });
  
  // 表单验证错误
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isUnderReview, setIsUnderReview] = useState(false); // 新增：审核状态

  // 版本控制状态
  const [versions, setVersions] = useState<Version[]>([]);
  const [currentVersion, setCurrentVersion] = useState(1);

  // 保存当前版本
  const handleSaveVersion = (summary: string) => {
    const newVersion: Version = {
      id: `version-${Date.now()}`,
      versionNumber: versions.length + 1,
      timestamp: new Date().toLocaleString('zh-CN'),
      operator: '当前用户',
      summary,
      data: {
        ideas,
        projectTheme,
        messages,
        activeMethod,
        votedIds,
      },
    };
    setVersions([...versions, newVersion]);
    setCurrentVersion(newVersion.versionNumber);
  };

  // 回撤到指定版本
  const handleRestore = (versionId: string) => {
    const version = versions.find(v => v.id === versionId);
    if (!version) return;
    
    const data = version.data;
    setIdeas(data.ideas || initialIdeas);
    setProjectTheme(data.projectTheme || { name: '', value: '', target: '', problem: '', solution: '' });
    setMessages(data.messages || chatMessages);
    setActiveMethod(data.activeMethod || 'brainstorm');
    setVotedIds(data.votedIds || []);
    setCurrentVersion(version.versionNumber);
  };

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    setMessages([{ name: '我', color: 'from-teal-500 to-cyan-500', text: chatInput.trim(), time: '刚刚' }, ...messages]);
    setChatInput('');
  };

  const triggerAiAnalysis = (id: number) => {
    setIdeas((prev) => prev.map((idea) => idea.id === id ? { ...idea, analyzing: true } : idea));
    setExpandedAnalysis(id);
    setTimeout(() => {
      setIdeas((prev) =>
        prev.map((idea) =>
          idea.id === id
            ? { ...idea, analyzing: false, aiAnalysis: generateAiAnalysis(idea) }
            : idea
        )
      );
    }, 2200);
  };

  const handleSubmitIdea = () => {
    if (!ideaTitle.trim()) return;
    const newIdea: Idea = {
      id: Date.now(),
      title: ideaTitle,
      description: ideaDesc || '暂无描述',
      method:
        activeMethod === 'brainstorm' ? '头脑风暴'
        : activeMethod === 'scamper' ? 'SCAMPER'
        : activeMethod === 'triz' ? 'TRIZ'
        : 'AI创意',
      author: '我',
      votes: 0,
      novelty: 4.0,
      feasibility: 3.5,
    };
    setIdeas((prev) => [newIdea, ...prev]);
    setIdeaTitle('');
    setIdeaDesc('');
    setTimeout(() => triggerAiAnalysis(newIdea.id), 300);
  };

  const handleVote = (id: number) => {
    if (votedIds.includes(id)) return;
    setVotedIds([...votedIds, id]);
    setIdeas(ideas.map((idea) => (idea.id === id ? { ...idea, votes: idea.votes + 1 } : idea)));
  };

  // 验证表单
  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    if (!projectTheme.name.trim() || projectTheme.name.trim().length < 5) {
      errors.name = '项目名称至少需要5个字';
    }
    if (!projectTheme.value.trim() || projectTheme.value.trim().length < 20) {
      errors.value = '核心价值主张至少需要20个字';
    }
    if (!projectTheme.target.trim() || projectTheme.target.trim().length < 10) {
      errors.target = '目标用户描述至少需要10个字';
    }
    if (!projectTheme.problem.trim() || projectTheme.problem.trim().length < 50) {
      errors.problem = '解决的核心问题至少需要50个字';
    }
    if (!projectTheme.solution.trim() || projectTheme.solution.trim().length < 100) {
      errors.solution = '解决方案概述至少需要100个字';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleConfirmTheme = () => {
    if (!validateForm()) {
      return;
    }
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setShowSuccess(true);
      setIsUnderReview(true); // 提交后进入审核状态
      setTimeout(() => setShowSuccess(false), 3000);
    }, 1500);
  };

  const methodTabs = [
    { key: 'brainstorm' as const, label: '头脑风暴', icon: 'ri-lightbulb-flash-line', color: 'from-teal-500 to-cyan-500' },
    { key: 'scamper' as const, label: 'SCAMPER', icon: 'ri-compass-3-line', color: 'from-orange-500 to-amber-500' },
    { key: 'triz' as const, label: 'TRIZ', icon: 'ri-puzzle-line', color: 'from-green-500 to-emerald-500' },
    { key: 'ai' as const, label: 'AI创意', icon: 'ri-sparkling-line', color: 'from-rose-500 to-pink-500' },
  ];

  const scoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-600';
    if (score >= 75) return 'text-teal-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-500';
  };

  const scoreBg = (score: number) => {
    if (score >= 90) return 'from-emerald-500 to-green-500';
    if (score >= 75) return 'from-teal-500 to-cyan-500';
    if (score >= 60) return 'from-amber-500 to-yellow-500';
    return 'from-red-500 to-rose-500';
  };

  return (
    <div className="space-y-6">
      {/* 版本控制工具栏 */}
      <VersionControl
        versions={versions}
        currentVersion={currentVersion}
        onRestore={handleRestore}
        onSaveVersion={handleSaveVersion}
        moduleName="创新思维与创意生成"
      />

      {/* 模块头部 */}
      <div className="bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
            <i className="ri-lightbulb-flash-line text-2xl"></i>
          </div>
          <div>
            <h2 className="text-xl font-bold mb-1">创新思维与创意生成</h2>
            <p className="text-white/80 text-sm">运用结构化方法生成并筛选高质量创业点子</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation - 实例库在前 */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setActiveTab('examples')}
          className={`px-5 py-2.5 text-sm font-semibold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'examples'
              ? 'bg-gradient-to-r from-purple-500 to-violet-500 text-white shadow-lg'
              : 'bg-white text-gray-700 border border-gray-200 hover:border-purple-300'
          }`}
        >
          <i className="ri-archive-line mr-2"></i>
          实例库
        </button>
        <button
          onClick={() => setActiveTab('methods')}
          className={`px-5 py-2.5 text-sm font-semibold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'methods'
              ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-lg'
              : 'bg-white text-gray-700 border border-gray-200 hover:border-teal-300'
          }`}
        >
          <i className="ri-lightbulb-flash-line mr-2"></i>
          创新方法工具
        </button>
        <button
          onClick={() => setActiveTab('confirm')}
          className={`px-5 py-2.5 text-sm font-semibold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'confirm'
              ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg'
              : 'bg-white text-gray-700 border border-gray-200 hover:border-orange-300'
          }`}
        >
          <i className="ri-checkbox-circle-line mr-2"></i>
          确定项目主题
        </button>
      </div>

      {/* 实例库 Tab */}
      {activeTab === 'examples' && (
        <div className="grid grid-cols-4 gap-6">
          {/* 左侧分类导航 */}
          <div className="col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sticky top-24">
              <h3 className="text-base font-bold text-gray-900 mb-4">垂直方向</h3>
              <div className="space-y-2">
                {exampleCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat)}
                    className={`w-full px-4 py-3 text-sm font-medium rounded-xl transition-all text-left flex items-center gap-3 cursor-pointer ${
                      selectedCategory.id === cat.id
                        ? `bg-gradient-to-r ${cat.color} text-white shadow-md`
                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <i className={`${cat.icon} text-lg`}></i>
                    <span>{cat.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 右侧案例展示 */}
          <div className="col-span-3">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className={`w-12 h-12 bg-gradient-to-br ${selectedCategory.color} rounded-2xl flex items-center justify-center text-white`}>
                  <i className={`${selectedCategory.icon} text-2xl`}></i>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedCategory.name}</h2>
                  <p className="text-sm text-gray-500">参考以下成功案例，激发创新灵感（共{selectedCategory.cases.length}个案例）</p>
                </div>
              </div>

              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                {selectedCategory.cases.map((caseItem, index) => (
                  <div key={index} className="border border-gray-200 rounded-xl p-5 hover:shadow-lg hover:border-teal-200 transition-all">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="text-base font-bold text-gray-900 mb-2">{caseItem.title}</h3>
                        <p className="text-sm text-gray-600 leading-relaxed mb-3">{caseItem.description}</p>
                        <div className="flex items-center gap-2 mb-3">
                          {caseItem.tags.map((tag, i) => (
                            <span key={i} className="px-2.5 py-1 bg-teal-50 text-teal-700 text-xs font-medium rounded-full whitespace-nowrap">
                              {tag}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg p-2.5">
                          <i className="ri-trophy-line text-green-600 text-sm mt-0.5"></i>
                          <div>
                            <p className="text-xs font-semibold text-green-800 mb-0.5">项目成果</p>
                            <p className="text-xs text-green-700">{caseItem.impact}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 创新方法工具 Tab */}
      {activeTab === 'methods' && (
        <div className="grid grid-cols-3 gap-6">
          {/* 左侧栏 */}
          <div className="col-span-1 space-y-5">
            {/* 学习资源 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                <i className="ri-book-open-line text-teal-500"></i>学习资源
              </h3>
              <div className="space-y-4">
                {learningResources.map((res, i) => (
                  <div key={i} className="border-b border-gray-100 last:border-0 pb-3 last:pb-0">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-gray-900 mb-1 truncate">{res.title}</h4>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <i className={res.type === '视频' ? 'ri-video-line' : 'ri-file-text-line'}></i>
                            {res.type}
                          </span>
                          <span>{res.duration}</span>
                        </div>
                      </div>
                      {res.progress === 100 && (
                        <i className="ri-checkbox-circle-fill text-green-500 text-base ml-2 flex-shrink-0"></i>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full"
                          style={{ width: `${res.progress}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-500 whitespace-nowrap">{res.progress}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 团队讨论 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                <i className="ri-chat-3-line text-orange-500"></i>团队讨论
              </h3>
              <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
                {messages.map((msg, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div
                        className={`w-6 h-6 bg-gradient-to-br ${msg.color} rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}
                      >
                        {msg.name.charAt(0)}
                      </div>
                      <span className="text-xs font-semibold text-gray-900">{msg.name}</span>
                      <span className="text-xs text-gray-400 ml-auto">{msg.time}</span>
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed">{msg.text}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                  placeholder="输入你的想法..."
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
                <button
                  onClick={handleSendChat}
                  className="w-9 h-9 flex items-center justify-center bg-gradient-to-br from-teal-500 to-cyan-500 text-white rounded-xl hover:shadow-md transition-all cursor-pointer flex-shrink-0"
                >
                  <i className="ri-send-plane-fill text-sm"></i>
                </button>
              </div>
            </div>
          </div>

          {/* 右侧主内容 */}
          <div className="col-span-2 space-y-5">
            {/* 创新方法工具 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-base font-bold text-gray-900 mb-4">创新方法工具</h3>
              <div className="grid grid-cols-4 gap-2 mb-5">
                {methodTabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveMethod(tab.key)}
                    className={`px-3 py-2.5 text-xs font-semibold rounded-xl transition-all whitespace-nowrap cursor-pointer flex items-center justify-center gap-1.5 ${
                      activeMethod === tab.key
                        ? `bg-gradient-to-br ${tab.color} text-white shadow-md`
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <i className={tab.icon}></i>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* 头脑风暴 */}
              {activeMethod === 'brainstorm' && (
                <div className="space-y-4">
                  <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
                    <h4 className="text-sm font-bold text-teal-900 mb-1">头脑风暴法</h4>
                    <p className="text-xs text-teal-700 mb-2">自由发散思维，不限制创意方向，鼓励大胆想象</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-teal-700">
                      <span>• 延迟判断，先发散后收敛</span>
                      <span>• 鼓励自由联想和组合</span>
                      <span>• 追求数量，不限质量</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1.5">创意标题</label>
                    <input
                      type="text"
                      value={ideaTitle}
                      onChange={(e) => setIdeaTitle(e.target.value)}
                      placeholder="用一句话描述你的创意"
                      className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1.5">创意描述</label>
                    <textarea
                      value={ideaDesc}
                      onChange={(e) => setIdeaDesc(e.target.value)}
                      placeholder="详细描述你的创意，包括核心亮点和初步可行性分析"
                      rows={4}
                      maxLength={500}
                      className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                    />
                  </div>
                  <button
                    onClick={handleSubmitIdea}
                    className="w-full px-5 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-sm font-semibold rounded-xl hover:shadow-md transition-all whitespace-nowrap cursor-pointer flex items-center justify-center gap-2"
                  >
                    <i className="ri-sparkling-line"></i>提交创意并获取AI分析
                  </button>
                </div>
              )}

              {/* SCAMPER */}
              {activeMethod === 'scamper' && (
                <div className="space-y-4">
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                    <h4 className="text-sm font-bold text-orange-900 mb-1">SCAMPER奔驰法</h4>
                    <p className="text-xs text-orange-700">从7个维度改进现有产品或服务</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-orange-700">
                      <span>• S - 替代 (Substitute)</span>
                      <span>• C - 组合 (Combine)</span>
                      <span>• A - 调整 (Adapt)</span>
                      <span>• M - 修改 (Modify)</span>
                      <span>• P - 用途 (Put to other uses)</span>
                      <span>• E - 消除 (Eliminate)</span>
                      <span>• R - 重组 (Rearrange)</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1.5">选择改进维度</label>
                    <select
                      value={scamperDim}
                      onChange={(e) => setScamperDim(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    >
                      <option>替代 - 可以用什么替代？</option>
                      <option>组合 - 可以和什么组合？</option>
                      <option>调整 - 可以如何调整？</option>
                      <option>修改 - 可以如何修改？</option>
                      <option>用途 - 还有什么用途？</option>
                      <option>消除 - 可以消除什么？</option>
                      <option>重组 - 可以如何重组？</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1.5">创意标题</label>
                    <input
                      type="text"
                      value={ideaTitle}
                      onChange={(e) => setIdeaTitle(e.target.value)}
                      placeholder="用一句话描述你的创意"
                      className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1.5">创意描述</label>
                    <textarea
                      value={ideaDesc}
                      onChange={(e) => setIdeaDesc(e.target.value)}
                      placeholder="基于选择的维度，描述你的创新想法"
                      rows={4}
                      maxLength={500}
                      className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                    />
                  </div>
                  <button
                    onClick={handleSubmitIdea}
                    className="w-full px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-semibold rounded-xl hover:shadow-md transition-all whitespace-nowrap cursor-pointer flex items-center justify-center gap-2"
                  >
                    <i className="ri-sparkling-line"></i>提交创意并获取AI分析
                  </button>
                </div>
              )}

              {/* TRIZ */}
              {activeMethod === 'triz' && (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <h4 className="text-sm font-bold text-green-900 mb-1">TRIZ创新原理</h4>
                    <p className="text-xs text-green-700">
                      基于40个创新原理解决技术矛盾，识别问题中的矛盾，运用TRIZ原理找到创新解决方案
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1.5">创意标题</label>
                    <input
                      type="text"
                      value={ideaTitle}
                      onChange={(e) => setIdeaTitle(e.target.value)}
                      placeholder="用一句话描述你的创意"
                      className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1.5">问题描述</label>
                    <textarea
                      value={trizProblem}
                      onChange={(e) => setTrizProblem(e.target.value)}
                      placeholder="描述你想解决的问题或技术矛盾"
                      rows={3}
                      maxLength={500}
                      className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1.5">解决方案</label>
                    <textarea
                      value={trizSolution}
                      onChange={(e) => {
                        setTrizSolution(e.target.value);
                        setIdeaDesc(e.target.value);
                      }}
                      placeholder="运用TRIZ原理提出的解决方案"
                      rows={3}
                      maxLength={500}
                      className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                    />
                  </div>
                  <button
                    onClick={handleSubmitIdea}
                    className="w-full px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-sm font-semibold rounded-xl hover:shadow-md transition-all whitespace-nowrap cursor-pointer flex items-center justify-center gap-2"
                  >
                    <i className="ri-sparkling-line"></i>提交创意并获取AI分析
                  </button>
                </div>
              )}

              {/* AI创意 */}
              {activeMethod === 'ai' && (
                <div className="space-y-4">
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
                    <h4 className="text-sm font-bold text-rose-900 mb-1">AI智能创意生成</h4>
                    <p className="text-xs text-rose-700">基于市场趋势和用户需求，AI为你生成创新创意</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1.5">目标领域</label>
                    <input
                      type="text"
                      value={aiDomain}
                      onChange={(e) => setAiDomain(e.target.value)}
                      placeholder="例如：教育科技、智慧校园、健康管理"
                      className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1.5">目标用户</label>
                    <input
                      type="text"
                      value={aiUser}
                      onChange={(e) => setAiUser(e.target.value)}
                      placeholder="例如：大学生、上班族、老年人"
                      className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1.5">核心需求</label>
                    <textarea
                      value={aiNeed}
                      onChange={(e) => setAiNeed(e.target.value)}
                      placeholder="描述目标用户的核心痛点和需求"
                      rows={3}
                      maxLength={500}
                      className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent resize-none"
                    />
                  </div>
                  <button
                    onClick={() => {
                      if (!aiDomain.trim()) return;
                      const generated: Idea = {
                        id: Date.now(),
                        title: `AI生成：${aiDomain}智能解决方案`,
                        description: `面向${aiUser || '目标用户'}，解决${aiNeed || '核心痛点'}的AI驱动创新产品`,
                        method: 'AI创意',
                        author: '我（AI辅助）',
                        votes: 0,
                        novelty: 4.5,
                        feasibility: 3.8,
                      };
                      setIdeas((prev) => [generated, ...prev]);
                      setAiDomain('');
                      setAiUser('');
                      setAiNeed('');
                      setTimeout(() => triggerAiAnalysis(generated.id), 300);
                    }}
                    className="w-full px-5 py-2.5 bg-gradient-to-r from-rose-500 to-pink-500 text-white text-sm font-semibold rounded-xl hover:shadow-md transition-all whitespace-nowrap cursor-pointer flex items-center justify-center gap-2"
                  >
                    <i className="ri-sparkling-line"></i>AI生成创意并分析
                  </button>
                </div>
              )}
            </div>

            {/* 团队创意库 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <i className="ri-archive-line text-teal-600"></i>
                  团队创意库
                  <span className="px-2 py-0.5 bg-teal-100 text-teal-700 text-xs font-semibold rounded-full">{ideas.length}</span>
                </h3>
                <button className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer">
                  <i className="ri-download-line mr-1"></i>导出报告
                </button>
              </div>
              <div className="space-y-4">
                {ideas.map((idea) => (
                  <div key={idea.id} className="border-2 border-gray-100 rounded-xl overflow-hidden hover:shadow-md hover:border-teal-200 transition-all">
                    {/* 创意基本信息 */}
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0 pr-3">
                          <h4 className="text-sm font-bold text-gray-900 mb-1">{idea.title}</h4>
                          <p className="text-xs text-gray-500 leading-relaxed mb-2">{idea.description}</p>
                          <div className="flex items-center gap-3 text-xs text-gray-400">
                            <span className="flex items-center gap-1">
                              <i className="ri-user-line"></i>
                              {idea.author}
                            </span>
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full whitespace-nowrap">{idea.method}</span>
                            {idea.aiAnalysis && (
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold bg-gradient-to-r ${scoreBg(idea.aiAnalysis.overallScore)} text-white whitespace-nowrap`}>
                                AI评分 {idea.aiAnalysis.overallScore}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleVote(idea.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                              votedIds.includes(idea.id) ? 'bg-teal-500 text-white' : 'bg-teal-50 text-teal-600 hover:bg-teal-100'
                            }`}
                          >
                            <i className="ri-thumb-up-line"></i>
                            {idea.votes}
                          </button>
                          {!idea.aiAnalysis && !idea.analyzing && (
                            <button
                              onClick={() => triggerAiAnalysis(idea.id)}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-violet-50 text-violet-600 hover:bg-violet-100 transition-all whitespace-nowrap cursor-pointer"
                            >
                              <i className="ri-sparkling-line"></i>AI分析
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-5 pt-3 border-t border-gray-100">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-500">新颖性</span>
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <i
                                key={s}
                                className={`${
                                  s <= (idea.aiAnalysis?.novelty ?? idea.novelty) ? 'ri-star-fill text-amber-400' : 'ri-star-line text-gray-300'
                                } text-xs`}
                              ></i>
                            ))}
                          </div>
                          <span className="text-xs font-semibold text-gray-700">{idea.aiAnalysis?.novelty ?? idea.novelty}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-500">可行性</span>
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <i
                                key={s}
                                className={`${
                                  s <= (idea.aiAnalysis?.feasibility ?? idea.feasibility) ? 'ri-star-fill text-green-400' : 'ri-star-line text-gray-300'
                                } text-xs`}
                              ></i>
                            ))}
                          </div>
                          <span className="text-xs font-semibold text-gray-700">{idea.aiAnalysis?.feasibility ?? idea.feasibility}</span>
                        </div>
                        {idea.aiAnalysis && (
                          <>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-gray-500">市场潜力</span>
                              <div className="flex items-center gap-0.5">
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <i key={s} className={`${s <= idea.aiAnalysis!.marketPotential ? 'ri-star-fill text-rose-400' : 'ri-star-line text-gray-300'} text-xs`}></i>
                                ))}
                              </div>
                              <span className="text-xs font-semibold text-gray-700">{idea.aiAnalysis.marketPotential}</span>
                            </div>
                            <button
                              onClick={() => setExpandedAnalysis(expandedAnalysis === idea.id ? null : idea.id)}
                              className="ml-auto flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium cursor-pointer whitespace-nowrap"
                            >
                              <i className={`${expandedAnalysis === idea.id ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'}`}></i>
                              {expandedAnalysis === idea.id ? '收起分析' : '查看AI分析'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* AI分析加载中 */}
                    {idea.analyzing && (
                      <div className="border-t border-gray-100 bg-gradient-to-br from-violet-50 to-indigo-50 p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 flex items-center justify-center bg-gradient-to-br from-violet-500 to-indigo-500 rounded-xl flex-shrink-0">
                            <i className="ri-sparkling-line text-white text-sm animate-spin"></i>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-violet-800">AI正在分析你的创意...</p>
                            <p className="text-xs text-violet-600 mt-0.5">正在评估新颖性、可行性、市场潜力和创新价值</p>
                          </div>
                          <div className="ml-auto flex gap-1">
                            {[0, 1, 2].map((i) => (
                              <div key={i} className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }}></div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* AI分析结果展开面板 */}
                    {idea.aiAnalysis && expandedAnalysis === idea.id && (
                      <div className="border-t border-teal-100 bg-gradient-to-br from-slate-50 to-teal-50/30 p-5 space-y-4">
                        {/* 顶部评分概览 */}
                        <div className="flex items-center gap-4">
                          <div className={`w-16 h-16 bg-gradient-to-br ${scoreBg(idea.aiAnalysis.overallScore)} rounded-2xl flex flex-col items-center justify-center text-white shadow-md`}>
                            <span className="text-xl font-black leading-none">{idea.aiAnalysis.overallScore}</span>
                            <span className="text-xs opacity-80 mt-0.5">综合分</span>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <i className="ri-robot-2-line text-teal-500 text-sm"></i>
                              <span className="text-sm font-bold text-gray-900">AI创意分析报告</span>
                            </div>
                            <p className="text-xs text-gray-600 leading-relaxed">{idea.aiAnalysis.summary}</p>
                          </div>
                        </div>

                        {/* 四维雷达评分 */}
                        <div className="grid grid-cols-4 gap-2">
                          {[
                            { label: '新颖性', value: idea.aiAnalysis.novelty, color: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700' },
                            { label: '可行性', value: idea.aiAnalysis.feasibility, color: 'bg-green-500', bg: 'bg-green-50', text: 'text-green-700' },
                            { label: '市场潜力', value: idea.aiAnalysis.marketPotential, color: 'bg-rose-500', bg: 'bg-rose-50', text: 'text-rose-700' },
                            { label: '创新价值', value: idea.aiAnalysis.innovation, color: 'bg-teal-500', bg: 'bg-teal-50', text: 'text-teal-700' },
                          ].map((dim) => (
                            <div key={dim.label} className={`${dim.bg} rounded-xl p-3 text-center`}>
                              <div className={`text-lg font-black ${dim.text}`}>{dim.value}</div>
                              <div className="text-xs text-gray-500 mb-1.5">{dim.label}</div>
                              <div className="h-1.5 bg-white rounded-full overflow-hidden">
                                <div className={`h-full ${dim.color} rounded-full transition-all`} style={{ width: `${(dim.value / 5) * 100}%` }}></div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* 优势 & 不足 */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                            <h5 className="text-xs font-bold text-emerald-800 mb-2 flex items-center gap-1.5">
                              <i className="ri-thumb-up-fill text-emerald-500"></i>创意优势
                            </h5>
                            <ul className="space-y-1.5">
                              {idea.aiAnalysis.strengths.map((s, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-xs text-emerald-700">
                                  <i className="ri-check-line text-emerald-500 flex-shrink-0 mt-0.5"></i>
                                  {s}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                            <h5 className="text-xs font-bold text-amber-800 mb-2 flex items-center gap-1.5">
                              <i className="ri-error-warning-fill text-amber-500"></i>待改进点
                            </h5>
                            <ul className="space-y-1.5">
                              {idea.aiAnalysis.weaknesses.map((w, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-xs text-amber-700">
                                  <i className="ri-arrow-right-line text-amber-500 flex-shrink-0 mt-0.5"></i>
                                  {w}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {/* AI建议 */}
                        <div className="bg-white border border-teal-100 rounded-xl p-3">
                          <h5 className="text-xs font-bold text-gray-800 mb-2 flex items-center gap-1.5">
                            <i className="ri-lightbulb-line text-teal-500"></i>AI优化建议
                          </h5>
                          <ul className="space-y-2">
                            {idea.aiAnalysis.suggestions.map((sug, i) => (
                              <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                                <span className="w-4 h-4 flex-shrink-0 bg-teal-100 text-teal-700 rounded-full flex items-center justify-center font-bold text-xs">{i + 1}</span>
                                {sug}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* 标签 */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-gray-400">AI标签：</span>
                          {idea.aiAnalysis.tags.map((tag, i) => (
                            <span key={i} className="px-2.5 py-1 bg-teal-100 text-teal-700 text-xs font-medium rounded-full whitespace-nowrap">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 确定项目主题 Tab */}
      {activeTab === 'confirm' && (
        <div className="max-w-3xl mx-auto">
          {!isUnderReview ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl flex items-center justify-center text-white mx-auto mb-4">
                  <i className="ri-flag-line text-3xl"></i>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">确定项目主题</h2>
                <p className="text-sm text-gray-600">经过头脑风暴和实例参考，现在让我们确定最终的项目主题</p>
              </div>

              {/* 项目信息填写 */}
              <div className="space-y-5 mb-8">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    <i className="ri-bookmark-line text-orange-500 mr-1"></i>
                    项目名称 <span className="text-red-500">*</span>
                    <span className="text-xs font-normal text-gray-400 ml-2">({projectTheme.name.length}/5字以上)</span>
                  </label>
                  <input
                    type="text"
                    value={projectTheme.name}
                    onChange={(e) => {
                      setProjectTheme({ ...projectTheme, name: e.target.value });
                      if (formErrors.name) setFormErrors({ ...formErrors, name: '' });
                    }}
                    placeholder="为你的项目起一个响亮的名字（至少5个字）"
                    className={`w-full px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                      formErrors.name ? 'border-red-300 bg-red-50' : 'border-gray-200'
                    }`}
                  />
                  {formErrors.name && <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    <i className="ri-star-line text-orange-500 mr-1"></i>
                    核心价值主张 <span className="text-red-500">*</span>
                    <span className="text-xs font-normal text-gray-400 ml-2">({projectTheme.value.length}/20字以上)</span>
                  </label>
                  <textarea
                    value={projectTheme.value}
                    onChange={(e) => {
                      setProjectTheme({ ...projectTheme, value: e.target.value });
                      if (formErrors.value) setFormErrors({ ...formErrors, value: '' });
                    }}
                    placeholder="用一句话说明你的项目为用户创造什么价值（至少20个字）"
                    rows={2}
                    className={`w-full px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none ${
                      formErrors.value ? 'border-red-300 bg-red-50' : 'border-gray-200'
                    }`}
                  />
                  {formErrors.value && <p className="text-xs text-red-500 mt-1">{formErrors.value}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    <i className="ri-user-heart-line text-orange-500 mr-1"></i>
                    目标用户 <span className="text-red-500">*</span>
                    <span className="text-xs font-normal text-gray-400 ml-2">({projectTheme.target.length}/10字以上)</span>
                  </label>
                  <input
                    type="text"
                    value={projectTheme.target}
                    onChange={(e) => {
                      setProjectTheme({ ...projectTheme, target: e.target.value });
                      if (formErrors.target) setFormErrors({ ...formErrors, target: '' });
                    }}
                    placeholder="例如：大学生、上班族、老年人（至少10个字）"
                    className={`w-full px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                      formErrors.target ? 'border-red-300 bg-red-50' : 'border-gray-200'
                    }`}
                  />
                  {formErrors.target && <p className="text-xs text-red-500 mt-1">{formErrors.target}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    <i className="ri-question-line text-orange-500 mr-1"></i>
                    解决的核心问题 <span className="text-red-500">*</span>
                    <span className="text-xs font-normal text-gray-400 ml-2">({projectTheme.problem.length}/50字以上)</span>
                  </label>
                  <textarea
                    value={projectTheme.problem}
                    onChange={(e) => {
                      setProjectTheme({ ...projectTheme, problem: e.target.value });
                      if (formErrors.problem) setFormErrors({ ...formErrors, problem: '' });
                    }}
                    placeholder="描述目标用户面临的核心痛点和问题（至少50个字）"
                    rows={3}
                    className={`w-full px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none ${
                      formErrors.problem ? 'border-red-300 bg-red-50' : 'border-gray-200'
                    }`}
                  />
                  {formErrors.problem && <p className="text-xs text-red-500 mt-1">{formErrors.problem}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    <i className="ri-lightbulb-line text-orange-500 mr-1"></i>
                    解决方案概述 <span className="text-red-500">*</span>
                    <span className="text-xs font-normal text-gray-400 ml-2">({projectTheme.solution.length}/100字以上)</span>
                  </label>
                  <textarea
                    value={projectTheme.solution}
                    onChange={(e) => {
                      setProjectTheme({ ...projectTheme, solution: e.target.value });
                      if (formErrors.solution) setFormErrors({ ...formErrors, solution: '' });
                    }}
                    placeholder="简要描述你的解决方案和核心功能（至少100个字）"
                    rows={4}
                    className={`w-full px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none ${
                      formErrors.solution ? 'border-red-300 bg-red-50' : 'border-gray-200'
                    }`}
                  />
                  {formErrors.solution && <p className="text-xs text-red-500 mt-1">{formErrors.solution}</p>}
                </div>
              </div>

              {/* 提交按钮 */}
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={handleConfirmTheme}
                  disabled={isSubmitting}
                  className={`px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-base font-bold rounded-xl hover:shadow-lg transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
                    isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <i className="ri-loader-4-line animate-spin"></i>
                      提交中...
                    </>
                  ) : (
                    <>
                      <i className="ri-check-line"></i>
                      提交项目主题
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            // 等待审核状态页面
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12">
              <div className="text-center">
                <div className="w-24 h-24 bg-gradient-to-br from-amber-100 to-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <i className="ri-time-line text-5xl text-orange-500"></i>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">项目主题已提交</h2>
                <p className="text-base text-gray-600 mb-8">你的项目主题正在等待教师审核，审核通过后即可进入下一阶段</p>
                
                {/* 已提交的项目信息预览 */}
                <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-6 mb-8 text-left">
                  <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <i className="ri-file-list-3-line text-orange-500"></i>
                    已提交的项目信息
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <span className="text-xs font-semibold text-gray-500">项目名称：</span>
                      <p className="text-sm text-gray-900 mt-1">{projectTheme.name}</p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-500">核心价值主张：</span>
                      <p className="text-sm text-gray-900 mt-1">{projectTheme.value}</p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-500">目标用户：</span>
                      <p className="text-sm text-gray-900 mt-1">{projectTheme.target}</p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-500">解决的核心问题：</span>
                      <p className="text-sm text-gray-900 mt-1">{projectTheme.problem}</p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-500">解决方案概述：</span>
                      <p className="text-sm text-gray-900 mt-1">{projectTheme.solution}</p>
                    </div>
                  </div>
                </div>

                {/* 审核状态提示 */}
                <div className="flex items-center justify-center gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                  <i className="ri-information-line text-blue-500 text-xl"></i>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-blue-900">审核中</p>
                    <p className="text-xs text-blue-700">教师将对你的项目主题进行评审，请耐心等待</p>
                  </div>
                </div>

                {/* 下一步提示 */}
                <div className="bg-gray-50 rounded-xl p-5">
                  <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center justify-center gap-2">
                    <i className="ri-lightbulb-line text-teal-500"></i>
                    审核通过后你可以
                  </h4>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div className="bg-white rounded-lg p-3 text-center">
                      <i className="ri-search-line text-teal-500 text-2xl mb-2"></i>
                      <p className="text-gray-700">开展市场调研</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center">
                      <i className="ri-palette-line text-purple-500 text-2xl mb-2"></i>
                      <p className="text-gray-700">进行产品设计</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center">
                      <i className="ri-file-text-line text-orange-500 text-2xl mb-2"></i>
                      <p className="text-gray-700">撰写商业计划</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 成功提示 */}
      {showSuccess && (
        <div className="fixed bottom-8 right-8 bg-green-500 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-bounce z-50">
          <i className="ri-checkbox-circle-fill text-2xl"></i>
          <div>
            <p className="font-bold">项目主题已提交！</p>
            <p className="text-sm opacity-90">等待教师审核通过后即可继续</p>
          </div>
        </div>
      )}
    </div>
  );
}
