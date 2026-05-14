import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useSiteBrand } from '../../lib/publicSite';
import UserManagement from './components/userManagement';
import Overview from './components/overview';
import ClassManagement from './components/classManagement';
import CollegeManagement from './components/collegeManagement';
import OperationLog from './components/operationLog';

import SystemConfig from './components/systemConfig';
import DictTypeManage from './components/dictionary/DictTypeManage';
import DictItemManage from './components/dictionary/DictItemManage';
import { ADMIN_TOKEN_KEY } from '../../lib/authApi';

type TabType =
  | 'overview'
  | 'user-management'
  | 'college-management'
  | 'class-management'
  | 'operation-log'
  | 'system-config'
  | 'dictionary'
  | 'dictionary-items';

const TAB_WHITELIST: TabType[] = [
  'overview',
  'user-management',
  'college-management',
  'class-management',
  'operation-log',
  'system-config',
  'dictionary',
  'dictionary-items',
];

export default function AdminDashboard() {
  const { logoUrl, siteTitle } = useSiteBrand();
  const brandTitle = siteTitle.trim() || '创业实训平台';
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const [dictItemTypeName, setDictItemTypeName] = useState('');

  useEffect(() => {
    const raw = searchParams.get('tab');
    if (raw === 'course-resource') {
      navigate('/admin-dashboard?tab=overview', { replace: true });
      return;
    }
    const tab = raw as TabType;
    const typeIdRaw = searchParams.get('typeId');
    if (tab && TAB_WHITELIST.includes(tab)) {
      if (tab === 'dictionary-items') {
        const tid = Number(typeIdRaw);
        if (!typeIdRaw || !Number.isFinite(tid) || tid <= 0) {
          setActiveTab('dictionary');
          navigate('/admin-dashboard?tab=dictionary', { replace: true });
          return;
        }
      }
      setActiveTab(tab);
    } else {
      setActiveTab('overview');
    }
  }, [searchParams, navigate]);

  useEffect(() => {
    if (activeTab !== 'dictionary-items') {
      setDictItemTypeName('');
      return;
    }
    const tid = Number(searchParams.get('typeId'));
    if (!Number.isFinite(tid) || tid <= 0) return;
    const token = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (!token) {
      setDictItemTypeName('');
      return;
    }
    let cancelled = false;
    fetch(`/api/admin/dict-types/${tid}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled || j.code !== 0 || !j.data?.name) return;
        setDictItemTypeName(String(j.data.name));
      })
      .catch(() => {
        if (!cancelled) setDictItemTypeName('');
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, searchParams]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    navigate(`/admin-dashboard?tab=${tab}`);
  };

  const menuItems = [
    { id: 'overview' as TabType, label: '数据概览', icon: 'ri-dashboard-line' },
    { id: 'user-management' as TabType, label: '用户管理', icon: 'ri-user-settings-line' },
    { id: 'college-management' as TabType, label: '学院管理', icon: 'ri-building-4-line' },
    { id: 'class-management' as TabType, label: '班级管理', icon: 'ri-team-line' },
    { id: 'dictionary' as TabType, label: '字典管理', icon: 'ri-booklet-line' },
    { id: 'system-config' as TabType, label: '系统配置', icon: 'ri-settings-3-line' },
    { id: 'operation-log' as TabType, label: '操作日志', icon: 'ri-history-line' },
  ];

  const getBreadcrumb = () => {
    if (activeTab === 'dictionary-items') {
      return dictItemTypeName ? `字典管理 / ${dictItemTypeName}` : '字典管理 / 字典数据';
    }
    const item = menuItems.find((m) => m.id === activeTab);
    return item ? item.label : '数据概览';
  };

  const dictionaryItemsTypeId = Number(searchParams.get('typeId'));

  return (
    <div className="h-dvh max-h-dvh min-h-0 flex overflow-hidden bg-gray-50">
      {/* 左侧边栏 */}
      <div
        className={`bg-white border-r border-gray-200 transition-all duration-300 flex flex-col min-h-0 shrink-0 ${sidebarCollapsed ? 'w-20' : 'w-64'}`}
      >
        {/* Logo区域 */}
        <div className="h-16 shrink-0 flex items-center justify-between px-4 border-b border-gray-200">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2 min-w-0">
              {logoUrl ? (
                <img src={logoUrl} alt="" className="w-8 h-8 object-contain rounded-lg flex-shrink-0 border border-gray-100 bg-white" />
              ) : (
                <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <i className="ri-admin-line text-white text-lg"></i>
                </div>
              )}
              <div className="min-w-0 flex flex-col">
                <span className="font-semibold text-gray-900 truncate">{brandTitle}</span>
                <span className="text-xs text-gray-500 truncate">管理员后台</span>
              </div>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors"
          >
            <i className={`ri-${sidebarCollapsed ? 'menu-unfold' : 'menu-fold'}-line text-gray-600`}></i>
          </button>
        </div>

        {/* 菜单列表（侧栏过高时仅此处滚动） */}
        <nav className="flex-1 min-h-0 overflow-y-auto p-4 space-y-1">
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => handleTabChange(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all whitespace-nowrap ${
                activeTab === item.id || (item.id === 'dictionary' && activeTab === 'dictionary-items')
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
        <div className="p-4 border-t border-gray-200 shrink-0">
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

      {/* 主内容区：仅下方 main 滚动，顶栏固定 */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
        {/* 顶部导航栏 */}
        <header className="h-16 shrink-0 bg-white border-b border-gray-200 flex items-center justify-between px-6">
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
        <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-6">
          {activeTab === 'overview' && <Overview />}
          {activeTab === 'college-management' && <CollegeManagement />}
          {activeTab === 'class-management' && <ClassManagement />}
          {activeTab === 'user-management' && <UserManagement />}
          {activeTab === 'operation-log' && <OperationLog />}
          {activeTab === 'system-config' && <SystemConfig />}
          {activeTab === 'dictionary' && <DictTypeManage />}
          {activeTab === 'dictionary-items' &&
            Number.isFinite(dictionaryItemsTypeId) &&
            dictionaryItemsTypeId > 0 && <DictItemManage typeId={dictionaryItemsTypeId} />}
        </main>
      </div>
    </div>
  );
}