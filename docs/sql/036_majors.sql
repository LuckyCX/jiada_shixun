-- 已有库增量：专业表及 users/classes 关联
SET client_encoding = 'UTF8';

CREATE TABLE IF NOT EXISTS majors (
  id          bigserial PRIMARY KEY,
  college_id  bigint NOT NULL REFERENCES colleges (id) ON DELETE CASCADE,
  name        varchar(128) NOT NULL,
  status      varchar(32) NOT NULL DEFAULT 'active',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (college_id, name)
);

CREATE INDEX IF NOT EXISTS idx_majors_college_id ON majors (college_id);
CREATE INDEX IF NOT EXISTS idx_majors_status ON majors (status);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_majors_updated_at') THEN
    CREATE TRIGGER trg_majors_updated_at BEFORE UPDATE ON majors
      FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();
  END IF;
END $$;

ALTER TABLE users ADD COLUMN IF NOT EXISTS major_id bigint REFERENCES majors (id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_major_id ON users (major_id);

ALTER TABLE classes ADD COLUMN IF NOT EXISTS major_id bigint REFERENCES majors (id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_classes_major_id ON classes (major_id);
