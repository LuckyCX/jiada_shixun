import { SHARED_COURSE_CHAPTERS } from '../../../../mocks/courseChapters';

const totalChapters = SHARED_COURSE_CHAPTERS.length;
const totalSections = SHARED_COURSE_CHAPTERS.reduce((sum, ch) => sum + ch.sections.length, 0);
const publishedSections = SHARED_COURSE_CHAPTERS.reduce((sum, ch) => sum + ch.sections.filter(s => s.published).length, 0);
const totalResources = SHARED_COURSE_CHAPTERS.reduce(
  (sum, ch) => sum + ch.sections.reduce((s2, sec) => s2 + sec.resources.length, 0), 0
);

export const overviewStats = [
  {
    label: '学生总数',
    value: '2,847',
    icon: 'ri-user-line',
    iconColor: 'text-teal-500',
    bgColor: 'bg-teal-50',
    trend: '+12%'
  },
  {
    label: '教师总数',
    value: '156',
    icon: 'ri-user-star-line',
    iconColor: 'text-indigo-500',
    bgColor: 'bg-indigo-50',
    trend: '+5%'
  },
  {
    label: '班级总数',
    value: '67',
    icon: 'ri-group-line',
    iconColor: 'text-green-500',
    bgColor: 'bg-green-50',
    trend: '+3%'
  },
  {
    label: '活跃团队',
    value: '342',
    icon: 'ri-team-line',
    iconColor: 'text-orange-500',
    bgColor: 'bg-orange-50',
    trend: '+18%'
  },
  {
    label: '课程章节',
    value: String(totalChapters),
    icon: 'ri-book-2-line',
    iconColor: 'text-amber-500',
    bgColor: 'bg-amber-50',
    trend: null
  },
  {
    label: '已发布小节',
    value: `${publishedSections}/${totalSections}`,
    icon: 'ri-checkbox-circle-line',
    iconColor: 'text-emerald-500',
    bgColor: 'bg-emerald-50',
    trend: null
  },
  {
    label: '课件资源',
    value: String(totalResources),
    icon: 'ri-folder-open-line',
    iconColor: 'text-rose-500',
    bgColor: 'bg-rose-50',
    trend: null
  },
  {
    label: '本月新增用户',
    value: '428',
    icon: 'ri-user-add-line',
    iconColor: 'text-pink-500',
    bgColor: 'bg-pink-50',
    trend: '+24%'
  }
];

export const activityTrends = {
  '7days': [
    { date: '12/15', value: 1245 },
    { date: '12/16', value: 1389 },
    { date: '12/17', value: 1567 },
    { date: '12/18', value: 1423 },
    { date: '12/19', value: 1678 },
    { date: '12/20', value: 1834 },
    { date: '12/21', value: 1956 }
  ],
  '30days': [
    { date: '11/22', value: 1123 },
    { date: '11/27', value: 1245 },
    { date: '12/02', value: 1389 },
    { date: '12/07', value: 1567 },
    { date: '12/12', value: 1678 },
    { date: '12/17', value: 1834 },
    { date: '12/21', value: 1956 }
  ]
};

export const courseCompletionStats = [
  {
    name: '创新创业基础',
    completed: 245,
    total: 280,
    rate: 88
  },
  {
    name: '商业模式设计',
    completed: 189,
    total: 250,
    rate: 76
  },
  {
    name: '市场调研方法',
    completed: 156,
    total: 220,
    rate: 71
  },
  {
    name: '产品设计思维',
    completed: 198,
    total: 300,
    rate: 66
  },
  {
    name: '商业计划书撰写',
    completed: 134,
    total: 280,
    rate: 48
  }
];

export const recentOperations = [
  {
    action: '新增学生账号 50 个',
    operator: '管理员张老师',
    time: '2分钟前',
    icon: 'ri-user-add-line',
    iconColor: 'text-blue-500',
    bgColor: 'bg-blue-50'
  },
  {
    action: '创建班级"软件工程2024级1班"',
    operator: '管理员李老师',
    time: '15分钟前',
    icon: 'ri-team-line',
    iconColor: 'text-purple-500',
    bgColor: 'bg-purple-50'
  },
  {
    action: '审核通过课程资源 3 个',
    operator: '管理员王老师',
    time: '1小时前',
    icon: 'ri-checkbox-circle-line',
    iconColor: 'text-green-500',
    bgColor: 'bg-green-50'
  },
  {
    action: '指派教师"陈教授"到"创新创业基础"课程',
    operator: '管理员张老师',
    time: '2小时前',
    icon: 'ri-user-star-line',
    iconColor: 'text-orange-500',
    bgColor: 'bg-orange-50'
  },
  {
    action: '删除过期课程资源 8 个',
    operator: '系统自动',
    time: '3小时前',
    icon: 'ri-delete-bin-line',
    iconColor: 'text-red-500',
    bgColor: 'bg-red-50'
  },
  {
    action: '批量导入学生名单 120 人',
    operator: '管理员李老师',
    time: '5小时前',
    icon: 'ri-file-upload-line',
    iconColor: 'text-teal-500',
    bgColor: 'bg-teal-50'
  },
  {
    action: '修改班级"计算机科学2023级2班"信息',
    operator: '管理员王老师',
    time: '昨天 18:30',
    icon: 'ri-edit-line',
    iconColor: 'text-yellow-500',
    bgColor: 'bg-yellow-50'
  },
  {
    action: '新增教师账号"刘教授"',
    operator: '管理员张老师',
    time: '昨天 16:45',
    icon: 'ri-user-add-line',
    iconColor: 'text-blue-500',
    bgColor: 'bg-blue-50'
  },
  {
    action: '发布系统公告"期末考试安排通知"',
    operator: '管理员李老师',
    time: '昨天 14:20',
    icon: 'ri-notification-line',
    iconColor: 'text-pink-500',
    bgColor: 'bg-pink-50'
  },
  {
    action: '备份系统数据',
    operator: '系统自动',
    time: '昨天 02:00',
    icon: 'ri-database-2-line',
    iconColor: 'text-gray-500',
    bgColor: 'bg-gray-50'
  }
];

// 全平台实训进度统计
export const trainingProgressStats = {
  totalTeams: 342,
  activeTeams: 298,
  completedTeams: 87,
  avgProgress: 64,
};

export const moduleCompletionRates = [
  { module: '市场调研', icon: 'ri-search-eye-line', color: 'text-teal-500', bg: 'bg-teal-50', bar: 'bg-teal-500', completed: 276, total: 342, rate: 81 },
  { module: '创意构思', icon: 'ri-lightbulb-line', color: 'text-yellow-500', bg: 'bg-yellow-50', bar: 'bg-yellow-500', completed: 261, total: 342, rate: 76 },
  { module: '产品设计', icon: 'ri-pencil-ruler-2-line', color: 'text-orange-500', bg: 'bg-orange-50', bar: 'bg-orange-500', completed: 234, total: 342, rate: 68 },
  { module: '商业模式', icon: 'ri-building-2-line', color: 'text-indigo-500', bg: 'bg-indigo-50', bar: 'bg-indigo-500', completed: 198, total: 342, rate: 58 },
  { module: '商业计划书', icon: 'ri-file-text-line', color: 'text-pink-500', bg: 'bg-pink-50', bar: 'bg-pink-500', completed: 156, total: 342, rate: 46 },
  { module: 'AI验证', icon: 'ri-robot-line', color: 'text-green-500', bg: 'bg-green-50', bar: 'bg-green-500', completed: 134, total: 342, rate: 39 },
];

export const teamProgressDistribution = [
  { label: '未开始', range: '0%', count: 44, color: 'bg-gray-300', textColor: 'text-gray-500' },
  { label: '初级阶段', range: '1–30%', count: 68, color: 'bg-red-400', textColor: 'text-red-500' },
  { label: '进行中', range: '31–60%', count: 95, color: 'bg-yellow-400', textColor: 'text-yellow-600' },
  { label: '接近完成', range: '61–90%', count: 88, color: 'bg-teal-400', textColor: 'text-teal-600' },
  { label: '已完成', range: '91–100%', count: 47, color: 'bg-green-500', textColor: 'text-green-600' },
];