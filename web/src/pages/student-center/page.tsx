import { useState, useMemo, useEffect, useRef } from 'react';
import { Modal, notification } from 'antd';
import { clearPortalToken, getPortalToken, parseJwtPayload } from '../../lib/authApi';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useSiteBrand } from '../../lib/publicSite';
import LearningDetail from '../knowledge-system/components/LearningDetail';
import QuizModal from './components/QuizModal';
import { quizBank } from '../../mocks/quizBank';
import { notifications } from '../../mocks/notifications';
import StudentClassSwitcher from './components/StudentClassSwitcher';
import TeamFormationModule from './components/TeamFormationModule';
import IdeationModule from './components/IdeationModule';
import MarketResearchModule from './components/MarketResearchModule';
import ProductDesignModule from './components/ProductDesignModule';
import BusinessModelModule from './components/BusinessModelModule';
import RoleSimulationModule from './components/RoleSimulationModule';
import BusinessPlanModule from './components/BusinessPlanModule';
import {
  fetchStudentPersonalEnrollments,
  getStudentProfile,
  type StudentPersonalEnrollment,
  type StudentProfile,
} from '../../lib/studentPortalApi';
import { fetchTeamSubmission, isTeamFormationDone } from '../../lib/teamFormationApi';

type TabType =
  | 'overview'
  | 'ability'
  | 'archive'
  | 'knowledge'
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

export default function StudentCenterPage() {
  const { logoUrl, siteTitle } = useSiteBrand();
  const brandTitle = siteTitle.trim() || '学生工作台';
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialModule = searchParams.get('module');

  const getInitialTab = (): TabType => {
    // 优先读取 tab 参数（直接传入 tab key，如 module-business）
    const tabParam = searchParams.get('tab');
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
  const [showLearningDetail, setShowLearningDetail] = useState(false);
  const [knowledgeSubTab, setKnowledgeSubTab] = useState<'overview' | 'knowledge' | 'ability' | 'progress'>('overview');
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const [quizStates, setQuizStates] = useState<KnowledgeQuizState>({});
  const [completedKnowledgeIds, setCompletedKnowledgeIds] = useState<Set<string>>(new Set(['k_ideation_1']));
  const [moduleProgressState, setModuleProgressState] = useState<Record<string, number>>({
    team: 4, ideation: 5, market: 6, product: 3, business: 2, simulation: 1, plan: 0,
  });
  const [notificationFilter, setNotificationFilter] = useState<'all' | 'guidance' | 'reminder' | 'evaluation'>('all');
  const [notificationReadFilter, setNotificationReadFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [notificationList, setNotificationList] = useState(notifications);
  const [expandedNotificationId, setExpandedNotificationId] = useState<string | null>(null);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [enrollments, setEnrollments] = useState<StudentPersonalEnrollment[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const teamGuideShownRef = useRef(false);

  const selectedEnrollment = useMemo(
    () => enrollments.find((e) => e.classId === selectedClassId) ?? enrollments[0],
    [enrollments, selectedClassId]
  );

  useEffect(() => {
    getStudentProfile()
      .then(setStudentProfile)
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
        const valid = saved && list.some((e) => e.classId === saved);
        setSelectedClassId(valid ? saved! : list[0].classId);
      })
      .catch(() => setEnrollments([]));
  }, []);

  useEffect(() => {
    if (!selectedClassId || teamGuideShownRef.current) return;
    void fetchTeamSubmission(selectedClassId)
      .then((sub) => {
        if (isTeamFormationDone(sub.status)) return;
        teamGuideShownRef.current = true;
        setActiveTab('module-team');
        notification.info({
          message: '请先完成组队测评',
          description: '进入「组队与团队管理」完成教师预设题目、上传视频并提交，等待教师组队。',
          placement: 'topRight',
          duration: 6,
        });
      })
      .catch(() => {});
  }, [selectedClassId]);

  const handleClassChange = (classId: string) => {
    setSelectedClassId(classId);
    sessionStorage.setItem('jiada_student_selected_class_id', classId);
  };

  const overallProgress = {
    currentLevel: '初级创业者', nextLevel: '中级创业者', levelProgress: 36,
  };

  const { studentDisplayName, studentAvatarChar } = useMemo(() => {
    const token = getPortalToken('student');
    const payloadUser = token ? parseJwtPayload(token)?.username : null;
    const jwtFallback = (payloadUser && String(payloadUser).trim()) || '';

    const realName = (studentProfile?.realName && String(studentProfile.realName).trim()) || '';
    const studentNo = (studentProfile?.studentNo && String(studentProfile.studentNo).trim()) || '';
    const loginUsername = (studentProfile?.username && String(studentProfile.username).trim()) || jwtFallback;

    /** 姓名 → 学号 → 登录名（JWT 常为数字内部账号，不适合作为首选展示） */
    const name = realName || studentNo || loginUsername || '学生';
    return { studentDisplayName: name, studentAvatarChar: [...name][0] || '学' };
  }, [studentProfile]);
  const getModuleUnlockStatus = (moduleId: string): 'locked' | 'in_progress' | 'completed' => {
    const thresholds: Record<string, number> = { team: 4, ideation: 6, market: 8, product: 7, business: 9, simulation: 4, plan: 4 };
    const val = moduleProgressState[moduleId] || 0;
    const threshold = thresholds[moduleId] || 99;
    return val >= threshold ? 'completed' : 'in_progress';
  };

  const trainingModuleMenuItems = [
    { key: 'module-team' as TabType, label: '组队与团队管理', icon: 'ri-team-line' },
    { key: 'module-ideation' as TabType, label: '创新思维与创意生成', icon: 'ri-lightbulb-line' },
    { key: 'module-market' as TabType, label: '市场调研与用户画像', icon: 'ri-search-line' },
    { key: 'module-product' as TabType, label: '产品设计与迭代', icon: 'ri-pencil-ruler-line' },
    { key: 'module-business' as TabType, label: '商业模式设计', icon: 'ri-pie-chart-line' },
    { key: 'module-simulation' as TabType, label: 'AI仿真模拟', icon: 'ri-robot-line' },
    { key: 'module-plan' as TabType, label: '商业计划书要点', icon: 'ri-file-text-line' },
  ];

  const moduleProgress = [
    { moduleId: 'team', moduleName: '组队与团队管理', totalKnowledge: 4, completedKnowledge: moduleProgressState.team, totalTasks: 3, completedTasks: 3, status: getModuleUnlockStatus('team'), color: 'from-purple-500 to-purple-600' },
    { moduleId: 'ideation', moduleName: '创新思维与创意生成', totalKnowledge: 6, completedKnowledge: moduleProgressState.ideation, totalTasks: 4, completedTasks: 3, status: getModuleUnlockStatus('ideation'), color: 'from-teal-500 to-teal-600' },
    { moduleId: 'market', moduleName: '市场调研与用户画像', totalKnowledge: 8, completedKnowledge: moduleProgressState.market, totalTasks: 5, completedTasks: 4, status: getModuleUnlockStatus('market'), color: 'from-green-500 to-green-600' },
    { moduleId: 'product', moduleName: '产品设计与迭代', totalKnowledge: 7, completedKnowledge: moduleProgressState.product, totalTasks: 4, completedTasks: 1, status: getModuleUnlockStatus('product'), color: 'from-orange-500 to-orange-600' },
    { moduleId: 'business', moduleName: '商业模式设计', totalKnowledge: 9, completedKnowledge: moduleProgressState.business, totalTasks: 6, completedTasks: 0, status: getModuleUnlockStatus('business'), color: 'from-pink-500 to-pink-600' },
    { moduleId: 'simulation', moduleName: 'AI仿真模拟', totalKnowledge: 4, completedKnowledge: moduleProgressState.simulation, totalTasks: 3, completedTasks: 0, status: getModuleUnlockStatus('simulation'), color: 'from-indigo-500 to-indigo-600' },
    { moduleId: 'plan', moduleName: '商业计划书要点', totalKnowledge: 4, completedKnowledge: moduleProgressState.plan, totalTasks: 2, completedTasks: 0, status: getModuleUnlockStatus('plan'), color: 'from-teal-500 to-teal-600' },
  ];

  const knowledgePoints = [
    { id: 'k_ideation_1', name: '头脑风暴法', module: 'ideation', description: '掌握头脑风暴、延迟判断等核心创新思维工具', status: completedKnowledgeIds.has('k_ideation_1') ? 'completed' : 'learning', progress: completedKnowledgeIds.has('k_ideation_1') ? 100 : 65, abilityPoints: ['创新思维'], resources: [{ type: 'video', name: '头脑风暴法导论' }, { type: 'document', name: '实施指南' }], quizId: 'k_ideation_1' },
    { id: 'k_ideation_2', name: 'SCAMPER创新法', module: 'ideation', description: '掌握SCAMPER七大创新维度，学会系统化创新', status: completedKnowledgeIds.has('k_ideation_2') ? 'completed' : 'learning', progress: completedKnowledgeIds.has('k_ideation_2') ? 100 : 40, abilityPoints: ['创新思维', '系统思维'], resources: [{ type: 'video', name: 'SCAMPER方法详解' }, { type: 'document', name: '实战手册' }], quizId: 'k_ideation_2' },
    { id: 'k_market_1', name: '市场调研方法', module: 'market', description: '学习问卷设计、访谈技巧、数据分析方法', status: completedKnowledgeIds.has('k_market_1') ? 'completed' : 'learning', progress: completedKnowledgeIds.has('k_market_1') ? 100 : 75, abilityPoints: ['用户洞察', '数据分析'], resources: [{ type: 'video', name: '市场调研基础' }, { type: 'case', name: '成功调研案例' }], quizId: 'k_market_1' },
    { id: 'k_market_2', name: '用户画像构建', module: 'market', description: '学习如何构建精准的用户画像', status: completedKnowledgeIds.has('k_market_2') ? 'completed' : 'learning', progress: completedKnowledgeIds.has('k_market_2') ? 100 : 60, abilityPoints: ['用户洞察'], resources: [{ type: 'document', name: '用户画像模板' }], quizId: 'k_market_2' },
    { id: 'k_product_1', name: '产品原型设计', module: 'product', description: '掌握原型设计工具与方法，理解MVP概念', status: completedKnowledgeIds.has('k_product_1') ? 'completed' : 'locked', progress: completedKnowledgeIds.has('k_product_1') ? 100 : 0, abilityPoints: ['产品设计'], resources: [{ type: 'video', name: '原型设计入门' }], quizId: 'k_product_1' },
    { id: 'k_business_1', name: '商业模式画布', module: 'business', description: '学习商业模式画布的9大模块，系统构建商业模式', status: completedKnowledgeIds.has('k_business_1') ? 'completed' : 'locked', progress: completedKnowledgeIds.has('k_business_1') ? 100 : 0, abilityPoints: ['商业思维'], resources: [{ type: 'video', name: '商业模式画布详解' }], quizId: 'k_business_1' },
    { id: 'k_simulation_1', name: 'AI角色推荐方法', module: 'simulation', description: '了解创业团队角色分工与AI智能推荐逻辑', status: completedKnowledgeIds.has('k_simulation_1') ? 'completed' : 'locked', progress: completedKnowledgeIds.has('k_simulation_1') ? 100 : 0, abilityPoints: ['角色认知', '项目管理'], resources: [{ type: 'video', name: 'AI角色推荐原理' }], quizId: 'k_simulation_1' },
    { id: 'k_plan_1', name: '商业计划书撰写', module: 'plan', description: '掌握商业计划书结构与路演PPT制作技巧', status: completedKnowledgeIds.has('k_plan_1') ? 'completed' : 'locked', progress: completedKnowledgeIds.has('k_plan_1') ? 100 : 0, abilityPoints: ['文案撰写', '演讲表达'], resources: [{ type: 'document', name: '商业计划书模板' }], quizId: 'k_plan_1' },
  ];

  const abilityPointsData = [
    { id: 'a1', name: '创新思维', category: '核心能力', level: 4, maxLevel: 5, description: '发散思维、创意生成、创新方法运用', obtainedFrom: '创新思维与创意生成 - 创意筛选报告审核通过', obtainedDate: '2024-12-15' },
    { id: 'a2', name: '团队协作', category: '核心能力', level: 3, maxLevel: 5, description: '沟通协调、任务分工、冲突解决', obtainedFrom: '组队与团队管理 - 团队组建完成', obtainedDate: '2024-12-01' },
    { id: 'a3', name: '系统思维', category: '核心能力', level: 3, maxLevel: 5, description: '全局观、逻辑分析、结构化思考', obtainedFrom: '创新思维与创意生成 - SCAMPER方法实践', obtainedDate: '2024-12-18' },
    { id: 'a4', name: '用户洞察', category: '专业能力', level: 3, maxLevel: 5, description: '需求挖掘、用户研究、同理心', obtainedFrom: '市场调研与用户画像 - 用户画像绘制完成', obtainedDate: '2024-12-25' },
    { id: 'a5', name: '数据分析', category: '专业能力', level: 2, maxLevel: 5, description: '数据收集、统计分析、可视化呈现', obtainedFrom: '市场调研与用户画像 - 调研数据分析', obtainedDate: '2024-12-22' },
    { id: 'a6', name: '沟通能力', category: '通用能力', level: 3, maxLevel: 5, description: '表达清晰、倾听理解、说服影响', obtainedFrom: '组队与团队管理 - 团队讨论参与', obtainedDate: '2024-12-05' },
  ];

  const knowledgeModules = [
    { id: 'all', name: '全部模块', color: 'bg-gradient-to-r from-gray-500 to-gray-600' },
    { id: 'ideation', name: '创新思维', color: 'bg-gradient-to-r from-teal-500 to-teal-600' },
    { id: 'market', name: '市场调研', color: 'bg-gradient-to-r from-green-500 to-green-600' },
    { id: 'product', name: '产品设计', color: 'bg-gradient-to-r from-orange-500 to-orange-600' },
    { id: 'business', name: '商业模式', color: 'bg-gradient-to-r from-pink-500 to-pink-600' },
    { id: 'simulation', name: 'AI角色', color: 'bg-gradient-to-r from-indigo-500 to-indigo-600' },
    { id: 'plan', name: '商业计划', color: 'bg-gradient-to-r from-teal-600 to-cyan-600' },
  ];

  const learningRecords = [
    { id: 'r1', type: 'knowledge' as const, title: '创新思维方法学习', module: '创新思维与创意生成', date: '2024-12-15', duration: '45分钟', status: '已完成', score: undefined as number | undefined },
    { id: 'r2', type: 'case' as const, title: '参考案例：共享单车创新', module: '创新思维与创意生成', date: '2024-12-16', duration: '30分钟', status: '已完成', score: undefined as number | undefined },
    { id: 'r3', type: 'task' as const, title: '创意筛选报告提交', module: '创新思维与创意生成', date: '2024-12-18', duration: undefined as string | undefined, status: '优秀', score: undefined as number | undefined },
    { id: 'r4', type: 'evaluation' as const, title: '创意筛选报告评价', module: '创新思维与创意生成', date: '2024-12-20', duration: undefined as string | undefined, status: '优秀', score: 95 },
    { id: 'r5', type: 'knowledge' as const, title: '市场调研方法学习', module: '市场调研与用户画像', date: '2024-12-22', duration: '50分钟', status: '已完成', score: undefined as number | undefined },
    { id: 'r6', type: 'task' as const, title: '调研问卷设计', module: '市场调研与用户画像', date: '2024-12-25', duration: undefined as string | undefined, status: '已通过', score: undefined as number | undefined },
  ];

  const handleQuizPass = (knowledgeId: string, moduleId: string) => {
    setQuizStates((prev) => ({ ...prev, [knowledgeId]: 'passed' }));
    setCompletedKnowledgeIds((prev) => new Set([...prev, knowledgeId]));
    setModuleProgressState((prev) => ({ ...prev, [moduleId]: Math.min((prev[moduleId] || 0) + 1, 99) }));
  };

  const unreadCount = notificationList.filter(n => !n.isRead).length;
  const completedCount = moduleProgress.filter(m => m.status === 'completed').length;
  const inProgressCount = moduleProgress.filter(m => m.status === 'in_progress').length;

  const markAsRead = (id: string) => setNotificationList(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  const markAllAsRead = () => setNotificationList(prev => prev.map(n => ({ ...n, isRead: true })));

  const filteredNotifications = notificationList.filter(n => {
    if (notificationFilter !== 'all' && n.type !== notificationFilter) return false;
    if (notificationReadFilter === 'unread' && n.isRead) return false;
    if (notificationReadFilter === 'read' && !n.isRead) return false;
    return true;
  });

  const getNotificationTypeStyle = (type: string) => {
    switch (type) {
      case 'guidance': return 'bg-teal-100 text-teal-700';
      case 'reminder': return 'bg-orange-100 text-orange-700';
      case 'evaluation': return 'bg-purple-100 text-purple-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getNotificationTypeText = (type: string) => {
    switch (type) {
      case 'guidance': return '引导意见';
      case 'reminder': return '督促通知';
      case 'evaluation': return '评价反馈';
      default: return '消息';
    }
  };

  const learningMenuItems = [
    { key: 'overview' as TabType, label: '进度看板', icon: 'ri-dashboard-line' },
    { key: 'knowledge' as TabType, label: '实践课程', icon: 'ri-book-2-line' },
    { key: 'ability' as TabType, label: '能力点管理', icon: 'ri-medal-line' },
    { key: 'archive' as TabType, label: '学习档案', icon: 'ri-folder-line' },
    { key: 'notifications' as TabType, label: '消息通知', icon: 'ri-notification-line' },
  ];

  const getModuleProgress = (moduleId: string): number => {
    const mod = moduleProgress.find(m => m.moduleId === moduleId);
    if (!mod) return 0;
    const kp = mod.totalKnowledge > 0 ? (mod.completedKnowledge / mod.totalKnowledge) * 100 : 0;
    const tp = mod.totalTasks > 0 ? (mod.completedTasks / mod.totalTasks) * 100 : 0;
    return Math.round((kp + tp) / 2);
  };

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

  const filteredKnowledge = selectedModule === 'all' ? knowledgePoints : knowledgePoints.filter(k => k.module === selectedModule);

  const todoTasks = [
    { id: 't1', type: 'task' as const, title: '创意筛选报告提交', module: '创新思维与创意生成', moduleKey: 'module-ideation', daysLeft: 2, priority: 'urgent' as const, quizId: undefined as string | undefined },
    { id: 't2', type: 'task' as const, title: '用户访谈记录整理', module: '市场调研与用户画像', moduleKey: 'module-market', daysLeft: 5, priority: 'normal' as const, quizId: undefined as string | undefined },
    { id: 't3', type: 'task' as const, title: '产品原型设计稿', module: '产品设计与原型', moduleKey: 'module-product', daysLeft: 7, priority: 'normal' as const, quizId: undefined as string | undefined },
    { id: 't4', type: 'quiz' as const, title: 'SCAMPER创新法 — 学习检测', module: '创新思维与创意生成', moduleKey: 'knowledge', daysLeft: 3, priority: 'urgent' as const, quizId: 'k_ideation_2' },
    { id: 't5', type: 'quiz' as const, title: '用户画像构建 — 学习检测', module: '市场调研与用户画像', moduleKey: 'knowledge', daysLeft: 6, priority: 'normal' as const, quizId: 'k_market_2' },
  ];

  const activeTodoTasks = todoTasks.filter(task => {
    if (task.type === 'quiz' && task.quizId && completedKnowledgeIds.has(task.quizId)) return false;
    return true;
  });

  const urgentCount = activeTodoTasks.filter(t => t.priority === 'urgent').length;

  if (showLearningDetail) {
    return <LearningDetail onBack={() => setShowLearningDetail(false)} />;
  }

  const handleModuleClick = (moduleKey: TabType) => {
    setActiveTab(moduleKey);
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
          />
        );
      case 'module-ideation':
        return <IdeationModule key={selectedClassId} />;
      case 'module-market':
        return <MarketResearchModule key={selectedClassId} />;
      case 'module-product':
        return <ProductDesignModule key={selectedClassId} />;
      case 'module-business':
        return <BusinessModelModule key={selectedClassId} />;
      case 'module-simulation':
        return <RoleSimulationModule key={selectedClassId} />;
      case 'module-plan':
        return <BusinessPlanModule key={selectedClassId} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex">
      {/* 左侧侧边栏：视口固定高度；主内容超长时由 body 滚动 */}
      <aside
        className={`flex-shrink-0 self-start sticky top-0 z-30 h-screen max-h-screen bg-white border-r border-gray-100 shadow-sm flex flex-col transition-all duration-300 ${sidebarCollapsed ? 'w-16' : 'w-60'}`}
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

        {!sidebarCollapsed && (
          <div className="mx-3 mt-4 p-3 bg-gradient-to-br from-teal-50 to-cyan-50 rounded-xl border border-teal-100">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">{studentAvatarChar}</div>
              <div className="overflow-hidden">
                <div className="text-xs font-bold text-gray-900 truncate">{studentDisplayName}</div>
                <div className="text-xs text-teal-600 truncate">{overallProgress.currentLevel}</div>
              </div>
            </div>
            <div className="w-full bg-teal-100 rounded-full h-1.5 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full" style={{ width: `${overallProgress.levelProgress}%` }} />
            </div>
            <div className="text-xs text-gray-500 mt-1">{overallProgress.levelProgress}% → {overallProgress.nextLevel}</div>
          </div>
        )}

        <nav className="flex-1 py-3 overflow-y-auto">
          {!sidebarCollapsed && <div className="px-4 py-2"><span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">学习管理</span></div>}
          <div className="px-2 space-y-0.5 mb-2">
            {learningMenuItems.map((item) => (
              <button key={item.key} onClick={() => setActiveTab(item.key)} title={sidebarCollapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap relative ${activeTab === item.key ? 'bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'} ${sidebarCollapsed ? 'justify-center' : ''}`}
              >
                <div className="w-5 h-5 flex items-center justify-center flex-shrink-0"><i className={`${item.icon} text-base`}></i></div>
                {!sidebarCollapsed && <span className="text-sm font-medium">{item.label}</span>}
                {item.key === 'notifications' && unreadCount > 0 && (
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
              const modIdMap: Record<string, string> = { 'module-team': 'team', 'module-ideation': 'ideation', 'module-market': 'market', 'module-product': 'product', 'module-business': 'business', 'module-simulation': 'simulation', 'module-plan': 'plan' };
              const status = getModuleUnlockStatus(modIdMap[item.key]);
              const prog = getModuleProgress(modIdMap[item.key]);
              const isActive = activeTab === item.key;
              return (
                <button 
                  key={item.key} 
                  onClick={() => handleModuleClick(item.key)} 
                  title={sidebarCollapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all cursor-pointer ${isActive ? 'bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'} ${sidebarCollapsed ? 'justify-center' : ''}`}
                >
                  {!sidebarCollapsed && <span className={`text-xs font-bold w-4 flex-shrink-0 ${isActive ? 'text-white/70' : 'text-gray-400'}`}>{index + 1}</span>}
                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0"><i className={`${item.icon} text-base`}></i></div>
                  {!sidebarCollapsed && (
                    <>
                      <span className="text-xs font-medium flex-1 text-left leading-tight">{item.label}</span>
                      <span className="flex-shrink-0">
                        {status === 'completed' && <i className="ri-checkbox-circle-fill text-green-400 text-sm"></i>}
                        {status === 'in_progress' && <span className="text-xs font-bold text-teal-400">{prog}%</span>}
                      </span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {!sidebarCollapsed && (
          <div className="px-3 pb-3">
            <div className="p-3 bg-gray-50 rounded-xl">
              <div className="text-xs text-gray-500 mb-2">实训进度</div>
              <div className="grid grid-cols-3 gap-1">
                <div className="text-center"><div className="text-base font-bold text-green-600">{completedCount}</div><div className="text-xs text-gray-400">已完成</div></div>
                <div className="text-center"><div className="text-base font-bold text-teal-500">{inProgressCount}</div><div className="text-xs text-gray-400">进行中</div></div>
                <div className="text-center"><div className="text-base font-bold text-gray-400">{7 - completedCount - inProgressCount}</div><div className="text-xs text-gray-400">未解锁</div></div>
              </div>
            </div>
          </div>
        )}

        <div className="p-3 border-t border-gray-100 shrink-0 space-y-2">
          <div className={`flex items-center gap-2.5 ${sidebarCollapsed ? 'justify-center' : ''}`}>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-cyan-400 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {studentAvatarChar}
            </div>
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

      {/* 右侧主内容区 */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-20">
          <div className="px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-400">学生工作台</span>
              <i className="ri-arrow-right-s-line text-gray-300"></i>
              {activeTab.startsWith('module-') && (<><span className="text-gray-400">实训模块</span><i className="ri-arrow-right-s-line text-gray-300"></i></>)}
              <span className="font-medium text-gray-700">{getCurrentLabel()}</span>
            </div>
            <div className="flex items-center gap-3">
              <StudentClassSwitcher
                enrollments={enrollments}
                selectedClassId={selectedClassId}
                onClassChange={handleClassChange}
              />
              <div className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors whitespace-nowrap cursor-pointer">
                <i className="ri-trophy-line"></i><span>{overallProgress.currentLevel}</span>
              </div>
            </div>
          </div>
        </header>

        <main key={selectedClassId || 'student-no-class'} className="flex-1 p-6">

          {/* 进度看板 */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              <div className="bg-gradient-to-br from-teal-500 via-cyan-500 to-teal-600 rounded-2xl shadow-lg overflow-hidden relative">
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute top-0 right-0 w-72 h-72 bg-white rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
                </div>
                <div className="relative px-8 py-6 flex items-center gap-6">
                  <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center flex-shrink-0 border border-white/30">
                    <i className="ri-rocket-line text-3xl text-white"></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h1 className="text-2xl font-bold text-white">校园快递创新项目</h1>
                      <span className="px-2.5 py-0.5 bg-white/20 text-white rounded-full text-xs font-medium border border-white/30 whitespace-nowrap cursor-pointer">创新创业实训课程</span>
                    </div>
                    <div className="flex items-center gap-5 text-sm text-white/80">
                      <span className="flex items-center gap-1.5">
                        <i className="ri-team-line"></i>
                        {selectedEnrollment?.className ?? '未加入教学班级'}
                        {enrollments.length > 1 ? ` · 已选 ${enrollments.length} 个班级` : ''}
                      </span>
                      <span className="flex items-center gap-1.5"><i className="ri-map-pin-line"></i>当前阶段：市场调研与用户画像</span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-center bg-white/10 backdrop-blur-md rounded-2xl px-8 py-4 border border-white/20">
                    <div className="text-4xl font-bold text-white mb-1">43%</div>
                    <div className="text-xs text-white/70 mb-2">项目整体进度</div>
                    <div className="w-24 h-1.5 bg-white/20 rounded-full overflow-hidden mx-auto">
                      <div className="h-full bg-white rounded-full" style={{ width: '43%' }}></div>
                    </div>
                  </div>
                  <div className="flex-shrink-0 bg-white/10 backdrop-blur-md rounded-2xl px-6 py-4 border border-white/20 text-center">
                    <div className="text-3xl font-bold text-white mb-1">3/7</div>
                    <div className="text-xs text-white/70">已完成阶段</div>
                  </div>
                </div>
              </div>

              {/* 实训模块步骤条 */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <i className="ri-layout-grid-line text-teal-600"></i>实训模块进度
                  </h3>
                  <span className="text-xs text-gray-400">{completedCount} 已完成 · {inProgressCount} 进行中</span>
                </div>
                <div className="flex items-start gap-0">
                  {moduleProgress.map((mod, index) => {
                    const isCompleted = mod.status === 'completed';
                    const isCurrent = mod.moduleId === 'market';
                    const prog = getModuleProgress(mod.moduleId);
                    const tabMap: Record<string, TabType> = { team: 'module-team', ideation: 'module-ideation', market: 'module-market', product: 'module-product', business: 'module-business', simulation: 'module-simulation', plan: 'module-plan' };
                    const icons = ['ri-team-line', 'ri-lightbulb-line', 'ri-search-line', 'ri-pencil-ruler-line', 'ri-pie-chart-line', 'ri-robot-line', 'ri-file-text-line'];
                    return (
                      <div key={mod.moduleId} className="flex-1 flex flex-col items-center relative">
                        {index < moduleProgress.length - 1 && (
                          <div className={`absolute top-5 left-1/2 w-full h-0.5 z-0 ${isCompleted ? 'bg-teal-400' : 'bg-gray-200'}`}></div>
                        )}
                        <button onClick={() => setActiveTab(tabMap[mod.moduleId])}
                          className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-all cursor-pointer shadow-sm ${isCompleted ? 'bg-teal-500 text-white' : isCurrent ? 'bg-white border-2 border-teal-500 text-teal-600 ring-4 ring-teal-100' : 'bg-white border-2 border-gray-200 text-gray-400'}`}
                        >
                          {isCompleted ? <i className="ri-check-line text-sm font-bold"></i> : <i className={`${icons[index]} text-sm`}></i>}
                        </button>
                        <div className={`text-center px-1 ${isCurrent ? 'text-teal-700' : isCompleted ? 'text-gray-700' : 'text-gray-400'}`}>
                          <div className={`font-semibold leading-tight mb-0.5 ${isCurrent ? 'text-teal-700' : ''}`} style={{ fontSize: '10px' }}>
                            {mod.moduleName.length > 6 ? mod.moduleName.slice(0, 6) + '…' : mod.moduleName}
                          </div>
                          <div style={{ fontSize: '10px' }} className={`${isCompleted ? 'text-teal-500' : isCurrent ? 'text-teal-500 font-bold' : 'text-gray-300'}`}>
                            {isCompleted ? '✓ 完成' : isCurrent ? `${prog}%` : '未开始'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 待办任务 */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <i className="ri-todo-line text-teal-600"></i>待办任务
                    {urgentCount > 0 && <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">{urgentCount} 紧急</span>}
                  </h3>
                  <span className="text-xs text-gray-400">{activeTodoTasks.length} 项待完成</span>
                </div>
                {activeTodoTasks.length === 0 ? (
                  <div className="py-8 text-center">
                    <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-3">
                      <i className="ri-checkbox-circle-line text-2xl text-green-500"></i>
                    </div>
                    <p className="text-sm font-medium text-gray-700">所有任务已完成！🎉</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {activeTodoTasks.map((task) => {
                      const isUrgent = task.priority === 'urgent';
                      const isQuiz = task.type === 'quiz';
                      return (
                        <div key={task.id}
                          className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all hover:shadow-sm cursor-pointer ${isUrgent ? 'border-red-200 bg-red-50/40' : 'border-gray-100 bg-gray-50/50 hover:border-teal-200'}`}
                          onClick={() => { if (isQuiz && task.quizId) setActiveQuizId(task.quizId); else setActiveTab(task.moduleKey as TabType); }}
                        >
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isQuiz ? 'bg-gradient-to-br from-teal-500 to-cyan-600' : isUrgent ? 'bg-gradient-to-br from-red-500 to-orange-500' : 'bg-gradient-to-br from-orange-400 to-orange-500'}`}>
                            <i className={`text-white text-sm ${isQuiz ? 'ri-edit-2-line' : 'ri-task-line'}`}></i>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                              <span className="font-semibold text-gray-900 text-sm truncate">{task.title}</span>
                              <span className={`px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0 ${isQuiz ? 'bg-teal-100 text-teal-700' : 'bg-orange-100 text-orange-700'}`}>{isQuiz ? '知识检测' : '实训任务'}</span>
                              {isUrgent && <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-xs font-bold flex-shrink-0"><i className="ri-alarm-warning-line"></i>紧急</span>}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-400">
                              <span className="truncate"><i className="ri-folder-line mr-1"></i>{task.module}</span>
                              <span className={`flex-shrink-0 font-medium ${task.daysLeft <= 3 ? 'text-red-500' : 'text-gray-400'}`}>
                                <i className="ri-calendar-line mr-1"></i>{task.daysLeft <= 0 ? '已逾期' : task.daysLeft === 1 ? '明天截止' : `还剩 ${task.daysLeft} 天`}
                              </span>
                            </div>
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); if (isQuiz && task.quizId) setActiveQuizId(task.quizId); else setActiveTab(task.moduleKey as TabType); }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer flex-shrink-0 ${isUrgent ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-gradient-to-r from-teal-500 to-cyan-600 text-white hover:shadow-md'}`}
                          >
                            {isQuiz ? '去检测' : '去完成'}<i className="ri-arrow-right-line ml-1"></i>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                {activeTodoTasks.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <p className="text-xs text-gray-400"><i className="ri-information-line mr-1"></i>完成知识检测后，对应待办将自动消除</p>
                    <button onClick={() => setActiveTab('knowledge')} className="text-xs text-teal-600 hover:text-teal-700 font-medium whitespace-nowrap cursor-pointer">查看全部知识检测 <i className="ri-arrow-right-s-line"></i></button>
                  </div>
                )}
              </div>

              {/* 我的团队 */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <i className="ri-team-line text-teal-600"></i>我的团队
                </h3>
                <div className="bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl p-5 text-white">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm"><i className="ri-team-line text-xl"></i></div>
                      <div>
                        <h4 className="font-bold">校园快递创新团队</h4>
                        <p className="text-teal-100 text-xs">5名成员 · 创建于 2024-12-01</p>
                      </div>
                    </div>
                    <button onClick={() => setActiveTab('module-team')} className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium transition-all whitespace-nowrap cursor-pointer">
                      <i className="ri-arrow-right-line mr-1"></i>进入团队管理
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    {[{ value: '92%', label: '团队进度' }, { value: '156', label: '共享文件' }, { value: '1247', label: '讨论消息' }, { value: '48h', label: '协作时长' }].map((item, i) => (
                      <div key={i} className="bg-white/10 rounded-lg p-3 text-center">
                        <div className="text-lg font-bold mb-0.5">{item.value}</div>
                        <div className="text-xs text-teal-100">{item.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 实践课程 */}
          {activeTab === 'knowledge' && (
            <div className="space-y-6">
              <div><h2 className="text-2xl font-bold text-gray-900 mb-1">实践课程</h2><p className="text-sm text-gray-500">学习知识点、完成检测、获取能力点，构建完整能力体系</p></div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-2">
                <div className="flex space-x-2">
                  {[{ id: 'overview', label: '学习概览', icon: 'ri-dashboard-line' }, { id: 'knowledge', label: '知识点库', icon: 'ri-book-2-line' }, { id: 'ability', label: '能力雷达', icon: 'ri-radar-line' }, { id: 'progress', label: '进度看板', icon: 'ri-line-chart-line' }].map((tab) => (
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
                    <div className="flex items-center justify-between mb-6">
                      <div><h3 className="text-2xl font-bold mb-2">我的学习进度</h3><p className="text-teal-100">持续学习，不断成长</p></div>
                      <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm"><i className="ri-trophy-line text-4xl"></i></div>
                    </div>
                    <div className="grid grid-cols-4 gap-6">
                      {[
                        { value: `${knowledgePoints.filter(k => k.status === 'completed').length}/${knowledgePoints.length}`, label: '知识点完成' },
                        { value: `${abilityPointsData.length}`, label: '能力点获得' },
                        { value: `${Math.round(knowledgePoints.filter(k => k.status === 'completed').length / knowledgePoints.length * 100)}%`, label: '整体完成度' },
                        { value: overallProgress.currentLevel, label: '当前等级' },
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
                        { icon: 'ri-star-line', label: '教师评价', color: 'from-purple-500 to-purple-600', desc: '获得反馈指导' },
                        { icon: 'ri-medal-line', label: '获得能力点', color: 'from-purple-500 to-purple-600', desc: '解锁下一环节' },
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
                  <div className="grid grid-cols-2 gap-6">
                    {filteredKnowledge.map((kp) => {
                      const isCompleted = kp.status === 'completed';
                      const isLocked = kp.status === 'locked';
                      const quizState = quizStates[kp.id];
                      const hasQuiz = !!quizBank[kp.id];
                      return (
                        <div key={kp.id}
                          className={`bg-white rounded-2xl shadow-sm border-2 p-6 transition-all ${isLocked ? 'opacity-60 border-gray-100' : isCompleted ? 'border-green-200 hover:shadow-xl' : 'border-gray-100 hover:shadow-xl hover:border-teal-200'} cursor-pointer`}
                          onClick={() => !isLocked && setShowLearningDetail(true)}
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <h3 className="text-base font-bold text-gray-900">{kp.name}</h3>
                                <span className={`px-2 py-0.5 rounded-lg text-xs font-medium border ${getKnowledgeStatusColor(kp.status)}`}>{getStatusText(kp.status)}</span>
                                {isCompleted && <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-lg text-xs font-medium"><i className="ri-checkbox-circle-fill"></i>检测已通过</span>}
                                {quizState === 'failed' && !isCompleted && <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-600 rounded-lg text-xs font-medium"><i className="ri-close-circle-line"></i>未通过</span>}
                              </div>
                              <p className="text-sm text-gray-600 mb-3">{kp.description}</p>
                              <div className="flex items-center gap-2 flex-wrap">
                                {kp.abilityPoints.map((ap, idx) => (
                                  <span key={idx} className="px-2 py-0.5 bg-teal-50 text-teal-700 rounded-lg text-xs font-medium"><i className="ri-medal-line mr-1"></i>{ap}</span>
                                ))}
                              </div>
                            </div>
                            {isLocked && <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center ml-4"><i className="ri-lock-line text-xl text-gray-400"></i></div>}
                            {isCompleted && <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center ml-4"><i className="ri-checkbox-circle-fill text-xl text-green-500"></i></div>}
                          </div>
                          <div className="mb-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-gray-700">学习进度</span>
                              <span className="text-sm font-bold text-teal-600">{kp.progress}%</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                              <div className={`h-full rounded-full transition-all duration-500 ${isCompleted ? 'bg-gradient-to-r from-green-400 to-teal-500' : 'bg-gradient-to-r from-teal-500 to-cyan-600'}`} style={{ width: `${kp.progress}%` }}></div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500"><i className="ri-file-list-line mr-1"></i>{kp.resources.length} 个学习资源</span>
                            {!isLocked && (
                              <div className="flex items-center gap-2">
                                <button onClick={(e) => { e.stopPropagation(); setShowLearningDetail(true); }} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer">
                                  <i className="ri-play-circle-line mr-1"></i>{isCompleted ? '复习' : '学习'}
                                </button>
                                {hasQuiz && (
                                  <button onClick={(e) => { e.stopPropagation(); setActiveQuizId(kp.id); }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${isCompleted ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gradient-to-r from-teal-500 to-cyan-600 text-white hover:shadow-md'}`}
                                  >
                                    <i className={`${isCompleted ? 'ri-refresh-line' : 'ri-edit-2-line'} mr-1`}></i>{isCompleted ? '重新检测' : '开始检测'}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {knowledgeSubTab === 'ability' && (
                <div className="space-y-6">
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                    <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2"><i className="ri-radar-line text-teal-600"></i>能力雷达图</h3>
                    <div className="flex items-center justify-center py-8">
                      <div className="relative w-80 h-80">
                        <svg className="w-full h-full" viewBox="0 0 400 400">
                          {[1,2,3,4,5].map((level) => (<circle key={level} cx="200" cy="200" r={level * 32} fill="none" stroke="#e5e7eb" strokeWidth="1" />))}
                          {abilityPointsData.map((_, index) => { const angle = (index * 360) / abilityPointsData.length - 90; const x = 200 + 160 * Math.cos((angle * Math.PI) / 180); const y = 200 + 160 * Math.sin((angle * Math.PI) / 180); return <line key={index} x1="200" y1="200" x2={x} y2={y} stroke="#e5e7eb" strokeWidth="1" />; })}
                          <polygon points={abilityPointsData.map((ability, index) => { const angle = (index * 360) / abilityPointsData.length - 90; const radius = (ability.level / ability.maxLevel) * 160; const x = 200 + radius * Math.cos((angle * Math.PI) / 180); const y = 200 + radius * Math.sin((angle * Math.PI) / 180); return `${x},${y}`; }).join(' ')} fill="rgba(20,184,166,0.2)" stroke="rgb(20,184,166)" strokeWidth="2" />
                        </svg>
                        {abilityPointsData.map((ability, index) => { const angle = (index * 360) / abilityPointsData.length - 90; const x = 200 + 195 * Math.cos((angle * Math.PI) / 180); const y = 200 + 195 * Math.sin((angle * Math.PI) / 180); return (<div key={index} className="absolute text-xs font-semibold text-gray-700 whitespace-nowrap" style={{ left: `${x}px`, top: `${y}px`, transform: 'translate(-50%, -50%)' }}>{ability.name}</div>); })}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    {['核心能力', '专业能力', '通用能力'].map((category) => (
                      <div key={category} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><i className="ri-star-line text-teal-600"></i>{category}</h3>
                        <div className="space-y-4">
                          {abilityPointsData.filter(a => a.category === category).map((ability) => (
                            <div key={ability.id} className="border-b border-gray-100 pb-4 last:border-0">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2"><span className="font-semibold text-gray-900 text-sm">{ability.name}</span><span className="text-xs text-gray-500">Lv.{ability.level}</span></div>
                                <span className="text-sm font-medium text-teal-600">{ability.level}/{ability.maxLevel}</span>
                              </div>
                              <p className="text-xs text-gray-600 mb-2">{ability.description}</p>
                              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden"><div className="h-full bg-gradient-to-r from-teal-500 to-cyan-600 rounded-full" style={{ width: `${(ability.level / ability.maxLevel) * 100}%` }}></div></div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {knowledgeSubTab === 'progress' && (
                <div className="space-y-6">
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                    <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2"><i className="ri-time-line text-teal-600"></i>学习时间线</h3>
                    <div className="relative">
                      <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-teal-500 to-cyan-600"></div>
                      <div className="space-y-8">
                        {knowledgeModules.filter(m => m.id !== 'all').map((mod) => {
                          const modKnowledge = knowledgePoints.filter(k => k.module === mod.id);
                          const completed = modKnowledge.filter(k => k.status === 'completed').length;
                          const total = modKnowledge.length;
                          const isActive = modKnowledge.some(k => k.status === 'learning');
                          const isLocked = modKnowledge.every(k => k.status === 'locked');
                          return (
                            <div key={mod.id} className="relative pl-20">
                              <div className={`absolute left-0 w-16 h-16 ${mod.color} rounded-2xl flex items-center justify-center shadow-lg ${isActive ? 'ring-4 ring-teal-200' : ''} ${isLocked ? 'opacity-50' : ''}`}>
                                <i className={`ri-${isLocked ? 'lock' : completed === total && total > 0 ? 'checkbox-circle' : 'play'}-line text-2xl text-white`}></i>
                              </div>
                              <div className={`bg-gray-50 rounded-xl p-6 ${isActive ? 'ring-2 ring-teal-500' : ''}`}>
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="text-base font-bold text-gray-900">{mod.name}</h4>
                                  <div className="flex items-center gap-3">
                                    <span className={`px-3 py-1 rounded-lg text-sm font-medium ${isLocked ? 'bg-gray-200 text-gray-600' : completed === total && total > 0 ? 'bg-green-100 text-green-700' : isActive ? 'bg-teal-100 text-teal-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                      {isLocked ? '未解锁' : completed === total && total > 0 ? '已完成' : isActive ? '进行中' : '待开始'}
                                    </span>
                                    {!isLocked && <button onClick={() => setShowLearningDetail(true)} className="px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-lg text-sm font-medium hover:shadow-md transition-all whitespace-nowrap cursor-pointer">进入学习</button>}
                                  </div>
                                </div>
                                <div className="flex items-center justify-between mb-3">
                                  <span className="text-sm text-gray-600">{completed}/{total} 知识点完成</span>
                                  <span className="text-sm font-bold text-teal-600">{total > 0 ? Math.round((completed / total) * 100) : 0}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden"><div className={`h-full ${mod.color} rounded-full`} style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }}></div></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                    <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2"><i className="ri-checkbox-circle-line text-teal-600"></i>达标检测状态</h3>
                    <div className="grid grid-cols-3 gap-6">
                      {[
                        { moduleId: 'ideation', module: '创新思维', knowledgeIds: ['k_ideation_1', 'k_ideation_2'], required: 2 },
                        { moduleId: 'market', module: '市场调研', knowledgeIds: ['k_market_1', 'k_market_2'], required: 2 },
                        { moduleId: 'product', module: '产品设计', knowledgeIds: ['k_product_1'], required: 1 },
                        { moduleId: 'business', module: '商业模式', knowledgeIds: ['k_business_1'], required: 1 },
                        { moduleId: 'simulation', module: 'AI角色仿真', knowledgeIds: ['k_simulation_1'], required: 1 },
                        { moduleId: 'plan', module: '商业计划', knowledgeIds: ['k_plan_1'], required: 1 },
                      ].map((item) => {
                        const passedCount = item.knowledgeIds.filter(id => completedKnowledgeIds.has(id)).length;
                        const isPassed = passedCount >= item.required;
                        const isLocked = item.knowledgeIds.every(id => knowledgePoints.find(k => k.id === id)?.status === 'locked');
                        return (
                          <div key={item.moduleId} className={`border-2 rounded-xl p-6 ${isPassed ? 'border-green-400 bg-green-50' : isLocked ? 'border-gray-200 bg-gray-50' : 'border-teal-300 bg-teal-50'}`}>
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="font-bold text-gray-900">{item.module}</h4>
                              {isPassed ? <i className="ri-checkbox-circle-fill text-2xl text-green-600"></i> : isLocked ? <i className="ri-lock-line text-2xl text-gray-400"></i> : <i className="ri-time-line text-2xl text-teal-600"></i>}
                            </div>
                            <div className="mb-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm text-gray-600">检测通过</span>
                                <span className="text-sm font-bold text-teal-600">{passedCount}/{item.required}</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                <div className={`h-full rounded-full ${isPassed ? 'bg-green-500' : 'bg-gradient-to-r from-teal-500 to-cyan-600'}`} style={{ width: `${(passedCount / item.required) * 100}%` }}></div>
                              </div>
                            </div>
                            <div className={`text-xs font-medium ${isPassed ? 'text-green-700' : isLocked ? 'text-gray-500' : 'text-teal-700'}`}>
                              {isPassed ? '✓ 已达标，实训模块已解锁' : isLocked ? '完成前置环节后解锁' : `还需通过 ${item.required - passedCount} 个知识点检测`}
                            </div>
                            {!isPassed && !isLocked && (
                              <button onClick={() => { setKnowledgeSubTab('knowledge'); setSelectedModule(item.moduleId); }} className="mt-3 w-full py-1.5 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer">
                                <i className="ri-edit-2-line mr-1"></i>去完成检测
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
          {activeTab === 'archive' && (
            <div className="space-y-6">
              <div><h2 className="text-2xl font-bold text-gray-900 mb-1">学习档案</h2><p className="text-sm text-gray-500">全流程学习记录，支持筛选与导出</p></div>
              <div className="grid grid-cols-4 gap-5">
                {[
                  { label: '知识点学习', count: 15, icon: 'ri-book-2-line', color: 'from-teal-500 to-teal-600' },
                  { label: '案例参考', count: 12, icon: 'ri-lightbulb-line', color: 'from-green-500 to-green-600' },
                  { label: '实践任务', count: 10, icon: 'ri-edit-box-line', color: 'from-orange-500 to-orange-600' },
                  { label: '教师评价', count: 8, icon: 'ri-star-line', color: 'from-purple-500 to-purple-600' },
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
                  <div className="flex items-center gap-2">
                    <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-all whitespace-nowrap cursor-pointer"><i className="ri-filter-line mr-1.5"></i>筛选</button>
                    <button className="px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-lg text-sm font-medium hover:shadow-md transition-all whitespace-nowrap cursor-pointer"><i className="ri-download-line mr-1.5"></i>导出档案</button>
                  </div>
                </div>
                <div className="relative">
                  <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-teal-500 to-cyan-600"></div>
                  <div className="space-y-5">
                    {learningRecords.map((record) => (
                      <div key={record.id} className="relative pl-20">
                        <div className={`absolute left-0 w-16 h-16 bg-gradient-to-br ${getRecordColor(record.type)} rounded-2xl flex items-center justify-center shadow-md`}><i className={`${getRecordIcon(record.type)} text-2xl text-white`}></i></div>
                        <div className="bg-gray-50 rounded-xl p-5 hover:shadow-sm transition-all">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="text-base font-bold text-gray-900">{record.title}</h4>
                                {record.score && <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-lg text-xs font-medium">{record.score}分</span>}
                              </div>
                              <div className="flex items-center gap-4 text-xs text-gray-500">
                                <span><i className="ri-folder-line mr-1"></i>{record.module}</span>
                                <span><i className="ri-calendar-line mr-1"></i>{record.date}</span>
                                {record.duration && <span><i className="ri-time-line mr-1"></i>{record.duration}</span>}
                              </div>
                            </div>
                            <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${record.status === '优秀' ? 'bg-green-100 text-green-700' : record.status === '已通过' ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-600'}`}>{record.status}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 实训模块内容 */}
          {activeTab.startsWith('module-') && (
            <div>
              {renderModuleContent()}
            </div>
          )}

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
                        <div key={notification.id}
                          className={`p-5 transition-all cursor-pointer hover:bg-gray-50 ${!notification.isRead ? 'bg-teal-50/30 border-l-4 border-l-teal-500' : ''}`}
                          onClick={() => { if (!notification.isRead) markAsRead(notification.id); setExpandedNotificationId(isExpanded ? null : notification.id); }}
                        >
                          <div className="flex items-start gap-4">
                            <img src={notification.sender.avatar} alt={notification.sender.name} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-gray-900">{notification.sender.name}</span>
                                  <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${getNotificationTypeStyle(notification.type)}`}>{getNotificationTypeText(notification.type)}</span>
                                  {notification.type === 'evaluation' && notification.score && (
                                    <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-lg text-xs font-medium"><i className="ri-trophy-line"></i>{notification.score}分</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className="text-xs text-gray-400">{notification.timestamp}</span>
                                  {!notification.isRead && <span className="w-2 h-2 bg-teal-500 rounded-full"></span>}
                                </div>
                              </div>
                              <h4 className="font-semibold text-gray-900 mb-2">{notification.title}</h4>
                              <p className={`text-sm text-gray-600 ${isExpanded ? '' : 'line-clamp-2'}`}>{notification.content}</p>
                              {isExpanded && (
                                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-3">
                                  <Link to={notification.moduleLink} className="px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-lg text-sm font-medium hover:shadow-md transition-all whitespace-nowrap cursor-pointer" onClick={(e) => e.stopPropagation()}>
                                    <i className="ri-arrow-right-line mr-1.5"></i>前往{notification.moduleName}
                                  </Link>
                                  <button onClick={(e) => { e.stopPropagation(); setExpandedNotificationId(null); }} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-all whitespace-nowrap cursor-pointer">收起</button>
                                </div>
                              )}
                              {!isExpanded && (
                                <button onClick={(e) => { e.stopPropagation(); setExpandedNotificationId(notification.id); if (!notification.isRead) markAsRead(notification.id); }} className="mt-2 text-sm text-teal-600 hover:text-teal-700 font-medium">
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

      {/* 检测弹窗 */}
      {activeQuizId && quizBank[activeQuizId] && (
        <QuizModal
          config={quizBank[activeQuizId]}
          onClose={() => setActiveQuizId(null)}
          onPass={(knowledgeId, moduleId) => { handleQuizPass(knowledgeId, moduleId); setActiveQuizId(null); }}
        />
      )}

      <Modal
        title="确认退出登录"
        open={logoutModalOpen}
        onCancel={() => setLogoutModalOpen(false)}
        onOk={() => {
          setLogoutModalOpen(false);
          clearPortalToken('student');
          navigate('/');
        }}
        okText="确认退出"
        cancelText="取消"
        okButtonProps={{ danger: true }}
        centered
      >
        <p className="text-sm text-gray-600">退出后将返回首页。</p>
      </Modal>
    </div>
  );
}
