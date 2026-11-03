/**
 * 管理端教学使用情况：
 * 首页入口 → 教师列表（筛选）→ 班级 → 组队 → 团队实训详情（只读驾驶舱）
 */
import { useEffect, useMemo, useState } from 'react';
import { Button, Empty, Input, Select, Spin, Tag, message } from 'antd';
import { portalAuthenticatedFetch } from '../../../../lib/authApi';
import TeamWorkspacePage from '../../../teacher-dashboard/components/teamWorkspace/TeamWorkspacePage';

type TeacherRow = {
  id: string;
  username: string;
  realName: string;
  employeeNo: string;
  phone: string;
  department: string;
  classCount: number;
  lastLoginAt?: string;
};

type ClassRow = {
  id: string;
  name: string;
  academicYear: string;
  semester: string;
  studentCount: number;
  teamCount: number;
  createdAt?: string;
};

type TeamRow = {
  id: string;
  name: string;
  groupingStatus: string;
  isSolo: boolean;
  memberCount: number;
  memberNames: string;
};

type Level =
  | { kind: 'home' }
  | { kind: 'teachers' }
  | { kind: 'classes'; teacher: TeacherRow }
  | { kind: 'teams'; teacher: TeacherRow; clazz: ClassRow }
  | { kind: 'detail'; teacher: TeacherRow; clazz: ClassRow; team: TeamRow; stage: string; bmTab?: string };

type TeacherFilters = {
  department: string;
  teacherKeyword: string;
  employeeNo: string;
  phone: string;
};

const EMPTY_FILTERS: TeacherFilters = {
  department: '',
  teacherKeyword: '',
  employeeNo: '',
  phone: '',
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  confirmed: { label: '已确认', color: 'success' },
  pending: { label: '待确认', color: 'warning' },
  draft: { label: '草稿', color: 'default' },
  dissolved: { label: '已解散', color: 'error' },
};

function statusMeta(status: string) {
  return STATUS_META[status] || { label: status || '未知', color: 'default' };
}

function formatLogin(iso?: string) {
  if (!iso) return '尚未登录';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('zh-CN', { hour12: false });
}

function matchTeacher(t: TeacherRow, f: TeacherFilters) {
  if (f.department && (t.department || '') !== f.department) return false;
  const kw = f.teacherKeyword.trim().toLowerCase();
  if (kw) {
    const hay = `${t.realName || ''} ${t.username || ''}`.toLowerCase();
    if (!hay.includes(kw)) return false;
  }
  const emp = f.employeeNo.trim();
  if (emp && !(t.employeeNo || '').includes(emp)) return false;
  const phone = f.phone.trim();
  if (phone && !(t.phone || '').includes(phone)) return false;
  return true;
}

export default function TeachingDrillPanel({
  onDetailModeChange,
}: {
  /** 离开首页进入二级及以下时通知外层隐藏概览等 */
  onDetailModeChange?: (inDeep: boolean) => void;
} = {}) {
  const [level, setLevel] = useState<Level>({ kind: 'home' });
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<TeacherFilters>(EMPTY_FILTERS);
  const [draftFilters, setDraftFilters] = useState<TeacherFilters>(EMPTY_FILTERS);

  useEffect(() => {
    onDetailModeChange?.(level.kind !== 'home');
  }, [level.kind, onDetailModeChange]);

  useEffect(() => {
    if (level.kind === 'detail' || level.kind === 'home') return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        if (level.kind === 'teachers') {
          const data = (await portalAuthenticatedFetch('admin', '/api/admin/teaching/teachers')) as TeacherRow[];
          if (!cancelled) setTeachers(Array.isArray(data) ? data : []);
        } else if (level.kind === 'classes') {
          const data = (await portalAuthenticatedFetch(
            'admin',
            `/api/admin/teaching/teachers/${level.teacher.id}/classes`
          )) as ClassRow[];
          if (!cancelled) setClasses(Array.isArray(data) ? data : []);
        } else {
          const data = (await portalAuthenticatedFetch(
            'admin',
            `/api/admin/teaching/classes/${level.clazz.id}/teams`
          )) as TeamRow[];
          if (!cancelled) setTeams(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        if (!cancelled) message.error(e instanceof Error ? e.message : '加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [level]);

  const departmentOptions = useMemo(() => {
    const set = new Set<string>();
    teachers.forEach((t) => {
      const d = String(t.department || '').trim();
      if (d) set.add(d);
    });
    return [...set].sort((a, b) => a.localeCompare(b, 'zh-CN')).map((d) => ({ label: d, value: d }));
  }, [teachers]);

  const filteredTeachers = useMemo(
    () => teachers.filter((t) => matchTeacher(t, filters)),
    [teachers, filters]
  );

  const teacherTotalClasses = useMemo(
    () => teachers.reduce((sum, t) => sum + (t.classCount || 0), 0),
    [teachers]
  );

  const applyFilters = () => setFilters({ ...draftFilters });
  const resetFilters = () => {
    setDraftFilters(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
  };

  const enterTeachers = () => {
    setDraftFilters(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
    setLevel({ kind: 'teachers' });
  };

  /** 返回上一级；教师列表为下钻根目录，才回到「教学使用情况」首页 */
  const goBackOneLevel = () => {
    if (level.kind === 'teachers') {
      setLevel({ kind: 'home' });
      return;
    }
    if (level.kind === 'classes') {
      setLevel({ kind: 'teachers' });
      return;
    }
    if (level.kind === 'teams') {
      setLevel({ kind: 'classes', teacher: level.teacher });
      return;
    }
    if (level.kind === 'detail') {
      setLevel({ kind: 'teams', teacher: level.teacher, clazz: level.clazz });
    }
  };

  const backAriaLabel =
    level.kind === 'teachers'
      ? '返回教学使用情况'
      : level.kind === 'classes'
        ? '返回教师列表'
        : level.kind === 'teams'
          ? '返回班级列表'
          : '返回上一级';

  // 队伍详情二级页
  if (level.kind === 'detail') {
    const teamId = Number(level.team.id);
    return (
      <div className="min-h-[70vh] -m-1 md:m-0">
        <TeamWorkspacePage
          classId={level.clazz.id}
          teamId={teamId}
          stage={level.stage || 'cockpit'}
          bmTab={level.bmTab || ''}
          readOnly
          authPortal="admin"
          backLabel="返回组队列表"
          onBack={() => setLevel({ kind: 'teams', teacher: level.teacher, clazz: level.clazz })}
          onStageChange={(moduleKey, opts) =>
            setLevel({
              ...level,
              stage: moduleKey,
              bmTab: opts?.bmTab || '',
            })
          }
        />
      </div>
    );
  }

  // 首页入口：点进去再进入带筛选的教师列表
  if (level.kind === 'home') {
    return (
      <div className="space-y-5">
        <button
          type="button"
          onClick={enterTeachers}
          className="relative w-full text-left overflow-hidden rounded-2xl bg-gradient-to-br from-teal-600 via-cyan-600 to-slate-800 text-white px-5 py-6 md:px-7 md:py-8 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
        >
          <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="absolute right-16 bottom-0 w-24 h-24 rounded-full bg-cyan-300/20 blur-xl pointer-events-none" />
          <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-50/90 bg-white/10 rounded-full px-2.5 py-1 mb-2">
                <i className="ri-radar-line" />
                全校教学下钻 · 只读
              </div>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight">教学使用情况</h2>
              <p className="mt-1.5 text-sm text-teal-50/85 max-w-xl">
                按教师 → 班级 → 组队逐级查看；进入后可按学院、姓名、工号、手机号筛选教师。
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white text-teal-700 text-sm font-semibold shadow-sm group-hover:bg-teal-50 transition-colors">
                进入教师列表
                <i className="ri-arrow-right-line" />
              </span>
            </div>
          </div>
        </button>
      </div>
    );
  }

  const crumbTeacher =
    level.kind === 'classes' || level.kind === 'teams'
      ? level.teacher.realName || level.teacher.username
      : '';
  const crumbClass = level.kind === 'teams' ? level.clazz.name : '';

  return (
    <div className="space-y-5">
      {/* 教师列表：标题/返回/统计并入筛选卡片 */}
      {level.kind === 'teachers' ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 md:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4 pb-4 border-b border-gray-100">
            <div className="min-w-0 flex items-start gap-3">
              <button
                type="button"
                onClick={goBackOneLevel}
                className="mt-0.5 inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-500 hover:text-teal-700 hover:bg-teal-50 cursor-pointer shrink-0"
                aria-label={backAriaLabel}
                title={backAriaLabel}
              >
                <i className="ri-arrow-left-line text-lg" />
              </button>
              <div className="min-w-0">
                <h2 className="text-base md:text-lg font-bold text-gray-900 leading-tight">教师列表</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  共 {teachers.length} 位 · {teacherTotalClasses} 个正式开班
                  {filteredTeachers.length !== teachers.length
                    ? ` · 当前显示 ${filteredTeachers.length} 位`
                    : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:pl-2">
              <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                <i className="ri-filter-3-line text-teal-600" />
                筛选条件
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <div>
              <div className="text-xs text-gray-500 mb-1">学院</div>
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="全部学院"
                className="w-full"
                value={draftFilters.department || undefined}
                options={departmentOptions}
                onChange={(v) => setDraftFilters((f) => ({ ...f, department: v || '' }))}
              />
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">教师（姓名 / 用户名）</div>
              <Input
                allowClear
                placeholder="输入姓名或用户名"
                value={draftFilters.teacherKeyword}
                onChange={(e) => setDraftFilters((f) => ({ ...f, teacherKeyword: e.target.value }))}
                onPressEnter={applyFilters}
              />
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">工号</div>
              <Input
                allowClear
                placeholder="工号关键字"
                value={draftFilters.employeeNo}
                onChange={(e) => setDraftFilters((f) => ({ ...f, employeeNo: e.target.value }))}
                onPressEnter={applyFilters}
              />
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">手机号</div>
              <Input
                allowClear
                placeholder="手机号关键字"
                value={draftFilters.phone}
                onChange={(e) => setDraftFilters((f) => ({ ...f, phone: e.target.value }))}
                onPressEnter={applyFilters}
              />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button type="primary" onClick={applyFilters}>
              查询
            </Button>
            <Button onClick={resetFilters}>重置</Button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 md:px-5">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <button
              type="button"
              onClick={goBackOneLevel}
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-500 hover:text-teal-700 hover:bg-teal-50 cursor-pointer shrink-0"
              aria-label={backAriaLabel}
              title={backAriaLabel}
            >
              <i className="ri-arrow-left-line text-lg" />
            </button>
            <button
              type="button"
              onClick={() => setLevel({ kind: 'teachers' })}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-teal-700 cursor-pointer"
            >
              <i className="ri-user-star-line" />
              全部教师
            </button>
            {crumbTeacher ? (
              <>
                <i className="ri-arrow-right-s-line text-gray-300" />
                <button
                  type="button"
                  onClick={() =>
                    level.kind === 'teams' ? setLevel({ kind: 'classes', teacher: level.teacher }) : undefined
                  }
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors ${
                    level.kind === 'classes'
                      ? 'bg-teal-50 text-teal-700 font-semibold cursor-default'
                      : 'text-gray-500 hover:bg-gray-100 hover:text-teal-700 cursor-pointer'
                  }`}
                >
                  <i className="ri-user-line" />
                  {crumbTeacher}
                </button>
              </>
            ) : null}
            {crumbClass ? (
              <>
                <i className="ri-arrow-right-s-line text-gray-300" />
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 text-teal-700 font-semibold">
                  <i className="ri-group-line" />
                  {crumbClass}
                </span>
              </>
            ) : null}
          </div>
        </div>
      )}

      <Spin spinning={loading}>
        {level.kind === 'teachers' ? (
          filteredTeachers.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-16">
              <Empty description={teachers.length === 0 ? '暂无教师账号' : '没有符合筛选条件的教师'} />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredTeachers.map((t) => {
                const name = t.realName || t.username;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setLevel({ kind: 'classes', teacher: t })}
                    className="group text-left bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:border-teal-300 hover:shadow-md transition-all cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white flex items-center justify-center text-base font-bold shrink-0 shadow-sm">
                        {name.slice(0, 1)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900 truncate">{name}</span>
                          <i className="ri-arrow-right-up-line text-gray-300 group-hover:text-teal-500 transition-colors" />
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5 truncate">
                          @{t.username}
                          {t.employeeNo ? ` · 工号 ${t.employeeNo}` : ''}
                        </div>
                        <div className="text-xs text-gray-400 mt-1 truncate">
                          <i className="ri-building-line mr-1" />
                          {t.department || '未填学院'}
                          {t.phone ? ` · ${t.phone}` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-2 pt-3 border-t border-gray-50">
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-teal-700">
                        <i className="ri-bookmark-3-line" />
                        {t.classCount} 个班级
                      </span>
                      <span className="text-[11px] text-gray-400 truncate">最近 {formatLogin(t.lastLoginAt)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )
        ) : null}

        {level.kind === 'classes' ? (
          classes.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-16">
              <Empty description="该教师暂无正式教学班" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {classes.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setLevel({ kind: 'teams', teacher: level.teacher, clazz: c })}
                  className="group text-left bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:border-teal-300 hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="h-1.5 bg-gradient-to-r from-teal-500 to-cyan-500" />
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-gray-900 text-base leading-snug">{c.name}</h3>
                      <i className="ri-arrow-right-s-line text-gray-300 group-hover:text-teal-500 text-lg shrink-0" />
                    </div>
                    <p className="text-xs text-gray-500 mt-1.5">
                      {c.academicYear || '学年未填'}
                      {c.semester ? ` · ${c.semester}` : ''}
                      {c.createdAt ? ` · 创建 ${c.createdAt}` : ''}
                    </p>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                        <div className="text-lg font-bold text-gray-900 leading-none">{c.studentCount}</div>
                        <div className="text-[11px] text-gray-500 mt-1">学生</div>
                      </div>
                      <div className="rounded-xl bg-teal-50 px-3 py-2.5">
                        <div className="text-lg font-bold text-teal-700 leading-none">{c.teamCount}</div>
                        <div className="text-[11px] text-teal-600/80 mt-1">已确认队伍</div>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )
        ) : null}

        {level.kind === 'teams' ? (
          teams.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-16">
              <Empty description="该班暂无组队记录" />
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">组队列表</h3>
                  <p className="text-xs text-gray-500 mt-0.5">点击队伍进入完整实训详情（驾驶舱与各环节过程）</p>
                </div>
                <span className="text-xs text-gray-400">{teams.length} 支队伍</span>
              </div>
              <div className="divide-y divide-gray-50">
                {teams.map((t) => {
                  const st = statusMeta(t.groupingStatus);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() =>
                        setLevel({
                          kind: 'detail',
                          teacher: level.teacher,
                          clazz: level.clazz,
                          team: t,
                          stage: 'cockpit',
                        })
                      }
                      className="w-full text-left px-5 py-4 hover:bg-teal-50/40 transition-colors cursor-pointer group flex flex-col sm:flex-row sm:items-center gap-3"
                    >
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-teal-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                        <i className={t.isSolo ? 'ri-user-line' : 'ri-team-line'} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-gray-900">{t.name}</span>
                          {t.isSolo ? <Tag color="orange">单人公司</Tag> : null}
                          <Tag color={st.color as 'success'}>{st.label}</Tag>
                        </div>
                        <div className="text-xs text-gray-500 mt-1 truncate">
                          {t.memberCount} 人
                          {t.memberNames ? ` · ${t.memberNames}` : ''}
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-teal-600 group-hover:text-teal-700 shrink-0">
                        查看实训详情
                        <i className="ri-arrow-right-line" />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )
        ) : null}
      </Spin>
    </div>
  );
}
