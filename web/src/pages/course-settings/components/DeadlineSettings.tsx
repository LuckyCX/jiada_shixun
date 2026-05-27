import { useEffect, useMemo, useState } from 'react';
import { DatePicker, InputNumber, Switch } from 'antd';
import dayjs from 'dayjs';
import type { CourseSettingStage, CourseStageSetting } from '../../../lib/courseSettingsApi';

type PrerequisiteStage = {
  stageName: string;
  startDate: string;
  deadlineDate: string;
  durationDays: number;
  configured: boolean;
  onConfigure: () => void;
};

type DeadlineSettingsProps = {
  stage: CourseSettingStage;
  setting: CourseStageSetting;
  defaultStartDate: string;
  saving?: boolean;
  prerequisites?: PrerequisiteStage[];
  onSave: (input: {
    startDate: string;
    deadlineDate: string;
    reminderDays: number;
    reminderEnabled: boolean;
  }) => Promise<void> | void;
};

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function calcDuration(startDate: string, deadlineDate: string) {
  if (!startDate || !deadlineDate) return 0;
  const start = new Date(`${startDate}T00:00:00`).getTime();
  const end = new Date(`${deadlineDate}T00:00:00`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.floor((end - start) / 86400000) + 1;
}

export default function DeadlineSettings({ stage, setting, defaultStartDate, saving = false, prerequisites = [], onSave }: DeadlineSettingsProps) {
  const [startDate, setStartDate] = useState(setting.startDate || defaultStartDate || todayDate());
  const [deadlineDate, setDeadlineDate] = useState(setting.deadlineDate || '');
  const [reminderDays, setReminderDays] = useState(setting.reminderDays ?? 3);
  const [reminderEnabled, setReminderEnabled] = useState(setting.reminderEnabled);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setStartDate(setting.startDate || defaultStartDate || todayDate());
    setDeadlineDate(setting.deadlineDate || '');
    setReminderDays(setting.reminderDays ?? 3);
    setReminderEnabled(setting.reminderEnabled);
    setMessage('');
  }, [defaultStartDate, setting]);

  const durationDays = useMemo(() => calcDuration(startDate, deadlineDate), [deadlineDate, startDate]);
  const reminderMaxDays = durationDays > 0 ? Math.min(30, Math.max(0, durationDays - 1)) : 30;
  const reminderDate = useMemo(() => {
    if (!deadlineDate || !reminderEnabled) return '';
    return addDays(deadlineDate, -Math.max(0, reminderDays));
  }, [deadlineDate, reminderDays, reminderEnabled]);

  useEffect(() => {
    if (durationDays > 0 && reminderDays > reminderMaxDays) {
      setReminderDays(reminderMaxDays);
    }
  }, [durationDays, reminderDays, reminderMaxDays]);

  const handleSave = async () => {
    if (!deadlineDate) {
      setMessage('请选择截止日期');
      return;
    }
    if (durationDays <= 0) {
      setMessage('截止日期不能早于开始日期');
      return;
    }
    if (reminderDays >= durationDays) {
      setMessage(`提前提醒天数必须小于任务时长，当前最多 ${reminderMaxDays} 天`);
      return;
    }
    setMessage('');
    await onSave({ startDate, deadlineDate, reminderDays, reminderEnabled });
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${stage.color} text-white flex items-center justify-center flex-shrink-0`}>
              <i className={`${stage.icon} text-xl`}></i>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-0.5">截止时间配置</div>
              <h2 className="text-base font-bold text-gray-900">{stage.name}</h2>
              <p className="text-xs text-gray-500 mt-0.5">{stage.taskName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-teal-500 text-white text-sm font-medium rounded-xl hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap cursor-pointer"
          >
            <i className="ri-save-line mr-1.5"></i>{saving ? '保存中...' : '保存设置'}
          </button>
        </div>

        <div className="mt-5 grid grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">开始日期</label>
            <DatePicker
              value={startDate ? dayjs(startDate) : null}
              onChange={(date) => setStartDate(date ? date.format('YYYY-MM-DD') : '')}
              className="w-full"
              format="YYYY-MM-DD"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">截止日期</label>
            <DatePicker
              value={deadlineDate ? dayjs(deadlineDate) : null}
              onChange={(date) => setDeadlineDate(date ? date.format('YYYY-MM-DD') : '')}
              disabledDate={(date) => Boolean(startDate && date && date.isBefore(dayjs(startDate), 'day'))}
              className="w-full"
              format="YYYY-MM-DD"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">任务时长</label>
            <div className="h-[38px] px-3 py-2 text-sm rounded-xl bg-gray-50 border border-gray-100 text-gray-800 font-semibold">
              {durationDays > 0 ? `${durationDays} 天` : '待计算'}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">提前提醒</label>
            <div className="flex items-center gap-2">
              <InputNumber
                min={0}
                max={reminderMaxDays}
                precision={0}
                value={reminderDays}
                onChange={(value) => setReminderDays(Number(value || 0))}
                disabled={!reminderEnabled}
                className="w-full"
              />
              <span className="text-xs text-gray-500 whitespace-nowrap">天</span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-4 rounded-xl bg-gray-50 px-4 py-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <Switch
              checked={reminderEnabled}
              onChange={setReminderEnabled}
            />
            <span className="text-sm text-gray-700">开启截止日前全员通知</span>
          </label>
          <div className="text-xs text-gray-500">
            {reminderDate ? `预计 ${reminderDate} 向班级全员发送提醒` : '设置截止日期后可计算提醒日期'}
          </div>
        </div>

        {message && <div className="mt-3 text-sm text-red-500">{message}</div>}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <i className="ri-calendar-close-line text-red-400 text-xl"></i>
          <div>
            <div className="text-xs text-gray-400">当前截止日期</div>
            <div className="text-sm font-bold text-gray-800">{setting.deadlineDate || '未配置'}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <i className="ri-time-line text-amber-400 text-xl"></i>
          <div>
            <div className="text-xs text-gray-400">已保存任务时长</div>
            <div className="text-sm font-bold text-gray-800">{setting.durationDays > 0 ? `${setting.durationDays} 天` : '未配置'}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <i className="ri-alarm-line text-teal-400 text-xl"></i>
          <div>
            <div className="text-xs text-gray-400">提醒状态</div>
            <div className="text-sm font-bold text-gray-800">
              {setting.reminderEnabled ? `截止前 ${setting.reminderDays} 天` : '未开启'}
            </div>
          </div>
        </div>
      </div>
      {prerequisites.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div>
              <div className="text-xs text-gray-400">前置流程日期节点</div>
              <div className="text-sm font-bold text-gray-900 mt-0.5">共 {prerequisites.length} 个前置流程</div>
            </div>
          </div>
          <div className="space-y-3">
            {prerequisites.map((prerequisite) => (
              <div key={prerequisite.stageName} className="rounded-xl border border-gray-100 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-gray-800">{prerequisite.stageName}</div>
                  {!prerequisite.configured && (
                    <button
                      type="button"
                      onClick={prerequisite.onConfigure}
                      className="px-3 py-1.5 bg-teal-500 text-white text-xs font-medium rounded-lg hover:bg-teal-600 cursor-pointer"
                    >
                      去配置
                    </button>
                  )}
                </div>
                {prerequisite.configured ? (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl bg-gray-50 px-3 py-2">
                      <div className="text-xs text-gray-400">开始日期</div>
                      <div className="text-xs font-semibold text-gray-700">{prerequisite.startDate || '未配置'}</div>
                    </div>
                    <div className="rounded-xl bg-gray-50 px-3 py-2">
                      <div className="text-xs text-gray-400">截止日期</div>
                      <div className="text-xs font-semibold text-gray-700">{prerequisite.deadlineDate || '未配置'}</div>
                    </div>
                    <div className="rounded-xl bg-gray-50 px-3 py-2">
                      <div className="text-xs text-gray-400">任务时长</div>
                      <div className="text-xs font-semibold text-gray-700">{prerequisite.durationDays || 0} 天</div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-center text-sm text-gray-500">
                    前置流程尚未配置日期，请先完成日期设置
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
