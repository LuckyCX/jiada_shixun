
import { useState } from 'react';
import { TeamProject } from './TeamCard';

interface InterveneModalProps {
  team: TeamProject | null;
  teams: TeamProject[];
  onClose: () => void;
  onSubmit: (data: {
    teamId: number;
    type: string;
    message: string;
    deadline: string;
  }) => void;
}

const interveneTypes = [
  {
    id: 'notify',
    label: '发送督促通知',
    icon: 'ri-notification-line',
    color: 'bg-amber-100 text-amber-700',
  },
  { id: 'guide', label: '一对一指导意见', icon: 'ri-chat-1-line', color: 'bg-teal-100 text-teal-700' },
  { id: 'resource', label: '推送补充资源', icon: 'ri-book-2-line', color: 'bg-indigo-100 text-indigo-700' },
  { id: 'deadline', label: '设置补做截止时间', icon: 'ri-time-line', color: 'bg-red-100 text-red-700' },
];

const quickMessages = [
  '请尽快完成当前阶段的学习检测，否则将影响后续实训进度。',
  '建议参考案例库中的相关案例，优化你们的方案逻辑。',
  '团队协作活跃度偏低，请加强内部沟通与分工协作。',
  '当前阶段成果质量有待提升，请根据评价反馈进行修改完善。',
  '进度已严重滞后，请立即安排时间集中推进，如有困难请及时联系教师。',
];

export default function InterveneModal({
  team,
  teams,
  onClose,
  onSubmit,
}: InterveneModalProps) {
  const [selectedTeamId, setSelectedTeamId] = useState<number>(
    team?.id ?? (teams[0]?.id ?? 0)
  );
  const [selectedType, setSelectedType] = useState('notify');
  const [message, setMessage] = useState('');
  const [deadline, setDeadline] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!message.trim()) return;
    try {
      onSubmit({
        teamId: selectedTeamId,
        type: selectedType,
        message,
        deadline,
      });
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        onClose();
      }, 1500);
    } catch (err) {
      console.error('InterveneModal submit error:', err);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="bg-gradient-to-r from-teal-500 to-cyan-500 px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">发起干预指导</h2>
              <p className="text-sm text-teal-100 mt-0.5">
                精准引导，帮助团队突破瓶颈
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors cursor-pointer"
            >
              <i className="ri-close-line text-xl"></i>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* 选择团队 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              选择团队
            </label>
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(Number(e.target.value))}
              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.teamName} — {t.course}
                </option>
              ))}
            </select>
          </div>

          {/* 干预类型 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              干预方式
            </label>
            <div className="grid grid-cols-2 gap-2">
              {interveneTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type.id)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                    selectedType === type.id
                      ? 'border-teal-500 bg-teal-50 text-teal-700'
                      : 'border-gray-100 bg-gray-50 text-gray-600 hover:border-gray-200'
                  }`}
                >
                  <span
                    className={`w-6 h-6 flex items-center justify-center rounded-lg flex-shrink-0 ${type.color}`}
                  >
                    <i className={`${type.icon} text-xs`}></i>
                  </span>
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* 快捷消息 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              快捷消息模板
            </label>
            <div className="space-y-1.5">
              {quickMessages.map((msg, i) => (
                <button
                  key={i}
                  onClick={() => setMessage(msg)}
                  className="w-full text-left px-3 py-2 text-xs text-gray-600 bg-gray-50 hover:bg-teal-50 hover:text-teal-700 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-teal-200"
                >
                  {msg}
                </button>
              ))}
            </div>
          </div>

          {/* 消息内容 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              指导内容 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 500))}
              rows={4}
              placeholder="输入具体的指导意见或督促内容..."
              className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            />
            <div className="text-right text-xs text-gray-400 mt-1">
              {message.length}/500
            </div>
          </div>

          {/* 截止时间（仅deadline类型显示） */}
          {selectedType === 'deadline' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                补做截止时间
              </label>
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          )}

          {/* 提交按钮 */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSubmit}
              disabled={!message.trim() || submitted}
              className={`flex-1 py-3 text-sm font-medium rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                submitted
                  ? 'bg-green-500 text-white'
                  : !message.trim()
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-teal-500 text-white hover:bg-teal-600'
              }`}
            >
              {submitted ? (
                <>
                  <i className="ri-check-line mr-2"></i>发送成功！
                </>
              ) : (
                <>
                  <i className="ri-send-plane-line mr-2"></i>发送干预
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="px-5 py-3 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
