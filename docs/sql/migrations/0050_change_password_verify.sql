-- 个人中心改密：支持向已绑定邮箱/手机发送验证码
-- 0049 已包含 change_password；本文件保持可重复执行（幂等）
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'email_verification_codes'::regclass
      AND c.contype = 'c'
      AND (c.conname ILIKE '%purpose%' OR pg_get_constraintdef(c.oid) ILIKE '%purpose%')
  LOOP
    EXECUTE format('ALTER TABLE email_verification_codes DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

UPDATE email_verification_codes
SET purpose = lower(btrim(coalesce(purpose, '')));
UPDATE email_verification_codes
SET purpose = 'reset_password'
WHERE purpose = ''
   OR purpose NOT IN ('bind_email', 'bind_phone', 'reset_password', 'change_password');

ALTER TABLE email_verification_codes
  ADD CONSTRAINT email_verification_codes_purpose_check
  CHECK (purpose IN ('bind_email', 'bind_phone', 'reset_password', 'change_password'));
