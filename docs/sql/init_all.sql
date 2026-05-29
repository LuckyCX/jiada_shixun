-- 空库一键初始化：在 docs/sql 目录下执行
--   psql -v ON_ERROR_STOP=1 -U postgres -d your_db -f init_all.sql
\set ON_ERROR_STOP on

\ir 000_extensions.sql
\ir 001_schema.sql
\ir 002_business.sql
\ir 003_seed.sql
\ir 003_student_teacher_personal_enrollments_view.sql
