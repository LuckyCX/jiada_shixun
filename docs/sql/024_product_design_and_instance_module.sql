-- 产品设计迭代 + 实例库按实训环节隔离
-- 执行：psql -v ON_ERROR_STOP=1 -f 024_product_design_and_instance_module.sql

SET client_encoding = 'UTF8';

ALTER TABLE teacher_instance_library_categories
  ADD COLUMN IF NOT EXISTS training_module_key varchar(32) NOT NULL DEFAULT 'ideation';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_instance_categories_module_key'
  ) THEN
    ALTER TABLE teacher_instance_library_categories
      ADD CONSTRAINT chk_instance_categories_module_key
      CHECK (training_module_key IN ('ideation', 'market', 'product', 'business', 'simulation', 'plan'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_teacher_instance_categories_teacher_module
  ON teacher_instance_library_categories (teacher_id, training_module_key, sort_order, id);

CREATE TABLE IF NOT EXISTS teacher_personal_class_team_product_context (
  id           bigserial PRIMARY KEY,
  team_id      bigint NOT NULL UNIQUE REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  context_text text NOT NULL DEFAULT '',
  updated_by   bigint REFERENCES users (id) ON DELETE SET NULL,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS teacher_personal_class_team_product_ai_suggestions (
  id          bigserial PRIMARY KEY,
  team_id     bigint NOT NULL REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  student_id  bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tpctpas_team_student_created
  ON teacher_personal_class_team_product_ai_suggestions (team_id, student_id, created_at DESC);

CREATE TABLE IF NOT EXISTS teacher_personal_class_team_product_prototype_uploads (
  id           bigserial PRIMARY KEY,
  team_id      bigint NOT NULL UNIQUE REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  origin_name  varchar(255) NOT NULL,
  storage_path varchar(500) NOT NULL,
  mime_type    varchar(128),
  size_bytes   bigint NOT NULL DEFAULT 0,
  uploaded_by  bigint NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  uploaded_at  timestamptz NOT NULL DEFAULT now()
);
