/**
 * 创业路演模板库：目录索引 + 鉴权下载/预览（Office 按需转 PDF 缓存）
 * 管理端可手动重建目录索引。
 */
import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { createHash, randomUUID } from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { logError } from '../lib/logError.js';
import { requireAuth, requireSuperAdmin } from '../middleware/auth.js';
import { normalizeUploadFileName } from '../lib/uploadFileName.js';
import {
  readPitchCatalogSummary,
  rebuildPitchTemplateCatalog,
  resolvePitchTemplatesRoot,
  scanPitchTemplateTree,
} from '../lib/pitchTemplateCatalog.js';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PREVIEW_CACHE_ROOT = path.join(__dirname, '../../uploads/pitch-template-previews');
const UPLOAD_TMP_ROOT = path.join(__dirname, '../../uploads/pitch-template-tmp');
const UPLOAD_MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024; // 单文件上限 2GB
const UPLOAD_MAX_FILES = 20;
/** 目录索引与说明文件受保护，不允许被上传覆盖 */
const PROTECTED_NAMES = [/^catalog\.json$/i, /^catalog-.+\.json$/i, /^README\.md$/i];
const execFileAsync = promisify(execFile);

const OFFICE_EXTENSIONS = new Set(['.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.wps', '.rtf']);

function ok(req, res, data, message = 'OK') {
  return res.json({ code: 0, message, data, traceId: req.traceId });
}

function bad(req, res, status, code, message) {
  return res.status(status).json({ code, message, data: null, traceId: req.traceId });
}

function bearerFromQuery(req, _res, next) {
  if (!req.headers.authorization && typeof req.query.token === 'string' && req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function templateRoot() {
  return resolvePitchTemplatesRoot();
}

function resolveSafePath(relPath) {
  const raw = String(relPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!raw || raw.includes('\0') || raw.split('/').some((p) => p === '..')) {
    return null;
  }
  const root = path.resolve(templateRoot());
  const abs = path.resolve(root, raw);
  if (abs !== root && !abs.startsWith(root + path.sep)) {
    return null;
  }
  return { abs, rel: raw };
}

function libreOfficeCandidates() {
  return [
    process.env.LIBREOFFICE_BIN,
    '/Applications/LibreOffice.app/Contents/MacOS/soffice',
    '/opt/homebrew/bin/soffice',
    '/usr/local/bin/soffice',
    '/usr/bin/soffice',
    '/opt/homebrew/bin/libreoffice',
    '/usr/local/bin/libreoffice',
    '/usr/bin/libreoffice',
    'soffice',
    'libreoffice',
  ].filter(Boolean);
}

async function convertOfficeToPdf(absPath, cacheDir) {
  ensureDir(cacheDir);
  const inputBase = path.basename(absPath);
  const generatedPdf = path.join(cacheDir, `${path.basename(inputBase, path.extname(inputBase))}.pdf`);
  const previewName = `${randomUUID()}_preview.pdf`;
  const previewAbs = path.join(cacheDir, previewName);
  let lastError = null;
  for (const bin of libreOfficeCandidates()) {
    try {
      await execFileAsync(bin, ['--headless', '--convert-to', 'pdf', '--outdir', cacheDir, absPath], {
        timeout: 180000,
      });
      lastError = null;
      break;
    } catch (e) {
      lastError = e;
      if (e?.code !== 'ENOENT') break;
    }
  }
  if (lastError) {
    if (lastError.code === 'ENOENT') {
      throw new Error('服务器未安装 LibreOffice，无法转换 Office 文档');
    }
    throw lastError;
  }
  if (!fs.existsSync(generatedPdf)) throw new Error('Office 文档转换失败');
  fs.renameSync(generatedPdf, previewAbs);
  return previewAbs;
}

function cacheKeyFor(relPath, mtimeMs, size) {
  return createHash('sha1').update(`${relPath}|${mtimeMs}|${size}`).digest('hex');
}

/** 管理端上传：暂存到临时目录，校验后落入目标目录 */
const uploadTmp = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      try {
        ensureDir(UPLOAD_TMP_ROOT);
        cb(null, UPLOAD_TMP_ROOT);
      } catch (e) {
        cb(e);
      }
    },
    filename: (_req, file, cb) => {
      cb(null, `${randomUUID()}__${path.basename(file.originalname || 'file')}`);
    },
  }),
  limits: { fileSize: UPLOAD_MAX_FILE_BYTES, files: UPLOAD_MAX_FILES },
});

function multerErrorHandler(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    const msg =
      err.code === 'LIMIT_FILE_SIZE'
        ? '单个文件超过 2GB 上传限制'
        : err.code === 'LIMIT_FILE_COUNT'
          ? `一次最多上传 ${UPLOAD_MAX_FILES} 个文件`
          : `上传失败：${err.message}`;
    return bad(req, res, 400, 40005, msg);
  }
  return next(err);
}

/** 校验新建目录名（单段或多段相对路径） */
function validateDirRelPath(raw) {
  const rel = String(raw || '')
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '');
  if (!rel) return null;
  const segments = rel.split('/');
  if (segments.some((s) => !s || s === '.' || s === '..' || s.startsWith('.') || s.includes('\0'))) {
    return null;
  }
  return rel;
}

/** 移动文件；跨文件系统（EXDEV）时退化为复制+删除 */
function moveFile(src, dest) {
  try {
    fs.renameSync(src, dest);
  } catch (e) {
    if (e && e.code === 'EXDEV') {
      fs.copyFileSync(src, dest);
      fs.rmSync(src, { force: true });
    } else {
      throw e;
    }
  }
}

function guessContentType(ext) {
  const map = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.txt': 'text/plain; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
  };
  return map[ext] || 'application/octet-stream';
}

/** 管理端（仅超管）：当前索引状态 */
router.get('/admin/pitch-templates/catalog-status', requireAuth(), requireSuperAdmin(), async (req, res) => {
  try {
    return ok(req, res, readPitchCatalogSummary());
  } catch (e) {
    logError('GET /admin/pitch-templates/catalog-status', e);
    return bad(req, res, 500, 50001, e.message || '读取失败');
  }
});

/** 管理端（仅超管）：手动重建目录（同步大文件包或部署后可点） */
router.post('/admin/pitch-templates/rebuild-catalog', requireAuth(), requireSuperAdmin(), async (req, res) => {
  try {
    const started = Date.now();
    const result = rebuildPitchTemplateCatalog();
    return ok(
      req,
      res,
      { ...result, elapsedMs: Date.now() - started },
      `目录已重建：${result.categoryCount} 类 / ${result.totalFiles} 文件`
    );
  } catch (e) {
    logError('POST /admin/pitch-templates/rebuild-catalog', e);
    return bad(req, res, 500, 50001, e.message || '重建失败');
  }
});

/** 统计预览缓存目录（仅统计 .pdf 文件与遗留 _tmp_ 目录） */
function readPreviewCacheStats() {
  let fileCount = 0;
  let totalBytes = 0;
  if (fs.existsSync(PREVIEW_CACHE_ROOT)) {
    for (const name of fs.readdirSync(PREVIEW_CACHE_ROOT)) {
      const p = path.join(PREVIEW_CACHE_ROOT, name);
      let st;
      try {
        st = fs.statSync(p);
      } catch {
        continue;
      }
      if (st.isFile()) {
        fileCount += 1;
        totalBytes += st.size;
      }
    }
  }
  return { fileCount, totalBytes };
}

/** 管理端（仅超管）：预览转换缓存状态 */
router.get('/admin/pitch-templates/preview-cache-status', requireAuth(), requireSuperAdmin(), async (req, res) => {
  try {
    return ok(req, res, readPreviewCacheStats());
  } catch (e) {
    logError('GET /admin/pitch-templates/preview-cache-status', e);
    return bad(req, res, 500, 50001, e.message || '读取缓存状态失败');
  }
});

/** 管理端（仅超管）：清空预览转换缓存（删除全部缓存 PDF 与遗留临时目录；不影响源文件与索引） */
router.post('/admin/pitch-templates/preview-cache-clear', requireAuth(), requireSuperAdmin(), async (req, res) => {
  try {
    let removedFiles = 0;
    let freedBytes = 0;
    let removedTmpDirs = 0;
    if (fs.existsSync(PREVIEW_CACHE_ROOT)) {
      for (const name of fs.readdirSync(PREVIEW_CACHE_ROOT)) {
        const p = path.join(PREVIEW_CACHE_ROOT, name);
        let st;
        try {
          st = fs.statSync(p);
        } catch {
          continue;
        }
        if (st.isFile()) {
          freedBytes += st.size;
          fs.unlinkSync(p);
          removedFiles += 1;
        } else if (st.isDirectory() && name.startsWith('_tmp_')) {
          fs.rmSync(p, { recursive: true, force: true });
          removedTmpDirs += 1;
        }
      }
    }
    return ok(
      req,
      res,
      { removedFiles, freedBytes, removedTmpDirs },
      `已清空缓存：${removedFiles} 个 PDF，释放 ${(freedBytes / 1024 / 1024).toFixed(1)} MB`
    );
  } catch (e) {
    logError('POST /admin/pitch-templates/preview-cache-clear', e);
    return bad(req, res, 500, 50001, e.message || '清空缓存失败');
  }
});

/** 管理端（仅超管）：完整目录树（含文件），供资源维护文件管理器使用 */
router.get('/admin/pitch-templates/tree', requireAuth(), requireSuperAdmin(), async (req, res) => {
  try {
    const tree = scanPitchTemplateTree(String(req.query.path || ''));
    return ok(req, res, tree);
  } catch (e) {
    logError('GET /admin/pitch-templates/tree', e);
    return bad(req, res, 500, 50001, e.message || '读取目录树失败');
  }
});

/** 管理端（仅超管）：新建目录（支持多级，如 a/b/c） */
router.post('/admin/pitch-templates/mkdir', requireAuth(), requireSuperAdmin(), async (req, res) => {
  try {
    const rel = validateDirRelPath(req.body?.path);
    if (!rel) return bad(req, res, 400, 40002, '目录名非法（不能包含 / \\ .. 或以点开头）');
    const root = path.resolve(templateRoot());
    const abs = path.resolve(root, rel);
    if (abs !== root && !abs.startsWith(root + path.sep)) {
      return bad(req, res, 400, 40002, '目录路径非法');
    }
    if (fs.existsSync(abs)) {
      return fs.statSync(abs).isDirectory()
        ? ok(req, res, { rel }, '目录已存在')
        : bad(req, res, 400, 40004, '同名文件已存在，无法创建目录');
    }
    fs.mkdirSync(abs, { recursive: true });
    const result = rebuildPitchTemplateCatalog();
    return ok(
      req,
      res,
      { rel, totalFiles: result.totalFiles, categoryCount: result.categoryCount },
      '目录已创建，索引已更新'
    );
  } catch (e) {
    logError('POST /admin/pitch-templates/mkdir', e);
    return bad(req, res, 500, 50001, e.message || '创建目录失败');
  }
});

/** 管理端（仅超管）：删除目录（含内部全部文件，根目录不可删） */
router.post('/admin/pitch-templates/delete-dir', requireAuth(), requireSuperAdmin(), async (req, res) => {
  try {
    const rel = validateDirRelPath(req.body?.path);
    if (!rel) return bad(req, res, 400, 40002, '目录路径非法');
    const resolved = resolveSafePath(rel);
    if (!resolved) return bad(req, res, 400, 40002, '目录路径非法');
    if (!fs.existsSync(resolved.abs) || !fs.statSync(resolved.abs).isDirectory()) {
      return bad(req, res, 404, 40403, '目录不存在');
    }
    fs.rmSync(resolved.abs, { recursive: true, force: true });
    const result = rebuildPitchTemplateCatalog();
    return ok(
      req,
      res,
      { rel, totalFiles: result.totalFiles, categoryCount: result.categoryCount },
      '目录已删除，索引已更新'
    );
  } catch (e) {
    logError('POST /admin/pitch-templates/delete-dir', e);
    return bad(req, res, 500, 50001, e.message || '删除目录失败');
  }
});

/** 管理端（仅超管）：删除单个文件 */
router.post('/admin/pitch-templates/delete-file', requireAuth(), requireSuperAdmin(), async (req, res) => {
  try {
    const resolved = resolveSafePath(req.body?.path);
    if (!resolved || !resolved.rel) return bad(req, res, 400, 40002, '文件路径非法');
    if (PROTECTED_NAMES.some((re) => re.test(resolved.rel.split('/').pop() || ''))) {
      return bad(req, res, 400, 40004, '目录索引文件受保护，不能删除');
    }
    if (!fs.existsSync(resolved.abs) || !fs.statSync(resolved.abs).isFile()) {
      return bad(req, res, 404, 40403, '文件不存在');
    }
    fs.rmSync(resolved.abs, { force: true });
    const result = rebuildPitchTemplateCatalog();
    return ok(
      req,
      res,
      { rel: resolved.rel, totalFiles: result.totalFiles, categoryCount: result.categoryCount },
      '文件已删除，索引已更新'
    );
  } catch (e) {
    logError('POST /admin/pitch-templates/delete-file', e);
    return bad(req, res, 500, 50001, e.message || '删除文件失败');
  }
});

/** 管理端（仅超管）：上传文件（multipart，字段名 files，可多选；path 为目标目录相对路径，空为根） */
router.post(
  '/admin/pitch-templates/upload',
  requireAuth(),
  requireSuperAdmin(),
  uploadTmp.array('files', UPLOAD_MAX_FILES),
  multerErrorHandler,
  async (req, res) => {
    const files = Array.isArray(req.files) ? req.files : [];
    try {
      const targetRel = validateDirRelPath(req.body?.path) || '';
      const root = path.resolve(templateRoot());
      const targetAbs = targetRel ? path.resolve(root, targetRel) : root;
      if (targetAbs !== root && !targetAbs.startsWith(root + path.sep)) {
        return bad(req, res, 400, 40002, '目标目录路径非法');
      }
      if (targetRel && (!fs.existsSync(targetAbs) || !fs.statSync(targetAbs).isDirectory())) {
        return bad(req, res, 404, 40403, '目标目录不存在，请先创建');
      }
      if (!files.length) return bad(req, res, 400, 40004, '未选择任何文件');

      const saved = [];
      const skipped = [];
      for (const f of files) {
        // 修正 multipart 中文文件名乱码，并去掉路径分隔符
        const name = normalizeUploadFileName(path.basename(f.originalname || ''));
        if (!name || PROTECTED_NAMES.some((re) => re.test(name))) {
          skipped.push({ name: f.originalname, reason: '受保护的索引文件名，已跳过' });
          try { fs.rmSync(f.path, { force: true }); } catch { /* ignore */ }
          continue;
        }
        // 同名不覆盖：自动追加 (1)、(2)…
        let finalName = name;
        let i = 1;
        while (fs.existsSync(path.join(targetAbs, finalName))) {
          const ext = path.extname(name);
          finalName = `${path.basename(name, ext)}(${i})${ext}`;
          i += 1;
        }
        moveFile(f.path, path.join(targetAbs, finalName));
        saved.push(finalName);
      }

      const result = rebuildPitchTemplateCatalog();
      return ok(
        req,
        res,
        { saved, skipped, target: targetRel, totalFiles: result.totalFiles, categoryCount: result.categoryCount },
        `已上传 ${saved.length} 个文件${skipped.length ? `，跳过 ${skipped.length} 个` : ''}，索引已更新`
      );
    } catch (e) {
      // 兜底清理残留临时文件
      for (const f of files) {
        try { fs.rmSync(f.path, { force: true }); } catch { /* ignore */ }
      }
      logError('POST /admin/pitch-templates/upload', e);
      return bad(req, res, 500, 50001, e.message || '上传失败');
    }
  }
);

router.get('/pitch-templates/catalog', requireAuth(), async (req, res) => {
  try {
    const file = path.join(templateRoot(), 'catalog.json');
    if (!fs.existsSync(file)) {
      return bad(req, res, 404, 40401, '尚未生成目录索引，请管理员在系统配置中点击「重建模板目录」');
    }
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return ok(req, res, data);
  } catch (e) {
    logError('GET /pitch-templates/catalog', e);
    return bad(req, res, 500, 50001, e.message || '读取目录失败');
  }
});

router.get('/pitch-templates/catalog/:catId', requireAuth(), async (req, res) => {
  try {
    const catId = String(req.params.catId || '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (!catId) return bad(req, res, 400, 40001, '分类 id 无效');
    const file = path.join(templateRoot(), `catalog-${catId}.json`);
    if (!fs.existsSync(file)) {
      return bad(req, res, 404, 40402, '分类目录不存在');
    }
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return ok(req, res, data);
  } catch (e) {
    logError('GET /pitch-templates/catalog/:catId', e);
    return bad(req, res, 500, 50001, e.message || '读取分类失败');
  }
});

router.get('/pitch-templates/download', bearerFromQuery, requireAuth(), async (req, res) => {
  try {
    const resolved = resolveSafePath(req.query.path);
    if (!resolved) return bad(req, res, 400, 40002, '路径非法');
    if (!fs.existsSync(resolved.abs) || !fs.statSync(resolved.abs).isFile()) {
      return bad(req, res, 404, 40403, '文件不存在（请确认已上传到 resource/pitch-templates）');
    }
    const name = path.basename(resolved.abs);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(name)}`);
    fs.createReadStream(resolved.abs).pipe(res);
  } catch (e) {
    logError('GET /pitch-templates/download', e);
    return bad(req, res, 500, 50001, e.message || '下载失败');
  }
});

router.get('/pitch-templates/preview', bearerFromQuery, requireAuth(), async (req, res) => {
  try {
    const resolved = resolveSafePath(req.query.path);
    if (!resolved) return bad(req, res, 400, 40002, '路径非法');
    if (!fs.existsSync(resolved.abs) || !fs.statSync(resolved.abs).isFile()) {
      return bad(req, res, 404, 40403, '文件不存在（请确认已上传到 resource/pitch-templates）');
    }

    const ext = path.extname(resolved.abs).toLowerCase();
    const st = fs.statSync(resolved.abs);

    if (OFFICE_EXTENSIONS.has(ext)) {
      ensureDir(PREVIEW_CACHE_ROOT);
      const key = cacheKeyFor(resolved.rel, st.mtimeMs, st.size);
      const cached = path.join(PREVIEW_CACHE_ROOT, `${key}.pdf`);
      if (!fs.existsSync(cached)) {
        const tmpDir = path.join(PREVIEW_CACHE_ROOT, `_tmp_${key}`);
        ensureDir(tmpDir);
        try {
          const tmpInput = path.join(tmpDir, `input${ext}`);
          fs.copyFileSync(resolved.abs, tmpInput);
          const previewAbs = await convertOfficeToPdf(tmpInput, tmpDir);
          fs.copyFileSync(previewAbs, cached);
        } finally {
          try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
          } catch {
            /* ignore */
          }
        }
      }
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Cache-Control', 'private, max-age=3600');
      return fs.createReadStream(cached).pipe(res);
    }

    res.setHeader('Content-Type', guessContentType(ext));
    res.setHeader('Cache-Control', 'private, max-age=300');
    fs.createReadStream(resolved.abs).pipe(res);
  } catch (e) {
    logError('GET /pitch-templates/preview', e);
    return bad(req, res, 500, 50002, e.message || '预览失败');
  }
});

export default router;
