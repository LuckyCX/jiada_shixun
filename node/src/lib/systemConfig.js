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
 * Arrays merge by element `id` when present, else by index (so nested secrets in `providers[]` survive PATCH).
 */
function mergeSkipMasked(base, patch) {
  if (patch === null || patch === undefined) return base;
  if (Array.isArray(patch)) {
    if (!Array.isArray(base)) return patch;
    const baseById = new Map(
      base
        .filter((x) => x && typeof x === 'object' && !Array.isArray(x) && x.id != null)
        .map((x) => [String(x.id), x])
    );
    return patch.map((item, i) => {
      if (item === null || item === undefined) return item;
      if (typeof item !== 'object' || Array.isArray(item)) return item;
      const id = item.id != null ? String(item.id) : '';
      if (id && baseById.has(id)) return mergeSkipMasked(baseById.get(id), item);
      if (base[i] && typeof base[i] === 'object' && !Array.isArray(base[i])) return mergeSkipMasked(base[i], item);
      return item;
    });
  }
  if (typeof patch !== 'object') return patch;
  const safeBase = base && typeof base === 'object' && !Array.isArray(base) ? base : {};
  const out = { ...safeBase };
  for (const [k, v] of Object.entries(patch)) {
    if (v === '********') continue;
    if (Array.isArray(v)) {
      out[k] = mergeSkipMasked(Array.isArray(out[k]) ? out[k] : [], v);
    } else if (typeof v === 'object' && v !== null) {
      const prev = out[k];
      out[k] = mergeSkipMasked(
        prev && typeof prev === 'object' && !Array.isArray(prev) ? prev : {},
        v
      );
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
