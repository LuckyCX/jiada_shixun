import { useState } from 'react';

interface GuidanceToolPanelProps {
  teams: { id: number; teamName: string; members: { name: string }[] }[];
}

type GuidanceType = 'broadcast' | 'oneOnOne' | 'resource' | 'urge';
type UrgencyLevel = 'normal' | 'important' | 'urgent';

interface GuidanceRecord {
  id: number;
  type: GuidanceType;
  target: string;
  content: string;
  time: string;
  status: 'sent' | 'read' | 'replied';
  urgency?: UrgencyLevel;
}

const mockRecords: GuidanceRecord[] = [
  {
    id: 1,
    type: 'broadcast',
    target: '全体学生',
    content: '请各小组注意：SCAMPER奔驰法知识点检测将于本周五截止，请尽快完成学习并参加检测。',
    time: '今天 09:30',
    status: 'read',
    urgency: 'important',
  },
  {
    id: 2,
    type: 'oneOnOne',
    target: '刘洋（智慧农业小组）',
    content:
      '你好，注意到你在创新思维知识点检测中遇到了困难，建议重点复习SCAMPER法的S（替代）和C（组合）两个维度，可参考案例库中的"共享单车创新案例"。',
    time: '今天 10:15',
    status: 'replied',
  },
  {
    id: 3,
    type: 'resource',
    target: '绿色出行团队',
    content:
      '推送资源：《市场调研方法实操指南》+《用户画像绘制模板》，请结合案例库中的"智慧出行调研案例"参考学习。',
    time: '昨天 16:00',
    status: 'sent',
  },
  {
    id: 4,
    type: 'urge',
    target: '周芳（绿色出行团队）',
    content:
      '你好，你已连续3天未登录平台，市场调研环节进度严重滞后。请于明天18:00前完成调研计划提交，否则将影响本环节评价。',
    time: '昨天 14:30',
    status: 'read',
  },
  {
    id: 5,
    type: 'broadcast',
    target: '全体学生',
    content: '紧急通知：因系统维护，今晚22:00-23:00平台将暂停服务，请提前保存学习进度。',
    time: '2天前',
    status: 'read',
    urgency: 'urgent',
  },
];

// 模拟本月统计数据
const mockStats = {
  broadcast: { sent: 28, readRate: 92, replyRate: 15 },
  oneOnOne: { sent: 45, readRate: 88, replyRate: 67 },
  resource: { sent: 32, readRate: 85, replyRate: 23 },
  urge: { sent: 19, readRate: 95, replyRate: 58 },
};

const typeConfig: Record<
  GuidanceType,
  {
    label: string;
    icon: string;
    color: string;
    bg: string;
    gradFrom: string;
    gradTo: string;
  }
> = {
  broadcast: {
    label: '全员通知',
    icon: 'ri-megaphone-line',
    color: 'text-teal-600',
    bg: 'bg-teal-50',
    gradFrom: 'from-teal-500',
    gradTo: 'to-cyan-500',
  },
  oneOnOne: {
    label: '一对一引导',
    icon: 'ri-chat-private-line',
    color: 'text-indigo-600',
    bg: 'bg-indigo-50',
    gradFrom: 'from-indigo-500',
    gradTo: 'to-purple-500',
  },
  resource: {
    label: '推送资源',
    icon: 'ri-send-plane-line',
    color: 'text-green-600',
    bg: 'bg-green-50',
    gradFrom: 'from-green-500',
    gradTo: 'to-emerald-500',
  },
  urge: {
    label: '学习督促',
    icon: 'ri-alarm-line',
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    gradFrom: 'from-orange-500',
    gradTo: 'to-amber-500',
  },
};

const statusConfig = {
  sent: { label: '已发送', color: 'bg-gray-100 text-gray-500' },
  read: { label: '已读', color: 'bg-teal-100 text-teal-600' },
  replied: { label: '已回复', color: 'bg-green-100 text-green-600' },
};

const urgencyConfig: Record<UrgencyLevel, { label: string; color: string; icon: string }> = {
  normal: { label: '普通', color: 'text-gray-500', icon: 'ri-information-line' },
  important: { label: '重要', color: 'text-amber-600', icon: 'ri-error-warning-line' },
  urgent: { label: '紧急', color: 'text-red-600', icon: 'ri-alarm-warning-line' },
};

const quickTemplates: Record<GuidanceType, string[]> = {
  broadcast: [
    '请各小组注意本阶段知识点检测截止时间，请尽快完成学习。',
    '本周将开展线上答疑，欢迎同学们积极提问，共同解决学习难点。',
    '请各小组按时提交本阶段实践成果，逾期将影响评价。',
  ],
  oneOnOne: [
    '注意到你在本阶段遇到了困难，建议参考案例库中的相关案例，有问题随时提问。',
    '你的实践成果已退回，请根据反馈意见修改后重新提交。',
    '你的学习进度有所滞后，建议合理安排时间，优先完成知识点学习与检测。',
  ],
  resource: [
    '推送相关学习资源，请结合案例库参考学习，有助于本阶段实践操作。',
    '推送优秀案例供参考，建议团队讨论后借鉴经验用于自身实践。',
    '推送知识点补充材料，帮助你更好地理解本阶段核心概念。',
  ],
  urge: [
    '你已多天未登录平台，请尽快完成本阶段学习任务，避免影响整体进度。',
    '本阶段知识点检测未达标，请重新学习后再次参加检测，截止时间为本周五。',
    '实践成果提交已超时，请于明天18:00前完成提交，否则将影响本环节评价。',
  ],
};

export default function GuidanceToolPanel({ teams = [] }: GuidanceToolPanelProps) {
  const [activeType, setActiveType] = useState<GuidanceType>('broadcast');
  const [targetType, setTargetType] = useState<'all' | 'team' | 'student'>('all');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [content, setContent] = useState('');
  const [deadline, setDeadline] = useState('');
  const [urgency, setUrgency] = useState<UrgencyLevel>('normal');
  const [records, setRecords] = useState<GuidanceRecord[]>(mockRecords);
  const [showSuccess, setShowSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'compose' | 'history' | 'stats'>('compose');

  const allStudents = teams.flatMap((t) =>
    t.members.map((m) => ({ name: m.name, team: t.teamName }))
  );

  const handleQuickTemplate = (tpl: string) => setContent(tpl);

  const handleSend = () => {
    if (!content.trim()) return;

    let target = '全体学生';
    if (targetType === 'team' && selectedTeam) target = selectedTeam;
    if (targetType === 'student' && selectedStudent) target = selectedStudent;

    const newRecord: GuidanceRecord = {
      id: Date.now(),
      type: activeType,
      target,
      content,
      time: '刚刚',
      status: 'sent',
      urgency: activeType === 'broadcast' ? urgency : undefined,
    };

    setRecords((prev) => [newRecord, ...prev]);
    setContent('');
    setDeadline('');
    setUrgency('normal');
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2500);
  };

  const handleRecall = (id: number) => {
    setRecords((prev) => prev.filter((r) => r.id !== id));
  };

  const conf = typeConfig[activeType];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* 标题栏 */}
      <div className={`px-5 py-4 bg-gradient-to-r ${conf.gradFrom} ${conf.gradTo}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 flex items-center justify-center bg-white/20 rounded-lg">
              <i className={`${conf.icon} text-white text-sm`}></i>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">精准引导工具</h3>
              <p className="text-xs text-white/70">动态干预 · 过程引导</p>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-white/20 rounded-lg p-0.5">
            <button
              onClick={() => setActiveTab('compose')}
              className={`px-3 py-1 text-xs rounded-md transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'compose'
                  ? 'bg-white text-gray-800 font-medium shadow-sm'
                  : 'text-white/80'
              }`}
            >
              发送引导
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`px-3 py-1 text-xs rounded-md transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'stats'
                  ? 'bg-white text-gray-800 font-medium shadow-sm'
                  : 'text-white/80'
              }`}
            >
              效果统计
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1 text-xs rounded-md transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'history'
                  ? 'bg-white text-gray-800 font-medium shadow-sm'
                  : 'text-white/80'
              }`}
            >
              历史记录
            </button>
          </div>
        </div>
      </div>

      <div className="p-5">
        {activeTab === 'compose' ? (
          <div className="space-y-4">
            {/* 引导类型选择 */}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">引导方式</p>
              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(typeConfig) as GuidanceType[]).map((type) => {
                  const c = typeConfig[type];
                  return (
                    <button
                      key={type}
                      onClick={() => setActiveType(type)}
                      className={`flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl border-2 transition-all cursor-pointer ${
                        activeType === type
                          ? `border-current ${c.color} ${c.bg}`
                          : 'border-gray-100 text-gray-500 hover:border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <i className={`${c.icon} text-base`}></i>
                      <span className="text-xs font-medium leading-tight text-center">
                        {c.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 发送对象 */}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">发送对象</p>
              <div className="flex items-center gap-2 mb-2">
                {[
                  { value: 'all', label: '全体学生' },
                  { value: 'team', label: '指定小组' },
                  { value: 'student', label: '指定学生' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setTargetType(opt.value as typeof targetType)}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                      targetType === opt.value
                        ? 'border-teal-400 bg-teal-50 text-teal-700 font-medium'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {targetType === 'team' && (
                <select
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 bg-gray-50 cursor-pointer"
                >
                  <option value="">请选择小组</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.teamName}>
                      {t.teamName}
                    </option>
                  ))}
                </select>
              )}
              {targetType === 'student' && (
                <select
                  value={selectedStudent}
                  onChange={(e) => setSelectedStudent(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 bg-gray-50 cursor-pointer"
                >
                  <option value="">请选择学生</option>
                  {allStudents.map((s, i) => (
                    <option key={i} value={`${s.name}（${s.team}）`}>
                      {s.name}（{s.team}）
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* 紧急程度（仅全员通知显示） */}
            {activeType === 'broadcast' && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">紧急程度</p>
                <div className="flex items-center gap-2">
                  {(Object.keys(urgencyConfig) as UrgencyLevel[]).map((level) => {
                    const u = urgencyConfig[level];
                    return (
                      <button
                        key={level}
                        onClick={() => setUrgency(level)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                          urgency === level
                            ? `border-current ${u.color} ${
                                level === 'urgent'
                                  ? 'bg-red-50'
                                  : level === 'important'
                                  ? 'bg-amber-50'
                                  : 'bg-gray-50'
                              } font-medium`
                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                      >
                        <i className={u.icon}></i>
                        {u.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 快捷模板 */}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">快捷模板</p>
              <div className="space-y-1.5">
                {quickTemplates[activeType].map((tpl, i) => (
                  <button
                    key={i}
                    onClick={() => handleQuickTemplate(tpl)}
                    className="w-full text-left px-3 py-2 text-xs text-gray-600 bg-gray-50 hover:bg-teal-50 hover:text-teal-700 rounded-lg border border-gray-100 hover:border-teal-200 transition-all cursor-pointer leading-relaxed"
                  >
                    <i className="ri-file-copy-line mr-1.5 text-gray-400"></i>
                    {tpl.length > 40 ? tpl.slice(0, 40) + '...' : tpl}
                  </button>
                ))}
              </div>
            </div>

            {/* 内容输入 */}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">引导内容</p>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value.slice(0, 500))}
                placeholder="输入引导内容，或点击上方模板快速填充..."
                rows={4}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none bg-gray-50 leading-relaxed"
              />
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-gray-400">{content.length}/500</span>
              </div>
            </div>

            {/* 督促截止时间（仅督促类型显示） */}
            {activeType === 'urge' && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">补学截止时间</p>
                <input
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 bg-gray-50 cursor-pointer"
                />
              </div>
            )}

            {/* 发送按钮 */}
            <button
              onClick={handleSend}
              disabled={!content.trim()}
              className={`w-full py-3 text-sm font-semibold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                content.trim()
                  ? `bg-gradient-to-r ${conf.gradFrom} ${conf.gradTo} text-white hover:opacity-90 shadow-sm`
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              <i className={`${conf.icon} mr-2`}></i>
              发送{conf.label}
            </button>

            {/* 成功提示 */}
            {showSuccess && (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <i className="ri-check-circle-fill text-green-500"></i>
                <span className="text-sm text-green-700 font-medium">
                  引导消息已成功发送！
                </span>
              </div>
            )}
          </div>
        ) : activeTab === 'stats' ? (
          /* 引导效果统计 */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500">本月引导效果统计</p>
              <span className="text-xs text-gray-400">数据更新于今天 14:30</span>
            </div>

            {/* 统计卡片 */}
            <div className="grid grid-cols-4 gap-3">
              {(Object.keys(typeConfig) as GuidanceType[]).map((type) => {
                const c = typeConfig[type];
                const stat = mockStats[type];
                return (
                  <div
                    key={type}
                    className={`rounded-xl p-4 border ${c.bg} border-gray-100 hover:shadow-md transition-all`}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div
                        className={`w-8 h-8 flex items-center justify-center rounded-lg ${c.bg} border border-current`}
                      >
                        <i className={`${c.icon} ${c.color} text-sm`}></i>
                      </div>
                      <span className={`text-xs font-semibold ${c.color}`}>{c.label}</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-gray-500">发送量</span>
                        <span className={`text-lg font-bold ${c.color}`}>{stat.sent}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">已读率</span>
                        <div className="flex items-center gap-1">
                          <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full bg-gradient-to-r ${c.gradFrom} ${c.gradTo}`}
                              style={{ width: `${stat.readRate}%` }}
                            ></div>
                          </div>
                          <span className="text-xs font-semibold text-gray-700">
                            {stat.readRate}%
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">回复率</span>
                        <div className="flex items-center gap-1">
                          <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full bg-gradient-to-r ${c.gradFrom} ${c.gradTo}`}
                              style={{ width: `${stat.replyRate}%` }}
                            ></div>
                          </div>
                          <span className="text-xs font-semibold text-gray-700">
                            {stat.replyRate}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 总体数据 */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl p-4 bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-100">
                <div className="flex items-center gap-2 mb-2">
                  <i className="ri-send-plane-2-fill text-teal-600"></i>
                  <span className="text-xs font-semibold text-gray-600">总发送量</span>
                </div>
                <p className="text-2xl font-bold text-teal-600">
                  {Object.values(mockStats).reduce((sum, s) => sum + s.sent, 0)}
                </p>
              </div>
              <div className="rounded-xl p-4 bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100">
                <div className="flex items-center gap-2 mb-2">
                  <i className="ri-eye-fill text-indigo-600"></i>
                  <span className="text-xs font-semibold text-gray-600">平均已读率</span>
                </div>
                <p className="text-2xl font-bold text-indigo-600">
                  {Math.round(
                    Object.values(mockStats).reduce((sum, s) => sum + s.readRate, 0) / 4
                  )}
                  %
                </p>
              </div>
              <div className="rounded-xl p-4 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100">
                <div className="flex items-center gap-2 mb-2">
                  <i className="ri-chat-smile-3-fill text-green-600"></i>
                  <span className="text-xs font-semibold text-gray-600">平均回复率</span>
                </div>
                <p className="text-2xl font-bold text-green-600">
                  {Math.round(
                    Object.values(mockStats).reduce((sum, s) => sum + s.replyRate, 0) / 4
                  )}
                  %
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* 历史记录 */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500">最近引导记录</p>
              <span className="text-xs text-gray-400">{records.length} 条</span>
            </div>
            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
              {records.map((rec) => {
                const c = typeConfig[rec.type];
                const s = statusConfig[rec.status];
                return (
                  <div
                    key={rec.id}
                    className={`rounded-xl p-3 border ${c.bg} border-gray-100`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <i className={`${c.icon} ${c.color} text-xs`}></i>
                        <span
                          className={`px-1.5 py-0.5 text-xs font-medium rounded-full ${c.bg} ${c.color}`}
                        >
                          {c.label}
                        </span>
                        {rec.urgency && (
                          <span
                            className={`px-1.5 py-0.5 text-xs font-medium rounded-full flex items-center gap-0.5 ${
                              rec.urgency === 'urgent'
                                ? 'bg-red-100 text-red-600'
                                : rec.urgency === 'important'
                                ? 'bg-amber-100 text-amber-600'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            <i className={urgencyConfig[rec.urgency].icon}></i>
                            {urgencyConfig[rec.urgency].label}
                          </span>
                        )}
                        <span className="text-xs text-gray-500">→ {rec.target}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`px-1.5 py-0.5 text-xs rounded-full ${s.color}`}>
                          {s.label}
                        </span>
                        <span className="text-xs text-gray-400">{rec.time}</span>
                        {rec.status === 'sent' && (
                          <button
                            onClick={() => handleRecall(rec.id)}
                            className="ml-1 px-2 py-0.5 text-xs text-red-600 bg-red-50 hover:bg-red-100 rounded-full transition-all cursor-pointer whitespace-nowrap"
                          >
                            <i className="ri-close-circle-line mr-0.5"></i>
                            撤回
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed line-clamp-2">
                      {rec.content}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}