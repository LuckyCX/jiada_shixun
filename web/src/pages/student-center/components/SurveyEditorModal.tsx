import { useEffect, useMemo, useState } from 'react';
import { Button, DatePicker, Input, Modal, Select, Space, message } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import {
  SURVEY_QUESTION_TYPES,
  type MarketSurveyQuestion,
  type SurveyQuestionType,
} from '../../../lib/studentMarketResearchApi';

export type SurveyEditorPayload = {
  title: string;
  questions: Omit<MarketSurveyQuestion, 'id'>[];
  closesAt: string;
};

type Props = {
  open: boolean;
  readOnly?: boolean;
  title: string;
  initialTitle?: string;
  initialQuestions?: MarketSurveyQuestion[];
  initialClosesAt?: string | null;
  stageDeadlineDate?: string | null;
  saving?: boolean;
  saveButtonLabel?: string;
  onCancel: () => void;
  onSave?: (payload: SurveyEditorPayload) => void | Promise<void>;
};

function defaultClosesAt(stageDeadlineDate: string | null): Dayjs {
  const now = dayjs();
  const stageEnd = stageDeadlineDate ? dayjs(stageDeadlineDate).endOf('day') : null;
  let candidate = now.add(7, 'day');
  if (stageEnd) {
    candidate = candidate.isAfter(stageEnd) ? stageEnd : candidate;
  }
  if (!candidate.isAfter(now)) {
    candidate = now.add(1, 'hour');
    if (stageEnd && candidate.isAfter(stageEnd)) {
      candidate = stageEnd;
    }
  }
  if (!candidate.isAfter(now)) {
    candidate = now.add(30, 'minute');
  }
  return candidate;
}

function newQuestion(): MarketSurveyQuestion {
  return {
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    text: '',
    type: '单选',
    options: ['选项1', '选项2'],
  };
}

export default function SurveyEditorModal({
  open,
  readOnly = false,
  title,
  initialTitle = '',
  initialQuestions = [],
  initialClosesAt = null,
  stageDeadlineDate = null,
  saving = false,
  saveButtonLabel = '保存',
  onCancel,
  onSave,
}: Props) {
  const [surveyTitle, setSurveyTitle] = useState(initialTitle);
  const [questions, setQuestions] = useState<MarketSurveyQuestion[]>([]);
  const [closesAt, setClosesAt] = useState<Dayjs | null>(null);

  const maxClosesAt = useMemo(
    () => (stageDeadlineDate ? dayjs(stageDeadlineDate).endOf('day') : null),
    [stageDeadlineDate]
  );

  useEffect(() => {
    if (!open) return;
    setSurveyTitle(initialTitle);
    setQuestions(
      initialQuestions.length
        ? initialQuestions.map((q) => ({ ...q, options: q.options ? [...q.options] : [] }))
        : [newQuestion()]
    );
    if (initialClosesAt) {
      const parsed = dayjs(initialClosesAt);
      setClosesAt(parsed.isValid() ? parsed : defaultClosesAt(stageDeadlineDate));
    } else {
      setClosesAt(defaultClosesAt(stageDeadlineDate));
    }
  }, [open, initialTitle, initialQuestions, initialClosesAt, stageDeadlineDate]);

  const updateQuestion = (id: string, patch: Partial<MarketSurveyQuestion>) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== id) return q;
        const next = { ...q, ...patch };
        if (patch.type === '评分' || patch.type === '填空') next.options = [];
        if (patch.type === '单选' || patch.type === '多选') {
          if (!next.options?.length) next.options = ['选项1', '选项2'];
        }
        return next;
      })
    );
  };

  const handleSave = async () => {
    if (readOnly || !onSave) return;
    const t = surveyTitle.trim();
    if (!t) {
      message.warning('请填写问卷标题');
      return;
    }
    if (!closesAt) {
      message.warning('请设置问卷截止时间');
      return;
    }
    const now = dayjs();
    if (!closesAt.isAfter(now)) {
      message.warning('截止时间须晚于当前时间');
      return;
    }
    if (maxClosesAt && closesAt.isAfter(maxClosesAt)) {
      message.warning(`截止时间不能晚于实训环节截止日（${stageDeadlineDate}）`);
      return;
    }
    if (!questions.length) {
      message.warning('请至少添加一道题目');
      return;
    }
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim()) {
        message.warning(`第 ${i + 1} 题请填写题干`);
        return;
      }
      if ((q.type === '单选' || q.type === '多选') && (q.options?.length || 0) < 2) {
        message.warning(`第 ${i + 1} 题至少需要 2 个选项`);
        return;
      }
    }
    await onSave({
      title: t,
      questions: questions.map(({ text, type, options }) => ({ text, type, options: options || [] })),
      closesAt: closesAt.toISOString(),
    });
  };

  const disabledDate = (current: Dayjs) => {
    if (!current) return false;
    if (current.isBefore(dayjs().startOf('day'))) return true;
    if (maxClosesAt && current.isAfter(maxClosesAt, 'day')) return true;
    return false;
  };

  const disabledTime = (current: Dayjs | null) => {
    if (!current || !current.isSame(dayjs(), 'day')) {
      return {};
    }
    const now = dayjs();
    const h = now.hour();
    const m = now.minute();
    const s = now.second();
    return {
      disabledHours: () => Array.from({ length: h }, (_, i) => i),
      disabledMinutes: (selectedHour: number) =>
        selectedHour === h ? Array.from({ length: m }, (_, i) => i) : [],
      disabledSeconds: (selectedHour: number, selectedMinute: number) =>
        selectedHour === h && selectedMinute === m ? Array.from({ length: s + 1 }, (_, i) => i) : [],
    };
  };

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onCancel}
      width={720}
      footer={
        readOnly
          ? [
              <Button key="close" onClick={onCancel}>
                关闭
              </Button>,
            ]
          : [
              <Button key="cancel" onClick={onCancel}>
                取消
              </Button>,
              <Button key="save" type="primary" loading={saving} onClick={() => void handleSave()}>
                {saveButtonLabel}
              </Button>,
            ]
      }
      destroyOnClose
    >
      <div className="space-y-4 max-h-[60vh] overflow-y-auto py-1">
        <div>
          <div className="text-sm font-medium text-gray-900 mb-1">问卷标题</div>
          <Input
            value={surveyTitle}
            onChange={(e) => setSurveyTitle(e.target.value)}
            disabled={readOnly}
            placeholder="请输入问卷标题"
          />
        </div>
        <div>
          <div className="text-sm font-medium text-gray-900 mb-1">问卷截止时间</div>
          <DatePicker
            showTime={{ format: 'HH:mm' }}
            className="w-full"
            value={closesAt}
            onChange={(v) => setClosesAt(v)}
            disabled={readOnly}
            disabledDate={disabledDate}
            disabledTime={disabledTime}
            format="YYYY-MM-DD HH:mm"
          />
          {stageDeadlineDate && (
            <p className="text-xs text-gray-500 mt-1 mb-0">
              须晚于当前时间，且不晚于实训截止日 {stageDeadlineDate}
            </p>
          )}
        </div>
        {questions.map((q, idx) => (
          <div key={q.id} className="border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-gray-700">第 {idx + 1} 题</span>
              {!readOnly && questions.length > 1 && (
                <Button
                  type="text"
                  danger
                  size="small"
                  aria-label="删除题目"
                  icon={<i className="ri-delete-bin-line" />}
                  onClick={() => setQuestions((prev) => prev.filter((x) => x.id !== q.id))}
                />
              )}
            </div>
            <Input.TextArea
              value={q.text}
              onChange={(e) => updateQuestion(q.id, { text: e.target.value })}
              disabled={readOnly}
              rows={2}
              placeholder="题干"
            />
            <Select
              className="w-full"
              value={q.type}
              disabled={readOnly}
              options={SURVEY_QUESTION_TYPES.map((t) => ({ value: t, label: t }))}
              onChange={(v: SurveyQuestionType) => updateQuestion(q.id, { type: v })}
            />
            {(q.type === '单选' || q.type === '多选') && (
              <div className="space-y-2">
                {(q.options || []).map((opt, oi) => (
                  <Space.Compact key={oi} className="w-full">
                    <Input
                      value={opt}
                      disabled={readOnly}
                      onChange={(e) => {
                        const opts = [...(q.options || [])];
                        opts[oi] = e.target.value;
                        updateQuestion(q.id, { options: opts });
                      }}
                    />
                    {!readOnly && (q.options?.length || 0) > 2 && (
                      <Button
                        type="text"
                        danger
                        aria-label="删除选项"
                        icon={<i className="ri-delete-bin-line" />}
                        onClick={() => {
                          const opts = (q.options || []).filter((_, i) => i !== oi);
                          updateQuestion(q.id, { options: opts });
                        }}
                      />
                    )}
                  </Space.Compact>
                ))}
                {!readOnly && (
                  <Button
                    type="dashed"
                    block
                    onClick={() => updateQuestion(q.id, { options: [...(q.options || []), `选项${(q.options?.length || 0) + 1}`] })}
                  >
                    添加选项
                  </Button>
                )}
              </div>
            )}
            {q.type === '评分' && !readOnly && (
              <p className="text-xs text-gray-500 mb-0">受访者将使用 1–5 分评分</p>
            )}
          </div>
        ))}
        {!readOnly && (
          <Button type="dashed" block onClick={() => setQuestions((prev) => [...prev, newQuestion()])}>
            添加题目
          </Button>
        )}
      </div>
    </Modal>
  );
}
