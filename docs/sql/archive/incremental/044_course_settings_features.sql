-- 课程环节功能开关
ALTER TABLE teacher_personal_class_course_settings
  ADD COLUMN IF NOT EXISTS features_json jsonb NOT NULL DEFAULT '{}'::jsonb;
