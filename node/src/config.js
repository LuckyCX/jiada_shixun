/**
 * 与 docs/otherProjects 一致：默认库凭据写死在本文件，便于本地/远程脚本不写密码。
 * Docker 内仅注入 DB_HOST=postgres、REDIS_HOST=redis 等即可对齐 compose 服务名。
 */
export const config = {
  port: Number(process.env.PORT || 4000),
  db: {
    host: process.env.DB_HOST || 'postgres',
    port: Number(process.env.DB_PORT || 5432),
    database: 'jiada_shixun',
    user: 'jiada_shixun',
    password: 'jiuan@123',
  },
  redis: {
    host: process.env.REDIS_HOST || 'redis',
    port: Number(process.env.REDIS_PORT || 6379),
  },
  pgPoolMax: Number(process.env.PG_POOL_MAX || 30),
};
