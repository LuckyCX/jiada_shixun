-- 商业计划书协作：workspace revision 乐观锁 + 章节编辑锁
-- 执行：psql -v ON_ERROR_STOP=1 -f docs/sql/migrations/0047_business_plan_collab_locks.sql

ALTER TABLE teacher_personal_class_team_business_plan_workspace
  ADD COLUMN IF NOT EXISTS revision int NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS teacher_personal_class_team_business_plan_section_locks (
  team_id       bigint NOT NULL REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  section_key   varchar(128) NOT NULL,
  locked_by     bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  locked_at     timestamptz NOT NULL DEFAULT now(),
  heartbeat_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, section_key)
);

CREATE INDEX IF NOT EXISTS idx_bp_section_locks_holder
  ON teacher_personal_class_team_business_plan_section_locks (locked_by, heartbeat_at DESC);

CREATE INDEX IF NOT EXISTS idx_bp_section_locks_heartbeat
  ON teacher_personal_class_team_business_plan_section_locks (team_id, heartbeat_at DESC);
