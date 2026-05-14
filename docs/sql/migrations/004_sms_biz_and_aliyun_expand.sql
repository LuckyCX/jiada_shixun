-- 已有库演进：短信业务配置 + 阿里云短信 JSON 扩展字段
-- 在 000～003 全量初始化之后执行；新空库请直接跑已更新的 003_seed.sql，可跳过本脚本。
SET client_encoding = 'UTF8';

INSERT INTO system_config (config_key, config_value, description, updated_by)
VALUES (
  'sms_biz_config',
  '{"enabled":true,"allowLogin":true,"allowRegister":true,"allowReset":true,"expireSeconds":300,"cooldownSeconds":60,"dailyLimit":20}'::jsonb,
  '短信业务：开关、场景、有效期与频控（发码路由接入后生效）',
  1
)
ON CONFLICT (config_key) DO NOTHING;

UPDATE system_config
SET config_value =
  config_value
  || '{"templateLogin":"","templateRegister":"","templateReset":"","regionId":"cn-hangzhou","endpoint":"dysmsapi.aliyuncs.com"}'::jsonb
WHERE config_key = 'aliyun_sms_config';
