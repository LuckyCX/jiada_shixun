import { portalAuthenticatedFetch } from './authApi';
import type { BusinessPlanCover } from './businessPlanTemplate';

export type BusinessPlanSection = {
  key: string;
  title: string;
  content: string;
  guide?: string;
};

export type BusinessPlanVersionSummary = {
  id: string;
  versionNumber: number;
  summary: string;
  savedAt: string;
  operator: string;
  savedById: string;
};

export type BusinessPlanSubmission = {
  id: string;
  versionId: string;
  versionNo: number;
  versionSummary: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  reviewComment: string;
  reviewedAt: string;
  scores?: Record<string, number>;
  totalScore?: number | null;
};

export type BusinessPlanSectionLock = {
  sectionKey: string;
  lockedById: string;
  lockedByName: string;
  lockedAt: string;
  heartbeatAt: string;
};

export type BusinessPlanTeamMember = {
  id: string;
  name: string;
  studentNo: string;
  isLeader: boolean;
};

export type BusinessPlanClassMeta = {
  collegeClass: string;
  advisor: string;
};

export type BusinessPlanWorkspace = {
  sections: BusinessPlanSection[];
  cover: BusinessPlanCover;
  classMeta?: BusinessPlanClassMeta;
  teamMembers?: BusinessPlanTeamMember[];
  isSolo?: boolean;
  /** 第二步选题项目名称（有则封面项目名锁定） */
  topicProjectName?: string;
  projectNameLocked?: boolean;
  fullText: string;
  completedSectionCount: number;
  totalSectionCount: number;
  revision: number;
  updatedAt: string;
  updatedByName: string;
  versions: BusinessPlanVersionSummary[];
  locks: BusinessPlanSectionLock[];
  submission: BusinessPlanSubmission | null;
  readOnly: boolean;
  isTeamLeader: boolean;
  teamMemberCount: number;
  trainingEnded: boolean;
};

export type BusinessPlanEntry = {
  allowed: boolean;
  prerequisiteModuleKey: string;
  requiredKnowledgePointCount: number;
  passedKnowledgePointCount: number;
  summary?: string;
};

export type BusinessPlanAnalysis = {
  id: string;
  versionId: string;
  versionNumber: number;
  versionSummary: string;
  result: string;
  createdAt: string;
  createdByName?: string;
};

function studentFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  return portalAuthenticatedFetch('student', path, opts) as Promise<T>;
}

export async function fetchBusinessPlanEntry(classId: string): Promise<BusinessPlanEntry> {
  return studentFetch(`/api/student/personal-classes/${classId}/business-plan/entry`);
}

export async function fetchBusinessPlanWorkspace(classId: string): Promise<BusinessPlanWorkspace> {
  return studentFetch(`/api/student/personal-classes/${classId}/business-plan/workspace`);
}

export async function saveBusinessPlanWorkspace(
  classId: string,
  body: {
    sections?: BusinessPlanSection[];
    revision: number;
    activeSectionKey?: string;
    replaceAll?: boolean;
    cover?: BusinessPlanCover;
  }
): Promise<BusinessPlanWorkspace> {
  return studentFetchAllowConflict(`/api/student/personal-classes/${classId}/business-plan/workspace`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

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

async function studentFetchAllowConflict<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const { getPortalToken, rewriteUnsafeHttpMethod, compatFetch } = await import('./authApi');
  const token = getPortalToken('student') || '';
  const safeOpts = rewriteUnsafeHttpMethod(opts);
  const headers: Record<string, string> = {
    ...(safeOpts.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (safeOpts.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  const r = await compatFetch(path, { ...safeOpts, headers });
  const j = await r.json().catch(() => ({ code: -1, message: '无效 JSON', data: null }));
  if (r.status === 409) {
    const ws = (j.data?.workspace || (j.data?.sections ? j.data : null) || null) as BusinessPlanWorkspace | null;
    throw new BusinessPlanConflictError(
      typeof j.message === 'string' ? j.message : '发生冲突',
      Number(j.code || 40901),
      ws,
      j.data?.lock || null
    );
  }
  if (!r.ok || j.code !== 0) throw new Error(typeof j.message === 'string' ? j.message : `HTTP ${r.status}`);
  return j.data as T;
}

export async function acquireBusinessPlanSectionLock(
  classId: string,
  sectionKey: string
): Promise<{ lock: BusinessPlanSectionLock; workspace: BusinessPlanWorkspace }> {
  return studentFetchAllowConflict(`/api/student/personal-classes/${classId}/business-plan/section-locks`, {
    method: 'POST',
    body: JSON.stringify({ sectionKey }),
  });
}

export async function heartbeatBusinessPlanSectionLock(
  classId: string,
  sectionKey: string
): Promise<{ lock: BusinessPlanSectionLock | null; workspace: BusinessPlanWorkspace }> {
  return studentFetchAllowConflict(`/api/student/personal-classes/${classId}/business-plan/section-locks/heartbeat`, {
    method: 'POST',
    body: JSON.stringify({ sectionKey }),
  });
}

export async function releaseBusinessPlanSectionLock(
  classId: string,
  sectionKey?: string
): Promise<{ workspace: BusinessPlanWorkspace }> {
  const q = sectionKey ? `?sectionKey=${encodeURIComponent(sectionKey)}` : '';
  return studentFetch(`/api/student/personal-classes/${classId}/business-plan/section-locks${q}`, {
    method: 'DELETE',
  });
}

export async function createBusinessPlanVersion(
  classId: string,
  summary: string,
  sections: BusinessPlanSection[]
): Promise<{ version: { id: string; versionNumber: number; summary: string; savedAt: string; operator: string; data: { sections: BusinessPlanSection[] } }; workspace: BusinessPlanWorkspace }> {
  return studentFetch(`/api/student/personal-classes/${classId}/business-plan/versions`, {
    method: 'POST',
    body: JSON.stringify({ summary, sections }),
  });
}

export async function deleteBusinessPlanVersion(classId: string, versionId: string): Promise<BusinessPlanWorkspace> {
  return studentFetch(`/api/student/personal-classes/${classId}/business-plan/versions/${versionId}`, {
    method: 'DELETE',
  });
}

export async function previewBusinessPlanVersion(
  classId: string,
  versionId: string
): Promise<{ sections: BusinessPlanSection[]; fullText: string }> {
  return studentFetch(
    `/api/student/personal-classes/${classId}/business-plan/versions/${versionId}/restore-preview`,
    { method: 'POST' }
  );
}

export async function generateBusinessPlan(classId: string): Promise<BusinessPlanWorkspace> {
  return studentFetch(`/api/student/personal-classes/${classId}/business-plan/generate`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export type BusinessPlanGenerateStreamEvent =
  | { event: 'log'; data: { text: string } }
  | { event: 'thinking'; data: { text: string } }
  | { event: 'section'; data: { key: string; title?: string; content: string; done?: boolean } }
  | { event: 'done'; data: { savedCount?: number } }
  | { event: 'error'; data: { message: string } };

async function readSsePost(
  path: string,
  body: Record<string, unknown>,
  handlers: {
    onLog?: (text: string) => void;
    onThinking?: (text: string) => void;
    onSection?: (payload: { key: string; title?: string; content: string; done?: boolean }) => void;
    onDone?: (payload: { savedCount?: number }) => void;
    onError?: (message: string) => void;
  }
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
    body: JSON.stringify(body),
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
      let data: any;
      try {
        data = JSON.parse(raw);
      } catch {
        continue;
      }
      if (currentEvent === 'log' && typeof data.text === 'string') {
        handlers.onLog?.(data.text);
      } else if (currentEvent === 'thinking' && typeof data.text === 'string') {
        handlers.onThinking?.(data.text);
      } else if (currentEvent === 'section' && typeof data.key === 'string') {
        handlers.onSection?.(data);
      } else if (currentEvent === 'done') {
        handlers.onDone?.(data || {});
      } else if (currentEvent === 'error') {
        const msg = typeof data.message === 'string' ? data.message : '请求失败';
        handlers.onError?.(msg);
        throw new Error(msg);
      }
    }
  }
}

export async function generateBusinessPlanStream(
  classId: string,
  body: { mode: 'full' | 'incremental'; sections: BusinessPlanSection[] },
  handlers: {
    onLog?: (text: string) => void;
    onThinking?: (text: string) => void;
    onSection?: (payload: { key: string; title?: string; content: string; done?: boolean }) => void;
    onDone?: (payload: { savedCount?: number }) => void;
    onError?: (message: string) => void;
  }
) {
  await readSsePost(
    `/api/student/personal-classes/${encodeURIComponent(classId)}/business-plan/generate/stream`,
    body,
    handlers
  );
}

export async function fillBusinessPlanSection(
  classId: string,
  body: {
    sectionKey: string;
    mode: 'overwrite' | 'expand';
    sections: BusinessPlanSection[];
    revision: number;
  }
): Promise<BusinessPlanWorkspace> {
  return studentFetchAllowConflict(`/api/student/personal-classes/${classId}/business-plan/sections/fill`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** 根据项目上下文生成章节大纲（仅结构，正文为空） */
export async function generateBusinessPlanOutline(
  classId: string,
  revision: number
): Promise<BusinessPlanWorkspace> {
  return studentFetchAllowConflict(`/api/student/personal-classes/${classId}/business-plan/sections/outline`, {
    method: 'POST',
    body: JSON.stringify({ revision }),
  });
}

export async function analyzeBusinessPlanVersion(
  classId: string,
  versionId: string
): Promise<{ analysis: BusinessPlanAnalysis }> {
  return studentFetch(`/api/student/personal-classes/${classId}/business-plan/analyze`, {
    method: 'POST',
    body: JSON.stringify({ versionId }),
  });
}

export type BusinessPlanAnalyzeJson = {
  score: number;
  overall: string;
  strengths: string[];
  improvements: string[];
  metrics: { name: string; stars: number; comment: string }[];
  nextActions: string[];
};

function coerceAnalyzeStringList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x ?? '').trim()).filter(Boolean);
  if (typeof v === 'string' && v.trim()) {
    return v
      .split(/\n+/)
      .map((s) => s.replace(/^[\d一二三四五六七八九十]+[、.)．]\s*/, '').trim())
      .filter(Boolean);
  }
  return [];
}

export function parseBusinessPlanAnalyzeFromStorage(result: string): BusinessPlanAnalyzeJson | null {
  const t = String(result || '').trim();
  if (!t) return null;
  try {
    const raw = JSON.parse(t) as Record<string, unknown>;
    const nested =
      raw.analysis && typeof raw.analysis === 'object' && !Array.isArray(raw.analysis)
        ? (raw.analysis as Record<string, unknown>)
        : raw;

    let score = Math.round(Number(nested.score ?? nested.Score ?? nested.qualityScore ?? 0));
    if (!Number.isFinite(score)) score = 0;
    score = Math.max(0, Math.min(100, score));

    const overall = String(nested.overall ?? nested.summary ?? nested.整体评价 ?? '').trim();
    const strengths = coerceAnalyzeStringList(nested.strengths ?? nested.优点 ?? nested.优点分析);
    const improvements = coerceAnalyzeStringList(nested.improvements ?? nested.改进建议 ?? nested.suggestions);
    const nextActions = coerceAnalyzeStringList(nested.nextActions ?? nested.下一步行动建议 ?? nested.actions);

    const mRaw = nested.metrics ?? nested.关键指标;
    let metrics: BusinessPlanAnalyzeJson['metrics'] = [];
    if (Array.isArray(mRaw)) {
      metrics = mRaw
        .map((m) => {
          if (!m || typeof m !== 'object') return null;
          const row = m as Record<string, unknown>;
          const name = String(row.name ?? row.title ?? row.指标 ?? '').trim();
          let stars = Math.round(Number(row.stars ?? row.star ?? row.score ?? 0));
          if (!Number.isFinite(stars)) stars = 0;
          stars = Math.max(0, Math.min(5, stars));
          const comment = String(row.comment ?? row.desc ?? row.简评 ?? '').trim();
          if (!name && !comment) return null;
          return { name: name || '指标', stars, comment };
        })
        .filter(Boolean) as BusinessPlanAnalyzeJson['metrics'];
    }

    const hasBody =
      overall.length >= 4 ||
      strengths.length > 0 ||
      improvements.length > 0 ||
      metrics.length > 0 ||
      nextActions.length > 0;
    if (!hasBody) return null;

    return { score, overall, strengths, improvements, metrics, nextActions };
  } catch {
    return null;
  }
}

export function businessPlanAnalyzeToEditorHtml(data: BusinessPlanAnalyzeJson): string {
  const scoreLabel = Number.isFinite(data.score) ? `${data.score}/100` : '';
  return `<h3>一、整体评价</h3>
<p>${data.overall || ''}${scoreLabel ? `（整体质量评分：${scoreLabel}）` : ''}</p>
<h3>二、优点分析</h3>
<ol>${(data.strengths || []).map((x) => `<li>${String(x || '')}</li>`).join('')}</ol>
<h3>三、改进建议</h3>
<ol>${(data.improvements || []).map((x) => `<li>${String(x || '')}</li>`).join('')}</ol>
<h3>四、关键指标评估</h3>
<ul>${(data.metrics || [])
  .map((m) => {
    const stars = Math.max(0, Math.min(5, Number(m?.stars || 0)));
    return `<li>${String(m?.name || '')}：${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}（${String(m?.comment || '')}）</li>`;
  })
  .join('')}</ul>
<h3>五、下一步行动建议</h3>
<ol>${(data.nextActions || []).map((x) => `<li>${String(x || '')}</li>`).join('')}</ol>`;
}

export async function analyzeBusinessPlanVersionStream(
  classId: string,
  body: { versionId: string },
  handlers: {
    onThinking?: (text: string) => void;
    onDone?: (payload: { analysis: BusinessPlanAnalyzeJson }) => void;
    onError?: (message: string) => void;
  }
) {
  await readSsePost(
    `/api/student/personal-classes/${encodeURIComponent(classId)}/business-plan/analyze/stream`,
    body,
    {
      onLog: undefined,
      onThinking: handlers.onThinking,
      onSection: undefined,
      onDone: (p) => handlers.onDone?.(p as any),
      onError: handlers.onError,
    }
  );
}

export async function listBusinessPlanAnalyses(classId: string): Promise<BusinessPlanAnalysis[]> {
  const data = await studentFetch<{ analyses: BusinessPlanAnalysis[] }>(
    `/api/student/personal-classes/${classId}/business-plan/analyses`
  );
  return data.analyses || [];
}

export async function submitBusinessPlan(
  classId: string,
  files: File[] = [],
  versionId?: string
): Promise<{ submission: BusinessPlanSubmission | null; trainingEnded: boolean }> {
  const { getPortalToken } = await import('./authApi');
  const fd = new FormData();
  if (versionId) fd.append('versionId', String(versionId));
  (files || []).forEach((f) => fd.append('files', f));
  const token = getPortalToken('student') || '';
  const r = await fetch(`/api/student/personal-classes/${classId}/business-plan/submit`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  const j = await r.json().catch(() => ({ code: -1, message: '无效 JSON' }));
  if (!r.ok || j.code !== 0) throw new Error(typeof j.message === 'string' ? j.message : `HTTP ${r.status}`);
  return j.data as { submission: BusinessPlanSubmission | null; trainingEnded: boolean };
}

export async function fetchBusinessPlanSubmissionStatus(classId: string): Promise<{
  submission: BusinessPlanSubmission | null;
  trainingEnded: boolean;
}> {
  return studentFetch(`/api/student/personal-classes/${classId}/business-plan/submission`);
}
