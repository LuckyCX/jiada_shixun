ALTER TABLE teacher_guidance_history
  ADD COLUMN IF NOT EXISTS makeup_deadline timestamptz;
