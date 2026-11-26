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
  /** 文件类型分组 key（word/ppt/excel/pdf/image/video/audio/archive/text/other） */
  type?: string;
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

export type PitchAllTree = {
  name: string;
  totalFiles: number;
  /** 全库文件类型统计（管理端生成 catalog.json 时分析好） */
  typeCounts: Record<string, number>;
  tree: PitchDirNode;
};

/** 全目录树（用于全目录搜索与展开定位） */
export function fetchPitchAllTree() {
  return apiGet<PitchAllTree>('/api/pitch-templates/tree');
}

/** 预览 / 下载 URL（带 token，便于 iframe） */
export function pitchFileUrl(mode: 'preview' | 'download', relPath: string) {
  const auth = pickToken();
  const q = new URLSearchParams({ path: relPath });
  if (auth?.token) q.set('token', auth.token);
  return `/api/pitch-templates/${mode}?${q.toString()}`;
}

export async function fetchSignedDownloadUrl(relPath: string, attachment = true) {
  const q = new URLSearchParams({ path: relPath, mode: attachment ? 'attachment' : 'inline' });
  return apiGet<{ url: string; key: string; expiresAt: number }>(
    `/api/pitch-templates/file-url?${q.toString()}`
  );
}

/** 下载：获取 OSS 签名 URL 后触发浏览器下载（不占服务器带宽） */
export async function downloadPitchFile(relPath: string, _fileName?: string) {
  const { url } = await fetchSignedDownloadUrl(relPath, true);
  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** 同源拉取文件原始字节（经后端代理转发 OSS，无跨域问题），供 Excel 解析等前端渲染使用 */
export async function fetchFileBlob(relPath: string): Promise<ArrayBuffer> {
  const auth = pickToken();
  if (!auth) throw new Error('未登录');
  const q = new URLSearchParams({ path: relPath });
  const r = await fetch(`/api/pitch-templates/preview?${q.toString()}`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  if (!r.ok) {
    let msg = `请求失败 (${r.status})`;
    try {
      const j = await r.json();
      if (j?.message) msg = j.message;
    } catch { /* 非 JSON 响应 */ }
    throw new Error(msg);
  }
  return r.arrayBuffer();
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

// ---------- 管理端：OSS 签名 PUT 直传 ----------

export type SignedUpload = {
  url: string;
  key: string;
  objectRel: string;
  finalName: string;
  contentType: string;
  expiresAt: number;
};

/** 浏览器 XHR PUT 直传 OSS（带进度回调），服务器不经手字节流 */
export function uploadFileToOss(
  file: File,
  signed: Pick<SignedUpload, 'url' | 'contentType'>,
  onProgress?: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', signed.url);
    xhr.setRequestHeader('Content-Type', signed.contentType || 'application/octet-stream');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`OSS 返回状态码 ${xhr.status}，直传失败`));
    };
    xhr.onerror = () => reject(new Error('网络错误，直传失败（请检查 OSS 桶 CORS 是否允许 PUT）'));
    xhr.send(file);
  });
}
