import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DeadlineSettings from './components/DeadlineSettings';
import CourseManagement from '../admin-dashboard/components/courseResource/CourseManagement';
import {
  COURSE_SETTING_STAGES,
  fetchCourseSettings,
  saveCourseStageSetting,
  type CourseSettingStageKey,
  type CourseStageSetting,
} from '../../lib/courseSettingsApi';
import type { TeacherPersonalClassRow } from '../teacher-dashboard/teacherPortalApi';

type DetailTab = 'deadline' | 'scoring' | 'content';

interface CourseSettingsPageProps {
  embedded?: boolean;
  personalClass?: TeacherPersonalClassRow | null;
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function emptySetting(moduleKey: CourseSettingStageKey): CourseStageSetting {
  return {
    moduleKey,
    startDate: '',
    deadlineDate: '',
    durationDays: 0,
    reminderDays: 3,
    reminderEnabled: true,
    lastRemindedAt: '',
    lastRemindedDeadline: '',
  };
}

export default function CourseSettingsPage({ embedded = false, personalClass = null }: CourseSettingsPageProps) {
  const [selectedStageKey, setSelectedStageKey] = useState<CourseSettingStageKey | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>('deadline');
  const [settings, setSettings] = useState<CourseStageSetting[]>([]);
  const [studentCount, setStudentCount] = useState(personalClass?.studentCount || 0);
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<CourseSettingStageKey | null>(null);
  const [notice, setNotice] = useState('');

  const classId = personalClass?.id || '';
  const selectedStage = COURSE_SETTING_STAGES.find((stage) => stage.key === selectedStageKey) || null;
  const settingsByKey = useMemo(
    () => new Map(settings.map((setting) => [setting.moduleKey, setting])),
    [settings]
  );
  const selectedSetting = selectedStage ? settingsByKey.get(selectedStage.key) || emptySetting(selectedStage.key) : null;

  useEffect(() => {
    if (!classId) {
      setSettings([]);
      setStudentCount(0);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchCourseSettings(classId)
      .then((data) => {
        if (cancelled) return;
        setSettings(data.settings);
        setStudentCount(data.studentCount);
      })
      .catch((e) => {
        if (!cancelled) setNotice(e instanceof Error ? e.message : '课程设置加载失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [classId]);

  const configuredCount = settings.filter((setting) => setting.deadlineDate).length;
  const totalDuration = settings.reduce((sum, setting) => sum + Number(setting.durationDays || 0), 0);
  const reminderCount = settings.filter((setting) => setting.deadlineDate && setting.reminderEnabled).length;
  const nextDeadline = settings
    .filter((setting) => setting.deadlineDate)
    .map((setting) => setting.deadlineDate)
    .sort()[0] || '未配置';

  const defaultStartDate = (stageKey: CourseSettingStageKey) => {
    const idx = COURSE_SETTING_STAGES.findIndex((stage) => stage.key === stageKey);
    const current = settingsByKey.get(stageKey);
    if (current?.startDate) return current.startDate;
    if (idx > 0) {
      const prev = settingsByKey.get(COURSE_SETTING_STAGES[idx - 1].key);
      if (prev?.deadlineDate) return addDays(prev.deadlineDate, 1);
    }
    return todayDate();
  };

  const updateSetting = async (
    stageKey: CourseSettingStageKey,
    input: { startDate: string; deadlineDate: string; reminderDays: number; reminderEnabled: boolean }
  ) => {
    if (!classId) {
      setNotice('请先选择班级');
      return;
    }
    setSavingKey(stageKey);
    try {
      const saved = await saveCourseStageSetting(classId, stageKey, input);
      setSettings((prev) => {
        const exists = prev.some((item) => item.moduleKey === saved.moduleKey);
        return exists ? prev.map((item) => (item.moduleKey === saved.moduleKey ? saved : item)) : [...prev, saved];
      });
      setNotice('课程设置已保存');
      window.setTimeout(() => setNotice(''), 2200);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSavingKey(null);
    }
  };

  const openStage = (stageKey: CourseSettingStageKey) => {
    setSelectedStageKey(stageKey);
    setActiveTab('deadline');
  };

  const previousStageFor = (stageKey: CourseSettingStageKey) => {
    const idx = COURSE_SETTING_STAGES.findIndex((stage) => stage.key === stageKey);
    return idx > 0 ? COURSE_SETTING_STAGES[idx - 1] : null;
  };

  const renderStats = () => (
    <div className="grid grid-cols-4 gap-3">
      {[
        { label: '阶段总数', value: COURSE_SETTING_STAGES.length, icon: 'ri-stack-line', color: 'from-teal-500 to-cyan-500', sub: `${configuredCount} 项已配置` },
        { label: '总任务时长', value: `${totalDuration}`, icon: 'ri-time-line', color: 'from-indigo-500 to-violet-500', sub: '天' },
        { label: '提醒任务', value: reminderCount, icon: 'ri-alarm-line', color: 'from-amber-500 to-orange-500', sub: '全员通知' },
        { label: '班级学生', value: studentCount, icon: 'ri-user-3-line', color: 'from-green-500 to-emerald-500', sub: personalClass?.name || '当前班级' },
      ].map((card) => (
        <div key={card.label} className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center flex-shrink-0`}>
            <i className={`${card.icon} text-white text-base`}></i>
          </div>
          <div className="min-w-0">
            <div className="text-xs text-gray-400">{card.label}</div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-gray-900">{card.value}</span>
              <span className="text-xs text-gray-400 truncate">{card.sub}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderStageList = () => (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-base font-bold text-gray-900">课程设置</h2>
            <p className="text-xs text-gray-500 mt-1">
              {personalClass ? `当前班级：${personalClass.name} · 最近截止：${nextDeadline}` : '请先在顶部选择班级'}
            </p>
          </div>
          {loading && <span className="text-xs text-gray-400">加载中...</span>}
        </div>
        {renderStats()}
      </div>

      {!classId ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center text-sm text-gray-500">
          请先选择班级后再配置课程设置
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {COURSE_SETTING_STAGES.map((stage, index) => {
            const setting = settingsByKey.get(stage.key) || emptySetting(stage.key);
            return (
              <button
                key={stage.key}
                type="button"
                onClick={() => openStage(stage.key)}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-left hover:border-teal-200 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${stage.color} text-white flex items-center justify-center flex-shrink-0`}>
                    <i className={`${stage.icon} text-xl`}></i>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-gray-400">第 {index + 1} 阶段</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${setting.deadlineDate ? 'bg-teal-50 text-teal-600' : 'bg-gray-100 text-gray-400'}`}>
                        {setting.deadlineDate ? '已配置' : '未配置'}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-gray-900 mt-1 truncate">{stage.shortName}</h3>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{stage.taskName}</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-gray-50 px-3 py-2">
                    <div className="text-xs text-gray-400">截止</div>
                    <div className="text-xs font-semibold text-gray-700 truncate">{setting.deadlineDate || '未配置'}</div>
                  </div>
                  <div className="rounded-xl bg-gray-50 px-3 py-2">
                    <div className="text-xs text-gray-400">时长</div>
                    <div className="text-xs font-semibold text-gray-700">{setting.durationDays || 0} 天</div>
                  </div>
                  <div className="rounded-xl bg-gray-50 px-3 py-2">
                    <div className="text-xs text-gray-400">提醒</div>
                    <div className="text-xs font-semibold text-gray-700">{setting.reminderEnabled ? `${setting.reminderDays} 天` : '关闭'}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderScoringPlaceholder = () => (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
      <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 text-white flex items-center justify-center">
        <i className="ri-scales-3-line text-2xl"></i>
      </div>
      <h3 className="text-base font-bold text-gray-900 mb-2">评分标准设置</h3>
      <p className="text-sm text-gray-500">该模块暂保留入口，评分标准配置功能后续开放。</p>
    </div>
  );

  const renderContentMaintenance = () => {
    if (!selectedStage?.courseModuleKey) {
      return (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center text-sm text-gray-500">
          团队组建与分工暂不包含课程资源维护内容
        </div>
      );
    }
    return <CourseManagement selectedModule={selectedStage.courseModuleKey} hideModuleTabs />;
  };

  const renderDetail = () => {
    if (!selectedStage || !selectedSetting) return null;
    return (
      <div className="space-y-5">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setSelectedStageKey(null)}
                className="w-9 h-9 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center cursor-pointer"
              >
                <i className="ri-arrow-left-line"></i>
              </button>
              <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${selectedStage.color} text-white flex items-center justify-center flex-shrink-0`}>
                <i className={`${selectedStage.icon} text-xl`}></i>
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-gray-900 truncate">{selectedStage.name}</h2>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{selectedStage.taskName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1">
              {[
                { key: 'deadline' as DetailTab, label: '截止时间配置', icon: 'ri-calendar-schedule-line' },
                { key: 'scoring' as DetailTab, label: '评分标准设置', icon: 'ri-scales-3-line' },
                ...(selectedStage.courseModuleKey
                  ? [{ key: 'content' as DetailTab, label: '课程资源', icon: 'ri-folder-settings-line' }]
                  : []),
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    activeTab === tab.key ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <i className={`${tab.icon} mr-1.5`}></i>{tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {activeTab === 'deadline' && (
          <DeadlineSettings
            stage={selectedStage}
            setting={selectedSetting}
            defaultStartDate={defaultStartDate(selectedStage.key)}
            saving={savingKey === selectedStage.key}
            prerequisite={(() => {
              const prev = previousStageFor(selectedStage.key);
              if (!prev) return null;
              const prevSetting = settingsByKey.get(prev.key) || emptySetting(prev.key);
              return {
                stageName: prev.name,
                startDate: prevSetting.startDate,
                deadlineDate: prevSetting.deadlineDate,
                durationDays: prevSetting.durationDays,
                configured: Boolean(prevSetting.startDate && prevSetting.deadlineDate),
                onConfigure: () => openStage(prev.key),
              };
            })()}
            onSave={(input) => updateSetting(selectedStage.key, input)}
          />
        )}
        {activeTab === 'scoring' && renderScoringPlaceholder()}
        {activeTab === 'content' && renderContentMaintenance()}
      </div>
    );
  };

  const body = (
    <div className="flex flex-col gap-5">
      {selectedStage ? renderDetail() : renderStageList()}
      {notice && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-xl text-sm">
          {notice}
        </div>
      )}
    </div>
  );

  if (embedded) return body;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-20">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-400">教师工作台</span>
            <i className="ri-arrow-right-s-line text-gray-300"></i>
            <span className="font-medium text-gray-700">课程设置</span>
          </div>
          <Link
            to="/teacher-dashboard"
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <i className="ri-arrow-left-line"></i>
            <span>返回工作台</span>
          </Link>
        </div>
      </header>
      <main className="p-6">{body}</main>
    </div>
  );
}
