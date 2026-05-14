import { adminFetch } from './dictionary/adminDictApi';

export type AdminCollegeRow = {
  id: string;
  name: string;
  status: string;
  classCount: number;
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
