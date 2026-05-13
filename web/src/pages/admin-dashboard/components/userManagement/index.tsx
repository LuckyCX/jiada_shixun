import { useState } from 'react';
import { User, UserRole, UserStatus, ImportResult } from './types';
import { mockUsers, mockUserStats, mockClasses } from './mockData';
import AddUserModal from './AddUserModal';
import BatchImportModal from './BatchImportModal';
import EditUserModal from './EditUserModal';
import DeleteConfirmModal from './DeleteConfirmModal';
import ResetPasswordModal from './ResetPasswordModal';

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [stats, setStats] = useState(mockUserStats);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'all'>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBatchImportOpen, setIsBatchImportOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleResetPassword = (userId: string, newPassword: string) => {
    setIsResetPasswordOpen(false);
    setSelectedUser(null);
    showNotification('success', `用户密码已重置，新密码：${newPassword}`);
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.studentId && user.studentId.includes(searchQuery)) ||
      (user.employeeId && user.employeeId.includes(searchQuery));

    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleAddUser = (userData: any) => {
    const newUser: User = {
      id: `user-${Date.now()}`,
      name: userData.name,
      studentId: userData.role === 'student' ? userData.idNumber : undefined,
      employeeId: userData.role !== 'student' ? userData.idNumber : undefined,
      email: userData.email,
      department: userData.department,
      role: userData.role,
      status: 'active',
      lastLogin: '-',
      createdAt: new Date().toISOString().split('T')[0],
    };

    setUsers([newUser, ...users]);
    setStats({
      ...stats,
      totalUsers: stats.totalUsers + 1,
      [userData.role === 'student' ? 'students' : 'teachers']: stats[userData.role === 'student' ? 'students' : 'teachers'] + 1,
    });
    setIsAddModalOpen(false);
    showNotification('success', `用户 ${userData.name} 已成功创建`);
  };

  const handleBatchImport = async (file: File): Promise<ImportResult> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const successCount = Math.floor(Math.random() * 20) + 30;
        const failedCount = Math.floor(Math.random() * 5);

        const errors = Array.from({ length: failedCount }, (_, i) => ({
          row: i + 2,
          reason: ['邮箱格式错误', '学号重复', '必填字段缺失'][Math.floor(Math.random() * 3)],
        }));

        setStats({
          ...stats,
          totalUsers: stats.totalUsers + successCount,
          students: stats.students + successCount,
        });

        resolve({
          success: successCount,
          failed: failedCount,
          errors,
        });

        showNotification('success', `成功导入 ${successCount} 名学生`);
      }, 2000);
    });
  };

  const handleEditUser = (userId: string, userData: any) => {
    setUsers(
      users.map((user) =>
        user.id === userId
          ? {
              ...user,
              name: userData.name,
              studentId: userData.role === 'student' ? userData.idNumber : undefined,
              employeeId: userData.role !== 'student' ? userData.idNumber : undefined,
              email: userData.email,
              department: userData.department,
              role: userData.role,
              classId: userData.classId,
              className: mockClasses.find((c) => c.id === userData.classId)?.name,
            }
          : user
      )
    );
    setIsEditModalOpen(false);
    setSelectedUser(null);
    showNotification('success', '用户信息已更新');
  };

  const handleToggleStatus = (userId: string) => {
    setUsers(
      users.map((user) =>
        user.id === userId
          ? { ...user, status: user.status === 'active' ? 'inactive' : 'active' }
          : user
      )
    );
    const user = users.find((u) => u.id === userId);
    showNotification('success', `用户 ${user?.name} 已${user?.status === 'active' ? '禁用' : '启用'}`);
  };

  const handleDeleteUser = () => {
    if (!selectedUser) return;

    setUsers(users.filter((user) => user.id !== selectedUser.id));
    setStats({
      ...stats,
      totalUsers: stats.totalUsers - 1,
      [selectedUser.role === 'student' ? 'students' : 'teachers']: stats[selectedUser.role === 'student' ? 'students' : 'teachers'] - 1,
    });
    setIsDeleteModalOpen(false);
    showNotification('success', `用户 ${selectedUser.name} 已删除`);
    setSelectedUser(null);
  };

  const getRoleBadge = (role: UserRole) => {
    const styles = {
      student: 'bg-blue-100 text-blue-700',
      teacher: 'bg-purple-100 text-purple-700',
      admin: 'bg-orange-100 text-orange-700',
    };
    const labels = {
      student: '学生',
      teacher: '教师',
      admin: '管理员',
    };
    return (
      <span className={`px-2 py-1 rounded-md text-xs font-medium ${styles[role]}`}>
        {labels[role]}
      </span>
    );
  };

  const getStatusBadge = (status: UserStatus) => {
    return status === 'active' ? (
      <span className="px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-700">
        正常
      </span>
    ) : (
      <span className="px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
        已禁用
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-5">
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <i className="ri-group-line text-2xl text-blue-600"></i>
            </div>
            <span className="text-xs text-gray-500">总用户数</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{stats.totalUsers}</div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <i className="ri-user-star-line text-2xl text-purple-600"></i>
            </div>
            <span className="text-xs text-gray-500">教师数</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{stats.teachers}</div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center">
              <i className="ri-graduation-cap-line text-2xl text-teal-600"></i>
            </div>
            <span className="text-xs text-gray-500">学生数</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{stats.students}</div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <i className="ri-user-smile-line text-2xl text-green-600"></i>
            </div>
            <span className="text-xs text-gray-500">活跃用户</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{stats.activeUsers}</div>
        </div>
      </div>

      {/* 搜索和筛选栏 */}
      <div className="bg-white rounded-xl p-5 border border-gray-200">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索姓名、学号/工号、邮箱..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
            className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          >
            <option value="all">全部角色</option>
            <option value="student">学生</option>
            <option value="teacher">教师</option>
            <option value="admin">管理员</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as UserStatus | 'all')}
            className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          >
            <option value="all">全部状态</option>
            <option value="active">正常</option>
            <option value="inactive">已禁用</option>
          </select>

          <button
            onClick={() => setIsBatchImportOpen(true)}
            className="px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors whitespace-nowrap"
          >
            <i className="ri-upload-2-line mr-1.5"></i>
            批量导入
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors whitespace-nowrap"
          >
            <i className="ri-add-line mr-1.5"></i>
            新增用户
          </button>
        </div>
      </div>

      {/* 用户列表 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600">姓名</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600">学号/工号</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600">邮箱</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600">院系</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600">班级</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600">角色</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600">状态</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600">最后登录</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                        {user.name.charAt(0)}
                      </div>
                      <span className="text-sm font-medium text-gray-900">{user.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-600">
                    {user.studentId || user.employeeId}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-600">{user.email}</td>
                  <td className="px-5 py-4 text-sm text-gray-600">{user.department}</td>
                  <td className="px-5 py-4 text-sm text-gray-600">
                    {user.className || '-'}
                  </td>
                  <td className="px-5 py-4">{getRoleBadge(user.role)}</td>
                  <td className="px-5 py-4">{getStatusBadge(user.status)}</td>
                  <td className="px-5 py-4 text-sm text-gray-600">{user.lastLogin}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setIsEditModalOpen(true);
                        }}
                        className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                        title="编辑"
                      >
                        <i className="ri-edit-line"></i>
                      </button>
                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setIsResetPasswordOpen(true);
                        }}
                        className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                        title="重置密码"
                      >
                        <i className="ri-lock-password-line"></i>
                      </button>
                      <button
                        onClick={() => handleToggleStatus(user.id)}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                          user.status === 'active'
                            ? 'text-gray-600 hover:text-orange-600 hover:bg-orange-50'
                            : 'text-gray-600 hover:text-green-600 hover:bg-green-50'
                        }`}
                        title={user.status === 'active' ? '禁用' : '启用'}
                      >
                        <i className={user.status === 'active' ? 'ri-forbid-line' : 'ri-check-line'}></i>
                      </button>
                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setIsDeleteModalOpen(true);
                        }}
                        className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="删除"
                      >
                        <i className="ri-delete-bin-line"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredUsers.length === 0 && (
          <div className="py-16 text-center">
            <div className="w-20 h-20 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <i className="ri-user-search-line text-4xl text-gray-400"></i>
            </div>
            <p className="text-gray-500">未找到符合条件的用户</p>
          </div>
        )}
      </div>

      {/* 弹窗 */}
      <AddUserModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAddUser}
      />

      <BatchImportModal
        isOpen={isBatchImportOpen}
        onClose={() => setIsBatchImportOpen(false)}
        onImport={handleBatchImport}
      />

      <EditUserModal
        isOpen={isEditModalOpen}
        user={selectedUser}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedUser(null);
        }}
        onSubmit={handleEditUser}
      />

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        user={selectedUser}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedUser(null);
        }}
        onConfirm={handleDeleteUser}
      />

      <ResetPasswordModal
        isOpen={isResetPasswordOpen}
        user={selectedUser}
        onClose={() => {
          setIsResetPasswordOpen(false);
          setSelectedUser(null);
        }}
        onConfirm={handleResetPassword}
      />

      {/* 通知提示 */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
          <div
            className={`px-5 py-3 rounded-lg shadow-lg flex items-center gap-3 ${
              notification.type === 'success'
                ? 'bg-green-600 text-white'
                : 'bg-red-600 text-white'
            }`}
          >
            <i
              className={`text-xl ${
                notification.type === 'success' ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'
              }`}
            ></i>
            <span className="text-sm font-medium">{notification.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}