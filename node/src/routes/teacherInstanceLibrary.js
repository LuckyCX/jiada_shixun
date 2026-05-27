import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import multer from 'multer';
import { getPool } from '../lib/db.js';
import { logError } from '../lib/logError.js';
import { requireAuth, requireStudent, requireTeacher } from '../middleware/auth.js';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_ROOT = path.join(__dirname, '../../uploads/teacher-instance-library');
const MAX_RESOURCE_BYTES = 200 * 1024 * 1024;
const MAX_COVER_BYTES = 8 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_RESOURCE_BYTES },
});

const uploadCover = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_COVER_BYTES },
});

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
  return parseId(req.user?.sub);
}

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeUploadFileName(name) {
  const raw = String(name || 'file').trim() || 'file';
  const decoded = Buffer.from(raw, 'latin1').toString('utf8');
  const looksLatin1Mojibake = /[\u0080-\u00ff]/.test(raw);
  const decodedLooksValid = decoded && decoded !== raw && !decoded.includes('\uFFFD') && /[^\u0000-\u00ff]/.test(decoded);
  return looksLatin1Mojibake && decodedLooksValid ? decoded : raw;
}

function safeStorageName(name) {
  const normalized = normalizeUploadFileName(name);
  const safe = normalized.replace(/[\\/]/g, '_').replace(/\s+/g, '_');
  return `${randomUUID()}_${safe || 'file'}`;
}

function resourceTypeFromFile(mime, name) {
  const m = String(mime || '').toLowerCase();
  const ext = path.extname(String(name || '')).toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';
  if (m === 'application/pdf' || ext === '.pdf') return 'pdf';
  if (['.zip', '.rar', '.7z', '.tar', '.gz', '.tgz'].includes(ext)) return 'archive';
  return 'file';
}

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
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

function canPreviewResource(resource) {
  const mime = String(resource.mime_type || '').toLowerCase();
  const name = String(resource.origin_name || '').toLowerCase();
  return (
    mime.startsWith('image/') ||
    mime.startsWith('video/') ||
    mime.startsWith('audio/') ||
    mime.startsWith('text/') ||
    mime === 'application/pdf' ||
    name.endsWith('.pdf')
  );
}

function mapResource(row) {
  return {
    id: String(row.id),
    caseId: String(row.case_id),
    usage: row.usage,
    originName: normalizeUploadFileName(row.origin_name),
    mimeType: row.mime_type || '',
    sizeBytes: Number(row.size_bytes || 0),
    size: formatSize(Number(row.size_bytes || 0)),
    resourceType: row.resource_type || 'file',
    canPreview: canPreviewResource(row),
    createdAt: row.created_at,
  };
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags.map((tag) => normalizeText(tag)).filter(Boolean).slice(0, 12);
}

function mapCase(row, resources = []) {
  const tags = Array.isArray(row.tags) ? row.tags : [];
  return {
    id: String(row.id),
    categoryId: String(row.category_id),
    title: row.title,
    detailHtml: row.detail_html || '',
    tags,
    projectOutcome: row.project_outcome || '',
    sortOrder: Number(row.sort_order || 0),
    hasCoverImage: Boolean(row.cover_storage_path),
    resources,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCategory(row, cases = []) {
  return {
    id: String(row.id),
    name: row.name,
    icon: row.icon || 'ri-folder-line',
    color: row.color || 'from-purple-500 to-violet-500',
    sortOrder: Number(row.sort_order || 0),
    cases,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const VALID_MODULE_KEYS = new Set(['ideation', 'market', 'product', 'business', 'simulation', 'plan']);

function normalizeModuleKey(raw) {
  const key = String(raw || 'ideation').trim();
  return VALID_MODULE_KEYS.has(key) ? key : 'ideation';
}

async function loadLibraryForTeacher(pool, teacherId, moduleKey = 'ideation') {
  const mk = normalizeModuleKey(moduleKey);
  const [categoryRes, caseRes, resourceRes] = await Promise.all([
    pool.query(
      `SELECT id, name, icon, color, sort_order, created_at, updated_at
       FROM teacher_instance_library_categories
       WHERE teacher_id = $1 AND training_module_key = $2
       ORDER BY sort_order ASC, id ASC`,
      [teacherId, mk]
    ),
    pool.query(
      `SELECT c.id, c.category_id, c.title, c.detail_html, c.tags, c.project_outcome, c.sort_order,
              c.cover_storage_path, c.cover_origin_name, c.cover_mime_type, c.created_at, c.updated_at
       FROM teacher_instance_library_cases c
       INNER JOIN teacher_instance_library_categories cat ON cat.id = c.category_id
       WHERE c.teacher_id = $1 AND cat.training_module_key = $2
       ORDER BY c.sort_order ASC, c.id ASC`,
      [teacherId, mk]
    ),
    pool.query(
      `SELECT id, case_id, usage, origin_name, storage_name, storage_path, mime_type, size_bytes, resource_type, created_at
       FROM teacher_instance_library_resources
       WHERE case_id IN (
         SELECT c.id FROM teacher_instance_library_cases c
         INNER JOIN teacher_instance_library_categories cat ON cat.id = c.category_id
         WHERE c.teacher_id = $1 AND cat.training_module_key = $2
       )
       ORDER BY sort_order ASC, id ASC`,
      [teacherId, mk]
    ),
  ]);

  const resourcesByCase = new Map();
  for (const row of resourceRes.rows) {
    const key = String(row.case_id);
    const list = resourcesByCase.get(key) || [];
    list.push(mapResource(row));
    resourcesByCase.set(key, list);
  }

  const casesByCategory = new Map();
  for (const row of caseRes.rows) {
    const key = String(row.category_id);
    const list = casesByCategory.get(key) || [];
    list.push(mapCase(row, resourcesByCase.get(String(row.id)) || []));
    casesByCategory.set(key, list);
  }

  return categoryRes.rows.map((row) => mapCategory(row, casesByCategory.get(String(row.id)) || []));
}

async function teacherOwnsCategory(pool, teacherId, categoryId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM teacher_instance_library_categories WHERE id = $1 AND teacher_id = $2`,
    [categoryId, teacherId]
  );
  return rows.length > 0;
}

async function teacherOwnsCase(pool, teacherId, caseId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM teacher_instance_library_cases WHERE id = $1 AND teacher_id = $2`,
    [caseId, teacherId]
  );
  return rows.length > 0;
}

async function studentEnrolledInClass(pool, studentId, classId) {
  const { rows } = await pool.query(
    `SELECT c.teacher_id AS "teacherId"
     FROM teacher_personal_classes c
     INNER JOIN teacher_personal_class_students s ON s.teacher_personal_class_id = c.id
     WHERE c.id = $1 AND s.student_id = $2`,
    [classId, studentId]
  );
  return rows[0]?.teacherId || null;
}

async function storagePathsForCategory(pool, teacherId, categoryId) {
  const { rows } = await pool.query(
    `SELECT r.storage_path
     FROM teacher_instance_library_resources r
     INNER JOIN teacher_instance_library_cases c ON c.id = r.case_id
     WHERE c.teacher_id = $1 AND c.category_id = $2`,
    [teacherId, categoryId]
  );
  return rows.map((row) => row.storage_path);
}

async function storagePathsForCase(pool, teacherId, caseId) {
  const { rows: resRows } = await pool.query(
    `SELECT r.storage_path
     FROM teacher_instance_library_resources r
     INNER JOIN teacher_instance_library_cases c ON c.id = r.case_id
     WHERE c.teacher_id = $1 AND c.id = $2`,
    [teacherId, caseId]
  );
  const paths = resRows.map((row) => row.storage_path);
  const { rows: covRows } = await pool.query(
    `SELECT cover_storage_path FROM teacher_instance_library_cases WHERE id = $1 AND teacher_id = $2`,
    [caseId, teacherId]
  );
  const cov = covRows[0]?.cover_storage_path;
  if (cov) paths.push(cov);
  return paths;
}

function removeFiles(storagePaths) {
  for (const storagePath of storagePaths) {
    try {
      fs.unlinkSync(resourceAbsPath(storagePath));
    } catch {
      /* ignore */
    }
  }
}

async function loadTeacherResource(pool, teacherId, resourceId) {
  const { rows } = await pool.query(
    `SELECT r.*
     FROM teacher_instance_library_resources r
     INNER JOIN teacher_instance_library_cases c ON c.id = r.case_id
     WHERE r.id = $1 AND c.teacher_id = $2`,
    [resourceId, teacherId]
  );
  return rows[0] || null;
}

async function loadStudentResource(pool, studentId, classId, resourceId) {
  const teacherId = await studentEnrolledInClass(pool, studentId, classId);
  if (!teacherId) return null;
  const { rows } = await pool.query(
    `SELECT r.*
     FROM teacher_instance_library_resources r
     INNER JOIN teacher_instance_library_cases c ON c.id = r.case_id
     WHERE r.id = $1 AND c.teacher_id = $2`,
    [resourceId, teacherId]
  );
  return rows[0] || null;
}

async function loadTeacherCaseCoverRow(pool, teacherId, caseId) {
  const { rows } = await pool.query(
    `SELECT cover_storage_path, cover_origin_name, cover_mime_type
     FROM teacher_instance_library_cases
     WHERE id = $1 AND teacher_id = $2`,
    [caseId, teacherId]
  );
  return rows[0] || null;
}

async function loadStudentCaseCoverRow(pool, studentId, classId, caseId) {
  const teacherId = await studentEnrolledInClass(pool, studentId, classId);
  if (!teacherId) return null;
  const { rows } = await pool.query(
    `SELECT cover_storage_path, cover_mime_type
     FROM teacher_instance_library_cases
     WHERE id = $1 AND teacher_id = $2 AND cover_storage_path IS NOT NULL AND cover_storage_path <> ''`,
    [caseId, teacherId]
  );
  return rows[0] || null;
}

function isCoverImageMime(mime) {
  const m = String(mime || '').toLowerCase();
  return (
    m === 'image/jpeg' ||
    m === 'image/png' ||
    m === 'image/gif' ||
    m === 'image/webp' ||
    m === 'image/jpg' ||
    m === 'image/pjpeg' ||
    m === 'image/x-png'
  );
}

function sendCaseCover(req, res, row) {
  const p = row.cover_storage_path;
  if (!p) return bad(req, res, 404, 40404, '无封面');
  const abs = resourceAbsPath(p);
  if (!fs.existsSync(abs)) return bad(req, res, 404, 40404, '文件不存在');
  if (row.cover_mime_type) res.type(row.cover_mime_type);
  return res.sendFile(abs);
}

function sendResource(req, res, row, mode) {
  const abs = resourceAbsPath(row.storage_path);
  if (!fs.existsSync(abs)) return bad(req, res, 404, 40404, '文件不存在');
  const originName = normalizeUploadFileName(row.origin_name);
  if (mode === 'download') return res.download(abs, originName);
  if (!canPreviewResource(row)) return bad(req, res, 400, 40005, '该文件不支持预览');
  if (row.mime_type) res.type(row.mime_type);
  return res.sendFile(abs);
}

router.get('/teacher/instance-library', requireAuth(), requireTeacher(), async (req, res) => {
  try {
    const teacherId = userIdFromReq(req);
    if (!teacherId) return bad(req, res, 400, 40003, '参数无效');
    const moduleKey = normalizeModuleKey(req.query.moduleKey);
    const categories = await loadLibraryForTeacher(getPool(), teacherId, moduleKey);
    return ok(req, res, { categories });
  } catch (e) {
    logError(`GET teacher instance library traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.post('/teacher/instance-library/categories', requireAuth(), requireTeacher(), async (req, res) => {
  try {
    const teacherId = userIdFromReq(req);
    const name = normalizeText(req.body?.name);
    const icon = normalizeText(req.body?.icon) || 'FolderOutlined';
    const color = normalizeText(req.body?.color) || '#8b5cf6';
    const sortOrder = Number.isFinite(Number(req.body?.sortOrder)) ? Number(req.body.sortOrder) : 0;
    const trainingModuleKey = normalizeModuleKey(req.body?.moduleKey);
    if (!teacherId || !name) return bad(req, res, 400, 40003, '方向名称不能为空');
    const { rows } = await getPool().query(
      `INSERT INTO teacher_instance_library_categories (teacher_id, name, icon, color, sort_order, training_module_key)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, icon, color, sort_order, created_at, updated_at`,
      [teacherId, name, icon, color, sortOrder, trainingModuleKey]
    );
    return ok(req, res, mapCategory(rows[0], []));
  } catch (e) {
    logError(`POST teacher instance category traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.put('/teacher/instance-library/categories/:categoryId', requireAuth(), requireTeacher(), async (req, res) => {
  try {
    const teacherId = userIdFromReq(req);
    const categoryId = parseId(req.params.categoryId);
    const name = normalizeText(req.body?.name);
    const icon = normalizeText(req.body?.icon) || 'FolderOutlined';
    const color = normalizeText(req.body?.color) || '#8b5cf6';
    const sortOrder = Number.isFinite(Number(req.body?.sortOrder)) ? Number(req.body.sortOrder) : 0;
    if (!teacherId || !categoryId || !name) return bad(req, res, 400, 40003, '参数无效');
    const { rows } = await getPool().query(
      `UPDATE teacher_instance_library_categories
       SET name = $3, icon = $4, color = $5, sort_order = $6
       WHERE id = $1 AND teacher_id = $2
       RETURNING id, name, icon, color, sort_order, created_at, updated_at`,
      [categoryId, teacherId, name, icon, color, sortOrder]
    );
    if (!rows.length) return bad(req, res, 404, 40404, '方向不存在');
    return ok(req, res, mapCategory(rows[0], []));
  } catch (e) {
    logError(`PUT teacher instance category traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.delete('/teacher/instance-library/categories/:categoryId', requireAuth(), requireTeacher(), async (req, res) => {
  try {
    const teacherId = userIdFromReq(req);
    const categoryId = parseId(req.params.categoryId);
    if (!teacherId || !categoryId) return bad(req, res, 400, 40003, '参数无效');
    const pool = getPool();
    if (!(await teacherOwnsCategory(pool, teacherId, categoryId))) return bad(req, res, 404, 40404, '方向不存在');
    const storagePaths = await storagePathsForCategory(pool, teacherId, categoryId);
    await pool.query(`DELETE FROM teacher_instance_library_categories WHERE id = $1 AND teacher_id = $2`, [categoryId, teacherId]);
    removeFiles(storagePaths);
    return ok(req, res, { deleted: true });
  } catch (e) {
    logError(`DELETE teacher instance category traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.post('/teacher/instance-library/categories/:categoryId/cases', requireAuth(), requireTeacher(), async (req, res) => {
  try {
    const teacherId = userIdFromReq(req);
    const categoryId = parseId(req.params.categoryId);
    const title = normalizeText(req.body?.title);
    const detailHtml = String(req.body?.detailHtml || '');
    const tags = normalizeTags(req.body?.tags);
    const projectOutcome = normalizeText(req.body?.projectOutcome);
    const sortOrder = Number.isFinite(Number(req.body?.sortOrder)) ? Number(req.body.sortOrder) : 0;
    const pool = getPool();
    if (!teacherId || !categoryId || !title) return bad(req, res, 400, 40003, '实例标题不能为空');
    if (!(await teacherOwnsCategory(pool, teacherId, categoryId))) return bad(req, res, 404, 40404, '方向不存在');
    const { rows } = await pool.query(
      `INSERT INTO teacher_instance_library_cases
         (teacher_id, category_id, title, detail_html, tags, project_outcome, sort_order)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
       RETURNING id, category_id, title, detail_html, tags, project_outcome, sort_order,
         cover_storage_path, cover_origin_name, cover_mime_type, created_at, updated_at`,
      [teacherId, categoryId, title, detailHtml, JSON.stringify(tags), projectOutcome, sortOrder]
    );
    return ok(req, res, mapCase(rows[0], []));
  } catch (e) {
    logError(`POST teacher instance case traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.put('/teacher/instance-library/cases/:caseId', requireAuth(), requireTeacher(), async (req, res) => {
  try {
    const teacherId = userIdFromReq(req);
    const caseId = parseId(req.params.caseId);
    const categoryId = parseId(req.body?.categoryId);
    const title = normalizeText(req.body?.title);
    const detailHtml = String(req.body?.detailHtml || '');
    const tags = normalizeTags(req.body?.tags);
    const projectOutcome = normalizeText(req.body?.projectOutcome);
    const sortOrder = Number.isFinite(Number(req.body?.sortOrder)) ? Number(req.body.sortOrder) : 0;
    const pool = getPool();
    if (!teacherId || !caseId || !categoryId || !title) return bad(req, res, 400, 40003, '参数无效');
    if (!(await teacherOwnsCategory(pool, teacherId, categoryId))) return bad(req, res, 404, 40404, '方向不存在');
    const { rows } = await pool.query(
      `UPDATE teacher_instance_library_cases
       SET category_id = $3, title = $4, detail_html = $5, tags = $6::jsonb, project_outcome = $7, sort_order = $8
       WHERE id = $1 AND teacher_id = $2
       RETURNING id, category_id, title, detail_html, tags, project_outcome, sort_order,
         cover_storage_path, cover_origin_name, cover_mime_type, created_at, updated_at`,
      [caseId, teacherId, categoryId, title, detailHtml, JSON.stringify(tags), projectOutcome, sortOrder]
    );
    if (!rows.length) return bad(req, res, 404, 40404, '实例不存在');
    const resourceRows = await pool.query(
      `SELECT id, case_id, usage, origin_name, storage_name, storage_path, mime_type, size_bytes, resource_type, created_at
       FROM teacher_instance_library_resources
       WHERE case_id = $1
       ORDER BY sort_order ASC, id ASC`,
      [caseId]
    );
    return ok(req, res, mapCase(rows[0], resourceRows.rows.map(mapResource)));
  } catch (e) {
    logError(`PUT teacher instance case traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.delete('/teacher/instance-library/cases/:caseId', requireAuth(), requireTeacher(), async (req, res) => {
  try {
    const teacherId = userIdFromReq(req);
    const caseId = parseId(req.params.caseId);
    if (!teacherId || !caseId) return bad(req, res, 400, 40003, '参数无效');
    const pool = getPool();
    if (!(await teacherOwnsCase(pool, teacherId, caseId))) return bad(req, res, 404, 40404, '实例不存在');
    const storagePaths = await storagePathsForCase(pool, teacherId, caseId);
    await pool.query(`DELETE FROM teacher_instance_library_cases WHERE id = $1 AND teacher_id = $2`, [caseId, teacherId]);
    removeFiles(storagePaths);
    return ok(req, res, { deleted: true });
  } catch (e) {
    logError(`DELETE teacher instance case traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.post(
  '/teacher/instance-library/cases/:caseId/cover',
  requireAuth(),
  requireTeacher(),
  uploadCover.single('file'),
  async (req, res) => {
    try {
      const teacherId = userIdFromReq(req);
      const caseId = parseId(req.params.caseId);
      const pool = getPool();
      if (!teacherId || !caseId || !req.file) return bad(req, res, 400, 40003, '请上传封面图片');
      if (!(await teacherOwnsCase(pool, teacherId, caseId))) return bad(req, res, 404, 40404, '实例不存在');
      const mime = String(req.file.mimetype || '').toLowerCase();
      if (!isCoverImageMime(mime)) return bad(req, res, 400, 40004, '封面仅支持 JPG、PNG、GIF、WEBP');
      const prev = await loadTeacherCaseCoverRow(pool, teacherId, caseId);
      const originName = normalizeUploadFileName(req.file.originalname);
      const ext = path.extname(originName).toLowerCase();
      const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      const safeExt = allowed.includes(ext) ? ext : '.jpg';
      const storageName = `${randomUUID()}_cover${safeExt}`;
      const storageDir = path.join(String(teacherId), String(caseId));
      fs.mkdirSync(path.join(UPLOAD_ROOT, storageDir), { recursive: true });
      const relPath = path.join(storageDir, storageName).replace(/\\/g, '/');
      fs.writeFileSync(resourceAbsPath(relPath), req.file.buffer);

      await pool.query(
        `UPDATE teacher_instance_library_cases
         SET cover_storage_path = $1, cover_origin_name = $2, cover_mime_type = $3
         WHERE id = $4 AND teacher_id = $5`,
        [relPath, originName, mime || null, caseId, teacherId]
      );

      if (prev?.cover_storage_path && prev.cover_storage_path !== relPath) {
        removeFiles([prev.cover_storage_path]);
      }

      const mapped = await mappedTeacherCase(pool, teacherId, caseId);
      return ok(req, res, mapped);
    } catch (e) {
      logError(`POST teacher instance case cover traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.delete('/teacher/instance-library/cases/:caseId/cover', requireAuth(), requireTeacher(), async (req, res) => {
  try {
    const teacherId = userIdFromReq(req);
    const caseId = parseId(req.params.caseId);
    const pool = getPool();
    if (!teacherId || !caseId) return bad(req, res, 400, 40003, '参数无效');
    const prev = await loadTeacherCaseCoverRow(pool, teacherId, caseId);
    if (!prev?.cover_storage_path) {
      const mapped = await mappedTeacherCase(pool, teacherId, caseId);
      if (!mapped) return bad(req, res, 404, 40404, '实例不存在');
      return ok(req, res, mapped);
    }
    await pool.query(
      `UPDATE teacher_instance_library_cases
       SET cover_storage_path = NULL, cover_origin_name = NULL, cover_mime_type = NULL
       WHERE id = $1 AND teacher_id = $2`,
      [caseId, teacherId]
    );
    removeFiles([prev.cover_storage_path]);
    const mapped = await mappedTeacherCase(pool, teacherId, caseId);
    return ok(req, res, mapped);
  } catch (e) {
    logError(`DELETE teacher instance case cover traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.get(
  '/teacher/instance-library/cases/:caseId/cover',
  bearerFromQuery,
  requireAuth(),
  requireTeacher(),
  async (req, res) => {
    try {
      const teacherId = userIdFromReq(req);
      const caseId = parseId(req.params.caseId);
      if (!teacherId || !caseId) return bad(req, res, 400, 40003, '参数无效');
      const row = await loadTeacherCaseCoverRow(getPool(), teacherId, caseId);
      if (!row?.cover_storage_path) return bad(req, res, 404, 40404, '无封面');
      return sendCaseCover(req, res, row);
    } catch (e) {
      logError(`GET teacher instance case cover traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

async function mappedTeacherCase(pool, teacherId, caseId) {
  const { rows } = await pool.query(
    `SELECT id, category_id, title, detail_html, tags, project_outcome, sort_order,
            cover_storage_path, cover_origin_name, cover_mime_type, created_at, updated_at
     FROM teacher_instance_library_cases
     WHERE id = $1 AND teacher_id = $2`,
    [caseId, teacherId]
  );
  const r = rows[0];
  if (!r) return null;
  const resourceRows = await pool.query(
    `SELECT id, case_id, usage, origin_name, storage_name, storage_path, mime_type, size_bytes, resource_type, created_at
     FROM teacher_instance_library_resources
     WHERE case_id = $1
     ORDER BY sort_order ASC, id ASC`,
    [caseId]
  );
  return mapCase(r, resourceRows.rows.map(mapResource));
}

router.post(
  '/teacher/instance-library/cases/:caseId/resources',
  requireAuth(),
  requireTeacher(),
  upload.single('file'),
  async (req, res) => {
    try {
      const teacherId = userIdFromReq(req);
      const caseId = parseId(req.params.caseId);
      if (!teacherId || !caseId || !req.file) return bad(req, res, 400, 40003, '请选择上传文件');
      const pool = getPool();
      if (!(await teacherOwnsCase(pool, teacherId, caseId))) return bad(req, res, 404, 40404, '实例不存在');
      const originName = normalizeUploadFileName(req.file.originalname);
      const storageName = safeStorageName(originName);
      const storageDir = path.join(String(teacherId), String(caseId));
      const absDir = path.join(UPLOAD_ROOT, storageDir);
      fs.mkdirSync(absDir, { recursive: true });
      const storagePath = path.join(storageDir, storageName).replace(/\\/g, '/');
      fs.writeFileSync(resourceAbsPath(storagePath), req.file.buffer);
      const usage = req.body?.usage === 'inline' ? 'inline' : 'attachment';
      const { rows } = await pool.query(
        `INSERT INTO teacher_instance_library_resources
           (case_id, usage, origin_name, storage_name, storage_path, mime_type, size_bytes, resource_type, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, case_id, usage, origin_name, storage_name, storage_path, mime_type, size_bytes, resource_type, created_at`,
        [
          caseId,
          usage,
          originName,
          storageName,
          storagePath,
          req.file.mimetype || '',
          req.file.size,
          resourceTypeFromFile(req.file.mimetype, originName),
          teacherId,
        ]
      );
      return ok(req, res, mapResource(rows[0]));
    } catch (e) {
      logError(`POST teacher instance resource traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.delete('/teacher/instance-library/resources/:resourceId', requireAuth(), requireTeacher(), async (req, res) => {
  try {
    const teacherId = userIdFromReq(req);
    const resourceId = parseId(req.params.resourceId);
    if (!teacherId || !resourceId) return bad(req, res, 400, 40003, '参数无效');
    const pool = getPool();
    const row = await loadTeacherResource(pool, teacherId, resourceId);
    if (!row) return bad(req, res, 404, 40404, '资源不存在');
    await pool.query(`DELETE FROM teacher_instance_library_resources WHERE id = $1`, [resourceId]);
    removeFiles([row.storage_path]);
    return ok(req, res, { deleted: true });
  } catch (e) {
    logError(`DELETE teacher instance resource traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.get('/teacher/instance-library/resources/:resourceId/download', bearerFromQuery, requireAuth(), requireTeacher(), async (req, res) => {
  try {
    const teacherId = userIdFromReq(req);
    const resourceId = parseId(req.params.resourceId);
    if (!teacherId || !resourceId) return bad(req, res, 400, 40003, '参数无效');
    const row = await loadTeacherResource(getPool(), teacherId, resourceId);
    if (!row) return bad(req, res, 404, 40404, '资源不存在');
    return sendResource(req, res, row, 'download');
  } catch (e) {
    logError(`GET teacher instance resource download traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.get('/teacher/instance-library/resources/:resourceId/preview', bearerFromQuery, requireAuth(), requireTeacher(), async (req, res) => {
  try {
    const teacherId = userIdFromReq(req);
    const resourceId = parseId(req.params.resourceId);
    if (!teacherId || !resourceId) return bad(req, res, 400, 40003, '参数无效');
    const row = await loadTeacherResource(getPool(), teacherId, resourceId);
    if (!row) return bad(req, res, 404, 40404, '资源不存在');
    return sendResource(req, res, row, 'preview');
  } catch (e) {
    logError(`GET teacher instance resource preview traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.get('/student/personal-classes/:classId/instance-library', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const studentId = userIdFromReq(req);
    const classId = parseId(req.params.classId);
    if (!studentId || !classId) return bad(req, res, 400, 40003, '参数无效');
    const pool = getPool();
    const teacherId = await studentEnrolledInClass(pool, studentId, classId);
    if (!teacherId) return bad(req, res, 403, 40301, '未加入该班级');
    const moduleKey = normalizeModuleKey(req.query.moduleKey);
    const categories = await loadLibraryForTeacher(pool, teacherId, moduleKey);
    return ok(req, res, { categories });
  } catch (e) {
    logError(`GET student instance library traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.get(
  '/student/personal-classes/:classId/instance-library/resources/:resourceId/download',
  bearerFromQuery,
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const studentId = userIdFromReq(req);
      const classId = parseId(req.params.classId);
      const resourceId = parseId(req.params.resourceId);
      if (!studentId || !classId || !resourceId) return bad(req, res, 400, 40003, '参数无效');
      const row = await loadStudentResource(getPool(), studentId, classId, resourceId);
      if (!row) return bad(req, res, 404, 40404, '资源不存在');
      return sendResource(req, res, row, 'download');
    } catch (e) {
      logError(`GET student instance resource download traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.get(
  '/student/personal-classes/:classId/instance-library/resources/:resourceId/preview',
  bearerFromQuery,
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const studentId = userIdFromReq(req);
      const classId = parseId(req.params.classId);
      const resourceId = parseId(req.params.resourceId);
      if (!studentId || !classId || !resourceId) return bad(req, res, 400, 40003, '参数无效');
      const row = await loadStudentResource(getPool(), studentId, classId, resourceId);
      if (!row) return bad(req, res, 404, 40404, '资源不存在');
      return sendResource(req, res, row, 'preview');
    } catch (e) {
      logError(`GET student instance resource preview traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.get(
  '/student/personal-classes/:classId/instance-library/cases/:caseId/cover',
  bearerFromQuery,
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const studentId = userIdFromReq(req);
      const classId = parseId(req.params.classId);
      const caseId = parseId(req.params.caseId);
      if (!studentId || !classId || !caseId) return bad(req, res, 400, 40003, '参数无效');
      const row = await loadStudentCaseCoverRow(getPool(), studentId, classId, caseId);
      if (!row?.cover_storage_path) return bad(req, res, 404, 40404, '无封面');
      return sendCaseCover(req, res, row);
    } catch (e) {
      logError(`GET student instance case cover traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

export default router;
