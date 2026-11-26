/**
 * 创业路演模板库 —— 阿里云 OSS 数据源
 * 取代本地 resource/pitch-templates 扫描（彻底切换）。
 * - 配置存 system_config 表 key=oss_config（管理后台可视化配置，SK 掩码）
 * - 目录树由 ListObjectsV2 全量聚合 + 内存缓存（TTL 60s，管理端可强制刷新）
 * - 读：签名 GET URL（私有桶）；写：签名 PUT URL（浏览器直传）；删除：服务端 SDK
 */
import OSS from 'ali-oss';
import crypto from 'crypto';
import { getConfigValue } from './systemConfig.js';

export const OSS_CONFIG_KEY = 'oss_config';

/** @returns {Promise<object>} 合并默认值后的 OSS 配置 */
export async function getOssConfig() {
  const raw = await getConfigValue(OSS_CONFIG_KEY, false);
  const cfg = {
    enabled: false,
    region: '',
    endpoint: '',
    internalEndpoint: '',
    bucket: '',
    accessKeyId: '',
    accessKeySecret: '',
    prefix: 'pitch-templates/',
    urlExpireSeconds: 3600,
    ...(raw && typeof raw === 'object' ? raw : {}),
  };
  cfg.urlExpireSeconds = Math.min(Math.max(Number(cfg.urlExpireSeconds) || 3600, 300), 64800);
  cfg.prefix = normalizePrefix(cfg.prefix);
  return cfg;
}

export function normalizePrefix(p) {
  const s = String(p || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!s) return '';
  return s.endsWith('/') ? s : `${s}/`;
}

export function isOssConfigured(cfg) {
  return !!(cfg && cfg.enabled && cfg.bucket && cfg.accessKeyId && cfg.accessKeySecret && cfg.region);
}

export function assertOssReady(cfg) {
  if (!cfg?.enabled) throw new Error('OSS 未启用，请先在系统设置 → 资源维护中配置并启用');
  if (!cfg.bucket || !cfg.accessKeyId || !cfg.accessKeySecret || !cfg.region) {
    throw new Error('OSS 配置不完整（region / bucket / AccessKeyId / AccessKeySecret）');
  }
}

/**
 * 规范化 endpoint：去掉协议头、结尾斜杠，并去掉误填的桶名前缀
 * （ali-oss SDK 会自动拼接 bucket，填 `bucket.oss-cn-xx.aliyuncs.com` 会导致双重前缀）
 */
function normalizeEndpoint(ep, bucket) {
  let s = String(ep || '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  if (bucket && s.startsWith(`${bucket}.`)) s = s.slice(bucket.length + 1);
  return s;
}

/**
 * 构建 OSS 客户端。
 * @param {{ internal?: boolean, override?: object }} [opts]
 *  - internal: true 用内网 endpoint（服务端数据面），false 用外网（签名给浏览器）
 *  - override: 测试连接时用表单临时值构建，不落库
 */
export async function getOssClient(opts = {}) {
  const cfg = opts.override || (await getOssConfig());
  assertOssReady(cfg);
  const rawEndpoint = (opts.internal && cfg.internalEndpoint) || cfg.endpoint || '';
  const endpoint = normalizeEndpoint(rawEndpoint, cfg.bucket);
  return new OSS({
    region: String(cfg.region).replace(/^https?:\/\//, ''),
    endpoint: endpoint || undefined,
    accessKeyId: cfg.accessKeyId,
    accessKeySecret: cfg.accessKeySecret,
    bucket: cfg.bucket,
    secure: true,
    timeout: 60000,
  });
}

/** 对象 key = 前缀 + 相对路径 */
export function ossKeyFor(relPath, cfg) {
  const rel = String(relPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  return `${cfg.prefix}${rel}`;
}

/** 相对路径 = 对象 key 去掉前缀 */
export function relFromKey(key, cfg) {
  const k = String(key || '');
  return cfg.prefix && k.startsWith(cfg.prefix) ? k.slice(cfg.prefix.length) : k;
}

/** 校验相对路径（目录或文件），非法返回 null */
export function validateRelPath(raw, { allowRoot = false } = {}) {
  const rel = String(raw || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!rel) return allowRoot ? '' : null;
  const segments = rel.split('/');
  if (segments.some((s) => !s || s === '.' || s === '..' || s.startsWith('.') || s.includes('\0'))) {
    return null;
  }
  return rel;
}

// ---------- 目录树聚合 ----------

const SKIP_EXT = new Set([
  '.exe', '.dll', '.bat', '.cmd', '.sh', '.dmg', '.app', '.ttf', '.otf',
  '.woff', '.woff2', '.pdg', '.db', '.ini', '.lnk',
]);
const ARCHIVE_EXT = new Set(['.zip', '.rar', '.7z', '.tar', '.gz', '.tgz']);
const OFFICE_EXT = new Set(['.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.wps', '.rtf']);

/** 索引/说明文件与系统文件不展示、不可上传覆盖 */
export function isProtectedName(name) {
  if (name === 'README.md' || name === 'catalog.json' || /^catalog-.+\.json$/i.test(name)) return true;
  if (name.startsWith('.') || name === 'Thumbs.db' || name === 'desktop.ini') return true;
  return SKIP_EXT.has(String(name.match(/\.([^.]+)$/)?.[0] || '').toLowerCase());
}

export function previewMetaOf(name) {
  const ext = String(name.match(/\.([^.]+)$/)?.[0] || '').toLowerCase();
  if (ARCHIVE_EXT.has(ext)) return { previewable: false, kind: 'archive' };
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'].includes(ext)) return { previewable: true, kind: 'image' };
  if (['.mp4', '.webm', '.mov'].includes(ext)) return { previewable: true, kind: 'video' };
  if (['.mp3', '.wav', '.m4a'].includes(ext)) return { previewable: true, kind: 'audio' };
  if (ext === '.pdf') return { previewable: true, kind: 'pdf' };
  if (ext === '.txt' || ext === '.md') return { previewable: true, kind: 'text' };
  if (OFFICE_EXT.has(ext)) return { previewable: true, kind: 'office' };
  return { previewable: false, kind: 'file' };
}

export function extOf(name) {
  return String(name.match(/\.([^.]+)$/)?.[1] || '').toLowerCase();
}

/** 文件类型分组（与前端 typeTagOf 保持一致） */
function typeTagOfName(name) {
  const ext = extOf(name);
  const meta = previewMetaOf(name);
  if (meta.kind === 'image') return 'image';
  if (meta.kind === 'video') return 'video';
  if (meta.kind === 'audio') return 'audio';
  if (meta.kind === 'archive') return 'archive';
  if (meta.kind === 'pdf') return 'pdf';
  if (meta.kind === 'office') {
    if (ext.startsWith('ppt')) return 'ppt';
    if (ext.startsWith('xls')) return 'excel';
    return 'word';
  }
  if (meta.kind === 'text') return 'text';
  return 'other';
}

/** 递归补全文件 type 字段（兼容旧版 catalog.json） */
function ensureFileTypes(node) {
  for (const f of node.files || []) {
    if (!f.type) f.type = typeTagOfName(f.name);
  }
  for (const c of node.children || []) ensureFileTypes(c);
}

/** 全库文件类型统计：{ word: n, ppt: n, ... } */
function countTypes(root) {
  const map = {};
  const walk = (node) => {
    for (const f of node.files || []) {
      const k = f.type || typeTagOfName(f.name);
      map[k] = (map[k] || 0) + 1;
    }
    for (const c of node.children || []) walk(c);
  };
  walk(root);
  return map;
}

function formatSize(bytes) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function fileId(relPath) {
  return crypto.createHash('sha1').update(relPath).digest('hex').slice(0, 16);
}

function slugId(name) {
  const m = String(name).match(/^(\d+[A-Za-z]?)/);
  if (m) return m[1].toLowerCase();
  return crypto.createHash('md5').update(String(name)).digest('hex').slice(0, 8) || 'x';
}

export function slugIdFor(name) {
  return slugId(name);
}

/** 全量列出前缀下对象（分页聚合） */
export async function listAllObjects(client, prefix) {
  const out = [];
  let continuationToken;
  for (let page = 0; page < 500; page++) {
    const res = await client.listV2(
      { prefix, 'max-keys': 1000, ...(continuationToken ? { 'continuation-token': continuationToken } : {}) },
      {}
    );
    for (const obj of res.objects || []) {
      out.push({
        key: obj.name,
        size: Number(obj.size) || 0,
        etag: String(obj.etag || ''),
        lastModified: obj.lastModified ? new Date(obj.lastModified).getTime() : 0,
      });
    }
    if (!res.nextContinuationToken) break;
    continuationToken = res.nextContinuationToken;
  }
  return out;
}

/** 由扁平对象列表聚合为与旧版本地扫描一致的目录树结构 */
function buildTreeFromObjects(objects, cfg) {
  const root = {
    id: 'root',
    name: '全部资源',
    type: 'dir',
    relPath: '',
    children: [],
    files: [],
    fileCount: 0,
  };
  const dirMap = new Map([['', root]]);

  const ensureDir = (rel) => {
    if (dirMap.has(rel)) return dirMap.get(rel);
    const parts = rel.split('/');
    const name = parts.pop();
    const parent = ensureDir(parts.join('/'));
    const node = {
      id: rel,
      name,
      type: 'dir',
      relPath: rel,
      children: [],
      files: [],
      fileCount: 0,
    };
    parent.children.push(node);
    dirMap.set(rel, node);
    return node;
  };

  for (const obj of objects) {
    const rel = relFromKey(obj.key, cfg);
    if (!rel) continue;
    // 目录标记对象（key 以 / 结尾）：确保目录存在
    if (rel.endsWith('/')) {
      ensureDir(rel.slice(0, -1));
      continue;
    }
    const parts = rel.split('/');
    const name = parts.pop();
    if (parts.some((p) => !p)) continue;
    if (isProtectedName(name)) continue;
    const dirNode = ensureDir(parts.join('/'));
    const ext = extOf(name);
    const meta = previewMetaOf(name);
    dirNode.files.push({
      id: fileId(rel),
      name,
      relPath: rel,
      ext,
      type: typeTagOfName(name),
      size: obj.size,
      sizeText: formatSize(obj.size),
      previewable: meta.previewable,
      kind: meta.kind,
      etag: obj.etag,
      mtimeMs: obj.lastModified,
    });
  }

  const sortRec = (node) => {
    node.children.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
    node.files.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
    node.fileCount = node.files.length;
    for (const c of node.children) {
      sortRec(c);
      node.fileCount += c.fileCount;
    }
  };
  sortRec(root);
  return root;
}

/** 在树中按 relPath 找子树 */
export function findNodeInTree(tree, relPath) {
  const clean = String(relPath || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!clean) return tree;
  let node = tree;
  for (const seg of clean.split('/')) {
    node = (node.children || []).find((c) => c.name === seg);
    if (!node) return null;
  }
  return node;
}

/** 在树中按 relPath 精确查找文件（最后一段在 files 中，不在 children 中） */
export function findFileInTree(tree, relPath) {
  const clean = String(relPath || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!clean) return null;
  const idx = clean.lastIndexOf('/');
  const dirPath = idx >= 0 ? clean.slice(0, idx) : '';
  const dirNode = findNodeInTree(tree, dirPath);
  if (!dirNode || dirNode.type !== 'dir') return null;
  const file = (dirNode.files || []).find((f) => f.relPath === clean);
  return file ? { dir: dirNode, file } : null;
}

// ---------- 树缓存 + 桶内 catalog.json 索引 ----------

const TREE_TTL_MS = 60 * 1000;
const CATALOG_JSON_NAME = 'catalog.json'; // 受保护文件名（isProtectedName 已屏蔽展示/上传/删除）
let treeCache = null; // { tree, typeCounts, generatedAt, totalFiles, categoryCount, source }

export function invalidateOssTreeCache() {
  treeCache = null;
}

/** 目录索引对象 key：前缀根下的 catalog.json */
function catalogJsonKey(cfg) {
  return `${cfg.prefix}${CATALOG_JSON_NAME}`;
}

/** 从桶内读取目录索引 JSON（不存在或损坏返回 null） */
async function readCatalogJson(client, cfg) {
  try {
    const res = await client.get(catalogJsonKey(cfg));
    const data = JSON.parse(Buffer.from(res.content).toString('utf8'));
    if (data && data.tree && data.tree.type === 'dir' && Array.isArray(data.tree.children)) {
      return data;
    }
  } catch {
    /* 不存在 / 解析失败 → 走扫描 */
  }
  return null;
}

/** 将目录树写入桶内 catalog.json（含全库类型统计，供下次快速加载） */
async function writeCatalogJson(client, cfg, tree) {
  const payload = Buffer.from(
    JSON.stringify({
      version: 4,
      source: 'aliyun-oss',
      generatedAt: Date.now(),
      totalFiles: tree.fileCount,
      typeCounts: countTypes(tree),
      tree,
    }),
    'utf8'
  );
  await client.put(catalogJsonKey(cfg), payload);
  return payload.length;
}

/**
 * 扫描 OSS 生成目录树并写入桶内 catalog.json（管理端重建 / 写操作后自动触发）。
 */
export async function rebuildOssCatalog() {
  const cfg = await getOssConfig();
  assertOssReady(cfg);
  const client = await getOssClient({ internal: true });
  const started = Date.now();
  const objects = await listAllObjects(client, cfg.prefix);
  const tree = buildTreeFromObjects(objects, cfg);
  const jsonBytes = await writeCatalogJson(client, cfg, tree);
  const typeCounts = countTypes(tree);
  treeCache = {
    tree,
    typeCounts,
    generatedAt: Date.now(),
    totalFiles: tree.fileCount,
    categoryCount: tree.children.length,
    source: 'scan',
  };
  return { tree, typeCounts, totalFiles: tree.fileCount, categoryCount: tree.children.length, jsonBytes, elapsedMs: Date.now() - started };
}

/** 获取目录树：内存缓存 → 桶内 catalog.json → 全量扫描（扫描后自动回写 JSON） */
export async function getOssTree({ force = false } = {}) {
  if (!force && treeCache && Date.now() - treeCache.generatedAt < TREE_TTL_MS) {
    return treeCache;
  }
  const cfg = await getOssConfig();
  assertOssReady(cfg);
  const client = await getOssClient({ internal: true });
  if (!force) {
    // 优先读桶内索引 JSON（一次 GET，远快于分页列出全部对象）
    const json = await readCatalogJson(client, cfg);
    if (json?.tree) {
      const tree = json.tree;
      ensureFileTypes(tree); // 兼容旧版索引：补 type 字段
      treeCache = {
        tree,
        typeCounts: json.typeCounts && typeof json.typeCounts === 'object' ? json.typeCounts : countTypes(tree),
        generatedAt: Number(json.generatedAt) || Date.now(),
        totalFiles: Number(json.totalFiles) || tree.fileCount,
        categoryCount: (tree.children || []).length,
        source: 'catalog-json',
      };
      return treeCache;
    }
  }
  // 无索引 / 强制刷新：全量扫描并回写 catalog.json（尽力而为，失败不影响返回）
  const objects = await listAllObjects(client, cfg.prefix);
  const tree = buildTreeFromObjects(objects, cfg);
  const typeCounts = countTypes(tree);
  treeCache = {
    tree,
    typeCounts,
    generatedAt: Date.now(),
    totalFiles: tree.fileCount,
    categoryCount: tree.children.length,
    source: 'scan',
  };
  try {
    await writeCatalogJson(client, cfg, tree);
  } catch {
    /* 回写失败不阻塞 */
  }
  return treeCache;
}

// ---------- 签名 URL ----------

/** 下载/预览签名 GET URL（浏览器直连 OSS） */
export async function signGetUrl(relPath, { expireSeconds, attachment = false } = {}) {
  const cfg = await getOssConfig();
  assertOssReady(cfg);
  const client = await getOssClient({ internal: false });
  const key = ossKeyFor(relPath, cfg);
  const expires = Math.min(Math.max(Number(expireSeconds || cfg.urlExpireSeconds) || 3600, 300), 64800);
  const options = { expires };
  if (attachment) {
    const name = relPath.split('/').pop();
    options['response-content-disposition'] =
      `attachment; filename*=UTF-8''${encodeURIComponent(name)}`;
  }
  const url = client.signatureUrl(key, options);
  return { url, key, expiresAt: Date.now() + expires * 1000 };
}

/** 直传签名 PUT URL（浏览器 XHR PUT，服务器不经手字节流） */
export async function signPutUrl(objectKey, contentType, { expireSeconds } = {}) {
  const cfg = await getOssConfig();
  assertOssReady(cfg);
  const client = await getOssClient({ internal: false });
  const expires = Math.min(Math.max(Number(expireSeconds || cfg.urlExpireSeconds) || 3600, 300), 64800);
  const mime = contentType || 'application/octet-stream';
  const url = client.signatureUrl(objectKey, { method: 'PUT', expires, 'content-type': mime });
  return { url, key: objectKey, contentType: mime, expiresAt: Date.now() + expires * 1000 };
}

/** 同名不覆盖：基于目录树检查并返回 (1)(2)… 后缀名 */
export function dedupeName(dirNode, name) {
  const existing = new Set((dirNode?.files || []).map((f) => f.name));
  if (!existing.has(name)) return name;
  const ext = name.match(/\.([^.]+)$/)?.[0] || '';
  const base = ext ? name.slice(0, name.length - ext.length) : name;
  for (let i = 1; i < 10000; i++) {
    const candidate = `${base}(${i})${ext}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}${ext}`;
}
