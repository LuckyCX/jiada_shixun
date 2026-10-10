import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button, Modal, Spin, Upload, message } from 'antd';
import type { UploadFile } from 'antd';
import RichTextEditor from '../../../../../components/RichTextEditor';
import {
  acquireBusinessPlanSectionLock,
  BusinessPlanConflictError,
  fetchBusinessPlanEntry,
  fetchBusinessPlanWorkspace,
  fillBusinessPlanSection,
  generateBusinessPlanOutline,
  heartbeatBusinessPlanSectionLock,
  releaseBusinessPlanSectionLock,
  saveBusinessPlanWorkspace,
  submitBusinessPlan,
  type BusinessPlanClassMeta,
  type BusinessPlanSection,
  type BusinessPlanSectionLock,
  type BusinessPlanTeamMember,
  type BusinessPlanWorkspace,
} from '../demoPlanApi';
import { downloadBusinessPlanDocx } from '../../../../../lib/businessPlanDocxExport';
import {
  BUSINESS_PLAN_RUBRIC_DIMENSIONS,
  BUSINESS_PLAN_SECTION_DEFS,
  BUSINESS_PLAN_SECTION_GROUPS,
  SHOW_BP_AI_FILL,
  SHOW_BP_STRUCTURE_TOOLS,
  defaultCover,
  guideForSectionKey,
  type BusinessPlanCover,
} from '../../../../../lib/businessPlanTemplate';

function withClassMetaCover(cover: BusinessPlanCover, classMeta?: BusinessPlanClassMeta | null): BusinessPlanCover {
  const now = new Date();
  return {
    ...cover,
    collegeClass: String(classMeta?.collegeClass || cover.collegeClass || '').trim(),
    advisor: String(classMeta?.advisor || cover.advisor || '').trim(),
    dateYear: String(now.getFullYear()),
    dateMonth: String(now.getMonth() + 1),
    dateDay: String(now.getDate()),
  };
}

function formatCoverDate(cover: BusinessPlanCover) {
  const y = cover.dateYear || String(new Date().getFullYear());
  const m = cover.dateMonth || String(new Date().getMonth() + 1);
  const d = cover.dateDay || String(new Date().getDate());
  return `${y}年${m}月${d}日`;
}

function CoverFieldCard({
  label,
  value,
  wide,
  children,
}: {
  label: string;
  value?: string;
  wide?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border border-violet-100 bg-white px-4 py-3 shadow-sm ${
        wide ? 'md:col-span-2' : ''
      }`}
    >
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      {children ?? (
        <div className="text-sm font-semibold text-gray-900 break-words whitespace-pre-wrap">
          {value?.trim() ? value : '—'}
        </div>
      )}
    </div>
  );
}

/** 教师审核后的分项得分展示 */
function ReviewScorePanel({
  scores,
  totalScore,
  reviewComment,
}: {
  scores?: Record<string, number> | null;
  totalScore?: number | null;
  reviewComment?: string;
}) {
  if (totalScore == null && !scores) return null;
  return (
    <div className="bg-white border border-indigo-100 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-bold text-gray-900 m-0">教师评分</h3>
        {totalScore != null ? (
          <span className="text-sm font-bold text-indigo-700">总分 {totalScore}</span>
        ) : null}
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        {BUSINESS_PLAN_RUBRIC_DIMENSIONS.map((d) => (
          <div
            key={d.key}
            className="flex items-center justify-between gap-2 rounded-xl bg-gray-50 border border-gray-100 px-3 py-2 text-xs"
          >
            <span className="text-gray-600">{d.title}</span>
            <span className="font-semibold text-gray-900 shrink-0">
              {scores && scores[d.key] != null ? scores[d.key] : '—'}
              <span className="text-gray-400 font-normal">/{d.max}</span>
            </span>
          </div>
        ))}
      </div>
      {reviewComment ? (
        <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap border-t border-gray-100 pt-3">
          {reviewComment}
        </div>
      ) : null}
    </div>
  );
}

type BusinessPlanModuleProps = {
  classId?: string;
  isTeamLeader?: boolean;
  studentDisplayName?: string;
  teamMemberCount?: number;
  onTaskComplete?: () => void;
  onTrainingEnded?: () => void;
};

const DEFAULT_SECTION_DEFS = BUSINESS_PLAN_SECTION_DEFS.map((d) => ({
  key: d.key,
  title: d.title,
  guide: d.guide,
}));

const COLLAB_TICK_MS = 5000;

function stripHtml(s: string) {
  return String(s || '').replace(/<[^>]+>/g, '').trim();
}

/** AI 常返回纯文本/Markdown，富文本编辑器需要 HTML */
function ensureEditorHtml(raw: string) {
  const s = String(raw || '');
  if (!s.trim()) return '';
  if (/<[a-z][\s\S]*>/i.test(s)) return s;
  return s
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

function sectionsHaveContent(secs: BusinessPlanSection[]) {
  return (secs || []).some((s) => stripHtml(s.content).length > 0);
}

export default function BusinessPlanModule({
  classId,
  isTeamLeader = false,
  studentDisplayName = '同学',
  teamMemberCount = 0,
  onTaskComplete,
  onTrainingEnded,
}: BusinessPlanModuleProps) {
  const serializeSections = useCallback((secs: BusinessPlanSection[]) => {
    return JSON.stringify(
      (secs || []).map((s) => ({
        key: String(s.key || ''),
        title: String(s.title || ''),
        content: String(s.content || ''),
      }))
    );
  }, []);

  const studentId = useMemo(() => 'demo-student', []);

  const [activeTab, setActiveTab] = useState<'plan' | 'submit'>('plan');
  const [entryAllowed, setEntryAllowed] = useState<boolean | null>(null);
  const [entryHint, setEntryHint] = useState('');
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState<BusinessPlanWorkspace | null>(null);
  const [sections, setSections] = useState<BusinessPlanSection[]>([]);
  const [cover, setCover] = useState<BusinessPlanCover>(() => defaultCover());
  const [classMeta, setClassMeta] = useState<BusinessPlanClassMeta | null>(null);
  const [teamMembers, setTeamMembers] = useState<BusinessPlanTeamMember[]>([]);
  const [isSoloTeam, setIsSoloTeam] = useState(false);
  const [projectNameLocked, setProjectNameLocked] = useState(false);
  const [draftProjectName, setDraftProjectName] = useState('');
  const [savingCover, setSavingCover] = useState(false);
  const [revision, setRevision] = useState(1);
  const [locks, setLocks] = useState<BusinessPlanSectionLock[]>([]);
  const [activeSectionKey, setActiveSectionKey] = useState('');
  const [holdingLockKey, setHoldingLockKey] = useState<string | null>(null);
  const [lockBlockedHint, setLockBlockedHint] = useState('');
  const [fullScreen, setFullScreen] = useState(false);
  const [fillingSection, setFillingSection] = useState(false);
  const [generatingOutline, setGeneratingOutline] = useState(false);
  const [outlineModalOpen, setOutlineModalOpen] = useState(false);
  const [fillModalOpen, setFillModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitPptFiles, setSubmitPptFiles] = useState<UploadFile[]>([]);
  const [submitOptionalFiles, setSubmitOptionalFiles] = useState<UploadFile[]>([]);
  const [savingDraft, setSavingDraft] = useState(false);
  const [editingTitleKey, setEditingTitleKey] = useState<string | null>(null);
  const [editorDraftHtml, setEditorDraftHtml] = useState('');
  const editorDraftHtmlRef = useRef('');
  const [editorContentEpoch, setEditorContentEpoch] = useState(0);
  const [lastSavedSerialized, setLastSavedSerialized] = useState('');
  const holdingLockKeyRef = useRef<string | null>(null);
  const activeSectionKeyRef = useRef('');
  const revisionRef = useRef(1);
  const savingRef = useRef(false);
  const fillingRef = useRef(false);
  const blurReleaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressBlurReleaseRef = useRef(false);
  /** 切章时锁定窗口滚动，避免编辑器销毁/重建把页面顶下去 */
  const pendingScrollYRef = useRef<number | null>(null);

  const readOnly = Boolean(workspace?.readOnly);

  const restorePendingScroll = useCallback(() => {
    const y = pendingScrollYRef.current;
    if (y == null) return;
    window.scrollTo({ top: y, left: 0, behavior: 'auto' });
  }, []);

  useEffect(() => {
    holdingLockKeyRef.current = holdingLockKey;
  }, [holdingLockKey]);
  useEffect(() => {
    activeSectionKeyRef.current = activeSectionKey;
  }, [activeSectionKey]);
  useEffect(() => {
    revisionRef.current = revision;
  }, [revision]);

  const applyWorkspace = useCallback(
    (
      ws: BusinessPlanWorkspace,
      opts?: { markSaved?: boolean; preserveLocalSectionKey?: string | null; localSections?: BusinessPlanSection[] }
    ) => {
      const markSaved = opts?.markSaved !== false;
      const nextRevision = Number(ws.revision || 1);
      // 立即同步 ref，避免 AI 填充/保存后定时任务仍带旧 revision 触发 409
      revisionRef.current = nextRevision;
      setWorkspace(ws);
      setRevision(nextRevision);
      setLocks(Array.isArray(ws.locks) ? ws.locks : []);
      if (ws.classMeta) setClassMeta(ws.classMeta);
      if (Array.isArray(ws.teamMembers)) setTeamMembers(ws.teamMembers);
      setIsSoloTeam(Boolean(ws.isSolo) || (ws.teamMemberCount || 0) <= 1);
      const locked = Boolean(ws.projectNameLocked || String(ws.topicProjectName || '').trim());
      setProjectNameLocked(locked);
      if (ws.cover) {
        const nextCover = withClassMetaCover(
          {
            ...defaultCover(),
            ...ws.cover,
            members: Array.isArray(ws.cover.members) ? [...ws.cover.members] : [],
            projectName: locked
              ? String(ws.topicProjectName || ws.cover.projectName || '').trim()
              : String(ws.cover.projectName || '').trim(),
          },
          ws.classMeta
        );
        setCover(nextCover);
        setDraftProjectName(nextCover.projectName);
      }
      const remoteSecs = ws.sections.length
        ? ws.sections
        : DEFAULT_SECTION_DEFS.map((d) => ({ ...d, content: '' }));
      const preserveKey = opts?.preserveLocalSectionKey;
      const localSecs = opts?.localSections;
      let nextSecs = remoteSecs;
      if (preserveKey && localSecs) {
        const local = localSecs.find((s) => s.key === preserveKey);
        if (local) {
          nextSecs = remoteSecs.map((s) => (s.key === preserveKey ? { ...s, title: local.title, content: local.content } : s));
          if (!nextSecs.some((s) => s.key === preserveKey)) nextSecs = [...nextSecs, local];
        }
      }
      setSections(nextSecs);
      if (markSaved) setLastSavedSerialized(serializeSections(nextSecs));
      setActiveSectionKey((prev) => {
        if (prev && nextSecs.some((s) => s.key === prev)) return prev;
        return nextSecs[0]?.key || '';
      });
    },
    [serializeSections]
  );

  const loadWorkspace = useCallback(async () => {
    if (!classId) return;
    const ws = await fetchBusinessPlanWorkspace(classId);
    applyWorkspace(ws, { markSaved: true });
  }, [applyWorkspace, classId]);

  useEffect(() => {
    if (!classId) {
      setLoading(false);
      setEntryAllowed(false);
      setEntryHint('请先加入教学班级并完成组队');
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const entry = await fetchBusinessPlanEntry(classId);
        if (cancelled) return;
        setEntryAllowed(entry.allowed);
        if (!entry.allowed) {
          setEntryHint(entry.summary || '请先完成关联课程学习及知识点检测后再开始撰写商业计划书。');
          return;
        }
        await loadWorkspace();
      } catch (e) {
        if (!cancelled) {
          setEntryAllowed(false);
          setEntryHint(e instanceof Error ? e.message : '加载失败');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [classId, loadWorkspace]);

  const activeSection = sections.find((s) => s.key === activeSectionKey) || sections[0];

  const handleEditorChange = useCallback((v: string) => {
    editorDraftHtmlRef.current = v;
    setEditorDraftHtml(v);
  }, []);

  const getSectionsSnapshotWithDraft = useCallback((): BusinessPlanSection[] => {
    if (!activeSectionKey) return sections;
    const html = editorDraftHtmlRef.current;
    return sections.map((s) => (s.key === activeSectionKey ? { ...s, content: html } : s));
  }, [activeSectionKey, sections]);

  const sectionsWithDraft = useMemo(
    () => getSectionsSnapshotWithDraft(),
    [getSectionsSnapshotWithDraft, editorDraftHtml, sections, activeSectionKey]
  );

  const sectionTotal = sectionsWithDraft.length;
  const completedCount = useMemo(
    () => sectionsWithDraft.filter((s) => stripHtml(s.content).length > 0).length,
    [sectionsWithDraft]
  );
  const sectionProgressPercent = sectionTotal > 0 ? Math.round((completedCount / sectionTotal) * 100) : 0;
  const totalChars = useMemo(
    () => sectionsWithDraft.reduce((n, s) => n + stripHtml(s.content).length, 0),
    [sectionsWithDraft]
  );
  const isDirty = useMemo(() => {
    return serializeSections(getSectionsSnapshotWithDraft()) !== lastSavedSerialized;
  }, [getSectionsSnapshotWithDraft, lastSavedSerialized, serializeSections]);

  const flushDraftToSections = useCallback(() => {
    if (!activeSectionKey) return;
    const html = editorDraftHtmlRef.current;
    setSections((prev) => prev.map((s) => (s.key === activeSectionKey ? { ...s, content: html } : s)));
  }, [activeSectionKey]);

  useEffect(() => {
    const sec = sections.find((s) => s.key === activeSectionKey);
    const v = String(sec?.content || '');
    editorDraftHtmlRef.current = v;
    setEditorDraftHtml(v);
  }, [activeSectionKey]); // 切章时同步正文；持锁编辑过程中不因远端刷新重置

  const lockOf = useCallback(
    (key: string) => locks.find((l) => l.sectionKey === key) || null,
    [locks]
  );

  const canEditActive = Boolean(
    !readOnly && holdingLockKey && holdingLockKey === activeSectionKey
  );

  const activeForeignLock = useMemo(() => {
    const lock = lockOf(activeSectionKey);
    if (!lock) return null;
    if (String(lock.lockedById) === String(studentId)) return null;
    return lock;
  }, [activeSectionKey, lockOf, studentId]);

  const handleConflict = useCallback(
    (e: unknown, opts?: { soft?: boolean }) => {
      if (e instanceof BusinessPlanConflictError) {
        if (e.workspace) {
          applyWorkspace(e.workspace, {
            markSaved: true,
            preserveLocalSectionKey: holdingLockKeyRef.current,
            localSections: getSectionsSnapshotWithDraft(),
          });
        }
        if (e.lock && String(e.lock.lockedById) !== String(studentId)) {
          setHoldingLockKey(null);
          setLockBlockedHint(`章节已被 ${e.lock.lockedByName} 编辑中，已切换为只读`);
        }
        if (!opts?.soft) message.warning(e.message);
        return true;
      }
      return false;
    },
    [applyWorkspace, getSectionsSnapshotWithDraft, studentId]
  );

  const saveActiveSection = useCallback(
    async (opts?: { silent?: boolean; releaseAfter?: boolean }) => {
      if (!classId || readOnly) return false;
      const key = holdingLockKeyRef.current || activeSectionKeyRef.current;
      if (!key || holdingLockKeyRef.current !== key) {
        if (!opts?.silent) message.info('请先点击编辑器进入编辑态后再保存');
        return false;
      }
      if (savingRef.current) return false;
      savingRef.current = true;
      if (!opts?.silent) setSavingDraft(true);

      const doSave = async () => {
        const snapshot = getSectionsSnapshotWithDraft();
        const ws = await saveBusinessPlanWorkspace(classId, {
          sections: snapshot,
          revision: revisionRef.current,
          activeSectionKey: key,
        });
        applyWorkspace(ws, { markSaved: true });
        return ws;
      };

      try {
        await doSave();
        if (!opts?.silent) message.success('已保存');
        if (opts?.releaseAfter) {
          try {
            await releaseBusinessPlanSectionLock(classId, key);
          } catch {
            /* ignore */
          }
          setHoldingLockKey(null);
        }
        return true;
      } catch (e) {
        // AI 填充/并发心跳后本地 revision 偶发滞后：同步最新版后自动重试一次
        if (e instanceof BusinessPlanConflictError && e.workspace && holdingLockKeyRef.current === key) {
          applyWorkspace(e.workspace, {
            markSaved: false,
            preserveLocalSectionKey: key,
            localSections: getSectionsSnapshotWithDraft(),
          });
          try {
            await doSave();
            if (!opts?.silent) message.success('已保存');
            if (opts?.releaseAfter) {
              try {
                await releaseBusinessPlanSectionLock(classId, key);
              } catch {
                /* ignore */
              }
              setHoldingLockKey(null);
            }
            return true;
          } catch (e2) {
            if (!handleConflict(e2, { soft: opts?.silent })) {
              if (!opts?.silent) message.error(e2 instanceof Error ? e2.message : '保存失败');
            } else if (!opts?.silent) {
              message.warning('文档版本已更新，请确认内容后再保存');
            }
            return false;
          }
        }
        if (!handleConflict(e, { soft: opts?.silent })) {
          if (!opts?.silent) message.error(e instanceof Error ? e.message : '保存失败');
        }
        return false;
      } finally {
        savingRef.current = false;
        if (!opts?.silent) setSavingDraft(false);
      }
    },
    [applyWorkspace, classId, getSectionsSnapshotWithDraft, handleConflict, readOnly]
  );

  const acquireLockFor = useCallback(
    async (sectionKey: string) => {
      if (!classId || readOnly || !sectionKey) return;
      try {
        const res = await acquireBusinessPlanSectionLock(classId, sectionKey);
        setHoldingLockKey(sectionKey);
        setLockBlockedHint('');
        if (res.workspace) {
          applyWorkspace(res.workspace, {
            markSaved: false,
            preserveLocalSectionKey: sectionKey,
            localSections: getSectionsSnapshotWithDraft(),
          });
        }
      } catch (e) {
        setHoldingLockKey(null);
        if (e instanceof BusinessPlanConflictError) {
          setLockBlockedHint(e.message);
          handleConflict(e, { soft: true });
          message.warning(e.message);
          return;
        }
        message.error(e instanceof Error ? e.message : '锁定章节失败');
      }
    },
    [applyWorkspace, classId, getSectionsSnapshotWithDraft, handleConflict, readOnly]
  );

  // 同步只读内容：未持锁时，当远端同章更新则刷新编辑器展示
  useEffect(() => {
    if (holdingLockKey === activeSectionKey) return;
    const sec = sections.find((s) => s.key === activeSectionKey);
    const v = String(sec?.content || '');
    if (v === editorDraftHtmlRef.current) return;
    editorDraftHtmlRef.current = v;
    setEditorDraftHtml(v);
  }, [sections, activeSectionKey, holdingLockKey]);

  const onEditorFocus = useCallback(() => {
    if (blurReleaseTimerRef.current) {
      clearTimeout(blurReleaseTimerRef.current);
      blurReleaseTimerRef.current = null;
    }
    if (readOnly || !activeSectionKey) return;
    void acquireLockFor(activeSectionKey);
  }, [acquireLockFor, activeSectionKey, readOnly]);

  const onEditorBlur = useCallback(() => {
    // CKEditor 工具栏 / 弹窗按钮点击也会 blur，短暂延迟；弹窗打开期间不放锁
    if (blurReleaseTimerRef.current) clearTimeout(blurReleaseTimerRef.current);
    blurReleaseTimerRef.current = setTimeout(() => {
      blurReleaseTimerRef.current = null;
      if (suppressBlurReleaseRef.current) return;
      const key = holdingLockKeyRef.current;
      if (!key) return;
      void (async () => {
        await saveActiveSection({ silent: true, releaseAfter: true });
      })();
    }, 250);
  }, [saveActiveSection]);

  /** 打开 AI 弹窗前：取消失焦放锁，并确保已锁定当前章 */
  const openFillModal = useCallback(async () => {
    if (!classId || readOnly || !activeSectionKey) return;
    if (activeForeignLock) {
      message.warning(`章节已被 ${activeForeignLock.lockedByName} 编辑中，无法填充`);
      return;
    }
    if (blurReleaseTimerRef.current) {
      clearTimeout(blurReleaseTimerRef.current);
      blurReleaseTimerRef.current = null;
    }
    suppressBlurReleaseRef.current = true;
    if (holdingLockKeyRef.current !== activeSectionKey) {
      try {
        const res = await acquireBusinessPlanSectionLock(classId, activeSectionKey);
        setHoldingLockKey(activeSectionKey);
        setLockBlockedHint('');
        if (res.workspace) {
          applyWorkspace(res.workspace, {
            markSaved: false,
            preserveLocalSectionKey: activeSectionKey,
            localSections: getSectionsSnapshotWithDraft(),
          });
        }
      } catch (e) {
        suppressBlurReleaseRef.current = false;
        if (!handleConflict(e)) message.error(e instanceof Error ? e.message : '锁定章节失败');
        return;
      }
    }
    setFillModalOpen(true);
  }, [
    activeForeignLock,
    activeSectionKey,
    applyWorkspace,
    classId,
    getSectionsSnapshotWithDraft,
    handleConflict,
    readOnly,
  ]);

  useEffect(() => {
    suppressBlurReleaseRef.current = fillModalOpen || outlineModalOpen;
    if (fillModalOpen || outlineModalOpen) {
      if (blurReleaseTimerRef.current) {
        clearTimeout(blurReleaseTimerRef.current);
        blurReleaseTimerRef.current = null;
      }
    }
  }, [fillModalOpen, outlineModalOpen]);

  // 5s：持锁续租+自动保存；未持锁则拉取同步
  useEffect(() => {
    if (!classId || readOnly || activeTab !== 'plan') return;
    const timer = setInterval(() => {
      void (async () => {
        if (fillingRef.current || savingRef.current || suppressBlurReleaseRef.current) return;
        const held = holdingLockKeyRef.current;
        if (held) {
          try {
            const hb = await heartbeatBusinessPlanSectionLock(classId, held);
            if (hb.workspace) {
              applyWorkspace(hb.workspace, {
                markSaved: false,
                preserveLocalSectionKey: held,
                localSections: getSectionsSnapshotWithDraft(),
              });
            }
          } catch (e) {
            handleConflict(e, { soft: true });
            setHoldingLockKey(null);
            return;
          }
          const snapshot = getSectionsSnapshotWithDraft();
          if (serializeSections(snapshot) !== lastSavedSerialized) {
            await saveActiveSection({ silent: true });
          }
          return;
        }
        // 只读同步
        try {
          const ws = await fetchBusinessPlanWorkspace(classId);
          applyWorkspace(ws, {
            markSaved: true,
            preserveLocalSectionKey: null,
          });
          const lock = (ws.locks || []).find((l) => l.sectionKey === activeSectionKeyRef.current);
          if (lock && String(lock.lockedById) !== String(studentId)) {
            setLockBlockedHint(`章节已被 ${lock.lockedByName} 编辑中，只读同步中…`);
          } else if (!holdingLockKeyRef.current) {
            setLockBlockedHint('');
          }
        } catch {
          /* ignore poll errors */
        }
      })();
    }, COLLAB_TICK_MS);
    return () => clearInterval(timer);
  }, [
    activeTab,
    applyWorkspace,
    classId,
    getSectionsSnapshotWithDraft,
    handleConflict,
    lastSavedSerialized,
    readOnly,
    saveActiveSection,
    serializeSections,
    studentId,
  ]);

  // 离开页面释放锁
  useEffect(() => {
    if (!classId) return;
    const onUnload = () => {
      // 演示锁只在 session 里，离开页面不请求学生接口。
      holdingLockKeyRef.current = '';
    };
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      onUnload();
    };
  }, [classId]);

  const exportDocx = useCallback(
    (secs?: BusinessPlanSection[]) => {
      const snapshot = secs || getSectionsSnapshotWithDraft();
      const byKey = new Map(BUSINESS_PLAN_SECTION_DEFS.map((d) => [d.key, d.groupKey]));
      downloadBusinessPlanDocx(
        snapshot.map((s) => ({
          key: s.key,
          title: s.title,
          content: s.content,
          groupKey: byKey.get(s.key as (typeof BUSINESS_PLAN_SECTION_DEFS)[number]['key']),
        })),
        '商业计划书.docx',
        withClassMetaCover(cover, classMeta)
      );
      message.success('已导出 Word（docx）');
    },
    [getSectionsSnapshotWithDraft, cover, classMeta]
  );

  const saveCoverOnly = async () => {
    if (!classId || readOnly || projectNameLocked) return;
    const name = draftProjectName.trim();
    if (!name) {
      message.warning('请填写小组项目名称');
      return;
    }
    setSavingCover(true);
    try {
      const payloadCover = withClassMetaCover({ ...cover, projectName: name }, classMeta);
      const ws = await saveBusinessPlanWorkspace(classId, {
        revision: revisionRef.current,
        cover: payloadCover,
      });
      applyWorkspace(ws, { markSaved: true });
      message.success('项目名称已保存');
    } catch (e) {
      if (!handleConflict(e)) message.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSavingCover(false);
    }
  };

  const memberSlotCount = useMemo(() => {
    if (isSoloTeam) return 0;
    if (teamMembers.length > 0) return teamMembers.filter((m) => !m.isLeader).length;
    return Array.isArray(cover.members) ? cover.members.length : 0;
  }, [isSoloTeam, teamMembers, cover.members]);

  const addSection = () => {
    if (holdingLockKey) {
      message.info('请先退出当前章节编辑后再新增章节');
      return;
    }
    const key = `sec_${Date.now()}`;
    setSections((prev) => [...prev, { key, title: `新章节${prev.length + 1}`, content: '' }]);
    setActiveSectionKey(key);
    setEditingTitleKey(key);
  };

  const deleteSection = (key: string) => {
    setSections((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((s) => s.key !== key);
      if (activeSectionKey === key) setActiveSectionKey(next[0]?.key || '');
      return next;
    });
  };

  const moveSection = (key: string, dir: 'up' | 'down') => {
    setSections((prev) => {
      const idx = prev.findIndex((s) => s.key === key);
      if (idx < 0) return prev;
      const target = dir === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = prev.slice();
      const tmp = next[idx];
      next[idx] = next[target];
      next[target] = tmp;
      return next;
    });
  };

  const switchSection = async (nextKey: string) => {
    if (nextKey === activeSectionKey) return;
    // 侧栏切章时取消 blur 延迟放锁，避免与本次保存竞态
    if (blurReleaseTimerRef.current) {
      clearTimeout(blurReleaseTimerRef.current);
      blurReleaseTimerRef.current = null;
    }
    pendingScrollYRef.current = window.scrollY;
    flushDraftToSections();
    const held = holdingLockKeyRef.current;
    if (held) {
      await saveActiveSection({ silent: true, releaseAfter: true });
    }
    setActiveSectionKey(nextKey);
    setLockBlockedHint('');
    restorePendingScroll();
  };

  // 切章后编辑器重建可能再次带动滚动，布局完成后多拍几次复位
  useLayoutEffect(() => {
    if (pendingScrollYRef.current == null) return;
    restorePendingScroll();
    const raf = requestAnimationFrame(() => restorePendingScroll());
    const t = window.setTimeout(() => {
      restorePendingScroll();
      pendingScrollYRef.current = null;
    }, 80);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, [activeSectionKey, holdingLockKey, restorePendingScroll]);

  const confirmGenerateOutline = async () => {
    if (!classId || readOnly) return;
    setGeneratingOutline(true);
    try {
      if (holdingLockKeyRef.current) {
        await saveActiveSection({ silent: true, releaseAfter: true });
      }
      const ws = await generateBusinessPlanOutline(classId, revisionRef.current);
      applyWorkspace(ws, { markSaved: true });
      setOutlineModalOpen(false);
      message.success('已根据项目生成章节结构，可逐章填写或使用 AI 填充');
    } catch (e) {
      if (!handleConflict(e)) message.error(e instanceof Error ? e.message : '生成章节失败');
    } finally {
      setGeneratingOutline(false);
    }
  };

  const confirmFillActiveSection = async () => {
    if (!classId || readOnly) return;
    const sec = activeSection;
    if (!sec?.key) {
      message.info('请先选择章节');
      return;
    }
    // 弹窗可能已导致失焦；确认前再次确保持锁
    if (holdingLockKeyRef.current !== sec.key) {
      try {
        const res = await acquireBusinessPlanSectionLock(classId, sec.key);
        setHoldingLockKey(sec.key);
        if (res.workspace) {
          applyWorkspace(res.workspace, {
            markSaved: false,
            preserveLocalSectionKey: sec.key,
            localSections: getSectionsSnapshotWithDraft(),
          });
        }
      } catch (e) {
        if (!handleConflict(e)) message.error(e instanceof Error ? e.message : '锁定章节失败');
        return;
      }
    }
    const currentTextLen = stripHtml(String(editorDraftHtmlRef.current || sec.content || '')).length;
    const mode: 'overwrite' | 'expand' = currentTextLen > 0 ? 'expand' : 'overwrite';
    setFillingSection(true);
    fillingRef.current = true;
    try {
      const snapshot = getSectionsSnapshotWithDraft();
      const ws = await fillBusinessPlanSection(classId, {
        sectionKey: sec.key,
        mode,
        sections: snapshot,
        revision: revisionRef.current,
      });
      const filled = (ws.sections || []).find((s) => s.key === sec.key);
      const nextHtml = ensureEditorHtml(String(filled?.content || ''));
      const patched: BusinessPlanWorkspace = {
        ...ws,
        sections: (ws.sections || []).map((s) =>
          s.key === sec.key ? { ...s, content: nextHtml } : s
        ),
      };
      // 先回填再关弹窗，避免关弹窗后 remount 触发 blur 放锁
      suppressBlurReleaseRef.current = true;
      applyWorkspace(patched, { markSaved: true });
      editorDraftHtmlRef.current = nextHtml;
      setEditorDraftHtml(nextHtml);
      setEditorContentEpoch((n) => n + 1);
      setFillModalOpen(false);
      message.success(mode === 'expand' ? '已扩写完善' : '已生成内容');
      window.setTimeout(() => {
        suppressBlurReleaseRef.current = false;
      }, 600);
    } catch (e) {
      if (!handleConflict(e)) message.error(e instanceof Error ? e.message : '生成失败');
    } finally {
      fillingRef.current = false;
      setFillingSection(false);
    }
  };

  const submitPreviewText = useMemo(() => {
    return sectionsWithDraft
      .filter((s) => stripHtml(s.content))
      .map((s, i) => `${i + 1}、${s.title}\n\n${stripHtml(s.content)}`)
      .join('\n\n');
  }, [sectionsWithDraft]);

  const handleSubmitFinal = () => {
    if (!classId) return;
    if (!isTeamLeader) {
      message.info('仅队长可提交最终商业计划书');
      return;
    }
    if (submitPptFiles.length === 0) {
      message.warning('请先上传商业计划书演示文稿（PPT）');
      return;
    }
    if (!sectionsHaveContent(sectionsWithDraft)) {
      message.warning('请先填写商业计划书要点内容');
      return;
    }
    Modal.confirm({
      title: '提交最终商业计划书',
      content: '将提交当前要点内容与附件进入教师审核，审核通过即完成全部实训流程。确认提交？',
      okText: '确认提交',
      cancelText: '取消',
      onOk: async () => {
        setSubmitting(true);
        try {
          if (holdingLockKeyRef.current) {
            await saveActiveSection({ silent: true, releaseAfter: true });
          }
          const files = [...submitPptFiles, ...submitOptionalFiles]
            .map((f) => f.originFileObj)
            .filter(Boolean) as File[];
          await submitBusinessPlan(classId, files);
          await loadWorkspace();
          onTaskComplete?.();
          message.success('已提交，请等待教师审核');
        } catch (e) {
          message.error(e instanceof Error ? e.message : '提交失败');
        } finally {
          setSubmitting(false);
        }
      },
    });
  };

  useEffect(() => {
    if (workspace?.trainingEnded) onTrainingEnded?.();
  }, [workspace?.trainingEnded, onTrainingEnded]);

  const trainingEnded = Boolean(workspace?.trainingEnded);
  const submission = workspace?.submission;
  const memberCount = teamMemberCount || workspace?.teamMemberCount || 0;
  const fillModeHint =
    activeSection && stripHtml(activeSection.content).length > 0 ? '扩写完善（可能改写现有表述）' : '全量撰写';

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <Spin />
      </div>
    );
  }

  if (!entryAllowed) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center text-amber-800 text-sm">
        {entryHint || '暂无法开始商业计划书实训'}
      </div>
    );
  }

  return (
    <div className={fullScreen ? 'space-y-0' : 'space-y-8'}>
      {readOnly && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800">
          商业计划书已通过教师审核，内容不可再编辑。
        </div>
      )}
      {submission?.status === 'pending' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          已提交最终计划书，等待教师审核。
        </div>
      )}
      {submission?.status === 'rejected' && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm text-rose-800">
          审核未通过，请修改后重新提交。
        </div>
      )}
      {(submission?.status === 'approved' || submission?.status === 'rejected') &&
      submission.totalScore != null ? (
        <ReviewScorePanel
          scores={submission.scores}
          totalScore={submission.totalScore}
          reviewComment={submission.reviewComment}
        />
      ) : null}
      {lockBlockedHint && !readOnly && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          {lockBlockedHint}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="flex border-b border-gray-100">
          {(
            [
              { key: 'plan' as const, label: '撰写要点', icon: 'ri-file-text-line' },
              { key: 'submit' as const, label: '提交审核', icon: 'ri-send-plane-line' },
            ]
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === tab.key ? 'text-violet-600 border-b-2 border-violet-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <i className={`${tab.icon} mr-2`} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-8">
          {activeTab === 'plan' && (
            <div className={fullScreen ? 'space-y-0' : 'space-y-6'}>
              {!fullScreen && (
                <>
                  <div className="bg-violet-50/70 border border-violet-200 rounded-2xl p-4 space-y-3">
                    <h3 className="text-sm font-bold text-violet-900 m-0">封面信息</h3>
                    <div className="grid md:grid-cols-2 gap-3">
                      <CoverFieldCard
                        label="小组项目名称"
                        value={cover.projectName}
                        wide={!projectNameLocked}
                      >
                        {projectNameLocked || readOnly ? undefined : (
                          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                            <input
                              className="flex-1 border border-violet-200 rounded-lg px-3 py-2 text-sm"
                              value={draftProjectName}
                              placeholder="请填写小组项目名称"
                              onChange={(e) => setDraftProjectName(e.target.value)}
                            />
                            <Button
                              type="primary"
                              size="small"
                              loading={savingCover}
                              onClick={() => void saveCoverOnly()}
                            >
                              保存名称
                            </Button>
                          </div>
                        )}
                      </CoverFieldCard>
                      <CoverFieldCard
                        label={isSoloTeam ? '负责人（姓名学号）' : '组长（姓名学号）'}
                        value={cover.leader}
                      />
                      {Array.from({ length: memberSlotCount }, (_, i) => (
                        <CoverFieldCard
                          key={i}
                          label={`成员（姓名学号）${i + 1}`}
                          value={cover.members[i] || ''}
                        />
                      ))}
                      <CoverFieldCard
                        label="学院班级"
                        value={cover.collegeClass || classMeta?.collegeClass || ''}
                      />
                      <CoverFieldCard
                        label="指导教师"
                        value={cover.advisor || classMeta?.advisor || ''}
                      />
                      <CoverFieldCard label="日期" value={formatCoverDate(cover)} />
                    </div>
                  </div>
                </>
              )}

              <div
                className={`bg-white border border-gray-200 rounded-xl p-6 ${
                  fullScreen ? 'fixed inset-0 z-[200] rounded-none p-0 flex flex-col h-screen overflow-hidden' : ''
                }`}
              >
                <div className={`grid grid-cols-12 gap-4 ${fullScreen ? 'p-6 flex-1 min-h-0 overflow-hidden' : ''}`}>
                  <div className="col-span-12 md:col-span-4 lg:col-span-3">
                    <div className={`border border-gray-200 rounded-xl overflow-hidden ${fullScreen ? 'h-full flex flex-col min-h-0' : ''}`}>
                      <div className="bg-gray-50 px-3 py-2 flex items-center justify-between gap-2 shrink-0">
                        <span className="text-xs font-semibold text-gray-600">章节</span>
                        {SHOW_BP_STRUCTURE_TOOLS ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={readOnly || generatingOutline}
                              onClick={() => setOutlineModalOpen(true)}
                              className="px-2 h-7 rounded-lg hover:bg-white text-violet-700 text-[11px] font-semibold disabled:opacity-50 cursor-pointer whitespace-nowrap"
                              title="根据项目生成章节"
                            >
                              <i className="ri-sparkling-line mr-0.5" />
                              生成章节
                            </button>
                            <button
                              type="button"
                              disabled={readOnly}
                              onClick={addSection}
                              className="w-7 h-7 rounded-lg hover:bg-white text-gray-600 disabled:opacity-50 cursor-pointer"
                              title="新增章节"
                            >
                              <i className="ri-add-line" />
                            </button>
                          </div>
                        ) : null}
                      </div>
                      <div className={`${fullScreen ? 'flex-1 min-h-0' : 'max-h-[520px]'} overflow-y-auto`}>
                        {BUSINESS_PLAN_SECTION_GROUPS.map((group) => {
                          const groupSecs = sections.filter((s) => {
                            const def = BUSINESS_PLAN_SECTION_DEFS.find((d) => d.key === s.key);
                            return def?.groupKey === group.key;
                          });
                          return (
                            <div key={group.key}>
                              <div className="px-3 py-2 bg-gray-100 text-xs font-bold text-gray-700 sticky top-0 z-[1]">
                                {group.title}
                              </div>
                              {groupSecs.map((sec) => {
                                const filled = stripHtml(sec.content).length > 0;
                                const active = sec.key === activeSectionKey;
                                const lock = lockOf(sec.key);
                                const lockedByOther = Boolean(lock && String(lock.lockedById) !== String(studentId));
                                const lockedByMe = Boolean(lock && String(lock.lockedById) === String(studentId));
                                return (
                                  <div
                                    key={sec.key}
                                    onMouseDown={(e) => {
                                      // 阻止编辑器先失焦再切章，减少滚动跳动
                                      e.preventDefault();
                                    }}
                                    onClick={() => void switchSection(sec.key)}
                                    className={`w-full text-left px-3 py-2.5 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                                      active ? 'bg-violet-50' : ''
                                    }`}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                      if (e.key !== 'Enter' && e.key !== ' ') return;
                                      e.preventDefault();
                                      void switchSection(sec.key);
                                    }}
                                  >
                                    <div className="flex items-start gap-2 min-w-0">
                                      <span className="text-sm font-medium text-gray-900 whitespace-normal break-words leading-snug flex-1 min-w-0">
                                        {sec.title}
                                      </span>
                                      {lockedByOther ? (
                                        <i className="ri-lock-line text-amber-500 text-sm shrink-0 mt-0.5" title={`${lock?.lockedByName} 编辑中`} />
                                      ) : null}
                                      {lockedByMe ? (
                                        <i className="ri-edit-line text-violet-500 text-sm shrink-0 mt-0.5" title="你正在编辑" />
                                      ) : null}
                                    </div>
                                    <div className="mt-0.5 flex items-center gap-2">
                                      <span className={`text-[11px] ${filled ? 'text-green-700' : 'text-gray-400'}`}>
                                        {filled ? '已填写' : '待填写'}
                                      </span>
                                      {lockedByOther ? (
                                        <span className="text-[11px] text-amber-600">{lock?.lockedByName} 编辑中</span>
                                      ) : null}
                                    </div>
                                    {SHOW_BP_STRUCTURE_TOOLS && !readOnly ? (
                                      <div className="flex items-center gap-1 mt-1">
                                        <button type="button" className="hidden" onClick={() => moveSection(sec.key, 'up')} />
                                        <button type="button" className="hidden" onClick={() => deleteSection(sec.key)} />
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                      {!readOnly && (
                        <div className="px-3 py-2 text-[11px] text-gray-400 bg-white border-t border-gray-100 shrink-0">
                          点击小节进入编辑并锁定；结构已按课程模板固定
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={`col-span-12 md:col-span-8 lg:col-span-9 ${fullScreen ? 'h-full flex flex-col min-h-0' : ''}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm text-gray-500 truncate">
                        {workspace?.updatedByName
                          ? `最近保存：${workspace.updatedByName} · r${revision}`
                          : `当前编辑：${studentDisplayName} · r${revision}`}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => exportDocx()}
                          className="px-3 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 cursor-pointer whitespace-nowrap"
                          title="导出 Word"
                        >
                          <i className="ri-file-word-line mr-1.5" />
                          导出
                        </button>
                        <button
                          type="button"
                          title={fullScreen ? '缩小' : '放大'}
                          onClick={() => setFullScreen((v) => !v)}
                          className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-teal-50 hover:text-teal-700 cursor-pointer"
                        >
                          <i className={`${fullScreen ? 'ri-fullscreen-exit-line' : 'ri-fullscreen-line'} text-lg`} />
                        </button>
                        <button
                          type="button"
                          disabled={readOnly || savingDraft || !canEditActive || !isDirty}
                          onClick={() => void saveActiveSection()}
                          className="px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700 disabled:opacity-50 cursor-pointer"
                        >
                          {savingDraft ? '保存中…' : '保存'}
                        </button>
                      </div>
                    </div>

                    <div
                      className={`border border-gray-200 rounded-xl overflow-hidden mt-3 ${
                        fullScreen ? 'flex-1 min-h-0 flex flex-col' : ''
                      }`}
                    >
                      <div className="bg-gray-50 px-4 py-3 flex items-center justify-between shrink-0">
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-gray-900 whitespace-normal break-words leading-snug">
                            {activeSection?.title || '未选择章节'}
                          </div>
                          {activeForeignLock ? (
                            <div className="text-xs text-amber-600 mt-0.5">
                              {activeForeignLock.lockedByName} 正在编辑 · 只读同步
                            </div>
                          ) : null}
                        </div>
                        {SHOW_BP_AI_FILL ? (
                          <button
                            type="button"
                            disabled={readOnly || fillingSection || !activeSection || Boolean(activeForeignLock)}
                            onClick={() => void openFillModal()}
                            className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-50 disabled:opacity-50 cursor-pointer whitespace-nowrap"
                            title="AI 填充章节内容"
                          >
                            <i className="ri-magic-line mr-1.5" />
                            AI 填充章节
                          </button>
                        ) : null}
                      </div>
                      <div className={`p-4 ${fullScreen ? 'flex-1 min-h-0 overflow-y-auto' : ''}`}>
                        {activeSection ? (
                          <div className="mb-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-900 leading-relaxed">
                            撰写提示：{guideForSectionKey(activeSection.key) || activeSection.guide || '请按模板要点完整填写本节内容。'}
                          </div>
                        ) : null}
                        {activeSection ? (
                          <div className="[overflow-anchor:none]">
                            <RichTextEditor
                              key={`${activeSection.key}-${editorContentEpoch}`}
                              value={editorDraftHtml}
                              disabled={readOnly || Boolean(activeForeignLock)}
                              viewOnly={Boolean(activeForeignLock)}
                              minRows={14}
                              placeholder={
                                activeForeignLock
                                  ? '同学正在编辑本章，只读同步中…'
                                  : '点击此处进入编辑态并锁定本章…'
                              }
                              onChange={handleEditorChange}
                              onFocus={onEditorFocus}
                              onBlur={onEditorBlur}
                              fitHeight={fullScreen}
                            />
                          </div>
                        ) : (
                          <div className="py-16 text-center text-sm text-gray-500">请从左侧选择章节</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {!fullScreen && (
                <>
                  <div className="grid md:grid-cols-3 gap-6">
                    <div className="bg-gradient-to-br from-violet-500 to-purple-500 rounded-xl p-6 text-white">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-white/80">章节进度</span>
                        <i className="ri-file-chart-line text-2xl text-white/80" />
                      </div>
                      <div className="text-3xl font-bold mb-1">{sectionProgressPercent}%</div>
                      <div className="text-xs text-white/80">
                        {sectionTotal} 个章节中已完成 {completedCount} 个
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl p-6 text-white">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-white/80">字数统计</span>
                        <i className="ri-text text-2xl text-white/80" />
                      </div>
                      <div className="text-3xl font-bold mb-1">{totalChars}</div>
                      <div className="text-xs text-white/80">当前正文总字数</div>
                    </div>
                    <div className="bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl p-6 text-white">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-white/80">协作成员</span>
                        <i className="ri-team-line text-2xl text-white/80" />
                      </div>
                      <div className="text-3xl font-bold mb-1">{memberCount}人</div>
                      <div className="text-xs text-white/80">{isSoloTeam ? '单人公司' : '团队共享编辑'}</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-base font-bold text-gray-900 m-0">评分标准</h3>
                    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {BUSINESS_PLAN_RUBRIC_DIMENSIONS.map((dim) => (
                        <div
                          key={dim.key}
                          className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex flex-col gap-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-sm font-bold text-gray-900">{dim.title}</div>
                            <span className="shrink-0 text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-100 rounded-full px-2 py-0.5">
                              {dim.max} 分
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 leading-relaxed m-0 flex-1">{dim.description}</p>
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {dim.levels.map((l) => (
                              <span
                                key={l.label}
                                className="text-[11px] text-gray-500 bg-gray-50 border border-gray-100 rounded-md px-2 py-0.5"
                              >
                                {l.label} {l.range}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'submit' && (
            <div className="space-y-6">
              {submission?.status === 'approved' && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
                  最终计划书已通过审核，实训流程已结束。
                </div>
              )}

              <p className="text-sm text-gray-600">预览当前要点内容，上传 PPT 后提交审核。</p>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 max-h-96 overflow-y-auto">
                {submitPreviewText ? (
                  <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans m-0">{submitPreviewText}</pre>
                ) : (
                  <div className="py-10 text-center text-sm text-gray-500">暂无已填写内容，请先在「撰写要点」中完善</div>
                )}
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="text-sm font-medium text-gray-700">附件资料</div>
                    <div className="text-xs text-gray-500">必传：PPT；可选：Word/PDF/Excel/ZIP</div>
                  </div>
                  <div className="mt-3 grid grid-cols-12 gap-4">
                    <div className="col-span-12 md:col-span-6">
                      <div className="text-xs font-semibold text-gray-600 mb-2">必传：商业计划书演示文稿（PPT）</div>
                      <Upload
                        multiple={false}
                        fileList={submitPptFiles}
                        accept=".ppt,.pptx"
                        beforeUpload={() => false}
                        disabled={trainingEnded}
                        onChange={({ fileList }) => setSubmitPptFiles(fileList.slice(-1))}
                      >
                        <button
                          type="button"
                          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-all whitespace-nowrap cursor-pointer"
                        >
                          <i className="ri-upload-cloud-2-line mr-1.5" />
                          上传PPT
                        </button>
                      </Upload>
                    </div>
                    <div className="col-span-12 md:col-span-6">
                      <div className="text-xs font-semibold text-gray-600 mb-2">可选：补充材料</div>
                      <Upload
                        multiple
                        fileList={submitOptionalFiles}
                        accept=".doc,.docx,.pdf,.xls,.xlsx,.zip"
                        beforeUpload={() => false}
                        disabled={trainingEnded}
                        onChange={({ fileList }) => setSubmitOptionalFiles(fileList)}
                      >
                        <button
                          type="button"
                          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-all whitespace-nowrap cursor-pointer"
                        >
                          <i className="ri-upload-cloud-2-line mr-1.5" />
                          上传附件
                        </button>
                      </Upload>
                    </div>
                  </div>
                </div>
                {isTeamLeader ? (
                  <button
                    type="button"
                    disabled={
                      submitting ||
                      trainingEnded ||
                      submitPptFiles.length === 0 ||
                      submission?.status === 'pending' ||
                      submission?.status === 'approved'
                    }
                    onClick={handleSubmitFinal}
                    className="shrink-0 w-full md:w-auto px-6 py-3 bg-violet-600 text-white text-sm font-medium rounded-xl disabled:opacity-50 cursor-pointer whitespace-nowrap"
                  >
                    {submitting ? '提交中…' : '提交最终商业计划书'}
                  </button>
                ) : null}
              </div>
              {!isTeamLeader ? (
                <p className="text-sm text-amber-700">仅队长可提交最终商业计划书。</p>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <Modal
        title="根据项目生成章节"
        open={SHOW_BP_STRUCTURE_TOOLS && outlineModalOpen}
        maskClosable={false}
        keyboard={false}
        onCancel={() => !generatingOutline && setOutlineModalOpen(false)}
        footer={[
          <Button key="cancel" disabled={generatingOutline} onClick={() => setOutlineModalOpen(false)}>
            取消
          </Button>,
          <Button key="export" onClick={() => exportDocx()} disabled={generatingOutline}>
            导出备份（docx）
          </Button>,
          <Button key="ok" type="primary" loading={generatingOutline} onClick={() => void confirmGenerateOutline()}>
            确认生成
          </Button>,
        ]}
      >
        <div className="text-sm text-gray-600 leading-relaxed space-y-2">
          <p>将根据前期实训项目上下文生成合适章节结构（仅大纲，不含正文）。</p>
          {sectionsHaveContent(sectionsWithDraft) ? (
            <p className="text-amber-700">
              当前已有章节内容。重新生成后现有章节与正文将丢失，建议先导出备份。
            </p>
          ) : (
            <p>当前章节多为空，可直接生成。</p>
          )}
        </div>
      </Modal>

      <Modal
        title="AI 填充章节内容"
        open={SHOW_BP_AI_FILL && fillModalOpen}
        maskClosable={false}
        keyboard={false}
        onCancel={() => !fillingSection && setFillModalOpen(false)}
        footer={[
          <Button key="cancel" disabled={fillingSection} onClick={() => setFillModalOpen(false)}>
            取消
          </Button>,
          <Button key="export" onClick={() => exportDocx()} disabled={fillingSection}>
            导出备份（docx）
          </Button>,
          <Button key="ok" type="primary" loading={fillingSection} onClick={() => void confirmFillActiveSection()}>
            确认生成
          </Button>,
        ]}
      >
        <div className="text-sm text-gray-600 leading-relaxed space-y-2">
          <p>
            将对「{activeSection?.title || '当前章节'}」进行 <span className="font-semibold">{fillModeHint}</span>
            ，内容基于项目上下文由 AI 生成，需人工核对后再使用。
          </p>
          {stripHtml(activeSection?.content || '').length > 0 ? (
            <p className="text-amber-700">本章节已有内容，生成后可能覆盖或改写原文，建议先导出备份。</p>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
