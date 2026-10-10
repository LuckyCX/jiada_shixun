/**
 * 创新思维演示接口：函数名和返回形状跟学生端一致，数据只在 session。
 */
import { generateDemoAi } from './demoApi';
import { DEMO_STUDENT_ID, DEMO_STUDENT_NAME, demoId, demoTeamName, nowIso, patchFlow, readFlow } from './demoFlow';
import type {
  HatStudioDebateMessage,
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
  IdeationMethodKey,
  IdeationProjectTopic,
  IdeationProjectTopicDraft,
  IdeationProjectTopicInput,
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
  brainstorm: '头脑风暴',
  scamper: 'SCAMPER',
  triz: 'TRIZ',
  ai: 'AI 创意',
  six_hats: '六顶思考帽',
};

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

function hatMessage(hat: HatStudioDebateMessage['hat'], content: string, roundIndex: number): HatStudioDebateMessage {
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

function payloadText(payload: Record<string, unknown>) {
  return Object.values(payload)
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)
    .join('\n');
}

export async function fetchStudentIdeationWorkspace(classId: string): Promise<StudentIdeationWorkspace> {
  return workspaceOf(classId, read(classId));
}

export async function analyzeStudentIdeationIdea(
  classId: string,
  body: { methodKey: IdeationMethodKey; formPayload: Record<string, unknown> }
): Promise<StudentIdeationIdea> {
  const text = await generateDemoAi(classId, 'ideation', payloadText(body.formPayload) || '请给出一条课堂创意');
  const title = String(body.formPayload.title || body.formPayload.ideaTitle || text.split('\n')[0] || '课堂创意').slice(0, 40);
  const idea: StudentIdeationIdea = {
    id: demoId(),
    methodKey: body.methodKey,
    method: METHOD_LABEL[body.methodKey] || body.methodKey,
    title,
    description: text,
    formPayload: body.formPayload,
    author: DEMO_STUDENT_NAME,
    authorId: DEMO_STUDENT_ID,
    votes: 0,
    liked: false,
    novelty: 80,
    feasibility: 75,
    aiAnalysis: {
      overallScore: 80,
      novelty: 80,
      feasibility: 75,
      marketPotential: 78,
      innovation: 76,
      summary: text.slice(0, 500),
      strengths: ['适合课堂讲解'],
      weaknesses: [],
      suggestions: [],
      tags: ['演示'],
    },
    createdAt: nowIso(),
  };
  const bag = read(classId);
  bag.ideas = [idea, ...bag.ideas];
  write(classId, bag);
  return idea;
}

export async function fetchHatStudio(classId: string): Promise<HatStudioPayload> {
  return read(classId).hat;
}

async function pushHatRound(classId: string, studentDisplayName: string, userMessage: string, hat?: HatStudioDebateMessage['hat']) {
  const bag = read(classId);
  const roundIndex = (bag.hat.transcript.roundCount || 0) + 1;
  const messages: HatStudioDebateMessage[] = [];
  if (userMessage.trim()) messages.push(hatMessage('user', userMessage.trim(), roundIndex));
  const text = await generateDemoAi(
    classId,
    'ideation',
    `${studentDisplayName} 正在做六顶思考帽讨论。${userMessage || '请用蓝帽主持开场，提出一个可讨论的创业问题。'}`
  );
  messages.push(hatMessage(hat && hat !== 'user' ? hat : 'blue', text, roundIndex));
  bag.hat.transcript.messages = [...bag.hat.transcript.messages, ...messages];
  bag.hat.transcript.roundCount = roundIndex;
  write(classId, bag);
  return { roundMessages: messages, studio: bag.hat, message: messages[messages.length - 1] };
}

export async function hatStudioDebateStart(classId: string, studentDisplayName: string) {
  return pushHatRound(classId, studentDisplayName, '');
}

export async function hatStudioReset(classId: string, studentDisplayName: string, opts?: { clearDraft?: boolean }) {
  const bag = read(classId);
  bag.hat.transcript = { messages: [], roundCount: 0 };
  if (opts?.clearDraft) bag.hat.draft = {};
  write(classId, bag);
  return pushHatRound(classId, studentDisplayName, '');
}

export async function hatStudioDebateRound(classId: string, studentDisplayName: string, userMessage: string) {
  return pushHatRound(classId, studentDisplayName, userMessage);
}

export async function hatStudioDebateReply(classId: string, studentDisplayName: string, userMessage: string, hat?: string) {
  const result = await pushHatRound(classId, studentDisplayName, userMessage, (hat as HatStudioDebateMessage['hat']) || 'blue');
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
