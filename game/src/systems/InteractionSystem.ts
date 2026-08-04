import { TILE, type StageId } from '../constants';
import dialogues from '../data/npc_dialogues.json';
import type { MapSystem, BuildingDef, NpcDef } from './MapSystem';
import type { PlayerController } from './PlayerController';
import { useTownStore } from './townStore';

type DialogueDef = {
  id: string;
  speaker: string;
  lines: string[];
  marksDialogue?: string;
  hintBuilding?: string;
};

const DIALOGUE_MAP = dialogues as Record<string, DialogueDef>;

export class InteractionSystem {
  constructor(private map: MapSystem, private player: PlayerController) {}

  private distToTile(tx: number, ty: number) {
    const px = tx * TILE + TILE / 2;
    const py = ty * TILE + TILE / 2;
    return Math.hypot(this.player.x - px, this.player.y - py);
  }

  findNearestTarget():
    | { kind: 'npc'; npc: NpcDef }
    | { kind: 'building'; building: BuildingDef }
    | null {
    const reach = TILE * 1.6;
    let best: { kind: 'npc'; npc: NpcDef; d: number } | { kind: 'building'; building: BuildingDef; d: number } | null =
      null;

    for (const npc of this.map.npcs) {
      const d = this.distToTile(npc.x, npc.y);
      if (d <= reach && (!best || d < best.d)) best = { kind: 'npc', npc, d };
    }
    for (const b of this.map.buildings) {
      const d = this.distToTile(b.door.x, b.door.y);
      if (d <= reach && (!best || d < best.d)) best = { kind: 'building', building: b, d };
    }
    if (!best) return null;
    if (best.kind === 'npc') return { kind: 'npc', npc: best.npc };
    return { kind: 'building', building: best.building };
  }

  updatePrompt() {
    const store = useTownStore.getState();
    if (store.overlay) {
      store.setInteractPrompt(null);
      return;
    }
    const t = this.findNearestTarget();
    if (!t) {
      store.setInteractPrompt(null);
      return;
    }
    if (t.kind === 'npc') {
      store.setInteractPrompt(`点击「${t.npc.name}」对话（或按 E）`);
    } else {
      store.setInteractPrompt(`点击门口进入「${t.building.name}」（或按 E）`);
    }
  }

  talkToNpc(npc: NpcDef) {
    const store = useTownStore.getState();
    if (store.overlay && store.overlay !== 'dialogue') return;
    const def = DIALOGUE_MAP[npc.dialogueId];
    if (!def) return;
    store.startDialogue({
      dialogueId: def.id,
      speaker: def.speaker,
      lines: def.lines,
      marksDialogue: def.marksDialogue,
    });
  }

  enterBuilding(building: BuildingDef) {
    const store = useTownStore.getState();
    if (store.overlay) return;
    store.openBuilding(building.id, building.stageId as StageId);
  }

  tryInteract() {
    const store = useTownStore.getState();
    if (store.overlay === 'dialogue') {
      store.advanceDialogue();
      return;
    }
    if (store.overlay) return;

    const t = this.findNearestTarget();
    if (!t) return;

    if (t.kind === 'npc') {
      this.talkToNpc(t.npc);
      return;
    }

    this.enterBuilding(t.building);
  }
}
