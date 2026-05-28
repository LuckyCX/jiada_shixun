/** 商业计划书：默认 8 章（可增删改） */
export const BUSINESS_PLAN_SECTION_DEFS = [
  { key: 'executive_summary', title: '执行摘要' },
  { key: 'background', title: '项目背景' },
  { key: 'market', title: '市场分析' },
  { key: 'product', title: '产品与服务' },
  { key: 'business_model', title: '商业模式' },
  { key: 'marketing', title: '营销策略' },
  { key: 'finance', title: '财务规划' },
  { key: 'team', title: '团队介绍' },
];

export function defaultSections() {
  return BUSINESS_PLAN_SECTION_DEFS.map((d) => ({
    key: d.key,
    title: d.title,
    content: '',
  }));
}

export function coerceSections(input) {
  if (!Array.isArray(input)) return defaultSections();
  const defs = new Map(BUSINESS_PLAN_SECTION_DEFS.map((d) => [d.key, d.title]));
  const used = new Set();
  const out = [];
  for (const raw of input) {
    const key = String(raw?.key || '').trim() || `sec_${Math.random().toString(16).slice(2)}`;
    if (used.has(key)) continue;
    used.add(key);
    const title = String(raw?.title ?? defs.get(key) ?? '').trim() || '未命名章节';
    const content = String(raw?.content ?? '');
    out.push({ key, title, content });
  }
  return out.length ? out : defaultSections();
}

export function sectionsToFullText(sections) {
  return coerceSections(sections)
    .filter((s) => String(s.content || '').trim())
    .map((s, i) => `${i + 1}、${s.title}\n\n${String(s.content || '').trim()}`)
    .join('\n\n');
}

export function countCompletedSections(sections) {
  return coerceSections(sections).filter((s) => String(s.content || '').trim().length > 0).length;
}
