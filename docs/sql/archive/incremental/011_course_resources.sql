-- ---------------------------------------------------------------------------
-- 课程资源三级结构、课件资源、知识点检测题
-- ---------------------------------------------------------------------------

ALTER TABLE knowledge_points
  ADD COLUMN IF NOT EXISTS module_key varchar(64),
  ADD COLUMN IF NOT EXISTS module_name varchar(128),
  ADD COLUMN IF NOT EXISTS sort_order int NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_knowledge_points_module_key
  ON knowledge_points (module_key, sort_order, id);

CREATE TABLE IF NOT EXISTS course_resource_nodes (
  id           bigserial PRIMARY KEY,
  module_key   varchar(64) NOT NULL,
  module_name  varchar(128) NOT NULL,
  parent_id    bigint REFERENCES course_resource_nodes (id) ON DELETE CASCADE,
  level        int NOT NULL CHECK (level BETWEEN 1 AND 3),
  title        varchar(200) NOT NULL,
  sort_order   int NOT NULL DEFAULT 0,
  status       varchar(32) NOT NULL DEFAULT 'draft',
  created_by   bigint REFERENCES users (id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_course_resource_nodes_module
  ON course_resource_nodes (module_key, parent_id, sort_order, id);

CREATE INDEX IF NOT EXISTS idx_course_resource_nodes_parent
  ON course_resource_nodes (parent_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_course_resource_nodes_updated_at'
  ) THEN
    CREATE TRIGGER trg_course_resource_nodes_updated_at
      BEFORE UPDATE ON course_resource_nodes
      FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS course_resource_files (
  id            bigserial PRIMARY KEY,
  node_id       bigint NOT NULL REFERENCES course_resource_nodes (id) ON DELETE CASCADE,
  origin_name   varchar(255) NOT NULL,
  storage_name  varchar(255) NOT NULL,
  storage_path  varchar(500) NOT NULL,
  mime_type     varchar(128),
  size_bytes    bigint NOT NULL DEFAULT 0,
  resource_type varchar(32) NOT NULL DEFAULT 'file',
  uploaded_by   bigint REFERENCES users (id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE course_resource_files
  ADD COLUMN IF NOT EXISTS content_hash varchar(64),
  ADD COLUMN IF NOT EXISTS preview_storage_path varchar(500),
  ADD COLUMN IF NOT EXISTS preview_mime_type varchar(128),
  ADD COLUMN IF NOT EXISTS preview_status varchar(32) NOT NULL DEFAULT 'ready';

CREATE INDEX IF NOT EXISTS idx_course_resource_files_node
  ON course_resource_files (node_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_course_resource_files_hash
  ON course_resource_files (content_hash);

CREATE TABLE IF NOT EXISTS course_resource_node_knowledge_points (
  node_id            bigint NOT NULL REFERENCES course_resource_nodes (id) ON DELETE CASCADE,
  knowledge_point_id bigint NOT NULL REFERENCES knowledge_points (id) ON DELETE CASCADE,
  created_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (node_id, knowledge_point_id)
);

CREATE TABLE IF NOT EXISTS student_course_resource_progress (
  id               bigserial PRIMARY KEY,
  user_id          bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  content_hash     varchar(64) NOT NULL,
  progress_percent numeric(5,2) NOT NULL DEFAULT 0,
  last_position    jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_at     timestamptz,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, content_hash)
);

CREATE INDEX IF NOT EXISTS idx_student_course_resource_progress_user
  ON student_course_resource_progress (user_id, updated_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_student_course_resource_progress_updated_at'
  ) THEN
    CREATE TRIGGER trg_student_course_resource_progress_updated_at
      BEFORE UPDATE ON student_course_resource_progress
      FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();
  END IF;
END $$;

ALTER TABLE quiz_questions
  ADD COLUMN IF NOT EXISTS correct_answer jsonb,
  ADD COLUMN IF NOT EXISTS explanation text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS keywords jsonb NOT NULL DEFAULT '[]'::jsonb;
