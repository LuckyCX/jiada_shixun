-- 教师备课班壳（仅支撑演示 AI/上传鉴权）+ 子管理员菜单权限
SET client_encoding = 'UTF8';

ALTER TABLE teacher_personal_classes
  ADD COLUMN IF NOT EXISTS purpose varchar(32) NOT NULL DEFAULT 'normal';

COMMENT ON COLUMN teacher_personal_classes.purpose IS 'normal=正式教学班；prep=教师备课班壳（学生进度不落业务表）';

CREATE INDEX IF NOT EXISTS idx_tpc_teacher_purpose
  ON teacher_personal_classes (teacher_id, purpose);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS admin_menu_perms jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN users.admin_menu_perms IS '子管理员可额外勾选的菜单：college-management / class-management；超管忽略此字段';

-- 允许 role=sub_admin（与 student/teacher/admin 并列）
-- 无 CHECK 约束时仅约定取值；若库中有 check 需另行调整
