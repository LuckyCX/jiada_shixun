-- 问卷回收截止时间
-- 执行：psql -v ON_ERROR_STOP=1 -f 022_survey_closes_at.sql

SET client_encoding = 'UTF8';

ALTER TABLE teacher_personal_class_team_surveys
  ADD COLUMN IF NOT EXISTS closes_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_tpcts_team_closes
  ON teacher_personal_class_team_surveys (team_id, closes_at)
  WHERE closes_at IS NOT NULL;
