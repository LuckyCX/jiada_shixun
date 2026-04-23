
import { useState } from 'react';
import { SHARED_COURSE_CHAPTERS } from '../../../../mocks/courseChapters';
import type { CourseChapter } from '../../../../mocks/courseChapters';

interface Resource {
  id: string;
  name: string;
  type: 'video' | 'pdf' | 'image' | 'case';
  size: string;
  uploadTime: string;
  url: string;
}

interface Section {
  id: string;
  title: string;
  resources: Resource[];
  published: boolean;
  knowledgePoints: string[];
}

interface Chapter {
  id: string;
  title: string;
  sections: Section[];
  expanded: boolean;
}

const knowledgePointOptions = [
  '创新思维方法', 'SCAMPER技法', '用户访谈技巧', '问卷设计',
  '精益画布', '商业模式画布', 'Figma原型设计', '路演技巧',
  '团队协作', '敏捷开发', '市场分析', '竞品研究'
];

export default function CourseManagement() {
  const [chapters, setChapters] = useState<Chapter[]>(
    SHARED_COURSE_CHAPTERS as Chapter[]
  );
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [currentSection, setCurrentSection] = useState<{ chapterId: string; sectionId: string } | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [saved, setSaved] = useState(false);
  const [addChapterModal, setAddChapterModal] = useState(false);
  const [addSectionModal, setAddSectionModal] = useState<string | null>(null);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [editKnowledgePoints, setEditKnowledgePoints] = useState<{ chapterId: string; sectionId: string } | null>(null);
  const [selectedKnowledgePoints, setSelectedKnowledgePoints] = useState<string[]>([]);

  const showSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const toggleChapter = (chapterId: string) => {
    setChapters(prev => prev.map(ch => ch.id === chapterId ? { ...ch, expanded: !ch.expanded } : ch));
  };

  const toggleSectionPublish = (chapterId: string, sectionId: string) => {
    setChapters(prev =>
      prev.map(ch =>
        ch.id === chapterId
          ? { ...ch, sections: ch.sections.map(sec => sec.id === sectionId ? { ...sec, published: !sec.published } : sec) }
          : ch
      )
    );
    showSaved();
  };

  const openUploadModal = (chapterId: string, sectionId: string) => {
    setCurrentSection({ chapterId, sectionId });
    setUploadModalOpen(true);
    setUploadProgress(0);
    setUploadingFile(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setUploadingFile(file); simulateUpload(file); }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) { setUploadingFile(file); simulateUpload(file); }
  };

  const simulateUpload = (file: File) => {
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) { clearInterval(interval); setTimeout(() => completeUpload(file), 500); return 100; }
        return prev + 10;
      });
    }, 200);
  };

  const completeUpload = (file: File) => {
    if (!currentSection) return;
    const fileType: Resource['type'] = file.type.includes('video') ? 'video' : file.type.includes('pdf') ? 'pdf' : file.type.includes('image') ? 'image' : 'case';
    const newResource: Resource = {
      id: Date.now().toString(),
      name: file.name,
      type: fileType,
      size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
      uploadTime: new Date().toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
      url: URL.createObjectURL(file)
    };
    setChapters(prev =>
      prev.map(ch =>
        ch.id === currentSection.chapterId
          ? { ...ch, sections: ch.sections.map(sec => sec.id === currentSection.sectionId ? { ...sec, resources: [...sec.resources, newResource] } : sec) }
          : ch
      )
    );
    setUploadModalOpen(false);
    setUploadingFile(null);
    setUploadProgress(0);
    showSaved();
  };

  const deleteResource = (chapterId: string, sectionId: string, resourceId: string) => {
    setChapters(prev =>
      prev.map(ch =>
        ch.id === chapterId
          ? { ...ch, sections: ch.sections.map(sec => sec.id === sectionId ? { ...sec, resources: sec.resources.filter(r => r.id !== resourceId) } : sec) }
          : ch
      )
    );
    showSaved();
  };

  const addChapter = () => {
    if (!newChapterTitle.trim()) return;
    setChapters(prev => [...prev, { id: Date.now().toString(), title: newChapterTitle, sections: [], expanded: true }]);
    setAddChapterModal(false);
    setNewChapterTitle('');
    showSaved();
  };

  const addSection = (chapterId: string) => {
    if (!newSectionTitle.trim()) return;
    const chapter = chapters.find(ch => ch.id === chapterId);
    if (!chapter) return;
    const sectionNumber = chapter.sections.length + 1;
    const chapterNumber = chapters.findIndex(ch => ch.id === chapterId) + 1;
    const newSection: Section = {
      id: `${chapterId}-${sectionNumber}`,
      title: `${chapterNumber}.${sectionNumber} ${newSectionTitle}`,
      resources: [],
      published: false,
      knowledgePoints: []
    };
    setChapters(prev => prev.map(ch => ch.id === chapterId ? { ...ch, sections: [...ch.sections, newSection] } : ch));
    setAddSectionModal(null);
    setNewSectionTitle('');
    showSaved();
  };

  const openKnowledgePointsModal = (chapterId: string, sectionId: string) => {
    const chapter = chapters.find(ch => ch.id === chapterId);
    const section = chapter?.sections.find(sec => sec.id === sectionId);
    if (section) { setSelectedKnowledgePoints(section.knowledgePoints); setEditKnowledgePoints({ chapterId, sectionId }); }
  };

  const saveKnowledgePoints = () => {
    if (!editKnowledgePoints) return;
    setChapters(prev =>
      prev.map(ch =>
        ch.id === editKnowledgePoints.chapterId
          ? { ...ch, sections: ch.sections.map(sec => sec.id === editKnowledgePoints.sectionId ? { ...sec, knowledgePoints: selectedKnowledgePoints } : sec) }
          : ch
      )
    );
    setEditKnowledgePoints(null);
    showSaved();
  };

  const toggleKnowledgePoint = (point: string) => {
    setSelectedKnowledgePoints(prev => prev.includes(point) ? prev.filter(p => p !== point) : [...prev, point]);
  };

  const getResourceIcon = (type: string) => {
    const map: Record<string, string> = { video: 'ri-video-line', pdf: 'ri-file-pdf-line', image: 'ri-image-line', case: 'ri-lightbulb-line' };
    return map[type] || 'ri-file-line';
  };

  const getResourceColor = (type: string) => {
    const map: Record<string, string> = { video: 'text-red-500 bg-red-50', pdf: 'text-teal-500 bg-teal-50', image: 'text-green-500 bg-green-50', case: 'text-amber-500 bg-amber-50' };
    return map[type] || 'text-gray-500 bg-gray-50';
  };

  const totalSections = chapters.reduce((sum, ch) => sum + ch.sections.length, 0);
  const publishedSections = chapters.reduce((sum, ch) => sum + ch.sections.filter(s => s.published).length, 0);
  const totalResources = chapters.reduce((sum, ch) => sum + ch.sections.reduce((s, sec) => s + sec.resources.length, 0), 0);

  return (
    <div className="space-y-5">
      {/* 顶部操作栏 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <i className="ri-book-2-line text-teal-500"></i>
              实践课程内容管理
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">管理课程章节结构，上传课件资源，关联知识点标签</p>
          </div>
          <button
            onClick={() => setAddChapterModal(true)}
            className="px-4 py-2 bg-teal-500 text-white text-sm font-medium rounded-xl hover:bg-teal-600 transition-colors whitespace-nowrap cursor-pointer"
          >
            <i className="ri-add-line mr-1.5"></i>新增章节
          </button>
        </div>
        <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-4 gap-3">
          {[
            { label: '课程章节', value: chapters.length, icon: 'ri-book-line', bg: 'bg-teal-50', iconCls: 'text-teal-500', valCls: 'text-teal-700' },
            { label: '课程小节', value: totalSections, icon: 'ri-list-check', bg: 'bg-indigo-50', iconCls: 'text-indigo-500', valCls: 'text-indigo-700' },
            { label: '已发布小节', value: publishedSections, icon: 'ri-checkbox-circle-line', bg: 'bg-green-50', iconCls: 'text-green-500', valCls: 'text-green-700' },
            { label: '课件资源', value: totalResources, icon: 'ri-folder-line', bg: 'bg-orange-50', iconCls: 'text-orange-500', valCls: 'text-orange-700' },
          ].map((item, i) => (
            <div key={i} className={`flex items-center gap-2 ${item.bg} rounded-xl px-3 py-2.5`}>
              <i className={`${item.icon} ${item.iconCls} text-sm`}></i>
              <div>
                <div className="text-xs text-gray-500">{item.label}</div>
                <div className={`text-lg font-bold ${item.valCls}`}>{item.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 章节列表 */}
      <div className="space-y-3">
        {chapters.map((chapter) => (
          <div key={chapter.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div
              onClick={() => toggleChapter(chapter.id)}
              className="flex items-center justify-between p-4 bg-gradient-to-r from-teal-50 to-cyan-50 cursor-pointer hover:from-teal-100 hover:to-cyan-100 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                  <i className="ri-book-open-line text-white text-sm"></i>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">{chapter.title}</h3>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {chapter.sections.length} 个小节 · {chapter.sections.filter(s => s.published).length} 个已发布
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); setAddSectionModal(chapter.id); }}
                  className="px-3 py-1.5 bg-white text-teal-600 text-xs font-medium rounded-lg hover:bg-teal-50 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <i className="ri-add-line mr-1"></i>新增小节
                </button>
                <i className={`${chapter.expanded ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} text-gray-400 text-lg`}></i>
              </div>
            </div>

            {chapter.expanded && (
              <div className="p-4 space-y-3">
                {chapter.sections.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    <i className="ri-inbox-line text-3xl mb-2 block"></i>
                    暂无小节，点击上方"新增小节"开始添加内容
                  </div>
                ) : (
                  chapter.sections.map((section) => (
                    <div key={section.id} className="border border-gray-100 rounded-xl p-4 hover:border-teal-200 transition-all">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm font-bold text-gray-900">{section.title}</h4>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${section.published ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                              {section.published ? '已发布' : '未发布'}
                            </span>
                          </div>
                          {section.knowledgePoints.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <i className="ri-price-tag-3-line text-teal-500 text-xs"></i>
                              {section.knowledgePoints.map((point, idx) => (
                                <span key={idx} className="px-2 py-0.5 bg-teal-50 text-teal-600 text-xs rounded-md">{point}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                          <button
                            onClick={() => openKnowledgePointsModal(chapter.id, section.id)}
                            className="px-3 py-1.5 bg-teal-50 text-teal-600 text-xs font-medium rounded-lg hover:bg-teal-100 transition-colors whitespace-nowrap cursor-pointer"
                          >
                            <i className="ri-price-tag-3-line mr-1"></i>关联知识点
                          </button>
                          <button
                            onClick={() => openUploadModal(chapter.id, section.id)}
                            className="px-3 py-1.5 bg-indigo-50 text-indigo-600 text-xs font-medium rounded-lg hover:bg-indigo-100 transition-colors whitespace-nowrap cursor-pointer"
                          >
                            <i className="ri-upload-2-line mr-1"></i>上传课件
                          </button>
                          <button
                            onClick={() => toggleSectionPublish(chapter.id, section.id)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${section.published ? 'bg-gray-50 text-gray-600 hover:bg-gray-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                          >
                            <i className={`${section.published ? 'ri-eye-off-line' : 'ri-eye-line'} mr-1`}></i>
                            {section.published ? '下架' : '发布'}
                          </button>
                        </div>
                      </div>

                      {section.resources.length > 0 ? (
                        <div className="space-y-2">
                          {section.resources.map((resource) => (
                            <div key={resource.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all">
                              <div className={`w-9 h-9 rounded-lg ${getResourceColor(resource.type)} flex items-center justify-center flex-shrink-0`}>
                                <i className={`${getResourceIcon(resource.type)} text-base`}></i>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-900 truncate">{resource.name}</div>
                                <div className="text-xs text-gray-500 mt-0.5">{resource.size} · 上传于 {resource.uploadTime}</div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <button className="w-7 h-7 flex items-center justify-center rounded-lg bg-white text-gray-600 hover:bg-teal-50 hover:text-teal-600 transition-colors cursor-pointer">
                                  <i className="ri-eye-line text-sm"></i>
                                </button>
                                <button
                                  onClick={() => deleteResource(chapter.id, section.id, resource.id)}
                                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-white text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
                                >
                                  <i className="ri-delete-bin-line text-sm"></i>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-6 bg-gray-50 rounded-lg text-gray-400 text-xs">
                          <i className="ri-folder-open-line text-2xl mb-1 block"></i>
                          暂无课件资源，点击"上传课件"添加内容
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 上传课件弹窗 */}
      {uploadModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
                    <i className="ri-upload-cloud-line text-white text-lg"></i>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">上传课件资源</h3>
                    <p className="text-xs text-gray-400 mt-0.5">支持视频、PDF、图片、案例文件</p>
                  </div>
                </div>
                <button onClick={() => setUploadModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer">
                  <i className="ri-close-line text-lg"></i>
                </button>
              </div>
            </div>
            <div className="p-6">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${dragActive ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:border-teal-300 hover:bg-gray-50'}`}
              >
                <input type="file" id="admin-file-upload" className="hidden" onChange={handleFileSelect} accept="video/*,.pdf,image/*,.doc,.docx,.ppt,.pptx" />
                <label htmlFor="admin-file-upload" className="cursor-pointer">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center">
                    <i className="ri-upload-cloud-2-line text-white text-3xl"></i>
                  </div>
                  <div className="text-sm font-medium text-gray-900 mb-1">拖拽文件到此处，或点击选择文件</div>
                  <div className="text-xs text-gray-400">支持 MP4、PDF、JPG、PNG、DOC、PPT 等格式</div>
                </label>
              </div>
              {uploadingFile && (
                <div className="mt-4 p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3 mb-2">
                    <i className="ri-file-line text-teal-500"></i>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{uploadingFile.name}</div>
                      <div className="text-xs text-gray-500">{(uploadingFile.size / 1024 / 1024).toFixed(1)} MB</div>
                    </div>
                    <div className="text-sm font-bold text-teal-600">{uploadProgress}%</div>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 新增章节弹窗 */}
      {addChapterModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center">
                <i className="ri-book-line text-white text-lg"></i>
              </div>
              <h3 className="text-base font-bold text-gray-900">新增课程章节</h3>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-2">章节标题</label>
              <input
                type="text"
                placeholder="例如：第六章 路演与融资"
                value={newChapterTitle}
                onChange={(e) => setNewChapterTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
                autoFocus
              />
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => { setAddChapterModal(false); setNewChapterTitle(''); }} className="flex-1 px-4 py-2 bg-gray-100 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap">取消</button>
              <button onClick={addChapter} className="flex-1 px-4 py-2 bg-teal-500 text-white text-sm font-medium rounded-xl hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap">
                <i className="ri-check-line mr-1"></i>确认添加
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 新增小节弹窗 */}
      {addSectionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
                <i className="ri-list-check text-white text-lg"></i>
              </div>
              <h3 className="text-base font-bold text-gray-900">新增课程小节</h3>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-2">小节标题</label>
              <input
                type="text"
                placeholder="例如：SCAMPER创新思维方法"
                value={newSectionTitle}
                onChange={(e) => setNewSectionTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
              <div className="text-xs text-gray-400 mt-1.5">系统将自动添加小节编号</div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => { setAddSectionModal(null); setNewSectionTitle(''); }} className="flex-1 px-4 py-2 bg-gray-100 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap">取消</button>
              <button onClick={() => addSection(addSectionModal)} className="flex-1 px-4 py-2 bg-indigo-500 text-white text-sm font-medium rounded-xl hover:bg-indigo-600 transition-colors cursor-pointer whitespace-nowrap">
                <i className="ri-check-line mr-1"></i>确认添加
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 关联知识点弹窗 */}
      {editKnowledgePoints && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center">
                <i className="ri-price-tag-3-line text-white text-lg"></i>
              </div>
              <h3 className="text-base font-bold text-gray-900">关联知识点标签</h3>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-2">选择知识点（可多选）</label>
              <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto p-3 bg-gray-50 rounded-xl">
                {knowledgePointOptions.map((point) => (
                  <button
                    key={point}
                    onClick={() => toggleKnowledgePoint(point)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap ${selectedKnowledgePoints.includes(point) ? 'bg-teal-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
                  >
                    {selectedKnowledgePoints.includes(point) && <i className="ri-check-line mr-1"></i>}
                    {point}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => { setEditKnowledgePoints(null); setSelectedKnowledgePoints([]); }} className="flex-1 px-4 py-2 bg-gray-100 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap">取消</button>
              <button onClick={saveKnowledgePoints} className="flex-1 px-4 py-2 bg-teal-500 text-white text-sm font-medium rounded-xl hover:bg-teal-600 transition-colors cursor-pointer whitespace-nowrap">
                <i className="ri-check-line mr-1"></i>保存设置
              </button>
            </div>
          </div>
        </div>
      )}

      {saved && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-xl">
          <i className="ri-check-circle-fill text-green-400 text-lg"></i>
          <span className="text-sm font-medium">课程内容已保存！</span>
        </div>
      )}
    </div>
  );
}
