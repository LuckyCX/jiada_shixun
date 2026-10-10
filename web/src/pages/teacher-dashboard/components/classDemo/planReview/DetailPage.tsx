import { useCallback, useEffect, useState } from 'react';
import { message } from 'antd';
import { BusinessPlan, ReviewFormData } from './types';
import ReviewModal from './ReviewModal';
import { getPortalToken } from '../../../../../lib/authApi';
import { BUSINESS_PLAN_RUBRIC_DIMENSIONS } from '../../../../../lib/businessPlanTemplate';
import { sanitizeRichText } from '../../../../../lib/richText';
import {
  fetchTeacherBusinessPlanSubmissions,
  reviewTeacherBusinessPlanSubmission,
} from '../demoPlanApi';

type Props = {
  classId: string;
  submissionId: string;
  onBack: () => void;
};

export default function BusinessPlanDetailPage({ classId, submissionId, onBack }: Props) {
  const [plan, setPlan] = useState<BusinessPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'content' | 'attachments'>('content');
  const [reviewing, setReviewing] = useState(false);
  const token = getPortalToken('teacher') || '';

  const withToken = (url: string) => {
    if (!url) return url;
    if (!token) return url;
    return `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
  };

  const load = useCallback(() => {
    setLoading(true);
    return fetchTeacherBusinessPlanSubmissions(classId, 'all')
      .then((list) => {
        const found = list.find((p) => String(p.id) === String(submissionId)) || null;
        setPlan(found);
      })
      .catch((e) => {
        setPlan(null);
        message.error(e instanceof Error ? e.message : '加载失败');
      })
      .finally(() => setLoading(false));
  }, [classId, submissionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleReviewSubmit = (data: ReviewFormData) => {
    if (!plan) return;
    void reviewTeacherBusinessPlanSubmission(classId, plan.id, data)
      .then(() => {
        setReviewing(false);
        message.success(data.status === 'approved' ? '审核通过，该团队实训流程已结束' : '已退回，团队可重新提交');
        void load();
      })
      .catch((e) => {
        message.error(e instanceof Error ? e.message : '审核失败');
      });
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-amber-100 text-amber-700',
      approved: 'bg-emerald-100 text-emerald-700',
      rejected: 'bg-rose-100 text-rose-700',
    };
    const labels = {
      pending: '待审核',
      approved: '已通过',
      rejected: '已退回',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  if (loading) {
    return <div className="text-sm text-gray-400 text-center py-16">加载计划书详情…</div>;
  }

  if (!plan) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-teal-600 cursor-pointer"
        >
          <i className="ri-arrow-left-s-line" />
          返回列表
        </button>
        <div className="bg-white rounded-xl border border-dashed border-gray-200 py-12 text-center text-sm text-gray-500">
          未找到该提交记录
        </div>
      </div>
    );
  }

  const sections =
    plan.sections && plan.sections.length
      ? plan.sections.map((s) => ({ key: s.key, label: s.title, content: s.content }))
      : [
          { key: 'executiveSummary', label: '执行摘要', content: plan.executiveSummary },
          { key: 'marketAnalysis', label: '市场分析', content: plan.marketAnalysis },
          { key: 'productService', label: '产品与服务', content: plan.productService },
          { key: 'marketingStrategy', label: '营销策略', content: plan.marketingStrategy },
          { key: 'operationPlan', label: '运营计划', content: plan.operationPlan },
          { key: 'financialPlan', label: '财务计划', content: plan.financialPlan },
          { key: 'teamIntroduction', label: '团队介绍', content: plan.teamIntroduction },
          { key: 'riskAnalysis', label: '风险分析', content: plan.riskAnalysis },
        ];

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-gray-100 px-3 py-2.5 md:px-4 md:py-3">
        <div className="flex items-start gap-2 md:gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center justify-center w-8 h-8 shrink-0 text-gray-600 hover:text-teal-600 cursor-pointer rounded-lg hover:bg-gray-50"
            aria-label="返回列表"
          >
            <i className="ri-arrow-left-line text-lg" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm md:text-base font-semibold text-gray-900 truncate">{plan.projectName}</h2>
              {getStatusBadge(plan.status)}
              {plan.totalScore != null ? (
                <span className="text-xs text-indigo-600 font-medium">总分 {plan.totalScore}</span>
              ) : null}
            </div>
            <div className="text-[11px] md:text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
              <span>{plan.teamName}</span>
              <span>提交于 {plan.submitTime}</span>
            </div>
          </div>
          {(plan.status === 'pending' || plan.status === 'rejected') && (
            <button
              type="button"
              onClick={() => setReviewing(true)}
              className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg bg-teal-500 text-white hover:bg-teal-600 cursor-pointer whitespace-nowrap"
            >
              {plan.status === 'pending' ? '开始审核' : '重新审核'}
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="border-b border-gray-100 px-3 md:px-4 flex gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('content')}
            className={`py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === 'content'
                ? 'border-teal-500 text-teal-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            计划书内容
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('attachments')}
            className={`py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === 'attachments'
                ? 'border-teal-500 text-teal-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            附件资料
          </button>
        </div>

        <div className="p-3 md:p-4">
          {activeTab === 'content' && (
            <div className="space-y-3">
              {sections.map((section) => {
                const html = sanitizeRichText(String(section.content || ''));
                return (
                  <div key={section.key} className="bg-gray-50 rounded-lg p-3">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-1.5">
                      <span className="w-0.5 h-3.5 bg-teal-500 rounded-full" />
                      {section.label}
                    </h3>
                    {html ? (
                      <div
                        className="prose prose-sm max-w-none text-sm text-gray-700 leading-relaxed overflow-x-hidden break-words [&_*]:max-w-full [&_img]:h-auto"
                        dangerouslySetInnerHTML={{ __html: html }}
                      />
                    ) : (
                      <p className="text-gray-400 text-xs m-0">（本节暂无内容）</p>
                    )}
                  </div>
                );
              })}

              {plan.status !== 'pending' && (
                <div className="bg-teal-50/60 rounded-lg p-3 border border-teal-100">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">审核意见</h3>
                  {plan.totalScore != null && plan.scores ? (
                    <div className="bg-white rounded-lg p-2.5 mb-2">
                      <div className="text-xs font-semibold text-gray-900 mb-1.5">评分明细（总分 {plan.totalScore}）</div>
                      <div className="grid sm:grid-cols-2 gap-1.5">
                        {BUSINESS_PLAN_RUBRIC_DIMENSIONS.map((d) => (
                          <div
                            key={d.key}
                            className="text-[11px] text-gray-600 flex justify-between gap-2 bg-gray-50 rounded px-2 py-1.5"
                          >
                            <span>{d.title}</span>
                            <span className="font-semibold text-gray-900">
                              {plan.scores?.[d.key] ?? '—'}/{d.max}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {plan.reviewComment ? (
                    <div className="bg-white rounded-lg p-2.5 mb-2">
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap m-0">
                        {plan.reviewComment}
                      </p>
                    </div>
                  ) : null}
                  <div className="flex items-center gap-3 text-[11px] text-gray-500">
                    <span>审核人：{plan.reviewer || '—'}</span>
                    <span>审核时间：{plan.reviewTime || '—'}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'attachments' && (
            <div className="space-y-2.5">
              {plan.pptUrl ? (
                <div className="bg-orange-50 border border-orange-100 rounded-lg p-3 flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center text-white shrink-0">
                    <i className="ri-file-ppt-2-line text-lg" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">商业计划书演示文稿</div>
                    <div className="text-xs text-gray-500">PPT</div>
                  </div>
                  <a
                    href={withToken(plan.pptUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 whitespace-nowrap"
                  >
                    下载
                  </a>
                </div>
              ) : null}

              {(plan.attachments || []).map((file, index) => (
                <div
                  key={index}
                  className="bg-white border border-gray-100 rounded-lg p-3 flex items-center gap-3"
                >
                  <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                    <i className="ri-file-line text-base text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{file.name}</div>
                    <div className="text-xs text-gray-500">{file.size}</div>
                  </div>
                  <a
                    href={withToken(file.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-teal-500 text-white hover:bg-teal-600 whitespace-nowrap"
                  >
                    下载
                  </a>
                </div>
              ))}

              {!plan.pptUrl && !(plan.attachments || []).length ? (
                <div className="text-center py-10 text-sm text-gray-400">暂无附件</div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {reviewing ? (
        <ReviewModal
          planName={plan.projectName}
          teamName={plan.teamName}
          onClose={() => setReviewing(false)}
          onSubmit={handleReviewSubmit}
        />
      ) : null}
    </div>
  );
}
