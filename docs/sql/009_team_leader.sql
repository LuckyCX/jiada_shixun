-- 教师指定的小组组长（未指定时业务默认 CEO）
ALTER TABLE teacher_personal_class_teams
  ADD COLUMN IF NOT EXISTS leader_student_id bigint REFERENCES users (id) ON DELETE SET NULL;
