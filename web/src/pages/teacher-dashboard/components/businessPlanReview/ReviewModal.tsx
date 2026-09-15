import { useState } from 'react';
import AppModalPortal from '../../../../components/AppModalPortal';
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
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!comment.trim()) {
      setError('请填写审核意见');
      return;
    }
    if (comment.length > 500) {
      setError('审核意见不能超过500字');
      return;
    }
    onSubmit({ status, comment });
  };

  return (
    <AppModalPortal open onMaskClick={onClose} zIndex={1100}>
      <div
        className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
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
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center hover:bg-white/20 rounded-lg transition-colors"
            >
              <i className="ri-close-line text-xl"></i>
            </button>
          </div>
        </div>

        {/* 内容 */}
        <div className="p-6 space-y-6">
          {/* 审核结果选择 */}
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-3">
              审核结果 <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setStatus('approved')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  status === 'approved'
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-gray-200 hover:border-emerald-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    status === 'approved' ? 'bg-emerald-500' : 'bg-gray-200'
                  }`}>
                    <i className={`ri-check-line text-xl ${
                      status === 'approved' ? 'text-white' : 'text-gray-500'
                    }`}></i>
                  </div>
                  <div className="text-left">
                    <div className={`font-bold ${
                      status === 'approved' ? 'text-emerald-700' : 'text-gray-700'
                    }`}>
                      通过
                    </div>
                    <div className="text-xs text-gray-500">允许进入下一阶段</div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setStatus('rejected')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  status === 'rejected'
                    ? 'border-rose-500 bg-rose-50'
                    : 'border-gray-200 hover:border-rose-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    status === 'rejected' ? 'bg-rose-500' : 'bg-gray-200'
                  }`}>
                    <i className={`ri-close-line text-xl ${
                      status === 'rejected' ? 'text-white' : 'text-gray-500'
                    }`}></i>
                  </div>
                  <div className="text-left">
                    <div className={`font-bold ${
                      status === 'rejected' ? 'text-rose-700' : 'text-gray-700'
                    }`}>
                      退回修改
                    </div>
                    <div className="text-xs text-gray-500">需要团队重新提交</div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* 审核意见 */}
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-3">
              审核意见 <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => {
                setComment(e.target.value);
                setError('');
              }}
              placeholder={
                status === 'approved'
                  ? '请填写审核意见，如：商业计划书内容完整，市场分析深入，财务预测合理...'
                  : '请详细说明需要修改的地方，如：市场分析不够深入，缺乏竞品对比...'
              }
              className="w-full h-40 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
            <div className="flex items-center justify-between mt-2">
              <span className={`text-sm ${error ? 'text-rose-500' : 'text-gray-500'}`}>
                {error || `${comment.length}/500 字`}
              </span>
              {status === 'rejected' && (
                <span className="text-xs text-amber-600 flex items-center gap-1">
                  <i className="ri-information-line"></i>
                  请提供具体的修改建议
                </span>
              )}
            </div>
          </div>

          {/* 温馨提示 */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex gap-3">
              <i className="ri-lightbulb-line text-blue-600 text-xl flex-shrink-0"></i>
              <div className="text-sm text-blue-900">
                <div className="font-bold mb-1">审核建议</div>
                <ul className="space-y-1 text-blue-700">
                  <li>• 评估商业模式的可行性和创新性</li>
                  <li>• 检查市场分析是否充分，财务预测是否合理</li>
                  <li>• 关注团队能力与项目需求的匹配度</li>
                  <li>• 提供建设性的改进意见，帮助团队成长</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="border-t border-gray-200 p-6 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors whitespace-nowrap"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            className={`px-6 py-2.5 rounded-lg font-medium text-white transition-all whitespace-nowrap ${
              status === 'approved'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:shadow-lg'
                : 'bg-gradient-to-r from-rose-500 to-pink-500 hover:shadow-lg'
            }`}
          >
            <i className={`mr-2 ${status === 'approved' ? 'ri-check-line' : 'ri-arrow-go-back-line'}`}></i>
            {status === 'approved' ? '确认通过' : '退回修改'}
          </button>
        </div>
      </div>
    </AppModalPortal>
  );
}