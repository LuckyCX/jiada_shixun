-- 教师个性化教学班：团队项目选题提交与审核
-- 执行：psql -v ON_ERROR_STOP=1 -f 017_team_project_topics.sql

SET client_encoding = 'UTF8';

CREATE TABLE IF NOT EXISTS teacher_personal_class_team_project_topics (
  id                         bigserial PRIMARY KEY,
  teacher_personal_class_id  bigint NOT NULL REFERENCES teacher_personal_classes (id) ON DELETE CASCADE,
  team_id                    bigint NOT NULL REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  submitted_by               bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  project_name               varchar(256) NOT NULL,
  project_direction          varchar(128) NOT NULL,
  project_description        text NOT NULL DEFAULT '',
  core_value                 text NOT NULL DEFAULT '',
  target_users               text NOT NULL DEFAULT '',
  core_problem               text NOT NULL DEFAULT '',
  solution_overview          text NOT NULL DEFAULT '',
  market_size                text NOT NULL DEFAULT '',
  competitive_advantage      text NOT NULL DEFAULT '',
  status                     varchar(16) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  review_comment             text NOT NULL DEFAULT '',
  reviewed_by                bigint REFERENCES users (id) ON DELETE SET NULL,
  reviewed_at                timestamptz,
  submitted_at               timestamptz NOT NULL DEFAULT now(),
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id)
);

CREATE INDEX IF NOT EXISTS idx_tpctpt_class_status
  ON teacher_personal_class_team_project_topics (teacher_personal_class_id, status, submitted_at DESC);

DROP TRIGGER IF EXISTS trg_tpctpt_updated_at ON teacher_personal_class_team_project_topics;

CREATE TRIGGER trg_tpctpt_updated_at
  BEFORE UPDATE ON teacher_personal_class_team_project_topics
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();
