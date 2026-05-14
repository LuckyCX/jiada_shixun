import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Button,
  ConfigProvider,
  Form,
  Input,
  InputNumber,
  message,
  Select,
  Spin,
  Switch,
  Tabs,
  type TabsProps,
} from 'antd';
import { ADMIN_TOKEN_KEY, loginWithApi } from '../../../../lib/authApi';
import { notifySiteBrandUpdated } from '../../../../lib/publicSite';
import { resizeImageFileTo128Png } from '../../../../lib/resizeLogoTo128';

/** 设为 true 可恢复 RTC 配置 Tab（逻辑已保留：state / fillFromApi / saveRtc） */
const SHOW_RTC_TAB = false;

type ConfigEntry = {
  value: Record<string, unknown>;
  description?: string;
  updated_at?: string;
};

type AdminConfigResponse = Record<string, ConfigEntry>;

type TabValue = 'site' | 'smtp' | 'sms' | (typeof SHOW_RTC_TAB extends true ? 'rtc' : never);

/** system_config.config_key → 配置页 Tab */
const CONFIG_TAB_MAP: Record<string, TabValue> = {
  site: 'site',
  smtp_config: 'smtp',
  aliyun_sms_config: 'sms',
  sms_biz_config: 'sms',
  /** 最近更新落在 RTC 时仍打开「站点」避免无 Tab */
  rtc_config: 'site',
};

const TAB_ORDER: TabValue[] = ['site', 'smtp', 'sms'];

const ALIYUN_SMS_REGION_OPTIONS = [
  { key: 'cn-hangzhou|dysmsapi.aliyuncs.com', label: '华东1（杭州）— dysmsapi.aliyuncs.com', regionId: 'cn-hangzhou', endpoint: 'dysmsapi.aliyuncs.com' },
  { key: 'cn-qingdao|dysmsapi.aliyuncs.com', label: '华北1（青岛）— dysmsapi.aliyuncs.com', regionId: 'cn-qingdao', endpoint: 'dysmsapi.aliyuncs.com' },
  {
    key: 'ap-southeast-1|dysmsapi.ap-southeast-1.aliyuncs.com',
    label: '新加坡（公网）— dysmsapi.ap-southeast-1.aliyuncs.com',
    regionId: 'ap-southeast-1',
    endpoint: 'dysmsapi.ap-southeast-1.aliyuncs.com',
  },
  {
    key: 'ap-southeast-1|dysmsapi-xman.vpc-proxy.aliyuncs.com',
    label: '新加坡（VPC）— dysmsapi-xman.vpc-proxy.aliyuncs.com',
    regionId: 'ap-southeast-1',
    endpoint: 'dysmsapi-xman.vpc-proxy.aliyuncs.com',
  },
  {
    key: 'eu-central-1|dysmsapi.eu-central-1.aliyuncs.com',
    label: '德国法兰克福（公网）— dysmsapi.eu-central-1.aliyuncs.com',
    regionId: 'eu-central-1',
    endpoint: 'dysmsapi.eu-central-1.aliyuncs.com',
  },
  {
    key: 'eu-central-1|dysmsapi-xman-vpc.eu-central-1.aliyuncs.com',
    label: '德国法兰克福（VPC）— dysmsapi-xman-vpc.eu-central-1.aliyuncs.com',
    regionId: 'eu-central-1',
    endpoint: 'dysmsapi-xman-vpc.eu-central-1.aliyuncs.com',
  },
  {
    key: 'ap-southeast-5|dysmsapi.ap-southeast-5.aliyuncs.com',
    label: '印尼雅加达（公网）— dysmsapi.ap-southeast-5.aliyuncs.com',
    regionId: 'ap-southeast-5',
    endpoint: 'dysmsapi.ap-southeast-5.aliyuncs.com',
  },
  {
    key: 'ap-southeast-5|dysmsapi-xman-vpc.ap-southeast-5.aliyuncs.com',
    label: '印尼雅加达（VPC）— dysmsapi-xman-vpc.ap-southeast-5.aliyuncs.com',
    regionId: 'ap-southeast-5',
    endpoint: 'dysmsapi-xman-vpc.ap-southeast-5.aliyuncs.com',
  },
] as const;

const formItemLayout = { labelCol: { span: 24 }, wrapperCol: { span: 24 } };

function pickTabByLatestUpdate(data: AdminConfigResponse): TabValue {
  const entries = Object.entries(data)
    .map(([key, entry]) => ({
      tab: CONFIG_TAB_MAP[key],
      t: entry.updated_at ? Date.parse(entry.updated_at) : 0,
    }))
    .filter((x): x is { tab: TabValue; t: number } => Boolean(x.tab));
  if (!entries.length) return 'site';
  entries.sort((a, b) => {
    if (b.t !== a.t) return b.t - a.t;
    return TAB_ORDER.indexOf(a.tab) - TAB_ORDER.indexOf(b.tab);
  });
  return entries[0].tab;
}

function apiBase() {
  return '';
}

async function apiFetch(path: string, opts: RequestInit & { token?: string } = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string>),
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const r = await fetch(`${apiBase()}${path}`, { ...opts, headers });
  const j = await r.json().catch(() => ({ code: -1, message: '无效 JSON' }));
  if (!r.ok || j.code !== 0) {
    throw new Error(j.message || `HTTP ${r.status}`);
  }
  return j;
}

export default function SystemConfigPanel() {
  const [messageApi, contextHolder] = message.useMessage();
  const [token, setToken] = useState(() => localStorage.getItem(ADMIN_TOKEN_KEY) || '');
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabValue>('site');

  const [site, setSite] = useState({ siteTitle: '', logoUrl: '' });
  const [logoUploading, setLogoUploading] = useState(false);
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const [smtp, setSmtp] = useState({ host: '', port: 465, secure: true, user: '', pass: '', from: '' });
  const [testSmtpTo, setTestSmtpTo] = useState('');
  const [testSmsPhone, setTestSmsPhone] = useState('');
  const [testSmsScene, setTestSmsScene] = useState<'login' | 'register' | 'reset'>('login');

  const [smsBiz, setSmsBiz] = useState({
    enabled: true,
    allowLogin: true,
    allowRegister: true,
    allowReset: true,
    expireSeconds: 300,
    cooldownSeconds: 60,
    dailyLimit: 20,
  });
  const [aliyunSms, setAliyunSms] = useState({
    accessKeyId: '',
    accessKeySecret: '',
    signName: '',
    templateCode: '',
    templateLogin: '',
    templateRegister: '',
    templateReset: '',
    regionId: 'cn-hangzhou',
    endpoint: 'dysmsapi.aliyuncs.com',
  });
  const [aliyunSmsRegionPreset, setAliyunSmsRegionPreset] = useState('');

  const [rtc, setRtc] = useState('{}');

  useEffect(() => {
    const hit = ALIYUN_SMS_REGION_OPTIONS.find(
      (o) => o.regionId === aliyunSms.regionId.trim() && o.endpoint === aliyunSms.endpoint.trim()
    );
    setAliyunSmsRegionPreset(hit ? hit.key : '');
  }, [aliyunSms.regionId, aliyunSms.endpoint]);

  const fillFromApi = useCallback((data: AdminConfigResponse) => {
    const s = (data.site?.value || {}) as Record<string, string>;
    setSite({
      siteTitle: String(s.siteTitle || ''),
      logoUrl: String(s.logoUrl || ''),
    });
    const sm = (data.smtp_config?.value || {}) as Record<string, unknown>;
    setSmtp({
      host: String(sm.host ?? ''),
      port: Number(sm.port ?? 465),
      secure: Boolean(sm.secure ?? true),
      user: String(sm.user ?? ''),
      pass: String(sm.pass ?? ''),
      from: String(sm.from ?? ''),
    });
    const biz = (data.sms_biz_config?.value || {}) as Record<string, unknown>;
    setSmsBiz({
      enabled: biz.enabled !== false,
      allowLogin: biz.allowLogin !== false,
      allowRegister: biz.allowRegister !== false,
      allowReset: biz.allowReset !== false,
      expireSeconds: Number(biz.expireSeconds ?? 300),
      cooldownSeconds: Number(biz.cooldownSeconds ?? 60),
      dailyLimit: Number(biz.dailyLimit ?? 20),
    });
    const al = (data.aliyun_sms_config?.value || {}) as Record<string, string>;
    const legacyCode = String(al.templateCode ?? '').trim();
    let templateLogin = String(al.templateLogin ?? '').trim();
    let templateRegister = String(al.templateRegister ?? '').trim();
    let templateReset = String(al.templateReset ?? '').trim();
    if (!templateLogin && legacyCode) templateLogin = legacyCode;
    if (!templateRegister && legacyCode) templateRegister = legacyCode;
    if (!templateReset && legacyCode) templateReset = legacyCode;
    const regionId = String(al.regionId ?? 'cn-hangzhou').trim() || 'cn-hangzhou';
    const endpoint = String(al.endpoint ?? 'dysmsapi.aliyuncs.com').trim() || 'dysmsapi.aliyuncs.com';
    setAliyunSms({
      accessKeyId: String(al.accessKeyId ?? ''),
      accessKeySecret: String(al.accessKeySecret ?? ''),
      signName: String(al.signName ?? ''),
      templateCode: legacyCode,
      templateLogin,
      templateRegister,
      templateReset,
      regionId,
      endpoint,
    });
    const rtcVal = data.rtc_config?.value;
    setRtc(JSON.stringify(rtcVal ?? {}, null, 2));
  }, []);

  const loadConfig = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const j = await apiFetch('/api/admin/system-config', { token });
      const data = j.data as AdminConfigResponse;
      fillFromApi(data);
      setActiveTab(pickTabByLatestUpdate(data));
    } catch (e) {
      messageApi.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token, fillFromApi, messageApi]);

  useEffect(() => {
    if (token) void loadConfig();
  }, [token, loadConfig]);

  const handleLogin = async () => {
    try {
      const { token: t, user } = await loginWithApi(loginUser, loginPass);
      if (user.role !== 'admin') {
        messageApi.error('该账号不是管理员');
        return;
      }
      localStorage.setItem(ADMIN_TOKEN_KEY, t);
      setToken(t);
      setLoginPass('');
      messageApi.success('登录成功');
    } catch (e) {
      messageApi.error((e as Error).message);
    }
  };

  const savePatch = async (patches: Record<string, Record<string, unknown>>): Promise<boolean> => {
    if (!token) return false;
    setLoading(true);
    try {
      await apiFetch('/api/admin/system-config', {
        method: 'PATCH',
        token,
        body: JSON.stringify({ patches }),
      });
      await loadConfig();
      messageApi.success('保存成功');
      return true;
    } catch (e) {
      messageApi.error((e as Error).message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const saveSite = async () => {
    const ok = await savePatch({
      site: {
        siteTitle: site.siteTitle.trim(),
        logoUrl: site.logoUrl.trim(),
      },
    });
    if (ok) notifySiteBrandUpdated();
  };

  const handleLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLogoUploading(true);
    try {
      const dataUrl = await resizeImageFileTo128Png(file);
      setSite((s) => ({ ...s, logoUrl: dataUrl }));
    } catch (err) {
      messageApi.error((err as Error).message);
    } finally {
      setLogoUploading(false);
    }
  };

  const saveSmtpAllowMaskedPass = () => {
    const host = smtp.host.trim();
    const user = smtp.user.trim();
    const from = smtp.from.trim();
    const port = Math.floor(Number(smtp.port));
    if (!host || !user || !from) {
      messageApi.warning('请填写 SMTP Host、用户名与发件人');
      return;
    }
    if (!Number.isFinite(port) || port <= 0 || port > 65535) {
      messageApi.warning('SMTP 端口范围应为 1～65535');
      return;
    }
    const patch: Record<string, unknown> = {
      host,
      port,
      secure: smtp.secure === true,
      user,
      from,
    };
    if (smtp.pass && smtp.pass !== '********') patch.pass = smtp.pass;
    void savePatch({ smtp_config: patch });
  };

  const saveSms = () => {
    const expireSeconds = Math.max(60, Math.min(1800, Math.floor(Number(smsBiz.expireSeconds) || 300)));
    const cooldownSeconds = Math.max(10, Math.min(300, Math.floor(Number(smsBiz.cooldownSeconds) || 60)));
    const dailyLimit = Math.max(1, Math.min(100, Math.floor(Number(smsBiz.dailyLimit) || 20)));
    void savePatch({
      sms_biz_config: {
        enabled: smsBiz.enabled === true,
        allowLogin: smsBiz.allowLogin === true,
        allowRegister: smsBiz.allowRegister === true,
        allowReset: smsBiz.allowReset === true,
        expireSeconds,
        cooldownSeconds,
        dailyLimit,
      },
      aliyun_sms_config: {
        accessKeyId: aliyunSms.accessKeyId.trim(),
        accessKeySecret: aliyunSms.accessKeySecret.trim(),
        signName: aliyunSms.signName.trim(),
        templateCode: aliyunSms.templateCode.trim(),
        templateLogin: aliyunSms.templateLogin.trim(),
        templateRegister: aliyunSms.templateRegister.trim(),
        templateReset: aliyunSms.templateReset.trim(),
        regionId: aliyunSms.regionId.trim() || 'cn-hangzhou',
        endpoint: aliyunSms.endpoint.trim() || 'dysmsapi.aliyuncs.com',
      },
    });
  };

  const saveRtc = () => {
    try {
      const parsed = JSON.parse(rtc);
      void savePatch({ rtc_config: parsed as Record<string, unknown> });
    } catch {
      messageApi.error('RTC 配置需为合法 JSON');
    }
  };

  const sendTestSmtp = async () => {
    if (!token) return;
    const to = testSmtpTo.trim();
    if (!to) {
      messageApi.warning('请填写测试收件人邮箱');
      return;
    }
    setLoading(true);
    try {
      await apiFetch('/api/admin/system-config/test-smtp', {
        method: 'POST',
        token,
        body: JSON.stringify({ to }),
      });
      messageApi.success('测试邮件已发送');
    } catch (e) {
      messageApi.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const sendTestSms = async () => {
    if (!token) return;
    const phone = testSmsPhone.trim();
    if (!/^1\d{10}$/.test(phone)) {
      messageApi.warning('请输入 11 位中国大陆手机号');
      return;
    }
    setLoading(true);
    try {
      await apiFetch('/api/admin/system-config/test-sms', {
        method: 'POST',
        token,
        body: JSON.stringify({ phone, scene: testSmsScene }),
      });
      messageApi.success('测试短信已发送（已计费）');
    } catch (e) {
      messageApi.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const regionSelectOptions = ALIYUN_SMS_REGION_OPTIONS.map((o) => ({ label: o.label, value: o.key }));

  const smsSwitchRows: { key: 'enabled' | 'allowLogin' | 'allowRegister' | 'allowReset'; label: string }[] = [
    { key: 'enabled', label: '短信总开关' },
    { key: 'allowLogin', label: '短信登录' },
    { key: 'allowRegister', label: '短信注册' },
    { key: 'allowReset', label: '短信找回密码' },
  ];

  const renderLogoField = (): ReactNode => (
    <div className="flex flex-wrap items-start gap-4">
      <div className="w-32 h-32 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
        {site.logoUrl ? (
          <img src={site.logoUrl} alt="Logo 预览" className="w-full h-full object-contain" />
        ) : (
          <span className="text-xs text-gray-400 px-2 text-center">无 Logo</span>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <input
          ref={logoFileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          tabIndex={-1}
          aria-hidden
          style={{ display: 'none' }}
          onChange={handleLogoFile}
          disabled={logoUploading || loading}
        />
        <Button disabled={loading} loading={logoUploading} onClick={() => logoFileInputRef.current?.click()}>
          选择图片上传
        </Button>
        <Button disabled={loading || !site.logoUrl} onClick={() => setSite((s) => ({ ...s, logoUrl: '' }))}>
          清除 Logo
        </Button>
      </div>
    </div>
  );

  const tabItems = [
    {
      key: 'site',
      label: '站点与品牌',
      forceRender: true,
      children: (
        <div className="p-6 max-w-3xl">
          <Form {...formItemLayout} layout="vertical" requiredMark={false}>
            <Form.Item label="站点标题">
              <Input
                value={site.siteTitle}
                onChange={(e) => setSite((s) => ({ ...s, siteTitle: e.target.value }))}
              />
            </Form.Item>
            <Form.Item label="站点 Logo">{renderLogoField()}</Form.Item>
            <Form.Item>
              <Button type="primary" loading={loading} onClick={() => void saveSite()}>
                保存站点配置
              </Button>
            </Form.Item>
          </Form>
        </div>
      ),
    },
    {
      key: 'smtp',
      label: 'SMTP 邮件',
      forceRender: true,
      children: (
        <div className="p-6 w-full max-w-[1280px] min-w-0 min-[1200px]:px-8">
          <div className="grid grid-cols-1 gap-8 min-[1200px]:grid-cols-2 min-[1200px]:gap-x-10 min-[1200px]:items-start">
            <section className="min-w-0">
              <Form {...formItemLayout} layout="vertical" requiredMark={false}>
                <Form.Item label="SMTP Host">
                  <Input
                    value={smtp.host}
                    onChange={(e) => setSmtp((s) => ({ ...s, host: e.target.value }))}
                    placeholder="例如 smtp.qq.com"
                  />
                </Form.Item>
                <Form.Item label="SMTP Port">
                  <InputNumber
                    className="w-full"
                    min={1}
                    max={65535}
                    value={smtp.port}
                    onChange={(v) => setSmtp((s) => ({ ...s, port: typeof v === 'number' ? v : 465 }))}
                  />
                </Form.Item>
                <Form.Item label="TLS/SSL">
                  <Switch checked={smtp.secure} onChange={(v) => setSmtp((s) => ({ ...s, secure: v }))} />
                </Form.Item>
                <Form.Item label="SMTP 用户名">
                  <Input
                    value={smtp.user}
                    onChange={(e) => setSmtp((s) => ({ ...s, user: e.target.value }))}
                    placeholder="通常为邮箱账号"
                  />
                </Form.Item>
                <Form.Item label="SMTP 密码">
                  <Input.Password
                    value={smtp.pass}
                    onChange={(e) => setSmtp((s) => ({ ...s, pass: e.target.value }))}
                    placeholder="邮箱 SMTP 授权码/密码"
                  />
                </Form.Item>
                <Form.Item label="发件人 From">
                  <Input
                    value={smtp.from}
                    onChange={(e) => setSmtp((s) => ({ ...s, from: e.target.value }))}
                    placeholder="例如：大学生创业实训平台 <notice@example.com>"
                  />
                </Form.Item>
              </Form>
            </section>
            <section className="min-w-0">
              <Form {...formItemLayout} layout="vertical" requiredMark={false}>
                <div className="grid grid-cols-1 gap-6 min-[1200px]:grid-cols-2 min-[1200px]:gap-x-10">
                  <Form.Item label="测试收件人">
                    <Input
                      value={testSmtpTo}
                      onChange={(e) => setTestSmtpTo(e.target.value)}
                      placeholder="your@email.com"
                    />
                  </Form.Item>
                  <Form.Item label="操作">
                    <Button onClick={sendTestSmtp} disabled={loading}>
                      发送测试邮件
                    </Button>
                  </Form.Item>
                </div>
              </Form>
            </section>
          </div>
          <div className="mt-8 pt-6 border-t border-gray-100">
            <Button type="primary" loading={loading} onClick={saveSmtpAllowMaskedPass}>
              保存 SMTP
            </Button>
          </div>
        </div>
      ),
    },
    {
      key: 'sms',
      label: '短信配置',
      forceRender: true,
      children: (
        <div className="p-6 w-full max-w-[1280px] min-w-0 min-[1200px]:px-8">
          <div className="grid grid-cols-1 gap-8 min-[1200px]:grid-cols-2 min-[1200px]:gap-x-10 min-[1200px]:items-start">
            <section className="min-w-0">
              <div className="space-y-1 mb-4">
                {smsSwitchRows.map(({ key, label: rowLabel }) => (
                  <div
                    key={key}
                    className="flex items-center justify-between py-2.5 px-1 border-b border-gray-100"
                  >
                    <span className="text-sm text-gray-700">{rowLabel}</span>
                    <Switch
                      checked={smsBiz[key]}
                      onChange={(v) => setSmsBiz((b) => ({ ...b, [key]: v }))}
                    />
                  </div>
                ))}
              </div>
              <Form {...formItemLayout} layout="vertical" requiredMark={false}>
                <Form.Item label="验证码有效期（秒）">
                  <InputNumber
                    className="w-full"
                    min={60}
                    max={1800}
                    value={smsBiz.expireSeconds}
                    onChange={(v) =>
                      setSmsBiz((b) => ({ ...b, expireSeconds: typeof v === 'number' ? v : 300 }))
                    }
                  />
                </Form.Item>
                <Form.Item label="发送冷却（秒）">
                  <InputNumber
                    className="w-full"
                    min={10}
                    max={300}
                    value={smsBiz.cooldownSeconds}
                    onChange={(v) =>
                      setSmsBiz((b) => ({ ...b, cooldownSeconds: typeof v === 'number' ? v : 60 }))
                    }
                  />
                </Form.Item>
                <Form.Item label="每日每号上限">
                  <InputNumber
                    className="w-full"
                    min={1}
                    max={100}
                    value={smsBiz.dailyLimit}
                    onChange={(v) => setSmsBiz((b) => ({ ...b, dailyLimit: typeof v === 'number' ? v : 20 }))}
                  />
                </Form.Item>
              </Form>
            </section>
            <section className="min-w-0">
              <Form {...formItemLayout} layout="vertical" requiredMark={false}>
                <Form.Item label="AccessKeyId">
                  <Input
                    value={aliyunSms.accessKeyId}
                    onChange={(e) => setAliyunSms((a) => ({ ...a, accessKeyId: e.target.value }))}
                  />
                </Form.Item>
                <Form.Item label="AccessKeySecret">
                  <Input.Password
                    value={aliyunSms.accessKeySecret}
                    onChange={(e) => setAliyunSms((a) => ({ ...a, accessKeySecret: e.target.value }))}
                  />
                </Form.Item>
                <Form.Item label="短信签名">
                  <Input
                    value={aliyunSms.signName}
                    onChange={(e) => setAliyunSms((a) => ({ ...a, signName: e.target.value }))}
                    placeholder="与阿里云审核通过的签名一致"
                  />
                </Form.Item>
                <Form.Item label="地域与 Endpoint 预设">
                  <Select
                    allowClear
                    placeholder="选择常用地域（可再手动改下方两项）"
                    options={regionSelectOptions}
                    value={aliyunSmsRegionPreset || undefined}
                    onChange={(v) => {
                      const key = (v as string) || '';
                      setAliyunSmsRegionPreset(key);
                      const hit = ALIYUN_SMS_REGION_OPTIONS.find((o) => o.key === key);
                      if (hit) {
                        setAliyunSms((a) => ({ ...a, regionId: hit.regionId, endpoint: hit.endpoint }));
                      }
                    }}
                  />
                </Form.Item>
                <Form.Item label="regionId">
                  <Input
                    value={aliyunSms.regionId}
                    onChange={(e) => setAliyunSms((a) => ({ ...a, regionId: e.target.value }))}
                    placeholder="如 cn-hangzhou"
                  />
                </Form.Item>
                <Form.Item label="Endpoint">
                  <Input
                    value={aliyunSms.endpoint}
                    onChange={(e) => setAliyunSms((a) => ({ ...a, endpoint: e.target.value }))}
                    placeholder="dysmsapi.aliyuncs.com"
                  />
                </Form.Item>
                <Form.Item label="登录模板 CODE">
                  <Input
                    value={aliyunSms.templateLogin}
                    onChange={(e) => setAliyunSms((a) => ({ ...a, templateLogin: e.target.value }))}
                  />
                </Form.Item>
                <Form.Item label="注册模板 CODE">
                  <Input
                    value={aliyunSms.templateRegister}
                    onChange={(e) => setAliyunSms((a) => ({ ...a, templateRegister: e.target.value }))}
                  />
                </Form.Item>
                <Form.Item label="找回密码模板 CODE">
                  <Input
                    value={aliyunSms.templateReset}
                    onChange={(e) => setAliyunSms((a) => ({ ...a, templateReset: e.target.value }))}
                  />
                </Form.Item>
                <Form.Item label="旧版单模板 templateCode（可选）">
                  <Input
                    value={aliyunSms.templateCode}
                    onChange={(e) => setAliyunSms((a) => ({ ...a, templateCode: e.target.value }))}
                  />
                </Form.Item>
              </Form>
            </section>
          </div>
          <div className="mt-8 pt-6 border-t border-gray-100">
            <Button type="primary" loading={loading} onClick={saveSms}>
              保存短信配置
            </Button>
          </div>
          <div className="mt-6 pt-6 border-t border-gray-100">
            <Form {...formItemLayout} layout="vertical" requiredMark={false}>
              <div className="grid grid-cols-1 gap-6 min-[1200px]:grid-cols-2 min-[1200px]:gap-x-10">
                <Form.Item label="测试手机号">
                  <Input
                    value={testSmsPhone}
                    onChange={(e) => setTestSmsPhone(e.target.value)}
                    placeholder="11 位手机号"
                  />
                </Form.Item>
                <Form.Item label="测试场景">
                  <Select
                    options={[
                      { label: '登录模板', value: 'login' },
                      { label: '注册模板', value: 'register' },
                      { label: '找回模板', value: 'reset' },
                    ]}
                    value={testSmsScene}
                    onChange={(v) => setTestSmsScene((v as 'login' | 'register' | 'reset') || 'login')}
                  />
                </Form.Item>
              </div>
              <Form.Item>
                <Button onClick={sendTestSms} disabled={loading}>
                  发送测试短信
                </Button>
              </Form.Item>
            </Form>
          </div>
        </div>
      ),
    },
    ...(SHOW_RTC_TAB
      ? [
          {
            key: 'rtc',
            label: 'RTC 扩展',
            forceRender: true,
            children: (
              <div className="p-6 max-w-3xl">
                <Input.TextArea
                  value={rtc}
                  onChange={(e) => setRtc(e.target.value)}
                  autoSize={{ minRows: 10, maxRows: 22 }}
                  className="font-mono text-sm"
                />
                <div className="mt-4">
                  <Button type="primary" loading={loading} onClick={saveRtc}>
                    保存 RTC 配置
                  </Button>
                </div>
              </div>
            ),
          },
        ]
      : []),
  ] satisfies NonNullable<TabsProps['items']>;

  const adminTheme = {
    token: {
      colorPrimary: '#0d9488',
      borderRadius: 8,
    },
  };

  if (!token) {
    return (
      <ConfigProvider theme={adminTheme}>
        {contextHolder}
        <div className="min-h-screen bg-gray-50 p-6">
          <div className="max-w-md mx-auto bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
            <h1 className="text-xl font-bold text-gray-900 mb-1">管理员登录</h1>
            <p className="text-sm text-gray-500 mb-6">登录后可编辑系统配置</p>
            <Form {...formItemLayout} layout="vertical" requiredMark={false}>
              <Form.Item label="用户名">
                <Input value={loginUser} onChange={(e) => setLoginUser(e.target.value)} placeholder="admin" />
              </Form.Item>
              <Form.Item label="密码">
                <Input.Password value={loginPass} onChange={(e) => setLoginPass(e.target.value)} />
              </Form.Item>
              <Form.Item>
                <Button type="primary" block onClick={handleLogin}>
                  登录
                </Button>
              </Form.Item>
            </Form>
          </div>
        </div>
      </ConfigProvider>
    );
  }

  return (
    <ConfigProvider theme={adminTheme}>
      {contextHolder}
      <div className="min-h-screen bg-gray-50 ">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <Spin spinning={loading} tip="加载中…">
            <Tabs
              type="card"
              activeKey={activeTab}
              onChange={(k) => setActiveTab(k as TabValue)}
              items={tabItems}
            />
          </Spin>
        </div>
      </div>
    </ConfigProvider>
  );
}
