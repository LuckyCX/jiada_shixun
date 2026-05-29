import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../lib/db.js';
import { logError } from '../lib/logError.js';
import { signAccessToken, signRefreshToken, verifyAndRevokeRefreshToken } from '../lib/authTokens.js';
import { randomInt } from 'crypto';
import { sendSmtpMail } from '../lib/mailProvider.js';

const router = Router();

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
