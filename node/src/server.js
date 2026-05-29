import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { getPool } from './lib/db.js';
import { logError } from './lib/logError.js';
import authRoutes from './routes/auth.js';
import systemConfigRoutes from './routes/systemConfig.js';
import dictionaryRoutes from './routes/dictionary.js';
import adminUsersRoutes from './routes/adminUsers.js';
import collegesRoutes from './routes/colleges.js';
import adminOverviewRoutes from './routes/adminOverview.js';
import adminOperationLogsRoutes from './routes/adminOperationLogs.js';
import teacherPersonalClassesRoutes from './routes/teacherPersonalClasses.js';
import studentPortalRoutes from './routes/studentPortal.js';
import teamFormationRoutes from './routes/teamFormation.js';
import personalClassTasksRoutes from './routes/personalClassTasks.js';
import studentNotificationsRoutes from './routes/studentNotifications.js';
import courseResourcesRoutes from './routes/courseResources.js';
import teacherInstanceLibraryRoutes from './routes/teacherInstanceLibrary.js';
import studentIdeationRoutes from './routes/studentIdeation.js';
import studentMarketResearchRoutes from './routes/studentMarketResearch.js';
import studentProductDesignRoutes from './routes/studentProductDesign.js';
import studentBusinessModelRoutes from './routes/studentBusinessModel.js';
import studentRoleSimulationRoutes from './routes/studentRoleSimulation.js';
import studentBusinessPlanRoutes from './routes/studentBusinessPlan.js';
import teacherBusinessPlanRoutes from './routes/teacherBusinessPlan.js';
import teacherMonitorRoutes from './routes/teacherMonitor.js';
import studentArchiveRoutes from './routes/studentArchive.js';
import studentTrainingPrerequisiteRoutes from './routes/studentTrainingPrerequisite.js';
import publicMarketSurveyRoutes from './routes/publicMarketSurvey.js';
import courseSettingsRoutes from './routes/courseSettings.js';
import { startCourseSettingReminderJob } from './jobs/courseSettingReminderJob.js';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AVATAR_UPLOAD_ROOT = path.join(__dirname, '../uploads/avatars');

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));
app.use('/uploads/avatars', express.static(AVATAR_UPLOAD_ROOT));

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
app.use('/api', adminOverviewRoutes);
app.use('/api', adminOperationLogsRoutes);
app.use('/api', teacherPersonalClassesRoutes);
app.use('/api', studentPortalRoutes);
app.use('/api', teamFormationRoutes);
app.use('/api', personalClassTasksRoutes);
app.use('/api', studentNotificationsRoutes);
app.use('/api', courseResourcesRoutes);
app.use('/api', teacherInstanceLibraryRoutes);
app.use('/api', studentIdeationRoutes);
app.use('/api', studentMarketResearchRoutes);
app.use('/api', studentProductDesignRoutes);
app.use('/api', studentBusinessModelRoutes);
app.use('/api', studentRoleSimulationRoutes);
app.use('/api', studentBusinessPlanRoutes);
app.use('/api', teacherBusinessPlanRoutes);
app.use('/api', teacherMonitorRoutes);
app.use('/api', studentArchiveRoutes);
app.use('/api', studentTrainingPrerequisiteRoutes);
app.use('/api', publicMarketSurveyRoutes);
app.use('/api', courseSettingsRoutes);

app.use((err, req, res, _next) => {
  logError(`express errorHandler traceId=${req.traceId}`, err);
  res.status(500).json({ code: 50000, message: err.message || 'Internal error', data: null });
});

app.listen(config.port, '0.0.0.0', () => {
  console.log(`API listening on ${config.port}`);
  startCourseSettingReminderJob();
});
