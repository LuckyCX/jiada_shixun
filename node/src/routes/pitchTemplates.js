/**
 * 创业路演模板库 —— OSS 版：目录树聚合 + 签名 URL 下载/直传 + Office 预览转 PDF 缓存
 * 数据源为阿里云 OSS（配置存 system_config 表 oss_config，管理后台可视化配置）。
 */
import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { createHash, randomUUID } from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';
import { logError } from '../lib/logError.js';
import { requireAuth, requireSuperAdmin } from '../middleware/auth.js';
import {
  getOssConfig,
  getOssClient,
  isOssConfigured,
  getOssTree,
  rebuildOssCatalog,
  findNodeInTree,
  findFileInTree,
  ossKeyFor,
  relFromKey,
  validateRelPath,
  signGetUrl,
  signPutUrl,
  dedupeName,
  isProtectedName,
  extOf,
  slugIdFor,
} from '../lib/ossResource.js';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PREVIEW_CACHE_ROOT = path.join(__dirname, '../../uploads/pitch-template-previews');
const PREVIEW_TMP_ROOT = path.join(__dirname, '../../uploads/pitch-template-tmp');

// Excel 不走 LibreOffice 转 PDF（表格样式差），由前端 SheetJS 直接解析渲染表格
const OFFICE_EXTENSIONS = new Set(['.doc', '.docx', '.ppt', '.pptx', '.wps', '.rtf']);
const execFileAsync = promisify(execFile);

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

function cacheKeyFor(relPath, etag, size, mtimeMs) {
  return createHash('sha1').update(`${relPath}|${etag}|${size}|${mtimeMs}`).digest('hex');
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

/** 文本编码检测：先按严格 UTF-8 解码，失败则按 GB18030（GBK 超集）解码，避免中文乱码 */
function decodeTextBestEffort(buf) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    try {
      return new TextDecoder('gb18030').decode(buf);
    } catch {
      return buf.toString('utf8');
    }
  }
}

/** 从 OSS 下载对象到本地临时文件 */
async function downloadObjectTo(client, key, absPath) {
  ensureDir(path.dirname(absPath));
  const res = await client.getStream(key);
  await new Promise((resolve, reject) => {
    const ws = fs.createWriteStream(absPath);
    res.stream.pipe(ws);
    res.stream.on('error', reject);
    ws.on('error', reject);
    ws.on('finish', resolve);
  });
}

/** 统计预览缓存目录 */
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

/** 管理端（仅超管）：索引状态（OSS 数据源） */
router.get('/admin/pitch-templates/catalog-status', requireAuth(), requireSuperAdmin(), async (req, res) => {
  try {
    const cfg = await getOssConfig();
    const base = {
      source: 'oss',
      enabled: !!cfg.enabled,
      configured: isOssConfigured(cfg),
      bucket: cfg.bucket || '',
      prefix: cfg.prefix || '',
      region: cfg.region || '',
      exists: false,
      totalFiles: 0,
      categoryCount: 0,
      generatedAt: null,
    };
    if (!isOssConfigured(cfg)) return ok(req, res, base);
    const cache = await getOssTree();
    return ok(req, res, {
      ...base,
      exists: true,
      totalFiles: cache.totalFiles,
      categoryCount: cache.categoryCount,
      generatedAt: new Date(cache.generatedAt).toISOString(),
    });
  } catch (e) {
    logError('GET /admin/pitch-templates/catalog-status', e);
    return bad(req, res, 500, 50001, e.message || '读取失败');
  }
});

/** 管理端（仅超管）：重建目录索引——扫描 OSS 实际对象并生成 catalog.json 存回桶内 */
router.post('/admin/pitch-templates/rebuild-catalog', requireAuth(), requireSuperAdmin(), async (req, res) => {
  try {
    const r = await rebuildOssCatalog();
    return ok(
      req,
      res,
      {
        root: 'oss',
        totalFiles: r.totalFiles,
        categoryCount: r.categoryCount,
        jsonBytes: r.jsonBytes,
        elapsedMs: r.elapsedMs,
        generatedAt: new Date().toISOString(),
      },
      `目录索引已生成：${r.categoryCount} 类 / ${r.totalFiles} 文件`
    );
  } catch (e) {
    logError('POST /admin/pitch-templates/rebuild-catalog', e);
    return bad(req, res, 500, 50001, e.message || '重建目录索引失败');
  }
});

/** 管理端（仅超管）：预览转换缓存状态 */
router.get('/admin/pitch-templates/preview-cache-status', requireAuth(), requireSuperAdmin(), async (req, res) => {
  try {
    return ok(req, res, readPreviewCacheStats());
  } catch (e) {
    logError('GET /admin/pitch-templates/preview-cache-status', e);
    return bad(req, res, 500, 50001, e.message || '读取缓存状态失败');
  }
});

/** 管理端（仅超管）：清空预览转换缓存 */
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
    const cache = await getOssTree();
    const node = findNodeInTree(cache.tree, String(req.query.path || ''));
    if (!node) return bad(req, res, 404, 40403, '目录不存在');
    return ok(req, res, node);
  } catch (e) {
    logError('GET /admin/pitch-templates/tree', e);
    return bad(req, res, 500, 50001, e.message || '读取目录树失败');
  }
});

/** 管理端（仅超管）：新建目录（写入目录标记对象，支持多级） */
router.post('/admin/pitch-templates/mkdir', requireAuth(), requireSuperAdmin(), async (req, res) => {
  try {
    const rel = validateRelPath(req.body?.path);
    if (rel === null || rel === '') return bad(req, res, 400, 40002, '目录名非法（不能包含 / \\ .. 或以点开头）');
    const cfg = await getOssConfig();
    const client = await getOssClient({ internal: true });
    const markerKey = `${ossKeyFor(rel, cfg)}/`;
    try {
      await client.put(markerKey, Buffer.alloc(0));
    } catch (e) {
      throw new Error(`创建目录失败：${e.message}`);
    }
    // 写操作成功后自动重建目录索引（扫描 + 回写 catalog.json）
    const r = await rebuildOssCatalog();
    return ok(
      req,
      res,
      { rel, totalFiles: r.totalFiles, categoryCount: r.categoryCount },
      '目录已创建'
    );
  } catch (e) {
    logError('POST /admin/pitch-templates/mkdir', e);
    return bad(req, res, 500, 50001, e.message || '创建目录失败');
  }
});

/** 管理端（仅超管）：删除目录（批量删除前缀下全部对象，根目录不可删） */
router.post('/admin/pitch-templates/delete-dir', requireAuth(), requireSuperAdmin(), async (req, res) => {
  try {
    const rel = validateRelPath(req.body?.path);
    if (rel === null || rel === '') return bad(req, res, 400, 40002, '目录路径非法');
    const cfg = await getOssConfig();
    const client = await getOssClient({ internal: true });
    const prefix = `${ossKeyFor(rel, cfg)}/`;
    // 先收集再删除，避免误删前缀相似的其他目录
    const { listAllObjects } = await import('../lib/ossResource.js');
    const objects = await listAllObjects(client, prefix);
    if (!objects.length) return bad(req, res, 404, 40403, '目录不存在');
    let deleted = 0;
    for (let i = 0; i < objects.length; i += 1000) {
      const names = objects.slice(i, i + 1000).map((o) => o.key);
      const r = await client.deleteMulti(names, { quiet: true });
      deleted += names.length - (Array.isArray(r?.failed) ? r.failed.length : 0);
    }
    const rebuilt = await rebuildOssCatalog();
    return ok(
      req,
      res,
      { rel, deleted, totalFiles: rebuilt.totalFiles, categoryCount: rebuilt.categoryCount },
      `目录已删除（${deleted} 个对象）`
    );
  } catch (e) {
    logError('POST /admin/pitch-templates/delete-dir', e);
    return bad(req, res, 500, 50001, e.message || '删除目录失败');
  }
});

/** 管理端（仅超管）：删除单个文件 */
router.post('/admin/pitch-templates/delete-file', requireAuth(), requireSuperAdmin(), async (req, res) => {
  try {
    const rel = validateRelPath(req.body?.path);
    if (!rel) return bad(req, res, 400, 40002, '文件路径非法');
    if (isProtectedName(rel.split('/').pop() || '')) {
      return bad(req, res, 400, 40004, '目录索引文件受保护，不能删除');
    }
    const cfg = await getOssConfig();
    const client = await getOssClient({ internal: true });
    const key = ossKeyFor(rel, cfg);
    try {
      await client.head(key);
    } catch {
      return bad(req, res, 404, 40403, '文件不存在');
    }
    await client.delete(key);
    const r = await rebuildOssCatalog();
    return ok(
      req,
      res,
      { rel, totalFiles: r.totalFiles, categoryCount: r.categoryCount },
      '文件已删除'
    );
  } catch (e) {
    logError('POST /admin/pitch-templates/delete-file', e);
    return bad(req, res, 500, 50001, e.message || '删除文件失败');
  }
});

/** 管理端（仅超管）：申请直传签名 PUT URL（同名自动追加 (1)；受保护文件名拒绝） */
router.post('/admin/pitch-templates/upload-url', requireAuth(), requireSuperAdmin(), async (req, res) => {
  try {
    const targetRel = validateRelPath(req.body?.path, { allowRoot: true });
    if (targetRel === null) return bad(req, res, 400, 40002, '目标目录路径非法');
    const name = String(req.body?.name || '').trim();
    if (!name || name.includes('/') || name.includes('\\')) {
      return bad(req, res, 400, 40002, '文件名非法');
    }
    if (isProtectedName(name)) {
      return bad(req, res, 400, 40004, '目录索引文件名受保护，不能上传');
    }
    const cache = await getOssTree();
    const dirNode = targetRel ? findNodeInTree(cache.tree, targetRel) : cache.tree;
    if (!dirNode) return bad(req, res, 404, 40403, '目标目录不存在，请先创建');
    const finalName = dedupeName(dirNode, name);
    const objectRel = targetRel ? `${targetRel}/${finalName}` : finalName;
    const cfg = await getOssConfig();
    const signed = await signPutUrl(ossKeyFor(objectRel, cfg), req.body?.contentType);
    return ok(req, res, {
      ...signed,
      objectRel,
      finalName,
      target: targetRel,
    });
  } catch (e) {
    logError('POST /admin/pitch-templates/upload-url', e);
    return bad(req, res, 500, 50001, e.message || '生成上传签名失败');
  }
});

/** 管理端（仅超管）：直传完成回调（校验对象存在并刷新目录缓存） */
router.post('/admin/pitch-templates/upload-complete', requireAuth(), requireSuperAdmin(), async (req, res) => {
  try {
    const rel = validateRelPath(req.body?.path);
    if (!rel) return bad(req, res, 400, 40002, '对象路径非法');
    const cfg = await getOssConfig();
    const client = await getOssClient({ internal: true });
    const key = ossKeyFor(rel, cfg);
    let meta;
    try {
      meta = await client.head(key);
    } catch {
      return bad(req, res, 404, 40403, '未在 OSS 上找到该对象，上传可能失败');
    }
    // 上传成功后自动重建目录索引（扫描 + 回写 catalog.json）
    const r = await rebuildOssCatalog();
    return ok(
      req,
      res,
      { rel, size: Number(meta?.res?.headers?.get?.('content-length') || 0), totalFiles: r.totalFiles, categoryCount: r.categoryCount },
      '上传完成，目录索引已更新'
    );
  } catch (e) {
    logError('POST /admin/pitch-templates/upload-complete', e);
    return bad(req, res, 500, 50001, e.message || '确认上传失败');
  }
});

/** 管理端（仅超管）：OSS 连接测试（列表 + 写入/删除探针对象） */
router.post('/admin/pitch-templates/oss-test', requireAuth(), requireSuperAdmin(), async (req, res) => {
  try {
    const b = req.body || {};
    // 表单值构建临时客户端；SK 为掩码时回退取库中已保存密钥（未改密钥的常见场景）
    let override = null;
    if (b.region && b.bucket && b.accessKeyId && b.accessKeySecret) {
      let secret = b.accessKeySecret;
      if (secret === '********') {
        const stored = await getOssConfig();
        if (!stored.accessKeySecret) {
          return bad(req, res, 400, 40002, '密钥为掩码且系统中暂无已保存的密钥，请重新输入 AccessKeySecret');
        }
        secret = stored.accessKeySecret;
      }
      override = {
        enabled: true,
        region: b.region,
        endpoint: b.endpoint,
        internalEndpoint: b.internalEndpoint,
        bucket: b.bucket,
        accessKeyId: b.accessKeyId,
        accessKeySecret: secret,
        prefix: b.prefix,
      };
    }
    const steps = [];
    // 1) 列表读
    const pub = await getOssClient(override ? { override } : {});
    const listRes = await pub.listV2({ 'max-keys': 1 }, {});
    steps.push({ step: 'list', ok: true });
    // 2) 写入 + 删除探针（验证写权限）
    if (!b.readonly) {
      const cfgForProbe = override || (await getOssConfig());
      const probeKey = `${cfgForProbe.prefix}.system-probe/${Date.now()}.txt`;
      const int = await getOssClient(override ? { override, internal: true } : { internal: true });
      await int.put(probeKey, Buffer.from('probe'));
      await int.delete(probeKey);
      steps.push({ step: 'write', ok: true });
    }
    return ok(req, res, { steps, bucket: b.bucket || (await getOssConfig()).bucket }, 'OSS 连接测试通过');
  } catch (e) {
    logError('POST /admin/pitch-templates/oss-test', e);
    return bad(req, res, 500, 50001, `OSS 连接测试失败：${e.message}`);
  }
});

/** 用户端（登录即可）：分类索引（由 OSS 目录树实时聚合） */
router.get('/pitch-templates/catalog', requireAuth(), async (req, res) => {
  try {
    const cache = await getOssTree();
    return ok(req, res, {
      version: 2,
      root: 'pitch-templates',
      generatedAt: new Date(cache.generatedAt).toISOString(),
      sourceNote: 'aliyun-oss',
      totalFiles: cache.totalFiles,
      categories: cache.tree.children.map((c) => ({
        id: slugIdFor(c.name),
        name: c.name,
        fileCount: c.fileCount,
      })),
    });
  } catch (e) {
    logError('GET /pitch-templates/catalog', e);
    return bad(req, res, 500, 50001, e.message || '读取目录失败');
  }
});

/** 用户端（登录即可）：全目录树（含全库文件类型统计，供总分类筛选与定位） */
router.get('/pitch-templates/tree', requireAuth(), async (req, res) => {
  try {
    const cache = await getOssTree();
    return ok(req, res, {
      name: '全部资源',
      totalFiles: cache.totalFiles,
      typeCounts: cache.typeCounts || {},
      tree: cache.tree,
    });
  } catch (e) {
    logError('GET /pitch-templates/tree', e);
    return bad(req, res, 500, 50001, e.message || '读取目录树失败');
  }
});

/** 用户端（登录即可）：分类详情（slugId 定位顶层目录子树） */
router.get('/pitch-templates/catalog/:catId', requireAuth(), async (req, res) => {
  try {
    const catId = String(req.params.catId || '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (!catId) return bad(req, res, 400, 40001, '分类 id 无效');
    const cache = await getOssTree();
    const node = cache.tree.children.find((c) => slugIdFor(c.name) === catId);
    if (!node) return bad(req, res, 404, 40402, '分类目录不存在');
    return ok(req, res, {
      version: 2,
      id: catId,
      name: node.name,
      fileCount: node.fileCount,
      tree: node,
    });
  } catch (e) {
    logError('GET /pitch-templates/catalog/:catId', e);
    return bad(req, res, 500, 50001, e.message || '读取分类失败');
  }
});

/** 用户端（登录即可）：获取下载签名 URL（302 兼容旧链路） */
router.get('/pitch-templates/file-url', bearerFromQuery, requireAuth(), async (req, res) => {
  try {
    const rel = validateRelPath(req.query.path);
    if (!rel) return bad(req, res, 400, 40002, '路径非法');
    const cache = await getOssTree();
    const found = findFileInTree(cache.tree, rel);
    if (!found) {
      return bad(req, res, 404, 40403, '文件不存在');
    }
    const signed = await signGetUrl(rel, { attachment: req.query.mode !== 'inline' });
    return ok(req, res, signed);
  } catch (e) {
    logError('GET /pitch-templates/file-url', e);
    return bad(req, res, 500, 50001, e.message || '获取下载地址失败');
  }
});

/** 兼容旧链路：302 跳转到签名 URL（同样校验文件必须存在于目录树中） */
router.get('/pitch-templates/download', bearerFromQuery, requireAuth(), async (req, res) => {
  try {
    const rel = validateRelPath(req.query.path);
    if (!rel) return bad(req, res, 400, 40002, '路径非法');
    const cache = await getOssTree();
    const found = findFileInTree(cache.tree, rel);
    if (!found) {
      return bad(req, res, 404, 40403, '文件不存在');
    }
    const signed = await signGetUrl(rel, { attachment: true });
    return res.redirect(302, signed.url);
  } catch (e) {
    logError('GET /pitch-templates/download', e);
    return bad(req, res, 500, 50001, e.message || '下载失败');
  }
});

/** 用户端（登录即可）：预览
 * - office：OSS 拉对象 → LibreOffice 转 PDF → 本地缓存 → 流式返回
 * - 文本/图片等小文件：服务端流式返回
 */
router.get('/pitch-templates/preview', bearerFromQuery, requireAuth(), async (req, res) => {
  try {
    const rel = validateRelPath(req.query.path);
    if (!rel) return bad(req, res, 400, 40002, '路径非法');
    const cfg = await getOssConfig();
    const cache = await getOssTree();
    const found = findFileInTree(cache.tree, rel);
    if (!found) return bad(req, res, 404, 40403, '文件不存在');

    const client = await getOssClient({ internal: true });
    const key = ossKeyFor(rel, cfg);
    const ext = `.${extOf(rel)}`;

    if (OFFICE_EXTENSIONS.has(ext)) {
      ensureDir(PREVIEW_CACHE_ROOT);
      const cacheId = cacheKeyFor(rel, found.file.etag || '', found.file.size, found.file.mtimeMs || 0);
      const cached = path.join(PREVIEW_CACHE_ROOT, `${cacheId}.pdf`);
      if (!fs.existsSync(cached)) {
        const tmpDir = path.join(PREVIEW_CACHE_ROOT, `_tmp_${cacheId}`);
        ensureDir(tmpDir);
        try {
          const tmpInput = path.join(PREVIEW_TMP_ROOT, `dl_${cacheId}${ext}`);
          await downloadObjectTo(client, key, tmpInput);
          const previewAbs = await convertOfficeToPdf(tmpInput, tmpDir);
          fs.copyFileSync(previewAbs, cached);
          try { fs.rmSync(tmpInput, { force: true }); } catch { /* ignore */ }
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

    // 非文档小文件：直接流式转发（视频/音频/图片由浏览器跟随 <img>/<video> 标签拉取）
    if (['.mp4', '.webm', '.mov', '.mp3', '.wav', '.m4a'].includes(ext)) {
      // 大媒体文件：302 到签名 URL（浏览器标签直连 OSS，支持 Range）
      const signed = await signGetUrl(rel, { expireSeconds: 7200 });
      return res.redirect(302, signed.url);
    }
    // 文本文件：下载 buffer 后智能检测编码（UTF-8 / GB18030）统一转 UTF-8 返回，避免乱码
    if (['.txt', '.md'].includes(ext)) {
      const obj = await client.get(key);
      res.setHeader('Content-Type', ext === '.md' ? 'text/markdown; charset=utf-8' : 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'private, max-age=300');
      return res.send(decodeTextBestEffort(Buffer.from(obj.content)));
    }
    const streamRes = await client.getStream(key);
    res.setHeader('Content-Type', guessContentType(ext));
    res.setHeader('Cache-Control', 'private, max-age=300');
    Readable.from(streamRes.stream).pipe(res);
  } catch (e) {
    logError('GET /pitch-templates/preview', e);
    if (res.headersSent) return res.end();
    return bad(req, res, 500, 50002, e.message || '预览失败');
  }
});

export default router;
