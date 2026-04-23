import { useState } from 'react';

interface StudentAlert {
  id: number;
  name: string;
  team: string;
  type: 'knowledge' | 'progress' | 'quality' | 'inactive';
  message: string;
  severity: 'high' | 'medium' | 'low';
  time: string;
}

interface CommonIssue {
  id: number;
  stage: string;
  issue: string;
  affectedCount: number;
  totalCount: number;
  suggestion: string;
}

const mockAlerts: StudentAlert[] = [
  { id: 1, name: '刘洋', team: '智慧农业小组', type: 'knowledge', message: '创新思维知识点检测3次未达标，当前得分42分', severity: 'high', time: '10分钟前' },
  { id: 2, name: '吴涛', team: '绿色出行团队', type: 'progress', message: '市场调研环节超时未完成，已滞后5天', severity: 'high', time: '1小时前' },
  { id: 3, name: '周芳', team: '绿色出行团队', type: 'inactive', message: '连续3天未登录平台，协作活跃度极低', severity: 'high', time: '3天前' },
  { id: 4, name: '蒋华', team: '乡村振兴数字化', type: 'quality', message: '调研计划提交质量不达标，已退回2次', severity: 'medium', time: '2小时前' },
  { id: 5, name: '韩梅', team: '乡村振兴数字化', type: 'knowledge', message: 'SCAMPER奔驰法知识点检测未达标', severity: 'medium', time: '5小时前' },
  { id: 6, name: '赵敏', team: '智慧农业小组', type: 'inactive', message: '本周协作发言仅2次，参与度偏低', severity: 'low', time: '1天前' },
];

const mockCommonIssues: CommonIssue[] = [
  { id: 1, stage: '创新思维', issue: '多数学生未掌握SCAMPER奔驰法应用，检测达标率仅58%', affectedCount: 14, totalCount: 24, suggestion: '建议补充SCAMPER实操案例视频，并开展线上答疑' },
  { id: 2, stage: '市场调研', issue: '用户画像绘制逻辑不清晰，普遍缺乏数据支撑', affectedCount: 10, totalCount: 18, suggestion: '推送"用户画像绘制模板"资源，并提供优秀案例参考' },
  { id: 3, stage: '商业模式', issue: '商业画布"收入来源"模块填写过于简单，缺乏盈利逻辑', affectedCount: 8, totalCount: 12, suggestion: '建议组织一次商业模式专题讨论，分享优秀案例' },
];

const stageStats = [
  { stage: '组队', completionRate: 100, passRate: 95, avgScore: 92, studentCount: 30 },
  { stage: '创新思维', completionRate: 88, passRate: 72, avgScore: 78, studentCount: 30 },
  { stage: '市场调研', completionRate: 65, passRate: 60, avgScore: 74, studentCount: 30 },
  { stage: '产品设计', completionRate: 45, passRate: 82, avgScore: 85, studentCount: 30 },
  { stage: '商业模式', completionRate: 30, passRate: 75, avgScore: 80, studentCount: 30 },
  { stage: 'AI验证', completionRate: 20, passRate: 90, avgScore: 88, studentCount: 30 },
  { stage: '角色推荐', completionRate: 15, passRate: 88, avgScore: 86, studentCount: 30 },
  { stage: '商业计划', completionRate: 8, passRate: 95, avgScore: 91, studentCount: 30 },
];

const alertTypeConfig = {
  knowledge: { label: '知识未达标', icon: 'ri-book-2-line', color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-200' },
  progress: { label: '进度滞后', icon: 'ri-time-line', color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-200' },
  quality: { label: '质量不达标', icon: 'ri-file-warning-line', color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-200' },
  inactive: { label: '活跃度低', icon: 'ri-user-unfollow-line', color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-200' },
};

const severityConfig = {
  high: { label: '紧急', color: 'bg-red-100 text-red-700' },
  medium: { label: '关注', color: 'bg-orange-100 text-orange-700' },
  low: { label: '提示', color: 'bg-gray-100 text-gray-600' },
};

export default function LearningAnalysisPanel() {
  const [activeAlertFilter, setActiveAlertFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [dismissedAlerts, setDismissedAlerts] = useState<number[]>([]);
  const [activeDataView, setActiveDataView] = useState<'team' | 'individual'>('team');

  const filteredAlerts = mockAlerts.filter(a => {
    if (dismissedAlerts.includes(a.id)) return false;
    if (activeAlertFilter === 'all') return true;
    return a.severity === activeAlertFilter;
  });

  const handleDismiss = (id: number) => setDismissedAlerts(prev => [...prev, id]);

  // 评价智能体采集数据
  const agentCollectionData = {
    teams: [
      { id: 1, name: '创新科技团队', promptOptimization: 127, codeContribution: 3420, componentCalls: 89, agileMeetingActivity: 94 },
      { id: 2, name: '智慧农业小组', promptOptimization: 98, codeContribution: 2156, componentCalls: 67, agileMeetingActivity: 72 },
      { id: 3, name: '绿色出行团队', promptOptimization: 45, codeContribution: 890, componentCalls: 23, agileMeetingActivity: 38 },
      { id: 4, name: '文化创意工作室', promptOptimization: 112, codeContribution: 2890, componentCalls: 78, agileMeetingActivity: 85 },
      { id: 5, name: 'AI+养老创业组', promptOptimization: 156, codeContribution: 4230, componentCalls: 102, agileMeetingActivity: 98 },
      { id: 6, name: '乡村振兴数字化', promptOptimization: 76, codeContribution: 1567, componentCalls: 45, agileMeetingActivity: 61 },
    ],
    individuals: [
      { id: 1, name: '张明', team: '创新科技团队', promptOptimization: 32, codeContribution: 1120, componentCalls: 28, agileMeetingActivity: 92 },
      { id: 2, name: '李娜', team: '创新科技团队', promptOptimization: 28, codeContribution: 890, componentCalls: 22, agileMeetingActivity: 88 },
      { id: 3, name: '林晓', team: 'AI+养老创业组', promptOptimization: 42, codeContribution: 1456, componentCalls: 35, agileMeetingActivity: 96 },
      { id: 4, name: '刘洋', team: '智慧农业小组', promptOptimization: 12, codeContribution: 234, componentCalls: 8, agileMeetingActivity: 45 },
      { id: 5, name: '周芳', team: '绿色出行团队', promptOptimization: 8, codeContribution: 156, componentCalls: 5, agileMeetingActivity: 28 },
    ]
  };

  // 计算客观过程得分（加权求和）
  const calculateObjectiveScore = (data: typeof agentCollectionData.teams[0] | typeof agentCollectionData.individuals[0]) => {
    const weights = { promptOptimization: 0.25, codeContribution: 0.35, componentCalls: 0.20, agileMeetingActivity: 0.20 };
    const maxValues = { promptOptimization: 200, codeContribution: 5000, componentCalls: 120, agileMeetingActivity: 100 };
    
    const normalizedPrompt = Math.min((data.promptOptimization / maxValues.promptOptimization) * 100, 100);
    const normalizedCode = Math.min((data.codeContribution / maxValues.codeContribution) * 100, 100);
    const normalizedComponent = Math.min((data.componentCalls / maxValues.componentCalls) * 100, 100);
    const normalizedAgile = data.agileMeetingActivity;
    
    return Math.round(
      normalizedPrompt * weights.promptOptimization +
      normalizedCode * weights.codeContribution +
      normalizedComponent * weights.componentCalls +
      normalizedAgile * weights.agileMeetingActivity
    );
  };

  return (
    <div className="space-y-5">
      {/* 评价智能体数据采集区域 - 新增 */}
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 flex items-center justify-center bg-white/20 rounded-lg relative">
            <i className="ri-robot-2-line text-white text-sm"></i>
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-indigo-500 animate-pulse"></span>
          </div>
          <div>
            <h3 className="text-sm font-bold">评价智能体 · 全周期无感采集</h3>
            <p className="text-xs text-indigo-100">实时追踪实战数据 · 自动生成客观过程得分</p>
          </div>
        </div>
        
        <div className="grid grid-cols-4 gap-3 mb-4">
          {[
            { label: '提示词优化频次', icon: 'ri-chat-quote-line', value: '614次', color: 'from-blue-400 to-cyan-400' },
            { label: '代码贡献量', icon: 'ri-code-s-slash-line', value: '15,153行', color: 'from-purple-400 to-pink-400' },
            { label: '组件调用次数', icon: 'ri-puzzle-line', value: '404次', color: 'from-green-400 to-emerald-400' },
            { label: '敏捷站会活跃度', icon: 'ri-team-line', value: '平均81分', color: 'from-orange-400 to-amber-400' },
          ].map((item, i) => (
            <div key={i} className="bg-white/15 rounded-xl px-3 py-2.5">
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center`}>
                  <i className={`${item.icon} text-white text-xs`}></i>
                </div>
                <span className="text-lg font-bold leading-none">{item.value}</span>
              </div>
              <div className="text-xs text-indigo-100">{item.label}</div>
            </div>
          ))}
        </div>

        <div className="bg-white/15 rounded-xl px-3 py-2.5 text-xs text-indigo-50 leading-relaxed">
          <i className="ri-sparkling-line mr-1"></i>
          <strong>智能体洞察：</strong>评价智能体已采集6个团队、30名学生的全流程实战数据，自动生成高颗粒度客观过程得分。提示词优化频次与代码贡献量呈正相关，建议重点关注低活跃度团队。
        </div>
      </div>

      {/* 4个核心采集维度卡片 - 新增 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg">
              <i className="ri-bar-chart-grouped-line text-white text-sm"></i>
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">评价智能体 · 4维度数据采集</h3>
              <p className="text-xs text-gray-400">按团队/个人切换查看实时数据</p>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setActiveDataView('team')}
              className={`px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer whitespace-nowrap ${
                activeDataView === 'team' ? 'bg-white text-gray-800 shadow-sm font-medium' : 'text-gray-500'
              }`}
            >
              <i className="ri-team-line mr-1"></i>按团队
            </button>
            <button
              onClick={() => setActiveDataView('individual')}
              className={`px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer whitespace-nowrap ${
                activeDataView === 'individual' ? 'bg-white text-gray-800 shadow-sm font-medium' : 'text-gray-500'
              }`}
            >
              <i className="ri-user-line mr-1"></i>按个人
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {/* 提示词优化频次 */}
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <i className="ri-chat-quote-line text-white text-xs"></i>
              </div>
              <h4 className="text-sm font-bold text-gray-900">提示词优化频次</h4>
              <span className="ml-auto text-xs text-blue-600 font-medium">权重 25%</span>
            </div>
            <div className="space-y-2">
              {(activeDataView === 'team' ? agentCollectionData.teams : agentCollectionData.individuals).slice(0, 5).map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 w-32 truncate">{item.name}</span>
                  <div className="flex-1 h-2 bg-white rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full"
                      style={{ width: `${Math.min((item.promptOptimization / 200) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-gray-700 w-12 text-right">{item.promptOptimization}次</span>
                </div>
              ))}
            </div>
          </div>

          {/* 代码贡献量 */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <i className="ri-code-s-slash-line text-white text-xs"></i>
              </div>
              <h4 className="text-sm font-bold text-gray-900">代码贡献量（版本数/行数）</h4>
              <span className="ml-auto text-xs text-purple-600 font-medium">权重 35%</span>
            </div>
            <div className="space-y-2">
              {(activeDataView === 'team' ? agentCollectionData.teams : agentCollectionData.individuals).slice(0, 5).map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 w-32 truncate">{item.name}</span>
                  <div className="flex-1 h-2 bg-white rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-400 to-pink-400 rounded-full"
                      style={{ width: `${Math.min((item.codeContribution / 5000) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-gray-700 w-12 text-right">{item.codeContribution}行</span>
                </div>
              ))}
            </div>
          </div>

          {/* 组件调用次数 */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                <i className="ri-puzzle-line text-white text-xs"></i>
              </div>
              <h4 className="text-sm font-bold text-gray-900">组件调用次数（智能体调用记录）</h4>
              <span className="ml-auto text-xs text-green-600 font-medium">权重 20%</span>
            </div>
            <div className="space-y-2">
              {(activeDataView === 'team' ? agentCollectionData.teams : agentCollectionData.individuals).slice(0, 5).map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 w-32 truncate">{item.name}</span>
                  <div className="flex-1 h-2 bg-white rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-400 to-emerald-400 rounded-full"
                      style={{ width: `${Math.min((item.componentCalls / 120) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-gray-700 w-12 text-right">{item.componentCalls}次</span>
                </div>
              ))}
            </div>
          </div>

          {/* 敏捷站会活跃度 */}
          <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                <i className="ri-team-line text-white text-xs"></i>
              </div>
              <h4 className="text-sm font-bold text-gray-900">敏捷站会活跃度（协作消息/会议频次）</h4>
              <span className="ml-auto text-xs text-orange-600 font-medium">权重 20%</span>
            </div>
            <div className="space-y-2">
              {(activeDataView === 'team' ? agentCollectionData.teams : agentCollectionData.individuals).slice(0, 5).map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 w-32 truncate">{item.name}</span>
                  <div className="flex-1 h-2 bg-white rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-orange-400 to-amber-400 rounded-full"
                      style={{ width: `${item.agileMeetingActivity}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-gray-700 w-12 text-right">{item.agileMeetingActivity}分</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 客观过程得分汇总 */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <i className="ri-trophy-line text-indigo-500 text-sm"></i>
            <h4 className="text-sm font-bold text-gray-900">客观过程得分（自动计算）</h4>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {(activeDataView === 'team' ? agentCollectionData.teams : agentCollectionData.individuals).slice(0, 6).map((item, i) => {
              const score = calculateObjectiveScore(item);
              return (
                <div key={i} className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-lg p-3 flex items-center justify-between">
                  <span className="text-xs text-gray-700 font-medium truncate mr-2">{item.name}</span>
                  <span className={`text-lg font-bold ${score >= 80 ? 'text-green-600' : score >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                    {score}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* AI分析摘要 */}
      <div className="bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 flex items-center justify-center bg-white/20 rounded-lg">
            <i className="ri-robot-2-line text-white text-sm"></i>
          </div>
          <div>
            <h3 className="text-sm font-bold">AI学情分析</h3>
            <p className="text-xs text-teal-100">实时更新 · 2分钟前</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          {[
            { label: '知识完成率', value: '76%', icon: 'ri-book-open-line' },
            { label: '检测达标率', value: '68%', icon: 'ri-checkbox-circle-line' },
            { label: '任务完成率', value: '82%', icon: 'ri-task-line' },
            { label: '协作活跃度', value: '74%', icon: 'ri-team-line' },
          ].map((item, i) => (
            <div key={i} className="bg-white/15 rounded-xl px-3 py-2 flex items-center gap-2">
              <i className={`${item.icon} text-white/80 text-sm`}></i>
              <div>
                <div className="text-lg font-bold leading-none">{item.value}</div>
                <div className="text-xs text-teal-100 mt-0.5">{item.label}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-white/15 rounded-xl px-3 py-2.5 text-xs text-teal-50 leading-relaxed">
          <i className="ri-sparkling-line mr-1"></i>
          <strong>AI洞察：</strong>当前班级整体进度良好，但创新思维环节检测达标率偏低（68%），建议重点关注SCAMPER方法的教学引导。有3名学生存在严重滞后风险，需立即介入。
        </div>
      </div>

      {/* 预警列表 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 flex items-center justify-center bg-gradient-to-br from-red-500 to-rose-500 rounded-lg">
              <i className="ri-alarm-warning-line text-white text-sm"></i>
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">智能预警</h3>
              <p className="text-xs text-gray-400">{filteredAlerts.length} 条待处理</p>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            {(['all', 'high', 'medium', 'low'] as const).map(f => (
              <button
                key={f}
                onClick={() => setActiveAlertFilter(f)}
                className={`px-2 py-1 text-xs rounded-md transition-all cursor-pointer whitespace-nowrap ${
                  activeAlertFilter === f ? 'bg-white text-gray-800 shadow-sm font-medium' : 'text-gray-500'
                }`}
              >
                {f === 'all' ? '全部' : f === 'high' ? '紧急' : f === 'medium' ? '关注' : '提示'}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
          {filteredAlerts.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-sm">
              <i className="ri-check-double-line text-2xl block mb-1 text-green-400"></i>
              暂无预警信息
            </div>
          ) : filteredAlerts.map(alert => {
            const typeConf = alertTypeConfig[alert.type];
            const sevConf = severityConfig[alert.severity];
            return (
              <div key={alert.id} className={`rounded-xl p-3 border ${typeConf.bg} ${typeConf.border}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <i className={`${typeConf.icon} ${typeConf.color} text-sm mt-0.5 flex-shrink-0`}></i>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-gray-800">{alert.name}</span>
                        <span className="text-xs text-gray-500">{alert.team}</span>
                        <span className={`px-1.5 py-0.5 text-xs rounded-full font-medium ${sevConf.color}`}>{sevConf.label}</span>
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{alert.message}</p>
                      <p className="text-xs text-gray-400 mt-1">{alert.time}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDismiss(alert.id)}
                    className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 flex-shrink-0 cursor-pointer"
                  >
                    <i className="ri-close-line text-xs"></i>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 共性问题 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 flex items-center justify-center bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg">
            <i className="ri-error-warning-line text-white text-sm"></i>
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">共性问题识别</h3>
            <p className="text-xs text-gray-400">AI自动分析 · {mockCommonIssues.length} 个问题</p>
          </div>
        </div>
        <div className="space-y-3">
          {mockCommonIssues.map(issue => (
            <div key={issue.id} className="bg-amber-50 border border-amber-100 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-2 py-0.5 bg-amber-200 text-amber-800 text-xs font-bold rounded-full">{issue.stage}</span>
                <span className="text-xs text-amber-700 font-medium">影响 {issue.affectedCount}/{issue.totalCount} 人</span>
                <div className="flex-1 h-1.5 bg-amber-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-orange-400 rounded-full"
                    style={{ width: `${(issue.affectedCount / issue.totalCount) * 100}%` }}
                  />
                </div>
              </div>
              <p className="text-xs text-gray-700 mb-1.5">{issue.issue}</p>
              <div className="flex items-start gap-1.5 bg-white rounded-lg px-2.5 py-1.5">
                <i className="ri-lightbulb-line text-teal-500 text-xs mt-0.5 flex-shrink-0"></i>
                <p className="text-xs text-teal-700">{issue.suggestion}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 各环节达标率 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg">
            <i className="ri-bar-chart-grouped-line text-white text-sm"></i>
          </div>
          <h3 className="text-sm font-bold text-gray-900">各环节达标率</h3>
        </div>
        <div className="space-y-2.5">
          {stageStats.map((s, i) => (
            <div key={i}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-600 font-medium">{s.stage}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">完成 {s.completionRate}%</span>
                  <span className={`text-xs font-bold ${s.passRate >= 80 ? 'text-green-600' : s.passRate >= 60 ? 'text-amber-600' : 'text-red-500'}`}>
                    达标 {s.passRate}%
                  </span>
                </div>
              </div>
              <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="absolute left-0 top-0 h-full bg-gray-200 rounded-full"
                  style={{ width: `${s.completionRate}%` }}
                />
                <div
                  className={`absolute left-0 top-0 h-full rounded-full ${
                    s.passRate >= 80 ? 'bg-gradient-to-r from-green-400 to-emerald-400' :
                    s.passRate >= 60 ? 'bg-gradient-to-r from-amber-400 to-yellow-400' :
                    'bg-gradient-to-r from-red-400 to-rose-400'
                  }`}
                  style={{ width: `${(s.completionRate * s.passRate) / 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-1.5 bg-gray-200 rounded-full"></div>
            <span className="text-xs text-gray-400">已完成</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-1.5 bg-gradient-to-r from-green-400 to-emerald-400 rounded-full"></div>
            <span className="text-xs text-gray-400">已达标</span>
          </div>
        </div>
      </div>
    </div>
  );
}
