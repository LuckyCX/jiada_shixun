# 创想小镇 · 沙盒（PixiJS V0.1）

独立于主站 `web` 的 2D 小镇沙盒，对照创业实训七阶段。详见 [`docs/PRD/小镇创业实训游戏PRD.md`](../docs/PRD/小镇创业实训游戏PRD.md)。

## 本地开发

```bash
cd game
pnpm install
pnpm dev
# http://localhost:5174/town-sandbox/
```

## 构建

```bash
pnpm --dir game build
# 产物：game/dist → 部署到站点 /town-sandbox/
```

Docker gateway 镜像会同时构建 `web` 与 `game`，静态目录为 `/usr/share/nginx/html/town-sandbox/`。

## 操作

| 操作 | 作用 |
|------|------|
| 鼠标左键点击地面 | 移动到目标点 |
| 点击 NPC / 门口 | 走近后自动对话 / 进入建筑 |
| 任务日志「前往对话」 | 走向阶段 NPC 并打开对话 |
| WASD / 方向键 | 备用移动 |
| Shift | 奔跑 |
| E / 空格 | 近距离互动 / 对话下一句 |
| J | 任务日志 |
| M | 地图 |
| Esc | 设置 / 关闭面板 |

主站开发时访问 `/town-sandbox/` 会由 `web` Vite 代理到本服务（需同时跑 `pnpm --dir web dev` 与 `pnpm --dir game dev`）。

## 占位美术与换皮

当前地图与角色为 **程序色块占位**，便于先跑通玩法。替换大模型多视角图集时建议：

- 单帧透明 PNG，脚底对齐画布底边中点
- 命名：`{roleId}_{dir}_{frame}.png`（dir：`s/sw/w/nw/n/ne/e/se`）
- 合图为 TexturePacker JSON + PNG，放入 `src/assets/` 后由 `MapSystem` / 玩家精灵加载
- 格宽统一 **32px**；角色建议 64×64

地图数据在 `src/data/map.json`（walls / buildings / npcs / spawn），后续可改为 Tiled 导出。

## 存档

`localStorage` 键：`chuangxiang-town-sandbox-v1`。设置面板可重置或导出通关纪要 JSON。
