import type { TopicSubmission } from './types';

interface TopicDetailModalProps {
  topic: TopicSubmission;
  onClose: () => void;
}

export default function TopicDetailModal({ topic, onClose }: TopicDetailModalProps) {
  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-amber-100 text-amber-700 border-amber-200',
      approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      rejected: 'bg-rose-100 text-rose-700 border-rose-200',
    };
    const labels = {
      pending: '待审核',
      approved: '已通过',
      rejected: '已退回',
    };
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium border ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-xl font-bold">{topic.projectName}</h2>
                {getStatusBadge(topic.status)}
              </div>
              <p className="text-sm text-purple-100">选题详情</p>
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
          {/* Team Info Card */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-5 mb-6 border border-purple-100">
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <i className="ri-team-line text-purple-600"></i>
              团队信息
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                  {topic.teamName.charAt(0)}
                </div>
                <div>
                  <div className="text-xs text-gray-500">团队名称</div>
                  <div className="font-medium text-gray-900">{topic.teamName}</div>
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">队长</div>
                <div className="font-medium text-gray-900">{topic.leaderName}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">成员人数</div>
                <div className="font-medium text-gray-900">{topic.memberCount} 人</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">提交时间</div>
                <div className="font-medium text-gray-900">
                  {new Date(topic.submitTime).toLocaleString('zh-CN')}
                </div>
              </div>
            </div>
          </div>

          {/* Project Direction */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <i className="ri-compass-line text-purple-600"></i>
              项目方向
            </h3>
            <div className="px-4 py-2 bg-purple-50 border border-purple-200 rounded-lg text-purple-700 font-medium inline-block whitespace-pre-wrap break-all">
              {topic.direction}
            </div>
          </div>

          {/* Project Description */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <i className="ri-file-text-line text-purple-600"></i>
              项目描述
            </h3>
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-all">
              {topic.description}
            </div>
          </div>

          {/* Target Users */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <i className="ri-user-heart-line text-purple-600"></i>
              目标用户
            </h3>
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-all">
              {topic.targetUsers}
            </div>
          </div>

          {/* Core Value */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <i className="ri-star-line text-purple-600"></i>
              核心价值
            </h3>
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-all">
              {topic.coreValue}
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <i className="ri-question-line text-purple-600"></i>
              核心问题
            </h3>
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-all">
              {topic.coreProblem}
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <i className="ri-lightbulb-line text-purple-600"></i>
              解决方案概述
            </h3>
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-all">
              {topic.solutionOverview}
            </div>
          </div>

          {/* Market Size */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <i className="ri-pie-chart-line text-purple-600"></i>
              市场规模
            </h3>
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-all">
              {topic.marketSize}
            </div>
          </div>

          {/* Competitive Advantage */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <i className="ri-trophy-line text-purple-600"></i>
              竞争优势
            </h3>
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-all">
              {topic.competitiveAdvantage}
            </div>
          </div>

          {/* Review Comment */}
          {topic.reviewComment && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <i className="ri-message-3-line text-purple-600"></i>
                审核意见
              </h3>
              <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-200">
                <p className="text-sm text-gray-700 leading-relaxed mb-2 whitespace-pre-wrap break-all">{topic.reviewComment}</p>
                {topic.reviewTime && (
                  <div className="text-xs text-gray-500 flex items-center gap-1">
                    <i className="ri-time-line"></i>
                    {new Date(topic.reviewTime).toLocaleString('zh-CN')}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 rounded-b-2xl">
          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-medium hover:shadow-lg transition-all"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}