
import React, { useState } from 'react';

interface StageProgress {
  teamFormation: number;
  ideation: number;
  marketResearch: number;
  productDesign: number;
  businessModel: number;
  aiValidation: number;
  roleSimulation: number;
  businessPlan: number;
}

export interface TeamProject {
  id: number;
  teamName: string;
  course: string;
  members: { name: string; avatar: string }[];
  leader: string;
  currentStage: string;
  overallProgress: number;
  stageProgress: StageProgress;
  knowledgeProgress: number;
  abilityPoints: number;
  collaborationScore: number;
  qualityScore: number;
  lastActive: string;
  status: 'on-track' | 'at-risk' | 'delayed';
  warnings: string[];
  evaluationStatus: 'pending' | 'reviewed' | 'passed';
  iterationCount: number;
  submissionCount: number;
}

interface TeamCardProps {
  team: TeamProject;
  onViewDetail: (team: TeamProject) => void;
  onIntervene: (team: TeamProject) => void;
}

const stages = [
  { id: 'teamFormation', name: '组队', icon: 'ri-team-line' },
  { id: 'ideation', name: '创新', icon: 'ri-lightbulb-line' },
  { id: 'marketResearch', name: '调研', icon: 'ri-search-line' },
  { id: 'productDesign', name: '设计', icon: 'ri-pencil-ruler-2-line' },
  { id: 'businessModel', name: '商模', icon: 'ri-bar-chart-box-line' },
  { id: 'aiValidation', name: 'AI验', icon: 'ri-robot-line' },
  { id: 'roleSimulation', name: '角色', icon: 'ri-user-star-line' },
  { id: 'businessPlan', name: '计划', icon: 'ri-file-text-line' },
];

const statusConfig = {
  'on-track': {
    label: '正常',
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-l-green-400',
    dot: 'bg-green-400',
    badge: 'bg-green-100 text-green-700',
  },
  'at-risk': {
    label: '预警',
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-l-orange-400',
    dot: 'bg-orange-400',
    badge: 'bg-orange-100 text-orange-700',
  },
  'delayed': {
    label: '滞后',
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-l-red-400',
    dot: 'bg-red-400',
    badge: 'bg-red-100 text-red-700',
  },
} as const;

const evalConfig = {
  pending: { label: '待评价', cls: 'bg-amber-100 text-amber-700' },
  reviewed: { label: '已评阅', cls: 'bg-teal-100 text-teal-700' },
  passed: { label: '已通过', cls: 'bg-green-100 text-green-700' },
} as const;

export default function TeamCard({
  team,
  onViewDetail,
  onIntervene,
}: TeamCardProps) {
  const [hovered, setHovered] = useState(false);

  // Defensive fallbacks – they protect the component if an unexpected value slips through
  const cfg = statusConfig[team.status] ?? statusConfig['on-track'];
  const evalCfg = evalConfig[team.evaluationStatus] ?? evalConfig.pending;

  return (
    <div
      className={`
        relative bg-white rounded-2xl border border-gray-100 border-l-4 ${cfg.border}
        shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden
        ${hovered ? '-translate-y-1' : ''}
      `}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onViewDetail(team)}
    >
      {/* 顶部状态条 */}
      {team.status !== 'on-track' && (
        <div
          className={`
            absolute top-0 left-0 right-0 h-0.5
            ${team.status === 'delayed' ? 'bg-red-400' : 'bg-orange-400'}
            animate-pulse
          `}
        />
      )}

      <div className="p-5">
        {/* 头部：团队名 + 标签 */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div
                className={`
                  w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0
                  ${
                    team.status === 'on-track'
                      ? 'bg-gradient-to-br from-teal-500 to-cyan-500'
                      : team.status === 'at-risk'
                      ? 'bg-gradient-to-br from-orange-500 to-amber-500'
                      : 'bg-gradient-to-br from-red-500 to-rose-500'
                  }
                `}
              >
                {team.teamName.charAt(0)}
              </div>
              <h3 className="text-sm font-bold text-gray-900 truncate">{team.teamName}</h3>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full whitespace-nowrap">
                {team.course}
              </span>
              <span className={`px-2 py-0.5 text-xs rounded-full font-medium whitespace-nowrap ${cfg.badge}`}>
                <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${cfg.dot}`} />
                {cfg.label}
              </span>
              <span className={`px-2 py-0.5 text-xs rounded-full whitespace-nowrap ${evalCfg.cls}`}>
                {evalCfg.label}
              </span>
            </div>
          </div>
          <div className="text-right flex-shrink-0 ml-2">
            <div className="text-2xl font-bold text-gray-900">{team.overallProgress}%</div>
            <div className="text-xs text-gray-400">整体进度</div>
          </div>
        </div>

        {/* 成员头像 */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex -space-x-2">
            {team.members.slice(0, 4).map((m, i) => (
              <div
                key={i}
                className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold text-white"
                style={{ background: `hsl(${(i * 60 + 160) % 360}, 60%, 55%)` }}
                title={m.name}
              >
                {m.name.charAt(0)}
              </div>
            ))}
            {team.members.length > 4 && (
              <div className="w-6 h-6 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-xs text-gray-600 font-bold">
                +{team.members.length - 4}
              </div>
            )}
          </div>
          <span className="text-xs text-gray-500">队长：{team.leader}</span>
          <span className="text-xs text-gray-400 ml-auto">{team.lastActive}</span>
        </div>

        {/* 整体进度条 */}
        <div className="mb-3">
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`
                h-full rounded-full transition-all duration-700
                ${
                  team.status === 'on-track'
                    ? 'bg-gradient-to-r from-teal-500 to-cyan-400'
                    : team.status === 'at-risk'
                    ? 'bg-gradient-to-r from-orange-500 to-amber-400'
                    : 'bg-gradient-to-r from-red-500 to-rose-400'
                }
              `}
              style={{ width: `${team.overallProgress}%` }}
            />
          </div>
        </div>

        {/* 阶段节点 */}
        <div className="flex items-center gap-0.5 mb-3">
          {stages.map((stage, idx) => {
            const prog = team.stageProgress[stage.id as keyof StageProgress] ?? 0;
            const isActive = prog > 0 && prog < 100;
            const isDone = prog === 100;
            return (
              <div key={stage.id} className="flex items-center flex-1">
                <div
                  className={`
                    relative w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all
                    ${isDone ? 'bg-teal-500' : isActive ? 'bg-orange-400 ring-2 ring-orange-200' : 'bg-gray-200'}
                  `}
                  title={`${stage.name}: ${prog}%`}
                >
                  {isDone ? (
                    <i className="ri-check-line text-white text-xs" />
                  ) : isActive ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                  )}
                </div>
                {idx < stages.length - 1 && (
                  <div className={`flex-1 h-0.5 ${isDone ? 'bg-teal-300' : 'bg-gray-200'}`} />
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
          <span>
            当前：<strong className="text-gray-700">{team.currentStage}</strong>
          </span>
          <span>
            能力点 <strong className="text-teal-600">{team.abilityPoints}</strong>
          </span>
        </div>

        {/* 三项评分 */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-gray-50 rounded-lg p-2 text-center">
            <div className="text-sm font-bold text-gray-900">{team.knowledgeProgress}%</div>
            <div className="text-xs text-gray-500">知识进度</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-2 text-center">
            <div className="text-sm font-bold text-gray-900">{team.collaborationScore}</div>
            <div className="text-xs text-gray-500">协作评分</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-2 text-center">
            <div className="text-sm font-bold text-gray-900">{team.qualityScore}</div>
            <div className="text-xs text-gray-500">质量评分</div>
          </div>
        </div>

        {/* 预警信息 */}
        {team.warnings.length > 0 && (
          <div
            className={`
              rounded-xl p-2.5 mb-3
              ${team.status === 'delayed' ? 'bg-red-50 border border-red-100' : 'bg-orange-50 border border-orange-100'}
            `}
          >
            {team.warnings.slice(0, 2).map((w, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <i
                  className={`
                    text-xs mt-0.5 flex-shrink-0
                    ${team.status === 'delayed' ? 'ri-error-warning-fill text-red-500' : 'ri-alert-fill text-orange-500'}
                  `}
                />
                <span className={team.status === 'delayed' ? 'text-xs text-red-700' : 'text-xs text-orange-700'}>
                  {w}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* 底部操作 */}
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onViewDetail(team)}
            className="flex-1 py-2 bg-teal-500 text-white text-xs font-medium rounded-lg hover:bg-teal-600 transition-colors whitespace-nowrap cursor-pointer"
          >
            <i className="ri-eye-line mr-1" />
            查看详情
          </button>
          {team.status !== 'on-track' && (
            <button
              onClick={() => onIntervene(team)}
              className={`
                px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer
                ${team.status === 'delayed' ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-orange-100 text-orange-700 hover:bg-orange-200'}
              `}
            >
              <i className="ri-hand-heart-line mr-1" />
              干预
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
