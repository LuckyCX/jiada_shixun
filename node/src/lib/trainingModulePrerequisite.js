import { TASK_MODULE_TO_TRAINING_ID } from './personalClassTaskConstants.js';

export const COURSE_GATE_PERCENT = 80;

const TRAINING_ID_TO_MODULE_NAME = Object.fromEntries(
  Object.entries(TASK_MODULE_TO_TRAINING_ID).map(([name, id]) => [id, name])
);

function isTrackableResource(row) {
  return row.resource_type !== 'archive' && row.previewType !== 'archive';
}

function previewTypeFromMime(mime, resourceType) {
  const m = String(mime || '').toLowerCase();
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';
  if (m.startsWith('image/')) return 'image';
  if (m === 'application/pdf') return 'pdf';
  if (resourceType === 'archive') return 'archive';
  return 'file';
}

function leafCoursePercentFromResources(resources) {
  const trackable = resources.filter((r) => r.type !== 'archive' && r.previewType !== 'archive');
  if (!trackable.length) return 100;
  const sum = trackable.reduce((acc, r) => acc + (r.progressPercent || 0), 0);
  return Math.round(sum / trackable.length);
}

function evaluateLeaves(leaves, passedKpSet, threshold = COURSE_GATE_PERCENT) {
  if (!leaves.length) {
    return {
      allowed: true,
      mode: 'none',
      pendingCourseLeaves: [],
      pendingQuizKnowledgePointIds: [],
      lockedQuizKnowledgePointIds: [],
      summary: '',
      requiredKnowledgePointCount: 0,
      passedKnowledgePointCount: 0,
    };
  }

  const pendingCourseLeaves = [];
  const pendingQuizKnowledgePointIds = [];
  const lockedQuizKnowledgePointIds = [];
  const allKpIds = new Set();

  for (const leaf of leaves) {
    const percent = leaf.percent;
    const courseOk = percent >= threshold;
    const kpIds = leaf.knowledgePointIds;
    kpIds.forEach((id) => allKpIds.add(id));

    if (!courseOk) {
      if (leaf.hasTrackable) {
        pendingCourseLeaves.push({ nodeId: leaf.id, title: leaf.title, percent });
      }
      kpIds.forEach((id) => {
        if (!lockedQuizKnowledgePointIds.includes(id)) lockedQuizKnowledgePointIds.push(id);
      });
      continue;
    }

    for (const id of kpIds) {
      if (!passedKpSet.has(id) && !pendingQuizKnowledgePointIds.includes(id)) {
        pendingQuizKnowledgePointIds.push(id);
      }
    }
  }

  const allowed =
    pendingCourseLeaves.length === 0 &&
    pendingQuizKnowledgePointIds.length === 0 &&
    lockedQuizKnowledgePointIds.length === 0;

  let summary = '';
  if (!allowed) {
    const parts = [];
    if (pendingCourseLeaves.length) parts.push(`${pendingCourseLeaves.length} 个子小节课程学习未达 ${threshold}%`);
    if (lockedQuizKnowledgePointIds.length) parts.push('部分知识点需先完成对应小节课程学习后才能检测');
    if (pendingQuizKnowledgePointIds.length) parts.push(`${pendingQuizKnowledgePointIds.length} 项知识点检测未完成`);
    summary = parts.join('；');
  }

  const requiredKnowledgePointCount = allKpIds.size;
  let passedKnowledgePointCount = 0;
  allKpIds.forEach((id) => {
    if (passedKpSet.has(id)) passedKnowledgePointCount += 1;
  });

  return {
    allowed,
    mode: allowed ? 'none' : 'blocked',
    pendingCourseLeaves,
    pendingQuizKnowledgePointIds,
    lockedQuizKnowledgePointIds,
    summary,
    requiredKnowledgePointCount,
    passedKnowledgePointCount,
  };
}

/**
 * @param {import('pg').Pool} pool
 * @param {number} studentId
 * @param {string} moduleKey ideation|market|...
 */
export async function evaluateModulePrerequisiteForStudent(pool, studentId, moduleKey) {
  const moduleName = TRAINING_ID_TO_MODULE_NAME[moduleKey];
  if (!moduleName) {
    return {
      allowed: true,
      mode: 'none',
      pendingCourseLeaves: [],
      pendingQuizKnowledgePointIds: [],
      lockedQuizKnowledgePointIds: [],
      summary: '',
      requiredKnowledgePointCount: 0,
      passedKnowledgePointCount: 0,
    };
  }

  const { rows } = await pool.query(
    `SELECT id, title
     FROM course_resource_nodes
     WHERE module_key = $1 AND level = 3 AND status = 'published'
     ORDER BY sort_order ASC, id ASC`,
    [moduleKey]
  );
  if (!rows.length) {
    return evaluateLeaves([], new Set());
  }

  const nodeIds = rows.map((r) => r.id);
  const { rows: fileRows } = await pool.query(
    `SELECT id, node_id, resource_type, mime_type, preview_mime_type, content_hash
     FROM course_resource_files
     WHERE node_id = ANY($1::bigint[])`,
    [nodeIds]
  );
  const hashes = fileRows.map((r) => r.content_hash).filter(Boolean);
  const progressByHash = new Map();
  if (studentId && hashes.length) {
    const { rows: progressRows } = await pool.query(
      `SELECT content_hash, progress_percent, completed_at
       FROM student_course_resource_progress
       WHERE user_id = $1 AND content_hash = ANY($2::varchar[])`,
      [studentId, hashes]
    );
    progressRows.forEach((row) => {
      const pct = Number(row.progress_percent || 0);
      progressByHash.set(row.content_hash, {
        progressPercent: row.completed_at ? 100 : pct,
      });
    });
  }

  const { rows: linkRows } = await pool.query(
    `SELECT l.node_id, k.id AS knowledge_point_id
     FROM course_resource_node_knowledge_points l
     JOIN knowledge_points k ON k.id = l.knowledge_point_id
     WHERE l.node_id = ANY($1::bigint[])`,
    [nodeIds]
  );
  const kpByNode = new Map();
  for (const row of linkRows) {
    const key = String(row.node_id);
    const arr = kpByNode.get(key) || [];
    arr.push(String(row.knowledge_point_id));
    kpByNode.set(key, arr);
  }

  const resourcesByNode = new Map();
  for (const row of fileRows) {
    const key = String(row.node_id);
    const previewType = previewTypeFromMime(row.preview_mime_type || row.mime_type, row.resource_type);
    const items = resourcesByNode.get(key) || [];
    const progress = progressByHash.get(row.content_hash) || { progressPercent: 0 };
    items.push({
      type: row.resource_type,
      previewType,
      progressPercent: progress.progressPercent,
    });
    resourcesByNode.set(key, items);
  }

  const leaves = rows.map((row) => {
    const id = String(row.id);
    const resources = resourcesByNode.get(id) || [];
    const trackable = resources.filter((r) => r.type !== 'archive' && r.previewType !== 'archive');
    return {
      id,
      title: row.title,
      knowledgePointIds: kpByNode.get(id) || [],
      percent: leafCoursePercentFromResources(resources),
      hasTrackable: trackable.length > 0,
    };
  });

  const allKpIds = [...new Set(leaves.flatMap((l) => l.knowledgePointIds))];
  const passedKpSet = new Set();
  if (allKpIds.length && studentId) {
    const { rows: passRows } = await pool.query(
      `SELECT DISTINCT q.knowledge_point_id::text AS id
       FROM quiz_attempts a
       JOIN quizzes q ON q.id = a.quiz_id
       WHERE a.user_id = $1 AND a.passed = true AND q.knowledge_point_id = ANY($2::bigint[])`,
      [studentId, allKpIds.map(Number)]
    );
    passRows.forEach((r) => passedKpSet.add(String(r.id)));
  }

  return evaluateLeaves(leaves, passedKpSet);
}

export async function assertModulePrerequisiteAllowed(pool, studentId, moduleKey) {
  const result = await evaluateModulePrerequisiteForStudent(pool, studentId, moduleKey);
  if (!result.allowed) {
    const err = new Error(result.summary || '请先完成本环节实践课程学习及知识点检测');
    err.code = 'PREREQUISITE_BLOCKED';
    err.detail = result;
    throw err;
  }
  return result;
}
