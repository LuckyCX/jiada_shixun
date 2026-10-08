-- 商业计划书：封面元信息 + 教师六维评分
-- 执行：psql -v ON_ERROR_STOP=1 -f docs/sql/migrations/0052_business_plan_cover_scores.sql

ALTER TABLE teacher_personal_class_team_business_plan_workspace
  ADD COLUMN IF NOT EXISTS cover_json jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE teacher_personal_class_team_business_plan_versions
  ADD COLUMN IF NOT EXISTS cover_json jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE teacher_personal_class_team_business_plan_submissions
  ADD COLUMN IF NOT EXISTS score_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS total_score int;
