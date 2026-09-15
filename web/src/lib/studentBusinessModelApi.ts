import { getPortalToken, portalAuthenticatedFetch } from './authApi';

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

export type WarRoomCanvasFill = {
  targetModule: string;
  moduleContent: string;
};

export type WarRoomDebateMessage = {
  id: string;
  hat: WarRoomHat;
  content: string;
  targetModule: string | null;
  moduleContent: string;
  fills?: WarRoomCanvasFill[];
  adoptedModules?: string[];
  status?: 'adopted' | 'ignored';
  roundIndex: number;
  createdAt: string;
};

export type WarRoomTranscript = {
  messages: WarRoomDebateMessage[];
  roundCount: number;
};

export type WarRoomCanvas = Record<string, WarRoomCanvasCell>;

export type WarRoomTeamRecordSummary = {
  studentId: string;
  studentName: string;
  savedAt: string;
  filledCount: number;
};

export type BmcPayload = {
  keyPartnerships: string;
  keyActivities: string;
  valueProposition: string;
  customerRelationships: string;
  customerSegments: string;
  keyResources: string;
  channels: string;
  costStructure: string;
  revenueStreams: string;
};

export type BusinessModelTeamMember = {
  id: string;
  name: string;
};

export type BusinessModelWorkspacePayload = {
  swot: SwotPayload;
  marketing: Marketing4pPayload;
  finance: { costs: CostItemPayload[]; revenues: RevenueItemPayload[] };
  swotSavedAt: string;
  marketingSavedAt: string;
  financeSavedAt: string;
  studentId?: string;
  isTeamLeader?: boolean;
  teamMembers?: BusinessModelTeamMember[];
  bmc?: BmcPayload;
  bmcCanvasSavedAt?: string;
  bmcCanvasGeneratedAt?: string;
  warRoom?: {
    canvas: WarRoomCanvas;
    transcript: WarRoomTranscript;
    filledCount: number;
  };
  warRoomTeamRecords?: WarRoomTeamRecordSummary[];
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

export type GenerateBusinessModelBmcAiError = Error & {
  missingMembers?: { studentId: string; studentName: string }[];
};

export async function generateBusinessModelBmcAi(classId: string): Promise<BusinessModelWorkspacePayload> {
  const token = getPortalToken('student');
  const r = await fetch(`${base(classId)}/bmc/ai/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({}),
  });
  const j = (await r.json().catch(() => ({ code: -1, message: '无效响应' }))) as {
    code: number;
    message?: string;
    data?: BusinessModelWorkspacePayload & {
      missingMembers?: { studentId: string; studentName: string }[];
    };
  };
  if (!r.ok || j.code !== 0) {
    const err = new Error(typeof j.message === 'string' ? j.message : '生成失败') as GenerateBusinessModelBmcAiError;
    const data = j.data as { missingMembers?: { studentId: string; studentName: string }[] } | undefined;
    if (data?.missingMembers?.length) err.missingMembers = data.missingMembers;
    throw err;
  }
  return j.data as BusinessModelWorkspacePayload;
}

export type SaveBusinessModelBmcError = Error & {
  missingMembers?: { studentId: string; studentName: string }[];
};

export async function saveBusinessModelBmc(
  classId: string,
  bmc: BmcPayload
): Promise<BusinessModelWorkspacePayload> {
  const token = getPortalToken('student');
  const { rewriteUnsafeHttpMethod, compatFetch } = await import('./authApi');
  const init = rewriteUnsafeHttpMethod({
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ bmc }),
  });
  const r = await compatFetch(`${base(classId)}/bmc/save`, init);
  const j = (await r.json().catch(() => ({ code: -1, message: '无效响应' }))) as {
    code: number;
    message?: string;
    data?: { missingMembers?: { studentId: string; studentName: string }[] };
  };
  if (!r.ok || j.code !== 0) {
    const err = new Error(typeof j.message === 'string' ? j.message : '提交失败') as SaveBusinessModelBmcError;
    if (j.data?.missingMembers?.length) err.missingMembers = j.data.missingMembers;
    throw err;
  }
  return j.data as BusinessModelWorkspacePayload;
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
  messageId: string,
  moduleKey?: string
): Promise<BusinessModelWorkspacePayload> {
  return portalAuthenticatedFetch(
    'student',
    `${base(classId)}/war-room/messages/${encodeURIComponent(messageId)}/adopt`,
    {
      method: 'POST',
      body: JSON.stringify(moduleKey ? { moduleKey } : {}),
    }
  ) as Promise<BusinessModelWorkspacePayload>;
}

export async function saveWarRoomCanvasRecord(classId: string): Promise<BusinessModelWorkspacePayload> {
  return portalAuthenticatedFetch('student', `${base(classId)}/war-room/save`, {
    method: 'POST',
    body: JSON.stringify({}),
  }) as Promise<BusinessModelWorkspacePayload>;
}

export type WarRoomSavedRecordDetail = {
  studentId: string;
  studentName: string;
  savedAt: string;
  canvas: WarRoomCanvas;
  filledCount: number;
};

export async function fetchWarRoomMemberRecord(
  classId: string,
  studentId: string
): Promise<WarRoomSavedRecordDetail> {
  return portalAuthenticatedFetch(
    'student',
    `${base(classId)}/war-room/records/${encodeURIComponent(studentId)}`
  ) as Promise<WarRoomSavedRecordDetail>;
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
