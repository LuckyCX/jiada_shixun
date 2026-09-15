import { useEffect, useMemo, useState } from 'react';
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
  /** 锁定角色（学院教师 / 班级学生二级页仍不可改角色） */
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

/** 当前值若不在 options 中，用名称兜底，避免 Select 只显示裸 ID */
function withCurrentOption(
  options: { value: string; label: string }[],
  value?: string | null,
  label?: string | null
) {
  const v = value != null ? String(value).trim() : '';
  if (!v) return options;
  if (options.some((o) => o.value === v)) return options;
  return [{ value: v, label: (label && String(label).trim()) || v }, ...options];
}

function resolveCollegeId(
  raw: string | undefined | null,
  deptOptions: { value: string; label: string }[],
  collegeName?: string | null
): string {
  const s = raw != null ? String(raw).trim() : '';
  const name = collegeName != null ? String(collegeName).trim() : '';

  // 数字 id 且在学院字典中存在 → 直接用
  if (s && /^\d+$/.test(s) && deptOptions.some((o) => o.value === s)) return s;

  // 脏 id（如历史错误写入的 "1"）或名称：按学院名称匹配
  if (name) {
    const byName = deptOptions.find((o) => o.label === name);
    if (byName) return byName.value;
  }
  if (s && !/^\d+$/.test(s)) {
    const byLabel = deptOptions.find((o) => o.label === s);
    if (byLabel) return byLabel.value;
  }
  // 字典未就绪时暂保留合法数字，待 options 加载后再校正
  if (s && /^\d+$/.test(s) && !deptOptions.length) return s;
  return '';
}

export default function EditUserModal({
  isOpen,
  user,
  onClose,
  onSubmit,
  lockRole,
}: EditUserModalProps) {
  const [form] = Form.useForm<EditFormValues>();
  const role = Form.useWatch('role', form);
  const department = Form.useWatch('department', form);
  const watchedMajorId = Form.useWatch('majorId', form);
  const watchedClassId = Form.useWatch('classId', form);
  const effRole = (lockRole ?? role ?? user?.role) as UserRole | undefined;
  const isStudent = effRole === 'student';
  const { options: deptOptions, loading: deptLoading } = useCollegeDictOptions(isOpen && !!user);

  // 优先用表单学院，否则用用户原学院；脏 id 时按 collegeName 校正
  const resolvedCollegeId = useMemo(() => {
    const id = resolveCollegeId(
      department || user?.department,
      deptOptions,
      user?.collegeName
    );
    return id;
  }, [department, user?.department, user?.collegeName, deptOptions]);

  // 必须先有学院 ID 再拉专业，避免无参请求 / 空列表只剩当前 1 项兜底
  const majorEnabled = Boolean(isOpen && user && isStudent && resolvedCollegeId);
  const { options: majorOptions, loading: majorLoading } = useMajorOptions(
    majorEnabled,
    resolvedCollegeId || undefined
  );

  const [classOptions, setClassOptions] = useState<AdminClassOption[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // 展开下拉时清空搜索词，避免 showSearch 用当前选中文案过滤后只剩 1 项
  const [deptSearch, setDeptSearch] = useState('');
  const [majorSearch, setMajorSearch] = useState('');
  const [classSearch, setClassSearch] = useState('');

  const isAdmin = user?.role === 'admin';

  const deptSelectOptions = useMemo(
    () => withCurrentOption(deptOptions, resolvedCollegeId || user?.department, user?.collegeName),
    [deptOptions, resolvedCollegeId, user?.department, user?.collegeName]
  );

  // 加载中不要用「当前 1 项」顶替完整列表；加载完后再 merge 兜底
  const majorSelectOptions = useMemo(() => {
    if (majorLoading && majorOptions.length === 0) return [];
    return withCurrentOption(majorOptions, watchedMajorId || user?.majorId, user?.majorName);
  }, [majorLoading, majorOptions, watchedMajorId, user?.majorId, user?.majorName]);

  const classSelectOptions = useMemo(() => {
    const base = classOptions.map((cls) => ({ value: cls.id, label: cls.name }));
    if (classesLoading && base.length === 0) return [];
    return withCurrentOption(base, watchedClassId || user?.classId, user?.className);
  }, [classOptions, classesLoading, watchedClassId, user?.classId, user?.className]);

  const filterByLabel = (input: string, option?: { label?: unknown; value?: string | number }) => {
    if (!input.trim()) return true;
    return String(option?.label ?? '')
      .toLowerCase()
      .includes(input.trim().toLowerCase());
  };

  // 选了专业后再拉该专业下的班级
  useEffect(() => {
    if (!isOpen || !user || !isStudent) {
      setClassOptions([]);
      return;
    }
    const majorId = watchedMajorId ? String(watchedMajorId) : '';
    if (!resolvedCollegeId || !majorId) {
      setClassOptions([]);
      setClassesLoading(false);
      return;
    }
    let cancelled = false;
    setClassesLoading(true);
    fetchAdminClasses(resolvedCollegeId, majorId)
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
  }, [isOpen, user, isStudent, resolvedCollegeId, watchedMajorId]);

  // 打开/切换用户时写入表单；学院统一成有效 id（脏 id 按 collegeName 校正）
  useEffect(() => {
    if (!user || !isOpen) return;
    const deptId =
      resolveCollegeId(user.department, deptOptions, user.collegeName) ||
      String(user.department || '').trim();
    form.setFieldsValue({
      name: user.name,
      idNumber: user.studentId || user.employeeId || user.username || '',
      email: user.email || '',
      department: deptId || undefined,
      majorId: user.majorId ? String(user.majorId) : undefined,
      role: lockRole ?? user.role,
      classId: user.classId ? String(user.classId) : undefined,
    });
  }, [user, form, lockRole, isOpen, deptOptions]);

  // 字典加载后若表单里仍是无效学院 id，再校正一次
  useEffect(() => {
    if (!isOpen || !user || !deptOptions.length) return;
    const cur = form.getFieldValue('department');
    const fixed = resolveCollegeId(cur || user.department, deptOptions, user.collegeName);
    if (fixed && String(cur) !== fixed) {
      form.setFieldsValue({ department: fixed });
    }
  }, [isOpen, user, deptOptions, form]);

  // 专业列表就绪后：仅当「已加载完且确实不属于该学院」才清空（加载中/空列表不误清）
  useEffect(() => {
    if (!isStudent || !resolvedCollegeId || majorLoading) return;
    if (!majorOptions.length) return;
    const majorId = form.getFieldValue('majorId');
    if (majorId && !majorOptions.some((o) => o.value === String(majorId))) {
      form.setFieldsValue({ majorId: undefined, classId: undefined });
    }
  }, [isStudent, resolvedCollegeId, majorOptions, majorLoading, form]);

  useEffect(() => {
    if (!isStudent || !watchedMajorId || classesLoading) return;
    if (!classOptions.length) return;
    const classId = form.getFieldValue('classId');
    if (classId && !classOptions.some((c) => c.id === String(classId))) {
      form.setFieldsValue({ classId: undefined });
    }
  }, [isStudent, watchedMajorId, classOptions, classesLoading, form]);

  if (!isOpen || !user) return null;

  const modalTitle =
    effRole === 'admin'
      ? '编辑管理员信息'
      : isStudent
        ? '编辑学生信息'
        : '编辑教师信息';

  const handleClose = () => {
    form.resetFields();
    onClose();
  };

  const handleFinish = async (values: EditFormValues) => {
    setSubmitting(true);
    try {
      const submitRole = (lockRole ?? (isAdmin ? user.role : values.role ?? effRole)) as UserRole;
      const deptId =
        resolveCollegeId(values.department, deptOptions, user.collegeName) ||
        String(values.department || '').trim();
      await Promise.resolve(
        onSubmit(user.id, {
          ...values,
          name: values.name.trim(),
          idNumber: values.idNumber.trim(),
          email: values.email != null ? String(values.email).trim() : '',
          department: deptId,
          role: submitRole,
          classId: submitRole === 'student' ? String(values.classId ?? '') : '',
          ...(submitRole === 'student'
            ? { majorId: String(values.majorId ?? '') }
            : submitRole === 'teacher'
              ? { majorId: '' }
              : {}),
        })
      );
    } finally {
      setSubmitting(false);
    }
  };

  const idLabel = isStudent ? '学号' : '工号';

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
          {lockRole ? (
            <Form.Item name="role" hidden>
              <Input />
            </Form.Item>
          ) : null}

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
              { required: true, message: isStudent ? '请输入学号' : '请输入工号' },
              { whitespace: true, message: isStudent ? '学号不能为空' : '工号不能为空' },
            ]}
          >
            <Input
              placeholder={isStudent ? '请输入学号' : '请输入工号'}
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
            <Select
              className="h-[42px]"
              placeholder="请选择学院"
              loading={deptLoading}
              options={deptSelectOptions}
              showSearch
              searchValue={deptSearch}
              onSearch={setDeptSearch}
              filterOption={filterByLabel}
              onOpenChange={(open) => {
                if (open) setDeptSearch('');
              }}
              onChange={(v) => {
                form.setFieldsValue({
                  department: v,
                  ...(isStudent ? { majorId: undefined, classId: undefined } : {}),
                });
              }}
            />
          </Form.Item>

          {isStudent && !isAdmin ? (
            <Form.Item label="专业" name="majorId" rules={[{ required: true, message: '请选择专业' }]}>
              <Select
                key={`major-${resolvedCollegeId}`}
                className="h-[42px]"
                placeholder={resolvedCollegeId ? '请选择专业' : '请先选择学院'}
                loading={majorLoading}
                options={majorSelectOptions}
                showSearch
                searchValue={majorSearch}
                onSearch={setMajorSearch}
                filterOption={filterByLabel}
                disabled={!resolvedCollegeId}
                labelRender={(item) => {
                  const hit = majorSelectOptions.find((o) => o.value === String(item.value));
                  return (hit?.label as string) || user?.majorName || String(item.value ?? '');
                }}
                onOpenChange={(open) => {
                  if (open) setMajorSearch('');
                }}
                onChange={(v) => {
                  form.setFieldsValue({ majorId: v, classId: undefined });
                }}
              />
            </Form.Item>
          ) : null}

          {isStudent && !isAdmin ? (
            <Form.Item label="班级" name="classId" rules={[{ required: true, message: '请选择班级' }]}>
              <Select
                key={`class-${watchedMajorId || ''}`}
                className="h-[42px]"
                placeholder={watchedMajorId ? '请选择班级' : '请先选择专业'}
                loading={classesLoading}
                options={classSelectOptions}
                showSearch
                searchValue={classSearch}
                onSearch={setClassSearch}
                filterOption={filterByLabel}
                disabled={!watchedMajorId}
                labelRender={(item) => {
                  const hit = classSelectOptions.find((o) => o.value === String(item.value));
                  return (hit?.label as string) || user?.className || String(item.value ?? '');
                }}
                onOpenChange={(open) => {
                  if (open) setClassSearch('');
                }}
              />
            </Form.Item>
          ) : null}

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
