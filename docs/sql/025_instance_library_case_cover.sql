-- 实例/原型案例封面图（单张）
ALTER TABLE teacher_instance_library_cases
  ADD COLUMN IF NOT EXISTS cover_storage_path varchar(500),
  ADD COLUMN IF NOT EXISTS cover_origin_name varchar(255),
  ADD COLUMN IF NOT EXISTS cover_mime_type varchar(128);
