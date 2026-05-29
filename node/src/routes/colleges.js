import { randomBytes } from 'crypto';
import { Router } from 'express';
import { getPool } from '../lib/db.js';
import { logError } from '../lib/logError.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { insertAdminOperationLog } from '../lib/adminOperationLog.js';

const router = Router();

function ok(req, res, data, message = 'OK') {
  return res.json({ code: 0, message, data, traceId: req.traceId });
}

function bad(req, res, status, code, message) {
  return res.status(status).json({ code, message, data: null, traceId: req.traceId });
}

/** 班级 status 列：兼容旧值 active 与字典键 0/1/2 */
function classStatusToUi(db) {
  const s = String(db || '').trim();
  if (s === '0' || s === '1' || s === '2') return s;
  if (s === 'active') return '1';
  if (s === 'ended' || s === 'inactive') return '2';
  return '1';
}

function uiStatusToDb(ui) {
  const s = String(ui || '').trim();
  if (s === '0' || s === '1' || s === '2') return s;
  if (s === 'active' || s === 'ended') return s;
  return '1';
}

/** 未传 code 时生成唯一班级编码（≤64，与 DB 约束一致） */
async function allocateUniqueClassCode(pool, collegeId) {
  for (let attempt = 0; attempt < 24; attempt++) {
    const raw = `C${collegeId}_${Date.now().toString(36)}_${randomBytes(5).toString('hex')}_${attempt}`;
    const code = raw.slice(0, 64);
    const { rows } = await pool.query('SELECT 1 FROM classes WHERE code = $1', [code]);
    if (!rows.length) return code;
  }
  throw new Error('无法生成唯一班级编码');
}

/** 公开：学院下拉 */
router.get('/public/colleges', async (req, res) => {
  try {
    const { rows } = await getPool().query(
      `SELECT id, name FROM colleges WHERE status = 'active' ORDER BY id ASC`
    );
    return ok(
      req,
      res,
      rows.map((r) => ({ id: String(r.id), name: r.name }))
    );
  } catch (e) {
    logError(`GET /api/public/colleges traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.get('/admin/colleges', requireAuth(), requireAdmin(), async (req, res) => {
  try {
    const { rows } = await getPool().query(
      `SELECT c.id, c.name, c.status, c.created_at AS "createdAt", c.updated_at AS "updatedAt",
              COUNT(cl.id)::int AS "classCount"
       FROM colleges c
       LEFT JOIN classes cl ON cl.college_id = c.id
       GROUP BY c.id
       ORDER BY c.id ASC`
    );
    return ok(
      req,
      res,
      rows.map((r) => ({
        id: String(r.id),
        name: r.name,
        status: r.status,
        classCount: r.classCount,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }))
    );
  } catch (e) {
    logError(`GET /api/admin/colleges traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.post('/admin/colleges', requireAuth(), requireAdmin(), async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return bad(req, res, 400, 40001, '学院名称不能为空');
    const { rows } = await getPool().query(
      `INSERT INTO colleges (name, status) VALUES ($1, 'active')
       RETURNING id, name, status, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [name]
    );
    const r = rows[0];
    await insertAdminOperationLog({
      operatorId: req.user?.sub,
      module: 'admin_college',
      action: 'create_college',
      targetType: 'college',
      targetId: r?.id,
      detailText: `创建学院：${r?.name || name}`,
    });
    return ok(req, res, { ...r, id: String(r.id), classCount: 0 }, '已创建');
  } catch (e) {
    if (e.code === '23505') return bad(req, res, 409, 40901, '学院名称已存在');
    logError(`POST /api/admin/colleges traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.patch('/admin/colleges/:id', requireAuth(), requireAdmin(), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return bad(req, res, 400, 40001, '无效学院 id');
    const name = req.body?.name !== undefined ? String(req.body.name || '').trim() : null;
    const status = req.body?.status !== undefined ? String(req.body.status || '').trim() : null;
    const sets = [];
    const params = [];
    let i = 1;
    if (name !== null) {
      if (!name) return bad(req, res, 400, 40002, '学院名称不能为空');
      sets.push(`name = $${i++}`);
      params.push(name);
    }
    if (status !== null) {
      if (!['active', 'inactive'].includes(status)) return bad(req, res, 400, 40003, '状态须为 active 或 inactive');
      sets.push(`status = $${i++}`);
      params.push(status);
    }
    if (!sets.length) return bad(req, res, 400, 40004, '无更新字段');
    params.push(id);
    const { rows } = await getPool().query(
      `UPDATE colleges SET ${sets.join(', ')} WHERE id = $${i}
       RETURNING id, name, status, created_at AS "createdAt", updated_at AS "updatedAt"`,
      params
    );
    if (!rows.length) return bad(req, res, 404, 40401, '学院不存在');
    const r = rows[0];
    const { rows: cc } = await getPool().query(`SELECT COUNT(*)::int AS c FROM classes WHERE college_id = $1`, [id]);
    await insertAdminOperationLog({
      operatorId: req.user?.sub,
      module: 'admin_college',
      action: 'update_college',
      targetType: 'college',
      targetId: id,
      detailText: `更新学院：${r?.name || ''}`.trim() || `更新学院：ID ${id}`,
    });
    return ok(req, res, { ...r, id: String(r.id), classCount: cc[0]?.c ?? 0 });
  } catch (e) {
    if (e.code === '23505') return bad(req, res, 409, 40901, '学院名称已存在');
    logError(`PATCH /api/admin/colleges/:id traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.delete('/admin/colleges/:id', requireAuth(), requireAdmin(), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return bad(req, res, 400, 40001, '无效学院 id');
    const { rows: cr } = await getPool().query(`SELECT COUNT(*)::int AS c FROM classes WHERE college_id = $1`, [id]);
    if ((cr[0]?.c ?? 0) > 0) {
      return bad(req, res, 400, 40002, '该院系下仍有班级，无法删除');
    }
    const { rowCount } = await getPool().query(`DELETE FROM colleges WHERE id = $1`, [id]);
    if (!rowCount) return bad(req, res, 404, 40401, '学院不存在');
    await insertAdminOperationLog({
      operatorId: req.user?.sub,
      module: 'admin_college',
      action: 'delete_college',
      targetType: 'college',
      targetId: id,
      detailText: `删除学院：ID ${id}`,
    });
    return ok(req, res, { ok: true });
  } catch (e) {
    logError(`DELETE /api/admin/colleges/:id traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.get('/admin/classes', requireAuth(), requireAdmin(), async (req, res) => {
  try {
    const collegeIdRaw = req.query.collegeId;
    const collegeId =
      collegeIdRaw != null && String(collegeIdRaw).trim() !== ''
        ? Number(String(collegeIdRaw).trim())
        : null;
    const params = [];
    let where = '1=1';
    if (collegeId != null && Number.isFinite(collegeId) && collegeId > 0) {
      where = 'c.college_id = $1';
      params.push(collegeId);
    }
    const { rows } = await getPool().query(
      `SELECT c.id, c.name, c.code, c.college_id, c.academic_year AS "academicYear", c.semester,
              c.department, c.status, c.created_at AS "createdAt", c.teacher_id,
              u.real_name AS "teacherName", u.email AS "teacherEmail",
              (SELECT COUNT(*)::int FROM class_students cs WHERE cs.class_id = c.id) AS "studentCount"
       FROM classes c
       LEFT JOIN users u ON u.id = c.teacher_id
       WHERE ${where}
       ORDER BY c.id DESC
       LIMIT 500`,
      params
    );
    return ok(
      req,
      res,
      rows.map((r) => ({
        id: String(r.id),
        name: r.name,
        code: r.code,
        collegeId: r.college_id != null ? String(r.college_id) : '',
        academicYear: r.academicYear || '',
        semester: r.semester != null ? String(r.semester) : '',
        department: r.department != null ? String(r.department) : '',
        status: classStatusToUi(r.status),
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : '',
        teacherId: r.teacher_id != null ? String(r.teacher_id) : '',
        teacherName: r.teacherName || '',
        teacherEmail: r.teacherEmail || '',
        studentCount: r.studentCount ?? 0,
      }))
    );
  } catch (e) {
    logError(`GET /api/admin/classes traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.post('/admin/classes', requireAuth(), requireAdmin(), async (req, res) => {
  try {
    const collegeId = Number(req.body?.collegeId);
    const name = String(req.body?.name || '').trim();
    let code = String(req.body?.code || '').trim();
    const academicYear = String(req.body?.academicYear || '').trim() || null;
    const semester = req.body?.semester != null && String(req.body.semester).trim() !== '' ? String(req.body.semester).trim() : null;
    const teacherIdRaw = req.body?.teacherId;
    const teacherId =
      teacherIdRaw != null && String(teacherIdRaw).trim() !== '' ? Number(String(teacherIdRaw).trim()) : null;
    const statusUi = uiStatusToDb(req.body?.status);

    if (!Number.isFinite(collegeId) || collegeId <= 0) return bad(req, res, 400, 40001, '请选择学院');
    if (!name) return bad(req, res, 400, 40002, '班级名称不能为空');
    if (!code) {
      try {
        code = await allocateUniqueClassCode(getPool(), collegeId);
      } catch (e) {
        return bad(req, res, 500, 50001, e.message || '生成班级编码失败');
      }
    }

    const { rows: col } = await getPool().query(`SELECT id FROM colleges WHERE id = $1 AND status = 'active'`, [collegeId]);
    if (!col.length) return bad(req, res, 400, 40004, '学院不存在或已停用');

    if (teacherId != null && Number.isFinite(teacherId) && teacherId > 0) {
      const { rows: tr } = await getPool().query(`SELECT id, role FROM users WHERE id = $1`, [teacherId]);
      if (!tr.length) return bad(req, res, 400, 40005, '教师不存在');
      if (tr[0].role !== 'teacher') return bad(req, res, 400, 40006, '指派用户须为教师角色');
    }

    const deptStr = String(collegeId);
    const { rows } = await getPool().query(
      `INSERT INTO classes (name, code, academic_year, semester, department, college_id, teacher_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, name, code, college_id, academic_year AS "academicYear", semester, department, status, created_at AS "createdAt", teacher_id`,
      [name, code, academicYear, semester, deptStr, collegeId, teacherId && teacherId > 0 ? teacherId : null, statusUi]
    );
    const r = rows[0];
    let teacherName = '';
    let teacherEmail = '';
    if (r.teacher_id) {
      const { rows: ur } = await getPool().query(`SELECT real_name, email FROM users WHERE id = $1`, [r.teacher_id]);
      if (ur.length) {
        teacherName = ur[0].real_name || '';
        teacherEmail = ur[0].email || '';
      }
    }
    const out = {
      id: String(r.id),
      name: r.name,
      code: r.code,
      collegeId: String(r.college_id),
      academicYear: r.academicYear || '',
      semester: r.semester != null ? String(r.semester) : '',
      department: r.department || '',
      status: classStatusToUi(r.status),
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : '',
      teacherId: r.teacher_id != null ? String(r.teacher_id) : '',
      teacherName,
      teacherEmail,
      studentCount: 0,
    };
    await insertAdminOperationLog({
      operatorId: req.user?.sub,
      module: 'admin_class',
      action: 'create_class',
      targetType: 'class',
      targetId: r?.id,
      detailText: `创建班级：${out.name}${out.teacherName ? `（指派教师：${out.teacherName}）` : ''}`,
      detailJson: { classId: String(out.id), collegeId: out.collegeId },
    });
    return ok(req, res, out);
  } catch (e) {
    if (e.code === '23505') return bad(req, res, 409, 40901, '班级编码已存在');
    logError(`POST /api/admin/classes traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.patch('/admin/classes/:id', requireAuth(), requireAdmin(), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return bad(req, res, 400, 40001, '无效班级 id');

    const { rows: cur } = await getPool().query(`SELECT id FROM classes WHERE id = $1`, [id]);
    if (!cur.length) return bad(req, res, 404, 40401, '班级不存在');

    const name = req.body?.name !== undefined ? String(req.body.name || '').trim() : null;
    const code = req.body?.code !== undefined ? String(req.body.code || '').trim() : null;
    const academicYear = req.body?.academicYear !== undefined ? String(req.body.academicYear || '').trim() || null : undefined;
    const semester =
      req.body?.semester !== undefined
        ? req.body.semester != null && String(req.body.semester).trim() !== ''
          ? String(req.body.semester).trim()
          : null
        : undefined;
    const collegeIdRaw = req.body?.collegeId;
    const collegeId =
      collegeIdRaw !== undefined
        ? Number(String(collegeIdRaw || '').trim()) || null
        : undefined;
    const teacherIdRaw = req.body?.teacherId;
    const teacherId =
      teacherIdRaw !== undefined
        ? teacherIdRaw != null && String(teacherIdRaw).trim() !== ''
          ? Number(String(teacherIdRaw).trim())
          : null
        : undefined;
    const statusRaw = req.body?.status;
    const statusDb = statusRaw !== undefined ? uiStatusToDb(statusRaw) : undefined;

    const sets = [];
    const params = [];
    let pi = 1;

    if (name !== null) {
      if (!name) return bad(req, res, 400, 40002, '班级名称不能为空');
      sets.push(`name = $${pi++}`);
      params.push(name);
    }
    if (code !== null) {
      if (!code) return bad(req, res, 400, 40003, '班级编码不能为空');
      sets.push(`code = $${pi++}`);
      params.push(code);
    }
    if (academicYear !== undefined) {
      sets.push(`academic_year = $${pi++}`);
      params.push(academicYear);
    }
    if (semester !== undefined) {
      sets.push(`semester = $${pi++}`);
      params.push(semester);
    }
    if (collegeId !== undefined) {
      if (!collegeId || !Number.isFinite(collegeId)) return bad(req, res, 400, 40004, '请选择学院');
      const { rows: col } = await getPool().query(`SELECT id FROM colleges WHERE id = $1 AND status = 'active'`, [collegeId]);
      if (!col.length) return bad(req, res, 400, 40005, '学院不存在或已停用');
      sets.push(`college_id = $${pi++}`);
      params.push(collegeId);
      sets.push(`department = $${pi++}`);
      params.push(String(collegeId));
    }
    if (teacherId !== undefined) {
      if (teacherId != null && Number.isFinite(teacherId) && teacherId > 0) {
        const { rows: tr } = await getPool().query(`SELECT role FROM users WHERE id = $1`, [teacherId]);
        if (!tr.length) return bad(req, res, 400, 40006, '教师不存在');
        if (tr[0].role !== 'teacher') return bad(req, res, 400, 40007, '指派用户须为教师角色');
      }
      sets.push(`teacher_id = $${pi++}`);
      params.push(teacherId && teacherId > 0 ? teacherId : null);
    }
    if (statusDb !== undefined) {
      sets.push(`status = $${pi++}`);
      params.push(statusDb);
    }

    if (sets.length) {
      params.push(id);
      await getPool().query(`UPDATE classes SET ${sets.join(', ')} WHERE id = $${pi}`, params);
    }

    const { rows } = await getPool().query(
      `SELECT c.id, c.name, c.code, c.college_id, c.academic_year AS "academicYear", c.semester,
              c.department, c.status, c.created_at AS "createdAt", c.teacher_id,
              u.real_name AS "teacherName", u.email AS "teacherEmail",
              (SELECT COUNT(*)::int FROM class_students cs WHERE cs.class_id = c.id) AS "studentCount"
       FROM classes c
       LEFT JOIN users u ON u.id = c.teacher_id
       WHERE c.id = $1`,
      [id]
    );
    const r = rows[0];
    const out = {
      id: String(r.id),
      name: r.name,
      code: r.code,
      collegeId: r.college_id != null ? String(r.college_id) : '',
      academicYear: r.academicYear || '',
      semester: r.semester != null ? String(r.semester) : '',
      department: r.department != null ? String(r.department) : '',
      status: classStatusToUi(r.status),
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : '',
      teacherId: r.teacher_id != null ? String(r.teacher_id) : '',
      teacherName: r.teacherName || '',
      teacherEmail: r.teacherEmail || '',
      studentCount: r.studentCount ?? 0,
    };
    if (sets.length) {
      await insertAdminOperationLog({
        operatorId: req.user?.sub,
        module: 'admin_class',
        action: 'update_class',
        targetType: 'class',
        targetId: id,
        detailText: `更新班级：${out.name}`,
        detailJson: { classId: String(out.id), collegeId: out.collegeId },
      });
    }
    return ok(req, res, out);
  } catch (e) {
    if (e.code === '23505') return bad(req, res, 409, 40901, '班级编码已存在');
    logError(`PATCH /api/admin/classes/:id traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.delete('/admin/classes/:id', requireAuth(), requireAdmin(), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return bad(req, res, 400, 40001, '无效班级 id');
    const { rowCount } = await getPool().query(`DELETE FROM classes WHERE id = $1`, [id]);
    if (!rowCount) return bad(req, res, 404, 40401, '班级不存在');
    await insertAdminOperationLog({
      operatorId: req.user?.sub,
      module: 'admin_class',
      action: 'delete_class',
      targetType: 'class',
      targetId: id,
      detailText: `删除班级：ID ${id}`,
    });
    return ok(req, res, { ok: true });
  } catch (e) {
    logError(`DELETE /api/admin/classes/:id traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

export default router;
