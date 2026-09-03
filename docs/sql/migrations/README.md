# 增量迁移脚本（已有库升级）

本目录用于**已有数据库**的结构演进（DDL/DML），避免破坏现有数据。

## 约定

- **命名**：`00xx_简要描述.sql`（按编号顺序执行，例如 `0042_add_xxx.sql`）。
- **原则**：尽量可重复执行（建议使用 `IF NOT EXISTS`、或先查系统表再 `ALTER`），避免无说明的破坏性操作。
- **范围**：只做本次需求必要的变更；不要把全量建表脚本放到本目录。

## 执行方式

### 本地一键（推荐）

在仓库根目录：

```bash
chmod +x sync-migrations-local.sh   # 首次
./sync-migrations-local.sh
```

- 按文件名排序执行本目录下**全部** `*.sql`（与 `./deploy.sh` 内迁移逻辑一致）。
- 若 Postgres 容器未运行，脚本会尝试 `docker compose up -d postgres`（可用 `--no-up` 关闭）。
- 本地 Node 使用 `docker-compose.dev.yml`（PG **15433**）时：`./sync-migrations-local.sh --dev`
- 已映射端口、想用本机 `psql`：`./sync-migrations-local.sh --via-host`

**线上 / 发版**请继续用 `./deploy.sh`（构建、启服务并顺带跑迁移）。

### 手动单文件（Compose 已运行）

在仓库根目录执行：

```bash
docker compose cp docs/sql/migrations/00xx_描述.sql postgres:/tmp/00xx.sql
docker compose exec postgres psql -v ON_ERROR_STOP=1 -U jiada_shixun -d jiada_shixun -f /tmp/00xx.sql
```

执行前请备份。
