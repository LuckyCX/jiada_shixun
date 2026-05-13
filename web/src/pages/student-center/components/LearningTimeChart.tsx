
import { useState } from 'react';

interface DailyData {
  day: string;
  date: string;
  minutes: number;
}

interface WeeklyData {
  week: string;
  totalMinutes: number;
}

interface ModuleTimeData {
  moduleId: string;
  moduleName: string;
  minutes: number;
  color: string;
}

const dailyData: DailyData[] = [
  { day: '周一', date: '12/23', minutes: 45 },
  { day: '周二', date: '12/24', minutes: 72 },
  { day: '周三', date: '12/25', minutes: 30 },
  { day: '周四', date: '12/26', minutes: 95 },
  { day: '周五', date: '12/27', minutes: 60 },
  { day: '周六', date: '12/28', minutes: 110 },
  { day: '周日', date: '12/29', minutes: 85 },
];

const weeklyData: WeeklyData[] = [
  { week: '第1周', totalMinutes: 320 },
  { week: '第2周', totalMinutes: 415 },
  { week: '第3周', totalMinutes: 380 },
  { week: '第4周', totalMinutes: 497 },
];

const moduleTimeData: ModuleTimeData[] = [
  { moduleId: 'ideation', moduleName: '创新思维与创意生成', minutes: 185, color: 'from-teal-500 to-teal-600' },
  { moduleId: 'market', moduleName: '市场调研与用户画像', minutes: 240, color: 'from-green-500 to-green-600' },
  { moduleId: 'product', moduleName: '产品设计与原型', minutes: 160, color: 'from-orange-500 to-orange-600' },
  { moduleId: 'team', moduleName: '组队与团队管理', minutes: 120, color: 'from-purple-500 to-purple-600' },
  { moduleId: 'business', moduleName: '商业模式设计', minutes: 95, color: 'from-pink-500 to-pink-600' },
  { moduleId: 'simulation', moduleName: 'AI角色推荐与仿真', minutes: 72, color: 'from-indigo-500 to-indigo-600' },
  { moduleId: 'plan', moduleName: '商业计划书与PPT', minutes: 40, color: 'from-cyan-500 to-cyan-600' },
];

const formatMinutes = (minutes: number): string => {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h${m}m` : `${h}h`;
  }
  return `${minutes}m`;
};

export default function LearningTimeChart() {
  const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('daily');

  // 统计卡片数据
  const todayMinutes = dailyData[dailyData.length - 1].minutes;
  const weekTotal = dailyData.reduce((sum, d) => sum + d.minutes, 0);
  const monthTotal = weeklyData.reduce((sum, w) => sum + w.totalMinutes, 0);
  const avgDaily = Math.round(weekTotal / 7);

  const statCards = [
    { label: '今日学习', value: formatMinutes(todayMinutes), sub: `${todayMinutes} 分钟`, icon: 'ri-sun-line', color: 'from-teal-500 to-teal-600' },
    { label: '本周累计', value: formatMinutes(weekTotal), sub: `${weekTotal} 分钟`, icon: 'ri-calendar-week-line', color: 'from-cyan-500 to-cyan-600' },
    { label: '本月累计', value: formatMinutes(monthTotal), sub: `${monthTotal} 分钟`, icon: 'ri-calendar-line', color: 'from-green-500 to-green-600' },
    { label: '日均时长', value: formatMinutes(avgDaily), sub: `${avgDaily} 分钟/天`, icon: 'ri-time-line', color: 'from-orange-500 to-orange-600' },
  ];

  // 柱状图最大值
  const dailyMax = Math.max(...dailyData.map((d) => d.minutes));
  const weeklyMax = Math.max(...weeklyData.map((w) => w.totalMinutes));

  // 模块总时长
  const totalModuleMinutes = moduleTimeData.reduce((sum, m) => sum + m.minutes, 0);

  // Y轴刻度（按日）
  const dailyYTicks = [0, 30, 60, 90, 120];
  // Y轴刻度（按周）
  const weeklyYTicks = [0, 100, 200, 300, 400, 500];

  const chartHeight = 180;

  return (
    <div className="space-y-5">
      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-11 h-11 bg-gradient-to-br ${card.color} rounded-xl flex items-center justify-center`}>
                <i className={`${card.icon} text-xl text-white`}></i>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">{card.value}</div>
              </div>
            </div>
            <div className="text-sm font-semibold text-gray-700">{card.label}</div>
            <div className="text-xs text-gray-400 mt-0.5">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* 柱状图 / 折线图区域 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <i className="ri-bar-chart-2-line text-teal-600"></i>
            学习时长分布
          </h3>
          {/* 切换按钮 */}
          <div className="flex items-center bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setViewMode('daily')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap cursor-pointer ${
                viewMode === 'daily'
                  ? 'bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              按日
            </button>
            <button
              onClick={() => setViewMode('weekly')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap cursor-pointer ${
                viewMode === 'weekly'
                  ? 'bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              按周
            </button>
          </div>
        </div>

        {/* 按日柱状图 */}
        {viewMode === 'daily' && (
          <div className="flex gap-4">
            {/* Y轴 */}
            <div className="flex flex-col justify-between items-end pb-8" style={{ height: chartHeight + 32 }}>
              {[...dailyYTicks].reverse().map((tick) => (
                <span key={tick} className="text-xs text-gray-400 leading-none">{tick}m</span>
              ))}
            </div>
            {/* 图表主体 */}
            <div className="flex-1">
              <div className="flex items-end gap-3" style={{ height: chartHeight }}>
                {dailyData.map((item, i) => {
                  const barH = dailyMax > 0 ? Math.round((item.minutes / dailyMax) * chartHeight * 0.9) : 0;
                  const isToday = i === dailyData.length - 1;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end group relative" style={{ height: chartHeight }}>
                      {/* 顶部数值 */}
                      <span className="text-xs font-bold text-teal-600 mb-1 opacity-0 group-hover:opacity-100 transition-opacity absolute"
                        style={{ bottom: barH + 4 }}>
                        {item.minutes}m
                      </span>
                      {/* 柱子 */}
                      <div
                        className={`w-full rounded-t-lg transition-all duration-500 cursor-pointer ${
                          isToday
                            ? 'bg-gradient-to-t from-teal-600 to-cyan-400 shadow-md'
                            : 'bg-gradient-to-t from-teal-400/70 to-cyan-300/70 group-hover:from-teal-500 group-hover:to-cyan-400'
                        }`}
                        style={{ height: barH }}
                      />
                    </div>
                  );
                })}
              </div>
              {/* X轴标签 */}
              <div className="flex gap-3 mt-2">
                {dailyData.map((item, i) => {
                  const isToday = i === dailyData.length - 1;
                  return (
                    <div key={i} className="flex-1 text-center">
                      <div className={`text-xs font-semibold ${isToday ? 'text-teal-600' : 'text-gray-500'}`}>{item.day}</div>
                      <div className="text-xs text-gray-400">{item.date}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 按周折线图（SVG） */}
        {viewMode === 'weekly' && (
          <div className="flex gap-4">
            {/* Y轴 */}
            <div className="flex flex-col justify-between items-end pb-8" style={{ height: chartHeight + 32 }}>
              {[...weeklyYTicks].reverse().map((tick) => (
                <span key={tick} className="text-xs text-gray-400 leading-none">{tick}m</span>
              ))}
            </div>
            {/* SVG折线图 */}
            <div className="flex-1 relative">
              <svg
                width="100%"
                height={chartHeight}
                viewBox={`0 0 400 ${chartHeight}`}
                preserveAspectRatio="none"
                className="overflow-visible"
              >
                {/* 网格线 */}
                {weeklyYTicks.map((tick) => {
                  const y = chartHeight - (tick / weeklyMax) * chartHeight * 0.9;
                  return (
                    <line
                      key={tick}
                      x1="0"
                      y1={y}
                      x2="400"
                      y2={y}
                      stroke="#f3f4f6"
                      strokeWidth="1"
                    />
                  );
                })}

                {/* 渐变填充 */}
                <defs>
                  <linearGradient id="weeklyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(20,184,166)" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="rgb(20,184,166)" stopOpacity="0.02" />
                  </linearGradient>
                </defs>

                {/* 填充区域 */}
                {(() => {
                  const pts = weeklyData.map((w, i) => {
                    const x = (i / (weeklyData.length - 1)) * 400;
                    const y = chartHeight - (w.totalMinutes / weeklyMax) * chartHeight * 0.9;
                    return { x, y };
                  });
                  const areaPath = `M${pts[0].x},${chartHeight} ` +
                    pts.map((p) => `L${p.x},${p.y}`).join(' ') +
                    ` L${pts[pts.length - 1].x},${chartHeight} Z`;
                  return <path d={areaPath} fill="url(#weeklyGrad)" />;
                })()}

                {/* 折线 */}
                {(() => {
                  const pts = weeklyData.map((w, i) => {
                    const x = (i / (weeklyData.length - 1)) * 400;
                    const y = chartHeight - (w.totalMinutes / weeklyMax) * chartHeight * 0.9;
                    return `${x},${y}`;
                  });
                  return (
                    <polyline
                      points={pts.join(' ')}
                      fill="none"
                      stroke="rgb(20,184,166)"
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  );
                })()}

                {/* 数据点 */}
                {weeklyData.map((w, i) => {
                  const x = (i / (weeklyData.length - 1)) * 400;
                  const y = chartHeight - (w.totalMinutes / weeklyMax) * chartHeight * 0.9;
                  return (
                    <g key={i}>
                      <circle cx={x} cy={y} r="6" fill="white" stroke="rgb(20,184,166)" strokeWidth="2.5" />
                      <text
                        x={x}
                        y={y - 12}
                        textAnchor="middle"
                        fontSize="11"
                        fill="rgb(15,118,110)"
                        fontWeight="700"
                      >
                        {formatMinutes(w.totalMinutes)}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* X轴标签 */}
              <div className="flex mt-2">
                {weeklyData.map((w, i) => (
                  <div key={i} className="flex-1 text-center">
                    <div className="text-xs font-semibold text-gray-600">{w.week}</div>
                    <div className="text-xs text-gray-400">{formatMinutes(w.totalMinutes)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 各模块学习时长占比 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-base font-bold text-gray-900 mb-5 flex items-center gap-2">
          <i className="ri-pie-chart-line text-teal-600"></i>
          各模块学习时长占比
        </h3>
        <div className="space-y-3">
          {moduleTimeData.map((mod) => {
            const pct = totalModuleMinutes > 0 ? Math.round((mod.minutes / totalModuleMinutes) * 100) : 0;
            return (
              <div key={mod.moduleId} className="flex items-center gap-4">
                <div className="w-32 text-xs font-medium text-gray-600 text-right flex-shrink-0 truncate">{mod.moduleName}</div>
                <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r ${mod.color} rounded-full transition-all duration-700`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="w-20 flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-xs font-bold text-gray-700">{pct}%</span>
                  <span className="text-xs text-gray-400">{formatMinutes(mod.minutes)}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <span>共 {moduleTimeData.length} 个模块</span>
          <span>
            总计 <strong className="text-teal-600">{formatMinutes(totalModuleMinutes)}</strong>
            （{totalModuleMinutes} 分钟）
          </span>
        </div>
      </div>
    </div>
  );
}
