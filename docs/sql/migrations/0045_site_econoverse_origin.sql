-- 站点配置增加创世纪 EconoVerse 外链（管理端「系统配置 → 站点」可改）
-- 可重复执行

UPDATE system_config
SET
  config_value = COALESCE(config_value, '{}'::jsonb)
    || jsonb_build_object(
      'econoverseOrigin',
      COALESCE(NULLIF(config_value->>'econoverseOrigin', ''), 'http://localhost:5173')
    ),
  description = CASE
    WHEN description IS NULL OR description = '' THEN '站点与品牌；含创世纪游戏外链 econoverseOrigin'
    WHEN description LIKE '%econoverseOrigin%' THEN description
    ELSE description || '；含创世纪游戏外链 econoverseOrigin'
  END,
  updated_at = now()
WHERE config_key = 'site';
