import { adminFetch } from '../dictionary/adminDictApi';

export type AdminClassListRow = {
  id: string;
  name: string;
  code: string;
  collegeId: string;
  majorId: string;
  majorName: string;
  academicYear: string;
  semester: string;
  department: string;
  status: string;
  createdAt: string;
  /** 历史字段，管理端班级列表不再展示任课教师 */
  teacherId?: string;
  teacherName?: string;
  teacherEmail?: string;
  studentCount: number;
};

export async function fetchClassesList(params?: { collegeId?: string; majorId?: string }): Promise<AdminClassListRow[]> {
  const q = new URLSearchParams();
  if (params?.collegeId) q.set('collegeId', params.collegeId);
  if (params?.majorId) q.set('majorId', params.majorId);
  const qs = q.toString();
  return adminFetch(`/api/admin/classes${qs ? `?${qs}` : ''}`);
}

export async function createAdminClass(body: {
  collegeId: string;
  majorId: string;
  name: string;
  /** 不传则由服务端自动生成 */
  code?: string;
  teacherId?: string;
  status?: string;
}): Promise<AdminClassListRow> {
  return adminFetch('/api/admin/classes', { method: 'POST', body: JSON.stringify(body) });
}

export async function updateAdminClass(
  id: string,
  body: Partial<{
    name: string;
    code: string;
    collegeId: string;
    majorId: string;
    teacherId: string;
    status: string;
  }>
): Promise<AdminClassListRow> {
  return adminFetch(`/api/admin/classes/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export async function deleteAdminClass(id: string): Promise<void> {
  await adminFetch(`/api/admin/classes/${id}`, { method: 'DELETE' });
}
