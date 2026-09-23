import { getPortalToken, isPortalRememberMe, portalAuthenticatedFetch, setPortalToken } from './authApi';

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
  const data = (await teacherFetch('/api/teacher/me', {
    method: 'PATCH',
    body: JSON.stringify(body),
  })) as { saved?: boolean; token?: string; refreshToken?: string };
  // 改密成功后服务端签发无 mustChangePassword 的新 token，需替换本地登录态
  if (data?.token) {
    setPortalToken('teacher', data.token, isPortalRememberMe('teacher'), data.refreshToken);
  }
  return data;
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

