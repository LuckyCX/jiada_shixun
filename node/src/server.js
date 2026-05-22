import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { config } from './config.js';
import { getPool } from './lib/db.js';
import { logError } from './lib/logError.js';
import authRoutes from './routes/auth.js';
import systemConfigRoutes from './routes/systemConfig.js';
import dictionaryRoutes from './routes/dictionary.js';
import adminUsersRoutes from './routes/adminUsers.js';
import collegesRoutes from './routes/colleges.js';
import teacherPersonalClassesRoutes from './routes/teacherPersonalClasses.js';
import studentPortalRoutes from './routes/studentPortal.js';
import teamFormationRoutes from './routes/teamFormation.js';
import studentNotificationsRoutes from './routes/studentNotifications.js';

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
    logError('GET /api/health/ready', e);
    res.status(503).json({ code: 50301, message: e.message, data: null });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api', systemConfigRoutes);
app.use('/api', dictionaryRoutes);
app.use('/api', collegesRoutes);
app.use('/api', adminUsersRoutes);
app.use('/api', teacherPersonalClassesRoutes);
app.use('/api', studentPortalRoutes);
app.use('/api', teamFormationRoutes);
app.use('/api', studentNotificationsRoutes);

app.use((err, req, res, _next) => {
  logError(`express errorHandler traceId=${req.traceId}`, err);
  res.status(500).json({ code: 50000, message: err.message || 'Internal error', data: null });
});

app.listen(config.port, '0.0.0.0', () => {
  console.log(`API listening on ${config.port}`);
});
