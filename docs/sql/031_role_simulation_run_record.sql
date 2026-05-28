-- 角色仿真模拟运行快照记录

CREATE TABLE IF NOT EXISTS teacher_personal_class_team_role_simulation_run_records (
  id BIGSERIAL PRIMARY KEY,
  teacher_personal_class_id BIGINT NOT NULL,
  team_id BIGINT NOT NULL,
  student_id BIGINT NOT NULL,

  -- 该成员第 N 次模拟（用于“首次不计”的轮次统计）
  run_index INT NOT NULL,

  -- 本次模拟的输入配置（商业模型/基础参数/渠道分配等）
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- 30 天逐日数据与最终汇总（实时追踪页面所需数据）
  tracking_json JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- 迭代优化建议、方案对比等
  optimize_json JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- 思考过程（最多5行），可选存储
  thinking_log_json JSONB NOT NULL DEFAULT '[]'::jsonb,

  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_role_sim_run_records_team_student
  ON teacher_personal_class_team_role_simulation_run_records (team_id, student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_role_sim_run_records_class_team
  ON teacher_personal_class_team_role_simulation_run_records (teacher_personal_class_id, team_id, created_at DESC);

