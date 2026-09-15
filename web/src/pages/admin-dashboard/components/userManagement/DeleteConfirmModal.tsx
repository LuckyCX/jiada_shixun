import { useState } from 'react';
import AppModalPortal from '../../../../components/AppModalPortal';
import { User } from './types';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  user: User | null;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}

export default function DeleteConfirmModal({ isOpen, user, onClose, onConfirm }: DeleteConfirmModalProps) {
  const [loading, setLoading] = useState(false);

  if (!isOpen || !user) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await Promise.resolve(onConfirm());
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppModalPortal open onMaskClick={onClose} zIndex={1100}>
      <div
        className="bg-white rounded-xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-4">
            <i className="ri-error-warning-line text-3xl text-red-600"></i>
          </div>

          <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">确认删除用户</h3>
          <p className="text-sm text-gray-600 text-center mb-6">
            确定要删除用户 <span className="font-semibold text-gray-900">{user.name}</span> 吗？
            <br />
            此操作不可恢复，该用户的所有数据将被永久删除。
          </p>

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
