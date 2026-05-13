# 数据库脚本说明

## 文件与顺序

在**空库**中按编号执行（`ON_ERROR_STOP` 建议在失败时中断）：

```bash
psql -v ON_ERROR_STOP=1 -U postgres -d your_db -f docs/sql/000_extensions.sql
psql -v ON_ERROR_STOP=1 -U postgres -d your_db -f docs/sql/001_schema.sql
psql -v ON_ERROR_STOP=1 -U postgres -d your_db -f docs/sql/002_rls_notes.sql
psql -v ON_ERROR_STOP=1 -U postgres -d your_db -f docs/sql/003_seed.sql
```

Docker 首次初始化可将本目录挂载到 Postgres 容器的 `/docker-entrypoint-initdb.d/`（仅**第一次**建数据目录时执行）。

**已有库上的结构变更**请使用 [`migrations/`](migrations/) 下的增量脚本，执行方式见 [`Docker部署与数据迁移说明.md`](../docker/Docker部署与数据迁移说明.md)。

## 默认管理员

| 字段 | 值 |
|------|-----|
| 用户名 | `admin` |
| 密码 | `jiuan@123` |

生产环境请在登录后立即修改密码，并在管理端「系统配置」中补全 SMTP、模型密钥等。

## 与「无 .env」约定

- 业务参数（站点、邮件、短信、AI 限流、模型密钥等）以 **`system_config` 与 `ai_*` 表**为准，通过 HTTP 管理端维护。
- 容器之间连通仍依赖 Compose 文件内 **`environment:`** 中的数据库主机名、Redis 地址等（**不使用仓库内 `.env` 文件**）。

## 安全

- 勿将生产 `ai_models.api_key_encrypted` 等密钥提交至公开仓库；导入 seed 后仅限内网调试。
