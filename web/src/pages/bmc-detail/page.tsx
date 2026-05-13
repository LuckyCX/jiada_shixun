import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

interface Message {
  id: string;
  role: 'ai' | 'user';
  content: string;
  timestamp: Date;
}

interface CanvasCard {
  id: string;
  title: string;
  content: string[];
  color: string;
  bgColor: string;
}

// 9个画布卡片定义
const CANVAS_CARDS: CanvasCard[] = [
  { id: 'partners', title: '合作伙伴', content: [], color: 'text-orange-700', bgColor: 'bg-orange-50 border-orange-200' },
  { id: 'activities', title: '关键业务', content: [], color: 'text-yellow-700', bgColor: 'bg-yellow-50 border-yellow-200' },
  { id: 'value', title: '价值主张', content: [], color: 'text-teal-700', bgColor: 'bg-teal-50 border-teal-200' },
  { id: 'relationship', title: '客户关系', content: [], color: 'text-green-700', bgColor: 'bg-green-50 border-green-200' },
  { id: 'customer', title: '客户细分', content: [], color: 'text-emerald-700', bgColor: 'bg-emerald-50 border-emerald-200' },
  { id: 'resources', title: '核心资源', content: [], color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200' },
  { id: 'channels', title: '渠道通路', content: [], color: 'text-cyan-700', bgColor: 'bg-cyan-50 border-cyan-200' },
  { id: 'cost', title: '成本结构', content: [], color: 'text-rose-700', bgColor: 'bg-rose-50 border-rose-200' },
  { id: 'revenue', title: '收入来源', content: [], color: 'text-violet-700', bgColor: 'bg-violet-50 border-violet-200' },
];

// 每个卡片对应的引导问题
const CARD_QUESTIONS: Record<string, string> = {
  partners: '你认为这个项目需要哪些关键合作伙伴？他们能为你提供什么资源或支持？',
  activities: '为了实现你的价值主张，你需要开展哪些最核心的业务活动？',
  value: '你的产品或服务能为客户解决什么核心问题？相比竞争对手，你的独特价值是什么？',
  relationship: '你打算如何获取新客户，并维护与客户的长期关系？',
  customer: '你的目标客户是谁？请具体描述他们的特征、需求和痛点。',
  resources: '实现你的商业模式需要哪些关键资源（人力、技术、资金、品牌等）？',
  channels: '你打算通过哪些渠道接触客户、传递价值、完成销售？',
  cost: '你的商业模式中主要有哪些成本支出？哪些是固定成本，哪些是变动成本？',
  revenue: '你的项目通过哪些方式获得收入？客户愿意为什么付费？',
};

// 根据用户回答模拟生成卡片内容
const generateCardContent = (cardId: string, userAnswer: string): string[] => {
  const answer = userAnswer.trim();
  const sentences = answer.split(/[，。！？、；\n]/).map(s => s.trim()).filter(s => s.length > 3);

  const contentMap: Record<string, string[]> = {
    partners: [
      sentences[0] || '核心供应商与资源提供方',
      sentences[1] || '技术与平台合作伙伴',
      sentences[2] || '渠道与推广合作方',
    ],
    activities: [
      sentences[0] || '产品研发与迭代',
      sentences[1] || '运营管理与服务交付',
      sentences[2] || '市场推广与用户增长',
    ],
    value: [
      sentences[0] || '解决用户核心痛点',
      sentences[1] || '提供差异化竞争优势',
      sentences[2] || '持续创造用户价值',
    ],
    relationship: [
      sentences[0] || '个性化服务与会员体系',
      sentences[1] || '社区运营与用户互动',
      sentences[2] || '反馈机制与持续改进',
    ],
    customer: [
      sentences[0] || '核心目标用户群体',
      sentences[1] || '用户主要需求与痛点',
      sentences[2] || '用户行为与消费特征',
    ],
    resources: [
      sentences[0] || '核心技术与知识产权',
      sentences[1] || '人才团队与组织能力',
      sentences[2] || '资金与基础设施',
    ],
    channels: [
      sentences[0] || '线上数字化渠道',
      sentences[1] || '线下推广与合作渠道',
      sentences[2] || '口碑与社交传播',
    ],
    cost: [
      sentences[0] || '人员薪酬与运营成本',
      sentences[1] || '技术开发与维护费用',
      sentences[2] || '市场推广与获客成本',
    ],
    revenue: [
      sentences[0] || '核心产品/服务收费',
      sentences[1] || '增值服务与会员收入',
      sentences[2] || '平台佣金与广告收入',
    ],
  };

  return contentMap[cardId] || sentences.slice(0, 3);
};

export default function BMCDetailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const cardTitle = searchParams.get('card') || '商业模式';

  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isStarted, setIsStarted] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [isAiTyping, setIsAiTyping] = useState(false);

  // 9个卡片状态
  const [canvasCards, setCanvasCards] = useState<CanvasCard[]>(
    CANVAS_CARDS.map(c => ({ ...c, content: [] }))
  );
  const [highlightedCardId, setHighlightedCardId] = useState<string | null>(null);

  // 当前问答进度：0~8 对应9个卡片
  const [currentStep, setCurrentStep] = useState(0);
  // 等待用户回答
  const [waitingForAnswer, setWaitingForAnswer] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const addAiMessage = (content: string) => {
    const msg: Message = {
      id: Date.now().toString() + Math.random(),
      role: 'ai',
      content,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, msg]);
  };

  const addUserMessage = (content: string) => {
    const msg: Message = {
      id: Date.now().toString() + Math.random(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, msg]);
  };

  const highlightCard = (cardId: string) => {
    setHighlightedCardId(cardId);
    setTimeout(() => setHighlightedCardId(null), 3000);
  };

  // 开始讨论：先输出3道题目供学生选择
  const handleStartDiscussion = () => {
    setIsStarted(true);
    setIsAiTyping(true);

    setTimeout(() => {
      setIsAiTyping(false);
      addAiMessage(
        `你好！我们将围绕"${cardTitle}"展开深度讨论，通过9轮问答，逐步填充完整的商业模式画布。\n\n在开始之前，请先选择一个你最感兴趣的切入问题：`
      );
    }, 800);
  };

  // 学生选择了初始问题后，正式开始第一轮
  const handleSelectInitialQuestion = (questionIndex: number) => {
    const questionTexts = [
      `1. 你的项目最核心的价值是什么？它解决了什么问题？`,
      `2. 你的目标客户是谁？他们有什么特征？`,
      `3. 你打算如何赚钱？收入来源是什么？`,
    ];

    addUserMessage(`[选择了问题] ${questionTexts[questionIndex]}`);

    setIsAiTyping(true);
    setTimeout(() => {
      setIsAiTyping(false);
      // 根据选择决定从哪个卡片开始
      const startCardMap = [2, 4, 8]; // 价值主张、客户细分、收入来源
      const startStep = startCardMap[questionIndex];
      setCurrentStep(startStep);

      const card = CANVAS_CARDS[startStep];
      addAiMessage(
        `很好的选择！让我们从【${card.title}】开始。\n\n${CARD_QUESTIONS[card.id]}`
      );
      setWaitingForAnswer(true);
    }, 1000);
  };

  // 学生发送回答
  const handleSendAnswer = () => {
    if (!userInput.trim() || !waitingForAnswer || isAiTyping) return;

    const answer = userInput.trim();
    setUserInput('');
    setWaitingForAnswer(false);
    addUserMessage(answer);

    const card = CANVAS_CARDS[currentStep];

    // 生成卡片内容
    const newContent = generateCardContent(card.id, answer);

    // 更新画布卡片
    setCanvasCards(prev =>
      prev.map(c =>
        c.id === card.id ? { ...c, content: newContent } : c
      )
    );
    highlightCard(card.id);

    setIsAiTyping(true);

    // 计算下一步
    const nextStep = getNextStep(currentStep);

    setTimeout(() => {
      setIsAiTyping(false);

      if (nextStep === -1) {
        // 全部完成
        addAiMessage(
          `太棒了！🎉 你已经完成了所有9个模块的讨论！\n\n右侧的商业模式画布已经全部填充完毕。你可以查看完整的画布内容，也可以返回继续完善其他部分。`
        );
        setIsFinished(true);
      } else {
        const nextCard = CANVAS_CARDS[nextStep];
        const filledCount = currentStep + 1;
        addAiMessage(
          `很好！【${card.title}】模块已填充完成 ✓\n\n（${filledCount}/9 已完成）\n\n接下来我们来探讨【${nextCard.title}】：\n\n${CARD_QUESTIONS[nextCard.id]}`
        );
        setCurrentStep(nextStep);
        setWaitingForAnswer(true);
      }
    }, 1200);
  };

  // 获取下一个未填充的卡片索引，-1表示全部完成
  const getNextStep = (current: number): number => {
    // 按顺序找下一个未填充的卡片
    for (let i = 0; i < CANVAS_CARDS.length; i++) {
      const idx = (current + 1 + i) % CANVAS_CARDS.length;
      // 检查该卡片是否已填充
      const card = canvasCards.find(c => c.id === CANVAS_CARDS[idx].id);
      if (!card || card.content.length === 0) {
        return idx;
      }
    }
    return -1;
  };

  const filledCount = canvasCards.filter(c => c.content.length > 0).length;
  const progressPercent = Math.round((filledCount / 9) * 100);

  // 判断是否显示初始问题选择（已开始但还没有waitingForAnswer且消息数<=2）
  const showInitialQuestions =
    isStarted &&
    !waitingForAnswer &&
    !isFinished &&
    !isAiTyping &&
    messages.length > 0 &&
    messages.length <= 2 &&
    currentStep === 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/student-center?tab=module-business')}
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <i className="ri-arrow-left-line text-xl text-gray-700"></i>
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{cardTitle} · 深度讨论</h1>
              <p className="text-sm text-gray-500">通过问答逐步填充完整商业模式画布</p>
            </div>
          </div>
          {/* 进度条 */}
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600">
              <span className="font-bold text-teal-600">{filledCount}</span>
              <span className="text-gray-400"> / 9 卡片已填充</span>
            </div>
            <div className="w-40 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full transition-all duration-700"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
            <span className="text-sm font-bold text-teal-600">{progressPercent}%</span>
          </div>
        </div>
      </header>

      <div className="h-[calc(100vh-73px)] flex">
        {/* ===== 左侧：对话区 ===== */}
        <div className="w-2/5 bg-white border-r border-gray-200 flex flex-col">
          {/* 顶部标题 */}
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-teal-50 to-emerald-50">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900">{cardTitle}</h3>
                <p className="text-xs text-gray-500 mt-0.5">AI引导式问答 · 逐步填充画布</p>
              </div>
              {!isStarted && (
                <button
                  onClick={handleStartDiscussion}
                  className="px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap bg-gradient-to-r from-teal-500 to-emerald-500 text-white hover:shadow-lg transition-all cursor-pointer"
                >
                  <i className="ri-chat-3-line mr-1.5"></i>
                  开始讨论
                </button>
              )}
              {isStarted && !isFinished && (
                <div className="flex items-center gap-2 text-xs text-teal-600 bg-teal-50 px-3 py-1.5 rounded-full border border-teal-200">
                  <div className="w-2 h-2 bg-teal-500 rounded-full animate-pulse"></div>
                  讨论进行中
                </div>
              )}
              {isFinished && (
                <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
                  <i className="ri-checkbox-circle-fill"></i>
                  讨论完成
                </div>
              )}
            </div>
          </div>

          {/* 消息列表 */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-gradient-to-br from-teal-100 to-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="ri-chat-3-line text-3xl text-teal-600"></i>
                </div>
                <p className="text-sm text-gray-500 leading-relaxed">
                  点击"开始讨论"，AI将引导你<br />通过9轮问答填充完整画布
                </p>
              </div>
            )}

            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'ai' && (
                  <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-emerald-500 rounded-full flex items-center justify-center flex-shrink-0 mr-2 mt-1">
                    <i className="ri-robot-line text-white text-sm"></i>
                  </div>
                )}
                <div
                  className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-line ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-tr-sm'
                      : 'bg-gray-100 text-gray-900 rounded-tl-sm'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* AI 正在输入 */}
            {isAiTyping && (
              <div className="flex justify-start">
                <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-emerald-500 rounded-full flex items-center justify-center flex-shrink-0 mr-2 mt-1">
                  <i className="ri-robot-line text-white text-sm"></i>
                </div>
                <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-tl-sm">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}

            {/* 初始问题选择 */}
            {showInitialQuestions && (
              <div className="space-y-2 mt-2">
                {[
                  '你的项目最核心的价值是什么？它解决了什么问题？',
                  '你的目标客户是谁？他们有什么特征？',
                  '你打算如何赚钱？收入来源是什么？',
                ].map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelectInitialQuestion(i)}
                    className="w-full text-left p-3.5 bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200 rounded-xl hover:shadow-md hover:border-teal-400 transition-all cursor-pointer group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 bg-teal-500 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
                        {i + 1}
                      </div>
                      <p className="text-sm text-gray-800 leading-relaxed group-hover:text-teal-700 transition-colors">
                        {q}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* 输入区 */}
          {waitingForAnswer && !isFinished && (
            <div className="p-4 border-t border-gray-200 bg-white">
              {/* 当前进度提示 */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full transition-all"
                    style={{ width: `${progressPercent}%` }}
                  ></div>
                </div>
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  正在填充：<span className="font-bold text-teal-600">{CANVAS_CARDS[currentStep]?.title}</span>
                </span>
              </div>
              <div className="flex items-end gap-2">
                <textarea
                  value={userInput}
                  onChange={e => setUserInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendAnswer();
                    }
                  }}
                  placeholder="输入你的回答..."
                  rows={3}
                  className="flex-1 px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                />
                <button
                  onClick={handleSendAnswer}
                  disabled={!userInput.trim()}
                  className="px-5 py-3 bg-teal-500 text-white text-sm font-medium rounded-xl hover:bg-teal-600 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed h-[52px]"
                >
                  <i className="ri-send-plane-fill text-base"></i>
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">Enter 发送 · Shift+Enter 换行</p>
            </div>
          )}

          {isFinished && (
            <div className="p-4 border-t border-gray-200 bg-emerald-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <i className="ri-checkbox-circle-fill text-white text-lg"></i>
                </div>
                <div>
                  <p className="text-sm font-bold text-emerald-800">画布填充完成！</p>
                  <p className="text-xs text-emerald-600">所有9个模块已完成讨论</p>
                </div>
                <button
                  onClick={() => navigate('/student-center?tab=module-business')}
                  className="ml-auto px-4 py-2 bg-emerald-500 text-white text-sm font-medium rounded-lg hover:bg-emerald-600 transition-colors whitespace-nowrap cursor-pointer"
                >
                  返回画布
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ===== 右侧：画布 ===== */}
        <div className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-5xl mx-auto">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">画布</h2>
                <p className="text-sm text-gray-500 mt-1">根据问答内容实时生成 · {filledCount}/9 已填充</p>
              </div>
              {filledCount > 0 && (
                <div className="flex items-center gap-2 text-sm text-teal-600 bg-teal-50 px-4 py-2 rounded-full border border-teal-200">
                  <i className="ri-refresh-line animate-spin" style={{ animationDuration: '2s' }}></i>
                  实时同步中
                </div>
              )}
            </div>

            {/* 9宫格画布 */}
            <div className="grid grid-cols-3 gap-4">
              {canvasCards.map((card, index) => {
                const isHighlighted = highlightedCardId === card.id;
                const isFilled = card.content.length > 0;
                const isCurrentTarget = waitingForAnswer && CANVAS_CARDS[currentStep]?.id === card.id;

                return (
                  <div
                    key={card.id}
                    className={`rounded-xl p-5 min-h-[180px] transition-all duration-500 border ${
                      isHighlighted
                        ? 'ring-4 ring-teal-500 shadow-2xl scale-105 ' + card.bgColor
                        : isCurrentTarget
                        ? 'ring-2 ring-teal-300 shadow-lg ' + card.bgColor
                        : isFilled
                        ? card.bgColor
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 font-medium">#{index + 1}</span>
                        <h3 className={`text-sm font-bold ${isFilled ? card.color : 'text-gray-500'}`}>
                          {card.title}
                        </h3>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {isCurrentTarget && !isFilled && (
                          <div className="flex items-center gap-1 text-xs text-teal-600 bg-teal-100 px-2 py-0.5 rounded-full">
                            <div className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-pulse"></div>
                            填充中
                          </div>
                        )}
                        {isFilled && (
                          <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                            <i className="ri-check-line text-white text-xs"></i>
                          </div>
                        )}
                        {isHighlighted && (
                          <div className="w-2 h-2 bg-teal-500 rounded-full animate-ping"></div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      {card.content.length === 0 ? (
                        <p className="text-xs text-gray-300 italic">
                          {isCurrentTarget ? '等待你的回答...' : '待填充'}
                        </p>
                      ) : (
                        card.content.map((item, i) => (
                          <div
                            key={i}
                            className={`text-xs leading-relaxed px-3 py-2 rounded-lg ${
                              isFilled ? 'bg-white/70 ' + card.color : 'bg-gray-50 text-gray-600'
                            }`}
                          >
                            • {item}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 完成提示 */}
            {isFinished && (
              <div className="mt-8 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center flex-shrink-0">
                    <i className="ri-trophy-line text-2xl text-white"></i>
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-emerald-900 mb-1">🎉 商业模式画布填充完成！</h4>
                    <p className="text-sm text-emerald-700">
                      你已通过9轮深度问答，完整构建了商业模式画布的所有模块。
                      返回主页面可查看完整画布并进行进一步分析。
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 使用提示（未开始时显示） */}
            {!isStarted && (
              <div className="mt-8 bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-teal-500 rounded-xl flex items-center justify-center flex-shrink-0">
                    <i className="ri-lightbulb-flash-line text-2xl text-white"></i>
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-teal-900 mb-2">如何使用</h4>
                    <ul className="text-sm text-teal-700 space-y-1.5">
                      <li>• 点击左侧"开始讨论"，选择一个切入问题</li>
                      <li>• AI将依次引导你回答9个模块的问题</li>
                      <li>• 每次回答后，对应卡片内容自动填充到右侧画布</li>
                      <li>• 完成全部9轮问答后，画布填充完毕</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
