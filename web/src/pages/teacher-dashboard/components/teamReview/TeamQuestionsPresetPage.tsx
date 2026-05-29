import { useEffect, useState } from 'react';
import { Spin, Input, Select, Button, Modal, message } from 'antd';
import {
  getAllPlatformPresetDrafts,
  getPlatformPresetDraft,
} from '../../../../lib/defaultTeamFormationQuestions';
import {
  fetchTeacherTeamQuestions,
  saveTeacherTeamQuestions,
  type TeamQuestionType,
} from '../../../../lib/teamFormationApi';

type DraftQuestion = {
  title: string;
  questionType: TeamQuestionType;
  options: { label: string; value: string }[];
  required: boolean;
};

const MIN_QUESTIONS = 5;
const MAX_QUESTIONS = 10;

const TYPE_OPTIONS = [
  { value: 'single', label: '单选' },
  { value: 'multi', label: '多选' },
  { value: 'short', label: '简答' },
];

function snapshotQuestions(qs: DraftQuestion[]): string {
  const norm = qs.map((q) => ({
    title: q.title.trim(),
    questionType: q.questionType,
    required: q.required,
    options:
      q.questionType === 'short'
        ? []
        : q.options.map((o, j) => ({
            label: o.label.trim(),
            value: String(o.value || j + 1),
          })),
  }));
  return JSON.stringify(norm);
}

export function confirmLeaveTeamQuestionsUnsaved(onConfirm: () => void) {
  Modal.confirm({
    title: '题目编辑后未保存',
    content: '是否确认返回？如不保存，返回后题目内容将不会生效。',
    okText: '确认返回',
    cancelText: '继续编辑',
    onOk: onConfirm,
  });
}

type Props = {
  classId: string;
  className: string;
  onBack: () => void;
  onSaved?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
};

export default function TeamQuestionsPresetPage({ classId, className, onBack, onSaved, onDirtyChange }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const [savedSnapshot, setSavedSnapshot] = useState('');

  const applyLoadedQuestions = (next: DraftQuestion[]) => {
    setQuestions(next);
    setSavedSnapshot(snapshotQuestions(next));
  };

  const loadQuestions = () => {
    setLoading(true);
    fetchTeacherTeamQuestions(classId)
      .then((list) => {
        if (list.length) {
          applyLoadedQuestions(
            list.map((q) => ({
              title: q.title,
              questionType: q.questionType,
              options: q.options?.length ? q.options : [{ label: '选项1', value: '1' }],
              required: q.required,
            }))
          );
        } else {
          applyLoadedQuestions(
            Array.from({ length: MIN_QUESTIONS }, (_, i) => ({
              title: '',
              questionType: i === MIN_QUESTIONS - 1 ? ('short' as const) : ('single' as const),
              options: i === MIN_QUESTIONS - 1 ? [] : [{ label: '', value: '1' }],
              required: true,
            }))
          );
        }
      })
      .catch((e) => message.error(e instanceof Error ? e.message : '加载失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadQuestions();
  }, [classId]);

  const isDirty = !loading && snapshotQuestions(questions) !== savedSnapshot;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const tryLeave = () => {
    if (isDirty) {
      confirmLeaveTeamQuestionsUnsaved(onBack);
      return;
    }
    onBack();
  };

  const addQuestion = () => {
    if (questions.length >= MAX_QUESTIONS) {
      message.warning(`最多 ${MAX_QUESTIONS} 道题`);
      return;
    }
    setQuestions([
      ...questions,
      { title: '', questionType: 'single', options: [{ label: '', value: '1' }], required: true },
    ]);
  };

  const removeQuestion = (index: number) => {
    if (questions.length <= MIN_QUESTIONS) {
      message.warning(`至少保留 ${MIN_QUESTIONS} 道题`);
      return;
    }
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const resetQuestionToPreset = (index: number) => {
    const preset = getPlatformPresetDraft(index);
    if (!preset) {
      message.warning('仅前 10 道题支持恢复为平台预设');
      return;
    }
    const next = [...questions];
    next[index] = preset;
    setQuestions(next);
    message.success(`第 ${index + 1} 题已恢复为平台预设`);
  };

  const resetAllToPreset = () => {
    Modal.confirm({
      title: '重置全部题目',
      content: '将恢复为平台默认的 10 道组队测评题。需点击「保存」后才会对学生端生效。',
      okText: '确认重置',
      cancelText: '取消',
      onOk: () => {
        setQuestions(getAllPlatformPresetDrafts());
        message.success('已全部恢复为平台预设题目');
      },
    });
  };

  const handleSave = async () => {
    if (questions.length < MIN_QUESTIONS || questions.length > MAX_QUESTIONS) {
      message.error(`题目数量须在 ${MIN_QUESTIONS}～${MAX_QUESTIONS} 道之间`);
      return;
    }
    const payload = questions.map((q, i) => ({
      title: q.title.trim(),
      questionType: q.questionType,
      sortOrder: i,
      required: q.required,
      options:
        q.questionType === 'short'
          ? []
          : q.options.map((o, j) => ({
              label: o.label.trim(),
              value: String(o.value || j + 1),
            })),
    }));
    for (const q of payload) {
      if (!q.title) {
        message.error('请填写题目标题');
        return;
      }
      if (q.questionType !== 'short' && (!q.options.length || q.options.some((o) => !o.label))) {
        message.error('单选/多选题须填写选项');
        return;
      }
    }
    setSaving(true);
    try {
      await saveTeacherTeamQuestions(classId, payload);
      setSavedSnapshot(snapshotQuestions(questions));
      message.success('已保存组队测评题');
      onSaved?.();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-gray-600">
            班级：<span className="font-semibold text-gray-900">{className}</span>
            {isDirty && <span className="ml-2 text-xs text-amber-600">（有未保存修改）</span>}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            5～10 道题；简答最多 100 字；单选/多选每题最多 6 个选项。保存后学生端将加载本题库。
          </p>
        </div>
        {isDirty && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button type="primary" loading={saving} disabled={loading} onClick={() => void handleSave()}>
              保存
            </Button>
            <Button disabled={loading} onClick={resetAllToPreset}>
              重置全部
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Spin tip="加载题目…" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
          {questions.map((q, qi) => (
            <div key={qi} className="bg-white border border-gray-100 rounded-xl p-4 space-y-2 shadow-sm min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-gray-500">第 {qi + 1} 题</span>
                <div className="flex items-center gap-0.5">
                  {qi < 10 && (
                    <Button
                      type="text"
                      size="small"
                      className="text-gray-500"
                      icon={<i className="ri-restart-line" />}
                      onClick={() => resetQuestionToPreset(qi)}
                      title="恢复为平台预设"
                    >
                      重置
                    </Button>
                  )}
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<i className="ri-delete-bin-line" />}
                    disabled={questions.length <= MIN_QUESTIONS}
                    title={questions.length <= MIN_QUESTIONS ? `至少保留 ${MIN_QUESTIONS} 道题` : '删除本题'}
                    onClick={() => removeQuestion(qi)}
                  />
                </div>
              </div>
              <Input
                placeholder="题目"
                value={q.title}
                onChange={(e) => {
                  const next = [...questions];
                  next[qi] = { ...next[qi], title: e.target.value };
                  setQuestions(next);
                }}
              />
              <Select
                className="w-full"
                value={q.questionType}
                options={TYPE_OPTIONS}
                onChange={(v) => {
                  const next = [...questions];
                  next[qi] = {
                    ...next[qi],
                    questionType: v,
                    options: v === 'short' ? [] : next[qi].options.length ? next[qi].options : [{ label: '', value: '1' }],
                  };
                  setQuestions(next);
                }}
              />
              {q.questionType !== 'short' &&
                q.options.map((opt, oi) => (
                  <div key={oi} className="flex w-full items-center gap-2 min-w-0">
                    <Input
                      className="flex-1 min-w-0"
                      placeholder={`选项 ${oi + 1}`}
                      value={opt.label}
                      onChange={(e) => {
                        const next = [...questions];
                        const opts = [...next[qi].options];
                        opts[oi] = { ...opts[oi], label: e.target.value };
                        next[qi] = { ...next[qi], options: opts };
                        setQuestions(next);
                      }}
                    />
                    {q.options.length > 1 && (
                      <Button
                        type="text"
                        danger
                        size="small"
                        className="flex-shrink-0"
                        icon={<i className="ri-delete-bin-line" />}
                        onClick={() => {
                          const next = [...questions];
                          next[qi] = { ...next[qi], options: next[qi].options.filter((_, i) => i !== oi) };
                          setQuestions(next);
                        }}
                      />
                    )}
                  </div>
                ))}
              {q.questionType !== 'short' && q.options.length < 6 && (
                <Button
                  type="dashed"
                  size="small"
                  onClick={() => {
                    const next = [...questions];
                    next[qi] = {
                      ...next[qi],
                      options: [...next[qi].options, { label: '', value: String(next[qi].options.length + 1) }],
                    };
                    setQuestions(next);
                  }}
                >
                  添加选项
                </Button>
              )}
            </div>
          ))}
          <Button
            type="dashed"
            block
            icon={<i className="ri-add-line" />}
            className="lg:col-span-2"
            onClick={addQuestion}
            disabled={questions.length >= MAX_QUESTIONS}
          >
            添加题目
          </Button>
        </div>
      )}

      <div className="flex justify-end gap-3 sticky bottom-0 bg-gray-50 py-3">
        <Button onClick={tryLeave}>取消</Button>
        {isDirty && (
          <Button type="primary" loading={saving} onClick={() => void handleSave()}>
            保存
          </Button>
        )}
      </div>
    </div>
  );
}
