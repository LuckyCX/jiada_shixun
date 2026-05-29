import { Router } from 'express';
import { getPool } from '../lib/db.js';
import { logError } from '../lib/logError.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { ADMIN_LOG_MODULES, adminLogTypeByModule, adminLogIconByType, fmtRelativeZh } from '../lib/adminOperationLog.js';

const router = Router();

function ok(req, res, data, message = 'OK') {
  return res.json({ code: 0, message, data, traceId: req.traceId });
}

function bad(req, res, status, code, message) {
  return res.status(status).json({ code, message, data: null, traceId: req.traceId });
}

function localDateKey(d) {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function mmddLabelFromDateKey(key) {
  const s = String(key || '');
  const mm = s.slice(5, 7);
  const dd = s.slice(8, 10);
  if (!mm || !dd) return '';
  return `${mm}/${dd}`;
}

function safeTextFromDetail(detail) {
  if (!detail) return '';
  if (typeof detail === 'string') return detail;
  if (typeof detail === 'object') return String(detail.text || '');
  return '';
}

router.get('/admin/overview', requireAuth(), requireAdmin(), async (req, res) => {
  try {
    const rangeRaw = String(req.query.range || '').trim();
    const range = rangeRaw === '30days' ? '30days' : '7days';
    const days = range === '30days' ? 30 : 7;

    const pool = getPool();
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    const [userAgg, classAgg, activeTeamAgg, loginAgg, opAgg] = await Promise.all([
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE role = 'student' AND status = 'active')::int AS students,
           COUNT(*) FILTER (WHERE role = 'teacher' AND status = 'active')::int AS teachers
         FROM users`
      ),
      pool.query(`SELECT COUNT(*)::int AS classes FROM classes`),
      pool.query(
        `SELECT COUNT(DISTINCT m.team_id)::int AS active_teams
         FROM teacher_personal_class_team_members m
         JOIN users u ON u.id = m.student_id
         JOIN teacher_personal_class_teams t ON t.id = m.team_id
         WHERE u.last_login_at >= $1 AND t.grouping_status IN ('draft', 'confirmed')`,
        [start]
      ),
      pool.query(
        `SELECT date_trunc('day', last_login_at) AS day, COUNT(DISTINCT id)::int AS c
         FROM users
         WHERE last_login_at >= $1 AND status = 'active'
         GROUP BY day
         ORDER BY day ASC`,
        [start]
      ),
      pool.query(
        `SELECT ol.module, ol.action, ol.detail, ol.created_at, COALESCE(u.real_name, u.username, '') AS operator_name
         FROM operation_logs ol
         LEFT JOIN users u ON u.id = ol.operator_id
         WHERE ol.operator_role = 'admin' AND ol.module = ANY($1::text[])
         ORDER BY ol.created_at DESC
         LIMIT 20`
        ,
        [Array.from(ADMIN_LOG_MODULES.values())]
      ),
    ]);

    const stats = {
      students: Number(userAgg.rows[0]?.students || 0),
      teachers: Number(userAgg.rows[0]?.teachers || 0),
      classes: Number(classAgg.rows[0]?.classes || 0),
      activeTeams: Number(activeTeamAgg.rows[0]?.active_teams || 0),
    };

    const countsByKey = new Map();
    for (const r of loginAgg.rows || []) {
      const key = r.day ? localDateKey(r.day) : '';
      if (!key) continue;
      countsByKey.set(key, Number(r.c || 0));
    }

    const activityTrends = [];
    for (let i = 0; i < days; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = localDateKey(d);
      activityTrends.push({ date: mmddLabelFromDateKey(key), value: Number(countsByKey.get(key) || 0) });
    }

    const recentOperations = (opAgg.rows || []).map((r) => {
      const baseType = adminLogTypeByModule(r.module);
      const icon = adminLogIconByType(baseType.type);
      const operator = String(r.operator_name || '').trim() || '系统自动';
      return {
        type: baseType.type,
        typeLabel: baseType.typeLabel,
        action: String(r.action || '').trim(),
        detail: safeTextFromDetail(r.detail),
        operator,
        time: fmtRelativeZh(r.created_at),
        ...icon,
      };
    });

    return ok(req, res, { stats, activityTrends, recentOperations });
  } catch (e) {
    logError(`GET /api/admin/overview traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

export default router;

