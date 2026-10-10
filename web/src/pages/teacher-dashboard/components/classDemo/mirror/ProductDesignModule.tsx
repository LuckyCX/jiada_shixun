import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Modal, message, Spin } from 'antd';
import VersionControl, { Version } from '../../../../../components/feature/VersionControl';
import { sanitizeRichText } from '../../../../../lib/richText';
import {
  fetchStudentInstanceLibrary,
  getStudentInstanceCaseCoverUrl,
  type InstanceLibraryCase,
  type InstanceLibraryCategory,
} from '../demoInstanceApi';
import {
  fetchProductDesignContext,
  fetchMyLatestProductSuggestion,
  fetchAllProductSuggestions,
  streamProductDesignSuggestion,
  fetchProductPrototypeParticipation,
  fetchTeamProductPrototypeStatus,
  uploadTeamProductPrototype,
  type ProductSuggestionPayload,
  type ProductSuggestionRecord,
  type UploadProductPrototypeError,
} from '../demoProductApi';

interface DesignTool {
  id: number;
  name: string;
  icon: string;
  url: string;
  description: string;
  color: string;
}

const MIN_PROJECT_CONTEXT_CHARS = 30;

const designTools: DesignTool[] = [
  {
    id: 1,
    name: '墨刀',
    icon: 'ri-pencil-ruler-2-line',
    url: 'https://modao.cc',
    description: '国产原型设计工具，支持团队协作',
    color: 'from-blue-500 to-indigo-500'
  },
  {
    id: 2,
    name: '墨高',
    icon: 'ri-palette-line',
    url: 'https://mockplus.cn',
    description: '快速原型设计，自动标注切图',
    color: 'from-purple-500 to-pink-500'
  },
  {
    id: 3,
    name: 'Figma',
    icon: 'ri-layout-line',
    url: 'https://www.figma.com',
    description: '在线协作设计工具，全球流行',
    color: 'from-orange-500 to-red-500'
  },
  {
    id: 4,
    name: 'Axure',
    icon: 'ri-artboard-line',
    url: 'https://www.axure.com',
    description: '专业交互原型设计工具',
    color: 'from-green-500 to-teal-500'
  },
  {
    id: 5,
    name: 'Sketch',
    icon: 'ri-brush-line',
    url: 'https://www.sketch.com',
    description: 'Mac平台UI设计利器',
    color: 'from-amber-500 to-yellow-500'
  },
  {
    id: 6,
    name: 'Adobe XD',
    icon: 'ri-compasses-2-line',
    url: 'https://www.adobe.com/products/xd.html',
    description: 'Adobe出品的UX设计工具',
    color: 'from-pink-500 to-rose-500'
  }
];

type ProductDesignModuleProps = {
  classId?: string;
  isTeamLeader?: boolean;
  trainingEnded?: boolean;
  onSuggestionGenerated?: () => void;
  onTeamPrototypeUploaded?: () => void;
  onProductTabProgress?: (doneCount: number) => void;
};

function SuggestionView({ payload }: { payload: ProductSuggestionPayload }) {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-6">
        <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <i className="ri-function-line text-blue-600"></i>
          核心功能建议
        </h4>
        <div className="space-y-4">
          {payload.coreFeatures?.map((feature, idx) => (
            <div key={idx} className="bg-white rounded-xl p-5 border border-blue-200">
              <div className="flex items-start justify-between mb-3">
                <h5 className="text-base font-bold text-gray-900">{feature.name}</h5>
                <span className="px-3 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                  {feature.priority}优先级
                </span>
              </div>
              <p className="text-sm text-gray-700 mb-3">{feature.description}</p>
              {feature.reason && (
                <p className="text-xs text-blue-700 bg-blue-50 rounded-lg p-3 mb-2">{feature.reason}</p>
              )}
              {feature.implementation && (
                <p className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3">{feature.implementation}</p>
              )}
            </div>
          ))}
        </div>
      </div>
      {payload.userExperience?.length > 0 && (
        <div className="bg-gradient-to-br from-green-50 to-teal-50 border-2 border-green-200 rounded-2xl p-6">
          <h4 className="text-lg font-bold text-gray-900 mb-4">用户体验优化</h4>
          <div className="grid md:grid-cols-2 gap-3">
            {payload.userExperience.map((s, idx) => (
              <div key={idx} className="bg-white rounded-lg p-4 border border-green-200 text-sm text-gray-700">
                {s}
              </div>
            ))}
          </div>
        </div>
      )}
      {payload.technicalArchitecture?.length > 0 && (
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-2xl p-6">
          <h4 className="text-lg font-bold text-gray-900 mb-4">技术架构建议</h4>
          <ul className="space-y-2">
            {payload.technicalArchitecture.map((t, idx) => (
              <li key={idx} className="text-sm text-gray-700 bg-white rounded-lg p-3 border border-purple-200">
                {t}
              </li>
            ))}
          </ul>
        </div>
      )}
      {payload.iterationPlan?.length > 0 && (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-6">
          <h4 className="text-lg font-bold text-gray-900 mb-4">迭代计划建议</h4>
          <div className="space-y-4">
            {payload.iterationPlan.map((phase, idx) => (
              <div key={idx} className="bg-white rounded-xl p-5 border border-amber-200">
                <h5 className="font-bold text-gray-900">{phase.phase}</h5>
                <p className="text-sm text-gray-600 mt-1">预计周期：{phase.duration}</p>
                <p className="text-sm text-gray-700 mt-2">{phase.focus}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProductDesignModule({
  classId = '',
  isTeamLeader = false,
  trainingEnded = false,
  onSuggestionGenerated,
  onTeamPrototypeUploaded,
  onProductTabProgress,
}: ProductDesignModuleProps) {
  const [activeTab, setActiveTab] = useState<'ai-suggestions' | 'cases' | 'tools' | 'upload'>('ai-suggestions');

  const [projectContext, setProjectContext] = useState('');
  const [contextLoading, setContextLoading] = useState(false);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<ProductSuggestionPayload | null>(null);
  const [latestSuggestionAt, setLatestSuggestionAt] = useState('');
  const [recordsOpen, setRecordsOpen] = useState(false);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [suggestionRecords, setSuggestionRecords] = useState<ProductSuggestionRecord[]>([]);
  const [expandedSuggestionRecordIds, setExpandedSuggestionRecordIds] = useState(() => new Set<string>());

  const [caseCategories, setCaseCategories] = useState<InstanceLibraryCategory[]>([]);
  const [casesLoading, setCasesLoading] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [previewCase, setPreviewCase] = useState<InstanceLibraryCase | null>(null);

  const [prototypeUploaded, setPrototypeUploaded] = useState(false);
  const [prototypeInfo, setPrototypeInfo] = useState({ originName: '', uploadedAt: '' });
  const [uploadingZip, setUploadingZip] = useState(false);
  const [streamStatus, setStreamStatus] = useState('');
  const [streamThinking, setStreamThinking] = useState('');
  const [streamVisible, setStreamVisible] = useState(false);
  const thinkingScrollRef = useRef<HTMLDivElement>(null);

  const [versions, setVersions] = useState<Version[]>([]);
  const [currentVersion, setCurrentVersion] = useState(1);

  const selectedCategory = useMemo(
    () => caseCategories.find((c) => c.id === selectedCategoryId) || caseCategories[0],
    [caseCategories, selectedCategoryId]
  );

  useEffect(() => {
    if (!streamVisible) return;
    const el = thinkingScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [streamVisible, streamThinking, streamStatus]);

  useEffect(() => {
    if (!recordsOpen) setExpandedSuggestionRecordIds(new Set());
  }, [recordsOpen]);

  const formatMissingNames = (members: { name: string }[]) =>
    members.map((m) => m.name).filter(Boolean).join('、') || '部分成员';

  const showMissingSuggestionDialog = (missingMembers: { id: string; name: string }[]) => {
    Modal.info({
      title: '无法上传原型',
      content: `小组成员 ${formatMissingNames(missingMembers)} 尚未生成 AI 设计建议，请先通知其完成后再上传。`,
      okText: '知道了',
    });
  };

  const loadContextAndSuggestion = useCallback(async () => {
    if (!classId) return;
    setContextLoading(true);
    try {
      const [ctx, mine] = await Promise.all([
        fetchProductDesignContext(classId),
        fetchMyLatestProductSuggestion(classId),
      ]);
      setProjectContext(ctx.contextText || '');
      if (mine.latest?.payload) {
        setAiSuggestions(mine.latest.payload);
        setLatestSuggestionAt(mine.latest.createdAt || '');
        onProductTabProgress?.(6);
      } else {
        setAiSuggestions(null);
        setLatestSuggestionAt('');
        onProductTabProgress?.(0);
      }
    } catch {
      message.error('加载产品设计数据失败');
    } finally {
      setContextLoading(false);
    }
  }, [classId, onProductTabProgress]);

  const loadPrototypeStatus = useCallback(async () => {
    if (!classId) return;
    try {
      const st = await fetchTeamProductPrototypeStatus(classId);
      setPrototypeUploaded(Boolean(st.uploaded));
      setPrototypeInfo({
        originName: st.originName || '',
        uploadedAt: st.uploadedAt || '',
      });
    } catch {
      setPrototypeUploaded(false);
      setPrototypeInfo({ originName: '', uploadedAt: '' });
    }
  }, [classId]);

  useEffect(() => {
    void loadContextAndSuggestion();
    void loadPrototypeStatus();
  }, [loadContextAndSuggestion, loadPrototypeStatus]);

  useEffect(() => {
    if (activeTab !== 'cases' || !classId) return;
    let cancelled = false;
    setCasesLoading(true);
    void fetchStudentInstanceLibrary(classId, 'product')
      .then((res) => {
        if (cancelled) return;
        const list = res.categories || [];
        setCaseCategories(list);
        if (list.length && !list.some((c) => c.id === selectedCategoryId)) {
          setSelectedCategoryId(list[0].id);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCaseCategories([]);
          message.error('加载原型案例库失败');
        }
      })
      .finally(() => {
        if (!cancelled) setCasesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, classId, selectedCategoryId]);

  const openRecords = async () => {
    if (!classId) return;
    setRecordsOpen(true);
    setRecordsLoading(true);
    try {
      const rows = await fetchAllProductSuggestions(classId);
      setSuggestionRecords(rows);
    } catch {
      message.error('加载建议记录失败');
      setSuggestionRecords([]);
    } finally {
      setRecordsLoading(false);
    }
  };

  const handleSaveVersion = (summary: string) => {
    const newVersion: Version = {
      id: `version-${Date.now()}`,
      versionNumber: versions.length + 1,
      timestamp: new Date().toLocaleString('zh-CN'),
      operator: '当前用户',
      summary,
      data: { aiSuggestions, projectContext },
    };
    setVersions([...versions, newVersion]);
    setCurrentVersion(newVersion.versionNumber);
  };

  const handleRestore = (versionId: string) => {
    const version = versions.find((v) => v.id === versionId);
    if (!version) return;
    const data = version.data as { aiSuggestions?: ProductSuggestionPayload; projectContext?: string };
    setAiSuggestions(data.aiSuggestions || null);
    setProjectContext(data.projectContext || '');
    setCurrentVersion(version.versionNumber);
  };

  const tabs = [
    { key: 'ai-suggestions' as const, label: 'AI设计建议', icon: 'ri-lightbulb-flash-line', badge: 'NEW' as string | undefined },
    { key: 'cases' as const, label: '原型案例库', icon: 'ri-gallery-line', badge: undefined },
    { key: 'tools' as const, label: '设计工具', icon: 'ri-tools-line', badge: undefined },
    { key: 'upload' as const, label: '原型上传', icon: 'ri-upload-cloud-line', badge: undefined },
  ];

  const handleGenerateAISuggestions = async () => {
    if (!classId) {
      message.warning('请先选择班级');
      return;
    }
    const text = projectContext.trim();
    if (!text) {
      message.warning('请先输入项目背景信息');
      return;
    }
    if (text.length < MIN_PROJECT_CONTEXT_CHARS) {
      message.warning(`项目背景不少于 ${MIN_PROJECT_CONTEXT_CHARS} 字`);
      return;
    }
    setIsGeneratingSuggestions(true);
    setStreamVisible(true);
    setStreamStatus('准备生成…');
    setStreamThinking('');
    try {
      await streamProductDesignSuggestion(classId, text, {
        onStatus: (msg) => setStreamStatus(msg),
        onThinking: (chunk) => setStreamThinking((s) => s + chunk),
        onError: (msg) => message.error(msg),
        onDone: (created) => {
          setAiSuggestions(created.payload);
          setLatestSuggestionAt(created.createdAt || '');
          onProductTabProgress?.(6);
          onSuggestionGenerated?.();
          message.success('AI 设计建议已生成');
        },
      });
    } catch (e) {
      message.error(e instanceof Error ? e.message : '生成失败');
    } finally {
      setIsGeneratingSuggestions(false);
      setStreamVisible(false);
      setStreamStatus('');
      setStreamThinking('');
    }
  };

  const tryUploadZip = async (file: File) => {
    if (!classId) return;
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.zip')) {
      message.warning('仅支持 ZIP 压缩包');
      return;
    }
    const { missingMembers } = await fetchProductPrototypeParticipation(classId);
    if (missingMembers.length) {
      showMissingSuggestionDialog(missingMembers);
      return;
    }
    setUploadingZip(true);
    try {
      const uploaded = await uploadTeamProductPrototype(classId, file);
      setPrototypeUploaded(true);
      setPrototypeInfo({
        originName: uploaded.originName || file.name,
        uploadedAt: new Date().toISOString(),
      });
      onTeamPrototypeUploaded?.();
      message.success('原型已上传');
    } catch (e) {
      const err = e as UploadProductPrototypeError;
      if (err.missingMembers?.length) showMissingSuggestionDialog(err.missingMembers);
      else message.error(err.message || '上传失败');
    } finally {
      setUploadingZip(false);
    }
  };

  const handleZipInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void tryUploadZip(file);
  };

  const handleLeaderPickZip = async () => {
    if (!isTeamLeader) {
      message.info('仅队长可上传团队原型');
      return;
    }
    if (!classId) return;
    try {
      const { missingMembers } = await fetchProductPrototypeParticipation(classId);
      if (missingMembers.length) {
        showMissingSuggestionDialog(missingMembers);
        return;
      }
    } catch {
      message.error('校验参与情况失败');
      return;
    }
    document.getElementById('product-prototype-zip-input')?.click();
  };

  return (
    <div className="space-y-6">
      {/* 版本控制工具栏 */}
      <VersionControl
        versions={versions}
        currentVersion={currentVersion}
        onRestore={handleRestore}
        onSaveVersion={handleSaveVersion}
        moduleName="产品设计与迭代"
      />

      {/* 模块头部 */}
      <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl shadow-xl p-8 text-white">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <i className="ri-pencil-ruler-2-line text-3xl"></i>
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-1">产品设计与迭代</h2>
              <p className="text-white/80 text-sm">
                参考优秀案例，使用专业工具，AI辅助设计，持续优化迭代
              </p>
            </div>
          </div>
        </div>
      </div>
      {/* 标签页 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === tab.key
                  ? 'text-orange-600 border-b-2 border-orange-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <i className={`${tab.icon} mr-2`}></i>
              {tab.label}
              {tab.badge && (
                <span className="ml-2 px-2 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs rounded-full">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-8">
          {/* AI设计建议 */}
          {activeTab === 'ai-suggestions' && (
            <div className="space-y-6">
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-6">
                <h3 className="text-base font-bold text-orange-900 mb-3">
                  <i className="ri-robot-line mr-2"></i>
                  AI智能设计建议
                </h3>
                <p className="text-sm text-orange-700">
                  基于你的项目背景，AI将提供功能设计、用户体验、技术架构等全方位建议
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-6 relative">
                {contextLoading && (
                  <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-xl z-10">
                    <Spin />
                  </div>
                )}
                <h4 className="text-base font-bold text-gray-900 mb-4">项目背景信息（团队共享）</h4>
                <textarea
                  value={projectContext}
                  onChange={(e) => setProjectContext(e.target.value)}
                  placeholder="请描述项目名称、目标用户、核心问题与功能需求等，便于团队共享并生成 AI 建议。"
                  className="w-full h-48 px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                  maxLength={2000}
                  disabled={isGeneratingSuggestions}
                />
                <div className="flex justify-between items-center mt-3">
                  <span className="text-xs text-gray-500">保存背景并生成建议时，将同步至全组</span>
                  <span className="text-xs text-gray-500">
                    {projectContext.length}/2000（至少{MIN_PROJECT_CONTEXT_CHARS}字）
                  </span>
                </div>
              </div>

              {streamVisible && (
                <div
                  ref={thinkingScrollRef}
                  className="rounded-xl border border-orange-200 bg-orange-50/60 p-4 max-h-52 overflow-y-auto flex flex-col justify-end"
                >
                  {streamStatus && (
                    <p className="text-sm text-gray-700 flex items-center gap-2 m-0 mb-2 flex-shrink-0">
                      <i className="ri-loader-4-line animate-spin text-orange-500" />
                      {streamStatus}
                    </p>
                  )}
                  {streamThinking ? (
                    <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans m-0 flex-shrink-0">
                      {streamThinking}
                    </pre>
                  ) : (
                    <p className="text-xs text-gray-500 m-0 flex-shrink-0">正在生成建议，请稍候…</p>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => void handleGenerateAISuggestions()}
                  disabled={
                    trainingEnded ||
                    isGeneratingSuggestions ||
                    projectContext.trim().length < MIN_PROJECT_CONTEXT_CHARS ||
                    !classId
                  }
                  className="flex-1 px-6 py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white text-base font-medium rounded-xl hover:from-orange-600 hover:to-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  {isGeneratingSuggestions ? (
                    <>
                      <i className="ri-loader-4-line mr-2 animate-spin"></i>
                      正在生成建议…
                    </>
                  ) : (
                    <>
                      <i className="ri-sparkling-line mr-2"></i>
                      保存背景并生成 AI 设计建议
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => void openRecords()}
                  disabled={!classId}
                  className="px-6 py-4 border border-gray-300 text-gray-800 text-base font-medium rounded-xl hover:bg-gray-50 disabled:opacity-50"
                >
                  <i className="ri-history-line mr-2"></i>
                  记录
                </button>
              </div>

              {aiSuggestions && (
                <div className="space-y-4">
                  {latestSuggestionAt && (
                    <p className="text-xs text-gray-500">本人最新建议：{new Date(latestSuggestionAt).toLocaleString('zh-CN')}</p>
                  )}
                  <SuggestionView payload={aiSuggestions} />
                </div>
              )}
            </div>
          )}

          {/* 原型案例库 */}
          {activeTab === 'cases' && (
            <div className="space-y-6">
              {casesLoading ? (
                <div className="flex justify-center py-16">
                  <Spin size="large" />
                </div>
              ) : caseCategories.length === 0 ? (
                <p className="text-center text-gray-500 py-12">暂无原型案例</p>
              ) : (
                <div className="flex flex-col lg:flex-row gap-6">
                  <div className="lg:w-56 flex-shrink-0 lg:sticky lg:top-4 self-start space-y-2">
                    {caseCategories.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedCategoryId(cat.id)}
                        className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                          selectedCategory?.id === cat.id
                            ? 'bg-orange-500 text-white'
                            : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                  <div className="flex-1 min-w-0">
                    {selectedCategory && (
                      <>
                        {selectedCategory.cases.length === 0 ? (
                          <p className="text-gray-500 text-sm">该分类下暂无案例</p>
                        ) : (
                          <div className="grid sm:grid-cols-2 gap-4">
                            {selectedCategory.cases.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => setPreviewCase(c)}
                                className="text-left border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow"
                              >
                                {c.hasCoverImage && classId ? (
                                  <div className="w-full h-40 bg-gray-100 border-b border-gray-200">
                                    <img
                                      src={getStudentInstanceCaseCoverUrl(classId, c.id)}
                                      alt=""
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                ) : null}
                                <div className="p-5">
                                  <h4 className="font-bold text-gray-900 mb-2">{c.title}</h4>
                                  {c.projectOutcome && (
                                    <p className="text-sm text-gray-600 line-clamp-2">{c.projectOutcome}</p>
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 设计工具 */}
          {activeTab === 'tools' && (
            <div className="space-y-6">
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-6">
                <h3 className="text-base font-bold text-orange-900 mb-3">
                  <i className="ri-tools-line mr-2"></i>
                  常用设计工具快速访问
                </h3>
                <p className="text-sm text-orange-700">
                  一键打开专业设计工具，开始创作你的产品原型，支持团队协作和在线分享
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                {designTools.map((tool) => (
                  <a
                    key={tool.id}
                    href={tool.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block border border-gray-200 rounded-xl p-6 hover:shadow-xl transition-all group cursor-pointer"
                  >
                    <div className={`w-16 h-16 bg-gradient-to-br ${tool.color} rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                      <i className={`${tool.icon} text-3xl text-white`}></i>
                    </div>
                    <h4 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                      {tool.name}
                      <i className="ri-external-link-line text-sm text-gray-400 group-hover:text-orange-500"></i>
                    </h4>
                    <p className="text-sm text-gray-600 mb-4">{tool.description}</p>
                    <div className={`inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r ${tool.color} text-white text-xs font-medium rounded-full`}>
                      <i className="ri-arrow-right-line"></i>
                      立即打开
                    </div>
                  </a>
                ))}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                <h4 className="text-sm font-bold text-blue-900 mb-3">
                  <i className="ri-information-line mr-2"></i>
                  使用提示
                </h4>
                <ul className="text-sm text-blue-700 space-y-2">
                  <li>• 建议使用墨刀或墨高进行快速原型设计，支持中文界面</li>
                  <li>• Figma适合团队协作，可实时查看其他成员的设计进度</li>
                  <li>• 完成设计后，由队长在「原型上传」页提交 ZIP 压缩包</li>
                  <li>• 记得保存设计文件链接，方便后续修改和团队共享</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="space-y-6">
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-6">
                <h3 className="text-base font-bold text-orange-900 mb-3">
                  <i className="ri-upload-cloud-line mr-2"></i>
                  团队原型提交
                </h3>
                <p className="text-sm text-orange-700">
                  每位成员须至少生成一次 AI 设计建议后，队长方可上传 ZIP 原型包；上传成功后全组完成本环节。
                </p>
              </div>

              <input
                id="product-prototype-zip-input"
                type="file"
                accept=".zip,application/zip"
                className="hidden"
                disabled={trainingEnded}
                onChange={handleZipInputChange}
              />

              {prototypeUploaded ? (
                <div className="border border-green-200 bg-green-50 rounded-xl p-6">
                  <p className="text-green-800 font-medium flex items-center gap-2">
                    <i className="ri-checkbox-circle-fill"></i>
                    团队已提交原型
                  </p>
                  {prototypeInfo.originName && (
                    <p className="text-sm text-gray-700 mt-2">文件：{prototypeInfo.originName}</p>
                  )}
                  {prototypeInfo.uploadedAt && (
                    <p className="text-sm text-gray-500 mt-1">
                      上传时间：{new Date(prototypeInfo.uploadedAt).toLocaleString('zh-CN')}
                    </p>
                  )}
                </div>
              ) : isTeamLeader ? (
                <div className="border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center">
                  <button
                    type="button"
                    onClick={() => void handleLeaderPickZip()}
                    disabled={trainingEnded || uploadingZip || !classId}
                    className="inline-flex items-center px-6 py-3 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50"
                  >
                    {uploadingZip ? (
                      <>
                        <i className="ri-loader-4-line mr-2 animate-spin"></i>
                        上传中…
                      </>
                    ) : (
                      <>
                        <i className="ri-folder-zip-line mr-2"></i>
                        选择 ZIP 文件上传
                      </>
                    )}
                  </button>
                  <p className="text-sm text-gray-500 mt-4">仅支持 .zip 格式</p>
                </div>
              ) : (
                <p className="text-sm text-gray-600 text-center py-8">请等待队长上传团队原型压缩包</p>
              )}
            </div>
          )}
        </div>
      </div>

      <Modal
        title="AI 设计建议记录"
        open={recordsOpen}
        onCancel={() => setRecordsOpen(false)}
        footer={null}
        width={860}
      >
        {recordsLoading ? (
          <div className="flex justify-center py-8">
            <Spin />
          </div>
        ) : suggestionRecords.length === 0 ? (
          <p className="text-gray-500 text-center py-6">暂无记录</p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto space-y-4">
            {suggestionRecords.map((rec) => {
              const expanded = expandedSuggestionRecordIds.has(rec.id);
              return (
                <div key={rec.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-gray-900 min-w-0 flex-1">
                      {rec.studentName}{' '}
                      <span className="text-gray-500 font-normal">
                        {rec.createdAt ? new Date(rec.createdAt).toLocaleString('zh-CN') : ''}
                      </span>
                    </p>
                    <button
                      type="button"
                      className="shrink-0 text-sm text-teal-600 hover:text-teal-700 cursor-pointer"
                      onClick={() => {
                        setExpandedSuggestionRecordIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(rec.id)) next.delete(rec.id);
                          else next.add(rec.id);
                          return next;
                        });
                      }}
                    >
                      {expanded ? '收起' : '详情'}
                    </button>
                  </div>
                  {expanded ? (
                    rec.payload && (
                      <div className="mt-4 border-t border-gray-100 pt-4 overflow-x-auto">
                        <SuggestionView payload={rec.payload} />
                      </div>
                    )
                  ) : (
                    <div className="mt-3 text-sm text-gray-700">
                      {rec.payload?.coreFeatures?.[0]?.name && (
                        <p>核心功能示例：{rec.payload.coreFeatures[0].name}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      <Modal
        title={previewCase?.title || '案例详情'}
        open={Boolean(previewCase)}
        onCancel={() => setPreviewCase(null)}
        footer={null}
        width={800}
      >
        {previewCase && (
          <div className="space-y-4">
            {previewCase.hasCoverImage && classId ? (
              <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
                <img
                  src={getStudentInstanceCaseCoverUrl(classId, previewCase.id)}
                  alt=""
                  className="w-full max-h-[min(420px,60vh)] object-contain block mx-auto"
                />
              </div>
            ) : null}
            {previewCase.tags?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {previewCase.tags.map((tag) => (
                  <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-md">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {previewCase.projectOutcome && (
              <p className="text-sm text-gray-700">
                <span className="font-medium">项目成果：</span>
                {previewCase.projectOutcome}
              </p>
            )}
            {previewCase.detailHtml && (
              <div
                className="prose prose-sm max-w-none text-gray-700"
                dangerouslySetInnerHTML={{ __html: sanitizeRichText(previewCase.detailHtml) }}
              />
            )}
          </div>
        )}
      </Modal>

      {/* 可获得能力点 */}
      {/* <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-5 flex items-center gap-2">
          <i className="ri-medal-line text-teal-600"></i>可获得能力点
        </h3>
        <div className="flex flex-wrap gap-3">
          {['产品设计', '原型开发', '迭代优化', 'AI应用'].map((ap, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-orange-200 bg-orange-50"
            >
              <i className="ri-medal-fill text-base text-orange-500"></i>
              <span className="text-sm font-semibold text-orange-700">{ap}</span>
            </div>
          ))}
        </div>
      </div> */}
    </div>
  );
}