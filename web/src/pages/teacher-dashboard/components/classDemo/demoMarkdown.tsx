/**
 * 演示模块 AI 长文/对话统一走 Markdown 渲染，避免露出 ** / ###。
 * 实现复用 ChatMarkdown，保持演示端 import 路径不变。
 */
export { ChatMarkdown as DemoMarkdown, renderChatMarkdown as renderDemoMarkdown } from '../../../../components/ChatMarkdown';
