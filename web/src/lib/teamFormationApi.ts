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

export type TeamDimensionProfile = {
  strategic: number;
  market: number;
  techRisk: number;
};

export const TEAM_DIMENSION_BARS = [
  { key: 'strategic' as const, label: '战略统筹', color: 'from-violet-500 to-purple-500' },
  { key: 'market' as const, label: '市场运营', color: 'from-orange-400 to-amber-400' },
  { key: 'techRisk' as const, label: '技术风控', color: 'from-teal-500 to-cyan-500' },
];

export function normalizeTeamDimensionProfile(
  p: Partial<TeamDimensionProfile> & { techGeek?: number; designAesthetic?: number; businessOperator?: number }
): TeamDimensionProfile {
  if (
    typeof p.strategic === 'number' ||
    typeof p.market === 'number' ||
    typeof p.techRisk === 'number'
  ) {
    return {
      strategic: Math.round(Number(p.strategic) || 0),
      market: Math.round(Number(p.market) || 0),
      techRisk: Math.round(Number(p.techRisk) || 0),
    };
  }
  return {
    strategic: Math.round(Number(p.businessOperator) || 0),
    market: Math.round(Number(p.designAesthetic) || 0),
    techRisk: Math.round(Number(p.techGeek) || 0),
  };
}

export type TeamFormationSubmission = {
  status: string | null;
  answers: Record<string, string | string[]>;
  videoStorageKey: string | null;
  videoTranscript: string | null;
  aiMatchedRole: string | null;
  aiMatchedRoleLabel: string | null;
  dimensionProfile?: TeamDimensionProfile;
  analysisText?: string | null;
  submittedAt: string | null;
  groupingPreference?: 'pool' | 'solo' | null;
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
  /** 去掉末尾 JSON 后的分析正文，用于页面展示 */
  analysisText?: string;
  confidence?: number;
  dimensionProfile?: TeamDimensionProfile;
};

/** 流式拼接结果展示：去掉尾部 JSON 行 */
export function stripTeamAnalysisStreamDisplay(text: string): string {
  const t = String(text || '').trim();
  const idx = t.search(/\n\s*\{/);
  if (idx >= 0 && /dimensionScores|matchedRole/i.test(t.slice(idx))) {
    return t.slice(0, idx).trim();
  }
  return t.replace(/\n\{[\s\S]*"dimensionScores"[\s\S]*$/i, '').trim() || t;
}

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
        const msg = typeof data.message === 'string' ? data.message : '分析失败';
        handlers.onError?.(msg);
        throw new Error(msg);
      }
    }
  }
}

export async function submitTeamFormation(
  classId: string,
  groupingPreference: 'pool' | 'solo' = 'pool'
) {
  return portalAuthenticatedFetch('student', '/api/student/team-formation/submit', {
    method: 'POST',
    body: JSON.stringify({ classId, groupingPreference }),
  }) as Promise<{
    status: string;
    groupingPreference?: 'pool' | 'solo';
    teamId?: string;
    solo?: boolean;
  }>;
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

export type GroupingTeamMember = {
  id: string;
  name: string;
  studentId: string;
  avatarUrl?: string;
  hasIntroVideo?: boolean;
  aiMatchedRole?: string;
  aiMatchedRoleLabel?: string;
  isTeamLeader?: boolean;
  profile: TeamDimensionProfile;
  status: string;
};

export async function loadTeamIntroVideoObjectUrl(
  role: 'student' | 'teacher',
  classId: string,
  studentId?: string
): Promise<string> {
  const { getPortalToken, redirectStudentSessionExpired, redirectTeacherSessionExpired } = await import('./authApi');
  const token = getPortalToken(role) || '';
  const url =
    role === 'student'
      ? `/api/student/team-formation/video?classId=${encodeURIComponent(classId)}`
      : `/api/teacher/personal-classes/${encodeURIComponent(classId)}/team-formation/students/${encodeURIComponent(studentId || '')}/intro-video`;
  const r = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (r.status === 401) {
    if (role === 'student') redirectStudentSessionExpired();
    else redirectTeacherSessionExpired();
    throw new Error('登录已失效');
  }
  if (!r.ok) {
    const j = await r.json().catch(() => ({ message: '' }));
    throw new Error((j as { message?: string }).message || `HTTP ${r.status}`);
  }
  const blob = await r.blob();
  return URL.createObjectURL(blob);
}

export type GroupingTeam = {
  id: string;
  name: string;
  introduction?: string;
  leaderStudentId?: string | null;
  groupingStatus?: string;
  isSolo?: boolean;
  complementScore: number | null;
  aiRationale?: string;
  createdAt?: string;
  members: GroupingTeamMember[];
  avgProfile: TeamDimensionProfile;
};

export async function updateStudentMyTeamProfile(
  classId: string,
  payload: { name: string; introduction: string }
) {
  return portalAuthenticatedFetch('student', '/api/student/team-formation/my-team', {
    method: 'PATCH',
    body: JSON.stringify({ classId, ...payload }),
  }) as Promise<GroupingTeam | null>;
}

export type TeacherGroupingState = {
  pendingStudents: GroupingTeamMember[];
  teams: GroupingTeam[];
  minPendingForAi?: number;
  needsRandomConfirm?: boolean;
  remainderCount?: number;
  remainderStudents?: Array<{
    id: string;
    name: string;
    aiMatchedRole?: string;
    aiMatchedRoleLabel?: string;
  }>;
};

export async function fetchTeacherGrouping(classId: string): Promise<TeacherGroupingState> {
  const data = await portalAuthenticatedFetch(
    'teacher',
    `/api/teacher/personal-classes/${encodeURIComponent(classId)}/team-formation/grouping`
  );
  return data as TeacherGroupingState;
}

export type TeacherAiGroupStreamHandlers = {
  onStatus?: (message: string) => void;
  onThinking?: (text: string) => void;
  onContent?: (text: string) => void;
  onDone?: (data: TeacherGroupingState) => void;
  onError?: (message: string) => void;
};

/** 流式 AI 智能组队（思考过程经 SSE 推送，页面通常仅展示最终分组结果） */
export async function postTeacherAiGroupStream(classId: string, handlers: TeacherAiGroupStreamHandlers) {
  const { getPortalToken, redirectTeacherSessionExpired } = await import('./authApi');
  const token = getPortalToken('teacher') || '';
  const r = await fetch(
    `/api/teacher/personal-classes/${encodeURIComponent(classId)}/team-formation/ai-group`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ stream: true }),
    }
  );

  if (r.status === 401) {
    redirectTeacherSessionExpired();
    throw new Error('登录已失效');
  }
  if (!r.ok) {
    const j = await r.json().catch(() => ({ message: '' }));
    throw new Error((j as { message?: string }).message || `HTTP ${r.status}`);
  }

  const reader = r.body?.getReader();
  if (!reader) throw new Error('无法读取组队流');

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
        handlers.onDone?.(data as unknown as TeacherGroupingState);
      } else if (currentEvent === 'error') {
        const msg = typeof data.message === 'string' ? data.message : 'AI 组队失败';
        handlers.onError?.(msg);
        throw new Error(msg);
      }
    }
  }
}

export async function confirmTeacherAiGroupRandom(classId: string): Promise<TeacherGroupingState> {
  return portalAuthenticatedFetch(
    'teacher',
    `/api/teacher/personal-classes/${encodeURIComponent(classId)}/team-formation/ai-group/confirm-random`,
    { method: 'POST', body: JSON.stringify({}) }
  ) as Promise<TeacherGroupingState>;
}

/** @deprecated 请使用 postTeacherAiGroupStream */
export async function postTeacherAiGroup(classId: string) {
  return new Promise<TeacherGroupingState>((resolve, reject) => {
    void postTeacherAiGroupStream(classId, {
      onDone: resolve,
      onError: reject,
    }).catch(reject);
  });
}

export async function setTeacherTeamLeader(classId: string, teamId: string, studentId: string) {
  return portalAuthenticatedFetch(
    'teacher',
    `/api/teacher/personal-classes/${encodeURIComponent(classId)}/team-formation/teams/${encodeURIComponent(teamId)}/leader`,
    { method: 'PUT', body: JSON.stringify({ studentId }) }
  ) as Promise<TeacherGroupingState>;
}

export async function removeTeamMember(classId: string, teamId: string, studentId: string) {
  return portalAuthenticatedFetch(
    'teacher',
    `/api/teacher/personal-classes/${encodeURIComponent(classId)}/team-formation/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(studentId)}`,
    { method: 'DELETE' }
  ) as Promise<TeacherGroupingState>;
}

export async function addTeamMember(classId: string, teamId: string, studentId: string) {
  return portalAuthenticatedFetch(
    'teacher',
    `/api/teacher/personal-classes/${encodeURIComponent(classId)}/team-formation/teams/${encodeURIComponent(teamId)}/members`,
    { method: 'POST', body: JSON.stringify({ studentId }) }
  ) as Promise<TeacherGroupingState>;
}

export async function notifyTeacherTeamStudents(classId: string) {
  return portalAuthenticatedFetch(
    'teacher',
    `/api/teacher/personal-classes/${encodeURIComponent(classId)}/team-formation/confirm`,
    { method: 'POST', body: JSON.stringify({ mode: 'notify' }) }
  ) as Promise<TeacherGroupingState & { notifiedCount?: number }>;
}

export async function fetchStudentMyTeam(classId: string) {
  return portalAuthenticatedFetch(
    'student',
    `/api/student/team-formation/my-team?classId=${encodeURIComponent(classId)}`
  );
}

export async function fetchStudentTeamSquare(classId: string) {
  const data = await portalAuthenticatedFetch(
    'student',
    `/api/student/team-formation/team-square?classId=${encodeURIComponent(classId)}`
  );
  return Array.isArray(data) ? data : [];
}

export type StudentNotificationRow = {
  id: string;
  type: string;
  title: string;
  content: string;
  relatedModule: string;
  relatedLink: string;
  isRead: boolean;
  timestamp: string;
  sender: { name: string };
  attachments?: { id: string; fileName: string; fileSize: number }[];
};

export async function fetchStudentNotifications(): Promise<StudentNotificationRow[]> {
  const data = await portalAuthenticatedFetch('student', '/api/student/notifications');
  return Array.isArray(data) ? (data as StudentNotificationRow[]) : [];
}

export async function markStudentNotificationRead(id: string) {
  return portalAuthenticatedFetch('student', `/api/student/notifications/${encodeURIComponent(id)}/read`, {
    method: 'PATCH',
  });
}
