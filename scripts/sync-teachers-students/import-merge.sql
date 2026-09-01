-- 将 export-from-test.sh 生成的 CSV 合并进【正式机】库（按名称/编码对齐 ID）
-- 由 import-to-prod.sh 调用；勿单独在生产库随意执行

\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE stg_colleges (
  src_college_id bigint,
  name text,
  status text
);
CREATE TEMP TABLE stg_majors (
  src_major_id bigint,
  name text,
  status text,
  college_name text
);
CREATE TEMP TABLE stg_classes (
  code text,
  name text,
  academic_year text,
  semester text,
  status text,
  college_name text,
  major_name text,
  teacher_username text
);
CREATE TEMP TABLE stg_users (
  username text,
  password_hash text,
  real_name text,
  email text,
  phone text,
  role text,
  status text,
  student_no text,
  employee_no text,
  avatar_url text,
  college_name text,
  major_name text
);
CREATE TEMP TABLE stg_class_students (
  class_code text,
  student_username text,
  joined_at timestamptz
);

-- 固定路径（import-to-prod.sh 将 CSV 拷入容器 /tmp/sync-import/）
COPY stg_colleges FROM '/tmp/sync-import/colleges.csv' CSV HEADER;
COPY stg_majors FROM '/tmp/sync-import/majors.csv' CSV HEADER;
COPY stg_classes FROM '/tmp/sync-import/classes.csv' CSV HEADER;
COPY stg_users FROM '/tmp/sync-import/users.csv' CSV HEADER;
COPY stg_class_students FROM '/tmp/sync-import/class_students.csv' CSV HEADER;

-- 学院
INSERT INTO colleges (name, status)
SELECT DISTINCT TRIM(name), COALESCE(NULLIF(TRIM(status), ''), 'active')
FROM stg_colleges
WHERE TRIM(name) <> ''
ON CONFLICT (name) DO UPDATE SET status = EXCLUDED.status;

-- 专业（学院 + 专业名）
INSERT INTO majors (college_id, name, status)
SELECT c.id, TRIM(s.name), COALESCE(NULLIF(TRIM(s.status), ''), 'active')
FROM stg_majors s
JOIN colleges c ON c.name = TRIM(s.college_name)
WHERE TRIM(s.name) <> '' AND TRIM(s.college_name) <> ''
ON CONFLICT (college_id, name) DO UPDATE SET status = EXCLUDED.status;

-- 用户（teacher / student）
INSERT INTO users (
  username, password_hash, real_name, email, phone, role, status,
  student_no, employee_no, avatar_url, department, major_id
)
SELECT
  TRIM(s.username),
  s.password_hash,
  NULLIF(TRIM(s.real_name), ''),
  NULLIF(TRIM(s.email), ''),
  NULLIF(TRIM(s.phone), ''),
  s.role,
  COALESCE(NULLIF(TRIM(s.status), ''), 'active'),
  NULLIF(TRIM(s.student_no), ''),
  NULLIF(TRIM(s.employee_no), ''),
  NULLIF(TRIM(s.avatar_url), ''),
  CASE WHEN c.id IS NOT NULL THEN c.id::text ELSE NULL END,
  m.id
FROM stg_users s
LEFT JOIN colleges c ON c.name = NULLIF(TRIM(s.college_name), '')
LEFT JOIN majors m ON m.college_id = c.id AND m.name = NULLIF(TRIM(s.major_name), '')
WHERE TRIM(s.username) <> '' AND s.role IN ('teacher', 'student')
ON CONFLICT (username) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  real_name = EXCLUDED.real_name,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  role = EXCLUDED.role,
  status = EXCLUDED.status,
  student_no = EXCLUDED.student_no,
  employee_no = EXCLUDED.employee_no,
  avatar_url = EXCLUDED.avatar_url,
  department = EXCLUDED.department,
  major_id = EXCLUDED.major_id,
  updated_at = now();

-- 行政班级（按 code 唯一）
INSERT INTO classes (
  name, code, academic_year, semester, college_id, major_id, teacher_id, status
)
SELECT
  TRIM(s.name),
  TRIM(s.code),
  NULLIF(TRIM(s.academic_year), ''),
  NULLIF(TRIM(s.semester), ''),
  c.id,
  m.id,
  tu.id,
  COALESCE(NULLIF(TRIM(s.status), ''), '1')
FROM stg_classes s
LEFT JOIN colleges c ON c.name = NULLIF(TRIM(s.college_name), '')
LEFT JOIN majors m ON m.college_id = c.id AND m.name = NULLIF(TRIM(s.major_name), '')
LEFT JOIN users tu ON tu.username = NULLIF(TRIM(s.teacher_username), '') AND tu.role = 'teacher'
WHERE TRIM(s.code) <> ''
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  academic_year = EXCLUDED.academic_year,
  semester = EXCLUDED.semester,
  college_id = EXCLUDED.college_id,
  major_id = EXCLUDED.major_id,
  teacher_id = EXCLUDED.teacher_id,
  status = EXCLUDED.status,
  updated_at = now();

-- 学生 ↔ 行政班
INSERT INTO class_students (class_id, student_id, joined_at)
SELECT cl.id, u.id, COALESCE(s.joined_at, now())
FROM stg_class_students s
JOIN classes cl ON cl.code = TRIM(s.class_code)
JOIN users u ON u.username = TRIM(s.student_username) AND u.role = 'student'
WHERE TRIM(s.class_code) <> '' AND TRIM(s.student_username) <> ''
ON CONFLICT (class_id, student_id) DO UPDATE SET joined_at = EXCLUDED.joined_at;

COMMIT;

-- 导入后统计
SELECT role, COUNT(*)::int AS cnt FROM users WHERE role IN ('teacher','student') GROUP BY role ORDER BY role;
SELECT COUNT(*)::int AS class_student_links FROM class_students;
