import { adminFetch } from '../dictionary/adminDictApi';

export type AdminClassListRow = {
  id: string;
  name: string;
  code: string;
  collegeId: string;
  academicYear: string;
  semester: string;
  department: string;
  status: string;
  createdAt: string;
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  studentCount: number;
};

export async function fetchClassesList(collegeId?: string): Promise<AdminClassListRow[]> {
  const q = collegeId ? `?collegeId=${encodeURIComponent(collegeId)}` : '';
  return adminFetch(`/api/admin/classes${q}`);
}

export async function createAdminClass(body: {
  collegeId: string;
  name: string;
  /** 不传则由服务端自动生成 */
  code?: string;
  academicYear: string;
  semester: string;
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
    academicYear: string;
    semester: string;
    teacherId: string;
    status: string;
  }>
): Promise<AdminClassListRow> {
  return adminFetch(`/api/admin/classes/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export async function deleteAdminClass(id: string): Promise<void> {
  await adminFetch(`/api/admin/classes/${id}`, { method: 'DELETE' });
}
