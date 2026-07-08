# Docker 编排、首次建库与增量 SQL 说明

本文说明在本仓库使用根目录 `docker-compose.yml` 时：**PostgreSQL 首次如何自动初始化**、**只更新 gateway / node 镜像时为何不会动现有数据**、以及**后期如何用增量 SQL 演进库结构而不破坏已存在的数据**。

---

## 一键部署与验收（快速开始）

**前置条件**：本机已安装 Docker，且能使用 `docker compose`。在**仓库根目录**执行。

### 1）推荐：一键部署

```bash
cd /path/to/jiada_shixun
chmod +x deploy.sh
./deploy.sh
```

脚本会自动：补全 `.env`、预拉基础镜像、构建 `node` 与 `gateway`、启动全部服务并做健康检查。

执行 `./deploy.sh` 后按提示输入 **1**（联网拉取）或 **2**（本地已导入镜像）。jxdx 等慢网机选 **2**；`.env` 中 `DEPLOY_BASE_IMAGES=local` 可作为菜单默认项。另：`--pull-only`、`--skip-build`、`DEPLOY_PRUNE_IMAGES=1`。

手动等价流程：

```bash
docker compose up -d --build
```

**镜像下载慢时**：`.env` 配置 `NODE_IMAGE`、`NGINX_IMAGE`、`POSTGRES_IMAGE`、`REDIS_IMAGE`（建议 `docker.1ms.run/library/...`）；`deploy.sh` 会让 gateway 与 node **共用** `NODE_IMAGE`。拉取时出现的 `~28MB/28.24MB` 是 Node 官方镜像里的**运行时主层**，慢多为出口带宽。可先 `./deploy.sh --pull-only`，或配置 `/etc/docker/daemon.json` 的 `registry-mirrors` 后重启 Docker。也可按下一节在**网络好的机器**拉取后导入目标机。

首次会拉取 `postgres`、`redis` 镜像，并构建 `node`、`gateway`（gateway 内会构建前端静态资源，耗时可能数分钟）。

### 1.1）基础镜像：快机器拉取 → 导入目标服务器

适用于学校/生产机访问镜像站极慢，但你有另一台能较快 `docker pull` 的机器（下称 **A**），目标部署机为 **B**。

**需要打包的 4 个基础镜像**（与默认 `.env.example` 一致；若 B 上 `.env` 改过，A 上 pull 的地址须与 B 的 `.env` 完全相同）：

| 变量 | 默认镜像 |
|------|----------|
| `NODE_IMAGE` | `docker.1ms.run/library/node:20-bookworm-slim` |
| `NGINX_IMAGE` | `docker.1ms.run/library/nginx:1.27-alpine` |
| `POSTGRES_IMAGE` | `postgres:15-alpine`（勿用 1ms 前缀，该站常无 postgres 清单） |
| `REDIS_IMAGE` | `docker.1ms.run/library/redis:7-alpine` |

**架构**：B 多为 `linux/amd64`。若 A 是 Apple Silicon Mac，拉取与 `docker run` 校验时必须加 `--platform linux/amd64`，否则 B 上会报 platform 不匹配或层损坏。

#### 在 A 上：逐个拉取、校验、单独 save

```bash
# B 为 x86 Ubuntu 时在 Mac 上执行（A 本身已是 amd64 可去掉 PLATFORM 相关参数）
export PLATFORM=linux/amd64
PULL=(docker pull --platform "$PLATFORM")
RUN=(docker run --rm --platform "$PLATFORM")

# 1) node
${PULL[@]} docker.1ms.run/library/node:20-bookworm-slim
docker save -o base-node-20-bookworm-slim.tar docker.1ms.run/library/node:20-bookworm-slim

# 2) nginx
${PULL[@]} docker.1ms.run/library/nginx:1.27-alpine
docker save -o base-nginx-1.27-alpine.tar docker.1ms.run/library/nginx:1.27-alpine

# 3) postgres（勿用 1ms 前缀；须拉完整后再 save）
${PULL[@]} postgres:15-alpine
${RUN[@]} postgres:15-alpine postgres --version
docker save -o base-postgres-15-alpine.tar postgres:15-alpine

# 4) redis
${PULL[@]} docker.1ms.run/library/redis:7-alpine
${RUN[@]} docker.1ms.run/library/redis:7-alpine redis-server --version
docker save -o base-redis-7-alpine.tar docker.1ms.run/library/redis:7-alpine
```

传到 B（示例，四个文件分开传，失败可只重传某一个）：

```bash
scp base-*.tar root@目标服务器IP:/www/wwwroot/cxsx.zjxu.edu.cn/
```

#### 在 B 上：逐个 load、核对架构

```bash
cd /www/wwwroot/cxsx.zjxu.edu.cn

# 若曾导入过错误架构或残缺层，可先删掉对应 tag 再 load
docker load -i base-node-20-bookworm-slim.tar
docker load -i base-nginx-1.27-alpine.tar
docker load -i base-postgres-15-alpine.tar
docker load -i base-redis-7-alpine.tar

docker run --rm postgres:15-alpine postgres --version
docker run --rm docker.1ms.run/library/redis:7-alpine redis-server --version

for img in \
  docker.1ms.run/library/node:20-bookworm-slim \
  docker.1ms.run/library/nginx:1.27-alpine \
  postgres:15-alpine \
  docker.1ms.run/library/redis:7-alpine
do
  docker image inspect "$img" --format '{{.Repository}}:{{.Tag}} {{.Os}}/{{.Architecture}}'
done
# 期望均为 linux/amd64

grep '^POSTGRES_IMAGE=' .env   # 须为 postgres:15-alpine

chmod +x deploy.sh
./deploy.sh
```

慢网机 `docker load` 后运行 `./deploy.sh` 并选 **2**。local 模式下强制再联网拉基础镜像：`DEPLOY_FORCE_BASE_PULL=1` 且选 **2**。

导入后 **不必**再能从外网拉齐这 4 个基础层；`deploy.sh` 仍会 **在本机构建** `node`、`gateway` 业务镜像（编译前端、安装 LibreOffice 等），这部分与带宽无关，但比反复拉基础镜像省很多时间。

#### 可选：连业务镜像一起在 A 构建后导入

若希望 B **几乎不再 build**（A 与 B 需 **同架构**，一般为 `linux/amd64`）：

1. 在 A 上克隆同版本代码，配置与 B 相同的 `.env`，执行 `docker compose build node gateway`。
2. 在 A 上查看镜像名：`docker images | grep -E 'node|gateway'`（名称常带 Compose 项目目录前缀，如 `cxsxzjxueducn-node`）。
3. `docker save -o jiada_shixun-built.tar <node镜像名> <gateway镜像名>`，传到 B 后 `docker load`。
4. B 上 `docker compose up -d` 时需能用到同名镜像；若项目目录名不同导致镜像名不一致，可在 B 上对导入的镜像 `docker tag 旧名 新名` 后再启动。

一般**只导入基础镜像**即可解决「28MB 层拉一天」的问题；业务镜像仍在 B 构建一次即可。

### 2）查看容器是否就绪

```bash
docker compose ps
```

期望四个服务均为 `running`，且 `postgres`、`redis` 的健康检查已通过（ healthy ）。若 `gateway` 很快 `Up` 而 `node` 仍在启动，可稍等再测接口。

查看日志（排错）：

```bash
docker compose logs -f node gateway
# Ctrl+C 退出跟随
```

### 3）接口验收（经网关，与浏览器同域）

在宿主机执行（gateway 默认映射 **18081**，与宝塔反代一致）：

```bash
curl -sS http://127.0.0.1:18081/api/health/live
curl -sS http://127.0.0.1:18081/api/health/ready
```

期望返回 JSON 中含 `"code":0`（或业务约定的成功字段）。`ready` 若返回 503，多为数据库或 Redis 未连上，可看 `docker compose logs postgres redis node`。

**登录接口**（种子管理员，密码见 [`docs/sql/README.md`](../sql/README.md)）：

```bash
curl -sS -X POST http://127.0.0.1:18081/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"jiuan@123"}'
```

期望返回带 `token` 的 JSON，表示鉴权与数据库用户数据正常。

### 4）浏览器验收

- 经域名访问需宝塔反代到 `127.0.0.1:18081`（见 [`docs/nginx/部署说明.md`](../nginx/部署说明.md) 与 [`baota-site.conf`](../nginx/baota-site.conf)），勿指到 4000/其他项目端口。
- 直连网关自检：`http://服务器IP:18081`

### 5）停止与再次启动（不删数据）

```bash
docker compose stop      # 停止
docker compose start     # 再启动（沿用原卷）
```

**不要**在需要保留数据时使用 `docker compose down -v`（`-v` 会删除命名卷，清空 PostgreSQL、Redis 与已上传课件文件）。

### 6）宿主机直连 PG / Redis

**服务器**（默认 `docker-compose.yml`）：PostgreSQL 映射 **`15434`** → 容器 5432（与同机其他项目占用的 15433 错开）。

**本地** `npm run dev:local`（15433 / 16380）：

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres redis
```

`docker-compose.dev.yml` 会把 PG 端口改回 **15433**。

| 场景 | PostgreSQL 宿主端口 |
|------|---------------------|
| 服务器仅 compose | `15434` |
| 本地 + dev 覆盖 | `15433` |

容器内 `node` 始终用 `postgres:5432`、`redis:6379`。

---

## 1. Compose 服务与数据持久化

| 服务 | 作用 | 持久化 |
|------|------|--------|
| `postgres` | 主库 | 命名卷 `jiada_shixun`（表结构 + 业务数据） |
| `redis` | 缓存 / 会话等 | 命名卷 `redisdata`（AOF 等） |
| `node` | API | 命名卷 `node_uploads`（课件、附件等上传文件） |
| `gateway` | Nginx + 前端静态 | **无状态**；镜像内会执行 `pnpm run build`（内存占用高） |

**gateway 镜像构建**：前端约 4000+ 模块，Vite 在 `rendering chunks` 阶段峰值内存常超过 2GB。若 ECS 仅 2GB 且无 swap，会出现日志停在某一步、整机卡死（实为内存耗尽/OOM）。建议：构建前 `docker compose stop` 其它服务；为系统增加 **2GB swap**；或在本机/CI 构建后 `docker save`/`load` 再部署。仓库已在 `Dockerfile.gateway` 设置 `NODE_OPTIONS=--max-old-space-size=2048`，并在生产构建关闭 sourcemap 以减轻峰值。

执行常见更新命令时：

```bash
docker compose build --no-cache gateway node   # 仅重建镜像
docker compose up -d gateway node             # 仅滚动替换这两类容器
```

上述操作**默认不会删除** `jiada_shixun`、`redisdata`、`node_uploads`。只要**没有**对卷执行 `docker volume rm`、也没有带 `down -v` 的全量清理，**PostgreSQL 里已有库表和数据、Redis 里已有数据、已上传课件文件会原样保留**。

后端 `node` 镜像内已安装 LibreOffice 与常用中文字体，用于将 DOC/DOCX/PPT/PPTX/XLS/XLSX 转为 PDF 在线预览。默认环境变量为：

```yaml
LIBREOFFICE_BIN: /usr/bin/soffice
```

如自定义后端镜像或基础系统，请确保该路径可执行，或在 `docker-compose.yml` 中调整 `LIBREOFFICE_BIN`。

`node` 镜像在 [`node/Dockerfile`](../node/Dockerfile) 中一次性安装 LibreOffice；默认 `docker.1ms.run` 拉取 Node 基础镜像，apt 使用 **阿里云 Debian 源**（云服务器访问清华源易出现 403）。

---

## 2. 首次启动：为什么能自动初始化 PostgreSQL

官方 `postgres` 镜像约定：只有当数据目录 **`/var/lib/postgresql/data` 为空**（即第一次创建该卷）时，才会执行 `/docker-entrypoint-initdb.d/` 下的脚本。

本仓库将该目录挂载为只读：

```yaml
volumes:
  - jiada_shixun:/var/lib/postgresql/data
  - ./docs/sql/init:/docker-entrypoint-initdb.d:ro
```

因此：

- **第一次** `docker compose up` 且 `jiada_shixun` 为新卷时：会按**文件名排序**依次执行 [`docs/sql/init/`](../sql/init/) 下的 `10_extensions.sql`、`20_schema.sql`、`30_business.sql`、`40_seed.sql`、`45_view.sql`（见 [`docs/sql/README.md`](../sql/README.md)）。
- **之后**再次 `up`、或只重建 `node` / `gateway`：**不会**再次跑 `initdb.d`（数据目录已非空），**这是预期行为**，避免覆盖生产数据。

若你希望「像新环境一样」重新跑一遍全量脚本，只能**在新卷上**做（见下文「重建开发库」），而不要指望改挂载目录里的 SQL 会自动在旧卷上再执行一遍。

---

## 3. 日常发布：只更新 Web / Node 时的推荐流程

目标：**升级前端静态资源与 Node API，不改变 PG/Redis 结构与业务数据**。

1. 拉取代码后重建并启动（示例）：
   ```bash
   docker compose build gateway node
   docker compose up -d gateway node
   ```
2. 若 Compose 未改 `postgres` / `redis` 服务定义，一般**无需**重建数据库容器；数据卷继续挂载在原容器上。课件上传文件由 `node_uploads` 卷持久化，只重建 `node` 镜像不会丢失。
3. **不要**在正式/共享环境使用：
   ```bash
   docker compose down -v
   ```
   `-v` 会删除命名卷，导致 **PostgreSQL、Redis 与已上传课件文件一并清空**。

Node 进程级环境变量（如 `DATABASE_URL`、`REDIS_URL`）写在 `docker-compose.yml` 的 `environment` 中；**业务配置**仍以库表 `system_config` 等为准，见设计文档与 `docs/sql/README.md`。

---

## 4. 后期库结构演进：增量 SQL（不影响未提及的表与数据）

空库全量见 `docs/sql/init/`（Docker）或 `docs/sql/init_all.sql`（手动 psql）。已有环境上的变更应使用**增量迁移脚本**，原则如下：

1. **幂等与可重复审阅**：每条迁移尽量可安全执行一次；复杂场景用 `IF NOT EXISTS`、或先查系统表再 `ALTER`，避免二次执行直接报错（团队可约定是否配合迁移记录表）。
2. **禁止**在增量脚本里随意 `DROP DATABASE`、大范围无备份 `TRUNCATE`、或对生产库不做说明的破坏性 `DROP COLUMN`。
3. **存放位置**：将新文件放在 [`docs/sql/migrations/`](sql/migrations/)，命名与执行顺序见该目录下 `README.md`。
4. **一键部署**：根目录 [`./deploy.sh`](../../deploy.sh) 在 `postgres` 健康检查通过后，会**按文件名排序**自动执行 `docs/sql/migrations/*.sql`（脚本需可重复执行）。发版后执行 `./deploy.sh` 即可带上增量 DDL；若仅 `./deploy.sh --skip-build`，仍会跑迁移。
5. **手动执行（在已有 Compose 跑起来的前提下）**，在宿主机执行：
   ```bash
   # 将新文件复制进容器可读路径，或使用 stdin / bind mount
   docker compose cp docs/sql/migrations/00xx_描述.sql postgres:/tmp/00xx.sql
   docker compose exec postgres psql -v ON_ERROR_STOP=1 -U jiada_shixun -d jiada_shixun -f /tmp/00xx.sql
   ```
   **执行前请备份**。

6. **Redis**：结构变更一般**不**通过 SQL 维护；更新应用后如需刷新缓存，可依赖 TTL、或在发版说明中约定短时间内的缓存不一致可接受；必要时运维对特定 key 前缀做清理（需评估业务影响）。

---

## 5. 开发环境：如何「从零」再建一次 PostgreSQL

仅适用于**可丢弃本地数据**的场景：

```bash
docker compose down
docker volume rm jiada_shixun_jiada_shixun   # 卷名以 docker volume ls 为准（默认：项目名_卷名）
docker compose up -d postgres
# 新卷会再次执行 docker-entrypoint-initdb.d 下的全量 SQL
```

**不要**在生产环境对已有卷做上述删除。

---

## 6. 与健康检查、联网相关

- API：`GET /api/health/live`、`/api/health/ready`（依赖 PG + Redis）。
- 入口：`gateway` 映射宿主 **`18081:80`**（可用环境变量 `GATEWAY_PORT` 修改左侧端口）；宝塔整站反代见 `docs/nginx/部署说明.md`。

---

## 7. 相关文档

- SQL 全量文件与默认账号：[../sql/README.md](../sql/README.md)
- 增量脚本约定：[../sql/migrations/README.md](../sql/migrations/README.md)
- 业务与缓存设计：[../实训平台项目设计方案.md](../实训平台项目设计方案.md)（数据库章、Redis 章）
