-- 创世纪 EconoVerse：学生一人一档云存档
-- 执行：见 docs/sql/migrations/README.md

SET client_encoding = 'UTF8';

CREATE TABLE IF NOT EXISTS econoverse_saves (
  student_id bigint PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  state      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_econoverse_saves_updated_at
  ON econoverse_saves (updated_at DESC);
