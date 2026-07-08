-- 组队测评：组队意愿（组队池 / 单人公司）与单人队标记
-- 执行：见 docs/sql/migrations/README.md

SET client_encoding = 'UTF8';

ALTER TABLE student_team_formation_submissions
  ADD COLUMN IF NOT EXISTS grouping_preference varchar(16);

UPDATE student_team_formation_submissions
SET grouping_preference = 'pool'
WHERE grouping_preference IS NULL AND status = 'pending_teacher';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stfs_grouping_preference_check'
  ) THEN
    ALTER TABLE student_team_formation_submissions
      ADD CONSTRAINT stfs_grouping_preference_check
      CHECK (grouping_preference IS NULL OR grouping_preference IN ('pool', 'solo'));
  END IF;
END $$;

ALTER TABLE teacher_personal_class_teams
  ADD COLUMN IF NOT EXISTS is_solo boolean NOT NULL DEFAULT false;
