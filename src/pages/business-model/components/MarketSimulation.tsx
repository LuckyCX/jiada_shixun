import { useState, useEffect, useRef } from 'react';

interface SimulationConfig {
  budget: number;
  pricing: number;
  targetUsers: number;
  channels: {
    online: number;
    offline: number;
    social: number;
    kol: number;
  };
}

interface MetricsData {
  dau: number;
  mau: number;
  retention7: number;
  retention30: number;
  arpu: number;
  cac: number;
  ltv: number;
  revenue: number;
  userGrowth: number[];
}

interface OptimizationSuggestion {
  id: string;
  title: string;
  description: string;
  impact: string;
  cost: number;
  applied: boolean;
}

export default function MarketSimulation() {
  const [step, setStep] = useState<'config' | 'tracking' | 'optimization'>('config');
  const [config, setConfig] = useState<SimulationConfig>({
    budget: 50000,
    pricing: 2,
    targetUsers: 5000,
    channels: {
      online: 40,
      offline: 30,
      social: 20,
      kol: 10,
    },
  });

  const [metrics, setMetrics] = useState<MetricsData>({
    dau: 0,
    mau: 0,
    retention7: 0,
    retention30: 0,
    arpu: 0,
    cac: 0,
    ltv: 0,
    revenue: 0,
    userGrowth: [],
  });

  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationDay, setSimulationDay] = useState(0);
  const [toast, setToast] = useState('');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const suggestions: OptimizationSuggestion[] = [
    {
      id: '1',
      title: '优化新手引导流程',
      description: '简化注册流程，增加引导动画，提升首次使用体验',
      impact: '预计提升7日留存率 8-12%',
      cost: 5000,
      applied: false,
    },
    {
      id: '2',
      title: '增加积分奖励机制',
      description: '完成订单获得积分，积分可兑换优惠券，提升用户粘性',
      impact: '预计提升30日留存率 15-20%',
      cost: 8000,
      applied: false,
    },
    {
      id: '3',
      title: '优化推送策略',
      description: '基于用户行为的智能推送，避免过度打扰',
      impact: '预计提升DAU 10-15%',
      cost: 3000,
      applied: false,
    },
    {
      id: '4',
      title: '增加社交分享功能',
      description: '分享订单到朋友圈获得优惠，降低获客成本',
      impact: '预计降低CAC 20-25%',
      cost: 6000,
      applied: false,
    },
    {
      id: '5',
      title: '推出会员月卡',
      description: '19.9元/月免配送费，提升ARPU和用户忠诚度',
      impact: '预计提升ARPU 30-40%',
      cost: 4000,
      applied: false,
    },
  ];

  const [optimizations, setOptimizations] = useState<OptimizationSuggestion[]>(suggestions);
  const [snapshots, setSnapshots] = useState<Array<{ time: string; metrics: MetricsData; config: SimulationConfig }>>([]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  // 开始模拟
  const startSimulation = () => {
    setStep('tracking');
    setIsSimulating(true);
    setSimulationDay(0);
    
    // 初始化指标
    const initialMetrics: MetricsData = {
      dau: Math.floor(config.targetUsers * 0.15),
      mau: Math.floor(config.targetUsers * 0.4),
      retention7: 35 + Math.random() * 10,
      retention30: 18 + Math.random() * 8,
      arpu: config.pricing * 8,
      cac: config.budget / config.targetUsers,
      ltv: config.pricing * 8 * 12,
      revenue: Math.floor(config.targetUsers * 0.15 * config.pricing * 3),
      userGrowth: [Math.floor(config.targetUsers * 0.15)],
    };
    setMetrics(initialMetrics);

    // 启动实时更新
    intervalRef.current = setInterval(() => {
      setSimulationDay(prev => {
        const newDay = prev + 1;
        if (newDay >= 30) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setIsSimulating(false);
          showToast('30天模拟完成！');
        }
        return newDay;
      });

      setMetrics(prev => {
        const growth = 1 + (Math.random() * 0.1 - 0.03);
        const newDau = Math.floor(prev.dau * growth);
        const newMau = Math.floor(prev.mau * (1 + Math.random() * 0.05));
        
        return {
          ...prev,
          dau: newDau,
          mau: newMau,
          retention7: Math.min(65, prev.retention7 + (Math.random() * 2 - 0.5)),
          retention30: Math.min(45, prev.retention30 + (Math.random() * 1.5 - 0.3)),
          arpu: prev.arpu * (1 + (Math.random() * 0.05 - 0.02)),
          revenue: Math.floor(newDau * config.pricing * 3 * (1 + Math.random() * 0.1)),
          userGrowth: [...prev.userGrowth.slice(-29), newDau],
        };
      });
    }, 1500);
  };

  // 停止模拟
  const stopSimulation = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsSimulating(false);
    showToast('模拟已暂停');
  };

  // 应用优化建议
  const applyOptimization = (id: string) => {
    const optimization = optimizations.find(opt => opt.id === id);
    if (!optimization) return;

    setOptimizations(prev =>
      prev.map(opt => (opt.id === id ? { ...opt, applied: true } : opt))
    );

    // 根据优化类型调整指标
    setMetrics(prev => {
      let updated = { ...prev };
      
      if (id === '1') {
        updated.retention7 = Math.min(65, prev.retention7 * 1.1);
      } else if (id === '2') {
        updated.retention30 = Math.min(45, prev.retention30 * 1.18);
      } else if (id === '3') {
        updated.dau = Math.floor(prev.dau * 1.12);
      } else if (id === '4') {
        updated.cac = prev.cac * 0.77;
      } else if (id === '5') {
        updated.arpu = prev.arpu * 1.35;
        updated.ltv = prev.ltv * 1.35;
      }
      
      return updated;
    });

    showToast(`已应用优化：${optimization.title}`);
  };

  // 保存快照
  const saveSnapshot = () => {
    const snapshot = {
      time: new Date().toLocaleString('zh-CN'),
      metrics: { ...metrics },
      config: { ...config },
    };
    setSnapshots(prev => [...prev, snapshot]);
    showToast('快照已保存 ✓');
  };

  // 清理定时器
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <div className="space-y-8">
      {/* 步骤指示器 */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between">
          {[
            { key: 'config', label: '投入配置', icon: 'ri-settings-3-line' },
            { key: 'tracking', label: '实时追踪', icon: 'ri-line-chart-line' },
            { key: 'optimization', label: '迭代优化', icon: 'ri-lightbulb-line' },
          ].map((s, index) => (
            <div key={s.key} className="flex items-center flex-1">
              <div
                onClick={() => setStep(s.key as any)}
                className={`flex items-center gap-3 cursor-pointer ${
                  step === s.key ? 'text-green-600' : 'text-gray-400'
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    step === s.key
                      ? 'bg-gradient-to-br from-green-500 to-emerald-500 text-white'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  <i className={`${s.icon} text-xl`}></i>
                </div>
                <div>
                  <div className="text-xs text-gray-500">步骤 {index + 1}</div>
                  <div className="text-sm font-bold">{s.label}</div>
                </div>
              </div>
              {index < 2 && (
                <div className="flex-1 h-0.5 bg-gray-200 mx-4"></div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 投入配置 */}
      {step === 'config' && (
        <div className="space-y-6">
          <div className="bg-green-50 border border-green-200 rounded-xl p-6">
            <h3 className="text-base font-bold text-green-900 mb-2">投入配置</h3>
            <p className="text-sm text-green-700">
              设置初始投入参数，系统将基于这些参数模拟市场表现
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-6">基础参数</h3>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-3">
                  推广预算（元）
                </label>
                <input
                  type="range"
                  min="10000"
                  max="200000"
                  step="5000"
                  value={config.budget}
                  onChange={(e) =>
                    setConfig({ ...config, budget: Number(e.target.value) })
                  }
                  className="w-full"
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-500">¥10,000</span>
                  <span className="text-lg font-bold text-green-600">
                    ¥{config.budget.toLocaleString()}
                  </span>
                  <span className="text-xs text-gray-500">¥200,000</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-3">
                  配送费定价（元/单）
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.5"
                  value={config.pricing}
                  onChange={(e) =>
                    setConfig({ ...config, pricing: Number(e.target.value) })
                  }
                  className="w-full"
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-500">¥1</span>
                  <span className="text-lg font-bold text-green-600">
                    ¥{config.pricing}
                  </span>
                  <span className="text-xs text-gray-500">¥10</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-3">
                  目标用户规模（人）
                </label>
                <input
                  type="range"
                  min="1000"
                  max="20000"
                  step="500"
                  value={config.targetUsers}
                  onChange={(e) =>
                    setConfig({ ...config, targetUsers: Number(e.target.value) })
                  }
                  className="w-full"
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-500">1,000</span>
                  <span className="text-lg font-bold text-green-600">
                    {config.targetUsers.toLocaleString()}
                  </span>
                  <span className="text-xs text-gray-500">20,000</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-6">渠道分配比例</h3>
            <div className="space-y-6">
              {[
                { key: 'online', label: '线上广告', icon: 'ri-global-line', color: 'blue' },
                { key: 'offline', label: '校园地推', icon: 'ri-store-3-line', color: 'green' },
                { key: 'social', label: '社交媒体', icon: 'ri-wechat-line', color: 'purple' },
                { key: 'kol', label: 'KOL合作', icon: 'ri-user-star-line', color: 'orange' },
              ].map((channel) => (
                <div key={channel.key}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <i className={`${channel.icon} text-${channel.color}-500`}></i>
                      <span className="text-sm font-medium text-gray-900">
                        {channel.label}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-gray-900">
                      {config.channels[channel.key as keyof typeof config.channels]}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={config.channels[channel.key as keyof typeof config.channels]}
                    onChange={(e) => {
                      const newValue = Number(e.target.value);
                      const others = Object.keys(config.channels).filter(
                        (k) => k !== channel.key
                      );
                      const remaining = 100 - newValue;
                      const avgOther = Math.floor(remaining / others.length);
                      
                      setConfig({
                        ...config,
                        channels: {
                          ...config.channels,
                          [channel.key]: newValue,
                          [others[0]]: avgOther,
                          [others[1]]: avgOther,
                          [others[2]]: remaining - avgOther * 2,
                        },
                      });
                    }}
                    className="w-full"
                  />
                  <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r from-${channel.color}-500 to-${channel.color}-600 rounded-full transition-all`}
                      style={{
                        width: `${config.channels[channel.key as keyof typeof config.channels]}%`,
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">总计</span>
                <span className="text-lg font-bold text-green-600">
                  {Object.values(config.channels).reduce((a, b) => a + b, 0)}%
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={startSimulation}
            className="w-full px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-base font-bold rounded-xl hover:shadow-lg transition-all whitespace-nowrap cursor-pointer flex items-center justify-center gap-2"
          >
            <i className="ri-play-circle-line text-xl"></i>
            开始模拟市场
          </button>
        </div>
      )}

      {/* 实时追踪 */}
      {step === 'tracking' && (
        <div className="space-y-6">
          {/* 模拟状态 */}
          <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-white/80 mb-1">模拟进度</div>
                <div className="text-3xl font-bold">第 {simulationDay} 天</div>
                <div className="text-xs text-white/80 mt-1">共30天模拟周期</div>
              </div>
              <div className="flex items-center gap-3">
                {isSimulating ? (
                  <button
                    onClick={stopSimulation}
                    className="px-6 py-3 bg-white/20 hover:bg-white/30 text-white text-sm font-medium rounded-xl transition-colors whitespace-nowrap cursor-pointer flex items-center gap-2"
                  >
                    <i className="ri-pause-circle-line"></i>
                    暂停模拟
                  </button>
                ) : (
                  <button
                    onClick={startSimulation}
                    className="px-6 py-3 bg-white/20 hover:bg-white/30 text-white text-sm font-medium rounded-xl transition-colors whitespace-nowrap cursor-pointer flex items-center gap-2"
                  >
                    <i className="ri-play-circle-line"></i>
                    继续模拟
                  </button>
                )}
                <button
                  onClick={saveSnapshot}
                  className="px-6 py-3 bg-white text-green-600 text-sm font-medium rounded-xl hover:bg-white/90 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-2"
                >
                  <i className="ri-camera-line"></i>
                  保存快照
                </button>
              </div>
            </div>
            <div className="mt-4 h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all"
                style={{ width: `${(simulationDay / 30) * 100}%` }}
              ></div>
            </div>
          </div>

          {/* 关键指标卡片 */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'DAU', value: metrics.dau.toLocaleString(), icon: 'ri-user-line', color: 'blue' },
              { label: 'MAU', value: metrics.mau.toLocaleString(), icon: 'ri-group-line', color: 'green' },
              { label: '7日留存', value: `${metrics.retention7.toFixed(1)}%`, icon: 'ri-heart-line', color: 'pink' },
              { label: '30日留存', value: `${metrics.retention30.toFixed(1)}%`, icon: 'ri-heart-fill', color: 'red' },
              { label: 'ARPU', value: `¥${metrics.arpu.toFixed(2)}`, icon: 'ri-money-dollar-circle-line', color: 'emerald' },
              { label: 'CAC', value: `¥${metrics.cac.toFixed(2)}`, icon: 'ri-price-tag-3-line', color: 'orange' },
              { label: 'LTV', value: `¥${metrics.ltv.toFixed(2)}`, icon: 'ri-vip-crown-line', color: 'purple' },
              { label: '当日收入', value: `¥${metrics.revenue.toLocaleString()}`, icon: 'ri-cash-line', color: 'teal' },
            ].map((metric, index) => (
              <div key={index} className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-gray-500">{metric.label}</span>
                  <div className={`w-8 h-8 bg-${metric.color}-100 rounded-lg flex items-center justify-center`}>
                    <i className={`${metric.icon} text-${metric.color}-600 text-sm`}></i>
                  </div>
                </div>
                <div className="text-2xl font-bold text-gray-900">{metric.value}</div>
              </div>
            ))}
          </div>

          {/* 用户增长曲线 */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-6">用户增长趋势</h3>
            <div className="h-64 flex items-end gap-1">
              {metrics.userGrowth.map((value, index) => {
                const maxValue = Math.max(...metrics.userGrowth);
                const height = (value / maxValue) * 100;
                return (
                  <div
                    key={index}
                    className="flex-1 bg-gradient-to-t from-green-500 to-emerald-400 rounded-t transition-all"
                    style={{ height: `${height}%` }}
                    title={`第${index + 1}天: ${value}`}
                  ></div>
                );
              })}
            </div>
            <div className="flex items-center justify-between mt-4 text-xs text-gray-500">
              <span>第1天</span>
              <span>第{metrics.userGrowth.length}天</span>
            </div>
          </div>

          {/* 转化漏斗 */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-6">转化漏斗</h3>
            <div className="space-y-4">
              {[
                { stage: '曝光用户', count: config.targetUsers * 3, percent: 100 },
                { stage: '点击下载', count: config.targetUsers * 1.5, percent: 50 },
                { stage: '注册用户', count: config.targetUsers, percent: 33 },
                { stage: '首次下单', count: Math.floor(config.targetUsers * 0.6), percent: 20 },
                { stage: '复购用户', count: Math.floor(config.targetUsers * 0.3), percent: 10 },
              ].map((item, index) => (
                <div key={index}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900">{item.stage}</span>
                    <span className="text-sm text-gray-600">
                      {item.count.toLocaleString()} ({item.percent}%)
                    </span>
                  </div>
                  <div className="h-12 bg-gray-100 rounded-lg overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold transition-all"
                      style={{ width: `${item.percent}%` }}
                    >
                      {item.percent}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => setStep('optimization')}
            className="w-full px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-base font-bold rounded-xl hover:shadow-lg transition-all whitespace-nowrap cursor-pointer flex items-center justify-center gap-2"
          >
            <i className="ri-lightbulb-line text-xl"></i>
            查看优化建议
          </button>
        </div>
      )}

      {/* 迭代优化 */}
      {step === 'optimization' && (
        <div className="space-y-6">
          <div className="bg-green-50 border border-green-200 rounded-xl p-6">
            <h3 className="text-base font-bold text-green-900 mb-2">AI优化建议</h3>
            <p className="text-sm text-green-700">
              基于当前数据表现，AI为您推荐以下优化方案，点击应用后可观察数据变化
            </p>
          </div>

          {/* 当前指标概览 */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">当前表现</h3>
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'DAU', value: metrics.dau.toLocaleString(), status: metrics.dau > 800 ? 'good' : 'warning' },
                { label: '7日留存', value: `${metrics.retention7.toFixed(1)}%`, status: metrics.retention7 > 40 ? 'good' : 'warning' },
                { label: 'ARPU', value: `¥${metrics.arpu.toFixed(2)}`, status: metrics.arpu > 15 ? 'good' : 'warning' },
                { label: 'CAC', value: `¥${metrics.cac.toFixed(2)}`, status: metrics.cac < 12 ? 'good' : 'warning' },
              ].map((item, index) => (
                <div key={index} className="text-center">
                  <div className="text-xs text-gray-500 mb-1">{item.label}</div>
                  <div className="text-xl font-bold text-gray-900">{item.value}</div>
                  <div className={`text-xs mt-1 ${item.status === 'good' ? 'text-green-600' : 'text-orange-600'}`}>
                    {item.status === 'good' ? '表现良好' : '有待提升'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 优化建议列表 */}
          <div className="space-y-4">
            {optimizations.map((opt) => (
              <div
                key={opt.id}
                className={`bg-white border-2 rounded-xl p-6 transition-all ${
                  opt.applied
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-200 hover:border-green-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          opt.applied
                            ? 'bg-green-500 text-white'
                            : 'bg-gradient-to-br from-blue-500 to-indigo-500 text-white'
                        }`}
                      >
                        <i
                          className={`${
                            opt.applied ? 'ri-checkbox-circle-line' : 'ri-lightbulb-flash-line'
                          } text-xl`}
                        ></i>
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-gray-900">{opt.title}</h4>
                        {opt.applied && (
                          <span className="text-xs text-green-600 font-medium">已应用</span>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{opt.description}</p>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <i className="ri-arrow-up-line text-green-600"></i>
                        <span className="text-sm text-gray-700">{opt.impact}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <i className="ri-money-dollar-circle-line text-orange-600"></i>
                        <span className="text-sm text-gray-700">成本 ¥{opt.cost.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => applyOptimization(opt.id)}
                    disabled={opt.applied}
                    className={`px-6 py-3 text-sm font-medium rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                      opt.applied
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:shadow-lg'
                    }`}
                  >
                    {opt.applied ? '已应用' : '应用优化'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* 快照对比 */}
          {snapshots.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6">历史快照对比</h3>
              <div className="space-y-4">
                {snapshots.map((snapshot, index) => (
                  <div key={index} className="border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-900">
                        快照 #{index + 1}
                      </span>
                      <span className="text-xs text-gray-500">{snapshot.time}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <div className="text-xs text-gray-500">DAU</div>
                        <div className="text-sm font-bold text-gray-900">
                          {snapshot.metrics.dau.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">7日留存</div>
                        <div className="text-sm font-bold text-gray-900">
                          {snapshot.metrics.retention7.toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">ARPU</div>
                        <div className="text-sm font-bold text-gray-900">
                          ¥{snapshot.metrics.arpu.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">收入</div>
                        <div className="text-sm font-bold text-gray-900">
                          ¥{snapshot.metrics.revenue.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={() => setStep('tracking')}
              className="flex-1 px-6 py-4 bg-gray-100 text-gray-700 text-base font-medium rounded-xl hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer flex items-center justify-center gap-2"
            >
              <i className="ri-arrow-left-line"></i>
              返回追踪
            </button>
            <button
              onClick={() => showToast('优化方案已保存 ✓')}
              className="flex-1 px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-base font-bold rounded-xl hover:shadow-lg transition-all whitespace-nowrap cursor-pointer flex items-center justify-center gap-2"
            >
              <i className="ri-save-line"></i>
              保存优化方案
            </button>
          </div>
        </div>
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