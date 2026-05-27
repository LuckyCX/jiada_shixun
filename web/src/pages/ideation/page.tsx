import { Link } from 'react-router-dom';
import { useState } from 'react';
import VersionControl from '../../components/feature/VersionControl';

interface Version {
  id: number;
  versionNumber: number;
  description: string;
  timestamp: string;
  author: string;
  data: any;
}

export default function Ideation() {
  const [activeTab, setActiveTab] = useState<'examples' | 'methods' | 'confirm'>('examples');
  const [activeMethod, setActiveMethod] = useState<'brainstorm' | 'scamper' | 'triz' | 'ai'>('brainstorm');

  // 版本控制状态 - 创意库
  const [ideasVersions, setIdeasVersions] = useState<Version[]>([
    {
      id: 1,
      versionNumber: 1,
      description: '初始版本 - 创意库',
      timestamp: new Date().toISOString(),
      author: '当前用户',
      data: { ideas: [] }
    }
  ]);
  const [ideasCurrentVersion, setIdeasCurrentVersion] = useState(1);

  // 版本控制状态 - 项目选题
  const [themeVersions, setThemeVersions] = useState<Version[]>([
    {
      id: 1,
      versionNumber: 1,
      description: '初始版本 - 项目选题',
      timestamp: new Date().toISOString(),
      author: '当前用户',
      data: { projectTheme: {} }
    }
  ]);
  const [themeCurrentVersion, setThemeCurrentVersion] = useState(1);

  // 版本控制处理函数 - 创意库
  const handleSaveIdeasVersion = (description: string) => {
    const newVersion: Version = {
      id: ideasVersions.length + 1,
      versionNumber: ideasVersions.length + 1,
      description,
      timestamp: new Date().toISOString(),
      author: '当前用户',
      data: { 
        ideas,
        activeMethod
      }
    };
    setIdeasVersions([...ideasVersions, newVersion]);
    setIdeasCurrentVersion(newVersion.versionNumber);
  };

  const handleRestoreIdeasVersion = (versionNumber: number) => {
    const version = ideasVersions.find(v => v.versionNumber === versionNumber);
    if (version && version.data) {
      setIdeasCurrentVersion(versionNumber);
      if (version.data.activeMethod) {
        setActiveMethod(version.data.activeMethod);
      }
      alert(`已回撤到版本 v${versionNumber}`);
    }
  };

  // 版本控制处理函数 - 项目选题
  const handleSaveThemeVersion = (description: string) => {
    const newVersion: Version = {
      id: themeVersions.length + 1,
      versionNumber: themeVersions.length + 1,
      description,
      timestamp: new Date().toISOString(),
      author: '当前用户',
      data: { 
        projectTheme
      }
    };
    setThemeVersions([...themeVersions, newVersion]);
    setThemeCurrentVersion(newVersion.versionNumber);
  };

  const handleRestoreThemeVersion = (versionNumber: number) => {
    const version = themeVersions.find(v => v.versionNumber === versionNumber);
    if (version && version.data) {
      if (version.data.projectTheme) {
        setProjectTheme(version.data.projectTheme);
      }
      setThemeCurrentVersion(versionNumber);
    }
  };

  const learningResources = [
    { title: '创新思维基础理论', type: '视频', duration: '45分钟', progress: 100 },
    { title: 'SCAMPER创新方法详解', type: '文档', duration: '20分钟', progress: 80 },
    { title: '头脑风暴实战案例', type: '视频', duration: '30分钟', progress: 60 },
    { title: 'TRIZ创新原理应用', type: '文档', duration: '25分钟', progress: 0 }
  ];

  const ideas = [
    {
      id: 1,
      title: '智能校园外卖配送机器人',
      description: '利用自动驾驶技术，在校园内实现无人配送，解决高峰期配送慢的问题',
      method: '头脑风暴',
      author: '张明',
      votes: 12,
      novelty: 4.5,
      feasibility: 3.8
    },
    {
      id: 2,
      title: '大学生二手教材交易平台',
      description: '基于区块链的可信二手书交易平台，解决教材浪费和价格不透明问题',
      method: 'SCAMPER',
      author: '李娜',
      votes: 8,
      novelty: 3.9,
      feasibility: 4.2
    },
    {
      id: 3,
      title: 'AI驱动的个性化学习助手',
      description: '根据学生学习习惯和知识掌握情况，智能推荐学习内容和路径',
      method: 'AI创意',
      author: '王强',
      votes: 15,
      novelty: 4.8,
      feasibility: 3.5
    }
  ];

  // 实例库数据 - 扩展案例数量并增加详细描述
  const exampleCategories = [
    {
      id: 1,
      name: '乡村振兴',
      icon: 'ri-plant-line',
      color: 'from-green-500 to-emerald-500',
      cases: [
        {
          title: '智慧农业监测系统',
          description: '利用AI图像识别技术结合物联网传感器，实时监测农作物生长状态、土壤湿度、温度等关键指标。系统能够智能识别病虫害早期症状，提供精准施肥建议，帮助农户科学种植。通过大数据分析历史种植数据，预测最佳收获时间，显著提升农作物产量和品质。',
          tags: ['AI视觉', '物联网', '精准农业'],
          impact: '帮助农户提升30%产量，减少20%农药使用'
        },
        {
          title: '农产品溯源区块链平台',
          description: '基于区块链技术的农产品全流程溯源平台，从种植、施肥、采摘到包装、运输、销售的每个环节都有不可篡改的记录。消费者通过扫码即可查看产品完整履历，农户也能建立品牌信誉，实现优质优价。平台还集成了智能合约功能，自动执行交易和分润，降低中间成本。',
          tags: ['区块链', '溯源', '品牌建设'],
          impact: '帮助100+农户实现优质优价，平均增收25%'
        },
        {
          title: '乡村电商直播助农平台',
          description: 'AI智能选品系统结合直播带货模式，为农户提供一站式电商解决方案。平台通过分析市场需求和消费趋势，为农户推荐热销产品，提供直播培训和技术支持。同时整合物流配送体系，确保农产品新鲜到达消费者手中，打通农户与城市消费者的直接连接渠道。',
          tags: ['电商', '直播', 'AI推荐'],
          impact: '累计销售额突破500万，带动200+农户增收'
        },
        {
          title: '智能温室控制系统',
          description: '采用先进的环境控制技术，自动调节温室内的温度、湿度、光照和二氧化碳浓度。系统配备多种传感器实时监测作物生长环境，通过机器学习算法优化生长条件，实现全年无季节限制的高效种植。特别适合高价值经济作物的规模化生产。',
          tags: ['智能控制', '温室技术', '精准种植'],
          impact: '作物产量提升40%，节水节能30%'
        },
        {
          title: '农机共享服务平台',
          description: '类似共享单车的农机共享模式，小农户可以通过手机APP预约使用大型农机设备。平台整合了拖拉机、收割机、播种机等各类农机资源，提供GPS定位、使用指导、维修保养等全套服务。大大降低了小农户的机械化成本，提高了农机利用率和农业生产效率。',
          tags: ['共享经济', '农机服务', '降本增效'],
          impact: '服务农户1000+，农机利用率提升50%'
        },
        {
          title: '乡村旅游智慧导览',
          description: '为乡村旅游景点开发的智能导览系统，游客通过微信小程序即可获得个性化的旅游路线推荐。系统结合AR技术展示农耕文化历史，提供语音讲解和互动体验。还能实时显示各景点人流量，帮助游客避开拥挤区域，提升旅游体验的同时增加农民旅游收入。',
          tags: ['智慧旅游', 'AR导览', '文化传承'],
          impact: '年接待游客增长60%，带动周边农户增收'
        },
        {
          title: '农村金融科技服务',
          description: '专为农户设计的数字金融服务平台，通过分析农户的种植数据、销售记录、信用历史等信息，为其提供个性化的贷款服务。平台还提供农业保险、理财产品等金融服务，帮助农户规避自然灾害风险。简化的申请流程和快速审批机制，解决了农户融资难的问题。',
          tags: ['金融科技', '信贷服务', '风险管理'],
          impact: '累计放款5000万元，坏账率控制在2%以内'
        },
        {
          title: '生态循环农业系统',
          description: '构建种植业、养殖业、加工业相结合的生态循环农业模式。通过科学规划，实现农业废料的循环利用：畜禽粪便制成有机肥，秸秆用于生物质发电，废水经处理后用于灌溉。系统不仅提高了资源利用率，还实现了绿色环保的可持续发展，为农户创造多元化收入来源。',
          tags: ['循环农业', '生态环保', '可持续发展'],
          impact: '综合效益提升35%，实现零废料排放'
        },
        {
          title: '农产品品牌孵化平台',
          description: '为优质农产品提供从品牌策划到市场推广的全链条孵化服务。平台聚集了设计师、营销专家、渠道商等专业资源，帮助农户打造独特的产品品牌。通过线上线下结合的营销策略，将地方特色农产品推向更广阔的市场，实现从卖原料到卖品牌的转型升级。',
          tags: ['品牌孵化', '营销策划', '价值提升'],
          impact: '成功孵化品牌20个，平均溢价150%'
        },
        {
          title: '智慧水肥一体化系统',
          description: '集成了精准灌溉和智能施肥功能的现代农业系统。通过土壤传感器实时监测养分含量，结合作物生长阶段的需求，自动配比和输送水肥混合液。系统还能根据天气预报调整灌溉计划，实现水肥的精准供给。这项技术特别适用于大棚蔬菜和果树种植，能显著提高产量和品质。',
          tags: ['精准灌溉', '智能施肥', '节水农业'],
          impact: '节水40%，增产25%，肥料利用率提升30%'
        }
      ]
    },
    {
      id: 2,
      name: '智慧养老',
      icon: 'ri-heart-pulse-line',
      color: 'from-rose-500 to-pink-500',
      cases: [
        {
          title: '智能健康监护手环',
          description: '专为老年人设计的多功能健康监护设备，集成心率、血压、血氧、体温等多项生理指标监测功能。设备具备跌倒检测算法，能够准确识别异常状况并自动发送紧急求助信息给家属和医护人员。续航能力强，操作简单，还配备了用药提醒、运动指导等健康管理功能。',
          tags: ['可穿戴设备', '健康监测', '紧急救助'],
          impact: '服务5000+老人，成功预警紧急情况120+次'
        },
        {
          title: 'AI陪伴机器人',
          description: '具备先进自然语言处理能力的智能陪伴机器人，能够与老人进行自然对话，播放音乐、讲故事、提醒服药。机器人还配备了视频通话功能，帮助老人与家人保持联系。通过机器学习不断优化交互体验，能够识别老人的情绪变化，在孤独时主动提供陪伴和安慰，有效改善老人的心理健康状况。',
          tags: ['机器人', '语音交互', '情感陪伴'],
          impact: '用户满意度92%，有效改善老人心理健康'
        },
        {
          title: '社区智慧养老服务平台',
          description: '整合社区内医疗、家政、配餐、维修等各类服务资源的综合平台。老人通过简单的一键式设备即可呼叫所需服务，平台自动匹配最近的服务提供者。系统还建立了老人健康档案，为医护人员提供连续性的健康管理支持。通过大数据分析，能够预测老人的服务需求，提前安排相应资源。',
          tags: ['O2O平台', '社区服务', '一站式'],
          impact: '覆盖20个社区，服务老人3000+人'
        },
        {
          title: '智能居家安全系统',
          description: '为独居老人家庭设计的智能安全监护系统，通过部署在各房间的传感器监测老人的日常活动轨迹。系统能够识别异常行为模式，如长时间未移动、夜间频繁起床等，及时向家属发出关爱提醒。还集成了燃气泄漏、烟雾探测等安全功能，全方位保障老人居家安全。',
          tags: ['智能家居', '行为监测', '安全防护'],
          impact: '安装家庭2000+，事故预防率提升80%'
        },
        {
          title: '老年认知训练平台',
          description: '专业的认知功能训练和评估平台，通过游戏化的方式帮助老年人进行记忆力、注意力、逻辑思维等认知能力训练。平台根据老人的认知水平定制个性化训练方案，实时跟踪训练效果。还提供认知障碍早期筛查功能，帮助及早发现和干预认知功能衰退，延缓老年痴呆的进展。',
          tags: ['认知训练', '游戏化', '早期干预'],
          impact: '训练老人5000+，认知水平平均改善15%'
        },
        {
          title: '智慧养老院管理系统',
          description: '全面的养老院数字化管理解决方案，包括老人健康档案管理、护理计划制定、用药管理、床位调度等功能。系统通过物联网设备实时监测老人状况，自动生成护理报告，提高护理质量和效率。还提供家属探视预约、费用查询等服务，增强养老院运营的透明度和专业性。',
          tags: ['机构管理', '数字化', '护理优化'],
          impact: '管理老人床位1000+，护理效率提升40%'
        },
        {
          title: '远程医疗健康平台',
          description: '专为老年人提供的远程医疗服务平台，老人可以通过视频与医生进行在线问诊，获得专业的医疗建议。平台还提供慢病管理服务，根据老人的病情制定用药方案和生活指导。配备专业的医疗设备，支持远程体检和健康监测，让老人足不出户就能享受优质的医疗服务。',
          tags: ['远程医疗', '在线问诊', '慢病管理'],
          impact: '服务老人10000+，就医便利性提升60%'
        },
        {
          title: '老年人智能出行助手',
          description: '针对老年人出行需求开发的智能交通服务系统。通过大字体、语音操作的手机APP，老人可以轻松预约出租车、查询公交路线、获得步行导航。系统还提供紧急求助功能，在老人外出时如遇突发情况可一键求助。与社区、医院等机构合作，提供专门的老年人出行绿色通道服务。',
          tags: ['智能出行', '语音操作', '紧急救助'],
          impact: '服务老人8000+，出行安全事故降低70%'
        },
        {
          title: '互助养老社交平台',
          description: '构建老年人互助养老的社交网络平台，鼓励身体健康的老人为需要帮助的老人提供力所能及的服务。平台建立积分奖励机制，老人通过帮助他人获得积分，未来也能享受他人的帮助。还组织各种兴趣小组和社交活动，丰富老年人的精神文化生活，构建温暖的老年人社区。',
          tags: ['互助养老', '社交网络', '积分激励'],
          impact: '活跃用户3000+，互助服务完成率95%'
        },
        {
          title: '智能药盒管理系统',
          description: '为需要长期服药的老年人设计的智能药物管理系统。药盒配备指纹识别和语音提醒功能，确保老人按时按量服药。系统能够监测药物库存，自动提醒续药，避免断药风险。还与医院和药店系统对接，支持在线续方和送药上门服务，让老人的用药管理更加安全便捷。',
          tags: ['用药管理', '智能提醒', '自动续方'],
          impact: '服务老人2000+，用药依从性提升85%'
        }
      ]
    },
    {
      id: 3,
      name: '教育科技',
      icon: 'ri-graduation-cap-line',
      color: 'from-blue-500 to-indigo-500',
      cases: [
        {
          title: '自适应学习系统',
          description: '基于人工智能和大数据技术的个性化学习平台，能够实时分析学生的学习行为、知识掌握程度和学习偏好。系统根据每个学生的具体情况动态调整学习内容的难度和呈现方式，推送最适合的学习资源和练习题目。通过构建完整的知识图谱，帮助学生建立系统性的知识结构，实现真正的千人千面个性化教学。',
          tags: ['自适应学习', '个性化', '知识图谱'],
          impact: '学生平均成绩提升15%，学习效率提高40%'
        },
        {
          title: 'AI作文批改助手',
          description: '运用先进的自然语言处理技术，能够智能分析学生作文的语法、逻辑结构、内容深度等多个维度。系统不仅能指出错误之处，还能提供具体的修改建议和写作技巧指导。支持多种文体的批改，包括议论文、记叙文、说明文等。通过机器学习不断优化批改标准，确保评价的公正性和准确性，大幅减轻教师批改负担。',
          tags: ['NLP', '自动批改', '写作辅导'],
          impact: '服务100+学校，批改作文50万+篇'
        },
        {
          title: '虚拟实验室平台',
          description: '利用VR/AR技术构建的沉浸式虚拟实验环境，学生可以在虚拟空间中进行各种物理、化学、生物实验。平台提供高度仿真的实验器材和环境，支持危险实验的安全模拟，让学生在零风险的环境中探索科学原理。还能重现历史上的经典实验，帮助学生更好地理解科学发展历程和实验设计思路。',
          tags: ['VR/AR', '虚拟实验', '沉浸式学习'],
          impact: '降低实验成本70%，学生实验参与度提升80%'
        },
        {
          title: '智能题库生成系统',
          description: '基于知识图谱和机器学习算法的智能题目生成平台，能够根据教学大纲和学习目标自动生成高质量的练习题和考试题。系统支持多种题型，包括选择题、填空题、计算题、论述题等。通过分析学生的答题情况，系统能够识别学生的薄弱环节，针对性地生成巩固练习题，实现精准的查漏补缺。',
          tags: ['智能题库', '自动生成', '精准练习'],
          impact: '生成题目100万+道，练习效果提升50%'
        },
        {
          title: '在线协作学习平台',
          description: '支持多人实时协作的在线学习环境，学生可以组建学习小组，共同完成项目任务和问题研究。平台提供白板、文档编辑、视频会议等协作工具，支持思维导图绘制和头脑风暴活动。通过游戏化的设计激发学生参与热情，培养团队合作能力和批判性思维，让学习变得更加有趣和高效。',
          tags: ['协作学习', '项目式学习', '游戏化'],
          impact: '学生协作能力提升35%，课堂参与度提高60%'
        },
        {
          title: 'AI教学助手机器人',
          description: '集成了语音识别、自然语言理解和知识推理能力的智能教学助手，能够回答学生的各种学科问题，提供详细的解题思路和知识点讲解。机器人还能协助教师进行课堂管理，记录学生的学习情况，生成个性化的学习报告。通过不断学习优质教师的教学方法，逐步提升教学水平和互动效果。',
          tags: ['教学机器人', '智能问答', '学习分析'],
          impact: '辅助教师200+，学生问题解决率90%'
        },
        {
          title: '智慧图书馆系统',
          description: '基于RFID技术和人工智能算法的现代化图书馆管理系统，支持图书自助借还、智能导航、座位预约等功能。系统能够分析读者的借阅历史和兴趣偏好，推荐相关图书和学术资源。还提供学习空间管理、噪音监测、环境调节等服务，为师生营造更加便捷和智能的学习环境。',
          tags: ['RFID', '智能推荐', '自助服务'],
          impact: '借阅量提升50%，管理人力成本降低40%'
        },
        {
          title: '学生心理健康平台',
          description: '运用心理学理论和大数据分析技术，为学生提供心理健康评估、咨询和干预服务。平台通过分析学生的学习行为、社交活动、情绪表达等数据，及早发现心理健康风险。提供在线心理测评、情绪日记、冥想练习等功能，还有专业心理咨询师提供一对一的心理辅导服务，全方位关爱学生心理健康。',
          tags: ['心理健康', '风险预警', '在线咨询'],
          impact: '服务学生20000+，心理危机干预成功率95%'
        },
        {
          title: '家校沟通桥梁系统',
          description: '连接学校、教师、学生和家长的多方沟通平台，实现教育信息的实时共享和互动交流。家长可以及时了解孩子的学习情况、作业完成情况和在校表现，与教师进行便捷的沟通。系统还提供家庭教育指导、亲子活动推荐等服务，促进家校合作，共同关注孩子的成长发展。',
          tags: ['家校沟通', '信息共享', '教育指导'],
          impact: '连接家庭50000+，家校沟通效率提升3倍'
        },
        {
          title: '职业规划指导系统',
          description: '基于大数据和人工智能技术的学生职业生涯规划指导平台，通过分析学生的兴趣特长、学习能力、性格特征等因素，为其推荐适合的专业方向和职业路径。系统还提供行业发展趋势分析、就业市场信息、技能培训建议等服务，帮助学生做出明智的教育和职业选择，提高就业竞争力。',
          tags: ['职业规划', '智能推荐', '就业指导'],
          impact: '指导学生10000+，就业匹配度提升40%'
        }
      ]
    },
    {
      id: 4,
      name: '智慧校园',
      icon: 'ri-school-line',
      color: 'from-teal-500 to-cyan-500',
      cases: [
        {
          title: '智能门禁考勤系统',
          description: '采用人脸识别技术和行为分析算法的新一代校园安全管理系统，能够准确识别师生身份，实现无感知考勤打卡。系统具备异常行为检测功能，可以识别翻墙、聚众斗殴、携带危险物品等风险行为，及时向安保人员发出预警。还支持访客管理、黑名单布控等功能，全面保障校园安全。',
          tags: ['人脸识别', '智能安防', '考勤管理'],
          impact: '考勤效率提升90%，校园安全事件下降60%'
        },
        {
          title: '校园能耗智能管理',
          description: '基于物联网技术的校园能源管理系统，通过部署在各建筑物的智能传感器实时监测用电、用水、用气等能耗数据。系统运用机器学习算法分析历史数据和实时环境信息，智能调节空调、照明、供暖等设备运行状态，在保证师生舒适的前提下最大化节能减排效果。',
          tags: ['节能减排', '智能控制', 'IoT'],
          impact: '年节约能源成本30万元，碳排放减少25%'
        },
        {
          title: '智慧图书馆系统',
          description: 'RFID技术与AI推荐算法相结合的现代化图书馆服务系统，支持图书自助借还、智能导航、座位预约等功能。系统能够分析读者的借阅历史和学科偏好，智能推荐相关图书和学术资源。还提供学习空间管理、噪音监测、环境调节等服务，为师生打造舒适高效的学习环境。',
          tags: ['RFID', '智能推荐', '自助服务'],
          impact: '借阅量提升50%，管理人力成本降低40%'
        },
        {
          title: '校园一卡通升级系统',
          description: '集成身份认证、消费支付、门禁管理、图书借阅等多功能于一体的智能校园卡系统。支持手机NFC、二维码、刷脸等多种验证方式，师生可以便捷地在食堂、商店、图书馆等场所使用。系统还提供消费分析、余额提醒、挂失补办等贴心服务，让校园生活更加便利。',
          tags: ['一卡通', '移动支付', '多场景应用'],
          impact: '覆盖师生30000+，日交易量10000+笔'
        },
        {
          title: '智能教室管理平台',
          description: '为现代化教室配备的智能管理系统，支持设备远程控制、环境自动调节、使用状态监测等功能。教师可以通过手机APP预约教室、调节投影设备、控制灯光空调等。系统还能统计教室使用情况，优化资源配置，提高教室利用率。在疫情期间还增加了人员密度监测和通风提醒功能。',
          tags: ['智能教室', '设备管理', '资源优化'],
          impact: '教室利用率提升35%，设备故障率降低50%'
        },
        {
          title: '校园安全监控网络',
          description: '构建覆盖全校园的智能视频监控系统，采用高清摄像头和智能分析算法，实现24小时不间断安全监控。系统具备人员轨迹跟踪、异常行为识别、人群聚集预警等功能。在重要区域还部署了紧急报警设备，师生遇到危险时可一键求助。所有监控数据严格加密存储，保护师生隐私。',
          tags: ['视频监控', '智能分析', '应急报警'],
          impact: '校园治安事件下降80%，应急响应时间缩短60%'
        },
        {
          title: '学生健康管理系统',
          description: '集体检管理、健康档案、疾病预防于一体的学生健康服务平台。系统建立了完整的学生健康数据库，支持体检结果查询、疫苗接种提醒、传染病防控等功能。在疫情期间还增加了健康打卡、体温监测、接触者追踪等功能。通过大数据分析能够及早发现健康风险，保障师生身体健康。',
          tags: ['健康管理', '疾病防控', '数据分析'],
          impact: '覆盖学生25000+，传染病爆发率降低90%'
        },
        {
          title: '智慧食堂服务系统',
          description: '运用物联网和大数据技术优化校园餐饮服务的智能系统。学生可以通过手机APP查看菜品信息、营养成分、排队情况，提前点餐预约取餐时间。系统还能分析就餐数据，帮助食堂合理安排菜品供应，减少食物浪费。支持营养搭配建议、过敏源提醒等个性化服务，关爱师生饮食健康。',
          tags: ['智慧餐饮', '移动点餐', '营养管理'],
          impact: '就餐等待时间减少50%，食物浪费率降低30%'
        },
        {
          title: '校园物流配送网络',
          description: '为师生提供校园内快递收发和物品配送服务的智能物流系统。在宿舍楼、教学楼等关键位置设置智能快递柜，支持24小时自助取件。还提供校园内物品配送服务，如图书配送、生活用品配送等。通过优化配送路径和时间安排，提高配送效率，让师生享受更便捷的校园生活。',
          tags: ['智能物流', '快递管理', '配送服务'],
          impact: '日处理包裹5000+件，配送效率提升40%'
        },
        {
          title: '校园信息发布平台',
          description: '集成多种信息发布渠道的校园信息服务平台，支持通知公告、活动资讯、学术讲座等信息的统一发布和精准推送。师生可以根据兴趣和专业订阅相关信息，系统会智能推荐感兴趣的内容。还支持互动评论、活动报名、问卷调查等功能，促进校园信息交流和师生互动。',
          tags: ['信息发布', '精准推送', '互动交流'],
          impact: '信息到达率95%，师生参与度提升2倍'
        }
      ]
    },
    {
      id: 5,
      name: '绿色环保',
      icon: 'ri-leaf-line',
      color: 'from-lime-500 to-green-500',
      cases: [
        {
          title: '智能垃圾分类回收站',
          description: '集成AI图像识别技术的新一代垃圾分类设备，能够准确识别垃圾种类并自动分类投放。系统配备了多个分类投放口，支持可回收物、有害垃圾、厨余垃圾、其他垃圾等多种分类。通过积分奖励机制鼓励居民正确分类，积分可兑换生活用品或现金奖励。设备还具备满溢提醒、异味控制、数据统计等功能。',
          tags: ['图像识别', '垃圾分类', '积分激励'],
          impact: '垃圾分类准确率95%，居民参与度提升3倍'
        },
        {
          title: '碳足迹追踪小程序',
          description: '个人碳排放管理的移动应用，用户可以记录日常出行、用电、消费等活动产生的碳排放量。应用提供详细的碳排放计算器，涵盖交通、饮食、购物、居住等各个生活场景。系统会根据用户行为提供个性化的减排建议，如绿色出行、节能减排、循环利用等。还设有碳中和挑战活动，激励用户践行低碳生活。',
          tags: ['碳中和', '行为改变', '环保教育'],
          impact: '用户10万+，累计减排1000吨CO2'
        },
        {
          title: '水质监测预警系统',
          description: '基于物联网技术的环境水质实时监测网络，在河流、湖泊、水库等水体中部署多参数水质传感器，实时监测pH值、溶解氧、浊度、重金属含量等关键指标。系统运用AI算法分析水质变化趋势，能够提前预测污染事件的发生，及时向相关部门发出预警。还提供水质报告生成、历史数据查询等功能。',
          tags: ['IoT', '环境监测', '预警系统'],
          impact: '覆盖50个监测点，成功预警污染事件15次'
        },
        {
          title: '绿色建筑能效管理',
          description: '针对绿色建筑设计的综合能效管理系统，通过集成建筑内的各种传感器和智能设备，实时监控和优化建筑物的能源使用效率。系统能够智能调节照明、空调、通风等设备，根据室外环境和室内人员情况自动优化运行策略。还提供能耗分析报告，帮助物业管理方制定节能减排计划，实现建筑物的绿色可持续运营。',
          tags: ['绿色建筑', '能效管理', '智能调节'],
          impact: '建筑能耗降低40%，获得绿色建筑认证'
        },
        {
          title: '环保志愿活动平台',
          description: '连接环保组织、志愿者和公众的综合服务平台，发布各类环保志愿活动信息，如植树造林、海滩清洁、环保宣传等。用户可以根据兴趣和时间安排报名参与活动，平台提供活动签到、任务记录、成果展示等功能。通过积分和荣誉激励机制，鼓励更多人参与环保行动，形成全民环保的良好氛围。',
          tags: ['志愿服务', '环保行动', '社区参与'],
          impact: '组织活动500+场，参与志愿者20000+人次'
        },
        {
          title: '可再生能源监控平台',
          description: '为太阳能、风能等可再生能源设施提供的智能监控和管理系统。平台实时监测发电设备的运行状态、发电量、效率等关键指标，通过数据分析优化设备运行参数，提高发电效率。还提供设备维护提醒、故障诊断、收益分析等功能。用户可以通过手机APP查看自家光伏电站的实时发电情况和收益统计。',
          tags: ['可再生能源', '智能监控', '效率优化'],
          impact: '管理设备1000+套，发电效率提升20%'
        },
        {
          title: '空气质量改善系统',
          description: '针对室内外空气质量监测和改善的综合解决方案。系统部署高精度空气质量传感器，实时监测PM2.5、PM10、VOC、甲醛等污染物浓度。根据监测数据自动启动空气净化设备、新风系统等，保持空气质量在健康水平。还提供空气质量预报、污染源分析、健康建议等服务，帮助用户做好健康防护。',
          tags: ['空气质量', '实时监测', '自动净化'],
          impact: '室内空气质量优良率提升到95%'
        },
        {
          title: '循环经济产业链平台',
          description: '构建废料回收利用的循环经济生态系统，连接废料产生者、回收处理商、再生产品制造商等各环节参与者。平台提供废料分类指导、回收价格查询、物流配送、质量检测等全流程服务。通过建立信用评价体系和标准化流程，确保回收利用的质量和效率，推动循环经济发展，减少资源浪费。',
          tags: ['循环经济', '废料回收', '产业链整合'],
          impact: '年处理废料10万吨，资源利用率提升60%'
        },
        {
          title: '生态修复监测系统',
          description: '运用遥感技术和地面监测设备相结合的生态环境修复跟踪系统。通过卫星影像和无人机巡检，监测植被覆盖率、水体变化、土壤质量等生态指标的变化趋势。系统能够评估生态修复项目的实施效果，为后续的修复工作提供科学指导。还建立了生态数据库，为环境保护决策提供数据支撑。',
          tags: ['生态修复', '遥感监测', '效果评估'],
          impact: '监测面积1000平方公里，植被覆盖率提升30%'
        },
        {
          title: '环保教育游戏平台',
          description: '通过游戏化的方式普及环保知识和理念的在线教育平台。平台开发了多款寓教于乐的环保选题游戏，如垃圾分类挑战、节能减排模拟、生态保护策略等。用户在游戏过程中学习环保知识，培养环保意识，养成绿色生活习惯。还设有排行榜、成就系统、社区交流等功能，增强用户参与的趣味性和持续性。',
          tags: ['环保教育', '游戏化学习', '意识培养'],
          impact: '用户50万+，环保知识普及率提升80%'
        }
      ]
    },
    {
      id: 6,
      name: '文化旅游',
      icon: 'ri-map-pin-line',
      color: 'from-purple-500 to-violet-500',
      cases: [
        {
          title: 'AR文物复原导览',
          description: '结合增强现实技术和人工智能的文化遗产数字化展示系统，能够在游客面前复原古建筑的原始面貌、历史场景和文化活动。通过手机或AR眼镜，游客可以看到文物的三维模型、历史变迁过程，聆听AI生成的个性化语音讲解。系统还支持多语言服务和无障碍访问，为不同背景的游客提供沉浸式的文化体验。',
          tags: ['AR', '文化传承', '智能导览'],
          impact: '游客满意度98%，景区复购率提升45%'
        },
        {
          title: '智能旅游规划助手',
          description: '基于大数据和机器学习算法的个性化旅游服务平台，能够根据游客的兴趣偏好、时间安排、预算限制等因素，智能生成最优的旅游路线和行程安排。系统整合了交通、住宿、餐饮、景点等全方位信息，实时更新价格和可预订情况。还能根据天气变化、人流量等实时情况动态调整行程，确保最佳的旅游体验。',
          tags: ['智能推荐', '路线规划', '个性化'],
          impact: '用户50万+，行程满意度92%'
        },
        {
          title: '非遗文化数字化平台',
          description: '运用3D扫描、VR技术和区块链技术保护和传承非物质文化遗产的综合平台。通过高精度3D建模记录传统工艺的每个细节，VR技术让用户身临其境地学习传统技艺。平台连接非遗传承人与爱好者，提供在线教学、作品展示、技艺交流等服务。区块链技术确保非遗知识产权的保护和传承谱系的可追溯性。',
          tags: ['数字化', '非遗保护', 'VR'],
          impact: '数字化非遗项目100+，在线学习者5万+'
        },
        {
          title: '智慧景区管理系统',
          description: '面向景区运营管理的综合信息化平台，集成了客流监控、设施管理、应急指挥、营收分析等多项功能。系统通过部署在景区各处的传感器和摄像头，实时监测游客分布、设施状态、环境质量等信息。能够预测客流高峰，提前调配资源，优化游客体验。在紧急情况下，系统能够快速启动应急预案，保障游客安全。',
          tags: ['景区管理', '客流监控', '应急指挥'],
          impact: '管理效率提升50%，安全事故零发生'
        },
        {
          title: '文创产品设计平台',
          description: 'AI辅助的文化创意产品设计和生产平台，能够从文物、艺术品中提取设计元素，结合现代审美和实用需求，自动生成创新的文创产品设计方案。平台支持3D建模、效果预览、小批量定制生产等功能。还提供销售渠道对接，帮助文创设计师和文博机构将创意转化为商业价值，推动文化产业发展。',
          tags: ['AI设计', '文创开发', '定制生产'],
          impact: '设计产品1000+款，销售额突破200万'
        },
        {
          title: '智能民宿服务系统',
          description: '为民宿行业打造的智能化服务管理系统，支持在线预订、智能门锁、环境控制、设施监控等功能。客人可以通过手机APP完成入住、退房、设施控制等操作，享受无人化的便捷服务。系统还提供房态管理、收益分析、客户关系管理等功能，帮助民宿经营者提高服务质量和经营效率，打造特色住宿体验。',
          tags: ['智能民宿', '无人服务', '经营管理'],
          impact: '服务民宿500+家，入住满意度95%'
        },
        {
          title: '文化活动社交平台',
          description: '连接文化爱好者的社交网络平台，用户可以发现和参与各种文化活动，如艺术展览、音乐会、戏曲演出、文化讲座等。平台根据用户的兴趣偏好推荐相关活动，支持活动报名、座位选择、社交互动等功能。还提供活动创建工具，让文化机构和个人轻松组织和推广文化活动，促进文化交流和传播。',
          tags: ['文化社交', '活动推荐', '社区建设'],
          impact: '注册用户30万+，月活跃活动1000+场'
        },
        {
          title: '旅游安全保障系统',
          description: '基于大数据和物联网技术的旅游安全综合保障平台，实时监测景区、酒店、交通等各环节的安全状况。系统集成了天气预警、地质灾害监测、疫情防控、应急救援等多项功能。游客可以通过手机获取实时安全信息和应急指南，在遇到紧急情况时一键求助。平台还为旅游企业提供风险评估和安全管理服务。',
          tags: ['旅游安全', '风险监测', '应急救援'],
          impact: '保障游客100万+人次，应急响应时间缩短70%'
        },
        {
          title: '本地美食发现平台',
          description: '专注于挖掘和推广地方特色美食的移动应用，通过AI算法分析用户口味偏好和位置信息，推荐最符合需求的本地餐厅和特色菜品。平台整合了菜品介绍、营养信息、制作工艺、文化背景等详细内容，还支持在线点餐、外卖配送、厨艺学习等服务。通过美食连接文化，让游客深度体验当地风土人情。',
          tags: ['美食推荐', '文化体验', '在线服务'],
          impact: '覆盖餐厅5000+家，用户月活跃度85%'
        },
        {
          title: '智慧博物馆系统',
          description: '为博物馆量身定制的数字化服务平台，提供智能导览、藏品检索、互动体验、在线教育等综合服务。游客可以通过手机获得个性化的参观路线，了解文物背后的历史故事，参与虚拟考古、文物修复等互动体验。系统还支持线上虚拟参观，让无法到场的用户也能享受高质量的文化服务。',
          tags: ['数字博物馆', '智能导览', '在线教育'],
          impact: '服务博物馆50+家，线上参观量100万+人次'
        }
      ]
    }
  ];

  const [selectedCategory, setSelectedCategory] = useState(exampleCategories[0]);
  const [projectTheme, setProjectTheme] = useState({
    name: '',
    value: '',
    target: '',
    problem: '',
    solution: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // 字数验证函数
  const validateInput = (field: string, minLength: number) => {
    const value = projectTheme[field as keyof typeof projectTheme];
    return value.length >= minLength;
  };

  // 检查所有必填字段是否满足要求
  const canSubmit = () => {
    return (
      validateInput('name', 5) &&
      validateInput('value', 20) &&
      validateInput('target', 10) &&
      validateInput('problem', 50) &&
      validateInput('solution', 100)
    );
  };

  const handleConfirmTheme = () => {
    if (!canSubmit()) {
      alert('请确保所有字段都满足最小字数要求');
      return;
    }
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-3 cursor-pointer">
              <img src="https://public.readdy.ai/ai/img_res/a45fb981-255c-43bf-a2cd-2de142ce7a9c.png" alt="Logo" className="h-10 w-10 object-contain" />
              <span className="text-xl font-bold text-gray-900">嘉兴大学创业实训平台</span>
            </Link>
            <i className="ri-arrow-right-s-line text-gray-400"></i>
            <span className="text-sm text-gray-600">创新思维与创意生成</span>
          </div>
          <button className="px-5 py-2 bg-teal-500 text-white text-sm font-medium rounded-full hover:bg-teal-600 transition-colors whitespace-nowrap cursor-pointer">
            <i className="ri-question-line mr-2"></i>
            AI助手
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Page Title */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">创新思维与创意生成</h1>
          <p className="text-lg text-gray-600">运用结构化方法生成并筛选高质量创业点子</p>
        </div>

        {/* Tab Navigation - 调整顺序，实例库放在前面 */}
        <div className="mb-8 flex items-center gap-3">
          <button
            onClick={() => setActiveTab('examples')}
            className={`px-6 py-3 text-sm font-semibold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
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
            className={`px-6 py-3 text-sm font-semibold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
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
            className={`px-6 py-3 text-sm font-semibold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'confirm'
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg'
                : 'bg-white text-gray-700 border border-gray-200 hover:border-orange-300'
            }`}
          >
            <i className="ri-checkbox-circle-line mr-2"></i>
            确定项目选题
          </button>
        </div>

        {/* 实例库 Tab */}
        {activeTab === 'examples' && (
          <div className="grid lg:grid-cols-4 gap-6">
            {/* 左侧分类导航 */}
            <div className="lg:col-span-1">
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
            <div className="lg:col-span-3">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className={`w-12 h-12 bg-gradient-to-br ${selectedCategory.color} rounded-2xl flex items-center justify-center text-white`}>
                    <i className={`${selectedCategory.icon} text-2xl`}></i>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedCategory.name}</h2>
                    <p className="text-sm text-gray-500">参考以下成功案例，激发创新灵感</p>
                  </div>
                </div>

                <div className="space-y-6">
                  {selectedCategory.cases.map((caseItem, index) => (
                    <div key={index} className="border border-gray-200 rounded-xl p-6 hover:shadow-lg hover:border-teal-200 transition-all">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-gray-900 mb-2">{caseItem.title}</h3>
                          <p className="text-sm text-gray-600 leading-relaxed mb-4">{caseItem.description}</p>
                          <div className="flex items-center gap-2 mb-3">
                            {caseItem.tags.map((tag, i) => (
                              <span key={i} className="px-3 py-1 bg-teal-50 text-teal-700 text-xs font-medium rounded-full whitespace-nowrap">
                                {tag}
                              </span>
                            ))}
                          </div>
                          <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg p-3">
                            <i className="ri-trophy-line text-green-600 text-base mt-0.5"></i>
                            <div>
                              <p className="text-xs font-semibold text-green-800 mb-1">项目成果</p>
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
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left Sidebar */}
            <div className="lg:col-span-1 space-y-6">
              {/* Learning Resources */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <i className="ri-book-open-line text-teal-500"></i>
                  学习资源
                </h3>
                <div className="space-y-4">
                  {learningResources.map((resource, index) => (
                    <div key={index} className="border-b border-gray-100 last:border-0 pb-4 last:pb-0">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-gray-900 mb-1">{resource.title}</h4>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <i className={resource.type === '视频' ? 'ri-video-line' : 'ri-file-text-line'}></i>
                              {resource.type}
                            </span>
                            <span>{resource.duration}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-teal-500 rounded-full transition-all"
                            style={{ width: `${resource.progress}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-500 whitespace-nowrap">{resource.progress}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Team Discussion */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <i className="ri-chat-3-line text-orange-500"></i>
                  团队讨论
                </h3>
                <div className="space-y-3 mb-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 bg-teal-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                        张
                      </div>
                      <span className="text-xs font-medium text-gray-900">张明</span>
                      <span className="text-xs text-gray-500">2分钟前</span>
                    </div>
                    <p className="text-sm text-gray-700">我觉得校园配送机器人这个方向很有潜力</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                        李
                      </div>
                      <span className="text-xs font-medium text-gray-900">李娜</span>
                      <span className="text-xs text-gray-500">5分钟前</span>
                    </div>
                    <p className="text-sm text-gray-700">同意，我们可以先做市场调研</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="输入你的想法..."
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                  <button className="w-9 h-9 flex items-center justify-center bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors cursor-pointer">
                    <i className="ri-send-plane-fill"></i>
                  </button>
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* 版本控制工具栏 */}
              <VersionControl
                moduleName="创意库"
                currentVersion={ideasCurrentVersion}
                versions={ideasVersions}
                onSaveVersion={handleSaveIdeasVersion}
                onRestoreVersion={handleRestoreIdeasVersion}
              />

              {/* Innovation Methods */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">创新方法工具</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  <button
                    onClick={() => setActiveMethod('brainstorm')}
                    className={`px-4 py-3 text-sm font-medium rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                      activeMethod === 'brainstorm'
                        ? 'bg-gradient-to-br from-teal-500 to-cyan-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <i className="ri-lightbulb-flash-line mr-2"></i>
                    头脑风暴
                  </button>
                  <button
                    onClick={() => setActiveMethod('scamper')}
                    className={`px-4 py-3 text-sm font-medium rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                      activeMethod === 'scamper'
                        ? 'bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <i className="ri-compass-3-line mr-2"></i>
                    SCAMPER
                  </button>
                  <button
                    onClick={() => setActiveMethod('triz')}
                    className={`px-4 py-3 text-sm font-medium rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                      activeMethod === 'triz'
                        ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <i className="ri-puzzle-line mr-2"></i>
                    TRIZ
                  </button>
                  <button
                    onClick={() => setActiveMethod('ai')}
                    className={`px-4 py-3 text-sm font-medium rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                      activeMethod === 'ai'
                        ? 'bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <i className="ri-sparkling-line mr-2"></i>
                    AI创意
                  </button>
                </div>

                {activeMethod === 'brainstorm' && (
                  <div className="space-y-4">
                    <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
                      <h4 className="text-sm font-bold text-teal-900 mb-2">头脑风暴法</h4>
                      <p className="text-sm text-teal-700 mb-3">自由发散思维，不限制创意方向，鼓励大胆想象</p>
                      <ul className="text-sm text-teal-700 space-y-1">
                        <li>• 延迟判断，先发散后收敛</li>
                        <li>• 鼓励自由联想和组合</li>
                        <li>• 追求数量，不限质量</li>
                      </ul>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">创意标题</label>
                      <input
                        type="text"
                        placeholder="用一句话描述你的创意"
                        className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">创意描述</label>
                      <textarea
                        placeholder="详细描述你的创意，包括核心亮点和初步可行性分析"
                        rows={6}
                        className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                      />
                    </div>
                    <button className="w-full px-6 py-3 bg-teal-500 text-white text-sm font-medium rounded-xl hover:bg-teal-600 transition-colors whitespace-nowrap cursor-pointer">
                      <i className="ri-add-line mr-2"></i>
                      提交创意
                    </button>
                  </div>
                )}

                {activeMethod === 'scamper' && (
                  <div className="space-y-4">
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                      <h4 className="text-sm font-bold text-orange-900 mb-2">SCAMPER奔驰法</h4>
                      <p className="text-sm text-orange-700 mb-3">从7个维度改进现有产品或服务</p>
                      <div className="grid grid-cols-2 gap-2 text-sm text-orange-700">
                        <div>• S - 替代 (Substitute)</div>
                        <div>• C - 组合 (Combine)</div>
                        <div>• A - 调整 (Adapt)</div>
                        <div>• M - 修改 (Modify)</div>
                        <div>• P - 用途 (Put to other uses)</div>
                        <div>• E - 消除 (Eliminate)</div>
                        <div>• R - 重组 (Rearrange)</div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">选择改进维度</label>
                      <select className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent">
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
                      <label className="block text-sm font-medium text-gray-900 mb-2">创意描述</label>
                      <textarea
                        placeholder="基于选择的维度，描述你的创新想法"
                        rows={6}
                        className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                      />
                    </div>
                    <button className="w-full px-6 py-3 bg-orange-500 text-white text-sm font-medium rounded-xl hover:bg-orange-600 transition-colors whitespace-nowrap cursor-pointer">
                      <i className="ri-add-line mr-2"></i>
                      提交创意
                    </button>
                  </div>
                )}

                {activeMethod === 'triz' && (
                  <div className="space-y-4">
                    <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                      <h4 className="text-sm font-bold text-purple-900 mb-2">TRIZ创新原理</h4>
                      <p className="text-sm text-purple-700 mb-3">基于40个创新原理解决技术矛盾</p>
                      <p className="text-sm text-purple-700">识别问题中的矛盾，运用TRIZ原理找到创新解决方案</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">问题描述</label>
                      <textarea
                        placeholder="描述你想解决的问题或技术矛盾"
                        rows={4}
                        className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">解决方案</label>
                      <textarea
                        placeholder="运用TRIZ原理提出的解决方案"
                        rows={6}
                        className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                      />
                    </div>
                    <button className="w-full px-6 py-3 bg-purple-500 text-white text-sm font-medium rounded-xl hover:bg-purple-600 transition-colors whitespace-nowrap cursor-pointer">
                      <i className="ri-add-line mr-2"></i>
                      提交创意
                    </button>
                  </div>
                )}

                {activeMethod === 'ai' && (
                  <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <h4 className="text-sm font-bold text-blue-900 mb-2">AI智能创意生成</h4>
                      <p className="text-sm text-blue-700">基于市场趋势和用户需求，AI为你生成创新创意</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">目标领域</label>
                      <input
                        type="text"
                        placeholder="例如：教育科技、智慧校园、健康管理"
                        className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">目标用户</label>
                      <input
                        type="text"
                        placeholder="例如：大学生、上班族、老年人"
                        className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">核心需求</label>
                      <textarea
                        placeholder="描述目标用户的核心痛点和需求"
                        rows={4}
                        className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      />
                    </div>
                    <button className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm font-medium rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all whitespace-nowrap cursor-pointer">
                      <i className="ri-sparkling-line mr-2"></i>
                      AI生成创意
                    </button>
                  </div>
                )}
              </div>

              {/* Ideas List */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-gray-900">团队创意库</h3>
                  <button className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer">
                    <i className="ri-download-line mr-2"></i>
                    导出报告
                  </button>
                </div>
                <div className="space-y-4">
                  {ideas.map((idea) => (
                    <div key={idea.id} className="border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="text-base font-bold text-gray-900 mb-2">{idea.title}</h4>
                          <p className="text-sm text-gray-600 mb-3">{idea.description}</p>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <i className="ri-user-line"></i>
                              {idea.author}
                            </span>
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full whitespace-nowrap">
                              {idea.method}
                            </span>
                          </div>
                        </div>
                        <button className="px-4 py-2 bg-teal-50 text-teal-600 text-sm font-medium rounded-lg hover:bg-teal-100 transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer">
                          <i className="ri-thumb-up-line"></i>
                          {idea.votes}
                        </button>
                      </div>
                      <div className="flex items-center gap-6 pt-3 border-t border-gray-100">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600">新颖性</span>
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <i
                                key={star}
                                className={`ri-star-${star <= idea.novelty ? 'fill' : 'line'} text-amber-400 text-sm`}
                              ></i>
                            ))}
                          </div>
                          <span className="text-xs font-medium text-gray-900">{idea.novelty}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600">可行性</span>
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <i
                                key={star}
                                className={`ri-star-${star <= idea.feasibility ? 'fill' : 'line'} text-green-400 text-sm`}
                              ></i>
                            ))}
                          </div>
                          <span className="text-xs font-medium text-gray-900">{idea.feasibility}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 确定项目选题 Tab */}
        {activeTab === 'confirm' && (
          <div className="max-w-5xl mx-auto">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
              {/* 版本控制工具栏 */}
              <div className="mb-8">
                <VersionControl
                  moduleName="项目选题"
                  currentVersion={themeCurrentVersion}
                  versions={themeVersions}
                  onSaveVersion={handleSaveThemeVersion}
                  onRestoreVersion={handleRestoreThemeVersion}
                />
              </div>

              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl flex items-center justify-center text-white mx-auto mb-4">
                  <i className="ri-flag-line text-3xl"></i>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">确定项目选题</h2>
                <p className="text-sm text-gray-600">经过头脑风暴和实例参考，现在让我们确定最终的项目选题</p>
                <p className="text-xs text-amber-600 mt-2">注意：队长需要设置项目信息，请确保每个文本框都满足最小字数要求</p>
              </div>

              {/* 项目信息填写 - 添加字数要求和实时验证 */}
              <div className="space-y-6 mb-8">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    <i className="ri-bookmark-line text-orange-500 mr-1"></i>
                    项目名称 <span className="text-red-500">*</span>
                    <span className="text-xs text-gray-500 font-normal ml-2">
                      (至少5个字，当前：{projectTheme.name.length}字)
                    </span>
                  </label>
                  <input
                    type="text"
                    value={projectTheme.name}
                    onChange={(e) => setProjectTheme({ ...projectTheme, name: e.target.value })}
                    placeholder="为你的项目起一个响亮的名字"
                    className={`w-full px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                      projectTheme.name.length > 0 && !validateInput('name', 5) ? 'border-red-300 bg-red-50' : 'border-gray-200'
                    }`}
                  />
                  {projectTheme.name.length > 0 && !validateInput('name', 5) && (
                    <p className="text-xs text-red-500 mt-1">项目名称至少需要5个字</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    <i className="ri-star-line text-orange-500 mr-1"></i>
                    核心价值主张 <span className="text-red-500">*</span>
                    <span className="text-xs text-gray-500 font-normal ml-2">
                      (至少20个字，当前：{projectTheme.value.length}字)
                    </span>
                  </label>
                  <textarea
                    value={projectTheme.value}
                    onChange={(e) => setProjectTheme({ ...projectTheme, value: e.target.value })}
                    placeholder="用一句话说明你的项目为用户创造什么价值，例如：帮助大学生快速找到性价比最高的二手教材，节省50%购书成本"
                    rows={2}
                    className={`w-full px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none ${
                      projectTheme.value.length > 0 && !validateInput('value', 20) ? 'border-red-300 bg-red-50' : 'border-gray-200'
                    }`}
                  />
                  {projectTheme.value.length > 0 && !validateInput('value', 20) && (
                    <p className="text-xs text-red-500 mt-1">核心价值主张至少需要20个字</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    <i className="ri-user-heart-line text-orange-500 mr-1"></i>
                    目标用户 <span className="text-red-500">*</span>
                    <span className="text-xs text-gray-500 font-normal ml-2">
                      (至少10个字，当前：{projectTheme.target.length}字)
                    </span>
                  </label>
                  <input
                    type="text"
                    value={projectTheme.target}
                    onChange={(e) => setProjectTheme({ ...projectTheme, target: e.target.value })}
                    placeholder="详细描述目标用户群体，例如：在校大学生，特别是经济条件一般、注重性价比的本科生和研究生"
                    className={`w-full px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                      projectTheme.target.length > 0 && !validateInput('target', 10) ? 'border-red-300 bg-red-50' : 'border-gray-200'
                    }`}
                  />
                  {projectTheme.target.length > 0 && !validateInput('target', 10) && (
                    <p className="text-xs text-red-500 mt-1">目标用户描述至少需要10个字</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    <i className="ri-question-line text-orange-500 mr-1"></i>
                    解决的核心问题 <span className="text-red-500">*</span>
                    <span className="text-xs text-gray-500 font-normal ml-2">
                      (至少50个字，当前：{projectTheme.problem.length}字)
                    </span>
                  </label>
                  <textarea
                    value={projectTheme.problem}
                    onChange={(e) => setProjectTheme({ ...projectTheme, problem: e.target.value })}
                    placeholder="详细描述目标用户面临的核心痛点和问题，包括现状、影响、痛点严重程度等，例如：大学生每学期需要购买大量教材，新书价格昂贵，二手书市场信息不透明..."
                    rows={3}
                    className={`w-full px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none ${
                      projectTheme.problem.length > 0 && !validateInput('problem', 50) ? 'border-red-300 bg-red-50' : 'border-gray-200'
                    }`}
                  />
                  {projectTheme.problem.length > 0 && !validateInput('problem', 50) && (
                    <p className="text-xs text-red-500 mt-1">核心问题描述至少需要50个字</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    <i className="ri-lightbulb-line text-orange-500 mr-1"></i>
                    解决方案概述 <span className="text-red-500">*</span>
                    <span className="text-xs text-gray-500 font-normal ml-2">
                      (至少100个字，当前：{projectTheme.solution.length}字)
                    </span>
                  </label>
                  <textarea
                    value={projectTheme.solution}
                    onChange={(e) => setProjectTheme({ ...projectTheme, solution: e.target.value })}
                    placeholder="详细描述你的解决方案和核心功能，包括产品形态、主要功能、技术实现方式、商业模式、竞争优势等，例如：开发一个基于区块链的二手教材交易平台，提供教材真伪验证、价格透明化..."
                    rows={4}
                    className={`w-full px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none ${
                      projectTheme.solution.length > 0 && !validateInput('solution', 100) ? 'border-red-300 bg-red-50' : 'border-gray-200'
                    }`}
                  />
                  {projectTheme.solution.length > 0 && !validateInput('solution', 100) && (
                    <p className="text-xs text-red-500 mt-1">解决方案概述至少需要100个字</p>
                  )}
                </div>
              </div>

              {/* 提交按钮 */}
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={handleConfirmTheme}
                  disabled={isSubmitting || !canSubmit()}
                  className={`px-8 py-4 text-white text-base font-bold rounded-xl hover:shadow-lg transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
                    isSubmitting || !canSubmit() 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600'
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
                      确认项目选题
                    </>
                  )}
                </button>
              </div>
              
              {!canSubmit() && (
                <p className="text-center text-sm text-gray-500 mt-4">
                  请完成所有必填字段并满足字数要求后才能提交
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 成功提示 */}
      {showSuccess && (
        <div className="fixed bottom-8 right-8 bg-green-500 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-bounce z-50">
          <i className="ri-checkbox-circle-fill text-2xl"></i>
          <div>
            <p className="font-bold">项目选题已确认！</p>
            <p className="text-sm opacity-90">可以开始下一阶段的工作了</p>
          </div>
        </div>
      )}
    </div>
  );
}
