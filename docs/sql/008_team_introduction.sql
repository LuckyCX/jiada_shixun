-- 团队介绍（学生队长可维护）
ALTER TABLE teacher_personal_class_teams
  ADD COLUMN IF NOT EXISTS introduction text NOT NULL DEFAULT '';
