import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { courseCompletionStats, moduleCompletionRates, teamProgressDistribution } from './mockData';
import { SHARED_COURSE_CHAPTERS } from '../../../../mocks/courseChapters';
import { fetchAdminOverview, type AdminOverviewResponse } from '../../../../lib/adminOverviewApi';

type TimeRange = '7days' | '30days';

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  date: string;
  value: number;
}

// 从共享数据实时计算课程统计
const totalChapters = SHARED_COURSE_CHAPTERS.length;
const totalSections = SHARED_COURSE_CHAPTERS.reduce((sum, ch) => sum + ch.sections.length, 0);
const publishedSections = SHARED_COURSE_CHAPTERS.reduce((sum, ch) => sum + ch.sections.filter(s => s.published).length, 0);
const totalResources = SHARED_COURSE_CHAPTERS.reduce(
  (sum, ch) => sum + ch.sections.reduce((s2, sec) => s2 + sec.resources.length, 0), 0
);
const videoCount = SHARED_COURSE_CHAPTERS.reduce(
  (sum, ch) => sum + ch.sections.reduce((s2, sec) => s2 + sec.resources.filter(r => r.type === 'video').length, 0), 0
);
const pdfCount = SHARED_COURSE_CHAPTERS.reduce(
  (sum, ch) => sum + ch.sections.reduce((s2, sec) => s2 + sec.resources.filter(r => r.type === 'pdf').length, 0), 0
);

export default function Overview() {
  const [timeRange, setTimeRange] = useState<TimeRange>('7days');
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, date: '', value: 0 });
  const [hoveredCourse, setHoveredCourse] = useState<number | null>(null);
  const [hoveredResource, setHoveredResource] = useState<number | null>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);

  const [overviewData, setOverviewData] = useState<AdminOverviewResponse>({
    stats: { students: 0, teachers: 0, classes: 0, activeTeams: 0 },
    activityTrends: [],
    recentOperations: [],
  });
  const currentTrends = overviewData.activityTrends;
  const maxValue = currentTrends.length ? Math.max(...currentTrends.map(t => t.value)) : 0;

  useEffect(() => {
    let cancelled = false;
    void fetchAdminOverview(timeRange)
      .then((r) => {
        if (!cancelled) setOverviewData(r);
      })
      .catch(() => {
        if (!cancelled) {
          setOverviewData({
            stats: { students: 0, teachers: 0, classes: 0, activeTeams: 0 },
            activityTrends: [],
            recentOperations: [],
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [timeRange]);

  const userStats = useMemo(
    () => [
      {
        label: '学生总数',
        value: Number(overviewData.stats.students || 0).toLocaleString(),
        icon: 'ri-user-line',
        iconColor: 'text-teal-500',
        bgColor: 'bg-teal-50',
        trend: null,
      },
      {
        label: '教师总数',
        value: Number(overviewData.stats.teachers || 0).toLocaleString(),
        icon: 'ri-user-star-line',
        iconColor: 'text-indigo-500',
        bgColor: 'bg-indigo-50',
        trend: null,
      },
      {
        label: '班级总数',
        value: Number(overviewData.stats.classes || 0).toLocaleString(),
        icon: 'ri-group-line',
        iconColor: 'text-green-500',
        bgColor: 'bg-green-50',
        trend: null,
      },
      {
        label: '活跃团队',
        value: Number(overviewData.stats.activeTeams || 0).toLocaleString(),
        icon: 'ri-team-line',
        iconColor: 'text-orange-500',
        bgColor: 'bg-orange-50',
        trend: null,
      },
    ],
    [overviewData.stats]
  );

  const resourceItems = [
    { label: '视频课件', count: videoCount, icon: 'ri-video-line', color: 'text-red-500', bg: 'bg-red-50', bar: 'bg-red-400', barHover: 'bg-red-500' },
    { label: 'PDF文档', count: pdfCount, icon: 'ri-file-pdf-line', color: 'text-teal-500', bg: 'bg-teal-50', bar: 'bg-teal-400', barHover: 'bg-teal-500' },
    { label: '其他资源', count: totalResources - videoCount - pdfCount, icon: 'ri-file-line', color: 'text-gray-500', bg: 'bg-gray-50', bar: 'bg-gray-400', barHover: 'bg-gray-500' },
  ];

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (currentTrends.length === 0 || maxValue <= 0) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const relXRatio = relX / rect.width;
    const segmentWidth = 1 / (currentTrends.length - 1);
    const idx = Math.round(relXRatio / segmentWidth);
    const clampedIdx = Math.max(0, Math.min(idx, currentTrends.length - 1));
    const point = currentTrends[clampedIdx];
    const pointX = (clampedIdx / (currentTrends.length - 1)) * rect.width;
    const pointY = (1 - point.value / maxValue) * rect.height;

    // tooltip 相对于 svg 容器的位置
    const containerRect = svgContainerRef.current?.getBoundingClientRect();
    const tooltipX = containerRect ? e.clientX - containerRect.left : pointX;
    const tooltipY = containerRect ? e.clientY - containerRect.top : pointY;

    setTooltip({ visible: true, x: tooltipX, y: tooltipY, date: point.date, value: point.value });
    setActivePointIdx(clampedIdx);
  };

  const [activePointIdx, setActivePointIdx] = useState<number | null>(null);

  const handleSvgMouseLeave = () => {
    setTooltip(prev => ({ ...prev, visible: false }));
    setActivePointIdx(null);
  };

  return (
    <div className="space-y-6">
      {/* 用户核心指标 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {userStats.map((stat, index) => (
          <div
            key={index}
            className="bg-white rounded-xl p-5 border border-gray-100 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                <i className={`${stat.icon} ${stat.iconColor} text-lg`}></i>
              </div>
              {stat.trend && (
                <span className={`text-xs px-2 py-1 rounded-full ${
                  stat.trend.startsWith('+') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                }`}>
                  {stat.trend}
                </span>
              )}
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">{stat.value}</div>
            <div className="text-sm text-gray-500">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* 课程内容统计区块 */}
      {/* <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <i className="ri-book-2-line text-teal-500"></i>
            课程内容统计
          </h3>
        </div>
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { label: '课程章节', value: totalChapters, icon: 'ri-book-line', bg: 'bg-teal-50', iconCls: 'text-teal-500', valCls: 'text-teal-700', desc: '已创建章节' },
            { label: '已发布小节', value: `${publishedSections}/${totalSections}`, icon: 'ri-checkbox-circle-line', bg: 'bg-green-50', iconCls: 'text-green-500', valCls: 'text-green-700', desc: '发布/总小节' },
            { label: '课件资源', value: totalResources, icon: 'ri-folder-open-line', bg: 'bg-orange-50', iconCls: 'text-orange-500', valCls: 'text-orange-700', desc: '全部课件' },
            { label: '本月新增用户', value: '428', icon: 'ri-user-add-line', bg: 'bg-pink-50', iconCls: 'text-pink-500', valCls: 'text-pink-700', desc: '较上月 +24%' },
          ].map((item, i) => (
            <div key={i} className={`${item.bg} rounded-xl p-4`}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                  <i className={`${item.icon} ${item.iconCls} text-base`}></i>
                </div>
                <span className="text-xs text-gray-500">{item.label}</span>
              </div>
              <div className={`text-2xl font-bold ${item.valCls} mb-0.5`}>{item.value}</div>
              <div className="text-xs text-gray-400">{item.desc}</div>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-100 pt-4">
          <div className="text-xs font-medium text-gray-500 mb-3">课件类型分布</div>
          <div className="flex items-center gap-6">
            {resourceItems.map((item, i) => {
              const pct = totalResources > 0 ? Math.round((item.count / totalResources) * 100) : 0;
              const isHovered = hoveredResource === i;
              return (
                <div
                  key={i}
                  className="flex-1 cursor-default"
                  onMouseEnter={() => setHoveredResource(i)}
                  onMouseLeave={() => setHoveredResource(null)}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-6 h-6 ${item.bg} rounded flex items-center justify-center`}>
                        <i className={`${item.icon} ${item.color} text-xs`}></i>
                      </div>
                      <span className="text-xs text-gray-600">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isHovered && (
                        <span className="text-xs text-gray-400 transition-all">{pct}%</span>
                      )}
                      <span className={`text-xs font-bold transition-colors ${isHovered ? 'text-teal-600' : 'text-gray-700'}`}>
                        {item.count}
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${isHovered ? item.barHover : item.bar}`}
                      style={{ width: `${pct}%`, transform: isHovered ? 'scaleY(1.3)' : 'scaleY(1)', transformOrigin: 'center' }}
                    ></div>
                  </div>
                  {isHovered && (
                    <div className="mt-1 text-xs text-gray-400">
                      占总课件 {pct}%
                    </div>
                  )}
                </div>
              );
            })}
          </div> 
        </div>
      </div>*/}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 平台活跃度趋势图 */}
        <div className="lg:col-span-2 bg-white rounded-xl p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-base font-semibold text-gray-900">平台活跃度趋势</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setTimeRange('7days')}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  timeRange === '7days' ? 'bg-teal-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                近7天
              </button>
              <button
                onClick={() => setTimeRange('30days')}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  timeRange === '30days' ? 'bg-teal-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                近30天
              </button>
            </div>
          </div>
          <div className="relative h-64" ref={svgContainerRef}>
            {/* Y轴标签 */}
            <div className="absolute left-0 top-0 bottom-8 w-12 flex flex-col justify-between text-xs text-gray-500">
              <span>{maxValue}</span>
              <span>{Math.floor(maxValue * 0.75)}</span>
              <span>{Math.floor(maxValue * 0.5)}</span>
              <span>{Math.floor(maxValue * 0.25)}</span>
              <span>0</span>
            </div>
            {/* 图表区域 */}
            <div className="absolute left-14 right-0 top-0 bottom-8">
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                {[0, 1, 2, 3, 4].map(i => (
                  <div key={i} className="border-t border-gray-100"></div>
                ))}
              </div>
              <svg
                className="w-full h-full cursor-crosshair"
                preserveAspectRatio="none"
                onMouseMove={handleSvgMouseMove}
                onMouseLeave={handleSvgMouseLeave}
              >
                {/* 渐变填充 */}
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#14B8A6" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#14B8A6" stopOpacity="0.01" />
                  </linearGradient>
                </defs>
                {/* 面积填充 */}
                <polygon
                  points={[
                    ...currentTrends.map((point, index) => {
                      const x = (index / (currentTrends.length - 1)) * 100;
                      const y = maxValue > 0 ? 100 - (point.value / maxValue) * 100 : 100;
                      return `${x}%,${y}%`;
                    }),
                    '100%,100%',
                    '0%,100%'
                  ].join(' ')}
                  fill="url(#areaGradient)"
                />
                {/* 折线 */}
                <polyline
                  points={currentTrends.map((point, index) => {
                    const x = (index / (currentTrends.length - 1)) * 100;
                    const y = maxValue > 0 ? 100 - (point.value / maxValue) * 100 : 100;
                    return `${x}%,${y}%`;
                  }).join(' ')}
                  fill="none"
                  stroke="#14B8A6"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
                {/* 悬停竖线 */}
                {activePointIdx !== null && (() => {
                  const x = (activePointIdx / (currentTrends.length - 1)) * 100;
                  return (
                    <line
                      x1={`${x}%`} y1="0%"
                      x2={`${x}%`} y2="100%"
                      stroke="#14B8A6"
                      strokeWidth="1"
                      strokeDasharray="4,3"
                      vectorEffect="non-scaling-stroke"
                      opacity="0.5"
                    />
                  );
                })()}
                {/* 数据点 */}
                {currentTrends.map((point, index) => {
                  const x = (index / (currentTrends.length - 1)) * 100;
                  const y = maxValue > 0 ? 100 - (point.value / maxValue) * 100 : 100;
                  const isActive = activePointIdx === index;
                  return (
                    <g key={index}>
                      {isActive && (
                        <circle
                          cx={`${x}%`} cy={`${y}%`}
                          r="8"
                          fill="#14B8A6"
                          opacity="0.15"
                          vectorEffect="non-scaling-stroke"
                        />
                      )}
                      <circle
                        cx={`${x}%`} cy={`${y}%`}
                        r={isActive ? 5 : 4}
                        fill={isActive ? '#0d9488' : '#14B8A6'}
                        stroke="white"
                        strokeWidth="2"
                        vectorEffect="non-scaling-stroke"
                        style={{ transition: 'r 0.15s' }}
                      />
                    </g>
                  );
                })}
              </svg>
            </div>
            {/* X轴标签：近7天每天一个，近30天每3天一个 */}
            <div className="absolute left-14 right-0 bottom-0 h-8 text-xs text-gray-500">
              {currentTrends.map((point, index) => {
                const lastIdx = currentTrends.length - 1;
                if (timeRange === '30days') {
                  const showEvery3 = index % 3 === 0;
                  const showLast = index === lastIdx && lastIdx % 3 !== 0;
                  if (!showEvery3 && !showLast) return null;
                }
                const xPct = lastIdx <= 0 ? 0 : (index / lastIdx) * 100;
                return (
                  <span
                    key={index}
                    className={`absolute bottom-0 -translate-x-1/2 whitespace-nowrap transition-colors ${
                      activePointIdx === index ? 'text-teal-600 font-semibold' : ''
                    }`}
                    style={{ left: `${xPct}%` }}
                  >
                    {point.date}
                  </span>
                );
              })}
            </div>
            {/* Tooltip */}
            {tooltip.visible && (
              <div
                className="absolute z-20 pointer-events-none"
                style={{
                  left: tooltip.x + 12,
                  top: tooltip.y - 36,
                  transform: tooltip.x > 200 ? 'translateX(-110%)' : 'none',
                }}
              >
                <div className="bg-gray-900/90 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap">
                  <div className="font-semibold text-teal-300 mb-0.5">{tooltip.date}</div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-teal-400 inline-block"></span>
                    活跃用户：<span className="font-bold text-white">{tooltip.value.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 快捷入口 */}
        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <h3 className="text-base font-semibold text-gray-900 mb-4">快捷入口</h3>
          <div className="space-y-3">
            <Link
              to="/admin-dashboard?tab=college-management"
              className="flex items-center gap-3 p-3 rounded-lg bg-teal-50 hover:bg-teal-100 transition-colors group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-lg bg-teal-500 flex items-center justify-center">
                <i className="ri-building-4-line text-white text-lg"></i>
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">学院管理</div>
                <div className="text-xs text-gray-500">维护学院并管理教师账号</div>
              </div>
              <i className="ri-arrow-right-s-line text-gray-400 group-hover:text-teal-500 transition-colors"></i>
            </Link>
            <Link
              to="/admin-dashboard?tab=class-management"
              className="flex items-center gap-3 p-3 rounded-lg bg-indigo-50 hover:bg-indigo-100 transition-colors group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-lg bg-indigo-500 flex items-center justify-center">
                <i className="ri-team-line text-white text-lg"></i>
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">班级管理</div>
                <div className="text-xs text-gray-500">创建和管理班级</div>
              </div>
              <i className="ri-arrow-right-s-line text-gray-400 group-hover:text-indigo-500 transition-colors"></i>
            </Link>
            <Link
              to="/admin-dashboard?tab=dictionary"
              className="flex items-center gap-3 p-3 rounded-lg bg-orange-50 hover:bg-orange-100 transition-colors group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-lg bg-orange-500 flex items-center justify-center">
                <i className="ri-booklet-line text-white text-lg"></i>
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">字典管理</div>
                <div className="text-xs text-gray-500">维护数据字典与业务枚举</div>
              </div>
              <i className="ri-arrow-right-s-line text-gray-400 group-hover:text-orange-500 transition-colors"></i>
            </Link>
          </div>
        </div>
      </div>

      {/* <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <h3 className="text-base font-semibold text-gray-900 mb-4">课程完成率统计</h3>
          <div className="space-y-4">
            {courseCompletionStats.map((course, index) => {
              const isHovered = hoveredCourse === index;
              return (
                <div
                  key={index}
                  className={`rounded-lg p-2 -mx-2 transition-colors cursor-default ${isHovered ? 'bg-gray-50' : ''}`}
                  onMouseEnter={() => setHoveredCourse(index)}
                  onMouseLeave={() => setHoveredCourse(null)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-medium transition-colors ${isHovered ? 'text-teal-700' : 'text-gray-900'}`}>
                      {course.name}
                    </span>
                    <div className="flex items-center gap-2">
                      {isHovered && (
                        <span className="text-xs text-gray-400">
                          已完成 {course.completed} / 共 {course.total} 人
                        </span>
                      )}
                      <span className={`text-sm font-semibold transition-colors ${
                        course.rate >= 80 ? 'text-green-600' :
                        course.rate >= 60 ? 'text-teal-600' :
                        course.rate >= 40 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {course.rate}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        course.rate >= 80 ? 'bg-green-500' :
                        course.rate >= 60 ? 'bg-teal-500' :
                        course.rate >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{
                        width: `${course.rate}%`,
                        height: isHovered ? '10px' : '8px',
                        transition: 'height 0.2s, width 0.3s'
                      }}
                    ></div>
                  </div>
                  {isHovered && (
                    <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-400">
                      <span>未完成：{course.total - course.completed} 人</span>
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        course.rate >= 80 ? 'bg-green-50 text-green-600' :
                        course.rate >= 60 ? 'bg-teal-50 text-teal-600' :
                        course.rate >= 40 ? 'bg-yellow-50 text-yellow-600' : 'bg-red-50 text-red-600'
                      }`}>
                        {course.rate >= 80 ? '优秀' : course.rate >= 60 ? '良好' : course.rate >= 40 ? '一般' : '待提升'}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div> */}

        {/* 最近操作日志 */}
        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900">最近操作日志</h3>
            <Link
              to="/admin-dashboard?tab=operation-log"
              className="text-xs text-teal-600 hover:text-teal-700 flex items-center gap-1 transition-colors"
            >
              查看全部 <i className="ri-arrow-right-s-line"></i>
            </Link>
          </div>
          <div className="space-y-4">
            {overviewData.recentOperations.slice(0, 3).map((operation, index) => (
              <div key={index} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full ${operation.bgColor} flex items-center justify-center flex-shrink-0`}>
                    <i className={`${operation.icon} ${operation.iconColor} text-sm`}></i>
                  </div>
                  {index < 2 && (
                    <div className="w-px h-full bg-gray-200 mt-2"></div>
                  )}
                </div>
                <div className="flex-1 pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm text-gray-900">{operation.action}</span>
                    {operation.typeLabel && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600 whitespace-nowrap">
                        {operation.typeLabel}
                      </span>
                    )}
                  </div>
                  {operation.detail && (
                    <div className="text-xs text-gray-500 line-clamp-1">{operation.detail}</div>
                  )}
                  <div className="text-xs text-gray-400 mt-0.5">{operation.operator} · {operation.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
       </div>
  );
}

// 模块完成率行组件
function ModuleRateRow({ item }: { item: typeof moduleCompletionRates[0] }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className={`rounded-lg px-2 py-1.5 -mx-2 transition-colors cursor-default ${hovered ? 'bg-gray-50' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <div className={`w-6 h-6 ${item.bg} rounded flex items-center justify-center`}>
            <i className={`${item.icon} ${item.color} text-xs`}></i>
          </div>
          <span className="text-xs text-gray-700">{item.module}</span>
        </div>
        <div className="flex items-center gap-2">
          {hovered && (
            <span className="text-xs text-gray-400">{item.completed}/{item.total} 团队</span>
          )}
          <span className={`text-xs font-bold transition-colors ${hovered ? 'text-teal-600' : 'text-gray-700'}`}>
            {item.rate}%
          </span>
        </div>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${item.bar}`}
          style={{ width: `${item.rate}%`, opacity: hovered ? 1 : 0.85 }}
        ></div>
      </div>
    </div>
  );
}

// 团队进度分布图组件
function TeamProgressChart({ data, total }: { data: typeof teamProgressDistribution; total: number }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const maxCount = Math.max(...data.map(d => d.count));

  return (
    <div>
      {/* 柱状图 */}
      <div className="flex items-end gap-3 h-36 mb-3">
        {data.map((item, i) => {
          const heightPct = (item.count / maxCount) * 100;
          const isHovered = hoveredIdx === i;
          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center gap-1 cursor-default"
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {isHovered && (
                <div className="bg-gray-900/90 text-white text-xs rounded px-2 py-1 whitespace-nowrap mb-1 shadow-lg">
                  <div className={`font-semibold ${item.textColor.replace('text-', 'text-').replace('500', '300').replace('600', '300')}`}>{item.label}</div>
                  <div>{item.count} 个团队</div>
                  <div className="text-gray-300">{Math.round((item.count / total) * 100)}%</div>
                </div>
              )}
              <div className="w-full relative" style={{ height: `${heightPct}%`, minHeight: 8 }}>
                <div
                  className={`w-full h-full rounded-t-md transition-all duration-300 ${item.color} ${isHovered ? 'opacity-100 scale-105' : 'opacity-80'}`}
                  style={{ transformOrigin: 'bottom' }}
                ></div>
              </div>
              <span className={`text-xs font-semibold transition-colors ${isHovered ? item.textColor : 'text-gray-600'}`}>
                {item.count}
              </span>
            </div>
          );
        })}
      </div>
      {/* 图例 */}
      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        {data.map((item, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-sm ${item.color}`}></div>
            <span className="text-xs text-gray-500">{item.label}</span>
            <span className="text-xs text-gray-400">({item.range})</span>
          </div>
        ))}
      </div>
    </div>
  );
}
