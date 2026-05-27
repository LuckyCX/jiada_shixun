import { useState } from 'react';
import type { TopicSubmission } from './types';

interface ReviewModalProps {
  topic: TopicSubmission;
  onClose: () => void;
  onSubmit: (topicId: string, status: 'approved' | 'rejected', comment: string) => void;
}

export default function ReviewModal({ topic, onClose, onSubmit }: ReviewModalProps) {
  const [reviewStatus, setReviewStatus] = useState<'approved' | 'rejected'>('approved');
  const [comment, setComment] = useState('');

  const handleSubmit = () => {
    if (!comment.trim()) {
      alert('请填写审核意见');
      return;
    }
    onSubmit(topic.id, reviewStatus, comment);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">选题审核</h2>
              <p className="text-sm text-purple-100 mt-1">{topic.projectName}</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors"
            >
              <i className="ri-close-line text-xl"></i>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Team Info */}
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">团队名称：</span>
                <span className="font-medium text-gray-900">{topic.teamName}</span>
              </div>
              <div>
                <span className="text-gray-500">队长：</span>
                <span className="font-medium text-gray-900">{topic.leaderName}</span>
              </div>
              <div>
                <span className="text-gray-500">成员人数：</span>
                <span className="font-medium text-gray-900">{topic.memberCount} 人</span>
              </div>
              <div>
                <span className="text-gray-500">提交时间：</span>
                <span className="font-medium text-gray-900">
                  {new Date(topic.submitTime).toLocaleString('zh-CN')}
                </span>
              </div>
            </div>
          </div>

          {/* Project Details */}
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">项目方向</label>
              <div className="px-4 py-2 bg-purple-50 border border-purple-200 rounded-lg text-purple-700 font-medium inline-block whitespace-pre-wrap break-all">
                {topic.direction}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">项目描述</label>
              <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-all">
                {topic.description}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">目标用户</label>
              <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-all">
                {topic.targetUsers}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">核心价值</label>
              <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-all">
                {topic.coreValue}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">核心问题</label>
              <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-all">
                {topic.coreProblem}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">解决方案概述</label>
              <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-all">
                {topic.solutionOverview}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">市场规模</label>
              <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-all">
                {topic.marketSize}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">竞争优势</label>
              <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-all">
                {topic.competitiveAdvantage}
              </div>
            </div>
          </div>

          {/* Review Section */}
          <div className="border-t border-gray-200 pt-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">审核结果</label>
            <div className="flex gap-3 mb-4">
              <button
                onClick={() => setReviewStatus('approved')}
                className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                  reviewStatus === 'approved'
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <i className="ri-checkbox-circle-line mr-2"></i>
                通过
              </button>
              <button
                onClick={() => setReviewStatus('rejected')}
                className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                  reviewStatus === 'rejected'
                    ? 'bg-rose-600 text-white shadow-lg shadow-rose-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <i className="ri-close-circle-line mr-2"></i>
                退回修改
              </button>
            </div>

            <label className="block text-sm font-medium text-gray-700 mb-2">
              审核意见 <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder={
                reviewStatus === 'approved'
                  ? '请填写通过意见，如：项目选题具有创新性，建议后续重点关注...'
                  : '请填写退回原因和修改建议，如：项目定位不够清晰，建议...'
              }
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              rows={6}
              maxLength={500}
            />
            <div className="text-xs text-gray-400 mt-1 text-right">{comment.length}/500</div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 rounded-b-2xl flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-medium hover:shadow-lg transition-all"
          >
            <i className="ri-check-line mr-2"></i>
            提交审核
          </button>
        </div>
      </div>
    </div>
  );
}