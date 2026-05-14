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

export type AdminClassOption = { id: string; name: string; code: string; collegeId?: string };

export type BatchImportRow = {
  name: string;
  role: string;
  idNumber: string;
  email?: string;
  collegeId: string;
  /** 学生必填；教师可省略 */
  classId?: string;
};

export async function fetchAdminUsers(params: {
  page?: number;
  pageSize?: number;
  q?: string;
  role?: UserRole | '' | 'all';
  status?: UserStatus | '' | 'all';
  classId?: string;
}): Promise<AdminUsersPage> {
  const q = new URLSearchParams();
  q.set('page', String(params.page ?? 1));
  q.set('pageSize', String(params.pageSize ?? 20));
  if (params.q?.trim()) q.set('q', params.q.trim());
  if (params.role && params.role !== 'all') q.set('role', params.role);
  if (params.status && params.status !== 'all') q.set('status', params.status);
  if (params.classId?.trim()) q.set('classId', params.classId.trim());
  return adminFetch(`/api/admin/users?${q}`);
}

export async function fetchAdminClasses(collegeId?: string): Promise<AdminClassOption[]> {
  const q = collegeId ? `?collegeId=${encodeURIComponent(collegeId)}` : '';
  const rows = await adminFetch(`/api/admin/classes${q}`) as Array<{
    id: string;
    name: string;
    code: string;
    collegeId: string;
  }>;
  return rows.map((r) => ({ id: r.id, name: r.name, code: r.code, collegeId: r.collegeId }));
}

export async function createAdminUser(body: {
  name: string;
  role: 'student' | 'teacher';
  idNumber: string;
  email?: string;
  department: string;
  password: string;
}): Promise<User> {
  const payload: Record<string, unknown> = {
    name: body.name,
    role: body.role,
    idNumber: body.idNumber,
    department: body.department,
    password: body.password,
  };
  if (body.email?.trim()) payload.email = body.email.trim();
  return adminFetch('/api/admin/users', { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateAdminUser(
  userId: string,
  body: Partial<{
    name: string;
    email: string;
    department: string;
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
  return adminFetch('/api/admin/users/batch', { method: 'POST', body: JSON.stringify({ rows }) });
}
