import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { getConfigValue } from './systemConfig.js';
import { getJwtSecret } from '../middleware/auth.js';
import { cacheGetJson, cacheSetJson } from './redis.js';
import { getRedis } from './redis.js';

export async function getJwtTtls() {
  const sec = await getConfigValue('security');
  return {
    accessTtlSec: sec?.jwt?.accessTtlSec ?? 43200,
    refreshTtlSec: sec?.jwt?.refreshTtlSec ?? 604800,
  };
}

/**
 * @param {{ id: string|number, username: string, role: string }} user
 */
export async function signAccessToken(user) {
  const { accessTtlSec } = await getJwtTtls();
  const secret = await getJwtSecret();
  return jwt.sign(
    { sub: String(user.id), username: user.username, role: user.role },
    secret,
    { expiresIn: accessTtlSec }
  );
}

/**
 * @param {{ id: string|number, username: string, role: string }} user
 */
export async function signRefreshToken(user) {
  const { refreshTtlSec } = await getJwtTtls();
  const secret = await getJwtSecret();
  const jti = randomUUID();
  const userId = String(user.id);
  const token = jwt.sign(
    { sub: userId, username: user.username, role: user.role, typ: 'refresh', jti },
    secret,
    { expiresIn: refreshTtlSec }
  );
  await cacheSetJson(`auth:refresh:${userId}:${jti}`, { userId, role: user.role }, refreshTtlSec);
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
 * @returns {{ id: string, username: string, role: string } | null}
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
  };
}
