-- 会话默认 1 天；补充滑动续期间隔；口令策略说明
UPDATE system_config
SET
  config_value = jsonb_set(
    jsonb_set(
      jsonb_set(
        COALESCE(config_value, '{}'::jsonb),
        '{jwt,accessTtlSec}',
        '86400'::jsonb,
        true
      ),
      '{jwt,renewalMinIntervalSec}',
      '60'::jsonb,
      true
    ),
    '{passwordMinLength}',
    '8'::jsonb,
    true
  ),
  description = 'JWT 与会话策略；accessTtlSec 默认 86400（1 天），仅以本配置为准；renewalMinIntervalSec 为活跃续期最短间隔（秒）；口令须≥8且含大小写与数字',
  updated_at = now()
WHERE config_key = 'security';
