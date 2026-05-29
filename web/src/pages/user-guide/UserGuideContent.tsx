import { useState } from 'react';
import { Link } from 'react-router-dom';

interface GuideStep {
  title: string;
  description: string;
  icon: string;
}

interface ModuleGuide {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  steps: GuideStep[];
  tips: string[];
  route: string;
}

export type UserGuideContentProps = {
  /** 学生工作台内嵌：无顶栏、收紧版式、隐藏页尾引导 */
  embedded?: boolean;
};

export function UserGuideContent({ embedded = false }: UserGuideContentProps) {
  const [activeModule, setActiveModule] = useState<string>('ideation');

  const modules: ModuleGuide[] = [
    {
      id: 'ideation',
      name: '创意构思',
      icon: 'ri-lightbulb-line',
      color: 'from-amber-500 to-orange-500',
      description: '通过AI辅助激发创新思维，快速生成和优化创业想法',
      route: '/ideation',
      steps: [
        {
          title: '选择创意方向',
          description: '从多个行业领域中选择你感兴趣的创业方向',
          icon: 'ri-compass-3-line'
        },
        {
          title: 'AI头脑风暴',
          description: '与AI助手进行互动式头脑风暴，获取创意灵感',
          icon: 'ri-chat-3-line'
        },
        {
          title: '创意评估',
          description: '使用SWOT分析等工具评估创意的可行性',
          icon: 'ri-bar-chart-box-line'
        },
        {
          title: '保存创意',
          description: '将优质创意保存到个人中心，便于后续开发',
          icon: 'ri-save-line'
        }
      ],
      tips: [
        '尽量详细描述你的想法，AI会给出更精准的建议',
        '可以同时探索多个创意方向，不要局限于单一领域',
        '定期回顾和迭代你的创意，创新是一个持续的过程'
      ]
    },
    {
      id: 'market-research',
      name: '市场调研',
      icon: 'ri-line-chart-line',
      color: 'from-blue-500 to-cyan-500',
      description: '利用AI分析市场趋势，深入了解目标用户和竞争对手',
      route: '/market-research',
      steps: [
        {
          title: '定义目标市场',
          description: '明确你的目标用户群体和市场范围',
          icon: 'ri-focus-3-line'
        },
        {
          title: '用户画像分析',
          description: 'AI帮助构建详细的用户画像和需求分析',
          icon: 'ri-user-search-line'
        },
        {
          title: '竞品分析',
          description: '识别主要竞争对手，分析其优劣势',
          icon: 'ri-shield-check-line'
        },
        {
          title: '生成调研报告',
          description: '自动生成专业的市场调研报告',
          icon: 'ri-file-text-line'
        }
      ],
      tips: [
        '市场调研要基于真实数据，避免主观臆断',
        '关注细分市场的机会，差异化是关键',
        '定期更新市场信息，保持对行业动态的敏感度'
      ]
    },
    {
      id: 'product-design',
      name: '产品设计与原型',
      icon: 'ri-pencil-ruler-2-line',
      color: 'from-purple-500 to-pink-500',
      description: '设计产品功能和原型，快速验证产品概念',
      route: '/product-design',
      steps: [
        {
          title: '功能规划',
          description: '定义产品核心功能和特性',
          icon: 'ri-list-check'
        },
        {
          title: '原型设计',
          description: '使用工具创建产品原型和界面设计',
          icon: 'ri-layout-line'
        },
        {
          title: '用户测试',
          description: '收集用户反馈，优化产品设计',
          icon: 'ri-user-voice-line'
        },
        {
          title: '迭代优化',
          description: '根据反馈持续改进产品',
          icon: 'ri-refresh-line'
        }
      ],
      tips: [
        '从MVP（最小可行产品）开始，不要追求完美',
        '重视用户体验，简洁易用是产品成功的关键',
        '保持灵活性，根据市场反馈快速调整'
      ]
    },
    {
      id: 'business-model',
      name: '商业模式设计',
      icon: 'ri-pie-chart-line',
      color: 'from-green-500 to-emerald-500',
      description: '构建可持续的商业模式，规划盈利路径',
      route: '/business-model',
      steps: [
        {
          title: '商业画布',
          description: '使用商业模式画布梳理商业逻辑',
          icon: 'ri-layout-grid-line'
        },
        {
          title: 'SWOT分析',
          description: '全面分析优势、劣势、机会和威胁',
          icon: 'ri-radar-line'
        },
        {
          title: '营销策略',
          description: '制定市场推广和获客策略',
          icon: 'ri-megaphone-line'
        },
        {
          title: '成本分析',
          description: '评估运营成本和收入预测',
          icon: 'ri-money-dollar-circle-line'
        }
      ],
      tips: [
        '商业模式要能清晰回答"如何赚钱"这个问题',
        '关注现金流，确保企业能够持续运营',
        '考虑多种收入来源，降低经营风险'
      ]
    },
    {
      id: 'role-simulation',
      name: 'AI角色模拟',
      icon: 'ri-user-star-line',
      color: 'from-indigo-500 to-blue-500',
      description: '与AI模拟的投资人、导师等角色互动，提升实战能力',
      route: '/role-simulation',
      steps: [
        {
          title: '选择角色',
          description: '选择投资人、导师、客户等不同角色',
          icon: 'ri-team-line'
        },
        {
          title: '场景模拟',
          description: '进入真实的商业场景进行对话',
          icon: 'ri-movie-2-line'
        },
        {
          title: '实时反馈',
          description: '获得AI角色的专业建议和评价',
          icon: 'ri-feedback-line'
        },
        {
          title: '能力提升',
          description: '通过反复练习提升沟通和应变能力',
          icon: 'ri-arrow-up-circle-line'
        }
      ],
      tips: [
        '认真对待每次模拟，像真实场景一样准备',
        '记录AI的反馈建议，总结改进要点',
        '多尝试不同角色，全面提升综合能力'
      ]
    },
    {
      id: 'business-plan',
      name: '商业计划书',
      icon: 'ri-file-list-3-line',
      color: 'from-red-500 to-orange-500',
      description: '自动生成专业的商业计划书，为融资做准备',
      route: '/business-plan',
      steps: [
        {
          title: '选择模板',
          description: '根据行业和需求选择合适的计划书模板',
          icon: 'ri-file-copy-line'
        },
        {
          title: 'AI辅助撰写',
          description: 'AI根据前期工作自动生成各章节内容',
          icon: 'ri-quill-pen-line'
        },
        {
          title: '内容优化',
          description: '编辑和完善计划书的各个部分',
          icon: 'ri-edit-box-line'
        },
        {
          title: '导出分享',
          description: '导出PDF格式，用于路演和融资',
          icon: 'ri-download-cloud-line'
        }
      ],
      tips: [
        '商业计划书要逻辑清晰，数据真实可信',
        '突出团队优势和核心竞争力',
        '财务预测要合理，避免过于乐观'
      ]
    },
    {
      id: 'team-formation',
      name: '组队管理',
      icon: 'ri-team-line',
      color: 'from-teal-500 to-green-500',
      description: '组建创业团队，协作完成项目',
      route: '/team-formation',
      steps: [
        {
          title: '创建团队',
          description: '发起团队或加入现有团队',
          icon: 'ri-add-circle-line'
        },
        {
          title: '角色分工',
          description: '明确团队成员的职责和分工',
          icon: 'ri-user-settings-line'
        },
        {
          title: '协作工作',
          description: '共同完成各个模块的实训任务',
          icon: 'ri-links-line'
        },
        {
          title: '进度跟踪',
          description: '查看团队整体进度和成员贡献',
          icon: 'ri-dashboard-line'
        }
      ],
      tips: [
        '选择互补技能的成员组建团队',
        '建立良好的沟通机制，定期同步进度',
        '明确分工，但也要保持灵活协作'
      ]
    }
  ];

  const activeGuide = modules.find(m => m.id === activeModule) || modules[0];

  const sectionWrap = embedded ? 'px-0 pt-2 pb-4' : 'max-w-7xl mx-auto px-6 pt-12 pb-8';

  return (
    <div className={embedded ? '' : 'min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50'}>
      <div className={sectionWrap}>
        <div className={`text-center ${embedded ? 'mb-6' : 'mb-12'}`}>
          {!embedded && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 text-blue-700 text-sm font-medium mb-4">
              <i className="ri-book-open-line"></i>
              <span>新手指南</span>
            </div>
          )}
          <h1 className={`font-bold text-slate-900 mb-4 ${embedded ? 'text-2xl' : 'text-4xl'}`}>
            平台使用指南
          </h1>
          <p className={`text-slate-600 max-w-2xl mx-auto ${embedded ? 'text-sm' : 'text-lg'}`}>
            跟随我们的步骤指引，快速掌握各个模块的使用方法，开启你的创业实训之旅
          </p>
        </div>

        {/* 模块选择卡片 */}
        <div
          className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${embedded ? 'lg:grid-cols-3 mb-6' : 'lg:grid-cols-4 mb-12'}`}
        >
          {modules.map((module) => (
            <button
              key={module.id}
              onClick={() => setActiveModule(module.id)}
              className={`p-6 rounded-2xl border-2 transition-all text-left ${
                activeModule === module.id
                  ? 'border-blue-500 bg-white shadow-lg scale-105'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
              }`}
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${module.color} flex items-center justify-center mb-4`}>
                <i className={`${module.icon} text-white text-2xl`}></i>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                {module.name}
              </h3>
              <p className="text-sm text-slate-600 line-clamp-2">
                {module.description}
              </p>
            </button>
          ))}
        </div>

        {/* 详细指南内容 */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
          {/* 模块头部 */}
          <div className={`bg-gradient-to-r ${activeGuide.color} p-8 text-white`}>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <i className={`${activeGuide.icon} text-4xl`}></i>
              </div>
              <div>
                <h2 className="text-3xl font-bold mb-2">{activeGuide.name}</h2>
                <p className="text-white/90">{activeGuide.description}</p>
              </div>
            </div>
            <Link
              to={activeGuide.route}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-slate-900 font-medium hover:shadow-lg transition-all whitespace-nowrap"
            >
              <span>立即体验</span>
              <i className="ri-arrow-right-line"></i>
            </Link>
          </div>

          {/* 使用步骤 */}
          <div className="p-8">
            <h3 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <i className="ri-route-line text-blue-600"></i>
              <span>使用步骤</span>
            </h3>
            <div className="space-y-6">
              {activeGuide.steps.map((step, index) => (
                <div key={index} className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${activeGuide.color} flex items-center justify-center text-white font-bold text-lg`}>
                      {index + 1}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <i className={`${step.icon} text-xl text-slate-400`}></i>
                      <h4 className="text-lg font-bold text-slate-900">
                        {step.title}
                      </h4>
                    </div>
                    <p className="text-slate-600 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 使用技巧 */}
          <div className="px-8 pb-8">
            <h3 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <i className="ri-lightbulb-flash-line text-amber-500"></i>
              <span>使用技巧</span>
            </h3>
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-6 border border-amber-200">
              <ul className="space-y-3">
                {activeGuide.tips.map((tip, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <i className="ri-checkbox-circle-fill text-amber-500 text-xl flex-shrink-0 mt-0.5"></i>
                    <span className="text-slate-700 leading-relaxed">{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {!embedded && (
        <div className="mt-12 bg-white rounded-3xl shadow-xl p-8">
          <h3 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <i className="ri-compass-3-line text-blue-600"></i>
            <span>快速导航</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              to="/student-center"
              className="flex items-center gap-4 p-4 rounded-xl border-2 border-slate-200 hover:border-blue-500 hover:shadow-md transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                <i className="ri-user-line text-white text-xl"></i>
              </div>
              <div>
                <h4 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                  学生中心
                </h4>
                <p className="text-sm text-slate-600">查看学习进度</p>
              </div>
            </Link>

            <Link
              to="/knowledge-system"
              className="flex items-center gap-4 p-4 rounded-xl border-2 border-slate-200 hover:border-green-500 hover:shadow-md transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                <i className="ri-book-2-line text-white text-xl"></i>
              </div>
              <div>
                <h4 className="font-bold text-slate-900 group-hover:text-green-600 transition-colors">
                  知识体系
                </h4>
                <p className="text-sm text-slate-600">学习理论知识</p>
              </div>
            </Link>

            <Link
              to="/full-stack-tools"
              className="flex items-center gap-4 p-4 rounded-xl border-2 border-slate-200 hover:border-purple-500 hover:shadow-md transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <i className="ri-tools-line text-white text-xl"></i>
              </div>
              <div>
                <h4 className="font-bold text-slate-900 group-hover:text-purple-600 transition-colors">
                  全栈工具
                </h4>
                <p className="text-sm text-slate-600">使用辅助工具</p>
              </div>
            </Link>
          </div>
        </div>
        )}

        {/* 常见问题 */}
        <div className={`bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl p-8 border border-blue-200 ${embedded ? 'mt-6' : 'mt-12'}`}>
          <h3 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <i className="ri-question-answer-line text-blue-600"></i>
            <span>常见问题</span>
          </h3>
          <div className="space-y-4">
            <details className="bg-white rounded-xl p-5 cursor-pointer group">
              <summary className="font-bold text-slate-900 flex items-center justify-between">
                <span>如何开始我的第一个创业项目？</span>
                <i className="ri-arrow-down-s-line text-xl text-slate-400 group-open:rotate-180 transition-transform"></i>
              </summary>
              <p className="mt-4 text-slate-600 leading-relaxed">
                建议从"创意构思"模块开始，使用AI头脑风暴功能激发灵感。确定创意方向后，依次完成市场调研、产品设计等模块。平台会自动记录你的进度，你可以随时在学生中心查看。
              </p>
            </details>

            <details className="bg-white rounded-xl p-5 cursor-pointer group">
              <summary className="font-bold text-slate-900 flex items-center justify-between">
                <span>各个模块必须按顺序完成吗？</span>
                <i className="ri-arrow-down-s-line text-xl text-slate-400 group-open:rotate-180 transition-transform"></i>
              </summary>
              <p className="mt-4 text-slate-600 leading-relaxed">
                不是必须的。虽然我们建议按照创意构思→市场调研→产品设计→商业模式→商业计划的顺序进行，但你可以根据实际需求灵活调整。所有模块都已解锁，可以随时访问。
              </p>
            </details>

            <details className="bg-white rounded-xl p-5 cursor-pointer group">
              <summary className="font-bold text-slate-900 flex items-center justify-between">
                <span>如何保存和导出我的工作成果？</span>
                <i className="ri-arrow-down-s-line text-xl text-slate-400 group-open:rotate-180 transition-transform"></i>
              </summary>
              <p className="mt-4 text-slate-600 leading-relaxed">
                每个模块都会自动保存你的工作内容。在商业计划书模块，你可以将完整的计划书导出为PDF格式。其他模块的内容可以在学生中心统一查看和管理。
              </p>
            </details>

            <details className="bg-white rounded-xl p-5 cursor-pointer group">
              <summary className="font-bold text-slate-900 flex items-center justify-between">
                <span>AI角色模拟有什么用？</span>
                <i className="ri-arrow-down-s-line text-xl text-slate-400 group-open:rotate-180 transition-transform"></i>
              </summary>
              <p className="mt-4 text-slate-600 leading-relaxed">
                AI角色模拟可以让你在安全的环境中练习与投资人、导师、客户等关键角色的沟通。通过反复练习，你可以提升路演能力、谈判技巧和应变能力，为真实的商业场景做好准备。
              </p>
            </details>
          </div>
        </div>

        {!embedded && (
        <div className="mt-12 text-center pb-12">
          <div className="inline-flex flex-col items-center gap-4 p-8 rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
            <i className="ri-rocket-line text-5xl"></i>
            <h3 className="text-2xl font-bold">准备好开始了吗？</h3>
            <p className="text-white/90 max-w-md">
              现在就开始你的创业实训之旅，用AI赋能你的创新梦想
            </p>
            <Link
              to="/"
              className="px-8 py-3 rounded-xl bg-white text-blue-600 font-bold hover:shadow-xl transition-all whitespace-nowrap"
            >
              开始实训
            </Link>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
