import { Application, Container } from 'pixi.js';
import { MapSystem } from './MapSystem';
import { PlayerController } from './PlayerController';
import { InteractionSystem } from './InteractionSystem';
import { useTownStore } from './townStore';

export class TownEngine {
  app: Application | null = null;
  map = new MapSystem();
  player: PlayerController | null = null;
  interact: InteractionSystem | null = null;
  private camera = new Container();
  private saveTimer = 0;
  private destroyed = false;
  private pointerCleanup: (() => void) | null = null;

  async mount(host: HTMLElement) {
    this.destroyed = false;
    // 避免 React StrictMode / HMR 残留旧 canvas，导致点击打到无监听的层
    host.replaceChildren();

    const app = new Application();
    await app.init({
      resizeTo: host,
      background: '#87b5a0',
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });
    if (this.destroyed) {
      app.destroy(true);
      return;
    }
    this.app = app;
    host.appendChild(app.canvas);
    app.canvas.style.display = 'block';
    app.canvas.style.width = '100%';
    app.canvas.style.height = '100%';
    app.canvas.style.cursor = 'crosshair';
    app.canvas.style.touchAction = 'none';

    this.map.build();
    this.camera.addChild(this.map.world);
    app.stage.addChild(this.camera);

    for (const npc of this.map.npcs) {
      this.map.createNpcSprite(npc);
    }

    const save = useTownStore.getState().save;
    const playerSprite = this.map.createPlayerSprite();
    this.player = new PlayerController(playerSprite, this.map, save.player.x, save.player.y);
    this.interact = new InteractionSystem(this.map, this.player);

    this.bindPointer(app.canvas);

    if (import.meta.env.DEV) {
      (window as unknown as { __townEngine?: TownEngine }).__townEngine = this;
    }

    app.ticker.add((ticker) => {
      if (this.destroyed || !this.player || !this.interact || !this.app) return;
      const dt = ticker.deltaMS / 1000;
      const store = useTownStore.getState();

      if (PlayerController.consumeKey('KeyJ')) {
        store.setOverlay(store.overlay === 'quest' ? null : 'quest');
      }
      if (PlayerController.consumeKey('KeyM')) {
        store.setOverlay(store.overlay === 'map' ? null : 'map');
      }
      if (PlayerController.consumeKey('Escape')) {
        if (store.overlay === 'building') store.closeBuilding();
        else if (store.overlay === 'dialogue') store.advanceDialogue();
        else if (store.overlay && store.overlay !== 'settings') store.setOverlay(null);
        else store.setOverlay(store.overlay === 'settings' ? null : 'settings');
      }
      if (PlayerController.consumeInteract()) {
        this.interact.tryInteract();
      }

      const frozen =
        store.paused || store.overlay === 'dialogue' || store.overlay === 'building' || store.overlay === 'settings';
      this.player.update(dt, frozen);
      this.interact.updatePrompt();
      this.updateCamera();

      this.saveTimer += dt;
      if (this.saveTimer > 2) {
        this.saveTimer = 0;
        store.updatePlayerPos(this.player.x, this.player.y);
        store.persist();
      }
    });

    useTownStore.getState().setReady(true);
  }

  /** 屏幕坐标 → 世界像素 */
  private screenToWorld(clientX: number, clientY: number) {
    if (!this.app) return { x: 0, y: 0 };
    const rect = this.app.canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    return {
      x: sx - this.camera.x,
      y: sy - this.camera.y,
    };
  }

  private bindPointer(canvas: HTMLCanvasElement) {
    const onPointer = (e: PointerEvent) => {
      // 部分浏览器/触控下 button 可能为 -1，以 buttons 为准
      if (e.button > 0) return;
      const store = useTownStore.getState();
      if (store.overlay === 'dialogue') {
        store.advanceDialogue();
        return;
      }
      if (store.overlay) return;
      if (!this.player || !this.interact) return;

      e.preventDefault();
      const { x: wx, y: wy } = this.screenToWorld(e.clientX, e.clientY);

      const npc = this.map.hitNpc(wx, wy);
      if (npc) {
        const px = npc.x * 32 + 16;
        const py = npc.y * 32 + 16;
        this.player.setClickTarget(px, py + 20, () => this.interact?.talkToNpc(npc));
        return;
      }

      const building = this.map.hitBuildingDoor(wx, wy);
      if (building) {
        const px = building.door.x * 32 + 16;
        const py = building.door.y * 32 + 16;
        this.player.setClickTarget(px, py + 12, () => this.interact?.enterBuilding(building));
        return;
      }

      this.player.setClickTarget(wx, wy);
    };

    canvas.addEventListener('pointerdown', onPointer);
    this.pointerCleanup = () => canvas.removeEventListener('pointerdown', onPointer);
  }

  private updateCamera() {
    if (!this.app || !this.player) return;
    const vw = this.app.screen.width;
    const vh = this.app.screen.height;
    let cx = this.player.x - vw / 2;
    let cy = this.player.y - vh / 2;
    cx = Math.max(0, Math.min(this.map.widthPx - vw, cx));
    cy = Math.max(0, Math.min(this.map.heightPx - vh, cy));
    if (this.map.widthPx < vw) cx = (this.map.widthPx - vw) / 2;
    if (this.map.heightPx < vh) cy = (this.map.heightPx - vh) / 2;
    this.camera.x = -cx;
    this.camera.y = -cy;
  }

  teleportNearBuilding(buildingId: string) {
    const b = this.map.getBuilding(buildingId);
    if (!b || !this.player) return;
    this.player.clearMoveTarget();
    this.player.x = b.door.x * 32 + 16;
    this.player.y = b.door.y * 32 + 16 + 24;
    this.player.syncSprite();
    useTownStore.getState().updatePlayerPos(this.player.x, this.player.y);
    useTownStore.getState().persist();
  }

  /** 任务日志：走向阶段 NPC 并打开对话 */
  goTalkStage(stageId: string) {
    if (!this.player || !this.interact) return;
    const npc = this.map.npcs.find((n) => 'stageId' in n && n.stageId === stageId);
    if (!npc) return;
    const px = npc.x * 32 + 16;
    const py = npc.y * 32 + 16;
    this.player.setClickTarget(px, py + 20, () => this.interact?.talkToNpc(npc));
  }

  destroy() {
    this.destroyed = true;
    this.pointerCleanup?.();
    this.pointerCleanup = null;
    if (this.player) {
      useTownStore.getState().updatePlayerPos(this.player.x, this.player.y);
      useTownStore.getState().persist();
    }
    if (this.app) {
      const canvas = this.app.canvas;
      this.app.destroy(true, { children: true });
      this.app = null;
      // 确保从 DOM 移除，避免叠两层 canvas
      canvas?.remove();
    }
    this.player = null;
    this.interact = null;
    useTownStore.getState().setReady(false);
  }
}
