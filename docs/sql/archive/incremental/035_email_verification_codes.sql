-- 邮箱验证码：用于邮箱绑定/修改、忘记密码
-- 执行：psql -v ON_ERROR_STOP=1 -f 035_email_verification_codes.sql

CREATE TABLE IF NOT EXISTS email_verification_codes (
  id bigserial PRIMARY KEY,
  role varchar(16) NOT NULL CHECK (role IN ('student', 'teacher')),
  user_id bigint REFERENCES users (id) ON DELETE CASCADE,
  email varchar(255) NOT NULL,
  purpose varchar(32) NOT NULL CHECK (purpose IN ('bind_email', 'reset_password')),
  code_hash varchar(200) NOT NULL,
  try_count int NOT NULL DEFAULT 0,
  sent_at timestamptz,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evc_lookup ON email_verification_codes (role, purpose, email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evc_user ON email_verification_codes (user_id, created_at DESC);

