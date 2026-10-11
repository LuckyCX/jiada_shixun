/**
 * 商业模式演示接口，含作战室。结果只回写 session。
 */
import { generateDemoAi } from './demoApi';
import { DEMO_STUDENT_ID, DEMO_STUDENT_NAME, demoId, nowIso, parseLooseJson, readFlow, writeFlow } from './demoFlow';
import {
  WAR_ROOM_MODULE_DEFS,
  parseMentionedHat,
  type BmcPayload,
  type BusinessModelWorkspacePayload,
  type CostItemPayload,
  type Marketing4pPayload,
  type RevenueItemPayload,
  type SwotPayload,
  type WarRoomCanvas,
  type WarRoomDebateMessage,
  type WarRoomHat,
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

export { WAR_ROOM_MODULE_DEFS, parseMentionedHat };

const WAR_ROOM_MODULE_KEYS = WAR_ROOM_MODULE_DEFS.map((item) => item.key);

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

function stripMdLite(text: string) {
  return String(text || '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

function normalizeModuleKey(raw: unknown): string | null {
  const key = String(raw || '').trim();
  return WAR_ROOM_MODULE_KEYS.includes(key) ? key : null;
}

/** 从发言/学生提问里猜一格画布，保证演示消息总能带出采纳按钮 */
function inferModuleKey(text: string, roundIndex: number): string {
  const t = String(text || '');
  const rules: [RegExp, string][] = [
    [/客户细分|目标客户|用户群|细分/, 'customerSegments'],
    [/价值主张|核心价值|痛点/, 'valueProposition'],
    [/渠道|通路|获客/, 'channels'],
    [/客户关系|社群|留存/, 'customerRelationships'],
    [/收入|变现|定价|收费/, 'revenueStreams'],
    [/核心资源|关键资源/, 'keyResources'],
    [/关键业务|关键活动/, 'keyActivities'],
    [/合作伙伴|伙伴|供应商/, 'keyPartnerships'],
    [/成本|费用/, 'costStructure'],
  ];
  for (const [re, key] of rules) {
    if (re.test(t)) return key;
  }
  return WAR_ROOM_MODULE_KEYS[(Math.max(1, roundIndex) - 1) % WAR_ROOM_MODULE_KEYS.length];
}

function collectFills(parsed: Record<string, unknown> | null, fallbackContent: string, fallbackModule: string) {
  const fills: { targetModule: string; moduleContent: string }[] = [];
  const push = (targetModule: unknown, moduleContent: unknown) => {
    const key = normalizeModuleKey(targetModule);
    const content = stripMdLite(String(moduleContent || ''));
    if (!key || !content) return;
    if (fills.some((item) => item.targetModule === key)) return;
    fills.push({ targetModule: key, moduleContent: content });
  };
  if (parsed && Array.isArray(parsed.fills)) {
    for (const item of parsed.fills) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      push(row.targetModule, row.moduleContent);
    }
  }
  if (parsed) push(parsed.targetModule, parsed.moduleContent);
  if (!fills.length) {
    fills.push({
      targetModule: fallbackModule,
      moduleContent: stripMdLite(fallbackContent).slice(0, 280) || '课堂演示：请补充本格要点',
    });
  }
  return fills;
}

function hatMessage(
  hat: WarRoomHat,
  content: string,
  roundIndex: number,
  opts?: {
    targetModule?: string | null;
    moduleContent?: string;
    fills?: { targetModule: string; moduleContent: string }[];
  }
): WarRoomDebateMessage {
  return {
    id: demoId(),
    hat,
    content,
    targetModule: opts?.targetModule ?? null,
    moduleContent: opts?.moduleContent ?? '',
    fills: opts?.fills || [],
    adoptedModules: [],
    roundIndex,
    createdAt: nowIso(),
  };
}

/** 与学生端一致的六帽人设（演示侧拼进 user 上下文，后端 scene 再用同一套 system） */
const WAR_ROOM_HAT_ROLES: Record<Exclude<WarRoomHat, 'user'>, string> = {
  white: '白帽（数据分析师）：只基于客观事实和数据发言。补充市场规模、目标用户、竞品、成本利润等可验证事实，不主观评价。',
  red: '红帽（用户代表）：以目标用户身份谈第一感受：会不会想用、哪里别扭、最在意什么体验。少讲大道理。',
  black: '黑帽（风险预警员）：指出关键约束与风险，并给出可写入画布的调整建议；禁止只做否定。',
  yellow: '黄帽（乐观倡导者）：挖掘优势、痛点机会、盈利亮点，并推动某一格可落地的表述。',
  green: '绿帽（创意设计师）：提出差异化创意：产品优化、新玩法/渠道/盈利模式，尽量对应具体画布格。',
  blue: '蓝帽（项目经理）：控场与总结。引导讨论、追问关键信息，建议下一步并推动九格补全。',
};

const MIDDLE_HATS: Exclude<WarRoomHat, 'user' | 'white' | 'blue'>[] = ['red', 'black', 'yellow', 'green'];

function shuffleMiddleHats() {
  const arr = [...MIDDLE_HATS];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildWarRoomHatOrder(): Exclude<WarRoomHat, 'user'>[] {
  return ['white', ...shuffleMiddleHats(), 'blue'];
}

function formatWarRoomHistory(messages: WarRoomDebateMessage[]) {
  return (
    messages
      .slice(-12)
      .map((m) => {
        const role = m.hat === 'user' ? '学生' : WAR_ROOM_HAT_ROLES[m.hat as Exclude<WarRoomHat, 'user'>]?.slice(0, 10) || m.hat;
        return `[${role}] ${stripMdLite(m.content)}`;
      })
      .join('\n\n') || '（尚无历史发言）'
  );
}

function parseAiHatMessage(
  raw: Record<string, unknown> | null,
  fallbackHat: Exclude<WarRoomHat, 'user'>,
  fallbackModule: string,
  roundIndex: number
) {
  const content =
    stripMdLite(String(raw?.content || '')) ||
    `${WAR_ROOM_HAT_ROLES[fallbackHat].split('：')[0]}：请围绕「${fallbackModule}」补充可写入画布的要点。`;
  const fills = collectFills(raw, content, fallbackModule);
  const hatRaw = String(raw?.hat || '').trim();
  const hat = (
    ['white', 'red', 'black', 'yellow', 'green', 'blue'].includes(hatRaw) ? hatRaw : fallbackHat
  ) as Exclude<WarRoomHat, 'user'>;
  return hatMessage(hat, content, roundIndex, {
    targetModule: fills[0]?.targetModule || fallbackModule,
    moduleContent: fills[0]?.moduleContent || content,
    fills,
  });
}

/** @ 某一顶帽子：单帽针对性回复 */
async function pushSingleHatReply(
  classId: string,
  studentDisplayName: string,
  userMessage: string,
  hat: Exclude<WarRoomHat, 'user'>
) {
  const ws = read(classId);
  const room = ws.warRoom || { canvas: {}, transcript: { messages: [], roundCount: 0 }, filledCount: 0 };
  const roundIndex = room.transcript.roundCount || 0;
  const messages: WarRoomDebateMessage[] = [];
  if (userMessage.trim()) messages.push(hatMessage('user', userMessage.trim(), roundIndex));
  const fallbackModule = inferModuleKey(userMessage || '价值主张', roundIndex + 1);
  const prompt = [
    '【学生发言】',
    `${studentDisplayName}：${userMessage.trim() || '（请围绕当前画布继续讨论）'}`,
    '',
    `【你的角色】${WAR_ROOM_HAT_ROLES[hat]}`,
    '必须严格以该角色身份回复，禁止串成其他帽子或通用助教。',
    '',
    '【辩论历史】',
    formatWarRoomHistory(room.transcript.messages),
    '',
    '只返回 JSON：',
    '{"hat":"' + hat + '","content":"发言正文","targetModule":"九格键名或 null","moduleContent":"可写入该格全文","fills":[{"targetModule":"九格键名","moduleContent":"全文"}]}',
    `targetModule 只能是：${WAR_ROOM_MODULE_KEYS.join(', ')} 或 null。`,
    `优先可写入格子：${fallbackModule}。fills 至少 1 条。`,
  ].join('\n');

  const text = await generateDemoAi(classId, 'war-room-reply', prompt);
  const parsed = parseLooseJson<Record<string, unknown> | null>(text, null);
  messages.push(parseAiHatMessage(parsed, hat, fallbackModule, roundIndex));

  room.transcript.messages = [...room.transcript.messages, ...messages];
  ws.warRoom = room;
  write(classId, ws);
  return { roundMessages: messages, workspace: ws, message: messages[messages.length - 1] };
}

/** 开始辩论 / 不 @：整轮六帽，每人设各一条 */
async function pushFullHatRound(classId: string, studentDisplayName: string, userMessage: string) {
  const ws = read(classId);
  const room = ws.warRoom || { canvas: {}, transcript: { messages: [], roundCount: 0 }, filledCount: 0 };
  const roundIndex = room.transcript.roundCount || 0;
  const out: WarRoomDebateMessage[] = [];
  if (userMessage.trim()) out.push(hatMessage('user', userMessage.trim(), roundIndex));

  const hatOrder = buildWarRoomHatOrder();
  const orderDesc = hatOrder.map((h, i) => `${i + 1}. ${h}（${WAR_ROOM_HAT_ROLES[h].split('：')[0]}）`).join('\n');
  const prompt = [
    `学生显示名：${studentDisplayName}`,
    userMessage.trim() ? `【学生本轮发言】${userMessage.trim()}` : '【开场】请六帽围绕画布九格做第一轮引导讨论。',
    '',
    '【辩论历史】',
    formatWarRoomHistory(room.transcript.messages),
    '',
    '【本轮要求】',
    '- 输出恰好 6 条 messages，顺序必须如下：',
    orderDesc,
    '- 每条必须符合对应帽子人设，禁止串戏',
    '- 至少 3 条带 targetModule + moduleContent（可采纳写入画布）',
    '- 蓝帽末条请 @' + studentDisplayName,
    '',
    '只返回 JSON：{"messages":[{"hat":"...","content":"...","targetModule":null,"moduleContent":""}]}',
    `targetModule 只能是：${WAR_ROOM_MODULE_KEYS.join(', ')} 或 null。`,
  ].join('\n');

  const text = await generateDemoAi(classId, 'war-room-round', prompt);
  const parsed = parseLooseJson<{ messages?: unknown[] } | null>(text, null);
  const rawList = Array.isArray(parsed?.messages) ? parsed!.messages! : [];

  hatOrder.forEach((h, index) => {
    const row = (rawList[index] && typeof rawList[index] === 'object' ? rawList[index] : null) as Record<
      string,
      unknown
    > | null;
    const fallbackModule = WAR_ROOM_MODULE_KEYS[index % WAR_ROOM_MODULE_KEYS.length];
    const msg = parseAiHatMessage(row, h, fallbackModule, roundIndex);
    msg.hat = h;
    out.push(msg);
  });

  room.transcript.messages = [...room.transcript.messages, ...out];
  room.transcript.roundCount = roundIndex + 1;
  ws.warRoom = room;
  write(classId, ws);
  return { roundMessages: out, workspace: ws, message: out[out.length - 1] };
}

export async function warRoomDebateStart(classId: string, studentDisplayName: string) {
  return pushFullHatRound(classId, studentDisplayName, '');
}

export async function warRoomDebateRound(classId: string, studentDisplayName: string, userMessage?: string) {
  return pushFullHatRound(classId, studentDisplayName, userMessage || '');
}

export async function warRoomDebateReply(classId: string, studentDisplayName: string, userMessage: string, hat?: WarRoomHat) {
  const replyHat = (hat && hat !== 'user' ? hat : 'blue') as Exclude<WarRoomHat, 'user'>;
  const result = await pushSingleHatReply(classId, studentDisplayName, userMessage, replyHat);
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
  const fillContent =
    found?.fills?.find((item) => item.targetModule === key)?.moduleContent ||
    (found?.targetModule === key ? found.moduleContent : '') ||
    found?.moduleContent ||
    found?.content ||
    '';
  if (found) {
    found.adoptedModules = Array.from(new Set([...(found.adoptedModules || []), key]));
    const required =
      found.fills?.map((item) => item.targetModule) || (found.targetModule ? [found.targetModule] : []);
    const allAdopted = required.length > 0 && required.every((item) => found.adoptedModules?.includes(item));
    if (allAdopted) found.status = 'adopted';
  }
  room.canvas = { ...room.canvas, [key]: { content: String(fillContent || '').trim(), updatedBy: DEMO_STUDENT_NAME } };
  room.filledCount = Object.values(room.canvas).filter((cell) => String(cell?.content || '').trim()).length;
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
