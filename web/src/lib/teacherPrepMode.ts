/**
 * 教师「进入学生端」备课模式：进度按教师账号隔离，只存本机 localStorage，不写学生业务库。
 */
import { clearDemoState, hasDemoState, loadDemoState } from '../pages/teacher-dashboard/components/classDemo/demoStore';

const PREP_SESSION_KEY = 'jiada_teacher_prep_active_v1';
const PREP_META_PREFIX = 'jiada_teacher_prep_meta_v1:';

export type TeacherPrepMeta = {
  teacherId: string;
  /** 仅用于演示 AI/上传鉴权的备课班壳 id，业务进度不落此班学生表 */
  prepClassId: string;
  className: string;
};

export function prepDemoClassId(teacherId: string) {
  return `teacher-prep-${String(teacherId).trim()}`;
}

export function getTeacherPrepMeta(teacherId: string): TeacherPrepMeta | null {
  try {
    const raw = localStorage.getItem(`${PREP_META_PREFIX}${teacherId}`);
    if (!raw) return null;
    const j = JSON.parse(raw) as TeacherPrepMeta;
    if (!j?.teacherId || !j?.prepClassId) return null;
    return j;
  } catch {
    return null;
  }
}

export function setTeacherPrepMeta(meta: TeacherPrepMeta) {
  localStorage.setItem(`${PREP_META_PREFIX}${meta.teacherId}`, JSON.stringify(meta));
}

export function teacherPrepHasLocalData(teacherId: string): boolean {
  const demoId = prepDemoClassId(teacherId);
  if (!hasDemoState(demoId)) return false;
  // 空壳不算「有进度」
  try {
    const st = loadDemoState(demoId);
    const confirmed = Boolean(st.team?.confirmed || st.teamSession?.status);
    const flowKeys = Object.keys(st.flows || {});
    return confirmed || flowKeys.length > 0 || Boolean(st.teamSession?.analysisText);
  } catch {
    return false;
  }
}

export function clearTeacherPrepLocalData(teacherId: string) {
  clearDemoState(prepDemoClassId(teacherId));
}

export function activateTeacherPrepSession(meta: TeacherPrepMeta) {
  setTeacherPrepMeta(meta);
  sessionStorage.setItem(PREP_SESSION_KEY, JSON.stringify(meta));
}

export function getActiveTeacherPrepSession(): TeacherPrepMeta | null {
  try {
    const raw = sessionStorage.getItem(PREP_SESSION_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as TeacherPrepMeta;
    if (!j?.teacherId || !j?.prepClassId) return null;
    return j;
  } catch {
    return null;
  }
}

export function clearActiveTeacherPrepSession() {
  sessionStorage.removeItem(PREP_SESSION_KEY);
}

/** demoStore 判断：该 classId 是否走教师备课 localStorage */
export function isTeacherPrepDemoClassId(classId: string) {
  return String(classId || '').startsWith('teacher-prep-');
}

/**
 * 演示 AI/上传 URL 需要真实备课班 id；页面内 state 仍用 teacher-prep-{teacherId}。
 */
export function resolvePrepApiClassId(classId: string): string {
  const id = String(classId || '');
  if (!id.startsWith('teacher-prep-')) return id;
  const teacherId = id.slice('teacher-prep-'.length);
  const meta = getActiveTeacherPrepSession() || getTeacherPrepMeta(teacherId);
  return meta?.prepClassId || id;
}
