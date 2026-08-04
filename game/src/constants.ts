export const TILE = 32;
export const MAP_W = 80;
export const MAP_H = 60;
export const SAVE_VERSION = 1;
export const SAVE_KEY = 'chuangxiang-town-sandbox-v1';
export const MIN_VIEWPORT_WIDTH = 1280;

export type StageId =
  | 'team'
  | 'ideation'
  | 'research'
  | 'product'
  | 'bmc'
  | 'sim'
  | 'plan';

export const STAGE_ORDER: StageId[] = [
  'team',
  'ideation',
  'research',
  'product',
  'bmc',
  'sim',
  'plan',
];

export const STAGE_LABELS: Record<StageId, string> = {
  team: '组队',
  ideation: '创意',
  research: '调研',
  product: '产品',
  bmc: '商业模式',
  sim: '仿真',
  plan: '计划书',
};

export const STAGE_MODULE_LINKS: Record<StageId, string> = {
  team: '/student-center?tab=module-team',
  ideation: '/student-center?tab=module-ideation',
  research: '/student-center?tab=module-market',
  product: '/student-center?tab=module-product',
  bmc: '/student-center?tab=module-business',
  sim: '/student-center?tab=module-simulation',
  plan: '/student-center?tab=module-plan',
};
