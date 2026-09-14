import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { message } from 'antd';
import {
  clearPortalToken,
  getPortalToken,
  getSavedLoginForm,
  isJwtLikelyValid,
  loginWithApi,
  parseJwtPayload,
  refreshPortalAccessToken,
  saveLoginForm,
  setPortalToken,
  type PortalRole,
} from '../../lib/authApi';
import { studentHasActivePersonalClassWithToken } from '../../lib/studentPortalApi';
import { useSiteBrand } from '../../lib/publicSite';
import { USER_GUIDE_PATH } from '../../lib/appPaths';
import bg from '../../assets/images/bg.jpg';

function getRequiredPortalRole(link: string): PortalRole | null {
  if (link.startsWith('/admin-dashboard')) return 'admin';
  if (link.startsWith('/teacher-dashboard')) return 'teacher';
  if (link.startsWith('/student-center')) return 'student';
  return null;
}

export default function Home() {
  const { logoUrl, siteTitle, heroBackgroundUrl, heroTitle, heroSubtitle, heroDescription } = useSiteBrand();
  const navBrandTitle = siteTitle.trim() || '嘉兴大学创业实训平台';
  const heroBgSrc = heroBackgroundUrl.trim() || bg;
  const heroTitleText = heroTitle.trim();
  const heroSubtitleText = heroSubtitle.trim();
  const heroDescriptionText = heroDescription.trim();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [scrolled, setScrolled] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginRole, setLoginRole] = useState<'student' | 'teacher'>('student');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState<{ name: string; role: 'student' | 'teacher' | 'admin' } | null>(null);
  // 记录点击模块时的目标路径，登录后跳转
  const [pendingNavTarget, setPendingNavTarget] = useState<string>('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginRemember, setLoginRemember] = useState(false);
  const [loginCardMode, setLoginCardMode] = useState<'login' | 'reset'>('login');
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSending, setResetSending] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (searchParams.get('adminExpired') === '1') {
      setSearchParams({}, { replace: true });
      navigate('/admin?expired=1');
    } else if (searchParams.get('teacherExpired') === '1') {
      setLoginError('教师登录已过期，请重新登录');
      setLoginRole('teacher');
      setShowLoginModal(true);
      setSearchParams({}, { replace: true });
    } else if (searchParams.get('studentExpired') === '1') {
      setLoginError('学生登录已过期，请重新登录');
      setLoginRole('student');
      setShowLoginModal(true);
      setSearchParams({}, { replace: true });
    } else if (searchParams.get('studentNoClass') === '1') {
      setLoginError('未进入班级，当前暂无实训');
      setLoginRole('student');
      setShowLoginModal(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!showLoginModal) return;
    const saved = getSavedLoginForm(loginRole);
    setLoginUsername(saved.username);
    setLoginPassword(saved.password);
    setLoginRemember(saved.remember);
  }, [showLoginModal, loginRole]);

  /** 从 Cookie / sessionStorage 恢复登录态；access 过期时尝试 refresh */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const order: PortalRole[] = ['admin', 'teacher', 'student'];
      for (const role of order) {
        let t = getPortalToken(role);
        if (!t) continue;
        if (!isJwtLikelyValid(t)) {
          const refreshed = await refreshPortalAccessToken(role);
          if (!refreshed) {
            clearPortalToken(role);
            continue;
          }
          t = getPortalToken(role);
          if (!t) continue;
        }
        const p = parseJwtPayload(t);
        if (!p || p.role !== role) {
          clearPortalToken(role);
          continue;
        }
        if (cancelled) return;
        setUserInfo({ name: String(p.username || '用户'), role });
        setIsLoggedIn(true);
        return;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const username = loginUsername.trim();
    const password = loginPassword;
    const remember = loginRemember;
    setLoginError('');

    const expected = loginRole as PortalRole;
    setLoginLoading(true);
    try {
      const { token, refreshToken, user } = await loginWithApi(username, password);
      if (user.role !== expected) {
        if (expected === 'teacher') throw new Error('该账号不是教师，请使用教师账号登录');
        throw new Error('该账号不是学生，请使用学生账号登录');
      }
      if (expected === 'student') {
        const canEnter = await studentHasActivePersonalClassWithToken(token);
        if (!canEnter) {
          throw new Error('当前暂无已开放的实训班级');
        }
      }
      saveLoginForm(expected, { remember, username, password });
      setPortalToken(expected, token, remember, refreshToken);
      setUserInfo({ name: user.username, role: expected });
      setIsLoggedIn(true);
      setShowLoginModal(false);

      if (pendingNavTarget) {
        const req = getRequiredPortalRole(pendingNavTarget);
        if (req && req !== expected) {
          message.warning('当前账号与目标模块所需身份不一致，已进入您的个人工作台');
          setPendingNavTarget('');
          navigate(
            expected === 'admin' ? '/admin-dashboard' : expected === 'teacher' ? '/teacher-dashboard' : '/student-center'
          );
          return;
        }
        navigate(pendingNavTarget);
        setPendingNavTarget('');
        return;
      }

      if (expected === 'admin') navigate('/admin-dashboard');
      else if (expected === 'teacher') navigate('/teacher-dashboard');
      else navigate('/student-center');
    } catch (err) {
      setLoginError((err as Error).message || '登录失败');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    if (userInfo?.role) clearPortalToken(userInfo.role);
    setIsLoggedIn(false);
    setUserInfo(null);
  };

  // 点击模块时：未登录先弹登录框，已登录直接跳转
  const handleModuleClick = (link: string, preferRole?: 'student' | 'teacher') => {
    if (!isLoggedIn || !userInfo) {
      setPendingNavTarget(link);
      if (preferRole) setLoginRole(preferRole);
      setShowLoginModal(true);
      return;
    }
    const req = getRequiredPortalRole(link);
    if (req && userInfo.role !== req) {
      message.warning(
        req === 'admin'
          ? '请使用管理员账号访问管理后台'
          : req === 'teacher'
            ? '请使用教师账号访问教师看板'
            : '请使用学生账号访问学生中心'
      );
      return;
    }
    navigate(link);
  };

  const personalCenterLink =
    userInfo?.role === 'teacher' ? '/teacher-dashboard' :
    userInfo?.role === 'admin' ? '/admin-dashboard' :
    '/student-center';

  const personalCenterLabel =
    userInfo?.role === 'teacher' ? '教师看板' :
    userInfo?.role === 'admin' ? '管理后台' :
    '学生中心';

  type HomeModuleCard = {
    icon: string;
    title: string;
    desc: string;
    link: string;
    color: string;
    isTeacher?: boolean;
  };

  const studentCourseModule: HomeModuleCard = {
    icon: 'ri-book-open-line',
    title: '实践课程',
    desc: '按章节学习教师配置的资源，进度达标后可参加知识点检测，常作为实训与待办的前置。',
    link: '/student-center?tab=knowledge',
    color: 'from-indigo-500 to-purple-500',
  };

  const studentStageModules: HomeModuleCard[] = [
    { icon: 'ri-team-line', title: '组队与团队管理', desc: '完成组队测评与团队组建，教师确认后解锁后续阶段。', link: '/student-center?module=team-formation', color: 'from-purple-500 to-purple-600' },
    { icon: 'ri-lightbulb-line', title: '创新思维与创意生成', desc: '选题与创意生成，配合教师审核确定项目方向。', link: '/student-center?module=ideation', color: 'from-teal-500 to-teal-600' },
    { icon: 'ri-search-line', title: '市场调研与用户画像', desc: '问卷、报告与竞品分析，支撑产品与市场决策。', link: '/student-center?module=market-research', color: 'from-green-500 to-green-600' },
    { icon: 'ri-pencil-ruler-line', title: '产品设计与迭代', desc: '产品方案与原型材料，团队分工协作提交。', link: '/student-center?module=product-design', color: 'from-orange-500 to-orange-600' },
    { icon: 'ri-pie-chart-line', title: '商业模式设计', desc: '商业画布、SWOT、营销与财务等环节工具与战情室协作。', link: '/student-center?module=business-model', color: 'from-pink-500 to-pink-600' },
    { icon: 'ri-robot-line', title: 'AI仿真模拟', desc: '基于项目与团队情境进行角色仿真与推演。', link: '/student-center?module=role-simulation', color: 'from-indigo-500 to-indigo-600' },
    { icon: 'ri-file-text-line', title: '商业计划书要点', desc: '汇总各阶段成果，撰写计划书并配合教师审核。', link: '/student-center?module=business-plan', color: 'from-teal-500 to-cyan-600' },
  ];

  const teacherModules: HomeModuleCard[] = [
    {
      icon: 'ri-dashboard-line',
      title: '教师看板',
      desc: '班级与课程配置、任务与通知、组队/选题/计划书审核、项目监控与教学评价。',
      link: '/teacher-dashboard',
      color: 'from-yellow-500 to-orange-500',
      isTeacher: true,
    },
  ];

  const trainingProcessSteps = [
    { step: '1', title: '组队与团队管理', desc: '测评组队，教师确认' },
    { step: '2', title: '创新思维与创意生成', desc: '选题与创意' },
    { step: '3', title: '市场调研与用户画像', desc: '调研与验证' },
    { step: '4', title: '产品设计与迭代', desc: '方案与原型' },
    { step: '5', title: '商业模式设计', desc: '模式与策略' },
    { step: '6', title: 'AI仿真模拟', desc: '角色仿真' },
    { step: '7', title: '商业计划书要点', desc: '成果汇总' },
  ];

  const renderModuleCard = (module: HomeModuleCard, key: string) => (
    <button
      key={key}
      type="button"
      onClick={() => handleModuleClick(module.link, module.isTeacher ? 'teacher' : undefined)}
      className="group bg-white p-8 rounded-2xl shadow-sm hover:shadow-xl transition-all border border-gray-100 hover:border-transparent hover:-translate-y-1 cursor-pointer text-left w-full"
    >
      <div className={`w-14 h-14 flex items-center justify-center bg-gradient-to-br ${module.color} rounded-xl mb-5 group-hover:scale-110 transition-transform`}>
        <i className={`${module.icon} text-2xl text-white`}></i>
      </div>
      <h3 className="text-lg font-bold text-gray-900 mb-3 group-hover:text-teal-600 transition-colors">{module.title}</h3>
      <p className="text-sm text-gray-600 leading-relaxed mb-4">{module.desc}</p>
      <div className="flex items-center justify-between">
        <div className="flex items-center text-teal-500 text-sm font-medium">
          <span>{isLoggedIn ? '进入' : '登录后进入'}</span>
          <i className="ri-arrow-right-line ml-2 group-hover:translate-x-1 transition-transform"></i>
        </div>
        {module.isTeacher && (
          <span className="px-2 py-0.5 bg-orange-100 text-orange-600 text-xs font-medium rounded-full whitespace-nowrap">教师端</span>
        )}
      </div>
    </button>
  );

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white shadow-md' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center rounded-full bg-white/90 shadow overflow-hidden">
              {logoUrl ? (
                <img src={logoUrl} alt="" className="w-9 h-9 object-contain" />
              ) : (
                <img
                  src="https://readdy.ai/api/search-image?query=Jiaxing%20University%20official%20emblem%20badge%20logo%20circular%20seal%20design%20with%20Chinese%20university%20style%2C%20clean%20white%20background%2C%20deep%20teal%20and%20gold%20color%20scheme%2C%20professional%20academic%20institution%20emblem%2C%20minimalist%20modern%20university%20logo%20design%2C%20high%20quality%20vector%20style&width=80&height=80&seq=jxu-logo-nav-001&orientation=squarish"
                  alt="校徽"
                  className="w-9 h-9 object-contain"
                />
              )}
            </div>
            <span className={`text-xl font-bold transition-colors ${scrolled ? 'text-gray-900' : 'text-white'}`}>{navBrandTitle}</span>
          </div>
          <div className="flex items-center gap-8">
            <a href="#modules" className={`text-sm font-medium transition-colors hover:text-teal-500 cursor-pointer ${scrolled ? 'text-gray-700' : 'text-white'}`}>实训模块</a>
            <a href="#features" className={`text-sm font-medium transition-colors hover:text-teal-500 cursor-pointer ${scrolled ? 'text-gray-700' : 'text-white'}`}>平台特色</a>
            <Link to={USER_GUIDE_PATH} className={`text-sm font-medium transition-colors hover:text-teal-500 cursor-pointer whitespace-nowrap ${scrolled ? 'text-gray-700' : 'text-white'}`}>
              <i className="ri-question-line mr-1"></i>帮助中心
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        <img
          src={heroBgSrc}
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-top"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/40"></div>
        <div className="relative z-10 text-center px-6 max-w-5xl mx-auto w-full">
          {heroTitleText ? (
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">{heroTitleText}</h1>
          ) : null}
          {heroSubtitleText ? (
            <p className="text-xl md:text-2xl text-white/95 mb-8 leading-relaxed">{heroSubtitleText}</p>
          ) : null}
          {heroDescriptionText ? (
            <p className="text-base md:text-lg text-white/90 mb-12 max-w-3xl mx-auto">{heroDescriptionText}</p>
          ) : null}
          <div className="flex flex-wrap items-stretch justify-center gap-4">
            <button
              type="button"
              onClick={() => setShowLoginModal(true)}
              className="inline-flex items-center justify-center min-h-[3.5rem] min-w-[11rem] px-8 py-3.5 rounded-xl border-2 border-transparent bg-teal-500 text-white font-bold text-lg hover:bg-teal-600 hover:shadow-2xl hover:scale-105 transition-all whitespace-nowrap box-border"
            >
              现在开始
            </button>
            <Link
              to={USER_GUIDE_PATH}
              className="inline-flex items-center justify-center gap-2 min-h-[3.5rem] min-w-[11rem] px-8 py-3.5 rounded-xl border-2 border-slate-200 bg-white/90 backdrop-blur-sm text-slate-900 font-bold text-lg hover:shadow-xl hover:scale-105 transition-all whitespace-nowrap box-border"
            >
              <i className="ri-book-open-line"></i>
              <span>使用指南</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Platform Overview */}
      <section className="py-20 px-6 bg-gradient-to-br from-gray-50 to-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">平台概览</h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">实践课程与知识点检测打基础，七阶段团队实训递进推进，教师发布任务、审核成果并监控进度</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: 'ri-book-2-line', title: '实践课程与检测', desc: '按章节学习教师配置的资源，进度达标后可参加知识点检测', color: 'from-indigo-500 to-purple-500' },
              { icon: 'ri-git-commit-line', title: '七阶段递进', desc: '组队确认后依次开放创意、市场、产品、商业模式、仿真与计划书等环节', color: 'from-teal-500 to-cyan-500' },
              { icon: 'ri-task-line', title: '待办与通知', desc: '进度看板集中展示教师通知与待办任务，截止与提交要求清晰可查', color: 'from-orange-500 to-amber-500' },
              { icon: 'ri-eye-line', title: '教师跟进', desc: '教师看板支持班级管理、过程监控、动态引导与教学评价', color: 'from-green-500 to-emerald-500' },
            ].map((feature, index) => (
              <div key={index} className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-lg transition-all border border-gray-100 hover:border-teal-200">
                <div className={`w-14 h-14 flex items-center justify-center bg-gradient-to-br ${feature.color} rounded-xl mb-5`}>
                  <i className={`${feature.icon} text-2xl text-white`}></i>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Modules Section */}
      <section id="modules" className="py-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">功能入口</h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">登录后进入学生中心或教师看板；各实训阶段是否开放以班级时间与前置条件为准</p>
            {!isLoggedIn && (
              <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-teal-50 border border-teal-200 rounded-full text-sm text-teal-700">
                <i className="ri-lock-line"></i>
                <span>点击卡片登录后即可进入对应功能</span>
              </div>
            )}
          </div>

          <div className="mb-10">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <i className="ri-user-line text-teal-600"></i>
              学生 · 实践课程
            </h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {renderModuleCard(studentCourseModule, 'course')}
            </div>
          </div>

          <div className="mb-10">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <i className="ri-map-pin-line text-teal-600"></i>
              学生 · 七阶段实训
            </h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {studentStageModules.map((module) => renderModuleCard(module, module.link))}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <i className="ri-user-star-line text-orange-600"></i>
              教师 · 教学管理
            </h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {teacherModules.map((module) => renderModuleCard(module, module.link))}
            </div>
          </div>
        </div>
      </section>

      {/* Process Flow */}
      <section id="process" className="py-20 px-6 bg-gradient-to-br from-teal-50 to-cyan-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">实训阶段顺序</h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">与学生中心侧栏一致；除时间与教师设置外，后续阶段需完成上一环节要求</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
            {trainingProcessSteps.map((item) => (
              <div key={item.step} className="bg-white p-5 rounded-xl shadow-sm border border-teal-100 text-center">
                <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 text-white font-bold flex items-center justify-center text-sm">
                  {item.step}
                </div>
                <h3 className="text-sm font-bold text-gray-900 mb-2 leading-snug">{item.title}</h3>
                <p className="text-xs text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Detail */}
      <section id="features" className="py-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">平台特色</h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">面向高校创新创业实训的真实流程与工具能力</p>
          </div>
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <img
                src="https://readdy.ai/api/search-image?query=diverse%20university%20students%20working%20together%20on%20digital%20tablets%20and%20laptops%20in%20modern%20collaborative%20workspace%2C%20AI%20interface%20elements%20visible%20on%20screens%2C%20bright%20professional%20educational%20environment%20with%20teal%20and%20orange%20design%20accents%2C%20clean%20minimalist%20background%2C%20teamwork%20and%20innovation%20atmosphere&width=800&height=600&seq=feature-img-001&orientation=landscape"
                alt="Platform Features"
                className="w-full h-auto rounded-2xl shadow-xl"
              />
            </div>
            <div className="space-y-8">
              {[
                { icon: 'ri-user-star-line', title: '分端登录与权限', desc: '学生、教师分别登录进入学生中心与教师看板，身份与入口分离', color: 'from-teal-500 to-cyan-500' },
                { icon: 'ri-exchange-line', title: '班级与消息', desc: '支持多教学班切换；通知用于告知，待办任务用于截止与提交', color: 'from-orange-500 to-amber-500' },
                { icon: 'ri-tools-line', title: '环节内工具', desc: '各实训阶段内置商业画布、SWOT、市场调研、战情室等专用工具', color: 'from-purple-500 to-pink-500' },
                { icon: 'ri-line-chart-line', title: '教师监控与评价', desc: '项目监控、动态引导、审核与评价面板，支撑过程性教学管理', color: 'from-green-500 to-emerald-500' },
              ].map((item, index) => (
                <div key={index} className="flex gap-5">
                  <div className={`w-12 h-12 flex items-center justify-center bg-gradient-to-br ${item.color} rounded-xl flex-shrink-0`}>
                    <i className={`${item.icon} text-xl text-white`}></i>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{item.title}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-gradient-to-br from-teal-500 to-cyan-500">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-6">开启创业实训之旅</h2>
          <p className="text-lg text-white/95 mb-6 leading-relaxed">使用学校分配的学号或工号登录；学生需已加入教师开放的教学班</p>
          <div className="flex items-center justify-center gap-4 mb-4">
            <button
              onClick={() => { setLoginRole('teacher'); setShowLoginModal(true); }}
              className="px-8 py-3 bg-white text-teal-600 text-base font-semibold rounded-full hover:bg-gray-50 transition-all hover:scale-105 whitespace-nowrap cursor-pointer"
            >
              教师入口
            </button>
            <button
              onClick={() => { setLoginRole('student'); setShowLoginModal(true); }}
              className="px-8 py-3 bg-white/20 backdrop-blur-sm text-white text-base font-semibold rounded-full hover:bg-white/30 transition-all border border-white/30 whitespace-nowrap cursor-pointer"
            >
              学生入口
            </button>
          </div>
          <p className="text-sm text-white/80">
            平台管理员请访问
            <Link to="/admin" className="underline underline-offset-2 mx-1 hover:text-white">
              管理后台登录
            </Link>
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 overflow-hidden">
                  <img
                    src="https://readdy.ai/api/search-image?query=Jiaxing%20University%20official%20emblem%20badge%20logo%20circular%20seal%20design%20with%20Chinese%20university%20style%2C%20clean%20white%20background%2C%20deep%20teal%20and%20gold%20color%20scheme%2C%20professional%20academic%20institution%20emblem%2C%20minimalist%20modern%20university%20logo%20design%2C%20high%20quality%20vector%20style&width=80&height=80&seq=jxu-logo-footer-001&orientation=squarish"
                    alt="嘉兴大学校徽"
                    className="w-8 h-8 object-contain"
                  />
                </div>
                <span className="text-lg font-bold">嘉兴大学创业实训平台</span>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">专注高校创新创业教育，AI赋能实训全流程</p>
            </div>
            <div>
              <h4 className="text-sm font-bold mb-4">实训入口</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><button onClick={() => handleModuleClick('/student-center?tab=knowledge')} className="hover:text-teal-400 transition-colors cursor-pointer">实践课程</button></li>
                <li><button onClick={() => handleModuleClick('/student-center?module=team-formation')} className="hover:text-teal-400 transition-colors cursor-pointer">组队测评</button></li>
                <li><button onClick={() => handleModuleClick('/student-center?module=ideation')} className="hover:text-teal-400 transition-colors cursor-pointer">创意选题</button></li>
                <li><button onClick={() => handleModuleClick('/student-center?module=market-research')} className="hover:text-teal-400 transition-colors cursor-pointer">市场调研</button></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-bold mb-4">帮助</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#features" className="hover:text-teal-400 transition-colors cursor-pointer">平台介绍</a></li>
                <li><Link to={USER_GUIDE_PATH} className="hover:text-teal-400 transition-colors">使用指南</Link></li>
                <li><Link to={USER_GUIDE_PATH} className="hover:text-teal-400 transition-colors">常见问题</Link></li>
                <li><a href="mailto:jwc@zjxu.edu.cn" className="hover:text-teal-400 transition-colors cursor-pointer">联系我们</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-bold mb-4">联系方式</h4>
              <ul className="space-y-3 text-sm text-gray-400">
                <li className="flex items-start gap-2">
                  <i className="ri-map-pin-line mt-0.5 flex-shrink-0 text-teal-400"></i>
                  <span>浙江省嘉兴市南湖区越秀南路56号<br />嘉兴大学（越秀校区）</span>
                </li>
                <li className="flex items-center gap-2"><i className="ri-phone-line flex-shrink-0 text-teal-400"></i><span>0573-83640000</span></li>
                <li className="flex items-center gap-2"><i className="ri-mail-line flex-shrink-0 text-teal-400"></i><span>jwc@zjxu.edu.cn</span></li>
                <li className="flex items-center gap-2">
                  <i className="ri-global-line flex-shrink-0 text-teal-400"></i>
                  <a href="https://www.zjxu.edu.cn" target="_blank" rel="noopener noreferrer nofollow" className="hover:text-teal-400 transition-colors cursor-pointer">www.zjxu.edu.cn</a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-400">© 2025 嘉兴大学创业实训平台. All rights reserved.</p>
            <a href=" " target="_blank" rel="noopener noreferrer nofollow" className="text-sm text-gray-400 hover:text-teal-400 transition-colors cursor-pointer">Powered by 天明嘉兴智能科技</a>
          </div>
        </div>
      </footer>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="bg-gradient-to-r from-teal-500 to-cyan-600 p-6 text-white">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-2xl font-bold">{loginCardMode === 'login' ? '登录' : '重置密码'}</h2>
                <button
                  onClick={() => {
                    setShowLoginModal(false);
                    setPendingNavTarget('');
                    setLoginError('');
                    setLoginCardMode('login');
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors cursor-pointer"
                >
                  <i className="ri-close-line text-xl"></i>
                </button>
              </div>
              <p className="text-teal-100">
                {pendingNavTarget ? '登录后即可进入对应模块' : '欢迎回到嘉兴大学创业实训平台'}
              </p>
            </div>
            <div className="p-6">
              {loginCardMode === 'login' && (
                <div className="flex gap-3 mb-6">
                  {(['student', 'teacher'] as const).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => {
                        setLoginRole(role);
                        setLoginError('');
                      }}
                      className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all cursor-pointer ${loginRole === role ? 'bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-lg' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      <i className={`${role === 'student' ? 'ri-user-line' : 'ri-user-star-line'} mr-2`}></i>
                      {role === 'student' ? '学生' : '教师'}
                    </button>
                  ))}
                </div>
              )}
              <form
                onSubmit={loginCardMode === 'login' ? handleLogin : (e) => e.preventDefault()}
                className="space-y-4"
                autoComplete="off"
              >
                {loginCardMode === 'login' ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {loginRole === 'student' ? '学号' : '工号'}
                      </label>
                      <input
                        type="text"
                        name="username"
                        required
                        autoComplete="off"
                        value={loginUsername}
                        onChange={(ev) => setLoginUsername(ev.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-sm"
                        placeholder={loginRole === 'student' ? '请输入学号' : '请输入工号'}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">密码</label>
                      <input
                        type="password"
                        name="password"
                        required
                        autoComplete="off"
                        value={loginPassword}
                        onChange={(ev) => setLoginPassword(ev.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-sm"
                        placeholder="请输入密码"
                      />
                    </div>
                    {loginError && (
                      <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{loginError}</p>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          name="remember"
                          checked={loginRemember}
                          onChange={(ev) => setLoginRemember(ev.target.checked)}
                          className="w-4 h-4 text-teal-500 rounded focus:ring-teal-500"
                        />
                        <span className="text-gray-600">记住我</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setResetEmail('');
                          setResetCode('');
                          setResetNewPassword('');
                          setLoginCardMode('reset');
                        }}
                        className="text-teal-600 hover:text-teal-700 font-medium cursor-pointer"
                      >
                        忘记密码？
                      </button>
                    </div>
                    <button
                      type="submit"
                      disabled={loginLoading}
                      className="w-full py-3 bg-gradient-to-r from-teal-500 to-cyan-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {loginLoading ? '登录中…' : loginRole === 'teacher' ? '进入教师看板' : '进入学生中心'}
                    </button>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">邮箱</label>
                      <input
                        type="email"
                        autoComplete="off"
                        value={resetEmail}
                        onChange={(ev) => setResetEmail(ev.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-sm"
                        placeholder="请输入邮箱"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">验证码</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          autoComplete="off"
                          value={resetCode}
                          onChange={(ev) => setResetCode(ev.target.value)}
                          className="flex-1 min-w-0 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-sm"
                          placeholder="请输入验证码"
                        />
                        <button
                          type="button"
                          disabled={resetSending}
                          onClick={async () => {
                            setResetSending(true);
                            try {
                              const r = await fetch('/api/auth/password-reset/code', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ email: resetEmail }),
                              });
                              const j = await r.json().catch(() => ({ code: -1, message: '无效响应' }));
                              if (!r.ok || j.code !== 0) throw new Error(j.message || `HTTP ${r.status}`);
                              message.success('验证码已发送');
                            } catch (e: any) {
                              message.error(e?.message || '发送失败');
                            } finally {
                              setResetSending(false);
                            }
                          }}
                          className="flex-shrink-0 px-4 py-3 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          {resetSending ? '发送中…' : '获取验证码'}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">新密码</label>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={resetNewPassword}
                        onChange={(ev) => setResetNewPassword(ev.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-sm"
                        placeholder="至少 6 位"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={resetLoading}
                      onClick={async () => {
                        setResetLoading(true);
                        try {
                          const r = await fetch('/api/auth/password-reset/confirm', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email: resetEmail, code: resetCode, newPassword: resetNewPassword }),
                          });
                          const j = await r.json().catch(() => ({ code: -1, message: '无效响应' }));
                          if (!r.ok || j.code !== 0) throw new Error(j.message || `HTTP ${r.status}`);
                          message.success('密码已重置，请使用新密码登录');
                          setLoginCardMode('login');
                        } catch (e: any) {
                          message.error(e?.message || '重置失败');
                        } finally {
                          setResetLoading(false);
                        }
                      }}
                      className="w-full py-3 bg-gradient-to-r from-teal-500 to-cyan-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {resetLoading ? '提交中…' : '确认重置'}
                    </button>
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => setLoginCardMode('login')}
                        className="text-sm text-teal-600 hover:text-teal-700 font-medium cursor-pointer"
                      >
                        返回登录
                      </button>
                    </div>
                  </>
                )}
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
