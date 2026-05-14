# 增量 SQL（已有库演进）

本目录放 **在 `000`～`003` 全量初始化之后**、针对**已有数据**的变更脚本。

## 命名建议

按**执行顺序**前缀编号，便于评审与执行：

- `004_sms_biz_and_aliyun_expand.sql`：为已有库补充 `sms_biz_config`，并为 `aliyun_sms_config` 合并地域与三模板等字段（幂等 `ON CONFLICT DO NOTHING` + `jsonb ||`）。
- `005_create_notification_preferences.sql`（示例）

或使用日期前缀（多人协作时更直观）：

- `20260507_add_idx_quiz_attempts.sql`

**避免**与 `docs/sql/` 根目录下的 `000`～`003` 编号冲突；根目录脚本用于 **initdb 首次空库**，不要往根目录叠加「仅适合已有库」的迁移，以免新环境 init 与旧环境迁移混淆。

## 编写要点

- 尽量 **向后兼容**：优先 `ADD COLUMN DEFAULT`、`CREATE INDEX CONCURRENTLY`（若在会话外单独执行）等。
- 需要回填数据时，分步：`ADD COLUMN` → `UPDATE` → 必要时再加约束。
- 执行前在目标环境 **备份**（`pg_dump` 或云厂商快照）。

## 在 Docker 内执行示例

```bash
docker compose exec postgres psql -v ON_ERROR_STOP=1 -U jiada -d jiada -f /path/in/container/to/004_xxx.sql
```

若需从宿主机传入文件，可用 `docker compose cp` 拷贝进容器后再 `-f`。

## 可选：迁移记录表（团队自建）

可在库内维护例如 `schema_migrations(version text primary key, applied_at timestamptz)`，执行成功后再 `INSERT`，避免重复执行；本期不强制，由项目约定。
