/** 实训助教回复中的路由标记：[[route:/path?tab=xx|按钮文案]] */

export type AiTutorRouteRole = 'student' | 'teacher';

export type AiTutorContentPart =
  | { type: 'text'; text: string }
  | { type: 'route'; path: string; label: string };

const STUDENT_TABS = new Set([
  'overview',
  'knowledge',
  'guide',
  'archive',
  'notifications',
  'module-team',
  'module-ideation',
  'module-market',
  'module-product',
  'module-business',
  'module-simulation',
  'module-plan',
]);

const TEACHER_TABS = new Set([
  'monitor',
  'guidance',
  'classManagement',
  'courseSettings',
  'teamReview',
  'topicReview',
  'businessPlanReview',
  'teacherGuide',
  'studentManagement',
  'teamWorkspace',
]);

const TEACHER_SAFE_QUERY = new Set(['tab', 'classId', 'sub', 'teamId', 'stage', 'submissionId']);

export function isAllowedAiTutorPath(role: AiTutorRouteRole, rawPath: string): boolean {
  const s = String(rawPath || '').trim();
  if (!s.startsWith('/')) return false;
  if (/admin/i.test(s)) return false;
  let url: URL;
  try {
    url = new URL(s, 'http://local.invalid');
  } catch {
    return false;
  }
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  if (role === 'student') {
    if (pathname !== '/student-center') return false;
    const tab = url.searchParams.get('tab') || 'overview';
    return STUDENT_TABS.has(tab);
  }
  if (pathname !== '/teacher-dashboard') return false;
  const tab = url.searchParams.get('tab') || 'monitor';
  if (!TEACHER_TABS.has(tab)) return false;
  for (const key of url.searchParams.keys()) {
    if (!TEACHER_SAFE_QUERY.has(key)) return false;
  }
  return true;
}

/** 解析回复文本为文本段 + 合法路由按钮 */
export function parseAiTutorContent(role: AiTutorRouteRole, content: string): AiTutorContentPart[] {
  const src = String(content || '');
  const re = /\[\[route:([^|\]]+)\|([^\]]+)\]\]/g;
  const parts: AiTutorContentPart[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m.index > last) {
      parts.push({ type: 'text', text: src.slice(last, m.index) });
    }
    const path = String(m[1] || '').trim();
    const label = String(m[2] || '').trim() || '前往';
    if (isAllowedAiTutorPath(role, path)) {
      parts.push({ type: 'route', path, label });
    }
    last = m.index + m[0].length;
  }
  if (last < src.length) parts.push({ type: 'text', text: src.slice(last) });
  // 去掉空文本段
  return parts.filter((p) => p.type === 'route' || (p.type === 'text' && p.text.trim()));
}

/** 苏格拉底引导问题（欢迎区第二块） */
export function socraticGuideQuestions(role: AiTutorRouteRole): string[] {
  if (role === 'teacher') {
    return [
      '录课时怎样用提问带动学生找到真实用户？',
      '怎样引导学生把兴趣收成可验证的创业选题？',
      '组队完成后，我该怎么督促滞后团队？',
      '怎样检查学生市场调研是否真的做完了？',
      '商业计划书审核时，怎样给可改进的意见？',
    ];
  }
  return [
    '怎样从我的兴趣找到一个创业项目方向？',
    '用户、痛点和解决方案应该怎样对齐？',
    '项目选题表单每一项该怎么写才不被退回？',
    '做市场调研时该先找谁、问什么？',
    '商业画布九格怎样落到我们团队的项目上？',
  ];
}
