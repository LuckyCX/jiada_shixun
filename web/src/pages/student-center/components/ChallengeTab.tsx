import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { message } from 'antd';
import { fetchStudentIdeationProjectTopic } from '../../../lib/studentIdeationApi';
import {
  createChallengeSession,
  fetchMyLatestChallengeSession,
  streamChallengeFinalReport,
  streamChallengeRound,
  totalChallengeRounds,
  type ChallengeFinalReport,
  type MarketPersona,
} from '../../../lib/studentMarketResearchApi';
import MarketAnalysisStreamPanel from './MarketAnalysisStreamPanel';

export type ChallengeProjectInfo = {
  projectName: string;
  projectDirection: string;
  projectDescription: string;
  targetUsers: string;
  coreValue: string;
  coreProblem: string;
  solutionOverview: string;
  marketSize: string;
  competitiveAdvantage: string;
};

type ChallengeMessage = {
  role: 'user' | 'ai';
  content: string;
  agentName?: string;
  agentRole?: string;
};

const challengeAgents = [
  { id: 'picky-user', name: '挑剔用户', role: '从用户体验角度质疑产品价值', color: 'from-rose-500 to-pink-500', icon: 'ri-user-star-line' },
  { id: 'investor', name: '投资人', role: '从商业价值和盈利模式角度挑战', color: 'from-amber-500 to-orange-500', icon: 'ri-money-dollar-circle-line' },
  { id: 'competitor', name: '竞争对手分析师', role: '从竞争格局角度发起攻击', color: 'from-red-500 to-rose-500', icon: 'ri-sword-line' },
  { id: 'expert', name: '行业专家', role: '从专业角度质疑可行性', color: 'from-indigo-500 to-violet-500', icon: 'ri-lightbulb-line' },
];

const emptyProject = (): ChallengeProjectInfo => ({
  projectName: '',
  projectDirection: '',
  projectDescription: '',
  targetUsers: '',
  coreValue: '',
  coreProblem: '',
  solutionOverview: '',
  marketSize: '',
  competitiveAdvantage: '',
});

function projectFromApi(raw: Record<string, unknown>): ChallengeProjectInfo {
  const p = raw;
  return {
    projectName: String(p.projectName ?? ''),
    projectDirection: String(p.projectDirection ?? ''),
    projectDescription: String(p.projectDescription ?? ''),
    targetUsers: String(p.targetUsers ?? ''),
    coreValue: String(p.coreValue ?? ''),
    coreProblem: String(p.coreProblem ?? ''),
    solutionOverview: String(p.solutionOverview ?? ''),
    marketSize: String(p.marketSize ?? ''),
    competitiveAdvantage: String(p.competitiveAdvantage ?? ''),
  };
}

type Props = {
  classId: string;
  personas: MarketPersona[];
  onOpenRecords?: () => void;
  onMarketChallengeReportComplete?: () => void;
  disabled?: boolean;
};

export default function ChallengeTab({ classId, personas, onOpenRecords, onMarketChallengeReportComplete, disabled = false }: Props) {
  const [step, setStep] = useState<'info' | 'select' | 'challenge' | 'report'>('info');
  const [projectInfo, setProjectInfo] = useState<ChallengeProjectInfo>(emptyProject());
  const [autoFilled, setAutoFilled] = useState(false);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChallengeMessage[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [roundIndex, setRoundIndex] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [report, setReport] = useState<ChallengeFinalReport | null>(null);
  const [infoError, setInfoError] = useState('');
  const [streamStatus, setStreamStatus] = useState('');
  const [streamThinking, setStreamThinking] = useState('');
  const [streamContent, setStreamContent] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [reportGenerating, setReportGenerating] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const skipSessionRestoreRef = useRef(false);

  const totalRounds = useMemo(() => totalChallengeRounds(selectedAgents.length), [selectedAgents.length]);

  const challengeNotice = (
    <p className="text-sm text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-4 py-3 mb-4">
      人机对抗练习为个人记录，组员之间不共享；调研计划、问卷、分析等其它内容为小组共享。
    </p>
  );

  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, streaming, isProcessing]);

  useEffect(() => {
    if (!classId) return;
    void (async () => {
      try {
        const { topic } = await fetchStudentIdeationProjectTopic(classId);
        if (topic?.projectName) {
          setProjectInfo({
            projectName: topic.projectName || '',
            projectDirection: topic.projectDirection || topic.direction || '',
            projectDescription: topic.projectDescription || topic.description || '',
            targetUsers: topic.targetUsers || '',
            coreValue: topic.coreValue || '',
            coreProblem: topic.coreProblem || '',
            solutionOverview: topic.solutionOverview || '',
            marketSize: topic.marketSize || '',
            competitiveAdvantage: topic.competitiveAdvantage || '',
          });
          setAutoFilled(true);
        }
      } catch {
        /* 无选题 */
      }
    })();
  }, [classId]);

  useEffect(() => {
    if (!classId || skipSessionRestoreRef.current) return;
    void (async () => {
      try {
        const latest = await fetchMyLatestChallengeSession(classId);
        if (!latest) return;
        if (latest.projectInfo && typeof latest.projectInfo === 'object') {
          setProjectInfo(projectFromApi(latest.projectInfo));
        }
        if (latest.selectedAgents?.length) {
          setSelectedAgents(latest.selectedAgents);
        }
        if (latest.status === 'completed' && latest.finalReport) {
          setSessionId(latest.id);
          setReport(latest.finalReport);
          setStep('report');
          return;
        }
        if (latest.status === 'in_progress' && latest.id) {
          const agents = latest.selectedAgents || [];
          const rounds = latest.rounds || [];
          const total = totalChallengeRounds(agents.length);
          const msgs: ChallengeMessage[] = [];
          for (const r of rounds) {
            if (r.question) {
              const content = r.briefFeedback ? `${r.briefFeedback}\n\n${r.question}` : r.question;
              msgs.push({
                role: 'ai',
                content,
                agentName: r.agentName,
                agentRole: r.agentRole,
              });
            }
            if (r.answer) {
              msgs.push({ role: 'user', content: r.answer });
            }
          }
          let idx = 0;
          for (let i = 0; i < rounds.length; i++) {
            if (rounds[i].question && !rounds[i].answer) {
              idx = i;
              break;
            }
            if (rounds[i].question && rounds[i].answer) {
              idx = i + 1;
            }
          }
          setSessionId(latest.id);
          setMessages(msgs);
          setRoundIndex(Math.min(idx, Math.max(0, total - 1)));
          setStep('challenge');
        }
      } catch {
        /* 忽略恢复失败 */
      }
    })();
  }, [classId]);

  const personaAgents = personas.map((p) => ({
    id: `persona:${p.id}`,
    name: p.name,
    role: `目标用户「${p.name}」视角`,
    color: 'from-green-500 to-teal-500',
    icon: 'ri-user-heart-line',
  }));

  const allAgents = [...challengeAgents, ...personaAgents];

  const validateInfo = () => {
    if (!projectInfo.projectName.trim()) return '请填写项目名称';
    if (!projectInfo.targetUsers.trim()) return '请填写目标用户';
    if (!projectInfo.coreValue.trim()) return '请填写核心价值主张';
    if (!projectInfo.solutionOverview.trim()) return '请填写解决方案概述';
    return '';
  };

  const handleInfoSubmit = () => {
    const err = validateInfo();
    if (err) {
      setInfoError(err);
      return;
    }
    setInfoError('');
    setStep('select');
  };

  const toggleAgent = (agentId: string) => {
    setSelectedAgents((prev) => {
      if (prev.includes(agentId)) return prev.filter((id) => id !== agentId);
      if (prev.length >= 5) {
        message.warning('最多选择 5 个角色');
        return prev;
      }
      return [...prev, agentId];
    });
  };

  const fetchRoundQuestion = useCallback(
    async (sid: string, idx: number, previousAnswer?: string) => {
      if (!classId || !sid) return;
      setStreaming(true);
      setStreamThinking('');
      setStreamContent('');
      setStreamStatus('思考中…');
      try {
        await streamChallengeRound(classId, sid, {
          roundIndex: idx,
          answer: previousAnswer,
        }, {
          onStatus: (m) => setStreamStatus(m || '思考中…'),
          onDone: (data) => {
            const q = String(data.question || '').trim();
            if (!q) {
              message.error('未收到挑战问题，请刷新后重试');
              return;
            }
            const content = data.briefFeedback
              ? `${data.briefFeedback}\n\n${q}`
              : q;
            setMessages((prev) => [
              ...prev,
              {
                role: 'ai',
                content,
                agentName: data.agentName,
                agentRole: data.agentRole,
              },
            ]);
            setRoundIndex(idx);
          },
          onError: (m) => message.error(m),
        });
      } catch (e) {
        message.error(e instanceof Error ? e.message : '生成失败');
      } finally {
        setStreaming(false);
        setStreamStatus('');
        setStreamThinking('');
        setStreamContent('');
      }
    },
    [classId]
  );

  const startChallenge = async () => {
    if (!classId || selectedAgents.length === 0) return;
    skipSessionRestoreRef.current = true;
    setIsProcessing(true);
    try {
      const { sessionId: sid } = await createChallengeSession(classId, {
        projectInfo: projectInfo as unknown as Record<string, unknown>,
        selectedAgents,
      });
      setSessionId(sid);
      setStep('challenge');
      setMessages([]);
      setRoundIndex(0);
      await fetchRoundQuestion(sid, 0);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '无法开始挑战');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendAnswer = async () => {
    if (!currentInput.trim() || isProcessing || streaming || !sessionId || !classId) return;
    const answer = currentInput.trim();
    setMessages((prev) => [...prev, { role: 'user', content: answer }]);
    setCurrentInput('');
    const answeredRound = roundIndex;
    const nextRound = answeredRound + 1;
    if (nextRound >= totalRounds) {
      setIsProcessing(true);
      setReportGenerating(true);
      setStep('report');
      setStreaming(true);
      setStreamThinking('');
      setStreamContent('');
      setStreamStatus('思考中…');
      try {
        await streamChallengeFinalReport(classId, sessionId, answer, {
          onStatus: (m) => setStreamStatus(m || '思考中…'),
          onDone: (rep) => {
            setReport(rep);
            onMarketChallengeReportComplete?.();
          },
          onError: (m) => message.error(m),
        });
      } catch (e) {
        message.error(e instanceof Error ? e.message : '报告生成失败');
        setStep('challenge');
      } finally {
        setIsProcessing(false);
        setStreaming(false);
        setReportGenerating(false);
        setStreamStatus('');
      }
      return;
    }
    setIsProcessing(true);
    await fetchRoundQuestion(sessionId, nextRound, answer);
    setIsProcessing(false);
  };

  const resetChallenge = () => {
    skipSessionRestoreRef.current = true;
    setStep('info');
    setSelectedAgents([]);
    setMessages([]);
    setCurrentInput('');
    setRoundIndex(0);
    setSessionId(null);
    setReport(null);
    setReportGenerating(false);
  };

  const stepKeys = ['info', 'select', 'challenge', 'report'];
  const stepLabels = ['填写项目信息', '选择挑战角色', '对抗挑战', '查看报告'];

  const field = (
    label: string,
    key: keyof ChallengeProjectInfo,
    required: boolean,
    multiline = false
  ) => (
    <div key={key}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {multiline ? (
        <textarea
          value={projectInfo[key]}
          onChange={(e) => setProjectInfo({ ...projectInfo, [key]: e.target.value })}
          rows={3}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm resize-none"
        />
      ) : (
        <input
          type="text"
          value={projectInfo[key]}
          onChange={(e) => setProjectInfo({ ...projectInfo, [key]: e.target.value })}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm"
        />
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center justify-center gap-3 flex-1 min-w-0">
        {stepLabels.map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`flex items-center gap-2 ${stepKeys[i] === step ? 'text-indigo-600' : stepKeys.indexOf(step) > i ? 'text-green-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                stepKeys[i] === step ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white' :
                stepKeys.indexOf(step) > i ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {stepKeys.indexOf(step) > i ? <i className="ri-check-line"></i> : i + 1}
              </div>
              <span className="text-sm font-medium whitespace-nowrap">{label}</span>
            </div>
            {i < 3 && <div className="w-8 h-0.5 bg-gray-200 mx-1 hidden sm:block"></div>}
          </div>
        ))}
        </div>
        {onOpenRecords && (
          <button
            type="button"
            onClick={onOpenRecords}
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer whitespace-nowrap flex-shrink-0"
          >
            记录
          </button>
        )}
      </div>

      {step === 'info' && (
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <div className="mb-6">
            <h3 className="text-xl font-bold text-gray-900 mb-2">项目信息填写</h3>
            <p className="text-gray-500 text-sm">AI将根据这些信息发起针对性的挑战</p>
          </div>
          {autoFilled && (
            <div className="mb-6 flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
              <i className="ri-magic-line text-indigo-600 text-lg"></i>
              <div>
                <p className="text-sm font-medium text-indigo-900">已自动填充项目信息</p>
                <p className="text-xs text-indigo-600 mt-0.5">来源：创新思维模块中确定的项目选题，可手动修改</p>
              </div>
            </div>
          )}
          {infoError && (
            <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
              <i className="ri-error-warning-line"></i>{infoError}
            </div>
          )}
          <div className="space-y-5">
            {field('项目名称', 'projectName', true)}
            {field('项目方向', 'projectDirection', false)}
            {field('项目描述', 'projectDescription', false, true)}
            {field('目标用户', 'targetUsers', true)}
            {field('核心价值主张', 'coreValue', true, true)}
            {field('解决的核心问题', 'coreProblem', false, true)}
            {field('解决方案概述', 'solutionOverview', true, true)}
            {field('市场规模', 'marketSize', false)}
            {field('竞争优势', 'competitiveAdvantage', false, true)}
          </div>
          <div className="mt-8 flex justify-end">
            <button type="button" onClick={handleInfoSubmit} className="px-8 py-3 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-xl font-medium cursor-pointer">
              下一步：选择挑战角色 <i className="ri-arrow-right-line ml-1"></i>
            </button>
          </div>
        </div>
      )}

      {step === 'select' && (
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          {challengeNotice}
          <div className="mb-6">
            <h3 className="text-xl font-bold text-gray-900 mb-2">选择挑战角色</h3>
            <p className="text-gray-500 text-sm">最多 5 个；选 1 个角色共 5 轮，多角色时每个角色 2 轮并按顺序提问</p>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-8">
            {allAgents.map((agent) => (
              <div
                key={agent.id}
                onClick={() => toggleAgent(agent.id)}
                className={`p-6 rounded-xl border-2 cursor-pointer transition-all ${
                  selectedAgents.includes(agent.id) ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${agent.color} flex items-center justify-center flex-shrink-0`}>
                    <i className={`${agent.icon} text-2xl text-white`}></i>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold text-gray-900">{agent.name}</h4>
                      {selectedAgents.includes(agent.id) && <i className="ri-checkbox-circle-fill text-indigo-600 text-lg"></i>}
                    </div>
                    <p className="text-sm text-gray-500">{agent.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {personas.length === 0 && (
            <p className="text-sm text-gray-500 mb-4">可在「用户画像」中创建画像后作为挑战角色</p>
          )}
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => setStep('info')} className="px-6 py-3 border border-gray-200 text-gray-700 rounded-xl cursor-pointer">
              <i className="ri-arrow-left-line mr-1"></i>上一步
            </button>
            <button
              type="button"
              onClick={() => void startChallenge()}
              disabled={selectedAgents.length === 0 || isProcessing}
              className="px-8 py-3 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-xl disabled:opacity-50 cursor-pointer"
            >
              开始挑战（已选{selectedAgents.length}个）
            </button>
          </div>
        </div>
      )}

      {step === 'challenge' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col min-h-[min(640px,calc(100vh-220px))] max-h-[calc(100vh-180px)]">
          <div className="px-6 pt-4 flex-shrink-0">{challengeNotice}</div>
          <div className="bg-gradient-to-r from-indigo-500 to-violet-500 text-white px-6 py-4 flex justify-between flex-shrink-0">
            <span className="font-bold">人机对抗进行中</span>
            <span className="text-sm">第 {roundIndex + 1} / {totalRounds} 轮</span>
          </div>
          <MarketAnalysisStreamPanel
            visible={streaming}
            status={streamStatus}
            thinking={streamThinking}
            content={streamContent}
            loadingOnly
          />
          <div ref={chatScrollRef} className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4 bg-gray-50">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'ai' && (
                  <div className="max-w-[80%] bg-white rounded-xl px-4 py-3 border border-gray-200 text-sm whitespace-pre-wrap">
                    {msg.agentName && <p className="text-xs font-bold text-indigo-600 mb-1">{msg.agentName}</p>}
                    {msg.content}
                  </div>
                )}
                {msg.role === 'user' && (
                  <div className="max-w-[80%] bg-indigo-500 text-white rounded-xl px-4 py-3 text-sm">{msg.content}</div>
                )}
              </div>
            ))}
          </div>
          <div className="border-t p-4 flex gap-3 flex-shrink-0">
            <input
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void handleSendAnswer()}
              disabled={isProcessing || streaming}
              placeholder="输入您的回答..."
              className="flex-1 px-4 py-3 border rounded-xl text-sm"
            />
            <button
              type="button"
              onClick={() => void handleSendAnswer()}
              disabled={!currentInput.trim() || isProcessing || streaming}
              className="px-6 py-3 bg-indigo-500 text-white rounded-xl disabled:opacity-50 cursor-pointer"
            >
              发送回答
            </button>
          </div>
        </div>
      )}

      {step === 'report' && (
        <div className="space-y-6">
          {reportGenerating && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 flex items-center justify-center gap-2 text-gray-600">
              <i className="ri-loader-4-line animate-spin text-indigo-500 text-xl" />
              <span>{  '报告生成中…'}</span>
            </div>
          )}
          {report && !reportGenerating && (
          <>
          <div className="bg-gradient-to-r from-indigo-500 to-violet-500 rounded-xl p-8 text-white text-center">
            <div className="text-5xl font-bold mb-2">{report.totalScore}</div>
            <p>综合评分</p>
          </div>
          {[
            { title: '项目优势', items: report.strengths, icon: 'ri-thumb-up-line' },
            { title: '待改进点', items: report.weaknesses, icon: 'ri-alert-line' },
            { title: '优化建议', items: report.suggestions, icon: 'ri-lightbulb-line' },
          ].map((block) => (
            <div key={block.title} className="bg-white rounded-xl border p-6">
              <h4 className="font-bold mb-3">{block.title}</h4>
              <ul className="text-sm text-gray-700 space-y-2 list-disc pl-4">
                {block.items.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          ))}
          <button
            type="button"
            onClick={resetChallenge}
            disabled={disabled}
            className="px-6 py-3 border rounded-xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            重新开始挑战
          </button>
          </>
          )}
        </div>
      )}
    </div>
  );
}
