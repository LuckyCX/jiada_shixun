import pg from 'pg';
import { config } from '../config.js';

const { Pool } = pg;

let pool;

export function getPool() {
  if (!pool) {
    const conn = process.env.DATABASE_URL;
    if (conn) {
      pool = new Pool({
        connectionString: conn,
        max: config.pgPoolMax,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
      });
    } else {
      const c = config.db;
      pool = new Pool({
        host: c.host,
        port: c.port,
        database: c.database,
        user: c.user,
        password: c.password,
        max: config.pgPoolMax,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
      });
    }
  }
  return pool;
}

export async function query(text, params) {
  return getPool().query(text, params);
}
