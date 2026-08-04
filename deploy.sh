#!/usr/bin/env bash
# 创业实训平台 — 一键部署（在仓库根目录执行: chmod +x deploy.sh && ./deploy.sh）
# 自动：检查 Docker → 生成/补全 .env → 预拉镜像 → 构建 node/gateway → 启动并验收

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

NO_CACHE=""
SKIP_BUILD=0
PULL_ONLY=0
# 基础镜像：online=始终 docker pull；local=本地已有则跳过（适合 docker load 导入）
CLI_BASE_IMAGES_MODE=""

usage() {
  echo "用法: $0 [选项]"
  echo "  直接执行 $0 后按提示输入数字选择基础镜像方式"
  echo "  --no-cache     构建 gateway/node 时不使用缓存"
  echo "  --skip-build   不构建镜像，仅 docker compose up -d"
  echo "  --pull-only    仅预拉基础镜像（不构建、不启动）"
  echo "  -h, --help     显示帮助"
  echo ""
  echo "非交互（无 TTY）时读取 .env 中 DEPLOY_BASE_IMAGES=online|local，默认 online"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-cache) NO_CACHE="--no-cache"; shift ;;
    --skip-build) SKIP_BUILD=1; shift ;;
    --pull-only) PULL_ONLY=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo -e "${RED}未知参数: $1${NC}"; usage; exit 1 ;;
  esac
done

compose() {
  if docker compose version &>/dev/null; then
    docker compose "$@"
  elif command -v docker-compose &>/dev/null; then
    docker-compose "$@"
  else
    echo -e "${RED}未找到 docker compose / docker-compose${NC}"
    exit 1
  fi
}

check_docker() {
  echo -e "${BLUE}检查 Docker 环境...${NC}"
  if ! command -v docker &>/dev/null; then
    if [[ "$(uname -s)" == "Linux" ]] && [[ -t 0 ]]; then
      echo -e "${YELLOW}Docker 未安装，尝试通过 get.docker.com 安装（需 root）...${NC}"
      curl -fsSL https://get.docker.com | bash
      systemctl start docker 2>/dev/null || true
      systemctl enable docker 2>/dev/null || true
    else
      echo -e "${RED}请先安装 Docker Desktop 或 Docker Engine${NC}"
      exit 1
    fi
  fi
  echo -e "${GREEN}Docker: $(docker --version)${NC}"
  if docker compose version &>/dev/null; then
    echo -e "${GREEN}Compose: $(docker compose version)${NC}"
  else
    echo -e "${GREEN}Compose: $(docker-compose --version)${NC}"
  fi
}

check_prerequisites() {
  echo -e "${BLUE}检查项目文件...${NC}"
  for f in .env.example docker-compose.yml Dockerfile.gateway node/Dockerfile \
    deploy/nginx/default.conf web/package.json web/pnpm-lock.yaml \
    game/package.json game/pnpm-lock.yaml docs/sql/init/20_schema.sql; do
    if [[ ! -f "$f" ]]; then
      echo -e "${RED}缺少文件: $f（请在仓库根目录执行本脚本）${NC}"
      exit 1
    fi
  done
  echo -e "${GREEN}项目结构检查通过${NC}"
}

load_env_file() {
  set -a
  # shellcheck disable=SC1091
  source "$1"
  set +a
}

merge_env_from_example() {
  if [[ ! -f .env ]]; then
    cp .env.example .env
    echo -e "${GREEN}已从 .env.example 生成 .env${NC}"
    return
  fi
  local added=0
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%%$'\r'}"
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" != *"="* ]] && continue
    local key="${line%%=*}"
    key="${key#"${key%%[![:space:]]*}"}"
    key="${key%"${key##*[![:space:]]}"}"
    [[ -z "$key" ]] && continue
    if ! grep -q "^${key}=" .env 2>/dev/null; then
      echo "$line" >> .env
      added=1
    fi
  done < .env.example
  if [[ "$added" -eq 1 ]]; then
    echo -e "${GREEN}已向 .env 补全 .env.example 中的新配置项（未覆盖已有项）${NC}"
  else
    echo -e "${GREEN}使用已有 .env${NC}"
  fi
}

setup_env() {
  echo -e "${BLUE}配置环境变量 (.env)...${NC}"
  if [[ ! -f .env.example ]]; then
    echo -e "${RED}缺少 .env.example${NC}"
    exit 1
  fi
  merge_env_from_example
  load_env_file .env
  GATEWAY_PORT="${GATEWAY_PORT:-18081}"
  POSTGRES_HOST_PORT="${POSTGRES_HOST_PORT:-15434}"
  NODE_IMAGE="${NODE_IMAGE:-docker.1ms.run/library/node:20-bookworm-slim}"
  # gateway 前端构建与 node API 强制共用 NODE_IMAGE，避免 .env 里误配 node:22-alpine 再拉一套大层
  if [[ -n "${WEB_BUILD_NODE_IMAGE:-}" && "${WEB_BUILD_NODE_IMAGE}" != "${NODE_IMAGE}" ]]; then
    echo -e "${YELLOW}  已将 WEB_BUILD_NODE_IMAGE 对齐为 NODE_IMAGE（不再单独拉 node:22-alpine 等）${NC}"
  fi
  WEB_BUILD_NODE_IMAGE="$NODE_IMAGE"
  NGINX_IMAGE="${NGINX_IMAGE:-docker.1ms.run/library/nginx:1.27-alpine}"
  POSTGRES_IMAGE="${POSTGRES_IMAGE:-postgres:15-alpine}"
  if [[ "$POSTGRES_IMAGE" == *"1ms"* && "$POSTGRES_IMAGE" == *"postgres"* ]]; then
    echo -e "${YELLOW}  POSTGRES_IMAGE 已改为 postgres:15-alpine（与 docker load 标签一致；1ms 无 postgres 清单）${NC}"
    POSTGRES_IMAGE="postgres:15-alpine"
    if grep -q '^POSTGRES_IMAGE=' .env 2>/dev/null; then
      sed -i.bak 's|^POSTGRES_IMAGE=.*|POSTGRES_IMAGE=postgres:15-alpine|' .env
    fi
  fi
  REDIS_IMAGE="${REDIS_IMAGE:-docker.1ms.run/library/redis:7-alpine}"
  export GATEWAY_PORT POSTGRES_HOST_PORT NODE_IMAGE WEB_BUILD_NODE_IMAGE NGINX_IMAGE POSTGRES_IMAGE REDIS_IMAGE
  echo "  GATEWAY_PORT=${GATEWAY_PORT}"
  echo "  POSTGRES_HOST_PORT=${POSTGRES_HOST_PORT}"
  echo "  POSTGRES_DB=${POSTGRES_DB:-jiada_shixun}"
  echo "  NODE_IMAGE=${NODE_IMAGE}"
  echo "  WEB_BUILD_NODE_IMAGE=${WEB_BUILD_NODE_IMAGE}"
  echo "  POSTGRES_IMAGE=${POSTGRES_IMAGE}"
}

prompt_base_images_mode() {
  if [[ -n "$CLI_BASE_IMAGES_MODE" ]]; then
    return 0
  fi
  if [[ ! -t 0 ]]; then
    return 0
  fi
  local default_num=1
  case "${DEPLOY_BASE_IMAGES:-online}" in
    local) default_num=2 ;;
  esac
  echo ""
  echo -e "${BLUE}请选择基础镜像获取方式：${NC}"
  echo "  1) 联网拉取（网络通畅的服务器）"
  echo "  2) 使用本地镜像（已 docker load 导入，跳过拉取）"
  local choice=""
  read -r -p "请输入序号 [${default_num}]: " choice
  if [[ -z "$choice" ]]; then
    choice="$default_num"
  fi
  case "$choice" in
    1) CLI_BASE_IMAGES_MODE="online" ;;
    2) CLI_BASE_IMAGES_MODE="local" ;;
    *)
      echo -e "${YELLOW}无效序号，已使用默认 ${default_num}${NC}"
      [[ "$default_num" -eq 2 ]] && CLI_BASE_IMAGES_MODE="local" || CLI_BASE_IMAGES_MODE="online"
      ;;
  esac
}

resolve_base_images_mode() {
  if [[ -n "$CLI_BASE_IMAGES_MODE" ]]; then
    BASE_IMAGES_MODE="$CLI_BASE_IMAGES_MODE"
  else
    BASE_IMAGES_MODE="${DEPLOY_BASE_IMAGES:-online}"
  fi
  case "$BASE_IMAGES_MODE" in
    online|local) ;;
    *)
      echo -e "${YELLOW}  DEPLOY_BASE_IMAGES 无效（${BASE_IMAGES_MODE}），已用 online${NC}"
      BASE_IMAGES_MODE="online"
      ;;
  esac
  export BASE_IMAGES_MODE
}

print_mirror_hint_once() {
  if [[ "$BASE_IMAGES_MODE" == "local" ]]; then
    echo -e "${YELLOW}当前：本地镜像模式（已有则跳过 pull）${NC}"
  else
    echo -e "${YELLOW}当前：联网拉取基础镜像${NC}"
  fi
}

pre_pull_base_images() {
  echo -e "${BLUE}预拉取基础镜像 [${BASE_IMAGES_MODE}]（node 约 70MB 分层，慢多为带宽/镜像站）...${NC}"
  local imgs=()
  imgs+=("$NODE_IMAGE")
  imgs+=("$NGINX_IMAGE" "$POSTGRES_IMAGE" "$REDIS_IMAGE")
  for img in "${imgs[@]}"; do
    if [[ "$BASE_IMAGES_MODE" == "local" && "${DEPLOY_FORCE_BASE_PULL:-0}" != "1" ]] \
      && docker image inspect "$img" >/dev/null 2>&1; then
      echo -e "  ${GREEN}本地已有，跳过拉取: ${img}${NC}"
      continue
    fi
    echo "  docker pull $img"
    docker pull "$img" || echo -e "${YELLOW}  拉取失败（可稍后重试）: $img${NC}"
  done
  echo -e "${GREEN}预拉取完成${NC}"
}

wait_healthy() {
  local service="$1"
  local max="${2:-60}"
  echo -e "${BLUE}等待 ${service} 健康检查...${NC}"
  for ((i = 1; i <= max; i++)); do
    if compose ps "$service" 2>/dev/null | grep -q "(healthy)"; then
      echo -e "${GREEN}${service} 已就绪${NC}"
      return 0
    fi
    if compose ps "$service" 2>/dev/null | grep -q "Up"; then
      if [[ "$service" == "redis" || "$service" == "postgres" ]]; then
        :
      else
        return 0
      fi
    fi
    sleep 2
    echo -n "."
  done
  echo ""
  echo -e "${YELLOW}${service} 未在预期时间内变为 healthy，请查看: compose logs ${service}${NC}"
  return 1
}

# 已有库增量 DDL：docs/sql/migrations/*.sql（按文件名排序，脚本需可重复执行）
run_sql_migrations() {
  local mig_dir="${ROOT_DIR}/docs/sql/migrations"
  if [[ ! -d "$mig_dir" ]]; then
    echo -e "${YELLOW}未找到迁移目录 ${mig_dir}，跳过 SQL 迁移${NC}"
    return 0
  fi
  local files=()
  local f
  shopt -s nullglob
  for f in "$mig_dir"/*.sql; do
    files+=("$f")
  done
  shopt -u nullglob
  if [[ ${#files[@]} -eq 0 ]]; then
    echo -e "${GREEN}无增量迁移脚本${NC}"
    return 0
  fi
  IFS=$'\n' files=($(printf '%s\n' "${files[@]}" | sort))
  unset IFS

  local pg_user="${POSTGRES_USER:-jiada_shixun}"
  local pg_db="${POSTGRES_DB:-jiada_shixun}"
  echo -e "${BLUE}执行数据库增量迁移（${#files[@]} 个脚本）...${NC}"
  for f in "${files[@]}"; do
    local base
    base="$(basename "$f")"
    echo "  → ${base}"
    compose cp "$f" "postgres:/tmp/${base}" >/dev/null
    if ! compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "$pg_user" -d "$pg_db" -f "/tmp/${base}"; then
      echo -e "${RED}迁移失败: ${base}（请先备份库后排查；可单独执行见 docs/sql/migrations/README.md）${NC}"
      return 1
    fi
  done
  echo -e "${GREEN}增量迁移完成${NC}"
}

wait_api() {
  local url="http://127.0.0.1:${GATEWAY_PORT}/api/health/live"
  echo -e "${BLUE}检查 API: ${url}${NC}"
  for ((i = 1; i <= 45; i++)); do
    if curl -fsS "$url" 2>/dev/null | grep -q '"code"'; then
      echo -e "${GREEN}API 健康检查通过${NC}"
      return 0
    fi
    sleep 2
    echo -n "."
  done
  echo ""
  return 1
}

deploy() {
  export GATEWAY_PORT NODE_IMAGE WEB_BUILD_NODE_IMAGE NGINX_IMAGE POSTGRES_IMAGE REDIS_IMAGE

  echo -e "${YELLOW}停止旧容器（保留数据卷）...${NC}"
  compose down --remove-orphans 2>/dev/null || true

  if [[ "${DEPLOY_PRUNE_IMAGES:-0}" == "1" ]]; then
    docker image prune -f || true
  fi

  if [[ "$SKIP_BUILD" -eq 0 ]]; then
    pre_pull_base_images
    echo -e "${YELLOW}构建 node → gateway（先 API 后前端，共用 Node 基础层；Vite 打包仍可能较久）...${NC}"
    export DOCKER_BUILDKIT=1
    export COMPOSE_DOCKER_CLI_BUILD=1
    # shellcheck disable=SC2086
    compose build $NO_CACHE node
    # shellcheck disable=SC2086
    compose build $NO_CACHE gateway
  else
    echo -e "${YELLOW}跳过构建，直接启动...${NC}"
  fi

  echo -e "${YELLOW}启动全部服务...${NC}"
  compose up -d

  wait_healthy postgres 60 || true
  wait_healthy redis 40 || true
  run_sql_migrations || exit 1
  sleep 3

  echo ""
  compose ps

  if wait_api; then
    curl -fsS "http://127.0.0.1:${GATEWAY_PORT}/api/health/ready" 2>/dev/null || true
    echo ""
  fi

  local host_ip=""
  if command -v hostname &>/dev/null; then
    host_ip="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
  fi

  echo ""
  if curl -fsS "http://127.0.0.1:${GATEWAY_PORT}/api/health/live" 2>/dev/null | grep -q '"code"'; then
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}部署完成${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "${BLUE}访问地址:${NC}"
    echo "  本机: http://127.0.0.1:${GATEWAY_PORT}"
    if [[ -n "$host_ip" ]]; then
      echo "  局域网/外网 IP: http://${host_ip}:${GATEWAY_PORT}"
    fi
    echo ""
    echo -e "${BLUE}默认管理员（首次登录后请改密）:${NC}"
    echo "  用户名: admin"
    echo "  密码: jiuan@123"
    echo ""
    echo -e "${BLUE}PostgreSQL（宿主机）:${NC}"
    echo "  端口: ${POSTGRES_HOST_PORT:-15434}  库/用户: ${POSTGRES_DB:-jiada_shixun}"
    echo ""
    echo -e "${BLUE}常用命令:${NC}"
    echo "  查看日志: docker compose logs -f gateway node"
    echo "  停止服务: docker compose down"
    echo "  再次部署: ./deploy.sh"
    echo "  仅更新应用: ./deploy.sh   # 或 DEPLOY_PRUNE_IMAGES=0 ./deploy.sh --skip-build 后手动 build"
    echo ""
    echo -e "${YELLOW}勿对生产环境使用 compose down -v（会清空数据库与上传文件）${NC}"
    show_baota_hint
  else
    echo -e "${RED}服务可能未就绪，请检查日志:${NC}"
    echo "  docker compose logs -f gateway node postgres redis"
    exit 1
  fi
}

show_baota_hint() {
  echo -e "${BLUE}宝塔建议:${NC}"
  echo "  1. 网站 → 反向代理到 http://127.0.0.1:${GATEWAY_PORT}"
  echo "  2. 详见 docs/nginx/部署说明.md"
  echo ""
}

main() {
  echo "========================================"
  echo "创业实训平台 — Docker 一键部署"
  echo "========================================"
  check_docker
  check_prerequisites
  setup_env
  prompt_base_images_mode
  resolve_base_images_mode
  echo "  基础镜像方式: ${BASE_IMAGES_MODE}"
  print_mirror_hint_once
  if [[ "$PULL_ONLY" -eq 1 ]]; then
    pre_pull_base_images
    exit 0
  fi
  deploy
}

main "$@"
