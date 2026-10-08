import { useCallback, useEffect, useState } from 'react';
import { Form, Input, Modal, Button, Typography, Space, message } from 'antd';
import { useLocation } from 'react-router-dom';
import {
  changePasswordWithApi,
  clearPortalToken,
  fetchAuthMe,
  getPortalToken,
  jwtRequiresPasswordChange,
  onMustChangePasswordRequired,
  sendBindEmailCodeApi,
  sendBindPhoneCodeApi,
  type PortalRole,
} from '../lib/authApi';
import { PASSWORD_POLICY_HINT, validatePasswordStrength } from '../lib/passwordPolicy';

type FormVals = {
  newPassword: string;
  confirmPassword: string;
  email?: string;
  emailCode?: string;
  phone?: string;
  phoneCode?: string;
};

function accountLabel(role: PortalRole | null): string {
  if (role === 'student') return '学号';
  if (role === 'teacher') return '工号';
  return '用户名';
}

/** 强制改密弹窗仅允许停留在这些业务区内 */
function isProtectedWorkspacePath(pathname: string): boolean {
  return (
    pathname.startsWith('/student-center') ||
    pathname.startsWith('/teacher-dashboard') ||
    pathname.startsWith('/admin-dashboard')
  );
}

/**
 * 弱口令强制改密：不可关闭；未绑邮箱时必须绑定邮箱（手机号可选）。
 * 离开业务区（如地址栏回到首页）时关闭弹窗并软登出，避免登录页残留弹窗。
 */
export default function MustChangePasswordGate() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<PortalRole | null>(null);
  /** 登录后可能仍在公开页，先进业务区再真正打开弹窗 */
  const [pendingRole, setPendingRole] = useState<PortalRole | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  /** 当前账号尚无邮箱时，强制改密须一并绑定邮箱 */
  const [needBindEmail, setNeedBindEmail] = useState(false);
  const [error, setError] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [phoneSending, setPhoneSending] = useState(false);
  const [emailCountdown, setEmailCountdown] = useState(0);
  const [phoneCountdown, setPhoneCountdown] = useState(0);
  const [form] = Form.useForm<FormVals>();

  useEffect(() => {
    if (emailCountdown <= 0) return;
    const t = window.setTimeout(() => setEmailCountdown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [emailCountdown]);

  useEffect(() => {
    if (phoneCountdown <= 0) return;
    const t = window.setTimeout(() => setPhoneCountdown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [phoneCountdown]);

  const loadProfile = useCallback(async (r: PortalRole) => {
    setLoadingProfile(true);
    setError('');
    try {
      const me = await fetchAuthMe(r);
      setNeedBindEmail(!String(me.email || '').trim());
    } catch (e) {
      // 拉取失败时仍要求绑邮箱，避免跳过
      setNeedBindEmail(true);
      setError(e instanceof Error ? e.message : '无法读取账号联系方式');
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  const openGateForRole = useCallback(
    (r: PortalRole) => {
      setRole(r);
      setPendingRole(null);
      setOpen(true);
      setError('');
      form.resetFields();
      setEmailCountdown(0);
      setPhoneCountdown(0);
      void loadProfile(r);
    },
    [form, loadProfile]
  );

  /** 未完成安全设置就离开业务区：关弹窗 + 清登录态 */
  const softLogoutIncomplete = useCallback(
    (r: PortalRole, showTip: boolean) => {
      clearPortalToken(r);
      setOpen(false);
      setRole(null);
      setPendingRole(null);
      setNeedBindEmail(false);
      setError('');
      form.resetFields();
      setEmailCountdown(0);
      setPhoneCountdown(0);
      if (showTip) {
        message.info('未完成账号安全设置，已退出登录');
      }
    },
    [form]
  );

  useEffect(() => {
    const unsub = onMustChangePasswordRequired((r) => {
      setRole(r);
      // 仍在登录页等公开路由时先挂起，避免「登录瞬间在 / 上打开又被软登出」
      if (isProtectedWorkspacePath(window.location.pathname)) {
        openGateForRole(r);
      } else {
        setPendingRole(r);
        setOpen(false);
      }
    });
    // 冷启动：仅在业务区根据 JWT 打开；公开页残留弱口令会话则静默清掉
    if (isProtectedWorkspacePath(location.pathname)) {
      for (const r of ['admin', 'teacher', 'student'] as PortalRole[]) {
        const t = getPortalToken(r);
        if (t && jwtRequiresPasswordChange(t)) {
          openGateForRole(r);
          break;
        }
      }
    } else {
      for (const r of ['admin', 'teacher', 'student'] as PortalRole[]) {
        const t = getPortalToken(r);
        if (t && jwtRequiresPasswordChange(t)) {
          clearPortalToken(r);
        }
      }
    }
    return unsub;
    // 仅挂载时订阅；路径变化由下方 effect 处理
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, [form, openGateForRole]);

  // 进入业务区：兑现挂起的强制改密；离开业务区且弹窗已开：软登出
  useEffect(() => {
    const path = location.pathname;
    if (isProtectedWorkspacePath(path)) {
      const r = pendingRole;
      if (r && !open) {
        const t = getPortalToken(r);
        if (t && jwtRequiresPasswordChange(t)) {
          openGateForRole(r);
        } else {
          setPendingRole(null);
        }
      }
      return;
    }
    // 仅在「弹窗已打开」时软登出，避免登录瞬间 notify 挂起 pending 仍在 / 上被清掉
    if (open && role) {
      softLogoutIncomplete(role, true);
    }
  }, [location.pathname, open, role, pendingRole, openGateForRole, softLogoutIncomplete]);

  const handleSendEmailCode = async () => {
    if (!role) return;
    const email = String(form.getFieldValue('email') || '').trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('请先填写正确的邮箱');
      return;
    }
    setError('');
    setEmailSending(true);
    try {
      await sendBindEmailCodeApi(role, email);
      setEmailCountdown(60);
    } catch (e) {
      setError(e instanceof Error ? e.message : '发送失败');
    } finally {
      setEmailSending(false);
    }
  };

  const handleSendPhoneCode = async () => {
    if (!role) return;
    const phone = String(form.getFieldValue('phone') || '').replace(/\D/g, '');
    if (!/^1\d{10}$/.test(phone)) {
      setError('请先填写正确的手机号');
      return;
    }
    setError('');
    setPhoneSending(true);
    try {
      await sendBindPhoneCodeApi(role, phone);
      setPhoneCountdown(60);
    } catch (e) {
      setError(e instanceof Error ? e.message : '发送失败');
    } finally {
      setPhoneSending(false);
    }
  };

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
      const email = String(values.email || '').trim();
      const phone = String(values.phone || '').replace(/\D/g, '');
      const emailCode = String(values.emailCode || '').trim();
      const phoneCode = String(values.phoneCode || '').trim();
      // 邮箱必绑：未绑邮箱时必须填写邮箱+验证码；手机号可选
      if (needBindEmail) {
        if (!email) {
          setError('请绑定邮箱');
          return;
        }
        if (!emailCode) {
          setError('请填写邮箱验证码');
          return;
        }
        if (phone && !phoneCode) {
          setError('请填写手机验证码');
          return;
        }
        if (phoneCode && !phone) {
          setError('请填写手机号');
          return;
        }
      }
      setSubmitting(true);
      await changePasswordWithApi(role, {
        newPassword: values.newPassword,
        confirmPassword: values.confirmPassword,
        ...(email && emailCode ? { email, emailCode } : {}),
        ...(phone && phoneCode ? { phone, phoneCode } : {}),
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

  const idHint = accountLabel(role);

  return (
    <Modal
      open={open}
      title="完善账号安全信息"
      closable={false}
      maskClosable={false}
      keyboard={false}
      footer={null}
      destroyOnHidden
      width={480}
    >
      <Typography.Paragraph type="danger" className="!mb-3">
        密码强度过低，请修改密码后再使用系统
      </Typography.Paragraph>
      <Typography.Paragraph type="secondary" className="!text-xs !mb-3">
        {PASSWORD_POLICY_HINT}
      </Typography.Paragraph>
      <Typography.Paragraph type="secondary" className="!text-xs !mb-4">
        以后可通过邮箱、手机号或{idHint}登录；忘记密码时可根据已绑定的邮箱或手机号重置密码。
        {needBindEmail ? ' 当前账号尚未绑定邮箱，请先绑定邮箱（手机号可选）。' : ''}
      </Typography.Paragraph>

      <Form form={form} layout="vertical" requiredMark onFinish={() => void handleSubmit()}>
        {needBindEmail && !loadingProfile ? (
          <>
            <Form.Item label="邮箱" required style={{ marginBottom: 8 }}>
              <Space.Compact className="w-full">
                <Form.Item
                  name="email"
                  noStyle
                  rules={[
                    { required: true, message: '请输入邮箱' },
                    { type: 'email', message: '邮箱格式不正确' },
                  ]}
                >
                  <Input placeholder="请输入邮箱" autoComplete="email" />
                </Form.Item>
                <Button
                  type="default"
                  loading={emailSending}
                  disabled={emailCountdown > 0}
                  onClick={() => void handleSendEmailCode()}
                >
                  {emailCountdown > 0 ? `${emailCountdown}s` : '发送验证码'}
                </Button>
              </Space.Compact>
            </Form.Item>
            <Form.Item
              label="邮箱验证码"
              name="emailCode"
              rules={[{ required: true, message: '请填写邮箱验证码' }]}
            >
              <Input placeholder="请填写邮箱验证码" maxLength={6} autoComplete="one-time-code" />
            </Form.Item>
            <Form.Item label="手机号（可选）" style={{ marginBottom: 8 }}>
              <Space.Compact className="w-full">
                <Form.Item
                  name="phone"
                  noStyle
                  rules={[
                    {
                      validator: async (_, v) => {
                        const p = String(v || '').replace(/\D/g, '');
                        if (!p) return;
                        if (!/^1\d{10}$/.test(p)) throw new Error('手机号格式不正确');
                      },
                    },
                  ]}
                >
                  <Input placeholder="选填，可稍后在个人中心绑定" autoComplete="tel" maxLength={11} />
                </Form.Item>
                <Button
                  type="default"
                  loading={phoneSending}
                  disabled={phoneCountdown > 0}
                  onClick={() => void handleSendPhoneCode()}
                >
                  {phoneCountdown > 0 ? `${phoneCountdown}s` : '发送验证码'}
                </Button>
              </Space.Compact>
            </Form.Item>
            <Form.Item label="手机验证码" name="phoneCode">
              <Input placeholder="若填写手机号请一并填写验证码" maxLength={6} autoComplete="one-time-code" />
            </Form.Item>
          </>
        ) : null}

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
        <Button
          type="primary"
          htmlType="submit"
          block
          loading={submitting || loadingProfile}
          className="!bg-teal-600"
        >
          确认提交
        </Button>
      </Form>
    </Modal>
  );
}
