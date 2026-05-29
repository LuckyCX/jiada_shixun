import { Link } from 'react-router-dom';
import { UserGuideContent } from './UserGuideContent';

export default function UserGuidePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all">
                <i className="ri-graduation-cap-line text-white text-xl"></i>
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                嘉兴大学创业实训平台
              </span>
            </Link>
            <Link
              to="/"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              <i className="ri-home-line"></i>
              <span className="text-sm font-medium">返回首页</span>
            </Link>
          </div>
        </div>
      </nav>
      <UserGuideContent />
    </div>
  );
}
