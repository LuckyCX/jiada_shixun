-- 教师个人班级课程设置：阶段截止时间与提醒规则
-- 执行：psql -v ON_ERROR_STOP=1 -f 015_course_settings.sql

SET client_encoding = 'UTF8';

CREATE TABLE IF NOT EXISTS teacher_personal_class_course_settings (
  id                         bigserial PRIMARY KEY,
  teacher_personal_class_id  bigint NOT NULL REFERENCES teacher_personal_classes (id) ON DELETE CASCADE,
  teacher_id                 bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  module_key                 varchar(32) NOT NULL,
  start_date                 date,
  deadline_date              date,
  duration_days              int NOT NULL DEFAULT 0,
  reminder_days              int NOT NULL DEFAULT 3,
  reminder_enabled           boolean NOT NULL DEFAULT true,
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

CREATE INDEX IF NOT EXISTS idx_tpc_course_settings_class
  ON teacher_personal_class_course_settings (teacher_personal_class_id, module_key);

CREATE INDEX IF NOT EXISTS idx_tpc_course_settings_reminder
  ON teacher_personal_class_course_settings (deadline_date, reminder_enabled, last_reminded_deadline);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_tpc_course_settings_updated_at'
  ) THEN
    CREATE TRIGGER trg_tpc_course_settings_updated_at
      BEFORE UPDATE ON teacher_personal_class_course_settings
      FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();
  END IF;
END $$;
