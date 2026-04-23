import { useState } from 'react';

interface TeamEvaluation {
  id: number;
  name: string;
  status: 'completed' | 'pending';
  projectScore: number;
  iterationScore: number;
  totalScore: number;
  retrospectiveBonus: number;
  finalScore: number;
  reviewer: string;
  reviewTime: string;
  comment: string;
  projectDimensions: { name: string; score: number; comment: string }[];
  iterationDimensions: { name: string; score: number; value: string; comment: string }[];
}

const evaluationTeams: TeamEvaluation[] = [
  {
    id: 1,
    name: '创新先锋队',
    status: 'completed',
    projectScore: 88,
    iterationScore: 92,
    totalScore: 90,
    retrospectiveBonus: 5,
    finalScore: 95,
    reviewer: '王老师',
    reviewTime: '2024-03-15 14:30',
    comment: '项目整体完成度高，商业逻辑清晰，团队协作良好。迭代优化过程体现了很强的数据驱动思维，值得肯定。建议进一步优化成本控制方案。',
    projectDimensions: [
      { name: '技术落地性', score: 90, comment: '产品原型完整，技术方案可行，功能实现度高' },
      { name: '商业逻辑闭环', score: 85, comment: '商业模式清晰，盈利路径明确，但成本控制需加强' },
      { name: '市场生存潜力', score: 89, comment: '市场需求真实，竞争优势明显，用户画像精准' },
    ],
    iterationDimensions: [
      { name: '迭代次数', score: 95, value: '3次', comment: '完成3轮完整的构建-衡量-学习循环' },
      { name: '方案修改幅度', score: 88, value: '重大调整2次', comment: '基于数据进行了2次重大方向调整' },
      { name: '数据驱动决策', score: 93, value: '支撑率95%', comment: '所有决策均有充分的数据支撑' },
    ],
  },
  {
    id: 2,
    name: '未来科技组',
    status: 'completed',
    projectScore: 85,
    iterationScore: 88,
    totalScore: 86.5,
    retrospectiveBonus: 3,
    finalScore: 89.5,
    reviewer: '王老师',
    reviewTime: '2024-03-15 16:20',
    comment: '项目定位清晰，技术实现较好。迭代过程中能够根据反馈及时调整，展现了良好的学习能力。建议加强市场调研深度。',
    projectDimensions: [
      { name: '技术落地性', score: 88, comment: '技术方案合理，实现质量较高' },
      { name: '商业逻辑闭环', score: 82, comment: '商业模式基本清晰，盈利模式需进一步完善' },
      { name: '市场生存潜力', score: 86, comment: '市场定位准确，但竞争分析不够深入' },
    ],
    iterationDimensions: [
      { name: '迭代次数', score: 90, value: '2次', comment: '完成2轮有效迭代' },
      { name: '方案修改幅度', score: 85, value: '中等调整', comment: '根据反馈进行了合理调整' },
      { name: '数据驱动决策', score: 89, value: '支撑率88%', comment: '大部分决策有数据支撑' },
    ],
  },
  {
    id: 3,
    name: '绿色能源队',
    status: 'pending',
    projectScore: 0,
    iterationScore: 0,
    totalScore: 0,
    retrospectiveBonus: 0,
    finalScore: 0,
    reviewer: '',
    reviewTime: '',
    comment: '',
    projectDimensions: [],
    iterationDimensions: [],
  },
  {
    id: 4,
    name: '智慧医疗团',
    status: 'pending',
    projectScore: 0,
    iterationScore: 0,
    totalScore: 0,
    retrospectiveBonus: 0,
    finalScore: 0,
    reviewer: '',
    reviewTime: '',
    comment: '',
    projectDimensions: [],
    iterationDimensions: [],
  },
  {
    id: 5,
    name: '数字营销组',
    status: 'pending',
    projectScore: 0,
    iterationScore: 0,
    totalScore: 0,
    retrospectiveBonus: 0,
    finalScore: 0,
    reviewer: '',
    reviewTime: '',
    comment: '',
    projectDimensions: [],
    iterationDimensions: [],
  },
  {
    id: 6,
    name: '区块链探索队',
    status: 'completed',
    projectScore: 92,
    iterationScore: 95,
    totalScore: 93.5,
    retrospectiveBonus: 5,
    finalScore: 98.5,
    reviewer: '王老师',
    reviewTime: '2024-03-16 10:00',
    comment: '项目完成度极高，迭代能力突出，数据驱动决策贯穿全程，是本班最优秀的团队之一。',
    projectDimensions: [
      { name: '技术落地性', score: 94, comment: '技术实现完整，产品可用性强' },
      { name: '商业逻辑闭环', score: 91, comment: '商业模式完善，盈利路径清晰' },
      { name: '市场生存潜力', score: 92, comment: '市场空间大，竞争壁垒明显' },
    ],
    iterationDimensions: [
      { name: '迭代次数', score: 98, value: '4次', comment: '完成4轮高质量迭代' },
      { name: '方案修改幅度', score: 93, value: '重大调整3次', comment: '每次调整均有显著改善' },
      { name: '数据驱动决策', score: 95, value: '支撑率98%', comment: '几乎所有决策均有数据支撑' },
    ],
  },
];

const gradeDistribution = [
  { range: '90分以上', count: 8, percentage: 20, color: 'from-green-500 to-emerald-500' },
  { range: '80-90分', count: 15, percentage: 37.5, color: 'from-teal-500 to-cyan-500' },
  { range: '70-80分', count: 12, percentage: 30, color: 'from-amber-400 to-orange-400' },
  { range: '60-70分', count: 4, percentage: 10, color: 'from-orange-500 to-red-400' },
  { range: '60分以下', count: 1, percentage: 2.5, color: 'from-red-500 to-pink-500' },
];

function TeamDetailModal({ team, onClose }: { team: TeamEvaluation; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 z-10 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{team.name} · 评分明细</h3>
            <p className="text-xs text-gray-500 mt-0.5">最终得分：<span className="text-teal-600 font-bold text-base">{team.finalScore}</span></p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer rounded-lg hover:bg-gray-100">
            <i className="ri-close-line text-lg"></i>
          </button>
        </div>
        <div className="p-6 space-y-5">
          {/* 评分概览 */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: '项目完成', value: team.projectScore, color: 'from-teal-500 to-cyan-500' },
              { label: '迭代增值', value: team.iterationScore, color: 'from-amber-500 to-orange-500' },
              { label: '基础总分', value: team.totalScore, color: 'from-green-500 to-emerald-500' },
              { label: '复盘加分', value: `+${team.retrospectiveBonus}`, color: 'from-rose-500 to-pink-500' },
            ].map((item, i) => (
              <div key={i} className={`bg-gradient-to-br ${item.color} rounded-xl p-4 text-white`}>
                <div className="text-xs text-white/80 mb-1">{item.label}</div>
                <div className="text-2xl font-bold">{item.value}</div>
              </div>
            ))}
          </div>

          {/* 项目完成维度 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-gray-900 mb-4">项目完成维度评分</h4>
            <div className="space-y-4">
              {team.projectDimensions.map((dim, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-800">{dim.name}</span>
                    <span className="text-sm font-bold text-teal-600">{dim.score}</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">{dim.comment}</p>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full" style={{ width: `${dim.score}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 迭代增值维度 */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-gray-900 mb-4">迭代增值维度评分</h4>
            <div className="space-y-4">
              {team.iterationDimensions.map((dim, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800">{dim.name}</span>
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full whitespace-nowrap">{dim.value}</span>
                    </div>
                    <span className="text-sm font-bold text-amber-600">{dim.score}</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">{dim.comment}</p>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full" style={{ width: `${dim.score}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 评阅信息 */}
          <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <i className="ri-user-line text-gray-400"></i>
              <span>评阅人：</span><span className="font-medium text-gray-900">{team.reviewer}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <i className="ri-time-line text-gray-400"></i>
              <span>评阅时间：</span><span className="font-medium text-gray-900">{team.reviewTime}</span>
            </div>
          </div>

          {/* 综合评语 */}
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
            <h5 className="text-xs font-bold text-teal-800 mb-2">综合评语</h5>
            <p className="text-sm text-teal-700 leading-relaxed">{team.comment}</p>
          </div>

          <button onClick={onClose} className="w-full py-2.5 bg-teal-500 text-white text-sm font-medium rounded-xl hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap">
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EvaluationPanel() {
  const [activeTab, setActiveTab] = useState<'overview' | 'progress' | 'distribution'>('overview');
  const [selectedTeam, setSelectedTeam] = useState<TeamEvaluation | null>(null);

  const completedCount = evaluationTeams.filter((t) => t.status === 'completed').length;
  const pendingCount = evaluationTeams.filter((t) => t.status === 'pending').length;
  const avgScore = evaluationTeams.filter((t) => t.status === 'completed').reduce((s, t) => s + t.finalScore, 0) / completedCount || 0;

  const tabs = [
    { key: 'overview', label: '评价总览', icon: 'ri-dashboard-line' },
    { key: 'progress', label: '评价进度', icon: 'ri-list-check-2' },
    { key: 'distribution', label: '成绩分布', icon: 'ri-bar-chart-box-line' },
  ] as const;

  return (
    <div className="space-y-5">
      {/* 顶部统计卡片 */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: '参评团队', value: evaluationTeams.length, icon: 'ri-team-line', color: 'from-teal-500 to-cyan-500' },
          { label: '已完成评价', value: completedCount, icon: 'ri-checkbox-circle-line', color: 'from-green-500 to-emerald-500' },
          { label: '待评价', value: pendingCount, icon: 'ri-time-line', color: 'from-amber-500 to-orange-500' },
          { label: '平均分', value: avgScore.toFixed(1), icon: 'ri-trophy-line', color: 'from-rose-500 to-pink-500' },
        ].map((card, i) => (
          <div key={i} className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center flex-shrink-0`}>
              <i className={`${card.icon} text-white text-base`}></i>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{card.value}</div>
              <div className="text-xs text-gray-500">{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 双维说明横幅 */}
      <div className="bg-gradient-to-r from-teal-500 to-cyan-500 rounded-xl px-6 py-4 flex items-center justify-between text-white">
        <div className="flex items-center gap-3">
          <i className="ri-information-line text-xl text-white/80"></i>
          <div>
            <div className="text-sm font-bold">双维评价模型</div>
            <div className="text-xs text-white/80 mt-0.5">总成绩 = 项目完成情况 × 50% + 迭代增值情况 × 50% + 败因复盘加分</div>
          </div>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div className="text-center">
            <div className="text-xl font-bold">50%</div>
            <div className="text-xs text-white/80">项目完成</div>
          </div>
          <div className="text-white/40 text-lg">+</div>
          <div className="text-center">
            <div className="text-xl font-bold">50%</div>
            <div className="text-xs text-white/80">迭代增值</div>
          </div>
          <div className="text-white/40 text-lg">+</div>
          <div className="text-center">
            <div className="text-xl font-bold">+5</div>
            <div className="text-xs text-white/80">复盘加分</div>
          </div>
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === tab.key
                  ? 'text-teal-600 border-b-2 border-teal-500 bg-teal-50/50'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <i className={`${tab.icon} text-base`}></i>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* 评价总览 */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* 三大维度 */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { name: '技术落地性', score: 90, desc: '产品原型完整，技术方案可行', icon: 'ri-code-box-line', color: 'teal' },
                  { name: '商业逻辑闭环', score: 85, desc: '商业模式清晰，盈利路径明确', icon: 'ri-briefcase-line', color: 'amber' },
                  { name: '市场生存潜力', score: 89, desc: '市场需求真实，竞争优势明显', icon: 'ri-line-chart-line', color: 'green' },
                ].map((dim, i) => (
                  <div key={i} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-9 h-9 flex items-center justify-center rounded-lg ${
                        dim.color === 'teal' ? 'bg-teal-100 text-teal-600' :
                        dim.color === 'amber' ? 'bg-amber-100 text-amber-600' :
                        'bg-green-100 text-green-600'
                      }`}>
                        <i className={`${dim.icon} text-base`}></i>
                      </div>
                      <span className={`text-2xl font-bold ${
                        dim.color === 'teal' ? 'text-teal-600' :
                        dim.color === 'amber' ? 'text-amber-600' :
                        'text-green-600'
                      }`}>{dim.score}</span>
                    </div>
                    <div className="text-sm font-semibold text-gray-900 mb-1">{dim.name}</div>
                    <div className="text-xs text-gray-500 mb-3">{dim.desc}</div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          dim.color === 'teal' ? 'bg-gradient-to-r from-teal-500 to-cyan-500' :
                          dim.color === 'amber' ? 'bg-gradient-to-r from-amber-500 to-orange-500' :
                          'bg-gradient-to-r from-green-500 to-emerald-500'
                        }`}
                        style={{ width: `${dim.score}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 迭代增值维度 */}
              <div className="border border-gray-200 rounded-xl p-5">
                <h4 className="text-sm font-bold text-gray-900 mb-4">迭代增值维度</h4>
                <div className="space-y-4">
                  {[
                    { name: '迭代次数', score: 95, value: '3次完整迭代', desc: '完成3轮构建-衡量-学习循环' },
                    { name: '方案修改幅度', score: 88, value: '重大调整2次', desc: '基于数据进行了2次重大方向调整' },
                    { name: '数据驱动决策', score: 93, value: '数据支撑率95%', desc: '所有决策均有数据支撑' },
                  ].map((dim, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <div className="w-28 flex-shrink-0 text-sm font-medium text-gray-800">{dim.name}</div>
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full whitespace-nowrap flex-shrink-0">{dim.value}</span>
                      <div className="flex-1">
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full" style={{ width: `${dim.score}%` }}></div>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-amber-600 w-8 text-right flex-shrink-0">{dim.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 评价进度 */}
          {activeTab === 'progress' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['团队名称', '项目完成', '迭代增值', '基础分', '复盘加分', '最终得分', '状态', '操作'].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-500 pb-3 pr-4 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {evaluationTeams.map((team) => (
                    <tr key={team.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="py-3 pr-4 font-medium text-gray-900 whitespace-nowrap">{team.name}</td>
                      <td className="py-3 pr-4 text-gray-700">{team.status === 'completed' ? team.projectScore : <span className="text-gray-300">—</span>}</td>
                      <td className="py-3 pr-4 text-gray-700">{team.status === 'completed' ? team.iterationScore : <span className="text-gray-300">—</span>}</td>
                      <td className="py-3 pr-4 text-gray-700">{team.status === 'completed' ? team.totalScore : <span className="text-gray-300">—</span>}</td>
                      <td className="py-3 pr-4">
                        {team.status === 'completed' && team.retrospectiveBonus > 0 ? (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full whitespace-nowrap">+{team.retrospectiveBonus}</span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-3 pr-4">
                        {team.status === 'completed' ? (
                          <span className="text-base font-bold text-teal-600">{team.finalScore}</span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-3 pr-4">
                        {team.status === 'completed' ? (
                          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full whitespace-nowrap">已完成</span>
                        ) : (
                          <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full whitespace-nowrap">待评价</span>
                        )}
                      </td>
                      <td className="py-3">
                        {team.status === 'completed' ? (
                          <button
                            onClick={() => setSelectedTeam(team)}
                            className="px-3 py-1.5 bg-teal-500 text-white text-xs font-medium rounded-lg hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <i className="ri-eye-line mr-1"></i>查看详情
                          </button>
                        ) : (
                          <button className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap">
                            <i className="ri-edit-line mr-1"></i>开始评价
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 成绩分布 */}
          {activeTab === 'distribution' && (
            <div className="space-y-5">
              <div className="space-y-3">
                {gradeDistribution.map((grade, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-800 w-20">{grade.range}</span>
                        <span className="text-xs text-gray-400">{grade.count} 个团队</span>
                      </div>
                      <span className="text-sm font-bold text-gray-700">{grade.percentage}%</span>
                    </div>
                    <div className="w-full h-7 bg-gray-100 rounded-lg overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${grade.color} rounded-lg flex items-center justify-end pr-3 transition-all duration-500`}
                        style={{ width: `${grade.percentage}%` }}
                      >
                        <span className="text-white text-xs font-bold">{grade.count}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-4 gap-4 pt-4 border-t border-gray-100">
                {[
                  { label: '总团队数', value: '40', color: 'text-gray-900' },
                  { label: '平均分', value: '85.2', color: 'text-teal-600' },
                  { label: '最高分', value: '98.5', color: 'text-green-600' },
                  { label: '最低分', value: '58', color: 'text-amber-600' },
                ].map((item, i) => (
                  <div key={i} className="text-center bg-gray-50 rounded-xl py-4">
                    <div className={`text-2xl font-bold ${item.color} mb-1`}>{item.value}</div>
                    <div className="text-xs text-gray-500">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 团队详情弹窗 */}
      {selectedTeam && (
        <TeamDetailModal team={selectedTeam} onClose={() => setSelectedTeam(null)} />
      )}
    </div>
  );
}
