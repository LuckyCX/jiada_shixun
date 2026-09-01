import pg from 'pg';
import { config } from '../config.js';
import { logError } from './logError.js';

const { Pool } = pg;

let pool;

function attachPoolGuards(p) {
  // 空闲连接被服务端掐断时，未监听 error 会变成未处理异常导致进程退出
  p.on('error', (err) => {
    logError('pg pool idle client error', err);
  });
}

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
    attachPoolGuards(pool);
  }
  return pool;
}

export async function query(text, params) {
  return getPool().query(text, params);
}
