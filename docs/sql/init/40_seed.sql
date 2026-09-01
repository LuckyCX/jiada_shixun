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
  ('site', '{"siteTitle":"大学生创业实训平台","logoUrl":"","econoverseOrigin":"http://localhost:5173"}'::jsonb, '站点与品牌（Logo 建议 128×128，由管理端上传；econoverseOrigin 为创世纪游戏外链）', 1),
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

-- 学院与专业：由同目录 37_colleges_majors_seed.sql 在 40 之前按文件名自动执行（勿在此 \ir，避免 initdb 工作目录导致失败）

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

INSERT INTO system_config (config_key, config_value, description, updated_by)
VALUES (
  'prompt_modules',
  '{
    "team_formation": {
      "match_system": "你是创业实训平台的组队顾问。根据学生的测评作答与自我介绍视频转写文本，从给定的角色定义中选择最匹配的一个角色。仅输出 JSON，格式：{\"matchedRole\":\"ceo|product_rd|market_director|marketing_ops|sales|finance\",\"confidence\":0-1,\"summary\":\"简短理由\"}。不要输出其它内容。",
      "video_transcribe": "请将用户提供的自我介绍视频转写为中文口语书面稿，保留关键能力与兴趣表述，不要编造未出现的信息。",
      "role_definitions": [
        {"key":"ceo","title":"项目 CEO / 创始人","description":"总负责人，统筹全局、制定创业方向、拍板重大决策、对外对接、团队管理，把控整体进度。"},
        {"key":"product_rd","title":"产品 / 研发负责人","description":"负责产品设计、功能规划、商业模式梳理、落地可行性、竞品分析，打磨创业项目核心产品。"},
        {"key":"market_director","title":"市场总监","description":"核心市场角色，做市场调研、用户画像、竞品分析、定价策略、市场定位，制定整体市场推广方向。"},
        {"key":"marketing_ops","title":"营销运营官","description":"落地推广：线上线下宣传、活动策划、私域运营、内容推广、获客引流，执行市场方案。"},
        {"key":"sales","title":"销售负责人","description":"负责客户对接、商务洽谈、渠道拓展、订单转化、客户维护，直接实现营收。"},
        {"key":"finance","title":"财务负责人","description":"成本核算、资金规划、预算管控、盈利测算、账务记录、投融资规划，把控资金风险。"}
      ]
    }
  }'::jsonb,
  '按业务模块维护的 AI 提示词（team_formation 等）',
  1
)
ON CONFLICT (config_key) DO NOTHING;
