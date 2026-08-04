/**
 * 将主站路径解析为可打开的完整 URL。
 * 生产 / 经 web 代理同域访问时保持相对路径；本地直连 game:5174 时跳回 web:3000。
 * 可用 VITE_WEB_ORIGIN 覆盖（如 https://example.com）。
 */
export function resolveWebAppUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const configured = (import.meta.env.VITE_WEB_ORIGIN as string | undefined)?.replace(/\/$/, '');
  if (configured) return `${configured}${normalized}`;

  if (typeof window === 'undefined') return normalized;

  const { protocol, hostname, port } = window.location;
  // 本地开发：game 独立端口，学生中心在 web（vite.config 默认 3000）
  if (port === '5174') {
    return `${protocol}//${hostname}:3000${normalized}`;
  }
  return normalized;
}
