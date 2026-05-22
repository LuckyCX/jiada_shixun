import { MAX_TEAM_SIZE, pickDefaultLeaderStudentId } from './teamFormationAiGroup.js';
import { parseDimensionScores, computeComplementScore } from './teamFormationDimension.js';

export async function refreshTeamComplementScore(pool, teamId) {
  const { rows: memCnt } = await pool.query(
    `SELECT dimension_profile FROM teacher_personal_class_team_members WHERE team_id = $1`,
    [teamId]
  );
  const profiles = memCnt.map((r) => {
    const prof = r.dimension_profile && typeof r.dimension_profile === 'object' ? r.dimension_profile : {};
    return parseDimensionScores(prof);
  });
  const complementScore = computeComplementScore(profiles);
  await pool.query(
    `UPDATE teacher_personal_class_teams SET complement_score = $2, updated_at = now() WHERE id = $1`,
    [teamId, complementScore]
  );
  return complementScore;
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function roleKey(student) {
  return String(student?.aiMatchedRole || '').trim().toLowerCase();
}

function teamRolesSet(team) {
  const set = new Set();
  for (const m of team.members || []) {
    const k = String(m.aiMatchedRole || '').trim().toLowerCase();
    if (k) set.add(k);
  }
  return set;
}

/**
 * 按团队顺序，将待组队学生插入角色不冲突且未满员的 draft 组
 */
export function tryAssignPendingToExistingTeams(pendingStudents, draftTeams) {
  const sortedTeams = [...(draftTeams || [])].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || String(a.id).localeCompare(String(b.id))
  );
  const placements = [];
  const remainder = [];
  const teamRoleSets = new Map(sortedTeams.map((t) => [String(t.id), teamRolesSet(t)]));
  const teamSizes = new Map(sortedTeams.map((t) => [String(t.id), (t.members || []).length]));

  for (const student of pendingStudents) {
    const sid = String(student.id);
    const rk = roleKey(student);
    let placed = false;
    for (const team of sortedTeams) {
      const tid = String(team.id);
      const size = teamSizes.get(tid) ?? 0;
      if (size >= MAX_TEAM_SIZE) continue;
      const roles = teamRoleSets.get(tid);
      if (rk && roles?.has(rk)) continue;
      placements.push({ studentId: sid, teamId: tid });
      teamSizes.set(tid, size + 1);
      if (rk) roles.add(rk);
      placed = true;
      break;
    }
    if (!placed) remainder.push(student);
  }

  return { placements, remainder };
}

/**
 * 剩余 1～2 人：随机插入未满员团队（允许角色重复）
 * 多队有空位时打乱顺序；2 人时尽量分到不同队，避免总落在 sort_order 最小的第一队
 */
export function randomPlaceRemainder(remainder, existingTeams) {
  const teams = shuffleInPlace(
    [...(existingTeams || [])].sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || String(a.id).localeCompare(String(b.id))
    )
  );
  const slots = teams
    .map((t) => ({
      teamId: String(t.id),
      space: MAX_TEAM_SIZE - (t.members || []).length,
    }))
    .filter((x) => x.space > 0);
  const totalSpace = slots.reduce((s, x) => s + x.space, 0);
  if (totalSpace < remainder.length) {
    throw new Error('现有团队已满员，请手动调整团队或移出成员后再试');
  }
  const placements = [];
  const usedTeamIds = new Set();
  for (const student of remainder) {
    let candidates = slots.filter((x) => x.space > 0);
    if (!candidates.length) break;
    if (remainder.length <= 2 && usedTeamIds.size > 0) {
      const otherTeams = candidates.filter((s) => !usedTeamIds.has(s.teamId));
      if (otherTeams.length) candidates = otherTeams;
    }
    shuffleInPlace(candidates);
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    placements.push({ studentId: String(student.id), teamId: pick.teamId });
    usedTeamIds.add(pick.teamId);
    pick.space -= 1;
  }
  return placements;
}

export async function persistPlacements(pool, classId, placements, studentById) {
  if (!placements?.length) return;
  const teamIds = [...new Set(placements.map((p) => p.teamId))];
  const { rows: teamRows } = await pool.query(
    `SELECT id, grouping_status FROM teacher_personal_class_teams WHERE id = ANY($1::bigint[])`,
    [teamIds]
  );
  const submissionStatusByTeam = new Map(
    teamRows.map((r) => [String(r.id), r.grouping_status === 'confirmed' ? 'confirmed' : 'grouped'])
  );
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const { studentId, teamId } of placements) {
      const st = studentById.get(String(studentId));
      if (!st) continue;
      await client.query(
        `INSERT INTO teacher_personal_class_team_members
           (team_id, student_id, ai_matched_role, dimension_profile)
         VALUES ($1, $2, $3, $4::jsonb)
         ON CONFLICT (team_id, student_id) DO NOTHING`,
        [teamId, studentId, st.aiMatchedRole || null, JSON.stringify(st.profile || {})]
      );
      const subStatus = submissionStatusByTeam.get(String(teamId)) || 'grouped';
      await client.query(
        `UPDATE student_team_formation_submissions SET status = $3, updated_at = now()
         WHERE teacher_personal_class_id = $1 AND student_id = $2`,
        [classId, studentId, subStatus]
      );
    }
    for (const teamId of teamIds) {
      await refreshTeamComplementScore(client, teamId);
      const { rows: tr } = await client.query(
        `SELECT leader_student_id FROM teacher_personal_class_teams WHERE id = $1`,
        [teamId]
      );
      if (tr[0]?.leader_student_id != null) continue;
      const { rows: mems } = await client.query(
        `SELECT student_id AS id, ai_matched_role AS "aiMatchedRole"
         FROM teacher_personal_class_team_members WHERE team_id = $1 ORDER BY id ASC`,
        [teamId]
      );
      if (!mems.length) continue;
      const memberIds = mems.map((m) => String(m.id));
      const roster = mems.map((m) => ({ id: String(m.id), aiMatchedRole: m.aiMatchedRole }));
      const leaderId = pickDefaultLeaderStudentId(memberIds, roster);
      if (leaderId) {
        await client.query(
          `UPDATE teacher_personal_class_teams SET leader_student_id = $1, updated_at = now() WHERE id = $2`,
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
