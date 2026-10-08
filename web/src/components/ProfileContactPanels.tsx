import { useEffect, useState } from 'react';
import { Button, Input, Tabs, message } from 'antd';
import {
  changePasswordWithApi,
  sendBindEmailCodeApi,
  sendBindPhoneCodeApi,
  sendSecureCodeApi,
  type PortalRole,
} from '../lib/authApi';
import { PASSWORD_POLICY_HINT, validatePasswordStrength } from '../lib/passwordPolicy';

export type ProfileClassCardItem = {
  id: string;
  title: string;
  subtitle?: string;
};

type ContactSavePayload =
  | { email: string; code: string }
  | { phone: string; phoneCode: string };

type Props = {
  role: PortalRole;
  email: string;
  phone: string;
  /** 个性化班级卡片；空数组显示空态 */
  classItems: ProfileClassCardItem[];
  classEmptyText?: string;
  /** 保存邮箱或手机（走角色 PATCH /me） */
  onSaveContact: (payload: ContactSavePayload) => Promise<void>;
  /** 绑定成功后回写父级档案 */
  onContactSaved?: (next: { email: string; phone: string }) => void;
};

/** 默认每行 2 个；抽屉较宽时每行 3 个 */
function PersonalClassCardGrid({
  items,
  emptyText = '暂无个性化班级',
}: {
  items: ProfileClassCardItem[];
  emptyText?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-sm font-semibold text-gray-900 mb-3">个性化班级</div>
      {items.length === 0 ? (
        <div className="text-sm text-gray-400 py-2">{emptyText}</div>
      ) : (
        <div className="grid grid-cols-2 min-[420px]:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-2.5 min-w-0"
            >
              <div className="text-sm text-gray-800 truncate font-medium" title={item.title}>
                {item.title}
              </div>
              {item.subtitle ? (
                <div className="text-xs text-gray-500 truncate mt-0.5" title={item.subtitle}>
                  {item.subtitle}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 个人中心：联系方式（邮箱/手机 Tab）+ 改密（须邮箱或手机验证码）
 * 学生、教师 Drawer 共用
 */
export default function ProfileContactPanels({
  role,
  email,
  phone,
  classItems,
  classEmptyText,
  onSaveContact,
  onContactSaved,
}: Props) {
  const [contactTab, setContactTab] = useState<'email' | 'phone'>('email');
  const [emailDraft, setEmailDraft] = useState(email || '');
  const [emailCode, setEmailCode] = useState('');
  const [phoneDraft, setPhoneDraft] = useState(phone || '');
  const [phoneCode, setPhoneCode] = useState('');
  const [bindSending, setBindSending] = useState(false);
  const [bindCountdown, setBindCountdown] = useState(0);
  const [contactSaving, setContactSaving] = useState(false);

  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [verifyChannel, setVerifyChannel] = useState<'email' | 'phone'>(email ? 'email' : 'phone');
  const [verifyCode, setVerifyCode] = useState('');
  const [secureSending, setSecureSending] = useState(false);
  const [secureCountdown, setSecureCountdown] = useState(0);
  const [pwdSaving, setPwdSaving] = useState(false);

  useEffect(() => {
    setEmailDraft(email || '');
  }, [email]);

  useEffect(() => {
    setPhoneDraft(phone || '');
  }, [phone]);

  useEffect(() => {
    if (email) setVerifyChannel('email');
    else if (phone) setVerifyChannel('phone');
  }, [email, phone]);

  useEffect(() => {
    if (bindCountdown <= 0) return;
    const t = window.setTimeout(() => setBindCountdown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [bindCountdown]);

  useEffect(() => {
    if (secureCountdown <= 0) return;
    const t = window.setTimeout(() => setSecureCountdown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [secureCountdown]);

  const handleSendBindCode = async () => {
    setBindSending(true);
    try {
      if (contactTab === 'email') {
        const e = emailDraft.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
          message.warning('请输入正确的邮箱');
          return;
        }
        await sendBindEmailCodeApi(role, e);
      } else {
        const p = phoneDraft.replace(/\D/g, '');
        if (!/^1\d{10}$/.test(p)) {
          message.warning('请输入正确的手机号');
          return;
        }
        await sendBindPhoneCodeApi(role, p);
      }
      setBindCountdown(60);
      message.success('验证码已发送');
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '发送失败');
    } finally {
      setBindSending(false);
    }
  };

  const handleSaveContact = async () => {
    setContactSaving(true);
    try {
      if (contactTab === 'email') {
        const e = emailDraft.trim();
        if (!e || !emailCode.trim()) {
          message.warning('请填写邮箱与验证码');
          return;
        }
        await onSaveContact({ email: e, code: emailCode.trim() });
        setEmailCode('');
        onContactSaved?.({ email: e, phone });
      } else {
        const p = phoneDraft.replace(/\D/g, '');
        if (!p || !phoneCode.trim()) {
          message.warning('请填写手机号与验证码');
          return;
        }
        await onSaveContact({ phone: p, phoneCode: phoneCode.trim() });
        setPhoneCode('');
        onContactSaved?.({ email, phone: p });
      }
      message.success('已保存');
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setContactSaving(false);
    }
  };

  const handleSendSecureCode = async () => {
    if (verifyChannel === 'email' && !email) {
      message.warning('请先绑定邮箱');
      return;
    }
    if (verifyChannel === 'phone' && !phone) {
      message.warning('请先绑定手机号');
      return;
    }
    setSecureSending(true);
    try {
      await sendSecureCodeApi(role, verifyChannel);
      setSecureCountdown(60);
      message.success(verifyChannel === 'email' ? '验证码已发送至邮箱' : '验证码已发送至手机');
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '发送失败');
    } finally {
      setSecureSending(false);
    }
  };

  const handleSavePassword = async () => {
    setPwdSaving(true);
    try {
      if (!oldPwd) {
        message.warning('请输入旧密码');
        return;
      }
      const strength = validatePasswordStrength(newPwd);
      if (!strength.ok) {
        message.warning(PASSWORD_POLICY_HINT);
        return;
      }
      if (!confirmPwd) {
        message.warning('请再次输入新密码');
        return;
      }
      if (newPwd !== confirmPwd) {
        message.warning('两次输入的新密码不一致');
        return;
      }
      if (!email && !phone) {
        message.warning('请先绑定邮箱或手机号，再修改密码');
        return;
      }
      if (!verifyCode.trim()) {
        message.warning('请输入验证码');
        return;
      }
      await changePasswordWithApi(role, {
        oldPassword: oldPwd,
        newPassword: newPwd,
        confirmPassword: confirmPwd,
        verifyChannel,
        verifyCode: verifyCode.trim(),
      });
      setOldPwd('');
      setNewPwd('');
      setConfirmPwd('');
      setVerifyCode('');
      message.success('密码已更新');
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setPwdSaving(false);
    }
  };

  const boundHint =
    verifyChannel === 'email'
      ? email
        ? `将发送至 ${email}`
        : '尚未绑定邮箱'
      : phone
        ? `将发送至 ${phone}`
        : '尚未绑定手机号';

  return (
    <>
      <PersonalClassCardGrid items={classItems} emptyText={classEmptyText} />

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-gray-900 mb-1">联系方式</div>
        <p className="text-xs text-gray-500 mb-2">绑定后可用于登录与找回密码</p>
        <Tabs
          size="small"
          activeKey={contactTab}
          onChange={(k) => setContactTab(k as 'email' | 'phone')}
          items={[
            {
              key: 'email',
              label: '邮箱',
              children: (
                <div className="space-y-3 pt-1">
                  <Input
                    value={emailDraft}
                    onChange={(e) => setEmailDraft(e.target.value)}
                    placeholder="绑定/修改邮箱"
                    autoComplete="email"
                  />
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      className="min-w-0 flex-1"
                      value={emailCode}
                      onChange={(e) => setEmailCode(e.target.value)}
                      placeholder="邮箱验证码"
                      maxLength={6}
                      autoComplete="one-time-code"
                    />
                    <Button
                      className="w-full sm:w-auto sm:flex-shrink-0"
                      loading={bindSending}
                      disabled={bindCountdown > 0}
                      onClick={() => void handleSendBindCode()}
                    >
                      {bindCountdown > 0 ? `${bindCountdown}s` : '获取验证码'}
                    </Button>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="primary"
                      size="small"
                      className="!bg-teal-500 !border-teal-500 hover:!bg-teal-600"
                      loading={contactSaving}
                      onClick={() => void handleSaveContact()}
                    >
                      保存邮箱
                    </Button>
                  </div>
                </div>
              ),
            },
            {
              key: 'phone',
              label: '手机号',
              children: (
                <div className="space-y-3 pt-1">
                  <Input
                    value={phoneDraft}
                    onChange={(e) => setPhoneDraft(e.target.value)}
                    placeholder="绑定/修改手机号"
                    maxLength={11}
                    autoComplete="tel"
                  />
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      className="min-w-0 flex-1"
                      value={phoneCode}
                      onChange={(e) => setPhoneCode(e.target.value)}
                      placeholder="手机验证码"
                      maxLength={6}
                      autoComplete="one-time-code"
                    />
                    <Button
                      className="w-full sm:w-auto sm:flex-shrink-0"
                      loading={bindSending}
                      disabled={bindCountdown > 0}
                      onClick={() => void handleSendBindCode()}
                    >
                      {bindCountdown > 0 ? `${bindCountdown}s` : '获取验证码'}
                    </Button>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="primary"
                      size="small"
                      className="!bg-teal-500 !border-teal-500 hover:!bg-teal-600"
                      loading={contactSaving}
                      onClick={() => void handleSaveContact()}
                    >
                      保存手机号
                    </Button>
                  </div>
                </div>
              ),
            },
          ]}
        />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-gray-900 mb-1">修改密码</div>
        <p className="text-xs text-gray-500 mb-3">须通过已绑定的邮箱或手机验证码确认</p>
        <div className="space-y-3">
          <Input.Password value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} placeholder="旧密码" autoComplete="current-password" />
          <Input.Password
            value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)}
            placeholder={PASSWORD_POLICY_HINT}
            autoComplete="new-password"
          />
          <Input.Password
            value={confirmPwd}
            onChange={(e) => setConfirmPwd(e.target.value)}
            placeholder="再次输入新密码"
            autoComplete="new-password"
          />
          <Tabs
            size="small"
            activeKey={verifyChannel}
            onChange={(k) => setVerifyChannel(k as 'email' | 'phone')}
            items={[
              { key: 'email', label: '邮箱验证', disabled: !email },
              { key: 'phone', label: '手机验证', disabled: !phone },
            ]}
          />
          <div className="text-xs text-gray-500 -mt-1">{boundHint}</div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              className="min-w-0 flex-1"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value)}
              placeholder="验证码"
              maxLength={6}
              autoComplete="one-time-code"
            />
            <Button
              className="w-full sm:w-auto sm:flex-shrink-0"
              loading={secureSending}
              disabled={secureCountdown > 0 || (verifyChannel === 'email' ? !email : !phone)}
              onClick={() => void handleSendSecureCode()}
            >
              {secureCountdown > 0 ? `${secureCountdown}s` : '获取验证码'}
            </Button>
          </div>
          <div className="flex justify-end">
            <Button
              type="primary"
              size="small"
              className="!bg-teal-500 !border-teal-500 hover:!bg-teal-600"
              loading={pwdSaving}
              onClick={() => void handleSavePassword()}
            >
              保存密码
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
