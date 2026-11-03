/**
 * 子管理员/超管数据下钻：教师列表 → 班级卡片 → 组队情况
 * （队伍操作详情可复用教师监控工作台链接占位说明）
 */
import { useEffect, useState } from 'react';
import { Breadcrumb, Card, Empty, Spin, Tag, message } from 'antd';
import { portalAuthenticatedFetch } from '../../../../lib/authApi';

type TeacherRow = {
  id: string;
  username: string;
  realName: string;
  employeeNo: string;
  department: string;
  classCount: number;
};

type ClassRow = {
  id: string;
  name: string;
  academicYear: string;
  semester: string;
  studentCount: number;
  teamCount: number;
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
  | { kind: 'teachers' }
  | { kind: 'classes'; teacher: TeacherRow }
  | { kind: 'teams'; teacher: TeacherRow; clazz: ClassRow };

export default function TeachingDrillPanel() {
  const [level, setLevel] = useState<Level>({ kind: 'teachers' });
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
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

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">教学使用情况</h2>
        <p className="text-sm text-gray-500 mt-1">查看全部教师开班与组队情况（只读）</p>
      </div>
      <Breadcrumb
        items={[
          {
            title: (
              <button type="button" className="cursor-pointer text-teal-700" onClick={() => setLevel({ kind: 'teachers' })}>
                全部教师
              </button>
            ),
          },
          ...(level.kind !== 'teachers'
            ? [
                {
                  title:
                    level.kind === 'classes' ? (
                      <span>{level.teacher.realName || level.teacher.username}</span>
                    ) : (
                      <button
                        type="button"
                        className="cursor-pointer text-teal-700"
                        onClick={() => setLevel({ kind: 'classes', teacher: level.teacher })}
                      >
                        {level.teacher.realName || level.teacher.username}
                      </button>
                    ),
                },
              ]
            : []),
          ...(level.kind === 'teams' ? [{ title: <span>{level.clazz.name}</span> }] : []),
        ]}
      />
      <Spin spinning={loading}>
        {level.kind === 'teachers' ? (
          teachers.length === 0 ? (
            <Empty description="暂无教师" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {teachers.map((t) => (
                <Card
                  key={t.id}
                  hoverable
                  className="cursor-pointer"
                  onClick={() => setLevel({ kind: 'classes', teacher: t })}
                >
                  <div className="font-semibold text-gray-900">{t.realName || t.username}</div>
                  <div className="text-xs text-gray-500 mt-1">工号 {t.employeeNo || '—'} · {t.department || '未填学院'}</div>
                  <div className="text-sm text-teal-700 mt-2">开班 {t.classCount} 个</div>
                </Card>
              ))}
            </div>
          )
        ) : null}
        {level.kind === 'classes' ? (
          classes.length === 0 ? (
            <Empty description="该教师暂无正式班级" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {classes.map((c) => (
                <Card
                  key={c.id}
                  hoverable
                  className="cursor-pointer"
                  onClick={() => setLevel({ kind: 'teams', teacher: level.teacher, clazz: c })}
                >
                  <div className="font-semibold text-gray-900">{c.name}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {c.academicYear || '学年未填'} · 学生 {c.studentCount} · 已确认队伍 {c.teamCount}
                  </div>
                </Card>
              ))}
            </div>
          )
        ) : null}
        {level.kind === 'teams' ? (
          teams.length === 0 ? (
            <Empty description="该班暂无队伍" />
          ) : (
            <div className="space-y-2">
              {teams.map((t) => (
                <Card key={t.id} size="small">
                  <div className="flex flex-wrap items-center gap-2 justify-between">
                    <div>
                      <span className="font-medium text-gray-900">{t.name}</span>
                      {t.isSolo ? <Tag color="orange" className="ml-2">单人</Tag> : null}
                      <Tag className="ml-2">{t.groupingStatus}</Tag>
                    </div>
                    <div className="text-sm text-gray-600">
                      {t.memberCount} 人 · {t.memberNames || '—'}
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-2 mb-0">
                    队伍过程详情与教师端「全局项目监控 → 团队实训详情」一致；后续可在此嵌入只读驾驶舱。
                  </p>
                </Card>
              ))}
            </div>
          )
        ) : null}
      </Spin>
    </div>
  );
}
