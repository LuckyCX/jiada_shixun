/**
 * 演示里的课件进度只写 session。函数名跟学习页原来调用的学生接口一致，地址改走教师课件。
 */
import { courseResourceFileUrl } from '../../../../lib/courseResourceApi';
import { readFlow, writeFlow } from './demoFlow';
import { updateDemoState } from './demoStore';

export type DemoResourceProgress = {
  progressPercent: number;
  lastPosition: Record<string, unknown>;
  completed: boolean;
};

let boundClassId = '';

export function bindDemoCourseClass(classId: string) {
  boundClassId = classId;
}

function emptyProgress(): DemoResourceProgress {
  return { progressPercent: 0, lastPosition: {}, completed: false };
}

export function readDemoResourceProgress(classId: string, resourceId: string): DemoResourceProgress {
  const bag = readFlow<Record<string, DemoResourceProgress>>(classId, 'resourceProgress', {});
  return bag[resourceId] || emptyProgress();
}

export function studentCourseResourceFileUrl(resourceId: string, mode: 'preview' | 'download', _token?: string) {
  return courseResourceFileUrl(resourceId, mode);
}

export async function fetchStudentResourceProgress(resourceId: string): Promise<DemoResourceProgress> {
  if (!boundClassId) return emptyProgress();
  return readDemoResourceProgress(boundClassId, resourceId);
}

export async function saveStudentResourceProgress(
  resourceId: string,
  body: { progressPercent: number; lastPosition?: Record<string, unknown>; completed?: boolean }
) {
  const next: DemoResourceProgress = {
    progressPercent: body.progressPercent,
    lastPosition: body.lastPosition || {},
    completed: Boolean(body.completed || body.progressPercent >= 100),
  };
  if (!boundClassId) return next;
  const classId = boundClassId;
  const bag = readFlow<Record<string, DemoResourceProgress>>(classId, 'resourceProgress', {});
  writeFlow(classId, 'resourceProgress', { ...bag, [resourceId]: next });
  updateDemoState(classId, (prev) => ({
    ...prev,
    learning: {
      ...prev.learning,
      resourceProgress: { ...prev.learning.resourceProgress, [resourceId]: next.progressPercent },
    },
  }));
  return next;
}
