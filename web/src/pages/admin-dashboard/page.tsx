import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import UserManagement from './components/userManagement';
import CourseResource from './components/courseResource';
import Overview from './components/overview';
import ClassManagement from './components/classManagement';
import OperationLog from './components/operationLog';

import SystemConfig from './components/systemConfig';

type TabType =
  | 'overview'
  | 'user-management'
  | 'class-management'
  | 'course-resource'
  | 'operation-log'
  | 'system-config';

export default function AdminDashboard() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    const tab = searchParams.get('tab') as TabType;
    if (
      tab &&
      [
        'overview',
        'user-management',
        'class-management',
        'course-resource',
        'operation-log',
        'system-config',
      ].includes(tab)
    ) {
      setActiveTab(tab);
    } else {
      setActiveTab('overview');
    }
  }, [searchParams]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    navigate(`/admin-dashboard?tab=${tab}`);
  };

  const menuItems = [
    { id: 'overview' as TabType, label: '数据概览', icon: 'ri-dashboard-line' },
    { id: 'user-management' as TabType, label: '用户管理', icon: 'ri-user-settings-line' },
    { id: 'class-management' as TabType, label: '班级管理', icon: 'ri-team-line' },
    { id: 'course-resource' as TabType, label: '课程资源', icon: 'ri-book-2-line' },
    { id: 'system-config' as TabType, label: '系统配置', icon: 'ri-settings-3-line' },
    { id: 'operation-log' as TabType, label: '操作日志', icon: 'ri-history-line' },
  ];

  const getBreadcrumb = () => {
    const item = menuItems.find(m => m.id === activeTab);
    return item ? item.label : '数据概览';
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* 左侧边栏 */}
      <div className={`bg-white border-r border-gray-200 transition-all duration-300 flex flex-col ${sidebarCollapsed ? 'w-20' : 'w-64'}`}>
        {/* Logo区域 */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-blue-500 rounded-lg flex items-center justify-center">
                <i className="ri-admin-line text-white text-lg"></i>
              </div>
              <span className="font-semibold text-gray-900">管理员后台</span>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors"
          >
            <i className={`ri-${sidebarCollapsed ? 'menu-unfold' : 'menu-fold'}-line text-gray-600`}></i>
          </button>
        </div>

        {/* 菜单列表 */}
        <nav className="flex-1 p-4 space-y-1">
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => handleTabChange(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all whitespace-nowrap ${
                activeTab === item.id
                  ? 'bg-teal-50 text-teal-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <i className={`${item.icon} text-xl flex-shrink-0`}></i>
              {!sidebarCollapsed && <span className="font-medium">{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* 底部用户信息 */}
        <div className="p-4 border-t border-gray-200">
          <div className={`flex items-center gap-3 ${sidebarCollapsed ? 'justify-center' : ''}`}>
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white font-semibold text-sm">管</span>
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">管理员</div>
                <div className="text-xs text-gray-500">admin@system.com</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 顶部导航栏 */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <i className="ri-home-4-line"></i>
            <span>/</span>
            <span className="text-gray-900 font-medium">{getBreadcrumb()}</span>
          </div>

          <div className="flex items-center gap-4">
            {/* 通知按钮 */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors relative"
              >
                <i className="ri-notification-3-line text-gray-600 text-xl"></i>
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>

              {showNotifications && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowNotifications(false)}
                  ></div>
                  <div className="absolute right-0 top-12 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    <div className="p-4 border-b border-gray-200">
                      <h3 className="font-semibold text-gray-900">系统通知</h3>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      <div className="p-4 hover:bg-gray-50 cursor-pointer border-b border-gray-100">
                        <div className="text-sm text-gray-900 mb-1">新增 50 个学生账号待激活</div>
                        <div className="text-xs text-gray-500">5分钟前</div>
                      </div>
                      <div className="p-4 hover:bg-gray-50 cursor-pointer border-b border-gray-100">
                        <div className="text-sm text-gray-900 mb-1">课程内容已更新，3 个小节已发布</div>
                        <div className="text-xs text-gray-500">1小时前</div>
                      </div>
                      <div className="p-4 hover:bg-gray-50 cursor-pointer">
                        <div className="text-sm text-gray-900 mb-1">系统将于今晚进行维护</div>
                        <div className="text-xs text-gray-500">3小时前</div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* 返回首页 */}
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors whitespace-nowrap"
            >
              返回首页
            </button>
          </div>
        </header>

        {/* 内容区域 */}
        <main className="flex-1 overflow-auto p-6">
          {activeTab === 'overview' && <Overview />}
          {activeTab === 'user-management' && <UserManagement />}
          {activeTab === 'class-management' && <ClassManagement />}
          {activeTab === 'course-resource' && <CourseResource />}
          {activeTab === 'operation-log' && <OperationLog />}
          {activeTab === 'system-config' && <SystemConfig />}
        </main>
      </div>
    </div>
  );
}