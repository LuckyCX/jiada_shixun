/** 管理端 localStorage 历史键名（与旧版一致，便于迁移读取） */
export const ADMIN_TOKEN_KEY = 'jiada_admin_token';
export const TEACHER_TOKEN_KEY = 'jiada_teacher_token';
export const STUDENT_TOKEN_KEY = 'jiada_student_token';

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
export function parseJwtPayload(token: string): { sub?: string; username?: string; role?: string; exp?: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    return JSON.parse(base64UrlDecode(parts[1])) as { sub?: string; username?: string; role?: string; exp?: number };
  } catch {
    return null;
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
export function setPortalToken(role: PortalRole, token: string, remember: boolean): void {
  clearOtherPortalTokens(role);
  const key = storageKeyForRole(role);
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
  if (remember) {
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    setAuthCookie(key, token, 30 * 24 * 60 * 60);
  } else {
    clearAuthCookie(key);
    try {
      sessionStorage.setItem(key, token);
    } catch {
      /* ignore */
    }
  }
}

export function clearPortalToken(role: PortalRole): void {
  const key = storageKeyForRole(role);
  clearAuthCookie(key);
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(key);
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
