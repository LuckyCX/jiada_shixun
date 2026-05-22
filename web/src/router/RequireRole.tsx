import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import {
  ensurePortalAccessToken,
  getPortalToken,
  isJwtLikelyValid,
  parseJwtPayload,
  type PortalRole,
} from '../lib/authApi';

type Props = {
  role: PortalRole;
  children: ReactNode;
};

/**
 * 仅允许对应角色携带有效 JWT 访问；access 过期时尝试 refresh，失败则回首页。
 */
export default function RequireRole({ role, children }: Props) {
  const location = useLocation();
  const [gate, setGate] = useState<'loading' | 'ok' | 'deny'>('loading');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = getPortalToken(role);
      if (token && isJwtLikelyValid(token)) {
        const p = parseJwtPayload(token);
        if (p?.role === role) {
          if (!cancelled) setGate('ok');
          return;
        }
      }
      const ok = await ensurePortalAccessToken(role);
      if (cancelled) return;
      if (!ok) {
        setGate('deny');
        return;
      }
      const t2 = getPortalToken(role);
      const p2 = t2 ? parseJwtPayload(t2) : null;
      setGate(p2?.role === role ? 'ok' : 'deny');
    })();
    return () => {
      cancelled = true;
    };
  }, [role]);

  if (gate === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-sm text-gray-500">
        正在验证登录…
      </div>
    );
  }
  if (gate === 'deny') {
    return <Navigate to="/" replace state={{ from: location.pathname, needLogin: true }} />;
  }
  return <>{children}</>;
}
