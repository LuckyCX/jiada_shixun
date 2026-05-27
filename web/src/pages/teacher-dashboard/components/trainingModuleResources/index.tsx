import { useCallback, useEffect, useMemo, useState, type ElementType } from 'react';
import * as AntIcons from '@ant-design/icons';
import { Button, ColorPicker, Form, Input, InputNumber, Modal, Select, Upload, message, type UploadFile } from 'antd';
import RichTextEditor from '../../../../components/RichTextEditor';
import { sanitizeRichText } from '../../../../lib/richText';
import {
  createInstanceCase,
  createInstanceCategory,
  deleteInstanceCase,
  deleteInstanceCaseCover,
  deleteInstanceCaseResource,
  deleteInstanceCategory,
  downloadTeacherInstanceResource,
  fetchTeacherInstanceLibrary,
  getTeacherInstanceCaseCoverUrl,
  getTeacherInstanceResourcePreviewUrl,
  updateInstanceCase,
  updateInstanceCategory,
  uploadInstanceCaseCover,
  uploadInstanceCaseResource,
  type InstanceLibraryCase,
  type InstanceLibraryCategory,
} from '../../../../lib/teacherInstanceLibraryApi';

const trainingModules = [
  { key: 'ideation', label: '创新思维', fullName: '创新思维与创意生成', icon: 'ri-lightbulb-line', color: 'from-purple-500 to-violet-500' },
  { key: 'market', label: '市场调研', fullName: '市场调研与用户画像', icon: 'ri-search-line', color: 'from-green-500 to-emerald-500' },
  { key: 'product', label: '产品设计', fullName: '产品设计与迭代', icon: 'ri-pencil-ruler-line', color: 'from-orange-500 to-amber-500' },
  { key: 'business', label: '商业模式', fullName: '商业模式设计', icon: 'ri-pie-chart-line', color: 'from-pink-500 to-rose-500' },
  { key: 'simulation', label: 'AI仿真', fullName: 'AI仿真模拟', icon: 'ri-robot-line', color: 'from-indigo-500 to-blue-500' },
  { key: 'plan', label: '商业计划', fullName: '商业计划书要点', icon: 'ri-file-text-line', color: 'from-teal-500 to-cyan-500' },
] as const;

type TrainingModuleKey = (typeof trainingModules)[number]['key'];

/** 使用同一套实例库表结构、按 training_module_key 隔离 */
const INSTANCE_LIBRARY_MODULE_KEYS: TrainingModuleKey[] = ['ideation', 'product'];
type TrainingModuleResourcesProps = {
  selectedModule?: string;
  hideModuleTabs?: boolean;
};

const DEFAULT_CATEGORY_COLOR = '#8b5cf6';
const DEFAULT_CATEGORY_ICON = 'FolderOutlined';
type AntIconComponent = ElementType<{ className?: string }>;
const antIconEntries = Object.entries(AntIcons).filter(
  ([name, value]) => /(Outlined|Filled|TwoTone)$/.test(name) && (typeof value === 'function' || (typeof value === 'object' && value !== null)),
) as [
  string,
  AntIconComponent,
][];
const antIconMap = Object.fromEntries(antIconEntries) as Record<string, AntIconComponent>;
const categoryIconOptions = antIconEntries.map(([value, Icon]) => ({ value, Icon }));

function displayColor(color?: string) {
  const value = String(color || '').trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value) ? value : DEFAULT_CATEGORY_COLOR;
}

function detailSummary(html: string) {
  return sanitizeRichText(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function CategoryIcon({ icon, className }: { icon?: string; className?: string }) {
  const Icon = antIconMap[icon || ''] || antIconMap[DEFAULT_CATEGORY_ICON];
  return <Icon className={className} />;
}

function normalizeModuleKey(key?: string): TrainingModuleKey {
  return trainingModules.some((mod) => mod.key === key) ? (key as TrainingModuleKey) : 'ideation';
}

export default function TrainingModuleResources({ selectedModule: selectedModuleProp, hideModuleTabs = false }: TrainingModuleResourcesProps) {
  const [internalSelectedModule, setInternalSelectedModule] = useState<TrainingModuleKey>('ideation');
  const [categories, setCategories] = useState<InstanceLibraryCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<InstanceLibraryCategory | null>(null);
  const [caseModalOpen, setCaseModalOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<InstanceLibraryCase | null>(null);
  const [detailHtml, setDetailHtml] = useState('');
  const [pendingFiles, setPendingFiles] = useState<UploadFile[]>([]);
  const [coverFileList, setCoverFileList] = useState<UploadFile[]>([]);
  const [coverRemoved, setCoverRemoved] = useState(false);
  const [previewCase, setPreviewCase] = useState<InstanceLibraryCase | null>(null);
  const [categoryColor, setCategoryColor] = useState(DEFAULT_CATEGORY_COLOR);
  const [categoryIcon, setCategoryIcon] = useState(DEFAULT_CATEGORY_ICON);
  const [categoryIconOpen, setCategoryIconOpen] = useState(false);
  const [categoryForm] = Form.useForm();
  const [caseForm] = Form.useForm();
  const selectedModule = normalizeModuleKey(selectedModuleProp || internalSelectedModule);
  const currentModule = trainingModules.find((mod) => mod.key === selectedModule) || trainingModules[0];
  const selectedCategory = useMemo(
    () => categories.find((item) => item.id === selectedCategoryId) || categories[0],
    [categories, selectedCategoryId],
  );

  const isPrototypeLibrary = selectedModule === 'product';
  const categoryPanelTitle = isPrototypeLibrary ? '案例分类' : '垂直方向';
  const caseCountLabel = isPrototypeLibrary ? '个原型案例' : '个实例';
  const addCaseLabel = isPrototypeLibrary ? '新增案例' : '新增实例';

  const loadLibrary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchTeacherInstanceLibrary(selectedModule);
      setCategories(res.categories || []);
      setSelectedCategoryId((prev) => {
        if (prev && res.categories?.some((cat) => cat.id === prev)) return prev;
        return res.categories?.[0]?.id || '';
      });
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载实例库失败');
    } finally {
      setLoading(false);
    }
  }, [selectedModule]);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  const handleModuleChange = (key: TrainingModuleKey) => {
    setInternalSelectedModule(key);
    setSelectedCategoryId('');
  };

  const openCategoryModal = (category?: InstanceLibraryCategory) => {
    setEditingCategory(category || null);
    setCategoryColor(displayColor(category?.color));
    setCategoryIcon(antIconMap[category?.icon || ''] ? category!.icon : DEFAULT_CATEGORY_ICON);
    categoryForm.setFieldsValue({
      name: category?.name || '',
      sortOrder: category?.sortOrder || 0,
    });
    setCategoryModalOpen(true);
  };

  const saveCategory = async () => {
    const values = await categoryForm.validateFields();
    const payload = {
      name: values.name,
      icon: categoryIcon,
      color: categoryColor,
      sortOrder: values.sortOrder || 0,
    };
    if (editingCategory) {
      await updateInstanceCategory(editingCategory.id, payload);
      message.success('方向已更新');
    } else {
      await createInstanceCategory(payload, selectedModule);
      message.success('方向已新增');
    }
    setCategoryModalOpen(false);
    await loadLibrary();
  };

  const handleDeleteCategory = (category: InstanceLibraryCategory) => {
    Modal.confirm({
      title: '删除方向',
      content: `确定删除「${category.name}」？该方向下的实例和附件将一并删除。`,
      okType: 'danger',
      onOk: async () => {
        await deleteInstanceCategory(category.id);
        message.success('已删除');
        await loadLibrary();
      },
    });
  };

  const openCaseModal = (caseItem?: InstanceLibraryCase) => {
    if (!selectedCategory) {
      message.error('请先选择方向');
      return;
    }
    setEditingCase(caseItem || null);
    setDetailHtml(caseItem?.detailHtml || '');
    setPendingFiles([]);
    setCoverFileList([]);
    setCoverRemoved(false);
    caseForm.setFieldsValue({
      title: caseItem?.title || '',
      tags: caseItem?.tags || [],
      projectOutcome: caseItem?.projectOutcome || '',
      sortOrder: caseItem?.sortOrder || 0,
    });
    setCaseModalOpen(true);
  };

  const saveCase = async () => {
    const values = await caseForm.validateFields();
    const categoryId = selectedCategory?.id;
    if (!categoryId) {
      message.error('请先选择方向');
      return;
    }
    const cleanHtml = sanitizeRichText(detailHtml);
    const plainDetail = cleanHtml.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim();
    if (!plainDetail) {
      message.error('请输入详情');
      return;
    }
    const payload = {
      categoryId,
      title: values.title,
      detailHtml: cleanHtml,
      tags: values.tags || [],
      projectOutcome: values.projectOutcome || '',
      sortOrder: values.sortOrder || 0,
    };
    const saved = editingCase
      ? await updateInstanceCase(editingCase.id, payload)
      : await createInstanceCase(categoryId, {
          title: payload.title,
          detailHtml: payload.detailHtml,
          tags: payload.tags,
          projectOutcome: payload.projectOutcome,
          sortOrder: payload.sortOrder,
        });
    const hadStoredCover = Boolean(editingCase?.hasCoverImage);
    if (coverRemoved && hadStoredCover) {
      await deleteInstanceCaseCover(saved.id);
    }
    const coverFile = coverFileList[0]?.originFileObj as File | undefined;
    if (coverFile) {
      await uploadInstanceCaseCover(saved.id, coverFile);
    }
    for (const file of pendingFiles) {
      const rawFile = file.originFileObj as File | undefined;
      if (rawFile) await uploadInstanceCaseResource(saved.id, rawFile);
    }
    message.success(editingCase ? '实例已更新' : '实例已新增');
    setCaseModalOpen(false);
    await loadLibrary();
  };

  const handleDeleteCase = (caseItem: InstanceLibraryCase) => {
    Modal.confirm({
      title: '删除实例',
      content: `确定删除「${caseItem.title}」？附件将一并删除。`,
      okType: 'danger',
      onOk: async () => {
        await deleteInstanceCase(caseItem.id);
        message.success('已删除');
        await loadLibrary();
      },
    });
  };

  const handleDeleteResource = (resourceId: string) => {
    Modal.confirm({
      title: '删除附件',
      content: '确定删除该附件？',
      okType: 'danger',
      onOk: async () => {
        await deleteInstanceCaseResource(resourceId);
        message.success('附件已删除');
        setEditingCase((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            resources: prev.resources.filter((resource) => resource.id !== resourceId),
          };
        });
        await loadLibrary();
      },
    });
  };

  return (
    <div className="space-y-5">
      {!hideModuleTabs && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3 overflow-x-auto">
            {trainingModules.map((mod) => (
              <button
                key={mod.key}
                type="button"
                onClick={() => handleModuleChange(mod.key)}
                className={`px-5 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap text-sm cursor-pointer ${
                  selectedModule === mod.key ? `bg-gradient-to-r ${mod.color} text-white shadow-lg` : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <i className={`${mod.icon} mr-1.5`}></i>
                {mod.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {INSTANCE_LIBRARY_MODULE_KEYS.includes(selectedModule) ? (
        <div className="grid grid-cols-4 gap-6 min-h-[calc(100vh-250px)]">
          <div className="col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sticky top-6 max-h-[calc(100vh-260px)] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-gray-900">{categoryPanelTitle}</h3>
                <button type="button" onClick={() => openCategoryModal()} className="text-sm font-medium text-teal-600 cursor-pointer">
                  新增
                </button>
              </div>
              <div className="space-y-2">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className={`w-full px-4 py-3 text-sm font-medium rounded-xl transition-all text-left flex items-center gap-3 cursor-pointer ${
                      selectedCategory.id === cat.id
                        ? 'text-white shadow-md'
                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                    }`}
                    style={selectedCategory.id === cat.id ? { backgroundColor: displayColor(cat.color) } : undefined}
                  >
                    <CategoryIcon className="text-base flex-shrink-0" icon={cat.icon} />
                    <span className="flex-1">{cat.name}</span>
                    <span
                      className="text-xs opacity-80"
                      onClick={(e) => {
                        e.stopPropagation();
                        openCategoryModal(cat);
                      }}
                    >
                      编辑
                    </span>
                  </button>
                ))}
                  {!loading && categories.length === 0 && (
                  <div className="rounded-xl border border-dashed border-gray-200 p-4 text-center text-sm text-gray-500">
                    {isPrototypeLibrary ? '暂无分类' : '暂无方向'}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="col-span-3">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 max-h-[calc(100vh-260px)] flex flex-col">
              {selectedCategory ? (
                <>
                  <div className="flex items-center gap-3 mb-6">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-white"
                      style={{ backgroundColor: displayColor(selectedCategory.color) }}
                    >
                      <CategoryIcon className="text-2xl" icon={selectedCategory.icon} />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-xl font-bold text-gray-900">{selectedCategory.name}</h2>
                      <p className="text-sm text-gray-500">
                        该分类共 {selectedCategory.cases.length} {caseCountLabel}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openCaseModal()}
                      className="px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-medium cursor-pointer hover:bg-teal-700"
                    >
                      {addCaseLabel}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(selectedCategory)}
                      className="px-4 py-2 rounded-xl bg-red-50 text-red-600 text-sm font-medium cursor-pointer hover:bg-red-100"
                    >
                      {isPrototypeLibrary ? '删除分类' : '删除方向'}
                    </button>
                  </div>

                  <div className="space-y-4 overflow-y-auto pr-2">
                    {selectedCategory.cases.map((caseItem) => (
                      <div key={caseItem.id} className="border border-gray-200 rounded-xl p-5 hover:shadow-lg hover:border-teal-200 transition-all">
                        <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex-1">
                        {caseItem.hasCoverImage && (
                          <div className="mb-3 rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
                            <img
                              src={getTeacherInstanceCaseCoverUrl(caseItem.id)}
                              alt=""
                              className="w-full h-32 object-cover block"
                            />
                          </div>
                        )}
                        <h3 className="text-base font-bold text-gray-900 mb-2">{caseItem.title}</h3>
                            <p
                              className="text-sm text-gray-600 leading-relaxed mb-3"
                              style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden' }}
                            >
                              {detailSummary(caseItem.detailHtml)}
                            </p>
                            <div className="flex items-center gap-2 mb-3 flex-wrap">
                              {caseItem.tags.map((tag) => (
                                <span key={tag} className="px-2.5 py-1 bg-teal-50 text-teal-700 text-xs font-medium rounded-full whitespace-nowrap">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-sm whitespace-nowrap">
                            <button type="button" onClick={() => setPreviewCase(caseItem)} className="text-blue-600 cursor-pointer">
                              详情
                            </button>
                            <button type="button" onClick={() => openCaseModal(caseItem)} className="text-teal-600 cursor-pointer">
                              编辑
                            </button>
                            <button type="button" onClick={() => handleDeleteCase(caseItem)} className="text-red-600 cursor-pointer">
                              删除
                            </button>
                          </div>
                        </div>
                        <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg p-2.5 mb-3">
                          <i className="ri-trophy-line text-green-600 text-sm mt-0.5"></i>
                          <div>
                            <p className="text-xs font-semibold text-green-800 mb-0.5">项目成果</p>
                            <p className="text-xs text-green-700">{caseItem.projectOutcome || '未填写'}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {!loading && selectedCategory.cases.length === 0 && (
                      <div className="rounded-xl border border-dashed border-gray-200 p-10 text-center text-sm text-gray-500">
                        {isPrototypeLibrary ? '暂无案例' : '暂无实例'}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 rounded-xl border border-dashed border-gray-200 p-12 text-center text-sm text-gray-500">
                  {isPrototypeLibrary ? '请先新增案例分类' : '请先新增实例库方向'}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
          <div className={`w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br ${currentModule.color} text-white flex items-center justify-center`}>
            <i className={`${currentModule.icon} text-2xl`}></i>
          </div>
          <h3 className="text-base font-bold text-gray-900 mb-2">{currentModule.fullName}</h3>
          <p className="text-sm text-gray-500">该模块资源维护暂未开放</p>
        </div>
      )}

      <Modal
        title={editingCategory ? '编辑方向' : '新增方向'}
        open={categoryModalOpen}
        onCancel={() => setCategoryModalOpen(false)}
        onOk={saveCategory}
        okButtonProps={{ style: { backgroundColor: '#0d9488', borderColor: '#0d9488' } }}
        destroyOnHidden
      >
        <Form form={categoryForm} layout="vertical">
          <Form.Item name="name" label="方向名称" rules={[{ required: true, message: '请输入方向名称' }]}>
            <Input maxLength={128} />
          </Form.Item>
          <Form.Item label="图标">
            <Select
              value={categoryIcon}
              open={categoryIconOpen}
              onOpenChange={setCategoryIconOpen}
              popupMatchSelectWidth={false}
              options={categoryIconOptions.map((item) => ({
                value: item.value,
                label: <item.Icon className="text-lg" />,
              }))}
              popupRender={() => (
                <div className="grid grid-cols-10 gap-1 p-2 max-h-72 overflow-y-auto w-[360px]">
                  {categoryIconOptions.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => {
                        setCategoryIcon(item.value);
                        setCategoryIconOpen(false);
                      }}
                      className={`h-8 rounded-md flex items-center justify-center cursor-pointer ${
                        categoryIcon === item.value ? 'bg-teal-50 text-teal-600' : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <item.Icon className="text-lg" />
                    </button>
                  ))}
                </div>
              )}
            />
          </Form.Item>
          <Form.Item label="颜色">
            <ColorPicker value={categoryColor} format="hex" onChange={(color) => setCategoryColor(color.toHexString())} showText />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序">
            <InputNumber className="w-full" min={0} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingCase ? '编辑实例' : '新增实例'}
        open={caseModalOpen}
        onCancel={() => setCaseModalOpen(false)}
        onOk={saveCase}
        okButtonProps={{ style: { backgroundColor: '#0d9488', borderColor: '#0d9488' } }}
        width="min(960px, calc(100vw - 48px))"
        style={{ top: 24 }}
        styles={{ body: { maxHeight: 'calc(100vh - 170px)', overflowY: 'auto', overflowX: 'hidden' } }}
        destroyOnHidden
      >
        <Form form={caseForm} layout="vertical" className="w-full max-w-full overflow-x-hidden pr-2">
          <Form.Item label="所属方向">
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: displayColor(selectedCategory?.color) }}></span>
              <span>{selectedCategory?.name || '未选择方向'}</span>
            </div>
          </Form.Item>
          <Form.Item label="项目展示图">
            {editingCase?.hasCoverImage && !coverRemoved && coverFileList.length === 0 ? (
              <div className="relative rounded-xl border border-gray-200 bg-gray-50 overflow-hidden mb-2">
                <img
                  src={getTeacherInstanceCaseCoverUrl(editingCase.id)}
                  alt=""
                  className="w-full max-h-52 object-contain block"
                />
                <button
                  type="button"
                  className="absolute top-2 right-2 px-3 py-1 rounded-lg bg-white/90 border border-gray-200 text-sm text-gray-700 shadow-sm cursor-pointer hover:bg-white"
                  onClick={() => setCoverRemoved(true)}
                >
                  移除
                </button>
              </div>
            ) : null}
            <Upload
              listType="picture-card"
              maxCount={1}
              accept="image/jpeg,image/png,image/gif,image/webp"
              fileList={coverFileList}
              onChange={({ fileList }) => {
                setCoverFileList(fileList);
                if (fileList.length > 0) setCoverRemoved(false);
              }}
              beforeUpload={(file) => {
                const okMime = /^image\/(jpeg|png|gif|webp)$/i.test(file.type || '');
                if (!okMime) {
                  message.warning('请上传 JPG、PNG、GIF 或 WEBP');
                  return Upload.LIST_IGNORE;
                }
                if (file.size > 8 * 1024 * 1024) {
                  message.warning('图片不超过 8MB');
                  return Upload.LIST_IGNORE;
                }
                return false;
              }}
            >
              {coverFileList.length >= 1 ? null : (
                <div className="text-center px-2">
                  <i className="ri-image-add-line text-2xl text-gray-400" />
                  <div className="text-xs text-gray-500 mt-1">上传</div>
                </div>
              )}
            </Upload>
            <p className="text-xs text-gray-400 mt-1 m-0">仅 1 张，用于列表与详情大图展示。</p>
          </Form.Item>
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input maxLength={200} />
          </Form.Item>
          <Form.Item label="详情" required>
            <RichTextEditor value={detailHtml} onChange={setDetailHtml} placeholder="请输入实例详情，可直接粘贴 Word 内容" minRows={10} />
          </Form.Item>
          <Form.Item name="tags" label="自定义标签">
            <Select mode="tags" tokenSeparators={[',', '，']} placeholder="输入后回车添加标签" />
          </Form.Item>
          <Form.Item name="projectOutcome" label="项目成果">
            <Input.TextArea rows={3} maxLength={1000} />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序">
            <InputNumber className="w-full" min={0} />
          </Form.Item>
          {editingCase && editingCase.resources.length > 0 && (
            <div className="space-y-2 mb-4">
              <div className="text-sm font-medium text-gray-700">已有附件</div>
              {editingCase.resources.map((resource) => (
                <div key={resource.id} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 text-sm overflow-hidden">
                  <div className="flex items-center gap-2 min-w-0">
                    <i className="ri-attachment-2 text-gray-500"></i>
                    <span className="truncate text-gray-700">{resource.originName}</span>
                    <span className="text-xs text-gray-400">{resource.size}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    {resource.canPreview && (
                      <a href={getTeacherInstanceResourcePreviewUrl(resource.id)} target="_blank" rel="noreferrer" className="text-blue-600">
                        预览
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => downloadTeacherInstanceResource(resource.id, resource.originName)}
                      className="text-teal-600 cursor-pointer"
                    >
                      下载
                    </button>
                    <button type="button" onClick={() => handleDeleteResource(resource.id)} className="text-red-600 cursor-pointer">
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700">可选附件</div>
            <Upload
              multiple
              fileList={pendingFiles}
              beforeUpload={(file) => {
                setPendingFiles((prev) => [
                  ...prev,
                  {
                    uid: file.uid,
                    name: file.name,
                    status: 'done',
                    size: file.size,
                    type: file.type,
                    originFileObj: file,
                  },
                ]);
                return false;
              }}
              onRemove={(file) => {
                setPendingFiles((prev) => prev.filter((item) => item.uid !== file.uid));
              }}
            >
              <Button icon={<i className="ri-upload-cloud-line"></i>}>选择附件</Button>
            </Upload>
            {pendingFiles.length > 0 && (
              <div className="text-xs text-gray-500">已选择 {pendingFiles.length} 个文件，保存实例后上传。</div>
            )}
          </div>
        </Form>
      </Modal>

      <Modal
        title={previewCase?.title || '实例详情'}
        open={Boolean(previewCase)}
        onCancel={() => setPreviewCase(null)}
        footer={null}
        width="min(900px, calc(100vw - 48px))"
        styles={{ body: { overflowX: 'hidden' } }}
      >
        {previewCase && (
          <div className="space-y-4 max-h-[calc(100vh-220px)] overflow-y-auto overflow-x-hidden pr-2">
            {previewCase.hasCoverImage && (
              <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                <img
                  src={getTeacherInstanceCaseCoverUrl(previewCase.id)}
                  alt=""
                  className="w-full max-h-[min(380px,calc(100vh-380px))] object-contain block mx-auto"
                />
              </div>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              {previewCase.tags.map((tag) => (
                <span key={tag} className="px-2.5 py-1 bg-teal-50 text-teal-700 text-xs font-medium rounded-full whitespace-nowrap">
                  {tag}
                </span>
              ))}
            </div>
            <div
              className="prose max-w-none overflow-x-hidden break-words [&_*]:max-w-full [&_img]:h-auto [&_table]:w-full"
              dangerouslySetInnerHTML={{ __html: sanitizeRichText(previewCase.detailHtml) }}
            />
            <div className="rounded-lg bg-green-50 border border-green-200 p-3">
              <p className="text-xs font-semibold text-green-800 mb-1">项目成果</p>
              <p className="text-sm text-green-700">{previewCase.projectOutcome || '未填写'}</p>
            </div>
            {previewCase.resources.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-900">附件</p>
                {previewCase.resources.map((resource) => (
                  <div key={resource.id} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 text-sm overflow-hidden">
                    <div className="flex items-center gap-2 min-w-0">
                      <i className="ri-attachment-2 text-gray-500"></i>
                      <span className="truncate text-gray-700">{resource.originName}</span>
                      <span className="text-xs text-gray-400">{resource.size}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      {resource.canPreview && (
                        <a href={getTeacherInstanceResourcePreviewUrl(resource.id)} target="_blank" rel="noreferrer" className="text-blue-600">
                          预览
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => downloadTeacherInstanceResource(resource.id, resource.originName)}
                        className="text-teal-600 cursor-pointer"
                      >
                        下载
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
