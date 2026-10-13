import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { message, Modal, Spin } from 'antd';
import VersionControl, { Version } from '../../../../../components/feature/VersionControl';
import AppModalPortal from '../../../../../components/AppModalPortal';
import WarRoom from './WarRoom';
import {
  acquireBmcCellLock,
  fetchBmcAiReviews,
  fetchBmSectionAiReviews,
  fetchBusinessModelWorkspace,
  generateBusinessModelFinanceItemsAi,
  generateBusinessModelMarketingAi,
  generateBusinessModelSwotAi,
  releaseBmcCellLock,
  saveBusinessModelBmc,
  saveBusinessModelWorkspacePartial,
  submitBmcAiReview,
  submitBmSectionAiReview,
  type BmcAiReviewItem,
  type BmcPayload,
  type BmSectionKey,
  type BusinessModelTeamMember,
  type BusinessModelWorkspacePayload,
  type WarRoomTeamRecordSummary,
} from '../demoBusinessApi';

const BM_TAB_KEYS = ['swot', 'marketing', 'finance', 'canvas', 'warroom'] as const;
type BmTabKey = (typeof BM_TAB_KEYS)[number];

function parseBmTab(raw: string | null): BmTabKey | null {
  const v = String(raw || '').trim();
  return (BM_TAB_KEYS as readonly string[]).includes(v) ? (v as BmTabKey) : null;
}

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

const BMC_CELL_GUIDE: Record<keyof BMCData, string> = {
  customerSegments:
    '写清楚你的目标客户是谁，不要笼统写「所有人」。至少写：客户人群特征、所处场景、客户痛点，可做客户分层；描述清楚谁是你的首要客户。',
  valueProposition:
    '写你的产品/方案帮客户解决了什么具体问题、提供什么价值。推荐用「因为…所以…」句式：客户的痛点 → 你的解决方案 → 可衡量的效果，避免堆砌形容词空话。',
  channels:
    '写你如何触达客户、客户怎么找到并购买你的产品。拆成 3 部分：获客渠道（线上/线下）、谁来执行、承接哪些环节（获客/成交/交付）。',
  customerRelationships:
    '写你如何获取客户、维持客户、让客户持续满意。可以分层描述：靠什么方式维护客户（自助/销售/社群）、客户维护动作、是否存在付费升级转化路径。',
  revenueStreams:
    '写客户为什么愿意付费、付多少钱、多久付一次。写明定价方式（订阅/单次/抽成）、客户价格区间、付费主体。',
  keyActivities:
    '写为了让商业模式成立，你必须持续做的核心事情。只写必须亲自做、外包出去就会失败的业务；要包含验证、试错迭代类业务。',
  keyResources:
    '写你自身拥有或可控的稀缺资源。区分自有、租赁、合作获取的资源；检验标准：如果换成竞争对手，这项资源还能不能成立。',
  keyPartnerships:
    '写你需要和谁合作、为什么不自己完成这件事。每条写：合作方、对方提供什么、为什么必须合作；就算没有外部合作，也要说明如何独立搭建业务。',
  costStructure:
    '写钱花在哪里。区分固定成本（规模变大也基本不变）和变动成本（规模越大花费越高），可以补充启动资金、回本/现金流预测。',
};

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

const WAR_ROOM_CANVAS_CELL_COUNT = 9;

function allTeamMembersWarRoomComplete(
  members: BusinessModelTeamMember[],
  records: WarRoomTeamRecordSummary[]
) {
  if (!members.length) return false;
  const byId = new Map(records.map((r) => [r.studentId, r.filledCount || 0]));
  return members.every((m) => (byId.get(String(m.id)) || 0) >= WAR_ROOM_CANVAS_CELL_COUNT);
}

function hasBmcContent(data: BMCData) {
  return Object.values(data).some((v) => String(v || '').trim());
}

const BMC_FIELD_LABELS: Record<keyof BMCData, string> = {
  keyPartnerships: '合作伙伴',
  keyActivities: '关键业务',
  valueProposition: '价值主张',
  customerRelationships: '客户关系',
  customerSegments: '客户细分',
  keyResources: '核心资源',
  channels: '渠道通路',
  costStructure: '成本结构',
  revenueStreams: '收入来源',
};

/** 未填写的九格中文名（提交审查时备注） */
function emptyBmcLabels(data: BMCData) {
  return (Object.keys(BMC_FIELD_LABELS) as (keyof BMCData)[])
    .filter((k) => !String(data[k] || '').trim())
    .map((k) => BMC_FIELD_LABELS[k]);
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
  onBmcCanvasUploaded?: () => void;
};

export default function BusinessModelModule({
  classId,
  studentDisplayName = '同学',
  isTeamLeader = false,
  trainingEnded = false,
  onTaskComplete,
  onBusinessTabProgress,
  onBmcCanvasUploaded,
}: BusinessModelModuleProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialBmTab = parseBmTab(searchParams.get('bmTab')) || 'swot';
  const [activeTab, setActiveTab] = useState<BmTabKey>(initialBmTab);
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
  const [isUploadingCanvas, setIsUploadingCanvas] = useState(false);
  const [workspaceIsTeamLeader, setWorkspaceIsTeamLeader] = useState(false);
  const [bmcReviewStatus, setBmcReviewStatus] = useState('draft');
  const [bmcReviewComment, setBmcReviewComment] = useState('');
  const [selfNote, setSelfNote] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);
  const [latestReview, setLatestReview] = useState<BmcAiReviewItem | null>(null);
  const [reviewHistoryOpen, setReviewHistoryOpen] = useState(false);
  const [reviewHistory, setReviewHistory] = useState<BmcAiReviewItem[]>([]);
  /** 团队已完成的 AI 审查次数；≥1 才允许上传画布 */
  const [aiReviewCount, setAiReviewCount] = useState(0);
  /** SWOT / 营销 / 成本：分节审查 */
  const [sectionSelfNote, setSectionSelfNote] = useState<Record<BmSectionKey, string>>({
    swot: '',
    marketing: '',
    finance: '',
  });
  const [sectionReviewing, setSectionReviewing] = useState<BmSectionKey | null>(null);
  const [sectionLatest, setSectionLatest] = useState<Partial<Record<BmSectionKey, BmcAiReviewItem>>>({});
  const [sectionHistoryOpen, setSectionHistoryOpen] = useState<BmSectionKey | null>(null);
  const [sectionHistory, setSectionHistory] = useState<BmcAiReviewItem[]>([]);
  const [guideOpen, setGuideOpen] = useState<Partial<Record<keyof BMCData, boolean>>>({});
  /** 当前本人持有编辑锁的格子；团队多人时未持锁不可改 */
  const [heldCell, setHeldCell] = useState<string | null>(null);
  /** 抢锁失败时记录对方姓名，用于只读提示 */
  const [blockedCells, setBlockedCells] = useState<Partial<Record<keyof BMCData, string>>>({});
  /** 个人公司 / 单人：不做协作锁与组长上传限制；加载前先按个人放开，避免首屏误锁 */
  const [isSoloTeam, setIsSoloTeam] = useState(true);
  /** 本会话已改动的画布格，审查落盘时只合并这些格，避免覆盖队友 */
  const dirtyBmcKeysRef = useRef<Set<string>>(new Set());

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
  const [teamMembers, setTeamMembers] = useState<BusinessModelTeamMember[]>([]);
  const [warRoomTeamRecords, setWarRoomTeamRecords] = useState<WarRoomTeamRecordSummary[]>([]);

  const canCaptain = workspaceIsTeamLeader || isTeamLeader;
  // 团队多人公司才启用格锁
  const needCellLock = !isSoloTeam;

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

  // URL bmTab → 定位商模子 Tab（驾驶舱深链）
  useEffect(() => {
    const fromUrl = parseBmTab(searchParams.get('bmTab'));
    if (fromUrl && fromUrl !== activeTab) setActiveTab(fromUrl);
  }, [searchParams]);

  const selectTab = (tab: BmTabKey) => {
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams);
    next.set('bmTab', tab);
    setSearchParams(next, { replace: true });
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
        const records = d.warRoomTeamRecords || [];
        const members = d.teamMembers || [];
        setTeamMembers(members);
        setWarRoomTeamRecords(records);
        setWarRoomRecordSaved(allTeamMembersWarRoomComplete(members, records));
        setCanvasData(bmcFromPayload(d.bmc));
        setCanvasTabUploaded(Boolean(d.bmcCanvasSavedAt));
        setWorkspaceIsTeamLeader(Boolean(d.isTeamLeader));
        setIsSoloTeam(Boolean(d.isSolo) || (d.teamMemberCount || members.length || 0) <= 1);
        setBmcReviewStatus(String(d.bmcReviewStatus || 'draft'));
        setBmcReviewComment(String(d.bmcReviewComment || ''));
        dirtyBmcKeysRef.current = new Set();
        // 同步加载审查次数，控制「上传画布」是否可用
        try {
          const rev = await fetchBmcAiReviews(classId.trim());
          if (!cancelled) {
            const list = rev.reviews || [];
            setAiReviewCount(list.length);
            if (list[0]) setLatestReview(list[0]);
          }
        } catch {
          if (!cancelled) setAiReviewCount(0);
        }
        // 各分节最新审查结果
        const sections: BmSectionKey[] = ['swot', 'marketing', 'finance'];
        const latestMap: Partial<Record<BmSectionKey, BmcAiReviewItem>> = {};
        await Promise.all(
          sections.map(async (sec) => {
            try {
              const r = await fetchBmSectionAiReviews(classId.trim(), sec);
              if (r.reviews?.[0]) latestMap[sec] = r.reviews[0];
            } catch {
              /* ignore */
            }
          })
        );
        if (!cancelled) setSectionLatest(latestMap);
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

  const applyWorkspaceBmc = (d: BusinessModelWorkspacePayload, opts?: { clearDirty?: boolean }) => {
    setCanvasData(bmcFromPayload(d.bmc));
    setCanvasTabUploaded(Boolean(d.bmcCanvasSavedAt));
    setWorkspaceIsTeamLeader(Boolean(d.isTeamLeader));
    setIsSoloTeam(Boolean(d.isSolo) || (d.teamMemberCount || d.teamMembers?.length || 0) <= 1);
    setBmcReviewStatus(String(d.bmcReviewStatus || 'draft'));
    setBmcReviewComment(String(d.bmcReviewComment || ''));
    if (opts?.clearDirty !== false) dirtyBmcKeysRef.current = new Set();
  };

  // 持锁期间定时续心跳，避免 90s TTL 过期后被队友抢走
  useEffect(() => {
    if (!needCellLock || !heldCell || !classId?.trim()) return;
    const cellKey = heldCell;
    const cid = classId.trim();
    const timer = window.setInterval(() => {
      void acquireBmcCellLock(cid, cellKey).catch(() => {
        setHeldCell((cur) => (cur === cellKey ? null : cur));
        setBlockedCells((prev) => ({ ...prev, [cellKey as keyof BMCData]: '队友' }));
        message.warning('编辑锁已失效，请重新点击该格后再编辑');
      });
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [needCellLock, heldCell, classId]);

  const handleSubmitAiReview = async () => {
    if (!classId?.trim()) {
      message.warning('缺少班级信息');
      return;
    }
    // 至少一格有内容才允许审查
    if (!hasBmcContent(canvasData)) {
      message.warning('请至少填写一个画布格子后再提交审查');
      return;
    }
    const emptyLabels = emptyBmcLabels(canvasData);
    // 未填格子在自述中备注「未填写」，便于 AI 与审查记录识别
    const noteForSubmit = emptyLabels.length
      ? `${String(selfNote || '').trim()}${selfNote.trim() ? '\n\n' : ''}未填写格子：${emptyLabels.join('、')}（备注：未填写）`
      : selfNote;
    setIsReviewing(true);
    try {
      const changedKeys = [...dirtyBmcKeysRef.current];
      const res = await submitBmcAiReview(classId.trim(), {
        selfNote: noteForSubmit,
        bmc: canvasData as BmcPayload,
        ...(needCellLock ? { changedKeys } : {}),
      });
      setLatestReview(res.review);
      setAiReviewCount((n) => Math.max(1, n + 1));
      applyWorkspaceBmc(res.workspace);
      showToast('本轮审查已完成');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '审查失败');
    } finally {
      setIsReviewing(false);
    }
  };

  const openReviewHistory = async () => {
    if (!classId?.trim()) return;
    try {
      const res = await fetchBmcAiReviews(classId.trim());
      const list = res.reviews || [];
      setReviewHistory(list);
      setAiReviewCount(list.length);
      setReviewHistoryOpen(true);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载审查记录失败');
    }
  };

  const handleUploadCanvas = async () => {
    if (!classId?.trim()) {
      message.warning('缺少班级信息');
      return;
    }
    if (!isSoloTeam && !canCaptain) {
      message.info('仅组长可上传最终商业画布');
      return;
    }
    if (aiReviewCount < 1) {
      message.warning('请先完成至少 1 次 AI 审查后再上传画布');
      return;
    }
    if (!hasBmcContent(canvasData)) {
      message.warning('请先填写画布内容');
      return;
    }
    if (!swotSaveTime) {
      message.warning('请先保存 SWOT 分析');
      return;
    }
    if (!marketingSaveTime) {
      message.warning('请先保存营销策略');
      return;
    }
    if (!financeSaveTime) {
      message.warning('请先保存成本与财务分析');
      return;
    }
    // 上传门槛：SWOT / 营销 / 财务 / ≥1 次 AI 审查（不再要求虚拟董事会）
    setIsUploadingCanvas(true);
    try {
      const d = await saveBusinessModelBmc(classId.trim(), canvasData);
      applyWorkspaceBmc(d);
      setCanvasTabUploaded(true);
      onBmcCanvasUploaded?.();
      message.success('商业画布已提交');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '提交失败');
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
      showToast('已写入 SWOT 引导提纲，请完善后保存');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '引导填写失败');
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
      showToast('已写入 4P 引导提纲，请完善后保存');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '引导填写失败');
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
      showToast('已写入成本/收入引导明细（含估算金额），请按实际修改后保存');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '引导填写失败');
    } finally {
      setAiFinanceRunning(false);
    }
  };

  const hasSectionContent = (section: BmSectionKey) => {
    if (section === 'swot') {
      return Object.values(swotData).some((v) => String(v || '').trim());
    }
    if (section === 'marketing') {
      return Object.values(marketingData).some((v) => String(v || '').trim());
    }
    return costs.length > 0 || revenues.length > 0;
  };

  const handleSubmitSectionReview = async (section: BmSectionKey) => {
    if (!classId?.trim()) {
      message.warning('缺少班级信息');
      return;
    }
    if (!hasSectionContent(section)) {
      message.warning('请先填写内容后再提交审查');
      return;
    }
    setSectionReviewing(section);
    try {
      const body =
        section === 'swot'
          ? { selfNote: sectionSelfNote.swot, swot: swotData }
          : section === 'marketing'
            ? { selfNote: sectionSelfNote.marketing, marketing: marketingData }
            : { selfNote: sectionSelfNote.finance, finance: { costs, revenues } };
      const res = await submitBmSectionAiReview(classId.trim(), section, body);
      setSectionLatest((prev) => ({ ...prev, [section]: res.review }));
      applyPayloadToState(res.workspace, {
        setSwotData,
        setMarketingData,
        setCosts,
        setRevenues,
        setSwotSaveTime,
        setMarketingSaveTime,
        setFinanceSaveTime,
      });
      showToast('本轮审查已完成');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '审查失败');
    } finally {
      setSectionReviewing(null);
    }
  };

  const openSectionReviewHistory = async (section: BmSectionKey) => {
    if (!classId?.trim()) return;
    try {
      const res = await fetchBmSectionAiReviews(classId.trim(), section);
      setSectionHistory(res.reviews || []);
      setSectionHistoryOpen(section);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载审查记录失败');
    }
  };

  const renderSectionReviewBlock = (section: BmSectionKey, saveAction?: ReactNode) => {
    const latest = sectionLatest[section];
    const reviewing = sectionReviewing === section;
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-bold text-gray-900">本轮审查与结果</h3>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              type="button"
              onClick={() => void openSectionReviewHistory(section)}
              className="px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 rounded-lg cursor-pointer hover:bg-teal-100 whitespace-nowrap"
            >
              审查记录
            </button>
            {saveAction}
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-pink-400 focus-within:border-pink-300">
          <textarea
            value={sectionSelfNote[section]}
            onChange={(e) => setSectionSelfNote((prev) => ({ ...prev, [section]: e.target.value }))}
            rows={3}
            placeholder="本轮自述：这一轮你改了什么、为什么这么改？"
            className="w-full text-xs px-3 py-2 resize-none border-0 focus:outline-none focus:ring-0 bg-white"
          />
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-gray-100 bg-gray-50/90">
            <p className="text-[11px] text-gray-400 min-w-0">
              {hasSectionContent(section) ? '可提交本轮审查' : '请先填写内容后再提交审查'}
            </p>
            <button
              type="button"
              onClick={() => void handleSubmitSectionReview(section)}
              disabled={trainingEnded || reviewing || !hasSectionContent(section)}
              className="px-4 py-1.5 bg-gradient-to-r from-teal-500 to-cyan-600 text-white text-sm font-medium rounded-lg cursor-pointer disabled:opacity-50 shrink-0 whitespace-nowrap"
            >
              {reviewing ? '审查中…' : '提交本轮审查'}
            </button>
          </div>
        </div>
        <div className="min-w-0 rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-800">审查结果</span>
            {latest?.aiScore != null ? (
              <span className="text-sm font-semibold text-teal-700">AI 评分 {latest.aiScore}</span>
            ) : null}
          </div>
          {latest ? (
            <div className="space-y-2 text-sm text-gray-700">
              <p>{latest.aiResult?.summary || '暂无总评'}</p>
              {Array.isArray(latest.aiResult?.suggestions) && latest.aiResult.suggestions.length ? (
                <ul className="list-disc pl-5 text-xs text-gray-600 space-y-1">
                  {latest.aiResult.suggestions.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-gray-400">提交本轮审查后，结果将显示在这里</p>
          )}
        </div>
      </div>
    );
  };

  const updateCanvasField = (field: keyof BMCData, value: string) => {
    // 团队协作：未抢到该格锁时拒绝写入，防止本地脏写后整包覆盖
    if (needCellLock && heldCell !== field) return;
    dirtyBmcKeysRef.current.add(field);
    setCanvasData((prev) => ({ ...prev, [field]: value }));
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
  const canSubmitAiReview = hasBmcContent(canvasData);
  const emptyCanvasLabels = emptyBmcLabels(canvasData);
  const canUploadByRole = isSoloTeam || canCaptain;
  const canUploadCanvas =
    canUploadByRole && aiReviewCount >= 1 && !trainingEnded && bmcReviewStatus !== 'approved';

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
  ) => {
    const guideExpanded = Boolean(guideOpen[cfg.key]);
    return (
    <div className={`bg-gradient-to-br ${cfg.gradient} border-2 ${cfg.border} rounded-xl xl:rounded-2xl p-2.5 xl:p-4 flex flex-col min-w-0 ${extraClass}`}>
      {/* 标题区：笔记本窄列只保留图标+标题，避免「展开引导」挤成竖排 */}
      <div className="flex items-center gap-1.5 xl:gap-2 mb-1.5 xl:mb-2 min-w-0">
        <div className={`w-7 h-7 xl:w-10 xl:h-10 bg-gradient-to-br ${cfg.iconBg} rounded-lg xl:rounded-xl flex items-center justify-center shrink-0`}>
          <i className={`${cfg.icon} text-white text-sm xl:text-lg`}></i>
        </div>
        <h3 className="text-xs xl:text-sm font-bold text-gray-900 truncate whitespace-nowrap">{cfg.label}</h3>
      </div>
      <textarea
        value={canvasData[cfg.key]}
        onFocus={() => {
          if (!classId?.trim() || trainingEnded) return;
          if (bmcReviewStatus === 'pending' || bmcReviewStatus === 'approved') return;
          if (!needCellLock) {
            setHeldCell(cfg.key);
            return;
          }
          void acquireBmcCellLock(classId.trim(), cfg.key)
            .then(() => {
              setHeldCell(cfg.key);
              setBlockedCells((prev) => {
                if (!prev[cfg.key]) return prev;
                const next = { ...prev };
                delete next[cfg.key];
                return next;
              });
            })
            .catch((e) => {
              const tip = e instanceof Error ? e.message : '该格正在被他人编辑';
              const nameMatch = tip.match(/已被\s*(.+?)\s*编辑/);
              setBlockedCells((prev) => ({
                ...prev,
                [cfg.key]: nameMatch?.[1] || '队友',
              }));
              setHeldCell((cur) => (cur === cfg.key ? null : cur));
              message.warning(tip);
            });
        }}
        onBlur={() => {
          if (heldCell !== cfg.key) return;
          if (needCellLock && classId?.trim()) {
            void releaseBmcCellLock(classId.trim(), cfg.key).catch(() => {});
          }
          setHeldCell(null);
        }}
        onChange={(e) => updateCanvasField(cfg.key, e.target.value)}
        readOnly={
          trainingEnded ||
          bmcReviewStatus === 'pending' ||
          bmcReviewStatus === 'approved' ||
          (needCellLock && heldCell !== cfg.key)
        }
        rows={rows}
        className={`flex-1 w-full min-h-0 px-2 xl:px-3 py-1.5 xl:py-2 text-xs border ${cfg.ringBorder} rounded-lg focus:outline-none focus:ring-2 ${cfg.ring} focus:border-transparent resize-none bg-white read-only:bg-gray-50 read-only:cursor-default`}
        placeholder={
          blockedCells[cfg.key]
            ? `${blockedCells[cfg.key]} 正在编辑此格`
            : `请输入${cfg.label}`
        }
      />
      {/* 引导入口放输入框下方右下角，笔记本窄列不再与标题抢宽 */}
      <div className="mt-1 flex justify-end">
        <button
          type="button"
          className="text-[11px] xl:text-xs text-teal-600 cursor-pointer whitespace-nowrap"
          onClick={() => setGuideOpen((prev) => ({ ...prev, [cfg.key]: !prev[cfg.key] }))}
        >
          {guideExpanded ? '收起引导' : '展开引导'}
        </button>
      </div>
      {guideExpanded ? (
        <div className="mt-1 text-[11px] leading-relaxed text-gray-600 bg-white/70 border border-dashed border-gray-200 rounded-lg px-2 py-1.5">
          {BMC_CELL_GUIDE[cfg.key]}
        </div>
      ) : null}
    </div>
    );
  };

  return (
    <div className="space-y-3">
      <VersionControl
        versions={versions}
        currentVersion={currentVersion}
        onRestore={handleRestore}
        onSaveVersion={handleSaveVersion}
        moduleName="商业模式设计"
      />

      {/* 标签页 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => selectTab(tab.key)}
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

        <div className="p-4 xl:p-8">
          {activeTab === 'canvas' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="bg-pink-50 border border-pink-200 rounded-xl px-4 py-3">
                  <h3 className="text-sm font-bold text-pink-900 mb-0.5">商业模式画布（BMC）</h3>
                  <p className="text-xs text-pink-700">
                    {isSoloTeam
                      ? '至少完成 1 次 AI 审查后，再上传给教师审核'
                      : '团队协作：点击格子获取编辑锁后再填写，避免互相覆盖；至少 1 次 AI 审查后，由组长上传给教师审核'}
                  </p>
                </div>

                <div className="grid grid-cols-5 gap-2 xl:gap-4">
                  {renderCanvasCard(cardConfigs[0], 'row-span-2', 10)}
                  {renderCanvasCard(cardConfigs[1], '', 5)}
                  {renderCanvasCard(cardConfigs[2], 'row-span-2 shadow-lg', 10)}
                  {renderCanvasCard(cardConfigs[3], '', 5)}
                  {renderCanvasCard(cardConfigs[4], 'row-span-2', 10)}
                  {renderCanvasCard(cardConfigs[5], '', 5)}
                  {renderCanvasCard(cardConfigs[6], '', 5)}
                  {renderCanvasCard(cardConfigs[7], 'col-span-2', 4)}
                  {renderCanvasCard(cardConfigs[8], 'col-span-3 shadow-lg', 4)}
                </div>
              </div>

              {/* 本轮审查：自述+提交同框；记录旁审核状态；结果单独下一行 */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-bold text-gray-900">本轮审查与结果</h3>
                  <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
                    <p className="text-[11px] text-gray-500">
                      审核状态：
                      {bmcReviewStatus === 'approved'
                        ? '已通过'
                        : bmcReviewStatus === 'pending'
                          ? '待教师审核'
                          : bmcReviewStatus === 'rejected'
                            ? `已驳回${bmcReviewComment ? `：${bmcReviewComment}` : ''}`
                            : '未上传'}
                    </p>
                    <button
                      type="button"
                      onClick={() => void openReviewHistory()}
                      className="px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 rounded-lg cursor-pointer hover:bg-teal-100 whitespace-nowrap"
                    >
                      审查记录
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleUploadCanvas()}
                      disabled={!canUploadCanvas || isUploadingCanvas}
                      title={
                        !canUploadByRole
                          ? '仅组长可上传最终商业画布'
                          : aiReviewCount < 1
                            ? '请先完成至少 1 次 AI 审查'
                            : undefined
                      }
                      className="px-3 py-1.5 text-xs font-medium bg-pink-500 text-white rounded-lg hover:bg-pink-600 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                    >
                      <i className="ri-upload-line mr-1"></i>
                      {isUploadingCanvas ? '上传中…' : '上传画布'}
                    </button>
                  </div>
                  {!isSoloTeam && !canCaptain ? (
                    <p className="text-[11px] text-amber-700 w-full text-right">
                      队员可协作填写与 AI 审查；最终上传仅组长可操作
                    </p>
                  ) : null}
                </div>

                {/* 自述输入框内嵌提交按钮（单独一行） */}
                <div className="rounded-xl border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-pink-400 focus-within:border-pink-300">
                  <textarea
                    value={selfNote}
                    onChange={(e) => setSelfNote(e.target.value)}
                    rows={4}
                    placeholder="本轮自述：这一轮你改了什么、为什么这么改？"
                    className="w-full text-xs px-3 py-2 resize-none border-0 focus:outline-none focus:ring-0 bg-white"
                  />
                  <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-gray-100 bg-gray-50/90">
                    <p className="text-[11px] text-gray-400 min-w-0">
                      {canSubmitAiReview
                        ? emptyCanvasLabels.length
                          ? `未填写：${emptyCanvasLabels.join('、')}`
                          : '九格已全部填写'
                        : '请至少填写一个画布格子后再提交审查'}
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleSubmitAiReview()}
                      disabled={trainingEnded || isReviewing || !canSubmitAiReview}
                      className="px-4 py-1.5 bg-gradient-to-r from-teal-500 to-cyan-600 text-white text-sm font-medium rounded-lg cursor-pointer disabled:opacity-50 shrink-0 whitespace-nowrap"
                    >
                      {isReviewing ? '审查中…' : '提交本轮审查'}
                    </button>
                  </div>
                </div>

                {/* 审查结果：输入区下方单独一行 */}
                <div className="min-w-0 rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-800">审查结果</span>
                    {latestReview?.aiScore != null ? (
                      <span className="text-sm font-semibold text-teal-700">AI 评分 {latestReview.aiScore}</span>
                    ) : null}
                  </div>
                  {latestReview ? (
                    <div className="space-y-2 text-sm text-gray-700">
                      <p>{latestReview.aiResult?.summary || '暂无总评'}</p>
                      {Array.isArray(latestReview.aiResult?.suggestions) &&
                      latestReview.aiResult.suggestions.length ? (
                        <ul className="list-disc pl-5 text-xs text-gray-600 space-y-1">
                          {latestReview.aiResult.suggestions.map((s) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">提交本轮审查后，结果将显示在这里</p>
                  )}
                </div>
              </div>

              <Modal
                open={reviewHistoryOpen}
                onCancel={() => setReviewHistoryOpen(false)}
                footer={null}
                title="审查记录"
                width={640}
              >
                <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                  {reviewHistory.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">暂无审查记录</p>
                  ) : (
                    reviewHistory.map((item) => (
                      <div key={item.id} className="border border-gray-100 rounded-xl p-3">
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span>
                            {item.teamName ? `${item.teamName} · ` : ''}
                            {item.submitterName || '同学'}
                          </span>
                          <span>{new Date(item.createdAt).toLocaleString('zh-CN')}</span>
                        </div>
                        <p className="text-xs text-gray-600 mb-1">自述：{item.selfNote || '（无）'}</p>
                        <p className="text-sm text-gray-800">{item.aiResult?.summary || '—'}</p>
                        {item.aiScore != null ? (
                          <p className="text-xs text-teal-700 mt-1">评分 {item.aiScore}</p>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </Modal>
            </div>
          )}

          <Modal
            open={Boolean(sectionHistoryOpen)}
            onCancel={() => setSectionHistoryOpen(null)}
            footer={null}
            title={
              sectionHistoryOpen === 'swot'
                ? 'SWOT 审查记录'
                : sectionHistoryOpen === 'marketing'
                  ? '营销策略审查记录'
                  : '成本分析审查记录'
            }
            width={640}
          >
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {sectionHistory.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">暂无审查记录</p>
              ) : (
                sectionHistory.map((item) => (
                  <div key={item.id} className="border border-gray-100 rounded-xl p-3">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>
                        {item.teamName ? `${item.teamName} · ` : ''}
                        {item.submitterName || '同学'}
                      </span>
                      <span>{new Date(item.createdAt).toLocaleString('zh-CN')}</span>
                    </div>
                    <p className="text-xs text-gray-600 mb-1">自述：{item.selfNote || '（无）'}</p>
                    <p className="text-sm text-gray-800">{item.aiResult?.summary || '—'}</p>
                    {item.aiScore != null ? (
                      <p className="text-xs text-teal-700 mt-1">评分 {item.aiScore}</p>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </Modal>

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
                      {aiSwotRunning ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-compass-3-line" />}
                      AI 引导填写
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
              {renderSectionReviewBlock(
                'swot',
                <button
                  type="button"
                  onClick={handleSaveSwot}
                  disabled={isSavingSwot}
                  className="px-3 py-1.5 text-xs font-medium bg-pink-500 text-white rounded-lg hover:bg-pink-600 cursor-pointer disabled:opacity-50 whitespace-nowrap flex items-center gap-1"
                >
                  {isSavingSwot ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-save-line" />}
                  {isSavingSwot ? '保存中…' : '保存分析'}
                </button>
              )}
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
                      {aiMarketingRunning ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-compass-3-line" />}
                      AI 引导填写
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
              {renderSectionReviewBlock(
                'marketing',
                <button
                  type="button"
                  onClick={handleSaveMarketing}
                  disabled={isSavingMarketing}
                  className="px-3 py-1.5 text-xs font-medium bg-pink-500 text-white rounded-lg hover:bg-pink-600 cursor-pointer disabled:opacity-50 whitespace-nowrap flex items-center gap-1"
                >
                  {isSavingMarketing ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-save-line" />}
                  {isSavingMarketing ? '保存中…' : '保存策略'}
                </button>
              )}
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
                      {aiFinanceRunning ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-compass-3-line" />}
                      AI 引导填写
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
              {renderSectionReviewBlock(
                'finance',
                <button
                  type="button"
                  onClick={handleSaveFinance}
                  disabled={isSavingFinance}
                  className="px-3 py-1.5 text-xs font-medium bg-pink-500 text-white rounded-lg hover:bg-pink-600 cursor-pointer disabled:opacity-50 whitespace-nowrap flex items-center gap-1"
                >
                  {isSavingFinance ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-save-line" />}
                  {isSavingFinance ? '保存中…' : '保存财务数据'}
                </button>
              )}
                </>
              )}
            </div>
          )}

          {activeTab === 'warroom' && (
            <WarRoom
              classId={classId}
              studentDisplayName={studentDisplayName}
              onRecordSaved={() => {
                if (!classId?.trim()) return;
                void fetchBusinessModelWorkspace(classId.trim())
                  .then((d) => {
                    const records = d.warRoomTeamRecords || [];
                    const members = d.teamMembers || teamMembers;
                    setWarRoomTeamRecords(records);
                    if (members.length) setTeamMembers(members);
                    setWarRoomRecordSaved(allTeamMembersWarRoomComplete(members, records));
                  })
                  .catch(() => {});
              }}
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
        <AppModalPortal open={true} onMaskClick={() => setShowAddCost(false)} zIndex={50}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
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
        </AppModalPortal>
      )}

      {/* 团队共享弹窗 */}
      {showShareModal && (
        <AppModalPortal open={true} onMaskClick={() => setShowShareModal(false)} zIndex={50}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8"
            onClick={(e) => e.stopPropagation()}
          >
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
        </AppModalPortal>
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
