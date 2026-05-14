import { useCallback, useEffect, useState } from 'react';
import {
  Divider,
  Form,
  Input,
  InputNumber,
  MessagePlugin,
  Select,
  Space,
  Switch,
  Tabs,
  Textarea,
} from 'tdesign-react';
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

type TabValue = 'site' | 'smtp' | 'sms';

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

const primaryBtnClass =
  'px-6 py-2.5 rounded-lg text-white font-medium bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
const secondaryBtnClass =
  'px-6 py-2.5 rounded-lg font-medium border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors';

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
  const [token, setToken] = useState(() => localStorage.getItem(ADMIN_TOKEN_KEY) || '');
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [raw, setRaw] = useState<AdminConfigResponse | null>(null);
  const [activeTab, setActiveTab] = useState<TabValue>('site');

  const [site, setSite] = useState({ siteTitle: '', logoUrl: '' });
  const [logoUploading, setLogoUploading] = useState(false);
  const [smtp, setSmtp] = useState({ host: '', port: 587, secure: false, user: '', pass: '', from: '' });
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
      port: Number(sm.port ?? 587),
      secure: Boolean(sm.secure ?? false),
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
      setRaw(data);
      fillFromApi(data);
      setActiveTab(pickTabByLatestUpdate(data));
    } catch (e) {
      MessagePlugin.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token, fillFromApi]);

  useEffect(() => {
    if (token) void loadConfig();
  }, [token, loadConfig]);

  const handleLogin = async () => {
    try {
      const { token: t, user } = await loginWithApi(loginUser, loginPass);
      if (user.role !== 'admin') {
        MessagePlugin.error('该账号不是管理员');
        return;
      }
      localStorage.setItem(ADMIN_TOKEN_KEY, t);
      setToken(t);
      setLoginPass('');
      MessagePlugin.success('登录成功');
    } catch (e) {
      MessagePlugin.error((e as Error).message);
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
      MessagePlugin.success('保存成功');
      return true;
    } catch (e) {
      MessagePlugin.error((e as Error).message);
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
      MessagePlugin.success('已生成 128×128 预览，请点击「保存站点配置」写入数据库');
    } catch (err) {
      MessagePlugin.error((err as Error).message);
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
      MessagePlugin.warning('请填写 SMTP Host、用户名与发件人');
      return;
    }
    if (!Number.isFinite(port) || port <= 0 || port > 65535) {
      MessagePlugin.warning('SMTP 端口范围应为 1～65535');
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
      MessagePlugin.error('RTC 配置需为合法 JSON');
    }
  };


  const sendTestSmtp = async () => {
    if (!token) return;
    const to = testSmtpTo.trim();
    if (!to) {
      MessagePlugin.warning('请填写测试收件人邮箱');
      return;
    }
    setLoading(true);
    try {
      await apiFetch('/api/admin/system-config/test-smtp', {
        method: 'POST',
        token,
        body: JSON.stringify({ to }),
      });
      MessagePlugin.success('测试邮件已发送');
    } catch (e) {
      MessagePlugin.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const sendTestSms = async () => {
    if (!token) return;
    const phone = testSmsPhone.trim();
    if (!/^1\d{10}$/.test(phone)) {
      MessagePlugin.warning('请输入 11 位中国大陆手机号');
      return;
    }
    setLoading(true);
    try {
      await apiFetch('/api/admin/system-config/test-sms', {
        method: 'POST',
        token,
        body: JSON.stringify({ phone, scene: testSmsScene }),
      });
      MessagePlugin.success('测试短信已发送（已计费）');
    } catch (e) {
      MessagePlugin.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const formItemProps = { labelAlign: 'top' as const };

  const regionSelectOptions = ALIYUN_SMS_REGION_OPTIONS.map((o) => ({ label: o.label, value: o.key }));

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-md mx-auto bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
          <h1 className="text-xl font-bold text-gray-900 mb-1">管理员登录</h1>
          <p className="text-sm text-gray-500 mb-6">登录后可编辑库内系统配置（默认账号见 docs/sql/README.md）</p>
          <Form layout="vertical" colon>
            <Form.FormItem label="用户名" {...formItemProps}>
              <Input value={loginUser} onChange={(v) => setLoginUser(String(v))} placeholder="admin" />
            </Form.FormItem>
            <Form.FormItem label="密码" {...formItemProps}>
              <Input type="password" value={loginPass} onChange={(v) => setLoginPass(String(v))} />
            </Form.FormItem>
            <Form.FormItem>
              <button type="button" className={`w-full ${primaryBtnClass}`} onClick={handleLogin}>
                登录
              </button>
            </Form.FormItem>
          </Form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">系统配置</h1>
        <p className="text-sm text-gray-500 mt-1">
          配置写入 PostgreSQL system_config；密钥不回显明文，留空或填 ******** 表示不变。测试短信将调用阿里云并产生费用。
        </p>
        {raw ? (
          <p className="text-xs text-gray-400 mt-2">已加载 {Object.keys(raw).length} 项配置键</p>
        ) : null}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="px-6 py-3 text-sm text-gray-500 border-b border-gray-100">加载中…</div>
        ) : null}
        <Tabs
          value={activeTab}
          onChange={(v) => setActiveTab(v as TabValue)}
          theme="card"
          size="medium"
          placement="top"
        >
          <Tabs.TabPanel value="site" label="站点与品牌" destroyOnHide={false}>
            <div className="p-6 max-w-3xl">
              <Divider align="left" className="mb-4">
                站点与品牌
              </Divider>
              <Form layout="vertical" colon>
                <Form.FormItem label="站点标题" {...formItemProps}>
                  <Input value={site.siteTitle} onChange={(v) => setSite((s) => ({ ...s, siteTitle: String(v) }))} />
                </Form.FormItem>
                <Form.FormItem
                  label="站点 Logo"
                  {...formItemProps}
                  help="上传图片将自动居中裁剪为 1:1，并缩放为 128×128 像素（PNG）；用于各端导航与浏览器标签图标"
                >
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
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        id="site-logo-upload"
                        className="hidden"
                        onChange={handleLogoFile}
                        disabled={logoUploading || loading}
                      />
                      <label htmlFor="site-logo-upload">
                        <span
                          className={`inline-flex items-center justify-center px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer ${logoUploading || loading ? 'opacity-50 pointer-events-none' : ''}`}
                        >
                          {logoUploading ? '处理中…' : '选择图片上传'}
                        </span>
                      </label>
                      <button
                        type="button"
                        className={secondaryBtnClass}
                        disabled={loading || !site.logoUrl}
                        onClick={() => setSite((s) => ({ ...s, logoUrl: '' }))}
                      >
                        清除 Logo
                      </button>
                    </div>
                  </div>
                </Form.FormItem>
                <Form.FormItem>
                  <button type="button" className={primaryBtnClass} onClick={() => void saveSite()} disabled={loading}>
                    保存站点配置
                  </button>
                </Form.FormItem>
              </Form>
            </div>
          </Tabs.TabPanel>

          <Tabs.TabPanel value="smtp" label="SMTP 邮件" destroyOnHide={false}>
            <div className="p-6 max-w-3xl">
              <Divider align="left" className="mb-4">
                SMTP 邮件配置
              </Divider>
              <Form layout="vertical" colon>
                <Form.FormItem label="SMTP Host" {...formItemProps}>
                  <Input
                    value={smtp.host}
                    onChange={(v) => setSmtp((s) => ({ ...s, host: String(v) }))}
                    placeholder="例如 smtp.qq.com"
                  />
                </Form.FormItem>
                <Form.FormItem label="SMTP Port" {...formItemProps}>
                  <InputNumber
                    style={{ width: '100%' }}
                    min={1}
                    max={65535}
                    value={smtp.port}
                    onChange={(v) => setSmtp((s) => ({ ...s, port: Number(v) || 587 }))}
                  />
                </Form.FormItem>
                <Form.FormItem label="TLS/SSL" {...formItemProps} help="465 端口多为 SSL 开启；587 多为 STARTTLS，可按邮箱服务商说明调整">
                  <Switch value={smtp.secure} onChange={(v) => setSmtp((s) => ({ ...s, secure: Boolean(v) }))} />
                </Form.FormItem>
                <Form.FormItem label="SMTP 用户名" {...formItemProps}>
                  <Input
                    value={smtp.user}
                    onChange={(v) => setSmtp((s) => ({ ...s, user: String(v) }))}
                    placeholder="通常为邮箱账号"
                  />
                </Form.FormItem>
                <Form.FormItem label="SMTP 密码" {...formItemProps}>
                  <Input
                    type="password"
                    value={smtp.pass}
                    onChange={(v) => setSmtp((s) => ({ ...s, pass: String(v) }))}
                    placeholder="邮箱 SMTP 授权码/密码"
                  />
                </Form.FormItem>
                <Form.FormItem label="发件人 From" {...formItemProps}>
                  <Input
                    value={smtp.from}
                    onChange={(v) => setSmtp((s) => ({ ...s, from: String(v) }))}
                    placeholder="例如：大学生创业实训平台 <notice@example.com>"
                  />
                </Form.FormItem>
                <Form.FormItem>
                  <Space>
                    <button type="button" className={primaryBtnClass} onClick={saveSmtpAllowMaskedPass} disabled={loading}>
                      保存 SMTP
                    </button>
                  </Space>
                </Form.FormItem>
              </Form>

              <Divider align="left" className="my-6">
                连通性测试
              </Divider>
              <Form layout="vertical" colon>
                <Form.FormItem label="测试收件人" {...formItemProps}>
                  <Input value={testSmtpTo} onChange={(v) => setTestSmtpTo(String(v))} placeholder="your@email.com" />
                </Form.FormItem>
                <Form.FormItem>
                  <button type="button" className={secondaryBtnClass} onClick={sendTestSmtp} disabled={loading}>
                    发送测试邮件
                  </button>
                </Form.FormItem>
              </Form>
            </div>
          </Tabs.TabPanel>

          <Tabs.TabPanel value="sms" label="短信配置" destroyOnHide={false}>
            <div className="p-6 max-w-3xl space-y-8">
              <section>
                <h3 className="text-sm font-semibold text-gray-900 mb-4">短信业务配置</h3>
                <p className="text-xs text-gray-500 mb-4">以下开关与频控在「发送验证码」类接口接入后生效；保存后写入 sms_biz_config。</p>
                <div className="space-y-4">
                  {(
                    [
                      ['enabled', '短信总开关'],
                      ['allowLogin', '短信登录'],
                      ['allowRegister', '短信注册'],
                      ['allowReset', '短信找回密码'],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between py-2 border-b border-gray-100">
                      <span className="text-sm text-gray-700">{label}</span>
                      <Switch
                        value={smsBiz[key]}
                        onChange={(v) => setSmsBiz((b) => ({ ...b, [key]: Boolean(v) }))}
                      />
                    </div>
                  ))}
                  <Form layout="vertical" colon className="mt-4">
                    <Form.FormItem label="验证码有效期（秒）" {...formItemProps} help="60～1800">
                      <InputNumber
                        style={{ width: '100%' }}
                        min={60}
                        max={1800}
                        value={smsBiz.expireSeconds}
                        onChange={(v) => setSmsBiz((b) => ({ ...b, expireSeconds: Number(v) || 300 }))}
                      />
                    </Form.FormItem>
                    <Form.FormItem label="发送冷却（秒）" {...formItemProps} help="10～300">
                      <InputNumber
                        style={{ width: '100%' }}
                        min={10}
                        max={300}
                        value={smsBiz.cooldownSeconds}
                        onChange={(v) => setSmsBiz((b) => ({ ...b, cooldownSeconds: Number(v) || 60 }))}
                      />
                    </Form.FormItem>
                    <Form.FormItem label="每日每号上限" {...formItemProps} help="1～100">
                      <InputNumber
                        style={{ width: '100%' }}
                        min={1}
                        max={100}
                        value={smsBiz.dailyLimit}
                        onChange={(v) => setSmsBiz((b) => ({ ...b, dailyLimit: Number(v) || 20 }))}
                      />
                    </Form.FormItem>
                  </Form>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-gray-900 mb-4">阿里云短信通道</h3>
                <Form layout="vertical" colon>
                  <Form.FormItem label="AccessKeyId" {...formItemProps}>
                    <Input
                      value={aliyunSms.accessKeyId}
                      onChange={(v) => setAliyunSms((a) => ({ ...a, accessKeyId: String(v) }))}
                    />
                  </Form.FormItem>
                  <Form.FormItem label="AccessKeySecret" {...formItemProps}>
                    <Input
                      type="password"
                      value={aliyunSms.accessKeySecret}
                      onChange={(v) => setAliyunSms((a) => ({ ...a, accessKeySecret: String(v) }))}
                    />
                  </Form.FormItem>
                  <Form.FormItem label="短信签名" {...formItemProps}>
                    <Input
                      value={aliyunSms.signName}
                      onChange={(v) => setAliyunSms((a) => ({ ...a, signName: String(v) }))}
                      placeholder="与阿里云审核通过的签名一致"
                    />
                  </Form.FormItem>
                  <Form.FormItem label="地域与 Endpoint 预设" {...formItemProps}>
                    <Select
                      clearable
                      placeholder="选择常用地域（可再手动改下方两项）"
                      options={regionSelectOptions}
                      value={aliyunSmsRegionPreset}
                      onChange={(v) => {
                        const key = String(v || '');
                        setAliyunSmsRegionPreset(key);
                        const hit = ALIYUN_SMS_REGION_OPTIONS.find((o) => o.key === key);
                        if (hit) {
                          setAliyunSms((a) => ({ ...a, regionId: hit.regionId, endpoint: hit.endpoint }));
                        }
                      }}
                    />
                  </Form.FormItem>
                  <Form.FormItem label="regionId" {...formItemProps}>
                    <Input
                      value={aliyunSms.regionId}
                      onChange={(v) => setAliyunSms((a) => ({ ...a, regionId: String(v) }))}
                      placeholder="如 cn-hangzhou"
                    />
                  </Form.FormItem>
                  <Form.FormItem label="Endpoint" {...formItemProps}>
                    <Input
                      value={aliyunSms.endpoint}
                      onChange={(v) => setAliyunSms((a) => ({ ...a, endpoint: String(v) }))}
                      placeholder="dysmsapi.aliyuncs.com"
                    />
                  </Form.FormItem>
                  <Form.FormItem label="登录模板 CODE" {...formItemProps}>
                    <Input
                      value={aliyunSms.templateLogin}
                      onChange={(v) => setAliyunSms((a) => ({ ...a, templateLogin: String(v) }))}
                    />
                  </Form.FormItem>
                  <Form.FormItem label="注册模板 CODE" {...formItemProps}>
                    <Input
                      value={aliyunSms.templateRegister}
                      onChange={(v) => setAliyunSms((a) => ({ ...a, templateRegister: String(v) }))}
                    />
                  </Form.FormItem>
                  <Form.FormItem label="找回密码模板 CODE" {...formItemProps} help="未填时发送场景 reset 会回退使用登录模板">
                    <Input
                      value={aliyunSms.templateReset}
                      onChange={(v) => setAliyunSms((a) => ({ ...a, templateReset: String(v) }))}
                    />
                  </Form.FormItem>
                  <Form.FormItem label="旧版单模板 templateCode（可选）" {...formItemProps} help="兼容历史数据；三模板都空时发送会回退到此字段">
                    <Input
                      value={aliyunSms.templateCode}
                      onChange={(v) => setAliyunSms((a) => ({ ...a, templateCode: String(v) }))}
                    />
                  </Form.FormItem>
                </Form>
              </section>

              <div className="flex flex-wrap gap-3">
                <button type="button" className={primaryBtnClass} onClick={saveSms} disabled={loading}>
                  保存短信配置
                </button>
              </div>

              <Divider align="left" className="!my-6">
                连通性测试（将计费）
              </Divider>
              <Form layout="vertical" colon>
                <Form.FormItem label="测试手机号" {...formItemProps}>
                  <Input value={testSmsPhone} onChange={(v) => setTestSmsPhone(String(v))} placeholder="11 位手机号" />
                </Form.FormItem>
                <Form.FormItem label="测试场景" {...formItemProps}>
                  <Select
                    options={[
                      { label: '登录模板', value: 'login' },
                      { label: '注册模板', value: 'register' },
                      { label: '找回模板', value: 'reset' },
                    ]}
                    value={testSmsScene}
                    onChange={(v) => setTestSmsScene((v as 'login' | 'register' | 'reset') || 'login')}
                  />
                </Form.FormItem>
                <Form.FormItem>
                  <button type="button" className={secondaryBtnClass} onClick={sendTestSms} disabled={loading}>
                    发送测试短信
                  </button>
                </Form.FormItem>
              </Form>
            </div>
          </Tabs.TabPanel>

          {SHOW_RTC_TAB ? (
            <Tabs.TabPanel value="rtc" label="RTC 扩展" destroyOnHide={false}>
              <div className="p-6 max-w-3xl">
                <Divider align="left" className="mb-4">
                  RTC 扩展
                </Divider>
                <p className="text-sm text-gray-500 mb-3">JSON 配置，预留给实时音视频等扩展能力。</p>
                <Textarea
                  value={rtc}
                  onChange={(v) => setRtc(String(v))}
                  autosize={{ minRows: 10, maxRows: 22 }}
                  className="font-mono text-sm"
                />
                <div className="mt-4">
                  <button type="button" className={primaryBtnClass} onClick={saveRtc} disabled={loading}>
                    保存 RTC 配置
                  </button>
                </div>
              </div>
            </Tabs.TabPanel>
          ) : null}
        </Tabs>
      </div>
    </div>
  );
}
