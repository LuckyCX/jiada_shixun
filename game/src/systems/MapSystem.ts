import { Container, Graphics, Text } from 'pixi.js';
import mapData from '../data/map.json';
import { TILE, type StageId } from '../constants';

export type BuildingDef = (typeof mapData.buildings)[number];
export type NpcDef = (typeof mapData.npcs)[number];

/** 伪随机：同格同色，避免每帧闪烁 */
function hash2(x: number, y: number) {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

export class MapSystem {
  readonly world = new Container();
  readonly entityLayer = new Container();
  private collision = new Set<string>();
  private buildingsById = new Map<string, BuildingDef>();
  /** NPC 精灵，供点击命中检测 */
  npcSprites = new Map<string, Container>();

  constructor() {
    for (const b of mapData.buildings) this.buildingsById.set(b.id, b);
  }

  get widthPx() {
    return mapData.width * TILE;
  }

  get heightPx() {
    return mapData.height * TILE;
  }

  get buildings() {
    return mapData.buildings;
  }

  get npcs() {
    return mapData.npcs;
  }

  getBuilding(id: string) {
    return this.buildingsById.get(id);
  }

  key(tx: number, ty: number) {
    return `${tx},${ty}`;
  }

  isBlocked(tx: number, ty: number) {
    if (tx < 0 || ty < 0 || tx >= mapData.width || ty >= mapData.height) return true;
    return this.collision.has(this.key(tx, ty));
  }

  /** 角色脚点像素是否与碰撞格相交（中心偏移的 AABB） */
  collidesPixel(cx: number, cy: number, halfW = 10, halfH = 8) {
    const left = Math.floor((cx - halfW) / TILE);
    const right = Math.floor((cx + halfW) / TILE);
    const top = Math.floor((cy - halfH) / TILE);
    const bottom = Math.floor((cy + halfH) / TILE);
    for (let ty = top; ty <= bottom; ty++) {
      for (let tx = left; tx <= right; tx++) {
        if (this.isBlocked(tx, ty)) return true;
      }
    }
    return false;
  }

  /** 将点击点吸附到附近可走像素（避免点到建筑/墙导致无法移动） */
  snapToWalkable(wx: number, wy: number) {
    if (!this.collidesPixel(wx, wy)) return { x: wx, y: wy };
    const maxR = 6;
    for (let r = 1; r <= maxR; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = wx + dx * TILE;
          const y = wy + dy * TILE;
          if (!this.collidesPixel(x, y)) return { x, y };
        }
      }
    }
    return { x: wx, y: wy };
  }

  /** 世界坐标最近点到的 NPC（像素半径） */
  hitNpc(wx: number, wy: number, radius = 28): NpcDef | null {
    let best: NpcDef | null = null;
    let bestD = radius;
    for (const npc of this.npcs) {
      const px = npc.x * TILE + TILE / 2;
      const py = npc.y * TILE + TILE / 2;
      const d = Math.hypot(wx - px, wy - py);
      if (d < bestD) {
        bestD = d;
        best = npc;
      }
    }
    return best;
  }

  /** 世界坐标是否点在建筑门口附近 */
  hitBuildingDoor(wx: number, wy: number, radius = 36): BuildingDef | null {
    let best: BuildingDef | null = null;
    let bestD = radius;
    for (const b of this.buildings) {
      const px = b.door.x * TILE + TILE / 2;
      const py = b.door.y * TILE + TILE / 2;
      const d = Math.hypot(wx - px, wy - py);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  build() {
    this.world.removeChildren();
    this.entityLayer.removeChildren();
    this.collision.clear();
    this.npcSprites.clear();

    // 草地底色 + 柔和斑驳
    const ground = new Graphics();
    for (let y = 0; y < mapData.height; y++) {
      for (let x = 0; x < mapData.width; x++) {
        const h = hash2(x, y);
        const base = h < 0.33 ? 0x3d8b5f : h < 0.66 ? 0x35965a : 0x2f8a52;
        ground.rect(x * TILE, y * TILE, TILE, TILE);
        ground.fill(base);
        // 细草点缀
        if (h > 0.72) {
          ground.circle(x * TILE + 8 + h * 16, y * TILE + 10 + h * 12, 1.2);
          ground.fill({ color: 0x7dd3a0, alpha: 0.55 });
        }
      }
    }
    this.world.addChild(ground);

    // 石板主路（十字）+ 路缘高光
    const road = new Graphics();
    const paintRoad = (rx: number, ry: number, rw: number, rh: number) => {
      road.roundRect(rx * TILE - 2, ry * TILE - 2, rw * TILE + 4, rh * TILE + 4, 6);
      road.fill({ color: 0x94a3b8, alpha: 0.35 });
      road.roundRect(rx * TILE, ry * TILE, rw * TILE, rh * TILE, 4);
      road.fill(0x64748b);
      // 中线虚纹
      for (let i = 0; i < rw * rh; i++) {
        const tx = rx + (i % rw);
        const ty = ry + Math.floor(i / rw);
        if ((tx + ty) % 3 === 0) {
          road.rect(tx * TILE + 10, ty * TILE + 14, 12, 3);
          road.fill({ color: 0xcbd5e1, alpha: 0.25 });
        }
      }
    };
    paintRoad(36, 2, 8, mapData.height - 4);
    paintRoad(2, 28, mapData.width - 4, 6);
    this.world.addChild(road);

    // 装饰树丛（不挡路的视觉层，部分与墙重合则跳过）
    const decor = new Graphics();
    const treeSpots = [
      [6, 8], [10, 14], [24, 6], [52, 8], [68, 12], [72, 40], [6, 40], [26, 52], [64, 52], [14, 22], [48, 36],
    ];
    for (const [tx, ty] of treeSpots) {
      this.drawTree(decor, tx * TILE + 16, ty * TILE + 16);
    }
    this.world.addChild(decor);

    for (const w of mapData.walls) {
      for (let dy = 0; dy < w.h; dy++) {
        for (let dx = 0; dx < w.w; dx++) {
          this.collision.add(this.key(w.x + dx, w.y + dy));
        }
      }
      // 矮石墙 / 篱笆质感
      const g = new Graphics();
      g.roundRect(w.x * TILE, w.y * TILE, w.w * TILE, w.h * TILE, 5);
      g.fill(0x78716c);
      g.stroke({ width: 2, color: 0xa8a29e, alpha: 0.6 });
      for (let i = 0; i < w.w; i++) {
        g.rect(w.x * TILE + i * TILE + 6, w.y * TILE + 4, TILE - 12, 4);
        g.fill({ color: 0xd6d3d1, alpha: 0.35 });
      }
      this.world.addChild(g);
    }

    for (const b of mapData.buildings) {
      for (let dy = 0; dy < b.h; dy++) {
        for (let dx = 0; dx < b.w; dx++) {
          if (b.door.x === b.x + dx && b.door.y === b.y + dy) continue;
          if (dy === b.h - 1 && Math.abs(b.x + dx - b.door.x) <= 1) continue;
          this.collision.add(this.key(b.x + dx, b.y + dy));
        }
      }
      this.drawBuilding(b);
    }

    this.world.addChild(this.entityLayer);
  }

  private drawTree(g: Graphics, cx: number, cy: number) {
    g.ellipse(cx + 2, cy + 10, 10, 4);
    g.fill({ color: 0x14532d, alpha: 0.35 });
    g.roundRect(cx - 3, cy - 2, 6, 14, 2);
    g.fill(0x78350f);
    g.circle(cx - 6, cy - 10, 10);
    g.fill(0x166534);
    g.circle(cx + 6, cy - 8, 9);
    g.fill(0x15803d);
    g.circle(cx, cy - 16, 11);
    g.fill(0x22c55e);
  }

  private drawBuilding(b: BuildingDef) {
    const color = Number(b.color.replace('#', '0x'));
    const x = b.x * TILE;
    const y = b.y * TILE;
    const w = b.w * TILE;
    const h = b.h * TILE;
    const g = new Graphics();

    // 地面阴影
    g.roundRect(x + 4, y + h - 8, w, 10, 4);
    g.fill({ color: 0x0f172a, alpha: 0.25 });

    // 墙体
    g.roundRect(x, y + 10, w, h - 10, 6);
    g.fill(color);
    g.stroke({ width: 2, color: 0xffffff, alpha: 0.28 });

    // 屋顶三角/条带
    g.moveTo(x - 4, y + 14);
    g.lineTo(x + w / 2, y - 6);
    g.lineTo(x + w + 4, y + 14);
    g.closePath();
    g.fill(this.darken(color, 0.35));
    g.stroke({ width: 1.5, color: 0xffffff, alpha: 0.2 });

    // 窗户
    const winCols = Math.max(1, Math.floor(b.w / 2));
    for (let i = 0; i < winCols; i++) {
      const wx = x + 10 + i * ((w - 20) / winCols);
      const wy = y + h * 0.35;
      g.roundRect(wx, wy, 14, 12, 2);
      g.fill({ color: 0xfef9c3, alpha: 0.85 });
      g.stroke({ width: 1, color: 0xffffff, alpha: 0.4 });
    }

    this.world.addChild(g);

    const label = new Text({
      text: b.name,
      style: {
        fontSize: 11,
        fill: 0xffffff,
        fontWeight: 'bold',
        dropShadow: { alpha: 0.55, blur: 2, distance: 1, color: 0x0f172a },
      },
    });
    label.anchor.set(0.5, 0.5);
    label.x = x + w / 2;
    label.y = y + h * 0.55;
    this.world.addChild(label);

    // 门口踏板
    const door = new Graphics();
    door.roundRect(b.door.x * TILE + 2, b.door.y * TILE + 6, TILE - 4, TILE - 10, 4);
    door.fill({ color: 0xfbbf24, alpha: 0.9 });
    door.stroke({ width: 1.5, color: 0xfef3c7, alpha: 0.8 });
    this.world.addChild(door);
  }

  private darken(color: number, amount: number) {
    const r = Math.floor(((color >> 16) & 0xff) * (1 - amount));
    const g = Math.floor(((color >> 8) & 0xff) * (1 - amount));
    const b = Math.floor((color & 0xff) * (1 - amount));
    return (r << 16) | (g << 8) | b;
  }

  createNpcSprite(npc: NpcDef) {
    const color = Number(npc.color.replace('#', '0x'));
    const c = new Container();
    c.eventMode = 'static';
    c.cursor = 'pointer';

    const shadow = new Graphics();
    shadow.ellipse(0, 12, 12, 5);
    shadow.fill({ color: 0x0f172a, alpha: 0.35 });
    c.addChild(shadow);

    const body = new Graphics();
    // 身体
    body.roundRect(-9, -4, 18, 18, 5);
    body.fill(color);
    // 头
    body.circle(0, -14, 9);
    body.fill(0xfde68a);
    // 头发/帽子条
    body.ellipse(0, -20, 9, 5);
    body.fill(this.darken(color, 0.15));
    // 眼睛
    body.circle(-3, -14, 1.4);
    body.fill(0x1e293b);
    body.circle(3, -14, 1.4);
    body.fill(0x1e293b);
    c.addChild(body);

    const name = new Text({
      text: npc.name.split('·').pop() || npc.name,
      style: {
        fontSize: 10,
        fill: 0xf8fafc,
        fontWeight: '600',
        dropShadow: { alpha: 0.6, blur: 2, distance: 1, color: 0x0f172a },
      },
    });
    name.anchor.set(0.5, 1);
    name.y = -28;
    c.addChild(name);

    // 可点光环
    const ring = new Graphics();
    ring.circle(0, 4, 18);
    ring.stroke({ width: 1.5, color: 0xffffff, alpha: 0.25 });
    c.addChild(ring);

    c.x = npc.x * TILE + TILE / 2;
    c.y = npc.y * TILE + TILE / 2;
    this.entityLayer.addChild(c);
    this.npcSprites.set(npc.id, c);
    return c;
  }

  createPlayerSprite() {
    const c = new Container();
    const shadow = new Graphics();
    shadow.ellipse(0, 12, 11, 4.5);
    shadow.fill({ color: 0x0f172a, alpha: 0.4 });
    c.addChild(shadow);

    const g = new Graphics();
    // 身体（青蓝外套）
    g.roundRect(-10, -6, 20, 22, 6);
    g.fill(0x0ea5e9);
    g.roundRect(-10, 8, 8, 10, 2);
    g.fill(0x0369a1);
    g.roundRect(2, 8, 8, 10, 2);
    g.fill(0x0369a1);
    // 头
    g.circle(0, -16, 9);
    g.fill(0xfde68a);
    // 头发
    g.ellipse(0, -22, 9, 5);
    g.fill(0x334155);
    // 眼睛
    g.circle(-3, -16, 1.5);
    g.fill(0x1e293b);
    g.circle(3, -16, 1.5);
    g.fill(0x1e293b);
    // 胸前小徽章
    g.circle(0, 2, 3);
    g.fill(0xfbbf24);
    c.addChild(g);

    this.entityLayer.addChild(c);
    return c;
  }
}

export function stageIdOfBuilding(b: BuildingDef): StageId {
  return b.stageId as StageId;
}
