import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ADMIN_TOKEN_KEY, loginWithApi } from '../../lib/authApi';
import { useSiteBrand } from '../../lib/publicSite';

export default function Home() {
  const { logoUrl, siteTitle } = useSiteBrand();
  const navBrandTitle = siteTitle.trim() || '嘉兴大学创业实训平台';
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginRole, setLoginRole] = useState<'student' | 'teacher' | 'admin'>('student');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState<{ name: string; role: 'student' | 'teacher' | 'admin' } | null>(null);
  // 记录点击模块时的目标路径，登录后跳转
  const [pendingNavTarget, setPendingNavTarget] = useState<string>('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const username = (form.elements.namedItem('username') as HTMLInputElement).value;
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;
    setLoginError('');

    if (loginRole === 'admin') {
      setLoginLoading(true);
      try {
        const { token, user } = await loginWithApi(username, password);
        if (user.role !== 'admin') {
          throw new Error('该账号不是管理员，请使用管理员账号登录');
        }
        localStorage.setItem(ADMIN_TOKEN_KEY, token);
        setUserInfo({ name: user.username, role: 'admin' });
        setIsLoggedIn(true);
        setShowLoginModal(false);

        if (pendingNavTarget) {
          navigate(pendingNavTarget);
          setPendingNavTarget('');
          return;
        }
        navigate('/admin-dashboard');
      } catch (err) {
        setLoginError((err as Error).message || '登录失败');
      } finally {
        setLoginLoading(false);
      }
      return;
    }

    // 学生 / 教师：演示环境暂无统一账号接口，仍走本地状态（后续可接真实登录）
    setUserInfo({ name: username, role: loginRole });
    setIsLoggedIn(true);
    setShowLoginModal(false);

    if (pendingNavTarget) {
      navigate(pendingNavTarget);
      setPendingNavTarget('');
      return;
    }

    if (loginRole === 'teacher') navigate('/teacher-dashboard');
    else navigate('/student-center');
  };

  const handleLogout = () => {
    if (userInfo?.role === 'admin') {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
    }
    setIsLoggedIn(false);
    setUserInfo(null);
  };

  // 点击模块时：未登录先弹登录框，已登录直接跳转
  const handleModuleClick = (link: string, preferRole?: 'student' | 'teacher') => {
    if (!isLoggedIn) {
      setPendingNavTarget(link);
      if (preferRole) setLoginRole(preferRole);
      setShowLoginModal(true);
    } else {
      navigate(link);
    }
  };

  const personalCenterLink =
    userInfo?.role === 'teacher' ? '/teacher-dashboard' :
    userInfo?.role === 'admin' ? '/admin-dashboard' :
    '/student-center';

  const personalCenterLabel =
    userInfo?.role === 'teacher' ? '教师看板' :
    userInfo?.role === 'admin' ? '管理后台' :
    '学生中心';

  // 实训模块配置：link 为学生端路径，teacherLink 为教师端路径（可选）
  const trainingModules = [
    { icon: 'ri-team-line', title: '组队与团队管理', desc: '智能匹配，组建团队', link: '/student-center?module=team-formation', color: 'from-teal-500 to-cyan-500' },
    { icon: 'ri-book-open-line', title: '实践课程', desc: '学习→实践→评价→能力获取，可视化学习进度', link: '/knowledge-system', color: 'from-indigo-500 to-purple-500' },
    { icon: 'ri-lightbulb-line', title: '创新思维与创意生成', desc: '运用SCAMPER、头脑风暴等方法，激发创新思维', link: '/student-center?module=ideation', color: 'from-orange-500 to-amber-500' },
    { icon: 'ri-bar-chart-line', title: '市场调研与用户画像', desc: '数据驱动决策，精准定位目标用户群体', link: '/student-center?module=market-research', color: 'from-purple-500 to-pink-500' },
    { icon: 'ri-pencil-ruler-2-line', title: '产品设计与原型', desc: '从功能设计到原型绘制，将创意转化为产品', link: '/student-center?module=product-design', color: 'from-orange-500 to-amber-500' },
    { icon: 'ri-briefcase-line', title: '商业模式画布', desc: '构建完整商业模式，SWOT分析与营销策略', link: '/student-center?module=business-model', color: 'from-green-500 to-emerald-500' },
    { icon: 'ri-robot-line', title: 'AI角色推荐', desc: '基于项目特征与成员能力，智能推荐团队角色', link: '/student-center?module=role-simulation', color: 'from-red-500 to-rose-500' },
    { icon: 'ri-file-text-line', title: '商业计划书', desc: '整合所有成果，生成专业商业计划书与路演PPT', link: '/student-center?module=business-plan', color: 'from-violet-500 to-purple-500' },
    { icon: 'ri-star-line', title: '教学评价', desc: '双维评价体系，评价智能体全周期采集数据，科学评估学习成果', link: '/teacher-dashboard', color: 'from-yellow-500 to-orange-500', isTeacher: true },
    { icon: 'ri-refresh-line', title: '迭代优化与数据看板', desc: '构建-衡量-学习循环，数据驱动持续优化', link: '/iteration-optimization', color: 'from-teal-500 to-emerald-500' },
  ];

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
            <a href="#process" className={`text-sm font-medium transition-colors hover:text-teal-500 cursor-pointer ${scrolled ? 'text-gray-700' : 'text-white'}`}>实训流程</a>
            <Link to="/user-guide" className={`text-sm font-medium transition-colors hover:text-teal-500 cursor-pointer whitespace-nowrap ${scrolled ? 'text-gray-700' : 'text-white'}`}>
              <i className="ri-question-line mr-1"></i>帮助中心
            </Link>
            {!isLoggedIn ? (
              <button
                onClick={() => setShowLoginModal(true)}
                className="px-5 py-2 bg-teal-500 text-white text-sm font-medium rounded-full hover:bg-teal-600 transition-colors whitespace-nowrap cursor-pointer"
              >
                登录
              </button>
            ) : (
              <div className="flex items-center gap-4">
                <Link
                  to={personalCenterLink}
                  className="flex items-center gap-2 px-5 py-2 bg-teal-500 text-white text-sm font-medium rounded-full hover:bg-teal-600 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <i className="ri-user-line"></i>个人中心
                </Link>
                <div className="relative group">
                  <button className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${scrolled ? 'text-gray-700 hover:bg-gray-100' : 'text-white hover:bg-white/10'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${userInfo?.role === 'admin' ? 'bg-gradient-to-br from-purple-500 to-pink-500' : userInfo?.role === 'teacher' ? 'bg-gradient-to-br from-orange-500 to-amber-500' : 'bg-gradient-to-br from-teal-500 to-cyan-600'}`}>
                      {userInfo?.name.charAt(0)}
                    </div>
                    <span className="text-sm font-medium">{userInfo?.name}</span>
                    <i className="ri-arrow-down-s-line"></i>
                  </button>
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                    <div className="p-4 border-b border-gray-100">
                      <div className="text-sm font-medium text-gray-900">{userInfo?.name}</div>
                      <div className="text-xs text-gray-500">{userInfo?.role === 'admin' ? '管理员' : userInfo?.role === 'teacher' ? '教师' : '学生'}</div>
                    </div>
                    <Link to={personalCenterLink} className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2">
                      <i className="ri-dashboard-line"></i>{personalCenterLabel}
                    </Link>
                    <button onClick={handleLogout} className="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2">
                      <i className="ri-logout-box-line"></i>退出登录
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        <img
          src="https://readdy.ai/api/search-image?query=young%20Chinese%20college%20students%20group%20sitting%20around%20table%20in%20bright%20modern%20university%20library%20study%20room%2C%20Asian%20young%20men%20and%20women%20smiling%20discussing%20startup%20project%20together%2C%20notebooks%20laptops%20on%20desk%2C%20warm%20sunlight%20through%20windows%2C%20cheerful%20energetic%20campus%20atmosphere%2C%20shallow%20depth%20of%20field%20photography%20style%2C%20high%20resolution&width=1920&height=1080&seq=hero-bg-chinese-students-2025&orientation=landscape"
          alt="Hero Background"
          className="absolute inset-0 w-full h-full object-cover object-top"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/40"></div>
        <div className="relative z-10 text-center px-6 max-w-5xl mx-auto w-full">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">大学生创业实训平台</h1>
          <p className="text-xl md:text-2xl text-white/95 mb-8 leading-relaxed">从创意到商业计划，AI赋能全流程数字化实训体验</p>
          <p className="text-base md:text-lg text-white/90 mb-12 max-w-3xl mx-auto">支持7大核心模块，团队协作，过程留痕，智能评价，助力高校创新创业教育</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => setShowLoginModal(true)}
              className="px-8 py-4 rounded-xl bg-teal-500 text-white font-bold text-lg hover:bg-teal-600 hover:shadow-2xl hover:scale-105 transition-all whitespace-nowrap"
            >
              立即开始实训
            </button>
            <Link
              to="/user-guide"
              className="px-8 py-4 rounded-xl bg-white/90 backdrop-blur-sm text-slate-900 font-bold text-lg hover:shadow-xl hover:scale-105 transition-all border-2 border-slate-200 whitespace-nowrap flex items-center gap-2"
            >
              <i className="ri-book-open-line"></i><span>使用指南</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Platform Overview */}
      <section className="py-20 px-6 bg-gradient-to-br from-gray-50 to-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">平台概览</h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">遵循"组队→创新→调研→设计→商业模式→仿真→计划书→评价"的完整逻辑，形成实训-指导-审核-评价的闭环</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: 'ri-ai-generate', title: 'AI全程辅助', desc: '每个环节都有AI对话助手，提供智能建议和指导', color: 'from-teal-500 to-cyan-500' },
              { icon: 'ri-team-fill', title: '团队协作', desc: '实时协作编辑，版本管理，讨论区互动', color: 'from-orange-500 to-amber-500' },
              { icon: 'ri-file-chart-line', title: '数字化留痕', desc: '全流程记录，成果自动沉淀，支持回溯查看', color: 'from-purple-500 to-pink-500' },
              { icon: 'ri-eye-line', title: '过程监控', desc: '教师实时查看进度，动态指导，及时干预', color: 'from-green-500 to-emerald-500' },
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
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">实训模块</h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">10大核心模块，覆盖创业全流程，每个环节都有AI智能辅助</p>
            {!isLoggedIn && (
              <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-teal-50 border border-teal-200 rounded-full text-sm text-teal-700">
                <i className="ri-lock-line"></i>
                <span>点击任意模块，登录后即可进入</span>
              </div>
            )}
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {trainingModules.map((module, index) => (
              <button
                key={index}
                onClick={() => handleModuleClick(module.link, (module as any).isTeacher ? 'teacher' : undefined)}
                className="group bg-white p-8 rounded-2xl shadow-sm hover:shadow-xl transition-all border border-gray-100 hover:border-transparent hover:-translate-y-1 cursor-pointer text-left w-full"
              >
                <div className={`w-14 h-14 flex items-center justify-center bg-gradient-to-br ${module.color} rounded-xl mb-5 group-hover:scale-110 transition-transform`}>
                  <i className={`${module.icon} text-2xl text-white`}></i>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-3 group-hover:text-teal-600 transition-colors">{module.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed mb-4">{module.desc}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-teal-500 text-sm font-medium">
                    <span>{isLoggedIn ? '进入模块' : '登录后进入'}</span>
                    <i className="ri-arrow-right-line ml-2 group-hover:translate-x-1 transition-transform"></i>
                  </div>
                  {(module as any).isTeacher && (
                    <span className="px-2 py-0.5 bg-orange-100 text-orange-600 text-xs font-medium rounded-full whitespace-nowrap">教师端</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Process Flow */}
      <section id="process" className="py-20 px-6 bg-gradient-to-br from-teal-50 to-cyan-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">实训流程</h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">标准化流程设计，环环相扣，确保实训质量</p>
          </div>
          <div className="relative">
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-gradient-to-r from-teal-200 via-cyan-200 to-teal-200 -translate-y-1/2 hidden lg:block"></div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 relative">
              {[
                { step: '01', title: '组队', desc: '智能匹配，组建团队' },
                { step: '02', title: '创新与调研', desc: '创意生成，市场验证' },
                { step: '03', title: '设计与模式', desc: '产品设计，商业模式' },
                { step: '04', title: '计划与评价', desc: '成果输出，科学评估' },
              ].map((item, index) => (
                <div key={index} className="relative">
                  <div className="bg-white p-8 rounded-2xl shadow-md hover:shadow-xl transition-all border border-teal-100">
                    <div className="text-5xl font-bold text-teal-500/20 mb-4">{item.step}</div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3">{item.title}</h3>
                    <p className="text-sm text-gray-600">{item.desc}</p>
                  </div>
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-12 h-12 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold shadow-lg hidden lg:flex">
                    {index + 1}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Detail */}
      <section id="features" className="py-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">平台特色</h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">创新技术赋能，打造高效实训体验</p>
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
                { icon: 'ri-user-star-line', title: '双角色支持', desc: '学生协作完成任务，教师全程监控指导，实现教学相长', color: 'from-teal-500 to-cyan-500' },
                { icon: 'ri-database-2-line', title: '成果自动沉淀', desc: '各阶段成果自动归档，支持导出、分享、版本管理', color: 'from-orange-500 to-amber-500' },
                { icon: 'ri-tools-line', title: '丰富工具库', desc: '商业画布、SWOT分析、六顶思考帽等专业工具内置', color: 'from-purple-500 to-pink-500' },
                { icon: 'ri-line-chart-line', title: '数据可视化', desc: '进度追踪、成果统计、评价分析，一目了然', color: 'from-green-500 to-emerald-500' },
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
          <p className="text-lg text-white/95 mb-10 leading-relaxed">加入我们，体验AI赋能的创新创业教育新模式</p>
          <div className="flex items-center justify-center gap-4">
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
              <h4 className="text-sm font-bold mb-4">实训模块</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><button onClick={() => handleModuleClick('/student-center?module=team-formation')} className="hover:text-teal-400 transition-colors cursor-pointer">组队管理</button></li>
                <li><button onClick={() => handleModuleClick('/student-center?module=ideation')} className="hover:text-teal-400 transition-colors cursor-pointer">创新思维</button></li>
                <li><button onClick={() => handleModuleClick('/student-center?module=market-research')} className="hover:text-teal-400 transition-colors cursor-pointer">市场调研</button></li>
                <li><button onClick={() => handleModuleClick('/student-center?module=product-design')} className="hover:text-teal-400 transition-colors cursor-pointer">产品设计</button></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-bold mb-4">关于我们</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-teal-400 transition-colors cursor-pointer">平台介绍</a></li>
                <li><a href="#" className="hover:text-teal-400 transition-colors cursor-pointer">使用指南</a></li>
                <li><a href="#" className="hover:text-teal-400 transition-colors cursor-pointer">常见问题</a></li>
                <li><a href="#" className="hover:text-teal-400 transition-colors cursor-pointer">联系我们</a></li>
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
            <a href="https://readdy.ai/?ref=logo" target="_blank" rel="noopener noreferrer nofollow" className="text-sm text-gray-400 hover:text-teal-400 transition-colors cursor-pointer">Powered by Readdy</a>
          </div>
        </div>
      </footer>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="bg-gradient-to-r from-teal-500 to-cyan-600 p-6 text-white">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-2xl font-bold">登录</h2>
                <button onClick={() => { setShowLoginModal(false); setPendingNavTarget(''); setLoginError(''); }} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors cursor-pointer">
                  <i className="ri-close-line text-xl"></i>
                </button>
              </div>
              <p className="text-teal-100">
                {pendingNavTarget ? '登录后即可进入对应模块' : '欢迎回到嘉兴大学创业实训平台'}
              </p>
            </div>
            <div className="p-6">
              <div className="flex gap-3 mb-6">
                {(['student', 'teacher', 'admin'] as const).map((role) => (
                  <button key={role} onClick={() => { setLoginRole(role); setLoginError(''); }}
                    className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all cursor-pointer ${loginRole === role ? 'bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-lg' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    <i className={`${role === 'student' ? 'ri-user-line' : role === 'teacher' ? 'ri-user-star-line' : 'ri-shield-star-line'} mr-2`}></i>
                    {role === 'student' ? '学生' : role === 'teacher' ? '教师' : '管理员'}
                  </button>
                ))}
              </div>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {loginRole === 'admin' ? '管理员账号' : loginRole === 'student' ? '学号' : '工号'}
                  </label>
                  <input type="text" name="username" required
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-sm"
                    placeholder={loginRole === 'admin' ? '请输入管理员账号' : loginRole === 'student' ? '请输入学号' : '请输入工号'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">密码</label>
                  <input type="password" name="password" required
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-sm"
                    placeholder="请输入密码"
                  />
                </div>
                {loginError && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{loginError}</p>
                )}
                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 text-teal-500 rounded focus:ring-teal-500" />
                    <span className="text-gray-600">记住我</span>
                  </label>
                  <a href="#" className="text-teal-600 hover:text-teal-700 font-medium">忘记密码？</a>
                </div>
                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full py-3 bg-gradient-to-r from-teal-500 to-cyan-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loginLoading ? '登录中…' : loginRole === 'admin' ? '进入管理后台' : loginRole === 'teacher' ? '进入教师看板' : '进入学生中心'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
