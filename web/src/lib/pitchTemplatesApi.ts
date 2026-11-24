/**
 * 创业路演模板库前端 API
 */
import { getPortalToken, type PortalRole } from './authApi';

export type PitchCategorySummary = {
  id: string;
  name: string;
  fileCount: number;
  catalog: string;
};

export type PitchCatalogIndex = {
  version: number;
  root: string;
  generatedAt?: string;
  totalFiles: number;
  categories: PitchCategorySummary[];
};

export type PitchFileItem = {
  id: string;
  name: string;
  relPath: string;
  ext: string;
  size: number;
  sizeText: string;
  previewable: boolean;
  kind: string;
};

export type PitchDirNode = {
  id: string;
  name: string;
  type: 'dir';
  relPath: string;
  children: PitchDirNode[];
  files: PitchFileItem[];
  fileCount: number;
};

export type PitchCategoryDetail = {
  version: number;
  id: string;
  name: string;
  fileCount: number;
  tree: PitchDirNode;
};

function pickToken(): { role: PortalRole; token: string } | null {
  for (const role of ['student', 'teacher', 'admin'] as PortalRole[]) {
    const token = getPortalToken(role);
    if (token) return { role, token };
  }
  return null;
}

async function apiGet<T>(url: string): Promise<T> {
  const auth = pickToken();
  if (!auth) throw new Error('未登录');
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  const json = await r.json().catch(() => null);
  if (!r.ok || !json || json.code !== 0) {
    throw new Error(json?.message || `请求失败 (${r.status})`);
  }
  return json.data as T;
}

export function fetchPitchCatalogIndex() {
  return apiGet<PitchCatalogIndex>('/api/pitch-templates/catalog');
}

export function fetchPitchCategory(catId: string) {
  return apiGet<PitchCategoryDetail>(`/api/pitch-templates/catalog/${encodeURIComponent(catId)}`);
}

/** 预览 / 下载 URL（带 token，便于 iframe） */
export function pitchFileUrl(mode: 'preview' | 'download', relPath: string) {
  const auth = pickToken();
  const q = new URLSearchParams({ path: relPath });
  if (auth?.token) q.set('token', auth.token);
  return `/api/pitch-templates/${mode}?${q.toString()}`;
}

export async function downloadPitchFile(relPath: string, fileName: string) {
  const auth = pickToken();
  if (!auth) throw new Error('未登录');
  const url = pitchFileUrl('download', relPath);
  const r = await fetch(url, { headers: { Authorization: `Bearer ${auth.token}` } });
  if (!r.ok) {
    const json = await r.json().catch(() => null);
    throw new Error(json?.message || '下载失败');
  }
  const blob = await r.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName || 'download';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

/** 批量顺序下载：逐个触发浏览器下载，间隔 400ms 防止被拦截；失败记录并继续 */
export async function downloadPitchFilesBatch(
  files: { relPath: string; name: string }[],
  onProgress?: (done: number, total: number, current: string) => void
): Promise<{ ok: number; failed: { name: string; reason: string }[] }> {
  let ok = 0;
  const failed: { name: string; reason: string }[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    onProgress?.(i, files.length, f.name);
    try {
      await downloadPitchFile(f.relPath, f.name);
      ok += 1;
    } catch (e) {
      failed.push({ name: f.name, reason: e instanceof Error ? e.message : '下载失败' });
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  onProgress?.(files.length, files.length, '');
  return { ok, failed };
}
