-- 团队实训驾驶舱：AI 交互落库、阶段过程分、总评

-- 创意库 method_key 允许 midwifery（助产入库）
ALTER TABLE teacher_personal_class_team_ideas DROP CONSTRAINT IF EXISTS teacher_personal_class_team_ideas_method_key_check;
ALTER TABLE teacher_personal_class_team_ideas
  ADD CONSTRAINT teacher_personal_class_team_ideas_method_key_check
  CHECK (method_key IN ('brainstorm', 'scamper', 'triz', 'ai', 'six_hats', 'midwifery'));

-- 选题退回次数（软扣证据）
ALTER TABLE teacher_personal_class_team_project_topics
  ADD COLUMN IF NOT EXISTS reject_count integer NOT NULL DEFAULT 0;

-- 创新多轮对话 + 结果类 AI 生成事件
CREATE TABLE IF NOT EXISTS teacher_personal_class_team_ai_interaction_logs (
  id          bigserial PRIMARY KEY,
  class_id    bigint NOT NULL REFERENCES teacher_personal_classes (id) ON DELETE CASCADE,
  team_id     bigint NOT NULL REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  student_id  bigint REFERENCES users (id) ON DELETE SET NULL,
  module_key  text NOT NULL,
  scene       text NOT NULL,
  thread_id   text,
  round_index integer NOT NULL DEFAULT 0,
  role        text NOT NULL DEFAULT 'event',
  content     text NOT NULL DEFAULT '',
  meta_json   jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tpct_ai_logs_team_module_time
  ON teacher_personal_class_team_ai_interaction_logs (team_id, module_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tpct_ai_logs_thread
  ON teacher_personal_class_team_ai_interaction_logs (thread_id)
  WHERE thread_id IS NOT NULL AND thread_id <> '';

-- 阶段过程分（按团队 × 模块一条）
CREATE TABLE IF NOT EXISTS teacher_personal_class_team_stage_process_scores (
  id                     bigserial PRIMARY KEY,
  class_id               bigint NOT NULL REFERENCES teacher_personal_classes (id) ON DELETE CASCADE,
  team_id                bigint NOT NULL REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  module_key             text NOT NULL,
  status                 text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'scoring', 'scored', 'failed')),
  evidence_json          jsonb NOT NULL DEFAULT '{}'::jsonb,
  dimension_scores_json  jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_score            numeric(6,2),
  comment                text NOT NULL DEFAULT '',
  weight_applied         numeric(8,6),
  model_raw_json         jsonb,
  scored_at              timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, module_key)
);

CREATE INDEX IF NOT EXISTS idx_tpct_stage_scores_class
  ON teacher_personal_class_team_stage_process_scores (class_id, team_id);

-- 总评（按团队一条）
CREATE TABLE IF NOT EXISTS teacher_personal_class_team_final_evaluations (
  id                     bigserial PRIMARY KEY,
  class_id               bigint NOT NULL REFERENCES teacher_personal_classes (id) ON DELETE CASCADE,
  team_id                bigint NOT NULL REFERENCES teacher_personal_class_teams (id) ON DELETE CASCADE,
  weighted_process_score numeric(6,2),
  dimension_scores_json  jsonb NOT NULL DEFAULT '{}'::jsonb,
  final_score            numeric(6,2),
  summary                text NOT NULL DEFAULT '',
  comment                text NOT NULL DEFAULT '',
  status                 text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'scoring', 'scored', 'failed')),
  model_raw_json         jsonb,
  scored_at              timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id)
);
