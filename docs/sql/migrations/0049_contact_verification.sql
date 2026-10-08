-- 联系方式验证码：支持手机绑定、管理员角色；邮箱/手机至少填一个
-- 本地：./sync-migrations-local.sh --dev

ALTER TABLE email_verification_codes DROP CONSTRAINT IF EXISTS email_verification_codes_role_check;
ALTER TABLE email_verification_codes
  ADD CONSTRAINT email_verification_codes_role_check
  CHECK (role IN ('student', 'teacher', 'admin'));

ALTER TABLE email_verification_codes DROP CONSTRAINT IF EXISTS email_verification_codes_purpose_check;
ALTER TABLE email_verification_codes
  ADD CONSTRAINT email_verification_codes_purpose_check
  CHECK (purpose IN ('bind_email', 'bind_phone', 'reset_password'));

ALTER TABLE email_verification_codes
  ADD COLUMN IF NOT EXISTS phone varchar(32);

ALTER TABLE email_verification_codes
  ALTER COLUMN email DROP NOT NULL;

-- 清理极端脏数据后加「邮箱或手机至少一个」约束
UPDATE email_verification_codes
SET email = COALESCE(NULLIF(trim(email), ''), 'legacy@invalid.local')
WHERE (email IS NULL OR trim(email) = '') AND (phone IS NULL OR trim(phone) = '');

ALTER TABLE email_verification_codes DROP CONSTRAINT IF EXISTS email_verification_codes_contact_check;
ALTER TABLE email_verification_codes
  ADD CONSTRAINT email_verification_codes_contact_check
  CHECK (
    (email IS NOT NULL AND length(trim(email)) > 0)
    OR (phone IS NOT NULL AND length(trim(phone)) > 0)
  );

CREATE INDEX IF NOT EXISTS idx_evc_phone_lookup
  ON email_verification_codes (role, purpose, phone, created_at DESC)
  WHERE phone IS NOT NULL;
