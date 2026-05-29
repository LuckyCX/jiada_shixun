import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Spin, message } from 'antd';
import { useTranslation } from 'react-i18next';
import UserAvatar from '../../../../components/UserAvatar';
import AddStudentsTransferModal from '../classManagement/AddStudentsTransferModal';
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
  const [showAddStudentsModal, setShowAddStudentsModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [batchRemoving, setBatchRemoving] = useState(false);

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
          setSelectedIds((prev) => {
            const next = new Set(prev);
            next.delete(studentId);
            return next;
          });
          await loadStudents();
        } catch (e) {
          message.error(e instanceof Error ? e.message : t('teacher_class.remove_fail'));
        }
      },
    });
  };

  const handleBatchRemove = () => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    Modal.confirm({
      title: `确认将选中的 ${ids.length} 名学生移出本班？`,
      content: '移出后学生将不再属于该教学班级，可重新通过「添加学生」加入。',
      okText: t('teacher_class.confirm_remove_student_ok'),
      okType: 'danger',
      cancelText: t('teacher_class.confirm_cancel'),
      onOk: async () => {
        setBatchRemoving(true);
        let okCount = 0;
        const failed: string[] = [];
        try {
          for (const studentId of ids) {
            try {
              await removePersonalClassStudent(personalClass.id, studentId);
              okCount += 1;
            } catch {
              failed.push(studentId);
            }
          }
          setSelectedIds(new Set(failed));
          await loadStudents();
          if (okCount > 0) {
            message.success(
              failed.length ? `已移除 ${okCount} 名，${failed.length} 名失败` : `已移除 ${okCount} 名学生`
            );
          }
          if (failed.length && okCount === 0) {
            message.error(t('teacher_class.remove_fail'));
          }
        } finally {
          setBatchRemoving(false);
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

  useEffect(() => {
    setSelectedIds(new Set());
  }, [personalClass.id]);

  const pageIds = useMemo(() => paginated.map((s) => s.id), [paginated]);
  const pageAllSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const pageSomeSelected = pageIds.some((id) => selectedIds.has(id));

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (pageAllSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  };

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

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
          <input
            type="text"
            placeholder="搜索姓名、学号、邮箱、院系..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-300 focus:bg-white"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowAddStudentsModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium cursor-pointer whitespace-nowrap"
        >
          <i className="ri-user-add-line" />
          {t('teacher_class.page.add_students')}
        </button>
      </div>

      <Spin spinning={loading}>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
            <span className="text-sm font-semibold text-gray-700">
              共 <span className="text-teal-600">{filtered.length}</span> 名学生
              {selectedIds.size > 0 && (
                <span className="text-gray-500 font-normal ml-2">
                  ，已选 <span className="text-teal-600">{selectedIds.size}</span> 人
                </span>
              )}
            </span>
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <button
                  type="button"
                  disabled={batchRemoving}
                  onClick={handleBatchRemove}
                  className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                >
                  <i className="ri-user-unfollow-line mr-1" />
                  批量移除
                </button>
              )}
              <span className="text-xs text-gray-400">第 {currentPage} / {totalPages} 页</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-gray-300 text-teal-600 cursor-pointer"
                      checked={pageAllSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = pageSomeSelected && !pageAllSelected;
                      }}
                      onChange={toggleSelectPage}
                      disabled={paginated.length === 0}
                      aria-label="全选本页"
                    />
                  </th>
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
                    <td colSpan={6} className="px-4 py-16 text-center">
                      <i className="ri-user-line text-4xl text-gray-200 block mb-2" />
                      <p className="text-sm text-gray-400">
                        {loading ? '' : t('teacher_class.page.roster_empty')}
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginated.map((student) => (
                    <tr
                      key={student.id}
                      className={`hover:bg-gray-50 transition-colors ${selectedIds.has(student.id) ? 'bg-teal-50/40' : ''}`}
                    >
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-gray-300 text-teal-600 cursor-pointer"
                          checked={selectedIds.has(student.id)}
                          onChange={() => toggleSelectOne(student.id)}
                          aria-label={`选择 ${student.name}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <UserAvatar name={student.name} size="sm" />
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

      <AddStudentsTransferModal
        open={showAddStudentsModal}
        personalClassId={personalClass.id}
        groupName={personalClass.name}
        onClose={() => setShowAddStudentsModal(false)}
        onSaved={() => void loadStudents()}
      />
    </div>
  );
}
