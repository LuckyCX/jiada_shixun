/**
 * 商业模式演示接口，含作战室。结果只回写 session。
 */
import { generateDemoAi } from './demoApi';
import { DEMO_STUDENT_ID, DEMO_STUDENT_NAME, demoId, nowIso, parseLooseJson, readFlow, writeFlow } from './demoFlow';
import {
  afterHatStudentAnswer,
  coerceHatSession,
  defaultHatSession,
  markAwaitingAnswer,
  switchHatPerspective,
  type HatSessionState,
} from '../../../../lib/sixHatsSession';
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
import type { TeacherBmcReviewItem } from '../../../../lib/teacherBmcReviewApi';

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
    warRoom: {
      canvas: {},
      transcript: { messages: [], roundCount: 0 },
      filledCount: 0,
      hatSession: defaultHatSession(),
    },
    warRoomTeamRecords: [],
  };
}

type SavedWar = { canvas: WarRoomCanvas; savedAt: string; filledCount: number };

type DemoWarTranscript = {
  messages: WarRoomDebateMessage[];
  roundCount: number;
  hatSession?: HatSessionState;
};

function ensureWarRoom(ws: BusinessModelWorkspacePayload) {
  const room = ws.warRoom || emptyWorkspace().warRoom!;
  const transcript = (room.transcript || { messages: [], roundCount: 0 }) as DemoWarTranscript;
  const hatSession = coerceHatSession(transcript.hatSession || room.hatSession);
  transcript.hatSession = hatSession;
  room.transcript = transcript;
  room.hatSession = hatSession;
  ws.warRoom = room;
  return room;
}

function read(classId: string) {
  const ws = readFlow(classId, 'business', emptyWorkspace());
  ws.swot = ws.swot || emptyWorkspace().swot;
  ws.marketing = ws.marketing || emptyWorkspace().marketing;
  ws.finance = ws.finance || { costs: [], revenues: [] };
  ws.bmc = { ...emptyBmc(), ...ws.bmc };
  ensureWarRoom(ws);
  ws.teamMembers = [{ id: DEMO_STUDENT_ID, name: DEMO_STUDENT_NAME }];
  ws.isTeamLeader = true;
  return ws;
}

function write(classId: string, ws: BusinessModelWorkspacePayload) {
  const room = ensureWarRoom(ws);
  room.filledCount = Object.values(room.canvas || {}).filter((cell) => String(cell?.content || '').trim()).length;
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
  const reviews = readFlow<unknown[]>(classId, 'businessBmcReviews', []);
  if (!Array.isArray(reviews) || reviews.length < 1) {
    throw new Error('请先完成至少 1 次 AI 审查后再上传画布');
  }
  const ws = read(classId);
  ws.bmc = bmc;
  ws.bmcCanvasSavedAt = nowIso();
  (ws as { bmcReviewStatus?: string }).bmcReviewStatus = 'pending';
  (ws as { bmcReviewComment?: string }).bmcReviewComment = '';
  (ws as { bmcReviewedAt?: string }).bmcReviewedAt = '';
  return write(classId, ws);
}

/** 演示端：教师审核商业画布列表（读 session 中演示团队上传结果） */
export async function fetchTeacherBmcReviews(
  classId: string,
  status: 'all' | 'pending' | 'approved' | 'rejected' = 'all'
) {
  const ws = read(classId) as BusinessModelWorkspacePayload & {
    bmcReviewStatus?: string;
    bmcReviewComment?: string;
    bmcReviewedAt?: string;
    bmcCanvasSavedAt?: string;
  };
  const reviewStatus = String(ws.bmcReviewStatus || 'draft');
  if (!ws.bmcCanvasSavedAt || reviewStatus === 'draft') return [] as TeacherBmcReviewItem[];
  const item: TeacherBmcReviewItem = {
    teamId: 'demo-team',
    teamName: '演示团队',
    bmc: ws.bmc || emptyBmc(),
    savedAt: String(ws.bmcCanvasSavedAt || ''),
    submitterName: DEMO_STUDENT_NAME,
    status: reviewStatus,
    reviewComment: String(ws.bmcReviewComment || ''),
    reviewedAt: String(ws.bmcReviewedAt || ''),
    reviewerName: reviewStatus === 'pending' ? '' : '演示教师',
  };
  if (status !== 'all' && item.status !== status) return [];
  return [item];
}

export async function reviewTeacherBmc(
  classId: string,
  _teamId: string,
  body: { decision: 'approve' | 'reject'; comment: string }
) {
  const ws = read(classId) as BusinessModelWorkspacePayload & {
    bmcReviewStatus?: string;
    bmcReviewComment?: string;
    bmcReviewedAt?: string;
  };
  const status = body.decision === 'approve' ? 'approved' : 'rejected';
  ws.bmcReviewStatus = status;
  ws.bmcReviewComment = String(body.comment || '').trim();
  ws.bmcReviewedAt = nowIso();
  write(classId, ws);
  return { teamId: 'demo-team', status, reviewComment: ws.bmcReviewComment };
}

export async function submitBmcAiReview(classId: string, body: { selfNote: string; bmc: BmcPayload }) {
  const ws = await saveBusinessModelWorkspacePartial(classId, {});
  const review = {
    id: `demo-rev-${Date.now()}`,
    selfNote: body.selfNote || '',
    aiResult: {
      summary: '演示审查：九格结构基本完整，建议补充可验证的客户规模与成本假设。',
      score: 72,
      suggestions: ['补齐客户分层依据', '明确关键业务中的验证动作'],
    },
    aiScore: 72,
    createdAt: nowIso(),
    submittedBy: 'demo',
    submitterName: '演示学生',
    teamName: '演示团队',
  };
  const bag = read(classId);
  bag.bmc = body.bmc;
  write(classId, bag);
  const prev = readFlow<typeof review[]>(classId, 'businessBmcReviews', []);
  writeFlow(classId, 'businessBmcReviews', [review, ...(Array.isArray(prev) ? prev : [])]);
  return { review, workspace: { ...ws, bmc: body.bmc } };
}

export async function fetchBmcAiReviews(classId: string) {
  const reviews = readFlow<unknown[]>(classId, 'businessBmcReviews', []);
  return { reviews: Array.isArray(reviews) ? reviews : [] };
}

export async function acquireBmcCellLock(_classId: string, cellKey: string) {
  return { lock: { cellKey, lockedById: 'demo', lockedByName: '我' } };
}

export async function releaseBmcCellLock() {
  return;
}

export async function warRoomSwitchHat(classId: string, hat: string) {
  const ws = read(classId);
  const room = ensureWarRoom(ws);
  const transcript = room.transcript as DemoWarTranscript;
  const switched = switchHatPerspective(transcript.hatSession, hat);
  if (!('error' in switched)) {
    transcript.hatSession = switched.session;
    room.hatSession = switched.session;
  }
  write(classId, ws);
  return { workspace: ws };
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

/** 与学生端一致的六帽人设（演示侧拼进 user 上下文） */
const WAR_ROOM_HAT_ROLES: Record<Exclude<WarRoomHat, 'user'>, string> = {
  white: '白帽（客观事实｜补信息）：聚焦事实与可验证数据，不做主观评判。提出最多 3 个苏格拉底式追问。',
  red: '红帽（用户共情｜贴需求）：站在用户感受与情绪提问，最多 3 个苏格拉底式追问。',
  black: '黑帽（风险批判｜查风险）：审慎识别隐患与障碍，最多 3 个苏格拉底式追问。',
  yellow: '黄帽（正向价值｜判价值）：挖掘价值与优势，最多 3 个苏格拉底式追问。',
  green: '绿帽（发散创新｜找创新）：鼓励发散与差异化，最多 3 个苏格拉底式追问。',
  blue: '蓝帽（全局系统｜做统筹）：整合各维结论、规划下一步，最多 3 个苏格拉底式追问。',
};

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
  let content = stripMdLite(String(raw?.content || ''));
  const questions = Array.isArray(raw?.questions)
    ? raw!.questions!.map((q) => String(q || '').trim()).filter(Boolean).slice(0, 3)
    : [];
  if (!content && questions.length) {
    content = questions.map((q, i) => `${i + 1}. ${q}`).join('\n');
  }
  if (!content) {
    content = `${WAR_ROOM_HAT_ROLES[fallbackHat].split('：')[0]}：请围绕「${fallbackModule}」补充可验证要点。`;
  }
  const fills = collectFills(raw, content, fallbackModule);
  const hatRaw = String(raw?.hat || '').trim();
  const hat = (
    ['white', 'red', 'black', 'yellow', 'green', 'blue'].includes(hatRaw) ? hatRaw : fallbackHat
  ) as Exclude<WarRoomHat, 'user'>;
  const msg = hatMessage(hat, content, roundIndex, {
    targetModule: fills[0]?.targetModule || null,
    moduleContent: fills[0]?.moduleContent || '',
    fills,
  });
  return msg;
}

/** 生成单帽苏格拉底追问（最多 3 问） */
async function generateDemoWarRoomAsk(
  classId: string,
  studentDisplayName: string,
  hat: Exclude<WarRoomHat, 'user'>,
  history: WarRoomDebateMessage[],
  roundIndex: number
) {
  const prompt = [
    `【辩论历史】\n${formatWarRoomHistory(history)}`,
    '',
    `【你的角色】${WAR_ROOM_HAT_ROLES[hat]}`,
    `面向 ${studentDisplayName}，以该帽视角提出最多 3 个苏格拉底式追问（提问不代改，不代填画布）。`,
    '只返回 JSON：{"hat":"' + hat + '","content":"提问正文","questions":["追问1","追问2","追问3"]}',
  ].join('\n');
  const text = await generateDemoAi(classId, 'war-room-ask', prompt);
  const parsed = parseLooseJson<Record<string, unknown> | null>(text, null);
  const msg = parseAiHatMessage(parsed, hat, 'valueProposition', roundIndex);
  msg.hat = hat;
  msg.status = 'ask';
  return msg;
}

/** 单帽承接回复（可继续追问） */
async function generateDemoWarRoomReply(
  classId: string,
  studentDisplayName: string,
  hat: Exclude<WarRoomHat, 'user'>,
  userMessage: string,
  history: WarRoomDebateMessage[],
  roundIndex: number
) {
  const prompt = [
    `【辩论历史】\n${formatWarRoomHistory(history)}`,
    '',
    `【学生发言】${studentDisplayName}：${userMessage.trim()}`,
    `【你的角色】${WAR_ROOM_HAT_ROLES[hat]}`,
    '承接学生回答并继续提问引导（提问不代改）。只返回 JSON：{"hat":"' + hat + '","content":"回复正文"}',
  ].join('\n');
  const text = await generateDemoAi(classId, 'war-room-reply', prompt);
  const parsed = parseLooseJson<Record<string, unknown> | null>(text, null);
  const msg = parseAiHatMessage(parsed, hat, inferModuleKey(userMessage, roundIndex), roundIndex);
  msg.hat = hat;
  return msg;
}

/** 开场：蓝帽引导 + 白帽第一轮苏格拉底三问（禁止一次抛出六帽） */
export async function warRoomDebateStart(classId: string, studentDisplayName: string) {
  const ws = read(classId);
  const room = ensureWarRoom(ws);
  const transcript = room.transcript as DemoWarTranscript;
  if (transcript.messages.length > 0) {
    return { roundMessages: transcript.messages, workspace: ws };
  }
  const name = studentDisplayName || DEMO_STUDENT_NAME;
  const guide = hatMessage(
    'blue',
    `${name}，欢迎进入虚拟董事会。将按「白→绿→黄→黑→红→蓝」顺序，每顶帽子提出最多 3 个苏格拉底式追问，并可进行最多 3 轮对话后再进入下一帽（提问不代改）。也可随时 @某帽 专项深挖。请先简要说明你的创业设想。`,
    0
  );
  guide.status = 'guide';
  const ask = await generateDemoWarRoomAsk(classId, name, 'white', [guide], 0);
  transcript.messages = [guide, ask];
  transcript.roundCount = 1;
  transcript.hatSession = markAwaitingAnswer(defaultHatSession(), 'white');
  room.hatSession = transcript.hatSession;
  write(classId, ws);
  return { roundMessages: transcript.messages, workspace: ws };
}

export async function warRoomDebateRound(
  classId: string,
  studentDisplayName: string,
  userMessage?: string,
  hat?: WarRoomHat
) {
  return warRoomDebateReply(classId, studentDisplayName, userMessage || '', hat);
}

export async function warRoomDebateReply(
  classId: string,
  studentDisplayName: string,
  userMessage: string,
  hat?: WarRoomHat
) {
  const ws = read(classId);
  const room = ensureWarRoom(ws);
  const transcript = room.transcript as DemoWarTranscript;
  const session = coerceHatSession(transcript.hatSession);
  const text = String(userMessage || '').trim();
  if (!text) throw new Error('请输入发言内容');
  if (!transcript.messages.length) throw new Error('请先等待白帽开场');

  const mentioned = parseMentionedHat(text) as Exclude<WarRoomHat, 'user'> | null;
  const roundIndex = transcript.roundCount || 0;
  const out: WarRoomDebateMessage[] = [hatMessage('user', text, roundIndex)];
  const history = [...transcript.messages, ...out];

  // @某帽：仅该帽单次回复，不推进顺序
  if (mentioned) {
    const switched = switchHatPerspective(session, mentioned);
    const nextSession = 'error' in switched ? session : switched.session;
    const reply = await generateDemoWarRoomReply(classId, studentDisplayName, mentioned, text, history, roundIndex);
    out.push(reply);
    transcript.messages = [...transcript.messages, ...out];
    transcript.hatSession = { ...nextSession, activeHat: mentioned, awaitingAnswer: false };
    room.hatSession = transcript.hatSession;
    write(classId, ws);
    return { roundMessages: out, message: reply, workspace: ws };
  }

  const activeHat = (
    (hat && hat !== 'user' ? hat : null) ||
    session.activeHat ||
    'white'
  ) as Exclude<WarRoomHat, 'user'>;

  // 顺序轮询且等待作答：累计本帽轮次，满 3 轮再切下一帽
  if (session.mode === 'sequential' && !session.sequentialDone && session.awaitingAnswer) {
    const answeredHat = (session.activeHat || activeHat) as Exclude<WarRoomHat, 'user'>;
    const progressed = afterHatStudentAnswer(session, answeredHat);
    const reply = await generateDemoWarRoomReply(classId, studentDisplayName, answeredHat, text, history, roundIndex);
    reply.status = progressed.stayOnHat ? 'ask' : undefined;
    out.push(reply);

    if (progressed.stayOnHat) {
      transcript.messages = [...transcript.messages, ...out];
      transcript.hatSession = markAwaitingAnswer(progressed.session, answeredHat);
      room.hatSession = transcript.hatSession;
      write(classId, ws);
      return { roundMessages: out, message: reply, workspace: ws };
    }

    if (!progressed.session.sequentialDone) {
      const nextHat = progressed.session.activeHat as Exclude<WarRoomHat, 'user'>;
      const ask = await generateDemoWarRoomAsk(
        classId,
        studentDisplayName,
        nextHat,
        [...history, reply],
        roundIndex + 1
      );
      out.push(ask);
      transcript.messages = [...transcript.messages, ...out];
      transcript.roundCount = roundIndex + 1;
      transcript.hatSession = markAwaitingAnswer(progressed.session, nextHat);
      room.hatSession = transcript.hatSession;
      write(classId, ws);
      return { roundMessages: out, message: ask, workspace: ws };
    }

    transcript.messages = [...transcript.messages, ...out];
    transcript.hatSession = { ...progressed.session, awaitingAnswer: false };
    room.hatSession = transcript.hatSession;
    write(classId, ws);
    return { roundMessages: out, message: reply, workspace: ws };
  }

  // 自由模式 / 非等待态：单帽回复
  const reply = await generateDemoWarRoomReply(classId, studentDisplayName, activeHat, text, history, roundIndex);
  out.push(reply);
  transcript.messages = [...transcript.messages, ...out];
  transcript.hatSession = { ...session, activeHat, awaitingAnswer: false };
  room.hatSession = transcript.hatSession;
  write(classId, ws);
  return { roundMessages: out, message: reply, workspace: ws };
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
