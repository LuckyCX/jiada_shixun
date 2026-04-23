import { useState } from 'react';
import { Task, TaskFormData } from './types';
import { mockTasks, moduleOptions } from './mockData';
import CreateTaskModal from './CreateTaskModal';

export default function TaskManagement() {
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'draft' | 'expired'>('all');
  const [filterModule, setFilterModule] = useState<string>('all');
  const [searchText, setSearchText] = useState('');
  const [successToast, setSuccessToast] = useState(false);

  const handleCreateTask = (data: TaskFormData, isDraft: boolean) => {
    const newTask: Task = {
      id: tasks.length + 1,
      title: data.title,
      description: data.description,
      module: data.module,
      deadline: data.deadline,
      attachments: data.attachments.map((file) => ({
        name: file.name,
        url: '#',
        size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      })),
      scope: data.scope,
      targetTeams: data.targetTeams,
      status: isDraft ? 'draft' : 'published',
      publishedAt: isDraft ? '' : new Date().toISOString().slice(0, 10),
      publishedBy: '李教授',
      submissionCount: 0,
      totalTargets: data.scope === 'all' ? 6 : data.targetTeams.length,
    };

    setTasks([newTask, ...tasks]);
    setShowCreateModal(false);
    setSuccessToast(true);
    setTimeout(() => setSuccessToast(false), 3000);
  };

  const handleDeleteTask = (id: number) => {
    if (window.confirm('确定要删除这个任务吗？')) {
      setTasks(tasks.filter((t) => t.id !== id));
    }
  };

  const handlePublishDraft = (id: number) => {
    setTasks(
      tasks.map((t) =>
        t.id === id
          ? {
              ...t,
              status: 'published' as const,
              publishedAt: new Date().toISOString().slice(0, 10),
            }
          : t
      )
    );
    setSuccessToast(true);
    setTimeout(() => setSuccessToast(false), 3000);
  };

  const filteredTasks = tasks.filter((task) => {
    if (filterStatus !== 'all' && task.status !== filterStatus) return false;
    if (filterModule !== 'all' && task.module !== filterModule) return false;
    if (searchText.trim()) {
      const keyword = searchText.toLowerCase();
      return (
        task.title.toLowerCase().includes(keyword) ||
        task.description.toLowerCase().includes(keyword)
      );
    }
    return true;
  });

  const stats = {
    total: tasks.length,
    published: tasks.filter((t) => t.status === 'published').length,
    draft: tasks.filter((t) => t.status === 'draft').length,
    expired: tasks.filter((t) => t.status === 'expired').length,
  };

  return (
    <div>
      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          {
            label: '任务总数',
            value: stats.total,
            icon: 'ri-file-list-3-line',
            color: 'from-teal-500 to-cyan-500',
            sub: '全部任务',
          },
          {
            label: '已发布',
            value: stats.published,
            icon: 'ri-send-plane-line',
            color: 'from-green-500 to-emerald-500',
            sub: '进行中',
          },
          {
            label: '草稿箱',
            value: stats.draft,
            icon: 'ri-draft-line',
            color: 'from-amber-500 to-orange-500',
            sub: '待发布',
          },
          {
            label: '已过期',
            value: stats.expired,
            icon: 'ri-time-line',
            color: 'from-gray-400 to-gray-500',
            sub: '已截止',
          },
        ].map((card, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <div
                className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center`}
              >
                <i className={`${card.icon} text-white text-base`}></i>
              </div>
              <span className="text-3xl font-bold text-gray-900">{card.value}</span>
            </div>
            <div className="text-sm font-medium text-gray-700">{card.label}</div>
            <div className="text-xs text-gray-400 mt-0.5">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* 筛选和操作栏 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-1">
            {/* 搜索框 */}
            <div className="relative flex-1 min-w-64">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="搜索任务标题或描述..."
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50"
              />
            </div>

            {/* 状态筛选 */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
              {[
                { key: 'all' as const, label: '全部' },
                { key: 'published' as const, label: '已发布' },
                { key: 'draft' as const, label: '草稿' },
                { key: 'expired' as const, label: '已过期' },
              ].map((status) => (
                <button
                  key={status.key}
                  onClick={() => setFilterStatus(status.key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                    filterStatus === status.key
                      ? 'bg-white text-teal-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {status.label}
                </button>
              ))}
            </div>

            {/* 模块筛选 */}
            <select
              value={filterModule}
              onChange={(e) => setFilterModule(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50 cursor-pointer"
            >
              <option value="all">全部模块</option>
              {moduleOptions.map((module) => (
                <option key={module} value={module}>
                  {module}
                </option>
              ))}
            </select>
          </div>

          {/* 发布按钮 */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-sm font-medium rounded-xl hover:shadow-lg transition-all whitespace-nowrap cursor-pointer flex items-center gap-2"
          >
            <i className="ri-add-line text-base"></i>
            发布新任务
          </button>
        </div>

        {/* 结果统计 */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-3">
          <span className="text-xs text-gray-500">
            共找到 <strong className="text-gray-900">{filteredTasks.length}</strong> 个任务
          </span>
          {(filterStatus !== 'all' || filterModule !== 'all' || searchText.trim()) && (
            <button
              onClick={() => {
                setFilterStatus('all');
                setFilterModule('all');
                setSearchText('');
              }}
              className="text-xs text-red-500 hover:text-red-600 font-medium cursor-pointer"
            >
              <i className="ri-close-circle-line mr-1"></i>清除筛选
            </button>
          )}
        </div>
      </div>

      {/* 任务列表 */}
      {filteredTasks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-2xl flex items-center justify-center">
            <i className="ri-file-list-3-line text-3xl text-gray-400"></i>
          </div>
          <p className="text-gray-500 text-sm mb-3">暂无任务</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-teal-500 text-white text-sm rounded-xl hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap"
          >
            发布第一个任务
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden"
            >
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-base font-bold text-gray-900">{task.title}</h3>
                      <span
                        className={`px-2.5 py-0.5 text-xs font-medium rounded-full whitespace-nowrap ${
                          task.status === 'published'
                            ? 'bg-green-100 text-green-700'
                            : task.status === 'draft'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {task.status === 'published'
                          ? '✓ 已发布'
                          : task.status === 'draft'
                          ? '○ 草稿'
                          : '⏱ 已过期'}
                      </span>
                      <span className="px-2.5 py-0.5 bg-teal-50 text-teal-700 text-xs font-medium rounded-full whitespace-nowrap">
                        {task.module}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed line-clamp-2">
                      {task.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                    {task.status === 'draft' && (
                      <button
                        onClick={() => handlePublishDraft(task.id)}
                        className="px-3 py-1.5 bg-teal-500 text-white text-xs font-medium rounded-lg hover:bg-teal-600 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <i className="ri-send-plane-line mr-1"></i>发布
                      </button>
                    )}
                    <button className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer">
                      <i className="ri-edit-line mr-1"></i>编辑
                    </button>
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="px-3 py-1.5 bg-red-50 text-red-600 text-xs font-medium rounded-lg hover:bg-red-100 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <i className="ri-delete-bin-line mr-1"></i>删除
                    </button>
                  </div>
                </div>

                {/* 任务详情 */}
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <i className="ri-calendar-line text-gray-400 text-sm"></i>
                    <div>
                      <p className="text-xs text-gray-400">截止时间</p>
                      <p className="text-sm font-medium text-gray-900">{task.deadline}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <i className="ri-group-line text-gray-400 text-sm"></i>
                    <div>
                      <p className="text-xs text-gray-400">发布范围</p>
                      <p className="text-sm font-medium text-gray-900">
                        {task.scope === 'all' ? '全班' : `${task.targetTeams.length} 个团队`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <i className="ri-file-check-line text-gray-400 text-sm"></i>
                    <div>
                      <p className="text-xs text-gray-400">提交情况</p>
                      <p className="text-sm font-medium text-gray-900">
                        {task.submissionCount} / {task.totalTargets}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <i className="ri-user-line text-gray-400 text-sm"></i>
                    <div>
                      <p className="text-xs text-gray-400">发布人</p>
                      <p className="text-sm font-medium text-gray-900">{task.publishedBy}</p>
                    </div>
                  </div>
                </div>

                {/* 附件列表 */}
                {task.attachments.length > 0 && (
                  <div className="pt-4 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mb-2">
                      附件 ({task.attachments.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {task.attachments.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-100"
                        >
                          <i className="ri-file-line text-teal-500 text-sm"></i>
                          <span className="text-xs text-gray-700">{file.name}</span>
                          <span className="text-xs text-gray-400">({file.size})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 目标团队（指定团队时显示） */}
                {task.scope === 'specific' && task.targetTeams.length > 0 && (
                  <div className="pt-4 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mb-2">目标团队</p>
                    <div className="flex flex-wrap gap-2">
                      {task.targetTeams.map((team, index) => (
                        <span
                          key={index}
                          className="px-2.5 py-1 bg-teal-50 text-teal-700 text-xs font-medium rounded-full whitespace-nowrap"
                        >
                          {team}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 提交进度条 */}
              {task.status === 'published' && (
                <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 flex-shrink-0">提交进度</span>
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full transition-all"
                        style={{
                          width: `${(task.submissionCount / task.totalTargets) * 100}%`,
                        }}
                      ></div>
                    </div>
                    <span className="text-xs font-bold text-teal-600 flex-shrink-0">
                      {Math.round((task.submissionCount / task.totalTargets) * 100)}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 创建任务弹窗 */}
      {showCreateModal && (
        <CreateTaskModal onClose={() => setShowCreateModal(false)} onSubmit={handleCreateTask} />
      )}

      {/* 成功提示 */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-5 py-3 rounded-2xl shadow-xl">
          <i className="ri-check-circle-fill text-white text-lg"></i>
          <span className="text-sm font-medium">操作成功</span>
        </div>
      )}
    </div>
  );
}