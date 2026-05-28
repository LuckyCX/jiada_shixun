-- 商业计划书要点：团队工作区、版本、AI 分析、最终提交与审核
-- 执行：psql -v ON_ERROR_STOP=1 -f 032_team_business_plan.sql

SET client_encoding = 'UTF8';

CREATE TABLE IF NOT EXISTS teacher_personal_class_team_business_plan_workspace (
  team_id                      bigint PRIMARY KEY REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  teacher_personal_class_id    bigint NOT NULL REFERENCES teacher_personal_classes (id) ON DELETE CASCADE,
  sections_json                jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at                   timestamptz NOT NULL DEFAULT now(),
  updated_by                   bigint REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_bp_workspace_class ON teacher_personal_class_team_business_plan_workspace (teacher_personal_class_id);

CREATE TABLE IF NOT EXISTS teacher_personal_class_team_business_plan_versions (
  id           bigserial PRIMARY KEY,
  team_id      bigint NOT NULL REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  version_no   int NOT NULL,
  summary      varchar(500) NOT NULL DEFAULT '',
  sections_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  saved_by     bigint REFERENCES users (id) ON DELETE SET NULL,
  saved_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, version_no)
);

CREATE INDEX IF NOT EXISTS idx_bp_versions_team ON teacher_personal_class_team_business_plan_versions (team_id, version_no DESC);

CREATE TABLE IF NOT EXISTS teacher_personal_class_team_business_plan_analyses (
  id           bigserial PRIMARY KEY,
  team_id      bigint NOT NULL REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  version_id   bigint NOT NULL REFERENCES teacher_personal_class_team_business_plan_versions (id) ON DELETE CASCADE,
  result_text  text NOT NULL DEFAULT '',
  created_by   bigint REFERENCES users (id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bp_analyses_team ON teacher_personal_class_team_business_plan_analyses (team_id, created_at DESC);

CREATE TABLE IF NOT EXISTS teacher_personal_class_team_business_plan_submissions (
  id           bigserial PRIMARY KEY,
  team_id      bigint NOT NULL UNIQUE REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  teacher_personal_class_id bigint NOT NULL REFERENCES teacher_personal_classes (id) ON DELETE CASCADE,
  version_id   bigint NOT NULL REFERENCES teacher_personal_class_team_business_plan_versions (id) ON DELETE RESTRICT,
  status       varchar(32) NOT NULL DEFAULT 'pending',
  submitted_by bigint REFERENCES users (id) ON DELETE SET NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  review_comment text NOT NULL DEFAULT '',
  reviewed_by  bigint REFERENCES users (id) ON DELETE SET NULL,
  reviewed_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_bp_submissions_class_status
  ON teacher_personal_class_team_business_plan_submissions (teacher_personal_class_id, status);
