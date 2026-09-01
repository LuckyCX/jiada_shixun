#!/usr/bin/env bash
# 从【测试机】导出师生及班级关系（按名称/编码对齐，便于导入正式机）
# 用法：在测试服务器项目根目录执行
#   chmod +x scripts/sync-teachers-students/export-from-test.sh
#   ./scripts/sync-teachers-students/export-from-test.sh
# 产物目录默认：./sync-export-YYYYMMDD-HHMMSS/

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

OUT_DIR="${1:-${ROOT_DIR}/sync-export-$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$OUT_DIR"

if [[ -f .env ]]; then
  # shellcheck disable=SC1091
  set -a && source .env && set +a
fi
PG_USER="${POSTGRES_USER:-jiada_shixun}"
PG_DB="${POSTGRES_DB:-jiada_shixun}"

compose() {
  if docker compose version &>/dev/null; then
    docker compose "$@"
  else
    docker-compose "$@"
  fi
}

if ! compose ps postgres 2>/dev/null | grep -qE 'Up|running'; then
  echo "错误：postgres 容器未运行，请先 docker compose up -d postgres"
  exit 1
fi

run_copy() {
  local file="$1"
  local query="$2"
  echo "  → ${file}"
  compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "$PG_USER" -d "$PG_DB" -c "\copy (${query}) TO STDOUT WITH (FORMAT csv, HEADER true)" > "${OUT_DIR}/${file}"
}

echo "导出目录: ${OUT_DIR}"
echo "数据库: ${PG_DB} @ postgres 容器"

# 仅 teacher / student（不含 admin）
run_copy "colleges.csv" "
SELECT DISTINCT c.id AS src_college_id, c.name, c.status
FROM colleges c
WHERE c.id IN (
  SELECT college_id FROM classes WHERE college_id IS NOT NULL
  UNION
  SELECT mj.college_id FROM users u
  JOIN majors mj ON mj.id = u.major_id
  WHERE u.role IN ('teacher','student') AND mj.college_id IS NOT NULL
  UNION
  SELECT NULLIF(TRIM(u.department), '')::bigint FROM users u
  WHERE u.role IN ('teacher','student') AND u.department ~ '^[0-9]+$'
)
ORDER BY src_college_id
"

run_copy "majors.csv" "
SELECT DISTINCT m.id AS src_major_id, m.name, m.status, col.name AS college_name
FROM majors m
JOIN colleges col ON col.id = m.college_id
WHERE m.id IN (
  SELECT major_id FROM classes WHERE major_id IS NOT NULL
  UNION
  SELECT major_id FROM users WHERE role IN ('teacher','student') AND major_id IS NOT NULL
)
ORDER BY src_major_id
"

run_copy "classes.csv" "
SELECT
  cl.code,
  cl.name,
  cl.academic_year,
  cl.semester,
  cl.status,
  col.name AS college_name,
  mj.name AS major_name,
  tu.username AS teacher_username
FROM classes cl
LEFT JOIN colleges col ON col.id = cl.college_id
LEFT JOIN majors mj ON mj.id = cl.major_id
LEFT JOIN users tu ON tu.id = cl.teacher_id
WHERE cl.id IN (
  SELECT DISTINCT cs.class_id
  FROM class_students cs
  JOIN users u ON u.id = cs.student_id
  WHERE u.role = 'student'
)
   OR tu.role = 'teacher'
ORDER BY cl.code
"

run_copy "users.csv" "
SELECT
  u.username,
  u.password_hash,
  u.real_name,
  u.email,
  u.phone,
  u.role,
  u.status,
  u.student_no,
  u.employee_no,
  u.avatar_url,
  COALESCE(col_d.name, col_m.name) AS college_name,
  mj.name AS major_name
FROM users u
LEFT JOIN majors mj ON mj.id = u.major_id
LEFT JOIN colleges col_m ON col_m.id = mj.college_id
LEFT JOIN colleges col_d ON col_d.id = NULLIF(TRIM(u.department), '')::bigint
WHERE u.role IN ('teacher','student')
ORDER BY u.role, u.username
"

run_copy "class_students.csv" "
SELECT
  cl.code AS class_code,
  u.username AS student_username,
  cs.joined_at
FROM class_students cs
JOIN classes cl ON cl.id = cs.class_id
JOIN users u ON u.id = cs.student_id
WHERE u.role = 'student'
ORDER BY cl.code, u.username
"

cat > "${OUT_DIR}/README.txt" <<EOF
测试机导出包 — $(date -Iseconds)
请将整个目录 scp 到正式服务器项目根目录下，然后执行：
  ./scripts/sync-teachers-students/import-to-prod.sh $(basename "$OUT_DIR")
EOF

echo ""
echo "完成。请打包并传到正式机，例如："
echo "  tar czf sync-export.tgz -C $(dirname "$OUT_DIR") $(basename "$OUT_DIR")"
echo "  scp sync-export.tgz root@正式机IP:/www/wwwroot/你的站点/"
