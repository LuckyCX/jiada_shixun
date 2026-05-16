import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getPortalToken, isJwtLikelyValid, parseJwtPayload, type PortalRole } from '../lib/authApi';

type Props = {
  role: PortalRole;
  children: ReactNode;
};

/**
 * 仅允许对应角色携带有效 JWT 访问；否则回首页（与 token 分键存储配合，避免串端）。
 */
export default function RequireRole({ role, children }: Props) {
  const location = useLocation();
  const token = getPortalToken(role);
  if (!token || !isJwtLikelyValid(token)) {
    return <Navigate to="/" replace state={{ from: location.pathname, needLogin: true }} />;
  }
  const payload = parseJwtPayload(token);
  if (!payload || payload.role !== role) {
    return <Navigate to="/" replace state={{ from: location.pathname, wrongRole: true }} />;
  }
  return <>{children}</>;
}
