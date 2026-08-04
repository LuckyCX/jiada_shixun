import type { Container } from 'pixi.js';
import type { MapSystem } from './MapSystem';

const KEYS = new Set<string>();

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    KEYS.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => KEYS.delete(e.code));
  window.addEventListener('blur', () => KEYS.clear());
}

export class PlayerController {
  x: number;
  y: number;
  facingX = 0;
  facingY = 1;
  private speed = 160;
  private runMul = 1.65;
  /** 鼠标点击移动目标（像素）；null 表示无目标 */
  private moveTarget: { x: number; y: number } | null = null;
  /** 到达目标后自动互动 */
  private arriveInteract = false;
  private arriveCb: (() => void) | null = null;

  constructor(
    private sprite: Container,
    private map: MapSystem,
    startX: number,
    startY: number
  ) {
    this.x = startX;
    this.y = startY;
    this.syncSprite();
  }

  private pressed(code: string) {
    return KEYS.has(code);
  }

  /** 点击地面移动；可选到达后回调（用于点 NPC / 任务对话） */
  setClickTarget(wx: number, wy: number, onArrive?: () => void) {
    // 点到墙/建筑内时，吸附到附近可走格，避免目标立刻被清掉
    const snapped = this.map.snapToWalkable(wx, wy);
    this.moveTarget = snapped;
    this.arriveInteract = Boolean(onArrive);
    this.arriveCb = onArrive ?? null;
  }

  clearMoveTarget() {
    this.moveTarget = null;
    this.arriveInteract = false;
    this.arriveCb = null;
  }

  update(dt: number, frozen: boolean) {
    if (frozen) {
      this.clearMoveTarget();
      return;
    }

    let dx = 0;
    let dy = 0;

    // 键盘仍可用作备用；有按键时取消点击目标
    if (this.pressed('KeyW') || this.pressed('ArrowUp')) dy -= 1;
    if (this.pressed('KeyS') || this.pressed('ArrowDown')) dy += 1;
    if (this.pressed('KeyA') || this.pressed('ArrowLeft')) dx -= 1;
    if (this.pressed('KeyD') || this.pressed('ArrowRight')) dx += 1;

    if (dx !== 0 || dy !== 0) {
      this.clearMoveTarget();
      this.applyMove(dx, dy, dt, this.pressed('ShiftLeft') || this.pressed('ShiftRight'));
      return;
    }

    if (this.moveTarget) {
      const tx = this.moveTarget.x - this.x;
      const ty = this.moveTarget.y - this.y;
      const dist = Math.hypot(tx, ty);
      if (dist < 8) {
        const cb = this.arriveCb;
        const needInteract = this.arriveInteract;
        this.clearMoveTarget();
        if (needInteract && cb) cb();
        return;
      }
      this.applyMove(tx / dist, ty / dist, dt, false);
    }
  }

  private applyMove(dx: number, dy: number, dt: number, run: boolean) {
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    this.facingX = Math.sign(dx) || this.facingX;
    this.facingY = Math.sign(dy) || (dx === 0 ? this.facingY : 0);
    if (dx === 0) this.facingX = 0;
    if (dy === 0) this.facingY = 0;
    if (dx !== 0 && dy !== 0) {
      this.facingX = Math.sign(dx);
      this.facingY = Math.sign(dy);
    } else if (dx !== 0) {
      this.facingY = 0;
    } else {
      this.facingX = 0;
    }

    const sp = this.speed * (run ? this.runMul : 1) * dt;
    const nx = this.x + dx * sp;
    const ny = this.y + dy * sp;

    if (!this.map.collidesPixel(nx, this.y)) this.x = nx;
    if (!this.map.collidesPixel(this.x, ny)) this.y = ny;

    this.x = Math.max(16, Math.min(this.map.widthPx - 16, this.x));
    this.y = Math.max(16, Math.min(this.map.heightPx - 16, this.y));
    this.syncSprite();
  }

  syncSprite() {
    this.sprite.x = this.x;
    this.sprite.y = this.y;
  }

  static consumeInteract(): boolean {
    const hit = KEYS.has('KeyE') || KEYS.has('Space');
    if (hit) {
      KEYS.delete('KeyE');
      KEYS.delete('Space');
    }
    return hit;
  }

  static consumeKey(code: string): boolean {
    if (!KEYS.has(code)) return false;
    KEYS.delete(code);
    return true;
  }
}
