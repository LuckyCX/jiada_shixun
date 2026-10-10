import { useEffect, useMemo, useState } from 'react';
import { Button, message } from 'antd';
import { COURSE_SETTING_STAGES, type CourseSettingStageKey } from '../../../../lib/courseSettingsApi';
import {
  courseResourceFileUrl,
  listCourseKnowledgePoints,
  listCourseQuizQuestions,
  listCourseResources,
  type CourseKnowledgePoint,
  type CourseQuizQuestion,
  type CourseResourceNode,
} from '../../../../lib/courseResourceApi';
import { loadDemoState, saveDemoState, updateDemoState, type DemoState } from './demoStore';

type Chapter = { id: string; title: string; moduleName: string; resourceId: string; resourceName: string };

function flatten(nodes: CourseResourceNode[], moduleName: string, acc: Chapter[] = []) {
  nodes.forEach((node) => {
    if (node.status === 'published') {
      const file = node.resources?.[0];
      acc.push({
        id: node.id,
        title: node.title,
        moduleName,
        resourceId: file?.id || '',
        resourceName: file?.name || '',
      });
    }
    if (node.children?.length) flatten(node.children, moduleName, acc);
  });
  return acc;
}

export function DemoOverview({
  className,
  state,
  enabledModuleKeys,
}: {
  className: string;
  state: DemoState;
  enabledModuleKeys: CourseSettingStageKey[];
}) {
  const stages = COURSE_SETTING_STAGES.filter((item) => item.key === 'team' || enabledModuleKeys.includes(item.key));
  const passed = Object.values(state.learning.knowledgePassed).filter(Boolean).length;
  const learned = Object.values(state.learning.resourceProgress).filter((n) => n >= 80).length;
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">进度看板</h2>
        <p className="text-sm text-gray-500 mt-1">{className} · 演示进度只根据本页缓存计算</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['已学课件', learned],
          ['检测通过', passed],
          ['组队', state.team.confirmed || state.teamSession.status === 'grouped' ? '已完成' : '未完成'],
          ['档案记录', state.learning.archive.length],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-gray-100 bg-white p-4">
            <div className="text-xs text-gray-500">{label}</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{value}</div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-2">
        {stages.map((stage, index) => (
          <div key={stage.key} className="flex items-center justify-between text-sm">
            <span>{index + 1}. {stage.name}</span>
            <span className="text-gray-400">{stage.key === 'team' && (state.team.confirmed || state.teamSession.status === 'grouped') ? '已完成' : '进行中'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DemoPracticeCourse({
  classId,
  enabledModuleKeys,
  onChange,
}: {
  classId: string;
  enabledModuleKeys: CourseSettingStageKey[];
  onChange: () => void;
}) {
  const modules = useMemo(
    () => COURSE_SETTING_STAGES.filter((item) => item.courseModuleKey && enabledModuleKeys.includes(item.key)),
    [enabledModuleKeys]
  );
  const [moduleKey, setModuleKey] = useState(modules[0]?.courseModuleKey || 'ideation');
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [points, setPoints] = useState<CourseKnowledgePoint[]>([]);
  const [activePoint, setActivePoint] = useState<CourseKnowledgePoint | null>(null);
  const [questions, setQuestions] = useState<CourseQuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [state, setState] = useState(() => loadDemoState(classId));

  useEffect(() => {
    setState(loadDemoState(classId));
  }, [classId]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listCourseResources(moduleKey).catch(() => null),
      listCourseKnowledgePoints(moduleKey).catch(() => [] as CourseKnowledgePoint[]),
    ]).then(([resources, knowledge]) => {
      if (cancelled) return;
      const stage = modules.find((item) => item.courseModuleKey === moduleKey);
      setChapters(resources ? flatten(resources.nodes || [], stage?.name || moduleKey) : []);
      setPoints(Array.isArray(knowledge) ? knowledge : []);
      setActivePoint(null);
      setQuestions([]);
    });
    return () => {
      cancelled = true;
    };
  }, [moduleKey, modules]);

  const markLearned = (chapter: Chapter) => {
    if (!chapter.resourceId) {
      message.warning('这个章节还没有课件');
      return;
    }
    const next = updateDemoState(classId, (prev) => ({
      ...prev,
      learning: {
        ...prev.learning,
        resourceProgress: { ...prev.learning.resourceProgress, [chapter.resourceId]: 100 },
        archive: [
          { id: `res-${chapter.resourceId}`, kind: 'knowledge', title: chapter.title, detail: chapter.moduleName, at: new Date().toISOString() },
          ...prev.learning.archive.filter((item) => item.id !== `res-${chapter.resourceId}`),
        ],
      },
    }));
    setState(next);
    onChange();
    message.success('已记入本次演示的学习进度');
  };

  const openQuiz = async (point: CourseKnowledgePoint) => {
    setActivePoint(point);
    setAnswers({});
    try {
      setQuestions(await listCourseQuizQuestions(point.id));
    } catch (e) {
      message.error(e instanceof Error ? e.message : '题目加载失败');
      setQuestions([]);
    }
  };

  const submitQuiz = () => {
    if (!activePoint) return;
    const passed = !questions.length || questions.every((question) => {
      const picked = answers[question.id];
      if (Array.isArray(question.correctAnswer)) return question.correctAnswer.includes(picked);
      return picked === question.correctAnswer;
    });
    if (!passed) {
      message.warning('还没答对，可以再试一次');
      return;
    }
    const next = updateDemoState(classId, (prev) => ({
      ...prev,
      learning: {
        ...prev.learning,
        knowledgePassed: { ...prev.learning.knowledgePassed, [activePoint.id]: true },
        archive: [
          { id: `kp-${activePoint.id}`, kind: 'knowledge', title: `${activePoint.title} 检测通过`, detail: activePoint.moduleName || '', at: new Date().toISOString() },
          ...prev.learning.archive.filter((item) => item.id !== `kp-${activePoint.id}`),
        ],
      },
    }));
    setState(next);
    onChange();
    message.success('检测已通过，进度记在本页');
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">实践课程</h2>
        <p className="text-sm text-gray-500">课件来自当前课程配置。观看进度和检测结果只写在本浏览器标签。</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {modules.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`px-3 py-1.5 rounded-xl text-sm cursor-pointer ${moduleKey === item.courseModuleKey ? 'bg-teal-500 text-white' : 'bg-gray-50'}`}
            onClick={() => item.courseModuleKey && setModuleKey(item.courseModuleKey)}
          >
            {item.shortName}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-gray-100 p-4 space-y-3">
          <h3 className="font-bold text-gray-900">章节</h3>
          {!chapters.length ? <p className="text-sm text-gray-400">这个环节还没有已发布章节</p> : null}
          {chapters.map((chapter) => (
            <div key={chapter.id} className="flex items-center justify-between gap-3 text-sm">
              <div>
                <div className="font-medium">{chapter.title}</div>
                <div className="text-xs text-gray-400">{chapter.resourceName || '无课件'} · {state.learning.resourceProgress[chapter.resourceId] >= 80 ? '已学完' : '未学完'}</div>
              </div>
              <div className="flex gap-2">
                {chapter.resourceId ? <a className="text-teal-700" href={courseResourceFileUrl(chapter.resourceId, 'preview')} target="_blank" rel="noreferrer">打开</a> : null}
                <button type="button" className="text-teal-700 cursor-pointer" onClick={() => markLearned(chapter)}>标为已学</button>
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-gray-100 p-4 space-y-3">
          <h3 className="font-bold text-gray-900">知识点检测</h3>
          {points.map((point) => (
            <button key={point.id} type="button" className="w-full text-left text-sm cursor-pointer" onClick={() => void openQuiz(point)}>
              {point.title}
              <span className="ml-2 text-xs text-gray-400">{state.learning.knowledgePassed[point.id] ? '已通过' : '未检测'}</span>
            </button>
          ))}
          {activePoint ? (
            <div className="space-y-3 border-t border-gray-100 pt-3">
              <div className="font-medium">{activePoint.title}</div>
              {!questions.length ? <p className="text-sm text-gray-400">这个知识点还没有题目，可直接记为通过。</p> : null}
              {questions.map((question) => (
                <div key={question.id} className="text-sm">
                  <div className="mb-1">{question.question}</div>
                  {(question.options || []).map((option, index) => (
                    <label key={option} className="flex items-center gap-2 py-0.5">
                      <input type="radio" name={question.id} checked={answers[question.id] === index} onChange={() => setAnswers((prev) => ({ ...prev, [question.id]: index }))} />
                      {option}
                    </label>
                  ))}
                </div>
              ))}
              <Button type="primary" onClick={submitQuiz}>提交检测</Button>
            </div>
          ) : null}
        </div>
      </div>
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
