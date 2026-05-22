import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import multer from 'multer';
import { getPool } from '../lib/db.js';
import { logError } from '../lib/logError.js';
import { requireAuth, requireTeacher, requireStudent } from '../middleware/auth.js';
import { getEnabledProvider, chatCompletionStream, getPromptModules } from '../lib/llmGateway.js';
import { normalizeMatchedRole, TEAM_ROLE_LABELS } from '../lib/teamFormationConstants.js';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_ROOT = path.join(__dirname, '../../uploads/team-formation');
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

function ok(req, res, data, message = 'OK') {
  return res.json({ code: 0, message, data, traceId: req.traceId });
}

function bad(req, res, status, code, message) {
  return res.status(status).json({ code, message, data: null, traceId: req.traceId });
}

function teacherIdFromReq(req) {
  const id = Number(String(req.user?.sub || '').trim());
  return Number.isFinite(id) && id > 0 ? id : null;
}

function studentIdFromReq(req) {
  const id = Number(String(req.user?.sub || '').trim());
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function ownsPersonalClass(pool, teacherId, classId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM teacher_personal_classes WHERE id = $1 AND teacher_id = $2`,
    [classId, teacherId]
  );
  return rows.length > 0;
}

async function studentEnrolledInClass(pool, studentId, classId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM teacher_personal_class_students WHERE teacher_personal_class_id = $1 AND student_id = $2`,
    [classId, studentId]
  );
  return rows.length > 0;
}

function parseClassId(param) {
  const classId = Number(String(param || '').trim());
  return Number.isFinite(classId) && classId > 0 ? classId : null;
}

function mapQuestionRow(r) {
  return {
    id: String(r.id),
    sortOrder: r.sort_order,
    title: r.title,
    questionType: r.question_type,
    options: Array.isArray(r.options) ? r.options : r.options || [],
    required: r.required !== false,
  };
}

function validateQuestionsPayload(questions) {
  if (!Array.isArray(questions) || questions.length < 3 || questions.length > 10) {
    return '题目数量须在 3～10 道之间';
  }
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const title = String(q?.title || '').trim();
    const type = q?.questionType || q?.question_type;
    if (!title) return `第 ${i + 1} 题标题不能为空`;
    if (!['single', 'multi', 'short'].includes(type)) return `第 ${i + 1} 题题型无效`;
    if (type === 'short') continue;
    const opts = q?.options;
    if (!Array.isArray(opts) || opts.length < 1 || opts.length > 6) {
      return `第 ${i + 1} 题选项数量须在 1～6 个之间`;
    }
    for (const o of opts) {
      if (!String(o?.label || '').trim()) return `第 ${i + 1} 题选项文案不能为空`;
    }
  }
  return null;
}

function formatAnswersForLlm(questions, answers) {
  const lines = [];
  for (const q of questions) {
    const raw = answers[String(q.id)];
    if (raw == null || raw === '') continue;
    let text = '';
    if (q.questionType === 'short') {
      text = String(raw).slice(0, 100);
    } else if (q.questionType === 'multi' && Array.isArray(raw)) {
      const labels = raw.map((v) => {
        const opt = (q.options || []).find((o) => String(o.value) === String(v) || String(o.label) === String(v));
        return opt?.label || String(v);
      });
      text = labels.join('、');
    } else {
      const opt = (q.options || []).find((o) => String(o.value) === String(raw) || String(o.label) === String(raw));
      text = opt?.label || String(raw);
    }
    lines.push(`Q: ${q.title}\nA: ${text}`);
  }
  return lines.join('\n\n');
}

function sseWrite(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
  if (typeof res.flush === 'function') res.flush();
}

function extractJsonFromLlmText(text) {
  const t = String(text || '').trim();
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      /* ignore */
    }
  }
  const start = t.lastIndexOf('{');
  const end = t.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(t.slice(start, end + 1));
    } catch {
      /* ignore */
    }
  }
  return null;
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const classId = parseClassId(req.body?.classId);
    const sid = studentIdFromReq(req);
    if (!classId || !sid) return cb(new Error('无效班级或用户'));
    const dir = path.join(UPLOAD_ROOT, String(classId), String(sid));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname || '') || '.mp4';
    cb(null, `${randomUUID()}${ext}`);
  },
});

const uploadVideo = multer({
  storage,
  limits: { fileSize: MAX_VIDEO_BYTES },
  fileFilter(_req, file, cb) {
    if (file.mimetype && file.mimetype.startsWith('video/')) cb(null, true);
    else cb(new Error('仅支持视频文件'));
  },
});

/** ── 教师：预设题 ── */
router.get(
  '/teacher/personal-classes/:classId/team-questions',
  requireAuth(),
  requireTeacher(),
  async (req, res) => {
    try {
      const tid = teacherIdFromReq(req);
      const classId = parseClassId(req.params.classId);
      if (!tid || !classId) return bad(req, res, 400, 40003, '参数无效');
      const pool = getPool();
      if (!(await ownsPersonalClass(pool, tid, classId))) {
        return bad(req, res, 404, 40402, '班级不存在或无权操作');
      }
      const { rows } = await pool.query(
        `SELECT id, sort_order, title, question_type, options, required
         FROM teacher_personal_class_team_questions
         WHERE teacher_personal_class_id = $1
         ORDER BY sort_order ASC, id ASC`,
        [classId]
      );
      return ok(req, res, rows.map(mapQuestionRow));
    } catch (e) {
      logError(`GET team-questions traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.put(
  '/teacher/personal-classes/:classId/team-questions',
  requireAuth(),
  requireTeacher(),
  async (req, res) => {
    try {
      const tid = teacherIdFromReq(req);
      const classId = parseClassId(req.params.classId);
      const questions = req.body?.questions;
      const err = validateQuestionsPayload(questions);
      if (err) return bad(req, res, 400, 40010, err);
      if (!tid || !classId) return bad(req, res, 400, 40003, '参数无效');
      const pool = getPool();
      if (!(await ownsPersonalClass(pool, tid, classId))) {
        return bad(req, res, 404, 40402, '班级不存在或无权操作');
      }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`DELETE FROM teacher_personal_class_team_questions WHERE teacher_personal_class_id = $1`, [
          classId,
        ]);
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          const type = q.questionType || q.question_type;
          const opts = type === 'short' ? [] : q.options || [];
          await client.query(
            `INSERT INTO teacher_personal_class_team_questions
             (teacher_personal_class_id, sort_order, title, question_type, options, required)
             VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
            [classId, i, String(q.title).trim(), type, JSON.stringify(opts), q.required !== false]
          );
        }
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
      const { rows } = await pool.query(
        `SELECT id, sort_order, title, question_type, options, required
         FROM teacher_personal_class_team_questions
         WHERE teacher_personal_class_id = $1 ORDER BY sort_order ASC`,
        [classId]
      );
      return ok(req, res, rows.map(mapQuestionRow));
    } catch (e) {
      logError(`PUT team-questions traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.get(
  '/teacher/personal-classes/:classId/team-formation/pending-students',
  requireAuth(),
  requireTeacher(),
  async (req, res) => {
    try {
      const tid = teacherIdFromReq(req);
      const classId = parseClassId(req.params.classId);
      if (!tid || !classId) return bad(req, res, 400, 40003, '参数无效');
      const pool = getPool();
      if (!(await ownsPersonalClass(pool, tid, classId))) {
        return bad(req, res, 404, 40402, '班级不存在或无权操作');
      }
      const { rows } = await pool.query(
        `SELECT u.id, u.real_name AS name, u.student_no AS "studentNo", u.email,
                s.ai_matched_role AS "aiMatchedRole", s.answers, s.video_transcript AS "videoTranscript",
                s.submitted_at AS "submittedAt"
         FROM student_team_formation_submissions s
         JOIN users u ON u.id = s.student_id
         WHERE s.teacher_personal_class_id = $1 AND s.status = 'pending_teacher'
         ORDER BY s.submitted_at ASC NULLS LAST, u.id ASC`,
        [classId]
      );
      return ok(
        req,
        res,
        rows.map((r) => ({
          id: String(r.id),
          name: r.name || r.email || '',
          studentId: r.studentNo || '',
          studentNo: r.studentNo || '',
          email: r.email || '',
          major: '',
          grade: '',
          avatar: '',
          aiMatchedRole: r.aiMatchedRole || '',
          aiMatchedRoleLabel: TEAM_ROLE_LABELS[r.aiMatchedRole] || r.aiMatchedRole || '',
          status: 'pending',
          profile: { techGeek: 0, designAesthetic: 0, businessOperator: 0 },
          skills: [],
        }))
      );
    } catch (e) {
      logError(`GET pending-students traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

/** ── 学生 ── */
router.get('/student/team-formation/questions', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const sid = studentIdFromReq(req);
    const classId = parseClassId(req.query.classId);
    if (!sid || !classId) return bad(req, res, 400, 40003, '参数无效');
    const pool = getPool();
    if (!(await studentEnrolledInClass(pool, sid, classId))) {
      return bad(req, res, 403, 40301, '未加入该班级');
    }
    const { rows } = await pool.query(
      `SELECT id, sort_order, title, question_type, options, required
       FROM teacher_personal_class_team_questions
       WHERE teacher_personal_class_id = $1
       ORDER BY sort_order ASC, id ASC`,
      [classId]
    );
    return ok(req, res, rows.map(mapQuestionRow));
  } catch (e) {
    logError(`GET student questions traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.get('/student/team-formation/submission', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const sid = studentIdFromReq(req);
    const classId = parseClassId(req.query.classId);
    if (!sid || !classId) return bad(req, res, 400, 40003, '参数无效');
    const pool = getPool();
    if (!(await studentEnrolledInClass(pool, sid, classId))) {
      return bad(req, res, 403, 40301, '未加入该班级');
    }
    const { rows } = await pool.query(
      `SELECT status, answers, video_storage_key AS "videoStorageKey", video_transcript AS "videoTranscript",
              ai_matched_role AS "aiMatchedRole", submitted_at AS "submittedAt"
       FROM student_team_formation_submissions
       WHERE teacher_personal_class_id = $1 AND student_id = $2`,
      [classId, sid]
    );
    if (!rows.length) {
      return ok(req, res, {
        status: null,
        answers: {},
        videoStorageKey: null,
        videoTranscript: null,
        aiMatchedRole: null,
        aiMatchedRoleLabel: null,
        submittedAt: null,
      });
    }
    const r = rows[0];
    const role = r.aiMatchedRole;
    return ok(req, res, {
      status: r.status,
      answers: r.answers || {},
      videoStorageKey: r.videoStorageKey,
      videoTranscript: r.videoTranscript,
      aiMatchedRole: role,
      aiMatchedRoleLabel: role ? TEAM_ROLE_LABELS[role] || role : null,
      submittedAt: r.submittedAt ? new Date(r.submittedAt).toISOString() : null,
    });
  } catch (e) {
    logError(`GET student submission traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.put('/student/team-formation/answers', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const sid = studentIdFromReq(req);
    const classId = parseClassId(req.body?.classId);
    const answers = req.body?.answers;
    if (!sid || !classId || !answers || typeof answers !== 'object') {
      return bad(req, res, 400, 40003, '参数无效');
    }
    const pool = getPool();
    if (!(await studentEnrolledInClass(pool, sid, classId))) {
      return bad(req, res, 403, 40301, '未加入该班级');
    }
    await pool.query(
      `INSERT INTO student_team_formation_submissions (teacher_personal_class_id, student_id, status, answers)
       VALUES ($1, $2, 'draft', $3::jsonb)
       ON CONFLICT (teacher_personal_class_id, student_id) DO UPDATE SET
         answers = EXCLUDED.answers,
         updated_at = now()
       WHERE student_team_formation_submissions.status = 'draft'`,
      [classId, sid, JSON.stringify(answers)]
    );
    const { rows } = await pool.query(
      `SELECT status, answers FROM student_team_formation_submissions
       WHERE teacher_personal_class_id = $1 AND student_id = $2`,
      [classId, sid]
    );
    return ok(req, res, { status: rows[0]?.status || 'draft', answers: rows[0]?.answers || {} });
  } catch (e) {
    logError(`PUT student answers traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.post(
  '/student/team-formation/video',
  requireAuth(),
  requireStudent(),
  (req, res, next) => {
    uploadVideo.single('video')(req, res, (err) => {
      if (err) {
        const msg = err.code === 'LIMIT_FILE_SIZE' ? '视频不能超过 50MB' : err.message;
        return bad(req, res, 400, 40010, msg);
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const sid = studentIdFromReq(req);
      const classId = parseClassId(req.body?.classId);
      if (!sid || !classId || !req.file) return bad(req, res, 400, 40003, '参数无效');
      const pool = getPool();
      if (!(await studentEnrolledInClass(pool, sid, classId))) {
        return bad(req, res, 403, 40301, '未加入该班级');
      }
      const relKey = path.relative(path.join(__dirname, '../..'), req.file.path).replace(/\\/g, '/');
      await pool.query(
        `INSERT INTO student_team_formation_submissions (teacher_personal_class_id, student_id, status, video_storage_key)
         VALUES ($1, $2, 'draft', $3)
         ON CONFLICT (teacher_personal_class_id, student_id) DO UPDATE SET
           video_storage_key = EXCLUDED.video_storage_key,
           updated_at = now()
         WHERE student_team_formation_submissions.status IN ('draft', 'pending_teacher')`,
        [classId, sid, relKey]
      );
      return ok(req, res, { videoStorageKey: relKey, fileName: req.file.originalname });
    } catch (e) {
      logError(`POST student video traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.post('/student/team-formation/analyze', requireAuth(), requireStudent(), async (req, res) => {
  const sid = studentIdFromReq(req);
  const classId = parseClassId(req.body?.classId);
  const wantStream =
    req.body?.stream === true ||
    String(req.get('accept') || '').includes('text/event-stream');

  try {
    if (!sid || !classId) return bad(req, res, 400, 40003, '参数无效');
    const pool = getPool();
    if (!(await studentEnrolledInClass(pool, sid, classId))) {
      return bad(req, res, 403, 40301, '未加入该班级');
    }
    const { rows: qRows } = await pool.query(
      `SELECT id, sort_order, title, question_type, options FROM teacher_personal_class_team_questions
       WHERE teacher_personal_class_id = $1 ORDER BY sort_order ASC`,
      [classId]
    );
    if (qRows.length < 3) return bad(req, res, 400, 40010, '教师尚未配置足够的组队测评题');
    const questions = qRows.map(mapQuestionRow);

    const { rows: sRows } = await pool.query(
      `SELECT answers, video_storage_key FROM student_team_formation_submissions
       WHERE teacher_personal_class_id = $1 AND student_id = $2`,
      [classId, sid]
    );
    if (!sRows.length) return bad(req, res, 400, 40010, '请先保存答题');
    const sub = sRows[0];
    if (!sub.video_storage_key) return bad(req, res, 400, 40010, '请先上传视频');

    const answers = sub.answers || {};
    const qaText = formatAnswersForLlm(questions, answers);
    const videoKey = String(sub.video_storage_key || '');
    const videoFileName = path.basename(videoKey);

    const prompts = await getPromptModules();
    const tf = prompts.team_formation || {};
    const roleDefs = JSON.stringify(tf.role_definitions || [], null, 2);

    const provider = await getEnabledProvider('multimodal');
    if (!provider) return bad(req, res, 400, 40011, '未配置已启用的多模态模型');

    const matchSystem = `${String(tf.match_system || '').trim()}

可选角色定义：
${roleDefs}

你必须同时综合以下材料，缺一不可：
1）下方全部问卷题目与学生的每道题作答；
2）学生已上传的自我介绍视频（文件已落库，文件名见用户消息）。

分析要求：
- 角色匹配必须同时考虑问卷倾向与视频自我介绍表达，不得只根据其中一项下结论。
- 在正文里简要说明如何从问卷与视频两方面得出判断。
- 回复最后一行必须是单独一个 JSON 对象（不要 markdown 代码块），字段：
  matchedRole（ceo|product_rd|market_director|marketing_ops|sales|finance）
  confidence（0-1 数字）
  summary（面向教师的简短中文结论，说明问卷+视频的综合依据）
  videoTranscript（结合问卷与视频内容的口语化转写摘要，勿编造未出现的人名与事件）`;

    const userMsg = `【问卷题目与作答】\n${qaText}\n\n【自我介绍视频】\n已上传文件：${videoFileName}\n存储键：${videoKey}\n请与问卷作答一并综合评估；若无法读取视频二进制，请明确说明并仍须结合作答与上传事实做合理综合推断，videoTranscript 字段需体现「问卷+视频」而非仅问卷。`;

    if (!wantStream) {
      return bad(req, res, 400, 40012, '请使用流式分析（stream: true）');
    }

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    sseWrite(res, 'status', { message: '正在连接模型，综合问卷与视频分析…' });

    let inThinkingTag = false;
    const onEvent = ({ kind, text }) => {
      if (!text) return;
      if (kind === 'thinking') {
        sseWrite(res, 'thinking', { text });
        return;
      }
      let chunk = text;
      const thinkOpen = ['<', 'think', '>'].join('');
      const thinkClose = ['<', '/', 'think', '>'].join('');
      if (chunk.includes(thinkOpen)) {
        inThinkingTag = true;
        chunk = chunk.split(thinkOpen).join('');
      }
      if (chunk.includes(thinkClose)) {
        inThinkingTag = false;
        const parts = chunk.split(thinkClose);
        if (parts[0]) sseWrite(res, 'thinking', { text: parts[0] });
        chunk = parts.slice(1).join(thinkClose);
      }
      if (inThinkingTag) {
        sseWrite(res, 'thinking', { text: chunk });
      } else if (chunk) {
        sseWrite(res, 'content', { text: chunk });
      }
    };

    let fullText = '';
    try {
      fullText = await chatCompletionStream({
        provider,
        system: matchSystem,
        user: userMsg,
        onEvent,
      });
    } catch (e) {
      sseWrite(res, 'error', { message: e.message || '模型调用失败' });
      res.end();
      return;
    }

    const parsed = extractJsonFromLlmText(fullText) || {};
    const matchedRole = normalizeMatchedRole(parsed.matchedRole);
    if (!matchedRole) {
      sseWrite(res, 'error', { message: 'AI 未返回有效角色，请重试' });
      res.end();
      return;
    }

    const transcript = String(parsed.videoTranscript || '').trim();
    const summary = String(parsed.summary || '').trim();

    await pool.query(
      `UPDATE student_team_formation_submissions SET
         video_transcript = $3,
         ai_matched_role = $4,
         ai_analysis_raw = $5::jsonb,
         updated_at = now()
       WHERE teacher_personal_class_id = $1 AND student_id = $2`,
      [
        classId,
        sid,
        transcript,
        matchedRole,
        JSON.stringify({ fullText, match: parsed }),
      ]
    );

    sseWrite(res, 'done', {
      aiMatchedRole: matchedRole,
      aiMatchedRoleLabel: TEAM_ROLE_LABELS[matchedRole],
      videoTranscript: transcript,
      summary,
      confidence: parsed.confidence,
    });
    res.end();
  } catch (e) {
    logError(`POST analyze traceId=${req.traceId}`, e);
    if (!res.headersSent) {
      return bad(req, res, 500, 50000, e.message);
    }
    try {
      sseWrite(res, 'error', { message: e.message || '分析失败' });
      res.end();
    } catch {
      /* ignore */
    }
  }
});

router.post('/student/team-formation/reset-assessment', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const sid = studentIdFromReq(req);
    const classId = parseClassId(req.body?.classId);
    if (!sid || !classId) return bad(req, res, 400, 40003, '参数无效');
    const pool = getPool();
    if (!(await studentEnrolledInClass(pool, sid, classId))) {
      return bad(req, res, 403, 40301, '未加入该班级');
    }
    const { rows } = await pool.query(
      `SELECT status FROM student_team_formation_submissions
       WHERE teacher_personal_class_id = $1 AND student_id = $2`,
      [classId, sid]
    );
    if (!rows.length) {
      await pool.query(
        `INSERT INTO student_team_formation_submissions (teacher_personal_class_id, student_id, status, answers)
         VALUES ($1, $2, 'draft', '{}'::jsonb)`,
        [classId, sid]
      );
      return ok(req, res, { ok: true });
    }
    if (rows[0].status === 'grouped' || rows[0].status === 'confirmed') {
      return bad(req, res, 400, 40010, '已组队，无法重新测评');
    }
    await pool.query(
      `UPDATE student_team_formation_submissions SET
         answers = '{}'::jsonb,
         video_transcript = null,
         ai_matched_role = null,
         ai_analysis_raw = null,
         status = 'draft',
         submitted_at = null,
         updated_at = now()
       WHERE teacher_personal_class_id = $1 AND student_id = $2`,
      [classId, sid]
    );
    return ok(req, res, { ok: true });
  } catch (e) {
    logError(`POST reset-assessment traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.delete('/student/team-formation/video', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const sid = studentIdFromReq(req);
    const classId = parseClassId(req.query?.classId ?? req.body?.classId);
    if (!sid || !classId) return bad(req, res, 400, 40003, '参数无效');
    const pool = getPool();
    if (!(await studentEnrolledInClass(pool, sid, classId))) {
      return bad(req, res, 403, 40301, '未加入该班级');
    }
    const { rows } = await pool.query(
      `SELECT video_storage_key FROM student_team_formation_submissions
       WHERE teacher_personal_class_id = $1 AND student_id = $2`,
      [classId, sid]
    );
    const key = rows[0]?.video_storage_key;
    if (key) {
      const abs = path.join(__dirname, '../..', String(key));
      try {
        if (fs.existsSync(abs)) fs.unlinkSync(abs);
      } catch (e) {
        logError(`unlink video traceId=${req.traceId}`, e);
      }
    }
    await pool.query(
      `UPDATE student_team_formation_submissions SET
         video_storage_key = null,
         video_transcript = null,
         ai_matched_role = null,
         ai_analysis_raw = null,
         status = 'draft',
         submitted_at = null,
         updated_at = now()
       WHERE teacher_personal_class_id = $1 AND student_id = $2`,
      [classId, sid]
    );
    return ok(req, res, { ok: true });
  } catch (e) {
    logError(`DELETE student video traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.post('/student/team-formation/submit', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const sid = studentIdFromReq(req);
    const classId = parseClassId(req.body?.classId);
    if (!sid || !classId) return bad(req, res, 400, 40003, '参数无效');
    const pool = getPool();
    if (!(await studentEnrolledInClass(pool, sid, classId))) {
      return bad(req, res, 403, 40301, '未加入该班级');
    }
    const { rows } = await pool.query(
      `SELECT ai_matched_role, video_storage_key FROM student_team_formation_submissions
       WHERE teacher_personal_class_id = $1 AND student_id = $2`,
      [classId, sid]
    );
    if (!rows.length || !rows[0].ai_matched_role || !rows[0].video_storage_key) {
      return bad(req, res, 400, 40010, '请先完成答题、上传视频并完成 AI 分析');
    }
    await pool.query(
      `UPDATE student_team_formation_submissions SET
         status = 'pending_teacher',
         submitted_at = now(),
         updated_at = now()
       WHERE teacher_personal_class_id = $1 AND student_id = $2`,
      [classId, sid]
    );
    return ok(req, res, { status: 'pending_teacher' });
  } catch (e) {
    logError(`POST submit traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

export default router;
