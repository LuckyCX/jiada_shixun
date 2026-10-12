/**
 * 商业计划书章节：把 AI 返回的 Markdown/纯文本转成富文本编辑器可用的 HTML，
 * 避免编辑器里直接露出 **、###、- 等符号。
 */
import MarkdownIt from 'markdown-it';
import { sanitizeRichText } from './richText';

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
});

/** 已是 HTML 则消毒后返回；否则按 Markdown 渲染再消毒 */
export function ensurePlanEditorHtml(raw: string): string {
  const s = String(raw || '');
  if (!s.trim()) return '';
  // 已含块级/行内标签时视为 HTML（教师审阅与编辑器同源）
  if (/<\/?(?:p|div|ul|ol|li|h[1-6]|br|strong|em|table|thead|tbody|tr|td|th|blockquote|pre|code)\b/i.test(s)) {
    return sanitizeRichText(s);
  }
  return sanitizeRichText(md.render(s));
}
