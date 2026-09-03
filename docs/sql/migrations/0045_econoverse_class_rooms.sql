-- 创世纪：按教师个性化班发布地图与实训节奏
SET client_encoding = 'UTF8';

CREATE TABLE IF NOT EXISTS econoverse_class_rooms (
  teacher_personal_class_id bigint PRIMARY KEY
    REFERENCES teacher_personal_classes (id) ON DELETE CASCADE,
  teacher_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  map_layout jsonb,
  session_config jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_econoverse_class_rooms_teacher
  ON econoverse_class_rooms (teacher_id);
