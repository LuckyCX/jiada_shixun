import { useCallback, useEffect, useState } from 'react';
import { message } from 'antd';
import { BusinessPlan, ReviewFormData } from './types';
import ReviewModal from './ReviewModal';
import type { TeacherPersonalClassRow } from '../../teacherPortalApi';
import {
  fetchTeacherBusinessPlanSubmissions,
  reviewTeacherBusinessPlanSubmission,
} from '../../../../lib/teacherBusinessPlanApi';

type BusinessPlanReviewProps = {
  personalClass: TeacherPersonalClassRow;
  onOpenDetail: (submissionId: string) => void;
};

function stripHtmlPreview(raw: string) {
  return String(raw || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function BusinessPlanReview({ personalClass, onOpenDetail }: BusinessPlanReviewProps) {
  const classId = personalClass.id;
  const [plans, setPlans] = useState<BusinessPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [reviewingPlan, setReviewingPlan] = useState<BusinessPlan | null>(null);

  const loadPlans = useCallback(() => {
    setLoading(true);
    return fetchTeacherBusinessPlanSubmissions(classId, statusFilter === 'all' ? 'all' : statusFilter)
      .then(setPlans)
      .catch((e) => {
        setPlans([]);
        message.error(e instanceof Error ? e.message : '加载失败');
      })
      .finally(() => setLoading(false));
  }, [classId, statusFilter]);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  const stats = {
    total: plans.length,
    pending: plans.filter((p) => p.status === 'pending').length,
    approved: plans.filter((p) => p.status === 'approved').length,
    rejected: plans.filter((p) => p.status === 'rejected').length,
  };

  const filteredPlans = plans.filter((plan) => {
    const matchSearch =
      plan.teamName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plan.projectName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'all' || plan.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleReviewSubmit = (data: ReviewFormData) => {
    if (!reviewingPlan) return;
    void reviewTeacherBusinessPlanSubmission(classId, reviewingPlan.id, data)
      .then(() => {
        setReviewingPlan(null);
        void loadPlans();
        message.success(
          data.status === 'approved' ? '审核通过，该团队实训流程已结束' : '已退回，团队可重新提交'
        );
      })
      .catch((e) => {
        message.error(e instanceof Error ? e.message : '审核失败');
      });
  };

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
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: '总提交', value: stats.total, cls: 'text-gray-900' },
          { label: '待审核', value: stats.pending, cls: 'text-amber-600' },
          { label: '已通过', value: stats.approved, cls: 'text-emerald-600' },
          { label: '已退回', value: stats.rejected, cls: 'text-rose-600' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 px-3 py-2.5">
            <div className="text-[11px] text-gray-500">{s.label}</div>
            <div className={`text-lg font-semibold ${s.cls}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex-1 relative">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜索团队或项目…"
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {(
              [
                { key: 'all', label: '全部' },
                { key: 'pending', label: '待审核' },
                { key: 'approved', label: '已通过' },
                { key: 'rejected', label: '已退回' },
              ] as const
            ).map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setStatusFilter(f.key)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap cursor-pointer ${
                  statusFilter === f.key
                    ? 'bg-teal-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-2.5">
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-100 py-10 text-center text-sm text-gray-400">
            加载中…
          </div>
        ) : filteredPlans.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">
            暂无符合条件的商业计划书
          </div>
        ) : (
          filteredPlans.map((plan) => (
            <div
              key={plan.id}
              className="bg-white rounded-xl border border-gray-100 p-3 md:p-4 hover:border-teal-200 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-teal-50 text-teal-600 rounded-lg flex items-center justify-center shrink-0">
                  <i className="ri-file-text-line text-lg" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="text-sm md:text-base font-semibold text-gray-900 truncate">
                      {plan.projectName}
                    </h3>
                    {getStatusBadge(plan.status)}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500 mb-2">
                    <span>{plan.teamName}</span>
                    <span>提交于 {plan.submitTime}</span>
                    {plan.totalScore != null ? (
                      <span className="text-teal-600 font-medium">总分 {plan.totalScore}</span>
                    ) : null}
                  </div>
                  <p className="text-xs md:text-sm text-gray-600 line-clamp-2 mb-2.5">
                    {stripHtmlPreview(
                      (plan.sections || []).map((s) => s.content).find((c) => stripHtmlPreview(c)) ||
                        plan.fullText ||
                        plan.executiveSummary ||
                        ''
                    ) || '（暂无正文预览）'}
                  </p>
                  {plan.status !== 'pending' && (plan.reviewComment || plan.totalScore != null) ? (
                    <div className="bg-gray-50 rounded-lg px-2.5 py-2 mb-2.5 text-xs text-gray-600">
                      {plan.totalScore != null ? (
                        <div className="font-medium text-teal-700 mb-0.5">总分：{plan.totalScore}</div>
                      ) : null}
                      {plan.reviewComment ? (
                        <p className="line-clamp-2 m-0">{plan.reviewComment}</p>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenDetail(String(plan.id))}
                      className="px-2.5 py-1.5 bg-teal-500 text-white rounded-lg text-xs font-medium hover:bg-teal-600 cursor-pointer whitespace-nowrap"
                    >
                      查看详情
                    </button>
                    {plan.status === 'pending' ? (
                      <button
                        type="button"
                        onClick={() => setReviewingPlan(plan)}
                        className="px-2.5 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-medium hover:bg-emerald-600 cursor-pointer whitespace-nowrap"
                      >
                        开始审核
                      </button>
                    ) : null}
                    {plan.status === 'rejected' ? (
                      <button
                        type="button"
                        onClick={() => setReviewingPlan(plan)}
                        className="px-2.5 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-medium hover:bg-amber-600 cursor-pointer whitespace-nowrap"
                      >
                        重新审核
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {reviewingPlan ? (
        <ReviewModal
          planName={reviewingPlan.projectName}
          teamName={reviewingPlan.teamName}
          onClose={() => setReviewingPlan(null)}
          onSubmit={handleReviewSubmit}
        />
      ) : null}
    </div>
  );
}
