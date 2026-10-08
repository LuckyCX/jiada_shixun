-- 个人中心改密：支持向已绑定邮箱/手机发送验证码
ALTER TABLE email_verification_codes DROP CONSTRAINT IF EXISTS email_verification_codes_purpose_check;
ALTER TABLE email_verification_codes
  ADD CONSTRAINT email_verification_codes_purpose_check
  CHECK (purpose IN ('bind_email', 'bind_phone', 'reset_password', 'change_password'));
