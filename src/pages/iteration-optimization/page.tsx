import { Link } from 'react-router-dom';
import { useState } from 'react';

interface IterationCycle {
  id: number;
  cycle: number;
  phase: 'build' | 'measure' | 'learn';
  startDate: string;
  endDate: string;
  status: 'completed' | 'in-progress' | 'pending';
  metrics: {
    clickRate: number;
    retentionRate: number;
    nps: number;
    conversionRate: number;
  };
  decision: 'optimize' | 'pivot' | 'pending';
  insights: string[];
}

interface DataMetric {
  name: string;
  value: number;
  target: number;
  trend: 'up' | 'down' | 'stable';
  change: number;
}

export default function IterationOptimization() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'cycles' | 'market' | 'decision' | 'retrospective'>('dashboard');
  const [currentCycle, setCurrentCycle] = useState(1);
  const [showRetrospectiveModal, setShowRetrospectiveModal] = useState(false);

  const iterations: IterationCycle[] = [
    {
      id: 1,
      cycle: 1,
      phase: 'learn',
      startDate: '2024-01-10',
      endDate: '2024-01-24',
      status: 'completed',
      metrics: {
        clickRate: 12.5,
        retentionRate: 35.2,
        nps: 42,
        conversionRate: 8.3
      },
      decision: 'optimize',
      insights: [
        '用户对核心功能认可度高，但首次使用门槛较高',
        '15分钟配送承诺是最大亮点，需强化宣传',
        '价格敏感度高于预期，需调整定价策略'
      ]
    },
    {
      id: 2,
      cycle: 2,
      phase: 'measure',
      startDate: '2024-01-25',
      endDate: '2024-02-08',
      status: 'in-progress',
      metrics: {
        clickRate: 18.7,
        retentionRate: 48.6,
        nps: 58,
        conversionRate: 12.1
      },
      decision: 'pending',
      insights: []
    },
    {
      id: 3,
      cycle: 3,
      phase: 'build',
      startDate: '2024-02-09',
      endDate: '2024-02-23',
      status: 'pending',
      metrics: {
        clickRate: 0,
        retentionRate: 0,
        nps: 0,
        conversionRate: 0
      },
      decision: 'pending',
      insights: []
    }
  ];

  const dataMetrics: DataMetric[] = [
    {
      name: '点击率',
      value: 18.7,
      target: 20,
      trend: 'up',
      change: 6.2
    },
    {
      name: '留存率',
      value: 48.6,
      target: 50,
      trend: 'up',
      change: 13.4
    },
    {
      name: '净推荐值(NPS)',
      value: 58,
      target: 60,
      trend: 'up',
      change: 16
    },
    {
      name: '转化率',
      value: 12.1,
      target: 15,
      trend: 'up',
      change: 3.8
    }
  ];

  const marketTestResults = [
    {
      id: 1,
      testName: '校园A区试点',
      userCount: 156,
      duration: '7天',
      status: 'completed',
      avgRating: 4.2,
      feedback: '用户反馈积极，配送速度满意度高',
      keyFindings: ['高峰期配送压力大', '价格接受度良好', '界面操作简单']
    },
    {
      id: 2,
      testName: '校园B区试点',
      userCount: 203,
      duration: '7天',
      status: 'in-progress',
      avgRating: 4.5,
      feedback: '用户活跃度高，复购率超预期',
      keyFindings: ['会员制度受欢迎', '配送范围需扩大', '客服响应及时']
    }
  ];

  const decisionOptions = [
    {
      type: 'optimize',
      title: '优化迭代',
      description: '核心指标达标，继续优化现有方案',
      icon: 'ri-arrow-up-circle-line',
      color: 'from-green-500 to-emerald-500',
      conditions: ['关键指标达标率 ≥ 80%', '用户反馈积极', 'NPS ≥ 50'],
      actions: ['优化用户体验细节', '扩大市场投放', '增加功能模块']
    },
    {
      type: 'pivot',
      title: '方向转型',
      description: '核心指标未达标，需调整商业模式或目标用户',
      icon: 'ri-refresh-line',
      color: 'from-orange-500 to-amber-500',
      conditions: ['关键指标达标率 &lt; 60%', '用户流失率高', '商业模式不可持续'],
      actions: ['重新定义目标用户', '调整价值主张', '改变盈利模式']
    },
    {
      type: 'continue',
      title: '继续观察',
      description: '数据尚不充分，需继续收集更多样本',
      icon: 'ri-eye-line',
      color: 'from-blue-500 to-indigo-500',
      conditions: ['样本量不足', '测试周期较短', '数据波动较大'],
      actions: ['延长测试周期', '扩大样本量', '增加数据维度']
    }
  ];

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
            <span className="text-sm text-gray-600">迭代优化与数据看板</span>
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
          <div className="flex items-center gap-4 mb-4">
            <h1 className="text-4xl font-bold text-gray-900">迭代优化与数据看板</h1>
            <span className="px-4 py-1.5 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-sm font-bold rounded-full whitespace-nowrap">
              构建-衡量-学习
            </span>
          </div>
          <p className="text-lg text-gray-600">基于数据驱动的敏捷迭代，实现产品持续优化与增长</p>
        </div>

        {/* Iteration Progress */}
        <div className="bg-gradient-to-br from-teal-500 to-cyan-500 rounded-2xl p-8 text-white mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">当前迭代周期：第 {currentCycle} 轮</h2>
              <p className="text-white/90 text-sm">已完成 1 轮迭代，进行中 1 轮，待开始 1 轮</p>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold mb-1">33%</div>
              <div className="text-sm text-white/80">总体完成度</div>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {iterations.map((iteration) => (
              <div
                key={iteration.id}
                className={`bg-white/10 backdrop-blur-sm rounded-xl p-4 border-2 transition-all cursor-pointer ${
                  iteration.status === 'in-progress' ? 'border-white' : 'border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium">第 {iteration.cycle} 轮</span>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap ${
                    iteration.status === 'completed' ? 'bg-green-500/20 text-white' :
                    iteration.status === 'in-progress' ? 'bg-white/20 text-white' :
                    'bg-white/10 text-white/60'
                  }`}>
                    {iteration.status === 'completed' ? '✓ 已完成' :
                     iteration.status === 'in-progress' ? '⏳ 进行中' : '⏸ 待开始'}
                  </span>
                </div>
                <div className="text-xs text-white/80 mb-2">
                  {iteration.startDate} ~ {iteration.endDate}
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    iteration.phase === 'build' ? 'bg-blue-500/20' :
                    iteration.phase === 'measure' ? 'bg-purple-500/20' :
                    'bg-orange-500/20'
                  }`}>
                    <i className={`${
                      iteration.phase === 'build' ? 'ri-hammer-line' :
                      iteration.phase === 'measure' ? 'ri-bar-chart-line' :
                      'ri-lightbulb-line'
                    } text-white text-sm`}></i>
                  </div>
                  <span className="text-sm font-medium">
                    {iteration.phase === 'build' ? '构建阶段' :
                     iteration.phase === 'measure' ? '衡量阶段' : '学习阶段'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-8">
          <div className="flex border-b border-gray-100 overflow-x-auto">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'dashboard' ? 'text-teal-600 border-b-2 border-teal-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <i className="ri-dashboard-line mr-2"></i>
              数据看板
            </button>
            <button
              onClick={() => setActiveTab('cycles')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'cycles' ? 'text-teal-600 border-b-2 border-teal-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <i className="ri-refresh-line mr-2"></i>
              迭代循环
            </button>
            <button
              onClick={() => setActiveTab('market')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'market' ? 'text-teal-600 border-b-2 border-teal-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <i className="ri-store-line mr-2"></i>
              市场投放
            </button>
            <button
              onClick={() => setActiveTab('decision')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'decision' ? 'text-teal-600 border-b-2 border-teal-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <i className="ri-compass-line mr-2"></i>
              决策引擎
            </button>
            <button
              onClick={() => setActiveTab('retrospective')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'retrospective' ? 'text-teal-600 border-b-2 border-teal-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <i className="ri-file-list-3-line mr-2"></i>
              败因复盘
            </button>
          </div>

          <div className="p-8">
            {/* 数据看板 */}
            {activeTab === 'dashboard' && (
              <div className="space-y-8">
                <div className="bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-200 rounded-xl p-6">
                  <div className="flex items-start gap-4">
                    <i className="ri-bar-chart-box-line text-teal-600 text-2xl mt-1"></i>
                    <div>
                      <h4 className="text-base font-bold text-gray-900 mb-2">核心指标实时监测</h4>
                      <p className="text-sm text-gray-600">追踪点击率、留存率、净推荐值、转化率等关键数据，为决策提供依据</p>
                    </div>
                  </div>
                </div>

                {/* 核心指标卡片 */}
                <div className="grid md:grid-cols-4 gap-6">
                  {dataMetrics.map((metric, index) => (
                    <div key={index} className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm text-gray-600">{metric.name}</span>
                        <div className={`flex items-center gap-1 text-xs font-medium ${
                          metric.trend === 'up' ? 'text-green-600' :
                          metric.trend === 'down' ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          <i className={`${
                            metric.trend === 'up' ? 'ri-arrow-up-line' :
                            metric.trend === 'down' ? 'ri-arrow-down-line' : 'ri-subtract-line'
                          }`}></i>
                          <span>{metric.change > 0 ? '+' : ''}{metric.change}%</span>
                        </div>
                      </div>
                      <div className="mb-4">
                        <div className="text-3xl font-bold text-gray-900 mb-1">
                          {metric.value}{metric.name.includes('率') ? '%' : ''}
                        </div>
                        <div className="text-xs text-gray-500">目标: {metric.target}{metric.name.includes('率') ? '%' : ''}</div>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            metric.value >= metric.target ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                            metric.value >= metric.target * 0.8 ? 'bg-gradient-to-r from-teal-500 to-cyan-500' :
                            'bg-gradient-to-r from-orange-500 to-amber-500'
                          }`}
                          style={{ width: `${Math.min((metric.value / metric.target) * 100, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 趋势图表 */}
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-6">指标趋势分析</h3>
                  <div className="space-y-6">
                    {dataMetrics.map((metric, index) => (
                      <div key={index}>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-gray-900">{metric.name}</span>
                          <span className="text-sm text-gray-600">
                            当前: {metric.value}{metric.name.includes('率') ? '%' : ''} / 目标: {metric.target}{metric.name.includes('率') ? '%' : ''}
                          </span>
                        </div>
                        <div className="relative h-12 bg-gray-50 rounded-lg overflow-hidden">
                          <div className="absolute inset-0 flex items-center">
                            <div className="w-full h-2 bg-gray-200 rounded-full mx-4">
                              <div 
                                className="h-full bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full transition-all"
                                style={{ width: `${Math.min((metric.value / metric.target) * 100, 100)}%` }}
                              ></div>
                            </div>
                          </div>
                          <div className="absolute inset-0 flex items-center justify-between px-4 text-xs text-gray-500">
                            <span>0</span>
                            <span>{metric.target}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 用户行为分析 */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-6">用户行为热力图</h3>
                    <div className="space-y-4">
                      {[
                        { action: '首页浏览', count: 1250, percentage: 100 },
                        { action: '商品搜索', count: 856, percentage: 68 },
                        { action: '加入购物车', count: 523, percentage: 42 },
                        { action: '提交订单', count: 312, percentage: 25 },
                        { action: '完成支付', count: 151, percentage: 12 }
                      ].map((item, index) => (
                        <div key={index}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-700">{item.action}</span>
                            <span className="text-sm font-medium text-gray-900">{item.count}次 ({item.percentage}%)</span>
                          </div>
                          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full"
                              style={{ width: `${item.percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-6">用户反馈分析</h3>
                    <div className="space-y-4">
                      {[
                        { category: '非常满意', count: 89, color: 'from-green-500 to-emerald-500' },
                        { category: '比较满意', count: 124, color: 'from-teal-500 to-cyan-500' },
                        { category: '一般', count: 45, color: 'from-yellow-500 to-amber-500' },
                        { category: '不满意', count: 12, color: 'from-orange-500 to-red-500' }
                      ].map((item, index) => (
                        <div key={index} className="flex items-center gap-4">
                          <div className="w-24 text-sm text-gray-700">{item.category}</div>
                          <div className="flex-1 h-8 bg-gray-100 rounded-lg overflow-hidden">
                            <div 
                              className={`h-full bg-gradient-to-r ${item.color} flex items-center justify-end px-3 text-white text-sm font-medium`}
                              style={{ width: `${(item.count / 270) * 100}%` }}
                            >
                              {item.count}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 迭代循环 */}
            {activeTab === 'cycles' && (
              <div className="space-y-8">
                <div className="bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-200 rounded-xl p-6">
                  <div className="flex items-start gap-4">
                    <i className="ri-refresh-line text-teal-600 text-2xl mt-1"></i>
                    <div>
                      <h4 className="text-base font-bold text-gray-900 mb-2">三次完整迭代循环</h4>
                      <p className="text-sm text-gray-600">每个迭代周期包含"构建-衡量-学习"三个阶段，持续优化产品方案</p>
                    </div>
                  </div>
                </div>

                {/* 迭代流程图 */}
                <div className="bg-white border border-gray-200 rounded-xl p-8">
                  <h3 className="text-lg font-bold text-gray-900 mb-8 text-center">迭代循环流程</h3>
                  <div className="flex items-center justify-center gap-8">
                    <div className="flex flex-col items-center">
                      <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center mb-4">
                        <i className="ri-hammer-line text-white text-3xl"></i>
                      </div>
                      <h4 className="text-base font-bold text-gray-900 mb-2">构建 Build</h4>
                      <p className="text-sm text-gray-600 text-center max-w-[200px]">开发最小可行性产品，快速实现核心功能</p>
                    </div>
                    <i className="ri-arrow-right-line text-3xl text-gray-400"></i>
                    <div className="flex flex-col items-center">
                      <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mb-4">
                        <i className="ri-bar-chart-line text-white text-3xl"></i>
                      </div>
                      <h4 className="text-base font-bold text-gray-900 mb-2">衡量 Measure</h4>
                      <p className="text-sm text-gray-600 text-center max-w-[200px]">投放市场收集数据，监测核心指标表现</p>
                    </div>
                    <i className="ri-arrow-right-line text-3xl text-gray-400"></i>
                    <div className="flex flex-col items-center">
                      <div className="w-24 h-24 bg-gradient-to-br from-orange-500 to-amber-500 rounded-full flex items-center justify-center mb-4">
                        <i className="ri-lightbulb-line text-white text-3xl"></i>
                      </div>
                      <h4 className="text-base font-bold text-gray-900 mb-2">学习 Learn</h4>
                      <p className="text-sm text-gray-600 text-center max-w-[200px]">分析数据洞察，决策优化或转型方向</p>
                    </div>
                  </div>
                </div>

                {/* 迭代详情列表 */}
                <div className="space-y-6">
                  {iterations.map((iteration) => (
                    <div key={iteration.id} className="bg-white border-2 border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all">
                      <div className="flex items-start justify-between mb-6">
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-xl flex items-center justify-center text-white text-2xl font-bold">
                            {iteration.cycle}
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-gray-900 mb-1">第 {iteration.cycle} 轮迭代</h3>
                            <p className="text-sm text-gray-600">{iteration.startDate} ~ {iteration.endDate}</p>
                          </div>
                        </div>
                        <span className={`px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap ${
                          iteration.status === 'completed' ? 'bg-green-100 text-green-700' :
                          iteration.status === 'in-progress' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {iteration.status === 'completed' ? '✓ 已完成' :
                           iteration.status === 'in-progress' ? '⏳ 进行中' : '⏸ 待开始'}
                        </span>
                      </div>

                      <div className="grid md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="text-xs text-gray-600 mb-1">点击率</div>
                          <div className="text-2xl font-bold text-gray-900">{iteration.metrics.clickRate}%</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="text-xs text-gray-600 mb-1">留存率</div>
                          <div className="text-2xl font-bold text-gray-900">{iteration.metrics.retentionRate}%</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="text-xs text-gray-600 mb-1">净推荐值</div>
                          <div className="text-2xl font-bold text-gray-900">{iteration.metrics.nps}</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="text-xs text-gray-600 mb-1">转化率</div>
                          <div className="text-2xl font-bold text-gray-900">{iteration.metrics.conversionRate}%</div>
                        </div>
                      </div>

                      {iteration.insights.length > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                          <h4 className="text-sm font-bold text-amber-900 mb-3">核心洞察</h4>
                          <ul className="space-y-2">
                            {iteration.insights.map((insight, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-sm text-amber-800">
                                <i className="ri-lightbulb-flash-line mt-0.5"></i>
                                <span>{insight}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {iteration.decision !== 'pending' && (
                        <div className="mt-4 flex items-center gap-2">
                          <span className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap ${
                            iteration.decision === 'optimize' ? 'bg-green-100 text-green-700' :
                            'bg-orange-100 text-orange-700'
                          }`}>
                            {iteration.decision === 'optimize' ? '✓ 优化迭代' : '🔄 方向转型'}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 市场投放 */}
            {activeTab === 'market' && (
              <div className="space-y-8">
                <div className="bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-200 rounded-xl p-6">
                  <div className="flex items-start gap-4">
                    <i className="ri-store-line text-teal-600 text-2xl mt-1"></i>
                    <div>
                      <h4 className="text-base font-bold text-gray-900 mb-2">模拟市场/真实用户群投放</h4>
                      <p className="text-sm text-gray-600">将MVP投放至目标用户群，收集真实使用数据和反馈</p>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <button className="bg-white border-2 border-dashed border-gray-300 rounded-xl p-8 hover:border-teal-500 hover:bg-teal-50 transition-all text-center cursor-pointer">
                    <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <i className="ri-add-line text-white text-3xl"></i>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">创建新测试</h3>
                    <p className="text-sm text-gray-600">选择目标用户群，设置测试参数</p>
                  </button>

                  {marketTestResults.map((test) => (
                    <div key={test.id} className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-gray-900 mb-1">{test.testName}</h3>
                          <p className="text-sm text-gray-600">测试周期: {test.duration}</p>
                        </div>
                        <span className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap ${
                          test.status === 'completed' ? 'bg-green-100 text-green-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {test.status === 'completed' ? '✓ 已完成' : '⏳ 进行中'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="text-xs text-gray-600 mb-1">参与用户</div>
                          <div className="text-xl font-bold text-gray-900">{test.userCount}</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="text-xs text-gray-600 mb-1">平均评分</div>
                          <div className="text-xl font-bold text-gray-900 flex items-center gap-1">
                            {test.avgRating}
                            <i className="ri-star-fill text-yellow-500 text-sm"></i>
                          </div>
                        </div>
                      </div>

                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                        <p className="text-sm text-blue-900">{test.feedback}</p>
                      </div>

                      <div>
                        <h4 className="text-sm font-bold text-gray-900 mb-2">关键发现</h4>
                        <ul className="space-y-2">
                          {test.keyFindings.map((finding, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                              <i className="ri-checkbox-circle-line text-teal-500 mt-0.5"></i>
                              <span>{finding}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <button className="w-full mt-4 px-4 py-2 bg-teal-500 text-white text-sm font-medium rounded-lg hover:bg-teal-600 transition-colors whitespace-nowrap cursor-pointer">
                        <i className="ri-file-chart-line mr-2"></i>
                        查看详细报告
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 决策引擎 */}
            {activeTab === 'decision' && (
              <div className="space-y-8">
                <div className="bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-200 rounded-xl p-6">
                  <div className="flex items-start gap-4">
                    <i className="ri-compass-line text-teal-600 text-2xl mt-1"></i>
                    <div>
                      <h4 className="text-base font-bold text-gray-900 mb-2">优化/转型决策引擎</h4>
                      <p className="text-sm text-gray-600">基于数据分析结果，AI智能推荐最优决策路径</p>
                    </div>
                  </div>
                </div>

                {/* 决策建议 */}
                <div className="bg-gradient-to-br from-teal-500 to-cyan-500 rounded-2xl p-8 text-white">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                      <i className="ri-robot-line text-3xl"></i>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold mb-2">AI决策建议</h3>
                      <p className="text-white/90 text-sm">基于第2轮迭代数据分析</p>
                    </div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                    <div className="flex items-start gap-3 mb-4">
                      <i className="ri-lightbulb-flash-line text-2xl mt-1"></i>
                      <div>
                        <h4 className="text-lg font-bold mb-2">建议：继续优化迭代</h4>
                        <p className="text-white/90 text-sm leading-relaxed">
                          核心指标表现良好，点击率提升6.2%，留存率提升13.4%，NPS达到58分。
                          用户反馈积极，建议继续优化现有方案，重点提升转化率和用户体验细节。
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="px-3 py-1 bg-white/20 rounded-full whitespace-nowrap">置信度: 85%</span>
                      <span className="px-3 py-1 bg-white/20 rounded-full whitespace-nowrap">风险等级: 低</span>
                    </div>
                  </div>
                </div>

                {/* 决策选项 */}
                <div className="grid md:grid-cols-3 gap-6">
                  {decisionOptions.map((option, index) => (
                    <div key={index} className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all">
                      <div className={`w-14 h-14 bg-gradient-to-br ${option.color} rounded-xl flex items-center justify-center mb-4`}>
                        <i className={`${option.icon} text-white text-2xl`}></i>
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 mb-2">{option.title}</h3>
                      <p className="text-sm text-gray-600 mb-4">{option.description}</p>
                      
                      <div className="mb-4">
                        <h4 className="text-xs font-bold text-gray-900 mb-2">触发条件</h4>
                        <ul className="space-y-1">
                          {option.conditions.map((condition, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-xs text-gray-700">
                              <i className="ri-checkbox-circle-line text-teal-500 mt-0.5"></i>
                              <span dangerouslySetInnerHTML={{ __html: condition }}></span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h4 className="text-xs font-bold text-gray-900 mb-2">行动建议</h4>
                        <ul className="space-y-1">
                          {option.actions.map((action, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-xs text-gray-700">
                              <i className="ri-arrow-right-s-line text-gray-400 mt-0.5"></i>
                              <span>{action}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 决策记录 */}
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-6">历史决策记录</h3>
                  <div className="space-y-4">
                    <div className="flex items-start gap-4 pb-4 border-b border-gray-100">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <i className="ri-arrow-up-circle-line text-green-600 text-lg"></i>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-bold text-gray-900">第1轮：优化迭代</h4>
                          <span className="text-xs text-gray-500">2024-01-24</span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                          基于用户反馈，优化了新手引导流程，简化了下单步骤，调整了定价策略
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>决策人: 张明</span>
                          <span>•</span>
                          <span>执行状态: 已完成</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 败因复盘 */}
            {activeTab === 'retrospective' && (
              <div className="space-y-8">
                <div className="bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-200 rounded-xl p-6">
                  <div className="flex items-start gap-4">
                    <i className="ri-file-list-3-line text-teal-600 text-2xl mt-1"></i>
                    <div>
                      <h4 className="text-base font-bold text-gray-900 mb-2">败因复盘报告</h4>
                      <p className="text-sm text-gray-600">即使项目失败，精准定位失败原因也能获得加分，鼓励从失败中学习</p>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
                  <div className="flex items-start gap-3">
                    <i className="ri-lightbulb-line text-amber-600 text-xl mt-0.5"></i>
                    <div>
                      <h4 className="text-sm font-bold text-amber-900 mb-2">败因复盘加分机制</h4>
                      <p className="text-sm text-amber-800">
                        提交高质量的《试错复盘报告》，精准定位失败原因并提出改进方案，可获得额外加分。
                        鼓励团队从失败中学习，培养韧性思维。
                      </p>
                    </div>
                  </div>
                </div>

                {/* 复盘报告模板 */}
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-gray-900">复盘报告模板</h3>
                    <button 
                      onClick={() => setShowRetrospectiveModal(true)}
                      className="px-5 py-2 bg-teal-500 text-white text-sm font-medium rounded-lg hover:bg-teal-600 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <i className="ri-add-line mr-2"></i>
                      创建复盘报告
                    </button>
                  </div>

                  <div className="space-y-6">
                    {[
                      {
                        section: '1. 项目背景与目标',
                        description: '简述项目初衷、目标用户、核心价值主张',
                        icon: 'ri-file-text-line',
                        color: 'blue'
                      },
                      {
                        section: '2. 关键指标表现',
                        description: '列出核心指标的目标值与实际值，分析差距',
                        icon: 'ri-bar-chart-line',
                        color: 'purple'
                      },
                      {
                        section: '3. 失败原因分析',
                        description: '基于数据，精准定位失败的根本原因（市场、产品、团队、执行等）',
                        icon: 'ri-search-line',
                        color: 'red'
                      },
                      {
                        section: '4. 关键决策复盘',
                        description: '回顾重要决策节点，分析哪些决策是错误的，为什么',
                        icon: 'ri-compass-line',
                        color: 'orange'
                      },
                      {
                        section: '5. 经验教训总结',
                        description: '从失败中学到了什么，哪些经验可以应用到未来项目',
                        icon: 'ri-lightbulb-line',
                        color: 'yellow'
                      },
                      {
                        section: '6. 改进方案建议',
                        description: '如果重新开始，会如何调整方案和策略',
                        icon: 'ri-refresh-line',
                        color: 'green'
                      }
                    ].map((item, index) => (
                      <div key={index} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                        <div className={`w-10 h-10 bg-${item.color}-100 rounded-lg flex items-center justify-center flex-shrink-0`}>
                          <i className={`${item.icon} text-${item.color}-600 text-lg`}></i>
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-bold text-gray-900 mb-1">{item.section}</h4>
                          <p className="text-sm text-gray-600">{item.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 优秀复盘案例 */}
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-6">优秀复盘案例</h3>
                  <div className="space-y-4">
                    <div className="border border-gray-200 rounded-xl p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h4 className="text-base font-bold text-gray-900 mb-1">校园二手交易平台 - 转型复盘</h4>
                          <p className="text-sm text-gray-600">团队：创新科技小组 · 2023-12-15</p>
                        </div>
                        <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full whitespace-nowrap">
                          优秀 +10分
                        </span>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4 mb-4">
                        <p className="text-sm text-gray-700 leading-relaxed">
                          <strong>核心失败原因：</strong>我们最初定位为"综合性二手交易平台"，但数据显示用户最活跃的品类是教材和电子产品。
                          我们在第2轮迭代时果断转型为"校园教材循环平台"，聚焦单一品类，留存率从28%提升至65%。
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-600">关键词:</span>
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full whitespace-nowrap">精准定位</span>
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full whitespace-nowrap">数据驱动</span>
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full whitespace-nowrap">快速转型</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 复盘报告创建弹窗 */}
      {showRetrospectiveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6" onClick={() => setShowRetrospectiveModal(false)}>
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 z-10">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-gray-900">创建败因复盘报告</h3>
                <button
                  onClick={() => setShowRetrospectiveModal(false)}
                  className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                >
                  <i className="ri-close-line text-2xl"></i>
                </button>
              </div>
            </div>
            <div className="p-8 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">报告标题</label>
                <input
                  type="text"
                  placeholder="例如：校园配送平台第2轮迭代失败复盘"
                  className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">1. 项目背景与目标</label>
                <textarea
                  rows={4}
                  placeholder="简述项目初衷、目标用户、核心价值主张..."
                  className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">2. 关键指标表现</label>
                <textarea
                  rows={4}
                  placeholder="列出核心指标的目标值与实际值，分析差距..."
                  className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">3. 失败原因分析 ⭐</label>
                <textarea
                  rows={6}
                  placeholder="基于数据，精准定位失败的根本原因（市场、产品、团队、执行等）..."
                  className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">4. 关键决策复盘</label>
                <textarea
                  rows={4}
                  placeholder="回顾重要决策节点，分析哪些决策是错误的，为什么..."
                  className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">5. 经验教训总结</label>
                <textarea
                  rows={4}
                  placeholder="从失败中学到了什么，哪些经验可以应用到未来项目..."
                  className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">6. 改进方案建议</label>
                <textarea
                  rows={4}
                  placeholder="如果重新开始，会如何调整方案和策略..."
                  className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setShowRetrospectiveModal(false)}
                  className="flex-1 px-6 py-3 bg-teal-500 text-white text-sm font-medium rounded-xl hover:bg-teal-600 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <i className="ri-save-line mr-2"></i>
                  提交复盘报告
                </button>
                <button
                  onClick={() => setShowRetrospectiveModal(false)}
                  className="px-6 py-3 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
