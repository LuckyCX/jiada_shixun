import { portalAuthenticatedFetch } from '../../lib/authApi';
import { getPortalToken } from '../../lib/authApi';

function apiBase() {
  return '';
}

export async function teacherFetch(path: string, opts: RequestInit = {}) {
  return portalAuthenticatedFetch('teacher', `${apiBase()}${path}`, opts);
}

export type TeacherProfile = {
  id: string;
  username: string;
  realName: string;
  email: string;
  avatarUrl: string;
  departmentCollegeId: string;
  collegeName: string;
  majorId: string;
  majorName: string;
};

export type TeacherPersonalClassRow = {
  id: string;
  name: string;
  academicYear: string;
  /** 学期字典 `semester` 的 data_key */
  semester: string;
  createdAt: string;
  studentCount: number;
};

export async function getTeacherProfile(): Promise<TeacherProfile> {
  return teacherFetch('/api/teacher/me') as Promise<TeacherProfile>;
}

export async function updateTeacherProfile(body: { email?: string; code?: string; oldPassword?: string; newPassword?: string }) {
  return teacherFetch('/api/teacher/me', { method: 'PATCH', body: JSON.stringify(body) }) as Promise<{ saved: boolean }>;
}

export async function sendTeacherEmailCode(email: string) {
  return teacherFetch('/api/teacher/me/email-code', {
    method: 'POST',
    body: JSON.stringify({ email }),
  }) as Promise<{ sent: boolean; id?: string }>;
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

export async function listTeacherPersonalClasses(): Promise<TeacherPersonalClassRow[]> {
  return teacherFetch('/api/teacher/personal-classes') as Promise<TeacherPersonalClassRow[]>;
}

export async function createTeacherPersonalClass(body: { name: string }): Promise<TeacherPersonalClassRow> {
  return teacherFetch('/api/teacher/personal-classes', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as Promise<TeacherPersonalClassRow>;
}

export async function deleteTeacherPersonalClass(id: string): Promise<{ ok: boolean }> {
  return teacherFetch(`/api/teacher/personal-classes/${id}`, { method: 'DELETE' }) as Promise<{ ok: boolean }>;
}

/** 无需认证；教务端学院列表 */
export async function fetchPublicColleges(): Promise<{ id: string; name: string }[]> {
  const r = await fetch('/api/public/colleges');
  const j = await r.json().catch(() => ({ code: -1, message: '无效 JSON' }));
  if (!r.ok || j.code !== 0) {
    throw new Error(typeof j.message === 'string' ? j.message : `HTTP ${r.status}`);
  }
  return j.data as { id: string; name: string }[];
}

export type PublicMajorOption = { id: string; name: string; collegeId: string; collegeName: string };

export async function fetchPublicMajors(collegeId?: string): Promise<PublicMajorOption[]> {
  const q = collegeId ? `?collegeId=${encodeURIComponent(collegeId)}` : '';
  const r = await fetch(`/api/public/majors${q}`);
  const j = await r.json().catch(() => ({ code: -1, message: '无效 JSON' }));
  if (!r.ok || j.code !== 0) {
    throw new Error(typeof j.message === 'string' ? j.message : `HTTP ${r.status}`);
  }
  return j.data as PublicMajorOption[];
}

export type TeacherCatalogAdminClass = { id: string; name: string };

export type TeacherPooledStudent = {
  id: string;
  name: string;
  email: string;
  studentNo: string;
  collegeName: string;
  majorName: string;
};

export type TeacherRosterStudent = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  studentNo: string;
  collegeName: string;
  majorName: string;
};

export async function fetchTeacherAdminClasses(
  collegeId: string,
  majorId: string
): Promise<TeacherCatalogAdminClass[]> {
  const q = new URLSearchParams({ collegeId, majorId });
  return teacherFetch(`/api/teacher/catalog/admin-classes?${q}`) as Promise<TeacherCatalogAdminClass[]>;
}

export async function fetchTeacherStudentPoolByAdminClass(classId: string): Promise<TeacherPooledStudent[]> {
  const q = new URLSearchParams({ classId });
  return teacherFetch(`/api/teacher/catalog/students-by-filter?${q}`) as Promise<TeacherPooledStudent[]>;
}

export async function listPersonalClassStudents(classId: string): Promise<TeacherRosterStudent[]> {
  return teacherFetch(`/api/teacher/personal-classes/${classId}/students`) as Promise<TeacherRosterStudent[]>;
}

export async function putPersonalClassStudents(
  classId: string,
  studentIds: string[]
): Promise<{ studentCount: number }> {
  // 使用 POST：教室 360 / 部分校园网会拦截 PUT，表现为 Failed to fetch
  return teacherFetch(`/api/teacher/personal-classes/${classId}/students`, {
    method: 'POST',
    body: JSON.stringify({ studentIds }),
  }) as Promise<{ studentCount: number }>;
}

export async function removePersonalClassStudent(classId: string, studentId: string): Promise<{ studentCount: number }> {
  return teacherFetch(`/api/teacher/personal-classes/${classId}/students/${studentId}`, {
    method: 'DELETE',
  }) as Promise<{ studentCount: number }>;
}

export {
  fetchTeacherTeamQuestions,
  saveTeacherTeamQuestions,
  fetchTeacherPendingTeamStudents,
} from '../../lib/teamFormationApi';
