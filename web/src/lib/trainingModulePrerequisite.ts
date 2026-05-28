import type { TaskResourceFile, TaskResourceNode } from './personalClassTaskApi';

export const COURSE_GATE_PERCENT = 80;

type ResourceProgress = {
  progressPercent: number;
  completed: boolean;
};

const clampProgressPercent = (value: number) =>
  Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));

export function isTrackableLearningResource(resource: {
  type: string;
  previewType?: string;
}): boolean {
  return resource.type !== 'archive' && resource.previewType !== 'archive';
}

const normalizeResourceProgress = (progress?: TaskResourceFile['progress']): ResourceProgress => {
  const progressPercent = clampProgressPercent(progress?.progressPercent || 0);
  const completed = Boolean(progress?.completed) || progressPercent >= 100;
  return {
    progressPercent: completed ? 100 : progressPercent,
    completed,
  };
};

/** 子小节内可追踪课件 progress 算术平均；无课件视为 100 */
export function leafCoursePercent(leaf: TaskResourceNode): number {
  const trackable = (leaf.resources || []).filter(isTrackableLearningResource);
  if (trackable.length === 0) return 100;
  const sum = trackable.reduce(
    (acc, r) => acc + normalizeResourceProgress(r.progress).progressPercent,
    0
  );
  return Math.round(sum / trackable.length);
}

export function isLeafCourseGateMet(leaf: TaskResourceNode, threshold = COURSE_GATE_PERCENT): boolean {
  return leafCoursePercent(leaf) >= threshold;
}

export function canStartKnowledgeQuizOnLeaf(leaf: TaskResourceNode, threshold = COURSE_GATE_PERCENT): boolean {
  return isLeafCourseGateMet(leaf, threshold);
}

export function isLeafTrainingGateMet(
  leaf: TaskResourceNode,
  completedKnowledgeIds: Set<string> | string[],
  threshold = COURSE_GATE_PERCENT
): boolean {
  if (!isLeafCourseGateMet(leaf, threshold)) return false;
  const kpIds = (leaf.knowledgePoints || []).map((k) => String(k.id)).filter(Boolean);
  if (kpIds.length === 0) return true;
  const done = completedKnowledgeIds instanceof Set ? completedKnowledgeIds : new Set(completedKnowledgeIds);
  return kpIds.every((id) => done.has(id));
}

export type PendingCourseLeaf = {
  nodeId: string;
  title: string;
  percent: number;
};

export type ModulePrerequisiteResult = {
  allowed: boolean;
  mode: 'none' | 'blocked';
  pendingCourseLeaves: PendingCourseLeaf[];
  /** 已达 80% 但仍未通过的 KP */
  pendingQuizKnowledgePointIds: string[];
  /** 未达 80%、暂不可开始检测的 KP */
  lockedQuizKnowledgePointIds: string[];
  summary: string;
};

export function evaluateModulePrerequisite(
  leaves: TaskResourceNode[],
  completedKnowledgeIds: Set<string> | string[],
  threshold = COURSE_GATE_PERCENT
): ModulePrerequisiteResult {
  if (!leaves.length) {
    return {
      allowed: true,
      mode: 'none',
      pendingCourseLeaves: [],
      pendingQuizKnowledgePointIds: [],
      lockedQuizKnowledgePointIds: [],
      summary: '',
    };
  }

  const done =
    completedKnowledgeIds instanceof Set ? completedKnowledgeIds : new Set(completedKnowledgeIds);

  const pendingCourseLeaves: PendingCourseLeaf[] = [];
  const pendingQuizKnowledgePointIds: string[] = [];
  const lockedQuizKnowledgePointIds: string[] = [];

  for (const leaf of leaves) {
    const percent = leafCoursePercent(leaf);
    const courseOk = percent >= threshold;
    const kpIds = (leaf.knowledgePoints || []).map((k) => String(k.id)).filter(Boolean);

    if (!courseOk) {
      const hasTrackable = (leaf.resources || []).some(isTrackableLearningResource);
      if (hasTrackable) {
        pendingCourseLeaves.push({
          nodeId: leaf.id,
          title: leaf.title,
          percent,
        });
      }
      kpIds.forEach((id) => {
        if (!lockedQuizKnowledgePointIds.includes(id)) lockedQuizKnowledgePointIds.push(id);
      });
      continue;
    }

    if (kpIds.length === 0) continue;

    for (const id of kpIds) {
      if (!done.has(id) && !pendingQuizKnowledgePointIds.includes(id)) {
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
    const parts: string[] = [];
    if (pendingCourseLeaves.length) {
      parts.push(`${pendingCourseLeaves.length} 个子小节课程学习未达 ${threshold}%`);
    }
    if (lockedQuizKnowledgePointIds.length) {
      parts.push('部分知识点需先完成对应小节课程学习后才能检测');
    }
    if (pendingQuizKnowledgePointIds.length) {
      parts.push(`${pendingQuizKnowledgePointIds.length} 项知识点检测未完成`);
    }
    summary = parts.join('；');
  }

  return {
    allowed,
    mode: allowed ? 'none' : 'blocked',
    pendingCourseLeaves,
    pendingQuizKnowledgePointIds,
    lockedQuizKnowledgePointIds,
    summary,
  };
}

/** 某知识点是否允许开始检测（按其所在 leaf） */
export function canStartKnowledgeQuiz(
  knowledgePointId: string,
  leaves: TaskResourceNode[],
  threshold = COURSE_GATE_PERCENT
): boolean {
  const id = String(knowledgePointId);
  for (const leaf of leaves) {
    const kpIds = (leaf.knowledgePoints || []).map((k) => String(k.id));
    if (kpIds.includes(id)) return canStartKnowledgeQuizOnLeaf(leaf, threshold);
  }
  return true;
}
