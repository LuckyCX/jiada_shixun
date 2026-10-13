/**
 * 团队实训驾驶舱：分数概览、能力雷达、阶段分柱状、交互热度与近期动态
 */
import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import UserAvatar from '../../../../components/UserAvatar';
import {
  TEAM_DIMENSION_BARS,
  TEAM_ROLE_LABELS,
  normalizeTeamDimensionProfile,
  type TeamRoleKey,
} from '../../../../lib/teamFormationApi';
import type { TeacherCockpitStageScore, TeacherTeamCockpit } from '../../../../lib/teacherMonitorApi';

const PROCESS_DIM_LABELS: { key: string; label: string }[] = [
  { key: 'participationDepth', label: '参与深度' },
  { key: 'aiCollaborationQuality', label: 'AI 协作' },
  { key: 'outputCompleteness', label: '产出完整' },
  { key: 'logicAndEvidence', label: '逻辑证据' },
  { key: 'innovationAndRisk', label: '创新风险' },
];

const FINAL_EXTRA_DIMS: { key: string; label: string; soloLabel: string }[] = [
  { key: 'crossStageConsistency', label: '跨阶段一致性', soloLabel: '跨阶段一致性' },
  { key: 'teamCollaborationOrSelfDrive', label: '团队协作贡献', soloLabel: '自学推进完整性' },
];

const STAGE_SHORT: Record<string, string> = {
  ideation: '创新',
  market: '调研',
  product: '设计',
  business: '商模',
  simulation: '仿真',
  plan: '计划书',
};

const CHART_COLORS = ['#14b8a6', '#0ea5e9', '#f59e0b', '#8b5cf6', '#f43f5e', '#22c55e'];

function roleLabel(key: string) {
  return TEAM_ROLE_LABELS[key as TeamRoleKey] || key || '—';
}

function scoreTone(score: number | null | undefined) {
  if (score == null || !Number.isFinite(score)) return 'text-gray-400';
  if (score >= 85) return 'text-teal-600';
  if (score >= 70) return 'text-emerald-600';
  if (score >= 55) return 'text-amber-600';
  return 'text-orange-600';
}

function statusLabel(status: string, complete: boolean) {
  if (status === 'scored') return '已评分';
  if (status === 'scoring' || status === 'pending') return '评分中';
  if (status === 'failed') return '评分失败';
  if (complete) return '待评分';
  return '未完成';
}

function formatTime(iso: string) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return '';
  }
}

/** 交互 scene 码 → 中文（与后端落库 scene 对齐） */
const SCENE_LABELS: Record<string, string> = {
  midwifery: '启思智能体',
  midwifery_turn: '启思智能体对话',
  brainstorm: '头脑风暴',
  brainstorm_turn: '头脑风暴对话',
  brainstorm_generate: '头脑风暴生成',
  scamper: 'SCAMPER',
  scamper_turn: 'SCAMPER 对话',
  triz: 'TRIZ',
  triz_turn: 'TRIZ 对话',
  ai_idea_turn: 'AI 创意对话',
  ai_idea_generate: 'AI 创意生成',
  six_hats: '六顶帽',
  hat_studio: '六帽创想室',
  survey_ai: '问卷生成',
  market_analysis_generate: '市场分析生成',
  persona_generate: '用户画像生成',
  market_report_upload: '调研报告上传',
  report: '调研报告',
  product_ai_suggestions_generate: '产品 AI 建议',
  prototype_upload: '原型上传',
  prototype: '原型',
  bmc_save: '商业画布上传',
  bmc_ai_review: '画布 AI 审查',
  bmc: '商业画布',
  swot_ai_guide: 'SWOT 引导填写',
  swot_ai_review: 'SWOT AI 审查',
  marketing_ai_guide: '营销引导填写',
  marketing_ai_review: '营销 AI 审查',
  finance_ai_guide: '成本引导填写',
  finance_ai_review: '成本 AI 审查',
  war_room: '虚拟董事会',
  war_room_turn: '董事会对话',
  hat_studio_turn: '六帽对话',
  six_hats_turn: '六帽对话',
  simulation_run: '仿真推演',
  plan_submit: '计划书提交',
  event: '事件',
};

/** scene → 商模子 Tab（驾驶舱详情深链） */
export function sceneToBmTab(scene: string): string | undefined {
  const s = String(scene || '');
  if (s.startsWith('swot_')) return 'swot';
  if (s.startsWith('marketing_')) return 'marketing';
  if (s.startsWith('finance_')) return 'finance';
  if (s.startsWith('bmc_') || s.startsWith('war_room')) return 'canvas';
  return undefined;
}

/** 阶段证据摘要 → 驾驶舱展示文案 */
function evidenceChips(s: TeacherCockpitStageScore): string[] {
  const e = s.evidenceSummary || {};
  const chips: string[] = [];
  const num = (k: string) => {
    const v = Number(e[k]);
    return Number.isFinite(v) ? v : null;
  };
  if (s.key === 'ideation') {
    const ideas = num('ideaCount');
    if (ideas != null) chips.push(`创意 ${ideas}`);
    const hats = num('hatMessageCount');
    if (hats != null && hats > 0) chips.push(`六帽消息 ${hats}`);
    const rej = num('topicRejectCount');
    if (rej != null && rej > 0) chips.push(`选题退回 ${rej}`);
    if (e.topicStatus) chips.push(`选题 ${String(e.topicStatus)}`);
  }
  if (s.key === 'market') {
    const rounds = num('challengeRounds');
    if (rounds != null && rounds > 0) chips.push(`对抗 ${rounds} 轮`);
    if (e.hasReport) chips.push('有调研报告');
  }
  if (s.key === 'product') {
    if (e.hasAiSuggestions) chips.push('已有 AI 建议');
    if (e.hasPrototype) chips.push(e.prototypeName ? `原型：${String(e.prototypeName)}` : '已上传原型');
  }
  if (s.key === 'business') {
    const parts = [
      e.swotSaved ? 'SWOT' : null,
      e.marketingSaved ? '营销' : null,
      e.financeSaved ? '财务' : null,
      e.bmcUploaded ? '画布已上传' : null,
      e.bmcTeacherApproved ? '教师已通过' : null,
    ].filter(Boolean);
    if (parts.length) chips.push(parts.join(' · '));
    const rev = num('bmcAiReviewCount');
    if (rev != null) {
      const avg = num('bmcAiReviewAvgScore');
      chips.push(avg != null ? `画布审查 ${rev} 次（均分 ${avg}）` : `画布审查 ${rev} 次`);
    }
    const sec = num('sectionAiReviewTotal');
    if (sec != null && sec > 0) chips.push(`分节审查 ${sec} 次`);
    const chats = num('recentChatCount');
    if (chats != null && chats > 0) chips.push(`近期对话 ${chats}`);
  }
  if (s.key === 'simulation') {
    const runs = num('runCount');
    if (runs != null) chips.push(`仿真 ${runs} 次`);
  }
  if (s.key === 'plan') {
    if (e.planStatus) chips.push(`计划书 ${String(e.planStatus)}`);
    const score = num('planScore');
    if (score != null) chips.push(`得分 ${score}`);
  }
  return chips;
}

const SCENE_TOKEN_ZH: Record<string, string> = {
  midwifery: '启思智能体',
  brainstorm: '头脑风暴',
  scamper: 'SCAMPER',
  triz: 'TRIZ',
  ai: 'AI',
  idea: '创意',
  six: '六顶帽',
  hats: '',
  hat: '帽子',
  studio: '工作室',
  survey: '问卷',
  market: '市场',
  analysis: '分析',
  persona: '用户画像',
  report: '报告',
  product: '产品',
  suggestions: '建议',
  prototype: '原型',
  bmc: '商业画布',
  war: '作战',
  room: '室',
  simulation: '仿真',
  run: '推演',
  plan: '计划书',
  turn: '对话',
  generate: '生成',
  upload: '上传',
  save: '保存',
  submit: '提交',
  event: '事件',
  guide: '引导',
  review: '审查',
  swot: 'SWOT',
  marketing: '营销',
  finance: '成本',
};

function sceneLabel(scene: string) {
  const key = String(scene || '').trim();
  if (!key) return '其他';
  if (SCENE_LABELS[key]) return SCENE_LABELS[key];
  // 未知 scene：按下划线分词拼中文，避免直接露出英文码
  const parts = key.split(/_+/).filter(Boolean);
  const zh = parts
    .map((p) => SCENE_TOKEN_ZH[p] ?? '')
    .filter(Boolean)
    .join('');
  return zh || '其他交互';
}

type OpenStageOpts = { bmTab?: string };

type Props = {
  data: TeacherTeamCockpit | null;
  loading?: boolean;
  onOpenStage: (moduleKey: string, opts?: OpenStageOpts) => void;
};

export default function TeamCockpitPanel({ data, loading, onOpenStage }: Props) {
  /** 近期 AI 交互：全部 / 各阶段 Tab */
  const [ixTab, setIxTab] = useState<string>('all');
  // 切换团队时回到「全部」
  useEffect(() => {
    setIxTab('all');
  }, [data?.team?.id]);

  if (loading) {
    return <div className="text-sm text-gray-400 text-center py-16">加载驾驶舱…</div>;
  }
  if (!data) {
    return <div className="text-sm text-gray-400 text-center py-16">暂无驾驶舱数据</div>;
  }

  const activeStages = data.stages.filter((s) => !s.skipped);
  const scoredStages = activeStages.filter((s) => s.totalScore != null);
  const completedStages = activeStages.filter((s) => s.complete || s.status === 'scored');
  const fin = data.finalEvaluation;
  const isSolo = data.team.isSolo;
  const stats = data.interactionStats;
  const totalIx = stats?.total ?? Object.values(data.interactionCounts || {}).reduce((a, b) => a + Number(b || 0), 0);

  // 团队能力均值 → 雷达
  const teamRadar = (() => {
    const acc = { strategic: 0, market: 0, techRisk: 0 };
    let n = 0;
    for (const m of data.members) {
      const p = normalizeTeamDimensionProfile(m.dimensionProfile || {});
      acc.strategic += p.strategic;
      acc.market += p.market;
      acc.techRisk += p.techRisk;
      n += 1;
    }
    if (!n) return TEAM_DIMENSION_BARS.map((d) => ({ dim: d.label, value: 0, fullMark: 100 }));
    return TEAM_DIMENSION_BARS.map((d) => ({
      dim: d.label,
      value: Math.round(acc[d.key] / n),
      fullMark: 100,
    }));
  })();

  // 过程分维度均值（已评分阶段）
  const processRadar = (() => {
    const acc: Record<string, number> = {};
    let n = 0;
    for (const s of scoredStages) {
      if (!s.dimensionScores) continue;
      n += 1;
      for (const d of PROCESS_DIM_LABELS) {
        const v = Number(s.dimensionScores[d.key]);
        if (Number.isFinite(v)) acc[d.key] = (acc[d.key] || 0) + v;
      }
    }
    if (!n) return PROCESS_DIM_LABELS.map((d) => ({ dim: d.label, value: 0, fullMark: 100 }));
    return PROCESS_DIM_LABELS.map((d) => ({
      dim: d.label,
      value: Math.round((acc[d.key] || 0) / n),
      fullMark: 100,
    }));
  })();

  const stageScoreChart = activeStages.map((s) => ({
    key: s.key,
    name: STAGE_SHORT[s.key] || s.name.slice(0, 4),
    fullName: s.name,
    score: s.totalScore != null ? Math.round(s.totalScore * 10) / 10 : 0,
    hasScore: s.totalScore != null,
    weight: Math.round((s.weight || 0) * 1000) / 10,
  }));

  const moduleIxChart = (stats?.byModule?.length
    ? stats.byModule
    : activeStages.map((s) => ({
        key: s.key,
        name: STAGE_SHORT[s.key] || s.name,
        count: Number(data.interactionCounts?.[s.key] || 0),
      }))
  ).map((row) => ({
    ...row,
    name: STAGE_SHORT[row.key] || row.name.slice(0, 4),
    fullName: row.name,
  }));

  const studentIxChart = (stats?.byStudent || []).map((m) => ({
    name: m.name.length > 4 ? `${m.name.slice(0, 3)}…` : m.name,
    fullName: m.name,
    count: m.count,
  }));

  const dailyTrend = stats?.dailyTrend || [];
  const sceneBars = (stats?.byScene || []).slice(0, 6).map((s) => ({
    name: sceneLabel(s.scene),
    count: s.count,
  }));

  const recentAll = stats?.recent || [];
  const ixTabs = [
    { key: 'all', label: '全部', count: recentAll.length },
    ...activeStages.map((s) => ({
      key: s.key,
      label: STAGE_SHORT[s.key] || s.name.slice(0, 4),
      count: recentAll.filter((r) => r.moduleKey === s.key).length,
    })),
  ];
  const recentFiltered =
    ixTab === 'all' ? recentAll : recentAll.filter((r) => r.moduleKey === ixTab);
  // 商模 AI 审查汇总（KPI）
  const businessStage = activeStages.find((s) => s.key === 'business');
  const bmcReviewCount = Number(businessStage?.evidenceSummary?.bmcAiReviewCount || 0);

  return (
    <div className="space-y-4">
      {/* KPI 条 */}
      <section className="bg-white rounded-xl md:rounded-2xl border border-gray-100 p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900">实训驾驶舱</h3>
            <p className="text-xs text-gray-500 mt-1">
              组队不参与评分 · 权重按未略过阶段均摊 · 教师不可改分
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="rounded-xl bg-cyan-50/80 border border-cyan-100 px-3 py-2.5">
            <div className="text-[10px] text-cyan-700/70">总评建议分</div>
            <div className={`text-xl font-bold tabular-nums ${scoreTone(fin?.finalScore)}`}>
              {fin?.status === 'scored' && fin.finalScore != null ? fin.finalScore.toFixed(1) : '—'}
            </div>
          </div>
          <div className="rounded-xl bg-amber-50/70 border border-amber-100 px-3 py-2.5">
            <div className="text-[10px] text-amber-700/70">阶段完成</div>
            <div className="text-xl font-bold tabular-nums text-amber-700">
              {completedStages.length}
              <span className="text-sm font-medium text-amber-600/70">/{activeStages.length}</span>
            </div>
          </div>
          <div className="rounded-xl bg-violet-50/70 border border-violet-100 px-3 py-2.5">
            <div className="text-[10px] text-violet-700/70">AI 交互次数</div>
            <div className="text-xl font-bold tabular-nums text-violet-700">{totalIx}</div>
          </div>
          <div className="rounded-xl bg-pink-50/70 border border-pink-100 px-3 py-2.5">
            <div className="text-[10px] text-pink-700/70">画布 AI 审查</div>
            <div className="text-xl font-bold tabular-nums text-pink-700">
              {bmcReviewCount > 0 ? bmcReviewCount : '—'}
            </div>
            {bmcReviewCount > 0 && businessStage?.evidenceSummary?.bmcAiReviewAvgScore != null ? (
              <div className="text-[10px] text-pink-600/80 mt-0.5">
                均分 {String(businessStage.evidenceSummary.bmcAiReviewAvgScore)}
              </div>
            ) : null}
          </div>
        </div>
        {fin?.status === 'scored' && (fin.summary || fin.comment) ? (
          <div className="mt-3 rounded-xl bg-teal-50/80 border border-teal-100 px-3 py-2.5 text-sm text-teal-900">
            {fin.summary || fin.comment}
          </div>
        ) : data.allScoringComplete ? (
          <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
            各阶段过程分已齐，总评生成中或待重试
          </div>
        ) : (
          <div className="mt-3 text-xs text-gray-500">
            当前未略过评分阶段全部完成后将自动生成总评
          </div>
        )}
      </section>

      {/* 图表行：阶段分 + 能力雷达 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="bg-white rounded-xl md:rounded-2xl border border-gray-100 p-4 md:p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-1">阶段过程分</h3>
          <p className="text-[11px] text-gray-400 mb-3">点击柱状可进入对应实训环节</p>
          {stageScoreChart.length ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stageScoreChart} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(value: number | undefined, _n, item) => {
                      const row = item?.payload as { hasScore?: boolean; fullName?: string; weight?: number };
                      if (!row?.hasScore) return ['待评', '得分'];
                      return [`${value ?? 0}（权重 ${row.weight ?? 0}%）`, row.fullName || '得分'];
                    }}
                    contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                  />
                  <Bar
                    dataKey="score"
                    radius={[6, 6, 0, 0]}
                    cursor="pointer"
                    onClick={(entry: any) => {
                      const key = entry?.payload?.key || entry?.key;
                      if (key) onOpenStage(String(key));
                    }}
                  >
                    {stageScoreChart.map((entry, i) => (
                      <Cell
                        key={entry.key}
                        fill={entry.hasScore ? CHART_COLORS[i % CHART_COLORS.length] : '#e2e8f0'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-xs text-gray-400 py-10 text-center">暂无评分阶段</div>
          )}
        </section>

        <section className="bg-white rounded-xl md:rounded-2xl border border-gray-100 p-4 md:p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-1">能力维度雷达</h3>
          <p className="text-[11px] text-gray-400 mb-3">组队测评均值 vs 过程分维度均值</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart
                data={PROCESS_DIM_LABELS.map((d, i) => ({
                  dim: d.label,
                  process: processRadar[i]?.value ?? 0,
                  // 能力三维映射到过程五维仅作对照：战略→参与/逻辑，市场→产出/协作，技术→创新
                  team:
                    d.key === 'participationDepth' || d.key === 'logicAndEvidence'
                      ? teamRadar[0]?.value ?? 0
                      : d.key === 'outputCompleteness' || d.key === 'aiCollaborationQuality'
                        ? teamRadar[1]?.value ?? 0
                        : teamRadar[2]?.value ?? 0,
                }))}
              >
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="dim" tick={{ fontSize: 10, fill: '#64748b' }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                <Radar name="过程维度" dataKey="process" stroke="#14b8a6" fill="#14b8a6" fillOpacity={0.35} />
                <Radar name="组队能力对照" dataKey="team" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.15} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-2 mt-1">
            {teamRadar.map((d) => (
              <span key={d.dim} className="text-[10px] px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 tabular-nums">
                {d.dim} 均值 {d.value}
              </span>
            ))}
          </div>
        </section>
      </div>

      {/* 交互热度 */}
      <section className="bg-white rounded-xl md:rounded-2xl border border-gray-100 p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="text-sm font-bold text-gray-900">AI 交互热度</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">累计 {totalIx} 次 · 按模块 / 成员 / 近 14 日趋势</p>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="h-48">
            <div className="text-[11px] text-gray-500 mb-1">分模块交互</div>
            {moduleIxChart.some((d) => d.count > 0) ? (
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={moduleIxChart} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v: number | undefined, _n, item) => [
                      v ?? 0,
                      (item?.payload as { fullName?: string })?.fullName || '次数',
                    ]}
                    contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                  />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">暂无交互记录</div>
            )}
          </div>
          <div className="h-48">
            <div className="text-[11px] text-gray-500 mb-1">成员贡献</div>
            {studentIxChart.some((d) => d.count > 0) ? (
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={studentIxChart} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={48} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v: number | undefined, _n, item) => [
                      v ?? 0,
                      (item?.payload as { fullName?: string })?.fullName || '次数',
                    ]}
                    contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                  />
                  <Bar dataKey="count" fill="#14b8a6" radius={[0, 4, 4, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">暂无成员交互</div>
            )}
          </div>
          <div className="h-48">
            <div className="text-[11px] text-gray-500 mb-1">近 14 日趋势</div>
            {dailyTrend.length ? (
              <ResponsiveContainer width="100%" height="90%">
                <LineChart data={dailyTrend} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Line type="monotone" dataKey="count" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3 }} name="交互" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">近 14 日无交互</div>
            )}
          </div>
        </div>
        {sceneBars.length ? (
          <div className="mt-4 pt-3 border-t border-gray-50">
            <div className="text-[11px] text-gray-500 mb-2">场景分布 Top</div>
            <div className="flex flex-wrap gap-2">
              {sceneBars.map((s) => (
                <span
                  key={s.name}
                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-100"
                >
                  <span className="text-gray-700">{s.name}</span>
                  <span className="font-bold tabular-nums text-teal-600">{s.count}</span>
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {/* 成员画像 */}
      <section className="bg-white rounded-xl md:rounded-2xl border border-gray-100 p-4 md:p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-3">成员与能力画像</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data.members.map((m) => {
            const profile = normalizeTeamDimensionProfile(m.dimensionProfile || {});
            const ix = stats?.byStudent?.find((x) => x.studentId === m.studentId)?.count ?? 0;
            return (
              <div key={m.studentId} className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <UserAvatar name={m.name} avatarUrl={m.avatarUrl} size="sm" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {m.name}
                        {m.studentId === data.team.leaderStudentId ? (
                          <span className="ml-1 text-[10px] text-teal-600">队长</span>
                        ) : null}
                      </div>
                      <div className="text-xs text-gray-500 truncate">{roleLabel(m.aiMatchedRole)}</div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[10px] text-gray-400">交互</div>
                    <div className="text-sm font-bold tabular-nums text-violet-600">{ix}</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1.5 mt-2.5">
                  {TEAM_DIMENSION_BARS.map((item) => (
                    <div key={item.key} className="bg-white rounded-lg p-2 border border-gray-100">
                      <p className="text-[10px] text-gray-500 mb-0.5">{item.label}</p>
                      <p className="text-sm font-bold text-gray-900 tabular-nums">{profile[item.key]}</p>
                      <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden mt-1">
                        <div
                          className={`h-full bg-gradient-to-r ${item.color} rounded-full`}
                          style={{ width: `${Math.min(100, profile[item.key])}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {!data.members.length ? <div className="text-xs text-gray-400">暂无成员</div> : null}
        </div>
      </section>

      {/* 阶段详情列表 */}
      <section className="bg-white rounded-xl md:rounded-2xl border border-gray-100 p-4 md:p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-3">阶段详情与评语</h3>
        <div className="space-y-2.5">
          {activeStages.map((s) => {
            const pct = s.totalScore != null ? s.totalScore : 0;
            const weightPct = Math.round((s.weight || 0) * 1000) / 10;
            const ix = Number(data.interactionCounts?.[s.key] || 0);
            const chips = evidenceChips(s);
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => onOpenStage(s.key)}
                className="w-full text-left rounded-xl border border-gray-100 hover:border-teal-200 hover:bg-teal-50/40 px-3 py-2.5 cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2 text-xs mb-1.5">
                  <span className="font-medium text-gray-800 truncate">
                    {s.name}
                    <span className="ml-1.5 text-gray-400 font-normal">权重 {weightPct}%</span>
                    <span className="ml-1.5 text-violet-500 font-normal">交互 {ix}</span>
                  </span>
                  <span className="shrink-0 text-gray-500">
                    {statusLabel(s.status, s.complete)}
                    {s.totalScore != null ? (
                      <span className={`ml-2 font-bold tabular-nums ${scoreTone(s.totalScore)}`}>
                        {s.totalScore.toFixed(1)}
                      </span>
                    ) : null}
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${s.totalScore != null ? 'bg-teal-500' : 'bg-gray-200'}`}
                    style={{ width: `${s.totalScore != null ? pct : s.complete ? 8 : 0}%` }}
                  />
                </div>
                {s.comment ? (
                  <p className="text-[11px] text-gray-500 mt-1.5 line-clamp-2">{s.comment}</p>
                ) : null}
                {s.dimensionScores ? (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {PROCESS_DIM_LABELS.map((d) => {
                      const v = Number(s.dimensionScores?.[d.key]);
                      if (!Number.isFinite(v)) return null;
                      return (
                        <span
                          key={d.key}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 tabular-nums"
                        >
                          {d.label} {v.toFixed(0)}
                        </span>
                      );
                    })}
                  </div>
                ) : null}
                {chips.length ? (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {chips.map((c) => (
                      <span
                        key={c}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-slate-50 border border-slate-100 text-slate-600"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                ) : null}
              </button>
            );
          })}
          {!activeStages.length ? (
            <div className="text-xs text-gray-400">当前课程未启用可评分阶段</div>
          ) : null}
        </div>
        {data.stages.some((s) => s.skipped) ? (
          <p className="text-[11px] text-gray-400 mt-3">
            已略过：{data.stages.filter((s) => s.skipped).map((s) => s.name).join('、')}
          </p>
        ) : null}
      </section>

      {/* 总评维度 */}
      {fin?.status === 'scored' && fin.dimensionScores ? (
        <section className="bg-white rounded-xl md:rounded-2xl border border-gray-100 p-4 md:p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3">总评维度</h3>
          <div className="flex flex-wrap gap-2">
            {PROCESS_DIM_LABELS.map((d) => {
              const v = Number(fin.dimensionScores?.[d.key]);
              if (!Number.isFinite(v)) return null;
              return (
                <span key={d.key} className="text-xs px-2 py-1 rounded-lg bg-gray-50 border border-gray-100 tabular-nums">
                  {d.label} {v.toFixed(0)}
                </span>
              );
            })}
            {FINAL_EXTRA_DIMS.map((d) => {
              const v = Number(fin.dimensionScores?.[d.key]);
              if (!Number.isFinite(v)) return null;
              return (
                <span key={d.key} className="text-xs px-2 py-1 rounded-lg bg-teal-50 border border-teal-100 tabular-nums">
                  {isSolo ? d.soloLabel : d.label} {v.toFixed(0)}
                </span>
              );
            })}
          </div>
          {fin.comment && fin.comment !== fin.summary ? (
            <p className="text-xs text-gray-600 mt-3 whitespace-pre-wrap">{fin.comment}</p>
          ) : null}
        </section>
      ) : null}

      {/* 近期动态：分阶段 Tab */}
      <section className="bg-white rounded-xl md:rounded-2xl border border-gray-100 p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-bold text-gray-900">近期 AI 交互</h3>
          <p className="text-[11px] text-gray-400">按实训阶段筛选 · 最多展示近 80 条</p>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {ixTabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setIxTab(t.key)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                ixTab === t.key
                  ? 'bg-teal-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-teal-50 hover:text-teal-700'
              }`}
            >
              {t.label}
              <span className={`ml-1 tabular-nums ${ixTab === t.key ? 'text-white/80' : 'text-gray-400'}`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>
        {recentFiltered.length ? (
          <ul className="space-y-2 max-h-[28rem] overflow-y-auto pr-0.5">
            {recentFiltered.map((r) => (
              <li
                key={r.id}
                className="rounded-xl border border-gray-100 px-3 py-2 hover:bg-gray-50/80"
              >
                <div className="flex items-center justify-between gap-2 text-[11px] text-gray-400 mb-0.5">
                  <span className="min-w-0 truncate">
                    <span className="text-gray-700 font-medium">{r.studentName}</span>
                    <span className="mx-1">·</span>
                    <span className="text-teal-700">{STAGE_SHORT[r.moduleKey] || r.moduleName}</span>
                    <span className="mx-1">·</span>
                    {sceneLabel(r.scene)}
                  </span>
                  <span className="shrink-0 flex items-center gap-2">
                    <span className="tabular-nums">{formatTime(r.createdAt)}</span>
                    <button
                      type="button"
                      onClick={() =>
                        onOpenStage(r.moduleKey, {
                          bmTab: r.moduleKey === 'business' ? sceneToBmTab(r.scene) : undefined,
                        })
                      }
                      className="px-2 py-0.5 rounded-md text-[11px] font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 cursor-pointer whitespace-nowrap"
                    >
                      详情
                    </button>
                  </span>
                </div>
                <p className="text-xs text-gray-600 line-clamp-2">{r.content || '（无摘要）'}</p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-xs text-gray-400 text-center py-8">
            {ixTab === 'all' ? '暂无 AI 交互记录' : '该阶段暂无近期交互'}
          </div>
        )}
      </section>

      <div className="text-center pb-2">
        <button
          type="button"
          onClick={() => onOpenStage('team')}
          className="text-xs text-teal-600 hover:text-teal-700 cursor-pointer"
        >
          查看组队与能力测评详情 →
        </button>
      </div>
    </div>
  );
}
