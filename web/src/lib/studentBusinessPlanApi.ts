import { portalAuthenticatedFetch } from './authApi';

export type BusinessPlanSection = {
  key: string;
  title: string;
  content: string;
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
};

export type BusinessPlanWorkspace = {
  sections: BusinessPlanSection[];
  fullText: string;
  completedSectionCount: number;
  totalSectionCount: number;
  updatedAt: string;
  updatedByName: string;
  versions: BusinessPlanVersionSummary[];
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
  sections: BusinessPlanSection[]
): Promise<BusinessPlanWorkspace> {
  return studentFetch(`/api/student/personal-classes/${classId}/business-plan/workspace`, {
    method: 'PUT',
    body: JSON.stringify({ sections }),
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
  body: { sectionKey: string; mode: 'overwrite' | 'expand'; sections: BusinessPlanSection[] }
): Promise<BusinessPlanWorkspace> {
  return studentFetch(`/api/student/personal-classes/${classId}/business-plan/sections/fill`, {
    method: 'POST',
    body: JSON.stringify(body),
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
  versionId: string,
  files: File[] = []
): Promise<{ submission: BusinessPlanSubmission | null; trainingEnded: boolean }> {
  const { getPortalToken } = await import('./authApi');
  const fd = new FormData();
  fd.append('versionId', String(versionId));
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
