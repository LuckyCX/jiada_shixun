-- SWOT / 营销 / 成本：多轮 AI 审查记录（与画布 bmc_ai_reviews 分离）
SET client_encoding = 'UTF8';

CREATE TABLE IF NOT EXISTS teacher_personal_class_team_bm_section_ai_reviews (
  id              bigserial PRIMARY KEY,
  team_id         bigint NOT NULL REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  teacher_personal_class_id bigint NOT NULL REFERENCES teacher_personal_classes (id) ON DELETE CASCADE,
  section         varchar(32) NOT NULL,
  submitted_by    bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  self_note       text NOT NULL DEFAULT '',
  content_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_result       jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_score        numeric(5,2),
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bm_section_ai_reviews_section_check
    CHECK (section IN ('swot', 'marketing', 'finance'))
);

COMMENT ON TABLE teacher_personal_class_team_bm_section_ai_reviews IS
  '商业模式 SWOT/营销/成本 AI 多轮审查';

CREATE INDEX IF NOT EXISTS idx_bm_section_ai_reviews_team_section_created
  ON teacher_personal_class_team_bm_section_ai_reviews (team_id, section, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bm_section_ai_reviews_class_created
  ON teacher_personal_class_team_bm_section_ai_reviews (teacher_personal_class_id, created_at DESC);
