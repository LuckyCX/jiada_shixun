import { portalAuthenticatedFetch } from './authApi';
import { getPortalToken } from './authApi';

async function teacherFetch(path: string, opts: RequestInit = {}) {
  return portalAuthenticatedFetch('teacher', path, opts);
}

export type TeacherProfile = {
  id: string;
  username: string;
  realName: string;
  email: string;
  avatarUrl: string;
  departmentCollegeId: string;
  collegeName: string;
};

export async function getTeacherProfile(): Promise<TeacherProfile> {
  return teacherFetch('/api/teacher/me') as Promise<TeacherProfile>;
}

export async function updateTeacherProfile(body: { email?: string; oldPassword?: string; newPassword?: string }) {
  return teacherFetch('/api/teacher/me', { method: 'PATCH', body: JSON.stringify(body) }) as Promise<{ saved: boolean }>;
}

export async function uploadTeacherAvatar(file: File) {
  const token = getPortalToken('teacher');
  const fd = new FormData();
  fd.append('file', file);
  const r = await fetch('/api/teacher/me/avatar', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd });
  const j = await r.json().catch(() => ({ code: -1, message: '无效响应' }));
  if (!r.ok || j.code !== 0) throw new Error(j.message || `HTTP ${r.status}`);
  return j.data as { avatarUrl: string };
}

