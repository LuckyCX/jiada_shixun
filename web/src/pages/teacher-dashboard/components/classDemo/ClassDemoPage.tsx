import { useEffect, useMemo, useState } from 'react';
import { COURSE_SETTING_STAGES, fetchCourseSettings, type CourseSettingStageKey } from '../../../../lib/courseSettingsApi';
import { DemoOverview, DemoPracticeCourse, stageDone } from './DemoLearning';
import TeamFormationModule from './mirror/TeamFormationModule';
import IdeationModule from './mirror/IdeationModule';
import MarketResearchModule from './mirror/MarketResearchModule';
import ProductDesignModule from './mirror/ProductDesignModule';
import BusinessModelModule from './mirror/BusinessModelModule';
import RoleSimulationModule from './mirror/RoleSimulationModule';
import BusinessPlanModule from './mirror/BusinessPlanModule';
import TopicReview from './topicReview';
import BusinessPlanReview from './planReview';
import BusinessPlanDetailPage from './planReview/DetailPage';
import BmcReview from '../bmcReview';
import { fetchTeacherBmcReviews, reviewTeacherBmc } from './demoBusinessApi';
import { loadDemoState, type DemoStageKey } from './demoStore';

function formatModuleTime(
  startDate?: string,
  deadlineDate?: string,
  index?: number
): string {
  if (startDate && deadlineDate) return `${startDate}～${deadlineDate}`;
  if (startDate) return `开始 ${startDate}`;
  if (deadlineDate) return `截止 ${deadlineDate}`;
  if (typeof index === 'number') return `第 ${index + 1} 环节 · 备课不限时`;
  return '备课不限时';
}

export default function ClassDemoPage({
  classId,
  className,
  enabledModuleKeys,
  stage,
  onStageChange,
  /** 教师顶栏进学生端备课：展示审核区说明与模块完成态 */
  prepMode = false,
}: {
  classId: string;
  className: string;
  enabledModuleKeys: CourseSettingStageKey[];
  stage: string;
  onStageChange: (stage: DemoStageKey) => void;
  prepMode?: boolean;
}) {
  // 实训模块侧栏与课程设置一致：略过模块不展示
  const stages = useMemo(
    () => COURSE_SETTING_STAGES.filter((s) => enabledModuleKeys.includes(s.key)),
    [enabledModuleKeys]
  );
  const learningMenus: { key: DemoStageKey; label: string; icon: string }[] = [
    { key: 'overview', label: '进度看板', icon: 'ri-dashboard-line' },
    { key: 'knowledge', label: '实践课程', icon: 'ri-book-2-line' },
  ];
  const showTopicReview = stages.some((item) => item.key === 'ideation');
  const showBmcReview = stages.some((item) => item.key === 'business');
  const showPlanReview = stages.some((item) => item.key === 'plan');
  // 审核菜单顺序：选题 → 画布 → 计划书（画布在计划书前）
  const reviewMenus: { key: DemoStageKey; label: string; icon: string }[] = [
    ...(showTopicReview ? [{ key: 'topicReview' as const, label: '选题审核', icon: 'ri-checkbox-circle-line' }] : []),
    ...(showBmcReview ? [{ key: 'bmcReview' as const, label: '商业画布审核', icon: 'ri-layout-grid-line' }] : []),
    ...(showPlanReview ? [{ key: 'planReview' as const, label: '商业计划书审核', icon: 'ri-file-edit-line' }] : []),
  ];
  const activeKey = (stage !== 'archive' && (learningMenus.some((item) => item.key === stage) || stages.some((item) => item.key === stage) || reviewMenus.some((item) => item.key === stage))
    ? stage
    : 'overview') as DemoStageKey;
  const [planDetailId, setPlanDetailId] = useState<string | null>(null);
  /** 进入过创新模块后保活，避免侧栏切走卸载导致对话丢失 */
  const [keepIdeation, setKeepIdeation] = useState(false);
  const [demoTick, setDemoTick] = useState(0);
  const [moduleDates, setModuleDates] = useState<Record<string, { startDate?: string; deadlineDate?: string }>>({});

  // 侧栏完成态随本地演示数据变化刷新
  useEffect(() => {
    setDemoTick((n) => n + 1);
  }, [classId, activeKey]);

  useEffect(() => {
    if (!classId || !/^\d+$/.test(classId)) {
      setModuleDates({});
      return;
    }
    let cancelled = false;
    void fetchCourseSettings(classId)
      .then((payload) => {
        if (cancelled) return;
        const map: Record<string, { startDate?: string; deadlineDate?: string }> = {};
        for (const s of payload?.settings || []) {
          map[s.moduleKey] = {
            startDate: s.startDate || undefined,
            deadlineDate: s.deadlineDate || undefined,
          };
        }
        setModuleDates(map);
      })
      .catch(() => {
        if (!cancelled) setModuleDates({});
      });
    return () => {
      cancelled = true;
    };
  }, [classId]);

  const doneByKey = useMemo(() => {
    const state = loadDemoState(classId);
    const map: Record<string, boolean> = {};
    for (const s of stages) {
      map[s.key] = stageDone(state, s.key);
    }
    return map;
    // demoTick 强制在切页后重读 localStorage
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, stages, demoTick]);

  useEffect(() => {
    if (stage === 'archive') onStageChange('overview');
  }, [stage, onStageChange]);

  // 指向已略过模块或不可用审核入口时回退 overview
  useEffect(() => {
    if (!stage || stage === 'archive' || stage === 'overview' || stage === 'knowledge') return;
    if (stage === 'topicReview' && !showTopicReview) {
      onStageChange('overview');
      return;
    }
    if (stage === 'bmcReview' && !showBmcReview) {
      onStageChange('overview');
      return;
    }
    if (stage === 'planReview' && !showPlanReview) {
      onStageChange('overview');
      return;
    }
    const isCourseStage = COURSE_SETTING_STAGES.some((s) => s.key === stage);
    if (isCourseStage && !enabledModuleKeys.includes(stage as CourseSettingStageKey)) {
      onStageChange('overview');
    }
  }, [stage, enabledModuleKeys, showTopicReview, showBmcReview, showPlanReview, onStageChange]);

  useEffect(() => {
    setPlanDetailId(null);
  }, [classId]);

  useEffect(() => {
    setPlanDetailId(null);
  }, [activeKey]);

  useEffect(() => {
    if (activeKey === 'ideation') setKeepIdeation(true);
  }, [activeKey]);

  useEffect(() => {
    setKeepIdeation(false);
  }, [classId]);

  return (
    <div className="flex gap-4 min-h-[70vh]">
      <aside className="w-56 flex-shrink-0 bg-white rounded-2xl border border-gray-100 p-3">
        <div className="px-2 py-2 text-xs font-semibold text-gray-400">学习管理</div>
        {learningMenus.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onStageChange(item.key)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm cursor-pointer ${activeKey === item.key ? 'bg-teal-500 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <i className={item.icon} />
            {item.label}
          </button>
        ))}
        <div className="px-2 py-2 mt-3 text-xs font-semibold text-gray-400">实训模块</div>
        {stages.map((item, index) => {
          const done = Boolean(doneByKey[item.key]);
          const dates = moduleDates[item.key];
          const timeLabel = formatModuleTime(dates?.startDate, dates?.deadlineDate, index);
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onStageChange(item.key)}
              className={`w-full flex items-start gap-2 px-3 py-2 rounded-xl text-sm cursor-pointer text-left ${activeKey === item.key ? 'bg-teal-500 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <span className="w-4 text-xs mt-0.5 shrink-0">{index + 1}</span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-1 font-medium">
                  <span className="truncate">{item.shortName}</span>
                  {done ? (
                    <span className={`shrink-0 text-xs ${activeKey === item.key ? 'text-white' : 'text-emerald-600'}`} title="已完成">
                      ✅
                    </span>
                  ) : null}
                </span>
                <span className={`block text-[10px] mt-0.5 leading-snug ${activeKey === item.key ? 'text-white/80' : 'text-gray-400'}`}>
                  {timeLabel}
                </span>
              </span>
            </button>
          );
        })}
        {reviewMenus.length ? (
          <div className="px-2 py-2 mt-3">
            <div className="text-xs font-semibold text-gray-400">任务与审核</div>
            {prepMode ? (
              <p className="mt-1 text-[10px] leading-relaxed text-amber-700/90">
                方便老师备课审核自己提交的数据；正式学生端不展示此菜单。
              </p>
            ) : null}
          </div>
        ) : null}
        {reviewMenus.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onStageChange(item.key)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm cursor-pointer ${activeKey === item.key ? 'bg-teal-500 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <i className={item.icon} />
            {item.label}
          </button>
        ))}
      </aside>
      <div className="flex-1 min-w-0 space-y-4">
        {/* 与学生中心一致：模块自带卡片；对话/董事会忌再套一层大 padding 白底 */}
        <div
          className={
            activeKey === 'ideation' || activeKey === 'business'
              ? 'min-w-0'
              : 'bg-white rounded-2xl border border-gray-100 shadow-sm p-4 md:p-5'
          }
        >
          {activeKey === 'overview' ? (
            <DemoOverview classId={classId} className={className} enabledModuleKeys={enabledModuleKeys} onOpenStage={onStageChange} />
          ) : null}
          {activeKey === 'knowledge' ? <DemoPracticeCourse classId={classId} enabledModuleKeys={enabledModuleKeys} /> : null}
          {activeKey === 'team' ? (
            <TeamFormationModule classId={classId} className={className} />
          ) : null}
          {keepIdeation ? (
            <div className={activeKey === 'ideation' ? undefined : 'hidden'} aria-hidden={activeKey !== 'ideation'}>
              <IdeationModule
                key={classId}
                classId={classId}
                isTeamLeader
                chatFrameHeightClass={prepMode ? 'h-[calc(100dvh-14rem)]' : 'h-[calc(100dvh-11rem)]'}
              />
            </div>
          ) : null}
          {activeKey === 'market' ? (
            <MarketResearchModule
              classId={classId}
              isTeamLeader
              hasConfirmedTeam
              teamMembers={[{ id: 'demo-student', name: '演示学员' }]}
            />
          ) : null}
          {activeKey === 'product' ? <ProductDesignModule classId={classId} isTeamLeader /> : null}
          {activeKey === 'business' ? <BusinessModelModule classId={classId} isTeamLeader studentDisplayName="演示学员" /> : null}
          {activeKey === 'simulation' ? <RoleSimulationModule classId={classId} /> : null}
          {activeKey === 'plan' ? <BusinessPlanModule classId={classId} isTeamLeader studentDisplayName="演示学员" teamMemberCount={1} /> : null}
          {activeKey === 'topicReview' ? (
            <TopicReview personalClass={{ id: classId, name: className, academicYear: '', semester: '', createdAt: '', studentCount: 1 }} />
          ) : null}
          {activeKey === 'bmcReview' ? (
            <BmcReview
              personalClass={{ id: classId, name: className, academicYear: '', semester: '', createdAt: '', studentCount: 1 }}
              api={{ fetchTeacherBmcReviews, reviewTeacherBmc }}
            />
          ) : null}
          {activeKey === 'planReview' && planDetailId ? (
            <BusinessPlanDetailPage classId={classId} submissionId={planDetailId} onBack={() => setPlanDetailId(null)} />
          ) : null}
          {activeKey === 'planReview' && !planDetailId ? (
            <BusinessPlanReview
              personalClass={{ id: classId, name: className, academicYear: '', semester: '', createdAt: '', studentCount: 1 }}
              onOpenDetail={setPlanDetailId}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
