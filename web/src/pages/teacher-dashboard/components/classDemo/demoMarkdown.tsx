/**
 * 演示模块 AI 长文/对话统一走 Markdown 渲染，避免露出 ** / ###。
 */
import MarkdownIt from 'markdown-it';
import { sanitizeRichText } from '../../../../lib/richText';

const demoMd = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
});

const DEMO_MD_CLS =
  'demo-md break-words [&_p]:my-1.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_strong]:font-semibold [&_em]:italic [&_h1]:text-base [&_h1]:font-bold [&_h1]:my-2 [&_h2]:text-sm [&_h2]:font-bold [&_h2]:my-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:my-1.5 [&_h4]:text-sm [&_h4]:font-semibold [&_hr]:my-2 [&_hr]:border-gray-200 [&_a]:text-indigo-600 [&_a]:underline [&_code]:rounded [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:text-[12px] [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-gray-50 [&_pre]:p-2';

export function renderDemoMarkdown(text: string) {
  return sanitizeRichText(demoMd.render(String(text || '')));
}

export function DemoMarkdown({ text, className = '' }: { text: string; className?: string }) {
  return (
    <div
      className={`${DEMO_MD_CLS} ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: renderDemoMarkdown(text) }}
    />
  );
}
