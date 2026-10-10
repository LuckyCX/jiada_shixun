/**
 * 商业模式演示接口，含作战室。结果只回写 session。
 */
import { generateDemoAi } from './demoApi';
import { DEMO_STUDENT_ID, DEMO_STUDENT_NAME, demoId, nowIso, readFlow, writeFlow } from './demoFlow';
import type {
  BmcPayload,
  BusinessModelWorkspacePayload,
  CostItemPayload,
  Marketing4pPayload,
  RevenueItemPayload,
  SwotPayload,
  WarRoomCanvas,
  WarRoomDebateMessage,
  WarRoomHat,
} from '../../../../lib/studentBusinessModelApi';

export type {
  BmcPayload,
  BusinessModelTeamMember,
  BusinessModelWorkspacePayload,
  GenerateBusinessModelBmcAiError,
  SaveBusinessModelBmcError,
  WarRoomCanvas,
  WarRoomDebateMessage,
  WarRoomHat,
  WarRoomTeamRecordSummary,
} from '../../../../lib/studentBusinessModelApi';

export { WAR_ROOM_MODULE_DEFS, parseMentionedHat } from '../../../../lib/studentBusinessModelApi';

const BMC_KEYS: (keyof BmcPayload)[] = [
  'keyPartnerships',
  'keyActivities',
  'valueProposition',
  'customerRelationships',
  'customerSegments',
  'keyResources',
  'channels',
  'costStructure',
  'revenueStreams',
];

function emptyBmc(): BmcPayload {
  return {
    keyPartnerships: '',
    keyActivities: '',
    valueProposition: '',
    customerRelationships: '',
    customerSegments: '',
    keyResources: '',
    channels: '',
    costStructure: '',
    revenueStreams: '',
  };
}

function emptyWorkspace(): BusinessModelWorkspacePayload {
  return {
    swot: { strengths: '', weaknesses: '', opportunities: '', threats: '' },
    marketing: { product: '', price: '', place: '', promotion: '' },
    finance: { costs: [], revenues: [] },
    swotSavedAt: '',
    marketingSavedAt: '',
    financeSavedAt: '',
    studentId: DEMO_STUDENT_ID,
    isTeamLeader: true,
    teamMembers: [{ id: DEMO_STUDENT_ID, name: DEMO_STUDENT_NAME }],
    bmc: emptyBmc(),
    warRoom: { canvas: {}, transcript: { messages: [], roundCount: 0 }, filledCount: 0 },
    warRoomTeamRecords: [],
  };
}

type SavedWar = { canvas: WarRoomCanvas; savedAt: string; filledCount: number };

function read(classId: string) {
  const ws = readFlow(classId, 'business', emptyWorkspace());
  ws.swot = ws.swot || emptyWorkspace().swot;
  ws.marketing = ws.marketing || emptyWorkspace().marketing;
  ws.finance = ws.finance || { costs: [], revenues: [] };
  ws.bmc = { ...emptyBmc(), ...ws.bmc };
  ws.warRoom = ws.warRoom || emptyWorkspace().warRoom;
  ws.teamMembers = [{ id: DEMO_STUDENT_ID, name: DEMO_STUDENT_NAME }];
  ws.isTeamLeader = true;
  return ws;
}

function write(classId: string, ws: BusinessModelWorkspacePayload) {
  const filled = Object.values(ws.warRoom?.canvas || {}).filter((cell) => String(cell?.content || '').trim()).length;
  if (ws.warRoom) ws.warRoom.filledCount = filled;
  return writeFlow(classId, 'business', ws);
}

function linesOf(text: string) {
  return text.split('\n').map((line) => line.trim()).filter(Boolean);
}

export async function fetchBusinessModelWorkspace(classId: string) {
  return read(classId);
}

export async function saveBusinessModelWorkspacePartial(
  classId: string,
  body: Partial<{ swot: SwotPayload; marketing: Marketing4pPayload; finance: { costs: CostItemPayload[]; revenues: RevenueItemPayload[] } }>
) {
  const ws = read(classId);
  const at = nowIso();
  if (body.swot) {
    ws.swot = body.swot;
    ws.swotSavedAt = at;
  }
  if (body.marketing) {
    ws.marketing = body.marketing;
    ws.marketingSavedAt = at;
  }
  if (body.finance) {
    ws.finance = body.finance;
    ws.financeSavedAt = at;
  }
  return write(classId, ws);
}

export async function generateBusinessModelSwotAi(classId: string) {
  const text = await generateDemoAi(classId, 'business', '请写 SWOT：优势、劣势、机会、威胁，各一行。');
  const [strengths, weaknesses, opportunities, threats] = linesOf(text);
  return saveBusinessModelWorkspacePartial(classId, {
    swot: { strengths: strengths || text, weaknesses: weaknesses || '', opportunities: opportunities || '', threats: threats || '' },
  });
}

export async function generateBusinessModelMarketingAi(classId: string) {
  const text = await generateDemoAi(classId, 'business', '请写营销 4P：产品、价格、渠道、推广，各一行。');
  const [product, price, place, promotion] = linesOf(text);
  return saveBusinessModelWorkspacePartial(classId, {
    marketing: { product: product || text, price: price || '', place: place || '', promotion: promotion || '' },
  });
}

export async function generateBusinessModelFinanceItemsAi(classId: string) {
  const text = await generateDemoAi(classId, 'business', '请给一项固定成本和一项月收入，用中文短句。');
  const [cost, revenue] = linesOf(text);
  return saveBusinessModelWorkspacePartial(classId, {
    finance: {
      costs: [{ id: 1, category: '固定成本', name: cost || '场地与人员', amount: 1000 }],
      revenues: [{ id: 1, source: revenue || '产品销售收入', monthly: 2000 }],
    },
  });
}

export async function generateBusinessModelBmcAi(classId: string) {
  const text = await generateDemoAi(classId, 'business', '请按商业模式画布九宫格各写一句。');
  const lines = linesOf(text);
  const ws = read(classId);
  const bmc = emptyBmc();
  BMC_KEYS.forEach((key, index) => {
    bmc[key] = lines[index] || (index === 2 ? text.slice(0, 120) : '');
  });
  ws.bmc = bmc;
  ws.bmcCanvasGeneratedAt = nowIso();
  return write(classId, ws);
}

export async function saveBusinessModelBmc(classId: string, bmc: BmcPayload) {
  const ws = read(classId);
  ws.bmc = bmc;
  ws.bmcCanvasSavedAt = nowIso();
  return write(classId, ws);
}

function hatMessage(hat: WarRoomHat, content: string, roundIndex: number): WarRoomDebateMessage {
  return {
    id: demoId(),
    hat,
    content,
    targetModule: null,
    moduleContent: content,
    fills: [],
    adoptedModules: [],
    roundIndex,
    createdAt: nowIso(),
  };
}

async function pushRound(classId: string, studentDisplayName: string, userMessage: string, hat?: WarRoomHat) {
  const ws = read(classId);
  const room = ws.warRoom || { canvas: {}, transcript: { messages: [], roundCount: 0 }, filledCount: 0 };
  const roundIndex = (room.transcript.roundCount || 0) + 1;
  const messages: WarRoomDebateMessage[] = [];
  if (userMessage.trim()) messages.push(hatMessage('user', userMessage.trim(), roundIndex));
  const text = await generateDemoAi(
    classId,
    'business',
    `${studentDisplayName} 正在做商业模式作战室。${userMessage || '请用蓝帽主持开场。'}`
  );
  messages.push(hatMessage(hat && hat !== 'user' ? hat : 'blue', text, roundIndex));
  room.transcript.messages = [...room.transcript.messages, ...messages];
  room.transcript.roundCount = roundIndex;
  ws.warRoom = room;
  write(classId, ws);
  return { roundMessages: messages, workspace: ws, message: messages[messages.length - 1] };
}

export async function warRoomDebateStart(classId: string, studentDisplayName: string) {
  return pushRound(classId, studentDisplayName, '');
}

export async function warRoomDebateRound(classId: string, studentDisplayName: string, userMessage?: string) {
  return pushRound(classId, studentDisplayName, userMessage || '');
}

export async function warRoomDebateReply(classId: string, studentDisplayName: string, userMessage: string, hat?: WarRoomHat) {
  const result = await pushRound(classId, studentDisplayName, userMessage, hat || 'blue');
  return { message: result.message, workspace: result.workspace };
}

export async function saveWarRoomCanvasCell(classId: string, moduleKey: string, content: string) {
  const ws = read(classId);
  const room = ws.warRoom || { canvas: {}, transcript: { messages: [], roundCount: 0 }, filledCount: 0 };
  room.canvas = { ...room.canvas, [moduleKey]: { content, updatedBy: DEMO_STUDENT_NAME } };
  ws.warRoom = room;
  return write(classId, ws);
}

export async function adoptWarRoomMessage(classId: string, messageId: string, moduleKey?: string) {
  const ws = read(classId);
  const room = ws.warRoom || { canvas: {}, transcript: { messages: [], roundCount: 0 }, filledCount: 0 };
  const found = room.transcript.messages.find((item) => item.id === messageId);
  const key = moduleKey || found?.targetModule || 'valueProposition';
  if (found) {
    found.status = 'adopted';
    found.adoptedModules = Array.from(new Set([...(found.adoptedModules || []), key]));
  }
  room.canvas = { ...room.canvas, [key]: { content: found?.moduleContent || found?.content || '', updatedBy: DEMO_STUDENT_NAME } };
  ws.warRoom = room;
  return write(classId, ws);
}

export async function saveWarRoomCanvasRecord(classId: string) {
  const ws = read(classId);
  const filled = Object.values(ws.warRoom?.canvas || {}).filter((cell) => String(cell?.content || '').trim()).length;
  const saved: SavedWar = { canvas: { ...(ws.warRoom?.canvas || {}) }, savedAt: nowIso(), filledCount: filled };
  writeFlow(classId, 'businessWarSaved', saved);
  ws.warRoomTeamRecords = [{ studentId: DEMO_STUDENT_ID, studentName: DEMO_STUDENT_NAME, savedAt: saved.savedAt, filledCount: filled }];
  return write(classId, ws);
}

export async function fetchWarRoomMemberRecord(classId: string, _studentId: string) {
  const saved = readFlow<SavedWar | null>(classId, 'businessWarSaved', null);
  const ws = read(classId);
  const canvas = saved?.canvas || ws.warRoom?.canvas || {};
  const filledCount = saved?.filledCount ?? Object.values(canvas).filter((cell) => String(cell?.content || '').trim()).length;
  return {
    studentId: DEMO_STUDENT_ID,
    studentName: DEMO_STUDENT_NAME,
    savedAt: saved?.savedAt || '',
    canvas,
    filledCount,
  };
}
