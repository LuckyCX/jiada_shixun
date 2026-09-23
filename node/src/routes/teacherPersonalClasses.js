import { Router } from 'express';
import { getPool } from '../lib/db.js';
import { seedDefaultTeamFormationQuestions } from '../lib/defaultTeamFormationQuestions.js';
import { logError } from '../lib/logError.js';
import { requireAuth, requireTeacher } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomInt, randomUUID } from 'crypto';
import { sendSmtpMail } from '../lib/mailProvider.js';
import { validatePasswordStrength } from '../lib/passwordPolicy.js';
import { signAccessToken, signRefreshToken } from '../lib/authTokens.js';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AVATAR_UPLOAD_ROOT = path.join(__dirname, '../../uploads/avatars');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

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

function normalizeEmail(value) {
  const s = String(value || '').trim().toLowerCase();
  if (!s) return '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return '';
  return s;
}

function extFromMime(mime) {
  const m = String(mime || '').toLowerCase();
  if (m === 'image/png') return '.png';
  if (m === 'image/jpeg' || m === 'image/jpg') return '.jpg';
  if (m === 'image/webp') return '.webp';
  return '';
}

function genEmailCode() {
  const n = randomInt(0, 1000000);
  return String(n).padStart(6, '0');
}

async function sendBindEmailCode(pool, tid, email) {
  const { rows: latest } = await pool.query(
    `SELECT id, sent_at
     FROM email_verification_codes
     WHERE role = 'teacher' AND purpose = 'bind_email' AND user_id = $1 AND email = $2
     ORDER BY id DESC
     LIMIT 1`,
    [tid, email]
  );
  const lastSentAt = latest[0]?.sent_at ? new Date(latest[0].sent_at).getTime() : 0;
  if (lastSentAt && Date.now() - lastSentAt < 60 * 1000) {
    throw new Error('验证码发送过于频繁，请稍后再试');
  }
  const code = genEmailCode();
  const codeHash = await bcrypt.hash(code, 10);
  const { rows } = await pool.query(
    `INSERT INTO email_verification_codes (role, user_id, email, purpose, code_hash, sent_at, expires_at)
     VALUES ('teacher', $1, $2, 'bind_email', $3, now(), now() + interval '10 minutes')
     RETURNING id`,
    [tid, email, codeHash]
  );
  await sendSmtpMail(email, {
    subject: '实训平台 · 邮箱验证码',
    text: `你的验证码是 ${code}，10 分钟内有效。`,
    html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;">你的验证码是 <b style="font-size:20px;">${code}</b>，10 分钟内有效。</div>`,
  });
  return rows[0]?.id ? String(rows[0].id) : '';
}

async function verifyBindEmailCode(pool, tid, email, code) {
  const safeCode = String(code || '').trim();
  if (!safeCode) throw new Error('请输入邮箱验证码');
  const { rows } = await pool.query(
    `SELECT id, code_hash, try_count
     FROM email_verification_codes
     WHERE role = 'teacher' AND purpose = 'bind_email'
       AND user_id = $1 AND email = $2
       AND used_at IS NULL
       AND expires_at > now()
     ORDER BY id DESC
     LIMIT 1`,
    [tid, email]
  );
  if (!rows.length) throw new Error('验证码无效或已过期');
  const row = rows[0];
  const tryCount = Number(row.try_count || 0);
  if (tryCount >= 5) throw new Error('验证码错误次数过多，请重新获取');
  const ok = await bcrypt.compare(safeCode, row.code_hash);
  if (!ok) {
    await pool.query(`UPDATE email_verification_codes SET try_count = try_count + 1 WHERE id = $1`, [row.id]);
    throw new Error('验证码不正确');
  }
  await pool.query(`UPDATE email_verification_codes SET used_at = now() WHERE id = $1`, [row.id]);
}

/**
 * 教师档案：院系与 admin 用户管理一致，users.department 存学院 colleges.id 的字符串。
 */
router.get('/teacher/me', requireAuth(), requireTeacher(), async (req, res) => {
  try {
    const tid = teacherIdFromReq(req);
    if (!tid) return bad(req, res, 400, 40001, '无效用户');

    const { rows } = await getPool().query(
      `SELECT u.id, u.username, u.real_name AS "realName", u.email, u.department, u.major_id, u.avatar_url AS "avatarUrl",
              col.name AS "collegeName",
              mj.name AS "majorName"
       FROM users u
       LEFT JOIN colleges col
         ON col.id = CASE
           WHEN trim(COALESCE(u.department, '')) ~ '^[0-9]+$'
           THEN trim(u.department)::bigint
           ELSE NULL
         END
       LEFT JOIN majors mj ON mj.id = u.major_id
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
      avatarUrl: r.avatarUrl || '',
      departmentCollegeId: r.department != null ? String(r.department).trim() : '',
      collegeName: r.collegeName || '',
      majorId: r.major_id != null ? String(r.major_id) : '',
      majorName: r.majorName || '',
    });
  } catch (e) {
    logError(`GET /api/teacher/me traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.post('/teacher/me/email-code', requireAuth(), requireTeacher(), async (req, res) => {
  try {
    const tid = teacherIdFromReq(req);
    if (!tid) return bad(req, res, 400, 40001, '无效用户');
    const email = normalizeEmail(req.body?.email);
    if (!email) return bad(req, res, 400, 40002, '邮箱格式错误');
    const id = await sendBindEmailCode(getPool(), tid, email);
    return ok(req, res, { sent: true, id }, '已发送');
  } catch (e) {
    logError(`POST /api/teacher/me/email-code traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.patch('/teacher/me', requireAuth(), requireTeacher(), async (req, res) => {
  try {
    const tid = teacherIdFromReq(req);
    if (!tid) return bad(req, res, 400, 40001, '无效用户');
    const emailRaw = req.body?.email;
    const emailCode = req.body?.code ?? req.body?.emailCode;
    const oldPassword = String(req.body?.oldPassword || '');
    const newPassword = String(req.body?.newPassword || '');

    const sets = [];
    const params = [];
    let i = 1;

    let newEmail = null;
    let emailChanged = false;
    if (emailRaw !== undefined) {
      const normalized = normalizeEmail(emailRaw);
      if (!normalized) return bad(req, res, 400, 40002, '邮箱格式错误');
      await verifyBindEmailCode(getPool(), tid, normalized, emailCode);
      sets.push(`email = $${i++}`);
      params.push(normalized);
      newEmail = normalized;
      emailChanged = true;
    }

    if (newPassword || oldPassword) {
      if (!oldPassword) return bad(req, res, 400, 40003, '请输入旧密码');
      const strength = validatePasswordStrength(newPassword);
      if (!strength.ok) return bad(req, res, 400, 40020, strength.message);
      const { rows } = await getPool().query(`SELECT id, username, role, password_hash FROM users WHERE id = $1 AND role = 'teacher'`, [tid]);
      if (!rows.length) return bad(req, res, 404, 40401, '教师不存在');
      const okPwd = await bcrypt.compare(oldPassword, rows[0].password_hash);
      if (!okPwd) return bad(req, res, 400, 40005, '旧密码不正确');
      const password_hash = await bcrypt.hash(newPassword, 10);
      sets.push(`password_hash = $${i++}`);
      params.push(password_hash);
    }

    if (!sets.length) return bad(req, res, 400, 40006, '无更新字段');
    params.push(tid);
    await getPool().query(`UPDATE users SET ${sets.join(', ')}, updated_at = now() WHERE id = $${i}`, params);

    if (emailChanged && newEmail) {
      await sendSmtpMail(newEmail, {
        subject: '实训平台 · 邮箱变更通知',
        text: '你的账号邮箱已更新。如非本人操作，请尽快联系管理员。',
      });
    }

    const out = { saved: true };
    if (newPassword || oldPassword) {
      const { rows: urows } = await getPool().query(
        `SELECT id, username, role FROM users WHERE id = $1 AND role = 'teacher'`,
        [tid]
      );
      if (urows.length) {
        const fresh = { id: urows[0].id, username: urows[0].username, role: urows[0].role };
        out.token = await signAccessToken(fresh, { mustChangePassword: false });
        out.refreshToken = await signRefreshToken(fresh, { mustChangePassword: false });
        out.mustChangePassword = false;
      }
    }

    return ok(req, res, out, '已保存');
  } catch (e) {
    logError(`PATCH /api/teacher/me traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.post('/teacher/me/avatar', requireAuth(), requireTeacher(), upload.single('file'), async (req, res) => {
  try {
    const tid = teacherIdFromReq(req);
    if (!tid) return bad(req, res, 400, 40001, '无效用户');
    const file = req.file;
    if (!file) return bad(req, res, 400, 40002, '请选择图片文件');
    const ext = extFromMime(file.mimetype);
    if (!ext) return bad(req, res, 400, 40003, '仅支持 PNG/JPG/WEBP 图片');
    const dir = path.join(AVATAR_UPLOAD_ROOT, 'teacher', String(tid));
    fs.mkdirSync(dir, { recursive: true });
    const name = `${randomUUID()}${ext}`;
    const rel = path.join('teacher', String(tid), name).replace(/\\/g, '/');
    const abs = path.join(AVATAR_UPLOAD_ROOT, rel);
    fs.writeFileSync(abs, file.buffer);
    const url = `/uploads/avatars/${rel}`;
    await getPool().query(`UPDATE users SET avatar_url = $1, updated_at = now() WHERE id = $2 AND role = 'teacher'`, [url, tid]);
    return ok(req, res, { avatarUrl: url }, '已保存');
  } catch (e) {
    logError(`POST /api/teacher/me/avatar traceId=${req.traceId}`, e);
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
       ORDER BY t.created_at ASC, t.id ASC
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

    const pool = getPool();
    const client = await pool.connect();
    let r;
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO teacher_personal_classes (teacher_id, name, academic_year, semester)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, academic_year AS "academicYear", semester, created_at AS "createdAt"`,
        [tid, name, academicYear, semester]
      );
      r = rows[0];
      await seedDefaultTeamFormationQuestions(client, r.id);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

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

async function getClassNoticeContext(db, teacherId, classId) {
  const { rows } = await db.query(
    `SELECT tpc.name AS "className", COALESCE(u.real_name, u.username, '教师') AS "teacherName"
     FROM teacher_personal_classes tpc
     JOIN users u ON u.id = tpc.teacher_id
     WHERE tpc.id = $1 AND tpc.teacher_id = $2`,
    [classId, teacherId]
  );
  return rows[0] || { className: '教学班级', teacherName: '教师' };
}

async function insertStudentNotification(
  db,
  { receiverId, senderId, type, title, content, relatedModule = 'personal_class', relatedLink = '/student-center?tab=overview' }
) {
  await db.query(
    `INSERT INTO notifications (receiver_id, sender_id, type, title, content, related_module, related_link, is_read)
     VALUES ($1, $2, $3, $4, $5, $6, $7, false)`,
    [receiverId, senderId, type, title, content, relatedModule, relatedLink]
  );
}

async function notifyClassMembershipChanges(db, { teacherId, className, teacherName, addedIds, removedIds }) {
  for (const studentId of addedIds) {
    await insertStudentNotification(db, {
      receiverId: studentId,
      senderId: teacherId,
      type: 'system',
      title: '你已加入教学班级',
      content: `${teacherName} 已将你加入「${className}」，请进入学生工作台查看实训安排。`,
    });
  }
  for (const studentId of removedIds) {
    await insertStudentNotification(db, {
      receiverId: studentId,
      senderId: teacherId,
      type: 'system',
      title: '你已被移出教学班级',
      content: `${teacherName} 已将你移出「${className}」。如有疑问，请联系任课教师。`,
    });
  }
}

/** 教务班级下拉（管理端 classes，按学院筛选） */
router.get('/teacher/catalog/admin-classes', requireAuth(), requireTeacher(), async (req, res) => {
  try {
    const collegeRaw = String(req.query.collegeId || '').trim();
    if (!/^\d+$/.test(collegeRaw)) return bad(req, res, 400, 40010, '请选择学院');
    const collegeId = Number(collegeRaw);
    const majorRaw = String(req.query.majorId || '').trim();
    const params = [collegeId];
    let majorClause = '';
    if (/^\d+$/.test(majorRaw)) {
      params.push(Number(majorRaw));
      majorClause = ` AND c.major_id = $${params.length}`;
    }

    const { rows } = await getPool().query(
      `SELECT c.id, c.name
       FROM classes c
       JOIN colleges co ON co.id = c.college_id AND co.status = 'active'
       WHERE c.college_id = $1${majorClause}
       ORDER BY c.id DESC
       LIMIT 400`,
      params
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
    const classRaw = String(req.query.classId || '').trim();
    if (/^\d+$/.test(classRaw)) {
      const classId = Number(classRaw);
      const { rows } = await getPool().query(
        `SELECT u.id, u.real_name AS "name", u.email,
                COALESCE(u.student_no, '') AS "studentNo",
                col.name AS "collegeName",
                mj.name AS "majorName"
         FROM class_students cs
         JOIN users u ON u.id = cs.student_id AND u.role = 'student' AND u.status = 'active'
         JOIN classes c ON c.id = cs.class_id
         LEFT JOIN colleges col ON col.id = c.college_id
         LEFT JOIN majors mj ON mj.id = c.major_id
         WHERE cs.class_id = $1
         ORDER BY u.student_no ASC NULLS LAST, u.id ASC
         LIMIT 800`,
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
          majorName: r.majorName || '',
        }))
      );
    }

    const collegeRaw = String(req.query.collegeId || '').trim();
    if (!/^\d+$/.test(collegeRaw)) return bad(req, res, 400, 40010, '请选择学院');
    const majorRaw = String(req.query.majorId || '').trim();
    if (!/^\d+$/.test(majorRaw)) return bad(req, res, 400, 40013, '请选择专业');

    const params = [collegeRaw, Number(majorRaw)];

    const { rows } = await getPool().query(
      `SELECT u.id, u.real_name AS "name", u.email,
              COALESCE(u.student_no, '') AS "studentNo",
              col.name AS "collegeName",
              mj.name AS "majorName"
       FROM users u
       LEFT JOIN colleges col ON col.id = CASE
           WHEN trim(COALESCE(u.department, '')) ~ '^[0-9]+$'
           THEN trim(u.department)::bigint
           ELSE NULL
         END
       LEFT JOIN majors mj ON mj.id = u.major_id
       WHERE u.role = 'student'
         AND u.status = 'active'
         AND trim(COALESCE(u.department, '')) = $1
         AND u.major_id = $2
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
        majorName: r.majorName || '',
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
      `SELECT u.id, u.real_name AS "name", u.email, COALESCE(u.avatar_url, '') AS "avatarUrl",
              COALESCE(u.student_no, '') AS "studentNo",
              COALESCE(col_u.name, col_cls.name) AS "collegeName",
              COALESCE(mj.name, mj_cls.name) AS "majorName"
       FROM teacher_personal_class_students tp
       JOIN users u ON u.id = tp.student_id
       LEFT JOIN colleges col_u ON (
         trim(COALESCE(u.department, '')) ~ '^[0-9]+$'
         AND col_u.id = trim(u.department)::bigint
       )
       LEFT JOIN majors mj ON mj.id = u.major_id
       LEFT JOIN LATERAL (
         SELECT c.college_id, c.major_id
         FROM class_students cs
         JOIN classes c ON c.id = cs.class_id
         WHERE cs.student_id = u.id
         ORDER BY cs.joined_at DESC
         LIMIT 1
       ) cls ON (true)
       LEFT JOIN colleges col_cls ON col_cls.id = cls.college_id
       LEFT JOIN majors mj_cls ON mj_cls.id = cls.major_id
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
        avatarUrl: r.avatarUrl || '',
        studentNo: r.studentNo || '',
        collegeName: r.collegeName || '',
        majorName: r.majorName || '',
      }))
    );
  } catch (e) {
    logError(`GET /api/teacher/personal-classes/:id/students traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.put('/teacher/personal-classes/:id/students', requireAuth(), requireTeacher(), async (req, res) => {
  return replacePersonalClassStudents(req, res);
});

/**
 * 与 PUT 同语义。教室 360 / 部分校园网代理会拦截 PUT，导致前端 Failed to fetch；保存名单优先走 POST。
 */
router.post('/teacher/personal-classes/:id/students', requireAuth(), requireTeacher(), async (req, res) => {
  return replacePersonalClassStudents(req, res);
});

async function replacePersonalClassStudents(req, res) {
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

      const ctx = await getClassNoticeContext(client, tid, classId);
      const { rows: oldRows } = await client.query(
        `SELECT student_id AS "studentId"
         FROM teacher_personal_class_students
         WHERE teacher_personal_class_id = $1`,
        [classId]
      );
      const oldSet = new Set(oldRows.map((r) => String(r.studentId)));

      await client.query(`DELETE FROM teacher_personal_class_students WHERE teacher_personal_class_id = $1`, [
        classId,
      ]);

      let valid = [];
      if (idStrs.length > 0) {
        const nums = idStrs.map((x) => Number(x));
        const { rows: okRows } = await client.query(
          `SELECT id FROM users WHERE id = ANY($1::bigint[]) AND role = 'student' AND status = 'active'`,
          [nums]
        );
        valid = okRows.map((r) => r.id);
        if (valid.length) {
          await client.query(
            `INSERT INTO teacher_personal_class_students (teacher_personal_class_id, student_id)
             SELECT $1, x FROM unnest($2::bigint[]) AS x`,
            [classId, valid]
          );
        }
      }

      const newSet = new Set(valid.map((id) => String(id)));
      const addedIds = valid.filter((id) => !oldSet.has(String(id)));
      const removedIds = oldRows.map((r) => r.studentId).filter((id) => !newSet.has(String(id)));
      await notifyClassMembershipChanges(client, {
        teacherId: tid,
        className: ctx.className,
        teacherName: ctx.teacherName,
        addedIds,
        removedIds,
      });

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
    logError(`replacePersonalClassStudents ${req.method} traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
}

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
      const client = await pool.connect();
      let rowCount = 0;
      try {
        await client.query('BEGIN');
        const ctx = await getClassNoticeContext(client, tid, classId);
        const result = await client.query(
          `DELETE FROM teacher_personal_class_students tp
           USING teacher_personal_classes tpc
           WHERE tp.teacher_personal_class_id = tpc.id
             AND tp.teacher_personal_class_id = $1
             AND tp.student_id = $2
             AND tpc.teacher_id = $3`,
          [classId, studentNum, tid]
        );
        rowCount = result.rowCount || 0;
        if (!rowCount) {
          await client.query('ROLLBACK');
          return bad(req, res, 404, 40403, '未找到该分组中的学生');
        }
        await notifyClassMembershipChanges(client, {
          teacherId: tid,
          className: ctx.className,
          teacherName: ctx.teacherName,
          addedIds: [],
          removedIds: [studentNum],
        });
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }

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
