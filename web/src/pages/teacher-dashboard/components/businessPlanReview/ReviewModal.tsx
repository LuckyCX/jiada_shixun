import { useMemo, useState } from 'react';
import AppModalPortal from '../../../../components/AppModalPortal';
import { BUSINESS_PLAN_RUBRIC_DIMENSIONS } from '../../../../lib/businessPlanTemplate';
import { ReviewFormData } from './types';

interface ReviewModalProps {
  planName: string;
  teamName: string;
  onClose: () => void;
  onSubmit: (data: ReviewFormData) => void;
}

export default function ReviewModal({ planName, teamName, onClose, onSubmit }: ReviewModalProps) {
  const [status, setStatus] = useState<'approved' | 'rejected'>('approved');
  const [comment, setComment] = useState('');
  const [scores, setScores] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const d of BUSINESS_PLAN_RUBRIC_DIMENSIONS) init[d.key] = '';
    return init;
  });
  const [error, setError] = useState('');

  const totalPreview = useMemo(() => {
    let t = 0;
    for (const d of BUSINESS_PLAN_RUBRIC_DIMENSIONS) {
      const n = Number(scores[d.key]);
      if (Number.isFinite(n)) t += Math.round(n);
    }
    return t;
  }, [scores]);

  const handleScoreChange = (key: string, max: number, raw: string) => {
    // 允许清空以便重新输入；非数字片段直接忽略
    if (raw === '') {
      setScores((s) => ({ ...s, [key]: '' }));
      return;
    }
    if (!/^-?\d*$/.test(raw)) return;
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    if (n < 0) {
      setScores((s) => ({ ...s, [key]: '0' }));
      return;
    }
    if (n > max) {
      setScores((s) => ({ ...s, [key]: String(max) }));
      return;
    }
    setScores((s) => ({ ...s, [key]: raw }));
  };

  const handleSubmit = () => {
    if (!comment.trim()) {
      setError('请填写审核意见');
      return;
    }
    if (comment.length > 500) {
      setError('审核意见不能超过500字');
      return;
    }
    const numeric: Record<string, number> = {};
    for (const d of BUSINESS_PLAN_RUBRIC_DIMENSIONS) {
      const raw = String(scores[d.key] ?? '').trim();
      if (raw === '') {
        setError(`请填写「${d.title}」得分`);
        return;
      }
      const n = Number(raw);
      if (!Number.isFinite(n) || !Number.isInteger(n)) {
        setError(`「${d.title}」得分须为整数`);
        return;
      }
      if (n < 0) {
        setError(`「${d.title}」得分不能小于 0`);
        return;
      }
      if (n > d.max) {
        setError(`「${d.title}」得分不能超过 ${d.max}`);
        return;
      }
      numeric[d.key] = n;
    }
    setError('');
    onSubmit({ status, comment, scores: numeric });
  };

  return (
    <AppModalPortal open zIndex={1100}>
      <div
        className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">审核商业计划书</h2>
              <div className="flex items-center gap-4 text-indigo-100">
                <span className="flex items-center gap-2">
                  <i className="ri-file-text-line"></i>
                  {planName}
                </span>
                <span className="flex items-center gap-2">
                  <i className="ri-team-line"></i>
                  {teamName}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center hover:bg-white/20 rounded-lg transition-colors"
            >
              <i className="ri-close-line text-xl"></i>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-3">
              审核结果 <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setStatus('approved')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  status === 'approved'
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-gray-200 hover:border-emerald-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      status === 'approved' ? 'bg-emerald-500' : 'bg-gray-200'
                    }`}
                  >
                    <i
                      className={`ri-check-line text-xl ${
                        status === 'approved' ? 'text-white' : 'text-gray-500'
                      }`}
                    ></i>
                  </div>
                  <div className="text-left">
                    <div
                      className={`font-bold ${
                        status === 'approved' ? 'text-emerald-700' : 'text-gray-700'
                      }`}
                    >
                      通过
                    </div>
                    <div className="text-xs text-gray-500">允许进入下一阶段</div>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStatus('rejected')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  status === 'rejected'
                    ? 'border-rose-500 bg-rose-50'
                    : 'border-gray-200 hover:border-rose-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      status === 'rejected' ? 'bg-rose-500' : 'bg-gray-200'
                    }`}
                  >
                    <i
                      className={`ri-close-line text-xl ${
                        status === 'rejected' ? 'text-white' : 'text-gray-500'
                      }`}
                    ></i>
                  </div>
                  <div className="text-left">
                    <div
                      className={`font-bold ${
                        status === 'rejected' ? 'text-rose-700' : 'text-gray-700'
                      }`}
                    >
                      退回修改
                    </div>
                    <div className="text-xs text-gray-500">需要团队重新提交</div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-bold text-gray-900 m-0">
                评分表 <span className="text-rose-500">*</span>
              </label>
              <span className="text-sm font-semibold text-indigo-700">预估总分：{totalPreview}</span>
            </div>
            <div className="space-y-3">
              {BUSINESS_PLAN_RUBRIC_DIMENSIONS.map((dim) => (
                <div key={dim.key} className="border border-gray-100 rounded-xl p-3">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <div className="text-sm font-semibold text-gray-800">
                      {dim.title}
                      <span className="text-gray-400 font-normal ml-1">（满分 {dim.max}）</span>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={dim.max}
                      step={1}
                      required
                      className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm text-right"
                      value={scores[dim.key]}
                      onChange={(e) => handleScoreChange(dim.key, dim.max, e.target.value)}
                      onBlur={() => {
                        const raw = String(scores[dim.key] ?? '').trim();
                        if (raw === '') return;
                        const n = Number(raw);
                        if (!Number.isFinite(n)) {
                          setScores((s) => ({ ...s, [dim.key]: '' }));
                          return;
                        }
                        const clamped = Math.min(dim.max, Math.max(0, Math.round(n)));
                        setScores((s) => ({ ...s, [dim.key]: String(clamped) }));
                      }}
                      placeholder="必填"
                    />
                  </div>
                  <p className="text-xs text-gray-500 m-0 leading-relaxed line-clamp-2">{dim.description}</p>
                  <p className="text-[11px] text-gray-400 m-0 mt-1">
                    {dim.levels.map((l) => `${l.label}${l.range}`).join(' · ')}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-900 mb-3">
              审核意见 / 评语 <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              maxLength={500}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200"
              placeholder="请填写总分说明与评语"
            />
            {error ? <p className="text-sm text-rose-600 mt-2 mb-0">{error}</p> : null}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
          >
            提交审核
          </button>
        </div>
      </div>
    </AppModalPortal>
  );
}
