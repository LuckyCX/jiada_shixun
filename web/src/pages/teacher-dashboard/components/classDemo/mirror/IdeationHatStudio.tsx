import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button, Dropdown, Input, Popover, message } from 'antd';
import {
  adoptHatStudioMessage,
  analyzeStudentIdeationIdea,
  fetchHatStudio,
  hatStudioDebateReply,
  hatStudioDebateStart,
  hatStudioReset,
  hatStudioSwitchHat,
  saveHatStudioDraftCell,
  type HatSessionState,
  type HatStudioDebateMessage,
  type HatStudioDraft,
  type HatStudioHat,
  type HatStudioPayload,
} from '../demoIdeationApi';
import { DemoMarkdown } from '../demoMarkdown';
import imgBai from '../../../../../assets/images/bai.jpg';
import imgHong from '../../../../../assets/images/hong.jpg';
import imgHei from '../../../../../assets/images/hei.jpg';
import imgHuang from '../../../../../assets/images/huang.jpg';
import imgLv from '../../../../../assets/images/lv.jpg';
import imgLan from '../../../../../assets/images/lan.jpg';

type HatKey = Exclude<HatStudioHat, 'user'>;

/** 顺序：白→绿→黄→黑→红→蓝 */
const HAT_HEADER_ORDER: HatKey[] = ['white', 'green', 'yellow', 'black', 'red', 'blue'];

const hatConfig: Record<
  HatKey | 'user',
  {
    hatLabel: string;
    role: string;
    /** 气泡叹号弹出的职能详解 */
    detail: string;
    color: string;
    textColor: string;
    borderColor: string;
    avatar: string;
  }
> = {
  white: {
    hatLabel: '白帽',
    role: '客观事实｜补信息',
    detail:
      '白帽（客观事实思维｜补信息）：聚焦事实、数据、已知信息，不做主观评判。引导学生区分「主观猜想」和「客观可验证信息」，找出缺少的资料、数据、前提条件。提问句式：你有哪些可验证的数据？这个说法依据是什么？还缺少哪些信息？',
    color: 'bg-gray-100',
    textColor: 'text-gray-900',
    borderColor: 'border-gray-300',
    avatar: imgBai,
  },
  green: {
    hatLabel: '绿帽',
    role: '发散创新｜找创新',
    detail:
      '绿帽（发散创新思维｜找创新）：鼓励发散、跳出固有方案，挖掘创意可能性、替代方案、差异化亮点，不否定原有想法。提问句式：还有别的实现方式吗？可以增加什么新亮点？有没有不一样的解决思路？',
    color: 'bg-emerald-100',
    textColor: 'text-emerald-900',
    borderColor: 'border-emerald-300',
    avatar: imgLv,
  },
  yellow: {
    hatLabel: '黄帽',
    role: '正向价值｜判价值',
    detail:
      '黄帽（正向价值思维｜判价值）：挖掘项目的价值、优势、收益，思考为什么可行、用户能获得什么价值。提问句式：这个方案最大的价值是什么？用户为什么愿意选择你？长期能带来什么收益？',
    color: 'bg-amber-100',
    textColor: 'text-amber-900',
    borderColor: 'border-amber-300',
    avatar: imgHuang,
  },
  black: {
    hatLabel: '黑帽',
    role: '风险批判｜查风险',
    detail:
      '黑帽（风险批判思维｜查风险）：理性审视隐患、短板、潜在风险，识别方案漏洞与落地障碍，审慎评估而非抬杠。提问句式：这个方案最大隐患是什么？哪一步最容易出问题？有哪些不可控因素？',
    color: 'bg-gray-900',
    textColor: 'text-white',
    borderColor: 'border-gray-700',
    avatar: imgHei,
  },
  red: {
    hatLabel: '红帽',
    role: '用户共情｜贴需求',
    detail:
      '红帽（用户共情思维｜贴需求）：关注感受、情绪、直觉，站在用户视角体会好恶与真实感受。提问句式：用户看到这个方案第一感受是什么？用户会担心什么？什么场景下用户会抵触？',
    color: 'bg-red-100',
    textColor: 'text-red-900',
    borderColor: 'border-red-300',
    avatar: imgHong,
  },
  blue: {
    hatLabel: '蓝帽',
    role: '全局系统｜做统筹',
    detail:
      '蓝帽（全局系统思维｜做统筹）：把控整体框架，整合前面各帽结论，规划后续行动，收敛思路。提问句式：综合前面分析，当前最大问题是什么？下一步优先做什么？整体框架如何调整？',
    color: 'bg-sky-100',
    textColor: 'text-sky-900',
    borderColor: 'border-sky-300',
    avatar: imgLan,
  },
  user: {
    hatLabel: '我',
    role: '学生',
    detail: '学生本人发言。',
    color: 'bg-teal-50',
    textColor: 'text-teal-900',
    borderColor: 'border-teal-200',
    avatar: '',
  },
};

function delayMs(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function messageDelay(content: string) {
  return Math.min(1800, Math.max(500, String(content || '').length * 18));
}

function emptyDraft(defs: { key: string }[]): HatStudioDraft {
  const o: HatStudioDraft = {};
  for (const d of defs) o[d.key] = { content: '', updatedBy: '' };
  return o;
}

function collectAdoptTargets(msg: HatStudioDebateMessage) {
  const list: { targetModule: string; moduleContent: string }[] = [];
  if (Array.isArray(msg.fills)) {
    for (const f of msg.fills) {
      if (f.targetModule && f.moduleContent?.trim()) {
        list.push({ targetModule: f.targetModule, moduleContent: f.moduleContent });
      }
    }
  }
  if (
    msg.targetModule &&
    msg.moduleContent?.trim() &&
    msg.status !== 'adopted' &&
    !list.some((x) => x.targetModule === msg.targetModule)
  ) {
    list.push({ targetModule: msg.targetModule, moduleContent: msg.moduleContent });
  }
  return list;
}

/** 输入框已有 @某帽 时替换为切换后的帽子；无 @ 则不动（中文帽名后勿用 \b） */
function syncHatMentionInText(text: string, hatLabel: string) {
  const mentionRe = /@\s*(白帽|红帽|黑帽|黄帽|绿帽|蓝帽|white|red|black|yellow|green|blue)/gi;
  if (!/@\s*(白帽|红帽|黑帽|黄帽|绿帽|蓝帽|white|red|black|yellow|green|blue)/i.test(text)) return text;
  const base = text.replace(mentionRe, '').replace(/\s+/g, ' ').trim();
  return base ? `${hatLabel} ${base}` : hatLabel;
}

/** 供外层统一输入条绑定（嵌入创新方法对话时） */
export type HatStudioComposerBind = {
  send: (text: string) => Promise<void>;
  canSend: boolean;
  busy: boolean;
  placeholder: string;
};

type Props = {
  classId: string;
  studentDisplayName?: string;
  disabled?: boolean;
  onIdeaCreated?: () => void;
  /** 嵌入创新方法对话卡片内，去掉外层说明条与过大高度 */
  embedded?: boolean;
  /**
   * 是否处于当前可见/选中（嵌入时由外层传入 method===six_hats）。
   * 为 true 且尚无会话时自动开始讨论。
   */
  active?: boolean;
  /** 嵌入时隐藏内部发言框，改由外层统一输入条发送 */
  onBindComposer?: (composer: HatStudioComposerBind | null) => void;
  /** 切换帽子时同步外层输入框：若已 @ 其他帽子则替换为当前帽子 */
  onRequestAppendInput?: (hatLabel: string) => void;
  /** 嵌入时渲染在左侧讨论区底部（输入条靠左，工作区可拉满整卡高度） */
  composerFooter?: ReactNode;
};

/**
 * 六帽创想室：多轮六帽讨论 + 工作区采纳，最终入库团队创意库
 */
export default function IdeationHatStudio({
  classId,
  studentDisplayName = '同学',
  disabled = false,
  onIdeaCreated,
  embedded = false,
  active = true,
  onBindComposer,
  onRequestAppendInput,
  composerFooter,
}: Props) {
  const [messages, setMessages] = useState<HatStudioDebateMessage[]>([]);
  const [draft, setDraft] = useState<HatStudioDraft>({});
  const [draftDefs, setDraftDefs] = useState<{ key: string; label: string }[]>([]);
  const [filledCount, setFilledCount] = useState(0);
  const [currentSpeaker, setCurrentSpeaker] = useState<HatStudioHat | null>(null);
  const [highlightKey, setHighlightKey] = useState<string | null>(null);
  const [userInput, setUserInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isDebating, setIsDebating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [submittingIdea, setSubmittingIdea] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [hatSession, setHatSession] = useState<HatSessionState | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  /** 防止 Strict Mode / 重复 effect 并发自动开场 */
  const autoStartLockRef = useRef(false);

  const applyStudio = useCallback((studio: HatStudioPayload, opts?: { syncMessages?: boolean }) => {
    setDraft(studio.draft || emptyDraft(studio.draftDefs || []));
    setDraftDefs(studio.draftDefs || []);
    setFilledCount(studio.filledCount || 0);
    const hs = studio.hatSession || studio.transcript?.hatSession || null;
    if (hs) setHatSession(hs);
    if (opts?.syncMessages !== false && studio.transcript?.messages) {
      setMessages(studio.transcript.messages);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!classId?.trim()) return;
    const studio = await fetchHatStudio(classId.trim());
    applyStudio(studio);
  }, [classId, applyStudio]);

  useEffect(() => {
    if (!classId?.trim()) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const studio = await fetchHatStudio(classId.trim());
        if (!cancelled) applyStudio(studio);
      } catch (e) {
        if (!cancelled) message.error(e instanceof Error ? e.message : '加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [classId, applyStudio]);

  useEffect(() => {
    const el = chatScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, isPlaying]);

  const highlightModule = (moduleKey: string | null) => {
    if (!moduleKey) return;
    setHighlightKey(moduleKey);
    setTimeout(() => setHighlightKey(null), 3000);
  };

  const playMessagesSequential = async (roundMsgs: HatStudioDebateMessage[]) => {
    setIsPlaying(true);
    const existingIds = new Set(messages.map((m) => m.id));
    for (const m of roundMsgs) {
      if (existingIds.has(m.id)) continue;
      setCurrentSpeaker(m.hat === 'user' ? 'user' : m.hat);
      await delayMs(messageDelay(m.content));
      setMessages((prev) => {
        if (prev.some((x) => x.id === m.id)) return prev;
        return [...prev, m];
      });
      if (m.targetModule) highlightModule(m.targetModule);
      await delayMs(350);
      setCurrentSpeaker(null);
    }
    setIsPlaying(false);
  };

  /** 是否仍在等待学生首次描述创意（仅有引导语） */
  const awaitingStudentIdea = useMemo(() => {
    if (messages.length === 0) return false;
    return !messages.some((m) => m.hat === 'user');
  }, [messages]);

  const draftFieldOptions = useMemo(
    () =>
      (draftDefs.length
        ? draftDefs
        : [
            { key: 'ideaTitle', label: '创意标题' },
            { key: 'problemInsight', label: '问题洞察' },
            { key: 'userValue', label: '用户价值' },
            { key: 'solutionPoints', label: '方案要点' },
            { key: 'riskDiff', label: '风险与差异' },
          ]
      ).map((d) => ({ key: d.key, label: d.label })),
    [draftDefs]
  );

  const handleStart = async (opts?: { silent?: boolean }) => {
    if (!classId?.trim() || disabled) return;
    if (messages.length > 0) {
      if (!opts?.silent) message.info('当前已有会话，可继续发言；若要重来请点「清空重开」');
      return;
    }
    setIsDebating(true);
    try {
      // 仅插入引导语，不立刻跑六帽；等学生发送创意后再引导
      const { roundMessages, studio } = await hatStudioDebateStart(classId.trim(), studentDisplayName);
      applyStudio(studio, { syncMessages: false });
      setMessages(roundMessages);
      await refresh();
      if (!opts?.silent) {
        message.success(embedded ? '请先在下方输入框描述创意并发送' : '请先描述创意，再点「发送发言」');
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : '开始讨论失败');
    } finally {
      setIsDebating(false);
    }
  };

  // 切到六帽（或独立页激活）且尚无会话时自动开始，无需点「开始」按钮
  useEffect(() => {
    if (!active || disabled || loading) return;
    if (messages.length > 0) return;
    if (autoStartLockRef.current) return;
    autoStartLockRef.current = true;
    void handleStart({ silent: true }).finally(() => {
      autoStartLockRef.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, disabled, loading, messages.length, classId]);

  const handleReset = async () => {
    if (!classId?.trim() || disabled) return;
    setResetting(true);
    try {
      // 清空讨论同时清空右侧创意工作区，避免旧内容残留
      const { roundMessages, studio } = await hatStudioReset(classId.trim(), studentDisplayName, {
        clearDraft: true,
      });
      applyStudio(studio);
      setMessages(roundMessages);
      setUserInput('');
      setCurrentSpeaker(null);
      message.success('已清空本轮讨论，请重新描述创意后发送');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '重置失败');
    } finally {
      setResetting(false);
    }
  };

  const sendWithText = async (raw: string) => {
    if (!classId?.trim() || !raw.trim() || isDebating || isPlaying || disabled) return;
    if (messages.length === 0) {
      message.warning('讨论正在准备中，请稍候再发送');
      return;
    }
    const text = raw.trim();
    if (awaitingStudentIdea && text.length < 5) {
      message.warning('请尽量完整描述你的创意（问题、用户、方案等），便于六帽引导');
      return;
    }
    const activeHat = hatSession?.activeHat || 'white';
    const prevLen = messages.length;
    const tempId = `temp-${crypto.randomUUID()}`;
    setUserInput('');
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        hat: 'user',
        content: text,
        targetModule: null,
        moduleContent: '',
        roundIndex: 0,
        createdAt: new Date().toISOString(),
      },
    ]);
    setIsDebating(true);
    try {
      // 视角切换后与当前帽对话（含顺序轮询作答）
      const res = await hatStudioDebateReply(classId.trim(), studentDisplayName, text, activeHat);
      applyStudio(res.studio, { syncMessages: false });
      const serverUser = res.studio.transcript?.messages?.[prevLen];
      setMessages((prev) => {
        const base = prev.filter((m) => m.id !== tempId);
        if (serverUser?.hat === 'user' && !base.some((m) => m.id === serverUser.id)) {
          base.push(serverUser);
        }
        return base;
      });
      const toPlay =
        res.roundMessages?.filter((m) => m.hat !== 'user') ||
        (res.message ? [res.message] : []);
      if (toPlay.length) await playMessagesSequential(toPlay);
      await refresh();
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setUserInput(text);
      message.error(e instanceof Error ? e.message : '发送失败');
    } finally {
      setIsDebating(false);
    }
  };

  const handleSend = async () => {
    await sendWithText(userInput);
  };

  // 嵌入模式：把发送能力交给外层统一输入条（用 ref，避免回调身份变化触发死循环）
  const onBindComposerRef = useRef(onBindComposer);
  onBindComposerRef.current = onBindComposer;
  const sendWithTextRef = useRef(sendWithText);
  sendWithTextRef.current = sendWithText;

  useEffect(() => {
    const bind = onBindComposerRef.current;
    if (!bind) return;
    const placeholder =
      messages.length === 0
        ? isDebating || loading
          ? '正在开启六帽讨论…'
          : '讨论准备中，请稍候…'
        : awaitingStudentIdea
          ? '例如：我想做校园二手教材流转，解决买书贵、闲置浪费…'
          : `与${hatConfig[hatSession?.activeHat || 'white'].hatLabel}对话（提问不代改）…`;
    bind({
      send: (text) => sendWithTextRef.current(text),
      canSend: !disabled && !isDebating && !isPlaying && messages.length > 0,
      busy: isDebating || isPlaying,
      placeholder,
    });
  }, [awaitingStudentIdea, disabled, hatSession?.activeHat, isDebating, isPlaying, loading, messages.length]);

  useEffect(() => {
    return () => {
      onBindComposerRef.current?.(null);
    };
  }, []);

  const handleAdopt = async (msg: HatStudioDebateMessage, moduleKey: string, content?: string) => {
    if (!classId?.trim() || !moduleKey) return;
    try {
      const studio = await adoptHatStudioMessage(classId.trim(), msg.id, moduleKey, content);
      applyStudio(studio, { syncMessages: false });
      const updated = studio.transcript?.messages?.find((m) => m.id === msg.id);
      setMessages((prev) => prev.map((m) => (m.id === msg.id && updated ? updated : m)));
      highlightModule(moduleKey);
      message.success('已写入创意工作区');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '写入失败');
    }
  };

  const handleDraftBlur = async (moduleKey: string, content: string) => {
    if (!classId?.trim()) return;
    try {
      const studio = await saveHatStudioDraftCell(classId.trim(), moduleKey, content);
      applyStudio(studio, { syncMessages: false });
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存失败');
    }
  };

  const handleSubmitToLibrary = async () => {
    if (!classId?.trim() || disabled) return;
    if (filledCount < 2) {
      message.warning('请至少完善 2 个工作区字段，再让 AI 汇总入库');
      return;
    }
    setSubmittingIdea(true);
    const hide = message.loading('AI 正在汇总工作区笔记并生成创意…', 0);
    try {
      // 只提交工作区原始笔记；标题/描述由服务端 AI 汇总生成，禁止前端拼接长文入库
      const formPayload: Record<string, unknown> = {
        ideaTitle: String(draft.ideaTitle?.content || '').trim(),
        problemInsight: String(draft.problemInsight?.content || '').trim(),
        userValue: String(draft.userValue?.content || '').trim(),
        solutionPoints: String(draft.solutionPoints?.content || '').trim(),
        riskDiff: String(draft.riskDiff?.content || '').trim(),
      };
      await analyzeStudentIdeationIdea(classId.trim(), { methodKey: 'six_hats', formPayload });
      message.success('AI 已汇总创意并写入团队创意库');
      onIdeaCreated?.();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '入库失败');
    } finally {
      hide();
      setSubmittingIdea(false);
    }
  };

  /** 切换帽子视角；若输入框已 @ 其他帽子则同步替换 */
  const switchPerspective = async (hat: HatKey) => {
    if (!classId?.trim() || disabled || isDebating || isPlaying || messages.length === 0) return;
    const mention = `@${hatConfig[hat].hatLabel}`;
    try {
      const { studio } = await hatStudioSwitchHat(classId.trim(), hat);
      applyStudio(studio, { syncMessages: false });
      setUserInput((prev) => syncHatMentionInText(prev, mention));
      onRequestAppendInput?.(mention);
      message.info(`已切换到${hatConfig[hat].hatLabel}视角（${hatConfig[hat].role}）`);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '切换视角失败');
    }
  };

  return (
    <div className={embedded ? 'flex flex-col h-full min-h-0' : 'space-y-4'}>
      {!embedded && (
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
          <h4 className="text-sm font-bold text-violet-900 mb-1">六帽创想室</h4>
          <p className="text-xs text-violet-700">
            ① 描述创意 → ② 按白→绿→黄→黑→红→蓝顺序苏格拉底追问（提问不代改）→ ③ 可随时切换帽子视角 → ④ 写入右侧工作区 → ⑤ AI 汇总入库。
          </p>
        </div>
      )}

      {/*
        视口高度锁定双栏：消息/工作区各自内部滚动；
        嵌入模式填满父级对话卡片，避免把发送条顶出屏幕。
      */}
      <div
        className={
          embedded
            ? 'grid grid-cols-1 lg:grid-cols-5 gap-2 flex-1 min-h-0 h-full lg:items-stretch'
            : 'grid grid-cols-1 lg:grid-cols-5 gap-4 lg:h-[calc(100dvh-12rem)] lg:min-h-[420px] lg:max-h-[900px]'
        }
      >
        <div
          className={
            embedded
              ? 'lg:col-span-3 flex flex-col min-h-0 h-full rounded-xl border border-gray-200 bg-white overflow-hidden'
              : 'lg:col-span-3 flex flex-col h-[min(58dvh,520px)] lg:h-full rounded-xl border border-gray-200 bg-white overflow-hidden'
          }
        >
          {/* Header：标题 + 缩小六帽 + 清空同一行，下方提示 */}
          <div className="px-3 py-1.5 border-b border-gray-100 shrink-0">
            <div className="grid grid-cols-[auto_1fr_auto] items-start gap-3 min-w-0">
              <span className="text-sm font-semibold text-gray-800 shrink-0 pt-1">六帽创想室</span>
              <div className="flex items-start justify-center gap-3 min-w-0 overflow-x-auto py-1">
                {HAT_HEADER_ORDER.map((h) => {
                  const cfg = hatConfig[h];
                  const speaking = currentSpeaker === h;
                  const isActive = (hatSession?.activeHat || 'white') === h || speaking;
                  const done = hatSession?.completedHats?.includes(h);
                  return (
                    <div key={h} className="relative shrink-0 flex flex-col items-center gap-0.5 min-w-[2.75rem]">
                      <Popover
                        trigger="click"
                        placement="bottom"
                        title={`${cfg.hatLabel} · ${cfg.role}`}
                        content={<p className="max-w-xs text-xs text-gray-700 leading-relaxed m-0">{cfg.detail}</p>}
                      >
                        <button
                          type="button"
                          className="absolute -top-1 -right-1 z-10 w-3.5 h-3.5 rounded-full bg-sky-500 text-white text-[9px] font-bold leading-none flex items-center justify-center shadow-sm hover:bg-sky-600 cursor-pointer"
                          aria-label={`${cfg.hatLabel}职能介绍`}
                          title="查看职能介绍"
                          onClick={(e) => e.stopPropagation()}
                        >
                          !
                        </button>
                      </Popover>
                      <button
                        type="button"
                        disabled={disabled || isDebating || isPlaying || messages.length === 0}
                        onClick={() => void switchPerspective(h)}
                        className="relative flex flex-col items-center gap-0.5 transition-opacity cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-100 opacity-90"
                        title={`切换到${cfg.hatLabel}：${cfg.role}${done ? '（顺序已完成）' : ''}`}
                      >
                        <img
                          src={cfg.avatar}
                          alt={cfg.hatLabel}
                          className={`w-7 h-7 rounded-full object-cover border-2 ${cfg.borderColor}`}
                        />
                        {/* 顶栏在白底上展示帽名：黑帽气泡用白字，此处须用深色字否则看不见 */}
                        <span
                          className={`relative inline-block text-[10px] font-bold leading-none ${
                            h === 'black' ? 'text-gray-900' : cfg.textColor
                          }`}
                        >
                          {cfg.hatLabel}
                          {done ? '✓' : ''}
                          {isActive ? (
                            <span
                              className="absolute -top-1 -right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 ring-1 ring-white"
                              aria-hidden
                            />
                          ) : null}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
              <Button
                size="small"
                danger
                loading={resetting}
                disabled={disabled || isDebating || isPlaying || loading || messages.length === 0}
                onClick={() => void handleReset()}
                className="shrink-0 !text-xs !h-7 !px-2.5"
              >
                清空重开
              </Button>
            </div>
            <p className="mt-1 text-[11px] text-gray-500 leading-snug">
              点击帽子切换视角；若输入框已 @ 其他帽子，将同步为当前帽子。顺序：白→绿→黄→黑→红→蓝。
            </p>
          </div>
          <div ref={chatScrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 space-y-3">
            {loading && <div className="text-sm text-gray-400 text-center py-8">加载中…</div>}
            {!loading && messages.length === 0 && (
              <div className="text-sm text-gray-400 text-center py-10">
                {isDebating ? '正在开启六帽讨论…' : '准备中…进入本页将自动开始讨论'}
              </div>
            )}
            {messages.map((msg) => {
              const cfg = hatConfig[msg.hat] || hatConfig.user;
              const isGuide = msg.status === 'guide';
              const adopts = collectAdoptTargets(msg).filter(
                (a) => !(msg.adoptedModules || []).includes(a.targetModule)
              );
              const canWrite =
                !isGuide && msg.status !== 'adopted' && (msg.hat !== 'user' || Boolean(msg.content?.trim()));
              return (
                <div
                  key={msg.id}
                  className={`rounded-xl border p-3 ${cfg.color} ${cfg.borderColor} ${
                    msg.hat === 'user' ? 'ml-6' : 'mr-2'
                  } ${isGuide ? 'ring-1 ring-sky-200' : ''}`}
                >
                  <div className={`text-xs font-bold mb-1 ${cfg.textColor}`}>
                    {isGuide ? '引导' : cfg.hatLabel}
                    {!isGuide && msg.hat !== 'user' ? ` · ${cfg.role}` : ''}
                    {msg.hat === 'user' ? ' · 我的发言' : ''}
                  </div>
                  <p className={`text-sm whitespace-pre-wrap leading-relaxed ${cfg.textColor}`}>{msg.content}</p>
                  {adopts.length > 0 && !isGuide && msg.hat !== 'user' && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {adopts.map((a) => {
                        const label = draftDefs.find((d) => d.key === a.targetModule)?.label || a.targetModule;
                        return (
                          <Button
                            key={a.targetModule}
                            size="small"
                            disabled={disabled}
                            onClick={() => void handleAdopt(msg, a.targetModule, a.moduleContent)}
                          >
                            采纳到「{label}」
                          </Button>
                        );
                      })}
                    </div>
                  )}
                  {canWrite && (
                    <div className="mt-2">
                      <Dropdown
                        disabled={disabled}
                        menu={{
                          items: draftFieldOptions.map((d) => ({
                            key: d.key,
                            label: `写入「${d.label}」`,
                            onClick: () => {
                              const fill = adopts.find((a) => a.targetModule === d.key);
                              void handleAdopt(
                                msg,
                                d.key,
                                fill?.moduleContent || String(msg.moduleContent || msg.content || '').trim()
                              );
                            },
                          })),
                        }}
                      >
                        <Button size="small" type="link" className="!px-0">
                          选择写入工作区 ▾
                        </Button>
                      </Dropdown>
                    </div>
                  )}
                  {msg.status === 'adopted' && (
                    <div className="mt-1 text-xs text-emerald-700">已写入工作区</div>
                  )}
                </div>
              );
            })}
            {(isDebating || isPlaying) && (
              <div className="text-xs text-violet-600 animate-pulse">
                {awaitingStudentIdea ? '等待你的创意描述…' : '帽子正在根据你的内容引导讨论…'}
              </div>
            )}
          </div>
          {/* 嵌入：外层输入条压在讨论区底部左侧；非嵌入：自带发送框 */}
          {embedded && composerFooter ? (
            <div className="shrink-0 border-t border-gray-100 bg-white">{composerFooter}</div>
          ) : null}
          {!embedded && (
            <div className="p-3 border-t border-gray-100 shrink-0">
              <div className="flex gap-2 items-center h-10">
                <Input
                  value={userInput}
                  disabled={disabled || isDebating || isPlaying || messages.length === 0}
                  onChange={(e) => setUserInput(e.target.value)}
                  onPressEnter={() => void handleSend()}
                  className="!h-10"
                  placeholder={
                    awaitingStudentIdea
                      ? '例如：我想做校园二手教材流转，解决买书贵、闲置浪费…'
                      : '继续补充想法；或不输入 @ 开下一轮六帽；或 @白帽 等追问'
                  }
                />
                <Button
                  type="primary"
                  className="!bg-violet-600 !border-violet-600 !h-10 !px-4 whitespace-nowrap"
                  loading={isDebating}
                  disabled={disabled || !userInput.trim() || isPlaying || messages.length === 0}
                  onClick={() => void handleSend()}
                >
                  发送发言
                </Button>
              </div>
            </div>
          )}
        </div>

        <div
          className={
            embedded
              ? 'lg:col-span-2 flex flex-col min-h-0 h-full self-stretch rounded-xl border border-gray-200 bg-white overflow-hidden'
              : 'lg:col-span-2 flex flex-col h-[min(58dvh,520px)] lg:h-full rounded-xl border border-gray-200 bg-white overflow-hidden'
          }
        >
          <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between shrink-0">
            <span className="text-sm font-semibold text-gray-800">创意工作区</span>
            <span className="text-xs text-gray-500">
              已填 {filledCount}/{draftDefs.length || 5}
            </span>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 space-y-3">
            {(draftDefs.length
              ? draftDefs
              : [
                  { key: 'ideaTitle', label: '创意标题' },
                  { key: 'problemInsight', label: '问题洞察' },
                  { key: 'userValue', label: '用户价值' },
                  { key: 'solutionPoints', label: '方案要点' },
                  { key: 'riskDiff', label: '风险与差异' },
                ]
            ).map((def) => {
              const cell = draft[def.key] || { content: '', updatedBy: '' };
              const hi = highlightKey === def.key;
              return (
                <div
                  key={def.key}
                  className={`rounded-lg border p-2 ${hi ? 'border-violet-400 bg-violet-50' : 'border-gray-100 bg-gray-50'}`}
                >
                  <div className="text-xs font-semibold text-gray-700 mb-1">{def.label}</div>
                  <Input.TextArea
                    rows={def.key === 'ideaTitle' ? 2 : 3}
                    value={cell.content}
                    disabled={disabled}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        [def.key]: { ...prev[def.key], content: e.target.value, updatedBy: prev[def.key]?.updatedBy || '' },
                      }))
                    }
                    onBlur={(e) => void handleDraftBlur(def.key, e.target.value)}
                    placeholder={`填写或采纳「${def.label}」`}
                  />
                  {cell.updatedBy ? (
                    <div className="text-[10px] text-gray-400 mt-0.5">来源：{cell.updatedBy}</div>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="p-3 border-t border-gray-100 shrink-0">
            <Button
              type="primary"
              block
              loading={submittingIdea}
              disabled={disabled}
              className="!h-10 !bg-gradient-to-r !from-violet-500 !to-fuchsia-500 !border-0 !font-semibold"
              onClick={() => void handleSubmitToLibrary()}
            >
              AI汇总并入库
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
