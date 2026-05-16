-- 教师个性化班级（教学/形式化分组），与 classes / class_students 分离
-- 执行：psql -v ON_ERROR_STOP=1 -f 002_teacher_personal_classes.sql

SET client_encoding = 'UTF8';

CREATE TABLE teacher_personal_classes (
  id             bigserial PRIMARY KEY,
  teacher_id     bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name           varchar(128) NOT NULL,
  academic_year  varchar(32),
  semester       varchar(32),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_teacher_personal_classes_teacher_id ON teacher_personal_classes (teacher_id);

CREATE TRIGGER trg_teacher_personal_classes_updated_at BEFORE UPDATE ON teacher_personal_classes
  FOR EACH ROW EXECUTE PROCEDURE trg_set_updated_at();

CREATE TABLE teacher_personal_class_students (
  id                       bigserial PRIMARY KEY,
  teacher_personal_class_id bigint NOT NULL REFERENCES teacher_personal_classes (id) ON DELETE CASCADE,
  student_id               bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  joined_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_personal_class_id, student_id)
);

CREATE INDEX idx_tpcs_class ON teacher_personal_class_students (teacher_personal_class_id);
CREATE INDEX idx_tpcs_student ON teacher_personal_class_students (student_id);
