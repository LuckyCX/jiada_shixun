import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { getConfigValue } from './systemConfig.js';
import { getJwtSecret } from '../middleware/auth.js';
import { cacheGetJson, cacheSetJson } from './redis.js';
import { getRedis } from './redis.js';

/** 默认访问令牌 1 天；仅以 system_config.security.jwt 为准 */
const DEFAULT_ACCESS_TTL_SEC = 86400;
const DEFAULT_REFRESH_TTL_SEC = 604800;
const DEFAULT_RENEWAL_MIN_INTERVAL_SEC = 60;

export async function getJwtTtls() {
  const sec = await getConfigValue('security');
  const jwtCfg = sec?.jwt && typeof sec.jwt === 'object' ? sec.jwt : {};
  const accessTtlSec = Number(jwtCfg.accessTtlSec);
  const refreshTtlSec = Number(jwtCfg.refreshTtlSec);
  const renewalMinIntervalSec = Number(jwtCfg.renewalMinIntervalSec);
  return {
    accessTtlSec:
      Number.isFinite(accessTtlSec) && accessTtlSec > 0 ? Math.floor(accessTtlSec) : DEFAULT_ACCESS_TTL_SEC,
    refreshTtlSec:
      Number.isFinite(refreshTtlSec) && refreshTtlSec > 0
        ? Math.floor(refreshTtlSec)
        : DEFAULT_REFRESH_TTL_SEC,
    renewalMinIntervalSec:
      Number.isFinite(renewalMinIntervalSec) && renewalMinIntervalSec > 0
        ? Math.floor(renewalMinIntervalSec)
        : DEFAULT_RENEWAL_MIN_INTERVAL_SEC,
  };
}

/**
 * @param {{ id: string|number, username: string, role: string }} user
 * @param {{ mustChangePassword?: boolean }} [opts]
 */
export async function signAccessToken(user, opts = {}) {
  const { accessTtlSec } = await getJwtTtls();
  const secret = await getJwtSecret();
  const payload = {
    sub: String(user.id),
    username: user.username,
    role: user.role,
  };
  if (opts.mustChangePassword === true) {
    payload.mustChangePassword = true;
  }
  return jwt.sign(payload, secret, { expiresIn: accessTtlSec });
}

/**
 * @param {{ id: string|number, username: string, role: string }} user
 * @param {{ mustChangePassword?: boolean }} [opts]
 */
export async function signRefreshToken(user, opts = {}) {
  const { refreshTtlSec } = await getJwtTtls();
  const secret = await getJwtSecret();
  const jti = randomUUID();
  const userId = String(user.id);
  const payload = {
    sub: userId,
    username: user.username,
    role: user.role,
    typ: 'refresh',
    jti,
  };
  if (opts.mustChangePassword === true) {
    payload.mustChangePassword = true;
  }
  const token = jwt.sign(payload, secret, { expiresIn: refreshTtlSec });
  await cacheSetJson(
    `auth:refresh:${userId}:${jti}`,
    { userId, role: user.role, mustChangePassword: Boolean(opts.mustChangePassword) },
    refreshTtlSec
  );
  return token;
}

/** 跨站进入创世纪的短 hop TTL */
const ECONOVERSE_HOP_TTL_SEC = 120;

/**
 * 签发创世纪跳转 hop（学生或教师管理端）。
 * @param {{ id: string|number, username: string, role: string }} user
 * @param {{ typ: string, personalClassId: string|number }} meta
 */
export async function signEconoverseHopTicket(user, meta) {
  const secret = await getJwtSecret();
  const jti = randomUUID();
  const userId = String(user.id);
  const personalClassId = String(meta.personalClassId);
  const token = jwt.sign(
    {
      sub: userId,
      username: user.username,
      role: user.role,
      typ: meta.typ,
      personalClassId,
      jti,
    },
    secret,
    { expiresIn: ECONOVERSE_HOP_TTL_SEC }
  );
  await cacheSetJson(
    `auth:econoverse-ticket:${jti}`,
    { userId, role: user.role, typ: meta.typ, personalClassId },
    ECONOVERSE_HOP_TTL_SEC
  );
  return { ticket: token, expiresIn: ECONOVERSE_HOP_TTL_SEC };
}

/**
 * 校验并一次性消费 hop。
 * @returns {{ id: string, username: string, role: string, typ: string, personalClassId: string } | null}
 */
export async function verifyAndConsumeEconoverseHopTicket(ticket) {
  const secret = await getJwtSecret();
  let payload;
  try {
    payload = jwt.verify(ticket, secret);
  } catch {
    return null;
  }
  const typ = String(payload.typ || '');
  if (
    (typ !== 'econoverse_jump' && typ !== 'econoverse_admin_jump') ||
    !payload.jti ||
    !payload.sub ||
    !payload.personalClassId
  ) {
    return null;
  }
  if (typ === 'econoverse_jump' && payload.role !== 'student') return null;
  if (typ === 'econoverse_admin_jump' && payload.role !== 'teacher') return null;
  const key = `auth:econoverse-ticket:${payload.jti}`;
  const sess = await cacheGetJson(key);
  if (!sess) return null;
  try {
    await getRedis().del(key);
  } catch {
    return null;
  }
  return {
    id: String(payload.sub),
    username: String(payload.username || ''),
    role: String(payload.role || ''),
    typ,
    personalClassId: String(payload.personalClassId),
  };
}

/**
 * 校验 refresh token 并轮换（删除 Redis 会话，调用方需签发新 refresh）。
 * @returns {{ id: string, username: string, role: string, mustChangePassword: boolean } | null}
 */
export async function verifyAndRevokeRefreshToken(refreshToken) {
  const secret = await getJwtSecret();
  let payload;
  try {
    payload = jwt.verify(refreshToken, secret);
  } catch {
    return null;
  }
  if (payload.typ !== 'refresh' || !payload.jti || !payload.sub) return null;
  const key = `auth:refresh:${payload.sub}:${payload.jti}`;
  const sess = await cacheGetJson(key);
  if (!sess) return null;
  try {
    await getRedis().del(key);
  } catch {
    return null;
  }
  return {
    id: String(payload.sub),
    username: String(payload.username || ''),
    role: String(payload.role || ''),
    mustChangePassword: Boolean(payload.mustChangePassword || sess.mustChangePassword),
  };
}

/**
 * 滑动续期：同一用户最短间隔内不重复签发；成功时返回新 access token。
 * @param {{ sub: string, username: string, role: string, mustChangePassword?: boolean }} payload
 * @returns {Promise<string|null>}
 */
export async function maybeRenewAccessToken(payload) {
  const userId = String(payload.sub || '');
  if (!userId) return null;
  const { accessTtlSec, renewalMinIntervalSec } = await getJwtTtls();
  const key = `auth:renew:${userId}`;
  try {
    const r = getRedis();
    const setOk = await r.set(key, '1', 'EX', renewalMinIntervalSec, 'NX');
    if (setOk !== 'OK') return null;
  } catch {
    return null;
  }
  return signAccessToken(
    { id: userId, username: payload.username, role: payload.role },
    { mustChangePassword: Boolean(payload.mustChangePassword) }
  );
}

export { DEFAULT_ACCESS_TTL_SEC, DEFAULT_REFRESH_TTL_SEC, DEFAULT_RENEWAL_MIN_INTERVAL_SEC };
