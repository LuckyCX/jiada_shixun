import { Router } from 'express';
import { getPool } from '../lib/db.js';
import { logError } from '../lib/logError.js';
import { requireAuth, requireStudent } from '../middleware/auth.js';
import { evaluateModulePrerequisiteForStudent } from '../lib/trainingModulePrerequisite.js';

const router = Router();

const STAGE_KEYS = new Set(['ideation', 'market', 'product', 'business', 'simulation', 'plan']);

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

function parseId(param) {
  const id = Number(String(param || '').trim());
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function studentEnrolledInClass(pool, studentId, classId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM teacher_personal_class_students WHERE teacher_personal_class_id = $1 AND student_id = $2`,
    [classId, studentId]
  );
  return rows.length > 0;
}

router.get(
  '/student/personal-classes/:classId/training-modules/:moduleKey/prerequisite',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const sid = studentIdFromReq(req);
      const classId = parseId(req.params.classId);
      const moduleKey = String(req.params.moduleKey || '').trim();
      if (!sid || !classId) return bad(req, res, 400, 40003, '参数无效');
      if (!STAGE_KEYS.has(moduleKey)) return bad(req, res, 400, 40004, '无效实训模块');

      const pool = getPool();
      if (!(await studentEnrolledInClass(pool, sid, classId))) {
        return bad(req, res, 403, 40301, '未加入该班级');
      }

      const result = await evaluateModulePrerequisiteForStudent(pool, sid, moduleKey);
      return ok(req, res, {
        allowed: result.allowed,
        prerequisiteModuleKey: moduleKey,
        requiredKnowledgePointCount: result.requiredKnowledgePointCount,
        passedKnowledgePointCount: result.passedKnowledgePointCount,
        ...result,
      });
    } catch (e) {
      logError(`GET training prerequisite traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

export default router;
