import jwt from 'jsonwebtoken';
import { getConfigValue } from '../lib/systemConfig.js';

async function getJwtSecret() {
  const sec = await getConfigValue('security');
  const s = sec && typeof sec === 'object' && sec.jwt && sec.jwt.secret;
  if (!s || typeof s !== 'string') {
    throw new Error('JWT secret missing in system_config.security.jwt.secret');
  }
  return s;
}

export function requireAuth() {
  return async (req, res, next) => {
    try {
      const h = req.headers.authorization;
      if (!h || !h.startsWith('Bearer ')) {
        return res.status(401).json({ code: 40101, message: '未登录', data: null });
      }
      const token = h.slice(7);
      const secret = await getJwtSecret();
      const payload = jwt.verify(token, secret);
      req.user = payload;
      next();
    } catch (e) {
      if (e.name === 'JsonWebTokenError' || e.name === 'TokenExpiredError') {
        return res.status(401).json({ code: 40102, message: '令牌无效或已过期', data: null });
      }
      return res.status(500).json({ code: 50001, message: e.message, data: null });
    }
  };
}

export function requireAdmin() {
  return (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ code: 40301, message: '需要管理员权限', data: null });
    }
    next();
  };
}

export function requireTeacher() {
  return (req, res, next) => {
    if (!req.user || req.user.role !== 'teacher') {
      return res.status(403).json({ code: 40302, message: '需要教师权限', data: null });
    }
    next();
  };
}

export function requireStudent() {
  return (req, res, next) => {
    if (!req.user || req.user.role !== 'student') {
      return res.status(403).json({ code: 40303, message: '需要学生权限', data: null });
    }
    next();
  };
}

export { getJwtSecret };
