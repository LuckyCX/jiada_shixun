import { useState, useEffect } from 'react';
import VideoPlayer from './VideoPlayer';
import DocumentReader from './DocumentReader';
import NotesPanel from './NotesPanel';
import LearningQuiz from './LearningQuiz';
import LearningProgressBar from './LearningProgressBar';

interface Resource {
  id: string;
  type: 'video' | 'document' | 'case';
  title: string;
  duration?: string;
  pageCount?: number;
  size?: string;
  completed: boolean;
  description?: string;
}

interface LearningDetailProps {
  onBack: () => void;
}

// 从 localStorage 获取课件完成状态
const getResourceCompleted = (resourceId: string): boolean => {
  const key = `resource_completed_${resourceId}`;
  return localStorage.getItem(key) === 'true';
};

// 保存课件完成状态到 localStorage
const setResourceCompleted = (resourceId: string, completed: boolean) => {
  const key = `resource_completed_${resourceId}`;
  localStorage.setItem(key, completed ? 'true' : 'false');
};

// 计算小节整体完成度
const calculateSectionProgress = (resources: Resource[]): number => {
  if (resources.length === 0) return 0;
  const completedCount = resources.filter(r => getResourceCompleted(r.id)).length;
  return Math.round((completedCount / resources.length) * 100);
};

const resources: Resource[] = [
  {
    id: 'r1',
    type: 'video',
    title: '头脑风暴法理论讲解',
    duration: '15分钟',
    completed: false,
    description: '系统讲解头脑风暴法的起源、核心原则与实施步骤',
  },
  {
    id: 'r2',
    type: 'document',
    title: '头脑风暴实施指南',
    pageCount: 12,
    size: '2.3MB',
    completed: false,
    description: '详细的操作手册，包含常见误区与改进方案',
  },
  {
    id: 'r3',
    type: 'video',
    title: 'SCAMPER创新法进阶',
    duration: '20分钟',
    completed: false,
    description: '在头脑风暴基础上，结合SCAMPER七维度系统创新',
  },
  {
    id: 'r4',
    type: 'document',
    title: '创业创意筛选逻辑',
    pageCount: 8,
    size: '1.8MB',
    completed: false,
    description: '如何从大量创意中筛选出最具潜力的创业方向',
  },
  {
    id: 'r5',
    type: 'case',
    title: '案例：Airbnb的创意诞生',
    size: '1.5MB',
    completed: false,
    description: 'Airbnb如何通过头脑风暴发现共享住宿的商业机会',
  },
  {
    id: 'r6',
    type: 'case',
    title: '案例：校园外卖创业实践',
    size: '1.2MB',
    completed: false,
    description: '某高校团队如何运用创新方法打造校园配送服务',
  },
];

const caseData = [
  {
    id: 'c1',
    title: 'Airbnb：从充气床垫到千亿估值',
    industry: 'AI+共享经济',
    type: 'success',
    tags: ['头脑风暴', '用户洞察', '商业模式创新'],
    summary:
      '2008年，布莱恩·切斯基和乔·格比亚在旧金山公寓里，通过头脑风暴发现了"把空余房间出租给旅行者"的商业机会。他们用充气床垫和早餐招待了第一批客人，验证了需求后快速迭代，最终创建了Airbnb。',
    keyPoints: [
      '从自身痛点出发发现商机',
      '快速低成本验证假设',
      '用户反馈驱动产品迭代',
    ],
    abilityPoints: ['创新思维', '用户洞察'],
    image:
      'https://readdy.ai/api/search-image?query=modern%20cozy%20apartment%20interior%20design%20airbnb%20style%20living%20room%20warm%20lighting%20minimalist%20furniture%20clean%20aesthetic&width=400&height=240&seq=case001&orientation=landscape',
    fullContent: '2008年，布莱恩·切斯基和乔·格比亚在旧金山公寓里，通过头脑风暴发现了"把空余房间出租给旅行者"的商业机会。当时正值经济危机，两人付不起房租，突发奇想：为什么不把家里的空余房间出租给参加设计大会的旅行者？他们买了三张充气床垫，提供早餐服务，成功招待了第一批客人。这次小规模实验验证了市场需求的真实性。随后，他们快速迭代产品，从最初的"充气床垫+早餐"模式，逐步演变为全球性的短租平台。Airbnb的成功证明了头脑风暴法的核心价值：从自身痛点出发，快速低成本验证假设，用户反馈驱动产品迭代。',
    relatedKnowledge: ['头脑风暴法核心原则', '延迟判断原则', '快速验证方法', '用户反馈机制'],
  },
  {
    id: 'c2',
    title: '某高校校园外卖：15分钟极速配送',
    industry: 'AI+校园服务',
    type: 'success',
    tags: ['SCAMPER法', '市场调研', '团队协作'],
    summary:
      '某高校创业团队通过SCAMPER法对传统外卖模式进行创新，发现校园内"最后100米"配送痛点，提出"15分钟极速配送+社交拼单"模式，在校园市场快速占据领先地位。',
    keyPoints: [
      '运用SCAMPER系统化创新',
      '精准定位细分市场',
      '社交裂变降低获客成本',
    ],
    abilityPoints: ['创新思维', '商业思维'],
    image:
      'https://readdy.ai/api/search-image?query=university%20campus%20food%20delivery%20service%20students%20ordering%20food%20mobile%20app%20startup%20entrepreneurship%20modern&width=400&height=240&seq=case002&orientation=landscape',
    fullContent: '某高校创业团队在校园内发现传统外卖平台存在"最后100米"配送痛点：外卖员无法进入宿舍楼，学生需要下楼取餐，雨雪天气尤其不便。团队运用SCAMPER创新法进行系统化思考：Substitute（替代）- 用学生兼职配送员替代专业外卖员；Combine（组合）- 将外卖配送与社交拼单结合；Adapt（调整）- 调整配送范围，专注校园内部；Modify（修改）- 修改配送时间承诺为15分钟；Put to other uses（其他用途）- 配送员同时提供代取快递服务；Eliminate（消除）- 消除配送费；Rearrange（重组）- 重组配送路线，按宿舍楼分区。最终，团队推出"15分钟极速配送+社交拼单"模式，在校园市场快速占据领先地位，月订单量突破10万单。',
    relatedKnowledge: ['SCAMPER创新法', '市场细分策略', '用户痛点分析', '社交裂变营销'],
  },
  {
    id: 'c3',
    title: '某AI养老平台：从失败中学习',
    industry: 'AI+智慧养老',
    type: 'failure',
    tags: ['失败复盘', '用户调研', '商业模式'],
    summary:
      '某团队开发AI养老陪伴产品，初期因忽视老年用户的真实使用习惯，产品功能过于复杂，导致用户留存率极低。经过深度用户调研和三轮迭代，最终简化交互，聚焦语音陪伴功能，实现转型成功。',
    keyPoints: [
      '用户调研不能走过场',
      '产品功能要聚焦核心痛点',
      '失败是迭代的起点',
    ],
    abilityPoints: ['用户洞察', '产品设计'],
    image:
      'https://readdy.ai/api/search-image?query=elderly%20care%20technology%20AI%20smart%20home%20senior%20citizen%20using%20tablet%20voice%20assistant%20warm%20caring%20environment&width=400&height=240&seq=case003&orientation=landscape',
    fullContent: '某团队开发AI养老陪伴产品，初期设计了20多个功能：健康监测、用药提醒、视频通话、新闻播报、天气查询、智能家居控制等。团队认为功能越多越好，但产品上线后，用户留存率仅有5%。深度用户调研发现：老年用户不会使用复杂的触屏操作，记不住那么多功能入口，最核心的需求其实是"有人说话、不孤独"。团队痛定思痛，进行三轮迭代：第一轮，砍掉15个次要功能，只保留语音陪伴、健康监测、紧急呼叫3个核心功能；第二轮，将所有操作改为语音交互，老人只需说"小爱，陪我聊天"即可启动；第三轮，优化AI对话能力，让AI能够理解方言、记住老人的生活习惯。经过三轮迭代，用户留存率提升至65%，月活用户突破10万。这个案例证明：用户调研不能走过场，产品功能要聚焦核心痛点，失败是迭代的起点。',
    relatedKnowledge: ['用户调研方法', '产品迭代策略', '核心功能定位', '失败复盘机制'],
  },
  {
    id: 'c4',
    title: '滴滴出行：从出租车到共享出行',
    industry: 'AI+出行服务',
    type: 'success',
    tags: ['商业模式创新', '市场调研', '快速迭代'],
    summary:
      '滴滴出行通过深度市场调研，发现打车难、打车贵的痛点，运用互联网思维重构出行市场，从出租车叫车平台逐步演变为共享出行生态，成为中国最大的出行平台。',
    keyPoints: [
      '深度洞察用户痛点',
      '互联网思维重构传统行业',
      '快速迭代优化用户体验',
    ],
    abilityPoints: ['商业思维', '市场洞察'],
    image:
      'https://readdy.ai/api/search-image?query=modern%20ride%20sharing%20app%20mobile%20phone%20city%20transportation%20urban%20lifestyle%20digital%20innovation&width=400&height=240&seq=case004&orientation=landscape',
    fullContent: '2012年，程维在北京打车难的痛苦经历中发现商机。他通过深度市场调研发现：北京有6.7万辆出租车，但高峰期打车成功率不到30%；出租车司机空驶率高达40%，供需严重不匹配。滴滴出行的创新在于：用互联网思维重构出行市场，通过算法匹配供需双方，提高效率。从最初的出租车叫车平台，到快车、专车、顺风车、代驾等多元化服务，滴滴不断快速迭代，优化用户体验。2014年，滴滴与快的合并，占据市场主导地位。2016年，滴滴收购Uber中国，成为中国最大的出行平台。滴滴的成功证明：深度洞察用户痛点，用互联网思维重构传统行业，快速迭代优化用户体验，是创业成功的关键。',
    relatedKnowledge: ['市场调研方法', '商业模式创新', '互联网思维', '快速迭代策略'],
  },
  {
    id: 'c5',
    title: '某智能硬件创业：供应链管理失误导致失败',
    industry: 'AI+智能硬件',
    type: 'failure',
    tags: ['失败复盘', '供应链管理', '成本控制'],
    summary:
      '某团队开发智能手环产品，产品设计优秀，市场反响良好，但因供应链管理失误，导致成本失控、交付延期，最终资金链断裂，项目失败。',
    keyPoints: [
      '供应链管理是硬件创业的生命线',
      '成本控制要贯穿全流程',
      '现金流管理至关重要',
    ],
    abilityPoints: ['风险管理', '成本控制'],
    image:
      'https://readdy.ai/api/search-image?query=smart%20wearable%20device%20fitness%20tracker%20technology%20product%20design%20modern%20minimalist%20style&width=400&height=240&seq=case005&orientation=landscape',
    fullContent: '某团队开发智能手环产品，产品设计优秀，众筹阶段获得500万元资金，市场反响良好。但团队在供应链管理上犯了致命错误：①选择了价格最低的供应商，忽视了质量风险；②没有备用供应商，供应链单一；③低估了生产周期，承诺3个月交付，实际需要6个月；④没有预留足够的质量检测时间，首批产品不良率高达30%；⑤为了赶工期，支付了大量加急费用，成本失控。最终，产品延期3个月交付，成本超支200%，大量用户要求退款，团队资金链断裂，项目失败。这个案例警示：供应链管理是硬件创业的生命线，成本控制要贯穿全流程，现金流管理至关重要。创业团队在追求产品创新的同时，必须重视供应链管理、成本控制、风险预案。',
    relatedKnowledge: ['供应链管理', '成本控制方法', '风险管理', '现金流管理'],
  },
  {
    id: 'c6',
    title: '美团外卖：从团购到本地生活服务',
    industry: 'AI+本地生活',
    type: 'success',
    tags: ['商业模式转型', '市场拓展', '团队协作'],
    summary:
      '美团从团购起家，通过敏锐的市场洞察，成功转型外卖业务，运用"高频打低频"策略，逐步构建本地生活服务生态，成为中国最大的本地生活服务平台。',
    keyPoints: [
      '敏锐的市场洞察能力',
      '高频打低频的战略思维',
      '构建生态闭环',
    ],
    abilityPoints: ['商业思维', '战略规划'],
    image:
      'https://readdy.ai/api/search-image?query=food%20delivery%20service%20mobile%20app%20restaurant%20ordering%20urban%20lifestyle%20modern%20technology%20digital%20platform&width=400&height=240&seq=case006&orientation=landscape',
    fullContent: '美团从2010年的团购起家，经历了"千团大战"的残酷竞争。2013年，王兴敏锐地发现：团购是低频消费（每月1-2次），外卖是高频消费（每周3-5次），高频业务能够带来更高的用户粘性和商业价值。美团果断进军外卖市场，运用"高频打低频"策略，用外卖业务带动团购、酒店、旅游等低频业务。美团的成功在于：①敏锐的市场洞察，提前布局高频业务；②强大的地推团队，快速占领市场；③技术驱动，优化配送效率；④构建生态闭环，从外卖延伸到酒店、旅游、出行等本地生活服务。2018年，美团在香港上市，成为中国最大的本地生活服务平台。美团的案例证明：敏锐的市场洞察能力、高频打低频的战略思维、构建生态闭环，是创业成功的关键。',
    relatedKnowledge: ['商业模式转型', '市场拓展策略', '高频打低频', '生态闭环构建'],
  },
];

export default function LearningDetail({ onBack }: LearningDetailProps) {
  const [activeTab, setActiveTab] = useState<'video' | 'document' | 'case' | 'quiz'>('video');
  const [selectedResource, setSelectedResource] = useState<Resource>(resources[0]);
  const [videoProgress, setVideoProgress] = useState(0);
  const [docProgress, setDocProgress] = useState(0);
  const [quizPassed, setQuizPassed] = useState(false);
  const [studyMinutes, setStudyMinutes] = useState(28);
  const [completedResources, setCompletedResources] = useState<Set<string>>(new Set());
  const [expandedCase, setExpandedCase] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [caseFilter, setCaseFilter] = useState<'all' | 'success' | 'failure'>('all');
  const [industryFilter, setIndustryFilter] = useState<string>('all');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [bookmarkedCases, setBookmarkedCases] = useState<Set<string>>(new Set());
  const [sectionProgress, setSectionProgress] = useState(0);

  // 初始化：从 localStorage 加载已完成的课件
  useEffect(() => {
    const completed = new Set<string>();
    resources.forEach(r => {
      if (getResourceCompleted(r.id)) {
        completed.add(r.id);
      }
    });
    setCompletedResources(completed);
    setSectionProgress(calculateSectionProgress(resources));
  }, []);

  // 更新小节整体进度
  useEffect(() => {
    setSectionProgress(calculateSectionProgress(resources));
  }, [completedResources]);

  const handleVideoProgress = (percent: number) => {
    setVideoProgress(percent);
    if (percent > 0 && percent % 10 === 0) {
      setStudyMinutes((prev) => prev + 1);
      showSavedToast();
    }
  };

  const handleVideoComplete = () => {
    setCompletedResources((prev) => {
      const newSet = new Set([...prev, selectedResource.id]);
      setResourceCompleted(selectedResource.id, true);
      return newSet;
    });
    setVideoProgress(100);
    showSavedToast();
  };

  const handleDocProgress = (percent: number) => {
    setDocProgress(percent);
    showSavedToast();
  };

  const handleDocComplete = () => {
    setCompletedResources((prev) => {
      const newSet = new Set([...prev, selectedResource.id]);
      setResourceCompleted(selectedResource.id, true);
      return newSet;
    });
    setDocProgress(100);
    showSavedToast();
  };

  const showSavedToast = () => {
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2500);
  };

  const handleBookmarkCase = (caseId: string) => {
    setBookmarkedCases((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(caseId)) {
        newSet.delete(caseId);
      } else {
        newSet.add(caseId);
      }
      return newSet;
    });
    showSavedToast();
  };

  const filteredCases = caseData.filter((c) => {
    const matchType = caseFilter === 'all' || c.type === caseFilter;
    const matchIndustry = industryFilter === 'all' || c.industry === industryFilter;
    const matchKeyword =
      searchKeyword === '' ||
      c.title.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      c.summary.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      c.tags.some((tag) => tag.toLowerCase().includes(searchKeyword.toLowerCase()));
    return matchType && matchIndustry && matchKeyword;
  });

  const industries = ['all', ...Array.from(new Set(caseData.map((c) => c.industry)))];

  const getResourceIcon = (type: string) => {
    switch (type) {
      case 'video':
        return 'ri-play-circle-line';
      case 'document':
        return 'ri-file-text-line';
      case 'case':
        return 'ri-lightbulb-line';
      default:
        return 'ri-file-line';
    }
  };

  const getResourceColor = (type: string) => {
    switch (type) {
      case 'video':
        return 'text-teal-600 bg-teal-50';
      case 'document':
        return 'text-amber-600 bg-amber-50';
      case 'case':
        return 'text-purple-600 bg-purple-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const tabList = [
    {
      id: 'video',
      label: '视频讲解',
      icon: 'ri-play-circle-line',
      count: resources.filter((r) => r.type === 'video').length,
    },
    {
      id: 'document',
      label: '文档资料',
      icon: 'ri-file-text-line',
      count: resources.filter((r) => r.type === 'document').length,
    },
    { id: 'case', label: '案例库', icon: 'ri-lightbulb-line', count: caseData.length },
    { id: 'quiz', label: '学习检测', icon: 'ri-edit-box-line', count: null },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/30">
      {/* 顶部导航 */}
      <nav className="bg-white/90 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-screen-xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              className="flex items-center space-x-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-all whitespace-nowrap"
            >
              <i className="ri-arrow-left-line"></i>
              <span>返回知识库</span>
            </button>
            <div className="h-5 w-px bg-gray-300"></div>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <i className="ri-brain-line text-white text-sm"></i>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">头脑风暴法</p>
                <p className="text-xs text-gray-500">创新思维与创新方法 · 知识点学习</p>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {/* 专注模式 */}
            <button
              onClick={() => setFocusMode(!focusMode)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                focusMode ? 'bg-teal-500 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              <i className={`${focusMode ? 'ri-focus-3-line' : 'ri-focus-2-line'}`}></i>
              <span>{focusMode ? '退出专注' : '专注模式'}</span>
            </button>
            {/* 小节整体进度 */}
            <div className="flex items-center space-x-2 bg-teal-50 px-4 py-2 rounded-xl">
              <span className="text-xs text-gray-600">小节完成度</span>
              <div className="w-20 h-1.5 bg-teal-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full transition-all duration-500"
                  style={{ width: `${sectionProgress}%` }}
                ></div>
              </div>
              <span className="text-xs font-bold text-teal-600">{sectionProgress}%</span>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-screen-xl mx-auto px-6 py-6">
        <div className={`flex gap-6 ${focusMode ? '' : ''}`}>
          {/* 左侧课件列表侧边栏 */}
          {!focusMode && (
            <div className="w-80 flex-shrink-0 space-y-5">
              {/* 课件列表 */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center">
                  <i className="ri-folder-open-line text-teal-600 mr-2"></i>
                  本小节课件列表
                </h3>
                <div className="space-y-2">
                  {resources.map((res) => {
                    const isCompleted = completedResources.has(res.id);
                    const isActive = selectedResource.id === res.id;
                    return (
                      <div
                        key={res.id}
                        onClick={() => {
                          setSelectedResource(res);
                          if (res.type === 'video') setActiveTab('video');
                          else if (res.type === 'document') setActiveTab('document');
                          else setActiveTab('case');
                        }}
                        className={`flex items-center space-x-3 p-3 rounded-xl cursor-pointer transition-all ${
                          isActive
                            ? 'bg-teal-50 border-2 border-teal-400'
                            : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                        }`}
                      >
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            isCompleted ? 'bg-green-100' : getResourceColor(res.type)
                          }`}
                        >
                          {isCompleted ? (
                            <i className="ri-checkbox-circle-fill text-green-600 text-lg"></i>
                          ) : (
                            <i className={`${getResourceIcon(res.type)} text-lg`}></i>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-900 truncate">{res.title}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {res.duration || res.size || `${res.pageCount}页`}
                          </p>
                        </div>
                        {isCompleted && (
                          <i className="ri-check-line text-green-600 text-base flex-shrink-0"></i>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                {/* 小节进度统计 */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500">小节完成度</span>
                    <span className="text-xs font-bold text-teal-600">{sectionProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full transition-all duration-500"
                      style={{ width: `${sectionProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    已完成 {completedResources.size}/{resources.length} 个课件
                  </p>
                </div>
              </div>

              {/* 学习进度追踪 */}
              <LearningProgressBar
                videoProgress={videoProgress}
                docProgress={docProgress}
                quizPassed={quizPassed}
                studyMinutes={studyMinutes}
              />
            </div>
          )}

          {/* 中间主学习区 */}
          <div className={`flex-1 min-w-0 space-y-5 transition-all duration-300 ${focusMode ? 'w-full' : ''}`}>
            {/* 资源类型标签 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-1.5 flex space-x-1">
              {tabList.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-md'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <i className={tab.icon}></i>
                  <span>{tab.label}</span>
                  {tab.count !== null && (
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full ${
                        activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                  {tab.id === 'quiz' && quizPassed && (
                    <i className="ri-checkbox-circle-fill text-green-400 text-sm"></i>
                  )}
                </button>
              ))}
            </div>

            {/* 视频区域 */}
            {activeTab === 'video' && (
              <div className="space-y-5">
                {/* 视频播放器 */}
                <VideoPlayer
                  title={
                    selectedResource.type === 'video'
                      ? selectedResource.title
                      : resources.find((r) => r.type === 'video')!.title
                  }
                  duration={selectedResource.duration || '15分钟'}
                  resourceId={selectedResource.type === 'video' ? selectedResource.id : resources.find((r) => r.type === 'video')!.id}
                  onProgress={handleVideoProgress}
                  onComplete={handleVideoComplete}
                />

                {/* 视频列表 */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                  <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center">
                    <i className="ri-play-list-line text-teal-600 mr-2"></i>
                    视频资源列表
                  </h3>
                  <div className="space-y-3">
                    {resources
                      .filter((r) => r.type === 'video')
                      .map((res) => (
                        <div
                          key={res.id}
                          onClick={() => setSelectedResource(res)}
                          className={`flex items-center space-x-4 p-4 rounded-xl cursor-pointer transition-all ${
                            selectedResource.id === res.id
                              ? 'bg-teal-50 border-2 border-teal-400'
                              : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                          }`}
                        >
                          <div
                            className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                              completedResources.has(res.id) ? 'bg-green-100' : 'bg-teal-100'
                            }`}
                          >
                            {completedResources.has(res.id) ? (
                              <i className="ri-checkbox-circle-fill text-green-600 text-xl"></i>
                            ) : (
                              <i className="ri-play-circle-line text-teal-600 text-xl"></i>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{res.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{res.description}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
                              {res.duration}
                            </span>
                            {completedResources.has(res.id) && (
                              <p className="text-xs text-green-600 mt-1 font-medium">已完成</p>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* 知识点简介 */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                  <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center">
                    <i className="ri-information-line text-teal-600 mr-2"></i>
                    知识点简介
                  </h3>
                  <p className="text-sm text-gray-700 leading-relaxed mb-4">
                    头脑风暴法（Brainstorming）是一种通过集体讨论激发创意的思维方法，由美国创意思维专家亚历克斯·奥斯本于1939年首次提出。其核心是
                    "延迟判断"原则——在创意生成阶段禁止批评，以数量带动质量。
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {['延迟判断', '自由联想', '数量优先', '借鉴组合', '团队协作'].map((tag) => (
                      <span
                        key={tag}
                        className="px-3 py-1 bg-teal-50 text-teal-700 rounded-full text-xs font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-100 flex items-center space-x-4">
                    <div className="flex items-center space-x-1 text-xs text-gray-500">
                      <i className="ri-medal-line text-purple-500"></i>
                      <span>完成后获得：</span>
                    </div>
                    {['创新思维 +1', '团队协作 +1'].map((ap) => (
                      <span
                        key={ap}
                        className="px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full text-xs font-medium shadow-sm"
                      >
                        {ap}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 文档区域 */}
            {activeTab === 'document' && (
              <div className="space-y-5">
                <DocumentReader
                  title={
                    selectedResource.type === 'document'
                      ? selectedResource.title
                      : '头脑风暴实施指南'
                  }
                  pageCount={selectedResource.pageCount || 12}
                  resourceId={selectedResource.type === 'document' ? selectedResource.id : resources.find((r) => r.type === 'document')!.id}
                  onProgress={handleDocProgress}
                  onComplete={handleDocComplete}
                />

                {/* 文档列表 */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                  <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center">
                    <i className="ri-folder-open-line text-amber-600 mr-2"></i>
                    文档资源列表
                  </h3>
                  <div className="space-y-3">
                    {resources
                      .filter((r) => r.type === 'document')
                      .map((res) => (
                        <div
                          key={res.id}
                          onClick={() => setSelectedResource(res)}
                          className={`flex items-center space-x-4 p-4 rounded-xl cursor-pointer transition-all ${
                            selectedResource.id === res.id
                              ? 'bg-amber-50 border-2 border-amber-400'
                              : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                          }`}
                        >
                          <div
                            className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                              completedResources.has(res.id) ? 'bg-green-100' : 'bg-amber-100'
                            }`}
                          >
                            {completedResources.has(res.id) ? (
                              <i className="ri-checkbox-circle-fill text-green-600 text-xl"></i>
                            ) : (
                              <i className="ri-file-text-line text-amber-600 text-xl"></i>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{res.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{res.description}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
                              {res.pageCount} 页
                            </span>
                            {completedResources.has(res.id) && (
                              <p className="text-xs text-green-600 mt-1 font-medium">已完成</p>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {/* 案例库 - 保持原有代码 */}
            {activeTab === 'case' && (
              <div className="space-y-5">
                {/* 案例库头部 */}
                <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold mb-1">创业案例库</h3>
                      <p className="text-purple-100 text-sm">
                        学习真实案例，借鉴成功经验，汲取失败教训
                      </p>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold">
                          {caseData.filter((c) => c.type === 'success').length}
                        </div>
                        <div className="text-xs text-purple-200">成功案例</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold">
                          {caseData.filter((c) => c.type === 'failure').length}
                        </div>
                        <div className="text-xs text-purple-200">失败复盘</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold">{bookmarkedCases.size}</div>
                        <div className="text-xs text-purple-200">已收藏</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 筛选与搜索 */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                  <div className="flex items-center space-x-4 mb-4">
                    {/* 类型筛选 */}
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-semibold text-gray-700">类型：</span>
                      <div className="flex space-x-2">
                        {[
                          { value: 'all', label: '全部', icon: 'ri-list-check' },
                          { value: 'success', label: '成功案例', icon: 'ri-checkbox-circle-line' },
                          { value: 'failure', label: '失败复盘', icon: 'ri-error-warning-line' },
                        ].map((type) => (
                          <button
                            key={type.value}
                            onClick={() => setCaseFilter(type.value as typeof caseFilter)}
                            className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                              caseFilter === type.value
                                ? 'bg-teal-500 text-white shadow-md'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            <i className={type.icon}></i>
                            <span>{type.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 行业筛选 */}
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-semibold text-gray-700">行业：</span>
                      <select
                        value={industryFilter}
                        onChange={(e) => setIndustryFilter(e.target.value)}
                        className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium border-none focus:outline-none focus:ring-2 focus:ring-teal-400 cursor-pointer"
                      >
                        {industries.map((ind) => (
                          <option key={ind} value={ind}>
                            {ind === 'all' ? '全部行业' : ind}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 搜索框 */}
                  <div className="relative">
                    <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                    <input
                      type="text"
                      value={searchKeyword}
                      onChange={(e) => setSearchKeyword(e.target.value)}
                      placeholder="搜索案例标题、标签、内容..."
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:bg-white transition-all"
                    />
                    {searchKeyword && (
                      <button
                        onClick={() => setSearchKeyword('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <i className="ri-close-circle-fill"></i>
                      </button>
                    )}
                  </div>

                  {/* 筛选结果统计 */}
                  <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                    <span>
                      找到 <span className="font-bold text-teal-600">{filteredCases.length}</span> 个案例
                    </span>
                    {(caseFilter !== 'all' || industryFilter !== 'all' || searchKeyword) && (
                      <button
                        onClick={() => {
                          setCaseFilter('all');
                          setIndustryFilter('all');
                          setSearchKeyword('');
                        }}
                        className="text-teal-600 hover:text-teal-700 font-medium"
                      >
                        清除筛选
                      </button>
                    )}
                  </div>
                </div>

                {/* 案例列表 */}
                {filteredCases.length === 0 ? (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <i className="ri-search-line text-3xl text-gray-400"></i>
                    </div>
                    <p className="text-gray-500 text-sm">未找到符合条件的案例</p>
                    <button
                      onClick={() => {
                        setCaseFilter('all');
                        setIndustryFilter('all');
                        setSearchKeyword('');
                      }}
                      className="mt-4 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white text-sm rounded-lg transition-all whitespace-nowrap"
                    >
                      查看全部案例
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredCases.map((c) => (
                      <div
                        key={c.id}
                        className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition-all"
                      >
                        <div className="flex">
                          {/* 案例图片 */}
                          <div className="w-48 flex-shrink-0">
                            <img
                              src={c.image}
                              alt={c.title}
                              className="w-full h-full object-cover object-top"
                              style={{ minHeight: '160px' }}
                            />
                          </div>
                          {/* 案例内容 */}
                          <div className="flex-1 p-5">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <div className="flex items-center space-x-2 mb-1">
                                  <span
                                    className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                                      c.type === 'success'
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-red-100 text-red-700'
                                    }`}
                                  >
                                    {c.type === 'success' ? '✓ 成功案例' : '⚠ 失败复盘'}
                                  </span>
                                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-md text-xs font-medium">
                                    {c.industry}
                                  </span>
                                </div>
                                <h4 className="text-base font-bold text-gray-900">{c.title}</h4>
                              </div>
                              <button
                                onClick={() => handleBookmarkCase(c.id)}
                                className={`flex items-center space-x-1 text-teal-600 hover:text-teal-700 text-sm font-medium transition-colors whitespace-nowrap ${
                                  bookmarkedCases.has(c.id)
                                    ? 'bg-amber-100 text-amber-600'
                                    : 'bg-gray-100 text-gray-400 hover:bg-amber-50'
                                }`}
                              >
                                <i
                                  className={`${
                                    bookmarkedCases.has(c.id) ? 'ri-bookmark-fill' : 'ri-bookmark-line'
                                  }`}
                                ></i>
                                <span>{bookmarkedCases.has(c.id) ? '已收藏' : '收藏案例'}</span>
                              </button>
                            </div>
                            <p className="text-sm text-gray-600 leading-relaxed mb-3 line-clamp-2">
                              {c.summary}
                            </p>
                            <div className="flex flex-wrap gap-1.5 mb-3">
                              {c.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md text-xs"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                {c.abilityPoints.map((ap) => (
                                  <span
                                    key={ap}
                                    className="px-2 py-0.5 bg-teal-50 text-teal-700 rounded-md text-xs font-medium"
                                  >
                                    <i className="ri-medal-line mr-1"></i>
                                    {ap}
                                  </span>
                                ))}
                              </div>
                              <button
                                onClick={() => setExpandedCase(expandedCase === c.id ? null : c.id)}
                                className="flex items-center space-x-1 text-teal-600 hover:text-teal-700 text-sm font-medium transition-colors whitespace-nowrap"
                              >
                                <span>{expandedCase === c.id ? '收起' : '查看详情'}</span>
                                <i
                                  className={`${
                                    expandedCase === c.id ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'
                                  }`}
                                ></i>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* 展开详情 */}
                        {expandedCase === c.id && (
                          <div className="border-t border-gray-100 p-5 bg-gray-50">
                            {/* 核心知识点关联 */}
                            <h5 className="text-sm font-bold text-gray-900 mb-3 flex items-center">
                              <i className="ri-key-line text-teal-600 mr-2"></i>
                              核心知识点关联
                            </h5>
                            <div className="grid grid-cols-3 gap-3 mb-4">
                              {c.keyPoints.map((kp, idx) => (
                                <div key={idx} className="bg-white rounded-xl p-3 border border-gray-200">
                                  <div className="w-6 h-6 bg-teal-100 rounded-full flex items-center justify-center mb-2">
                                    <span className="text-xs font-bold text-teal-600">{idx + 1}</span>
                                  </div>
                                  <p className="text-xs text-gray-700 leading-relaxed">{kp}</p>
                                </div>
                              ))}
                            </div>

                            {/* 案例全文 */}
                            <div className="bg-white rounded-xl p-4 border border-gray-200 mb-4">
                              <p className="text-sm font-semibold text-gray-900 mb-2 flex items-center">
                                <i className="ri-file-text-line text-purple-600 mr-2"></i>
                                案例全文
                              </p>
                              <p className="text-sm text-gray-700 leading-relaxed">{c.fullContent}</p>
                            </div>

                            {/* 相关知识点 */}
                            <div className="bg-white rounded-xl p-4 border border-gray-200 mb-4">
                              <p className="text-sm font-semibold text-gray-900 mb-2 flex items-center">
                                <i className="ri-links-line text-teal-600 mr-2"></i>
                                相关知识点
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {c.relatedKnowledge.map((rk) => (
                                  <span
                                    key={rk}
                                    className="px-3 py-1 bg-teal-50 text-teal-700 rounded-lg text-xs font-medium"
                                  >
                                    {rk}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* 操作按钮 */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <button
                                  onClick={() => handleBookmarkCase(c.id)}
                                  className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                                    bookmarkedCases.has(c.id)
                                      ? 'bg-amber-100 text-amber-700'
                                      : 'bg-gray-100 text-gray-600 hover:bg-amber-50'
                                  }`}
                                >
                                  <i
                                    className={`${
                                      bookmarkedCases.has(c.id) ? 'ri-bookmark-fill' : 'ri-bookmark-line'
                                    }`}
                                  ></i>
                                  <span>{bookmarkedCases.has(c.id) ? '已收藏' : '收藏案例'}</span>
                                </button>
                                <button className="flex items-center space-x-1 px-3 py-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg text-xs font-medium transition-all whitespace-nowrap">
                                  <i className="ri-download-line"></i>
                                  <span>下载案例</span>
                                </button>
                              </div>
                              <button className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white text-xs rounded-lg transition-all whitespace-nowrap">
                                <i className="ri-share-line mr-1"></i>分享给团队
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 学习检测 - 保持原有代码 */}
            {activeTab === 'quiz' && (
              <div>
                {/* 检测说明 */}
                <div className="bg-gradient-to-r from-teal-500 to-cyan-600 rounded-2xl p-5 text-white mb-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold mb-1">学习检测</h3>
                      <p className="text-teal-100 text-sm">
                        完成检测并达到60分，即可解锁实践任务，获取能力点
                      </p>
                    </div>
                    <div className="flex items-center space-x-4 text-center">
                      <div>
                        <div className="text-2xl font-bold">4</div>
                        <div className="text-xs text-teal-200">题目数量</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">60</div>
                        <div className="text-xs text-teal-200">及格分数</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{quizPassed ? '✓' : '--'}</div>
                        <div className="text-xs text-teal-200">通过状态</div>
                      </div>
                    </div>
                  </div>
                </div>
                <LearningQuiz
                  knowledgeName="头脑风暴法"
                  onPass={() => setQuizPassed(true)}
                  onFail={() => setQuizPassed(false)}
                />
              </div>
            )}
          </div>

          {/* 右侧辅助区 */}
          {!focusMode && (
            <div className="w-80 flex-shrink-0 space-y-5">
              {/* 笔记面板 */}
              <div style={{ height: '480px' }}>
                <NotesPanel knowledgeName="头脑风暴法" />
              </div>

              {/* 相关资源推荐 */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center">
                    <i className="ri-compass-discover-line text-teal-600 mr-2"></i>
                    相关学习资源
                  </h3>
                  <button className="text-xs text-teal-600 hover:text-teal-700 whitespace-nowrap">
                    查看更多
                  </button>
                </div>
                <div className="space-y-3">
                  {resources
                    .filter((r) => !completedResources.has(r.id))
                    .slice(0, 3)
                    .map((res) => (
                      <div
                        key={res.id}
                        className="flex items-center space-x-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-xl cursor-pointer transition-all"
                        onClick={() => {
                          setSelectedResource(res);
                          setActiveTab(
                            res.type === 'case' ? 'case' : res.type === 'document' ? 'document' : 'video'
                          );
                        }}
                      >
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${getResourceColor(
                            res.type
                          )}`}
                        >
                          <i className={`${getResourceIcon(res.type)} text-lg`}></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{res.title}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {res.duration || res.size || `${res.pageCount}页`}
                          </p>
                        </div>
                        <i className="ri-arrow-right-s-line text-gray-400 flex-shrink-0"></i>
                      </div>
                    ))}
                </div>
              </div>

              {/* 在线提问 */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center">
                  <i className="ri-question-answer-line text-teal-600 mr-2"></i>
                  向教师提问
                </h3>
                <textarea
                  placeholder="遇到疑问？向教师发起提问..."
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-teal-400 transition-colors"
                  rows={3}
                  maxLength={200}
                />
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center space-x-2">
                    <button className="w-7 h-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-lg transition-colors">
                      <i className="ri-image-line text-sm"></i>
                    </button>
                    <button className="w-7 h-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-lg transition-colors">
                      <i className="ri-attachment-line text-sm"></i>
                    </button>
                  </div>
                  <button className="px-4 py-1.5 bg-teal-500 hover:bg-teal-600 text-white text-xs rounded-lg transition-all whitespace-nowrap">
                    发送提问
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 自动保存提示 */}
      <div
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900/90 backdrop-blur-sm text-white text-sm px-5 py-2.5 rounded-full shadow-xl flex items-center space-x-2 transition-all duration-300 ${
          savedToast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <i className="ri-save-line text-teal-400"></i>
        <span>学习进度已自动保存</span>
      </div>
    </div>
  );
}
