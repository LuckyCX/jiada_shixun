import { SAVE_KEY, SAVE_VERSION, STAGE_ORDER, type StageId } from '../constants';
import mapData from '../data/map.json';

export type TeamPayload = {
  teamName: string;
  leader: string;
  roles: string[];
};

export type IdeationPayload = {
  cardId: string;
  title: string;
};

export type ResearchPayload = {
  assignments: Record<string, string>;
};

export type ProductPayload = {
  pairs: Record<string, string>;
};

export type BmcPayload = {
  cells: Record<string, string>;
};

export type SimPayload = {
  price: number;
  budget: number;
  channels: number;
  ran: boolean;
};

export type PlanPayload = {
  chapters: string[];
};

export type StagePayloads = {
  team: TeamPayload | null;
  ideation: IdeationPayload | null;
  research: ResearchPayload | null;
  product: ProductPayload | null;
  bmc: BmcPayload | null;
  sim: SimPayload | null;
  plan: PlanPayload | null;
};

export type SandboxSave = {
  saveVersion: number;
  player: { x: number; y: number };
  dialoguesRead: string[];
  stages: Record<StageId, boolean>;
  payloads: StagePayloads;
  updatedAt: number;
};

export function defaultStagePayloads(): StagePayloads {
  return {
    team: null,
    ideation: null,
    research: null,
    product: null,
    bmc: null,
    sim: null,
    plan: null,
  };
}

export function createNewSave(): SandboxSave {
  const stages = Object.fromEntries(STAGE_ORDER.map((id) => [id, false])) as Record<StageId, boolean>;
  return {
    saveVersion: SAVE_VERSION,
    player: { x: mapData.spawn.x * 32 + 16, y: mapData.spawn.y * 32 + 16 },
    dialoguesRead: [],
    stages,
    payloads: defaultStagePayloads(),
    updatedAt: Date.now(),
  };
}

export function loadSave(): SandboxSave {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return createNewSave();
    const parsed = JSON.parse(raw) as SandboxSave;
    if (!parsed || parsed.saveVersion !== SAVE_VERSION) return createNewSave();
    return {
      ...createNewSave(),
      ...parsed,
      stages: { ...createNewSave().stages, ...parsed.stages },
      payloads: { ...defaultStagePayloads(), ...parsed.payloads },
    };
  } catch {
    return createNewSave();
  }
}

export function writeSave(save: SandboxSave) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}

export function resetSave(): SandboxSave {
  const next = createNewSave();
  writeSave(next);
  return next;
}

export function exportSummaryJson(save: SandboxSave) {
  return {
    saveVersion: save.saveVersion,
    exportedAt: new Date().toISOString(),
    town: '创想小镇',
    mode: 'sandbox',
    stagesCompleted: STAGE_ORDER.filter((id) => save.stages[id]),
    payloads: save.payloads,
    note: '本文件为沙盒通关纪要，请到学生中心对应模块提交正式成果。',
  };
}
