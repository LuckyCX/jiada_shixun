import { useEffect, useMemo, useState } from 'react';
import { COURSE_SETTING_STAGES, type CourseSettingStageKey } from '../../../../lib/courseSettingsApi';
import { DemoArchive, DemoOverview, DemoPracticeCourse } from './DemoLearning';
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
import {
  loadDemoState,
  type DemoStageKey,
  type DemoState,
} from './demoStore';

export default function ClassDemoPage({
  classId,
  className,
  enabledModuleKeys,
  stage,
  onStageChange,
}: {
  classId: string;
  className: string;
  enabledModuleKeys: CourseSettingStageKey[];
  stage: string;
  onStageChange: (stage: DemoStageKey) => void;
}) {
  const stages = useMemo(
    () => COURSE_SETTING_STAGES.filter((item) => item.key === 'team' || enabledModuleKeys.includes(item.key)),
    [enabledModuleKeys]
  );
  const learningMenus: { key: DemoStageKey; label: string; icon: string }[] = [
    { key: 'overview', label: '进度看板', icon: 'ri-dashboard-line' },
    { key: 'knowledge', label: '实践课程', icon: 'ri-book-2-line' },
    { key: 'archive', label: '学习档案', icon: 'ri-folder-line' },
  ];
  const showTopicReview = stages.some((item) => item.key === 'ideation');
  const showPlanReview = stages.some((item) => item.key === 'plan');
  const reviewMenus: { key: DemoStageKey; label: string; icon: string }[] = [
    ...(showTopicReview ? [{ key: 'topicReview' as const, label: '选题审核', icon: 'ri-checkbox-circle-line' }] : []),
    ...(showPlanReview ? [{ key: 'planReview' as const, label: '商业计划书审核', icon: 'ri-file-edit-line' }] : []),
  ];
  const activeKey = (learningMenus.some((item) => item.key === stage) || stages.some((item) => item.key === stage) || reviewMenus.some((item) => item.key === stage)
    ? stage
    : 'overview') as DemoStageKey;
  const [state, setState] = useState<DemoState>(() => loadDemoState(classId));
  const [planDetailId, setPlanDetailId] = useState<string | null>(null);

  useEffect(() => {
    setState(loadDemoState(classId));
    setPlanDetailId(null);
  }, [classId]);

  useEffect(() => {
    setPlanDetailId(null);
  }, [activeKey]);

  const refresh = () => setState(loadDemoState(classId));

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
        {stages.map((item, index) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onStageChange(item.key)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm cursor-pointer ${activeKey === item.key ? 'bg-teal-500 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <span className="w-4 text-xs">{index + 1}</span>
            {item.shortName}
          </button>
        ))}
        {reviewMenus.length ? <div className="px-2 py-2 mt-3 text-xs font-semibold text-gray-400">任务与审核</div> : null}
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
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          {activeKey === 'overview' ? <DemoOverview className={className} state={state} enabledModuleKeys={enabledModuleKeys} /> : null}
          {activeKey === 'knowledge' ? <DemoPracticeCourse classId={classId} enabledModuleKeys={enabledModuleKeys} onChange={refresh} /> : null}
          {activeKey === 'archive' ? <DemoArchive classId={classId} /> : null}
          {activeKey === 'team' ? (
            <TeamFormationModule classId={classId} className={className} onTeamUpdated={refresh} />
          ) : null}
          {activeKey === 'ideation' ? <IdeationModule classId={classId} isTeamLeader /> : null}
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
