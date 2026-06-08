import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { message, Modal, Select, Spin, Upload } from 'antd';
import type { UploadFile } from 'antd';
import RichTextEditor from '../../../components/RichTextEditor';
import {
  createBusinessPlanVersion,
  deleteBusinessPlanVersion,
  fetchBusinessPlanEntry,
  fetchBusinessPlanWorkspace,
  generateBusinessPlanStream,
  fillBusinessPlanSection,
  previewBusinessPlanVersion,
  saveBusinessPlanWorkspace,
  submitBusinessPlan,
  analyzeBusinessPlanVersionStream,
  businessPlanAnalyzeToEditorHtml,
  listBusinessPlanAnalyses,
  parseBusinessPlanAnalyzeFromStorage,
  type BusinessPlanAnalyzeJson,
  type BusinessPlanAnalysis,
  type BusinessPlanSection,
  type BusinessPlanWorkspace,
} from '../../../lib/studentBusinessPlanApi';
import { getPortalToken, parseJwtPayload } from '../../../lib/authApi';

type BusinessPlanModuleProps = {
  classId?: string;
  isTeamLeader?: boolean;
  studentDisplayName?: string;
  teamMemberCount?: number;
  onTaskComplete?: () => void;
  onTrainingEnded?: () => void;
};

const DEFAULT_SECTION_DEFS: { key: string; title: string }[] = [
  { key: 'executive_summary', title: '执行摘要' },
  { key: 'background', title: '项目背景' },
  { key: 'market', title: '市场分析' },
  { key: 'product', title: '产品与服务' },
  { key: 'business_model', title: '商业模式' },
  { key: 'marketing', title: '营销策略' },
  { key: 'finance', title: '财务规划' },
  { key: 'team', title: '团队介绍' },
];

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

  const [activeTab, setActiveTab] = useState<'plan' | 'analysis' | 'submit'>('plan');
  const [entryAllowed, setEntryAllowed] = useState<boolean | null>(null);
  const [entryHint, setEntryHint] = useState('');
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState<BusinessPlanWorkspace | null>(null);
  const [sections, setSections] = useState<BusinessPlanSection[]>([]);
  const [activeSectionKey, setActiveSectionKey] = useState<string>('');
  const [versionCache, setVersionCache] = useState<Map<string, BusinessPlanSection[]>>(new Map());
  const [currentVersion, setCurrentVersion] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateLogs, setGenerateLogs] = useState<string[]>([]);
  const [streamThinking, setStreamThinking] = useState('');
  const [fullScreen, setFullScreen] = useState(false);
  const [fillingSection, setFillingSection] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedAnalysisVersionId, setSelectedAnalysisVersionId] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<BusinessPlanAnalyzeJson | null>(null);
  const [analysisMarkdownFallback, setAnalysisMarkdownFallback] = useState('');
  const [analysisByVersionId, setAnalysisByVersionId] = useState<Map<string, BusinessPlanAnalysis>>(new Map());
  const [analysisThinking, setAnalysisThinking] = useState('');
  const [selectedSubmitVersionId, setSelectedSubmitVersionId] = useState<string | null>(null);
  const [submitPreview, setSubmitPreview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitPptFiles, setSubmitPptFiles] = useState<UploadFile[]>([]);
  const [submitOptionalFiles, setSubmitOptionalFiles] = useState<UploadFile[]>([]);
  const [savingDraft, setSavingDraft] = useState(false);
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  const readOnly = Boolean(workspace?.readOnly);
  const versions = workspace?.versions || [];
  const thinkingScrollRef = useRef<HTMLDivElement | null>(null);
  const [lastSavedSerialized, setLastSavedSerialized] = useState('');
  const studentId = useMemo(() => {
    const token = getPortalToken('student') || '';
    const payload = parseJwtPayload(token);
    return String(payload?.sub || '');
  }, []);

  const applyWorkspace = useCallback((ws: BusinessPlanWorkspace, opts?: { markSaved?: boolean }) => {
    const markSaved = opts?.markSaved !== false;
    setWorkspace(ws);
    const nextSecs = ws.sections.length ? ws.sections : DEFAULT_SECTION_DEFS.map((d) => ({ ...d, content: '' }));
    setSections(nextSecs);
    if (markSaved) setLastSavedSerialized(serializeSections(nextSecs));
    setActiveSectionKey((prev) => {
      if (prev && nextSecs.some((s) => s.key === prev)) return prev;
      return nextSecs[0]?.key || '';
    });
    if (ws.versions.length) {
      setCurrentVersion(ws.versions[0].versionNumber);
      setSelectedVersionId(ws.versions[0].id);
    }
  }, [serializeSections]);

  const applyAnalysisRecord = useCallback((record: BusinessPlanAnalysis | undefined) => {
    if (!record?.result?.trim()) {
      setAnalysisResult(null);
      setAnalysisMarkdownFallback('');
      return;
    }
    const structured = parseBusinessPlanAnalyzeFromStorage(record.result);
    if (structured) {
      setAnalysisResult(structured);
      setAnalysisMarkdownFallback('');
      return;
    }
    setAnalysisResult(null);
    setAnalysisMarkdownFallback(record.result);
  }, []);

  const loadAnalyses = useCallback(async () => {
    if (!classId) return new Map<string, BusinessPlanAnalysis>();
    const list = await listBusinessPlanAnalyses(classId);
    const map = new Map<string, BusinessPlanAnalysis>();
    for (const a of list) {
      if (!map.has(a.versionId)) map.set(a.versionId, a);
    }
    setAnalysisByVersionId(map);
    return map;
  }, [classId]);

  const loadWorkspace = useCallback(async () => {
    if (!classId) return;
    const [ws, analysisMap] = await Promise.all([fetchBusinessPlanWorkspace(classId), loadAnalyses()]);
    applyWorkspace(ws, { markSaved: true });
    const defaultVersionId =
      selectedAnalysisVersionId || (ws.versions.length ? ws.versions[0].id : null);
    if (ws.versions.length && !selectedAnalysisVersionId) {
      setSelectedAnalysisVersionId(ws.versions[0].id);
    }
    if (defaultVersionId) {
      applyAnalysisRecord(analysisMap.get(defaultVersionId));
    }
  }, [applyAnalysisRecord, applyWorkspace, classId, loadAnalyses, selectedAnalysisVersionId]);

  useEffect(() => {
    if (!selectedAnalysisVersionId) {
      setAnalysisResult(null);
      setAnalysisMarkdownFallback('');
      return;
    }
    applyAnalysisRecord(analysisByVersionId.get(selectedAnalysisVersionId));
  }, [analysisByVersionId, applyAnalysisRecord, selectedAnalysisVersionId]);

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

  const [editingTitleKey, setEditingTitleKey] = useState<string | null>(null);
  const [editorDraftHtml, setEditorDraftHtml] = useState<string>('');
  const editorDraftHtmlRef = useRef<string>('');

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
    () =>
      sectionsWithDraft.filter((s) => String(s.content || '').replace(/<[^>]+>/g, '').trim().length > 0).length,
    [sectionsWithDraft]
  );

  const sectionProgressPercent = sectionTotal > 0 ? Math.round((completedCount / sectionTotal) * 100) : 0;

  const totalChars = useMemo(
    () => sectionsWithDraft.reduce((n, s) => n + String(s.content || '').replace(/<[^>]+>/g, '').length, 0),
    [sectionsWithDraft]
  );

  const isDirty = useMemo(() => {
    const snapshot = getSectionsSnapshotWithDraft();
    return serializeSections(snapshot) !== lastSavedSerialized;
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
  }, [activeSectionKey, sections]);

  const addSection = () => {
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

  const handleSaveDraft = async () => {
    if (!classId || readOnly) return;
    setSavingDraft(true);
    try {
      const snapshot = getSectionsSnapshotWithDraft();
      const summary = '手动保存';
      const res = await createBusinessPlanVersion(classId, summary, snapshot);
      setVersionCache((prev) => {
        const next = new Map(prev);
        next.set(res.version.id, res.version.data.sections);
        return next;
      });
      applyWorkspace(res.workspace, { markSaved: true });
      setCurrentVersion(res.version.versionNumber);
      message.success('已保存');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSaveVersion = async (summary: string) => {
    if (!classId || readOnly) return;
    try {
      const res = await createBusinessPlanVersion(classId, summary, sections);
      setVersionCache((prev) => {
        const next = new Map(prev);
        next.set(res.version.id, res.version.data.sections);
        return next;
      });
      applyWorkspace(res.workspace, { markSaved: true });
      setCurrentVersion(res.version.versionNumber);
      message.success('版本已保存');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存版本失败');
    }
  };

  const handleRestore = async (versionId: string) => {
    if (!classId || readOnly) return;
    setRestoringVersionId(versionId);
    try {
      let cached = versionCache.get(versionId);
      if (!cached) {
        const preview = await previewBusinessPlanVersion(classId, versionId);
        cached = preview.sections;
        setVersionCache((prev) => new Map(prev).set(versionId, cached!));
      }
      setSections(cached);
      const ver = versions.find((v) => v.id === versionId);
      if (ver) {
        setCurrentVersion(ver.versionNumber);
        setSelectedVersionId(ver.id);
      }
      message.info('已加载到编辑器，修改后请保存');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载版本失败');
    } finally {
      setRestoringVersionId(null);
    }
  };

  const runGenerateStream = async (mode: 'full' | 'incremental', baseSections?: BusinessPlanSection[]) => {
    if (!classId || readOnly) return;
    const snapshot = baseSections ? baseSections : getSectionsSnapshotWithDraft();
    setGenerateLogs([]);
    setStreamThinking('');
    setIsGenerating(true);
    try {
      await generateBusinessPlanStream(
        classId,
        { mode, sections: snapshot },
        {
          onLog: (text) => {
            setGenerateLogs((prev) => [...prev.slice(-49), String(text || '')].filter(Boolean));
          },
          onThinking: (text) => {
            const chunk = String(text || '');
            if (!chunk) return;
            setStreamThinking((s) => (s + chunk).slice(-8000));
          },
          onSection: (payload) => {
            const key = String(payload.key || '');
            const title = payload.title ? String(payload.title) : undefined;
            const content = String(payload.content || '');
            setSections((prev) =>
              prev.map((s) =>
                s.key === key
                  ? {
                      ...s,
                      title: title && s.title ? title : s.title,
                      content,
                    }
                  : s
              )
            );
          },
          onDone: async () => {
            setGenerateLogs((prev) => [...prev.slice(-49), '生成完成'].filter(Boolean));
            await loadWorkspace();
            message.success('AI 生成完成');
          },
          onError: (msg) => {
            setGenerateLogs((prev) => [...prev.slice(-49), `生成失败：${msg}`].filter(Boolean));
          },
        }
      );
    } catch (e) {
      message.error(e instanceof Error ? e.message : '生成失败');
    } finally {
      setIsGenerating(false);
    }
  };

  const askGenerate = () => {
    if (readOnly) return;
    Modal.confirm({
      title: 'AI 一键生成商业计划书',
      closable: true,
      mask: { closable: true },
      content: (
        <div className="text-sm text-gray-600 leading-relaxed">
          <p className="mb-2">生成完成后将自动生成一个新版本，可随时从版本列表恢复，不必担心数据丢失。</p>
          <p>确认后将生成一份全新的商业计划书（章节与内容将重写）。</p>
        </div>
      ),
      okText: '开始生成',
      cancelText: '取消',
      onOk: async () => {
        const base = DEFAULT_SECTION_DEFS.map((d) => ({ ...d, content: '' }));
        setSections(base);
        setActiveSectionKey(base[0]?.key || '');
        editorDraftHtmlRef.current = '';
        setEditorDraftHtml('');
        await runGenerateStream('full', base);
      },
    });
  };

  const askFillActiveSection = () => {
    if (!classId || readOnly) return;
    const sec = activeSection;
    if (!sec?.key) {
      message.info('请先选择章节');
      return;
    }
    const currentTextLen = String(sec.content || '').replace(/<[^>]+>/g, '').trim().length;
    const mode: 'overwrite' | 'expand' = currentTextLen > 0 ? 'expand' : 'overwrite';
    Modal.confirm({
      title: 'AI 填充章节内容',
      closable: true,
      mask: { closable: true },
      content: (
        <div className="text-sm text-gray-600 leading-relaxed">
          <p>确认后将对当前章节进行 {mode === 'overwrite' ? '全量撰写' : '扩写完善'}。</p>
        </div>
      ),
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        const snapshot = getSectionsSnapshotWithDraft();
        setFillingSection(true);
        try {
          const ws = await fillBusinessPlanSection(classId, { sectionKey: sec.key, mode, sections: snapshot });
          applyWorkspace(ws, { markSaved: false });
          message.success('已生成');
        } catch (e) {
          message.error(e instanceof Error ? e.message : '生成失败');
        } finally {
          setFillingSection(false);
        }
      },
    });
  };

  const handleAnalyze = async () => {
    if (!classId || !selectedAnalysisVersionId) return;
    setIsAnalyzing(true);
    setAnalysisThinking('');
    setAnalysisResult(null);
    setAnalysisMarkdownFallback('');
    try {
      let streamed: BusinessPlanAnalyzeJson | null = null;
      await analyzeBusinessPlanVersionStream(
        classId,
        { versionId: selectedAnalysisVersionId },
        {
          onThinking: (t) => {
            const chunk = String(t || '');
            if (!chunk) return;
            setAnalysisThinking((s) => (s + chunk).slice(-12000));
          },
          onDone: (p) => {
            const raw = (p as { analysis?: BusinessPlanAnalyzeJson })?.analysis;
            streamed = raw ? parseBusinessPlanAnalyzeFromStorage(JSON.stringify(raw)) || raw : null;
            if (streamed) {
              setAnalysisResult(streamed);
              setAnalysisMarkdownFallback('');
            }
          },
        }
      );
      const map = await loadAnalyses();
      applyAnalysisRecord(map.get(selectedAnalysisVersionId));
      if (!streamed && !map.get(selectedAnalysisVersionId)) {
        message.warning('报告已生成但内容为空，请重试');
      } else {
        message.success('分析完成');
      }
      setAnalysisThinking('');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '分析失败');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const loadSubmitPreview = async (versionId: string) => {
    if (!classId) return;
    try {
      const preview = await previewBusinessPlanVersion(classId, versionId);
      setSubmitPreview(
        preview.sections
          .filter((s) => s.content)
          .map((s, i) => `${i + 1}、${s.title}\n\n${s.content}`)
          .join('\n\n')
      );
    } catch {
      setSubmitPreview('');
    }
  };

  const handleSubmitFinal = () => {
    if (!classId || !selectedSubmitVersionId) return;
    if (!isTeamLeader) {
      message.info('仅队长可提交最终商业计划书');
      return;
    }
    if (submitPptFiles.length === 0) {
      message.warning('请先上传商业计划书演示文稿（PPT）');
      return;
    }
    Modal.confirm({
      title: '提交最终商业计划书',
      content: '提交后将进入教师审核，审核通过即完成全部实训流程。确认提交？',
      okText: '确认提交',
      cancelText: '取消',
      onOk: async () => {
        setSubmitting(true);
        try {
          const files = [...submitPptFiles, ...submitOptionalFiles]
            .map((f) => f.originFileObj)
            .filter(Boolean) as File[];
          await submitBusinessPlan(classId, selectedSubmitVersionId, files);
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

  useEffect(() => {
    if (!isGenerating) return;
    const el = thinkingScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [isGenerating, streamThinking, generateLogs]);

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

  const submission = workspace?.submission;
  const memberCount = teamMemberCount || workspace?.teamMemberCount || 0;

  const versionOptions = versions.map((v) => ({
    value: v.id,
    versionOnly: `v${v.versionNumber}`,
    label: (() => {
      const showDelete = Boolean(!readOnly && (workspace?.isTeamLeader || (v.savedById && v.savedById === studentId)));
      return (
        <div className="py-0.5 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-900 leading-5">{`v${v.versionNumber}`}</div>
            <div className="text-xs text-gray-500 leading-4">{`${v.savedAt} · ${v.operator}`}</div>
          </div>
          {showDelete ? (
            <button
              type="button"
              className="w-7 h-7 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center shrink-0"
              title="删除版本"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!classId) return;
                Modal.confirm({
                  title: '删除版本',
                  content: '确认删除该版本？删除后不可恢复。',
                  okText: '删除',
                  cancelText: '取消',
                  okButtonProps: { danger: true },
                  onOk: async () => {
                    try {
                      const ws = await deleteBusinessPlanVersion(classId, v.id);
                      applyWorkspace(ws);
                      message.success('已删除');
                    } catch (err) {
                      message.error(err instanceof Error ? err.message : '删除失败');
                    }
                  },
                });
              }}
            >
              <i className="ri-delete-bin-6-line text-sm" />
            </button>
          ) : null}
        </div>
      );
    })(),
  }));

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
          审核未通过：{submission.reviewComment || '请修改后重新选择版本提交。'}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="flex border-b border-gray-100">
          {(
            [
              { key: 'plan', label: '商业计划书要点', icon: 'ri-file-text-line' },
              { key: 'analysis', label: 'AI分析', icon: 'ri-ai-generate' },
              { key: 'submit', label: '计划书提交', icon: 'ri-send-plane-line' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === tab.key ? 'text-violet-600 border-b-2 border-violet-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <i className={`${tab.icon} mr-2`}></i>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-8">
          {activeTab === 'plan' && (
            <div className={fullScreen ? 'space-y-0' : 'space-y-8'}>
              <div className="bg-violet-50 border border-violet-200 rounded-xl p-6">
                <h3 className="text-base font-bold text-violet-900 mb-2">商业计划书撰写指南</h3>
                <p className="text-sm text-violet-700">
                  平台将依据前期选题、调研、产品、商业模式与仿真等实训产出辅助生成各章节，请在此基础上修改完善并保存版本。
                </p>
              </div>

           

              <div
                className={`bg-white border border-gray-200 rounded-xl p-6 ${
                  fullScreen ? 'fixed inset-0 z-[200] rounded-none p-0 flex flex-col h-screen overflow-hidden' : ''
                }`}
              >
                <div className={`grid grid-cols-12 gap-4 ${fullScreen ? 'p-6 flex-1 min-h-0 overflow-hidden' : ''}`}>
                  <div className="col-span-12 md:col-span-4 lg:col-span-3">
                    <div className={`border border-gray-200 rounded-xl overflow-hidden ${fullScreen ? 'h-full flex flex-col min-h-0' : ''}`}>
                      <div className="bg-gray-50 px-3 py-2 flex items-center justify-between shrink-0">
                        <span className="text-xs font-semibold text-gray-600">章节列表</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={readOnly}
                            onClick={addSection}
                            className="w-7 h-7 rounded-lg hover:bg-white text-gray-600 disabled:opacity-50 cursor-pointer"
                            title="新增章节"
                          >
                            <i className="ri-add-line"></i>
                          </button>
                        </div>
                      </div>
                      <div className={`${fullScreen ? 'flex-1 min-h-0' : 'max-h-[520px]'} overflow-y-auto`}>
                        {sections.length === 0 ? (
                          <div className="p-4 text-sm text-gray-500 text-center">暂无章节</div>
                        ) : (
                          sections.map((sec, idx) => {
                            const textLen = String(sec.content || '').replace(/<[^>]+>/g, '').trim().length;
                            const filled = textLen > 0;
                            const active = sec.key === activeSectionKey;
                            return (
                              <div
                                key={sec.key}
                                onClick={() => {
                                  flushDraftToSections();
                                  setActiveSectionKey(sec.key);
                                }}
                                className={`w-full text-left px-3 py-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                                  active ? 'bg-violet-50' : ''
                                }`}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                  if (e.key !== 'Enter' && e.key !== ' ') return;
                                  e.preventDefault();
                                  flushDraftToSections();
                                  setActiveSectionKey(sec.key);
                                }}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-gray-400 flex-shrink-0">{idx + 1}</span>
                                      {editingTitleKey === sec.key && !readOnly ? (
                                        <input
                                          value={sec.title}
                                          autoFocus
                                          onBlur={() => setEditingTitleKey(null)}
                                          onChange={(e) => {
                                            const v = e.target.value;
                                            setSections((prev) => prev.map((s) => (s.key === sec.key ? { ...s, title: v } : s)));
                                          }}
                                          className="w-full text-sm font-bold text-gray-900 bg-white border border-gray-200 rounded px-2 py-1"
                                        />
                                      ) : (
                                        <span
                                          className="text-sm font-bold text-gray-900 truncate"
                                          title={sec.title}
                                          onDoubleClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            if (!readOnly) setEditingTitleKey(sec.key);
                                          }}
                                        >
                                          {sec.title || '未命名章节'}
                                        </span>
                                      )}
                                    </div>
                                    <div className="mt-1 flex items-center gap-2">
                                      <span className={`text-[11px] ${filled ? 'text-green-700' : 'text-gray-400'}`}>
                                        {filled ? '已填写' : '待填写'}
                                      </span>
                                    </div>
                                  </div>
                                  {!readOnly && (
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          moveSection(sec.key, 'up');
                                        }}
                                        className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded-md disabled:opacity-40"
                                        title="上移"
                                        disabled={idx === 0}
                                      >
                                        <i className="ri-arrow-up-line text-sm"></i>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          moveSection(sec.key, 'down');
                                        }}
                                        className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded-md disabled:opacity-40"
                                        title="下移"
                                        disabled={idx === sections.length - 1}
                                      >
                                        <i className="ri-arrow-down-line text-sm"></i>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          if (sections.length <= 1) return;
                                          Modal.confirm({
                                            title: '删除章节',
                                            content: `确认删除「${sec.title || '未命名章节'}」？`,
                                            okText: '删除',
                                            cancelText: '取消',
                                            okButtonProps: { danger: true },
                                            onOk: () => deleteSection(sec.key),
                                          });
                                        }}
                                        className={`w-6 h-6 flex items-center justify-center rounded-md ${
                                          sections.length <= 1
                                            ? 'text-gray-300 cursor-not-allowed'
                                            : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                                        }`}
                                        title="删除章节"
                                        disabled={sections.length <= 1}
                                      >
                                        <i className="ri-delete-bin-line text-sm"></i>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                      {!readOnly && (
                        <div className="px-3 py-2 text-[11px] text-gray-400 bg-white border-t border-gray-100 shrink-0">
                          双击标题可编辑
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={`col-span-12 md:col-span-8 lg:col-span-9 ${fullScreen ? 'h-full flex flex-col min-h-0' : ''}`}>
                    <div className={`flex items-center justify-between gap-3 ${fullScreen ? 'px-0 shrink-0' : ''}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <Select
                          value={selectedVersionId}
                          placeholder="选择版本…"
                          allowClear
                          optionLabelProp="versionOnly"
                          disabled={readOnly || versionOptions.length === 0}
                          loading={Boolean(restoringVersionId)}
                          options={versionOptions as any}
                          onChange={(v) => {
                            if (!v) {
                              setSelectedVersionId(null);
                              return;
                            }
                            flushDraftToSections();
                            void handleRestore(String(v));
                          }}
                          className="min-w-[220px]"
                          size="middle"
                        />
                        <button
                          type="button"
                          disabled={readOnly || isGenerating}
                          onClick={askGenerate}
                          className="px-3 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 disabled:opacity-50 cursor-pointer whitespace-nowrap"
                          title="AI 一键生成商业计划书"
                        >
                          <i className="ri-sparkling-line mr-1.5"></i>AI 一键生成商业计划书
                        </button>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          title={fullScreen ? '缩小' : '放大'}
                          onClick={() => setFullScreen((v) => !v)}
                          className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-teal-50 hover:text-teal-700 cursor-pointer"
                        >
                          <i className={`${fullScreen ? 'ri-fullscreen-exit-line' : 'ri-fullscreen-line'} text-lg`}></i>
                        </button>
                        <button
                          type="button"
                          disabled={readOnly || savingDraft || !isDirty}
                          onClick={() => {
                            void handleSaveDraft();
                          }}
                          className="px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700 disabled:opacity-50 cursor-pointer"
                        >
                          {savingDraft ? '保存中…' : '保存'}
                        </button>
                      </div>
                    </div>

                    <div
                      className={`border border-gray-200 rounded-xl overflow-hidden mt-3 ${fullScreen ? 'flex-1 min-h-0 flex flex-col' : ''}`}
                    >
                      <div className="bg-gray-50 px-4 py-3 flex items-center justify-between shrink-0">
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-gray-900 truncate">{activeSection?.title || '未选择章节'}</div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {workspace?.updatedByName ? `最近保存：${workspace.updatedByName}` : `当前编辑：${studentDisplayName}`}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={readOnly || fillingSection}
                          onClick={askFillActiveSection}
                          className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-50 disabled:opacity-50 cursor-pointer whitespace-nowrap"
                          title="AI 填充章节内容"
                        >
                          <i className="ri-magic-line mr-1.5"></i>AI 填充章节内容
                        </button>
                      </div>
                      <div className={`p-4 ${fullScreen ? 'flex-1 min-h-0 overflow-y-auto' : ''}`}>
                        {activeSection ? (
                          <RichTextEditor
                            value={editorDraftHtml}
                            disabled={readOnly}
                            minRows={14}
                            placeholder="请输入本章节内容…"
                            onChange={handleEditorChange}
                            fitHeight={fullScreen}
                          />
                        ) : (
                          <div className="py-16 text-center text-sm text-gray-500">请从左侧选择章节</div>
                        )}
                      </div>
                      {isGenerating ? (
                        <div className="border-t border-gray-100 bg-white px-4 py-2 shrink-0">
                          {streamThinking ? (
                            <div
                              ref={thinkingScrollRef}
                              className="mt-2 text-[11px] text-gray-600 whitespace-pre-wrap font-sans bg-gray-50 rounded-lg px-3 py-2 max-h-40 overflow-y-auto flex flex-col justify-end"
                            >
                              <pre className="m-0 whitespace-pre-wrap font-sans">{streamThinking}</pre>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>


                 <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-violet-500 to-purple-500 rounded-xl p-6 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-white/80">章节进度</span>
                    <i className="ri-file-chart-line text-2xl text-white/80"></i>
                  </div>
                  <div className="text-3xl font-bold mb-1">
                    {sectionProgressPercent}%
                  </div>
                  <div className="text-xs text-white/80">
                    {sectionTotal} 个章节中已完成 {completedCount} 个
                  </div>
                </div>
                <div className="bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl p-6 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-white/80">字数统计</span>
                    <i className="ri-text text-2xl text-white/80"></i>
                  </div>
                  <div className="text-3xl font-bold mb-1">{totalChars}</div>
                  <div className="text-xs text-white/80">当前正文总字数</div>
                </div>
                <div className="bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl p-6 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-white/80">协作成员</span>
                    <i className="ri-team-line text-2xl text-white/80"></i>
                  </div>
                  <div className="text-3xl font-bold mb-1">{memberCount}人</div>
                  <div className="text-xs text-white/80">团队共享编辑</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'analysis' && (
            <div className="grid grid-cols-12 gap-4">
              {versions.length === 0 ? (
                <div className="col-span-12">
                  <p className="text-sm text-gray-500 text-center py-8">请先在「商业计划书要点」中保存至少一个版本</p>
                </div>
              ) : (
                <>
                  <div className="col-span-12 md:col-span-4 lg:col-span-3">
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                        <div className="text-sm font-bold text-gray-900">报告列表</div>
                        <button
                          type="button"
                          disabled={trainingEnded || !selectedAnalysisVersionId || isAnalyzing}
                          onClick={() => void handleAnalyze()}
                          className="px-3 py-1.5 bg-gradient-to-r from-violet-500 to-purple-500 text-white text-xs font-semibold rounded-lg disabled:opacity-50 cursor-pointer whitespace-nowrap"
                        >
                          {isAnalyzing ? '分析中…' : '生成报告'}
                        </button>
                      </div>
                      <div className="max-h-[520px] overflow-y-auto">
                        {versions.map((v) => {
                          const active = selectedAnalysisVersionId === v.id;
                          return (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => {
                                setSelectedAnalysisVersionId(v.id);
                                applyAnalysisRecord(analysisByVersionId.get(v.id));
                              }}
                              className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                                active ? 'bg-violet-50' : ''
                              }`}
                            >
                              <div className="text-sm font-bold text-gray-900 truncate">{`v${v.versionNumber}`}</div>
                              <div className="text-xs text-gray-500 mt-1 truncate">{`${v.savedAt} · ${v.operator}`}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="col-span-12 md:col-span-8 lg:col-span-9">
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                        <div className="text-sm font-bold text-gray-900">分析报告</div>
                      </div>
                      <div className="p-4">
                        {isAnalyzing ? (
                          <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-4 max-h-60 overflow-y-auto flex flex-col justify-end">
                            <p className="text-sm text-gray-700 flex items-center gap-2 m-0 mb-2 flex-shrink-0">
                              <i className="ri-loader-4-line animate-spin text-violet-500" />
                              正在生成报告，请稍候…
                            </p>
                            {analysisThinking ? (
                              <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans m-0 flex-shrink-0">
                                {analysisThinking}
                              </pre>
                            ) : (
                              <p className="text-xs text-gray-500 m-0 flex-shrink-0">正在生成中…</p>
                            )}
                          </div>
                        ) : analysisResult ? (
                          <RichTextEditor
                            value={businessPlanAnalyzeToEditorHtml(analysisResult)}
                            viewOnly
                            fitHeight={false}
                          />
                        ) : analysisMarkdownFallback ? (
                          <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                            {analysisMarkdownFallback}
                          </div>
                        ) : (
                          <div className="py-16 text-center text-sm text-gray-500">请选择左侧版本并生成报告</div>
                        )}
                      </div>
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

              {versions.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">请先在「商业计划书要点」中保存版本后再提交</p>
              ) : (
                <>
                  <p className="text-sm text-gray-600">选择要作为最终成果提交的版本：</p>
                  <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-12 md:col-span-5 lg:col-span-4 space-y-2">
                      {versions.map((v) => (
                        (() => {
                          const isSubmittedVersion = submission?.versionId === v.id;
                          const submitTag =
                            !isSubmittedVersion
                              ? null
                              : submission?.status === 'pending'
                                ? { text: '已提交审核', className: 'bg-amber-50 text-amber-700 border-amber-200' }
                                : submission?.status === 'approved'
                                  ? { text: '已通过', className: 'bg-green-50 text-green-700 border-green-200' }
                                  : submission?.status === 'rejected'
                                    ? { text: '已驳回', className: 'bg-rose-50 text-rose-700 border-rose-200' }
                                    : null;

                          return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => {
                            setSelectedSubmitVersionId(v.id);
                            void loadSubmitPreview(v.id);
                          }}
                          className={`w-full text-left border rounded-xl p-4 cursor-pointer ${
                            selectedSubmitVersionId === v.id ? 'border-violet-500 bg-violet-50' : 'border-gray-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-bold text-gray-900 m-0">
                              v{v.versionNumber} · {v.summary}
                            </p>
                            {submitTag ? (
                              <span
                                className={`shrink-0 text-[10px] leading-4 px-2 py-0.5 rounded-full border ${submitTag.className}`}
                              >
                                {submitTag.text}
                              </span>
                            ) : null}
                          </div>
                          {v.savedAt ? (
                            <p className="text-xs text-gray-500 m-0 mt-1">{v.savedAt} · {v.operator}</p>
                          ) : (
                            <p className="text-xs text-gray-500 m-0 mt-1">{v.operator}</p>
                          )}
                        </button>
                          );
                        })()
                      ))}
                    </div>
                    <div className="col-span-12 md:col-span-7 lg:col-span-8">
                      {submitPreview ? (
                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 max-h-96 overflow-y-auto">
                          <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans">{submitPreview}</pre>
                        </div>
                      ) : (
                        <div className="bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-500 text-center">
                          请在左侧选择版本查看内容
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
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
                            <i className="ri-upload-cloud-2-line mr-1.5"></i>
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
                            <i className="ri-upload-cloud-2-line mr-1.5"></i>
                            上传附件
                          </button>
                        </Upload>
                      </div>
                    </div>
                  </div>
                  {!isTeamLeader ? (
                    <p className="text-sm text-amber-700">仅队长可提交最终商业计划书。</p>
                  ) : (
                    <button
                      type="button"
                      disabled={
                        !selectedSubmitVersionId ||
                        submitting ||
                        trainingEnded ||
                        submitPptFiles.length === 0 ||
                        submission?.status === 'pending' ||
                        submission?.status === 'approved'
                      }
                      onClick={handleSubmitFinal}
                      className="w-full px-6 py-3 bg-violet-600 text-white text-sm font-medium rounded-xl disabled:opacity-50 cursor-pointer"
                    >
                      {submitting ? '提交中…' : '提交最终商业计划书'}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
