-- 团队市场调研：AI 分析、用户画像、人机对抗
-- 执行：psql -v ON_ERROR_STOP=1 -f 021_team_market_research_ai.sql

SET client_encoding = 'UTF8';

CREATE TABLE IF NOT EXISTS teacher_personal_class_team_market_personas (
  id          bigserial PRIMARY KEY,
  team_id     bigint NOT NULL REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  source      varchar(16) NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'ai')),
  created_by  bigint REFERENCES users (id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tpctmp_team_created
  ON teacher_personal_class_team_market_personas (team_id, created_at DESC);

CREATE TABLE IF NOT EXISTS teacher_personal_class_team_market_analysis (
  id            bigserial PRIMARY KEY,
  team_id       bigint NOT NULL UNIQUE REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  result        jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_by  bigint REFERENCES users (id) ON DELETE SET NULL,
  generated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tpctma_team
  ON teacher_personal_class_team_market_analysis (team_id);

CREATE TABLE IF NOT EXISTS teacher_personal_class_team_market_challenge_sessions (
  id              bigserial PRIMARY KEY,
  team_id         bigint NOT NULL REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  student_id      bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  project_info    jsonb NOT NULL DEFAULT '{}'::jsonb,
  selected_agents jsonb NOT NULL DEFAULT '[]'::jsonb,
  rounds          jsonb NOT NULL DEFAULT '[]'::jsonb,
  final_report    jsonb,
  status          varchar(16) NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_tpctmcs_team_student_created
  ON teacher_personal_class_team_market_challenge_sessions (team_id, student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tpctmcs_team_created
  ON teacher_personal_class_team_market_challenge_sessions (team_id, created_at DESC);
