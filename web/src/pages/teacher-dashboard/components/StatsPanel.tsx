import { useEffect, useState } from 'react';
import { fetchTeacherMonitorStats } from '../../../lib/teacherMonitorApi';

interface TeamProject {
  id: number;
  teamName: string;
  status: 'on-track' | 'at-risk' | 'delayed';
  overallProgress: number;
  currentStage: string;
  abilityPoints: number;
  warnings: string[];
  evaluationStatus: 'pending' | 'reviewed' | 'passed';
}

interface StatsPanelProps {
  classId: string;
  teams: TeamProject[];
}

const stageColors: Record<string, string> = {
  '组队': 'bg-purple-500',
  '创新思维': 'bg-yellow-500',
  '市场调研': 'bg-teal-500',
  '产品设计': 'bg-green-500',
  '商业模式': 'bg-indigo-500',
  '角色推荐': 'bg-orange-500',
  '商业计划': 'bg-cyan-500',
  '已完成': 'bg-emerald-500',
};

function todayLabelZh() {
  const w = new Date().getDay(); // 0 Sun
  return w === 0 ? '周日' : w === 1 ? '周一' : w === 2 ? '周二' : w === 3 ? '周三' : w === 4 ? '周四' : w === 5 ? '周五' : '周六';
}

export default function StatsPanel({ classId, teams }: StatsPanelProps) {
  const [showAllWarnings, setShowAllWarnings] = useState(false);
  const [weeklyActivityData, setWeeklyActivityData] = useState<{ day: string; value: number }[]>([]);

  useEffect(() => {
    if (!classId) {
      setWeeklyActivityData([]);
      return;
    }
    fetchTeacherMonitorStats(classId)
      .then((r) => {
        setWeeklyActivityData(Array.isArray(r.weeklyActivityData) ? r.weeklyActivityData : []);
      })
      .catch(() => setWeeklyActivityData([]));
  }, [classId]);

  const onTrack = teams.filter(t => t.status === 'on-track').length;
  const atRisk = teams.filter(t => t.status === 'at-risk').length;
  const delayed = teams.filter(t => t.status === 'delayed').length;
  const pendingEval = teams.filter(t => t.evaluationStatus === 'pending').length;

  const stageDist = teams.reduce<Record<string, number>>((acc, t) => {
    acc[t.currentStage] = (acc[t.currentStage] || 0) + 1;
    return acc;
  }, {});

  const topAbility = [...teams]
    .sort((a, b) => b.abilityPoints - a.abilityPoints)
    .slice(0, 5);

  const warningTeams = teams.filter(t => t.warnings.length > 0);
  const displayWarnings = showAllWarnings ? warningTeams : warningTeams.slice(0, 4);

  const avgProgress = teams.length
    ? Math.round(teams.reduce((s, t) => s + t.overallProgress, 0) / teams.length)
    : 0;

  // 计算本周活跃度最大值用于归一化
  const maxActivity = weeklyActivityData.length ? Math.max(...weeklyActivityData.map(d => d.value)) : 0;
  const todayLabel = todayLabelZh();
  const avgWeeklyActivity = weeklyActivityData.length
    ? Math.round(weeklyActivityData.reduce((sum, d) => sum + d.value, 0) / weeklyActivityData.length)
    : 0;

  return (
    <div className="space-y-4">
      {/* 总览 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 flex items-center justify-center bg-gradient-to-br from-teal-500 to-cyan-500 rounded-lg">
            <i className="ri-dashboard-line text-white text-sm"></i>
          </div>
          <h3 className="text-sm font-bold text-gray-900">项目总览</h3>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">总项目数</span>
            <span className="text-2xl font-bold text-gray-900">{teams.length}</span>
          </div>
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full transition-all duration-700"
              style={{ width: `${avgProgress}%` }}
            />
          </div>
          <div className="text-xs text-gray-400 text-right">平均进度 {avgProgress}%</div>
          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className="text-center bg-green-50 rounded-xl py-2">
              <div className="text-lg font-bold text-green-600">{onTrack}</div>
              <div className="text-xs text-green-500">正常</div>
            </div>
            <div className="text-center bg-orange-50 rounded-xl py-2">
              <div className="text-lg font-bold text-orange-500">{atRisk}</div>
              <div className="text-xs text-orange-400">预警</div>
            </div>
            <div className="text-center bg-red-50 rounded-xl py-2">
              <div className="text-lg font-bold text-red-500">{delayed}</div>
              <div className="text-xs text-red-400">滞后</div>
            </div>
          </div>
          {/* {pendingEval > 0 && (
            // <div className="flex items-center justify-between bg-amber-50 rounded-xl px-3 py-2">
            //   <div className="flex items-center gap-2">
            //     <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            //     <span className="text-xs text-amber-700">待评价</span>
            //   </div>
            //   <span className="text-sm font-bold text-amber-600">{pendingEval} 组</span>
            // </div>
          )} */}
        </div>
      </div>

      {/* 本周活跃度 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
            <i className="ri-line-chart-line text-white text-sm"></i>
          </div>
          <h3 className="text-sm font-bold text-gray-900">本周活跃度</h3>
        </div>
        <div className="space-y-3">
          {/* 迷你折线图 */}
          <div className="relative h-24 flex items-end justify-between gap-1">
            {weeklyActivityData.map((data, index) => {
              const height = maxActivity > 0 ? (data.value / maxActivity) * 100 : 0;
              const isToday = data.day === todayLabel;
              return (
                <div key={index} className="flex-1 flex flex-col items-center gap-1 group">
                  {/* 数值标签（悬停显示） */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold text-teal-600 mb-1">
                    {data.value}
                  </div>
                  {/* 柱状图 */}
                  <div className="w-full relative flex items-end" style={{ height: '64px' }}>
                    <div
                      className={`w-full rounded-t-md transition-all duration-300 ${
                        isToday 
                          ? 'bg-gradient-to-t from-teal-500 to-cyan-400' 
                          : 'bg-gradient-to-t from-gray-300 to-gray-200'
                      } group-hover:from-teal-400 group-hover:to-cyan-300`}
                      style={{ height: `${height}%` }}
                    ></div>
                  </div>
                  {/* 日期标签 */}
                  <span className={`text-xs ${isToday ? 'text-teal-600 font-bold' : 'text-gray-400'}`}>
                    {data.day}
                  </span>
                </div>
              );
            })}
          </div>
          {/* 统计信息 */}
          <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
            <span className="text-gray-500">平均活跃度</span>
            <span className="font-bold text-teal-600">
              {avgWeeklyActivity}
            </span>
          </div>
        </div>
      </div>

      {/* 阶段分布 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg">
            <i className="ri-pie-chart-line text-white text-sm"></i>
          </div>
          <h3 className="text-sm font-bold text-gray-900">阶段分布</h3>
        </div>
        <div className="space-y-2">
          {Object.entries(stageDist).map(([stage, count]) => (
            <div key={stage} className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${stageColors[stage] || 'bg-gray-400'}`}></span>
              <span className="text-xs text-gray-600 flex-1 truncate">{stage}</span>
              <div className="flex items-center gap-1.5">
                <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${stageColors[stage] || 'bg-gray-400'}`}
                    style={{ width: `${teams.length ? (count / teams.length) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-gray-700 w-4 text-right">{count}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 重点关注预警 */}
      {warningTeams.length > 0 && (
        <div className="bg-white rounded-2xl border border-red-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 flex items-center justify-center bg-gradient-to-br from-red-500 to-rose-500 rounded-lg">
                <i className="ri-alarm-warning-line text-white text-sm"></i>
              </div>
              <h3 className="text-sm font-bold text-gray-900">重点关注</h3>
            </div>
            <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs font-bold rounded-full">
              {warningTeams.length}
            </span>
          </div>
          <div className="space-y-2">
            {displayWarnings.map(team => (
              <div key={team.id} className={`rounded-xl p-3 ${team.status === 'delayed' ? 'bg-red-50' : 'bg-orange-50'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <i className={`text-xs ${team.status === 'delayed' ? 'ri-error-warning-fill text-red-500' : 'ri-alert-fill text-orange-500'}`}></i>
                  <span className="text-xs font-bold text-gray-800">{team.teamName}</span>
                </div>
                {team.warnings.slice(0, 1).map((w, i) => (
                  <p key={i} className="text-xs text-gray-600 pl-4">{w}</p>
                ))}
              </div>
            ))}
          </div>
          {warningTeams.length > 4 && (
            <button
              onClick={() => setShowAllWarnings(!showAllWarnings)}
              className="w-full mt-3 text-xs text-teal-600 hover:text-teal-700 font-medium cursor-pointer"
            >
              {showAllWarnings ? '收起' : `查看全部 ${warningTeams.length} 条预警`}
            </button>
          )}
        </div>
      )}

      {/* 能力点排行 */}
      {/* <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 flex items-center justify-center bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg">
            <i className="ri-trophy-line text-white text-sm"></i>
          </div>
          <h3 className="text-sm font-bold text-gray-900">能力点 TOP 5</h3>
        </div>
        <div className="space-y-2.5">
          {topAbility.map((team, idx) => (
            <div key={team.id} className="flex items-center gap-2">
              <span className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                idx === 1 ? 'bg-gray-100 text-gray-600' :
                idx === 2 ? 'bg-orange-100 text-orange-600' :
                'bg-gray-50 text-gray-500'
              }`}>{idx + 1}</span>
              <span className="text-xs text-gray-700 flex-1 truncate">{team.teamName}</span>
              <div className="flex items-center gap-1">
                <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${idx === 0 ? 'bg-gradient-to-r from-yellow-400 to-orange-400' : 'bg-gradient-to-r from-teal-400 to-cyan-400'}`}
                    style={{ width: `${Math.min((team.abilityPoints / 50) * 100, 100)}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-gray-700 w-5 text-right">{team.abilityPoints}</span>
              </div>
            </div>
          ))}
        </div>
      </div> */}
    </div>
  );
}