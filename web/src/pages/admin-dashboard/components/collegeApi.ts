import { adminFetch } from './dictionary/adminDictApi';

export type AdminCollegeRow = {
  id: string;
  name: string;
  status: string;
  classCount: number;
  teacherCount: number;
  createdAt?: string;
  updatedAt?: string;
};

export async function fetchAdminColleges(): Promise<AdminCollegeRow[]> {
  return adminFetch('/api/admin/colleges');
}

export async function createAdminCollege(name: string): Promise<AdminCollegeRow> {
  return adminFetch('/api/admin/colleges', { method: 'POST', body: JSON.stringify({ name }) });
}

export async function updateAdminCollege(
  id: string,
  body: Partial<{ name: string; status: 'active' | 'inactive' }>
): Promise<AdminCollegeRow> {
  return adminFetch(`/api/admin/colleges/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export async function deleteAdminCollege(id: string): Promise<void> {
  await adminFetch(`/api/admin/colleges/${id}`, { method: 'DELETE' });
}

export type PublicMajorRow = {
  id: string;
  name: string;
  collegeId: string;
  collegeName: string;
};

export async function createAdminMajor(collegeId: string, name: string): Promise<PublicMajorRow> {
  return adminFetch('/api/admin/majors', {
    method: 'POST',
    body: JSON.stringify({ collegeId, name }),
  });
}

export async function fetchPublicMajors(collegeId?: string): Promise<PublicMajorRow[]> {
  const q = collegeId ? `?collegeId=${encodeURIComponent(collegeId)}` : '';
  const res = await fetch(`/api/public/majors${q}`, { credentials: 'include' });
  const json = (await res.json()) as { code: number; data: PublicMajorRow[] | null; message?: string };
  if (!res.ok || json.code !== 0 || !json.data) {
    throw new Error(json.message || '加载专业失败');
  }
  return json.data;
}
