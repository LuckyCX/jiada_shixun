import { create } from 'zustand';
import type { StageId } from '../constants';
import { STAGE_ORDER } from '../constants';
import {
  defaultStagePayloads,
  loadSave,
  resetSave,
  writeSave,
  type SandboxSave,
  type StagePayloads,
} from './SandboxSave';

export type UiOverlay =
  | null
  | 'dialogue'
  | 'quest'
  | 'map'
  | 'settings'
  | 'building'
  | 'glossary';

type DialogueState = {
  dialogueId: string;
  speaker: string;
  lines: string[];
  lineIndex: number;
  marksDialogue?: string;
};

type TownState = {
  ready: boolean;
  paused: boolean;
  save: SandboxSave;
  overlay: UiOverlay;
  activeBuildingId: string | null;
  activeStageId: StageId | null;
  dialogue: DialogueState | null;
  hint: string;
  interactPrompt: string | null;
  initFromStorage: () => void;
  setReady: (v: boolean) => void;
  setPaused: (v: boolean) => void;
  setOverlay: (o: UiOverlay) => void;
  setHint: (h: string) => void;
  setInteractPrompt: (p: string | null) => void;
  openBuilding: (buildingId: string, stageId: StageId) => void;
  closeBuilding: () => void;
  startDialogue: (d: Omit<DialogueState, 'lineIndex'>) => void;
  advanceDialogue: () => void;
  markDialogueRead: (key: string) => void;
  completeStage: (stageId: StageId, payload: StagePayloads[StageId]) => void;
  updatePlayerPos: (x: number, y: number) => void;
  resetSandbox: () => void;
  persist: () => void;
  recommendedStage: () => StageId | null;
  doneCount: () => number;
};

function syncPersist(get: () => TownState) {
  const { save } = get();
  writeSave(save);
}

export const useTownStore = create<TownState>((set, get) => ({
  ready: false,
  paused: false,
  save: loadSave(),
  overlay: null,
  activeBuildingId: null,
  activeStageId: null,
  dialogue: null,
  hint: '',
  interactPrompt: null,

  initFromStorage: () => set({ save: loadSave() }),
  setReady: (v) => set({ ready: v }),
  setPaused: (v) => set({ paused: v }),
  setOverlay: (o) => set({ overlay: o, paused: o !== null && o !== 'map' && o !== 'quest' }),
  setHint: (h) => set({ hint: h }),
  setInteractPrompt: (p) => set({ interactPrompt: p }),

  openBuilding: (buildingId, stageId) =>
    set({
      overlay: 'building',
      activeBuildingId: buildingId,
      activeStageId: stageId,
      paused: true,
    }),

  closeBuilding: () =>
    set({
      overlay: null,
      activeBuildingId: null,
      activeStageId: null,
      paused: false,
    }),

  startDialogue: (d) =>
    set({
      overlay: 'dialogue',
      dialogue: { ...d, lineIndex: 0 },
      paused: true,
    }),

  advanceDialogue: () => {
    const { dialogue } = get();
    if (!dialogue) return;
    if (dialogue.lineIndex < dialogue.lines.length - 1) {
      set({ dialogue: { ...dialogue, lineIndex: dialogue.lineIndex + 1 } });
      return;
    }
    if (dialogue.marksDialogue) {
      get().markDialogueRead(dialogue.marksDialogue);
    }
    set({ dialogue: null, overlay: null, paused: false });
  },

  markDialogueRead: (key) => {
    const save = get().save;
    if (save.dialoguesRead.includes(key)) return;
    const next = {
      ...save,
      dialoguesRead: [...save.dialoguesRead, key],
      updatedAt: Date.now(),
    };
    set({ save: next });
    writeSave(next);
  },

  completeStage: (stageId, payload) => {
    const save = get().save;
    const stages = { ...save.stages, [stageId]: true };
    const payloads = { ...save.payloads, [stageId]: payload } as StagePayloads;
    const next = { ...save, stages, payloads, updatedAt: Date.now() };
    set({ save: next, overlay: null, activeBuildingId: null, activeStageId: null, paused: false });
    writeSave(next);
  },

  updatePlayerPos: (x, y) => {
    const save = get().save;
    if (Math.abs(save.player.x - x) < 0.01 && Math.abs(save.player.y - y) < 0.01) return;
    const next = { ...save, player: { x, y }, updatedAt: Date.now() };
    set({ save: next });
  },

  resetSandbox: () => {
    const next = resetSave();
    set({
      save: next,
      overlay: null,
      dialogue: null,
      activeBuildingId: null,
      activeStageId: null,
      paused: false,
    });
  },

  persist: () => syncPersist(get),

  recommendedStage: () => {
    const { stages } = get().save;
    for (const id of STAGE_ORDER) {
      if (!stages[id]) return id;
    }
    return null;
  },

  doneCount: () => STAGE_ORDER.filter((id) => get().save.stages[id]).length,
}));

export { defaultStagePayloads };
