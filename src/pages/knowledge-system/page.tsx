
import { useState } from 'react';
import { SHARED_COURSE_CHAPTERS } from '../../mocks/courseChapters';
import type { CourseChapter, CourseSection, CourseResource } from '../../mocks/courseChapters';
import LearningDetail from './components/LearningDetail';

// 学生学习进度（模拟数据）
const STUDENT_PROGRESS: Record<string, { completed: boolean; progress: number }> = {
  '1-1': { completed: true, progress: 100 },
  '1-2': { completed: true, progress: 100 },
  '2-1': { completed: false, progress: 60 },
  '2-2': { completed: false, progress: 0 },
  '3-1': { completed: false, progress: 0 },
  '3-2': { completed: false, progress: 0 },
  '4-1': { completed: false, progress: 0 },
  '4-2': { completed: false, progress: 0 },
  '5-1': { completed: false, progress: 0 },
  '5-2': { completed: false, progress: 0 },
};

const RESOURCE_COMPLETED: Record<string, boolean> = {
  'r1': true, 'r2': true, 'r3': true,
  'r4': false, 'r5': false,
};

type TabType = 'overview' | 'chapters' | 'ability' | 'progress';

interface AbilityPoint {
  id: string;
  name: string;
  category: string;
  level: number;
  maxLevel: number;
  description: string;
}

export default function KnowledgeSystemPage() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [showLearningDetail, setShowLearningDetail] = useState(false);
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({ '1': true });
  const [selectedSection, setSelectedSection] = useState<CourseSection | null>(null);

  // 只展示已发布的章节和小节
  const publishedChapters = SHARED_COURSE_CHAPTERS.map(ch => ({
    ...ch,
    sections: ch.sections.filter(s => s.published),
  })).filter(ch => ch.sections.length > 0);

  const totalPublishedSections = publishedChapters.reduce((sum, ch) => sum + ch.sections.length, 0);
  const completedSections = publishedChapters.reduce((sum, ch) =>
    sum + ch.sections.filter(s => STUDENT_PROGRESS[s.id]?.completed).length, 0
  );
  const totalResources = publishedChapters.reduce((sum, ch) =>
    sum + ch.sections.reduce((s2, sec) => s2 + sec.resources.length, 0), 0
  );
  const overallProgress = totalPublishedSections > 0
    ? Math.round((completedSections / totalPublishedSections) * 100)
    : 0;

  const abilityPoints: AbilityPoint[] = [
    { id: 'a1', name: '创新思维', category: '核心能力', level: 3, maxLevel: 5, description: '发散思维、创意生成、创新方法运用' },
    { id: 'a2', name: '团队协作', category: '核心能力', level: 2, maxLevel: 5, description: '沟通协调、任务分工、冲突解决' },
    { id: 'a3', name: '系统思维', category: '核心能力', level: 2, maxLevel: 5, description: '全局观、逻辑分析、结构化思考' },
    { id: 'a4', name: '用户洞察', category: '专业能力', level: 1, maxLevel: 5, description: '需求挖掘、用户研究、同理心' },
    { id: 'a5', name: '数据分析', category: '专业能力', level: 1, maxLevel: 5, description: '数据收集、统计分析、可视化呈现' },
    { id: 'a6', name: '商业思维', category: '专业能力', level: 0, maxLevel: 5, description: '商业模式、盈利分析、市场定位' },
    { id: 'a7', name: '产品设计', category: '专业能力', level: 0, maxLevel: 5, description: '原型设计、功能规划、用户体验' },
    { id: 'a8', name: '项目管理', category: '通用能力', level: 1, maxLevel: 5, description: '计划制定、进度控制、风险管理' },
  ];

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters(prev => ({ ...prev, [chapterId]: !prev[chapterId] }));
  };

  const getResourceIcon = (type: string) => {
    const map: Record<string, string> = {
      video: 'ri-video-line',
      pdf: 'ri-file-pdf-line',
      image: 'ri-image-line',
      case: 'ri-lightbulb-line',
    };
    return map[type] || 'ri-file-line';
  };

  const getResourceColor = (type: string) => {
    const map: Record<string, string> = {
      video: 'text-red-500 bg-red-50',
      pdf: 'text-teal-500 bg-teal-50',
      image: 'text-green-500 bg-green-50',
      case: 'text-amber-500 bg-amber-50',
    };
    return map[type] || 'text-gray-500 bg-gray-50';
  };

  const getResourceLabel = (type: string) => {
    const map: Record<string, string> = { video: '视频', pdf: 'PDF', image: '图片', case: '案例' };
    return map[type] || '文件';
  };

  const getSectionStatus = (sectionId: string) => {
    const p = STUDENT_PROGRESS[sectionId];
    if (!p) return { label: '未开始', cls: 'bg-gray-100 text-gray-500' };
    if (p.completed) return { label: '已完成', cls: 'bg-green-100 text-green-600' };
    if (p.progress > 0) return { label: '学习中', cls: 'bg-teal-100 text-teal-600' };
    return { label: '未开始', cls: 'bg-gray-100 text-gray-500' };
  };

  if (showLearningDetail) {
    return <LearningDetail onBack={() => setShowLearningDetail(false)} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-cyan-50">
      {/* 顶部导航 */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40 backdrop-blur-sm bg-white/90">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl flex items-center justify-center">
                <i className="ri-book-open-line text-xl text-white"></i>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">实践课程</h1>
                <p className="text-sm text-gray-500">学习 → 实践 → 评价 → 能力获取</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-sm text-gray-500">
                整体进度
                <span className="ml-2 font-bold text-teal-600 text-base">{overallProgress}%</span>
              </div>
              <button className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-full flex items-center justify-center text-white hover:shadow-lg transition-all cursor-pointer">
                <i className="ri-robot-2-line text-lg"></i>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Tab 导航 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-2 mb-6">
          <div className="flex space-x-2">
            {[
              { id: 'overview', label: '学习概览', icon: 'ri-dashboard-line' },
              { id: 'chapters', label: '课程章节', icon: 'ri-book-2-line' },
              { id: 'ability', label: '能力雷达', icon: 'ri-radar-line' },
              { id: 'progress', label: '进度看板', icon: 'ri-line-chart-line' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex-1 px-6 py-3 rounded-xl font-medium transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-lg'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <i className={`${tab.icon} mr-2`}></i>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ===== 学习概览 ===== */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* 整体进度横幅 */}
            <div className="bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl shadow-xl p-8 text-white">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold mb-1">我的学习进度</h2>
                  <p className="text-teal-100 text-sm">持续学习，不断成长</p>
                </div>
                <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                  <i className="ri-trophy-line text-4xl"></i>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4 mb-6">
                {[
                  { label: '课程章节', value: publishedChapters.length, sub: '已发布章节' },
                  { label: '课程小节', value: `${completedSections}/${totalPublishedSections}`, sub: '已完成小节' },
                  { label: '课件资源', value: totalResources, sub: '可学习资源' },
                  { label: '整体完成度', value: `${overallProgress}%`, sub: '当前进度' },
                ].map((item, i) => (
                  <div key={i} className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                    <div className="text-3xl font-bold mb-1">{item.value}</div>
                    <div className="text-sm text-teal-100">{item.sub}</div>
                  </div>
                ))}
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">课程总进度</span>
                  <span className="text-sm">{overallProgress}%</span>
                </div>
                <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full transition-all duration-700"
                    style={{ width: `${overallProgress}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* 学习路径 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                <i className="ri-route-line text-teal-600 mr-2"></i>
                学习路径流程
              </h3>
              <div className="flex items-center justify-between">
                {[
                  { icon: 'ri-book-open-line', label: '学习课件', color: 'from-teal-500 to-teal-600', desc: '观看视频、阅读文档' },
                  null,
                  { icon: 'ri-edit-box-line', label: '完成实践', color: 'from-green-500 to-green-600', desc: '应用所学知识' },
                  null,
                  { icon: 'ri-checkbox-circle-line', label: '教师评价', color: 'from-orange-500 to-orange-600', desc: '获得反馈指导' },
                  null,
                  { icon: 'ri-medal-line', label: '获得能力点', color: 'from-amber-500 to-amber-600', desc: '解锁下一环节' },
                ].map((step, index) => (
                  <div key={index} className={`${step ? 'flex-1' : 'w-12'} text-center`}>
                    {step ? (
                      <div>
                        <div className={`w-16 h-16 bg-gradient-to-br ${step.color} rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg`}>
                          <i className={`${step.icon} text-2xl text-white`}></i>
                        </div>
                        <div className="font-semibold text-gray-900 mb-1 text-sm">{step.label}</div>
                        <div className="text-xs text-gray-500">{step.desc}</div>
                      </div>
                    ) : (
                      <div className="w-12 h-1 bg-gradient-to-r from-gray-200 to-gray-300 rounded-full mx-auto mt-8"></div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 各章节进度 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                <i className="ri-stack-line text-teal-600 mr-2"></i>
                各章节学习进度
              </h3>
              <div className="grid grid-cols-3 gap-4">
                {publishedChapters.map((chapter, idx) => {
                  const completed = chapter.sections.filter(s => STUDENT_PROGRESS[s.id]?.completed).length;
                  const total = chapter.sections.length;
                  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                  const colors = ['bg-teal-500', 'bg-indigo-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500'];
                  const color = colors[idx % colors.length];
                  return (
                    <div
                      key={chapter.id}
                      onClick={() => setActiveTab('chapters')}
                      className="border border-gray-200 rounded-xl p-5 hover:shadow-lg transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className={`w-11 h-11 ${color} rounded-xl flex items-center justify-center`}>
                          <i className="ri-book-line text-lg text-white"></i>
                        </div>
                        <span className="text-2xl font-bold text-gray-900">{pct}%</span>
                      </div>
                      <h4 className="font-semibold text-gray-900 text-sm mb-1 line-clamp-1">{chapter.title}</h4>
                      <div className="text-xs text-gray-500 mb-3">{completed}/{total} 小节完成</div>
                      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 最近学习 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                <i className="ri-time-line text-teal-600 mr-2"></i>
                最近学习
              </h3>
              <div className="space-y-4">
                {publishedChapters.slice(0, 2).flatMap(ch => ch.sections).slice(0, 3).map((section) => {
                  const prog = STUDENT_PROGRESS[section.id];
                  const status = getSectionStatus(section.id);
                  return (
                    <div
                      key={section.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:shadow-md transition-all cursor-pointer"
                      onClick={() => setShowLearningDetail(true)}
                    >
                      <div className="flex items-center space-x-4 flex-1">
                        <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl flex items-center justify-center flex-shrink-0">
                          <i className="ri-book-2-line text-xl text-white"></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <h4 className="font-semibold text-gray-900 text-sm truncate">{section.title}</h4>
                            <span className={`px-2 py-0.5 rounded-lg text-xs font-medium whitespace-nowrap ${status.cls}`}>
                              {status.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <i className="ri-file-list-line"></i>
                            {section.resources.length} 个课件资源
                            {section.knowledgePoints.length > 0 && (
                              <span className="ml-2">
                                {section.knowledgePoints.slice(0, 2).map((kp, i) => (
                                  <span key={i} className="px-1.5 py-0.5 bg-teal-50 text-teal-600 rounded mr-1">{kp}</span>
                                ))}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 ml-4">
                        <div className="text-right">
                          <div className="text-xl font-bold text-teal-600">{prog?.progress ?? 0}%</div>
                          <div className="text-xs text-gray-500">完成度</div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowLearningDetail(true); }}
                          className="px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-xl text-sm font-medium hover:shadow-lg transition-all whitespace-nowrap cursor-pointer"
                        >
                          {prog?.completed ? '复习' : prog?.progress ? '继续' : '开始'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ===== 课程章节 ===== */}
        {activeTab === 'chapters' && (
          <div className="space-y-4">
            {/* 顶部统计 */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: '课程章节', value: publishedChapters.length, icon: 'ri-book-line', bg: 'bg-teal-50', iconCls: 'text-teal-500', valCls: 'text-teal-700' },
                { label: '课程小节', value: totalPublishedSections, icon: 'ri-list-check', bg: 'bg-indigo-50', iconCls: 'text-indigo-500', valCls: 'text-indigo-700' },
                { label: '已完成小节', value: completedSections, icon: 'ri-checkbox-circle-line', bg: 'bg-green-50', iconCls: 'text-green-500', valCls: 'text-green-700' },
                { label: '课件资源', value: totalResources, icon: 'ri-folder-line', bg: 'bg-orange-50', iconCls: 'text-orange-500', valCls: 'text-orange-700' },
              ].map((item, i) => (
                <div key={i} className={`${item.bg} rounded-xl px-4 py-3 flex items-center gap-3`}>
                  <div className={`w-10 h-10 bg-white rounded-lg flex items-center justify-center`}>
                    <i className={`${item.icon} ${item.iconCls} text-lg`}></i>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">{item.label}</div>
                    <div className={`text-xl font-bold ${item.valCls}`}>{item.value}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* 章节列表 */}
            {publishedChapters.map((chapter, chIdx) => {
              const colors = ['from-teal-500 to-cyan-500', 'from-indigo-500 to-violet-500', 'from-green-500 to-emerald-500', 'from-orange-500 to-amber-500', 'from-pink-500 to-rose-500'];
              const color = colors[chIdx % colors.length];
              const completedInChapter = chapter.sections.filter(s => STUDENT_PROGRESS[s.id]?.completed).length;
              const isExpanded = expandedChapters[chapter.id] ?? false;

              return (
                <div key={chapter.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {/* 章节头 */}
                  <div
                    onClick={() => toggleChapter(chapter.id)}
                    className="flex items-center justify-between p-5 cursor-pointer hover:bg-gray-50 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center flex-shrink-0`}>
                        <i className="ri-book-open-line text-white text-base"></i>
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-gray-900">{chapter.title}</h3>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {completedInChapter}/{chapter.sections.length} 小节已完成
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-32">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>进度</span>
                          <span className="font-medium text-teal-600">
                            {chapter.sections.length > 0 ? Math.round((completedInChapter / chapter.sections.length) * 100) : 0}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full bg-gradient-to-r ${color} rounded-full`}
                            style={{ width: `${chapter.sections.length > 0 ? (completedInChapter / chapter.sections.length) * 100 : 0}%` }}
                          ></div>
                        </div>
                      </div>
                      <i className={`${isExpanded ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} text-gray-400 text-xl`}></i>
                    </div>
                  </div>

                  {/* 小节列表 */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 divide-y divide-gray-50">
                      {chapter.sections.map((section) => {
                        const prog = STUDENT_PROGRESS[section.id];
                        const status = getSectionStatus(section.id);
                        return (
                          <div key={section.id} className="p-5 hover:bg-gray-50 transition-all">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <h4 className="text-sm font-bold text-gray-900">{section.title}</h4>
                                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${status.cls}`}>
                                    {status.label}
                                  </span>
                                </div>
                                {section.knowledgePoints.length > 0 && (
                                  <div className="flex items-center gap-1.5 flex-wrap mb-2">
                                    <i className="ri-price-tag-3-line text-teal-500 text-xs"></i>
                                    {section.knowledgePoints.map((kp, i) => (
                                      <span key={i} className="px-2 py-0.5 bg-teal-50 text-teal-600 text-xs rounded-md">{kp}</span>
                                    ))}
                                  </div>
                                )}
                                {/* 进度条 */}
                                {prog && prog.progress > 0 && (
                                  <div className="flex items-center gap-2 mt-2">
                                    <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                      <div
                                        className="h-full bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full"
                                        style={{ width: `${prog.progress}%` }}
                                      ></div>
                                    </div>
                                    <span className="text-xs font-medium text-teal-600 whitespace-nowrap">{prog.progress}%</span>
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => { setSelectedSection(section); setShowLearningDetail(true); }}
                                className={`ml-4 px-4 py-2 text-sm font-medium rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                                  prog?.completed
                                    ? 'bg-green-50 text-green-600 hover:bg-green-100'
                                    : 'bg-gradient-to-r from-teal-500 to-cyan-600 text-white hover:shadow-lg'
                                }`}
                              >
                                <i className={`${prog?.completed ? 'ri-refresh-line' : 'ri-play-circle-line'} mr-1`}></i>
                                {prog?.completed ? '复习' : prog?.progress ? '继续学习' : '开始学习'}
                              </button>
                            </div>

                            {/* 课件资源列表 */}
                            {section.resources.length > 0 && (
                              <div className="grid grid-cols-2 gap-2 mt-3">
                                {section.resources.map((resource) => {
                                  const isDone = RESOURCE_COMPLETED[resource.id] ?? false;
                                  return (
                                    <div
                                      key={resource.id}
                                      className="flex items-center gap-2.5 p-2.5 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all cursor-pointer"
                                      onClick={() => setShowLearningDetail(true)}
                                    >
                                      <div className={`w-8 h-8 rounded-lg ${getResourceColor(resource.type)} flex items-center justify-center flex-shrink-0`}>
                                        <i className={`${getResourceIcon(resource.type)} text-sm`}></i>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="text-xs font-medium text-gray-900 truncate">{resource.name}</div>
                                        <div className="text-xs text-gray-400">{getResourceLabel(resource.type)} · {resource.size}</div>
                                      </div>
                                      {isDone && (
                                        <i className="ri-checkbox-circle-fill text-green-500 text-base flex-shrink-0"></i>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ===== 能力雷达 ===== */}
        {activeTab === 'ability' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                <i className="ri-radar-line text-teal-600 mr-2"></i>
                能力雷达图
              </h3>
              <div className="flex items-center justify-center py-8">
                <div className="relative w-96 h-96">
                  <svg className="w-full h-full" viewBox="0 0 400 400">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <circle key={level} cx="200" cy="200" r={level * 35} fill="none" stroke="#e5e7eb" strokeWidth="1" />
                    ))}
                    {abilityPoints.slice(0, 8).map((_, index) => {
                      const angle = (index * 360) / 8 - 90;
                      const x = 200 + 175 * Math.cos((angle * Math.PI) / 180);
                      const y = 200 + 175 * Math.sin((angle * Math.PI) / 180);
                      return <line key={index} x1="200" y1="200" x2={x} y2={y} stroke="#e5e7eb" strokeWidth="1" />;
                    })}
                    <polygon
                      points={abilityPoints.slice(0, 8).map((ability, index) => {
                        const angle = (index * 360) / 8 - 90;
                        const radius = (ability.level / ability.maxLevel) * 175;
                        const x = 200 + radius * Math.cos((angle * Math.PI) / 180);
                        const y = 200 + radius * Math.sin((angle * Math.PI) / 180);
                        return `${x},${y}`;
                      }).join(' ')}
                      fill="rgba(20, 184, 166, 0.2)"
                      stroke="rgb(20, 184, 166)"
                      strokeWidth="2"
                    />
                    {abilityPoints.slice(0, 8).map((ability, index) => {
                      const angle = (index * 360) / 8 - 90;
                      const radius = (ability.level / ability.maxLevel) * 175;
                      const x = 200 + radius * Math.cos((angle * Math.PI) / 180);
                      const y = 200 + radius * Math.sin((angle * Math.PI) / 180);
                      return <circle key={index} cx={x} cy={y} r="5" fill="rgb(20, 184, 166)" />;
                    })}
                  </svg>
                  {abilityPoints.slice(0, 8).map((ability, index) => {
                    const angle = (index * 360) / 8 - 90;
                    const x = 200 + 205 * Math.cos((angle * Math.PI) / 180);
                    const y = 200 + 205 * Math.sin((angle * Math.PI) / 180);
                    return (
                      <div
                        key={index}
                        className="absolute text-xs font-semibold text-gray-700"
                        style={{ left: `${x}px`, top: `${y}px`, transform: 'translate(-50%, -50%)' }}
                      >
                        {ability.name}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              {['核心能力', '专业能力', '通用能力'].map((category) => (
                <div key={category} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                  <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center">
                    <i className="ri-star-line text-teal-600 mr-2"></i>
                    {category}
                  </h3>
                  <div className="space-y-4">
                    {abilityPoints.filter(a => a.category === category).map((ability) => (
                      <div key={ability.id} className="border-b border-gray-100 pb-4 last:border-0">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900 text-sm">{ability.name}</span>
                            <span className="text-xs text-gray-400">Lv.{ability.level}</span>
                          </div>
                          <span className="text-sm font-medium text-teal-600">{ability.level}/{ability.maxLevel}</span>
                        </div>
                        <p className="text-xs text-gray-500 mb-2">{ability.description}</p>
                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-teal-500 to-cyan-600 rounded-full"
                            style={{ width: `${(ability.level / ability.maxLevel) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== 进度看板 ===== */}
        {activeTab === 'progress' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                <i className="ri-time-line text-teal-600 mr-2"></i>
                学习时间线
              </h3>
              <div className="relative">
                <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-teal-500 to-cyan-600"></div>
                <div className="space-y-8">
                  {publishedChapters.map((chapter, chIdx) => {
                    const completed = chapter.sections.filter(s => STUDENT_PROGRESS[s.id]?.completed).length;
                    const total = chapter.sections.length;
                    const isActive = chapter.sections.some(s => {
                      const p = STUDENT_PROGRESS[s.id];
                      return p && p.progress > 0 && !p.completed;
                    });
                    const isDone = completed === total && total > 0;
                    const colors = ['bg-teal-500', 'bg-indigo-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500'];
                    const color = colors[chIdx % colors.length];

                    return (
                      <div key={chapter.id} className="relative pl-20">
                        <div className={`absolute left-0 w-16 h-16 ${color} rounded-2xl flex items-center justify-center shadow-lg ${isActive ? 'ring-4 ring-teal-200' : ''}`}>
                          <i className={`${isDone ? 'ri-checkbox-circle-line' : isActive ? 'ri-play-line' : 'ri-book-line'} text-2xl text-white`}></i>
                        </div>
                        <div className={`bg-gray-50 rounded-xl p-5 ${isActive ? 'ring-2 ring-teal-400' : ''}`}>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-base font-bold text-gray-900">{chapter.title}</h4>
                            <div className="flex items-center gap-3">
                              <span className={`px-3 py-1 rounded-lg text-xs font-medium ${
                                isDone ? 'bg-green-100 text-green-700' :
                                isActive ? 'bg-teal-100 text-teal-700' :
                                'bg-gray-200 text-gray-600'
                              }`}>
                                {isDone ? '已完成' : isActive ? '进行中' : '待开始'}
                              </span>
                              <button
                                onClick={() => setShowLearningDetail(true)}
                                className="px-4 py-1.5 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-lg text-xs font-medium hover:shadow-md transition-all whitespace-nowrap cursor-pointer"
                              >
                                进入学习
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-500">{completed}/{total} 小节完成</span>
                            <span className="text-sm font-bold text-teal-600">{total > 0 ? Math.round((completed / total) * 100) : 0}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full ${color} rounded-full`}
                              style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 达标检测 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                <i className="ri-checkbox-circle-line text-teal-600 mr-2"></i>
                章节达标检测
              </h3>
              <div className="grid grid-cols-3 gap-4">
                {publishedChapters.map((chapter, chIdx) => {
                  const completed = chapter.sections.filter(s => STUDENT_PROGRESS[s.id]?.completed).length;
                  const total = chapter.sections.length;
                  const isPassed = completed >= total && total > 0;
                  const isInProgress = !isPassed && chapter.sections.some(s => {
                    const p = STUDENT_PROGRESS[s.id];
                    return p && p.progress > 0;
                  });

                  return (
                    <div key={chapter.id} className={`border-2 rounded-xl p-5 ${
                      isPassed ? 'border-green-400 bg-green-50' :
                      isInProgress ? 'border-teal-400 bg-teal-50' :
                      'border-gray-200 bg-gray-50'
                    }`}>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-bold text-gray-900 text-sm line-clamp-1">{chapter.title}</h4>
                        {isPassed ? (
                          <i className="ri-checkbox-circle-fill text-xl text-green-600 flex-shrink-0"></i>
                        ) : isInProgress ? (
                          <i className="ri-time-line text-xl text-teal-600 flex-shrink-0"></i>
                        ) : (
                          <i className="ri-lock-line text-xl text-gray-400 flex-shrink-0"></i>
                        )}
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-500">完成进度</span>
                        <span className="text-xs font-bold text-teal-600">{completed}/{total}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden mb-2">
                        <div
                          className={`h-full rounded-full ${isPassed ? 'bg-green-500' : 'bg-gradient-to-r from-teal-500 to-cyan-600'}`}
                          style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }}
                        ></div>
                      </div>
                      <div className={`text-xs font-medium ${
                        isPassed ? 'text-green-700' :
                        isInProgress ? 'text-teal-700' :
                        'text-gray-500'
                      }`}>
                        {isPassed ? '✓ 已达标，可进入下一章节' :
                         isInProgress ? `还需完成 ${total - completed} 个小节` :
                         '完成前置章节后解锁'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
