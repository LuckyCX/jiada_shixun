import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getPool } from '../lib/db.js';
import { logError } from '../lib/logError.js';
import { cleanupStudentTeamsBeforeUserDelete } from '../lib/cleanupStudentTeamsOnUserDelete.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { validatePasswordStrength } from '../lib/passwordPolicy.js';

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
  // 学生有行政班时，以当前班的学院/专业为准（挪班后 users 上旧字段可能未同步）
  const hasAdminClass = r.class_id != null || r.class_college_id != null;
  const department = hasAdminClass
    ? r.class_college_id != null
      ? String(r.class_college_id)
      : r.user_college_id != null
        ? String(r.user_college_id)
        : r.department != null && String(r.department).trim() !== ''
          ? String(r.department).trim()
          : ''
    : r.user_college_id != null
      ? String(r.user_college_id)
      : r.department != null && String(r.department).trim() !== ''
        ? String(r.department).trim()
        : '';
  const majorId = hasAdminClass
    ? r.class_major_id != null
      ? String(r.class_major_id)
      : r.major_id != null
        ? String(r.major_id)
        : ''
    : r.major_id != null
      ? String(r.major_id)
      : '';
  return {
    id: String(r.id),
    username: r.username,
    name: r.real_name || r.username,
    avatarUrl: r.avatar_url || '',
    email: r.email || '',
    studentId: r.student_no || undefined,
    employeeId: r.employee_no || undefined,
    department,
    collegeName: r.college_name || '',
    majorId,
    majorName: r.major_name || '',
    role: r.role,
    status: r.status,
    lastLogin: fmtLoginAt(r.last_login_at),
    classId: r.class_id != null ? String(r.class_id) : undefined,
    className: r.class_name || undefined,
    createdAt: r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : '',
  };
}

/** 查询学生当前行政班列表（按入班时间倒序） */
async function listStudentAdminClasses(poolOrClient, studentId) {
  const { rows } = await poolOrClient.query(
    `SELECT c.id AS "classId", c.name AS "className"
     FROM class_students cs
     JOIN classes c ON c.id = cs.class_id
     WHERE cs.student_id = $1
     ORDER BY cs.joined_at DESC`,
    [studentId]
  );
  return rows.map((r) => ({
    classId: String(r.classId),
    className: r.className || '',
  }));
}

/** 与前端 initialPasswordFromIdNumber 一致：Jd + 学号后 6 位 */
function initialPasswordFromIdNumber(idNumber) {
  const s = String(idNumber || '').trim();
  if (!s) return '';
  return `Jd${s.slice(-6).padStart(6, '0')}`;
}

/**
 * 挪班后重置为初始密码，避免沿用旧班未知口令导致无法登录
 * @returns {Promise<string>} 明文初始密码（供提示）
 */
async function resetUserToInitialPassword(poolOrClient, userId, idNumber) {
  const pwd = initialPasswordFromIdNumber(idNumber);
  if (!pwd) throw new Error('无法生成初始密码');
  const strength = validatePasswordStrength(pwd);
  if (!strength.ok) throw new Error(strength.message);
  const password_hash = await bcrypt.hash(pwd, 10);
  await poolOrClient.query(`UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2`, [
    password_hash,
    userId,
  ]);
  return pwd;
}

/**
 * 将学生 users.department / major_id 同步为目标行政班的学院、专业
 * （department 存 colleges.id 字符串，与新建学生一致）
 */
async function syncStudentAffiliationToClass(poolOrClient, userId, targetClassId) {
  const { rows } = await poolOrClient.query(
    `SELECT college_id, major_id FROM classes WHERE id = $1`,
    [targetClassId]
  );
  if (!rows.length) return;
  const collegeId = rows[0].college_id;
  const majorId = rows[0].major_id;
  await poolOrClient.query(
    `UPDATE users
     SET department = COALESCE($1::text, department),
         major_id = COALESCE($2::bigint, major_id),
         updated_at = now()
     WHERE id = $3 AND role = 'student'`,
    [collegeId != null ? String(collegeId) : null, majorId != null ? Number(majorId) : null, userId]
  );
}

/**
 * 将已有学生挂到目标行政班。
 * @returns {{ ok: true, action: 'already'|'linked'|'moved'|'skipped' } | { ok: false, conflict: object } | { ok: false, error: string }}
 */
async function attachExistingStudentToClass(poolOrClient, {
  userId,
  idNumber,
  displayName,
  targetClassId,
  otherClassPolicy,
  sourceRow,
}) {
  const memberships = await listStudentAdminClasses(poolOrClient, userId);
  const inTarget = memberships.some((m) => m.classId === String(targetClassId));
  if (inTarget) {
    // 已在目标班：仍同步学院/专业，修复历史「只改班不改归属」脏数据
    await syncStudentAffiliationToClass(poolOrClient, userId, targetClassId);
    return { ok: true, action: 'already' };
  }

  const others = memberships.filter((m) => m.classId !== String(targetClassId));
  if (!others.length) {
    await poolOrClient.query(
      `INSERT INTO class_students (class_id, student_id) VALUES ($1, $2)
       ON CONFLICT (class_id, student_id) DO NOTHING`,
      [targetClassId, userId]
    );
    await syncStudentAffiliationToClass(poolOrClient, userId, targetClassId);
    return { ok: true, action: 'linked' };
  }

  const primary = others[0];
  if (!otherClassPolicy) {
    return {
      ok: false,
      conflict: {
        row: sourceRow ?? null,
        userId: String(userId),
        idNumber,
        name: displayName || '',
        currentClassId: primary.classId,
        currentClassName: primary.className,
        targetClassId: String(targetClassId),
      },
    };
  }
  if (otherClassPolicy === 'skip') {
    return { ok: true, action: 'skipped' };
  }
  if (otherClassPolicy === 'move') {
    await poolOrClient.query(`DELETE FROM class_students WHERE student_id = $1`, [userId]);
    await poolOrClient.query(
      `INSERT INTO class_students (class_id, student_id) VALUES ($1, $2)
       ON CONFLICT (class_id, student_id) DO NOTHING`,
      [targetClassId, userId]
    );
    await syncStudentAffiliationToClass(poolOrClient, userId, targetClassId);
    return { ok: true, action: 'moved' };
  }
  return { ok: false, error: '无效的 otherClassPolicy' };
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
              -- 有行政班时优先展示班所属学院/专业（与挪班后真实归属一致）
              COALESCE(col_cls.name, col_u.name) AS college_name,
              COALESCE(mj_cls.name, mj.name) AS major_name,
              col_u.id AS user_college_id,
              cls.class_id, cls.class_name, cls.college_id AS class_college_id, cls.major_id AS class_major_id
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
    const { name, role, idNumber, email, department, majorId, password, classId, otherClassPolicy } =
      req.body || {};
    const rn = String(name || '').trim();
    const id = String(idNumber || '').trim();
    const dept = String(department || '').trim();
    const majorIdNum =
      majorId != null && String(majorId).trim() !== '' ? Number(String(majorId).trim()) : null;
    const em = email != null && String(email).trim() !== '' ? String(email).trim() : null;
    const pwd = String(password || '');
    const classIdNum =
      classId != null && String(classId).trim() !== '' ? Number(String(classId).trim()) : null;
    const policyRaw = otherClassPolicy != null ? String(otherClassPolicy).trim() : '';
    const policy =
      policyRaw === 'skip' || policyRaw === 'move' ? policyRaw : undefined;

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
    if (role === 'student') {
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
    } else if (role === 'teacher' && majorIdNum && Number.isFinite(majorIdNum) && majorIdNum > 0) {
      // 教师专业可选；若传入则校验归属
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
    if (role === 'student') {
      if (classIdNum == null || !Number.isFinite(classIdNum) || classIdNum <= 0) {
        return bad(req, res, 400, 40015, '请选择班级');
      }
      const { rows: cl } = await getPool().query(
        `SELECT id, college_id, major_id FROM classes WHERE id = $1`,
        [classIdNum]
      );
      if (!cl.length) return bad(req, res, 400, 40013, '班级不存在');
      if (Number(cl[0].college_id) !== collegeIdNum) {
        return bad(req, res, 400, 40014, '班级不属于所选学院');
      }
      if (majorIdDb != null && cl[0].major_id != null && Number(cl[0].major_id) !== majorIdDb) {
        return bad(req, res, 400, 40016, '班级不属于所选专业');
      }
    }
    if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      return bad(req, res, 400, 40006, '邮箱格式错误');
    }

    const pool = getPool();
    const { rows: dup } = await pool.query(
      `SELECT id, username, real_name, email, role, status, student_no, employee_no, department, major_id,
              last_login_at, created_at, COALESCE(avatar_url, '') AS avatar_url
       FROM users WHERE username = $1`,
      [id]
    );

    // 学号已存在：学生可挂到目标班；教师仍报冲突
    if (dup.length) {
      const exist = dup[0];
      if (role === 'student' && exist.role === 'student' && classIdNum) {
        const attach = await attachExistingStudentToClass(pool, {
          userId: exist.id,
          idNumber: id,
          displayName: exist.real_name || rn,
          targetClassId: classIdNum,
          otherClassPolicy: policy,
        });
        if (!attach.ok && attach.conflict) {
          return res.status(409).json({
            code: 40902,
            message: `该学号已在行政班「${attach.conflict.currentClassName || attach.conflict.currentClassId}」`,
            data: { conflict: attach.conflict },
            traceId: req.traceId,
          });
        }
        if (!attach.ok) return bad(req, res, 400, 40015, attach.error || '入班失败');
        if (attach.action === 'skipped') {
          return bad(req, res, 400, 40016, '已按选择跳过该学号，未加入目标班级');
        }
        let tip =
          attach.action === 'moved'
            ? '已从原行政班挪入目标班级'
            : attach.action === 'already'
              ? '该生已在目标班级'
              : '已将已有账号加入目标班级';
        // 从旧班挪入：重置为 Jd+学号后6位，避免旧密码未知无法登录
        if (attach.action === 'moved') {
          const newPwd = await resetUserToInitialPassword(pool, exist.id, id);
          tip = `${tip}；登录密码已重置为 ${newPwd}（首次登录后将提示修改）`;
        }
        if (attach.action === 'already') {
          tip = '该生已在目标班级；已同步学院/专业归属为当前班级';
        } else if (attach.action === 'linked' || attach.action === 'moved') {
          tip = `${tip}；学院/专业已同步为当前班级归属`;
        }
        // 重新读取用户+当前班，保证返回的学院专业正确
        const { rows: freshRows } = await pool.query(
          `SELECT u.id, u.username, u.real_name, u.email, u.role, u.status, u.student_no, u.employee_no,
                  u.department, u.major_id, u.last_login_at, u.created_at,
                  COALESCE(u.avatar_url, '') AS avatar_url,
                  c.id AS class_id, c.name AS class_name,
                  c.college_id AS class_college_id, c.major_id AS class_major_id,
                  col.name AS college_name, mj.name AS major_name,
                  col.id AS user_college_id
           FROM users u
           LEFT JOIN class_students cs ON cs.student_id = u.id AND cs.class_id = $2
           LEFT JOIN classes c ON c.id = cs.class_id
           LEFT JOIN colleges col ON col.id = c.college_id
           LEFT JOIN majors mj ON mj.id = c.major_id
           WHERE u.id = $1`,
          [exist.id, classIdNum]
        );
        const fresh = freshRows[0] || exist;
        return ok(req, res, mapUserRow(fresh), tip);
      }
      return bad(req, res, 409, 40901, '学号/工号已存在');
    }

    if (!pwd) return bad(req, res, 400, 40005, '缺少初始密码');
    const strength = validatePasswordStrength(pwd);
    if (!strength.ok) return bad(req, res, 400, 40020, strength.message);

    const password_hash = await bcrypt.hash(pwd, 10);
    const student_no = role === 'student' ? id : null;
    const employee_no = role === 'teacher' ? id : null;

    const { rows } = await pool.query(
      `INSERT INTO users (username, password_hash, real_name, email, role, status, student_no, employee_no, department, major_id)
       VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, $8, $9)
       RETURNING id, username, real_name, email, role, status, student_no, employee_no, department, major_id, last_login_at, created_at`,
      [id, password_hash, rn, em, role, student_no, employee_no, dept, majorIdDb]
    );
    const u = rows[0];
    let class_id = null;
    let class_name = null;
    if (role === 'student' && classIdNum) {
      await pool.query(
        `INSERT INTO class_students (class_id, student_id) VALUES ($1, $2)
         ON CONFLICT (class_id, student_id) DO NOTHING`,
        [classIdNum, u.id]
      );
      const { rows: cn } = await pool.query(`SELECT name FROM classes WHERE id = $1`, [classIdNum]);
      class_id = classIdNum;
      class_name = cn[0]?.name || null;
    }
    return ok(req, res, mapUserRow({ ...u, class_id, class_name }));
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
      if (effRole !== 'student' && effRole !== 'teacher') {
        return bad(req, res, 400, 40012, '仅学生或教师可设置专业');
      }
      const mid =
        majorId === '' || majorId == null ? null : Number(String(majorId).trim());

      // 教师不强制专业：空值则清空 major_id
      if (effRole === 'teacher' && (mid == null || !Number.isFinite(mid))) {
        sets.push(`major_id = $${pi++}`);
        params.push(null);
      } else {
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
    } else if (role !== undefined && String(role).trim() === 'teacher') {
      // 改为教师角色时清空专业
      sets.push(`major_id = $${pi++}`);
      params.push(null);
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
      const { rows: ur } = await getPool().query(`SELECT role, department, major_id FROM users WHERE id = $1`, [id]);
      if (!ur.length) return bad(req, res, 404, 40401, '用户不存在');
      if (ur[0].role !== 'student') return bad(req, res, 400, 40006, '仅学生可设置班级');
      const cid = classId === '' || classId == null ? null : Number(classId);
      if (!cid || !Number.isFinite(cid)) return bad(req, res, 400, 40015, '请选择班级');
      const { rows: cl } = await getPool().query(
        `SELECT id, college_id, major_id FROM classes WHERE id = $1`,
        [cid]
      );
      if (!cl.length) return bad(req, res, 400, 40013, '班级不存在');
      const deptForClass =
        department !== undefined ? String(department).trim() : String(ur[0].department || '').trim();
      const collegeIdNum = Number(deptForClass);
      if (Number.isFinite(collegeIdNum) && collegeIdNum > 0 && Number(cl[0].college_id) !== collegeIdNum) {
        return bad(req, res, 400, 40014, '班级不属于所选学院');
      }
      const majorForClass =
        majorId !== undefined
          ? majorId === '' || majorId == null
            ? null
            : Number(String(majorId).trim())
          : ur[0].major_id != null
            ? Number(ur[0].major_id)
            : null;
      if (
        majorForClass != null &&
        Number.isFinite(majorForClass) &&
        cl[0].major_id != null &&
        Number(cl[0].major_id) !== majorForClass
      ) {
        return bad(req, res, 400, 40016, '班级不属于所选专业');
      }
      await getPool().query(`DELETE FROM class_students WHERE student_id = $1`, [id]);
      await getPool().query(
        `INSERT INTO class_students (class_id, student_id) VALUES ($1, $2) ON CONFLICT (class_id, student_id) DO NOTHING`,
        [cid, id]
      );
    }

    const { rows } = await getPool().query(
      `SELECT u.id, u.username, u.real_name, u.email, u.role, u.status, u.student_no, u.employee_no, u.department,
              COALESCE(u.avatar_url, '') AS avatar_url,
              u.major_id, u.last_login_at, u.created_at,
              COALESCE(col_u.name, col_cls.name) AS college_name,
              COALESCE(mj.name, mj_cls.name) AS major_name,
              col_u.id AS user_college_id,
              cls.class_id, cls.class_name, cls.college_id AS class_college_id, cls.major_id AS class_major_id
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
    const strength = validatePasswordStrength(password);
    if (!strength.ok) return bad(req, res, 400, 40020, strength.message);

    const pool = getPool();
    const { rows: urows } = await pool.query(
      `SELECT id, username, student_no, employee_no FROM users WHERE id = $1`,
      [id]
    );
    if (!urows.length) return bad(req, res, 404, 40401, '用户不存在');
    const u = urows[0];
    const password_hash = await bcrypt.hash(password, 10);
    // 同步更新「同用户名/同学号/同工号」的其它行，避免历史脏数据导致重置成功却登不进
    const { rowCount } = await pool.query(
      `UPDATE users
       SET password_hash = $1, updated_at = now()
       WHERE id = $2
          OR (username = $3 AND username <> '')
          OR ($4::text IS NOT NULL AND $4 <> '' AND student_no = $4)
          OR ($5::text IS NOT NULL AND $5 <> '' AND employee_no = $5)`,
      [password_hash, id, u.username, u.student_no, u.employee_no]
    );
    if (!rowCount) return bad(req, res, 404, 40401, '用户不存在');
    return ok(req, res, { ok: true, updated: rowCount });
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

    const role = rows[0].role;
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      // 学生：先整理组队（单人公司解散 / 多人队队长顺位），再退出个性化班，最后删账号
      if (role === 'student') {
        await cleanupStudentTeamsBeforeUserDelete(client, [id]);
        await client.query(`DELETE FROM teacher_personal_class_students WHERE student_id = $1`, [id]);
      }
      // 教师：teacher_personal_classes.teacher_id ON DELETE CASCADE 会解散其个性化班及成员
      await client.query(`DELETE FROM users WHERE id = $1`, [id]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    return ok(req, res, { ok: true });
  } catch (e) {
    logError(`DELETE /api/admin/users/:id traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

/** 删除前风险预览：老师将解散的个性化班 / 学生将退出的个性化班 */
router.get('/admin/users/:id/delete-impact', requireAuth(), requireAdmin(), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return bad(req, res, 400, 40001, '无效用户 id');

    const { rows } = await getPool().query(
      `SELECT id, role, real_name, username FROM users WHERE id = $1`,
      [id]
    );
    if (!rows.length) return bad(req, res, 404, 40401, '用户不存在');

    const u = rows[0];
    const role = String(u.role || '');
    let personalClasses = [];

    if (role === 'teacher') {
      const { rows: cls } = await getPool().query(
        `SELECT tpc.id, tpc.name,
                (SELECT COUNT(*)::int FROM teacher_personal_class_students tpcs
                 WHERE tpcs.teacher_personal_class_id = tpc.id) AS student_count
         FROM teacher_personal_classes tpc
         WHERE tpc.teacher_id = $1
         ORDER BY tpc.id`,
        [id]
      );
      personalClasses = cls.map((r) => ({
        id: String(r.id),
        name: r.name || `班级 #${r.id}`,
        studentCount: Number(r.student_count) || 0,
      }));
    } else if (role === 'student') {
      const { rows: cls } = await getPool().query(
        `SELECT tpc.id, tpc.name
         FROM teacher_personal_class_students tpcs
         JOIN teacher_personal_classes tpc ON tpc.id = tpcs.teacher_personal_class_id
         WHERE tpcs.student_id = $1
         ORDER BY tpc.id`,
        [id]
      );
      personalClasses = cls.map((r) => ({
        id: String(r.id),
        name: r.name || `班级 #${r.id}`,
        studentCount: null,
      }));
    }

    return ok(req, res, {
      id: String(u.id),
      role,
      name: u.real_name || u.username || '',
      personalClasses,
    });
  } catch (e) {
    logError(`GET /api/admin/users/:id/delete-impact traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

/** 批量删除学生：先移出教师个性化班级，再删账号 */
router.post('/admin/users/batch-delete', requireAuth(), requireAdmin(), async (req, res) => {
  try {
    const rawIds = req.body?.ids;
    if (!Array.isArray(rawIds) || !rawIds.length) return bad(req, res, 400, 40001, '请选择要删除的学生');
    if (rawIds.length > 200) return bad(req, res, 400, 40002, '单次最多删除 200 人');

    const idSet = new Set();
    for (const x of rawIds) {
      const n = Number(String(x ?? '').trim());
      if (Number.isFinite(n) && n > 0) idSet.add(n);
    }
    const ids = [...idSet];
    if (!ids.length) return bad(req, res, 400, 40001, '请选择要删除的学生');

    const selfId = Number(req.user?.sub);
    if (Number.isFinite(selfId) && ids.includes(selfId)) {
      return bad(req, res, 400, 40003, '不能删除当前登录账号');
    }

    const classIdRaw = req.body?.classId != null ? String(req.body.classId).trim() : '';
    const classIdNum = classIdRaw ? Number(classIdRaw) : NaN;

    const pool = getPool();
    let targetIds = ids;

    // 限定本班学生：避免误删未在该行政班的账号
    if (classIdRaw) {
      if (!Number.isFinite(classIdNum) || classIdNum <= 0) {
        return bad(req, res, 400, 40004, '无效的班级 ID');
      }
      const { rows: inClass } = await pool.query(
        `SELECT u.id
         FROM users u
         INNER JOIN class_students cs ON cs.student_id = u.id AND cs.class_id = $1
         WHERE u.id = ANY($2::bigint[]) AND u.role = 'student'`,
        [classIdNum, ids]
      );
      targetIds = inClass.map((r) => Number(r.id));
      if (!targetIds.length) {
        return bad(req, res, 400, 40005, '所选用户均不在本班或不存在');
      }
    } else {
      const { rows: students } = await pool.query(
        `SELECT id FROM users WHERE id = ANY($1::bigint[]) AND role = 'student'`,
        [ids]
      );
      targetIds = students.map((r) => Number(r.id));
      if (!targetIds.length) return bad(req, res, 400, 40006, '未找到可删除的学生账号');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // 先整理组队，再移出个性化班，最后删账号
      await cleanupStudentTeamsBeforeUserDelete(client, targetIds);
      const rem = await client.query(
        `DELETE FROM teacher_personal_class_students WHERE student_id = ANY($1::bigint[])`,
        [targetIds]
      );
      const del = await client.query(`DELETE FROM users WHERE id = ANY($1::bigint[]) AND role = 'student'`, [
        targetIds,
      ]);
      await client.query('COMMIT');
      return ok(req, res, {
        deleted: del.rowCount ?? 0,
        removedFromPersonalClasses: rem.rowCount ?? 0,
      });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    logError(`POST /api/admin/users/batch-delete traceId=${req.traceId}`, e);
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

    const policyRaw = req.body?.otherClassPolicy != null ? String(req.body.otherClassPolicy).trim() : '';
    const otherClassPolicy =
      policyRaw === 'skip' || policyRaw === 'move' ? policyRaw : undefined;

    const errors = [];
    const conflicts = [];
    let success = 0;
    let skipped = 0;

    const usernames = [
      ...new Set(rows.map((row) => String(row?.idNumber || '').trim()).filter(Boolean)),
    ];
    /** username -> 已有用户摘要 */
    const existingByUsername = new Map();
    if (usernames.length) {
      const { rows: dupRows } = await getPool().query(
        `SELECT id, username, real_name, role FROM users WHERE username = ANY($1::text[])`,
        [usernames]
      );
      for (const d of dupRows) existingByUsername.set(d.username, d);
    }

    const collegeActiveCache = new Map();
    const majorCollegeCache = new Map();
    const classCollegeCache = new Map();

    async function collegeIsActive(collegeIdNum) {
      if (collegeActiveCache.has(collegeIdNum)) return collegeActiveCache.get(collegeIdNum);
      const { rows: co } = await getPool().query(
        `SELECT id FROM colleges WHERE id = $1 AND status = 'active'`,
        [collegeIdNum]
      );
      const okCollege = co.length > 0;
      collegeActiveCache.set(collegeIdNum, okCollege);
      return okCollege;
    }

    async function majorCollegeId(majorIdNum) {
      if (majorCollegeCache.has(majorIdNum)) return majorCollegeCache.get(majorIdNum);
      const { rows: mj } = await getPool().query(
        `SELECT id, college_id FROM majors WHERE id = $1 AND status = 'active'`,
        [majorIdNum]
      );
      const cid = mj.length ? Number(mj[0].college_id) : null;
      majorCollegeCache.set(majorIdNum, cid);
      return cid;
    }

    async function classCollegeId(classIdNum) {
      if (classCollegeCache.has(classIdNum)) return classCollegeCache.get(classIdNum);
      const { rows: cl } = await getPool().query(`SELECT id, college_id FROM classes WHERE id = $1`, [
        classIdNum,
      ]);
      const cid = cl.length ? Number(cl[0].college_id) : null;
      classCollegeCache.set(classIdNum, cid);
      return cid;
    }

    // 本批次内已处理的学号，避免同文件重复行二次创建
    const seenInBatch = new Set();

    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx] || {};
      const sourceLine = Number(row.sourceLine);
      const rowNo =
        Number.isFinite(sourceLine) && sourceLine > 0 ? Math.floor(sourceLine) : idx + 2;
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
      if (role === 'student' && (!majorIdRaw || !Number.isFinite(majorIdNum) || majorIdNum <= 0)) {
        errors.push({ row: rowNo, reason: '学生须填写有效的专业ID' });
        continue;
      }
      if (role === 'teacher' && majorIdRaw) {
        if (!Number.isFinite(majorIdNum) || majorIdNum <= 0) {
          errors.push({ row: rowNo, reason: '专业ID无效' });
          continue;
        }
        const mjCollege = await majorCollegeId(majorIdNum);
        if (mjCollege == null) {
          errors.push({ row: rowNo, reason: '专业不存在或已停用' });
          continue;
        }
        if (mjCollege !== collegeIdNum) {
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

      const pwd = `Jd${(idNumber.slice(-6) || idNumber).padStart(6, '0')}`;
      const strength = validatePasswordStrength(pwd);
      if (!strength.ok) {
        errors.push({ row: rowNo, reason: strength.message });
        continue;
      }
      try {
        if (!(await collegeIsActive(collegeIdNum))) {
          errors.push({ row: rowNo, reason: '学院不存在或已停用' });
          continue;
        }

        if (role === 'student') {
          const mjCollege = await majorCollegeId(majorIdNum);
          if (mjCollege == null) {
            errors.push({ row: rowNo, reason: '专业不存在或已停用' });
            continue;
          }
          if (mjCollege !== collegeIdNum) {
            errors.push({ row: rowNo, reason: '专业不属于所选学院' });
            continue;
          }
          const clCollege = await classCollegeId(classIdNum);
          if (clCollege == null) {
            errors.push({ row: rowNo, reason: '班级不存在' });
            continue;
          }
          if (clCollege !== collegeIdNum) {
            errors.push({ row: rowNo, reason: '班级不属于所选学院' });
            continue;
          }
        }

        const exist = existingByUsername.get(idNumber);
        if (exist) {
          if (role === 'student' && exist.role === 'student') {
            const attach = await attachExistingStudentToClass(getPool(), {
              userId: exist.id,
              idNumber,
              displayName: exist.real_name || name,
              targetClassId: classIdNum,
              otherClassPolicy,
              sourceRow: rowNo,
            });
            if (!attach.ok && attach.conflict) {
              conflicts.push(attach.conflict);
              continue;
            }
            if (!attach.ok) {
              errors.push({ row: rowNo, reason: attach.error || '入班失败' });
              continue;
            }
            if (attach.action === 'skipped') skipped++;
            else {
              // 批量挪班：同步重置初始密码，与单条入班行为一致
              if (attach.action === 'moved') {
                try {
                  await resetUserToInitialPassword(getPool(), exist.id, idNumber);
                } catch (e) {
                  errors.push({ row: rowNo, reason: e.message || '挪班成功但重置密码失败' });
                  continue;
                }
              }
              success++;
            }
            seenInBatch.add(idNumber);
            continue;
          }
          errors.push({ row: rowNo, reason: '学号/工号已存在' });
          continue;
        }

        if (seenInBatch.has(idNumber)) {
          errors.push({ row: rowNo, reason: '本文件内学号/工号重复' });
          continue;
        }

        const password_hash = await bcrypt.hash(pwd, 10);
        const student_no = role === 'student' ? idNumber : null;
        const employee_no = role === 'teacher' ? idNumber : null;
        const department = String(collegeIdNum);
        const majorIdDb =
          role === 'student'
            ? majorIdNum
            : role === 'teacher' && Number.isFinite(majorIdNum) && majorIdNum > 0
              ? majorIdNum
              : null;
        const ins = await getPool().query(
          `INSERT INTO users (username, password_hash, real_name, email, role, status, student_no, employee_no, department, major_id)
           VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, $8, $9)
           RETURNING id, username, real_name, role`,
          [idNumber, password_hash, name, email, role, student_no, employee_no, department, majorIdDb]
        );
        const newUser = ins.rows[0];
        if (role === 'student' && classIdNum) {
          await getPool().query(
            `INSERT INTO class_students (class_id, student_id) VALUES ($1, $2) ON CONFLICT (class_id, student_id) DO NOTHING`,
            [classIdNum, newUser.id]
          );
        }
        existingByUsername.set(idNumber, newUser);
        seenInBatch.add(idNumber);
        success++;
      } catch (e) {
        errors.push({ row: rowNo, reason: e.message || '写入失败' });
      }
    }

    return ok(req, res, {
      success,
      failed: errors.length,
      skipped,
      errors,
      conflicts,
      needsDecision: conflicts.length > 0 && !otherClassPolicy,
    });
  } catch (e) {
    logError(`POST /api/admin/users/batch traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

export default router;
