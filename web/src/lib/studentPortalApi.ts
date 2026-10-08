import { getPortalToken, isPortalRememberMe, portalAuthenticatedFetch, redirectStudentSessionExpired, setPortalToken } from './authApi';

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
    skipped?: boolean;
  }[];
};

export type StudentProfile = {
  id: string;
  username: string;
  realName: string;
  studentNo: string;
  email: string;
  phone: string;
  avatarUrl: string;
  classId: string;
  className: string;
  collegeId: string;
  collegeName: string;
  majorName: string;
};

export async function getStudentProfile(): Promise<StudentProfile> {
  const data = (await studentFetch('/api/student/me')) as StudentProfile;
  return {
    ...data,
    email: data?.email || '',
    phone: data?.phone || '',
  };
}

export async function updateStudentProfile(body: {
  email?: string;
  code?: string;
  phone?: string;
  phoneCode?: string;
  oldPassword?: string;
  newPassword?: string;
}) {
  const data = (await studentFetch('/api/student/me', {
    method: 'PATCH',
    body: JSON.stringify(body),
  })) as { saved?: boolean; token?: string; refreshToken?: string };
  // 改密成功后服务端签发无 mustChangePassword 的新 token，需替换本地登录态
  if (data?.token) {
    setPortalToken('student', data.token, isPortalRememberMe('student'), data.refreshToken);
  }
  return data;
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
          skipped: Boolean(setting.skipped),
        }))
      : [],
  }));
}

/** 登录成功后、写入 token 前：校验学生个性化班闸门 */
export async function assertStudentCanLoginWithToken(
  token: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const r = await fetch('/api/student/personal-class-enrollments', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const j = await r.json().catch(() => ({ code: -1, message: '无法校验班级归属' }));
  if (!r.ok || j.code !== 0) {
    return { ok: false, message: String(j.message || '无法校验班级归属') };
  }
  const list = Array.isArray(j.data) ? (j.data as StudentPersonalEnrollment[]) : [];
  // 零班（含新建未拉入 / 被踢光 / 老师删班解散）：禁止登录
  if (list.length === 0) {
    return { ok: false, message: '暂无归属班级' };
  }
  // 有班但全部未到实训时间
  if (!list.some((item) => Boolean(item.canEnterTraining))) {
    return { ok: false, message: '当前暂无已开放的实训班级' };
  }
  return { ok: true };
}

/** @deprecated 请使用 assertStudentCanLoginWithToken */
export async function studentHasActivePersonalClassWithToken(token: string): Promise<boolean> {
  const r = await assertStudentCanLoginWithToken(token);
  return r.ok;
}
