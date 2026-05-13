
import { useState } from 'react';
import type { KnowledgePoint, ResourceType } from './types';
import { TYPE_MAP, MODULES } from './types';
import { MOCK_KNOWLEDGE_POINTS } from './mockData';

export default function KnowledgePointLibrary() {
  const [points, setPoints] = useState<KnowledgePoint[]>(MOCK_KNOWLEDGE_POINTS);
  const [filterModule, setFilterModule] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPoint, setEditingPoint] = useState<KnowledgePoint | null>(null);
  const [actionSuccess, setActionSuccess] = useState('');
  const [newPoint, setNewPoint] = useState({
    title: '',
    module: '创新思维与创意生成',
    type: 'video' as ResourceType,
    abilityPoint: '',
    duration: '',
    description: '',
    isPublic: true,
  });

  const showSuccess = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(''), 2500);
  };

  const filtered = points.filter((p) => {
    const matchModule = filterModule === 'all' || p.module === filterModule;
    const matchType = filterType === 'all' || p.type === filterType;
    const matchStatus = filterStatus === 'all' || p.status === filterStatus;
    const matchSearch =
      !searchQuery ||
      p.title.includes(searchQuery) ||
      p.abilityPoint.includes(searchQuery);
    return matchModule && matchType && matchStatus && matchSearch;
  });

  const handleToggleStatus = (id: number) => {
    setPoints((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, status: p.status === 'published' ? 'draft' : 'published' }
          : p,
      ),
    );
  };

  const handleTogglePublic = (id: number) => {
    setPoints((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isPublic: !p.isPublic } : p)),
    );
  };

  const handleDelete = (id: number) => {
    setPoints((prev) => prev.filter((p) => p.id !== id));
    showSuccess('知识点已删除。');
  };

  const handleSave = () => {
    if (!newPoint.title.trim() || !newPoint.abilityPoint.trim()) return;
    if (editingPoint) {
      setPoints((prev) =>
        prev.map((p) =>
          p.id === editingPoint.id ? { ...p, ...newPoint } : p,
        ),
      );
      showSuccess('知识点已更新！');
    } else {
      setPoints((prev) => [
        ...prev,
        {
          id: Date.now(),
          ...newPoint,
          views: 0,
          status: 'draft' as const,
          uploader: '管理员',
          uploadTime: new Date().toISOString().slice(0, 10),
        },
      ]);
      showSuccess('知识点已新增！');
    }
    setShowAddModal(false);
    setEditingPoint(null);
    setNewPoint({
      title: '',
      module: '创新思维与创意生成',
      type: 'video',
      abilityPoint: '',
      duration: '',
      description: '',
      isPublic: true,
    });
  };

  const openEdit = (point: KnowledgePoint) => {
    setEditingPoint(point);
    setNewPoint({
      title: point.title,
      module: point.module,
      type: point.type,
      abilityPoint: point.abilityPoint,
      duration: point.duration,
      description: point.description,
      isPublic: point.isPublic,
    });
    setShowAddModal(true);
  };

  return (
    <div className="space-y-5">
      {actionSuccess && (
        <div className="flex items-center gap-3 px-5 py-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm font-medium">
          <i className="ri-checkbox-circle-line text-lg"></i>
          {actionSuccess}
        </div>
      )}

      {/* 统计 */}
      <div className="grid grid-cols-4 gap-4">
        {[
          {
            label: '已发布',
            count: points.filter((p) => p.status === 'published').length,
            color: 'from-teal-500 to-emerald-500',
            icon: 'ri-global-line',
          },
          {
            label: '草稿',
            count: points.filter((p) => p.status === 'draft').length,
            color: 'from-gray-400 to-gray-500',
            icon: 'ri-draft-line',
          },
          {
            label: '公共资源',
            count: points.filter((p) => p.isPublic).length,
            color: 'from-purple-500 to-pink-500',
            icon: 'ri-share-line',
          },
          {
            label: '总浏览量',
            count: points.reduce((a, p) => a + p.views, 0).toLocaleString(),
            color: 'from-orange-500 to-amber-500',
            icon: 'ri-eye-line',
          },
        ].map((s, i) => (
          <div
            key={i}
            className={`bg-gradient-to-br ${s.color} rounded-2xl p-5 text-white shadow-sm`}
          >
            <div className="w-10 h-10 flex items-center justify-center bg-white/20 rounded-xl mb-3">
              <i className={`${s.icon} text-xl`}></i>
            </div>
            <div className="text-3xl font-bold mb-1">{s.count}</div>
            <div className="text-sm opacity-90">{s.label}</div>
          </div>
        ))}
      </div>

      {/* 操作栏 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 min-w-40">
            <i className="ri-search-line text-gray-400 text-sm"></i>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索知识点..."
              className="bg-transparent text-sm outline-none flex-1"
            />
          </div>
          <select
            value={filterModule}
            onChange={(e) => setFilterModule(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
          >
            <option value="all">全部模块</option>
            {MODULES.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
          >
            <option value="all">全部类型</option>
            <option value="video">视频</option>
            <option value="document">文档</option>
            <option value="graphic">图文</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
          >
            <option value="all">全部状态</option>
            <option value="published">已发布</option>
            <option value="draft">草稿</option>
          </select>
        </div>
        <button
          onClick={() => {
            setEditingPoint(null);
            setNewPoint({
              title: '',
              module: '创新思维与创意生成',
              type: 'video',
              abilityPoint: '',
              duration: '',
              description: '',
              isPublic: true,
            });
            setShowAddModal(true);
          }}
          className="px-5 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 text-white font-medium rounded-xl hover:shadow-lg transition-all cursor-pointer whitespace-nowrap"
        >
          <i className="ri-add-line mr-2"></i>新增知识点
        </button>
      </div>

      {/* 知识点列表 */}
      <div className="space-y-3">
        {filtered.map((point) => (
          <div
            key={point.id}
            className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all"
          >
            <div className="flex items-start gap-4">
              <div
                className={`w-12 h-12 flex items-center justify-center rounded-xl flex-shrink-0 ${TYPE_MAP[point.type].color}`}
              >
                <i className={`${TYPE_MAP[point.type].icon} text-2xl`}></i>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h4 className="font-bold text-gray-900">{point.title}</h4>
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded-full ${TYPE_MAP[point.type].color}`}
                  >
                    {TYPE_MAP[point.type].label}
                  </span>
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      point.status === 'published'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {point.status === 'published' ? '已发布' : '草稿'}
                  </span>
                  {point.isPublic && (
                    <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-600 rounded-full">
                      公共资源
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500 mb-2 flex-wrap">
                  <span>
                    <i className="ri-layout-grid-line mr-1"></i>
                    {point.module}
                  </span>
                  <span>
                    <i className="ri-trophy-line mr-1"></i>关联能力点：
                    {point.abilityPoint}
                  </span>
                  <span>
                    <i className="ri-time-line mr-1"></i>
                    {point.duration}
                  </span>
                  <span>
                    <i className="ri-eye-line mr-1"></i>
                    {point.views.toLocaleString()} 次浏览
                  </span>
                  <span>
                    <i className="ri-user-line mr-1"></i>
                    {point.uploader}
                  </span>
                </div>
                <p className="text-sm text-gray-600 line-clamp-2">
                  {point.description}
                </p>
              </div>
              <div className="flex flex-col gap-2 flex-shrink-0">
                <button
                  onClick={() => openEdit(point)}
                  className="px-3 py-1.5 text-xs text-teal-600 hover:bg-teal-50 border border-teal-200 rounded-lg transition-all cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-edit-line mr-1"></i>编辑
                </button>
                <button
                  onClick={() => handleToggleStatus(point.id)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                    point.status === 'published'
                      ? 'text-gray-600 hover:bg-gray-100 border-gray-200'
                      : 'text-green-600 hover:bg-green-50 border-green-200'
                  }`}
                >
                  {point.status === 'published' ? (
                    <>
                      <i className="ri-eye-off-line mr-1"></i>下架
                    </>
                  ) : (
                    <>
                      <i className="ri-global-line mr-1"></i>发布
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleTogglePublic(point.id)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                    point.isPublic
                      ? 'text-purple-600 hover:bg-purple-50 border-purple-200'
                      : 'text-gray-500 hover:bg-gray-100 border-gray-200'
                  }`}
                >
                  {point.isPublic ? (
                    <>
                      <i className="ri-lock-line mr-1"></i>设为私有
                    </>
                  ) : (
                    <>
                      <i className="ri-share-line mr-1"></i>设为公共
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleDelete(point.id)}
                  className="px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 border border-red-200 rounded-lg transition-all cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-delete-bin-line mr-1"></i>删除
                </button>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-100">
            <i className="ri-book-2-line text-5xl mb-3 block"></i>
            暂无符合条件的知识点
          </div>
        )}
      </div>

      {/* 新增/编辑弹窗 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">
                {editingPoint ? '编辑知识点' : '新增知识点'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-lg cursor-pointer"
              >
                <i className="ri-close-line text-gray-500"></i>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  知识点标题 <span className="text-red-500">*</span>
                </label>
                <input
                  value={newPoint.title}
                  onChange={(e) =>
                    setNewPoint((p) => ({ ...p, title: e.target.value }))
                  }
                  placeholder="请输入知识点标题..."
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    所属模块
                  </label>
                  <select
                    value={newPoint.module}
                    onChange={(e) =>
                      setNewPoint((p) => ({ ...p, module: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {MODULES.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    资源类型
                  </label>
                  <select
                    value={newPoint.type}
                    onChange={(e) =>
                      setNewPoint((p) => ({
                        ...p,
                        type: e.target.value as ResourceType,
                      }))
                    }
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="video">视频</option>
                    <option value="document">文档</option>
                    <option value="graphic">图文</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    关联能力点{' '}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={newPoint.abilityPoint}
                    onChange={(e) =>
                      setNewPoint((p) => ({
                        ...p,
                        abilityPoint: e.target.value,
                      }))
                    }
                    placeholder="如：创新思维能力"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    学习时长
                  </label>
                  <input
                    value={newPoint.duration}
                    onChange={(e) =>
                      setNewPoint((p) => ({
                        ...p,
                        duration: e.target.value,
                      }))
                    }
                    placeholder="如：18分钟"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  知识点描述
                </label>
                <textarea
                  value={newPoint.description}
                  onChange={(e) =>
                    setNewPoint((p) => ({
                      ...p,
                      description: e.target.value,
                    }))
                  }
                  placeholder="请描述知识点的主要内容..."
                  rows={3}
                  maxLength={500}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                />
                <p className="text-xs text-gray-400 text-right">
                  {newPoint.description.length}/500
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() =>
                    setNewPoint((p) => ({ ...p, isPublic: !p.isPublic }))
                  }
                  className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors cursor-pointer ${
                    newPoint.isPublic ? 'bg-teal-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      newPoint.isPublic ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  ></span>
                </button>
                <span className="text-sm text-gray-700">
                  设为公共资源（所有教师和学生可见）
                </span>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-all cursor-pointer whitespace-nowrap"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={!newPoint.title.trim() || !newPoint.abilityPoint.trim()}
                className="flex-1 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 text-white font-medium rounded-xl hover:shadow-lg transition-all cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className="ri-save-line mr-2"></i>
                {editingPoint ? '保存修改' : '新增知识点'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
