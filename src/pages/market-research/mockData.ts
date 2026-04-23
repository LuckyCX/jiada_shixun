
import { ResearchPlan, Survey, AnalysisData, UserPersona } from './types';

export const defaultPlan: ResearchPlan = {
  goal: '了解校园配送市场需求，验证产品核心价值主张，分析竞争格局，为产品定位提供数据支撑。',
  methods: ['线上问卷', '用户访谈', '竞品分析'],
  members: [
    { role: '问卷设计', member: '李娜' },
    { role: '数据收集', member: '张明' },
    { role: '数据整理', member: '王强' },
    { role: '报告撰写', member: '陈雪' },
  ],
  startDate: '2024-03-01',
  endDate: '2024-03-31',
};

export const defaultSurveys: Survey[] = [
  {
    id: 'survey-001',
    title: '校园配送需求调研',
    status: '进行中',
    collected: 156,
    target: 200,
    link: 'https://survey.example.com/s/campus-delivery-001',
    createdAt: '2024-03-05',
    fromPlan: true,
    questions: [
      { id: 'q1', text: '您的年龄段', type: '单选', options: ['18岁以下', '18-22岁', '23-25岁', '25岁以上'] },
      { id: 'q2', text: '您每月在外卖上的花费', type: '单选', options: ['100元以下', '100-300元', '300-500元', '500元以上'] },
      { id: 'q3', text: '您对校园配送服务的满意度', type: '评分' },
      { id: 'q4', text: '您希望改进的方面', type: '多选', options: ['配送速度', '价格', '服务态度', '餐品质量', '配送准时性'] },
      { id: 'q5', text: '您每周点外卖的频次', type: '单选', options: ['1-2次', '3-5次', '6-10次', '10次以上'] },
      { id: 'q6', text: '您最看重配送服务的哪个方面', type: '单选', options: ['速度', '价格', '准时', '服务态度'] },
    ],
  },
  {
    id: 'survey-002',
    title: '竞品使用体验调研',
    status: '草稿',
    collected: 0,
    target: 150,
    link: 'https://survey.example.com/s/competitor-002',
    createdAt: '2024-03-10',
    questions: [
      { id: 'q1', text: '您常用的外卖平台', type: '多选', options: ['美团外卖', '饿了么', '校园跑腿', '其他'] },
      { id: 'q2', text: '您对现有平台的整体满意度', type: '评分' },
      { id: 'q3', text: '您认为现有平台最大的不足', type: '填空' },
    ],
  },
];

export const defaultAnalysisData: AnalysisData = {
  ageDistribution: [
    { label: '18-20岁', value: 45, color: '#8b5cf6' },
    { label: '21-22岁', value: 38, color: '#a78bfa' },
    { label: '23-25岁', value: 12, color: '#c4b5fd' },
    { label: '25岁以上', value: 5, color: '#ddd6fe' },
  ],
  spendingDistribution: [
    { label: '100元以下', value: 18, color: '#f59e0b' },
    { label: '100-300元', value: 52, color: '#fbbf24' },
    { label: '300-500元', value: 24, color: '#fcd34d' },
    { label: '500元以上', value: 6, color: '#fde68a' },
  ],
  satisfactionDistribution: [
    { label: '非常不满意', value: 8, color: '#ef4444' },
    { label: '不满意', value: 22, color: '#f97316' },
    { label: '一般', value: 35, color: '#eab308' },
    { label: '满意', value: 25, color: '#22c55e' },
    { label: '非常满意', value: 10, color: '#10b981' },
  ],
  improvementNeeds: [
    { label: '配送速度', value: 85 },
    { label: '价格优惠', value: 72 },
    { label: '准时送达', value: 68 },
    { label: '服务态度', value: 45 },
    { label: '餐品质量', value: 38 },
  ],
};

export const defaultPersonas: UserPersona[] = [
  {
    id: 'persona-001',
    name: '李小美',
    age: 20,
    occupation: '大二学生',
    major: '计算机科学',
    avatar: 'https://readdy.ai/api/search-image?query=professional%20portrait%20of%20young%20asian%20female%20university%20student%20with%20friendly%20smile%2C%20modern%20casual%20style%2C%20clean%20bright%20background%20with%20soft%20lighting%2C%20educational%20atmosphere&width=200&height=200&seq=persona-001&orientation=squarish',
    painPoints: ['课程安排紧凑，用餐时间不固定', '高峰期配送慢，经常错过上课时间', '配送费用较高，每月开支压力大'],
    needs: ['配送速度快，15分钟内送达', '价格实惠，配送费低于3元', '服务可靠，准时送达不出错'],
    habits: ['每周点外卖5-7次', '单次消费15-25元', '偏好使用优惠券和会员折扣'],
    borderColor: 'border-purple-200',
    accentColor: 'text-purple-500',
    fromSurvey: true,
  },
  {
    id: 'persona-002',
    name: '王大力',
    age: 22,
    occupation: '研一学生',
    major: '工商管理',
    avatar: 'https://readdy.ai/api/search-image?query=professional%20portrait%20of%20young%20asian%20male%20university%20student%20with%20confident%20expression%2C%20modern%20casual%20style%2C%20clean%20bright%20background%20with%20soft%20lighting%2C%20educational%20atmosphere&width=200&height=200&seq=persona-002&orientation=squarish',
    painPoints: ['实验室工作忙碌，无暇外出就餐', '深夜加班时餐饮选择少', '希望有健康营养的餐食选择'],
    needs: ['24小时配送服务', '餐品种类丰富，包含健康选项', '配送准确，不打扰实验工作'],
    habits: ['每周点外卖8-10次', '单次消费25-40元', '注重食品质量和营养搭配'],
    borderColor: 'border-teal-200',
    accentColor: 'text-teal-500',
    fromSurvey: true,
  },
];
