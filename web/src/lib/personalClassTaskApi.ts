import { getPortalToken } from './authApi';
import { teacherFetch } from '../pages/teacher-dashboard/teacherPortalApi';

export const TASK_MODULE_TO_TRAINING_ID: Record<string, string> = {
  创新思维与创意生成: 'ideation',
  市场调研与用户画像: 'market',
  产品设计与迭代: 'product',
  商业模式设计: 'business',
  AI仿真模拟: 'simulation',
  商业计划书要点: 'plan',
};

export const TRAINING_ID_TO_TAB: Record<string, string> = {
  ideation: 'module-ideation',
  market: 'module-market',
  product: 'module-product',
  business: 'module-business',
  simulation: 'module-simulation',
  plan: 'module-plan',
};

export type StudentTodoTask = {
  id: string;
  title: string;
  module: string;
  moduleId: string | null;
  priority: TaskPriority;
  deadline: string;
  daysLeft: number;
  status: string;
  attachments: TaskAttachment[];
  resourceLinkEnabled: boolean;
  resourceNodes: TaskResourceNode[];
};

export async function fetchStudentTodoTasks(classId: string): Promise<{
  tasks: StudentTodoTask[];
  completedTasks?: StudentTodoTask[];
  completedKnowledgePointIds?: string[];
}> {
  const { portalAuthenticatedFetch } = await import('./authApi');
  return portalAuthenticatedFetch('student', `/api/student/personal-classes/${classId}/tasks/todos`) as Promise<{
    tasks: StudentTodoTask[];
    completedTasks?: StudentTodoTask[];
    completedKnowledgePointIds?: string[];
  }>;
}

export async function completeStudentTodoTask(classId: string, taskId: string): Promise<void> {
  const { portalAuthenticatedFetch } = await import('./authApi');
  await portalAuthenticatedFetch('student', `/api/student/personal-classes/${classId}/tasks/${taskId}/complete`, {
    method: 'POST',
  });
}

export async function downloadStudentTaskAttachment(classId: string, taskId: string, attachmentId: string, fileName: string) {
  const token = getPortalToken('student') || '';
  const r = await fetch(
    `/api/student/personal-classes/${classId}/tasks/${taskId}/attachments/${attachmentId}/download`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} }
  );
  if (!r.ok) {
    const j = await r.json().catch(() => ({ message: `HTTP ${r.status}` }));
    throw new Error(typeof j.message === 'string' ? j.message : `HTTP ${r.status}`);
  }
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || '附件';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const TASK_MODULES = [
  '创新思维与创意生成',
  '市场调研与用户画像',
  '产品设计与迭代',
  '商业模式设计',
  'AI仿真模拟',
  '商业计划书要点',
] as const;

export type TaskPriority = 'urgent' | 'high' | 'normal' | 'low';

export const TASK_PRIORITY_OPTIONS: { value: TaskPriority; label: string; hint: string }[] = [
  { value: 'urgent', label: '紧急', hint: '高优，需尽快完成' },
  { value: 'high', label: '较紧急', hint: '中高优先级' },
  { value: 'normal', label: '一般', hint: '常规任务' },
  { value: 'low', label: '不紧急', hint: '低优，可延后' },
];

export type TaskTeamProgress = {
  teamId: string;
  teamName: string;
  completed: number;
  total: number;
};

export type TaskAttachment = {
  id: string;
  fileName: string;
  fileSize: number;
  size: string;
  storageKey: string;
};

export type TaskResourceKnowledgePoint = {
  id: string;
  title: string;
  description: string;
  moduleKey: string;
  moduleName: string;
  sortOrder: number;
};

export type TaskResourceFile = {
  id: string;
  nodeId: string;
  name: string;
  type: 'video' | 'audio' | 'pdf' | 'image' | 'archive' | 'case';
  previewType?: 'video' | 'audio' | 'pdf' | 'image' | 'archive' | 'file';
  previewStatus?: string;
  contentHash?: string;
  mimeType: string;
  sizeBytes: number;
  size: string;
  canPreview: boolean;
  progress?: {
    progressPercent: number;
    lastPosition: Record<string, unknown>;
    completed: boolean;
  };
};

export type TaskResourceNodeAncestor = {
  id: string;
  parentId: string | null;
  level: number;
  moduleKey: string;
  moduleName: string;
  title: string;
  status: string;
  sortOrder: number;
};

export type TaskResourceNode = {
  id: string;
  parentId: string | null;
  level: number;
  moduleKey: string;
  moduleName: string;
  title: string;
  status: string;
  sortOrder: number;
  ancestors: TaskResourceNodeAncestor[];
  resources: TaskResourceFile[];
  knowledgePoints: TaskResourceKnowledgePoint[];
};

export type PersonalClassTask = {
  id: string;
  title: string;
  description: string;
  module: string;
  priority: TaskPriority;
  deadline: string;
  scope: 'all' | 'specific';
  status: 'published' | 'draft' | 'expired';
  attachmentsEnabled: boolean;
  resourceLinkEnabled: boolean;
  resourceNodeIds: string[];
  resourceNodes: TaskResourceNode[];
  publishedAt: string;
  publishedBy: string;
  attachments: TaskAttachment[];
  targetTeamIds: string[];
  teamProgress: TaskTeamProgress[];
  completedCount: number;
  totalTargets: number;
};

export type TeamForTask = { id: string; name: string; memberCount: number };

export async function listPersonalClassTasks(classId: string): Promise<{
  tasks: PersonalClassTask[];
  modules: string[];
}> {
  return teacherFetch(`/api/teacher/personal-classes/${classId}/tasks`) as Promise<{
    tasks: PersonalClassTask[];
    modules: string[];
  }>;
}

export async function getPersonalClassTask(classId: string, taskId: string): Promise<PersonalClassTask> {
  return teacherFetch(`/api/teacher/personal-classes/${classId}/tasks/${taskId}`) as Promise<PersonalClassTask>;
}

export async function createPersonalClassTask(
  classId: string,
  body: Record<string, unknown>
): Promise<PersonalClassTask> {
  return teacherFetch(`/api/teacher/personal-classes/${classId}/tasks`, {
    method: 'POST',
    body: JSON.stringify(body),
  }) as Promise<PersonalClassTask>;
}

export async function updatePersonalClassTask(
  classId: string,
  taskId: string,
  body: Record<string, unknown>
): Promise<PersonalClassTask> {
  return teacherFetch(`/api/teacher/personal-classes/${classId}/tasks/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  }) as Promise<PersonalClassTask>;
}

export async function deletePersonalClassTask(classId: string, taskId: string): Promise<void> {
  await teacherFetch(`/api/teacher/personal-classes/${classId}/tasks/${taskId}`, { method: 'DELETE' });
}

export async function listTeamsForTask(classId: string): Promise<{ teams: TeamForTask[] }> {
  return teacherFetch(`/api/teacher/personal-classes/${classId}/teams-for-task`) as Promise<{
    teams: TeamForTask[];
  }>;
}

export async function uploadTaskAttachment(classId: string, taskId: string, file: File) {
  const fd = new FormData();
  fd.append('file', file);
  const token = getPortalToken('teacher') || '';
  const r = await fetch(
    `/api/teacher/personal-classes/${classId}/tasks/${taskId}/attachments`,
    {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    }
  );
  const j = await r.json().catch(() => ({ code: -1, message: '无效 JSON' }));
  if (!r.ok || j.code !== 0) throw new Error(typeof j.message === 'string' ? j.message : `HTTP ${r.status}`);
  return j.data as TaskAttachment;
}

export async function deleteTaskAttachment(
  classId: string,
  taskId: string,
  attachmentId: string
): Promise<void> {
  await teacherFetch(
    `/api/teacher/personal-classes/${classId}/tasks/${taskId}/attachments/${attachmentId}`,
    { method: 'DELETE' }
  );
}
