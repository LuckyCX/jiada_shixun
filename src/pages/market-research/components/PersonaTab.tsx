
import { useState } from 'react';
import { UserPersona } from '../types';

interface Props {
  personas: UserPersona[];
  onPersonasChange: (personas: UserPersona[]) => void;
}

const BORDER_COLORS = ['border-purple-200', 'border-teal-200', 'border-pink-200', 'border-amber-200', 'border-blue-200'];
const ACCENT_COLORS = ['text-purple-500', 'text-teal-500', 'text-pink-500', 'text-amber-500', 'text-blue-500'];

interface EditModalProps {
  persona: UserPersona;
  onSave: (p: UserPersona) => void;
  onClose: () => void;
}

function EditModal({ persona, onSave, onClose }: EditModalProps) {
  const [form, setForm] = useState<UserPersona>({ ...persona });
  const [saving, setSaving] = useState(false);

  const updateList = (field: 'painPoints' | 'needs' | 'habits', idx: number, val: string) => {
    const arr = [...form[field]];
    arr[idx] = val;
    setForm({ ...form, [field]: arr });
  };

  const addItem = (field: 'painPoints' | 'needs' | 'habits') => {
    setForm({ ...form, [field]: [...form[field], ''] });
  };

  const removeItem = (field: 'painPoints' | 'needs' | 'habits', idx: number) => {
    setForm({ ...form, [field]: form[field].filter((_, i) => i !== idx) });
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      onSave(form);
    }, 600);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">编辑用户画像</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer">
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">姓名</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">年龄</label>
              <input
                type="number"
                value={form.age}
                onChange={(e) => setForm({ ...form, age: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">职业</label>
              <input
                type="text"
                value={form.occupation}
                onChange={(e) => setForm({ ...form, occupation: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">专业</label>
              <input
                type="text"
                value={form.major}
                onChange={(e) => setForm({ ...form, major: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Pain Points */}
          {(['painPoints', 'needs', 'habits'] as const).map((field) => {
            const labels: Record<string, string> = { painPoints: '核心痛点', needs: '核心诉求', habits: '消费习惯' };
            return (
              <div key={field}>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-700">{labels[field]}</label>
                  <button
                    onClick={() => addItem(field)}
                    className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1 cursor-pointer"
                  >
                    <i className="ri-add-line"></i>添加
                  </button>
                </div>
                <div className="space-y-2">
                  {form[field].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => updateList(field, idx, e.target.value)}
                        className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <button
                        onClick={() => removeItem(field, idx)}
                        className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-400 rounded cursor-pointer"
                      >
                        <i className="ri-delete-bin-line text-sm"></i>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-6 border-t border-gray-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors cursor-pointer"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 bg-purple-500 text-white text-sm font-medium rounded-xl hover:bg-purple-600 transition-colors cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? <><i className="ri-loader-4-line animate-spin"></i>保存中...</> : <><i className="ri-save-line"></i>保存修改</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateModal({ onSave, onClose }: { onSave: (p: UserPersona) => void; onClose: () => void }) {
  const [form, setForm] = useState<Omit<UserPersona, 'id' | 'borderColor' | 'accentColor' | 'avatar'>>({
    name: '',
    age: 20,
    occupation: '',
    major: '',
    painPoints: [''],
    needs: [''],
    habits: [''],
  });

  const updateList = (field: 'painPoints' | 'needs' | 'habits', idx: number, val: string) => {
    const arr = [...form[field]];
    arr[idx] = val;
    setForm({ ...form, [field]: arr });
  };

  const addItem = (field: 'painPoints' | 'needs' | 'habits') => {
    setForm({ ...form, [field]: [...form[field], ''] });
  };

  const handleSave = () => {
    const colorIdx = Math.floor(Math.random() * BORDER_COLORS.length);
    const newPersona: UserPersona = {
      ...form,
      id: `persona-${Date.now()}`,
      avatar: `https://readdy.ai/api/search-image?query=professional%20portrait%20of%20young%20asian%20university%20student%20with%20friendly%20smile%2C%20modern%20casual%20style%2C%20clean%20bright%20background%20with%20soft%20lighting&width=200&height=200&seq=persona-new-${Date.now()}&orientation=squarish`,
      borderColor: BORDER_COLORS[colorIdx],
      accentColor: ACCENT_COLORS[colorIdx],
      fromSurvey: false,
    };
    onSave(newPersona);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">创建新用户画像</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer">
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: '姓名', field: 'name' as const, type: 'text' },
              { label: '年龄', field: 'age' as const, type: 'number' },
              { label: '职业', field: 'occupation' as const, type: 'text' },
              { label: '专业', field: 'major' as const, type: 'text' },
            ].map(({ label, field, type }) => (
              <div key={field}>
                <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
                <input
                  type={type}
                  value={form[field] as string | number}
                  onChange={(e) => setForm({ ...form, [field]: type === 'number' ? Number(e.target.value) : e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            ))}
          </div>
          {(['painPoints', 'needs', 'habits'] as const).map((field) => {
            const labels: Record<string, string> = { painPoints: '核心痛点', needs: '核心诉求', habits: '消费习惯' };
            return (
              <div key={field}>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-700">{labels[field]}</label>
                  <button onClick={() => addItem(field)} className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1 cursor-pointer">
                    <i className="ri-add-line"></i>添加
                  </button>
                </div>
                <div className="space-y-2">
                  {form[field].map((item, idx) => (
                    <input
                      key={idx}
                      type="text"
                      value={item}
                      onChange={(e) => updateList(field, idx, e.target.value)}
                      placeholder={`输入${labels[field]}...`}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="p-6 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors cursor-pointer">取消</button>
          <button onClick={handleSave} className="flex-1 py-3 bg-purple-500 text-white text-sm font-medium rounded-xl hover:bg-purple-600 transition-colors cursor-pointer">
            <i className="ri-add-line mr-1"></i>创建画像
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PersonaTab({ personas, onPersonasChange }: Props) {
  const [editingPersona, setEditingPersona] = useState<UserPersona | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const handleSaveEdit = (updated: UserPersona) => {
    onPersonasChange(personas.map((p) => (p.id === updated.id ? updated : p)));
    setEditingPersona(null);
    showToast('画像已更新！');
  };

  const handleCreate = (newP: UserPersona) => {
    onPersonasChange([...personas, newP]);
    setShowCreate(false);
    showToast('新画像已创建！');
  };

  const handleDelete = (id: string) => {
    onPersonasChange(personas.filter((p) => p.id !== id));
    showToast('画像已删除');
  };

  const handleExport = () => showToast('画像已导出！');

  return (
    <div className="space-y-8">
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-green-500 text-white px-5 py-3 rounded-xl shadow-lg text-sm flex items-center gap-2">
          <i className="ri-checkbox-circle-fill"></i>{toast}
        </div>
      )}
      {editingPersona && <EditModal persona={editingPersona} onSave={handleSaveEdit} onClose={() => setEditingPersona(null)} />}
      {showCreate && <CreateModal onSave={handleCreate} onClose={() => setShowCreate(false)} />}

      <div className="bg-purple-50 border border-purple-200 rounded-xl p-5">
        <p className="text-sm text-purple-700">
          <i className="ri-information-line mr-2"></i>
          用户画像数据来源于问卷调查和数据分析模块，可直接编辑修改已有画像内容
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {personas.map((persona) => (
          <div key={persona.id} className={`bg-white border-2 ${persona.borderColor} rounded-2xl p-8 relative group`}>
            {/* Action buttons */}
            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => setEditingPersona(persona)}
                className="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 text-gray-500 hover:text-purple-600 hover:border-purple-300 rounded-lg shadow-sm transition-colors cursor-pointer"
                title="编辑画像"
              >
                <i className="ri-edit-line text-sm"></i>
              </button>
              <button
                onClick={() => handleDelete(persona.id)}
                className="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 text-gray-500 hover:text-red-500 hover:border-red-300 rounded-lg shadow-sm transition-colors cursor-pointer"
                title="删除画像"
              >
                <i className="ri-delete-bin-line text-sm"></i>
              </button>
            </div>

            <div className="flex items-start gap-6 mb-6">
              <img
                src={persona.avatar}
                alt={persona.name}
                className="w-24 h-24 rounded-full object-cover border-4 border-gray-100 flex-shrink-0"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-2xl font-bold text-gray-900">{persona.name}</h3>
                  {persona.fromSurvey && (
                    <span className="px-2 py-0.5 bg-purple-50 text-purple-600 text-xs rounded-full whitespace-nowrap">
                      <i className="ri-survey-line mr-1"></i>来自调研
                    </span>
                  )}
                </div>
                <div className="space-y-1 text-sm text-gray-600">
                  <p><strong className="text-gray-900">年龄：</strong>{persona.age}岁</p>
                  <p><strong className="text-gray-900">职业：</strong>{persona.occupation}</p>
                  <p><strong className="text-gray-900">专业：</strong>{persona.major}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {[
                { field: 'painPoints' as const, label: '核心痛点', icon: 'ri-heart-pulse-line' },
                { field: 'needs' as const, label: '核心诉求', icon: 'ri-star-line' },
                { field: 'habits' as const, label: '消费习惯', icon: 'ri-shopping-bag-line' },
              ].map(({ field, label, icon }) => (
                <div key={field}>
                  <h4 className={`text-sm font-bold text-gray-900 mb-2 flex items-center gap-2`}>
                    <i className={`${icon} ${persona.accentColor}`}></i>
                    {label}
                  </h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    {persona[field].filter(Boolean).map((item, i) => (
                      <li key={i}>• {item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <button
              onClick={() => setEditingPersona(persona)}
              className="mt-6 w-full py-2 border border-gray-200 text-gray-600 text-sm rounded-xl hover:border-purple-300 hover:text-purple-600 transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <i className="ri-edit-line"></i>编辑此画像
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-4">
        <button
          onClick={() => setShowCreate(true)}
          className="flex-1 px-6 py-3 bg-purple-500 text-white text-sm font-medium rounded-xl hover:bg-purple-600 transition-colors whitespace-nowrap cursor-pointer flex items-center justify-center gap-2"
        >
          <i className="ri-add-line"></i>创建新画像
        </button>
        <button
          onClick={handleExport}
          className="px-6 py-3 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-2"
        >
          <i className="ri-download-line"></i>导出画像
        </button>
      </div>
    </div>
  );
}
