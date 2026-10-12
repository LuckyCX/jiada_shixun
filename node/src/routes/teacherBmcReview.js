import { Router } from 'express';
import { getPool } from '../lib/db.js';
import { logError } from '../lib/logError.js';
import { requireAuth, requireTeacher } from '../middleware/auth.js';
import { BMC_MODULE_KEYS } from '../lib/businessModelPrompts.js';

const router = Router();

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

async function ownsPersonalClass(pool, teacherId, classId) {
  const { rows } = await pool.query(
    `SELECT id, name FROM teacher_personal_classes WHERE id = $1 AND teacher_id = $2`,
    [classId, teacherId]
  );
  return rows[0] || null;
}

function coerceBmc(j) {
  const o = {};
  for (const k of BMC_MODULE_KEYS) o[k] = '';
  if (!j || typeof j !== 'object') return o;
  for (const k of BMC_MODULE_KEYS) o[k] = String(j[k] ?? '');
  return o;
}

/** 班级商业画布审核列表 */
router.get(
  '/teacher/personal-classes/:classId/bmc-reviews',
  requireAuth(),
  requireTeacher(),
  async (req, res) => {
    try {
      const teacherId = parseId(req.user?.sub);
      const classId = parseId(req.params.classId);
      if (!teacherId || !classId) return bad(req, res, 400, 40003, '参数无效');
      const pool = getPool();
      if (!(await ownsPersonalClass(pool, teacherId, classId))) {
        return bad(req, res, 403, 40301, '无权访问该班级');
      }
      const statusFilter = String(req.query.status || '').trim();
      const params = [classId];
      let statusSql = '';
      if (['pending', 'approved', 'rejected', 'draft'].includes(statusFilter)) {
        params.push(statusFilter);
        statusSql = ` AND COALESCE(w.bmc_review_status, 'draft') = $${params.length}`;
      } else {
        // 默认看已上传待审/已审
        statusSql = ` AND COALESCE(w.bmc_review_status, 'draft') IN ('pending','approved','rejected')`;
      }
      const { rows } = await pool.query(
        `SELECT t.id AS team_id, t.name AS team_name,
                w.bmc_canvas_json, w.bmc_canvas_saved_at, w.bmc_canvas_saved_by,
                w.bmc_review_status, w.bmc_review_comment, w.bmc_reviewed_at,
                COALESCE(su.real_name, su.username) AS submitter_name,
                COALESCE(ru.real_name, ru.username) AS reviewer_name
         FROM teacher_personal_class_teams t
         JOIN teacher_personal_class_team_business_model_workspace w ON w.team_id = t.id
         LEFT JOIN users su ON su.id = w.bmc_canvas_saved_by
         LEFT JOIN users ru ON ru.id = w.bmc_reviewed_by
         WHERE t.teacher_personal_class_id = $1
           AND w.bmc_canvas_saved_at IS NOT NULL
           ${statusSql}
         ORDER BY
           CASE COALESCE(w.bmc_review_status,'draft')
             WHEN 'pending' THEN 0 WHEN 'rejected' THEN 1 ELSE 2 END,
           w.bmc_canvas_saved_at DESC`,
        params
      );
      return ok(req, res, {
        items: rows.map((r) => ({
          teamId: String(r.team_id),
          teamName: String(r.team_name || ''),
          bmc: coerceBmc(r.bmc_canvas_json),
          savedAt: r.bmc_canvas_saved_at ? new Date(r.bmc_canvas_saved_at).toISOString() : '',
          submitterName: String(r.submitter_name || '').trim() || '同学',
          status: String(r.bmc_review_status || 'draft'),
          reviewComment: String(r.bmc_review_comment || ''),
          reviewedAt: r.bmc_reviewed_at ? new Date(r.bmc_reviewed_at).toISOString() : '',
          reviewerName: String(r.reviewer_name || '').trim(),
        })),
      });
    } catch (e) {
      logError(`GET teacher bmc-reviews traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

/** 通过 / 驳回 */
router.post(
  '/teacher/personal-classes/:classId/bmc-reviews/:teamId/review',
  requireAuth(),
  requireTeacher(),
  async (req, res) => {
    try {
      const teacherId = parseId(req.user?.sub);
      const classId = parseId(req.params.classId);
      const teamId = parseId(req.params.teamId);
      if (!teacherId || !classId || !teamId) return bad(req, res, 400, 40003, '参数无效');
      const decision = String(req.body?.decision || '').trim();
      const comment = String(req.body?.comment || '').trim();
      if (!['approve', 'reject'].includes(decision)) {
        return bad(req, res, 400, 40004, '请选择通过或驳回');
      }
      if (decision === 'reject' && !comment) {
        return bad(req, res, 400, 40004, '驳回请填写评语');
      }
      const pool = getPool();
      if (!(await ownsPersonalClass(pool, teacherId, classId))) {
        return bad(req, res, 403, 40301, '无权访问该班级');
      }
      const { rows: teamRows } = await pool.query(
        `SELECT id FROM teacher_personal_class_teams
         WHERE id = $1 AND teacher_personal_class_id = $2`,
        [teamId, classId]
      );
      if (!teamRows.length) return bad(req, res, 404, 40401, '团队不存在');

      const status = decision === 'approve' ? 'approved' : 'rejected';
      await pool.query(
        `UPDATE teacher_personal_class_team_business_model_workspace
         SET bmc_review_status = $2,
             bmc_review_comment = $3,
             bmc_reviewed_at = now(),
             bmc_reviewed_by = $4,
             updated_at = now()
         WHERE team_id = $1`,
        [teamId, status, comment, teacherId]
      );

      if (decision === 'approve') {
        try {
          const { scheduleScoreTeamStage } = await import('../lib/teamCockpitScoring.js');
          scheduleScoreTeamStage(classId, teamId, 'business');
        } catch (hookErr) {
          logError('bmc review cockpit hook', hookErr);
        }
      }

      return ok(req, res, { teamId: String(teamId), status, reviewComment: comment });
    } catch (e) {
      logError(`POST teacher bmc-review traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

export default router;
