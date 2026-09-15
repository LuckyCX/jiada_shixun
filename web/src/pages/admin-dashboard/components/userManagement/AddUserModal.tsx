import { useEffect, useState } from 'react';
import { Form, Input, Select, Button } from 'antd';
import AppModalPortal from '../../../../components/AppModalPortal';
import { UserRole } from './types';
import { useCollegeDictOptions } from './useCollegeDictOptions';
import { useMajorOptions } from './useMajorOptions';
import { fetchAdminClasses, type AdminClassOption } from './adminUsersApi';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (userData: any) => void;
  /** 锁定角色（学院教师 / 班级学生二级页） */
  fixedRole?: 'student' | 'teacher';
  /** 锁定学院 colleges.id */
  fixedDepartmentId?: string;
  /** 班级学生页锁定专业 / 班级 */
  fixedMajorId?: string;
  fixedClassId?: string;
  fixedClassLabel?: string;
  fixedMajorLabel?: string;
}

/** 新建/导入统一规则：学号或工号的后 6 位作为初始密码（不足 6 位则取全部） */
export function initialPasswordFromIdNumber(idNumber: string): string {
  const s = idNumber.trim();
  if (!s) return '';
  return s.slice(-6);
}

export default function AddUserModal({
  isOpen,
  onClose,
  onSubmit,
  fixedRole,
  fixedDepartmentId,
  fixedMajorId,
  fixedClassId,
  fixedClassLabel,
  fixedMajorLabel,
}: AddUserModalProps) {
  const [form] = Form.useForm<{
    name: string;
    role: UserRole;
    idNumber: string;
    email?: string;
    department: string;
    majorId?: string;
    classId?: string;
  }>();
  const role = Form.useWatch('role', form);
  const department = Form.useWatch('department', form);
  const watchedMajorId = Form.useWatch('majorId', form);
  const idNumber = Form.useWatch('idNumber', form) ?? '';
  const effRole = (fixedRole ?? role) as UserRole;
  const isStudent = effRole === 'student';
  const effDept = fixedDepartmentId ?? department;
  const { options: deptOptions, loading: deptLoading } = useCollegeDictOptions(isOpen);
  const { options: majorOptions, loading: majorLoading } = useMajorOptions(
    isOpen && isStudent,
    effDept
  );
  const [classOptions, setClassOptions] = useState<AdminClassOption[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      form.resetFields();
      const init: Partial<{
        role: UserRole;
        department: string;
        majorId: string;
        classId: string;
      }> = {};
      if (fixedRole) init.role = fixedRole;
      if (fixedDepartmentId) init.department = fixedDepartmentId;
      if (fixedMajorId) init.majorId = fixedMajorId;
      if (fixedClassId) init.classId = fixedClassId;
      if (Object.keys(init).length) form.setFieldsValue(init);
    }
  }, [isOpen, form, fixedRole, fixedDepartmentId, fixedMajorId, fixedClassId]);

  // 选专业后拉班级；锁定班级时不必请求
  useEffect(() => {
    if (!isOpen || !isStudent || fixedClassId) {
      setClassOptions([]);
      return;
    }
    if (!effDept || !watchedMajorId) {
      setClassOptions([]);
      setClassesLoading(false);
      return;
    }
    let cancelled = false;
    setClassesLoading(true);
    fetchAdminClasses(String(effDept), String(watchedMajorId))
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
  }, [isOpen, isStudent, fixedClassId, effDept, watchedMajorId]);

  if (!isOpen) return null;

  const handleClose = () => {
    form.resetFields();
    onClose();
  };

  const handleFinish = async (values: {
    name: string;
    role: UserRole;
    idNumber: string;
    email?: string;
    department: string;
    majorId?: string;
    classId?: string;
  }) => {
    const id = values.idNumber.trim();
    const effRoleSubmit = (fixedRole ?? values.role) as UserRole;
    const dept = fixedDepartmentId ?? values.department;
    try {
      await Promise.resolve(
        onSubmit({
          ...values,
          role: effRoleSubmit,
          department: dept,
          majorId: effRoleSubmit === 'student' ? fixedMajorId || values.majorId : undefined,
          classId: effRoleSubmit === 'student' ? fixedClassId || values.classId : undefined,
          name: values.name.trim(),
          idNumber: id,
          email: values.email != null ? String(values.email).trim() : '',
          password: initialPasswordFromIdNumber(id),
        })
      );
      form.resetFields();
    } catch {
      /* 父组件已提示 */
    }
  };

  const idLabel = (fixedRole ?? role) === 'student' ? '学号' : '工号';
  const defaultPwd = initialPasswordFromIdNumber(idNumber);

  const majorSelectOptions =
    fixedMajorId && fixedMajorLabel && !majorOptions.some((o) => o.value === fixedMajorId)
      ? [{ value: fixedMajorId, label: fixedMajorLabel }, ...majorOptions]
      : majorOptions;

  const classSelectOptions = fixedClassId
    ? [{ value: fixedClassId, label: fixedClassLabel || fixedClassId }]
    : classOptions.map((c) => ({ value: c.id, label: c.name }));

  return (
    <AppModalPortal open onMaskClick={handleClose} zIndex={1100}>
      <div
        className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-gray-900">新增用户</h3>
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
          initialValues={{ role: (fixedRole ?? 'student') as UserRole }}
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

            {fixedRole ? (
              <Form.Item label="角色">
                <Input
                  disabled
                  className="!py-2.5"
                  value={fixedRole === 'student' ? '学生' : '教师'}
                />
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
              { required: true, message: (fixedRole ?? role) === 'student' ? '请输入学号' : '请输入工号' },
              {
                whitespace: true,
                message: (fixedRole ?? role) === 'student' ? '学号不能为空' : '工号不能为空',
              },
            ]}
          >
            <Input
              placeholder={(fixedRole ?? role) === 'student' ? '请输入学号' : '请输入工号'}
              className="!py-2.5"
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
            {fixedDepartmentId ? (
              <Select className="h-[42px]" disabled options={deptOptions} value={fixedDepartmentId} />
            ) : (
              <Select
                className="h-[42px]"
                placeholder="请选择学院"
                loading={deptLoading}
                options={deptOptions}
                showSearch
                optionFilterProp="label"
                filterOption={(input, option) =>
                  !input.trim() ||
                  String(option?.label ?? '')
                    .toLowerCase()
                    .includes(input.trim().toLowerCase())
                }
                onChange={(v) => {
                  form.setFieldsValue({
                    department: v,
                    ...(isStudent ? { majorId: undefined, classId: undefined } : {}),
                  });
                }}
              />
            )}
          </Form.Item>

          {isStudent ? (
            <Form.Item label="专业" name="majorId" rules={[{ required: true, message: '请选择专业' }]}>
              <Select
                key={`add-major-${effDept || ''}`}
                className="h-[42px]"
                placeholder={effDept ? '请选择专业' : '请先选择学院'}
                loading={majorLoading}
                options={majorSelectOptions}
                showSearch
                optionFilterProp="label"
                filterOption={(input, option) =>
                  !input.trim() ||
                  String(option?.label ?? '')
                    .toLowerCase()
                    .includes(input.trim().toLowerCase())
                }
                disabled={!effDept || Boolean(fixedMajorId)}
                onChange={(v) => {
                  form.setFieldsValue({ majorId: v, classId: undefined });
                }}
              />
            </Form.Item>
          ) : null}

          {isStudent ? (
            <Form.Item label="班级" name="classId" rules={[{ required: true, message: '请选择班级' }]}>
              <Select
                key={`add-class-${watchedMajorId || fixedMajorId || ''}`}
                className="h-[42px]"
                placeholder={watchedMajorId || fixedMajorId ? '请选择班级' : '请先选择专业'}
                loading={classesLoading}
                options={classSelectOptions}
                showSearch
                optionFilterProp="label"
                filterOption={(input, option) =>
                  !input.trim() ||
                  String(option?.label ?? '')
                    .toLowerCase()
                    .includes(input.trim().toLowerCase())
                }
                disabled={Boolean(fixedClassId) || !(watchedMajorId || fixedMajorId)}
              />
            </Form.Item>
          ) : null}

          <div className="mb-6">
            <div className="text-sm font-medium text-gray-700 mb-2">初始密码</div>
            <div className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 bg-gray-50 min-h-[42px] flex items-center">
              {defaultPwd ? (
                <span className="font-mono tracking-wide">{defaultPwd}</span>
              ) : (
                <span className="text-gray-400">填写{idLabel}后自动取后 6 位</span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1.5">
              默认密码为{idLabel}后 6 位；用户首次登录后需修改密码
            </p>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <Button type="default" block size="large" onClick={handleClose} className="!h-[42px]">
              取消
            </Button>
            <Button
              type="primary"
              block
              size="large"
              htmlType="submit"
              className="!h-[42px] !bg-teal-600 hover:!bg-teal-700"
            >
              确认新增
            </Button>
          </div>
        </Form>
      </div>
    </AppModalPortal>
  );
}
