import { Router } from 'express';
import { getPool } from '../lib/db.js';
import { logError } from '../lib/logError.js';
import { requireAuth, requireTeacher } from '../middleware/auth.js';

const router = Router();

function ok(req, res, data, message = 'OK') {
  return res.json({ code: 0, message, data, traceId: req.traceId });
}

function bad(req, res, status, code, message) {
  return res.status(status).json({ code, message, data: null, traceId: req.traceId });
}

function teacherIdFromReq(req) {
  const raw = req.user?.sub;
  const id = raw != null ? Number(String(raw).trim()) : NaN;
  return Number.isFinite(id) && id > 0 ? id : null;
}

/**
 * 教师档案：院系与 admin 用户管理一致，users.department 存学院 colleges.id 的字符串。
 */
router.get('/teacher/me', requireAuth(), requireTeacher(), async (req, res) => {
  try {
    const tid = teacherIdFromReq(req);
    if (!tid) return bad(req, res, 400, 40001, '无效用户');

    const { rows } = await getPool().query(
      `SELECT u.id, u.username, u.real_name AS "realName", u.email, u.department,
              col.name AS "collegeName"
       FROM users u
       LEFT JOIN colleges col
         ON col.id = CASE
           WHEN trim(COALESCE(u.department, '')) ~ '^[0-9]+$'
           THEN trim(u.department)::bigint
           ELSE NULL
         END
       WHERE u.id = $1 AND u.role = 'teacher'`,
      [tid]
    );
    if (!rows.length) return bad(req, res, 404, 40401, '教师不存在');
    const r = rows[0];
    return ok(req, res, {
      id: String(r.id),
      username: r.username || '',
      realName: r.realName || '',
      email: r.email || '',
      departmentCollegeId: r.department != null ? String(r.department).trim() : '',
      collegeName: r.collegeName || '',
    });
  } catch (e) {
    logError(`GET /api/teacher/me traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.get('/teacher/personal-classes', requireAuth(), requireTeacher(), async (req, res) => {
  try {
    const tid = teacherIdFromReq(req);
    if (!tid) return bad(req, res, 400, 40001, '无效用户');

    const { rows } = await getPool().query(
      `SELECT t.id, t.name, t.academic_year AS "academicYear", t.semester,
              t.created_at AS "createdAt",
              (SELECT COUNT(*)::int FROM teacher_personal_class_students s
               WHERE s.teacher_personal_class_id = t.id) AS "studentCount"
       FROM teacher_personal_classes t
       WHERE t.teacher_id = $1
       ORDER BY t.id DESC
       LIMIT 500`,
      [tid]
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
      }))
    );
  } catch (e) {
    logError(`GET /api/teacher/personal-classes traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.post('/teacher/personal-classes', requireAuth(), requireTeacher(), async (req, res) => {
  try {
    const tid = teacherIdFromReq(req);
    if (!tid) return bad(req, res, 400, 40001, '无效用户');

    const name = String(req.body?.name || '').trim();
    const academicYear = String(req.body?.academicYear || '').trim() || null;
    const semester =
      req.body?.semester != null && String(req.body.semester).trim() !== '' ? String(req.body.semester).trim() : null;

    if (!name) return bad(req, res, 400, 40002, '班级名称不能为空');

    const { rows } = await getPool().query(
      `INSERT INTO teacher_personal_classes (teacher_id, name, academic_year, semester)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, academic_year AS "academicYear", semester, created_at AS "createdAt"`,
      [tid, name, academicYear, semester]
    );
    const r = rows[0];
    return ok(req, res, {
      id: String(r.id),
      name: r.name,
      academicYear: r.academicYear || '',
      semester: r.semester != null ? String(r.semester) : '',
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : '',
      studentCount: 0,
    });
  } catch (e) {
    logError(`POST /api/teacher/personal-classes traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

async function ownsPersonalClass(pool, teacherId, classId) {
  const { rows } = await pool.query(`SELECT 1 FROM teacher_personal_classes WHERE id = $1 AND teacher_id = $2`, [
    classId,
    teacherId,
  ]);
  return rows.length > 0;
}

/** 教务班级下拉（管理端 classes，按学院筛选） */
router.get('/teacher/catalog/admin-classes', requireAuth(), requireTeacher(), async (req, res) => {
  try {
    const collegeRaw = String(req.query.collegeId || '').trim();
    if (!/^\d+$/.test(collegeRaw)) return bad(req, res, 400, 40010, '请选择学院');
    const collegeId = Number(collegeRaw);

    const { rows } = await getPool().query(
      `SELECT c.id, c.name
       FROM classes c
       JOIN colleges co ON co.id = c.college_id AND co.status = 'active'
       WHERE c.college_id = $1
       ORDER BY c.id DESC
       LIMIT 400`,
      [collegeId]
    );
    return ok(
      req,
      res,
      rows.map((r) => ({
        id: String(r.id),
        name: r.name,
      }))
    );
  } catch (e) {
    logError(`GET /api/teacher/catalog/admin-classes traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

/**
 * 按学院 + 教务班级筛选学生池（不限制教师本人学院，可跨院拉学生）。
 */
router.get('/teacher/catalog/students-by-filter', requireAuth(), requireTeacher(), async (req, res) => {
  try {
    const collegeRaw = String(req.query.collegeId || '').trim();
    if (!/^\d+$/.test(collegeRaw)) return bad(req, res, 400, 40010, '请选择学院');
    const adminClassRaw = String(req.query.adminClassId || '').trim();
    let adminClassId = null;
    if (adminClassRaw && /^\d+$/.test(adminClassRaw)) adminClassId = Number(adminClassRaw);

    const params = [collegeRaw, adminClassId];

    const { rows } = await getPool().query(
      `SELECT u.id, u.real_name AS "name", u.email,
              COALESCE(u.student_no, '') AS "studentNo",
              col.name AS "collegeName",
              lac.name AS "adminClassName"
       FROM users u
       LEFT JOIN colleges col ON col.id = CASE
           WHEN trim(COALESCE(u.department, '')) ~ '^[0-9]+$'
           THEN trim(u.department)::bigint
           ELSE NULL
         END
       LEFT JOIN LATERAL (
         SELECT c.name
         FROM class_students cs
         JOIN classes c ON c.id = cs.class_id
         WHERE cs.student_id = u.id
         ORDER BY cs.joined_at DESC
         LIMIT 1
       ) lac ON TRUE
       WHERE u.role = 'student'
         AND u.status = 'active'
         AND trim(COALESCE(u.department, '')) = $1
         AND ($2::bigint IS NULL OR EXISTS (
           SELECT 1 FROM class_students cs2 WHERE cs2.student_id = u.id AND cs2.class_id = $2
         ))
       ORDER BY u.student_no ASC NULLS LAST, u.id ASC
       LIMIT 800`,
      params
    );
    return ok(
      req,
      res,
      rows.map((r) => ({
        id: String(r.id),
        name: r.name || r.email || '',
        email: r.email || '',
        studentNo: r.studentNo || '',
        collegeName: r.collegeName || '',
        adminClassName: r.adminClassName || '',
      }))
    );
  } catch (e) {
    logError(`GET /api/teacher/catalog/students-by-filter traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.get('/teacher/personal-classes/:id/students', requireAuth(), requireTeacher(), async (req, res) => {
  try {
    const tid = teacherIdFromReq(req);
    if (!tid) return bad(req, res, 400, 40001, '无效用户');

    const classId = Number(String(req.params.id || '').trim());
    if (!Number.isFinite(classId) || classId <= 0) return bad(req, res, 400, 40003, '无效的班级 ID');

    const pool = getPool();
    if (!(await ownsPersonalClass(pool, tid, classId))) {
      return bad(req, res, 404, 40402, '班级不存在或无权操作');
    }

    const { rows } = await pool.query(
      `SELECT u.id, u.real_name AS "name", u.email,
              COALESCE(u.student_no, '') AS "studentNo",
              col.name AS "collegeName"
       FROM teacher_personal_class_students tp
       JOIN users u ON u.id = tp.student_id
       LEFT JOIN colleges col ON col.id = CASE
           WHEN trim(COALESCE(u.department, '')) ~ '^[0-9]+$'
           THEN trim(u.department)::bigint
           ELSE NULL
         END
       WHERE tp.teacher_personal_class_id = $1
       ORDER BY u.student_no ASC NULLS LAST, u.id ASC`,
      [classId]
    );
    return ok(
      req,
      res,
      rows.map((r) => ({
        id: String(r.id),
        name: r.name || r.email || '',
        email: r.email || '',
        studentNo: r.studentNo || '',
        collegeName: r.collegeName || '',
      }))
    );
  } catch (e) {
    logError(`GET /api/teacher/personal-classes/:id/students traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.put('/teacher/personal-classes/:id/students', requireAuth(), requireTeacher(), async (req, res) => {
  try {
    const tid = teacherIdFromReq(req);
    if (!tid) return bad(req, res, 400, 40001, '无效用户');

    const classId = Number(String(req.params.id || '').trim());
    if (!Number.isFinite(classId) || classId <= 0) return bad(req, res, 400, 40003, '无效的班级 ID');

    const raw = req.body?.studentIds;
    if (!Array.isArray(raw)) return bad(req, res, 400, 40011, 'studentIds 须为数组');

    const idSet = new Set();
    for (const x of raw) {
      const s = String(x ?? '').trim();
      if (/^\d+$/.test(s)) idSet.add(s);
      if (idSet.size >= 500) break;
    }
    const idStrs = [...idSet];

    const pool = getPool();
    if (!(await ownsPersonalClass(pool, tid, classId))) {
      return bad(req, res, 404, 40402, '班级不存在或无权操作');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(`DELETE FROM teacher_personal_class_students WHERE teacher_personal_class_id = $1`, [
        classId,
      ]);

      if (idStrs.length > 0) {
        const nums = idStrs.map((x) => Number(x));
        const { rows: okRows } = await client.query(
          `SELECT id FROM users WHERE id = ANY($1::bigint[]) AND role = 'student' AND status = 'active'`,
          [nums]
        );
        const valid = okRows.map((r) => r.id);
        if (valid.length) {
          await client.query(
            `INSERT INTO teacher_personal_class_students (teacher_personal_class_id, student_id)
             SELECT $1, x FROM unnest($2::bigint[]) AS x`,
            [classId, valid]
          );
        }
      }

      await client.query('COMMIT');
      const {
        rows: [cnt],
      } = await pool.query(
        `SELECT COUNT(*)::int AS n FROM teacher_personal_class_students WHERE teacher_personal_class_id = $1`,
        [classId]
      );
      return ok(req, res, { studentCount: cnt?.n ?? 0 });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    logError(`PUT /api/teacher/personal-classes/:id/students traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.delete(
  '/teacher/personal-classes/:id/students/:studentId',
  requireAuth(),
  requireTeacher(),
  async (req, res) => {
    try {
      const tid = teacherIdFromReq(req);
      if (!tid) return bad(req, res, 400, 40001, '无效用户');

      const classId = Number(String(req.params.id || '').trim());
      const studentNum = Number(String(req.params.studentId || '').trim());
      if (!Number.isFinite(classId) || classId <= 0) return bad(req, res, 400, 40003, '无效的班级 ID');
      if (!Number.isFinite(studentNum) || studentNum <= 0) return bad(req, res, 400, 40012, '无效的学生 ID');

      const pool = getPool();
      const { rowCount } = await pool.query(
        `DELETE FROM teacher_personal_class_students tp
         USING teacher_personal_classes tpc
         WHERE tp.teacher_personal_class_id = tpc.id
           AND tp.teacher_personal_class_id = $1
           AND tp.student_id = $2
           AND tpc.teacher_id = $3`,
        [classId, studentNum, tid]
      );
      if (!rowCount) return bad(req, res, 404, 40403, '未找到该分组中的学生');

      const {
        rows: [cnt],
      } = await pool.query(
        `SELECT COUNT(*)::int AS n FROM teacher_personal_class_students WHERE teacher_personal_class_id = $1`,
        [classId]
      );
      return ok(req, res, { studentCount: cnt?.n ?? 0 });
    } catch (e) {
      logError(`DELETE /api/teacher/personal-classes/:id/students/:studentId traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.delete('/teacher/personal-classes/:id', requireAuth(), requireTeacher(), async (req, res) => {
  try {
    const tid = teacherIdFromReq(req);
    if (!tid) return bad(req, res, 400, 40001, '无效用户');

    const idRaw = req.params?.id;
    const classId = idRaw != null ? Number(String(idRaw).trim()) : NaN;
    if (!Number.isFinite(classId) || classId <= 0) return bad(req, res, 400, 40003, '无效的班级 ID');

    const pool = getPool();
    const { rows: own } = await pool.query(
      `SELECT id FROM teacher_personal_classes WHERE id = $1 AND teacher_id = $2`,
      [classId, tid]
    );
    if (!own.length) return bad(req, res, 404, 40402, '班级不存在或无权操作');

    const { rows: cnt } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM teacher_personal_class_students WHERE teacher_personal_class_id = $1`,
      [classId]
    );
    const n = cnt[0]?.n ?? 0;
    if (n > 0) {
      return bad(req, res, 400, 40004, '班级内仍有学生，请先移除学生后再删除');
    }

    await pool.query(`DELETE FROM teacher_personal_classes WHERE id = $1 AND teacher_id = $2`, [classId, tid]);
    return ok(req, res, { ok: true });
  } catch (e) {
    logError(`DELETE /api/teacher/personal-classes/:id traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

export default router;
