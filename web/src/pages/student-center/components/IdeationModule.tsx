import { useEffect, useMemo, useState, type ElementType } from 'react';
import * as AntIcons from '@ant-design/icons';
import { Modal, message } from 'antd';
import VersionControl, { Version } from '../../../components/feature/VersionControl';
import { sanitizeRichText } from '../../../lib/richText';
import {
  downloadStudentInstanceResource,
  fetchStudentInstanceLibrary,
  getStudentInstanceResourcePreviewUrl,
  type InstanceLibraryCase,
  type InstanceLibraryCategory,
} from '../../../lib/teacherInstanceLibraryApi';

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

type IdeationModuleProps = {
  classId: string;
  onTaskComplete?: () => void;
};

const DEFAULT_CATEGORY_COLOR = '#8b5cf6';
const DEFAULT_CATEGORY_ICON = 'FolderOutlined';
type AntIconComponent = ElementType<{ className?: string }>;
const antIconEntries = Object.entries(AntIcons).filter(
  ([name, value]) => /(Outlined|Filled|TwoTone)$/.test(name) && (typeof value === 'function' || (typeof value === 'object' && value !== null)),
) as [
  string,
  AntIconComponent,
][];
const antIconMap = Object.fromEntries(antIconEntries) as Record<string, AntIconComponent>;

function displayColor(color?: string) {
  const value = String(color || '').trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value) ? value : DEFAULT_CATEGORY_COLOR;
}

function detailSummary(html: string) {
  return sanitizeRichText(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function CategoryIcon({ icon, className }: { icon?: string; className?: string }) {
  const Icon = antIconMap[icon || ''] || antIconMap[DEFAULT_CATEGORY_ICON];
  return <Icon className={className} />;
}

export default function IdeationModule({ classId, onTaskComplete }: IdeationModuleProps) {
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

  const [exampleCategories, setExampleCategories] = useState<InstanceLibraryCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [examplesLoading, setExamplesLoading] = useState(false);
  const [previewCase, setPreviewCase] = useState<InstanceLibraryCase | null>(null);
  
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

  const selectedCategory = useMemo(
    () => exampleCategories.find((cat) => cat.id === selectedCategoryId) || exampleCategories[0],
    [exampleCategories, selectedCategoryId],
  );

  useEffect(() => {
    if (!classId) {
      setExampleCategories([]);
      setSelectedCategoryId('');
      return;
    }
    let cancelled = false;
    setExamplesLoading(true);
    fetchStudentInstanceLibrary(classId)
      .then((res) => {
        if (cancelled) return;
        const list = res.categories || [];
        setExampleCategories(list);
        setSelectedCategoryId((prev) => (prev && list.some((cat) => cat.id === prev) ? prev : list[0]?.id || ''));
      })
      .catch((e) => {
        if (!cancelled) {
          setExampleCategories([]);
          setSelectedCategoryId('');
          message.error(e instanceof Error ? e.message : '加载实例库失败');
        }
      })
      .finally(() => {
        if (!cancelled) setExamplesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [classId]);

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
      onTaskComplete?.();
      setTimeout(() => setShowSuccess(false), 3000);
    }, 1500);
  };

  const methodTabs = [
    { key: 'brainstorm' as const, label: '头脑风暴', icon: 'ri-lightbulb-flash-line', color: 'from-teal-500 to-cyan-500' },
    { key: 'scamper' as const, label: 'SCAMPER', icon: 'ri-compass-3-line', color: 'from-orange-500 to-amber-500' },
    { key: 'triz' as const, label: 'TRIZ', icon: 'ri-puzzle-line', color: 'from-green-500 to-emerald-500' },
    { key: 'ai' as const, label: 'AI创意', icon: 'ri-sparkling-line', color: 'from-rose-500 to-pink-500' },
  ];

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
        <div className="grid grid-cols-4 gap-6 min-h-[calc(100vh-270px)]">
          {/* 左侧分类导航 */}
          <div className="col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sticky top-24 max-h-[calc(100vh-280px)] overflow-y-auto">
              <h3 className="text-base font-bold text-gray-900 mb-4">垂直方向</h3>
              <div className="space-y-2">
                {exampleCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className={`w-full px-4 py-3 text-sm font-medium rounded-xl transition-all text-left flex items-center gap-3 cursor-pointer ${
                      selectedCategory.id === cat.id
                        ? 'text-white shadow-md'
                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                    }`}
                    style={selectedCategory.id === cat.id ? { backgroundColor: displayColor(cat.color) } : undefined}
                  >
                    <CategoryIcon className="text-base flex-shrink-0" icon={cat.icon} />
                    <span>{cat.name}</span>
                  </button>
                ))}
                {!examplesLoading && exampleCategories.length === 0 && (
                  <div className="rounded-xl border border-dashed border-gray-200 p-4 text-center text-sm text-gray-500">暂无实例方向</div>
                )}
              </div>
            </div>
          </div>

          {/* 右侧案例展示 */}
          <div className="col-span-3">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 max-h-[calc(100vh-280px)] flex flex-col">
              {selectedCategory ? (
                <>
                  <div className="flex items-center gap-3 mb-6">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-white"
                      style={{ backgroundColor: displayColor(selectedCategory.color) }}
                    >
                      <CategoryIcon className="text-2xl" icon={selectedCategory.icon} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{selectedCategory.name}</h2>
                      <p className="text-sm text-gray-500">参考以下实例，激发创新灵感（共{selectedCategory.cases.length}个实例）</p>
                    </div>
                  </div>

                  <div className="space-y-4 overflow-y-auto pr-2">
                    {selectedCategory.cases.map((caseItem) => (
                      <div key={caseItem.id} className="border border-gray-200 rounded-xl p-5 hover:shadow-lg hover:border-teal-200 transition-all">
                        <div className="flex items-start justify-between mb-2 gap-4">
                          <div className="flex-1">
                            <h3 className="text-base font-bold text-gray-900 mb-2">{caseItem.title}</h3>
                            <p
                              className="text-sm text-gray-600 leading-relaxed mb-3"
                              style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden' }}
                            >
                              {detailSummary(caseItem.detailHtml)}
                            </p>
                            <div className="flex items-center gap-2 mb-3 flex-wrap">
                              {caseItem.tags.map((tag) => (
                                <span key={tag} className="px-2.5 py-1 bg-teal-50 text-teal-700 text-xs font-medium rounded-full whitespace-nowrap">
                                  {tag}
                                </span>
                              ))}
                            </div>
                            <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg p-2.5">
                              <i className="ri-trophy-line text-green-600 text-sm mt-0.5"></i>
                              <div>
                                <p className="text-xs font-semibold text-green-800 mb-0.5">项目成果</p>
                                <p className="text-xs text-green-700">{caseItem.projectOutcome || '未填写'}</p>
                              </div>
                            </div>
                          </div>
                          <button type="button" onClick={() => setPreviewCase(caseItem)} className="text-sm text-teal-600 font-medium cursor-pointer">
                            查看详情
                          </button>
                        </div>
                      </div>
                    ))}
                    {!examplesLoading && selectedCategory.cases.length === 0 && (
                      <div className="rounded-xl border border-dashed border-gray-200 p-10 text-center text-sm text-gray-500">暂无实例</div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 rounded-xl border border-dashed border-gray-200 p-12 text-center text-sm text-gray-500">
                  {examplesLoading ? '实例库加载中...' : '暂无实例'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 创新方法工具 Tab */}
      {activeTab === 'methods' && (
        <div className="grid grid-cols-3 gap-6">
         

          {/* 左侧栏 */}
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
           {/* 右侧主内容 */}
           <div className="col-span-1 space-y-5">
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

      <Modal
        title={previewCase?.title || '实例详情'}
        open={Boolean(previewCase)}
        onCancel={() => setPreviewCase(null)}
        footer={null}
        width="min(900px, calc(100vw - 48px))"
        styles={{ body: { overflowX: 'hidden' } }}
      >
        {previewCase && (
          <div className="space-y-4 max-h-[calc(100vh-220px)] overflow-y-auto overflow-x-hidden pr-2">
            <div className="flex items-center gap-2 flex-wrap">
              {previewCase.tags.map((tag) => (
                <span key={tag} className="px-2.5 py-1 bg-teal-50 text-teal-700 text-xs font-medium rounded-full whitespace-nowrap">
                  {tag}
                </span>
              ))}
            </div>
            <div
              className="prose max-w-none overflow-x-hidden break-words [&_*]:max-w-full [&_img]:h-auto [&_table]:w-full"
              dangerouslySetInnerHTML={{ __html: sanitizeRichText(previewCase.detailHtml) }}
            />
            <div className="rounded-lg bg-green-50 border border-green-200 p-3">
              <p className="text-xs font-semibold text-green-800 mb-1">项目成果</p>
              <p className="text-sm text-green-700">{previewCase.projectOutcome || '未填写'}</p>
            </div>
            {previewCase.resources.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-900">附件</p>
                {previewCase.resources.map((resource) => (
                  <div key={resource.id} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 text-sm overflow-hidden">
                    <div className="flex items-center gap-2 min-w-0">
                      <i className="ri-attachment-2 text-gray-500"></i>
                      <span className="truncate text-gray-700">{resource.originName}</span>
                      <span className="text-xs text-gray-400">{resource.size}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      {resource.canPreview && (
                        <a href={getStudentInstanceResourcePreviewUrl(classId, resource.id)} target="_blank" rel="noreferrer" className="text-blue-600">
                          预览
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => downloadStudentInstanceResource(classId, resource.id, resource.originName)}
                        className="text-teal-600 cursor-pointer"
                      >
                        下载
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
