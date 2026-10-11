import { useEffect, useMemo, useState } from 'react';
import { message } from 'antd';
import UserAvatar from '../../../../components/UserAvatar';
import {
  fetchTeacherTeamCockpit,
  fetchTeacherTeamStageWorkspace,
  fetchTeacherTeamWorkspaceSummary,
  type TeacherTeamCockpit,
  type TeacherWorkspaceSummary,
} from '../../../../lib/teacherMonitorApi';
import StagePanels from './StagePanels';
import TeamCockpitPanel from './TeamCockpitPanel';
import { roleLabel } from './formViews';

const STATUS_LABEL: Record<string, string> = {
  'on-track': '正常',
  'at-risk': '预警',
  delayed: '滞后',
};
const STATUS_CLS: Record<string, string> = {
  'on-track': 'bg-green-100 text-green-700',
  'at-risk': 'bg-orange-100 text-orange-700',
  delayed: 'bg-red-100 text-red-700',
};

const STAGE_META: { key: string; name: string; short: string; icon: string }[] = [
  { key: 'team', name: '组队与团队管理', short: '组队', icon: 'ri-team-line' },
  { key: 'ideation', name: '创新思维与创意生成', short: '创新', icon: 'ri-lightbulb-line' },
  { key: 'market', name: '市场调研与用户画像', short: '调研', icon: 'ri-search-line' },
  { key: 'product', name: '产品设计与原型', short: '设计', icon: 'ri-pencil-ruler-2-line' },
  { key: 'business', name: '商业模式设计', short: '商模', icon: 'ri-bar-chart-box-line' },
  { key: 'simulation', name: '项目仿真与角色推荐', short: '仿真', icon: 'ri-user-star-line' },
  { key: 'plan', name: '商业计划书与PPT', short: '计划书', icon: 'ri-file-text-line' },
];

type Props = {
  classId: string;
  teamId: number;
  stage: string;
  onStageChange: (moduleKey: string) => void;
  onBack: () => void;
  onIntervene: () => void;
};

export default function TeamWorkspacePage({
  classId,
  teamId,
  stage,
  onStageChange,
  onBack,
  onIntervene,
}: Props) {
  const [summary, setSummary] = useState<TeacherWorkspaceSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [stageData, setStageData] = useState<any>(null);
  const [stageLoading, setStageLoading] = useState(false);
  const [cockpit, setCockpit] = useState<TeacherTeamCockpit | null>(null);
  const [cockpitLoading, setCockpitLoading] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(false);
  /** 手机：未选阶段时显示卡片列表；选中后进入内容 */
  const [mobileStagePicked, setMobileStagePicked] = useState(false);

  const enabledOrder = summary?.enabledOrder || [];
  // 默认驾驶舱；URL 无 stage 或非法 stage 时回落 cockpit
  const activeStage = useMemo(() => {
    if (stage === 'cockpit' || !stage) return 'cockpit';
    if (enabledOrder.includes(stage)) return stage;
    return 'cockpit';
  }, [stage, enabledOrder]);

  const isCockpit = activeStage === 'cockpit';

  const visibleStages = useMemo(() => {
    const progressMap = new Map((summary?.stages || []).map((s) => [s.key, s]));
    return STAGE_META.filter((t) => enabledOrder.includes(t.key)).map((t) => ({
      ...t,
      progress: progressMap.get(t.key)?.progress ?? 0,
      completedAt: progressMap.get(t.key)?.completedAt || '',
      fullName: progressMap.get(t.key)?.name || t.name,
    }));
  }, [enabledOrder, summary?.stages]);

  useEffect(() => {
    if (!classId || !teamId) return;
    let cancelled = false;
    setSummaryLoading(true);
    fetchTeacherTeamWorkspaceSummary(classId, teamId)
      .then((data) => {
        if (cancelled) return;
        setSummary(data);
        // 无 stage / 非法 stage → 默认驾驶舱
        if (!stage || (stage !== 'cockpit' && !data.enabledOrder.includes(stage))) {
          if (stage !== 'cockpit') onStageChange('cockpit');
        }
      })
      .catch((e: any) => {
        if (!cancelled) {
          message.error(e?.message || '加载团队概览失败');
          setSummary(null);
        }
      })
      .finally(() => {
        if (!cancelled) setSummaryLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, teamId]);

  useEffect(() => {
    setMobileStagePicked(false);
  }, [teamId]);

  // 驾驶舱数据常驻拉取，供侧栏摘要与主区展示
  useEffect(() => {
    if (!classId || !teamId) return;
    let cancelled = false;
    setCockpitLoading(true);
    fetchTeacherTeamCockpit(classId, teamId)
      .then((data) => {
        if (!cancelled) setCockpit(data);
      })
      .catch((e: any) => {
        if (!cancelled) {
          if (isCockpit) message.error(e?.message || '加载驾驶舱失败');
          setCockpit(null);
        }
      })
      .finally(() => {
        if (!cancelled) setCockpitLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, teamId]);

  useEffect(() => {
    if (!classId || !teamId || isCockpit || !activeStage) return;
    let cancelled = false;
    setStageLoading(true);
    fetchTeacherTeamStageWorkspace(classId, teamId, activeStage)
      .then((data) => {
        if (!cancelled) setStageData(data.stage);
      })
      .catch((e: any) => {
        if (!cancelled) {
          message.error(e?.message || '加载环节数据失败');
          setStageData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setStageLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [classId, teamId, activeStage, isCockpit]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 768px)');
    const sync = () => {
      if (mq.matches) setMobileStagePicked(true);
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const teamName = summary?.team?.name || cockpit?.team?.name || `团队 #${teamId}`;
  const status = summary?.status || 'on-track';

  const pickStage = (key: string) => {
    onStageChange(key);
    setMobileStagePicked(true);
    setOverviewOpen(false);
  };

  const cockpitScoreHint =
    cockpit?.finalEvaluation?.status === 'scored' && cockpit.finalEvaluation.finalScore != null
      ? `总评 ${cockpit.finalEvaluation.finalScore.toFixed(0)}`
      : cockpit?.weightedProcessScore != null
        ? `过程分 ${cockpit.weightedProcessScore.toFixed(0)}`
        : `进度 ${summary?.overallProgress ?? 0}%`;

  const sidebar = (
    <div className="space-y-3 md:space-y-4">
      <section className="bg-white rounded-xl md:rounded-2xl border border-gray-100 p-3 md:p-4">
        <h3 className="text-xs font-bold text-gray-500 mb-2.5">成员</h3>
        <div className="space-y-2">
          {(summary?.members || []).map((m) => (
            <div key={m.studentId} className="flex items-center gap-2 min-w-0">
              <UserAvatar name={m.name} avatarUrl={m.avatarUrl} size="sm" />
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">
                  {m.name}
                  {m.studentId === summary?.team?.leaderStudentId ? (
                    <span className="ml-1 text-[10px] text-teal-600">队长</span>
                  ) : null}
                </div>
                <div className="text-xs text-gray-400 truncate">
                  {(m as any).aiMatchedRoleLabel || roleLabel(m.aiMatchedRole)}
                </div>
              </div>
            </div>
          ))}
          {!summary?.members?.length ? <div className="text-xs text-gray-400">暂无成员</div> : null}
        </div>
      </section>

      {/* 驾驶舱独立入口：不放进实训流程列表 */}
      <button
        type="button"
        onClick={() => pickStage('cockpit')}
        className={`w-full text-left rounded-xl md:rounded-2xl border p-3 md:p-4 cursor-pointer transition-colors ${
          isCockpit
            ? 'border-teal-300 bg-gradient-to-br from-teal-50 to-cyan-50/60 shadow-sm'
            : 'border-gray-100 bg-white hover:border-teal-200 hover:bg-teal-50/30'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isCockpit ? 'bg-teal-500 text-white' : 'bg-teal-50 text-teal-600'
            }`}
          >
            <i className="ri-dashboard-3-line text-lg" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-gray-900">实训驾驶舱</span>
              {isCockpit ? (
                <span className="text-[10px] text-teal-600 font-medium">查看中</span>
              ) : (
                <i className="ri-arrow-right-s-line text-gray-300" />
              )}
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5 truncate">
              过程评价 · 能力维度 · 交互热度 · {cockpitScoreHint}
            </p>
          </div>
        </div>
      </button>

      <section className="bg-white rounded-xl md:rounded-2xl border border-gray-100 p-3 md:p-4">
        <h3 className="text-xs font-bold text-gray-500 mb-2.5">实训流程</h3>
        <div className="space-y-2">
          {(summary?.stages || []).map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => pickStage(s.key)}
              className={`w-full text-left rounded-lg px-2 py-1.5 cursor-pointer ${
                !isCockpit && s.key === activeStage ? 'bg-teal-50' : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex justify-between text-xs mb-1 gap-2">
                <span className="font-medium text-gray-700 truncate">{s.name}</span>
                <span className="text-gray-500 shrink-0">{s.progress}%</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-teal-500 rounded-full" style={{ width: `${s.progress}%` }} />
              </div>
              {s.progress >= 100 && s.completedAt ? (
                <div className="text-[10px] text-gray-400 mt-1 truncate">完成于 {s.completedAt}</div>
              ) : null}
            </button>
          ))}
          {!summary?.stages?.length && !summaryLoading ? (
            <div className="text-xs text-gray-400">暂无启用环节</div>
          ) : null}
        </div>
      </section>

      {(summary?.warnings || []).length ? (
        <section className="bg-orange-50 border border-orange-100 rounded-xl md:rounded-2xl p-3 md:p-4">
          <h3 className="text-xs font-bold text-orange-700 mb-2">预警</h3>
          <ul className="space-y-1">
            {(summary?.warnings || []).map((w) => (
              <li key={w} className="text-xs text-orange-800 flex gap-1">
                <i className="ri-error-warning-line mt-0.5 shrink-0" />
                {w}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );

  const mobileStageCards = (
    <div className="grid grid-cols-1 gap-2.5 md:hidden">
      <button
        type="button"
        onClick={() => pickStage('cockpit')}
        className="w-full text-left bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-200 rounded-xl px-4 py-3.5 shadow-sm hover:border-teal-400 cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500 text-white flex items-center justify-center shrink-0">
            <i className="ri-dashboard-3-line text-lg" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-sm font-semibold text-gray-900">实训驾驶舱</span>
            <div className="text-[11px] text-gray-500 mt-0.5 truncate">
              过程评价 · 能力维度 · {cockpitScoreHint}
            </div>
          </div>
          <i className="ri-arrow-right-s-line text-gray-300 text-lg shrink-0" />
        </div>
      </button>
      <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wide pt-1">实训流程</div>
      {visibleStages.map((s) => (
        <button
          key={s.key}
          type="button"
          onClick={() => pickStage(s.key)}
          className="w-full text-left bg-white border border-gray-100 rounded-xl px-4 py-3.5 shadow-sm hover:border-teal-300 cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
              <i className={`${s.icon} text-lg`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-gray-900 truncate">{s.fullName}</span>
                <span className="text-xs text-teal-600 shrink-0">{s.progress}%</span>
              </div>
              <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-teal-500 rounded-full" style={{ width: `${s.progress}%` }} />
              </div>
              {s.progress >= 100 && s.completedAt ? (
                <div className="text-[11px] text-gray-400 mt-1 truncate">完成于 {s.completedAt}</div>
              ) : null}
            </div>
            <i className="ri-arrow-right-s-line text-gray-300 text-lg shrink-0" />
          </div>
        </button>
      ))}
      {!visibleStages.length && !summaryLoading ? (
        <div className="text-sm text-gray-400 text-center py-8">暂无启用环节</div>
      ) : null}
    </div>
  );

  const stageContent = (
    <>
      {isCockpit ? (
        <TeamCockpitPanel data={cockpit} loading={cockpitLoading} onOpenStage={pickStage} />
      ) : stageLoading ? (
        <div className="text-sm text-gray-400 text-center py-10 md:py-16">加载环节数据…</div>
      ) : (
        <StagePanels classId={classId} teamId={teamId} moduleKey={activeStage} stage={stageData} />
      )}
    </>
  );

  return (
    <div className="flex flex-col gap-3 md:gap-4 md:min-h-0 md:h-full">
      <div className="bg-white rounded-xl md:rounded-2xl border border-gray-100 px-3 py-2.5 md:px-5 md:py-3">
        <div className="flex items-center gap-2 md:gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center justify-center w-8 h-8 md:w-auto md:h-auto md:gap-1 shrink-0 text-gray-600 hover:text-teal-600 cursor-pointer rounded-lg hover:bg-gray-50"
            aria-label="返回监控"
          >
            <i className="ri-arrow-left-line text-lg md:text-base" />
            <span className="hidden md:inline text-sm">返回监控</span>
          </button>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="hidden sm:block shrink-0">
              <UserAvatar name={teamName} size="md" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <h2 className="text-sm md:text-lg font-bold text-gray-900 truncate">{teamName}</h2>
                <span className={`shrink-0 px-1.5 py-0.5 text-[10px] md:text-xs font-medium rounded-full ${STATUS_CLS[status]}`}>
                  {STATUS_LABEL[status] || status}
                </span>
              </div>
              <div className="text-[11px] md:text-xs text-gray-500 truncate">
                {summaryLoading
                  ? '加载中…'
                  : isCockpit
                    ? `驾驶舱 · 进度 ${summary?.overallProgress ?? 0}%`
                    : `进度 ${summary?.overallProgress ?? 0}% · ${summary?.currentStage || '—'}`}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onIntervene}
            className="shrink-0 px-2.5 py-1.5 text-[11px] md:text-xs font-medium rounded-lg md:rounded-xl bg-teal-500 text-white hover:bg-teal-600 cursor-pointer whitespace-nowrap"
          >
            <i className="ri-compass-3-line md:mr-1" />
            <span className="hidden md:inline">发送引导</span>
            <span className="md:hidden">引导</span>
          </button>
        </div>
      </div>

      <div className="md:hidden">
        <button
          type="button"
          className="w-full flex items-center justify-between bg-white border border-gray-100 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-800 cursor-pointer"
          onClick={() => setOverviewOpen((v) => !v)}
        >
          <span className="inline-flex items-center gap-1.5">
            <i className="ri-information-line text-teal-500" />
            团队概览
            {(summary?.warnings || []).length ? (
              <span className="text-[10px] font-normal text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full">
                {summary!.warnings.length} 条预警
              </span>
            ) : null}
          </span>
          <i className={overviewOpen ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} />
        </button>
        {overviewOpen ? <div className="mt-2">{sidebar}</div> : null}
      </div>

      <div className="flex gap-4 min-h-0 md:flex-1">
        <aside className="hidden md:block w-80 shrink-0 overflow-y-auto pb-4">{sidebar}</aside>

        <div className="flex-1 min-w-0 md:min-h-0 md:overflow-y-auto md:pb-4">
          <div className={mobileStagePicked ? 'hidden' : 'md:hidden'}>{mobileStageCards}</div>

          <div className={mobileStagePicked ? 'block' : 'hidden md:block'}>
            <div className="md:hidden mb-2">
              <button
                type="button"
                onClick={() => setMobileStagePicked(false)}
                className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-teal-600 cursor-pointer"
              >
                <i className="ri-arrow-left-s-line" />
                返回全部阶段
              </button>
              <div className="mt-1 text-sm font-semibold text-gray-900">
                {isCockpit
                  ? '实训驾驶舱'
                  : visibleStages.find((s) => s.key === activeStage)?.fullName || '环节详情'}
              </div>
            </div>
            {stageContent}
          </div>
        </div>
      </div>
    </div>
  );
}
