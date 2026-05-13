import { Link } from 'react-router-dom';
import { useState } from 'react';
import WarRoom from './components/WarRoom';

// 九宫格商业模式画布数据结构
interface BMCData {
  keyPartnerships: string;
  keyActivities: string;
  valueProposition: string;
  customerRelationships: string;
  customerSegments: string;
  keyResources: string;
  channels: string;
  costStructure: string;
  revenueStreams: string;
}

const initialCanvasData: BMCData = {
  keyPartnerships: '校园餐厅、便利店、物流公司',
  keyActivities: '订单处理、配送管理、平台运营',
  valueProposition: '15分钟快速配送，低配送费，智能路径优化',
  customerRelationships: '会员体系、积分奖励、个性化推荐',
  customerSegments: '大学生群体，18-25岁，注重效率和性价比',
  keyResources: '配送团队、技术平台、商家资源',
  channels: 'APP、微信小程序、校园推广',
  costStructure: '人员成本、技术开发、市场推广',
  revenueStreams: '配送费收入、商家佣金、广告收入',
};

export default function BusinessModel() {
  const [activeTab, setActiveTab] = useState<'canvas' | 'swot' | 'marketing' | 'finance' | 'warroom'>('canvas');
  const [canvasData, setCanvasData] = useState<BMCData>(initialCanvasData);
  const [isGenerating, setIsGenerating] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  // AI生成画布内容
  const handleAIGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setCanvasData({
        keyPartnerships: '• 校园餐厅（提供餐品）\n• 便利店（零食饮料供应）\n• 物流公司（配送支持）\n• 学校后勤部门（场地支持）\n• 支付平台（微信、支付宝）',
        keyActivities: '• 订单智能分配与处理\n• 配送路径优化算法\n• 平台运营与维护\n• 商家对接与管理\n• 用户服务与反馈处理',
        valueProposition: '• 15分钟极速配送承诺\n• 低至2元的配送费\n• AI智能路径规划\n• 实时订单追踪\n• 会员积分奖励体系\n• 校园专属优惠',
        customerRelationships: '• 会员等级体系（普通/银卡/金卡）\n• 积分兑换优惠券\n• 个性化推荐算法\n• 7×24小时在线客服\n• 用户反馈快速响应机制',
        customerSegments: '• 主要：在校大学生（18-25岁）\n• 特征：注重效率和性价比\n• 行为：高频外卖需求\n• 痛点：配送慢、费用高\n• 偏好：移动支付、线上下单',
        keyResources: '• 专业配送团队（50人）\n• 自研智能调度系统\n• 校园商家资源网络\n• 用户数据与算法模型\n• 品牌与口碑',
        channels: '• 自有APP（主渠道）\n• 微信小程序\n• 校园地推活动\n• 社交媒体营销\n• 宿舍楼宣传栏\n• 学生社团合作',
        costStructure: '• 固定成本：技术开发、服务器、办公场地、基础工资（¥160,000/年）\n• 变动成本：配送提成、推广费用、包装材料、客服运营（¥140,000/年）\n• 总成本：¥300,000/年',
        revenueStreams: '• 配送费收入（¥180,000/年）\n• 商家佣金15%（¥216,000/年）\n• 会员月卡收入（¥36,000/年）\n• 平台广告收入（¥18,000/年）\n• 预计总收入：¥450,000/年',
      });
      setIsGenerating(false);
      showToast('AI已生成完整商业画布内容 ✓');
    }, 2000);
  };

  // 保存画布
  const handleSaveCanvas = () => {
    localStorage.setItem('bmc_canvas_data', JSON.stringify(canvasData));
    showToast('商业画布已保存 ✓');
  };

  // 更新画布某个格子的内容
  const updateCanvasField = (field: keyof BMCData, value: string) => {
    setCanvasData(prev => ({ ...prev, [field]: value }));
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
            <span className="text-sm text-gray-600">商业模式设计</span>
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
          <h1 className="text-4xl font-bold text-gray-900 mb-4">商业模式设计</h1>
          <p className="text-lg text-gray-600">整合前期成果，构建完整商业模式</p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-8">
          <div className="flex border-b border-gray-100 overflow-x-auto">
            <button
              onClick={() => setActiveTab('canvas')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'canvas' ? 'text-green-600 border-b-2 border-green-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <i className="ri-layout-grid-line mr-2"></i>
              商业画布
            </button>
            <button
              onClick={() => setActiveTab('swot')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'swot' ? 'text-green-600 border-b-2 border-green-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <i className="ri-grid-line mr-2"></i>
              SWOT分析
            </button>
            <button
              onClick={() => setActiveTab('marketing')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'marketing' ? 'text-green-600 border-b-2 border-green-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <i className="ri-megaphone-line mr-2"></i>
              营销策略
            </button>
            <button
              onClick={() => setActiveTab('finance')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'finance' ? 'text-green-600 border-b-2 border-green-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <i className="ri-money-dollar-circle-line mr-2"></i>
              成本分析
            </button>
            <button
              onClick={() => setActiveTab('warroom')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'warroom' ? 'text-teal-600 border-b-2 border-teal-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <i className="ri-team-line mr-2"></i>
              虚拟董事会
              <span className="ml-2 px-2 py-0.5 bg-gradient-to-r from-teal-500 to-emerald-500 text-white text-xs rounded-full">AI</span>
            </button>
          </div>

          <div className={activeTab === 'warroom' ? '' : 'p-8'}>
            {activeTab === 'warroom' && (
              <WarRoom />
            )}
            
            {activeTab !== 'warroom' && (
              <div className="text-center py-20">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <i className="ri-tools-line text-4xl text-gray-400"></i>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">功能开发中</h3>
                <p className="text-sm text-gray-500">该功能正在开发中，敬请期待</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2">
          <i className="ri-checkbox-circle-fill text-green-400"></i>
          <span className="text-sm font-medium">{toast}</span>
        </div>
      )}
    </div>
  );
}