import { portalAuthenticatedFetch } from './authApi';

export type SwotPayload = {
  strengths: string;
  weaknesses: string;
  opportunities: string;
  threats: string;
};

export type Marketing4pPayload = {
  product: string;
  price: string;
  place: string;
  promotion: string;
};

export type CostItemPayload = {
  id: number;
  category: '固定成本' | '变动成本';
  name: string;
  amount: number;
};

export type RevenueItemPayload = {
  id: number;
  source: string;
  monthly: number;
};

export type WarRoomHat = 'white' | 'red' | 'black' | 'yellow' | 'green' | 'blue' | 'user';

export type WarRoomCanvasCell = { content: string; updatedBy: string };

export type WarRoomDebateMessage = {
  id: string;
  hat: WarRoomHat;
  content: string;
  targetModule: string | null;
  moduleContent: string;
  status?: 'adopted' | 'ignored';
  roundIndex: number;
  createdAt: string;
};

export type WarRoomTranscript = {
  messages: WarRoomDebateMessage[];
  roundCount: number;
};

export type WarRoomCanvas = Record<string, WarRoomCanvasCell>;

export type BusinessModelWorkspacePayload = {
  swot: SwotPayload;
  marketing: Marketing4pPayload;
  finance: { costs: CostItemPayload[]; revenues: RevenueItemPayload[] };
  swotSavedAt: string;
  marketingSavedAt: string;
  financeSavedAt: string;
  warRoom?: {
    canvas: WarRoomCanvas;
    transcript: WarRoomTranscript;
    filledCount: number;
  };
};

const base = (classId: string) =>
  `/api/student/personal-classes/${encodeURIComponent(classId)}/business-model`;

export async function fetchBusinessModelWorkspace(classId: string): Promise<BusinessModelWorkspacePayload> {
  return portalAuthenticatedFetch('student', `${base(classId)}/workspace`) as Promise<BusinessModelWorkspacePayload>;
}

export async function saveBusinessModelWorkspacePartial(
  classId: string,
  body: Partial<{ swot: SwotPayload; marketing: Marketing4pPayload; finance: { costs: CostItemPayload[]; revenues: RevenueItemPayload[] } }>
): Promise<BusinessModelWorkspacePayload> {
  return portalAuthenticatedFetch('student', `${base(classId)}/workspace`, {
    method: 'PUT',
    body: JSON.stringify(body),
  }) as Promise<BusinessModelWorkspacePayload>;
}

export async function generateBusinessModelSwotAi(classId: string): Promise<BusinessModelWorkspacePayload> {
  return portalAuthenticatedFetch('student', `${base(classId)}/ai/swot`, {
    method: 'POST',
    body: JSON.stringify({}),
  }) as Promise<BusinessModelWorkspacePayload>;
}

export async function generateBusinessModelMarketingAi(classId: string): Promise<BusinessModelWorkspacePayload> {
  return portalAuthenticatedFetch('student', `${base(classId)}/ai/marketing`, {
    method: 'POST',
    body: JSON.stringify({}),
  }) as Promise<BusinessModelWorkspacePayload>;
}

export async function generateBusinessModelFinanceItemsAi(classId: string): Promise<BusinessModelWorkspacePayload> {
  return portalAuthenticatedFetch('student', `${base(classId)}/ai/finance-items`, {
    method: 'POST',
    body: JSON.stringify({}),
  }) as Promise<BusinessModelWorkspacePayload>;
}

export const WAR_ROOM_MODULE_DEFS: { key: string; title: string }[] = [
  { key: 'customerSegments', title: '客户细分' },
  { key: 'valueProposition', title: '价值主张' },
  { key: 'channels', title: '渠道通路' },
  { key: 'customerRelationships', title: '客户关系' },
  { key: 'revenueStreams', title: '收入来源' },
  { key: 'keyResources', title: '核心资源' },
  { key: 'keyActivities', title: '关键业务' },
  { key: 'keyPartnerships', title: '合作伙伴' },
  { key: 'costStructure', title: '成本结构' },
];

export async function warRoomDebateStart(
  classId: string,
  studentDisplayName: string
): Promise<{ roundMessages: WarRoomDebateMessage[]; workspace: BusinessModelWorkspacePayload }> {
  return portalAuthenticatedFetch('student', `${base(classId)}/war-room/debate/start`, {
    method: 'POST',
    body: JSON.stringify({ studentDisplayName }),
  }) as Promise<{ roundMessages: WarRoomDebateMessage[]; workspace: BusinessModelWorkspacePayload }>;
}

export async function warRoomDebateRound(
  classId: string,
  studentDisplayName: string,
  userMessage?: string
): Promise<{ roundMessages: WarRoomDebateMessage[]; workspace: BusinessModelWorkspacePayload }> {
  return portalAuthenticatedFetch('student', `${base(classId)}/war-room/debate/round`, {
    method: 'POST',
    body: JSON.stringify({ studentDisplayName, userMessage: userMessage || '' }),
  }) as Promise<{ roundMessages: WarRoomDebateMessage[]; workspace: BusinessModelWorkspacePayload }>;
}

export async function warRoomDebateReply(
  classId: string,
  studentDisplayName: string,
  userMessage: string,
  hat?: WarRoomHat
): Promise<{ message: WarRoomDebateMessage; workspace: BusinessModelWorkspacePayload }> {
  return portalAuthenticatedFetch('student', `${base(classId)}/war-room/debate/reply`, {
    method: 'POST',
    body: JSON.stringify({ studentDisplayName, userMessage, hat }),
  }) as Promise<{ message: WarRoomDebateMessage; workspace: BusinessModelWorkspacePayload }>;
}

export async function saveWarRoomCanvasCell(
  classId: string,
  moduleKey: string,
  content: string
): Promise<BusinessModelWorkspacePayload> {
  return portalAuthenticatedFetch('student', `${base(classId)}/war-room/canvas`, {
    method: 'PUT',
    body: JSON.stringify({ moduleKey, content }),
  }) as Promise<BusinessModelWorkspacePayload>;
}

export async function adoptWarRoomMessage(
  classId: string,
  messageId: string
): Promise<BusinessModelWorkspacePayload> {
  return portalAuthenticatedFetch(
    'student',
    `${base(classId)}/war-room/messages/${encodeURIComponent(messageId)}/adopt`,
    { method: 'POST', body: JSON.stringify({}) }
  ) as Promise<BusinessModelWorkspacePayload>;
}

export function parseMentionedHat(text: string): WarRoomHat | null {
  const t = text;
  if (/@\s*白帽|@white/i.test(t)) return 'white';
  if (/@\s*红帽|@red/i.test(t)) return 'red';
  if (/@\s*黑帽|@black/i.test(t)) return 'black';
  if (/@\s*黄帽|@yellow/i.test(t)) return 'yellow';
  if (/@\s*绿帽|@green/i.test(t)) return 'green';
  if (/@\s*蓝帽|@blue/i.test(t)) return 'blue';
  return null;
}
