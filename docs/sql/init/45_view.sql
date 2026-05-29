-- 学生视角：记录「进入」了哪些教师创建的个性化教学分组（供学生端查班、选班）
-- 关系数据主表仍为 teacher_personal_class_students（一行表示一次入组，含 joined_at）
-- 执行：psql -v ON_ERROR_STOP=1 -f 003_student_teacher_personal_enrollments_view.sql

SET client_encoding = 'UTF8';

COMMENT ON TABLE teacher_personal_class_students IS
  '学生与教师个性化教学分组成员关系。一名学生可同时在多个分组（多名教师分别拉入）；学生端按 student_id 查本表 JOIN teacher_personal_classes 即可枚举所属教师班。';

COMMENT ON COLUMN teacher_personal_class_students.joined_at IS
  '记录学生被加入该教师分组的时间（管理员全量覆盖名单时可能被重建，以业务是否改为增量同步为准）。';

COMMENT ON COLUMN teacher_personal_class_students.teacher_personal_class_id IS
  '教师创建的教学分组 id → teacher_personal_classes.id，可由此得到创建教师 teacher_id。';

CREATE OR REPLACE VIEW student_teacher_personal_enrollments AS
SELECT
  tp.student_id,
  tpc.id                    AS teacher_personal_class_id,
  tpc.name                  AS teacher_personal_class_name,
  tpc.academic_year         AS teacher_personal_class_academic_year,
  tpc.semester              AS teacher_personal_class_semester,
  tpc.teacher_id,
  tu.real_name              AS teacher_real_name,
  tu.username               AS teacher_username,
  tp.joined_at
FROM teacher_personal_class_students tp
INNER JOIN teacher_personal_classes tpc ON tpc.id = tp.teacher_personal_class_id
INNER JOIN users tu ON tu.id = tpc.teacher_id AND tu.role = 'teacher';

COMMENT ON VIEW student_teacher_personal_enrollments IS
  '学生已加入的教师个性化分组列表（Flat），学生端 GET 可查询：WHERE student_id = 当前学生。';
