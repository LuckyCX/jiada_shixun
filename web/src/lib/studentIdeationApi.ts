import { portalAuthenticatedFetch } from './authApi';

/** 当前入口方法；scamper/triz 仅兼容历史创意库只读展示 */
export type IdeationMethodKey = 'midwifery' | 'brainstorm' | 'ai' | 'six_hats' | 'scamper' | 'triz';

export type IdeationChatMethodKey = 'midwifery' | 'brainstorm' | 'ai' | 'six_hats';

export type HatStudioHat = 'white' | 'red' | 'black' | 'yellow' | 'green' | 'blue' | 'user';

export type HatStudioDraftKey =
  | 'ideaTitle'
  | 'problemInsight'
  | 'userValue'
  | 'solutionPoints'
  | 'riskDiff';

export type HatStudioCell = { content: string; updatedBy: string };

export type HatStudioFill = { targetModule: HatStudioDraftKey | string; moduleContent: string };

export type HatStudioDebateMessage = {
  id: string;
  hat: HatStudioHat;
  content: string;
  targetModule: string | null;
  moduleContent: string;
  fills?: HatStudioFill[];
  adoptedModules?: string[];
  status?: 'adopted' | 'ignored' | 'guide' | 'ask';
  roundIndex: number;
  createdAt: string;
};

export type HatStudioDraft = Record<string, HatStudioCell>;

export type HatSessionState = {
  mode: 'sequential' | 'free';
  hatOrder: Exclude<HatStudioHat, 'user'>[];
  completedHats: Exclude<HatStudioHat, 'user'>[];
  activeHat: Exclude<HatStudioHat, 'user'>;
  resumeHat: Exclude<HatStudioHat, 'user'> | null;
  sequentialDone: boolean;
  awaitingAnswer: boolean;
  /** 当前帽已完成对话轮次（学生作答次数），满 3 轮后切下一帽 */
  hatDialogueRound?: number;
};

export type HatStudioPayload = {
  draft: HatStudioDraft;
  draftDefs: { key: string; label: string }[];
  transcript: { messages: HatStudioDebateMessage[]; roundCount: number; hatSession?: HatSessionState };
  hatSession?: HatSessionState;
  filledCount: number;
};

export function parseHatStudioMentionedHat(text: string): Exclude<HatStudioHat, 'user'> | null {
  const t = String(text || '');
  const patterns: { re: RegExp; hat: Exclude<HatStudioHat, 'user'> }[] = [
    { re: /@\s*白帽|@white/i, hat: 'white' },
    { re: /@\s*红帽|@red/i, hat: 'red' },
    { re: /@\s*黑帽|@black/i, hat: 'black' },
    { re: /@\s*黄帽|@yellow/i, hat: 'yellow' },
    { re: /@\s*绿帽|@green/i, hat: 'green' },
    { re: /@\s*蓝帽|@blue/i, hat: 'blue' },
  ];
  for (const p of patterns) {
    if (p.re.test(t)) return p.hat;
  }
  return null;
}

export type StudentIdeationAnalysis = {
  overallScore: number;
  novelty: number;
  feasibility: number;
  marketPotential: number;
  innovation: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  tags: string[];
};

export type StudentIdeationIdea = {
  id: string;
  methodKey: IdeationMethodKey;
  method: string;
  title: string;
  description: string;
  formPayload: Record<string, unknown>;
  author: string;
  authorId: string;
  votes: number;
  liked: boolean;
  novelty: number;
  feasibility: number;
  aiAnalysis: StudentIdeationAnalysis;
  createdAt: string;
};

export type StudentIdeationDiscussion = {
  id: string;
  text: string;
  author: string;
  authorId: string;
  createdAt: string;
};

export type StudentIdeationWorkspace = {
  team: { id: string; name: string } | null;
  ideas: StudentIdeationIdea[];
  discussions: StudentIdeationDiscussion[];
};

export type StudentIdeationPrerequisiteMember = {
  studentId: string;
  name: string;
};

export type IdeationProjectTopicStatus = 'pending' | 'approved' | 'rejected';

export type IdeationProjectTopicInput = {
  projectName: string;
  projectDirection: string;
  projectDescription: string;
  coreValue: string;
  targetUsers: string;
  coreProblem: string;
  solutionOverview: string;
  marketSize: string;
  competitiveAdvantage: string;
};

export type IdeationProjectTopic = IdeationProjectTopicInput & {
  id: string;
  teamId: string;
  teamName: string;
  leaderName: string;
  memberCount: number;
  direction: string;
  description: string;
  submitTime: string;
  status: IdeationProjectTopicStatus;
  reviewComment: string;
  reviewTime: string;
};

export type IdeationProjectTopicDraft = IdeationProjectTopicInput & {
  savedAt: string;
};

/** 对话生成后的预览创意（未入库） */
export type IdeationIdeaPreview = {
  methodKey: IdeationMethodKey;
  method: string;
  title: string;
  description: string;
  formPayload: Record<string, unknown>;
  aiAnalysis: StudentIdeationAnalysis;
  topicFields?: Partial<IdeationProjectTopicInput>;
};

export async function fetchStudentIdeationWorkspace(classId: string): Promise<StudentIdeationWorkspace> {
  return portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/ideation/workspace`
  ) as Promise<StudentIdeationWorkspace>;
}

export async function analyzeStudentIdeationIdea(
  classId: string,
  body: { methodKey: IdeationMethodKey; formPayload: Record<string, unknown>; previewOnly?: boolean }
): Promise<StudentIdeationIdea> {
  return portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/ideation/ideas/analyze`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  ) as Promise<StudentIdeationIdea>;
}

/** 对话生成创意预览（不入库） */
export async function previewStudentIdeationIdea(
  classId: string,
  body: {
    methodKey: IdeationMethodKey;
    formPayload: Record<string, unknown>;
    threadId?: string;
  }
): Promise<IdeationIdeaPreview> {
  return portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/ideation/ideas/analyze`,
    {
      method: 'POST',
      body: JSON.stringify({ ...body, previewOnly: true }),
    }
  ) as Promise<IdeationIdeaPreview>;
}

/** 将预览创意写入团队创意库 */
export async function commitStudentIdeationIdea(
  classId: string,
  body: {
    methodKey: IdeationMethodKey;
    title: string;
    description: string;
    formPayload: Record<string, unknown>;
    aiAnalysis: StudentIdeationAnalysis;
  }
): Promise<StudentIdeationIdea> {
  return portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/ideation/ideas`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  ) as Promise<StudentIdeationIdea>;
}

export type MidwiferyTurnResult = {
  assistantText: string;
  roundIndex: number;
  canGenerate: boolean;
  doneHint: string;
};

export async function midwiferyTurn(
  classId: string,
  body: {
    messages: { role: 'user' | 'assistant'; content: string }[];
    roundIndex: number;
    threadId?: string;
  }
): Promise<MidwiferyTurnResult> {
  return portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/ideation/methods/midwifery/turn`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  ) as Promise<MidwiferyTurnResult>;
}

export async function midwiferyGenerate(
  classId: string,
  body: { messages: { role: 'user' | 'assistant'; content: string }[] }
): Promise<IdeationIdeaPreview> {
  return portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/ideation/methods/midwifery/generate`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  ) as Promise<IdeationIdeaPreview>;
}

function hatStudioBase(classId: string) {
  return `/api/student/personal-classes/${encodeURIComponent(classId)}/ideation/hat-studio`;
}

export async function fetchHatStudio(classId: string): Promise<HatStudioPayload> {
  return portalAuthenticatedFetch('student', hatStudioBase(classId)) as Promise<HatStudioPayload>;
}

export async function hatStudioDebateStart(
  classId: string,
  studentDisplayName: string
): Promise<{ roundMessages: HatStudioDebateMessage[]; studio: HatStudioPayload }> {
  return portalAuthenticatedFetch('student', `${hatStudioBase(classId)}/debate/start`, {
    method: 'POST',
    body: JSON.stringify({ studentDisplayName }),
  }) as Promise<{ roundMessages: HatStudioDebateMessage[]; studio: HatStudioPayload }>;
}

/** 清空本轮讨论并重新引导开场；opts.clearDraft=true 时同时清空右侧创意工作区 */
export async function hatStudioReset(
  classId: string,
  studentDisplayName: string,
  opts?: { clearDraft?: boolean }
): Promise<{ roundMessages: HatStudioDebateMessage[]; studio: HatStudioPayload }> {
  return portalAuthenticatedFetch('student', `${hatStudioBase(classId)}/reset`, {
    method: 'POST',
    body: JSON.stringify({
      studentDisplayName,
      clearDraft: Boolean(opts?.clearDraft),
    }),
  }) as Promise<{ roundMessages: HatStudioDebateMessage[]; studio: HatStudioPayload }>;
}

export async function hatStudioDebateRound(
  classId: string,
  studentDisplayName: string,
  userMessage: string,
  activeHat?: string
): Promise<{ roundMessages: HatStudioDebateMessage[]; studio: HatStudioPayload }> {
  return portalAuthenticatedFetch('student', `${hatStudioBase(classId)}/debate/round`, {
    method: 'POST',
    body: JSON.stringify({ studentDisplayName, userMessage, activeHat }),
  }) as Promise<{ roundMessages: HatStudioDebateMessage[]; studio: HatStudioPayload }>;
}

export async function hatStudioDebateReply(
  classId: string,
  studentDisplayName: string,
  userMessage: string,
  activeHat?: string
): Promise<{
  message?: HatStudioDebateMessage;
  roundMessages?: HatStudioDebateMessage[];
  studio: HatStudioPayload;
}> {
  return portalAuthenticatedFetch('student', `${hatStudioBase(classId)}/debate/reply`, {
    method: 'POST',
    body: JSON.stringify({ studentDisplayName, userMessage, activeHat, hat: activeHat }),
  }) as Promise<{
    message?: HatStudioDebateMessage;
    roundMessages?: HatStudioDebateMessage[];
    studio: HatStudioPayload;
  }>;
}

export async function hatStudioSwitchHat(
  classId: string,
  hat: string
): Promise<{ studio: HatStudioPayload }> {
  return portalAuthenticatedFetch('student', `${hatStudioBase(classId)}/debate/switch-hat`, {
    method: 'POST',
    body: JSON.stringify({ hat }),
  }) as Promise<{ studio: HatStudioPayload }>;
}

export async function saveHatStudioDraftCell(
  classId: string,
  moduleKey: string,
  content: string
): Promise<HatStudioPayload> {
  return portalAuthenticatedFetch('student', `${hatStudioBase(classId)}/draft`, {
    method: 'PUT',
    body: JSON.stringify({ moduleKey, content }),
  }) as Promise<HatStudioPayload>;
}

export async function adoptHatStudioMessage(
  classId: string,
  messageId: string,
  moduleKey: string,
  content?: string
): Promise<HatStudioPayload> {
  return portalAuthenticatedFetch(
    'student',
    `${hatStudioBase(classId)}/messages/${encodeURIComponent(messageId)}/adopt`,
    {
      method: 'POST',
      body: JSON.stringify({ moduleKey, ...(content ? { content } : {}) }),
    }
  ) as Promise<HatStudioPayload>;
}

export async function likeStudentIdeationIdea(classId: string, ideaId: string): Promise<StudentIdeationIdea> {
  return portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/ideation/ideas/${encodeURIComponent(ideaId)}/like`,
    { method: 'POST' }
  ) as Promise<StudentIdeationIdea>;
}

export async function unlikeStudentIdeationIdea(classId: string, ideaId: string): Promise<StudentIdeationIdea> {
  return portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/ideation/ideas/${encodeURIComponent(ideaId)}/like`,
    { method: 'DELETE' }
  ) as Promise<StudentIdeationIdea>;
}

export async function sendStudentIdeationDiscussion(
  classId: string,
  content: string
): Promise<StudentIdeationDiscussion[]> {
  return portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/ideation/discussions`,
    {
      method: 'POST',
      body: JSON.stringify({ content }),
    }
  ) as Promise<StudentIdeationDiscussion[]>;
}

export async function fetchStudentIdeationTeamPrerequisites(classId: string): Promise<{
  incompleteMembers: StudentIdeationPrerequisiteMember[];
}> {
  return portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/ideation/team-prerequisites`
  ) as Promise<{ incompleteMembers: StudentIdeationPrerequisiteMember[] }>;
}

export async function fetchStudentIdeationProjectTopic(classId: string): Promise<{
  topic: IdeationProjectTopic | null;
  draft: IdeationProjectTopicDraft | null;
}> {
  return portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/ideation/topic`
  ) as Promise<{ topic: IdeationProjectTopic | null; draft: IdeationProjectTopicDraft | null }>;
}

export async function saveStudentIdeationProjectTopicDraft(
  classId: string,
  body: IdeationProjectTopicInput
): Promise<IdeationProjectTopicDraft> {
  const res = await portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/ideation/topic-draft`,
    {
      method: 'PUT',
      body: JSON.stringify(body),
    }
  ) as { draft: IdeationProjectTopicDraft };
  return res.draft;
}

export async function submitStudentIdeationProjectTopic(
  classId: string,
  body: IdeationProjectTopicInput
): Promise<IdeationProjectTopic> {
  const res = await portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/ideation/topic`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  ) as { topic: IdeationProjectTopic };
  return res.topic;
}

export async function fetchTeacherIdeationProjectTopics(classId: string): Promise<{
  topics: IdeationProjectTopic[];
}> {
  return portalAuthenticatedFetch(
    'teacher',
    `/api/teacher/personal-classes/${encodeURIComponent(classId)}/ideation/topics`
  ) as Promise<{ topics: IdeationProjectTopic[] }>;
}

export async function reviewTeacherIdeationProjectTopic(
  classId: string,
  topicId: string,
  body: { status: 'approved' | 'rejected'; comment: string }
): Promise<IdeationProjectTopic> {
  const res = await portalAuthenticatedFetch(
    'teacher',
    `/api/teacher/personal-classes/${encodeURIComponent(classId)}/ideation/topics/${encodeURIComponent(topicId)}/review`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  ) as { topic: IdeationProjectTopic };
  return res.topic;
}
