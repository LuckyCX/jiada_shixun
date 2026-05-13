import { query } from './db.js';
import { cacheGetJson, cacheSetJson, cacheDelPattern } from './redis.js';

const CACHE_PREFIX = 'cfg:system_config:';
const CACHE_TTL = 45;

/** @returns {Promise<Record<string, unknown>>} */
export async function getAllConfigRaw(useCache = true) {
  const cacheKey = `${CACHE_PREFIX}all`;
  if (useCache) {
    const hit = await cacheGetJson(cacheKey);
    if (hit) return hit;
  }
  const { rows } = await query(
    'SELECT config_key, config_value, description, updated_at FROM system_config ORDER BY config_key'
  );
  const out = {};
  for (const row of rows) {
    out[row.config_key] = {
      value: row.config_value,
      description: row.description,
      updated_at: row.updated_at,
    };
  }
  await cacheSetJson(cacheKey, out, CACHE_TTL);
  return out;
}

export async function getConfigValue(key, useCache = true) {
  const all = await getAllConfigRaw(useCache);
  const row = all[key];
  return row ? row.value : null;
}

export async function invalidateConfigCache() {
  await cacheDelPattern(`${CACHE_PREFIX}*`);
}

/**
 * Merge patch into base; string '********' means keep base value (masked secret from UI).
 */
function mergeSkipMasked(base, patch) {
  if (patch === null || patch === undefined) return base;
  if (typeof patch !== 'object' || Array.isArray(patch)) return patch;
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v === '********') continue;
    if (typeof v === 'object' && v !== null && !Array.isArray(v) && typeof out[k] === 'object' && out[k] !== null) {
      out[k] = mergeSkipMasked(out[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Patch multiple top-level keys; merges with existing DB values so masked secrets are not wiped.
 */
export async function patchConfig(patches, userId) {
  const client = await import('./db.js').then((m) => m.getPool().connect());
  try {
    await client.query('BEGIN');
    for (const [key, patchObj] of Object.entries(patches)) {
      const cur = await client.query('SELECT config_value FROM system_config WHERE config_key = $1', [key]);
      const prev = cur.rows[0]?.config_value || {};
      const merged = mergeSkipMasked(typeof prev === 'object' ? prev : {}, patchObj);
      await client.query(
        `INSERT INTO system_config (config_key, config_value, updated_by)
         VALUES ($1, $2::jsonb, $3)
         ON CONFLICT (config_key) DO UPDATE SET
           config_value = EXCLUDED.config_value,
           updated_by = EXCLUDED.updated_by,
           updated_at = now()`,
        [key, JSON.stringify(merged), userId]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  await invalidateConfigCache();
}

/** Mask sensitive fields for API responses */
export function maskConfigForAdmin(allRaw) {
  const clone = JSON.parse(JSON.stringify(allRaw));
  const maskKeys = ['pass', 'password', 'accessKeySecret', 'secret', 'apiKey'];
  function deepMask(obj) {
    if (!obj || typeof obj !== 'object') return;
    for (const k of Object.keys(obj)) {
      if (maskKeys.some((m) => k.toLowerCase().includes(m.toLowerCase())) && typeof obj[k] === 'string' && obj[k].length > 0) {
        obj[k] = '********';
      } else if (typeof obj[k] === 'object') deepMask(obj[k]);
    }
  }
  for (const entry of Object.values(clone)) {
    if (entry && entry.value) deepMask(entry.value);
  }
  return clone;
}
