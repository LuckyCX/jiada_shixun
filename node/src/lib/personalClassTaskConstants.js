export const TASK_MODULES = [
  '创新思维与创意生成',
  '市场调研与用户画像',
  '产品设计与迭代',
  '商业模式设计',
  'AI仿真模拟',
  '商业计划书要点',
];

export const TASK_PRIORITIES = ['urgent', 'high', 'normal', 'low'];

export const MAX_TASK_ATTACHMENTS = 5;
export const MAX_TASK_ATTACHMENT_BYTES = 100 * 1024 * 1024;

/** 教师发布任务模块名 → 学生实训进度 moduleId */
export const TASK_MODULE_TO_TRAINING_ID = {
  创新思维与创意生成: 'ideation',
  市场调研与用户画像: 'market',
  产品设计与迭代: 'product',
  商业模式设计: 'business',
  AI仿真模拟: 'simulation',
  商业计划书要点: 'plan',
};
