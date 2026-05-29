-- 用户头像：新增 avatar_url 字段
-- 执行：psql -v ON_ERROR_STOP=1 -f 034_user_avatar.sql

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_url varchar(500);

