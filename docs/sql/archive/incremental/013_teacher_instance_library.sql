-- 教师实例库：方向、实例、独立附件资源
-- 执行：psql -v ON_ERROR_STOP=1 -f 013_teacher_instance_library.sql

SET client_encoding = 'UTF8';

CREATE TABLE IF NOT EXISTS teacher_instance_library_categories (
  id          bigserial PRIMARY KEY,
  teacher_id  bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name        varchar(128) NOT NULL,
  icon        varchar(128) NOT NULL DEFAULT 'FolderOutlined',
  color       varchar(128) NOT NULL DEFAULT '#8b5cf6',
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teacher_instance_categories_teacher
  ON teacher_instance_library_categories (teacher_id, sort_order, id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_teacher_instance_categories_updated_at'
  ) THEN
    CREATE TRIGGER trg_teacher_instance_categories_updated_at
      BEFORE UPDATE ON teacher_instance_library_categories
      FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS teacher_instance_library_cases (
  id              bigserial PRIMARY KEY,
  teacher_id      bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  category_id     bigint NOT NULL REFERENCES teacher_instance_library_categories (id) ON DELETE CASCADE,
  title           varchar(200) NOT NULL,
  detail_html     text NOT NULL DEFAULT '',
  tags            jsonb NOT NULL DEFAULT '[]'::jsonb,
  project_outcome text NOT NULL DEFAULT '',
  sort_order      int NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teacher_instance_cases_category
  ON teacher_instance_library_cases (teacher_id, category_id, sort_order, id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_teacher_instance_cases_updated_at'
  ) THEN
    CREATE TRIGGER trg_teacher_instance_cases_updated_at
      BEFORE UPDATE ON teacher_instance_library_cases
      FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS teacher_instance_library_resources (
  id            bigserial PRIMARY KEY,
  case_id       bigint NOT NULL REFERENCES teacher_instance_library_cases (id) ON DELETE CASCADE,
  usage         varchar(32) NOT NULL DEFAULT 'attachment'
    CHECK (usage IN ('attachment', 'inline')),
  origin_name   varchar(255) NOT NULL,
  storage_name  varchar(255) NOT NULL,
  storage_path  varchar(500) NOT NULL,
  mime_type     varchar(128),
  size_bytes    bigint NOT NULL DEFAULT 0,
  resource_type varchar(32) NOT NULL DEFAULT 'file',
  uploaded_by   bigint REFERENCES users (id) ON DELETE SET NULL,
  sort_order    int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teacher_instance_resources_case
  ON teacher_instance_library_resources (case_id, usage, sort_order, id);
