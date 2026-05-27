-- 商业模式设计：小组共享 SWOT / 4P / 财务 workspace
-- 执行：psql -v ON_ERROR_STOP=1 -f 026_business_model_workspace.sql

SET client_encoding = 'UTF8';

CREATE TABLE IF NOT EXISTS teacher_personal_class_team_business_model_workspace (
  team_id            bigint PRIMARY KEY REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  swot_json          jsonb NOT NULL DEFAULT '{}'::jsonb,
  marketing_json     jsonb NOT NULL DEFAULT '{}'::jsonb,
  finance_json       jsonb NOT NULL DEFAULT '{"costs":[],"revenues":[]}'::jsonb,
  swot_saved_at      timestamptz,
  marketing_saved_at timestamptz,
  finance_saved_at   timestamptz,
  updated_by         bigint REFERENCES users (id) ON DELETE SET NULL,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tpctbm_workspace_updated ON teacher_personal_class_team_business_model_workspace (updated_at DESC);
