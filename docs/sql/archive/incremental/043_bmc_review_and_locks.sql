-- 商业画布：教师审核状态、格锁、AI 审查记录
-- 执行：psql -v ON_ERROR_STOP=1 -f 043_bmc_review_and_locks.sql

SET client_encoding = 'UTF8';

ALTER TABLE teacher_personal_class_team_business_model_workspace
  ADD COLUMN IF NOT EXISTS bmc_review_status varchar(32) NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS bmc_review_comment text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bmc_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS bmc_reviewed_by bigint REFERENCES users (id) ON DELETE SET NULL;

COMMENT ON COLUMN teacher_personal_class_team_business_model_workspace.bmc_review_status IS
  'draft|pending|approved|rejected';

CREATE TABLE IF NOT EXISTS teacher_personal_class_team_bmc_cell_locks (
  team_id       bigint NOT NULL REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  cell_key      varchar(64) NOT NULL,
  locked_by     bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  locked_at     timestamptz NOT NULL DEFAULT now(),
  heartbeat_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, cell_key)
);

CREATE INDEX IF NOT EXISTS idx_bmc_cell_locks_team_user
  ON teacher_personal_class_team_bmc_cell_locks (team_id, locked_by);

CREATE TABLE IF NOT EXISTS teacher_personal_class_team_bmc_ai_reviews (
  id              bigserial PRIMARY KEY,
  team_id         bigint NOT NULL REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  teacher_personal_class_id bigint NOT NULL REFERENCES teacher_personal_classes (id) ON DELETE CASCADE,
  submitted_by    bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  self_note       text NOT NULL DEFAULT '',
  canvas_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_result       jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_score        numeric(5,2),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bmc_ai_reviews_team_created
  ON teacher_personal_class_team_bmc_ai_reviews (team_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bmc_ai_reviews_class_created
  ON teacher_personal_class_team_bmc_ai_reviews (teacher_personal_class_id, created_at DESC);
