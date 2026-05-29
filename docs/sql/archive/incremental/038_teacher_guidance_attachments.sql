CREATE TABLE IF NOT EXISTS teacher_guidance_attachments (
  id              bigserial PRIMARY KEY,
  batch_id        uuid NOT NULL,
  teacher_personal_class_id bigint NOT NULL REFERENCES teacher_personal_classes (id) ON DELETE CASCADE,
  storage_key     varchar(512) NOT NULL,
  file_name       varchar(255) NOT NULL,
  file_size       bigint NOT NULL,
  sort_order      int NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teacher_guidance_attachments_batch
  ON teacher_guidance_attachments (batch_id);
