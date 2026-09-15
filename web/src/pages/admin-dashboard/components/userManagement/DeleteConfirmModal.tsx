import { useEffect, useState } from 'react';
import AppModalPortal from '../../../../components/AppModalPortal';
import { User } from './types';
import { fetchAdminUserDeleteImpact, type AdminUserDeleteImpact } from './adminUsersApi';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  user: User | null;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}

export default function DeleteConfirmModal({ isOpen, user, onClose, onConfirm }: DeleteConfirmModalProps) {
  const [loading, setLoading] = useState(false);
  const [impactLoading, setImpactLoading] = useState(false);
  const [impact, setImpact] = useState<AdminUserDeleteImpact | null>(null);
  const [impactError, setImpactError] = useState('');

  useEffect(() => {
    if (!isOpen || !user) {
      setImpact(null);
      setImpactError('');
      return;
    }
    let cancelled = false;
    setImpactLoading(true);
    setImpactError('');
    fetchAdminUserDeleteImpact(user.id)
      .then((data) => {
        if (!cancelled) setImpact(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setImpact(null);
          setImpactError(e instanceof Error ? e.message : '无法加载删除影响');
        }
      })
      .finally(() => {
        if (!cancelled) setImpactLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

  const role = impact?.role || user.role;
  const classes = impact?.personalClasses ?? [];

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await Promise.resolve(onConfirm());
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppModalPortal open onMaskClick={loading ? undefined : onClose} zIndex={1100}>
      <div
        className="bg-white rounded-xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-4">
            <i className="ri-error-warning-line text-3xl text-red-600"></i>
          </div>

          <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">确认删除用户</h3>
          <p className="text-sm text-gray-600 text-center mb-4">
            确定要删除用户 <span className="font-semibold text-gray-900">{user.name}</span> 吗？
            <br />
            此操作不可恢复，该账号将无法再登录。
          </p>

          <div className="mb-6 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-gray-700 space-y-2">
            <p className="font-medium text-red-700 m-0">风险提示</p>
            {impactLoading ? (
              <p className="m-0 text-gray-500">正在加载影响范围…</p>
            ) : impactError ? (
              <p className="m-0 text-amber-700">{impactError}（仍可删除，请谨慎确认）</p>
            ) : role === 'teacher' ? (
              <>
                <p className="m-0">
                  将自动解散该教师创建的全部个性化班级
                  {classes.length ? `（共 ${classes.length} 个）` : ''}，班内学生将失去对应班级归属。
                </p>
                {classes.length > 0 ? (
                  <ul className="list-disc pl-5 m-0 max-h-32 overflow-y-auto text-gray-800">
                    {classes.slice(0, 12).map((c) => (
                      <li key={c.id}>
                        {c.name}
                        {c.studentCount != null ? `（${c.studentCount} 名学生）` : ''}
                      </li>
                    ))}
                    {classes.length > 12 ? <li>…另有 {classes.length - 12} 个班级</li> : null}
                  </ul>
                ) : (
                  <p className="m-0 text-gray-500">当前无个性化班级。</p>
                )}
              </>
            ) : role === 'student' ? (
              <>
                <p className="m-0">
                  将自动退出该学生已被拉入的全部个性化班级
                  {classes.length ? `（共 ${classes.length} 个）` : ''}。
                </p>
                <p className="m-0">账号删除后不可再登录；同号重建不会自动回到原个性化班。</p>
                {classes.length > 0 ? (
                  <ul className="list-disc pl-5 m-0 max-h-32 overflow-y-auto text-gray-800">
                    {classes.slice(0, 12).map((c) => (
                      <li key={c.id}>{c.name}</li>
                    ))}
                    {classes.length > 12 ? <li>…另有 {classes.length - 12} 个班级</li> : null}
                  </ul>
                ) : (
                  <p className="m-0 text-gray-500">当前未加入任何个性化班级。</p>
                )}
              </>
            ) : (
              <p className="m-0">该用户的相关数据将被永久删除。</p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors whitespace-nowrap disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void handleConfirm()}
              className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors whitespace-nowrap disabled:opacity-50"
            >
              {loading ? '删除中…' : '确认删除'}
            </button>
          </div>
        </div>
      </div>
    </AppModalPortal>
  );
}
