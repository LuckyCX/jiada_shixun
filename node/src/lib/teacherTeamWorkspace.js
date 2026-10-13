/**
 * 教师团队上帝视角：按实训环节聚合只读数据（团队块 + 成员块）
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { loadSkippedModuleKeys, activeTrainingOrder, SKIPPABLE_MODULE_KEYS } from './courseWorkflow.js';
import { loadSurveyQuestions } from './marketResearchSurveyDb.js';
import { coerceSections, sectionsToFullText } from './businessPlanSections.js';
import { normalizeUploadFileName } from './uploadFileName.js';
import { TEAM_ROLE_LABELS } from './teamFormationConstants.js';
import { profileFromAnalysisRaw, narrativeBeforeJson } from './teamFormationDimension.js';
import { loadMarketFeatures } from './courseSettingsFeatures.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MARKET_UPLOAD_ROOT = path.join(__dirname, '../../uploads/market-research');

const STAGE_META = {
  team: { key: 'team', name: '组队与团队管理', monitorKey: 'teamFormation' },
  ideation: { key: 'ideation', name: '创新思维与创意生成', monitorKey: 'ideation' },
  market: { key: 'market', name: '市场调研与用户画像', monitorKey: 'marketResearch' },
  product: { key: 'product', name: '产品设计与原型', monitorKey: 'productDesign' },
  business: { key: 'business', name: '商业模式设计', monitorKey: 'businessModel' },
  simulation: { key: 'simulation', name: '项目仿真与角色推荐', monitorKey: 'roleSimulation' },
  plan: { key: 'plan', name: '商业计划书与PPT', monitorKey: 'businessPlan' },
};

function fmtZh(val) {
  if (!val) return '';
  const d = val instanceof Date ? val : new Date(val);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('zh-CN');
}

function asObj(v) {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v;
  if (typeof v === 'string') {
    try {
      const p = JSON.parse(v);
      return p && typeof p === 'object' && !Array.isArray(p) ? p : {};
    } catch {
      return {};
    }
  }
  return {};
}

function asArray(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** 调研计划分工：补全成员姓名，便于教师端直接展示 */
function enrichPlanAssignments(raw, members) {
  const list = asArray(raw);
  const byId = new Map(members.map((m) => [String(m.studentId), m.name || '']));
  return list.map((item) => {
    const role = String(item?.role || item?.task || '').trim();
    const ids = Array.isArray(item?.memberIds)
      ? item.memberIds.map((id) => String(id).trim()).filter(Boolean)
      : Array.isArray(item?.members)
        ? item.members.map((id) => String(id).trim()).filter(Boolean)
        : [];
    const memberNames = ids.map((id) => byId.get(id) || id).filter(Boolean);
    return { role, memberIds: ids, memberNames };
  });
}

/**
 * @param {import('pg').Pool} pool
 * @param {number} classId
 * @param {number} teamId
 */
export async function loadTeamMembers(pool, classId, teamId) {
  const { rows: teamRows } = await pool.query(
    `SELECT t.id, t.name, t.grouping_status, t.introduction, t.leader_student_id, t.is_solo,
            COALESCE(leader.real_name, leader.username, '') AS leader_name
     FROM teacher_personal_class_teams t
     LEFT JOIN users leader ON leader.id = t.leader_student_id
     WHERE t.id = $1 AND t.teacher_personal_class_id = $2`,
    [teamId, classId]
  );
  if (!teamRows[0]) return null;
  const { rows: members } = await pool.query(
    `SELECT m.student_id, m.ai_matched_role, m.dimension_profile,
            COALESCE(u.real_name, u.username, '') AS name, u.avatar_url
     FROM teacher_personal_class_team_members m
     JOIN users u ON u.id = m.student_id
     WHERE m.team_id = $1
     ORDER BY CASE WHEN m.student_id = $2 THEN 0 ELSE 1 END, m.id ASC`,
    [teamId, teamRows[0].leader_student_id]
  );
  return {
    team: {
      id: String(teamRows[0].id),
      name: teamRows[0].name || '',
      groupingStatus: teamRows[0].grouping_status || '',
      introduction: teamRows[0].introduction || '',
      leaderStudentId: teamRows[0].leader_student_id != null ? String(teamRows[0].leader_student_id) : '',
      leaderName: teamRows[0].leader_name || '',
      isSolo: Boolean(teamRows[0].is_solo),
    },
    members: members.map((m) => {
      const role = m.ai_matched_role || '';
      return {
        studentId: String(m.student_id),
        name: m.name || '',
        avatarUrl: m.avatar_url || '',
        aiMatchedRole: role,
        aiMatchedRoleLabel: role ? TEAM_ROLE_LABELS[role] || role : '',
        dimensionProfile: asObj(m.dimension_profile),
      };
    }),
  };
}

export async function loadEnabledOrder(pool, classId) {
  const skipped = await loadSkippedModuleKeys(pool, classId);
  return activeTrainingOrder(skipped);
}

/**
 * 各环节完成时间（与 stageProgress 完成判定对齐；未完成则为空串）
 * @returns {Promise<Record<string, string>>} moduleKey -> 中文时间
 */
export async function loadStageCompletionTimes(pool, classId, teamId, memberIds = []) {
  const empty = {
    team: '',
    ideation: '',
    market: '',
    product: '',
    business: '',
    simulation: '',
    plan: '',
  };
  const [
    { rows: teamRows },
    { rows: topicRows },
    { rows: marketRows },
    { rows: protoRows },
    { rows: bmRows },
    { rows: planRows },
    { rows: simQualifyRows },
  ] = await Promise.all([
    pool.query(
      `SELECT created_at, updated_at, grouping_status
       FROM teacher_personal_class_teams WHERE id = $1 LIMIT 1`,
      [teamId]
    ),
    pool.query(
      `SELECT submitted_at FROM teacher_personal_class_team_project_topics WHERE team_id = $1 LIMIT 1`,
      [teamId]
    ),
    pool.query(
      `SELECT uploaded_at FROM teacher_personal_class_team_market_report_uploads WHERE team_id = $1 LIMIT 1`,
      [teamId]
    ),
    pool.query(
      `SELECT uploaded_at FROM teacher_personal_class_team_product_prototype_uploads WHERE team_id = $1 LIMIT 1`,
      [teamId]
    ),
    pool.query(
      `SELECT swot_saved_at, marketing_saved_at, finance_saved_at, bmc_canvas_saved_at
       FROM teacher_personal_class_team_business_model_workspace WHERE team_id = $1 LIMIT 1`,
      [teamId]
    ),
    pool.query(
      `SELECT submitted_at FROM teacher_personal_class_team_business_plan_submissions
       WHERE teacher_personal_class_id = $1 AND team_id = $2
       ORDER BY submitted_at ASC LIMIT 1`,
      [classId, teamId]
    ),
    // 每位成员首次达到 run_index>=3 的时间，用于推算全员达标完成时刻
    pool.query(
      `SELECT student_id, MIN(created_at) AS qualified_at
       FROM teacher_personal_class_team_role_simulation_run_records
       WHERE teacher_personal_class_id = $1 AND team_id = $2 AND run_index >= 3
       GROUP BY student_id`,
      [classId, teamId]
    ),
  ]);

  const t = teamRows[0];
  if (t && memberIds.length) {
    empty.team = fmtZh(t.grouping_status === 'confirmed' ? t.updated_at || t.created_at : t.created_at);
  }
  if (topicRows[0]?.submitted_at) empty.ideation = fmtZh(topicRows[0].submitted_at);
  if (marketRows[0]?.uploaded_at) empty.market = fmtZh(marketRows[0].uploaded_at);
  if (protoRows[0]?.uploaded_at) empty.product = fmtZh(protoRows[0].uploaded_at);

  const bm = bmRows[0];
  if (bm) {
    const times = [bm.swot_saved_at, bm.marketing_saved_at, bm.finance_saved_at, bm.bmc_canvas_saved_at]
      .filter(Boolean)
      .map((x) => new Date(x).getTime())
      .filter((n) => Number.isFinite(n));
    // 有 BMC 或四项时间齐全时取最晚一次保存作为完成时间
    if (bm.bmc_canvas_saved_at || times.length >= 4) {
      empty.business = fmtZh(new Date(Math.max(...times)));
    }
  }

  if (memberIds.length && simQualifyRows.length >= memberIds.length) {
    const bySid = new Map(simQualifyRows.map((r) => [String(r.student_id), r.qualified_at]));
    const allOk = memberIds.every((sid) => bySid.has(String(sid)));
    if (allOk) {
      const maxTs = Math.max(
        ...memberIds.map((sid) => new Date(bySid.get(String(sid))).getTime()).filter((n) => Number.isFinite(n))
      );
      if (Number.isFinite(maxTs)) empty.simulation = fmtZh(new Date(maxTs));
    }
  }

  if (planRows[0]?.submitted_at) empty.plan = fmtZh(planRows[0].submitted_at);
  return empty;
}

/**
 * 提交记录摘要（与 monitor submissions 对齐并扩展标题）
 */
export async function loadSubmissionSummaries(pool, classId, teamId) {
  const items = [];
  const { rows: topicRows } = await pool.query(
    `SELECT project_name, submitted_at, status
     FROM teacher_personal_class_team_project_topics WHERE team_id = $1 LIMIT 1`,
    [teamId]
  );
  if (topicRows[0]) {
    items.push({
      id: `ideation-topic-${teamId}`,
      moduleKey: 'ideation',
      title: '项目选题',
      submitTime: fmtZh(topicRows[0].submitted_at),
      status: topicRows[0].status || '',
      hint: topicRows[0].project_name || '',
    });
  }
  const { rows: marketRows } = await pool.query(
    `SELECT uploaded_at FROM teacher_personal_class_team_market_report_uploads WHERE team_id = $1 LIMIT 1`,
    [teamId]
  );
  if (marketRows[0]) {
    items.push({
      id: `market-report-${teamId}`,
      moduleKey: 'market',
      title: '市场调研报告',
      submitTime: fmtZh(marketRows[0].uploaded_at),
      status: '',
      hint: '',
    });
  }
  const { rows: protoRows } = await pool.query(
    `SELECT uploaded_at, origin_name FROM teacher_personal_class_team_product_prototype_uploads WHERE team_id = $1 LIMIT 1`,
    [teamId]
  );
  if (protoRows[0]) {
    items.push({
      id: `product-prototype-${teamId}`,
      moduleKey: 'product',
      title: '产品原型压缩包',
      submitTime: fmtZh(protoRows[0].uploaded_at),
      status: '',
      hint: normalizeUploadFileName(protoRows[0].origin_name || ''),
    });
  }
  const { rows: bmRows } = await pool.query(
    `SELECT bmc_canvas_saved_at, marketing_saved_at, finance_saved_at, swot_saved_at
     FROM teacher_personal_class_team_business_model_workspace WHERE team_id = $1 LIMIT 1`,
    [teamId]
  );
  const bm = bmRows[0];
  if (bm?.bmc_canvas_saved_at) {
    items.push({
      id: `business-bmc-${teamId}`,
      moduleKey: 'business',
      title: '商业画布',
      submitTime: fmtZh(bm.bmc_canvas_saved_at),
      status: '',
      hint: '',
    });
  }
  const { rows: planRows } = await pool.query(
    `SELECT submitted_at, status FROM teacher_personal_class_team_business_plan_submissions
     WHERE teacher_personal_class_id = $1 AND team_id = $2 ORDER BY submitted_at DESC LIMIT 1`,
    [classId, teamId]
  );
  if (planRows[0]) {
    items.push({
      id: `business-plan-${teamId}`,
      moduleKey: 'plan',
      title: '商业计划书提交',
      submitTime: fmtZh(planRows[0].submitted_at),
      status: planRows[0].status || '',
      hint: '',
    });
  }
  return items;
}

const SUBMISSION_STATUS_LABEL = {
  draft: '草稿',
  pending_teacher: '已提交，等待教师组队',
  confirmed: '已确认',
  grouped: '已组队',
};

const GROUPING_PREF_LABEL = {
  pool: '进入智能组队池',
  solo: '个人成队',
};

function mapQuestionRow(r) {
  const options = Array.isArray(r.options) ? r.options : r.options || [];
  return {
    id: String(r.id),
    sortOrder: Number(r.sort_order || 0),
    title: r.title || '',
    questionType: r.question_type || 'single',
    options: options.map((o) => ({
      label: String(o?.label || '').trim(),
      value: String(o?.value ?? o?.label ?? '').trim(),
    })),
    required: r.required !== false,
  };
}

/** 将答案 value 还原为选项文案（与学生端选项 label 一致） */
function resolveAnswerDisplay(question, raw) {
  if (!question) {
    if (Array.isArray(raw)) return raw.map(String).join('；');
    return raw == null ? '' : String(raw);
  }
  const opts = question.options || [];
  const labelOf = (v) => {
    const hit = opts.find((o) => o.value === String(v) || o.label === String(v));
    return hit?.label || String(v);
  };
  if (question.questionType === 'multi' || Array.isArray(raw)) {
    const arr = Array.isArray(raw) ? raw : String(raw || '').split(/[,;；]/).map((s) => s.trim()).filter(Boolean);
    return arr.map(labelOf).join('；');
  }
  if (raw == null || raw === '') return '';
  return labelOf(raw);
}

async function loadTeamStage(pool, classId, teamId, members) {
  const memberIds = members.map((m) => Number(m.studentId)).filter(Boolean);
  const { rows: qRows } = await pool.query(
    `SELECT id, sort_order, title, question_type, options, required
     FROM teacher_personal_class_team_questions
     WHERE teacher_personal_class_id = $1
     ORDER BY sort_order ASC, id ASC`,
    [classId]
  );
  const questions = qRows.map(mapQuestionRow);
  const qById = new Map(questions.map((q) => [q.id, q]));

  let submissions = [];
  if (memberIds.length) {
    const { rows } = await pool.query(
      `SELECT s.student_id, s.status, s.answers, s.ai_matched_role, s.ai_analysis_raw,
              s.grouping_preference, s.video_storage_key, s.updated_at,
              COALESCE(u.real_name, u.username, '') AS name
       FROM student_team_formation_submissions s
       JOIN users u ON u.id = s.student_id
       WHERE s.teacher_personal_class_id = $1 AND s.student_id = ANY($2::bigint[])`,
      [classId, memberIds]
    );
    submissions = rows.map((r) => {
      const role = r.ai_matched_role || '';
      const raw = r.ai_analysis_raw && typeof r.ai_analysis_raw === 'object' ? r.ai_analysis_raw : null;
      const fullText = raw?.fullText || '';
      const analysisText =
        raw?.match?.analysisText ||
        narrativeBeforeJson(fullText) ||
        String(raw?.match?.summary || '').trim();
      const answersObj = asObj(r.answers);
      // 按题目顺序输出，带题干与选项文案，供教师端原样复刻学生问卷
      const answerItems = questions.map((q, idx) => {
        const val = answersObj[q.id];
        return {
          questionId: q.id,
          index: idx + 1,
          title: q.title,
          questionType: q.questionType,
          options: q.options,
          selectedValues: Array.isArray(val) ? val.map(String) : val != null && val !== '' ? [String(val)] : [],
          displayText: resolveAnswerDisplay(q, val),
        };
      });
      // 落库答案里可能有已删题目的 id，附在末尾（仍尽量可读）
      for (const [qid, val] of Object.entries(answersObj)) {
        if (qById.has(String(qid))) continue;
        answerItems.push({
          questionId: String(qid),
          index: answerItems.length + 1,
          title: `题目 ${qid}`,
          questionType: 'short',
          options: [],
          selectedValues: Array.isArray(val) ? val.map(String) : val != null ? [String(val)] : [],
          displayText: resolveAnswerDisplay(null, val),
        });
      }
      const status = r.status || '';
      const pref = r.grouping_preference || '';
      return {
        studentId: String(r.student_id),
        studentName: r.name || '',
        status,
        statusLabel: SUBMISSION_STATUS_LABEL[status] || status || '—',
        answers: answersObj,
        answerItems,
        aiMatchedRole: role,
        aiMatchedRoleLabel: role ? TEAM_ROLE_LABELS[role] || role : '',
        dimensionProfile: profileFromAnalysisRaw(raw),
        analysisText,
        groupingPreference: pref,
        groupingPreferenceLabel: GROUPING_PREF_LABEL[pref] || (pref ? pref : '—'),
        hasIntroVideo: Boolean(r.video_storage_key),
        introVideoUrl: r.video_storage_key
          ? `/api/teacher/personal-classes/${classId}/team-formation/students/${r.student_id}/intro-video`
          : '',
        updatedAt: fmtZh(r.updated_at),
      };
    });
  }
  return {
    moduleKey: 'team',
    name: STAGE_META.team.name,
    team: { members, questions },
    members: submissions,
  };
}

async function loadIdeationStage(pool, classId, teamId, members) {
  const { rows: topicRows } = await pool.query(
    `SELECT * FROM teacher_personal_class_team_project_topics WHERE team_id = $1 LIMIT 1`,
    [teamId]
  );
  const { rows: draftRows } = await pool.query(
    `SELECT * FROM teacher_personal_class_team_project_topic_drafts WHERE team_id = $1 LIMIT 1`,
    [teamId]
  );
  const { rows: ideaRows } = await pool.query(
    `SELECT i.*, COALESCE(u.real_name, u.username, '') AS author_name
     FROM teacher_personal_class_team_ideas i
     LEFT JOIN users u ON u.id = i.created_by
     WHERE i.team_id = $1
     ORDER BY i.created_at DESC`,
    [teamId]
  );
  const { rows: discRows } = await pool.query(
    `SELECT d.*, COALESCE(u.real_name, u.username, '') AS author_name
     FROM teacher_personal_class_team_discussions d
     LEFT JOIN users u ON u.id = d.student_id
     WHERE d.team_id = $1
     ORDER BY d.created_at DESC
     LIMIT 100`,
    [teamId]
  );
  const { rows: hatRows } = await pool.query(
    `SELECT h.student_id, h.draft_json, h.transcript_json, h.updated_at,
            COALESCE(u.real_name, u.username, '') AS name
     FROM teacher_personal_class_team_hat_studio_member h
     JOIN users u ON u.id = h.student_id
     WHERE h.team_id = $1`,
    [teamId]
  );
  const mapTopic = (row) =>
    row
      ? {
          projectName: row.project_name || '',
          projectDirection: row.project_direction || '',
          projectDescription: row.project_description || '',
          targetUsers: row.target_users || '',
          coreValue: row.core_value || '',
          coreProblem: row.core_problem || '',
          solutionOverview: row.solution_overview || '',
          marketSize: row.market_size || '',
          competitiveAdvantage: row.competitive_advantage || '',
          status: row.status || '',
          reviewComment: row.review_comment || '',
          submittedAt: fmtZh(row.submitted_at),
        }
      : null;

  return {
    moduleKey: 'ideation',
    name: STAGE_META.ideation.name,
    team: {
      topic: mapTopic(topicRows[0]),
      draft: mapTopic(draftRows[0]),
      ideas: ideaRows.map((r) => ({
        id: String(r.id),
        methodKey: r.method_key || '',
        methodName: r.method_name || '',
        title: r.title || '',
        description: r.description || '',
        formPayload: asObj(r.form_payload),
        // ai_analysis 可能是 jsonb 对象或 JSON 字符串
        aiAnalysis: (() => {
          const raw = r.ai_analysis;
          if (raw == null || raw === '') return null;
          if (typeof raw === 'object') return raw;
          if (typeof raw === 'string') {
            try {
              return JSON.parse(raw);
            } catch {
              return raw;
            }
          }
          return null;
        })(),
        createdBy: r.created_by != null ? String(r.created_by) : '',
        authorName: r.author_name || '',
        createdAt: fmtZh(r.created_at),
      })),
      discussions: discRows.map((r) => ({
        id: String(r.id),
        content: r.content || '',
        createdBy: r.student_id != null ? String(r.student_id) : '',
        authorName: r.author_name || '',
        createdAt: fmtZh(r.created_at),
      })),
    },
    members: members.map((m) => {
      const hat = hatRows.find((h) => String(h.student_id) === m.studentId);
      return {
        studentId: m.studentId,
        studentName: m.name,
        hatStudio: hat
          ? {
              draft: asObj(hat.draft_json),
              transcript: asObj(hat.transcript_json),
              updatedAt: fmtZh(hat.updated_at),
            }
          : null,
        ideaCount: ideaRows.filter((i) => String(i.created_by) === m.studentId).length,
      };
    }),
  };
}

async function loadMarketStage(pool, classId, teamId, members) {
  const features = await loadMarketFeatures(pool, classId);
  const { rows: planRows } = await pool.query(
    `SELECT goal, methods, plan_start_date, plan_end_date, assignments, saved_at
     FROM teacher_personal_class_team_market_research_plans WHERE team_id = $1`,
    [teamId]
  );
  const plan = planRows[0]
    ? {
        goal: planRows[0].goal || '',
        methods: asArray(planRows[0].methods),
        startDate: planRows[0].plan_start_date ? String(planRows[0].plan_start_date).slice(0, 10) : '',
        endDate: planRows[0].plan_end_date ? String(planRows[0].plan_end_date).slice(0, 10) : '',
        assignments: enrichPlanAssignments(planRows[0].assignments, members),
        savedAt: fmtZh(planRows[0].saved_at),
      }
    : null;

  const { rows: uploadRows } = await pool.query(
    `SELECT id, method, original_filename, storage_key, file_size, uploaded_by, created_at
     FROM teacher_personal_class_team_market_research_uploads
     WHERE team_id = $1 ORDER BY created_at DESC`,
    [teamId]
  );
  const uploads = uploadRows.map((r) => ({
    id: String(r.id),
    method: r.method || '',
    fileName: normalizeUploadFileName(r.original_filename || ''),
    sizeBytes: Number(r.file_size || 0),
    uploadedBy: r.uploaded_by != null ? String(r.uploaded_by) : '',
    uploadedByName: members.find((m) => m.studentId === String(r.uploaded_by))?.name || '',
    createdAt: fmtZh(r.created_at),
    downloadUrl: `/api/teacher/personal-classes/${classId}/monitor/teams/${teamId}/market-uploads/${r.id}/download`,
  }));

  const { rows: surveyRows } = await pool.query(
    `SELECT id, title, status, collected_count, created_at
     FROM teacher_personal_class_team_surveys WHERE team_id = $1 ORDER BY id ASC`,
    [teamId]
  );
  const surveys = [];
  for (const sv of surveyRows) {
    const questions = await loadSurveyQuestions(pool, sv.id);
    const { rows: respRows } = await pool.query(
      `SELECT id, answers, respondent_token, submitted_at
       FROM teacher_personal_class_team_survey_responses WHERE survey_id = $1 ORDER BY id ASC`,
      [sv.id]
    );
    surveys.push({
      id: String(sv.id),
      title: sv.title || '',
      status: sv.status || '',
      collectedCount: Number(sv.collected_count || 0),
      createdAt: fmtZh(sv.created_at),
      questions,
      responses: respRows.map((r) => ({
        id: String(r.id),
        respondentToken: r.respondent_token || `legacy-${r.id}`,
        submittedAt: fmtZh(r.submitted_at),
        answers: asObj(r.answers),
      })),
    });
  }

  const { rows: personaRows } = await pool.query(
    `SELECT id, payload, source, created_at FROM teacher_personal_class_team_market_personas
     WHERE team_id = $1 ORDER BY id ASC`,
    [teamId]
  );
  const { rows: analysisRows } = await pool.query(
    `SELECT result, generated_at FROM teacher_personal_class_team_market_analysis
     WHERE team_id = $1 LIMIT 1`,
    [teamId]
  );
  const { rows: challengeRows } = await pool.query(
    `SELECT c.id, c.student_id, c.rounds, c.final_report, c.status, c.created_at, c.completed_at,
            COALESCE(u.real_name, u.username, '') AS name
     FROM teacher_personal_class_team_market_challenge_sessions c
     JOIN users u ON u.id = c.student_id
     WHERE c.team_id = $1
     ORDER BY c.created_at DESC`,
    [teamId]
  );
  const { rows: reportRows } = await pool.query(
    `SELECT payload, uploaded_at, uploaded_by FROM teacher_personal_class_team_market_report_uploads
     WHERE team_id = $1 LIMIT 1`,
    [teamId]
  );

  return {
    moduleKey: 'market',
    name: STAGE_META.market.name,
    features,
    team: {
      plan,
      uploads,
      surveys,
      personas: personaRows.map((r) => ({
        id: String(r.id),
        source: r.source || '',
        payload: asObj(r.payload),
        createdAt: fmtZh(r.created_at),
      })),
      analysis: analysisRows[0]
        ? { result: analysisRows[0].result, createdAt: fmtZh(analysisRows[0].generated_at) }
        : null,
      report: reportRows[0]
        ? {
            payload: reportRows[0].payload,
            uploadedAt: fmtZh(reportRows[0].uploaded_at),
            uploadedBy: reportRows[0].uploaded_by != null ? String(reportRows[0].uploaded_by) : '',
            previewUrl: `/api/teacher/personal-classes/${classId}/monitor/teams/${teamId}/market-report-preview`,
          }
        : null,
    },
    members: members.map((m) => {
      const mine = challengeRows.filter((c) => String(c.student_id) === m.studentId);
      const latest = mine[0] || null;
      return {
        studentId: m.studentId,
        studentName: m.name,
        challenge: latest
          ? {
              id: String(latest.id),
              status: latest.status || '',
              rounds: latest.rounds,
              finalReport: latest.final_report,
              createdAt: fmtZh(latest.created_at),
              completedAt: fmtZh(latest.completed_at),
              sessionCount: mine.length,
            }
          : null,
        uploadCount: uploads.filter((u) => u.uploadedBy === m.studentId).length,
      };
    }),
  };
}

async function loadProductStage(pool, classId, teamId, members) {
  const { rows: ctxRows } = await pool.query(
    `SELECT context_text, updated_at FROM teacher_personal_class_team_product_context WHERE team_id = $1`,
    [teamId]
  );
  const { rows: sugRows } = await pool.query(
    `SELECT s.id, s.student_id, s.payload, s.created_at,
            COALESCE(u.real_name, u.username, '') AS name
     FROM teacher_personal_class_team_product_ai_suggestions s
     JOIN users u ON u.id = s.student_id
     WHERE s.team_id = $1
     ORDER BY s.created_at DESC`,
    [teamId]
  );
  const { rows: protoRows } = await pool.query(
    `SELECT origin_name, storage_path, uploaded_by, uploaded_at, size_bytes
     FROM teacher_personal_class_team_product_prototype_uploads WHERE team_id = $1`,
    [teamId]
  );
  const proto = protoRows[0]
    ? {
        fileName: normalizeUploadFileName(protoRows[0].origin_name || ''),
        sizeBytes: Number(protoRows[0].size_bytes || 0),
        uploadedBy: protoRows[0].uploaded_by != null ? String(protoRows[0].uploaded_by) : '',
        uploadedAt: fmtZh(protoRows[0].uploaded_at),
        downloadUrl: `/api/teacher/personal-classes/${classId}/monitor/teams/${teamId}/product-prototype/download`,
      }
    : null;

  return {
    moduleKey: 'product',
    name: STAGE_META.product.name,
    team: {
      contextText: ctxRows[0]?.context_text || '',
      contextUpdatedAt: fmtZh(ctxRows[0]?.updated_at),
      prototype: proto,
    },
    members: members.map((m) => {
      const mine = sugRows.filter((s) => String(s.student_id) === m.studentId);
      return {
        studentId: m.studentId,
        studentName: m.name,
        suggestions: mine.map((s) => ({
          id: String(s.id),
          payload: s.payload,
          createdAt: fmtZh(s.created_at),
        })),
      };
    }),
  };
}

async function loadBusinessStage(pool, classId, teamId, members) {
  const { rows: wsRows } = await pool.query(
    `SELECT swot_json, marketing_json, finance_json, bmc_canvas_json,
            swot_saved_at, marketing_saved_at, finance_saved_at, bmc_canvas_saved_at,
            bmc_review_status, bmc_review_comment, bmc_reviewed_at
     FROM teacher_personal_class_team_business_model_workspace WHERE team_id = $1`,
    [teamId]
  );
  const ws = wsRows[0] || null;
  // 战情室：草稿/对话在 member 表，终局保存画布在 saved_record
  const { rows: warDraftRows } = await pool.query(
    `SELECT w.student_id, w.canvas_json, w.transcript_json, w.updated_at,
            COALESCE(u.real_name, u.username, '') AS name
     FROM teacher_personal_class_team_war_room_member w
     JOIN users u ON u.id = w.student_id
     WHERE w.team_id = $1`,
    [teamId]
  );
  const { rows: warSavedRows } = await pool.query(
    `SELECT w.student_id, w.canvas_json, w.saved_at,
            COALESCE(u.real_name, u.username, '') AS name
     FROM teacher_personal_class_team_war_room_saved_record w
     JOIN users u ON u.id = w.student_id
     WHERE w.team_id = $1`,
    [teamId]
  );
  // AI 审查记录（学生提交的本轮审查历史，教师端只读展示）
  const { rows: aiReviewRows } = await pool.query(
    `SELECT r.id, r.self_note, r.ai_result, r.ai_score, r.created_at, r.submitted_by,
            COALESCE(u.real_name, u.username, '') AS submitter_name
     FROM teacher_personal_class_team_bmc_ai_reviews r
     JOIN users u ON u.id = r.submitted_by
     WHERE r.team_id = $1
     ORDER BY r.created_at DESC
     LIMIT 50`,
    [teamId]
  );
  // SWOT / 营销 / 成本分节审查
  const { rows: sectionReviewRows } = await pool.query(
    `SELECT r.id, r.section, r.self_note, r.ai_result, r.ai_score, r.created_at, r.submitted_by,
            COALESCE(u.real_name, u.username, '') AS submitter_name
     FROM teacher_personal_class_team_bm_section_ai_reviews r
     JOIN users u ON u.id = r.submitted_by
     WHERE r.team_id = $1
     ORDER BY r.created_at DESC
     LIMIT 80`,
    [teamId]
  ).catch(() => ({ rows: [] }));

  const mapReview = (r) => ({
    id: String(r.id),
    section: r.section ? String(r.section) : undefined,
    selfNote: String(r.self_note || ''),
    aiResult: asObj(r.ai_result),
    aiScore: r.ai_score != null ? Number(r.ai_score) : null,
    createdAt: fmtZh(r.created_at),
    submittedBy: String(r.submitted_by),
    submitterName: String(r.submitter_name || '').trim() || '同学',
  });

  return {
    moduleKey: 'business',
    name: STAGE_META.business.name,
    team: {
      swot: ws?.swot_json || null,
      swotSavedAt: fmtZh(ws?.swot_saved_at),
      marketing: ws?.marketing_json || null,
      marketingSavedAt: fmtZh(ws?.marketing_saved_at),
      finance: ws?.finance_json || null,
      financeSavedAt: fmtZh(ws?.finance_saved_at),
      bmc: ws?.bmc_canvas_json || null,
      bmcSavedAt: fmtZh(ws?.bmc_canvas_saved_at),
      bmcReviewStatus: String(ws?.bmc_review_status || 'draft'),
      bmcReviewComment: String(ws?.bmc_review_comment || ''),
      bmcReviewedAt: fmtZh(ws?.bmc_reviewed_at),
      bmcAiReviews: aiReviewRows.map(mapReview),
      swotAiReviews: (sectionReviewRows || []).filter((r) => r.section === 'swot').map(mapReview),
      marketingAiReviews: (sectionReviewRows || []).filter((r) => r.section === 'marketing').map(mapReview),
      financeAiReviews: (sectionReviewRows || []).filter((r) => r.section === 'finance').map(mapReview),
    },
    members: members.map((m) => {
      const draft = warDraftRows.find((w) => String(w.student_id) === m.studentId);
      const saved = warSavedRows.find((w) => String(w.student_id) === m.studentId);
      const savedCanvas = asObj(saved?.canvas_json);
      const draftCanvas = asObj(draft?.canvas_json);
      const canvas = Object.keys(savedCanvas).length ? savedCanvas : draftCanvas;
      const filled = Object.values(canvas).filter(
        (v) => v && typeof v === 'object' && String(v.content || '').trim()
      ).length;
      if (!draft && !saved) {
        return { studentId: m.studentId, studentName: m.name, warRoom: null };
      }
      return {
        studentId: m.studentId,
        studentName: m.name,
        warRoom: {
          canvas,
          draftCanvas,
          savedCanvas,
          transcript: asObj(draft?.transcript_json),
          filledCount: filled,
          updatedAt: fmtZh(draft?.updated_at || saved?.saved_at),
          savedAt: fmtZh(saved?.saved_at),
        },
      };
    }),
  };
}

async function loadSimulationStage(pool, classId, teamId, members) {
  const { rows } = await pool.query(
    `SELECT r.id, r.student_id, r.run_index, r.created_at, r.config_json, r.tracking_json, r.optimize_json,
            COALESCE(u.real_name, u.username, '') AS name
     FROM teacher_personal_class_team_role_simulation_run_records r
     JOIN users u ON u.id = r.student_id
     WHERE r.teacher_personal_class_id = $1 AND r.team_id = $2
     ORDER BY r.created_at DESC, r.id DESC`,
    [classId, teamId]
  );
  const progress = [];
  let allQualified = members.length > 0;
  const memberPayloads = members.map((m) => {
    const mine = rows.filter((r) => String(r.student_id) === m.studentId);
    const maxRun = mine.reduce((mx, r) => Math.max(mx, Number(r.run_index || 0)), 0);
    const qualified = maxRun >= 3;
    if (!qualified) allQualified = false;
    progress.push({
      studentId: m.studentId,
      studentName: m.name,
      runCount: maxRun,
      effectiveRounds: maxRun,
      qualified,
    });
    return {
      studentId: m.studentId,
      studentName: m.name,
      records: mine.map((r) => ({
        id: String(r.id),
        runIndex: Number(r.run_index || 0),
        createdAt: fmtZh(r.created_at),
        config: asObj(r.config_json),
        tracking: asObj(r.tracking_json),
        optimize: asObj(r.optimize_json),
        summary: {
          users: Number(r.tracking_json?.users || 0),
          revenue: Number(r.tracking_json?.revenue || 0),
          cac: Number(r.tracking_json?.cac || 0),
          ltv: Number(r.tracking_json?.ltv || 0),
        },
      })),
    };
  });

  return {
    moduleKey: 'simulation',
    name: STAGE_META.simulation.name,
    team: { progress, teamQualified: allQualified },
    members: memberPayloads,
  };
}

async function loadPlanStage(pool, classId, teamId, members) {
  const { rows: wsRows } = await pool.query(
    `SELECT sections_json, cover_json, revision, updated_at
     FROM teacher_personal_class_team_business_plan_workspace WHERE team_id = $1`,
    [teamId]
  );
  const { rows: verRows } = await pool.query(
    `SELECT id, version_no, summary, sections_json, cover_json, saved_at, saved_by
     FROM teacher_personal_class_team_business_plan_versions
     WHERE team_id = $1 ORDER BY version_no DESC LIMIT 20`,
    [teamId]
  );
  const { rows: analysisRows } = await pool.query(
    `SELECT id, result_text, created_at FROM teacher_personal_class_team_business_plan_analyses
     WHERE team_id = $1 ORDER BY created_at DESC LIMIT 10`,
    [teamId]
  );
  const { rows: lockRows } = await pool.query(
    `SELECT section_key, locked_by, locked_at,
            COALESCE(u.real_name, u.username, '') AS name
     FROM teacher_personal_class_team_business_plan_section_locks l
     JOIN users u ON u.id = l.locked_by
     WHERE l.team_id = $1`,
    [teamId]
  );
  const { rows: subRows } = await pool.query(
    `SELECT s.id, s.status, s.submitted_at, s.review_comment, s.score_json, s.total_score,
            s.submitted_by, v.version_no, v.summary, v.sections_json
     FROM teacher_personal_class_team_business_plan_submissions s
     JOIN teacher_personal_class_team_business_plan_versions v ON v.id = s.version_id
     WHERE s.teacher_personal_class_id = $1 AND s.team_id = $2
     ORDER BY s.submitted_at DESC LIMIT 1`,
    [classId, teamId]
  );
  let attachments = [];
  if (subRows[0]) {
    const { rows: attRows } = await pool.query(
      `SELECT id, file_name, file_size, is_ppt
       FROM teacher_personal_class_team_business_plan_submission_attachments
       WHERE submission_id = $1 ORDER BY is_ppt DESC, sort_order ASC, id ASC`,
      [subRows[0].id]
    );
    attachments = attRows.map((a) => ({
      id: String(a.id),
      fileName: a.file_name || '',
      fileSize: Number(a.file_size || 0),
      isPpt: Boolean(a.is_ppt),
      downloadUrl: `/api/teacher/personal-classes/${classId}/business-plan/submissions/${subRows[0].id}/attachments/${a.id}/download`,
    }));
  }
  const wsSections = coerceSections(wsRows[0]?.sections_json);
  const subSections = subRows[0] ? coerceSections(subRows[0].sections_json) : null;

  return {
    moduleKey: 'plan',
    name: STAGE_META.plan.name,
    team: {
      workspace: wsRows[0]
        ? {
            sections: wsSections,
            cover: asObj(wsRows[0].cover_json),
            revision: Number(wsRows[0].revision || 0),
            updatedAt: fmtZh(wsRows[0].updated_at),
            fullText: sectionsToFullText(wsSections),
          }
        : null,
      versions: verRows.map((v) => ({
        id: String(v.id),
        versionNo: Number(v.version_no || 0),
        summary: v.summary || '',
        createdAt: fmtZh(v.saved_at),
        createdBy: v.saved_by != null ? String(v.saved_by) : '',
        sections: coerceSections(v.sections_json),
        cover: asObj(v.cover_json),
      })),
      analyses: analysisRows.map((a) => ({
        id: String(a.id),
        result: a.result_text || '',
        createdAt: fmtZh(a.created_at),
      })),
      locks: lockRows.map((l) => ({
        sectionKey: l.section_key,
        studentId: String(l.locked_by),
        studentName: l.name || '',
        lockedAt: fmtZh(l.locked_at),
      })),
      submission: subRows[0]
        ? {
            id: String(subRows[0].id),
            status: subRows[0].status || '',
            submittedAt: fmtZh(subRows[0].submitted_at),
            reviewComment: subRows[0].review_comment || '',
            scoreJson: subRows[0].score_json,
            totalScore: subRows[0].total_score,
            submittedBy: subRows[0].submitted_by != null ? String(subRows[0].submitted_by) : '',
            versionNo: Number(subRows[0].version_no || 0),
            versionSummary: subRows[0].summary || '',
            sections: subSections,
            fullText: subSections ? sectionsToFullText(subSections) : '',
            attachments,
          }
        : null,
    },
    members: members.map((m) => ({
      studentId: m.studentId,
      studentName: m.name,
      lockedSections: lockRows.filter((l) => String(l.locked_by) === m.studentId).map((l) => l.section_key),
    })),
  };
}

/**
 * @param {import('pg').Pool} pool
 * @param {number} classId
 * @param {number} teamId
 * @param {string} moduleKey
 */
export async function loadStageWorkspace(pool, classId, teamId, moduleKey) {
  const key = String(moduleKey || '').trim();
  if (!STAGE_META[key] && key !== 'team') {
    if (!SKIPPABLE_MODULE_KEYS.includes(key) && key !== 'team') return { error: 'invalid' };
  }
  const enabled = await loadEnabledOrder(pool, classId);
  if (!enabled.includes(key)) return { error: 'skipped' };

  const base = await loadTeamMembers(pool, classId, teamId);
  if (!base) return { error: 'not_found' };

  let data;
  switch (key) {
    case 'team':
      data = await loadTeamStage(pool, classId, teamId, base.members);
      break;
    case 'ideation':
      data = await loadIdeationStage(pool, classId, teamId, base.members);
      break;
    case 'market':
      data = await loadMarketStage(pool, classId, teamId, base.members);
      break;
    case 'product':
      data = await loadProductStage(pool, classId, teamId, base.members);
      break;
    case 'business':
      data = await loadBusinessStage(pool, classId, teamId, base.members);
      break;
    case 'simulation':
      data = await loadSimulationStage(pool, classId, teamId, base.members);
      break;
    case 'plan':
      data = await loadPlanStage(pool, classId, teamId, base.members);
      break;
    default:
      return { error: 'invalid' };
  }
  return { data, team: base.team, members: base.members, enabledOrder: enabled };
}

export { STAGE_META, MARKET_UPLOAD_ROOT };
