/**
 * 实训流程略过：可配置环节、班级 skipped 读取、恢复时硬清空
 */

export const SKIPPABLE_MODULE_KEYS = ['ideation', 'market', 'product', 'business', 'simulation', 'plan'];

export const FULL_TRAINING_ORDER = ['team', ...SKIPPABLE_MODULE_KEYS];

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {number} classId
 * @returns {Promise<Set<string>>}
 */
export async function loadSkippedModuleKeys(db, classId) {
  const { rows } = await db.query(
    `SELECT module_key
     FROM teacher_personal_class_course_settings
     WHERE teacher_personal_class_id = $1 AND skipped = true AND module_key <> 'team'`,
    [classId]
  );
  return new Set(rows.map((r) => String(r.module_key)));
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {number} teamId
 * @returns {Promise<{ classId: number|null, skipped: Set<string> }>}
 */
export async function loadSkippedModuleKeysByTeamId(db, teamId) {
  const { rows } = await db.query(
    `SELECT teacher_personal_class_id AS class_id
     FROM teacher_personal_class_teams
     WHERE id = $1`,
    [teamId]
  );
  const classId = rows[0]?.class_id != null ? Number(rows[0].class_id) : null;
  if (!classId) return { classId: null, skipped: new Set() };
  const skipped = await loadSkippedModuleKeys(db, classId);
  return { classId, skipped };
}

/**
 * @param {Set<string> | string[]} skipped
 * @returns {string[]}
 */
export function activeTrainingOrder(skipped) {
  const set = skipped instanceof Set ? skipped : new Set(skipped || []);
  return FULL_TRAINING_ORDER.filter((k) => k === 'team' || !set.has(k));
}

/**
 * 恢复（略过→启用）时硬清空该班该环节全队数据
 * @param {import('pg').PoolClient} client
 * @param {number} classId
 * @param {string} moduleKey
 */
export async function wipeClassModuleData(client, classId, moduleKey) {
  const key = String(moduleKey || '').trim();
  if (!SKIPPABLE_MODULE_KEYS.includes(key)) return;

  const teamIdsSql = `SELECT id FROM teacher_personal_class_teams WHERE teacher_personal_class_id = $1`;

  if (key === 'ideation') {
    await client.query(
      `DELETE FROM teacher_personal_class_team_project_topics WHERE teacher_personal_class_id = $1`,
      [classId]
    );
    await client.query(
      `DELETE FROM teacher_personal_class_team_project_topic_drafts
       WHERE team_id IN (${teamIdsSql})`,
      [classId]
    );
    await client.query(
      `DELETE FROM teacher_personal_class_team_hat_studio_member
       WHERE team_id IN (${teamIdsSql})`,
      [classId]
    );
    await client.query(
      `DELETE FROM teacher_personal_class_team_idea_likes
       WHERE idea_id IN (
         SELECT i.id FROM teacher_personal_class_team_ideas i
         WHERE i.team_id IN (${teamIdsSql})
       )`,
      [classId]
    );
    await client.query(
      `DELETE FROM teacher_personal_class_team_discussions
       WHERE team_id IN (${teamIdsSql})`,
      [classId]
    );
    await client.query(
      `DELETE FROM teacher_personal_class_team_ideas WHERE team_id IN (${teamIdsSql})`,
      [classId]
    );
    return;
  }

  if (key === 'market') {
    await client.query(
      `DELETE FROM teacher_personal_class_team_survey_responses
       WHERE survey_id IN (
         SELECT s.id FROM teacher_personal_class_team_surveys s
         WHERE s.team_id IN (${teamIdsSql})
       )`,
      [classId]
    );
    await client.query(
      `DELETE FROM teacher_personal_class_team_survey_questions
       WHERE survey_id IN (
         SELECT s.id FROM teacher_personal_class_team_surveys s
         WHERE s.team_id IN (${teamIdsSql})
       )`,
      [classId]
    );
    await client.query(
      `DELETE FROM teacher_personal_class_team_surveys WHERE team_id IN (${teamIdsSql})`,
      [classId]
    );
    await client.query(
      `DELETE FROM teacher_personal_class_team_market_research_uploads WHERE team_id IN (${teamIdsSql})`,
      [classId]
    );
    await client.query(
      `DELETE FROM teacher_personal_class_team_market_research_plans WHERE team_id IN (${teamIdsSql})`,
      [classId]
    );
    await client.query(
      `DELETE FROM teacher_personal_class_team_market_personas WHERE team_id IN (${teamIdsSql})`,
      [classId]
    );
    await client.query(
      `DELETE FROM teacher_personal_class_team_market_analysis WHERE team_id IN (${teamIdsSql})`,
      [classId]
    );
    await client.query(
      `DELETE FROM teacher_personal_class_team_market_challenge_sessions WHERE team_id IN (${teamIdsSql})`,
      [classId]
    );
    await client.query(
      `DELETE FROM teacher_personal_class_team_market_report_uploads WHERE team_id IN (${teamIdsSql})`,
      [classId]
    );
    return;
  }

  if (key === 'product') {
    await client.query(
      `DELETE FROM teacher_personal_class_team_product_prototype_uploads WHERE team_id IN (${teamIdsSql})`,
      [classId]
    );
    await client.query(
      `DELETE FROM teacher_personal_class_team_product_ai_suggestions WHERE team_id IN (${teamIdsSql})`,
      [classId]
    );
    await client.query(
      `DELETE FROM teacher_personal_class_team_product_context WHERE team_id IN (${teamIdsSql})`,
      [classId]
    );
    return;
  }

  if (key === 'business') {
    await client.query(
      `DELETE FROM teacher_personal_class_team_war_room_saved_record WHERE team_id IN (${teamIdsSql})`,
      [classId]
    );
    await client.query(
      `DELETE FROM teacher_personal_class_team_war_room_member WHERE team_id IN (${teamIdsSql})`,
      [classId]
    );
    await client.query(
      `DELETE FROM teacher_personal_class_team_business_model_workspace WHERE team_id IN (${teamIdsSql})`,
      [classId]
    );
    return;
  }

  if (key === 'simulation') {
    await client.query(
      `DELETE FROM teacher_personal_class_team_role_simulation_run_records WHERE team_id IN (${teamIdsSql})`,
      [classId]
    );
    return;
  }

  if (key === 'plan') {
    await client.query(
      `DELETE FROM teacher_personal_class_team_business_plan_submission_attachments
       WHERE submission_id IN (
         SELECT s.id FROM teacher_personal_class_team_business_plan_submissions s
         WHERE s.team_id IN (${teamIdsSql})
       )`,
      [classId]
    );
    await client.query(
      `DELETE FROM teacher_personal_class_team_business_plan_submissions WHERE team_id IN (${teamIdsSql})`,
      [classId]
    );
    await client.query(
      `DELETE FROM teacher_personal_class_team_business_plan_analyses WHERE team_id IN (${teamIdsSql})`,
      [classId]
    );
    await client.query(
      `DELETE FROM teacher_personal_class_team_business_plan_section_locks WHERE team_id IN (${teamIdsSql})`,
      [classId]
    );
    await client.query(
      `DELETE FROM teacher_personal_class_team_business_plan_versions WHERE team_id IN (${teamIdsSql})`,
      [classId]
    );
    await client.query(
      `DELETE FROM teacher_personal_class_team_business_plan_workspace WHERE team_id IN (${teamIdsSql})`,
      [classId]
    );
  }
}
