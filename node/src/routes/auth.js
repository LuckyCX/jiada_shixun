import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../lib/db.js';
import { logError } from '../lib/logError.js';
import {
  signAccessToken,
  signRefreshToken,
  signEconoverseHopTicket,
  verifyAndConsumeEconoverseHopTicket,
  verifyAndRevokeRefreshToken,
} from '../lib/authTokens.js';
import { randomInt } from 'crypto';
import { sendSmtpMail } from '../lib/mailProvider.js';
import { sendSmsCode } from '../lib/smsProvider.js';
import { requireAuth, requireStudent, requireTeacher } from '../middleware/auth.js';
import { getPool } from '../lib/db.js';
import { validatePasswordStrength } from '../lib/passwordPolicy.js';
import { rateLimitByIpAccount } from '../middleware/securityHardening.js';

const router = Router();

const loginRateLimit = rateLimitByIpAccount({
  windowSec: 60,
  maxHits: 20,
  accountKey: (req) => String(req.body?.username || '').trim().toLowerCase(),
});

const resetCodeRateLimit = rateLimitByIpAccount({
  windowSec: 60,
  maxHits: 10,
  accountKey: (req) =>
    String(req.body?.email || req.body?.phone || req.body?.account || '')
      .trim()
      .toLowerCase(),
});

const bindCodeRateLimit = rateLimitByIpAccount({
  windowSec: 60,
  maxHits: 10,
  accountKey: (req) =>
    String(req.body?.email || req.body?.phone || req.user?.sub || '')
      .trim()
      .toLowerCase(),
});

function parsePersonalClassId(body) {
  const id = Number(String(body?.personalClassId ?? '').trim());
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function studentEnrolledInPersonalClass(studentId, classId) {
  const { rows } = await getPool().query(
    `SELECT 1 FROM teacher_personal_class_students
     WHERE teacher_personal_class_id = $1 AND student_id = $2`,
    [classId, studentId]
  );
  return rows.length > 0;
}

async function teacherOwnsPersonalClass(teacherId, classId) {
  const { rows } = await getPool().query(
    `SELECT id, name FROM teacher_personal_classes WHERE id = $1 AND teacher_id = $2`,
    [classId, teacherId]
  );
  return rows[0] || null;
}

/** 学生创世纪档案（含教学班） */
async function loadEconoverseStudentProfile(userId, personalClassId) {
  const { rows } = await query(
    `SELECT u.id, u.username, u.real_name AS "realName", u.student_no AS "studentNo", u.role, u.status,
            tpc.name AS "personalClassName"
     FROM users u
     JOIN teacher_personal_class_students tpcs
       ON tpcs.student_id = u.id AND tpcs.teacher_personal_class_id = $2
     JOIN teacher_personal_classes tpc ON tpc.id = tpcs.teacher_personal_class_id
     WHERE u.id = $1 AND u.role = 'student'`,
    [userId, personalClassId]
  );
  if (!rows.length) return null;
  const r = rows[0];
  if (r.status !== 'active') return null;
  return {
    userId: String(r.id),
    username: r.username || '',
    studentNo: r.studentNo != null ? String(r.studentNo).trim() : '',
    realName: r.realName || '',
    personalClassId: String(personalClassId),
    personalClassName: r.personalClassName || '',
    role: r.role,
  };
}

/** 教师创世纪档案（含教学班） */
async function loadEconoverseTeacherProfile(userId, personalClassId) {
  const { rows } = await query(
    `SELECT u.id, u.username, u.real_name AS "realName", u.role, u.status,
            tpc.name AS "personalClassName"
     FROM users u
     JOIN teacher_personal_classes tpc ON tpc.teacher_id = u.id AND tpc.id = $2
     WHERE u.id = $1 AND u.role = 'teacher'`,
    [userId, personalClassId]
  );
  if (!rows.length) return null;
  const r = rows[0];
  if (r.status !== 'active') return null;
  return {
    userId: String(r.id),
    username: r.username || '',
    studentNo: '',
    realName: r.realName || r.username || '',
    personalClassId: String(personalClassId),
    personalClassName: r.personalClassName || '',
    role: r.role,
  };
}

function normalizeEmail(value) {
  const s = String(value || '').trim().toLowerCase();
  if (!s) return '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return '';
  return s;
}

/** 中国大陆手机号规范化：仅保留 11 位数字 */
function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (/^1\d{10}$/.test(digits)) return digits;
  return '';
}

function genVerifyCode() {
  const n = randomInt(0, 1000000);
  return String(n).padStart(6, '0');
}

/** 按学号/工号/用户名/邮箱/手机解析账号（多匹配时取第一条，登录仍靠密码校验） */
async function findUserByLoginAccount(accountRaw) {
  const account = String(accountRaw || '').trim();
  if (!account) return null;
  const email = normalizeEmail(account);
  const phone = normalizePhone(account);
  const { rows } = await query(
    `SELECT id, username, password_hash, role, status, email, phone
     FROM users
     WHERE username = $1
        OR student_no = $1
        OR employee_no = $1
        OR ($2 <> '' AND lower(COALESCE(email, '')) = $2)
        OR ($3 <> '' AND phone = $3)
     ORDER BY id ASC
     LIMIT 2`,
    [account, email, phone]
  );
  if (!rows.length) return null;
  // 多条命中仍允许尝试密码；若密码只对其中一个正确则后续 compare 失败即 401
  return rows[0];
}

async function assertCodeCooldownOk(role, purpose, userId, { email = null, phone = null } = {}) {
  const { rows: latest } = await query(
    `SELECT id, sent_at
     FROM email_verification_codes
     WHERE role = $1 AND purpose = $2 AND user_id = $3
       AND (
         ($4::text IS NOT NULL AND email = $4)
         OR ($5::text IS NOT NULL AND phone = $5)
       )
     ORDER BY id DESC
     LIMIT 1`,
    [role, purpose, userId, email, phone]
  );
  const lastSentAt = latest[0]?.sent_at ? new Date(latest[0].sent_at).getTime() : 0;
  if (lastSentAt && Date.now() - lastSentAt < 60 * 1000) {
    const err = new Error('验证码发送过于频繁，请稍后再试');
    err.status = 429;
    err.code = 42901;
    throw err;
  }
}

async function verifyContactCode(role, purpose, userId, code, { email = null, phone = null } = {}) {
  const safeCode = String(code || '').trim();
  if (!safeCode) throw Object.assign(new Error('请输入验证码'), { status: 400, code: 40003 });
  const { rows } = await query(
    `SELECT id, code_hash, try_count
     FROM email_verification_codes
     WHERE role = $1 AND purpose = $2 AND user_id = $3
       AND used_at IS NULL AND expires_at > now()
       AND (
         ($4::text IS NOT NULL AND email = $4)
         OR ($5::text IS NOT NULL AND phone = $5)
       )
     ORDER BY id DESC
     LIMIT 1`,
    [role, purpose, userId, email, phone]
  );
  if (!rows.length) throw Object.assign(new Error('验证码无效或已过期'), { status: 400, code: 40005 });
  const row = rows[0];
  if (Number(row.try_count || 0) >= 5) {
    throw Object.assign(new Error('验证码错误次数过多，请重新获取'), { status: 400, code: 40006 });
  }
  const ok = await bcrypt.compare(safeCode, row.code_hash);
  if (!ok) {
    await query(`UPDATE email_verification_codes SET try_count = try_count + 1 WHERE id = $1`, [row.id]);
    throw Object.assign(new Error('验证码不正确'), { status: 400, code: 40007 });
  }
  await query(`UPDATE email_verification_codes SET used_at = now() WHERE id = $1`, [row.id]);
}

router.post('/login', loginRateLimit, async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ code: 40001, message: '缺少用户名或密码', data: null, traceId: req.traceId });
    }
    const u = await findUserByLoginAccount(username);
    // 账号不存在与密码错误统一文案，避免枚举；停用单独提示
    if (!u) {
      return res.status(401).json({ code: 40103, message: '用户名或密码不正确', data: null, traceId: req.traceId });
    }
    if (u.status !== 'active') {
      return res.status(403).json({ code: 40301, message: '该账号已停用', data: null, traceId: req.traceId });
    }
    const ok = await bcrypt.compare(password, u.password_hash);
    if (!ok) {
      return res.status(401).json({ code: 40103, message: '用户名或密码不正确', data: null, traceId: req.traceId });
    }
    // 仅账号+密码登录：用本次明文密码做强度检测（不得从 hash 反推）
    const strength = validatePasswordStrength(password);
    const mustChangePassword = !strength.ok;
    const user = { id: u.id, username: u.username, role: u.role };
    const tokenOpts = { mustChangePassword };
    const token = await signAccessToken(user, tokenOpts);
    const refreshToken = await signRefreshToken(user, tokenOpts);
    await query('UPDATE users SET last_login_at = now() WHERE id = $1', [u.id]);
    return res.json({
      code: 0,
      message: 'OK',
      data: {
        token,
        refreshToken,
        mustChangePassword,
        user: { id: u.id, username: u.username, role: u.role },
      },
      traceId: req.traceId,
    });
  } catch (e) {
    logError(`POST /api/auth/login traceId=${req.traceId}`, e);
    return res.status(500).json({ code: 50000, message: e.message, data: null, traceId: req.traceId });
  }
});

/** 当前登录用户基础信息（强制改密白名单） */
router.get('/me', requireAuth(), async (req, res) => {
  try {
    const id = Number(req.user?.sub);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ code: 40001, message: '无效用户', data: null, traceId: req.traceId });
    }
    const { rows } = await query(
      `SELECT id, username, real_name, role, status, email, phone FROM users WHERE id = $1`,
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ code: 40401, message: '用户不存在', data: null, traceId: req.traceId });
    }
    const u = rows[0];
    return res.json({
      code: 0,
      message: 'OK',
      data: {
        id: String(u.id),
        username: u.username,
        realName: u.real_name || '',
        role: u.role,
        status: u.status,
        email: u.email || '',
        phone: u.phone || '',
        mustChangePassword: Boolean(req.user?.mustChangePassword),
      },
      traceId: req.traceId,
    });
  } catch (e) {
    logError(`GET /api/auth/me traceId=${req.traceId}`, e);
    return res.status(500).json({ code: 50000, message: e.message, data: null, traceId: req.traceId });
  }
});

/** 强制改密场景：发送邮箱绑定验证码 */
router.post('/bind-email-code', requireAuth(), bindCodeRateLimit, async (req, res) => {
  try {
    const userId = Number(req.user?.sub);
    const role = String(req.user?.role || '').trim();
    if (!Number.isFinite(userId) || userId <= 0 || !role) {
      return res.status(400).json({ code: 40001, message: '无效用户', data: null, traceId: req.traceId });
    }
    const email = normalizeEmail(req.body?.email);
    if (!email) {
      return res.status(400).json({ code: 40002, message: '邮箱格式错误', data: null, traceId: req.traceId });
    }
    const { rows: taken } = await query(
      `SELECT id FROM users WHERE lower(COALESCE(email, '')) = $1 AND id <> $2 LIMIT 1`,
      [email, userId]
    );
    if (taken.length) {
      return res.status(400).json({ code: 40009, message: '该邮箱已被其他账号绑定', data: null, traceId: req.traceId });
    }
    await assertCodeCooldownOk(role, 'bind_email', userId, { email });
    const code = genVerifyCode();
    const codeHash = await bcrypt.hash(code, 10);
    await query(
      `INSERT INTO email_verification_codes (role, user_id, email, phone, purpose, code_hash, sent_at, expires_at)
       VALUES ($1, $2, $3, NULL, 'bind_email', $4, now(), now() + interval '10 minutes')`,
      [role, userId, email, codeHash]
    );
    await sendSmtpMail(email, {
      subject: '实训平台 · 邮箱绑定验证码',
      text: `你的验证码是 ${code}，10 分钟内有效。`,
      html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;">你的验证码是 <b style="font-size:20px;">${code}</b>，10 分钟内有效。</div>`,
    });
    return res.json({ code: 0, message: '已发送', data: { sent: true }, traceId: req.traceId });
  } catch (e) {
    if (e?.status) {
      return res.status(e.status).json({ code: e.code || 40000, message: e.message, data: null, traceId: req.traceId });
    }
    logError(`POST /api/auth/bind-email-code traceId=${req.traceId}`, e);
    return res.status(500).json({ code: 50000, message: e.message, data: null, traceId: req.traceId });
  }
});

/** 强制改密场景：发送手机绑定验证码 */
router.post('/bind-phone-code', requireAuth(), bindCodeRateLimit, async (req, res) => {
  try {
    const userId = Number(req.user?.sub);
    const role = String(req.user?.role || '').trim();
    if (!Number.isFinite(userId) || userId <= 0 || !role) {
      return res.status(400).json({ code: 40001, message: '无效用户', data: null, traceId: req.traceId });
    }
    const phone = normalizePhone(req.body?.phone);
    if (!phone) {
      return res.status(400).json({ code: 40002, message: '手机号格式错误', data: null, traceId: req.traceId });
    }
    const { rows: taken } = await query(
      `SELECT id FROM users WHERE phone = $1 AND id <> $2 LIMIT 1`,
      [phone, userId]
    );
    if (taken.length) {
      return res.status(400).json({ code: 40009, message: '该手机号已被其他账号绑定', data: null, traceId: req.traceId });
    }
    await assertCodeCooldownOk(role, 'bind_phone', userId, { phone });
    const code = genVerifyCode();
    const codeHash = await bcrypt.hash(code, 10);
    await query(
      `INSERT INTO email_verification_codes (role, user_id, email, phone, purpose, code_hash, sent_at, expires_at)
       VALUES ($1, $2, NULL, $3, 'bind_phone', $4, now(), now() + interval '10 minutes')`,
      [role, userId, phone, codeHash]
    );
    await sendSmsCode(phone, code, 'register');
    return res.json({ code: 0, message: '已发送', data: { sent: true }, traceId: req.traceId });
  } catch (e) {
    if (e?.status) {
      return res.status(e.status).json({ code: e.code || 40000, message: e.message, data: null, traceId: req.traceId });
    }
    logError(`POST /api/auth/bind-phone-code traceId=${req.traceId}`, e);
    return res.status(500).json({ code: 50000, message: e.message, data: null, traceId: req.traceId });
  }
});

/** 个人中心主动改密：向已绑定邮箱/手机发送验证码 */
router.post('/secure-code', requireAuth(), bindCodeRateLimit, async (req, res) => {
  try {
    const userId = Number(req.user?.sub);
    const role = String(req.user?.role || '').trim();
    if (!Number.isFinite(userId) || userId <= 0 || !role) {
      return res.status(400).json({ code: 40001, message: '无效用户', data: null, traceId: req.traceId });
    }
    const channel = String(req.body?.channel || '').trim().toLowerCase();
    if (channel !== 'email' && channel !== 'phone') {
      return res.status(400).json({ code: 40002, message: '请选择邮箱或手机验证', data: null, traceId: req.traceId });
    }
    const { rows } = await query(`SELECT email, phone, status FROM users WHERE id = $1`, [userId]);
    if (!rows.length || rows[0].status !== 'active') {
      return res.status(404).json({ code: 40401, message: '用户不存在或已停用', data: null, traceId: req.traceId });
    }
    const email = normalizeEmail(rows[0].email);
    const phone = normalizePhone(rows[0].phone);
    if (channel === 'email') {
      if (!email) {
        return res.status(400).json({ code: 40012, message: '请先绑定邮箱', data: null, traceId: req.traceId });
      }
      await assertCodeCooldownOk(role, 'change_password', userId, { email });
      const code = genVerifyCode();
      const codeHash = await bcrypt.hash(code, 10);
      await query(
        `INSERT INTO email_verification_codes (role, user_id, email, phone, purpose, code_hash, sent_at, expires_at)
         VALUES ($1, $2, $3, NULL, 'change_password', $4, now(), now() + interval '10 minutes')`,
        [role, userId, email, codeHash]
      );
      await sendSmtpMail(email, {
        subject: '实训平台 · 修改密码验证码',
        text: `你的验证码是 ${code}，10 分钟内有效。`,
        html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;">你的验证码是 <b style="font-size:20px;">${code}</b>，10 分钟内有效。</div>`,
      });
    } else {
      if (!phone) {
        return res.status(400).json({ code: 40012, message: '请先绑定手机号', data: null, traceId: req.traceId });
      }
      await assertCodeCooldownOk(role, 'change_password', userId, { phone });
      const code = genVerifyCode();
      const codeHash = await bcrypt.hash(code, 10);
      await query(
        `INSERT INTO email_verification_codes (role, user_id, email, phone, purpose, code_hash, sent_at, expires_at)
         VALUES ($1, $2, NULL, $3, 'change_password', $4, now(), now() + interval '10 minutes')`,
        [role, userId, phone, codeHash]
      );
      await sendSmsCode(phone, code, 'reset');
    }
    return res.json({ code: 0, message: '已发送', data: { sent: true, channel }, traceId: req.traceId });
  } catch (e) {
    if (e?.status) {
      return res.status(e.status).json({ code: e.code || 40000, message: e.message, data: null, traceId: req.traceId });
    }
    logError(`POST /api/auth/secure-code traceId=${req.traceId}`, e);
    return res.status(500).json({ code: 50000, message: e.message, data: null, traceId: req.traceId });
  }
});

/**
 * 已登录改密（全角色）：
 * - 强制改密（JWT mustChangePassword）：无需旧密码；若未绑邮箱须本次绑定邮箱（手机号可选）
 * - 主动改密：旧密码 + 已绑定邮箱/手机验证码
 */
router.post('/change-password', requireAuth(), async (req, res) => {
  try {
    const userId = Number(req.user?.sub);
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({ code: 40001, message: '无效用户', data: null, traceId: req.traceId });
    }
    const forceChange = Boolean(req.user?.mustChangePassword);
    const oldPassword = String(req.body?.oldPassword || '');
    const newPassword = String(req.body?.newPassword || '');
    const confirmPassword = String(req.body?.confirmPassword ?? req.body?.newPasswordConfirm ?? '');
    if (!forceChange && !oldPassword) {
      return res.status(400).json({ code: 40002, message: '请输入旧密码', data: null, traceId: req.traceId });
    }
    const strength = validatePasswordStrength(newPassword);
    if (!strength.ok) {
      return res.status(400).json({ code: 40020, message: strength.message, data: null, traceId: req.traceId });
    }
    if (!confirmPassword) {
      return res.status(400).json({ code: 40004, message: '请再次输入新密码', data: null, traceId: req.traceId });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ code: 40004, message: '两次输入的新密码不一致', data: null, traceId: req.traceId });
    }
    const { rows } = await query(
      `SELECT id, username, role, password_hash, status, email, phone FROM users WHERE id = $1`,
      [userId]
    );
    if (!rows.length || rows[0].status !== 'active') {
      return res.status(404).json({ code: 40401, message: '用户不存在或已停用', data: null, traceId: req.traceId });
    }
    const u = rows[0];
    if (!forceChange) {
      const okPwd = await bcrypt.compare(oldPassword, u.password_hash);
      if (!okPwd) {
        return res.status(400).json({ code: 40006, message: '旧密码不正确', data: null, traceId: req.traceId });
      }
      if (oldPassword === newPassword) {
        return res.status(400).json({ code: 40005, message: '新密码不能与旧密码相同', data: null, traceId: req.traceId });
      }
      const verifyChannel = String(req.body?.verifyChannel || '').trim().toLowerCase();
      const verifyCode = String(req.body?.verifyCode || '').trim();
      if (verifyChannel !== 'email' && verifyChannel !== 'phone') {
        return res.status(400).json({ code: 40013, message: '请选择邮箱或手机验证', data: null, traceId: req.traceId });
      }
      if (!verifyCode) {
        return res.status(400).json({ code: 40003, message: '请输入验证码', data: null, traceId: req.traceId });
      }
      const boundEmail = normalizeEmail(u.email);
      const boundPhone = normalizePhone(u.phone);
      if (verifyChannel === 'email') {
        if (!boundEmail) {
          return res.status(400).json({ code: 40012, message: '请先绑定邮箱', data: null, traceId: req.traceId });
        }
        await verifyContactCode(u.role, 'change_password', userId, verifyCode, { email: boundEmail });
      } else {
        if (!boundPhone) {
          return res.status(400).json({ code: 40012, message: '请先绑定手机号', data: null, traceId: req.traceId });
        }
        await verifyContactCode(u.role, 'change_password', userId, verifyCode, { phone: boundPhone });
      }
    } else if (oldPassword && oldPassword === newPassword) {
      return res.status(400).json({ code: 40005, message: '新密码不能与旧密码相同', data: null, traceId: req.traceId });
    }

    let nextEmail = u.email || '';
    let nextPhone = u.phone || '';
    const bindEmail = normalizeEmail(req.body?.email);
    const bindPhone = normalizePhone(req.body?.phone);
    const emailCode = String(req.body?.emailCode ?? req.body?.code ?? '').trim();
    const phoneCode = String(req.body?.phoneCode || '').trim();

    if (bindEmail) {
      const { rows: taken } = await query(
        `SELECT id FROM users WHERE lower(COALESCE(email, '')) = $1 AND id <> $2 LIMIT 1`,
        [bindEmail, userId]
      );
      if (taken.length) {
        return res.status(400).json({ code: 40009, message: '该邮箱已被其他账号绑定', data: null, traceId: req.traceId });
      }
      await verifyContactCode(u.role, 'bind_email', userId, emailCode, { email: bindEmail });
      nextEmail = bindEmail;
    }
    if (bindPhone) {
      const { rows: taken } = await query(`SELECT id FROM users WHERE phone = $1 AND id <> $2 LIMIT 1`, [
        bindPhone,
        userId,
      ]);
      if (taken.length) {
        return res.status(400).json({ code: 40009, message: '该手机号已被其他账号绑定', data: null, traceId: req.traceId });
      }
      await verifyContactCode(u.role, 'bind_phone', userId, phoneCode, { phone: bindPhone });
      nextPhone = bindPhone;
    }

    // 强制改密：账号尚无邮箱时必须本次绑定邮箱；手机号可选
    const hadEmail = Boolean(normalizeEmail(u.email));
    if (forceChange && !hadEmail && !nextEmail) {
      return res.status(400).json({
        code: 40011,
        message: '请绑定邮箱',
        data: null,
        traceId: req.traceId,
      });
    }

    const password_hash = await bcrypt.hash(newPassword, 10);
    await query(
      `UPDATE users
       SET password_hash = $1,
           email = COALESCE(NULLIF($2, ''), email),
           phone = COALESCE(NULLIF($3, ''), phone),
           updated_at = now()
       WHERE id = $4`,
      [password_hash, nextEmail, nextPhone, userId]
    );
    const fresh = { id: u.id, username: u.username, role: u.role };
    const token = await signAccessToken(fresh, { mustChangePassword: false });
    const refreshToken = await signRefreshToken(fresh, { mustChangePassword: false });
    return res.json({
      code: 0,
      message: '密码已更新',
      data: { saved: true, token, refreshToken, mustChangePassword: false },
      traceId: req.traceId,
    });
  } catch (e) {
    if (e?.status) {
      return res.status(e.status).json({ code: e.code || 40000, message: e.message, data: null, traceId: req.traceId });
    }
    logError(`POST /api/auth/change-password traceId=${req.traceId}`, e);
    return res.status(500).json({ code: 50000, message: e.message, data: null, traceId: req.traceId });
  }
});

router.post('/password-reset/code', resetCodeRateLimit, async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const phone = normalizePhone(req.body?.phone || (!email ? req.body?.account : ''));
    if (!email && !phone) {
      return res.status(400).json({ code: 40001, message: '请填写邮箱或手机号', data: null, traceId: req.traceId });
    }
    const { rows } = await query(
      email
        ? `SELECT id, role
           FROM users
           WHERE role IN ('student', 'teacher') AND lower(COALESCE(email, '')) = $1 AND status = 'active'
           ORDER BY CASE role WHEN 'teacher' THEN 1 ELSE 2 END, id ASC
           LIMIT 2`
        : `SELECT id, role
           FROM users
           WHERE role IN ('student', 'teacher') AND phone = $1 AND status = 'active'
           ORDER BY CASE role WHEN 'teacher' THEN 1 ELSE 2 END, id ASC
           LIMIT 2`,
      [email || phone]
    );
    if (!rows.length) {
      return res.status(404).json({
        code: 40401,
        message: email ? '当前邮箱不存在' : '当前手机号不存在',
        data: null,
        traceId: req.traceId,
      });
    }
    if (rows.length > 1) {
      return res.status(400).json({
        code: 40008,
        message: email ? '该邮箱对应多个账号，请联系管理员处理' : '该手机号对应多个账号，请联系管理员处理',
        data: null,
        traceId: req.traceId,
      });
    }
    const userId = rows[0].id;
    const role = String(rows[0].role || '').trim();
    await assertCodeCooldownOk(role, 'reset_password', userId, { email: email || null, phone: phone || null });
    const code = genVerifyCode();
    const codeHash = await bcrypt.hash(code, 10);
    await query(
      `INSERT INTO email_verification_codes (role, user_id, email, phone, purpose, code_hash, sent_at, expires_at)
       VALUES ($1, $2, $3, $4, 'reset_password', $5, now(), now() + interval '10 minutes')`,
      [role, userId, email || null, phone || null, codeHash]
    );
    if (email) {
      await sendSmtpMail(email, {
        subject: '实训平台 · 重置密码验证码',
        text: `你的验证码是 ${code}，10 分钟内有效。`,
        html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;">你的验证码是 <b style="font-size:20px;">${code}</b>，10 分钟内有效。</div>`,
      });
    } else {
      await sendSmsCode(phone, code, 'reset');
    }
    return res.json({ code: 0, message: '已发送', data: { sent: true, channel: email ? 'email' : 'phone' }, traceId: req.traceId });
  } catch (e) {
    if (e?.status) {
      return res.status(e.status).json({ code: e.code || 40000, message: e.message, data: null, traceId: req.traceId });
    }
    logError(`POST /api/auth/password-reset/code traceId=${req.traceId}`, e);
    return res.status(500).json({ code: 50000, message: e.message, data: null, traceId: req.traceId });
  }
});

router.post('/password-reset/confirm', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const phone = normalizePhone(req.body?.phone || (!email ? req.body?.account : ''));
    const code = String(req.body?.code || '').trim();
    const newPassword = String(req.body?.newPassword || '');
    if (!email && !phone) {
      return res.status(400).json({ code: 40001, message: '请填写邮箱或手机号', data: null, traceId: req.traceId });
    }
    if (!code) return res.status(400).json({ code: 40003, message: '请输入验证码', data: null, traceId: req.traceId });
    if (!newPassword) {
      return res.status(400).json({ code: 40004, message: '请输入新密码', data: null, traceId: req.traceId });
    }
    const strength = validatePasswordStrength(newPassword);
    if (!strength.ok) {
      return res.status(400).json({ code: 40020, message: strength.message, data: null, traceId: req.traceId });
    }
    const { rows } = await query(
      email
        ? `SELECT id, role
           FROM users
           WHERE role IN ('student', 'teacher') AND lower(COALESCE(email, '')) = $1 AND status = 'active'
           ORDER BY CASE role WHEN 'teacher' THEN 1 ELSE 2 END, id ASC
           LIMIT 2`
        : `SELECT id, role
           FROM users
           WHERE role IN ('student', 'teacher') AND phone = $1 AND status = 'active'
           ORDER BY CASE role WHEN 'teacher' THEN 1 ELSE 2 END, id ASC
           LIMIT 2`,
      [email || phone]
    );
    if (!rows.length) {
      return res.status(404).json({
        code: 40401,
        message: email ? '当前邮箱不存在' : '当前手机号不存在',
        data: null,
        traceId: req.traceId,
      });
    }
    if (rows.length > 1) {
      return res.status(400).json({
        code: 40008,
        message: email ? '该邮箱对应多个账号，请联系管理员处理' : '该手机号对应多个账号，请联系管理员处理',
        data: null,
        traceId: req.traceId,
      });
    }
    const userId = rows[0].id;
    const role = String(rows[0].role || '').trim();
    await verifyContactCode(role, 'reset_password', userId, code, {
      email: email || null,
      phone: phone || null,
    });
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await query(`UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2 AND role = $3`, [
      passwordHash,
      userId,
      role,
    ]);
    return res.json({ code: 0, message: '已重置', data: { saved: true }, traceId: req.traceId });
  } catch (e) {
    if (e?.status) {
      return res.status(e.status).json({ code: e.code || 40000, message: e.message, data: null, traceId: req.traceId });
    }
    logError(`POST /api/auth/password-reset/confirm traceId=${req.traceId}`, e);
    return res.status(500).json({ code: 50000, message: e.message, data: null, traceId: req.traceId });
  }
});

/** 已登录学生签发创世纪跨站 hop（须指定已加入的教学班） */
router.post('/econoverse-ticket', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const userId = Number(String(req.user?.sub || '').trim());
    const personalClassId = parsePersonalClassId(req.body);
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({ code: 40001, message: '无效用户', data: null, traceId: req.traceId });
    }
    if (!personalClassId) {
      return res.status(400).json({ code: 40002, message: '缺少 personalClassId', data: null, traceId: req.traceId });
    }
    if (!(await studentEnrolledInPersonalClass(userId, personalClassId))) {
      return res.status(403).json({ code: 40301, message: '未加入该教学班', data: null, traceId: req.traceId });
    }
    const { rows } = await query(
      `SELECT id, username, role, status FROM users WHERE id = $1 AND role = 'student'`,
      [userId]
    );
    if (!rows.length || rows[0].status !== 'active') {
      return res.status(401).json({ code: 40102, message: '账号不可用', data: null, traceId: req.traceId });
    }
    const u = rows[0];
    const { ticket, expiresIn } = await signEconoverseHopTicket(
      { id: u.id, username: u.username, role: u.role },
      { typ: 'econoverse_jump', personalClassId }
    );
    return res.json({
      code: 0,
      message: 'OK',
      data: { ticket, expiresIn, personalClassId: String(personalClassId) },
      traceId: req.traceId,
    });
  } catch (e) {
    logError(`POST /api/auth/econoverse-ticket traceId=${req.traceId}`, e);
    return res.status(500).json({ code: 50000, message: e.message, data: null, traceId: req.traceId });
  }
});

/** 已登录教师签发创世纪管理后台 hop */
router.post('/econoverse-admin-ticket', requireAuth(), requireTeacher(), async (req, res) => {
  try {
    const userId = Number(String(req.user?.sub || '').trim());
    const personalClassId = parsePersonalClassId(req.body);
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({ code: 40001, message: '无效用户', data: null, traceId: req.traceId });
    }
    if (!personalClassId) {
      return res.status(400).json({ code: 40002, message: '缺少 personalClassId', data: null, traceId: req.traceId });
    }
    const owned = await teacherOwnsPersonalClass(userId, personalClassId);
    if (!owned) {
      return res.status(403).json({ code: 40301, message: '无权管理该教学班', data: null, traceId: req.traceId });
    }
    const { rows } = await query(
      `SELECT id, username, role, status FROM users WHERE id = $1 AND role = 'teacher'`,
      [userId]
    );
    if (!rows.length || rows[0].status !== 'active') {
      return res.status(401).json({ code: 40102, message: '账号不可用', data: null, traceId: req.traceId });
    }
    const u = rows[0];
    const { ticket, expiresIn } = await signEconoverseHopTicket(
      { id: u.id, username: u.username, role: u.role },
      { typ: 'econoverse_admin_jump', personalClassId }
    );
    return res.json({
      code: 0,
      message: 'OK',
      data: { ticket, expiresIn, personalClassId: String(personalClassId) },
      traceId: req.traceId,
    });
  } catch (e) {
    logError(`POST /api/auth/econoverse-admin-ticket traceId=${req.traceId}`, e);
    return res.status(500).json({ code: 50000, message: e.message, data: null, traceId: req.traceId });
  }
});

/**
 * 兑换 hop 为游戏会话（access + refresh）与用户档案。
 */
router.post('/econoverse-ticket/exchange', async (req, res) => {
  try {
    const ticket = typeof req.body?.ticket === 'string' ? req.body.ticket.trim() : '';
    if (!ticket) {
      return res.status(400).json({ code: 40001, message: '缺少 ticket', data: null, traceId: req.traceId });
    }
    const hopped = await verifyAndConsumeEconoverseHopTicket(ticket);
    if (!hopped) {
      return res.status(401).json({ code: 40102, message: '跳转已失效，请从嘉大实训重新进入', data: null, traceId: req.traceId });
    }
    const classId = Number(hopped.personalClassId);
    let profile = null;
    if (hopped.typ === 'econoverse_jump') {
      profile = await loadEconoverseStudentProfile(hopped.id, classId);
    } else if (hopped.typ === 'econoverse_admin_jump') {
      profile = await loadEconoverseTeacherProfile(hopped.id, classId);
    }
    if (!profile) {
      return res.status(401).json({ code: 40102, message: '账号或班级不可用', data: null, traceId: req.traceId });
    }
    const fresh = { id: profile.userId, username: profile.username, role: profile.role };
    const token = await signAccessToken(fresh);
    const refreshToken = await signRefreshToken(fresh);
    return res.json({
      code: 0,
      message: 'OK',
      data: {
        token,
        refreshToken,
        user: profile,
        hopTyp: hopped.typ,
      },
      traceId: req.traceId,
    });
  } catch (e) {
    logError(`POST /api/auth/econoverse-ticket/exchange traceId=${req.traceId}`, e);
    return res.status(500).json({ code: 50000, message: e.message, data: null, traceId: req.traceId });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const refreshToken =
      typeof req.body?.refreshToken === 'string' ? req.body.refreshToken.trim() : '';
    if (!refreshToken) {
      return res.status(400).json({ code: 40001, message: '缺少 refreshToken', data: null, traceId: req.traceId });
    }
    const user = await verifyAndRevokeRefreshToken(refreshToken);
    if (!user) {
      return res.status(401).json({ code: 40102, message: '刷新令牌无效或已过期', data: null, traceId: req.traceId });
    }
    const { rows } = await query(`SELECT id, username, role, status FROM users WHERE id = $1`, [user.id]);
    if (!rows.length || rows[0].status !== 'active') {
      return res.status(401).json({ code: 40102, message: '账号不可用', data: null, traceId: req.traceId });
    }
    const u = rows[0];
    const mustChangePassword = Boolean(user.mustChangePassword);
    const fresh = { id: u.id, username: u.username, role: u.role };
    const tokenOpts = { mustChangePassword };
    const token = await signAccessToken(fresh, tokenOpts);
    const newRefreshToken = await signRefreshToken(fresh, tokenOpts);
    return res.json({
      code: 0,
      message: 'OK',
      data: { token, refreshToken: newRefreshToken, mustChangePassword },
      traceId: req.traceId,
    });
  } catch (e) {
    logError(`POST /api/auth/refresh traceId=${req.traceId}`, e);
    return res.status(500).json({ code: 50000, message: e.message, data: null, traceId: req.traceId });
  }
});

export default router;
