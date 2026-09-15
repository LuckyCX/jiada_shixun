import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createHash, randomUUID } from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import multer from 'multer';
import { getPool } from '../lib/db.js';
import { logError } from '../lib/logError.js';
import { normalizeUploadFileName } from '../lib/uploadFileName.js';
import { requireAuth, requireStudent, requireTeacher } from '../middleware/auth.js';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_ROOT = path.join(__dirname, '../../uploads/course-resources');
const MAX_RESOURCE_BYTES = 500 * 1024 * 1024;
const execFileAsync = promisify(execFile);
const OFFICE_EXTENSIONS = new Set(['.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx']);
const ARCHIVE_EXTENSIONS = new Set(['.zip', '.rar', '.7z', '.tar', '.gz', '.tgz']);

const MODULES = [
  { key: 'ideation', name: '创新思维与创意生成', shortName: '创新思维', color: 'bg-gradient-to-r from-teal-500 to-teal-600' },
  { key: 'market', name: '市场调研与用户画像', shortName: '市场调研', color: 'bg-gradient-to-r from-green-500 to-green-600' },
  { key: 'product', name: '产品设计与迭代', shortName: '产品设计', color: 'bg-gradient-to-r from-orange-500 to-orange-600' },
  { key: 'business', name: '商业模式设计', shortName: '商业模式', color: 'bg-gradient-to-r from-pink-500 to-pink-600' },
  { key: 'simulation', name: 'AI仿真模拟', shortName: 'AI仿真', color: 'bg-gradient-to-r from-indigo-500 to-indigo-600' },
  { key: 'plan', name: '商业计划书要点', shortName: '商业计划', color: 'bg-gradient-to-r from-teal-600 to-cyan-600' },
];

function ok(req, res, data, message = 'OK') {
  return res.json({ code: 0, message, data, traceId: req.traceId });
}

function bad(req, res, status, code, message) {
  return res.status(status).json({ code, message, data: null, traceId: req.traceId });
}

function parseId(val) {
  const id = Number(String(val || '').trim());
  return Number.isFinite(id) && id > 0 ? id : null;
}

function userIdFromReq(req) {
  const id = Number(String(req.user?.sub || '').trim());
  return Number.isFinite(id) && id > 0 ? id : null;
}

function moduleByKey(key) {
  return MODULES.find((m) => m.key === key) || null;
}

function normalizeText(value) {
  return String(value || '').trim();
}

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function extOf(name) {
  return path.extname(String(name || '')).toLowerCase();
}

function getUploadKind(mime, name) {
  const ext = extOf(name);
  const m = String(mime || '').toLowerCase();
  if (m.startsWith('video/')) return { resourceType: 'video', previewMimeType: mime || 'video/mp4', canPreview: true };
  if (m.startsWith('audio/')) return { resourceType: 'audio', previewMimeType: mime || 'audio/mpeg', canPreview: true };
  if (m.startsWith('image/')) return { resourceType: 'image', previewMimeType: mime || 'image/png', canPreview: true };
  if (m === 'application/pdf' || ext === '.pdf') return { resourceType: 'pdf', previewMimeType: 'application/pdf', canPreview: true };
  if (OFFICE_EXTENSIONS.has(ext)) return { resourceType: 'pdf', previewMimeType: 'application/pdf', canPreview: true, needsOfficeConvert: true };
  if (ARCHIVE_EXTENSIONS.has(ext)) return { resourceType: 'archive', previewMimeType: null, canPreview: false };
  return null;
}

function canPreviewResource(mime, name) {
  const n = String(name || '').toLowerCase();
  const m = String(mime || '').toLowerCase();
  return (
    m.startsWith('image/') ||
    m.startsWith('video/') ||
    m.startsWith('audio/') ||
    m.startsWith('text/') ||
    m === 'application/pdf' ||
    n.endsWith('.pdf')
  );
}

function hashFile(absPath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = fs.createReadStream(absPath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
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

async function convertOfficeToPdf(absPath) {
  const outDir = path.dirname(absPath);
  const inputBase = path.basename(absPath);
  const generatedPdf = path.join(outDir, `${path.basename(inputBase, path.extname(inputBase))}.pdf`);
  const previewName = `${randomUUID()}_preview.pdf`;
  const previewAbs = path.join(outDir, previewName);
  let lastError = null;
  for (const bin of libreOfficeCandidates()) {
    try {
      await execFileAsync(bin, ['--headless', '--convert-to', 'pdf', '--outdir', outDir, absPath], { timeout: 120000 });
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

function resourceAbsPath(storagePath) {
  return path.join(UPLOAD_ROOT, storagePath);
}

function bearerFromQuery(req, _res, next) {
  if (!req.headers.authorization && typeof req.query.token === 'string' && req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
}

function previewTypeFromMime(mime, resourceType) {
  const m = String(mime || '').toLowerCase();
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';
  if (m.startsWith('image/')) return 'image';
  if (m === 'application/pdf') return 'pdf';
  if (resourceType === 'archive') return 'archive';
  return 'file';
}

function mapResource(row) {
  const originName = normalizeUploadFileName(row.origin_name);
  const previewMime = row.preview_mime_type || row.mime_type || '';
  const previewStatus = row.preview_status || 'ready';
  const previewType = previewTypeFromMime(previewMime, row.resource_type);
  const canPreview = previewStatus === 'ready' && row.resource_type !== 'archive' && canPreviewResource(previewMime, originName);
  return {
    id: String(row.id),
    nodeId: String(row.node_id),
    name: originName,
    type: row.resource_type,
    mimeType: row.mime_type || '',
    previewType,
    previewStatus,
    contentHash: row.content_hash || '',
    sizeBytes: Number(row.size_bytes || 0),
    size: formatSize(Number(row.size_bytes || 0)),
    uploadTime: row.created_at ? String(row.created_at).slice(0, 16).replace('T', ' ') : '',
    canPreview,
  };
}

function mapKnowledge(row) {
  return {
    id: String(row.id),
    title: row.title,
    description: row.description || '',
    moduleKey: row.module_key || '',
    moduleName: row.module_name || '',
    status: row.status || 'draft',
    sortOrder: Number(row.sort_order || 0),
  };
}

function mapQuestion(row) {
  return {
    id: String(row.id),
    type: row.question_type,
    question: row.question_text,
    options: Array.isArray(row.options) ? row.options : [],
    correctAnswer: row.correct_answer ?? (row.question_type === 'multiple' ? [] : undefined),
    keywords: Array.isArray(row.keywords) ? row.keywords : [],
    score: Number(row.score || 0),
    explanation: row.explanation || '',
  };
}

function buildTree(nodeRows, resourceRows, linkRows) {
  const byId = new Map();
  const roots = [];
  for (const row of nodeRows) {
    byId.set(String(row.id), {
      id: String(row.id),
      moduleKey: row.module_key,
      moduleName: row.module_name,
      parentId: row.parent_id ? String(row.parent_id) : null,
      level: Number(row.level),
      title: row.title,
      status: row.status,
      sortOrder: Number(row.sort_order || 0),
      resources: [],
      knowledgePoints: [],
      children: [],
    });
  }
  for (const row of resourceRows) {
    const node = byId.get(String(row.node_id));
    if (node) node.resources.push(mapResource(row));
  }
  for (const row of linkRows) {
    const node = byId.get(String(row.node_id));
    if (node) {
      node.knowledgePoints.push({
        id: String(row.knowledge_point_id),
        title: row.title,
      });
    }
  }
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) byId.get(node.parentId).children.push(node);
    else roots.push(node);
  }
  const sortNodes = (items) => {
    items.sort((a, b) => a.sortOrder - b.sortOrder || Number(a.id) - Number(b.id));
    items.forEach((item) => sortNodes(item.children));
  };
  sortNodes(roots);
  return roots;
}

function collectResourceHashes(nodes) {
  const hashes = new Set();
  const walk = (node) => {
    node.resources.forEach((resource) => {
      if (resource.contentHash) hashes.add(resource.contentHash);
    });
    node.children.forEach(walk);
  };
  nodes.forEach(walk);
  return Array.from(hashes);
}

function attachResourceProgress(nodes, progressRows) {
  const progressByHash = new Map(progressRows.map((row) => [row.content_hash, {
    progressPercent: Number(row.progress_percent || 0),
    lastPosition: row.last_position || {},
    completed: Boolean(row.completed_at),
  }]));
  const walk = (node) => {
    node.resources = node.resources.map((resource) => ({
      ...resource,
      progress: progressByHash.get(resource.contentHash) || {
        progressPercent: 0,
        lastPosition: {},
        completed: false,
      },
    }));
    node.children.forEach(walk);
  };
  nodes.forEach(walk);
  return nodes;
}

async function loadResourceTree(pool, moduleKey, onlyPublished = false) {
  const params = [moduleKey];
  const { rows: nodes } = await pool.query(
    `SELECT * FROM course_resource_nodes
     WHERE module_key = $1
     ORDER BY level ASC, sort_order ASC, id ASC`,
    params
  );
  const nodeIds = nodes.map((n) => n.id);
  if (!nodeIds.length) return [];

  const { rows: files } = await pool.query(
    `SELECT * FROM course_resource_files
     WHERE node_id = ANY($1::bigint[])
     ORDER BY created_at DESC, id DESC`,
    [nodeIds]
  );
  const { rows: links } = await pool.query(
    `SELECT l.node_id, l.knowledge_point_id, k.title
     FROM course_resource_node_knowledge_points l
     JOIN knowledge_points k ON k.id = l.knowledge_point_id
     WHERE l.node_id = ANY($1::bigint[])
     ORDER BY k.sort_order ASC, k.id ASC`,
    [nodeIds]
  );
  const tree = buildTree(nodes, files, links);
  if (!onlyPublished) return tree;

  const keepPublished = (node) => {
    const children = node.children.map(keepPublished).filter(Boolean);
    if (node.level === 3) {
      return node.status === 'published' ? { ...node, children: [] } : null;
    }
    return children.length > 0 ? { ...node, children } : null;
  };
  return tree.map(keepPublished).filter(Boolean);
}

async function collectNodeFilePaths(client, nodeId) {
  const { rows } = await client.query(
    `WITH RECURSIVE subtree AS (
       SELECT id FROM course_resource_nodes WHERE id = $1
       UNION ALL
       SELECT n.id FROM course_resource_nodes n
       JOIN subtree s ON n.parent_id = s.id
     )
     SELECT storage_path FROM course_resource_files
     WHERE node_id IN (SELECT id FROM subtree)`,
    [nodeId]
  );
  return rows.map((r) => resourceAbsPath(r.storage_path));
}

async function ensureQuiz(poolOrClient, knowledgeId, title) {
  const { rows } = await poolOrClient.query(
    `SELECT id FROM quizzes WHERE knowledge_point_id = $1 ORDER BY id ASC LIMIT 1`,
    [knowledgeId]
  );
  if (rows.length) return rows[0].id;
  const { rows: ins } = await poolOrClient.query(
    `INSERT INTO quizzes (knowledge_point_id, title, pass_score)
     VALUES ($1, $2, 60)
     RETURNING id`,
    [knowledgeId, `${title}检测`]
  );
  return ins[0].id;
}

function validateQuestionBody(body) {
  const type = normalizeText(body?.type);
  const question = normalizeText(body?.question);
  const score = Number(body?.score || 10);
  const explanation = normalizeText(body?.explanation);
  const options = Array.isArray(body?.options) ? body.options.map((v) => normalizeText(v)).filter(Boolean) : [];
  const keywords = Array.isArray(body?.keywords) ? body.keywords.map((v) => normalizeText(v)).filter(Boolean) : [];
  const correctAnswer = body?.correctAnswer;

  if (!['single', 'multiple', 'short'].includes(type)) return { error: '题型无效' };
  if (!question) return { error: '请输入题干' };
  if (!Number.isFinite(score) || score <= 0) return { error: '分值无效' };
  if (type !== 'short' && options.length < 2) return { error: '选择题至少需要两个选项' };
  if (type === 'single' && !Number.isInteger(correctAnswer)) return { error: '请选择标准答案' };
  if (type === 'multiple' && (!Array.isArray(correctAnswer) || correctAnswer.length === 0)) return { error: '请选择标准答案' };
  return { type, question, score, explanation, options, keywords, correctAnswer };
}

const storage = multer.diskStorage({
  destination(req, _file, cb) {
    const nodeId = parseId(req.params.nodeId);
    const uid = userIdFromReq(req);
    if (!nodeId || !uid) return cb(new Error('参数无效'));
    const dir = path.join(UPLOAD_ROOT, String(uid), String(nodeId));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(_req, file, cb) {
    file.originalname = normalizeUploadFileName(file.originalname);
    const safe = file.originalname.replace(/[/\\]/g, '_');
    cb(null, `${randomUUID()}_${safe}`);
  },
});

const uploadResource = multer({
  storage,
  limits: { fileSize: MAX_RESOURCE_BYTES },
});

router.get('/teacher/course-resources/modules', requireAuth(), requireTeacher(), (req, res) => {
  return ok(req, res, { modules: MODULES });
});

router.get('/teacher/course-resources', requireAuth(), requireTeacher(), async (req, res) => {
  try {
    const moduleKey = normalizeText(req.query.moduleKey) || MODULES[0].key;
    if (!moduleByKey(moduleKey)) return bad(req, res, 400, 40001, '实训环节无效');
    const pool = getPool();
    const nodes = await loadResourceTree(pool, moduleKey);
    const { rows: kpRows } = await pool.query(
      `SELECT * FROM knowledge_points
       WHERE module_key = $1
       ORDER BY sort_order ASC, id ASC`,
      [moduleKey]
    );
    return ok(req, res, { modules: MODULES, nodes, knowledgePoints: kpRows.map(mapKnowledge) });
  } catch (e) {
    logError(`GET admin course resources traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.post('/teacher/course-resources/nodes', requireAuth(), requireTeacher(), async (req, res) => {
  try {
    const title = normalizeText(req.body?.title);
    const parentId = parseId(req.body?.parentId);
    const moduleKey = normalizeText(req.body?.moduleKey);
    const mod = moduleByKey(moduleKey);
    const uid = userIdFromReq(req);
    if (!uid) return bad(req, res, 400, 40001, '参数无效');
    if (!title) return bad(req, res, 400, 40002, '请输入名称');
    if (!mod) return bad(req, res, 400, 40003, '实训环节无效');

    const pool = getPool();
    let level = 1;
    if (parentId) {
      const { rows: pr } = await pool.query(`SELECT * FROM course_resource_nodes WHERE id = $1`, [parentId]);
      if (!pr.length) return bad(req, res, 404, 40401, '上级节点不存在');
      if (pr[0].level >= 3) return bad(req, res, 400, 40004, '子小节下不能继续新增');
      if (pr[0].module_key !== moduleKey) return bad(req, res, 400, 40005, '上级节点不属于当前环节');
      level = Number(pr[0].level) + 1;
    }

    const { rows: orderRows } = await pool.query(
      `SELECT COALESCE(MAX(sort_order), 0)::int + 1 AS next_order
       FROM course_resource_nodes
       WHERE module_key = $1 AND parent_id IS NOT DISTINCT FROM $2`,
      [moduleKey, parentId]
    );
    const { rows } = await pool.query(
      `INSERT INTO course_resource_nodes
         (module_key, module_name, parent_id, level, title, sort_order, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [moduleKey, mod.name, parentId, level, title, orderRows[0].next_order, uid]
    );
    return ok(req, res, { node: buildTree(rows, [], [])[0] });
  } catch (e) {
    logError(`POST admin course resource node traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.patch('/teacher/course-resources/nodes/:nodeId/status', requireAuth(), requireTeacher(), async (req, res) => {
  try {
    const nodeId = parseId(req.params.nodeId);
    const status = normalizeText(req.body?.status);
    if (!nodeId || !['draft', 'published'].includes(status)) return bad(req, res, 400, 40001, '参数无效');
    const pool = getPool();
    const { rows: nodeRows } = await pool.query(`SELECT level FROM course_resource_nodes WHERE id = $1`, [nodeId]);
    if (!nodeRows.length) return bad(req, res, 404, 40401, '节点不存在');
    if (Number(nodeRows[0].level) !== 3) return bad(req, res, 400, 40002, '只能发布或下架子小节');
    await pool.query(`UPDATE course_resource_nodes SET status = $2 WHERE id = $1`, [nodeId, status]);
    return ok(req, res, { updated: true });
  } catch (e) {
    logError(`PATCH admin course resource node status traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.delete('/teacher/course-resources/nodes/:nodeId', requireAuth(), requireTeacher(), async (req, res) => {
  try {
    const nodeId = parseId(req.params.nodeId);
    if (!nodeId) return bad(req, res, 400, 40001, '参数无效');
    const pool = getPool();
    const client = await pool.connect();
    let filePaths = [];
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(`SELECT id FROM course_resource_nodes WHERE id = $1`, [nodeId]);
      if (!rows.length) {
        await client.query('ROLLBACK');
        return bad(req, res, 404, 40401, '节点不存在');
      }
      filePaths = await collectNodeFilePaths(client, nodeId);
      await client.query(`DELETE FROM course_resource_nodes WHERE id = $1`, [nodeId]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    for (const filePath of filePaths) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        /* ignore */
      }
    }
    return ok(req, res, { deleted: true });
  } catch (e) {
    logError(`DELETE admin course resource node traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.post(
  '/teacher/course-resources/nodes/:nodeId/resources',
  requireAuth(),
  requireTeacher(),
  uploadResource.single('file'),
  async (req, res) => {
    try {
      const nodeId = parseId(req.params.nodeId);
      const uid = userIdFromReq(req);
      if (!nodeId || !uid) return bad(req, res, 400, 40001, '参数无效');
      if (!req.file) return bad(req, res, 400, 40002, '请选择文件');
      const uploadKind = getUploadKind(req.file.mimetype, req.file.originalname);
      if (!uploadKind) {
        fs.unlinkSync(req.file.path);
        return bad(req, res, 400, 40004, '仅支持可在线预览的 PDF、Office、图片、视频、音频文件；其他资料请上传压缩包');
      }
      const pool = getPool();
      const { rows: nr } = await pool.query(`SELECT level FROM course_resource_nodes WHERE id = $1`, [nodeId]);
      if (!nr.length) {
        fs.unlinkSync(req.file.path);
        return bad(req, res, 404, 40401, '节点不存在');
      }
      if (Number(nr[0].level) !== 3) {
        fs.unlinkSync(req.file.path);
        return bad(req, res, 400, 40003, '只能在子小节上传课件');
      }
      const storagePath = path.join(String(uid), String(nodeId), req.file.filename);
      const contentHash = await hashFile(req.file.path);
      let previewStoragePath = uploadKind.canPreview ? storagePath : null;
      let previewStatus = uploadKind.canPreview ? 'ready' : 'none';
      if (uploadKind.needsOfficeConvert) {
        try {
          const previewAbs = await convertOfficeToPdf(req.file.path);
          previewStoragePath = path.relative(UPLOAD_ROOT, previewAbs);
        } catch (convertError) {
          fs.unlinkSync(req.file.path);
          return bad(
            req,
            res,
            500,
            50001,
            convertError instanceof Error ? convertError.message : 'Office 文档转换失败'
          );
        }
      }
      const { rows } = await pool.query(
        `INSERT INTO course_resource_files
           (node_id, origin_name, storage_name, storage_path, mime_type, size_bytes, resource_type, uploaded_by,
            content_hash, preview_storage_path, preview_mime_type, preview_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          nodeId,
          req.file.originalname,
          req.file.filename,
          storagePath,
          req.file.mimetype,
          req.file.size,
          uploadKind.resourceType,
          uid,
          contentHash,
          previewStoragePath,
          uploadKind.previewMimeType,
          previewStatus,
        ]
      );
      return ok(req, res, { resource: mapResource(rows[0]) });
    } catch (e) {
      if (req.file?.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch {
          /* ignore */
        }
      }
      logError(`POST admin course resource file traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.delete('/teacher/course-resources/resources/:resourceId', requireAuth(), requireTeacher(), async (req, res) => {
  try {
    const resourceId = parseId(req.params.resourceId);
    if (!resourceId) return bad(req, res, 400, 40001, '参数无效');
    const pool = getPool();
    const { rows } = await pool.query(`SELECT storage_path FROM course_resource_files WHERE id = $1`, [resourceId]);
    if (!rows.length) return bad(req, res, 404, 40401, '资源不存在');
    await pool.query(`DELETE FROM course_resource_files WHERE id = $1`, [resourceId]);
    try {
      fs.unlinkSync(resourceAbsPath(rows[0].storage_path));
    } catch {
      /* ignore */
    }
    return ok(req, res, { deleted: true });
  } catch (e) {
    logError(`DELETE admin course resource file traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

async function sendResourceFile(req, res, mode) {
  const resourceId = parseId(req.params.resourceId);
  if (!resourceId) return bad(req, res, 400, 40001, '参数无效');
  const pool = getPool();
  const { rows } = await pool.query(`SELECT * FROM course_resource_files WHERE id = $1`, [resourceId]);
  if (!rows.length) return bad(req, res, 404, 40401, '资源不存在');
  const row = rows[0];
  const originName = normalizeUploadFileName(row.origin_name);
  const previewMime = row.preview_mime_type || row.mime_type || '';
  const previewPath = row.preview_storage_path || row.storage_path;
  const abs = resourceAbsPath(mode === 'preview' ? previewPath : row.storage_path);
  if (!fs.existsSync(abs)) return bad(req, res, 404, 40402, '文件不存在');
  if (mode === 'preview' && row.resource_type !== 'archive' && (row.preview_status || 'ready') === 'ready' && canPreviewResource(previewMime, originName)) {
    res.setHeader('Content-Type', previewMime || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(originName)}"`);
    return res.sendFile(abs);
  }
  return res.download(resourceAbsPath(row.storage_path), originName);
}

router.get('/teacher/course-resources/resources/:resourceId/preview', bearerFromQuery, requireAuth(), requireTeacher(), async (req, res) => {
  try {
    return await sendResourceFile(req, res, 'preview');
  } catch (e) {
    logError(`GET admin course resource preview traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.get('/teacher/course-resources/resources/:resourceId/download', bearerFromQuery, requireAuth(), requireTeacher(), async (req, res) => {
  try {
    return await sendResourceFile(req, res, 'download');
  } catch (e) {
    logError(`GET admin course resource download traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

async function sendStudentResourceFile(req, res, mode) {
  const resourceId = parseId(req.params.resourceId);
  if (!resourceId) return bad(req, res, 400, 40001, '参数无效');
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT f.*
     FROM course_resource_files f
     JOIN course_resource_nodes n ON n.id = f.node_id
     WHERE f.id = $1
       AND n.level = 3
       AND n.status = 'published'`,
    [resourceId]
  );
  if (!rows.length) return bad(req, res, 404, 40401, '资源不存在或未发布');
  const row = rows[0];
  const originName = normalizeUploadFileName(row.origin_name);
  const previewMime = row.preview_mime_type || row.mime_type || '';
  const previewPath = row.preview_storage_path || row.storage_path;
  const abs = resourceAbsPath(mode === 'preview' ? previewPath : row.storage_path);
  if (!fs.existsSync(abs)) return bad(req, res, 404, 40402, '文件不存在');
  if (mode === 'preview' && row.resource_type !== 'archive' && (row.preview_status || 'ready') === 'ready' && canPreviewResource(previewMime, originName)) {
    res.setHeader('Content-Type', previewMime || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(originName)}"`);
    return res.sendFile(abs);
  }
  return res.download(resourceAbsPath(row.storage_path), originName);
}

router.get('/student/course-resources/resources/:resourceId/preview', bearerFromQuery, requireAuth(), requireStudent(), async (req, res) => {
  try {
    return await sendStudentResourceFile(req, res, 'preview');
  } catch (e) {
    logError(`GET student course resource preview traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.get('/student/course-resources/resources/:resourceId/download', bearerFromQuery, requireAuth(), requireStudent(), async (req, res) => {
  try {
    return await sendStudentResourceFile(req, res, 'download');
  } catch (e) {
    logError(`GET student course resource download traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

async function loadStudentResource(pool, resourceId) {
  const { rows } = await pool.query(
    `SELECT f.*
     FROM course_resource_files f
     JOIN course_resource_nodes n ON n.id = f.node_id
     WHERE f.id = $1
       AND n.level = 3
       AND n.status = 'published'`,
    [resourceId]
  );
  return rows[0] || null;
}

router.get('/student/course-resources/resources/:resourceId/progress', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const resourceId = parseId(req.params.resourceId);
    const uid = userIdFromReq(req);
    if (!resourceId || !uid) return bad(req, res, 400, 40001, '参数无效');
    const pool = getPool();
    const resource = await loadStudentResource(pool, resourceId);
    if (!resource) return bad(req, res, 404, 40401, '资源不存在或未发布');
    if (!resource.content_hash) {
      return ok(req, res, { progress: { progressPercent: 0, lastPosition: {}, completed: false } });
    }
    const { rows } = await pool.query(
      `SELECT progress_percent, last_position, completed_at
       FROM student_course_resource_progress
       WHERE user_id = $1 AND content_hash = $2`,
      [uid, resource.content_hash]
    );
    const row = rows[0];
    return ok(req, res, {
      progress: {
        progressPercent: Number(row?.progress_percent || 0),
        lastPosition: row?.last_position || {},
        completed: Boolean(row?.completed_at),
      },
    });
  } catch (e) {
    logError(`GET student resource progress traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.put('/student/course-resources/resources/:resourceId/progress', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const resourceId = parseId(req.params.resourceId);
    const uid = userIdFromReq(req);
    if (!resourceId || !uid) return bad(req, res, 400, 40001, '参数无效');
    const pool = getPool();
    const resource = await loadStudentResource(pool, resourceId);
    if (!resource) return bad(req, res, 404, 40401, '资源不存在或未发布');
    if (!resource.content_hash) return bad(req, res, 400, 40002, '资源缺少 hash，无法记录进度');
    const percent = Math.max(0, Math.min(100, Number(req.body?.progressPercent || 0)));
    const lastPosition = req.body?.lastPosition && typeof req.body.lastPosition === 'object' ? req.body.lastPosition : {};
    const completed = Boolean(req.body?.completed) || percent >= 100;
    const { rows } = await pool.query(
      `INSERT INTO student_course_resource_progress
         (user_id, content_hash, progress_percent, last_position, completed_at)
       VALUES ($1, $2, $3, $4::jsonb, CASE WHEN $5 THEN now() ELSE NULL END)
       ON CONFLICT (user_id, content_hash)
       DO UPDATE SET
         progress_percent = GREATEST(student_course_resource_progress.progress_percent, EXCLUDED.progress_percent),
         last_position = EXCLUDED.last_position,
         completed_at = CASE
           WHEN student_course_resource_progress.completed_at IS NOT NULL THEN student_course_resource_progress.completed_at
           WHEN $5 THEN now()
           ELSE NULL
         END
       RETURNING progress_percent, last_position, completed_at`,
      [uid, resource.content_hash, percent, JSON.stringify(lastPosition), completed]
    );
    return ok(req, res, {
      progress: {
        progressPercent: Number(rows[0].progress_percent || 0),
        lastPosition: rows[0].last_position || {},
        completed: Boolean(rows[0].completed_at),
      },
    });
  } catch (e) {
    logError(`PUT student resource progress traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.get('/teacher/course-resources/knowledge-points', requireAuth(), requireTeacher(), async (req, res) => {
  try {
    const moduleKey = normalizeText(req.query.moduleKey);
    if (!moduleByKey(moduleKey)) return bad(req, res, 400, 40001, '实训环节无效');
    const { rows } = await getPool().query(
      `SELECT * FROM knowledge_points
       WHERE module_key = $1
       ORDER BY sort_order ASC, id ASC`,
      [moduleKey]
    );
    return ok(req, res, { knowledgePoints: rows.map(mapKnowledge) });
  } catch (e) {
    logError(`GET admin knowledge points traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.post('/teacher/course-resources/knowledge-points', requireAuth(), requireTeacher(), async (req, res) => {
  try {
    const moduleKey = normalizeText(req.body?.moduleKey);
    const title = normalizeText(req.body?.title);
    const description = normalizeText(req.body?.description);
    const mod = moduleByKey(moduleKey);
    const uid = userIdFromReq(req);
    if (!mod || !uid) return bad(req, res, 400, 40001, '参数无效');
    if (!title) return bad(req, res, 400, 40002, '请输入知识点名称');
    const pool = getPool();
    const { rows: orderRows } = await pool.query(
      `SELECT COALESCE(MAX(sort_order), 0)::int + 1 AS next_order FROM knowledge_points WHERE module_key = $1`,
      [moduleKey]
    );
    const { rows } = await pool.query(
      `INSERT INTO knowledge_points
         (module_key, module_name, title, description, status, uploader_id, sort_order)
       VALUES ($1, $2, $3, $4, 'published', $5, $6)
       RETURNING *`,
      [moduleKey, mod.name, title, description, uid, orderRows[0].next_order]
    );
    await ensureQuiz(pool, rows[0].id, rows[0].title);
    return ok(req, res, { knowledgePoint: mapKnowledge(rows[0]) });
  } catch (e) {
    logError(`POST admin knowledge point traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.put('/teacher/course-resources/knowledge-points/:knowledgeId', requireAuth(), requireTeacher(), async (req, res) => {
  try {
    const knowledgeId = parseId(req.params.knowledgeId);
    const title = normalizeText(req.body?.title);
    const description = normalizeText(req.body?.description);
    if (!knowledgeId || !title) return bad(req, res, 400, 40001, '参数无效');
    const { rows } = await getPool().query(
      `UPDATE knowledge_points
       SET title = $2, description = $3
       WHERE id = $1
       RETURNING *`,
      [knowledgeId, title, description]
    );
    if (!rows.length) return bad(req, res, 404, 40401, '知识点不存在');
    return ok(req, res, { knowledgePoint: mapKnowledge(rows[0]) });
  } catch (e) {
    logError(`PUT admin knowledge point traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.delete('/teacher/course-resources/knowledge-points/:knowledgeId', requireAuth(), requireTeacher(), async (req, res) => {
  try {
    const knowledgeId = parseId(req.params.knowledgeId);
    if (!knowledgeId) return bad(req, res, 400, 40001, '参数无效');
    await getPool().query(`DELETE FROM knowledge_points WHERE id = $1`, [knowledgeId]);
    return ok(req, res, { deleted: true });
  } catch (e) {
    logError(`DELETE admin knowledge point traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.put('/teacher/course-resources/nodes/:nodeId/knowledge-points', requireAuth(), requireTeacher(), async (req, res) => {
  try {
    const nodeId = parseId(req.params.nodeId);
    const ids = Array.isArray(req.body?.knowledgePointIds)
      ? req.body.knowledgePointIds.map(parseId).filter(Boolean)
      : [];
    if (!nodeId) return bad(req, res, 400, 40001, '参数无效');
    const pool = getPool();
    const { rows: nr } = await pool.query(`SELECT level FROM course_resource_nodes WHERE id = $1`, [nodeId]);
    if (!nr.length) return bad(req, res, 404, 40401, '节点不存在');
    if (Number(nr[0].level) !== 3) return bad(req, res, 400, 40002, '只能在子小节关联知识点');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM course_resource_node_knowledge_points WHERE node_id = $1`, [nodeId]);
      for (const id of ids) {
        await client.query(
          `INSERT INTO course_resource_node_knowledge_points (node_id, knowledge_point_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [nodeId, id]
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    return ok(req, res, { saved: true });
  } catch (e) {
    logError(`PUT admin node knowledge points traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.get('/teacher/course-resources/knowledge-points/:knowledgeId/questions', requireAuth(), requireTeacher(), async (req, res) => {
  try {
    const knowledgeId = parseId(req.params.knowledgeId);
    if (!knowledgeId) return bad(req, res, 400, 40001, '参数无效');
    const pool = getPool();
    const { rows: kr } = await pool.query(`SELECT title FROM knowledge_points WHERE id = $1`, [knowledgeId]);
    if (!kr.length) return bad(req, res, 404, 40401, '知识点不存在');
    const quizId = await ensureQuiz(pool, knowledgeId, kr[0].title);
    const { rows } = await pool.query(
      `SELECT * FROM quiz_questions WHERE quiz_id = $1 ORDER BY sort_order ASC, id ASC`,
      [quizId]
    );
    return ok(req, res, { questions: rows.map(mapQuestion) });
  } catch (e) {
    logError(`GET admin quiz questions traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.post('/teacher/course-resources/knowledge-points/:knowledgeId/questions', requireAuth(), requireTeacher(), async (req, res) => {
  try {
    const knowledgeId = parseId(req.params.knowledgeId);
    const v = validateQuestionBody(req.body);
    if (!knowledgeId || v.error) return bad(req, res, 400, 40001, v.error || '参数无效');
    const pool = getPool();
    const { rows: kr } = await pool.query(`SELECT title FROM knowledge_points WHERE id = $1`, [knowledgeId]);
    if (!kr.length) return bad(req, res, 404, 40401, '知识点不存在');
    const quizId = await ensureQuiz(pool, knowledgeId, kr[0].title);
    const { rows: orderRows } = await pool.query(
      `SELECT COALESCE(MAX(sort_order), 0)::int + 1 AS next_order FROM quiz_questions WHERE quiz_id = $1`,
      [quizId]
    );
    const { rows } = await pool.query(
      `INSERT INTO quiz_questions
         (quiz_id, question_text, question_type, options, correct_answer, keywords, score, explanation, sort_order)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7, $8, $9)
       RETURNING *`,
      [
        quizId,
        v.question,
        v.type,
        JSON.stringify(v.type === 'short' ? [] : v.options),
        JSON.stringify(v.correctAnswer ?? null),
        JSON.stringify(v.keywords),
        v.score,
        v.explanation,
        orderRows[0].next_order,
      ]
    );
    return ok(req, res, { question: mapQuestion(rows[0]) });
  } catch (e) {
    logError(`POST admin quiz question traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.put('/teacher/course-resources/knowledge-points/:knowledgeId/questions/:questionId', requireAuth(), requireTeacher(), async (req, res) => {
  try {
    const knowledgeId = parseId(req.params.knowledgeId);
    const questionId = parseId(req.params.questionId);
    const v = validateQuestionBody(req.body);
    if (!knowledgeId || !questionId || v.error) return bad(req, res, 400, 40001, v.error || '参数无效');
    const pool = getPool();
    const { rows: qr } = await pool.query(
      `SELECT q.id
       FROM quiz_questions q
       JOIN quizzes z ON z.id = q.quiz_id
       WHERE q.id = $1 AND z.knowledge_point_id = $2`,
      [questionId, knowledgeId]
    );
    if (!qr.length) return bad(req, res, 404, 40401, '题目不存在');
    const { rows } = await pool.query(
      `UPDATE quiz_questions
       SET question_text = $2, question_type = $3, options = $4::jsonb,
           correct_answer = $5::jsonb, keywords = $6::jsonb, score = $7, explanation = $8
       WHERE id = $1
       RETURNING *`,
      [
        questionId,
        v.question,
        v.type,
        JSON.stringify(v.type === 'short' ? [] : v.options),
        JSON.stringify(v.correctAnswer ?? null),
        JSON.stringify(v.keywords),
        v.score,
        v.explanation,
      ]
    );
    return ok(req, res, { question: mapQuestion(rows[0]) });
  } catch (e) {
    logError(`PUT admin quiz question traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.delete('/teacher/course-resources/knowledge-points/:knowledgeId/questions/:questionId', requireAuth(), requireTeacher(), async (req, res) => {
  try {
    const knowledgeId = parseId(req.params.knowledgeId);
    const questionId = parseId(req.params.questionId);
    if (!knowledgeId || !questionId) return bad(req, res, 400, 40001, '参数无效');
    await getPool().query(
      `DELETE FROM quiz_questions q
       USING quizzes z
       WHERE q.quiz_id = z.id AND q.id = $1 AND z.knowledge_point_id = $2`,
      [questionId, knowledgeId]
    );
    return ok(req, res, { deleted: true });
  } catch (e) {
    logError(`DELETE admin quiz question traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.get('/student/course-resources', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const moduleKey = normalizeText(req.query.moduleKey) || MODULES[0].key;
    if (!moduleByKey(moduleKey)) return bad(req, res, 400, 40001, '实训环节无效');
    const uid = userIdFromReq(req);
    const pool = getPool();
    const nodes = await loadResourceTree(pool, moduleKey, true);
    const hashes = collectResourceHashes(nodes);
    if (uid && hashes.length) {
      const { rows: progressRows } = await pool.query(
        `SELECT content_hash, progress_percent, last_position, completed_at
         FROM student_course_resource_progress
         WHERE user_id = $1 AND content_hash = ANY($2::varchar[])`,
        [uid, hashes]
      );
      attachResourceProgress(nodes, progressRows);
    }
    return ok(req, res, { modules: MODULES, nodes });
  } catch (e) {
    logError(`GET student course resources traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.get('/student/course-resources/knowledge-points/:knowledgeId/quiz', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const knowledgeId = parseId(req.params.knowledgeId);
    if (!knowledgeId) return bad(req, res, 400, 40001, '参数无效');
    const pool = getPool();
    const { rows: kpRows } = await pool.query(
      `SELECT id, title, module_key, module_name FROM knowledge_points WHERE id = $1`,
      [knowledgeId]
    );
    if (!kpRows.length) return bad(req, res, 404, 40401, '知识点不存在');
    const { rows: quizRows } = await pool.query(
      `SELECT id, pass_score FROM quizzes WHERE knowledge_point_id = $1 ORDER BY id ASC LIMIT 1`,
      [knowledgeId]
    );
    if (!quizRows.length) return bad(req, res, 404, 40402, '暂无检测题');
    const { rows: questionRows } = await pool.query(
      `SELECT * FROM quiz_questions WHERE quiz_id = $1 ORDER BY sort_order ASC, id ASC`,
      [quizRows[0].id]
    );
    if (!questionRows.length) return bad(req, res, 404, 40402, '暂无检测题');
    const kp = kpRows[0];
    return ok(req, res, {
      config: {
        moduleId: kp.module_key || '',
        moduleName: kp.module_name || '',
        knowledgeId: String(kp.id),
        knowledgeName: kp.title,
        passingScore: Number(quizRows[0].pass_score || 60),
        questions: questionRows.map(mapQuestion),
      },
    });
  } catch (e) {
    logError(`GET student knowledge quiz traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.post('/student/course-resources/knowledge-points/:knowledgeId/quiz-attempts', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const knowledgeId = parseId(req.params.knowledgeId);
    const uid = userIdFromReq(req);
    if (!knowledgeId || !uid) return bad(req, res, 400, 40001, '参数无效');
    const score = Math.max(0, Math.min(100, Number(req.body?.score || 0)));
    const answers = req.body?.answers && typeof req.body.answers === 'object' ? req.body.answers : {};
    const pool = getPool();
    const { rows: quizRows } = await pool.query(
      `SELECT id, pass_score FROM quizzes WHERE knowledge_point_id = $1 ORDER BY id ASC LIMIT 1`,
      [knowledgeId]
    );
    if (!quizRows.length) return bad(req, res, 404, 40402, '暂无检测题');
    const passed = score >= Number(quizRows[0].pass_score || 60);
    await pool.query(
      `INSERT INTO quiz_attempts (quiz_id, user_id, answers, score, passed)
       VALUES ($1, $2, $3::jsonb, $4, $5)`,
      [quizRows[0].id, uid, JSON.stringify(answers), score, passed]
    );
    return ok(req, res, { passed });
  } catch (e) {
    logError(`POST student knowledge quiz attempt traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

// 批量查询学生已通过的知识点（用于课程目录知识点“已检测”状态）
router.post('/student/course-resources/knowledge-points/passed-ids', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const uid = userIdFromReq(req);
    if (!uid) return bad(req, res, 401, 40101, '未登录');
    const ids = Array.isArray(req.body?.knowledgePointIds)
      ? req.body.knowledgePointIds.map(parseId).filter(Boolean)
      : [];
    if (!ids.length) return ok(req, res, { passedKnowledgePointIds: [] });

    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT DISTINCT q.knowledge_point_id AS "knowledgePointId"
       FROM quiz_attempts a
       JOIN quizzes q ON q.id = a.quiz_id
       WHERE a.user_id = $1
         AND a.passed = true
         AND q.knowledge_point_id = ANY($2::bigint[])`,
      [uid, ids]
    );
    return ok(req, res, { passedKnowledgePointIds: rows.map((r) => String(r.knowledgePointId)) });
  } catch (e) {
    logError(`POST student passed knowledge ids traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

export default router;
