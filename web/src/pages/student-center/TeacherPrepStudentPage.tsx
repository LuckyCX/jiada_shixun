/**
 * 教师顶栏进入的「学生端」全页：布局与学生中心一致，模块复用教学演示镜像，
 * 进度按教师账号写入 localStorage，不落学生业务库。
 *
 * classId 传真实备课班壳数字 id（供 team-questions / demo AI 等接口）；
 * demoStore 在备课会话激活时把该 id 映射到 teacher-prep-{teacherId} 本地键。
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, message } from 'antd';
import { useSiteBrand } from '../../lib/publicSite';
import { clearPortalToken, getPortalToken, parseJwtPayload } from '../../lib/authApi';
import {
  clearActiveTeacherPrepSession,
  getActiveTeacherPrepSession,
} from '../../lib/teacherPrepMode';
import { COURSE_SETTING_STAGES, type CourseSettingStageKey } from '../../lib/courseSettingsApi';
import ClassDemoPage from '../teacher-dashboard/components/classDemo/ClassDemoPage';
import type { DemoStageKey } from '../teacher-dashboard/components/classDemo/demoStore';

const ALL_MODULES = COURSE_SETTING_STAGES.map((s) => s.key) as CourseSettingStageKey[];

export default function TeacherPrepStudentPage() {
  const navigate = useNavigate();
  const { logoUrl, siteTitle } = useSiteBrand();
  const brandTitle = siteTitle.trim() || '创业实训平台';
  const session = getActiveTeacherPrepSession();
  const teacherId = session?.teacherId || parseJwtPayload(getPortalToken('teacher') || '')?.sub || '';
  const prepClassId = String(session?.prepClassId || '').trim();
  const className = session?.className || '备课·学生端';
  const [stage, setStage] = useState<DemoStageKey>('overview');
  const sessionValid = Boolean(teacherId && prepClassId && /^\d+$/.test(prepClassId) && getPortalToken('teacher'));

  const enabledModuleKeys = useMemo(() => ALL_MODULES, []);

  useEffect(() => {
    if (sessionValid) return;
    message.warning('备课会话已失效，请从教师端重新进入');
    clearActiveTeacherPrepSession();
    navigate('/teacher-dashboard', { replace: true });
  }, [navigate, sessionValid]);

  const backToTeacher = () => {
    clearActiveTeacherPrepSession();
    navigate('/teacher-dashboard', { replace: true });
  };

  if (!sessionValid) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">正在返回教师端…</div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-gray-100 shadow-sm px-4 md:px-6 py-3 flex items-center justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-8 w-auto object-contain" />
          ) : (
            <i className="ri-graduation-cap-line text-2xl text-teal-600" />
          )}
          <div className="min-w-0">
            <div className="text-sm font-bold text-gray-900 truncate">{brandTitle}</div>
            <div className="text-xs text-amber-700 truncate">备课模式 · 学生端（数据仅保存在本机浏览器）</div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button type="default" onClick={backToTeacher}>
            返回教师端
          </Button>
          <Button
            type="text"
            danger
            onClick={() => {
              clearActiveTeacherPrepSession();
              clearPortalToken('teacher');
              window.location.replace('/');
            }}
          >
            退出登录
          </Button>
        </div>
      </header>
      <main className="flex-1 min-h-0 overflow-auto px-3 pt-2 pb-3 md:px-4 md:pt-3 md:pb-4">
        <ClassDemoPage
          classId={prepClassId}
          className={className}
          enabledModuleKeys={enabledModuleKeys}
          stage={stage}
          onStageChange={setStage}
          prepMode
        />
      </main>
    </div>
  );
}
