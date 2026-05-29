-- 组队测评：教师预设题、学生提交与 AI 匹配
-- 执行：psql -v ON_ERROR_STOP=1 -f 006_team_formation.sql

CREATE TABLE teacher_personal_class_team_questions (
  id bigserial PRIMARY KEY,
  teacher_personal_class_id bigint NOT NULL REFERENCES teacher_personal_classes (id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  title text NOT NULL,
  question_type varchar(16) NOT NULL CHECK (question_type IN ('single', 'multi', 'short')),
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tpctq_class ON teacher_personal_class_team_questions (teacher_personal_class_id, sort_order);

CREATE TRIGGER trg_tpctq_updated_at BEFORE UPDATE ON teacher_personal_class_team_questions
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();

CREATE TABLE student_team_formation_submissions (
  id bigserial PRIMARY KEY,
  teacher_personal_class_id bigint NOT NULL REFERENCES teacher_personal_classes (id) ON DELETE CASCADE,
  student_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status varchar(24) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_teacher', 'grouped', 'confirmed')),
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  video_storage_key text,
  video_transcript text,
  ai_matched_role varchar(32),
  ai_analysis_raw jsonb,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_personal_class_id, student_id)
);

CREATE INDEX idx_stfs_class_status ON student_team_formation_submissions (teacher_personal_class_id, status);

CREATE TRIGGER trg_stfs_updated_at BEFORE UPDATE ON student_team_formation_submissions
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();

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
