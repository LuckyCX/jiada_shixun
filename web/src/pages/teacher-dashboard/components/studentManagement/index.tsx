import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Spin, message } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  listPersonalClassStudents,
  removePersonalClassStudent,
  type TeacherPersonalClassRow,
  type TeacherRosterStudent,
} from '../../teacherPortalApi';

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

type StudentManagementProps = {
  personalClass: TeacherPersonalClassRow;
  onBack: () => void;
};

interface StudentDetailDrawerProps {
  student: TeacherRosterStudent;
  className: string;
  onClose: () => void;
}

function StudentDetailDrawer({ student, className, onClose }: StudentDetailDrawerProps) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative w-96 bg-white h-full shadow-2xl flex flex-col overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-br from-teal-500 to-cyan-500 px-6 py-8 flex-shrink-0">
          <div className="flex items-start justify-between mb-4">
            <div />
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
            >
              <i className="ri-close-line text-xl" />
            </button>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
              {student.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{student.name}</h2>
              <p className="text-teal-100 text-sm mt-0.5">{student.studentNo || t('dash')}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 p-6 space-y-5">
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">基本信息</h3>
            <div className="space-y-3">
              {[
                { icon: 'ri-mail-line', label: '邮箱', value: student.email || t('dash') },
                { icon: 'ri-building-line', label: '院系', value: student.collegeName || t('dash') },
                { icon: 'ri-team-line', label: '所在班级', value: className },
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
        </div>
      </div>
    </div>
  );
}

export default function StudentManagement({ personalClass, onBack }: StudentManagementProps) {
  const { t } = useTranslation();
  const [students, setStudents] = useState<TeacherRosterStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedStudent, setSelectedStudent] = useState<TeacherRosterStudent | null>(null);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listPersonalClassStudents(personalClass.id);
      setStudents(list);
    } catch (e) {
      message.error(e instanceof Error ? e.message : t('teacher_class.page.roster_load_fail'));
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [personalClass.id, t]);

  useEffect(() => {
    void loadStudents();
  }, [loadStudents]);

  const handleRemoveStudent = (studentId: string) => {
    Modal.confirm({
      title: t('teacher_class.confirm_remove_student_title'),
      okText: t('teacher_class.confirm_remove_student_ok'),
      okType: 'danger',
      cancelText: t('teacher_class.confirm_cancel'),
      onOk: async () => {
        try {
          await removePersonalClassStudent(personalClass.id, studentId);
          message.success(t('teacher_class.remove_success'));
          await loadStudents();
        } catch (e) {
          message.error(e instanceof Error ? e.message : t('teacher_class.remove_fail'));
        }
      },
    });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.studentNo.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.collegeName.toLowerCase().includes(q)
    );
  }, [students, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handlePageChange = (p: number) => {
    setCurrentPage(Math.max(1, Math.min(p, totalPages)));
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [search, personalClass.id]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-teal-600 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap md:hidden"
        >
          <i className="ri-arrow-left-line" />
          返回班级管理
        </button>
      </div>

      {/* <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
            <i className="ri-user-line text-white text-lg" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{students.length}</div>
            <div className="text-xs font-medium text-gray-600">本班学生数</div>
            <div className="text-xs text-gray-400 truncate">{personalClass.name}</div>
          </div>
        </div>
      </div> */}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="relative max-w-md">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
          <input
            type="text"
            placeholder="搜索姓名、学号、邮箱、院系..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-300 focus:bg-white"
          />
        </div>
      </div>

      <Spin spinning={loading}>
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">
                    {t('teacher_class.page.th_name')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">
                    {t('teacher_class.page.th_student_no')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">
                    {t('teacher_class.page.th_email')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">院系</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">
                    {t('teacher_class.page.th_action')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-16 text-center">
                      <i className="ri-user-line text-4xl text-gray-200 block mb-2" />
                      <p className="text-sm text-gray-400">
                        {loading ? '' : t('teacher_class.page.roster_empty')}
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginated.map((student) => (
                    <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-full bg-gradient-to-br ${getColor(student.name)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}
                          >
                            {student.name.charAt(0)}
                          </div>
                          <div className="font-medium text-gray-900">{student.name}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                        {student.studentNo || t('dash')}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{student.email || t('dash')}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {student.collegeName || t('dash')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedStudent(student)}
                            className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                            title="查看详情"
                          >
                            <i className="ri-eye-line text-sm" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveStudent(student.id)}
                            className="px-2 py-1 text-red-600 hover:bg-red-50 rounded text-xs cursor-pointer whitespace-nowrap"
                          >
                            {t('teacher_class.page.remove')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-400">
                显示第 {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} 条，共 {filtered.length} 条
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:border-teal-400 hover:text-teal-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <i className="ri-arrow-left-s-line" />
                </button>
                <button
                  type="button"
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
      </Spin>

      {selectedStudent && (
        <StudentDetailDrawer
          student={selectedStudent}
          className={personalClass.name}
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </div>
  );
}
