import { useState, useEffect, useRef } from 'react';

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

const businessModels = [
  { id: 'b2c', label: 'B2C', icon: 'ri-user-line' },
  { id: 'b2b', label: 'B2B', icon: 'ri-building-line' },
  { id: 'c2c', label: 'C2C', icon: 'ri-exchange-line' },
  { id: 'freemium', label: 'Freemium', icon: 'ri-gift-line' },
  { id: 'subscription', label: '订阅制', icon: 'ri-repeat-line' },
  { id: 'platform', label: '平台抽佣', icon: 'ri-percent-line' },
];

const aiSuggestions = [
  { id: 1, title: '提高社交媒体投入', desc: '当前社交渠道ROI最高，建议将预算占比提升至50%以上', impact: '+18%用户增长' },
  { id: 2, title: '优化定价策略', desc: '市场调研显示目标用户对当前定价敏感，建议降低10%以提升转化率', impact: '+12%转化率' },
  { id: 3, title: '拓展B端合作', desc: '企业客户LTV是个人用户的5倍，建议开拓B端渠道', impact: '+25%收入' },
];

const LineChart = ({
  data,
  color,
  gradientId,
  currentDay,
}: {
  data: number[];
  color: string;
  gradientId: string;
  currentDay: number;
}) => {
  const W = 780;
  const H = 220;
  const PAD = 10;

  // 横坐标显示第1天到第30天
  const xLabels = Array.from({ length: 30 }, (_, i) => i + 1);
  
  // 只绘制已模拟的天数数据
  const validData = data.slice(0, currentDay);
  if (validData.length === 0) return null;

  const maxValue = Math.max(...validData) || 1;

  // 计算每个数据点的坐标
  const pts = validData.map((v, i) => ({
    x: PAD + (i / 29) * (W - PAD * 2), // 按30天总长度计算位置
    y: H - PAD - (v / maxValue) * (H - PAD * 2),
  }));

  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');
  const last = pts[pts.length - 1];
  const areaD = `${pathD} L ${last.x},${H - PAD} L ${PAD},${H - PAD} Z`;

  // X轴标签：显示第1、8、15、22、30天
  const displayLabels = [
    { day: 1, x: PAD },
    { day: 8, x: PAD + (7 / 29) * (W - PAD * 2) },
    { day: 15, x: PAD + (14 / 29) * (W - PAD * 2) },
    { day: 22, x: PAD + (21 / 29) * (W - PAD * 2) },
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
  onTaskComplete?: () => void;
};

const RoleSimulationModule = ({ onTaskComplete }: RoleSimulationModuleProps) => {
  const [step, setStep] = useState<'config' | 'tracking' | 'optimize'>('config');
  const [isRunning, setIsRunning] = useState(false);
  const [simDay, setSimDay] = useState(0);
  const [config, setConfig] = useState<SimConfig>({
    budget: 50000,
    price: 99,
    targetUsers: 10000,
    businessModel: 'b2c',
    channels: { social: 50, search: 30, offline: 20 },
  });
  const [metrics, setMetrics] = useState<Metrics>({
    users: 0,
    revenue: 0,
    cac: 0,
    ltv: 0,
    userGrowth: Array(30).fill(0),
    revenueGrowth: Array(30).fill(0),
  });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startSimulation = () => {
    setIsRunning(true);
    setSimDay(0);
    setMetrics({
      users: 0,
      revenue: 0,
      cac: 0,
      ltv: 0,
      userGrowth: Array(30).fill(0),
      revenueGrowth: Array(30).fill(0),
    });
    setStep('tracking');

    let day = 0;
    const baseGrowth = config.budget / 1000;

    timerRef.current = setInterval(() => {
      day += 1;
      if (day > 30) {
        if (timerRef.current) clearInterval(timerRef.current);
        setIsRunning(false);
        onTaskComplete?.();
        return;
      }

      setSimDay(day);
      setMetrics((prev) => {
        const newUserGrowth = [...prev.userGrowth];
        const newRevenueGrowth = [...prev.revenueGrowth];

        const prevUsers = day === 1 ? 0 : newUserGrowth[day - 2];
        const growth = baseGrowth * (1 + day * 0.05) * (0.85 + Math.random() * 0.3);
        const todayUsers = Math.round(prevUsers + growth);
        newUserGrowth[day - 1] = todayUsers;

        const prevRevenue = day === 1 ? 0 : newRevenueGrowth[day - 2];
        const revenueGrowth = todayUsers * config.price * 0.08 * (0.9 + Math.random() * 0.2);
        const todayRevenue = Math.round(prevRevenue + revenueGrowth);
        newRevenueGrowth[day - 1] = todayRevenue;

        const totalUsers = todayUsers;
        const totalRevenue = todayRevenue;
        const cac = totalUsers > 0 ? Math.round(config.budget / totalUsers) : 0;
        const ltv = Math.round(config.price * 8.5);

        return {
          users: totalUsers,
          revenue: totalRevenue,
          cac,
          ltv,
          userGrowth: newUserGrowth,
          revenueGrowth: newRevenueGrowth,
        };
      });
    }, 800);
  };

  const resetSimulation = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRunning(false);
    setSimDay(0);
    setStep('config');
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

  return (
    <div className="space-y-6">
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
              <span className={`text-xs px-2 py-1 rounded-full ${totalChannel === 100 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500'}`}>
                总计 {totalChannel}%
              </span>
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

          <button
            onClick={startSimulation}
            className="w-full py-4 bg-emerald-500 text-white rounded-xl font-bold text-base hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
          >
            <i className="ri-play-circle-line text-xl" />
            开始模拟市场
          </button>
        </div>
      )}

      {/* 实时追踪 */}
      {step === 'tracking' && (
        <div className="space-y-4">
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
                <LineChart data={metrics.userGrowth} color="rgb(16,185,129)" gradientId="userGrad" currentDay={simDay} />
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
                <LineChart data={metrics.revenueGrowth} color="rgb(59,130,246)" gradientId="revenueGrad" currentDay={simDay} />
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
              {aiSuggestions.map((s) => (
                <div key={s.id} className="border border-gray-100 rounded-xl p-4 hover:border-emerald-200 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-800">{s.title}</p>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">{s.desc}</p>
                    </div>
                    <span className="text-xs bg-emerald-100 text-emerald-600 px-2 py-1 rounded-full whitespace-nowrap font-medium">
                      {s.impact}
                    </span>
                  </div>
                </div>
              ))}
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
              </div>
              <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-4">
                <p className="text-xs text-emerald-600 mb-2">优化预测</p>
                <p className="text-sm font-semibold text-gray-800">预算 ¥{(config.budget / 10000).toFixed(1)}万</p>
                <p className="text-sm text-gray-600">定价 ¥{Math.round(config.price * 0.9)}</p>
                <p className="text-sm text-emerald-600 font-medium">用户 {Math.round(metrics.users * 1.18).toLocaleString()}人</p>
                <p className="text-sm text-emerald-600 font-medium">收入 ¥{(metrics.revenue * 1.25 / 10000).toFixed(1)}万</p>
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
    </div>
  );
};

export default RoleSimulationModule;
