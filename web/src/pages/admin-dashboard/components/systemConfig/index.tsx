import { useCallback, useEffect, useState } from 'react';
import { Button, Form, Input, InputNumber, MessagePlugin, Tabs, Textarea } from 'tdesign-react';
import { ADMIN_TOKEN_KEY } from '../../../../lib/authApi';

type ConfigEntry = {
  value: Record<string, unknown>;
  description?: string;
  updated_at?: string;
};

type AdminConfigResponse = Record<string, ConfigEntry>;

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

  const [site, setSite] = useState({ siteTitle: '', logoUrl: '', publicBaseUrl: '' });
  const [security, setSecurity] = useState({
    accessTtlSec: 900,
    refreshTtlSec: 604800,
    issuer: 'jiada-shixun',
    secret: '',
    passwordMinLength: 8,
  });
  const [upload, setUpload] = useState({ maxSizeMb: 50, allowedExtensions: 'pdf,doc,docx,png,jpg' });
  const [smtp, setSmtp] = useState({ host: '', port: 587, secure: false, user: '', pass: '', from: '' });
  const [sms, setSms] = useState({
    accessKeyId: '',
    accessKeySecret: '',
    signName: '',
    templateCode: '',
  });
  const [aiGlobal, setAiGlobal] = useState({
    defaultTimeoutMs: 60000,
    maxRetries: 2,
    logSampleRate: 1,
    rateLimitPerUserPerMinute: 60,
  });
  const [rtc, setRtc] = useState('{}');

  const fillFromApi = useCallback((data: AdminConfigResponse) => {
    const s = (data.site?.value || {}) as Record<string, string>;
    setSite({
      siteTitle: String(s.siteTitle || ''),
      logoUrl: String(s.logoUrl || ''),
      publicBaseUrl: String(s.publicBaseUrl || ''),
    });
    const sec = (data.security?.value || {}) as { jwt?: Record<string, unknown>; passwordMinLength?: number };
    const j = sec.jwt || {};
    setSecurity({
      accessTtlSec: Number(j.accessTtlSec ?? 900),
      refreshTtlSec: Number(j.refreshTtlSec ?? 604800),
      issuer: String(j.issuer ?? 'jiada-shixun'),
      secret: String(j.secret ?? ''),
      passwordMinLength: Number(sec.passwordMinLength ?? 8),
    });
    const u = (data.upload?.value || {}) as { maxSizeMb?: number; allowedExtensions?: string[] };
    setUpload({
      maxSizeMb: Number(u.maxSizeMb ?? 50),
      allowedExtensions: Array.isArray(u.allowedExtensions) ? u.allowedExtensions.join(',') : '',
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
    const al = (data.aliyun_sms_config?.value || {}) as Record<string, string>;
    setSms({
      accessKeyId: String(al.accessKeyId ?? ''),
      accessKeySecret: String(al.accessKeySecret ?? ''),
      signName: String(al.signName ?? ''),
      templateCode: String(al.templateCode ?? ''),
    });
    const ag = (data.ai_global?.value || {}) as Record<string, number>;
    setAiGlobal({
      defaultTimeoutMs: Number(ag.defaultTimeoutMs ?? 60000),
      maxRetries: Number(ag.maxRetries ?? 2),
      logSampleRate: Number(ag.logSampleRate ?? 1),
      rateLimitPerUserPerMinute: Number(ag.rateLimitPerUserPerMinute ?? 60),
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
      MessagePlugin.success('已加载配置');
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
      const j = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: loginUser, password: loginPass }),
      });
      const t = j.data?.token as string;
      if (!t) throw new Error('无 token');
      localStorage.setItem(ADMIN_TOKEN_KEY, t);
      setToken(t);
      setLoginPass('');
      MessagePlugin.success('登录成功');
    } catch (e) {
      MessagePlugin.error((e as Error).message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    setToken('');
    setRaw(null);
  };

  const savePatch = async (patches: Record<string, Record<string, unknown>>) => {
    if (!token) return;
    setLoading(true);
    try {
      await apiFetch('/api/admin/system-config', {
        method: 'PATCH',
        token,
        body: JSON.stringify({ patches }),
      });
      await loadConfig();
      MessagePlugin.success('保存成功');
    } catch (e) {
      MessagePlugin.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const saveSite = () =>
    savePatch({
      site: {
        siteTitle: site.siteTitle,
        logoUrl: site.logoUrl,
        publicBaseUrl: site.publicBaseUrl,
      },
    });

  const saveSecurity = () =>
    savePatch({
      security: {
        jwt: {
          accessTtlSec: security.accessTtlSec,
          refreshTtlSec: security.refreshTtlSec,
          issuer: security.issuer,
          ...(security.secret && security.secret !== '********' ? { secret: security.secret } : {}),
        },
        passwordMinLength: security.passwordMinLength,
      },
    });

  const saveUpload = () =>
    savePatch({
      upload: {
        maxSizeMb: upload.maxSizeMb,
        allowedExtensions: upload.allowedExtensions.split(',').map((s) => s.trim()).filter(Boolean),
      },
    });

  const saveSmtp = () => savePatch({ smtp_config: { ...smtp } });
  const saveSms = () => savePatch({ aliyun_sms_config: { ...sms } });

  const saveAi = () =>
    savePatch({
      ai_global: {
        defaultTimeoutMs: aiGlobal.defaultTimeoutMs,
        maxRetries: aiGlobal.maxRetries,
        logSampleRate: aiGlobal.logSampleRate,
        rateLimitPerUserPerMinute: aiGlobal.rateLimitPerUserPerMinute,
      },
    });

  const saveRtc = () => {
    try {
      const parsed = JSON.parse(rtc);
      savePatch({ rtc_config: parsed as Record<string, unknown> });
    } catch {
      MessagePlugin.error('RTC 配置需为合法 JSON');
    }
  };

  if (!token) {
    return (
      <div className="max-w-md bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">管理员登录</h2>
        <p className="text-sm text-gray-500 mb-4">登录后可编辑库内系统配置（默认账号见 docs/sql/README.md）</p>
        <Form labelAlign="top" colon>
          <Form.Item label="用户名">
            <Input value={loginUser} onChange={(v) => setLoginUser(String(v))} placeholder="admin" />
          </Form.Item>
          <Form.Item label="密码">
            <Input type="password" value={loginPass} onChange={(v) => setLoginPass(String(v))} />
          </Form.Item>
          <Form.Item>
            <Button theme="primary" onClick={handleLogin}>
              登录
            </Button>
          </Form.Item>
        </Form>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">系统配置</h2>
          <p className="text-xs text-gray-500 mt-1">配置写入 PostgreSQL system_config；密钥字段不回显明文，留空或填 ******** 表示不变</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadConfig} loading={loading}>
            重新加载
          </Button>
          <Button variant="outline" onClick={handleLogout}>
            退出登录
          </Button>
        </div>
      </div>
      <div className="p-4">
        <Tabs defaultValue="site">
          <Tabs.TabPanel value="site" label="站点与品牌">
            <Form labelAlign="left" labelWidth={140} colon className="max-w-2xl mt-4">
              <Form.Item label="站点标题">
                <Input value={site.siteTitle} onChange={(v) => setSite((s) => ({ ...s, siteTitle: String(v) }))} />
              </Form.Item>
              <Form.Item label="Logo URL">
                <Input value={site.logoUrl} onChange={(v) => setSite((s) => ({ ...s, logoUrl: String(v) }))} />
              </Form.Item>
              <Form.Item label="对外基址">
                <Input
                  value={site.publicBaseUrl}
                  onChange={(v) => setSite((s) => ({ ...s, publicBaseUrl: String(v) }))}
                />
              </Form.Item>
              <Form.Item>
                <Button theme="primary" onClick={saveSite} loading={loading}>
                  保存站点配置
                </Button>
              </Form.Item>
            </Form>
          </Tabs.TabPanel>
          <Tabs.TabPanel value="security" label="安全与会话">
            <Form labelAlign="left" labelWidth={180} colon className="max-w-2xl mt-4">
              <Form.Item label="Access TTL(秒)">
                <InputNumber
                  value={security.accessTtlSec}
                  onChange={(v) => setSecurity((s) => ({ ...s, accessTtlSec: Number(v) || 0 }))}
                />
              </Form.Item>
              <Form.Item label="Refresh TTL(秒)">
                <InputNumber
                  value={security.refreshTtlSec}
                  onChange={(v) => setSecurity((s) => ({ ...s, refreshTtlSec: Number(v) || 0 }))}
                />
              </Form.Item>
              <Form.Item label="Issuer">
                <Input value={security.issuer} onChange={(v) => setSecurity((s) => ({ ...s, issuer: String(v) }))} />
              </Form.Item>
              <Form.Item label="JWT Secret">
                <Input
                  type="password"
                  value={security.secret}
                  onChange={(v) => setSecurity((s) => ({ ...s, secret: String(v) }))}
                  placeholder="修改时输入新密钥"
                />
              </Form.Item>
              <Form.Item label="密码最小长度">
                <InputNumber
                  value={security.passwordMinLength}
                  onChange={(v) => setSecurity((s) => ({ ...s, passwordMinLength: Number(v) || 8 }))}
                />
              </Form.Item>
              <Form.Item>
                <Button theme="primary" onClick={saveSecurity} loading={loading}>
                  保存安全配置
                </Button>
              </Form.Item>
            </Form>
          </Tabs.TabPanel>
          <Tabs.TabPanel value="upload" label="文件与上传">
            <Form labelAlign="left" labelWidth={140} colon className="max-w-2xl mt-4">
              <Form.Item label="最大(MB)">
                <InputNumber value={upload.maxSizeMb} onChange={(v) => setUpload((u) => ({ ...u, maxSizeMb: Number(v) || 0 }))} />
              </Form.Item>
              <Form.Item label="允许后缀">
                <Input
                  value={upload.allowedExtensions}
                  onChange={(v) => setUpload((u) => ({ ...u, allowedExtensions: String(v) }))}
                  placeholder="逗号分隔"
                />
              </Form.Item>
              <Form.Item>
                <Button theme="primary" onClick={saveUpload} loading={loading}>
                  保存上传策略
                </Button>
              </Form.Item>
            </Form>
          </Tabs.TabPanel>
          <Tabs.TabPanel value="smtp" label="SMTP 邮件">
            <Form labelAlign="left" labelWidth={120} colon className="max-w-2xl mt-4">
              <Form.Item label="Host">
                <Input value={smtp.host} onChange={(v) => setSmtp((s) => ({ ...s, host: String(v) }))} />
              </Form.Item>
              <Form.Item label="Port">
                <InputNumber value={smtp.port} onChange={(v) => setSmtp((s) => ({ ...s, port: Number(v) || 587 }))} />
              </Form.Item>
              <Form.Item label="User">
                <Input value={smtp.user} onChange={(v) => setSmtp((s) => ({ ...s, user: String(v) }))} />
              </Form.Item>
              <Form.Item label="Pass">
                <Input type="password" value={smtp.pass} onChange={(v) => setSmtp((s) => ({ ...s, pass: String(v) }))} />
              </Form.Item>
              <Form.Item label="From">
                <Input value={smtp.from} onChange={(v) => setSmtp((s) => ({ ...s, from: String(v) }))} />
              </Form.Item>
              <Form.Item>
                <Button theme="primary" onClick={saveSmtp} loading={loading}>
                  保存 SMTP
                </Button>
              </Form.Item>
            </Form>
          </Tabs.TabPanel>
          <Tabs.TabPanel value="sms" label="阿里云短信">
            <Form labelAlign="left" labelWidth={140} colon className="max-w-2xl mt-4">
              <Form.Item label="AccessKeyId">
                <Input value={sms.accessKeyId} onChange={(v) => setSms((s) => ({ ...s, accessKeyId: String(v) }))} />
              </Form.Item>
              <Form.Item label="AccessKeySecret">
                <Input
                  type="password"
                  value={sms.accessKeySecret}
                  onChange={(v) => setSms((s) => ({ ...s, accessKeySecret: String(v) }))}
                />
              </Form.Item>
              <Form.Item label="签名">
                <Input value={sms.signName} onChange={(v) => setSms((s) => ({ ...s, signName: String(v) }))} />
              </Form.Item>
              <Form.Item label="模板CODE">
                <Input value={sms.templateCode} onChange={(v) => setSms((s) => ({ ...s, templateCode: String(v) }))} />
              </Form.Item>
              <Form.Item>
                <Button theme="primary" onClick={saveSms} loading={loading}>
                  保存短信配置
                </Button>
              </Form.Item>
            </Form>
          </Tabs.TabPanel>
          <Tabs.TabPanel value="ai" label="AI 全局">
            <Form labelAlign="left" labelWidth={220} colon className="max-w-2xl mt-4">
              <Form.Item label="默认超时(ms)">
                <InputNumber
                  value={aiGlobal.defaultTimeoutMs}
                  onChange={(v) => setAiGlobal((s) => ({ ...s, defaultTimeoutMs: Number(v) || 0 }))}
                />
              </Form.Item>
              <Form.Item label="最大重试">
                <InputNumber value={aiGlobal.maxRetries} onChange={(v) => setAiGlobal((s) => ({ ...s, maxRetries: Number(v) || 0 }))} />
              </Form.Item>
              <Form.Item label="日志采样率 0~1">
                <InputNumber
                  value={aiGlobal.logSampleRate}
                  onChange={(v) => setAiGlobal((s) => ({ ...s, logSampleRate: Number(v) || 0 }))}
                  decimalPlaces={2}
                />
              </Form.Item>
              <Form.Item label="每用户每分钟限流">
                <InputNumber
                  value={aiGlobal.rateLimitPerUserPerMinute}
                  onChange={(v) =>
                    setAiGlobal((s) => ({ ...s, rateLimitPerUserPerMinute: Number(v) || 0 }))
                  }
                />
              </Form.Item>
              <Form.Item>
                <Button theme="primary" onClick={saveAi} loading={loading}>
                  保存 AI 全局
                </Button>
              </Form.Item>
            </Form>
          </Tabs.TabPanel>
          <Tabs.TabPanel value="rtc" label="RTC 扩展">
            <p className="text-sm text-gray-500 mb-2">JSON 配置，预留给实时音视频等扩展能力</p>
            <Textarea value={rtc} onChange={(v) => setRtc(String(v))} rows={12} className="font-mono text-sm" />
            <Button className="mt-4" theme="primary" onClick={saveRtc} loading={loading}>
              保存 RTC 配置
            </Button>
          </Tabs.TabPanel>
        </Tabs>
      </div>
      {raw && (
        <div className="px-6 py-3 bg-gray-50 text-xs text-gray-400 border-t border-gray-100">
          已加载 {Object.keys(raw).length} 项配置键（业务/模型密钥请在后续迭代通过「模型管理」维护）
        </div>
      )}
    </div>
  );
}
