import { Router } from 'express';
import bcrypt from 'bcryptjs';
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

function fmtLoginAt(d) {
  if (!d) return '-';
  try {
    const x = new Date(d);
    if (Number.isNaN(x.getTime())) return '-';
    return x.toISOString().replace('T', ' ').slice(0, 19);
  } catch {
    return '-';
  }
}

function mapUserRow(r) {
  return {
    id: String(r.id),
    username: r.username,
    name: r.real_name || r.username,
    avatarUrl: r.avatar_url || '',
    email: r.email || '',
    studentId: r.student_no || undefined,
    employeeId: r.employee_no || undefined,
    department: r.department || '',
    collegeName: r.college_name || '',
    majorId: r.major_id != null ? String(r.major_id) : '',
    majorName: r.major_name || '',
    role: r.role,
    status: r.status,
    lastLogin: fmtLoginAt(r.last_login_at),
    classId: r.class_id != null ? String(r.class_id) : undefined,
    className: r.class_name || undefined,
    createdAt: r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : '',
  };
}

/** 列表 + 全局统计 */
router.get('/admin/users', requireAuth(), requireAdmin(), async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const q = String(req.query.q || '').trim();
    const role = String(req.query.role || '').trim();
    const status = String(req.query.status || '').trim();

    const where = ['1=1'];
    const params = [];
    let i = 1;
    if (q) {
      where.push(
        `(u.real_name ILIKE $${i} OR u.username ILIKE $${i} OR COALESCE(u.email,'') ILIKE $${i} OR COALESCE(u.student_no,'') ILIKE $${i} OR COALESCE(u.employee_no,'') ILIKE $${i})`
      );
      params.push(`%${q}%`);
      i++;
    }
    if (role && ['student', 'teacher', 'admin'].includes(role)) {
      where.push(`u.role = $${i}`);
      params.push(role);
      i++;
    } else {
      // 默认不列出管理员；仅当 role=admin 时查看管理员账号
      where.push(`u.role <> 'admin'`);
    }
    if (status && ['active', 'inactive'].includes(status)) {
      where.push(`u.status = $${i}`);
      params.push(status);
      i++;
    }
    const classIdQ = String(req.query.classId || '').trim();
    if (classIdQ) {
      const cid = Number(classIdQ);
      if (Number.isFinite(cid) && cid > 0) {
        where.push(
          `EXISTS (SELECT 1 FROM class_students cs WHERE cs.student_id = u.id AND cs.class_id = $${i})`
        );
        params.push(cid);
        i++;
      }
    }
    /** 教师/学生「学院」与 colleges.id 对齐，存于 users.department */
    const collegeIdQ = String(req.query.collegeId || '').trim();
    if (collegeIdQ && /^\d+$/.test(collegeIdQ)) {
      where.push(`TRIM(COALESCE(u.department, '')) = $${i}`);
      params.push(collegeIdQ);
      i++;
    }
    const majorIdQ = String(req.query.majorId || '').trim();
    if (majorIdQ && /^\d+$/.test(majorIdQ)) {
      where.push(`u.major_id = $${i}`);
      params.push(Number(majorIdQ));
      i++;
    }
    const whereSql = where.join(' AND ');

    const { rows: statRows } = await getPool().query(
      `SELECT
         COUNT(*) FILTER (WHERE role <> 'admin')::int AS "totalUsers",
         COUNT(*) FILTER (WHERE role = 'teacher')::int AS teachers,
         COUNT(*) FILTER (WHERE role = 'student')::int AS students,
         COUNT(*) FILTER (WHERE status = 'active' AND role <> 'admin')::int AS "activeUsers"
       FROM users`
    );
    const stats = statRows[0] || { totalUsers: 0, teachers: 0, students: 0, activeUsers: 0 };

    const countParams = [...params];
    const { rows: cnt } = await getPool().query(
      `SELECT COUNT(*)::int AS c FROM users u WHERE ${whereSql}`,
      countParams
    );
    const total = cnt[0]?.c ?? 0;

    const limit = pageSize;
    const offset = (page - 1) * pageSize;
    const listParams = [...params, limit, offset];
    const { rows } = await getPool().query(
      `SELECT u.id, u.username, u.real_name, u.email, u.role, u.status, u.student_no, u.employee_no, u.department,
              COALESCE(u.avatar_url, '') AS avatar_url,
              u.major_id, u.last_login_at, u.created_at,
              COALESCE(col_u.name, col_cls.name) AS college_name,
              COALESCE(mj.name, mj_cls.name) AS major_name,
              cls.class_id, cls.class_name
       FROM users u
       LEFT JOIN colleges col_u ON (
         (trim(COALESCE(u.department, '')) ~ '^[0-9]+$' AND col_u.id = trim(u.department)::bigint)
         OR (
           trim(COALESCE(u.department, '')) <> ''
           AND trim(COALESCE(u.department, '')) !~ '^[0-9]+$'
           AND col_u.name = trim(u.department)
         )
       )
       LEFT JOIN majors mj ON mj.id = u.major_id
       LEFT JOIN LATERAL (
         SELECT c.id AS class_id, c.name AS class_name, c.college_id, c.major_id
         FROM class_students cs
         JOIN classes c ON c.id = cs.class_id
         WHERE cs.student_id = u.id
         ORDER BY cs.joined_at DESC
         LIMIT 1
       ) cls ON (true)
       LEFT JOIN colleges col_cls ON col_cls.id = cls.college_id
       LEFT JOIN majors mj_cls ON mj_cls.id = cls.major_id
       WHERE ${whereSql}
       ORDER BY u.id DESC
       LIMIT $${i} OFFSET $${i + 1}`,
      listParams
    );

    return ok(req, res, {
      list: rows.map(mapUserRow),
      total,
      page,
      pageSize,
      stats,
    });
  } catch (e) {
    logError(`GET /api/admin/users traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.post('/admin/users', requireAuth(), requireAdmin(), async (req, res) => {
  try {
    const { name, role, idNumber, email, department, majorId, password } = req.body || {};
    const rn = String(name || '').trim();
    const id = String(idNumber || '').trim();
    const dept = String(department || '').trim();
    const majorIdNum =
      majorId != null && String(majorId).trim() !== '' ? Number(String(majorId).trim()) : null;
    const em = email != null && String(email).trim() !== '' ? String(email).trim() : null;
    const pwd = String(password || '');

    if (!rn) return bad(req, res, 400, 40001, '请输入姓名');
    if (!['student', 'teacher'].includes(role)) return bad(req, res, 400, 40002, '角色仅支持学生或教师');
    if (!id) return bad(req, res, 400, 40003, '请输入学号或工号');
    if (!dept) return bad(req, res, 400, 40004, '请选择学院');
    const collegeIdNum = Number(dept);
    if (!Number.isFinite(collegeIdNum) || collegeIdNum <= 0) {
      return bad(req, res, 400, 40004, '学院须为有效学院 ID');
    }
    const { rows: co } = await getPool().query(
      `SELECT id FROM colleges WHERE id = $1 AND status = 'active'`,
      [collegeIdNum]
    );
    if (!co.length) return bad(req, res, 400, 40007, '学院不存在或已停用');
    let majorIdDb = null;
    if (role === 'student' || role === 'teacher') {
      if (!majorIdNum || !Number.isFinite(majorIdNum) || majorIdNum <= 0) {
        return bad(req, res, 400, 40009, '请选择专业');
      }
      const { rows: mj } = await getPool().query(
        `SELECT id, college_id FROM majors WHERE id = $1 AND status = 'active'`,
        [majorIdNum]
      );
      if (!mj.length) return bad(req, res, 400, 40010, '专业不存在或已停用');
      if (Number(mj[0].college_id) !== collegeIdNum) {
        return bad(req, res, 400, 40011, '专业须属于所选学院');
      }
      majorIdDb = majorIdNum;
    }
    if (!pwd) return bad(req, res, 400, 40005, '缺少初始密码');
    if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      return bad(req, res, 400, 40006, '邮箱格式错误');
    }

    const { rows: dup } = await getPool().query(`SELECT id FROM users WHERE username = $1`, [id]);
    if (dup.length) return bad(req, res, 409, 40901, '学号/工号已存在');

    const password_hash = await bcrypt.hash(pwd, 10);
    const student_no = role === 'student' ? id : null;
    const employee_no = role === 'teacher' ? id : null;

    const { rows } = await getPool().query(
      `INSERT INTO users (username, password_hash, real_name, email, role, status, student_no, employee_no, department, major_id)
       VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, $8, $9)
       RETURNING id, username, real_name, email, role, status, student_no, employee_no, department, major_id, last_login_at, created_at`,
      [id, password_hash, rn, em, role, student_no, employee_no, dept, majorIdDb]
    );
    const u = rows[0];
    return ok(req, res, mapUserRow({ ...u, class_id: null, class_name: null }));
  } catch (e) {
    logError(`POST /api/admin/users traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.patch('/admin/users/:id', requireAuth(), requireAdmin(), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return bad(req, res, 400, 40001, '无效用户 id');

    const { name, email, department, majorId, role, idNumber, classId } = req.body || {};
    const sets = [];
    const params = [];
    let pi = 1;

    if (name !== undefined) {
      const v = String(name).trim();
      if (!v) return bad(req, res, 400, 40001, '姓名不能为空');
      sets.push(`real_name = $${pi++}`);
      params.push(v);
    }
    if (email !== undefined) {
      const v = String(email).trim();
      if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
        return bad(req, res, 400, 40006, '邮箱格式错误');
      }
      sets.push(`email = $${pi++}`);
      params.push(v === '' ? null : v);
    }
    if (department !== undefined) {
      const v = String(department).trim();
      if (!v) return bad(req, res, 400, 40004, '学院不能为空');
      const collegeIdNum = Number(v);
      if (!Number.isFinite(collegeIdNum) || collegeIdNum <= 0) {
        return bad(req, res, 400, 40007, '学院须为有效学院 ID');
      }
      const { rows: co } = await getPool().query(
        `SELECT id FROM colleges WHERE id = $1 AND status = 'active'`,
        [collegeIdNum]
      );
      if (!co.length) return bad(req, res, 400, 40008, '学院不存在或已停用');
      sets.push(`department = $${pi++}`);
      params.push(v);
    }
    if (majorId !== undefined) {
      const { rows: ur0 } = await getPool().query(`SELECT role, department FROM users WHERE id = $1`, [id]);
      if (!ur0.length) return bad(req, res, 404, 40401, '用户不存在');
      const effRole = role !== undefined ? String(role).trim() : ur0[0].role;
      if (effRole !== 'student' && effRole !== 'teacher') return bad(req, res, 400, 40012, '仅学生或教师可设置专业');
      const mid =
        majorId === '' || majorId == null ? null : Number(String(majorId).trim());
      if (!mid || !Number.isFinite(mid)) return bad(req, res, 400, 40009, '请选择专业');
      const deptForMajor =
        department !== undefined ? String(department).trim() : String(ur0[0].department || '').trim();
      const collegeIdNum = Number(deptForMajor);
      const { rows: mj } = await getPool().query(
        `SELECT id, college_id FROM majors WHERE id = $1 AND status = 'active'`,
        [mid]
      );
      if (!mj.length) return bad(req, res, 400, 40010, '专业不存在或已停用');
      if (Number.isFinite(collegeIdNum) && collegeIdNum > 0 && Number(mj[0].college_id) !== collegeIdNum) {
        return bad(req, res, 400, 40011, '专业须属于所选学院');
      }
      sets.push(`major_id = $${pi++}`);
      params.push(mid);
    }

    let newUsername;
    if (role !== undefined || idNumber !== undefined) {
      const { rows: cur } = await getPool().query(
        `SELECT role, student_no, employee_no, username FROM users WHERE id = $1`,
        [id]
      );
      if (!cur.length) return bad(req, res, 404, 40401, '用户不存在');
      const nextRole = role !== undefined ? String(role).trim() : cur[0].role;
      if (!['student', 'teacher', 'admin'].includes(nextRole)) return bad(req, res, 400, 40002, '无效角色');
      const nextId =
        idNumber !== undefined
          ? String(idNumber).trim()
          : nextRole === 'student'
            ? cur[0].student_no || cur[0].username
            : cur[0].employee_no || cur[0].username;
      if (!nextId) return bad(req, res, 400, 40003, '学号/工号不能为空');
      newUsername = nextId;
      sets.push(`role = $${pi++}`);
      params.push(nextRole);
      sets.push(`username = $${pi++}`);
      params.push(newUsername);
      sets.push(`student_no = $${pi++}`);
      params.push(nextRole === 'student' ? newUsername : null);
      sets.push(`employee_no = $${pi++}`);
      params.push(nextRole === 'teacher' || nextRole === 'admin' ? newUsername : null);
    }

    if (newUsername) {
      const { rows: dup } = await getPool().query(`SELECT id FROM users WHERE username = $1 AND id <> $2`, [
        newUsername,
        id,
      ]);
      if (dup.length) return bad(req, res, 409, 40901, '学号/工号已被其他用户使用');
    }

    if (sets.length) {
      params.push(id);
      await getPool().query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${pi}`, params);
    }

    if (classId !== undefined) {
      const { rows: ur } = await getPool().query(`SELECT role FROM users WHERE id = $1`, [id]);
      if (!ur.length) return bad(req, res, 404, 40401, '用户不存在');
      if (ur[0].role !== 'student') return bad(req, res, 400, 40006, '仅学生可分配班级');
      await getPool().query(`DELETE FROM class_students WHERE student_id = $1`, [id]);
      const cid = classId === '' || classId == null ? null : Number(classId);
      if (cid && Number.isFinite(cid)) {
        await getPool().query(
          `INSERT INTO class_students (class_id, student_id) VALUES ($1, $2) ON CONFLICT (class_id, student_id) DO NOTHING`,
          [cid, id]
        );
      }
    }

    const { rows } = await getPool().query(
      `SELECT u.id, u.username, u.real_name, u.email, u.role, u.status, u.student_no, u.employee_no, u.department,
              COALESCE(u.avatar_url, '') AS avatar_url,
              u.major_id, u.last_login_at, u.created_at,
              COALESCE(col_u.name, col_cls.name) AS college_name,
              COALESCE(mj.name, mj_cls.name) AS major_name,
              cls.class_id, cls.class_name
       FROM users u
       LEFT JOIN colleges col_u ON (
         (trim(COALESCE(u.department, '')) ~ '^[0-9]+$' AND col_u.id = trim(u.department)::bigint)
         OR (
           trim(COALESCE(u.department, '')) <> ''
           AND trim(COALESCE(u.department, '')) !~ '^[0-9]+$'
           AND col_u.name = trim(u.department)
         )
       )
       LEFT JOIN majors mj ON mj.id = u.major_id
       LEFT JOIN LATERAL (
         SELECT c.id AS class_id, c.name AS class_name, c.college_id, c.major_id
         FROM class_students cs
         JOIN classes c ON c.id = cs.class_id
         WHERE cs.student_id = u.id
         ORDER BY cs.joined_at DESC
         LIMIT 1
       ) cls ON (true)
       LEFT JOIN colleges col_cls ON col_cls.id = cls.college_id
       LEFT JOIN majors mj_cls ON mj_cls.id = cls.major_id
       WHERE u.id = $1`,
      [id]
    );
    return ok(req, res, mapUserRow(rows[0]));
  } catch (e) {
    logError(`PATCH /api/admin/users/:id traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.patch('/admin/users/:id/status', requireAuth(), requireAdmin(), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return bad(req, res, 400, 40001, '无效用户 id');
    const status = String(req.body?.status || '').trim();
    if (!['active', 'inactive'].includes(status)) return bad(req, res, 400, 40002, '无效状态');
    if (String(id) === req.user.sub) return bad(req, res, 400, 40003, '不能修改自己的状态');

    const { rowCount } = await getPool().query(`UPDATE users SET status = $1 WHERE id = $2`, [status, id]);
    if (!rowCount) return bad(req, res, 404, 40401, '用户不存在');
    return ok(req, res, { id: String(id), status });
  } catch (e) {
    logError(`PATCH /api/admin/users/:id/status traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.patch('/admin/users/:id/password', requireAuth(), requireAdmin(), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return bad(req, res, 400, 40001, '无效用户 id');
    const password = String(req.body?.password || '');
    if (password.length < 6) return bad(req, res, 400, 40002, '密码至少 6 位');

    const password_hash = await bcrypt.hash(password, 10);
    const { rowCount } = await getPool().query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [password_hash, id]);
    if (!rowCount) return bad(req, res, 404, 40401, '用户不存在');
    return ok(req, res, { ok: true });
  } catch (e) {
    logError(`PATCH /api/admin/users/:id/password traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.delete('/admin/users/:id', requireAuth(), requireAdmin(), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return bad(req, res, 400, 40001, '无效用户 id');
    if (String(id) === req.user.sub) return bad(req, res, 400, 40003, '不能删除当前登录账号');

    const { rows } = await getPool().query(`SELECT role FROM users WHERE id = $1`, [id]);
    if (!rows.length) return bad(req, res, 404, 40401, '用户不存在');

    await getPool().query(`DELETE FROM users WHERE id = $1`, [id]);
    return ok(req, res, { ok: true });
  } catch (e) {
    logError(`DELETE /api/admin/users/:id traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

function normalizeRole(r) {
  const s = String(r || '').trim().toLowerCase();
  if (s === '学生' || s === 'student') return 'student';
  if (s === '教师' || s === '老师' || s === 'teacher') return 'teacher';
  return null;
}

router.post('/admin/users/batch', requireAuth(), requireAdmin(), async (req, res) => {
  try {
    const rows = req.body?.rows;
    if (!Array.isArray(rows) || !rows.length) return bad(req, res, 400, 40001, '缺少导入数据');
    if (rows.length > 500) return bad(req, res, 400, 40002, '单次最多 500 条');

    const errors = [];
    let success = 0;

    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx] || {};
      const rowNo = idx + 2;
      const name = String(row.name || '').trim();
      const role = normalizeRole(row.role);
      const idNumber = String(row.idNumber || '').trim();
      const emailRaw = row.email != null ? String(row.email).trim() : '';
      const email = emailRaw === '' ? null : emailRaw;
      const collegeIdRaw = row.collegeId != null ? String(row.collegeId).trim() : '';
      const majorIdRaw = row.majorId != null ? String(row.majorId).trim() : '';
      const classIdRaw = row.classId != null ? String(row.classId).trim() : '';
      const collegeIdNum = collegeIdRaw ? Number(collegeIdRaw) : NaN;
      const majorIdNum = majorIdRaw ? Number(majorIdRaw) : NaN;
      const classIdNum = classIdRaw ? Number(classIdRaw) : NaN;

      if (!name) {
        errors.push({ row: rowNo, reason: '姓名不能为空' });
        continue;
      }
      if (!role) {
        errors.push({ row: rowNo, reason: '角色须为「学生」或「教师」' });
        continue;
      }
      if (!idNumber) {
        errors.push({ row: rowNo, reason: '学号/工号不能为空' });
        continue;
      }
      if (!collegeIdRaw || !Number.isFinite(collegeIdNum) || collegeIdNum <= 0) {
        errors.push({ row: rowNo, reason: '学院ID不能为空或无效' });
        continue;
      }
      if (
        (role === 'student' || role === 'teacher') &&
        (!majorIdRaw || !Number.isFinite(majorIdNum) || majorIdNum <= 0)
      ) {
        errors.push({ row: rowNo, reason: '须填写有效的专业ID' });
        continue;
      }
      if (role === 'teacher') {
        const { rows: mjT } = await getPool().query(
          `SELECT id, college_id FROM majors WHERE id = $1 AND status = 'active'`,
          [majorIdNum]
        );
        if (!mjT.length) {
          errors.push({ row: rowNo, reason: '专业不存在或已停用' });
          continue;
        }
        if (Number(mjT[0].college_id) !== collegeIdNum) {
          errors.push({ row: rowNo, reason: '专业不属于所选学院' });
          continue;
        }
      }
      if (role === 'student' && (!classIdRaw || !Number.isFinite(classIdNum) || classIdNum <= 0)) {
        errors.push({ row: rowNo, reason: '学生须填写有效的班级ID' });
        continue;
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push({ row: rowNo, reason: '邮箱格式错误' });
        continue;
      }

      const pwd = idNumber.slice(-6) || idNumber;
      try {
        const { rows: co } = await getPool().query(
          `SELECT id FROM colleges WHERE id = $1 AND status = 'active'`,
          [collegeIdNum]
        );
        if (!co.length) {
          errors.push({ row: rowNo, reason: '学院不存在或已停用' });
          continue;
        }

        if (role === 'student') {
          const { rows: mj } = await getPool().query(
            `SELECT id, college_id FROM majors WHERE id = $1 AND status = 'active'`,
            [majorIdNum]
          );
          if (!mj.length) {
            errors.push({ row: rowNo, reason: '专业不存在或已停用' });
            continue;
          }
          if (Number(mj[0].college_id) !== collegeIdNum) {
            errors.push({ row: rowNo, reason: '专业不属于所选学院' });
            continue;
          }
          const { rows: cl } = await getPool().query(`SELECT id, college_id FROM classes WHERE id = $1`, [classIdNum]);
          if (!cl.length) {
            errors.push({ row: rowNo, reason: '班级不存在' });
            continue;
          }
          if (Number(cl[0].college_id) !== collegeIdNum) {
            errors.push({ row: rowNo, reason: '班级不属于所选学院' });
            continue;
          }
        }

        const { rows: dup } = await getPool().query(`SELECT id FROM users WHERE username = $1`, [idNumber]);
        if (dup.length) {
          errors.push({ row: rowNo, reason: '学号/工号已存在' });
          continue;
        }
        const password_hash = await bcrypt.hash(pwd, 10);
        const student_no = role === 'student' ? idNumber : null;
        const employee_no = role === 'teacher' ? idNumber : null;
        const department = String(collegeIdNum);
        const majorIdDb = role === 'student' || role === 'teacher' ? majorIdNum : null;
        const ins = await getPool().query(
          `INSERT INTO users (username, password_hash, real_name, email, role, status, student_no, employee_no, department, major_id)
           VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, $8, $9)
           RETURNING id`,
          [idNumber, password_hash, name, email, role, student_no, employee_no, department, majorIdDb]
        );
        const newUserId = ins.rows[0].id;
        if (role === 'student' && classIdNum) {
          await getPool().query(
            `INSERT INTO class_students (class_id, student_id) VALUES ($1, $2) ON CONFLICT (class_id, student_id) DO NOTHING`,
            [classIdNum, newUserId]
          );
        }
        success++;
      } catch (e) {
        errors.push({ row: rowNo, reason: e.message || '写入失败' });
      }
    }

    return ok(req, res, { success, failed: errors.length, errors });
  } catch (e) {
    logError(`POST /api/admin/users/batch traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

export default router;
