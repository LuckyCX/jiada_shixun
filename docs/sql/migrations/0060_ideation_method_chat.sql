-- 启思 / 头脑风暴 / AI 对话：按组员 × 方法持久化 transcript（对齐六帽创想室）
-- 驾驶舱取证仍走 ai_interaction_logs；本表仅服务学生端 UI 恢复

CREATE TABLE IF NOT EXISTS teacher_personal_class_team_ideation_method_chat (
  team_id         bigint NOT NULL REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  student_id      bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  method_key      varchar(32) NOT NULL,
  thread_id       text,
  transcript_json jsonb NOT NULL DEFAULT '{"messages":[],"roundIndex":0,"canGenerate":false,"bootstrapped":false}'::jsonb,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, student_id, method_key),
  CONSTRAINT tpct_imc_method_key_check CHECK (method_key IN ('midwifery', 'brainstorm', 'ai'))
);

CREATE INDEX IF NOT EXISTS idx_tpct_imc_team
  ON teacher_personal_class_team_ideation_method_chat (team_id);

CREATE INDEX IF NOT EXISTS idx_tpct_imc_student
  ON teacher_personal_class_team_ideation_method_chat (student_id);
