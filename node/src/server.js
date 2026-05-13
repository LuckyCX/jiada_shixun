import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { config } from './config.js';
import { getPool } from './lib/db.js';
import authRoutes from './routes/auth.js';
import systemConfigRoutes from './routes/systemConfig.js';

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));

app.use((req, res, next) => {
  req.traceId = randomUUID();
  next();
});

app.get('/api/health/live', (_req, res) => {
  res.json({ code: 0, message: 'OK', data: { status: 'live' } });
});

app.get('/api/health/ready', async (_req, res) => {
  try {
    await getPool().query('SELECT 1');
    const { getRedis } = await import('./lib/redis.js');
    await getRedis().ping();
    res.json({ code: 0, message: 'OK', data: { status: 'ready' } });
  } catch (e) {
    res.status(503).json({ code: 50301, message: e.message, data: null });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api', systemConfigRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ code: 50000, message: err.message || 'Internal error', data: null });
});

app.listen(config.port, '0.0.0.0', () => {
  console.log(`API listening on ${config.port}`);
});
