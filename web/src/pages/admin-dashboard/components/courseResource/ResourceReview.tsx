
import { useState } from 'react';
import type { PendingResource, ResourceStatus } from './types';
import { RESOURCE_STATUS_MAP } from './types';
import { MOCK_PENDING_RESOURCES } from './mockData';

export default function ResourceReview() {
  const [resources, setResources] = useState<PendingResource[]>(MOCK_PENDING_RESOURCES);
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('pending');
  const [filterRole, setFilterRole] = useState('all');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<PendingResource | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const typeIconMap: Record<string, { icon: string; color: string }> = {
    knowledge: { icon: 'ri-book-2-line', color: 'from-teal-500 to-emerald-500' },
    case: { icon: 'ri-folder-line', color: 'from-orange-500 to-amber-500' },
  };

  const filtered = resources.filter((r) => {
    const matchType = filterType === 'all' || r.type === filterType;
    const matchStatus = filterStatus === 'all' || r.status === filterStatus;
    const matchRole = filterRole === 'all' || r.uploaderRole === filterRole;
    return matchType && matchStatus && matchRole;
  });

  const showSuccess = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(''), 3000);
  };

  const handleApprove = (id: number) => {
    setResources((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, status: 'approved' as ResourceStatus } : r
      )
    );
    showSuccess('资源已审核通过，已纳入公共资源库！');
  };

  const handleReject = () => {
    if (!rejectTarget || !rejectReason.trim()) return;
    setResources((prev) =>
      prev.map((r) =>
        r.id === rejectTarget.id
          ? { ...r, status: 'rejected' as ResourceStatus, rejectReason }
          : r
      )
    );
    setShowRejectModal(false);
    setRejectReason('');
    setRejectTarget(null);
    showSuccess('资源已驳回，驳回原因已通知上传者。');
  };

  const pendingCount = resources.filter((r) => r.status === 'pending').length;

  return (
    <div className="space-y-5">
      {actionSuccess && (
        <div className="flex items-center gap-3 px-5 py-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm font-medium">
          <i className="ri-checkbox-circle-line text-lg"></i>
          {actionSuccess}
        </div>
      )}

      {/* 统计 */}
      <div className="grid grid-cols-4 gap-4">
        {[
          {
            label: '待审核',
            count: resources.filter((r) => r.status === 'pending').length,
            color: 'from-yellow-500 to-orange-500',
            icon: 'ri-time-line',
          },
          {
            label: '已通过',
            count: resources.filter((r) => r.status === 'approved').length,
            color: 'from-green-500 to-emerald-500',
            icon: 'ri-checkbox-circle-line',
          },
          {
            label: '已驳回',
            count: resources.filter((r) => r.status === 'rejected').length,
            color: 'from-red-500 to-rose-500',
            icon: 'ri-close-circle-line',
          },
          {
            label: '资源总数',
            count: resources.length,
            color: 'from-teal-500 to-cyan-500',
            icon: 'ri-archive-line',
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

      {pendingCount > 0 && (
        <div className="flex items-center gap-3 px-5 py-3 bg-yellow-50 border border-yellow-200 rounded-xl text-yellow-800 text-sm">
          <i className="ri-alert-line text-lg text-yellow-500"></i>
          <span>
            当前有 <strong>{pendingCount}</strong> 条资源待审核，请及时处理，防止违规内容上线。
          </span>
        </div>
      )}

      {/* 筛选栏 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-wrap gap-3 items-center">
        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'all', label: '全部状态' },
            { key: 'pending', label: '待审核' },
            { key: 'approved', label: '已通过' },
            { key: 'rejected', label: '已驳回' },
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
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
        >
          <option value="all">全部类型</option>
          <option value="knowledge">知识点</option>
          <option value="case">案例</option>
        </select>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
        >
          <option value="all">全部上传者</option>
          <option value="teacher">教师上传</option>
          <option value="student">学生上传</option>
        </select>
      </div>

      {/* 资源列表 */}
      <div className="space-y-3">
        {filtered.map((resource) => {
          const iconStyle = typeIconMap[resource.type];
          return (
            <div
              key={resource.id}
              className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all"
            >
              <div className="flex items-start gap-4">
                <div
                  className={`w-12 h-12 flex items-center justify-center bg-gradient-to-br ${iconStyle.color} rounded-xl flex-shrink-0`}
                >
                  <i className={`${iconStyle.icon} text-2xl text-white`}></i>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h4 className="font-bold text-gray-900">{resource.title}</h4>
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded-full ${RESOURCE_STATUS_MAP[resource.status].color}`}
                    >
                      {RESOURCE_STATUS_MAP[resource.status].label}
                    </span>
                    <span className="px-2 py-0.5 text-xs bg-teal-50 text-teal-600 rounded-full">
                      {resource.type === 'knowledge' ? '知识点' : '案例'}
                    </span>
                    {resource.resourceType && (
                      <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                        {resource.resourceType === 'video'
                          ? '视频'
                          : resource.resourceType === 'document'
                          ? '文档'
                          : '图文'}
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full ${
                        resource.uploaderRole === 'teacher'
                          ? 'bg-purple-100 text-purple-600'
                          : 'bg-green-100 text-green-600'
                      }`}
                    >
                      {resource.uploaderRole === 'teacher' ? '教师上传' : '学生上传'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 mb-2 flex-wrap">
                    <span>
                      <i className="ri-user-line mr-1"></i>
                      {resource.uploader}
                    </span>
                    <span>
                      <i className="ri-time-line mr-1"></i>
                      {resource.uploadTime}
                    </span>
                    <span>
                      <i className="ri-layout-grid-line mr-1"></i>
                      {resource.module}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">{resource.description}</p>
                  {resource.rejectReason && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700">
                      <i className="ri-close-circle-line mr-1"></i>
                      <strong>驳回原因：</strong>
                      {resource.rejectReason}
                    </div>
                  )}
                </div>
                {resource.status === 'pending' && (
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleApprove(resource.id)}
                      className="px-3 py-1.5 text-xs text-green-600 hover:bg-green-50 border border-green-200 rounded-lg transition-all cursor-pointer whitespace-nowrap"
                    >
                      <i className="ri-check-line mr-1"></i>
                      通过
                    </button>
                    <button
                      onClick={() => {
                        setRejectTarget(resource);
                        setShowRejectModal(true);
                      }}
                      className="px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 border border-red-200 rounded-lg transition-all cursor-pointer whitespace-nowrap"
                    >
                      <i className="ri-close-line mr-1"></i>
                      驳回
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100">
            <i className="ri-shield-check-line text-5xl mb-3 block"></i>
            暂无待审核资源
          </div>
        )}
      </div>

      {/* 驳回弹窗 */}
      {showRejectModal && rejectTarget && (
        <div className={`fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4`}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">填写驳回原因</h3>
              <button
                onClick={() => setShowRejectModal(false)}
                className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-lg cursor-pointer"
              >
                <i className="ri-close-line text-gray-500"></i>
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              驳回资源：<strong>{rejectTarget.title}</strong>
            </p>
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-2">快捷原因：</p>
              <div className="flex flex-wrap gap-2">
                {[
                  '内容与课程无关',
                  '涉嫌版权侵权',
                  '内容质量不达标',
                  '涉嫌商业广告',
                  '内容存在错误',
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
              placeholder="请填写详细的驳回原因..."
              rows={3}
              maxLength={500}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
            />
            <p className="text-xs text-gray-400 text-right mb-4">{rejectReason.length}/500</p>
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
