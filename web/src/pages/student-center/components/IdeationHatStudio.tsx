import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Dropdown, Input, message } from 'antd';
import {
  adoptHatStudioMessage,
  analyzeStudentIdeationIdea,
  fetchHatStudio,
  hatStudioDebateReply,
  hatStudioDebateRound,
  hatStudioDebateStart,
  hatStudioReset,
  parseHatStudioMentionedHat,
  saveHatStudioDraftCell,
  type HatStudioDebateMessage,
  type HatStudioDraft,
  type HatStudioHat,
  type HatStudioPayload,
} from '../../../lib/studentIdeationApi';
import imgBai from '../../../assets/images/bai.jpg';
import imgHong from '../../../assets/images/hong.jpg';
import imgHei from '../../../assets/images/hei.jpg';
import imgHuang from '../../../assets/images/huang.jpg';
import imgLv from '../../../assets/images/lv.jpg';
import imgLan from '../../../assets/images/lan.jpg';

type HatKey = Exclude<HatStudioHat, 'user'>;

const HAT_HEADER_ORDER: HatKey[] = ['white', 'red', 'black', 'yellow', 'green', 'blue'];

const hatConfig: Record<
  HatKey | 'user',
  {
    hatLabel: string;
    role: string;
    color: string;
    textColor: string;
    borderColor: string;
    avatar: string;
  }
> = {
  white: {
    hatLabel: '白帽',
    role: '数据分析师',
    color: 'bg-gray-100',
    textColor: 'text-gray-900',
    borderColor: 'border-gray-300',
    avatar: imgBai,
  },
  red: {
    hatLabel: '红帽',
    role: '用户代表',
    color: 'bg-red-100',
    textColor: 'text-red-900',
    borderColor: 'border-red-300',
    avatar: imgHong,
  },
  black: {
    hatLabel: '黑帽',
    role: '风险预警员',
    color: 'bg-gray-900',
    textColor: 'text-white',
    borderColor: 'border-gray-700',
    avatar: imgHei,
  },
  yellow: {
    hatLabel: '黄帽',
    role: '乐观倡导者',
    color: 'bg-amber-100',
    textColor: 'text-amber-900',
    borderColor: 'border-amber-300',
    avatar: imgHuang,
  },
  green: {
    hatLabel: '绿帽',
    role: '创意设计师',
    color: 'bg-emerald-100',
    textColor: 'text-emerald-900',
    borderColor: 'border-emerald-300',
    avatar: imgLv,
  },
  blue: {
    hatLabel: '蓝帽',
    role: '项目经理',
    color: 'bg-sky-100',
    textColor: 'text-sky-900',
    borderColor: 'border-sky-300',
    avatar: imgLan,
  },
  user: {
    hatLabel: '我',
    role: '学生',
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

type Props = {
  classId: string;
  studentDisplayName?: string;
  disabled?: boolean;
  onIdeaCreated?: () => void;
};

/**
 * 六帽创想室：多轮六帽讨论 + 工作区采纳，最终入库团队创意库
 */
export default function IdeationHatStudio({
  classId,
  studentDisplayName = '同学',
  disabled = false,
  onIdeaCreated,
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
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const applyStudio = useCallback((studio: HatStudioPayload, opts?: { syncMessages?: boolean }) => {
    setDraft(studio.draft || emptyDraft(studio.draftDefs || []));
    setDraftDefs(studio.draftDefs || []);
    setFilledCount(studio.filledCount || 0);
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

  const handleStart = async () => {
    if (!classId?.trim() || disabled) return;
    if (messages.length > 0) {
      message.info('当前已有会话，可继续发言；若要重来请点「清空重开」');
      return;
    }
    setIsDebating(true);
    try {
      // 仅插入引导语，不立刻跑六帽；等学生发送创意后再引导
      const { roundMessages, studio } = await hatStudioDebateStart(classId.trim(), studentDisplayName);
      applyStudio(studio, { syncMessages: false });
      setMessages(roundMessages);
      await refresh();
      message.success('请先描述创意，再点「发送发言」');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '开始讨论失败');
    } finally {
      setIsDebating(false);
    }
  };

  const handleReset = async () => {
    if (!classId?.trim() || disabled) return;
    setResetting(true);
    try {
      const { roundMessages, studio } = await hatStudioReset(classId.trim(), studentDisplayName);
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

  const handleSend = async () => {
    if (!classId?.trim() || !userInput.trim() || isDebating || isPlaying || disabled) return;
    if (messages.length === 0) {
      message.warning('请先点击开始讨论');
      return;
    }
    const text = userInput.trim();
    if (awaitingStudentIdea && text.length < 10) {
      message.warning('请尽量完整描述你的创意（问题、用户、方案等），便于六帽引导');
      return;
    }
    // 首次描述创意时不允许只 @帽子而不谈想法
    if (awaitingStudentIdea && parseHatStudioMentionedHat(text) && text.replace(/@\S+/g, '').trim().length < 8) {
      message.warning('请先描述你的创意内容，再 @ 某一顶帽子追问');
      return;
    }
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
      const mentioned = parseHatStudioMentionedHat(text);
      if (mentioned && !awaitingStudentIdea) {
        const { message: reply, studio } = await hatStudioDebateReply(
          classId.trim(),
          studentDisplayName,
          text,
          mentioned
        );
        applyStudio(studio, { syncMessages: false });
        const serverUser = studio.transcript?.messages?.[prevLen];
        setMessages((prev) => {
          const base = prev.filter((m) => m.id !== tempId);
          if (serverUser?.hat === 'user' && !base.some((m) => m.id === serverUser.id)) {
            base.push(serverUser);
          }
          return base;
        });
        await playMessagesSequential([reply]);
        await refresh();
      } else {
        // 不 @：整轮六帽；首次发送创意也走此路径（带完整历史上下文）
        const { roundMessages, studio } = await hatStudioDebateRound(
          classId.trim(),
          studentDisplayName,
          text
        );
        applyStudio(studio, { syncMessages: false });
        const serverUser = studio.transcript?.messages?.[prevLen];
        setMessages((prev) => {
          const base = prev.filter((m) => m.id !== tempId);
          if (serverUser?.hat === 'user' && !base.some((m) => m.id === serverUser.id)) {
            base.push(serverUser);
          }
          return base;
        });
        await playMessagesSequential(roundMessages.filter((m) => m.hat !== 'user'));
        await refresh();
      }
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setUserInput(text);
      message.error(e instanceof Error ? e.message : '发送失败');
    } finally {
      setIsDebating(false);
    }
  };

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

  const insertMention = (hat: HatKey) => {
    const label = hatConfig[hat].hatLabel;
    setUserInput((prev) => {
      const t = prev.trim();
      return t ? `${t} @${label} ` : `@${label} `;
    });
  };

  return (
    <div className="space-y-4">
      <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
        <h4 className="text-sm font-bold text-violet-900 mb-1">六帽创想室</h4>
        <p className="text-xs text-violet-700">
          ① 开始六帽讨论 → ② 描述创意并「发送发言」→ ③ 六帽引导多轮对话（可 @ 或不 @）→ ④ 写入右侧工作区 → ⑤ AI 汇总并入库。可随时「清空重开」。
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {HAT_HEADER_ORDER.map((h) => {
          const cfg = hatConfig[h];
          const active = currentSpeaker === h;
          return (
            <button
              key={h}
              type="button"
              disabled={disabled || isDebating || isPlaying || awaitingStudentIdea || messages.length === 0}
              onClick={() => insertMention(h)}
              className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs transition-all cursor-pointer ${
                active ? 'ring-2 ring-violet-300 border-violet-400' : cfg.borderColor
              } ${cfg.color} ${cfg.textColor} ${awaitingStudentIdea || messages.length === 0 ? 'opacity-50' : ''}`}
              title={awaitingStudentIdea ? '请先发送你的创意后再 @ 帽子' : `@${cfg.hatLabel}`}
            >
              <img src={cfg.avatar} alt="" className="w-7 h-7 rounded-full object-cover" />
              <span className="font-semibold whitespace-nowrap">{cfg.hatLabel}</span>
            </button>
          );
        })}
      </div>

      {/*
        视口高度锁定双栏：消息/工作区各自内部滚动，底栏同高对齐；
        聊天再多也不撑高整页。
      */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:h-[calc(100dvh-15rem)] lg:min-h-[420px] lg:max-h-[720px]">
        <div className="lg:col-span-3 flex flex-col h-[min(58dvh,520px)] lg:h-full rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-semibold text-gray-800">讨论区</span>
              {messages.length > 0 ? (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100 whitespace-nowrap">
                  会话进行中
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {messages.length > 0 ? (
                <Button
                  size="small"
                  danger
                  loading={resetting}
                  disabled={disabled || isDebating || isPlaying}
                  onClick={() => void handleReset()}
                >
                  清空重开
                </Button>
              ) : (
                <Button
                  size="small"
                  type="primary"
                  className="!bg-violet-600 !border-violet-600"
                  loading={isDebating}
                  disabled={disabled || loading || isPlaying}
                  onClick={() => void handleStart()}
                >
                  开始六帽讨论
                </Button>
              )}
            </div>
          </div>
          <div ref={chatScrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 space-y-3">
            {loading && <div className="text-sm text-gray-400 text-center py-8">加载中…</div>}
            {!loading && messages.length === 0 && (
              <div className="text-sm text-gray-400 text-center py-10">
                点击「开始讨论」，系统会引导你先输入创意想法
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
                {awaitingStudentIdea ? '等待你的创意描述…' : '六帽正在根据你的内容引导讨论…'}
              </div>
            )}
          </div>
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
        </div>

        <div className="lg:col-span-2 flex flex-col h-[min(58dvh,520px)] lg:h-full rounded-xl border border-gray-200 bg-white overflow-hidden">
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
