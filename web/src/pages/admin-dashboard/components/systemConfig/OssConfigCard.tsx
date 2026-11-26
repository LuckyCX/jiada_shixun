/**
 * 阿里云 OSS 配置卡片（系统设置 → 资源维护，位于文件管理器下方）
 * 配置存 system_config 表 key=oss_config；SK 在接口返回中已掩码为 ********。
 */
import { useCallback, useEffect, useState } from 'react';
import { Button, Form, Input, InputNumber, Select, Space, Switch, Tag, message } from 'antd';
import { portalAuthenticatedFetch } from '../../../../lib/authApi';

type OssConfigValue = {
  enabled: boolean;
  region: string;
  endpoint: string;
  internalEndpoint: string;
  bucket: string;
  accessKeyId: string;
  accessKeySecret: string;
  prefix: string;
  urlExpireSeconds: number;
};

const DEFAULTS: OssConfigValue = {
  enabled: false,
  region: '',
  endpoint: '',
  internalEndpoint: '',
  bucket: '',
  accessKeyId: '',
  accessKeySecret: '',
  prefix: 'pitch-templates/',
  urlExpireSeconds: 3600,
};

const REGION_OPTIONS = [
  'oss-cn-hangzhou',
  'oss-cn-shanghai',
  'oss-cn-qingdao',
  'oss-cn-beijing',
  'oss-cn-zhangjiakou',
  'oss-cn-shenzhen',
  'oss-cn-guangzhou',
  'oss-cn-chengdu',
  'oss-cn-hongkong',
].map((r) => ({ value: r, label: r }));

async function adminJson<T>(path: string, init?: RequestInit): Promise<T> {
  const data = await portalAuthenticatedFetch('admin', path, init);
  return data as T;
}

type Props = {
  /** 保存/测试后通知父级刷新状态条 */
  onChanged?: () => void;
};

export default function OssConfigCard({ onChanged }: Props) {
  const [form] = Form.useForm<OssConfigValue>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [enabledFlag, setEnabledFlag] = useState(false);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const all = await adminJson<Record<string, { value: OssConfigValue }>>('/api/admin/system-config');
      const cfg = { ...DEFAULTS, ...(all?.oss_config?.value || {}) };
      form.setFieldsValue(cfg);
      setEnabledFlag(!!cfg.enabled);
      setLoaded(true);
    } catch (e) {
      message.error((e as Error).message || '读取 OSS 配置失败');
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const collectValues = async (): Promise<OssConfigValue> => {
    const v = await form.validateFields();
    return {
      ...v,
      // SK 掩码：未修改则保持原值（后端 mergeSkipMasked 跳过 ********）
      accessKeySecret: v.accessKeySecret && v.accessKeySecret !== '********' ? v.accessKeySecret : '********',
    };
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const v = await collectValues();
      await adminJson('/api/admin/system-config', {
        method: 'PATCH',
        body: JSON.stringify({ patches: { oss_config: v } }),
      });
      message.success('OSS 配置已保存');
      setEnabledFlag(!!v.enabled);
      onChanged?.();
      void loadConfig();
    } catch (e) {
      message.error((e as Error).message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      const v = await collectValues();
      const res = await adminJson<{ steps: { step: string; ok: boolean }[] }>(
        '/api/admin/pitch-templates/oss-test',
        { method: 'POST', body: JSON.stringify(v) }
      );
      message.success(`连接测试通过（${res.steps.map((s) => s.step).join(' / ')}）`);
    } catch (e) {
      message.error((e as Error).message || '连接测试失败');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="mt-5 rounded-lg border border-gray-100 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-sm font-medium text-gray-800 flex items-center gap-2">
          阿里云 OSS 存储
          {loaded ? (
            enabledFlag ? (
              <Tag color="teal">已启用</Tag>
            ) : (
              <Tag>未启用</Tag>
            )
          ) : null}
        </div>
        <Space size="small">
          <Button size="small" loading={testing} onClick={() => void testConnection()}>
            测试连接
          </Button>
          <Button size="small" type="primary" loading={saving} onClick={() => void saveConfig()}>
            保存配置
          </Button>
        </Space>
      </div>

      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={DEFAULTS}
        className="!max-w-[760px]"
        disabled={loading}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4">
          <Form.Item label="启用 OSS 数据源" name="enabled" valuePropName="checked" className="!mb-3">
            <Switch checkedChildren="开" unCheckedChildren="关" onChange={(v) => setEnabledFlag(!!v)} />
          </Form.Item>
          <Form.Item
            label="Region"
            name="region"
            rules={enabledFlag ? [{ required: true, message: '请选择或输入 Region' }] : []}
            className="!mb-3"
          >
            <Select
              showSearch
              allowClear
              options={REGION_OPTIONS}
              placeholder="如 oss-cn-hangzhou"
              onChange={() => undefined}
              dropdownRender={(menu) => (
                <>
                  {menu}
                  <div className="p-1">
                    <Input
                      placeholder="自定义 Region，回车填入"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = (e.target as HTMLInputElement).value.trim();
                          if (val) form.setFieldValue('region', val);
                        }
                      }}
                    />
                  </div>
                </>
              )}
            />
          </Form.Item>
          <Form.Item
            label="Bucket"
            name="bucket"
            rules={enabledFlag ? [{ required: true, message: '请输入 Bucket 名称' }] : []}
            className="!mb-3"
          >
            <Input placeholder="如 jiada-shixun-resource" />
          </Form.Item>
          <Form.Item
            label="AccessKeyId"
            name="accessKeyId"
            rules={enabledFlag ? [{ required: true, message: '请输入 AccessKeyId' }] : []}
            className="!mb-3"
          >
            <Input placeholder="专用 RAM 用户的 AccessKeyId" autoComplete="off" />
          </Form.Item>
          <Form.Item
            label="AccessKeySecret"
            name="accessKeySecret"
            rules={enabledFlag ? [{ required: true, message: '请输入 AccessKeySecret' }] : []}
            className="!mb-3"
          >
            <Input.Password placeholder="已保存时显示为掩码" autoComplete="new-password" />
          </Form.Item>
          <Form.Item label="路径前缀" name="prefix" className="!mb-3" extra="文件在桶内的根目录，如 pitch-templates/；根目录留空">
            <Input placeholder="pitch-templates/" />
          </Form.Item>
          <Form.Item label="外网 Endpoint（可选）" name="endpoint" className="!mb-3" extra="留空则用 Region 默认域名">
            <Input placeholder="oss-cn-hangzhou.aliyuncs.com" />
          </Form.Item>
          <Form.Item
            label="内网 Endpoint（可选）"
            name="internalEndpoint"
            className="!mb-3"
            extra="服务器与桶同区域时填写，走内网流量免费"
          >
            <Input placeholder="oss-cn-hangzhou-internal.aliyuncs.com" />
          </Form.Item>
          <Form.Item label="签名 URL 有效期（秒）" name="urlExpireSeconds" className="!mb-3">
            <InputNumber min={300} max={64800} step={300} className="!w-full" />
          </Form.Item>
        </div>
        <div className="text-xs text-gray-400 leading-relaxed">
          桶需保持私有读，并在 OSS 控制台为该桶配置跨域规则（CORS）：来源 <code>*</code>，允许方法
          GET / PUT / HEAD，允许 Headers <code>*</code>，否则浏览器直传/直连会被拦截。
        </div>
      </Form>
    </div>
  );
}
