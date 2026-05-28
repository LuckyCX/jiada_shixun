-- 虚拟董事会：按组员独立草稿 + 每人最新保存记录
-- 执行：psql -v ON_ERROR_STOP=1 -f 028_war_room_member.sql

SET client_encoding = 'UTF8';

CREATE TABLE IF NOT EXISTS teacher_personal_class_team_war_room_member (
  team_id         bigint NOT NULL REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  student_id      bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  canvas_json     jsonb NOT NULL DEFAULT '{}'::jsonb,
  transcript_json jsonb NOT NULL DEFAULT '{"messages":[],"roundCount":0}'::jsonb,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_tpctwrm_team ON teacher_personal_class_team_war_room_member (team_id);

CREATE TABLE IF NOT EXISTS teacher_personal_class_team_war_room_saved_record (
  team_id     bigint NOT NULL REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  student_id  bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  canvas_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  saved_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_tpctwrsr_team_saved ON teacher_personal_class_team_war_room_saved_record (team_id, saved_at DESC);
