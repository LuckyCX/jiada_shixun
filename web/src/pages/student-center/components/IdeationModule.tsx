import { useEffect, useMemo, useRef, useState, type ElementType } from 'react';
import * as AntIcons from '@ant-design/icons';
import { Button, Form, Input, Modal, Select, message } from 'antd';
import VersionControl, { Version } from '../../../components/feature/VersionControl';
import { sanitizeRichText } from '../../../lib/richText';
import {
  analyzeStudentIdeationIdea,
  fetchStudentIdeationProjectTopic,
  fetchStudentIdeationWorkspace,
  likeStudentIdeationIdea,
  sendStudentIdeationDiscussion,
  submitStudentIdeationProjectTopic,
  type IdeationProjectTopic,
  type IdeationProjectTopicInput,
  type IdeationMethodKey,
  type StudentIdeationAnalysis,
  type StudentIdeationDiscussion,
  type StudentIdeationIdea,
  type StudentIdeationPrerequisiteMember,
} from '../../../lib/studentIdeationApi';
import {
  downloadStudentInstanceResource,
  fetchStudentInstanceLibrary,
  getStudentInstanceResourcePreviewUrl,
  type InstanceLibraryCase,
  type InstanceLibraryCategory,
} from '../../../lib/teacherInstanceLibraryApi';

type AiAnalysis = StudentIdeationAnalysis;

type Idea = Omit<StudentIdeationIdea, 'aiAnalysis'> & {
  aiAnalysis?: AiAnalysis;
  analyzing?: boolean;
};

export type IdeationLearningResource = {
  id: string;
  nodeId: string;
  title: string;
  type: string;
  progress: number;
  chapterTags: string[];
};

type IdeationFormValues = {
  title?: string;
  description?: string;
  scamperDimension?: string;
  problem?: string;
  solution?: string;
  domain?: string;
  targetUser?: string;
  need?: string;
};

type IdeationTopicFormValues = IdeationProjectTopicInput;
export type IdeationModuleTab = 'examples' | 'methods' | 'confirm';

const SCAMPER_OPTIONS = [
  { label: '替代 - 可以用什么替代？', value: '替代 - 可以用什么替代？' },
  { label: '组合 - 可以和什么组合？', value: '组合 - 可以和什么组合？' },
  { label: '调整 - 可以如何调整？', value: '调整 - 可以如何调整？' },
  { label: '修改 - 可以如何修改？', value: '修改 - 可以如何修改？' },
  { label: '用途 - 还有什么用途？', value: '用途 - 还有什么用途？' },
  { label: '消除 - 可以消除什么？', value: '消除 - 可以消除什么？' },
  { label: '重组 - 可以如何重组？', value: '重组 - 可以如何重组？' },
];

const AVATAR_GRADIENTS = [
  'from-teal-500 to-cyan-500',
  'from-purple-500 to-violet-500',
  'from-orange-500 to-amber-500',
  'from-rose-500 to-pink-500',
];

type IdeationModuleProps = {
  classId: string;
  learningResources?: IdeationLearningResource[];
  isTeamLeader?: boolean;
  initialTab?: IdeationModuleTab;
  onCheckTeamPrerequisites?: () => Promise<StudentIdeationPrerequisiteMember[]>;
  onOpenLearningResource?: (resource: IdeationLearningResource) => void;
  onTaskComplete?: () => void;
};

const DEFAULT_CATEGORY_COLOR = '#8b5cf6';
const DEFAULT_CATEGORY_ICON = 'FolderOutlined';
type AntIconComponent = ElementType<{ className?: string }>;
const antIconEntries = Object.entries(AntIcons).filter(
  ([name, value]) => /(Outlined|Filled|TwoTone)$/.test(name) && (typeof value === 'function' || (typeof value === 'object' && value !== null)),
) as [
  string,
  AntIconComponent,
][];
const antIconMap = Object.fromEntries(antIconEntries) as Record<string, AntIconComponent>;

function displayColor(color?: string) {
  const value = String(color || '').trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value) ? value : DEFAULT_CATEGORY_COLOR;
}

function detailSummary(html: string) {
  return sanitizeRichText(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function CategoryIcon({ icon, className }: { icon?: string; className?: string }) {
  const Icon = antIconMap[icon || ''] || antIconMap[DEFAULT_CATEGORY_ICON];
  return <Icon className={className} />;
}

function formatMessageTime(value: string) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return '';
  const diff = Date.now() - time;
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}小时前`;
  return new Date(value).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

function resourceIcon(type: string) {
  switch (type) {
    case '视频': return 'ri-video-line';
    case '音频': return 'ri-volume-up-line';
    case '文档': return 'ri-file-pdf-2-line';
    case '图片': return 'ri-image-line';
    case '压缩包': return 'ri-file-zip-line';
    case '案例': return 'ri-book-open-line';
    default: return 'ri-file-text-line';
  }
}

function topicToFormValues(topic: IdeationProjectTopic): IdeationTopicFormValues {
  return {
    projectName: topic.projectName,
    projectDirection: topic.projectDirection || topic.direction,
    projectDescription: topic.projectDescription || topic.description,
    coreValue: topic.coreValue,
    targetUsers: topic.targetUsers,
    coreProblem: topic.coreProblem,
    solutionOverview: topic.solutionOverview,
    marketSize: topic.marketSize,
    competitiveAdvantage: topic.competitiveAdvantage,
  };
}

export default function IdeationModule({
  classId,
  learningResources = [],
  isTeamLeader = false,
  initialTab,
  onCheckTeamPrerequisites,
  onOpenLearningResource,
  onTaskComplete,
}: IdeationModuleProps) {
  const [form] = Form.useForm<IdeationFormValues>();
  const [topicForm] = Form.useForm<IdeationTopicFormValues>();
  const [activeTab, setActiveTab] = useState<IdeationModuleTab>(initialTab || 'examples');
  const [activeMethod, setActiveMethod] = useState<IdeationMethodKey>('brainstorm');
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<StudentIdeationDiscussion[]>([]);
  const [teamName, setTeamName] = useState('');
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [submittingIdea, setSubmittingIdea] = useState(false);
  const [sendingDiscussion, setSendingDiscussion] = useState(false);
  const [checkingConfirmTab, setCheckingConfirmTab] = useState(false);
  const [expandedAnalysis, setExpandedAnalysis] = useState<string | null>(null);

  const [exampleCategories, setExampleCategories] = useState<InstanceLibraryCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [examplesLoading, setExamplesLoading] = useState(false);
  const [previewCase, setPreviewCase] = useState<InstanceLibraryCase | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [projectTopic, setProjectTopic] = useState<IdeationProjectTopic | null>(null);
  const [topicLoading, setTopicLoading] = useState(false);
  const approvedNotifiedRef = useRef('');

  // 版本控制状态
  const [versions, setVersions] = useState<Version[]>([]);
  const [currentVersion, setCurrentVersion] = useState(1);

  const selectedCategory = useMemo(
    () => exampleCategories.find((cat) => cat.id === selectedCategoryId) || exampleCategories[0],
    [exampleCategories, selectedCategoryId],
  );
  const projectDirectionOptions = useMemo(
    () => exampleCategories.map((cat) => ({ label: cat.name, value: cat.name })),
    [exampleCategories],
  );

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (exampleCategories.length === 0) return;
    const direction = topicForm.getFieldValue('projectDirection');
    if (direction && !exampleCategories.some((cat) => cat.name === direction)) {
      topicForm.setFieldValue('projectDirection', undefined);
    }
  }, [exampleCategories, topicForm]);

  useEffect(() => {
    if (!classId) {
      setExampleCategories([]);
      setSelectedCategoryId('');
      return;
    }
    let cancelled = false;
    setExamplesLoading(true);
    fetchStudentInstanceLibrary(classId)
      .then((res) => {
        if (cancelled) return;
        const list = res.categories || [];
        setExampleCategories(list);
        setSelectedCategoryId((prev) => (prev && list.some((cat) => cat.id === prev) ? prev : list[0]?.id || ''));
      })
      .catch((e) => {
        if (!cancelled) {
          setExampleCategories([]);
          setSelectedCategoryId('');
          message.error(e instanceof Error ? e.message : '加载实例库失败');
        }
      })
      .finally(() => {
        if (!cancelled) setExamplesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [classId]);

  useEffect(() => {
    if (!classId) {
      setProjectTopic(null);
      topicForm.resetFields();
      return;
    }
    let cancelled = false;
    setTopicLoading(true);
    fetchStudentIdeationProjectTopic(classId)
      .then((res) => {
        if (cancelled) return;
        setProjectTopic(res.topic);
        if (res.topic) topicForm.setFieldsValue(topicToFormValues(res.topic));
        else topicForm.resetFields();
      })
      .catch((e) => {
        if (!cancelled) {
          setProjectTopic(null);
          message.error(e instanceof Error ? e.message : '加载项目选题状态失败');
        }
      })
      .finally(() => {
        if (!cancelled) setTopicLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [classId, topicForm]);

  useEffect(() => {
    if (projectTopic?.status !== 'approved') return;
    if (approvedNotifiedRef.current === projectTopic.id) return;
    approvedNotifiedRef.current = projectTopic.id;
    onTaskComplete?.();
  }, [onTaskComplete, projectTopic?.id, projectTopic?.status]);

  useEffect(() => {
    if (!classId) {
      setIdeas([]);
      setMessages([]);
      setTeamName('');
      return;
    }
    let cancelled = false;
    setWorkspaceLoading(true);
    fetchStudentIdeationWorkspace(classId)
      .then((res) => {
        if (cancelled) return;
        setTeamName(res.team?.name || '');
        setIdeas(res.ideas || []);
        setMessages(res.discussions || []);
      })
      .catch((e) => {
        if (!cancelled) {
          setTeamName('');
          setIdeas([]);
          setMessages([]);
          message.error(e instanceof Error ? e.message : '加载团队创意库失败');
        }
      })
      .finally(() => {
        if (!cancelled) setWorkspaceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [classId]);

  useEffect(() => {
    form.resetFields();
    if (activeMethod === 'scamper') {
      form.setFieldValue('scamperDimension', SCAMPER_OPTIONS[0].value);
    }
  }, [activeMethod, form]);

  // 保存当前版本
  const handleSaveVersion = (summary: string) => {
    const newVersion: Version = {
      id: `version-${Date.now()}`,
      versionNumber: versions.length + 1,
      timestamp: new Date().toLocaleString('zh-CN'),
      operator: '当前用户',
      summary,
      data: {
        ideas,
        topicDraft: topicForm.getFieldsValue(),
        messages,
        activeMethod,
      },
    };
    setVersions([...versions, newVersion]);
    setCurrentVersion(newVersion.versionNumber);
  };

  // 回撤到指定版本
  const handleRestore = (versionId: string) => {
    const version = versions.find(v => v.id === versionId);
    if (!version) return;
    
    const data = version.data;
    setIdeas(data.ideas || []);
    if (data.topicDraft) topicForm.setFieldsValue(data.topicDraft);
    setMessages(data.messages || []);
    setActiveMethod(data.activeMethod || 'brainstorm');
    setCurrentVersion(version.versionNumber);
  };

  const handleSendChat = async () => {
    const content = chatInput.trim();
    if (!content || sendingDiscussion) return;
    setSendingDiscussion(true);
    try {
      const list = await sendStudentIdeationDiscussion(classId, content);
      setMessages(list);
      setChatInput('');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '发送讨论失败');
    } finally {
      setSendingDiscussion(false);
    }
  };

  const buildFormPayload = (values: IdeationFormValues) => {
    if (activeMethod === 'brainstorm') {
      return {
        title: values.title?.trim(),
        description: values.description?.trim(),
      };
    }
    if (activeMethod === 'scamper') {
      return {
        scamperDimension: values.scamperDimension,
        title: values.title?.trim(),
        description: values.description?.trim(),
      };
    }
    if (activeMethod === 'triz') {
      return {
        title: values.title?.trim(),
        problem: values.problem?.trim(),
        solution: values.solution?.trim(),
        description: values.solution?.trim(),
      };
    }
    return {
      domain: values.domain?.trim(),
      targetUser: values.targetUser?.trim(),
      need: values.need?.trim(),
    };
  };

  const handleSubmitIdea = async (values: IdeationFormValues) => {
    setSubmittingIdea(true);
    try {
      const idea = await analyzeStudentIdeationIdea(classId, {
        methodKey: activeMethod,
        formPayload: buildFormPayload(values),
      });
      setIdeas((prev) => [idea, ...prev.filter((item) => item.id !== idea.id)]);
      setExpandedAnalysis(idea.id);
      form.resetFields();
      if (activeMethod === 'scamper') form.setFieldValue('scamperDimension', SCAMPER_OPTIONS[0].value);
      message.success('创意分析已完成');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '提交创意失败');
    } finally {
      setSubmittingIdea(false);
    }
  };

  const handleVote = async (id: string) => {
    const target = ideas.find((idea) => idea.id === id);
    if (!target || target.liked) return;
    setIdeas((prev) => prev.map((idea) => idea.id === id ? { ...idea, liked: true, votes: idea.votes + 1 } : idea));
    try {
      const next = await likeStudentIdeationIdea(classId, id);
      setIdeas((prev) => prev.map((idea) => idea.id === id ? next : idea));
    } catch (e) {
      setIdeas((prev) => prev.map((idea) => idea.id === id ? target : idea));
      message.error(e instanceof Error ? e.message : '点赞失败');
    }
  };

  const handleConfirmTabClick = async () => {
    if (!isTeamLeader) {
      if (projectTopic) {
        setActiveTab('confirm');
        return;
      }
      Modal.info({
        title: '仅队长可确定项目选题',
        content: '项目选题需由小组队长统一确认，请与队长沟通后共同确定。',
        okText: '确定',
        okButtonProps: { className: '!bg-teal-500 !border-teal-500 hover:!bg-teal-600' },
        onOk: () => setActiveTab('methods'),
      });
      setActiveTab('methods');
      return;
    }
    setCheckingConfirmTab(true);
    try {
      const incompleteMembers = await onCheckTeamPrerequisites?.();
      if (incompleteMembers && incompleteMembers.length > 0) {
        Modal.info({
          title: '请先完成实践课程',
          content: `小组成员 ${incompleteMembers.map((member) => member.name).join('、')} 还未完成实践课程的学习任务，先让他们完成后再一起来确定项目选题吧。`,
          okText: '确定',
          okButtonProps: { className: '!bg-teal-500 !border-teal-500 hover:!bg-teal-600' },
          onOk: () => setActiveTab('methods'),
        });
        setActiveTab('methods');
        return;
      }
      setActiveTab('confirm');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '检查小组学习状态失败');
      setActiveTab('methods');
    } finally {
      setCheckingConfirmTab(false);
    }
  };

  const handleConfirmTheme = async (values: IdeationTopicFormValues) => {
    if (!isTeamLeader) {
      message.warning('仅队长可提交项目选题');
      return;
    }
    setIsSubmitting(true);
    try {
      const topic = await submitStudentIdeationProjectTopic(classId, values);
      setProjectTopic(topic);
      topicForm.setFieldsValue(topicToFormValues(topic));
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '提交项目选题失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canEditTopic = isTeamLeader && (!projectTopic || projectTopic.status === 'rejected');
  const topicStatusTitle =
    projectTopic?.status === 'approved'
      ? '项目选题已通过'
      : projectTopic?.status === 'rejected'
        ? '项目选题已退回'
        : '项目选题已提交';
  const topicStatusDesc =
    projectTopic?.status === 'approved'
      ? '教师已通过项目选题，请按课程设置时间进入下一阶段。'
      : projectTopic?.status === 'rejected'
        ? '请根据教师意见修改后重新提交。'
        : '你的项目选题正在等待教师审核，审核通过后即可进入下一阶段。';

  const methodTabs = [
    { key: 'brainstorm' as const, label: '头脑风暴', icon: 'ri-lightbulb-flash-line', color: 'from-teal-500 to-cyan-500' },
    { key: 'scamper' as const, label: 'SCAMPER', icon: 'ri-compass-3-line', color: 'from-orange-500 to-amber-500' },
    { key: 'triz' as const, label: 'TRIZ', icon: 'ri-puzzle-line', color: 'from-green-500 to-emerald-500' },
    { key: 'ai' as const, label: 'AI创意', icon: 'ri-sparkling-line', color: 'from-rose-500 to-pink-500' },
  ];

  const scoreBg = (score: number) => {
    if (score >= 90) return 'from-emerald-500 to-green-500';
    if (score >= 75) return 'from-teal-500 to-cyan-500';
    if (score >= 60) return 'from-amber-500 to-yellow-500';
    return 'from-red-500 to-rose-500';
  };

  return (
    <div className="space-y-6">
      {/* 版本控制工具栏 */}
      <VersionControl
        versions={versions}
        currentVersion={currentVersion}
        onRestore={handleRestore}
        onSaveVersion={handleSaveVersion}
        moduleName="创新思维与创意生成"
      />

      {/* 模块头部 */}
      <div className="bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
            <i className="ri-lightbulb-flash-line text-2xl"></i>
          </div>
          <div>
            <h2 className="text-xl font-bold mb-1">创新思维与创意生成</h2>
            <p className="text-white/80 text-sm">运用结构化方法生成并筛选高质量创业点子</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation - 实例库在前 */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setActiveTab('examples')}
          className={`px-5 py-2.5 text-sm font-semibold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'examples'
              ? 'bg-gradient-to-r from-purple-500 to-violet-500 text-white shadow-lg'
              : 'bg-white text-gray-700 border border-gray-200 hover:border-purple-300'
          }`}
        >
          <i className="ri-archive-line mr-2"></i>
          实例库
        </button>
        <button
          onClick={() => setActiveTab('methods')}
          className={`px-5 py-2.5 text-sm font-semibold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'methods'
              ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-lg'
              : 'bg-white text-gray-700 border border-gray-200 hover:border-teal-300'
          }`}
        >
          <i className={`ri-lightbulb-flash-line mr-2 ${activeTab === 'methods' ? 'text-white' : 'text-teal-500'}`}></i>
          创新方法工具
        </button>
        <button
          onClick={() => void handleConfirmTabClick()}
          disabled={checkingConfirmTab}
          className={`px-5 py-2.5 text-sm font-semibold rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'confirm'
              ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg'
              : checkingConfirmTab
                ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                : 'bg-white text-gray-700 border border-gray-200 hover:border-orange-300 cursor-pointer'
          }`}
        >
          <i className="ri-checkbox-circle-line mr-2"></i>
          {checkingConfirmTab ? '检查学习状态...' : '确定项目选题'}
        </button>
      </div>

      {/* 实例库 Tab */}
      {activeTab === 'examples' && (
        <div className="grid grid-cols-4 gap-6 min-h-[calc(100vh-270px)]">
          {/* 左侧分类导航 */}
          <div className="col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sticky top-24 max-h-[calc(100vh-280px)] overflow-y-auto">
              <h3 className="text-base font-bold text-gray-900 mb-4">垂直方向</h3>
              <div className="space-y-2">
                {exampleCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className={`w-full px-4 py-3 text-sm font-medium rounded-xl transition-all text-left flex items-center gap-3 cursor-pointer ${
                      selectedCategory.id === cat.id
                        ? 'text-white shadow-md'
                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                    }`}
                    style={selectedCategory.id === cat.id ? { backgroundColor: displayColor(cat.color) } : undefined}
                  >
                    <CategoryIcon className="text-base flex-shrink-0" icon={cat.icon} />
                    <span>{cat.name}</span>
                  </button>
                ))}
                {!examplesLoading && exampleCategories.length === 0 && (
                  <div className="rounded-xl border border-dashed border-gray-200 p-4 text-center text-sm text-gray-500">暂无实例方向</div>
                )}
              </div>
            </div>
          </div>

          {/* 右侧案例展示 */}
          <div className="col-span-3">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 max-h-[calc(100vh-280px)] flex flex-col">
              {selectedCategory ? (
                <>
                  <div className="flex items-center gap-3 mb-6">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-white"
                      style={{ backgroundColor: displayColor(selectedCategory.color) }}
                    >
                      <CategoryIcon className="text-2xl" icon={selectedCategory.icon} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{selectedCategory.name}</h2>
                      <p className="text-sm text-gray-500">参考以下实例，激发创新灵感（共{selectedCategory.cases.length}个实例）</p>
                    </div>
                  </div>

                  <div className="space-y-4 overflow-y-auto pr-2">
                    {selectedCategory.cases.map((caseItem) => (
                      <div key={caseItem.id} className="border border-gray-200 rounded-xl p-5 hover:shadow-lg hover:border-teal-200 transition-all">
                        <div className="flex items-start justify-between mb-2 gap-4">
                          <div className="flex-1">
                            <h3 className="text-base font-bold text-gray-900 mb-2">{caseItem.title}</h3>
                            <p
                              className="text-sm text-gray-600 leading-relaxed mb-3"
                              style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden' }}
                            >
                              {detailSummary(caseItem.detailHtml)}
                            </p>
                            <div className="flex items-center gap-2 mb-3 flex-wrap">
                              {caseItem.tags.map((tag) => (
                                <span key={tag} className="px-2.5 py-1 bg-teal-50 text-teal-700 text-xs font-medium rounded-full whitespace-nowrap">
                                  {tag}
                                </span>
                              ))}
                            </div>
                            <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg p-2.5">
                              <i className="ri-trophy-line text-green-600 text-sm mt-0.5"></i>
                              <div>
                                <p className="text-xs font-semibold text-green-800 mb-0.5">项目成果</p>
                                <p className="text-xs text-green-700">{caseItem.projectOutcome || '未填写'}</p>
                              </div>
                            </div>
                          </div>
                          <button type="button" onClick={() => setPreviewCase(caseItem)} className="text-sm text-teal-600 font-medium cursor-pointer">
                            查看详情
                          </button>
                        </div>
                      </div>
                    ))}
                    {!examplesLoading && selectedCategory.cases.length === 0 && (
                      <div className="rounded-xl border border-dashed border-gray-200 p-10 text-center text-sm text-gray-500">暂无实例</div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 rounded-xl border border-dashed border-gray-200 p-12 text-center text-sm text-gray-500">
                  {examplesLoading ? '实例库加载中...' : '暂无实例'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 创新方法工具 Tab */}
      {activeTab === 'methods' && (
        <div className="grid grid-cols-3 gap-6">
         

          {/* 左侧栏 */}
          <div className="col-span-2 space-y-5">
            {/* 创新方法工具 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-base font-bold text-gray-900 mb-4">创新方法工具</h3>
              <div className="grid grid-cols-4 gap-2 mb-5">
                {methodTabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveMethod(tab.key)}
                    className={`px-3 py-2.5 text-xs font-semibold rounded-xl transition-all whitespace-nowrap cursor-pointer flex items-center justify-center gap-1.5 ${
                      activeMethod === tab.key
                        ? `bg-gradient-to-br ${tab.color} text-white shadow-md`
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <i className={tab.icon}></i>
                    {tab.label}
                  </button>
                ))}
              </div>

              <Form form={form} layout="vertical" onFinish={handleSubmitIdea} className="space-y-4">
                {activeMethod === 'brainstorm' && (
                  <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
                    <h4 className="text-sm font-bold text-teal-900 mb-1">头脑风暴法</h4>
                    <p className="text-xs text-teal-700 mb-2">自由发散思维，不限制创意方向，鼓励大胆想象</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-teal-700">
                      <span>延迟判断，先发散后收敛</span>
                      <span>鼓励自由联想和组合</span>
                      <span>追求数量，不限质量</span>
                    </div>
                  </div>
                )}

                {activeMethod === 'scamper' && (
                  <>
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                      <h4 className="text-sm font-bold text-orange-900 mb-1">SCAMPER奔驰法</h4>
                      <p className="text-xs text-orange-700 mb-2">从7个维度改进现有产品或服务</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-orange-700">
                        <span>S - 替代 (Substitute)</span>
                        <span>C - 组合 (Combine)</span>
                        <span>A - 调整 (Adapt)</span>
                        <span>M - 修改 (Modify)</span>
                        <span>P - 用途 (Put to other uses)</span>
                        <span>E - 消除 (Eliminate)</span>
                        <span>R - 重组 (Rearrange)</span>
                      </div>
                    </div>
                    <Form.Item
                      label="选择改进维度"
                      name="scamperDimension"
                      initialValue={SCAMPER_OPTIONS[0].value}
                      rules={[{ required: true, message: '请选择改进维度' }]}
                    >
                      <Select options={SCAMPER_OPTIONS} />
                    </Form.Item>
                  </>
                )}

                {activeMethod === 'triz' && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <h4 className="text-sm font-bold text-green-900 mb-1">TRIZ创新原理</h4>
                    <p className="text-xs text-green-700">基于40个创新原理解决技术矛盾，识别问题中的矛盾，运用TRIZ原理找到创新解决方案</p>
                  </div>
                )}

                {activeMethod === 'ai' && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
                    <h4 className="text-sm font-bold text-rose-900 mb-1">AI智能创意生成</h4>
                    <p className="text-xs text-rose-700">基于市场趋势和用户需求，AI为你生成创新创意</p>
                  </div>
                )}

                {activeMethod !== 'ai' && (
                  <Form.Item
                    label="创意标题"
                    name="title"
                    rules={[{ required: true, whitespace: true, message: '请输入创意标题' }]}
                  >
                    <Input maxLength={80} placeholder="用一句话描述你的创意" />
                  </Form.Item>
                )}

                {(activeMethod === 'brainstorm' || activeMethod === 'scamper') && (
                  <Form.Item
                    label="创意描述"
                    name="description"
                    rules={[{ required: true, whitespace: true, message: '请输入创意描述' }]}
                  >
                    <Input.TextArea rows={4} maxLength={500} showCount placeholder="详细描述你的创意，包括核心亮点和初步可行性分析" />
                  </Form.Item>
                )}

                {activeMethod === 'triz' && (
                  <>
                    <Form.Item
                      label="问题描述"
                      name="problem"
                      rules={[{ required: true, whitespace: true, message: '请输入问题描述' }]}
                    >
                      <Input.TextArea rows={3} maxLength={500} showCount placeholder="描述你想解决的问题或技术矛盾" />
                    </Form.Item>
                    <Form.Item
                      label="解决方案"
                      name="solution"
                      rules={[{ required: true, whitespace: true, message: '请输入解决方案' }]}
                    >
                      <Input.TextArea rows={3} maxLength={500} showCount placeholder="运用TRIZ原理提出的解决方案" />
                    </Form.Item>
                  </>
                )}

                {activeMethod === 'ai' && (
                  <>
                    <Form.Item
                      label="目标领域"
                      name="domain"
                      rules={[{ required: true, whitespace: true, message: '请输入目标领域' }]}
                    >
                      <Input maxLength={80} placeholder="例如：教育科技、智慧校园、健康管理" />
                    </Form.Item>
                    <Form.Item
                      label="目标用户"
                      name="targetUser"
                      rules={[{ required: true, whitespace: true, message: '请输入目标用户' }]}
                    >
                      <Input maxLength={80} placeholder="例如：大学生、上班族、老年人" />
                    </Form.Item>
                    <Form.Item
                      label="核心需求"
                      name="need"
                      rules={[{ required: true, whitespace: true, message: '请输入核心需求' }]}
                    >
                      <Input.TextArea rows={3} maxLength={500} showCount placeholder="描述目标用户的核心痛点和需求" />
                    </Form.Item>
                  </>
                )}

                <Button
                  htmlType="submit"
                  type="primary"
                  loading={submittingIdea}
                  block
                  className="!h-10 !rounded-xl !font-semibold !border-0 !bg-gradient-to-r !from-teal-500 !to-cyan-600 hover:!from-teal-600 hover:!to-cyan-700 !shadow-sm hover:!shadow-md"
                >
                  <i className="ri-sparkling-line text-white"></i>
                  {activeMethod === 'ai' ? 'AI生成创意并分析' : '提交创意并获取AI分析'}
                </Button>
              </Form>
            </div>

            {/* 团队创意库 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <i className="ri-archive-line text-teal-600"></i>
                  团队创意库
                  <span className="px-2 py-0.5 bg-teal-100 text-teal-700 text-xs font-semibold rounded-full">{ideas.length}</span>
                </h3>
                {/* <button className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer">
                  <i className="ri-download-line mr-1"></i>导出报告
                </button> */}
              </div>
              <div className="space-y-4">
                {workspaceLoading && (
                  <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">团队创意库加载中...</div>
                )}
                {!workspaceLoading && ideas.length === 0 && (
                  <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">
                    {teamName ? '暂无团队创意' : '教师确认组队后可共享团队创意库'}
                  </div>
                )}
                {ideas.map((idea) => (
                  <div key={idea.id} className="border-2 border-gray-100 rounded-xl overflow-hidden hover:shadow-md hover:border-teal-200 transition-all">
                    {/* 创意基本信息 */}
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0 pr-3">
                          <h4 className="text-sm font-bold text-gray-900 mb-1">{idea.title}</h4>
                          <p className="text-xs text-gray-500 leading-relaxed mb-2">{idea.description}</p>
                          <div className="flex items-center gap-3 text-xs text-gray-400">
                            <span className="flex items-center gap-1">
                              <i className="ri-user-line"></i>
                              {idea.author}
                            </span>
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full whitespace-nowrap">{idea.method}</span>
                            {idea.aiAnalysis && (
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold bg-gradient-to-r ${scoreBg(idea.aiAnalysis.overallScore)} text-white whitespace-nowrap`}>
                                AI评分 {idea.aiAnalysis.overallScore}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleVote(idea.id)}
                            disabled={idea.liked}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                              idea.liked ? 'bg-teal-500 text-white cursor-default' : 'bg-teal-50 text-teal-600 hover:bg-teal-100 cursor-pointer'
                            }`}
                          >
                            <i className="ri-thumb-up-line"></i>
                            {idea.votes}
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-5 pt-3 border-t border-gray-100">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-500">新颖性</span>
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <i
                                key={s}
                                className={`${
                                  s <= (idea.aiAnalysis?.novelty ?? idea.novelty) ? 'ri-star-fill text-amber-400' : 'ri-star-line text-gray-300'
                                } text-xs`}
                              ></i>
                            ))}
                          </div>
                          <span className="text-xs font-semibold text-gray-700">{idea.aiAnalysis?.novelty ?? idea.novelty}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-500">可行性</span>
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <i
                                key={s}
                                className={`${
                                  s <= (idea.aiAnalysis?.feasibility ?? idea.feasibility) ? 'ri-star-fill text-green-400' : 'ri-star-line text-gray-300'
                                } text-xs`}
                              ></i>
                            ))}
                          </div>
                          <span className="text-xs font-semibold text-gray-700">{idea.aiAnalysis?.feasibility ?? idea.feasibility}</span>
                        </div>
                        {idea.aiAnalysis && (
                          <>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-gray-500">市场潜力</span>
                              <div className="flex items-center gap-0.5">
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <i key={s} className={`${s <= idea.aiAnalysis!.marketPotential ? 'ri-star-fill text-rose-400' : 'ri-star-line text-gray-300'} text-xs`}></i>
                                ))}
                              </div>
                              <span className="text-xs font-semibold text-gray-700">{idea.aiAnalysis.marketPotential}</span>
                            </div>
                            <button
                              onClick={() => setExpandedAnalysis(expandedAnalysis === idea.id ? null : idea.id)}
                              className="ml-auto flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium cursor-pointer whitespace-nowrap"
                            >
                              <i className={`${expandedAnalysis === idea.id ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'}`}></i>
                              {expandedAnalysis === idea.id ? '收起分析' : '查看AI分析'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* AI分析加载中 */}
                    {idea.analyzing && (
                      <div className="border-t border-gray-100 bg-gradient-to-br from-violet-50 to-indigo-50 p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 flex items-center justify-center bg-gradient-to-br from-violet-500 to-indigo-500 rounded-xl flex-shrink-0">
                            <i className="ri-sparkling-line text-white text-sm animate-spin"></i>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-violet-800">AI正在分析你的创意...</p>
                            <p className="text-xs text-violet-600 mt-0.5">正在评估新颖性、可行性、市场潜力和创新价值</p>
                          </div>
                          <div className="ml-auto flex gap-1">
                            {[0, 1, 2].map((i) => (
                              <div key={i} className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }}></div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* AI分析结果展开面板 */}
                    {idea.aiAnalysis && expandedAnalysis === idea.id && (
                      <div className="border-t border-teal-100 bg-gradient-to-br from-slate-50 to-teal-50/30 p-5 space-y-4">
                        {/* 顶部评分概览 */}
                        <div className="flex items-center gap-4">
                          <div className={`w-16 h-16 bg-gradient-to-br ${scoreBg(idea.aiAnalysis.overallScore)} rounded-2xl flex flex-col items-center justify-center text-white shadow-md`}>
                            <span className="text-xl font-black leading-none">{idea.aiAnalysis.overallScore}</span>
                            <span className="text-xs opacity-80 mt-0.5">综合分</span>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <i className="ri-robot-2-line text-teal-500 text-sm"></i>
                              <span className="text-sm font-bold text-gray-900">AI创意分析报告</span>
                            </div>
                            <p className="text-xs text-gray-600 leading-relaxed">{idea.aiAnalysis.summary}</p>
                          </div>
                        </div>

                        {/* 四维雷达评分 */}
                        <div className="grid grid-cols-4 gap-2">
                          {[
                            { label: '新颖性', value: idea.aiAnalysis.novelty, color: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700' },
                            { label: '可行性', value: idea.aiAnalysis.feasibility, color: 'bg-green-500', bg: 'bg-green-50', text: 'text-green-700' },
                            { label: '市场潜力', value: idea.aiAnalysis.marketPotential, color: 'bg-rose-500', bg: 'bg-rose-50', text: 'text-rose-700' },
                            { label: '创新价值', value: idea.aiAnalysis.innovation, color: 'bg-teal-500', bg: 'bg-teal-50', text: 'text-teal-700' },
                          ].map((dim) => (
                            <div key={dim.label} className={`${dim.bg} rounded-xl p-3 text-center`}>
                              <div className={`text-lg font-black ${dim.text}`}>{dim.value}</div>
                              <div className="text-xs text-gray-500 mb-1.5">{dim.label}</div>
                              <div className="h-1.5 bg-white rounded-full overflow-hidden">
                                <div className={`h-full ${dim.color} rounded-full transition-all`} style={{ width: `${(dim.value / 5) * 100}%` }}></div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* 优势 & 不足 */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                            <h5 className="text-xs font-bold text-emerald-800 mb-2 flex items-center gap-1.5">
                              <i className="ri-thumb-up-fill text-emerald-500"></i>创意优势
                            </h5>
                            <ul className="space-y-1.5">
                              {idea.aiAnalysis.strengths.map((s, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-xs text-emerald-700">
                                  <i className="ri-check-line text-emerald-500 flex-shrink-0 mt-0.5"></i>
                                  {s}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                            <h5 className="text-xs font-bold text-amber-800 mb-2 flex items-center gap-1.5">
                              <i className="ri-error-warning-fill text-amber-500"></i>待改进点
                            </h5>
                            <ul className="space-y-1.5">
                              {idea.aiAnalysis.weaknesses.map((w, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-xs text-amber-700">
                                  <i className="ri-arrow-right-line text-amber-500 flex-shrink-0 mt-0.5"></i>
                                  {w}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {/* AI建议 */}
                        <div className="bg-white border border-teal-100 rounded-xl p-3">
                          <h5 className="text-xs font-bold text-gray-800 mb-2 flex items-center gap-1.5">
                            <i className="ri-lightbulb-line text-teal-500"></i>AI优化建议
                          </h5>
                          <ul className="space-y-2">
                            {idea.aiAnalysis.suggestions.map((sug, i) => (
                              <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                                <span className="w-4 h-4 flex-shrink-0 bg-teal-100 text-teal-700 rounded-full flex items-center justify-center font-bold text-xs">{i + 1}</span>
                                {sug}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* 标签 */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-gray-400">AI标签：</span>
                          {idea.aiAnalysis.tags.map((tag, i) => (
                            <span key={i} className="px-2.5 py-1 bg-teal-100 text-teal-700 text-xs font-medium rounded-full whitespace-nowrap">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
           {/* 右侧主内容 */}
           <div className="col-span-1 space-y-5">
              {/* 团队讨论 */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                <i className="ri-chat-3-line text-orange-500"></i>团队讨论
              </h3>
              <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
                {messages.length === 0 && (
                  <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-xs text-gray-500">
                    {teamName ? '暂无团队讨论' : '教师确认组队后可参与团队讨论'}
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div key={msg.id} className="bg-gray-50 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div
                        className={`w-6 h-6 bg-gradient-to-br ${AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length]} rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}
                      >
                        {msg.author.charAt(0)}
                      </div>
                      <span className="text-xs font-semibold text-gray-900">{msg.author}</span>
                      <span className="text-xs text-gray-400 ml-auto">{formatMessageTime(msg.createdAt)}</span>
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed">{msg.text}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void handleSendChat()}
                  placeholder="输入你的想法..."
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
                <button
                  onClick={() => void handleSendChat()}
                  disabled={sendingDiscussion}
                  className={`w-9 h-9 flex items-center justify-center bg-gradient-to-br from-teal-500 to-cyan-500 text-white rounded-xl hover:shadow-md transition-all flex-shrink-0 ${
                    sendingDiscussion ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'
                  }`}
                >
                  <i className="ri-send-plane-fill text-sm"></i>
                </button>
              </div>
            </div>
            {/* 学习资源 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                <i className="ri-book-open-line text-teal-500"></i>学习资源
              </h3>
              <div className="space-y-4">
                {learningResources.length === 0 && (
                  <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-xs text-gray-500">当前实训模块暂无学习资源</div>
                )}
                {learningResources.map((res) => (
                  <button
                    key={res.id}
                    type="button"
                    onClick={() => onOpenLearningResource?.(res)}
                    className="w-full text-left border-b border-gray-100 last:border-0 pb-3 last:pb-0 cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-gray-900 mb-1 truncate">{res.title}</h4>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <i className={resourceIcon(res.type)}></i>
                            {res.type}
                          </span>
                        </div>
                       
                      </div>
                      {res.type !== '压缩包' && res.progress === 100 && (
                        <i className="ri-checkbox-circle-fill text-green-500 text-base ml-2 flex-shrink-0"></i>
                      )}
                    </div>
                    {res.type !== '压缩包' && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full"
                            style={{ width: `${res.progress}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-500 whitespace-nowrap">{res.progress}%</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

          
          </div>
        </div>
      )}

      {/* 确定项目选题 Tab */}
      {activeTab === 'confirm' && (
        <div className="max-w-3xl mx-auto">
          {canEditTopic ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
              {projectTopic?.status === 'rejected' && (
                <div className="mb-6 rounded-xl border border-rose-100 bg-rose-50 p-4">
                  <div className="flex items-start gap-2">
                    <i className="ri-error-warning-line text-rose-500 mt-0.5"></i>
                    <div>
                      <div className="text-sm font-semibold text-rose-700">选题已退回</div>
                      <p className="text-sm text-rose-700 mt-1">{projectTopic.reviewComment || '请根据教师意见修改后重新提交。'}</p>
                    </div>
                  </div>
                </div>
              )}
              {topicLoading ? (
                <div className="py-16 text-center text-sm text-gray-400">加载项目选题状态...</div>
              ) : (
                <Form
                  form={topicForm}
                  layout="vertical"
                  onFinish={handleConfirmTheme}
                  disabled={isSubmitting}
                  requiredMark={false}
                >
                  <Form.Item name="projectName" label="项目名称" rules={[{ required: true, message: '请输入项目名称' }, { min: 5, message: '项目名称至少需要5个字' }]}>
                    <Input placeholder="为你的项目起一个响亮的名字" />
                  </Form.Item>
                  <Form.Item name="projectDirection" label="项目方向" rules={[{ required: true, message: '请选择项目方向' }]}>
                    <Select
                      placeholder="请选择项目方向"
                      options={projectDirectionOptions}
                      loading={examplesLoading}
                      disabled={examplesLoading || projectDirectionOptions.length === 0}
                      showSearch
                      optionFilterProp="label"
                      notFoundContent={examplesLoading ? '加载中...' : '暂无可选方向'}
                    />
                  </Form.Item>
                  <Form.Item name="projectDescription" label="项目描述" rules={[{ required: true, message: '请输入项目描述' }]}>
                    <Input.TextArea rows={3} placeholder="概述项目要做什么、面向什么场景" />
                  </Form.Item>
                  <Form.Item name="coreValue" label="核心价值主张" rules={[{ required: true, message: '请输入核心价值主张' }, { min: 20, message: '核心价值主张至少需要20个字' }]}>
                    <Input.TextArea rows={2} placeholder="说明项目为用户创造什么价值" />
                  </Form.Item>
                  <Form.Item name="targetUsers" label="目标用户" rules={[{ required: true, message: '请输入目标用户' }, { min: 10, message: '目标用户描述至少需要10个字' }]}>
                    <Input placeholder="例如：大学生、上班族、老年人" />
                  </Form.Item>
                  <Form.Item name="coreProblem" label="解决的核心问题" rules={[{ required: true, message: '请输入解决的核心问题' }, { min: 50, message: '解决的核心问题至少需要50个字' }]}>
                    <Input.TextArea rows={3} placeholder="描述目标用户面临的核心痛点和问题" />
                  </Form.Item>
                  <Form.Item name="solutionOverview" label="解决方案概述" rules={[{ required: true, message: '请输入解决方案概述' }, { min: 100, message: '解决方案概述至少需要100个字' }]}>
                    <Input.TextArea rows={4} placeholder="简要描述你的解决方案和核心功能" />
                  </Form.Item>
                  <Form.Item name="marketSize" label="市场规模" rules={[{ required: true, message: '请输入市场规模' }]}>
                    <Input.TextArea rows={2} placeholder="说明潜在用户、市场空间或需求规模" />
                  </Form.Item>
                  <Form.Item name="competitiveAdvantage" label="竞争优势" rules={[{ required: true, message: '请输入竞争优势' }]}>
                    <Input.TextArea rows={3} placeholder="说明项目与现有方案相比的差异和优势" />
                  </Form.Item>
                  <Button
                    htmlType="submit"
                    loading={isSubmitting}
                    block
                    className="!h-11 !rounded-xl !border-0 !bg-gradient-to-r !from-teal-500 !to-cyan-600 !font-semibold !text-white hover:!from-teal-600 hover:!to-cyan-700"
                  >
                    {projectTopic?.status === 'rejected' ? '重新提交选题' : '提交选题'}
                  </Button>
                </Form>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12">
              <div className="text-center">
                <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 ${
                  projectTopic?.status === 'approved' ? 'bg-gradient-to-br from-emerald-100 to-teal-100' : 'bg-gradient-to-br from-amber-100 to-orange-100'
                }`}>
                  <i className={`${projectTopic?.status === 'approved' ? 'ri-checkbox-circle-line text-teal-500' : 'ri-time-line text-orange-500'} text-5xl`}></i>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">{topicStatusTitle}</h2>
                <p className="text-base text-gray-600 mb-8">{topicStatusDesc}</p>
                
                <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-6 mb-8 text-left">
                  <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <i className="ri-file-list-3-line text-orange-500"></i>
                    已提交的项目信息
                  </h3>
                  <div className="space-y-3">
                    {[
                      ['项目名称', projectTopic?.projectName],
                      ['项目方向', projectTopic?.direction],
                      ['项目描述', projectTopic?.description],
                      ['目标用户', projectTopic?.targetUsers],
                      ['核心价值主张', projectTopic?.coreValue],
                      ['解决的核心问题', projectTopic?.coreProblem],
                      ['解决方案概述', projectTopic?.solutionOverview],
                      ['市场规模', projectTopic?.marketSize],
                      ['竞争优势', projectTopic?.competitiveAdvantage],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <span className="text-xs font-semibold text-gray-500">{label}：</span>
                        <p className="text-sm text-gray-900 mt-1 whitespace-pre-wrap break-all">{value || '未填写'}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-center gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                  <i className={`${projectTopic?.status === 'approved' ? 'ri-checkbox-circle-line text-teal-500' : 'ri-information-line text-blue-500'} text-xl`}></i>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-blue-900">{projectTopic?.status === 'approved' ? '已通过' : '审核中'}</p>
                    <p className="text-xs text-blue-700">{projectTopic?.reviewComment || (projectTopic?.status === 'approved' ? '请按课程设置进入下一阶段' : '教师将对你的项目选题进行评审，请耐心等待')}</p>
                  </div>
                </div>

                {/* 下一步提示 */}
                <div className="bg-gray-50 rounded-xl p-5">
                  <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center justify-center gap-2">
                    <i className="ri-lightbulb-line text-teal-500"></i>
                    审核通过后你可以
                  </h4>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div className="bg-white rounded-lg p-3 text-center">
                      <i className="ri-search-line text-teal-500 text-2xl mb-2"></i>
                      <p className="text-gray-700">开展市场调研</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center">
                      <i className="ri-palette-line text-purple-500 text-2xl mb-2"></i>
                      <p className="text-gray-700">进行产品设计</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center">
                      <i className="ri-file-text-line text-orange-500 text-2xl mb-2"></i>
                      <p className="text-gray-700">撰写商业计划</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 成功提示 */}
      {showSuccess && (
        <div className="fixed bottom-8 right-8 bg-green-500 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-bounce z-50">
          <i className="ri-checkbox-circle-fill text-2xl"></i>
          <div>
            <p className="font-bold">项目选题已提交！</p>
            <p className="text-sm opacity-90">等待教师审核通过后即可继续</p>
          </div>
        </div>
      )}

      <Modal
        title={previewCase?.title || '实例详情'}
        open={Boolean(previewCase)}
        onCancel={() => setPreviewCase(null)}
        footer={null}
        width="min(900px, calc(100vw - 48px))"
        styles={{ body: { overflowX: 'hidden' } }}
      >
        {previewCase && (
          <div className="space-y-4 max-h-[calc(100vh-220px)] overflow-y-auto overflow-x-hidden pr-2">
            <div className="flex items-center gap-2 flex-wrap">
              {previewCase.tags.map((tag) => (
                <span key={tag} className="px-2.5 py-1 bg-teal-50 text-teal-700 text-xs font-medium rounded-full whitespace-nowrap">
                  {tag}
                </span>
              ))}
            </div>
            <div
              className="prose max-w-none overflow-x-hidden break-words [&_*]:max-w-full [&_img]:h-auto [&_table]:w-full"
              dangerouslySetInnerHTML={{ __html: sanitizeRichText(previewCase.detailHtml) }}
            />
            <div className="rounded-lg bg-green-50 border border-green-200 p-3">
              <p className="text-xs font-semibold text-green-800 mb-1">项目成果</p>
              <p className="text-sm text-green-700">{previewCase.projectOutcome || '未填写'}</p>
            </div>
            {previewCase.resources.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-900">附件</p>
                {previewCase.resources.map((resource) => (
                  <div key={resource.id} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 text-sm overflow-hidden">
                    <div className="flex items-center gap-2 min-w-0">
                      <i className="ri-attachment-2 text-gray-500"></i>
                      <span className="truncate text-gray-700">{resource.originName}</span>
                      <span className="text-xs text-gray-400">{resource.size}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      {resource.canPreview && (
                        <a href={getStudentInstanceResourcePreviewUrl(classId, resource.id)} target="_blank" rel="noreferrer" className="text-blue-600">
                          预览
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => downloadStudentInstanceResource(classId, resource.id, resource.originName)}
                        className="text-teal-600 cursor-pointer"
                      >
                        下载
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
