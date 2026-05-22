import { Router } from 'express';
import { getPool } from '../lib/db.js';
import { logError } from '../lib/logError.js';
import { requireAuth, requireStudent } from '../middleware/auth.js';

const router = Router();

function ok(req, res, data, message = 'OK') {
  return res.json({ code: 0, message, data, traceId: req.traceId });
}

function bad(req, res, status, code, message) {
  return res.status(status).json({ code, message, data: null, traceId: req.traceId });
}

function studentIdFromReq(req) {
  const id = Number(String(req.user?.sub || '').trim());
  return Number.isFinite(id) && id > 0 ? id : null;
}

router.get('/student/notifications', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const sid = studentIdFromReq(req);
    if (!sid) return bad(req, res, 400, 40001, '无效用户');
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const { rows } = await getPool().query(
      `SELECT n.id, n.type, n.title, n.content, n.related_module AS "relatedModule",
              n.related_link AS "relatedLink", n.is_read AS "isRead", n.sent_at AS "sentAt",
              u.real_name AS "senderName"
       FROM notifications n
       LEFT JOIN users u ON u.id = n.sender_id
       WHERE n.receiver_id = $1
       ORDER BY n.sent_at DESC
       LIMIT $2`,
      [sid, limit]
    );
    return ok(
      req,
      res,
      rows.map((r) => ({
        id: String(r.id),
        type: r.type,
        title: r.title || '',
        content: r.content || '',
        relatedModule: r.relatedModule || '',
        relatedLink: r.relatedLink || '',
        isRead: r.isRead === true,
        timestamp: r.sentAt ? new Date(r.sentAt).toLocaleString('zh-CN') : '',
        sender: { name: r.senderName || '系统' },
      }))
    );
  } catch (e) {
    logError(`GET student notifications traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.patch('/student/notifications/:id/read', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const sid = studentIdFromReq(req);
    const nid = Number(String(req.params.id || '').trim());
    if (!sid || !Number.isFinite(nid)) return bad(req, res, 400, 40003, '参数无效');
    await getPool().query(
      `UPDATE notifications SET is_read = true WHERE id = $1 AND receiver_id = $2`,
      [nid, sid]
    );
    return ok(req, res, { ok: true });
  } catch (e) {
    logError(`PATCH notification read traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

export default router;
