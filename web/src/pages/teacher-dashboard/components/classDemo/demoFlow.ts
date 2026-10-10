/**
 * 演示页的业务对象只放在 sessionStorage 的 flows 里。
 * 刷新还在，关页丢失；不写学生业务表。
 */
import { demoId, loadDemoState, updateDemoState } from './demoStore';

export const DEMO_STUDENT_ID = 'demo-student';
export const DEMO_STUDENT_NAME = '演示学员';

export function nowIso() {
  return new Date().toISOString();
}

export function demoTeamName(classId: string) {
  const state = loadDemoState(classId);
  return state.teamSession.teamName || state.team.name || '演示团队';
}

export function readFlow<T>(classId: string, key: string, fallback: T): T {
  const value = loadDemoState(classId).flows?.[key];
  if (value == null) return fallback;
  return value as T;
}

export function writeFlow<T>(classId: string, key: string, value: T): T {
  updateDemoState(classId, (prev) => ({
    ...prev,
    flows: { ...(prev.flows || {}), [key]: value },
  }));
  return value;
}

export function patchFlow<T>(classId: string, key: string, fallback: T, updater: (prev: T) => T): T {
  return writeFlow(classId, key, updater(readFlow(classId, key, fallback)));
}

/** 模型有时会在 JSON 前后加说明，只取出第一段对象或数组。 */
export function parseLooseJson<T>(text: string, fallback: T): T {
  const raw = String(text || '').trim();
  const obj = raw.indexOf('{');
  const arr = raw.indexOf('[');
  let start = -1;
  let endChar = '}';
  if (arr >= 0 && (obj < 0 || arr < obj)) {
    start = arr;
    endChar = ']';
  } else if (obj >= 0) {
    start = obj;
  }
  if (start < 0) return fallback;
  const end = raw.lastIndexOf(endChar);
  if (end <= start) return fallback;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as T;
  } catch (e) {
    console.error('[classDemo] JSON 解析失败', e);
    return fallback;
  }
}

export function htmlParagraphs(text: string) {
  return String(text || '')
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

export { demoId };
