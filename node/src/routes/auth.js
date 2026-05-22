import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../lib/db.js';
import { logError } from '../lib/logError.js';
import { signAccessToken, signRefreshToken, verifyAndRevokeRefreshToken } from '../lib/authTokens.js';

const router = Router();

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
