import { useState } from 'react';

interface TeamProject {
  id: number;
  teamName: string;
  course: string;
  currentStage: string;
  overallProgress: number;
  evaluationStatus: 'pending' | 'reviewed' | 'passed';
}

interface BatchScoringModalProps {
  teams: TeamProject[];
  onClose: () => void;
  onSubmit: (results: { teamId: number; score: number; comment: string }[]) => void;
}

const TASK_TYPES = [
  { value: 'market-research', label: '市场调研报告', icon: 'ri-search-line' },
  { value: 'business-canvas', label: '商业模式画布', icon: 'ri-layout-grid-line' },
  { value: 'product-prototype', label: '产品原型设计', icon: 'ri-palette-line' },
  { value: 'business-plan', label: '商业计划书', icon: 'ri-file-text-line' },
  { value: 'user-persona', label: '用户画像分析', icon: 'ri-user-heart-line' },
  { value: 'swot-analysis', label: 'SWOT分析', icon: 'ri-pie-chart-line' },
  { value: 'pitch-deck', label: '路演PPT', icon: 'ri-slideshow-line' },
  { value: 'financial-plan', label: '财务计划', icon: 'ri-money-dollar-circle-line' },
];

export default function BatchScoringModal({ teams, onClose, onSubmit }: BatchScoringModalProps) {
  const [selectedTask, setSelectedTask] = useState('market-research');
  const [selectedTeams, setSelectedTeams] = useState<Set<number>>(new Set());
  const [unifiedScore, setUnifiedScore] = useState('');
  const [unifiedComment, setUnifiedComment] = useState('');
  const [individualScores, setIndividualScores] = useState<Record<number, { score: string; comment: string }>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleSelectAll = () => {
    if (selectedTeams.size === teams.length) {
      setSelectedTeams(new Set());
    } else {
      setSelectedTeams(new Set(teams.map(t => t.id)));
    }
  };

  const handleToggleTeam = (teamId: number) => {
    const newSet = new Set(selectedTeams);
    if (newSet.has(teamId)) {
      newSet.delete(teamId);
    } else {
      newSet.add(teamId);
    }
    setSelectedTeams(newSet);
  };

  const handleApplyUnified = () => {
    if (!unifiedScore || parseFloat(unifiedScore) < 0 || parseFloat(unifiedScore) > 100) {
      alert('请输入0-100之间的有效分数');
      return;
    }
    const newScores: Record<number, { score: string; comment: string }> = {};
    selectedTeams.forEach(teamId => {
      newScores[teamId] = { score: unifiedScore, comment: unifiedComment };
    });
    setIndividualScores({ ...individualScores, ...newScores });
  };

  const handleIndividualChange = (teamId: number, field: 'score' | 'comment', value: string) => {
    setIndividualScores({
      ...individualScores,
      [teamId]: {
        ...individualScores[teamId],
        [field]: value,
      },
    });
  };

  const handleSubmit = () => {
    const results: { teamId: number; score: number; comment: string }[] = [];
    let hasError = false;

    selectedTeams.forEach(teamId => {
      const data = individualScores[teamId];
      if (!data || !data.score) {
        hasError = true;
        return;
      }
      const score = parseFloat(data.score);
      if (score < 0 || score > 100) {
        hasError = true;
        return;
      }
      results.push({
        teamId,
        score,
        comment: data.comment || '',
      });
    });

    if (hasError) {
      alert('请为所有选中团队填写有效的评分（0-100）');
      return;
    }

    if (results.length === 0) {
      alert('请至少选择一个团队并填写评分');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setSuccessMessage(`已完成 ${results.length} 个团队的评分`);
      setTimeout(() => {
        onSubmit(results);
      }, 1500);
    }, 1200);
  };

  const currentTask = TASK_TYPES.find(t => t.value === selectedTask);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* 头部 */}
        <div className="bg-gradient-to-r from-teal-500 to-cyan-500 px-8 py-6 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
              <i className="ri-file-list-3-line text-white text-2xl"></i>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">批量评分</h2>
              <p className="text-white/90 text-sm mt-0.5">对多个团队的同一任务统一打分</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-8">
          {successMessage ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
                <i className="ri-check-line text-green-600 text-4xl"></i>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">评分提交成功</h3>
              <p className="text-gray-500 text-sm">{successMessage}</p>
            </div>
          ) : (
            <>
              {/* 任务类型选择 */}
              <div className="mb-8">
                <label className="block text-sm font-bold text-gray-900 mb-3">选择任务类型</label>
                <div className="grid grid-cols-4 gap-3">
                  {TASK_TYPES.map(task => (
                    <button
                      key={task.value}
                      onClick={() => setSelectedTask(task.value)}
                      className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all cursor-pointer ${
                        selectedTask === task.value
                          ? 'border-teal-500 bg-teal-50 text-teal-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <i className={`${task.icon} text-lg`}></i>
                      <span className="text-sm font-medium">{task.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 统一评分区 */}
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-6 mb-8 border border-indigo-100">
                <div className="flex items-center gap-2 mb-4">
                  <i className="ri-magic-line text-indigo-600 text-lg"></i>
                  <h3 className="text-base font-bold text-gray-900">统一评分（快速应用）</h3>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-2">统一分数（0-100）</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={unifiedScore}
                      onChange={e => setUnifiedScore(e.target.value)}
                      placeholder="输入分数"
                      className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-2">统一评语</label>
                    <input
                      type="text"
                      value={unifiedComment}
                      onChange={e => setUnifiedComment(e.target.value)}
                      placeholder="输入评语（可选）"
                      className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>
                </div>
                <button
                  onClick={handleApplyUnified}
                  disabled={selectedTeams.size === 0}
                  className={`w-full py-2.5 rounded-xl text-sm font-medium transition-all ${
                    selectedTeams.size === 0
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:shadow-lg cursor-pointer'
                  }`}
                >
                  <i className="ri-arrow-down-line mr-2"></i>
                  应用到所有选中团队（{selectedTeams.size} 个）
                </button>
              </div>

              {/* 团队列表 */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-bold text-gray-900">团队列表</h3>
                    <span className="px-2.5 py-1 bg-teal-100 text-teal-700 text-xs font-bold rounded-full">
                      {currentTask?.label}
                    </span>
                  </div>
                  <button
                    onClick={handleSelectAll}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <i className={`${selectedTeams.size === teams.length ? 'ri-checkbox-line' : 'ri-checkbox-blank-line'} text-sm`}></i>
                    {selectedTeams.size === teams.length ? '取消全选' : '全选'}
                  </button>
                </div>

                <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                  {teams.map(team => {
                    const isSelected = selectedTeams.has(team.id);
                    const scoreData = individualScores[team.id];

                    return (
                      <div
                        key={team.id}
                        className={`px-6 py-4 transition-colors ${isSelected ? 'bg-teal-50/50' : 'bg-white hover:bg-gray-50'}`}
                      >
                        <div className="flex items-start gap-4">
                          {/* 选择框 */}
                          <button
                            onClick={() => handleToggleTeam(team.id)}
                            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-1 transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-teal-500 border-teal-500'
                                : 'bg-white border-gray-300 hover:border-teal-400'
                            }`}
                          >
                            {isSelected && <i className="ri-check-line text-white text-xs"></i>}
                          </button>

                          {/* 团队信息 */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="w-9 h-9 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-lg flex items-center justify-center flex-shrink-0">
                                <i className="ri-team-line text-white text-sm"></i>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-gray-900">{team.teamName}</div>
                                <div className="text-xs text-gray-500">
                                  {team.course} · {team.currentStage} · 进度 {team.overallProgress}%
                                </div>
                              </div>
                              <span
                                className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                                  team.evaluationStatus === 'passed'
                                    ? 'bg-green-100 text-green-700'
                                    : team.evaluationStatus === 'reviewed'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-amber-100 text-amber-700'
                                }`}
                              >
                                {team.evaluationStatus === 'passed'
                                  ? '已通过'
                                  : team.evaluationStatus === 'reviewed'
                                  ? '已评阅'
                                  : '待评价'}
                              </span>
                            </div>

                            {/* 评分输入 */}
                            {isSelected && (
                              <div className="grid grid-cols-3 gap-3 pl-12">
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1.5">分数（0-100）</label>
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={scoreData?.score || ''}
                                    onChange={e => handleIndividualChange(team.id, 'score', e.target.value)}
                                    placeholder="输入分数"
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                                  />
                                </div>
                                <div className="col-span-2">
                                  <label className="block text-xs font-medium text-gray-600 mb-1.5">评语</label>
                                  <input
                                    type="text"
                                    value={scoreData?.comment || ''}
                                    onChange={e => handleIndividualChange(team.id, 'comment', e.target.value)}
                                    placeholder="输入评语（可选）"
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* 底部操作栏 */}
        {!successMessage && (
          <div className="bg-gray-50 px-8 py-5 border-t border-gray-200 flex items-center justify-between flex-shrink-0">
            <div className="text-sm text-gray-500">
              已选择 <span className="font-bold text-teal-600">{selectedTeams.size}</span> 个团队
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || selectedTeams.size === 0}
                className={`px-6 py-2.5 text-sm font-medium rounded-xl transition-all ${
                  isSubmitting || selectedTeams.size === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white hover:shadow-lg cursor-pointer'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <i className="ri-loader-4-line animate-spin mr-2"></i>
                    提交中...
                  </>
                ) : (
                  <>
                    <i className="ri-check-line mr-2"></i>
                    提交评分
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}