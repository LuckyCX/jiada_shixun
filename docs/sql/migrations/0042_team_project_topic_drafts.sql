-- 团队项目选题表单草稿（每队一条，保存时覆盖）
-- 执行：psql -v ON_ERROR_STOP=1 -f 0042_team_project_topic_drafts.sql

SET client_encoding = 'UTF8';

CREATE TABLE IF NOT EXISTS teacher_personal_class_team_project_topic_drafts (
  id                         bigserial PRIMARY KEY,
  teacher_personal_class_id  bigint NOT NULL REFERENCES teacher_personal_classes (id) ON DELETE CASCADE,
  team_id                    bigint NOT NULL REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  saved_by                   bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  project_name               varchar(256) NOT NULL DEFAULT '',
  project_direction          varchar(128) NOT NULL DEFAULT '',
  project_description        text NOT NULL DEFAULT '',
  core_value                 text NOT NULL DEFAULT '',
  target_users               text NOT NULL DEFAULT '',
  core_problem               text NOT NULL DEFAULT '',
  solution_overview          text NOT NULL DEFAULT '',
  market_size                text NOT NULL DEFAULT '',
  competitive_advantage      text NOT NULL DEFAULT '',
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id)
);

CREATE INDEX IF NOT EXISTS idx_tpctptd_team
  ON teacher_personal_class_team_project_topic_drafts (team_id);

DROP TRIGGER IF EXISTS trg_tpctptd_updated_at ON teacher_personal_class_team_project_topic_drafts;

CREATE TRIGGER trg_tpctptd_updated_at
  BEFORE UPDATE ON teacher_personal_class_team_project_topic_drafts
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();
