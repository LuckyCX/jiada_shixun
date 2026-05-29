-- 问卷答卷匿名标识
SET client_encoding = 'UTF8';

ALTER TABLE teacher_personal_class_team_survey_responses
  ADD COLUMN IF NOT EXISTS respondent_token varchar(64) NOT NULL DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_tpctsr_survey_respondent_token
  ON teacher_personal_class_team_survey_responses (survey_id, respondent_token)
  WHERE respondent_token <> '';
