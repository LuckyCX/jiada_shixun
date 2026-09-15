import { refreshTeamComplementScore } from './teamFormationIncrementalGroup.js';

/**
 * 管理端删除学生账号前整理组队：
 * - 单人公司，或删后无人：解散团队（级联清理团队业务数据）
 * - 多人队且队长被删：按成员入队顺序（member.id ASC）顺位指定下一位为队长
 * - 仅普通成员被删：移出成员，队长不变
 *
 * @param {import('pg').PoolClient} client 事务内 client
 * @param {number[]} studentIds 待删学生 id
 */
export async function cleanupStudentTeamsBeforeUserDelete(client, studentIds) {
  const ids = [
    ...new Set(
      (Array.isArray(studentIds) ? studentIds : [])
        .map((x) => Number(x))
        .filter((n) => Number.isFinite(n) && n > 0)
    ),
  ];
  if (!ids.length) return;

  const { rows: touched } = await client.query(
    `SELECT DISTINCT m.team_id AS "teamId"
     FROM teacher_personal_class_team_members m
     WHERE m.student_id = ANY($1::bigint[])`,
    [ids]
  );
  if (!touched.length) return;

  const deleteSet = new Set(ids.map(String));

  for (const row of touched) {
    const teamId = Number(row.teamId);
    if (!Number.isFinite(teamId) || teamId <= 0) continue;

    const { rows: teamRows } = await client.query(
      `SELECT id, COALESCE(is_solo, false) AS is_solo, leader_student_id
       FROM teacher_personal_class_teams WHERE id = $1`,
      [teamId]
    );
    if (!teamRows.length) continue;
    const team = teamRows[0];

    // 入队顺序作为顺位依据
    const { rows: members } = await client.query(
      `SELECT student_id AS id
       FROM teacher_personal_class_team_members
       WHERE team_id = $1
       ORDER BY id ASC`,
      [teamId]
    );
    const remaining = members.filter((m) => !deleteSet.has(String(m.id)));

    // 单人公司或删后无人 → 解散
    if (team.is_solo || remaining.length === 0) {
      await client.query(`DELETE FROM teacher_personal_class_teams WHERE id = $1`, [teamId]);
      continue;
    }

    // 显式移出待删成员（users CASCADE 也会删，但需先交接队长）
    await client.query(
      `DELETE FROM teacher_personal_class_team_members
       WHERE team_id = $1 AND student_id = ANY($2::bigint[])`,
      [teamId, ids]
    );

    const leaderId = team.leader_student_id != null ? String(team.leader_student_id) : null;
    if (!leaderId || deleteSet.has(leaderId)) {
      const nextLeader = remaining[0]?.id;
      if (nextLeader) {
        await client.query(
          `UPDATE teacher_personal_class_teams
           SET leader_student_id = $1, updated_at = now()
           WHERE id = $2`,
          [nextLeader, teamId]
        );
      }
    }

    await refreshTeamComplementScore(client, teamId);
  }
}
