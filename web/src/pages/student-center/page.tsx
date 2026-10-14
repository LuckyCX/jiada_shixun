import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Drawer, Modal, notification, Tree, Upload, message as antdMessage, Button } from 'antd';
import type { UploadFile } from 'antd';
import { clearPortalToken, getPortalToken, parseJwtPayload } from '../../lib/authApi';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useSiteBrand } from '../../lib/publicSite';
import LearningDetail, { type LearningDetailResource } from '../knowledge-system/components/LearningDetail';
import QuizModal, { type QuizConfig } from './components/QuizModal';
import {
  fetchStudentKnowledgeQuiz,
  submitStudentKnowledgeQuizAttempt,
  fetchStudentCourseResources,
  fetchStudentPassedKnowledgePointIds,
} from '../../lib/courseResourceApi';
import {
  flattenPublishedCourseLeaves,
  TRAINING_MODULE_CATALOG_KEYS,
} from '../../lib/studentCourseCatalog';
import {
  evaluateModulePrerequisite,
  canStartKnowledgeQuiz,
  isTrackableLearningResource,
  COURSE_GATE_PERCENT,
} from '../../lib/trainingModulePrerequisite';
import {
  fetchStudentNotifications,
  markStudentNotificationRead,
  type StudentNotificationRow,
} from '../../lib/teamFormationApi';
import { downloadStudentGuidanceAttachment } from '../../lib/teacherGuidanceApi';
import StudentClassSwitcher from './components/StudentClassSwitcher';
import AiTutorPanel from '../../components/AiTutorPanel';
import { appAlert } from '../../lib/appDialog';
import { UserGuideContent } from '../user-guide/UserGuideContent';
import TeamFormationModule from './components/TeamFormationModule';
import IdeationModule, { type IdeationLearningResource, type IdeationModuleTab } from './components/IdeationModule';
import MarketResearchModule from './components/MarketResearchModule';
import UnlockTrainingStageModal from './components/UnlockTrainingStageModal';
import {
  fetchMyLatestChallengeSession,
  fetchTeamMarketReportUploadStatus,
} from '../../lib/studentMarketResearchApi';
import { fetchTeamProductPrototypeStatus } from '../../lib/studentProductDesignApi';
import {
  fetchBusinessModelWorkspace,
  type BusinessModelWorkspacePayload,
} from '../../lib/studentBusinessModelApi';
import ProductDesignModule from './components/ProductDesignModule';
import BusinessModelModule from './components/BusinessModelModule';
import RoleSimulationModule from './components/RoleSimulationModule';
import BusinessPlanModule from './components/BusinessPlanModule';
import { fetchBusinessPlanSubmissionStatus } from '../../lib/studentBusinessPlanApi';
import { fetchStudentArchive, type ArchiveRecord, type ArchiveStats } from '../../lib/studentArchiveApi';
import {
  fetchStudentPersonalEnrollments,
  getStudentProfile,
  updateStudentProfile,
  uploadStudentAvatar,
  type StudentPersonalEnrollment,
  type StudentProfile,
} from '../../lib/studentPortalApi';
import ProfileContactPanels from '../../components/ProfileContactPanels';
import {
  fetchStudentMyTeam,
  fetchTeamSubmission,
  isTeamFormationDone,
  type GroupingTeam,
} from '../../lib/teamFormationApi';
import UserAvatar from '../../components/UserAvatar';
import AppModalPortal from '../../components/AppModalPortal';
import {
  completeStudentTodoTask,
  downloadStudentTaskAttachment,
  fetchStudentTodoTasks,
  TRAINING_ID_TO_TAB,
  type StudentTodoTask,
  type TaskResourceNode,
} from '../../lib/personalClassTaskApi';
import { fetchStudentIdeationProjectTopic, fetchStudentIdeationTeamPrerequisites } from '../../lib/studentIdeationApi';

const TRAINING_MODULE_ORDER = ['team', 'ideation', 'market', 'product', 'business', 'simulation', 'plan'] as const;
const SKIPPABLE_TRAINING_MODULES = ['ideation', 'market', 'product', 'business', 'simulation', 'plan'] as const;

const MODULE_COMPLETE_THRESHOLD: Record<string, number> = {
  team: 4,
  ideation: 6,
  market: 6,
  product: 7,
  business: 5,
  // 个人有效轮次上限 3；全员达标后进度条记满（完成判定另看 simTeamQualified）
  simulation: 3,
  plan: 4,
};

const TAB_TO_MODULE_ID: Record<string, string> = {
  'module-team': 'team',
  'module-ideation': 'ideation',
  'module-market': 'market',
  'module-product': 'product',
  'module-business': 'business',
  'module-simulation': 'simulation',
  'module-plan': 'plan',
};
const OVERVIEW_PANEL_PAGE_SIZE = 5;

const WAR_ROOM_CANVAS_CELL_COUNT = 9;

function isTeamWarRoomCanvasComplete(d: BusinessModelWorkspacePayload) {
  const members = d.teamMembers || [];
  if (members.length === 0) return false;
  const byId = new Map((d.warRoomTeamRecords || []).map((r) => [r.studentId, r.filledCount || 0]));
  return members.every((m) => (byId.get(String(m.id)) || 0) >= WAR_ROOM_CANVAS_CELL_COUNT);
}

function countBusinessModelProgressFromWorkspace(d: BusinessModelWorkspacePayload) {
  let done = 0;
  if (d.swotSavedAt) done += 1;
  if (d.marketingSavedAt) done += 1;
  if (d.financeSavedAt) done += 1;
  if (d.bmcCanvasSavedAt) done += 1;
  if (String(d.bmcReviewStatus || '') === 'approved') done += 1;
  return done;
}

type TabType =
  | 'overview'
  | 'ability'
  | 'archive'
  | 'knowledge'
  | 'guide'
  | 'notifications'
  | 'module-team'
  | 'module-ideation'
  | 'module-market'
  | 'module-product'
  | 'module-business'
  | 'module-simulation'
  | 'module-plan';

interface KnowledgeQuizState {
  [knowledgeId: string]: 'not_started' | 'passed' | 'failed';
}

type LearningKnowledge = {
  id: string;
  name: string;
  module: string;
  moduleName: string;
  description: string;
  resources: LearningDetailResource[];
  knowledgePoints: {
    id: string;
    title: string;
    description: string;
  }[];
};

type KnowledgeCardData = {
  id: string;
  name: string;
  module: string;
  moduleName: string;
  description: string;
  status: 'completed' | 'learning' | 'locked';
  progress: number;
  abilityPoints: string[];
  resources: LearningDetailResource[];
  nodeIds: string[];
  quizId: string;
  sortOrder: number;
};

type ResourceProgress = NonNullable<LearningDetailResource['progress']>;

const clampProgressPercent = (value: number) => Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));

const normalizeResourceProgress = (progress?: LearningDetailResource['progress']): ResourceProgress => {
  const progressPercent = clampProgressPercent(progress?.progressPercent || 0);
  const completed = Boolean(progress?.completed) || progressPercent >= 100;
  return {
    progressPercent: completed ? 100 : progressPercent,
    lastPosition: progress?.lastPosition || {},
    completed,
  };
};

const playbackSecondsFromPosition = (position: Record<string, unknown>) => {
  const raw = position.currentTime ?? position.studySeconds;
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const mergeResourceProgress = (
  base?: LearningDetailResource['progress'],
  next?: LearningDetailResource['progress'],
): ResourceProgress => {
  const current = normalizeResourceProgress(base);
  if (!next) return current;

  const incoming = normalizeResourceProgress(next);
  const progressPercent = Math.max(current.progressPercent, incoming.progressPercent);
  let lastPosition = current.lastPosition;
  if (incoming.progressPercent > current.progressPercent) {
    lastPosition = incoming.lastPosition;
  } else if (incoming.progressPercent < current.progressPercent) {
    lastPosition = current.lastPosition;
  } else {
    const tc = playbackSecondsFromPosition(current.lastPosition);
    const ti = playbackSecondsFromPosition(incoming.lastPosition);
    lastPosition = ti >= tc ? { ...current.lastPosition, ...incoming.lastPosition } : { ...incoming.lastPosition, ...current.lastPosition };
  }
  return {
    progressPercent,
    lastPosition,
    completed: current.completed || incoming.completed || progressPercent >= 100,
  };
};

const isRealLearningResource = (resource: LearningDetailResource) =>
  !resource.id.startsWith('node-');

const calculateKnowledgeResourceProgress = (resources: LearningDetailResource[]) => {
  const trackable = resources.filter((r) => isTrackableLearningResource(r));
  if (trackable.length === 0) return 0;
  return Math.round(
    trackable.reduce((sum, resource) => sum + normalizeResourceProgress(resource.progress).progressPercent, 0) / trackable.length,
  );
};

type ChapterTreeNode = {
  id: string;
  parentId: string | null;
  title: string;
  level: number;
  sortOrder: number;
  children: ChapterTreeNode[];
};

type AntdTreeNode = {
  title: string;
  key: string;
  children?: AntdTreeNode[];
};

type NotificationCategory = 'task' | 'guidance' | 'other';

function getNotificationCategory(notice: StudentNotificationRow): NotificationCategory {
  if (notice.relatedModule === 'personal_class_task') return 'task';
  if (notice.relatedModule === 'teacher_guidance') return 'guidance';
  return 'other';
}

/** 概览通知：无正文/附件或仅需跳转时不展示「查看」 */
function shouldShowOverviewNotificationView(notice: StudentNotificationRow): boolean {
  const content = String(notice.content || '').trim();
  const hasAttachments = Boolean(notice.attachments?.length);
  if (!content && !hasAttachments) return false;
  if (getNotificationCategory(notice) === 'task') return false;
  if (String(notice.relatedLink || '').trim()) return false;
  return true;
}

function getNotificationCategoryLabel(notice: StudentNotificationRow): string {
  const cat = getNotificationCategory(notice);
  if (cat === 'task') return '实训任务';
  if (cat === 'guidance') return notice.type === 'reminder' ? '学习督促' : '教师引导';
  switch (notice.type) {
    case 'guidance':
      return '引导意见';
    case 'reminder':
      return '督促通知';
    case 'evaluation':
      return '评价反馈';
    case 'team_join':
      return '加入团队';
    case 'system':
      return '系统通知';
    default:
      return '消息';
  }
}

function getNotificationCategoryStyle(notice: StudentNotificationRow): string {
  const cat = getNotificationCategory(notice);
  if (cat === 'task') return 'bg-blue-100 text-blue-700';
  if (cat === 'guidance') {
    return notice.type === 'reminder' ? 'bg-orange-100 text-orange-700' : 'bg-teal-100 text-teal-700';
  }
  switch (notice.type) {
    case 'guidance':
      return 'bg-teal-100 text-teal-700';
    case 'reminder':
      return 'bg-orange-100 text-orange-700';
    case 'evaluation':
      return 'bg-purple-100 text-purple-700';
    case 'team_join':
      return 'bg-cyan-100 text-cyan-800';
    case 'system':
      return 'bg-blue-100 text-blue-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

function parseStudentCenterQuery(rawLink: string): URLSearchParams {
  const path = rawLink.startsWith('/') ? rawLink : `/student-center?${rawLink}`;
  const qIdx = path.indexOf('?');
  return new URLSearchParams(qIdx >= 0 ? path.slice(qIdx + 1) : '');
}

export default function StudentCenterPage() {
  const { logoUrl, siteTitle } = useSiteBrand();
  const brandTitle = siteTitle.trim() || '学生工作台';
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const tabParam = searchParams.get('tab');
  const initialModule = searchParams.get('module');
  const ideationTabParam = searchParams.get('ideationTab');
  const initialIdeationTab: IdeationModuleTab | undefined =
    ideationTabParam === 'examples' || ideationTabParam === 'methods' || ideationTabParam === 'confirm'
      ? ideationTabParam
      : undefined;

  const getInitialTab = (): TabType => {
    // 优先读取 tab 参数（直接传入 tab key，如 module-business）
    if (tabParam) {
      return tabParam as TabType;
    }
    if (initialModule) {
      const map: Record<string, TabType> = {
        'team-formation': 'module-team',
        'ideation': 'module-ideation',
        'market-research': 'module-market',
        'product-design': 'module-product',
        'business-model': 'module-business',
        'role-simulation': 'module-simulation',
        'business-plan': 'module-plan',
        'knowledge': 'knowledge',
      };
      return map[initialModule] || 'overview';
    }
    return 'overview';
  };

  const [activeTab, setActiveTab] = useState<TabType>(getInitialTab());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [knowledgeSubTab, setKnowledgeSubTab] = useState<'overview' | 'knowledge' | 'ability' | 'progress'>('overview');
  const [selectedModule, setSelectedModule] = useState<string>('ideation');
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [activeLearningKnowledge, setActiveLearningKnowledge] = useState<LearningKnowledge | null>(null);
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const [activeQuizConfig, setActiveQuizConfig] = useState<QuizConfig | null>(null);
  const [quizLoadingId, setQuizLoadingId] = useState<string | null>(null);
  const [quizStates, setQuizStates] = useState<KnowledgeQuizState>({});
  const [completedKnowledgeIds, setCompletedKnowledgeIds] = useState<Set<string>>(new Set());
  const [moduleProgressState, setModuleProgressState] = useState<Record<string, number>>({
    team: 0,
    ideation: 0,
    market: 0,
    product: 0,
    business: 0,
    simulation: 0,
    plan: 0,
  });
  const handleMarketTabProgress = useCallback((done: number) => {
    setModuleProgressState((s) => (s.market === done ? s : { ...s, market: done }));
  }, []);
  const handleProductTabProgress = useCallback((done: number) => {
    setModuleProgressState((s) => (s.product === done ? s : { ...s, product: done }));
  }, []);
  const handleBusinessTabProgress = useCallback((done: number) => {
    setModuleProgressState((s) => (s.business === done ? s : { ...s, business: done }));
  }, []);
  const [teamFormationComplete, setTeamFormationComplete] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState<'all' | 'guidance' | 'reminder' | 'evaluation'>('all');
  const [notificationReadFilter, setNotificationReadFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [notificationList, setNotificationList] = useState<StudentNotificationRow[]>([]);
  const [notificationDetail, setNotificationDetail] = useState<StudentNotificationRow | null>(null);
  const [pendingTaskOpen, setPendingTaskOpen] = useState<{ classId: string | null; taskId: string } | null>(null);
  const openedNoticeFromUrlRef = useRef<string | null>(null);
  const [expandedNotificationId, setExpandedNotificationId] = useState<string | null>(null);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [aiTutorOpen, setAiTutorOpen] = useState(false);
  const [enrollments, setEnrollments] = useState<StudentPersonalEnrollment[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  /** 进入过创新模块后保活，避免侧栏切到组队等卸载导致对话短暂闪空（权威状态仍靠服务端 method-chat） */
  const [keepIdeationModule, setKeepIdeationModule] = useState(() => getInitialTab() === 'module-ideation');
  const [studentTodoTasks, setStudentTodoTasks] = useState<StudentTodoTask[]>([]);
  const [activeCourseTaskId, setActiveCourseTaskId] = useState<string | null>(null);
  const [activeTrainingTask, setActiveTrainingTask] = useState<{ id: string; moduleId: string } | null>(null);
  const [activeTodoDialogTask, setActiveTodoDialogTask] = useState<TodoListItem | null>(null);
  const [taskSubmitFiles, setTaskSubmitFiles] = useState<File[]>([]);
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [resourceProgressOverrides, setResourceProgressOverrides] = useState<Record<string, ResourceProgress>>({});
  const [overviewMyTeam, setOverviewMyTeam] = useState<GroupingTeam | null>(null);
  const [ideationTopicApproved, setIdeationTopicApproved] = useState(false);
  const [studentMarketChallengeDone, setStudentMarketChallengeDone] = useState(false);
  const [teamMarketReportUploaded, setTeamMarketReportUploaded] = useState(false);
  const [teamProductPrototypeUploaded, setTeamProductPrototypeUploaded] = useState(false);
  const [teamBmcCanvasUploaded, setTeamBmcCanvasUploaded] = useState(false);
  /** 仿真：全员有效轮次 ≥ 3 才算环节完成（与进度条分子解耦） */
  const [simTeamQualified, setSimTeamQualified] = useState(false);
  const [teamPlanApproved, setTeamPlanApproved] = useState(false);
  const [trainingEnded, setTrainingEnded] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveStats, setArchiveStats] = useState<ArchiveStats>({
    knowledgeCount: 0,
    caseCount: 0,
    taskCount: 0,
    evaluationCount: 0,
  });
  const [archiveRecords, setArchiveRecords] = useState<ArchiveRecord[]>([]);
  const [unlockStageModalModuleId, setUnlockStageModalModuleId] = useState<string | null>(null);
  const [catalogResourceNodesByModule, setCatalogResourceNodesByModule] = useState<
    Record<string, TaskResourceNode[]>
  >({});
  const [overviewPanelTab, setOverviewPanelTab] = useState<'notifications' | 'tasks'>('notifications');
  const [overviewNotificationPage, setOverviewNotificationPage] = useState(1);
  const [overviewTaskPage, setOverviewTaskPage] = useState(1);
  const teamGuideShownRef = useRef(false);
  const closingLearningRef = useRef(false);

  const selectedEnrollment = useMemo(
    () => enrollments.find((e) => e.classId === selectedClassId) ?? enrollments[0],
    [enrollments, selectedClassId]
  );

  useEffect(() => {
    getStudentProfile()
      .then((p) => {
        setStudentProfile(p);
      })
      .catch(() => {
        /* 失败时下面仍用 JWT username 兜底 */
      });
  }, []);

  useEffect(() => {
    fetchStudentPersonalEnrollments()
      .then((list) => {
        setEnrollments(list);
        if (list.length === 0) return;
        const saved = sessionStorage.getItem('jiada_student_selected_class_id');
        const available = list.filter((e) => e.canEnterTraining);
        const valid = saved && available.some((e) => e.classId === saved);
        setSelectedClassId(valid ? saved! : available[0]?.classId || '');
      })
      .catch(() => setEnrollments([]));
  }, []);

  useEffect(() => {
    if (activeTab === 'module-ideation') setKeepIdeationModule(true);
  }, [activeTab]);

  useEffect(() => {
    setKeepIdeationModule(false);
  }, [selectedClassId]);

  const refreshTrainingStageSnapshot = useCallback(() => {
    if (!selectedClassId) {
      setTeamFormationComplete(false);
      setOverviewMyTeam(null);
      setIdeationTopicApproved(false);
      setTeamMarketReportUploaded(false);
      setTeamProductPrototypeUploaded(false);
      setTeamBmcCanvasUploaded(false);
      setTeamPlanApproved(false);
      setTrainingEnded(false);
      return;
    }
    const token = getPortalToken('student');
    const studentId = token ? String(parseJwtPayload(token)?.sub || '') : '';

    void (async () => {
      try {
        const [sub, team] = await Promise.all([
          fetchTeamSubmission(selectedClassId),
          fetchStudentMyTeam(selectedClassId).catch(() => null),
        ]);
        const mine = team as GroupingTeam | null;
        setOverviewMyTeam(mine);
        const teamDone = sub.status === 'confirmed' || Boolean(mine);
        setTeamFormationComplete(teamDone);

        if (!teamDone) {
          setIdeationTopicApproved(false);
          setTeamMarketReportUploaded(false);
          setTeamProductPrototypeUploaded(false);
          setTeamBmcCanvasUploaded(false);
          setTeamPlanApproved(false);
          setTrainingEnded(false);
          return;
        }

        const [ideationRes, marketSt, productSt, businessWs, simRecords, planSt] = await Promise.all([
          fetchStudentIdeationProjectTopic(selectedClassId).catch(() => null),
          fetchTeamMarketReportUploadStatus(selectedClassId).catch(() => ({ uploaded: false })),
          fetchTeamProductPrototypeStatus(selectedClassId).catch(() => ({ uploaded: false })),
          fetchBusinessModelWorkspace(selectedClassId).catch(() => null),
          import('../../lib/roleSimulationApi')
            .then((m) => m.fetchRoleSimulationRecords(selectedClassId))
            .catch(() => null),
          fetchBusinessPlanSubmissionStatus(selectedClassId).catch(() => ({
            submission: null,
            trainingEnded: false,
          })),
        ]);

        setIdeationTopicApproved(ideationRes?.topic?.status === 'approved');
        setTeamMarketReportUploaded(Boolean(marketSt.uploaded));
        setTeamProductPrototypeUploaded(Boolean(productSt.uploaded));
        if (businessWs) {
          // 阶段完成以教师审核通过为准
          setTeamBmcCanvasUploaded(String(businessWs.bmcReviewStatus || '') === 'approved');
          const businessDone = countBusinessModelProgressFromWorkspace(businessWs);
          setModuleProgressState((s) =>
            s.business === businessDone ? s : { ...s, business: businessDone }
          );
        } else {
          setTeamBmcCanvasUploaded(false);
        }

        if (simRecords && studentId) {
          const threshold = MODULE_COMPLETE_THRESHOLD.simulation ?? 3;
          // studentId 统一字符串比较，避免 JWT sub 与接口类型不一致导致进度取不到
          const my = (simRecords.progress || []).find(
            (p: any) => String(p.studentId || '') === String(studentId)
          );
          const myEffective = Math.max(0, Number(my?.effectiveRounds || 0));
          // 进度条按个人有效轮次 / 3；全员达标时记满
          const done = simRecords.teamQualified ? threshold : Math.min(threshold, myEffective);
          setSimTeamQualified(Boolean(simRecords.teamQualified));
          setModuleProgressState((s) => (s.simulation === done ? s : { ...s, simulation: done }));
        } else {
          setSimTeamQualified(false);
          setModuleProgressState((s) => (s.simulation === 0 ? s : { ...s, simulation: 0 }));
        }

        setTeamPlanApproved(planSt?.submission?.status === 'approved');
        setTrainingEnded(Boolean(planSt?.trainingEnded));
      } catch {
        setTeamFormationComplete(false);
        setOverviewMyTeam(null);
        setIdeationTopicApproved(false);
        setTeamMarketReportUploaded(false);
        setTeamProductPrototypeUploaded(false);
        setTeamBmcCanvasUploaded(false);
        setTeamPlanApproved(false);
        setTrainingEnded(false);
      }
    })();
  }, [selectedClassId]);

  useEffect(() => {
    if (activeTab !== 'archive' || !selectedClassId) {
      setArchiveLoading(false);
      setArchiveStats({ knowledgeCount: 0, caseCount: 0, taskCount: 0, evaluationCount: 0 });
      setArchiveRecords([]);
      return;
    }
    let cancelled = false;
    setArchiveLoading(true);
    void fetchStudentArchive(selectedClassId, { limit: 80 })
      .then((data) => {
        if (cancelled) return;
        setArchiveStats({
          knowledgeCount: Number(data?.stats?.knowledgeCount || 0),
          caseCount: Number(data?.stats?.caseCount || 0),
          taskCount: Number(data?.stats?.taskCount || 0),
          evaluationCount: Number(data?.stats?.evaluationCount || 0),
        });
        setArchiveRecords(Array.isArray(data?.records) ? data.records : []);
      })
      .catch(() => {
        if (cancelled) return;
        setArchiveStats({ knowledgeCount: 0, caseCount: 0, taskCount: 0, evaluationCount: 0 });
        setArchiveRecords([]);
      })
      .finally(() => {
        if (!cancelled) setArchiveLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, selectedClassId]);

  const refreshTeamFormationComplete = refreshTrainingStageSnapshot;

  useEffect(() => {
    refreshTrainingStageSnapshot();
  }, [refreshTrainingStageSnapshot]);

  useEffect(() => {
    if (!selectedClassId || !teamFormationComplete) {
      setStudentMarketChallengeDone(false);
      return;
    }
    let cancelled = false;
    void fetchMyLatestChallengeSession(selectedClassId)
      .then((session) => {
        if (cancelled) return;
        setStudentMarketChallengeDone(
          Boolean(session?.status === 'completed' && session.finalReport)
        );
      })
      .catch(() => {
        if (!cancelled) setStudentMarketChallengeDone(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedClassId, teamFormationComplete]);

  const refreshTeamMarketReportUploaded = useCallback(() => {
    if (!selectedClassId) {
      setTeamMarketReportUploaded(false);
      return;
    }
    void fetchTeamMarketReportUploadStatus(selectedClassId)
      .then((st) => setTeamMarketReportUploaded(Boolean(st.uploaded)))
      .catch(() => setTeamMarketReportUploaded(false));
  }, [selectedClassId]);

  const refreshTeamProductPrototypeUploaded = useCallback(() => {
    if (!selectedClassId) {
      setTeamProductPrototypeUploaded(false);
      return;
    }
    void fetchTeamProductPrototypeStatus(selectedClassId)
      .then((st) => setTeamProductPrototypeUploaded(Boolean(st.uploaded)))
      .catch(() => setTeamProductPrototypeUploaded(false));
  }, [selectedClassId]);

  useEffect(() => {
    if (!selectedClassId) {
      setCatalogResourceNodesByModule({});
      return;
    }
    let cancelled = false;
    const moduleLabels: Record<string, string> = {
      ideation: '创新思维与创意生成',
      market: '市场调研与用户画像',
      product: '产品设计与迭代',
      business: '商业模式设计',
      simulation: 'AI仿真模拟',
      plan: '商业计划书要点',
    };
    void Promise.all(
      TRAINING_MODULE_CATALOG_KEYS.map(async (key) => {
        try {
          const { nodes } = await fetchStudentCourseResources(key);
          return [key, flattenPublishedCourseLeaves(nodes, key, moduleLabels[key] || key)] as const;
        } catch {
          return [key, [] as TaskResourceNode[]] as const;
        }
      })
    ).then((entries) => {
      if (cancelled) return;
      setCatalogResourceNodesByModule(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [selectedClassId]);

  useEffect(() => {
    setCompletedKnowledgeIds(new Set());
  }, [selectedClassId]);

  // 课程目录的“已检测”状态：从 quiz_attempts(passed) 补齐 completedKnowledgeIds（避免刷新后丢失）
  useEffect(() => {
    if (!selectedClassId) return;
    const kpIds = [
      ...new Set(
        Object.values(catalogResourceNodesByModule)
          .flatMap((nodes) => nodes)
          .flatMap((n) => (n.knowledgePoints || []).map((k) => String(k.id)))
          .filter(Boolean)
      ),
    ];
    if (!kpIds.length) return;
    let cancelled = false;
    void fetchStudentPassedKnowledgePointIds(kpIds)
      .then((passedIds) => {
        if (cancelled || !passedIds.length) return;
        setCompletedKnowledgeIds((prev) => {
          const next = new Set(prev);
          passedIds.forEach((id) => next.add(String(id)));
          return next;
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedClassId, catalogResourceNodesByModule]);

  useEffect(() => {
    if (!selectedClassId) {
      setStudentTodoTasks([]);
      return;
    }
    let cancelled = false;
    fetchStudentTodoTasks(selectedClassId)
      .then((res) => {
        if (!cancelled) {
          setStudentTodoTasks([...(res.tasks || []), ...(res.completedTasks || [])]);
          setCompletedKnowledgeIds((prev) => {
            const next = new Set(prev);
            (res.completedKnowledgePointIds || []).forEach((id) => next.add(String(id)));
            return next;
          });
        }
      })
      .catch(() => {
        if (!cancelled) setStudentTodoTasks([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedClassId]);

  useEffect(() => {
    if (!selectedClassId || teamGuideShownRef.current || tabParam) return;
    void fetchTeamSubmission(selectedClassId)
      .then((sub) => {
        if (isTeamFormationDone(sub.status)) return;
        teamGuideShownRef.current = true;
        setActiveTab('module-team');
        notification.info({
          message: '请先完成组队测评',
          description: '进入「组队与团队管理」完成教师预设题目与 AI 分析并提交，等待教师组队（自我介绍视频选填）。',
          placement: 'topRight',
          duration: 6,
        });
      })
      .catch(() => {});
  }, [selectedClassId, tabParam]);

  const handleClassChange = (classId: string) => {
    const target = enrollments.find((item) => item.classId === classId);
    if (!target) return;

    // 未开放：不可进入，弹窗不可点遮罩关闭，仅可切回已开放班
    if (!target.canEnterTraining) {
      const openClass =
        enrollments.find((e) => e.canEnterTraining && e.classId === selectedClassId) ||
        enrollments.find((e) => e.canEnterTraining);
      const reason = target.unavailableReason || '未到实训时间';
      void appAlert(
        `${reason}。是否切回已经开放实训的班级？`,
        '未到实训时间',
        { okText: '切回已开放班级', maskClosable: false }
      ).then(() => {
        if (openClass) {
          setSelectedClassId(openClass.classId);
          sessionStorage.setItem('jiada_student_selected_class_id', openClass.classId);
        }
      });
      return;
    }

    setSelectedClassId(classId);
    sessionStorage.setItem('jiada_student_selected_class_id', classId);
  };

  const overallProgress = {
    currentLevel: '初级创业者', nextLevel: '中级创业者', levelProgress: 36,
  };

  const { studentDisplayName } = useMemo(() => {
    const token = getPortalToken('student');
    const payloadUser = token ? parseJwtPayload(token)?.username : null;
    const jwtFallback = (payloadUser && String(payloadUser).trim()) || '';

    const realName = (studentProfile?.realName && String(studentProfile.realName).trim()) || '';
    const studentNo = (studentProfile?.studentNo && String(studentProfile.studentNo).trim()) || '';
    const loginUsername = (studentProfile?.username && String(studentProfile.username).trim()) || jwtFallback;

    /** 姓名 → 学号 → 登录名（JWT 常为数字内部账号，不适合作为首选展示） */
    const name = realName || studentNo || loginUsername || '学生';
    return { studentDisplayName: name };
  }, [studentProfile]);
  const currentStudentId = useMemo(() => {
    const token = getPortalToken('student');
    return token ? String(parseJwtPayload(token)?.sub || '') : '';
  }, []);
  const isModuleCompletedByProgress = (moduleId: string) => {
    if (moduleId === 'team') return teamFormationComplete;
    if (moduleId === 'ideation') return ideationTopicApproved || (moduleProgressState.ideation || 0) >= (MODULE_COMPLETE_THRESHOLD.ideation ?? 99);
    if (moduleId === 'market') return teamMarketReportUploaded;
    if (moduleId === 'product') return teamProductPrototypeUploaded;
    // 商业模式：教师审核通过才算完成（上传仅 pending）
    if (moduleId === 'business') return teamBmcCanvasUploaded;
    // 仿真完成：必须以全员达标为准，不能仅看个人轮次满 3
    if (moduleId === 'simulation') return simTeamQualified;
    if (moduleId === 'plan') return teamPlanApproved || (moduleProgressState.plan || 0) >= (MODULE_COMPLETE_THRESHOLD.plan ?? 99);
    const val = moduleProgressState[moduleId] || 0;
    return val >= (MODULE_COMPLETE_THRESHOLD[moduleId] ?? 99);
  };

  const getStageDateSetting = (moduleId: string) =>
    selectedEnrollment?.courseSettings?.find((setting) => setting.moduleKey === moduleId) || null;

  const isModuleSkipped = (moduleId: string) => {
    if (moduleId === 'team') return false;
    return Boolean(getStageDateSetting(moduleId)?.skipped);
  };

  /** 当前班级实际启用的实训链路（组队 + 未略过环节） */
  const activeTrainingOrder = useMemo(() => {
    const skipped = new Set(
      (selectedEnrollment?.courseSettings || [])
        .filter((s) => s.moduleKey !== 'team' && s.skipped)
        .map((s) => s.moduleKey)
    );
    return TRAINING_MODULE_ORDER.filter((id) => id === 'team' || !skipped.has(id));
  }, [selectedEnrollment?.courseSettings]);

  /**
   * 计划书已通过才可能冻结；若启用链路里仍有未完成环节（如略过恢复后的 2/4/6），
   * 不冻结前序模块，否则市场调研上传等会全部禁用。
   */
  const trainingFrozen = useMemo(() => {
    if (!trainingEnded && !teamPlanApproved) return false;
    if (!teamPlanApproved) return false;
    return activeTrainingOrder
      .filter((id) => id !== 'plan')
      .every((id) => isModuleCompletedByProgress(id));
  }, [
    trainingEnded,
    teamPlanApproved,
    activeTrainingOrder,
    teamFormationComplete,
    ideationTopicApproved,
    teamMarketReportUploaded,
    teamProductPrototypeUploaded,
    teamBmcCanvasUploaded,
    simTeamQualified,
    moduleProgressState,
  ]);

  // 当前 Tab 对应环节已略过时，跳回概览，避免直链残留
  useEffect(() => {
    if (!activeTab.startsWith('module-')) return;
    const moduleId = TAB_TO_MODULE_ID[activeTab];
    if (!moduleId || moduleId === 'team') return;
    if (!isModuleSkipped(moduleId)) return;
    setActiveTab('overview');
    const params = new URLSearchParams(searchParams);
    params.set('tab', 'overview');
    navigate({ pathname: '/student-center', search: `?${params.toString()}` }, { replace: true });
  }, [activeTab, selectedEnrollment?.courseSettings, searchParams, navigate]);

  const isBeforeStageStart = (moduleId: string) => {
    const startDate = getStageDateSetting(moduleId)?.startDate;
    // 未配置开始日：不按日期锁定（略过恢复后常见），仍受前序完成约束
    if (!startDate) return false;
    const start = new Date(`${startDate}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return start.getTime() > today.getTime();
  };

  /** 本环是否已有进度（用于恢复前序环节后仍可继续已进入的后续环） */
  const hasModuleEnteredProgress = (moduleId: string) => {
    if (isModuleCompletedByProgress(moduleId)) return true;
    if (moduleId === 'market' && teamMarketReportUploaded) return true;
    if (moduleId === 'product' && teamProductPrototypeUploaded) return true;
    if (moduleId === 'business' && teamBmcCanvasUploaded) return true;
    return (moduleProgressState[moduleId] || 0) > 0;
  };

  const getStageStartLockedHint = (moduleId: string) => {
    const setting = getStageDateSetting(moduleId);
    if (!setting?.startDate) return '该实训阶段尚未配置开始日期';
    return `该实训阶段将于 ${setting.startDate} 开放`;
  };

  const getStagePeriodText = (moduleId: string) => {
    const setting = getStageDateSetting(moduleId);
    if (!setting?.startDate && !setting?.deadlineDate) return '未配置周期';
    if (setting.startDate && setting.deadlineDate) return `${setting.startDate} 至 ${setting.deadlineDate}`;
    return setting.startDate ? `开始：${setting.startDate}` : `截止：${setting.deadlineDate}`;
  };

  const getModuleProgressPercent = (moduleId: string): number => {
    if (moduleId === 'business' && teamBmcCanvasUploaded) return 100;
    if (moduleId === 'product' && teamProductPrototypeUploaded) return 100;
    if (moduleId === 'simulation' && simTeamQualified) return 100;
    const val = moduleProgressState[moduleId as keyof typeof moduleProgressState] ?? 0;
    const th = MODULE_COMPLETE_THRESHOLD[moduleId] ?? 99;
    return Math.min(100, Math.round((val / th) * 100));
  };

  const getSidebarModuleUi = (moduleId: string) => {
    if (isModuleSkipped(moduleId)) {
      return { locked: true, status: 'locked' as const, displayPercent: 0, isTeam: false, hidden: true };
    }
    const idx = activeTrainingOrder.indexOf(moduleId as (typeof TRAINING_MODULE_ORDER)[number]);
    if (idx < 0) {
      return { locked: true, status: 'locked' as const, displayPercent: 0, isTeam: false, hidden: true };
    }
    const isTeam = moduleId === 'team';
    if (isBeforeStageStart(moduleId)) {
      return { locked: true, status: 'locked' as const, displayPercent: 0, isTeam, hidden: false };
    }
    if (isTeam) {
      if (teamFormationComplete) {
        return { locked: false, status: 'completed' as const, displayPercent: null, isTeam: true, hidden: false };
      }
      return { locked: false, status: 'in_progress' as const, displayPercent: null, isTeam: true, hidden: false };
    }
    if (!teamFormationComplete) {
      return { locked: true, status: 'locked' as const, displayPercent: 0, isTeam: false, hidden: false };
    }
    const priorsDone = activeTrainingOrder.slice(0, idx).every((prevId) => isModuleCompletedByProgress(prevId));
    // 2B：前序未齐时，若本环已进入/完成则仍可继续；新阶段仍锁定
    if (!priorsDone && !hasModuleEnteredProgress(moduleId)) {
      return { locked: true, status: 'locked' as const, displayPercent: 0, isTeam: false, hidden: false };
    }
    if (isModuleCompletedByProgress(moduleId)) {
      return { locked: false, status: 'completed' as const, displayPercent: 100, isTeam: false, hidden: false };
    }
    return {
      locked: false,
      status: 'in_progress' as const,
      displayPercent: getModuleProgressPercent(moduleId),
      isTeam: false,
      hidden: false,
    };
  };

  const getModuleUnlockStatus = (moduleId: string): 'locked' | 'in_progress' | 'completed' => {
    return getSidebarModuleUi(moduleId).status;
  };

  const trainingModuleMenuItems = (
    [
      { key: 'module-team' as TabType, label: '组队与团队管理', icon: 'ri-team-line', moduleId: 'team' },
      { key: 'module-ideation' as TabType, label: '创新思维与创意生成', icon: 'ri-lightbulb-line', moduleId: 'ideation' },
      { key: 'module-market' as TabType, label: '市场调研与用户画像', icon: 'ri-search-line', moduleId: 'market' },
      { key: 'module-product' as TabType, label: '产品设计与迭代', icon: 'ri-pencil-ruler-line', moduleId: 'product' },
      { key: 'module-business' as TabType, label: '商业模式设计', icon: 'ri-pie-chart-line', moduleId: 'business' },
      { key: 'module-simulation' as TabType, label: 'AI仿真模拟', icon: 'ri-robot-line', moduleId: 'simulation' },
      { key: 'module-plan' as TabType, label: '商业计划书要点', icon: 'ri-file-text-line', moduleId: 'plan' },
    ] as const
  ).filter((item) => !isModuleSkipped(item.moduleId));

  const moduleProgress = [
    { moduleId: 'team', moduleName: '组队与团队管理', totalKnowledge: 4, completedKnowledge: moduleProgressState.team, totalTasks: 3, completedTasks: 3, status: getModuleUnlockStatus('team'), color: 'from-purple-500 to-purple-600' },
    { moduleId: 'ideation', moduleName: '创新思维与创意生成', totalKnowledge: 6, completedKnowledge: moduleProgressState.ideation, totalTasks: 4, completedTasks: 3, status: getModuleUnlockStatus('ideation'), color: 'from-teal-500 to-teal-600' },
    { moduleId: 'market', moduleName: '市场调研与用户画像', totalKnowledge: 8, completedKnowledge: moduleProgressState.market, totalTasks: 5, completedTasks: 4, status: getModuleUnlockStatus('market'), color: 'from-green-500 to-green-600' },
    { moduleId: 'product', moduleName: '产品设计与迭代', totalKnowledge: 7, completedKnowledge: moduleProgressState.product, totalTasks: 4, completedTasks: 1, status: getModuleUnlockStatus('product'), color: 'from-orange-500 to-orange-600' },
    { moduleId: 'business', moduleName: '商业模式设计', totalKnowledge: 5, completedKnowledge: moduleProgressState.business, totalTasks: 6, completedTasks: 0, status: getModuleUnlockStatus('business'), color: 'from-pink-500 to-pink-600' },
    { moduleId: 'simulation', moduleName: 'AI仿真模拟', totalKnowledge: 3, completedKnowledge: moduleProgressState.simulation, totalTasks: 3, completedTasks: 0, status: getModuleUnlockStatus('simulation'), color: 'from-indigo-500 to-indigo-600' },
    { moduleId: 'plan', moduleName: '商业计划书要点', totalKnowledge: 4, completedKnowledge: moduleProgressState.plan, totalTasks: 2, completedTasks: 0, status: getModuleUnlockStatus('plan'), color: 'from-teal-500 to-teal-600' },
  ].filter((m) => !isModuleSkipped(m.moduleId));

  /** 未解锁时提示需先完成的实训阶段（按实际启用链路） */
  const getPrerequisiteStageHint = (targetModuleId: string): string | null => {
    if (isModuleSkipped(targetModuleId)) return '该实训阶段已略过';
    const idx = activeTrainingOrder.indexOf(targetModuleId as (typeof TRAINING_MODULE_ORDER)[number]);
    if (idx < 0) return null;
    if (getSidebarModuleUi(targetModuleId).locked) {
      if (isBeforeStageStart(targetModuleId)) {
        return getStageStartLockedHint(targetModuleId);
      }
      if (!teamFormationComplete) {
        const teamName = moduleProgress.find((m) => m.moduleId === 'team')?.moduleName ?? '组队与团队管理';
        return `请先完成：${teamName}`;
      }
      for (let i = 0; i < idx; i++) {
        const prevId = activeTrainingOrder[i];
        if (!isModuleCompletedByProgress(prevId)) {
          const name = moduleProgress.find((m) => m.moduleId === prevId)?.moduleName ?? prevId;
          return `请先完成：${name}`;
        }
      }
    }
    return null;
  };

  const knowledgePoints = (() => {
    const byId = new Map<string, KnowledgeCardData>();

    const ingestNode = (
      node: TaskResourceNode,
      moduleId: string,
      taskModuleLabel: string
    ) => {
      (node.knowledgePoints || []).forEach((point) => {
        const completed = completedKnowledgeIds.has(point.id);
        const locked = getSidebarModuleUi(moduleId).locked;
        const existing = byId.get(point.id);
        const resources = (node.resources || []).map((resource) => {
          const meta = resource as typeof resource & Partial<LearningDetailResource>;
          return {
            id: resource.id,
            nodeId: resource.nodeId,
            title: resource.name,
            type: resource.type,
            previewType: meta.previewType,
            previewStatus: meta.previewStatus,
            contentHash: meta.contentHash,
            mimeType: resource.mimeType,
            size: resource.size,
            canPreview: resource.canPreview,
            progress: mergeResourceProgress(meta.progress, resourceProgressOverrides[resource.id]),
          };
        });
        if (existing) {
          if (!existing.nodeIds.includes(node.id)) existing.nodeIds.push(node.id);
          resources.forEach((resource) => {
            if (!existing.resources.some((item) => item.id === resource.id)) {
              existing.resources.push(resource);
            }
          });
          if (!resources.length && !existing.resources.some((item) => item.id === `node-${node.id}`)) {
            existing.resources.push({ id: `node-${node.id}`, nodeId: node.id, title: node.title, type: 'case', mimeType: '', size: '', canPreview: false });
          }
          return;
        }
        byId.set(point.id, {
          id: point.id,
          name: point.title,
          module: moduleId,
          moduleName: node.moduleName || taskModuleLabel,
          description: point.description,
          status: completed ? 'completed' : locked ? 'locked' : 'learning',
          progress: completed ? 100 : calculateKnowledgeResourceProgress(resources),
          abilityPoints: [],
          resources: resources.length ? resources : [{ id: `node-${node.id}`, nodeId: node.id, title: node.title, type: 'case', mimeType: '', size: '', canPreview: false }],
          nodeIds: [node.id],
          quizId: point.id,
          sortOrder: point.sortOrder,
        });
      });
    };

    studentTodoTasks.forEach((task) => {
      (task.resourceNodes || []).forEach((node) => {
        const moduleId = node.moduleKey || task.moduleId || '';
        ingestNode(node, moduleId, task.module);
      });
    });

    Object.entries(catalogResourceNodesByModule).forEach(([moduleId, nodes]) => {
      const label = moduleProgress.find((m) => m.moduleId === moduleId)?.moduleName || moduleId;
      nodes.forEach((node) => ingestNode(node, moduleId, label));
    });

    return Array.from(byId.values()).map((item) => ({
      ...item,
      progress: item.status === 'completed' ? 100 : calculateKnowledgeResourceProgress(item.resources),
    })).sort((a, b) => {
      const moduleDiff = TRAINING_MODULE_ORDER.indexOf(a.module as (typeof TRAINING_MODULE_ORDER)[number]) - TRAINING_MODULE_ORDER.indexOf(b.module as (typeof TRAINING_MODULE_ORDER)[number]);
      return moduleDiff || a.sortOrder - b.sortOrder || Number(a.id) - Number(b.id);
    });
  })();

  const abilityPointsData = [
    { id: 'a1', name: '创新思维', category: '核心能力', level: 4, maxLevel: 5, description: '发散思维、创意生成、创新方法运用', obtainedFrom: '创新思维与创意生成 - 创意筛选报告审核通过', obtainedDate: '2024-12-15' },
    { id: 'a2', name: '团队协作', category: '核心能力', level: 3, maxLevel: 5, description: '沟通协调、任务分工、冲突解决', obtainedFrom: '组队与团队管理 - 团队组建完成', obtainedDate: '2024-12-01' },
    { id: 'a3', name: '系统思维', category: '核心能力', level: 3, maxLevel: 5, description: '全局观、逻辑分析、结构化思考', obtainedFrom: '创新思维与创意生成 - SCAMPER方法实践', obtainedDate: '2024-12-18' },
    { id: 'a4', name: '用户洞察', category: '专业能力', level: 3, maxLevel: 5, description: '需求挖掘、用户研究、同理心', obtainedFrom: '市场调研与用户画像 - 用户画像绘制完成', obtainedDate: '2024-12-25' },
    { id: 'a5', name: '数据分析', category: '专业能力', level: 2, maxLevel: 5, description: '数据收集、统计分析、可视化呈现', obtainedFrom: '市场调研与用户画像 - 调研数据分析', obtainedDate: '2024-12-22' },
    { id: 'a6', name: '沟通能力', category: '通用能力', level: 3, maxLevel: 5, description: '表达清晰、倾听理解、说服影响', obtainedFrom: '组队与团队管理 - 团队讨论参与', obtainedDate: '2024-12-05' },
  ];

  const knowledgeModules = [
    { id: 'ideation', name: '创新思维', color: 'bg-gradient-to-r from-teal-500 to-teal-600' },
    { id: 'market', name: '市场调研', color: 'bg-gradient-to-r from-green-500 to-green-600' },
    { id: 'product', name: '产品设计', color: 'bg-gradient-to-r from-orange-500 to-orange-600' },
    { id: 'business', name: '商业模式', color: 'bg-gradient-to-r from-pink-500 to-pink-600' },
    { id: 'simulation', name: 'AI角色', color: 'bg-gradient-to-r from-indigo-500 to-indigo-600' },
    { id: 'plan', name: '商业计划', color: 'bg-gradient-to-r from-teal-600 to-cyan-600' },
  ];

  // 学习档案数据来自后端接口（archiveStats / archiveRecords）

  const handleQuizPass = (
    knowledgeId: string,
    moduleId: string,
    score: number,
    answers: Record<string, number | number[] | string>,
  ) => {
    void submitStudentKnowledgeQuizAttempt(knowledgeId, { score, answers }).catch(() => {});
    setQuizStates((prev) => ({ ...prev, [knowledgeId]: 'passed' }));
    setCompletedKnowledgeIds((prev) => new Set([...prev, knowledgeId]));
    setModuleProgressState((prev) => ({ ...prev, [moduleId]: Math.min((prev[moduleId] || 0) + 1, 99) }));
  };

  const startKnowledgeQuiz = async (knowledgeId: string) => {
    setQuizLoadingId(knowledgeId);
    try {
      const config = await fetchStudentKnowledgeQuiz(knowledgeId);
      setActiveQuizConfig(config);
      setActiveQuizId(knowledgeId);
    } catch (e) {
      notification.warning({
        message: '暂无检测题',
        description: e instanceof Error ? e.message : '该知识点暂未配置检测题',
      });
    } finally {
      setQuizLoadingId(null);
    }
  };

  const handleKnowledgeQuizClick = (kp: KnowledgeCardData) => {
    const catalogLeaves = getCatalogLeavesWithProgress(selectedModule);
    if (!canStartKnowledgeQuiz(kp.id, catalogLeaves)) {
      notification.warning({
        message: '暂不可检测',
        description: `请先完成对应小节课程学习至 ${COURSE_GATE_PERCENT}% 后再进行知识点检测。`,
      });
      return;
    }
    void startKnowledgeQuiz(kp.id);
  };

  const unreadCount = notificationList.filter(n => !n.isRead).length;
  const completedCount = moduleProgress.filter(m => m.status === 'completed').length;
  const inProgressCount = moduleProgress.filter(m => m.status === 'in_progress').length;

  const markAsRead = (id: string) => {
    setNotificationList((prev) => {
      const target = prev.find((n) => n.id === id);
      if (!target || target.isRead) return prev;
      void markStudentNotificationRead(id).catch(() => {});
      return prev.map((n) => (n.id === id ? { ...n, isRead: true } : n));
    });
  };
  const markAllAsRead = () => {
    const unreadIds = notificationList.filter((n) => !n.isRead).map((n) => n.id);
    setNotificationList((prev) => prev.map((n) => ({ ...n, isRead: true })));
    unreadIds.forEach((id) => void markStudentNotificationRead(id).catch(() => {}));
  };

  const loadNotifications = useCallback(() => {
    return fetchStudentNotifications()
      .then(setNotificationList)
      .catch(() => setNotificationList([]));
  }, []);

  const goFromNotificationLink = (rawLink: string) => {
    const path = rawLink.startsWith('/') ? rawLink : `/student-center?${rawLink}`;
    const qIdx = path.indexOf('?');
    const pathname = qIdx >= 0 ? path.slice(0, qIdx) : path;
    const params = new URLSearchParams(qIdx >= 0 ? path.slice(qIdx + 1) : '');
    const tab = params.get('tab');
    if (tab) setActiveTab(tab as TabType);
    if (!tab || tab === 'overview') {
      const panel = params.get('panel');
      if (panel === 'tasks' || panel === 'notifications') setOverviewPanelTab(panel);
      const taskId = params.get('taskId');
      if (taskId && panel === 'tasks') {
        setPendingTaskOpen({ classId: params.get('classId'), taskId });
      }
    }
    navigate({ pathname: pathname || '/student-center', search: params.toString() ? `?${params.toString()}` : '' });
  };

  const openNotificationDetail = (notice: StudentNotificationRow) => {
    markAsRead(notice.id);
    setNotificationDetail(notice);
  };

  const handleOverviewNotificationView = (notice: StudentNotificationRow) => {
    const latest = notificationList.find((n) => n.id === notice.id) || notice;
    openNotificationDetail(latest);
  };

  const changeActiveTab = (tab: TabType) => {
    setMobileNavOpen(false);
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams);
    params.set('tab', tab);
    navigate({ pathname: '/student-center', search: `?${params.toString()}` });
  };

  const filteredNotifications = notificationList.filter(n => {
    if (notificationFilter !== 'all' && n.type !== notificationFilter) return false;
    if (notificationReadFilter === 'unread' && n.isRead) return false;
    if (notificationReadFilter === 'read' && !n.isRead) return false;
    return true;
  });

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    const panel = searchParams.get('panel');
    const tab = searchParams.get('tab');
    if ((!tab || tab === 'overview') && (panel === 'tasks' || panel === 'notifications')) {
      setOverviewPanelTab(panel);
    }
    const taskId = searchParams.get('taskId');
    if (taskId && panel === 'tasks') {
      setPendingTaskOpen({ classId: searchParams.get('classId'), taskId });
    }
  }, [searchParams]);

  useEffect(() => {
    const noticeId = searchParams.get('noticeId');
    if (!noticeId || openedNoticeFromUrlRef.current === noticeId) return;
    const notice = notificationList.find((n) => n.id === noticeId);
    if (!notice) return;
    openedNoticeFromUrlRef.current = noticeId;
    setActiveTab('overview');
    setOverviewPanelTab('notifications');
    openNotificationDetail(notice);
  }, [searchParams, notificationList]);

  useEffect(() => {
    if (activeTab === 'notifications') void loadNotifications();
  }, [activeTab, loadNotifications]);

  useEffect(() => {
    if (tabParam) setActiveTab(tabParam as TabType);
  }, [tabParam]);

  const getNotificationTypeStyle = (type: string) => {
    switch (type) {
      case 'guidance': return 'bg-teal-100 text-teal-700';
      case 'reminder': return 'bg-orange-100 text-orange-700';
      case 'evaluation': return 'bg-purple-100 text-purple-700';
      case 'team_join': return 'bg-cyan-100 text-cyan-800';
      case 'system': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getNotificationTypeText = (type: string) => {
    switch (type) {
      case 'guidance': return '引导意见';
      case 'reminder': return '督促通知';
      case 'evaluation': return '评价反馈';
      case 'team_join': return '加入团队';
      case 'system': return '系统通知';
      default: return '消息';
    }
  };

  const learningMenuItems = [
    { key: 'overview' as TabType, label: '进度看板', icon: 'ri-dashboard-line' },
    { key: 'knowledge' as TabType, label: '实践课程', icon: 'ri-book-2-line' },
    // { key: 'ability' as TabType, label: '能力点管理', icon: 'ri-medal-line' },
    { key: 'archive' as TabType, label: '学习档案', icon: 'ri-folder-line' },
    { key: 'guide' as TabType, label: '实训指南', icon: 'ri-book-open-line' },
    // { key: 'notifications' as TabType, label: '消息通知', icon: 'ri-notification-line' },
  ];

  const getModuleProgress = (moduleId: string): number => getModuleProgressPercent(moduleId);

  const getCurrentLabel = (): string => {
    const allItems = [...learningMenuItems, ...trainingModuleMenuItems];
    const item = allItems.find(i => i.key === activeTab);
    return item?.label || '学生工作台';
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'completed': return '已完成';
      case 'in_progress': return '进行中';
      case 'learning': return '学习中';
      case 'locked': return '未解锁';
      default: return '未开始';
    }
  };

  const getKnowledgeStatusColor = (status: string): string => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700 border-green-200';
      case 'learning': return 'bg-teal-100 text-teal-700 border-teal-200';
      case 'locked': return 'bg-gray-100 text-gray-400 border-gray-200';
      default: return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  const getRecordIcon = (type: string): string => {
    switch (type) {
      case 'knowledge': return 'ri-book-2-line';
      case 'case': return 'ri-lightbulb-line';
      case 'task': return 'ri-edit-box-line';
      case 'evaluation': return 'ri-star-line';
      default: return 'ri-file-line';
    }
  };

  const getRecordColor = (type: string): string => {
    switch (type) {
      case 'knowledge': return 'from-teal-500 to-teal-600';
      case 'case': return 'from-green-500 to-green-600';
      case 'task': return 'from-orange-500 to-orange-600';
      case 'evaluation': return 'from-purple-500 to-purple-600';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  const courseTaskSource = activeCourseTaskId
    ? studentTodoTasks.filter((task) => task.id === activeCourseTaskId)
    : studentTodoTasks;
  const shouldShowCourseNode: (node: StudentTodoTask['resourceNodes'][number]) => boolean = () => true;

  const knowledgeChapterData = (() => {
    const nodeMap = new Map<string, ChapterTreeNode>();
    const leafIds = new Set<string>();

    const ensureNode = (item: { id: string; parentId: string | null; title: string; level: number; sortOrder: number }) => {
      if (!nodeMap.has(item.id)) {
        nodeMap.set(item.id, {
          id: item.id,
          parentId: item.parentId,
          title: item.title,
          level: item.level,
          sortOrder: item.sortOrder,
          children: [],
        });
      }
    };

    courseTaskSource.forEach((task) => {
      (task.resourceNodes || []).forEach((node) => {
        if (!shouldShowCourseNode(node)) return;
        const moduleId = node.moduleKey || task.moduleId || '';
        if (moduleId !== selectedModule) return;
        leafIds.add(node.id);
        [...(node.ancestors || []), node].forEach((item) => {
          ensureNode({
            id: item.id,
            parentId: item.parentId,
            title: item.title,
            level: item.level,
            sortOrder: item.sortOrder,
          });
        });
      });
    });

    // 补充全局课程目录中未被班级待办覆盖的节点
    (catalogResourceNodesByModule[selectedModule] || []).forEach((node) => {
      if (leafIds.has(node.id)) return; // 已由待办任务添加，跳过
      leafIds.add(node.id);
      [...(node.ancestors || []), node].forEach((item) => {
        ensureNode({
          id: item.id,
          parentId: item.parentId,
          title: item.title,
          level: item.level,
          sortOrder: item.sortOrder,
        });
      });
    });

    const roots: ChapterTreeNode[] = [];
    nodeMap.forEach((node) => {
      if (node.parentId && nodeMap.has(node.parentId)) {
        const parent = nodeMap.get(node.parentId);
        if (parent && !parent.children.some((child) => child.id === node.id)) parent.children.push(node);
      } else {
        roots.push(node);
      }
    });

    const sortTree = (nodes: ChapterTreeNode[]) => {
      nodes.sort((a, b) => a.level - b.level || a.sortOrder - b.sortOrder || Number(a.id) - Number(b.id));
      nodes.forEach((node) => sortTree(node.children));
    };
    sortTree(roots);

    const toTreeData = (nodes: ChapterTreeNode[]): AntdTreeNode[] =>
      nodes.map((node) => ({
        title: node.title,
        key: node.id,
        children: node.children.length ? toTreeData(node.children) : undefined,
      }));

    const collectLeafIds = (nodeId: string) => {
      const ids = new Set<string>();
      const walk = (node?: ChapterTreeNode) => {
        if (!node) return;
        if (leafIds.has(node.id)) ids.add(node.id);
        node.children.forEach(walk);
      };
      walk(nodeMap.get(nodeId));
      return Array.from(ids);
    };

    return { treeData: toTreeData(roots), nodeMap, collectLeafIds };
  })();
  const activeChapterId = selectedChapterId && knowledgeChapterData.nodeMap.has(selectedChapterId)
    ? selectedChapterId
    : String(knowledgeChapterData.treeData[0]?.key || '');
  const activeChapterNode = activeChapterId ? knowledgeChapterData.nodeMap.get(activeChapterId) : undefined;
  const activeChapterIsLeaf = Boolean(activeChapterNode && activeChapterNode.children.length === 0);
  const selectedChapterLeafIds = new Set(activeChapterIsLeaf && activeChapterId ? knowledgeChapterData.collectLeafIds(activeChapterId) : []);
  const selectedChapterKnowledge = selectedChapterLeafIds.size
    ? knowledgePoints.filter((kp) =>
      kp.module === selectedModule
      && kp.nodeIds.some((nodeId) => selectedChapterLeafIds.has(nodeId))
    )
    : [];
  const selectedChapterResources = (() => {
    const byId = new Map<string, LearningDetailResource>();
    const ingestNode = (node: TaskResourceNode) => {
      if (!selectedChapterLeafIds.has(node.id)) return;
      (node.resources || []).forEach((resource) => {
        const meta = resource as typeof resource & Partial<LearningDetailResource>;
        byId.set(resource.id, {
          id: resource.id,
          nodeId: resource.nodeId,
          title: resource.name,
          type: resource.type,
          previewType: meta.previewType,
          previewStatus: meta.previewStatus,
          contentHash: meta.contentHash,
          mimeType: resource.mimeType,
          size: resource.size,
          canPreview: resource.canPreview,
          progress: mergeResourceProgress(meta.progress, resourceProgressOverrides[resource.id]),
        });
      });
    };
    courseTaskSource.forEach((task) => {
      (task.resourceNodes || []).forEach((node) => {
        if (!shouldShowCourseNode(node)) return;
        ingestNode(node);
      });
    });
    // 补充全局课程目录资源
    (catalogResourceNodesByModule[selectedModule] || []).forEach(ingestNode);
    return Array.from(byId.values());
  })();

  useEffect(() => {
    if (searchParams.get('learning') !== 'resource') return;
    const moduleParam = searchParams.get('learningModule');
    const chapterParam = searchParams.get('learningChapter');
    if (moduleParam && moduleParam !== selectedModule) {
      setSelectedModule(moduleParam);
      return;
    }
    if (chapterParam && chapterParam !== selectedChapterId) {
      setSelectedChapterId(chapterParam);
    }
  }, [searchParams, selectedModule, selectedChapterId]);

  const getResourceTypeText = (type: LearningDetailResource['type']) => {
    switch (type) {
      case 'video': return '视频';
      case 'audio': return '音频';
      case 'pdf': return '文档';
      case 'image': return '图片';
      case 'archive': return '压缩包';
      case 'case': return '案例';
      default: return '资源';
    }
  };

  const getResourceIcon = (type: LearningDetailResource['type']) => {
    switch (type) {
      case 'video': return 'ri-video-line';
      case 'audio': return 'ri-volume-up-line';
      case 'pdf': return 'ri-file-pdf-2-line';
      case 'image': return 'ri-image-line';
      case 'archive': return 'ri-file-zip-line';
      case 'case': return 'ri-book-open-line';
      default: return 'ri-file-list-line';
    }
  };

  const getNodeChapterTags = (node: StudentTodoTask['resourceNodes'][number]) => {
    const unitLabels = ['章', '节', '小节'];
    return [...(node.ancestors || []), node].map((item, index) => {
      const order = Number(item.sortOrder);
      const n = Number.isFinite(order) && order > 0 ? order : index + 1;
      return `第${n}${unitLabels[index] || '层'} ${item.title}`;
    });
  };

  const ideationLearningResources: IdeationLearningResource[] = (() => {
    const byKey = new Map<string, IdeationLearningResource>();
    studentTodoTasks.forEach((task) => {
      if ((task.moduleId || '') !== 'ideation') return;
      (task.resourceNodes || []).forEach((node) => {
        const moduleId = node.moduleKey || task.moduleId || '';
        if (moduleId !== 'ideation') return;
        (node.resources || []).forEach((resource) => {
          const progress = normalizeResourceProgress(
            mergeResourceProgress(resource.progress, resourceProgressOverrides[resource.id])
          ).progressPercent;
          byKey.set(`${node.id}:${resource.id}`, {
            id: resource.id,
            nodeId: node.id,
            title: resource.name,
            type: getResourceTypeText(resource.type),
            progress,
            chapterTags: getNodeChapterTags(node),
          });
        });
      });
    });
    return Array.from(byKey.values());
  })();

  const openLearningResources = (resources: LearningDetailResource[]) => {
    if (resources.length === 0) return;
    closingLearningRef.current = false;
    const chapterTitle = knowledgeChapterData.nodeMap.get(activeChapterId)?.title || '';
    const params = new URLSearchParams(searchParams);
    params.set('tab', 'knowledge');
    params.set('learning', 'resource');
    params.set('learningModule', selectedModule);
    if (activeChapterId) params.set('learningChapter', activeChapterId);
    if (!params.get('resource')) params.set('resource', resources[0].id);
    setSearchParams(params);
    setActiveLearningKnowledge({
      id: activeChapterId || resources[0].id,
      name: chapterTitle || resources[0].title,
      module: selectedModule,
      moduleName: knowledgeModules.find((mod) => mod.id === selectedModule)?.name || selectedModule,
      description: `${resources.length} 个学习资源`,
      resources,
      knowledgePoints: selectedChapterKnowledge.map((point) => ({
        id: point.id,
        title: point.name,
        description: point.description,
      })),
    });
  };

  const openIdeationLearningResource = (item: IdeationLearningResource) => {
    const task = studentTodoTasks.find((row) =>
      (row.moduleId || '') === 'ideation' &&
      row.resourceNodes.some(
        (node) =>
          node.id === item.nodeId &&
          (node.resources || []).some((resource) => resource.id === item.id)
      )
    );
    const node = task?.resourceNodes.find((row) => row.id === item.nodeId);
    if (!task || !node) return;
    closingLearningRef.current = true;
    const params = new URLSearchParams(searchParams);
    params.set('tab', 'knowledge');
    params.delete('learning');
    params.delete('learningModule');
    params.delete('learningChapter');
    params.delete('resource');
    setSearchParams(params);
    setActiveTab('knowledge');
    setKnowledgeSubTab('knowledge');
    setActiveCourseTaskId(null);
    setSelectedModule('ideation');
    setSelectedChapterId(node.id);
    setActiveLearningKnowledge(null);
  };

  useEffect(() => {
    if (searchParams.get('learning') !== 'resource') {
      closingLearningRef.current = false;
      if (activeLearningKnowledge) setActiveLearningKnowledge(null);
      return;
    }
    if (closingLearningRef.current || activeLearningKnowledge) return;
    if (!activeChapterIsLeaf || selectedChapterResources.length === 0) return;
    const chapterTitle = knowledgeChapterData.nodeMap.get(activeChapterId)?.title || '';
    setActiveLearningKnowledge({
      id: activeChapterId || selectedChapterResources[0].id,
      name: chapterTitle || selectedChapterResources[0].title,
      module: selectedModule,
      moduleName: knowledgeModules.find((mod) => mod.id === selectedModule)?.name || selectedModule,
      description: `${selectedChapterResources.length} 个学习资源`,
      resources: selectedChapterResources,
      knowledgePoints: selectedChapterKnowledge.map((point) => ({
        id: point.id,
        title: point.name,
        description: point.description,
      })),
    });
  }, [
    searchParams,
    activeLearningKnowledge,
    activeChapterIsLeaf,
    activeChapterId,
    selectedChapterResources,
    selectedChapterKnowledge,
    selectedModule,
  ]);

  const renderChapterResourceCard = (resources: LearningDetailResource[]) => {
    const firstResource = resources[0];
    const chapterTitle = knowledgeChapterData.nodeMap.get(activeChapterId)?.title || firstResource.title;
    const resourceTypeText = Array.from(new Set(resources.map((resource) => getResourceTypeText(resource.type)))).join('、');
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-all">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center flex-shrink-0">
            <i className={`${getResourceIcon(firstResource.type)} text-xl`}></i>
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-bold text-gray-900 line-clamp-2 h-10">{chapterTitle}</h4>
            <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
              <span>{resources.length} 个资源</span>
              {resourceTypeText && <><span>·</span><span>{resourceTypeText}</span></>}
            </div>
            <div className="text-xs text-gray-500 mt-2 line-clamp-1">
              {resources.map((resource) => resource.title).join('、')}
            </div>
          </div>
          <button
            type="button"
            onClick={() => openLearningResources(resources)}
            className="px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-lg text-sm font-medium hover:shadow-md transition-all whitespace-nowrap cursor-pointer flex-shrink-0"
          >
            <i className="ri-play-circle-line mr-1"></i>去学习
          </button>
        </div>
      </div>
    );
  };

  const renderChapterKnowledgeCard = (kp: KnowledgeCardData) => {
    const isCompleted = kp.status === 'completed';
    const isLocked = kp.status === 'locked';
    const quizState = quizStates[kp.id];
    const hasQuiz = Boolean(kp.quizId);
    return (
      <div
        key={kp.id}
        className={`bg-white rounded-2xl shadow-sm border p-5 transition-all ${isLocked ? 'opacity-60 border-gray-100' : isCompleted ? 'border-green-200' : 'border-gray-100 hover:border-teal-200 hover:shadow-md'}`}
      >
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <h3 className="text-base font-bold text-gray-900">{kp.name}</h3>
          <span className={`px-2 py-0.5 rounded-lg text-xs font-medium border ${getKnowledgeStatusColor(kp.status)}`}>{getStatusText(kp.status)}</span>
          {isCompleted && <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-lg text-xs font-medium"><i className="ri-checkbox-circle-fill"></i>检测已通过</span>}
          {quizState === 'failed' && !isCompleted && <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-600 rounded-lg text-xs font-medium"><i className="ri-close-circle-line"></i>未通过</span>}
        </div>
        <p className="text-sm text-gray-600 line-clamp-2 h-10 mb-4">{kp.description}</p>
        <div className="flex justify-end">
          {!isLocked && (
            hasQuiz && (
              <button onClick={() => handleKnowledgeQuizClick(kp)}
                disabled={quizLoadingId === kp.id}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${isCompleted ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gradient-to-r from-teal-500 to-cyan-600 text-white hover:shadow-md'}`}
              >
                <i className={`${isCompleted ? 'ri-refresh-line' : 'ri-edit-2-line'} mr-1`}></i>{quizLoadingId === kp.id ? '加载中' : isCompleted ? '重新检测' : '开始检测'}
              </button>
            )
          )}
        </div>
      </div>
    );
  };

  type TodoListItem = {
    id: string;
    title: string;
    description: string;
    module: string;
    moduleKey: TabType;
    trainingModuleId?: string;
    daysLeft: number;
    priority: 'urgent' | 'high' | 'normal' | 'low';
    attachments: StudentTodoTask['attachments'];
    requiresStudentAttachment: boolean;
    resourceNodes: StudentTodoTask['resourceNodes'];
    knowledgePointIds: string[];
    completed: boolean;
  };

  const getTaskKnowledgePointIds = (task: StudentTodoTask) => [
    ...new Set(
      (task.resourceNodes || []).flatMap((node) =>
        (node.knowledgePoints || []).map((point) => point.id)
      )
    ),
  ];
  const getCatalogLeavesWithProgress = useCallback((moduleId: string) => {
    const leaves = catalogResourceNodesByModule[moduleId] || [];
    if (!leaves.length) return leaves;
    return leaves.map((leaf) => ({
      ...leaf,
      resources: (leaf.resources || []).map((resource) => {
        const meta = resource as typeof resource & Partial<LearningDetailResource>;
        return {
          ...resource,
          progress: mergeResourceProgress(meta.progress, resourceProgressOverrides[resource.id]),
        };
      }),
    }));
  }, [catalogResourceNodesByModule, resourceProgressOverrides]);

  const isModuleTrainingPrerequisiteMet = (moduleId: string | undefined) => {
    if (!moduleId) return true;
    const leaves = getCatalogLeavesWithProgress(moduleId);
    if (!leaves.length) return true;
    return evaluateModulePrerequisite(leaves, completedKnowledgeIds).allowed;
  };

  const isTaskPrerequisiteMet = (task: TodoListItem) => {
    if (task.trainingModuleId) {
      return isModuleTrainingPrerequisiteMet(task.trainingModuleId);
    }
    if (task.knowledgePointIds.length > 0) {
      return task.knowledgePointIds.every((id) => completedKnowledgeIds.has(id));
    }
    return true;
  };

  const todoTasks: TodoListItem[] = studentTodoTasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    module: t.module,
    moduleKey: (t.moduleId && (TRAINING_ID_TO_TAB[t.moduleId] as TabType)) || 'overview',
    trainingModuleId: t.moduleId ?? undefined,
    daysLeft: t.daysLeft,
    priority: t.priority,
    attachments: t.attachments ?? [],
    requiresStudentAttachment: Boolean(t.requiresStudentAttachment),
    resourceNodes: t.resourceNodes ?? [],
    knowledgePointIds: getTaskKnowledgePointIds(t),
    completed: t.status === 'completed',
  }));
  const activeTodoTasks = todoTasks.filter((task) => !task.completed);
  const completedTodoTasks = todoTasks.filter((task) => task.completed);
  const overviewTaskList = [...activeTodoTasks, ...completedTodoTasks];
  const linkedCourseTasks = todoTasks.filter((task) => task.resourceNodes.length > 0);
  const learningResourceCount = new Set(
    studentTodoTasks.flatMap((task) =>
      (task.resourceNodes || []).flatMap((node) => (node.resources || []).map((resource) => resource.id))
    )
  ).size;
  const completedKnowledgeCount = knowledgePoints.filter((kp) => kp.status === 'completed').length;
  const knowledgeCompletionPercent = knowledgePoints.length
    ? Math.round((completedKnowledgeCount / knowledgePoints.length) * 100)
    : 0;
  const pendingLinkedTaskCount = linkedCourseTasks.filter((task) => !isTaskPrerequisiteMet(task)).length;

  const activeTrainingModuleId = activeTab.startsWith('module-') ? TAB_TO_MODULE_ID[activeTab] : undefined;
  const activeModulePrereq = useMemo(() => {
    if (!activeTrainingModuleId) return null;
    const leaves = getCatalogLeavesWithProgress(activeTrainingModuleId);
    if (!leaves.length) return null;
    return evaluateModulePrerequisite(leaves, completedKnowledgeIds);
  }, [activeTrainingModuleId, completedKnowledgeIds, getCatalogLeavesWithProgress]);

  const shouldBlockModule = Boolean(
    activeTab.startsWith('module-') && activeModulePrereq && !activeModulePrereq.allowed
  );

  const completedStagesCount = useMemo(() => {
    let n = 0;
    for (const id of activeTrainingOrder) {
      if (id === 'team') {
        if (teamFormationComplete) n += 1;
      } else if (isModuleCompletedByProgress(id)) {
        n += 1;
      }
    }
    return n;
  }, [
    activeTrainingOrder,
    ideationTopicApproved,
    teamFormationComplete,
    moduleProgressState,
    teamMarketReportUploaded,
    teamProductPrototypeUploaded,
    teamPlanApproved,
    teamBmcCanvasUploaded,
  ]);

  const overallProgressPercent = Math.round(
    (completedStagesCount / Math.max(activeTrainingOrder.length, 1)) * 100
  );

  const currentStageLabel = useMemo(() => {
    if (!teamFormationComplete) {
      return moduleProgress.find((m) => m.moduleId === 'team')?.moduleName ?? '组队与团队管理';
    }
    const inProgress = moduleProgress.find((m) => getModuleUnlockStatus(m.moduleId) === 'in_progress');
    if (inProgress) return inProgress.moduleName;
    return moduleProgress[moduleProgress.length - 1]?.moduleName ?? '—';
  }, [ideationTopicApproved, teamFormationComplete, moduleProgressState, moduleProgress]);

  const overviewHeroTitle =
    overviewMyTeam?.name?.trim() || selectedEnrollment?.className?.trim() || '我的实训项目';
  const isCurrentStudentTeamLeader = Boolean(
    overviewMyTeam?.leaderStudentId === currentStudentId ||
    overviewMyTeam?.members.some((member) => {
      const memberId = String(member.id || '');
      return memberId === currentStudentId && member.isTeamLeader;
    })
  );

  const formatTeamCreatedAt = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  const urgentCount = activeTodoTasks.filter((t) => t.priority === 'urgent' || t.priority === 'high').length;
  const overviewNotificationTotalPages = Math.max(1, Math.ceil(notificationList.length / OVERVIEW_PANEL_PAGE_SIZE));
  const overviewTaskTotalPages = Math.max(1, Math.ceil(overviewTaskList.length / OVERVIEW_PANEL_PAGE_SIZE));
  const overviewPagedNotifications = notificationList.slice(
    (overviewNotificationPage - 1) * OVERVIEW_PANEL_PAGE_SIZE,
    overviewNotificationPage * OVERVIEW_PANEL_PAGE_SIZE
  );
  const overviewPagedTasks = overviewTaskList.slice(
    (overviewTaskPage - 1) * OVERVIEW_PANEL_PAGE_SIZE,
    overviewTaskPage * OVERVIEW_PANEL_PAGE_SIZE
  );

  useEffect(() => {
    setOverviewNotificationPage((page) => Math.min(page, overviewNotificationTotalPages));
  }, [overviewNotificationTotalPages]);

  useEffect(() => {
    setOverviewNotificationPage(1);
    setOverviewTaskPage(1);
  }, [selectedClassId]);

  useEffect(() => {
    setOverviewTaskPage((page) => Math.min(page, overviewTaskTotalPages));
  }, [overviewTaskTotalPages]);

  const renderOverviewPagination = (page: number, totalPages: number, onChange: (page: number) => void) => {
    if (totalPages <= 1) return null;
    return (
      <div className="mt-3 flex items-center justify-end gap-2 border-t border-gray-100 pt-3">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onChange(Math.max(1, page - 1))}
          className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 cursor-pointer"
        >
          上一页
        </button>
        <span className="text-xs text-gray-400">{page}/{totalPages}</span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 cursor-pointer"
        >
          下一页
        </button>
      </div>
    );
  };

  const handleModuleClick = (moduleKey: TabType) => {
    setMobileNavOpen(false);
    const moduleId = TAB_TO_MODULE_ID[moduleKey];
    if (!moduleId) {
      changeActiveTab(moduleKey);
      return;
    }
    const ui = getSidebarModuleUi(moduleId);
    if (ui.locked) {
      setUnlockStageModalModuleId(moduleId);
      return;
    }
    const leaves = getCatalogLeavesWithProgress(moduleId);
    if (leaves.length && !evaluateModulePrerequisite(leaves, completedKnowledgeIds).allowed) {
      setActiveTab(moduleKey);
      return;
    }
    changeActiveTab(moduleKey);
    refreshTrainingStageSnapshot();
  };

  const getStartDateLabelForUnlock = (moduleId: string) => {
    const d = getStageDateSetting(moduleId)?.startDate;
    return d || '待教师配置';
  };

  const completeActiveTrainingTask = (moduleId: string) => {
    if (!selectedClassId || !activeTrainingTask || activeTrainingTask.moduleId !== moduleId) return;
    const taskId = activeTrainingTask.id;
    void completeStudentTodoTask(selectedClassId, taskId)
      .then(() => {
        setStudentTodoTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, status: 'completed' } : task)));
        setActiveTrainingTask(null);
        notification.success({ message: '任务已完成', placement: 'topRight' });
        refreshTrainingStageSnapshot();
      })
      .catch((e) => {
        notification.warning({
          message: '任务完成失败',
          description: e instanceof Error ? e.message : '请稍后重试',
          placement: 'topRight',
        });
      });
  };

  const canOpenTodoDialog = (task: TodoListItem) => {
    if (task.trainingModuleId && getPrerequisiteStageHint(task.trainingModuleId)) return false;
    return isTaskPrerequisiteMet(task);
  };

  const openTodoDialog = (task: TodoListItem) => {
    if (!canOpenTodoDialog(task)) return;
    setActiveTodoDialogTask(task);
    setTaskSubmitFiles([]);
  };

  useEffect(() => {
    if (!pendingTaskOpen) return;
    const { classId, taskId } = pendingTaskOpen;
    if (classId && selectedClassId && classId !== selectedClassId) {
      notification.warning({
        message: '请切换到对应教学班级',
        description: '该任务属于其他班级，请先在右上角切换班级。',
        placement: 'topRight',
      });
      setPendingTaskOpen(null);
      return;
    }
    const task = overviewTaskList.find((t) => t.id === taskId);
    if (task && !task.completed && canOpenTodoDialog(task)) {
      openTodoDialog(task);
    }
    setPendingTaskOpen(null);
  }, [pendingTaskOpen, overviewTaskList, selectedClassId]);

  if (activeLearningKnowledge) {
    return (
      <LearningDetail
        knowledgeTitle={activeLearningKnowledge.name}
        knowledgeDescription={activeLearningKnowledge.description}
        moduleName={activeLearningKnowledge.moduleName}
        resources={activeLearningKnowledge.resources}
        knowledgePoints={activeLearningKnowledge.knowledgePoints}
        onResourceProgressChange={(resourceId, progress) => {
          setResourceProgressOverrides((prev) => ({
            ...prev,
            [resourceId]: mergeResourceProgress(prev[resourceId], progress),
          }));
        }}
        onBack={() => {
          closingLearningRef.current = true;
          const params = new URLSearchParams(searchParams);
          params.delete('learning');
          params.delete('learningModule');
          params.delete('learningChapter');
          params.delete('resource');
          setSearchParams(params);
          setActiveTab('knowledge');
          setKnowledgeSubTab('knowledge');
          setActiveLearningKnowledge(null);
        }}
      />
    );
  }

  const goToTaskFromNotificationDetail = () => {
    if (!notificationDetail) return;
    const params = parseStudentCenterQuery(notificationDetail.relatedLink || '');
    setNotificationDetail(null);
    setActiveTab('overview');
    setOverviewPanelTab('tasks');
    const taskId = params.get('taskId');
    if (taskId) {
      setPendingTaskOpen({ classId: params.get('classId'), taskId });
    }
  };

  const completeTodoDialogTask = async () => {
    if (!selectedClassId || !activeTodoDialogTask) return;
    if (!isTaskPrerequisiteMet(activeTodoDialogTask)) {
      notification.warning({
        message: '请先完成实践课程',
        description:
          activeTodoDialogTask.trainingModuleId &&
          !isModuleTrainingPrerequisiteMet(activeTodoDialogTask.trainingModuleId)
            ? evaluateModulePrerequisite(
                catalogResourceNodesByModule[activeTodoDialogTask.trainingModuleId] || [],
                completedKnowledgeIds
              ).summary || '请先完成课程学习及知识点检测'
            : '请先完成课程资源学习与知识点检测',
        placement: 'topRight',
      });
      return;
    }
    if (activeTodoDialogTask.requiresStudentAttachment && taskSubmitFiles.length === 0) {
      notification.warning({ message: '请上传任务反馈附件', placement: 'topRight' });
      return;
    }
    setTaskSubmitting(true);
    try {
      await completeStudentTodoTask(selectedClassId, activeTodoDialogTask.id, taskSubmitFiles);
      setStudentTodoTasks((prev) => prev.map((task) => (task.id === activeTodoDialogTask.id ? { ...task, status: 'completed' } : task)));
      setActiveTodoDialogTask(null);
      setTaskSubmitFiles([]);
      notification.success({ message: '任务已完成', placement: 'topRight' });
    } catch (e) {
      notification.warning({
        message: '任务完成失败',
        description: e instanceof Error ? e.message : '请稍后重试',
        placement: 'topRight',
      });
    } finally {
      setTaskSubmitting(false);
    }
  };

  const checkIdeationTeamPrerequisites = async () => {
    if (!selectedClassId) return [];
    const res = await fetchStudentIdeationTeamPrerequisites(selectedClassId);
    return res.incompleteMembers;
  };

  const renderModuleContent = () => {
    switch (activeTab) {
      case 'module-team':
        if (!selectedEnrollment) {
          return <div className="text-sm text-gray-500 py-8 text-center">未加入教学班级，无法使用组队功能</div>;
        }
        return (
          <TeamFormationModule
            key={selectedEnrollment.classId}
            classId={selectedEnrollment.classId}
            className={selectedEnrollment.className}
            initialSubTab={
              (searchParams.get('teamTab') as 'assessment' | 'waiting' | 'myteam' | 'square' | null) || undefined
            }
            onTeamUpdated={refreshTeamFormationComplete}
          />
        );
      case 'module-ideation':
        // 由下方 keepIdeationModule 保活渲染，避免 switch 卸载丢对话
        return null;
      case 'module-market':
        return (
          <MarketResearchModule
            key={selectedClassId}
            classId={selectedClassId}
            isTeamLeader={isCurrentStudentTeamLeader}
            trainingEnded={trainingFrozen}
            stagePeriod={
              getStageDateSetting('market')?.startDate && getStageDateSetting('market')?.deadlineDate
                ? {
                    startDate: getStageDateSetting('market')!.startDate!,
                    deadlineDate: getStageDateSetting('market')!.deadlineDate!,
                  }
                : null
            }
            teamMembers={
              overviewMyTeam?.members.map((m) => ({
                id: String(m.id),
                name: m.name,
              })) ?? []
            }
            hasConfirmedTeam={Boolean(overviewMyTeam)}
            studentMarketChallengeDone={studentMarketChallengeDone}
            onMarketChallengeReportComplete={() => setStudentMarketChallengeDone(true)}
            onMarketTabProgress={handleMarketTabProgress}
            onTeamMarketReportUploaded={() => {
              setTeamMarketReportUploaded(true);
              refreshTeamMarketReportUploaded();
            }}
            onTaskComplete={() => completeActiveTrainingTask('market')}
          />
        );
      case 'module-product':
        return (
          <ProductDesignModule
            key={selectedClassId}
            classId={selectedClassId}
            isTeamLeader={isCurrentStudentTeamLeader}
            trainingEnded={trainingFrozen}
            onProductTabProgress={handleProductTabProgress}
            onTeamPrototypeUploaded={() => {
              setTeamProductPrototypeUploaded(true);
              refreshTeamProductPrototypeUploaded();
            }}
          />
        );
      case 'module-business':
        return (
          <BusinessModelModule
            key={selectedClassId}
            classId={selectedClassId}
            studentDisplayName={studentDisplayName}
            isTeamLeader={isCurrentStudentTeamLeader}
            trainingEnded={trainingFrozen}
            onBusinessTabProgress={handleBusinessTabProgress}
            onBmcCanvasUploaded={() => setTeamBmcCanvasUploaded(true)}
            onTaskComplete={() => completeActiveTrainingTask('business')}
          />
        );
      case 'module-simulation':
        return (
          <RoleSimulationModule
            key={selectedClassId}
            classId={selectedClassId}
            trainingEnded={trainingFrozen}
            onTaskComplete={() => {
              // 无待办任务时 completeActive 会直接 return，仍需刷新阶段进度以解锁商业计划书
              completeActiveTrainingTask('simulation');
              refreshTrainingStageSnapshot();
            }}
          />
        );
      case 'module-plan':
        return (
          <BusinessPlanModule
            key={selectedClassId}
            classId={selectedClassId}
            isTeamLeader={isCurrentStudentTeamLeader}
            studentDisplayName={studentDisplayName}
            teamMemberCount={overviewMyTeam?.members.length ?? 0}
            onTaskComplete={() => completeActiveTrainingTask('plan')}
            onTrainingEnded={refreshTrainingStageSnapshot}
          />
        );
      default:
        return null;
    }
  };

  // 与教师端一致：整页锁定视口高度，中间主区内部滚动，避免 AI 侧栏被内容撑高导致整页滚动
  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-50 to-white overflow-hidden">
      {mobileNavOpen ? (
        <button
          type="button"
          className="md:hidden fixed inset-0 z-40 bg-black/40"
          aria-label="关闭菜单"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}
      {/* 左侧侧边栏：手机为抽屉；桌面仍可按原宽度停靠 */}
      <aside
        className={`flex-shrink-0 bg-white border-r border-gray-100 shadow-sm flex-col transition-all duration-300 ${
          mobileNavOpen
            ? 'fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw]'
            : 'hidden'
        } md:sticky md:top-0 md:z-30 md:flex md:h-screen md:max-h-screen md:self-start ${sidebarCollapsed ? 'md:w-16' : 'md:w-60'}`}
      >
        <div className={`flex items-center gap-3 px-4 py-5 border-b border-gray-100 ${sidebarCollapsed ? 'justify-center' : ''}`}>
          {logoUrl ? (
            <img src={logoUrl} alt="" className="w-8 h-8 object-contain rounded-lg flex-shrink-0 border border-gray-100 bg-white" />
          ) : (
            <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <i className="ri-user-line text-white text-sm"></i>
            </div>
          )}
          {!sidebarCollapsed && (
            <div className="overflow-hidden">
              <div className="text-sm font-bold text-gray-900 whitespace-nowrap">{brandTitle}</div>
              <div className="text-xs text-gray-400 whitespace-nowrap">Student Workspace</div>
            </div>
          )}
        </div>


        <nav className="flex-1 py-3 overflow-y-auto">
          {!sidebarCollapsed && <div className="px-4 py-2"><span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">学习管理</span></div>}
          <div className="px-2 space-y-0.5 mb-2">
            {learningMenuItems.map((item) => (
              <button key={item.key} onClick={() => { if (item.key === 'knowledge') setActiveCourseTaskId(null); changeActiveTab(item.key); }} title={sidebarCollapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap relative ${activeTab === item.key ? 'bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'} ${sidebarCollapsed ? 'justify-center' : ''}`}
              >
                <div className="w-5 h-5 flex items-center justify-center flex-shrink-0"><i className={`${item.icon} text-base`}></i></div>
                {!sidebarCollapsed && <span className="text-sm font-medium">{item.label}</span>}
                {item.key === 'overview' && unreadCount > 0 && (
                  <span className={`absolute ${sidebarCollapsed ? 'top-1 right-1' : 'top-2 right-2'} w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center`}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {!sidebarCollapsed && <div className="mx-4 my-2 border-t border-gray-100"></div>}
          {sidebarCollapsed && <div className="mx-2 my-2 border-t border-gray-100"></div>}
          {!sidebarCollapsed && <div className="px-4 py-2"><span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">实训模块</span></div>}

          <div className="px-2 space-y-0.5">
            {trainingModuleMenuItems.map((item, index) => {
              const moduleId = TAB_TO_MODULE_ID[item.key];
              const ui = getSidebarModuleUi(moduleId);
              const isActive = activeTab === item.key;
              const statusIconClass = isActive ? 'text-white' : ui.locked ? 'text-gray-300' : 'text-teal-500';
              const periodText = getStagePeriodText(moduleId);
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleModuleClick(item.key)}
                  title={
                    sidebarCollapsed
                      ? item.label
                      : ui.locked
                        ? !teamFormationComplete && moduleId !== 'team'
                          ? '请先完成组队'
                          : '请先完成上一模块'
                        : item.label
                  }
                  className={`w-full px-3 py-2.5 rounded-xl transition-all cursor-pointer ${ui.locked ? 'opacity-60' : ''} ${isActive ? 'bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-sm' : ui.locked ? 'text-gray-400 hover:bg-gray-50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'} ${sidebarCollapsed ? 'flex items-center justify-center' : 'flex flex-col items-stretch'}`}
                >
                  {sidebarCollapsed ? (
                    <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                      <i className={`${item.icon} text-base`}></i>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2.5 w-full">
                        <span className={`text-xs font-bold w-4 flex-shrink-0 ${isActive ? 'text-white/70' : 'text-gray-400'}`}>
                          {index + 1}
                        </span>
                        <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                          <i className={`${item.icon} text-base`}></i>
                        </div>
                        <span className="text-xs font-medium flex-1 text-left leading-tight truncate">{item.label}</span>
                        <span className={`flex-shrink-0 ${statusIconClass}`}>
                          {ui.status === 'completed' && (
                            <i className={`ri-checkbox-circle-fill text-sm ${isActive ? 'text-green-200' : 'text-green-500'}`}></i>
                          )}
                          {ui.status === 'in_progress' && ui.isTeam && (
                            <i className={`ri-time-line text-sm ${isActive ? 'text-white/90' : ''}`}></i>
                          )}
                          {ui.status === 'locked' && <i className="ri-lock-line text-sm"></i>}
                        </span>
                      </div>
                      <div className={`mt-1 pl-[6px] text-left text-[10px] leading-tight break-words ${isActive ? 'text-white/70' : 'text-gray-400'}`}>
                        {periodText}
                      </div>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

       

        <div className="p-3 border-t border-gray-100 shrink-0 space-y-2">
          <div className={`flex items-center gap-2.5 ${sidebarCollapsed ? 'justify-center' : ''}`}>
            <button
              type="button"
              onClick={() => setProfileModalOpen(true)}
              className="flex-shrink-0 cursor-pointer"
              title="个人中心"
            >
              <UserAvatar name={studentDisplayName} avatarUrl={studentProfile?.avatarUrl} size="sm" />
            </button>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-gray-800 truncate">{studentDisplayName}</div>
                <div className="text-xs text-gray-400 truncate">{overallProgress.currentLevel}</div>
              </div>
            )}
            <button
              type="button"
              onClick={() => setLogoutModalOpen(true)}
              className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 cursor-pointer flex-shrink-0 transition-colors"
              title="退出登录"
            >
              <i className="ri-logout-box-r-line text-sm" />
            </button>
          </div>
          {/* <button
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`w-full flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${sidebarCollapsed ? 'justify-center' : ''}`}
          >
            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
              <i className={`${sidebarCollapsed ? 'ri-arrow-right-s-line' : 'ri-arrow-left-s-line'} text-base`} />
            </div>
            {!sidebarCollapsed && <span className="text-xs">收起菜单</span>}
          </button> */}
        </div>
      </aside>

      {/* 右侧主内容区：overflow 约束在本列，main 内部滚动 */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-100 shadow-sm shrink-0 z-20">
          <div className="px-3 md:px-6 py-3 flex items-center justify-between gap-2 !flex-nowrap">
            <div className="flex items-center gap-2 text-sm min-w-0 flex-1">
              <button
                type="button"
                className="md:hidden w-9 h-9 flex items-center justify-center text-gray-700 hover:bg-gray-100 rounded-lg flex-shrink-0"
                aria-label="打开菜单"
                onClick={() => setMobileNavOpen(true)}
              >
                <i className="ri-menu-line text-xl" />
              </button>
              <span className="hidden sm:inline text-gray-400">学生工作台</span>
              <i className="ri-arrow-right-s-line text-gray-300 hidden sm:inline"></i>
              {activeTab.startsWith('module-') && (<><span className="hidden md:inline text-gray-400">实训模块</span><i className="ri-arrow-right-s-line text-gray-300 hidden md:inline"></i></>)}
              <span className="font-medium text-gray-700 truncate">{getCurrentLabel()}</span>
            </div>
            <div className="flex items-center gap-2 md:gap-3 flex-shrink-0 !flex-nowrap">
              <StudentClassSwitcher
                enrollments={enrollments}
                selectedClassId={selectedClassId}
                onClassChange={handleClassChange}
              />
              <button
                type="button"
                onClick={() => setAiTutorOpen((v) => !v)}
                className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                  aiTutorOpen ? 'text-teal-700 bg-teal-50' : 'text-teal-600 hover:bg-teal-50'
                }`}
                title="实训助教"
              >
                <i className="ri-robot-2-line text-base" />
              </button>
              <button
                type="button"
                onClick={() => setProfileModalOpen(true)}
                className="w-9 h-9 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                title="个人中心"
              >
                <i className="ri-user-3-line text-base" />
              </button>
              {/* <div className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 bg-gray-50 border border-gray-100 rounded-lg whitespace-nowrap">
                <i className="ri-trophy-line text-teal-600"></i>
                <span>{overallProgress.currentLevel}</span>
                <span className="text-xs text-gray-400">
                  {overallProgress.levelProgress}% → {overallProgress.nextLevel}
                </span>
              </div> */}
            </div>
          </div>
        </header>

        <Drawer
          open={profileModalOpen}
          onClose={() => setProfileModalOpen(false)}
          title="个人中心"
          placement="right"
          width={520}
        >
          <div className="flex flex-col gap-4 min-w-0">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="flex-shrink-0">
                    <UserAvatar name={studentDisplayName} avatarUrl={studentProfile?.avatarUrl} size="lg" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-base font-bold text-gray-900 truncate">{studentProfile?.realName || studentDisplayName}</div>
                    <div className="text-sm text-gray-500 mt-0.5">
                      {studentProfile?.studentNo ? `学号：${studentProfile.studentNo}` : ''}
                    </div>
                    <div className="text-sm text-gray-500">
                      {studentProfile?.collegeName ? `学院：${studentProfile.collegeName}` : '学院：'}
                      <br/>
                      {studentProfile?.majorName ? `专业：${studentProfile.majorName}` : '专业：'}
                      <br/>
                      {studentProfile?.className ? `班级：${studentProfile.className}` : '班级：'}
                    </div>
                  </div>
                </div>
                <Upload
                  showUploadList={false}
                  beforeUpload={async (file) => {
                    try {
                      const r = await uploadStudentAvatar(file as File);
                      const p = await getStudentProfile();
                      setStudentProfile({ ...p, avatarUrl: r.avatarUrl || p.avatarUrl });
                      antdMessage.success('头像已更新');
                    } catch (e: any) {
                      antdMessage.error(e?.message || '上传失败');
                    }
                    return false;
                  }}
                >
                  <Button className="w-full sm:w-auto">上传头像</Button>
                </Upload>
              </div>
            </div>

            <ProfileContactPanels
              role="student"
              email={studentProfile?.email || ''}
              phone={studentProfile?.phone || ''}
              classItems={(enrollments || []).map((e) => ({
                id: e.classId,
                title: e.className,
                subtitle: `教师：${e.teacherName || '-'}`,
              }))}
              classEmptyText="暂无加入的个性化班级"
              onSaveContact={async (payload) => {
                if ('email' in payload) {
                  await updateStudentProfile({ email: payload.email, code: payload.code });
                } else {
                  await updateStudentProfile({ phone: payload.phone, phoneCode: payload.phoneCode });
                }
                const p = await getStudentProfile();
                setStudentProfile(p);
              }}
              onContactSaved={(next) => {
                setStudentProfile((prev) => (prev ? { ...prev, email: next.email, phone: next.phone } : prev));
              }}
            />
          </div>
        </Drawer>

        <main key={selectedClassId || 'student-no-class'} className="flex-1 px-4 pt-3 pb-4 md:px-5 md:pt-3 md:pb-5 min-w-0 overflow-y-auto overflow-x-hidden">

          {/* 进度看板 */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              <div className="bg-gradient-to-br from-teal-500 via-cyan-500 to-teal-600 rounded-2xl shadow-lg overflow-hidden relative">
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute top-0 right-0 w-72 h-72 bg-white rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
                </div>
                {/* 手机端：标题与说明上下排列，进度指标单独两列，避免和桌面横排挤在一起 */}
                <div className="relative px-4 py-5 md:hidden">
                  <div className="flex items-center gap-3 !flex-nowrap">
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center flex-shrink-0 border border-white/30">
                      <i className="ri-rocket-line text-2xl text-white"></i>
                    </div>
                    <h1 className="flex-1 min-w-0 text-xl font-bold text-white leading-snug line-clamp-2" style={{ overflowWrap: 'normal' }}>
                      {overviewHeroTitle}
                    </h1>
                  </div>
                  <div className="mt-3 space-y-1.5 text-sm text-white/85">
                    <p className="flex items-center gap-1.5 leading-5" style={{ overflowWrap: 'normal' }}>
                      <i className="ri-team-line flex-shrink-0"></i>
                      <span>
                        {selectedEnrollment?.className ?? '未加入教学班级'}
                        {enrollments.length > 1 ? ` · 已选 ${enrollments.length} 个班级` : ''}
                      </span>
                    </p>
                    <p className="flex items-start gap-1.5 leading-5" style={{ overflowWrap: 'normal' }}>
                      <i className="ri-map-pin-line mt-0.5 flex-shrink-0"></i>
                      <span>当前阶段：{currentStageLabel}</span>
                    </p>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="bg-white/15 backdrop-blur-md rounded-2xl px-3 py-3 border border-white/20">
                      <div className="text-2xl font-bold text-white leading-none">{overallProgressPercent}%</div>
                      <div className="text-xs text-white/75 mt-1 mb-2">项目整体进度</div>
                      <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                        <div className="h-full bg-white rounded-full" style={{ width: `${overallProgressPercent}%` }}></div>
                      </div>
                    </div>
                    <div className="bg-white/15 backdrop-blur-md rounded-2xl px-3 py-3 border border-white/20">
                      <div className="text-2xl font-bold text-white leading-none">
                        {completedStagesCount}/{activeTrainingOrder.length}
                      </div>
                      <div className="text-xs text-white/75 mt-1">已完成阶段</div>
                    </div>
                  </div>
                </div>
                <div className="relative px-8 py-6 hidden md:flex items-center gap-6">
                  <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center flex-shrink-0 border border-white/30">
                    <i className="ri-rocket-line text-3xl text-white"></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h1 className="text-2xl font-bold text-white truncate">{overviewHeroTitle}</h1>
                    </div>
                    <div className="flex items-center gap-5 text-sm text-white/80 flex-wrap">
                      <span className="flex items-center gap-1.5">
                        <i className="ri-team-line"></i>
                        {selectedEnrollment?.className ?? '未加入教学班级'}
                        {enrollments.length > 1 ? ` · 已选 ${enrollments.length} 个班级` : ''}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <i className="ri-map-pin-line"></i>当前阶段：{currentStageLabel}
                      </span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-center bg-white/10 backdrop-blur-md rounded-2xl px-8 py-4 border border-white/20">
                    <div className="text-4xl font-bold text-white mb-1">{overallProgressPercent}%</div>
                    <div className="text-xs text-white/70 mb-2">项目整体进度</div>
                    <div className="w-24 h-1.5 bg-white/20 rounded-full overflow-hidden mx-auto">
                      <div className="h-full bg-white rounded-full" style={{ width: `${overallProgressPercent}%` }}></div>
                    </div>
                  </div>
                  <div className="flex-shrink-0 bg-white/10 backdrop-blur-md rounded-2xl px-6 py-4 border border-white/20 text-center">
                    <div className="text-3xl font-bold text-white mb-1">
                      {completedStagesCount}/{activeTrainingOrder.length}
                    </div>
                    <div className="text-xs text-white/70">已完成阶段</div>
                  </div>
                </div>
              </div>

              {/* 实训模块步骤条 */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6 overflow-hidden relative z-0">
                <div className="flex flex-col gap-1 mb-4 md:mb-5 md:flex-row md:items-center md:justify-between">
                  <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <i className="ri-layout-grid-line text-teal-600"></i>实训模块进度
                  </h3>
                  <span className="text-xs text-gray-400">{completedCount} 已完成 · {inProgressCount} 进行中</span>
                </div>
                <p className="md:hidden text-xs text-gray-400 -mt-2 mb-3">点按阶段即可进入对应实训</p>
                <div className="md:hidden flex flex-col gap-2">
                  {moduleProgress.map((mod, index) => {
                    const ui = getSidebarModuleUi(mod.moduleId);
                    const isCompleted = ui.status === 'completed';
                    const isCurrent = ui.status === 'in_progress';
                    const tabMap: Record<string, TabType> = { team: 'module-team', ideation: 'module-ideation', market: 'module-market', product: 'module-product', business: 'module-business', simulation: 'module-simulation', plan: 'module-plan' };
                    const icons = ['ri-team-line', 'ri-lightbulb-line', 'ri-search-line', 'ri-pencil-ruler-line', 'ri-pie-chart-line', 'ri-robot-line', 'ri-file-text-line'];
                    const stepLabel =
                      mod.moduleId === 'team'
                        ? isCompleted
                          ? '已完成'
                          : '进行中'
                        : isCompleted
                          ? '已完成'
                          : ui.locked
                            ? '未解锁'
                            : isCurrent
                              ? `进行中 ${ui.displayPercent ?? 0}%`
                              : '未开始';
                    const barPercent = isCompleted ? 100 : ui.locked ? 0 : typeof ui.displayPercent === 'number' ? ui.displayPercent : 0;
                    return (
                      <button
                        key={mod.moduleId}
                        type="button"
                        onClick={() => handleModuleClick(tabMap[mod.moduleId])}
                        className={`w-full flex items-center gap-3 rounded-xl border px-3 py-3 text-left cursor-pointer ${ui.locked ? 'opacity-60' : ''} ${isCurrent ? 'border-teal-200 bg-teal-50' : isCompleted ? 'border-teal-100 bg-white' : 'border-gray-100 bg-gray-50/60'}`}
                      >
                        <span className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isCompleted ? 'bg-teal-500 text-white' : isCurrent ? 'bg-white border-2 border-teal-500 text-teal-600' : 'bg-white border border-gray-200 text-gray-400'}`}>
                          {isCompleted ? <i className="ri-check-line text-base"></i> : <i className={`${icons[index]} text-base`}></i>}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className={`block text-sm font-semibold leading-5 ${isCurrent ? 'text-teal-800' : 'text-gray-800'}`} style={{ overflowWrap: 'normal' }}>
                            {mod.moduleName}
                          </span>
                          <span className="mt-1.5 flex items-center gap-2">
                            <span className="h-1 flex-1 rounded-full bg-gray-200 overflow-hidden">
                              <span className={`block h-full rounded-full ${isCompleted || isCurrent ? 'bg-teal-500' : 'bg-gray-300'}`} style={{ width: `${barPercent}%` }}></span>
                            </span>
                            <span className={`text-xs flex-shrink-0 !whitespace-nowrap ${isCompleted || isCurrent ? 'text-teal-600 font-medium' : 'text-gray-400'}`}>
                              {stepLabel}
                            </span>
                          </span>
                        </span>
                        <i className="ri-arrow-right-s-line text-lg text-gray-300 flex-shrink-0"></i>
                      </button>
                    );
                  })}
                </div>
                <div className="hidden md:flex items-start gap-0">
                  {moduleProgress.map((mod, index) => {
                    const ui = getSidebarModuleUi(mod.moduleId);
                    const isCompleted = ui.status === 'completed';
                    const isCurrent = ui.status === 'in_progress';
                    const tabMap: Record<string, TabType> = { team: 'module-team', ideation: 'module-ideation', market: 'module-market', product: 'module-product', business: 'module-business', simulation: 'module-simulation', plan: 'module-plan' };
                    const icons = ['ri-team-line', 'ri-lightbulb-line', 'ri-search-line', 'ri-pencil-ruler-line', 'ri-pie-chart-line', 'ri-robot-line', 'ri-file-text-line'];
                    const stepLabel =
                      mod.moduleId === 'team'
                        ? isCompleted
                          ? '✓ 完成'
                          : '进行中'
                        : isCompleted
                          ? '✓ 完成'
                          : ui.locked
                            ? '0%'
                            : isCurrent
                              ? `${ui.displayPercent ?? 0}%`
                              : '未开始';
                    return (
                      <div key={mod.moduleId} className="flex-1 flex flex-col items-center relative">
                        {index < moduleProgress.length - 1 && (
                          <div
                            className={`absolute top-5 left-1/2 w-full h-0.5 z-0 pointer-events-none ${isCompleted ? 'bg-teal-400' : 'bg-gray-200'}`}
                            aria-hidden
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => handleModuleClick(tabMap[mod.moduleId])}
                          className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-all shadow-sm cursor-pointer ${ui.locked ? 'opacity-50' : ''} ${isCompleted ? 'bg-teal-500 text-white' : isCurrent ? 'bg-white border-2 border-teal-500 text-teal-600 ring-4 ring-teal-100' : 'bg-white border-2 border-gray-200 text-gray-400'}`}
                        >
                          {isCompleted ? <i className="ri-check-line text-sm font-bold"></i> : <i className={`${icons[index]} text-sm`}></i>}
                        </button>
                        <div className={`text-center px-1 ${isCurrent ? 'text-teal-700' : isCompleted ? 'text-gray-700' : 'text-gray-400'}`}>
                          <div className={`font-semibold leading-tight mb-0.5 ${isCurrent ? 'text-teal-700' : ''}`} style={{ fontSize: '10px' }}>
                            {mod.moduleName.length > 6 ? mod.moduleName.slice(0, 6) + '…' : mod.moduleName}
                          </div>
                          <div style={{ fontSize: '10px' }} className={`${isCompleted ? 'text-teal-500' : isCurrent ? 'text-teal-500 font-bold' : 'text-gray-300'}`}>
                            {stepLabel}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 待办任务 */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6 relative z-10">
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <i className="ri-todo-line text-teal-600"></i>通知•待办任务
                  </h3>
                  <div className="grid grid-cols-2 gap-1 bg-gray-100 rounded-xl p-1 md:flex md:items-center">
                    <button
                      type="button"
                      onClick={() => setOverviewPanelTab('notifications')}
                      className={`px-3 py-2 md:py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer !whitespace-nowrap ${
                        overviewPanelTab === 'notifications'
                          ? 'bg-white text-teal-600 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      通知{unreadCount > 0 ? ` ${unreadCount}` : ''}
                    </button>
                    <button
                      type="button"
                      onClick={() => setOverviewPanelTab('tasks')}
                      className={`px-3 py-2 md:py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer !whitespace-nowrap ${
                        overviewPanelTab === 'tasks'
                          ? 'bg-white text-teal-600 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      任务 {activeTodoTasks.length}
                      {urgentCount > 0 ? ` · ${urgentCount} 紧急` : ''}
                    </button>
                  </div>
                </div>
                {overviewPanelTab === 'notifications' ? (
                  notificationList.length === 0 ? (
                    <div className="py-8 text-center">
                      <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                        <i className="ri-notification-line text-2xl text-gray-400"></i>
                      </div>
                      <p className="text-sm font-medium text-gray-700">暂无系统通知</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2.5">
                        {overviewPagedNotifications.map((notice) => (
                          <div
                            key={notice.id}
                            className={`flex flex-wrap items-start gap-3 p-3.5 rounded-xl border transition-all md:flex-nowrap ${
                              notice.isRead ? 'border-gray-100 bg-gray-50/50' : 'border-teal-200 bg-teal-50/50'
                            }`}
                          >
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center flex-shrink-0">
                              <i className="ri-notification-3-line text-white text-sm"></i>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                <span className="font-semibold text-gray-900 text-sm truncate">{notice.title}</span>
                                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getNotificationCategoryStyle(notice)}`}>
                                  {getNotificationCategoryLabel(notice)}
                                </span>
                                {!notice.isRead && (
                                  <span className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-xs font-bold">未读</span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 line-clamp-2">{notice.content}</p>
                              <div className="text-xs text-gray-400 mt-1">{notice.timestamp}</div>
                            </div>
                            <div className="flex items-center gap-2 relative z-10 basis-full md:basis-auto w-full md:w-auto md:flex-shrink-0">
                              {!notice.isRead && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    markAsRead(notice.id);
                                  }}
                                  className="flex-1 md:flex-none px-2.5 py-2 md:py-1.5 bg-white border border-teal-200 text-teal-700 text-xs rounded-lg hover:bg-teal-50 cursor-pointer !whitespace-nowrap"
                                >
                                  已读
                                </button>
                              )}
                              {shouldShowOverviewNotificationView(notice) && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOverviewNotificationView(notice);
                                  }}
                                  className="flex-1 md:flex-none px-2.5 py-2 md:py-1.5 bg-teal-500 text-white text-xs rounded-lg hover:bg-teal-600 cursor-pointer !whitespace-nowrap"
                                >
                                  查看
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      {renderOverviewPagination(overviewNotificationPage, overviewNotificationTotalPages, setOverviewNotificationPage)}
                    </>
                  )
                ) : (
                  <>
                    {overviewTaskList.length === 0 ? (
                      <div className="py-8 text-center">
                        <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-3">
                          <i className="ri-checkbox-circle-line text-2xl text-green-500"></i>
                        </div>
                        <p className="text-sm font-medium text-gray-700">暂无任务</p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {overviewPagedTasks.map((task) => {
                          if (task.completed) {
                            return (
                              <div
                                key={task.id}
                                className="flex items-center gap-3 p-3.5 rounded-xl border border-gray-100 bg-gray-50/70 opacity-70"
                              >
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-gray-200 text-gray-500">
                                  <i className="ri-task-line text-sm"></i>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                    <span className="font-semibold text-gray-600 text-sm truncate">{task.title}</span>
                                    <span className="px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0 bg-gray-100 text-gray-500">
                                      已完成
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 text-xs text-gray-400">
                                    <span className="truncate"><i className="ri-folder-line mr-1"></i>{task.module}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          const isUrgent = task.priority === 'urgent' || task.priority === 'high';
                          const lockHint = task.trainingModuleId
                            ? getPrerequisiteStageHint(task.trainingModuleId)
                            : null;
                          const courseBlocked = !isTaskPrerequisiteMet(task);
                          const actionDisabled = Boolean(lockHint) || courseBlocked;
                          const goTodo = () => {
                            if (actionDisabled) return;
                            openTodoDialog(task);
                          };
                          return (
                            <div
                              key={task.id}
                              className={`flex flex-wrap items-center gap-3 p-3.5 rounded-xl border transition-all md:flex-nowrap ${actionDisabled ? 'opacity-80' : 'hover:shadow-sm'} ${isUrgent ? 'border-red-200 bg-red-50/40' : 'border-gray-100 bg-gray-50/50 hover:border-teal-200'}`}
                            >
                              <div
                                className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isUrgent ? 'bg-gradient-to-br from-red-500 to-orange-500' : 'bg-gradient-to-br from-orange-400 to-orange-500'}`}
                              >
                                <i className="ri-task-line text-white text-sm"></i>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                  <span className="font-semibold text-gray-900 text-sm truncate">{task.title}</span>
                                  <span className="px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0 bg-orange-100 text-orange-700">
                                    实训任务
                                  </span>
                                  {isUrgent && <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-xs font-bold flex-shrink-0"><i className="ri-alarm-warning-line"></i>紧急</span>}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-gray-400">
                                  <span className="truncate"><i className="ri-folder-line mr-1"></i>{task.module}</span>
                                  <span className={`flex-shrink-0 font-medium ${task.daysLeft <= 3 ? 'text-red-500' : 'text-gray-400'}`}>
                                    <i className="ri-calendar-line mr-1"></i>{task.daysLeft <= 0 ? '已逾期' : task.daysLeft === 1 ? '明天截止' : `还剩 ${task.daysLeft} 天`}
                                  </span>
                                </div>
                                {task.attachments.length > 0 && (
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    {task.attachments.map((file) => (
                                      <button
                                        key={file.id}
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          void downloadStudentTaskAttachment(selectedClassId, task.id, file.id, file.fileName);
                                        }}
                                        className="inline-flex items-center gap-1.5 px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs text-teal-700 hover:bg-teal-50 hover:border-teal-200 cursor-pointer"
                                        title="点击下载附件"
                                      >
                                        <i className="ri-attachment-2"></i>
                                        <span className="max-w-[160px] truncate">{file.fileName}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                                {task.trainingModuleId && !isTaskPrerequisiteMet(task) && (
                                  <div className="mt-2 px-2.5 py-2 bg-teal-50 border border-teal-100 rounded-lg text-xs text-teal-700 leading-relaxed">
                                    <i className="ri-book-open-line mr-1"></i>
                                    请先完成该环节实践课程学习（小节进度达 {COURSE_GATE_PERCENT}%）及知识点检测后再进行实训任务。
                                  </div>
                                )}
                              </div>
                              <button
                                type="button"
                                disabled={actionDisabled}
                                title={
                                  lockHint ??
                                  (courseBlocked
                                    ? `请先完成该环节实践课程学习（小节进度达 ${COURSE_GATE_PERCENT}%）及知识点检测`
                                    : undefined)
                                }
                                onClick={() => goTodo()}
                                className={`basis-full md:basis-auto w-full md:w-auto px-3 py-2 md:py-1.5 rounded-lg text-xs font-medium transition-all !whitespace-nowrap md:flex-shrink-0 ${
                                  actionDisabled
                                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    : isUrgent
                                      ? 'bg-red-500 hover:bg-red-600 text-white cursor-pointer'
                                      : 'bg-gradient-to-r from-teal-500 to-cyan-600 text-white hover:shadow-md cursor-pointer'
                                }`}
                              >
                                去完成
                                <i className="ri-arrow-right-line ml-1"></i>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {renderOverviewPagination(overviewTaskPage, overviewTaskTotalPages, setOverviewTaskPage)}
                    {activeTodoTasks.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs text-gray-400">
                          <i className="ri-information-line mr-1"></i>
                          待办来自教师发布的实训任务
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* 我的团队 */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6">
                <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <i className="ri-team-line text-teal-600"></i>我的团队
                </h3>
                {overviewMyTeam ? (
                  <div className="bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl p-4 md:p-5 text-white">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm flex-shrink-0">
                          <i className="ri-team-line text-xl"></i>
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold truncate">{overviewMyTeam.name}</h4>
                          <p className="text-teal-100 text-xs">
                            {overviewMyTeam.members.length} 名成员
                            {formatTeamCreatedAt(overviewMyTeam.createdAt)
                              ? ` · 创建于 ${formatTeamCreatedAt(overviewMyTeam.createdAt)}`
                              : ''}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleModuleClick('module-team')}
                        className="w-full md:w-auto px-3 py-2 md:py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium transition-all !whitespace-nowrap cursor-pointer text-center"
                      >
                        <i className="ri-arrow-right-line mr-1"></i>进入团队管理
                      </button>
                    </div>
                    {overviewMyTeam.complementScore != null && (
                      <div className="mt-4 grid grid-cols-2 gap-3 max-w-md">
                        <div className="bg-white/10 rounded-lg p-3 text-center">
                          <div className="text-lg font-bold mb-0.5">{overviewMyTeam.members.length}</div>
                          <div className="text-xs text-teal-100">团队成员</div>
                        </div>
                        <div className="bg-white/10 rounded-lg p-3 text-center">
                          <div className="text-lg font-bold mb-0.5">
                            {Number(overviewMyTeam.complementScore).toFixed(1)}
                          </div>
                          <div className="text-xs text-teal-100">互补得分</div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-200 py-10 px-4 text-center">
                    <p className="text-sm text-gray-500 mb-3">教师确认组队后将在此显示团队信息</p>
                    <button
                      type="button"
                      onClick={() => handleModuleClick('module-team')}
                      className="px-4 py-2 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 cursor-pointer"
                    >
                      前往组队与团队管理
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 实践课程 */}
          {activeTab === 'knowledge' && (
            <div className="space-y-6">
              <div><h2 className="text-2xl font-bold text-gray-900 mb-1">实践课程</h2><p className="text-sm text-gray-500">学习知识点、完成检测、获取能力点，构建完整能力体系</p></div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-2">
                <div className="flex space-x-2">
                  {[{ id: 'overview', label: '学习概览', icon: 'ri-dashboard-line' }, { id: 'knowledge', label: '知识点库', icon: 'ri-book-2-line' } , { id: 'progress', label: '进度看板', icon: 'ri-line-chart-line' }].map((tab) => (
                    <button key={tab.id} onClick={() => setKnowledgeSubTab(tab.id as typeof knowledgeSubTab)}
                      className={`flex-1 px-4 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap text-sm flex items-center justify-center gap-2 ${knowledgeSubTab === tab.id ? 'bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-lg' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                      <i className={tab.icon}></i>{tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {knowledgeSubTab === 'overview' && (
                <div className="space-y-6">
                  <div className="bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl shadow-xl p-8 text-white">
                    <div className="grid grid-cols-4 gap-6">
                      {[
                        { value: `${completedKnowledgeCount}/${knowledgePoints.length}`, label: '知识点完成' },
                        { value: `${learningResourceCount}`, label: '学习资源' },
                        { value: `${knowledgeCompletionPercent}%`, label: '检测通过率' },
                        { value: `${pendingLinkedTaskCount}/${linkedCourseTasks.length}`, label: '待完成关联任务' },
                      ].map((item, i) => (
                        <div key={i} className="bg-white/10 rounded-xl p-4 backdrop-blur-sm text-center"><div className="text-2xl font-bold mb-1">{item.value}</div><div className="text-sm text-teal-100">{item.label}</div></div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-5 flex items-center gap-2"><i className="ri-route-line text-teal-600"></i>学习路径流程</h3>
                    <div className="flex items-center justify-between">
                      {[
                        { icon: 'ri-book-open-line', label: '学习实践课程', color: 'from-teal-500 to-teal-600', desc: '观看视频、阅读文档' },
                        { icon: 'ri-checkbox-line', label: '学习检测', color: 'from-cyan-500 to-cyan-600', desc: '测试达标解锁' },
                        { icon: 'ri-edit-box-line', label: '实践操作', color: 'from-orange-500 to-orange-600', desc: '完成实践任务' },
                        // { icon: 'ri-star-line', label: '教师评价', color: 'from-purple-500 to-purple-600', desc: '获得反馈指导' },
                        // { icon: 'ri-medal-line', label: '获得能力点', color: 'from-purple-500 to-purple-600', desc: '解锁下一环节' },
                      ].map((step, index) => (
                        <div key={index} className="flex items-center gap-3 flex-1">
                          <div className="flex-1 text-center">
                            <div className={`w-14 h-14 bg-gradient-to-br ${step.color} rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg`}><i className={`${step.icon} text-2xl text-white`}></i></div>
                            <div className="font-semibold text-gray-900 mb-1 text-sm">{step.label}</div>
                            <div className="text-xs text-gray-500">{step.desc}</div>
                          </div>
                          {index < 4 && <div className="w-10 h-10 flex items-center justify-center"><i className="ri-arrow-right-line text-xl text-gray-300"></i></div>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {knowledgeSubTab === 'knowledge' && (
                <div className="space-y-6">
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                    <div className="flex items-center gap-3 overflow-x-auto">
                      {knowledgeModules.map((mod) => (
                        <button key={mod.id} onClick={() => setSelectedModule(mod.id)}
                          className={`px-5 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap text-sm ${selectedModule === mod.id ? `${mod.color} text-white shadow-lg` : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >{mod.name}</button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-[280px_1fr] gap-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 min-h-[360px]">
                      <div className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <i className="ri-node-tree text-teal-600"></i>章节目录
                      </div>
                      {knowledgeChapterData.treeData.length > 0 ? (
                        <Tree
                          treeData={knowledgeChapterData.treeData}
                          selectedKeys={activeChapterId ? [activeChapterId] : []}
                          defaultExpandAll
                          onSelect={(keys) => setSelectedChapterId(String(keys[0] || ''))}
                        />
                      ) : (
                        <div className="py-12 text-center text-sm text-gray-400">当前模块暂无关联章节</div>
                      )}
                    </div>
                    <div className="space-y-5 min-w-0">
                      {activeChapterIsLeaf ? (
                        <>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                                <i className="ri-book-open-line text-teal-600"></i>学习资源
                              </h3>
                            </div>
                            {selectedChapterResources.length > 0 ? (
                              renderChapterResourceCard(selectedChapterResources)
                            ) : (
                              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center text-sm text-gray-400">
                                当前章节暂无学习资源
                              </div>
                            )}
                          </div>

                          <div className="space-y-3">
                            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                              <i className="ri-lightbulb-line text-teal-600"></i>章节关联知识点
                            </h3>
                            {selectedChapterKnowledge.length > 0 ? (
                              <div className="grid grid-cols-2 gap-5">
                                {selectedChapterKnowledge.map(renderChapterKnowledgeCard)}
                              </div>
                            ) : (
                              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center text-sm text-gray-400">
                                当前章节暂无关联知识点
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center text-sm text-gray-400">
                          <div className="w-12 h-12 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-3">
                            <i className="ri-node-tree text-xl"></i>
                          </div>
                          <div className="font-medium text-gray-600">请选择最下级章节</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {knowledgeSubTab === 'ability' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-teal-50 flex items-center justify-center mx-auto mb-4">
                    <i className="ri-radar-line text-3xl text-teal-500"></i>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">暂无能力雷达数据</h3>
                  <p className="text-sm text-gray-500">完成课程学习、检测和教师评价后，将在此展示能力成长情况。</p>
                </div>
              )}

              {knowledgeSubTab === 'progress' && (
                <div className="space-y-6">
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                    <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2"><i className="ri-time-line text-teal-600"></i>学习时间线</h3>
                    <div className="relative">
                      <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-teal-500 to-cyan-600"></div>
                      <div className="space-y-8">
                        {knowledgeModules.map((mod) => {
                          const modKnowledge = knowledgePoints.filter(k => k.module === mod.id);
                          const completed = modKnowledge.filter(k => k.status === 'completed').length;
                          const total = modKnowledge.length;
                          const noCourse = total === 0;
                          const isLocked = getSidebarModuleUi(mod.id).locked;
                          const isActive = !isLocked && !noCourse && completed < total;
                          const pct = noCourse ? 0 : total > 0 ? Math.round((completed / total) * 100) : 0;
                          const statusLabel = isLocked
                            ? '未解锁'
                            : noCourse
                              ? '无内容'
                              : completed === total
                                ? '已完成'
                                : isActive
                                  ? '进行中'
                                  : '待开始';
                          return (
                            <div key={mod.id} className="relative pl-20">
                              <div className={`absolute left-0 w-16 h-16 ${mod.color} rounded-2xl flex items-center justify-center shadow-lg ${isActive ? 'ring-4 ring-teal-200' : ''} ${isLocked ? 'opacity-50' : ''}`}>
                                <i className={`ri-${isLocked ? 'lock' : noCourse || completed === total ? 'checkbox-circle' : 'play'}-line text-2xl text-white`}></i>
                              </div>
                              <div className={`bg-gray-50 rounded-xl p-6 ${isActive ? 'ring-2 ring-teal-500' : ''}`}>
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="text-base font-bold text-gray-900">{mod.name}</h4>
                                  <div className="flex items-center gap-3">
                                    <span className={`px-3 py-1 rounded-lg text-sm font-medium ${isLocked ? 'bg-gray-200 text-gray-600' : statusLabel === '已完成' ? 'bg-green-100 text-green-700' : isActive ? 'bg-teal-100 text-teal-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                      {statusLabel}
                                    </span>
                                    {!isLocked && !noCourse && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setKnowledgeSubTab('knowledge');
                                          setSelectedModule(mod.id);
                                        }}
                                        className="px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-lg text-sm font-medium hover:shadow-md transition-all whitespace-nowrap cursor-pointer"
                                      >
                                        进入学习
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center justify-between mb-3">
                                  <span className="text-sm text-gray-600">
                                    {noCourse ? '暂无关联课程，无需学习' : `${completed}/${total} 知识点完成`}
                                  </span>
                                  <span className="text-sm font-bold text-teal-600">{pct}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                  <div className={`h-full ${mod.color} rounded-full`} style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                    <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2"><i className="ri-checkbox-circle-line text-teal-600"></i>关联任务资源</h3>
                    <div className="grid grid-cols-3 gap-6">
                      {knowledgeModules.map((mod) => {
                        const linkedTasks = activeTodoTasks.filter((task) => task.trainingModuleId === mod.id && task.resourceNodes.length > 0);
                        const linkedResources = new Set(linkedTasks.flatMap((task) => task.resourceNodes.map((node) => node.id)));
                        const linkedKnowledge = knowledgePoints.filter((kp) => kp.module === mod.id);
                        const isLocked = getSidebarModuleUi(mod.id).locked;
                        return (
                          <div key={mod.id} className={`border-2 rounded-xl p-6 ${isLocked ? 'border-gray-200 bg-gray-50' : 'border-teal-300 bg-teal-50'}`}>
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="font-bold text-gray-900">{mod.name}</h4>
                              <i className={`${isLocked ? 'ri-lock-line text-gray-400' : 'ri-book-open-line text-teal-600'} text-2xl`}></i>
                            </div>
                            <div className="space-y-2 text-sm text-gray-600">
                              <div className="flex items-center justify-between"><span>关联任务</span><span className="font-bold text-teal-600">{linkedTasks.length}</span></div>
                              <div className="flex items-center justify-between"><span>关联课时</span><span className="font-bold text-teal-600">{linkedResources.size}</span></div>
                              <div className="flex items-center justify-between"><span>知识点</span><span className="font-bold text-teal-600">{linkedKnowledge.length}</span></div>
                            </div>
                            <div className={`mt-4 text-xs font-medium ${isLocked ? 'text-gray-500' : 'text-teal-700'}`}>
                              {isLocked ? '完成前置环节后解锁' : linkedKnowledge.length ? '可进入知识点库学习' : '暂无关联知识点'}
                            </div>
                            {!isLocked && linkedKnowledge.length > 0 && (
                              <button onClick={() => { setKnowledgeSubTab('knowledge'); setSelectedModule(mod.id); }} className="mt-3 w-full py-1.5 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer">
                                <i className="ri-book-open-line mr-1"></i>查看知识点
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 能力点管理 */}
          {activeTab === 'ability' && (
            <div className="space-y-6">
              <div><h2 className="text-2xl font-bold text-gray-900 mb-1">能力点管理</h2><p className="text-sm text-gray-500">查看已获取的能力点，追踪能力成长轨迹</p></div>
              <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl shadow-xl p-8 text-white">
                <div className="flex items-center justify-between mb-6">
                  <div><h3 className="text-2xl font-bold mb-2">我的能力画像</h3><p className="text-purple-100">已获得 {abilityPointsData.length} 个能力点，持续提升中</p></div>
                  <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm"><i className="ri-medal-line text-4xl"></i></div>
                </div>
                <div className="grid grid-cols-3 gap-6">
                  {['核心能力', '专业能力', '通用能力'].map((category) => {
                    const categoryAbilities = abilityPointsData.filter(a => a.category === category);
                    const totalLevel = categoryAbilities.reduce((sum, a) => sum + a.level, 0);
                    const maxTotalLevel = categoryAbilities.reduce((sum, a) => sum + a.maxLevel, 0);
                    const progress = maxTotalLevel > 0 ? Math.round((totalLevel / maxTotalLevel) * 100) : 0;
                    return (
                      <div key={category} className="bg-white/10 rounded-xl p-5 backdrop-blur-sm">
                        <h4 className="text-base font-bold mb-2">{category}</h4>
                        <div className="text-3xl font-bold mb-1">{progress}%</div>
                        <div className="text-sm text-purple-100 mb-3">{categoryAbilities.length} 个能力点</div>
                        <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden"><div className="h-full bg-white rounded-full" style={{ width: `${progress}%` }}></div></div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-5 flex items-center gap-2"><i className="ri-list-check text-teal-600"></i>能力点清单</h3>
                <div className="grid grid-cols-2 gap-5">
                  {abilityPointsData.map((ability) => (
                    <div key={ability.id} className="border-2 border-gray-100 rounded-xl p-5 hover:shadow-md hover:border-purple-200 transition-all">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1"><h4 className="text-base font-bold text-gray-900">{ability.name}</h4><span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-lg text-xs font-medium">{ability.category}</span></div>
                          <p className="text-sm text-gray-500">{ability.description}</p>
                        </div>
                        <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center ml-3 flex-shrink-0"><div className="text-lg font-bold text-white">Lv.{ability.level}</div></div>
                      </div>
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-1"><span className="text-xs font-medium text-gray-600">能力等级</span><span className="text-xs font-bold text-purple-600">{ability.level}/{ability.maxLevel}</span></div>
                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden"><div className="h-full bg-gradient-to-r from-purple-500 to-pink-600 rounded-full" style={{ width: `${(ability.level / ability.maxLevel) * 100}%` }}></div></div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="text-xs text-gray-400 mb-1">获得途径</div>
                        <div className="text-xs text-gray-700 font-medium mb-1">{ability.obtainedFrom}</div>
                        <div className="text-xs text-gray-400"><i className="ri-calendar-line mr-1"></i>{ability.obtainedDate}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 学习档案 */}
          {activeTab === 'guide' && (
            <div className="max-h-[calc(100vh-10rem)] overflow-y-auto rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 px-4 py-3">
              <UserGuideContent embedded onNavigateStudentTab={(tab) => changeActiveTab(tab as TabType)} />
            </div>
          )}

          {activeTab === 'archive' && (
            <div className="space-y-6">
              <div><h2 className="text-2xl font-bold text-gray-900 mb-1">学习档案</h2><p className="text-sm text-gray-500">全流程学习记录，支持筛选与导出</p></div>
              <div className="grid grid-cols-4 gap-5">
                {[
                  { label: '知识点学习', count: archiveStats.knowledgeCount, icon: 'ri-book-2-line', color: 'from-teal-500 to-teal-600' },
                  { label: '案例参考', count: archiveStats.caseCount, icon: 'ri-lightbulb-line', color: 'from-green-500 to-green-600' },
                  { label: '实践任务', count: archiveStats.taskCount, icon: 'ri-edit-box-line', color: 'from-orange-500 to-orange-600' },
                  { label: '教师评价', count: archiveStats.evaluationCount, icon: 'ri-star-line', color: 'from-purple-500 to-purple-600' },
                ].map((stat, index) => (
                  <div key={index} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-11 h-11 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center`}><i className={`${stat.icon} text-xl text-white`}></i></div>
                      <div className="text-3xl font-bold text-gray-900">{stat.count}</div>
                    </div>
                    <div className="text-sm font-medium text-gray-600">{stat.label}</div>
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><i className="ri-time-line text-teal-600"></i>学习记录时间线</h3>
                  {/* <div className="flex items-center gap-2">
                    <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-all whitespace-nowrap cursor-pointer"><i className="ri-filter-line mr-1.5"></i>筛选</button>
                    <button className="px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-lg text-sm font-medium hover:shadow-md transition-all whitespace-nowrap cursor-pointer"><i className="ri-download-line mr-1.5"></i>导出档案</button>
                  </div> */}
                </div>
                <div className="relative">
                  <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-teal-500 to-cyan-600"></div>
                  {archiveLoading ? (
                    <div className="py-10 text-center text-sm text-gray-500">加载中…</div>
                  ) : archiveRecords.length === 0 ? (
                    <div className="py-10 text-center text-sm text-gray-500">暂无学习记录</div>
                  ) : (
                    <div className="space-y-5">
                      {archiveRecords.map((record) => (
                        <div key={record.id} className="relative pl-20">
                          <div className={`absolute left-0 w-16 h-16 bg-gradient-to-br ${getRecordColor(record.type)} rounded-2xl flex items-center justify-center shadow-md`}><i className={`${getRecordIcon(record.type)} text-2xl text-white`}></i></div>
                          <div className="bg-gray-50 rounded-xl p-5 hover:shadow-sm transition-all">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="text-base font-bold text-gray-900">{record.title}</h4>
                                  {record.score != null && <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-lg text-xs font-medium">{record.score}分</span>}
                                </div>
                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                  <span><i className="ri-folder-line mr-1"></i>{record.module}</span>
                                  <span><i className="ri-calendar-line mr-1"></i>{record.date}</span>
                                </div>
                              </div>
                              <span className="px-2 py-0.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600">{record.status}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 实训模块内容 */}
          {activeTab.startsWith('module-') && (
            <div>{!shouldBlockModule && renderModuleContent()}</div>
          )}
          {/* 创新模块：进入后 hidden 保活（即使切到概览也不卸载；权威状态仍靠 method-chat 落库） */}
          {keepIdeationModule && !shouldBlockModule ? (
            <div
              className={activeTab === 'module-ideation' ? undefined : 'hidden'}
              aria-hidden={activeTab !== 'module-ideation'}
            >
              <IdeationModule
                key={selectedClassId}
                classId={selectedClassId}
                learningResources={ideationLearningResources}
                isTeamLeader={isCurrentStudentTeamLeader}
                initialTab={initialIdeationTab}
                onCheckTeamPrerequisites={checkIdeationTeamPrerequisites}
                onOpenLearningResource={openIdeationLearningResource}
                onTaskComplete={() => {
                  setIdeationTopicApproved(true);
                  completeActiveTrainingTask('ideation');
                }}
              />
            </div>
          ) : null}

          {/* 消息通知 */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <div><h2 className="text-2xl font-bold text-gray-900 mb-1">消息通知</h2><p className="text-sm text-gray-500">查看教师引导意见、督促通知和评价反馈</p></div>
              <div className="grid grid-cols-4 gap-5">
                {[
                  { label: '全部消息', count: notificationList.length, icon: 'ri-mail-line', color: 'from-gray-500 to-gray-600' },
                  { label: '未读消息', count: unreadCount, icon: 'ri-mail-unread-line', color: 'from-red-500 to-red-600' },
                  { label: '引导意见', count: notificationList.filter(n => n.type === 'guidance').length, icon: 'ri-guide-line', color: 'from-teal-500 to-teal-600' },
                  { label: '评价反馈', count: notificationList.filter(n => n.type === 'evaluation').length, icon: 'ri-star-line', color: 'from-purple-500 to-purple-600' },
                ].map((stat, index) => (
                  <div key={index} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-11 h-11 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center`}><i className={`${stat.icon} text-xl text-white`}></i></div>
                      <div className="text-3xl font-bold text-gray-900">{stat.count}</div>
                    </div>
                    <div className="text-sm font-medium text-gray-600">{stat.label}</div>
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {filteredNotifications.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4"><i className="ri-mail-line text-4xl text-gray-400"></i></div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">暂无消息</h3>
                    <p className="text-sm text-gray-500">当前筛选条件下没有消息</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {filteredNotifications.map((notification) => {
                      const isExpanded = expandedNotificationId === notification.id;
                      return (
                        <div
                          key={notification.id}
                          className={`relative p-5 transition-all cursor-pointer hover:bg-gray-50 ${!notification.isRead ? 'bg-teal-50/30 border-l-4 border-l-teal-500' : ''}`}
                          onClick={() => setExpandedNotificationId(isExpanded ? null : notification.id)}
                        >
                          {!notification.isRead && (
                            <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
                              <span className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-md shadow-sm">
                                未读
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markAsRead(notification.id);
                                }}
                                className="px-2.5 py-1 bg-white border border-teal-300 text-teal-700 text-xs font-medium rounded-lg hover:bg-teal-50 shadow-sm cursor-pointer whitespace-nowrap"
                              >
                                确认已读
                              </button>
                            </div>
                          )}
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-full flex-shrink-0 bg-teal-600 text-white flex items-center justify-center font-bold">
                              {(notification.sender?.name || '系').charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-gray-900">{notification.sender.name}</span>
                                  <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${getNotificationTypeStyle(notification.type)}`}>{getNotificationTypeText(notification.type)}</span>
                                  {notification.type === 'evaluation' && 'score' in notification && (notification as { score?: number }).score != null && (
                                    <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-lg text-xs font-medium"><i className="ri-trophy-line"></i>{(notification as { score: number }).score}分</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0 pr-28">
                                  <span className="text-xs text-gray-400">{notification.timestamp}</span>
                                </div>
                              </div>
                              <h4 className="font-semibold text-gray-900 mb-2">{notification.title}</h4>
                              <p className={`text-sm text-gray-600 ${isExpanded ? '' : 'line-clamp-2'}`}>{notification.content}</p>
                              {isExpanded && (
                                <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap items-center gap-3">
                                  <button
                                    type="button"
                                    className="px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-lg text-sm font-medium hover:shadow-md transition-all whitespace-nowrap cursor-pointer"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      goFromNotificationLink(
                                        notification.relatedLink || '/student-center?tab=module-team&teamTab=myteam'
                                      );
                                    }}
                                  >
                                    <i className="ri-arrow-right-line mr-1.5"></i>
                                    {notification.type === 'team_join' ? '查看我的团队' : '查看详情'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedNotificationId(null);
                                    }}
                                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-all whitespace-nowrap cursor-pointer"
                                  >
                                    收起
                                  </button>
                                </div>
                              )}
                              {!isExpanded && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedNotificationId(notification.id);
                                  }}
                                  className="mt-2 text-sm text-teal-600 hover:text-teal-700 font-medium cursor-pointer"
                                >
                                  查看详情 <i className="ri-arrow-down-s-line"></i>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

        </main>
      </div>

      <AiTutorPanel role="student" open={aiTutorOpen} onClose={() => setAiTutorOpen(false)} />

      {/* 检测弹窗 */}
      {activeQuizId && activeQuizConfig && (
        <QuizModal
          config={activeQuizConfig}
          onClose={() => { setActiveQuizId(null); setActiveQuizConfig(null); }}
          onPass={(knowledgeId, moduleId, score, answers) => { handleQuizPass(knowledgeId, moduleId, score, answers); setActiveQuizId(null); setActiveQuizConfig(null); }}
        />
      )}

      <Modal
        open={!!notificationDetail}
        title="通知详情"
        zIndex={1100}
        destroyOnClose
        onCancel={() => setNotificationDetail(null)}
        footer={
          notificationDetail ? (
            <div className="flex justify-end gap-2">
              {getNotificationCategory(notificationDetail) === 'task' ? (
                <Button type="primary" onClick={goToTaskFromNotificationDetail}>
                  前往待办
                </Button>
              ) : notificationDetail.relatedLink &&
                (getNotificationCategory(notificationDetail) === 'other' ||
                  getNotificationCategory(notificationDetail) === 'guidance') ? (
                <Button
                  type="primary"
                  onClick={() => {
                    const link = notificationDetail.relatedLink;
                    setNotificationDetail(null);
                    goFromNotificationLink(link);
                  }}
                >
                  查看详情
                </Button>
              ) : (
                <Button type="primary" onClick={() => setNotificationDetail(null)}>
                  知道了
                </Button>
              )}
              <Button onClick={() => setNotificationDetail(null)}>关闭</Button>
            </div>
          ) : null
        }
        width={560}
      >
        {notificationDetail && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${getNotificationCategoryStyle(notificationDetail)}`}>
                {getNotificationCategoryLabel(notificationDetail)}
              </span>
              <span className="text-xs text-gray-400">{notificationDetail.timestamp}</span>
            </div>
            <p className="text-sm text-gray-500">
              发送人：{notificationDetail.sender?.name || '系统'}
            </p>
            <h4 className="text-base font-semibold text-gray-900">{notificationDetail.title}</h4>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{notificationDetail.content}</p>
            {notificationDetail.attachments && notificationDetail.attachments.length > 0 && (
              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 mb-2">附件</p>
                <div className="flex flex-wrap gap-2">
                  {notificationDetail.attachments.map((file) => (
                    <button
                      key={file.id}
                      type="button"
                      onClick={() =>
                        void downloadStudentGuidanceAttachment(file.id, file.fileName).catch((e) => {
                          notification.warning({
                            message: '下载失败',
                            description: e instanceof Error ? e.message : '请稍后重试',
                            placement: 'topRight',
                          });
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 border border-teal-100 text-xs text-teal-700 hover:bg-teal-100 cursor-pointer"
                    >
                      <i className="ri-download-2-line" />
                      <span className="max-w-[200px] truncate">{file.fileName}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={!!activeTodoDialogTask}
        title="任务详情"
        onCancel={() => setActiveTodoDialogTask(null)}
        onOk={() => void completeTodoDialogTask()}
        okText={taskSubmitting ? '提交中...' : '已完成'}
        cancelText="取消"
        okButtonProps={{ disabled: taskSubmitting }}
        width={720}
      >
        {activeTodoDialogTask && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-base font-bold text-gray-900">{activeTodoDialogTask.title}</h3>
                <span className="px-2 py-0.5 rounded-lg bg-teal-50 text-teal-700 text-xs">{activeTodoDialogTask.module}</span>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{activeTodoDialogTask.description || '暂无任务描述'}</p>
            </div>
            {activeTodoDialogTask.attachments.length > 0 && (
              <div>
                <div className="text-xs text-gray-400 mb-2">教师附件</div>
                <div className="flex flex-wrap gap-2">
                  {activeTodoDialogTask.attachments.map((file) => (
                    <button
                      key={file.id}
                      type="button"
                      onClick={() => selectedClassId && void downloadStudentTaskAttachment(selectedClassId, activeTodoDialogTask.id, file.id, file.fileName)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-xs text-teal-700 hover:bg-teal-50 cursor-pointer"
                    >
                      <i className="ri-attachment-2"></i>
                      <span className="max-w-[180px] truncate">{file.fileName}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {activeTodoDialogTask.trainingModuleId && !isTaskPrerequisiteMet(activeTodoDialogTask) && (
              <div className="rounded-xl bg-teal-50 border border-teal-100 p-4">
                <p className="text-sm text-teal-700 leading-relaxed">
                  请先完成该环节实践课程学习及知识点检测后再标记完成。
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const moduleId = activeTodoDialogTask.trainingModuleId || 'ideation';
                    setActiveCourseTaskId(activeTodoDialogTask.id);
                    setActiveTab('knowledge');
                    setKnowledgeSubTab('knowledge');
                    setSelectedModule(moduleId);
                    setActiveTodoDialogTask(null);
                  }}
                  className="mt-3 px-4 py-2 bg-teal-500 text-white text-sm rounded-xl hover:bg-teal-600 cursor-pointer"
                >
                  前往实践课程
                </button>
              </div>
            )}
            {activeTodoDialogTask.requiresStudentAttachment && (
              <div>
                <div className="text-xs text-gray-500 mb-2">提交附件</div>
                <Upload
                  beforeUpload={(file) => {
                    setTaskSubmitFiles((prev) => [...prev, file]);
                    return false;
                  }}
                  fileList={taskSubmitFiles.map((file, index): UploadFile => ({
                    uid: `${index}`,
                    name: file.name,
                    status: 'done',
                  }))}
                  onRemove={(file) => {
                    const idx = Number(file.uid);
                    setTaskSubmitFiles((prev) => prev.filter((_, index) => index !== idx));
                  }}
                >
                  <button type="button" className="px-4 py-2 rounded-xl border border-teal-200 text-teal-700 text-sm hover:bg-teal-50 cursor-pointer">
                    选择文件
                  </button>
                </Upload>
              </div>
            )}
          </div>
        )}
      </Modal>

      <UnlockTrainingStageModal
        open={Boolean(unlockStageModalModuleId)}
        moduleId={unlockStageModalModuleId}
        onClose={() => setUnlockStageModalModuleId(null)}
        getStartDateLabel={getStartDateLabelForUnlock}
        teamFormationComplete={teamFormationComplete}
        isBeforeStageStart={isBeforeStageStart}
        isStageCompleted={isModuleCompletedByProgress}
        activeTrainingOrder={[...activeTrainingOrder]}
      />

      <Modal
        open={shouldBlockModule}
        title={
          <div className="flex items-center gap-2 text-gray-900">
            <span>
              请先完成实践课程
              {activeTrainingModuleId
                ? `（${moduleProgress.find((m) => m.moduleId === activeTrainingModuleId)?.moduleName || ''}）`
                : ''}
            </span>
          </div>
        }
        closable={false}
        maskClosable={false}
        keyboard={false}
        footer={null}
        centered
      >
        <div className="space-y-5">
          <p className="text-sm text-gray-600 leading-relaxed">
            {activeModulePrereq?.summary ||
              `当前实训阶段已关联实践课程，请先完成课程学习（各小节达 ${COURSE_GATE_PERCENT}%）及知识点检测后再进行实训任务。`}
          </p>
          <button
            type="button"
            onClick={() => {
              const moduleId = activeTrainingModuleId || 'ideation';
              const taskId = null;
              setActiveCourseTaskId(taskId);
              setActiveTab('knowledge');
              setKnowledgeSubTab('knowledge');
              setSelectedModule(moduleId);
              setActiveLearningKnowledge(null);
            }}
            className="w-full py-2.5 bg-gradient-to-r from-teal-500 to-cyan-600 text-white text-sm font-semibold rounded-xl hover:shadow-md transition-all cursor-pointer"
          >
            前往实践课程
          </button>
        </div>
      </Modal>

      {logoutModalOpen && (
        <AppModalPortal open={true} onMaskClick={() => setLogoutModalOpen(false)} zIndex={50}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-12 h-12 flex items-center justify-center bg-red-50 rounded-full flex-shrink-0">
                  <i className="ri-logout-box-r-line text-2xl text-red-500"></i>
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">确认退出登录</h3>
                  <p className="text-sm text-gray-500 mt-0.5">退出后将返回首页</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setLogoutModalOpen(false)}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    setLogoutModalOpen(false);
                    clearPortalToken('student');
                    navigate('/');
                  }}
                  className="flex-1 py-2.5 bg-red-500 text-white text-sm font-medium rounded-xl hover:bg-red-600 transition-colors cursor-pointer whitespace-nowrap"
                >
                  确认退出
                </button>
              </div>
            </div>
          </div>
        </AppModalPortal>
      )}
    </div>
  );
}
