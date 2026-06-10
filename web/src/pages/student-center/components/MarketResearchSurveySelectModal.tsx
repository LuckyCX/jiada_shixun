import { useEffect, useState } from 'react';
import { Alert, Checkbox, Modal, message } from 'antd';
import type { MarketSurvey } from '../../../lib/studentMarketResearchApi';

type Props = {
  open: boolean;
  title: string;
  surveys: MarketSurvey[];
  maxCount?: number;
  onCancel: () => void;
  onConfirm: (surveyIds: string[]) => void;
};

export default function MarketResearchSurveySelectModal({
  open,
  title,
  surveys,
  maxCount = 3,
  onCancel,
  onConfirm,
}: Props) {
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setSelected([]);
  }, [open]);

  const listed = surveys.filter((s) => s.status !== '草稿');

  const toggle = (id: string, checked: boolean) => {
    const survey = surveys.find((s) => s.id === id);
    if (!survey || survey.collected <= 0) return;
    setSelected((prev) => {
      if (!checked) return prev.filter((x) => x !== id);
      if (prev.includes(id)) return prev;
      if (prev.length >= maxCount) {
        message.warning(`最多选择 ${maxCount} 份问卷`);
        return prev;
      }
      return [...prev, id];
    });
  };

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onCancel}
      onOk={() => {
        if (!selected.length) {
          message.warning('请至少选择一份问卷');
          return;
        }
        onConfirm(selected);
      }}
      okText="开始分析"
      cancelText="取消"
      destroyOnClose
    >
      <p className="text-sm text-gray-600 mb-3">最多可选 {maxCount} 份问卷，将仅基于所选问卷的回收数据生成结果。</p>
      {!listed.length ? (
        <Alert type="info" showIcon message="暂无可选问卷，请先发布问卷" />
      ) : (
        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {listed.map((s) => {
            const canSelect = s.collected > 0;
            return (
              <label
                key={s.id}
                className={`flex items-start gap-3 border border-gray-200 rounded-lg px-3 py-2 ${
                  canSelect ? 'cursor-pointer hover:border-green-300' : 'opacity-60 cursor-not-allowed'
                }`}
              >
                <Checkbox
                  disabled={!canSelect}
                  checked={canSelect && selected.includes(s.id)}
                  onChange={(e) => toggle(s.id, e.target.checked)}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">{s.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {s.status} · 已回收 {s.collected} 份
                    {s.publishedAtDisplay ? ` · 发布于 ${s.publishedAtDisplay}` : ''}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
