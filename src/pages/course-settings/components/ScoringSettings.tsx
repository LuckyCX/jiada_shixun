
import { useState } from 'react';

interface ScoreItem {
  id: string;
  stage: string;
  icon: string;
  color: string;
  weight: number; // 占总分百分比
  totalScore: number;
  criteria: ScoreCriterion[];
}

interface ScoreCriterion {
  id: string;
  name: string;
  score: number;
  description: string;
  type: 'process' | 'result' | 'collaboration';
}

const typeMap = {
  process: { label: '过程分', color: 'bg-teal-100 text-teal-600' },
  result: { label: '成果分', color: 'bg-indigo-100 text-indigo-600' },
  collaboration: { label: '协作分', color: 'bg-amber-100 text-amber-600' },
};

const defaultScoring: ScoreItem[] = [
  {
    id: 'team-formation',
    stage: '组队阶段',
    icon: 'ri-team-line',
    color: 'from-teal-500 to-cyan-500',
    weight: 5,
    totalScore: 100,
    criteria: [
      { id: 'tf-1', name: '团队完整性', score: 30, description: '团队成员数量达标（3-5人），分工明确', type: 'process' },
      { id: 'tf-2', name: '分工合理性', score: 40, description: '各成员职责清晰，技能互补', type: 'collaboration' },
      { id: 'tf-3', name: '团队协议', score: 30, description: '提交团队合作协议，规则完整', type: 'result' },
    ],
  },
  {
    id: 'ideation',
    stage: '创新思维',
    icon: 'ri-lightbulb-line',
    color: 'from-amber-500 to-orange-500',
    weight: 10,
    totalScore: 100,
    criteria: [
      { id: 'id-1', name: 'SCAMPER应用', score: 35, description: '正确运用SCAMPER方法产出创意', type: 'process' },
      { id: 'id-2', name: '创意数量与质量', score: 35, description: '产出不少于10个创意，质量达标', type: 'result' },
      { id: 'id-3', name: '知识检测达标', score: 30, description: '创新思维知识检测得分≥60分', type: 'result' },
    ],
  },
  {
    id: 'market-research',
    stage: '市场调研',
    icon: 'ri-bar-chart-line',
    color: 'from-indigo-500 to-violet-500',
    weight: 15,
    totalScore: 100,
    criteria: [
      { id: 'mr-1', name: '调研方法规范性', score: 25, description: '问卷/访谈设计规范，样本量≥30', type: 'process' },
      { id: 'mr-2', name: '用户画像完整性', score: 30, description: '用户画像要素完整，逻辑清晰', type: 'result' },
      { id: 'mr-3', name: '竞品分析深度', score: 25, description: '竞品分析不少于3个，维度全面', type: 'result' },
      { id: 'mr-4', name: '团队协作贡献', score: 20, description: '成员均有实质性贡献，协作记录完整', type: 'collaboration' },
    ],
  },
  {
    id: 'product-design',
    stage: '产品设计',
    icon: 'ri-pencil-ruler-line',
    color: 'from-pink-500 to-rose-500',
    weight: 15,
    totalScore: 100,
    criteria: [
      { id: 'pd-1', name: '原型完整性', score: 30, description: '核心功能原型完整，交互逻辑清晰', type: 'result' },
      { id: 'pd-2', name: '迭代优化记录', score: 25, description: '有明确的迭代记录，版本管理规范', type: 'process' },
      { id: 'pd-3', name: '用户反馈整合', score: 25, description: '收集用户反馈并有效整合到设计中', type: 'process' },
      { id: 'pd-4', name: '设计规范性', score: 20, description: '视觉设计统一，符合用户体验原则', type: 'result' },
    ],
  },
  {
    id: 'business-model',
    stage: '商业模式',
    icon: 'ri-layout-grid-line',
    color: 'from-green-500 to-emerald-500',
    weight: 15,
    totalScore: 100,
    criteria: [
      { id: 'bm-1', name: '画布完整性', score: 35, description: '商业模式画布9个模块均完整填写', type: 'result' },
      { id: 'bm-2', name: '逻辑自洽性', score: 35, description: '各模块逻辑关联紧密，商业逻辑自洽', type: 'result' },
      { id: 'bm-3', name: '创新性', score: 30, description: '商业模式有明显创新点，差异化明确', type: 'result' },
    ],
  },
  {
    id: 'business-plan',
    stage: '商业计划书',
    icon: 'ri-file-text-line',
    color: 'from-orange-500 to-red-500',
    weight: 25,
    totalScore: 100,
    criteria: [
      { id: 'bp-1', name: '内容完整性', score: 25, description: '包含执行摘要、市场分析、财务预测等核心章节', type: 'result' },
      { id: 'bp-2', name: '数据支撑', score: 25, description: '关键数据有来源，财务预测合理', type: 'result' },
      { id: 'bp-3', name: '路演表现', score: 25, description: '路演表达清晰，回答问题准确', type: 'process' },
      { id: 'bp-4', name: '团队协作', score: 25, description: '分工明确，全员参与路演', type: 'collaboration' },
    ],
  },
  {
    id: 'overall',
    stage: '综合评价',
    icon: 'ri-award-line',
    color: 'from-purple-500 to-violet-500',
    weight: 15,
    totalScore: 100,
    criteria: [
      { id: 'ov-1', name: '全程参与度', score: 30, description: '全程积极参与，出勤率≥90%', type: 'process' },
      { id: 'ov-2', name: '知识体系掌握', score: 35, description: '知识检测综合达标率≥70%', type: 'result' },
      { id: 'ov-3', name: '团队贡献度', score: 35, description: '个人贡献度评分（同伴互评）', type: 'collaboration' },
    ],
  },
];

export default function ScoringSettings() {
  const [scoring, setScoring] = useState<ScoreItem[]>(defaultScoring);
  const [expandedId, setExpandedId] = useState<string | null>('market-research');
  const [editingCriterion, setEditingCriterion] = useState<{ stageId: string; criterionId: string } | null>(null);
  const [editForm, setEditForm] = useState<Partial<ScoreCriterion>>({});
  const [editingWeight, setEditingWeight] = useState<string | null>(null);
  const [weightForm, setWeightForm] = useState<number>(0);
  const [saved, setSaved] = useState(false);

  const totalWeight = scoring.reduce((s, item) => s + item.weight, 0);

  const handleEditCriterion = (stageId: string, criterion: ScoreCriterion) => {
    setEditingCriterion({ stageId, criterionId: criterion.id });
    setEditForm({
      name: criterion.name,
      score: criterion.score,
      description: criterion.description,
      type: criterion.type,
    });
  };

  const handleSaveCriterion = () => {
    if (!editingCriterion) return;
    setScoring(prev =>
      prev.map(stage => {
        if (stage.id !== editingCriterion.stageId) return stage;
        return {
          ...stage,
          criteria: stage.criteria.map(c =>
            c.id === editingCriterion.criterionId ? { ...c, ...editForm } as ScoreCriterion : c,
          ),
        };
      }),
    );
    setEditingCriterion(null);
    setEditForm({});
  };

  const handleEditWeight = (stage: ScoreItem) => {
    setEditingWeight(stage.id);
    setWeightForm(stage.weight);
  };

  const handleSaveWeight = (stageId: string) => {
    setScoring(prev => prev.map(s => (s.id === stageId ? { ...s, weight: weightForm } : s)));
    setEditingWeight(null);
  };

  const handleSaveAll = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-5">
      {/* 顶部权重总览 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <i className="ri-scales-3-line text-teal-500"></i>
              评分标准与权重配置
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              配置各阶段评分权重及具体评分细则，总权重须等于100%
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold ${
                totalWeight === 100 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
              }`}
            >
              <i
                className={`${
                  totalWeight === 100 ? 'ri-check-circle-line' : 'ri-error-warning-line'
                } text-base`}
              ></i>
              总权重：{totalWeight}%
            </div>
            <button
              onClick={handleSaveAll}
              className="px-4 py-2 bg-teal-500 text-white text-sm font-medium rounded-xl hover:bg-teal-600 transition-colors whitespace-nowrap cursor-pointer"
            >
              <i className="ri-save-line mr-1.5"></i>保存评分标准
            </button>
          </div>
        </div>

        {/* 权重可视化条 */}
        <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
          {scoring.map(item => (
            <div
              key={item.id}
              className={`bg-gradient-to-r ${item.color} transition-all`}
              style={{ width: `${item.weight}%` }}
              title={`${item.stage}: ${item.weight}%`}
            ></div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 mt-3">
          {scoring.map(item => (
            <div key={item.id} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-full bg-gradient-to-br ${item.color}`}></div>
              <span className="text-xs text-gray-500">{item.stage}</span>
              <span className="text-xs font-bold text-gray-700">{item.weight}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* 各阶段评分详情 */}
      <div className="space-y-3">
        {scoring.map(stage => (
          <div key={stage.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* 阶段标题行 */}
            <div
              className="flex items-center justify-between p-5 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => setExpandedId(expandedId === stage.id ? null : stage.id)}
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${stage.color} flex items-center justify-center flex-shrink-0`}>
                  <i className={`${stage.icon} text-white text-sm`}></i>
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900">{stage.stage}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {stage.criteria.length} 项评分细则 · 满分 {stage.totalScore} 分
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* 权重编辑 */}
                {editingWeight === stage.id ? (
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={weightForm}
                      onChange={e => setWeightForm(Number(e.target.value))}
                      className="w-16 px-2 py-1 text-sm border border-teal-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-center"
                    />
                    <span className="text-sm text-gray-500">%</span>
                    <button
                      onClick={() => handleSaveWeight(stage.id)}
                      className="px-2 py-1 bg-teal-500 text-white text-xs rounded-lg cursor-pointer whitespace-nowrap"
                    >
                      确定
                    </button>
                    <button
                      onClick={() => setEditingWeight(null)}
                      className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-lg cursor-pointer whitespace-nowrap"
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <div
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-xl hover:bg-teal-50 transition-colors cursor-pointer"
                    onClick={e => {
                      e.stopPropagation();
                      handleEditWeight(stage);
                    }}
                  >
                    <span className="text-sm font-bold text-gray-700">占比 {stage.weight}%</span>
                    <i className="ri-edit-line text-gray-400 text-xs"></i>
                  </div>
                )}
                <i
                  className={`${
                    expandedId === stage.id ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'
                  } text-gray-400 text-lg`}
                ></i>
              </div>
            </div>

            {/* 展开的评分细则 */}
            {expandedId === stage.id && (
              <div className="border-t border-gray-100 p-5 space-y-3">
                {/* 分值合计校验 */}
                {(() => {
                  const total = stage.criteria.reduce((s, c) => s + c.score, 0);
                  return total !== stage.totalScore ? (
                    <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600">
                      <i className="ri-error-warning-line"></i>
                      当前各项分值合计为 {total} 分，与满分 {stage.totalScore} 分不符，请调整
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-100 rounded-xl text-xs text-green-600">
                      <i className="ri-check-circle-line"></i>
                      各项分值合计 {total} 分，与满分一致 ✓
                    </div>
                  );
                })()}

                {stage.criteria.map(criterion => (
                  <div key={criterion.id} className="border border-gray-100 rounded-xl overflow-hidden">
                    {editingCriterion?.stageId === stage.id && editingCriterion?.criterionId === criterion.id ? (
                      /* 编辑模式 */
                      <div className="p-4 bg-teal-50 space-y-3">
                        <div className="grid grid-cols-3 gap-3">
                          <div className="col-span-2">
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              评分项名称
                            </label>
                            <input
                              type="text"
                              value={editForm.name || ''}
                              onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              分值（满分{stage.totalScore}）
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={stage.totalScore}
                              value={editForm.score ?? ''}
                              onChange={e => setEditForm(f => ({ ...f, score: Number(e.target.value) }))}
                              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            评分说明
                          </label>
                          <textarea
                            value={editForm.description || ''}
                            onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                            rows={2}
                            maxLength={200}
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white resize-none"
                          ></textarea>
                        </div>
                        <div className="flex items-center gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              评分类型
                            </label>
                            <div className="flex gap-2">
                              {(Object.keys(typeMap) as Array<keyof typeof typeMap>).map(t => (
                                <button
                                  key={t}
                                  onClick={() => setEditForm(f => ({ ...f, type: t }))}
                                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                                    editForm.type === t
                                      ? `${typeMap[t].color} ring-2 ring-offset-1 ring-teal-300`
                                      : 'bg-white border border-gray-200 text-gray-500'
                                  }`}
                                >
                                  {typeMap[t].label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="flex-1"></div>
                          <button
                            onClick={() => {
                              setEditingCriterion(null);
                              setEditForm({});
                            }}
                            className="px-4 py-2 bg-white border border-gray-200 text-gray-600 text-sm rounded-xl hover:bg-gray-50 cursor-pointer whitespace-nowrap"
                          >
                            取消
                          </button>
                          <button
                            onClick={handleSaveCriterion}
                            className="px-4 py-2 bg-teal-500 text-white text-sm rounded-xl hover:bg-teal-600 cursor-pointer whitespace-nowrap"
                          >
                            <i className="ri-check-line mr-1"></i>保存
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* 展示模式 */
                      <div className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors">
                        <div className="w-12 h-12 flex-shrink-0 flex flex-col items-center justify-center bg-gray-50 rounded-xl">
                          <span className="text-lg font-black text-gray-800">{criterion.score}</span>
                          <span className="text-xs text-gray-400">分</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-bold text-gray-900">{criterion.name}</span>
                            <span
                              className={`px-1.5 py-0.5 text-xs font-medium rounded-md ${typeMap[criterion.type].color}`}
                            >
                              {typeMap[criterion.type].label}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 leading-relaxed">{criterion.description}</p>
                        </div>
                        <div className="w-24 flex-shrink-0">
                          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full bg-gradient-to-r ${stage.color} rounded-full`}
                              style={{ width: `${criterion.score}%` }}
                            ></div>
                          </div>
                          <div className="text-xs text-gray-400 text-right mt-0.5">
                            {criterion.score}/{stage.totalScore}
                          </div>
                        </div>
                        <button
                          onClick={() => handleEditCriterion(stage.id, criterion)}
                          className="flex-shrink-0 px-3 py-1.5 bg-gray-50 text-gray-500 text-xs rounded-xl hover:bg-teal-50 hover:text-teal-600 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <i className="ri-edit-line mr-1"></i>编辑
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {saved && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-xl">
          <i className="ri-check-circle-fill text-green-400 text-lg"></i>
          <span className="text-sm font-medium">评分标准已保存！</span>
        </div>
      )}
    </div>
  );
}
