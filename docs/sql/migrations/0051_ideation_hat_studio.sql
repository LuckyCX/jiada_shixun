-- 六帽创想室：创意库 method_key 扩展 + 按组员会话表
ALTER TABLE teacher_personal_class_team_ideas DROP CONSTRAINT IF EXISTS teacher_personal_class_team_ideas_method_key_check;
ALTER TABLE teacher_personal_class_team_ideas
  ADD CONSTRAINT teacher_personal_class_team_ideas_method_key_check
  -- midwifery 可能已有历史入库数据；与 0056 最终约束对齐，避免 ADD CHECK 失败
  CHECK (method_key IN ('brainstorm', 'scamper', 'triz', 'ai', 'six_hats', 'midwifery'));

CREATE TABLE IF NOT EXISTS teacher_personal_class_team_hat_studio_member (
  team_id         bigint NOT NULL REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  student_id      bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  draft_json      jsonb NOT NULL DEFAULT '{}'::jsonb,
  transcript_json jsonb NOT NULL DEFAULT '{"messages":[],"roundCount":0}'::jsonb,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_tpcths_team ON teacher_personal_class_team_hat_studio_member (team_id);
