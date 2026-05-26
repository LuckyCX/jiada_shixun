-- 实训任务收集型提交：是否要求学生反馈附件、学生提交附件
-- 执行：psql -v ON_ERROR_STOP=1 -f 016_task_collection_submissions.sql

SET client_encoding = 'UTF8';

ALTER TABLE teacher_personal_class_tasks
  ADD COLUMN IF NOT EXISTS requires_student_attachment boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS student_personal_class_task_completion_attachments (
  id          bigserial PRIMARY KEY,
  task_id     bigint NOT NULL REFERENCES teacher_personal_class_tasks (id) ON DELETE CASCADE,
  student_id  bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  storage_key text NOT NULL,
  file_name   varchar(512) NOT NULL,
  file_size   bigint NOT NULL DEFAULT 0,
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_spctca_task_student
  ON student_personal_class_task_completion_attachments (task_id, student_id, sort_order, id);
