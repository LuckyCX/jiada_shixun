import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getPool } from '../lib/db.js';
import { logError } from '../lib/logError.js';
import { normalizeUploadFileName } from '../lib/uploadFileName.js';
import { requireAuth, requireTeacher } from '../middleware/auth.js';
import { coerceSections, sectionsToFullText } from '../lib/businessPlanSections.js';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_ROOT = path.join(__dirname, '../../uploads/business-plan-submissions');

function bearerFromQuery(req, _res, next) {
  if (!req.headers.authorization && typeof req.query.token === 'string' && req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
}

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

function teacherIdFromReq(req) {
  return parseId(req.user?.sub);
}

async function ownsPersonalClass(pool, teacherId, classId) {
  const { rows } = await pool.query(
    `SELECT id, name FROM teacher_personal_classes WHERE id = $1 AND teacher_id = $2`,
    [classId, teacherId]
  );
  return rows[0] || null;
}

async function loadSubmissionAttachments(pool, submissionId, classId) {
  const { rows } = await pool.query(
    `SELECT id, file_name, file_size, is_ppt
     FROM teacher_personal_class_team_business_plan_submission_attachments
     WHERE submission_id = $1
     ORDER BY is_ppt DESC, sort_order ASC, id ASC`,
    [submissionId]
  );
  const ppt = rows.find((r) => r.is_ppt === true) || null;
  const others = rows.filter((r) => r.is_ppt !== true);
  return {
    pptUrl: ppt ? attachmentDownloadUrl(classId, submissionId, ppt.id) : '',
    attachments: others.map((r) => ({
      name: normalizeUploadFileName(r.file_name || ''),
      url: attachmentDownloadUrl(classId, submissionId, r.id),
      size: formatSize(r.file_size),
    })),
  };
}

async function mapSubmissionRow(pool, classId, row) {
  const sections = coerceSections(row.sections_json);
  const full = sectionsToFullText(sections);
  const submissionId = String(row.submission_id);
  const attach = await loadSubmissionAttachments(pool, submissionId, classId);
  return {
    id: submissionId,
    teamId: String(row.team_id),
    teamName: String(row.team_name || ''),
    projectName: String(row.project_name || row.team_name || ''),
    submitTime: row.submitted_at ? new Date(row.submitted_at).toLocaleString('zh-CN') : '',
    status: row.status,
    reviewComment: String(row.review_comment || ''),
    reviewTime: row.reviewed_at ? new Date(row.reviewed_at).toLocaleString('zh-CN') : '',
    reviewer: String(row.reviewer_name || ''),
    versionNumber: Number(row.version_no || 0),
    versionSummary: String(row.version_summary || ''),
    executiveSummary: '',
    marketAnalysis: '',
    productService: '',
    marketingStrategy: '',
    operationPlan: '',
    financialPlan: '',
    teamIntroduction: '',
    riskAnalysis: '',
    fullText: full,
    sections,
    pptUrl: attach.pptUrl || '',
    attachments: attach.attachments,
  };
}

function formatSize(bytes) {
  const n = Number(bytes || 0);
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

function attachmentDownloadUrl(classId, submissionId, attachmentId) {
  return `/api/teacher/personal-classes/${classId}/business-plan/submissions/${submissionId}/attachments/${attachmentId}/download`;
}

function attachmentAbsPath(storageKey) {
  return path.join(UPLOAD_ROOT, String(storageKey || ''));
}

router.get(
  '/teacher/personal-classes/:classId/business-plan/submissions',
  requireAuth(),
  requireTeacher(),
  async (req, res) => {
    try {
      const teacherId = teacherIdFromReq(req);
      const classId = parseId(req.params.classId);
      if (!teacherId || !classId) return bad(req, res, 400, 40001, '无效班级');
      const pool = getPool();
      if (!(await ownsPersonalClass(pool, teacherId, classId))) {
        return bad(req, res, 404, 40401, '班级不存在');
      }
      const statusFilter = String(req.query.status || 'all').trim();
      const params = [classId];
      let statusSql = '';
      if (statusFilter === 'pending' || statusFilter === 'approved' || statusFilter === 'rejected') {
        statusSql = ` AND s.status = $2`;
        params.push(statusFilter);
      }
      const { rows } = await pool.query(
        `SELECT s.id AS submission_id, s.team_id, s.status, s.submitted_at, s.review_comment, s.reviewed_at,
                t.name AS team_name,
                v.version_no, v.summary AS version_summary, v.sections_json,
                tp.project_name,
                COALESCE(tr.real_name, tr.username) AS reviewer_name
         FROM teacher_personal_class_team_business_plan_submissions s
         JOIN teacher_personal_class_teams t ON t.id = s.team_id
         JOIN teacher_personal_class_team_business_plan_versions v ON v.id = s.version_id
         LEFT JOIN teacher_personal_class_team_project_topics tp ON tp.team_id = s.team_id
         LEFT JOIN users tr ON tr.id = s.reviewed_by
         WHERE s.teacher_personal_class_id = $1${statusSql}
         ORDER BY s.submitted_at DESC`,
        params
      );
      const plans = await Promise.all(rows.map((r) => mapSubmissionRow(pool, String(classId), r)));
      return ok(req, res, { plans });
    } catch (e) {
      logError(`GET teacher business-plan submissions traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.get(
  '/teacher/personal-classes/:classId/business-plan/submissions/:submissionId/attachments/:attachmentId/download',
  bearerFromQuery,
  requireAuth(),
  requireTeacher(),
  async (req, res) => {
    try {
      const teacherId = teacherIdFromReq(req);
      const classId = parseId(req.params.classId);
      const submissionId = parseId(req.params.submissionId);
      const attachmentId = parseId(req.params.attachmentId);
      if (!teacherId || !classId || !submissionId || !attachmentId) {
        return bad(req, res, 400, 40001, '参数无效');
      }
      const pool = getPool();
      if (!(await ownsPersonalClass(pool, teacherId, classId))) {
        return bad(req, res, 404, 40401, '班级不存在');
      }
      const { rows } = await pool.query(
        `SELECT a.storage_key, a.file_name
         FROM teacher_personal_class_team_business_plan_submissions s
         JOIN teacher_personal_class_team_business_plan_submission_attachments a ON a.submission_id = s.id
         WHERE s.teacher_personal_class_id = $1 AND s.id = $2 AND a.id = $3`,
        [classId, submissionId, attachmentId]
      );
      if (!rows.length) return bad(req, res, 404, 40404, '附件不存在');
      const abs = attachmentAbsPath(rows[0].storage_key);
      if (!fs.existsSync(abs)) return bad(req, res, 404, 40405, '附件文件不存在');
      return res.download(abs, normalizeUploadFileName(rows[0].file_name || 'file'));
    } catch (e) {
      logError(`GET teacher business-plan attachment download traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.post(
  '/teacher/personal-classes/:classId/business-plan/submissions/:submissionId/review',
  requireAuth(),
  requireTeacher(),
  async (req, res) => {
    try {
      const teacherId = teacherIdFromReq(req);
      const classId = parseId(req.params.classId);
      const submissionId = parseId(req.params.submissionId);
      if (!teacherId || !classId || !submissionId) return bad(req, res, 400, 40001, '参数无效');
      const status = String(req.body?.status || '').trim();
      if (status !== 'approved' && status !== 'rejected') {
        return bad(req, res, 400, 40002, '审核状态无效');
      }
      const comment = String(req.body?.comment || '').trim();
      const pool = getPool();
      if (!(await ownsPersonalClass(pool, teacherId, classId))) {
        return bad(req, res, 404, 40401, '班级不存在');
      }
      const { rows } = await pool.query(
        `SELECT id, status FROM teacher_personal_class_team_business_plan_submissions
         WHERE id = $1 AND teacher_personal_class_id = $2`,
        [submissionId, classId]
      );
      if (!rows.length) return bad(req, res, 404, 40403, '提交记录不存在');
      if (rows[0].status !== 'pending') {
        return bad(req, res, 400, 40004, '该提交已审核');
      }
      await pool.query(
        `UPDATE teacher_personal_class_team_business_plan_submissions
         SET status = $2, review_comment = $3, reviewed_by = $4, reviewed_at = now()
         WHERE id = $1`,
        [submissionId, status, comment, teacherId]
      );
      const { rows: detail } = await pool.query(
        `SELECT s.id AS submission_id, s.team_id, s.status, s.submitted_at, s.review_comment, s.reviewed_at,
                t.name AS team_name,
                v.version_no, v.summary AS version_summary, v.sections_json,
                tp.project_name,
                COALESCE(tr.real_name, tr.username) AS reviewer_name
         FROM teacher_personal_class_team_business_plan_submissions s
         JOIN teacher_personal_class_teams t ON t.id = s.team_id
         JOIN teacher_personal_class_team_business_plan_versions v ON v.id = s.version_id
         LEFT JOIN teacher_personal_class_team_project_topics tp ON tp.team_id = s.team_id
         LEFT JOIN users tr ON tr.id = s.reviewed_by
         WHERE s.id = $1`,
        [submissionId]
      );
      if (!detail.length) return bad(req, res, 404, 40404, '提交记录不存在');
      const plan = await mapSubmissionRow(pool, String(classId), detail[0]);
      return ok(req, res, { plan });
    } catch (e) {
      logError(`POST teacher business-plan review traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

export default router;
