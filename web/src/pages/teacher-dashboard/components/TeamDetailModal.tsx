import { TeamProject } from './TeamCard';
import { useState } from 'react';
import { fetchTeacherMonitorTeamSubmissions, type TeacherMonitorSubmissionItem } from '../../../lib/teacherMonitorApi';

interface TeamDetailModalProps {
  classId: string;
  team: TeamProject;
  onClose: () => void;
  onIntervene: (team: TeamProject) => void;
}

const stages = [
  { id: 'teamFormation', name: '组队与团队管理', icon: 'ri-team-line', color: 'from-purple-500 to-pink-500' },
  { id: 'ideation', name: '创新思维与创意生成', icon: 'ri-lightbulb-line', color: 'from-yellow-500 to-orange-500' },
  { id: 'marketResearch', name: '市场调研与用户画像', icon: 'ri-search-line', color: 'from-teal-500 to-cyan-500' },
  { id: 'productDesign', name: '产品设计与原型', icon: 'ri-pencil-ruler-2-line', color: 'from-green-500 to-emerald-500' },
  { id: 'businessModel', name: '商业模式设计', icon: 'ri-bar-chart-box-line', color: 'from-indigo-500 to-purple-500' },
  { id: 'roleSimulation', name: '项目仿真与角色推荐', icon: 'ri-user-star-line', color: 'from-orange-500 to-red-500' },
  { id: 'businessPlan', name: '商业计划书与PPT', icon: 'ri-file-text-line', color: 'from-cyan-500 to-teal-500' },
];

const statusLabel = { 'on-track': '正常', 'at-risk': '预警', 'delayed': '严重滞后' };
const statusColor = {
  'on-track': 'bg-green-100 text-green-700',
  'at-risk': 'bg-orange-100 text-orange-700',
  'delayed': 'bg-red-100 text-red-700',
};
const evalLabel = { pending: '待评价', reviewed: '已评阅', passed: '已通过' };
const evalColor = {
  pending: 'bg-amber-100 text-amber-700',
  reviewed: 'bg-teal-100 text-teal-700',
  passed: 'bg-green-100 text-green-700',
};

export default function TeamDetailModal({ classId, team, onClose, onIntervene }: TeamDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'submissions'>('overview');
  const [submissions, setSubmissions] = useState<TeacherMonitorSubmissionItem[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [preview, setPreview] = useState<TeacherMonitorSubmissionItem | null>(null);

  const loadSubmissions = async () => {
    if (!classId) return;
    setSubmissionsLoading(true);
    try {
      const list = await fetchTeacherMonitorTeamSubmissions(classId, team.id);
      setSubmissions(list);
    } catch {
      setSubmissions([]);
    } finally {
      setSubmissionsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className={`sticky top-0 z-10 px-8 py-5 border-b border-gray-100 bg-white`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl font-bold ${
                team.status === 'on-track' ? 'bg-gradient-to-br from-teal-500 to-cyan-500' :
                team.status === 'at-risk' ? 'bg-gradient-to-br from-orange-500 to-amber-500' :
                'bg-gradient-to-br from-red-500 to-rose-500'
              }`}>
                {team.teamName.charAt(0)}
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{team.teamName}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm text-gray-500">{team.course}</span>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColor[team.status]}`}>
                    {statusLabel[team.status]}
                  </span>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${evalColor[team.evaluationStatus]}`}>
                    {evalLabel[team.evaluationStatus]}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <i className="ri-close-line text-xl text-gray-500"></i>
            </button>
          </div>

          {/* Tab切换 */}
          <div className="flex items-center gap-1 mt-4 bg-gray-100 rounded-xl p-1 w-fit">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'overview' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <i className="ri-dashboard-line mr-1.5"></i>团队概览
            </button>
            <button
              onClick={() => setActiveTab('submissions')}
              onMouseEnter={() => {
                if (!submissions.length && !submissionsLoading) void loadSubmissions();
              }}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'submissions' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <i className="ri-file-list-3-line mr-1.5"></i>提交记录
              <span className="ml-1.5 px-1.5 py-0.5 bg-teal-100 text-teal-700 text-xs rounded-full">{submissions.length}</span>
            </button>
          </div>
        </div>

        <div className="p-8 space-y-6">
          {/* 团队概览Tab */}
          {activeTab === 'overview' && (
            <>
              {/* 核心指标 */}
              {/* <div className="grid grid-cols-4 gap-4">
                {[
                  { label: '整体进度', value: `${team.overallProgress}%`, icon: 'ri-line-chart-line', color: 'from-teal-500 to-cyan-500' },
                  { label: '知识进度', value: `${team.knowledgeProgress}%`, icon: 'ri-book-open-line', color: 'from-indigo-500 to-purple-500' },
                  { label: '协作评分', value: team.collaborationScore, icon: 'ri-team-line', color: 'from-green-500 to-emerald-500' },
                  { label: '质量评分', value: team.qualityScore, icon: 'ri-star-line', color: 'from-amber-500 to-orange-500' },
                ].map((item, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl p-4 text-center">
                    <div className={`w-10 h-10 mx-auto mb-2 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center`}>
                      <i className={`${item.icon} text-white text-base`}></i>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{item.value}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{item.label}</div>
                  </div>
                ))}
              </div> */}

              {/* 成员信息 */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <i className="ri-group-line text-teal-500"></i>团队成员
                </h3>
                <div className="flex flex-wrap gap-2">
                  {team.members.map((m, i) => (
                    <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ background: `hsl(${(i * 60 + 160) % 360}, 60%, 55%)` }}
                      >
                        {m.name.charAt(0)}
                      </div>
                      <span className="text-sm text-gray-700">{m.name}</span>
                      {m.name === team.leader && (
                        <span className="px-1.5 py-0.5 bg-teal-100 text-teal-700 text-xs rounded-full">队长</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 各阶段进度 */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <i className="ri-map-pin-line text-teal-500"></i>各阶段完成情况
                </h3>
                <div className="space-y-2.5">
                  {stages.map(stage => {
                    const prog = team.stageProgress[stage.id as keyof typeof team.stageProgress];
                    const isDone = prog === 100;
                    const isActive = prog > 0 && prog < 100;
                    return (
                      <div key={stage.id} className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br ${stage.color} flex-shrink-0`}>
                          <i className={`${stage.icon} text-white text-xs`}></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-gray-700 truncate">{stage.name}</span>
                            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                              {isDone && <span className="text-xs text-green-600 font-medium">✓ 已完成</span>}
                              {isActive && <span className="text-xs text-orange-500 font-medium animate-pulse">进行中</span>}
                              {!isDone && !isActive && <span className="text-xs text-gray-400">未开始</span>}
                              <span className="text-xs font-bold text-gray-900 w-8 text-right">{prog}%</span>
                            </div>
                          </div>
                          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full bg-gradient-to-r ${stage.color} transition-all duration-700`}
                              style={{ width: `${prog}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 其他统计 */}
              {/* <div className="grid grid-cols-3 gap-4">
                <div className="bg-teal-50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-teal-600">{team.abilityPoints}</div>
                  <div className="text-xs text-teal-500 mt-0.5">已获能力点</div>
                </div>
                <div className="bg-indigo-50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-indigo-600">{team.iterationCount}</div>
                  <div className="text-xs text-indigo-500 mt-0.5">迭代次数</div>
                </div>
                <div className="bg-amber-50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-amber-600">{team.submissionCount}</div>
                  <div className="text-xs text-amber-500 mt-0.5">成果提交数</div>
                </div>
              </div> */}

              {/* 预警信息 */}
              {team.warnings.length > 0 && (
                <div className={`rounded-xl p-4 ${team.status === 'delayed' ? 'bg-red-50 border border-red-200' : 'bg-orange-50 border border-orange-200'}`}>
                  <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <i className={`${team.status === 'delayed' ? 'ri-error-warning-fill text-red-500' : 'ri-alert-fill text-orange-500'}`}></i>
                    预警信息
                  </h3>
                  <ul className="space-y-1.5">
                    {team.warnings.map((w, i) => (
                      <li key={i} className={`text-sm flex items-start gap-2 ${team.status === 'delayed' ? 'text-red-700' : 'text-orange-700'}`}>
                        <i className="ri-arrow-right-s-line mt-0.5 flex-shrink-0"></i>
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {/* 提交记录Tab */}
          {activeTab === 'submissions' && (
            <div className="space-y-4">
              {submissionsLoading ? (
                <div className="text-center py-12 text-gray-500 text-sm">加载中…</div>
              ) : submissions.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-2xl flex items-center justify-center">
                    <i className="ri-file-list-3-line text-3xl text-gray-400"></i>
                  </div>
                  <p className="text-gray-500 text-sm">暂无提交记录</p>
                </div>
              ) : (
                submissions.map((submission) => (
                  <div key={submission.id} className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-all">
                    {/* 提交头部 */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-base font-bold text-gray-900">{submission.title}</h4>
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                            {submission.stageName}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400">提交时间：{submission.submitTime || '-'}</p>
                      </div>
                    </div>

                    {/* 提交内容 */}
                    <div className="bg-gray-50 rounded-lg p-4 mb-3">
                      {submission.kind === 'file' ? (
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-gray-800 truncate">{submission.file.name}</div>
                            <div className="text-xs text-gray-500 mt-0.5">文件提交</div>
                          </div>
                          <a
                            href={submission.file.downloadUrl}
                            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 whitespace-nowrap"
                          >
                            <i className="ri-download-line mr-1.5"></i>下载
                          </a>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPreview(submission)}
                          className="w-full text-left text-sm text-gray-700 leading-relaxed cursor-pointer"
                        >
                          点击预览内容
                        </button>
                      )}
                    </div>

                    {/* 附件（仅 mixed） */}
                    {submission.kind === 'mixed' && submission.files?.length > 0 && (
                      <div className="mb-3">
                        <h5 className="text-xs font-bold text-gray-700 mb-2">附件：</h5>
                        <div className="flex flex-wrap gap-2">
                          {submission.files.map((file, idx) => (
                            <a
                              key={idx}
                              href={file.downloadUrl}
                              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                            >
                              <i className="ri-file-line text-teal-500"></i>
                              <span>{file.name}</span>
                              <i className="ri-download-line text-gray-400"></i>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* 预览弹窗（数据上传） */}
          {preview && preview.kind !== 'file' && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => setPreview(null)}>
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-gray-900 truncate">{preview.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{preview.stageName}</div>
                  </div>
                  <button
                    onClick={() => setPreview(null)}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    <i className="ri-close-line text-lg text-gray-500"></i>
                  </button>
                </div>
                <div className="p-6 max-h-[70vh] overflow-y-auto">
                  <pre className="text-xs text-gray-700 whitespace-pre-wrap break-words">{JSON.stringify(preview.payload ?? null, null, 2)}</pre>
                </div>
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-3 pt-2">
            {team.status !== 'on-track' && (
              <button
                onClick={() => { onClose(); onIntervene(team); }}
                className={`flex-1 py-3 text-sm font-medium rounded-xl transition-colors whitespace-nowrap cursor-pointer ${
                  team.status === 'delayed'
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-orange-500 text-white hover:bg-orange-600'
                }`}
              >
                <i className="ri-hand-heart-line mr-2"></i>立即干预
              </button>
            )}
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}