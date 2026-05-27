import { useCallback, useEffect, useRef, useState } from 'react';
import { message } from 'antd';
import {
  WAR_ROOM_MODULE_DEFS,
  adoptWarRoomMessage,
  fetchBusinessModelWorkspace,
  parseMentionedHat,
  saveWarRoomCanvasCell,
  warRoomDebateReply,
  warRoomDebateRound,
  warRoomDebateStart,
  type WarRoomCanvas,
  type WarRoomDebateMessage,
  type WarRoomHat,
} from '../../../lib/studentBusinessModelApi';
import imgBai from '../../../assets/images/bai.jpg';
import imgHong from '../../../assets/images/hong.jpg';
import imgHei from '../../../assets/images/hei.jpg';
import imgHuang from '../../../assets/images/huang.jpg';
import imgLv from '../../../assets/images/lv.jpg';
import imgLan from '../../../assets/images/lan.jpg';

type HatKey = Exclude<WarRoomHat, 'user'>;

const HAT_HEADER_ORDER: HatKey[] = ['white', 'red', 'black', 'yellow', 'green', 'blue'];

const hatConfig: Record<
  HatKey | 'user',
  {
    name: string;
    hatLabel: string;
    role: string;
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
    name: '白帽 - 数据分析师',
    hatLabel: '白帽',
    role: '数据分析师',
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
    name: '红帽 - 用户代表',
    hatLabel: '红帽',
    role: '用户代表',
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
    name: '黑帽 - 风险预警员',
    hatLabel: '黑帽',
    role: '风险预警员',
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
    name: '黄帽 - 乐观倡导者',
    hatLabel: '黄帽',
    role: '乐观倡导者',
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
    name: '绿帽 - 创意设计师',
    hatLabel: '绿帽',
    role: '创意设计师',
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
    name: '蓝帽 - 项目经理',
    hatLabel: '蓝帽',
    role: '项目经理',
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

function messageDelay(content: string) {
  const len = content.length;
  return Math.min(4000, Math.max(1200, 800 + len * 12));
}

type WarRoomProps = {
  classId?: string;
  studentDisplayName?: string;
};

export default function WarRoom({ classId, studentDisplayName = '同学' }: WarRoomProps) {
  const [messages, setMessages] = useState<WarRoomDebateMessage[]>([]);
  const [canvas, setCanvas] = useState<WarRoomCanvas>(emptyCanvas);
  const [filledCount, setFilledCount] = useState(0);
  const [currentSpeaker, setCurrentSpeaker] = useState<WarRoomHat | null>(null);
  const [highlightKey, setHighlightKey] = useState<string | null>(null);
  const [userInput, setUserInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isDebating, setIsDebating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollChatToBottom = useCallback(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    scrollChatToBottom();
  }, [messages, isPlaying, scrollChatToBottom]);

  const applyWorkspace = useCallback(
    (ws: Awaited<ReturnType<typeof fetchBusinessModelWorkspace>>, opts?: { syncMessages?: boolean }) => {
      const wr = ws.warRoom;
      if (wr?.canvas) setCanvas(wr.canvas);
      if (opts?.syncMessages !== false && wr?.transcript?.messages) {
        setMessages(wr.transcript.messages);
      }
      setFilledCount(wr?.filledCount ?? 0);
    },
    []
  );

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
      await delayMs(messageDelay(m.content));
      setMessages((prev) => {
        if (prev.some((x) => x.id === m.id)) return prev;
        return [...prev, m];
      });
      if (m.targetModule) highlightModule(m.targetModule);
      await delayMs(400);
      setCurrentSpeaker(null);
    }
    setIsPlaying(false);
  };

  const handleStartDebate = async () => {
    if (!classId?.trim()) {
      message.warning('缺少班级信息');
      return;
    }
    if (messages.length > 0) {
      message.info('辩论已开始，请在下方输入或 @ 某一顶帽子');
      return;
    }
    setIsDebating(true);
    try {
      const { roundMessages, workspace } = await warRoomDebateStart(classId.trim(), studentDisplayName);
      applyWorkspace(workspace, { syncMessages: false });
      await playMessagesSequential(roundMessages);
      applyWorkspace(workspace);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '开始辩论失败');
    } finally {
      setIsDebating(false);
    }
  };

  const handleSend = async () => {
    if (!classId?.trim() || !userInput.trim() || isDebating || isPlaying) return;
    if (messages.length === 0) {
      message.warning('请先点击开始辩论');
      return;
    }
    const text = userInput.trim();
    setUserInput('');
    setIsDebating(true);
    try {
      const mentioned = parseMentionedHat(text);
      if (mentioned) {
        const { message: reply, workspace } = await warRoomDebateReply(
          classId.trim(),
          studentDisplayName,
          text,
          mentioned
        );
        const prevLen = messages.length;
        applyWorkspace(workspace, { syncMessages: false });
        const userMsg = workspace.warRoom?.transcript?.messages?.[prevLen];
        const toPlay = userMsg ? [userMsg, reply] : [reply];
        await playMessagesSequential(toPlay);
        applyWorkspace(workspace);
      } else {
        const { roundMessages, workspace } = await warRoomDebateRound(
          classId.trim(),
          studentDisplayName,
          text
        );
        applyWorkspace(workspace, { syncMessages: false });
        await playMessagesSequential(roundMessages);
        applyWorkspace(workspace);
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : '发送失败');
    } finally {
      setIsDebating(false);
    }
  };

  const handleAdopt = async (msg: WarRoomDebateMessage) => {
    if (!classId?.trim() || !msg.targetModule || !msg.moduleContent?.trim()) return;
    try {
      const ws = await adoptWarRoomMessage(classId.trim(), msg.id);
      applyWorkspace(ws);
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, status: 'adopted' as const } : m))
      );
      highlightModule(msg.targetModule);
      message.success('已采纳并更新画布');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '采纳失败');
    }
  };

  const handleIgnore = (messageId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, status: 'ignored' as const } : m))
    );
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

  const insertMention = (label: string) => {
    setUserInput((prev) => (prev ? `${prev} ${label} ` : `${label} `));
    inputRef.current?.focus();
  };

  const renderMessageMeta = (msg: WarRoomDebateMessage) => {
    if (msg.hat === 'user') {
      return { ...hatConfig.user, displayName: studentDisplayName };
    }
    const cfg = hatConfig[msg.hat as HatKey];
    return { ...cfg, displayName: cfg?.name || msg.hat };
  };

  const debateStarted = messages.length > 0;

  return (
    <div className="h-[min(72vh,680px)] min-h-[480px] flex bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
      <div className="w-[42%] min-w-[320px] bg-white border-r border-gray-200 flex flex-col min-h-0">
        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-gray-900">虚拟董事会</h3>
            <button
              type="button"
              onClick={handleStartDebate}
              disabled={isDebating || isPlaying || debateStarted || loading}
              className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-all ${
                isDebating || isPlaying || debateStarted || loading
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white hover:shadow-lg cursor-pointer'
              }`}
            >
              {isDebating ? (
                <>
                  <i className="ri-loader-4-line animate-spin mr-2"></i>
                  生成中…
                </>
              ) : (
                <>
                  <i className="ri-play-line mr-2"></i>
                  开始辩论
                </>
              )}
            </button>
          </div>
          <div className="flex items-start justify-between gap-0.5">
            {HAT_HEADER_ORDER.map((hat) => {
              const cfg = hatConfig[hat];
              const active = currentSpeaker === hat;
              return (
                <button
                  key={hat}
                  type="button"
                  title={cfg.name}
                  onClick={() => insertMention(HAT_MENTION_LABELS.find((x) => x.hat === hat)?.label || `@${hat}`)}
                  className={`relative flex flex-col items-center gap-0.5 min-w-0 flex-1 transition-all duration-300 cursor-pointer ${
                    active ? 'scale-105 z-10' : 'opacity-90 hover:opacity-100'
                  }`}
                >
                  <img
                    src={cfg.avatar}
                    alt={cfg.hatLabel}
                    className={`w-11 h-11 rounded-full object-cover border-2 ${
                      active ? cfg.avatarBorderActive : cfg.avatarBorder
                    } ${active ? cfg.ringGlow : ''}`}
                  />
                  <span className={`text-[10px] font-bold leading-none ${cfg.labelColor}`}>{cfg.hatLabel}</span>
                  <span className="text-[9px] text-gray-500 leading-tight text-center w-full truncate px-0.5">
                    {cfg.role}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div ref={chatScrollRef} className="flex-1 min-h-0 overflow-y-auto py-3 px-4 space-y-3">
          {loading ? (
            <div className="text-center text-sm text-gray-400 py-8">加载中…</div>
          ) : messages.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <i className="ri-chat-3-line text-2xl text-gray-400"></i>
              </div>
              <p className="text-sm text-gray-500">点击「开始辩论」，六顶帽子将围绕商业模式展开讨论</p>
            </div>
          ) : (
            messages.map((msg) => {
              const meta = renderMessageMeta(msg);
              const canAdopt =
                msg.targetModule &&
                msg.moduleContent?.trim() &&
                !msg.status &&
                msg.hat !== 'user';
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
                      {msg.content}
                    </div>
                    {canAdopt && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <button
                          type="button"
                          onClick={() => handleAdopt(msg)}
                          className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-lg hover:bg-green-200 cursor-pointer"
                        >
                          <i className="ri-check-line mr-1"></i>
                          采纳
                        </button>
                        <button
                          type="button"
                          onClick={() => handleIgnore(msg.id)}
                          className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200 cursor-pointer"
                        >
                          忽略
                        </button>
                      </div>
                    )}
                    {msg.status === 'adopted' && (
                      <p className="mt-1 text-xs text-green-600">
                        <i className="ri-check-double-line mr-1"></i>
                        已采纳
                      </p>
                    )}
                    {msg.status === 'ignored' && (
                      <p className="mt-1 text-xs text-gray-400">已忽略</p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="p-3 border-t border-gray-200 bg-white shrink-0">
          <div className="flex flex-wrap gap-1 mb-2">
            {HAT_MENTION_LABELS.map(({ label }) => (
              <button
                key={label}
                type="button"
                onClick={() => insertMention(label)}
                className="px-2 py-0.5 text-xs rounded-md bg-gray-100 text-gray-600 hover:bg-teal-50 hover:text-teal-700 cursor-pointer"
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
              placeholder={debateStarted ? `@帽子或发表观点，未 @ 时将开启新一轮讨论` : '请先开始辩论'}
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

      <div className="flex-1 min-w-0 flex flex-col min-h-0 bg-gray-50">
        <div className="px-4 py-3 border-b border-gray-200 bg-white shrink-0 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">商业模式画布</h3>
          <span className="text-xs text-gray-500">
            已填写 {filledCount}/{WAR_ROOM_MODULE_DEFS.length}
          </span>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          <div className="grid grid-cols-3 gap-3 max-w-6xl mx-auto">
            {WAR_ROOM_MODULE_DEFS.map((mod) => {
              const cell = canvas[mod.key] || { content: '', updatedBy: '' };
              const highlighted = highlightKey === mod.key;
              return (
                <div
                  key={mod.key}
                  className={`bg-white rounded-xl p-4 transition-all duration-300 flex flex-col min-h-[140px] ${
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
                    rows={5}
                    placeholder="待填写…"
                    className="flex-1 w-full text-xs text-gray-700 border border-gray-100 rounded-lg p-2 resize-none focus:outline-none focus:ring-1 focus:ring-teal-400"
                  />
                  {cell.updatedBy ? (
                    <p className="mt-2 text-xs text-teal-600 truncate">{cell.updatedBy}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="mt-6 max-w-6xl mx-auto bg-teal-50 border border-teal-200 rounded-xl p-4 text-sm text-teal-800 space-y-1">
            <p>• 点击「开始辩论」后，将按白帽 → 四帽随机 → 蓝帽顺序讨论</p>
            <p>• 提及某模块时右侧格子会高亮；可采纳建议替换该格内容</p>
            <p>• @ 某一顶帽子单独回复；未 @ 时发送将开启新一轮六帽讨论</p>
          </div>
        </div>
      </div>
    </div>
  );
}
