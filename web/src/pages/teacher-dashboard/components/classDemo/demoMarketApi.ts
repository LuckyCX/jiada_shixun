/**
 * 市场调研演示接口。问卷、画像、对抗和报告都在 session；上传文件进演示目录。
 */
import { generateDemoAi, uploadDemoFile } from './demoApi';
import { DEMO_STUDENT_ID, DEMO_STUDENT_NAME, demoId, nowIso, patchFlow, readFlow } from './demoFlow';
import {
  buildPublicSurveyUrl,
  totalChallengeRounds,
  type ChallengeFinalReport,
  type ChallengeSessionRecord,
  type MarketAnalysisResult,
  type MarketPersona,
  type MarketPlanResponse,
  type MarketResearchPlan,
  type MarketSurvey,
  type MarketSurveyQuestion,
  type MethodUploadItem,
  type MyLatestChallengeSession,
  type SurveyQuestionType,
  type SurveyResponseItem,
  type TeamMarketReportUploadStatus,
} from '../../../../lib/studentMarketResearchApi';

export {
  MARKET_PRESET_ROLES,
  MARKET_RESEARCH_METHODS,
  MARKET_UPLOAD_METHODS,
  METHOD_FORMAT_GUIDES,
  SURVEY_QUESTION_TYPES,
  buildPublicSurveyUrl,
  filterPlanUploadMethods,
  totalChallengeRounds,
} from '../../../../lib/studentMarketResearchApi';

export type {
  ChallengeFinalReport,
  ChallengeSessionRecord,
  MarketAnalysisResult,
  MarketPersona,
  MarketPlanAssignment,
  MarketResearchPlan,
  MarketSurvey,
  MarketSurveyQuestion,
  MarketTeamMember,
  MethodUploadItem,
  SurveyQuestionType,
  SurveyResponseItem,
  UploadTeamMarketReportError,
} from '../../../../lib/studentMarketResearchApi';

type StoredUpload = MethodUploadItem & { method: string; url: string };

type MarketBag = {
  plan: MarketResearchPlan | null;
  surveys: MarketSurvey[];
  responses: Record<string, SurveyResponseItem[]>;
  personas: MarketPersona[];
  analysis: { result: MarketAnalysisResult | null; generatedAt: string };
  uploads: StoredUpload[];
  sessions: MyLatestChallengeSession[];
  report: TeamMarketReportUploadStatus;
};

function emptyAnalysis(): MarketAnalysisResult {
  return {
    score: 0,
    conclusions: [],
    opportunities: [],
    risks: [],
    suggestions: [],
    stats: { totalCollected: 0, validSamples: null, activeSurveyCount: 0 },
    charts: {
      ageDistribution: [],
      spendingDistribution: [],
      satisfactionDistribution: [],
      improvementRanking: [],
    },
    keyFindings: [],
  };
}

function emptyBag(): MarketBag {
  return {
    plan: null,
    surveys: [],
    responses: {},
    personas: [],
    analysis: { result: null, generatedAt: '' },
    uploads: [],
    sessions: [],
    report: { uploaded: false, uploadedAt: '', uploadedBy: '', payload: null },
  };
}

function read(classId: string) {
  const bag = readFlow(classId, 'market', emptyBag());
  bag.surveys = bag.surveys || [];
  bag.responses = bag.responses || {};
  bag.personas = bag.personas || [];
  bag.uploads = bag.uploads || [];
  bag.sessions = bag.sessions || [];
  return bag;
}

function write(classId: string, bag: MarketBag) {
  return patchFlow(classId, 'market', emptyBag(), () => bag);
}

function planResponse(bag: MarketBag): MarketPlanResponse {
  return {
    plan: bag.plan,
    isTeamLeader: true,
    teamMembers: [{ id: DEMO_STUDENT_ID, name: DEMO_STUDENT_NAME }],
    stagePeriod: null,
  };
}

function withIds(questions: Omit<MarketSurveyQuestion, 'id'>[]): MarketSurveyQuestion[] {
  return questions.map((item) => ({ ...item, id: demoId() }));
}

export async function fetchMarketResearchPlan(classId: string) {
  return planResponse(read(classId));
}

export async function saveMarketResearchPlan(classId: string, plan: MarketResearchPlan) {
  const bag = read(classId);
  bag.plan = { ...plan, savedAt: nowIso() };
  write(classId, bag);
  return planResponse(bag);
}

export async function listMarketSurveys(classId: string) {
  return read(classId).surveys;
}

export async function createMarketSurvey(
  classId: string,
  payload: { title: string; questions: Omit<MarketSurveyQuestion, 'id'>[]; source?: 'manual' | 'ai'; closesAt: string }
) {
  const survey: MarketSurvey = {
    id: demoId(),
    title: payload.title,
    status: '草稿',
    questions: withIds(payload.questions),
    collected: 0,
    link: '',
    fromPlan: payload.source === 'ai',
    createdAt: nowIso(),
    closesAt: payload.closesAt,
  };
  const bag = read(classId);
  bag.surveys = [survey, ...bag.surveys];
  write(classId, bag);
  return survey;
}

export async function updateMarketSurvey(
  classId: string,
  surveyId: string,
  payload: { title: string; questions: Omit<MarketSurveyQuestion, 'id'>[]; closesAt: string }
) {
  const bag = read(classId);
  const survey = bag.surveys.find((item) => item.id === surveyId);
  if (!survey) throw new Error('问卷不存在');
  survey.title = payload.title;
  survey.questions = withIds(payload.questions);
  survey.closesAt = payload.closesAt;
  write(classId, bag);
  return survey;
}

export async function deleteMarketSurvey(classId: string, surveyId: string) {
  const bag = read(classId);
  bag.surveys = bag.surveys.filter((item) => item.id !== surveyId);
  delete bag.responses[surveyId];
  write(classId, bag);
}

export async function publishMarketSurvey(classId: string, surveyId: string) {
  const bag = read(classId);
  const survey = bag.surveys.find((item) => item.id === surveyId);
  if (!survey) throw new Error('问卷不存在');
  survey.status = '进行中';
  survey.publicSlug = survey.publicSlug || demoId();
  survey.link = buildPublicSurveyUrl(survey.publicSlug);
  survey.publishedAt = nowIso();
  write(classId, bag);
  return survey;
}

export async function withdrawMarketSurvey(classId: string, surveyId: string) {
  const bag = read(classId);
  const survey = bag.surveys.find((item) => item.id === surveyId);
  if (!survey) throw new Error('问卷不存在');
  survey.status = '已撤回';
  write(classId, bag);
  return survey;
}

export async function generateMarketSurveyByAi(
  classId: string,
  payload: { questionCount: number; includeTypes: SurveyQuestionType[] }
) {
  const count = Math.max(1, Math.min(12, payload.questionCount || 5));
  const text = await generateDemoAi(classId, 'market-analysis', `请给出 ${count} 个中文调研问题，每行一个。`);
  const lines = text
    .split('\n')
    .map((line) => line.replace(/^[\d.\-、\s]+/, '').trim())
    .filter((line) => line.length > 3)
    .slice(0, count);
  const type = payload.includeTypes[0] || '单选';
  while (lines.length < count) lines.push(`您对这个方向的看法是？（${lines.length + 1}）`);
  const questions: MarketSurveyQuestion[] = lines.map((line) => ({
    id: demoId(),
    text: line,
    type,
    options: type === '填空' || type === '评分' ? undefined : ['同意', '一般', '不同意'],
  }));
  return {
    title: '课堂演示问卷',
    questions,
    promptEcho: { system: '演示', user: `生成 ${count} 题` },
  };
}

export async function listMarketMethodUploads(classId: string, method: string) {
  return read(classId).uploads.filter((item) => item.method === method);
}

export async function uploadMarketMethodFile(classId: string, method: string, file: File) {
  const saved = await uploadDemoFile(classId, file);
  const item: StoredUpload = {
    id: demoId(),
    originalFilename: saved.name || file.name,
    fileSize: file.size,
    createdAt: nowIso(),
    uploaderName: DEMO_STUDENT_NAME,
    uploadedBy: DEMO_STUDENT_ID,
    method,
    url: saved.url,
  };
  const bag = read(classId);
  bag.uploads = [item, ...bag.uploads];
  write(classId, bag);
  return { id: item.id };
}

export async function downloadMarketMethodFile(classId: string, uploadId: string, filename: string) {
  const item = read(classId).uploads.find((row) => row.id === uploadId);
  if (!item?.url) throw new Error('文件不存在');
  const a = document.createElement('a');
  a.href = item.url;
  a.download = filename || item.originalFilename;
  a.target = '_blank';
  a.click();
}

export async function deleteMarketMethodUpload(classId: string, uploadId: string) {
  const bag = read(classId);
  bag.uploads = bag.uploads.filter((item) => item.id !== uploadId);
  write(classId, bag);
}

export async function fetchMarketSurveyResponses(classId: string, surveyId: string) {
  const bag = read(classId);
  const survey = bag.surveys.find((item) => item.id === surveyId);
  return {
    surveyTitle: survey?.title || '',
    questions: survey?.questions || [],
    responses: bag.responses[surveyId] || [],
  };
}

export async function deleteMarketSurveyResponse(classId: string, surveyId: string, responseId: string) {
  const bag = read(classId);
  const list = (bag.responses[surveyId] || []).filter((item) => item.id !== responseId);
  bag.responses[surveyId] = list;
  const survey = bag.surveys.find((item) => item.id === surveyId);
  if (survey) survey.collected = list.length;
  write(classId, bag);
  return { collected: list.length };
}

function analysisFromText(text: string, bag: MarketBag): MarketAnalysisResult {
  const collected = bag.surveys.reduce((sum, item) => sum + item.collected, 0);
  return {
    ...emptyAnalysis(),
    score: 78,
    conclusions: [text],
    suggestions: text.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 3),
    stats: {
      totalCollected: collected,
      validSamples: collected,
      activeSurveyCount: bag.surveys.filter((item) => item.status === '进行中').length,
    },
    keyFindings: [{ title: '调研结论', desc: text.slice(0, 180) }],
  };
}

export async function fetchMarketAnalysis(classId: string) {
  return read(classId).analysis;
}

export async function streamMarketAnalysis(
  classId: string,
  surveyIds: string[],
  handlers: {
    onStatus?: (message: string) => void;
    onThinking?: (text: string) => void;
    onContent?: (text: string) => void;
    onError?: (message: string) => void;
    onDone?: (result: MarketAnalysisResult) => void;
  }
) {
  try {
    handlers.onStatus?.('正在整理调研结论…');
    const bag = read(classId);
    const titles = bag.surveys.filter((item) => surveyIds.includes(item.id)).map((item) => item.title);
    const text = await generateDemoAi(classId, 'market-analysis', titles.join('、') || '请写一份课堂调研结论');
    handlers.onContent?.(text);
    const result = analysisFromText(text, bag);
    bag.analysis = { result, generatedAt: nowIso() };
    write(classId, bag);
    handlers.onDone?.(result);
  } catch (e) {
    handlers.onError?.(e instanceof Error ? e.message : '生成失败');
    throw e;
  }
}

export async function listMarketPersonas(classId: string) {
  return read(classId).personas;
}

export async function createMarketPersona(classId: string, payload: Omit<MarketPersona, 'id' | 'source'>) {
  const persona: MarketPersona = { ...payload, id: demoId(), source: 'manual' };
  const bag = read(classId);
  bag.personas = [persona, ...bag.personas];
  write(classId, bag);
  return persona;
}

export async function updateMarketPersona(classId: string, personaId: string, payload: Partial<MarketPersona>) {
  const bag = read(classId);
  const persona = bag.personas.find((item) => item.id === personaId);
  if (!persona) throw new Error('画像不存在');
  Object.assign(persona, payload, { id: personaId });
  write(classId, bag);
  return persona;
}

export async function deleteMarketPersona(classId: string, personaId: string) {
  const bag = read(classId);
  bag.personas = bag.personas.filter((item) => item.id !== personaId);
  write(classId, bag);
}

export async function streamGeneratePersonas(
  classId: string,
  _surveyIds: string[],
  handlers: {
    onStatus?: (message: string) => void;
    onThinking?: (text: string) => void;
    onContent?: (text: string) => void;
    onError?: (message: string) => void;
    onDone?: (personas: MarketPersona[]) => void;
  }
) {
  try {
    handlers.onStatus?.('正在生成用户画像…');
    const text = await generateDemoAi(classId, 'market-persona', '请生成 2 个课堂用用户画像');
    handlers.onContent?.(text);
    const parsed = (() => {
      try {
        const start = text.indexOf('[');
        const end = text.lastIndexOf(']');
        if (start < 0 || end <= start) return [];
        return JSON.parse(text.slice(start, end + 1)) as Partial<MarketPersona>[];
      } catch (e) {
        console.error('[classDemo] 画像解析失败', e);
        return [];
      }
    })();
    const personas: MarketPersona[] = (parsed.length ? parsed : [{ name: '演示用户', occupation: '学生' }]).map((item) => ({
      id: demoId(),
      name: String(item.name || '演示用户'),
      age: Number(item.age || 20),
      occupation: String(item.occupation || ''),
      major: String(item.major || ''),
      painPoints: Array.isArray(item.painPoints) ? item.painPoints.map(String) : [String(item.painPoints || text.slice(0, 40))],
      needs: Array.isArray(item.needs) ? item.needs.map(String) : [],
      habits: Array.isArray(item.habits) ? item.habits.map(String) : [],
      borderColor: '#22c55e',
      accentColor: '#16a34a',
      fromSurvey: true,
      source: 'ai',
    }));
    const bag = read(classId);
    bag.personas = [...personas, ...bag.personas];
    write(classId, bag);
    handlers.onDone?.(personas);
  } catch (e) {
    handlers.onError?.(e instanceof Error ? e.message : '生成失败');
    throw e;
  }
}

export async function listChallengeSessions(classId: string): Promise<ChallengeSessionRecord[]> {
  return read(classId).sessions.map((item) => ({
    id: item.id,
    studentId: DEMO_STUDENT_ID,
    studentName: DEMO_STUDENT_NAME,
    createdAt: item.createdAt,
    completedAt: item.completedAt,
    finalReport: item.finalReport,
  }));
}

export async function fetchMyLatestChallengeSession(classId: string) {
  return read(classId).sessions[0] || null;
}

export async function createChallengeSession(
  classId: string,
  payload: { projectInfo: Record<string, unknown>; selectedAgents: string[] }
) {
  const session: MyLatestChallengeSession = {
    id: demoId(),
    status: 'in_progress',
    projectInfo: payload.projectInfo,
    selectedAgents: payload.selectedAgents,
    rounds: [],
    finalReport: null,
    createdAt: nowIso(),
    completedAt: '',
  };
  const bag = read(classId);
  bag.sessions = [session, ...bag.sessions];
  write(classId, bag);
  return { sessionId: session.id, totalRounds: totalChallengeRounds(payload.selectedAgents.length), createdAt: session.createdAt };
}

export async function streamChallengeRound(
  classId: string,
  sessionId: string,
  payload: { roundIndex: number; answer?: string; agentId?: string },
  handlers: {
    onStatus?: (message: string) => void;
    onError?: (message: string) => void;
    onDone?: (data: { question: string; agentName: string; agentRole: string; briefFeedback?: string; roundIndex: number }) => void;
  }
) {
  try {
    handlers.onStatus?.('思考中…');
    const text = await generateDemoAi(classId, 'market-challenge', payload.answer || '请提出一个调研挑战问题');
    const bag = read(classId);
    const session = bag.sessions.find((item) => item.id === sessionId);
    const data = {
      question: text,
      agentName: '评审',
      agentRole: '挑剔的评审',
      briefFeedback: payload.answer ? '已收到你的回答。' : '',
      roundIndex: payload.roundIndex,
    };
    if (session) {
      session.rounds = [...session.rounds, { ...data, answer: payload.answer }];
      write(classId, bag);
    }
    handlers.onDone?.(data);
  } catch (e) {
    handlers.onError?.(e instanceof Error ? e.message : '生成失败');
    throw e;
  }
}

export async function streamChallengeFinalReport(
  classId: string,
  sessionId: string,
  answer: string,
  handlers: {
    onStatus?: (message: string) => void;
    onContent?: (text: string) => void;
    onError?: (message: string) => void;
    onDone?: (report: ChallengeFinalReport) => void;
  }
) {
  try {
    handlers.onStatus?.('正在生成挑战报告…');
    const text = await generateDemoAi(classId, 'market-challenge', answer || '请总结这场调研挑战');
    handlers.onContent?.(text);
    const report: ChallengeFinalReport = {
      totalScore: 80,
      strengths: ['能讲清调研目的'],
      weaknesses: text.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 3),
      suggestions: ['补一个可核对的样本说明'],
    };
    const bag = read(classId);
    const session = bag.sessions.find((item) => item.id === sessionId);
    if (session) {
      session.finalReport = report;
      session.status = 'completed';
      session.completedAt = nowIso();
      write(classId, bag);
    }
    handlers.onDone?.(report);
  } catch (e) {
    handlers.onError?.(e instanceof Error ? e.message : '生成失败');
    throw e;
  }
}

export async function fetchTeamMarketReportUploadStatus(classId: string) {
  return read(classId).report;
}

export async function fetchTeamChallengeParticipation(classId: string) {
  const done = read(classId).sessions.some((item) => item.finalReport);
  return {
    members: [{ id: DEMO_STUDENT_ID, name: DEMO_STUDENT_NAME, hasChallengeSession: done }],
    missingMembers: [] as { id: string; name: string }[],
  };
}

export async function uploadTeamMarketReport(classId: string, body: { surveyIds: string[] }) {
  const bag = read(classId);
  bag.report = {
    uploaded: true,
    uploadedAt: nowIso(),
    uploadedBy: DEMO_STUDENT_NAME,
    payload: {
      surveyIds: body.surveyIds,
      personaIds: bag.personas.map((item) => item.id),
      analysisResult: bag.analysis.result || emptyAnalysis(),
      analysisGeneratedAt: bag.analysis.generatedAt,
    },
  };
  write(classId, bag);
  return { uploaded: true };
}
