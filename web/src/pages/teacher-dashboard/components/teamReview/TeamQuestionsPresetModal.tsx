import { useEffect, useState } from 'react';
import { Modal, Form, Input, Select, Button, Space, message } from 'antd';
import {
  fetchTeacherTeamQuestions,
  saveTeacherTeamQuestions,
  type TeamQuestion,
  type TeamQuestionType,
} from '../../../../lib/teamFormationApi';

type Props = {
  open: boolean;
  classId: string;
  className: string;
  onClose: () => void;
};

type DraftQuestion = {
  title: string;
  questionType: TeamQuestionType;
  options: { label: string; value: string }[];
  required: boolean;
};

const TYPE_OPTIONS = [
  { value: 'single', label: '单选' },
  { value: 'multi', label: '多选' },
  { value: 'short', label: '简答' },
];

export default function TeamQuestionsPresetModal({ open, classId, className, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);

  useEffect(() => {
    if (!open || !classId) return;
    setLoading(true);
    fetchTeacherTeamQuestions(classId)
      .then((list) => {
        if (list.length) {
          setQuestions(
            list.map((q) => ({
              title: q.title,
              questionType: q.questionType,
              options: q.options?.length ? q.options : [{ label: '选项1', value: '1' }],
              required: q.required,
            }))
          );
        } else {
          setQuestions([
            { title: '', questionType: 'single', options: [{ label: '', value: '1' }], required: true },
            { title: '', questionType: 'single', options: [{ label: '', value: '1' }], required: true },
            { title: '', questionType: 'short', options: [], required: true },
          ]);
        }
      })
      .catch((e) => message.error(e instanceof Error ? e.message : '加载失败'))
      .finally(() => setLoading(false));
  }, [open, classId]);

  const addQuestion = () => {
    if (questions.length >= 10) {
      message.warning('最多 10 道题');
      return;
    }
    setQuestions([
      ...questions,
      { title: '', questionType: 'single', options: [{ label: '', value: '1' }], required: true },
    ]);
  };

  const removeQuestion = (index: number) => {
    if (questions.length <= 3) {
      message.warning('至少保留 3 道题');
      return;
    }
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (questions.length < 3 || questions.length > 10) {
      message.error('题目数量须在 3～10 道之间');
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
      message.success('已保存组队测评题');
      onClose();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`组队问题预设 — ${className}`}
      open={open}
      onCancel={onClose}
      width={720}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button key="save" type="primary" loading={saving} onClick={() => void handleSave()}>
          保存
        </Button>,
      ]}
      destroyOnHidden
    >
      <p className="text-xs text-gray-500 mb-4">3～10 道题；简答最多 100 字；单选/多选每题最多 6 个选项。</p>
      {loading ? (
        <div className="py-8 text-center text-gray-400 text-sm">加载中…</div>
      ) : (
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {questions.map((q, qi) => (
            <div key={qi} className="border border-gray-100 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-gray-500">第 {qi + 1} 题</span>
                <Button
                  type="text"
                  danger
                  size="small"
                  icon={<i className="ri-delete-bin-line" />}
                  onClick={() => removeQuestion(qi)}
                />
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
                  <Space key={oi} className="w-full" align="start">
                    <Input
                      className="flex-1"
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
                        onClick={() => {
                          const next = [...questions];
                          next[qi] = { ...next[qi], options: next[qi].options.filter((_, i) => i !== oi) };
                          setQuestions(next);
                        }}
                      />
                    )}
                  </Space>
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
          <Button type="dashed" block icon={<i className="ri-add-line" />} onClick={addQuestion} disabled={questions.length >= 10}>
            添加题目
          </Button>
        </div>
      )}
    </Modal>
  );
}
