import { getPortalToken, portalAuthenticatedFetch } from './authApi';

/** 调研计划中可选的「调研数据上传」类方法（不含线上问卷） */
export const MARKET_UPLOAD_METHODS = [
  '用户访谈',
  '竞品分析',
  '行业报告',
  '数据爬取',
  '实地观察',
] as const;

export const MARKET_RESEARCH_METHODS = [...MARKET_UPLOAD_METHODS] as const;

export function filterPlanUploadMethods(methods: string[]): string[] {
  return methods.filter(
    (m) => m !== '线上问卷' && (MARKET_UPLOAD_METHODS as readonly string[]).includes(m)
  );
}

export const MARKET_PRESET_ROLES = [
  '问卷设计',
  '数据收集',
  '数据整理与上传',
  '报告撰写',
] as const;

export const SURVEY_QUESTION_TYPES = ['单选', '多选', '评分', '填空'] as const;

export type MarketResearchMethod = (typeof MARKET_RESEARCH_METHODS)[number];

export type SurveyQuestionType = (typeof SURVEY_QUESTION_TYPES)[number];

export type MarketPlanAssignment = {
  role: string;
  memberIds: string[];
};

export type MarketResearchPlan = {
  goal: string;
  methods: string[];
  startDate: string;
  endDate: string;
  assignments: MarketPlanAssignment[];
  savedAt?: string;
};

export type MarketTeamMember = {
  id: string;
  name: string;
};

export type MarketStagePeriod = {
  startDate: string;
  deadlineDate: string;
} | null;

export type MarketPlanResponse = {
  plan: MarketResearchPlan | null;
  isTeamLeader: boolean;
  teamMembers: MarketTeamMember[];
  stagePeriod: MarketStagePeriod;
};

export type MethodUploadItem = {
  id: string;
  originalFilename: string;
  fileSize: number;
  createdAt: string;
  uploaderName: string;
  uploadedBy: string;
};

export type MarketSurveyQuestion = {
  id: string;
  text: string;
  type: SurveyQuestionType;
  options?: string[];
};

export type MarketSurveyStatus = '草稿' | '进行中' | '已撤回';

export type MarketSurvey = {
  id: string;
  title: string;
  status: MarketSurveyStatus;
  questions: MarketSurveyQuestion[];
  collected: number;
  link: string;
  publicSlug?: string;
  fromPlan?: boolean;
  createdAt: string;
  publishedAt?: string | null;
  publishedAtDisplay?: string;
  closesAt?: string | null;
  closesAtDisplay?: string;
};

export type SurveyPromptEcho = {
  system: string;
  user: string;
};

export function buildPublicSurveyUrl(slug: string, publicBaseUrl?: string): string {
  const basePath = (typeof __BASE_PATH__ !== 'undefined' ? __BASE_PATH__ : '/').replace(/\/$/, '') || '';
  const path = `${basePath}/s/${encodeURIComponent(slug)}`.replace(/\/{2,}/g, '/');
  const configured = String(publicBaseUrl || '').trim().replace(/\/$/, '');
  const origin =
    configured ||
    (typeof window !== 'undefined' ? window.location.origin.replace(/\/$/, '') : '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${origin}${suffix}`;
}

export async function fetchMarketResearchPlan(classId: string): Promise<MarketPlanResponse> {
  return portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/market-research/plan`
  ) as Promise<MarketPlanResponse>;
}

export async function saveMarketResearchPlan(
  classId: string,
  plan: MarketResearchPlan
): Promise<MarketPlanResponse> {
  return portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/market-research/plan`,
    {
      method: 'PUT',
      body: JSON.stringify({
        goal: plan.goal,
        methods: plan.methods,
        startDate: plan.startDate,
        endDate: plan.endDate,
        assignments: plan.assignments,
      }),
    }
  ) as Promise<MarketPlanResponse>;
}

export async function listMarketSurveys(classId: string): Promise<MarketSurvey[]> {
  const data = await portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/market-research/surveys`
  );
  return Array.isArray(data) ? (data as MarketSurvey[]) : [];
}

export async function createMarketSurvey(
  classId: string,
  payload: {
    title: string;
    questions: Omit<MarketSurveyQuestion, 'id'>[];
    source?: 'manual' | 'ai';
    closesAt: string;
  }
): Promise<MarketSurvey> {
  return portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/market-research/surveys`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  ) as Promise<MarketSurvey>;
}

export async function updateMarketSurvey(
  classId: string,
  surveyId: string,
  payload: { title: string; questions: Omit<MarketSurveyQuestion, 'id'>[]; closesAt: string }
): Promise<MarketSurvey> {
  return portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/market-research/surveys/${encodeURIComponent(surveyId)}`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    }
  ) as Promise<MarketSurvey>;
}

export async function deleteMarketSurvey(classId: string, surveyId: string): Promise<void> {
  await portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/market-research/surveys/${encodeURIComponent(surveyId)}`,
    { method: 'DELETE' }
  );
}

export async function publishMarketSurvey(classId: string, surveyId: string): Promise<MarketSurvey> {
  return portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/market-research/surveys/${encodeURIComponent(surveyId)}/publish`,
    { method: 'POST' }
  ) as Promise<MarketSurvey>;
}

export async function withdrawMarketSurvey(classId: string, surveyId: string): Promise<MarketSurvey> {
  return portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/market-research/surveys/${encodeURIComponent(surveyId)}/withdraw`,
    { method: 'POST' }
  ) as Promise<MarketSurvey>;
}

export async function generateMarketSurveyByAi(
  classId: string,
  payload: { questionCount: number; includeTypes: SurveyQuestionType[] }
): Promise<{
  title: string;
  questions: MarketSurveyQuestion[];
  promptEcho: SurveyPromptEcho;
}> {
  return portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/market-research/surveys/ai-generate`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  ) as Promise<{
    title: string;
    questions: MarketSurveyQuestion[];
    promptEcho: SurveyPromptEcho;
  }>;
}

export async function listMarketMethodUploads(
  classId: string,
  method: string
): Promise<MethodUploadItem[]> {
  const data = await portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/market-research/uploads?method=${encodeURIComponent(method)}`
  );
  return Array.isArray(data) ? data : [];
}

export async function uploadMarketMethodFile(
  classId: string,
  method: string,
  file: File
): Promise<{ id: string }> {
  const fd = new FormData();
  fd.append('method', method);
  fd.append('file', file);
  const token = getPortalToken('student') || '';
  const r = await fetch(
    `/api/student/personal-classes/${encodeURIComponent(classId)}/market-research/uploads`,
    {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    }
  );
  const j = await r.json().catch(() => ({ code: -1, message: '无效 JSON' }));
  if (!r.ok || j.code !== 0) {
    throw new Error(typeof j.message === 'string' ? j.message : `HTTP ${r.status}`);
  }
  return j.data as { id: string };
}

export async function downloadMarketMethodFile(
  classId: string,
  uploadId: string,
  filename: string
): Promise<void> {
  const token = getPortalToken('student') || '';
  const r = await fetch(
    `/api/student/personal-classes/${encodeURIComponent(classId)}/market-research/uploads/${encodeURIComponent(uploadId)}/file`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }
  );
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(typeof j.message === 'string' ? j.message : `下载失败 HTTP ${r.status}`);
  }
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function deleteMarketMethodUpload(classId: string, uploadId: string): Promise<void> {
  await portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/market-research/uploads/${encodeURIComponent(uploadId)}`,
    { method: 'DELETE' }
  );
}

export const METHOD_FORMAT_GUIDES: Record<string, { title: string; bullets: string[]; exampleName: string }> = {
  用户访谈: {
    title: '用户访谈数据格式要求',
    bullets: [
      '每条记录包含：受访者编号、访谈时间、访谈场景、核心引语、痛点与需求归纳',
      '同一主题请合并归类，便于后续分析',
      '请勿上传音视频，仅提交整理后的文本或 Word 文档',
    ],
    exampleName: '用户访谈记录_小组名.docx',
  },
  竞品分析: {
    title: '竞品分析数据格式要求',
    bullets: [
      '列出 3–5 个竞品，包含：名称、目标用户、核心功能、定价、优势、不足',
      '建议采用表格或分节结构，数据需标注来源或观察依据',
    ],
    exampleName: '竞品分析表_小组名.docx',
  },
  行业报告: {
    title: '行业报告数据格式要求',
    bullets: [
      '摘录权威报告或公开资料中的市场规模、趋势、政策要点',
      '每条注明出处（报告名称、发布机构、年份）',
      '仅整理与项目相关的数据，避免大段原文粘贴',
    ],
    exampleName: '行业数据摘录_小组名.docx',
  },
  数据爬取: {
    title: '公开数据整理格式要求',
    bullets: [
      '整理来自公开渠道的数据（统计公报、平台公开数据等），注明获取时间与链接',
      '字段清晰：指标名称、数值、单位、时间范围',
      '本环节为人工整理上传，不进行自动爬取',
    ],
    exampleName: '公开数据整理_小组名.txt',
  },
  实地观察: {
    title: '实地观察数据格式要求',
    bullets: [
      '记录观察时间、地点、观察对象、现象描述、发现的问题与机会',
      '可按场次编号，客观描述为主，结论单独归纳',
    ],
    exampleName: '实地观察记录_小组名.docx',
  },
};

export async function fetchPublicMarketSurvey(slug: string): Promise<{
  title: string;
  status: 'published' | 'withdrawn' | 'expired';
  questions: MarketSurveyQuestion[];
}> {
  const r = await fetch(`/api/public/market-surveys/${encodeURIComponent(slug)}`);
  const j = await r.json().catch(() => ({ code: -1 }));
  if (!r.ok || j.code !== 0) {
    throw new Error(typeof j.message === 'string' ? j.message : '加载失败');
  }
  return j.data;
}

export async function submitPublicMarketSurvey(
  slug: string,
  answers: Record<string, string | number | string[]>
): Promise<void> {
  const r = await fetch(`/api/public/market-surveys/${encodeURIComponent(slug)}/responses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers }),
  });
  const j = await r.json().catch(() => ({ code: -1 }));
  if (!r.ok || j.code !== 0) {
    throw new Error(typeof j.message === 'string' ? j.message : '提交失败');
  }
}

export type SurveyResponseItem = {
  id: string;
  respondentToken: string;
  submittedAt: string;
  answers: Record<string, string | number | string[]>;
};

export type SurveyResponsesPayload = {
  surveyTitle: string;
  questions: MarketSurveyQuestion[];
  responses: SurveyResponseItem[];
};

export async function fetchMarketSurveyResponses(
  classId: string,
  surveyId: string
): Promise<SurveyResponsesPayload> {
  return portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/market-research/surveys/${encodeURIComponent(surveyId)}/responses`
  ) as Promise<SurveyResponsesPayload>;
}

export async function deleteMarketSurveyResponse(
  classId: string,
  surveyId: string,
  responseId: string
): Promise<{ collected: number }> {
  return portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/market-research/surveys/${encodeURIComponent(surveyId)}/responses/${encodeURIComponent(responseId)}`,
    { method: 'DELETE' }
  ) as Promise<{ collected: number }>;
}

export type ChartItem = { label: string; value: number };

export type MarketAnalysisResult = {
  score: number;
  conclusions: string[];
  opportunities: string[];
  risks: string[];
  suggestions: string[];
  stats: {
    totalCollected: number;
    validSamples: number | null;
    activeSurveyCount: number;
  };
  charts: {
    ageDistribution: ChartItem[];
    spendingDistribution: ChartItem[];
    satisfactionDistribution: ChartItem[];
    improvementRanking: ChartItem[];
  };
  keyFindings: { title: string; desc: string }[];
};

export type MarketPersona = {
  id: string;
  name: string;
  age: number;
  occupation: string;
  major: string;
  painPoints: string[];
  needs: string[];
  habits: string[];
  borderColor: string;
  accentColor: string;
  fromSurvey?: boolean;
  source?: string;
};

export type ChallengeFinalReport = {
  totalScore: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
};

export type ChallengeSessionRecord = {
  id: string;
  studentId: string;
  studentName: string;
  createdAt: string;
  completedAt: string;
  finalReport: ChallengeFinalReport | null;
};

export type MyLatestChallengeSession = {
  id: string;
  status: 'in_progress' | 'completed' | string;
  projectInfo: Record<string, unknown>;
  selectedAgents: string[];
  rounds: Array<{
    agentId?: string;
    agentName?: string;
    agentRole?: string;
    question?: string;
    briefFeedback?: string;
    answer?: string;
  }>;
  finalReport: ChallengeFinalReport | null;
  createdAt: string;
  completedAt: string;
};

export async function fetchMyLatestChallengeSession(
  classId: string
): Promise<MyLatestChallengeSession | null> {
  const data = await portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/market-research/challenge/sessions/me/latest`
  );
  const session = (data as { session?: MyLatestChallengeSession | null })?.session;
  return session ?? null;
}

export function totalChallengeRounds(agentCount: number): number {
  if (agentCount <= 0) return 0;
  if (agentCount === 1) return 5;
  return agentCount * 2;
}

export async function fetchMarketAnalysis(classId: string): Promise<{
  result: MarketAnalysisResult | null;
  generatedAt: string;
}> {
  return portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/market-research/analysis`
  ) as Promise<{ result: MarketAnalysisResult | null; generatedAt: string }>;
}

export async function listMarketPersonas(classId: string): Promise<MarketPersona[]> {
  const data = await portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/market-research/personas`
  );
  return Array.isArray(data) ? (data as MarketPersona[]) : [];
}

export async function createMarketPersona(
  classId: string,
  payload: Omit<MarketPersona, 'id' | 'source'>
): Promise<MarketPersona> {
  return portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/market-research/personas`,
    { method: 'POST', body: JSON.stringify(payload) }
  ) as Promise<MarketPersona>;
}

export async function updateMarketPersona(
  classId: string,
  personaId: string,
  payload: Partial<MarketPersona>
): Promise<MarketPersona> {
  return portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/market-research/personas/${encodeURIComponent(personaId)}`,
    { method: 'PUT', body: JSON.stringify(payload) }
  ) as Promise<MarketPersona>;
}

export async function deleteMarketPersona(classId: string, personaId: string): Promise<void> {
  await portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/market-research/personas/${encodeURIComponent(personaId)}`,
    { method: 'DELETE' }
  );
}

export async function listChallengeSessions(classId: string): Promise<ChallengeSessionRecord[]> {
  const data = await portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/market-research/challenge/sessions`
  );
  return Array.isArray(data) ? (data as ChallengeSessionRecord[]) : [];
}

export async function createChallengeSession(
  classId: string,
  payload: { projectInfo: Record<string, unknown>; selectedAgents: string[] }
): Promise<{ sessionId: string; totalRounds: number; createdAt: string }> {
  return portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/market-research/challenge/sessions`,
    { method: 'POST', body: JSON.stringify(payload) }
  ) as Promise<{ sessionId: string; totalRounds: number; createdAt: string }>;
}

type StreamHandlers = {
  onStatus?: (message: string) => void;
  onThinking?: (text: string) => void;
  onContent?: (text: string) => void;
  onError?: (message: string) => void;
};

async function readMarketResearchSse(
  path: string,
  body: Record<string, unknown> | undefined,
  handlers: StreamHandlers & { onDone?: (data: Record<string, unknown>) => void }
) {
  const { getPortalToken, redirectStudentSessionExpired } = await import('./authApi');
  const token = getPortalToken('student') || '';
  const r = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 401) {
    redirectStudentSessionExpired();
    throw new Error('登录已失效');
  }
  if (!r.ok) {
    const j = await r.json().catch(() => ({ message: '' }));
    throw new Error((j as { message?: string }).message || `HTTP ${r.status}`);
  }
  const reader = r.body?.getReader();
  if (!reader) throw new Error('无法读取响应流');
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = 'message';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (line.startsWith('event:')) {
        currentEvent = line.slice(6).trim();
        continue;
      }
      if (!line.startsWith('data:')) continue;
      const raw = line.slice(5).trim();
      if (!raw) continue;
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        continue;
      }
      if (currentEvent === 'status' && typeof data.message === 'string') {
        handlers.onStatus?.(data.message);
      } else if (currentEvent === 'thinking' && typeof data.text === 'string') {
        handlers.onThinking?.(data.text);
      } else if (currentEvent === 'content' && typeof data.text === 'string') {
        handlers.onContent?.(data.text);
      } else if (currentEvent === 'done') {
        handlers.onDone?.(data);
      } else if (currentEvent === 'error') {
        const msg = typeof data.message === 'string' ? data.message : '请求失败';
        handlers.onError?.(msg);
        throw new Error(msg);
      }
    }
  }
}

export async function streamMarketAnalysis(
  classId: string,
  surveyIds: string[],
  handlers: StreamHandlers & { onDone?: (result: MarketAnalysisResult) => void }
) {
  await readMarketResearchSse(
    `/api/student/personal-classes/${encodeURIComponent(classId)}/market-research/analysis/stream`,
    { surveyIds },
    {
      ...handlers,
      onDone: (data) => {
        if (data.result) handlers.onDone?.(data.result as MarketAnalysisResult);
      },
    }
  );
}

export async function streamGeneratePersonas(
  classId: string,
  surveyIds: string[],
  handlers: StreamHandlers & { onDone?: (personas: MarketPersona[]) => void }
) {
  await readMarketResearchSse(
    `/api/student/personal-classes/${encodeURIComponent(classId)}/market-research/personas/ai-generate/stream`,
    { surveyIds },
    {
      ...handlers,
      onDone: (data) => {
        const list = data.personas;
        handlers.onDone?.(Array.isArray(list) ? (list as MarketPersona[]) : []);
      },
    }
  );
}

export async function streamChallengeRound(
  classId: string,
  sessionId: string,
  payload: { roundIndex: number; answer?: string; agentId?: string },
  handlers: StreamHandlers & {
    onDone?: (data: {
      question: string;
      agentName: string;
      agentRole: string;
      briefFeedback?: string;
      roundIndex: number;
    }) => void;
  }
) {
  await readMarketResearchSse(
    `/api/student/personal-classes/${encodeURIComponent(classId)}/market-research/challenge/sessions/${encodeURIComponent(sessionId)}/round/stream`,
    payload,
    {
      ...handlers,
      onDone: (data) => {
        handlers.onDone?.(data as {
          question: string;
          agentName: string;
          agentRole: string;
          briefFeedback?: string;
          roundIndex: number;
        });
      },
    }
  );
}

export async function streamChallengeFinalReport(
  classId: string,
  sessionId: string,
  answer: string,
  handlers: StreamHandlers & { onDone?: (report: ChallengeFinalReport) => void }
) {
  await readMarketResearchSse(
    `/api/student/personal-classes/${encodeURIComponent(classId)}/market-research/challenge/sessions/${encodeURIComponent(sessionId)}/final-report/stream`,
    { answer },
    {
      ...handlers,
      onDone: (data) => {
        if (data.report) handlers.onDone?.(data.report as ChallengeFinalReport);
      },
    }
  );
}

export type TeamMarketReportUploadStatus = {
  uploaded: boolean;
  uploadedAt: string;
  uploadedBy: string;
  payload: {
    surveyIds: string[];
    personaIds: string[];
    analysisResult: MarketAnalysisResult;
    analysisGeneratedAt?: string;
  } | null;
};

export async function fetchTeamMarketReportUploadStatus(
  classId: string
): Promise<TeamMarketReportUploadStatus> {
  return portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/market-research/report-upload`
  ) as Promise<TeamMarketReportUploadStatus>;
}

export type UploadTeamMarketReportError = Error & {
  missingMembers?: { id: string; name: string }[];
};

export type TeamChallengeParticipation = {
  members: { id: string; name: string; hasChallengeSession: boolean }[];
  missingMembers: { id: string; name: string }[];
};

export async function fetchTeamChallengeParticipation(
  classId: string
): Promise<TeamChallengeParticipation> {
  return portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/market-research/challenge/participation`
  ) as Promise<TeamChallengeParticipation>;
}

export async function uploadTeamMarketReport(
  classId: string,
  body: { surveyIds: string[] }
): Promise<{ uploaded: boolean }> {
  const token = getPortalToken('student');
  const r = await fetch(
    `/api/student/personal-classes/${encodeURIComponent(classId)}/market-research/report-upload`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    }
  );
  const j = (await r.json().catch(() => ({ code: -1, message: '无效响应' }))) as {
    code: number;
    message?: string;
    data?: { uploaded?: boolean; missingMembers?: { id: string; name: string }[] };
  };
  if (!r.ok || j.code !== 0) {
    const err = new Error(typeof j.message === 'string' ? j.message : '上传失败') as UploadTeamMarketReportError;
    if (j.data?.missingMembers?.length) err.missingMembers = j.data.missingMembers;
    throw err;
  }
  return { uploaded: Boolean(j.data?.uploaded) };
}
