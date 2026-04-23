import { useState } from 'react';
import { BusinessPlan, ReviewFormData } from './types';
import { mockBusinessPlans } from './mockData';
import DetailModal from './DetailModal';
import ReviewModal from './ReviewModal';

export default function BusinessPlanReview() {
  const [plans, setPlans] = useState<BusinessPlan[]>(mockBusinessPlans);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [selectedPlan, setSelectedPlan] = useState<BusinessPlan | null>(null);
  const [reviewingPlan, setReviewingPlan] = useState<BusinessPlan | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // 统计数据
  const stats = {
    total: plans.length,
    pending: plans.filter(p => p.status === 'pending').length,
    approved: plans.filter(p => p.status === 'approved').length,
    rejected: plans.filter(p => p.status === 'rejected').length
  };

  // 过滤计划书
  const filteredPlans = plans.filter(plan => {
    const matchSearch = plan.teamName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       plan.projectName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'all' || plan.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // 处理审核提交
  const handleReviewSubmit = (data: ReviewFormData) => {
    if (!reviewingPlan) return;

    const updatedPlans = plans.map(plan => {
      if (plan.id === reviewingPlan.id) {
        return {
          ...plan,
          status: data.status,
          reviewComment: data.comment,
          reviewTime: new Date().toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          }),
          reviewer: '当前教师'
        };
      }
      return plan;
    });

    setPlans(updatedPlans);
    setReviewingPlan(null);
    setSelectedPlan(null);
    
    setNotification({
      message: data.status === 'approved' ? '审核通过！团队可以进入下一阶段' : '已退回修改，团队将收到通知',
      type: 'success'
    });
    setTimeout(() => setNotification(null), 3000);
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-amber-100 text-amber-700 border-amber-200',
      approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      rejected: 'bg-rose-100 text-rose-700 border-rose-200'
    };
    const labels = {
      pending: '待审核',
      approved: '已通过',
      rejected: '已退回'
    };
    const icons = {
      pending: 'ri-time-line',
      approved: 'ri-check-line',
      rejected: 'ri-close-line'
    };
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium border ${styles[status as keyof typeof styles]}`}>
        <i className={`${icons[status as keyof typeof icons]} mr-1`}></i>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 头部 */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-8 mb-6 text-white">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">商业计划书审核</h1>
              <p className="text-indigo-100">审核团队提交的商业计划书，通过后可进入最终评价阶段</p>
            </div>
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
              <i className="ri-file-list-3-line text-4xl"></i>
            </div>
          </div>

          {/* 统计卡片 */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-indigo-100 text-sm">总提交数</span>
                <i className="ri-file-text-line text-xl"></i>
              </div>
              <div className="text-3xl font-bold">{stats.total}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-indigo-100 text-sm">待审核</span>
                <i className="ri-time-line text-xl"></i>
              </div>
              <div className="text-3xl font-bold text-amber-300">{stats.pending}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-indigo-100 text-sm">已通过</span>
                <i className="ri-check-line text-xl"></i>
              </div>
              <div className="text-3xl font-bold text-emerald-300">{stats.approved}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-indigo-100 text-sm">已退回</span>
                <i className="ri-close-line text-xl"></i>
              </div>
              <div className="text-3xl font-bold text-rose-300">{stats.rejected}</div>
            </div>
          </div>
        </div>

        {/* 搜索和筛选 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="搜索团队名称或项目名称..."
                className="w-full pl-11 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-4 py-2.5 rounded-lg font-medium transition-all whitespace-nowrap ${
                  statusFilter === 'all'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                全部
              </button>
              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-4 py-2.5 rounded-lg font-medium transition-all whitespace-nowrap ${
                  statusFilter === 'pending'
                    ? 'bg-amber-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                待审核
              </button>
              <button
                onClick={() => setStatusFilter('approved')}
                className={`px-4 py-2.5 rounded-lg font-medium transition-all whitespace-nowrap ${
                  statusFilter === 'approved'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                已通过
              </button>
              <button
                onClick={() => setStatusFilter('rejected')}
                className={`px-4 py-2.5 rounded-lg font-medium transition-all whitespace-nowrap ${
                  statusFilter === 'rejected'
                    ? 'bg-rose-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                已退回
              </button>
            </div>
          </div>
        </div>

        {/* 计划书列表 */}
        <div className="space-y-4">
          {filteredPlans.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="ri-file-list-3-line text-4xl text-gray-400"></i>
              </div>
              <p className="text-gray-500 text-lg">暂无符合条件的商业计划书</p>
            </div>
          ) : (
            filteredPlans.map((plan) => (
              <div
                key={plan.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-6">
                  {/* 左侧图标 */}
                  <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center text-white flex-shrink-0">
                    <i className="ri-file-text-line text-3xl"></i>
                  </div>

                  {/* 中间内容 */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.projectName}</h3>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <i className="ri-team-line"></i>
                            {plan.teamName}
                          </span>
                          <span className="flex items-center gap-1">
                            <i className="ri-time-line"></i>
                            提交时间：{plan.submitTime}
                          </span>
                        </div>
                      </div>
                      {getStatusBadge(plan.status)}
                    </div>

                    <p className="text-gray-700 leading-relaxed mb-4 line-clamp-2">
                      {plan.executiveSummary}
                    </p>

                    {/* 审核记录 */}
                    {plan.status !== 'pending' && plan.reviewComment && (
                      <div className="bg-gray-50 rounded-lg p-4 mb-4">
                        <div className="flex items-start gap-2 mb-2">
                          <i className="ri-chat-check-line text-indigo-600 mt-0.5"></i>
                          <div className="flex-1">
                            <div className="font-medium text-gray-900 mb-1">审核意见</div>
                            <p className="text-sm text-gray-700 line-clamp-2">{plan.reviewComment}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
                          <span>审核人：{plan.reviewer}</span>
                          <span>审核时间：{plan.reviewTime}</span>
                        </div>
                      </div>
                    )}

                    {/* 操作按钮 */}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setSelectedPlan(plan)}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors whitespace-nowrap"
                      >
                        <i className="ri-eye-line mr-1"></i>
                        查看详情
                      </button>
                      {plan.status === 'pending' && (
                        <button
                          onClick={() => setReviewingPlan(plan)}
                          className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg text-sm font-medium hover:shadow-lg transition-all whitespace-nowrap"
                        >
                          <i className="ri-check-line mr-1"></i>
                          开始审核
                        </button>
                      )}
                      {plan.status === 'rejected' && (
                        <button
                          onClick={() => setReviewingPlan(plan)}
                          className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors whitespace-nowrap"
                        >
                          <i className="ri-refresh-line mr-1"></i>
                          重新审核
                        </button>
                      )}
                      {plan.pptUrl && (
                        <a
                          href={plan.pptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors whitespace-nowrap"
                        >
                          <i className="ri-download-line mr-1"></i>
                          下载PPT
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 详情弹窗 */}
      {selectedPlan && (
        <DetailModal
          plan={selectedPlan}
          onClose={() => setSelectedPlan(null)}
          onReview={() => {
            setReviewingPlan(selectedPlan);
            setSelectedPlan(null);
          }}
        />
      )}

      {/* 审核弹窗 */}
      {reviewingPlan && (
        <ReviewModal
          planName={reviewingPlan.projectName}
          teamName={reviewingPlan.teamName}
          onClose={() => setReviewingPlan(null)}
          onSubmit={handleReviewSubmit}
        />
      )}

      {/* 通知提示 */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
          <div className={`px-6 py-4 rounded-xl shadow-lg flex items-center gap-3 ${
            notification.type === 'success'
              ? 'bg-emerald-500 text-white'
              : 'bg-rose-500 text-white'
          }`}>
            <i className={`text-2xl ${
              notification.type === 'success' ? 'ri-check-line' : 'ri-error-warning-line'
            }`}></i>
            <span className="font-medium">{notification.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}