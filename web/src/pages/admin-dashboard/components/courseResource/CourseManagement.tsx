import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Checkbox, Form, Input, InputNumber, Modal, Radio, Select } from 'antd';
import AppModalPortal from '../../../../components/AppModalPortal';
import {
  type CourseKnowledgePoint,
  type CourseQuizQuestion,
  type CourseResourceFile,
  type CourseResourceModule,
  type CourseResourceNode,
  courseResourceFileUrl,
  createCourseKnowledgePoint,
  createCourseQuizQuestion,
  createCourseResourceNode,
  deleteCourseKnowledgePoint,
  deleteCourseQuizQuestion,
  deleteCourseResourceFile,
  deleteCourseResourceNode,
  listCourseQuizQuestions,
  listCourseResources,
  saveNodeKnowledgePoints,
  updateCourseKnowledgePoint,
  updateCourseQuizQuestion,
  updateCourseResourceNodeStatus,
  uploadCourseResourceFile,
} from '../../../../lib/courseResourceApi';
import TrainingModuleResources from '../../../teacher-dashboard/components/trainingModuleResources';

type AddNodeState = { parentId: string | null; parentLevel: 0 | 1 | 2 } | null;
type ResourceContentTab = 'course' | 'instance';
type ConfirmState = {
  title: string;
  content: string;
  confirmText?: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
} | null;
type QuestionDraft = {
  type: CourseQuizQuestion['type'];
  question: string;
  options: string[];
  singleAnswer: number;
  multipleAnswers: number[];
  score: string;
  keywordsText: string;
  explanation: string;
};

const emptyQuestionDraft: QuestionDraft = {
  type: 'single',
  question: '',
  options: ['', '', '', ''],
  singleAnswer: 0,
  multipleAnswers: [],
  score: '10',
  keywordsText: '',
  explanation: '',
};

function countNodes(nodes: CourseResourceNode[]) {
  const stats = { chapters: 0, sections: 0, leaves: 0, published: 0, resources: 0 };
  const walk = (items: CourseResourceNode[]) => {
    items.forEach((node) => {
      if (node.level === 1) stats.chapters += 1;
      if (node.level === 2) stats.sections += 1;
      if (node.level === 3) {
        stats.leaves += 1;
        if (node.status === 'published') stats.published += 1;
        stats.resources += node.resources.length;
      }
      walk(node.children);
    });
  };
  walk(nodes);
  return stats;
}

const resourceIcon: Record<CourseResourceFile['type'], string> = {
  video: 'ri-video-line',
  audio: 'ri-volume-up-line',
  pdf: 'ri-file-pdf-line',
  image: 'ri-image-line',
  archive: 'ri-file-zip-line',
  case: 'ri-file-zip-line',
};

const resourceColor: Record<CourseResourceFile['type'], string> = {
  video: 'text-red-500 bg-red-50',
  audio: 'text-purple-500 bg-purple-50',
  pdf: 'text-teal-500 bg-teal-50',
  image: 'text-green-500 bg-green-50',
  archive: 'text-amber-500 bg-amber-50',
  case: 'text-amber-500 bg-amber-50',
};

const COURSEWARE_ACCEPT = [
  '.pdf',
  '.doc',
  '.docx',
  '.ppt',
  '.pptx',
  '.xls',
  '.xlsx',
  'image/*',
  'video/*',
  'audio/*',
  '.zip',
  '.rar',
  '.7z',
  '.tar',
  '.gz',
  '.tgz',
].join(',');
const COURSEWARE_ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.ppt',
  '.pptx',
  '.xls',
  '.xlsx',
  '.zip',
  '.rar',
  '.7z',
  '.tar',
  '.gz',
  '.tgz',
]);

function canUploadCourseware(file: File) {
  const name = file.name.toLowerCase();
  const ext = name.includes('.') ? `.${name.split('.').pop()}` : '';
  return (
    COURSEWARE_ALLOWED_EXTENSIONS.has(ext) ||
    file.type.startsWith('image/') ||
    file.type.startsWith('video/') ||
    file.type.startsWith('audio/')
  );
}

const TRAINING_MODULE_TABS: CourseResourceModule[] = [
  { key: 'ideation', name: '创新思维与创意生成', shortName: '创新思维', color: 'bg-gradient-to-r from-teal-500 to-teal-600' },
  { key: 'market', name: '市场调研与用户画像', shortName: '市场调研', color: 'bg-gradient-to-r from-green-500 to-green-600' },
  { key: 'product', name: '产品设计与迭代', shortName: '产品设计', color: 'bg-gradient-to-r from-orange-500 to-orange-600' },
  { key: 'business', name: '商业模式设计', shortName: '商业模式', color: 'bg-gradient-to-r from-pink-500 to-pink-600' },
  { key: 'simulation', name: 'AI仿真模拟', shortName: 'AI仿真', color: 'bg-gradient-to-r from-indigo-500 to-indigo-600' },
  { key: 'plan', name: '商业计划书要点', shortName: '商业计划', color: 'bg-gradient-to-r from-teal-600 to-cyan-600' },
];

const modalOkButtonProps = {
  style: { backgroundColor: '#14b8a6', borderColor: '#14b8a6' },
};
const TEXT_MAX_LENGTH = 300;

type CourseManagementProps = {
  selectedModule?: string;
  hideModuleTabs?: boolean;
};

export default function CourseManagement({ selectedModule: selectedModuleProp, hideModuleTabs = false }: CourseManagementProps) {
  const modules = TRAINING_MODULE_TABS;
  const [internalSelectedModule, setInternalSelectedModule] = useState(TRAINING_MODULE_TABS[0].key);
  const [resourceContentTab, setResourceContentTab] = useState<ResourceContentTab>('course');
  const [nodes, setNodes] = useState<CourseResourceNode[]>([]);
  const [knowledgePoints, setKnowledgePoints] = useState<CourseKnowledgePoint[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [addNodeState, setAddNodeState] = useState<AddNodeState>(null);
  const [newNodeTitle, setNewNodeTitle] = useState('');
  const [uploadNode, setUploadNode] = useState<CourseResourceNode | null>(null);
  const [uploading, setUploading] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [editKnowledgeNode, setEditKnowledgeNode] = useState<CourseResourceNode | null>(null);
  const [selectedKnowledgeIds, setSelectedKnowledgeIds] = useState<string[]>([]);
  const [knowledgeDialogOpen, setKnowledgeDialogOpen] = useState(false);
  const [knowledgeCreateOpen, setKnowledgeCreateOpen] = useState(false);
  const [activeKnowledgeId, setActiveKnowledgeId] = useState<string | null>(null);
  const [newKnowledgeTitle, setNewKnowledgeTitle] = useState('');
  const [newKnowledgeDesc, setNewKnowledgeDesc] = useState('');
  const [editingKnowledge, setEditingKnowledge] = useState<CourseKnowledgePoint | null>(null);
  const [editKnowledgeTitle, setEditKnowledgeTitle] = useState('');
  const [editKnowledgeDesc, setEditKnowledgeDesc] = useState('');
  const [questions, setQuestions] = useState<CourseQuizQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionEditorOpen, setQuestionEditorOpen] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [questionDraft, setQuestionDraft] = useState<QuestionDraft>(emptyQuestionDraft);

  const selectedModule = modules.some((m) => m.key === selectedModuleProp)
    ? String(selectedModuleProp)
    : internalSelectedModule;
  const currentModule = modules.find((m) => m.key === selectedModule) || null;
  const activeKnowledge = knowledgePoints.find((kp) => kp.id === activeKnowledgeId) || null;
  const stats = useMemo(() => countNodes(nodes), [nodes]);
  const otherQuestionsScore = useMemo(
    () => questions.reduce((total, q) => total + (q.id === editingQuestionId ? 0 : Number(q.score || 0)), 0),
    [editingQuestionId, questions]
  );
  const questionScoreMax = Math.max(0, 100 - otherQuestionsScore);
  const supportsInstanceLibraryTab = selectedModule === 'ideation' || selectedModule === 'product';
  const instanceLibraryLabel = selectedModule === 'product' ? '原型案例库' : '实例库';

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2200);
  }, []);

  const loadData = useCallback(async (moduleKey = selectedModule) => {
    setLoading(true);
    try {
      const data = await listCourseResources(moduleKey);
      setNodes(data.nodes);
      setKnowledgePoints(data.knowledgePoints);
      setActiveKnowledgeId((prev) => (prev && data.knowledgePoints.some((kp) => kp.id === prev) ? prev : data.knowledgePoints[0]?.id || null));
      setExpanded((prevExpanded) => {
        const nextExpanded: Record<string, boolean> = {};
        const walk = (items: CourseResourceNode[]) => {
          items.forEach((node) => {
            if (node.level < 3) nextExpanded[node.id] = prevExpanded[node.id] ?? true;
            walk(node.children);
          });
        };
        walk(data.nodes);
        return nextExpanded;
      });
    } catch (e) {
      showToast(e instanceof Error ? e.message : '课程资源加载失败');
    } finally {
      setLoading(false);
    }
  }, [selectedModule, showToast]);

  useEffect(() => {
    loadData(selectedModule);
  }, [loadData, selectedModule]);

  useEffect(() => {
    if (!supportsInstanceLibraryTab && resourceContentTab !== 'course') {
      setResourceContentTab('course');
    }
  }, [resourceContentTab, supportsInstanceLibraryTab]);

  useEffect(() => {
    if (!knowledgeDialogOpen || !activeKnowledgeId) {
      setQuestions([]);
      return;
    }
    setQuestionsLoading(true);
    listCourseQuizQuestions(activeKnowledgeId)
      .then(setQuestions)
      .catch((e) => showToast(e instanceof Error ? e.message : '题目加载失败'))
      .finally(() => setQuestionsLoading(false));
  }, [knowledgeDialogOpen, activeKnowledgeId, showToast]);

  const openAddNode = (parentId: string | null, parentLevel: 0 | 1 | 2) => {
    setAddNodeState({ parentId, parentLevel });
    setNewNodeTitle('');
  };

  const handleAddNode = async () => {
    if (!addNodeState || !newNodeTitle.trim()) return;
    if (!selectedModule) {
      showToast('暂无可用实训环节');
      return;
    }
    try {
      const { node } = await createCourseResourceNode({
        moduleKey: selectedModule,
        parentId: addNodeState.parentId,
        title: newNodeTitle.trim(),
      });
      if (node.level === 3) {
        await updateCourseResourceNodeStatus(node.id, 'published');
      }
      setAddNodeState(null);
      await loadData();
      showToast('已添加');
    } catch (e) {
      showToast(e instanceof Error ? e.message : '添加失败');
    }
  };

  const askDeleteNode = (node: CourseResourceNode) => {
    setConfirmState({
      title: `删除${node.level === 1 ? '章节' : '小节'}`,
      content: `确认删除「${node.title}」？删除后其下所有节点、关联资源记录和已上传源文件将一并删除。`,
      confirmText: '确认删除',
      danger: true,
      onConfirm: async () => {
        await deleteCourseResourceNode(node.id);
        await loadData();
        showToast('已删除');
      },
    });
  };

  const handleUpload = async (file: File) => {
    if (!uploadNode) return;
    if (!canUploadCourseware(file)) {
      showToast('仅支持 PDF、Office、图片、视频、音频文件；其他资料请上传压缩包');
      return;
    }
    setUploading(true);
    try {
      await uploadCourseResourceFile(uploadNode.id, file);
      setUploadNode(null);
      await loadData();
      showToast('课件已上传');
    } catch (e) {
      showToast(e instanceof Error ? e.message : '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const askDeleteResource = (resource: CourseResourceFile) => {
    setConfirmState({
      title: '删除资源文件',
      content: `确认删除「${resource.name}」？删除后将同步移除源文件。`,
      confirmText: '确认删除',
      danger: true,
      onConfirm: async () => {
        await deleteCourseResourceFile(resource.id);
        await loadData();
        showToast('资源已删除');
      },
    });
  };

  const openResource = (resource: CourseResourceFile) => {
    if (resource.canPreview) {
      window.open(courseResourceFileUrl(resource.id, 'preview'), '_blank', 'noopener,noreferrer');
      return;
    }
    const link = document.createElement('a');
    link.href = courseResourceFileUrl(resource.id, 'download');
    link.download = resource.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast('文件已下载');
  };

  const openKnowledgePicker = (node: CourseResourceNode) => {
    setEditKnowledgeNode(node);
    setSelectedKnowledgeIds(node.knowledgePoints.map((kp) => kp.id));
  };

  const saveKnowledgePicker = async () => {
    if (!editKnowledgeNode) return;
    try {
      await saveNodeKnowledgePoints(editKnowledgeNode.id, selectedKnowledgeIds);
      setEditKnowledgeNode(null);
      await loadData();
      showToast('知识点已关联');
    } catch (e) {
      showToast(e instanceof Error ? e.message : '保存失败');
    }
  };

  const handleCreateKnowledge = async () => {
    if (!newKnowledgeTitle.trim()) return;
    try {
      const kp = await createCourseKnowledgePoint({
        moduleKey: selectedModule,
        title: newKnowledgeTitle.trim(),
        description: newKnowledgeDesc.trim(),
      });
      setKnowledgePoints((prev) => [...prev, kp]);
      setActiveKnowledgeId(kp.id);
      setNewKnowledgeTitle('');
      setNewKnowledgeDesc('');
      setKnowledgeCreateOpen(false);
      showToast('知识点已添加');
    } catch (e) {
      showToast(e instanceof Error ? e.message : '添加失败');
    }
  };

  const openEditKnowledge = (kp: CourseKnowledgePoint) => {
    setEditingKnowledge(kp);
    setEditKnowledgeTitle(kp.title);
    setEditKnowledgeDesc(kp.description || '');
  };

  const handleUpdateKnowledge = async () => {
    if (!editingKnowledge || !editKnowledgeTitle.trim()) return;
    if (editKnowledgeDesc.length > TEXT_MAX_LENGTH) {
      showToast('总字数不能超过300字');
      return;
    }
    try {
      const saved = await updateCourseKnowledgePoint(editingKnowledge.id, {
        title: editKnowledgeTitle.trim(),
        description: editKnowledgeDesc.trim(),
      });
      setKnowledgePoints((prev) => prev.map((item) => (item.id === saved.id ? saved : item)));
      setEditingKnowledge(null);
      setEditKnowledgeTitle('');
      setEditKnowledgeDesc('');
      await loadData();
      showToast('知识点已保存');
    } catch (e) {
      showToast(e instanceof Error ? e.message : '保存失败');
    }
  };

  const askDeleteKnowledge = (kp: CourseKnowledgePoint) => {
    setConfirmState({
      title: '删除知识点',
      content: `确认删除「${kp.title}」？关联的检测题也将删除。`,
      confirmText: '确认删除',
      danger: true,
      onConfirm: async () => {
        await deleteCourseKnowledgePoint(kp.id);
        const next = knowledgePoints.filter((item) => item.id !== kp.id);
        setKnowledgePoints(next);
        setActiveKnowledgeId(next[0]?.id || null);
        setQuestions([]);
        showToast('知识点已删除');
      },
    });
  };

  const resetQuestionForm = () => {
    setEditingQuestionId(null);
    setQuestionDraft(emptyQuestionDraft);
  };

  const openCreateQuestion = () => {
    resetQuestionForm();
    setQuestionEditorOpen(true);
  };

  const editQuestion = (q: CourseQuizQuestion) => {
    setEditingQuestionId(q.id);
    setQuestionDraft({
      type: q.type,
      question: q.question,
      options: q.options?.length ? q.options : ['', ''],
      singleAnswer: typeof q.correctAnswer === 'number' ? q.correctAnswer : 0,
      multipleAnswers: Array.isArray(q.correctAnswer) ? q.correctAnswer : [],
      score: String(q.score),
      keywordsText: q.keywords.join('、'),
      explanation: q.explanation,
    });
    setQuestionEditorOpen(true);
  };

  const saveQuestion = async () => {
    if (!activeKnowledgeId) return;
    const score = Number(questionDraft.score || 0);
    if (score > questionScoreMax) {
      showToast('所有题目总分值不能大于100');
      return;
    }
    if (questionDraft.question.length > TEXT_MAX_LENGTH || questionDraft.explanation.length > TEXT_MAX_LENGTH) {
      showToast('总字数不能超过300字');
      return;
    }
    const optionEntries = questionDraft.options
      .map((item, idx) => ({ text: item.trim(), originalIdx: idx }))
      .filter((item) => item.text);
    const options = optionEntries.map((item) => item.text);
    const optionIndexMap = new Map(optionEntries.map((item, idx) => [item.originalIdx, idx]));
    const payload: Omit<CourseQuizQuestion, 'id'> = {
      type: questionDraft.type,
      question: questionDraft.question.trim(),
      options: questionDraft.type === 'short' ? [] : options,
      correctAnswer:
        questionDraft.type === 'single'
          ? optionIndexMap.get(questionDraft.singleAnswer)
          : questionDraft.type === 'multiple'
            ? questionDraft.multipleAnswers.map((idx) => optionIndexMap.get(idx)).filter((idx): idx is number => idx !== undefined)
            : undefined,
      keywords: questionDraft.keywordsText.split(/[、,\n]/).map((v) => v.trim()).filter(Boolean),
      score,
      explanation: questionDraft.explanation.trim(),
    };
    try {
      const saved = editingQuestionId
        ? await updateCourseQuizQuestion(activeKnowledgeId, editingQuestionId, payload)
        : await createCourseQuizQuestion(activeKnowledgeId, payload);
      setQuestions((prev) => (editingQuestionId ? prev.map((q) => (q.id === saved.id ? saved : q)) : [...prev, saved]));
      resetQuestionForm();
      setQuestionEditorOpen(false);
      showToast('题目已保存');
    } catch (e) {
      showToast(e instanceof Error ? e.message : '保存失败');
    }
  };

  const askDeleteQuestion = (question: CourseQuizQuestion) => {
    if (!activeKnowledgeId) return;
    setConfirmState({
      title: '删除题目',
      content: '确认删除该检测题？',
      confirmText: '确认删除',
      danger: true,
      onConfirm: async () => {
        await deleteCourseQuizQuestion(activeKnowledgeId, question.id);
        setQuestions((prev) => prev.filter((q) => q.id !== question.id));
        if (editingQuestionId === question.id) {
          resetQuestionForm();
          setQuestionEditorOpen(false);
        }
        showToast('题目已删除');
      },
    });
  };

  const updateDraftOption = (idx: number, value: string) => {
    setQuestionDraft((prev) => ({
      ...prev,
      options: prev.options.map((item, itemIdx) => (itemIdx === idx ? value : item)),
    }));
  };

  const addDraftOption = () => {
    setQuestionDraft((prev) => ({ ...prev, options: [...prev.options, ''] }));
  };

  const removeDraftOption = (idx: number) => {
    setQuestionDraft((prev) => {
      const nextOptions = prev.options.filter((_, itemIdx) => itemIdx !== idx);
      return {
        ...prev,
        options: nextOptions.length ? nextOptions : [''],
        singleAnswer: Math.min(prev.singleAnswer, Math.max(nextOptions.length - 1, 0)),
        multipleAnswers: prev.multipleAnswers.filter((item) => item !== idx).map((item) => (item > idx ? item - 1 : item)),
      };
    });
  };

  const toggleMultipleAnswer = (idx: number) => {
    setQuestionDraft((prev) => ({
      ...prev,
      multipleAnswers: prev.multipleAnswers.includes(idx)
        ? prev.multipleAnswers.filter((item) => item !== idx)
        : [...prev.multipleAnswers, idx].sort((a, b) => a - b),
    }));
  };

  const questionTypeText = (type: CourseQuizQuestion['type']) => {
    if (type === 'single') return '单选题';
    if (type === 'multiple') return '多选题';
    return '简答题';
  };

  const answerText = (question: CourseQuizQuestion) => {
    if (question.type === 'short') return question.keywords.length ? question.keywords.join('、') : '未设置关键词';
    if (question.type === 'single') {
      const idx = typeof question.correctAnswer === 'number' ? question.correctAnswer : -1;
      return idx >= 0 ? question.options[idx] || `选项${idx + 1}` : '未设置';
    }
    const answers = Array.isArray(question.correctAnswer) ? question.correctAnswer : [];
    return answers.length ? answers.map((idx) => question.options[idx] || `选项${idx + 1}`).join('、') : '未设置';
  };

  const renderLeaf = (leaf: CourseResourceNode) => (
    <div key={leaf.id} className="border border-gray-100 rounded-xl p-4 hover:border-teal-200 transition-all bg-white">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h4 className="text-sm font-bold text-gray-900">{leaf.title}</h4>
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${leaf.status === 'published' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
              {leaf.status === 'published' ? '已发布' : '未发布'}
            </span>
          </div>
          {leaf.knowledgePoints.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <i className="ri-price-tag-3-line text-teal-500 text-xs"></i>
              {leaf.knowledgePoints.map((point) => (
                <span key={point.id} className="px-2 py-0.5 bg-teal-50 text-teal-600 text-xs rounded-md">{point.title}</span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => openKnowledgePicker(leaf)} className="px-3 py-1.5 bg-teal-50 text-teal-600 text-xs font-medium rounded-lg hover:bg-teal-100 transition-colors whitespace-nowrap cursor-pointer">
            <i className="ri-price-tag-3-line mr-1"></i>关联知识点
          </button>
          <button onClick={() => setUploadNode(leaf)} className="px-3 py-1.5 bg-indigo-50 text-indigo-600 text-xs font-medium rounded-lg hover:bg-indigo-100 transition-colors whitespace-nowrap cursor-pointer">
            <i className="ri-upload-2-line mr-1"></i>上传课件
          </button>
        </div>
      </div>
      {leaf.resources.length ? (
        <div className="space-y-2">
          {leaf.resources.map((resource) => (
            <div key={resource.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all">
              <div className={`w-9 h-9 rounded-lg ${resourceColor[resource.type]} flex items-center justify-center flex-shrink-0`}>
                <i className={`${resourceIcon[resource.type]} text-base`}></i>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{resource.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">{resource.size} · 上传于 {resource.uploadTime}</div>
              </div>
              <button onClick={() => openResource(resource)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-white text-gray-600 hover:bg-teal-50 hover:text-teal-600 transition-colors cursor-pointer">
                <i className={resource.canPreview ? 'ri-eye-line text-sm' : 'ri-download-2-line text-sm'}></i>
              </button>
              <button onClick={() => askDeleteResource(resource)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-white text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer">
                <i className="ri-delete-bin-line text-sm"></i>
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 bg-gray-50 rounded-lg text-gray-400 text-xs">
          <i className="ri-folder-open-line text-2xl mb-1 block"></i>
          暂无课件资源，点击“上传课件”添加内容
        </div>
      )}
    </div>
  );

  const renderSection = (section: CourseResourceNode) => (
    <div key={section.id} className="border border-gray-100 rounded-xl bg-gray-50/50 p-3">
      <div className="flex items-center justify-between ">
        <button onClick={() => setExpanded((prev) => ({ ...prev, [section.id]: !prev[section.id] }))} className="flex items-center gap-2 text-left cursor-pointer">
          <i className={`${expanded[section.id] ? 'ri-arrow-down-s-line' : 'ri-arrow-right-s-line'} text-gray-400 text-lg`}></i>
          <span className="text-sm font-bold text-gray-900">{section.title}</span>
          <span className="text-xs text-gray-400">{section.children.length} 个子小节</span>
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => openAddNode(section.id, 2)} className="px-3 py-1.5 bg-white text-indigo-600 text-xs font-medium rounded-lg hover:bg-indigo-50 transition-colors whitespace-nowrap cursor-pointer">
            <i className="ri-add-line mr-1"></i>新增子小节
          </button>
          <button onClick={() => askDeleteNode(section)} className="px-3 py-1.5 bg-white text-red-500 text-xs font-medium rounded-lg hover:bg-red-50 transition-colors whitespace-nowrap cursor-pointer">
            <i className="ri-delete-bin-line mr-1"></i>删除
          </button>
        </div>
      </div>
      {expanded[section.id] && <div className="space-y-3">{section.children.length ? section.children.map(renderLeaf) : <div className="text-center py-6 bg-white rounded-lg text-gray-400 text-xs">暂无子小节</div>}</div>}
    </div>
  );

  const renderChapter = (chapter: CourseResourceNode) => (
    <div key={chapter.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-teal-50 to-cyan-50">
        <button type="button" onClick={() => setExpanded((prev) => ({ ...prev, [chapter.id]: !prev[chapter.id] }))} className="flex flex-1 items-center gap-3 text-left cursor-pointer min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
            <i className="ri-book-open-line text-white text-sm"></i>
          </div>
          <div className="min-w-0 flex flex-col justify-center">
            <h3 className="text-sm font-bold text-gray-900 leading-5 truncate">{chapter.title}</h3>
            <div className="text-xs text-gray-500 mt-0.5">{chapter.children.length} 个小节</div>
          </div>
        </button>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => openAddNode(chapter.id, 1)} className="px-3 py-1.5 bg-white text-teal-600 text-xs font-medium rounded-lg hover:bg-teal-50 transition-colors whitespace-nowrap cursor-pointer">
            <i className="ri-add-line mr-1"></i>新增小节
          </button>
          <button onClick={() => askDeleteNode(chapter)} className="px-3 py-1.5 bg-white text-red-500 text-xs font-medium rounded-lg hover:bg-red-50 transition-colors whitespace-nowrap cursor-pointer">
            <i className="ri-delete-bin-line mr-1"></i>删除
          </button>
          <button type="button" onClick={() => setExpanded((prev) => ({ ...prev, [chapter.id]: !prev[chapter.id] }))} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-white hover:text-teal-600 transition-colors cursor-pointer">
            <i className={`${expanded[chapter.id] ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} text-lg`}></i>
          </button>
        </div>
      </div>
      {expanded[chapter.id] && (
        <div className="p-4 space-y-3">
          {chapter.children.length ? chapter.children.map(renderSection) : (
            <div className="text-center py-8 text-gray-400 text-sm">
              <i className="ri-inbox-line text-3xl mb-2 block"></i>
              暂无小节
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderCourseActions = () => (
    <div className="flex items-center gap-2 flex-shrink-0">
      <button onClick={() => setKnowledgeDialogOpen(true)} className="px-4 py-2 bg-white border border-teal-200 text-teal-600 text-sm font-medium rounded-xl hover:bg-teal-50 transition-colors whitespace-nowrap cursor-pointer">
        <i className="ri-price-tag-3-line mr-1.5"></i>知识点维护
      </button>
      <button onClick={() => openAddNode(null, 0)} className="px-4 py-2 bg-teal-500 text-white text-sm font-medium rounded-xl hover:bg-teal-600 transition-colors whitespace-nowrap cursor-pointer">
        <i className="ri-add-line mr-1.5"></i>新增章节
      </button>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        {!hideModuleTabs && (
          <div className="border-gray-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 overflow-x-auto">
              {modules.map((mod) => (
                <button key={mod.key} type="button" onClick={() => setInternalSelectedModule(mod.key)} className={`px-5 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap text-sm ${selectedModule === mod.key ? `${mod.color} text-white shadow-lg` : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {mod.shortName}
                </button>
              ))}
            </div>
            {!supportsInstanceLibraryTab && renderCourseActions()}
          </div>
        )}
        {hideModuleTabs && !supportsInstanceLibraryTab && resourceContentTab === 'course' && (
          <div className="flex items-center justify-end">
            {renderCourseActions()}
          </div>
        )}
        {supportsInstanceLibraryTab && <div className="  border-gray-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {[
              { key: 'course' as ResourceContentTab, label: '课程资源' },
              { key: 'instance' as ResourceContentTab, label: instanceLibraryLabel },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setResourceContentTab(tab.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  resourceContentTab === tab.key ? 'bg-teal-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {resourceContentTab === 'course' && renderCourseActions()}
        </div>}
        {resourceContentTab === 'course' && <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-5 gap-3">
          {[
            ['课程章节', stats.chapters, 'ri-book-line', 'bg-teal-50', 'text-teal-500', 'text-teal-700'],
            ['课程小节', stats.sections, 'ri-list-check', 'bg-indigo-50', 'text-indigo-500', 'text-indigo-700'],
            ['子小节', stats.leaves, 'ri-node-tree', 'bg-cyan-50', 'text-cyan-500', 'text-cyan-700'],
            ['已发布', stats.published, 'ri-checkbox-circle-line', 'bg-green-50', 'text-green-500', 'text-green-700'],
            ['课件资源', stats.resources, 'ri-folder-line', 'bg-orange-50', 'text-orange-500', 'text-orange-700'],
          ].map(([label, value, icon, bg, iconCls, valCls]) => (
            <div key={String(label)} className={`flex items-center gap-2 ${bg} rounded-xl px-3 py-2.5`}>
              <i className={`${icon} ${iconCls} text-sm`}></i>
              <div>
                <div className="text-xs text-gray-500">{label}</div>
                <div className={`text-lg font-bold ${valCls}`}>{value}</div>
              </div>
            </div>
          ))}
        </div>}
      </div>

      {resourceContentTab === 'course' ? <div className="space-y-3">
        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center text-gray-400 text-sm">课程资源加载中...</div>
        ) : nodes.length ? (
          nodes.map(renderChapter)
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center text-gray-400 text-sm">
            <i className="ri-inbox-line text-4xl mb-3 block"></i>
            当前环节暂无课程章节
          </div>
        )}
      </div> : <TrainingModuleResources selectedModule={selectedModule} hideModuleTabs />}

      {addNodeState ? (
        <AppModalPortal open onMaskClick={() => setAddNodeState(null)} zIndex={50}>
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-gray-900 mb-4">{addNodeState.parentLevel === 0 ? '新增章节' : addNodeState.parentLevel === 1 ? '新增小节' : '新增子小节'}</h3>
            <input value={newNodeTitle} onChange={(e) => setNewNodeTitle(e.target.value)} placeholder="请输入名称" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500" autoFocus />
            <div className="flex items-center gap-3 mt-5">
              <button onClick={() => setAddNodeState(null)} className="flex-1 px-4 py-2 bg-gray-100 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors cursor-pointer">取消</button>
              <button onClick={handleAddNode} className="flex-1 px-4 py-2 bg-teal-500 text-white text-sm font-medium rounded-xl hover:bg-teal-600 transition-colors cursor-pointer">确认添加</button>
            </div>
          </div>
        </AppModalPortal>
      ) : null}

      {uploadNode ? (
        <AppModalPortal open onMaskClick={() => setUploadNode(null)} zIndex={50}>
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900">上传课件资源</h3>
                <p className="text-xs text-gray-400 mt-0.5">{uploadNode.title}</p>
              </div>
              <button onClick={() => setUploadNode(null)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer">
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
            <div className="p-6">
              <label className="block border-2 border-dashed border-gray-200 hover:border-teal-300 hover:bg-gray-50 rounded-2xl p-8 text-center cursor-pointer">
                <input type="file" accept={COURSEWARE_ACCEPT} className="hidden" disabled={uploading} onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center">
                  <i className="ri-upload-cloud-2-line text-white text-3xl"></i>
                </div>
                <div className="text-sm font-medium text-gray-900 mb-1">{uploading ? '上传中...' : '点击选择文件'}</div>
                <div className="text-xs text-gray-400">支持 PDF、Office、图片、视频、音频；其他资料请上传压缩包</div>
              </label>
            </div>
          </div>
        </AppModalPortal>
      ) : null}

      {editKnowledgeNode ? (
        <AppModalPortal open onMaskClick={() => setEditKnowledgeNode(null)} zIndex={50}>
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-gray-900 mb-4">关联知识点</h3>
            <div className="flex flex-wrap gap-2 max-h-72 overflow-y-auto p-3 bg-gray-50 rounded-xl">
              {knowledgePoints.map((point) => (
                <button key={point.id} onClick={() => setSelectedKnowledgeIds((prev) => (prev.includes(point.id) ? prev.filter((id) => id !== point.id) : [...prev, point.id]))} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap ${selectedKnowledgeIds.includes(point.id) ? 'bg-teal-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}>
                  {selectedKnowledgeIds.includes(point.id) && <i className="ri-check-line mr-1"></i>}
                  {point.title}
                </button>
              ))}
              {!knowledgePoints.length && <div className="w-full text-center py-8 text-xs text-gray-400">请先维护当前环节知识点</div>}
            </div>
            <div className="flex items-center gap-3 mt-5">
              <button onClick={() => setEditKnowledgeNode(null)} className="flex-1 px-4 py-2 bg-gray-100 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors cursor-pointer">取消</button>
              <button onClick={saveKnowledgePicker} className="flex-1 px-4 py-2 bg-teal-500 text-white text-sm font-medium rounded-xl hover:bg-teal-600 transition-colors cursor-pointer">保存设置</button>
            </div>
          </div>
        </AppModalPortal>
      ) : null}

      <Modal
        title={
          <div>
            <div className="text-base font-bold text-gray-900">知识点维护</div>
            <div className="text-xs text-gray-400 mt-0.5">{currentModule?.name || '暂无实训环节'}</div>
          </div>
        }
        open={knowledgeDialogOpen}
        onCancel={() => setKnowledgeDialogOpen(false)}
        footer={null}
        width={1120}
      >
        <div className="h-[70vh] grid grid-cols-[320px_1fr] overflow-hidden rounded-2xl border border-gray-100 bg-gray-50">
          <div className="bg-white border-r border-gray-100 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto p-3 pb-20 space-y-1.5">
              {knowledgePoints.map((kp) => (
                <div
                  key={kp.id}
                  onClick={() => setActiveKnowledgeId(kp.id)}
                  className={`group rounded-xl border px-3 py-2.5 transition-all cursor-pointer ${
                    activeKnowledgeId === kp.id
                      ? 'border-teal-300 bg-teal-50 shadow-sm'
                      : 'border-gray-100 bg-white hover:border-teal-100 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">{kp.title}</div>
                      {kp.description && <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{kp.description}</div>}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditKnowledge(kp);
                        }}
                        className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-400 hover:bg-teal-50 hover:text-teal-600 transition-colors cursor-pointer"
                        title="编辑知识点"
                      >
                        <i className="ri-edit-line text-xs"></i>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          askDeleteKnowledge(kp);
                        }}
                        className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors cursor-pointer"
                        title="删除知识点"
                      >
                        <i className="ri-delete-bin-line text-xs"></i>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {!knowledgePoints.length && (
                <div className="text-center py-12 text-gray-400 text-sm">
                  <i className="ri-price-tag-3-line text-3xl mb-2 block"></i>
                  暂无知识点
                </div>
              )}
            </div>
            <div className="sticky bottom-0 p-3 bg-white/95 backdrop-blur border-t border-gray-100 shadow-[0_-8px_18px_rgba(15,23,42,0.04)]">
              <button
                onClick={() => {
                  setNewKnowledgeTitle('');
                  setNewKnowledgeDesc('');
                  setKnowledgeCreateOpen(true);
                }}
                className="w-full px-4 py-2.5 bg-teal-500 text-white text-sm font-medium rounded-xl hover:bg-teal-600 transition-colors whitespace-nowrap cursor-pointer"
              >
                <i className="ri-add-line mr-1.5"></i>新增知识点
              </button>
            </div>
          </div>
          <div className="flex flex-col min-h-0">
            {activeKnowledge ? (
              <>
                <div className="px-5 py-4 border-b border-gray-100 bg-white flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-gray-900 truncate">{activeKnowledge.title}</div>
                    <div className="text-xs text-gray-400 mt-0.5">检测题共 {questions.length} 道</div>
                  </div>
                  <button
                    onClick={openCreateQuestion}
                    className="px-4 py-2 bg-teal-500 text-white text-sm font-medium rounded-xl hover:bg-teal-600 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <i className="ri-add-line mr-1.5"></i>新增题目
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-5">
                  {questionsLoading ? (
                    <div className="text-center py-16 text-sm text-gray-400">题目加载中...</div>
                  ) : questions.length ? (
                    <div className="space-y-3">
                      {questions.map((q, idx) => (
                        <div key={q.id} className="bg-white border border-gray-100 rounded-2xl p-4 hover:border-teal-100 hover:shadow-sm transition-all">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <span className="text-xs text-gray-400">第{idx + 1}题</span>
                                <span className="px-2 py-0.5 bg-teal-50 text-teal-600 rounded-md text-xs font-medium">{questionTypeText(q.type)}</span>
                                <span className="px-2 py-0.5 bg-orange-50 text-orange-600 rounded-md text-xs font-medium">{q.score}分</span>
                              </div>
                              <div className="text-sm font-semibold text-gray-900 leading-relaxed">{q.question}</div>
                              {q.type !== 'short' && q.options.length > 0 && (
                                <div className="mt-3 grid grid-cols-2 gap-2">
                                  {q.options.map((opt, optIdx) => (
                                    <div key={`${q.id}-${optIdx}`} className="px-3 py-2 bg-gray-50 rounded-lg text-xs text-gray-600 truncate">
                                      {String.fromCharCode(65 + optIdx)}. {opt}
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="mt-3 text-xs text-gray-500">
                                <span className="font-medium text-gray-700">标准答案：</span>{answerText(q)}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button onClick={() => editQuestion(q)} className="px-3 py-1.5 bg-teal-50 text-teal-600 rounded-lg text-xs font-medium hover:bg-teal-100 transition-colors cursor-pointer">编辑</button>
                              <button onClick={() => askDeleteQuestion(q)} className="px-3 py-1.5 bg-red-50 text-red-500 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors cursor-pointer">删除</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-16 text-gray-400 text-sm">
                      <i className="ri-file-list-3-line text-4xl mb-3 block"></i>
                      暂无检测题
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">请选择左侧知识点</div>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        title="新增知识点"
        open={knowledgeCreateOpen}
        onCancel={() => setKnowledgeCreateOpen(false)}
        onOk={handleCreateKnowledge}
        okText="确认新增"
        cancelText="取消"
        okButtonProps={modalOkButtonProps}
        width={520}
      >
        <Form layout="vertical" className="pt-2">
          <Form.Item label="知识点名称" required>
            <Input value={newKnowledgeTitle} onChange={(e) => setNewKnowledgeTitle(e.target.value)} placeholder="请输入知识点名称" />
          </Form.Item>
          <Form.Item label="知识点说明">
            <Input.TextArea value={newKnowledgeDesc} onChange={(e) => setNewKnowledgeDesc(e.target.value)} placeholder="请输入知识点说明" rows={4} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑知识点"
        open={!!editingKnowledge}
        onCancel={() => setEditingKnowledge(null)}
        onOk={handleUpdateKnowledge}
        okText="保存"
        cancelText="取消"
        okButtonProps={modalOkButtonProps}
        width={520}
      >
        <Form layout="vertical" className="pt-2">
          <Form.Item label="知识点名称" required>
            <Input value={editKnowledgeTitle} onChange={(e) => setEditKnowledgeTitle(e.target.value)} placeholder="请输入知识点名称" />
          </Form.Item>
          <Form.Item label="知识点说明">
            <Input.TextArea value={editKnowledgeDesc} onChange={(e) => setEditKnowledgeDesc(e.target.value)} placeholder="请输入知识点说明" rows={4} maxLength={TEXT_MAX_LENGTH} showCount />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingQuestionId ? '编辑检测题' : '新增检测题'}
        open={questionEditorOpen}
        onCancel={() => {
          setQuestionEditorOpen(false);
          resetQuestionForm();
        }}
        onOk={saveQuestion}
        okText="保存题目"
        cancelText="取消"
        okButtonProps={modalOkButtonProps}
        width={760}
      >
        <Form layout="vertical" className="pt-2">
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <Form.Item label="题型" required>
              <Select
                value={questionDraft.type}
                onChange={(value) => setQuestionDraft({ ...emptyQuestionDraft, type: value as CourseQuizQuestion['type'] })}
                options={[
                  { value: 'single', label: '单选题' },
                  { value: 'multiple', label: '多选题' },
                  { value: 'short', label: '简答题' },
                ]}
              />
            </Form.Item>
            <Form.Item label="分值" required>
              <InputNumber
                min={questionScoreMax > 0 ? 1 : 0}
                max={questionScoreMax}
                precision={0}
                value={Number(questionDraft.score) || undefined}
                onChange={(value) => {
                  const nextValue = Number(value || 0);
                  if (nextValue > questionScoreMax) {
                    showToast('所有题目总分值不能大于100');
                    setQuestionDraft((prev) => ({ ...prev, score: questionScoreMax ? String(questionScoreMax) : '' }));
                    return;
                  }
                  setQuestionDraft((prev) => ({ ...prev, score: value ? String(value) : '' }));
                }}
                placeholder="分值"
                className="w-full"
              />
            </Form.Item>
          </div>
          <Form.Item label="题干" required>
            <Input.TextArea value={questionDraft.question} onChange={(e) => setQuestionDraft((prev) => ({ ...prev, question: e.target.value }))} placeholder="请输入题干" rows={4} maxLength={TEXT_MAX_LENGTH} showCount />
          </Form.Item>
          {questionDraft.type !== 'short' && (
            <Form.Item label="选项与标准答案" required>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400">勾选左侧控件设置标准答案</span>
                <Button size="small" type="text" onClick={addDraftOption} className="text-teal-600">
                  <i className="ri-add-line mr-1"></i>新增选项
                </Button>
              </div>
              <div className="space-y-2">
                {questionDraft.options.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="w-8 flex items-center justify-center">
                      {questionDraft.type === 'single' ? (
                        <Radio checked={questionDraft.singleAnswer === idx} onChange={() => setQuestionDraft((prev) => ({ ...prev, singleAnswer: idx }))} />
                      ) : (
                        <Checkbox checked={questionDraft.multipleAnswers.includes(idx)} onChange={() => toggleMultipleAnswer(idx)} />
                      )}
                    </div>
                    <div className="w-8 h-9 rounded-lg bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center flex-shrink-0">{String.fromCharCode(65 + idx)}</div>
                    <Input value={opt} onChange={(e) => updateDraftOption(idx, e.target.value)} placeholder={`选项${String.fromCharCode(65 + idx)}`} />
                    <Button type="text" danger onClick={() => removeDraftOption(idx)} title="删除选项">
                      <i className="ri-delete-bin-line text-sm"></i>
                    </Button>
                  </div>
                ))}
              </div>
            </Form.Item>
          )}
          {questionDraft.type === 'short' && (
            <Form.Item label="关键词">
              <Input value={questionDraft.keywordsText} onChange={(e) => setQuestionDraft((prev) => ({ ...prev, keywordsText: e.target.value }))} placeholder="关键词，用顿号或逗号分隔" />
            </Form.Item>
          )}
          <Form.Item label="答案解析">
            <Input.TextArea value={questionDraft.explanation} onChange={(e) => setQuestionDraft((prev) => ({ ...prev, explanation: e.target.value }))} placeholder="请输入答案解析" rows={4} maxLength={TEXT_MAX_LENGTH} showCount />
          </Form.Item>
        </Form>
      </Modal>

      {confirmState ? (
        <AppModalPortal open onMaskClick={() => setConfirmState(null)} zIndex={1200}>
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-gray-900 mb-2">{confirmState.title}</h3>
            <p className="text-sm text-gray-600 leading-relaxed mb-5">{confirmState.content}</p>
            <div className="flex items-center gap-3">
              <button onClick={() => setConfirmState(null)} className="flex-1 px-4 py-2 bg-gray-100 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors cursor-pointer">取消</button>
              <button
                onClick={async () => {
                  const action = confirmState.onConfirm;
                  setConfirmState(null);
                  try {
                    await action();
                  } catch (e) {
                    showToast(e instanceof Error ? e.message : '操作失败');
                  }
                }}
                className={`flex-1 px-4 py-2 text-white text-sm font-medium rounded-xl transition-colors cursor-pointer ${confirmState.danger ? 'bg-red-500 hover:bg-red-600' : 'bg-teal-500 hover:bg-teal-600'}`}
              >
                {confirmState.confirmText || '确认'}
              </button>
            </div>
          </div>
        </AppModalPortal>
      ) : null}

      {toast && (
        <div className="fixed bottom-6 right-6 z-[70] flex items-center gap-3 bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-xl">
          <i className="ri-check-circle-fill text-green-400 text-lg"></i>
          <span className="text-sm font-medium">{toast}</span>
        </div>
      )}
    </div>
  );
}
