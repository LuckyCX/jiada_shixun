import { useEffect, useState } from 'react';
import { Button, Form, Input, Select } from 'antd';
import AppModalPortal from '../../../../components/AppModalPortal';
import { User, UserRole } from './types';
import { useCollegeDictOptions } from './useCollegeDictOptions';
import { useMajorOptions } from './useMajorOptions';
import { fetchAdminClasses, type AdminClassOption } from './adminUsersApi';

interface EditUserModalProps {
  isOpen: boolean;
  user: User | null;
  onClose: () => void;
  onSubmit: (userId: string, userData: Record<string, unknown>) => void | Promise<void>;
  /** 锁定学院（教师管理二级页） */
  lockDepartmentId?: string;
  /** 锁定班级 id（学生管理二级页，仅学生有效） */
  lockClassId?: string;
  /** 锁定角色 */
  lockRole?: 'student' | 'teacher';
}

type EditFormValues = {
  name: string;
  idNumber: string;
  email?: string;
  department: string;
  majorId?: string;
  role: UserRole;
  classId?: string;
};

export default function EditUserModal({
  isOpen,
  user,
  onClose,
  onSubmit,
  lockDepartmentId,
  lockClassId,
  lockRole,
}: EditUserModalProps) {
  const [form] = Form.useForm<EditFormValues>();
  const role = Form.useWatch('role', form);
  const department = Form.useWatch('department', form);
  const { options: deptOptions, loading: deptLoading } = useCollegeDictOptions(isOpen && !!user);
  const { options: majorOptions, loading: majorLoading } = useMajorOptions(
    isOpen && !!user && (role === 'student' || role === 'teacher'),
    lockDepartmentId ?? department
  );
  const [classOptions, setClassOptions] = useState<AdminClassOption[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (!isOpen || !user) return;
    let cancelled = false;
    setClassesLoading(true);
    fetchAdminClasses(lockDepartmentId || user?.department || undefined)
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
  }, [isOpen, user, lockDepartmentId]);

  useEffect(() => {
    if (!user) return;
    form.setFieldsValue({
      name: user.name,
      idNumber: user.studentId || user.employeeId || user.username || '',
      email: user.email || '',
      department: user.department,
      majorId: user.majorId || undefined,
      role: user.role,
      classId: user.classId || undefined,
    });
  }, [user, form]);

  useEffect(() => {
    if (!deptOptions.length || !user) return;
    const dept = form.getFieldValue('department');
    if (deptOptions.some((o) => o.value === dept)) return;
    const byLabel = deptOptions.find((o) => o.label === dept);
    if (byLabel) form.setFieldsValue({ department: byLabel.value });
  }, [deptOptions, user, form]);

  useEffect(() => {
    if (role !== 'student') {
      form.setFieldsValue({ classId: undefined });
    }
  }, [role, form]);

  if (!isOpen || !user) return null;

  const effectiveRole = lockRole ?? user.role;
  const modalTitle =
    effectiveRole === 'admin'
      ? '编辑管理员信息'
      : effectiveRole === 'student'
        ? '编辑学生信息'
        : '编辑教师信息';

  const handleClose = () => {
    form.resetFields();
    onClose();
  };

  const handleFinish = async (values: EditFormValues) => {
    setSubmitting(true);
    try {
      await Promise.resolve(
        onSubmit(user.id, {
          ...values,
          name: values.name.trim(),
          idNumber: values.idNumber.trim(),
          email: values.email != null ? String(values.email).trim() : '',
          department: (lockDepartmentId ?? String(values.department)).trim(),
          role: lockRole ?? (isAdmin ? user.role : values.role),
          classId: lockClassId !== undefined ? lockClassId : (values.classId ?? ''),
          ...(role === 'student' || role === 'teacher' ? { majorId: String(values.majorId ?? '') } : {}),
        })
      );
    } finally {
      setSubmitting(false);
    }
  };

  const idLabel = role === 'student' ? '学号' : '工号';

  return (
    <AppModalPortal open onMaskClick={handleClose} zIndex={1100}>
      <div
        className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-gray-900">{modalTitle}</h3>
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        <Form
          form={form}
          layout="vertical"
          className="p-6"
          onFinish={(v) => void handleFinish(v)}
          requiredMark={(label, { required }) => (
            <>
              {label}
              {required ? <span className="text-red-500 ml-0.5">*</span> : null}
            </>
          )}
        >
          <div className="grid grid-cols-2 gap-x-5 gap-y-0">
            <Form.Item
              label="姓名"
              name="name"
              rules={[
                { required: true, message: '请输入姓名' },
                { whitespace: true, message: '姓名不能为空' },
              ]}
            >
              <Input placeholder="请输入姓名" className="!py-2.5" />
            </Form.Item>

            {isAdmin ? (
              <Form.Item label="角色">
                <Input disabled value="管理员" className="!py-2.5" />
              </Form.Item>
            ) : lockRole ? (
              <Form.Item label="角色">
                <Input disabled value={lockRole === 'student' ? '学生' : '教师'} className="!py-2.5" />
              </Form.Item>
            ) : (
              <Form.Item label="角色" name="role" rules={[{ required: true, message: '请选择角色' }]}>
                <Select
                  className="h-[42px]"
                  options={[
                    { value: 'student', label: '学生' },
                    { value: 'teacher', label: '教师' },
                  ]}
                />
              </Form.Item>
            )}
          </div>

          <Form.Item
            label={idLabel}
            name="idNumber"
            rules={[
              { required: true, message: role === 'student' ? '请输入学号' : '请输入工号' },
              { whitespace: true, message: role === 'student' ? '学号不能为空' : '工号不能为空' },
            ]}
          >
            <Input
              placeholder={role === 'student' ? '请输入学号' : '请输入工号'}
              className="!py-2.5"
              disabled={isAdmin}
            />
          </Form.Item>

          <Form.Item
            label="邮箱"
            name="email"
            rules={[
              {
                validator: async (_, v) => {
                  const s = v != null ? String(v).trim() : '';
                  if (!s) return;
                  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) {
                    throw new Error('请输入有效的邮箱地址');
                  }
                },
              },
            ]}
          >
            <Input placeholder="选填，无邮箱可留空" className="!py-2.5" />
          </Form.Item>

          <Form.Item label="学院" name="department" rules={[{ required: true, message: '请选择学院' }]}>
            {lockDepartmentId ? (
              <Select
                className="h-[42px]"
                disabled
                loading={deptLoading}
                options={deptOptions}
                value={lockDepartmentId}
              />
            ) : (
              <Select
                className="h-[42px]"
                placeholder="请选择学院"
                loading={deptLoading}
                options={deptOptions}
                showSearch
                optionFilterProp="label"
                allowClear
              />
            )}
          </Form.Item>

          {(role === 'student' || role === 'teacher') && !isAdmin ? (
            <Form.Item label="专业" name="majorId" rules={[{ required: true, message: '请选择专业' }]}>
              <Select
                className="h-[42px]"
                placeholder={department || lockDepartmentId ? '请选择专业' : '请先选择学院'}
                loading={majorLoading}
                options={majorOptions}
                showSearch
                optionFilterProp="label"
                disabled={!(department || lockDepartmentId)}
              />
            </Form.Item>
          ) : null}

          {role === 'student' && !isAdmin && lockClassId === undefined && (
            <Form.Item label="班级分配" name="classId">
              <Select
                className="h-[42px]"
                placeholder="未分配班级"
                loading={classesLoading}
                allowClear
                options={classOptions.map((cls) => ({ value: cls.id, label: cls.name }))}
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
          )}
          {role === 'student' && !isAdmin && lockClassId !== undefined && (
            <Form.Item label="班级">
              <Input disabled className="!py-2.5" value={classOptions.find((c) => c.id === lockClassId)?.name ?? `班级 #${lockClassId}`} />
            </Form.Item>
          )}

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <Button type="default" block size="large" onClick={handleClose} disabled={submitting} className="!h-[42px]">
              取消
            </Button>
            <Button
              type="primary"
              block
              size="large"
              htmlType="submit"
              loading={submitting}
              className="!h-[42px] !bg-teal-600 hover:!bg-teal-700"
            >
              保存修改
            </Button>
          </div>
        </Form>
      </div>
    </AppModalPortal>
  );
}
