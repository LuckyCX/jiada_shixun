import { Router } from 'express';
import { getPool } from '../lib/db.js';
import { logError } from '../lib/logError.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import {
  ADMIN_LOG_MODULES,
  adminLogTypeByModule,
  adminLogIconByType,
  fmtRelativeZh,
} from '../lib/adminOperationLog.js';

const router = Router();

function ok(req, res, data, message = 'OK') {
  return res.json({ code: 0, message, data, traceId: req.traceId });
}

function bad(req, res, status, code, message) {
  return res.status(status).json({ code, message, data: null, traceId: req.traceId });
}

function parseTimeRange(range) {
  const r = String(range || '').trim();
  if (r === 'today') return { days: 1, label: 'today' };
  if (r === '30days') return { days: 30, label: '30days' };
  return { days: 7, label: '7days' };
}

function safeTextFromDetail(detail) {
  if (!detail) return '';
  if (typeof detail === 'string') return detail;
  if (typeof detail === 'object') return String(detail.text || '');
  return '';
}

router.get('/admin/operation-logs', requireAuth(), requireAdmin(), async (req, res) => {
  try {
    const type = String(req.query.type || 'all').trim(); // all|class|system|user|course
    const { days } = parseTimeRange(req.query.timeRange);
    const q = String(req.query.q || '').trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 10));
    const offset = (page - 1) * pageSize;

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    let modules = Array.from(ADMIN_LOG_MODULES.values());
    if (type === 'class') modules = ['admin_class', 'admin_college'];
    if (type === 'system') modules = ['admin_dictionary', 'admin_system_config'];
    if (type === 'user' || type === 'course') modules = [];
    if (type !== 'all' && modules.length === 0) {
      return ok(req, res, { list: [], total: 0, page, pageSize, stats: { total: 0, byType: {} } });
    }

    const params = [start, modules];
    let pi = 3;
    const cond = [`ol.created_at >= $1`, `ol.module = ANY($2::text[])`, `ol.operator_role = 'admin'`];

    if (q) {
      cond.push(
        `(COALESCE(u.real_name,'') ILIKE $${pi} OR COALESCE(u.username,'') ILIKE $${pi} OR ol.module ILIKE $${pi} OR ol.action ILIKE $${pi} OR COALESCE(ol.detail::text,'') ILIKE $${pi})`
      );
      params.push(`%${q}%`);
      pi += 1;
    }

    const where = `WHERE ${cond.join(' AND ')}`;

    const { rows: cntRows } = await getPool().query(
      `SELECT COUNT(*)::int AS c
       FROM operation_logs ol
       LEFT JOIN users u ON u.id = ol.operator_id
       ${where}`,
      params
    );
    const total = Number(cntRows[0]?.c || 0);

    const listParams = [...params, pageSize, offset];
    const { rows } = await getPool().query(
      `SELECT ol.id, ol.module, ol.action, ol.detail, ol.created_at,
              COALESCE(u.real_name, u.username, '') AS operator_name
       FROM operation_logs ol
       LEFT JOIN users u ON u.id = ol.operator_id
       ${where}
       ORDER BY ol.created_at DESC, ol.id DESC
       LIMIT $${pi} OFFSET $${pi + 1}`,
      listParams
    );

    const list = (rows || []).map((r) => {
      const baseType = adminLogTypeByModule(r.module);
      const detailText = safeTextFromDetail(r.detail);
      const icon = adminLogIconByType(baseType.type);
      return {
        id: String(r.id),
        type: baseType.type,
        typeLabel: baseType.typeLabel,
        action: String(r.action || '').trim(),
        detail: detailText,
        operator: String(r.operator_name || '').trim() || '系统自动',
        time: fmtRelativeZh(r.created_at),
        timestamp: r.created_at ? new Date(r.created_at).toISOString() : '',
        ...icon,
      };
    });

    // 统计：同一筛选条件下（不含分页）
    const statsModules = Array.from(ADMIN_LOG_MODULES.values());
    const statsParams = [start, statsModules];
    let spi = 3;
    const statsCond = [`ol.created_at >= $1`, `ol.module = ANY($2::text[])`, `ol.operator_role = 'admin'`];
    if (q) {
      statsCond.push(
        `(COALESCE(u.real_name,'') ILIKE $${spi} OR COALESCE(u.username,'') ILIKE $${spi} OR ol.module ILIKE $${spi} OR ol.action ILIKE $${spi} OR COALESCE(ol.detail::text,'') ILIKE $${spi})`
      );
      statsParams.push(`%${q}%`);
      spi += 1;
    }
    const statsWhere = `WHERE ${statsCond.join(' AND ')}`;
    const { rows: statsRows } = await getPool().query(
      `SELECT ol.module, COUNT(*)::int AS c
       FROM operation_logs ol
       LEFT JOIN users u ON u.id = ol.operator_id
       ${statsWhere}
       GROUP BY ol.module`,
      statsParams
    );
    const byType = {};
    let statsTotal = 0;
    for (const r of statsRows || []) {
      const base = adminLogTypeByModule(r.module);
      const c = Number(r.c || 0);
      statsTotal += c;
      byType[base.type] = (byType[base.type] || 0) + c;
    }

    return ok(req, res, { list, total, page, pageSize, stats: { total: statsTotal, byType } });
  } catch (e) {
    logError(`GET /api/admin/operation-logs traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

export default router;

