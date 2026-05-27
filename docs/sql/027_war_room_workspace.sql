-- 虚拟董事会：九格画布 + 辩论记录
-- 执行：psql -v ON_ERROR_STOP=1 -f 027_war_room_workspace.sql

SET client_encoding = 'UTF8';

ALTER TABLE teacher_personal_class_team_business_model_workspace
  ADD COLUMN IF NOT EXISTS war_room_canvas_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS war_room_transcript_json jsonb NOT NULL DEFAULT '{"messages":[],"roundCount":0}'::jsonb,
  ADD COLUMN IF NOT EXISTS war_room_updated_at timestamptz;
