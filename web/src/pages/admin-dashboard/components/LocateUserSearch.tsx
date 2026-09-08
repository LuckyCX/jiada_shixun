import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Spin, Tag, message } from 'antd';
import { fetchAdminUsers } from './userManagement/adminUsersApi';
import type { User, UserRole } from './userManagement/types';

type RoleMode = 'teacher' | 'student' | 'all';

type LocateUserSearchProps = {
  /** 学院页只搜教师；班级页可搜师生 */
  roleMode?: RoleMode;
  placeholder?: string;
  className?: string;
};

function roleLabel(role: UserRole): string {
  if (role === 'teacher') return '教师';
  if (role === 'student') return '学生';
  return role;
}

/**
 * 按姓名 / 学号 / 工号定位人员，并跳转到对应学院教师管理或班级学生管理。
 */
export default function LocateUserSearch({
  roleMode = 'all',
  placeholder = '输入姓名、学号或工号定位',
  className = '',
}: LocateUserSearchProps) {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [debounced, setDebounced] = useState('');
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<User[]>([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(keyword.trim()), 350);
    return () => window.clearTimeout(t);
  }, [keyword]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const search = useCallback(async (q: string) => {
    if (!q) {
      setList([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchAdminUsers({
        page: 1,
        pageSize: 20,
        q,
        role: roleMode === 'all' ? 'all' : roleMode,
        status: 'all',
      });
      setList(data.list);
      setOpen(true);
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : '搜索失败');
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [roleMode]);

  useEffect(() => {
    void search(debounced);
  }, [debounced, search]);

  const goUser = (u: User) => {
    const focusQ = (u.studentId || u.employeeId || u.username || u.name || '').trim();
    if (u.role === 'teacher') {
      const collegeId = String(u.department || '').trim();
      if (!collegeId || !/^\d+$/.test(collegeId)) {
        message.warning('该教师未绑定有效学院，无法跳转');
        return;
      }
      const q = new URLSearchParams();
      q.set('tab', 'college-teachers');
      q.set('collegeId', collegeId);
      if (focusQ) q.set('q', focusQ);
      navigate(`/admin-dashboard?${q.toString()}`);
      setOpen(false);
      return;
    }
    if (u.role === 'student') {
      const classId = String(u.classId || '').trim();
      const collegeId = String(u.department || '').trim();
      if (!classId || !/^\d+$/.test(classId)) {
        message.warning('该学生尚未分配行政班，请先在用户编辑中指定班级');
        return;
      }
      if (!collegeId || !/^\d+$/.test(collegeId)) {
        message.warning('该学生缺少学院信息，无法跳转');
        return;
      }
      const q = new URLSearchParams();
      q.set('tab', 'class-students');
      q.set('classId', classId);
      q.set('collegeId', collegeId);
      if (u.majorId) q.set('majorId', u.majorId);
      if (u.majorName) q.set('majorName', u.majorName);
      if (u.className) q.set('className', u.className);
      if (focusQ) q.set('q', focusQ);
      navigate(`/admin-dashboard?${q.toString()}`);
      setOpen(false);
      return;
    }
    message.warning('暂不支持跳转该角色');
  };

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <Input
        allowClear
        className="w-full min-w-[240px]"
        prefix={<i className="ri-user-search-line text-gray-400" />}
        placeholder={placeholder}
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        onFocus={() => {
          if (list.length || debounced) setOpen(true);
        }}
        onPressEnter={() => void search(keyword.trim())}
      />
      {open && debounced ? (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          <Spin spinning={loading}>
            {list.length === 0 && !loading ? (
              <div className="px-4 py-6 text-center text-sm text-gray-500">未找到匹配人员</div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {list.map((u) => {
                  const idNo = (u.studentId || u.employeeId || u.username || '').trim();
                  const loc =
                    u.role === 'teacher'
                      ? u.collegeName || (u.department ? `学院ID ${u.department}` : '未绑定学院')
                      : [u.collegeName, u.majorName, u.className].filter(Boolean).join(' / ') ||
                        '未分配行政班';
                  return (
                    <li key={u.id} className="flex items-start gap-3 px-3 py-2.5 hover:bg-gray-50">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">{u.name}</span>
                          <Tag className="!m-0">{roleLabel(u.role)}</Tag>
                          {idNo ? <span className="text-xs text-gray-500 break-all">{idNo}</span> : null}
                        </div>
                        <div className="mt-0.5 text-xs text-gray-500 break-all">{loc}</div>
                      </div>
                      <Button type="link" size="small" className="!px-0 shrink-0" onClick={() => goUser(u)}>
                        {u.role === 'teacher' ? '进入教师管理' : '进入学生管理'}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Spin>
        </div>
      ) : null}
    </div>
  );
}
