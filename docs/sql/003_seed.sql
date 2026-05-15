-- 实训平台 · 初始化数据（管理员、RBAC、系统配置键、AI 壳数据）
-- 依赖：000_extensions.sql（pgcrypto）、001_schema.sql

SET client_encoding = 'UTF8';

-- 管理员默认密码：jiuan@123（生产环境登录后立即修改）
INSERT INTO users (username, password_hash, real_name, email, role, status)
VALUES (
  'admin',
  crypt('jiuan@123', gen_salt('bf')),
  '系统管理员',
  'admin@localhost',
  'admin',
  'active'
);

INSERT INTO roles (code, name) VALUES
  ('admin', '管理员'),
  ('teacher', '教师'),
  ('student', '学生');

INSERT INTO permissions (code, name) VALUES
  ('admin.system_config.read', '读取系统配置'),
  ('admin.system_config.write', '修改系统配置'),
  ('admin.users.read', '读取用户'),
  ('admin.users.write', '管理用户'),
  ('ai.call', '调用 AI 接口');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.code = 'admin';

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u CROSS JOIN roles r
WHERE u.username = 'admin' AND r.code = 'admin';

INSERT INTO system_config (config_key, config_value, description, updated_by) VALUES
  ('site', '{"siteTitle":"大学生创业实训平台","logoUrl":""}'::jsonb, '站点与品牌（Logo 建议 128×128，由管理端上传）', 1),
  ('security', '{"jwt":{"accessTtlSec":43200,"refreshTtlSec":604800,"issuer":"jiada-shixun","secret":"CHANGE_ME_IN_ADMIN_UI_USE_LONG_RANDOM_SECRET_DEV_ONLY"},"passwordMinLength":8}'::jsonb, 'JWT 与会话策略；accessTtlSec 为访问令牌秒数（默认 12h）；secret 请在管理端修改后保存', 1),
  ('upload', '{"maxSizeMb":50,"allowedExtensions":["pdf","doc","docx","ppt","pptx","png","jpg","zip"]}'::jsonb, '上传策略', 1),
  ('smtp_config', '{"host":"","port":465,"secure":true,"user":"","pass":"","from":""}'::jsonb, 'SMTP 邮件（在后台填写后保存；与常见 QQ 配置一致默认 465+SSL）', 1),
  (
    'sms_biz_config',
    '{"enabled":true,"allowLogin":true,"allowRegister":true,"allowReset":true,"expireSeconds":300,"cooldownSeconds":60,"dailyLimit":20}'::jsonb,
    '短信业务：开关、场景、有效期与频控（发码路由接入后生效）',
    1
  ),
  (
    'aliyun_sms_config',
    '{"accessKeyId":"","accessKeySecret":"","signName":"","templateCode":"","templateLogin":"","templateRegister":"","templateReset":"","regionId":"cn-hangzhou","endpoint":"dysmsapi.aliyuncs.com"}'::jsonb,
    '阿里云短信通道；密钥敏感；templateCode 为旧版单模板字段，可与三模板并存',
    1
  ),
  ('ai_global', '{"defaultTimeoutMs":60000,"maxRetries":2,"logSampleRate":1.0,"rateLimitPerUserPerMinute":60}'::jsonb, 'AI 全局：超时、重试、采样、限流', 1),
  ('rtc_config', '{}'::jsonb, '实时音视频/RTC 扩展占位（本期可不启用）', 1),
  (
    'llm_gateway_config',
    '{"providers":[]}'::jsonb,
    '管理端：多厂商 OpenAI 兼容大模型（多模态 / 文件处理）；同类型仅允许一条启用',
    1
  );

INSERT INTO ai_providers (provider_code, provider_name, base_url, auth_type, status) VALUES
  ('volcengine', '火山引擎', 'https://ark.cn-beijing.volces.com', 'bearer', 'disabled');

INSERT INTO ai_scene_bindings (scene_code, model_id, is_enabled) VALUES
  ('ideation', NULL, false),
  ('market_research', NULL, false),
  ('product_design', NULL, false),
  ('business_model', NULL, false),
  ('role_simulation', NULL, false),
  ('business_plan', NULL, false),
  ('ai_validation', NULL, false),
  ('evaluation_assist', NULL, false),
  ('default', NULL, false);

INSERT INTO ai_prompt_templates (scene_code, template_name, template_content, version_no, is_enabled, created_by) VALUES
  ('default', 'system', '你是面向高校创新创业实训的助手，回答简洁、可执行。', '1.0', true, 1);

-- 学院（独立表；管理端「学院管理」维护，不再使用字典 college）
INSERT INTO colleges (name, status) VALUES
  ('计算机科学与技术学院', 'active'),
  ('经济管理学院', 'active'),
  ('外国语学院', 'active'),
  ('数学与统计学院', 'active'),
  ('教务处', 'active'),
  ('学生处', 'active');

-- 班级状态（管理端筛选、列表展示；公开接口 typeCode=class_status）
INSERT INTO dict_type (name, code, status, remark) VALUES
  ('班级状态', 'class_status', 1, '班级业务状态：待开班/进行中/已结束');

INSERT INTO dict_item (dict_type_id, name, data_key, sort_order, status, remark)
SELECT t.id, v.name, v.data_key, v.sort_order, 1, NULL
FROM dict_type t
CROSS JOIN (
  VALUES
    ('待开班', 0, 1),
    ('进行中', 1, 2),
    ('已结束', 2, 3)
) AS v(name, data_key, sort_order)
WHERE t.code = 'class_status';

-- 学期（公开接口 typeCode=semester；data_key 与业务约定：0 春季、9 秋季）
INSERT INTO dict_type (name, code, status, remark) VALUES
  ('学期', 'semester', 1, '春季/秋季学期枚举');

INSERT INTO dict_item (dict_type_id, name, data_key, sort_order, status, remark)
SELECT t.id, v.name, v.data_key, v.sort_order, 1, NULL
FROM dict_type t
CROSS JOIN (
  VALUES
    ('春季学期', 0, 1),
    ('秋季学期', 9, 2)
) AS v(name, data_key, sort_order)
WHERE t.code = 'semester';
