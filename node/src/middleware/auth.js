import jwt from 'jsonwebtoken';
import { getConfigValue } from '../lib/systemConfig.js';
import { maybeRenewAccessToken } from '../lib/authTokens.js';

async function getJwtSecret() {
  const sec = await getConfigValue('security');
  const s = sec && typeof sec === 'object' && sec.jwt && sec.jwt.secret;
  if (!s || typeof s !== 'string') {
    throw new Error('JWT secret missing in system_config.security.jwt.secret');
  }
  return s;
}

/** mustChangePassword=true 时允许访问的路径（其余业务 API 403） */
const MUST_CHANGE_PASSWORD_ALLOW = [
  { method: 'POST', path: '/api/auth/change-password' },
  { method: 'POST', path: '/api/auth/refresh' },
  { method: 'POST', path: '/api/auth/bind-email-code' },
  { method: 'POST', path: '/api/auth/bind-phone-code' },
  { method: 'POST', path: '/api/admin/me/password' },
  { method: 'PATCH', path: '/api/student/me' },
  { method: 'PATCH', path: '/api/teacher/me' },
  { method: 'GET', path: '/api/auth/me' },
  // 入班校验：弱口令学生须先确认能进入学生中心，再强制改密
  { method: 'GET', path: '/api/student/personal-class-enrollments' },
];

function isMustChangePasswordAllowed(req) {
  const method = String(req.method || 'GET').toUpperCase();
  // 兼容 X-HTTP-Method-Override
  const override = String(req.headers['x-http-method-override'] || '').toUpperCase();
  const eff = override || method;
  const path = String(req.originalUrl || req.url || '').split('?')[0];
  return MUST_CHANGE_PASSWORD_ALLOW.some((r) => r.method === eff && path === r.path);
}

export function requireAuth() {
  return async (req, res, next) => {
    try {
      const h = req.headers.authorization;
      if (!h || !h.startsWith('Bearer ')) {
        return res.status(401).json({ code: 40101, message: '未登录', data: null, traceId: req.traceId });
      }
      const token = h.slice(7);
      const secret = await getJwtSecret();
      const payload = jwt.verify(token, secret);
      req.user = payload;

      // 弱口令强制改密：除白名单外拒绝业务 API
      if (payload.mustChangePassword === true && !isMustChangePasswordAllowed(req)) {
        return res.status(403).json({
          code: 40310,
          message: '密码强度过低，请修改密码后再使用系统',
          data: { mustChangePassword: true },
          traceId: req.traceId,
        });
      }

      // 活跃续期：间隔满足时下发新 access token，前端替换本地存储
      try {
        const renewed = await maybeRenewAccessToken(payload);
        if (renewed) {
          res.setHeader('X-Access-Token', renewed);
        }
      } catch {
        /* 续期失败不影响本次请求 */
      }

      next();
    } catch (e) {
      if (e.name === 'JsonWebTokenError' || e.name === 'TokenExpiredError') {
        return res.status(401).json({
          code: 40102,
          message: '令牌无效或已过期',
          data: null,
          traceId: req.traceId,
        });
      }
      return res.status(500).json({ code: 50001, message: e.message, data: null, traceId: req.traceId });
    }
  };
}

export function requireAdmin() {
  return (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ code: 40301, message: '需要管理员权限', data: null, traceId: req.traceId });
    }
    next();
  };
}

export function requireTeacher() {
  return (req, res, next) => {
    if (!req.user || req.user.role !== 'teacher') {
      return res.status(403).json({ code: 40302, message: '需要教师权限', data: null, traceId: req.traceId });
    }
    next();
  };
}

export function requireStudent() {
  return (req, res, next) => {
    if (!req.user || req.user.role !== 'student') {
      return res.status(403).json({ code: 40303, message: '需要学生权限', data: null, traceId: req.traceId });
    }
    next();
  };
}

export { getJwtSecret };
