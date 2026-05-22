
import { useState, useEffect, useRef } from 'react';

interface Message {
  id: string;
  hat: 'white' | 'red' | 'black' | 'yellow' | 'green' | 'blue';
  content: string;
  timestamp: Date;
  status?: 'adopted' | 'ignored';
  targetModule?: string;
}

interface CanvasModule {
  id: string;
  title: string;
  content: string;
  updatedBy?: string;
  isHighlighted?: boolean;
}

const hatConfig = {
  white: {
    name: '白帽 - 数据分析师',
    color: 'bg-gray-100',
    textColor: 'text-gray-900',
    borderColor: 'border-gray-300',
    icon: 'ri-bar-chart-line',
    avatar:
      'https://readdy.ai/api/search-image?query=A%20cute%203d%20robot%20character%20wearing%20a%20white%20futuristic%20cap%20wearing%20smart%20glasses%20holding%20a%20holographic%20data%20chart%20neutral%20expression%20calm%20pose%20white%20and%20light%20grey%20color%20palette%20tech%20vibe%203d%20character%20avatar%20blind%20box%20toy%20style%20c4d%20rendering%20blender%20clay%20material%20soft%20studio%20lighting%20minimalism%20clean%20solid%20background%20high%20quality&width=200&height=200&seq=war-room-white-hat&orientation=squarish',
    personality: '客观、冷静、数据驱动',
  },
  red: {
    name: '红帽 - 感性用户',
    color: 'bg-red-100',
    textColor: 'text-red-900',
    borderColor: 'border-red-300',
    icon: 'ri-heart-line',
    avatar:
      'https://readdy.ai/api/search-image?query=A%20cute%203d%20character%20wearing%20a%20red%20baseball%20cap%20hand%20placed%20on%20chest%20passionate%20expression%20warm%20red%20ambient%20lighting%20floating%20heart%20icons%20nearby%20emotional%20and%20energetic%20red%20and%20warm%20tones%203d%20character%20avatar%20blind%20box%20toy%20style%20c4d%20rendering%20blender%20clay%20material%20soft%20studio%20lighting%20minimalism%20clean%20solid%20background%20high%20quality&width=200&height=200&seq=war-room-red-hat&orientation=squarish',
    personality: '热情、直觉、挑剔',
  },
  black: {
    name: '黑帽 - 风控官',
    color: 'bg-gray-900',
    textColor: 'text-white',
    borderColor: 'border-gray-700',
    icon: 'ri-shield-line',
    avatar:
      'https://readdy.ai/api/search-image?query=A%20cool%203d%20character%20wearing%20a%20black%20cap%20and%20dark%20suit%20arms%20crossed%20skeptical%20expression%20stern%20look%20holding%20a%20magnifying%20glass%20or%20a%20shield%20cool%20blue%20rim%20lighting%20dark%20and%20serious%20atmosphere%203d%20character%20avatar%20blind%20box%20toy%20style%20c4d%20rendering%20blender%20clay%20material%20soft%20studio%20lighting%20minimalism%20clean%20solid%20background%20high%20quality&width=200&height=200&seq=war-room-black-hat&orientation=squarish',
    personality: '严肃、批判、寻找漏洞',
  },
  yellow: {
    name: '黄帽 - 天使投资人',
    color: 'bg-yellow-100',
    textColor: 'text-yellow-900',
    borderColor: 'border-yellow-300',
    icon: 'ri-thumb-up-line',
    avatar:
      'https://readdy.ai/api/search-image?query=A%20cheerful%203d%20character%20wearing%20a%20bright%20yellow%20cap%20giving%20a%20thumbs%20up%20big%20smile%20holding%20a%20glowing%20light%20bulb%20or%20a%20gold%20coin%20bright%20sunny%20lighting%20optimistic%20vibe%20yellow%20and%20orange%20tones%203d%20character%20avatar%20blind%20box%20toy%20style%20c4d%20rendering%20blender%20clay%20material%20soft%20studio%20lighting%20minimalism%20clean%20solid%20background%20high%20quality&width=200&height=200&seq=war-room-yellow-hat&orientation=squarish',
    personality: '乐观、寻找价值、阳光',
  },
  green: {
    name: '绿帽 - 产品经理',
    color: 'bg-green-100',
    textColor: 'text-green-900',
    borderColor: 'border-green-300',
    icon: 'ri-lightbulb-line',
    avatar:
      'https://readdy.ai/api/search-image?query=A%20creative%203d%20character%20wearing%20a%20green%20cap%20a%20small%20plant%20sprout%20growing%20from%20the%20top%20of%20the%20hat%20holding%20a%20magic%20wand%20or%20a%20paintbrush%20sparkles%20of%20creativity%20fresh%20green%20color%20palette%20nature%20inspired%203d%20character%20avatar%20blind%20box%20toy%20style%20c4d%20rendering%20blender%20clay%20material%20soft%20studio%20lighting%20minimalism%20clean%20solid%20background%20high%20quality&width=200&height=200&seq=war-room-green-hat&orientation=squarish',
    personality: '创意、生长、解决方案',
  },
  blue: {
    name: '蓝帽 - 主持人',
    color: 'bg-blue-100',
    textColor: 'text-blue-900',
    borderColor: 'border-blue-300',
    icon: 'ri-command-line',
    avatar:
      'https://readdy.ai/api/search-image?query=A%20smart%203d%20character%20wearing%20a%20blue%20cap%20and%20a%20futuristic%20headset%20holding%20a%20clipboard%20or%20a%20conductor%20baton%20confident%20and%20organized%20leader%20vibe%20tech%20blue%20lighting%20cyber%20style%203d%20character%20avatar%20blind%20box%20toy%20style%20c4d%20rendering%20blender%20clay%20material%20soft%20studio%20lighting%20minimalism%20clean%20solid%20background%20high%20quality&width=200&height=200&seq=war-room-blue-hat&orientation=squarish',
    personality: '控制、冷静、全局观',
  },
};

export default function WarRoom() {
  // ----- State -----
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentSpeaker, setCurrentSpeaker] = useState<keyof typeof hatConfig | null>(null);
  const [userInput, setUserInput] = useState('');
  const [canvasModules, setCanvasModules] = useState<CanvasModule[]>([
    { id: 'customer', title: '客户细分', content: '大学生群体，18-25岁，注重效率和性价比' },
    { id: 'value', title: '价值主张', content: '15分钟快速配送，低配送费，智能路径优化' },
    { id: 'channels', title: '渠道通路', content: 'APP、微信小程序、校园推广' },
    { id: 'relationship', title: '客户关系', content: '会员体系、积分奖励、个性化推荐' },
    { id: 'revenue', title: '收入来源', content: '配送费收入、商家佣金、广告收入' },
    { id: 'resources', title: '核心资源', content: '配送团队、技术平台、商家资源' },
    { id: 'activities', title: '关键业务', content: '订单处理、配送管理、平台运营' },
    { id: 'partners', title: '合作伙伴', content: '校园餐厅、便利店、物流公司' },
    { id: 'cost', title: '成本结构', content: '人员成本、技术开发、市场推广' },
  ]);
  const [isDebating, setIsDebating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ----- Helpers -----
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const highlightModule = (moduleId: string) => {
    setCanvasModules((prev) =>
      prev.map((m) => ({ ...m, isHighlighted: m.id === moduleId }))
    );
    // Remove highlight after a short period
    setTimeout(() => {
      setCanvasModules((prev) => prev.map((m) => ({ ...m, isHighlighted: false })));
    }, 3000);
  };

  // ----- Core Logic -----
  const simulateDebate = () => {
    setIsDebating(true);
    const debateSequence = [
      {
        hat: 'blue' as const,
        content: '各位董事会成员，今天我们要全面审视这个校园配送项目的商业模式。让我们从数据开始。',
        delay: 1000,
      },
      {
        hat: 'white' as const,
        content:
          '根据市场调研数据，85%的学生对现有配送服务不满意，平均等待时间45分钟，配送费5-8元。我们的目标是15分钟配送，费用2-3元。',
        delay: 3000,
        targetModule: 'value',
      },
      { hat: 'red' as const, content: '作为用户，我必须说——等外卖等到花儿都谢了的感觉真的很糟糕！如果真能15分钟送到，我愿意成为忠实用户！❤️', delay: 5000 },
      {
        hat: 'black' as const,
        content: '⚠️ 等等，15分钟承诺风险极大。恶劣天气怎么办？高峰期怎么办？一旦无法兑现，用户投诉会摧毁品牌信誉。',
        delay: 7000,
        targetModule: 'value',
      },
      {
        hat: 'yellow' as const,
        content: '👍 但这正是差异化优势！如果能做到，市场潜力巨大。校园场景相对封闭，路径可控，技术上可行。我看到了投资价值！',
        delay: 9000,
      },
      {
        hat: 'green' as const,
        content: '💡 我有个创意：可以设置"弹性承诺"——正常情况15分钟，恶劣天气自动延长至25分钟，并提前告知用户。透明化管理预期。',
        delay: 11000,
        targetModule: 'relationship',
      },
      {
        hat: 'white' as const,
        content: '成本结构分析：配送员时薪15元，每单平均配送时间8分钟，加上等待时间，每小时可完成4-5单。单均人力成本3元。',
        delay: 13000,
        targetModule: 'cost',
      },
      {
        hat: 'black' as const,
        content: '⚠️ 问题来了：配送费只收2-3元，人力成本就3元，这还没算平台运营、技术维护、推广费用。这个模式根本不赚钱！',
        delay: 15000,
        targetModule: 'cost',
      },
      {
        hat: 'yellow' as const,
        content: '别忘了商家佣金！每单抽取15%佣金，平均客单价25元，就是3.75元。加上配送费2.5元，单均收入6.25元。',
        delay: 17000,
        targetModule: 'revenue',
      },
      {
        hat: 'green' as const,
        content:
          '💡 还可以开发会员体系：月卡19.9元无限次免配送费。如果一个用户月均点15次，相当于每单只要1.3元，但我们锁定了用户忠诚度。',
        delay: 19000,
        targetModule: 'revenue',
      },
      {
        hat: 'red' as const,
        content: '会员卡我肯定买！但有个问题——如果商家的菜不好吃，再快也没用。你们怎么保证商家质量？',
        delay: 21000,
      },
      {
        hat: 'blue' as const,
        content: '好问题。我们需要在"合作伙伴"模块增加商家筛选机制和评价体系。',
        delay: 23000,
        targetModule: 'partners',
      },
    ];

    debateSequence.forEach(({ hat, content, delay, targetModule }) => {
      setTimeout(() => {
        setCurrentSpeaker(hat);
        const newMessage: Message = {
          id: Date.now().toString() + Math.random(),
          hat,
          content,
          timestamp: new Date(),
          targetModule,
        };
        setMessages((prev) => [...prev, newMessage]);

        if (targetModule) {
          highlightModule(targetModule);
        }

        // Reset speaker after a short highlight period
        setTimeout(() => setCurrentSpeaker(null), 2000);
      }, delay);
    });

    // End debate flag
    setTimeout(() => setIsDebating(false), 25000);
  };

  const handleAdopt = (messageId: string, targetModule?: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, status: 'adopted' } : m))
    );

    if (!targetModule) return;

    // Use functional update to ensure we read the latest state
    setMessages((msgList) => {
      const msg = msgList.find((m) => m.id === messageId);
      if (!msg) return msgList;

      setCanvasModules((prev) =>
        prev.map((m) =>
          m.id === targetModule
            ? {
                ...m,
                content: `${m.content}\n[新增] ${msg.content}`,
                updatedBy: hatConfig[msg.hat].name,
              }
            : m
        )
      );

      // Trigger a brief highlight animation
      highlightModule(targetModule);
      return msgList;
    });
  };

  const handleIgnore = (messageId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, status: 'ignored' } : m))
    );
  };

  const handleUserMessage = () => {
    if (!userInput.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      hat: 'blue',
      content: `👤 用户: ${userInput}`,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMessage]);
    setUserInput('');
  };

  // ----- Render -----
  return (
    <div className="h-screen flex bg-gray-50">
      {/* Left panel – live debate */}
      <div className="w-2/5 bg-white border-r border-gray-200 flex flex-col">
        {/* Header – avatars */}
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">虚拟董事会</h3>
            <button
              onClick={simulateDebate}
              disabled={isDebating}
              className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-all ${
                isDebating
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white hover:shadow-lg'
              }`}
            >
              {isDebating ? (
                <>
                  <i className="ri-loader-4-line animate-spin mr-2"></i>
                  辩论中...
                </>
              ) : (
                <>
                  <i className="ri-play-line mr-2"></i>
                  开始辩论
                </>
              )}
            </button>
          </div>

          <div className="flex items-center justify-between gap-2">
            {(Object.keys(hatConfig) as Array<keyof typeof hatConfig>).map((hat) => (
              <div
                key={hat}
                className={`relative transition-all duration-500 ${
                  currentSpeaker === hat ? 'scale-125 z-10' : 'scale-100'
                }`}
              >
                <div className="relative">
                  <img
                    src={hatConfig[hat].avatar}
                    alt={hatConfig[hat].name}
                    className={`w-14 h-14 rounded-full object-cover border-2 ${
                      currentSpeaker === hat ? 'border-teal-500' : 'border-gray-200'
                    }`}
                  />
                  {currentSpeaker === hat && (
                    <>
                      <div className="absolute inset-0 rounded-full border-2 border-teal-500 animate-ping"></div>
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
                    </>
                  )}
                </div>
                <div className="text-center mt-1">
                  <div
                    className={`text-xs font-medium ${
                      currentSpeaker === hat ? 'text-teal-600' : 'text-gray-500'
                    }`}
                  >
                    {hatConfig[hat].name.split(' - ')[0]}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 overflow-y-auto py-1 px-6 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="ri-chat-3-line text-3xl text-gray-400"></i>
              </div>
              <p className="text-sm text-gray-500">
                点击"开始辩论"，让AI董事会成员开始讨论
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className="animate-fade-in">
                <div className="flex items-start gap-3">
                  <img
                    src={hatConfig[message.hat].avatar}
                    alt={hatConfig[message.hat].name}
                    className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-gray-900">
                        {hatConfig[message.hat].name}
                      </span>
                      <span className="text-xs text-gray-400">
                        {message.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <div
                      className={`${hatConfig[message.hat].color} ${hatConfig[message.hat].textColor} px-4 py-3 rounded-xl text-sm leading-relaxed`}
                    >
                      {message.content}
                    </div>

                    {/* Action buttons */}
                    {message.targetModule && !message.status && (
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => handleAdopt(message.id, message.targetModule)}
                          className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-lg hover:bg-green-200 transition-colors whitespace-nowrap"
                        >
                          <i className="ri-check-line mr-1"></i>
                          采纳
                        </button>
                        <button
                          onClick={() => handleIgnore(message.id)}
                          className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap"
                        >
                          <i className="ri-close-line mr-1"></i>
                          忽略
                        </button>
                      </div>
                    )}

                    {/* Status indicators */}
                    {message.status === 'adopted' && (
                      <div className="mt-2 text-xs text-green-600 flex items-center gap-1">
                        <i className="ri-check-double-line"></i>
                        已采纳并更新到画布
                      </div>
                    )}
                    {message.status === 'ignored' && (
                      <div className="mt-2 text-xs text-gray-400 flex items-center gap-1">
                        <i className="ri-close-circle-line"></i>
                        已忽略
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="p-4 border-t border-gray-200 bg-white">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleUserMessage()}
              placeholder="@某个帽子，说出你的观点..."
              className="flex-1 px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
            <button
              onClick={handleUserMessage}
              className="px-6 py-3 bg-teal-500 text-white text-sm font-medium rounded-xl hover:bg-teal-600 transition-colors whitespace-nowrap"
            >
              <i className="ri-send-plane-line"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Right panel – canvas */}
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">商业模式画布</h2>
            <p className="text-sm text-gray-600">根据董事会讨论实时更新</p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {canvasModules.map((module) => (
              <div
                key={module.id}
                className={`bg-white rounded-xl p-5 transition-all duration-500 ${
                  module.isHighlighted
                    ? 'ring-4 ring-teal-500 shadow-2xl scale-105 animate-pulse-border'
                    : 'border border-gray-200 hover:shadow-lg'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-900">{module.title}</h3>
                  {module.isHighlighted && (
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-teal-500 rounded-full animate-ping"></div>
                      <div className="w-2 h-2 bg-teal-500 rounded-full"></div>
                    </div>
                  )}
                </div>
                <div className="text-xs text-gray-700 leading-relaxed whitespace-pre-line">
                  {module.content}
                </div>
                {module.updatedBy && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-2 text-xs text-teal-600">
                      <i className="ri-edit-line"></i>
                      <span>Updated by {module.updatedBy}</span>
                    </div>
                  </div>
                )}
                {module.content && module.content.trim().length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <a
                      href={`/bmc-detail?card=${encodeURIComponent(module.title)}`}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-600 border border-teal-200 rounded-lg hover:bg-teal-50 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <i className="ri-eye-line text-xs"></i>
                      详情
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Tips */}
          <div className="mt-8 bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-teal-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <i className="ri-lightbulb-flash-line text-2xl text-white"></i>
              </div>
              <div>
                <h4 className="text-base font-bold text-teal-900 mb-2">使用提示</h4>
                <ul className="text-sm text-teal-700 space-y-1">
                  <li>• 点击"开始辩论"，6位AI董事会成员将围绕你的商业模式展开激烈讨论</li>
                  <li>• 当某个模块被提及时，右侧画布会高亮显示该模块</li>
                  <li>• 对于AI的建议，你可以选择"采纳"（自动更新到画布）或"忽略"</li>
                  <li>• 随时在底部输入框插话，@某个帽子表达你的观点</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
