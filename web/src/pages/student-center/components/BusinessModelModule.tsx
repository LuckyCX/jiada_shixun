import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { message, Modal, Spin } from 'antd';
import VersionControl, { Version } from '../../../components/feature/VersionControl';
import WarRoom from '../../business-model/components/WarRoom';
import {
  fetchBusinessModelWorkspace,
  generateBusinessModelBmcAi,
  generateBusinessModelFinanceItemsAi,
  generateBusinessModelMarketingAi,
  generateBusinessModelSwotAi,
  saveBusinessModelBmc,
  saveBusinessModelWorkspacePartial,
  type BmcPayload,
  type BusinessModelWorkspacePayload,
  type GenerateBusinessModelBmcAiError,
} from '../../../lib/studentBusinessModelApi';

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

function emptyBmcData(): BMCData {
  return {
    keyPartnerships: '',
    keyActivities: '',
    valueProposition: '',
    customerRelationships: '',
    customerSegments: '',
    keyResources: '',
    channels: '',
    costStructure: '',
    revenueStreams: '',
  };
}

function bmcFromPayload(bmc?: BmcPayload): BMCData {
  const base = emptyBmcData();
  if (!bmc) return base;
  return { ...base, ...bmc };
}

function hasBmcContent(data: BMCData) {
  return Object.values(data).some((v) => String(v || '').trim());
}

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

const emptySwot = { strengths: '', weaknesses: '', opportunities: '', threats: '' };
const emptyMarketing = { product: '', price: '', place: '', promotion: '' };

function savedAtLabel(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('zh-CN');
}

function applyPayloadToState(d: BusinessModelWorkspacePayload, setters: {
  setSwotData: (v: typeof emptySwot) => void;
  setMarketingData: (v: typeof emptyMarketing) => void;
  setCosts: (v: CostItem[]) => void;
  setRevenues: (v: RevenueItem[]) => void;
  setSwotSaveTime: (v: string) => void;
  setMarketingSaveTime: (v: string) => void;
  setFinanceSaveTime: (v: string) => void;
}) {
  setters.setSwotData(d.swot || emptySwot);
  setters.setMarketingData(d.marketing || emptyMarketing);
  setters.setCosts((d.finance?.costs || []) as CostItem[]);
  setters.setRevenues((d.finance?.revenues || []) as RevenueItem[]);
  setters.setSwotSaveTime(savedAtLabel(d.swotSavedAt || ''));
  setters.setMarketingSaveTime(savedAtLabel(d.marketingSavedAt || ''));
  setters.setFinanceSaveTime(savedAtLabel(d.financeSavedAt || ''));
}

type BusinessModelModuleProps = {
  classId?: string;
  studentDisplayName?: string;
  isTeamLeader?: boolean;
  trainingEnded?: boolean;
  onTaskComplete?: () => void;
  onBusinessTabProgress?: (doneCount: number) => void;
};

export default function BusinessModelModule({
  classId,
  studentDisplayName = '同学',
  isTeamLeader = false,
  trainingEnded = false,
  onTaskComplete,
  onBusinessTabProgress,
}: BusinessModelModuleProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'canvas' | 'swot' | 'marketing' | 'finance' | 'warroom'>('swot');
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [aiSwotRunning, setAiSwotRunning] = useState(false);
  const [aiMarketingRunning, setAiMarketingRunning] = useState(false);
  const [aiFinanceRunning, setAiFinanceRunning] = useState(false);
  const [costs, setCosts] = useState<CostItem[]>([]);
  const [revenues, setRevenues] = useState<RevenueItem[]>([]);
  const [editingCostId, setEditingCostId] = useState<number | null>(null);
  const [editingRevenueId, setEditingRevenueId] = useState<number | null>(null);
  const [showAddCost, setShowAddCost] = useState(false);
  const [newCostName, setNewCostName] = useState('');
  const [newCostAmount, setNewCostAmount] = useState('');
  const [newCostCategory, setNewCostCategory] = useState<'固定成本' | '变动成本'>('固定成本');
  const [toast, setToast] = useState('');

  const [canvasData, setCanvasData] = useState<BMCData>(emptyBmcData);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploadingCanvas, setIsUploadingCanvas] = useState(false);
  const [aiGenerated, setAiGenerated] = useState(false);
  const [workspaceIsTeamLeader, setWorkspaceIsTeamLeader] = useState(false);

  const [showShareModal, setShowShareModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [shareLink, setShareLink] = useState('');

  const [swotData, setSwotData] = useState(emptySwot);
  const [swotSaveTime, setSwotSaveTime] = useState('');
  const [isSavingSwot, setIsSavingSwot] = useState(false);

  const [marketingData, setMarketingData] = useState(emptyMarketing);
  const [marketingSaveTime, setMarketingSaveTime] = useState('');
  const [isSavingMarketing, setIsSavingMarketing] = useState(false);
  const [financeSaveTime, setFinanceSaveTime] = useState('');
  const [isSavingFinance, setIsSavingFinance] = useState(false);
  const [warRoomRecordSaved, setWarRoomRecordSaved] = useState(false);
  const [canvasTabUploaded, setCanvasTabUploaded] = useState(false);

  const canCaptain = workspaceIsTeamLeader || isTeamLeader;

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
    setCanvasData(data.canvasData ? bmcFromPayload(data.canvasData as BmcPayload) : emptyBmcData());
    setSwotData(data.swotData || emptySwot);
    setMarketingData(data.marketingData || emptyMarketing);
    setCosts(data.costs || []);
    setRevenues(data.revenues || []);
    setCurrentVersion(version.versionNumber);
    showToast(`已回撤到版本 v${version.versionNumber}`);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  useEffect(() => {
    if (!classId?.trim()) return;
    let cancelled = false;
    (async () => {
      setWorkspaceLoading(true);
      try {
        const d = await fetchBusinessModelWorkspace(classId.trim());
        if (cancelled) return;
        applyPayloadToState(d, {
          setSwotData,
          setMarketingData,
          setCosts,
          setRevenues,
          setSwotSaveTime,
          setMarketingSaveTime,
          setFinanceSaveTime,
        });
        const sid = d.studentId || '';
        const myRecord = (d.warRoomTeamRecords || []).find((r) => r.studentId === sid);
        setWarRoomRecordSaved(Boolean(myRecord && myRecord.filledCount >= 9));
        setCanvasData(bmcFromPayload(d.bmc));
        setCanvasTabUploaded(Boolean(d.bmcCanvasSavedAt));
        setWorkspaceIsTeamLeader(Boolean(d.isTeamLeader));
        setAiGenerated(Boolean(d.bmcCanvasGeneratedAt) || hasBmcContent(bmcFromPayload(d.bmc)));
      } catch (e) {
        if (!cancelled) message.error(e instanceof Error ? e.message : '加载失败');
      } finally {
        if (!cancelled) setWorkspaceLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [classId]);

  useEffect(() => {
    if (!onBusinessTabProgress) return;
    let done = 0;
    if (swotSaveTime) done += 1;
    if (marketingSaveTime) done += 1;
    if (financeSaveTime) done += 1;
    if (warRoomRecordSaved) done += 1;
    if (canvasTabUploaded) done += 1;
    onBusinessTabProgress(done);
    if (done >= 5) onTaskComplete?.();
  }, [
    swotSaveTime,
    marketingSaveTime,
    financeSaveTime,
    warRoomRecordSaved,
    canvasTabUploaded,
    onBusinessTabProgress,
    onTaskComplete,
  ]);

  const applyWorkspaceBmc = (d: BusinessModelWorkspacePayload) => {
    setCanvasData(bmcFromPayload(d.bmc));
    setCanvasTabUploaded(Boolean(d.bmcCanvasSavedAt));
    setWorkspaceIsTeamLeader(Boolean(d.isTeamLeader));
    setAiGenerated(Boolean(d.bmcCanvasGeneratedAt) || hasBmcContent(bmcFromPayload(d.bmc)));
  };

  const handleAIGenerate = async () => {
    if (!classId?.trim()) {
      message.warning('缺少班级信息');
      return;
    }
    if (!canCaptain) {
      message.info('仅队长可生成');
      return;
    }
    setIsGenerating(true);
    try {
      const d = await generateBusinessModelBmcAi(classId.trim());
      applyWorkspaceBmc(d);
      showToast('已生成团队商业画布');
    } catch (e) {
      const err = e as GenerateBusinessModelBmcAiError;
      if (err.missingMembers?.length) {
        const names = err.missingMembers.map((m) => m.studentName).join('、');
        Modal.warning({
          title: '暂无法生成',
          content: `${names} 还没参与虚拟董事会讨论，快去通知他完成画布填充吧`,
        });
      } else {
        message.error(err instanceof Error ? err.message : '生成失败');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUploadCanvas = async () => {
    if (!classId?.trim()) {
      message.warning('缺少班级信息');
      return;
    }
    if (!canCaptain) {
      message.info('仅队长可上传');
      return;
    }
    if (!hasBmcContent(canvasData)) {
      message.warning('请先生成或填写画布内容');
      return;
    }
    setIsUploadingCanvas(true);
    try {
      const d = await saveBusinessModelBmc(classId.trim(), canvasData);
      applyWorkspaceBmc(d);
      setCanvasTabUploaded(true);
      message.success('商业画布已上传');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '上传失败');
    } finally {
      setIsUploadingCanvas(false);
    }
  };

  const handleSaveSwot = async () => {
    if (!classId?.trim()) {
      message.warning('缺少班级信息');
      return;
    }
    setIsSavingSwot(true);
    try {
      const d = await saveBusinessModelWorkspacePartial(classId.trim(), { swot: swotData });
      applyPayloadToState(d, {
        setSwotData,
        setMarketingData,
        setCosts,
        setRevenues,
        setSwotSaveTime,
        setMarketingSaveTime,
        setFinanceSaveTime,
      });
      showToast('SWOT分析已保存 ✓');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setIsSavingSwot(false);
    }
  };

  const handleSaveMarketing = async () => {
    if (!classId?.trim()) {
      message.warning('缺少班级信息');
      return;
    }
    setIsSavingMarketing(true);
    try {
      const d = await saveBusinessModelWorkspacePartial(classId.trim(), { marketing: marketingData });
      applyPayloadToState(d, {
        setSwotData,
        setMarketingData,
        setCosts,
        setRevenues,
        setSwotSaveTime,
        setMarketingSaveTime,
        setFinanceSaveTime,
      });
      showToast('营销策略已保存 ✓');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setIsSavingMarketing(false);
    }
  };

  const handleSaveFinance = async () => {
    if (!classId?.trim()) {
      message.warning('缺少班级信息');
      return;
    }
    setIsSavingFinance(true);
    try {
      const d = await saveBusinessModelWorkspacePartial(classId.trim(), {
        finance: { costs, revenues },
      });
      applyPayloadToState(d, {
        setSwotData,
        setMarketingData,
        setCosts,
        setRevenues,
        setSwotSaveTime,
        setMarketingSaveTime,
        setFinanceSaveTime,
      });
      showToast('财务数据已保存 ✓');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setIsSavingFinance(false);
    }
  };

  const handleAiSwot = async () => {
    if (!classId?.trim()) {
      message.warning('缺少班级信息');
      return;
    }
    setAiSwotRunning(true);
    try {
      const d = await generateBusinessModelSwotAi(classId.trim());
      applyPayloadToState(d, {
        setSwotData,
        setMarketingData,
        setCosts,
        setRevenues,
        setSwotSaveTime,
        setMarketingSaveTime,
        setFinanceSaveTime,
      });
      showToast('SWOT 已由 AI 生成并保存');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '生成失败');
    } finally {
      setAiSwotRunning(false);
    }
  };

  const handleAiMarketing = async () => {
    if (!classId?.trim()) {
      message.warning('缺少班级信息');
      return;
    }
    setAiMarketingRunning(true);
    try {
      const d = await generateBusinessModelMarketingAi(classId.trim());
      applyPayloadToState(d, {
        setSwotData,
        setMarketingData,
        setCosts,
        setRevenues,
        setSwotSaveTime,
        setMarketingSaveTime,
        setFinanceSaveTime,
      });
      showToast('4P 策略已由 AI 生成并保存');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '生成失败');
    } finally {
      setAiMarketingRunning(false);
    }
  };

  const handleAiFinanceItems = async () => {
    if (!classId?.trim()) {
      message.warning('缺少班级信息');
      return;
    }
    setAiFinanceRunning(true);
    try {
      const d = await generateBusinessModelFinanceItemsAi(classId.trim());
      applyPayloadToState(d, {
        setSwotData,
        setMarketingData,
        setCosts,
        setRevenues,
        setSwotSaveTime,
        setMarketingSaveTime,
        setFinanceSaveTime,
      });
      message.info('根据项目信息和通用财务数据推算，请根据实际情况修改。');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '生成失败');
    } finally {
      setAiFinanceRunning(false);
    }
  };

  const updateCanvasField = (field: keyof BMCData, value: string) => {
    setCanvasData(prev => ({ ...prev, [field]: value }));
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
    { key: 'swot' as const, label: 'SWOT分析', icon: 'ri-grid-line' },
    { key: 'marketing' as const, label: '营销策略', icon: 'ri-megaphone-line' },
    { key: 'finance' as const, label: '成本分析', icon: 'ri-money-dollar-circle-line' },
    { key: 'warroom' as const, label: '虚拟董事会', icon: 'ri-team-line', badge: 'AI' },
    { key: 'canvas' as const, label: '商业画布', icon: 'ri-layout-grid-line' },
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
        readOnly={!canCaptain}
        rows={rows}
        className={`flex-1 w-full px-3 py-2 text-xs border ${cfg.ringBorder} rounded-lg focus:outline-none focus:ring-2 ${cfg.ring} focus:border-transparent resize-none bg-white read-only:bg-gray-50 read-only:cursor-default`}
        placeholder={canCaptain ? `请输入${cfg.label}` : '待队长生成'}
      />
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
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <i className="ri-briefcase-line text-3xl"></i>
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-1">商业模式设计</h2>
              <p className="text-white/80 text-sm">整合前期成果，构建完整商业模式</p>
            </div>
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
                    组员完成虚拟董事会并保存后，队长可综合生成团队最终画布
                  </p>
                </div>
                {canCaptain ? (
                <button
                  type="button"
                  onClick={handleAIGenerate}
                  disabled={trainingEnded || isGenerating}
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
                ) : null}
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

              <div className="flex gap-4">
                {canCaptain ? (
                <button
                  type="button"
                  onClick={handleUploadCanvas}
                  disabled={trainingEnded || isUploadingCanvas}
                  className="flex-1 px-6 py-3 bg-pink-500 text-white text-sm font-medium rounded-xl hover:bg-pink-600 transition-colors whitespace-nowrap cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <i className="ri-upload-line"></i>
                  {isUploadingCanvas ? '上传中…' : '上传画布'}
                </button>
                ) : null}
                {/* <button
                  onClick={() => showToast('画布已导出为图片 ✓')}
                  className="px-6 py-3 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-2"
                >
                  <i className="ri-image-line"></i>
                  导出图片
                </button> */}
              </div>

            </div>
          )}

          {activeTab === 'swot' && (
            <div className="space-y-8">
              {workspaceLoading ? (
                <div className="flex justify-center py-20">
                  <Spin />
                </div>
              ) : (
                <>
              <div className="bg-pink-50 border border-pink-200 rounded-xl p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold text-pink-900 mb-3">SWOT分析指南</h3>
                    <p className="text-sm text-pink-700">从优势、劣势、机会、威胁四个维度全面分析项目</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    {swotSaveTime && (
                      <div className="text-xs text-pink-600 flex items-center gap-1">
                        <i className="ri-time-line"></i>上次保存：{swotSaveTime}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleAiSwot}
                      disabled={trainingEnded || aiSwotRunning || !classId?.trim()}
                      className="px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 text-white text-sm font-semibold rounded-xl hover:shadow-md transition-all whitespace-nowrap cursor-pointer disabled:opacity-50 flex items-center gap-2"
                    >
                      {aiSwotRunning ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-sparkling-line" />}
                      AI 生成
                    </button>
                  </div>
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
                </>
              )}
            </div>
          )}

          {activeTab === 'marketing' && (
            <div className="space-y-8">
              {workspaceLoading ? (
                <div className="flex justify-center py-20">
                  <Spin />
                </div>
              ) : (
                <>
              <div className="bg-pink-50 border border-pink-200 rounded-xl p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold text-pink-900 mb-3">营销策略指南</h3>
                    <p className="text-sm text-pink-700">制定STP战略和4P策略，明确市场定位和推广方案</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    {marketingSaveTime && (
                      <div className="text-xs text-pink-600 flex items-center gap-1">
                        <i className="ri-time-line"></i>上次保存：{marketingSaveTime}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleAiMarketing}
                      disabled={trainingEnded || aiMarketingRunning || !classId?.trim()}
                      className="px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 text-white text-sm font-semibold rounded-xl hover:shadow-md transition-all whitespace-nowrap cursor-pointer disabled:opacity-50 flex items-center gap-2"
                    >
                      {aiMarketingRunning ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-sparkling-line" />}
                      AI 生成
                    </button>
                  </div>
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
                </>
              )}
            </div>
          )}

          {activeTab === 'finance' && (
            <div className="space-y-8">
              {workspaceLoading ? (
                <div className="flex justify-center py-20">
                  <Spin />
                </div>
              ) : (
                <>
              <div className="bg-pink-50 border border-pink-200 rounded-xl p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold text-pink-900 mb-3">成本分析 — 可自由调整</h3>
                    <p className="text-sm text-pink-700">点击金额数字即可直接编辑，修改后汇总数据实时更新。可添加或删除成本项。</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    {financeSaveTime && (
                      <div className="text-xs text-pink-600 flex items-center gap-1">
                        <i className="ri-time-line"></i>上次保存：{financeSaveTime}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleAiFinanceItems}
                      disabled={trainingEnded || aiFinanceRunning || !classId?.trim()}
                      className="px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 text-white text-sm font-semibold rounded-xl hover:shadow-md transition-all whitespace-nowrap cursor-pointer disabled:opacity-50 flex items-center gap-2"
                    >
                      {aiFinanceRunning ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-sparkling-line" />}
                      AI 生成
                    </button>
                  </div>
                </div>
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
              <button
                onClick={handleSaveFinance}
                disabled={isSavingFinance}
                className="w-full px-6 py-3 bg-pink-500 text-white text-sm font-medium rounded-xl hover:bg-pink-600 transition-colors whitespace-nowrap cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSavingFinance ? (
                  <>
                    <i className="ri-loader-4-line animate-spin"></i>保存中…
                  </>
                ) : (
                  <>
                    <i className="ri-save-line"></i>保存财务数据
                  </>
                )}
              </button>
                </>
              )}
            </div>
          )}

          {activeTab === 'warroom' && (
            <WarRoom
              classId={classId}
              studentDisplayName={studentDisplayName}
              onRecordSaved={() => setWarRoomRecordSaved(true)}
              disabled={trainingEnded}
            />
          )}
        </div>
      </div>

      {/* 可获得能力点 */}
      {/* <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
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
      </div> */}

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
