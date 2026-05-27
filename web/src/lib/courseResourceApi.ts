import { getPortalToken, portalAuthenticatedFetch } from './authApi';
import type { QuizConfig } from '../mocks/quizBank';

export type CourseResourceModule = {
  key: string;
  name: string;
  shortName: string;
  color: string;
};

export type CourseResourceFile = {
  id: string;
  nodeId: string;
  name: string;
  type: 'video' | 'audio' | 'pdf' | 'image' | 'archive' | 'case';
  mimeType: string;
  previewType?: 'video' | 'audio' | 'pdf' | 'image' | 'archive' | 'file';
  previewStatus?: string;
  contentHash?: string;
  sizeBytes: number;
  size: string;
  uploadTime: string;
  canPreview: boolean;
  progress?: {
    progressPercent: number;
    lastPosition: Record<string, unknown>;
    completed: boolean;
  };
};

export type CourseKnowledgePoint = {
  id: string;
  title: string;
  description: string;
  moduleKey: string;
  moduleName: string;
  status: string;
  sortOrder: number;
};

export type CourseResourceNode = {
  id: string;
  moduleKey: string;
  moduleName: string;
  parentId: string | null;
  level: 1 | 2 | 3;
  title: string;
  status: 'draft' | 'published';
  sortOrder: number;
  resources: CourseResourceFile[];
  knowledgePoints: Pick<CourseKnowledgePoint, 'id' | 'title'>[];
  children: CourseResourceNode[];
};

export type CourseQuizQuestion = {
  id: string;
  type: 'single' | 'multiple' | 'short';
  question: string;
  options: string[];
  correctAnswer?: number | number[];
  keywords: string[];
  score: number;
  explanation: string;
};

export type CourseResourcePayload = {
  modules: CourseResourceModule[];
  nodes: CourseResourceNode[];
  knowledgePoints: CourseKnowledgePoint[];
};

function teacherFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  return portalAuthenticatedFetch('teacher', path, opts) as Promise<T>;
}

function studentFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  return portalAuthenticatedFetch('student', path, opts) as Promise<T>;
}

export async function listCourseResources(moduleKey: string): Promise<CourseResourcePayload> {
  const q = new URLSearchParams({ moduleKey });
  return teacherFetch<CourseResourcePayload>(`/api/teacher/course-resources?${q}`);
}

export async function createCourseResourceNode(body: {
  moduleKey: string;
  title: string;
  parentId?: string | null;
}): Promise<{ node: CourseResourceNode }> {
  return teacherFetch('/api/teacher/course-resources/nodes', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function deleteCourseResourceNode(nodeId: string): Promise<void> {
  await teacherFetch(`/api/teacher/course-resources/nodes/${nodeId}`, { method: 'DELETE' });
}

export async function updateCourseResourceNodeStatus(nodeId: string, status: 'draft' | 'published'): Promise<void> {
  await teacherFetch(`/api/teacher/course-resources/nodes/${nodeId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function saveNodeKnowledgePoints(nodeId: string, knowledgePointIds: string[]): Promise<void> {
  await teacherFetch(`/api/teacher/course-resources/nodes/${nodeId}/knowledge-points`, {
    method: 'PUT',
    body: JSON.stringify({ knowledgePointIds }),
  });
}

export async function uploadCourseResourceFile(nodeId: string, file: File): Promise<CourseResourceFile> {
  const fd = new FormData();
  fd.append('file', file);
  const token = getPortalToken('teacher') || '';
  const r = await fetch(`/api/teacher/course-resources/nodes/${nodeId}/resources`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  const j = await r.json().catch(() => ({ code: -1, message: '无效 JSON' }));
  if (!r.ok || j.code !== 0) throw new Error(typeof j.message === 'string' ? j.message : `HTTP ${r.status}`);
  return j.data.resource as CourseResourceFile;
}

export async function deleteCourseResourceFile(resourceId: string): Promise<void> {
  await teacherFetch(`/api/teacher/course-resources/resources/${resourceId}`, { method: 'DELETE' });
}

export function courseResourceFileUrl(resourceId: string, mode: 'preview' | 'download'): string {
  const token = getPortalToken('teacher') || '';
  const q = token ? `?token=${encodeURIComponent(token)}` : '';
  return `/api/teacher/course-resources/resources/${resourceId}/${mode}${q}`;
}

export function studentCourseResourceFileUrl(resourceId: string, mode: 'preview' | 'download', tokenOverride?: string): string {
  const token = tokenOverride ?? getPortalToken('student') ?? '';
  const q = token ? `?token=${encodeURIComponent(token)}` : '';
  return `/api/student/course-resources/resources/${resourceId}/${mode}${q}`;
}

export async function fetchStudentResourceProgress(resourceId: string): Promise<NonNullable<CourseResourceFile['progress']>> {
  const data = await studentFetch<{ progress: NonNullable<CourseResourceFile['progress']> }>(
    `/api/student/course-resources/resources/${resourceId}/progress`
  );
  return data.progress;
}

export async function saveStudentResourceProgress(
  resourceId: string,
  body: { progressPercent: number; lastPosition?: Record<string, unknown>; completed?: boolean }
): Promise<NonNullable<CourseResourceFile['progress']>> {
  const data = await studentFetch<{ progress: NonNullable<CourseResourceFile['progress']> }>(
    `/api/student/course-resources/resources/${resourceId}/progress`,
    {
      method: 'PUT',
      body: JSON.stringify(body),
    }
  );
  return data.progress;
}

export async function listCourseKnowledgePoints(moduleKey: string): Promise<CourseKnowledgePoint[]> {
  const q = new URLSearchParams({ moduleKey });
  const data = await teacherFetch<{ knowledgePoints: CourseKnowledgePoint[] }>(`/api/teacher/course-resources/knowledge-points?${q}`);
  return data.knowledgePoints;
}

export async function createCourseKnowledgePoint(body: {
  moduleKey: string;
  title: string;
  description?: string;
}): Promise<CourseKnowledgePoint> {
  const data = await teacherFetch<{ knowledgePoint: CourseKnowledgePoint }>('/api/teacher/course-resources/knowledge-points', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return data.knowledgePoint;
}

export async function updateCourseKnowledgePoint(
  knowledgeId: string,
  body: { title: string; description?: string }
): Promise<CourseKnowledgePoint> {
  const data = await teacherFetch<{ knowledgePoint: CourseKnowledgePoint }>(
    `/api/teacher/course-resources/knowledge-points/${knowledgeId}`,
    {
      method: 'PUT',
      body: JSON.stringify(body),
    }
  );
  return data.knowledgePoint;
}

export async function deleteCourseKnowledgePoint(knowledgeId: string): Promise<void> {
  await teacherFetch(`/api/teacher/course-resources/knowledge-points/${knowledgeId}`, { method: 'DELETE' });
}

export async function listCourseQuizQuestions(knowledgeId: string): Promise<CourseQuizQuestion[]> {
  const data = await teacherFetch<{ questions: CourseQuizQuestion[] }>(
    `/api/teacher/course-resources/knowledge-points/${knowledgeId}/questions`
  );
  return data.questions;
}

export async function createCourseQuizQuestion(
  knowledgeId: string,
  body: Omit<CourseQuizQuestion, 'id'>
): Promise<CourseQuizQuestion> {
  const data = await teacherFetch<{ question: CourseQuizQuestion }>(
    `/api/teacher/course-resources/knowledge-points/${knowledgeId}/questions`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  );
  return data.question;
}

export async function updateCourseQuizQuestion(
  knowledgeId: string,
  questionId: string,
  body: Omit<CourseQuizQuestion, 'id'>
): Promise<CourseQuizQuestion> {
  const data = await teacherFetch<{ question: CourseQuizQuestion }>(
    `/api/teacher/course-resources/knowledge-points/${knowledgeId}/questions/${questionId}`,
    {
      method: 'PUT',
      body: JSON.stringify(body),
    }
  );
  return data.question;
}

export async function deleteCourseQuizQuestion(knowledgeId: string, questionId: string): Promise<void> {
  await teacherFetch(`/api/teacher/course-resources/knowledge-points/${knowledgeId}/questions/${questionId}`, { method: 'DELETE' });
}

export async function fetchStudentCourseResources(moduleKey: string): Promise<{
  modules: CourseResourceModule[];
  nodes: CourseResourceNode[];
}> {
  const q = new URLSearchParams({ moduleKey });
  return studentFetch(`/api/student/course-resources?${q}`);
}

export async function fetchStudentKnowledgeQuiz(knowledgeId: string): Promise<QuizConfig> {
  const data = await studentFetch<{ config: QuizConfig }>(
    `/api/student/course-resources/knowledge-points/${knowledgeId}/quiz`
  );
  return data.config;
}

export async function submitStudentKnowledgeQuizAttempt(
  knowledgeId: string,
  body: { score: number; answers: Record<string, number | number[] | string> }
): Promise<{ passed: boolean }> {
  return studentFetch(`/api/student/course-resources/knowledge-points/${knowledgeId}/quiz-attempts`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchStudentPassedKnowledgePointIds(
  knowledgePointIds: string[]
): Promise<string[]> {
  if (!knowledgePointIds.length) return [];
  const data = await studentFetch<{ passedKnowledgePointIds: string[] }>(
    `/api/student/course-resources/knowledge-points/passed-ids`,
    {
      method: 'POST',
      body: JSON.stringify({ knowledgePointIds }),
    }
  );
  return data.passedKnowledgePointIds || [];
}
