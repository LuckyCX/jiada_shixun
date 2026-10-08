-- 课程设置：实训环节可略过
-- 执行：psql -v ON_ERROR_STOP=1 -f docs/sql/migrations/0053_course_settings_skipped.sql

ALTER TABLE teacher_personal_class_course_settings
  ADD COLUMN IF NOT EXISTS skipped boolean NOT NULL DEFAULT false;

-- 组队环节不允许略过
UPDATE teacher_personal_class_course_settings
SET skipped = false
WHERE module_key = 'team' AND skipped = true;
