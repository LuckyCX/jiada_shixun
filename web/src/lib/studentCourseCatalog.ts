import type { CourseResourceNode } from './courseResourceApi';
import type { TaskResourceNode, TaskResourceNodeAncestor } from './personalClassTaskApi';

export const TRAINING_MODULE_CATALOG_KEYS = [
  'ideation',
  'market',
  'product',
  'business',
  'simulation',
  'plan',
] as const;

/** 将学生端课程树转为与待办任务 resourceNodes 一致的结构，供章节树与知识点使用 */
export function flattenPublishedCourseLeaves(
  roots: CourseResourceNode[],
  fallbackModuleKey: string,
  fallbackModuleName: string
): TaskResourceNode[] {
  const leaves: TaskResourceNode[] = [];

  const toAncestor = (node: CourseResourceNode): TaskResourceNodeAncestor => ({
    id: node.id,
    parentId: node.parentId,
    level: node.level,
    moduleKey: node.moduleKey || fallbackModuleKey,
    moduleName: node.moduleName || fallbackModuleName,
    title: node.title,
    status: node.status,
    sortOrder: node.sortOrder,
  });

  const walk = (node: CourseResourceNode, ancestors: TaskResourceNodeAncestor[]) => {
    if (node.level === 3 && node.status === 'published') {
      leaves.push({
        id: node.id,
        parentId: node.parentId,
        level: 3,
        moduleKey: node.moduleKey || fallbackModuleKey,
        moduleName: node.moduleName || fallbackModuleName,
        title: node.title,
        status: node.status,
        sortOrder: node.sortOrder,
        ancestors,
        resources: (node.resources || []).map((r) => ({
          id: r.id,
          nodeId: r.nodeId,
          name: r.name,
          type: r.type,
          previewType: r.previewType,
          previewStatus: r.previewStatus,
          contentHash: r.contentHash || '',
          mimeType: r.mimeType || '',
          sizeBytes: r.sizeBytes ?? 0,
          size: r.size || '',
          canPreview: r.canPreview,
          progress: r.progress || { progressPercent: 0, lastPosition: {}, completed: false },
        })),
        knowledgePoints: (node.knowledgePoints || []).map((kp, i) => ({
          id: kp.id,
          title: kp.title,
          description: '',
          moduleKey: node.moduleKey || fallbackModuleKey,
          moduleName: node.moduleName || fallbackModuleName,
          sortOrder: i,
        })),
      });
      return;
    }
    const nextAncestors = [...ancestors, toAncestor(node)];
    (node.children || []).forEach((child) => walk(child, nextAncestors));
  };

  roots.forEach((root) => walk(root, []));
  return leaves;
}
