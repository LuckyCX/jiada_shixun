import { useState, useEffect, useRef } from 'react';
import AppModalPortal from '../../../../../components/AppModalPortal';

interface SimConfig {
  budget: number;
  price: number;
  targetUsers: number;
  businessModel: string;
  channels: { social: number; search: number; offline: number };
}

interface Metrics {
  users: number;
  revenue: number;
  cac: number;
  ltv: number;
  userGrowth: number[];
  revenueGrowth: number[];
}

function TrackingAutoSync({
  classId,
  onLoaded,
}: {
  classId: string;
  onLoaded: (rec: any | null) => void;
}) {
  const onLoadedRef = useRef(onLoaded);
  useEffect(() => {
    onLoadedRef.current = onLoaded;
  }, [onLoaded]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sid = 'demo-student';
        if (!sid) return;
        const { fetchRoleSimulationMemberRecords } = await import('../demoSimulationApi');
        const data = await fetchRoleSimulationMemberRecords(classId, sid);
        const rec = data?.records?.[0] || null;
        if (!cancelled) onLoadedRef.current(rec);
      } catch {
        if (!cancelled) onLoadedRef.current(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [classId]);
  return null;
}

const businessModels = [
  { id: 'b2c', label: 'B2C', icon: 'ri-user-line' },
  { id: 'b2b', label: 'B2B', icon: 'ri-building-line' },
  { id: 'c2c', label: 'C2C', icon: 'ri-exchange-line' },
  { id: 'freemium', label: 'Freemium', icon: 'ri-gift-line' },
  { id: 'subscription', label: '订阅制', icon: 'ri-repeat-line' },
  { id: 'platform', label: '平台抽佣', icon: 'ri-percent-line' },
];

/** Y 轴刻度文案：避免「万元」取整后全变成 0 */
function formatYAxisTick(value: number, divisor: number): string {
  const scaled = value / divisor;
  if (!Number.isFinite(scaled)) return '0';
  if (divisor <= 1) return String(Math.round(scaled));
  if (scaled === 0) return '0';
  if (scaled >= 100) return String(Math.round(scaled));
  if (scaled >= 10) return scaled.toFixed(1).replace(/\.0$/, '');
  if (scaled >= 1) return scaled.toFixed(1);
  // 不足 1 个单位（如 0.57 万元）保留两位，去掉末尾无意义 0
  return scaled.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

const LineChart = ({
  data,
  color,
  gradientId,
  currentDay,
  yLabel,
  yUnit,
  yValueDivisor = 1,
}: {
  data: number[];
  color: string;
  gradientId: string;
  currentDay: number;
  yLabel: string;
  yUnit: string;
  yValueDivisor?: number;
}) => {
  const W = 780;
  const H = 220;
  const PAD = 10;
  const LPAD = 58; // 给竖轴预留空间（兼容「元」四位数 / 「万元」小数）

  // 只绘制已模拟的天数数据
  const validData = data.slice(0, currentDay);
  if (validData.length === 0) return null;

  const maxValue = Math.max(...validData) || 1;
  // 早期模拟收入常不足 1 万：用「元」刻度更清晰，避免 Math.round(万元) 全是 0
  const useYuanScale = yValueDivisor >= 10000 && maxValue < yValueDivisor;
  const axisDivisor = useYuanScale ? 1 : yValueDivisor;
  const axisUnit = useYuanScale ? '元' : yUnit;

  const ticks = 4; // 0~max 分成4段，共5个刻度
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => {
    const ratio = i / ticks;
    const v = maxValue * ratio;
    const y = H - PAD - ratio * (H - PAD * 2);
    const display = formatYAxisTick(v, axisDivisor);
    return { y, display };
  });

  // 计算每个数据点的坐标
  const pts = validData.map((v, i) => ({
    x: LPAD + (i / 29) * (W - LPAD - PAD), // 按30天总长度计算位置
    y: H - PAD - (v / maxValue) * (H - PAD * 2),
  }));

  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');
  const last = pts[pts.length - 1];
  const areaD = `${pathD} L ${last.x},${H - PAD} L ${LPAD},${H - PAD} Z`;

  // X轴标签：显示第1、8、15、22、30天
  const displayLabels = [
    { day: 1, x: LPAD },
    { day: 8, x: LPAD + (7 / 29) * (W - LPAD - PAD) },
    { day: 15, x: LPAD + (14 / 29) * (W - LPAD - PAD) },
    { day: 22, x: LPAD + (21 / 29) * (W - LPAD - PAD) },
    { day: 30, x: W - PAD },
  ];

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H + 24}`} className="overflow-visible">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* 竖轴标题 */}
      <text x={LPAD} y={12} textAnchor="start" fontSize="11" fill="#9ca3af">
        {yLabel}（{axisUnit}）
      </text>
      {/* 网格线与刻度 */}
      {yTicks.map((t, idx) => (
        <g key={idx}>
          <line x1={LPAD} y1={t.y} x2={W - PAD} y2={t.y} stroke="#f3f4f6" strokeWidth="1" />
          <text x={LPAD - 8} y={t.y + 4} textAnchor="end" fontSize="11" fill="#9ca3af">
            {t.display}
          </text>
        </g>
      ))}
      <path d={areaD} fill={`url(#${gradientId})`} />
      <path d={pathD} stroke={color} strokeWidth="3" fill="none" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="4" fill={color} />
      ))}
      {displayLabels.map((l) => (
        <text key={l.day} x={l.x} y={H + 18} textAnchor="middle" fontSize="11" fill="#9ca3af">
          第{l.day}天
        </text>
      ))}
    </svg>
  );
};

type RoleSimulationModuleProps = {
  classId: string;
  onTaskComplete?: () => void;
  trainingEnded?: boolean;
};

const RoleSimulationModule = ({ classId, onTaskComplete, trainingEnded = false }: RoleSimulationModuleProps) => {
  const [step, setStep] = useState<'config' | 'tracking' | 'optimize'>('config');
  const [isRunning, setIsRunning] = useState(false);
  const [simDay, setSimDay] = useState(0);
  const [config, setConfig] = useState<SimConfig>({
    budget: 0,
    price: 0,
    targetUsers: 0,
    businessModel: 'b2c',
    channels: { social: 0, search: 0, offline: 0 },
  });
  const [metrics, setMetrics] = useState<Metrics>({
    users: 0,
    revenue: 0,
    cac: 0,
    ltv: 0,
    userGrowth: Array(30).fill(0),
    revenueGrowth: Array(30).fill(0),
  });
  const abortRef = useRef<AbortController | null>(null);
  const [entryLoading, setEntryLoading] = useState(true);
  const [entryAllowed, setEntryAllowed] = useState(true);
  const [entryError, setEntryError] = useState<string>('');
  const [prerequisiteModuleKey, setPrerequisiteModuleKey] = useState<string>('');

  const [thinkingLines, setThinkingLines] = useState<string[]>([]);
  const [thinkingText, setThinkingText] = useState<string>('');
  const [showThinking, setShowThinking] = useState(true);
  const thinkingScrollRef = useRef<HTMLDivElement | null>(null);
  const [optimize, setOptimize] = useState<any>(null);
  const [runId, setRunId] = useState<string>('');
  const [lastConfig, setLastConfig] = useState<SimConfig | null>(null);
  const [activeRunIndex, setActiveRunIndex] = useState<number>(0);
  const [latestSnapshot, setLatestSnapshot] = useState<{
    runId: string;
    runIndex: number;
    createdAt: string;
    config: any;
    tracking: any;
    optimize: any;
  } | null>(null);

  const [recordsOpen, setRecordsOpen] = useState(false);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsData, setRecordsData] = useState<any>(null);
  const [activeMemberId, setActiveMemberId] = useState<string>('');
  const [memberRecords, setMemberRecords] = useState<any>(null);
  const [memberRecordsLoading, setMemberRecordsLoading] = useState(false);
  /** 环节达标进度：个人有效轮次 / 3，全员达标才算完成 */
  const [qualifyProgress, setQualifyProgress] = useState<{
    myEffective: number;
    teamQualified: boolean;
  }>({ myEffective: 0, teamQualified: false });

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!isRunning || !showThinking) return;
    const el = thinkingScrollRef.current;
    if (!el) return;
    // 始终滚动到最新内容（底部）
    el.scrollTop = el.scrollHeight;
  }, [thinkingText, isRunning, showThinking]);

  useEffect(() => {
    if (!recordsOpen || !activeMemberId) return;
    let cancelled = false;
    setMemberRecords(null);
    setMemberRecordsLoading(true);
    (async () => {
      try {
        const { fetchRoleSimulationMemberRecords } = await import('../demoSimulationApi');
        const data = await fetchRoleSimulationMemberRecords(classId, activeMemberId);
        if (!cancelled) setMemberRecords(data);
      } finally {
        if (!cancelled) setMemberRecordsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recordsOpen, activeMemberId, classId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setEntryLoading(true);
        setEntryError('');
        const { fetchRoleSimulationEntry, fetchRoleSimulationRecords } = await import(
          '../demoSimulationApi'
        );
        const entry = await fetchRoleSimulationEntry(classId);
        if (!mounted) return;
        setEntryAllowed(Boolean(entry.allowed));
        setPrerequisiteModuleKey(String(entry.prerequisiteModuleKey || ''));
        if (!entry.allowed && entry.summary) setEntryError(entry.summary);
        // 同步个人有效轮次，避免「做了 2 次却像 0 进度」
        try {
          const sid = 'demo-student';
          const rec = await fetchRoleSimulationRecords(classId);
          if (!mounted) return;
          const mine = (rec.progress || []).find((p) => String(p.studentId) === sid);
          setQualifyProgress({
            myEffective: Math.max(0, Number(mine?.effectiveRounds || 0)),
            teamQualified: Boolean(rec.teamQualified),
          });
        } catch {
          /* 进度条失败不阻断进入仿真 */
        }
      } catch (e: any) {
        if (!mounted) return;
        setEntryAllowed(false);
        setEntryError(String(e?.message || '加载失败'));
      } finally {
        if (mounted) setEntryLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [classId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sid = 'demo-student';
        if (!sid) return;
        const { fetchRoleSimulationMemberRecords } = await import('../demoSimulationApi');
        const data = await fetchRoleSimulationMemberRecords(classId, sid);
        const rec = data?.records?.[0];
        if (!rec || cancelled) return;

        setLatestSnapshot({
          runId: String(rec.id),
          runIndex: Number(rec.runIndex || 0),
          createdAt: String(rec.createdAt || ''),
          config: rec.config || {},
          tracking: rec.tracking || {},
          optimize: rec.optimize || {},
        });

        const cfg = rec.config || {};
        const nextConfig: SimConfig = {
          budget: Number(cfg.budget || 0),
          price: Number(cfg.price || 0),
          targetUsers: Number(cfg.targetUsers || 0),
          businessModel: String(cfg.businessModel || 'b2c'),
          channels: {
            social: Number(cfg.channels?.social || 0),
            search: Number(cfg.channels?.search || 0),
            offline: Number(cfg.channels?.offline || 0),
          },
        };
        setConfig(nextConfig);
        setLastConfig(nextConfig);
        setRunId(String(rec.id));
        setOptimize(rec.optimize || null);

        const daysArr = Array.isArray(rec.tracking?.days) ? rec.tracking.days : [];
        const maxDay = Math.max(0, ...daysArr.map((d: any) => Number(d?.day || 0)));
        if (maxDay > 0) {
          const usersSeries = Array(30).fill(0);
          const revenueSeries = Array(30).fill(0);
          for (const d of daysArr) {
            const day = Number(d?.day || 0);
            if (day >= 1 && day <= 30) {
              usersSeries[day - 1] = Number(d?.users || 0);
              revenueSeries[day - 1] = Number(d?.revenue || 0);
            }
          }
          setSimDay(maxDay);
          setMetrics({
            users: Number(rec.tracking?.users || usersSeries[Math.max(0, maxDay - 1)] || 0),
            revenue: Number(rec.tracking?.revenue || revenueSeries[Math.max(0, maxDay - 1)] || 0),
            cac: Number(rec.tracking?.cac || 0),
            ltv: Number(rec.tracking?.ltv || 0),
            userGrowth: usersSeries,
            revenueGrowth: revenueSeries,
          });
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [classId]);

  const startSimulation = () => {
    if (entryLoading) return;
    if (!entryAllowed) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setIsRunning(true);
    setRunId('');
    setActiveRunIndex(0);
    setOptimize(null);
    setThinkingLines([]);
    setThinkingText('');
    setShowThinking(true);
    setSimDay(0);
    setLastConfig(config);
    setLatestSnapshot(null);
    setMetrics({
      users: 0,
      revenue: 0,
      cac: 0,
      ltv: 0,
      userGrowth: Array(30).fill(0),
      revenueGrowth: Array(30).fill(0),
    });
    setStep('tracking');

    (async () => {
      try {
        const { streamRoleSimulation } = await import('../demoSimulationApi');
        await streamRoleSimulation(
          classId,
          {
            businessModel: config.businessModel,
            config: {
              budget: config.budget,
              price: config.price,
              targetUsers: config.targetUsers,
              channels: config.channels,
            },
            prevRunId: runId || undefined,
          },
          (ev) => {
            if (ev.event === 'start') {
              const data = (ev as any).data || {};
              if (data?.runId) setRunId(String(data.runId));
              if (data?.runIndex != null) setActiveRunIndex(Number(data.runIndex || 0));
              return;
            }
            if (ev.event === 'thinking_delta') {
              const chunk = String((ev as any).data?.line || '');
              if (chunk) {
                setThinkingText((prev) => {
                  const next = (prev + chunk).slice(-4000);
                  return next;
                });
              }
              return;
            }
            if (ev.event === 'day_result') {
              const d = (ev as any).data;
              const day = Number(d?.day || 0);
              if (!day || day < 1 || day > 30) return;
              setShowThinking(false);
              setSimDay(day);
              setMetrics((prev) => {
                const userGrowth = [...prev.userGrowth];
                const revenueGrowth = [...prev.revenueGrowth];
                userGrowth[day - 1] = Number(d.users || 0);
                revenueGrowth[day - 1] = Number(d.revenue || 0);
                return {
                  users: Number(d.users || 0),
                  revenue: Number(d.revenue || 0),
                  cac: Number(d.cac || 0),
                  ltv: Number(d.ltv || 0),
                  userGrowth,
                  revenueGrowth,
                };
              });
              return;
            }
            if (ev.event === 'final_snapshot') {
              setOptimize((ev as any).data?.optimize || null);
              return;
            }
            if (ev.event === 'done') {
              const data = (ev as any).data;
              setRunId(String(data?.runId || ''));
              setOptimize(data?.optimize || null);
              setIsRunning(false);
              setSimDay(30);
              setLatestSnapshot({
                runId: String(data?.runId || ''),
                runIndex: Number(data?.runIndex || activeRunIndex || 0),
                createdAt: String(data?.createdAt || ''),
                config: {
                  businessModel: config.businessModel,
                  budget: config.budget,
                  price: config.price,
                  targetUsers: config.targetUsers,
                  channels: config.channels,
                },
                tracking: data?.tracking || {},
                optimize: data?.optimize || {},
              });
              // 刷新达标进度（有效轮次）
              void (async () => {
                try {
                  const sid = 'demo-student';
                  const { fetchRoleSimulationRecords } = await import('../demoSimulationApi');
                  const rec = await fetchRoleSimulationRecords(classId);
                  const mine = (rec.progress || []).find((p) => String(p.studentId) === sid);
                  setQualifyProgress({
                    myEffective: Math.max(0, Number(mine?.effectiveRounds || 0)),
                    teamQualified: Boolean(rec.teamQualified),
                  });
                } catch {
                  /* ignore */
                }
              })();
              onTaskComplete?.();
              return;
            }
            if (ev.event === 'error') {
              setIsRunning(false);
              setEntryError(String((ev as any).data?.message || '模拟失败'));
              return;
            }
          },
          abortRef.current.signal
        );
      } catch (e: any) {
        setIsRunning(false);
        setEntryError(String(e?.message || '模拟失败'));
      }
    })();
  };

  const syncTrackingFromRecord = (rec: any) => {
    if (!rec) return;
    const daysArr = Array.isArray(rec.tracking?.days) ? rec.tracking.days : [];
    const maxDay = Math.max(0, ...daysArr.map((d: any) => Number(d?.day || 0)));
    const usersSeries = Array(30).fill(0);
    const revenueSeries = Array(30).fill(0);
    for (const d of daysArr) {
      const day = Number(d?.day || 0);
      if (day >= 1 && day <= 30) {
        usersSeries[day - 1] = Number(d?.users || 0);
        revenueSeries[day - 1] = Number(d?.revenue || 0);
      }
    }
    setSimDay(maxDay);
    setMetrics({
      users: Number(rec.tracking?.users || usersSeries[Math.max(0, maxDay - 1)] || 0),
      revenue: Number(rec.tracking?.revenue || revenueSeries[Math.max(0, maxDay - 1)] || 0),
      cac: Number(rec.tracking?.cac || 0),
      ltv: Number(rec.tracking?.ltv || 0),
      userGrowth: usersSeries,
      revenueGrowth: revenueSeries,
    });
  };

  const resumeSimulation = async (rec: any) => {
    if (entryLoading || !entryAllowed) return;
    if (!rec?.id) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setIsRunning(true);
    setThinkingText('');
    setShowThinking(true);
    try {
      const { streamRoleSimulation } = await import('../demoSimulationApi');
      await streamRoleSimulation(
        classId,
        {
          businessModel: String(rec.config?.businessModel || config.businessModel || ''),
          config: rec.config || {},
          runId: String(rec.id),
        },
        (ev) => {
          if (ev.event === 'thinking_delta') {
            const chunk = String((ev as any).data?.line || '');
            if (chunk) {
              setThinkingText((prev) => (prev + chunk).slice(-4000));
            }
            return;
          }
          if (ev.event === 'day_result') {
            const d = (ev as any).data;
            const day = Number(d?.day || 0);
            if (!day || day < 1 || day > 30) return;
            setShowThinking(false);
            setSimDay(day);
            setMetrics((prev) => {
              const userGrowth = [...prev.userGrowth];
              const revenueGrowth = [...prev.revenueGrowth];
              userGrowth[day - 1] = Number(d.users || 0);
              revenueGrowth[day - 1] = Number(d.revenue || 0);
              return {
                users: Number(d.users || 0),
                revenue: Number(d.revenue || 0),
                cac: Number(d.cac || 0),
                ltv: Number(d.ltv || 0),
                userGrowth,
                revenueGrowth,
              };
            });
            return;
          }
          if (ev.event === 'final_snapshot') {
            setOptimize((ev as any).data?.optimize || null);
            return;
          }
          if (ev.event === 'done') {
            const data = (ev as any).data;
            setRunId(String(data?.runId || ''));
            setOptimize(data?.optimize || null);
            setIsRunning(false);
            setSimDay(30);
            onTaskComplete?.();
            return;
          }
          if (ev.event === 'error') {
            setIsRunning(false);
            setEntryError(String((ev as any).data?.message || '模拟失败'));
            return;
          }
        },
        abortRef.current.signal
      );
    } catch (e: any) {
      setIsRunning(false);
      setEntryError(String(e?.message || '模拟失败'));
    }
  };

  const resetSimulation = () => {
    abortRef.current?.abort();
    setIsRunning(false);
    setSimDay(0);
    setStep('config');
    // 重新配置：保留上一次配置，便于迭代优化
    if (lastConfig) setConfig(lastConfig);
    setMetrics({
      users: 0,
      revenue: 0,
      cac: 0,
      ltv: 0,
      userGrowth: Array(30).fill(0),
      revenueGrowth: Array(30).fill(0),
    });
  };

  const totalChannel = config.channels.social + config.channels.search + config.channels.offline;

  const QUALIFY_ROUNDS = 3;
  const myShown = Math.min(QUALIFY_ROUNDS, qualifyProgress.myEffective);
  const myPct = Math.round((myShown / QUALIFY_ROUNDS) * 100);

  return (
    <div className="space-y-6">
      {/* 达标进度：有效轮次 = max(run_index)，需每人 ≥ 3 轮 */}
      <div className="bg-white border border-emerald-100 rounded-xl p-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div>
            <p className="text-sm font-semibold text-gray-900">环节达标进度</p>
            <p className="text-xs text-gray-500 mt-0.5">
              个人有效模拟 {myShown}/{QUALIFY_ROUNDS} 轮
              {qualifyProgress.teamQualified ? ' · 全员已达标' : ' · 全员各满 3 轮后本环节完成'}
            </p>
          </div>
          <span className="text-lg font-bold text-emerald-600">{myPct}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${myPct}%` }} />
        </div>
      </div>

      {/* 步骤导航 */}
      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl p-4">
        {[
          { key: 'config', label: '投入配置', icon: 'ri-settings-3-line' },
          { key: 'tracking', label: '实时追踪', icon: 'ri-line-chart-line' },
          { key: 'optimize', label: '迭代优化', icon: 'ri-refresh-line' },
        ].map((s, idx) => (
          <button
            key={s.key}
            onClick={() => setStep(s.key as 'config' | 'tracking' | 'optimize')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
              step === s.key
                ? 'bg-emerald-500 text-white'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <i className={`${s.icon} text-base`} />
            <span>{s.label}</span>
            {idx < 2 && <i className="ri-arrow-right-s-line text-gray-300 ml-1" />}
          </button>
        ))}
      </div>

      {/* 投入配置 */}
      {step === 'config' && (
        <div className="space-y-4">
          {latestSnapshot && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">上次模拟进度</p>
                  <p className="text-xs text-gray-500 mt-1">
                    第 {latestSnapshot.runIndex} 次模拟 · {latestSnapshot.createdAt.replace('T', ' ').slice(0, 16)}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-emerald-600">第 {simDay} / 30 天</div>
                  <div className="text-xs text-gray-500 mt-1">
                    用户 {Number(metrics.users || 0).toLocaleString()} · 收入 ¥{(Number(metrics.revenue || 0) / 10000).toFixed(1)} 万
                  </div>
                </div>
              </div>
            </div>
          )}
          {!entryLoading && !entryAllowed && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">暂不可开始仿真模拟</p>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    {entryError || '请先完成关联课程学习及知识点检测后再开始。'}
                  </p>
                  {prerequisiteModuleKey && (
                    <p className="text-xs text-gray-400 mt-1">关联课程：{prerequisiteModuleKey}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 商业模型选择 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-base font-bold text-gray-900 mb-4">选择商业模型</h3>
            <div className="grid grid-cols-3 gap-3">
              {businessModels.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setConfig((c) => ({ ...c, businessModel: m.id }))}
                  className={`flex flex-col items-center gap-2 py-3 rounded-xl border-2 transition-all ${
                    config.businessModel === m.id
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-600'
                      : 'border-gray-200 text-gray-600 hover:border-emerald-200'
                  }`}
                >
                  <i className={`${m.icon} text-xl`} />
                  <span className="text-xs font-medium">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 基础参数 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
            <h3 className="text-base font-bold text-gray-900">基础参数配置</h3>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">营销预算</span>
                <span className="font-semibold text-emerald-600">¥{config.budget.toLocaleString()}</span>
              </div>
              <input
                type="range" min={10000} max={200000} step={5000}
                value={config.budget}
                onChange={(e) => setConfig((c) => ({ ...c, budget: Number(e.target.value) }))}
                className="w-full accent-emerald-500"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>¥10,000</span><span>¥200,000</span>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">产品定价</span>
                <span className="font-semibold text-emerald-600">¥{config.price}</span>
              </div>
              <input
                type="range" min={9} max={999} step={10}
                value={config.price}
                onChange={(e) => setConfig((c) => ({ ...c, price: Number(e.target.value) }))}
                className="w-full accent-emerald-500"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>¥9</span><span>¥999</span>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">目标用户数</span>
                <span className="font-semibold text-emerald-600">{config.targetUsers.toLocaleString()}人</span>
              </div>
              <input
                type="range" min={1000} max={100000} step={1000}
                value={config.targetUsers}
                onChange={(e) => setConfig((c) => ({ ...c, targetUsers: Number(e.target.value) }))}
                className="w-full accent-emerald-500"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>1,000</span><span>100,000</span>
              </div>
            </div>
          </div>

          {/* 渠道分配 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">渠道分配</h3>
            </div>
            {[
              { key: 'social', label: '社交媒体', icon: 'ri-share-line', color: 'text-pink-500' },
              { key: 'search', label: '搜索引擎', icon: 'ri-search-line', color: 'text-blue-500' },
              { key: 'offline', label: '线下推广', icon: 'ri-map-pin-line', color: 'text-orange-500' },
            ].map((ch) => (
              <div key={ch.key}>
                <div className="flex justify-between text-sm mb-2">
                  <span className={`flex items-center gap-1 ${ch.color}`}>
                    <i className={ch.icon} />{ch.label}
                  </span>
                  <span className="font-semibold text-gray-700">{config.channels[ch.key as keyof typeof config.channels]}%</span>
                </div>
                <input
                  type="range" min={0} max={100} step={5}
                  value={config.channels[ch.key as keyof typeof config.channels]}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      channels: { ...c.channels, [ch.key]: Number(e.target.value) },
                    }))
                  }
                  className="w-full accent-emerald-500"
                />
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={startSimulation}
              disabled={trainingEnded || entryLoading || !entryAllowed}
              className={`flex-[3] py-3 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 ${
                trainingEnded || entryLoading || !entryAllowed
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-emerald-500 text-white hover:bg-emerald-600'
              }`}
            >
              <i className="ri-play-circle-line text-lg" />
              开始模拟市场
            </button>

            <button
              onClick={() => {
                setRecordsOpen(true);
                setRecordsLoading(true);
                setMemberRecords(null);
                (async () => {
                  try {
                    const { fetchRoleSimulationRecords } = await import('../demoSimulationApi');
                    const data = await fetchRoleSimulationRecords(classId);
                    setRecordsData(data);
                    const firstMember = data?.members?.[0]?.studentId || '';
                    setActiveMemberId(firstMember);
                  } finally {
                    setRecordsLoading(false);
                  }
                })();
              }}
              className="flex-[1] py-3 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <i className="ri-history-line" />
              记录
            </button>
          </div>
        </div>
      )}

      {/* 实时追踪 */}
      {step === 'tracking' && (
        <div className="space-y-4">
          {/* 进入追踪时先同步一次数据库最新进度；若未完成则接力继续输出 */}
          {!isRunning && (
            <TrackingAutoSync
              classId={classId}
              onLoaded={(rec) => {
                if (!rec) return;
                syncTrackingFromRecord(rec);
                const daysArr = Array.isArray(rec.tracking?.days) ? rec.tracking.days : [];
                const maxDay = Math.max(0, ...daysArr.map((d: any) => Number(d?.day || 0)));
                if (!isRunning && maxDay > 0 && maxDay < 30) {
                  void resumeSimulation(rec);
                }
              }}
            />
          )}
          {/* 思考过程：开始出数后隐藏 */}
          {showThinking && isRunning && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700">AI 思考过程</span>
              </div>
              <div
                ref={thinkingScrollRef}
                className="h-20 bg-gray-50 rounded-lg border border-gray-100 px-3 py-2 overflow-y-auto"
              >
                <div className="space-y-1">
                  {thinkingText ? (
                    <div
                      className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap break-words"
                    >
                      {thinkingText}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400">暂无内容</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 进度 */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-700">模拟进度</span>
              <span className="text-sm text-emerald-600 font-bold">第 {simDay} / 30 天</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${(simDay / 30) * 100}%` }}
              />
            </div>
            {isRunning && (
              <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                <i className="ri-loader-4-line animate-spin" />模拟运行中...
              </p>
            )}
            {!isRunning && simDay === 30 && (
              <p className="text-xs text-emerald-500 mt-2 flex items-center gap-1">
                <i className="ri-checkbox-circle-line" />模拟完成！
              </p>
            )}
          </div>

          {/* 关键指标 */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: '累计用户', value: metrics.users.toLocaleString(), unit: '人', icon: 'ri-user-3-line', color: 'text-emerald-500' },
              { label: '累计收入', value: `¥${(metrics.revenue / 10000).toFixed(1)}`, unit: '万', icon: 'ri-money-cny-circle-line', color: 'text-blue-500' },
              { label: '获客成本', value: `¥${metrics.cac}`, unit: '/人', icon: 'ri-funds-line', color: 'text-orange-500' },
              { label: '用户LTV', value: `¥${metrics.ltv}`, unit: '', icon: 'ri-vip-crown-line', color: 'text-purple-500' },
            ].map((m) => (
              <div key={m.label} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className={`w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 mb-2`}>
                  <i className={`${m.icon} ${m.color} text-lg`} />
                </div>
                <p className="text-xs text-gray-500">{m.label}</p>
                <p className="text-lg font-bold text-gray-900 mt-0.5">
                  {m.value}<span className="text-xs text-gray-400 ml-0.5">{m.unit}</span>
                </p>
              </div>
            ))}
          </div>

          {/* 用户增长折线图 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-base font-bold text-gray-900 mb-4">用户增长趋势</h3>
            <div className="h-56">
              {metrics.userGrowth.some((v) => v > 0) ? (
                <LineChart
                  data={metrics.userGrowth}
                  color="rgb(16,185,129)"
                  gradientId="userGrad"
                  currentDay={simDay}
                  yLabel="用户数"
                  yUnit="人"
                />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                  <i className="ri-bar-chart-2-line mr-2 text-xl" />暂无数据，请先开始模拟
                </div>
              )}
            </div>
          </div>

          {/* 收入增长折线图 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-base font-bold text-gray-900 mb-4">收入增长趋势</h3>
            <div className="h-56">
              {metrics.revenueGrowth.some((v) => v > 0) ? (
                <LineChart
                  data={metrics.revenueGrowth}
                  color="rgb(59,130,246)"
                  gradientId="revenueGrad"
                  currentDay={simDay}
                  yLabel="收入"
                  yUnit="万元"
                  yValueDivisor={10000}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                  <i className="ri-line-chart-line mr-2 text-xl" />暂无数据，请先开始模拟
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={resetSimulation}
              className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <i className="ri-restart-line" />重新配置
            </button>
            <button
              onClick={() => setStep('optimize')}
              className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
            >
              <i className="ri-lightbulb-line" />查看优化建议
            </button>
          </div>
        </div>
      )}

      {/* 迭代优化 */}
      {step === 'optimize' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 flex items-center justify-center bg-emerald-100 rounded-lg">
                <i className="ri-robot-line text-emerald-600 text-lg" />
              </div>
              <h3 className="text-base font-bold text-gray-900">AI 优化建议</h3>
            </div>
            <div className="space-y-3">
              {(Array.isArray(optimize?.suggestions) ? optimize.suggestions : []).map((s: any, idx: number) => (
                <div key={idx} className="border border-gray-100 rounded-xl p-4 hover:border-emerald-200 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-800">{String(s.title || '').trim()}</p>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">{String(s.desc || '').trim()}</p>
                    </div>
                    <span className="text-xs bg-emerald-100 text-emerald-600 px-2 py-1 rounded-full whitespace-nowrap font-medium">
                      {String(s.impact || '').trim()}
                    </span>
                  </div>
                </div>
              ))}
              {(!optimize || !Array.isArray(optimize?.suggestions) || optimize.suggestions.length === 0) && (
                <div className="text-sm text-gray-400 py-8 text-center">暂无优化建议</div>
              )}
            </div>
          </div>

          {/* 方案对比 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-base font-bold text-gray-900 mb-4">方案快照对比</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-2">当前方案</p>
                <p className="text-sm font-semibold text-gray-800">预算 ¥{(config.budget / 10000).toFixed(1)}万</p>
                <p className="text-sm text-gray-600">定价 ¥{config.price}</p>
                <p className="text-sm text-gray-600">用户 {metrics.users.toLocaleString()}人</p>
                <p className="text-sm text-gray-600">收入 ¥{(metrics.revenue / 10000).toFixed(1)}万</p>
                {optimize?.comparison?.current?.summary && (
                  <p className="text-xs text-gray-500 mt-2 leading-relaxed">{String(optimize.comparison.current.summary)}</p>
                )}
              </div>
              <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-4">
                <p className="text-xs text-emerald-600 mb-2">优化预测</p>
                <p className="text-sm font-semibold text-gray-800">预算 ¥{(config.budget / 10000).toFixed(1)}万</p>
                <p className="text-sm text-gray-600">定价 ¥{Math.round(config.price * 0.9)}</p>
                <p className="text-sm text-emerald-600 font-medium">用户 {Math.round(metrics.users * 1.18).toLocaleString()}人</p>
                <p className="text-sm text-emerald-600 font-medium">收入 ¥{(metrics.revenue * 1.25 / 10000).toFixed(1)}万</p>
                {optimize?.comparison?.optimized?.summary && (
                  <p className="text-xs text-emerald-700 mt-2 leading-relaxed">{String(optimize.comparison.optimized.summary)}</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={resetSimulation}
              className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <i className="ri-restart-line" />重新模拟
            </button>
            <button
              onClick={() => setStep('tracking')}
              className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
            >
              <i className="ri-line-chart-line" />查看数据
            </button>
          </div>
        </div>
      )}

      {/* 历史记录弹窗 */}
      {recordsOpen && (
        <AppModalPortal
          open={true}
          onMaskClick={() => {
            setRecordsOpen(false);
            setRecordsData(null);
            setMemberRecords(null);
          }}
          zIndex={50}
        >
          <div
            className="w-full max-w-5xl bg-white rounded-2xl overflow-hidden shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="text-base font-bold text-gray-900">仿真记录</div>
              <button
                onClick={() => {
                  setRecordsOpen(false);
                  setRecordsData(null);
                  setMemberRecords(null);
                }}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-500 flex items-center justify-center"
              >
                <i className="ri-close-line text-lg" />
              </button>
            </div>
            <div className="flex h-[520px]">
              <div className="w-56 border-r border-gray-100 overflow-y-auto">
                {recordsLoading ? (
                  <div className="p-4 text-sm text-gray-400">加载中...</div>
                ) : (
                  <div className="p-2 space-y-1">
                    {(recordsData?.members || []).map((m: any) => (
                      <button
                        key={m.studentId}
                        onClick={() => setActiveMemberId(String(m.studentId))}
                        className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                          activeMemberId === String(m.studentId)
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {m.studentName}
                      </button>
                    ))}
                    {(!recordsData?.members || recordsData.members.length === 0) && (
                      <div className="p-4 text-sm text-gray-400">暂无成员</div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex-1 overflow-y-auto">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-semibold text-gray-900">历史记录</div>
                  </div>
                  {memberRecordsLoading ? (
                    <div className="text-sm text-gray-400 py-8 text-center">加载中...</div>
                  ) : (
                    <div className="space-y-3">
                      {(memberRecords?.records || []).map((r: any) => (
                        <details key={r.id} className="border border-gray-200 rounded-xl p-4">
                          <summary className="cursor-pointer list-none flex items-center justify-between">
                            <div className="text-sm font-semibold text-gray-800">
                              第 {Number(r.runIndex || 0)} 次模拟
                              <span className="text-xs text-gray-400 font-normal ml-2">{String(r.createdAt || '').replace('T', ' ').slice(0, 16)}</span>
                            </div>
                            <i className="ri-arrow-down-s-line text-gray-400" />
                          </summary>
                          <div className="mt-3 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="bg-gray-50 rounded-xl p-3">
                                <div className="text-xs text-gray-500 mb-2">配置快照</div>
                                <div className="text-sm text-gray-800">商业模型：{String(r.config?.businessModel || '') || '—'}</div>
                                <div className="text-sm text-gray-800">预算：¥{Number(r.config?.budget || 0).toLocaleString()}</div>
                                <div className="text-sm text-gray-800">定价：¥{Number(r.config?.price || 0)}</div>
                                <div className="text-sm text-gray-800">目标用户：{Number(r.config?.targetUsers || 0).toLocaleString()} 人</div>
                                <div className="text-sm text-gray-800">
                                  渠道：社交 {Number(r.config?.channels?.social || 0)}% / 搜索 {Number(r.config?.channels?.search || 0)}% / 线下 {Number(r.config?.channels?.offline || 0)}%
                                </div>
                              </div>
                              <div className="bg-gray-50 rounded-xl p-3">
                                <div className="text-xs text-gray-500 mb-2">追踪快照（第30天）</div>
                                <div className="text-sm text-gray-800">用户：{Number(r.tracking?.users || 0).toLocaleString()} 人</div>
                                <div className="text-sm text-gray-800">收入：¥{(Number(r.tracking?.revenue || 0) / 10000).toFixed(1)} 万</div>
                                <div className="text-sm text-gray-800">CAC：¥{Number(r.tracking?.cac || 0)}</div>
                                <div className="text-sm text-gray-800">LTV：¥{Number(r.tracking?.ltv || 0)}</div>
                              </div>
                            </div>

                            <div className="border border-gray-100 rounded-xl p-3">
                              <div className="text-xs text-gray-500 mb-2">完整模拟数据（30天）</div>
                              {Array.isArray(r.tracking?.days) && r.tracking.days.length > 0 ? (
                                <div className="grid grid-cols-1 gap-4">
                                  <div>
                                    <div className="text-xs text-gray-500 mb-2">用户增长趋势</div>
                                    <div className="h-44">
                                      <LineChart
                                        data={Array.from({ length: 30 }, (_, i) => {
                                          const day = i + 1;
                                          const row = (r.tracking.days as any[]).find((x) => Number(x?.day) === day);
                                          return Number(row?.users || 0);
                                        })}
                                        color="rgb(16,185,129)"
                                        gradientId={`recordUserGrad_${String(r.id)}`}
                                        currentDay={Math.max(...(r.tracking.days as any[]).map((x) => Number(x?.day || 0))) || 0}
                                        yLabel="用户数"
                                        yUnit="人"
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-gray-500 mb-2">收入增长趋势</div>
                                    <div className="h-44">
                                      <LineChart
                                        data={Array.from({ length: 30 }, (_, i) => {
                                          const day = i + 1;
                                          const row = (r.tracking.days as any[]).find((x) => Number(x?.day) === day);
                                          return Number(row?.revenue || 0);
                                        })}
                                        color="rgb(59,130,246)"
                                        gradientId={`recordRevenueGrad_${String(r.id)}`}
                                        currentDay={Math.max(...(r.tracking.days as any[]).map((x) => Number(x?.day || 0))) || 0}
                                        yLabel="收入"
                                        yUnit="万元"
                                        yValueDivisor={10000}
                                      />
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-sm text-gray-400 py-6 text-center">暂无数据</div>
                              )}
                            </div>

                            <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                              <div className="text-xs text-emerald-700 mb-2">优化建议（完整版）</div>
                              {(Array.isArray(r.optimize?.suggestions) ? r.optimize.suggestions : []).map((s: any, idx: number) => (
                                <div key={idx} className="py-2 border-b border-emerald-100 last:border-b-0">
                                  <div className="text-sm font-semibold text-emerald-900">{String(s.title || '').trim() || '—'}</div>
                                  <div className="text-xs text-emerald-800 mt-1 leading-relaxed">{String(s.desc || '').trim()}</div>
                                  <div className="text-xs text-emerald-700 mt-1">{String(s.impact || '').trim()}</div>
                                </div>
                              ))}
                              {(!r.optimize?.suggestions || r.optimize.suggestions.length === 0) && (
                                <div className="text-sm text-emerald-800">暂无</div>
                              )}
                              {(r.optimize?.comparison?.current?.summary || r.optimize?.comparison?.optimized?.summary) && (
                                <div className="mt-3 grid grid-cols-2 gap-3">
                                  <div className="bg-white/60 rounded-xl p-3">
                                    <div className="text-xs text-emerald-700 mb-1">当前方案摘要</div>
                                    <div className="text-xs text-gray-700 leading-relaxed">{String(r.optimize?.comparison?.current?.summary || '—')}</div>
                                  </div>
                                  <div className="bg-white/60 rounded-xl p-3">
                                    <div className="text-xs text-emerald-700 mb-1">优化方案摘要</div>
                                    <div className="text-xs text-gray-700 leading-relaxed">{String(r.optimize?.comparison?.optimized?.summary || '—')}</div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </details>
                      ))}
                      {(!memberRecords?.records || memberRecords.records.length === 0) && (
                        <div className="text-sm text-gray-400 py-10 text-center">暂无记录</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </AppModalPortal>
      )}
    </div>
  );
};

export default RoleSimulationModule;
