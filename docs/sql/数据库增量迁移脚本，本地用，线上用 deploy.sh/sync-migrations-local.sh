#!/usr/bin/env bash
# 本地已有库：按文件名顺序执行 docs/sql/migrations/*.sql
# 与 deploy.sh 内 run_sql_migrations 行为一致；线上发版请用 ./deploy.sh
#
# 用法（仓库根目录）:
#   chmod +x sync-migrations-local.sh
#   ./sync-migrations-local.sh
#   ./sync-migrations-local.sh --dev          # 使用 docker-compose.dev.yml（PG 15433）
#   ./sync-migrations-local.sh --no-up        # 不自动 docker compose up postgres
#   ./sync-migrations-local.sh --via-host     # 不经容器 exec，宿主机 psql 连 127.0.0.1

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

USE_DEV=0
AUTO_UP=1
VIA_HOST=0

usage() {
  echo "用法: $0 [选项]"
  echo "  --dev        叠加 docker-compose.dev.yml（本地 pnpm 常用 PG 15433）"
  echo "  --no-up      Postgres 未运行时也不自动 compose up -d postgres"
  echo "  --via-host   用宿主机 psql 连接（需已安装 psql；读 .env 端口与账号）"
  echo "  -h, --help   显示帮助"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dev) USE_DEV=1; shift ;;
    --no-up) AUTO_UP=0; shift ;;
    --via-host) VIA_HOST=1; shift ;;
    -h | --help) usage; exit 0 ;;
    *)
      echo -e "${RED}未知参数: $1${NC}"
      usage
      exit 1
      ;;
  esac
done

compose() {
  if [[ "$USE_DEV" -eq 1 ]]; then
    if docker compose version &>/dev/null; then
      docker compose -f docker-compose.yml -f docker-compose.dev.yml "$@"
    else
      docker-compose -f docker-compose.yml -f docker-compose.dev.yml "$@"
    fi
  elif docker compose version &>/dev/null; then
    docker compose "$@"
  elif command -v docker-compose &>/dev/null; then
    docker-compose "$@"
  else
    echo -e "${RED}未找到 docker compose${NC}"
    exit 1
  fi
}

load_env_file() {
  set -a
  # shellcheck disable=SC1091
  source "$1"
  set +a
}

if [[ ! -f .env ]]; then
  if [[ -f .env.example ]]; then
    cp .env.example .env
    echo -e "${GREEN}已从 .env.example 生成 .env${NC}"
  else
    echo -e "${RED}缺少 .env，请先复制 .env.example${NC}"
    exit 1
  fi
fi
load_env_file .env

PG_USER="${POSTGRES_USER:-jiada_shixun}"
PG_DB="${POSTGRES_DB:-jiada_shixun}"
PG_PASSWORD="${POSTGRES_PASSWORD:-}"
if [[ "$USE_DEV" -eq 1 ]]; then
  PG_HOST_PORT="15433"
else
  PG_HOST_PORT="${POSTGRES_HOST_PORT:-15434}"
fi

MIG_DIR="${ROOT_DIR}/docs/sql/migrations"
if [[ ! -d "$MIG_DIR" ]]; then
  echo -e "${RED}未找到迁移目录: ${MIG_DIR}${NC}"
  exit 1
fi

files=()
shopt -s nullglob
for f in "$MIG_DIR"/*.sql; do
  files+=("$f")
done
shopt -u nullglob

if [[ ${#files[@]} -eq 0 ]]; then
  echo -e "${GREEN}无增量迁移脚本${NC}"
  exit 0
fi

IFS=$'\n' files=($(printf '%s\n' "${files[@]}" | sort))
unset IFS

postgres_container_running() {
  compose ps postgres 2>/dev/null | grep -qE 'Up|running'
}

ensure_postgres() {
  if [[ "$VIA_HOST" -eq 1 ]]; then
    return 0
  fi
  if postgres_container_running; then
    return 0
  fi
  if [[ "$AUTO_UP" -eq 0 ]]; then
    echo -e "${RED}Postgres 容器未运行。请先: compose up -d postgres${NC}"
    echo -e "${YELLOW}  全栈: docker compose up -d postgres redis${NC}"
    echo -e "${YELLOW}  本地 dev 端口: ./sync-migrations-local.sh --dev${NC}"
    exit 1
  fi
  echo -e "${BLUE}Postgres 未运行，正在启动（仅 postgres 服务）...${NC}"
  compose up -d postgres
  echo -e "${BLUE}等待 Postgres 就绪...${NC}"
  for ((i = 1; i <= 45; i++)); do
    if compose ps postgres 2>/dev/null | grep -q "(healthy)"; then
      echo -e "${GREEN}Postgres 已就绪${NC}"
      return 0
    fi
    if compose exec -T postgres pg_isready -U "$PG_USER" -d "$PG_DB" &>/dev/null; then
      echo -e "${GREEN}Postgres 已就绪${NC}"
      return 0
    fi
    sleep 2
  done
  echo -e "${RED}Postgres 启动超时，请查看: compose logs postgres${NC}"
  exit 1
}

run_one_via_compose() {
  local f="$1"
  local base
  base="$(basename "$f")"
  echo "  → ${base}"
  compose cp "$f" "postgres:/tmp/${base}" >/dev/null
  compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "$PG_USER" -d "$PG_DB" -f "/tmp/${base}"
}

run_one_via_host() {
  local f="$1"
  local base
  base="$(basename "$f")"
  if ! command -v psql &>/dev/null; then
    echo -e "${RED}未安装 psql，请安装 PostgreSQL 客户端或使用默认 Docker 模式（去掉 --via-host）${NC}"
    exit 1
  fi
  echo "  → ${base} (127.0.0.1:${PG_HOST_PORT})"
  PGPASSWORD="$PG_PASSWORD" psql -h 127.0.0.1 -p "$PG_HOST_PORT" -U "$PG_USER" -d "$PG_DB" \
    -v ON_ERROR_STOP=1 -f "$f"
}

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}本地 SQL 增量迁移（${#files[@]} 个脚本）${NC}"
echo -e "${BLUE}========================================${NC}"
echo "  库: ${PG_DB} @ ${PG_USER}"
if [[ "$VIA_HOST" -eq 1 ]]; then
  echo "  方式: 宿主机 psql → 127.0.0.1:${PG_HOST_PORT}"
else
  echo "  方式: docker compose exec postgres"
  [[ "$USE_DEV" -eq 1 ]] && echo "  Compose: docker-compose.dev.yml（PG 15433）"
fi
echo ""
echo -e "${YELLOW}提示: 脚本应尽量可重复执行；重要数据仍建议先备份。${NC}"
echo ""

ensure_postgres

for f in "${files[@]}"; do
  if [[ "$VIA_HOST" -eq 1 ]]; then
    run_one_via_host "$f"
  else
    run_one_via_compose "$f"
  fi
done

echo ""
echo -e "${GREEN}本地增量迁移完成${NC}"

if [[ "$VIA_HOST" -eq 1 ]]; then
  PGPASSWORD="$PG_PASSWORD" psql -h 127.0.0.1 -p "$PG_HOST_PORT" -U "$PG_USER" -d "$PG_DB" -c "\dt econoverse*" 2>/dev/null || true
else
  compose exec -T postgres psql -U "$PG_USER" -d "$PG_DB" -c "\dt econoverse*" 2>/dev/null || true
fi
