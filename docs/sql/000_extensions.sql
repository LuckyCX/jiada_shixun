-- 实训平台 · PostgreSQL 扩展（按需）
-- 导入顺序：本文件 → 001_schema.sql → 003_seed.sql（002 为说明可跳过）
-- 数据字典（dict_type / dict_item）沿用 pgcrypto，无新增扩展。

CREATE EXTENSION IF NOT EXISTS pgcrypto;
