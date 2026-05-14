import { useEffect } from 'react';
import { Form, Input, Select, Button } from 'antd';
import { UserRole } from './types';
import { useCollegeDictOptions } from './useCollegeDictOptions';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (userData: any) => void;
}

/** 新建/导入统一规则：学号或工号的后 6 位作为初始密码（不足 6 位则取全部） */
export function initialPasswordFromIdNumber(idNumber: string): string {
  const s = idNumber.trim();
  if (!s) return '';
  return s.slice(-6);
}

export default function AddUserModal({ isOpen, onClose, onSubmit }: AddUserModalProps) {
  const [form] = Form.useForm<{ name: string; role: UserRole; idNumber: string; email?: string; department: string }>();
  const role = Form.useWatch('role', form);
  const idNumber = Form.useWatch('idNumber', form) ?? '';
  const { options: deptOptions, loading: deptLoading } = useCollegeDictOptions(isOpen);

  useEffect(() => {
    if (isOpen) {
      form.resetFields();
    }
  }, [isOpen, form]);

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
  }) => {
    const id = values.idNumber.trim();
    try {
      await Promise.resolve(
        onSubmit({
          ...values,
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

  const idLabel = role === 'student' ? '学号' : '工号';
  const defaultPwd = initialPasswordFromIdNumber(idNumber);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
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
          initialValues={{ role: 'student' as UserRole }}
          onFinish={handleFinish}
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

            <Form.Item label="角色" name="role" rules={[{ required: true, message: '请选择角色' }]}>
              <Select
                className="h-[42px]"
                options={[
                  { value: 'student', label: '学生' },
                  { value: 'teacher', label: '教师' },
                ]}
              />
            </Form.Item>
          </div>

          <Form.Item
            label={idLabel}
            name="idNumber"
            rules={[
              { required: true, message: role === 'student' ? '请输入学号' : '请输入工号' },
              { whitespace: true, message: role === 'student' ? '学号不能为空' : '工号不能为空' },
            ]}
          >
            <Input placeholder={role === 'student' ? '请输入学号' : '请输入工号'} className="!py-2.5" />
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
              options={deptOptions}
              showSearch
              optionFilterProp="label"
              allowClear
            />
          </Form.Item>

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
            <Button type="primary" block size="large" htmlType="submit" className="!h-[42px] !bg-teal-600 hover:!bg-teal-700">
              确认新增
            </Button>
          </div>
        </Form>
      </div>
    </div>
  );
}
