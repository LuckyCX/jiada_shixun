import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Input, message, Select, Space, Spin, Statistic, Table, Tag } from 'antd';
import type { TableProps } from 'antd';
import { User, UserRole, UserStatus } from './types';
import { useCollegeDictOptions } from './useCollegeDictOptions';
import AddUserModal from './AddUserModal';
import BatchImportModal from './BatchImportModal';
import EditUserModal from './EditUserModal';
import DeleteConfirmModal from './DeleteConfirmModal';
import ResetPasswordModal from './ResetPasswordModal';
import type { AdminUserStats } from './adminUsersApi';
import {
  createAdminUser,
  deleteAdminUser,
  fetchAdminUsers,
  patchAdminUserPassword,
  patchAdminUserStatus,
  postAdminUsersBatch,
  updateAdminUser,
} from './adminUsersApi';

export type AdminUsersPanelScope = 'all' | 'college-teachers' | 'class-students';

export type AdminUsersPanelProps = {
  scope: AdminUsersPanelScope;
  /** college-teachers 必填 */
  collegeId?: string;
  /** class-students 必填 */
  classId?: string;
  /** 副标题（如班级名） */
  subtitle?: string;
  onBack?: () => void;
};

const emptyStats: AdminUserStats = {
  totalUsers: 0,
  teachers: 0,
  students: 0,
  activeUsers: 0,
};

export default function AdminUsersPanel({ scope, collegeId = '', classId = '', subtitle, onBack }: AdminUsersPanelProps) {
  const { labelByValue: deptLabel } = useCollegeDictOptions(true);
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<AdminUserStats>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [qInput, setQInput] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'all'>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBatchImportOpen, setIsBatchImportOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const fixedRole = scope === 'college-teachers' ? ('teacher' as const) : scope === 'class-students' ? ('student' as const) : undefined;

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(qInput.trim()), 350);
    return () => window.clearTimeout(t);
  }, [qInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, roleFilter, statusFilter, scope, collegeId, classId]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminUsers({
        page,
        pageSize,
        q: debouncedQ,
        role: fixedRole ?? roleFilter,
        status: statusFilter,
        collegeId: scope === 'college-teachers' ? collegeId : undefined,
        classId: scope === 'class-students' ? classId : undefined,
      });
      setUsers(data.list);
      setTotal(data.total);
      setStats(data.stats);
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : '加载用户列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedQ, roleFilter, statusFilter, scope, collegeId, classId, fixedRole]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const handleAddUser = async (userData: {
    name: string;
    role: 'student' | 'teacher';
    idNumber: string;
    email?: string;
    department: string;
    password: string;
  }) => {
    try {
      const created = await createAdminUser({
        name: userData.name,
        role: userData.role,
        idNumber: userData.idNumber,
        department: userData.department,
        password: userData.password,
        ...(userData.email?.trim() ? { email: userData.email.trim() } : {}),
      });
      if (scope === 'class-students' && userData.role === 'student' && classId) {
        await updateAdminUser(created.id, { classId });
      }
      message.success(`用户 ${userData.name} 已成功创建`);
      setIsAddModalOpen(false);
      await loadUsers();
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : '创建失败');
    }
  };

  const handleEditUser = async (userId: string, userData: Record<string, unknown>) => {
    try {
      await updateAdminUser(userId, {
        name: String(userData.name ?? '').trim(),
        email: String(userData.email ?? '').trim(),
        department: String(userData.department ?? '').trim(),
        role: userData.role as User['role'],
        idNumber: String(userData.idNumber ?? '').trim(),
        ...(userData.role === 'student' ? { classId: String(userData.classId ?? '') } : {}),
      });
      message.success('用户信息已更新');
      setIsEditModalOpen(false);
      setSelectedUser(null);
      await loadUsers();
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : '更新失败');
    }
  };

  const handleToggleStatus = async (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    const next: UserStatus = user.status === 'active' ? 'inactive' : 'active';
    try {
      await patchAdminUserStatus(userId, next);
      message.success(`用户 ${user.name} 已${next === 'active' ? '启用' : '禁用'}`);
      await loadUsers();
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : '操作失败');
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    try {
      await deleteAdminUser(selectedUser.id);
      message.success(`用户 ${selectedUser.name} 已删除`);
      setIsDeleteModalOpen(false);
      setSelectedUser(null);
      await loadUsers();
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : '删除失败');
    }
  };

  const handleResetPassword = async (userId: string, newPassword: string) => {
    try {
      await patchAdminUserPassword(userId, newPassword);
      setIsResetPasswordOpen(false);
      setSelectedUser(null);
      message.success('密码已重置');
      await loadUsers();
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : '重置失败');
    }
  };

  const roleTag = (role: UserRole) => {
    const color = role === 'student' ? 'blue' : role === 'teacher' ? 'purple' : 'orange';
    const label = role === 'student' ? '学生' : role === 'teacher' ? '教师' : '管理员';
    return <Tag color={color}>{label}</Tag>;
  };

  const showRoleCol = scope === 'all';
  const showDeptCol = scope !== 'college-teachers';
  const showClassCol = scope === 'all';
  const actionColWidth = scope === 'all' ? 220 : 260;

  const columns: TableProps<User>['columns'] = [
        {
          title: '姓名',
          key: 'name',
          width: 200,
          render: (_, u) => (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 shrink-0 bg-gradient-to-br from-teal-400 to-blue-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                {u.name.charAt(0)}
              </div>
              <span className="text-sm font-medium text-gray-900">{u.name}</span>
            </div>
          ),
        },
        {
          title: '学号/工号',
          key: 'id',
          width: 140,
          render: (_, u) => <span className="text-sm text-gray-600">{u.studentId || u.employeeId || '—'}</span>,
        },
        {
          title: '邮箱',
          dataIndex: 'email',
          key: 'email',
          ellipsis: true,
          render: (v: string) => <span className="text-sm text-gray-600">{v?.trim() ? v : '—'}</span>,
        },
        ...(showDeptCol
          ? [
              {
                title: '学院',
                key: 'department',
                ellipsis: true,
                render: (_: unknown, u: User) => (
                  <span className="text-sm text-gray-600">{deptLabel(u.department)}</span>
                ),
              } as const,
            ]
          : []),
        ...(showClassCol
          ? [
              {
                title: '班级',
                key: 'className',
                width: 160,
                ellipsis: true,
                render: (_: unknown, u: User) => (
                  <span className="text-sm text-gray-600">{u.className || '—'}</span>
                ),
              } as const,
            ]
          : []),
        ...(showRoleCol
          ? [
              {
                title: '角色',
                dataIndex: 'role',
                key: 'role',
                width: 100,
                render: (r: UserRole) => roleTag(r),
              } as const,
            ]
          : []),
        {
          title: '状态',
          dataIndex: 'status',
          key: 'status',
          width: 90,
          render: (s: UserStatus) => (s === 'active' ? <Tag color="success">正常</Tag> : <Tag>已禁用</Tag>),
        },
        {
          title: '最后登录',
          dataIndex: 'lastLogin',
          key: 'lastLogin',
          width: 170,
          render: (v: string) => <span className="text-sm text-gray-600">{v || '—'}</span>,
        },
        {
          title: '操作',
          key: 'actions',
          fixed: 'right',
          width: actionColWidth,
          render: (_, u) => (
            <Space size={[4, 4]} wrap>
              <Button
                type="link"
                size="small"
                className="!px-1"
                onClick={() => {
                  setSelectedUser(u);
                  setIsEditModalOpen(true);
                }}
              >
                编辑
              </Button>
              <Button
                type="link"
                size="small"
                className="!px-1"
                onClick={() => {
                  setSelectedUser(u);
                  setIsResetPasswordOpen(true);
                }}
              >
                重置密码
              </Button>
              <Button type="link" size="small" className="!px-1" onClick={() => void handleToggleStatus(u.id)}>
                {u.status === 'active' ? '禁用' : '启用'}
              </Button>
              <Button
                type="link"
                size="small"
                danger
                className="!px-1"
                onClick={() => {
                  setSelectedUser(u);
                  setIsDeleteModalOpen(true);
                }}
              >
                删除
              </Button>
            </Space>
          ),
        },
      ];

  const pageTitle =
    scope === 'college-teachers' ? '教师管理' : scope === 'class-students' ? '学生管理' : '';

  return (
    <div className="space-y-6">
      {scope !== 'all' && (
        <div className="flex flex-wrap items-center gap-3">
          {onBack ? (
            <Button onClick={onBack}>返回</Button>
          ) : null}
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{pageTitle}</h2>
            {subtitle ? <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p> : null}
          </div>
        </div>
      )}

      {scope === 'all' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <Card bordered={false} className="border border-gray-200 shadow-sm">
            <Statistic title="总用户数" value={stats.totalUsers} prefix={<i className="ri-group-line text-blue-500" />} />
          </Card>
          <Card bordered={false} className="border border-gray-200 shadow-sm">
            <Statistic title="教师数" value={stats.teachers} prefix={<i className="ri-user-star-line text-purple-500" />} />
          </Card>
          <Card bordered={false} className="border border-gray-200 shadow-sm">
            <Statistic title="学生数" value={stats.students} prefix={<i className="ri-graduation-cap-line text-teal-500" />} />
          </Card>
          <Card bordered={false} className="border border-gray-200 shadow-sm">
            <Statistic title="活跃用户" value={stats.activeUsers} prefix={<i className="ri-user-smile-line text-green-500" />} />
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Card bordered={false} className="border border-gray-200 shadow-sm">
            <Statistic
              title={scope === 'college-teachers' ? '本学院教师数' : '本班学生数'}
              value={total}
              prefix={<i className="ri-user-line text-teal-500" />}
            />
          </Card>
          <Card bordered={false} className="border border-gray-200 shadow-sm">
            <Statistic
              title="当前页活跃"
              value={users.filter((u) => u.status === 'active').length}
              prefix={<i className="ri-user-smile-line text-green-500" />}
            />
          </Card>
        </div>
      )}

      <Card bordered={false} className="border border-gray-200 shadow-sm">
        <Space wrap className="w-full" size="middle">
          <Input
            allowClear
            className="max-w-md flex-1 min-w-[200px]"
            placeholder="搜索姓名、学号/工号、邮箱…"
            prefix={<i className="ri-search-line text-gray-400" />}
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
          />
          {scope === 'all' ? (
            <Select<UserRole | 'all'>
              className="w-40"
              value={roleFilter}
              onChange={(v) => setRoleFilter(v)}
              options={[
                { value: 'all', label: '全部角色' },
                { value: 'student', label: '学生' },
                { value: 'teacher', label: '教师' },
              ]}
            />
          ) : null}
          <Select<UserStatus | 'all'>
            className="w-36"
            value={statusFilter}
            onChange={(v) => setStatusFilter(v)}
            options={[
              { value: 'all', label: '全部状态' },
              { value: 'active', label: '正常' },
              { value: 'inactive', label: '已禁用' },
            ]}
          />
          <Button type="primary" className="!bg-green-600 hover:!bg-green-700" onClick={() => setIsBatchImportOpen(true)}>
            <i className="ri-upload-2-line mr-1.5" />
            批量导入
          </Button>
          <Button type="primary" className="!bg-teal-600 hover:!bg-teal-700" onClick={() => setIsAddModalOpen(true)}>
            <i className="ri-add-line mr-1.5" />
            {scope === 'all' ? '新增用户' : scope === 'college-teachers' ? '新增教师' : '新增学生'}
          </Button>
        </Space>
      </Card>

      <Card bordered={false} className="border border-gray-200 shadow-sm overflow-hidden">
        <Spin spinning={loading}>
          <Table<User>
            rowKey="id"
            columns={columns}
            dataSource={users}
            scroll={{ x: scope === 'all' ? 1100 : 900 }}
            locale={{ emptyText: '暂无用户数据' }}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              showTotal: (t) => `共 ${t} 条`,
              onChange: (p, ps) => {
                setPage(p);
                setPageSize(ps);
              },
            }}
          />
        </Spin>
      </Card>

      <AddUserModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAddUser}
        fixedRole={fixedRole}
        fixedDepartmentId={
          (scope === 'college-teachers' || scope === 'class-students') && collegeId ? collegeId : undefined
        }
      />

      <BatchImportModal
        isOpen={isBatchImportOpen}
        onClose={() => setIsBatchImportOpen(false)}
        lockedCollegeId={scope === 'college-teachers' || scope === 'class-students' ? collegeId : undefined}
        lockedClassId={scope === 'class-students' ? classId : undefined}
        lockedRole={fixedRole}
        onImport={async (rows) => {
          const result = await postAdminUsersBatch(rows);
          await loadUsers();
          return result;
        }}
      />

      <EditUserModal
        isOpen={isEditModalOpen}
        user={selectedUser}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedUser(null);
        }}
        onSubmit={handleEditUser}
        lockDepartmentId={
          (scope === 'college-teachers' || scope === 'class-students') && collegeId ? collegeId : undefined
        }
        lockClassId={scope === 'class-students' ? classId : undefined}
        lockRole={fixedRole}
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
    </div>
  );
}
