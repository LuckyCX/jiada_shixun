-- 商业计划书最终提交：附件资料（PPT 必传 + 可选其他附件）
-- 执行：psql -v ON_ERROR_STOP=1 -f 033_team_business_plan_attachments.sql

SET client_encoding = 'UTF8';

CREATE TABLE IF NOT EXISTS teacher_personal_class_team_business_plan_submission_attachments (
  id            bigserial PRIMARY KEY,
  submission_id bigint NOT NULL REFERENCES teacher_personal_class_team_business_plan_submissions (id) ON DELETE CASCADE,
  storage_key   text NOT NULL,
  file_name     varchar(512) NOT NULL,
  file_size     bigint NOT NULL DEFAULT 0,
  mime_type     varchar(128) NOT NULL DEFAULT '',
  ext           varchar(16) NOT NULL DEFAULT '',
  is_ppt        boolean NOT NULL DEFAULT false,
  sort_order    int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bp_submit_attach_submission
  ON teacher_personal_class_team_business_plan_submission_attachments (submission_id, sort_order, id);

