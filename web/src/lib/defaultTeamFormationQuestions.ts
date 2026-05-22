import type { TeamQuestionType } from './teamFormationApi';

/** 与 node/src/lib/defaultTeamFormationQuestions.js 保持一致（新建班级种子题） */
export type PlatformPresetDraft = {
  title: string;
  questionType: TeamQuestionType;
  options: { label: string; value: string }[];
  required: boolean;
};

const ROLE_OPTS = [
  { label: 'A. 快速权衡利弊，拍板定方向，统筹大家执行', value: 'A' },
  { label: 'B. 深入研究方案可行性，优先从产品逻辑角度判断', value: 'B' },
  { label: 'C. 重点分析市场环境、用户需求，从市场角度做选择', value: 'C' },
  { label: 'D. 侧重落地执行，思考如何把方案推广落地', value: 'D' },
  { label: 'E. 优先对接资源、拓展渠道，推进合作成交', value: 'E' },
  { label: 'F. 优先核算成本收益，把控资金风险与预算', value: 'F' },
];

const Q2_OPTS = [
  { label: 'A. 统筹安排任务，管理团队，规划整体目标', value: 'A' },
  { label: 'B. 逻辑思考、方案设计、钻研事物底层逻辑', value: 'B' },
  { label: 'C. 调研分析、洞察用户需求、挖掘市场机会', value: 'C' },
  { label: 'D. 策划活动、宣传推广、吸引他人关注', value: 'D' },
  { label: 'E. 沟通谈判、拓展人脉、促成合作交易', value: 'E' },
  { label: 'F. 数据整理、计算核算、把控细节与收支', value: 'F' },
];

const Q3_OPTS = [
  { label: 'A. 整体战略规划、对外沟通、团队管理', value: 'A' },
  { label: 'B. 产品设计、功能开发、项目可行性研究', value: 'B' },
  { label: 'C. 市场调研、竞品分析、定位定价', value: 'C' },
  { label: 'D. 线上运营、活动策划、内容宣传引流', value: 'D' },
  { label: 'E. 商务洽谈、渠道拓展、客户对接', value: 'E' },
  { label: 'F. 成本预算、盈利测算、财务风控', value: 'F' },
];

const Q4_OPTS = [
  { label: 'A. 全局判断，快速协调人员解决，把控整体进度', value: 'A' },
  { label: 'B. 分析产品 / 技术漏洞，优化项目核心方案', value: 'B' },
  { label: 'C. 排查市场问题，调整定位与推广策略', value: 'C' },
  { label: 'D. 优化宣传方式，提升引流与曝光效果', value: 'D' },
  { label: 'E. 维护客户关系，稳定合作渠道', value: 'E' },
  { label: 'F. 核算损失，调整预算，规避资金风险', value: 'F' },
];

const Q5_OPTS = [
  { label: 'A. 总负责人，统筹全局，做最终决策者', value: 'A' },
  { label: 'B. 核心设计者，打磨项目核心产品', value: 'B' },
  { label: 'C. 市场方向制定者，规划推广策略', value: 'C' },
  { label: 'D. 落地执行者，负责推广运营工作', value: 'D' },
  { label: 'E. 商务开拓者，负责营收转化', value: 'E' },
  { label: 'F. 资金管控者，负责财务规划', value: 'F' },
];

const Q6_OPTS = [
  { label: 'A. 不太感兴趣，擅长统筹管理', value: 'A' },
  { label: 'B. 非常感兴趣，愿意钻研产品技术', value: 'B' },
  { label: 'C. 一般，更关注市场用户', value: 'C' },
  { label: 'D. 一般，侧重宣传运营', value: 'D' },
  { label: 'E. 一般，侧重沟通销售', value: 'E' },
  { label: 'F. 一般，侧重数据财务', value: 'F' },
];

const MULTI_TRAITS = [
  { label: 'A. 领导力、统筹规划、决策能力', value: 'A' },
  { label: 'B. 逻辑思维、产品设计、问题拆解能力', value: 'B' },
  { label: 'C. 市场洞察、数据分析、用户调研能力', value: 'C' },
  { label: 'D. 创意策划、文案宣传、运营引流能力', value: 'D' },
  { label: 'E. 沟通谈判、人脉拓展、商务成交能力', value: 'E' },
  { label: 'F. 细心严谨、成本核算、风险把控能力', value: 'F' },
];

const MULTI_WORK = [
  { label: 'A. 制定项目方向、管理团队、对外对接', value: 'A' },
  { label: 'B. 产品功能设计、竞品分析、项目打磨', value: 'B' },
  { label: 'C. 市场调研、用户画像、定价定位', value: 'C' },
  { label: 'D. 活动策划、新媒体运营、内容推广', value: 'D' },
  { label: 'E. 客户洽谈、渠道拓展、订单成交', value: 'E' },
  { label: 'F. 成本核算、预算规划、投融资分析', value: 'F' },
];

const MULTI_DIM = [
  { label: 'A. 整体发展方向、团队管理、最终成果', value: 'A' },
  { label: 'B. 产品核心竞争力、技术可行性', value: 'B' },
  { label: 'C. 市场规模、用户需求、竞争环境', value: 'C' },
  { label: 'D. 品牌曝光、用户流量、推广效果', value: 'D' },
  { label: 'E. 客户资源、合作渠道、实际营收', value: 'E' },
  { label: 'F. 资金流向、盈利状况、财务风险', value: 'F' },
];

const PLATFORM_PRESET_QUESTIONS: PlatformPresetDraft[] = [
  { title: '面对团队分歧、重大决策时，你更倾向于？', questionType: 'single', options: ROLE_OPTS, required: true },
  { title: '日常学习中，你最擅长的事是？', questionType: 'single', options: Q2_OPTS, required: true },
  { title: '你更愿意主导哪类工作？', questionType: 'single', options: Q3_OPTS, required: true },
  { title: '遇到项目突发问题，你的第一反应是？', questionType: 'single', options: Q4_OPTS, required: true },
  { title: '对于团队分工，你希望自己是？', questionType: 'single', options: Q5_OPTS, required: true },
  { title: '你对编程、技术、产品开发的兴趣程度？', questionType: 'single', options: Q6_OPTS, required: true },
  { title: '你具备哪些能力特质？（可多选）', questionType: 'multi', options: MULTI_TRAITS, required: true },
  { title: '你愿意参与的创业工作有哪些？（可多选）', questionType: 'multi', options: MULTI_WORK, required: true },
  { title: '你更关注项目的哪些维度？（可多选）', questionType: 'multi', options: MULTI_DIM, required: true },
  {
    title: '简单描述：你认为自己在创业团队中，最擅长做什么？最想负责哪部分工作？',
    questionType: 'short',
    options: [],
    required: true,
  },
];

function clonePreset(q: PlatformPresetDraft): PlatformPresetDraft {
  return {
    title: q.title,
    questionType: q.questionType,
    required: q.required,
    options: q.options.map((o) => ({ ...o })),
  };
}

/** 第 index 题（0-based）的平台预设，超出范围返回 null */
export function getPlatformPresetDraft(index: number): PlatformPresetDraft | null {
  const q = PLATFORM_PRESET_QUESTIONS[index];
  return q ? clonePreset(q) : null;
}

export function getAllPlatformPresetDrafts(): PlatformPresetDraft[] {
  return PLATFORM_PRESET_QUESTIONS.map(clonePreset);
}
