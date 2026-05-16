
import { useState } from 'react';
import { Link } from 'react-router-dom';

interface GuideSection {
  id: string;
  title: string;
  icon: string;
  color: string;
  description: string;
  steps: { title: string; desc: string; icon: string }[];
  tips: string[];
}

const sections: GuideSection[] = [
  {
    id: 'overview',
    title: '平台概览与角色',
    icon: 'ri-dashboard-3-line',
    color: 'from-teal-500 to-cyan-500',
    description: '了解教师在平台中的核心职责与操作权限，快速熟悉工作台布局',
    steps: [
      { title: '登录教师工作台', desc: '使用工号和密码登录，选择"教师"角色进入专属工作台', icon: 'ri-login-box-line' },
      { title: '认识工作台布局', desc: '左侧侧边栏包含"全局项目监控"、"AI学情分析"、"动态引导工具"三大功能区', icon: 'ri-layout-left-line' },
      { title: '查看班级概况', desc: '首页统计卡片实时展示团队总数、平均进度、待处理预警和待评价成果', icon: 'ri-bar-chart-box-line' },
      { title: '设置个人偏好', desc: '可自定义排序方式、视图模式（网格/列表），根据习惯调整工作台', icon: 'ri-settings-3-line' },
    ],
    tips: [
      '建议每天登录查看预警信息，及时发现滞后团队',
      '使用列表视图可以快速对比多个团队的关键指标',
      '顶部导航栏的"导出报告"功能可一键生成班级整体报告',
    ],
  },
  {
    id: 'monitor',
    title: '全局项目监控',
    icon: 'ri-eye-line',
    color: 'from-indigo-500 to-purple-500',
    description: '实时掌握所有团队的实训进度，精准识别风险团队，高效开展干预指导',
    steps: [
      { title: '筛选与搜索团队', desc: '通过课程、阶段、状态等多维度筛选，快速定位目标团队', icon: 'ri-filter-3-line' },
      { title: '查看团队详情', desc: '点击任意团队卡片，查看成员列表、各阶段进度、提交记录等详细信息', icon: 'ri-file-info-line' },
      { title: '识别预警团队', desc: '橙色"⚠ 预警"和红色"🚨 滞后"标签标识需要关注的团队，点击查看具体预警原因', icon: 'ri-alarm-warning-line' },
      { title: '发起干预', desc: '对预警团队点击"干预"按钮，选择干预类型（通知/引导/资源推送）并填写内容', icon: 'ri-hand-heart-line' },
    ],
    tips: [
      '按"质量评分"排序可快速找到需要重点辅导的团队',
      '团队详情弹窗中可直接查看各阶段提交内容并给出评价',
      '建议每周至少对滞后团队发起一次干预，保持教学节奏',
    ],
  },
  {
    id: 'analysis',
    title: 'AI学情分析',
    icon: 'ri-robot-2-line',
    color: 'from-orange-500 to-amber-500',
    description: '借助AI智能分析学生学习数据，发现共性问题，精准定位需要帮助的学生',
    steps: [
      { title: '查看整体学情', desc: '顶部数据栏展示课程完成率、能力点平均获取数、达标率等核心指标', icon: 'ri-pie-chart-line' },
      { title: '分析学生个体', desc: '学生分析看板列出每位学生的学习进度、知识检测成绩和能力点获取情况', icon: 'ri-user-search-line' },
      { title: '识别共性问题', desc: 'AI自动标注全班达标率偏低的知识点，帮助教师调整教学重点', icon: 'ri-focus-3-line' },
      { title: '导出学情报告', desc: '点击"导出学情报告"生成完整的班级学情分析PDF，用于教研汇报', icon: 'ri-download-cloud-line' },
    ],
    tips: [
      'AI预警会自动标记连续两次检测未达标的学生，请及时关注',
      '学情分析数据每小时自动更新，无需手动刷新',
      '可将学情报告分享给教研组，共同研讨教学改进方案',
    ],
  },
  {
    id: 'guidance',
    title: '动态引导工具',
    icon: 'ri-guide-line',
    color: 'from-green-500 to-emerald-500',
    description: '针对学情分析结果，精准发起各类教学干预，实现个性化引导',
    steps: [
      { title: '全员通知', desc: '向全班或指定课程发送学习提醒、重要通知，支持富文本编辑', icon: 'ri-megaphone-line' },
      { title: '一对一引导', desc: '选择特定学生发起私信引导，了解学习障碍，提供个性化建议', icon: 'ri-chat-private-line' },
      { title: '推送学习资源', desc: '向团队或个人推送补充学习资料、案例视频、模板文件等资源', icon: 'ri-send-plane-line' },
      { title: '学习督促', desc: '对进度滞后的团队发送督促通知，可设置补做截止时间', icon: 'ri-alarm-line' },
    ],
    tips: [
      '全员通知适合解决共性问题，一对一引导适合个性化辅导',
      '推送资源时建议附上简短说明，帮助学生快速理解资源用途',
      '引导统计面板可查看本周各类干预的响应率，评估干预效果',
    ],
  },
  {
    id: 'evaluation',
    title: '成果评价与审核',
    icon: 'ri-star-line',
    color: 'from-red-500 to-rose-500',
    description: '对学生提交的各阶段成果进行评阅，给出过程性评价和终结性评价',
    steps: [
      { title: '查看待评价成果', desc: '监控看板右上角显示待评价数量，点击可筛选出所有"待评价"状态的团队', icon: 'ri-file-list-3-line' },
      { title: '打开成果详情', desc: '进入团队详情弹窗，切换到"提交记录"标签查看各阶段提交内容', icon: 'ri-folder-open-line' },
      { title: '填写评价意见', desc: '在评价框中填写具体反馈意见，选择"通过"或"退回修改"', icon: 'ri-edit-box-line' },
      { title: '发布评价结果', desc: '提交评价后，学生将收到通知，可在学生中心查看教师反馈', icon: 'ri-send-plane-2-line' },
    ],
    tips: [
      '评价意见要具体、有建设性，避免只写"通过"或"不通过"',
      '建议在每个阶段截止后48小时内完成评阅，保持教学节奏',
      '对优秀成果可以标记为"优秀案例"，供其他团队参考学习',
    ],
  },
  {
    id: 'course-resource',
    title: '课程资源管理',
    icon: 'ri-book-shelf-line',
    color: 'from-violet-500 to-purple-500',
    description: '管理课程知识点、案例库和学习资源，为学生提供丰富的学习素材',
    steps: [
      { title: '进入管理后台', desc: '通过首页"管理员"入口或顶部导航进入课程资源管理模块', icon: 'ri-admin-line' },
      { title: '上传知识点', desc: '在知识点库中添加新知识点，支持文档、视频、图片等多种格式', icon: 'ri-upload-cloud-line' },
      { title: '管理案例库', desc: '添加真实创业案例，设置难度标签和适用阶段，供学生参考学习', icon: 'ri-briefcase-4-line' },
      { title: '审核学生资源', desc: '学生上传的资源需经过教师审核后才能在平台内共享', icon: 'ri-shield-check-line' },
    ],
    tips: [
      '案例库建议按行业分类，方便学生快速找到相关参考',
      '定期更新知识点内容，确保与最新创业实践保持同步',
      '优质学生成果经审核后可转为案例库资源，激励学生创作',
    ],
  },
];

const faqs = [
  {
    q: '如何快速找到需要重点关注的团队？',
    a: '在"全局项目监控"中，使用状态筛选器选择"⚠ 预警"或"🚨 滞后"，即可快速过滤出需要关注的团队。也可以按"质量评分"升序排列，找到质量最低的团队。',
  },
  {
    q: 'AI学情分析的数据来源是什么？',
    a: 'AI学情分析综合了学生的模块完成进度、知识检测成绩、协作活跃度、提交质量评分等多维度数据，通过算法模型自动识别学习风险并生成预警。',
  },
  {
    q: '如何对全班发布一个重要通知？',
    a: '进入"动态引导工具"，选择"全员通知"功能，选择目标课程（或全部课程），填写通知标题和内容，点击发送即可。学生会在学生中心的通知栏收到消息。',
  },
  {
    q: '学生提交的成果在哪里查看？',
    a: '在"全局项目监控"中点击任意团队卡片，进入团队详情弹窗，切换到"提交记录"标签即可查看该团队所有阶段的提交内容和历史版本。',
  },
  {
    q: '如何导出班级整体报告？',
    a: '点击顶部导航栏右侧的"导出报告"按钮，系统会自动生成包含所有团队进度、学情分析、评价汇总的完整报告，支持PDF格式下载。',
  },
];

export default function TeacherGuidePage() {
  const [activeSection, setActiveSection] = useState('overview');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const current = sections.find(s => s.id === activeSection) || sections[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/30 to-cyan-50/20">

      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* 页面标题 */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">教学指南</h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            全面了解教师工作台的各项功能，掌握监控、分析、引导、评价的完整教学流程
          </p>
        </div>

        {/* 功能模块卡片选择 */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-10">
          {sections.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`p-4 rounded-2xl border-2 transition-all text-left cursor-pointer ${
                activeSection === s.id
                  ? 'border-teal-500 bg-white shadow-lg scale-105'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
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

        {/* 详细内容区 */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden mb-10">
          {/* 模块头部 */}
          <div className={`bg-gradient-to-r ${current.color} p-8 text-white`}>
            <div className="flex items-center gap-5 mb-4">
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                <i className={`${current.icon} text-4xl`}></i>
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-1">{current.title}</h2>
                <p className="text-white/90 text-sm leading-relaxed">{current.description}</p>
              </div>
            </div>
            <Link
              to="/teacher-dashboard"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-gray-900 text-sm font-semibold hover:shadow-lg transition-all whitespace-nowrap"
            >
              <span>前往工作台体验</span>
              <i className="ri-arrow-right-line"></i>
            </Link>
          </div>

          <div className="grid lg:grid-cols-2 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
            {/* 操作步骤 */}
            <div className="p-8">
              <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                <i className="ri-route-line text-teal-500"></i>
                操作步骤
              </h3>
              <div className="space-y-5">
                {current.steps.map((step, i) => (
                  <div key={i} className="flex gap-4">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${current.color} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
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

            {/* 使用技巧 */}
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

              {/* 快速跳转 */}
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <i className="ri-compass-3-line text-teal-500"></i>
                  快速跳转
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <Link to="/teacher-dashboard" className="flex items-center gap-2 p-3 rounded-xl bg-white border border-slate-200 hover:border-teal-400 hover:shadow-sm transition-all group cursor-pointer">
                    <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-cyan-500">
                      <i className="ri-dashboard-line text-white text-xs"></i>
                    </div>
                    <span className="text-xs font-medium text-gray-700 group-hover:text-teal-600 transition-colors">教师工作台</span>
                  </Link>
                  <Link to="/admin-dashboard" className="flex items-center gap-2 p-3 rounded-xl bg-white border border-slate-200 hover:border-violet-400 hover:shadow-sm transition-all group cursor-pointer">
                    <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-500">
                      <i className="ri-admin-line text-white text-xs"></i>
                    </div>
                    <span className="text-xs font-medium text-gray-700 group-hover:text-violet-600 transition-colors">管理后台</span>
                  </Link>
                  <Link to="/user-guide" className="flex items-center gap-2 p-3 rounded-xl bg-white border border-slate-200 hover:border-orange-400 hover:shadow-sm transition-all group cursor-pointer">
                    <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-500">
                      <i className="ri-book-open-line text-white text-xs"></i>
                    </div>
                    <span className="text-xs font-medium text-gray-700 group-hover:text-orange-600 transition-colors">学生指南</span>
                  </Link>
                  <Link to="/" className="flex items-center gap-2 p-3 rounded-xl bg-white border border-slate-200 hover:border-slate-400 hover:shadow-sm transition-all group cursor-pointer">
                    <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-gradient-to-br from-slate-500 to-gray-600">
                      <i className="ri-home-line text-white text-xs"></i>
                    </div>
                    <span className="text-xs font-medium text-gray-700 group-hover:text-slate-600 transition-colors">返回首页</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 教学流程总览 */}
        <div className="bg-white rounded-3xl shadow-xl p-8 mb-10">
          <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            <i className="ri-flow-chart text-teal-500 text-2xl"></i>
            教学管理全流程
          </h3>
          <p className="text-sm text-gray-500 mb-8">从课程开始到成果评价，掌握完整的教学管理节奏</p>
          <div className="relative">
            <div className="absolute top-8 left-8 right-8 h-0.5 bg-gradient-to-r from-teal-200 via-indigo-200 to-rose-200 hidden lg:block"></div>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 relative">
              {[
                { step: '01', title: '课前准备', desc: '上传知识点、案例资源，设置实训任务', icon: 'ri-book-shelf-line', color: 'from-teal-500 to-cyan-500' },
                { step: '02', title: '进度监控', desc: '实时查看团队进度，识别预警团队', icon: 'ri-eye-line', color: 'from-indigo-500 to-purple-500' },
                { step: '03', title: '学情分析', desc: 'AI分析学习数据，发现共性问题', icon: 'ri-robot-2-line', color: 'from-orange-500 to-amber-500' },
                { step: '04', title: '精准引导', desc: '发起通知、一对一引导、资源推送', icon: 'ri-guide-line', color: 'from-green-500 to-emerald-500' },
                { step: '05', title: '成果评价', desc: '评阅提交成果，给出反馈与评分', icon: 'ri-star-line', color: 'from-red-500 to-rose-500' },
              ].map((item, i) => (
                <div key={i} className="relative bg-slate-50 rounded-2xl p-5 border border-slate-100 hover:shadow-md transition-all">
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

        {/* 常见问题 */}
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
                  <i className={`ri-arrow-down-s-line text-xl text-gray-400 transition-transform flex-shrink-0 ml-4 ${openFaq === i ? 'rotate-180' : ''}`}></i>
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
