import { Router } from 'express';
import { getPool } from '../lib/db.js';
import { logError } from '../lib/logError.js';
import { normalizeUploadFileName } from '../lib/uploadFileName.js';
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

function parseId(val) {
  const id = Number(String(val || '').trim());
  return Number.isFinite(id) && id > 0 ? id : null;
}

function formatTs(val) {
  if (!val) return '';
  const d = val instanceof Date ? val : new Date(val);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('zh-CN');
}

async function studentEnrolledInClass(pool, studentId, classId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM teacher_personal_class_students WHERE teacher_personal_class_id = $1 AND student_id = $2`,
    [classId, studentId]
  );
  return rows.length > 0;
}

router.get(
  '/student/personal-classes/:classId/archive',
  requireAuth(),
  requireStudent(),
  async (req, res) => {
    try {
      const sid = studentIdFromReq(req);
      const classId = parseId(req.params.classId);
      if (!sid || !classId) return bad(req, res, 400, 40001, '参数无效');

      const pool = getPool();
      if (!(await studentEnrolledInClass(pool, sid, classId))) {
        return bad(req, res, 403, 40301, '未加入该班级');
      }

      const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));

      const [{ rows: knowledgeRows }, { rows: caseCountRows }, { rows: taskCountRows }] = await Promise.all([
        pool.query(
          `SELECT COUNT(DISTINCT q.knowledge_point_id)::int AS c
           FROM quiz_attempts a
           JOIN quizzes q ON q.id = a.quiz_id
           WHERE a.user_id = $1 AND a.passed = true`,
          [sid]
        ),
        pool.query(
          `SELECT COUNT(DISTINCT f.id)::int AS c
           FROM student_course_resource_progress p
           JOIN course_resource_files f ON f.content_hash = p.content_hash
           WHERE p.user_id = $1
             AND p.progress_percent > 0
             AND f.resource_type = 'case'`,
          [sid]
        ),
        pool.query(
          `SELECT COUNT(*)::int AS c
           FROM student_personal_class_task_completions c
           JOIN teacher_personal_class_tasks t ON t.id = c.task_id
           WHERE c.student_id = $1 AND t.teacher_personal_class_id = $2`,
          [sid, classId]
        ),
      ]);

      const records = [];

      // 案例参考（资源学习进度）
      const { rows: caseRows } = await pool.query(
        `SELECT p.id AS progress_id,
                p.completed_at,
                COALESCE(p.completed_at, p.updated_at) AS ts,
                f.origin_name,
                n.module_name
         FROM student_course_resource_progress p
         JOIN course_resource_files f ON f.content_hash = p.content_hash
         LEFT JOIN course_resource_nodes n ON n.id = f.node_id
         WHERE p.user_id = $1
           AND p.progress_percent > 0
           AND f.resource_type = 'case'
         ORDER BY ts DESC
         LIMIT $2`,
        [sid, limit]
      );
      for (const r of caseRows) {
        records.push({
          id: `case-${r.progress_id}`,
          type: 'case',
          title: normalizeUploadFileName(r.origin_name || '案例'),
          module: r.module_name || '案例参考',
          date: formatTs(r.ts),
          status: r.completed_at ? '已完成' : '已记录',
          score: null,
          ts: r.ts ? new Date(r.ts).getTime() : 0,
        });
      }

      // 实践任务（完成）
      const { rows: taskRows } = await pool.query(
        `SELECT c.task_id,
                c.completed_at AS ts,
                t.title,
                t.module
         FROM student_personal_class_task_completions c
         JOIN teacher_personal_class_tasks t ON t.id = c.task_id
         WHERE c.student_id = $1 AND t.teacher_personal_class_id = $2
         ORDER BY c.completed_at DESC
         LIMIT $3`,
        [sid, classId, limit]
      );
      for (const r of taskRows) {
        records.push({
          id: `task-${r.task_id}`,
          type: 'task',
          title: r.title || '实践任务',
          module: r.module || '实践任务',
          date: formatTs(r.ts),
          status: '已完成',
          score: null,
          ts: r.ts ? new Date(r.ts).getTime() : 0,
        });
      }

      // 教师评价（通知 evaluation）
      const { rows: evalNoticeRows } = await pool.query(
        `SELECT n.id, n.title, n.content, n.sent_at AS ts
         FROM notifications n
         WHERE n.receiver_id = $1 AND n.type = 'evaluation'
         ORDER BY n.sent_at DESC
         LIMIT $2`,
        [sid, limit]
      );
      for (const r of evalNoticeRows) {
        records.push({
          id: `evaluation-notice-${r.id}`,
          type: 'evaluation',
          title: r.title || '教师评价',
          module: '教师评价',
          date: formatTs(r.ts),
          status: '已评价',
          score: null,
          ts: r.ts ? new Date(r.ts).getTime() : 0,
        });
      }

      // 商业计划书提交/审核（评价类事件）
      const { rows: teamRows } = await pool.query(
        `SELECT t.id AS team_id
         FROM teacher_personal_class_team_members m
         JOIN teacher_personal_class_teams t ON t.id = m.team_id
         WHERE t.teacher_personal_class_id = $1 AND m.student_id = $2
         ORDER BY t.id ASC
         LIMIT 1`,
        [classId, sid]
      );
      const teamId = teamRows[0]?.team_id ?? null;
      if (teamId) {
        const { rows: subRows } = await pool.query(
          `SELECT status, submitted_at, reviewed_at, review_comment
           FROM teacher_personal_class_team_business_plan_submissions
           WHERE teacher_personal_class_id = $1 AND team_id = $2
           LIMIT 1`,
          [classId, teamId]
        );
        const s = subRows[0] || null;
        if (s?.submitted_at) {
          records.push({
            id: `evaluation-plan-submitted-${teamId}`,
            type: 'evaluation',
            title: '提交最终商业计划书',
            module: '商业计划书',
            date: formatTs(s.submitted_at),
            status: '已提交审核',
            score: null,
            ts: new Date(s.submitted_at).getTime(),
          });
        }
        if (s?.reviewed_at) {
          records.push({
            id: `evaluation-plan-reviewed-${teamId}`,
            type: 'evaluation',
            title: s.status === 'approved' ? '商业计划书审核通过' : '商业计划书审核未通过',
            module: '商业计划书',
            date: formatTs(s.reviewed_at),
            status: s.status === 'approved' ? '已通过' : '已驳回',
            score: null,
            ts: new Date(s.reviewed_at).getTime(),
            content: String(s.review_comment || '').trim() || null,
          });
        }
      }

      // 合并排序并截断
      records.sort((a, b) => (b.ts || 0) - (a.ts || 0));
      const sliced = records.slice(0, limit).map(({ ts, ...rest }) => rest);

      const evaluationCount = sliced.filter((r) => r.type === 'evaluation').length;

      return ok(req, res, {
        stats: {
          knowledgeCount: knowledgeRows[0]?.c ?? 0,
          caseCount: caseCountRows[0]?.c ?? 0,
          taskCount: taskCountRows[0]?.c ?? 0,
          evaluationCount,
        },
        records: sliced,
      });
    } catch (e) {
      logError(`GET /api/student/personal-classes/:classId/archive traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

export default router;

