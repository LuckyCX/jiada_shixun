/**
 * 创业路演模板库目录扫描：生成 catalog.json 与各分类 catalog-XX.json
 * 供 CLI 脚本、管理端按钮、部署后自动执行共用。
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SKIP_EXT = new Set([
  '.exe',
  '.dll',
  '.bat',
  '.cmd',
  '.sh',
  '.dmg',
  '.app',
  '.ttf',
  '.otf',
  '.woff',
  '.woff2',
  '.pdg',
  '.ds_store',
  '.db',
  '.ini',
  '.lnk',
]);

const ARCHIVE_EXT = new Set(['.zip', '.rar', '.7z', '.tar', '.gz', '.tgz']);
const OFFICE_EXT = new Set(['.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.wps', '.rtf']);
const PREVIEW_EXT = new Set([
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.bmp',
  '.mp4',
  '.webm',
  '.mp3',
  '.wav',
  '.txt',
  '.md',
  ...OFFICE_EXT,
]);

/**
 * 解析模板根目录：
 * - 环境变量 PITCH_TEMPLATES_ROOT 优先
 * - Docker：/app/resource/pitch-templates（compose 挂载 ./resource）
 * - 本地：仓库根 resource/pitch-templates
 */
export function resolvePitchTemplatesRoot() {
  if (process.env.PITCH_TEMPLATES_ROOT) {
    return path.resolve(process.env.PITCH_TEMPLATES_ROOT);
  }
  const candidates = [
    path.join(__dirname, '../../resource/pitch-templates'), // /app/src/lib → /app/resource
    path.join(__dirname, '../../../resource/pitch-templates'), // 本地 monorepo
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

function slugId(name, fallback) {
  const m = String(name).match(/^(\d+[A-Za-z]?)/);
  if (m) return m[1].toLowerCase();
  return crypto.createHash('md5').update(String(name)).digest('hex').slice(0, 8) || fallback;
}

function fileId(relPath) {
  return crypto.createHash('sha1').update(relPath).digest('hex').slice(0, 16);
}

function formatSize(bytes) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function shouldSkipFile(name) {
  if (name.startsWith('.') || name === 'Thumbs.db' || name === 'desktop.ini') return true;
  if (name === 'catalog.json' || /^catalog-.+\.json$/i.test(name) || name === 'README.md') return true;
  return SKIP_EXT.has(path.extname(name).toLowerCase());
}

function previewMeta(ext) {
  const e = ext.toLowerCase();
  if (ARCHIVE_EXT.has(e)) return { previewable: false, kind: 'archive' };
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'].includes(e)) {
    return { previewable: true, kind: 'image' };
  }
  if (['.mp4', '.webm', '.mov'].includes(e)) return { previewable: true, kind: 'video' };
  if (['.mp3', '.wav', '.m4a'].includes(e)) return { previewable: true, kind: 'audio' };
  if (e === '.pdf') return { previewable: true, kind: 'pdf' };
  if (['.txt', '.md'].includes(e)) return { previewable: true, kind: 'text' };
  if (OFFICE_EXT.has(e)) return { previewable: true, kind: 'office' };
  if (PREVIEW_EXT.has(e)) return { previewable: true, kind: 'file' };
  return { previewable: false, kind: 'file' };
}

function walkDir(absDir, relDir) {
  const node = {
    id: relDir || 'root',
    name: relDir ? path.basename(relDir) : path.basename(absDir),
    type: 'dir',
    relPath: relDir,
    children: [],
    files: [],
    fileCount: 0,
  };

  let entries = [];
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true });
  } catch {
    return node;
  }

  entries.sort((a, b) => a.name.localeCompare(b.name, 'zh'));

  for (const ent of entries) {
    if (ent.name.startsWith('.')) continue;
    const abs = path.join(absDir, ent.name);
    const rel = relDir ? `${relDir}/${ent.name}` : ent.name;
    if (ent.isDirectory()) {
      const child = walkDir(abs, rel);
      node.children.push(child);
      node.fileCount += child.fileCount;
    } else if (ent.isFile()) {
      if (shouldSkipFile(ent.name)) continue;
      let st;
      try {
        st = fs.statSync(abs);
      } catch {
        continue;
      }
      const ext = path.extname(ent.name).toLowerCase();
      const meta = previewMeta(ext);
      const relNorm = rel.split(path.sep).join('/');
      node.files.push({
        id: fileId(relNorm),
        name: ent.name,
        relPath: relNorm,
        ext: ext.replace(/^\./, ''),
        size: st.size,
        sizeText: formatSize(st.size),
        previewable: meta.previewable,
        kind: meta.kind,
      });
      node.fileCount += 1;
    }
  }
  return node;
}

/** 管理端目录树扫描：返回指定目录（相对根）的完整子树（含空目录） */
export function scanPitchTemplateTree(relDir = '') {
  const root = resolvePitchTemplatesRoot();
  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
  const clean = String(relDir || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!clean) return walkDir(root, '');
  if (clean.split('/').some((p) => !p || p === '.' || p === '..' || p.startsWith('.'))) {
    throw new Error('目录路径非法');
  }
  const abs = path.resolve(root, clean);
  if (abs !== root && !abs.startsWith(root + path.sep)) throw new Error('目录路径非法');
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) throw new Error('目录不存在');
  return walkDir(abs, clean);
}

/**
 * 扫描并写出索引。
 * @param {{ src?: string, out?: string }} [opts]
 * @returns {{ root: string, totalFiles: number, categoryCount: number, generatedAt: string, categories: object[] }}
 */
export function rebuildPitchTemplateCatalog(opts = {}) {
  const root = opts.src || opts.out || resolvePitchTemplatesRoot();
  const outDir = opts.out || root;

  if (!fs.existsSync(root)) {
    fs.mkdirSync(root, { recursive: true });
  }
  fs.mkdirSync(outDir, { recursive: true });

  const top = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh'));

  const categories = [];
  let totalFiles = 0;

  for (let i = 0; i < top.length; i++) {
    const dir = top[i];
    const id = slugId(dir.name, `c${i}`);
    const abs = path.join(root, dir.name);
    const tree = walkDir(abs, dir.name);
    totalFiles += tree.fileCount;

    const catFile = `catalog-${id}.json`;
    fs.writeFileSync(
      path.join(outDir, catFile),
      JSON.stringify({
        version: 1,
        id,
        name: dir.name,
        fileCount: tree.fileCount,
        tree,
      }),
      'utf8'
    );

    categories.push({
      id,
      name: dir.name,
      fileCount: tree.fileCount,
      catalog: catFile,
    });
  }

  const generatedAt = new Date().toISOString();
  const index = {
    version: 1,
    root: 'pitch-templates',
    generatedAt,
    sourceNote: root,
    totalFiles,
    categories,
  };
  fs.writeFileSync(path.join(outDir, 'catalog.json'), JSON.stringify(index, null, 2), 'utf8');

  return {
    root,
    totalFiles,
    categoryCount: categories.length,
    generatedAt,
    categories,
  };
}

/** 读取已有索引摘要（不存在则 null） */
export function readPitchCatalogSummary() {
  const root = resolvePitchTemplatesRoot();
  const file = path.join(root, 'catalog.json');
  if (!fs.existsSync(file)) {
    return { root, exists: false, totalFiles: 0, categoryCount: 0, generatedAt: null };
  }
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return {
      root,
      exists: true,
      totalFiles: Number(data.totalFiles || 0),
      categoryCount: Array.isArray(data.categories) ? data.categories.length : 0,
      generatedAt: data.generatedAt || null,
      categories: data.categories || [],
    };
  } catch {
    return { root, exists: false, totalFiles: 0, categoryCount: 0, generatedAt: null };
  }
}
