
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { USER_GUIDE_PATH } from '../../lib/appPaths';

/** 与教师工作台 URL ?tab= 保持一致 */
type DashboardTab =
  | 'classManagement'
  | 'monitor'
  | 'guidance'
  | 'teamReview'
  | 'topicReview'
  | 'businessPlanReview'
  | 'courseSettings';

function dashboardHref(tab: DashboardTab, classId?: string) {
  const params = new URLSearchParams();
  if (tab !== 'monitor') params.set('tab', tab);
  if (classId) params.set('classId', classId);
  const q = params.toString();
  return q ? `/teacher-dashboard?${q}` : '/teacher-dashboard';
}

interface GuideSection {
  id: string;
  title: string;
  icon: string;
  color: string;
  description: string;
  dashboardTab: DashboardTab;
  needsClass?: boolean;
  ctaLabel: string;
  steps: { title: string; desc: string; icon: string }[];
  tips: string[];
}

const sections: GuideSection[] = [
  {
    id: 'overview',
    title: '工作台与班级',
    icon: 'ri-dashboard-3-line',
    color: 'from-teal-500 to-cyan-500',
    description: '熟悉教师工作台布局，管理教学班与学生名册',
    dashboardTab: 'classManagement',
    ctaLabel: '打开班级管理',
    steps: [
      { title: '登录教师工作台', desc: '使用教师账号登录后进入教师工作台', icon: 'ri-login-box-line' },
      {
        title: '认识侧栏功能分组',
        desc: '侧栏按「班级与学生」「课程建设」「教学监控」「任务与审核」分组，与日常操作路径一致',
        icon: 'ri-layout-left-line',
      },
      {
        title: '选择教学班',
        desc: '动态引导、组队管理、选题与计划书审核、课程设置等需先在右上角选择当前教学班',
        icon: 'ri-building-4-line',
      },
      {
        title: '管理学生名册',
        desc: '在班级管理中进入某班，可查看与维护该班学生名单',
        icon: 'ri-group-line',
      },
    ],
    tips: [
      '未选班级时，部分页会提示「请先在右上角选择班级」',
      '监控页可不选班查看全局团队列表；与班级强相关的功能务必先选班',
    ],
  },
  {
    id: 'monitor',
    title: '全局项目监控',
    icon: 'ri-radar-line',
    color: 'from-indigo-500 to-purple-500',
    description: '查看各团队实训进度与风险状态，从监控页快速发起教学干预',
    dashboardTab: 'monitor',
    ctaLabel: '打开项目监控',
    steps: [
      { title: '筛选与搜索', desc: '按状态、关键词筛选团队，快速定位需关注的项目', icon: 'ri-filter-3-line' },
      { title: '查看团队详情', desc: '点击团队卡片打开详情，查看成员与各阶段进展', icon: 'ri-file-info-line' },
      { title: '识别预警团队', desc: '通过状态标签区分正常、预警、滞后等团队', icon: 'ri-alarm-warning-line' },
      {
        title: '立即干预',
        desc: '对需关注的团队使用「立即干预」，将跳转至动态引导工具并预选该小组',
        icon: 'ri-hand-heart-line',
      },
    ],
    tips: [
      '右侧统计面板可概览班级团队数量与进度分布',
      '干预前建议先查看团队详情，再选择通知、督促或实训任务等方式',
    ],
  },
  {
    id: 'guidance',
    title: '动态引导工具',
    icon: 'ri-compass-3-line',
    color: 'from-green-500 to-emerald-500',
    description: '发送通知与督促、推送资源、发布实训任务，并在历史记录中跟踪与回收',
    dashboardTab: 'guidance',
    needsClass: true,
    ctaLabel: '打开动态引导工具',
    steps: [
      {
        title: '发送引导（五种方式）',
        desc: '支持全员通知、一对一引导、学习资源推送、学习督促、实训任务发布；可面向全班、指定小组或学生',
        icon: 'ri-megaphone-line',
      },
      {
        title: '学习督促与补学截止',
        desc: '督促类型可设置补学截止时间；学生端将收到提醒，历史记录中可按状态筛选已过期记录',
        icon: 'ri-alarm-line',
      },
      {
        title: '发布实训任务',
        desc: '设置模块、截止时间、优先级；可上传教师附件（支持多选）；可开启学生查看附件、要求学生提交反馈附件',
        icon: 'ri-task-line',
      },
      {
        title: '效果统计与历史记录',
        desc: '效果统计查看引导触达与任务概况；历史记录合并展示引导消息与实训任务，支持撤回、删除（过期项删除前会先撤回学生端展示）',
        icon: 'ri-history-line',
      },
      {
        title: '查看任务提交情况',
        desc: '历史记录中实训任务可查看是否要求反馈附件、提交进度；要求反馈时可通过「详情」查看学生提交与附件下载',
        icon: 'ri-file-upload-line',
      },
    ],
    tips: [
      '资源推送发送时可附带附件，学生在学生中心通知中查看与下载',
      '学生需完成对应实践课程小节进度及知识点检测后，方可进行实训任务（学生端「去完成」在未达标时不会打开任务弹窗）',
      '要求反馈附件的任务，建议在历史记录中定期查看提交进度与详情',
    ],
  },
  {
    id: 'review',
    title: '组队与成果审核',
    icon: 'ri-team-line',
    color: 'from-red-500 to-rose-500',
    description: '管理组队流程，审核选题方案与商业计划书等阶段成果',
    dashboardTab: 'teamReview',
    needsClass: true,
    ctaLabel: '打开组队管理',
    steps: [
      { title: '组队管理', desc: '查看与处理本班团队组建情况，可按教学需要配置组队预设题目', icon: 'ri-team-line' },
      { title: '选题审核', desc: '在「选题审核」中查看学生提交的选题方案并给出审核意见', icon: 'ri-file-search-line' },
      {
        title: '商业计划书审核',
        desc: '在「商业计划书审核」中评阅学生提交的计划书内容',
        icon: 'ri-file-chart-line',
      },
      { title: '与学生引导配合', desc: '审核中发现共性问题，可通过动态引导工具发送通知或督促', icon: 'ri-links-line' },
    ],
    tips: [
      '组队预设题可在组队管理相关配置页维护（需先选择教学班）',
      '审核意见应具体明确，便于学生修改后再次提交',
    ],
  },
  {
    id: 'course-settings',
    title: '课程设置',
    icon: 'ri-book-open-line',
    color: 'from-violet-500 to-purple-500',
    description: '配置与本班相关的课程与实训环节设置，支撑学生端学习路径',
    dashboardTab: 'courseSettings',
    needsClass: true,
    ctaLabel: '打开课程设置',
    steps: [
      { title: '进入课程设置', desc: '在工作台侧栏「课程建设」中打开课程设置（请先选择教学班）', icon: 'ri-settings-3-line' },
      { title: '配置教学班级参数', desc: '按课程要求维护班级维度的配置项，与学生可见的实训环节衔接', icon: 'ri-slideshow-line' },
      {
        title: '与实训任务配合',
        desc: '课程学习进度与检测达标后，学生方可正常进行对应模块的实训任务',
        icon: 'ri-git-merge-line',
      },
      {
        title: '平台级资源维护',
        desc: '全校级知识点、案例库等平台资源由管理员在管理后台维护，教师以本班设置与发布任务为主',
        icon: 'ri-admin-line',
      },
    ],
    tips: [
      '修改课程设置后，提醒学生刷新学生中心查看更新',
      '实训任务模块名称需与课程环节一致，避免学生找不到对应任务',
    ],
  },
];

const faqs = [
  {
    q: '如何从零开始组织一次实训？',
    a: '建议按顺序完成：① 在「班级管理」中创建个性化教学班；② 添加学生（可按学院、专业、行政班筛选，支持跨学院、跨专业组班）；③ 在「课程设置」中为各实训阶段配置开始、截止时间；④ 在「组队管理」中确认组队预设问题（系统已预置题目，请按班级实际调试）；⑤ 阶段开放后，在「全局项目监控」与「动态引导工具」中跟进进度、发布任务与干预。若某阶段配置了实践课程与知识点，学生须先完成课程学习与知识点检测，再进入该阶段实训。',
  },
  {
    q: '如何创建个性化教学班并添加学生？',
    a: '进入教师工作台「班级管理」，新建个性化教学班并填写基本信息。通过「添加学生」按学院、专业、行政班浏览学生池，将学生加入本班；可多次切换不同行政班来源，把不同学院、专业的学生纳入同一教学班。保存名册后，请在右上角选择该班再使用引导、组队、审核等功能。',
  },
  {
    q: '课程设置中的阶段时间有什么作用？',
    a: '在「课程设置」（需先选教学班）中为各实训阶段设置开始时间与截止时间。未到开始时间，学生端对应阶段处于未开放状态；超过截止时间后，阶段按规则结束或受限。请与校历、教学周次对齐，避免学生因时间未开放而无法操作。',
  },
  {
    q: '学生何时才能开始某一阶段的实训？',
    a: '需同时满足：该阶段已在课程设置中到达开始时间且未过截止安排；若该阶段维护了实践课程资源并配置了知识点，学生还须在学生中心完成相应小节学习进度与知识点检测（与发布实训任务时的门槛一致），之后方可进行该阶段组队、任务与环节实训。教师可在「动态引导工具」发布实训任务前，提醒学生先完成课程学习。',
  },
  {
    q: '组队预设问题如何设置，为什么要认真维护？',
    a: '在「组队管理」中进入组队问题预设。预设题用于学生首次进入组队流程时作答，系统结合回答进行 AI 分析，推荐适合的团队角色。题目表述不清会导致角色匹配偏差，影响后续分工。平台已提供预置问题，请按本班教学目标逐题审阅、修改与试答后再让学生使用。',
  },
  {
    q: '为什么提示「请先在右上角选择班级」？',
    a: '动态引导工具、组队管理、选题审核、商业计划书审核、课程设置等按教学班运行。请先在教师工作台右上角选择当前要管理的班级。',
  },
  {
    q: '监控页如何快速干预某个团队？',
    a: '在全局项目监控中找到该团队，使用「立即干预」，系统会跳转到动态引导工具并预选该小组，您再选择通知、督促或发布实训任务等方式即可。',
  },
  {
    q: '引导消息和实训任务有什么区别？',
    a: '引导消息（通知、一对一、资源、督促）侧重提醒与资料送达，记录在引导历史中。实训任务有明确截止时间、完成要求，可要求学生上传反馈附件，并在历史记录中查看提交进度与详情。',
  },
  {
    q: '历史记录里过期或已撤回的内容如何处理？',
    a: '已发送的引导可撤回，学生端不再展示。已过期任务或补学截止时间已过的督促，可删除；删除前系统会先撤回学生端展示，再移除记录与相关附件。',
  },
  {
    q: '在哪里查看学生是否提交了任务反馈附件？',
    a: '在动态引导工具「历史记录」中找到对应实训任务。若开启了「要求学生反馈附件」，会显示是否要求反馈、提交进度；点击「详情」可查看每位学生的完成状态与附件（与任务管理中的提交详情一致）。',
  },
  {
    q: '学生说点「去完成」没有反应，可能是什么原因？',
    a: '学生需先完成该实训模块对应实践课程的小节学习进度及知识点检测，达标后才会打开任务详情。请引导学生先在学生中心完成课程学习，再提交实训任务。',
  },
];

const workflowSteps = [
  { step: '01', title: '班级与课程', desc: '建班、选班，完成课程设置', icon: 'ri-building-4-line', color: 'from-teal-500 to-cyan-500' },
  { step: '02', title: '进度监控', desc: '查看团队状态，识别预警', icon: 'ri-radar-line', color: 'from-indigo-500 to-purple-500' },
  { step: '03', title: '组队与审核', desc: '组队管理，审核选题与计划书', icon: 'ri-team-line', color: 'from-rose-500 to-red-500' },
  { step: '04', title: '引导与任务', desc: '通知、督促、资源推送与实训任务', icon: 'ri-compass-3-line', color: 'from-green-500 to-emerald-500' },
  { step: '05', title: '跟踪闭环', desc: '历史记录查看提交，必要时干预', icon: 'ri-history-line', color: 'from-violet-500 to-purple-500' },
];

export default function TeacherGuidePage() {
  const [activeSection, setActiveSection] = useState('overview');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const current = sections.find((s) => s.id === activeSection) || sections[0];
  const primaryHref = dashboardHref(current.dashboardTab);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/30 to-cyan-50/20">
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">教学指南</h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            按教师工作台实际功能说明操作路径，覆盖监控、引导、实训任务、审核与课程设置
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-10">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveSection(s.id)}
              className={`p-4 rounded-2xl border-2 transition-all text-left cursor-pointer ${
                activeSection === s.id
                  ? 'border-teal-500 bg-white shadow-md'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center mb-3`}>
                <i className={`${s.icon} text-white text-lg`}></i>
              </div>
              <p className={`text-xs font-bold leading-tight ${activeSection === s.id ? 'text-teal-700' : 'text-gray-700'}`}>
                {s.title}
              </p>
            </button>
          ))}
        </div>

        <div className="bg-white rounded-3xl shadow-xl overflow-hidden mb-10">
          <div className={`bg-gradient-to-r ${current.color} p-8 text-white`}>
            <div className="flex items-center gap-5 mb-4">
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                <i className={`${current.icon} text-4xl`}></i>
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-1">{current.title}</h2>
                <p className="text-white/90 text-sm leading-relaxed">{current.description}</p>
                {current.needsClass && (
                  <p className="text-white/80 text-xs mt-2">使用前请在工作台右上角选择教学班</p>
                )}
              </div>
            </div>
            <Link
              to={primaryHref}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-gray-900 text-sm font-semibold hover:shadow-lg transition-all whitespace-nowrap"
            >
              <span>{current.ctaLabel}</span>
              <i className="ri-arrow-right-line"></i>
            </Link>
          </div>

          <div className="grid lg:grid-cols-2 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
            <div className="p-8">
              <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                <i className="ri-route-line text-teal-500"></i>
                操作步骤
              </h3>
              <div className="space-y-5">
                {current.steps.map((step, i) => (
                  <div key={i} className="flex gap-4">
                    <div
                      className={`w-10 h-10 rounded-xl bg-gradient-to-br ${current.color} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}
                    >
                      {i + 1}
                    </div>
                    <div className="flex-1 pt-1">
                      <div className="flex items-center gap-2 mb-1">
                        <i className={`${step.icon} text-slate-400 text-base`}></i>
                        <h4 className="text-sm font-bold text-gray-900">{step.title}</h4>
                      </div>
                      <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-8">
              <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                <i className="ri-lightbulb-flash-line text-amber-500"></i>
                教学技巧
              </h3>
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-5 border border-amber-100 mb-6">
                <ul className="space-y-4">
                  {current.tips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <i className="ri-checkbox-circle-fill text-amber-500 text-lg flex-shrink-0 mt-0.5"></i>
                      <span className="text-sm text-gray-700 leading-relaxed">{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <i className="ri-compass-3-line text-teal-500"></i>
                  快速跳转
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    to={dashboardHref('monitor')}
                    className="flex items-center gap-2 p-3 rounded-xl bg-white border border-slate-200 hover:border-teal-400 hover:shadow-sm transition-all group cursor-pointer"
                  >
                    <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500">
                      <i className="ri-radar-line text-white text-xs"></i>
                    </div>
                    <span className="text-xs font-medium text-gray-700 group-hover:text-teal-600 transition-colors">项目监控</span>
                  </Link>
                  <Link
                    to={dashboardHref('guidance')}
                    className="flex items-center gap-2 p-3 rounded-xl bg-white border border-slate-200 hover:border-teal-400 hover:shadow-sm transition-all group cursor-pointer"
                  >
                    <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-emerald-500">
                      <i className="ri-compass-3-line text-white text-xs"></i>
                    </div>
                    <span className="text-xs font-medium text-gray-700 group-hover:text-teal-600 transition-colors">动态引导</span>
                  </Link>
                  <Link
                    to={dashboardHref('teamReview')}
                    className="flex items-center gap-2 p-3 rounded-xl bg-white border border-slate-200 hover:border-rose-400 hover:shadow-sm transition-all group cursor-pointer"
                  >
                    <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-gradient-to-br from-red-500 to-rose-500">
                      <i className="ri-team-line text-white text-xs"></i>
                    </div>
                    <span className="text-xs font-medium text-gray-700 group-hover:text-rose-600 transition-colors">组队管理</span>
                  </Link>
                  <Link
                    to={dashboardHref('topicReview')}
                    className="flex items-center gap-2 p-3 rounded-xl bg-white border border-slate-200 hover:border-rose-400 hover:shadow-sm transition-all group cursor-pointer"
                  >
                    <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-500">
                      <i className="ri-file-search-line text-white text-xs"></i>
                    </div>
                    <span className="text-xs font-medium text-gray-700 group-hover:text-orange-600 transition-colors">选题审核</span>
                  </Link>
                  <Link
                    to={dashboardHref('classManagement')}
                    className="flex items-center gap-2 p-3 rounded-xl bg-white border border-slate-200 hover:border-teal-400 hover:shadow-sm transition-all group cursor-pointer"
                  >
                    <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-cyan-500">
                      <i className="ri-building-4-line text-white text-xs"></i>
                    </div>
                    <span className="text-xs font-medium text-gray-700 group-hover:text-teal-600 transition-colors">班级管理</span>
                  </Link>
                  <Link
                    to={USER_GUIDE_PATH}
                    className="flex items-center gap-2 p-3 rounded-xl bg-white border border-slate-200 hover:border-orange-400 hover:shadow-sm transition-all group cursor-pointer"
                  >
                    <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-500">
                      <i className="ri-graduation-cap-line text-white text-xs"></i>
                    </div>
                    <span className="text-xs font-medium text-gray-700 group-hover:text-orange-600 transition-colors">学生指南</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-8 mb-10">
          <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            <i className="ri-flow-chart text-teal-500 text-2xl"></i>
            教学管理全流程
          </h3>
          <p className="text-sm text-gray-500 mb-8">建议按班级教学节奏依次推进</p>
          <div className="relative">
            <div className="absolute top-8 left-8 right-8 h-0.5 bg-gradient-to-r from-teal-200 via-indigo-200 to-violet-200 hidden lg:block"></div>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 relative">
              {workflowSteps.map((item) => (
                <div
                  key={item.step}
                  className="relative bg-slate-50 rounded-2xl p-5 border border-slate-100 hover:shadow-md transition-all"
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-3 mx-auto`}>
                    <i className={`${item.icon} text-white text-xl`}></i>
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-bold text-slate-400 mb-1">{item.step}</div>
                    <h4 className="text-sm font-bold text-gray-900 mb-2">{item.title}</h4>
                    <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-3xl p-8 border border-teal-100 mb-10">
          <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <i className="ri-question-answer-line text-teal-600 text-2xl"></i>
            常见问题
          </h3>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl overflow-hidden border border-teal-100 cursor-pointer"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <div className="flex items-center justify-between px-6 py-4">
                  <span className="text-sm font-bold text-gray-900">{faq.q}</span>
                  <i
                    className={`ri-arrow-down-s-line text-xl text-gray-400 transition-transform flex-shrink-0 ml-4 ${openFaq === i ? 'rotate-180' : ''}`}
                  ></i>
                </div>
                {openFaq === i && (
                  <div className="px-6 pb-5">
                    <p className="text-sm text-gray-600 leading-relaxed border-t border-slate-100 pt-4">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
