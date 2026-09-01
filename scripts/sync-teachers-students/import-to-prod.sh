#!/usr/bin/env bash
# 将测试机导出的 CSV 包合并进【正式机】PostgreSQL（不删 admin，师生按 username 覆盖更新）
# 用法（在正式服务器项目根目录）：
#   chmod +x scripts/sync-teachers-students/import-to-prod.sh
#   ./scripts/sync-teachers-students/import-to-prod.sh ./sync-export-20260326-120000
# 安全：必须先设置环境变量 CONFIRM_PROD=YES

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

EXPORT_DIR="${1:-}"
if [[ -z "$EXPORT_DIR" || ! -d "$EXPORT_DIR" ]]; then
  echo "用法: $0 <导出目录路径>"
  echo "示例: $0 ./sync-export-20260326-120000"
  exit 1
fi

for f in colleges.csv majors.csv classes.csv users.csv class_students.csv; do
  if [[ ! -f "${EXPORT_DIR}/${f}" ]]; then
    echo "缺少文件: ${EXPORT_DIR}/${f}"
    exit 1
  fi
done

if [[ "${CONFIRM_PROD:-}" != "YES" ]]; then
  echo "========================================"
  echo "即将把测试机师生数据合并进【本机】正式库"
  echo "  目录: ${EXPORT_DIR}"
  echo "  策略: users 按 username 更新；班级按 code 更新；class_students 按班+学号合并"
  echo "  不会删除 admin 账号；不会清空整库"
  echo ""
  echo "请先备份正式库，再执行："
  echo "  CONFIRM_PROD=YES $0 ${EXPORT_DIR}"
  echo "========================================"
  exit 1
fi

if [[ -f .env ]]; then
  # shellcheck disable=SC1091
  set -a && source .env && set +a
fi
PG_USER="${POSTGRES_USER:-jiada_shixun}"
PG_DB="${POSTGRES_DB:-jiada_shixun}"
BACKUP_DIR="${ROOT_DIR}/backups"
mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/before-sync-teachers-students-${STAMP}.sql.gz"

compose() {
  if docker compose version &>/dev/null; then
    docker compose "$@"
  else
    docker-compose "$@"
  fi
}

if ! compose ps postgres 2>/dev/null | grep -qE 'Up|running'; then
  echo "错误：postgres 容器未运行"
  exit 1
fi

echo "备份正式库 → ${BACKUP_FILE}"
compose exec -T postgres pg_dump -U "$PG_USER" -d "$PG_DB" | gzip > "$BACKUP_FILE"

ABS_EXPORT="$(cd "$EXPORT_DIR" && pwd)"
SQL_FILE="${ROOT_DIR}/scripts/sync-teachers-students/import-merge.sql"

echo "复制 CSV 到 postgres 容器 /tmp/sync-import/ …"
compose exec -T postgres mkdir -p /tmp/sync-import
for f in colleges majors classes users class_students; do
  compose cp "${ABS_EXPORT}/${f}.csv" "postgres:/tmp/sync-import/${f}.csv"
done
compose cp "$SQL_FILE" "postgres:/tmp/sync-import/import-merge.sql"

echo "校验容器内 CSV …"
compose exec -T postgres sh -c 'ls -la /tmp/sync-import/*.csv'

echo "开始合并…"
compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "$PG_USER" -d "$PG_DB" \
  -f /tmp/sync-import/import-merge.sql

compose exec -T postgres rm -rf /tmp/sync-import

echo ""
echo "完成。备份文件: ${BACKUP_FILE}"
echo "建议验收：管理后台用户列表、班级人数；抽样学生登录。"
