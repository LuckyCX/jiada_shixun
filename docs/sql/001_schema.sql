-- 实训平台 · 全量表结构（对齐 docs/实训平台项目设计方案.md §7 + 计划补缺表）
-- 使用 UTF-8 编码导入：psql -v ON_ERROR_STOP=1 -f 001_schema.sql

SET client_encoding = 'UTF8';

CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- 系统配置（业务配置存库，不依赖 .env）
-- ---------------------------------------------------------------------------
CREATE TABLE system_config (
  config_key      varchar(128) PRIMARY KEY,
  config_value    jsonb NOT NULL DEFAULT '{}'::jsonb,
  description     text,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      bigint NULL
);

CREATE INDEX idx_system_config_updated_at ON system_config (updated_at);

-- ---------------------------------------------------------------------------
-- 用户与 RBAC
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id              bigserial PRIMARY KEY,
  username        varchar(64) NOT NULL UNIQUE,
  password_hash   varchar(255) NOT NULL,
  real_name       varchar(64),
  email           varchar(128),
  phone           varchar(32),
  role            varchar(32) NOT NULL DEFAULT 'student',
  status          varchar(32) NOT NULL DEFAULT 'active',
  student_no      varchar(64),
  employee_no     varchar(64),
  department      varchar(128),
  last_login_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_role_status ON users (role, status);
CREATE INDEX idx_users_department ON users (department);

ALTER TABLE system_config
  ADD CONSTRAINT fk_system_config_updated_by
  FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();

CREATE TABLE roles (
  id          bigserial PRIMARY KEY,
  code        varchar(64) NOT NULL UNIQUE,
  name        varchar(128) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE permissions (
  id          bigserial PRIMARY KEY,
  code        varchar(128) NOT NULL UNIQUE,
  name        varchar(256) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE role_permissions (
  role_id       bigint NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
  permission_id bigint NOT NULL REFERENCES permissions (id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_roles (
  user_id  bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role_id  bigint NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

-- ---------------------------------------------------------------------------
-- 组织 · 课程 · 资源
-- ---------------------------------------------------------------------------
CREATE TABLE colleges (
  id          bigserial PRIMARY KEY,
  name        varchar(128) NOT NULL UNIQUE,
  status      varchar(32) NOT NULL DEFAULT 'active',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_colleges_status ON colleges (status);

CREATE TRIGGER trg_colleges_updated_at BEFORE UPDATE ON colleges
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();

CREATE TABLE majors (
  id          bigserial PRIMARY KEY,
  college_id  bigint NOT NULL REFERENCES colleges (id) ON DELETE CASCADE,
  name        varchar(128) NOT NULL,
  status      varchar(32) NOT NULL DEFAULT 'active',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (college_id, name)
);

CREATE INDEX idx_majors_college_id ON majors (college_id);
CREATE INDEX idx_majors_status ON majors (status);

CREATE TRIGGER trg_majors_updated_at BEFORE UPDATE ON majors
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();

ALTER TABLE users
  ADD COLUMN major_id bigint REFERENCES majors (id) ON DELETE SET NULL;

CREATE INDEX idx_users_major_id ON users (major_id);

CREATE TABLE classes (
  id            bigserial PRIMARY KEY,
  name          varchar(128) NOT NULL,
  code          varchar(64) NOT NULL UNIQUE,
  academic_year varchar(32),
  semester      varchar(32),
  department    varchar(128),
  college_id    bigint REFERENCES colleges (id) ON DELETE SET NULL,
  major_id      bigint REFERENCES majors (id) ON DELETE SET NULL,
  teacher_id    bigint REFERENCES users (id) ON DELETE SET NULL,
  status        varchar(32) NOT NULL DEFAULT 'active',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_classes_college_id ON classes (college_id);
CREATE INDEX idx_classes_major_id ON classes (major_id);

CREATE TRIGGER trg_classes_updated_at BEFORE UPDATE ON classes
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();

CREATE TABLE class_students (
  id         bigserial PRIMARY KEY,
  class_id   bigint NOT NULL REFERENCES classes (id) ON DELETE CASCADE,
  student_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  joined_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, student_id)
);

CREATE TABLE courses (
  id             bigserial PRIMARY KEY,
  name           varchar(200) NOT NULL,
  description    text,
  teacher_id     bigint REFERENCES users (id) ON DELETE SET NULL,
  department     varchar(128),
  status         varchar(32) NOT NULL DEFAULT 'draft',
  reject_reason  text,
  is_published   boolean NOT NULL DEFAULT false,
  tags           jsonb DEFAULT '[]'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_courses_status ON courses (status);
CREATE TRIGGER trg_courses_updated_at BEFORE UPDATE ON courses
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();

CREATE TABLE course_modules (
  id          bigserial PRIMARY KEY,
  course_id   bigint NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  name        varchar(128) NOT NULL,
  sort_order  int NOT NULL DEFAULT 0,
  is_enabled  boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_course_modules_course ON course_modules (course_id, sort_order);

CREATE TABLE knowledge_points (
  id                  bigserial PRIMARY KEY,
  course_id           bigint REFERENCES courses (id) ON DELETE CASCADE,
  module_id           bigint REFERENCES course_modules (id) ON DELETE SET NULL,
  title               varchar(200) NOT NULL,
  description         text,
  resource_type       varchar(32) NOT NULL DEFAULT 'document',
  ability_point_name  varchar(128),
  duration_minutes    int,
  status              varchar(32) NOT NULL DEFAULT 'draft',
  uploader_id         bigint REFERENCES users (id) ON DELETE SET NULL,
  is_public           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_knowledge_points_course ON knowledge_points (course_id);
CREATE TRIGGER trg_knowledge_points_updated_at BEFORE UPDATE ON knowledge_points
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();

CREATE TABLE cases (
  id            bigserial PRIMARY KEY,
  course_id     bigint REFERENCES courses (id) ON DELETE CASCADE,
  title         varchar(200) NOT NULL,
  industry      varchar(128),
  case_type     varchar(32) NOT NULL DEFAULT 'success',
  module_name   varchar(128),
  description   text,
  is_recommended boolean NOT NULL DEFAULT false,
  status        varchar(32) NOT NULL DEFAULT 'draft',
  uploader_id   bigint REFERENCES users (id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_cases_updated_at BEFORE UPDATE ON cases
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();

CREATE TABLE ability_points (
  id           bigserial PRIMARY KEY,
  name         varchar(128) NOT NULL,
  category     varchar(64),
  description  text,
  max_level    int NOT NULL DEFAULT 5,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE student_ability_records (
  id                bigserial PRIMARY KEY,
  student_id        bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  ability_point_id  bigint NOT NULL REFERENCES ability_points (id) ON DELETE CASCADE,
  current_level     int NOT NULL DEFAULT 1,
  source_type       varchar(64),
  source_ref_id     bigint,
  obtained_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_student_ability_student ON student_ability_records (student_id);

-- 学习进度（知识区块 / 资源粒度）
CREATE TABLE student_resource_progress (
  id               bigserial PRIMARY KEY,
  user_id          bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  course_id        bigint REFERENCES courses (id) ON DELETE CASCADE,
  knowledge_point_id bigint REFERENCES knowledge_points (id) ON DELETE CASCADE,
  progress_percent numeric(5,2) NOT NULL DEFAULT 0,
  last_position    jsonb,
  completed_at     timestamptz,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, knowledge_point_id)
);

CREATE INDEX idx_srp_user_course ON student_resource_progress (user_id, course_id);
CREATE TRIGGER trg_srp_updated_at BEFORE UPDATE ON student_resource_progress
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();

-- ---------------------------------------------------------------------------
-- 团队与项目过程
-- ---------------------------------------------------------------------------
CREATE TABLE teams (
  id                   bigserial PRIMARY KEY,
  class_id             bigint REFERENCES classes (id) ON DELETE SET NULL,
  course_id            bigint REFERENCES courses (id) ON DELETE SET NULL,
  name                 varchar(128) NOT NULL,
  leader_id            bigint REFERENCES users (id) ON DELETE SET NULL,
  status               varchar(32) NOT NULL DEFAULT 'forming',
  current_stage        varchar(64),
  overall_progress     numeric(5,2) DEFAULT 0,
  collaboration_score  numeric(5,2),
  quality_score        numeric(5,2),
  risk_level           varchar(32) NOT NULL DEFAULT 'normal',
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_teams_class ON teams (class_id);
CREATE INDEX idx_teams_course ON teams (course_id);
CREATE TRIGGER trg_teams_updated_at BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();

CREATE TABLE team_members (
  id          bigserial PRIMARY KEY,
  team_id     bigint NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  user_id     bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  team_role   varchar(64),
  join_status varchar(32) NOT NULL DEFAULT 'accepted',
  joined_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);

CREATE TABLE team_stage_progress (
  id                bigserial PRIMARY KEY,
  team_id           bigint NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  stage_code        varchar(64) NOT NULL,
  progress_percent  numeric(5,2) NOT NULL DEFAULT 0,
  status            varchar(32) NOT NULL DEFAULT 'not_started',
  updated_by        bigint REFERENCES users (id) ON DELETE SET NULL,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, stage_code)
);

CREATE TABLE project_topics (
  id                     bigserial PRIMARY KEY,
  team_id                bigint NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  project_name           varchar(200) NOT NULL,
  direction              varchar(128),
  description            text,
  target_users           text,
  core_value             text,
  market_size            text,
  competitive_advantage  text,
  status                 varchar(32) NOT NULL DEFAULT 'draft',
  submitted_at           timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_project_topics_updated_at BEFORE UPDATE ON project_topics
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();

CREATE TABLE market_research_plans (
  id          bigserial PRIMARY KEY,
  team_id     bigint NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  goal        text,
  methods     jsonb DEFAULT '[]'::jsonb,
  members     jsonb DEFAULT '[]'::jsonb,
  start_date  date,
  end_date    date,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_market_research_plans_updated_at BEFORE UPDATE ON market_research_plans
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();

CREATE TABLE surveys (
  id              bigserial PRIMARY KEY,
  team_id         bigint NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  title           varchar(200) NOT NULL,
  status          varchar(32) NOT NULL DEFAULT 'draft',
  target_count    int NOT NULL DEFAULT 0,
  collected_count int NOT NULL DEFAULT 0,
  survey_link     varchar(500),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_surveys_updated_at BEFORE UPDATE ON surveys
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();

CREATE TABLE survey_questions (
  id              bigserial PRIMARY KEY,
  survey_id       bigint NOT NULL REFERENCES surveys (id) ON DELETE CASCADE,
  question_text   text NOT NULL,
  question_type   varchar(32) NOT NULL,
  options         jsonb,
  sort_order      int NOT NULL DEFAULT 0
);

CREATE TABLE user_personas (
  id           bigserial PRIMARY KEY,
  team_id      bigint NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  name         varchar(64),
  age          int,
  occupation   varchar(128),
  major        varchar(128),
  pain_points  jsonb,
  needs        jsonb,
  habits       jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE product_design_docs (
  id               bigserial PRIMARY KEY,
  team_id          bigint NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  version_no       varchar(32),
  feature_summary  text,
  prototype_desc   text,
  mvp_scope        text,
  iteration_notes  text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_product_design_docs_updated_at BEFORE UPDATE ON product_design_docs
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();

CREATE TABLE business_models (
  id                       bigserial PRIMARY KEY,
  team_id                  bigint NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  customer_segments        text,
  value_propositions       text,
  channels                 text,
  customer_relationships   text,
  revenue_streams          text,
  key_resources            text,
  key_activities           text,
  key_partners             text,
  cost_structure           text,
  swot_analysis            text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_business_models_updated_at BEFORE UPDATE ON business_models
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();

CREATE TABLE business_plans (
  id                  bigserial PRIMARY KEY,
  team_id             bigint NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  project_name        varchar(200),
  executive_summary   text,
  market_analysis     text,
  product_service     text,
  marketing_strategy  text,
  operation_plan      text,
  financial_plan      text,
  team_introduction   text,
  risk_analysis       text,
  status              varchar(32) NOT NULL DEFAULT 'draft',
  submitted_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_business_plans_updated_at BEFORE UPDATE ON business_plans
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();

CREATE TABLE business_plan_attachments (
  id                bigserial PRIMARY KEY,
  business_plan_id  bigint NOT NULL REFERENCES business_plans (id) ON DELETE CASCADE,
  file_id           bigint,
  attachment_type   varchar(32) NOT NULL DEFAULT 'other',
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- AI 验证会话
-- ---------------------------------------------------------------------------
CREATE TABLE ai_validation_sessions (
  id                    bigserial PRIMARY KEY,
  team_id               bigint NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  session_name          varchar(200),
  selected_agents       jsonb DEFAULT '[]'::jsonb,
  project_plan_summary  text,
  status                varchar(32) NOT NULL DEFAULT 'running',
  started_at            timestamptz NOT NULL DEFAULT now(),
  ended_at              timestamptz
);

CREATE TABLE ai_validation_messages (
  id           bigserial PRIMARY KEY,
  session_id   bigint NOT NULL REFERENCES ai_validation_sessions (id) ON DELETE CASCADE,
  round_no     int NOT NULL DEFAULT 0,
  actor_type   varchar(32) NOT NULL,
  content      text,
  severity     varchar(32),
  suggestions  jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_val_msg_session ON ai_validation_messages (session_id);

CREATE TABLE ai_validation_records (
  id             bigserial PRIMARY KEY,
  session_id     bigint NOT NULL REFERENCES ai_validation_sessions (id) ON DELETE CASCADE,
  round_no       int NOT NULL DEFAULT 0,
  agent_name     varchar(64),
  issue_title    varchar(255),
  user_response  text,
  fix_status     varchar(32) NOT NULL DEFAULT 'pending',
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 创意与迭代（补缺）
-- ---------------------------------------------------------------------------
CREATE TABLE ideation_ideas (
  id            bigserial PRIMARY KEY,
  team_id       bigint NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  title         varchar(256) NOT NULL,
  description   text,
  method_tags   jsonb DEFAULT '[]'::jsonb,
  status        varchar(32) NOT NULL DEFAULT 'draft',
  created_by    bigint REFERENCES users (id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ideation_team ON ideation_ideas (team_id);
CREATE TRIGGER trg_ideation_ideas_updated_at BEFORE UPDATE ON ideation_ideas
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();

CREATE TABLE ideation_votes (
  id        bigserial PRIMARY KEY,
  idea_id   bigint NOT NULL REFERENCES ideation_ideas (id) ON DELETE CASCADE,
  user_id   bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  score     int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (idea_id, user_id)
);

CREATE TABLE team_iterations (
  id          bigserial PRIMARY KEY,
  team_id     bigint NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  cycle_no    int NOT NULL,
  bml_phase   varchar(32),
  summary     text,
  decision    text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_team_iterations_cycle ON team_iterations (team_id, cycle_no);

CREATE TABLE team_iteration_metrics (
  id            bigserial PRIMARY KEY,
  iteration_id  bigint NOT NULL REFERENCES team_iterations (id) ON DELETE CASCADE,
  name          varchar(128) NOT NULL,
  value_numeric  numeric(18,4),
  unit          varchar(32),
  snapshot_at   timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 任务 · 审核 · 评价
-- ---------------------------------------------------------------------------
CREATE TABLE tasks (
  id            bigserial PRIMARY KEY,
  class_id      bigint REFERENCES classes (id) ON DELETE SET NULL,
  course_id     bigint REFERENCES courses (id) ON DELETE SET NULL,
  title         varchar(200) NOT NULL,
  description   text,
  module_code   varchar(64),
  deadline_at   timestamptz,
  scope         varchar(32) NOT NULL DEFAULT 'all',
  status        varchar(32) NOT NULL DEFAULT 'draft',
  published_by  bigint REFERENCES users (id) ON DELETE SET NULL,
  published_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_class ON tasks (class_id);
CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();

CREATE TABLE task_target_teams (
  id       bigserial PRIMARY KEY,
  task_id  bigint NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  team_id  bigint NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  UNIQUE (task_id, team_id)
);

CREATE TABLE task_attachments (
  id         bigserial PRIMARY KEY,
  task_id    bigint NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  file_id    bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE task_submissions (
  id             bigserial PRIMARY KEY,
  task_id        bigint NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  team_id        bigint NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  content        text,
  status         varchar(32) NOT NULL DEFAULT 'submitted',
  score          numeric(5,2),
  feedback       text,
  submitted_at   timestamptz NOT NULL DEFAULT now(),
  reviewed_at    timestamptz,
  reviewed_by    bigint REFERENCES users (id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_submissions_task ON task_submissions (task_id);

CREATE TABLE submission_attachments (
  id             bigserial PRIMARY KEY,
  submission_id  bigint NOT NULL REFERENCES task_submissions (id) ON DELETE CASCADE,
  file_id        bigint,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE review_records (
  id           bigserial PRIMARY KEY,
  review_type  varchar(64) NOT NULL,
  biz_id       bigint NOT NULL,
  status       varchar(32) NOT NULL DEFAULT 'pending',
  comment      text,
  reviewer_id  bigint REFERENCES users (id) ON DELETE SET NULL,
  reviewed_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_review_records_type_biz ON review_records (review_type, biz_id);

CREATE TABLE evaluation_schemes (
  id                     bigserial PRIMARY KEY,
  course_id              bigint REFERENCES courses (id) ON DELETE CASCADE,
  name                   varchar(128) NOT NULL,
  process_weight         numeric(5,2) NOT NULL DEFAULT 0,
  result_weight          numeric(5,2) NOT NULL DEFAULT 0,
  collaboration_weight numeric(5,2) NOT NULL DEFAULT 0,
  review_bonus_weight    numeric(5,2) NOT NULL DEFAULT 0,
  is_default             boolean NOT NULL DEFAULT false,
  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE evaluation_records (
  id                  bigserial PRIMARY KEY,
  team_id             bigint NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  course_id           bigint REFERENCES courses (id) ON DELETE SET NULL,
  evaluator_id        bigint REFERENCES users (id) ON DELETE SET NULL,
  project_score       numeric(5,2),
  iteration_score     numeric(5,2),
  review_bonus_score  numeric(5,2),
  final_score         numeric(5,2),
  feedback            text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 测验（补缺）
-- ---------------------------------------------------------------------------
CREATE TABLE quizzes (
  id               bigserial PRIMARY KEY,
  course_id        bigint REFERENCES courses (id) ON DELETE CASCADE,
  knowledge_point_id bigint REFERENCES knowledge_points (id) ON DELETE SET NULL,
  title            varchar(256) NOT NULL,
  pass_score       int NOT NULL DEFAULT 60,
  time_limit_sec   int,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_quizzes_updated_at BEFORE UPDATE ON quizzes
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();

CREATE TABLE quiz_questions (
  id            bigserial PRIMARY KEY,
  quiz_id       bigint NOT NULL REFERENCES quizzes (id) ON DELETE CASCADE,
  question_text text NOT NULL,
  question_type varchar(32) NOT NULL,
  options       jsonb,
  sort_order    int NOT NULL DEFAULT 0,
  score         int NOT NULL DEFAULT 10
);

CREATE TABLE quiz_attempts (
  id         bigserial PRIMARY KEY,
  quiz_id    bigint NOT NULL REFERENCES quizzes (id) ON DELETE CASCADE,
  user_id    bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  team_id    bigint REFERENCES teams (id) ON DELETE SET NULL,
  answers    jsonb NOT NULL DEFAULT '{}'::jsonb,
  score      numeric(8,2),
  passed     boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_quiz_attempts_user ON quiz_attempts (user_id, quiz_id);

-- ---------------------------------------------------------------------------
-- AI 配置与日志
-- ---------------------------------------------------------------------------
CREATE TABLE ai_providers (
  id             bigserial PRIMARY KEY,
  provider_code  varchar(64) NOT NULL UNIQUE,
  provider_name  varchar(128) NOT NULL,
  base_url       varchar(500),
  auth_type      varchar(32) NOT NULL DEFAULT 'bearer',
  status         varchar(32) NOT NULL DEFAULT 'enabled',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_ai_providers_updated_at BEFORE UPDATE ON ai_providers
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();

CREATE TABLE ai_models (
  id                   bigserial PRIMARY KEY,
  provider_id          bigint NOT NULL REFERENCES ai_providers (id) ON DELETE CASCADE,
  model_code           varchar(128) NOT NULL,
  model_name           varchar(128) NOT NULL,
  api_key_encrypted    text,
  api_secret_encrypted text,
  base_url             varchar(500),
  temperature          numeric(4,2) DEFAULT 0.7,
  max_tokens           int DEFAULT 4096,
  timeout_ms           int DEFAULT 60000,
  priority             int NOT NULL DEFAULT 0,
  is_default           boolean NOT NULL DEFAULT false,
  is_enabled           boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, model_code)
);

CREATE INDEX idx_ai_models_provider ON ai_models (provider_id);
CREATE TRIGGER trg_ai_models_updated_at BEFORE UPDATE ON ai_models
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();

CREATE TABLE ai_scene_bindings (
  id          bigserial PRIMARY KEY,
  scene_code  varchar(64) NOT NULL UNIQUE,
  model_id    bigint REFERENCES ai_models (id) ON DELETE SET NULL,
  is_enabled  boolean NOT NULL DEFAULT true,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_ai_scene_bindings_updated_at BEFORE UPDATE ON ai_scene_bindings
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();

CREATE TABLE ai_prompt_templates (
  id                bigserial PRIMARY KEY,
  scene_code        varchar(64) NOT NULL,
  template_name     varchar(128) NOT NULL,
  template_content  text NOT NULL,
  version_no        varchar(32) NOT NULL DEFAULT '1.0',
  is_enabled        boolean NOT NULL DEFAULT true,
  created_by        bigint REFERENCES users (id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scene_code, template_name, version_no)
);

CREATE TABLE ai_call_logs (
  id              bigserial PRIMARY KEY,
  model_id        bigint REFERENCES ai_models (id) ON DELETE SET NULL,
  scene_code      varchar(64),
  request_id      varchar(128),
  biz_type        varchar(64),
  biz_id          bigint,
  input_summary   text,
  output_summary  text,
  duration_ms     int,
  token_usage     int,
  is_success      boolean NOT NULL DEFAULT true,
  error_message   text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_call_logs_created ON ai_call_logs (created_at DESC);

CREATE TABLE ai_jobs (
  id          bigserial PRIMARY KEY,
  scene_code  varchar(64) NOT NULL,
  model_id    bigint REFERENCES ai_models (id) ON DELETE SET NULL,
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  status      varchar(32) NOT NULL DEFAULT 'pending',
  result      jsonb,
  error_message text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_jobs_status ON ai_jobs (status, created_at);
CREATE TRIGGER trg_ai_jobs_updated_at BEFORE UPDATE ON ai_jobs
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();

-- ---------------------------------------------------------------------------
-- 通知 · 文件 · 审计
-- ---------------------------------------------------------------------------
CREATE TABLE notifications (
  id              bigserial PRIMARY KEY,
  receiver_id     bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  sender_id       bigint REFERENCES users (id) ON DELETE SET NULL,
  type            varchar(32) NOT NULL,
  title           varchar(255),
  content         text,
  related_module  varchar(64),
  related_link    varchar(500),
  is_read         boolean NOT NULL DEFAULT false,
  sent_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_receiver ON notifications (receiver_id, sent_at DESC);

CREATE TABLE files (
  id            bigserial PRIMARY KEY,
  origin_name   varchar(255) NOT NULL,
  storage_name  varchar(255) NOT NULL,
  storage_path  varchar(500) NOT NULL,
  mime_type     varchar(128),
  size_bytes    bigint,
  uploader_id   bigint REFERENCES users (id) ON DELETE SET NULL,
  biz_type      varchar(64),
  biz_id        bigint,
  is_deleted    boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_files_biz ON files (biz_type, biz_id);

CREATE TABLE operation_logs (
  id              bigserial PRIMARY KEY,
  operator_id     bigint REFERENCES users (id) ON DELETE SET NULL,
  operator_role   varchar(32),
  module          varchar(64) NOT NULL,
  action          varchar(128) NOT NULL,
  target_type     varchar(64),
  target_id       bigint,
  detail          jsonb,
  ip              varchar(64),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_operation_logs_created ON operation_logs (created_at DESC);

-- 延迟挂 FK：files 被 attachments 引用
ALTER TABLE business_plan_attachments
  ADD CONSTRAINT fk_business_plan_attachments_file
  FOREIGN KEY (file_id) REFERENCES files (id) ON DELETE SET NULL;

ALTER TABLE task_attachments
  ADD CONSTRAINT fk_task_attachments_file
  FOREIGN KEY (file_id) REFERENCES files (id) ON DELETE SET NULL;

ALTER TABLE submission_attachments
  ADD CONSTRAINT fk_submission_attachments_file
  FOREIGN KEY (file_id) REFERENCES files (id) ON DELETE SET NULL;

CREATE TRIGGER trg_system_config_updated_at BEFORE UPDATE ON system_config
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();

-- ---------------------------------------------------------------------------
-- 数据字典（一级类型 + 二级项，管理端维护；业务通过 code 引用类型）
-- ---------------------------------------------------------------------------
CREATE TABLE dict_type (
  id          bigserial PRIMARY KEY,
  name        varchar(128) NOT NULL,
  code        varchar(64) NOT NULL UNIQUE,
  status      smallint NOT NULL DEFAULT 1,
  remark      text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dict_type_status ON dict_type (status);

CREATE TABLE dict_item (
  id              bigserial PRIMARY KEY,
  dict_type_id   bigint NOT NULL REFERENCES dict_type (id) ON DELETE CASCADE,
  name            varchar(256) NOT NULL,
  data_key        integer NOT NULL,
  sort_order      integer NOT NULL DEFAULT 0,
  status          smallint NOT NULL DEFAULT 1,
  remark          text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dict_type_id, data_key)
);

CREATE INDEX idx_dict_item_type ON dict_item (dict_type_id);
CREATE INDEX idx_dict_item_type_sort ON dict_item (dict_type_id, sort_order, id);

CREATE TRIGGER trg_dict_type_updated_at BEFORE UPDATE ON dict_type
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();

CREATE TRIGGER trg_dict_item_updated_at BEFORE UPDATE ON dict_item
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();
