/**
 * 演示页里的实例库走教师只读接口，不碰学生封面和下载地址。
 */
import {
  downloadTeacherInstanceResource,
  fetchTeacherInstanceLibrary,
  getTeacherInstanceCaseCoverUrl,
  getTeacherInstanceResourcePreviewUrl,
} from '../../../../lib/teacherInstanceLibraryApi';

export type {
  InstanceLibraryCase,
  InstanceLibraryCategory,
  InstanceLibraryPayload,
} from '../../../../lib/teacherInstanceLibraryApi';

export async function fetchStudentInstanceLibrary(_classId: string, moduleKey = 'ideation') {
  return fetchTeacherInstanceLibrary(moduleKey);
}

export function getStudentInstanceCaseCoverUrl(_classId: string, caseId: string) {
  return getTeacherInstanceCaseCoverUrl(caseId);
}

export function getStudentInstanceResourcePreviewUrl(_classId: string, resourceId: string) {
  return getTeacherInstanceResourcePreviewUrl(resourceId);
}

export async function downloadStudentInstanceResource(_classId: string, resourceId: string, fileName: string) {
  return downloadTeacherInstanceResource(resourceId, fileName);
}
