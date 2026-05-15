-- 已有数据库若仍为默认 15 分钟 access 令牌，执行本脚本可改为 12 小时（与 003_seed 默认一致）。
-- 仅当 security.jwt.accessTtlSec 为 900 时更新，避免覆盖你在管理端自定义的时长。
UPDATE system_config
SET
  config_value = jsonb_set(config_value, '{jwt,accessTtlSec}', '43200'::jsonb, true),
  updated_at = now()
WHERE config_key = 'security'
  AND COALESCE((config_value->'jwt'->>'accessTtlSec')::int, 0) = 900;
