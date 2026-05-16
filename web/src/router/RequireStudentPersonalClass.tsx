import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { clearPortalToken } from '../lib/authApi';
import { fetchStudentPersonalEnrollments } from '../lib/studentPortalApi';

type Props = {
  children: ReactNode;
};

/** 学生须已被教师拉入至少一个个性化班级，否则退回首页 */
export default function RequireStudentPersonalClass({ children }: Props) {
  const [gate, setGate] = useState<'loading' | 'ok' | 'denied'>('loading');

  useEffect(() => {
    let cancelled = false;
    fetchStudentPersonalEnrollments()
      .then((list) => {
        if (cancelled) return;
        setGate(list.length > 0 ? 'ok' : 'denied');
      })
      .catch(() => {
        if (!cancelled) setGate('denied');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (gate === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500 text-sm">
        加载中…
      </div>
    );
  }

  if (gate === 'denied') {
    clearPortalToken('student');
    return <Navigate to="/?studentNoClass=1" replace />;
  }

  return <>{children}</>;
}
