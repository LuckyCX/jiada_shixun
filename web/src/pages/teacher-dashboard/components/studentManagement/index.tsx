import { useState, useMemo } from 'react';
import { mockStudents } from './mockData';
import { Student } from './types';

const PAGE_SIZE = 15;

const avatarColors = [
  'from-teal-500 to-cyan-500',
  'from-green-500 to-emerald-500',
  'from-orange-500 to-amber-500',
  'from-rose-500 to-pink-500',
  'from-violet-500 to-purple-500',
  'from-sky-500 to-blue-500',
];

function getColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return avatarColors[hash % avatarColors.length];
}

function ProgressBar({ value }: { value: number }) {
  const color = value >= 80 ? 'bg-green-500' : value >= 50 ? 'bg-teal-500' : value >= 30 ? 'bg-amber-500' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-medium text-gray-600 w-8 text-right">{value}%</span>
    </div>
  );
}

interface StudentDetailDrawerProps {
  student: Student;
  onClose: () => void;
}

function StudentDetailDrawer({ student, onClose }: StudentDetailDrawerProps) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative w-96 bg-white h-full shadow-2xl flex flex-col overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-teal-500 to-cyan-500 px-6 py-8 flex-shrink-0">
          <div className="flex items-start justify-between mb-4">
            <div />
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
            >
              <i className="ri-close-line text-xl" />
            </button>
          </div>
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0`}>
              {student.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{student.name}</h2>
              <p className="text-teal-100 text-sm mt-0.5">{student.studentId}</p>
              <span className={`inline-flex items-center gap-1 mt-2 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                student.status === 'active' ? 'bg-white/20 text-white' : 'bg-white/10 text-white/60'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${student.status === 'active' ? 'bg-green-300' : 'bg-gray-300'}`} />
                {student.status === 'active' ? '活跃' : '不活跃'}
              </span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 p-6 space-y-5">
          {/* 基本信息 */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">基本信息</h3>
            <div className="space-y-3">
              {[
                { icon: 'ri-mail-line', label: '邮箱', value: student.email },
                { icon: 'ri-building-line', label: '院系', value: student.department || '—' },
                { icon: 'ri-team-line', label: '所在班级', value: student.className || '未分配' },
                { icon: 'ri-group-line', label: '所在团队', value: student.teamName || '未组队' },
                { icon: 'ri-calendar-line', label: '加入时间', value: student.joinDate || '—' },
                { icon: 'ri-time-line', label: '最近活跃', value: student.lastActive || '—' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <div className="w-8 h-8 flex items-center justify-center bg-gray-50 rounded-lg flex-shrink-0">
                    <i className={`${item.icon} text-gray-400 text-sm`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-400">{item.label}</div>
                    <div className="text-sm font-medium text-gray-800 truncate">{item.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 学习进度 */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">学习进度</h3>
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">整体完成度</span>
                <span className={`text-lg font-bold ${
                  (student.progress ?? 0) >= 80 ? 'text-green-600' :
                  (student.progress ?? 0) >= 50 ? 'text-teal-600' :
                  (student.progress ?? 0) >= 30 ? 'text-amber-600' : 'text-red-500'
                }`}>{student.progress ?? 0}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    (student.progress ?? 0) >= 80 ? 'bg-green-500' :
                    (student.progress ?? 0) >= 50 ? 'bg-teal-500' :
                    (student.progress ?? 0) >= 30 ? 'bg-amber-500' : 'bg-red-400'
                  }`}
                  style={{ width: `${student.progress ?? 0}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {(student.progress ?? 0) >= 80 ? '学习状态优秀，继续保持！' :
                 (student.progress ?? 0) >= 50 ? '进度良好，稳步推进中' :
                 (student.progress ?? 0) >= 30 ? '进度偏慢，建议加强学习' : '进度严重滞后，需要关注'}
              </p>
            </div>
          </div>

          {/* 操作 */}
          <div className="space-y-2 pt-2">
            <button className="w-full flex items-center gap-3 px-4 py-3 bg-teal-50 text-teal-700 rounded-xl hover:bg-teal-100 transition-colors text-sm font-medium cursor-pointer">
              <i className="ri-message-3-line" />
              发送消息
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 bg-amber-50 text-amber-700 rounded-xl hover:bg-amber-100 transition-colors text-sm font-medium cursor-pointer">
              <i className="ri-alarm-warning-line" />
              发送预警提醒
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors text-sm font-medium cursor-pointer">
              <i className="ri-file-chart-line" />
              查看学习报告
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StudentManagement() {
  const [students] = useState<Student[]>(mockStudents);
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterProgress, setFilterProgress] = useState<'all' | 'good' | 'normal' | 'risk'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const classes = useMemo(() => {
    const map = new Map<string, string>();
    students.forEach((s) => {
      if (s.classId && s.className) map.set(s.classId, s.className);
    });
    return Array.from(map.entries());
  }, [students]);

  const filtered = useMemo(() => {
    return students.filter((s) => {
      const matchSearch =
        !search ||
        s.name.includes(search) ||
        s.studentId.includes(search) ||
        s.email.includes(search) ||
        (s.teamName ?? '').includes(search);
      const matchClass = filterClass === 'all' || s.classId === filterClass;
      const matchStatus = filterStatus === 'all' || s.status === filterStatus;
      const p = s.progress ?? 0;
      const matchProgress =
        filterProgress === 'all' ||
        (filterProgress === 'good' && p >= 80) ||
        (filterProgress === 'normal' && p >= 30 && p < 80) ||
        (filterProgress === 'risk' && p < 30);
      return matchSearch && matchClass && matchStatus && matchProgress;
    });
  }, [students, search, filterClass, filterStatus, filterProgress]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handlePageChange = (p: number) => {
    setCurrentPage(Math.max(1, Math.min(p, totalPages)));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginated.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginated.map((s) => s.id)));
    }
  };

  const stats = useMemo(() => ({
    total: students.length,
    active: students.filter((s) => s.status === 'active').length,
    good: students.filter((s) => (s.progress ?? 0) >= 80).length,
    risk: students.filter((s) => (s.progress ?? 0) < 30).length,
  }), [students]);

  return (
    <div className="space-y-5">
      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: '学生总数', value: stats.total, icon: 'ri-user-line', color: 'from-teal-500 to-cyan-500', sub: '全部班级' },
          { label: '活跃学生', value: stats.active, icon: 'ri-user-heart-line', color: 'from-green-500 to-emerald-500', sub: `占比 ${Math.round(stats.active / stats.total * 100)}%` },
          { label: '进度优秀', value: stats.good, icon: 'ri-award-line', color: 'from-amber-500 to-orange-500', sub: '完成度 ≥80%' },
          { label: '需要关注', value: stats.risk, icon: 'ri-alarm-warning-line', color: 'from-rose-500 to-red-500', sub: '完成度 <30%' },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center flex-shrink-0`}>
              <i className={`${card.icon} text-white text-lg`} />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{card.value}</div>
              <div className="text-xs font-medium text-gray-600">{card.label}</div>
              <div className="text-xs text-gray-400">{card.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 筛选栏 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center gap-3 flex-wrap">
          {/* 搜索 */}
          <div className="relative flex-1 min-w-52">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
            <input
              type="text"
              placeholder="搜索姓名、学号、邮箱、团队..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-300 focus:bg-white"
            />
          </div>

          {/* 班级筛选 */}
          <select
            value={filterClass}
            onChange={(e) => { setFilterClass(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-300 cursor-pointer"
          >
            <option value="all">全部班级</option>
            {classes.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>

          {/* 状态筛选 */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {(['all', 'active', 'inactive'] as const).map((s) => (
              <button
                key={s}
                onClick={() => { setFilterStatus(s); setCurrentPage(1); }}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-all cursor-pointer whitespace-nowrap ${
                  filterStatus === s ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {s === 'all' ? '全部状态' : s === 'active' ? '活跃' : '不活跃'}
              </button>
            ))}
          </div>

          {/* 进度筛选 */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {(['all', 'good', 'normal', 'risk'] as const).map((p) => (
              <button
                key={p}
                onClick={() => { setFilterProgress(p); setCurrentPage(1); }}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-all cursor-pointer whitespace-nowrap ${
                  filterProgress === p ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {p === 'all' ? '全部进度' : p === 'good' ? '优秀' : p === 'normal' ? '正常' : '预警'}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">已选 {selectedIds.size} 人</span>
                <button className="px-3 py-2 bg-amber-50 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-100 transition-colors cursor-pointer whitespace-nowrap">
                  <i className="ri-alarm-warning-line mr-1" />批量预警
                </button>
                <button className="px-3 py-2 bg-teal-50 text-teal-700 rounded-lg text-xs font-medium hover:bg-teal-100 transition-colors cursor-pointer whitespace-nowrap">
                  <i className="ri-message-3-line mr-1" />批量消息
                </button>
              </div>
            )}
            <button className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 text-white rounded-lg text-xs font-medium hover:bg-teal-700 transition-colors cursor-pointer whitespace-nowrap">
              <i className="ri-download-line" />导出名单
            </button>
          </div>
        </div>
      </div>

      {/* 表格 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">
            共 <span className="text-teal-600">{filtered.length}</span> 名学生
          </span>
          <span className="text-xs text-gray-400">第 {currentPage} / {totalPages} 页</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={paginated.length > 0 && selectedIds.size === paginated.length}
                    onChange={toggleSelectAll}
                    className="rounded cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">学生</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">学号</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">班级</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">团队</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-40">学习进度</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">状态</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">最近活跃</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <i className="ri-search-line text-4xl text-gray-200 block mb-2" />
                    <p className="text-sm text-gray-400">未找到匹配的学生</p>
                  </td>
                </tr>
              ) : (
                paginated.map((student) => (
                  <tr
                    key={student.id}
                    className={`hover:bg-gray-50 transition-colors ${selectedIds.has(student.id) ? 'bg-teal-50/50' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(student.id)}
                        onChange={() => toggleSelect(student.id)}
                        className="rounded cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getColor(student.name)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                          {student.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{student.name}</div>
                          <div className="text-xs text-gray-400">{student.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{student.studentId}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-teal-50 text-teal-700 rounded-md text-xs font-medium">
                        {student.className || '未分配'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {student.teamName ? (
                        <span className="text-gray-700 text-xs">{student.teamName}</span>
                      ) : (
                        <span className="text-gray-300 text-xs">未组队</span>
                      )}
                    </td>
                    <td className="px-4 py-3 w-40">
                      <ProgressBar value={student.progress ?? 0} />
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        student.status === 'active'
                          ? 'bg-green-50 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${student.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`} />
                        {student.status === 'active' ? '活跃' : '不活跃'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{student.lastActive}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setSelectedStudent(student)}
                          className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                          title="查看详情"
                        >
                          <i className="ri-eye-line text-sm" />
                        </button>
                        <button
                          className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                          title="发送预警"
                        >
                          <i className="ri-alarm-warning-line text-sm" />
                        </button>
                        <button
                          className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors cursor-pointer"
                          title="发送消息"
                        >
                          <i className="ri-message-3-line text-sm" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-400">
              显示第 {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} 条，共 {filtered.length} 条
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:border-teal-400 hover:text-teal-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <i className="ri-arrow-left-s-line" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                  if (idx > 0 && typeof arr[idx - 1] === 'number' && (p as number) - (arr[idx - 1] as number) > 1) acc.push('...');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, idx) =>
                  p === '...' ? (
                    <span key={`ellipsis-${idx}`} className="w-8 h-8 flex items-center justify-center text-gray-400 text-xs">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => handlePageChange(p as number)}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                        currentPage === p
                          ? 'bg-teal-600 text-white'
                          : 'border border-gray-200 text-gray-600 hover:border-teal-400 hover:text-teal-600'
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:border-teal-400 hover:text-teal-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <i className="ri-arrow-right-s-line" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 学生详情抽屉 */}
      {selectedStudent && (
        <StudentDetailDrawer
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </div>
  );
}
