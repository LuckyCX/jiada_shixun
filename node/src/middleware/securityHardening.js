import { getRedis } from '../lib/redis.js';
import { logError } from '../lib/logError.js';

/** 扫描器常打的假路径（不含本系统真实 /admin、/api 业务入口） */
const HONEYPOT_EXACT = new Set(
  [
    '/wp-admin',
    '/wp-login.php',
    '/phpmyadmin',
    '/actuator',
    '/swagger-ui',
    '/swagger-ui.html',
    '/druid',
    '/.env',
    '/.git',
    '/.git/config',
    '/server-status',
    '/xmlrpc.php',
    '/manager/html',
    '/console',
    '/solr',
    '/jenkins',
  ].map((p) => p.toLowerCase())
);

const HONEYPOT_PREFIX = ['/wp-admin/', '/phpmyadmin/', '/actuator/', '/.git/', '/druid/', '/swagger/'];

function clientIp(req) {
  const xf = String(req.headers['x-forwarded-for'] || '')
    .split(',')[0]
    .trim();
  return xf || req.socket?.remoteAddress || '';
}

function normalizePathname(rawPath) {
  let p = String(rawPath || '/');
  try {
    p = decodeURIComponent(p);
  } catch {
    return { ok: false, reason: 'bad_encoding' };
  }
  if (p.includes('\0') || p.includes('%00') || p.includes('\\')) {
    return { ok: false, reason: 'illegal_char' };
  }
  if (p.length > 512) return { ok: false, reason: 'too_long' };
  // 合并 //
  p = p.replace(/\/{2,}/g, '/');
  if (p.includes('..')) return { ok: false, reason: 'dotdot' };
  if (!p.startsWith('/')) p = `/${p}`;
  return { ok: true, path: p };
}

function isHoneypotPath(pathname) {
  const lower = pathname.toLowerCase();
  if (HONEYPOT_EXACT.has(lower)) return true;
  return HONEYPOT_PREFIX.some((pre) => lower.startsWith(pre));
}

function writeSecurityHit(req, kind, path) {
  const line = JSON.stringify({
    kind,
    ip: clientIp(req),
    path,
    ua: String(req.headers['user-agent'] || '').slice(0, 300),
    at: new Date().toISOString(),
  });
  // 安全命中单独输出，便于运维采集；不暴露规则名给客户端
  console.warn(`[security] ${line}`);
}

/**
 * URI 规范化 + 蜜罐假路径 302 / + 基础安全响应头
 */
export function securityHardening() {
  return (req, res, next) => {
    res.removeHeader('X-Powered-By');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    const rawUrl = req.originalUrl || req.url || '/';
    const qIdx = rawUrl.indexOf('?');
    const rawPath = qIdx >= 0 ? rawUrl.slice(0, qIdx) : rawUrl;
    const query = qIdx >= 0 ? rawUrl.slice(qIdx) : '';

    const norm = normalizePathname(rawPath);
    if (!norm.ok) {
      writeSecurityHit(req, 'uri_reject', rawPath);
      return res.redirect(302, '/');
    }

    if (isHoneypotPath(norm.path)) {
      writeSecurityHit(req, 'honeypot', norm.path);
      return res.redirect(302, '/');
    }

    // 开放重定向参数：非法值直接拒绝对外跳转意图（302 回首页）
    if (query) {
      try {
        const params = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query);
        for (const key of ['redirect', 'next', 'returnUrl', 'url', 'callback']) {
          if (!params.has(key)) continue;
          const raw = params.get(key);
          if (raw && !sanitizeInternalRedirect(raw)) {
            writeSecurityHit(req, 'open_redirect', `${norm.path}?${key}=…`);
            return res.redirect(302, '/');
          }
        }
      } catch {
        /* ignore */
      }
    }

    if (norm.path !== rawPath) {
      req.url = norm.path + query;
      req.originalUrl = norm.path + query;
    }
    next();
  };
}

/**
 * 开放重定向参数校验：仅允许以 / 开头的站内相对路径
 * @param {unknown} raw
 * @returns {string} 安全路径或空串
 */
export function sanitizeInternalRedirect(raw) {
  const s = raw == null ? '' : String(raw).trim();
  if (!s) return '';
  if (!s.startsWith('/')) return '';
  if (s.startsWith('//')) return '';
  const lower = s.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:')) return '';
  if (s.includes('\\') || s.includes('\0')) return '';
  return s;
}

/**
 * 登录 / 验证码发送限流：IP + 账号维度
 * @param {{ windowSec?: number, maxHits?: number, accountKey?: (req)=>string }} opts
 */
export function rateLimitByIpAccount(opts = {}) {
  const windowSec = opts.windowSec ?? 60;
  const maxHits = opts.maxHits ?? 20;
  const accountKeyFn =
    opts.accountKey ||
    ((req) => String(req.body?.username || req.body?.email || req.body?.phone || '').trim().toLowerCase());

  return async (req, res, next) => {
    try {
      const ip = clientIp(req) || 'unknown';
      const account = accountKeyFn(req) || '-';
      const key = `rl:auth:${ip}:${account}`;
      const r = getRedis();
      const n = await r.incr(key);
      if (n === 1) await r.expire(key, windowSec);
      if (n > maxHits) {
        writeSecurityHit(req, 'rate_limit', req.path);
        return res.status(429).json({
          code: 42901,
          message: '请求过于频繁，请稍后再试',
          data: null,
          traceId: req.traceId,
        });
      }
      next();
    } catch (e) {
      // Redis 异常时不阻断登录，仅记日志
      logError('rateLimitByIpAccount', e);
      next();
    }
  };
}
