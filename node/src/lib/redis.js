import Redis from 'ioredis';
import { config } from '../config.js';

let client;

export function getRedis() {
  if (!client) {
    const url = process.env.REDIS_URL;
    if (url) {
      client = new Redis(url, {
        maxRetriesPerRequest: 2,
        enableReadyCheck: true,
      });
    } else {
      const r = config.redis;
      client = new Redis({
        host: r.host,
        port: r.port,
        maxRetriesPerRequest: 2,
        enableReadyCheck: true,
      });
    }
  }
  return client;
}

export async function cacheGetJson(key) {
  try {
    const r = await getRedis().get(key);
    return r ? JSON.parse(r) : null;
  } catch {
    return null;
  }
}

export async function cacheSetJson(key, value, ttlSec) {
  const r = getRedis();
  const s = JSON.stringify(value);
  if (ttlSec > 0) await r.set(key, s, 'EX', ttlSec);
  else await r.set(key, s);
}

export async function cacheDelPattern(pattern) {
  const r = getRedis();
  let cursor = '0';
  do {
    const reply = await r.scan(cursor, 'MATCH', pattern, 'COUNT', '100');
    cursor = reply[0];
    const keys = reply[1];
    if (keys.length) await r.del(...keys);
  } while (cursor !== '0');
}
