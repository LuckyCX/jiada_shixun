import { portalAuthenticatedFetch } from './authApi';

export type TeamQuestionType = 'single' | 'multi' | 'short';

export type TeamQuestion = {
  id: string;
  sortOrder: number;
  title: string;
  questionType: TeamQuestionType;
  options: { label: string; value: string }[];
  required: boolean;
};

export type TeamFormationSubmission = {
  status: string | null;
  answers: Record<string, string | string[]>;
  videoStorageKey: string | null;
  videoTranscript: string | null;
  aiMatchedRole: string | null;
  aiMatchedRoleLabel: string | null;
  submittedAt: string | null;
};

export type TeamRoleKey =
  | 'ceo'
  | 'product_rd'
  | 'market_director'
  | 'marketing_ops'
  | 'sales'
  | 'finance';

export const TEAM_ROLE_LABELS: Record<TeamRoleKey, string> = {
  ceo: '项目 CEO / 创始人',
  product_rd: '产品 / 研发负责人',
  market_director: '市场总监',
  marketing_ops: '营销运营官',
  sales: '销售负责人',
  finance: '财务负责人',
};

export function isTeamFormationDone(status: string | null | undefined): boolean {
  return status === 'pending_teacher' || status === 'grouped' || status === 'confirmed';
}

export async function fetchTeamQuestions(classId: string): Promise<TeamQuestion[]> {
  const data = await portalAuthenticatedFetch('student', `/api/student/team-formation/questions?classId=${encodeURIComponent(classId)}`);
  return Array.isArray(data) ? (data as TeamQuestion[]) : [];
}

export async function fetchTeamSubmission(classId: string): Promise<TeamFormationSubmission> {
  const data = await portalAuthenticatedFetch(
    'student',
    `/api/student/team-formation/submission?classId=${encodeURIComponent(classId)}`
  );
  return data as TeamFormationSubmission;
}

export async function saveTeamAnswers(classId: string, answers: Record<string, string | string[]>) {
  return portalAuthenticatedFetch('student', '/api/student/team-formation/answers', {
    method: 'PUT',
    body: JSON.stringify({ classId, answers }),
  });
}

export async function uploadTeamVideo(classId: string, file: File) {
  const fd = new FormData();
  fd.append('classId', classId);
  fd.append('video', file);
  const token = (await import('./authApi')).getPortalToken('student') || '';
  const r = await fetch('/api/student/team-formation/video', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  const j = await r.json().catch(() => ({ code: -1, message: '无效 JSON' }));
  if (r.status === 401 || j.code === 40101 || j.code === 40102) {
    (await import('./authApi')).redirectStudentSessionExpired();
    throw new Error(j.message || '登录已失效');
  }
  if (!r.ok || j.code !== 0) throw new Error(j.message || `HTTP ${r.status}`);
  return j.data as { videoStorageKey: string; fileName: string };
}

export type TeamAnalyzeResult = {
  aiMatchedRole: TeamRoleKey;
  aiMatchedRoleLabel: string;
  videoTranscript: string;
  summary: string;
  confidence?: number;
};

export type TeamAnalyzeStreamHandlers = {
  onStatus?: (message: string) => void;
  onThinking?: (text: string) => void;
  onContent?: (text: string) => void;
  onDone?: (data: TeamAnalyzeResult) => void;
  onError?: (message: string) => void;
};

/** 流式综合分析（问卷 + 视频） */
export async function analyzeTeamFormationStream(classId: string, handlers: TeamAnalyzeStreamHandlers) {
  const { getPortalToken, redirectStudentSessionExpired } = await import('./authApi');
  const token = getPortalToken('student') || '';
  const r = await fetch('/api/student/team-formation/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ classId, stream: true }),
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
  if (!reader) throw new Error('无法读取分析流');

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
        handlers.onDone?.(data as unknown as TeamAnalyzeResult);
      } else if (currentEvent === 'error') {
        handlers.onError?.(typeof data.message === 'string' ? data.message : '分析失败');
      }
    }
  }
}

export async function submitTeamFormation(classId: string) {
  return portalAuthenticatedFetch('student', '/api/student/team-formation/submit', {
    method: 'POST',
    body: JSON.stringify({ classId }),
  });
}

/** 清空答题与 AI 结果，保留已上传视频 */
export async function resetTeamAssessment(classId: string) {
  return portalAuthenticatedFetch('student', '/api/student/team-formation/reset-assessment', {
    method: 'POST',
    body: JSON.stringify({ classId }),
  });
}

/** 删除已上传视频及关联 AI 结果 */
export async function deleteTeamVideo(classId: string) {
  return portalAuthenticatedFetch(
    'student',
    `/api/student/team-formation/video?classId=${encodeURIComponent(classId)}`,
    { method: 'DELETE' }
  );
}

export async function fetchTeacherTeamQuestions(classId: string): Promise<TeamQuestion[]> {
  const data = await portalAuthenticatedFetch(
    'teacher',
    `/api/teacher/personal-classes/${encodeURIComponent(classId)}/team-questions`
  );
  return Array.isArray(data) ? (data as TeamQuestion[]) : [];
}

export async function saveTeacherTeamQuestions(classId: string, questions: unknown[]) {
  return portalAuthenticatedFetch(
    'teacher',
    `/api/teacher/personal-classes/${encodeURIComponent(classId)}/team-questions`,
    { method: 'PUT', body: JSON.stringify({ questions }) }
  );
}

export async function fetchTeacherPendingTeamStudents(classId: string) {
  const data = await portalAuthenticatedFetch(
    'teacher',
    `/api/teacher/personal-classes/${encodeURIComponent(classId)}/team-formation/pending-students`
  );
  return Array.isArray(data) ? data : [];
}
