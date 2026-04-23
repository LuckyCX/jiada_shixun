import { useState } from 'react';

interface ProjectInfo {
  name: string;
  targetUser: string;
  coreValue: string;
  businessModel: string;
}

interface Message {
  role: 'user' | 'ai';
  content: string;
  agentName?: string;
  agentRole?: string;
  score?: number;
}

interface ChallengeAgent {
  id: string;
  name: string;
  role: string;
  color: string;
  icon: string;
  questions: string[];
}

const challengeAgents: ChallengeAgent[] = [
  {
    id: 'picky-user',
    name: '挑剔用户',
    role: '从用户体验角度质疑产品价值',
    color: 'from-rose-500 to-pink-500',
    icon: 'ri-user-star-line',
    questions: [
      '你的产品真的能解决我的痛点吗？我现在用的方案已经够好了，为什么要换成你的？',
      '你说的这些功能听起来很美好，但实际使用会不会很复杂？我没时间学习新工具。',
      '价格怎么定？如果比现有方案贵，凭什么让我多花钱？',
      '你们的产品稳定吗？万一出问题影响我的工作怎么办？',
      '我看你们是新团队，如果你们倒闭了，我的数据和服务怎么办？',
      '你的竞争对手也在做类似的事情，而且他们更有名气，我为什么要选你？',
      '你说的目标用户画像真的准确吗？我觉得你们对用户的理解还不够深入。',
      '免费试用期结束后，如果我不满意能退款吗？你们的售后服务怎么样？',
      '你们的产品更新频率如何？会不会用着用着就不维护了？',
      '隐私安全怎么保障？我的数据会不会被泄露或滥用？'
    ]
  },
  {
    id: 'investor',
    name: '投资人',
    role: '从商业价值和盈利模式角度挑战',
    color: 'from-amber-500 to-orange-500',
    icon: 'ri-money-dollar-circle-line',
    questions: [
      '你的商业模式能持续盈利吗？给我看看你的财务预测模型。',
      '市场规模有多大？你能占据多少市场份额？这个赛道是不是已经红海了？',
      '你的获客成本是多少？客户生命周期价值（LTV）能覆盖吗？',
      '团队背景如何？你们有相关行业经验吗？核心竞争力在哪里？',
      '你们的护城河是什么？技术壁垒还是资源壁垒？别人能不能轻易复制？',
      '融资计划是什么？这笔钱能烧多久？下一轮融资的里程碑是什么？',
      '退出机制是什么？IPO还是被收购？预计多久能实现？',
      '风险点在哪里？政策风险、技术风险、市场风险你们怎么应对？',
      '为什么是现在做这个项目？时机成熟了吗？会不会太早或太晚？',
      '你们的增长策略是什么？如何实现规模化扩张？'
    ]
  },
  {
    id: 'competitor',
    name: '竞争对手分析师',
    role: '从竞争格局角度发起攻击',
    color: 'from-red-500 to-rose-500',
    icon: 'ri-sword-line',
    questions: [
      '你的竞争对手已经做得很成熟了，你凭什么能赢？差异化在哪里？',
      '大厂如果进入这个领域，你们怎么办？有什么防御策略？',
      '你们的技术真的领先吗？还是只是包装得好看？核心技术是自研还是外采？',
      '竞品的用户量已经很大了，你们怎么抢用户？有什么杀手锏功能？',
      '你们的定价策略合理吗？会不会引发价格战？利润空间在哪里？',
      '行业内已经有几家拿到大额融资了，你们的资金实力能跟上吗？',
      '你们的产品迭代速度能跟上竞争对手吗？研发团队够强吗？',
      '市场营销预算有多少？竞争对手在疯狂烧钱获客，你们跟得上吗？',
      '你们的合作伙伴资源如何？竞争对手已经和行业龙头合作了。',
      '用户为什么要从竞品迁移到你们这里？迁移成本高不高？'
    ]
  },
  {
    id: 'expert',
    name: '行业专家',
    role: '从专业角度质疑可行性',
    color: 'from-indigo-500 to-violet-500',
    icon: 'ri-lightbulb-line',
    questions: [
      '你们对这个行业的理解够深吗？我看你们的方案有些地方不太符合行业规律。',
      '技术实现路径清晰吗？有没有技术难点？你们有能力攻克吗？',
      '你们的解决方案是不是过度设计了？用户真的需要这么复杂的功能吗？',
      '行业监管政策你们了解吗？有没有合规风险？',
      '供应链和上下游资源你们掌握了吗？这个行业的关键资源在谁手里？',
      '你们的产品符合行业标准吗？有没有相关认证和资质？',
      '行业的痛点你们真的抓准了吗？还是只是自己想象的伪需求？',
      '你们的方案在实际场景中验证过吗？有没有试点案例？',
      '行业内的关键意见领袖（KOL）怎么看你们的项目？有没有背书？',
      '这个行业的发展趋势是什么？你们的项目是顺势而为还是逆势而行？'
    ]
  }
];

export default function ChallengeTab() {
  const [step, setStep] = useState<'info' | 'select' | 'challenge' | 'report'>('info');
  const [projectInfo, setProjectInfo] = useState<ProjectInfo>({
    name: '',
    targetUser: '',
    coreValue: '',
    businessModel: ''
  });
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [currentRound, setCurrentRound] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [challengeStarted, setChallengeStarted] = useState(false);
  const [report, setReport] = useState<{
    totalScore: number;
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
  } | null>(null);

  const handleInfoSubmit = () => {
    if (!projectInfo.name || !projectInfo.targetUser || !projectInfo.coreValue || !projectInfo.businessModel) {
      alert('请填写完整的项目信息');
      return;
    }
    setStep('select');
  };

  const toggleAgent = (agentId: string) => {
    setSelectedAgents(prev =>
      prev.includes(agentId)
        ? prev.filter(id => id !== agentId)
        : [...prev, agentId]
    );
  };

  const startChallenge = () => {
    if (selectedAgents.length === 0) {
      alert('请至少选择一个挑战角色');
      return;
    }
    setStep('challenge');
    setChallengeStarted(true);
    setCurrentRound(1);
    setCurrentQuestionIndex(0);
    // 第一轮自动提问
    setTimeout(() => {
      askNextQuestion(0);
    }, 1000);
  };

  const askNextQuestion = (questionIndex: number) => {
    const agentId = selectedAgents[questionIndex % selectedAgents.length];
    const agent = challengeAgents.find(a => a.id === agentId)!;
    const questionPool = agent.questions;
    const randomQuestion = questionPool[Math.floor(Math.random() * questionPool.length)];

    const newMessage: Message = {
      role: 'ai',
      content: randomQuestion,
      agentName: agent.name,
      agentRole: agent.role
    };

    setMessages(prev => [...prev, newMessage]);
  };

  const handleSendAnswer = () => {
    if (!currentInput.trim()) {
      return;
    }

    // 添加用户回答
    const userMessage: Message = {
      role: 'user',
      content: currentInput
    };
    setMessages(prev => [...prev, userMessage]);
    setCurrentInput('');
    setIsProcessing(true);

    // 模拟AI评分和反馈
    setTimeout(() => {
      const score = Math.floor(Math.random() * 30) + 70; // 70-100分
      const feedbacks = [
        '回答有一定道理，但还需要更具体的数据支撑。',
        '这个角度不错，但没有充分考虑到实际执行中的困难。',
        '逻辑清晰，但缺少对竞争对手的深入分析。',
        '想法很好，建议补充更多的市场验证案例。',
        '回答比较全面，但在商业模式的可持续性上还需要深入思考。',
        '不错的见解，但需要更多关注用户的真实需求。',
        '有创新性，但风险评估还不够充分。',
        '回答切中要害，继续保持这个思路深入挖掘。'
      ];
      const feedback = feedbacks[Math.floor(Math.random() * feedbacks.length)];

      const aiMessage: Message = {
        role: 'ai',
        content: `评分：${score}分\n\n${feedback}`,
        score
      };
      setMessages(prev => [...prev, aiMessage]);
      setIsProcessing(false);

      // 使用函数式更新避免闭包问题
      setCurrentQuestionIndex(prevIndex => {
        const nextQuestionIndex = prevIndex + 1;
        
        // 每个角色问完一轮后，进入下一轮
        if (nextQuestionIndex % selectedAgents.length === 0) {
          setCurrentRound(prevRound => {
            const nextRound = prevRound + 1;
            
            // 5轮后结束
            if (nextRound > 5) {
              setTimeout(() => {
                generateReport();
              }, 1500);
              return prevRound;
            }
            
            return nextRound;
          });
        }

        // 继续提问
        setTimeout(() => {
          askNextQuestion(nextQuestionIndex);
        }, 1500);
        
        return nextQuestionIndex;
      });
    }, 2000);
  };

  const generateReport = () => {
    const scores = messages.filter(m => m.score).map(m => m.score!);
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

    const reportData = {
      totalScore: avgScore,
      strengths: [
        '项目定位清晰，目标用户画像明确',
        '核心价值主张具有一定的创新性',
        '对市场需求有基本的理解',
        '团队对项目充满热情和信心'
      ],
      weaknesses: [
        '商业模式的可持续性需要进一步验证',
        '竞争分析不够深入，差异化优势不够明显',
        '财务预测和盈利模式需要更详细的规划',
        '风险应对策略还不够完善',
        '缺少实际的市场验证数据'
      ],
      suggestions: [
        '建议进行小规模的市场测试，收集真实用户反馈',
        '深入研究竞争对手，明确自己的核心竞争力',
        '制定详细的财务计划，包括成本结构和收入预测',
        '建立风险预警机制，准备应对方案',
        '寻找行业导师或顾问，获取专业指导',
        '优化产品功能，聚焦核心价值，避免过度设计',
        '建立用户反馈渠道，持续迭代优化产品',
        '加强团队建设，补充关键岗位的专业人才'
      ]
    };

    setReport(reportData);
    setStep('report');
  };

  const handleSaveReport = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      const successToast = document.createElement('div');
      successToast.className = 'fixed bottom-6 right-6 bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2';
      successToast.innerHTML = '<i class="ri-check-line text-xl"></i><span>压力测试报告已保存</span>';
      document.body.appendChild(successToast);
      setTimeout(() => successToast.remove(), 3000);
    }, 1000);
  };

  const resetChallenge = () => {
    setStep('info');
    setProjectInfo({ name: '', targetUser: '', coreValue: '', businessModel: '' });
    setSelectedAgents([]);
    setMessages([]);
    setCurrentInput('');
    setCurrentRound(0);
    setCurrentQuestionIndex(0);
    setChallengeStarted(false);
    setReport(null);
  };

  return (
    <div className="space-y-6">
      {/* 步骤指示器 */}
      <div className="flex items-center justify-center gap-4">
        <div className={`flex items-center gap-2 ${step === 'info' ? 'text-indigo-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'info' ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white' : 'bg-gray-200'}`}>
            1
          </div>
          <span className="font-medium whitespace-nowrap">填写项目信息</span>
        </div>
        <div className="w-12 h-0.5 bg-gray-300"></div>
        <div className={`flex items-center gap-2 ${step === 'select' ? 'text-indigo-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'select' ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white' : 'bg-gray-200'}`}>
            2
          </div>
          <span className="font-medium whitespace-nowrap">选择挑战角色</span>
        </div>
        <div className="w-12 h-0.5 bg-gray-300"></div>
        <div className={`flex items-center gap-2 ${step === 'challenge' ? 'text-indigo-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'challenge' ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white' : 'bg-gray-200'}`}>
            3
          </div>
          <span className="font-medium whitespace-nowrap">对抗挑战</span>
        </div>
        <div className="w-12 h-0.5 bg-gray-300"></div>
        <div className={`flex items-center gap-2 ${step === 'report' ? 'text-indigo-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'report' ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white' : 'bg-gray-200'}`}>
            4
          </div>
          <span className="font-medium whitespace-nowrap">查看报告</span>
        </div>
      </div>

      {/* 步骤1：填写项目信息 */}
      {step === 'info' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="mb-6">
            <h3 className="text-xl font-bold text-gray-900 mb-2">项目信息填写</h3>
            <p className="text-gray-600">请填写您的项目基本信息，市场调研智能体将根据这些信息发起针对性的挑战</p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                项目名称 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={projectInfo.name}
                onChange={(e) => setProjectInfo({ ...projectInfo, name: e.target.value })}
                placeholder="例如：智慧校园AI助手"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                目标用户 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={projectInfo.targetUser}
                onChange={(e) => setProjectInfo({ ...projectInfo, targetUser: e.target.value })}
                placeholder="例如：高校学生、教师、管理人员"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                核心价值主张 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={projectInfo.coreValue}
                onChange={(e) => setProjectInfo({ ...projectInfo, coreValue: e.target.value })}
                placeholder="例如：通过AI技术提升校园管理效率，为师生提供智能化服务，解决传统校园管理中的信息孤岛问题"
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                商业模式 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={projectInfo.businessModel}
                onChange={(e) => setProjectInfo({ ...projectInfo, businessModel: e.target.value })}
                placeholder="例如：SaaS订阅模式，按学校规模收费；基础版免费，高级功能付费；提供定制化开发服务"
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm resize-none"
              />
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <button
              onClick={handleInfoSubmit}
              className="px-8 py-3 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-lg hover:from-indigo-600 hover:to-violet-600 transition-all font-medium whitespace-nowrap"
            >
              下一步：选择挑战角色
            </button>
          </div>
        </div>
      )}

      {/* 步骤2：选择挑战角色 */}
      {step === 'select' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="mb-6">
            <h3 className="text-xl font-bold text-gray-900 mb-2">选择挑战角色</h3>
            <p className="text-gray-600">选择一个或多个市场调研智能体角色对您的项目发起挑战，每个角色将从不同角度提出尖锐问题</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {challengeAgents.map((agent) => (
              <div
                key={agent.id}
                onClick={() => toggleAgent(agent.id)}
                className={`p-6 rounded-xl border-2 cursor-pointer transition-all ${
                  selectedAgents.includes(agent.id)
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-indigo-300'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-lg bg-gradient-to-r ${agent.color} flex items-center justify-center flex-shrink-0`}>
                    <i className={`${agent.icon} text-2xl text-white`}></i>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-bold text-gray-900">{agent.name}</h4>
                      {selectedAgents.includes(agent.id) && (
                        <i className="ri-checkbox-circle-fill text-indigo-600 text-lg"></i>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{agent.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep('info')}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all font-medium whitespace-nowrap"
            >
              上一步
            </button>
            <button
              onClick={startChallenge}
              disabled={selectedAgents.length === 0}
              className="px-8 py-3 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-lg hover:from-indigo-600 hover:to-violet-600 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              开始挑战（已选{selectedAgents.length}个角色）
            </button>
          </div>
        </div>
      )}

      {/* 步骤3：对抗挑战 */}
      {step === 'challenge' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* 顶部状态栏 */}
          <div className="bg-gradient-to-r from-indigo-500 to-violet-500 text-white px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <i className="ri-sword-line text-xl"></i>
                  <span className="font-bold">人机对抗进行中</span>
                </div>
                <div className="h-6 w-px bg-white/30"></div>
                <span className="text-sm">第 {currentRound} / 5 轮</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm">已回答 {messages.filter(m => m.role === 'user').length} 个问题</span>
              </div>
            </div>
          </div>

          {/* 对话区域 */}
          <div className="h-[500px] overflow-y-auto p-6 space-y-4 bg-gray-50">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'ai' && (
                  <div className="flex gap-3 max-w-[80%]">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 flex items-center justify-center flex-shrink-0">
                      <i className="ri-robot-line text-white text-lg"></i>
                    </div>
                    <div>
                      {message.agentName && (
                        <div className="mb-1">
                          <span className="text-xs font-bold text-indigo-600">{message.agentName}</span>
                          <span className="text-xs text-gray-500 ml-2">{message.agentRole}</span>
                        </div>
                      )}
                      <div className="bg-white rounded-lg rounded-tl-none px-4 py-3 shadow-sm border border-gray-200">
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{message.content}</p>
                      </div>
                    </div>
                  </div>
                )}
                {message.role === 'user' && (
                  <div className="flex gap-3 max-w-[80%]">
                    <div className="bg-gradient-to-r from-indigo-500 to-violet-500 rounded-lg rounded-tr-none px-4 py-3 shadow-sm">
                      <p className="text-sm text-white whitespace-pre-wrap">{message.content}</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                      <i className="ri-user-line text-gray-600 text-lg"></i>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {isProcessing && (
              <div className="flex justify-start">
                <div className="flex gap-3 max-w-[80%]">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 flex items-center justify-center flex-shrink-0">
                    <i className="ri-robot-line text-white text-lg"></i>
                  </div>
                  <div className="bg-white rounded-lg rounded-tl-none px-4 py-3 shadow-sm border border-gray-200">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 输入区域 */}
          <div className="border-t border-gray-200 p-4 bg-white">
            <div className="flex gap-3">
              <input
                type="text"
                value={currentInput}
                onChange={(e) => setCurrentInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !isProcessing && handleSendAnswer()}
                placeholder="输入您的回答..."
                disabled={isProcessing || currentRound > 5}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <button
                onClick={handleSendAnswer}
                disabled={!currentInput.trim() || isProcessing || currentRound > 5}
                className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-lg hover:from-indigo-600 hover:to-violet-600 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {isProcessing ? '处理中...' : '发送回答'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 步骤4：压力测试报告 */}
      {step === 'report' && report && (
        <div className="space-y-6">
          {/* 总体评分 */}
          <div className="bg-gradient-to-r from-indigo-500 to-violet-500 rounded-xl shadow-lg p-8 text-white">
            <div className="text-center">
              <h3 className="text-2xl font-bold mb-4">压力测试完成</h3>
              <div className="inline-flex items-center justify-center w-32 h-32 rounded-full bg-white/20 backdrop-blur-sm mb-4">
                <div className="text-5xl font-bold">{report.totalScore}</div>
              </div>
              <p className="text-lg opacity-90">综合评分</p>
            </div>
          </div>

          {/* 优势分析 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-rose-500 rounded-full flex items-center justify-center text-white">
                <i className="ri-robot-line text-xl"></i>
              </div>
              <div>
                <h4 className="text-base font-bold text-gray-900">市场调研智能体</h4>
                <p className="text-xs text-gray-500">模拟真实市场环境</p>
              </div>
            </div>
            <ul className="space-y-3">
              {report.strengths.map((strength, index) => (
                <li key={index} className="flex items-start gap-3">
                  <i className="ri-checkbox-circle-fill text-emerald-500 text-lg mt-0.5"></i>
                  <span className="text-gray-700">{strength}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 待改进点 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white">
                <i className="ri-user-line text-xl"></i>
              </div>
              <div>
                <h4 className="text-base font-bold text-gray-900">学生团队</h4>
                <p className="text-xs text-gray-500">应对市场调研智能体挑战</p>
              </div>
            </div>
            <ul className="space-y-3">
              {report.weaknesses.map((weakness, index) => (
                <li key={index} className="flex items-start gap-3">
                  <i className="ri-error-warning-fill text-amber-500 text-lg mt-0.5"></i>
                  <span className="text-gray-700">{weakness}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* AI优化建议 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 flex items-center justify-center">
                <i className="ri-lightbulb-line text-white text-xl"></i>
              </div>
              <h4 className="text-lg font-bold text-gray-900">AI优化建议</h4>
            </div>
            <ul className="space-y-3">
              {report.suggestions.map((suggestion, index) => (
                <li key={index} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-indigo-600">{index + 1}</span>
                  </div>
                  <span className="text-gray-700">{suggestion}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center justify-between">
            <button
              onClick={resetChallenge}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all font-medium whitespace-nowrap"
            >
              重新开始挑战
            </button>
            <button
              onClick={handleSaveReport}
              disabled={isProcessing}
              className="px-8 py-3 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-lg hover:from-indigo-600 hover:to-violet-600 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {isProcessing ? '保存中...' : '保存报告'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}