import { useEffect, useRef, useState } from 'react';
import { Input, message } from 'antd';
import MarkdownIt from 'markdown-it';
import { useNavigate } from 'react-router-dom';
import {
  fetchAiTutorMessages,
  fetchAiTutorPresets,
  sendAiTutorMessage,
  type AiTutorMessage,
  type AiTutorPreset,
} from '../lib/aiTutorApi';
import { useSiteBrand } from '../lib/publicSite';
import { sanitizeRichText } from '../lib/richText';
import {
  parseAiTutorContent,
  socraticGuideQuestions,
  type AiTutorRouteRole,
} from '../lib/aiTutorRoutes';

type Props = {
  role: AiTutorRouteRole;
  open: boolean;
  onClose: () => void;
  onNavigate?: (path: string) => void;
};

/** 助教回复 Markdown：禁原生 HTML，渲染后走 DOMPurify */
const tutorMarkdown = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
});

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function splitTableCells(line: string) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map((c) => c.trim());
}

function isTableSep(line: string) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

/** markdown-it 默认不渲染 GFM 表格，先拆成 table HTML，其余仍走 Markdown */
function renderTutorMarkdown(text: string) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const chunks: string[] = [];
  const md: string[] = [];
  const flushMd = () => {
    if (!md.length) return;
    chunks.push(tutorMarkdown.render(md.join('\n')));
    md.length = 0;
  };
  let i = 0;
  while (i < lines.length) {
    const row = lines[i];
    const sep = lines[i + 1] || '';
    if (row.includes('|') && isTableSep(sep)) {
      flushMd();
      const head = splitTableCells(row);
      const body: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        body.push(splitTableCells(lines[i]));
        i += 1;
      }
      const th = head.map((c) => `<th>${escapeHtml(c)}</th>`).join('');
      const trs = body
        .map((cells) => `<tr>${cells.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`)
        .join('');
      chunks.push(`<table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`);
      continue;
    }
    md.push(row);
    i += 1;
  }
  flushMd();
  return sanitizeRichText(chunks.join(''));
}

const TUTOR_MD_CLS =
  'ai-tutor-md break-words [&_p]:my-1.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_strong]:font-semibold [&_em]:italic [&_a]:text-indigo-600 [&_a]:underline [&_code]:rounded [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:text-[12px] [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-gray-50 [&_pre]:p-2 [&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs [&_th]:border [&_th]:border-gray-200 [&_th]:bg-gray-50 [&_th]:px-2 [&_th]:py-1 [&_td]:border [&_td]:border-gray-200 [&_td]:px-2 [&_td]:py-1';

function formatMsgTime(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function AssistantBubble({
  role,
  content,
  createdAt,
  onNavigate,
}: {
  role: AiTutorRouteRole;
  content: string;
  createdAt?: string;
  onNavigate: (path: string) => void;
}) {
  const parts = parseAiTutorContent(role, content);
  return (
    <div className="flex justify-start">
      <div className="max-w-[92%] space-y-1.5">
        <div className="rounded-2xl rounded-tl-md bg-white border border-gray-100 shadow-sm px-3.5 py-2.5 text-sm text-gray-800 leading-relaxed">
          {parts.map((p, i) =>
            p.type === 'text' ? (
              <div
                key={i}
                className={TUTOR_MD_CLS}
                dangerouslySetInnerHTML={{ __html: renderTutorMarkdown(p.text) }}
              />
            ) : (
              <div key={i} className="mt-2">
                <button
                  type="button"
                  onClick={() => onNavigate(p.path)}
                  className="w-full text-left rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5 hover:border-indigo-200 hover:bg-indigo-50/50 cursor-pointer transition-colors"
                >
                  <div className="text-sm font-medium text-gray-900">{p.label}</div>
                  <div className="text-[11px] text-indigo-600 mt-1">点击前往</div>
                </button>
              </div>
            )
          )}
        </div>
        {createdAt ? <div className="text-[10px] text-gray-400 px-1">{formatMsgTime(createdAt)}</div> : null}
      </div>
    </div>
  );
}

function WelcomeCard({
  brand,
  role,
  presets,
  guides,
  sending,
  open,
  onAsk,
}: {
  brand: string;
  role: AiTutorRouteRole;
  presets: AiTutorPreset[];
  guides: string[];
  sending: boolean;
  open: boolean;
  onAsk: (q: string) => void;
}) {
  const presetQs = presets.length
    ? presets.map((p) => p.question)
    : [
        '学生登录后先做什么？',
        '阶段被锁住了怎么办？',
        role === 'teacher' ? '教师端有哪些主要菜单？' : '项目选题谁来提交？',
      ];
  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm px-3.5 py-3 space-y-3">
      <p className="text-sm text-gray-800 leading-relaxed">
        Hi，我是<span className="font-semibold text-indigo-600">{brand}</span>平台 AI 助手，你可以问我以下内容：
      </p>
      <div>
        <div className="text-xs font-medium text-gray-500 mb-1.5">你可以问我以下内容</div>
        <div className="flex flex-col gap-2">
          {presetQs.map((q) => (
            <button
              key={q}
              type="button"
              disabled={sending || !open}
              onClick={() => onAsk(q)}
              className="w-full text-left text-sm text-indigo-800 bg-indigo-50/80 border border-indigo-100 rounded-2xl px-3.5 py-2.5 shadow-sm hover:bg-indigo-100 hover:border-indigo-200 cursor-pointer transition-colors disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="text-xs font-medium text-gray-500 mb-1.5">还可以问我怎样用{brand}完成实训引导</div>
        <div className="flex flex-col gap-2">
          {guides.map((q) => (
            <button
              key={q}
              type="button"
              disabled={sending || !open}
              onClick={() => onAsk(q)}
              className="w-full text-left text-sm text-gray-800 bg-gray-50 border border-gray-100 rounded-2xl px-3.5 py-2.5 shadow-sm hover:bg-gray-100 hover:border-gray-200 cursor-pointer transition-colors disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** 右侧推挤式侧栏：占用布局宽度，不遮罩左侧 */
export default function AiTutorPanel({ role, open, onClose, onNavigate }: Props) {
  const navigate = useNavigate();
  const { siteTitle } = useSiteBrand();
  const brand = siteTitle.trim() || '创业实训平台';
  const go = onNavigate || ((path: string) => navigate(path));

  const [presets, setPresets] = useState<AiTutorPreset[]>([]);
  const [messages, setMessages] = useState<AiTutorMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [awaitingFirstToken, setAwaitingFirstToken] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);
  const guides = socraticGuideQuestions(role);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    if (!loadedRef.current) setLoading(true);
    Promise.all([fetchAiTutorPresets(role), fetchAiTutorMessages(role)])
      .then(([p, m]) => {
        if (cancelled) return;
        setPresets(p);
        setMessages(m);
        loadedRef.current = true;
      })
      .catch((e) => {
        if (!cancelled) message.error(e instanceof Error ? e.message : '加载助教失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, role]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open, sending, loading, awaitingFirstToken]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || sending) return;
    setDraft('');
    setSending(true);
    setAwaitingFirstToken(true);
    const assistantId = `a-${Date.now()}`;
    const optimistic: AiTutorMessage = {
      id: `tmp-${Date.now()}`,
      role: 'user',
      content: q,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [
      ...prev,
      optimistic,
      { id: assistantId, role: 'assistant', content: '', createdAt: new Date().toISOString() },
    ]);
    try {
      await sendAiTutorMessage(role, q, {
        onContent: (chunk) => {
          setAwaitingFirstToken(false);
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + chunk } : m))
          );
        },
        onDone: (reply) => {
          setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: reply } : m)));
        },
      });
    } catch (e) {
      message.error(e instanceof Error ? e.message : '发送失败');
      setMessages((prev) => prev.filter((m) => m.id !== assistantId || m.content.trim()));
    } finally {
      setAwaitingFirstToken(false);
      setSending(false);
    }
  };

  // 学生主 header：py-3 单行；教师主 header：py-3 md:py-4 + 标题/副标题两行
  const headerCls =
    role === 'teacher'
      ? 'px-3 md:px-6 py-3 md:py-4 border-b border-gray-100 bg-white shrink-0'
      : 'px-3 md:px-6 py-3 border-b border-gray-100 bg-white shrink-0';

  return (
    <aside
      className={`shrink-0 h-screen sticky top-0 self-start bg-[#f7f6fb] border-l border-gray-100 flex flex-col overflow-hidden transition-[width] duration-200 ease-out ${
        open ? 'w-[min(400px,92vw)]' : 'w-0 border-l-0'
      }`}
      aria-hidden={!open}
    >
      <div className="w-[min(400px,92vw)] h-full flex flex-col min-h-0">
        <div className={headerCls}>
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="min-w-0 flex-1">
              {role === 'teacher' ? (
                <>
                <h2 className="text-base font-bold text-indigo-600 truncate leading-9 pt-1.5">AI 助手</h2>
                </>
              ) : (
                <h2 className="text-base font-bold text-indigo-600 truncate leading-9">AI 助手</h2>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 cursor-pointer shrink-0"
              aria-label="关闭助教"
            >
              <i className="ri-close-line text-lg" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col px-3 pb-3 pt-2">
          <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-0.5">
            {loading ? <div className="text-xs text-gray-400 text-center py-8">加载对话…</div> : null}

            {/* 欢迎语始终保留在对话列表顶部，发送问题后不隐藏 */}
            {!loading ? (
              <WelcomeCard
                brand={brand}
                role={role}
                presets={presets}
                guides={guides}
                sending={sending}
                open={open}
                onAsk={(q) => void send(q)}
              />
            ) : null}

            {messages.map((m) =>
              m.role === 'assistant' && !m.content.trim() ? null : m.role === 'user' ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] space-y-1">
                    <div className="rounded-2xl rounded-tr-md bg-indigo-100 text-indigo-950 px-3.5 py-2.5 text-sm whitespace-pre-wrap break-words leading-relaxed">
                      {m.content}
                    </div>
                    <div className="text-[10px] text-gray-400 text-right px-1">{formatMsgTime(m.createdAt)}</div>
                  </div>
                </div>
              ) : (
                <AssistantBubble
                  key={m.id}
                  role={role}
                  content={m.content}
                  createdAt={m.createdAt}
                  onNavigate={go}
                />
              )
            )}

            {awaitingFirstToken ? (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-tl-md bg-white border border-gray-100 shadow-sm px-3.5 py-2.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '120ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '240ms' }} />
                  </div>
                  <div className="text-[11px] text-gray-400">正在回答…</div>
                </div>
              </div>
            ) : null}
          </div>

          {/* 豆包风：发送按钮在输入框容器内右下角 */}
          <div className="pt-2 shrink-0">
            <div className="rounded-2xl border border-indigo-200 bg-white shadow-sm px-3 pt-2.5 pb-2 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-shadow">
              <Input.TextArea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                autoSize={{ minRows: 2, maxRows: 5 }}
                placeholder="输入问题，Enter 发送"
                disabled={sending || !open}
                variant="borderless"
                className="!p-0 !resize-none"
                onPressEnter={(e) => {
                  if (e.shiftKey) return;
                  e.preventDefault();
                  void send(draft);
                }}
              />
              <div className="flex items-center justify-end mt-1.5">
                <button
                  type="button"
                  disabled={sending || !open || !draft.trim()}
                  onClick={() => void send(draft)}
                  className="w-9 h-9 rounded-full bg-indigo-500 text-white flex items-center justify-center hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
                  aria-label="发送"
                >
                  {sending ? (
                    <i className="ri-loader-4-line text-lg animate-spin" />
                  ) : (
                    <i className="ri-arrow-up-line text-lg" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
