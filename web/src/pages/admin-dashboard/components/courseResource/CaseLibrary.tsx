
import { useState } from 'react';
import type { CaseItem } from './types';
import { MODULES, INDUSTRIES } from './types';
import { MOCK_CASES } from './mockData';

export default function CaseLibrary() {
  const [cases, setCases] = useState<CaseItem[]>(MOCK_CASES);
  const [filterIndustry, setFilterIndustry] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCase, setEditingCase] = useState<CaseItem | null>(null);
  const [actionSuccess, setActionSuccess] = useState('');
  const [newCase, setNewCase] = useState({
    title: '',
    industry: 'AI+生活服务',
    caseType: 'success' as 'success' | 'failure',
    module: '商业模式设计',
    description: '',
    isRecommended: false,
  });

  /** Show a temporary success message */
  const showSuccess = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(''), 2500);
  };

  /** Filter the case list according to the selected criteria */
  const filtered = cases.filter((c) => {
    const matchIndustry = filterIndustry === 'all' || c.industry === filterIndustry;
    const matchType = filterType === 'all' || c.caseType === filterType;
    const matchStatus = filterStatus === 'all' || c.status === filterStatus;
    const matchSearch = !searchQuery || c.title.includes(searchQuery);
    return matchIndustry && matchType && matchStatus && matchSearch;
  });

  /** Toggle publish / draft status */
  const handleToggleStatus = (id: number) => {
    setCases((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, status: c.status === 'published' ? 'draft' : 'published' } : c,
      ),
    );
  };

  /** Toggle the “recommended” flag */
  const handleToggleRecommend = (id: number) => {
    setCases((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isRecommended: !c.isRecommended } : c)),
    );
    showSuccess('推荐状态已更新！');
  };

  /** Delete a case */
  const handleDelete = (id: number) => {
    setCases((prev) => prev.filter((c) => c.id !== id));
    showSuccess('案例已删除。');
  };

  /** Save new or edited case */
  const handleSave = () => {
    if (!newCase.title.trim()) return;

    if (editingCase) {
      // Update existing case
      setCases((prev) =>
        prev.map((c) => (c.id === editingCase.id ? { ...c, ...newCase } : c)),
      );
      showSuccess('案例已更新！');
    } else {
      // Add a brand‑new case
      setCases((prev) => [
        ...prev,
        {
          id: Date.now(),
          ...newCase,
          knowledgePoints: [],
          abilityPoints: [],
          views: 0,
          status: 'draft' as const,
          uploader: '管理员',
          uploadTime: new Date().toISOString().slice(0, 10),
        },
      ]);
      showSuccess('案例已新增！');
    }

    // Reset modal state
    setShowAddModal(false);
    setEditingCase(null);
    setNewCase({
      title: '',
      industry: 'AI+生活服务',
      caseType: 'success',
      module: '商业模式设计',
      description: '',
      isRecommended: false,
    });
  };

  /** Open edit modal and preload data */
  const openEdit = (item: CaseItem) => {
    setEditingCase(item);
    setNewCase({
      title: item.title,
      industry: item.industry,
      caseType: item.caseType,
      module: item.module,
      description: item.description,
      isRecommended: item.isRecommended,
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
            label: '成功案例',
            count: cases.filter((c) => c.caseType === 'success').length,
            color: 'from-green-500 to-emerald-500',
            icon: 'ri-trophy-line',
          },
          {
            label: '失败复盘',
            count: cases.filter((c) => c.caseType === 'failure').length,
            color: 'from-orange-500 to-amber-500',
            icon: 'ri-restart-line',
          },
          {
            label: '推荐案例',
            count: cases.filter((c) => c.isRecommended).length,
            color: 'from-purple-500 to-pink-500',
            icon: 'ri-star-line',
          },
          {
            label: '案例总数',
            count: cases.length,
            color: 'from-teal-500 to-cyan-500',
            icon: 'ri-folder-line',
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
              placeholder="搜索案例..."
              className="bg-transparent text-sm outline-none flex-1"
            />
          </div>

          <select
            value={filterIndustry}
            onChange={(e) => setFilterIndustry(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
          >
            <option value="all">全部行业</option>
            {INDUSTRIES.map((ind) => (
              <option key={ind}>{ind}</option>
            ))}
          </select>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
          >
            <option value="all">全部类型</option>
            <option value="success">成功案例</option>
            <option value="failure">失败复盘</option>
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
            setEditingCase(null);
            setNewCase({
              title: '',
              industry: 'AI+生活服务',
              caseType: 'success',
              module: '商业模式设计',
              description: '',
              isRecommended: false,
            });
            setShowAddModal(true);
          }}
          className="px-5 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 text-white font-medium rounded-xl hover:shadow-lg transition-all cursor-pointer whitespace-nowrap"
        >
          <i className="ri-add-line mr-2"></i>新增案例
        </button>
      </div>

      {/* 案例列表 */}
      <div className="space-y-3">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all"
          >
            <div className="flex items-start gap-4">
              <div
                className={`w-12 h-12 flex items-center justify-center rounded-xl flex-shrink-0 ${
                  item.caseType === 'success' ? 'bg-green-100' : 'bg-orange-100'
                }`}
              >
                <i
                  className={`${
                    item.caseType === 'success'
                      ? 'ri-trophy-line text-green-600'
                      : 'ri-restart-line text-orange-600'
                  } text-2xl`}
                ></i>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h4 className="font-bold text-gray-900">{item.title}</h4>
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      item.caseType === 'success'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-orange-100 text-orange-700'
                    }`}
                  >
                    {item.caseType === 'success' ? '成功案例' : '失败复盘'}
                  </span>
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      item.status === 'published'
                        ? 'bg-teal-100 text-teal-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {item.status === 'published' ? '已发布' : '草稿'}
                  </span>
                  {item.isRecommended && (
                    <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full">
                      <i className="ri-star-fill mr-1"></i>推荐
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-500 mb-2 flex-wrap">
                  <span>
                    <i className="ri-building-line mr-1"></i>
                    {item.industry}
                  </span>
                  <span>
                    <i className="ri-layout-grid-line mr-1"></i>
                    {item.module}
                  </span>
                  <span>
                    <i className="ri-eye-line mr-1"></i>
                    {item.views.toLocaleString()} 次浏览
                  </span>
                  <span>
                    <i className="ri-user-line mr-1"></i>
                    {item.uploader}
                  </span>
                </div>

                <p className="text-sm text-gray-600 line-clamp-2 mb-2">{item.description}</p>

                <div className="flex flex-wrap gap-1.5">
                  {item.knowledgePoints.map((kp) => (
                    <span key={kp} className="px-2 py-0.5 bg-teal-50 text-teal-600 text-xs rounded-full">
                      {kp}
                    </span>
                  ))}
                  {item.abilityPoints.map((ap) => (
                    <span key={ap} className="px-2 py-0.5 bg-purple-50 text-purple-600 text-xs rounded-full">
                      {ap}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2 flex-shrink-0">
                <button
                  onClick={() => openEdit(item)}
                  className="px-3 py-1.5 text-xs text-teal-600 hover:bg-teal-50 border border-teal-200 rounded-lg transition-all cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-edit-line mr-1"></i>编辑
                </button>

                <button
                  onClick={() => handleToggleRecommend(item.id)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                    item.isRecommended
                      ? 'text-yellow-600 hover:bg-yellow-50 border-yellow-200'
                      : 'text-gray-500 hover:bg-gray-100 border-gray-200'
                  }`}
                >
                  {item.isRecommended ? (
                    <>
                      <i className="ri-star-fill mr-1"></i>取消推荐
                    </>
                  ) : (
                    <>
                      <i className="ri-star-line mr-1"></i>推荐
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleToggleStatus(item.id)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                    item.status === 'published'
                      ? 'text-gray-600 hover:bg-gray-100 border-gray-200'
                      : 'text-green-600 hover:bg-green-50 border-green-200'
                  }`}
                >
                  {item.status === 'published' ? (
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
                  onClick={() => handleDelete(item.id)}
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
            <i className="ri-folder-line text-5xl mb-3 block"></i>
            暂无符合条件的案例
          </div>
        )}
      </div>

      {/* 新增/编辑弹窗 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">
                {editingCase ? '编辑案例' : '新增案例'}
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
                  案例标题 <span className="text-red-500">*</span>
                </label>
                <input
                  value={newCase.title}
                  onChange={(e) =>
                    setNewCase((p) => ({ ...p, title: e.target.value }))
                  }
                  placeholder="请输入案例标题..."
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    行业分类
                  </label>
                  <select
                    value={newCase.industry}
                    onChange={(e) =>
                      setNewCase((p) => ({ ...p, industry: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {INDUSTRIES.map((ind) => (
                      <option key={ind}>{ind}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    案例类型
                  </label>
                  <select
                    value={newCase.caseType}
                    onChange={(e) =>
                      setNewCase((p) => ({
                        ...p,
                        caseType: e.target.value as 'success' | 'failure',
                      }))
                    }
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="success">成功案例</option>
                    <option value="failure">失败复盘</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  关联模块
                </label>
                <select
                  value={newCase.module}
                  onChange={(e) =>
                    setNewCase((p) => ({ ...p, module: e.target.value }))
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
                  案例简介
                </label>
                <textarea
                  value={newCase.description}
                  onChange={(e) =>
                    setNewCase((p) => ({ ...p, description: e.target.value }))
                  }
                  placeholder="请描述案例的主要内容和价值..."
                  rows={3}
                  maxLength={500}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                />
                <p className="text-xs text-gray-400 text-right">
                  {newCase.description.length}/500
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() =>
                    setNewCase((p) => ({
                      ...p,
                      isRecommended: !p.isRecommended,
                    }))
                  }
                  className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors cursor-pointer ${
                    newCase.isRecommended ? 'bg-yellow-400' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      newCase.isRecommended ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  ></span>
                </button>
                <span className="text-sm text-gray-700">
                  设为推荐案例（优先展示给学生）
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
                disabled={!newCase.title.trim()}
                className="flex-1 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 text-white font-medium rounded-xl hover:shadow-lg transition-all cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className="ri-save-line mr-2"></i>
                {editingCase ? '保存修改' : '新增案例'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
