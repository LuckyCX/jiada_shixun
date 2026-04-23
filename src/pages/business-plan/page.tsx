import { Link } from 'react-router-dom';
import { useState } from 'react';

export default function BusinessPlan() {
  const [activeTab, setActiveTab] = useState<'plan' | 'ppt'>('plan');

  const planSections = [
    { title: '执行摘要', progress: 100, status: 'completed' },
    { title: '项目背景', progress: 100, status: 'completed' },
    { title: '市场分析', progress: 100, status: 'completed' },
    { title: '产品与服务', progress: 80, status: 'editing' },
    { title: '商业模式', progress: 60, status: 'editing' },
    { title: '营销策略', progress: 40, status: 'editing' },
    { title: '财务规划', progress: 20, status: 'pending' },
    { title: '团队介绍', progress: 0, status: 'pending' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-3 cursor-pointer">
              <img src="https://public.readdy.ai/ai/img_res/a45fb981-255c-43bf-a2cd-2de142ce7a9c.png" alt="Logo" className="h-10 w-10 object-contain" />
              <span className="text-xl font-bold text-gray-900">嘉兴大学创业实训平台</span>
            </Link>
            <i className="ri-arrow-right-s-line text-gray-400"></i>
            <span className="text-sm text-gray-600">商业计划书与PPT制作</span>
          </div>
          <button className="px-5 py-2 bg-teal-500 text-white text-sm font-medium rounded-full hover:bg-teal-600 transition-colors whitespace-nowrap cursor-pointer">
            <i className="ri-question-line mr-2"></i>
            AI助手
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Page Title */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">商业计划书与PPT制作</h1>
          <p className="text-lg text-gray-600">整合所有实训成果，完成商业计划书撰写与路演PPT制作</p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-8">
          <div className="flex border-b border-gray-100">
            <button
              onClick={() => setActiveTab('plan')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'plan' ? 'text-violet-600 border-b-2 border-violet-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <i className="ri-file-text-line mr-2"></i>
              商业计划书
            </button>
            <button
              onClick={() => setActiveTab('ppt')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'ppt' ? 'text-violet-600 border-b-2 border-violet-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <i className="ri-slideshow-line mr-2"></i>
              路演PPT
            </button>
          </div>

          <div className="p-8">
            {activeTab === 'plan' && (
              <div className="space-y-8">
                <div className="bg-violet-50 border border-violet-200 rounded-xl p-6">
                  <h3 className="text-base font-bold text-violet-900 mb-3">商业计划书撰写指南</h3>
                  <p className="text-sm text-violet-700 mb-3">
                    平台将自动提取前期各模块核心内容，填充到计划书对应章节，你可以在此基础上修改完善
                  </p>
                  <ul className="text-sm text-violet-700 space-y-1">
                    <li>• 内容完整：涵盖项目背景、市场分析、产品服务、商业模式等</li>
                    <li>• 逻辑清晰：章节结构合理，论述层次分明</li>
                    <li>• 数据支撑：用调研数据和财务预测支撑观点</li>
                    <li>• 团队协作：成员按角色分工撰写对应章节</li>
                  </ul>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                  <div className="bg-gradient-to-br from-violet-500 to-purple-500 rounded-xl p-6 text-white">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-white/80">总进度</span>
                      <i className="ri-file-chart-line text-2xl text-white/80"></i>
                    </div>
                    <div className="text-3xl font-bold mb-1">62%</div>
                    <div className="text-xs text-white/80">8个章节中已完成5个</div>
                  </div>
                  <div className="bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl p-6 text-white">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-white/80">字数统计</span>
                      <i className="ri-text text-2xl text-white/80"></i>
                    </div>
                    <div className="text-3xl font-bold mb-1">8,500</div>
                    <div className="text-xs text-white/80">目标10,000字</div>
                  </div>
                  <div className="bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl p-6 text-white">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-white/80">协作成员</span>
                      <i className="ri-team-line text-2xl text-white/80"></i>
                    </div>
                    <div className="text-3xl font-bold mb-1">4人</div>
                    <div className="text-xs text-white/80">全员参与编辑</div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-gray-900">章节列表</h3>
                    <button className="px-5 py-2 bg-violet-500 text-white text-sm font-medium rounded-lg hover:bg-violet-600 transition-colors whitespace-nowrap cursor-pointer">
                      <i className="ri-add-line mr-2"></i>
                      添加章节
                    </button>
                  </div>
                  <div className="space-y-3">
                    {planSections.map((section, index) => (
                      <div key={index} className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-all">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <span className="w-8 h-8 bg-violet-100 text-violet-600 rounded-lg flex items-center justify-center text-sm font-bold">
                              {index + 1}
                            </span>
                            <h4 className="text-base font-bold text-gray-900">{section.title}</h4>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap ${
                              section.status === 'completed' ? 'bg-green-100 text-green-700' :
                              section.status === 'editing' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {section.status === 'completed' ? '已完成' :
                               section.status === 'editing' ? '编辑中' : '待编辑'}
                            </span>
                            <button className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">
                              <i className="ri-edit-line"></i>
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all"
                              style={{ width: `${section.progress}%` }}
                            ></div>
                          </div>
                          <span className="text-xs text-gray-500 whitespace-nowrap">{section.progress}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">在线编辑器</h3>
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center gap-2">
                      <button className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-200 rounded transition-colors cursor-pointer">
                        <i className="ri-bold"></i>
                      </button>
                      <button className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-200 rounded transition-colors cursor-pointer">
                        <i className="ri-italic"></i>
                      </button>
                      <button className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-200 rounded transition-colors cursor-pointer">
                        <i className="ri-underline"></i>
                      </button>
                      <div className="w-px h-6 bg-gray-300 mx-2"></div>
                      <button className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-200 rounded transition-colors cursor-pointer">
                        <i className="ri-list-unordered"></i>
                      </button>
                      <button className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-200 rounded transition-colors cursor-pointer">
                        <i className="ri-list-ordered"></i>
                      </button>
                      <div className="w-px h-6 bg-gray-300 mx-2"></div>
                      <button className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-200 rounded transition-colors cursor-pointer">
                        <i className="ri-image-line"></i>
                      </button>
                      <button className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-200 rounded transition-colors cursor-pointer">
                        <i className="ri-table-line"></i>
                      </button>
                    </div>
                    <textarea
                      rows={12}
                      className="w-full px-6 py-4 text-sm text-gray-700 focus:outline-none resize-none"
                      placeholder="开始撰写商业计划书内容..."
                      defaultValue="一、执行摘要&#10;&#10;本项目致力于打造校园智能配送平台，通过AI算法优化配送路径，为大学生提供15分钟快速配送服务。项目针对校园外卖配送效率低、等待时间长的痛点，结合智能路径规划技术，实现高效、低成本的配送服务。&#10;&#10;市场调研显示，85%的学生对现有配送服务不满意，主要问题集中在配送时间长和配送费用高。我们的解决方案通过技术创新和精细化运营，将配送时间缩短至15分钟以内，配送费控制在2-3元，显著提升用户体验。&#10;&#10;团队由4名核心成员组成，分别负责技术开发、市场营销、财务管理和产品设计。首年预计服务10,000名用户，实现营收45万元，净利润15万元。"
                    />
                  </div>
                  <div className="flex items-center justify-between mt-4 text-xs text-gray-500">
                    <div className="flex items-center gap-4">
                      <span>最后编辑：张明 · 2分钟前</span>
                      <span>当前章节：执行摘要</span>
                    </div>
                    <button className="px-4 py-2 bg-violet-500 text-white text-sm font-medium rounded-lg hover:bg-violet-600 transition-colors whitespace-nowrap cursor-pointer">
                      <i className="ri-save-line mr-2"></i>
                      保存
                    </button>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button className="flex-1 px-6 py-3 bg-violet-500 text-white text-sm font-medium rounded-xl hover:bg-violet-600 transition-colors whitespace-nowrap cursor-pointer">
                    <i className="ri-file-download-line mr-2"></i>
                    导出Word
                  </button>
                  <button className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer">
                    <i className="ri-file-pdf-line mr-2"></i>
                    导出PDF
                  </button>
                  <button className="px-6 py-3 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer">
                    <i className="ri-history-line mr-2"></i>
                    版本历史
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'ppt' && (
              <div className="space-y-8">
                <div className="bg-violet-50 border border-violet-200 rounded-xl p-6">
                  <h3 className="text-base font-bold text-violet-900 mb-3">路演PPT制作指南</h3>
                  <p className="text-sm text-violet-700 mb-3">
                    选择PPT模板，系统将自动抽取商业计划书关键信息生成PPT初稿，你可以进一步编辑优化
                  </p>
                  <ul className="text-sm text-violet-700 space-y-1">
                    <li>• 简洁明了：每页突出1-2个核心观点</li>
                    <li>• 视觉吸引：使用图表、图片增强表现力</li>
                    <li>• 逻辑清晰：按照路演逻辑组织内容</li>
                    <li>• 时间控制：建议10-15页，控制在10分钟内</li>
                  </ul>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-6">选择PPT模板</h3>
                  <div className="grid md:grid-cols-3 gap-6">
                    {[
                      { name: '学术型', desc: '适合课程答辩和学术展示', color: 'from-blue-500 to-indigo-500' },
                      { name: '竞赛型', desc: '适合创业大赛和路演', color: 'from-violet-500 to-purple-500' },
                      { name: '投资型', desc: '适合投资人展示', color: 'from-orange-500 to-amber-500' }
                    ].map((template, index) => (
                      <div key={index} className="border-2 border-gray-200 rounded-xl p-6 hover:border-violet-300 hover:shadow-lg transition-all cursor-pointer">
                        <div className={`w-full h-32 bg-gradient-to-br ${template.color} rounded-lg mb-4 flex items-center justify-center`}>
                          <i className="ri-slideshow-line text-4xl text-white"></i>
                        </div>
                        <h4 className="text-base font-bold text-gray-900 mb-2">{template.name}</h4>
                        <p className="text-sm text-gray-600 mb-4">{template.desc}</p>
                        <button className="w-full px-4 py-2 bg-violet-50 text-violet-600 text-sm font-medium rounded-lg hover:bg-violet-100 transition-colors whitespace-nowrap cursor-pointer">
                          使用模板
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-gray-900">PPT页面列表</h3>
                    <div className="flex gap-2">
                      <button className="px-4 py-2 bg-violet-500 text-white text-sm font-medium rounded-lg hover:bg-violet-600 transition-colors whitespace-nowrap cursor-pointer">
                        <i className="ri-add-line mr-2"></i>
                        添加页面
                      </button>
                      <button className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer">
                        <i className="ri-sparkling-line mr-2"></i>
                        AI生成
                      </button>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-4 gap-4">
                    {[
                      { title: '封面', content: '项目名称与团队' },
                      { title: '问题与机会', content: '市场痛点分析' },
                      { title: '解决方案', content: '产品核心价值' },
                      { title: '市场分析', content: '目标市场与规模' },
                      { title: '产品展示', content: '功能与原型' },
                      { title: '商业模式', content: '盈利模式' },
                      { title: '竞争优势', content: 'SWOT分析' },
                      { title: '营销策略', content: '推广计划' },
                      { title: '财务预测', content: '收入与成本' },
                      { title: '团队介绍', content: '核心成员' },
                      { title: '里程碑', content: '发展规划' },
                      { title: '致谢', content: '联系方式' }
                    ].map((slide, index) => (
                      <div key={index} className="group border border-gray-200 rounded-xl p-4 hover:shadow-lg transition-all cursor-pointer">
                        <div className="w-full h-32 bg-gradient-to-br from-violet-100 to-purple-100 rounded-lg mb-3 flex items-center justify-center relative overflow-hidden">
                          <span className="text-4xl font-bold text-violet-300">{index + 1}</span>
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all flex items-center justify-center">
                            <i className="ri-edit-line text-white text-xl opacity-0 group-hover:opacity-100 transition-opacity"></i>
                          </div>
                        </div>
                        <h4 className="text-sm font-bold text-gray-900 mb-1">{slide.title}</h4>
                        <p className="text-xs text-gray-500">{slide.content}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">当前页面编辑</h3>
                  <div className="border-2 border-gray-200 rounded-xl overflow-hidden">
                    <div className="aspect-video bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center relative">
                      <div className="text-center text-white p-12">
                        <h2 className="text-4xl font-bold mb-4">校园智能配送平台</h2>
                        <p className="text-xl mb-8">15分钟必达 · 智能路径 · 学生友好</p>
                        <div className="flex items-center justify-center gap-8 text-sm">
                          <div>
                            <div className="font-bold mb-1">创新科技团队</div>
                            <div className="text-white/80">2025年1月</div>
                          </div>
                        </div>
                      </div>
                      <div className="absolute top-4 right-4 flex gap-2">
                        <button className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center text-white hover:bg-white/30 transition-colors cursor-pointer">
                          <i className="ri-edit-line"></i>
                        </button>
                        <button className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center text-white hover:bg-white/30 transition-colors cursor-pointer">
                          <i className="ri-palette-line"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-4">
                    <div className="flex gap-2">
                      <button className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer">
                        <i className="ri-arrow-left-line mr-2"></i>
                        上一页
                      </button>
                      <button className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer">
                        下一页
                        <i className="ri-arrow-right-line ml-2"></i>
                      </button>
                    </div>
                    <span className="text-sm text-gray-500">第 1 / 12 页</span>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button className="flex-1 px-6 py-3 bg-violet-500 text-white text-sm font-medium rounded-xl hover:bg-violet-600 transition-colors whitespace-nowrap cursor-pointer">
                    <i className="ri-play-line mr-2"></i>
                    预览演示
                  </button>
                  <button className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer">
                    <i className="ri-download-line mr-2"></i>
                    导出PPTX
                  </button>
                  <button className="px-6 py-3 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer">
                    <i className="ri-share-line mr-2"></i>
                    分享
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
