import { useCallback, useEffect, useRef, useState } from 'react';
import { Popover, message } from 'antd';
import AppModalPortal from '../../../components/AppModalPortal';
import { ChatMarkdown } from '../../../components/ChatMarkdown';
import {
  WAR_ROOM_MODULE_DEFS,
  fetchBusinessModelWorkspace,
  fetchWarRoomMemberRecord,
  parseMentionedHat,
  saveWarRoomCanvasCell,
  saveWarRoomCanvasRecord,
  warRoomDebateReply,
  warRoomDebateRound,
  warRoomDebateStart,
  warRoomSwitchHat,
  type WarRoomCanvas,
  type WarRoomDebateMessage,
  type WarRoomHat,
  type WarRoomTeamRecordSummary,
} from '../../../lib/studentBusinessModelApi';
import imgBai from '../../../assets/images/bai.jpg';
import imgHong from '../../../assets/images/hong.jpg';
import imgHei from '../../../assets/images/hei.jpg';
import imgHuang from '../../../assets/images/huang.jpg';
import imgLv from '../../../assets/images/lv.jpg';
import imgLan from '../../../assets/images/lan.jpg';

type HatKey = Exclude<WarRoomHat, 'user'>;

const HAT_HEADER_ORDER: HatKey[] = ['white', 'green', 'yellow', 'black', 'red', 'blue'];

const hatConfig: Record<
  HatKey | 'user',
  {
    name: string;
    hatLabel: string;
    role: string;
    /** 气泡叹号弹出的职能详解 */
    detail: string;
    color: string;
    textColor: string;
    borderColor: string;
    icon: string;
    avatar: string;
    avatarBorder: string;
    avatarBorderActive: string;
    labelColor: string;
    ringGlow: string;
  }
> = {
  white: {
    name: '白帽 - 客观事实｜补信息',
    hatLabel: '白帽',
    role: '客观事实｜补信息',
    detail:
      '白帽（客观事实思维｜补信息）：聚焦事实、数据、已知信息，不做主观评判。引导学生区分「主观猜想」和「客观可验证信息」，找出缺少的资料、数据、前提条件。提问句式：你有哪些可验证的数据？这个说法依据是什么？还缺少哪些信息？',
    color: 'bg-gray-100',
    textColor: 'text-gray-900',
    borderColor: 'border-gray-300',
    icon: 'ri-bar-chart-line',
    avatar: imgBai,
    avatarBorder: 'border-gray-300',
    avatarBorderActive: 'border-gray-500 ring-2 ring-gray-300',
    labelColor: 'text-gray-700',
    ringGlow: 'shadow-[0_0_0_2px_rgba(156,163,175,0.5)]',
  },
  red: {
    name: '红帽 - 用户共情｜贴需求',
    hatLabel: '红帽',
    role: '用户共情｜贴需求',
    detail:
      '红帽（用户共情思维｜贴需求）：关注感受、情绪、直觉，站在用户视角体会好恶与真实感受。提问句式：用户看到这个方案第一感受是什么？用户会担心什么？什么场景下用户会抵触？',
    color: 'bg-red-100',
    textColor: 'text-red-900',
    borderColor: 'border-red-300',
    icon: 'ri-heart-line',
    avatar: imgHong,
    avatarBorder: 'border-red-400',
    avatarBorderActive: 'border-red-500 ring-2 ring-red-200',
    labelColor: 'text-red-700',
    ringGlow: 'shadow-[0_0_0_2px_rgba(248,113,113,0.55)]',
  },
  black: {
    name: '黑帽 - 风险批判｜查风险',
    hatLabel: '黑帽',
    role: '风险批判｜查风险',
    detail:
      '黑帽（风险批判思维｜查风险）：理性审视隐患、短板、潜在风险，识别方案漏洞与落地障碍，审慎评估而非抬杠。提问句式：这个方案最大隐患是什么？哪一步最容易出问题？有哪些不可控因素？',
    color: 'bg-gray-900',
    textColor: 'text-white',
    borderColor: 'border-gray-700',
    icon: 'ri-shield-line',
    avatar: imgHei,
    avatarBorder: 'border-gray-800',
    avatarBorderActive: 'border-gray-900 ring-2 ring-gray-400',
    labelColor: 'text-gray-900',
    ringGlow: 'shadow-[0_0_0_2px_rgba(31,41,55,0.45)]',
  },
  yellow: {
    name: '黄帽 - 正向价值｜判价值',
    hatLabel: '黄帽',
    role: '正向价值｜判价值',
    detail:
      '黄帽（正向价值思维｜判价值）：挖掘项目的价值、优势、收益，思考为什么可行、用户能获得什么价值。提问句式：这个方案最大的价值是什么？用户为什么愿意选择你？长期能带来什么收益？',
    color: 'bg-yellow-100',
    textColor: 'text-yellow-900',
    borderColor: 'border-yellow-300',
    icon: 'ri-thumb-up-line',
    avatar: imgHuang,
    avatarBorder: 'border-yellow-400',
    avatarBorderActive: 'border-yellow-500 ring-2 ring-yellow-200',
    labelColor: 'text-yellow-800',
    ringGlow: 'shadow-[0_0_0_2px_rgba(250,204,21,0.55)]',
  },
  green: {
    name: '绿帽 - 发散创新｜找创新',
    hatLabel: '绿帽',
    role: '发散创新｜找创新',
    detail:
      '绿帽（发散创新思维｜找创新）：鼓励发散、跳出固有方案，挖掘创意可能性、替代方案、差异化亮点，不否定原有想法。提问句式：还有别的实现方式吗？可以增加什么新亮点？有没有不一样的解决思路？',
    color: 'bg-green-100',
    textColor: 'text-green-900',
    borderColor: 'border-green-300',
    icon: 'ri-lightbulb-line',
    avatar: imgLv,
    avatarBorder: 'border-green-500',
    avatarBorderActive: 'border-green-600 ring-2 ring-green-200',
    labelColor: 'text-green-700',
    ringGlow: 'shadow-[0_0_0_2px_rgba(34,197,94,0.5)]',
  },
  blue: {
    name: '蓝帽 - 全局系统｜做统筹',
    hatLabel: '蓝帽',
    role: '全局系统｜做统筹',
    detail:
      '蓝帽（全局系统思维｜做统筹）：把控整体框架，整合前面各帽结论，规划后续行动，收敛思路。提问句式：综合前面分析，当前最大问题是什么？下一步优先做什么？整体框架如何调整？',
    color: 'bg-blue-100',
    textColor: 'text-blue-900',
    borderColor: 'border-blue-300',
    icon: 'ri-command-line',
    avatar: imgLan,
    avatarBorder: 'border-blue-500',
    avatarBorderActive: 'border-blue-600 ring-2 ring-blue-200',
    labelColor: 'text-blue-700',
    ringGlow: 'shadow-[0_0_0_2px_rgba(59,130,246,0.5)]',
  },
  user: {
    name: '学生',
    hatLabel: '我',
    role: '学生',
    detail: '学生本人发言。',
    color: 'bg-teal-50',
    textColor: 'text-teal-900',
    borderColor: 'border-teal-200',
    icon: 'ri-user-line',
    avatar: '',
    avatarBorder: 'border-teal-400',
    avatarBorderActive: 'border-teal-500 ring-2 ring-teal-200',
    labelColor: 'text-teal-700',
    ringGlow: '',
  },
};

const HAT_MENTION_LABELS: { hat: HatKey; label: string }[] = [
  { hat: 'white', label: '@白帽' },
  { hat: 'red', label: '@红帽' },
  { hat: 'black', label: '@黑帽' },
  { hat: 'yellow', label: '@黄帽' },
  { hat: 'green', label: '@绿帽' },
  { hat: 'blue', label: '@蓝帽' },
];

/**
 * 清除输入中的 @帽子。
 * 注意：中文帽名后不能用 \b（中文非 \w，边界永不成立），否则连续点 @ 会叠多个帽子。
 */
const MENTION_STRIP_RE =
  /@\s*(白帽|红帽|黑帽|黄帽|绿帽|蓝帽|white|red|black|yellow|green|blue)/gi;

function stripHatMentions(text: string) {
  return text.replace(MENTION_STRIP_RE, '').replace(/\s+/g, ' ').trim();
}

/** 输入框已有 @某帽 时，替换为切换后的帽子；无 @ 则不动 */
function syncHatMentionInText(text: string, hatLabel: string) {
  const hasMention = /@\s*(白帽|红帽|黑帽|黄帽|绿帽|蓝帽|white|red|black|yellow|green|blue)/i.test(text);
  if (!hasMention) return text;
  const base = stripHatMentions(text);
  return base ? `${hatLabel} ${base}` : `${hatLabel} `;
}

function emptyCanvas(): WarRoomCanvas {
  const o: WarRoomCanvas = {};
  for (const m of WAR_ROOM_MODULE_DEFS) {
    o[m.key] = { content: '', updatedBy: '' };
  }
  return o;
}

function delayMs(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** 上屏后的阅读间隔；勿在上屏前等待，否则接口返回后会空等约 1 秒 */
function messageDelay(content: string) {
  return Math.min(1200, Math.max(280, String(content || '').length * 8));
}

type WarRoomProps = {
  classId?: string;
  studentDisplayName?: string;
  onRecordSaved?: () => void;
  disabled?: boolean;
};

export default function WarRoom({ classId, studentDisplayName = '同学', onRecordSaved, disabled = false }: WarRoomProps) {
  const [messages, setMessages] = useState<WarRoomDebateMessage[]>([]);
  const [canvas, setCanvas] = useState<WarRoomCanvas>(emptyCanvas);
  const [filledCount, setFilledCount] = useState(0);
  const [currentSpeaker, setCurrentSpeaker] = useState<WarRoomHat | null>(null);
  const [highlightKey, setHighlightKey] = useState<string | null>(null);
  const [userInput, setUserInput] = useState('');
  const [loading, setLoading] = useState(() => Boolean(classId?.trim()));
  const [isDebating, setIsDebating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [teamRecords, setTeamRecords] = useState<WarRoomTeamRecordSummary[]>([]);
  const [currentStudentId, setCurrentStudentId] = useState('');
  const [dialogRecord, setDialogRecord] = useState<{
    studentId: string;
    studentName: string;
    canvas: WarRoomCanvas;
  } | null>(null);
  const [recordsDialogOpen, setRecordsDialogOpen] = useState(false);
  const [savingRecord, setSavingRecord] = useState(false);
  const [canvasFocus, setCanvasFocus] = useState(false);
  /** 当前帽子视角（用于顶栏高亮；与会话 activeHat 同步） */
  const [activeHat, setActiveHat] = useState<HatKey>('white');
  /** AI 等待时展示「某帽正在组织对话」 */
  const [waitingHat, setWaitingHat] = useState<HatKey | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const workspaceHatSessionRef = useRef<HatKey>('white');
  const inputRef = useRef<HTMLInputElement>(null);
  /** 无对话时自动白帽开场，防 Strict Mode 双触发 */
  const autoStartLockRef = useRef(false);

  const scrollChatToBottom = useCallback(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    scrollChatToBottom();
  }, [messages.length, isPlaying, scrollChatToBottom]);

  useEffect(() => {
    if (!canvasFocus) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCanvasFocus(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [canvasFocus]);

  const applyWorkspace = useCallback(
    (
      ws: Awaited<ReturnType<typeof fetchBusinessModelWorkspace>>,
      opts?: { syncMessages?: boolean; syncCanvas?: boolean }
    ) => {
      const wr = ws.warRoom;
      if (opts?.syncCanvas !== false && wr?.canvas) setCanvas(wr.canvas);
      if (opts?.syncMessages !== false && wr?.transcript?.messages) {
        setMessages(wr.transcript.messages);
      }
      setFilledCount(wr?.filledCount ?? 0);
      if (wr?.hatSession?.activeHat) {
        const hat = wr.hatSession.activeHat as HatKey;
        workspaceHatSessionRef.current = hat;
        setActiveHat(hat);
      }
      if (ws.warRoomTeamRecords) setTeamRecords(ws.warRoomTeamRecords);
      if (ws.studentId) setCurrentStudentId(ws.studentId);
    },
    []
  );

  const refreshWorkspace = useCallback(async () => {
    if (!classId?.trim()) return;
    const ws = await fetchBusinessModelWorkspace(classId.trim());
    applyWorkspace(ws);
  }, [classId, applyWorkspace]);

  useEffect(() => {
    if (!classId?.trim()) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const ws = await fetchBusinessModelWorkspace(classId.trim());
        if (!cancelled) applyWorkspace(ws);
      } catch (e) {
        if (!cancelled) message.error(e instanceof Error ? e.message : '加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [classId, applyWorkspace]);

  const highlightModule = (moduleKey: string | null) => {
    if (!moduleKey) return;
    setHighlightKey(moduleKey);
    setTimeout(() => setHighlightKey(null), 3000);
  };

  const playMessagesSequential = async (roundMsgs: WarRoomDebateMessage[]) => {
    setIsPlaying(true);
    const existingIds = new Set(messages.map((m) => m.id));
    for (const m of roundMsgs) {
      if (existingIds.has(m.id)) continue;
      setCurrentSpeaker(m.hat === 'user' ? 'user' : m.hat);
      // 先上屏，再短停顿（对齐六帽创想室「接口回来就能看见」的手感）
      setMessages((prev) => {
        if (prev.some((x) => x.id === m.id)) return prev;
        return [...prev, m];
      });
      if (m.targetModule) highlightModule(m.targetModule);
      await delayMs(messageDelay(m.content));
      setCurrentSpeaker(null);
    }
    setIsPlaying(false);
  };

  const handleStartDebate = async () => {
    if (!classId?.trim() || disabled) return;
    if (messages.length > 0) return;
    setIsDebating(true);
    setWaitingHat('white');
    try {
      const { roundMessages, workspace } = await warRoomDebateStart(classId.trim(), studentDisplayName);
      applyWorkspace(workspace, { syncMessages: false, syncCanvas: false });
      setWaitingHat(null);
      await playMessagesSequential(roundMessages);
      await refreshWorkspace();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '白帽开场失败');
      autoStartLockRef.current = false;
    } finally {
      setWaitingHat(null);
      setIsDebating(false);
    }
  };

  // 无对话记录时自动由白帽开场（去掉「开始辩论」按钮）
  useEffect(() => {
    if (!classId?.trim() || disabled || loading) return;
    if (messages.length > 0) return;
    if (autoStartLockRef.current || isDebating) return;
    autoStartLockRef.current = true;
    void handleStartDebate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, disabled, loading, messages.length]);

  const handleSend = async () => {
    if (!classId?.trim() || !userInput.trim() || isDebating || isPlaying) return;
    if (messages.length === 0) {
      message.warning('请稍候，白帽正在开场');
      return;
    }
    const text = userInput.trim();
    const prevLen = messages.length;
    const tempId = `temp-${crypto.randomUUID()}`;
    const optimistic: WarRoomDebateMessage = {
      id: tempId,
      hat: 'user',
      content: text,
      targetModule: null,
      moduleContent: '',
      roundIndex: 0,
      createdAt: new Date().toISOString(),
    };
    setUserInput('');
    setMessages((prev) => [...prev, optimistic]);
    // @某帽 优先，避免仍按当前会话帽回复
    const replyHat = (parseMentionedHat(text) || workspaceHatSessionRef.current || 'white') as HatKey;
    setIsDebating(true);
    setWaitingHat(replyHat);
    try {
      const res = await warRoomDebateReply(classId.trim(), studentDisplayName, text, replyHat);
      applyWorkspace(res.workspace, { syncMessages: false, syncCanvas: false });
      if (res.workspace.warRoom?.hatSession?.activeHat) {
        workspaceHatSessionRef.current = res.workspace.warRoom.hatSession.activeHat as HatKey;
        setActiveHat(res.workspace.warRoom.hatSession.activeHat as HatKey);
      }
      const serverUser = res.workspace.warRoom?.transcript?.messages?.[prevLen];
      setMessages((prev) => {
        const base = prev.filter((m) => m.id !== tempId);
        if (serverUser?.hat === 'user' && !base.some((m) => m.id === serverUser.id)) {
          base.push(serverUser);
        }
        return base;
      });
      setWaitingHat(null);
      const toPlay =
        res.roundMessages?.filter((m) => m.hat !== 'user') ||
        (res.message ? [res.message] : []);
      if (toPlay.length) await playMessagesSequential(toPlay);
      await refreshWorkspace();
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setUserInput(text);
      message.error(e instanceof Error ? e.message : '发送失败');
    } finally {
      setWaitingHat(null);
      setIsDebating(false);
    }
  };

  const handleCanvasBlur = async (moduleKey: string, content: string) => {
    if (!classId?.trim()) return;
    try {
      const ws = await saveWarRoomCanvasCell(classId.trim(), moduleKey, content);
      applyWorkspace(ws);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存失败');
    }
  };

  /**
   * 切换帽子视角。
   * forceMention：点击底部 @某帽 时强制写入该 @；顶栏切换仅在已有 @ 时同步替换。
   */
  const handleSwitchHat = async (hat: HatKey, opts?: { forceMention?: boolean }) => {
    if (!classId?.trim() || disabled || isDebating || isPlaying || messages.length === 0) return;
    const mentionLabel = HAT_MENTION_LABELS.find((x) => x.hat === hat)?.label || `@${hatConfig[hat].hatLabel}`;
    try {
      const { workspace } = await warRoomSwitchHat(classId.trim(), hat);
      applyWorkspace(workspace, { syncMessages: false });
      workspaceHatSessionRef.current = hat;
      setActiveHat(hat);
      setUserInput((prev) => {
        if (opts?.forceMention) {
          const base = stripHatMentions(prev);
          return base ? `${mentionLabel} ${base}` : `${mentionLabel} `;
        }
        return syncHatMentionInText(prev, mentionLabel);
      });
      if (opts?.forceMention) inputRef.current?.focus();
      message.info(`已切换到${hatConfig[hat].hatLabel}视角`);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '切换失败');
    }
  };

  const handleSaveRecord = async () => {
    if (!classId?.trim()) return;
    if (filledCount < WAR_ROOM_MODULE_DEFS.length) {
      message.warning('请先填齐九格后再保存');
      return;
    }
    setSavingRecord(true);
    try {
      const ws = await saveWarRoomCanvasRecord(classId.trim());
      applyWorkspace(ws);
      onRecordSaved?.();
      message.success('已保存至讨论记录');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSavingRecord(false);
    }
  };

  const handleViewRecord = async (rec: WarRoomTeamRecordSummary) => {
    if (!classId?.trim()) return;
    if (dialogRecord?.studentId === rec.studentId) {
      setDialogRecord(null);
      return;
    }
    try {
      const detail = await fetchWarRoomMemberRecord(classId.trim(), rec.studentId);
      setDialogRecord({
        studentId: detail.studentId,
        studentName: detail.studentName,
        canvas: detail.canvas,
      });
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载记录失败');
    }
  };

  const recordStudentLabel = (rec: WarRoomTeamRecordSummary) => {
    if (rec.studentId === currentStudentId) return '我';
    const name = rec.studentName?.trim() || '同学';
    return name.length > 4 ? `${name.slice(0, 4)}…` : name;
  };
  const debateStarted = messages.length > 0;
  const waitingAi = Boolean(waitingHat) && isDebating && !isPlaying;
  const waitingHint = waitingHat
    ? `${hatConfig[waitingHat].hatLabel}正在组织对话…`
    : '思考中…';
  const canSaveCanvas = filledCount >= WAR_ROOM_MODULE_DEFS.length && !savingRecord;

  const renderMessageMeta = (msg: WarRoomDebateMessage) => {
    if (msg.hat === 'user') {
      return { ...hatConfig.user, displayName: studentDisplayName };
    }
    const cfg = hatConfig[msg.hat as HatKey];
    // 只展示「白帽 · 职责」，避免 name 与气泡正文标题重复
    return {
      ...cfg,
      displayName: cfg ? `${cfg.hatLabel} · ${cfg.role}` : msg.hat,
    };
  };

  const renderRecordCanvasGrid = (recordCanvas: WarRoomCanvas) => (
    <div className="grid grid-cols-3 gap-2">
      {WAR_ROOM_MODULE_DEFS.map((mod) => {
        const cell = recordCanvas[mod.key] || { content: '', updatedBy: '' };
        return (
          <div key={mod.key} className="bg-white rounded-lg border border-gray-200 p-2 flex flex-col min-h-[100px]">
            <h4 className="text-xs font-bold text-gray-900 mb-1">{mod.title}</h4>
            <p className="flex-1 text-xs text-gray-700 whitespace-pre-wrap break-words">
              {cell.content?.trim() || '—'}
            </p>
            {cell.updatedBy ? (
              <p className="mt-1 text-[10px] text-teal-600 truncate">{cell.updatedBy}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );

  return (
    <div
      className={
        canvasFocus
          ? 'fixed inset-0 z-[200] flex bg-gray-100'
          : 'h-[calc(100dvh-11rem)] min-h-[420px] max-h-[900px] flex bg-gray-50 rounded-xl border border-gray-100 overflow-hidden'
      }
    >
      <div
        className="bg-white flex flex-col min-h-0 flex-1 w-full"
      >
        <div className="px-3 py-2 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white shrink-0">
          <div className="grid grid-cols-[auto_1fr] items-start gap-3 min-w-0">
            <h3 className="text-base font-bold text-gray-900 shrink-0 pt-1">虚拟董事会</h3>
            <div className="flex items-start justify-center gap-3 min-w-0 overflow-x-auto py-1">
              {HAT_HEADER_ORDER.map((hat) => {
                const cfg = hatConfig[hat];
                const speaking = currentSpeaker === hat;
                const isActive = activeHat === hat || speaking;
                return (
                  <div key={hat} className="relative shrink-0 flex flex-col items-center gap-0.5 min-w-[2.75rem]">
                    {/* 头像右上角叹号：角色职能介绍 */}
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
                      title={`${cfg.name}（点击切换视角）`}
                      disabled={disabled || isDebating || isPlaying || messages.length === 0}
                      onClick={() => void handleSwitchHat(hat)}
                      className="relative flex flex-col items-center gap-0.5 transition-opacity cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-100 opacity-90"
                    >
                      <img
                        src={cfg.avatar}
                        alt={cfg.hatLabel}
                        className={`w-7 h-7 rounded-full object-cover border-2 ${cfg.avatarBorder}`}
                      />
                      <span className={`relative inline-block text-[10px] font-bold leading-none ${cfg.labelColor}`}>
                        {cfg.hatLabel}
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
          </div>
        </div>

        <div ref={chatScrollRef} className="flex-1 min-h-0 overflow-y-auto py-3 px-4 space-y-3">
          {loading ? (
            <div className="text-center text-sm text-gray-400 py-8">加载中…</div>
          ) : messages.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                {waitingAi ? (
                  <i className="ri-loader-4-line text-2xl text-teal-500 animate-spin"></i>
                ) : (
                  <i className="ri-chat-3-line text-2xl text-gray-400"></i>
                )}
              </div>
              <p className="text-sm text-gray-500">
                {waitingAi ? waitingHint : '白帽即将开场，按白→绿→黄→黑→红→蓝依次苏格拉底追问'}
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const meta = renderMessageMeta(msg);
              return (
                <div key={msg.id} className="flex items-start gap-2">
                  {msg.hat === 'user' ? (
                    <div
                      className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center border-2 ${meta.avatarBorder} ${meta.color}`}
                    >
                      <i className={`${meta.icon} text-base ${meta.textColor}`}></i>
                    </div>
                  ) : (
                    <img
                      src={meta.avatar}
                      alt={meta.displayName}
                      className={`w-9 h-9 rounded-full object-cover flex-shrink-0 border-2 ${meta.avatarBorder}`}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-bold text-gray-900">{meta.displayName}</span>
                      <span className="text-xs text-gray-400">
                        {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString('zh-CN') : ''}
                      </span>
                    </div>
                    <div
                      className={`${meta.color} ${meta.textColor} px-3 py-2 rounded-xl text-sm leading-relaxed`}
                    >
                      {/* 帽子回复渲染 Markdown；学生原文按纯文本保留换行 */}
                      {msg.hat === 'user' ? (
                        <span className="whitespace-pre-wrap">{msg.content}</span>
                      ) : (
                        <ChatMarkdown text={msg.content || ''} />
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          {waitingAi && messages.length > 0 ? (
            <div className="flex items-center gap-2 text-sm text-teal-600 py-1">
              <i className="ri-loader-4-line animate-spin"></i>
              <span>{waitingHint}</span>
              <span className="tracking-widest text-gray-400">...</span>
            </div>
          ) : null}
        </div>

        <div className="p-3 border-t border-gray-200 bg-white shrink-0">
          <div className="flex flex-wrap gap-1 mb-2">
            {HAT_MENTION_LABELS.map(({ hat, label }) => (
              <button
                key={label}
                type="button"
                disabled={disabled || isDebating || isPlaying || messages.length === 0}
                onClick={() => void handleSwitchHat(hat, { forceMention: true })}
                className="px-2 py-0.5 text-xs rounded-md bg-gray-100 text-gray-600 hover:bg-teal-50 hover:text-teal-700 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              disabled={!debateStarted || isDebating || isPlaying}
              placeholder={
                debateStarted ? '针对当前帽子视角作答；或 @某帽 只问该帽…' : '白帽开场中，请稍候…'
              }
              className="flex-1 px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-gray-50"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!debateStarted || isDebating || isPlaying || !userInput.trim()}
              className="px-4 py-2.5 bg-teal-500 text-white text-sm font-medium rounded-xl hover:bg-teal-600 disabled:opacity-50 cursor-pointer"
            >
              <i className="ri-send-plane-line"></i>
            </button>
          </div>
        </div>
      </div>

      <div className="hidden flex-1 min-w-0 flex-col min-h-0 bg-gray-50" aria-hidden="true">
        <div className="px-4 py-3 border-b border-gray-200 bg-white shrink-0 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-gray-900">商业模式画布</h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-gray-500">
              已填写 {filledCount}/{WAR_ROOM_MODULE_DEFS.length}
            </span>
            <button
              type="button"
              onClick={() => {
                setRecordsDialogOpen(true);
                setDialogRecord(null);
              }}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-700 hover:border-teal-300 hover:text-teal-700 cursor-pointer whitespace-nowrap"
            >
              <i className="ri-file-list-3-line mr-1"></i>
              讨论记录
              {teamRecords.length > 0 ? (
                <span className="ml-1 text-teal-600">({teamRecords.length})</span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={handleSaveRecord}
              disabled={disabled || !canSaveCanvas}
              title={filledCount < WAR_ROOM_MODULE_DEFS.length ? '请先填齐九格' : undefined}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-teal-500 text-white hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {savingRecord ? '保存中…' : '保存'}
            </button>
            {canvasFocus ? (
              <button
                type="button"
                title="退出放大"
                onClick={() => setCanvasFocus(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 cursor-pointer"
              >
                <i className="ri-fullscreen-exit-line text-lg"></i>
              </button>
            ) : (
              <button
                type="button"
                title="放大画布"
                onClick={() => setCanvasFocus(true)}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-teal-50 hover:text-teal-700 cursor-pointer"
              >
                <i className="ri-fullscreen-line text-lg"></i>
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          <div
            className={`grid gap-3 mx-auto w-full ${
              canvasFocus ? 'grid-cols-3 gap-4 max-w-[1400px]' : 'grid-cols-3 max-w-6xl'
            }`}
          >
            {WAR_ROOM_MODULE_DEFS.map((mod) => {
              const cell = canvas[mod.key] || { content: '', updatedBy: '' };
              const highlighted = highlightKey === mod.key;
              return (
                <div
                  key={mod.key}
                  className={`bg-white rounded-xl p-4 transition-all duration-300 flex flex-col ${
                    canvasFocus ? 'min-h-[200px]' : 'min-h-[140px]'
                  } ${
                    highlighted
                      ? 'ring-2 ring-teal-500 shadow-lg scale-[1.02]'
                      : 'border border-gray-200 shadow-sm'
                  }`}
                >
                  <h4 className="text-sm font-bold text-gray-900 mb-2">{mod.title}</h4>
                  <textarea
                    value={cell.content}
                    onChange={(e) =>
                      setCanvas((prev) => ({
                        ...prev,
                        [mod.key]: { ...prev[mod.key], content: e.target.value, updatedBy: cell.updatedBy },
                      }))
                    }
                    onBlur={(e) => handleCanvasBlur(mod.key, e.target.value)}
                    rows={canvasFocus ? 8 : 5}
                    placeholder="待填写…"
                    className="flex-1 w-full text-xs text-gray-700 border border-gray-100 rounded-lg p-2 resize-none focus:outline-none focus:ring-1 focus:ring-teal-400 read-only:bg-gray-50 read-only:cursor-default"
                  />
                  {cell.updatedBy ? (
                    <p className="mt-2 text-xs text-teal-600 truncate">{cell.updatedBy}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
          {!canvasFocus ? (
            <div className="mt-4 max-w-6xl mx-auto bg-teal-50 border border-teal-200 rounded-xl p-4 text-sm text-teal-800 space-y-1">
              <p>• 进入后由白帽自动开场，按白 → 绿 → 黄 → 黑 → 红 → 蓝顺序苏格拉底追问</p>
              <p>• @ 某一顶帽子仅该帽回复；未 @ 时按当前视角作答</p>
            </div>
          ) : null}
        </div>
      </div>

      {recordsDialogOpen ? (
        <AppModalPortal open onMaskClick={() => setRecordsDialogOpen(false)} zIndex={300}>
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[min(88vh,720px)] flex flex-col overflow-hidden"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between shrink-0">
              <h3 className="text-sm font-bold text-gray-900">讨论记录</h3>
              <button
                type="button"
                onClick={() => setRecordsDialogOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 cursor-pointer"
                aria-label="关闭"
              >
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
            <div className="flex flex-col flex-1 min-h-0">
              <div className="shrink-0 px-4 py-3 border-b border-gray-200 bg-white">
                {teamRecords.length === 0 ? (
                  <p className="text-xs text-gray-500">暂无记录</p>
                ) : (
                  <div className="flex flex-wrap gap-2 w-full">
                    {teamRecords.map((rec) => (
                      <button
                        key={rec.studentId}
                        type="button"
                        title={
                          rec.savedAt
                            ? `${rec.studentName} ${new Date(rec.savedAt).toLocaleString('zh-CN')}`
                            : rec.studentName
                        }
                        onClick={() => handleViewRecord(rec)}
                        className={`px-2.5 py-1 text-xs rounded-md border cursor-pointer transition-colors whitespace-nowrap ${
                          dialogRecord?.studentId === rec.studentId
                            ? 'border-teal-500 bg-teal-50 text-teal-800'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-teal-300'
                        }`}
                      >
                        {recordStudentLabel(rec)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-4 bg-gray-50">
                {dialogRecord ? (
                  <>
                    <p className="text-xs text-gray-600 mb-3">
                      {dialogRecord.studentName}
                      {dialogRecord.studentId === currentStudentId ? '（我）' : ''}
                    </p>
                    {renderRecordCanvasGrid(dialogRecord.canvas)}
                  </>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-16">请选择组员查看已保存画布</p>
                )}
              </div>
            </div>
          </div>
        </AppModalPortal>
      ) : null}
    </div>
  );
}
