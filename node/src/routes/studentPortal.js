import { Router } from 'express';
import { getPool } from '../lib/db.js';
import { logError } from '../lib/logError.js';
import { requireAuth, requireStudent } from '../middleware/auth.js';

const router = Router();

function ok(req, res, data, message = 'OK') {
  return res.json({ code: 0, message, data, traceId: req.traceId });
}

function bad(req, res, status, code, message) {
  return res.status(status).json({ code, message, data: null, traceId: req.traceId });
}

function studentIdFromReq(req) {
  const raw = req.user?.sub;
  const id = raw != null ? Number(String(raw).trim()) : NaN;
  return Number.isFinite(id) && id > 0 ? id : null;
}

/** 学生档案：侧栏展示姓名/学号（JWT 里 username 常为数字登录名，不等同于展示名） */
router.get('/student/me', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const sid = studentIdFromReq(req);
    if (!sid) return bad(req, res, 400, 40001, '无效用户');

    const { rows } = await getPool().query(
      `SELECT u.id, u.username, u.real_name AS "realName", u.student_no AS "studentNo", u.email
       FROM users u
       WHERE u.id = $1 AND u.role = 'student'`,
      [sid]
    );
    if (!rows.length) return bad(req, res, 404, 40401, '学生不存在');
    const r = rows[0];
    return ok(req, res, {
      id: String(r.id),
      username: r.username || '',
      realName: r.realName || '',
      studentNo: r.studentNo != null ? String(r.studentNo).trim() : '',
      email: r.email || '',
    });
  } catch (e) {
    logError(`GET /api/student/me traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

/** 学生已加入的教师个性化班级（用于登录后是否允许进入实训） */
router.get('/student/personal-class-enrollments', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const sid = studentIdFromReq(req);
    if (!sid) return bad(req, res, 400, 40001, '无效用户');

    const { rows } = await getPool().query(
      `SELECT tpc.id AS "classId", tpc.name AS "className",
              tpc.academic_year AS "academicYear", tpc.semester,
              tpc.teacher_id AS "teacherId",
              u.real_name AS "teacherName",
              tp.joined_at AS "joinedAt"
       FROM teacher_personal_class_students tp
       INNER JOIN teacher_personal_classes tpc ON tpc.id = tp.teacher_personal_class_id
       INNER JOIN users u ON u.id = tpc.teacher_id
       WHERE tp.student_id = $1
       ORDER BY tp.joined_at DESC
       LIMIT 200`,
      [sid]
    );

    return ok(
      req,
      res,
      rows.map((r) => ({
        classId: String(r.classId),
        className: r.className,
        academicYear: r.academicYear || '',
        semester: r.semester != null ? String(r.semester) : '',
        teacherId: String(r.teacherId),
        teacherName: r.teacherName || '',
        joinedAt: r.joinedAt ? new Date(r.joinedAt).toISOString() : '',
      }))
    );
  } catch (e) {
    logError(`GET /api/student/personal-class-enrollments traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

export default router;
