-- 同一教学班内：一名学生只能归属一支队伍（含单人公司），禁止同时入多队或「单人公司 + 多人队」
-- 执行：见 docs/sql/migrations/README.md

SET client_encoding = 'UTF8';

CREATE OR REPLACE FUNCTION trg_tpctm_one_team_per_class()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_class_id bigint;
  v_conflict_team_id bigint;
BEGIN
  SELECT t.teacher_personal_class_id
    INTO v_class_id
  FROM teacher_personal_class_teams t
  WHERE t.id = NEW.team_id;

  IF v_class_id IS NULL THEN
    RAISE EXCEPTION 'team % not found for membership', NEW.team_id
      USING ERRCODE = '23503';
  END IF;

  SELECT m.team_id
    INTO v_conflict_team_id
  FROM teacher_personal_class_team_members m
  JOIN teacher_personal_class_teams t ON t.id = m.team_id
  WHERE t.teacher_personal_class_id = v_class_id
    AND m.student_id = NEW.student_id
    AND m.team_id IS DISTINCT FROM NEW.team_id
  LIMIT 1;

  IF v_conflict_team_id IS NOT NULL THEN
    RAISE EXCEPTION
      'student % already belongs to team % in class %',
      NEW.student_id, v_conflict_team_id, v_class_id
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tpctm_one_team_per_class ON teacher_personal_class_team_members;
CREATE TRIGGER trg_tpctm_one_team_per_class
  BEFORE INSERT OR UPDATE OF team_id, student_id
  ON teacher_personal_class_team_members
  FOR EACH ROW
  EXECUTE PROCEDURE trg_tpctm_one_team_per_class();
