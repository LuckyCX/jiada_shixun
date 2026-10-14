/**
 * 创新方法工具：豆包式左侧对话（启思智能体 / 头脑风暴 / AI 创意 / 六帽嵌入）
 * 方法 chip 切换保留各线程；服务端 method-chat + persistThreadsKey 支持刷新/切菜单恢复。
 */
import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { Button, Input, message } from 'antd';
import MarkdownIt from 'markdown-it';
import { sanitizeRichText } from '../../../lib/richText';
import {
  commitStudentIdeationIdea,
  fetchIdeationMethodChat,
  midwiferyGenerate,
  midwiferyTurn,
  previewStudentIdeationIdea,
  type IdeationChatMethodKey,
  type IdeationIdeaPreview,
  type IdeationMethodChatTranscript,
  type MidwiferyTurnResult,
  type StudentIdeationAnalysis,
  type StudentIdeationIdea,
  type IdeationMethodKey,
} from '../../../lib/studentIdeationApi';
import type { HatStudioComposerBind } from './IdeationHatStudio';

/** 可注入演示端 API，默认走学生真实接口 */
export type IdeationMethodChatApi = {
  midwiferyTurn: (
    classId: string,
    body: {
      messages: { role: 'user' | 'assistant'; content: string }[];
      roundIndex: number;
      threadId?: string;
      clientTranscript?: IdeationMethodChatTranscript;
    }
  ) => Promise<MidwiferyTurnResult>;
  midwiferyGenerate: (
    classId: string,
    body: {
      messages: { role: 'user' | 'assistant'; content: string }[];
      threadId?: string;
      clientTranscript?: IdeationMethodChatTranscript;
    }
  ) => Promise<IdeationIdeaPreview>;
  previewIdea: (
    classId: string,
    body: {
      methodKey: IdeationMethodKey;
      formPayload: Record<string, unknown>;
      threadId?: string;
      clientTranscript?: IdeationMethodChatTranscript;
    }
  ) => Promise<IdeationIdeaPreview>;
  commitIdea: (
    classId: string,
    body: {
      methodKey: IdeationMethodKey;
      title: string;
      description: string;
      formPayload: Record<string, unknown>;
      aiAnalysis: StudentIdeationAnalysis;
    }
  ) => Promise<StudentIdeationIdea>;
  /** 可选：演示端可 stub；默认走 fetchIdeationMethodChat */
  fetchMethodChat?: typeof fetchIdeationMethodChat;
};

function newThreadId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const defaultApi: IdeationMethodChatApi = {
  midwiferyTurn,
  midwiferyGenerate,
  previewIdea: previewStudentIdeationIdea,
  commitIdea: commitStudentIdeationIdea,
};

const md = new MarkdownIt({ html: false, linkify: true, breaks: true });
const MD_CLS =
  'break-words text-sm leading-relaxed text-gray-800 [&_p]:my-1.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_strong]:font-bold [&_strong]:text-gray-900';

function ChatMarkdown({ text }: { text: string }) {
  return (
    <div
      className={`${MD_CLS} select-text cursor-text`}
      style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
      dangerouslySetInnerHTML={{ __html: sanitizeRichText(md.render(String(text || ''))) }}
    />
  );
}

/** 与 AI 侧边栏一致的「思考中」气泡（三点 bounce） */
function ThinkingBubble({ label = '思考中…' }: { label?: string }) {
  return (
    <div className="flex justify-start select-none">
      <div className="rounded-2xl rounded-tl-md bg-white border border-gray-100 shadow-sm px-3.5 py-2.5">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: '120ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: '240ms' }} />
        </div>
        <div className="text-[11px] text-gray-400">{label}</div>
      </div>
    </div>
  );
}

export const IDEATION_CHAT_METHODS: {
  key: IdeationChatMethodKey;
  label: string;
  icon: string;
  activeClass: string;
}[] = [
  { key: 'midwifery', label: '启思智能体', icon: 'ri-questionnaire-line', activeClass: 'bg-indigo-500 text-white' },
  { key: 'brainstorm', label: '头脑风暴', icon: 'ri-lightbulb-flash-line', activeClass: 'bg-teal-500 text-white' },
  { key: 'ai', label: 'AI 创意', icon: 'ri-sparkling-line', activeClass: 'bg-rose-500 text-white' },
  { key: 'six_hats', label: '六帽创想室', icon: 'ri-user-voice-line', activeClass: 'bg-violet-500 text-white' },
];

type ChatRole = 'user' | 'assistant';

type IdeaCardMsg = {
  kind: 'idea';
  id: string;
  preview: IdeationIdeaPreview;
  joined?: boolean;
};

type TextMsg = {
  kind: 'text';
  id: string;
  role: ChatRole;
  content: string;
  /** 助产：该条助手消息下是否展示「生成创意」 */
  showGenerate?: boolean;
};

type ChatMsg = TextMsg | IdeaCardMsg;

type ThreadState = {
  messages: ChatMsg[];
  roundIndex: number;
  canGenerate: boolean;
  bootstrapped: boolean;
};

/** 模块级缓存：父级 tab 卸载后仍可恢复对话（演示端尤其需要） */
const THREAD_CACHE = new Map<string, Partial<Record<IdeationChatMethodKey, ThreadState>>>();

/** 启思开场欢迎：固定文案，不调 AI */
const MIDWIFERY_WELCOME =
  '你好！我是启思智能体。很高兴能陪你一起打磨创业想法。\n\n在开始深入探讨之前，我想先听听你目前的构想。请用自己的话简单描述一下：你想解决什么具体问题？或者你的创业想法雏形是什么？';

const OPENERS: Record<'brainstorm' | 'ai' | 'midwifery', string> = {
  midwifery: MIDWIFERY_WELCOME,
  brainstorm: `欢迎使用头脑风暴。请按下面问题依次回答（可分条写）：

1. 你的**创意标题**是什么？
2. **创意描述**：想解决什么问题？大致怎么做？
3. （可选）还有哪些大胆联想或变体？

答完后我会帮你生成结构化创意，并可加入团队创意库。`,
  ai: `欢迎使用 AI 创意。请按下面问题回答：

1. **目标领域**（如智慧教育、健康科技）
2. **目标用户**是谁？
3. 他们的**核心需求**是什么？

发送后我将生成创意方案；不满意可以继续补充再生成。`,
};

function emptyThread(): ThreadState {
  return { messages: [], roundIndex: 0, canGenerate: false, bootstrapped: false };
}

function toClientTranscript(state: ThreadState): IdeationMethodChatTranscript {
  return {
    messages: state.messages,
    roundIndex: state.roundIndex,
    canGenerate: state.canGenerate,
    bootstrapped: state.bootstrapped,
  };
}

/** 服务端 transcript → 本地 ThreadState */
function hydrateThreadFromStored(raw: unknown): ThreadState | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const messagesRaw = Array.isArray(o.messages) ? o.messages : [];
  if (!messagesRaw.length) return null;
  const messages: ChatMsg[] = [];
  for (const item of messagesRaw) {
    if (!item || typeof item !== 'object') continue;
    const m = item as Record<string, unknown>;
    if (m.kind === 'idea') {
      messages.push({
        kind: 'idea',
        id: String(m.id || `idea-${messages.length}`),
        preview: (m.preview && typeof m.preview === 'object' ? m.preview : {}) as IdeationIdeaPreview,
        joined: Boolean(m.joined),
      });
      continue;
    }
    messages.push({
      kind: 'text',
      id: String(m.id || `t-${messages.length}`),
      role: m.role === 'user' ? 'user' : 'assistant',
      content: String(m.content || ''),
      showGenerate: Boolean(m.showGenerate),
    });
  }
  if (!messages.length) return null;
  return {
    messages,
    roundIndex: Math.max(0, Number(o.roundIndex) || 0),
    canGenerate: Boolean(o.canGenerate),
    bootstrapped: true,
  };
}

function toApiMessages(msgs: ChatMsg[]): { role: ChatRole; content: string }[] {
  return msgs
    .filter((m): m is TextMsg => m.kind === 'text')
    .map((m) => ({ role: m.role, content: m.content }));
}

/** 未解锁生成时，去掉模型误写的「可生成创意」话术 */
function sanitizeMidwiferyText(text: string, canGenerate: boolean) {
  const raw = String(text || '').trim();
  if (canGenerate || !raw) return raw;
  return raw
    .replace(/^[>\s]*已完成三轮[^\n]*$/gm, '')
    .replace(/^[>\s]*可点击生成创意[^\n]*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** 正文已引导生成时前端兜底解锁（防接口 canGenerate 漏标） */
function textSuggestsCanGenerate(text: string) {
  return /点击\s*生成创意|生成创意报告|可以点击生成|已完成三轮|三轮核心追问/.test(String(text || ''));
}

function buildChatFormPayload(methodKey: 'brainstorm' | 'ai', msgs: ChatMsg[]) {
  const transcript = toApiMessages(msgs)
    .map((m) => `${m.role === 'user' ? '学生' : '助手'}: ${m.content}`)
    .join('\n');
  const userBits = toApiMessages(msgs)
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .join('\n');
  // 不预设占位 title，让模型生成可入库的丰富标题与选题字段
  if (methodKey === 'brainstorm') {
    return {
      description: userBits || transcript,
      chatTranscript: transcript,
      askRichTopicFields: true,
    };
  }
  return {
    domain: userBits.includes('领域') ? userBits : '见对话记录',
    targetUser: '见对话记录',
    need: userBits || transcript,
    chatTranscript: transcript,
    askRichTopicFields: true,
  };
}

function topicField(preview: IdeationIdeaPreview, key: string) {
  const fromTopic = preview.topicFields?.[key as keyof NonNullable<IdeationIdeaPreview['topicFields']>];
  if (typeof fromTopic === 'string' && fromTopic.trim()) return fromTopic.trim();
  const fromFp = preview.formPayload?.[key];
  return typeof fromFp === 'string' ? fromFp.trim() : '';
}

function IdeaPreviewCard({
  msg,
  disabled,
  joining,
  onJoin,
}: {
  msg: IdeaCardMsg;
  disabled?: boolean;
  joining?: boolean;
  onJoin: () => void;
}) {
  const a = msg.preview.aiAnalysis;
  const fields: { label: string; value: string }[] = [
    { label: '项目方向', value: topicField(msg.preview, 'projectDirection') },
    { label: '核心价值', value: topicField(msg.preview, 'coreValue') },
    { label: '目标用户', value: topicField(msg.preview, 'targetUsers') },
    { label: '核心问题', value: topicField(msg.preview, 'coreProblem') },
    { label: '解决方案', value: topicField(msg.preview, 'solutionOverview') },
    { label: '市场规模', value: topicField(msg.preview, 'marketSize') },
    { label: '竞争优势', value: topicField(msg.preview, 'competitiveAdvantage') },
  ].filter((f) => f.value);

  return (
    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-indigo-600 mb-1">生成创意</div>
          <h4 className="text-sm font-bold text-gray-900">{msg.preview.title}</h4>
        </div>
        {typeof a?.overallScore === 'number' && (
          <span className="text-xs font-bold text-indigo-700 bg-white px-2 py-1 rounded-lg border border-indigo-100 shrink-0">
            {a.overallScore} 分
          </span>
        )}
      </div>
      <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{msg.preview.description}</p>
      {fields.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {fields.map((f) => (
            <div key={f.label} className="rounded-lg bg-white/80 border border-indigo-50 px-2.5 py-2">
              <div className="text-[10px] font-semibold text-indigo-500 mb-0.5">{f.label}</div>
              <div className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{f.value}</div>
            </div>
          ))}
        </div>
      )}
      {a && (
        <div className="flex flex-wrap gap-2 text-[11px] text-gray-600">
          <span className="px-2 py-0.5 rounded-md bg-white border border-gray-100">新颖 {a.novelty}</span>
          <span className="px-2 py-0.5 rounded-md bg-white border border-gray-100">可行 {a.feasibility}</span>
          <span className="px-2 py-0.5 rounded-md bg-white border border-gray-100">市场 {a.marketPotential}</span>
          <span className="px-2 py-0.5 rounded-md bg-white border border-gray-100">创新 {a.innovation}</span>
        </div>
      )}
      {a?.summary && <p className="text-xs text-gray-600 leading-relaxed">{a.summary}</p>}
      {!!a?.strengths?.length && (
        <div className="text-xs text-gray-600">
          <span className="font-semibold text-gray-800">优势：</span>
          {a.strengths.join('；')}
        </div>
      )}
      {!!a?.suggestions?.length && (
        <div className="text-xs text-gray-600">
          <span className="font-semibold text-gray-800">建议：</span>
          {a.suggestions.join('；')}
        </div>
      )}
      {!!a?.tags?.length && (
        <div className="flex flex-wrap gap-1.5">
          {a.tags.map((tag) => (
            <span key={tag} className="px-2 py-0.5 rounded-full bg-white text-[11px] text-indigo-600 border border-indigo-100">
              {tag}
            </span>
          ))}
        </div>
      )}
      <Button
        type="primary"
        size="small"
        disabled={msg.joined || disabled}
        loading={joining}
        className="!bg-indigo-500 !border-indigo-500"
        onClick={onJoin}
      >
        {msg.joined ? '已加入团队创意库' : '加入团队创意库'}
      </Button>
    </div>
  );
}

type Props = {
  classId: string;
  disabled?: boolean;
  method: IdeationChatMethodKey;
  onMethodChange: (key: IdeationChatMethodKey) => void;
  onIdeaCreated?: (idea: StudentIdeationIdea) => void;
  api?: IdeationMethodChatApi;
  /** 六帽创想室（学生/演示各自注入），用 hidden 保活避免切换丢失 */
  hatStudioSlot?: ReactNode;
  /**
   * 传入后将各方法线程写入模块缓存；组件因切 tab 卸载再挂载时按此 key 恢复。
   * 演示端务必传入（如 `class-demo:${classId}`）。
   */
  persistThreadsKey?: string;
};

export default function IdeationMethodChat({
  classId,
  disabled = false,
  method,
  onMethodChange,
  onIdeaCreated,
  api = defaultApi,
  hatStudioSlot,
  persistThreadsKey,
}: Props) {
  const cacheKey = persistThreadsKey?.trim() || '';
  const [threads, setThreads] = useState<Partial<Record<IdeationChatMethodKey, ThreadState>>>(() =>
    cacheKey ? THREAD_CACHE.get(cacheKey) || {} : {}
  );
  const [input, setInput] = useState('');
  /** 按方法隔离 loading：等待接口时仅锁定当前方法输入，仍可切换其他方法 */
  const [busyMap, setBusyMap] = useState<Partial<Record<IdeationChatMethodKey, boolean>>>({});
  /** 会话线程 ID：随对话落库，供驾驶舱取证 */
  const threadIdsRef = useRef<Partial<Record<IdeationChatMethodKey, string>>>({});
  const ensureThreadId = (key: IdeationChatMethodKey) => {
    if (!threadIdsRef.current[key]) threadIdsRef.current[key] = newThreadId(key);
    return threadIdsRef.current[key] as string;
  };
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [hatComposer, setHatComposer] = useState<HatStudioComposerBind | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const threadsRef = useRef(threads);
  threadsRef.current = threads;
  const hatComposerRef = useRef<HatStudioComposerBind | null>(null);
  hatComposerRef.current = hatComposer;

  const hydratedRef = useRef(false);
  const [serverHydrated, setServerHydrated] = useState(false);

  // 切换班级或首次挂载：从模块缓存灌回
  useEffect(() => {
    if (!cacheKey) return;
    setThreads(THREAD_CACHE.get(cacheKey) || {});
  }, [cacheKey]);

  // 从服务端拉持久化线程（刷新/重登）；模块缓存优先覆盖空态
  useEffect(() => {
    if (!classId?.trim() || disabled) {
      setServerHydrated(true);
      return;
    }
    let cancelled = false;
    hydratedRef.current = false;
    setServerHydrated(false);
    const loader = api.fetchMethodChat || fetchIdeationMethodChat;
    void loader(classId.trim())
      .then((res) => {
        if (cancelled) return;
        const next: Partial<Record<IdeationChatMethodKey, ThreadState>> = {
          ...(cacheKey ? THREAD_CACHE.get(cacheKey) || {} : {}),
        };
        (['midwifery', 'brainstorm', 'ai'] as const).forEach((key) => {
          const stored = res.threads?.[key];
          const hydrated = hydrateThreadFromStored(stored?.transcript);
          if (hydrated) {
            next[key] = hydrated;
            if (stored?.threadId) threadIdsRef.current[key] = stored.threadId;
          }
        });
        setThreads(next);
        if (cacheKey) THREAD_CACHE.set(cacheKey, next);
        hydratedRef.current = true;
      })
      .catch(() => {
        /* 无团队或网络失败时仍走本地开场 */
      })
      .finally(() => {
        if (!cancelled) setServerHydrated(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, disabled]);

  // 对话变更时写回缓存，供卸载后恢复
  useEffect(() => {
    if (!cacheKey) return;
    THREAD_CACHE.set(cacheKey, threads);
  }, [cacheKey, threads]);

  const setMethodBusy = (key: IdeationChatMethodKey, on: boolean) => {
    setBusyMap((prev) => ({ ...prev, [key]: on }));
  };

  // 回调必须稳定：否则 HatStudio effect 会 cleanup→set(null)→再 bind，造成无限更新
  const bindHatComposer = useCallback((composer: HatStudioComposerBind | null) => {
    setHatComposer(composer);
  }, []);

  /** 切换帽子时：若输入框已 @ 某帽则替换为新帽子，否则不动（中文帽名后勿用 \b） */
  const syncHatMentionInInput = useCallback((hatLabel: string) => {
    setInput((prev) => {
      const mentionRe = /@\s*(白帽|红帽|黑帽|黄帽|绿帽|蓝帽|white|red|black|yellow|green|blue)/gi;
      if (!/@\s*(白帽|红帽|黑帽|黄帽|绿帽|蓝帽|white|red|black|yellow|green|blue)/i.test(prev)) {
        return prev;
      }
      const base = prev.replace(mentionRe, '').replace(/\s+/g, ' ').trim();
      return base ? `${hatLabel} ${base}` : hatLabel;
    });
  }, []);

  const thread = threads[method] || emptyThread();
  const busy = Boolean(busyMap[method]) || (method === 'six_hats' && Boolean(hatComposer?.busy));
  // 任一方法思考中（含六帽）时锁定底部方法切换，避免对话中途乱切
  const methodSwitchLocked =
    Object.values(busyMap).some(Boolean) || Boolean(hatComposer?.busy);

  const patchThread = (key: IdeationChatMethodKey, updater: (prev: ThreadState) => ThreadState) => {
    setThreads((prev) => {
      const cur = prev[key] || emptyThread();
      return { ...prev, [key]: updater(cur) };
    });
  };

  // 切换方法 / 新消息 / 思考中出现时滚到底
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [thread.messages, method, busy]);

  // 已有会话：正文已写「可生成」但 canGenerate 未解锁时补按钮（兼容旧轮次漏标）
  useEffect(() => {
    if (method !== 'midwifery') return;
    const cur = threadsRef.current.midwifery;
    if (!cur?.bootstrapped || cur.canGenerate) return;
    const lastAssist = [...cur.messages]
      .reverse()
      .find((m): m is TextMsg => m.kind === 'text' && m.role === 'assistant');
    if (!lastAssist || !textSuggestsCanGenerate(lastAssist.content)) return;
    patchThread('midwifery', (prev) => {
      if (prev.canGenerate) return prev;
      return {
        ...prev,
        canGenerate: true,
        messages: prev.messages.map((m) =>
          m.kind === 'text' && m.role === 'assistant'
            ? { ...m, showGenerate: m.id === lastAssist.id }
            : m
        ),
      };
    });
  }, [method, thread.messages, thread.canGenerate]);

  // 开场：服务端恢复完成且本地无线程时，才写入固定引导语
  useEffect(() => {
    if (!serverHydrated || disabled || method === 'six_hats') return;
    if (threadsRef.current[method]?.bootstrapped) return;
    if (method !== 'midwifery' && method !== 'brainstorm' && method !== 'ai') return;

    ensureThreadId(method);
    patchThread(method, () => ({
      messages: [
        {
          kind: 'text',
          id: `opener-${method}`,
          role: 'assistant',
          content: OPENERS[method],
        },
      ],
      roundIndex: 0,
      canGenerate: false,
      bootstrapped: true,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, method, disabled, serverHydrated]);

  const handleSwitch = (key: IdeationChatMethodKey) => {
    if (key === method) return;
    // 思考中禁止切换方法，避免中断当前对话上下文
    if (methodSwitchLocked) {
      message.info('思考中，请稍候再切换方法');
      return;
    }
    setInput('');
    onMethodChange(key);
  };

  const appendIdeaCard = (key: IdeationChatMethodKey, preview: IdeationIdeaPreview) => {
    const id = `idea-${Date.now()}`;
    patchThread(key, (prev) => ({
      ...prev,
      messages: [...prev.messages, { kind: 'idea', id, preview }],
    }));
  };

  const handleGenerateMidwifery = async () => {
    if (busyMap.midwifery || disabled) return;
    setMethodBusy('midwifery', true);
    try {
      const cur = threadsRef.current.midwifery || emptyThread();
      const apiMsgs = toApiMessages(cur.messages);
      const preview = await api.midwiferyGenerate(classId, {
        messages: apiMsgs,
        threadId: ensureThreadId('midwifery'),
        clientTranscript: toClientTranscript(cur),
      });
      appendIdeaCard('midwifery', preview);
      message.success('创意已生成，可加入团队创意库');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '生成创意失败');
    } finally {
      setMethodBusy('midwifery', false);
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || busy || disabled) return;
    const sendMethod = method;

    // 六帽：走创想室绑定的发送逻辑，共用底部输入条
    if (sendMethod === 'six_hats') {
      const composer = hatComposerRef.current;
      if (!composer?.canSend) {
        message.warning(composer?.placeholder || '讨论准备中，请稍候再发送');
        return;
      }
      setMethodBusy('six_hats', true);
      setInput('');
      try {
        await composer.send(text);
      } catch (e) {
        setInput(text);
        message.error(e instanceof Error ? e.message : '发送失败');
      } finally {
        setMethodBusy('six_hats', false);
      }
      return;
    }

    const userMsg: TextMsg = {
      kind: 'text',
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
    };
    setInput('');

    if (sendMethod === 'midwifery') {
      const cur = threadsRef.current.midwifery || emptyThread();
      const nextMsgs = [...cur.messages, userMsg];
      const pendingTx: ThreadState = {
        ...cur,
        messages: nextMsgs,
        bootstrapped: true,
      };
      patchThread('midwifery', () => pendingTx);
      setMethodBusy('midwifery', true);
      try {
        const res = await api.midwiferyTurn(classId, {
          messages: toApiMessages(nextMsgs),
          roundIndex: cur.roundIndex,
          threadId: ensureThreadId('midwifery'),
          clientTranscript: toClientTranscript(pendingTx),
        });
        // 一旦解锁「生成创意」则保持；正文引导生成时也兜底解锁
        const canGen =
          Boolean(res.canGenerate) ||
          Boolean(cur.canGenerate) ||
          textSuggestsCanGenerate(res.assistantText) ||
          textSuggestsCanGenerate(res.doneHint || '');
        const bodyText = sanitizeMidwiferyText(res.assistantText, canGen);
        const withHint =
          canGen && res.doneHint?.trim() ? `${bodyText}\n\n> ${res.doneHint.trim()}` : bodyText;
        patchThread('midwifery', (prev) => {
          const unlocked = canGen || prev.canGenerate;
          // 解锁后给最近一条助手气泡补上按钮（含本轮新建的）
          const msgs = prev.messages.map((m) =>
            m.kind === 'text' && m.role === 'assistant' ? { ...m, showGenerate: false } : m
          );
          return {
            ...prev,
            roundIndex: res.roundIndex,
            canGenerate: unlocked,
            messages: [
              ...msgs,
              {
                kind: 'text' as const,
                id: `a-${Date.now()}`,
                role: 'assistant' as const,
                content: withHint,
                showGenerate: unlocked,
              },
            ],
          };
        });
      } catch (e) {
        message.error(e instanceof Error ? e.message : '发送失败');
      } finally {
        setMethodBusy('midwifery', false);
      }
      return;
    }

    // 头脑风暴 / AI：先入用户消息，再直接生成创意卡，并给续聊提示
    const methodKey = sendMethod as 'brainstorm' | 'ai';
    const cur = threadsRef.current[methodKey] || emptyThread();
    const nextMsgs = [...cur.messages, userMsg];
    const pendingTx: ThreadState = {
      ...cur,
      messages: nextMsgs,
      bootstrapped: true,
    };
    patchThread(methodKey, () => pendingTx);
    setMethodBusy(methodKey, true);
    try {
      const preview = await api.previewIdea(classId, {
        methodKey,
        formPayload: buildChatFormPayload(methodKey, nextMsgs),
        threadId: ensureThreadId(methodKey),
        clientTranscript: toClientTranscript(pendingTx),
      });
      patchThread(methodKey, (prev) => ({
        ...prev,
        messages: [
          ...prev.messages,
          {
            kind: 'idea',
            id: `idea-${Date.now()}`,
            preview,
          },
          {
            kind: 'text',
            id: `tip-${Date.now()}`,
            role: 'assistant',
            content: '若不满意，可继续补充说明后再次发送，我会根据完整对话重新生成创意卡片。',
          },
        ],
      }));
    } catch (e) {
      message.error(e instanceof Error ? e.message : '生成创意失败');
    } finally {
      setMethodBusy(methodKey, false);
    }
  };

  const handleJoin = async (card: IdeaCardMsg) => {
    if (joiningId || disabled) return;
    setJoiningId(card.id);
    try {
      const idea = await api.commitIdea(classId, {
        methodKey: card.preview.methodKey,
        title: card.preview.title,
        description: card.preview.description,
        formPayload: card.preview.formPayload,
        aiAnalysis: card.preview.aiAnalysis,
      });
      patchThread(method, (prev) => ({
        ...prev,
        messages: prev.messages.map((m) =>
          m.kind === 'idea' && m.id === card.id ? { ...m, joined: true } : m
        ),
      }));
      onIdeaCreated?.(idea);
      message.success('已加入团队创意库');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加入创意库失败');
    } finally {
      setJoiningId(null);
    }
  };

  const isSixHats = method === 'six_hats';

  /** 输入条：六帽时塞进左侧讨论区底部，其它方法用卡片底栏 */
  const composerBar = (
    <div className={isSixHats ? 'px-2.5 pt-2 pb-2' : ''}>
      {method === 'midwifery' && thread.canGenerate && !busy ? (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-indigo-100 bg-indigo-50/70 px-3 py-2">
          <span className="text-[11px] text-indigo-700">三轮追问已就绪，可生成结构化创意报告</span>
          <Button
            size="small"
            type="primary"
            disabled={disabled}
            className="!bg-indigo-500 !border-indigo-500 shrink-0"
            onClick={() => void handleGenerateMidwifery()}
          >
            生成创意
          </Button>
        </div>
      ) : null}
      <div className="rounded-2xl border border-teal-200 bg-white shadow-sm px-3 pt-2 pb-2 focus-within:border-teal-400 focus-within:ring-2 focus-within:ring-teal-100 transition-shadow">
        <Input.TextArea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            disabled
              ? '请先完成组队确认'
              : isSixHats
                ? hatComposer?.placeholder || '正在开启六帽讨论…'
                : '输入你的回答…'
          }
          disabled={disabled || busy || (isSixHats && Boolean(hatComposer?.busy))}
          autoSize={{ minRows: 1, maxRows: isSixHats ? 3 : 4 }}
          variant="borderless"
          className="!p-0 !resize-none"
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
        />
        <div className="flex items-end gap-2 mt-1.5">
          <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
            {IDEATION_CHAT_METHODS.map((tab) => {
              const tabActive = method === tab.key;
              const switchDisabled = methodSwitchLocked && !tabActive;
              return (
                <button
                  key={tab.key}
                  type="button"
                  disabled={switchDisabled}
                  onClick={() => handleSwitch(tab.key)}
                  className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg transition-all flex items-center gap-1 ${
                    tabActive
                      ? tab.activeClass
                      : switchDisabled
                        ? 'bg-gray-100 text-gray-400 opacity-60 cursor-not-allowed'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 cursor-pointer'
                  }`}
                >
                  <i className={tab.icon} />
                  {tab.label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            disabled={
              disabled ||
              busy ||
              !input.trim() ||
              (isSixHats && (!hatComposer?.canSend || hatComposer.busy))
            }
            onClick={() => void handleSend()}
            className="w-9 h-9 rounded-full bg-teal-500 text-white flex items-center justify-center hover:bg-teal-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
            aria-label="发送"
          >
            {busy || (isSixHats && hatComposer?.busy) ? (
              <i className="ri-loader-4-line text-lg animate-spin" />
            ) : (
              <i className="ri-arrow-up-line text-lg" />
            )}
          </button>
        </div>
      </div>
    </div>
  );

  const hatSlot =
    hatStudioSlot && isValidElement(hatStudioSlot)
      ? cloneElement(
          hatStudioSlot as ReactElement<{
            onBindComposer?: (c: HatStudioComposerBind | null) => void;
            onRequestAppendInput?: (piece: string) => void;
            active?: boolean;
            composerFooter?: ReactNode;
          }>,
          {
            onBindComposer: bindHatComposer,
            onRequestAppendInput: syncHatMentionInInput,
            active: isSixHats,
            composerFooter: isSixHats ? composerBar : null,
          }
        )
      : hatStudioSlot;

  return (
    <div className="ideation-method-chat w-full bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col min-h-0 h-[calc(100dvh-9rem)] min-h-[360px] select-text ">
      {/* 六帽：整卡高度给双栏，输入收进左侧；其它方法：消息区 + 底栏 */}
      {hatSlot ? (
        <div className={`flex-1 min-h-0 overflow-hidden px-3 py-2 ${isSixHats ? 'flex flex-col' : 'hidden'}`}>
          {hatSlot}
        </div>
      ) : null}

      {!isSixHats && (
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto px-5 py-3 space-y-3 min-h-0 overscroll-contain select-text cursor-text"
          style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
        >
          {thread.messages.map((msg) => {
            if (msg.kind === 'idea') {
              return (
                <IdeaPreviewCard
                  key={msg.id}
                  msg={msg}
                  disabled={disabled}
                  joining={joiningId === msg.id}
                  onJoin={() => void handleJoin(msg)}
                />
              );
            }
            const mine = msg.role === 'user';
            return (
              <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 select-text cursor-text ${
                    mine ? 'bg-teal-500 text-white' : 'bg-gray-50 text-gray-800 border border-gray-100'
                  }`}
                  style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
                >
                  {mine ? (
                    <p className="text-sm whitespace-pre-wrap leading-relaxed select-text">{msg.content}</p>
                  ) : (
                    <ChatMarkdown text={msg.content} />
                  )}
                  {!mine && msg.showGenerate && (
                    <div className="mt-3 pt-2 border-t border-gray-200/80">
                      <Button
                        size="small"
                        type="primary"
                        disabled={busy || disabled}
                        className="!bg-indigo-500 !border-indigo-500"
                        onClick={() => void handleGenerateMidwifery()}
                      >
                        生成创意
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {busy ? (
            <ThinkingBubble label={thread.messages.length === 0 ? '正在准备引导…' : '思考中…'} />
          ) : null}
        </div>
      )}

      {!isSixHats ? (
        <div className="px-4 pb-3 pt-2 border-t border-gray-100 shrink-0 bg-white rounded-b-2xl">
          {composerBar}
        </div>
      ) : null}
    </div>
  );
}
