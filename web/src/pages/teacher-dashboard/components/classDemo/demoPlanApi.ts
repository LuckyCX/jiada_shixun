/**
 * 商业计划书演示接口。提交和评分只改 session，审核菜单读同一份缓存。
 */
import { BUSINESS_PLAN_SECTION_DEFS, defaultCover } from '../../../../lib/businessPlanTemplate';
import type { BusinessPlanSection, BusinessPlanSectionLock, BusinessPlanWorkspace } from '../../../../lib/studentBusinessPlanApi';
import { uploadDemoFile } from './demoApi';
import { generateDemoAi } from './demoApi';
import { ensurePlanEditorHtml } from '../../../../lib/planEditorHtml';
import { DEMO_STUDENT_ID, DEMO_STUDENT_NAME, demoId, demoTeamName, htmlParagraphs, nowIso, readFlow, writeFlow } from './demoFlow';
import type { BusinessPlan, ReviewFormData } from './planReview/types';

export class BusinessPlanConflictError extends Error {
  code: number;
  workspace: BusinessPlanWorkspace | null;
  lock?: BusinessPlanSectionLock | null;
  constructor(message: string, code: number, workspace: BusinessPlanWorkspace | null, lock?: BusinessPlanSectionLock | null) {
    super(message);
    this.name = 'BusinessPlanConflictError';
    this.code = code;
    this.workspace = workspace;
    this.lock = lock || null;
  }
}

export type {
  BusinessPlanClassMeta,
  BusinessPlanSection,
  BusinessPlanSectionLock,
  BusinessPlanTeamMember,
  BusinessPlanWorkspace,
} from '../../../../lib/studentBusinessPlanApi';

type PlanFile = { name: string; url: string; size: string };

type PlanBag = {
  workspace: BusinessPlanWorkspace;
  attachments: PlanFile[];
};

function baseSections(): BusinessPlanSection[] {
  return BUSINESS_PLAN_SECTION_DEFS.map((item) => ({
    key: item.key,
    title: item.title,
    guide: item.guide,
    content: '',
  }));
}

function topicName(classId: string) {
  const ideation = readFlow<{ topic?: { projectName?: string; status?: string } | null }>(classId, 'ideation', {});
  const topic = ideation.topic;
  if (!topic || topic.status === 'rejected') return '';
  return String(topic.projectName || '');
}

function emptyWorkspace(classId: string): BusinessPlanWorkspace {
  const name = topicName(classId);
  const cover = defaultCover();
  if (name) cover.projectName = name;
  cover.leader = DEMO_STUDENT_NAME;
  cover.members = [DEMO_STUDENT_NAME];
  return {
    sections: baseSections(),
    cover,
    classMeta: { collegeClass: '', advisor: '' },
    teamMembers: [{ id: DEMO_STUDENT_ID, name: DEMO_STUDENT_NAME, studentNo: '', isLeader: true }],
    isSolo: true,
    topicProjectName: name,
    projectNameLocked: Boolean(name),
    fullText: '',
    completedSectionCount: 0,
    totalSectionCount: BUSINESS_PLAN_SECTION_DEFS.length,
    revision: 1,
    updatedAt: '',
    updatedByName: '',
    versions: [],
    locks: [],
    submission: null,
    readOnly: false,
    isTeamLeader: true,
    teamMemberCount: 1,
    trainingEnded: false,
  };
}

function read(classId: string): PlanBag {
  const bag = readFlow<PlanBag | null>(classId, 'plan', null);
  if (!bag?.workspace) return { workspace: emptyWorkspace(classId), attachments: [] };
  bag.attachments = bag.attachments || [];
  bag.workspace.teamMembers = [{ id: DEMO_STUDENT_ID, name: DEMO_STUDENT_NAME, studentNo: '', isLeader: true }];
  bag.workspace.isTeamLeader = true;
  bag.workspace.teamMemberCount = 1;
  bag.workspace.isSolo = true;
  return bag;
}

function refreshCounts(ws: BusinessPlanWorkspace) {
  const done = ws.sections.filter((item) => String(item.content || '').replace(/<[^>]+>/g, '').trim()).length;
  ws.completedSectionCount = done;
  ws.totalSectionCount = ws.sections.length || BUSINESS_PLAN_SECTION_DEFS.length;
  ws.fullText = ws.sections.map((item) => `${item.title}\n${item.content}`).join('\n\n');
  ws.readOnly = ws.submission?.status === 'approved';
  ws.updatedAt = nowIso();
  ws.updatedByName = DEMO_STUDENT_NAME;
  return ws;
}

function write(classId: string, bag: PlanBag) {
  refreshCounts(bag.workspace);
  return writeFlow(classId, 'plan', bag);
}

export async function fetchBusinessPlanEntry(_classId: string) {
  return {
    allowed: true,
    prerequisiteModuleKey: '',
    requiredKnowledgePointCount: 0,
    passedKnowledgePointCount: 0,
    summary: '',
  };
}

export async function fetchBusinessPlanWorkspace(classId: string) {
  return read(classId).workspace;
}

export async function saveBusinessPlanWorkspace(
  classId: string,
  body: {
    sections?: BusinessPlanSection[];
    revision: number;
    activeSectionKey?: string;
    replaceAll?: boolean;
    cover?: BusinessPlanWorkspace['cover'];
  }
) {
  const bag = read(classId);
  if (body.sections) bag.workspace.sections = body.sections;
  if (body.cover) bag.workspace.cover = body.cover;
  bag.workspace.revision = Math.max(bag.workspace.revision, Number(body.revision || 0)) + 1;
  write(classId, bag);
  return bag.workspace;
}

function lockFor(sectionKey: string): BusinessPlanSectionLock {
  const at = nowIso();
  return { sectionKey, lockedById: DEMO_STUDENT_ID, lockedByName: DEMO_STUDENT_NAME, lockedAt: at, heartbeatAt: at };
}

export async function acquireBusinessPlanSectionLock(classId: string, sectionKey: string) {
  const bag = read(classId);
  bag.workspace.locks = [lockFor(sectionKey)];
  write(classId, bag);
  return { lock: bag.workspace.locks[0], workspace: bag.workspace };
}

export async function heartbeatBusinessPlanSectionLock(classId: string, sectionKey: string) {
  const bag = read(classId);
  const current = bag.workspace.locks.find((item) => item.sectionKey === sectionKey) || lockFor(sectionKey);
  current.heartbeatAt = nowIso();
  bag.workspace.locks = [current];
  write(classId, bag);
  return { lock: current, workspace: bag.workspace };
}

export async function releaseBusinessPlanSectionLock(classId: string, sectionKey?: string) {
  const bag = read(classId);
  bag.workspace.locks = sectionKey ? bag.workspace.locks.filter((item) => item.sectionKey !== sectionKey) : [];
  write(classId, bag);
  return { workspace: bag.workspace };
}

export async function generateBusinessPlanOutline(classId: string, revision: number) {
  const bag = read(classId);
  const name = topicName(classId);
  bag.workspace.sections = baseSections();
  if (name) {
    bag.workspace.cover.projectName = name;
    bag.workspace.topicProjectName = name;
    bag.workspace.projectNameLocked = true;
  }
  bag.workspace.revision = Math.max(bag.workspace.revision, revision) + 1;
  write(classId, bag);
  return bag.workspace;
}

export async function fillBusinessPlanSection(
  classId: string,
  body: { sectionKey: string; mode: 'overwrite' | 'expand'; sections: BusinessPlanSection[]; revision: number }
) {
  const text = await generateDemoAi(classId, 'plan-generate-section', `请撰写章节 ${body.sectionKey} 的课堂正文。已有内容：${body.sections.find((item) => item.key === body.sectionKey)?.content || '空'}`);
  const bag = read(classId);
  const sections = body.sections.length ? body.sections : bag.workspace.sections;
  bag.workspace.sections = sections.map((item) => {
    if (item.key !== body.sectionKey) return item;
    const html = ensurePlanEditorHtml(text || htmlParagraphs(`（演示）${item.title}`));
    const content = body.mode === 'expand' && item.content ? `${item.content}${html}` : html;
    return { ...item, content };
  });
  bag.workspace.revision = Math.max(bag.workspace.revision, body.revision) + 1;
  write(classId, bag);
  return bag.workspace;
}

function stripHtmlDemo(s: string) {
  return String(s || '')
    .replace(/<[^>]+>/g, '')
    .trim();
}

/** 从演示各环节 session 拼前期上下文（含市场分析/画像） */
function buildDemoPlanContextBundle(classId: string) {
  const ideation = readFlow<{ topic?: Record<string, unknown> | null }>(classId, 'ideation', {});
  const market = readFlow<{
    analysis?: { result?: unknown; generatedAt?: string };
    personas?: unknown[];
    plan?: { goal?: string };
  }>(classId, 'market', {});
  const product = readFlow<{ contextText?: string; suggestions?: unknown }>(classId, 'product', {});
  const business = readFlow<Record<string, unknown>>(classId, 'business', {});
  const simulation = readFlow<unknown[]>(classId, 'simulation', []);
  const parts = [
    '【前期实训汇编 · 课堂演示】',
    ideation.topic ? `【选题】\n${JSON.stringify(ideation.topic).slice(0, 4000)}` : '【选题】（暂无）',
    market.plan?.goal ? `【调研计划目标】\n${String(market.plan.goal).slice(0, 1500)}` : '',
    market.analysis?.result
      ? `【市场调研 · AI智能分析报告】\n${JSON.stringify(market.analysis.result).slice(0, 10000)}`
      : '【市场调研 · AI智能分析报告】\n（暂无）',
    Array.isArray(market.personas) && market.personas.length
      ? `【市场调研 · 用户画像】\n${JSON.stringify(market.personas.slice(0, 8)).slice(0, 8000)}`
      : '【市场调研 · 用户画像】\n（暂无）',
    product.contextText ? `【产品设计背景】\n${String(product.contextText).slice(0, 3000)}` : '',
    product.suggestions ? `【产品 AI 建议】\n${JSON.stringify(product.suggestions).slice(0, 4000)}` : '',
    `【商业模式】\n${JSON.stringify({
      swot: business.swot,
      marketing: business.marketing,
      finance: business.finance,
      bmc: business.bmc,
    }).slice(0, 8000)}`,
    Array.isArray(simulation) && simulation.length
      ? `【仿真摘要】\n${JSON.stringify(simulation.slice(0, 3)).slice(0, 3000)}`
      : '',
  ];
  // 与后端 demo/ai plan-generate-full 上下文上限对齐，避免前端先截断
  return parts.filter(Boolean).join('\n\n').slice(0, 80000);
}

/** 演示端一键填写：非流式，一次生成整本 JSON 后落库（对齐学生端） */
export async function generateBusinessPlan(
  classId: string,
  body: { mode: 'full' | 'incremental'; sections: BusinessPlanSection[] }
): Promise<BusinessPlanWorkspace & { savedCount?: number }> {
  const bag = read(classId);
  let sections = (body.sections?.length ? body.sections : bag.workspace.sections).map((s) => ({ ...s }));
  const mode = body.mode === 'full' ? 'full' : 'incremental';
  const targets = sections.filter((s) => (mode === 'full' ? true : stripHtmlDemo(s.content).length === 0));
  if (!targets.length) {
    return { ...bag.workspace, savedCount: 0 };
  }
  if (mode === 'full') {
    sections = sections.map((s) => ({ ...s, content: '' }));
  }
  const contextBundle = buildDemoPlanContextBundle(classId);
  const list = targets.map((s) => ({ key: s.key, title: s.title, guide: s.guide || undefined }));
  // 章节列表放前面，避免服务端截断上下文时只剩调研摘要、丢了必写章节
  const raw = await generateDemoAi(
    classId,
    'plan-generate-full',
    [
      `【输入章节列表（必须全部生成，共 ${list.length} 章；每章 content 500～800 汉字）】`,
      JSON.stringify(list, null, 2),
      '请输出完整 JSON：{"sections":[{"key","title","content"},...]}，不得漏章。',
      '',
      contextBundle,
    ].join('\n')
  );
  let parsed: { sections?: { key?: string; title?: string; content?: string }[] } | null = null;
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        parsed = JSON.parse(m[0]) as typeof parsed;
      } catch {
        parsed = null;
      }
    }
  }
  const genByKey = new Map(
    (Array.isArray(parsed?.sections) ? parsed!.sections! : [])
      .map((s) => [String(s?.key || '').trim(), s] as const)
      .filter(([k]) => k)
  );
  const missing = targets.filter((t) => !String(genByKey.get(t.key)?.content || '').trim());
  if (missing.length) {
    throw new Error(`AI 未完整返回全部章节（缺少：${missing.map((t) => t.title || t.key).join('、')}），请重试`);
  }
  let savedCount = 0;
  for (const sec of targets) {
    const hit = genByKey.get(sec.key);
    const html = ensurePlanEditorHtml(String(hit?.content || '').trim());
    sections = sections.map((s) => (s.key === sec.key ? { ...s, content: html } : s));
    savedCount += 1;
  }
  bag.workspace.sections = sections;
  bag.workspace.revision += 1;
  bag.workspace.updatedAt = nowIso();
  bag.workspace.updatedByName = DEMO_STUDENT_NAME;
  write(classId, bag);
  return { ...bag.workspace, savedCount };
}

export async function submitBusinessPlan(classId: string, files: File[] = [], versionId?: string) {
  const bag = read(classId);
  const uploaded: PlanFile[] = [];
  for (const file of files || []) {
    const saved = await uploadDemoFile(classId, file);
    uploaded.push({ name: saved.name || file.name, url: saved.url, size: String(file.size) });
  }
  bag.attachments = [...bag.attachments, ...uploaded];
  const versionNo = bag.workspace.versions.length + 1;
  const version = {
    id: versionId || demoId(),
    versionNumber: versionNo,
    summary: '课堂演示提交',
    savedAt: nowIso(),
    operator: DEMO_STUDENT_NAME,
    savedById: DEMO_STUDENT_ID,
  };
  if (!versionId) bag.workspace.versions = [version, ...bag.workspace.versions];
  bag.workspace.submission = {
    id: bag.workspace.submission?.id || demoId(),
    versionId: version.id,
    versionNo,
    versionSummary: version.summary,
    status: 'pending',
    submittedAt: nowIso(),
    reviewComment: '',
    reviewedAt: '',
    scores: {},
    totalScore: null,
  };
  write(classId, bag);
  return { submission: bag.workspace.submission, trainingEnded: false };
}

function sectionText(ws: BusinessPlanWorkspace, key: string) {
  return String(ws.sections.find((item) => item.key === key)?.content || '').replace(/<[^>]+>/g, ' ').trim();
}

function toReviewPlan(classId: string, bag: PlanBag): BusinessPlan | null {
  const sub = bag.workspace.submission;
  if (!sub) return null;
  const cover = bag.workspace.cover;
  return {
    id: sub.id,
    teamId: 'demo-team',
    teamName: demoTeamName(classId),
    projectName: cover.projectName || bag.workspace.topicProjectName || '未命名项目',
    submitTime: sub.submittedAt,
    status: sub.status,
    reviewComment: sub.reviewComment,
    reviewTime: sub.reviewedAt,
    scores: sub.scores,
    totalScore: sub.totalScore,
    executiveSummary: sectionText(bag.workspace, 's1_1'),
    marketAnalysis: sectionText(bag.workspace, 's1_2'),
    productService: sectionText(bag.workspace, 's2_1'),
    marketingStrategy: sectionText(bag.workspace, 's3_1'),
    operationPlan: sectionText(bag.workspace, 's3_2_1'),
    financialPlan: sectionText(bag.workspace, 's4_1_1'),
    teamIntroduction: cover.leader || DEMO_STUDENT_NAME,
    riskAnalysis: sectionText(bag.workspace, 's4_3'),
    sections: bag.workspace.sections,
    fullText: bag.workspace.fullText,
    cover,
    attachments: bag.attachments,
  };
}

export async function fetchTeacherBusinessPlanSubmissions(
  classId: string,
  status: 'all' | 'pending' | 'approved' | 'rejected' = 'all'
) {
  const plan = toReviewPlan(classId, read(classId));
  if (!plan) return [];
  if (status !== 'all' && plan.status !== status) return [];
  return [plan];
}

export async function reviewTeacherBusinessPlanSubmission(classId: string, submissionId: string, body: ReviewFormData) {
  const bag = read(classId);
  const sub = bag.workspace.submission;
  if (!sub || sub.id !== submissionId) throw new Error('计划书不存在');
  const values = Object.values(body.scores || {}).map(Number).filter((item) => Number.isFinite(item));
  sub.status = body.status;
  sub.reviewComment = body.comment;
  sub.reviewedAt = nowIso();
  sub.scores = body.scores;
  sub.totalScore = values.length ? Math.round(values.reduce((sum, item) => sum + item, 0) / values.length) : null;
  write(classId, bag);
  const plan = toReviewPlan(classId, bag);
  if (!plan) throw new Error('计划书不存在');
  return plan;
}
