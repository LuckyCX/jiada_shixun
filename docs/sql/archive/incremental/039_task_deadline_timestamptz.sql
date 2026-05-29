-- 实训任务截止时间支持到分钟
ALTER TABLE teacher_personal_class_tasks
  ALTER COLUMN deadline TYPE timestamptz
  USING ((deadline::text || ' 23:59:00')::timestamptz);
