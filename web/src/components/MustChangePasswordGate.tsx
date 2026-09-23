import { useEffect, useState } from 'react';
import { Form, Input, Modal, Button, Typography } from 'antd';
import {
  changePasswordWithApi,
  getPortalToken,
  jwtRequiresPasswordChange,
  onMustChangePasswordRequired,
  type PortalRole,
} from '../lib/authApi';
import { PASSWORD_POLICY_HINT, validatePasswordStrength } from '../lib/passwordPolicy';

type FormVals = {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
};

/**
 * 弱口令强制改密：不可关闭（无遮罩关闭 / Esc / 关闭按钮）
 */
export default function MustChangePasswordGate() {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<PortalRole | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form] = Form.useForm<FormVals>();

  useEffect(() => {
    const unsub = onMustChangePasswordRequired((r) => {
      setRole(r);
      setOpen(true);
      setError('');
      form.resetFields();
    });
    // 页面刷新后若 token 仍带标记，直接弹出
    for (const r of ['admin', 'teacher', 'student'] as PortalRole[]) {
      const t = getPortalToken(r);
      if (t && jwtRequiresPasswordChange(t)) {
        setRole(r);
        setOpen(true);
        break;
      }
    }
    return unsub;
  }, [form]);

  const handleSubmit = async () => {
    if (!role) return;
    setError('');
    try {
      const values = await form.validateFields();
      const strength = validatePasswordStrength(values.newPassword);
      if (!strength.ok) {
        setError(strength.message);
        return;
      }
      if (values.newPassword !== values.confirmPassword) {
        setError('两次输入的新密码不一致');
        return;
      }
      setSubmitting(true);
      await changePasswordWithApi(role, {
        oldPassword: values.oldPassword,
        newPassword: values.newPassword,
        confirmPassword: values.confirmPassword,
      });
      setOpen(false);
      setRole(null);
      form.resetFields();
    } catch (e) {
      if (e && typeof e === 'object' && 'errorFields' in e) return;
      setError(e instanceof Error ? e.message : '修改失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title="修改密码"
      closable={false}
      maskClosable={false}
      keyboard={false}
      footer={null}
      destroyOnHidden
      width={440}
    >
      <Typography.Paragraph type="danger" className="!mb-4">
        密码强度过低，请修改密码后再使用系统
      </Typography.Paragraph>
      <Typography.Paragraph type="secondary" className="!text-xs !mb-4">
        {PASSWORD_POLICY_HINT}
      </Typography.Paragraph>
      <Form form={form} layout="vertical" requiredMark onFinish={() => void handleSubmit()}>
        <Form.Item
          label="旧密码"
          name="oldPassword"
          rules={[{ required: true, message: '请输入旧密码' }]}
        >
          <Input.Password autoComplete="current-password" placeholder="请输入旧密码" />
        </Form.Item>
        <Form.Item
          label="新密码"
          name="newPassword"
          rules={[
            { required: true, message: '请输入新密码' },
            {
              validator: async (_, v) => {
                const r = validatePasswordStrength(v);
                if (!r.ok) throw new Error(r.message);
              },
            },
          ]}
        >
          <Input.Password autoComplete="new-password" placeholder={PASSWORD_POLICY_HINT} />
        </Form.Item>
        <Form.Item
          label="确认新密码"
          name="confirmPassword"
          dependencies={['newPassword']}
          rules={[
            { required: true, message: '请再次输入新密码' },
            ({ getFieldValue }) => ({
              validator: async (_, v) => {
                if (v && v !== getFieldValue('newPassword')) {
                  throw new Error('两次输入的新密码不一致');
                }
              },
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" placeholder="再次输入新密码" />
        </Form.Item>
        {error ? <p className="text-sm text-red-600 mb-3">{error}</p> : null}
        <Button type="primary" htmlType="submit" block loading={submitting} className="!bg-teal-600">
          确认修改
        </Button>
      </Form>
    </Modal>
  );
}
