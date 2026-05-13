
import { useState } from 'react';

interface TeamScoringData {
  id: number;
  teamName: string;
  course: string;
  status: 'pending' | 'in-progress' | 'completed';
  projectScore: number | null;
  iterationScore: number | null;
  finalScore: number | null;
  reviewer: string | null;
}

interface TeamScoringModalProps {
  team: TeamScoringData;
  onClose: () => void;
  onSubmit: (result: {
    id: number;
    projectScore: number;
    iterationScore: number;
    finalScore: number;
    reviewer: string;
    comment: string;
    status: 'completed';
  }) => void;
}

const SCORE_DIMENSIONS = [
  {
    key: 'technical',
    label: '技术落地性',
    icon: 'ri-code-s-slash-line',
    color: 'from-teal-500 to-cyan-500',
    desc: '产品原型完整度、技术方案可行性',
    weight: 35,
  },
  {
    key: 'business',
    label: '商业逻辑闭环',
    icon: 'ri-pie-chart-line',
    color: 'from-indigo-500 to-violet-500',
    desc: '商业模式清晰度、盈利路径合理性',
    weight: 35,
  },
  {
    key: 'market',
    label: '市场生存潜力',
    icon: 'ri-line-chart-line',
    color: 'from-orange-500 to-amber-500',
    desc: '市场需求真实性、竞争优势明显性',
    weight: 30,
  },
];

const ITERATION_DIMENSIONS = [
  {
    key: 'iterCount',
    label: '迭代次数与质量',
    icon: 'ri-refresh-line',
    color: 'from-green-500 to-emerald-500',
    desc: '完整迭代轮次及每轮改进幅度',
    weight: 40,
  },
  {
    key: 'dataDecision',
    label: '数据驱动决策',
    icon: 'ri-bar-chart-line',
    color: 'from-teal-500 to-cyan-500',
    desc: '决策是否有数据支撑，支撑率高低',
    weight: 35,
  },
  {
    key: 'adaptability',
    label: '方案调整适应性',
    icon: 'ri-compass-line',
    color: 'from-purple-500 to-pink-500',
    desc: '面对问题时方案调整的速度与幅度',
    weight: 25,
  },
];

const QUICK_COMMENTS = [
  '项目完成度高，商业逻辑清晰，团队协作良好。',
  '创意新颖，市场定位精准，建议进一步完善财务模型。',
  '技术方案可行，迭代能力突出，数据驱动思维值得肯定。',
  '整体表现良好，建议加强竞品分析，明确差异化策略。',
  '进度有所滞后，需加快推进，建议教师重点关注。',
];

export default function TeamScoringModal({ team, onClose, onSubmit }: TeamScoringModalProps) {
  const [activeTab, setActiveTab] = useState<'project' | 'iteration' | 'summary'>('project');

  // 项目完成评分
  const [projectDimScores, setProjectDimScores] = useState<Record<string, number>>({
    technical: team.projectScore ?? 80,
    business: team.projectScore ?? 80,
    market: team.projectScore ?? 80,
  });

  // 迭代增值评分
  const [iterDimScores, setIterDimScores] = useState<Record<string, number>>({
    iterCount: team.iterationScore ?? 80,
    dataDecision: team.iterationScore ?? 80,
    adaptability: team.iterationScore ?? 80,
  });

  const [retrospectiveBonus, setRetrospectiveBonus] = useState(0);
  const [comment, setComment] = useState('');
  const [reviewer, setReviewer] = useState(team.reviewer ?? '李教授');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // 计算加权分
  const calcProjectScore = () => {
    return Math.round(
      SCORE_DIMENSIONS.reduce((sum, d) => sum + (projectDimScores[d.key] * d.weight) / 100, 0)
    );
  };

  const calcIterScore = () => {
    return Math.round(
      ITERATION_DIMENSIONS.reduce((sum, d) => sum + (iterDimScores[d.key] * d.weight) / 100, 0)
    );
  };

  const projectScore = calcProjectScore();
  const iterScore = calcIterScore();
  const baseScore = Math.round(projectScore * 0.5 + iterScore * 0.5);
  const finalScore = Math.min(100, baseScore + retrospectiveBonus);

  const getScoreLevel = (score: number) => {
    if (score >= 90) return { label: '优秀', color: 'text-green-600', bg: 'bg-green-100' };
    if (score >= 80) return { label: '良好', color: 'text-teal-600', bg: 'bg-teal-100' };
    if (score >= 70) return { label: '中等', color: 'text-amber-600', bg: 'bg-amber-100' };
    return { label: '待改进', color: 'text-red-500', bg: 'bg-red-100' };
  };

  const handleSubmit = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitted(true);
      setTimeout(() => {
        onSubmit({
          id: team.id,
          projectScore,
          iterationScore: iterScore,
          finalScore,
          reviewer,
          comment,
          status: 'completed',
        });
      }, 1200);
    }, 1000);
  };

  const level = getScoreLevel(finalScore);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="bg-gradient-to-r from-teal-500 to-cyan-500 px-7 py-5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-white/20 rounded-2xl flex items-center justify-center">
              <i className="ri-star-line text-white text-xl"></i>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{team.teamName}</h2>
              <p className="text-white/80 text-xs mt-0.5">{team.course} · {team.status === 'in-progress' ? '继续打分' : '开始打分'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-3xl font-bold text-white">{finalScore}</div>
              <div className="text-xs text-white/80">预计最终得分</div>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            >
              <i className="ri-close-line text-lg"></i>
            </button>
          </div>
        </div>

        {/* Tab 切换 */}
        <div className="flex border-b border-gray-100 bg-white flex-shrink-0">
          {[
            { key: 'project', label: '项目完成评分', icon: 'ri-file-list-3-line' },
            { key: 'iteration', label: '迭代增值评分', icon: 'ri-refresh-line' },
            { key: 'summary', label: '汇总确认', icon: 'ri-check-double-line' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3.5 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === tab.key
                  ? 'text-teal-600 border-b-2 border-teal-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <i className={tab.icon}></i>
              {tab.label}
            </button>
          ))}
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-7">
          {submitted ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-5">
                <i className="ri-check-line text-green-600 text-4xl"></i>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">评分提交成功！</h3>
              <p className="text-gray-500 text-sm mb-4">{team.teamName} 最终得分：<strong className="text-teal-600 text-lg">{finalScore}</strong> 分</p>
              <span className={`px-4 py-1.5 rounded-full text-sm font-bold ${level.bg} ${level.color}`}>{level.label}</span>
            </div>
          ) : (
            <>
              {/* 项目完成评分 */}
              {activeTab === 'project' && (
                <div className="space-y-5">
                  <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 flex items-start gap-3">
                    <i className="ri-information-line text-teal-600 text-base mt-0.5"></i>
                    <p className="text-xs text-teal-800 leading-relaxed">
                      项目完成评分占总分 <strong>50%</strong>，从技术落地性、商业逻辑闭环、市场生存潜力三个维度综合评估。
                      当前加权得分：<strong className="text-teal-700">{projectScore} 分</strong>
                    </p>
                  </div>
                  {SCORE_DIMENSIONS.map((dim) => (
                    <div key={dim.key} className="bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-sm transition-all">
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`w-9 h-9 bg-gradient-to-br ${dim.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                          <i className={`${dim.icon} text-white text-sm`}></i>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-gray-900">{dim.label}</h4>
                            <span className="text-xs text-gray-400">权重 {dim.weight}%</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{dim.desc}</p>
                        </div>
                        <div className="text-2xl font-bold text-gray-900 w-12 text-right">
                          {projectDimScores[dim.key]}
                        </div>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={projectDimScores[dim.key]}
                        onChange={(e) =>
                          setProjectDimScores({ ...projectDimScores, [dim.key]: Number(e.target.value) })
                        }
                        className="w-full h-2 rounded-full appearance-none cursor-pointer accent-teal-500"
                      />
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>0</span>
                        <div className="flex gap-4">
                          {[60, 70, 80, 90, 100].map((v) => (
                            <button
                              key={v}
                              onClick={() => setProjectDimScores({ ...projectDimScores, [dim.key]: v })}
                              className={`px-2 py-0.5 rounded-md text-xs transition-all cursor-pointer whitespace-nowrap ${
                                projectDimScores[dim.key] === v
                                  ? 'bg-teal-500 text-white font-bold'
                                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                              }`}
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                        <span>100</span>
                      </div>
                    </div>
                  ))}
                  <div className="bg-gradient-to-r from-teal-500 to-cyan-500 rounded-2xl p-4 flex items-center justify-between text-white">
                    <span className="text-sm font-medium">项目完成加权得分</span>
                    <span className="text-3xl font-bold">{projectScore}</span>
                  </div>
                  <button
                    onClick={() => setActiveTab('iteration')}
                    className="w-full py-3 bg-teal-500 text-white text-sm font-bold rounded-xl hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    下一步：迭代增值评分 <i className="ri-arrow-right-line ml-1"></i>
                  </button>
                </div>
              )}

              {/* 迭代增值评分 */}
              {activeTab === 'iteration' && (
                <div className="space-y-5">
                  <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 flex items-start gap-3">
                    <i className="ri-information-line text-teal-600 text-base mt-0.5"></i>
                    <p className="text-xs text-teal-800 leading-relaxed">
                      迭代增值评分占总分 <strong>50%</strong>，考核迭代次数与质量、数据驱动决策、方案调整适应性。
                      当前加权得分：<strong className="text-teal-700">{iterScore} 分</strong>
                    </p>
                  </div>
                  {ITERATION_DIMENSIONS.map((dim) => (
                    <div key={dim.key} className="bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-sm transition-all">
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`w-9 h-9 bg-gradient-to-br ${dim.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                          <i className={`${dim.icon} text-white text-sm`}></i>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-gray-900">{dim.label}</h4>
                            <span className="text-xs text-gray-400">权重 {dim.weight}%</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{dim.desc}</p>
                        </div>
                        <div className="text-2xl font-bold text-gray-900 w-12 text-right">
                          {iterDimScores[dim.key]}
                        </div>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={iterDimScores[dim.key]}
                        onChange={(e) =>
                          setIterDimScores({ ...iterDimScores, [dim.key]: Number(e.target.value) })
                        }
                        className="w-full h-2 rounded-full appearance-none cursor-pointer accent-teal-500"
                      />
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>0</span>
                        <div className="flex gap-4">
                          {[60, 70, 80, 90, 100].map((v) => (
                            <button
                              key={v}
                              onClick={() => setIterDimScores({ ...iterDimScores, [dim.key]: v })}
                              className={`px-2 py-0.5 rounded-md text-xs transition-all cursor-pointer whitespace-nowrap ${
                                iterDimScores[dim.key] === v
                                  ? 'bg-teal-500 text-white font-bold'
                                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                              }`}
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                        <span>100</span>
                      </div>
                    </div>
                  ))}

                  {/* 复盘加分 */}
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <i className="ri-award-line text-amber-600 text-base"></i>
                      <h4 className="text-sm font-bold text-gray-900">败因复盘加分</h4>
                      <span className="text-xs text-gray-400">（最高 +5 分）</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {[0, 1, 3, 5].map((v) => (
                        <button
                          key={v}
                          onClick={() => setRetrospectiveBonus(v)}
                          className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                            retrospectiveBonus === v
                              ? 'bg-amber-500 text-white shadow-sm'
                              : 'bg-white border border-amber-200 text-amber-700 hover:bg-amber-100'
                          }`}
                        >
                          {v === 0 ? '不加分' : `+${v} 分`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-teal-500 to-cyan-500 rounded-2xl p-4 flex items-center justify-between text-white">
                    <span className="text-sm font-medium">迭代增值加权得分</span>
                    <span className="text-3xl font-bold">{iterScore}</span>
                  </div>
                  <button
                    onClick={() => setActiveTab('summary')}
                    className="w-full py-3 bg-teal-500 text-white text-sm font-bold rounded-xl hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    下一步：汇总确认 <i className="ri-arrow-right-line ml-1"></i>
                  </button>
                </div>
              )}

              {/* 汇总确认 */}
              {activeTab === 'summary' && (
                <div className="space-y-5">
                  {/* 分数汇总卡片 */}
                  <div className="bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl p-6 text-white">
                    <div className="flex items-center justify-between mb-5">
                      <div>
                        <h3 className="text-lg font-bold mb-0.5">{team.teamName}</h3>
                        <p className="text-white/80 text-xs">{team.course}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-5xl font-bold">{finalScore}</div>
                        <div className={`inline-block mt-1 px-3 py-0.5 rounded-full text-xs font-bold bg-white/20`}>
                          {level.label}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { label: '项目完成', value: projectScore, sub: '× 50%' },
                        { label: '迭代增值', value: iterScore, sub: '× 50%' },
                        { label: '基础总分', value: baseScore, sub: '加权合计' },
                        { label: '复盘加分', value: `+${retrospectiveBonus}`, sub: '额外奖励' },
                      ].map((item, i) => (
                        <div key={i} className="bg-white/15 rounded-xl p-3 text-center">
                          <div className="text-xs text-white/70 mb-1">{item.label}</div>
                          <div className="text-xl font-bold">{item.value}</div>
                          <div className="text-xs text-white/60">{item.sub}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 各维度得分明细 */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-5">
                    <h4 className="text-sm font-bold text-gray-900 mb-4">各维度得分明细</h4>
                    <div className="space-y-3">
                      {[...SCORE_DIMENSIONS.map(d => ({ ...d, score: projectDimScores[d.key], category: '项目完成' })),
                        ...ITERATION_DIMENSIONS.map(d => ({ ...d, score: iterDimScores[d.key], category: '迭代增值' }))
                      ].map((dim, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className={`w-7 h-7 bg-gradient-to-br ${dim.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                            <i className={`${dim.icon} text-white text-xs`}></i>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-gray-700">{dim.label}</span>
                              <span className="text-xs font-bold text-gray-900">{dim.score}</span>
                            </div>
                            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full bg-gradient-to-r ${dim.color} rounded-full`}
                                style={{ width: `${dim.score}%` }}
                              ></div>
                            </div>
                          </div>
                          <span className="text-xs text-gray-400 flex-shrink-0 w-14 text-right">{dim.category}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 评阅人 */}
                  <div>
                    <label className="block text-sm font-bold text-gray-900 mb-2">评阅人</label>
                    <input
                      type="text"
                      value={reviewer}
                      onChange={(e) => setReviewer(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  {/* 评语 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-bold text-gray-900">评语</label>
                      <span className="text-xs text-gray-400">快速选择：</span>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {QUICK_COMMENTS.map((qc, i) => (
                        <button
                          key={i}
                          onClick={() => setComment(qc)}
                          className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg hover:bg-teal-50 hover:text-teal-700 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          {qc.slice(0, 12)}…
                        </button>
                      ))}
                    </div>
                    <textarea
                      rows={3}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="填写对该团队的综合评语（可选）..."
                      className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                    />
                  </div>

                  {/* 提交按钮 */}
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className={`w-full py-3.5 text-sm font-bold rounded-xl transition-all whitespace-nowrap ${
                      isSubmitting
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white hover:shadow-lg cursor-pointer'
                    }`}
                  >
                    {isSubmitting ? (
                      <><i className="ri-loader-4-line animate-spin mr-2"></i>提交中...</>
                    ) : (
                      <><i className="ri-check-double-line mr-2"></i>确认提交评分（{finalScore} 分）</>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
