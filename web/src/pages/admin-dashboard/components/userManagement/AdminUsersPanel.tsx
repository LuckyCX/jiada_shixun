import { useCallback, useEffect, useMemo, useState, type Key } from 'react';
import { Button, Card, Cascader, Input, Modal, message, Select, Space, Spin, Statistic, Table, Tag } from 'antd';
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
  batchDeleteAdminUsers,
  deleteAdminUser,
  fetchAdminUsers,
  patchAdminUserPassword,
  patchAdminUserStatus,
  postAdminUsersBatch,
  updateAdminUser,
} from './adminUsersApi';
import { useMajorOptions } from './useMajorOptions';
import UserAvatar from '../../../../components/UserAvatar';

type ApiErrorWithData = Error & {
  code?: number;
  data?: { conflict?: { currentClassName?: string; currentClassId?: string; name?: string; idNumber?: string } };
};

export type AdminUsersPanelScope = 'all' | 'college-teachers' | 'class-students';

export type AdminUsersPanelProps = {
  scope: AdminUsersPanelScope;
  /** college-teachers 必填 */
  collegeId?: string;
  /** class-students 必填 */
  classId?: string;
  /** class-students：班级所属专业 */
  majorId?: string;
  /** 副标题（如班级名） */
  subtitle?: string;
  /** class-students：专业名称展示 */
  majorName?: string;
  onBack?: () => void;
  /** 从定位搜索带入的初始关键词 */
  initialQ?: string;
};

const emptyStats: AdminUserStats = {
  totalUsers: 0,
  teachers: 0,
  students: 0,
  activeUsers: 0,
};

export default function AdminUsersPanel({
  scope,
  collegeId = '',
  classId = '',
  majorId = '',
  subtitle,
  majorName = '',
  onBack,
  initialQ = '',
}: AdminUsersPanelProps) {
  const { options: collegeFilterOptions, labelByValue: deptLabel } = useCollegeDictOptions(true);
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<AdminUserStats>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [qInput, setQInput] = useState(initialQ);
  const [debouncedQ, setDebouncedQ] = useState(initialQ);
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'all'>('all');
  const [collegeFilter, setCollegeFilter] = useState('');
  const [majorFilter, setMajorFilter] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBatchImportOpen, setIsBatchImportOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [batchDeleting, setBatchDeleting] = useState(false);

  const fixedRole = scope === 'college-teachers' ? ('teacher' as const) : scope === 'class-students' ? ('student' as const) : undefined;

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(qInput.trim()), 350);
    return () => window.clearTimeout(t);
  }, [qInput]);

  // 定位跳转带入的 q 变化时同步到搜索框
  useEffect(() => {
    const next = initialQ.trim();
    setQInput(next);
    setDebouncedQ(next);
  }, [initialQ, scope, collegeId, classId]);

  useEffect(() => {
    setPage(1);
    setSelectedRowKeys([]);
  }, [debouncedQ, roleFilter, statusFilter, collegeFilter, majorFilter, scope, collegeId, classId]);

  const filterCollegeId = scope === 'college-teachers' ? collegeId : collegeFilter;
  const { rows: filterMajors, options: majorFilterOptions, loading: majorFilterLoading } = useMajorOptions(
    scope === 'all' || scope === 'college-teachers',
    filterCollegeId || undefined
  );

  const collegeMajorCascaderOptions = useMemo(
    () =>
      collegeFilterOptions.map((c) => ({
        value: c.value,
        label: c.label,
        children: filterMajors
          .filter((m) => m.collegeId === c.value)
          .map((m) => ({ value: m.id, label: m.name })),
      })),
    [collegeFilterOptions, filterMajors]
  );

  useEffect(() => {
    setMajorFilter('');
  }, [collegeFilter, collegeId, scope]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminUsers({
        page,
        pageSize,
        q: debouncedQ,
        role: fixedRole ?? roleFilter,
        status: statusFilter,
        collegeId:
          scope === 'college-teachers'
            ? collegeId
            : scope === 'all' && collegeFilter
              ? collegeFilter
              : undefined,
        majorId: majorFilter || undefined,
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
  }, [page, pageSize, debouncedQ, roleFilter, statusFilter, collegeFilter, majorFilter, scope, collegeId, classId, fixedRole]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const handleAddUser = async (userData: {
    name: string;
    role: 'student' | 'teacher';
    idNumber: string;
    email?: string;
    department: string;
    majorId?: string;
    password: string;
  }) => {
    const targetClassId = scope === 'class-students' && userData.role === 'student' ? classId : undefined;

    const submitOnce = async (otherClassPolicy?: 'skip' | 'move') => {
      return createAdminUser({
        name: userData.name,
        role: userData.role,
        idNumber: userData.idNumber,
        department: userData.department,
        password: userData.password,
        ...(userData.majorId?.trim() && (userData.role === 'student' || userData.role === 'teacher')
          ? { majorId: userData.majorId.trim() }
          : {}),
        ...(userData.email?.trim() ? { email: userData.email.trim() } : {}),
        ...(targetClassId ? { classId: targetClassId } : {}),
        ...(otherClassPolicy ? { otherClassPolicy } : {}),
      });
    };

    try {
      const created = await submitOnce();
      message.success(
        targetClassId ? `学生 ${userData.name} 已加入本班` : `用户 ${userData.name} 已成功创建`
      );
      setIsAddModalOpen(false);
      await loadUsers();
      return created;
    } catch (e: unknown) {
      const err = e as ApiErrorWithData;
      // 已在其他行政班：弹窗选择过滤（取消）或挪班
      if (err?.code === 40902 && targetClassId && err.data?.conflict) {
        const c = err.data.conflict;
        const classLabel = c.currentClassName || c.currentClassId || '其他班级';
        return new Promise<void>((resolve, reject) => {
          Modal.confirm({
            title: '学号已在其他行政班',
            content: `「${c.name || userData.name}」（${c.idNumber || userData.idNumber}）当前在「${classLabel}」。请选择过滤（不添加）或从旧班挪到本班。`,
            okText: '从旧班挪过来',
            cancelText: '过滤（不添加）',
            onOk: async () => {
              try {
                await submitOnce('move');
                message.success(`已将 ${userData.name} 从原班挪入本班`);
                setIsAddModalOpen(false);
                await loadUsers();
                resolve();
              } catch (e2: unknown) {
                message.error(e2 instanceof Error ? e2.message : '挪班失败');
                reject(e2);
              }
            },
            onCancel: () => {
              reject(Object.assign(new Error('已取消添加'), { silent: true }));
            },
          });
        });
      }
      if (!(err as { silent?: boolean })?.silent) {
        message.error(err instanceof Error ? err.message : '创建失败');
      }
      throw e;
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
        ...(userData.role === 'student' || userData.role === 'teacher'
          ? { majorId: String(userData.majorId ?? '') }
          : {}),
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
      setSelectedRowKeys((keys) => keys.filter((k) => String(k) !== selectedUser.id));
      await loadUsers();
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : '删除失败');
    }
  };

  const handleBatchDeleteStudents = () => {
    if (scope !== 'class-students' || !classId) return;
    const ids = selectedRowKeys.map((k) => String(k)).filter(Boolean);
    if (!ids.length) {
      message.warning('请先勾选要删除的学生');
      return;
    }
    const preview = users.filter((u) => ids.includes(u.id)).slice(0, 8);
    const more = ids.length - preview.length;
    Modal.confirm({
      title: `确认批量删除 ${ids.length} 名学生？`,
      width: 480,
      content: (
        <div className="text-sm text-gray-600 space-y-2">
          <p>将永久删除所选学生账号，不可恢复。</p>
          <p>
            若这些学生曾被加入教师创建的<strong>个性化班级</strong>，将自动从对应班级中移除。
          </p>
          <ul className="list-disc pl-5 text-gray-700 max-h-40 overflow-y-auto">
            {preview.map((u) => (
              <li key={u.id}>
                {u.name}
                {(u.studentId || u.username) ? `（${u.studentId || u.username}）` : ''}
              </li>
            ))}
            {more > 0 ? <li>…另有 {more} 人</li> : null}
          </ul>
        </div>
      ),
      okText: '确认删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        setBatchDeleting(true);
        try {
          const result = await batchDeleteAdminUsers(ids, { classId });
          const tip =
            result.removedFromPersonalClasses > 0
              ? `已删除 ${result.deleted} 人，并从个性化班级移出 ${result.removedFromPersonalClasses} 条入班记录`
              : `已删除 ${result.deleted} 人`;
          message.success(tip);
          setSelectedRowKeys([]);
          await loadUsers();
        } catch (e: unknown) {
          message.error(e instanceof Error ? e.message : '批量删除失败');
          throw e;
        } finally {
          setBatchDeleting(false);
        }
      },
    });
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
  const showMajorCol = scope === 'all' || scope === 'class-students' || scope === 'college-teachers';
  const showClassCol = scope === 'all';
  const actionColWidth = scope === 'all' ? 220 : 260;
  const nameColWidth = scope === 'class-students' ? 270 : 240;

  const columns: TableProps<User>['columns'] = [
        {
          title: '姓名',
          key: 'name',
          width: nameColWidth,
          ellipsis: scope !== 'class-students',
          render: (_, u) => {
            const idNo = (u.studentId || u.employeeId || u.username || '').trim();
            // 班级学生管理：加宽姓名列并完整展示学号，避免截断
            if (scope === 'class-students') {
              return (
                <div className="flex items-center gap-3 min-w-0">
                  <UserAvatar name={u.name} avatarUrl={u.avatarUrl} size="sm" className="shrink-0" />
                  <div className="min-w-0 leading-snug">
                    <div className="text-sm font-medium text-gray-900 break-all">{u.name}</div>
                    {idNo ? (
                      <div className="text-xs text-gray-500 break-all mt-0.5" title={idNo}>
                        {idNo}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            }
            return (
              <div className="flex items-center gap-3 min-w-0">
                <UserAvatar name={u.name} avatarUrl={u.avatarUrl} size="sm" className="shrink-0" />
                <span className="text-sm font-medium text-gray-900 truncate">
                  {u.name}
                  {idNo ? `（${idNo}）` : ''}
                </span>
              </div>
            );
          },
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
                  <span className="text-sm text-gray-600">
                    {u.collegeName || ( /^\d+$/.test(String(u.department || '').trim()) ? deptLabel(u.department) : u.department ) || '—'}
                  </span>
                ),
              } as const,
            ]
          : []),
        ...(showMajorCol
          ? [
              {
                title: '专业',
                key: 'majorName',
                ellipsis: true,
                render: (_: unknown, u: User) => (
                  <span className="text-sm text-gray-600">{u.majorName || '—'}</span>
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
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1 px-2 py-1 text-sm text-teal-600 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap flex-shrink-0"
            >
              <i className="ri-arrow-left-line" />
              返回
            </button>
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
            <>
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
              <Cascader
                allowClear
                changeOnSelect
                className="min-w-[280px]"
                placeholder="学院 / 专业"
                options={collegeMajorCascaderOptions}
                value={
                  collegeFilter && majorFilter
                    ? [collegeFilter, majorFilter]
                    : collegeFilter
                      ? [collegeFilter]
                      : undefined
                }
                onChange={(v) => {
                  const arr = (v as string[] | undefined) ?? [];
                  setCollegeFilter(arr[0] ?? '');
                  setMajorFilter(arr[1] ?? '');
                }}
                showSearch={{
                  filter: (input, path) =>
                    path.some((opt) => String(opt.label ?? '').toLowerCase().includes(input.toLowerCase())),
                }}
              />
            </>
          ) : null}
          {scope === 'college-teachers' ? (
            <Select
              allowClear
              className="min-w-[200px]"
              placeholder="全部专业"
              loading={majorFilterLoading}
              value={majorFilter || undefined}
              onChange={(v) => setMajorFilter(v ?? '')}
              options={majorFilterOptions}
              showSearch
              optionFilterProp="label"
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
          {scope === 'class-students' ? (
            <Button
              danger
              disabled={!selectedRowKeys.length || batchDeleting}
              loading={batchDeleting}
              onClick={handleBatchDeleteStudents}
            >
              <i className="ri-delete-bin-line mr-1.5" />
              批量删除{selectedRowKeys.length ? `（${selectedRowKeys.length}）` : ''}
            </Button>
          ) : null}
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
            rowSelection={
              scope === 'class-students'
                ? {
                    selectedRowKeys,
                    onChange: (keys) => setSelectedRowKeys(keys),
                    preserveSelectedRowKeys: true,
                  }
                : undefined
            }
            scroll={{ x: scope === 'all' ? 1180 : scope === 'class-students' ? 980 : 920 }}
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
        lockedClassLabel={scope === 'class-students' ? subtitle : undefined}
        lockedMajorId={scope === 'class-students' ? majorId : undefined}
        lockedMajorLabel={scope === 'class-students' ? majorName : undefined}
        lockedRole={fixedRole}
        onImport={async (rows, opts) => {
          const result = await postAdminUsersBatch(rows, opts);
          void loadUsers();
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
