import { portalAuthenticatedFetch } from '../../../../lib/authApi';

export type DictTypeRow = {
  id: number;
  name: string;
  code: string;
  status: number;
  remark: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type DictItemRow = {
  id: number;
  dictTypeId: number;
  name: string;
  dataKey: number;
  sortOrder: number;
  status: number;
  remark: string | null;
};

export type Paginated<T> = { list: T[]; total: number; page: number; pageSize: number };

function apiBase() {
  return '';
}

export async function adminFetch(path: string, opts: RequestInit = {}) {
  return portalAuthenticatedFetch('admin', `${apiBase()}${path}`, opts);
}

export async function fetchDictTypes(params: {
  name?: string;
  code?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<Paginated<DictTypeRow>> {
  const q = new URLSearchParams();
  if (params.name) q.set('name', params.name);
  if (params.code) q.set('code', params.code);
  if (params.status !== undefined && params.status !== '') q.set('status', params.status);
  q.set('page', String(params.page ?? 1));
  q.set('pageSize', String(params.pageSize ?? 10));
  return adminFetch(`/api/admin/dict-types?${q}`);
}

export async function fetchDictTypeOne(id: number): Promise<DictTypeRow> {
  return adminFetch(`/api/admin/dict-types/${id}`);
}

export async function createDictType(body: Partial<DictTypeRow>) {
  return adminFetch('/api/admin/dict-types', { method: 'POST', body: JSON.stringify(body) });
}

export async function updateDictType(id: number, body: Partial<DictTypeRow>) {
  return adminFetch(`/api/admin/dict-types/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export async function deleteDictType(id: number) {
  return adminFetch(`/api/admin/dict-types/${id}`, { method: 'DELETE' });
}

export async function fetchDictItems(
  typeId: number,
  params: { name?: string; status?: string; page?: number; pageSize?: number }
): Promise<Paginated<DictItemRow>> {
  const q = new URLSearchParams();
  if (params.name) q.set('name', params.name);
  if (params.status !== undefined && params.status !== '') q.set('status', params.status);
  q.set('page', String(params.page ?? 1));
  q.set('pageSize', String(params.pageSize ?? 10));
  return adminFetch(`/api/admin/dict-types/${typeId}/items?${q}`);
}

export async function createDictItem(typeId: number, body: Partial<DictItemRow>) {
  return adminFetch(`/api/admin/dict-types/${typeId}/items`, { method: 'POST', body: JSON.stringify(body) });
}

export async function updateDictItem(id: number, body: Partial<DictItemRow>) {
  return adminFetch(`/api/admin/dict-items/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export async function deleteDictItem(id: number) {
  return adminFetch(`/api/admin/dict-items/${id}`, { method: 'DELETE' });
}

export type PublicDictOption = { id: number; dataKey: number; name: string };

export async function fetchPublicDictItems(typeCode: string): Promise<PublicDictOption[]> {
  const q = new URLSearchParams({ typeCode });
  const r = await fetch(`${apiBase()}/api/public/dict-items?${q}`);
  const j = await r.json().catch(() => ({ code: -1, message: '无效 JSON' }));
  if (!r.ok || j.code !== 0) {
    throw new Error(j.message || `HTTP ${r.status}`);
  }
  return j.data as PublicDictOption[];
}
