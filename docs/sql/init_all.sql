-- 空库一键初始化：在 docs/sql 目录下执行
--   psql -v ON_ERROR_STOP=1 -U postgres -d your_db -f init_all.sql
\set ON_ERROR_STOP on

\ir 000_extensions.sql
\ir 001_schema.sql
\ir 002_rls_notes.sql
\ir 002_teacher_personal_classes.sql
\ir 003_seed.sql
\ir 003_student_teacher_personal_enrollments_view.sql
\ir 005_extend_admin_access_ttl_for_existing.sql
\ir 006_team_formation.sql
\ir 007_personal_class_teams.sql
\ir 008_team_introduction.sql
\ir 009_team_leader.sql
\ir 010_personal_class_tasks.sql
\ir 011_course_resources.sql
\ir 012_task_resource_links.sql
\ir 013_teacher_instance_library.sql
\ir 014_student_ideation.sql
\ir 015_course_settings.sql
\ir 016_task_collection_submissions.sql
\ir 017_team_project_topics.sql
\ir 018_team_market_research.sql
\ir 019_team_market_research_surveys.sql
\ir 020_survey_response_token.sql
\ir 021_team_market_research_ai.sql
\ir 022_survey_closes_at.sql
\ir 023_team_market_report_upload.sql
\ir 024_product_design_and_instance_module.sql
\ir 025_instance_library_case_cover.sql
\ir 026_business_model_workspace.sql
\ir 027_war_room_workspace.sql
\ir 028_war_room_member.sql
\ir 029_team_bmc_canvas.sql
\ir 031_role_simulation_run_record.sql
\ir 032_team_business_plan.sql
\ir 033_team_business_plan_attachments.sql
\ir 034_user_avatar.sql
\ir 035_email_verification_codes.sql
