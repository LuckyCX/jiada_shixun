-- 商业模式画布（BMC）：小组最终版 + 队长保存
-- 执行：psql -v ON_ERROR_STOP=1 -f 029_team_bmc_canvas.sql

SET client_encoding = 'UTF8';

ALTER TABLE teacher_personal_class_team_business_model_workspace
  ADD COLUMN IF NOT EXISTS bmc_canvas_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS bmc_canvas_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS bmc_canvas_saved_at timestamptz,
  ADD COLUMN IF NOT EXISTS bmc_canvas_saved_by bigint REFERENCES users (id) ON DELETE SET NULL;
