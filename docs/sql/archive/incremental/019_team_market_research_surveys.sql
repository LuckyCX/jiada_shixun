-- 团队市场调研：线上问卷
-- 执行：psql -v ON_ERROR_STOP=1 -f 019_team_market_research_surveys.sql

SET client_encoding = 'UTF8';

CREATE TABLE IF NOT EXISTS teacher_personal_class_team_surveys (
  id               bigserial PRIMARY KEY,
  team_id          bigint NOT NULL REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  title            varchar(512) NOT NULL DEFAULT '',
  status           varchar(32) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'withdrawn')),
  collected_count  int NOT NULL DEFAULT 0,
  public_slug      varchar(64) UNIQUE,
  source           varchar(16) NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'ai')),
  created_by       bigint REFERENCES users (id) ON DELETE SET NULL,
  published_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tpcts_team_created
  ON teacher_personal_class_team_surveys (team_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tpcts_public_slug
  ON teacher_personal_class_team_surveys (public_slug)
  WHERE public_slug IS NOT NULL;

DROP TRIGGER IF EXISTS trg_tpcts_updated_at ON teacher_personal_class_team_surveys;

CREATE TRIGGER trg_tpcts_updated_at
  BEFORE UPDATE ON teacher_personal_class_team_surveys
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();

CREATE TABLE IF NOT EXISTS teacher_personal_class_team_survey_questions (
  id              bigserial PRIMARY KEY,
  survey_id       bigint NOT NULL REFERENCES teacher_personal_class_team_surveys (id) ON DELETE CASCADE,
  question_text   text NOT NULL,
  question_type   varchar(32) NOT NULL
    CHECK (question_type IN ('单选', '多选', '评分', '填空')),
  options         jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order      int NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_tpctsq_survey_order
  ON teacher_personal_class_team_survey_questions (survey_id, sort_order);

CREATE TABLE IF NOT EXISTS teacher_personal_class_team_survey_responses (
  id           bigserial PRIMARY KEY,
  survey_id    bigint NOT NULL REFERENCES teacher_personal_class_team_surveys (id) ON DELETE CASCADE,
  answers      jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tpctsr_survey_submitted
  ON teacher_personal_class_team_survey_responses (survey_id, submitted_at DESC);
