import { getPortalToken, portalAuthenticatedFetch } from './authApi';
import { teacherFetch } from '../pages/teacher-dashboard/teacherPortalApi';

export type InstanceLibraryResource = {
  id: string;
  caseId: string;
  usage: 'attachment' | 'inline';
  originName: string;
  mimeType: string;
  sizeBytes: number;
  size: string;
  resourceType: string;
  canPreview: boolean;
  createdAt: string;
};

export type InstanceLibraryCase = {
  id: string;
  categoryId: string;
  title: string;
  detailHtml: string;
  tags: string[];
  projectOutcome: string;
  sortOrder: number;
  hasCoverImage?: boolean;
  resources: InstanceLibraryResource[];
  createdAt: string;
  updatedAt: string;
};

export type InstanceLibraryCategory = {
  id: string;
  name: string;
  icon: string;
  color: string;
  sortOrder: number;
  cases: InstanceLibraryCase[];
  createdAt: string;
  updatedAt: string;
};

export type InstanceLibraryPayload = {
  categories: InstanceLibraryCategory[];
};

export type SaveInstanceCategoryInput = {
  name: string;
  icon: string;
  color: string;
  sortOrder?: number;
};

export type SaveInstanceCaseInput = {
  categoryId: string;
  title: string;
  detailHtml: string;
  tags: string[];
  projectOutcome: string;
  sortOrder?: number;
};

function assertJsonResponse(r: Response, j: { code?: number; message?: string; data?: unknown }) {
  if (!r.ok || j.code !== 0) {
    throw new Error(typeof j.message === 'string' ? j.message : `HTTP ${r.status}`);
  }
  return j.data;
}

export async function fetchTeacherInstanceLibrary(moduleKey = 'ideation'): Promise<InstanceLibraryPayload> {
  const q = new URLSearchParams({ moduleKey });
  return teacherFetch(`/api/teacher/instance-library?${q}`) as Promise<InstanceLibraryPayload>;
}

export async function createInstanceCategory(
  input: SaveInstanceCategoryInput,
  moduleKey = 'ideation'
): Promise<InstanceLibraryCategory> {
  return teacherFetch('/api/teacher/instance-library/categories', {
    method: 'POST',
    body: JSON.stringify({ ...input, moduleKey }),
  }) as Promise<InstanceLibraryCategory>;
}

export async function updateInstanceCategory(categoryId: string, input: SaveInstanceCategoryInput): Promise<InstanceLibraryCategory> {
  return teacherFetch(`/api/teacher/instance-library/categories/${categoryId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  }) as Promise<InstanceLibraryCategory>;
}

export async function deleteInstanceCategory(categoryId: string): Promise<{ deleted: boolean }> {
  return teacherFetch(`/api/teacher/instance-library/categories/${categoryId}`, { method: 'DELETE' }) as Promise<{ deleted: boolean }>;
}

export async function createInstanceCase(categoryId: string, input: Omit<SaveInstanceCaseInput, 'categoryId'>): Promise<InstanceLibraryCase> {
  return teacherFetch(`/api/teacher/instance-library/categories/${categoryId}/cases`, {
    method: 'POST',
    body: JSON.stringify(input),
  }) as Promise<InstanceLibraryCase>;
}

export async function updateInstanceCase(caseId: string, input: SaveInstanceCaseInput): Promise<InstanceLibraryCase> {
  return teacherFetch(`/api/teacher/instance-library/cases/${caseId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  }) as Promise<InstanceLibraryCase>;
}

export async function deleteInstanceCase(caseId: string): Promise<{ deleted: boolean }> {
  return teacherFetch(`/api/teacher/instance-library/cases/${caseId}`, { method: 'DELETE' }) as Promise<{ deleted: boolean }>;
}

export async function uploadInstanceCaseResource(caseId: string, file: File): Promise<InstanceLibraryResource> {
  const token = getPortalToken('teacher') || '';
  const form = new FormData();
  form.append('file', file);
  form.append('usage', 'attachment');
  const r = await fetch(`/api/teacher/instance-library/cases/${caseId}/resources`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const j = await r.json().catch(() => ({ code: -1, message: '无效 JSON' }));
  return assertJsonResponse(r, j) as InstanceLibraryResource;
}

export async function uploadInstanceCaseCover(caseId: string, file: File): Promise<InstanceLibraryCase> {
  const token = getPortalToken('teacher') || '';
  const form = new FormData();
  form.append('file', file);
  const r = await fetch(`/api/teacher/instance-library/cases/${encodeURIComponent(caseId)}/cover`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const j = (await r.json().catch(() => ({ code: -1, message: '无效 JSON' }))) as {
    code?: number;
    message?: string;
    data?: InstanceLibraryCase;
  };
  if (!r.ok || j.code !== 0) {
    throw new Error(typeof j.message === 'string' ? j.message : `HTTP ${r.status}`);
  }
  if (!j.data) throw new Error('无效响应');
  return j.data;
}

export async function deleteInstanceCaseCover(caseId: string): Promise<InstanceLibraryCase> {
  return teacherFetch(`/api/teacher/instance-library/cases/${encodeURIComponent(caseId)}/cover`, {
    method: 'DELETE',
  }) as Promise<InstanceLibraryCase>;
}

export async function deleteInstanceCaseResource(resourceId: string): Promise<{ deleted: boolean }> {
  return teacherFetch(`/api/teacher/instance-library/resources/${resourceId}`, { method: 'DELETE' }) as Promise<{ deleted: boolean }>;
}

export async function fetchStudentInstanceLibrary(
  classId: string,
  moduleKey = 'ideation'
): Promise<InstanceLibraryPayload> {
  const q = new URLSearchParams({ moduleKey });
  return portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/instance-library?${q}`
  ) as Promise<InstanceLibraryPayload>;
}

export function getTeacherInstanceResourcePreviewUrl(resourceId: string): string {
  const token = getPortalToken('teacher') || '';
  const q = token ? `?token=${encodeURIComponent(token)}` : '';
  return `/api/teacher/instance-library/resources/${resourceId}/preview${q}`;
}

export function getTeacherInstanceCaseCoverUrl(caseId: string): string {
  const token = getPortalToken('teacher') || '';
  const q = token ? `?token=${encodeURIComponent(token)}` : '';
  return `/api/teacher/instance-library/cases/${encodeURIComponent(caseId)}/cover${q}`;
}

export function getStudentInstanceCaseCoverUrl(classId: string, caseId: string): string {
  const token = getPortalToken('student') || '';
  const q = token ? `?token=${encodeURIComponent(token)}` : '';
  return `/api/student/personal-classes/${encodeURIComponent(classId)}/instance-library/cases/${encodeURIComponent(caseId)}/cover${q}`;
}

export function getStudentInstanceResourcePreviewUrl(classId: string, resourceId: string): string {
  const token = getPortalToken('student') || '';
  const q = token ? `?token=${encodeURIComponent(token)}` : '';
  return `/api/student/personal-classes/${classId}/instance-library/resources/${resourceId}/preview${q}`;
}

export async function downloadTeacherInstanceResource(resourceId: string, fileName: string) {
  await downloadInstanceResource(`/api/teacher/instance-library/resources/${resourceId}/download`, getPortalToken('teacher') || '', fileName);
}

export async function downloadStudentInstanceResource(classId: string, resourceId: string, fileName: string) {
  await downloadInstanceResource(
    `/api/student/personal-classes/${classId}/instance-library/resources/${resourceId}/download`,
    getPortalToken('student') || '',
    fileName
  );
}

async function downloadInstanceResource(path: string, token: string, fileName: string) {
  const r = await fetch(path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
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
