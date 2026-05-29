# 增量迁移脚本（已有库升级）

本目录用于**已有数据库**的结构演进（DDL/DML），避免破坏现有数据。

## 约定

- **命名**：`00xx_简要描述.sql`（按编号顺序执行，例如 `0042_add_xxx.sql`）。
- **原则**：尽量可重复执行（建议使用 `IF NOT EXISTS`、或先查系统表再 `ALTER`），避免无说明的破坏性操作。
- **范围**：只做本次需求必要的变更；不要把全量建表脚本放到本目录。

## 执行方式（Compose 已运行）

在仓库根目录执行：

```bash
docker compose cp docs/sql/migrations/00xx_描述.sql postgres:/tmp/00xx.sql
docker compose exec postgres psql -v ON_ERROR_STOP=1 -U jiada_shixun -d jiada_shixun -f /tmp/00xx.sql
```

执行前请备份。

