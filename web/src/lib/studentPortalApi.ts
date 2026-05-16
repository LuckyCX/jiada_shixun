import { clearPortalToken, getPortalToken } from './authApi';

export function redirectStudentSessionExpired(): void {
  if (typeof window === 'undefined') return;
  if (!window.location.pathname.startsWith('/student-center')) return;
  clearPortalToken('student');
  window.location.replace('/?studentExpired=1');
}

async function studentFetch(path: string, opts: RequestInit = {}) {
  const token = getPortalToken('student') || '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(path, { ...opts, headers });
  const j = await r.json().catch(() => ({ code: -1, message: '无效 JSON' }));
  if (r.status === 401 || j.code === 40101 || j.code === 40102) {
    redirectStudentSessionExpired();
    throw new Error(typeof j.message === 'string' ? j.message : '登录已失效，请返回首页重新登录');
  }
  if (!r.ok || j.code !== 0) {
    throw new Error(typeof j.message === 'string' ? j.message : `HTTP ${r.status}`);
  }
  return j.data;
}

export type StudentPersonalEnrollment = {
  classId: string;
  className: string;
  academicYear: string;
  semester: string;
  teacherId: string;
  teacherName: string;
  joinedAt: string;
};

export type StudentProfile = {
  id: string;
  username: string;
  realName: string;
  studentNo: string;
  email: string;
};

export async function getStudentProfile(): Promise<StudentProfile> {
  return studentFetch('/api/student/me') as Promise<StudentProfile>;
}

export async function fetchStudentPersonalEnrollments(): Promise<StudentPersonalEnrollment[]> {
  const data = await studentFetch('/api/student/personal-class-enrollments');
  return Array.isArray(data) ? (data as StudentPersonalEnrollment[]) : [];
}

/** 登录成功后、写入 token 前：是否至少加入一个教师个性化班级 */
export async function studentHasPersonalClassEnrollmentWithToken(
  token: string
): Promise<boolean> {
  const r = await fetch('/api/student/personal-class-enrollments', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const j = await r.json().catch(() => ({ code: -1 }));
  if (!r.ok || j.code !== 0) return false;
  const list = j.data as StudentPersonalEnrollment[] | undefined;
  return Array.isArray(list) && list.length > 0;
}
