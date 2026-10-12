-- 联系方式验证码：支持手机绑定、管理员角色；邮箱/手机至少填一个
-- 本地：./sync-migrations-local.sh --dev
-- 说明：加 CHECK 前清洗历史 purpose/role；幂等可重复执行
-- 注意：生产若曾落过旧版 0049，请确保本文件已同步到服务器后再跑 migrate

-- 卸掉所有与 purpose / role 相关的旧 CHECK（兼容无名/旧名约束）
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'email_verification_codes'::regclass
      AND c.contype = 'c'
      AND (
        c.conname ILIKE '%purpose%'
        OR c.conname ILIKE '%role%'
        OR pg_get_constraintdef(c.oid) ILIKE '%purpose%'
        OR pg_get_constraintdef(c.oid) ILIKE '%role%'
      )
  LOOP
    EXECUTE format('ALTER TABLE email_verification_codes DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

-- role：归一化后再收紧
UPDATE email_verification_codes
SET role = lower(btrim(coalesce(role, '')));
UPDATE email_verification_codes
SET role = 'student'
WHERE role = '' OR role NOT IN ('student', 'teacher', 'admin');
ALTER TABLE email_verification_codes
  ADD CONSTRAINT email_verification_codes_role_check
  CHECK (role IN ('student', 'teacher', 'admin'));

-- purpose：归一化；未知值（含空、改密旧脏数据）归为 reset_password
-- 允许值含 change_password，与 0050 / 现行代码一致
UPDATE email_verification_codes
SET purpose = lower(btrim(coalesce(purpose, '')));
UPDATE email_verification_codes
SET purpose = 'reset_password'
WHERE purpose = ''
   OR purpose NOT IN ('bind_email', 'bind_phone', 'reset_password', 'change_password');
ALTER TABLE email_verification_codes
  ADD CONSTRAINT email_verification_codes_purpose_check
  CHECK (purpose IN ('bind_email', 'bind_phone', 'reset_password', 'change_password'));

ALTER TABLE email_verification_codes
  ADD COLUMN IF NOT EXISTS phone varchar(32);

ALTER TABLE email_verification_codes
  ALTER COLUMN email DROP NOT NULL;

-- 清理极端脏数据后加「邮箱或手机至少一个」约束
UPDATE email_verification_codes
SET email = COALESCE(NULLIF(btrim(email), ''), 'legacy@invalid.local')
WHERE (email IS NULL OR btrim(coalesce(email, '')) = '')
  AND (phone IS NULL OR btrim(coalesce(phone, '')) = '');

ALTER TABLE email_verification_codes DROP CONSTRAINT IF EXISTS email_verification_codes_contact_check;
ALTER TABLE email_verification_codes
  ADD CONSTRAINT email_verification_codes_contact_check
  CHECK (
    (email IS NOT NULL AND length(btrim(email)) > 0)
    OR (phone IS NOT NULL AND length(btrim(phone)) > 0)
  );

CREATE INDEX IF NOT EXISTS idx_evc_phone_lookup
  ON email_verification_codes (role, purpose, phone, created_at DESC)
  WHERE phone IS NOT NULL;
