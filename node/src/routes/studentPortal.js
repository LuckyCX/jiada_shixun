import { Router } from 'express';
import { getPool } from '../lib/db.js';
import { logError } from '../lib/logError.js';
import { requireAuth, requireStudent } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomInt, randomUUID } from 'crypto';
import { sendSmtpMail } from '../lib/mailProvider.js';

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

function studentIdFromReq(req) {
  const raw = req.user?.sub;
  const id = raw != null ? Number(String(raw).trim()) : NaN;
  return Number.isFinite(id) && id > 0 ? id : null;
}

function dateOnly(value) {
  if (!value) return '';
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
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

async function sendBindEmailCode(pool, sid, email) {
  const { rows: latest } = await pool.query(
    `SELECT id, sent_at
     FROM email_verification_codes
     WHERE role = 'student' AND purpose = 'bind_email' AND user_id = $1 AND email = $2
     ORDER BY id DESC
     LIMIT 1`,
    [sid, email]
  );
  const lastSentAt = latest[0]?.sent_at ? new Date(latest[0].sent_at).getTime() : 0;
  if (lastSentAt && Date.now() - lastSentAt < 60 * 1000) {
    throw new Error('验证码发送过于频繁，请稍后再试');
  }
  const code = genEmailCode();
  const codeHash = await bcrypt.hash(code, 10);
  const { rows } = await pool.query(
    `INSERT INTO email_verification_codes (role, user_id, email, purpose, code_hash, sent_at, expires_at)
     VALUES ('student', $1, $2, 'bind_email', $3, now(), now() + interval '10 minutes')
     RETURNING id`,
    [sid, email, codeHash]
  );
  await sendSmtpMail(email, {
    subject: '实训平台 · 邮箱验证码',
    text: `你的验证码是 ${code}，10 分钟内有效。`,
    html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;">你的验证码是 <b style="font-size:20px;">${code}</b>，10 分钟内有效。</div>`,
  });
  return rows[0]?.id ? String(rows[0].id) : '';
}

async function verifyBindEmailCode(pool, sid, email, code) {
  const safeCode = String(code || '').trim();
  if (!safeCode) throw new Error('请输入邮箱验证码');
  const { rows } = await pool.query(
    `SELECT id, code_hash, try_count
     FROM email_verification_codes
     WHERE role = 'student' AND purpose = 'bind_email'
       AND user_id = $1 AND email = $2
       AND used_at IS NULL
       AND expires_at > now()
     ORDER BY id DESC
     LIMIT 1`,
    [sid, email]
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

/** 学生档案：侧栏展示姓名/学号（JWT 里 username 常为数字登录名，不等同于展示名） */
router.get('/student/me', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const sid = studentIdFromReq(req);
    if (!sid) return bad(req, res, 400, 40001, '无效用户');

    const { rows } = await getPool().query(
      `SELECT u.id, u.username, u.real_name AS "realName", u.student_no AS "studentNo", u.email, u.avatar_url AS "avatarUrl",
              cls.id AS "classId", cls.name AS "className",
              col.id AS "collegeId", col.name AS "collegeName"
       FROM users u
       LEFT JOIN LATERAL (
         SELECT c.id, c.name, c.college_id
         FROM class_students cs
         JOIN classes c ON c.id = cs.class_id
         WHERE cs.student_id = u.id
         ORDER BY cs.joined_at DESC, cs.id DESC
         LIMIT 1
       ) cls ON (true)
       LEFT JOIN colleges col ON col.id = cls.college_id
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
      avatarUrl: r.avatarUrl || '',
      classId: r.classId != null ? String(r.classId) : '',
      className: r.className || '',
      collegeId: r.collegeId != null ? String(r.collegeId) : '',
      collegeName: r.collegeName || '',
    });
  } catch (e) {
    logError(`GET /api/student/me traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.post('/student/me/email-code', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const sid = studentIdFromReq(req);
    if (!sid) return bad(req, res, 400, 40001, '无效用户');
    const email = normalizeEmail(req.body?.email);
    if (!email) return bad(req, res, 400, 40002, '邮箱格式错误');
    const id = await sendBindEmailCode(getPool(), sid, email);
    return ok(req, res, { sent: true, id }, '已发送');
  } catch (e) {
    logError(`POST /api/student/me/email-code traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.patch('/student/me', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const sid = studentIdFromReq(req);
    if (!sid) return bad(req, res, 400, 40001, '无效用户');
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
      await verifyBindEmailCode(getPool(), sid, normalized, emailCode);
      sets.push(`email = $${i++}`);
      params.push(normalized);
      newEmail = normalized;
      emailChanged = true;
    }

    if (newPassword || oldPassword) {
      if (!oldPassword) return bad(req, res, 400, 40003, '请输入旧密码');
      if (!newPassword || newPassword.length < 6) return bad(req, res, 400, 40004, '新密码至少 6 位');
      const { rows } = await getPool().query(`SELECT password_hash FROM users WHERE id = $1 AND role = 'student'`, [sid]);
      if (!rows.length) return bad(req, res, 404, 40401, '学生不存在');
      const okPwd = await bcrypt.compare(oldPassword, rows[0].password_hash);
      if (!okPwd) return bad(req, res, 400, 40005, '旧密码不正确');
      const password_hash = await bcrypt.hash(newPassword, 10);
      sets.push(`password_hash = $${i++}`);
      params.push(password_hash);
    }

    if (!sets.length) return bad(req, res, 400, 40006, '无更新字段');
    params.push(sid);
    await getPool().query(`UPDATE users SET ${sets.join(', ')}, updated_at = now() WHERE id = $${i}`, params);

    if (emailChanged && newEmail) {
      await sendSmtpMail(newEmail, {
        subject: '实训平台 · 邮箱变更通知',
        text: '你的账号邮箱已更新。如非本人操作，请尽快联系管理员。',
      });
    }

    return ok(req, res, { saved: true }, '已保存');
  } catch (e) {
    logError(`PATCH /api/student/me traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.post('/student/me/avatar', requireAuth(), requireStudent(), upload.single('file'), async (req, res) => {
  try {
    const sid = studentIdFromReq(req);
    if (!sid) return bad(req, res, 400, 40001, '无效用户');
    const file = req.file;
    if (!file) return bad(req, res, 400, 40002, '请选择图片文件');
    const ext = extFromMime(file.mimetype);
    if (!ext) return bad(req, res, 400, 40003, '仅支持 PNG/JPG/WEBP 图片');
    const dir = path.join(AVATAR_UPLOAD_ROOT, 'student', String(sid));
    fs.mkdirSync(dir, { recursive: true });
    const name = `${randomUUID()}${ext}`;
    const rel = path.join('student', String(sid), name).replace(/\\/g, '/');
    const abs = path.join(AVATAR_UPLOAD_ROOT, rel);
    fs.writeFileSync(abs, file.buffer);
    const url = `/uploads/avatars/${rel}`;
    await getPool().query(`UPDATE users SET avatar_url = $1, updated_at = now() WHERE id = $2 AND role = 'student'`, [url, sid]);
    return ok(req, res, { avatarUrl: url }, '已保存');
  } catch (e) {
    logError(`POST /api/student/me/avatar traceId=${req.traceId}`, e);
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
              tp.joined_at AS "joinedAt",
              team_setting.start_date AS "teamStartDate",
              COALESCE(
                jsonb_agg(
                  jsonb_build_object(
                    'moduleKey', cs.module_key,
                    'startDate', to_char(cs.start_date, 'YYYY-MM-DD'),
                    'deadlineDate', to_char(cs.deadline_date, 'YYYY-MM-DD')
                  )
                  ORDER BY CASE cs.module_key
                    WHEN 'team' THEN 1
                    WHEN 'ideation' THEN 2
                    WHEN 'market' THEN 3
                    WHEN 'product' THEN 4
                    WHEN 'business' THEN 5
                    WHEN 'simulation' THEN 6
                    WHEN 'plan' THEN 7
                    ELSE 99
                  END
                ) FILTER (WHERE cs.module_key IS NOT NULL),
                '[]'::jsonb
              ) AS "courseSettings"
       FROM teacher_personal_class_students tp
       INNER JOIN teacher_personal_classes tpc ON tpc.id = tp.teacher_personal_class_id
       INNER JOIN users u ON u.id = tpc.teacher_id
       LEFT JOIN teacher_personal_class_course_settings team_setting
         ON team_setting.teacher_personal_class_id = tpc.id AND team_setting.module_key = 'team'
       LEFT JOIN teacher_personal_class_course_settings cs
         ON cs.teacher_personal_class_id = tpc.id
       WHERE tp.student_id = $1
       GROUP BY tpc.id, tpc.name, tpc.academic_year, tpc.semester, tpc.teacher_id,
                u.real_name, tp.joined_at, team_setting.start_date
       ORDER BY tp.joined_at ASC, tpc.id ASC
       LIMIT 200`,
      [sid]
    );
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return ok(
      req,
      res,
      rows.map((r) => {
        const teamStartDate = dateOnly(r.teamStartDate);
        const start = teamStartDate ? new Date(`${teamStartDate}T00:00:00`) : null;
        const canEnterTraining = Boolean(start && start.getTime() <= today.getTime());
        return {
          classId: String(r.classId),
          className: r.className,
          academicYear: r.academicYear || '',
          semester: r.semester != null ? String(r.semester) : '',
          teacherId: String(r.teacherId),
          teacherName: r.teacherName || '',
          joinedAt: r.joinedAt ? new Date(r.joinedAt).toISOString() : '',
          teamStartDate,
          canEnterTraining,
          unavailableReason: canEnterTraining
            ? ''
            : teamStartDate
              ? '未到团队组建日期'
              : '未配置团队组建日期',
          courseSettings: Array.isArray(r.courseSettings) ? r.courseSettings : [],
        };
      })
    );
  } catch (e) {
    logError(`GET /api/student/personal-class-enrollments traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

export default router;
