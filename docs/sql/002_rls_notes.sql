-- 行级安全（RLS）说明 · 首期不在库内启用
-- 后续若多租户强隔离，可对 courses / teams / class_students 等表按 course_id / class_id 做 RLS 策略，
-- 应用层继续保留 role 校验。本文件占位以满足导入顺序，实际无任何策略生效。
-- dict_type / dict_item 为全局配置类表，若未来启用 RLS，通常不做租户行级隔离。

SELECT 1 AS rls_notes_placeholder;
