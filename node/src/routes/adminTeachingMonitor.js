/**
 * 管理端 / 子管理员：全校教学下钻（教师 → 班级 → 组队 → 可再进监控详情）
 */
import { Router } from 'express';
import { getPool } from '../lib/db.js';
import { logError } from '../lib/logError.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

function ok(req, res, data, message = 'OK') {
  return res.json({ code: 0, message, data, traceId: req.traceId });
}

function bad(req, res, status, code, message) {
  return res.status(status).json({ code, message, data: null, traceId: req.traceId });
}

router.get('/admin/teaching/teachers', requireAuth(), requireAdmin(), async (req, res) => {
  try {
    const { rows } = await getPool().query(
      `SELECT u.id, u.username, u.real_name AS "realName", u.employee_no AS "employeeNo",
              u.phone, u.department, u.last_login_at AS "lastLoginAt",
              (SELECT COUNT(*)::int FROM teacher_personal_classes c
               WHERE c.teacher_id = u.id AND COALESCE(c.purpose, 'normal') <> 'prep') AS "classCount"
       FROM users u
       WHERE u.role = 'teacher' AND u.status = 'active'
       ORDER BY u.real_name NULLS LAST, u.id ASC
       LIMIT 2000`
    );
    return ok(
      req,
      res,
      rows.map((r) => ({
        id: String(r.id),
        username: r.username,
        realName: r.realName || '',
        employeeNo: r.employeeNo || '',
        phone: r.phone || '',
        department: r.department || '',
        lastLoginAt: r.lastLoginAt ? new Date(r.lastLoginAt).toISOString() : '',
        classCount: r.classCount ?? 0,
      }))
    );
  } catch (e) {
    logError(`GET /api/admin/teaching/teachers traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.get('/admin/teaching/teachers/:teacherId/classes', requireAuth(), requireAdmin(), async (req, res) => {
  try {
    const teacherId = Number(req.params.teacherId);
    if (!Number.isFinite(teacherId) || teacherId <= 0) return bad(req, res, 400, 40001, '无效教师');
    const { rows } = await getPool().query(
      `SELECT c.id, c.name, c.academic_year AS "academicYear", c.semester,
              c.created_at AS "createdAt",
              (SELECT COUNT(*)::int FROM teacher_personal_class_students s
               WHERE s.teacher_personal_class_id = c.id) AS "studentCount",
              (SELECT COUNT(*)::int FROM teacher_personal_class_teams t
               WHERE t.teacher_personal_class_id = c.id
                 AND t.grouping_status = 'confirmed') AS "teamCount"
       FROM teacher_personal_classes c
       WHERE c.teacher_id = $1 AND COALESCE(c.purpose, 'normal') <> 'prep'
       ORDER BY c.created_at DESC, c.id DESC
       LIMIT 500`,
      [teacherId]
    );
    return ok(
      req,
      res,
      rows.map((r) => ({
        id: String(r.id),
        name: r.name,
        academicYear: r.academicYear || '',
        semester: r.semester != null ? String(r.semester) : '',
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : '',
        studentCount: r.studentCount ?? 0,
        teamCount: r.teamCount ?? 0,
      }))
    );
  } catch (e) {
    logError(`GET /api/admin/teaching/teachers/:id/classes traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.get('/admin/teaching/classes/:classId/teams', requireAuth(), requireAdmin(), async (req, res) => {
  try {
    const classId = Number(req.params.classId);
    if (!Number.isFinite(classId) || classId <= 0) return bad(req, res, 400, 40001, '无效班级');
    const { rows } = await getPool().query(
      `SELECT t.id, t.name, t.grouping_status AS "groupingStatus",
              COALESCE(t.is_solo, false) AS "isSolo",
              t.leader_student_id AS "leaderStudentId",
              (SELECT COUNT(*)::int FROM teacher_personal_class_team_members m WHERE m.team_id = t.id) AS "memberCount",
              (SELECT string_agg(COALESCE(u.real_name, u.username), '、' ORDER BY m.id)
               FROM teacher_personal_class_team_members m
               JOIN users u ON u.id = m.student_id
               WHERE m.team_id = t.id) AS "memberNames"
       FROM teacher_personal_class_teams t
       WHERE t.teacher_personal_class_id = $1
       ORDER BY COALESCE(t.is_solo, false) ASC, t.sort_order ASC, t.id ASC
       LIMIT 500`,
      [classId]
    );
    return ok(
      req,
      res,
      rows.map((r) => ({
        id: String(r.id),
        name: r.name,
        groupingStatus: r.groupingStatus,
        isSolo: Boolean(r.isSolo),
        leaderStudentId: r.leaderStudentId != null ? String(r.leaderStudentId) : '',
        memberCount: r.memberCount ?? 0,
        memberNames: r.memberNames || '',
      }))
    );
  } catch (e) {
    logError(`GET /api/admin/teaching/classes/:id/teams traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

export default router;
