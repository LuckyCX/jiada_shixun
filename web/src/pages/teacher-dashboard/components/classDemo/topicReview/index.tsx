import { useCallback, useEffect, useState } from 'react';
import { message } from 'antd';
import ReviewModal from './ReviewModal';
import TopicDetailModal from './TopicDetailModal';
import type { TopicSubmission } from './types';
import type { TeacherPersonalClassRow } from '../../../teacherPortalApi';
import {
  fetchTeacherIdeationProjectTopics,
  reviewTeacherIdeationProjectTopic,
} from '../demoIdeationApi';

type TopicReviewProps = {
  personalClass: TeacherPersonalClassRow;
};

export default function TopicReview({ personalClass }: TopicReviewProps) {
  const classId = personalClass.id;
  const [submissions, setSubmissions] = useState<TopicSubmission[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<TopicSubmission | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const loadTopics = useCallback(() => {
    setLoading(true);
    return fetchTeacherIdeationProjectTopics(classId)
      .then((res) => setSubmissions(res.topics || []))
      .catch((e) => {
        setSubmissions([]);
        message.error(e instanceof Error ? e.message : '加载选题提交失败');
      })
      .finally(() => setLoading(false));
  }, [classId]);

  useEffect(() => {
    void loadTopics();
  }, [loadTopics]);

  const handleReview = async (topicId: string, status: 'approved' | 'rejected', comment: string) => {
    try {
      const topic = await reviewTeacherIdeationProjectTopic(classId, topicId, { status, comment });
      setSubmissions((prev) => prev.map((item) => (item.id === topicId ? topic : item)));
      setReviewModalOpen(false);
      setSelectedTopic(null);
      message.success(status === 'approved' ? '选题已通过' : '选题已退回');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '提交审核失败');
    }
  };

  const filteredSubmissions = submissions.filter((item) => {
    const matchStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchSearch =
      searchQuery === '' ||
      item.teamName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.projectName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchSearch;
  });

  const stats = {
    total: submissions.length,
    pending: submissions.filter((s) => s.status === 'pending').length,
    approved: submissions.filter((s) => s.status === 'approved').length,
    rejected: submissions.filter((s) => s.status === 'rejected').length,
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
              placeholder="搜索团队或项目…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {[
              { value: 'all', label: '全部' },
              { value: 'pending', label: '待审核' },
              { value: 'approved', label: '已通过' },
              { value: 'rejected', label: '已退回' },
            ].map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setStatusFilter(filter.value)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap cursor-pointer ${
                  statusFilter === filter.value
                    ? 'bg-teal-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {filter.label}
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
        ) : filteredSubmissions.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">
            暂无符合条件的选题提交
          </div>
        ) : (
          filteredSubmissions.map((submission) => (
            <div
              key={submission.id}
              className="bg-white rounded-xl border border-gray-100 p-3 md:p-4 hover:border-teal-200 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <h3 className="text-sm md:text-base font-semibold text-gray-900">
                      {submission.projectName}
                    </h3>
                    {getStatusBadge(submission.status)}
                    {submission.direction ? (
                      <span className="px-2 py-0.5 bg-teal-50 text-teal-700 rounded-full text-[11px] font-medium">
                        {submission.direction}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500 mb-2">
                    <span>{submission.teamName}</span>
                    <span>队长：{submission.leaderName}</span>
                    <span>{submission.memberCount} 人</span>
                    <span>
                      提交于 {new Date(submission.submitTime).toLocaleString('zh-CN')}
                    </span>
                  </div>
                  <p className="text-xs md:text-sm text-gray-600 line-clamp-2">{submission.description}</p>
                  {submission.reviewComment ? (
                    <div className="mt-2 px-2.5 py-2 bg-gray-50 rounded-lg text-xs text-gray-600">
                      <div className="text-[11px] text-gray-400 mb-0.5">审核意见</div>
                      <p className="m-0 line-clamp-2">{submission.reviewComment}</p>
                    </div>
                  ) : null}
                </div>
                <div className="flex sm:flex-col gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTopic(submission);
                      setDetailModalOpen(true);
                    }}
                    className="px-2.5 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200 cursor-pointer whitespace-nowrap"
                  >
                    查看详情
                  </button>
                  {submission.status === 'pending' ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTopic(submission);
                        setReviewModalOpen(true);
                      }}
                      className="px-2.5 py-1.5 bg-teal-500 text-white rounded-lg text-xs font-medium hover:bg-teal-600 cursor-pointer whitespace-nowrap"
                    >
                      开始审核
                    </button>
                  ) : null}
                  {submission.status === 'rejected' ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTopic(submission);
                        setReviewModalOpen(true);
                      }}
                      className="px-2.5 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-200 cursor-pointer whitespace-nowrap"
                    >
                      重新审核
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {selectedTopic && reviewModalOpen ? (
        <ReviewModal
          topic={selectedTopic}
          onClose={() => {
            setReviewModalOpen(false);
            setSelectedTopic(null);
          }}
          onSubmit={handleReview}
        />
      ) : null}

      {selectedTopic && detailModalOpen ? (
        <TopicDetailModal
          topic={selectedTopic}
          onClose={() => {
            setDetailModalOpen(false);
            setSelectedTopic(null);
          }}
        />
      ) : null}
    </div>
  );
}
