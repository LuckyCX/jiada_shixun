/** 管理端 localStorage 历史键名（与旧版一致，便于迁移读取） */
export const ADMIN_TOKEN_KEY = 'jiada_admin_token';
export const TEACHER_TOKEN_KEY = 'jiada_teacher_token';
export const STUDENT_TOKEN_KEY = 'jiada_student_token';

const ADMIN_REFRESH_TOKEN_KEY = 'jiada_admin_refresh_token';
const TEACHER_REFRESH_TOKEN_KEY = 'jiada_teacher_refresh_token';
const STUDENT_REFRESH_TOKEN_KEY = 'jiada_student_refresh_token';

export type PortalRole = 'admin' | 'teacher' | 'student';

const LOGIN_FORM_STORAGE_KEY = 'jiada_portal_login_form_v1';

export type SavedLoginForm = {
  remember: boolean;
  username: string;
  password: string;
};

/** 按角色读取「记住我」保存的账号密码（仅存在本机 localStorage） */
export function getSavedLoginForm(role: PortalRole): SavedLoginForm {
  try {
    const raw = localStorage.getItem(LOGIN_FORM_STORAGE_KEY);
    if (!raw) return { remember: false, username: '', password: '' };
    const all = JSON.parse(raw) as Partial<Record<PortalRole, SavedLoginForm>>;
    const row = all[role];
    if (!row) return { remember: false, username: '', password: '' };
    return {
      remember: Boolean(row.remember),
      username: String(row.username ?? ''),
      password: String(row.password ?? ''),
    };
  } catch {
    return { remember: false, username: '', password: '' };
  }
}

export function saveLoginForm(role: PortalRole, form: SavedLoginForm): void {
  try {
    const raw = localStorage.getItem(LOGIN_FORM_STORAGE_KEY);
    const all = raw ? (JSON.parse(raw) as Partial<Record<PortalRole, SavedLoginForm>>) : {};
    if (form.remember) {
      all[role] = {
        remember: true,
        username: form.username,
        password: form.password,
      };
    } else {
      delete all[role];
    }
    localStorage.setItem(LOGIN_FORM_STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

function storageKeyForRole(role: PortalRole): string {
  if (role === 'admin') return ADMIN_TOKEN_KEY;
  if (role === 'teacher') return TEACHER_TOKEN_KEY;
  return STUDENT_TOKEN_KEY;
}

function refreshStorageKeyForRole(role: PortalRole): string {
  if (role === 'admin') return ADMIN_REFRESH_TOKEN_KEY;
  if (role === 'teacher') return TEACHER_REFRESH_TOKEN_KEY;
  return STUDENT_REFRESH_TOKEN_KEY;
}

/** 当前作用域 token 是否以 Cookie「记住我」方式存储（改密续签时需保持同一存储介质） */
export function isPortalRememberMe(role: PortalRole): boolean {
  return Boolean(getAuthCookie(storageKeyForRole(role)));
}

function cookieAttrs(): string {
  let s = '; Path=/; SameSite=Lax';
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    s += '; Secure';
  }
  return s;
}

function getAuthCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const enc = `${encodeURIComponent(name)}=`;
  const parts = document.cookie.split('; ');
  for (const part of parts) {
    if (part.startsWith(enc)) {
      return decodeURIComponent(part.slice(enc.length));
    }
  }
  return null;
}

function setAuthCookie(name: string, value: string, maxAgeSec: number): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Max-Age=${maxAgeSec}${cookieAttrs()}`;
}

function clearAuthCookie(name: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${encodeURIComponent(name)}=; Max-Age=0${cookieAttrs()}`;
}

/** Base64URL 解码 JWT payload 段 */
function base64UrlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return decodeURIComponent(
    atob(b64)
      .split('')
      .map((c) => '%' + (`00${c.charCodeAt(0).toString(16)}`).slice(-2))
      .join('')
  );
}

/** 客户端解析 JWT payload（不验签，仅用于展示与路由角色判断） */
export function parseJwtPayload(
  token: string
): { sub?: string; username?: string; role?: string; exp?: number; mustChangePassword?: boolean } | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    return JSON.parse(base64UrlDecode(parts[1])) as {
      sub?: string;
      username?: string;
      role?: string;
      exp?: number;
      mustChangePassword?: boolean;
    };
  } catch {
    return null;
  }
}

export function jwtRequiresPasswordChange(token: string): boolean {
  const p = parseJwtPayload(token);
  return Boolean(p?.mustChangePassword);
}

type MustChangeListener = (role: PortalRole) => void;
const mustChangeListeners = new Set<MustChangeListener>();

export function onMustChangePasswordRequired(cb: MustChangeListener): () => void {
  mustChangeListeners.add(cb);
  return () => {
    mustChangeListeners.delete(cb);
  };
}

export function emitMustChangePasswordRequired(role: PortalRole): void {
  mustChangeListeners.forEach((cb) => {
    try {
      cb(role);
    } catch {
      /* ignore */
    }
  });
}

/** 登录成功后若需强制改密则弹出全局弹窗 */
export function notifyMustChangePasswordIfNeeded(role: PortalRole, token: string, flag?: boolean): void {
  if (flag === true || jwtRequiresPasswordChange(token)) {
    emitMustChangePasswordRequired(role);
  }
}

export function isJwtLikelyValid(token: string): boolean {
  const p = parseJwtPayload(token);
  if (!p?.exp) return true;
  return p.exp * 1000 > Date.now();
}

/** 读取当前端 token：记住我 → Cookie；否则 → sessionStorage；管理员兼容旧版 localStorage */
export function getPortalToken(role: PortalRole): string | null {
  const key = storageKeyForRole(role);
  const fromCookie = getAuthCookie(key);
  if (fromCookie) return fromCookie;
  try {
    const fromSession = sessionStorage.getItem(key);
    if (fromSession) return fromSession;
  } catch {
    /* ignore */
  }
  if (role === 'admin') {
    try {
      const legacy = localStorage.getItem(key);
      if (legacy) return legacy;
    } catch {
      /* ignore */
    }
  }
  return null;
}

export function getPortalRefreshToken(role: PortalRole): string | null {
  const key = refreshStorageKeyForRole(role);
  const fromCookie = getAuthCookie(key);
  if (fromCookie) return fromCookie;
  try {
    const fromSession = sessionStorage.getItem(key);
    if (fromSession) return fromSession;
  } catch {
    /* ignore */
  }
  return null;
}

function clearOtherPortalTokens(keep: PortalRole): void {
  const roles: PortalRole[] = ['admin', 'teacher', 'student'];
  for (const r of roles) {
    if (r !== keep) clearPortalToken(r);
  }
}

/**
 * 写入登录 token，并清除其它角色的存储，避免串端。
 * @param remember 为 true 时写入 Cookie（Max-Age 30 天）；否则仅 sessionStorage。
 */
export function setPortalToken(
  role: PortalRole,
  token: string,
  remember: boolean,
  refreshToken?: string | null
): void {
  clearOtherPortalTokens(role);
  const key = storageKeyForRole(role);
  const refreshKey = refreshStorageKeyForRole(role);
  try {
    localStorage.removeItem(key);
    localStorage.removeItem(refreshKey);
  } catch {
    /* ignore */
  }
  if (remember) {
    try {
      sessionStorage.removeItem(key);
      sessionStorage.removeItem(refreshKey);
    } catch {
      /* ignore */
    }
    setAuthCookie(key, token, 30 * 24 * 60 * 60);
    if (refreshToken) {
      setAuthCookie(refreshKey, refreshToken, 30 * 24 * 60 * 60);
    } else {
      clearAuthCookie(refreshKey);
    }
  } else {
    clearAuthCookie(key);
    clearAuthCookie(refreshKey);
    try {
      sessionStorage.setItem(key, token);
      if (refreshToken) {
        sessionStorage.setItem(refreshKey, refreshToken);
      } else {
        sessionStorage.removeItem(refreshKey);
      }
    } catch {
      /* ignore */
    }
  }
}

export function clearPortalToken(role: PortalRole): void {
  const key = storageKeyForRole(role);
  const refreshKey = refreshStorageKeyForRole(role);
  clearAuthCookie(key);
  clearAuthCookie(refreshKey);
  try {
    sessionStorage.removeItem(key);
    sessionStorage.removeItem(refreshKey);
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(key);
    localStorage.removeItem(refreshKey);
  } catch {
    /* ignore */
  }
}

export function clearAllPortalTokens(): void {
  clearPortalToken('admin');
  clearPortalToken('teacher');
  clearPortalToken('student');
}

/** 清除管理员本地 token（401 / 令牌过期或主动退出） */
export function clearAdminToken(): void {
  clearPortalToken('admin');
}

/**
 * 管理端会话失效：清 token 并回到首页引导重新以管理员登录。
 * 首页会识别 `?adminExpired=1` 并打开管理员登录提示。
 */
export function redirectAdminSessionExpired(): void {
  if (typeof window === 'undefined') return;
  if (!window.location.pathname.startsWith('/admin-dashboard')) return;
  clearPortalToken('admin');
  window.location.replace('/?adminExpired=1');
}

/**
 * 教师端会话失效：清 token 并回到首页引导重新以教师登录。
 */
export function redirectTeacherSessionExpired(): void {
  if (typeof window === 'undefined') return;
  if (!window.location.pathname.startsWith('/teacher-dashboard')) return;
  clearPortalToken('teacher');
  window.location.replace('/?teacherExpired=1');
}

export type LoginUser = {
  id: number;
  username: string;
  role: string;
};

export type LoginResponse = {
  token: string;
  refreshToken?: string;
  mustChangePassword?: boolean;
  user: LoginUser;
};

const refreshInflight: Partial<Record<PortalRole, Promise<boolean>>> = {};

function redirectPortalSessionExpired(role: PortalRole): void {
  if (role === 'admin') redirectAdminSessionExpired();
  else if (role === 'teacher') redirectTeacherSessionExpired();
  else redirectStudentSessionExpired();
}

function isAuthFailure(status: number, code: unknown): boolean {
  return status === 401 || code === 40101 || code === 40102;
}

/**
 * 使用 refresh token 换取新的 access（及轮换后的 refresh）。
 */
export async function refreshPortalAccessToken(role: PortalRole): Promise<boolean> {
  const existing = refreshInflight[role];
  if (existing) return existing;

  const job = (async () => {
    const refreshToken = getPortalRefreshToken(role);
    if (!refreshToken) return false;
    try {
      const r = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      const j = await r.json().catch(() => ({ code: -1, message: '无效 JSON' }));
      if (!r.ok || j.code !== 0 || !j.data?.token) return false;
      const remember = isPortalRememberMe(role);
      setPortalToken(role, j.data.token as string, remember, (j.data.refreshToken as string) || refreshToken);
      return true;
    } catch {
      return false;
    }
  })();

  refreshInflight[role] = job;
  try {
    return await job;
  } finally {
    delete refreshInflight[role];
  }
}

/** 访问令牌将过期时尝试静默刷新（进入页面前） */
export async function ensurePortalAccessToken(role: PortalRole): Promise<boolean> {
  const token = getPortalToken(role);
  if (token && isJwtLikelyValid(token)) {
    const p = parseJwtPayload(token);
    return Boolean(p && p.role === role);
  }
  return refreshPortalAccessToken(role);
}

export function redirectStudentSessionExpired(): void {
  if (typeof window === 'undefined') return;
  if (!window.location.pathname.startsWith('/student-center')) return;
  clearPortalToken('student');
  window.location.replace('/?studentExpired=1');
}

/**
 * 教室 360 / 校园网常拦截 PUT、PATCH、DELETE。
 * 统一改为 POST，并由后端根据 X-HTTP-Method-Override 还原。
 */
export function rewriteUnsafeHttpMethod(opts: RequestInit = {}): RequestInit {
  const method = String(opts.method || 'GET').toUpperCase();
  if (method !== 'PUT' && method !== 'PATCH' && method !== 'DELETE') return opts;
  const incoming = { ...(opts.headers as Record<string, string> | undefined) };
  return {
    ...opts,
    method: 'POST',
    headers: {
      ...incoming,
      'X-HTTP-Method-Override': method,
    },
  };
}

function humanizeNetworkError(err: unknown): Error {
  const raw = err instanceof Error ? err.message : String(err || '');
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(raw)) {
    return new Error('网络请求失败，请检查网络后重试（部分浏览器或校园网可能拦截 PUT/DELETE）');
  }
  return err instanceof Error ? err : new Error(raw || '网络请求失败');
}

/**
 * 带 Bearer 的 API 请求；access 过期时自动 refresh 并重试一次。
 * 自动将 PUT/PATCH/DELETE 改写为 POST + 方法覆盖头，规避旧浏览器 Failed to fetch。
 */
export async function portalAuthenticatedFetch(
  role: PortalRole,
  path: string,
  opts: RequestInit = {}
): Promise<unknown> {
  const safeOpts = rewriteUnsafeHttpMethod(opts);
  const runOnce = async (accessToken: string) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(safeOpts.headers as Record<string, string>),
    };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    try {
      const r = await fetch(path, { ...safeOpts, headers });
      const renewed = r.headers.get('X-Access-Token');
      if (renewed) {
        const remember = isPortalRememberMe(role);
        setPortalToken(role, renewed, remember);
      }
      const j = await r.json().catch(() => ({ code: -1, message: '无效 JSON' }));
      return { r, j };
    } catch (e) {
      throw humanizeNetworkError(e);
    }
  };

  let access = getPortalToken(role) || '';
  let { r, j } = await runOnce(access);

  if (isAuthFailure(r.status, j.code) && getPortalRefreshToken(role)) {
    const ok = await refreshPortalAccessToken(role);
    if (ok) {
      access = getPortalToken(role) || '';
      ({ r, j } = await runOnce(access));
    }
  }

  if (isAuthFailure(r.status, j.code)) {
    redirectPortalSessionExpired(role);
    const msg =
      role === 'teacher'
        ? '登录已失效，请返回首页重新以教师登录'
        : role === 'admin'
          ? '登录已失效，请返回首页重新以管理员登录'
          : '登录已失效，请返回首页重新登录';
    throw new Error(typeof j.message === 'string' ? j.message : msg);
  }

  // 弱口令强制改密：业务 API 40310
  if (r.status === 403 && (j.code === 40310 || j.data?.mustChangePassword === true)) {
    emitMustChangePasswordRequired(role);
    const err = new Error(
      typeof j.message === 'string' ? j.message : '密码强度过低，请修改密码后再使用系统'
    ) as Error & { code?: number; data?: unknown };
    err.code = typeof j.code === 'number' ? j.code : 40310;
    if (j.data !== undefined) err.data = j.data;
    throw err;
  }

  if (!r.ok || j.code !== 0) {
    const err = new Error(typeof j.message === 'string' ? j.message : `HTTP ${r.status}`) as Error & {
      code?: number;
      data?: unknown;
    };
    if (typeof j.code === 'number') err.code = j.code;
    if (j.data !== undefined) err.data = j.data;
    throw err;
  }
  return j.data;
}

/**
 * 供未走 portalAuthenticatedFetch 的原生 fetch 使用（上传、keepalive 等）。
 */
export async function compatFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const safe = rewriteUnsafeHttpMethod(init || {});
  try {
    return await fetch(input, safe);
  } catch (e) {
    throw humanizeNetworkError(e);
  }
}

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

export type AuthMeProfile = {
  id: string;
  username: string;
  realName: string;
  role: string;
  status: string;
  email: string;
  phone: string;
  mustChangePassword: boolean;
};

/** GET /api/auth/me（含邮箱/手机，供强制改密弹窗判断是否需绑定） */
export async function fetchAuthMe(role: PortalRole): Promise<AuthMeProfile> {
  const data = (await portalAuthenticatedFetch(role, '/api/auth/me')) as AuthMeProfile | null;
  if (!data?.id) throw new Error('无法获取账号信息');
  return {
    id: String(data.id),
    username: String(data.username || ''),
    realName: String(data.realName || ''),
    role: String(data.role || ''),
    status: String(data.status || ''),
    email: String(data.email || ''),
    phone: String(data.phone || ''),
    mustChangePassword: Boolean(data.mustChangePassword),
  };
}

/** 强制改密场景：发送邮箱绑定验证码 */
export async function sendBindEmailCodeApi(role: PortalRole, email: string): Promise<void> {
  await portalAuthenticatedFetch(role, '/api/auth/bind-email-code', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

/** 强制改密场景：发送手机绑定验证码 */
export async function sendBindPhoneCodeApi(role: PortalRole, phone: string): Promise<void> {
  await portalAuthenticatedFetch(role, '/api/auth/bind-phone-code', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
}

/** 个人中心主动改密：向已绑定邮箱/手机发送验证码 */
export async function sendSecureCodeApi(role: PortalRole, channel: 'email' | 'phone'): Promise<void> {
  await portalAuthenticatedFetch(role, '/api/auth/secure-code', {
    method: 'POST',
    body: JSON.stringify({ channel }),
  });
}

/**
 * POST /api/auth/change-password（强制改密 / 主动改密）
 * 强制改密可不传 oldPassword；主动改密须传 verifyChannel + verifyCode
 */
export async function changePasswordWithApi(
  role: PortalRole,
  body: {
    oldPassword?: string;
    newPassword: string;
    confirmPassword: string;
    email?: string;
    emailCode?: string;
    phone?: string;
    phoneCode?: string;
    verifyChannel?: 'email' | 'phone';
    verifyCode?: string;
  }
): Promise<void> {
  const data = (await portalAuthenticatedFetch(role, '/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(body),
  })) as { token?: string; refreshToken?: string } | null;
  if (data?.token) {
    setPortalToken(role, data.token, isPortalRememberMe(role), data.refreshToken);
  }
}
