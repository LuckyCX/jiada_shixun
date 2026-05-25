import { useCallback, useEffect, useState } from 'react';
import { Modal, Select, message } from 'antd';
import type { TeacherPersonalClassRow } from '../../teacherPortalApi';
import type { PersonalClassTask } from '../../../../lib/personalClassTaskApi';
import {
  TASK_MODULES,
  TASK_PRIORITY_OPTIONS,
  listPersonalClassTasks,
  deletePersonalClassTask,
  updatePersonalClassTask,
} from '../../../../lib/personalClassTaskApi';
import dayjs from 'dayjs';
import CreateTaskModal from './CreateTaskModal';

function formatDeadlineZh(deadline: string) {
  if (!deadline?.trim()) return '—';
  const d = dayjs(deadline.trim());
  return d.isValid() ? d.format('YYYY年M月D日') : deadline;
}

type Props = {
  personalClass: TeacherPersonalClassRow;
};

const priorityLabel = (p: string) =>
  TASK_PRIORITY_OPTIONS.find((o) => o.value === p)?.label ?? p;

export default function TaskManagement({ personalClass }: Props) {
  const classId = personalClass.id;
  const [tasks, setTasks] = useState<PersonalClassTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTaskId, setEditTaskId] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'draft' | 'expired'>('all');
  const [filterModule, setFilterModule] = useState<string>('all');
  const [searchText, setSearchText] = useState('');

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const { tasks: list } = await listPersonalClassTasks(classId);
      setTasks(list);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载任务失败');
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const handleDelete = (task: PersonalClassTask) => {
    Modal.confirm({
      title: '删除任务',
      content: `确定删除「${task.title}」？附件将一并删除。`,
      okType: 'danger',
      onOk: async () => {
        await deletePersonalClassTask(classId, task.id);
        message.success('已删除');
        await loadTasks();
      },
    });
  };

  const handlePublishDraft = async (task: PersonalClassTask) => {
    try {
      await updatePersonalClassTask(classId, task.id, {
        title: task.title,
        description: task.description,
        module: task.module,
        priority: task.priority,
        deadline: task.deadline,
        scope: task.scope,
        teamIds: task.targetTeamIds,
        attachmentsEnabled: task.attachmentsEnabled,
        status: 'published',
      });
      message.success('已发布');
      await loadTasks();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '发布失败');
    }
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

  const openCreate = () => {
    setEditTaskId(undefined);
    setShowModal(true);
  };

  const openEdit = (taskId: string) => {
    setEditTaskId(taskId);
    setShowModal(true);
  };

  return (
    <div>
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: '任务总数', value: stats.total, icon: 'ri-file-list-3-line', color: 'from-teal-500 to-cyan-500' },
          { label: '已发布', value: stats.published, icon: 'ri-send-plane-line', color: 'from-green-500 to-emerald-500' },
          { label: '草稿箱', value: stats.draft, icon: 'ri-draft-line', color: 'from-amber-500 to-orange-500' },
          { label: '已过期', value: stats.expired, icon: 'ri-time-line', color: 'from-gray-400 to-gray-500' },
        ].map((card, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center`}>
                <i className={`${card.icon} text-white text-base`}></i>
              </div>
              <span className="text-3xl font-bold text-gray-900">{card.value}</span>
            </div>
            <div className="text-sm font-medium text-gray-700">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-1 flex-wrap">
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
            <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
              {(
                [
                  { key: 'all' as const, label: '全部' },
                  { key: 'published' as const, label: '已发布' },
                  { key: 'draft' as const, label: '草稿' },
                  { key: 'expired' as const, label: '已过期' },
                ] as const
              ).map((status) => (
                <button
                  key={status.key}
                  type="button"
                  onClick={() => setFilterStatus(status.key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer ${
                    filterStatus === status.key ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  {status.label}
                </button>
              ))}
            </div>
            <Select
              value={filterModule}
              onChange={setFilterModule}
              className="min-w-[180px]"
              options={[{ value: 'all', label: '全部模块' }, ...TASK_MODULES.map((m) => ({ value: m, label: m }))]}
            />
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="px-5 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-sm font-medium rounded-xl cursor-pointer flex items-center gap-2"
          >
            <i className="ri-add-line"></i>
            发布新任务
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-20 text-sm">加载中…</div>
      ) : filteredTasks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center text-gray-500 text-sm">
          暂无任务
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTasks.map((task) => {
            const pct =
              task.totalTargets > 0
                ? Math.round((task.completedCount / task.totalTargets) * 100)
                : 0;
            return (
              <div key={task.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="text-base font-bold text-gray-900">{task.title}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {priorityLabel(task.priority)}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-teal-50 text-teal-700">
                        {task.module}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">{task.description}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {task.status === 'draft' && (
                      <button
                        type="button"
                        onClick={() => void handlePublishDraft(task)}
                        className="px-3 py-1.5 bg-teal-500 text-white text-xs rounded-lg cursor-pointer"
                      >
                        发布
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openEdit(task.id)}
                      className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg cursor-pointer"
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(task)}
                      className="px-3 py-1.5 bg-red-50 text-red-600 text-xs rounded-lg cursor-pointer"
                    >
                      删除
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-gray-400">截止时间</p>
                    <p className="font-medium">{formatDeadlineZh(task.deadline)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">发布范围</p>
                    <p className="font-medium">{task.scope === 'all' ? '全班' : '指定团队'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">完成情况</p>
                    <p className="font-medium">
                      {task.completedCount} / {task.totalTargets}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">发布人</p>
                    <p className="font-medium">{task.publishedBy || '—'}</p>
                  </div>
                </div>
                {task.scope === 'specific' && task.teamProgress.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mb-2">各团队完成进度</p>
                    <ul className="space-y-1">
                      {task.teamProgress.map((tp) => (
                        <li key={tp.teamId} className="text-sm text-gray-700 flex justify-between">
                          <span>{tp.teamName}</span>
                          <span className="font-medium text-teal-600">
                            {tp.completed} / {tp.total}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {task.status === 'published' && task.totalTargets > 0 && (
                  <div className="mt-4 flex items-center gap-3">
                    <span className="text-xs text-gray-500">完成进度</span>
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-teal-500 to-cyan-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-teal-600">{pct}%</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <CreateTaskModal
        open={showModal}
        classId={classId}
        taskId={editTaskId}
        onClose={() => setShowModal(false)}
        onSuccess={() => void loadTasks()}
      />
    </div>
  );
}
