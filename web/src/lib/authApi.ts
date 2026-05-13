/** 与 admin-dashboard 系统配置页共用，便于门户登录后直接进入配置页免二次登录 */
export const ADMIN_TOKEN_KEY = 'jiada_admin_token';

export type LoginUser = {
  id: number;
  username: string;
  role: string;
};

export type LoginResponse = {
  token: string;
  user: LoginUser;
};

/**
 * POST /api/auth/login
 */
export async function loginWithApi(username: string, password: string): Promise<LoginResponse> {
  const r = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const j = await r.json().catch(() => ({ code: -1, message: '无效响应' }));
  if (!r.ok || j.code !== 0) {
    throw new Error(j.message || `HTTP ${r.status}`);
  }
  const data = j.data as LoginResponse | undefined;
  if (!data?.token || !data.user) {
    throw new Error('登录响应缺少 token 或用户信息');
  }
  return data;
}
