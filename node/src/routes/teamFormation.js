import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import multer from 'multer';
import { getPool } from '../lib/db.js';
import { logError } from '../lib/logError.js';
import { requireAuth, requireTeacher, requireStudent } from '../middleware/auth.js';
import {
  getEnabledProvider,
  chatCompletionStream,
  getPromptModules,
  friendlyLlmErrorMessage,
} from '../lib/llmGateway.js';
import { normalizeMatchedRole, TEAM_ROLE_LABELS } from '../lib/teamFormationConstants.js';
import {
  DIMENSION_SCORING_PROMPT,
  parseDimensionScores,
  resolveMatchedRoleFromScores,
  profileFromAnalysisRaw,
  extractTeamFormationMatchJson,
  narrativeBeforeJson,
  scoresArePlausible,
  estimateDimensionScoresFromQa,
  computeComplementScore,
} from '../lib/teamFormationDimension.js';
import {
  runAiTeamGroupingStream,
  pickDefaultLeaderStudentId,
  MIN_PENDING_FOR_AI,
  MAX_TEAM_SIZE,
  MIN_TEAM_SIZE,
} from '../lib/teamFormationAiGroup.js';
import {
  tryAssignPendingToExistingTeams,
  randomPlaceRemainder,
  persistPlacements,
  refreshTeamComplementScore,
} from '../lib/teamFormationIncrementalGroup.js';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NODE_ROOT = path.join(__dirname, '../..');
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

function absPathFromVideoStorageKey(storageKey) {
  const key = String(storageKey || '').trim();
  if (!key) return null;
  const abs = path.isAbsolute(key) ? key : path.join(NODE_ROOT, key);
  const normalized = path.normalize(abs);
  const uploadsRoot = path.normalize(path.join(NODE_ROOT, 'uploads'));
  if (!normalized.startsWith(uploadsRoot)) return null;
  return normalized;
}

function sendIntroVideoFile(res, storageKey) {
  const abs = absPathFromVideoStorageKey(storageKey);
  if (!abs || !fs.existsSync(abs)) {
    res.status(404).json({ code: 40404, message: '视频不存在' });
    return false;
  }
  const ext = path.extname(abs).toLowerCase();
  const type =
    ext === '.webm' ? 'video/webm' : ext === '.mp4' ? 'video/mp4' : 'application/octet-stream';
  res.setHeader('Content-Type', type);
  res.sendFile(abs);
  return true;
}

async function listPendingStudentsForClass(pool, classId) {
  const { rows } = await pool.query(
    `SELECT u.id, u.real_name AS name, u.student_no AS "studentNo", u.email, u.avatar_url,
            s.ai_matched_role AS "aiMatchedRole", s.ai_analysis_raw AS "aiAnalysisRaw",
            s.video_storage_key AS "videoStorageKey",
            s.status AS submission_status
     FROM student_team_formation_submissions s
     JOIN users u ON u.id = s.student_id
     WHERE s.teacher_personal_class_id = $1 AND s.status = 'pending_teacher'
       AND COALESCE(s.grouping_preference, 'pool') = 'pool'
     ORDER BY s.submitted_at ASC NULLS LAST, u.id ASC`,
    [classId]
  );
  return rows.map((r) => {
    const profile = profileFromAnalysisRaw(r.aiAnalysisRaw);
    return {
      id: String(r.id),
      name: r.name || r.email || '',
      studentId: r.studentNo || '',
      studentNo: r.studentNo || '',
      email: r.email || '',
      avatarUrl: r.avatar_url || '',
      hasIntroVideo: Boolean(r.videoStorageKey),
      aiMatchedRole: r.aiMatchedRole || '',
      aiMatchedRoleLabel: TEAM_ROLE_LABELS[r.aiMatchedRole] || r.aiMatchedRole || '',
      status: 'pending',
      profile,
    };
  });
}

/** 学生是否已在该班入队 */
async function findStudentTeamIdInClass(pool, classId, studentId) {
  const { rows } = await pool.query(
    `SELECT t.id
     FROM teacher_personal_class_team_members m
     JOIN teacher_personal_class_teams t ON t.id = m.team_id
     WHERE t.teacher_personal_class_id = $1 AND m.student_id = $2
     LIMIT 1`,
    [classId, studentId]
  );
  return rows[0]?.id != null ? String(rows[0].id) : null;
}

/**
 * 成立单人公司：即时创建 1 人 confirmed 队，不参与 AI 待组队池
 */
async function createSoloTeamForStudent(pool, classId, studentId) {
  const existingTeamId = await findStudentTeamIdInClass(pool, classId, studentId);
  if (existingTeamId) {
    return { status: 'confirmed', teamId: existingTeamId, solo: true, alreadyExisted: true };
  }

  const { rows: subRows } = await pool.query(
    `SELECT status, ai_matched_role AS "aiMatchedRole", ai_analysis_raw AS "aiAnalysisRaw"
     FROM student_team_formation_submissions
     WHERE teacher_personal_class_id = $1 AND student_id = $2`,
    [classId, studentId]
  );
  if (!subRows.length || !subRows[0].aiMatchedRole) {
    const err = new Error('请先完成答题并完成 AI 分析');
    err.code = 40010;
    throw err;
  }
  const sub = subRows[0];
  if (sub.status === 'confirmed' || sub.status === 'grouped') {
    const tid = await findStudentTeamIdInClass(pool, classId, studentId);
    return { status: sub.status, teamId: tid, solo: true, alreadyExisted: true };
  }

  const { rows: userRows } = await pool.query(
    `SELECT real_name, email FROM users WHERE id = $1`,
    [studentId]
  );
  const displayName = String(userRows[0]?.real_name || userRows[0]?.email || '同学').trim() || '同学';
  const teamName = `${displayName}的工作室`.slice(0, 128);
  const profile = profileFromAnalysisRaw(sub.aiAnalysisRaw);
  const aiRole = sub.aiMatchedRole;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: sortRows } = await client.query(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort
       FROM teacher_personal_class_teams WHERE teacher_personal_class_id = $1`,
      [classId]
    );
    const nextSort = Number(sortRows[0]?.next_sort ?? 0);

    const { rows: ins } = await client.query(
      `INSERT INTO teacher_personal_class_teams
         (teacher_personal_class_id, name, grouping_status, complement_score, ai_rationale, sort_order, is_solo, leader_student_id)
       VALUES ($1, $2, 'confirmed', NULL, $3, $4, true, $5)
       RETURNING id`,
      [classId, teamName, '学生选择成立单人公司，不参与智能组队。', nextSort, studentId]
    );
    const teamId = ins[0].id;

    await client.query(
      `INSERT INTO teacher_personal_class_team_members
         (team_id, student_id, ai_matched_role, dimension_profile)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [teamId, studentId, aiRole, JSON.stringify(profile)]
    );

    await client.query(
      `UPDATE student_team_formation_submissions SET
         status = 'confirmed',
         grouping_preference = 'solo',
         submitted_at = COALESCE(submitted_at, now()),
         updated_at = now()
       WHERE teacher_personal_class_id = $1 AND student_id = $2`,
      [classId, studentId]
    );

    await client.query('COMMIT');
    return { status: 'confirmed', teamId: String(teamId), solo: true };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function persistAiTeamsToDb(pool, classId, pending, aiTeams) {
  const pendingMap = new Map(pending.map((s) => [s.id, s]));
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE student_team_formation_submissions s SET status = 'pending_teacher', updated_at = now()
       FROM teacher_personal_class_team_members m
       JOIN teacher_personal_class_teams t ON t.id = m.team_id
       WHERE t.teacher_personal_class_id = $1 AND t.grouping_status = 'draft'
         AND s.teacher_personal_class_id = $1 AND s.student_id = m.student_id`,
      [classId]
    );
    await client.query(
      `DELETE FROM teacher_personal_class_teams
       WHERE teacher_personal_class_id = $1 AND grouping_status = 'draft'`,
      [classId]
    );
    for (const t of aiTeams) {
      const profiles = t.memberIds.map((id) => pendingMap.get(id)?.profile).filter(Boolean);
      const complementScore = computeComplementScore(profiles);
      const { rows: ins } = await client.query(
        `INSERT INTO teacher_personal_class_teams
           (teacher_personal_class_id, name, grouping_status, complement_score, ai_rationale, sort_order)
         VALUES ($1, $2, 'confirmed', $3, $4, $5)
         RETURNING id`,
        [classId, t.name, complementScore, t.rationale || null, t.sortOrder ?? 0]
      );
      const teamId = ins[0].id;
      for (const sid of t.memberIds) {
        const st = pendingMap.get(sid);
        if (!st) continue;
        await client.query(
          `INSERT INTO teacher_personal_class_team_members
             (team_id, student_id, ai_matched_role, dimension_profile)
           VALUES ($1, $2, $3, $4::jsonb)`,
          [teamId, sid, st.aiMatchedRole || null, JSON.stringify(st.profile)]
        );
        await client.query(
          `UPDATE student_team_formation_submissions SET status = 'confirmed', updated_at = now()
           WHERE teacher_personal_class_id = $1 AND student_id = $2`,
          [classId, sid]
        );
      }
      const leaderId = pickDefaultLeaderStudentId(t.memberIds, pending);
      if (leaderId) {
        await client.query(
          `UPDATE teacher_personal_class_teams SET leader_student_id = $1 WHERE id = $2`,
          [leaderId, teamId]
        );
      }
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/** 增量 AI：仅 INSERT 新团队，不删除已有团队 */
async function persistNewAiTeamsOnly(pool, classId, pending, aiTeams, existingTeamsForSort) {
  const pendingMap = new Map(pending.map((s) => [s.id, s]));
  let nextSort =
    existingTeamsForSort.reduce((m, t) => Math.max(m, t.sortOrder ?? 0), -1) + 1;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const t of aiTeams) {
      const profiles = t.memberIds.map((id) => pendingMap.get(id)?.profile).filter(Boolean);
      const complementScore = computeComplementScore(profiles);
      const { rows: ins } = await client.query(
        `INSERT INTO teacher_personal_class_teams
           (teacher_personal_class_id, name, grouping_status, complement_score, ai_rationale, sort_order)
         VALUES ($1, $2, 'confirmed', $3, $4, $5)
         RETURNING id`,
        [classId, t.name, complementScore, t.rationale || null, t.sortOrder ?? nextSort++]
      );
      const teamId = ins[0].id;
      for (const sid of t.memberIds) {
        const st = pendingMap.get(sid);
        if (!st) continue;
        await client.query(
          `INSERT INTO teacher_personal_class_team_members
             (team_id, student_id, ai_matched_role, dimension_profile)
           VALUES ($1, $2, $3, $4::jsonb)`,
          [teamId, sid, st.aiMatchedRole || null, JSON.stringify(st.profile)]
        );
        await client.query(
          `UPDATE student_team_formation_submissions SET status = 'confirmed', updated_at = now()
           WHERE teacher_personal_class_id = $1 AND student_id = $2`,
          [classId, sid]
        );
      }
      const leaderId = pickDefaultLeaderStudentId(t.memberIds, pending);
      if (leaderId) {
        await client.query(
          `UPDATE teacher_personal_class_teams SET leader_student_id = $1 WHERE id = $2`,
          [leaderId, teamId]
        );
      }
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/** 历史草稿队：有成员即视为已生效团队（与取消「确认组队」后的规则一致） */
async function promoteDraftTeamsWithMembers(pool, classId) {
  await pool.query(
    `UPDATE teacher_personal_class_teams t SET grouping_status = 'confirmed', updated_at = now()
     WHERE t.teacher_personal_class_id = $1 AND t.grouping_status = 'draft'
       AND EXISTS (SELECT 1 FROM teacher_personal_class_team_members m WHERE m.team_id = t.id)`,
    [classId]
  );
  await pool.query(
    `UPDATE student_team_formation_submissions s SET status = 'confirmed', updated_at = now()
     WHERE s.teacher_personal_class_id = $1 AND s.status = 'grouped'
       AND EXISTS (
         SELECT 1 FROM teacher_personal_class_team_members m
         JOIN teacher_personal_class_teams t ON t.id = m.team_id AND t.teacher_personal_class_id = $1
         WHERE m.student_id = s.student_id
       )`,
    [classId]
  );
}

async function teacherGroupingPayload(pool, classId) {
  await promoteDraftTeamsWithMembers(pool, classId);
  const pendingStudents = await listPendingStudentsForClass(pool, classId);
  const teams = await loadTeamsWithMembers(pool, classId, ['draft', 'confirmed']);
  return { pendingStudents, teams, minPendingForAi: MIN_PENDING_FOR_AI };
}

function existingTeamsWithMembers(allTeams) {
  return (allTeams || []).filter(
    (t) =>
      (t.groupingStatus === 'draft' || t.groupingStatus === 'confirmed') &&
      (t.members || []).length > 0
  );
}

async function loadTeamsWithMembers(pool, classId, statuses = ['draft', 'confirmed']) {
    const { rows: teamRows } = await pool.query(
    `SELECT id, name, COALESCE(introduction, '') AS introduction, grouping_status AS "groupingStatus",
            complement_score AS "complementScore", ai_rationale AS "aiRationale", sort_order AS "sortOrder",
            created_at AS "createdAt", leader_student_id AS "leaderStudentId",
            COALESCE(is_solo, false) AS "isSolo"
     FROM teacher_personal_class_teams
     WHERE teacher_personal_class_id = $1 AND grouping_status = ANY($2::text[])
     ORDER BY sort_order ASC, id ASC`,
    [classId, statuses]
  );
  if (!teamRows.length) return [];
  const teamIds = teamRows.map((t) => t.id);
  const { rows: memRows } = await pool.query(
    `SELECT m.team_id AS "teamId", m.student_id AS "studentId", m.ai_matched_role AS "aiMatchedRole",
            m.dimension_profile AS "dimensionProfile",
            u.real_name AS name, u.student_no AS "studentNo", u.email, u.avatar_url,
            sub.video_storage_key AS "videoStorageKey"
     FROM teacher_personal_class_team_members m
     JOIN users u ON u.id = m.student_id
     LEFT JOIN student_team_formation_submissions sub
       ON sub.student_id = m.student_id AND sub.teacher_personal_class_id = $2
     WHERE m.team_id = ANY($1::bigint[])
     ORDER BY m.team_id, m.id ASC`,
    [teamIds, classId]
  );
  const teamStatusById = new Map(teamRows.map((t) => [String(t.id), t.groupingStatus]));
  const byTeam = new Map(teamIds.map((id) => [String(id), []]));
  for (const m of memRows) {
    const prof = m.dimensionProfile && typeof m.dimensionProfile === 'object' ? m.dimensionProfile : {};
    const profile = parseDimensionScores(prof);
    const gs = teamStatusById.get(String(m.teamId));
    const memberStatus = gs === 'confirmed' ? 'confirmed' : 'grouped';
    byTeam.get(String(m.teamId))?.push({
      id: String(m.studentId),
      name: m.name || m.email || '',
      studentId: m.studentNo || '',
      avatarUrl: m.avatar_url || '',
      hasIntroVideo: Boolean(m.videoStorageKey),
      aiMatchedRole: m.aiMatchedRole || '',
      aiMatchedRoleLabel: TEAM_ROLE_LABELS[m.aiMatchedRole] || m.aiMatchedRole || '',
      profile,
      status: memberStatus,
    });
  }
  return teamRows.map((t) => {
    const members = byTeam.get(String(t.id)) || [];
    const leaderId = t.leaderStudentId != null ? String(t.leaderStudentId) : null;
    const fallbackLeaderId =
      leaderId ||
      (() => {
        const ceo = members.find((m) => String(m.aiMatchedRole || '').toLowerCase() === 'ceo');
        return ceo?.id ?? members[0]?.id ?? null;
      })();
    const membersWithLeader = members.map((m) => ({
      ...m,
      isTeamLeader: fallbackLeaderId ? m.id === fallbackLeaderId : false,
    }));
    const profiles = membersWithLeader.map((m) => m.profile);
    const createdAt = t.createdAt ? new Date(t.createdAt).toLocaleString('zh-CN', { dateStyle: 'medium' }) : '';
    return {
      id: String(t.id),
      name: t.name,
      introduction: String(t.introduction || ''),
      leaderStudentId: leaderId,
      groupingStatus: t.groupingStatus,
      sortOrder: t.sortOrder != null ? Number(t.sortOrder) : 0,
      isSolo: Boolean(t.isSolo),
      complementScore: t.isSolo
        ? t.complementScore != null
          ? Number(t.complementScore)
          : null
        : computeComplementScore(profiles),
      aiRationale: t.aiRationale || '',
      createdAt,
      members: membersWithLeader,
      avgProfile: profiles.length
        ? {
            strategic: Math.round(profiles.reduce((s, p) => s + p.strategic, 0) / profiles.length),
            market: Math.round(profiles.reduce((s, p) => s + p.market, 0) / profiles.length),
            techRisk: Math.round(profiles.reduce((s, p) => s + p.techRisk, 0) / profiles.length),
          }
        : { strategic: 0, market: 0, techRisk: 0 },
    };
  });
}

function formatAnswersForLlm(questions, answers) {
  const lines = [];
  for (const q of questions) {
    const raw = answers[String(q.id)];
    if (raw == null || raw === '') continue;
    let text = '';
    if (q.questionType === 'short') {
      text = `（简答，自述仅供参考，勿单独定角）${String(raw).slice(0, 100)}`;
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
    const mime = String(file.mimetype || '').toLowerCase();
    const ext = path.extname(file.originalname || '').toLowerCase();
    const okMime = mime === 'video/mp4' || mime === 'video/webm';
    const okExt = ext === '.mp4' || ext === '.webm';
    if (okMime || okExt) cb(null, true);
    else cb(new Error('仅支持 MP4、WebM 格式（浏览器可在线预览）'));
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
        `SELECT u.id, u.real_name AS name, u.student_no AS "studentNo", u.email, u.avatar_url,
                s.ai_matched_role AS "aiMatchedRole", s.ai_analysis_raw AS "aiAnalysisRaw",
                s.answers, s.video_transcript AS "videoTranscript",
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
        rows.map((r) => {
          const profile = profileFromAnalysisRaw(r.aiAnalysisRaw);
          return {
            id: String(r.id),
            name: r.name || r.email || '',
            studentId: r.studentNo || '',
            studentNo: r.studentNo || '',
            email: r.email || '',
            major: '',
            grade: '',
            avatarUrl: r.avatar_url || '',
            aiMatchedRole: r.aiMatchedRole || '',
            aiMatchedRoleLabel: TEAM_ROLE_LABELS[r.aiMatchedRole] || r.aiMatchedRole || '',
            status: 'pending',
            profile,
            skills: [],
          };
        })
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
              ai_matched_role AS "aiMatchedRole", ai_analysis_raw AS "aiAnalysisRaw",
              grouping_preference AS "groupingPreference",
              submitted_at AS "submittedAt"
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
        dimensionProfile: { strategic: 0, market: 0, techRisk: 0 },
        submittedAt: null,
        groupingPreference: null,
      });
    }
    const r = rows[0];
    const role = r.aiMatchedRole;
    const raw = r.aiAnalysisRaw;
    const dimensionProfile = profileFromAnalysisRaw(raw);
    const fullText = raw?.fullText || '';
    const analysisText =
      raw?.match?.analysisText ||
      narrativeBeforeJson(fullText) ||
      String(raw?.match?.summary || '').trim();
    return ok(req, res, {
      status: r.status,
      answers: r.answers || {},
      videoStorageKey: r.videoStorageKey,
      videoTranscript: r.videoTranscript,
      aiMatchedRole: role,
      aiMatchedRoleLabel: role ? TEAM_ROLE_LABELS[role] || role : null,
      dimensionProfile,
      analysisText,
      submittedAt: r.submittedAt ? new Date(r.submittedAt).toISOString() : null,
      groupingPreference: r.groupingPreference || null,
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

router.get('/student/team-formation/video', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const sid = studentIdFromReq(req);
    const classId = parseClassId(req.query.classId);
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
    if (!key) return bad(req, res, 404, 40404, '暂无视频');
    if (!sendIntroVideoFile(res, key)) return;
  } catch (e) {
    logError(`GET student video traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.get(
  '/teacher/personal-classes/:classId/team-formation/students/:studentId/intro-video',
  requireAuth(),
  requireTeacher(),
  async (req, res) => {
    try {
      const tid = teacherIdFromReq(req);
      const classId = parseClassId(req.params.classId);
      const studentId = parseClassId(req.params.studentId);
      if (!tid || !classId || !studentId) return bad(req, res, 400, 40003, '参数无效');
      const pool = getPool();
      if (!(await ownsPersonalClass(pool, tid, classId))) {
        return bad(req, res, 404, 40402, '班级不存在或无权操作');
      }
      const { rows } = await pool.query(
        `SELECT s.video_storage_key
         FROM student_team_formation_submissions s
         JOIN teacher_personal_class_students m
           ON m.student_id = s.student_id AND m.teacher_personal_class_id = s.teacher_personal_class_id
         WHERE s.teacher_personal_class_id = $1 AND s.student_id = $2`,
        [classId, studentId]
      );
      const key = rows[0]?.video_storage_key;
      if (!key) return bad(req, res, 404, 40404, '暂无个人介绍视频');
      if (!sendIntroVideoFile(res, key)) return;
    } catch (e) {
      logError(`GET teacher intro-video traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

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

    const answers = sub.answers || {};
    const qaText = formatAnswersForLlm(questions, answers);

    const prompts = await getPromptModules();
    const tf = prompts.team_formation || {};
    const roleDefs = JSON.stringify(tf.role_definitions || [], null, 2);

    const provider = await getEnabledProvider('multimodal');
    if (!provider) return bad(req, res, 400, 40011, '未配置已启用的多模态模型');

    const matchSystem = `${String(tf.match_system || '').trim()}

可选角色定义：
${roleDefs}

评分材料：仅依据下方「问卷题目与作答」，不要引用、推测或提及任何视频或音视频内容。

分析要求：
- 三维得分与角色：以问卷单选/多选等客观题的倾向为主；简答题仅作辅助，不得因学生自称想当某职务而直接定角（见下方规则）。
- dimensionScores 必须体现真实能力倾向，禁止三维全 0 或完全相同。
${DIMENSION_SCORING_PROMPT}
- 最后一行 JSON 字段（单行、无 markdown）：
  dimensionScores: { strategic, market, techRisk } 必填整数
  marketFocus、techFocus（按维度最高规则）
  matchedRole、confidence、summary（100字内结论含三维分数）、videoTranscript（可据问卷写简短能力摘要，勿写视频）`;

    if (!wantStream) {
      return bad(req, res, 400, 40012, '请使用流式分析（stream: true）');
    }

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    const userMsg = `【问卷题目与作答】\n${qaText}`;

    sseWrite(res, 'status', { message: '正在分析…' });

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
      sseWrite(res, 'error', { message: friendlyLlmErrorMessage(e) });
      res.end();
      return;
    }

    const parsed = extractTeamFormationMatchJson(fullText) || extractJsonFromLlmText(fullText) || {};
    let dimensionScores = parseDimensionScores(parsed);
    if (!scoresArePlausible(dimensionScores)) {
      dimensionScores = estimateDimensionScoresFromQa(`${qaText}\n${narrativeBeforeJson(fullText)}`);
    }
    const matchedRole =
      resolveMatchedRoleFromScores(dimensionScores, {
        marketFocus: parsed.marketFocus,
        techFocus: parsed.techFocus,
      }) || normalizeMatchedRole(parsed.matchedRole);
    if (!matchedRole) {
      sseWrite(res, 'error', { message: 'AI 未返回有效维度得分或角色，请重试' });
      res.end();
      return;
    }

    const analysisText = narrativeBeforeJson(fullText);
    const transcript =
      String(parsed.videoTranscript || '').trim() ||
      (analysisText.length > 20 ? analysisText.slice(0, 800) : '');
    const summary =
      String(parsed.summary || '').trim() ||
      (analysisText.length > 20 ? analysisText.slice(0, 280) : '已根据问卷作答完成评估。');
    const matchPayload = {
      ...parsed,
      dimensionScores,
      matchedRole,
      marketFocus: parsed.marketFocus,
      techFocus: parsed.techFocus,
      analysisText,
      summary,
    };

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
        JSON.stringify({ fullText, match: matchPayload }),
      ]
    );

    sseWrite(res, 'done', {
      aiMatchedRole: matchedRole,
      aiMatchedRoleLabel: TEAM_ROLE_LABELS[matchedRole],
      videoTranscript: transcript,
      summary,
      analysisText,
      confidence: parsed.confidence,
      dimensionProfile: dimensionScores,
    });
    res.end();
  } catch (e) {
    logError(`POST analyze traceId=${req.traceId}`, e);
    if (!res.headersSent) {
      return bad(req, res, 500, 50000, e.message);
    }
    try {
      sseWrite(res, 'error', { message: friendlyLlmErrorMessage(e) });
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
    const groupingPreference = req.body?.groupingPreference === 'solo' ? 'solo' : 'pool';
    if (!sid || !classId) return bad(req, res, 400, 40003, '参数无效');
    const pool = getPool();
    if (!(await studentEnrolledInClass(pool, sid, classId))) {
      return bad(req, res, 403, 40301, '未加入该班级');
    }
    const { rows } = await pool.query(
      `SELECT status, ai_matched_role FROM student_team_formation_submissions
       WHERE teacher_personal_class_id = $1 AND student_id = $2`,
      [classId, sid]
    );
    if (!rows.length || !rows[0].ai_matched_role) {
      return bad(req, res, 400, 40010, '请先完成答题并完成 AI 分析');
    }
    const status = rows[0].status;
    if (status === 'confirmed' || status === 'grouped') {
      const teamId = await findStudentTeamIdInClass(pool, classId, sid);
      return ok(req, res, { status, teamId, solo: groupingPreference === 'solo' });
    }
    if (status === 'pending_teacher' && groupingPreference === 'pool') {
      return ok(req, res, { status: 'pending_teacher', groupingPreference: 'pool' });
    }

    if (groupingPreference === 'solo') {
      const soloResult = await createSoloTeamForStudent(pool, classId, sid);
      return ok(req, res, { ...soloResult, groupingPreference: 'solo' });
    }

    await pool.query(
      `UPDATE student_team_formation_submissions SET
         status = 'pending_teacher',
         grouping_preference = 'pool',
         submitted_at = now(),
         updated_at = now()
       WHERE teacher_personal_class_id = $1 AND student_id = $2`,
      [classId, sid]
    );
    return ok(req, res, { status: 'pending_teacher', groupingPreference: 'pool' });
  } catch (e) {
    logError(`POST submit traceId=${req.traceId}`, e);
    if (e.code === 40010) return bad(req, res, 400, 40010, e.message);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.get(
  '/teacher/personal-classes/:classId/team-formation/grouping',
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
      return ok(req, res, await teacherGroupingPayload(pool, classId));
    } catch (e) {
      logError(`GET grouping traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.post(
  '/teacher/personal-classes/:classId/team-formation/ai-group',
  requireAuth(),
  requireTeacher(),
  async (req, res) => {
    const tid = teacherIdFromReq(req);
    const classId = parseClassId(req.params.classId);
    const wantStream =
      req.body?.stream === true ||
      String(req.get('accept') || '').includes('text/event-stream');
    if (!tid || !classId) return bad(req, res, 400, 40003, '参数无效');
    const pool = getPool();
    try {
      if (!(await ownsPersonalClass(pool, tid, classId))) {
        return bad(req, res, 404, 40402, '班级不存在或无权操作');
      }
      const pending = await listPendingStudentsForClass(pool, classId);
      const allTeams = await loadTeamsWithMembers(pool, classId, ['draft', 'confirmed']);
      const existingTeams = existingTeamsWithMembers(allTeams);

      if (existingTeams.length === 0) {
        if (pending.length < MIN_PENDING_FOR_AI) {
          return bad(req, res, 400, 40013, `待组队学生至少 ${MIN_PENDING_FOR_AI} 人`);
        }
      } else if (pending.length < 1) {
        return bad(req, res, 400, 40015, '暂无待组队学生');
      }

      const provider = await getEnabledProvider('multimodal');
      if (!provider) return bad(req, res, 400, 40011, '未配置已启用的多模态模型');

      if (!wantStream) {
        return bad(req, res, 400, 40012, '请使用流式组队（stream: true）');
      }

      res.status(200);
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      if (typeof res.flushHeaders === 'function') res.flushHeaders();

      const streamHandlers = {
        onStatus: (message) => sseWrite(res, 'status', { message }),
        onThinking: (text) => sseWrite(res, 'thinking', { text }),
        onContent: (text) => sseWrite(res, 'content', { text }),
      };

      if (existingTeams.length === 0) {
        const aiTeams = await runAiTeamGroupingStream(provider, pending, streamHandlers);
        await persistAiTeamsToDb(pool, classId, pending, aiTeams);
        sseWrite(res, 'done', await teacherGroupingPayload(pool, classId));
        res.end();
        return;
      }

      sseWrite(res, 'status', { message: '正在按角色向现有团队补位…' });
      const pendingMap = new Map(pending.map((s) => [String(s.id), s]));
      const { placements, remainder } = tryAssignPendingToExistingTeams(pending, existingTeams);
      await persistPlacements(pool, classId, placements, pendingMap);

      if (remainder.length === 0) {
        sseWrite(res, 'done', await teacherGroupingPayload(pool, classId));
        res.end();
        return;
      }

      if (remainder.length <= 2) {
        const payload = await teacherGroupingPayload(pool, classId);
        sseWrite(res, 'done', {
          ...payload,
          needsRandomConfirm: true,
          remainderCount: remainder.length,
          remainderStudents: remainder.map((s) => ({
            id: s.id,
            name: s.name,
            aiMatchedRole: s.aiMatchedRole,
            aiMatchedRoleLabel: s.aiMatchedRoleLabel,
          })),
        });
        res.end();
        return;
      }

      const aiTeams = await runAiTeamGroupingStream(provider, remainder, streamHandlers, {
        minPending: MIN_TEAM_SIZE,
        incrementalOnly: true,
      });
      const teamsForSort = await loadTeamsWithMembers(pool, classId, ['draft', 'confirmed']);
      await persistNewAiTeamsOnly(pool, classId, remainder, aiTeams, teamsForSort);
      sseWrite(res, 'done', await teacherGroupingPayload(pool, classId));
      res.end();
    } catch (e) {
      logError(`POST ai-group traceId=${req.traceId}`, e);
      if (res.headersSent) {
        sseWrite(res, 'error', { message: friendlyLlmErrorMessage(e) });
        res.end();
        return;
      }
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.post(
  '/teacher/personal-classes/:classId/team-formation/ai-group/confirm-random',
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
      const pending = await listPendingStudentsForClass(pool, classId);
      const allTeams = await loadTeamsWithMembers(pool, classId, ['draft', 'confirmed']);
      const existingTeams = existingTeamsWithMembers(allTeams);
      if (!existingTeams.length) {
        return bad(req, res, 400, 40016, '暂无已有团队，请先完成分组');
      }
      const pendingMap = new Map(pending.map((s) => [String(s.id), s]));
      const { remainder } = tryAssignPendingToExistingTeams(pending, existingTeams);
      if (remainder.length === 0) {
        return ok(req, res, await teacherGroupingPayload(pool, classId));
      }
      if (remainder.length > 2) {
        return bad(req, res, 400, 40017, '剩余待组队人数较多，请再次使用 AI 智能组队');
      }
      const placements = randomPlaceRemainder(remainder, existingTeams);
      await persistPlacements(pool, classId, placements, pendingMap);
      return ok(req, res, await teacherGroupingPayload(pool, classId));
    } catch (e) {
      logError(`POST ai-group/confirm-random traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.delete(
  '/teacher/personal-classes/:classId/team-formation/teams/:teamId/members/:studentId',
  requireAuth(),
  requireTeacher(),
  async (req, res) => {
    try {
      const tid = teacherIdFromReq(req);
      const classId = parseClassId(req.params.classId);
      const teamId = parseClassId(req.params.teamId);
      const studentId = parseClassId(req.params.studentId);
      if (!tid || !classId || !teamId || !studentId) return bad(req, res, 400, 40003, '参数无效');
      const pool = getPool();
      if (!(await ownsPersonalClass(pool, tid, classId))) {
        return bad(req, res, 404, 40402, '班级不存在或无权操作');
      }
      const { rows: tr } = await pool.query(
        `SELECT id, grouping_status FROM teacher_personal_class_teams
         WHERE id = $1 AND teacher_personal_class_id = $2`,
        [teamId, classId]
      );
      if (!tr.length) return bad(req, res, 404, 40403, '团队不存在');
      await pool.query(
        `DELETE FROM teacher_personal_class_team_members WHERE team_id = $1 AND student_id = $2`,
        [teamId, studentId]
      );
      const { rows: cnt } = await pool.query(
        `SELECT COUNT(*)::int AS c FROM teacher_personal_class_team_members WHERE team_id = $1`,
        [teamId]
      );
      if (cnt[0].c === 0) {
        await pool.query(`DELETE FROM teacher_personal_class_teams WHERE id = $1`, [teamId]);
      } else {
        const { rows: lr } = await pool.query(
          `SELECT leader_student_id FROM teacher_personal_class_teams WHERE id = $1`,
          [teamId]
        );
        if (String(lr[0]?.leader_student_id) === String(studentId)) {
          const { rows: rest } = await pool.query(
            `SELECT m.student_id AS id, m.ai_matched_role AS "aiMatchedRole"
             FROM teacher_personal_class_team_members m WHERE m.team_id = $1`,
            [teamId]
          );
          const nextLeader = pickDefaultLeaderStudentId(
            rest.map((r) => String(r.id)),
            rest.map((r) => ({ id: String(r.id), aiMatchedRole: r.aiMatchedRole }))
          );
          await pool.query(
            `UPDATE teacher_personal_class_teams SET leader_student_id = $1 WHERE id = $2`,
            [nextLeader, teamId]
          );
        }
        await refreshTeamComplementScore(pool, teamId);
      }
      await pool.query(
        `UPDATE student_team_formation_submissions SET status = 'pending_teacher', updated_at = now()
         WHERE teacher_personal_class_id = $1 AND student_id = $2`,
        [classId, studentId]
      );
      return ok(req, res, await teacherGroupingPayload(pool, classId));
    } catch (e) {
      logError(`DELETE team member traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.put(
  '/teacher/personal-classes/:classId/team-formation/teams/:teamId/leader',
  requireAuth(),
  requireTeacher(),
  async (req, res) => {
    try {
      const tid = teacherIdFromReq(req);
      const classId = parseClassId(req.params.classId);
      const teamId = parseClassId(req.params.teamId);
      const studentId = parseClassId(req.body?.studentId);
      if (!tid || !classId || !teamId || !studentId) return bad(req, res, 400, 40003, '参数无效');
      const pool = getPool();
      if (!(await ownsPersonalClass(pool, tid, classId))) {
        return bad(req, res, 404, 40402, '班级不存在或无权操作');
      }
      const { rows: tr } = await pool.query(
        `SELECT id, grouping_status FROM teacher_personal_class_teams
         WHERE id = $1 AND teacher_personal_class_id = $2`,
        [teamId, classId]
      );
      if (!tr.length) return bad(req, res, 404, 40403, '团队不存在');
      const { rows: mem } = await pool.query(
        `SELECT 1 FROM teacher_personal_class_team_members WHERE team_id = $1 AND student_id = $2`,
        [teamId, studentId]
      );
      if (!mem.length) return bad(req, res, 400, 40003, '该学生不在本团队中');
      await pool.query(
        `UPDATE teacher_personal_class_teams SET leader_student_id = $1, updated_at = now() WHERE id = $2`,
        [studentId, teamId]
      );
      return ok(req, res, await teacherGroupingPayload(pool, classId));
    } catch (e) {
      logError(`PUT team leader traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.post(
  '/teacher/personal-classes/:classId/team-formation/teams/:teamId/members',
  requireAuth(),
  requireTeacher(),
  async (req, res) => {
    try {
      const tid = teacherIdFromReq(req);
      const classId = parseClassId(req.params.classId);
      const teamId = parseClassId(req.params.teamId);
      const studentId = parseClassId(req.body?.studentId);
      if (!tid || !classId || !teamId || !studentId) return bad(req, res, 400, 40003, '参数无效');
      const pool = getPool();
      if (!(await ownsPersonalClass(pool, tid, classId))) {
        return bad(req, res, 404, 40402, '班级不存在或无权操作');
      }
      const { rows: tr } = await pool.query(
        `SELECT id, grouping_status FROM teacher_personal_class_teams
         WHERE id = $1 AND teacher_personal_class_id = $2`,
        [teamId, classId]
      );
      if (!tr.length) return bad(req, res, 404, 40403, '团队不存在');
      const { rows: cnt } = await pool.query(
        `SELECT COUNT(*)::int AS c FROM teacher_personal_class_team_members WHERE team_id = $1`,
        [teamId]
      );
      if (cnt[0].c >= MAX_TEAM_SIZE) {
        return bad(req, res, 400, 40015, `每组最多 ${MAX_TEAM_SIZE} 人`);
      }
      const { rows: sub } = await pool.query(
        `SELECT ai_matched_role AS "aiMatchedRole", ai_analysis_raw AS "aiAnalysisRaw", status
         FROM student_team_formation_submissions
         WHERE teacher_personal_class_id = $1 AND student_id = $2`,
        [classId, studentId]
      );
      if (!sub.length || sub[0].status !== 'pending_teacher') {
        return bad(req, res, 400, 40016, '该学生不在待组队池');
      }
      const profile = profileFromAnalysisRaw(sub[0].aiAnalysisRaw);
      await pool.query(
        `INSERT INTO teacher_personal_class_team_members
           (team_id, student_id, ai_matched_role, dimension_profile)
         VALUES ($1, $2, $3, $4::jsonb)
         ON CONFLICT (team_id, student_id) DO NOTHING`,
        [teamId, studentId, sub[0].aiMatchedRole, JSON.stringify(profile)]
      );
      await pool.query(
        `UPDATE student_team_formation_submissions SET status = 'confirmed', updated_at = now()
         WHERE teacher_personal_class_id = $1 AND student_id = $2`,
        [classId, studentId]
      );
      await pool.query(
        `UPDATE teacher_personal_class_teams SET grouping_status = 'confirmed', updated_at = now()
         WHERE id = $1 AND grouping_status = 'draft'`,
        [teamId]
      );
      await refreshTeamComplementScore(pool, teamId);
      return ok(req, res, await teacherGroupingPayload(pool, classId));
    } catch (e) {
      logError(`POST team member traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.post(
  '/teacher/personal-classes/:classId/team-formation/confirm',
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
      if (req.body?.mode !== 'notify') {
        return bad(req, res, 400, 40003, '无效操作');
      }
      const allTeams = await loadTeamsWithMembers(pool, classId, ['draft', 'confirmed']);
      const teamsToNotify = existingTeamsWithMembers(allTeams);

      if (!teamsToNotify.length) {
        return bad(req, res, 400, 40019, '还没有已入队学生，无法发送通知');
      }

      const { rows: tpc } = await pool.query(
        `SELECT name FROM teacher_personal_classes WHERE id = $1`,
        [classId]
      );
      const className = tpc[0]?.name || '教学班级';
      const { rows: teacherRow } = await pool.query(`SELECT real_name FROM users WHERE id = $1`, [tid]);
      const teacherName = teacherRow[0]?.real_name || '任课教师';

      const client = await pool.connect();
      let notifiedCount = 0;
      try {
        await client.query('BEGIN');
        for (const team of teamsToNotify) {
          for (const m of team.members) {
            await client.query(
              `INSERT INTO notifications (receiver_id, sender_id, type, title, content, related_module, related_link, is_read)
               VALUES ($1, $2, 'team_join', $3, $4, 'team_formation', $5, false)`,
              [
                m.id,
                tid,
                '你已被编入创业团队',
                `${teacherName} 已将你编入「${team.name}」（${className}），请进入「组队与团队管理」查看最新团队信息。`,
                '/student-center?tab=module-team&teamTab=myteam',
              ]
            );
            notifiedCount += 1;
          }
        }
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
      const payload = await teacherGroupingPayload(pool, classId);
      return ok(req, res, { ...payload, notifiedCount });
    } catch (e) {
      logError(`POST confirm traceId=${req.traceId}`, e);
      return bad(req, res, 500, 50000, e.message);
    }
  }
);

router.patch('/student/team-formation/my-team', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const sid = studentIdFromReq(req);
    const classId = parseClassId(req.body?.classId);
    const name = String(req.body?.name || '').trim();
    const introduction = String(req.body?.introduction ?? '').trim();
    if (!sid || !classId) return bad(req, res, 400, 40003, '参数无效');
    if (!name) return bad(req, res, 400, 40003, '请填写团队名称');
    const pool = getPool();
    if (!(await studentEnrolledInClass(pool, sid, classId))) {
      return bad(req, res, 403, 40301, '未加入该班级');
    }
    const { rows: mr } = await pool.query(
      `SELECT m.team_id AS "teamId", m.ai_matched_role AS "aiMatchedRole", t.leader_student_id AS "leaderStudentId"
       FROM teacher_personal_class_team_members m
       JOIN teacher_personal_class_teams t ON t.id = m.team_id
       WHERE t.teacher_personal_class_id = $1 AND m.student_id = $2 AND t.grouping_status = 'confirmed'
       LIMIT 1`,
      [classId, sid]
    );
    if (!mr.length) return bad(req, res, 404, 40402, '尚未加入已确认的团队');
    const leaderId = mr[0].leaderStudentId != null ? String(mr[0].leaderStudentId) : null;
    const isLeader = leaderId
      ? leaderId === String(sid)
      : String(mr[0].aiMatchedRole || '').toLowerCase() === 'ceo';
    if (!isLeader) {
      return bad(req, res, 403, 40302, '仅小组队长可修改团队名称与介绍');
    }
    await pool.query(
      `UPDATE teacher_personal_class_teams SET name = $1, introduction = $2, updated_at = now()
       WHERE id = $3`,
      [name.slice(0, 128), introduction.slice(0, 2000), mr[0].teamId]
    );
    const teams = await loadTeamsWithMembers(pool, classId, ['confirmed']);
    const mine = teams.find((t) => t.id === String(mr[0].teamId));
    return ok(req, res, mine || null);
  } catch (e) {
    logError(`PATCH my-team traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.get('/student/team-formation/my-team', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const sid = studentIdFromReq(req);
    const classId = parseClassId(req.query.classId);
    if (!sid || !classId) return bad(req, res, 400, 40003, '参数无效');
    const pool = getPool();
    if (!(await studentEnrolledInClass(pool, sid, classId))) {
      return bad(req, res, 403, 40301, '未加入该班级');
    }
    const { rows } = await pool.query(
      `SELECT t.id, t.name, t.grouping_status AS "groupingStatus"
       FROM teacher_personal_class_team_members m
       JOIN teacher_personal_class_teams t ON t.id = m.team_id
       WHERE t.teacher_personal_class_id = $1 AND m.student_id = $2 AND t.grouping_status = 'confirmed'
       LIMIT 1`,
      [classId, sid]
    );
    if (!rows.length) return ok(req, res, null);
    const teams = await loadTeamsWithMembers(pool, classId, ['confirmed']);
    const mine = teams.find((t) => t.id === String(rows[0].id));
    return ok(req, res, mine || null);
  } catch (e) {
    logError(`GET my-team traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.get('/student/team-formation/team-square', requireAuth(), requireStudent(), async (req, res) => {
  try {
    const sid = studentIdFromReq(req);
    const classId = parseClassId(req.query.classId);
    if (!sid || !classId) return bad(req, res, 400, 40003, '参数无效');
    const pool = getPool();
    if (!(await studentEnrolledInClass(pool, sid, classId))) {
      return bad(req, res, 403, 40301, '未加入该班级');
    }
    const teams = await loadTeamsWithMembers(pool, classId, ['confirmed']);
    return ok(req, res, teams);
  } catch (e) {
    logError(`GET team-square traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

export default router;
