-- 团队市场调研：队长上传调研报告（解锁下一实训环节）
-- 执行：psql -v ON_ERROR_STOP=1 -f 023_team_market_report_upload.sql

SET client_encoding = 'UTF8';

CREATE TABLE IF NOT EXISTS teacher_personal_class_team_market_report_uploads (
  id           bigserial PRIMARY KEY,
  team_id      bigint NOT NULL UNIQUE REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  uploaded_by  bigint NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  uploaded_at  timestamptz NOT NULL DEFAULT now(),
  payload      jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_tpctmru_team
  ON teacher_personal_class_team_market_report_uploads (team_id);
