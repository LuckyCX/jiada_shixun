-- 团队市场调研：调研计划与方法数据上传
-- 执行：psql -v ON_ERROR_STOP=1 -f 018_team_market_research.sql

SET client_encoding = 'UTF8';

CREATE TABLE IF NOT EXISTS teacher_personal_class_team_market_research_plans (
  id               bigserial PRIMARY KEY,
  team_id          bigint NOT NULL UNIQUE REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  goal             text NOT NULL DEFAULT '',
  methods          jsonb NOT NULL DEFAULT '[]'::jsonb,
  plan_start_date  date,
  plan_end_date    date,
  assignments      jsonb NOT NULL DEFAULT '[]'::jsonb,
  saved_by         bigint REFERENCES users (id) ON DELETE SET NULL,
  saved_at         timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tpctmrp_team
  ON teacher_personal_class_team_market_research_plans (team_id);

DROP TRIGGER IF EXISTS trg_tpctmrp_updated_at ON teacher_personal_class_team_market_research_plans;

CREATE TRIGGER trg_tpctmrp_updated_at
  BEFORE UPDATE ON teacher_personal_class_team_market_research_plans
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();

CREATE TABLE IF NOT EXISTS teacher_personal_class_team_market_research_uploads (
  id                bigserial PRIMARY KEY,
  team_id           bigint NOT NULL REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  method            varchar(32) NOT NULL
    CHECK (method IN ('用户访谈', '竞品分析', '行业报告', '数据爬取', '实地观察')),
  original_filename varchar(512) NOT NULL,
  storage_key       varchar(1024) NOT NULL,
  mime_type         varchar(128) NOT NULL DEFAULT '',
  file_size         bigint NOT NULL DEFAULT 0,
  uploaded_by       bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tpctmru_team_method_created
  ON teacher_personal_class_team_market_research_uploads (team_id, method, created_at DESC);
