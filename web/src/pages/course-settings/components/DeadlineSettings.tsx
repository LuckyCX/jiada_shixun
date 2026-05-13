
import { useState } from 'react';

interface TaskDeadline {
  id: string;
  stage: string;
  taskName: string;
  icon: string;
  color: string;
  deadline: string;
  duration: number; // 天数
  isRequired: boolean;
  status: 'not-started' | 'in-progress' | 'completed';
  reminderDays: number;
}

const defaultDeadlines: TaskDeadline[] = [
  { id: 'team-formation', stage: '组队阶段', taskName: '团队组建与分工', icon: 'ri-team-line', color: 'from-teal-500 to-cyan-500', deadline: '2025-03-10', duration: 7, isRequired: true, status: 'completed', reminderDays: 2 },
  { id: 'ideation', stage: '创新思维', taskName: 'SCAMPER创新思维训练', icon: 'ri-lightbulb-line', color: 'from-amber-500 to-orange-500', deadline: '2025-03-20', duration: 10, isRequired: true, status: 'completed', reminderDays: 2 },
  { id: 'market-research', stage: '市场调研', taskName: '用户调研与市场分析', icon: 'ri-bar-chart-line', color: 'from-indigo-500 to-violet-500', deadline: '2025-04-05', duration: 14, isRequired: true, status: 'in-progress', reminderDays: 3 },
  { id: 'product-design', stage: '产品设计', taskName: '产品原型设计与迭代', icon: 'ri-pencil-ruler-line', color: 'from-pink-500 to-rose-500', deadline: '2025-04-20', duration: 14, isRequired: true, status: 'not-started', reminderDays: 3 },
  { id: 'business-model', stage: '商业模式', taskName: '商业模式画布构建', icon: 'ri-layout-grid-line', color: 'from-green-500 to-emerald-500', deadline: '2025-05-05', duration: 14, isRequired: true, status: 'not-started', reminderDays: 3 },
  { id: 'ai-validation', stage: 'AI验证', taskName: 'AI工具验证与优化', icon: 'ri-robot-2-line', color: 'from-cyan-500 to-sky-500', deadline: '2025-05-18', duration: 12, isRequired: false, status: 'not-started', reminderDays: 2 },
  { id: 'role-simulation', stage: '角色模拟', taskName: '路演角色模拟训练', icon: 'ri-user-star-line', color: 'from-purple-500 to-violet-500', deadline: '2025-05-28', duration: 10, isRequired: false, status: 'not-started', reminderDays: 2 },
  { id: 'business-plan', stage: '商业计划', taskName: '商业计划书撰写与提交', icon: 'ri-file-text-line', color: 'from-orange-500 to-red-500', deadline: '2025-06-10', duration: 12, isRequired: true, status: 'not-started', reminderDays: 5 },
];

export default function DeadlineSettings() {
  const [deadlines, setDeadlines] = useState<TaskDeadline[]>(defaultDeadlines);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<TaskDeadline>>({});
  const [saved, setSaved] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [batchOffset, setBatchOffset] = useState(0);

  const handleEdit = (task: TaskDeadline) => {
    setEditingId(task.id);
    setEditForm({
      deadline: task.deadline,
      duration: task.duration,
      reminderDays: task.reminderDays,
      isRequired: task.isRequired,
    });
  };

  const handleSave = (id: string) => {
    // Simple validation to avoid saving empty or invalid fields
    if (!editForm.deadline || editForm.duration == null || editForm.reminderDays == null) {
      alert('请完整填写截止日期、任务时长和提醒天数。');
      return;
    }

    setDeadlines(prev =>
      prev.map(d => (d.id === id ? { ...d, ...editForm } : d))
    );
    setEditingId(null);
    setEditForm({});
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleBatchApply = () => {
    if (batchOffset === 0) return;
    setDeadlines(prev =>
      prev.map(d => {
        const date = new Date(d.deadline);
        date.setDate(date.getDate() + batchOffset);
        return { ...d, deadline: date.toISOString().split('T')[0] };
      })
    );
    setBatchOffset(0);
    setBatchMode(false);
  };

  const handleSaveAll = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const statusMap = {
    'not-started': { label: '未开始', color: 'bg-gray-100 text-gray-500' },
    'in-progress': { label: '进行中', color: 'bg-teal-100 text-teal-600' },
    completed: { label: '已完成', color: 'bg-green-100 text-green-600' },
  };

  return (
    <div className="space-y-5">
      {/* 顶部操作栏 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <i className="ri-calendar-schedule-line text-teal-500"></i>
              实训任务截止时间配置
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">为每个实训阶段设置截止时间、任务时长和提醒规则</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBatchMode(!batchMode)}
              className={`px-4 py-2 text-sm font-medium rounded-xl border transition-all whitespace-nowrap cursor-pointer ${
                batchMode
                  ? 'bg-teal-50 border-teal-200 text-teal-600'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <i className="ri-calendar-2-line mr-1.5"></i>批量调整日期
            </button>
            <button
              onClick={handleSaveAll}
              className="px-4 py-2 bg-teal-500 text-white text-sm font-medium rounded-xl hover:bg-teal-600 transition-colors whitespace-nowrap cursor-pointer"
            >
              <i className="ri-save-line mr-1.5"></i>保存所有设置
            </button>
          </div>
        </div>

        {/* 批量调整面板 */}
        {batchMode && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-4 bg-teal-50 rounded-xl p-4">
            <i className="ri-information-line text-teal-500 text-base flex-shrink-0"></i>
            <span className="text-sm text-teal-700 font-medium">批量调整所有截止日期：</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setBatchOffset(v => v - 1)}
                className="w-7 h-7 flex items-center justify-center bg-white border border-teal-200 rounded-lg text-teal-600 hover:bg-teal-100 cursor-pointer"
              >
                <i className="ri-subtract-line text-sm"></i>
              </button>
              <span className="w-16 text-center text-sm font-bold text-teal-700">
                {batchOffset > 0 ? `+${batchOffset}` : batchOffset} 天
              </span>
              <button
                onClick={() => setBatchOffset(v => v + 1)}
                className="w-7 h-7 flex items-center justify-center bg-white border border-teal-200 rounded-lg text-teal-600 hover:bg-teal-100 cursor-pointer"
              >
                <i className="ri-add-line text-sm"></i>
              </button>
            </div>
            <button
              onClick={handleBatchApply}
              disabled={batchOffset === 0}
              className="px-4 py-1.5 bg-teal-500 text-white text-sm rounded-xl hover:bg-teal-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap cursor-pointer"
            >
              应用调整
            </button>
            <button
              onClick={() => {
                setBatchMode(false);
                setBatchOffset(0);
              }}
              className="text-sm text-gray-400 hover:text-gray-600 cursor-pointer whitespace-nowrap"
            >
              取消
            </button>
          </div>
        )}
      </div>

      {/* 任务列表 */}
      <div className="space-y-3">
        {deadlines.map((task, index) => (
          <div key={task.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-all">
            <div className="flex items-stretch">
              {/* 左侧序号+颜色条 */}
              <div className={`w-1.5 bg-gradient-to-b ${task.color} flex-shrink-0`}></div>
              <div className="flex-1 p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${task.color} flex items-center justify-center flex-shrink-0`}>
                      <i className={`${task.icon} text-white text-sm`}></i>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 font-medium">第{index + 1}阶段</span>
                        <span className="text-xs text-gray-300">·</span>
                        <span className="text-xs text-gray-500">{task.stage}</span>
                        {task.isRequired ? (
                          <span className="px-1.5 py-0.5 bg-red-50 text-red-500 text-xs font-medium rounded-md">必修</span>
                        ) : (
                          <span className="px-1.5 py-0.5 bg-gray-50 text-gray-400 text-xs font-medium rounded-md">选修</span>
                        )}
                      </div>
                      <div className="text-sm font-bold text-gray-900 mt-0.5">{task.taskName}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${statusMap[task.status].color}`}>
                      {statusMap[task.status].label}
                    </span>
                    {editingId !== task.id && (
                      <button
                        onClick={() => handleEdit(task)}
                        className="px-3 py-1.5 bg-gray-50 text-gray-600 text-xs font-medium rounded-xl hover:bg-teal-50 hover:text-teal-600 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <i className="ri-edit-line mr-1"></i>编辑
                      </button>
                    )}
                  </div>
                </div>

                {/* 展示模式 */}
                {editingId !== task.id && (
                  <div className="mt-4 grid grid-cols-3 gap-4">
                    <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
                      <i className="ri-calendar-close-line text-red-400 text-sm"></i>
                      <div>
                        <div className="text-xs text-gray-400">截止日期</div>
                        <div className="text-sm font-bold text-gray-800">{task.deadline}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
                      <i className="ri-time-line text-amber-400 text-sm"></i>
                      <div>
                        <div className="text-xs text-gray-400">任务时长</div>
                        <div className="text-sm font-bold text-gray-800">{task.duration} 天</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
                      <i className="ri-alarm-line text-teal-400 text-sm"></i>
                      <div>
                        <div className="text-xs text-gray-400">提前提醒</div>
                        <div className="text-sm font-bold text-gray-800">截止前 {task.reminderDays} 天</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 编辑模式 */}
                {editingId === task.id && (
                  <div className="mt-4 bg-teal-50 rounded-xl p-4 space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">截止日期</label>
                        <input
                          type="date"
                          value={editForm.deadline || ''}
                          onChange={e => setEditForm(f => ({ ...f, deadline: e.target.value }))}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">任务时长（天）</label>
                        <input
                          type="number"
                          min={1}
                          max={60}
                          value={editForm.duration ?? ''}
                          onChange={e => setEditForm(f => ({ ...f, duration: Number(e.target.value) }))}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">提前提醒（天）</label>
                        <input
                          type="number"
                          min={1}
                          max={14}
                          value={editForm.reminderDays ?? ''}
                          onChange={e => setEditForm(f => ({ ...f, reminderDays: Number(e.target.value) }))}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editForm.isRequired ?? true}
                          onChange={e => setEditForm(f => ({ ...f, isRequired: e.target.checked }))}
                          className="w-4 h-4 accent-teal-500 cursor-pointer"
                        />
                        <span className="text-sm text-gray-700">设为必修任务</span>
                      </label>
                      <div className="flex-1"></div>
                      <button
                        onClick={handleCancel}
                        className="px-4 py-2 bg-white border border-gray-200 text-gray-600 text-sm rounded-xl hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        取消
                      </button>
                      <button
                        onClick={() => handleSave(task.id)}
                        className="px-4 py-2 bg-teal-500 text-white text-sm rounded-xl hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <i className="ri-check-line mr-1"></i>保存
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 保存成功提示 */}
      {saved && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-xl">
          <i className="ri-check-circle-fill text-green-400 text-lg"></i>
          <span className="text-sm font-medium">截止时间设置已保存！</span>
        </div>
      )}
    </div>
  );
}
