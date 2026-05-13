import { Link } from 'react-router-dom';
import { useState } from 'react';

interface Message {
  id: number;
  agent: 'user' | 'picky-user' | 'competitor' | 'investor';
  content: string;
  timestamp: string;
  suggestions?: string[];
  severity?: 'critical' | 'warning' | 'info';
}

interface ValidationRecord {
  id: number;
  round: number;
  agent: string;
  question: string;
  userResponse: string;
  status: 'fixed' | 'pending' | 'ignored';
  timestamp: string;
}

export default function AIValidation() {
  const [activeTab, setActiveTab] = useState<'arena' | 'records' | 'insights'>('arena');
  const [selectedAgent, setSelectedAgent] = useState<'all' | 'picky-user' | 'competitor' | 'investor'>('all');
  const [isDebating, setIsDebating] = useState(false);
  const [currentRound, setCurrentRound] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [projectPlan, setProjectPlan] = useState('');
  const [showPlanModal, setShowPlanModal] = useState(false);

  const agents = [
    {
      id: 'picky-user',
      name: '挑剔用户',
      avatar: 'https://readdy.ai/api/search-image?query=A%203d%20character%20avatar%20wearing%20red%20cap%20looking%20skeptical%20and%20critical%2C%20arms%20crossed%2C%20frowning%20expression%2C%20blind%20box%20toy%20style%2C%20c4d%20rendering%2C%20blender%2C%20clay%20material%2C%20soft%20studio%20lighting%2C%20minimalism%2C%20clean%20solid%20red%20background%2C%20high%20quality%2C%208k&width=400&height=400&seq=ai-validation-picky-user&orientation=squarish',
      color: 'from-red-500 to-rose-500',
      borderColor: 'border-red-200',
      bgColor: 'bg-red-50',
      textColor: 'text-red-700',
      role: '用户体验质疑者',
      description: '从真实用户角度挑战产品价值，质疑用户需求的真实性'
    },
    {
      id: 'competitor',
      name: '竞争对手',
      avatar: 'https://readdy.ai/api/search-image?query=A%203d%20character%20avatar%20wearing%20black%20suit%20and%20dark%20sunglasses%2C%20confident%20and%20aggressive%20pose%2C%20holding%20a%20briefcase%2C%20business%20warrior%20style%2C%20blind%20box%20toy%20style%2C%20c4d%20rendering%2C%20blender%2C%20clay%20material%2C%20soft%20studio%20lighting%2C%20minimalism%2C%20clean%20solid%20dark%20background%2C%20high%20quality%2C%208k&width=400&height=400&seq=ai-validation-competitor&orientation=squarish',
      color: 'from-gray-700 to-gray-900',
      borderColor: 'border-gray-300',
      bgColor: 'bg-gray-50',
      textColor: 'text-gray-700',
      role: '市场竞争分析师',
      description: '从竞争角度攻击商业模式，指出市场壁垒和竞争劣势'
    },
    {
      id: 'investor',
      name: '投资人',
      avatar: 'https://readdy.ai/api/search-image?query=A%203d%20character%20avatar%20wearing%20blue%20business%20suit%20and%20gold%20glasses%2C%20serious%20and%20analytical%20expression%2C%20holding%20financial%20documents%2C%20professional%20investor%20style%2C%20blind%20box%20toy%20style%2C%20c4d%20rendering%2C%20blender%2C%20clay%20material%2C%20soft%20studio%20lighting%2C%20minimalism%2C%20clean%20solid%20blue%20background%2C%20high%20quality%2C%208k&width=400&height=400&seq=ai-validation-investor&orientation=squarish',
      color: 'from-blue-600 to-indigo-600',
      borderColor: 'border-blue-200',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-700',
      role: '财务逻辑审查官',
      description: '从投资回报角度质疑盈利模式，挑战财务可行性'
    }
  ];

  const debateScripts = [
    {
      agent: 'picky-user',
      content: '我看了你们的产品方案，说实话我不太理解为什么我要用你们的产品。市面上已经有那么多类似的解决方案了，你们的核心差异化在哪里？',
      suggestions: ['明确核心差异化价值', '提供具体使用场景', '展示用户痛点解决方案'],
      severity: 'critical' as const
    },
    {
      agent: 'competitor',
      content: '你们的商业模式我很熟悉，因为我们三年前就在做了。你们打算如何应对我们已经建立的品牌优势和用户粘性？你们的护城河在哪里？',
      suggestions: ['分析竞争壁垒', '制定差异化策略', '寻找细分市场机会'],
      severity: 'critical' as const
    },
    {
      agent: 'investor',
      content: '你们的财务模型看起来过于乐观了。第一年就能盈利？用户获取成本、留存率、客单价这些关键指标的假设依据是什么？',
      suggestions: ['提供数据支撑', '调整财务预测', '制定风险应对方案'],
      severity: 'warning' as const
    },
    {
      agent: 'picky-user',
      content: '你们说要解决用户的痛点，但我作为目标用户，我觉得这个痛点并不是那么痛。你们有做过真实的用户调研吗？有多少用户愿意为此付费？',
      suggestions: ['开展用户调研', '验证需求真实性', '调整价值主张'],
      severity: 'critical' as const
    },
    {
      agent: 'competitor',
      content: '你们的定价策略有问题。如果你们定价太低，我们可以打价格战把你们耗死；如果定价太高，用户凭什么选择一个新品牌？',
      suggestions: ['重新评估定价策略', '建立品牌差异化', '寻找价值锚点'],
      severity: 'warning' as const
    },
    {
      agent: 'investor',
      content: '你们团队的背景我看了，技术很强，但是缺乏商业运营经验。你们打算如何弥补这个短板？市场推广、渠道建设这些你们有计划吗？',
      suggestions: ['补充团队能力', '寻找导师/顾问', '制定详细运营计划'],
      severity: 'warning' as const
    },
    {
      agent: 'picky-user',
      content: '你们的产品功能太复杂了，我需要学习成本。为什么不能做得更简单一点？我只想解决一个具体问题，不需要那么多花里胡哨的功能。',
      suggestions: ['简化产品功能', '聚焦核心价值', '优化用户体验'],
      severity: 'info' as const
    },
    {
      agent: 'competitor',
      content: '你们的增长策略依赖于社交媒体营销，但这个渠道的获客成本越来越高，而且用户质量参差不齐。你们有备选方案吗？',
      suggestions: ['多元化获客渠道', '优化营销ROI', '建立私域流量'],
      severity: 'warning' as const
    },
    {
      agent: 'investor',
      content: '最后一个问题：如果这个项目失败了，你们认为最可能的原因是什么？你们有做过失败预案吗？',
      suggestions: ['识别关键风险', '制定应对措施', '设置里程碑检查点'],
      severity: 'info' as const
    }
  ];

  const startDebate = () => {
    if (!projectPlan.trim()) {
      setShowPlanModal(true);
      return;
    }

    setIsDebating(true);
    setCurrentRound(0);
    setMessages([
      {
        id: Date.now(),
        agent: 'user',
        content: '我已经准备好了，请开始对我的商业计划进行逻辑验证！',
        timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      }
    ]);

    // 开始AI对抗
    let round = 0;
    const interval = setInterval(() => {
      if (round < debateScripts.length) {
        const script = debateScripts[round];
        const agent = agents.find(a => a.id === script.agent)!;
        
        setMessages(prev => [...prev, {
          id: Date.now() + round,
          agent: script.agent as any,
          content: script.content,
          timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
          suggestions: script.suggestions,
          severity: script.severity
        }]);

        setCurrentRound(round + 1);
        round++;
      } else {
        clearInterval(interval);
        setIsDebating(false);
        
        // 添加总结消息
        setTimeout(() => {
          setMessages(prev => [...prev, {
            id: Date.now() + 999,
            agent: 'investor',
            content: '对抗验证完成！我们从用户、竞争、投资三个维度对你的商业计划进行了高强度的逻辑攻击。请认真思考这些问题，修补逻辑漏洞，优化你的商业模式。记住：在真实市场中，这些挑战会更加严峻。',
            timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
            severity: 'info'
          }]);
        }, 2000);
      }
    }, 4000);
  };

  const handleSendMessage = () => {
    if (!userInput.trim()) return;

    setMessages(prev => [...prev, {
      id: Date.now(),
      agent: 'user',
      content: userInput,
      timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    }]);

    setUserInput('');

    // 模拟AI回复
    setTimeout(() => {
      const randomAgent = agents[Math.floor(Math.random() * agents.length)];
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        agent: randomAgent.id as any,
        content: '这是一个很好的回应。但是，你需要提供更多的数据支撑和具体的执行计划。请继续完善你的方案。',
        timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        severity: 'info'
      }]);
    }, 1500);
  };

  const validationRecords: ValidationRecord[] = [
    {
      id: 1,
      round: 1,
      agent: '挑剔用户',
      question: '核心差异化价值不明确',
      userResponse: '已补充：15分钟必达承诺 + 智能路径优化算法',
      status: 'fixed',
      timestamp: '2024-01-15 14:30'
    },
    {
      id: 2,
      round: 2,
      agent: '竞争对手',
      question: '缺乏竞争壁垒分析',
      userResponse: '已添加：校园独家合作协议 + 技术专利申请',
      status: 'fixed',
      timestamp: '2024-01-15 14:45'
    },
    {
      id: 3,
      round: 3,
      agent: '投资人',
      question: '财务预测过于乐观',
      userResponse: '已调整：延长盈亏平衡周期至12个月',
      status: 'fixed',
      timestamp: '2024-01-15 15:00'
    },
    {
      id: 4,
      round: 4,
      agent: '挑剔用户',
      question: '用户调研数据不足',
      userResponse: '计划下周开展200人问卷调研',
      status: 'pending',
      timestamp: '2024-01-15 15:15'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-3 cursor-pointer">
              <img src="https://public.readdy.ai/ai/img_res/a45fb981-255c-43bf-a2cd-2de142ce7a9c.png" alt="Logo" className="h-10 w-10 object-contain" />
              <span className="text-xl font-bold text-gray-900">嘉兴大学创业实训平台</span>
            </Link>
            <i className="ri-arrow-right-s-line text-gray-400"></i>
            <span className="text-sm text-gray-600">AI对抗验证</span>
          </div>
          <button className="px-5 py-2 bg-teal-500 text-white text-sm font-medium rounded-full hover:bg-teal-600 transition-colors whitespace-nowrap cursor-pointer">
            <i className="ri-question-line mr-2"></i>
            AI助手
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Page Title */}
        <div className="mb-12">
          <div className="flex items-center gap-4 mb-4">
            <h1 className="text-4xl font-bold text-gray-900">AI对抗验证系统</h1>
            <span className="px-4 py-1.5 bg-gradient-to-r from-red-500 to-orange-500 text-white text-sm font-bold rounded-full">
              零成本试错
            </span>
          </div>
          <p className="text-lg text-gray-600">人机对抗的逻辑验证，在零资金风险下完成商业逻辑试错</p>
        </div>

        {/* AI Agents Introduction */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {agents.map((agent) => (
            <div key={agent.id} className={`bg-white border-2 ${agent.borderColor} rounded-2xl p-6 hover:shadow-xl transition-all`}>
              <div className="flex flex-col items-center text-center">
                <div className="w-24 h-24 mb-4 rounded-full overflow-hidden">
                  <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{agent.name}</h3>
                <span className={`px-3 py-1 ${agent.bgColor} ${agent.textColor} text-xs font-medium rounded-full mb-3`}>
                  {agent.role}
                </span>
                <p className="text-sm text-gray-600">{agent.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-8">
          <div className="flex border-b border-gray-100">
            <button
              onClick={() => setActiveTab('arena')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'arena' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <i className="ri-sword-line mr-2"></i>
              对抗竞技场
            </button>
            <button
              onClick={() => setActiveTab('records')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'records' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <i className="ri-file-list-3-line mr-2"></i>
              试错记录
            </button>
            <button
              onClick={() => setActiveTab('insights')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'insights' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <i className="ri-lightbulb-flash-line mr-2"></i>
              优化建议
            </button>
          </div>

          <div className="p-8">
            {activeTab === 'arena' && (
              <div className="space-y-6">
                {/* Control Panel */}
                <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 mb-2">对抗验证控制台</h3>
                      <p className="text-sm text-gray-600">
                        {projectPlan ? '商业计划已提交，准备开始对抗验证' : '请先提交你的商业计划，然后开始AI对抗验证'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setShowPlanModal(true)}
                        className="px-5 py-2.5 bg-white border-2 border-gray-300 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <i className="ri-file-text-line mr-2"></i>
                        {projectPlan ? '修改计划' : '提交计划'}
                      </button>
                      <button
                        onClick={startDebate}
                        disabled={isDebating || !projectPlan}
                        className={`px-6 py-2.5 text-white text-sm font-medium rounded-xl transition-colors whitespace-nowrap cursor-pointer ${
                          isDebating || !projectPlan
                            ? 'bg-gray-300 cursor-not-allowed'
                            : 'bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600'
                        }`}
                      >
                        <i className="ri-play-circle-line mr-2"></i>
                        {isDebating ? '对抗进行中...' : '开始对抗'}
                      </button>
                    </div>
                  </div>
                  {isDebating && (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-white rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-red-500 to-orange-500 transition-all duration-500"
                          style={{ width: `${(currentRound / debateScripts.length) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium text-gray-700">
                        {currentRound}/{debateScripts.length}
                      </span>
                    </div>
                  )}
                </div>

                {/* Messages Area */}
                <div className="bg-white border border-gray-200 rounded-xl p-6 min-h-[500px] max-h-[600px] overflow-y-auto">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-12">
                      <div className="w-24 h-24 bg-gradient-to-br from-red-100 to-orange-100 rounded-full flex items-center justify-center mb-6">
                        <i className="ri-sword-line text-4xl text-red-500"></i>
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-3">准备好接受挑战了吗？</h3>
                      <p className="text-sm text-gray-600 max-w-md mb-6">
                        三位AI智能体将从用户、竞争、投资三个维度对你的商业计划发起高强度的逻辑攻击。
                        请做好准备，认真思考每一个问题。
                      </p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <i className="ri-information-line"></i>
                        <span>提示：点击"提交计划"按钮上传你的商业计划书</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((message) => {
                        const agent = agents.find(a => a.id === message.agent);
                        const isUser = message.agent === 'user';

                        return (
                          <div key={message.id} className={`flex gap-4 ${isUser ? 'flex-row-reverse' : ''}`}>
                            {!isUser && agent && (
                              <div className="flex-shrink-0">
                                <div className="w-12 h-12 rounded-full overflow-hidden">
                                  <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover" />
                                </div>
                              </div>
                            )}
                            {isUser && (
                              <div className="flex-shrink-0">
                                <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-emerald-500 rounded-full flex items-center justify-center">
                                  <i className="ri-user-line text-white text-xl"></i>
                                </div>
                              </div>
                            )}
                            <div className={`flex-1 ${isUser ? 'flex justify-end' : ''}`}>
                              <div className={`inline-block max-w-[80%] ${isUser ? 'bg-teal-500 text-white' : agent ? `${agent.bgColor} ${agent.textColor}` : 'bg-gray-100 text-gray-900'} rounded-2xl px-5 py-3`}>
                                {!isUser && agent && (
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="text-sm font-bold">{agent.name}</span>
                                    {message.severity && (
                                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                        message.severity === 'critical' ? 'bg-red-500 text-white' :
                                        message.severity === 'warning' ? 'bg-amber-500 text-white' :
                                        'bg-blue-500 text-white'
                                      }`}>
                                        {message.severity === 'critical' ? '严重' : message.severity === 'warning' ? '警告' : '提示'}
                                      </span>
                                    )}
                                  </div>
                                )}
                                <p className="text-sm leading-relaxed">{message.content}</p>
                                {message.suggestions && message.suggestions.length > 0 && (
                                  <div className="mt-3 pt-3 border-t border-gray-200">
                                    <p className="text-xs font-medium mb-2">💡 优化建议：</p>
                                    <div className="space-y-1">
                                      {message.suggestions.map((suggestion, idx) => (
                                        <div key={idx} className="flex items-start gap-2">
                                          <i className="ri-checkbox-circle-line text-xs mt-0.5"></i>
                                          <span className="text-xs">{suggestion}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                <div className={`text-xs mt-2 ${isUser ? 'text-white/70' : 'opacity-60'}`}>
                                  {message.timestamp}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Input Area */}
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder="输入你的回应或反驳..."
                      className="flex-1 px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      disabled={isDebating}
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={isDebating || !userInput.trim()}
                      className={`px-6 py-3 text-white text-sm font-medium rounded-xl transition-colors whitespace-nowrap cursor-pointer ${
                        isDebating || !userInput.trim()
                          ? 'bg-gray-300 cursor-not-allowed'
                          : 'bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600'
                      }`}
                    >
                      <i className="ri-send-plane-fill"></i>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'records' && (
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">试错记录</h3>
                  <p className="text-sm text-gray-600">记录每一次逻辑漏洞的发现和修补过程，形成完整的优化轨迹</p>
                </div>

                <div className="space-y-4">
                  {validationRecords.map((record) => (
                    <div key={record.id} className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg flex items-center justify-center text-white font-bold">
                            R{record.round}
                          </div>
                          <div>
                            <h4 className="text-base font-bold text-gray-900">{record.question}</h4>
                            <p className="text-xs text-gray-500 mt-1">
                              <i className="ri-user-line mr-1"></i>
                              {record.agent} · {record.timestamp}
                            </p>
                          </div>
                        </div>
                        <span className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap ${
                          record.status === 'fixed' ? 'bg-green-100 text-green-700' :
                          record.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {record.status === 'fixed' ? '✓ 已修复' : record.status === 'pending' ? '⏳ 处理中' : '✗ 已忽略'}
                        </span>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-700">
                          <span className="font-medium text-gray-900">你的回应：</span>
                          {record.userResponse}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <div className="grid md:grid-cols-3 gap-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-gray-900 mb-2">9</div>
                      <div className="text-sm text-gray-600">总挑战次数</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-600 mb-2">3</div>
                      <div className="text-sm text-gray-600">已修复问题</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-amber-600 mb-2">1</div>
                      <div className="text-sm text-gray-600">待处理问题</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'insights' && (
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">AI优化建议</h3>
                  <p className="text-sm text-gray-600">基于对抗验证结果，AI为你生成的系统性优化建议</p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-white border-2 border-red-200 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-rose-500 rounded-xl flex items-center justify-center">
                        <i className="ri-user-heart-line text-white text-xl"></i>
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-gray-900">用户价值维度</h4>
                        <p className="text-xs text-gray-500">来自挑剔用户的建议</p>
                      </div>
                    </div>
                    <ul className="space-y-3">
                      <li className="flex items-start gap-2 text-sm text-gray-700">
                        <i className="ri-arrow-right-s-line text-red-500 mt-0.5"></i>
                        <span>强化核心差异化价值，避免同质化竞争</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm text-gray-700">
                        <i className="ri-arrow-right-s-line text-red-500 mt-0.5"></i>
                        <span>开展深度用户调研，验证需求真实性</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm text-gray-700">
                        <i className="ri-arrow-right-s-line text-red-500 mt-0.5"></i>
                        <span>简化产品功能，聚焦核心使用场景</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm text-gray-700">
                        <i className="ri-arrow-right-s-line text-red-500 mt-0.5"></i>
                        <span>降低用户学习成本，优化首次体验</span>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-white border-2 border-gray-300 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-gray-700 to-gray-900 rounded-xl flex items-center justify-center">
                        <i className="ri-shield-line text-white text-xl"></i>
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-gray-900">竞争壁垒维度</h4>
                        <p className="text-xs text-gray-500">来自竞争对手的建议</p>
                      </div>
                    </div>
                    <ul className="space-y-3">
                      <li className="flex items-start gap-2 text-sm text-gray-700">
                        <i className="ri-arrow-right-s-line text-gray-700 mt-0.5"></i>
                        <span>建立技术或资源护城河，提高竞争门槛</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm text-gray-700">
                        <i className="ri-arrow-right-s-line text-gray-700 mt-0.5"></i>
                        <span>寻找细分市场机会，避开巨头正面竞争</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm text-gray-700">
                        <i className="ri-arrow-right-s-line text-gray-700 mt-0.5"></i>
                        <span>制定差异化定价策略，建立品牌认知</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm text-gray-700">
                        <i className="ri-arrow-right-s-line text-gray-700 mt-0.5"></i>
                        <span>多元化获客渠道，降低单一渠道依赖</span>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-white border-2 border-blue-200 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
                        <i className="ri-money-dollar-circle-line text-white text-xl"></i>
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-gray-900">财务可行性维度</h4>
                        <p className="text-xs text-gray-500">来自投资人的建议</p>
                      </div>
                    </div>
                    <ul className="space-y-3">
                      <li className="flex items-start gap-2 text-sm text-gray-700">
                        <i className="ri-arrow-right-s-line text-blue-600 mt-0.5"></i>
                        <span>调整财务预测，基于真实数据而非假设</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm text-gray-700">
                        <i className="ri-arrow-right-s-line text-blue-600 mt-0.5"></i>
                        <span>优化成本结构，延长资金使用周期</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm text-gray-700">
                        <i className="ri-arrow-right-s-line text-blue-600 mt-0.5"></i>
                        <span>补充团队商业运营能力，寻找导师支持</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm text-gray-700">
                        <i className="ri-arrow-right-s-line text-blue-600 mt-0.5"></i>
                        <span>制定详细的风险应对预案和里程碑</span>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-white border-2 border-green-200 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
                        <i className="ri-lightbulb-flash-line text-white text-xl"></i>
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-gray-900">转型决策建议</h4>
                        <p className="text-xs text-gray-500">综合分析结果</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="bg-green-50 rounded-lg p-4">
                        <p className="text-sm font-medium text-green-900 mb-2">✓ 继续优化当前方向</p>
                        <p className="text-xs text-green-700">
                          你的商业模式基础扎实，主要问题集中在执行细节。建议继续优化，无需大幅调整方向。
                        </p>
                      </div>
                      <div className="bg-amber-50 rounded-lg p-4">
                        <p className="text-sm font-medium text-amber-900 mb-2">⚠ 需要局部调整</p>
                        <p className="text-xs text-amber-700">
                          定价策略和获客渠道存在风险，建议重新评估这两个模块，制定备选方案。
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-teal-500 to-emerald-500 rounded-2xl p-8 text-white">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center">
                      <i className="ri-trophy-line text-3xl"></i>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold mb-2">对抗验证完成度：78%</h3>
                      <p className="text-sm text-white/80">你已经修复了大部分逻辑漏洞，继续加油！</p>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-3 gap-6">
                    <div>
                      <div className="text-sm text-white/80 mb-2">逻辑完整性</div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden">
                          <div className="h-full bg-white rounded-full" style={{ width: '85%' }}></div>
                        </div>
                        <span className="text-sm font-bold">85%</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-white/80 mb-2">竞争力指数</div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden">
                          <div className="h-full bg-white rounded-full" style={{ width: '72%' }}></div>
                        </div>
                        <span className="text-sm font-bold">72%</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-white/80 mb-2">投资吸引力</div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden">
                          <div className="h-full bg-white rounded-full" style={{ width: '68%' }}></div>
                        </div>
                        <span className="text-sm font-bold">68%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Plan Modal */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-gray-900">提交商业计划</h3>
                <button
                  onClick={() => setShowPlanModal(false)}
                  className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                >
                  <i className="ri-close-line text-2xl"></i>
                </button>
              </div>
            </div>
            <div className="p-8">
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-900 mb-3">
                  请简要描述你的商业计划（包括产品、目标用户、商业模式等）
                </label>
                <textarea
                  value={projectPlan}
                  onChange={(e) => setProjectPlan(e.target.value)}
                  rows={12}
                  className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                  placeholder="示例：&#10;&#10;项目名称：校园快速配送平台&#10;&#10;核心产品：15分钟必达的校园外卖配送服务&#10;&#10;目标用户：在校大学生，18-25岁，注重效率和性价比&#10;&#10;商业模式：&#10;- 收入来源：配送费、商家佣金、会员费、广告收入&#10;- 成本结构：配送人员、技术开发、市场推广&#10;- 核心优势：智能路径优化算法、校园独家合作&#10;&#10;市场策略：线上广告+校园地推+KOL合作&#10;&#10;财务预测：首年营收45万，成本30万，净利润15万"
                />
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setShowPlanModal(false);
                    if (projectPlan.trim()) {
                      // 可以在这里添加保存逻辑
                    }
                  }}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white text-sm font-medium rounded-xl hover:from-red-600 hover:to-orange-600 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <i className="ri-check-line mr-2"></i>
                  确认提交
                </button>
                <button
                  onClick={() => setShowPlanModal(false)}
                  className="px-6 py-3 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
