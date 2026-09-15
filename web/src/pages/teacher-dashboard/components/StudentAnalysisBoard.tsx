import React, { useState } from 'react';
import AppModalPortal from '../../../components/AppModalPortal';

interface StudentData {
  id: number;
  name: string;
  team: string;
  course: string;
  knowledgeRate: number;
  testPassRate: number;
  caseViewTime: number;
  taskQuality: number;
  questionFreq: number;
  collabScore: number;
  abilityPoints: number;
  iterationCount: number;
  status: 'excellent' | 'normal' | 'at-risk' | 'lagging';
  currentStage: string;
  lastActive: string;
  testFailCount: number;
  submitCount: number;
  objectiveScore?: number; // 新增：客观过程得分
}

const mockStudents: StudentData[] = [
  { id: 1, name: '林晓', team: 'AI+养老创业组', course: '创新创业实训B班', knowledgeRate: 98, testPassRate: 96, caseViewTime: 12.5, taskQuality: 94, questionFreq: 8, collabScore: 97, abilityPoints: 42, iterationCount: 5, status: 'excellent', currentStage: '商业计划', lastActive: '30分钟前', testFailCount: 0, submitCount: 14, objectiveScore: 96 },
  { id: 2, name: '黄磊', team: 'AI+养老创业组', course: '创新创业实训B班', knowledgeRate: 95, testPassRate: 92, caseViewTime: 10.2, taskQuality: 91, questionFreq: 6, collabScore: 94, abilityPoints: 38, iterationCount: 4, status: 'excellent', currentStage: '商业计划', lastActive: '1小时前', testFailCount: 0, submitCount: 12, objectiveScore: 93 },
  { id: 3, name: '张明', team: '创新科技团队', course: '创新创业实训A班', knowledgeRate: 82, testPassRate: 85, caseViewTime: 8.3, taskQuality: 88, questionFreq: 5, collabScore: 92, abilityPoints: 18, iterationCount: 3, status: 'normal', currentStage: '商业模式', lastActive: '2小时前', testFailCount: 1, submitCount: 7, objectiveScore: 87 },
  { id: 4, name: '郑浩', team: '文化创意工作室', course: '创新创业实训A班', knowledgeRate: 78, testPassRate: 80, caseViewTime: 7.1, taskQuality: 82, questionFreq: 4, collabScore: 85, abilityPoints: 15, iterationCount: 2, status: 'normal', currentStage: '产品设计', lastActive: '5小时前', testFailCount: 1, submitCount: 6, objectiveScore: 82 },
  { id: 5, name: '陈雪', team: '智慧农业小组', course: '创新创业实训A班', knowledgeRate: 62, testPassRate: 65, caseViewTime: 5.4, taskQuality: 72, questionFreq: 3, collabScore: 65, abilityPoints: 12, iterationCount: 1, status: 'at-risk', currentStage: '市场调研', lastActive: '1天前', testFailCount: 2, submitCount: 4, objectiveScore: 66 },
  { id: 6, name: '刘洋', team: '智慧农业小组', course: '创新创业实训A班', knowledgeRate: 45, testPassRate: 42, caseViewTime: 3.2, taskQuality: 65, questionFreq: 2, collabScore: 58, abilityPoints: 8, iterationCount: 1, status: 'lagging', currentStage: '创新思维', lastActive: '2天前', testFailCount: 3, submitCount: 3, objectiveScore: 52 },
  { id: 7, name: '冯涛', team: '乡村振兴数字化', course: '创新创业实训B班', knowledgeRate: 55, testPassRate: 58, caseViewTime: 4.1, taskQuality: 68, questionFreq: 2, collabScore: 70, abilityPoints: 10, iterationCount: 1, status: 'at-risk', currentStage: '市场调研', lastActive: '2天前', testFailCount: 2, submitCount: 3, objectiveScore: 63 },
  { id: 8, name: '周芳', team: '绿色出行团队', course: '创新创业实训B班', knowledgeRate: 38, testPassRate: 35, caseViewTime: 1.8, taskQuality: 55, questionFreq: 1, collabScore: 45, abilityPoints: 6, iterationCount: 0, status: 'lagging', currentStage: '创新思维', lastActive: '3天前', testFailCount: 3, submitCount: 2, objectiveScore: 43 },
];

const statusConfig = {
  excellent: { label: '优秀', color: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  normal: { label: '正常', color: 'bg-teal-100 text-teal-700', dot: 'bg-teal-500' },
  'at-risk': { label: '关注', color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  lagging: { label: '滞后', color: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
};

type SortKey = 'knowledgeRate' | 'testPassRate' | 'taskQuality' | 'collabScore' | 'abilityPoints' | 'objectiveScore';

const metricCols: { key: SortKey; label: string; unit?: string }[] = [
  { key: 'knowledgeRate', label: '知识完成率', unit: '%' },
  { key: 'testPassRate', label: '检测达标率', unit: '%' },
  { key: 'taskQuality', label: '任务质量', unit: '分' },
  { key: 'collabScore', label: '协作活跃度', unit: '分' },
  { key: 'abilityPoints', label: '能力点', unit: '' },
  { key: 'objectiveScore', label: '客观过程得分', unit: '分' }, // 新增列
];

function ScoreBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden flex-shrink-0">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.min((value / max) * 100, 100)}%` }}
        />
      </div>
      <span className="text-xs font-bold text-gray-700 w-8 text-right">{value}</span>
    </div>
  );
}

export default function StudentAnalysisBoard() {
  const [filterStatus, setFilterStatus] = useState<'all' | StudentData['status']>('all');
  const [filterCourse, setFilterCourse] = useState('全部课程');
  const [searchText, setSearchText] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('knowledgeRate');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [selectedStudent, setSelectedStudent] = useState<StudentData | null>(null);

  const courses = ['全部课程', '创新创业实训A班', '创新创业实训B班'];

  const filtered = mockStudents
    .filter(s => {
      if (filterStatus !== 'all' && s.status !== filterStatus) return false;
      if (filterCourse !== '全部课程' && s.course !== filterCourse) return false;
      if (searchText.trim()) {
        const kw = searchText.toLowerCase();
        return s.name.toLowerCase().includes(kw) || s.team.toLowerCase().includes(kw);
      }
      return true;
    })
    .sort((a, b) => {
      const va = a[sortKey] as number;
      const vb = b[sortKey] as number;
      return sortDir === 'desc' ? vb - va : va - vb;
    });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => (d === 'desc' ? 'asc' : 'desc'));
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const avgKnowledge = Math.round(
    mockStudents.reduce((s, d) => s + d.knowledgeRate, 0) / mockStudents.length,
  );
  const avgTest = Math.round(
    mockStudents.reduce((s, d) => s + d.testPassRate, 0) / mockStudents.length,
  );
  const avgQuality = Math.round(
    mockStudents.reduce((s, d) => s + d.taskQuality, 0) / mockStudents.length,
  );
  const avgCollab = Math.round(
    mockStudents.reduce((s, d) => s + d.collabScore, 0) / mockStudents.length,
  );
  const laggingCount = mockStudents.filter(s => s.status === 'lagging').length;
  const atRiskCount = mockStudents.filter(s => s.status === 'at-risk').length;

  return (
    <div className="space-y-5">
      {/* 顶部统计卡片 */}
      <div className="grid grid-cols-4 gap-4">
        {[
          {
            label: '知识完成率',
            value: `${avgKnowledge}%`,
            icon: 'ri-book-open-line',
            color: 'from-teal-500 to-cyan-500',
            sub: '班级平均',
          },
          {
            label: '检测达标率',
            value: `${avgTest}%`,
            icon: 'ri-checkbox-circle-line',
            color: 'from-indigo-500 to-purple-500',
            sub: '班级平均',
          },
          {
            label: '任务质量均分',
            value: `${avgQuality}分`,
            icon: 'ri-star-line',
            color: 'from-amber-500 to-orange-500',
            sub: '班级平均',
          },
          {
            label: '需重点关注',
            value: laggingCount + atRiskCount,
            icon: 'ri-user-warning-line',
            color: 'from-red-500 to-rose-500',
            sub: `${laggingCount}滞后 · ${atRiskCount}预警`,
          },
        ].map((card, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center`}>
                <i className={`${card.icon} text-white text-sm`}></i>
              </div>
              <span className="text-2xl font-bold text-gray-900">{card.value}</span>
            </div>
            <div className="text-sm font-medium text-gray-700">{card.label}</div>
            <div className="text-xs text-gray-400 mt-0.5">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* 筛选栏 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
            <input
              type="text"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              placeholder="搜索学生姓名、小组..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 bg-gray-50"
            />
          </div>
          <select
            value={filterCourse}
            onChange={e => setFilterCourse(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 bg-gray-50 cursor-pointer"
          >
            {courses.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
            {(['all', 'excellent', 'normal', 'at-risk', 'lagging'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  filterStatus === s
                    ? 'bg-white text-gray-800 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {s === 'all' ? '全部' : statusConfig[s].label}
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-400 ml-auto">共 {filtered.length} 名学生</span>
        </div>
      </div>

      {/* 学生数据表格 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">
                  学生
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">
                  当前阶段
                </th>
                {metricCols.map(col => (
                  <th
                    key={col.key}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap cursor-pointer hover:text-teal-600 select-none"
                    onClick={() => handleSort(col.key)}
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      {sortKey === col.key ? (
                        <i
                          className={`${
                            sortDir === 'desc' ? 'ri-arrow-down-s-line' : 'ri-arrow-up-s-line'
                          } text-teal-500`}
                        ></i>
                      ) : (
                        <i className="ri-arrow-up-down-line text-gray-300"></i>
                      )}
                    </span>
                  </th>
                ))}
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">
                  检测失败
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">
                  状态
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((student, idx) => {
                const sc = statusConfig[student.status];
                return (
                  <tr
                    key={student.id}
                    className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                      idx % 2 === 0 ? '' : 'bg-gray-50/30'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{
                            background: `hsl(${(student.id * 55 + 160) % 360}, 55%, 55%)`,
                          }}
                        >
                          {student.name.charAt(0)}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{student.name}</div>
                          <div className="text-xs text-gray-400">{student.team}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-600 whitespace-nowrap">{student.currentStage}</span>
                      <div className="text-xs text-gray-400 mt-0.5">{student.lastActive}</div>
                    </td>
                    <td className="px-4 py-3">
                      <ScoreBar
                        value={student.knowledgeRate}
                        color={
                          student.knowledgeRate >= 80
                            ? 'bg-gradient-to-r from-teal-400 to-cyan-400'
                            : student.knowledgeRate >= 60
                            ? 'bg-gradient-to-r from-amber-400 to-yellow-400'
                            : 'bg-gradient-to-r from-red-400 to-rose-400'
                        }
                      />
                    </td>
                    <td className="px-4 py-3">
                      <ScoreBar
                        value={student.testPassRate}
                        color={
                          student.testPassRate >= 80
                            ? 'bg-gradient-to-r from-green-400 to-emerald-400'
                            : student.testPassRate >= 60
                            ? 'bg-gradient-to-r from-amber-400 to-yellow-400'
                            : 'bg-gradient-to-r from-red-400 to-rose-400'
                        }
                      />
                    </td>
                    <td className="px-4 py-3">
                      <ScoreBar value={student.taskQuality} color="bg-gradient-to-r from-indigo-400 to-purple-400" />
                    </td>
                    <td className="px-4 py-3">
                      <ScoreBar value={student.collabScore} color="bg-gradient-to-r from-pink-400 to-rose-400" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <div className="w-6 h-6 flex items-center justify-center bg-teal-50 rounded-lg">
                          <i className="ri-award-line text-teal-500 text-xs"></i>
                        </div>
                        <span className="text-sm font-bold text-teal-600">{student.abilityPoints}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <div className="w-6 h-6 flex items-center justify-center bg-indigo-50 rounded-lg">
                          <i className="ri-robot-2-line text-indigo-500 text-xs"></i>
                        </div>
                        <span className={`text-sm font-bold ${
                          (student.objectiveScore || 0) >= 80 ? 'text-green-600' : 
                          (student.objectiveScore || 0) >= 60 ? 'text-amber-600' : 'text-red-600'
                        }`}>
                          {student.objectiveScore || 0}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {student.testFailCount > 0 ? (
                        <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs font-bold rounded-full">
                          {student.testFailCount}次
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap flex items-center gap-1 w-fit ${sc.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`}></span>
                        {sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button className="px-3 py-1.5 bg-orange-50 text-orange-600 text-xs font-medium rounded-lg hover:bg-orange-100 transition-colors cursor-pointer whitespace-nowrap">
                        <i className="ri-robot-2-line mr-1"></i>
                        评价智能体诊断
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 学生详情弹窗 */}
      {selectedStudent && (
        <AppModalPortal open={true} onMaskClick={() => setSelectedStudent(null)} zIndex={50}>
          <div
            className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* 头部 */}
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-100 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-bold"
                  style={{
                    background: `hsl(${(selectedStudent.id * 55 + 160) % 360}, 55%, 55%)`,
                  }}
                >
                  {selectedStudent.name.charAt(0)}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{selectedStudent.name}</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-sm text-gray-500">{selectedStudent.team}</span>
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusConfig[selectedStudent.status].color}`}
                    >
                      {statusConfig[selectedStudent.status].label}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedStudent(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer"
              >
                <i className="ri-close-line text-gray-500"></i>
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* 核心指标 */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: '知识完成率', value: `${selectedStudent.knowledgeRate}%`, color: 'from-teal-500 to-cyan-500', icon: 'ri-book-open-line' },
                  { label: '检测达标率', value: `${selectedStudent.testPassRate}%`, color: 'from-indigo-500 to-purple-500', icon: 'ri-checkbox-circle-line' },
                  { label: '任务质量', value: `${selectedStudent.taskQuality}分`, color: 'from-amber-500 to-orange-500', icon: 'ri-star-line' },
                  { label: '协作活跃度', value: `${selectedStudent.collabScore}分`, color: 'from-pink-500 to-rose-500', icon: 'ri-team-line' },
                  { label: '能力点', value: selectedStudent.abilityPoints, color: 'from-green-500 to-emerald-500', icon: 'ri-award-line' },
                  { label: '迭代次数', value: selectedStudent.iterationCount, color: 'from-orange-500 to-red-500', icon: 'ri-refresh-line' },
                ].map((item, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl p-3 text-center">
                    <div className={`w-8 h-8 mx-auto mb-1.5 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center`}>
                      <i className={`${item.icon} text-white text-xs`}></i>
                    </div>
                    <div className="text-xl font-bold text-gray-900">{item.value}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{item.label}</div>
                  </div>
                ))}
              </div>

              {/* 评价智能体报告 - 新增 */}
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center relative">
                    <i className="ri-robot-2-line text-white text-sm"></i>
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-indigo-50 animate-pulse"></span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">评价智能体报告</h3>
                    <p className="text-xs text-indigo-600">全周期无感采集 · 自动生成客观过程得分</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-white rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <i className="ri-chat-quote-line text-blue-500 text-sm"></i>
                      <span className="text-xs text-gray-600">提示词优化频次</span>
                    </div>
                    <div className="text-lg font-bold text-gray-900">
                      {selectedStudent.id === 1 ? 42 : selectedStudent.id === 2 ? 38 : selectedStudent.id === 3 ? 32 : selectedStudent.id === 6 ? 12 : 28}次
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <i className="ri-code-s-slash-line text-purple-500 text-sm"></i>
                      <span className="text-xs text-gray-600">代码贡献量</span>
                    </div>
                    <div className="text-lg font-bold text-gray-900">
                      {selectedStudent.id === 1 ? 1456 : selectedStudent.id === 2 ? 1320 : selectedStudent.id === 3 ? 1120 : selectedStudent.id === 6 ? 234 : 890}行
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <i className="ri-puzzle-line text-green-500 text-sm"></i>
                      <span className="text-xs text-gray-600">组件调用次数</span>
                    </div>
                    <div className="text-lg font-bold text-gray-900">
                      {selectedStudent.id === 1 ? 35 : selectedStudent.id === 2 ? 32 : selectedStudent.id === 3 ? 28 : selectedStudent.id === 6 ? 8 : 22}次
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <i className="ri-team-line text-orange-500 text-sm"></i>
                      <span className="text-xs text-gray-600">敏捷站会活跃度</span>
                    </div>
                    <div className="text-lg font-bold text-gray-900">
                      {selectedStudent.id === 1 ? 96 : selectedStudent.id === 2 ? 94 : selectedStudent.id === 3 ? 92 : selectedStudent.id === 6 ? 45 : 88}分
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg p-4 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white/90">客观过程得分（自动计算）</span>
                    <i className="ri-trophy-line text-xl"></i>
                  </div>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-bold">{selectedStudent.objectiveScore || 0}</span>
                    <span className="text-lg text-white/80 mb-1">/ 100</span>
                  </div>
                  <div className="mt-2 text-xs text-white/80">
                    加权计算：提示词25% + 代码35% + 组件20% + 敏捷20%
                  </div>
                </div>
              </div>

              {/* 学习行为分析 */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <i className="ri-bar-chart-line text-teal-500"></i>学习行为分析
                </h3>
                <div className="space-y-3">
                  {[
                    { label: '知识点完成率', value: selectedStudent.knowledgeRate, max: 100, color: 'from-teal-400 to-cyan-400' },
                    { label: '检测达标率', value: selectedStudent.testPassRate, max: 100, color: 'from-indigo-400 to-purple-400' },
                    { label: '案例查看时长', value: selectedStudent.caseViewTime, max: 15, color: 'from-green-400 to-emerald-400', unit: 'h' },
                    { label: '任务完成质量', value: selectedStudent.taskQuality, max: 100, color: 'from-amber-400 to-orange-400' },
                    { label: '提问频率', value: selectedStudent.questionFreq, max: 10, color: 'from-pink-400 to-rose-400', unit: '次/周' },
                    { label: '协作活跃度', value: selectedStudent.collabScore, max: 100, color: 'from-orange-400 to-red-400' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-gray-600 w-28 flex-shrink-0">{item.label}</span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full bg-gradient-to-r ${item.color} rounded-full transition-all duration-700`}
                          style={{ width: `${Math.min((item.value / item.max) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-gray-700 w-16 text-right flex-shrink-0">
                        {item.value}
                        {item.unit || (item.max === 100 ? '%' : '')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 评价智能体诊断 - 修改标题 */}
              <div className="bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-100 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <i className="ri-robot-2-line text-teal-500 text-sm"></i>
                  <span className="text-sm font-bold text-teal-700">评价智能体诊断</span>
                </div>
                {selectedStudent.status === 'lagging' && (
                  <ul className="space-y-1.5">
                    <li className="text-xs text-teal-700 flex items-start gap-1.5">
                      <i className="ri-arrow-right-s-line mt-0.5 flex-shrink-0"></i>
                      知识点完成率偏低，建议优先完成未学习的知识点，重点关注检测未达标的模块
                    </li>
                    <li className="text-xs text-teal-700 flex items-start gap-1.5">
                      <i className="ri-arrow-right-s-line mt-0.5 flex-shrink-0"></i>
                      协作活跃度不足，建议主动参与团队讨论，提升贡献度
                    </li>
                    <li className="text-xs text-teal-700 flex items-start gap-1.5">
                      <i className="ri-arrow-right-s-line mt-0.5 flex-shrink-0"></i>
                      建议教师发起一对一引导，了解学习障碍，提供针对性资源
                    </li>
                  </ul>
                )}
                {selectedStudent.status === 'at-risk' && (
                  <ul className="space-y-1.5">
                    <li className="text-xs text-teal-700 flex items-start gap-1.5">
                      <i className="ri-arrow-right-s-line mt-0.5 flex-shrink-0"></i>
                      检测达标率有待提升，建议重新学习未达标知识点后再次检测
                    </li>
                    <li className="text-xs text-teal-700 flex items-start gap-1.5">
                      <i className="ri-arrow-right-s-line mt-0.5 flex-shrink-0"></i>
                      案例查看时长偏少，建议多参考案例库中的相关案例
                    </li>
                    <li className="text-xs text-teal-700 flex items-start gap-1.5">
                      <i className="ri-arrow-right-s-line mt-0.5 flex-shrink-0"></i>
                      建议教师推送补充学习资源，并设置合理的补学截止时间
                    </li>
                  </ul>
                )}
                {(selectedStudent.status === 'normal' || selectedStudent.status === 'excellent') && (
                  <ul className="space-y-1.5">
                    <li className="text-xs text-teal-700 flex items-start gap-1.5">
                      <i className="ri-arrow-right-s-line mt-0.5 flex-shrink-0"></i>
                      整体学习状态良好，继续保持当前学习节奏
                    </li>
                    <li className="text-xs text-teal-700 flex items-start gap-1.5">
                      <i className="ri-arrow-right-s-line mt-0.5 flex-shrink-0"></i>
                      可适当增加案例库的参考深度，提升实践成果质量
                    </li>
                    <li className="text-xs text-teal-700 flex items-start gap-1.5">
                      <i className="ri-arrow-right-s-line mt-0.5 flex-shrink-0"></i>
                      鼓励在团队中分享学习经验，带动整体进步
                    </li>
                  </ul>
                )}
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-3">
                <button className="flex-1 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-sm font-medium rounded-xl hover:opacity-90 transition-all cursor-pointer whitespace-nowrap">
                  <i className="ri-chat-private-line mr-1.5"></i>一对一引导
                </button>
                <button className="flex-1 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-medium rounded-xl hover:opacity-90 transition-all cursor-pointer whitespace-nowrap">
                  <i className="ri-alarm-line mr-1.5"></i>发送督促
                </button>
                <button className="flex-1 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-all cursor-pointer whitespace-nowrap">
                  <i className="ri-send-plane-line mr-1.5"></i>推送资源
                </button>
              </div>
            </div>
          </div>
        </AppModalPortal>
      )}
    </div>
  );
}
