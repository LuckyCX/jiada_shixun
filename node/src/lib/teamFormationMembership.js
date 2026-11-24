/**
 * 同班组队归属：一人只能在一支已入队记录中（多人队或单人公司互斥）
 */

/** @param {import('pg').Pool | import('pg').PoolClient} db */
export async function findStudentTeamInClass(db, classId, studentId) {
  const { rows } = await db.query(
    `SELECT t.id, t.name, COALESCE(t.is_solo, false) AS is_solo
     FROM teacher_personal_class_team_members m
     JOIN teacher_personal_class_teams t ON t.id = m.team_id
     WHERE t.teacher_personal_class_id = $1 AND m.student_id = $2
     ORDER BY t.id ASC`,
    [classId, studentId]
  );
  if (!rows.length) return null;
  return {
    teamId: String(rows[0].id),
    name: rows[0].name || '',
    isSolo: Boolean(rows[0].is_solo),
    conflictCount: rows.length,
  };
}

export async function findStudentTeamIdInClass(db, classId, studentId) {
  const row = await findStudentTeamInClass(db, classId, studentId);
  return row?.teamId ?? null;
}

/**
 * 事务内锁定该生本班 submission，并确认尚无任何队伍归属。
 * @param {import('pg').PoolClient} client
 */
export async function lockAndAssertStudentFreeInClass(client, classId, studentId) {
  await client.query(
    `SELECT id FROM student_team_formation_submissions
     WHERE teacher_personal_class_id = $1 AND student_id = $2
     FOR UPDATE`,
    [classId, studentId]
  );
  const existing = await findStudentTeamInClass(client, classId, studentId);
  if (existing) {
    const err = new Error(
      existing.isSolo
        ? '该学生已成立单人公司，不能再入队或重复创建'
        : '该学生已加入团队，不能再入其他队伍或成立单人公司'
    );
    err.code = 40019;
    err.existing = existing;
    throw err;
  }
}

/** 判断是否为「同班一人一队」唯一约束冲突 */
export function isOneTeamPerClassConflict(err) {
  if (!err) return false;
  if (err.code === '23505' && /already belongs to team/i.test(String(err.message || ''))) return true;
  if (err.code === 40019) return true;
  return false;
}
