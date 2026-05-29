import { useState } from 'react';
import { Link } from 'react-router-dom';
import { COURSE_GATE_PERCENT } from '../../lib/trainingModulePrerequisite';

interface GuideStep {
  title: string;
  description: string;
  icon: string;
}

interface GuideSection {
  id: string;
  title: string;
  icon: string;
  color: string;
  description: string;
  studentTab?: string;
  ctaLabel: string;
  steps: GuideStep[];
  tips: string[];
}

export type UserGuideContentProps = {
  /** 学生工作台内嵌：无顶栏、收紧版式、隐藏页尾引导 */
  embedded?: boolean;
};

function studentCenterHref(tab?: string, extra?: Record<string, string>) {
  const p = new URLSearchParams();
  if (tab && tab !== 'overview') p.set('tab', tab);
  Object.entries(extra || {}).forEach(([k, v]) => {
    if (v) p.set(k, v);
  });
  const q = p.toString();
  return q ? `/student-center?${q}` : '/student-center';
}

const sections: GuideSection[] = [
  {
    id: 'start',
    title: '登录与班级',
    icon: 'ri-login-circle-line',
    color: 'from-blue-500 to-indigo-500',
    description: '登录学生工作台，选择当前教学班，了解班级未开放时的提示',
    studentTab: 'overview',
    ctaLabel: '进入学生工作台',
    steps: [
      {
        title: '学生账号登录',
        description: '使用学校分配的学生账号登录；登录后进入学生工作台（需已加入教师创建的个性化教学班）。',
        icon: 'ri-login-box-line',
      },
      {
        title: '未加入班级或暂未开放',
        description:
          '若尚未被教师加入任何教学班，将无法开展完整实训。若已加入但提示「班级暂未开放」，多为未到教师设置的团队组建或阶段开始时间，请查看提示说明或联系任课教师。',
        icon: 'ri-error-warning-line',
      },
      {
        title: '切换教学班',
        description:
          '若同时加入多个教学班，请在页面右上角班级切换器中选择当前要学习的班级。通知、待办、课程设置与实训进度均按当前选中班级加载，系统会记住上次选择。',
        icon: 'ri-exchange-line',
      },
    ],
    tips: [
      '切换班级前请确认该班已开放实训（切换器中未禁用的班级）',
      '个人中心可查看已加入的教学班与教师信息',
    ],
  },
  {
    id: 'overview',
    title: '进度看板',
    icon: 'ri-dashboard-line',
    color: 'from-teal-500 to-cyan-500',
    description: '在进度看板查看项目进展、通知与教师发布的待办任务',
    studentTab: 'overview',
    ctaLabel: '打开进度看板',
    steps: [
      {
        title: '整体进度',
        description: '进度看板展示当前团队项目、整体完成度与阶段进展，便于把握实训节奏。',
        icon: 'ri-pie-chart-line',
      },
      {
        title: '通知',
        description:
          '教师发送的全员通知、学习督促、资源推送及系统消息集中在此。可标记已读、查看详情；与任务相关的通知可跳转到待办列表处理。',
        icon: 'ri-notification-3-line',
      },
      {
        title: '待办任务',
        description:
          '教师发布的实训任务显示在「任务」列表，含截止时间、优先级与附件。需按要求完成；达标后可提交反馈附件并标记完成。',
        icon: 'ri-task-line',
      },
    ],
    tips: [
      '通知侧重告知与提醒；待办任务侧重需要你完成并提交的成果',
      '紧急任务会突出显示，请优先处理临近截止的待办',
    ],
  },
  {
    id: 'knowledge',
    title: '实践课程与检测',
    icon: 'ri-book-2-line',
    color: 'from-green-500 to-emerald-500',
    description: '学习实践课程资源，完成知识点检测，为实训环节做准备',
    studentTab: 'knowledge',
    ctaLabel: '打开实践课程',
    steps: [
      {
        title: '学习课程资源',
        description: '在侧栏进入「实践课程」，按章节学习教师配置的视频、文档等资源，系统记录各小节学习进度。',
        icon: 'ri-play-circle-line',
      },
      {
        title: '知识点检测',
        description: `配置了知识点的章节，需将对应小节学习进度达到约 ${COURSE_GATE_PERCENT}% 后，方可开始知识点检测。未达标时系统会提示先完成课程学习。`,
        icon: 'ri-questionnaire-line',
      },
      {
        title: '与实训的关系',
        description:
          '检测通过会记入学习档案，并常作为后续实训模块或教师发布任务的前置条件。建议先完成本阶段课程与检测，再进入侧栏各实训模块。',
        icon: 'ri-links-line',
      },
    ],
    tips: [
      '学习详情页可查看资源进度与关联知识点',
      '检测未通过可按提示复习后再次参加',
    ],
  },
  {
    id: 'training',
    title: '实训模块',
    icon: 'ri-map-pin-line',
    color: 'from-purple-500 to-pink-500',
    description: '按阶段完成组队、创意、市场、产品等实训环节',
    studentTab: 'module-team',
    ctaLabel: '查看实训模块',
    steps: [
      {
        title: '阶段开放时间',
        description:
          '侧栏「实训模块」按阶段排列。若未到教师配置的开始日期，阶段呈锁定状态，点击可查看开放时间与解锁条件说明。',
        icon: 'ri-calendar-line',
      },
      {
        title: '阶段递进条件',
        description:
          '除时间外，后续阶段可能要求完成上一环节（如组队确认、选题通过、队长上传材料等），以解锁弹窗中列出的条件为准。',
        icon: 'ri-git-commit-line',
      },
      {
        title: '环节内操作',
        description:
          '进入已开放阶段后，按页面要求填写表单、使用 AI 工具、上传文件等。教师发布的实训任务也可能关联本阶段，请在进度看板待办中同步完成。',
        icon: 'ri-tools-line',
      },
    ],
    tips: [
      '侧栏灰色阶段表示尚未满足开放条件，请先完成提示中的前置步骤',
      '队长与队员在不同环节的上传职责可能不同，以页面说明为准',
    ],
  },
  {
    id: 'team',
    title: '组队与协作',
    icon: 'ri-team-line',
    color: 'from-orange-500 to-amber-500',
    description: '完成组队测评与团队组建，协作推进各阶段实训',
    studentTab: 'module-team',
    ctaLabel: '打开组队管理',
    steps: [
      {
        title: '组队预设问题',
        description:
          '首次进入「组队与团队管理」需回答教师预设问题，系统根据回答进行 AI 分析并推荐适合你的团队角色。题目由教师维护，请认真作答。',
        icon: 'ri-chat-quote-line',
      },
      {
        title: '组建或加入团队',
        description: '完成测评与视频等要求后参与组队，加入或创建团队，等待教师确认后视为组队完成，方可解锁后续创意等阶段。',
        icon: 'ri-group-line',
      },
      {
        title: '团队协作',
        description: '组队完成后，与队员在后续各实训模块分工协作；部分材料需队长上传，请及时在团队内沟通进度。',
        icon: 'ri-handshake-line',
      },
    ],
    tips: [
      '若被引导至组队页，说明当前班级仍需先完成组队流程',
      '教师确认组队前，部分实训阶段可能无法进入',
    ],
  },
];

const faqs: { q: string; a: string }[] = [
  {
    q: '登录时提示没有教学班或班级暂未开放怎么办？',
    a: '未加入任何个性化教学班时，请联系任课教师将你加入班级。已加入但切换时提示「班级暂未开放」，多为未到教师设置的组建或阶段开始时间，请阅读提示中的原因说明，或向教师确认课程安排。',
  },
  {
    q: '加入了多个班，如何切换？',
    a: '使用页面右上角的班级切换器选择当前要学习的班。切换后，通知、待办、实践课程与实训进度都会切换为该班数据。',
  },
  {
    q: '通知和待办任务有什么区别？',
    a: '通知用于教师提醒、资料送达与系统消息，阅读或确认即可。待办任务是明确截止与提交要求的实训任务，需要你在学习达标后完成内容并按要求提交。',
  },
  {
    q: '为什么提示要先完成课程资源才能检测或做任务？',
    a: `实践课程中配置了知识点的章节，需将对应小节学习进度达到约 ${COURSE_GATE_PERCENT}% 后才能参加知识点检测。教师发布的实训任务也常与课程进度挂钩，未达标时「去完成」不会打开任务详情，请先完成实践课程学习。`,
  },
  {
    q: '如何进行知识点检测？',
    a: '在「实践课程」中找到含知识点的章节，完成资源学习并达到进度要求后，按页面入口参加检测。通过后会记录在学习档案中。',
  },
  {
    q: '侧栏某个实训阶段是灰色、点不进去？',
    a: '通常有两种原因：未到教师配置的阶段开始日期，或上一阶段要求（如组队完成、选题通过、材料上传）尚未满足。点击该阶段查看解锁说明，按条件逐项完成。',
  },
  {
    q: '组队时要不要认真填预设问题？',
    a: '需要。预设问题用于首次进入组队流程时的作答，系统会据此进行 AI 分析并推荐团队角色。作答质量会影响角色建议与后续分工参考。',
  },
  {
    q: '从哪里开始第一次实训？',
    a: '确认已选开放的教学班后，建议顺序为：进度看板查看通知与待办 → 实践课程学习并通过检测 → 组队与团队管理 → 按侧栏顺序进入各实训模块。具体以教师安排为准。',
  },
];

export function UserGuideContent({ embedded = false }: UserGuideContentProps) {
  const [activeSection, setActiveSection] = useState('start');

  const current = sections.find((s) => s.id === activeSection) || sections[0];
  const primaryHref = studentCenterHref(current.studentTab);

  const sectionWrap = embedded ? 'px-0 pt-2 pb-4' : 'max-w-7xl mx-auto px-6 pt-12 pb-8';

  return (
    <div className={embedded ? '' : 'min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50'}>
      <div className={sectionWrap}>
        <div className={`text-center ${embedded ? 'mb-6' : 'mb-12'}`}>
          {!embedded && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 text-blue-700 text-sm font-medium mb-4">
              <i className="ri-book-open-line"></i>
              <span>使用指南</span>
            </div>
          )}
          <h1 className={`font-bold text-slate-900 mb-4 ${embedded ? 'text-2xl' : 'text-4xl'}`}>平台使用指南</h1>
          <p className={`text-slate-600 max-w-2xl mx-auto ${embedded ? 'text-sm' : 'text-lg'}`}>
            按学生工作台真实流程说明：选班、学习实践课程、知识点检测、实训模块与组队协作
          </p>
        </div>

        <div
          className={`grid grid-cols-2 md:grid-cols-3 gap-3 ${embedded ? 'lg:grid-cols-5 mb-6' : 'lg:grid-cols-5 mb-12'}`}
        >
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => setActiveSection(section.id)}
              className={`p-4 rounded-2xl border-2 transition-all text-left cursor-pointer ${
                activeSection === section.id
                  ? 'border-blue-500 bg-white shadow-md'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl bg-gradient-to-br ${section.color} flex items-center justify-center mb-3`}
              >
                <i className={`${section.icon} text-white text-lg`}></i>
              </div>
              <p
                className={`text-xs font-bold leading-tight ${activeSection === section.id ? 'text-blue-700' : 'text-gray-700'}`}
              >
                {section.title}
              </p>
            </button>
          ))}
        </div>

        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
          <div className={`bg-gradient-to-r ${current.color} p-8 text-white`}>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                <i className={`${current.icon} text-4xl`}></i>
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-1">{current.title}</h2>
                <p className="text-white/90 text-sm leading-relaxed">{current.description}</p>
              </div>
            </div>
            <Link
              to={primaryHref}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-slate-900 font-medium hover:shadow-lg transition-all whitespace-nowrap"
            >
              <span>{current.ctaLabel}</span>
              <i className="ri-arrow-right-line"></i>
            </Link>
          </div>

          <div className="p-8">
            <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <i className="ri-route-line text-blue-600"></i>
              <span>操作步骤</span>
            </h3>
            <div className="space-y-5">
              {current.steps.map((step, index) => (
                <div key={index} className="flex gap-4">
                  <div
                    className={`w-10 h-10 rounded-xl bg-gradient-to-br ${current.color} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}
                  >
                    {index + 1}
                  </div>
                  <div className="flex-1 pt-1">
                    <div className="flex items-center gap-2 mb-1">
                      <i className={`${step.icon} text-slate-400 text-base`}></i>
                      <h4 className="text-sm font-bold text-slate-900">{step.title}</h4>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="px-8 pb-8">
            <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <i className="ri-lightbulb-flash-line text-amber-500"></i>
              <span>使用提示</span>
            </h3>
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-5 border border-amber-200">
              <ul className="space-y-3">
                {current.tips.map((tip, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <i className="ri-checkbox-circle-fill text-amber-500 text-lg flex-shrink-0 mt-0.5"></i>
                    <span className="text-sm text-slate-700 leading-relaxed">{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {!embedded && (
          <div className="mt-12 bg-white rounded-3xl shadow-xl p-8">
            <h3 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <i className="ri-compass-3-line text-blue-600"></i>
              <span>快速导航</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Link
                to={studentCenterHref()}
                className="flex items-center gap-4 p-4 rounded-xl border-2 border-slate-200 hover:border-blue-500 hover:shadow-md transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center">
                  <i className="ri-dashboard-line text-white text-xl"></i>
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">学生工作台</h4>
                  <p className="text-sm text-slate-600">进度看板</p>
                </div>
              </Link>
              <Link
                to={studentCenterHref('knowledge')}
                className="flex items-center gap-4 p-4 rounded-xl border-2 border-slate-200 hover:border-green-500 hover:shadow-md transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                  <i className="ri-book-2-line text-white text-xl"></i>
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 group-hover:text-green-600 transition-colors">实践课程</h4>
                  <p className="text-sm text-slate-600">学习与知识点检测</p>
                </div>
              </Link>
              <Link
                to={studentCenterHref('module-team')}
                className="flex items-center gap-4 p-4 rounded-xl border-2 border-slate-200 hover:border-orange-500 hover:shadow-md transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                  <i className="ri-team-line text-white text-xl"></i>
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 group-hover:text-orange-600 transition-colors">组队管理</h4>
                  <p className="text-sm text-slate-600">组队与团队管理</p>
                </div>
              </Link>
            </div>
          </div>
        )}

        <div className={`bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl p-8 border border-blue-200 ${embedded ? 'mt-6' : 'mt-12'}`}>
          <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <i className="ri-question-answer-line text-blue-600"></i>
            <span>常见问题</span>
          </h3>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <details key={i} className="bg-white rounded-xl p-5 cursor-pointer group">
                <summary className="font-bold text-slate-900 flex items-center justify-between list-none">
                  <span className="pr-4">{faq.q}</span>
                  <i className="ri-arrow-down-s-line text-xl text-slate-400 group-open:rotate-180 transition-transform flex-shrink-0"></i>
                </summary>
                <p className="mt-4 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-4">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>

        {!embedded && (
          <div className="mt-12 text-center pb-12">
            <div className="inline-flex flex-col items-center gap-4 p-8 rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
              <i className="ri-rocket-line text-5xl"></i>
              <h3 className="text-2xl font-bold">进入学生工作台</h3>
              <p className="text-white/90 max-w-md text-sm">
                使用学生账号登录后，按指南完成选班、课程学习与各阶段实训
              </p>
              <Link
                to="/student-center"
                className="px-8 py-3 rounded-xl bg-white text-blue-600 font-bold hover:shadow-xl transition-all whitespace-nowrap"
              >
                进入学生工作台
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
