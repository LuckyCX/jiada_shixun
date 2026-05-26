import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import multer from 'multer';
import { getPool } from '../lib/db.js';
import { logError } from '../lib/logError.js';
import { requireAuth, requireTeacher, requireStudent } from '../middleware/auth.js';
import {
  TASK_MODULES,
  TASK_PRIORITIES,
  MAX_TASK_ATTACHMENTS,
  MAX_TASK_ATTACHMENT_BYTES,
  TASK_MODULE_TO_TRAINING_ID,
} from '../lib/personalClassTaskConstants.js';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_ROOT = path.join(__dirname, '../../uploads/personal-class-tasks');

function ok(req, res, data, message = 'OK') {
  return res.json({ code: 0, message, data, traceId: req.traceId });
}

function bad(req, res, status, code, message) {
  return res.status(status).json({ code, message, data: null, traceId: req.traceId });
}

function teacherIdFromReq(req) {
  const id = Number(String(req.user?.sub || '').trim());
  return Number.isFinite(id) && id > 0 ? id : null;
}

function studentIdFromReq(req) {
  const id = Number(String(req.user?.sub || '').trim());
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function studentEnrolledInClass(pool, studentId, classId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM teacher_personal_class_students WHERE teacher_personal_class_id = $1 AND student_id = $2`,
    [classId, studentId]
  );
  return rows.length > 0;
}

function formatDateOnly(val) {
  if (val == null || val === '') return '';
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return s.slice(0, 10);
}

function daysUntilDeadline(deadline) {
  const iso = formatDateOnly(deadline);
  if (!iso) return 0;
  const d = new Date(`${iso}T00:00:00`);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

function parseId(param) {
  const id = Number(String(param || '').trim());
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function ownsPersonalClass(pool, teacherId, classId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM teacher_personal_classes WHERE id = $1 AND teacher_id = $2`,
    [classId, teacherId]
  );
  return rows.length > 0;
}

async function getTaskTargetStudentIds(db, classId, scope, teamIds = []) {
  if (scope === 'specific' && teamIds.length > 0) {
    const { rows } = await db.query(
      `SELECT DISTINCT m.student_id AS "studentId"
       FROM teacher_personal_class_team_members m
       JOIN teacher_personal_class_teams t ON t.id = m.team_id
       WHERE t.teacher_personal_class_id = $1
         AND m.team_id = ANY($2::bigint[])`,
      [classId, teamIds]
    );
    return rows.map((r) => r.studentId);
  }
  const { rows } = await db.query(
    `SELECT student_id AS "studentId"
     FROM teacher_personal_class_students
     WHERE teacher_personal_class_id = $1`,
    [classId]
  );
  return rows.map((r) => r.studentId);
}

async function studentCanViewTask(db, studentId, classId, taskId) {
  const { rows } = await db.query(
    `SELECT t.scope
     FROM teacher_personal_class_tasks t
     WHERE t.id = $1
       AND t.teacher_personal_class_id = $2
       AND t.status = 'published'
       AND (
         t.scope = 'all'
         OR EXISTS (
           SELECT 1
           FROM teacher_personal_class_task_teams tt
           INNER JOIN teacher_personal_class_team_members m
             ON m.team_id = tt.team_id AND m.student_id = $3
           WHERE tt.task_id = t.id
         )
       )`,
    [taskId, classId, studentId]
  );
  return rows.length > 0;
}

async function notifyTaskTargets(db, { classId, teacherId, task, action }) {
  const targetIds = await getTaskTargetStudentIds(
    db,
    classId,
    task.scope,
    task.scope === 'specific' ? await loadTaskTeams(db, task.id) : []
  );
  if (!targetIds.length) return;

  const title =
    action === 'deleted'
      ? '实训任务已撤回'
      : action === 'updated'
        ? '实训任务已修改'
        : '实训任务已发布';
  const content =
    action === 'deleted'
      ? `教师已撤回实训任务「${task.title}」。`
      : action === 'updated'
        ? `教师已修改实训任务「${task.title}」，请在待办任务中查看最新要求。`
        : `教师已发布实训任务「${task.title}」，请在待办任务中查看并按时完成。`;

  for (const studentId of targetIds) {
    await db.query(
      `INSERT INTO notifications (receiver_id, sender_id, type, title, content, related_module, related_link, is_read)
       VALUES ($1, $2, 'system', $3, $4, 'personal_class_task', '/student-center?tab=overview&panel=tasks', false)`,
      [studentId, teacherId, title, content]
    );
  }
}

function displayStatus(row) {
  if (row.status === 'draft') return 'draft';
  const deadline = row.deadline ? new Date(row.deadline) : null;
  if (deadline) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(deadline);
    d.setHours(0, 0, 0, 0);
    if (d < today) return 'expired';
  }
  return 'published';
}

async function countClassStudents(pool, classId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS c FROM teacher_personal_class_students WHERE teacher_personal_class_id = $1`,
    [classId]
  );
  return rows[0]?.c ?? 0;
}

async function countTaskCompletions(pool, taskId) {
  const { rows } = await pool.query(
    `SELECT COUNT(DISTINCT student_id)::int AS c FROM student_personal_class_task_completions WHERE task_id = $1`,
    [taskId]
  );
  return rows[0]?.c ?? 0;
}

async function loadSubmissionAttachments(pool, taskId, studentId) {
  const { rows } = await pool.query(
    `SELECT id, storage_key AS "storageKey", file_name AS "fileName", file_size AS "fileSize"
     FROM student_personal_class_task_completion_attachments
     WHERE task_id = $1 AND student_id = $2
     ORDER BY sort_order ASC, id ASC`,
    [taskId, studentId]
  );
  return rows.map((r) => ({
    id: String(r.id),
    storageKey: r.storageKey,
    fileName: r.fileName,
    fileSize: Number(r.fileSize),
    size: formatSize(Number(r.fileSize)),
  }));
}

async function teamProgressForTask(pool, taskId, teamIds) {
  if (!teamIds?.length) return [];
  const { rows } = await pool.query(
    `SELECT t.id AS "teamId", t.name AS "teamName",
            (SELECT COUNT(*)::int FROM teacher_personal_class_team_members m WHERE m.team_id = t.id) AS total
     FROM teacher_personal_class_teams t
     WHERE t.id = ANY($1::bigint[])`,
    [teamIds]
  );
  const out = [];
  for (const t of rows) {
    const { rows: cr } = await pool.query(
      `SELECT COUNT(DISTINCT c.student_id)::int AS c
       FROM student_personal_class_task_completions c
       JOIN teacher_personal_class_team_members m ON m.student_id = c.student_id AND m.team_id = $2
       WHERE c.task_id = $1`,
      [taskId, t.teamId]
    );
    out.push({
      teamId: String(t.teamId),
      teamName: t.teamName,
      completed: cr[0]?.c ?? 0,
      total: t.total ?? 0,
    });
  }
  return out;
}

async function loadTaskTeams(pool, taskId) {
  const { rows } = await pool.query(
    `SELECT team_id AS "teamId" FROM teacher_personal_class_task_teams WHERE task_id = $1`,
    [taskId]
  );
  return rows.map((r) => String(r.teamId));
}

async function loadTaskAttachments(pool, taskId) {
  const { rows } = await pool.query(
    `SELECT id, storage_key AS "storageKey", file_name AS "fileName", file_size AS "fileSize"
     FROM teacher_personal_class_task_attachments WHERE task_id = $1 ORDER BY sort_order ASC, id ASC`,
    [taskId]
  );
  return rows.map((r) => ({
    id: String(r.id),
    storageKey: r.storageKey,
    fileName: r.fileName,
    fileSize: Number(r.fileSize),
    size: formatSize(Number(r.fileSize)),
  }));
}

async function loadTaskResourceNodeIds(pool, taskId) {
  const { rows } = await pool.query(
    `SELECT node_id AS "nodeId"
     FROM teacher_personal_class_task_resource_nodes
     WHERE task_id = $1
     ORDER BY node_id ASC`,
    [taskId]
  );
  return rows.map((r) => String(r.nodeId));
}

async function loadTaskResourceNodes(pool, taskId, { publishedLeavesOnly = false, studentId = null } = {}) {
  const query = publishedLeavesOnly
    ? `WITH RECURSIVE selected AS (
         SELECT n.id, n.parent_id, n.level, n.module_key, n.module_name, n.title, n.status, n.sort_order,
                true AS direct_selected
         FROM course_resource_nodes n
         JOIN teacher_personal_class_task_resource_nodes trn ON trn.node_id = n.id
         WHERE trn.task_id = $1
         UNION ALL
         SELECT child.id, child.parent_id, child.level, child.module_key, child.module_name, child.title, child.status, child.sort_order,
                false AS direct_selected
         FROM course_resource_nodes child
         JOIN selected parent ON child.parent_id = parent.id
       )
       SELECT DISTINCT id, parent_id, level, module_key, module_name, title, status, sort_order
       FROM selected
       WHERE (direct_selected = true AND level < 3)
          OR (level = 3 AND status = 'published')
       ORDER BY sort_order ASC, id ASC`
    : `SELECT n.id, n.parent_id, n.level, n.module_key, n.module_name, n.title, n.status, n.sort_order
       FROM teacher_personal_class_task_resource_nodes trn
       JOIN course_resource_nodes n ON n.id = trn.node_id
       WHERE trn.task_id = $1
       ORDER BY n.sort_order ASC, n.id ASC`;
  const { rows } = await pool.query(query, [taskId]);
  if (!rows.length) return [];
  const nodeIds = rows.map((r) => r.id);
  const { rows: fileRows } = await pool.query(
    `SELECT id, node_id, origin_name, resource_type, mime_type, size_bytes, created_at,
            content_hash, preview_mime_type, preview_status
     FROM course_resource_files
     WHERE node_id = ANY($1::bigint[])
     ORDER BY created_at DESC, id DESC`,
    [nodeIds]
  );
  const hashes = fileRows.map((row) => row.content_hash).filter(Boolean);
  const progressByHash = new Map();
  if (studentId && hashes.length) {
    const { rows: progressRows } = await pool.query(
      `SELECT content_hash, progress_percent, last_position, completed_at
       FROM student_course_resource_progress
       WHERE user_id = $1 AND content_hash = ANY($2::varchar[])`,
      [studentId, hashes]
    );
    progressRows.forEach((row) => {
      progressByHash.set(row.content_hash, {
        progressPercent: Number(row.progress_percent || 0),
        lastPosition: row.last_position || {},
        completed: Boolean(row.completed_at),
      });
    });
  }
  const { rows: linkRows } = await pool.query(
    `SELECT l.node_id, k.id, k.title, k.description, k.module_key, k.module_name, k.sort_order
     FROM course_resource_node_knowledge_points l
     JOIN knowledge_points k ON k.id = l.knowledge_point_id
     WHERE l.node_id = ANY($1::bigint[])
     ORDER BY k.sort_order ASC, k.id ASC`,
    [nodeIds]
  );
  const { rows: ancestorRows } = await pool.query(
    `WITH RECURSIVE ancestors AS (
       SELECT leaf.id AS leaf_id, parent.id, parent.parent_id, parent.level,
              parent.module_key, parent.module_name, parent.title, parent.status, parent.sort_order
       FROM course_resource_nodes leaf
       JOIN course_resource_nodes parent ON parent.id = leaf.parent_id
       WHERE leaf.id = ANY($1::bigint[])
       UNION ALL
       SELECT a.leaf_id, parent.id, parent.parent_id, parent.level,
              parent.module_key, parent.module_name, parent.title, parent.status, parent.sort_order
       FROM ancestors a
       JOIN course_resource_nodes parent ON parent.id = a.parent_id
     )
     SELECT *
     FROM ancestors
     ORDER BY leaf_id ASC, level ASC, sort_order ASC, id ASC`,
    [nodeIds]
  );
  const resourcesByNode = new Map();
  for (const row of fileRows) {
    const key = String(row.node_id);
    const items = resourcesByNode.get(key) || [];
    items.push({
      id: String(row.id),
      nodeId: String(row.node_id),
      name: row.origin_name,
      type: row.resource_type,
      previewType: previewTypeFromMime(row.preview_mime_type || row.mime_type, row.resource_type),
      previewStatus: row.preview_status || 'ready',
      contentHash: row.content_hash || '',
      mimeType: row.mime_type || '',
      sizeBytes: Number(row.size_bytes || 0),
      size: formatSize(Number(row.size_bytes || 0)),
      canPreview: (row.preview_status || 'ready') === 'ready' && row.resource_type !== 'archive' && canPreviewCourseResource(row.preview_mime_type || row.mime_type, row.origin_name),
      progress: progressByHash.get(row.content_hash) || { progressPercent: 0, lastPosition: {}, completed: false },
    });
    resourcesByNode.set(key, items);
  }
  const ancestorsByNode = new Map();
  for (const row of ancestorRows) {
    const key = String(row.leaf_id);
    const items = ancestorsByNode.get(key) || [];
    items.push({
      id: String(row.id),
      parentId: row.parent_id ? String(row.parent_id) : null,
      level: Number(row.level),
      moduleKey: row.module_key,
      moduleName: row.module_name,
      title: row.title,
      status: row.status,
      sortOrder: Number(row.sort_order || 0),
    });
    ancestorsByNode.set(key, items);
  }
  const knowledgeByNode = new Map();
  for (const row of linkRows) {
    const key = String(row.node_id);
    const items = knowledgeByNode.get(key) || [];
    items.push({
      id: String(row.id),
      title: row.title,
      description: row.description || '',
      moduleKey: row.module_key || '',
      moduleName: row.module_name || '',
      sortOrder: Number(row.sort_order || 0),
    });
    knowledgeByNode.set(key, items);
  }
  return rows.map((row) => ({
    id: String(row.id),
    parentId: row.parent_id ? String(row.parent_id) : null,
    level: Number(row.level),
    moduleKey: row.module_key,
    moduleName: row.module_name,
    title: row.title,
    status: row.status,
    sortOrder: Number(row.sort_order || 0),
    ancestors: ancestorsByNode.get(String(row.id)) || [],
    resources: resourcesByNode.get(String(row.id)) || [],
    knowledgePoints: knowledgeByNode.get(String(row.id)) || [],
  }));
}

async function loadModuleResourceNodes(pool, moduleName, { studentId = null } = {}) {
  const moduleKey = TASK_MODULE_TO_TRAINING_ID[moduleName];
  if (!moduleKey) return [];
  const { rows } = await pool.query(
    `SELECT id, parent_id, level, module_key, module_name, title, status, sort_order
     FROM course_resource_nodes
     WHERE module_key = $1 AND level = 3 AND status = 'published'
     ORDER BY sort_order ASC, id ASC`,
    [moduleKey]
  );
  if (!rows.length) return [];
  const nodeIds = rows.map((r) => r.id);
  const { rows: fileRows } = await pool.query(
    `SELECT id, node_id, origin_name, resource_type, mime_type, size_bytes, created_at,
            content_hash, preview_mime_type, preview_status
     FROM course_resource_files
     WHERE node_id = ANY($1::bigint[])
     ORDER BY created_at DESC, id DESC`,
    [nodeIds]
  );
  const hashes = fileRows.map((row) => row.content_hash).filter(Boolean);
  const progressByHash = new Map();
  if (studentId && hashes.length) {
    const { rows: progressRows } = await pool.query(
      `SELECT content_hash, progress_percent, last_position, completed_at
       FROM student_course_resource_progress
       WHERE user_id = $1 AND content_hash = ANY($2::varchar[])`,
      [studentId, hashes]
    );
    progressRows.forEach((row) => {
      progressByHash.set(row.content_hash, {
        progressPercent: Number(row.progress_percent || 0),
        lastPosition: row.last_position || {},
        completed: Boolean(row.completed_at),
      });
    });
  }
  const { rows: linkRows } = await pool.query(
    `SELECT l.node_id, k.id, k.title, k.description, k.module_key, k.module_name, k.sort_order
     FROM course_resource_node_knowledge_points l
     JOIN knowledge_points k ON k.id = l.knowledge_point_id
     WHERE l.node_id = ANY($1::bigint[])
     ORDER BY k.sort_order ASC, k.id ASC`,
    [nodeIds]
  );
  const { rows: ancestorRows } = await pool.query(
    `WITH RECURSIVE ancestors AS (
       SELECT leaf.id AS leaf_id, parent.id, parent.parent_id, parent.level,
              parent.module_key, parent.module_name, parent.title, parent.status, parent.sort_order
       FROM course_resource_nodes leaf
       JOIN course_resource_nodes parent ON parent.id = leaf.parent_id
       WHERE leaf.id = ANY($1::bigint[])
       UNION ALL
       SELECT a.leaf_id, parent.id, parent.parent_id, parent.level,
              parent.module_key, parent.module_name, parent.title, parent.status, parent.sort_order
       FROM ancestors a
       JOIN course_resource_nodes parent ON parent.id = a.parent_id
     )
     SELECT *
     FROM ancestors
     ORDER BY leaf_id ASC, level ASC, sort_order ASC, id ASC`,
    [nodeIds]
  );
  const resourcesByNode = new Map();
  for (const row of fileRows) {
    const key = String(row.node_id);
    const items = resourcesByNode.get(key) || [];
    items.push({
      id: String(row.id),
      nodeId: String(row.node_id),
      name: row.origin_name,
      type: row.resource_type,
      previewType: previewTypeFromMime(row.preview_mime_type || row.mime_type, row.resource_type),
      previewStatus: row.preview_status || 'ready',
      contentHash: row.content_hash || '',
      mimeType: row.mime_type || '',
      sizeBytes: Number(row.size_bytes || 0),
      size: formatSize(Number(row.size_bytes || 0)),
      canPreview: (row.preview_status || 'ready') === 'ready' && row.resource_type !== 'archive' && canPreviewCourseResource(row.preview_mime_type || row.mime_type, row.origin_name),
      progress: progressByHash.get(row.content_hash) || { progressPercent: 0, lastPosition: {}, completed: false },
    });
    resourcesByNode.set(key, items);
  }
  const ancestorsByNode = new Map();
  for (const row of ancestorRows) {
    const key = String(row.leaf_id);
    const items = ancestorsByNode.get(key) || [];
    items.push({
      id: String(row.id),
      parentId: row.parent_id ? String(row.parent_id) : null,
      level: Number(row.level),
      moduleKey: row.module_key,
      moduleName: row.module_name,
      title: row.title,
      status: row.status,
      sortOrder: Number(row.sort_order || 0),
    });
    ancestorsByNode.set(key, items);
  }
  const knowledgeByNode = new Map();
  for (const row of linkRows) {
    const key = String(row.node_id);
    const items = knowledgeByNode.get(key) || [];
    items.push({
      id: String(row.id),
      title: row.title,
      description: row.description || '',
      moduleKey: row.module_key || '',
      moduleName: row.module_name || '',
      sortOrder: Number(row.sort_order || 0),
    });
    knowledgeByNode.set(key, items);
  }
  return rows.map((row) => ({
    id: String(row.id),
    parentId: row.parent_id ? String(row.parent_id) : null,
    level: Number(row.level),
    moduleKey: row.module_key,
    moduleName: row.module_name,
    title: row.title,
    status: row.status,
    sortOrder: Number(row.sort_order || 0),
    ancestors: ancestorsByNode.get(String(row.id)) || [],
    resources: resourcesByNode.get(String(row.id)) || [],
    knowledgePoints: knowledgeByNode.get(String(row.id)) || [],
  }));
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

function canPreviewCourseResource(mime, name) {
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

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function attachmentAbsPath(storageKey) {
  return path.join(UPLOAD_ROOT, storageKey);
}

function validateTaskBody(body) {
  const title = String(body?.title || '').trim();
  const description = String(body?.description || '').trim();
  const module = String(body?.module || '').trim();
  const priority = String(body?.priority || 'normal').trim();
  const deadline = String(body?.deadline || '').trim();
  const scope = body?.scope === 'specific' ? 'specific' : 'all';
  const status = body?.status === 'published' ? 'published' : 'draft';
  const attachmentsEnabled = Boolean(body?.attachmentsEnabled);
  const requiresStudentAttachment = Boolean(body?.requiresStudentAttachment);
  const resourceLinkEnabled = false;
  const teamIds = Array.isArray(body?.teamIds)
    ? body.teamIds.map(String).filter(Boolean)
    : [];
  const resourceNodeIds = Array.isArray(body?.resourceNodeIds)
    ? [...new Set(body.resourceNodeIds.map((v) => parseId(v)).filter(Boolean).map(String))]
    : [];

  if (!title) return { error: '请填写任务标题' };
  if (!description) return { error: '请填写任务描述' };
  if (!TASK_MODULES.includes(module)) return { error: '请选择有效模块' };
  if (!TASK_PRIORITIES.includes(priority)) return { error: '请选择紧急程度' };
  if (!deadline) return { error: '请选择截止时间' };
  if (scope === 'specific' && !teamIds.length) return { error: '请选择目标团队' };

  return {
    title,
    description,
    module,
    priority,
    deadline,
    scope,
    status,
    attachmentsEnabled,
    requiresStudentAttachment,
    resourceLinkEnabled,
    teamIds,
    resourceNodeIds,
  };
}

async function mapTaskRow(pool, classId, row) {
  const taskId = row.id;
  const teamIds = await loadTaskTeams(pool, taskId);
  const attachments = await loadTaskAttachments(pool, taskId);
  const resourceNodeIds = await loadTaskResourceNodeIds(pool, taskId);
  const resourceNodes = await loadTaskResourceNodes(pool, taskId);
  let totalTargets = 0;
  let completedCount = await countTaskCompletions(pool, taskId);
  let teamProgress = [];

  if (row.scope === 'all') {
    totalTargets = await countClassStudents(pool, classId);
  } else {
    teamProgress = await teamProgressForTask(pool, taskId, teamIds);
    totalTargets = teamProgress.reduce((s, t) => s + t.total, 0);
    completedCount = teamProgress.reduce((s, t) => s + t.completed, 0);
  }

  const { rows: pub } = await pool.query(`SELECT real_name FROM users WHERE id = $1`, [row.teacher_id]);

  return {
    id: String(taskId),
    title: row.title,
    description: row.description,
    module: row.module,
    priority: row.priority,
    deadline: formatDateOnly(row.deadline),
    scope: row.scope,
    status: displayStatus(row),
    attachmentsEnabled: row.attachments_enabled,
    requiresStudentAttachment: Boolean(row.requires_student_attachment),
    resourceLinkEnabled: row.resource_link_enabled,
    resourceNodeIds,
    resourceNodes,
    publishedAt: row.published_at ? String(row.published_at).slice(0, 10) : '',
    publishedBy: pub[0]?.real_name || '',
    attachments,
    targetTeamIds: teamIds,
    teamProgress,
    completedCount,
    totalTargets,
  };
}

async function mapStudentTodoTaskRow(pool, row, studentId, forceStatus = null) {
  const moduleId = TASK_MODULE_TO_TRAINING_ID[row.module] || null;
  const dl = formatDateOnly(row.deadline);
  const resourceNodes = await loadModuleResourceNodes(pool, row.module, { studentId });
  let status = forceStatus || row.status;
  if (status === 'published' && dl) {
    const disp = displayStatus({ status: 'published', deadline: row.deadline });
    if (disp === 'expired') status = 'expired';
  }
  return {
    id: String(row.id),
    title: row.title,
    description: row.description || '',
    module: row.module,
    moduleId,
    priority: row.priority,
    deadline: dl,
    daysLeft: dl ? daysUntilDeadline(dl) : 0,
    status,
    attachments: row.attachmentsEnabled ? await loadTaskAttachments(pool, row.id) : [],
    requiresStudentAttachment: Boolean(row.requiresStudentAttachment),
    resourceLinkEnabled: resourceNodes.length > 0,
    resourceNodes,
  };
}

async function loadPassedKnowledgePointIds(pool, studentId, tasks) {
  const ids = [
    ...new Set(tasks.flatMap((task) =>
      (task.resourceNodes || []).flatMap((node) => (node.knowledgePoints || []).map((point) => Number(point.id)))
    ).filter(Boolean)),
  ];
  if (!ids.length) return [];
  const { rows } = await pool.query(
    `SELECT DISTINCT q.knowledge_point_id AS "knowledgePointId"
     FROM quiz_attempts a
     JOIN quizzes q ON q.id = a.quiz_id
     WHERE a.user_id = $1
       AND a.passed = true
       AND q.knowledge_point_id = ANY($2::bigint[])`,
    [studentId, ids]
  );
  return rows.map((row) => String(row.knowledgePointId));
}

async function saveTaskTeams(client, taskId, teamIds) {
  await client.query(`DELETE FROM teacher_personal_class_task_teams WHERE task_id = $1`, [taskId]);
  for (const teamId of teamIds) {
    await client.query(
      `INSERT INTO teacher_personal_class_task_teams (task_id, team_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [taskId, teamId]
    );
  }
}

async function validateResourceNodesForModule(client, moduleName, nodeIds) {
  if (!nodeIds.length) return true;
  const moduleKey = TASK_MODULE_TO_TRAINING_ID[moduleName];
  if (!moduleKey) return false;
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS c
     FROM course_resource_nodes
     WHERE id = ANY($1::bigint[]) AND module_key = $2`,
    [nodeIds, moduleKey]
  );
  return Number(rows[0]?.c || 0) === nodeIds.length;
}

async function saveTaskResourceNodes(client, taskId, nodeIds) {
  await client.query(`DELETE FROM teacher_personal_class_task_resource_nodes WHERE task_id = $1`, [taskId]);
  for (const nodeId of nodeIds) {
    await client.query(
      `INSERT INTO teacher_personal_class_task_resource_nodes (task_id, node_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [taskId, nodeId]
    );
  }
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const classId = parseId(req.params.classId);
    const taskId = parseId(req.params.taskId);
    const tid = teacherIdFromReq(req);
    if (!classId || !taskId || !tid) return cb(new Error('参数无效'));
    const dir = path.join(UPLOAD_ROOT, String(tid), String(classId), String(taskId));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    const safe = String(file.originalname || 'file').replace(/[/\\]/g, '_');
    cb(null, `${randomUUID()}_${safe}`);
  },
});

const uploadAttachment = multer({
  storage,
  limits: { fileSize: MAX_TASK_ATTACHMENT_BYTES },
});

const studentSubmissionStorage = multer.diskStorage({
  destination(req, file, cb) {
    const classId = parseId(req.params.classId);
    const taskId = parseId(req.params.taskId);
    const sid = studentIdFromReq(req);
    if (!classId || !taskId || !sid) return cb(new Error('参数无效'));
    const dir = path.join(UPLOAD_ROOT, 'student-submissions', String(classId), String(taskId), String(sid));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    const safe = String(file.originalname || 'file').replace(/[/\\]/g, '_');
    cb(null, `${randomUUID()}_${safe}`);
  },
});

const uploadStudentSubmission = multer({
  storage: studentSubmissionStorage,
  limits: { fileSize: MAX_TASK_ATTACHMENT_BYTES },
});

function submissionAttachmentAbsPath(storageKey) {
  return path.join(UPLOAD_ROOT, storageKey);
}

async function targetStudentsForTask(pool, classId, taskId, scope) {
  if (scope === 'specific') {
    const { rows } = await pool.query(
      `SELECT DISTINCT u.id, COALESCE(u.real_name, u.username) AS name, COALESCE(u.student_no, '') AS "studentNo",
              t.id AS "teamId", t.name AS "teamName"
       FROM teacher_personal_class_task_teams tt
       JOIN teacher_personal_class_teams t ON t.id = tt.team_id
       JOIN teacher_personal_class_team_members m ON m.team_id = t.id
       JOIN users u ON u.id = m.student_id
       WHERE tt.task_id = $1
       ORDER BY t.id ASC, u.id ASC`,
      [taskId]
    );
    return rows;
  }
  const { rows } = await pool.query(
    `SELECT u.id, COALESCE(u.real_name, u.username) AS name, COALESCE(u.student_no, '') AS "studentNo",
            t.id AS "teamId", t.name AS "teamName"
     FROM teacher_personal_class_students s
     JOIN users u ON u.id = s.student_id
     LEFT JOIN teacher_personal_class_team_members m ON m.student_id = u.id
     LEFT JOIN teacher_personal_class_teams t
       ON t.id = m.team_id AND t.teacher_personal_class_id = s.teacher_personal_class_id
     WHERE s.teacher_personal_class_id = $1
     ORDER BY t.id NULLS LAST, u.id ASC`,
    [classId]
  );
  return rows;
}

async function mapSubmissionDetail(pool, classId, task) {
  const students = await targetStudentsForTask(pool, classId, task.id, task.scope);
  const { rows: completions } = await pool.query(
    `SELECT student_id AS "studentId", completed_at AS "completedAt"
     FROM student_personal_class_task_completions
     WHERE task_id = $1`,
    [task.id]
  );
  const completedByStudent = new Map(completions.map((row) => [String(row.studentId), row.completedAt]));
  const items = [];
  for (const row of students) {
    const studentId = String(row.id);
    const completedAt = completedByStudent.get(studentId);
    items.push({
      studentId,
      name: row.name || '',
      studentNo: row.studentNo || '',
      teamId: row.teamId ? String(row.teamId) : '',
      teamName: row.teamName || '未分组',
      completed: Boolean(completedAt),
      completedAt: completedAt ? new Date(completedAt).toISOString() : '',
      attachments: task.requires_student_attachment ? await loadSubmissionAttachments(pool, task.id, studentId) : [],
    });
  }
  const teams = Array.from(new Map(items.map((item) => [item.teamId || 'none', {
    teamId: item.teamId || 'none',
    teamName: item.teamName || '未分组',
  }])).values()).map((team) => ({
    ...team,
    members: items.filter((item) => (item.teamId || 'none') === team.teamId),
  }));
  return {
    taskId: String(task.id),
    title: task.title,
    scope: task.scope,
    requiresStudentAttachment: Boolean(task.requires_student_attachment),
    totalTargets: items.length,
    completedCount: items.filter((item) => item.completed).length,
    students: items,
    teams,
  };
}

router.get(
  '/teacher/personal-classes/:classId/teams-for-task',
  requireAuth(),
  requireTeacher(),
  async (req, res) => {
    try {
      const tid = teacherIdFromReq(req);
      const classId = parseId(req.params.classId);
      if (!tid || !classId) return bad(req, res, 400, 40003, '参数无效');
      const pool = getPool();
      if (!(await ownsPersonalClass(pool, tid, classId))) {
        return bad(req, res, 404, 40402, '班级不存在或无权操作');
      }
      const { rows: teamRows } = await pool.query(
        `SELECT t.id, t.name,
                (SELECT COUNT(*)::int FROM teacher_personal_class_team_members m WHERE m.team_id = t.id) AS "memberCount"
         FROM teacher_personal_class_teams t
         WHERE t.teacher_personal_class_id = $1 AND t.grouping_status IN ('draft', 'confirmed')
         ORDER BY t.sort_order ASC, t.id ASC`,
        [classId]
      );
      const teams = teamRows
        .filter((t) => (t.memberCount ?? 0) > 0)
        .map((t) => ({
          id: String(t.id),
          name: t.name,
          memberCount: t.memberCount,
        }));
      return ok(req, res, { teams });
    } catch (e) {
      logError(`GET teams-for-task traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.get(
  '/teacher/personal-classes/:classId/tasks',
  requireAuth(),
  requireTeacher(),
  async (req, res) => {
    try {
      const tid = teacherIdFromReq(req);
      const classId = parseId(req.params.classId);
      if (!tid || !classId) return bad(req, res, 400, 40003, '参数无效');
      const pool = getPool();
      if (!(await ownsPersonalClass(pool, tid, classId))) {
        return bad(req, res, 404, 40402, '班级不存在或无权操作');
      }
      const { rows } = await pool.query(
        `SELECT * FROM teacher_personal_class_tasks
         WHERE teacher_personal_class_id = $1
         ORDER BY created_at DESC`,
        [classId]
      );
      const tasks = [];
      for (const row of rows) {
        tasks.push(await mapTaskRow(pool, classId, row));
      }
      return ok(req, res, { tasks, modules: TASK_MODULES });
    } catch (e) {
      logError(`GET tasks traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.get(
  '/teacher/personal-classes/:classId/tasks/:taskId',
  requireAuth(),
  requireTeacher(),
  async (req, res) => {
    try {
      const tid = teacherIdFromReq(req);
      const classId = parseId(req.params.classId);
      const taskId = parseId(req.params.taskId);
      if (!tid || !classId || !taskId) return bad(req, res, 400, 40003, '参数无效');
      const pool = getPool();
      if (!(await ownsPersonalClass(pool, tid, classId))) {
        return bad(req, res, 404, 40402, '班级不存在或无权操作');
      }
      const { rows } = await pool.query(
        `SELECT * FROM teacher_personal_class_tasks WHERE id = $1 AND teacher_personal_class_id = $2`,
        [taskId, classId]
      );
      if (!rows.length) return bad(req, res, 404, 40403, '任务不存在');
      return ok(req, res, await mapTaskRow(pool, classId, rows[0]));
    } catch (e) {
      logError(`GET task traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.post(
  '/teacher/personal-classes/:classId/tasks',
  requireAuth(),
  requireTeacher(),
  async (req, res) => {
    try {
      const tid = teacherIdFromReq(req);
      const classId = parseId(req.params.classId);
      if (!tid || !classId) return bad(req, res, 400, 40003, '参数无效');
      const pool = getPool();
      if (!(await ownsPersonalClass(pool, tid, classId))) {
        return bad(req, res, 404, 40402, '班级不存在或无权操作');
      }
      const v = validateTaskBody(req.body);
      if (v.error) return bad(req, res, 400, 40010, v.error);

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        if (v.resourceLinkEnabled && !(await validateResourceNodesForModule(client, v.module, v.resourceNodeIds))) {
          await client.query('ROLLBACK');
          return bad(req, res, 400, 40014, '课程资源与实训模块不匹配');
        }
        const { rows: ins } = await client.query(
          `INSERT INTO teacher_personal_class_tasks
             (teacher_personal_class_id, teacher_id, title, description, module, priority, deadline,
              scope, status, attachments_enabled, requires_student_attachment, resource_link_enabled, published_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           RETURNING *`,
          [
            classId,
            tid,
            v.title,
            v.description,
            v.module,
            v.priority,
            v.deadline,
            v.scope,
            v.status,
            v.attachmentsEnabled,
            v.requiresStudentAttachment,
            v.resourceLinkEnabled,
            v.status === 'published' ? new Date() : null,
          ]
        );
        const taskId = ins[0].id;
        if (v.scope === 'specific') await saveTaskTeams(client, taskId, v.teamIds);
        if (v.status === 'published') {
          await notifyTaskTargets(client, { classId, teacherId: tid, task: { ...ins[0], scope: v.scope }, action: 'published' });
        }
        await client.query('COMMIT');
        return ok(req, res, await mapTaskRow(pool, classId, ins[0]));
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    } catch (e) {
      logError(`POST tasks traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.put(
  '/teacher/personal-classes/:classId/tasks/:taskId',
  requireAuth(),
  requireTeacher(),
  async (req, res) => {
    try {
      const tid = teacherIdFromReq(req);
      const classId = parseId(req.params.classId);
      const taskId = parseId(req.params.taskId);
      if (!tid || !classId || !taskId) return bad(req, res, 400, 40003, '参数无效');
      const pool = getPool();
      if (!(await ownsPersonalClass(pool, tid, classId))) {
        return bad(req, res, 404, 40402, '班级不存在或无权操作');
      }
      const v = validateTaskBody(req.body);
      if (v.error) return bad(req, res, 400, 40010, v.error);

      const { rows: existing } = await pool.query(
        `SELECT status, published_at FROM teacher_personal_class_tasks WHERE id = $1 AND teacher_personal_class_id = $2`,
        [taskId, classId]
      );
      if (!existing.length) return bad(req, res, 404, 40403, '任务不存在');

      let publishedAt = existing[0].published_at;
      if (v.status === 'published' && !publishedAt) publishedAt = new Date();
      const previousResourceNodeIds = await loadTaskResourceNodeIds(pool, taskId);
      const nextResourceNodeIds = v.resourceLinkEnabled ? v.resourceNodeIds : [];
      const hasAddedResourceNodes = nextResourceNodeIds.some((id) => !previousResourceNodeIds.includes(String(id)));

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        if (v.resourceLinkEnabled && !(await validateResourceNodesForModule(client, v.module, v.resourceNodeIds))) {
          await client.query('ROLLBACK');
          return bad(req, res, 400, 40014, '课程资源与实训模块不匹配');
        }
        const { rows: upd } = await client.query(
          `UPDATE teacher_personal_class_tasks SET
             title = $3, description = $4, module = $5, priority = $6, deadline = $7,
             scope = $8, status = $9, attachments_enabled = $10, requires_student_attachment = $11,
             resource_link_enabled = $12, published_at = $13, updated_at = now()
           WHERE id = $1 AND teacher_personal_class_id = $2
           RETURNING *`,
          [
            taskId,
            classId,
            v.title,
            v.description,
            v.module,
            v.priority,
            v.deadline,
            v.scope,
            v.status,
            v.attachmentsEnabled,
            v.requiresStudentAttachment,
            v.resourceLinkEnabled,
            publishedAt,
          ]
        );
        if (v.scope === 'specific') await saveTaskTeams(client, taskId, v.teamIds);
        else await client.query(`DELETE FROM teacher_personal_class_task_teams WHERE task_id = $1`, [taskId]);
        await saveTaskResourceNodes(client, taskId, []);
        if (hasAddedResourceNodes) {
          await client.query(`DELETE FROM student_personal_class_task_completions WHERE task_id = $1`, [taskId]);
        }
        if (v.status === 'published') {
          const action = existing[0].status === 'published' || existing[0].published_at ? 'updated' : 'published';
          await notifyTaskTargets(client, { classId, teacherId: tid, task: upd[0], action });
        }
        await client.query('COMMIT');
        return ok(req, res, await mapTaskRow(pool, classId, upd[0]));
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    } catch (e) {
      logError(`PUT task traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.delete(
  '/teacher/personal-classes/:classId/tasks/:taskId',
  requireAuth(),
  requireTeacher(),
  async (req, res) => {
    try {
      const tid = teacherIdFromReq(req);
      const classId = parseId(req.params.classId);
      const taskId = parseId(req.params.taskId);
      if (!tid || !classId || !taskId) return bad(req, res, 400, 40003, '参数无效');
      const pool = getPool();
      if (!(await ownsPersonalClass(pool, tid, classId))) {
        return bad(req, res, 404, 40402, '班级不存在或无权操作');
      }
      const attachments = await loadTaskAttachments(pool, taskId);
      const { rows: taskRows } = await pool.query(
        `SELECT * FROM teacher_personal_class_tasks WHERE id = $1 AND teacher_personal_class_id = $2`,
        [taskId, classId]
      );
      if (!taskRows.length) return bad(req, res, 404, 40403, '任务不存在');
      const task = taskRows[0];
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        if (task.status === 'published') {
          await notifyTaskTargets(client, { classId, teacherId: tid, task, action: 'deleted' });
        }
        await client.query(
          `DELETE FROM teacher_personal_class_tasks WHERE id = $1 AND teacher_personal_class_id = $2`,
          [taskId, classId]
        );
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
      const taskDir = path.join(UPLOAD_ROOT, String(tid), String(classId), String(taskId));
      for (const a of attachments) {
        try {
          fs.unlinkSync(attachmentAbsPath(a.storageKey));
        } catch {
          /* ignore */
        }
      }
      try {
        fs.rmSync(taskDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
      return ok(req, res, { deleted: true });
    } catch (e) {
      logError(`DELETE task traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.post(
  '/teacher/personal-classes/:classId/tasks/:taskId/attachments',
  requireAuth(),
  requireTeacher(),
  uploadAttachment.single('file'),
  async (req, res) => {
    try {
      const tid = teacherIdFromReq(req);
      const classId = parseId(req.params.classId);
      const taskId = parseId(req.params.taskId);
      if (!tid || !classId || !taskId) return bad(req, res, 400, 40003, '参数无效');
      const pool = getPool();
      if (!(await ownsPersonalClass(pool, tid, classId))) {
        return bad(req, res, 404, 40402, '班级不存在或无权操作');
      }
      const { rows: tr } = await pool.query(
        `SELECT attachments_enabled FROM teacher_personal_class_tasks WHERE id = $1 AND teacher_personal_class_id = $2`,
        [taskId, classId]
      );
      if (!tr.length) return bad(req, res, 404, 40403, '任务不存在');
      if (!tr[0].attachments_enabled) return bad(req, res, 400, 40011, '请先开启附件开关');
      const { rows: cnt } = await pool.query(
        `SELECT COUNT(*)::int AS c FROM teacher_personal_class_task_attachments WHERE task_id = $1`,
        [taskId]
      );
      if ((cnt[0]?.c ?? 0) >= MAX_TASK_ATTACHMENTS) {
        return bad(req, res, 400, 40012, `最多上传 ${MAX_TASK_ATTACHMENTS} 个附件`);
      }
      if (!req.file) return bad(req, res, 400, 40013, '请选择文件');

      const relKey = path.join(String(tid), String(classId), String(taskId), req.file.filename);
      const { rows: ins } = await pool.query(
        `INSERT INTO teacher_personal_class_task_attachments (task_id, storage_key, file_name, file_size, sort_order)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [taskId, relKey, req.file.originalname, req.file.size, cnt[0].c]
      );
      return ok(req, res, {
        id: String(ins[0].id),
        fileName: req.file.originalname,
        fileSize: req.file.size,
        size: formatSize(req.file.size),
        storageKey: relKey,
      });
    } catch (e) {
      logError(`POST attachment traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.delete(
  '/teacher/personal-classes/:classId/tasks/:taskId/attachments/:attachmentId',
  requireAuth(),
  requireTeacher(),
  async (req, res) => {
    try {
      const tid = teacherIdFromReq(req);
      const classId = parseId(req.params.classId);
      const taskId = parseId(req.params.taskId);
      const attachmentId = parseId(req.params.attachmentId);
      if (!tid || !classId || !taskId || !attachmentId) return bad(req, res, 400, 40003, '参数无效');
      const pool = getPool();
      if (!(await ownsPersonalClass(pool, tid, classId))) {
        return bad(req, res, 404, 40402, '班级不存在或无权操作');
      }
      const { rows } = await pool.query(
        `SELECT storage_key FROM teacher_personal_class_task_attachments
         WHERE id = $1 AND task_id = $2`,
        [attachmentId, taskId]
      );
      if (!rows.length) return bad(req, res, 404, 40404, '附件不存在');
      await pool.query(`DELETE FROM teacher_personal_class_task_attachments WHERE id = $1`, [attachmentId]);
      try {
        fs.unlinkSync(attachmentAbsPath(rows[0].storage_key));
      } catch {
        /* ignore */
      }
      return ok(req, res, { deleted: true });
    } catch (e) {
      logError(`DELETE attachment traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.get(
  '/teacher/personal-classes/:classId/tasks/:taskId/submissions',
  requireAuth(),
  requireTeacher(),
  async (req, res) => {
    try {
      const tid = teacherIdFromReq(req);
      const classId = parseId(req.params.classId);
      const taskId = parseId(req.params.taskId);
      if (!tid || !classId || !taskId) return bad(req, res, 400, 40003, '参数无效');
      const pool = getPool();
      if (!(await ownsPersonalClass(pool, tid, classId))) {
        return bad(req, res, 404, 40402, '班级不存在或无权操作');
      }
      const { rows } = await pool.query(
        `SELECT * FROM teacher_personal_class_tasks WHERE id = $1 AND teacher_personal_class_id = $2`,
        [taskId, classId]
      );
      if (!rows.length) return bad(req, res, 404, 40403, '任务不存在');
      return ok(req, res, await mapSubmissionDetail(pool, classId, rows[0]));
    } catch (e) {
      logError(`GET task submissions traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.get(
  '/teacher/personal-classes/:classId/tasks/:taskId/submission-attachments/:attachmentId/download',
  requireAuth(),
  requireTeacher(),
  async (req, res) => {
    try {
      const tid = teacherIdFromReq(req);
      const classId = parseId(req.params.classId);
      const taskId = parseId(req.params.taskId);
      const attachmentId = parseId(req.params.attachmentId);
      if (!tid || !classId || !taskId || !attachmentId) return bad(req, res, 400, 40003, '参数无效');
      const pool = getPool();
      if (!(await ownsPersonalClass(pool, tid, classId))) {
        return bad(req, res, 404, 40402, '班级不存在或无权操作');
      }
      const { rows } = await pool.query(
        `SELECT storage_key, file_name
         FROM student_personal_class_task_completion_attachments
         WHERE id = $1 AND task_id = $2`,
        [attachmentId, taskId]
      );
      if (!rows.length) return bad(req, res, 404, 40404, '附件不存在');
      return res.download(submissionAttachmentAbsPath(rows[0].storage_key), rows[0].file_name);
    } catch (e) {
      logError(`GET submission attachment traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.get(
  '/student/personal-classes/:classId/tasks/todos',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const sid = studentIdFromReq(req);
      const classId = parseId(req.params.classId);
      if (!sid || !classId) return bad(req, res, 400, 40003, '参数无效');
      const pool = getPool();
      if (!(await studentEnrolledInClass(pool, sid, classId))) {
        return bad(req, res, 403, 40301, '未加入该班级');
      }
      const baseQuery = `SELECT t.id, t.title, t.description, t.module, t.priority, t.deadline, t.status,
                t.attachments_enabled AS "attachmentsEnabled",
                t.requires_student_attachment AS "requiresStudentAttachment",
                t.resource_link_enabled AS "resourceLinkEnabled"
         FROM teacher_personal_class_tasks t
         WHERE t.teacher_personal_class_id = $1
           AND t.status = 'published'
           AND (
             t.scope = 'all'
             OR EXISTS (
               SELECT 1 FROM teacher_personal_class_task_teams tt
               INNER JOIN teacher_personal_class_team_members m
                 ON m.team_id = tt.team_id AND m.student_id = $2
               WHERE tt.task_id = t.id
             )
           )`;
      const { rows } = await pool.query(
        `SELECT t.id, t.title, t.description, t.module, t.priority, t.deadline, t.status,
                t.attachments_enabled AS "attachmentsEnabled",
                t.requires_student_attachment AS "requiresStudentAttachment",
                t.resource_link_enabled AS "resourceLinkEnabled"
         FROM teacher_personal_class_tasks t
         WHERE t.teacher_personal_class_id = $1
           AND t.status = 'published'
           AND NOT EXISTS (
             SELECT 1 FROM student_personal_class_task_completions c
             WHERE c.task_id = t.id AND c.student_id = $2
           )
           AND (
             t.scope = 'all'
             OR EXISTS (
               SELECT 1 FROM teacher_personal_class_task_teams tt
               INNER JOIN teacher_personal_class_team_members m
                 ON m.team_id = tt.team_id AND m.student_id = $2
               WHERE tt.task_id = t.id
             )
           )
         ORDER BY t.deadline ASC, t.created_at DESC`,
        [classId, sid]
      );
      const { rows: completedRows } = await pool.query(
        `${baseQuery}
           AND EXISTS (
             SELECT 1 FROM student_personal_class_task_completions c
             WHERE c.task_id = t.id AND c.student_id = $2
           )
         ORDER BY t.deadline ASC, t.created_at DESC`,
        [classId, sid]
      );
      const tasks = [];
      for (const row of rows) tasks.push(await mapStudentTodoTaskRow(pool, row, sid));
      const completedTasks = [];
      for (const row of completedRows) completedTasks.push(await mapStudentTodoTaskRow(pool, row, sid, 'completed'));
      const completedKnowledgePointIds = await loadPassedKnowledgePointIds(pool, sid, [...tasks, ...completedTasks]);
      return ok(req, res, { tasks, completedTasks, completedKnowledgePointIds });
    } catch (e) {
      logError(`GET student todos traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.post(
  '/student/personal-classes/:classId/tasks/:taskId/complete',
  requireAuth(),
  requireStudent(),
  uploadStudentSubmission.array('files', MAX_TASK_ATTACHMENTS),
  async (req, res) => {
    try {
      const sid = studentIdFromReq(req);
      const classId = parseId(req.params.classId);
      const taskId = parseId(req.params.taskId);
      if (!sid || !classId || !taskId) return bad(req, res, 400, 40003, '参数无效');
      const pool = getPool();
      if (!(await studentEnrolledInClass(pool, sid, classId))) {
        return bad(req, res, 403, 40301, '未加入该班级');
      }
      if (!(await studentCanViewTask(pool, sid, classId, taskId))) {
        return bad(req, res, 403, 40302, '无权查看该任务');
      }
      const { rows: taskRows } = await pool.query(
        `SELECT requires_student_attachment FROM teacher_personal_class_tasks
         WHERE id = $1 AND teacher_personal_class_id = $2`,
        [taskId, classId]
      );
      if (!taskRows.length) return bad(req, res, 404, 40403, '任务不存在');
      const files = Array.isArray(req.files) ? req.files : [];
      if (taskRows[0].requires_student_attachment && files.length === 0) {
        return bad(req, res, 400, 40015, '请上传任务反馈附件');
      }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `INSERT INTO student_personal_class_task_completions (task_id, student_id)
           VALUES ($1, $2)
           ON CONFLICT (task_id, student_id)
           DO UPDATE SET completed_at = now()`,
          [taskId, sid]
        );
        if (taskRows[0].requires_student_attachment) {
          await client.query(
            `DELETE FROM student_personal_class_task_completion_attachments
             WHERE task_id = $1 AND student_id = $2`,
            [taskId, sid]
          );
          for (let i = 0; i < files.length; i += 1) {
            const file = files[i];
            const relKey = path.join('student-submissions', String(classId), String(taskId), String(sid), file.filename);
            await client.query(
              `INSERT INTO student_personal_class_task_completion_attachments
                (task_id, student_id, storage_key, file_name, file_size, sort_order)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [taskId, sid, relKey, file.originalname, file.size, i]
            );
          }
        }
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
      return ok(req, res, { completed: true });
    } catch (e) {
      logError(`POST student task complete traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.get(
  '/student/personal-classes/:classId/tasks/:taskId/attachments/:attachmentId/download',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const sid = studentIdFromReq(req);
      const classId = parseId(req.params.classId);
      const taskId = parseId(req.params.taskId);
      const attachmentId = parseId(req.params.attachmentId);
      if (!sid || !classId || !taskId || !attachmentId) return bad(req, res, 400, 40003, '参数无效');
      const pool = getPool();
      if (!(await studentEnrolledInClass(pool, sid, classId))) {
        return bad(req, res, 403, 40301, '未加入该班级');
      }
      if (!(await studentCanViewTask(pool, sid, classId, taskId))) {
        return bad(req, res, 403, 40302, '无权查看该任务');
      }
      const { rows } = await pool.query(
        `SELECT a.storage_key AS "storageKey", a.file_name AS "fileName"
         FROM teacher_personal_class_task_attachments a
         JOIN teacher_personal_class_tasks t ON t.id = a.task_id
         WHERE a.id = $1
           AND a.task_id = $2
           AND t.teacher_personal_class_id = $3
           AND t.attachments_enabled = true`,
        [attachmentId, taskId, classId]
      );
      if (!rows.length) return bad(req, res, 404, 40404, '附件不存在');
      const abs = attachmentAbsPath(rows[0].storageKey);
      if (!fs.existsSync(abs)) return bad(req, res, 404, 40405, '文件不存在');
      return res.download(abs, rows[0].fileName);
    } catch (e) {
      logError(`GET student task attachment download traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

export default router;
