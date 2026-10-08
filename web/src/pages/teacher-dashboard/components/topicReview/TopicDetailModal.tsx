import type { ReactNode } from 'react';
import AppModalPortal from '../../../../components/AppModalPortal';
import type { TopicSubmission } from './types';

interface TopicDetailModalProps {
  topic: TopicSubmission;
  onClose: () => void;
}

function Field({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return (
    <div className="mb-3">
      <h3 className="text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1.5">
        <i className={`${icon} text-teal-600`} />
        {title}
      </h3>
      <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-100 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-all">
        {children}
      </div>
    </div>
  );
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
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  return (
    <AppModalPortal open onMaskClick={onClose} zIndex={1100}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 rounded-t-xl z-10">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <h2 className="text-base font-semibold text-gray-900">{topic.projectName}</h2>
                {getStatusBadge(topic.status)}
              </div>
              <p className="text-xs text-gray-400">选题详情</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 cursor-pointer"
            >
              <i className="ri-close-line text-lg text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-4">
          <div className="bg-teal-50/60 rounded-lg p-3 mb-3 border border-teal-100">
            <h3 className="text-xs font-semibold text-gray-600 mb-2">团队信息</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <div className="text-[11px] text-gray-400">团队</div>
                <div className="font-medium text-gray-900 text-sm">{topic.teamName}</div>
              </div>
              <div>
                <div className="text-[11px] text-gray-400">队长</div>
                <div className="font-medium text-gray-900 text-sm">{topic.leaderName}</div>
              </div>
              <div>
                <div className="text-[11px] text-gray-400">成员</div>
                <div className="font-medium text-gray-900 text-sm">{topic.memberCount} 人</div>
              </div>
              <div>
                <div className="text-[11px] text-gray-400">提交时间</div>
                <div className="font-medium text-gray-900 text-sm">
                  {new Date(topic.submitTime).toLocaleString('zh-CN')}
                </div>
              </div>
            </div>
          </div>

          <Field icon="ri-compass-line" title="项目方向">
            {topic.direction || '—'}
          </Field>
          <Field icon="ri-file-text-line" title="项目描述">
            {topic.description || '—'}
          </Field>
          <Field icon="ri-user-heart-line" title="目标用户">
            {topic.targetUsers || '—'}
          </Field>
          <Field icon="ri-star-line" title="核心价值">
            {topic.coreValue || '—'}
          </Field>
          <Field icon="ri-question-line" title="核心问题">
            {topic.coreProblem || '—'}
          </Field>
          <Field icon="ri-lightbulb-line" title="解决方案概述">
            {topic.solutionOverview || '—'}
          </Field>
          <Field icon="ri-pie-chart-line" title="市场规模">
            {topic.marketSize || '—'}
          </Field>
          <Field icon="ri-trophy-line" title="竞争优势">
            {topic.competitiveAdvantage || '—'}
          </Field>

          {topic.reviewComment ? (
            <div className="border-t border-gray-100 pt-3">
              <h3 className="text-xs font-semibold text-gray-600 mb-1.5">审核意见</h3>
              <div className="p-2.5 bg-teal-50 rounded-lg border border-teal-100">
                <p className="text-sm text-gray-700 leading-relaxed m-0 whitespace-pre-wrap break-all">
                  {topic.reviewComment}
                </p>
                {topic.reviewTime ? (
                  <div className="text-[11px] text-gray-400 mt-1.5">
                    {new Date(topic.reviewTime).toLocaleString('zh-CN')}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className="sticky bottom-0 bg-gray-50 px-4 py-3 rounded-b-xl border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-2 bg-teal-500 text-white rounded-lg text-sm font-medium hover:bg-teal-600 cursor-pointer"
          >
            关闭
          </button>
        </div>
      </div>
    </AppModalPortal>
  );
}
