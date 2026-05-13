import { useState } from 'react';
import { Link } from 'react-router-dom';
import DeadlineSettings from './components/DeadlineSettings';
import ScoringSettings from './components/ScoringSettings';

type TabType = 'deadline' | 'scoring';

interface CourseSettingsPageProps {
  embedded?: boolean;
}

export default function CourseSettingsPage({ embedded = false }: CourseSettingsPageProps) {
  const [activeTab, setActiveTab] = useState<TabType>('deadline');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const tabs = [
    { key: 'deadline' as TabType, label: '截止时间配置', icon: 'ri-calendar-schedule-line' },
    { key: 'scoring' as TabType, label: '评分标准设置', icon: 'ri-scales-3-line' },
  ];

  const menuItems = [
    { to: '/teacher-dashboard', label: '全局项目监控', icon: 'ri-dashboard-line' },
    { to: '/teacher-dashboard', label: 'AI学情分析', icon: 'ri-robot-2-line' },
    { to: '/teacher-dashboard', label: '动态引导工具', icon: 'ri-guide-line' },
    { to: '/course-settings', label: '课程设置', icon: 'ri-settings-3-line', active: true },
    { to: '/teacher-guide', label: '教学指南', icon: 'ri-book-open-line' },
  ];

  // 嵌入模式：只渲染主内容，不渲染侧边栏和顶部导航
  if (embedded) {
    return (
      <div className="flex flex-col">
        {/* 页面标题 */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">课程设置</h1>
            <span className="px-3 py-1 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-xs font-bold rounded-full whitespace-nowrap">
              灵活配置 · 精准管理
            </span>
          </div>
          <p className="text-sm text-gray-500">配置实训任务截止时间与评分标准，为学生提供清晰的学习目标与评价依据</p>
        </div>

        {/* 概览卡片 */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: '实训阶段总数', value: '8', icon: 'ri-stack-line', color: 'from-teal-500 to-cyan-500', sub: '全流程覆盖' },
            { label: '必修任务', value: '6', icon: 'ri-checkbox-circle-line', color: 'from-green-500 to-emerald-500', sub: '2 项选修' },
            { label: '评分维度', value: '3', icon: 'ri-scales-3-line', color: 'from-orange-500 to-red-500', sub: '过程·成果·协作' },
            { label: '当前班级数', value: '4', icon: 'ri-team-line', color: 'from-amber-500 to-orange-500', sub: '共 156 名学生' },
          ].map((card, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center`}>
                  <i className={`${card.icon} text-white text-base`}></i>
                </div>
                <span className="text-3xl font-bold text-gray-900">{card.value}</span>
              </div>
              <div className="text-sm font-medium text-gray-700">{card.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">{card.sub}</div>
            </div>
          ))}
        </div>

        {/* Tab 切换 */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-white text-teal-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <i className={`${tab.icon} text-base`}></i>
              {tab.label}
            </button>
          ))}
        </div>

        {/* 内容区 */}
        {activeTab === 'deadline' && <DeadlineSettings />}
        {activeTab === 'scoring' && <ScoringSettings />}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex">
      {/* 左侧侧边栏 */}
      <aside
        className={`flex-shrink-0 bg-white border-r border-gray-100 shadow-sm flex flex-col transition-all duration-300 ${
          sidebarCollapsed ? 'w-16' : 'w-56'
        } min-h-screen sticky top-0 z-30`}
      >
        {/* Logo */}
        <div className={`flex items-center gap-3 px-4 py-5 border-b border-gray-100 ${sidebarCollapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <i className="ri-graduation-cap-line text-white text-sm"></i>
          </div>
          {!sidebarCollapsed && (
            <div className="overflow-hidden">
              <div className="text-sm font-bold text-gray-900 whitespace-nowrap">教师工作台</div>
              <div className="text-xs text-gray-400 whitespace-nowrap">Teacher Console</div>
            </div>
          )}
        </div>

        {/* 菜单 */}
        <nav className="flex-1 py-4 space-y-1 px-2">
          {menuItems.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              title={sidebarCollapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                item.active
                  ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              } ${sidebarCollapsed ? 'justify-center' : ''}`}
            >
              <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                <i className={`${item.icon} text-base`}></i>
              </div>
              {!sidebarCollapsed && (
                <span className="text-sm font-medium flex-1 text-left">{item.label}</span>
              )}
            </Link>
          ))}
        </nav>

        {/* 折叠按钮 */}
        <div className="p-3 border-t border-gray-100">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`w-full flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all cursor-pointer ${
              sidebarCollapsed ? 'justify-center' : ''
            }`}
          >
            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
              <i className={`${sidebarCollapsed ? 'ri-arrow-right-s-line' : 'ri-arrow-left-s-line'} text-base`}></i>
            </div>
            {!sidebarCollapsed && <span className="text-xs">收起菜单</span>}
          </button>
        </div>
      </aside>

      {/* 右侧主内容 */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* 顶部导航 */}
        <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-20">
          <div className="px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-400">教师工作台</span>
              <i className="ri-arrow-right-s-line text-gray-300"></i>
              <span className="font-medium text-gray-700">课程设置</span>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/teacher-dashboard"
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                <i className="ri-arrow-left-line"></i>
                <span>返回工作台</span>
              </Link>
              <Link
                to="/"
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                <i className="ri-home-line"></i>
                <span>返回首页</span>
              </Link>
            </div>
          </div>
        </header>

        {/* 主内容区 */}
        <main className="flex-1 p-6">
          {/* 页面标题 */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-gray-900">课程设置</h1>
              <span className="px-3 py-1 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-xs font-bold rounded-full whitespace-nowrap">
                灵活配置 · 精准管理
              </span>
            </div>
            <p className="text-sm text-gray-500">配置实训任务截止时间与评分标准，为学生提供清晰的学习目标与评价依据</p>
          </div>

          {/* 概览卡片 */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { label: '实训阶段总数', value: '8', icon: 'ri-stack-line', color: 'from-teal-500 to-cyan-500', sub: '全流程覆盖' },
              { label: '必修任务', value: '6', icon: 'ri-checkbox-circle-line', color: 'from-green-500 to-emerald-500', sub: '2 项选修' },
              { label: '评分维度', value: '3', icon: 'ri-scales-3-line', color: 'from-orange-500 to-red-500', sub: '过程·成果·协作' },
              { label: '当前班级数', value: '4', icon: 'ri-team-line', color: 'from-amber-500 to-orange-500', sub: '共 156 名学生' },
            ].map((card, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center`}>
                    <i className={`${card.icon} text-white text-base`}></i>
                  </div>
                  <span className="text-3xl font-bold text-gray-900">{card.value}</span>
                </div>
                <div className="text-sm font-medium text-gray-700">{card.label}</div>
                <div className="text-xs text-gray-400 mt-0.5">{card.sub}</div>
              </div>
            ))}
          </div>

          {/* Tab 切换 */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-6">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'bg-white text-teal-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <i className={`${tab.icon} text-base`}></i>
                {tab.label}
              </button>
            ))}
          </div>

          {/* 内容区 */}
          {activeTab === 'deadline' && <DeadlineSettings />}
          {activeTab === 'scoring' && <ScoringSettings />}
        </main>
      </div>
    </div>
  );
}
