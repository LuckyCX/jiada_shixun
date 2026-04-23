
import { useState } from 'react';
import { ResearchPlan } from '../types';

interface Props {
  plan: ResearchPlan;
  onChange: (plan: ResearchPlan) => void;
}

const METHODS = ['线上问卷', '用户访谈', '竞品分析', '行业报告', '数据爬取', '实地观察'];
const MEMBERS_OPTIONS = ['李娜', '张明', '王强', '陈雪', '刘洋', '赵磊'];

export default function ResearchPlanTab({ plan, onChange }: Props) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    if (!plan.goal.trim()) {
      alert('请填写调研目标');
      return;
    }
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      onChange({ ...plan, savedAt: new Date().toLocaleString('zh-CN') });
      setTimeout(() => setSaved(false), 3000);
    }, 800);
  };

  const toggleMethod = (method: string) => {
    const methods = plan.methods.includes(method)
      ? plan.methods.filter((m) => m !== method)
      : [...plan.methods, method];
    onChange({ ...plan, methods });
  };

  const updateMember = (index: number, field: 'role' | 'member', value: string) => {
    const members = plan.members.map((m, i) => (i === index ? { ...m, [field]: value } : m));
    onChange({ ...plan, members });
  };

  const addMember = () => {
    onChange({ ...plan, members: [...plan.members, { role: '', member: '' }] });
  };

  const removeMember = (index: number) => {
    onChange({ ...plan, members: plan.members.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-8">
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-6">
        <h3 className="text-base font-bold text-purple-900 mb-3">调研计划制定指南</h3>
        <ul className="text-sm text-purple-700 space-y-2">
          <li>• 明确调研目标：围绕核心创意，了解市场需求、竞争情况</li>
          <li>• 选择调研方法：线上问卷、访谈、行业数据查询等</li>
          <li>• 明确成员分工：问卷设计、数据收集、数据整理、报告撰写</li>
          <li>• 设定时间节点：确保按时完成各阶段任务</li>
        </ul>
      </div>

      {plan.savedAt && (
        <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <i className="ri-checkbox-circle-fill"></i>
          <span>计划已保存于 {plan.savedAt}</span>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-900 mb-3">调研目标 <span className="text-red-500">*</span></label>
        <textarea
          value={plan.goal}
          onChange={(e) => onChange({ ...plan, goal: e.target.value })}
          placeholder="描述本次调研的核心目标和期望获得的信息"
          rows={4}
          className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900 mb-3">调研方法</label>
        <div className="grid md:grid-cols-3 gap-4">
          {METHODS.map((method) => (
            <label
              key={method}
              className={`flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-colors ${
                plan.methods.includes(method)
                  ? 'border-purple-400 bg-purple-50'
                  : 'border-gray-200 hover:border-purple-300'
              }`}
            >
              <input
                type="checkbox"
                checked={plan.methods.includes(method)}
                onChange={() => toggleMethod(method)}
                className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
              />
              <span className="text-sm text-gray-700">{method}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-medium text-gray-900">成员分工</label>
          <button
            onClick={addMember}
            className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1 cursor-pointer"
          >
            <i className="ri-add-line"></i>添加成员
          </button>
        </div>
        <div className="space-y-3">
          {plan.members.map((item, index) => (
            <div key={index} className="flex items-center gap-3">
              <input
                type="text"
                value={item.role}
                onChange={(e) => updateMember(index, 'role', e.target.value)}
                placeholder="分工角色"
                className="flex-1 px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <select
                value={item.member}
                onChange={(e) => updateMember(index, 'member', e.target.value)}
                className="flex-1 px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">选择成员</option>
                {MEMBERS_OPTIONS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <button
                onClick={() => removeMember(index)}
                className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              >
                <i className="ri-delete-bin-line"></i>
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900 mb-3">时间节点</label>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-600 mb-2">开始时间</label>
            <input
              type="date"
              value={plan.startDate}
              onChange={(e) => onChange({ ...plan, startDate: e.target.value })}
              className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-2">结束时间</label>
            <input
              type="date"
              value={plan.endDate}
              onChange={(e) => onChange({ ...plan, endDate: e.target.value })}
              className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className={`w-full px-6 py-3 text-white text-sm font-medium rounded-xl transition-colors whitespace-nowrap cursor-pointer flex items-center justify-center gap-2 ${
          saved ? 'bg-green-500 hover:bg-green-600' : 'bg-purple-500 hover:bg-purple-600'
        } disabled:opacity-60`}
      >
        {saving ? (
          <><i className="ri-loader-4-line animate-spin"></i>保存中...</>
        ) : saved ? (
          <><i className="ri-checkbox-circle-line"></i>保存成功！</>
        ) : (
          <><i className="ri-save-line"></i>保存调研计划</>
        )}
      </button>
    </div>
  );
}
