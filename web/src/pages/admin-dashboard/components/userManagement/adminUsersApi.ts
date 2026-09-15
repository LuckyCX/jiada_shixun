import { adminFetch } from '../dictionary/adminDictApi';
import type { User, UserRole, UserStatus } from './types';
import type { ImportResult } from './types';

export type AdminUserStats = {
  totalUsers: number;
  teachers: number;
  students: number;
  activeUsers: number;
};

export type AdminUsersPage = {
  list: User[];
  total: number;
  page: number;
  pageSize: number;
  stats: AdminUserStats;
};

export type AdminClassOption = { id: string; name: string; code: string; collegeId?: string; majorId?: string };

export type BatchImportRow = {
  name: string;
  role: string;
  idNumber: string;
  email?: string;
  collegeId: string;
  majorId: string;
  /** 学生必填；教师可省略 */
  classId?: string;
  /** CSV 文件中的行号（1 起），用于导入结果报错定位 */
  sourceLine?: number;
};

export async function fetchAdminUsers(params: {
  page?: number;
  pageSize?: number;
  q?: string;
  role?: UserRole | '' | 'all';
  status?: UserStatus | '' | 'all';
  classId?: string;
  /** 与 colleges.id 一致，筛选 users.department */
  collegeId?: string;
  majorId?: string;
}): Promise<AdminUsersPage> {
  const q = new URLSearchParams();
  q.set('page', String(params.page ?? 1));
  q.set('pageSize', String(params.pageSize ?? 20));
  if (params.q?.trim()) q.set('q', params.q.trim());
  if (params.role && params.role !== 'all') q.set('role', params.role);
  if (params.status && params.status !== 'all') q.set('status', params.status);
  if (params.classId?.trim()) q.set('classId', params.classId.trim());
  if (params.collegeId?.trim()) q.set('collegeId', params.collegeId.trim());
  if (params.majorId?.trim()) q.set('majorId', params.majorId.trim());
  return adminFetch(`/api/admin/users?${q}`);
}

export async function fetchAdminClasses(collegeId?: string, majorId?: string): Promise<AdminClassOption[]> {
  const q = new URLSearchParams();
  if (collegeId) q.set('collegeId', collegeId);
  if (majorId) q.set('majorId', majorId);
  const qs = q.toString();
  const rows = await adminFetch(`/api/admin/classes${qs ? `?${qs}` : ''}`) as Array<{
    id: string;
    name: string;
    code: string;
    collegeId: string;
    majorId?: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    collegeId: r.collegeId,
    majorId: r.majorId,
  }));
}

export async function createAdminUser(body: {
  name: string;
  role: 'student' | 'teacher';
  idNumber: string;
  email?: string;
  department: string;
  majorId?: string;
  password: string;
  /** 学生入班：创建或挂到已有账号时使用 */
  classId?: string;
  /** 已在其他行政班时：skip 跳过 / move 挪班 */
  otherClassPolicy?: 'skip' | 'move';
}): Promise<User> {
  const payload: Record<string, unknown> = {
    name: body.name,
    role: body.role,
    idNumber: body.idNumber,
    department: body.department,
    password: body.password,
  };
  if (body.majorId?.trim()) payload.majorId = body.majorId.trim();
  if (body.email?.trim()) payload.email = body.email.trim();
  if (body.classId?.trim()) payload.classId = body.classId.trim();
  if (body.otherClassPolicy) payload.otherClassPolicy = body.otherClassPolicy;
  return adminFetch('/api/admin/users', { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateAdminUser(
  userId: string,
  body: Partial<{
    name: string;
    email: string;
    department: string;
    majorId: string;
    role: UserRole;
    idNumber: string;
    classId: string;
  }>
): Promise<User> {
  return adminFetch(`/api/admin/users/${userId}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export async function patchAdminUserStatus(userId: string, status: UserStatus): Promise<void> {
  await adminFetch(`/api/admin/users/${userId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
}

export async function patchAdminUserPassword(userId: string, password: string): Promise<void> {
  await adminFetch(`/api/admin/users/${userId}/password`, { method: 'PATCH', body: JSON.stringify({ password }) });
}

export async function deleteAdminUser(userId: string): Promise<void> {
  await adminFetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
}

export type AdminUserDeleteImpact = {
  id: string;
  role: string;
  name: string;
  personalClasses: Array<{ id: string; name: string; studentCount: number | null }>;
};

/** 删除前风险预览：个性化班解散 / 退出列表 */
export async function fetchAdminUserDeleteImpact(userId: string): Promise<AdminUserDeleteImpact> {
  const data = (await adminFetch(`/api/admin/users/${userId}/delete-impact`)) as Partial<AdminUserDeleteImpact> | null;
  return {
    id: String(data?.id ?? userId),
    role: String(data?.role ?? ''),
    name: String(data?.name ?? ''),
    personalClasses: Array.isArray(data?.personalClasses)
      ? data.personalClasses.map((c) => ({
          id: String(c?.id ?? ''),
          name: String(c?.name ?? ''),
          studentCount: c?.studentCount == null ? null : Number(c.studentCount),
        }))
      : [],
  };
}

export async function batchDeleteAdminUsers(
  ids: string[],
  opts?: { classId?: string }
): Promise<{ deleted: number; removedFromPersonalClasses: number }> {
  const data = (await adminFetch('/api/admin/users/batch-delete', {
    method: 'POST',
    body: JSON.stringify({
      ids,
      ...(opts?.classId?.trim() ? { classId: opts.classId.trim() } : {}),
    }),
  })) as { deleted?: number; removedFromPersonalClasses?: number } | null;
  return {
    deleted: Number(data?.deleted ?? 0),
    removedFromPersonalClasses: Number(data?.removedFromPersonalClasses ?? 0),
  };
}

export async function postAdminUsersBatch(
  rows: BatchImportRow[],
  opts?: { otherClassPolicy?: 'skip' | 'move' }
): Promise<ImportResult> {
  const body: Record<string, unknown> = { rows };
  if (opts?.otherClassPolicy) body.otherClassPolicy = opts.otherClassPolicy;
  const data = (await adminFetch('/api/admin/users/batch', {
    method: 'POST',
    body: JSON.stringify(body),
  })) as Partial<ImportResult> | null;
  return {
    success: Number(data?.success ?? 0),
    failed: Number(data?.failed ?? 0),
    skipped: Number(data?.skipped ?? 0),
    needsDecision: Boolean(data?.needsDecision),
    errors: Array.isArray(data?.errors)
      ? data.errors.map((e) => ({
          row: Number(e?.row ?? 0),
          reason: String(e?.reason ?? '未知错误'),
        }))
      : [],
    conflicts: Array.isArray(data?.conflicts)
      ? data.conflicts.map((c) => ({
          row: c?.row == null ? null : Number(c.row),
          userId: String(c?.userId ?? ''),
          idNumber: String(c?.idNumber ?? ''),
          name: String(c?.name ?? ''),
          currentClassId: String(c?.currentClassId ?? ''),
          currentClassName: String(c?.currentClassName ?? ''),
          targetClassId: String(c?.targetClassId ?? ''),
        }))
      : [],
  };
}
