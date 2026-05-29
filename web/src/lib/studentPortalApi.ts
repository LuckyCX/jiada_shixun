import { getPortalToken, portalAuthenticatedFetch, redirectStudentSessionExpired } from './authApi';

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
  teamStartDate: string;
  canEnterTraining: boolean;
  unavailableReason: string;
  courseSettings: {
    moduleKey: string;
    startDate: string;
    deadlineDate: string;
  }[];
};

export type StudentProfile = {
  id: string;
  username: string;
  realName: string;
  studentNo: string;
  email: string;
  avatarUrl: string;
  classId: string;
  className: string;
  collegeId: string;
  collegeName: string;
  majorName: string;
};

export async function getStudentProfile(): Promise<StudentProfile> {
  return studentFetch('/api/student/me') as Promise<StudentProfile>;
}

export async function updateStudentProfile(body: { email?: string; code?: string; oldPassword?: string; newPassword?: string }) {
  return studentFetch('/api/student/me', { method: 'PATCH', body: JSON.stringify(body) }) as Promise<{ saved: boolean }>;
}

export async function sendStudentEmailCode(email: string) {
  return studentFetch('/api/student/me/email-code', {
    method: 'POST',
    body: JSON.stringify({ email }),
  }) as Promise<{ sent: boolean; id?: string }>;
}

export async function uploadStudentAvatar(file: File) {
  const token = getPortalToken('student');
  const fd = new FormData();
  fd.append('file', file);
  const r = await fetch('/api/student/me/avatar', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd });
  const j = await r.json().catch(() => ({ code: -1, message: '无效响应' }));
  if (!r.ok || j.code !== 0) throw new Error(j.message || `HTTP ${r.status}`);
  return j.data as { avatarUrl: string };
}

export async function fetchStudentPersonalEnrollments(): Promise<StudentPersonalEnrollment[]> {
  const data = await studentFetch('/api/student/personal-class-enrollments');
  if (!Array.isArray(data)) return [];
  return (data as StudentPersonalEnrollment[]).map((item) => ({
    ...item,
    teamStartDate: item.teamStartDate || '',
    canEnterTraining: Boolean(item.canEnterTraining),
    unavailableReason: item.unavailableReason || '',
    courseSettings: Array.isArray(item.courseSettings)
      ? item.courseSettings.map((setting) => ({
          moduleKey: String(setting.moduleKey || ''),
          startDate: setting.startDate || '',
          deadlineDate: setting.deadlineDate || '',
        }))
      : [],
  }));
}

/** 登录成功后、写入 token 前：是否至少有一个可进入实训的教师个性化班级 */
export async function studentHasActivePersonalClassWithToken(
  token: string
): Promise<boolean> {
  const r = await fetch('/api/student/personal-class-enrollments', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const j = await r.json().catch(() => ({ code: -1 }));
  if (!r.ok || j.code !== 0) return false;
  const list = j.data as StudentPersonalEnrollment[] | undefined;
  return Array.isArray(list) && list.some((item) => item.canEnterTraining);
}
