import { useCallback, useEffect, useState } from 'react';
import { message } from 'antd';
import ReviewModal from './ReviewModal';
import TopicDetailModal from './TopicDetailModal';
import type { TopicSubmission } from './types';
import type { TeacherPersonalClassRow } from '../../teacherPortalApi';
import {
  fetchTeacherIdeationProjectTopics,
  reviewTeacherIdeationProjectTopic,
} from '../../../../lib/studentIdeationApi';

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

  const filteredSubmissions = submissions.filter(item => {
    const matchStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchSearch =
      searchQuery === '' ||
      item.teamName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.projectName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchSearch;
  });

  const stats = {
    total: submissions.length,
    pending: submissions.filter(s => s.status === 'pending').length,
    approved: submissions.filter(s => s.status === 'approved').length,
    rejected: submissions.filter(s => s.status === 'rejected').length,
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
      <span className={`px-3 py-1 rounded-full text-sm font-medium border ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">选题审核</h1>
            <p className="text-purple-100 text-sm">当前班级：{personalClass.name}，审核通过后团队可进入下一阶段</p>
          </div>
          <div className="flex gap-4">
            <div className="bg-white/20 backdrop-blur-sm rounded-xl px-6 py-3 text-center">
              <div className="text-3xl font-bold">{stats.total}</div>
              <div className="text-xs text-purple-100 mt-1">总提交数</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-xl px-6 py-3 text-center">
              <div className="text-3xl font-bold text-amber-200">{stats.pending}</div>
              <div className="text-xs text-purple-100 mt-1">待审核</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-xl px-6 py-3 text-center">
              <div className="text-3xl font-bold text-emerald-200">{stats.approved}</div>
              <div className="text-xs text-purple-100 mt-1">已通过</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-xl px-6 py-3 text-center">
              <div className="text-3xl font-bold text-rose-200">{stats.rejected}</div>
              <div className="text-xs text-purple-100 mt-1">已退回</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-8 py-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                <input
                  type="text"
                  placeholder="搜索团队名称或项目名称..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-2">
              {[
                { value: 'all', label: '全部', icon: 'ri-list-check' },
                { value: 'pending', label: '待审核', icon: 'ri-time-line' },
                { value: 'approved', label: '已通过', icon: 'ri-checkbox-circle-line' },
                { value: 'rejected', label: '已退回', icon: 'ri-close-circle-line' },
              ].map(filter => (
                <button
                  key={filter.value}
                  onClick={() => setStatusFilter(filter.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    statusFilter === filter.value
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <i className={`${filter.icon} mr-1`}></i>
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Submissions List */}
        <div className="grid gap-4">
          {loading ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <p className="text-gray-500">加载中...</p>
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <i className="ri-inbox-line text-6xl text-gray-300 mb-4"></i>
              <p className="text-gray-500">暂无符合条件的选题提交</p>
            </div>
          ) : (
            filteredSubmissions.map(submission => (
              <div
                key={submission.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-lg font-bold text-gray-900">{submission.projectName}</h3>
                      {getStatusBadge(submission.status)}
                      <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                        {submission.direction}
                      </span>
                    </div>
                    <div className="flex items-center gap-6 text-sm text-gray-600 mb-3">
                      <div className="flex items-center gap-2">
                        <i className="ri-team-line text-purple-600"></i>
                        <span className="font-medium">{submission.teamName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <i className="ri-user-line text-gray-400"></i>
                        <span>队长：{submission.leaderName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <i className="ri-group-line text-gray-400"></i>
                        <span>{submission.memberCount} 人</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <i className="ri-calendar-line text-gray-400"></i>
                        <span>提交时间：{new Date(submission.submitTime).toLocaleString('zh-CN')}</span>
                      </div>
                    </div>
                    <p className="text-gray-700 text-sm leading-relaxed line-clamp-2">{submission.description}</p>
                    {submission.reviewComment && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-start gap-2">
                          <i className="ri-message-3-line text-purple-600 mt-0.5"></i>
                          <div className="flex-1">
                            <div className="text-xs text-gray-500 mb-1">审核意见</div>
                            <p className="text-sm text-gray-700">{submission.reviewComment}</p>
                            {submission.reviewTime && (
                              <div className="text-xs text-gray-400 mt-1">
                                {new Date(submission.reviewTime).toLocaleString('zh-CN')}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => {
                        setSelectedTopic(submission);
                        setDetailModalOpen(true);
                      }}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors whitespace-nowrap"
                    >
                      <i className="ri-eye-line mr-1"></i>
                      查看详情
                    </button>
                    {submission.status === 'pending' && (
                      <button
                        onClick={() => {
                          setSelectedTopic(submission);
                          setReviewModalOpen(true);
                        }}
                        className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg text-sm font-medium hover:shadow-lg transition-all whitespace-nowrap"
                      >
                        <i className="ri-check-line mr-1"></i>
                        开始审核
                      </button>
                    )}
                    {submission.status === 'rejected' && (
                      <button
                        onClick={() => {
                          setSelectedTopic(submission);
                          setReviewModalOpen(true);
                        }}
                        className="px-4 py-2 bg-amber-100 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-200 transition-colors whitespace-nowrap"
                      >
                        <i className="ri-refresh-line mr-1"></i>
                        重新审核
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modals */}
      {selectedTopic && reviewModalOpen && (
        <ReviewModal
          topic={selectedTopic}
          onClose={() => {
            setReviewModalOpen(false);
            setSelectedTopic(null);
          }}
          onSubmit={handleReview}
        />
      )}

      {selectedTopic && detailModalOpen && (
        <TopicDetailModal
          topic={selectedTopic}
          onClose={() => {
            setDetailModalOpen(false);
            setSelectedTopic(null);
          }}
        />
      )}
    </div>
  );
}