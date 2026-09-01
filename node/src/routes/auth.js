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
import { requireAuth, requireStudent } from '../middleware/auth.js';

const router = Router();

/** 组装创世纪跳转后给游戏用的学生档案 */
async function loadEconoverseProfile(userId) {
  const { rows } = await query(
    `SELECT u.id, u.username, u.real_name AS "realName", u.student_no AS "studentNo", u.role, u.status,
            cls.name AS "className",
            COALESCE(col_u.name, col_c.name) AS "collegeName"
     FROM users u
     LEFT JOIN colleges col_u ON col_u.id = CASE
         WHEN trim(COALESCE(u.department, '')) ~ '^[0-9]+$' THEN trim(u.department)::bigint
         ELSE NULL
       END
     LEFT JOIN LATERAL (
       SELECT c.id, c.name, c.college_id
       FROM class_students cs
       JOIN classes c ON c.id = cs.class_id
       WHERE cs.student_id = u.id
       ORDER BY cs.joined_at DESC, cs.id DESC
       LIMIT 1
     ) cls ON (true)
     LEFT JOIN colleges col_c ON col_c.id = cls.college_id
     WHERE u.id = $1 AND u.role = 'student'`,
    [userId]
  );
  if (!rows.length) return null;
  const r = rows[0];
  if (r.status !== 'active') return null;
  return {
    userId: String(r.id),
    username: r.username || '',
    studentNo: r.studentNo != null ? String(r.studentNo).trim() : '',
    realName: r.realName || '',
    className: r.className || '',
    collegeName: r.collegeName || '',
    role: r.role,
  };
}

function normalizeEmail(value) {
  const s = String(value || '').trim().toLowerCase();
  if (!s) return '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return '';
  return s;
}

function genEmailCode() {
  const n = randomInt(0, 1000000);
  return String(n).padStart(6, '0');
}

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ code: 40001, message: '缺少用户名或密码', data: null, traceId: req.traceId });
    }
    const { rows } = await query(
      `SELECT id, username, password_hash, role, status FROM users WHERE username = $1`,
      [username]
    );
    if (!rows.length || rows[0].status !== 'active') {
      return res.status(401).json({ code: 40103, message: '账号或密码错误', data: null, traceId: req.traceId });
    }
    const u = rows[0];
    const ok = await bcrypt.compare(password, u.password_hash);
    if (!ok) {
      return res.status(401).json({ code: 40103, message: '账号或密码错误', data: null, traceId: req.traceId });
    }
    const user = { id: u.id, username: u.username, role: u.role };
    const token = await signAccessToken(user);
    const refreshToken = await signRefreshToken(user);
    await query('UPDATE users SET last_login_at = now() WHERE id = $1', [u.id]);
    return res.json({
      code: 0,
      message: 'OK',
      data: {
        token,
        refreshToken,
        user: { id: u.id, username: u.username, role: u.role },
      },
      traceId: req.traceId,
    });
  } catch (e) {
    logError(`POST /api/auth/login traceId=${req.traceId}`, e);
    return res.status(500).json({ code: 50000, message: e.message, data: null, traceId: req.traceId });
  }
});

router.post('/password-reset/code', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!email) {
      return res.status(400).json({ code: 40001, message: '邮箱格式错误', data: null, traceId: req.traceId });
    }
    const { rows } = await query(
      `SELECT id, role
       FROM users
       WHERE role IN ('student', 'teacher') AND email = $1 AND status = 'active'
       ORDER BY CASE role WHEN 'teacher' THEN 1 ELSE 2 END, id ASC
       LIMIT 2`,
      [email]
    );
    if (!rows.length) {
      return res.status(404).json({ code: 40401, message: '当前邮箱不存在', data: null, traceId: req.traceId });
    }
    if (rows.length > 1) {
      return res.status(400).json({ code: 40008, message: '该邮箱对应多个账号，请联系管理员处理', data: null, traceId: req.traceId });
    }
    const userId = rows[0].id;
    const role = String(rows[0].role || '').trim();
    const { rows: latest } = await query(
      `SELECT id, sent_at
       FROM email_verification_codes
       WHERE role = $1 AND purpose = 'reset_password' AND user_id = $2 AND email = $3
       ORDER BY id DESC
       LIMIT 1`,
      [role, userId, email]
    );
    const lastSentAt = latest[0]?.sent_at ? new Date(latest[0].sent_at).getTime() : 0;
    if (lastSentAt && Date.now() - lastSentAt < 60 * 1000) {
      return res.status(429).json({ code: 42901, message: '验证码发送过于频繁，请稍后再试', data: null, traceId: req.traceId });
    }
    const code = genEmailCode();
    const codeHash = await bcrypt.hash(code, 10);
    await query(
      `INSERT INTO email_verification_codes (role, user_id, email, purpose, code_hash, sent_at, expires_at)
       VALUES ($1, $2, $3, 'reset_password', $4, now(), now() + interval '10 minutes')`,
      [role, userId, email, codeHash]
    );
    await sendSmtpMail(email, {
      subject: '实训平台 · 重置密码验证码',
      text: `你的验证码是 ${code}，10 分钟内有效。`,
      html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;">你的验证码是 <b style="font-size:20px;">${code}</b>，10 分钟内有效。</div>`,
    });
    return res.json({ code: 0, message: '已发送', data: { sent: true }, traceId: req.traceId });
  } catch (e) {
    logError(`POST /api/auth/password-reset/code traceId=${req.traceId}`, e);
    return res.status(500).json({ code: 50000, message: e.message, data: null, traceId: req.traceId });
  }
});

router.post('/password-reset/confirm', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const code = String(req.body?.code || '').trim();
    const newPassword = String(req.body?.newPassword || '');
    if (!email) return res.status(400).json({ code: 40001, message: '邮箱格式错误', data: null, traceId: req.traceId });
    if (!code) return res.status(400).json({ code: 40003, message: '请输入验证码', data: null, traceId: req.traceId });
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ code: 40004, message: '新密码至少 6 位', data: null, traceId: req.traceId });
    }
    const { rows } = await query(
      `SELECT id, role
       FROM users
       WHERE role IN ('student', 'teacher') AND email = $1 AND status = 'active'
       ORDER BY CASE role WHEN 'teacher' THEN 1 ELSE 2 END, id ASC
       LIMIT 2`,
      [email]
    );
    if (!rows.length) {
      return res.status(404).json({ code: 40401, message: '当前邮箱不存在', data: null, traceId: req.traceId });
    }
    if (rows.length > 1) {
      return res.status(400).json({ code: 40008, message: '该邮箱对应多个账号，请联系管理员处理', data: null, traceId: req.traceId });
    }
    const userId = rows[0].id;
    const role = String(rows[0].role || '').trim();
    const { rows: codes } = await query(
      `SELECT id, code_hash, try_count
       FROM email_verification_codes
       WHERE role = $1 AND purpose = 'reset_password' AND user_id = $2 AND email = $3
         AND used_at IS NULL AND expires_at > now()
       ORDER BY id DESC
       LIMIT 1`,
      [role, userId, email]
    );
    if (!codes.length) {
      return res.status(400).json({ code: 40005, message: '验证码无效或已过期', data: null, traceId: req.traceId });
    }
    const row = codes[0];
    const tryCount = Number(row.try_count || 0);
    if (tryCount >= 5) {
      return res.status(400).json({ code: 40006, message: '验证码错误次数过多，请重新获取', data: null, traceId: req.traceId });
    }
    const ok = await bcrypt.compare(code, row.code_hash);
    if (!ok) {
      await query(`UPDATE email_verification_codes SET try_count = try_count + 1 WHERE id = $1`, [row.id]);
      return res.status(400).json({ code: 40007, message: '验证码不正确', data: null, traceId: req.traceId });
    }
    await query(`UPDATE email_verification_codes SET used_at = now() WHERE id = $1`, [row.id]);
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await query(`UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2 AND role = $3`, [
      passwordHash,
      userId,
      role,
    ]);
    return res.json({ code: 0, message: '已重置', data: { saved: true }, traceId: req.traceId });
  } catch (e) {
    logError(`POST /api/auth/password-reset/confirm traceId=${req.traceId}`, e);
    return res.status(500).json({ code: 50000, message: e.message, data: null, traceId: req.traceId });
  }
});

/** 已登录学生签发创世纪跨站 hop（可反复点击） */
router.post('/econoverse-ticket', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const userId = Number(String(req.user?.sub || '').trim());
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({ code: 40001, message: '无效用户', data: null, traceId: req.traceId });
    }
    const { rows } = await query(
      `SELECT id, username, role, status FROM users WHERE id = $1 AND role = 'student'`,
      [userId]
    );
    if (!rows.length || rows[0].status !== 'active') {
      return res.status(401).json({ code: 40102, message: '账号不可用', data: null, traceId: req.traceId });
    }
    const u = rows[0];
    const { ticket, expiresIn } = await signEconoverseHopTicket({
      id: u.id,
      username: u.username,
      role: u.role,
    });
    return res.json({
      code: 0,
      message: 'OK',
      data: { ticket, expiresIn },
      traceId: req.traceId,
    });
  } catch (e) {
    logError(`POST /api/auth/econoverse-ticket traceId=${req.traceId}`, e);
    return res.status(500).json({ code: 50000, message: e.message, data: null, traceId: req.traceId });
  }
});

/**
 * 兑换 hop 为游戏会话（access + refresh）与学生档案。
 * hop 消费后不可复用；学生绑定与云档不受影响。
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
    const profile = await loadEconoverseProfile(hopped.id);
    if (!profile) {
      return res.status(401).json({ code: 40102, message: '账号不可用', data: null, traceId: req.traceId });
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
    const fresh = { id: u.id, username: u.username, role: u.role };
    const token = await signAccessToken(fresh);
    const newRefreshToken = await signRefreshToken(fresh);
    return res.json({
      code: 0,
      message: 'OK',
      data: { token, refreshToken: newRefreshToken },
      traceId: req.traceId,
    });
  } catch (e) {
    logError(`POST /api/auth/refresh traceId=${req.traceId}`, e);
    return res.status(500).json({ code: 50000, message: e.message, data: null, traceId: req.traceId });
  }
});

export default router;
