import { useState } from 'react';

interface Team {
  id: string;
  name: string;
  class: string;
  members: number;
  project: string;
  overallProgress: number;
  currentStage: string;
  qualityScore: number;
  stageProgress: {
    teamFormation: number;
    ideation: number;
    marketResearch: number;
    productDesign: number;
    businessModel: number;
    roleSimulation: number;
    businessPlan: number;
    evaluation: number;
  };
}

interface ModuleStats {
  moduleName: string;
  icon: string;
  avgCompletion: number;
  highestScore: number;
  lowestScore: number;
  notStartedCount: number;
  teams: {
    teamName: string;
    progress: number;
    score: number;
    status: string;
  }[];
}

// 模块完成率趋势数据（近4周）
const moduleTrendData = [
  {
    week: '第1周',
    teamFormation: 45,
    ideation: 30,
    marketResearch: 15,
    productDesign: 8,
    businessModel: 5,
    roleSimulation: 0,
    businessPlan: 0,
    evaluation: 0,
  },
  {
    week: '第2周',
    teamFormation: 78,
    ideation: 62,
    marketResearch: 38,
    productDesign: 22,
    businessModel: 12,
    roleSimulation: 5,
    businessPlan: 0,
    evaluation: 0,
  },
  {
    week: '第3周',
    teamFormation: 95,
    ideation: 88,
    marketResearch: 65,
    productDesign: 48,
    businessModel: 28,
    roleSimulation: 15,
    businessPlan: 8,
    evaluation: 0,
  },
  {
    week: '第4周',
    teamFormation: 100,
    ideation: 96,
    marketResearch: 82,
    productDesign: 63,
    businessModel: 42,
    roleSimulation: 25,
    businessPlan: 18,
    evaluation: 5,
  },
];

const mockTeams: Team[] = [
  {
    id: '1',
    name: '创新先锋队',
    class: '创新创业2024-1班',
    members: 5,
    project: '校园快递创新项目',
    overallProgress: 75,
    currentStage: '商业模式设计',
    qualityScore: 88,
    stageProgress: {
      teamFormation: 100,
      ideation: 100,
      marketResearch: 95,
      productDesign: 85,
      businessModel: 60,
      roleSimulation: 0,
      businessPlan: 0,
      evaluation: 0,
    },
  },
  {
    id: '2',
    name: '智慧团队',
    class: '创新创业2024-1班',
    members: 4,
    project: '智能学习助手',
    overallProgress: 62,
    currentStage: '产品设计与原型',
    qualityScore: 82,
    stageProgress: {
      teamFormation: 100,
      ideation: 100,
      marketResearch: 88,
      productDesign: 55,
      businessModel: 0,
      roleSimulation: 0,
      businessPlan: 0,
      evaluation: 0,
    },
  },
  {
    id: '3',
    name: '绿色环保组',
    class: '创新创业2024-1班',
    members: 5,
    project: '校园共享单车优化',
    overallProgress: 43,
    currentStage: '市场调研与用户画像',
    qualityScore: 76,
    stageProgress: {
      teamFormation: 100,
      ideation: 90,
      marketResearch: 45,
      productDesign: 0,
      businessModel: 0,
      roleSimulation: 0,
      businessPlan: 0,
      evaluation: 0,
    },
  },
  {
    id: '4',
    name: '科技探索者',
    class: '创新创业2024-2班',
    members: 6,
    project: 'AR校园导览系统',
    overallProgress: 88,
    currentStage: '商业计划书与PPT',
    qualityScore: 92,
    stageProgress: {
      teamFormation: 100,
      ideation: 100,
      marketResearch: 100,
      productDesign: 95,
      businessModel: 90,
      roleSimulation: 85,
      businessPlan: 75,
      evaluation: 0,
    },
  },
  {
    id: '5',
    name: '梦想启航',
    class: '创新创业2024-2班',
    members: 5,
    project: '校园二手交易平台',
    overallProgress: 55,
    currentStage: '产品设计与原型',
    qualityScore: 79,
    stageProgress: {
      teamFormation: 100,
      ideation: 95,
      marketResearch: 80,
      productDesign: 50,
      businessModel: 0,
      roleSimulation: 0,
      businessPlan: 0,
      evaluation: 0,
    },
  },
  {
    id: '6',
    name: '创意工坊',
    class: '创新创业2024-2班',
    members: 4,
    project: '智能食堂预约系统',
    overallProgress: 38,
    currentStage: '市场调研与用户画像',
    qualityScore: 72,
    stageProgress: {
      teamFormation: 100,
      ideation: 85,
      marketResearch: 40,
      productDesign: 0,
      businessModel: 0,
      roleSimulation: 0,
      businessPlan: 0,
      evaluation: 0,
    },
  },
];

const stages = [
  { key: 'teamFormation', name: '组队与团队管理', icon: 'ri-team-line' },
  { key: 'ideation', name: '创新思维与创意生成', icon: 'ri-lightbulb-line' },
  { key: 'marketResearch', name: '市场调研与用户画像', icon: 'ri-search-line' },
  { key: 'productDesign', name: '产品设计与原型', icon: 'ri-palette-line' },
  { key: 'businessModel', name: '商业模式设计', icon: 'ri-pie-chart-line' },
  { key: 'roleSimulation', name: 'AI角色推荐与仿真', icon: 'ri-robot-line' },
  { key: 'businessPlan', name: '商业计划书与PPT', icon: 'ri-file-text-line' },
  { key: 'evaluation', name: '项目评估与迭代', icon: 'ri-bar-chart-line' },
];

export default function ClassProjectOverview() {
  const [activeTab, setActiveTab] = useState<'project' | 'team' | 'module'>('project');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('progress');
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{ teamId: string; stageKey: string } | null>(null);

  const classes = ['全部班级', '创新创业2024-1班', '创新创业2024-2班'];

  const filteredTeams = selectedClass === 'all' 
    ? mockTeams 
    : mockTeams.filter(team => team.class === selectedClass);

  const sortedTeams = [...filteredTeams].sort((a, b) => {
    if (sortBy === 'progress') return b.overallProgress - a.overallProgress;
    if (sortBy === 'quality') return b.qualityScore - a.qualityScore;
    return 0;
  });

  // 计算顶部统计数据
  const totalTeams = filteredTeams.length;
  const avgProgress = Math.round(
    filteredTeams.reduce((sum, team) => sum + team.overallProgress, 0) / totalTeams
  );
  const avgQualityScore = Math.round(
    filteredTeams.reduce((sum, team) => sum + team.qualityScore, 0) / totalTeams
  );
  const completedTeams = filteredTeams.filter(team => team.overallProgress === 100).length;

  // 计算项目完成率分布
  const progressDistribution = [
    { range: '0-25%', count: filteredTeams.filter(t => t.overallProgress < 25).length, color: 'bg-red-500' },
    { range: '25-50%', count: filteredTeams.filter(t => t.overallProgress >= 25 && t.overallProgress < 50).length, color: 'bg-orange-500' },
    { range: '50-75%', count: filteredTeams.filter(t => t.overallProgress >= 50 && t.overallProgress < 75).length, color: 'bg-yellow-500' },
    { range: '75-100%', count: filteredTeams.filter(t => t.overallProgress >= 75).length, color: 'bg-green-500' },
  ];

  // 计算模块统计数据
  const moduleStats: ModuleStats[] = stages.map(stage => {
    const stageKey = stage.key as keyof Team['stageProgress'];
    const teamProgresses = filteredTeams.map(team => ({
      teamName: team.name,
      progress: team.stageProgress[stageKey],
      score: Math.round(team.stageProgress[stageKey] * 0.9 + Math.random() * 10),
      status: team.stageProgress[stageKey] === 0 ? '未开始' : team.stageProgress[stageKey] === 100 ? '已完成' : '进行中',
    }));

    const completedProgresses = teamProgresses.filter(t => t.progress > 0).map(t => t.progress);
    const scores = teamProgresses.filter(t => t.progress > 0).map(t => t.score);

    return {
      moduleName: stage.name,
      icon: stage.icon,
      avgCompletion: completedProgresses.length > 0 
        ? Math.round(completedProgresses.reduce((a, b) => a + b, 0) / completedProgresses.length)
        : 0,
      highestScore: scores.length > 0 ? Math.max(...scores) : 0,
      lowestScore: scores.length > 0 ? Math.min(...scores) : 0,
      notStartedCount: teamProgresses.filter(t => t.progress === 0).length,
      teams: teamProgresses,
    };
  });

  const getProgressColor = (progress: number) => {
    if (progress === 0) return 'bg-gray-200';
    if (progress < 50) return 'bg-red-400';
    if (progress < 75) return 'bg-yellow-400';
    return 'bg-green-400';
  };

  const getQualityLevel = (score: number) => {
    if (score >= 90) return { text: '优秀', color: 'text-green-600' };
    if (score >= 80) return { text: '良好', color: 'text-blue-600' };
    if (score >= 70) return { text: '中等', color: 'text-yellow-600' };
    return { text: '待提升', color: 'text-orange-600' };
  };

  const handleExport = () => {
    alert(`导出${activeTab === 'project' ? '项目' : activeTab === 'team' ? '团队' : '模块'}维度数据`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* 顶部导航栏 */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => window.history.back()}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors whitespace-nowrap"
              >
                <i className="ri-arrow-left-line text-lg"></i>
                <span className="text-sm font-medium">返回工作台</span>
              </button>
              <div className="h-6 w-px bg-gray-300"></div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <i className="ri-layout-grid-line text-white text-xl"></i>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900 whitespace-nowrap">班级项目总览</h1>
                  <p className="text-xs text-gray-500 whitespace-nowrap">多维度查看全班项目进度</p>
                </div>
              </div>
            </div>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors whitespace-nowrap"
            >
              <i className="ri-download-line"></i>
              <span className="text-sm font-medium">导出当前视图</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* 顶部统计卡片 */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <i className="ri-team-line text-white text-xl"></i>
              </div>
              <i className="ri-arrow-up-line text-green-600 text-sm"></i>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{totalTeams}</div>
            <div className="text-sm text-gray-500 whitespace-nowrap">总团队数</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
                <i className="ri-speed-line text-white text-xl"></i>
              </div>
              <i className="ri-arrow-up-line text-green-600 text-sm"></i>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{avgProgress}%</div>
            <div className="text-sm text-gray-500 whitespace-nowrap">平均进度</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
                <i className="ri-star-line text-white text-xl"></i>
              </div>
              <i className="ri-arrow-up-line text-green-600 text-sm"></i>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{avgQualityScore}</div>
            <div className="text-sm text-gray-500 whitespace-nowrap">平均质量分</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
                <i className="ri-checkbox-circle-line text-white text-xl"></i>
              </div>
              <i className="ri-arrow-up-line text-green-600 text-sm"></i>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{completedTeams}</div>
            <div className="text-sm text-gray-500 whitespace-nowrap">已完成团队数</div>
          </div>
        </div>

        {/* 筛选和切换区域 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            {/* Tab 切换 */}
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('project')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all whitespace-nowrap ${
                  activeTab === 'project'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <i className="ri-folder-line"></i>
                <span className="text-sm font-medium">按项目维度</span>
              </button>
              <button
                onClick={() => setActiveTab('team')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all whitespace-nowrap ${
                  activeTab === 'team'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <i className="ri-team-line"></i>
                <span className="text-sm font-medium">按团队维度</span>
              </button>
              <button
                onClick={() => setActiveTab('module')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all whitespace-nowrap ${
                  activeTab === 'module'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <i className="ri-grid-line"></i>
                <span className="text-sm font-medium">按模块维度</span>
              </button>
            </div>

            {/* 筛选和排序 */}
            <div className="flex items-center gap-3">
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 whitespace-nowrap"
              >
                {classes.map((cls, index) => (
                  <option key={index} value={index === 0 ? 'all' : cls}>
                    {cls}
                  </option>
                ))}
              </select>
              {activeTab !== 'module' && (
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 whitespace-nowrap"
                >
                  <option value="progress">按进度排序</option>
                  <option value="quality">按质量评分排序</option>
                </select>
              )}
            </div>
          </div>
        </div>

        {/* 按项目维度 */}
        {activeTab === 'project' && (
          <div className="space-y-6">
            {/* 项目列表 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                        团队名称
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                        项目名称
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                        所属班级
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                        整体进度
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                        当前阶段
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                        质量评分
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {sortedTeams.map((team) => (
                      <tr key={team.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                              <i className="ri-team-line text-white"></i>
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-gray-900 whitespace-nowrap">{team.name}</div>
                              <div className="text-xs text-gray-500 whitespace-nowrap">{team.members} 名成员</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900 whitespace-nowrap">{team.project}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-600 whitespace-nowrap">{team.class}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 min-w-[120px]">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-semibold text-gray-700">{team.overallProgress}%</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full transition-all ${
                                    team.overallProgress >= 75
                                      ? 'bg-green-500'
                                      : team.overallProgress >= 50
                                      ? 'bg-yellow-500'
                                      : 'bg-red-500'
                                  }`}
                                  style={{ width: `${team.overallProgress}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full whitespace-nowrap">
                            <i className="ri-focus-line text-xs"></i>
                            <span className="text-xs font-medium">{team.currentStage}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-gray-900">{team.qualityScore}</span>
                            <span className="text-xs text-gray-500">/ 100</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 项目完成率分布 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6 whitespace-nowrap">项目完成率分布</h3>
              <div className="grid grid-cols-4 gap-4">
                {progressDistribution.map((item, index) => (
                  <div key={index} className="text-center">
                    <div className="mb-3">
                      <div className={`w-full h-32 ${item.color} rounded-lg flex items-end justify-center pb-4`}>
                        <span className="text-3xl font-bold text-white">{item.count}</span>
                      </div>
                    </div>
                    <div className="text-sm font-medium text-gray-700 whitespace-nowrap">{item.range}</div>
                    <div className="text-xs text-gray-500 mt-1 whitespace-nowrap">
                      {filteredTeams.length > 0 ? Math.round((item.count / filteredTeams.length) * 100) : 0}% 的团队
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 按团队维度 */}
        {activeTab === 'team' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 whitespace-nowrap">
                      团队名称
                    </th>
                    {stages.map((stage) => (
                      <th key={stage.key} className="px-4 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                        <div className="flex flex-col items-center gap-1">
                          <i className={`${stage.icon} text-lg`}></i>
                          <span className="text-[10px] leading-tight max-w-[80px]">{stage.name}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {sortedTeams.map((team) => (
                    <tr key={team.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 sticky left-0 bg-white z-10">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                            <i className="ri-team-line text-white"></i>
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-900 whitespace-nowrap">{team.name}</div>
                            <div className="text-xs text-gray-500 whitespace-nowrap">{team.overallProgress}% 完成</div>
                          </div>
                        </div>
                      </td>
                      {stages.map((stage) => {
                        const progress = team.stageProgress[stage.key as keyof Team['stageProgress']];
                        const qualityScore = Math.round(progress * 0.85 + Math.random() * 15);
                        const isHovered = hoveredCell?.teamId === team.id && hoveredCell?.stageKey === stage.key;
                        
                        return (
                          <td key={stage.key} className="px-4 py-4 relative">
                            <div className="flex flex-col items-center gap-2">
                              <div
                                className={`w-16 h-16 rounded-lg flex items-center justify-center ${getProgressColor(
                                  progress
                                )} transition-all hover:scale-110 cursor-pointer relative`}
                                onMouseEnter={() => setHoveredCell({ teamId: team.id, stageKey: stage.key })}
                                onMouseLeave={() => setHoveredCell(null)}
                              >
                                <span className="text-sm font-bold text-white">{progress}%</span>
                                
                                {/* Tooltip */}
                                {isHovered && progress > 0 && (
                                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-20">
                                    <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap">
                                      <div className="font-semibold mb-1">{stage.name}</div>
                                      <div className="flex items-center gap-2 text-gray-300">
                                        <span>进度: {progress}%</span>
                                        <span>•</span>
                                        <span className={getQualityLevel(qualityScore).color.replace('text-', 'text-')}>
                                          质量分: {qualityScore}
                                        </span>
                                      </div>
                                      <div className="text-gray-400 mt-1">
                                        {getQualityLevel(qualityScore).text}
                                      </div>
                                      {/* 小三角 */}
                                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-px">
                                        <div className="border-4 border-transparent border-t-gray-900"></div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 bg-gray-50 border-t border-gray-200">
              <div className="flex items-center justify-center gap-6 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gray-200 rounded"></div>
                  <span className="text-gray-600 whitespace-nowrap">未开始</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-400 rounded"></div>
                  <span className="text-gray-600 whitespace-nowrap">0-50%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-yellow-400 rounded"></div>
                  <span className="text-gray-600 whitespace-nowrap">50-75%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-400 rounded"></div>
                  <span className="text-gray-600 whitespace-nowrap">75-100%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 按模块维度 */}
        {activeTab === 'module' && (
          <div className="space-y-6">
            {/* 模块完成率趋势图 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6 whitespace-nowrap">模块完成率趋势（近4周）</h3>
              <div className="relative h-80">
                {/* Y轴标签 */}
                <div className="absolute left-0 top-0 bottom-8 flex flex-col justify-between text-xs text-gray-500">
                  <span>100%</span>
                  <span>75%</span>
                  <span>50%</span>
                  <span>25%</span>
                  <span>0%</span>
                </div>
                
                {/* 图表区域 */}
                <div className="ml-12 h-full pb-8 relative">
                  {/* 网格线 */}
                  <div className="absolute inset-0 flex flex-col justify-between">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div key={i} className="border-t border-gray-200"></div>
                    ))}
                  </div>
                  
                  {/* 折线图 */}
                  <svg className="w-full h-full" viewBox="0 0 800 300" preserveAspectRatio="none">
                    {/* 组队与团队管理 */}
                    <polyline
                      points={moduleTrendData.map((d, i) => `${(i * 800) / 3},${300 - (d.teamFormation * 3)}`).join(' ')}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="3"
                    />
                    {/* 创新思维与创意生成 */}
                    <polyline
                      points={moduleTrendData.map((d, i) => `${(i * 800) / 3},${300 - (d.ideation * 3)}`).join(' ')}
                      fill="none"
                      stroke="#8b5cf6"
                      strokeWidth="3"
                    />
                    {/* 市场调研与用户画像 */}
                    <polyline
                      points={moduleTrendData.map((d, i) => `${(i * 800) / 3},${300 - (d.marketResearch * 3)}`).join(' ')}
                      fill="none"
                      stroke="#ec4899"
                      strokeWidth="3"
                    />
                    {/* 产品设计与原型 */}
                    <polyline
                      points={moduleTrendData.map((d, i) => `${(i * 800) / 3},${300 - (d.productDesign * 3)}`).join(' ')}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="3"
                    />
                    {/* 商业模式设计 */}
                    <polyline
                      points={moduleTrendData.map((d, i) => `${(i * 800) / 3},${300 - (d.businessModel * 3)}`).join(' ')}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="3"
                    />
                  </svg>
                  
                  {/* X轴标签 */}
                  <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-gray-500">
                    {moduleTrendData.map((d, i) => (
                      <span key={i}>{d.week}</span>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* 图例 */}
              <div className="flex items-center justify-center gap-6 mt-6 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-1 bg-blue-500 rounded"></div>
                  <span className="text-xs text-gray-600 whitespace-nowrap">组队与团队管理</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-1 bg-purple-500 rounded"></div>
                  <span className="text-xs text-gray-600 whitespace-nowrap">创新思维与创意生成</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-1 bg-pink-500 rounded"></div>
                  <span className="text-xs text-gray-600 whitespace-nowrap">市场调研与用户画像</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-1 bg-amber-500 rounded"></div>
                  <span className="text-xs text-gray-600 whitespace-nowrap">产品设计与原型</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-1 bg-green-500 rounded"></div>
                  <span className="text-xs text-gray-600 whitespace-nowrap">商业模式设计</span>
                </div>
              </div>
            </div>

            {/* 模块统计卡片 */}
            <div className="grid grid-cols-4 gap-4">
              {moduleStats.map((module, index) => (
                <div
                  key={index}
                  onClick={() => setSelectedModule(selectedModule === module.moduleName ? null : module.moduleName)}
                  className={`bg-white rounded-xl shadow-sm border-2 p-6 cursor-pointer transition-all hover:shadow-md ${
                    selectedModule === module.moduleName ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                      <i className={`${module.icon} text-white text-xl`}></i>
                    </div>
                    {selectedModule === module.moduleName && (
                      <i className="ri-check-line text-indigo-600 text-xl"></i>
                    )}
                  </div>
                  <h4 className="text-sm font-bold text-gray-900 mb-4 line-clamp-2 min-h-[40px]">{module.moduleName}</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 whitespace-nowrap">平均完成率</span>
                      <span className="text-lg font-bold text-indigo-600">{module.avgCompletion}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 whitespace-nowrap">最高分</span>
                      <span className="text-sm font-semibold text-green-600">{module.highestScore}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 whitespace-nowrap">最低分</span>
                      <span className="text-sm font-semibold text-orange-600">{module.lowestScore}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 whitespace-nowrap">未开始团队</span>
                      <span className="text-sm font-semibold text-red-600">{module.notStartedCount}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 选中模块的详细团队列表 */}
            {selectedModule && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white whitespace-nowrap">{selectedModule} - 团队详情</h3>
                    <button
                      onClick={() => setSelectedModule(null)}
                      className="text-white hover:text-gray-200 transition-colors whitespace-nowrap"
                    >
                      <i className="ri-close-line text-xl"></i>
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                          团队名称
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                          完成进度
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                          质量评分
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                          状态
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {moduleStats
                        .find((m) => m.moduleName === selectedModule)
                        ?.teams.map((team, index) => (
                          <tr key={index} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="text-sm font-semibold text-gray-900 whitespace-nowrap">{team.teamName}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="flex-1 min-w-[120px]">
                                  <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                      className={`h-2 rounded-full ${getProgressColor(team.progress)}`}
                                      style={{ width: `${team.progress}%` }}
                                    ></div>
                                  </div>
                                </div>
                                <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">{team.progress}%</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <span className="text-lg font-bold text-gray-900">{team.score}</span>
                                <span className="text-xs text-gray-500">/ 100</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                                  team.status === '已完成'
                                    ? 'bg-green-100 text-green-700'
                                    : team.status === '进行中'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                {team.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}