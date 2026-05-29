-- 教师任务关联课程资源
-- 执行：psql -v ON_ERROR_STOP=1 -f 012_task_resource_links.sql

SET client_encoding = 'UTF8';

ALTER TABLE teacher_personal_class_tasks
  ADD COLUMN IF NOT EXISTS resource_link_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS teacher_personal_class_task_resource_nodes (
  task_id  bigint NOT NULL REFERENCES teacher_personal_class_tasks (id) ON DELETE CASCADE,
  node_id  bigint NOT NULL REFERENCES course_resource_nodes (id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, node_id)
);

CREATE INDEX IF NOT EXISTS idx_pctrn_node ON teacher_personal_class_task_resource_nodes (node_id);
