import { portalAuthenticatedFetch, redirectStudentSessionExpired } from './authApi';

export { redirectStudentSessionExpired };

async function studentFetch(path: string, opts: RequestInit = {}) {
  return portalAuthenticatedFetch('student', path, opts);
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
