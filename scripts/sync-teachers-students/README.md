# 测试机 → 正式机：师生与行政班级数据同步

运维误把师生导入**测试服务器**时，用本目录脚本从测试库导出，再在正式库**按用户名/班级编码合并**（两台机器 ID 不同也能用）。

## 范围

| 包含 | 说明 |
|------|------|
| `colleges` / `majors` | 导出包内用到的学院、专业（按名称 upsert） |
| `users` | 仅 `teacher`、`student`（**不含 admin**） |
| `classes` | 行政班（按 `code` upsert） |
| `class_students` | 学生与行政班关系 |

| 不包含 | 说明 |
|--------|------|
| 教师个性化班 `teacher_personal_classes`、实训作业、云存档等 | 若也需要迁，需单独评估或全库恢复 |

## 一、测试服务器（导出）

```bash
cd /www/wwwroot/测试站点目录   # 含 docker-compose.yml 的 jiada_shixun 根目录
git pull   # 确保有 scripts/sync-teachers-students/

chmod +x scripts/sync-teachers-students/export-from-test.sh
./scripts/sync-teachers-students/export-from-test.sh
# 生成 ./sync-export-YYYYMMDD-HHMMSS/

tar czf sync-export.tgz sync-export-*
scp sync-export.tgz root@正式机IP:/www/wwwroot/正式站点目录/
```

## 二、正式服务器（导入）

```bash
cd /www/wwwroot/正式站点目录
tar xzf sync-export.tgz

chmod +x scripts/sync-teachers-students/import-to-prod.sh

# 第一次会提示确认；脚本会自动 gzip 备份整库到 backups/
CONFIRM_PROD=YES ./scripts/sync-teachers-students/import-to-prod.sh ./sync-export-YYYYMMDD-HHMMSS
```

## 三、合并策略（正式库）

- **users**：`username` 冲突则**更新**密码、姓名、学院、专业等（测试机数据覆盖同名校）
- **classes**：`code` 冲突则更新
- **class_students**：同班同学生则更新 `joined_at`
- **admin** 账号不导出、不删除

## 四、导入前请确认

1. 正式机学院/专业名称与测试机**一致**（如「外国语学院」「日语(专升本)」）；不一致先在正式机补专业或改 CSV。
2. 正式机 `.env` 中 `POSTGRES_USER` / `POSTGRES_DB` 与 compose 一致。
3. 导入后：`docker compose restart node`（可选，清连接池缓存）。

## 五、验收

- 管理后台 → 用户管理：师生数量、学院专业是否正确
- 班级管理：人数是否与测试一致
- 抽 2～3 个学生账号登录学生中心

## 六、回滚

使用导入前自动生成的备份：

```bash
gunzip -c backups/before-sync-teachers-students-*.sql.gz | \
  docker compose exec -T postgres psql -U jiada_shixun -d jiada_shixun
```

（会覆盖当前整库，仅在导入严重出错时使用。）
