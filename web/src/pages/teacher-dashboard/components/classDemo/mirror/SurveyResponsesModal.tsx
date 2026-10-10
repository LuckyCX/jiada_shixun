import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Empty, Modal, Spin, message } from 'antd';
import {
  deleteMarketSurveyResponse,
  fetchMarketSurveyResponses,
  type MarketSurvey,
  type MarketSurveyQuestion,
  type SurveyResponseItem,
} from '../demoMarketApi';

function formatAnswer(q: MarketSurveyQuestion, val: unknown) {
  if (val == null || val === '') return '—';
  if (q.type === '多选' && Array.isArray(val)) return val.length ? val.join('、') : '—';
  return String(val);
}

type Props = {
  open: boolean;
  classId: string;
  survey: MarketSurvey | null;
  onClose: () => void;
  onCollectedChange: (surveyId: string, collected: number) => void;
};

export default function SurveyResponsesModal({ open, classId, survey, onClose, onCollectedChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<MarketSurveyQuestion[]>([]);
  const [responses, setResponses] = useState<SurveyResponseItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!classId || !survey?.id) return;
    setLoading(true);
    try {
      const data = await fetchMarketSurveyResponses(classId, survey.id);
      const list = data.responses || [];
      setQuestions(data.questions || []);
      setResponses(list);
      setSelectedId(list[0]?.id ?? null);
      // 打开答卷后把回收数写回列表，避免切到画像仍显示 0 份
      onCollectedChange(survey.id, list.length);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载失败');
      setQuestions([]);
      setResponses([]);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
    // onCollectedChange 仅回写列表回收数，不放进依赖以免父组件内联函数导致重复请求
  }, [classId, survey?.id]);

  useEffect(() => {
    if (open && survey) void load();
  }, [open, survey, load]);

  const selected = useMemo(
    () => responses.find((r) => r.id === selectedId) ?? null,
    [responses, selectedId]
  );

  const handleDelete = async (responseId: string) => {
    if (!classId || !survey?.id) return;
    setDeletingId(responseId);
    try {
      const { collected } = await deleteMarketSurveyResponse(classId, survey.id, responseId);
      setResponses((prev) => {
        const next = prev.filter((r) => r.id !== responseId);
        if (selectedId === responseId) {
          setSelectedId(next[0]?.id ?? null);
        }
        return next;
      });
      onCollectedChange(survey.id, collected);
      message.success('已删除');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '删除失败');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Modal
      title={survey ? `回收答卷 · ${survey.title}` : '回收答卷'}
      open={open}
      onCancel={onClose}
      width={880}
      footer={[
        <Button key="close" onClick={onClose}>
          关闭
        </Button>,
      ]}
      destroyOnClose
    >
      <Spin spinning={loading}>
        {!loading && responses.length === 0 ? (
          <Empty description="暂无答卷" />
        ) : (
          <div className="flex gap-4 min-h-[360px] max-h-[60vh]">
            <div className="w-56 flex-shrink-0 border border-gray-200 rounded-xl overflow-hidden flex flex-col">
              <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-100 bg-gray-50">
                匿名标识
              </div>
              <ul className="flex-1 overflow-y-auto py-1">
                {responses.map((r) => (
                  <li key={r.id}>
                    <div
                      className={`flex items-center gap-1 px-2 py-2 cursor-pointer border-l-2 ${
                        selectedId === r.id
                          ? 'border-green-500 bg-green-50'
                          : 'border-transparent hover:bg-gray-50'
                      }`}
                    >
                      <button
                        type="button"
                        className="flex-1 min-w-0 text-left"
                        onClick={() => setSelectedId(r.id)}
                      >
                        <div className="text-xs font-mono text-gray-800 truncate" title={r.respondentToken}>
                          {r.respondentToken.slice(0, 12)}
                          {r.respondentToken.length > 12 ? '…' : ''}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{r.submittedAt}</div>
                      </button>
                      <Button
                        type="text"
                        danger
                        size="small"
                        aria-label="删除答卷"
                        loading={deletingId === r.id}
                        icon={<i className="ri-delete-bin-line" />}
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDelete(r.id);
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex-1 border border-gray-200 rounded-xl overflow-y-auto p-4 bg-gray-50/50">
              {!selected ? (
                <Empty description="请选择答卷" className="mt-16" />
              ) : (
                <div className="space-y-4">
                  <div className="text-xs text-gray-500 font-mono break-all">{selected.respondentToken}</div>
                  {questions.map((q, idx) => (
                    <div key={q.id} className="rounded-lg border border-gray-200 bg-white p-4">
                      <div className="text-sm font-medium text-gray-900 mb-2">
                        {idx + 1}. {q.text}
                      </div>
                      <div className="text-sm text-gray-700">{formatAnswer(q, selected.answers[q.id])}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Spin>
    </Modal>
  );
}
