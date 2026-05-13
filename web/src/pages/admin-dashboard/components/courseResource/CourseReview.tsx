
import { useState } from 'react';
import type { Course, CourseStatus } from './types';
import { COURSE_STATUS_MAP, MODULES } from './types';
import { MOCK_COURSES } from './mockData';

export default function CourseReview() {
  const [courses, setCourses] = useState<Course[]>(MOCK_COURSES);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectTarget, setRejectTarget] = useState<Course | null>(null);
  const [actionSuccess, setActionSuccess] = useState('');

  // Filter courses based on status & search query
  const filtered = courses.filter((c) => {
    const matchStatus = filterStatus === 'all' || c.status === filterStatus;
    const matchSearch =
      !searchQuery ||
      c.name.includes(searchQuery) ||
      c.teacher.includes(searchQuery);
    return matchStatus && matchSearch;
  });

  // Show temporary success toast
  const showSuccess = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(''), 3000);
  };

  // Approve handler with basic error guard
  const handleApprove = (id: number) => {
    try {
      setCourses((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, status: 'approved' as CourseStatus } : c
        )
      );
      setShowDetailModal(false);
      showSuccess('课程已审核通过，已上线供学生选择！');
    } catch (e) {
      console.error('Approve failed:', e);
      showSuccess('审核出现错误，请稍后重试');
    }
  };

  // Reject handler with validation
  const handleReject = () => {
    if (!rejectTarget || !rejectReason.trim()) return;
    try {
      setCourses((prev) =>
        prev.map((c) =>
          c.id === rejectTarget.id
            ? {
                ...c,
                status: 'rejected' as CourseStatus,
                rejectReason: rejectReason.trim(),
              }
            : c
        )
      );
      setShowRejectModal(false);
      setShowDetailModal(false);
      setRejectReason('');
      setRejectTarget(null);
      showSuccess('已驳回课程，驳回原因已通知教师。');
    } catch (e) {
      console.error('Reject failed:', e);
      showSuccess('驳回出现错误，请稍后重试');
    }
  };

  const handleOffline = (id: number) => {
    setCourses((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, status: 'offline' as CourseStatus } : c
      )
    );
    showSuccess('课程已下架。');
  };

  const handleRestore = (id: number) => {
    setCourses((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, status: 'approved' as CourseStatus } : c
      )
    );
    showSuccess('课程已重新上线。');
  };

  return (
    <div className="space-y-5">
      {actionSuccess && (
        <div className="flex items-center gap-3 px-5 py-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm font-medium">
          <i className="ri-checkbox-circle-line text-lg"></i>
          {actionSuccess}
        </div>
      )}

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4">
        {[
          {
            label: '待审核',
            count: courses.filter((c) => c.status === 'pending').length,
            color: 'from-yellow-500 to-orange-500',
            icon: 'ri-time-line',
          },
          {
            label: '已上线',
            count: courses.filter((c) => c.status === 'approved').length,
            color: 'from-green-500 to-emerald-500',
            icon: 'ri-global-line',
          },
          {
            label: '已驳回',
            count: courses.filter((c) => c.status === 'rejected').length,
            color: 'from-red-500 to-rose-500',
            icon: 'ri-close-circle-line',
          },
          {
            label: '课程总数',
            count: courses.length,
            color: 'from-teal-500 to-cyan-500',
            icon: 'ri-book-line',
          },
        ].map((s, i) => (
          <div
            key={i}
            className={`bg-gradient-to-br ${s.color} rounded-2xl p-5 text-white shadow-sm`}
          >
            <div className="w-10 h-10 flex items-center justify-center bg-white/20 rounded-xl mb-3">
              <i className={`${s.icon} text-xl`}></i>
            </div>
            <div className="text-3xl font-bold mb-1">{s.count}</div>
            <div className="text-sm opacity-90">{s.label}</div>
          </div>
        ))}
      </div>

      {/* 筛选栏 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 flex-1 min-w-48 bg-gray-50 rounded-xl px-3 py-2">
          <i className="ri-search-line text-gray-400 text-sm"></i>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索课程名称或教师..."
            className="bg-transparent text-sm outline-none flex-1"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'all', label: '全部' },
            { key: 'pending', label: '待审核' },
            { key: 'approved', label: '已上线' },
            { key: 'rejected', label: '已驳回' },
            { key: 'offline', label: '已下架' },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => setFilterStatus(s.key)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                filterStatus === s.key
                  ? 'bg-teal-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* 课程列表 */}
      <div className="space-y-3">
        {filtered.map((course) => (
          <div
            key={course.id}
            className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 flex items-center justify-center bg-gradient-to-br from-teal-500 to-emerald-500 rounded-xl flex-shrink-0">
                <i className="ri-book-open-line text-2xl text-white"></i>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h4 className="font-bold text-gray-900">{course.name}</h4>
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded-full flex items-center gap-1 ${COURSE_STATUS_MAP[course.status].color}`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${COURSE_STATUS_MAP[course.status].dot}`}
                    ></span>
                    {COURSE_STATUS_MAP[course.status].label}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500 mb-2 flex-wrap">
                  <span>
                    <i className="ri-user-line mr-1"></i>
                    {course.teacher} · {course.department}
                  </span>
                  <span>
                    <i className="ri-time-line mr-1"></i>提交于 {course.submitTime}
                  </span>
                  <span>
                    <i className="ri-team-line mr-1"></i>
                    {course.studentCount} 名学生
                  </span>
                  <span>
                    <i className="ri-layout-grid-line mr-1"></i>
                    {course.modules} 个模块
                  </span>
                  <span>
                    <i className="ri-book-2-line mr-1"></i>
                    {course.knowledgePoints} 个知识点
                  </span>
                </div>
                <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                  {course.description}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {course.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 bg-teal-50 text-teal-600 text-xs rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                {course.rejectReason && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700">
                    <i className="ri-close-circle-line mr-1"></i>
                    <strong>驳回原因：</strong>
                    {course.rejectReason}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2 flex-shrink-0">
                <button
                  onClick={() => {
                    setSelectedCourse(course);
                    setShowDetailModal(true);
                  }}
                  className="px-3 py-1.5 text-xs text-teal-600 hover:bg-teal-50 border border-teal-200 rounded-lg transition-all cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-eye-line mr-1"></i>查看详情
                </button>
                {course.status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleApprove(course.id)}
                      className="px-3 py-1.5 text-xs text-green-600 hover:bg-green-50 border border-green-200 rounded-lg transition-all cursor-pointer whitespace-nowrap"
                    >
                      <i className="ri-check-line mr-1"></i>审核通过
                    </button>
                    <button
                      onClick={() => {
                        setRejectTarget(course);
                        setShowRejectModal(true);
                      }}
                      className="px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 border border-red-200 rounded-lg transition-all cursor-pointer whitespace-nowrap"
                    >
                      <i className="ri-close-line mr-1"></i>驳回
                    </button>
                  </>
                )}
                {course.status === 'approved' && (
                  <button
                    onClick={() => handleOffline(course.id)}
                    className="px-3 py-1.5 text-xs text-orange-600 hover:bg-orange-50 border border-orange-200 rounded-lg transition-all cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-arrow-down-line mr-1"></i>下架
                  </button>
                )}
                {course.status === 'offline' && (
                  <button
                    onClick={() => handleRestore(course.id)}
                    className="px-3 py-1.5 text-xs text-green-600 hover:bg-green-50 border border-green-200 rounded-lg transition-all cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-arrow-up-line mr-1"></i>重新上线
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100">
            <i className="ri-book-line text-5xl mb-3 block"></i>
            暂无符合条件的课程
          </div>
        )}
      </div>

      {/* 课程详情弹窗 */}
      {showDetailModal && selectedCourse && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">
                课程详情审核
              </h3>
              <button
                onClick={() => setShowDetailModal(false)}
                className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-lg cursor-pointer"
              >
                <i className="ri-close-line text-gray-500"></i>
              </button>
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-gradient-to-r from-teal-50 to-emerald-50 rounded-xl border border-teal-100">
                <h4 className="font-bold text-gray-900 text-lg mb-1">
                  {selectedCourse.name}
                </h4>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <span>
                    {selectedCourse.teacher} · {selectedCourse.department}
                  </span>
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded-full ${COURSE_STATUS_MAP[selectedCourse.status].color}`}
                  >
                    {COURSE_STATUS_MAP[selectedCourse.status].label}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    label: '实训模块数',
                    value: `${selectedCourse.modules} 个`,
                    icon: 'ri-layout-grid-line',
                  },
                  {
                    label: '知识点数量',
                    value: `${selectedCourse.knowledgePoints} 个`,
                    icon: 'ri-book-2-line',
                  },
                  {
                    label: '预计学生数',
                    value: `${selectedCourse.studentCount} 人`,
                    icon: 'ri-team-line',
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="p-3 bg-gray-50 rounded-xl text-center"
                  >
                    <i
                      className={`${item.icon} text-teal-500 text-xl mb-1 block`}
                    ></i>
                    <div className="font-bold text-gray-900">{item.value}</div>
                    <div className="text-xs text-gray-500">{item.label}</div>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  课程简介
                </p>
                <p className="text-sm text-gray-600 leading-relaxed p-3 bg-gray-50 rounded-xl">
                  {selectedCourse.description}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  课程标签
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedCourse.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 bg-teal-50 text-teal-600 text-sm rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  实训模块设置
                </p>
                <div className="space-y-2">
                  {MODULES.slice(0, selectedCourse.modules).map((m, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg text-sm"
                    >
                      <i className="ri-checkbox-circle-fill text-teal-500"></i>
                      <span className="text-gray-700">{m}</span>
                    </div>
                  ))}
                </div>
              </div>
              {selectedCourse.rejectReason && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
                  <strong>驳回原因：</strong>
                  {selectedCourse.rejectReason}
                </div>
              )}
            </div>
            {selectedCourse.status === 'pending' && (
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setRejectTarget(selectedCourse);
                    setShowDetailModal(false);
                    setShowRejectModal(true);
                  }}
                  className="flex-1 py-2.5 border border-red-300 text-red-600 font-medium rounded-xl hover:bg-red-50 transition-all cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-close-line mr-2"></i>驳回课程
                </button>
                <button
                  onClick={() => handleApprove(selectedCourse.id)}
                  className="flex-1 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 text-white font-medium rounded-xl hover:shadow-lg transition-all cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-check-line mr-2"></i>审核通过，立即上线
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 驳回原因弹窗 */}
      {showRejectModal && rejectTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                填写驳回原因
              </h3>
              <button
                onClick={() => setShowRejectModal(false)}
                className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-lg cursor-pointer"
              >
                <i className="ri-close-line text-gray-500"></i>
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              驳回课程：<strong>{rejectTarget.name}</strong>
            </p>
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-2">快捷原因：</p>
              <div className="flex flex-wrap gap-2">
                {[
                  '知识点设置不完整',
                  '实训规则不符合要求',
                  '课程描述不清晰',
                  '缺少必要模块',
                ].map((r) => (
                  <button
                    key={r}
                    onClick={() => setRejectReason(r)}
                    className="px-3 py-1 text-xs bg-red-50 text-red-600 rounded-full hover:bg-red-100 transition-all cursor-pointer whitespace-nowrap"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="请填写详细的驳回原因，将通知给教师..."
              rows={4}
              maxLength={500}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
            />
            <p className="text-xs text-gray-400 text-right mb-4">
              {rejectReason.length}/500
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex-1 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-all cursor-pointer whitespace-nowrap"
              >
                取消
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim()}
                className="flex-1 py-2.5 bg-gradient-to-r from-red-500 to-rose-500 text-white font-medium rounded-xl hover:shadow-lg transition-all cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className="ri-close-circle-line mr-2"></i>确认驳回
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
