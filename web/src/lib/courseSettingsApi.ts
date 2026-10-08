import { teacherFetch } from '../pages/teacher-dashboard/teacherPortalApi';

export type CourseSettingStageKey = 'team' | 'ideation' | 'market' | 'product' | 'business' | 'simulation' | 'plan';

export type CourseSettingStage = {
  key: CourseSettingStageKey;
  name: string;
  shortName: string;
  taskName: string;
  icon: string;
  color: string;
  courseModuleKey?: string;
};

export type CourseStageSetting = {
  moduleKey: CourseSettingStageKey;
  startDate: string;
  deadlineDate: string;
  durationDays: number;
  reminderDays: number;
  reminderEnabled: boolean;
  skipped: boolean;
  lastRemindedAt: string;
  lastRemindedDeadline: string;
};

export type CourseWorkflowPayload = {
  activeOrder: CourseSettingStageKey[];
  activeLabels: string[];
  chainText: string;
};

export type CourseSettingsPayload = {
  classId: string;
  className: string;
  studentCount: number;
  settings: CourseStageSetting[];
  workflow?: CourseWorkflowPayload;
};

/** 除组队外可略过的环节 */
export const SKIPPABLE_COURSE_STAGE_KEYS: CourseSettingStageKey[] = [
  'ideation',
  'market',
  'product',
  'business',
  'simulation',
  'plan',
];

export function buildWorkflowChainText(
  stages: CourseSettingStage[],
  skippedByKey: Record<string, boolean>
): string {
  return stages
    .filter((s) => s.key === 'team' || !skippedByKey[s.key])
    .map((s) => s.shortName)
    .join(' - ');
}

export const COURSE_SETTING_STAGES: CourseSettingStage[] = [
  { key: 'team', name: '团队组建与分工', shortName: '团队组建', taskName: '完成团队组建、角色分工与团队协议', icon: 'ri-team-line', color: 'from-teal-500 to-cyan-500' },
  { key: 'ideation', name: '创新思维与创意生成', shortName: '创新思维', taskName: '完成创意思维训练与创意生成', icon: 'ri-lightbulb-line', color: 'from-amber-500 to-orange-500', courseModuleKey: 'ideation' },
  { key: 'market', name: '市场调研与用户画像', shortName: '市场调研', taskName: '完成用户调研、竞品分析与用户画像', icon: 'ri-bar-chart-line', color: 'from-indigo-500 to-violet-500', courseModuleKey: 'market' },
  { key: 'product', name: '产品设计与迭代', shortName: '产品设计', taskName: '完成产品原型设计与迭代记录', icon: 'ri-pencil-ruler-line', color: 'from-pink-500 to-rose-500', courseModuleKey: 'product' },
  { key: 'business', name: '商业模式设计', shortName: '商业模式', taskName: '完成商业模式画布与盈利逻辑设计', icon: 'ri-layout-grid-line', color: 'from-green-500 to-emerald-500', courseModuleKey: 'business' },
  { key: 'simulation', name: 'AI仿真模拟', shortName: 'AI仿真', taskName: '完成 AI 仿真验证与优化建议', icon: 'ri-robot-2-line', color: 'from-cyan-500 to-sky-500', courseModuleKey: 'simulation' },
  { key: 'plan', name: '商业计划书要点', shortName: '商业计划', taskName: '完成商业计划书撰写与提交', icon: 'ri-file-text-line', color: 'from-orange-500 to-red-500', courseModuleKey: 'plan' },
];

export async function fetchCourseSettings(classId: string): Promise<CourseSettingsPayload> {
  return teacherFetch(`/api/teacher/personal-classes/${classId}/course-settings`) as Promise<CourseSettingsPayload>;
}

export async function saveCourseStageSetting(
  classId: string,
  moduleKey: CourseSettingStageKey,
  body: Pick<CourseStageSetting, 'startDate' | 'deadlineDate' | 'reminderDays' | 'reminderEnabled'>
): Promise<CourseStageSetting> {
  const data = await teacherFetch(`/api/teacher/personal-classes/${classId}/course-settings/${moduleKey}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  }) as { setting: CourseStageSetting };
  return data.setting;
}

export async function saveCourseWorkflow(
  classId: string,
  skipped: Partial<Record<CourseSettingStageKey, boolean>>
): Promise<{
  settings: CourseStageSetting[];
  workflow: CourseWorkflowPayload;
  restoredModules: string[];
  message?: string;
}> {
  const data = (await teacherFetch(`/api/teacher/personal-classes/${classId}/course-settings/workflow`, {
    method: 'PUT',
    body: JSON.stringify({ skipped }),
  })) as {
    settings: CourseStageSetting[];
    workflow: CourseWorkflowPayload;
    restoredModules: string[];
  };
  return data;
}
