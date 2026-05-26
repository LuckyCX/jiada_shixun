import React, { useState, useEffect } from 'react';
import VersionControl, { Version } from '../../../components/feature/VersionControl';

interface PrototypeCase {
  id: number;
  title: string;
  category: string;
  description: string;
  imageUrl: string;
  tags: string[];
}

interface DesignTool {
  id: number;
  name: string;
  icon: string;
  url: string;
  description: string;
  color: string;
}

interface AIAnalysisResult {
  score: number;
  strengths: string[];
  improvements: string[];
  designPrinciples: { name: string; score: number; feedback: string }[];
  suggestions: string[];
}

interface UploadedPrototype {
  id: string;
  name: string;
  imageUrl: string;
  uploadTime: string;
  analysis: AIAnalysisResult | null;
}

const prototypeCases: PrototypeCase[] = [
  {
    id: 1,
    title: '智慧农业管理平台',
    category: '乡村振兴',
    description: '集成物联网传感器数据，实时监控农作物生长状态，提供智能灌溉、施肥建议，帮助农民提高产量和收益',
    imageUrl: 'https://readdy.ai/api/search-image?query=smart%20agriculture%20management%20platform%20interface%20design%20with%20IoT%20sensor%20data%20dashboard%2C%20crop%20monitoring%20system%2C%20irrigation%20control%20panel%2C%20clean%20modern%20UI%2C%20bright%20background&width=600&height=400&seq=proto-case-001&orientation=landscape',
    tags: ['物联网', '数据可视化', '智能决策']
  },
  {
    id: 2,
    title: '社区养老服务平台',
    category: '智慧养老',
    description: '为老年人提供健康监测、紧急呼叫、上门服务预约等功能，子女可远程查看父母健康状态，社区工作者可高效管理服务',
    imageUrl: 'https://readdy.ai/api/search-image?query=elderly%20care%20service%20platform%20interface%20with%20health%20monitoring%20dashboard%2C%20emergency%20call%20button%2C%20service%20booking%20system%2C%20senior-friendly%20UI%20design%2C%20warm%20colors%2C%20bright%20background&width=600&height=400&seq=proto-case-002&orientation=landscape',
    tags: ['健康监测', '服务预约', '亲情关怀']
  },
  {
    id: 3,
    title: 'AI智能作业批改系统',
    category: '教育科技',
    description: '利用OCR和AI技术自动识别学生手写作业，智能批改并生成详细的错题分析报告，帮助教师减轻工作负担，学生精准提升',
    imageUrl: 'https://readdy.ai/api/search-image?query=AI%20homework%20grading%20system%20interface%20with%20OCR%20recognition%2C%20automatic%20correction%2C%20error%20analysis%20report%2C%20student%20performance%20dashboard%2C%20educational%20technology%20UI%2C%20bright%20background&width=600&height=400&seq=proto-case-003&orientation=landscape',
    tags: ['OCR识别', 'AI批改', '学情分析']
  },
  {
    id: 4,
    title: '校园一卡通管理系统',
    category: '智慧校园',
    description: '整合食堂消费、图书借阅、门禁考勤、校园缴费等功能，学生和教师一卡在手，畅行校园，管理员可实时查看数据统计',
    imageUrl: 'https://readdy.ai/api/search-image?query=campus%20smart%20card%20management%20system%20interface%20with%20canteen%20payment%2C%20library%20access%2C%20attendance%20tracking%2C%20fee%20payment%2C%20unified%20dashboard%2C%20modern%20educational%20UI%2C%20bright%20background&width=600&height=400&seq=proto-case-004&orientation=landscape',
    tags: ['一卡通', '数据统计', '便捷支付']
  },
  {
    id: 5,
    title: '碳足迹追踪应用',
    category: '绿色环保',
    description: '记录用户日常出行、用电、饮食等行为的碳排放量，提供减碳建议和挑战任务，通过游戏化方式培养环保意识',
    imageUrl: 'https://readdy.ai/api/search-image?query=carbon%20footprint%20tracking%20app%20interface%20with%20daily%20emission%20records%2C%20eco-friendly%20suggestions%2C%20gamification%20challenges%2C%20green%20environmental%20UI%20design%2C%20bright%20background&width=600&height=400&seq=proto-case-005&orientation=landscape',
    tags: ['碳排放', '环保建议', '游戏化']
  },
  {
    id: 6,
    title: '文化遗产AR导览',
    category: '文化旅游',
    description: '利用AR技术让游客在景区中看到历史场景重现，提供语音讲解、互动问答、拍照打卡等功能，提升文化旅游体验',
    imageUrl: 'https://readdy.ai/api/search-image?query=cultural%20heritage%20AR%20tour%20guide%20app%20interface%20with%20augmented%20reality%20historical%20scenes%2C%20audio%20guide%2C%20interactive%20quiz%2C%20photo%20spots%2C%20tourism%20UI%20design%2C%20bright%20background&width=600&height=400&seq=proto-case-006&orientation=landscape',
    tags: ['AR技术', '语音导览', '互动体验']
  }
];

const designTools: DesignTool[] = [
  {
    id: 1,
    name: '墨刀',
    icon: 'ri-pencil-ruler-2-line',
    url: 'https://modao.cc',
    description: '国产原型设计工具，支持团队协作',
    color: 'from-blue-500 to-indigo-500'
  },
  {
    id: 2,
    name: '墨高',
    icon: 'ri-palette-line',
    url: 'https://mockplus.cn',
    description: '快速原型设计，自动标注切图',
    color: 'from-purple-500 to-pink-500'
  },
  {
    id: 3,
    name: 'Figma',
    icon: 'ri-layout-line',
    url: 'https://www.figma.com',
    description: '在线协作设计工具，全球流行',
    color: 'from-orange-500 to-red-500'
  },
  {
    id: 4,
    name: 'Axure',
    icon: 'ri-artboard-line',
    url: 'https://www.axure.com',
    description: '专业交互原型设计工具',
    color: 'from-green-500 to-teal-500'
  },
  {
    id: 5,
    name: 'Sketch',
    icon: 'ri-brush-line',
    url: 'https://www.sketch.com',
    description: 'Mac平台UI设计利器',
    color: 'from-amber-500 to-yellow-500'
  },
  {
    id: 6,
    name: 'Adobe XD',
    icon: 'ri-compasses-2-line',
    url: 'https://www.adobe.com/products/xd.html',
    description: 'Adobe出品的UX设计工具',
    color: 'from-pink-500 to-rose-500'
  }
];

type ProductDesignModuleProps = {
  onTaskComplete?: () => void;
};

export default function ProductDesignModule({ onTaskComplete }: ProductDesignModuleProps) {
  const [activeTab, setActiveTab] = useState<'ai-suggestions' | 'cases' | 'tools' | 'upload'>('ai-suggestions');
  
  // 原型上传和AI分析
  const [uploadedPrototypes, setUploadedPrototypes] = useState<UploadedPrototype[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);

  // AI设计建议
  const [projectContext, setProjectContext] = useState('');
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<any>(null);

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
        uploadedPrototypes,
        aiSuggestions,
        projectContext
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
    setUploadedPrototypes(data.uploadedPrototypes || []);
    setAiSuggestions(data.aiSuggestions || null);
    setProjectContext(data.projectContext || '');
    setCurrentVersion(version.versionNumber);
  };

  const tabs = [
    { key: 'ai-suggestions' as const, label: 'AI设计建议', icon: 'ri-lightbulb-flash-line', badge: 'NEW' },
    { key: 'cases' as const, label: '原型案例库', icon: 'ri-gallery-line' },
    { key: 'tools' as const, label: '设计工具', icon: 'ri-tools-line' },
    { key: 'upload' as const, label: '原型上传', icon: 'ri-upload-cloud-line', badge: 'AI' },
  ];

  const handlePrototypeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newPrototypes: UploadedPrototype[] = [];
    let processedCount = 0;

    Array.from(files).forEach((file) => {
      if (file.size > 10 * 1024 * 1024) {
        alert(`文件 ${file.name} 大小超过10MB，已跳过`);
        processedCount++;
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const newPrototype: UploadedPrototype = {
          id: `proto-${Date.now()}-${Math.random()}`,
          name: file.name,
          imageUrl: event.target?.result as string,
          uploadTime: new Date().toLocaleString('zh-CN'),
          analysis: null
        };
        newPrototypes.push(newPrototype);
        processedCount++;

        if (processedCount === files.length) {
          setUploadedPrototypes([...uploadedPrototypes, ...newPrototypes]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleAIAnalysis = (prototypeId: string) => {
    setIsAnalyzing(true);

    setTimeout(() => {
      const mockAnalysis: AIAnalysisResult = {
        score: Math.floor(Math.random() * 15) + 80,
        strengths: [
          '界面布局清晰合理，信息层级分明',
          '色彩搭配协调，符合品牌调性',
          '交互流程顺畅，用户路径简洁',
          '关键操作按钮位置醒目，易于点击'
        ],
        improvements: [
          '部分文字大小偏小，建议增大以提升可读性',
          '缺少空状态设计，建议补充无数据时的引导',
          '表单输入项较多，可考虑分步骤或分组优化',
          '移动端适配需要优化，部分元素间距过小'
        ],
        designPrinciples: [
          { name: '一致性', score: 92, feedback: '整体风格统一，组件复用率高' },
          { name: '易用性', score: 85, feedback: '操作流程清晰，但部分功能入口不够明显' },
          { name: '美观性', score: 88, feedback: '视觉设计精美，但可进一步优化细节' },
          { name: '可访问性', score: 78, feedback: '对比度良好，但需增强无障碍支持' },
          { name: '响应式', score: 82, feedback: '基本适配移动端，但需优化触控体验' }
        ],
        suggestions: [
          '建议在首页增加快捷操作入口，提升核心功能的可达性',
          '考虑添加新手引导和帮助提示，降低学习成本',
          '优化加载状态和反馈提示，提升用户感知性能',
          '增加个性化设置选项，满足不同用户偏好',
          '完善错误处理和异常提示，提升容错性'
        ]
      };

      setUploadedPrototypes(prev => 
        prev.map(p => p.id === prototypeId ? { ...p, analysis: mockAnalysis } : p)
      );
      setIsAnalyzing(false);
      onTaskComplete?.();
    }, 3000);
  };

  const handleDeletePrototype = (prototypeId: string) => {
    setUploadedPrototypes(prev => prev.filter(p => p.id !== prototypeId));
  };

  const handleGenerateAISuggestions = () => {
    if (!projectContext.trim()) {
      alert('请先输入项目背景信息');
      return;
    }

    setIsGeneratingSuggestions(true);

    setTimeout(() => {
      const mockSuggestions = {
        coreFeatures: [
          {
            name: '智能推荐引擎',
            description: '基于用户行为和偏好数据，提供个性化内容推荐',
            priority: '高',
            reason: '能显著提升用户粘性和转化率',
            implementation: '使用协同过滤算法，结合用户画像和实时行为分析'
          },
          {
            name: '实时数据看板',
            description: '可视化展示关键业务指标和运营数据',
            priority: '高',
            reason: '帮助用户快速了解业务状况，做出决策',
            implementation: '采用ECharts或D3.js实现动态图表，支持自定义配置'
          },
          {
            name: '多端同步功能',
            description: '支持Web、移动端、小程序数据实时同步',
            priority: '中',
            reason: '满足用户多场景使用需求',
            implementation: '基于WebSocket实现实时通信，使用云端存储'
          }
        ],
        userExperience: [
          '简化注册登录流程，支持第三方账号快速登录',
          '优化首次使用体验，提供清晰的新手引导',
          '增加搜索和筛选功能，提升内容查找效率',
          '设计空状态页面，引导用户完成关键操作',
          '提供快捷操作和键盘快捷键，提升效率'
        ],
        technicalArchitecture: [
          '前端采用React + TypeScript，确保代码质量',
          '后端使用微服务架构，便于扩展和维护',
          '数据库选用PostgreSQL + Redis组合',
          '部署采用Docker容器化，支持弹性伸缩',
          '集成CI/CD流程，实现自动化测试和部署'
        ],
        iterationPlan: [
          { phase: 'MVP版本', duration: '4周', focus: '核心功能开发，快速验证' },
          { phase: 'Beta版本', duration: '6周', focus: '完善功能，优化体验' },
          { phase: '正式版本', duration: '8周', focus: '性能优化，上线运营' }
        ]
      };

      setAiSuggestions(mockSuggestions);
      setIsGeneratingSuggestions(false);
    }, 2500);
  };

  return (
    <div className="space-y-6">
      {/* 版本控制工具栏 */}
      <VersionControl
        versions={versions}
        currentVersion={currentVersion}
        onRestore={handleRestore}
        onSaveVersion={handleSaveVersion}
        moduleName="产品设计与迭代"
      />

      {/* 模块头部 */}
      <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl shadow-xl p-8 text-white">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <i className="ri-pencil-ruler-2-line text-3xl"></i>
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-1">产品设计与迭代</h2>
              <p className="text-white/80 text-sm">
                参考优秀案例，使用专业工具，AI辅助设计，持续优化迭代
              </p>
            </div>
          </div>
          <span className="px-3 py-1.5 rounded-full text-sm font-semibold bg-white/20 text-white whitespace-nowrap">
            <i className="ri-loader-line mr-1.5"></i>进行中
          </span>
        </div>
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
            <div className="text-2xl font-bold mb-1">{prototypeCases.length}</div>
            <div className="text-sm text-white/70">案例参考</div>
          </div>
          <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
            <div className="text-2xl font-bold mb-1">{designTools.length}</div>
            <div className="text-sm text-white/70">设计工具</div>
          </div>
          <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
            <div className="text-2xl font-bold mb-1">{uploadedPrototypes.length}</div>
            <div className="text-sm text-white/70">已上传原型</div>
          </div>
          <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
            <div className="text-2xl font-bold mb-1">
              {uploadedPrototypes.filter(p => p.analysis).length}
            </div>
            <div className="text-sm text-white/70">AI已分析</div>
          </div>
        </div>
      </div>

      {/* 标签页 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === tab.key
                  ? 'text-orange-600 border-b-2 border-orange-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <i className={`${tab.icon} mr-2`}></i>
              {tab.label}
              {tab.badge && (
                <span className="ml-2 px-2 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs rounded-full">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-8">
          {/* AI设计建议 */}
          {activeTab === 'ai-suggestions' && (
            <div className="space-y-6">
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-6">
                <h3 className="text-base font-bold text-orange-900 mb-3">
                  <i className="ri-robot-line mr-2"></i>
                  AI智能设计建议
                </h3>
                <p className="text-sm text-orange-700">
                  基于你的项目背景，AI将提供功能设计、用户体验、技术架构等全方位建议
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h4 className="text-base font-bold text-gray-900 mb-4">项目背景信息</h4>
                <textarea
                  value={projectContext}
                  onChange={(e) => setProjectContext(e.target.value)}
                  placeholder="请详细描述你的项目背景，包括：&#10;1. 项目名称和核心目标&#10;2. 目标用户群体和使用场景&#10;3. 要解决的核心问题&#10;4. 已确定的功能需求&#10;5. 技术栈偏好（如有）&#10;&#10;例如：我们正在开发一个智慧校园一卡通系统，目标用户是在校师生，主要解决校园内多场景支付不便的问题，需要整合食堂消费、图书借阅、门禁考勤等功能..."
                  className="w-full h-48 px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                  maxLength={1000}
                />
                <div className="flex justify-between items-center mt-3">
                  <span className="text-xs text-gray-500">详细的背景信息有助于AI提供更精准的建议</span>
                  <span className="text-xs text-gray-500">{projectContext.length}/1000</span>
                </div>
              </div>

              <button
                onClick={handleGenerateAISuggestions}
                disabled={isGeneratingSuggestions || !projectContext.trim()}
                className="w-full px-6 py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white text-base font-medium rounded-xl hover:from-orange-600 hover:to-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                {isGeneratingSuggestions ? (
                  <>
                    <i className="ri-loader-4-line mr-2 animate-spin"></i>
                    AI正在分析项目并生成建议...
                  </>
                ) : (
                  <>
                    <i className="ri-sparkling-line mr-2"></i>
                    生成AI设计建议
                  </>
                )}
              </button>

              {aiSuggestions && (
                <div className="space-y-6">
                  {/* 核心功能建议 */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-6">
                    <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <i className="ri-function-line text-blue-600"></i>
                      核心功能建议
                    </h4>
                    <div className="space-y-4">
                      {aiSuggestions.coreFeatures.map((feature: any, idx: number) => (
                        <div key={idx} className="bg-white rounded-xl p-5 border border-blue-200">
                          <div className="flex items-start justify-between mb-3">
                            <h5 className="text-base font-bold text-gray-900">{feature.name}</h5>
                            <span className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap ${
                              feature.priority === '高' ? 'bg-red-100 text-red-700' :
                              feature.priority === '中' ? 'bg-amber-100 text-amber-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {feature.priority}优先级
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 mb-3">{feature.description}</p>
                          <div className="bg-blue-50 rounded-lg p-3 mb-3">
                            <p className="text-xs font-medium text-blue-900 mb-1">
                              <i className="ri-lightbulb-line mr-1"></i>
                              推荐理由
                            </p>
                            <p className="text-xs text-blue-700">{feature.reason}</p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs font-medium text-gray-900 mb-1">
                              <i className="ri-code-line mr-1"></i>
                              实现建议
                            </p>
                            <p className="text-xs text-gray-700">{feature.implementation}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 用户体验建议 */}
                  <div className="bg-gradient-to-br from-green-50 to-teal-50 border-2 border-green-200 rounded-2xl p-6">
                    <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <i className="ri-user-heart-line text-green-600"></i>
                      用户体验优化
                    </h4>
                    <div className="grid md:grid-cols-2 gap-3">
                      {aiSuggestions.userExperience.map((suggestion: string, idx: number) => (
                        <div key={idx} className="bg-white rounded-lg p-4 border border-green-200 flex items-start gap-3">
                          <div className="w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {idx + 1}
                          </div>
                          <p className="text-sm text-gray-700">{suggestion}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 技术架构建议 */}
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-2xl p-6">
                    <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <i className="ri-stack-line text-purple-600"></i>
                      技术架构建议
                    </h4>
                    <div className="space-y-3">
                      {aiSuggestions.technicalArchitecture.map((tech: string, idx: number) => (
                        <div key={idx} className="bg-white rounded-lg p-4 border border-purple-200 flex items-start gap-3">
                          <i className="ri-checkbox-circle-fill text-purple-600 mt-0.5"></i>
                          <p className="text-sm text-gray-700">{tech}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 迭代计划 */}
                  <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-6">
                    <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <i className="ri-roadmap-line text-amber-600"></i>
                      迭代计划建议
                    </h4>
                    <div className="space-y-4">
                      {aiSuggestions.iterationPlan.map((phase: any, idx: number) => (
                        <div key={idx} className="bg-white rounded-xl p-5 border border-amber-200">
                          <div className="flex items-center gap-4 mb-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                              {idx + 1}
                            </div>
                            <div className="flex-1">
                              <h5 className="text-base font-bold text-gray-900">{phase.phase}</h5>
                              <p className="text-sm text-gray-600">
                                <i className="ri-time-line mr-1"></i>
                                预计周期：{phase.duration}
                              </p>
                            </div>
                          </div>
                          <p className="text-sm text-gray-700 bg-amber-50 rounded-lg p-3">
                            <i className="ri-focus-line mr-1"></i>
                            <strong>重点：</strong>{phase.focus}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 原型案例库 */}
          {activeTab === 'cases' && (
            <div className="space-y-6">
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-6">
                <h3 className="text-base font-bold text-orange-900 mb-3">
                  <i className="ri-lightbulb-line mr-2"></i>
                  优秀原型案例参考
                </h3>
                <p className="text-sm text-orange-700">
                  学习借鉴优秀产品的设计思路和交互方式，激发创新灵感，提升设计水平
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {prototypeCases.map((protoCase) => (
                  <div
                    key={protoCase.id}
                    className="border border-gray-200 rounded-xl overflow-hidden hover:shadow-xl transition-all group"
                  >
                    <div className="relative overflow-hidden">
                      <img
                        src={protoCase.imageUrl}
                        alt={protoCase.title}
                        className="w-full h-56 object-cover object-top group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute top-3 left-3">
                        <span className="px-3 py-1 bg-orange-500 text-white text-xs font-medium rounded-full">
                          {protoCase.category}
                        </span>
                      </div>
                    </div>
                    <div className="p-5">
                      <h4 className="text-lg font-bold text-gray-900 mb-2">{protoCase.title}</h4>
                      <p className="text-sm text-gray-600 mb-4 line-clamp-3">{protoCase.description}</p>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {protoCase.tags.map((tag, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-md"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                      <button 
                        onClick={() => setSelectedCaseId(protoCase.id)}
                        className="w-full px-4 py-2 bg-orange-50 text-orange-600 text-sm font-medium rounded-lg hover:bg-orange-100 transition-colors cursor-pointer"
                      >
                        <i className="ri-eye-line mr-2"></i>
                        查看详情
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 设计工具 */}
          {activeTab === 'tools' && (
            <div className="space-y-6">
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-6">
                <h3 className="text-base font-bold text-orange-900 mb-3">
                  <i className="ri-tools-line mr-2"></i>
                  常用设计工具快速访问
                </h3>
                <p className="text-sm text-orange-700">
                  一键打开专业设计工具，开始创作你的产品原型，支持团队协作和在线分享
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                {designTools.map((tool) => (
                  <a
                    key={tool.id}
                    href={tool.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block border border-gray-200 rounded-xl p-6 hover:shadow-xl transition-all group cursor-pointer"
                  >
                    <div className={`w-16 h-16 bg-gradient-to-br ${tool.color} rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                      <i className={`${tool.icon} text-3xl text-white`}></i>
                    </div>
                    <h4 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                      {tool.name}
                      <i className="ri-external-link-line text-sm text-gray-400 group-hover:text-orange-500"></i>
                    </h4>
                    <p className="text-sm text-gray-600 mb-4">{tool.description}</p>
                    <div className={`inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r ${tool.color} text-white text-xs font-medium rounded-full`}>
                      <i className="ri-arrow-right-line"></i>
                      立即打开
                    </div>
                  </a>
                ))}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                <h4 className="text-sm font-bold text-blue-900 mb-3">
                  <i className="ri-information-line mr-2"></i>
                  使用提示
                </h4>
                <ul className="text-sm text-blue-700 space-y-2">
                  <li>• 建议使用墨刀或墨高进行快速原型设计，支持中文界面</li>
                  <li>• Figma适合团队协作，可实时查看其他成员的设计进度</li>
                  <li>• 完成设计后，可导出图片上传到"原型上传"标签页进行AI分析</li>
                  <li>• 记得保存设计文件链接，方便后续修改和团队共享</li>
                </ul>
              </div>
            </div>
          )}

          {/* 原型上传 */}
          {activeTab === 'upload' && (
            <div className="space-y-6">
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-6">
                <h3 className="text-base font-bold text-orange-900 mb-3">
                  <i className="ri-sparkling-line mr-2"></i>
                  AI智能分析原型设计
                </h3>
                <p className="text-sm text-orange-700">
                  支持多张原型图上传，AI将从多个维度进行专业分析，提供优化建议，分析结果自动保存
                </p>
              </div>

              <div className="border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center hover:border-orange-400 transition-colors">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={handlePrototypeUpload}
                  className="hidden"
                  id="prototype-upload"
                  multiple
                />
                <label htmlFor="prototype-upload" className="cursor-pointer">
                  <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="ri-upload-cloud-line text-4xl text-orange-600"></i>
                  </div>
                  <h4 className="text-lg font-bold text-gray-900 mb-2">上传原型图</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    支持 PNG、JPG 格式，单个文件最大 10MB，可同时上传多张
                  </p>
                  <span className="inline-block px-6 py-3 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors">
                    <i className="ri-folder-open-line mr-2"></i>
                    选择文件
                  </span>
                </label>
              </div>

              {uploadedPrototypes.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-base font-bold text-gray-900">
                      已上传原型 ({uploadedPrototypes.length})
                    </h4>
                    <span className="text-sm text-gray-500">
                      已分析 {uploadedPrototypes.filter(p => p.analysis).length} 个
                    </span>
                  </div>

                  {uploadedPrototypes.map((prototype) => (
                    <div key={prototype.id} className="border border-gray-200 rounded-xl overflow-hidden">
                      <div className="relative">
                        <img
                          src={prototype.imageUrl}
                          alt={prototype.name}
                          className="w-full max-h-96 object-contain bg-gray-50"
                        />
                        <button
                          onClick={() => handleDeletePrototype(prototype.id)}
                          className="absolute top-4 right-4 w-10 h-10 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors cursor-pointer"
                        >
                          <i className="ri-delete-bin-line"></i>
                        </button>
                      </div>
                      <div className="p-5 bg-gray-50 border-t border-gray-200">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{prototype.name}</p>
                            <p className="text-xs text-gray-500 mt-1">上传时间：{prototype.uploadTime}</p>
                          </div>
                          {!prototype.analysis ? (
                            <button
                              onClick={() => handleAIAnalysis(prototype.id)}
                              disabled={isAnalyzing}
                              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-medium rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                            >
                              {isAnalyzing ? (
                                <>
                                  <i className="ri-loader-4-line mr-2 animate-spin"></i>
                                  AI分析中...
                                </>
                              ) : (
                                <>
                                  <i className="ri-sparkling-line mr-2"></i>
                                  开始AI分析
                                </>
                              )}
                            </button>
                          ) : (
                            <span className="px-4 py-2 bg-green-100 text-green-700 text-sm font-medium rounded-lg">
                              <i className="ri-checkbox-circle-fill mr-2"></i>
                              已分析
                            </span>
                          )}
                        </div>

                        {prototype.analysis && (
                          <div className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-2xl p-6 mt-4">
                            <div className="flex items-center justify-between mb-6">
                              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <i className="ri-sparkling-fill text-purple-600"></i>
                                AI分析报告
                              </h3>
                              <div className="flex items-center gap-3">
                                <span className="text-sm text-gray-600">综合评分</span>
                                <div className="relative w-20 h-20">
                                  <svg className="w-20 h-20 transform -rotate-90">
                                    <circle
                                      cx="40"
                                      cy="40"
                                      r="32"
                                      stroke="#e5e7eb"
                                      strokeWidth="6"
                                      fill="none"
                                    />
                                    <circle
                                      cx="40"
                                      cy="40"
                                      r="32"
                                      stroke="url(#gradient)"
                                      strokeWidth="6"
                                      fill="none"
                                      strokeDasharray={`${(prototype.analysis.score / 100) * 201} 201`}
                                      strokeLinecap="round"
                                    />
                                    <defs>
                                      <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor="#a855f7" />
                                        <stop offset="100%" stopColor="#ec4899" />
                                      </linearGradient>
                                    </defs>
                                  </svg>
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-2xl font-bold text-purple-600">{prototype.analysis.score}</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-6 mb-6">
                              <div className="bg-white rounded-xl p-5 border border-green-200">
                                <h4 className="text-sm font-bold text-green-900 mb-3 flex items-center gap-2">
                                  <i className="ri-thumb-up-line"></i>
                                  设计优点
                                </h4>
                                <ul className="space-y-2">
                                  {prototype.analysis.strengths.map((strength, idx) => (
                                    <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                                      <i className="ri-check-line text-green-600 mt-0.5 flex-shrink-0"></i>
                                      <span>{strength}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              <div className="bg-white rounded-xl p-5 border border-amber-200">
                                <h4 className="text-sm font-bold text-amber-900 mb-3 flex items-center gap-2">
                                  <i className="ri-error-warning-line"></i>
                                  改进建议
                                </h4>
                                <ul className="space-y-2">
                                  {prototype.analysis.improvements.map((improvement, idx) => (
                                    <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                                      <i className="ri-arrow-right-line text-amber-600 mt-0.5 flex-shrink-0"></i>
                                      <span>{improvement}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>

                            <div className="bg-white rounded-xl p-5 border border-purple-200 mb-6">
                              <h4 className="text-sm font-bold text-purple-900 mb-4 flex items-center gap-2">
                                <i className="ri-bar-chart-line"></i>
                                设计原则评估
                              </h4>
                              <div className="space-y-4">
                                {prototype.analysis.designPrinciples.map((principle, idx) => (
                                  <div key={idx}>
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-sm font-medium text-gray-900">{principle.name}</span>
                                      <span className="text-sm font-bold text-purple-600">{principle.score}分</span>
                                    </div>
                                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-1">
                                      <div
                                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-1000"
                                        style={{ width: `${principle.score}%` }}
                                      ></div>
                                    </div>
                                    <p className="text-xs text-gray-600">{principle.feedback}</p>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="bg-white rounded-xl p-5 border border-blue-200">
                              <h4 className="text-sm font-bold text-blue-900 mb-3 flex items-center gap-2">
                                <i className="ri-lightbulb-flash-line"></i>
                                优化建议
                              </h4>
                              <ul className="space-y-2">
                                {prototype.analysis.suggestions.map((suggestion, idx) => (
                                  <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                                    <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                                      {idx + 1}
                                    </span>
                                    <span>{suggestion}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 案例详情弹窗 */}
      {selectedCaseId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setSelectedCaseId(null)}
        >
          <div
            className="relative max-w-4xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const caseData = prototypeCases.find(c => c.id === selectedCaseId);
              if (!caseData) return null;
              
              return (
                <>
                  <div className="sticky top-0 bg-gradient-to-r from-orange-500 to-red-500 px-6 py-4 flex items-center justify-between z-10">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <i className="ri-eye-line"></i>
                      案例详情
                    </h3>
                    <button
                      onClick={() => setSelectedCaseId(null)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/20 text-white cursor-pointer"
                    >
                      <i className="ri-close-line text-lg"></i>
                    </button>
                  </div>
                  <div className="p-6">
                    <img
                      src={caseData.imageUrl}
                      alt={caseData.title}
                      className="w-full h-96 object-cover object-top rounded-xl mb-6"
                    />
                    <div className="mb-4">
                      <span className="px-3 py-1 bg-orange-100 text-orange-700 text-sm font-medium rounded-full">
                        {caseData.category}
                      </span>
                    </div>
                    <h4 className="text-2xl font-bold text-gray-900 mb-4">{caseData.title}</h4>
                    <p className="text-base text-gray-700 mb-6 leading-relaxed">{caseData.description}</p>
                    <div className="flex flex-wrap gap-2 mb-6">
                      {caseData.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <button
                      onClick={() => setSelectedCaseId(null)}
                      className="w-full px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-medium rounded-lg hover:from-orange-600 hover:to-red-600 transition-all"
                    >
                      <i className="ri-check-line mr-2"></i>
                      关闭
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* 可获得能力点 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-5 flex items-center gap-2">
          <i className="ri-medal-line text-teal-600"></i>可获得能力点
        </h3>
        <div className="flex flex-wrap gap-3">
          {['产品设计', '原型开发', '迭代优化', 'AI应用'].map((ap, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-orange-200 bg-orange-50"
            >
              <i className="ri-medal-fill text-base text-orange-500"></i>
              <span className="text-sm font-semibold text-orange-700">{ap}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}