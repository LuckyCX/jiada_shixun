import { Router } from 'express';
import { getPool } from '../lib/db.js';
import { logError } from '../lib/logError.js';
import { requireAuth, requireTeacher } from '../middleware/auth.js';
import { formatCalendarDateFromPg } from '../lib/calendarDate.js';

const router = Router();

export const COURSE_SETTING_STAGES = [
  { key: 'team', name: '团队组建与分工', shortName: '团队组建', order: 1 },
  { key: 'ideation', name: '创新思维与创意生成', shortName: '创新思维', order: 2 },
  { key: 'market', name: '市场调研与用户画像', shortName: '市场调研', order: 3 },
  { key: 'product', name: '产品设计与迭代', shortName: '产品设计', order: 4 },
  { key: 'business', name: '商业模式设计', shortName: '商业模式', order: 5 },
  { key: 'simulation', name: 'AI仿真模拟', shortName: 'AI仿真', order: 6 },
  { key: 'plan', name: '商业计划书要点', shortName: '商业计划', order: 7 },
];

const STAGE_KEYS = new Set(COURSE_SETTING_STAGES.map((stage) => stage.key));

function ok(req, res, data, message = 'OK') {
  return res.json({ code: 0, message, data, traceId: req.traceId });
}

function bad(req, res, status, code, message) {
  return res.status(status).json({ code, message, data: null, traceId: req.traceId });
}

function parseId(val) {
  const id = Number(String(val || '').trim());
  return Number.isFinite(id) && id > 0 ? id : null;
}

function teacherIdFromReq(req) {
  return parseId(req.user?.sub);
}

function dateOnly(value) {
  return formatCalendarDateFromPg(value);
}

function isDateOnly(value) {
  return !value || /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function durationDays(startDate, deadlineDate) {
  if (!startDate || !deadlineDate) return 0;
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${deadlineDate}T00:00:00Z`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.floor((end - start) / 86400000) + 1;
}

async function ownsPersonalClass(pool, teacherId, classId) {
  const { rows } = await pool.query(
    `SELECT id, name,
            (SELECT COUNT(*)::int FROM teacher_personal_class_students s
             WHERE s.teacher_personal_class_id = teacher_personal_classes.id) AS "studentCount"
     FROM teacher_personal_classes
     WHERE id = $1 AND teacher_id = $2`,
    [classId, teacherId]
  );
  return rows[0] || null;
}

function mapSetting(row) {
  return {
    moduleKey: row.module_key,
    startDate: dateOnly(row.start_date),
    deadlineDate: dateOnly(row.deadline_date),
    durationDays: Number(row.duration_days || 0),
    reminderDays: Number(row.reminder_days ?? 3),
    reminderEnabled: Boolean(row.reminder_enabled),
    lastRemindedAt: row.last_reminded_at ? new Date(row.last_reminded_at).toISOString() : '',
    lastRemindedDeadline: dateOnly(row.last_reminded_deadline),
  };
}

router.get('/teacher/personal-classes/:classId/course-settings', requireAuth(), requireTeacher(), async (req, res) => {
  try {
    const teacherId = teacherIdFromReq(req);
    const classId = parseId(req.params.classId);
    if (!teacherId || !classId) return bad(req, res, 400, 40001, '无效班级');

    const pool = getPool();
    const classRow = await ownsPersonalClass(pool, teacherId, classId);
    if (!classRow) return bad(req, res, 404, 40401, '班级不存在');

    const { rows } = await pool.query(
      `SELECT module_key,
              to_char(start_date, 'YYYY-MM-DD') AS start_date,
              to_char(deadline_date, 'YYYY-MM-DD') AS deadline_date,
              duration_days, reminder_days, reminder_enabled,
              last_reminded_at,
              to_char(last_reminded_deadline, 'YYYY-MM-DD') AS last_reminded_deadline
       FROM teacher_personal_class_course_settings
       WHERE teacher_personal_class_id = $1 AND teacher_id = $2`,
      [classId, teacherId]
    );
    const byKey = new Map(rows.map((row) => [row.module_key, mapSetting(row)]));
    return ok(req, res, {
      classId: String(classId),
      className: classRow.name || '',
      studentCount: classRow.studentCount ?? 0,
      settings: COURSE_SETTING_STAGES.map((stage) => ({
        moduleKey: stage.key,
        startDate: '',
        deadlineDate: '',
        durationDays: 0,
        reminderDays: 3,
        reminderEnabled: true,
        lastRemindedAt: '',
        lastRemindedDeadline: '',
        ...(byKey.get(stage.key) || {}),
      })),
    });
  } catch (e) {
    logError(`GET /api/teacher/personal-classes/:classId/course-settings traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.put('/teacher/personal-classes/:classId/course-settings/:moduleKey', requireAuth(), requireTeacher(), async (req, res) => {
  try {
    const teacherId = teacherIdFromReq(req);
    const classId = parseId(req.params.classId);
    const moduleKey = String(req.params.moduleKey || '').trim();
    if (!teacherId || !classId) return bad(req, res, 400, 40001, '无效班级');
    if (!STAGE_KEYS.has(moduleKey)) return bad(req, res, 400, 40002, '无效实训模块');

    const startDate = String(req.body?.startDate || '').trim();
    const deadlineDate = String(req.body?.deadlineDate || '').trim();
    const reminderDays = Number(req.body?.reminderDays ?? 3);
    const reminderEnabled = req.body?.reminderEnabled !== false;

    if (!isDateOnly(startDate) || !isDateOnly(deadlineDate)) return bad(req, res, 400, 40003, '日期格式错误');
    if (!Number.isInteger(reminderDays) || reminderDays < 0 || reminderDays > 30) {
      return bad(req, res, 400, 40004, '提醒天数应为 0-30 天');
    }
    const duration = durationDays(startDate, deadlineDate);
    if (startDate && deadlineDate && duration <= 0) {
      return bad(req, res, 400, 40005, '截止日期不能早于开始日期');
    }
    if (duration > 0 && reminderDays >= duration) {
      return bad(req, res, 400, 40006, '提前提醒天数必须小于任务时长');
    }

    const pool = getPool();
    const classRow = await ownsPersonalClass(pool, teacherId, classId);
    if (!classRow) return bad(req, res, 404, 40401, '班级不存在');

    const { rows } = await pool.query(
      `INSERT INTO teacher_personal_class_course_settings
        (teacher_personal_class_id, teacher_id, module_key, start_date, deadline_date,
         duration_days, reminder_days, reminder_enabled, last_reminded_at, last_reminded_deadline)
       VALUES ($1, $2, $3, NULLIF($4, '')::date, NULLIF($5, '')::date, $6, $7, $8, NULL, NULL)
       ON CONFLICT (teacher_personal_class_id, module_key) DO UPDATE SET
         start_date = EXCLUDED.start_date,
         deadline_date = EXCLUDED.deadline_date,
         duration_days = EXCLUDED.duration_days,
         reminder_days = EXCLUDED.reminder_days,
         reminder_enabled = EXCLUDED.reminder_enabled,
         last_reminded_at = CASE
           WHEN teacher_personal_class_course_settings.deadline_date IS DISTINCT FROM EXCLUDED.deadline_date
           THEN NULL
           ELSE teacher_personal_class_course_settings.last_reminded_at
         END,
         last_reminded_deadline = CASE
           WHEN teacher_personal_class_course_settings.deadline_date IS DISTINCT FROM EXCLUDED.deadline_date
           THEN NULL
           ELSE teacher_personal_class_course_settings.last_reminded_deadline
         END,
         updated_at = now()
       RETURNING module_key,
                 to_char(start_date, 'YYYY-MM-DD') AS start_date,
                 to_char(deadline_date, 'YYYY-MM-DD') AS deadline_date,
                 duration_days, reminder_days, reminder_enabled,
                 last_reminded_at,
                 to_char(last_reminded_deadline, 'YYYY-MM-DD') AS last_reminded_deadline`,
      [classId, teacherId, moduleKey, startDate, deadlineDate, duration, reminderDays, reminderEnabled]
    );
    return ok(req, res, { setting: mapSetting(rows[0]) });
  } catch (e) {
    logError(`PUT /api/teacher/personal-classes/:classId/course-settings/:moduleKey traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

export default router;
