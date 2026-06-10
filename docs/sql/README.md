# 数据库脚本说明

## 空库初始化

在 **`docs/sql` 目录**执行（`\ir` 相对当前目录）：

```bash
cd docs/sql && psql -v ON_ERROR_STOP=1 -U postgres -d your_db -f init_all.sql
```

执行顺序：`000_extensions.sql` → `001_schema.sql` → `002_business.sql` → `003_seed.sql`（含 `\ir 037_colleges_majors_seed.sql`）→ `003_student_teacher_personal_enrollments_view.sql`。

## Docker / 宝塔全新部署

`docker-compose.yml` 仅挂载 [`init/`](init/) 到 Postgres `docker-entrypoint-initdb.d`（**仅数据卷为空时**执行一次）：

| 文件 | 说明 |
|------|------|
| `10_extensions.sql` | 扩展 |
| `20_schema.sql` | 平台核心表 |
| `30_business.sql` | 教师班与实训业务表 |
| `40_seed.sql` | 种子数据（`\ir 37_colleges_majors_seed.sql`） |
| `45_view.sql` | 学生选课视图 |

已有数据卷需重建时：`docker compose down -v` 后再 `up`（会清空库数据）。

## 历史增量

[`archive/incremental/`](archive/incremental/) 存放已合并进 `001` / `002` 的旧编号脚本，不参与初始化。

## 默认管理员

| 字段 | 值 |
|------|-----|
| 用户名 | `admin` |
| 密码 | `jiuan@123` |

生产环境请在登录后立即修改密码，并在管理端「系统配置」中补全 SMTP、模型密钥等。

## 与「无 .env」约定

- 业务参数以 **`system_config` 与 `ai_*` 表**为准，通过 HTTP 管理端维护。
- 容器连通依赖 Compose 内 **`environment:`**（不使用仓库 `.env`）。

## 安全

- 勿将生产 `ai_models.api_key_encrypted` 等密钥提交至公开仓库。

## 维护脚本

| 脚本 | 说明 |
|------|------|
| [`maintenance/reset_student_training_flow.sql`](maintenance/reset_student_training_flow.sql) | 清空学生实训各阶段团队数据、任务完成记录、相关通知与学习/检测进度；**保留**已组队信息、教师课程资源与课程设置、任务定义 |

执行前请备份。编辑脚本内 `v_class_id`：`NULL` 为全部教学班，或填 `teacher_personal_classes.id` 仅清理该班。

```bash
psql -v ON_ERROR_STOP=1 -U postgres -d your_db -f docs/sql/maintenance/reset_student_training_flow.sql
```
