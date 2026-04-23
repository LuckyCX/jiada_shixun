
import { useState } from 'react';
import { User } from './types';

interface ResetPasswordModalProps {
  isOpen: boolean;
  user: User | null;
  onClose: () => void;
  onConfirm: (userId: string, newPassword: string) => void;
}

export default function ResetPasswordModal({ isOpen, user, onClose, onConfirm }: ResetPasswordModalProps) {
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const generatedPassword = `Reset@${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  const handleClose = () => {
    setMode('auto');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setShowPassword(false);
    onClose();
  };

  const handleConfirm = () => {
    if (mode === 'manual') {
      if (!newPassword) {
        setError('请输入新密码');
        return;
      }
      if (newPassword.length < 8) {
        setError('密码长度不能少于8位');
        return;
      }
      if (newPassword !== confirmPassword) {
        setError('两次输入的密码不一致');
        return;
      }
    }
    const finalPassword = mode === 'auto' ? generatedPassword : newPassword;
    onConfirm(user!.id, finalPassword);
    handleClose();
  };

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
        <div className="p-6">
          {/* 头部 */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
                <i className="ri-lock-password-line text-amber-500 text-lg"></i>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">重置密码</h3>
                <p className="text-xs text-gray-500 mt-0.5">用户：{user.name}</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            >
              <i className="ri-close-line text-lg"></i>
            </button>
          </div>

          {/* 模式切换 */}
          <div className="flex gap-2 mb-5 p-1 bg-gray-100 rounded-lg">
            <button
              onClick={() => { setMode('auto'); setError(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap cursor-pointer ${
                mode === 'auto' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <i className="ri-magic-line mr-1.5"></i>
              自动生成
            </button>
            <button
              onClick={() => { setMode('manual'); setError(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap cursor-pointer ${
                mode === 'manual' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <i className="ri-keyboard-line mr-1.5"></i>
              手动设置
            </button>
          </div>

          {mode === 'auto' ? (
            <div className="mb-5">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <i className="ri-information-line text-amber-500 text-sm"></i>
                  <span className="text-xs font-medium text-amber-700">系统将自动生成新密码</span>
                </div>
                <div className="flex items-center justify-between bg-white rounded-md px-3 py-2 border border-amber-200">
                  <span className="text-sm font-mono font-semibold text-gray-800 tracking-wider">
                    {showPassword ? generatedPassword : '••••••••••••'}
                  </span>
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-400 hover:text-gray-600 cursor-pointer ml-2"
                  >
                    <i className={`${showPassword ? 'ri-eye-off-line' : 'ri-eye-line'} text-sm`}></i>
                  </button>
                </div>
                <p className="text-xs text-amber-600 mt-2">
                  <i className="ri-alert-line mr-1"></i>
                  重置后请及时将新密码告知用户，密码仅显示一次
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 mb-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">新密码</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setError(''); }}
                    placeholder="请输入新密码（至少8位）"
                    className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                  />
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    <i className={`${showPassword ? 'ri-eye-off-line' : 'ri-eye-line'} text-sm`}></i>
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">确认新密码</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                  placeholder="请再次输入新密码"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                />
              </div>
              {error && (
                <div className="flex items-center gap-1.5 text-red-500 text-xs">
                  <i className="ri-error-warning-line"></i>
                  {error}
                </div>
              )}
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 px-4 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors whitespace-nowrap cursor-pointer"
            >
              <i className="ri-lock-password-line mr-1.5"></i>
              确认重置
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
