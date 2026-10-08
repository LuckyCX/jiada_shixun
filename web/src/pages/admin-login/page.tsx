import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { message } from 'antd';
import {
  getSavedLoginForm,
  loginWithApi,
  notifyMustChangePasswordIfNeeded,
  saveLoginForm,
  setPortalToken,
  type PortalRole,
} from '../../lib/authApi';
import { useSiteBrand } from '../../lib/publicSite';

export default function AdminLoginPage() {
  const { siteTitle } = useSiteBrand();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginRemember, setLoginRemember] = useState(false);

  useEffect(() => {
    if (searchParams.get('expired') === '1') {
      setLoginError('管理员登录已过期，请重新登录');
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const saved = getSavedLoginForm('admin');
    setLoginUsername(saved.username);
    setLoginPassword(saved.password);
    setLoginRemember(saved.remember);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const username = loginUsername.trim();
    const password = loginPassword;
    const remember = loginRemember;
    setLoginError('');
    setLoginLoading(true);
    try {
      const expected = 'admin' as PortalRole;
      const { token, refreshToken, user, mustChangePassword } = await loginWithApi(username, password);
      if (user.role !== expected) throw new Error('该账号不是管理员，请使用管理员账号登录');
      saveLoginForm(expected, { remember, username, password });
      setPortalToken(expected, token, remember, refreshToken);
      notifyMustChangePasswordIfNeeded(expected, token, mustChangePassword);
      message.success('登录成功');
      navigate('/admin-dashboard', { replace: true });
    } catch (e: any) {
      setLoginError(e?.message || '登录失败');
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 bg-gradient-to-r from-teal-500 to-cyan-600 text-white">
          <div className="text-lg font-bold">{(siteTitle || '嘉兴大学创业实训平台').trim()}</div>
          <div className="text-sm text-white/80 mt-0.5">管理员登录</div>
        </div>
        <div className="p-6">
          <form onSubmit={handleLogin} className="space-y-4" autoComplete="off">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">用户名 / 邮箱 / 手机号</label>
              <input
                type="text"
                required
                autoComplete="off"
                value={loginUsername}
                onChange={(ev) => setLoginUsername(ev.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-sm"
                placeholder="请输入用户名、邮箱或手机号"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">密码</label>
              <input
                type="password"
                required
                autoComplete="off"
                value={loginPassword}
                onChange={(ev) => setLoginPassword(ev.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-sm"
                placeholder="请输入密码"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={loginRemember}
                onChange={(ev) => setLoginRemember(ev.target.checked)}
                className="w-4 h-4 text-teal-500 rounded focus:ring-teal-500"
              />
              <span className="text-gray-600">记住我</span>
            </label>

            {loginError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{loginError}</p>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 bg-gradient-to-r from-teal-500 to-cyan-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loginLoading ? '登录中…' : '进入管理后台'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

