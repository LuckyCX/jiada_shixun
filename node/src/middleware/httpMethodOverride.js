/**
 * 教室 360 / 部分校园网代理会拦截 PUT、PATCH、DELETE，浏览器表现为 Failed to fetch。
 * 前端将这些方法改为 POST，并携带 X-HTTP-Method-Override；本中间件还原真实方法后再进路由。
 */
const ALLOWED = new Set(['PUT', 'PATCH', 'DELETE']);

export function httpMethodOverride(req, _res, next) {
  if (String(req.method || '').toUpperCase() !== 'POST') return next();

  const headerRaw = req.headers['x-http-method-override'] || req.headers['x-method-override'];
  const bodyRaw =
    req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body._method : null;
  const raw = String(headerRaw || bodyRaw || '')
    .trim()
    .toUpperCase();
  if (!ALLOWED.has(raw)) return next();

  req.method = raw;
  // 避免业务误把 _method 当业务字段
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body) && '_method' in req.body) {
    delete req.body._method;
  }
  next();
}
