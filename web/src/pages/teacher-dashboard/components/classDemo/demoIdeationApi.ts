/**
 * 创新思维演示接口：函数名和返回形状跟学生端一致，数据只在 session。
 */
import { generateDemoAi } from './demoApi';
import { DEMO_STUDENT_ID, DEMO_STUDENT_NAME, demoId, demoTeamName, nowIso, parseLooseJson, patchFlow, readFlow } from './demoFlow';
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

const HAT_DEFS = [
  { key: 'ideaTitle', label: '创意标题' },
  { key: 'problemInsight', label: '问题洞察' },
  { key: 'userValue', label: '用户价值' },
  { key: 'solutionPoints', label: '方案要点' },
  { key: 'riskDiff', label: '风险与差异' },
];

const METHOD_LABEL: Record<string, string> = {
  midwifery: '思辨助产启思',
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
  white: '白帽（数据分析师）：只基于客观事实和数据发言。补充目标场景规模、用户行为线索、同类方案公开信息等可验证事实，不主观评价。',
  red: '红帽（用户代表）：以目标用户身份谈第一感受：会不会想用、哪里别扭、最在意什么体验。少讲大道理。',
  black: '黑帽（风险预警员）：指出关键约束与风险，并给出可写入工作区的调整建议；禁止只做否定。',
  yellow: '黄帽（乐观倡导者）：挖掘优势、痛点机会、差异亮点，并推动某一工作区字段的可落地表述。',
  green: '绿帽（创意设计师）：提出差异化创意：功能玩法、触达路径、与竞品不同点，尽量对应具体工作区字段。',
  blue: '蓝帽（项目经理）：控场与总结。引导讨论、追问关键信息，建议下一步并推动工作区补全。',
};

const HAT_STUDIO_DRAFT_KEYS = ['ideaTitle', 'problemInsight', 'userValue', 'solutionPoints', 'riskDiff'] as const;
const HAT_STUDIO_MIDDLE: Exclude<HatStudioHat, 'user' | 'white' | 'blue'>[] = ['red', 'black', 'yellow', 'green'];

function shuffleHatMiddle() {
  const arr = [...HAT_STUDIO_MIDDLE];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

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

export async function midwiferyTurn(
  classId: string,
  body: { messages: { role: 'user' | 'assistant'; content: string }[]; roundIndex: number }
) {
  const context = `当前轮次：${body.roundIndex}\n对话历史：\n${JSON.stringify(
    body.messages.length ? body.messages : [{ role: 'system', content: '（新会话，请发起第 1 轮提问）' }],
    null,
    2
  )}`;
  const raw = await generateDemoAi(classId, 'ideation-midwifery-turn', context);
  const parsed = parseJsonObject(raw);
  const parsedRound = Number(parsed?.roundIndex);
  const nextRound = Number.isFinite(parsedRound)
    ? Math.max(0, Math.floor(parsedRound))
    : body.messages.some((m) => m.role === 'user')
      ? Math.max(1, body.roundIndex + 1)
      : 0;
  // 与学生端一致：仅学生已回答第 3 轮后（请求 roundIndex>=3）才允许生成
  const canGenerate = Boolean(parsed?.canGenerate) && body.roundIndex >= 3;
  return {
    assistantText:
      String(parsed?.assistantText || '').trim() ||
      raw ||
      (nextRound === 0
        ? '你好！我是助创智能体。先用自己的话聊聊你想解决的问题或创业想法雏形，确认方向后我们再正式追问。'
        : '请继续补充你的想法。'),
    roundIndex: nextRound,
    canGenerate,
    doneHint: canGenerate ? String(parsed?.doneHint || '').trim() : '',
  };
}

export async function midwiferyGenerate(
  classId: string,
  body: { messages: { role: 'user' | 'assistant'; content: string }[] }
) {
  if (body.messages.length < 2) throw new Error('请先完成至少一轮对话再生成创意');
  const raw = await generateDemoAi(
    classId,
    'ideation-midwifery-generate',
    `请根据下列思辨助产对话提炼创业创意：\n${JSON.stringify(body.messages, null, 2)}`
  );
  const parsed = parseJsonObject(raw);
  const topic = topicFrom(parsed);
  const title = String(parsed?.title || '助产启思创意').trim().slice(0, 40) || '助产启思创意';
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

/** 开始/重置：只插引导语，不立刻调模型（与学生对齐） */
function insertHatGuide(classId: string, studentDisplayName: string) {
  const bag = read(classId);
  const name = studentDisplayName || DEMO_STUDENT_NAME;
  const guide = hatMessage(
    'blue',
    `${name}，欢迎进入六帽创想室。请先在下方用几句话描述你的创业创意：想解决什么问题、给谁用、大致怎么做。点击「发送发言」后，六顶思考帽会基于你的内容展开引导式讨论；之后也可 @白帽/@红帽/@黑帽/@黄帽/@绿帽/@蓝帽 追问某一角色。`,
    0
  );
  bag.hat.transcript = { messages: [guide], roundCount: 0 };
  write(classId, bag);
  return { roundMessages: [guide], studio: bag.hat, message: guide };
}

/** @ 某一顶帽子：按该帽人设单条回复 */
async function pushHatSingleReply(
  classId: string,
  studentDisplayName: string,
  userMessage: string,
  hat: Exclude<HatStudioHat, 'user'>
) {
  const bag = read(classId);
  const roundIndex = bag.hat.transcript.roundCount || 0;
  const messages: HatStudioDebateMessage[] = [];
  if (userMessage.trim()) messages.push(hatMessage('user', userMessage.trim(), roundIndex));
  const fallbackKey = HAT_STUDIO_DRAFT_KEYS[Math.min(roundIndex, HAT_STUDIO_DRAFT_KEYS.length - 1)];
  const prompt = [
    '【学生发言】',
    `${studentDisplayName}：${userMessage.trim()}`,
    '',
    `【你的角色】${HAT_STUDIO_ROLES[hat]}`,
    '必须严格以该角色身份回复，禁止串成其他帽子或通用助教。',
    '',
    '【辩论历史】',
    formatHatHistory(bag.hat.transcript.messages),
    '',
    '只返回 JSON：',
    `{"hat":"${hat}","content":"发言正文","targetModule":"工作区键名或 null","moduleContent":"可写入全文","fills":[{"targetModule":"工作区键名","moduleContent":"全文"}]}`,
    `targetModule 只能是：${HAT_STUDIO_DRAFT_KEYS.join(', ')} 或 null。`,
    `优先字段：${fallbackKey}。fills 至少 1 条。`,
  ].join('\n');

  const text = await generateDemoAi(classId, 'hat-studio-reply', prompt);
  const parsed = parseLooseJson<Record<string, unknown> | null>(text, null);
  messages.push(parseHatAiMessage(parsed, hat, fallbackKey, roundIndex));

  bag.hat.transcript.messages = [...bag.hat.transcript.messages, ...messages];
  write(classId, bag);
  return { roundMessages: messages, studio: bag.hat, message: messages[messages.length - 1] };
}

/** 不 @：整轮六帽，每人设各一条 */
async function pushHatFullRound(classId: string, studentDisplayName: string, userMessage: string) {
  const bag = read(classId);
  const roundIndex = bag.hat.transcript.roundCount || 0;
  const out: HatStudioDebateMessage[] = [];
  if (userMessage.trim()) out.push(hatMessage('user', userMessage.trim(), roundIndex));

  const hatOrder: Exclude<HatStudioHat, 'user'>[] = ['white', ...shuffleHatMiddle(), 'blue'];
  const orderDesc = hatOrder.map((h, i) => `${i + 1}. ${h}（${HAT_STUDIO_ROLES[h].split('：')[0]}）`).join('\n');
  const prompt = [
    `学生显示名：${studentDisplayName}`,
    `【学生本轮创意/发言】${userMessage.trim() || '（学生尚未描述创意）'}`,
    '',
    '【辩论历史】',
    formatHatHistory(bag.hat.transcript.messages),
    '',
    '【本轮要求】',
    '- 输出恰好 6 条 messages，顺序必须如下：',
    orderDesc,
    '- 每条必须符合对应帽子人设，禁止串戏；紧扣学生创意',
    '- 至少 4 条带 targetModule + moduleContent',
    `- 蓝帽末条请 @${studentDisplayName}`,
    '',
    '只返回 JSON：{"messages":[{"hat":"...","content":"...","targetModule":null,"moduleContent":""}]}',
    `targetModule 只能是：${HAT_STUDIO_DRAFT_KEYS.join(', ')} 或 null。`,
  ].join('\n');

  const text = await generateDemoAi(classId, 'hat-studio-round', prompt);
  const parsed = parseLooseJson<{ messages?: unknown[] } | null>(text, null);
  const rawList = Array.isArray(parsed?.messages) ? parsed!.messages! : [];

  hatOrder.forEach((h, index) => {
    const row = (rawList[index] && typeof rawList[index] === 'object' ? rawList[index] : null) as Record<
      string,
      unknown
    > | null;
    const fallbackKey = HAT_STUDIO_DRAFT_KEYS[index % HAT_STUDIO_DRAFT_KEYS.length];
    const msg = parseHatAiMessage(row, h, fallbackKey, roundIndex);
    msg.hat = h;
    out.push(msg);
  });

  bag.hat.transcript.messages = [...bag.hat.transcript.messages, ...out];
  bag.hat.transcript.roundCount = roundIndex + 1;
  write(classId, bag);
  return { roundMessages: out, studio: bag.hat, message: out[out.length - 1] };
}

export async function hatStudioDebateStart(classId: string, studentDisplayName: string) {
  return insertHatGuide(classId, studentDisplayName);
}

export async function hatStudioReset(classId: string, studentDisplayName: string, opts?: { clearDraft?: boolean }) {
  const bag = read(classId);
  bag.hat.transcript = { messages: [], roundCount: 0 };
  if (opts?.clearDraft) bag.hat.draft = {};
  write(classId, bag);
  return insertHatGuide(classId, studentDisplayName);
}

export async function hatStudioDebateRound(classId: string, studentDisplayName: string, userMessage: string) {
  return pushHatFullRound(classId, studentDisplayName, userMessage);
}

export async function hatStudioDebateReply(classId: string, studentDisplayName: string, userMessage: string, hat?: string) {
  const replyHat = (
    hat && ['white', 'red', 'black', 'yellow', 'green', 'blue'].includes(hat) ? hat : 'blue'
  ) as Exclude<HatStudioHat, 'user'>;
  const result = await pushHatSingleReply(classId, studentDisplayName, userMessage, replyHat);
  return { message: result.message, studio: result.studio };
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
