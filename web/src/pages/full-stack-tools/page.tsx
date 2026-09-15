
import { useState } from 'react';
import AppModalPortal from '../../components/AppModalPortal';

interface Tool {
  id: string;
  name: string;
  icon: string;
  category: 'code' | 'design' | 'lowcode';
  description: string;
  features: string[];
  color: string;
}

interface Task {
  id: string;
  title: string;
  assignee: string;
  role: string;
  tool: string;
  status: 'pending' | 'in-progress' | 'completed';
  progress: number;
  deadline: string;
}

interface MVPComponent {
  id: string;
  name: string;
  type: string;
  icon: string;
  description: string;
}

export default function FullStackToolsPage() {
  const [activeTab, setActiveTab] = useState<'tools' | 'workspace' | 'mvp'>('tools');
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [showDesignModal, setShowDesignModal] = useState(false);
  const [codePrompt, setCodePrompt] = useState('');
  const [designPrompt, setDesignPrompt] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [generatedDesign, setGeneratedDesign] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const tools: Tool[] = [
    {
      id: 'code-agent',
      name: '代码生成智能体',
      icon: 'ri-code-s-slash-line',
      category: 'code',
      description: '基于AI的代码生成工具，帮助理工科学生优化算法逻辑、解决技术卡点',
      features: [
        '算法逻辑优化',
        '技术卡点解决',
        '代码审查与重构',
        '性能优化建议',
        '多语言支持（Python/Java/JavaScript/Go）'
      ],
      color: 'from-blue-500 to-cyan-500'
    },
    {
      id: 'ui-agent',
      name: 'UI设计智能体',
      icon: 'ri-palette-line',
      category: 'design',
      description: '48小时内渲染高保真UI界面与3D产品图，赋能文科学生快速产出设计稿',
      features: [
        '高保真UI界面生成',
        '3D产品图渲染',
        '设计规范自动应用',
        '响应式布局适配',
        '品牌VI一键应用'
      ],
      color: 'from-purple-500 to-pink-500'
    },
    {
      id: 'lowcode-platform',
      name: '可视化低代码平台',
      icon: 'ri-drag-drop-line',
      category: 'lowcode',
      description: '拖拽组件+逻辑编排，团队全员协作快速组装APP或小程序',
      features: [
        '拖拽式组件库',
        '可视化逻辑编排',
        'APP/小程序一键生成',
        '实时预览与调试',
        '多端适配（iOS/Android/Web）'
      ],
      color: 'from-green-500 to-teal-500'
    }
  ];

  const tasks: Task[] = [
    {
      id: 't1',
      title: '用户登录模块算法优化',
      assignee: '张三',
      role: '技术极客',
      tool: '代码生成智能体',
      status: 'completed',
      progress: 100,
      deadline: '2024-01-15'
    },
    {
      id: 't2',
      title: '首页UI界面设计',
      assignee: '李四',
      role: '设计美学',
      tool: 'UI设计智能体',
      status: 'in-progress',
      progress: 65,
      deadline: '2024-01-16'
    },
    {
      id: 't3',
      title: '产品详情页组装',
      assignee: '王五',
      role: '商业操盘',
      tool: '可视化低代码平台',
      status: 'in-progress',
      progress: 40,
      deadline: '2024-01-17'
    },
    {
      id: 't4',
      title: '支付流程逻辑编排',
      assignee: '赵六',
      role: '技术极客',
      tool: '可视化低代码平台',
      status: 'pending',
      progress: 0,
      deadline: '2024-01-18'
    }
  ];

  const mvpComponents: MVPComponent[] = [
    {
      id: 'c1',
      name: '用户认证模块',
      type: '功能组件',
      icon: 'ri-shield-user-line',
      description: '包含注册、登录、密码找回、第三方登录'
    },
    {
      id: 'c2',
      name: '商品展示模块',
      type: '功能组件',
      icon: 'ri-shopping-bag-line',
      description: '商品列表、详情页、搜索、筛选、排序'
    },
    {
      id: 'c3',
      name: '购物车模块',
      type: '功能组件',
      icon: 'ri-shopping-cart-line',
      description: '添加商品、数量调整、优惠券、结算'
    },
    {
      id: 'c4',
      name: '订单管理模块',
      type: '功能组件',
      icon: 'ri-file-list-line',
      description: '订单创建、支付、物流跟踪、售后'
    },
    {
      id: 'c5',
      name: '个人中心模块',
      type: '功能组件',
      icon: 'ri-user-line',
      description: '个人信息、收货地址、订单历史、收藏'
    },
    {
      id: 'c6',
      name: '消息通知模块',
      type: '功能组件',
      icon: 'ri-notification-line',
      description: '系统通知、订单提醒、活动推送'
    }
  ];

  const handleGenerateCode = () => {
    if (!codePrompt.trim()) return;
    
    setIsGenerating(true);
    
    // 模拟AI生成代码
    setTimeout(() => {
      const mockCode = `// AI生成的代码 - ${codePrompt}

class UserAuthService {
  constructor() {
    this.tokenKey = 'auth_token';
    this.refreshTokenKey = 'refresh_token';
  }

  // 用户登录
  async login(username: string, password: string) {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      if (!response.ok) throw new Error('登录失败');
      
      const data = await response.json();
      this.setToken(data.token);
      this.setRefreshToken(data.refreshToken);
      
      return { success: true, user: data.user };
    } catch (error) {
      console.error('登录错误:', error);
      return { success: false, error: error.message };
    }
  }

  // Token管理
  setToken(token: string) {
    localStorage.setItem(this.tokenKey, token);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  // 刷新Token
  async refreshToken() {
    const refreshToken = localStorage.getItem(this.refreshTokenKey);
    if (!refreshToken) return false;
    
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });
      
      const data = await response.json();
      this.setToken(data.token);
      return true;
    } catch (error) {
      return false;
    }
  }

  // 登出
  logout() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.refreshTokenKey);
  }
}

export default new UserAuthService();`;
      
      setGeneratedCode(mockCode);
      setIsGenerating(false);
    }, 2000);
  };

  const handleGenerateDesign = () => {
    if (!designPrompt.trim()) return;
    
    setIsGenerating(true);
    
    // 模拟AI生成设计
    setTimeout(() => {
      setGeneratedDesign('https://readdy.ai/api/search-image?query=modern%20mobile%20app%20ui%20design%20with%20clean%20interface%20featuring%20product%20cards%20gradient%20background%20minimalist%20style%20high%20quality%20professional%20mockup&width=800&height=1200&seq=ui-design-001&orientation=portrait');
      setIsGenerating(false);
    }, 3000);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700 border-green-300';
      case 'in-progress': return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'pending': return 'bg-gray-100 text-gray-700 border-gray-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return '已完成';
      case 'in-progress': return '进行中';
      case 'pending': return '待开始';
      default: return '未知';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                <i className="ri-tools-line text-2xl text-white"></i>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">全栈工具链</h1>
                <p className="text-sm text-gray-600">低代码+AIGC赋能产品开发</p>
              </div>
            </div>
            <button className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:shadow-lg transition-all duration-300 flex items-center gap-2 whitespace-nowrap">
              <i className="ri-sparkling-line"></i>
              AI助手
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2 flex gap-2">
          <button
            onClick={() => setActiveTab('tools')}
            className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all duration-300 whitespace-nowrap ${
              activeTab === 'tools'
                ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <i className="ri-tools-line mr-2"></i>
            工具箱
          </button>
          <button
            onClick={() => setActiveTab('workspace')}
            className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all duration-300 whitespace-nowrap ${
              activeTab === 'workspace'
                ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <i className="ri-team-line mr-2"></i>
            协作工作台
          </button>
          <button
            onClick={() => setActiveTab('mvp')}
            className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all duration-300 whitespace-nowrap ${
              activeTab === 'mvp'
                ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <i className="ri-rocket-line mr-2"></i>
            MVP构建
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 pb-12">
        {/* 工具箱 */}
        {activeTab === 'tools' && (
          <div className="space-y-6">
            {/* 工具卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {tools.map((tool) => (
                <div
                  key={tool.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer"
                  onClick={() => setSelectedTool(tool)}
                >
                  <div className={`h-32 bg-gradient-to-br ${tool.color} flex items-center justify-center`}>
                    <i className={`${tool.icon} text-6xl text-white`}></i>
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{tool.name}</h3>
                    <p className="text-sm text-gray-600 mb-4">{tool.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        {tool.category === 'code' && '代码生成'}
                        {tool.category === 'design' && 'UI设计'}
                        {tool.category === 'lowcode' && '低代码'}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (tool.category === 'code') {
                            setShowCodeModal(true);
                          } else if (tool.category === 'design') {
                            setShowDesignModal(true);
                          }
                        }}
                        className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm rounded-lg hover:shadow-md transition-all duration-300 whitespace-nowrap"
                      >
                        立即使用
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 工具详情 */}
            {selectedTool && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                <div className="flex items-start gap-6">
                  <div className={`w-20 h-20 bg-gradient-to-br ${selectedTool.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <i className={`${selectedTool.icon} text-4xl text-white`}></i>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">{selectedTool.name}</h3>
                    <p className="text-gray-600 mb-6">{selectedTool.description}</p>
                    
                    <h4 className="text-lg font-semibold text-gray-900 mb-3">核心功能</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {selectedTool.features.map((feature, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                          <i className="ri-checkbox-circle-fill text-green-500"></i>
                          <span className="text-sm text-gray-700">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 使用指南 */}
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-8 border border-blue-200">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <i className="ri-lightbulb-line text-yellow-500"></i>
                使用指南
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-lg p-6 shadow-sm">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                    <span className="text-2xl font-bold text-blue-600">1</span>
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2">选择工具</h4>
                  <p className="text-sm text-gray-600">根据任务类型选择合适的AI工具</p>
                </div>
                <div className="bg-white rounded-lg p-6 shadow-sm">
                  <div className="w-12 h-12 bg-cyan-100 rounded-lg flex items-center justify-center mb-4">
                    <span className="text-2xl font-bold text-cyan-600">2</span>
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2">描述需求</h4>
                  <p className="text-sm text-gray-600">清晰描述你的需求和期望效果</p>
                </div>
                <div className="bg-white rounded-lg p-6 shadow-sm">
                  <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center mb-4">
                    <span className="text-2xl font-bold text-teal-600">3</span>
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2">优化迭代</h4>
                  <p className="text-sm text-gray-600">基于生成结果进行调整和优化</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 协作工作台 */}
        {activeTab === 'workspace' && (
          <div className="space-y-6">
            {/* 统计卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">总任务数</span>
                  <i className="ri-file-list-line text-blue-500 text-xl"></i>
                </div>
                <div className="text-3xl font-bold text-gray-900">12</div>
                <div className="text-xs text-gray-500 mt-1">本周新增 3 个</div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">进行中</span>
                  <i className="ri-time-line text-cyan-500 text-xl"></i>
                </div>
                <div className="text-3xl font-bold text-gray-900">5</div>
                <div className="text-xs text-gray-500 mt-1">平均进度 52%</div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">已完成</span>
                  <i className="ri-checkbox-circle-line text-green-500 text-xl"></i>
                </div>
                <div className="text-3xl font-bold text-gray-900">6</div>
                <div className="text-xs text-gray-500 mt-1">完成率 50%</div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">团队成员</span>
                  <i className="ri-team-line text-purple-500 text-xl"></i>
                </div>
                <div className="text-3xl font-bold text-gray-900">4</div>
                <div className="text-xs text-gray-500 mt-1">活跃度 85%</div>
              </div>
            </div>

            {/* 任务列表 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-gray-900">任务分工</h3>
                  <button className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:shadow-md transition-all duration-300 flex items-center gap-2 whitespace-nowrap">
                    <i className="ri-add-line"></i>
                    新建任务
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">任务名称</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">负责人</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">角色</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">使用工具</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">状态</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">进度</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">截止日期</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {tasks.map((task) => (
                      <tr key={task.id} className="hover:bg-gray-50 transition-colors duration-200">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{task.title}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                              {task.assignee.charAt(0)}
                            </div>
                            <span className="text-sm text-gray-900">{task.assignee}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-3 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                            {task.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-600">{task.tool}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 text-xs font-medium rounded-full border ${getStatusColor(task.status)}`}>
                            {getStatusText(task.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-2 w-24">
                              <div
                                className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${task.progress}%` }}
                              ></div>
                            </div>
                            <span className="text-xs text-gray-600 whitespace-nowrap">{task.progress}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-600">{task.deadline}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 协作提示 */}
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <i className="ri-team-line text-2xl text-white"></i>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">团队协作建议</h4>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-start gap-2">
                      <i className="ri-checkbox-circle-fill text-purple-500 mt-0.5"></i>
                      <span>理工科学生使用代码生成智能体优化算法逻辑、解决技术卡点</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <i className="ri-checkbox-circle-fill text-purple-500 mt-0.5"></i>
                      <span>文科学生使用UI设计智能体在48小时内渲染高保真界面与3D产品图</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <i className="ri-checkbox-circle-fill text-purple-500 mt-0.5"></i>
                      <span>团队全员使用可视化低代码平台，通过拖拽组件快速组装APP或小程序</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MVP构建 */}
        {activeTab === 'mvp' && (
          <div className="space-y-6">
            {/* MVP概览 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">最小可行性产品（MVP）</h3>
                  <p className="text-gray-600">快速组装核心功能，验证商业假设</p>
                </div>
                <button className="px-6 py-3 bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-lg hover:shadow-lg transition-all duration-300 flex items-center gap-2 whitespace-nowrap">
                  <i className="ri-rocket-line"></i>
                  一键生成APP
                </button>
              </div>

              {/* 进度条 */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">MVP构建进度</span>
                  <span className="text-sm font-medium text-gray-900">6/10 模块</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div className="bg-gradient-to-r from-green-500 to-teal-500 h-3 rounded-full transition-all duration-300" style={{ width: '60%' }}></div>
                </div>
              </div>

              {/* 组件库 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {mvpComponents.map((component) => (
                  <div
                    key={component.id}
                    className="border-2 border-dashed border-gray-300 rounded-xl p-6 hover:border-teal-500 hover:bg-teal-50 transition-all duration-300 cursor-pointer group"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-teal-500 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                        <i className={`${component.icon} text-2xl text-white`}></i>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 mb-1">{component.name}</h4>
                        <p className="text-xs text-gray-500 mb-2">{component.type}</p>
                        <p className="text-sm text-gray-600">{component.description}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-xs text-teal-600 font-medium">拖拽到画布</span>
                      <i className="ri-drag-move-line text-gray-400 group-hover:text-teal-500"></i>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 低代码编排 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-xl font-bold text-gray-900 mb-2">可视化逻辑编排</h3>
                <p className="text-sm text-gray-600">拖拽组件，连接逻辑，快速构建应用流程</p>
              </div>
              <div className="p-8 bg-gray-50 min-h-[400px] flex items-center justify-center">
                <div className="text-center">
                  <div className="w-24 h-24 bg-gradient-to-br from-green-500 to-teal-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <i className="ri-drag-drop-line text-5xl text-white"></i>
                  </div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">拖拽组件到此处</h4>
                  <p className="text-sm text-gray-600 mb-6">从左侧组件库拖拽模块，开始构建你的应用</p>
                  <button className="px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:border-teal-500 hover:text-teal-600 transition-all duration-300 whitespace-nowrap">
                    查看示例项目
                  </button>
                </div>
              </div>
            </div>

            {/* 多端适配 */}
            <div className="bg-gradient-to-br from-green-50 to-teal-50 rounded-xl p-8 border border-green-200">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <i className="ri-smartphone-line text-teal-500"></i>
                多端适配
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-lg p-6 shadow-sm">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center mb-4">
                    <i className="ri-smartphone-line text-3xl text-white"></i>
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2">iOS / Android</h4>
                  <p className="text-sm text-gray-600 mb-4">原生应用体验，支持App Store和Google Play发布</p>
                  <button className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-300 whitespace-nowrap">
                    生成移动端
                  </button>
                </div>
                <div className="bg-white rounded-lg p-6 shadow-sm">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mb-4">
                    <i className="ri-window-line text-3xl text-white"></i>
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2">Web应用</h4>
                  <p className="text-sm text-gray-600 mb-4">响应式设计，支持所有现代浏览器</p>
                  <button className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-300 whitespace-nowrap">
                    生成Web端
                  </button>
                </div>
                <div className="bg-white rounded-lg p-6 shadow-sm">
                  <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-teal-500 rounded-xl flex items-center justify-center mb-4">
                    <i className="ri-wechat-line text-3xl text-white"></i>
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2">小程序</h4>
                  <p className="text-sm text-gray-600 mb-4">微信/支付宝小程序，快速触达用户</p>
                  <button className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-300 whitespace-nowrap">
                    生成小程序
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 代码生成模态框 */}
      {showCodeModal ? (
        <AppModalPortal
          open
          onMaskClick={() => {
            setShowCodeModal(false);
            setCodePrompt('');
            setGeneratedCode('');
          }}
          zIndex={50}
          className="p-6"
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-gray-900">代码生成智能体</h3>
              <button
                onClick={() => {
                  setShowCodeModal(false);
                  setCodePrompt('');
                  setGeneratedCode('');
                }}
                className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors duration-300"
              >
                <i className="ri-close-line text-2xl text-gray-500"></i>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto py-1 px-6">
              <div className="space-y-6">
                {/* 输入区 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    描述你的需求
                  </label>
                  <textarea
                    value={codePrompt}
                    onChange={(e) => setCodePrompt(e.target.value)}
                    placeholder="例如：实现一个用户登录模块，包含Token管理、自动刷新、错误处理等功能..."
                    className="w-full h-32 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>

                {/* 生成按钮 */}
                <button
                  onClick={handleGenerateCode}
                  disabled={isGenerating || !codePrompt.trim()}
                  className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  {isGenerating ? (
                    <>
                      <i className="ri-loader-4-line animate-spin"></i>
                      AI生成中...
                    </>
                  ) : (
                    <>
                      <i className="ri-sparkling-line"></i>
                      生成代码
                    </>
                  )}
                </button>

                {/* 生成结果 */}
                {generatedCode && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        生成的代码
                      </label>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(generatedCode);
                        }}
                        className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-300 whitespace-nowrap"
                      >
                        <i className="ri-file-copy-line mr-1"></i>
                        复制代码
                      </button>
                    </div>
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                      <code>{generatedCode}</code>
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </AppModalPortal>
      ) : null}

      {/* UI设计生成模态框 */}
      {showDesignModal ? (
        <AppModalPortal
          open
          onMaskClick={() => {
            setShowDesignModal(false);
            setDesignPrompt('');
            setGeneratedDesign('');
          }}
          zIndex={50}
          className="p-6"
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-gray-900">UI设计智能体</h3>
              <button
                onClick={() => {
                  setShowDesignModal(false);
                  setDesignPrompt('');
                  setGeneratedDesign('');
                }}
                className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors duration-300"
              >
                <i className="ri-close-line text-2xl text-gray-500"></i>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto py-1 px-6">
              <div className="space-y-6">
                {/* 输入区 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    描述你的设计需求
                  </label>
                  <textarea
                    value={designPrompt}
                    onChange={(e) => setDesignPrompt(e.target.value)}
                    placeholder="例如：设计一个现代简约风格的移动端首页，包含产品卡片、渐变背景、极简风格..."
                    className="w-full h-32 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  />
                </div>

                {/* 生成按钮 */}
                <button
                  onClick={handleGenerateDesign}
                  disabled={isGenerating || !designPrompt.trim()}
                  className="w-full px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  {isGenerating ? (
                    <>
                      <i className="ri-loader-4-line animate-spin"></i>
                      AI设计中...
                    </>
                  ) : (
                    <>
                      <i className="ri-sparkling-line"></i>
                      生成设计
                    </>
                  )}
                </button>

                {/* 生成结果 */}
                {generatedDesign && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      生成的UI设计
                    </label>
                    <div className="border-2 border-gray-200 rounded-lg overflow-hidden">
                      <img
                        src={generatedDesign}
                        alt="AI生成的UI设计"
                        className="w-full h-auto"
                      />
                    </div>
                    <div className="mt-4 flex gap-3">
                      <button className="flex-1 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors duration-300 whitespace-nowrap">
                        <i className="ri-download-line mr-2"></i>
                        下载设计稿
                      </button>
                      <button className="flex-1 px-4 py-2 bg-pink-100 text-pink-700 rounded-lg hover:bg-pink-200 transition-colors duration-300 whitespace-nowrap">
                        <i className="ri-edit-line mr-2"></i>
                        继续优化
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </AppModalPortal>
      ) : null}
    </div>
  );
}
