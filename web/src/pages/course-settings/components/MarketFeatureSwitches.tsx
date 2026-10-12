/**
 * 市场调研环节功能开关：线上问卷固定开启；调研数据上传可关
 */
import { useEffect, useState } from 'react';
import { Switch, message } from 'antd';
import {
  normalizeMarketFeatures,
  saveCourseStageFeatures,
  type CourseStageSetting,
  type MarketCourseFeatures,
} from '../../../lib/courseSettingsApi';

type Props = {
  classId: string;
  setting: CourseStageSetting;
  onSaved: (setting: CourseStageSetting) => void;
};

export default function MarketFeatureSwitches({ classId, setting, onSaved }: Props) {
  const initial = normalizeMarketFeatures(setting.features);
  const [uploadEnabled, setUploadEnabled] = useState(initial.uploadEnabled);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setUploadEnabled(normalizeMarketFeatures(setting.features).uploadEnabled);
  }, [setting.features]);

  const persist = async (next: MarketCourseFeatures) => {
    if (!classId) return;
    setSaving(true);
    try {
      const saved = await saveCourseStageFeatures(classId, 'market', next);
      onSaved(saved);
      message.success('功能开关已保存');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存失败');
      setUploadEnabled(normalizeMarketFeatures(setting.features).uploadEnabled);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 md:p-6 space-y-5">
      <div>
        <h3 className="text-sm font-bold text-gray-900">功能开关</h3>
        <p className="text-xs text-gray-500 mt-1">
          关闭后学生端与教师工作区将隐藏对应模块；已有数据保留，不影响阶段解锁与已生成报告。
        </p>
      </div>

      <div className="rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-3.5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-medium text-gray-900">线上问卷</div>
          <p className="text-xs text-gray-500 mt-1">本环节必需能力，始终开启，不可关闭。</p>
        </div>
        <Switch checked disabled />
      </div>

      <div className="rounded-xl border border-gray-100 px-4 py-3.5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-medium text-gray-900">调研数据上传</div>
          <p className="text-xs text-gray-500 mt-1">
            关闭后隐藏「调研数据上传」Tab，AI 出题不再引用上传文件；再次打开不清空历史文件。
          </p>
        </div>
        <Switch
          checked={uploadEnabled}
          loading={saving}
          onChange={(checked) => {
            setUploadEnabled(checked);
            void persist({ surveyEnabled: true, uploadEnabled: checked });
          }}
        />
      </div>
    </div>
  );
}
