import { useEffect, useMemo, useState } from 'react';
import { message, Tree } from 'antd';
import { COURSE_SETTING_STAGES, type CourseSettingStage, type CourseSettingStageKey } from '../../../../lib/courseSettingsApi';
import {
  listCourseKnowledgePoints,
  listCourseQuizQuestions,
  listCourseResources,
  type CourseKnowledgePoint,
  type CourseResourceFile,
  type CourseResourceNode,
} from '../../../../lib/courseResourceApi';
import { COURSE_GATE_PERCENT } from '../../../../lib/trainingModulePrerequisite';
import QuizModal, { type QuizConfig } from '../../../student-center/components/QuizModal';
import DemoLearningDetail, { type LearningDetailResource } from './mirror/DemoLearningDetail';
import { bindDemoCourseClass, readDemoResourceProgress } from './demoCourseProgress';
import { loadDemoState, saveDemoState, updateDemoState, type DemoState } from './demoStore';

const MODULE_COLOR: Record<string, string> = {
  ideation: 'bg-gradient-to-r from-teal-500 to-teal-600',
  market: 'bg-gradient-to-r from-green-500 to-green-600',
  product: 'bg-gradient-to-r from-orange-500 to-orange-600',
  business: 'bg-gradient-to-r from-pink-500 to-pink-600',
  simulation: 'bg-gradient-to-r from-indigo-500 to-indigo-600',
  plan: 'bg-gradient-to-r from-teal-600 to-cyan-600',
};

type Catalog = {
  key: string;
  name: string;
  color: string;
  nodes: CourseResourceNode[];
  points: CourseKnowledgePoint[];
};

type StudySession = {
  title: string;
  description: string;
  moduleName: string;
  resources: LearningDetailResource[];
  knowledgePoints: { id: string; title: string; description: string }[];
};

function publishedNodes(nodes: CourseResourceNode[]): CourseResourceNode[] {
  return (nodes || []).filter((node) => node.status === 'published');
}

function findNode(nodes: CourseResourceNode[], id: string): CourseResourceNode | null {
  for (const node of nodes || []) {
    if (node.id === id) return node;
    const child = findNode(node.children || [], id);
    if (child) return child;
  }
  return null;
}

function firstLeaf(nodes: CourseResourceNode[]): CourseResourceNode | null {
  for (const node of publishedNodes(nodes)) {
    const children = publishedNodes(node.children || []);
    if (!children.length) return node;
    const leaf = firstLeaf(children);
    if (leaf) return leaf;
  }
  return null;
}

function toTree(nodes: CourseResourceNode[]): { title: string; key: string; children?: { title: string; key: string }[] }[] {
  return publishedNodes(nodes).map((node) => {
    const children = toTree(node.children || []);
    return children.length ? { title: node.title, key: node.id, children } : { title: node.title, key: node.id };
  });
}

function resourceTypeText(type: CourseResourceFile['type']) {
  if (type === 'video') return '视频';
  if (type === 'audio') return '音频';
  if (type === 'pdf') return '文档';
  if (type === 'image') return '图片';
  if (type === 'archive') return '压缩包';
  if (type === 'case') return '案例';
  return '文件';
}

function resourceIcon(type: CourseResourceFile['type']) {
  if (type === 'video') return 'ri-video-line';
  if (type === 'audio') return 'ri-volume-up-line';
  if (type === 'pdf') return 'ri-file-pdf-2-line';
  if (type === 'image') return 'ri-image-line';
  if (type === 'archive') return 'ri-file-zip-line';
  if (type === 'case') return 'ri-book-open-line';
  return 'ri-file-list-line';
}

function toLearningResource(file: CourseResourceFile, classId: string): LearningDetailResource {
  const progress = readDemoResourceProgress(classId, file.id);
  return {
    id: file.id,
    nodeId: file.nodeId,
    title: file.name,
    type: file.type,
    previewType: file.previewType,
    previewStatus: file.previewStatus,
    contentHash: file.contentHash,
    mimeType: file.mimeType,
    size: file.size,
    canPreview: file.canPreview,
    progress,
  };
}

/** 看板完成状态只看本次演示缓存，不读学生成绩。 */
function stageDone(state: DemoState, key: string) {
  const flows = state.flows || {};
  if (key === 'team') return state.team.confirmed || state.teamSession.status === 'grouped';
  const ideation = flows.ideation as { topic?: { status?: string } | null } | undefined;
  if (key === 'ideation') return ideation?.topic?.status === 'approved';
  const market = flows.market as { report?: { uploaded?: boolean } } | undefined;
  if (key === 'market') return Boolean(market?.report?.uploaded);
  const product = flows.product as { prototype?: { uploaded?: boolean } } | undefined;
  if (key === 'product') return Boolean(product?.prototype?.uploaded);
  const business = flows.business as { bmcCanvasSavedAt?: string } | undefined;
  if (key === 'business') return Boolean(business?.bmcCanvasSavedAt);
  if (key === 'simulation') return Array.isArray(flows.simulation) && flows.simulation.length > 0;
  const plan = flows.plan as { workspace?: { submission?: { status?: string } | null } } | undefined;
  if (key === 'plan') return plan?.workspace?.submission?.status === 'approved';
  return false;
}

export function DemoOverview({
  classId,
  className,
  enabledModuleKeys,
  onOpenStage,
}: {
  classId: string;
  className: string;
  enabledModuleKeys: CourseSettingStageKey[];
  onOpenStage: (stage: CourseSettingStageKey) => void;
}) {
  const [state, setState] = useState(() => loadDemoState(classId));
  useEffect(() => setState(loadDemoState(classId)), [classId]);
  const stages = COURSE_SETTING_STAGES.filter((item) => item.key === 'team' || enabledModuleKeys.includes(item.key));
  const doneFlags = stages.map((item) => stageDone(state, item.key));
  const completedCount = doneFlags.filter(Boolean).length;
  const currentIndex = doneFlags.findIndex((done) => !done);
  const overall = Math.round((completedCount / Math.max(stages.length, 1)) * 100);
  const currentLabel = stages[currentIndex >= 0 ? currentIndex : stages.length - 1]?.name || '—';
  const [panel, setPanel] = useState<'notifications' | 'tasks'>('notifications');

  const renderStep = (stage: CourseSettingStage, index: number, mobile: boolean) => {
    const isCompleted = doneFlags[index];
    const isCurrent = index === currentIndex;
    const percent = isCompleted ? 100 : isCurrent ? 0 : 0;
    const stepLabel = mobile
      ? isCompleted
        ? '已完成'
        : isCurrent
          ? '进行中'
          : '未开始'
      : isCompleted
        ? '✓ 完成'
        : isCurrent
          ? '进行中'
          : '未开始';
    if (mobile) {
      return (
        <button
          key={stage.key}
          type="button"
          onClick={() => onOpenStage(stage.key)}
          className={`w-full flex items-center gap-3 rounded-xl border px-3 py-3 text-left cursor-pointer ${isCurrent ? 'border-teal-200 bg-teal-50' : isCompleted ? 'border-teal-100 bg-white' : 'border-gray-100 bg-gray-50/60'}`}
        >
          <span className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isCompleted ? 'bg-teal-500 text-white' : isCurrent ? 'bg-white border-2 border-teal-500 text-teal-600' : 'bg-white border border-gray-200 text-gray-400'}`}>
            {isCompleted ? <i className="ri-check-line text-base"></i> : <i className={`${stage.icon} text-base`}></i>}
          </span>
          <span className="flex-1 min-w-0">
            <span className={`block text-sm font-semibold leading-5 ${isCurrent ? 'text-teal-800' : 'text-gray-800'}`}>{stage.name}</span>
            <span className="mt-1.5 flex items-center gap-2">
              <span className="h-1 flex-1 rounded-full bg-gray-200 overflow-hidden">
                <span className={`block h-full rounded-full ${isCompleted || isCurrent ? 'bg-teal-500' : 'bg-gray-300'}`} style={{ width: `${isCompleted ? 100 : percent}%` }}></span>
              </span>
              <span className={`text-xs flex-shrink-0 ${isCompleted || isCurrent ? 'text-teal-600 font-medium' : 'text-gray-400'}`}>{stepLabel}</span>
            </span>
          </span>
          <i className="ri-arrow-right-s-line text-lg text-gray-300 flex-shrink-0"></i>
        </button>
      );
    }
    return (
      <div key={stage.key} className="flex-1 flex flex-col items-center relative">
        {index < stages.length - 1 && (
          <div className={`absolute top-5 left-1/2 w-full h-0.5 z-0 pointer-events-none ${isCompleted ? 'bg-teal-400' : 'bg-gray-200'}`} />
        )}
        <button
          type="button"
          onClick={() => onOpenStage(stage.key)}
          className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-all shadow-sm cursor-pointer ${isCompleted ? 'bg-teal-500 text-white' : isCurrent ? 'bg-white border-2 border-teal-500 text-teal-600 ring-4 ring-teal-100' : 'bg-white border-2 border-gray-200 text-gray-400'}`}
        >
          {isCompleted ? <i className="ri-check-line text-sm font-bold"></i> : <i className={`${stage.icon} text-sm`}></i>}
        </button>
        <div className={`text-center px-1 ${isCurrent ? 'text-teal-700' : isCompleted ? 'text-gray-700' : 'text-gray-400'}`}>
          <div className="font-semibold leading-tight mb-0.5" style={{ fontSize: '10px' }}>
            {stage.shortName.length > 6 ? `${stage.shortName.slice(0, 6)}…` : stage.shortName}
          </div>
          <div style={{ fontSize: '10px' }} className={isCompleted || isCurrent ? 'text-teal-500 font-bold' : 'text-gray-300'}>{stepLabel}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-br from-teal-500 via-cyan-500 to-teal-600 rounded-2xl shadow-lg overflow-hidden relative">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-72 h-72 bg-white rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
        </div>
        <div className="relative px-4 py-5 md:hidden">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center flex-shrink-0 border border-white/30">
              <i className="ri-rocket-line text-2xl text-white"></i>
            </div>
            <h1 className="flex-1 min-w-0 text-xl font-bold text-white leading-snug">{className || '教学演示'}</h1>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-sm text-white/85"><i className="ri-map-pin-line"></i>当前阶段：{currentLabel}</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="bg-white/15 backdrop-blur-md rounded-2xl px-3 py-3 border border-white/20">
              <div className="text-2xl font-bold text-white leading-none">{overall}%</div>
              <div className="text-xs text-white/75 mt-1 mb-2">项目整体进度</div>
              <div className="h-1.5 bg-white/20 rounded-full overflow-hidden"><div className="h-full bg-white rounded-full" style={{ width: `${overall}%` }}></div></div>
            </div>
            <div className="bg-white/15 backdrop-blur-md rounded-2xl px-3 py-3 border border-white/20">
              <div className="text-2xl font-bold text-white leading-none">{completedCount}/{stages.length}</div>
              <div className="text-xs text-white/75 mt-1">已完成阶段</div>
            </div>
          </div>
        </div>
        <div className="relative px-8 py-6 hidden md:flex items-center gap-6">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center flex-shrink-0 border border-white/30">
            <i className="ri-rocket-line text-3xl text-white"></i>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-white truncate">{className || '教学演示'}</h1>
            <div className="mt-1 text-sm text-white/80 flex items-center gap-1.5"><i className="ri-map-pin-line"></i>当前阶段：{currentLabel}</div>
          </div>
          <div className="flex-shrink-0 text-center bg-white/10 backdrop-blur-md rounded-2xl px-8 py-4 border border-white/20">
            <div className="text-4xl font-bold text-white mb-1">{overall}%</div>
            <div className="text-xs text-white/70 mb-2">项目整体进度</div>
            <div className="w-24 h-1.5 bg-white/20 rounded-full overflow-hidden mx-auto"><div className="h-full bg-white rounded-full" style={{ width: `${overall}%` }}></div></div>
          </div>
          <div className="flex-shrink-0 bg-white/10 backdrop-blur-md rounded-2xl px-6 py-4 border border-white/20 text-center">
            <div className="text-3xl font-bold text-white mb-1">{completedCount}/{stages.length}</div>
            <div className="text-xs text-white/70">已完成阶段</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6">
        <div className="flex flex-col gap-1 mb-4 md:mb-5 md:flex-row md:items-center md:justify-between">
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2"><i className="ri-layout-grid-line text-teal-600"></i>实训模块进度</h3>
          <span className="text-xs text-gray-400">{completedCount} 已完成 · {currentIndex >= 0 ? 1 : 0} 进行中</span>
        </div>
        <div className="md:hidden flex flex-col gap-2">{stages.map((stage, index) => renderStep(stage, index, true))}</div>
        <div className="hidden md:flex items-start gap-0">{stages.map((stage, index) => renderStep(stage, index, false))}</div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2"><i className="ri-todo-line text-teal-600"></i>通知•待办任务</h3>
          <div className="grid grid-cols-2 gap-1 bg-gray-100 rounded-xl p-1 md:flex">
            <button type="button" onClick={() => setPanel('notifications')} className={`px-3 py-2 md:py-1.5 text-xs font-medium rounded-lg cursor-pointer ${panel === 'notifications' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-500'}`}>通知</button>
            <button type="button" onClick={() => setPanel('tasks')} className={`px-3 py-2 md:py-1.5 text-xs font-medium rounded-lg cursor-pointer ${panel === 'tasks' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-500'}`}>任务 0</button>
          </div>
        </div>
        {panel === 'notifications' ? (
          <div className="py-8 text-center">
            <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <i className="ri-notification-line text-2xl text-gray-400"></i>
            </div>
            <p className="text-sm font-medium text-gray-700">暂无系统通知</p>
          </div>
        ) : (
          <div className="py-8 text-center">
            <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <i className="ri-checkbox-circle-line text-2xl text-green-500"></i>
            </div>
            <p className="text-sm font-medium text-gray-700">暂无任务</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function DemoPracticeCourse({
  classId,
  enabledModuleKeys,
}: {
  classId: string;
  enabledModuleKeys: CourseSettingStageKey[];
}) {
  const modules = useMemo(
    () => COURSE_SETTING_STAGES.filter((item) => item.courseModuleKey && (item.key === 'team' || enabledModuleKeys.includes(item.key))),
    [enabledModuleKeys]
  );
  const [subTab, setSubTab] = useState<'overview' | 'knowledge' | 'progress'>('overview');
  const [catalog, setCatalog] = useState<Catalog[]>([]);
  const [moduleKey, setModuleKey] = useState(modules[0]?.courseModuleKey || 'ideation');
  const [chapterId, setChapterId] = useState('');
  const [passed, setPassed] = useState<Record<string, boolean>>({});
  const [study, setStudy] = useState<StudySession | null>(null);
  const [quiz, setQuiz] = useState<QuizConfig | null>(null);
  const [quizLoadingId, setQuizLoadingId] = useState('');

  useEffect(() => {
    bindDemoCourseClass(classId);
    setPassed(loadDemoState(classId).learning.knowledgePassed || {});
  }, [classId, study]);

  useEffect(() => {
    let cancelled = false;
    Promise.all(modules.map(async (item) => {
      const key = item.courseModuleKey || '';
      const [resources, points] = await Promise.all([
        listCourseResources(key).catch(() => null),
        listCourseKnowledgePoints(key).catch(() => [] as CourseKnowledgePoint[]),
      ]);
      return {
        key,
        name: item.shortName,
        color: MODULE_COLOR[key] || 'bg-gradient-to-r from-teal-500 to-cyan-600',
        nodes: resources?.nodes || [],
        points: Array.isArray(points) ? points : [],
      };
    })).then((rows) => {
      if (!cancelled) setCatalog(rows.filter((row) => row.key));
    });
    return () => {
      cancelled = true;
    };
  }, [modules]);

  const current = catalog.find((item) => item.key === moduleKey) || catalog[0];
  const tree = current ? toTree(current.nodes) : [];
  const activeId = chapterId && current && findNode(current.nodes, chapterId) ? chapterId : firstLeaf(current?.nodes || [])?.id || '';
  const activeNode = current && activeId ? findNode(current.nodes, activeId) : null;
  const isLeaf = Boolean(activeNode && publishedNodes(activeNode.children || []).length === 0);
  const chapterResources = isLeaf ? activeNode?.resources || [] : [];
  const pointById = new Map((current?.points || []).map((point) => [point.id, point]));
  const chapterPoints = isLeaf
    ? (activeNode?.knowledgePoints || []).map((item) => pointById.get(item.id)).filter((item): item is CourseKnowledgePoint => Boolean(item))
    : [];

  const allPoints = catalog.flatMap((item) => item.points);
  const completedKnowledgeCount = allPoints.filter((point) => passed[point.id]).length;
  const resourceCount = catalog.reduce((sum, item) => {
    const walk = (nodes: CourseResourceNode[]): number => publishedNodes(nodes).reduce((acc, node) => acc + (node.resources?.length || 0) + walk(node.children || []), 0);
    return sum + walk(item.nodes);
  }, 0);
  const passRate = allPoints.length ? Math.round((completedKnowledgeCount / allPoints.length) * 100) : 0;

  const openStudy = () => {
    if (!chapterResources.length || !current) return;
    setStudy({
      title: activeNode?.title || chapterResources[0].name,
      description: `${chapterResources.length} 个学习资源`,
      moduleName: current.name,
      resources: chapterResources.map((file) => toLearningResource(file, classId)),
      knowledgePoints: chapterPoints.map((point) => ({ id: point.id, title: point.title, description: point.description })),
    });
  };

  const startQuiz = async (point: CourseKnowledgePoint) => {
    const ready = !chapterResources.length || chapterResources.every((file) => readDemoResourceProgress(classId, file.id).progressPercent >= COURSE_GATE_PERCENT);
    if (!ready) {
      message.warning(`请先完成对应小节课程学习至 ${COURSE_GATE_PERCENT}% 后再进行知识点检测。`);
      return;
    }
    setQuizLoadingId(point.id);
    try {
      const questions = await listCourseQuizQuestions(point.id);
      if (!questions.length) {
        message.warning('该知识点暂未配置检测题');
        return;
      }
      setQuiz({
        moduleId: point.moduleKey,
        moduleName: point.moduleName || current?.name || '',
        knowledgeId: point.id,
        knowledgeName: point.title,
        questions,
        passingScore: 60,
      });
    } catch (e) {
      message.error(e instanceof Error ? e.message : '题目加载失败');
    } finally {
      setQuizLoadingId('');
    }
  };

  if (study) {
    return (
      <div className="-m-5">
        <DemoLearningDetail
          knowledgeTitle={study.title}
          knowledgeDescription={study.description}
          moduleName={study.moduleName}
          resources={study.resources}
          knowledgePoints={study.knowledgePoints}
          onBack={() => setStudy(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">实践课程</h2>
        <p className="text-sm text-gray-500">学习知识点、完成检测、获取能力点，构建完整能力体系</p>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-2">
        <div className="flex space-x-2">
          {([
            { id: 'overview', label: '学习概览', icon: 'ri-dashboard-line' },
            { id: 'knowledge', label: '知识点库', icon: 'ri-book-2-line' },
            { id: 'progress', label: '进度看板', icon: 'ri-line-chart-line' },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className={`flex-1 px-4 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap text-sm flex items-center justify-center gap-2 cursor-pointer ${subTab === tab.id ? 'bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-lg' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <i className={tab.icon}></i>{tab.label}
            </button>
          ))}
        </div>
      </div>

      {subTab === 'overview' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl shadow-xl p-8 text-white">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { value: `${completedKnowledgeCount}/${allPoints.length}`, label: '知识点完成' },
                { value: `${resourceCount}`, label: '学习资源' },
                { value: `${passRate}%`, label: '检测通过率' },
                { value: '0/0', label: '待完成关联任务' },
              ].map((item) => (
                <div key={item.label} className="bg-white/10 rounded-xl p-4 backdrop-blur-sm text-center">
                  <div className="text-2xl font-bold mb-1">{item.value}</div>
                  <div className="text-sm text-teal-100">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-5 flex items-center gap-2"><i className="ri-route-line text-teal-600"></i>学习路径流程</h3>
            <div className="flex items-center justify-between">
              {[
                { icon: 'ri-book-open-line', label: '学习实践课程', color: 'from-teal-500 to-teal-600', desc: '观看视频、阅读文档' },
                { icon: 'ri-checkbox-line', label: '学习检测', color: 'from-cyan-500 to-cyan-600', desc: '测试达标解锁' },
                { icon: 'ri-edit-box-line', label: '实践操作', color: 'from-orange-500 to-orange-600', desc: '完成实践任务' },
              ].map((step, index) => (
                <div key={step.label} className="flex items-center gap-3 flex-1">
                  <div className="flex-1 text-center">
                    <div className={`w-14 h-14 bg-gradient-to-br ${step.color} rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg`}><i className={`${step.icon} text-2xl text-white`}></i></div>
                    <div className="font-semibold text-gray-900 mb-1 text-sm">{step.label}</div>
                    <div className="text-xs text-gray-500">{step.desc}</div>
                  </div>
                  {index < 2 && <div className="w-10 h-10 flex items-center justify-center"><i className="ri-arrow-right-line text-xl text-gray-300"></i></div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {subTab === 'knowledge' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-3 overflow-x-auto">
              {catalog.map((mod) => (
                <button
                  key={mod.key}
                  type="button"
                  onClick={() => { setModuleKey(mod.key); setChapterId(''); }}
                  className={`px-5 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap text-sm cursor-pointer ${moduleKey === mod.key ? `${mod.color} text-white shadow-lg` : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >{mod.name}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 min-h-[360px]">
              <div className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2"><i className="ri-node-tree text-teal-600"></i>章节目录</div>
              {tree.length ? (
                <Tree treeData={tree} selectedKeys={activeId ? [activeId] : []} defaultExpandAll onSelect={(keys) => setChapterId(String(keys[0] || ''))} />
              ) : (
                <div className="py-12 text-center text-sm text-gray-400">当前模块暂无关联章节</div>
              )}
            </div>
            <div className="space-y-5 min-w-0">
              {isLeaf ? (
                <>
                  <div className="space-y-3">
                    <h3 className="text-base font-bold text-gray-900 flex items-center gap-2"><i className="ri-book-open-line text-teal-600"></i>学习资源</h3>
                    {chapterResources.length ? (
                      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                        <div className="flex items-center gap-4">
                          <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center flex-shrink-0">
                            <i className={`${resourceIcon(chapterResources[0].type)} text-xl`}></i>
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-bold text-gray-900 line-clamp-2">{activeNode?.title}</h4>
                            <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                              <span>{chapterResources.length} 个资源</span>
                              <span>·</span>
                              <span>{Array.from(new Set(chapterResources.map((file) => resourceTypeText(file.type)))).join('、')}</span>
                            </div>
                            <div className="text-xs text-gray-500 mt-2 line-clamp-1">{chapterResources.map((file) => file.name).join('、')}</div>
                          </div>
                          <button type="button" onClick={openStudy} className="px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-lg text-sm font-medium hover:shadow-md whitespace-nowrap cursor-pointer flex-shrink-0">
                            <i className="ri-play-circle-line mr-1"></i>去学习
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center text-sm text-gray-400">当前章节暂无学习资源</div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-base font-bold text-gray-900 flex items-center gap-2"><i className="ri-lightbulb-line text-teal-600"></i>章节关联知识点</h3>
                    {chapterPoints.length ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {chapterPoints.map((point) => {
                          const done = Boolean(passed[point.id]);
                          return (
                            <div key={point.id} className={`bg-white rounded-2xl shadow-sm border p-5 ${done ? 'border-green-200' : 'border-gray-100'}`}>
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <h3 className="text-base font-bold text-gray-900">{point.title}</h3>
                                <span className={`px-2 py-0.5 rounded-lg text-xs font-medium border ${done ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>{done ? '已完成' : '未检测'}</span>
                              </div>
                              <p className="text-sm text-gray-600 line-clamp-2 mb-4">{point.description || '完成学习后可进行检测'}</p>
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  disabled={quizLoadingId === point.id}
                                  onClick={() => void startQuiz(point)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${done ? 'bg-green-100 text-green-700' : 'bg-gradient-to-r from-teal-500 to-cyan-600 text-white'}`}
                                >
                                  <i className={`${done ? 'ri-refresh-line' : 'ri-edit-2-line'} mr-1`}></i>{quizLoadingId === point.id ? '加载中' : done ? '重新检测' : '开始检测'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center text-sm text-gray-400">当前章节暂无关联知识点</div>
                    )}
                  </div>
                </>
              ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center text-sm text-gray-400">
                  <div className="w-12 h-12 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-3"><i className="ri-node-tree text-xl"></i></div>
                  <div className="font-medium text-gray-600">请选择最下级章节</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {subTab === 'progress' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2"><i className="ri-time-line text-teal-600"></i>学习时间线</h3>
          <div className="relative">
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-teal-500 to-cyan-600"></div>
            <div className="space-y-8">
              {catalog.map((mod) => {
                const total = mod.points.length;
                const completed = mod.points.filter((point) => passed[point.id]).length;
                const pct = total ? Math.round((completed / total) * 100) : 0;
                const statusLabel = !total ? '无内容' : completed === total ? '已完成' : completed > 0 ? '进行中' : '待开始';
                return (
                  <div key={mod.key} className="relative pl-20">
                    <div className={`absolute left-0 w-16 h-16 ${mod.color} rounded-2xl flex items-center justify-center shadow-lg`}>
                      <i className="ri-play-line text-2xl text-white"></i>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-6">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-base font-bold text-gray-900">{mod.name}</h4>
                        <div className="flex items-center gap-3">
                          <span className={`px-3 py-1 rounded-lg text-sm font-medium ${statusLabel === '已完成' ? 'bg-green-100 text-green-700' : statusLabel === '进行中' ? 'bg-teal-100 text-teal-700' : 'bg-yellow-100 text-yellow-700'}`}>{statusLabel}</span>
                          {total > 0 && (
                            <button type="button" onClick={() => { setSubTab('knowledge'); setModuleKey(mod.key); setChapterId(''); }} className="px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-lg text-sm font-medium cursor-pointer">进入学习</button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-gray-600">{total ? `${completed}/${total} 知识点完成` : '暂无关联课程，无需学习'}</span>
                        <span className="text-sm font-bold text-teal-600">{pct}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden"><div className={`${mod.color} h-full rounded-full`} style={{ width: `${pct}%` }}></div></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {quiz ? (
        <QuizModal
          config={quiz}
          onClose={() => setQuiz(null)}
          onPass={(knowledgeId) => {
            const next = updateDemoState(classId, (prev) => ({
              ...prev,
              learning: { ...prev.learning, knowledgePassed: { ...prev.learning.knowledgePassed, [knowledgeId]: true } },
            }));
            setPassed(next.learning.knowledgePassed);
            setQuiz(null);
          }}
        />
      ) : null}
    </div>
  );
}

export function DemoArchive({ classId }: { classId: string }) {
  const [state, setState] = useState(() => loadDemoState(classId));
  const [kind, setKind] = useState<'all' | DemoState['learning']['archive'][number]['kind']>('all');
  useEffect(() => setState(loadDemoState(classId)), [classId]);
  const rows = state.learning.archive.filter((item) => kind === 'all' || item.kind === kind);
  const count = (key: DemoState['learning']['archive'][number]['kind']) => state.learning.archive.filter((item) => item.kind === key).length;
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">学习档案</h2>
        <p className="text-sm text-gray-500">全流程学习记录来自本次演示缓存，关闭标签后不再保留。</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['知识点学习', count('knowledge')],
          ['案例参考', count('case')],
          ['实践任务', count('task')],
          ['教师评价', count('evaluation')],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-gray-100 bg-white p-4">
            <div className="text-3xl font-bold">{value}</div>
            <div className="text-sm text-gray-500">{label}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-2 text-sm">
        {(['all', 'knowledge', 'case', 'task', 'evaluation'] as const).map((item) => (
          <button key={item} type="button" className={`px-3 py-1 rounded-lg cursor-pointer ${kind === item ? 'bg-teal-500 text-white' : 'bg-gray-50'}`} onClick={() => setKind(item)}>
            {item === 'all' ? '全部' : item === 'knowledge' ? '知识点' : item === 'case' ? '案例' : item === 'task' ? '任务' : '评价'}
          </button>
        ))}
      </div>
      <div className="rounded-2xl border border-gray-100 bg-white divide-y">
        {!rows.length ? <p className="p-4 text-sm text-gray-400">还没有演示记录。完成实践课程或组队后会出现在这里。</p> : null}
        {rows.map((item) => (
          <div key={item.id} className="p-4">
            <div className="font-medium text-gray-900">{item.title}</div>
            <div className="text-xs text-gray-400 mt-1">{item.detail} · {new Date(item.at).toLocaleString()}</div>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="text-sm text-teal-700 cursor-pointer"
        onClick={() => {
          const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'demo-archive.json';
          a.click();
          URL.revokeObjectURL(url);
          saveDemoState(classId, state);
        }}
      >
        导出本次档案
      </button>
    </div>
  );
}
