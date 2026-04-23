import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import VersionControl, { Version } from '../../../components/feature/VersionControl';
import WarRoom from '../../business-model/components/WarRoom';

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

// 初始简短数据（未AI生成前）
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

// AI生成后的详细数据
const aiGeneratedCanvasData: BMCData = {
  keyPartnerships: '• 校园餐厅（提供餐品）\n• 便利店（零食饮料供应）\n• 物流公司（配送支持）\n• 学校后勤部门（场地支持）\n• 支付平台（微信、支付宝）',
  keyActivities: '• 订单智能分配与处理\n• 配送路径优化算法\n• 平台运营与维护\n• 商家对接与管理\n• 用户服务与反馈处理',
  valueProposition: '• 15分钟极速配送承诺\n• 低至2元的配送费\n• AI智能路径规划\n• 实时订单追踪\n• 会员积分奖励体系\n• 校园专属优惠',
  customerRelationships: '• 会员等级体系（普通/银卡/金卡）\n• 积分兑换优惠券\n• 个性化推荐算法\n• 7×24小时在线客服\n• 用户反馈快速响应机制',
  customerSegments: '• 主要：在校大学生（18-25岁）\n• 特征：注重效率和性价比\n• 行为：高频外卖需求\n• 痛点：配送慢、费用高\n• 偏好：移动支付、线上下单',
  keyResources: '• 专业配送团队（50人）\n• 自研智能调度系统\n• 校园商家资源网络\n• 用户数据与算法模型\n• 品牌与口碑',
  channels: '• 自有APP（主渠道）\n• 微信小程序\n• 校园地推活动\n• 社交媒体营销\n• 宿舍楼宣传栏\n• 学生社团合作',
  costStructure: '• 固定成本：技术开发、服务器、办公场地、基础工资（¥160,000/年）\n• 变动成本：配送提成、推广费用、包装材料、客服运营（¥140,000/年）\n• 总成本：¥300,000/年',
  revenueStreams: '• 配送费收入（¥180,000/年）\n• 商家佣金15%（¥216,000/年）\n• 会员月卡收入（¥36,000/年）\n• 平台广告收入（¥18,000/年）\n• 预计总收入：¥450,000/年',
};

interface CostItem {
  id: number;
  category: '固定成本' | '变动成本';
  name: string;
  amount: number;
}

interface RevenueItem {
  id: number;
  source: string;
  monthly: number;
}

const initialCosts: CostItem[] = [
  { id: 1, category: '固定成本', name: '技术开发', amount: 50000 },
  { id: 2, category: '固定成本', name: '服务器租赁', amount: 12000 },
  { id: 3, category: '固定成本', name: '办公场地', amount: 18000 },
  { id: 4, category: '固定成本', name: '基础人员工资', amount: 80000 },
  { id: 5, category: '变动成本', name: '配送人员提成', amount: 45000 },
  { id: 6, category: '变动成本', name: '市场推广费用', amount: 75000 },
  { id: 7, category: '变动成本', name: '包装材料', amount: 8000 },
  { id: 8, category: '变动成本', name: '客服运营', amount: 12000 },
];

const initialRevenues: RevenueItem[] = [
  { id: 1, source: '配送费收入', monthly: 15000 },
  { id: 2, source: '商家佣金', monthly: 18000 },
  { id: 3, source: '会员收入', monthly: 3000 },
  { id: 4, source: '广告收入', monthly: 1500 },
];

export default function BusinessModelModule() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'canvas' | 'swot' | 'marketing' | 'finance' | 'warroom'>('canvas');
  const [costs, setCosts] = useState<CostItem[]>(initialCosts);
  const [revenues, setRevenues] = useState<RevenueItem[]>(initialRevenues);
  const [editingCostId, setEditingCostId] = useState<number | null>(null);
  const [editingRevenueId, setEditingRevenueId] = useState<number | null>(null);
  const [showAddCost, setShowAddCost] = useState(false);
  const [newCostName, setNewCostName] = useState('');
  const [newCostAmount, setNewCostAmount] = useState('');
  const [newCostCategory, setNewCostCategory] = useState<'固定成本' | '变动成本'>('固定成本');
  const [toast, setToast] = useState('');

  // 商业画布状态
  const [canvasData, setCanvasData] = useState<BMCData>(initialCanvasData);
  const [isGenerating, setIsGenerating] = useState(false);
  // AI是否已生成（控制详情按钮显示）
  const [aiGenerated, setAiGenerated] = useState(false);

  const [showShareModal, setShowShareModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [shareLink, setShareLink] = useState('');

  const [swotData, setSwotData] = useState({
    strengths: '• 专注校园场景，了解用户需求\n• 技术团队实力强，算法优化能力突出\n• 配送路径短，效率高\n• 与校园餐厅关系良好',
    weaknesses: '• 初创团队，资金有限\n• 品牌知名度低，需要大量推广\n• 配送团队规模小\n• 缺乏成熟的运营经验',
    opportunities: '• 校园外卖市场持续增长\n• 学校支持学生创业项目\n• 智能配送技术日趋成熟\n• 用户对配送效率要求提高',
    threats: '• 美团、饿了么等巨头竞争激烈\n• 用户习惯难以改变\n• 食品安全监管趋严\n• 配送成本可能上升',
  });
  const [swotSaveTime, setSwotSaveTime] = useState('');
  const [isSavingSwot, setIsSavingSwot] = useState(false);

  const [marketingData, setMarketingData] = useState({
    product: '• 15分钟快速配送服务\n• 智能订单管理系统\n• 实时位置追踪\n• 会员积分体系',
    price: '• 配送费：2元起\n• 会员月卡：19.9元/月\n• 新用户首单免配送费\n• 满减优惠：满20减3',
    place: '• APP下载和使用\n• 微信小程序\n• 校园地推活动\n• 社交媒体营销\n• 宿舍楼宣传栏',
    promotion: '• 开学季大型推广活动\n• 社交媒体营销\n• KOL校园大使计划\n• 推荐有奖活动',
  });
  const [marketingSaveTime, setMarketingSaveTime] = useState('');
  const [isSavingMarketing, setIsSavingMarketing] = useState(false);

  const [versions, setVersions] = useState<Version[]>([]);
  const [currentVersion, setCurrentVersion] = useState(1);

  const handleSaveVersion = (summary: string) => {
    const newVersion: Version = {
      id: `version-${Date.now()}`,
      versionNumber: versions.length + 1,
      timestamp: new Date().toLocaleString('zh-CN'),
      operator: '当前用户',
      summary,
      data: { canvasData, swotData, marketingData, costs, revenues },
    };
    setVersions([...versions, newVersion]);
    setCurrentVersion(newVersion.versionNumber);
    showToast('版本已保存');
  };

  const handleRestore = (versionId: string) => {
    const version = versions.find(v => v.id === versionId);
    if (!version) return;
    const data = version.data;
    setCanvasData(data.canvasData || initialCanvasData);
    setSwotData(data.swotData || { strengths: '', weaknesses: '', opportunities: '', threats: '' });
    setMarketingData(data.marketingData || { product: '', price: '', place: '', promotion: '' });
    setCosts(data.costs || initialCosts);
    setRevenues(data.revenues || initialRevenues);
    setCurrentVersion(version.versionNumber);
    showToast(`已回撤到版本 v${version.versionNumber}`);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  // AI生成画布内容
  const handleAIGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setCanvasData(aiGeneratedCanvasData);
      setAiGenerated(true);
      setIsGenerating(false);
      showToast('AI已生成完整商业画布内容 ✓');
    }, 2000);
  };

  const handleSaveCanvas = () => {
    localStorage.setItem('bmc_canvas_data', JSON.stringify(canvasData));
    showToast('商业画布已保存 ✓');
  };

  const handleSaveSwot = () => {
    setIsSavingSwot(true);
    setTimeout(() => {
      localStorage.setItem('bmc_swot_data', JSON.stringify(swotData));
      const now = new Date();
      setSwotSaveTime(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`);
      setIsSavingSwot(false);
      showToast('SWOT分析已保存 ✓');
    }, 1000);
  };

  const handleSaveMarketing = () => {
    setIsSavingMarketing(true);
    setTimeout(() => {
      localStorage.setItem('bmc_marketing_data', JSON.stringify(marketingData));
      const now = new Date();
      setMarketingSaveTime(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`);
      setIsSavingMarketing(false);
      showToast('营销策略已保存 ✓');
    }, 1000);
  };

  const updateCanvasField = (field: keyof BMCData, value: string) => {
    setCanvasData(prev => ({ ...prev, [field]: value }));
  };

  const handleAIGenerateTab = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      showToast(`AI已优化${tabs.find(t => t.key === activeTab)?.label}内容 ✓`);
    }, 2000);
  };

  const handleTeamShare = () => {
    const link = `https://project.example.com/share/${Date.now()}`;
    setShareLink(link);
    setShowShareModal(true);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink);
    showToast('链接已复制到剪贴板 ✓');
  };

  const handleExportDoc = () => {
    setIsExporting(true);
    setTimeout(() => { setIsExporting(false); showToast('文档已导出为PDF ✓'); }, 1500);
  };

  const handleExportImage = () => {
    setIsExporting(true);
    setTimeout(() => { setIsExporting(false); showToast('已导出为图片 ✓'); }, 1500);
  };

  const handleCardDetail = (cardTitle: string) => {
    navigate(`/bmc-detail?card=${encodeURIComponent(cardTitle)}`);
  };

  const totalCost = costs.reduce((sum, c) => sum + c.amount, 0);
  const totalRevenue = revenues.reduce((sum, r) => sum + r.monthly * 12, 0);
  const profit = totalRevenue - totalCost;

  const updateCostAmount = (id: number, val: string) => {
    const num = parseInt(val.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(num)) setCosts(costs.map(c => (c.id === id ? { ...c, amount: num } : c)));
  };

  const updateRevenue = (id: number, val: string) => {
    const num = parseInt(val.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(num)) setRevenues(revenues.map(r => (r.id === id ? { ...r, monthly: num } : r)));
  };

  const deleteCost = (id: number) => setCosts(costs.filter(c => c.id !== id));
  const deleteRevenue = (id: number) => setRevenues(revenues.filter(r => r.id !== id));

  const handleAddCost = () => {
    if (!newCostName.trim() || !newCostAmount) return;
    setCosts([...costs, { id: Date.now(), category: newCostCategory, name: newCostName, amount: parseInt(newCostAmount) || 0 }]);
    setNewCostName('');
    setNewCostAmount('');
    setShowAddCost(false);
    showToast('成本项已添加 ✓');
  };

  const tabs = [
    { key: 'canvas' as const, label: '商业画布', icon: 'ri-layout-grid-line' },
    { key: 'swot' as const, label: 'SWOT分析', icon: 'ri-grid-line' },
    { key: 'marketing' as const, label: '营销策略', icon: 'ri-megaphone-line' },
    { key: 'finance' as const, label: '成本分析', icon: 'ri-money-dollar-circle-line' },
    { key: 'warroom' as const, label: '虚拟董事会', icon: 'ri-team-line', badge: 'AI' },
  ];

  // 画布卡片配置
  const cardConfigs = [
    { key: 'keyPartnerships' as keyof BMCData, label: '合作伙伴', icon: 'ri-team-line', gradient: 'from-orange-50 to-amber-50', border: 'border-orange-300', iconBg: 'from-orange-500 to-amber-500', ring: 'focus:ring-orange-500', ringBorder: 'border-orange-200', detailBorder: 'border-orange-400', detailText: 'text-orange-700', detailHover: 'hover:bg-orange-100' },
    { key: 'keyActivities' as keyof BMCData, label: '关键业务', icon: 'ri-settings-3-line', gradient: 'from-teal-50 to-cyan-50', border: 'border-teal-300', iconBg: 'from-teal-500 to-cyan-500', ring: 'focus:ring-teal-500', ringBorder: 'border-teal-200', detailBorder: 'border-teal-400', detailText: 'text-teal-700', detailHover: 'hover:bg-teal-100' },
    { key: 'valueProposition' as keyof BMCData, label: '价值主张', icon: 'ri-gift-line', gradient: 'from-green-50 to-emerald-50', border: 'border-green-400', iconBg: 'from-green-500 to-emerald-500', ring: 'focus:ring-green-500', ringBorder: 'border-green-200', detailBorder: 'border-green-400', detailText: 'text-green-700', detailHover: 'hover:bg-green-100' },
    { key: 'customerRelationships' as keyof BMCData, label: '客户关系', icon: 'ri-user-heart-line', gradient: 'from-pink-50 to-rose-50', border: 'border-pink-300', iconBg: 'from-pink-500 to-rose-500', ring: 'focus:ring-pink-500', ringBorder: 'border-pink-200', detailBorder: 'border-pink-400', detailText: 'text-pink-700', detailHover: 'hover:bg-pink-100' },
    { key: 'customerSegments' as keyof BMCData, label: '客户细分', icon: 'ri-group-line', gradient: 'from-cyan-50 to-blue-50', border: 'border-cyan-300', iconBg: 'from-cyan-500 to-blue-500', ring: 'focus:ring-cyan-500', ringBorder: 'border-cyan-200', detailBorder: 'border-cyan-400', detailText: 'text-cyan-700', detailHover: 'hover:bg-cyan-100' },
    { key: 'keyResources' as keyof BMCData, label: '核心资源', icon: 'ri-database-2-line', gradient: 'from-purple-50 to-pink-50', border: 'border-purple-300', iconBg: 'from-purple-500 to-pink-500', ring: 'focus:ring-purple-500', ringBorder: 'border-purple-200', detailBorder: 'border-purple-400', detailText: 'text-purple-700', detailHover: 'hover:bg-purple-100' },
    { key: 'channels' as keyof BMCData, label: '渠道通路', icon: 'ri-route-line', gradient: 'from-indigo-50 to-purple-50', border: 'border-indigo-300', iconBg: 'from-indigo-500 to-purple-500', ring: 'focus:ring-indigo-500', ringBorder: 'border-indigo-200', detailBorder: 'border-indigo-400', detailText: 'text-indigo-700', detailHover: 'hover:bg-indigo-100' },
    { key: 'costStructure' as keyof BMCData, label: '成本结构', icon: 'ri-money-dollar-box-line', gradient: 'from-red-50 to-rose-50', border: 'border-red-300', iconBg: 'from-red-500 to-rose-500', ring: 'focus:ring-red-500', ringBorder: 'border-red-200', detailBorder: 'border-red-400', detailText: 'text-red-700', detailHover: 'hover:bg-red-100' },
    { key: 'revenueStreams' as keyof BMCData, label: '收入来源', icon: 'ri-cash-line', gradient: 'from-emerald-50 to-green-50', border: 'border-emerald-400', iconBg: 'from-emerald-500 to-green-500', ring: 'focus:ring-emerald-500', ringBorder: 'border-emerald-200', detailBorder: 'border-emerald-400', detailText: 'text-emerald-700', detailHover: 'hover:bg-emerald-100' },
  ];

  const renderCanvasCard = (
    cfg: typeof cardConfigs[0],
    extraClass: string,
    rows: number
  ) => (
    <div className={`bg-gradient-to-br ${cfg.gradient} border-2 ${cfg.border} rounded-2xl p-5 flex flex-col ${extraClass}`}>
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-10 h-10 bg-gradient-to-br ${cfg.iconBg} rounded-xl flex items-center justify-center shrink-0`}>
          <i className={`${cfg.icon} text-white text-lg`}></i>
        </div>
        <h3 className="text-sm font-bold text-gray-900">{cfg.label}</h3>
      </div>
      <textarea
        value={canvasData[cfg.key]}
        onChange={(e) => updateCanvasField(cfg.key, e.target.value)}
        rows={rows}
        className={`flex-1 w-full px-3 py-2 text-xs border ${cfg.ringBorder} rounded-lg focus:outline-none focus:ring-2 ${cfg.ring} focus:border-transparent resize-none bg-white`}
        placeholder={`请输入${cfg.label}内容...`}
      />
      {aiGenerated && (
        <button
          onClick={() => handleCardDetail(cfg.label)}
          className={`mt-3 w-full py-2 border-2 ${cfg.detailBorder} ${cfg.detailText} text-xs font-bold rounded-lg ${cfg.detailHover} transition-all cursor-pointer whitespace-nowrap`}
        >
          详情
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <VersionControl
        versions={versions}
        currentVersion={currentVersion}
        onRestore={handleRestore}
        onSaveVersion={handleSaveVersion}
        moduleName="商业模式设计"
      />

      {/* 模块头部 */}
      <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-2xl shadow-xl p-8 text-white">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <i className="ri-briefcase-line text-3xl"></i>
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-1">商业模式设计</h2>
              <p className="text-white/80 text-sm">整合前期成果，构建完整商业模式</p>
            </div>
          </div>
          <span className="px-3 py-1.5 rounded-full text-sm font-semibold bg-white/20 text-white whitespace-nowrap">
            <i className="ri-loader-line mr-1.5"></i>进行中
          </span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
            <div className="text-2xl font-bold mb-1">0/9</div>
            <div className="text-sm text-white/70">知识点完成</div>
          </div>
          <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
            <div className="text-2xl font-bold mb-1">0/6</div>
            <div className="text-sm text-white/70">任务完成</div>
          </div>
          <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
            <div className="text-2xl font-bold mb-1">0%</div>
            <div className="text-sm text-white/70">整体进度</div>
          </div>
        </div>
      </div>

      {/* 标签页 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 px-5 py-4 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === tab.key ? 'text-pink-600 border-b-2 border-pink-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <i className={`${tab.icon} mr-2`}></i>
              {tab.label}
              {tab.badge && (
                <span className="ml-2 px-2 py-0.5 bg-gradient-to-r from-teal-500 to-emerald-500 text-white text-xs rounded-full">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-8">
          {activeTab === 'canvas' && (
            <div className="space-y-8">
              {/* 顶部操作栏 */}
              <div className="flex items-center justify-between gap-4">
                <div className="bg-pink-50 border border-pink-200 rounded-xl p-4 flex-1">
                  <h3 className="text-sm font-bold text-pink-900 mb-1">商业模式画布（BMC）</h3>
                  <p className="text-xs text-pink-700">
                    标准九宫格布局，点击任意格子直接编辑内容，支持AI一键生成完整画布
                  </p>
                </div>
                <button
                  onClick={handleAIGenerate}
                  disabled={isGenerating}
                  className="px-6 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 text-white text-sm font-bold rounded-xl hover:shadow-lg transition-all whitespace-nowrap cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <i className="ri-loader-4-line animate-spin"></i>
                      AI生成中...
                    </>
                  ) : (
                    <>
                      <i className="ri-sparkling-line"></i>
                      AI生成建议
                    </>
                  )}
                </button>
              </div>

              {/* 九宫格画布 — 无空白布局 */}
              {/* 第一行：合作伙伴(row-span-2) | 关键业务 | 价值主张(row-span-2) | 客户关系 | 客户细分(row-span-2) */}
              <div className="grid grid-cols-5 gap-4">
                {/* 合作伙伴 row-span-2 */}
                {renderCanvasCard(cardConfigs[0], 'row-span-2', 10)}

                {/* 关键业务 */}
                {renderCanvasCard(cardConfigs[1], '', 5)}

                {/* 价值主张 row-span-2 */}
                {renderCanvasCard(cardConfigs[2], 'row-span-2 shadow-lg', 10)}

                {/* 客户关系 */}
                {renderCanvasCard(cardConfigs[3], '', 5)}

                {/* 客户细分 row-span-2 */}
                {renderCanvasCard(cardConfigs[4], 'row-span-2', 10)}

                {/* 核心资源 */}
                {renderCanvasCard(cardConfigs[5], '', 5)}

                {/* 渠道通路 */}
                {renderCanvasCard(cardConfigs[6], '', 5)}

                {/* 第三行：成本结构 col-span-2 | 收入来源 col-span-3 */}
                {renderCanvasCard(cardConfigs[7], 'col-span-2', 4)}
                {renderCanvasCard(cardConfigs[8], 'col-span-3 shadow-lg', 4)}
              </div>

              {/* 底部保存按钮 */}
              <div className="flex gap-4">
                <button
                  onClick={handleSaveCanvas}
                  className="flex-1 px-6 py-3 bg-pink-500 text-white text-sm font-medium rounded-xl hover:bg-pink-600 transition-colors whitespace-nowrap cursor-pointer flex items-center justify-center gap-2"
                >
                  <i className="ri-save-line"></i>
                  保存画布
                </button>
                <button
                  onClick={() => showToast('画布已导出为图片 ✓')}
                  className="px-6 py-3 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-2"
                >
                  <i className="ri-image-line"></i>
                  导出图片
                </button>
              </div>

              {/* 底部操作工具栏 */}
              <div className="border-t border-gray-200 pt-6">
                <div className="grid grid-cols-4 gap-4">
                  <button
                    onClick={handleAIGenerate}
                    disabled={isGenerating}
                    className="px-6 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 text-white text-sm font-bold rounded-xl hover:shadow-lg transition-all whitespace-nowrap cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isGenerating ? <><i className="ri-loader-4-line animate-spin"></i>生成中...</> : <><i className="ri-sparkling-line"></i>AI生成</>}
                  </button>
                  <button onClick={handleTeamShare} className="px-6 py-3 bg-gradient-to-r from-teal-600 to-teal-700 text-white text-sm font-bold rounded-xl hover:shadow-lg transition-all whitespace-nowrap cursor-pointer flex items-center justify-center gap-2">
                    <i className="ri-share-line"></i>团队共享
                  </button>
                  <button onClick={handleExportDoc} disabled={isExporting} className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-bold rounded-xl hover:shadow-lg transition-all whitespace-nowrap cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                    {isExporting ? <><i className="ri-loader-4-line animate-spin"></i>导出中...</> : <><i className="ri-file-text-line"></i>导出文档</>}
                  </button>
                  <button onClick={handleExportImage} disabled={isExporting} className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-bold rounded-xl hover:shadow-lg transition-all whitespace-nowrap cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                    {isExporting ? <><i className="ri-loader-4-line animate-spin"></i>导出中...</> : <><i className="ri-image-line"></i>导出图片</>}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'swot' && (
            <div className="space-y-8">
              <div className="bg-pink-50 border border-pink-200 rounded-xl p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-pink-900 mb-3">SWOT分析指南</h3>
                    <p className="text-sm text-pink-700">从优势、劣势、机会、威胁四个维度全面分析项目</p>
                  </div>
                  {swotSaveTime && (
                    <div className="text-xs text-pink-600 flex items-center gap-1">
                      <i className="ri-time-line"></i>上次保存：{swotSaveTime}
                    </div>
                  )}
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                {[
                  { key: 'strengths' as const, title: '优势 (Strengths)', sub: '内部优势因素', icon: 'ri-thumb-up-line', color: 'from-green-500 to-emerald-500', border: 'border-green-200', ring: 'focus:ring-green-500' },
                  { key: 'weaknesses' as const, title: '劣势 (Weaknesses)', sub: '内部劣势因素', icon: 'ri-thumb-down-line', color: 'from-amber-500 to-orange-500', border: 'border-amber-200', ring: 'focus:ring-amber-500' },
                  { key: 'opportunities' as const, title: '机会 (Opportunities)', sub: '外部机会因素', icon: 'ri-lightbulb-line', color: 'from-teal-500 to-cyan-500', border: 'border-teal-200', ring: 'focus:ring-teal-500' },
                  { key: 'threats' as const, title: '威胁 (Threats)', sub: '外部威胁因素', icon: 'ri-alert-line', color: 'from-red-500 to-rose-500', border: 'border-red-200', ring: 'focus:ring-red-500' },
                ].map((item, i) => (
                  <div key={i} className={`bg-white border-2 ${item.border} rounded-xl p-6`}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-12 h-12 bg-gradient-to-br ${item.color} rounded-xl flex items-center justify-center`}>
                        <i className={`${item.icon} text-white text-xl`}></i>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">{item.title}</h3>
                        <p className="text-xs text-gray-500">{item.sub}</p>
                      </div>
                    </div>
                    <textarea rows={6} value={swotData[item.key]} onChange={(e) => setSwotData({ ...swotData, [item.key]: e.target.value })} className={`w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 ${item.ring} focus:border-transparent resize-none`} />
                  </div>
                ))}
              </div>
              <button onClick={handleSaveSwot} disabled={isSavingSwot} className="w-full px-6 py-3 bg-pink-500 text-white text-sm font-bold rounded-xl hover:bg-pink-600 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                {isSavingSwot ? <><i className="ri-loader-4-line animate-spin"></i>保存中...</> : <><i className="ri-save-line"></i>保存分析</>}
              </button>
              <div className="border-t border-gray-200 pt-6">
                <div className="grid grid-cols-4 gap-4">
                  <button onClick={handleAIGenerateTab} disabled={isGenerating} className="px-6 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 text-white text-sm font-bold rounded-xl hover:shadow-lg transition-all whitespace-nowrap cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                    {isGenerating ? <><i className="ri-loader-4-line animate-spin"></i>生成中...</> : <><i className="ri-sparkling-line"></i>AI生成</>}
                  </button>
                  <button onClick={handleTeamShare} className="px-6 py-3 bg-gradient-to-r from-teal-600 to-teal-700 text-white text-sm font-bold rounded-xl hover:shadow-lg transition-all whitespace-nowrap cursor-pointer flex items-center justify-center gap-2">
                    <i className="ri-share-line"></i>团队共享
                  </button>
                  <button onClick={handleExportDoc} disabled={isExporting} className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-bold rounded-xl hover:shadow-lg transition-all whitespace-nowrap cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                    {isExporting ? <><i className="ri-loader-4-line animate-spin"></i>导出中...</> : <><i className="ri-file-text-line"></i>导出文档</>}
                  </button>
                  <button onClick={handleExportImage} disabled={isExporting} className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-bold rounded-xl hover:shadow-lg transition-all whitespace-nowrap cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                    {isExporting ? <><i className="ri-loader-4-line animate-spin"></i>导出中...</> : <><i className="ri-image-line"></i>导出图片</>}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'marketing' && (
            <div className="space-y-8">
              <div className="bg-pink-50 border border-pink-200 rounded-xl p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-pink-900 mb-3">营销策略指南</h3>
                    <p className="text-sm text-pink-700">制定STP战略和4P策略，明确市场定位和推广方案</p>
                  </div>
                  {marketingSaveTime && (
                    <div className="text-xs text-pink-600 flex items-center gap-1">
                      <i className="ri-time-line"></i>上次保存：{marketingSaveTime}
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-6">4P营销策略</h3>
                <div className="grid md:grid-cols-2 gap-6">
                  {[
                    { key: 'product' as const, label: '产品 (Product)', icon: 'ri-product-hunt-line', color: 'from-teal-500 to-cyan-500', border: 'border-teal-200' },
                    { key: 'price' as const, label: '价格 (Price)', icon: 'ri-price-tag-3-line', color: 'from-green-500 to-emerald-500', border: 'border-green-200' },
                    { key: 'place' as const, label: '渠道 (Place)', icon: 'ri-store-3-line', color: 'from-purple-500 to-pink-500', border: 'border-purple-200' },
                    { key: 'promotion' as const, label: '推广 (Promotion)', icon: 'ri-megaphone-line', color: 'from-orange-500 to-amber-500', border: 'border-orange-200' },
                  ].map((item, i) => (
                    <div key={i} className={`border-2 ${item.border} rounded-xl p-6`}>
                      <div className="flex items-center gap-2 mb-4">
                        <div className={`w-10 h-10 bg-gradient-to-br ${item.color} rounded-lg flex items-center justify-center`}>
                          <i className={`${item.icon} text-white text-lg`}></i>
                        </div>
                        <h4 className="text-base font-bold text-gray-900">{item.label}</h4>
                      </div>
                      <textarea rows={5} value={marketingData[item.key]} onChange={(e) => setMarketingData({ ...marketingData, [item.key]: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none" />
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={handleSaveMarketing} disabled={isSavingMarketing} className="w-full px-6 py-3 bg-pink-500 text-white text-sm font-bold rounded-xl hover:bg-pink-600 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                {isSavingMarketing ? <><i className="ri-loader-4-line animate-spin"></i>保存中...</> : <><i className="ri-save-line"></i>保存策略</>}
              </button>
              <div className="border-t border-gray-200 pt-6">
                <div className="grid grid-cols-4 gap-4">
                  <button onClick={handleAIGenerateTab} disabled={isGenerating} className="px-6 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 text-white text-sm font-bold rounded-xl hover:shadow-lg transition-all whitespace-nowrap cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                    {isGenerating ? <><i className="ri-loader-4-line animate-spin"></i>生成中...</> : <><i className="ri-sparkling-line"></i>AI生成</>}
                  </button>
                  <button onClick={handleTeamShare} className="px-6 py-3 bg-gradient-to-r from-teal-600 to-teal-700 text-white text-sm font-bold rounded-xl hover:shadow-lg transition-all whitespace-nowrap cursor-pointer flex items-center justify-center gap-2">
                    <i className="ri-share-line"></i>团队共享
                  </button>
                  <button onClick={handleExportDoc} disabled={isExporting} className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-bold rounded-xl hover:shadow-lg transition-all whitespace-nowrap cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                    {isExporting ? <><i className="ri-loader-4-line animate-spin"></i>导出中...</> : <><i className="ri-file-text-line"></i>导出文档</>}
                  </button>
                  <button onClick={handleExportImage} disabled={isExporting} className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-bold rounded-xl hover:shadow-lg transition-all whitespace-nowrap cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                    {isExporting ? <><i className="ri-loader-4-line animate-spin"></i>导出中...</> : <><i className="ri-image-line"></i>导出图片</>}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'finance' && (
            <div className="space-y-8">
              <div className="bg-pink-50 border border-pink-200 rounded-xl p-6">
                <h3 className="text-base font-bold text-pink-900 mb-3">成本分析 — 可自由调整</h3>
                <p className="text-sm text-pink-700">点击金额数字即可直接编辑，修改后汇总数据实时更新。可添加或删除成本项。</p>
              </div>
              <div className="bg-gradient-to-br from-pink-500 to-rose-500 rounded-2xl p-8 text-white">
                <div className="grid md:grid-cols-3 gap-8">
                  <div>
                    <div className="text-sm text-white/80 mb-2">总成本</div>
                    <div className="text-3xl font-bold">¥{totalCost.toLocaleString()}</div>
                    <div className="text-xs text-white/80 mt-1">首年运营成本</div>
                  </div>
                  <div>
                    <div className="text-sm text-white/80 mb-2">预计收入</div>
                    <div className="text-3xl font-bold">¥{totalRevenue.toLocaleString()}</div>
                    <div className="text-xs text-white/80 mt-1">首年营收目标</div>
                  </div>
                  <div>
                    <div className="text-sm text-white/80 mb-2">预计利润</div>
                    <div className={`text-3xl font-bold ${profit < 0 ? 'text-red-200' : ''}`}>
                      {profit < 0 ? '-' : ''}¥{Math.abs(profit).toLocaleString()}
                    </div>
                    <div className="text-xs text-white/80 mt-1">{profit >= 0 ? '首年净利润' : '首年亏损'}</div>
                  </div>
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                  <h3 className="text-base font-bold text-gray-900">成本明细</h3>
                  <button onClick={() => setShowAddCost(true)} className="px-4 py-2 bg-pink-500 text-white text-sm font-medium rounded-lg hover:bg-pink-600 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1">
                    <i className="ri-add-line"></i>添加成本项
                  </button>
                </div>
                <div className="divide-y divide-gray-100">
                  {(['固定成本', '变动成本'] as const).map(cat => (
                    <div key={cat}>
                      <div className="px-5 py-3 bg-gray-50 flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">{cat}</span>
                        <span className="text-sm font-bold text-gray-700">小计：¥{costs.filter(c => c.category === cat).reduce((s, c) => s + c.amount, 0).toLocaleString()}</span>
                      </div>
                      {costs.filter(c => c.category === cat).map(cost => (
                        <div key={cost.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 group">
                          <span className="flex-1 text-sm text-gray-700">{cost.name}</span>
                          {editingCostId === cost.id ? (
                            <input type="number" defaultValue={cost.amount} autoFocus onBlur={e => { updateCostAmount(cost.id, e.target.value); setEditingCostId(null); }} onKeyDown={e => { if (e.key === 'Enter') { updateCostAmount(cost.id, (e.target as HTMLInputElement).value); setEditingCostId(null); } }} className="w-32 px-3 py-1.5 text-sm border-2 border-pink-400 rounded-lg focus:outline-none text-right font-bold" />
                          ) : (
                            <button onClick={() => setEditingCostId(cost.id)} className="w-32 px-3 py-1.5 text-sm text-right font-bold text-gray-900 rounded-lg hover:bg-pink-50 hover:text-pink-700 transition-colors cursor-pointer group-hover:ring-1 group-hover:ring-pink-200" title="点击编辑">
                              ¥{cost.amount.toLocaleString()}<i className="ri-edit-line ml-1 text-xs text-gray-400 opacity-0 group-hover:opacity-100"></i>
                            </button>
                          )}
                          <button onClick={() => deleteCost(cost.id)} className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all cursor-pointer">
                            <i className="ri-delete-bin-line text-sm"></i>
                          </button>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="p-5 border-b border-gray-100">
                  <h3 className="text-base font-bold text-gray-900">收入来源明细</h3>
                  <p className="text-xs text-gray-500 mt-1">点击月均金额可直接修改，年度收入自动计算</p>
                </div>
                <div className="divide-y divide-gray-100">
                  {revenues.map(rev => (
                    <div key={rev.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 group">
                      <span className="flex-1 text-sm text-gray-700">{rev.source}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400">月均</span>
                        {editingRevenueId === rev.id ? (
                          <input type="number" defaultValue={rev.monthly} autoFocus onBlur={e => { updateRevenue(rev.id, e.target.value); setEditingRevenueId(null); }} onKeyDown={e => { if (e.key === 'Enter') { updateRevenue(rev.id, (e.target as HTMLInputElement).value); setEditingRevenueId(null); } }} className="w-28 px-3 py-1.5 text-sm border-2 border-green-400 rounded-lg focus:outline-none text-right font-bold" />
                        ) : (
                          <button onClick={() => setEditingRevenueId(rev.id)} className="w-28 px-3 py-1.5 text-sm text-right font-bold text-gray-900 rounded-lg hover:bg-green-50 hover:text-green-700 transition-colors cursor-pointer group-hover:ring-1 group-hover:ring-green-200" title="点击编辑">
                            ¥{rev.monthly.toLocaleString()}<i className="ri-edit-line ml-1 text-xs text-gray-400 opacity-0 group-hover:opacity-100"></i>
                          </button>
                        )}
                        <span className="text-xs text-gray-400">年度</span>
                        <span className="w-28 text-sm font-bold text-green-700 text-right">¥{(rev.monthly * 12).toLocaleString()}</span>
                      </div>
                      <button onClick={() => deleteRevenue(rev.id)} className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all cursor-pointer">
                        <i className="ri-delete-bin-line text-sm"></i>
                      </button>
                    </div>
                  ))}
                </div>
                <div className="px-5 py-4 bg-green-50 border-t border-green-100 flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-900">年度总收入</span>
                  <span className="text-lg font-bold text-green-700">¥{totalRevenue.toLocaleString()}</span>
                </div>
              </div>
              <button onClick={() => showToast('财务数据已保存 ✓')} className="w-full px-6 py-3 bg-pink-500 text-white text-sm font-medium rounded-xl hover:bg-pink-600 transition-colors whitespace-nowrap cursor-pointer flex items-center justify-center gap-2">
                <i className="ri-save-line"></i>保存财务数据
              </button>
            </div>
          )}

          {activeTab === 'warroom' && <WarRoom />}
        </div>
      </div>

      {/* 可获得能力点 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-5 flex items-center gap-2">
          <i className="ri-medal-line text-teal-600"></i>可获得能力点
        </h3>
        <div className="flex flex-wrap gap-3">
          {['商业思维', '战略规划'].map((ap, idx) => (
            <div key={idx} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-pink-200 bg-pink-50">
              <i className="ri-medal-fill text-base text-pink-500"></i>
              <span className="text-sm font-semibold text-pink-700">{ap}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 添加成本项弹窗 */}
      {showAddCost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">添加成本项</h3>
              <button onClick={() => setShowAddCost(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 cursor-pointer">
                <i className="ri-close-line text-gray-500"></i>
              </button>
            </div>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">成本类型</label>
                <select value={newCostCategory} onChange={e => setNewCostCategory(e.target.value as '固定成本' | '变动成本')} className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500">
                  <option value="固定成本">固定成本</option>
                  <option value="变动成本">变动成本</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">成本名称 <span className="text-red-500">*</span></label>
                <input type="text" value={newCostName} onChange={e => setNewCostName(e.target.value)} placeholder="如：法律顾问费" className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">金额（元）<span className="text-red-500">*</span></label>
                <input type="number" value={newCostAmount} onChange={e => setNewCostAmount(e.target.value)} placeholder="请输入金额" min={0} className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowAddCost(false)} className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 cursor-pointer whitespace-nowrap">取消</button>
              <button onClick={handleAddCost} disabled={!newCostName.trim() || !newCostAmount} className="flex-1 px-4 py-2.5 bg-pink-500 text-white text-sm font-medium rounded-lg hover:bg-pink-600 cursor-pointer disabled:opacity-50 whitespace-nowrap">添加</button>
            </div>
          </div>
        </div>
      )}

      {/* 团队共享弹窗 */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">团队共享</h3>
              <button onClick={() => setShowShareModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 cursor-pointer">
                <i className="ri-close-line text-gray-500"></i>
              </button>
            </div>
            <div className="flex justify-center mb-6">
              <div className="w-48 h-48 bg-gray-100 rounded-xl flex items-center justify-center border-2 border-gray-200">
                <div className="text-center">
                  <i className="ri-qr-code-line text-6xl text-gray-400 mb-2"></i>
                  <p className="text-xs text-gray-500">扫码查看</p>
                </div>
              </div>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">共享链接</label>
              <div className="flex gap-2">
                <input type="text" value={shareLink} readOnly className="flex-1 px-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none" />
                <button onClick={handleCopyLink} className="px-4 py-2.5 bg-teal-500 text-white text-sm font-medium rounded-lg hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-2">
                  <i className="ri-file-copy-line"></i>复制
                </button>
              </div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
              <i className="ri-checkbox-circle-fill text-green-500 text-xl shrink-0 mt-0.5"></i>
              <div>
                <p className="text-sm font-medium text-green-900 mb-1">已共享给团队成员</p>
                <p className="text-xs text-green-700">团队成员可通过链接或二维码查看和编辑此内容</p>
              </div>
            </div>
            <button onClick={() => setShowShareModal(false)} className="w-full mt-6 px-6 py-3 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap">关闭</button>
          </div>
        </div>
      )}

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
