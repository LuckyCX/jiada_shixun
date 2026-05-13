import { useState } from 'react';
import { operationLogs } from './mockData';

type OperationType = 'all' | 'user' | 'class' | 'course' | 'system';
type TimeRange = 'today' | '7days' | '30days';

export default function OperationLog() {
  const [operationType, setOperationType] = useState<OperationType>('all');
  const [timeRange, setTimeRange] = useState<TimeRange>('7days');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // 筛选日志
  const filteredLogs = operationLogs.filter(log => {
    // 按操作类型筛选
    if (operationType !== 'all' && log.type !== operationType) return false;
    
    // 按时间范围筛选
    const logDate = new Date(log.timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (timeRange === 'today' && diffDays > 0) return false;
    if (timeRange === '7days' && diffDays > 7) return false;
    if (timeRange === '30days' && diffDays > 30) return false;
    
    // 按关键词搜索
    if (searchKeyword) {
      const keyword = searchKeyword.toLowerCase();
      return (
        log.action.toLowerCase().includes(keyword) ||
        log.operator.toLowerCase().includes(keyword) ||
        log.detail.toLowerCase().includes(keyword)
      );
    }
    
    return true;
  });

  // 分页
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedLogs = filteredLogs.slice(startIndex, startIndex + itemsPerPage);

  // 操作类型配置
  const operationTypes = [
    { id: 'all' as OperationType, label: '全部操作', count: operationLogs.length },
    { id: 'user' as OperationType, label: '用户管理', count: operationLogs.filter(l => l.type === 'user').length },
    { id: 'class' as OperationType, label: '班级管理', count: operationLogs.filter(l => l.type === 'class').length },
    { id: 'course' as OperationType, label: '课程资源', count: operationLogs.filter(l => l.type === 'course').length },
    { id: 'system' as OperationType, label: '系统操作', count: operationLogs.filter(l => l.type === 'system').length }
  ];

  const getOperationIcon = (type: string) => {
    switch (type) {
      case 'user': return { icon: 'ri-user-line', color: 'text-blue-500', bg: 'bg-blue-50' };
      case 'class': return { icon: 'ri-team-line', color: 'text-purple-500', bg: 'bg-purple-50' };
      case 'course': return { icon: 'ri-book-2-line', color: 'text-orange-500', bg: 'bg-orange-50' };
      case 'system': return { icon: 'ri-settings-3-line', color: 'text-gray-500', bg: 'bg-gray-50' };
      default: return { icon: 'ri-information-line', color: 'text-teal-500', bg: 'bg-teal-50' };
    }
  };

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
              {paginatedLogs.length > 0 ? (
                paginatedLogs.map((log, index) => {
                  const iconConfig = getOperationIcon(log.type);
                  return (
                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg ${iconConfig.bg} flex items-center justify-center`}>
                            <i className={`${iconConfig.icon} ${iconConfig.color} text-sm`}></i>
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
              共 {filteredLogs.length} 条记录，第 {currentPage}/{totalPages} 页
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