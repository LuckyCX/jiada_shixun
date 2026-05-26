-- 教师个性化班级实训任务
-- 执行：psql -v ON_ERROR_STOP=1 -f 010_personal_class_tasks.sql

SET client_encoding = 'UTF8';

CREATE TABLE teacher_personal_class_tasks (
  id                   bigserial PRIMARY KEY,
  teacher_personal_class_id bigint NOT NULL REFERENCES teacher_personal_classes (id) ON DELETE CASCADE,
  teacher_id           bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title                varchar(256) NOT NULL,
  description          text NOT NULL DEFAULT '',
  module               varchar(64) NOT NULL,
  priority             varchar(16) NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
  deadline             date NOT NULL,
  scope                varchar(16) NOT NULL DEFAULT 'all'
    CHECK (scope IN ('all', 'specific')),
  status               varchar(16) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published')),
  attachments_enabled  boolean NOT NULL DEFAULT false,
  resource_link_enabled boolean NOT NULL DEFAULT false,
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
