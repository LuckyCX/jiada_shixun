import { getConfigValue } from './systemConfig.js';

function normalizeOrigin(raw) {
  const s = String(raw || '').trim().replace(/\/$/, '');
  if (!s) return '';
  try {
    const u = new URL(s.includes('://') ? s : `https://${s}`);
    return u.origin;
  } catch {
    return '';
  }
}

function isLoopbackHost(hostname) {
  const h = String(hostname || '').toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
}

function originFromForwarded(req) {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '')
    .split(',')[0]
    .trim();
  if (!host || isLoopbackHost(host.split(':')[0])) return '';
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  return normalizeOrigin(`${proto}://${host}`);
}

/** 对外分享链接用的站点根地址（问卷二维码等） */
export async function resolvePublicWebOrigin(req) {
  const site = await getConfigValue('site', false);
  const fromSite =
    site && typeof site === 'object' ? normalizeOrigin(site.publicBaseUrl) : '';
  if (fromSite) return fromSite;

  const fromEnv = normalizeOrigin(process.env.PUBLIC_WEB_ORIGIN);
  if (fromEnv) return fromEnv;

  const forwarded = originFromForwarded(req);
  if (forwarded) return forwarded;

  const origin = normalizeOrigin(req.headers?.origin);
  if (origin && !isLoopbackHost(new URL(origin).hostname)) return origin;

  if (origin) return origin;
  return normalizeOrigin(process.env.PUBLIC_WEB_ORIGIN) || 'http://localhost:5173';
}
