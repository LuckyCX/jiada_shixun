import { Router } from 'express';
import { getPool } from '../lib/db.js';
import { logError } from '../lib/logError.js';
import { requireAuth, requireStudent, requireTeacher } from '../middleware/auth.js';

const router = Router();

const MAX_JSON_BYTES = 1_000_000;

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

function userIdFromReq(req) {
  return parseId(req.user?.sub);
}

function jsonByteSize(obj) {
  try {
    return Buffer.byteLength(JSON.stringify(obj), 'utf8');
  } catch {
    return MAX_JSON_BYTES + 1;
  }
}

async function teacherOwnsClass(pool, teacherId, classId) {
  const { rows } = await pool.query(
    `SELECT id, name FROM teacher_personal_classes WHERE id = $1 AND teacher_id = $2`,
    [classId, teacherId]
  );
  return rows[0] || null;
}

async function studentEnrolledInClass(pool, studentId, classId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM teacher_personal_class_students
     WHERE teacher_personal_class_id = $1 AND student_id = $2`,
    [classId, studentId]
  );
  return rows.length > 0;
}

async function loadRoom(classId) {
  const { rows } = await getPool().query(
    `SELECT map_layout AS "mapLayout", session_config AS "sessionConfig", updated_at AS "updatedAt"
     FROM econoverse_class_rooms
     WHERE teacher_personal_class_id = $1`,
    [classId]
  );
  if (!rows.length) return null;
  const r = rows[0];
  return {
    mapLayout: r.mapLayout ?? null,
    sessionConfig: r.sessionConfig ?? null,
    updatedAt: r.updatedAt,
  };
}

/** 教师读取本班创世纪房间配置 */
router.get(
  '/teacher/personal-classes/:classId/econoverse/room',
  requireAuth(),
  requireTeacher(),
  async (req, res) => {
    try {
      const tid = userIdFromReq(req);
      const classId = parseId(req.params.classId);
      if (!tid || !classId) return bad(req, res, 400, 40001, '参数无效');
      const pool = getPool();
      if (!(await teacherOwnsClass(pool, tid, classId))) {
        return bad(req, res, 403, 40301, '无权访问该班级');
      }
      const room = await loadRoom(classId);
      return ok(req, res, room);
    } catch (e) {
      logError(`GET teacher econoverse room traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

/** 教师发布/更新本班地图与实训节奏 */
router.put(
  '/teacher/personal-classes/:classId/econoverse/room',
  requireAuth(),
  requireTeacher(),
  async (req, res) => {
    try {
      const tid = userIdFromReq(req);
      const classId = parseId(req.params.classId);
      if (!tid || !classId) return bad(req, res, 400, 40001, '参数无效');
      const pool = getPool();
      if (!(await teacherOwnsClass(pool, tid, classId))) {
        return bad(req, res, 403, 40301, '无权访问该班级');
      }
      const mapLayout = req.body?.mapLayout;
      const sessionConfig = req.body?.sessionConfig;
      if (mapLayout != null && (typeof mapLayout !== 'object' || Array.isArray(mapLayout))) {
        return bad(req, res, 400, 40002, 'mapLayout 无效');
      }
      if (sessionConfig != null && (typeof sessionConfig !== 'object' || Array.isArray(sessionConfig))) {
        return bad(req, res, 400, 40003, 'sessionConfig 无效');
      }
      if (mapLayout != null && jsonByteSize(mapLayout) > MAX_JSON_BYTES) {
        return bad(req, res, 413, 41301, 'mapLayout 过大');
      }
      if (sessionConfig != null && jsonByteSize(sessionConfig) > MAX_JSON_BYTES) {
        return bad(req, res, 413, 41302, 'sessionConfig 过大');
      }
      await pool.query(
        `INSERT INTO econoverse_class_rooms (teacher_personal_class_id, teacher_id, map_layout, session_config, updated_at)
         VALUES ($1, $2, $3::jsonb, $4::jsonb, now())
         ON CONFLICT (teacher_personal_class_id) DO UPDATE
           SET map_layout = EXCLUDED.map_layout,
               session_config = EXCLUDED.session_config,
               updated_at = now()`,
        [
          classId,
          tid,
          mapLayout != null ? JSON.stringify(mapLayout) : null,
          sessionConfig != null ? JSON.stringify(sessionConfig) : null,
        ]
      );
      return ok(req, res, { saved: true });
    } catch (e) {
      logError(`PUT teacher econoverse room traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

/** 教师清除本班已发布配置 */
router.delete(
  '/teacher/personal-classes/:classId/econoverse/room',
  requireAuth(),
  requireTeacher(),
  async (req, res) => {
    try {
      const tid = userIdFromReq(req);
      const classId = parseId(req.params.classId);
      if (!tid || !classId) return bad(req, res, 400, 40001, '参数无效');
      const pool = getPool();
      if (!(await teacherOwnsClass(pool, tid, classId))) {
        return bad(req, res, 403, 40301, '无权访问该班级');
      }
      await pool.query(`DELETE FROM econoverse_class_rooms WHERE teacher_personal_class_id = $1`, [classId]);
      return ok(req, res, { deleted: true });
    } catch (e) {
      logError(`DELETE teacher econoverse room traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

/** 学生读取已加入班级的创世纪房间配置 */
router.get(
  '/student/personal-classes/:classId/econoverse/room',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const sid = userIdFromReq(req);
      const classId = parseId(req.params.classId);
      if (!sid || !classId) return bad(req, res, 400, 40001, '参数无效');
      const pool = getPool();
      if (!(await studentEnrolledInClass(pool, sid, classId))) {
        return bad(req, res, 403, 40301, '未加入该班级');
      }
      const room = await loadRoom(classId);
      return ok(req, res, room);
    } catch (e) {
      logError(`GET student econoverse room traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

export default router;
