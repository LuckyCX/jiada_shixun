/**
 * /student-center 统一入口：
 * - 教师备课会话激活 → 本地备课学生端（不落库）
 * - 否则走正式学生鉴权与入班校验
 */
import { lazy, Suspense, type ReactNode } from 'react';
import { getPortalToken, isJwtLikelyValid, parseJwtPayload } from '../lib/authApi';
import { getActiveTeacherPrepSession } from '../lib/teacherPrepMode';
import RequireRole from './RequireRole';
import RequireStudentPersonalClass from './RequireStudentPersonalClass';

const StudentCenterPage = lazy(() => import('../pages/student-center/page'));
const TeacherPrepStudentPage = lazy(() => import('../pages/student-center/TeacherPrepStudentPage'));

function FallBack() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 text-sm text-gray-500">
      加载中…
    </div>
  );
}

function Wrap({ children }: { children: ReactNode }) {
  return <Suspense fallback={<FallBack />}>{children}</Suspense>;
}

export default function StudentCenterGate() {
  const prep = getActiveTeacherPrepSession();
  const teacherToken = getPortalToken('teacher');
  const teacherOk =
    Boolean(prep?.teacherId) &&
    Boolean(teacherToken) &&
    isJwtLikelyValid(teacherToken!) &&
    parseJwtPayload(teacherToken!)?.role === 'teacher' &&
    String(parseJwtPayload(teacherToken!)?.sub || '') === String(prep!.teacherId);

  if (teacherOk) {
    return (
      <Wrap>
        <TeacherPrepStudentPage />
      </Wrap>
    );
  }

  return (
    <RequireRole role="student">
      <RequireStudentPersonalClass>
        <Wrap>
          <StudentCenterPage />
        </Wrap>
      </RequireStudentPersonalClass>
    </RequireRole>
  );
}
