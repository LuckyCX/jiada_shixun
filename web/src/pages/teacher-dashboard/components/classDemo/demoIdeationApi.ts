/**
 * 创新思维演示接口：函数名和返回形状跟学生端一致，数据只在 session。
 */
import { generateDemoAi } from './demoApi';
import { DEMO_STUDENT_ID, DEMO_STUDENT_NAME, demoId, demoTeamName, nowIso, parseLooseJson, patchFlow, readFlow } from './demoFlow';
import {
  afterHatStudentAnswer,
  coerceHatSession,
  defaultHatSession,
  markAwaitingAnswer,
  switchHatPerspective,
} from '../../../../lib/sixHatsSession';
import type {
  HatStudioDebateMessage,
  HatStudioHat,
  HatStudioPayload,
  IdeationMethodKey,
  IdeationProjectTopic,
  IdeationProjectTopicDraft,
  IdeationProjectTopicInput,
  StudentIdeationDiscussion,
  StudentIdeationIdea,
  StudentIdeationWorkspace,
} from '../../../../lib/studentIdeationApi';

export type {
  HatSessionState,
  HatStudioDebateMessage,
  HatStudioDraft,
  HatStudioHat,
  HatStudioPayload,
  IdeationChatMethodKey,
  IdeationIdeaPreview,
  IdeationMethodKey,
  IdeationProjectTopic,
  IdeationProjectTopicDraft,
  IdeationProjectTopicInput,
  MidwiferyTurnResult,
  StudentIdeationAnalysis,
  StudentIdeationDiscussion,
  StudentIdeationIdea,
  StudentIdeationPrerequisiteMember,
  StudentIdeationWorkspace,
} from '../../../../lib/studentIdeationApi';

export { parseHatStudioMentionedHat } from '../../../../lib/studentIdeationApi';
import { parseHatStudioMentionedHat as parseMentionedHat } from '../../../../lib/studentIdeationApi';

const HAT_DEFS = [
  { key: 'ideaTitle', label: '创意标题' },
  { key: 'problemInsight', label: '问题洞察' },
  { key: 'userValue', label: '用户价值' },
  { key: 'solutionPoints', label: '方案要点' },
  { key: 'riskDiff', label: '风险与差异' },
];

const METHOD_LABEL: Record<string, string> = {
  midwifery: '启思智能体',
  brainstorm: '头脑风暴',
  ai: 'AI 创意',
  six_hats: '六帽创想室',
  scamper: 'SCAMPER',
  triz: 'TRIZ',
};

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const text = String(raw || '').trim();
  if (!text) return null;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

function scoresFrom(parsed: Record<string, unknown> | null, fallbackSummary: string) {
  const num = (k: string, d: number) => {
    const n = Number(parsed?.[k]);
    return Number.isFinite(n) ? n : d;
  };
  const list = (k: string) =>
    Array.isArray(parsed?.[k])
      ? (parsed![k] as unknown[]).map((x) => String(x || '').trim()).filter(Boolean).slice(0, 3)
      : [];
  return {
    overallScore: Math.round(num('overallScore', 78)),
    novelty: num('novelty', 3.5),
    feasibility: num('feasibility', 3.4),
    marketPotential: num('marketPotential', 3.6),
    innovation: num('innovation', 3.5),
    summary: String(parsed?.summary || fallbackSummary).slice(0, 500) || '演示创意分析',
    strengths: list('strengths').length ? list('strengths') : ['适合课堂讲解', '结构清晰', '可继续迭代'],
    weaknesses: list('weaknesses').length ? list('weaknesses') : ['演示数据', '待深化验证', '需补充证据'],
    suggestions: list('suggestions').length ? list('suggestions') : ['课堂追问用户', '补一条竞品对比', '明确下一步实验'],
    tags: list('tags').length ? list('tags') : ['演示', '创意', '课堂'],
  };
}

function topicFrom(parsed: Record<string, unknown> | null) {
  const str = (k: string) => String(parsed?.[k] || '').trim();
  return {
    projectDirection: str('projectDirection') || str('direction') || '综合创新',
    coreValue: str('coreValue') || '为用户创造可感知价值',
    targetUsers: str('targetUsers') || '目标用户待细化',
    coreProblem: str('coreProblem') || '核心问题待细化',
    solutionOverview: str('solutionOverview') || '解决方案待细化',
    marketSize: str('marketSize') || '市场规模待评估',
    competitiveAdvantage: str('competitiveAdvantage') || '差异化优势待明确',
  };
}

type IdeationBag = {
  ideas: StudentIdeationIdea[];
  discussions: StudentIdeationDiscussion[];
  topic: IdeationProjectTopic | null;
  draft: IdeationProjectTopicDraft | null;
  hat: HatStudioPayload;
};

function emptyHat(): HatStudioPayload {
  return {
    draft: {},
    draftDefs: HAT_DEFS,
    transcript: { messages: [], roundCount: 0 },
    filledCount: 0,
  };
}

function emptyBag(): IdeationBag {
  return { ideas: [], discussions: [], topic: null, draft: null, hat: emptyHat() };
}

function read(classId: string) {
  const bag = readFlow(classId, 'ideation', emptyBag());
  if (!bag.hat) bag.hat = emptyHat();
  if (!bag.ideas) bag.ideas = [];
  if (!bag.discussions) bag.discussions = [];
  return bag;
}

function write(classId: string, bag: IdeationBag) {
  const filled = Object.values(bag.hat.draft || {}).filter((cell) => String(cell?.content || '').trim()).length;
  bag.hat.filledCount = filled;
  return patchFlow(classId, 'ideation', emptyBag(), () => bag);
}

function workspaceOf(classId: string, bag: IdeationBag): StudentIdeationWorkspace {
  const name = demoTeamName(classId);
  return {
    team: name ? { id: 'demo-team', name } : null,
    ideas: bag.ideas,
    discussions: bag.discussions,
  };
}

const HAT_STUDIO_ROLES: Record<Exclude<HatStudioHat, 'user'>, string> = {
  white: '白帽（客观事实｜补信息）：聚焦事实与可验证数据，提出最多 3 个苏格拉底式追问，不做主观评判。',
  red: '红帽（用户共情｜贴需求）：站在用户感受提问，最多 3 个苏格拉底式追问。',
  black: '黑帽（风险批判｜查风险）：审慎识别隐患，最多 3 个苏格拉底式追问。',
  yellow: '黄帽（正向价值｜判价值）：挖掘价值与优势，最多 3 个苏格拉底式追问。',
  green: '绿帽（发散创新｜找创新）：鼓励发散与差异化，最多 3 个苏格拉底式追问。',
  blue: '蓝帽（全局系统｜做统筹）：整合结论、规划下一步，最多 3 个苏格拉底式追问。',
};

const HAT_STUDIO_DRAFT_KEYS = ['ideaTitle', 'problemInsight', 'userValue', 'solutionPoints', 'riskDiff'] as const;

function hatMessage(
  hat: HatStudioDebateMessage['hat'],
  content: string,
  roundIndex: number,
  opts?: {
    targetModule?: string | null;
    moduleContent?: string;
    fills?: { targetModule: string; moduleContent: string }[];
  }
): HatStudioDebateMessage {
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

function stripHatMd(text: string) {
  return String(text || '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .trim();
}

function formatHatHistory(messages: HatStudioDebateMessage[]) {
  return (
    messages
      .slice(-12)
      .map((m) => {
        const role =
          m.hat === 'user' ? '学生' : HAT_STUDIO_ROLES[m.hat as Exclude<HatStudioHat, 'user'>]?.slice(0, 10) || m.hat;
        return `[${role}] ${stripHatMd(m.content)}`;
      })
      .join('\n\n') || '（尚无历史发言）'
  );
}

function normalizeDraftKey(raw: unknown): string | null {
  const key = String(raw || '').trim();
  return (HAT_STUDIO_DRAFT_KEYS as readonly string[]).includes(key) ? key : null;
}

function collectHatFills(parsed: Record<string, unknown> | null, fallbackContent: string, fallbackKey: string) {
  const fills: { targetModule: string; moduleContent: string }[] = [];
  const push = (targetModule: unknown, moduleContent: unknown) => {
    const key = normalizeDraftKey(targetModule);
    const content = stripHatMd(String(moduleContent || ''));
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
      targetModule: fallbackKey,
      moduleContent: stripHatMd(fallbackContent).slice(0, 200) || '课堂演示：请补充本字段要点',
    });
  }
  return fills;
}

function parseHatAiMessage(
  raw: Record<string, unknown> | null,
  fallbackHat: Exclude<HatStudioHat, 'user'>,
  fallbackKey: string,
  roundIndex: number
) {
  const content =
    stripHatMd(String(raw?.content || '')) ||
    `${HAT_STUDIO_ROLES[fallbackHat].split('：')[0]}：请围绕「${fallbackKey}」补充可写入工作区的要点。`;
  const fills = collectHatFills(raw, content, fallbackKey);
  return hatMessage(fallbackHat, content, roundIndex, {
    targetModule: fills[0]?.targetModule || fallbackKey,
    moduleContent: fills[0]?.moduleContent || content,
    fills,
  });
}

function payloadText(payload: Record<string, unknown>) {
  return Object.values(payload)
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)
    .join('\n');
}

export async function fetchStudentIdeationWorkspace(classId: string): Promise<StudentIdeationWorkspace> {
  return workspaceOf(classId, read(classId));
}

export async function previewStudentIdeationIdea(
  classId: string,
  body: { methodKey: IdeationMethodKey; formPayload: Record<string, unknown> }
) {
  const context =
    payloadText(body.formPayload) ||
    String(body.formPayload.chatTranscript || '') ||
    '请根据课堂演示生成一条创业创意 JSON';
  const raw = await generateDemoAi(classId, 'ideation-chat-generate', context);
  const parsed = parseJsonObject(raw);
  const topic = topicFrom(parsed);
  const title =
    String(parsed?.title || body.formPayload.title || body.formPayload.ideaTitle || '课堂创意').trim().slice(0, 40) ||
    '课堂创意';
  const description =
    String(parsed?.description || raw || '演示生成的创意概述').trim() || '演示生成的创意概述';
  const aiAnalysis = scoresFrom(parsed, description);
  const formPayload = { ...body.formPayload, title, description, ...topic };
  return {
    methodKey: body.methodKey,
    method: METHOD_LABEL[body.methodKey] || body.methodKey,
    title,
    description,
    formPayload,
    aiAnalysis,
    topicFields: topic,
  };
}

export async function commitStudentIdeationIdea(
  classId: string,
  body: {
    methodKey: IdeationMethodKey;
    title: string;
    description: string;
    formPayload: Record<string, unknown>;
    aiAnalysis: StudentIdeationIdea['aiAnalysis'];
  }
): Promise<StudentIdeationIdea> {
  const idea: StudentIdeationIdea = {
    id: demoId(),
    methodKey: body.methodKey,
    method: METHOD_LABEL[body.methodKey] || body.methodKey,
    title: body.title,
    description: body.description,
    formPayload: body.formPayload,
    author: DEMO_STUDENT_NAME,
    authorId: DEMO_STUDENT_ID,
    votes: 0,
    liked: false,
    novelty: Number(body.aiAnalysis?.novelty || 3.5),
    feasibility: Number(body.aiAnalysis?.feasibility || 3.4),
    aiAnalysis: body.aiAnalysis,
    createdAt: nowIso(),
  };
  const bag = read(classId);
  bag.ideas = [idea, ...bag.ideas];
  write(classId, bag);
  return idea;
}

export async function analyzeStudentIdeationIdea(
  classId: string,
  body: { methodKey: IdeationMethodKey; formPayload: Record<string, unknown>; previewOnly?: boolean }
): Promise<StudentIdeationIdea> {
  const preview = await previewStudentIdeationIdea(classId, body);
  if (body.previewOnly) {
    return {
      id: 'preview',
      methodKey: preview.methodKey,
      method: preview.method,
      title: preview.title,
      description: preview.description,
      formPayload: preview.formPayload,
      author: DEMO_STUDENT_NAME,
      authorId: DEMO_STUDENT_ID,
      votes: 0,
      liked: false,
      novelty: preview.aiAnalysis.novelty,
      feasibility: preview.aiAnalysis.feasibility,
      aiAnalysis: preview.aiAnalysis,
      createdAt: nowIso(),
    };
  }
  return commitStudentIdeationIdea(classId, {
    methodKey: body.methodKey,
    title: preview.title,
    description: preview.description,
    formPayload: preview.formPayload,
    aiAnalysis: preview.aiAnalysis,
  });
}

const DEMO_MIDWIFERY_WELCOME =
  '你好！我是启思智能体。很高兴能陪你一起打磨创业想法。\n\n在开始深入探讨之前，我想先听听你目前的构想。请用自己的话简单描述一下：你想解决什么具体问题？或者你的创业想法雏形是什么？';

export async function midwiferyTurn(
  classId: string,
  body: { messages: { role: 'user' | 'assistant'; content: string }[]; roundIndex: number }
) {
  // 开场欢迎：固定文案，不调演示 AI
  const hasUser = body.messages.some((m) => m.role === 'user' && String(m.content || '').trim());
  if (!hasUser) {
    return {
      assistantText: DEMO_MIDWIFERY_WELCOME,
      roundIndex: 0,
      canGenerate: false,
      doneHint: '',
    };
  }

  const context = `当前轮次：${body.roundIndex}\n对话历史：\n${JSON.stringify(body.messages, null, 2)}`;
  const raw = await generateDemoAi(classId, 'ideation-midwifery-turn', context);
  const parsed = parseJsonObject(raw);
  const parsedRound = Number(parsed?.roundIndex);
  const nextRound = Number.isFinite(parsedRound)
    ? Math.max(0, Math.floor(parsedRound))
    : body.messages.some((m) => m.role === 'user')
      ? Math.max(1, body.roundIndex + 1)
      : 0;
  const assistantText =
    String(parsed?.assistantText || '').trim() ||
    raw ||
    (nextRound === 0
      ? '你好！我是启思智能体。先用自己的话聊聊你想解决的问题或创业想法雏形，确认方向后我们再正式追问。'
      : '请继续补充你的想法。');
  // 与学生端一致：综合轮次 / 历史「第3轮已答」/ 模型 JSON / 正文引导
  const canGenerate = resolveDemoMidwiferyCanGenerate({
    messages: body.messages,
    clientRoundIndex: body.roundIndex,
    parsedCanGenerate: parsed?.canGenerate,
    assistantText,
  });
  return {
    assistantText,
    roundIndex: nextRound,
    canGenerate,
    doneHint: canGenerate
      ? String(parsed?.doneHint || '').trim() || '可以点击下方「生成创意」按钮，整合结构化创业可行性分析。'
      : '',
  };
}

/** 演示侧解锁逻辑（对齐 node ideationMidwiferyPrompts.resolveMidwiferyCanGenerate） */
function resolveDemoMidwiferyCanGenerate(opts: {
  messages: { role: string; content: string }[];
  clientRoundIndex: number;
  parsedCanGenerate?: unknown;
  assistantText?: string;
}) {
  const clientRound = Math.max(0, Number(opts.clientRoundIndex) || 0);
  const list = Array.isArray(opts.messages) ? opts.messages : [];
  let maxRoundAsked = 0;
  let lastRound3AskIdx = -1;
  for (let i = 0; i < list.length; i += 1) {
    const m = list[i];
    if (m.role !== 'assistant') continue;
    for (const match of String(m.content || '').matchAll(/第\s*(\d+)\s*轮/g)) {
      const r = Number(match[1]) || 0;
      if (r > maxRoundAsked) maxRoundAsked = r;
      if (r >= 3) lastRound3AskIdx = i;
    }
  }
  const answeredAfterRound3 =
    lastRound3AskIdx >= 0 && list.slice(lastRound3AskIdx + 1).some((m) => m.role === 'user');
  const unlocked = answeredAfterRound3 && maxRoundAsked >= 3;
  const parsedOn = opts.parsedCanGenerate === true || opts.parsedCanGenerate === 'true';
  const text = String(opts.assistantText || '');
  const textHintsGenerate =
    /点击\s*生成创意|生成创意报告|可以点击生成|已完成三轮|三轮核心追问/.test(text) &&
    (clientRound >= 2 || maxRoundAsked >= 2 || unlocked);
  return clientRound >= 3 || unlocked || (parsedOn && (clientRound >= 2 || maxRoundAsked >= 2 || unlocked)) || textHintsGenerate;
}

export async function midwiferyGenerate(
  classId: string,
  body: { messages: { role: 'user' | 'assistant'; content: string }[] }
) {
  if (body.messages.length < 2) throw new Error('请先完成至少一轮对话再生成创意');
  const raw = await generateDemoAi(
    classId,
    'ideation-midwifery-generate',
    `请根据下列启思智能体对话提炼创业创意：\n${JSON.stringify(body.messages, null, 2)}`
  );
  const parsed = parseJsonObject(raw);
  const topic = topicFrom(parsed);
  const title = String(parsed?.title || '启思智能体创意').trim().slice(0, 40) || '启思智能体创意';
  const description = String(parsed?.description || raw).trim() || '根据对话提炼的创意概述';
  const aiAnalysis = scoresFrom(parsed, description);
  return {
    methodKey: 'midwifery' as IdeationMethodKey,
    method: METHOD_LABEL.midwifery,
    title,
    description,
    formPayload: {
      chatTranscript: body.messages.map((m) => `${m.role}: ${m.content}`).join('\n'),
      title,
      description,
      ...topic,
    },
    aiAnalysis,
    topicFields: topic,
  };
}

export async function fetchHatStudio(classId: string): Promise<HatStudioPayload> {
  return read(classId).hat;
}

function syncHatStudioSession(studio: HatStudioPayload, session: ReturnType<typeof coerceHatSession>) {
  const typed = session as HatStudioPayload['hatSession'];
  studio.hatSession = typed;
  studio.transcript.hatSession = typed;
}

/** 开始/重置：只插引导语，不立刻调模型（与学生对齐） */
function insertHatGuide(classId: string, studentDisplayName: string) {
  const bag = read(classId);
  const name = studentDisplayName || DEMO_STUDENT_NAME;
  const guide = hatMessage(
    'blue',
    `${name}，欢迎进入六帽创想室。请先描述你的创业创意（想解决什么问题、给谁用、大致怎么做）。发送后将按「白→绿→黄→黑→红→蓝」顺序，每顶帽子提出最多 3 个苏格拉底式追问，并可进行最多 3 轮对话后再进入下一帽；也可随时 @某帽 专项深挖。核心原则：提问不代改。`,
    0
  );
  guide.status = 'guide';
  const session = defaultHatSession();
  bag.hat.transcript = { messages: [guide], roundCount: 0, hatSession: session as HatStudioPayload['hatSession'] };
  syncHatStudioSession(bag.hat, session);
  write(classId, bag);
  return { roundMessages: [guide], studio: bag.hat, message: guide };
}

async function generateDemoHatAsk(
  classId: string,
  studentDisplayName: string,
  hat: Exclude<HatStudioHat, 'user'>,
  history: HatStudioDebateMessage[],
  roundIndex: number
) {
  const prompt = [
    `【辩论历史】\n${formatHatHistory(history)}`,
    '',
    `【你的角色】${HAT_STUDIO_ROLES[hat]}`,
    `面向 ${studentDisplayName}，以该帽视角提出最多 3 个苏格拉底式追问（提问不代改）。`,
    `只返回 JSON：{"hat":"${hat}","content":"提问正文","questions":["追问1","追问2","追问3"]}`,
  ].join('\n');
  const text = await generateDemoAi(classId, 'hat-studio-ask', prompt);
  const parsed = parseLooseJson<Record<string, unknown> | null>(text, null);
  let content = stripHatMd(String(parsed?.content || ''));
  const questions = Array.isArray(parsed?.questions)
    ? parsed!.questions!.map((q) => String(q || '').trim()).filter(Boolean).slice(0, 3)
    : [];
  if (!content && questions.length) content = questions.map((q, i) => `${i + 1}. ${q}`).join('\n');
  if (!content) content = `${HAT_STUDIO_ROLES[hat].split('：')[0]}：请补充可验证的信息。`;
  const msg = hatMessage(hat, content, roundIndex);
  msg.status = 'ask';
  return msg;
}

async function generateDemoHatReply(
  classId: string,
  studentDisplayName: string,
  hat: Exclude<HatStudioHat, 'user'>,
  userMessage: string,
  history: HatStudioDebateMessage[],
  roundIndex: number
) {
  const fallbackKey = HAT_STUDIO_DRAFT_KEYS[Math.min(roundIndex, HAT_STUDIO_DRAFT_KEYS.length - 1)];
  const prompt = [
    `【辩论历史】\n${formatHatHistory(history)}`,
    '',
    `【学生发言】${studentDisplayName}：${userMessage.trim()}`,
    `【你的角色】${HAT_STUDIO_ROLES[hat]}`,
    '承接学生回答并继续提问引导（提问不代改）。',
    `只返回 JSON：{"hat":"${hat}","content":"回复正文","targetModule":"${fallbackKey}","moduleContent":"可写入要点"}`,
  ].join('\n');
  const text = await generateDemoAi(classId, 'hat-studio-reply', prompt);
  const parsed = parseLooseJson<Record<string, unknown> | null>(text, null);
  return parseHatAiMessage(parsed, hat, fallbackKey, roundIndex);
}

export async function hatStudioDebateStart(classId: string, studentDisplayName: string) {
  return insertHatGuide(classId, studentDisplayName);
}

export async function hatStudioReset(classId: string, studentDisplayName: string, opts?: { clearDraft?: boolean }) {
  const bag = read(classId);
  bag.hat.transcript = { messages: [], roundCount: 0 };
  bag.hat.hatSession = undefined;
  if (opts?.clearDraft) bag.hat.draft = {};
  write(classId, bag);
  return insertHatGuide(classId, studentDisplayName);
}

export async function hatStudioDebateRound(
  classId: string,
  studentDisplayName: string,
  userMessage: string,
  activeHat?: string
) {
  return hatStudioDebateReply(classId, studentDisplayName, userMessage, activeHat);
}

export async function hatStudioDebateReply(
  classId: string,
  studentDisplayName: string,
  userMessage: string,
  activeHat?: string
) {
  const bag = read(classId);
  const text = String(userMessage || '').trim();
  if (!text) throw new Error('请输入发言内容');
  if (!bag.hat.transcript.messages.length) throw new Error('请先开始讨论');

  const session = coerceHatSession(bag.hat.transcript.hatSession || bag.hat.hatSession);
  const roundIndex = bag.hat.transcript.roundCount || 0;
  const out: HatStudioDebateMessage[] = [hatMessage('user', text, roundIndex)];
  const history = [...bag.hat.transcript.messages, ...out];
  const mentioned = parseMentionedHat(text);

  // @某帽：单帽回复，不推进顺序
  if (mentioned) {
    const switched = switchHatPerspective(session, mentioned);
    const nextSession = 'error' in switched ? session : switched.session;
    const reply = await generateDemoHatReply(classId, studentDisplayName, mentioned, text, history, roundIndex);
    out.push(reply);
    bag.hat.transcript.messages = [...bag.hat.transcript.messages, ...out];
    syncHatStudioSession(bag.hat, { ...nextSession, activeHat: mentioned, awaitingAnswer: false });
    write(classId, bag);
    return { message: reply, roundMessages: out, studio: bag.hat };
  }

  const onlyGuide = bag.hat.transcript.messages.every((m) => m.hat === 'user' || m.status === 'guide');
  const hasAsk = bag.hat.transcript.messages.some((m) => m.status === 'ask');

  // 首次描述创意：仅白帽发起苏格拉底三问
  if (onlyGuide || (!session.awaitingAnswer && !session.completedHats.length && !hasAsk)) {
    const ask = await generateDemoHatAsk(classId, studentDisplayName, 'white', history, roundIndex);
    out.push(ask);
    bag.hat.transcript.messages = [...bag.hat.transcript.messages, ...out];
    bag.hat.transcript.roundCount = roundIndex + 1;
    syncHatStudioSession(bag.hat, markAwaitingAnswer(defaultHatSession(), 'white'));
    write(classId, bag);
    return { message: ask, roundMessages: out, studio: bag.hat };
  }

  // 顺序轮询：未满 3 轮续问本帽，满 3 轮切下一帽
  if (session.mode === 'sequential' && !session.sequentialDone && session.awaitingAnswer) {
    const answeredHat = (session.activeHat || 'white') as Exclude<HatStudioHat, 'user'>;
    const progressed = afterHatStudentAnswer(session, answeredHat);
    const reply = await generateDemoHatReply(classId, studentDisplayName, answeredHat, text, history, roundIndex);
    if (progressed.stayOnHat) reply.status = 'ask';
    out.push(reply);

    if (progressed.stayOnHat) {
      bag.hat.transcript.messages = [...bag.hat.transcript.messages, ...out];
      syncHatStudioSession(bag.hat, markAwaitingAnswer(progressed.session, answeredHat));
      write(classId, bag);
      return { message: reply, roundMessages: out, studio: bag.hat };
    }

    if (!progressed.session.sequentialDone) {
      const nextHat = progressed.session.activeHat as Exclude<HatStudioHat, 'user'>;
      const ask = await generateDemoHatAsk(classId, studentDisplayName, nextHat, [...history, reply], roundIndex + 1);
      out.push(ask);
      bag.hat.transcript.messages = [...bag.hat.transcript.messages, ...out];
      bag.hat.transcript.roundCount = roundIndex + 1;
      syncHatStudioSession(bag.hat, markAwaitingAnswer(progressed.session, nextHat));
      write(classId, bag);
      return { message: ask, roundMessages: out, studio: bag.hat };
    }

    bag.hat.transcript.messages = [...bag.hat.transcript.messages, ...out];
    syncHatStudioSession(bag.hat, { ...progressed.session, awaitingAnswer: false });
    write(classId, bag);
    return { message: reply, roundMessages: out, studio: bag.hat };
  }

  const replyHat = (
    activeHat && ['white', 'red', 'black', 'yellow', 'green', 'blue'].includes(activeHat)
      ? activeHat
      : session.activeHat || 'white'
  ) as Exclude<HatStudioHat, 'user'>;
  const reply = await generateDemoHatReply(classId, studentDisplayName, replyHat, text, history, roundIndex);
  out.push(reply);
  bag.hat.transcript.messages = [...bag.hat.transcript.messages, ...out];
  syncHatStudioSession(bag.hat, { ...session, activeHat: replyHat, awaitingAnswer: false });
  write(classId, bag);
  return { message: reply, roundMessages: out, studio: bag.hat };
}

export async function hatStudioSwitchHat(classId: string, hat: string) {
  const bag = read(classId);
  const session = coerceHatSession(bag.hat.transcript.hatSession || bag.hat.hatSession);
  const switched = switchHatPerspective(session, hat);
  if (!('error' in switched)) {
    syncHatStudioSession(bag.hat, switched.session);
  }
  write(classId, bag);
  return { studio: bag.hat };
}

export async function saveHatStudioDraftCell(classId: string, moduleKey: string, content: string): Promise<HatStudioPayload> {
  const bag = read(classId);
  bag.hat.draft = { ...bag.hat.draft, [moduleKey]: { content, updatedBy: DEMO_STUDENT_NAME } };
  write(classId, bag);
  return bag.hat;
}

export async function adoptHatStudioMessage(classId: string, messageId: string, moduleKey: string, content?: string) {
  const bag = read(classId);
  const found = bag.hat.transcript.messages.find((item) => item.id === messageId);
  const text = content || found?.moduleContent || found?.content || '';
  if (found) {
    found.adoptedModules = Array.from(new Set([...(found.adoptedModules || []), moduleKey]));
    found.status = 'adopted';
  }
  bag.hat.draft = { ...bag.hat.draft, [moduleKey]: { content: text, updatedBy: DEMO_STUDENT_NAME } };
  write(classId, bag);
  return bag.hat;
}

function toggleLike(classId: string, ideaId: string, liked: boolean) {
  const bag = read(classId);
  const idea = bag.ideas.find((item) => item.id === ideaId);
  if (!idea) throw new Error('创意不存在');
  idea.liked = liked;
  idea.votes = Math.max(0, idea.votes + (liked ? 1 : -1));
  write(classId, bag);
  return idea;
}

export async function likeStudentIdeationIdea(classId: string, ideaId: string) {
  return toggleLike(classId, ideaId, true);
}

export async function unlikeStudentIdeationIdea(classId: string, ideaId: string) {
  return toggleLike(classId, ideaId, false);
}

export async function sendStudentIdeationDiscussion(classId: string, content: string) {
  const bag = read(classId);
  bag.discussions = [
    ...bag.discussions,
    { id: demoId(), text: content, author: DEMO_STUDENT_NAME, authorId: DEMO_STUDENT_ID, createdAt: nowIso() },
  ];
  write(classId, bag);
  return bag.discussions;
}

export async function fetchStudentIdeationTeamPrerequisites(_classId: string) {
  return { incompleteMembers: [] as { studentId: string; name: string }[] };
}

export async function fetchStudentIdeationProjectTopic(classId: string) {
  const bag = read(classId);
  return { topic: bag.topic, draft: bag.draft };
}

export async function saveStudentIdeationProjectTopicDraft(classId: string, body: IdeationProjectTopicInput) {
  const bag = read(classId);
  bag.draft = { ...body, savedAt: nowIso() };
  write(classId, bag);
  return bag.draft;
}

export async function submitStudentIdeationProjectTopic(classId: string, body: IdeationProjectTopicInput) {
  const bag = read(classId);
  const topic: IdeationProjectTopic = {
    ...body,
    id: bag.topic?.id || demoId(),
    teamId: 'demo-team',
    teamName: demoTeamName(classId),
    leaderName: DEMO_STUDENT_NAME,
    memberCount: 1,
    direction: body.projectDirection,
    description: body.projectDescription,
    submitTime: nowIso(),
    status: 'pending',
    reviewComment: '',
    reviewTime: '',
  };
  bag.topic = topic;
  bag.draft = null;
  write(classId, bag);
  return topic;
}

export async function fetchTeacherIdeationProjectTopics(classId: string) {
  const topic = read(classId).topic;
  return { topics: topic ? [topic] : [] };
}

export async function reviewTeacherIdeationProjectTopic(
  classId: string,
  topicId: string,
  body: { status: 'approved' | 'rejected'; comment: string }
) {
  const bag = read(classId);
  if (!bag.topic || bag.topic.id !== topicId) throw new Error('选题不存在');
  bag.topic = {
    ...bag.topic,
    status: body.status,
    reviewComment: body.comment,
    reviewTime: nowIso(),
  };
  write(classId, bag);
  return bag.topic;
}
