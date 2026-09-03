import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Dropdown, Drawer, Modal, Upload, message as antdMessage, Input, Button } from 'antd';
import { clearPortalToken, getPortalToken, parseJwtPayload } from '../../lib/authApi';
import { useSiteBrand } from '../../lib/publicSite';
import TeamCard, { TeamProject } from './components/TeamCard';
import TeamDetailModal from './components/TeamDetailModal';
import BatchScoringModal from './components/BatchScoringModal';
import StatsPanel from './components/StatsPanel';
import GuidanceToolPanel from './components/GuidanceToolPanel';
import LearningAnalysisPanel from './components/LearningAnalysisPanel';
import StudentAnalysisBoard from './components/StudentAnalysisBoard';
import ClassManagement from './components/classManagement';
import StudentManagement from './components/studentManagement';
import TeamReview from './components/teamReview';
import TeamQuestionsPresetPage, {
  confirmLeaveTeamQuestionsUnsaved,
} from './components/teamReview/TeamQuestionsPresetPage';
import TopicReview from './components/topicReview';
import BusinessPlanReview from './components/businessPlanReview';
import ClassProjectOverview from '../class-project-overview/page';
import TeacherGuide from '../teacher-guide/page';
import CourseSettings from '../course-settings/page';
import EvaluationPanel from './components/EvaluationPanel';
import { openEconoverseAdmin } from '../../lib/econoverseUrl';
import { usePublicDictOptions } from '../admin-dashboard/components/classManagement/usePublicDictOptions';
import {
  getTeacherProfile,
  listTeacherPersonalClasses,
  sendTeacherEmailCode,
  updateTeacherProfile,
  uploadTeacherAvatar,
  type TeacherPersonalClassRow,
  type TeacherProfile,
} from './teacherPortalApi';
import { fetchTeacherMonitorTeams } from '../../lib/teacherMonitorApi';
import UserAvatar from '../../components/UserAvatar';

type TabKey =
  | 'monitor'
  | 'analysis'
  | 'guidance'
  | 'evaluation'
  | 'classManagement'
  | 'studentManagement'
  | 'teamReview'
  | 'topicReview'
  | 'businessPlanReview'
  | 'classProjectOverview'
  | 'teacherGuide'
  | 'courseSettings';

type SidebarGroup = {
  groupLabel?: string;
  items: {
    key: string;
    label: string;
    icon: string;
    type: 'tab' | 'link';
    to?: string;
  }[];
};

const sidebarGroups: SidebarGroup[] = [
  {
    groupLabel: '班级与学生',
    items: [
      { key: 'classManagement', label: '班级管理', icon: 'ri-building-4-line', type: 'tab' },
    ],
  },
  {
    groupLabel: '课程建设',
    items: [
      { key: 'courseSettings', label: '课程设置', icon: 'ri-book-open-line', type: 'tab' },
    ],
  },
  {
    groupLabel: '教学监控',
    items: [
      { key: 'monitor', label: '全局项目监控', icon: 'ri-radar-line', type: 'tab' },
      // { key: 'analysis', label: '评价智能体分析', icon: 'ri-brain-line', type: 'tab' },
      { key: 'guidance', label: '动态引导工具', icon: 'ri-compass-3-line', type: 'tab' },
      // { key: 'evaluation', label: '教学评价', icon: 'ri-star-line', type: 'tab' },
    ],
  },
  {
    groupLabel: '任务与审核',
    items: [
      { key: 'teamReview', label: '组队管理', icon: 'ri-team-line', type: 'tab' },
      { key: 'topicReview', label: '选题审核', icon: 'ri-file-search-line', type: 'tab' },
      { key: 'businessPlanReview', label: '商业计划书审核', icon: 'ri-file-chart-line', type: 'tab' },
    ],
  },
  {
    groupLabel: '指南',//指南与设置
    items: [
      // { key: 'classProjectOverview', label: '班级项目总览', icon: 'ri-layout-grid-line', type: 'tab' },
      { key: 'teacherGuide', label: '教学指南', icon: 'ri-book-open-line', type: 'tab' },
      // { key: 'courseSettings', label: '课程设置', icon: 'ri-settings-3-line', type: 'tab' },
    ],
  },
];

// flat list for lookup
const sidebarItems = sidebarGroups.flatMap((g) => g.items);

const TEACHER_TAB_PARAM = 'tab';
const TEACHER_CLASS_PARAM = 'classId';
const TEACHER_SUB_PARAM = 'sub';

const CLASS_CONTEXT_TABS: TabKey[] = ['guidance', 'teamReview', 'studentManagement'];

function earliestClass(list: TeacherPersonalClassRow[]): TeacherPersonalClassRow | null {
  if (!list.length) return null;
  return [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
}

const ALL_TAB_KEYS: TabKey[] = [
  'monitor',
  'analysis',
  'guidance',
  'evaluation',
  'classManagement',
  'studentManagement',
  'teamReview',
  'topicReview',
  'businessPlanReview',
  'classProjectOverview',
  'teacherGuide',
  'courseSettings',
];

function isTabKey(v: string): v is TabKey {
  return (ALL_TAB_KEYS as string[]).includes(v);
}

function tabFromSearchParams(sp: URLSearchParams): TabKey {
  const raw = sp.get(TEACHER_TAB_PARAM);
  if (raw && isTabKey(raw)) return raw;
  return 'monitor';
}

export default function TeacherDashboard() {
  const { logoUrl, siteTitle } = useSiteBrand();
  const brandTitle = siteTitle.trim() || '教师工作台';
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = tabFromSearchParams(searchParams);
  const teamReviewSubPage: 'main' | 'questions' =
    searchParams.get(TEACHER_SUB_PARAM) === 'questions' ? 'questions' : 'main';

  const setTeacherTab = (
    tab: TabKey,
    opts?: { classId?: string | null; sub?: 'main' | 'questions' | null }
  ) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (tab === 'monitor') {
          next.delete(TEACHER_TAB_PARAM);
          next.delete(TEACHER_CLASS_PARAM);
          next.delete(TEACHER_SUB_PARAM);
        } else {
          next.set(TEACHER_TAB_PARAM, tab);
        }
        const needsClass = (CLASS_CONTEXT_TABS as string[]).includes(tab);
        if (opts && 'classId' in opts) {
          if (opts.classId && needsClass) next.set(TEACHER_CLASS_PARAM, opts.classId);
          else if (!opts.classId) next.delete(TEACHER_CLASS_PARAM);
        } else if (!needsClass) {
          next.delete(TEACHER_CLASS_PARAM);
        }
        if (opts && 'sub' in opts) {
          if (opts.sub === 'questions' && tab === 'teamReview') next.set(TEACHER_SUB_PARAM, 'questions');
          else next.delete(TEACHER_SUB_PARAM);
        } else if (tab !== 'teamReview') {
          next.delete(TEACHER_SUB_PARAM);
        }
        return next;
      },
      { replace: true }
    );
  };
  const [selectedTeam, setSelectedTeam] = useState<TeamProject | null>(null);
  const [guidancePresetTeamId, setGuidancePresetTeamId] = useState<number | null>(null);
  const [showBatchScoring, setShowBatchScoring] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'on-track' | 'at-risk' | 'delayed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [teacherProfile, setTeacherProfile] = useState<TeacherProfile | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileEmailDraft, setProfileEmailDraft] = useState('');
  const [profileEmailCode, setProfileEmailCode] = useState('');
  const [profileEmailSending, setProfileEmailSending] = useState(false);
  const [profileOldPwd, setProfileOldPwd] = useState('');
  const [profileNewPwd, setProfileNewPwd] = useState('');
  const [personalClasses, setPersonalClasses] = useState<TeacherPersonalClassRow[]>([]);
  const [selectedPersonalClass, setSelectedPersonalClass] = useState<TeacherPersonalClassRow | null>(null);
  const [monitorTeams, setMonitorTeams] = useState<TeamProject[]>([]);
  const [monitorTeamsLoading, setMonitorTeamsLoading] = useState(false);
  const [teamQuestionsSavedTick, setTeamQuestionsSavedTick] = useState(0);
  const [teamQuestionsDirty, setTeamQuestionsDirty] = useState(false);
  const [econoverseAdminModalOpen, setEconoverseAdminModalOpen] = useState(false);
  const [econoverseAdminJumpLoading, setEconoverseAdminJumpLoading] = useState(false);
  const { labelByValue: semesterLabel } = usePublicDictOptions('semester', true);

  const leaveTeamQuestionsPreset = () => {
    setTeamQuestionsDirty(false);
    setTeacherTab('teamReview', { sub: 'main' });
  };

  const backFromClassStudents = () => {
    setTeacherTab('classManagement', { classId: null, sub: null });
  };

  const backFromTeamReview = () => {
    if (teamReviewSubPage === 'questions') {
      if (teamQuestionsDirty) {
        confirmLeaveTeamQuestionsUnsaved(leaveTeamQuestionsPreset);
        return;
      }
      leaveTeamQuestionsPreset();
    }
  };

  const syncClassToUrl = useCallback((cls: TeacherPersonalClassRow | null) => {
    if (!cls) return;
    if (!(CLASS_CONTEXT_TABS as string[]).includes(activeTab)) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set(TEACHER_CLASS_PARAM, cls.id);
        return next;
      },
      { replace: true }
    );
  }, [activeTab, setSearchParams]);

  const onHeaderClassChange = (classId: string) => {
    const cls = personalClasses.find((c) => c.id === classId);
    if (!cls) return;
    setSelectedPersonalClass(cls);
    syncClassToUrl(cls);
  };

  const openGuidanceForTeam = (team: TeamProject) => {
    setSelectedTeam(null);
    setGuidancePresetTeamId(team.id);
    setTeacherTab('guidance', { classId: selectedPersonalClass?.id ?? null });
  };

  const refreshPersonalClasses = useCallback(
    async (preferredClassId?: string | null) => {
      const list = await listTeacherPersonalClasses();
      setPersonalClasses(list);
      const fromUrl = searchParams.get(TEACHER_CLASS_PARAM);
      const pick =
        (preferredClassId ? list.find((c) => c.id === preferredClassId) : null) ??
        (selectedPersonalClass?.id ? list.find((c) => c.id === selectedPersonalClass.id) : null) ??
        (fromUrl ? list.find((c) => c.id === fromUrl) : null) ??
        earliestClass(list);
      setSelectedPersonalClass(pick ?? null);
      if (preferredClassId && pick) syncClassToUrl(pick);
      return pick ?? null;
    },
    [searchParams, selectedPersonalClass?.id, syncClassToUrl]
  );

  const { teacherDisplayName, teacherAvatarChar } = useMemo(() => {
    const token = getPortalToken('teacher');
    const p = token ? parseJwtPayload(token) : null;
    const username = (p?.username && String(p.username).trim()) || '';
    const real = (teacherProfile?.realName && String(teacherProfile.realName).trim()) || '';
    const displayName = real || username || '教师';
    const first = [...displayName][0] || '师';
    return { teacherDisplayName: displayName, teacherAvatarChar: first };
  }, [teacherProfile]);

  useEffect(() => {
    getTeacherProfile()
      .then((p) => {
        setTeacherProfile(p);
        setProfileEmailDraft(p.email || '');
      })
      .catch(() => {
        /* 侧栏仍可用 JWT 中的 username 兜底 */
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    refreshPersonalClasses()
      .then(() => {
        if (cancelled) return;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const classId = searchParams.get(TEACHER_CLASS_PARAM);
    if (!classId || selectedPersonalClass?.id === classId) return;
    const cls = personalClasses.find((c) => c.id === classId);
    if (cls) setSelectedPersonalClass(cls);
  }, [searchParams, personalClasses, selectedPersonalClass?.id]);

  useEffect(() => {
    if (activeTab === 'studentManagement' && !selectedPersonalClass) {
      setTeacherTab('classManagement', { classId: null, sub: null });
    }
  }, [activeTab, selectedPersonalClass]);

  const loadMonitorTeams = useCallback(async (classId: string) => {
    setMonitorTeamsLoading(true);
    try {
      const teams = await fetchTeacherMonitorTeams(classId);
      setMonitorTeams(teams as unknown as TeamProject[]);
    } catch {
      setMonitorTeams([]);
    } finally {
      setMonitorTeamsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab !== 'monitor' && activeTab !== 'guidance') return;
    if (!selectedPersonalClass?.id) {
      setMonitorTeams([]);
      return;
    }
    void loadMonitorTeams(selectedPersonalClass.id);
  }, [activeTab, selectedPersonalClass?.id, loadMonitorTeams]);

  const filteredTeams = monitorTeams.filter((t) => {
    const matchStatus = filterStatus === 'all' || t.status === filterStatus;
    const matchSearch = t.teamName.includes(searchQuery) || t.leader.includes(searchQuery);
    return matchStatus && matchSearch;
  });

  const handleSidebarClick = (item: typeof sidebarItems[number]) => {
    if (item.type === 'link' && item.to) {
      navigate(item.to);
      return;
    }
    const key = item.key as TabKey;
    const classId = (CLASS_CONTEXT_TABS as string[]).includes(key)
      ? selectedPersonalClass?.id ?? null
      : null;
    setTeacherTab(key, { classId, sub: null });
  };

  /** 创世纪管理后台：先确认当前个性化班，再签发 hop 跳转 */
  const confirmOpenEconoverseAdmin = async () => {
    if (!selectedPersonalClass?.id) return;
    setEconoverseAdminJumpLoading(true);
    try {
      await openEconoverseAdmin(selectedPersonalClass.id);
    } finally {
      setEconoverseAdminJumpLoading(false);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'monitor':
        return (
          <div className="flex gap-6 h-full">
            {/* 左侧团队卡片区 */}
            <div className="flex-1 min-w-0 flex flex-col gap-4">
              {/* 搜索 + 筛选 */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-48">
                  <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                  <input
                    type="text"
                    placeholder="搜索团队或队长..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-teal-300"
                  />
                </div>
                <div className="flex items-center gap-2">
                  {(['all', 'on-track', 'at-risk', 'delayed'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setFilterStatus(s)}
                      className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors whitespace-nowrap cursor-pointer ${
                        filterStatus === s
                          ? 'bg-teal-500 text-white'
                          : 'bg-white border border-gray-200 text-gray-600 hover:border-teal-300'
                      }`}
                    >
                      {s === 'all' ? '全部' : s === 'on-track' ? '正常' : s === 'at-risk' ? '预警' : '滞后'}
                    </button>
                  ))}
                </div>
                {/* <button
                  onClick={() => setShowBatchScoring(true)}
                  className="px-4 py-2 bg-teal-500 text-white text-xs font-medium rounded-xl hover:bg-teal-600 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5"
                >
                  <i className="ri-edit-2-line"></i>
                  批量评分
                </button> */}
              </div>

              {/* 团队卡片网格 */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 overflow-y-auto pb-4">
                {filteredTeams.length > 0 ? (
                  filteredTeams.map((team) => (
                    <TeamCard
                      key={team.id}
                      team={team}
                      onViewDetail={setSelectedTeam}
                      onIntervene={openGuidanceForTeam}
                    />
                  ))
                ) : (
                  <div className="col-span-2 flex flex-col items-center justify-center py-20 text-gray-400">
                    <i className="ri-search-line text-4xl mb-3"></i>
                    <p className="text-sm">未找到匹配的团队</p>
                  </div>
                )}
              </div>
            </div>

            {/* 右侧统计面板 */}
            <div className="w-72 flex-shrink-0 overflow-y-auto pb-4">
              <StatsPanel classId={selectedPersonalClass?.id || ''} teams={monitorTeams} />
            </div>
          </div>
        );

      case 'analysis':
        return (
          <div className="space-y-6">
            <LearningAnalysisPanel />
            <StudentAnalysisBoard />
          </div>
        );

      case 'guidance':
        if (!selectedPersonalClass) {
          return (
            <div className="bg-white rounded-xl border border-dashed border-gray-200 py-16 text-center text-gray-500 text-sm">
              请先在右上角选择班级
            </div>
          );
        }
        return (
          <GuidanceToolPanel
            personalClass={selectedPersonalClass}
            teams={monitorTeams}
            presetTeamId={guidancePresetTeamId}
            onPresetTeamApplied={() => setGuidancePresetTeamId(null)}
          />
        );

      case 'classManagement':
        return (
          <ClassManagement
            onOpenClassStudents={(cls) => {
              setSelectedPersonalClass(cls);
              setTeacherTab('studentManagement', { classId: cls.id, sub: null });
            }}
            onClassesChanged={() => {
              void refreshPersonalClasses();
            }}
          />
        );

      case 'studentManagement':
        if (!selectedPersonalClass) {
          return null;
        }
        return (
          <StudentManagement
            personalClass={selectedPersonalClass}
            onBack={backFromClassStudents}
          />
        );


      case 'teamReview':
        if (!selectedPersonalClass) {
          return (
            <div className="bg-white rounded-xl border border-dashed border-gray-200 py-16 text-center text-gray-500 text-sm">
              请先在右上角选择班级
            </div>
          );
        }
        if (teamReviewSubPage === 'questions') {
          return (
            <TeamQuestionsPresetPage
              classId={selectedPersonalClass.id}
              className={selectedPersonalClass.name}
              onBack={leaveTeamQuestionsPreset}
              onDirtyChange={setTeamQuestionsDirty}
              onSaved={() => setTeamQuestionsSavedTick((n) => n + 1)}
            />
          );
        }
        return (
          <TeamReview
            personalClass={selectedPersonalClass}
            onOpenQuestionsPreset={() => setTeacherTab('teamReview', { sub: 'questions' })}
            questionsSavedTick={teamQuestionsSavedTick}
          />
        );

      case 'topicReview':
        if (!selectedPersonalClass) {
          return (
            <div className="bg-white rounded-xl border border-dashed border-gray-200 py-16 text-center text-gray-500 text-sm">
              请先在右上角选择班级
            </div>
          );
        }
        return <TopicReview personalClass={selectedPersonalClass} />;

      case 'businessPlanReview':
        if (!selectedPersonalClass) {
          return (
            <div className="bg-white rounded-xl border border-dashed border-gray-200 py-16 text-center text-gray-500 text-sm">
              请先在右上角选择班级
            </div>
          );
        }
        return <BusinessPlanReview personalClass={selectedPersonalClass} />;

      case 'classProjectOverview':
        return <ClassProjectOverview />;

      case 'teacherGuide':
        return <TeacherGuide />;

      case 'courseSettings':
        return <CourseSettings embedded={true} personalClass={selectedPersonalClass} />;

      case 'evaluation':
        return <EvaluationPanel />;

      default:
        return null;
    }
  };

  const sidebarHighlightKey = activeTab === 'studentManagement' ? 'classManagement' : activeTab;
  const activeItem = sidebarItems.find(
    (item) => item.type === 'tab' && item.key === sidebarHighlightKey
  );
  const groupLabelsWithClass = new Set(['课程建设', '教学监控', '任务与审核']);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* 左侧侧边栏 */}
      <aside className="w-56 flex-shrink-0 bg-white border-r border-gray-100 flex flex-col shadow-sm">
        {/* Logo 区域 */}
        <div className="px-5 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="w-8 h-8 object-contain rounded-lg flex-shrink-0 border border-gray-100 bg-white" />
            ) : (
              <div className="w-8 h-8 flex items-center justify-center bg-gradient-to-br from-teal-500 to-cyan-500 rounded-lg">
                <i className="ri-graduation-cap-line text-white text-sm"></i>
              </div>
            )}
            <div>
              <div className="text-sm font-bold text-gray-900">{brandTitle}</div>
              <div className="text-xs text-gray-400">创业教育平台</div>
            </div>
          </div>
        </div>

        {/* 菜单列表 */}
        <nav className="flex-1 overflow-y-auto py-3 px-3">
          <div className="space-y-4">
            {sidebarGroups.map((group) => (
              <div key={group.groupLabel}>
                {group.groupLabel && (
                  <div className="px-3 mb-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      {group.groupLabel}
                      {selectedPersonalClass && groupLabelsWithClass.has(group.groupLabel) && (
                        <span className="ml-1">| {selectedPersonalClass.name}</span>
                      )}
                    </span>
                  </div>
                )}
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = item.type === 'tab' && item.key === sidebarHighlightKey;
                    return (
                      <button
                        key={item.key}
                        onClick={() => handleSidebarClick(item)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all cursor-pointer whitespace-nowrap ${
                          isActive
                            ? 'bg-teal-50 text-teal-700 font-semibold'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                      >
                        <div className={`w-5 h-5 flex items-center justify-center flex-shrink-0 ${isActive ? 'text-teal-600' : 'text-gray-400'}`}>
                          <i className={`${item.icon} text-base`}></i>
                        </div>
                        <span className="truncate">{item.label}</span>
                        {item.type === 'link' && (
                          <i className="ri-external-link-line text-xs text-gray-300 ml-auto flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>

        {/* 底部用户信息 */}
        <div className="px-4 py-4 border-t border-gray-100">
          <div className="flex items-center gap-2.5">
            <button type="button" onClick={() => setProfileModalOpen(true)} className="flex-shrink-0 cursor-pointer" title="个人中心">
              <UserAvatar name={teacherDisplayName} avatarUrl={teacherProfile?.avatarUrl} size="sm" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-gray-800 truncate">{teacherDisplayName}</div>
            </div>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 cursor-pointer flex-shrink-0 transition-colors"
              title="退出登录"
            >
              <i className="ri-logout-box-r-line text-sm"></i>
            </button>
          </div>
        </div>
      </aside>

      {/* 右侧主内容区 */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* 顶部 Header */}
        <header className="bg-white border-b border-gray-100 shadow-sm flex-shrink-0 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {activeTab === 'studentManagement' && selectedPersonalClass && (
              <button
                type="button"
                onClick={backFromClassStudents}
                className="flex items-center gap-1 px-2 py-1 text-sm text-teal-600 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap flex-shrink-0"
              >
                <i className="ri-arrow-left-line" />
                返回班级管理
              </button>
            )}
            {activeTab === 'teamReview' && teamReviewSubPage === 'questions' && selectedPersonalClass && (
              <button
                type="button"
                onClick={backFromTeamReview}
                className="flex items-center gap-1 px-2 py-1 text-sm text-teal-600 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap flex-shrink-0"
              >
                <i className="ri-arrow-left-line" />
                返回组队管理
              </button>
            )}
            <div className="min-w-0">
            <h1 className="text-base font-bold text-gray-900 truncate">
              {activeTab === 'studentManagement' && selectedPersonalClass
                ? `学生管理 — ${selectedPersonalClass.name}`
                : activeTab === 'teamReview' && selectedPersonalClass
                  ? teamReviewSubPage === 'questions'
                    ? `组队问题预设 — ${selectedPersonalClass.name}`
                    : `组队管理 — ${selectedPersonalClass.name}`
                  : (activeItem?.label ?? '教师工作台')}
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {activeTab === 'monitor' && `共 ${monitorTeams.length} 个团队 · ${monitorTeams.filter(t => t.status !== 'on-track').length} 个需关注`}
              {activeTab === 'analysis' && '智能分析学生学习数据'}
              {activeTab === 'guidance' && selectedPersonalClass && '发送引导与管理实训任务'}
              {activeTab === 'guidance' && !selectedPersonalClass && '动态引导工具'}
              {activeTab === 'classManagement' && '管理班级信息与学生导入'}
              {activeTab === 'studentManagement' && selectedPersonalClass && `班级「${selectedPersonalClass.name}」学生名册`}

              {activeTab === 'teamReview' &&
                (selectedPersonalClass
                  ? teamReviewSubPage === 'questions'
                    ? `维护班级「${selectedPersonalClass.name}」组队测评题目（3～10 道）`
                    : `班级「${selectedPersonalClass.name}」组队管理`
                  : '组队管理')}
              {activeTab === 'topicReview' && '审核学生选题方案'}
              {activeTab === 'businessPlanReview' && '审核商业计划书提交'}
              {activeTab === 'classProjectOverview' && '多维度查看全班项目进度'}
              {activeTab === 'teacherGuide' && '掌握监控、分析、引导、评价的完整教学流程'}
              {activeTab === 'courseSettings' && '配置实训任务截止时间与评分标准'}
              {activeTab === 'evaluation' && '双维评价体系 · 项目完成 + 迭代增值'}
            </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {personalClasses.length > 0 && (
              <Dropdown
                menu={{
                  items: personalClasses.map((c) => ({ key: c.id, label: c.name })),
                  selectedKeys: selectedPersonalClass?.id ? [selectedPersonalClass.id] : [],
                  onClick: ({ key }) => onHeaderClassChange(String(key)),
                }}
                trigger={['click']}
                disabled={personalClasses.length <= 1}
              >
                <button
                  type="button"
                  className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium border rounded-lg whitespace-nowrap transition-colors ${
                    personalClasses.length > 1
                      ? 'text-teal-700 bg-teal-50 border-teal-200 hover:bg-teal-100 cursor-pointer'
                      : 'text-gray-700 bg-gray-50 border-gray-200 cursor-default'
                  }`}
                >
                  <i className="ri-building-4-line text-teal-600" />
                  <span className="max-w-[180px] truncate">
                    {selectedPersonalClass?.name ?? '选择班级'}
                  </span>
                  {personalClasses.length > 1 && <i className="ri-arrow-down-s-line" />}
                </button>
              </Dropdown>
            )}
            {selectedPersonalClass && (
              <button
                type="button"
                onClick={() => setEconoverseAdminModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors cursor-pointer whitespace-nowrap"
                title="配置本班创世纪地图与实训节奏"
              >
                <i className="ri-building-2-line" />
                创世纪配置
              </button>
            )}
            {/* <button className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer relative">
              <i className="ri-notification-3-line text-base"></i>
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button> */}
            <button
              type="button"
              onClick={() => setProfileModalOpen(true)}
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              title="个人中心"
            >
              <i className="ri-user-3-line text-base"></i>
            </button>
          </div>
        </header>

        <Modal
          title="进入创世纪 · 地图配置"
          open={econoverseAdminModalOpen}
          onCancel={() => !econoverseAdminJumpLoading && setEconoverseAdminModalOpen(false)}
          onOk={() => void confirmOpenEconoverseAdmin()}
          okText="确认进入"
          cancelText="取消"
          confirmLoading={econoverseAdminJumpLoading}
          destroyOnClose
          width={480}
        >
          {selectedPersonalClass ? (
            <div className="flex flex-col gap-4 text-sm text-gray-700">
              <p className="leading-relaxed m-0">
                创世纪游戏的<strong className="font-semibold text-gray-900">地图与实训节奏</strong>
                与您创建的<strong className="font-semibold text-gray-900">个性化班级</strong>
                一一绑定。在本后台发布的内容，仅对下方班级生效；学生需在该班内进入创世纪才会加载对应配置。
              </p>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4">
                <div className="text-xs font-medium text-emerald-800 mb-2">当前选择的班级</div>
                <div className="text-base font-bold text-gray-900">{selectedPersonalClass.name}</div>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
                  <dt className="text-gray-500">学生人数</dt>
                  <dd className="m-0 font-medium text-gray-800">{selectedPersonalClass.studentCount ?? 0} 人</dd>
                </dl>
              </div>
              <p className="text-xs text-gray-500 m-0">
                若需配置其他班级，请先在页头切换班级后再点击「创世纪配置」。
              </p>
            </div>
          ) : null}
        </Modal>

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
                  <UserAvatar name={teacherDisplayName} avatarUrl={teacherProfile?.avatarUrl} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="text-base font-bold text-gray-900 truncate">{teacherProfile?.realName || teacherDisplayName}</div>
                    <div className="text-sm text-gray-500 mt-0.5">{teacherProfile?.collegeName ? `学院：${teacherProfile.collegeName}` : '学院：'}</div>
                  </div>
                </div>
                <Upload
                  showUploadList={false}
                  beforeUpload={async (file) => {
                    try {
                      const r = await uploadTeacherAvatar(file as File);
                      const p = await getTeacherProfile();
                      setTeacherProfile({ ...p, avatarUrl: r.avatarUrl || p.avatarUrl });
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

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-gray-900 mb-3">邮箱</div>
              <div className="space-y-3">
                <Input value={profileEmailDraft} onChange={(e) => setProfileEmailDraft(e.target.value)} placeholder="修改邮箱" />
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    className="min-w-0 flex-1"
                    value={profileEmailCode}
                    onChange={(e) => setProfileEmailCode(e.target.value)}
                    placeholder="邮箱验证码"
                  />
                  <Button
                    className="w-full sm:w-auto sm:flex-shrink-0"
                    loading={profileEmailSending}
                    onClick={async () => {
                      setProfileEmailSending(true);
                      try {
                        await sendTeacherEmailCode(profileEmailDraft);
                        antdMessage.success('验证码已发送');
                      } catch (e: any) {
                        antdMessage.error(e?.message || '发送失败');
                      } finally {
                        setProfileEmailSending(false);
                      }
                    }}
                  >
                    获取验证码
                  </Button>
                </div>
                <div className="flex justify-end">
                  <Button
                    type="primary"
                    size="small"
                    className="!bg-teal-500 !border-teal-500 hover:!bg-teal-600"
                    loading={profileSaving}
                    onClick={async () => {
                      setProfileSaving(true);
                      try {
                        await updateTeacherProfile({ email: profileEmailDraft, code: profileEmailCode });
                        const p = await getTeacherProfile();
                        setTeacherProfile(p);
                        antdMessage.success('已保存');
                      } catch (e: any) {
                        antdMessage.error(e?.message || '保存失败');
                      } finally {
                        setProfileSaving(false);
                      }
                    }}
                  >
                    保存邮箱
                  </Button>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-gray-900 mb-3">修改密码</div>
              <div className="space-y-3">
                <Input.Password value={profileOldPwd} onChange={(e) => setProfileOldPwd(e.target.value)} placeholder="旧密码" />
                <Input.Password value={profileNewPwd} onChange={(e) => setProfileNewPwd(e.target.value)} placeholder="新密码（至少6位）" />
                <div className="flex justify-end">
                  <Button
                    type="primary"
                    size="small"
                    className="!bg-teal-500 !border-teal-500 hover:!bg-teal-600"
                    loading={profileSaving}
                    onClick={async () => {
                      setProfileSaving(true);
                      try {
                        await updateTeacherProfile({ oldPassword: profileOldPwd, newPassword: profileNewPwd });
                        setProfileOldPwd('');
                        setProfileNewPwd('');
                        antdMessage.success('密码已更新');
                      } catch (e: any) {
                        antdMessage.error(e?.message || '保存失败');
                      } finally {
                        setProfileSaving(false);
                      }
                    }}
                  >
                    保存密码
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Drawer>

        {/* 主内容 */}
        <main className="flex-1 overflow-y-auto py-6 px-6">
          {renderContent()}
        </main>
      </div>

      {/* 弹窗 */}
      {selectedTeam && (
        <TeamDetailModal
          classId={selectedPersonalClass?.id || ''}
          team={selectedTeam}
          onClose={() => setSelectedTeam(null)}
          onIntervene={openGuidanceForTeam}
        />
      )}
      {showBatchScoring && (
        <BatchScoringModal
          classId={selectedPersonalClass?.id || ''}
          teams={monitorTeams}
          onClose={() => setShowBatchScoring(false)}
          onSubmitted={() => {
            if (selectedPersonalClass?.id) void loadMonitorTeams(selectedPersonalClass.id);
          }}
        />
      )}

      {/* 退出登录确认弹窗 */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-12 h-12 flex items-center justify-center bg-red-50 rounded-full flex-shrink-0">
                  <i className="ri-logout-box-r-line text-2xl text-red-500"></i>
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">确认退出登录</h3>
                  <p className="text-sm text-gray-500 mt-0.5">退出后将返回登录页面</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    setShowLogoutConfirm(false);
                    clearPortalToken('teacher');
                    navigate('/');
                  }}
                  className="flex-1 py-2.5 bg-red-500 text-white text-sm font-medium rounded-xl hover:bg-red-600 transition-colors cursor-pointer whitespace-nowrap"
                >
                  确认退出
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
