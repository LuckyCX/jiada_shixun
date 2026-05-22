-- 教师个性化教学班：AI 组队 draft/confirmed
-- 执行：psql -v ON_ERROR_STOP=1 -f 007_personal_class_teams.sql

CREATE TABLE teacher_personal_class_teams (
  id bigserial PRIMARY KEY,
  teacher_personal_class_id bigint NOT NULL REFERENCES teacher_personal_classes (id) ON DELETE CASCADE,
  name varchar(128) NOT NULL,
  grouping_status varchar(24) NOT NULL DEFAULT 'draft'
    CHECK (grouping_status IN ('draft', 'confirmed')),
  complement_score numeric(5,2),
  ai_rationale text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tpct_class_status ON teacher_personal_class_teams (teacher_personal_class_id, grouping_status);

CREATE TRIGGER trg_tpct_updated_at BEFORE UPDATE ON teacher_personal_class_teams
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();

CREATE TABLE teacher_personal_class_team_members (
  id bigserial PRIMARY KEY,
  team_id bigint NOT NULL REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  student_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  ai_matched_role varchar(32),
  dimension_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, student_id)
);

CREATE INDEX idx_tpctm_team ON teacher_personal_class_team_members (team_id);
CREATE INDEX idx_tpctm_student ON teacher_personal_class_team_members (student_id);
