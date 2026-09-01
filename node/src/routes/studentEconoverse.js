import { Router } from 'express';
import { getPool } from '../lib/db.js';
import { logError } from '../lib/logError.js';
import { requireAuth, requireStudent } from '../middleware/auth.js';

const router = Router();

/** 云存档体积上限（字节，JSON 字符串） */
const MAX_STATE_BYTES = 1_000_000;

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

/** 读取本人创世纪存档；无档返回 null */
router.get('/student/econoverse/save', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const sid = studentIdFromReq(req);
    if (!sid) return bad(req, res, 400, 40001, '无效用户');
    const { rows } = await getPool().query(
      `SELECT state, updated_at AS "updatedAt"
       FROM econoverse_saves
       WHERE student_id = $1`,
      [sid]
    );
    if (!rows.length) return ok(req, res, null);
    return ok(req, res, {
      state: rows[0].state,
      updatedAt: rows[0].updatedAt,
    });
  } catch (e) {
    logError(`GET /api/student/econoverse/save traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

/** 写入/覆盖本人创世纪存档（一人一档） */
router.put('/student/econoverse/save', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const sid = studentIdFromReq(req);
    if (!sid) return bad(req, res, 400, 40001, '无效用户');
    const state = req.body?.state;
    if (state == null || typeof state !== 'object' || Array.isArray(state)) {
      return bad(req, res, 400, 40002, '缺少有效 state');
    }
    let encoded;
    try {
      encoded = JSON.stringify(state);
    } catch {
      return bad(req, res, 400, 40003, 'state 无法序列化');
    }
    if (Buffer.byteLength(encoded, 'utf8') > MAX_STATE_BYTES) {
      return bad(req, res, 413, 41301, '存档过大');
    }
    await getPool().query(
      `INSERT INTO econoverse_saves (student_id, state, updated_at)
       VALUES ($1, $2::jsonb, now())
       ON CONFLICT (student_id) DO UPDATE
         SET state = EXCLUDED.state,
             updated_at = now()`,
      [sid, encoded]
    );
    return ok(req, res, { saved: true });
  } catch (e) {
    logError(`PUT /api/student/econoverse/save traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

/** 清空本人创世纪云档（重新开始） */
router.delete('/student/econoverse/save', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const sid = studentIdFromReq(req);
    if (!sid) return bad(req, res, 400, 40001, '无效用户');
    await getPool().query(`DELETE FROM econoverse_saves WHERE student_id = $1`, [sid]);
    return ok(req, res, { deleted: true });
  } catch (e) {
    logError(`DELETE /api/student/econoverse/save traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

export default router;
