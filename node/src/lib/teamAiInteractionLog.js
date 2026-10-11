/**
 * 团队 AI 交互落库（创新多轮对话 / 结果类生成事件）
 */

import { getPool } from './db.js';
import { logError } from './logError.js';

/**
 * @param {object} opts
 * @param {number} opts.classId
 * @param {number} opts.teamId
 * @param {number|null} [opts.studentId]
 * @param {string} opts.moduleKey
 * @param {string} opts.scene
 * @param {string|null} [opts.threadId]
 * @param {number} [opts.roundIndex]
 * @param {string} [opts.role]
 * @param {string} [opts.content]
 * @param {object} [opts.meta]
 */
export async function insertTeamAiInteractionLog(opts) {
  const classId = Number(opts.classId);
  const teamId = Number(opts.teamId);
  if (!classId || !teamId) return null;
  const pool = getPool();
  try {
    const { rows } = await pool.query(
      `INSERT INTO teacher_personal_class_team_ai_interaction_logs
         (class_id, team_id, student_id, module_key, scene, thread_id, round_index, role, content, meta_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
       RETURNING id`,
      [
        classId,
        teamId,
        opts.studentId != null ? Number(opts.studentId) : null,
        String(opts.moduleKey || '').trim() || 'unknown',
        String(opts.scene || '').trim() || 'event',
        opts.threadId ? String(opts.threadId).slice(0, 128) : null,
        Math.max(0, Number(opts.roundIndex) || 0),
        String(opts.role || 'event').slice(0, 32),
        String(opts.content || '').slice(0, 20000),
        JSON.stringify(opts.meta && typeof opts.meta === 'object' ? opts.meta : {}),
      ]
    );
    return rows[0]?.id != null ? Number(rows[0].id) : null;
  } catch (e) {
    // 表未迁移时不阻断主流程
    logError('insertTeamAiInteractionLog', e);
    return null;
  }
}

/**
 * 批量写入一轮对话（user + assistant）
 */
export async function insertChatTurnLogs({
  classId,
  teamId,
  studentId,
  moduleKey,
  scene,
  threadId,
  roundIndex,
  userContent,
  assistantContent,
  meta,
}) {
  if (userContent) {
    await insertTeamAiInteractionLog({
      classId,
      teamId,
      studentId,
      moduleKey,
      scene,
      threadId,
      roundIndex,
      role: 'user',
      content: userContent,
      meta,
    });
  }
  if (assistantContent) {
    await insertTeamAiInteractionLog({
      classId,
      teamId,
      studentId,
      moduleKey,
      scene,
      threadId,
      roundIndex,
      role: 'assistant',
      content: assistantContent,
      meta,
    });
  }
}
