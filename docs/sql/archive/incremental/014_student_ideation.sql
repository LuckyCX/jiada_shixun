-- 学生端创新方法工具：团队共享创意库、点赞与讨论
-- 执行：psql -v ON_ERROR_STOP=1 -f 014_student_ideation.sql

SET client_encoding = 'UTF8';

CREATE TABLE IF NOT EXISTS teacher_personal_class_team_ideas (
  id          bigserial PRIMARY KEY,
  team_id     bigint NOT NULL REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  method_key  varchar(32) NOT NULL
    CHECK (method_key IN ('brainstorm', 'scamper', 'triz', 'ai')),
  method_name varchar(64) NOT NULL,
  title       varchar(256) NOT NULL,
  description text NOT NULL DEFAULT '',
  form_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_analysis  jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tpcti_team_created
  ON teacher_personal_class_team_ideas (team_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_tpcti_updated_at ON teacher_personal_class_team_ideas;

CREATE TRIGGER trg_tpcti_updated_at
  BEFORE UPDATE ON teacher_personal_class_team_ideas
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();

CREATE TABLE IF NOT EXISTS teacher_personal_class_team_idea_likes (
  idea_id    bigint NOT NULL REFERENCES teacher_personal_class_team_ideas (id) ON DELETE CASCADE,
  student_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (idea_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_tpctil_student
  ON teacher_personal_class_team_idea_likes (student_id);

CREATE TABLE IF NOT EXISTS teacher_personal_class_team_discussions (
  id         bigserial PRIMARY KEY,
  team_id    bigint NOT NULL REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  student_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  content    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tpctd_team_created
  ON teacher_personal_class_team_discussions (team_id, created_at DESC);
