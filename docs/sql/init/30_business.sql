-- 实训平台 · 教师班与实训业务表（空库全量）
SET client_encoding = 'UTF8';

-- 教师个性化班级（教学/形式化分组），与 classes / class_students 分离
-- 执行：psql -v ON_ERROR_STOP=1 -f 002_teacher_personal_classes.sql

CREATE TABLE teacher_personal_classes (
  id             bigserial PRIMARY KEY,
  teacher_id     bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name           varchar(128) NOT NULL,
  academic_year  varchar(32),
  semester       varchar(32),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_teacher_personal_classes_teacher_id ON teacher_personal_classes (teacher_id);

CREATE TRIGGER trg_teacher_personal_classes_updated_at BEFORE UPDATE ON teacher_personal_classes
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();

CREATE TABLE teacher_personal_class_students (
  id                       bigserial PRIMARY KEY,
  teacher_personal_class_id bigint NOT NULL REFERENCES teacher_personal_classes (id) ON DELETE CASCADE,
  student_id               bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  joined_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_personal_class_id, student_id)
);

CREATE INDEX idx_tpcs_class ON teacher_personal_class_students (teacher_personal_class_id);
CREATE INDEX idx_tpcs_student ON teacher_personal_class_students (student_id);

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
  grouping_preference varchar(16) CHECK (grouping_preference IS NULL OR grouping_preference IN ('pool', 'solo')),
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_personal_class_id, student_id)
);

CREATE INDEX idx_stfs_class_status ON student_team_formation_submissions (teacher_personal_class_id, status);

CREATE TRIGGER trg_stfs_updated_at BEFORE UPDATE ON student_team_formation_submissions
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();



CREATE TABLE teacher_personal_class_teams (
  id bigserial PRIMARY KEY,
  teacher_personal_class_id bigint NOT NULL REFERENCES teacher_personal_classes (id) ON DELETE CASCADE,
  name varchar(128) NOT NULL,
  grouping_status varchar(24) NOT NULL DEFAULT 'draft'
    CHECK (grouping_status IN ('draft', 'confirmed')),
  complement_score numeric(5,2),
  ai_rationale text,
  sort_order int NOT NULL DEFAULT 0,
  introduction text NOT NULL DEFAULT '',
  leader_student_id bigint REFERENCES users (id) ON DELETE SET NULL,
  is_solo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tpct_class_status ON teacher_personal_class_teams (teacher_personal_class_id, grouping_status);

CREATE TRIGGER trg_tpct_updated_at BEFORE UPDATE ON teacher_personal_class_teams
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();

CREATE TABLE teacher_personal_class_team_members (
  id bigserial PRIMARY KEY,
  team_id bigint NOT NULL REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  student_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  ai_matched_role varchar(32),
  dimension_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, student_id)
);

CREATE INDEX idx_tpctm_team ON teacher_personal_class_team_members (team_id);
CREATE INDEX idx_tpctm_student ON teacher_personal_class_team_members (student_id);

CREATE TABLE course_resource_nodes (
  id           bigserial PRIMARY KEY,
  module_key   varchar(64) NOT NULL,
  module_name  varchar(128) NOT NULL,
  parent_id    bigint REFERENCES course_resource_nodes (id) ON DELETE CASCADE,
  level        int NOT NULL CHECK (level BETWEEN 1 AND 3),
  title        varchar(200) NOT NULL,
  sort_order   int NOT NULL DEFAULT 0,
  status       varchar(32) NOT NULL DEFAULT 'draft',
  created_by   bigint REFERENCES users (id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_course_resource_nodes_module
  ON course_resource_nodes (module_key, parent_id, sort_order, id);

CREATE INDEX idx_course_resource_nodes_parent
  ON course_resource_nodes (parent_id);

CREATE TRIGGER trg_course_resource_nodes_updated_at
  BEFORE UPDATE ON course_resource_nodes
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();

CREATE TABLE course_resource_files (
  id            bigserial PRIMARY KEY,
  node_id       bigint NOT NULL REFERENCES course_resource_nodes (id) ON DELETE CASCADE,
  origin_name   varchar(255) NOT NULL,
  storage_name  varchar(255) NOT NULL,
  storage_path  varchar(500) NOT NULL,
  mime_type     varchar(128),
  size_bytes    bigint NOT NULL DEFAULT 0,
  resource_type varchar(32) NOT NULL DEFAULT 'file',
  content_hash varchar(64),
  preview_storage_path varchar(500),
  preview_mime_type varchar(128),
  preview_status varchar(32) NOT NULL DEFAULT 'ready',
  uploaded_by   bigint REFERENCES users (id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_course_resource_files_node
  ON course_resource_files (node_id, created_at DESC);

CREATE INDEX idx_course_resource_files_hash
  ON course_resource_files (content_hash);

CREATE TABLE course_resource_node_knowledge_points (
  node_id            bigint NOT NULL REFERENCES course_resource_nodes (id) ON DELETE CASCADE,
  knowledge_point_id bigint NOT NULL REFERENCES knowledge_points (id) ON DELETE CASCADE,
  created_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (node_id, knowledge_point_id)
);

CREATE TABLE student_course_resource_progress (
  id               bigserial PRIMARY KEY,
  user_id          bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  content_hash     varchar(64) NOT NULL,
  progress_percent numeric(5,2) NOT NULL DEFAULT 0,
  last_position    jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_at     timestamptz,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, content_hash)
);

CREATE INDEX idx_student_course_resource_progress_user
  ON student_course_resource_progress (user_id, updated_at DESC);

CREATE TRIGGER trg_student_course_resource_progress_updated_at
  BEFORE UPDATE ON student_course_resource_progress
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();



CREATE TABLE teacher_personal_class_tasks (
  id                   bigserial PRIMARY KEY,
  teacher_personal_class_id bigint NOT NULL REFERENCES teacher_personal_classes (id) ON DELETE CASCADE,
  teacher_id           bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title                varchar(256) NOT NULL,
  description          text NOT NULL DEFAULT '',
  module               varchar(64) NOT NULL,
  priority             varchar(16) NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
  deadline             timestamptz NOT NULL,
  scope                varchar(16) NOT NULL DEFAULT 'all'
    CHECK (scope IN ('all', 'specific')),
  status               varchar(16) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published')),
  attachments_enabled  boolean NOT NULL DEFAULT false,
  resource_link_enabled boolean NOT NULL DEFAULT false,
  requires_student_attachment boolean NOT NULL DEFAULT false,
  published_at         timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pct_class ON teacher_personal_class_tasks (teacher_personal_class_id);
CREATE INDEX idx_pct_teacher ON teacher_personal_class_tasks (teacher_id);
CREATE INDEX idx_pct_status ON teacher_personal_class_tasks (teacher_personal_class_id, status);

CREATE TRIGGER trg_teacher_personal_class_tasks_updated_at
  BEFORE UPDATE ON teacher_personal_class_tasks
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();

CREATE TABLE teacher_personal_class_task_teams (
  task_id  bigint NOT NULL REFERENCES teacher_personal_class_tasks (id) ON DELETE CASCADE,
  team_id  bigint NOT NULL REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, team_id)
);

CREATE TABLE teacher_personal_class_task_attachments (
  id           bigserial PRIMARY KEY,
  task_id      bigint NOT NULL REFERENCES teacher_personal_class_tasks (id) ON DELETE CASCADE,
  storage_key  text NOT NULL,
  file_name    varchar(512) NOT NULL,
  file_size    bigint NOT NULL DEFAULT 0,
  sort_order   int NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pcta_task ON teacher_personal_class_task_attachments (task_id);

CREATE TABLE teacher_personal_class_task_resource_nodes (
  task_id  bigint NOT NULL REFERENCES teacher_personal_class_tasks (id) ON DELETE CASCADE,
  node_id  bigint NOT NULL REFERENCES course_resource_nodes (id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, node_id)
);

CREATE INDEX idx_pctrn_node ON teacher_personal_class_task_resource_nodes (node_id);

CREATE TABLE student_personal_class_task_completions (
  task_id      bigint NOT NULL REFERENCES teacher_personal_class_tasks (id) ON DELETE CASCADE,
  student_id   bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, student_id)
);

CREATE INDEX idx_pctc_student ON student_personal_class_task_completions (student_id);

CREATE TABLE student_personal_class_task_completion_attachments (
  id          bigserial PRIMARY KEY,
  task_id     bigint NOT NULL REFERENCES teacher_personal_class_tasks (id) ON DELETE CASCADE,
  student_id  bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  storage_key text NOT NULL,
  file_name   varchar(512) NOT NULL,
  file_size   bigint NOT NULL DEFAULT 0,
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_spctca_task_student
  ON student_personal_class_task_completion_attachments (task_id, student_id, sort_order, id);

CREATE TABLE teacher_instance_library_categories (
  id          bigserial PRIMARY KEY,
  teacher_id  bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name        varchar(128) NOT NULL,
  icon        varchar(128) NOT NULL DEFAULT 'FolderOutlined',
  color       varchar(128) NOT NULL DEFAULT '#8b5cf6',
  training_module_key varchar(32) NOT NULL DEFAULT 'ideation',
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_instance_categories_module_key
    CHECK (training_module_key IN ('ideation', 'market', 'product', 'business', 'simulation', 'plan'))
);

CREATE INDEX idx_teacher_instance_categories_teacher
  ON teacher_instance_library_categories (teacher_id, sort_order, id);
CREATE INDEX idx_teacher_instance_categories_teacher_module
  ON teacher_instance_library_categories (teacher_id, training_module_key, sort_order, id);

CREATE TRIGGER trg_teacher_instance_categories_updated_at
  BEFORE UPDATE ON teacher_instance_library_categories
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();

CREATE TABLE teacher_instance_library_cases (
  id              bigserial PRIMARY KEY,
  teacher_id      bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  category_id     bigint NOT NULL REFERENCES teacher_instance_library_categories (id) ON DELETE CASCADE,
  title           varchar(200) NOT NULL,
  detail_html     text NOT NULL DEFAULT '',
  tags            jsonb NOT NULL DEFAULT '[]'::jsonb,
  project_outcome text NOT NULL DEFAULT '',
  cover_storage_path varchar(500),
  cover_origin_name varchar(255),
  cover_mime_type varchar(128),
  sort_order      int NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_teacher_instance_cases_category
  ON teacher_instance_library_cases (teacher_id, category_id, sort_order, id);

CREATE TRIGGER trg_teacher_instance_cases_updated_at
  BEFORE UPDATE ON teacher_instance_library_cases
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();

CREATE TABLE teacher_instance_library_resources (
  id            bigserial PRIMARY KEY,
  case_id       bigint NOT NULL REFERENCES teacher_instance_library_cases (id) ON DELETE CASCADE,
  usage         varchar(32) NOT NULL DEFAULT 'attachment'
    CHECK (usage IN ('attachment', 'inline')),
  origin_name   varchar(255) NOT NULL,
  storage_name  varchar(255) NOT NULL,
  storage_path  varchar(500) NOT NULL,
  mime_type     varchar(128),
  size_bytes    bigint NOT NULL DEFAULT 0,
  resource_type varchar(32) NOT NULL DEFAULT 'file',
  uploaded_by   bigint REFERENCES users (id) ON DELETE SET NULL,
  sort_order    int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_teacher_instance_resources_case
  ON teacher_instance_library_resources (case_id, usage, sort_order, id);

-- 学生端创新方法工具：团队共享创意库、点赞与讨论
-- 执行：psql -v ON_ERROR_STOP=1 -f 014_student_ideation.sql

CREATE TABLE teacher_personal_class_team_ideas (
  id          bigserial PRIMARY KEY,
  team_id     bigint NOT NULL REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  method_key  varchar(32) NOT NULL
    CHECK (method_key IN ('brainstorm', 'scamper', 'triz', 'ai', 'six_hats', 'midwifery')),
  method_name varchar(64) NOT NULL,
  title       varchar(256) NOT NULL,
  description text NOT NULL DEFAULT '',
  form_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_analysis  jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tpcti_team_created
  ON teacher_personal_class_team_ideas (team_id, created_at DESC);

CREATE TRIGGER trg_tpcti_updated_at
  BEFORE UPDATE ON teacher_personal_class_team_ideas
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();

CREATE TABLE teacher_personal_class_team_idea_likes (
  idea_id    bigint NOT NULL REFERENCES teacher_personal_class_team_ideas (id) ON DELETE CASCADE,
  student_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (idea_id, student_id)
);

CREATE INDEX idx_tpctil_student
  ON teacher_personal_class_team_idea_likes (student_id);

-- 六帽创想室：按组员独立讨论稿与工作区
CREATE TABLE teacher_personal_class_team_hat_studio_member (
  team_id         bigint NOT NULL REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  student_id      bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  draft_json      jsonb NOT NULL DEFAULT '{}'::jsonb,
  transcript_json jsonb NOT NULL DEFAULT '{"messages":[],"roundCount":0}'::jsonb,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, student_id)
);

CREATE INDEX idx_tpcths_team ON teacher_personal_class_team_hat_studio_member (team_id);

-- 启思 / 头脑风暴 / AI：按组员 × 方法持久化对话（六帽仍用 hat_studio_member）
CREATE TABLE teacher_personal_class_team_ideation_method_chat (
  team_id         bigint NOT NULL REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  student_id      bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  method_key      varchar(32) NOT NULL,
  thread_id       text,
  transcript_json jsonb NOT NULL DEFAULT '{"messages":[],"roundIndex":0,"canGenerate":false,"bootstrapped":false}'::jsonb,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, student_id, method_key),
  CONSTRAINT tpct_imc_method_key_check CHECK (method_key IN ('midwifery', 'brainstorm', 'ai'))
);

CREATE INDEX idx_tpct_imc_team ON teacher_personal_class_team_ideation_method_chat (team_id);
CREATE INDEX idx_tpct_imc_student ON teacher_personal_class_team_ideation_method_chat (student_id);

CREATE TABLE teacher_personal_class_team_discussions (
  id         bigserial PRIMARY KEY,
  team_id    bigint NOT NULL REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  student_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  content    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tpctd_team_created
  ON teacher_personal_class_team_discussions (team_id, created_at DESC);

-- 教师个人班级课程设置：阶段截止时间与提醒规则
-- 执行：psql -v ON_ERROR_STOP=1 -f 015_course_settings.sql

CREATE TABLE teacher_personal_class_course_settings (
  id                         bigserial PRIMARY KEY,
  teacher_personal_class_id  bigint NOT NULL REFERENCES teacher_personal_classes (id) ON DELETE CASCADE,
  teacher_id                 bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  module_key                 varchar(32) NOT NULL,
  start_date                 date,
  deadline_date              date,
  duration_days              int NOT NULL DEFAULT 0,
  reminder_days              int NOT NULL DEFAULT 3,
  reminder_enabled           boolean NOT NULL DEFAULT true,
  skipped                    boolean NOT NULL DEFAULT false,
  features_json              jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_reminded_at           timestamptz,
  last_reminded_deadline     date,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_tpc_course_settings_module UNIQUE (teacher_personal_class_id, module_key),
  CONSTRAINT chk_tpc_course_settings_duration CHECK (duration_days >= 0),
  CONSTRAINT chk_tpc_course_settings_reminder CHECK (reminder_days >= 0 AND reminder_days <= 30),
  CONSTRAINT chk_tpc_course_settings_module CHECK (
    module_key IN ('team', 'ideation', 'market', 'product', 'business', 'simulation', 'plan')
  )
);

CREATE INDEX idx_tpc_course_settings_class
  ON teacher_personal_class_course_settings (teacher_personal_class_id, module_key);

CREATE INDEX idx_tpc_course_settings_reminder
  ON teacher_personal_class_course_settings (deadline_date, reminder_enabled, last_reminded_deadline);

CREATE TRIGGER trg_tpc_course_settings_updated_at
  BEFORE UPDATE ON teacher_personal_class_course_settings
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();

-- 教师个性化教学班：团队项目选题提交与审核
-- 执行：psql -v ON_ERROR_STOP=1 -f 017_team_project_topics.sql

CREATE TABLE teacher_personal_class_team_project_topics (
  id                         bigserial PRIMARY KEY,
  teacher_personal_class_id  bigint NOT NULL REFERENCES teacher_personal_classes (id) ON DELETE CASCADE,
  team_id                    bigint NOT NULL REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  submitted_by               bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  project_name               varchar(256) NOT NULL,
  project_direction          varchar(128) NOT NULL,
  project_description        text NOT NULL DEFAULT '',
  core_value                 text NOT NULL DEFAULT '',
  target_users               text NOT NULL DEFAULT '',
  core_problem               text NOT NULL DEFAULT '',
  solution_overview          text NOT NULL DEFAULT '',
  market_size                text NOT NULL DEFAULT '',
  competitive_advantage      text NOT NULL DEFAULT '',
  status                     varchar(16) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  review_comment             text NOT NULL DEFAULT '',
  reviewed_by                bigint REFERENCES users (id) ON DELETE SET NULL,
  reviewed_at                timestamptz,
  submitted_at               timestamptz NOT NULL DEFAULT now(),
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id)
);

CREATE INDEX idx_tpctpt_class_status
  ON teacher_personal_class_team_project_topics (teacher_personal_class_id, status, submitted_at DESC);

CREATE TRIGGER trg_tpctpt_updated_at
  BEFORE UPDATE ON teacher_personal_class_team_project_topics
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();

-- 团队市场调研：调研计划与方法数据上传
-- 执行：psql -v ON_ERROR_STOP=1 -f 018_team_market_research.sql

CREATE TABLE teacher_personal_class_team_market_research_plans (
  id               bigserial PRIMARY KEY,
  team_id          bigint NOT NULL UNIQUE REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  goal             text NOT NULL DEFAULT '',
  methods          jsonb NOT NULL DEFAULT '[]'::jsonb,
  plan_start_date  date,
  plan_end_date    date,
  assignments      jsonb NOT NULL DEFAULT '[]'::jsonb,
  saved_by         bigint REFERENCES users (id) ON DELETE SET NULL,
  saved_at         timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tpctmrp_team
  ON teacher_personal_class_team_market_research_plans (team_id);

CREATE TRIGGER trg_tpctmrp_updated_at
  BEFORE UPDATE ON teacher_personal_class_team_market_research_plans
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();

CREATE TABLE teacher_personal_class_team_market_research_uploads (
  id                bigserial PRIMARY KEY,
  team_id           bigint NOT NULL REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  method            varchar(32) NOT NULL
    CHECK (method IN ('用户访谈', '竞品分析', '行业报告', '数据爬取', '实地观察')),
  original_filename varchar(512) NOT NULL,
  storage_key       varchar(1024) NOT NULL,
  mime_type         varchar(128) NOT NULL DEFAULT '',
  file_size         bigint NOT NULL DEFAULT 0,
  uploaded_by       bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tpctmru_team_method_created
  ON teacher_personal_class_team_market_research_uploads (team_id, method, created_at DESC);


CREATE TABLE teacher_personal_class_team_surveys (
  id               bigserial PRIMARY KEY,
  team_id          bigint NOT NULL REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  title            varchar(512) NOT NULL DEFAULT '',
  status           varchar(32) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'withdrawn')),
  collected_count  int NOT NULL DEFAULT 0,
  public_slug      varchar(64) UNIQUE,
  source           varchar(16) NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'ai')),
  closes_at        timestamptz,
  created_by       bigint REFERENCES users (id) ON DELETE SET NULL,
  published_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tpcts_team_created
  ON teacher_personal_class_team_surveys (team_id, created_at DESC);
CREATE UNIQUE INDEX idx_tpcts_public_slug
  ON teacher_personal_class_team_surveys (public_slug)
  WHERE public_slug IS NOT NULL;
CREATE INDEX idx_tpcts_team_closes
  ON teacher_personal_class_team_surveys (team_id, closes_at)
  WHERE closes_at IS NOT NULL;

CREATE TRIGGER trg_tpcts_updated_at
  BEFORE UPDATE ON teacher_personal_class_team_surveys
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();

CREATE TABLE teacher_personal_class_team_survey_questions (
  id              bigserial PRIMARY KEY,
  survey_id       bigint NOT NULL REFERENCES teacher_personal_class_team_surveys (id) ON DELETE CASCADE,
  question_text   text NOT NULL,
  question_type   varchar(32) NOT NULL
    CHECK (question_type IN ('单选', '多选', '评分', '填空')),
  options         jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order      int NOT NULL DEFAULT 0
);

CREATE INDEX idx_tpctsq_survey_order
  ON teacher_personal_class_team_survey_questions (survey_id, sort_order);

CREATE TABLE teacher_personal_class_team_survey_responses (
  id           bigserial PRIMARY KEY,
  survey_id    bigint NOT NULL REFERENCES teacher_personal_class_team_surveys (id) ON DELETE CASCADE,
  answers      jsonb NOT NULL DEFAULT '{}'::jsonb,
  respondent_token varchar(64) NOT NULL DEFAULT '',
  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tpctsr_survey_submitted
  ON teacher_personal_class_team_survey_responses (survey_id, submitted_at DESC);
CREATE UNIQUE INDEX idx_tpctsr_survey_respondent_token
  ON teacher_personal_class_team_survey_responses (survey_id, respondent_token)
  WHERE respondent_token <> '';

-- 团队市场调研：AI 分析、用户画像、人机对抗
-- 执行：psql -v ON_ERROR_STOP=1 -f 021_team_market_research_ai.sql

CREATE TABLE teacher_personal_class_team_market_personas (
  id          bigserial PRIMARY KEY,
  team_id     bigint NOT NULL REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  source      varchar(16) NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'ai')),
  created_by  bigint REFERENCES users (id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tpctmp_team_created
  ON teacher_personal_class_team_market_personas (team_id, created_at DESC);

CREATE TABLE teacher_personal_class_team_market_analysis (
  id            bigserial PRIMARY KEY,
  team_id       bigint NOT NULL UNIQUE REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  result        jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_by  bigint REFERENCES users (id) ON DELETE SET NULL,
  generated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tpctma_team
  ON teacher_personal_class_team_market_analysis (team_id);

CREATE TABLE teacher_personal_class_team_market_challenge_sessions (
  id              bigserial PRIMARY KEY,
  team_id         bigint NOT NULL REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  student_id      bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  project_info    jsonb NOT NULL DEFAULT '{}'::jsonb,
  selected_agents jsonb NOT NULL DEFAULT '[]'::jsonb,
  rounds          jsonb NOT NULL DEFAULT '[]'::jsonb,
  final_report    jsonb,
  status          varchar(16) NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz
);

CREATE INDEX idx_tpctmcs_team_student_created
  ON teacher_personal_class_team_market_challenge_sessions (team_id, student_id, created_at DESC);

CREATE INDEX idx_tpctmcs_team_created
  ON teacher_personal_class_team_market_challenge_sessions (team_id, created_at DESC);

-- 团队市场调研：队长上传调研报告（解锁下一实训环节）
-- 执行：psql -v ON_ERROR_STOP=1 -f 023_team_market_report_upload.sql

CREATE TABLE teacher_personal_class_team_market_report_uploads (
  id           bigserial PRIMARY KEY,
  team_id      bigint NOT NULL UNIQUE REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  uploaded_by  bigint NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  uploaded_at  timestamptz NOT NULL DEFAULT now(),
  payload      jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_tpctmru_team
  ON teacher_personal_class_team_market_report_uploads (team_id);

CREATE TABLE teacher_personal_class_team_product_context (
  id           bigserial PRIMARY KEY,
  team_id      bigint NOT NULL UNIQUE REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  context_text text NOT NULL DEFAULT '',
  updated_by   bigint REFERENCES users (id) ON DELETE SET NULL,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE teacher_personal_class_team_product_ai_suggestions (
  id          bigserial PRIMARY KEY,
  team_id     bigint NOT NULL REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  student_id  bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tpctpas_team_student_created
  ON teacher_personal_class_team_product_ai_suggestions (team_id, student_id, created_at DESC);

CREATE TABLE teacher_personal_class_team_product_prototype_uploads (
  id           bigserial PRIMARY KEY,
  team_id      bigint NOT NULL UNIQUE REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  origin_name  varchar(255) NOT NULL,
  storage_path varchar(500) NOT NULL,
  mime_type    varchar(128),
  size_bytes   bigint NOT NULL DEFAULT 0,
  uploaded_by  bigint NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  uploaded_at  timestamptz NOT NULL DEFAULT now()
);


CREATE TABLE teacher_personal_class_team_business_model_workspace (
  team_id            bigint PRIMARY KEY REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  swot_json          jsonb NOT NULL DEFAULT '{}'::jsonb,
  marketing_json     jsonb NOT NULL DEFAULT '{}'::jsonb,
  finance_json       jsonb NOT NULL DEFAULT '{"costs":[],"revenues":[]}'::jsonb,
  swot_saved_at      timestamptz,
  marketing_saved_at timestamptz,
  finance_saved_at   timestamptz,
  war_room_canvas_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  war_room_transcript_json jsonb NOT NULL DEFAULT '{"messages":[],"roundCount":0}'::jsonb,
  war_room_updated_at timestamptz,
  bmc_canvas_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  bmc_canvas_generated_at timestamptz,
  bmc_canvas_saved_at timestamptz,
  bmc_canvas_saved_by bigint REFERENCES users (id) ON DELETE SET NULL,
  bmc_review_status varchar(32) NOT NULL DEFAULT 'draft',
  bmc_review_comment text NOT NULL DEFAULT '',
  bmc_reviewed_at timestamptz,
  bmc_reviewed_by bigint REFERENCES users (id) ON DELETE SET NULL,
  updated_by         bigint REFERENCES users (id) ON DELETE SET NULL,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tpctbm_workspace_updated ON teacher_personal_class_team_business_model_workspace (updated_at DESC);

CREATE TABLE teacher_personal_class_team_bmc_cell_locks (
  team_id       bigint NOT NULL REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  cell_key      varchar(64) NOT NULL,
  locked_by     bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  locked_at     timestamptz NOT NULL DEFAULT now(),
  heartbeat_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, cell_key)
);

CREATE INDEX idx_bmc_cell_locks_team_user
  ON teacher_personal_class_team_bmc_cell_locks (team_id, locked_by);

CREATE TABLE teacher_personal_class_team_bmc_ai_reviews (
  id              bigserial PRIMARY KEY,
  team_id         bigint NOT NULL REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  teacher_personal_class_id bigint NOT NULL REFERENCES teacher_personal_classes (id) ON DELETE CASCADE,
  submitted_by    bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  self_note       text NOT NULL DEFAULT '',
  canvas_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_result       jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_score        numeric(5,2),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bmc_ai_reviews_team_created
  ON teacher_personal_class_team_bmc_ai_reviews (team_id, created_at DESC);

CREATE INDEX idx_bmc_ai_reviews_class_created
  ON teacher_personal_class_team_bmc_ai_reviews (teacher_personal_class_id, created_at DESC);

-- SWOT / 营销 / 成本：多轮 AI 审查（与画布审查表分离）
CREATE TABLE teacher_personal_class_team_bm_section_ai_reviews (
  id              bigserial PRIMARY KEY,
  team_id         bigint NOT NULL REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  teacher_personal_class_id bigint NOT NULL REFERENCES teacher_personal_classes (id) ON DELETE CASCADE,
  section         varchar(32) NOT NULL,
  submitted_by    bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  self_note       text NOT NULL DEFAULT '',
  content_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_result       jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_score        numeric(5,2),
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bm_section_ai_reviews_section_check
    CHECK (section IN ('swot', 'marketing', 'finance'))
);

CREATE INDEX idx_bm_section_ai_reviews_team_section_created
  ON teacher_personal_class_team_bm_section_ai_reviews (team_id, section, created_at DESC);

CREATE INDEX idx_bm_section_ai_reviews_class_created
  ON teacher_personal_class_team_bm_section_ai_reviews (teacher_personal_class_id, created_at DESC);

-- 虚拟董事会：按组员独立草稿 + 每人最新保存记录
-- 执行：psql -v ON_ERROR_STOP=1 -f 028_war_room_member.sql

CREATE TABLE teacher_personal_class_team_war_room_member (
  team_id         bigint NOT NULL REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  student_id      bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  canvas_json     jsonb NOT NULL DEFAULT '{}'::jsonb,
  transcript_json jsonb NOT NULL DEFAULT '{"messages":[],"roundCount":0}'::jsonb,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, student_id)
);

CREATE INDEX idx_tpctwrm_team ON teacher_personal_class_team_war_room_member (team_id);

CREATE TABLE teacher_personal_class_team_war_room_saved_record (
  team_id     bigint NOT NULL REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  student_id  bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  canvas_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  saved_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, student_id)
);

CREATE INDEX idx_tpctwrsr_team_saved ON teacher_personal_class_team_war_room_saved_record (team_id, saved_at DESC);

-- 角色仿真模拟运行快照记录

CREATE TABLE teacher_personal_class_team_role_simulation_run_records (
  id BIGSERIAL PRIMARY KEY,
  teacher_personal_class_id BIGINT NOT NULL,
  team_id BIGINT NOT NULL,
  student_id BIGINT NOT NULL,

  -- 该成员第 N 次模拟（用于“首次不计”的轮次统计）
  run_index INT NOT NULL,

  -- 本次模拟的输入配置（商业模型/基础参数/渠道分配等）
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- 30 天逐日数据与最终汇总（实时追踪页面所需数据）
  tracking_json JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- 迭代优化建议、方案对比等
  optimize_json JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- 思考过程（最多5行），可选存储
  thinking_log_json JSONB NOT NULL DEFAULT '[]'::jsonb,

  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_role_sim_run_records_team_student
  ON teacher_personal_class_team_role_simulation_run_records (team_id, student_id, created_at DESC);

CREATE INDEX idx_role_sim_run_records_class_team
  ON teacher_personal_class_team_role_simulation_run_records (teacher_personal_class_id, team_id, created_at DESC);


-- 商业计划书要点：团队工作区、版本、AI 分析、最终提交与审核
-- 执行：psql -v ON_ERROR_STOP=1 -f 032_team_business_plan.sql

CREATE TABLE teacher_personal_class_team_business_plan_workspace (
  team_id                      bigint PRIMARY KEY REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  teacher_personal_class_id    bigint NOT NULL REFERENCES teacher_personal_classes (id) ON DELETE CASCADE,
  sections_json                jsonb NOT NULL DEFAULT '[]'::jsonb,
  cover_json                   jsonb NOT NULL DEFAULT '{}'::jsonb,
  revision                     int NOT NULL DEFAULT 1,
  updated_at                   timestamptz NOT NULL DEFAULT now(),
  updated_by                   bigint REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX idx_bp_workspace_class ON teacher_personal_class_team_business_plan_workspace (teacher_personal_class_id);

CREATE TABLE teacher_personal_class_team_business_plan_section_locks (
  team_id       bigint NOT NULL REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  section_key   varchar(128) NOT NULL,
  locked_by     bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  locked_at     timestamptz NOT NULL DEFAULT now(),
  heartbeat_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, section_key)
);

CREATE INDEX idx_bp_section_locks_holder
  ON teacher_personal_class_team_business_plan_section_locks (locked_by, heartbeat_at DESC);

CREATE INDEX idx_bp_section_locks_heartbeat
  ON teacher_personal_class_team_business_plan_section_locks (team_id, heartbeat_at DESC);

CREATE TABLE teacher_personal_class_team_business_plan_versions (
  id           bigserial PRIMARY KEY,
  team_id      bigint NOT NULL REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  version_no   int NOT NULL,
  summary      varchar(500) NOT NULL DEFAULT '',
  sections_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  cover_json   jsonb NOT NULL DEFAULT '{}'::jsonb,
  saved_by     bigint REFERENCES users (id) ON DELETE SET NULL,
  saved_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, version_no)
);

CREATE INDEX idx_bp_versions_team ON teacher_personal_class_team_business_plan_versions (team_id, version_no DESC);

CREATE TABLE teacher_personal_class_team_business_plan_analyses (
  id           bigserial PRIMARY KEY,
  team_id      bigint NOT NULL REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  version_id   bigint NOT NULL REFERENCES teacher_personal_class_team_business_plan_versions (id) ON DELETE CASCADE,
  result_text  text NOT NULL DEFAULT '',
  created_by   bigint REFERENCES users (id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bp_analyses_team ON teacher_personal_class_team_business_plan_analyses (team_id, created_at DESC);

CREATE TABLE teacher_personal_class_team_business_plan_submissions (
  id           bigserial PRIMARY KEY,
  team_id      bigint NOT NULL UNIQUE REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  teacher_personal_class_id bigint NOT NULL REFERENCES teacher_personal_classes (id) ON DELETE CASCADE,
  version_id   bigint NOT NULL REFERENCES teacher_personal_class_team_business_plan_versions (id) ON DELETE RESTRICT,
  status       varchar(32) NOT NULL DEFAULT 'pending',
  submitted_by bigint REFERENCES users (id) ON DELETE SET NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  review_comment text NOT NULL DEFAULT '',
  score_json   jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_score  int,
  reviewed_by  bigint REFERENCES users (id) ON DELETE SET NULL,
  reviewed_at  timestamptz
);

CREATE INDEX idx_bp_submissions_class_status
  ON teacher_personal_class_team_business_plan_submissions (teacher_personal_class_id, status);

-- 商业计划书最终提交：附件资料（PPT 必传 + 可选其他附件）
-- 执行：psql -v ON_ERROR_STOP=1 -f 033_team_business_plan_attachments.sql

CREATE TABLE teacher_personal_class_team_business_plan_submission_attachments (
  id            bigserial PRIMARY KEY,
  submission_id bigint NOT NULL REFERENCES teacher_personal_class_team_business_plan_submissions (id) ON DELETE CASCADE,
  storage_key   text NOT NULL,
  file_name     varchar(512) NOT NULL,
  file_size     bigint NOT NULL DEFAULT 0,
  mime_type     varchar(128) NOT NULL DEFAULT '',
  ext           varchar(16) NOT NULL DEFAULT '',
  is_ppt        boolean NOT NULL DEFAULT false,
  sort_order    int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bp_submit_attach_submission
  ON teacher_personal_class_team_business_plan_submission_attachments (submission_id, sort_order, id);


-- 邮箱验证码：用于邮箱绑定/修改、忘记密码
-- 执行：psql -v ON_ERROR_STOP=1 -f 035_email_verification_codes.sql

CREATE TABLE email_verification_codes (
  id bigserial PRIMARY KEY,
  role varchar(16) NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
  user_id bigint REFERENCES users (id) ON DELETE CASCADE,
  email varchar(255),
  phone varchar(32),
  purpose varchar(32) NOT NULL CHECK (purpose IN ('bind_email', 'bind_phone', 'reset_password', 'change_password')),
  code_hash varchar(200) NOT NULL,
  try_count int NOT NULL DEFAULT 0,
  sent_at timestamptz,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_verification_codes_contact_check CHECK (
    (email IS NOT NULL AND length(trim(email)) > 0)
    OR (phone IS NOT NULL AND length(trim(phone)) > 0)
  )
);

CREATE INDEX idx_evc_lookup ON email_verification_codes (role, purpose, email, created_at DESC);
CREATE INDEX idx_evc_phone_lookup ON email_verification_codes (role, purpose, phone, created_at DESC)
  WHERE phone IS NOT NULL;
CREATE INDEX idx_evc_user ON email_verification_codes (user_id, created_at DESC);


CREATE TABLE teacher_guidance_attachments (
  id              bigserial PRIMARY KEY,
  batch_id        uuid NOT NULL,
  teacher_personal_class_id bigint NOT NULL REFERENCES teacher_personal_classes (id) ON DELETE CASCADE,
  storage_key     varchar(512) NOT NULL,
  file_name       varchar(255) NOT NULL,
  file_size       bigint NOT NULL,
  sort_order      int NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_teacher_guidance_attachments_batch
  ON teacher_guidance_attachments (batch_id);

CREATE TABLE teacher_guidance_history (
  id                        bigserial PRIMARY KEY,
  teacher_personal_class_id bigint NOT NULL REFERENCES teacher_personal_classes (id) ON DELETE CASCADE,
  teacher_id                bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  source_message_id         bigint,
  guidance_batch_id         uuid,
  guidance_type             varchar(32) NOT NULL,
  target_label              varchar(255) NOT NULL DEFAULT '',
  content                   text NOT NULL DEFAULT '',
  target_scope              varchar(16) NOT NULL DEFAULT 'all',
  team_id                   bigint,
  student_id                bigint,
  urgency                   varchar(16) DEFAULT 'normal',
  recipient_count           int NOT NULL DEFAULT 0,
  read_count                int NOT NULL DEFAULT 0,
  sent_at                   timestamptz NOT NULL DEFAULT now(),
  withdrawn_at              timestamptz,
  makeup_deadline           timestamptz
);

CREATE INDEX idx_teacher_guidance_history_class_sent
  ON teacher_guidance_history (teacher_personal_class_id, sent_at DESC);

-- ---------------------------------------------------------------------------
-- 创世纪 EconoVerse：学生一人一档云存档
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS econoverse_saves (
  student_id bigint PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  state      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_econoverse_saves_updated_at
  ON econoverse_saves (updated_at DESC);

-- ---------------------------------------------------------------------------
-- 创世纪 EconoVerse：按教师个性化班发布地图/节奏
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS econoverse_class_rooms (
  teacher_personal_class_id bigint PRIMARY KEY
    REFERENCES teacher_personal_classes (id) ON DELETE CASCADE,
  teacher_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  map_layout jsonb,
  session_config jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_econoverse_class_rooms_teacher
  ON econoverse_class_rooms (teacher_id);

-- 实训助教知识库与对话（预设数据见 migrations/0054_ai_tutor_kb.sql）
CREATE TABLE IF NOT EXISTS ai_tutor_kb_entries (
  id          bigserial PRIMARY KEY,
  category    varchar(64) NOT NULL DEFAULT '',
  audience    varchar(16) NOT NULL DEFAULT 'both'
    CHECK (audience IN ('student', 'teacher', 'both')),
  question    text NOT NULL,
  answer      text NOT NULL,
  is_preset   boolean NOT NULL DEFAULT false,
  sort_order  int NOT NULL DEFAULT 0,
  enabled     boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_tutor_kb_audience
  ON ai_tutor_kb_entries (audience, enabled, sort_order);

CREATE TABLE IF NOT EXISTS ai_tutor_messages (
  id          bigserial PRIMARY KEY,
  user_id     bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role        varchar(16) NOT NULL CHECK (role IN ('user', 'assistant')),
  content     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_tutor_messages_user
  ON ai_tutor_messages (user_id, id DESC);

-- 教师教学演示上传文件。与学生作业、原型、计划书附件分开，管理员只清理这张表和演示目录。
CREATE TABLE IF NOT EXISTS teacher_class_demo_files (
  id bigserial PRIMARY KEY,
  teacher_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  teacher_personal_class_id bigint REFERENCES teacher_personal_classes (id) ON DELETE SET NULL,
  college_id bigint,
  major_id bigint,
  college_name varchar(128) NOT NULL DEFAULT '',
  major_name varchar(128) NOT NULL DEFAULT '',
  teacher_name varchar(128) NOT NULL DEFAULT '',
  teacher_username varchar(128) NOT NULL DEFAULT '',
  class_name varchar(128) NOT NULL DEFAULT '',
  origin_name varchar(512) NOT NULL,
  stored_name varchar(128) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teacher_class_demo_files_created
  ON teacher_class_demo_files (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_teacher_class_demo_files_teacher
  ON teacher_class_demo_files (teacher_id);

