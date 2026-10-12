-- 课程环节功能开关（JSONB，可按 module_key 扩展）
-- 执行：psql -v ON_ERROR_STOP=1 -f docs/sql/migrations/0058_course_settings_features.sql
ALTER TABLE teacher_personal_class_course_settings
  ADD COLUMN IF NOT EXISTS features_json jsonb NOT NULL DEFAULT '{}'::jsonb;
