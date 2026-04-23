
import React from 'react';

interface LearningProgressBarProps {
  videoProgress: number;
  docProgress: number;
  quizPassed: boolean;
  studyMinutes: number;
}

export default function LearningProgressBar({
  videoProgress,
  docProgress,
  quizPassed,
  studyMinutes,
}: LearningProgressBarProps) {
  // 防御性检查：确保传入的进度在 0-100 之间
  const clamp = (value: number) => Math.min(100, Math.max(0, value));

  const overall = Math.round(
    clamp(videoProgress) * 0.4 +
      clamp(docProgress) * 0.3 +
      (quizPassed ? 100 : 0) * 0.3
  );

  const steps = [
    {
      label: '视频学习',
      icon: 'ri-play-circle-line',
      progress: clamp(videoProgress),
      color: 'from-teal-500 to-cyan-500',
      bgColor: 'bg-teal-50',
      textColor: 'text-teal-600',
      weight: '40%',
    },
    {
      label: '文档阅读',
      icon: 'ri-file-text-line',
      progress: clamp(docProgress),
      color: 'from-amber-500 to-orange-500',
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-600',
      weight: '30%',
    },
    {
      label: '学习检测',
      icon: 'ri-checkbox-circle-line',
      progress: quizPassed ? 100 : 0,
      color: 'from-green-500 to-emerald-500',
      bgColor: 'bg-green-50',
      textColor: 'text-green-600',
      weight: '30%',
    },
  ];

  // 计算圆环进度的 SVG 参数
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - overall / 100);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      {/* 标题 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 flex items-center justify-center bg-teal-50 rounded-lg">
            <i className="ri-bar-chart-line text-teal-600 text-lg"></i>
          </div>
          <h3 className="text-sm font-bold text-gray-900">学习进度追踪</h3>
        </div>
        <div className="flex items-center space-x-1 text-xs text-gray-500">
          <i className="ri-time-line"></i>
          <span>已学习 {studyMinutes} 分钟</span>
        </div>
      </div>

      {/* 总进度环 */}
      <div className="flex items-center space-x-4 mb-5 p-4 bg-gradient-to-r from-teal-50 to-cyan-50 rounded-xl">
        <div className="relative w-16 h-16 flex-shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
            <circle
              cx="32"
              cy="32"
              r={radius}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="6"
            />
            <circle
              cx="32"
              cy="32"
              r={radius}
              fill="none"
              stroke="url(#progressGrad)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="transition-all duration-700"
            />
            <defs>
              <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#14b8a6" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-bold text-teal-600">{overall}%</span>
          </div>
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-gray-900 mb-1">综合学习进度</p>
          <p className="text-xs text-gray-500 mb-2">视频40% + 文档30% + 检测30%</p>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full transition-all duration-700"
              style={{ width: `${overall}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* 分项进度 */}
      <div className="space-y-3">
        {steps.map((step, idx) => (
          <div key={idx} className={`${step.bgColor} rounded-xl p-3`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <i className={`${step.icon} ${step.textColor} text-sm`}></i>
                <span className="text-xs font-semibold text-gray-700">{step.label}</span>
                <span className="text-xs text-gray-400">权重{step.weight}</span>
              </div>
              <div className="flex items-center space-x-1">
                {step.progress === 100 && (
                  <i className="ri-checkbox-circle-fill text-green-500 text-sm"></i>
                )}
                <span className={`text-xs font-bold ${step.textColor}`}>{step.progress}%</span>
              </div>
            </div>
            <div className="w-full bg-white/60 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${step.color} rounded-full transition-all duration-500`}
                style={{ width: `${step.progress}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>

      {/* 达标提示 */}
      {overall >= 80 && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-xl flex items-center space-x-2">
          <i className="ri-award-fill text-green-500 text-lg flex-shrink-0"></i>
          <div>
            <p className="text-xs font-bold text-green-700">学习达标！</p>
            <p className="text-xs text-green-600">可获取能力点，解锁实践任务</p>
          </div>
        </div>
      )}
      {overall < 80 && overall > 0 && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center space-x-2">
          <i className="ri-information-line text-amber-500 text-lg flex-shrink-0"></i>
          <p className="text-xs text-amber-700">
            完成所有学习内容并通过检测（≥80%）即可解锁实践任务
          </p>
        </div>
      )}
    </div>
  );
}
