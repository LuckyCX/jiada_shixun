import { useState, useEffect } from 'react';
import { Select } from 'antd';
import { User, UserRole } from './types';
import { useCollegeDictOptions } from './useCollegeDictOptions';
import { fetchAdminClasses, type AdminClassOption } from './adminUsersApi';

interface EditUserModalProps {
  isOpen: boolean;
  user: User | null;
  onClose: () => void;
  onSubmit: (userId: string, userData: Record<string, unknown>) => void | Promise<void>;
}

export default function EditUserModal({ isOpen, user, onClose, onSubmit }: EditUserModalProps) {
  const { options: deptOptions, loading: deptLoading } = useCollegeDictOptions(isOpen && !!user);
  const [classOptions, setClassOptions] = useState<AdminClassOption[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    idNumber: '',
    email: '',
    department: '',
    role: 'student' as UserRole,
    classId: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || !user) return;
    let cancelled = false;
    setClassesLoading(true);
    fetchAdminClasses()
      .then((rows) => {
        if (!cancelled) setClassOptions(rows);
      })
      .catch(() => {
        if (!cancelled) setClassOptions([]);
      })
      .finally(() => {
        if (!cancelled) setClassesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, user]);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name,
        idNumber: user.studentId || user.employeeId || user.username || '',
        email: user.email || '',
        department: user.department,
        role: user.role,
        classId: user.classId || '',
      });
    }
  }, [user]);

  useEffect(() => {
    if (!deptOptions.length || !user) return;
    setFormData((fd) => {
      if (deptOptions.some((o) => o.value === fd.department)) return fd;
      const byLabel = deptOptions.find((o) => o.label === fd.department);
      if (byLabel) return { ...fd, department: byLabel.value };
      return fd;
    });
  }, [deptOptions, user]);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.department.trim()) return;
    setSubmitting(true);
    try {
      await Promise.resolve(onSubmit(user.id, { ...formData }));
    } finally {
      setSubmitting(false);
    }
  };

  const isAdmin = user.role === 'admin';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-gray-900">编辑用户信息</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                姓名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="请输入姓名"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                角色 <span className="text-red-500">*</span>
              </label>
              {isAdmin ? (
                <input
                  type="text"
                  disabled
                  value="管理员"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-600"
                />
              ) : (
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="student">学生</option>
                  <option value="teacher">教师</option>
                </select>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {formData.role === 'student' ? '学号' : '工号'} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              disabled={isAdmin}
              value={formData.idNumber}
              onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
              placeholder={formData.role === 'student' ? '请输入学号' : '请输入工号'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">邮箱</label>
            <input
              type="text"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              placeholder="选填，无邮箱可留空"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              学院 <span className="text-red-500">*</span>
            </label>
            <Select
              className="w-full"
              placeholder="请选择学院"
              loading={deptLoading}
              value={formData.department || undefined}
              onChange={(v) => setFormData({ ...formData, department: v ?? '' })}
              options={deptOptions}
              showSearch
              optionFilterProp="label"
            />
          </div>

          {formData.role === 'student' && !isAdmin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">班级分配</label>
              <select
                value={formData.classId}
                disabled={classesLoading}
                onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                <option value="">未分配班级</option>
                {classOptions.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors whitespace-nowrap disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors whitespace-nowrap disabled:opacity-50"
            >
              {submitting ? '保存中…' : '保存修改'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
