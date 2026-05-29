import { useEffect, useMemo, useState } from 'react';
import { fetchAdminOperationLogs, type AdminOperationLogRow } from '../../../../lib/adminOperationLogApi';

type OperationType = 'all' | 'user' | 'class' | 'course' | 'system';
type TimeRange = 'today' | '7days' | '30days';

export default function OperationLog() {
  const [operationType, setOperationType] = useState<OperationType>('all');
  const [timeRange, setTimeRange] = useState<TimeRange>('7days');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [logs, setLogs] = useState<AdminOperationLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<{ total: number; byType: Record<string, number> }>({ total: 0, byType: {} });

  useEffect(() => {
    let cancelled = false;
    void fetchAdminOperationLogs({
      type: operationType,
      timeRange,
      q: searchKeyword.trim(),
      page: currentPage,
      pageSize: itemsPerPage,
    })
      .then((r) => {
        if (cancelled) return;
        setLogs(Array.isArray(r.list) ? r.list : []);
        setTotal(Number(r.total || 0));
        setStats(r.stats || { total: 0, byType: {} });
      })
      .catch(() => {
        if (cancelled) return;
        setLogs([]);
        setTotal(0);
        setStats({ total: 0, byType: {} });
      });
    return () => {
      cancelled = true;
    };
  }, [operationType, timeRange, searchKeyword, currentPage]);

  const totalPages = Math.ceil(total / itemsPerPage);

  // 操作类型配置
  const operationTypes = useMemo(() => {
    const byType = stats.byType || {};
    return [
      { id: 'all' as OperationType, label: '全部操作', count: Number(stats.total || 0) },
      { id: 'class' as OperationType, label: '班级管理', count: Number(byType.class || 0) },
      { id: 'user' as OperationType, label: '用户管理', count: Number(byType.user || 0) },
      { id: 'course' as OperationType, label: '课程资源', count: Number(byType.course || 0) },
      { id: 'system' as OperationType, label: '系统操作', count: Number(byType.system || 0) },
    ];
  }, [stats]);

  return (
    <div className="space-y-6">
      {/* 顶部统计卡片 */}
      <div className="grid grid-cols-5 gap-4">
        {operationTypes.map(type => (
          <button
            key={type.id}
            onClick={() => {
              setOperationType(type.id);
              setCurrentPage(1);
            }}
            className={`p-4 rounded-xl border-2 transition-all text-left ${
              operationType === type.id
                ? 'border-teal-500 bg-teal-50'
                : 'border-gray-100 bg-white hover:border-gray-200'
            }`}
          >
            <div className="text-2xl font-bold text-gray-900 mb-1">{type.count}</div>
            <div className="text-sm text-gray-600">{type.label}</div>
          </button>
        ))}
      </div>

      {/* 筛选和搜索区域 */}
      <div className="bg-white rounded-xl p-5 border border-gray-100">
        <div className="flex items-center gap-4">
          {/* 时间范围筛选 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 whitespace-nowrap">时间范围：</span>
            <div className="flex gap-2">
              {[
                { id: 'today' as TimeRange, label: '今日' },
                { id: '7days' as TimeRange, label: '近7天' },
                { id: '30days' as TimeRange, label: '近30天' }
              ].map(range => (
                <button
                  key={range.id}
                  onClick={() => {
                    setTimeRange(range.id);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors whitespace-nowrap ${
                    timeRange === range.id
                      ? 'bg-teal-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>

          {/* 搜索框 */}
          <div className="flex-1 relative">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
            <input
              type="text"
              placeholder="搜索操作内容、操作人..."
              value={searchKeyword}
              onChange={(e) => {
                setSearchKeyword(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>

          {/* 导出按钮 */}
          <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition-colors whitespace-nowrap flex items-center gap-2">
            <i className="ri-download-line"></i>
            导出日志
          </button>
        </div>
      </div>

      {/* 日志列表 */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  操作类型
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  操作内容
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  操作详情
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  操作人
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  操作时间
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.length > 0 ? (
                logs.map((log, index) => {
                  return (
                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg ${log.bgColor} flex items-center justify-center`}>
                            <i className={`${log.icon} ${log.iconColor} text-sm`}></i>
                          </div>
                          <span className="text-sm text-gray-600">{log.typeLabel}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{log.action}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-600 max-w-md truncate">{log.detail}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{log.operator}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{log.time}</div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <i className="ri-file-list-3-line text-4xl text-gray-300"></i>
                      <div className="text-sm text-gray-500">暂无符合条件的操作日志</div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              共 {total} 条记录，第 {currentPage}/{totalPages} 页
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
              >
                上一页
              </button>
              <div className="flex gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={i}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-sm transition-colors ${
                        currentPage === pageNum
                          ? 'bg-teal-500 text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}