import { getPortalToken, redirectTeacherSessionExpired } from '../../lib/authApi';

function apiBase() {
  return '';
}

export async function teacherFetch(path: string, opts: RequestInit = {}) {
  const token = getPortalToken('teacher') || '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(`${apiBase()}${path}`, { ...opts, headers });
  const j = await r.json().catch(() => ({ code: -1, message: '无效 JSON' }));
  if (r.status === 401 || j.code === 40101 || j.code === 40102) {
    redirectTeacherSessionExpired();
    throw new Error(typeof j.message === 'string' ? j.message : '登录已失效，请返回首页重新以教师登录');
  }
  if (!r.ok || j.code !== 0) {
    throw new Error(typeof j.message === 'string' ? j.message : `HTTP ${r.status}`);
  }
  return j.data;
}

export type TeacherProfile = {
  id: string;
  username: string;
  realName: string;
  email: string;
  departmentCollegeId: string;
  collegeName: string;
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

export async function listTeacherPersonalClasses(): Promise<TeacherPersonalClassRow[]> {
  return teacherFetch('/api/teacher/personal-classes') as Promise<TeacherPersonalClassRow[]>;
}

export async function createTeacherPersonalClass(body: {
  name: string;
  academicYear: string;
  semester: string;
}): Promise<TeacherPersonalClassRow> {
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

export type TeacherCatalogAdminClass = { id: string; name: string };

export type TeacherPooledStudent = {
  id: string;
  name: string;
  email: string;
  studentNo: string;
  collegeName: string;
  /** 最近所在教务班级名 */
  adminClassName: string;
};

export type TeacherRosterStudent = {
  id: string;
  name: string;
  email: string;
  studentNo: string;
  collegeName: string;
};

export async function fetchTeacherAdminClasses(collegeId: string): Promise<TeacherCatalogAdminClass[]> {
  const q = new URLSearchParams({ collegeId });
  return teacherFetch(`/api/teacher/catalog/admin-classes?${q}`) as Promise<TeacherCatalogAdminClass[]>;
}

export async function fetchTeacherStudentPool(collegeId: string, adminClassId?: string): Promise<TeacherPooledStudent[]> {
  const q = new URLSearchParams({ collegeId });
  if (adminClassId) q.set('adminClassId', adminClassId);
  return teacherFetch(`/api/teacher/catalog/students-by-filter?${q}`) as Promise<TeacherPooledStudent[]>;
}

export async function listPersonalClassStudents(classId: string): Promise<TeacherRosterStudent[]> {
  return teacherFetch(`/api/teacher/personal-classes/${classId}/students`) as Promise<TeacherRosterStudent[]>;
}

export async function putPersonalClassStudents(
  classId: string,
  studentIds: string[]
): Promise<{ studentCount: number }> {
  return teacherFetch(`/api/teacher/personal-classes/${classId}/students`, {
    method: 'PUT',
    body: JSON.stringify({ studentIds }),
  }) as Promise<{ studentCount: number }>;
}

export async function removePersonalClassStudent(classId: string, studentId: string): Promise<{ studentCount: number }> {
  return teacherFetch(`/api/teacher/personal-classes/${classId}/students/${studentId}`, {
    method: 'DELETE',
  }) as Promise<{ studentCount: number }>;
}
