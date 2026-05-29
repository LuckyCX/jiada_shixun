CREATE TABLE IF NOT EXISTS teacher_guidance_history (
  id                        bigserial PRIMARY KEY,
  teacher_personal_class_id bigint NOT NULL REFERENCES teacher_personal_classes (id) ON DELETE CASCADE,
  teacher_id                bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  source_message_id         bigint,
  guidance_batch_id         uuid,
  guidance_type             varchar(32) NOT NULL,
  target_label              varchar(255) NOT NULL DEFAULT '',
  content                   text NOT NULL DEFAULT '',
  target_scope              varchar(16) NOT NULL DEFAULT 'all',
  team_id                   bigint,
  student_id                bigint,
  urgency                   varchar(16) DEFAULT 'normal',
  recipient_count           int NOT NULL DEFAULT 0,
  read_count                int NOT NULL DEFAULT 0,
  sent_at                   timestamptz NOT NULL DEFAULT now(),
  withdrawn_at              timestamptz,
  makeup_deadline           timestamptz
);

CREATE INDEX IF NOT EXISTS idx_teacher_guidance_history_class_sent
  ON teacher_guidance_history (teacher_personal_class_id, sent_at DESC);
