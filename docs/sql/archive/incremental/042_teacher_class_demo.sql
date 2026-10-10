-- 教师教学演示上传文件。只记演示目录中的文件，不挂学生业务表。
-- 执行：psql -v ON_ERROR_STOP=1 -f 042_teacher_class_demo.sql

SET client_encoding = 'UTF8';

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
