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

export async function postAdminUsersBatch(rows: BatchImportRow[]): Promise<ImportResult> {
  const data = (await adminFetch('/api/admin/users/batch', {
    method: 'POST',
    body: JSON.stringify({ rows }),
  })) as Partial<ImportResult> | null;
  return {
    success: Number(data?.success ?? 0),
    failed: Number(data?.failed ?? 0),
    errors: Array.isArray(data?.errors)
      ? data.errors.map((e) => ({
          row: Number(e?.row ?? 0),
          reason: String(e?.reason ?? '未知错误'),
        }))
      : [],
  };
}
