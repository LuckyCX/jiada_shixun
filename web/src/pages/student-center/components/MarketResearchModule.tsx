import { useState } from 'react';
import VersionControl, { Version } from '../../../components/feature/VersionControl';

// ─── Types ───────────────────────────────────────────────────────────────────
interface SurveyQuestion {
  id: string;
  text: string;
  type: '单选' | '多选' | '评分' | '填空';
  options?: string[];
}

interface Survey {
  id: string;
  title: string;
  status: '草稿' | '进行中' | '已完成';
  questions: SurveyQuestion[];
  collected: number;
  target: number;
  link: string;
  createdAt: string;
  fromPlan?: boolean;
}

interface ResearchPlan {
  goal: string;
  methods: string[];
  members: { role: string; member: string }[];
  startDate: string;
  endDate: string;
  savedAt?: string;
}

interface UserPersona {
  id: string;
  name: string;
  age: number;
  occupation: string;
  major: string;
  avatar: string;
  painPoints: string[];
  needs: string[];
  habits: string[];
  borderColor: string;
  accentColor: string;
  fromSurvey?: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const METHODS = ['线上问卷', '用户访谈', '竞品分析', '行业报告', '数据爬取', '实地观察'];
const MEMBERS_OPTIONS = ['李娜', '张明', '王强', '陈雪', '刘洋', '赵磊'];

const AI_QUESTION_TEMPLATES: SurveyQuestion[] = [
  { id: 'ai-q1', text: '您的年龄段', type: '单选', options: ['18岁以下', '18-22岁', '23-25岁', '25岁以上'] },
  { id: 'ai-q2', text: '您每月在外卖/配送上的花费', type: '单选', options: ['100元以下', '100-300元', '300-500元', '500元以上'] },
  { id: 'ai-q3', text: '您对现有校园配送服务的满意度（1-5分）', type: '评分' },
  { id: 'ai-q4', text: '您最希望改进的方面', type: '多选', options: ['配送速度', '价格', '服务态度', '餐品质量', '配送准时性', '夜间服务'] },
  { id: 'ai-q5', text: '您每周使用配送服务的频次', type: '单选', options: ['1-2次', '3-5次', '6-10次', '10次以上'] },
  { id: 'ai-q6', text: '您愿意为更快的配送速度支付额外费用吗', type: '单选', options: ['愿意，1-2元', '愿意，3-5元', '不愿意', '视情况而定'] },
  { id: 'ai-q7', text: '您通常在什么时间段点外卖', type: '多选', options: ['早餐(7-9点)', '午餐(11-13点)', '下午茶(14-17点)', '晚餐(17-20点)', '夜宵(20点以后)'] },
  { id: 'ai-q8', text: '您对我们产品的哪些功能最感兴趣', type: '多选', options: ['实时追踪', '拼单优惠', '预约配送', '健康餐选项', '积分奖励'] },
];

const BORDER_COLORS = ['border-green-200', 'border-teal-200', 'border-pink-200', 'border-amber-200', 'border-orange-200'];
const ACCENT_COLORS = ['text-green-500', 'text-teal-500', 'text-pink-500', 'text-amber-500', 'text-orange-500'];

const defaultPlan: ResearchPlan = {
  goal: '了解校园配送市场需求，验证产品核心价值主张，分析竞争格局，为产品定位提供数据支撑。',
  methods: ['线上问卷', '用户访谈', '竞品分析'],
  members: [
    { role: '问卷设计', member: '李娜' },
    { role: '数据收集', member: '张明' },
    { role: '数据整理', member: '王强' },
    { role: '报告撰写', member: '陈雪' },
  ],
  startDate: '2024-12-20',
  endDate: '2025-01-10',
};

const defaultSurveys: Survey[] = [
  {
    id: 'survey-001',
    title: '校园配送需求调研',
    status: '进行中',
    collected: 156,
    target: 200,
    link: 'https://survey.jxu.edu.cn/s/campus-delivery-001',
    createdAt: '2024-12-05',
    fromPlan: true,
    questions: [
      { id: 'q1', text: '您的年龄段', type: '单选', options: ['18岁以下', '18-22岁', '23-25岁', '25岁以上'] },
      { id: 'q2', text: '您每月在外卖上的花费', type: '单选', options: ['100元以下', '100-300元', '300-500元', '500元以上'] },
      { id: 'q3', text: '您对校园配送服务的满意度', type: '评分' },
      { id: 'q4', text: '您希望改进的方面', type: '多选', options: ['配送速度', '价格', '服务态度', '餐品质量', '配送准时性'] },
      { id: 'q5', text: '您每周点外卖的频次', type: '单选', options: ['1-2次', '3-5次', '6-10次', '10次以上'] },
      { id: 'q6', text: '您最看重配送服务的哪个方面', type: '单选', options: ['速度', '价格', '准时', '服务态度'] },
    ],
  },
  {
    id: 'survey-002',
    title: '竞品使用体验调研',
    status: '草稿',
    collected: 0,
    target: 150,
    link: 'https://survey.jxu.edu.cn/s/competitor-002',
    createdAt: '2024-12-10',
    questions: [
      { id: 'q1', text: '您常用的外卖平台', type: '多选', options: ['美团外卖', '饿了么', '校园跑腿', '其他'] },
      { id: 'q2', text: '您对现有平台的整体满意度', type: '评分' },
      { id: 'q3', text: '您认为现有平台最大的不足', type: '填空' },
    ],
  },
];

const defaultPersonas: UserPersona[] = [
  {
    id: 'persona-001',
    name: '李小美',
    age: 20,
    occupation: '大二学生',
    major: '计算机科学',
    avatar: 'https://readdy.ai/api/search-image?query=professional%20portrait%20of%20young%20asian%20female%20university%20student%20age%2020%20with%20friendly%20smile%20and%20confident%20expression%2C%20modern%20casual%20style%2C%20clean%20bright%20background%20with%20soft%20lighting%2C%20educational%20atmosphere&width=200&height=200&seq=persona-new-001&orientation=squarish',
    painPoints: ['课程安排紧凑，用餐时间不固定', '高峰期配送慢，经常错过上课时间', '配送费用较高，每月开支压力大'],
    needs: ['配送速度快，15分钟内送达', '价格实惠，配送费低于3元', '服务可靠，准时送达不出错'],
    habits: ['每周点外卖5-7次', '单次消费15-25元', '偏好使用优惠券和会员折扣'],
    borderColor: 'border-green-200',
    accentColor: 'text-green-500',
    fromSurvey: true,
  },
  {
    id: 'persona-002',
    name: '王大力',
    age: 22,
    occupation: '研一学生',
    major: '工商管理',
    avatar: 'https://readdy.ai/api/search-image?query=professional%20portrait%20of%20young%20asian%20male%20university%20student%20age%2022%20with%20focused%20expression%20and%20glasses%2C%20modern%20casual%20style%2C%20clean%20bright%20background%20with%20soft%20lighting%2C%20educational%20atmosphere&width=200&height=200&seq=persona-new-002&orientation=squarish',
    painPoints: ['实验室工作忙碌，无暇外出就餐', '深夜加班时餐饮选择少', '希望有健康营养的餐食选择'],
    needs: ['24小时配送服务', '餐品种类丰富，包含健康选项', '配送准确，不打扰实验工作'],
    habits: ['每周点外卖8-10次', '单次消费25-40元', '注重食品质量和营养搭配'],
    borderColor: 'border-teal-200',
    accentColor: 'text-teal-500',
    fromSurvey: true,
  },
];

// ─── SVG Charts ──────────────────────────────────────────────────────────────
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function PieChart({ items }: { items: { label: string; value: number; color: string }[] }) {
  const total = items.reduce((s, i) => s + i.value, 0);
  let cumulative = 0;
  const radius = 75;
  const cx = 95;
  const cy = 95;

  const slices = items.map((item) => {
    const startAngle = (cumulative / total) * 360;
    cumulative += item.value;
    const endAngle = (cumulative / total) * 360;
    const start = polarToCartesian(cx, cy, radius, startAngle - 90);
    const end = polarToCartesian(cx, cy, radius, endAngle - 90);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    const d = `M ${cx} ${cy} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
    return { ...item, d, percent: Math.round((item.value / total) * 100) };
  });

  return (
    <div className="flex items-center gap-5">
      <svg width="190" height="190" viewBox="0 0 190 190" className="flex-shrink-0">
        {slices.map((s, i) => (
          <path key={i} d={s.d} fill={s.color} stroke="white" strokeWidth="2">
            <title>{s.label}: {s.percent}%</title>
          </path>
        ))}
      </svg>
      <div className="space-y-2 flex-1">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-xs text-gray-600 flex-1">{s.label}</span>
            <span className="text-xs font-bold text-gray-900">{s.percent}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarChart({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(...items.map((i) => i.value));
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-xs text-gray-600 w-20 flex-shrink-0 text-right">{item.label}</span>
          <div className="flex-1 h-7 bg-gray-100 rounded-lg overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-teal-400 rounded-lg flex items-center justify-end pr-2 transition-all duration-700"
              style={{ width: `${(item.value / max) * 100}%` }}
            >
              <span className="text-xs text-white font-bold">{item.value}%</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── QR Code Modal ────────────────────────────────────────────────────────────
function QRCodeModal({ survey, onClose }: { survey: Survey; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(survey.link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const qrCells = Array.from({ length: 21 * 21 }, (_, i) => {
    const seed = survey.id.charCodeAt(i % survey.id.length) + i;
    return seed % 3 === 0;
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-gray-900">发放问卷</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer">
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>
        <div className="text-center mb-6">
          <p className="text-sm text-gray-600 mb-4">扫描二维码填写问卷</p>
          <div className="inline-block p-4 bg-white border-2 border-gray-200 rounded-xl">
            <div className="grid gap-0" style={{ gridTemplateColumns: 'repeat(21, 10px)', width: 210 }}>
              {qrCells.map((filled, i) => (
                <div key={i} className={`w-2.5 h-2.5 ${filled ? 'bg-gray-900' : 'bg-white'}`} />
              ))}
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">《{survey.title}》</p>
        </div>
        <div className="mb-6">
          <p className="text-sm text-gray-600 mb-2">或复制链接发送给受访者</p>
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
            <span className="flex-1 text-xs text-gray-600 truncate">{survey.link}</span>
            <button
              onClick={handleCopy}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${copied ? 'bg-green-500 text-white' : 'bg-green-500 text-white hover:bg-green-600'}`}
            >
              {copied ? '已复制' : '复制'}
            </button>
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
          <i className="ri-information-line mr-2"></i>
          收集到的数据将自动同步到「数据分析」和「用户画像」模块
        </div>
      </div>
    </div>
  );
}

// ─── AI Generate Modal ────────────────────────────────────────────────────────
function AIGenerateModal({
  plan,
  onGenerate,
  onClose,
}: {
  plan: ResearchPlan;
  onGenerate: (title: string, questions: SurveyQuestion[]) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const handleGenerate = () => {
    if (!title.trim()) setTitle('校园配送需求调研问卷');
    setGenerating(true);
    setTimeout(() => {
      setGenerating(false);
      setGenerated(true);
      setQuestions(AI_QUESTION_TEMPLATES.map((q, i) => ({ ...q, id: `gen-q${i + 1}` })));
    }, 1800);
  };

  const updateQuestion = (idx: number, text: string) => {
    setQuestions((prev) => prev.map((q, i) => (i === idx ? { ...q, text } : q)));
  };

  const removeQuestion = (idx: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  const addQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      { id: `custom-${Date.now()}`, text: '新题目', type: '单选', options: ['选项A', '选项B'] },
    ]);
  };

  const handleConfirm = () => {
    onGenerate(title || '校园配送需求调研问卷', questions);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center bg-green-100 text-green-600 rounded-lg">
              <i className="ri-robot-line text-lg"></i>
            </div>
            <h3 className="text-lg font-bold text-gray-900">AI 协助生成问卷</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer">
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-1 px-6 space-y-5">
          {plan.goal && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-xs font-medium text-green-700 mb-1">
                <i className="ri-file-list-3-line mr-1"></i>基于调研计划自动生成
              </p>
              <p className="text-sm text-green-800 line-clamp-2">{plan.goal}</p>
              {plan.methods.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {plan.methods.map((m) => (
                    <span key={m} className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">{m}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">问卷标题</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例：校园配送需求调研问卷"
              className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          {!generated ? (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full py-3 bg-green-500 text-white text-sm font-medium rounded-xl hover:bg-green-600 transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {generating ? (
                <><i className="ri-loader-4-line animate-spin"></i>AI 正在生成问卷题目...</>
              ) : (
                <><i className="ri-magic-line"></i>AI 一键生成问卷</>
              )}
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-900">
                  <i className="ri-checkbox-circle-fill text-green-500 mr-1"></i>
                  已生成 {questions.length} 道题目，可自由调整
                </p>
                <button onClick={addQuestion} className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1 cursor-pointer">
                  <i className="ri-add-line"></i>添加题目
                </button>
              </div>
              {questions.map((q, idx) => (
                <div key={q.id} className="border border-gray-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-green-100 text-green-700 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <div className="flex-1">
                      {editingIdx === idx ? (
                        <input
                          type="text"
                          value={q.text}
                          onChange={(e) => updateQuestion(idx, e.target.value)}
                          onBlur={() => setEditingIdx(null)}
                          autoFocus
                          className="w-full text-sm border-b border-green-400 focus:outline-none pb-1"
                        />
                      ) : (
                        <p className="text-sm text-gray-800 cursor-pointer hover:text-green-600" onClick={() => setEditingIdx(idx)}>
                          {q.text}
                        </p>
                      )}
                      <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">{q.type}</span>
                    </div>
                    <button onClick={() => removeQuestion(idx)} className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-red-400 rounded cursor-pointer">
                      <i className="ri-delete-bin-line text-sm"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {generated && (
          <div className="p-6 border-t border-gray-100 flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors cursor-pointer">
              取消
            </button>
            <button onClick={handleConfirm} className="flex-1 py-3 bg-green-500 text-white text-sm font-medium rounded-xl hover:bg-green-600 transition-colors cursor-pointer">
              <i className="ri-check-line mr-1"></i>确认创建问卷
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── AI Generate Persona Modal ────────────────────────────────────────────────
function AIGeneratePersonaModal({
  totalCollected,
  onGenerate,
  onClose,
}: {
  totalCollected: number;
  onGenerate: (personas: UserPersona[]) => void;
  onClose: () => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [generatedPersonas, setGeneratedPersonas] = useState<UserPersona[]>([]);

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => {
      // 基于问卷数据生成2个典型用户画像
      const newPersonas: UserPersona[] = [
        {
          id: `ai-persona-${Date.now()}-1`,
          name: '张小雅',
          age: 20,
          occupation: '大二学生',
          major: '市场营销',
          avatar: `https://readdy.ai/api/search-image?query=professional%20portrait%20of%20young%20asian%20female%20university%20student%20age%2020%20with%20friendly%20smile%20and%20confident%20expression%2C%20modern%20casual%20style%2C%20clean%20bright%20background%20with%20soft%20lighting%2C%20educational%20atmosphere&width=200&height=200&seq=ai-persona-${Date.now()}-1&orientation=squarish`,
          painPoints: [
            '课程时间紧张，经常错过食堂用餐时间',
            '外卖配送高峰期等待时间长，影响下午上课',
            '配送费用累计较高，每月外卖支出超预算'
          ],
          needs: [
            '15分钟内快速送达，不耽误课程安排',
            '配送费优惠，希望每单配送费不超过2元',
            '餐品种类丰富，有健康低卡选项'
          ],
          habits: [
            '每周点外卖5-7次，主要集中在午餐和晚餐',
            '单次消费15-25元，偏好使用平台优惠券',
            '注重食品卫生和配送速度，愿意为优质服务付费'
          ],
          borderColor: 'border-pink-200',
          accentColor: 'text-pink-500',
          fromSurvey: true,
        },
        {
          id: `ai-persona-${Date.now()}-2`,
          name: '李明轩',
          age: 22,
          occupation: '研一学生',
          major: '计算机科学',
          avatar: `https://readdy.ai/api/search-image?query=professional%20portrait%20of%20young%20asian%20male%20university%20student%20age%2022%20with%20focused%20expression%20and%20glasses%2C%20modern%20casual%20style%2C%20clean%20bright%20background%20with%20soft%20lighting%2C%20educational%20atmosphere&width=200&height=200&seq=ai-persona-${Date.now()}-2&orientation=squarish`,
          painPoints: [
            '实验室工作繁忙，无法按时外出就餐',
            '深夜加班时餐饮选择少，配送服务不稳定',
            '现有平台配送范围有限，实验楼经常无法送达'
          ],
          needs: [
            '24小时全天候配送服务，满足深夜用餐需求',
            '配送范围覆盖实验楼等偏僻区域',
            '餐品保温效果好，送达时仍保持最佳口感'
          ],
          habits: [
            '每周点外卖8-10次，夜宵订单占比40%',
            '单次消费25-40元，对价格不太敏感',
            '偏好肉类和高热量食物，注重份量和性价比'
          ],
          borderColor: 'border-blue-200',
          accentColor: 'text-blue-500',
          fromSurvey: true,
        },
      ];
      
      setGeneratedPersonas(newPersonas);
      setGenerating(false);
      setGenerated(true);
    }, 2000);
  };

  const handleConfirm = () => {
    onGenerate(generatedPersonas);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center bg-gradient-to-br from-purple-500 to-blue-500 text-white rounded-xl">
              <i className="ri-robot-line text-xl"></i>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">AI 生成用户画像</h3>
              <p className="text-xs text-gray-500 mt-0.5">基于调研数据智能生成典型用户画像</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer">
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-1 px-6">
          {!generated ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-purple-100 to-blue-100 rounded-2xl flex items-center justify-center">
                <i className="ri-user-star-line text-4xl text-purple-600"></i>
              </div>
              <h4 className="text-lg font-bold text-gray-900 mb-3">基于调研数据自动生成</h4>
              <p className="text-sm text-gray-600 mb-2">
                AI 将分析您的问卷调查数据，自动生成典型用户画像
              </p>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg text-sm mb-8">
                <i className="ri-database-2-line"></i>
                <span>当前数据来源：<strong>{totalCollected}</strong> 份问卷收集数据</span>
              </div>
              
              <div className="max-w-md mx-auto mb-8">
                <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-6 border border-purple-200">
                  <h5 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <i className="ri-lightbulb-flash-line text-purple-600"></i>
                    AI 将生成以下内容
                  </h5>
                  <ul className="text-sm text-gray-700 space-y-2">
                    <li className="flex items-start gap-2">
                      <i className="ri-checkbox-circle-fill text-purple-500 mt-0.5"></i>
                      <span>2个典型用户画像（基于年龄、消费能力等数据分布）</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <i className="ri-checkbox-circle-fill text-purple-500 mt-0.5"></i>
                      <span>每个画像包含：姓名、年龄、职业、专业</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <i className="ri-checkbox-circle-fill text-purple-500 mt-0.5"></i>
                      <span>核心痛点、核心诉求、消费习惯各3条</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <i className="ri-checkbox-circle-fill text-purple-500 mt-0.5"></i>
                      <span>生成后可编辑修改，也可删除重新生成</span>
                    </li>
                  </ul>
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={generating}
                className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-medium rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg hover:shadow-xl cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2 whitespace-nowrap"
              >
                {generating ? (
                  <>
                    <i className="ri-loader-4-line animate-spin"></i>
                    AI 正在分析数据并生成画像...
                  </>
                ) : (
                  <>
                    <i className="ri-sparkling-fill"></i>
                    AI 一键生成画像
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                <i className="ri-checkbox-circle-fill text-green-600 text-xl"></i>
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-900">AI 已生成 2 个用户画像</p>
                  <p className="text-xs text-green-700 mt-0.5">请预览画像内容，确认后将添加到画像列表</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {generatedPersonas.map((persona) => (
                  <div key={persona.id} className={`bg-white border-2 ${persona.borderColor} rounded-2xl p-6`}>
                    <div className="flex items-start gap-4 mb-6">
                      <img
                        src={persona.avatar}
                        alt={persona.name}
                        className="w-20 h-20 rounded-full object-top object-cover border-4 border-gray-100 flex-shrink-0"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-xl font-bold text-gray-900">{persona.name}</h4>
                          <span className="px-2 py-0.5 bg-purple-50 text-purple-600 text-xs rounded-full whitespace-nowrap">
                            <i className="ri-robot-line mr-1"></i>AI生成
                          </span>
                        </div>
                        <div className="space-y-1 text-xs text-gray-600">
                          <p><strong className="text-gray-900">年龄：</strong>{persona.age}岁</p>
                          <p><strong className="text-gray-900">职业：</strong>{persona.occupation}</p>
                          <p><strong className="text-gray-900">专业：</strong>{persona.major}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {[
                        { field: 'painPoints' as const, label: '核心痛点', icon: 'ri-heart-pulse-line' },
                        { field: 'needs' as const, label: '核心诉求', icon: 'ri-star-line' },
                        { field: 'habits' as const, label: '消费习惯', icon: 'ri-shopping-bag-line' },
                      ].map(({ field, label, icon }) => (
                        <div key={field}>
                          <h5 className="text-xs font-bold text-gray-900 mb-2 flex items-center gap-2">
                            <i className={`${icon} ${persona.accentColor}`}></i>
                            {label}
                          </h5>
                          <ul className="text-xs text-gray-600 space-y-1">
                            {persona[field].map((item, i) => (
                              <li key={i} className="leading-relaxed">• {item}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {generated && (
          <div className="p-6 border-t border-gray-100 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap"
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-medium rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
            >
              <i className="ri-check-line"></i>
              确认添加到画像列表
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Edit Persona Modal ───────────────────────────────────────────────────────
function EditPersonaModal({ persona, onSave, onClose }: { persona: UserPersona; onSave: (p: UserPersona) => void; onClose: () => void }) {
  const [form, setForm] = useState<UserPersona>({ ...persona });
  const [saving, setSaving] = useState(false);

  const updateList = (field: 'painPoints' | 'needs' | 'habits', idx: number, val: string) => {
    const arr = [...form[field]];
    arr[idx] = val;
    setForm({ ...form, [field]: arr });
  };

  const addItem = (field: 'painPoints' | 'needs' | 'habits') => {
    setForm({ ...form, [field]: [...form[field], ''] });
  };

  const removeItem = (field: 'painPoints' | 'needs' | 'habits', idx: number) => {
    setForm({ ...form, [field]: form[field].filter((_, i) => i !== idx) });
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => { setSaving(false); onSave(form); }, 600);
  };

  const fieldLabels: Record<string, string> = { painPoints: '核心痛点', needs: '核心诉求', habits: '消费习惯' };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">编辑用户画像</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer">
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-1 px-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: '姓名', field: 'name' as const, type: 'text' },
              { label: '年龄', field: 'age' as const, type: 'number' },
              { label: '职业', field: 'occupation' as const, type: 'text' },
              { label: '专业', field: 'major' as const, type: 'text' },
            ].map(({ label, field, type }) => (
              <div key={field}>
                <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
                <input
                  type={type}
                  value={form[field] as string | number}
                  onChange={(e) => setForm({ ...form, [field]: type === 'number' ? Number(e.target.value) : e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            ))}
          </div>
          {(['painPoints', 'needs', 'habits'] as const).map((field) => (
            <div key={field}>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-700">{fieldLabels[field]}</label>
                <button onClick={() => addItem(field)} className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1 cursor-pointer">
                  <i className="ri-add-line"></i>添加
                </button>
              </div>
              <div className="space-y-2">
                {form[field].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => updateList(field, idx, e.target.value)}
                      className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <button onClick={() => removeItem(field, idx)} className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-400 rounded cursor-pointer">
                      <i className="ri-delete-bin-line text-sm"></i>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="p-6 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors cursor-pointer">取消</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-3 bg-green-500 text-white text-sm font-medium rounded-xl hover:bg-green-600 transition-colors cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2">
            {saving ? <><i className="ri-loader-4-line animate-spin"></i>保存中...</> : <><i className="ri-save-line"></i>保存修改</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Create Persona Modal ─────────────────────────────────────────────────────
function CreatePersonaModal({ onSave, onClose }: { onSave: (p: UserPersona) => void; onClose: () => void }) {
  const [form, setForm] = useState({ name: '', age: 20, occupation: '', major: '', painPoints: [''], needs: [''], habits: [''] });

  const updateList = (field: 'painPoints' | 'needs' | 'habits', idx: number, val: string) => {
    const arr = [...form[field]];
    arr[idx] = val;
    setForm({ ...form, [field]: arr });
  };

  const addItem = (field: 'painPoints' | 'needs' | 'habits') => {
    setForm({ ...form, [field]: [...form[field], ''] });
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    const colorIdx = Math.floor(Math.random() * BORDER_COLORS.length);
    const newPersona: UserPersona = {
      ...form,
      id: `persona-${Date.now()}`,
      avatar: `https://readdy.ai/api/search-image?query=professional%20portrait%20of%20young%20asian%20university%20student%20with%20friendly%20smile%2C%20modern%20casual%20style%2C%20clean%20bright%20background%20with%20soft%20lighting&width=200&height=200&seq=persona-new-${Date.now()}&orientation=squarish`,
      borderColor: BORDER_COLORS[colorIdx],
      accentColor: ACCENT_COLORS[colorIdx],
      fromSurvey: false,
    };
    onSave(newPersona);
  };

  const fieldLabels: Record<string, string> = { painPoints: '核心痛点', needs: '核心诉求', habits: '消费习惯' };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">创建新用户画像</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer">
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-1 px-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: '姓名 *', field: 'name' as const, type: 'text' },
              { label: '年龄', field: 'age' as const, type: 'number' },
              { label: '职业', field: 'occupation' as const, type: 'text' },
              { label: '专业', field: 'major' as const, type: 'text' },
            ].map(({ label, field, type }) => (
              <div key={field}>
                <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
                <input
                  type={type}
                  value={form[field] as string | number}
                  onChange={(e) => setForm({ ...form, [field]: type === 'number' ? Number(e.target.value) : e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            ))}
          </div>
          {(['painPoints', 'needs', 'habits'] as const).map((field) => (
            <div key={field}>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-700">{fieldLabels[field]}</label>
                <button onClick={() => addItem(field)} className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1 cursor-pointer">
                  <i className="ri-add-line"></i>添加
                </button>
              </div>
              <div className="space-y-2">
                {form[field].map((item, idx) => (
                  <input
                    key={idx}
                    type="text"
                    value={item}
                    onChange={(e) => updateList(field, idx, e.target.value)}
                    placeholder={`输入${fieldLabels[field]}...`}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="p-6 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors cursor-pointer">取消</button>
          <button onClick={handleSave} disabled={!form.name.trim()} className="flex-1 py-3 bg-green-500 text-white text-sm font-medium rounded-xl hover:bg-green-600 transition-colors cursor-pointer disabled:opacity-50">
            <i className="ri-add-line mr-1"></i>创建画像
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ChallengeTab Inline ──────────────────────────────────────────────────────
interface ProjectInfo {
  name: string;
  targetUser: string;
  coreValue: string;
  businessModel: string;
}

interface ChallengeMessage {
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
      '你说的目标用户画像真的准确吗？你们对用户的理解还不够深入。',
      '免费试用期结束后，如果我不满意能退款吗？你们的售后服务怎么样？',
      '你们的产品更新频率如何？会不会用着用着就不维护了？',
      '隐私安全怎么保障？我的数据会不会被泄露或滥用？',
    ],
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
      '风险点在哪里？政策风险、技术风险、市场风险你们怎么应对？',
      '你们的增长策略是什么？如何实现规模化扩张？',
    ],
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
      '你们的产品迭代速度能跟上竞争对手吗？研发团队够强吗？',
      '用户为什么要从竞品迁移到你们这里？迁移成本高不高？',
      '市场营销预算有多少？竞争对手在疯狂烧钱获客，你们跟得上吗？',
    ],
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
      '行业的痛点你们真的抓准了吗？还是只是自己想象的伪需求？',
      '你们的方案在实际场景中验证过吗？有没有试点案例？',
      '这个行业的发展趋势是什么？你们的项目是顺势而为还是逆势而行？',
    ],
  },
];

function ChallengeTabInline({ savedTheme }: { savedTheme: any }) {
  const [step, setStep] = useState<'info' | 'select' | 'challenge' | 'report'>('info');
  const [projectInfo, setProjectInfo] = useState<ProjectInfo>({
    name: savedTheme?.name || '',
    targetUser: savedTheme?.target || '',
    coreValue: savedTheme?.value || '',
    businessModel: savedTheme?.solution || '',
  });
  const [autoFilled] = useState(!!(savedTheme?.name));
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChallengeMessage[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [currentRound, setCurrentRound] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [report, setReport] = useState<{
    totalScore: number;
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
  } | null>(null);
  const [infoError, setInfoError] = useState('');

  const handleInfoSubmit = () => {
    if (!projectInfo.name || !projectInfo.targetUser || !projectInfo.coreValue || !projectInfo.businessModel) {
      setInfoError('请填写完整的项目信息');
      return;
    }
    setInfoError('');
    setStep('select');
  };

  const toggleAgent = (agentId: string) => {
    setSelectedAgents(prev =>
      prev.includes(agentId) ? prev.filter(id => id !== agentId) : [...prev, agentId]
    );
  };

  const askNextQuestion = (questionIndex: number, agentList: string[]) => {
    const agentId = agentList[questionIndex % agentList.length];
    const agent = challengeAgents.find(a => a.id === agentId)!;
    const randomQuestion = agent.questions[Math.floor(Math.random() * agent.questions.length)];
    setMessages(prev => [...prev, {
      role: 'ai',
      content: randomQuestion,
      agentName: agent.name,
      agentRole: agent.role,
    }]);
  };

  const startChallenge = () => {
    if (selectedAgents.length === 0) return;
    setStep('challenge');
    setCurrentRound(1);
    setCurrentQuestionIndex(0);
    setMessages([]);
    setTimeout(() => askNextQuestion(0, selectedAgents), 800);
  };

  const handleSendAnswer = () => {
    if (!currentInput.trim() || isProcessing) return;
    const userMsg: ChallengeMessage = { role: 'user', content: currentInput };
    setMessages(prev => [...prev, userMsg]);
    setCurrentInput('');
    setIsProcessing(true);

    setTimeout(() => {
      const score = Math.floor(Math.random() * 30) + 70;
      const feedbacks = [
        '回答有一定道理，但还需要更具体的数据支撑。',
        '这个角度不错，但没有充分考虑到实际执行中的困难。',
        '逻辑清晰，但缺少对竞争对手的深入分析。',
        '想法很好，建议补充更多的市场验证案例。',
        '回答比较全面，但在商业模式的可持续性上还需要深入思考。',
        '不错的见解，但需要更多关注用户的真实需求。',
        '有创新性，但风险评估还不够充分。',
        '回答切中要害，继续保持这个思路深入挖掘。',
      ];
      const feedback = feedbacks[Math.floor(Math.random() * feedbacks.length)];
      setMessages(prev => [...prev, { role: 'ai', content: `评分：${score}分\n\n${feedback}`, score }]);
      setIsProcessing(false);

      setCurrentQuestionIndex(prevIdx => {
        const nextIdx = prevIdx + 1;
        if (nextIdx % selectedAgents.length === 0) {
          setCurrentRound(prevRound => {
            const nextRound = prevRound + 1;
            if (nextRound > 5) {
              setTimeout(() => generateReport(), 1500);
              return prevRound;
            }
            return nextRound;
          });
        }
        setTimeout(() => askNextQuestion(nextIdx, selectedAgents), 1500);
        return nextIdx;
      });
    }, 2000);
  };

  const generateReport = () => {
    const scores = messages.filter(m => m.score).map(m => m.score!);
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 75;
    setReport({
      totalScore: avgScore,
      strengths: [
        '项目定位清晰，目标用户画像明确',
        '核心价值主张具有一定的创新性',
        '对市场需求有基本的理解',
        '团队对项目充满热情和信心',
      ],
      weaknesses: [
        '商业模式的可持续性需要进一步验证',
        '竞争分析不够深入，差异化优势不够明显',
        '财务预测和盈利模式需要更详细的规划',
        '风险应对策略还不够完善',
        '缺少实际的市场验证数据',
      ],
      suggestions: [
        '建议进行小规模的市场测试，收集真实用户反馈',
        '深入研究竞争对手，明确自己的核心竞争力',
        '制定详细的财务计划，包括成本结构和收入预测',
        '建立风险预警机制，准备应对方案',
        '寻找行业导师或顾问，获取专业指导',
        '优化产品功能，聚焦核心价值，避免过度设计',
        '建立用户反馈渠道，持续迭代优化产品',
        '加强团队建设，补充关键岗位的专业人才',
      ],
    });
    setStep('report');
  };

  const resetChallenge = () => {
    setStep('info');
    setSelectedAgents([]);
    setMessages([]);
    setCurrentInput('');
    setCurrentRound(0);
    setCurrentQuestionIndex(0);
    setReport(null);
  };

  const stepColors = ['from-indigo-500 to-violet-500', 'from-indigo-500 to-violet-500', 'from-indigo-500 to-violet-500', 'from-indigo-500 to-violet-500'];
  const stepKeys = ['info', 'select', 'challenge', 'report'];
  const stepLabels = ['填写项目信息', '选择挑战角色', '对抗挑战', '查看报告'];

  return (
    <div className="space-y-6">
      {/* 步骤指示器 */}
      <div className="flex items-center justify-center gap-3">
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
            {i < 3 && <div className="w-8 h-0.5 bg-gray-200 mx-1"></div>}
          </div>
        ))}
      </div>

      {/* 步骤1：填写项目信息 */}
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">项目名称 <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={projectInfo.name}
                onChange={e => setProjectInfo({ ...projectInfo, name: e.target.value })}
                placeholder="例如：智慧校园AI助手"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">目标用户 <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={projectInfo.targetUser}
                onChange={e => setProjectInfo({ ...projectInfo, targetUser: e.target.value })}
                placeholder="例如：高校学生、教师、管理人员"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">核心价值主张 <span className="text-red-500">*</span></label>
              <textarea
                value={projectInfo.coreValue}
                onChange={e => setProjectInfo({ ...projectInfo, coreValue: e.target.value })}
                placeholder="例如：通过AI技术提升校园管理效率，为师生提供智能化服务"
                rows={3}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">商业模式 <span className="text-red-500">*</span></label>
              <textarea
                value={projectInfo.businessModel}
                onChange={e => setProjectInfo({ ...projectInfo, businessModel: e.target.value })}
                placeholder="例如：SaaS订阅模式，按学校规模收费；基础版免费，高级功能付费"
                rows={3}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm resize-none"
              />
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <button
              onClick={handleInfoSubmit}
              className="px-8 py-3 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-xl hover:from-indigo-600 hover:to-violet-600 transition-all font-medium whitespace-nowrap cursor-pointer"
            >
              下一步：选择挑战角色 <i className="ri-arrow-right-line ml-1"></i>
            </button>
          </div>
        </div>
      )}

      {/* 步骤2：选择挑战角色 */}
      {step === 'select' && (
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <div className="mb-6">
            <h3 className="text-xl font-bold text-gray-900 mb-2">选择挑战角色</h3>
            <p className="text-gray-500 text-sm">选择一个或多个AI角色对您的项目发起挑战，每个角色将从不同角度提出尖锐问题</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            {challengeAgents.map(agent => (
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

          <div className="flex items-center justify-between">
            <button onClick={() => setStep('info')} className="px-6 py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-medium whitespace-nowrap cursor-pointer">
              <i className="ri-arrow-left-line mr-1"></i>上一步
            </button>
            <button
              onClick={startChallenge}
              disabled={selectedAgents.length === 0}
              className="px-8 py-3 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-xl hover:opacity-90 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
            >
              开始挑战（已选{selectedAgents.length}个角色）
            </button>
          </div>
        </div>
      )}

      {/* 步骤3：对抗挑战 */}
      {step === 'challenge' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-500 to-violet-500 text-white px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <i className="ri-sword-line text-xl"></i>
                  <span className="font-bold">人机对抗进行中</span>
                </div>
                <div className="h-5 w-px bg-white/30"></div>
                <span className="text-sm">第 {currentRound} / 5 轮</span>
              </div>
              <span className="text-sm">已回答 {messages.filter(m => m.role === 'user').length} 个问题</span>
            </div>
          </div>

          <div className="h-[480px] overflow-y-auto p-6 space-y-4 bg-gray-50">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'ai' && (
                  <div className="flex gap-3 max-w-[80%]">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 flex items-center justify-center flex-shrink-0">
                      <i className="ri-robot-line text-white text-lg"></i>
                    </div>
                    <div>
                      {msg.agentName && (
                        <div className="mb-1">
                          <span className="text-xs font-bold text-indigo-600">{msg.agentName}</span>
                          <span className="text-xs text-gray-400 ml-2">{msg.agentRole}</span>
                        </div>
                      )}
                      <div className="bg-white rounded-xl rounded-tl-none px-4 py-3 shadow-sm border border-gray-200">
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  </div>
                )}
                {msg.role === 'user' && (
                  <div className="flex gap-3 max-w-[80%]">
                    <div className="bg-gradient-to-r from-indigo-500 to-violet-500 rounded-xl rounded-tr-none px-4 py-3 shadow-sm">
                      <p className="text-sm text-white whitespace-pre-wrap">{msg.content}</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                      <i className="ri-user-line text-gray-600 text-lg"></i>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {isProcessing && (
              <div className="flex justify-start">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 flex items-center justify-center flex-shrink-0">
                    <i className="ri-robot-line text-white text-lg"></i>
                  </div>
                  <div className="bg-white rounded-xl rounded-tl-none px-4 py-3 shadow-sm border border-gray-200">
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

          <div className="border-t border-gray-200 p-4 bg-white">
            <div className="flex gap-3">
              <input
                type="text"
                value={currentInput}
                onChange={e => setCurrentInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !isProcessing && handleSendAnswer()}
                placeholder="输入您的回答..."
                disabled={isProcessing || currentRound > 5}
                className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm disabled:bg-gray-100"
              />
              <button
                onClick={handleSendAnswer}
                disabled={!currentInput.trim() || isProcessing || currentRound > 5}
                className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-sm font-medium rounded-xl hover:from-indigo-600 hover:to-violet-600 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
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
          <div className="bg-gradient-to-r from-indigo-500 to-violet-500 rounded-xl p-8 text-white text-center">
            <h3 className="text-2xl font-bold mb-4">压力测试完成</h3>
            <div className="inline-flex items-center justify-center w-28 h-28 rounded-full bg-white/20 backdrop-blur-sm mb-4">
              <div className="text-5xl font-bold">{report.totalScore}</div>
            </div>
            <p className="text-lg opacity-90">综合评分</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center">
                <i className="ri-thumb-up-line text-white text-xl"></i>
              </div>
              <h4 className="text-lg font-bold text-gray-900">项目优势</h4>
            </div>
            <ul className="space-y-3">
              {report.strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-3">
                  <i className="ri-checkbox-circle-fill text-emerald-500 text-lg mt-0.5"></i>
                  <span className="text-gray-700 text-sm">{s}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center">
                <i className="ri-alert-line text-white text-xl"></i>
              </div>
              <h4 className="text-lg font-bold text-gray-900">待改进点</h4>
            </div>
            <ul className="space-y-3">
              {report.weaknesses.map((w, i) => (
                <li key={i} className="flex items-start gap-3">
                  <i className="ri-error-warning-fill text-amber-500 text-lg mt-0.5"></i>
                  <span className="text-gray-700 text-sm">{w}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 flex items-center justify-center">
                <i className="ri-lightbulb-line text-white text-xl"></i>
              </div>
              <h4 className="text-lg font-bold text-gray-900">AI优化建议</h4>
            </div>
            <ul className="space-y-3">
              {report.suggestions.map((s, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-indigo-600">{i + 1}</span>
                  </div>
                  <span className="text-gray-700 text-sm">{s}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center justify-between">
            <button onClick={resetChallenge} className="px-6 py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-medium whitespace-nowrap cursor-pointer">
              重新开始挑战
            </button>
            <button
              onClick={() => {
                const el = document.createElement('div');
                el.className = 'fixed bottom-6 right-6 bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-6 py-3 rounded-xl shadow-lg z-50 flex items-center gap-2';
                el.innerHTML = '<i class="ri-check-line text-xl"></i><span>压力测试报告已保存</span>';
                document.body.appendChild(el);
                setTimeout(() => el.remove(), 3000);
              }}
              className="px-8 py-3 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-xl hover:from-indigo-600 hover:to-violet-600 transition-all font-medium whitespace-nowrap cursor-pointer"
            >
              保存报告
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
type MarketResearchModuleProps = {
  onTaskComplete?: () => void;
};

export default function MarketResearchModule({ onTaskComplete }: MarketResearchModuleProps) {
  const [activeTab, setActiveTab] = useState<'plan' | 'survey' | 'analysis' | 'persona' | 'challenge'>('plan');
  const [toast, setToast] = useState('');

  // Plan state
  const [plan, setPlan] = useState<ResearchPlan>(defaultPlan);
  const [saving, setSaving] = useState(false);
  const [planSaved, setPlanSaved] = useState(false);

  // Survey state
  const [surveys, setSurveys] = useState<Survey[]>(defaultSurveys);
  const [showQR, setShowQR] = useState<Survey | null>(null);
  const [showAI, setShowAI] = useState(false);

  // Persona state
  const [personas, setPersonas] = useState<UserPersona[]>(defaultPersonas);
  const [editingPersona, setEditingPersona] = useState<UserPersona | null>(null);
  const [showCreatePersona, setShowCreatePersona] = useState(false);
  const [showAIGeneratePersona, setShowAIGeneratePersona] = useState(false);

  // Analysis data (derived from surveys)
  const totalCollected = surveys.reduce((s, sv) => s + sv.collected, 0);
  const validSamples = Math.round(totalCollected * 0.91);

  const ageData = [
    { label: '18-20岁', value: 45, color: '#22c55e' },
    { label: '21-22岁', value: 38, color: '#4ade80' },
    { label: '23-25岁', value: 12, color: '#86efac' },
    { label: '25岁以上', value: 5, color: '#bbf7d0' },
  ];
  const spendingData = [
    { label: '100元以下', value: 18, color: '#f59e0b' },
    { label: '100-300元', value: 52, color: '#fbbf24' },
    { label: '300-500元', value: 24, color: '#fcd34d' },
    { label: '500元以上', value: 6, color: '#fde68a' },
  ];
  const satisfactionData = [
    { label: '非常不满意', value: 8, color: '#ef4444' },
    { label: '不满意', value: 22, color: '#f97316' },
    { label: '一般', value: 35, color: '#eab308' },
    { label: '满意', value: 25, color: '#22c55e' },
    { label: '非常满意', value: 10, color: '#10b981' },
  ];
  const improvementData = [
    { label: '配送速度', value: 85 },
    { label: '价格优惠', value: 72 },
    { label: '准时送达', value: 68 },
    { label: '服务态度', value: 45 },
    { label: '餐品质量', value: 38 },
  ];

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  // 从创新思维模块读取已确定的项目选题
  const savedTheme = (() => {
    try {
      const raw = localStorage.getItem('ideation_project_theme');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();

  // ── Plan handlers ──
  const handleSavePlan = () => {
    if (!plan.goal.trim()) {
      showToast('请填写调研目标');
      return;
    }
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setPlanSaved(true);
      setPlan((prev) => ({ ...prev, savedAt: new Date().toLocaleString('zh-CN') }));
      showToast('调研计划已保存 ✓');
      onTaskComplete?.();
      setTimeout(() => setPlanSaved(false), 3000);
    }, 800);
  };

  const toggleMethod = (method: string) => {
    const methods = plan.methods.includes(method)
      ? plan.methods.filter((m) => m !== method)
      : [...plan.methods, method];
    setPlan({ ...plan, methods });
  };

  const updateMember = (index: number, field: 'role' | 'member', value: string) => {
    const members = plan.members.map((m, i) => (i === index ? { ...m, [field]: value } : m));
    setPlan({ ...plan, members });
  };

  const addMember = () => {
    setPlan({ ...plan, members: [...plan.members, { role: '', member: '' }] });
  };

  const removeMember = (index: number) => {
    setPlan({ ...plan, members: plan.members.filter((_, i) => i !== index) });
  };

  // ── Survey handlers ──
  const handlePublish = (id: string) => {
    setSurveys(surveys.map((s) => (s.id === id ? { ...s, status: '进行中' } : s)));
    showToast('问卷已发布，开始收集数据！');
  };

  const handleAIGenerate = (title: string, questions: SurveyQuestion[]) => {
    const newSurvey: Survey = {
      id: `survey-${Date.now()}`,
      title,
      status: '草稿',
      questions,
      collected: 0,
      target: 200,
      link: `https://survey.jxu.edu.cn/s/${Date.now()}`,
      createdAt: new Date().toLocaleDateString('zh-CN'),
      fromPlan: true,
    };
    setSurveys([...surveys, newSurvey]);
    setShowAI(false);
    showToast('问卷已创建，发布后开始收集数据！');
  };

  // ── Persona handlers ──
  const handleSaveEdit = (updated: UserPersona) => {
    setPersonas(personas.map((p) => (p.id === updated.id ? updated : p)));
    setEditingPersona(null);
    showToast('画像已更新！');
  };

  const handleCreatePersona = (newP: UserPersona) => {
    setPersonas([...personas, newP]);
    setShowCreatePersona(false);
    showToast('新画像已创建！');
  };

  const handleAIGeneratePersonas = (newPersonas: UserPersona[]) => {
    setPersonas([...personas, ...newPersonas]);
    setShowAIGeneratePersona(false);
    showToast(`AI 已生成 ${newPersonas.length} 个用户画像！`);
  };

  const handleDeletePersona = (id: string) => {
    setPersonas(personas.filter((p) => p.id !== id));
    showToast('画像已删除');
  };

  // 版本控制状态
  const [versions, setVersions] = useState<Version[]>([]);
  const [currentVersion, setCurrentVersion] = useState(1);

  // 保存当前版本
  const handleSaveVersion = (summary: string) => {
    const newVersion: Version = {
      id: `version-${Date.now()}`,
      versionNumber: versions.length + 1,
      timestamp: new Date().toLocaleString('zh-CN'),
      operator: '当前用户',
      summary,
      data: {
        plan,
        surveys,
        personas,
        aiAnalysisReport,
      },
    };
    setVersions([...versions, newVersion]);
    setCurrentVersion(newVersion.versionNumber);
    showToast('版本已保存');
  };

  // 回撤到指定版本
  const handleRestore = (versionId: string) => {
    const version = versions.find(v => v.id === versionId);
    if (!version) return;
    
    const data = version.data;
    setPlan(data.plan || defaultPlan);
    setSurveys(data.surveys || defaultSurveys);
    setPersonas(data.personas || defaultPersonas);
    setAiAnalysisReport(data.aiAnalysisReport || { isVisible: false, isExpanded: true, data: null });
    setCurrentVersion(version.versionNumber);
    showToast(`已回撤到版本 v${version.versionNumber}`);
  };

  // ── Export ──
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);
  const handleExport = () => {
    setExporting(true);
    setTimeout(() => {
      setExporting(false);
      setExported(true);
      showToast('调研报告已导出 ✓');
      setTimeout(() => setExported(false), 3000);
    }, 1500);
  };

  // 新增：问卷详情弹窗状态
  const [surveyDetailModal, setSurveyDetailModal] = useState<{
    isOpen: boolean;
    survey: any;
  }>({
    isOpen: false,
    survey: null
  });

  // 新增：AI分析报告状态
  const [aiAnalysisReport, setAiAnalysisReport] = useState<{
    isVisible: boolean;
    isExpanded: boolean;
    data: {
      score: number;
      conclusions: string[];
      opportunities: string[];
      risks: string[];
      suggestions: string[];
    } | null;
  }>({
    isVisible: false,
    isExpanded: true,
    data: null
  });

  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);

  const tabs = [
    { key: 'plan' as const, label: '调研计划', icon: 'ri-file-list-3-line' },
    { key: 'survey' as const, label: '问卷调查', icon: 'ri-questionnaire-line' },
    { key: 'analysis' as const, label: '数据分析', icon: 'ri-bar-chart-box-line' },
    { key: 'persona' as const, label: '用户画像', icon: 'ri-user-heart-line' },
    { key: 'challenge' as const, label: '人机对抗', icon: 'ri-sword-line' },
  ];

  // 新增：查看问卷详情
  const handleViewSurveyDetail = (survey: any) => {
    setSurveyDetailModal({
      isOpen: true,
      survey
    });
  };

  // 新增：一键AI分析
  const handleAiAnalysis = async () => {
    setIsAiAnalyzing(true);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const totalResponses = surveys.reduce((sum, s) => sum + s.collected, 0);
    
    setAiAnalysisReport({
      isVisible: true,
      isExpanded: true,
      data: {
        score: 78,
        conclusions: [
          `目标用户集中在18-22岁年龄段，占比${Math.round(totalResponses * 0.65)}人（65%）`,
          `月均消费能力在100-300元的用户最多，占比42%`,
          `用户对产品满意度整体较高，平均评分4.2/5.0`
        ],
        opportunities: [
          `年轻用户群体对创新产品接受度高，可重点开发社交分享功能`,
          `中等消费能力用户占主流，定价策略可聚焦在性价比路线`
        ],
        risks: [
          `高消费用户占比仅18%，高端市场拓展存在挑战`,
          `用户留存率数据显示需加强产品粘性设计`
        ],
        suggestions: [
          `建议针对18-22岁用户优化UI设计，采用更年轻化的视觉风格`,
          `推出性价比核心产品线，匹配主流消费能力`,
          `增加用户激励机制（积分、会员体系）提升复购率和留存率`
        ]
      }
    });
    
    setIsAiAnalyzing(false);
  };

  return (
    <div className="space-y-6">
      {/* 版本控制工具栏 */}
      <VersionControl
        versions={versions}
        currentVersion={currentVersion}
        onRestore={handleRestore}
        onSaveVersion={handleSaveVersion}
        moduleName="市场调研与用户画像"
      />

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-green-500 text-white px-5 py-3 rounded-xl shadow-lg text-sm flex items-center gap-2">
          <i className="ri-checkbox-circle-fill"></i>{toast}
        </div>
      )}

      {/* Modals */}
      {showQR && <QRCodeModal survey={showQR} onClose={() => setShowQR(null)} />}
      {showAI && <AIGenerateModal plan={plan} onGenerate={handleAIGenerate} onClose={() => setShowAI(false)} />}
      {editingPersona && <EditPersonaModal persona={editingPersona} onSave={handleSaveEdit} onClose={() => setEditingPersona(null)} />}
      {showCreatePersona && <CreatePersonaModal onSave={handleCreatePersona} onClose={() => setShowCreatePersona(false)} />}
      {showAIGeneratePersona && (
        <AIGeneratePersonaModal
          totalCollected={totalCollected}
          onGenerate={handleAIGeneratePersonas}
          onClose={() => setShowAIGeneratePersona(false)}
        />
      )}

      {/* 问卷详情弹窗 */}
      {surveyDetailModal.isOpen && surveyDetailModal.survey && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-green-50 to-teal-50">
              <div>
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <i className="ri-file-list-3-line text-green-600"></i>
                  {surveyDetailModal.survey.title}
                </h3>
                <div className="flex items-center gap-4 mt-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    surveyDetailModal.survey.status === '进行中'
                      ? 'bg-green-100 text-green-700'
                      : surveyDetailModal.survey.status === '已完成'
                      ? 'bg-gray-100 text-gray-600'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {surveyDetailModal.survey.status}
                  </span>
                  <span className="text-sm text-gray-600">
                    <i className="ri-calendar-line mr-1"></i>
                    {surveyDetailModal.survey.createdAt}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSurveyDetailModal({ isOpen: false, survey: null })}
                className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer"
              >
                <i className="ri-close-line text-2xl"></i>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-1 px-6">
              {/* 收集进度 */}
              <div className="bg-green-50 rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">收集进度</span>
                  <span className="text-lg font-bold text-green-600">
                    {surveyDetailModal.survey.collected} / {surveyDetailModal.survey.target}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-green-500 to-teal-400 h-2 rounded-full transition-all"
                    style={{ width: `${surveyDetailModal.survey.target > 0 ? Math.min((surveyDetailModal.survey.collected / surveyDetailModal.survey.target) * 100, 100) : 0}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  完成率 {surveyDetailModal.survey.target > 0 ? Math.round((surveyDetailModal.survey.collected / surveyDetailModal.survey.target) * 100) : 0}%
                </p>
              </div>

              {/* 题目列表 */}
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                  <i className="ri-question-line text-green-600"></i>
                  问卷题目（共 {surveyDetailModal.survey.questions.length} 题）
                </h4>
                {surveyDetailModal.survey.questions.map((question: SurveyQuestion, index: number) => (
                  <div key={question.id} className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-semibold text-sm">
                        {index + 1}
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <p className="font-medium text-gray-800">{question.text}</p>
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full whitespace-nowrap">
                            {question.type}
                          </span>
                        </div>
                        {question.options && question.options.length > 0 && (
                          <div className="space-y-1.5 mt-3">
                            {question.options.map((option: string, optIdx: number) => (
                              <div key={optIdx} className="flex items-center gap-2 text-sm text-gray-600">
                                <span className="w-6 h-6 rounded border border-gray-300 flex items-center justify-center text-xs font-medium bg-white">
                                  {String.fromCharCode(65 + optIdx)}
                                </span>
                                <span>{option}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {question.type === '填空' && (
                          <div className="mt-3 h-10 bg-white border border-dashed border-gray-300 rounded-lg flex items-center px-3">
                            <span className="text-xs text-gray-400">填写答案...</span>
                          </div>
                        )}
                        {question.type === '评分' && (
                          <div className="flex items-center gap-2 mt-3">
                            {[1,2,3,4,5].map(n => (
                              <div key={n} className="w-8 h-8 rounded-full border-2 border-gray-200 flex items-center justify-center text-sm text-gray-500 bg-white">{n}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
              <span className="text-sm text-gray-500">
                <i className="ri-link mr-1"></i>
                {surveyDetailModal.survey.link}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowQR(surveyDetailModal.survey); setSurveyDetailModal({ isOpen: false, survey: null }); }}
                  className="px-4 py-2 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1"
                >
                  <i className="ri-qr-code-line"></i>发放问卷
                </button>
                <button
                  onClick={() => setSurveyDetailModal({ isOpen: false, survey: null })}
                  className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors whitespace-nowrap cursor-pointer"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Module Header */}
      <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-xl p-8 text-white">
        <div className="flex items-start justify-between  ">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <i className="ri-bar-chart-line text-3xl"></i>
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-1">市场调研与用户画像</h2>
              <p className="text-white/80 text-sm">通过真实调研验证用户需求，构建典型用户画像</p>
            </div>
          </div>
          <span className="px-3 py-1.5 rounded-full text-sm font-semibold bg-white/20 text-white whitespace-nowrap">
            <i className="ri-play-circle-fill mr-1.5"></i>进行中
          </span>
        </div>
        {/* <div className="grid grid-cols-3 gap-4">
          <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
            <div className="text-2xl font-bold mb-1">6/8</div>
            <div className="text-sm text-white/70">知识点完成</div>
          </div>
          <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
            <div className="text-2xl font-bold mb-1">4/5</div>
            <div className="text-sm text-white/70">任务完成</div>
          </div>
          <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
            <div className="text-2xl font-bold mb-1">75%</div>
            <div className="text-sm text-white/70">整体进度</div>
          </div>
        </div> */}
      </div>

      {/* Data flow hint */}
      <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
        <i className="ri-links-line text-green-400 text-base"></i>
        <span>数据流向：</span>
        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-lg">调研计划</span>
        <i className="ri-arrow-right-line"></i>
        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-lg">AI生成问卷</span>
        <i className="ri-arrow-right-line"></i>
        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-lg">数据分析图表</span>
        <i className="ri-arrow-right-line"></i>
        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-lg">用户画像</span>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 px-4 py-4 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer min-w-[100px] ${
                activeTab === tab.key
                  ? 'text-green-600 border-b-2 border-green-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <i className={`${tab.icon} mr-2`}></i>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-8">

          {/* ══ 调研计划 ══ */}
          {activeTab === 'plan' && (
            <div className="space-y-8">
              <div className="bg-green-50 border border-green-200 rounded-xl p-6">
                <h3 className="text-base font-bold text-green-900 mb-3">调研计划制定指南</h3>
                <ul className="text-sm text-green-700 space-y-2">
                  <li>• 明确调研目标：围绕核心创意，了解市场需求、竞争情况</li>
                  <li>• 选择调研方法：线上问卷、访谈、行业数据查询等</li>
                  <li>• 明确成员分工：问卷设计、数据收集、数据整理、报告撰写</li>
                  <li>• 设定时间节点：确保按时完成各阶段任务</li>
                </ul>
              </div>

              {plan.savedAt && (
                <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                  <i className="ri-checkbox-circle-fill"></i>
                  <span>计划已保存于 {plan.savedAt}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-3">
                  调研目标 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={plan.goal}
                  onChange={(e) => setPlan({ ...plan, goal: e.target.value })}
                  placeholder="描述本次调研的核心目标和期望获得的信息"
                  rows={4}
                  className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-3">调研方法</label>
                <div className="grid md:grid-cols-3 gap-4">
                  {METHODS.map((method) => (
                    <label
                      key={method}
                      className={`flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-colors ${
                        plan.methods.includes(method)
                          ? 'border-green-400 bg-green-50'
                          : 'border-gray-200 hover:border-green-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={plan.methods.includes(method)}
                        onChange={() => toggleMethod(method)}
                        className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                      />
                      <span className="text-sm text-gray-700">{method}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-900">成员分工</label>
                  <button onClick={addMember} className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1 cursor-pointer">
                    <i className="ri-add-line"></i>添加成员
                  </button>
                </div>
                <div className="space-y-3">
                  {plan.members.map((item, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <input
                        type="text"
                        value={item.role}
                        onChange={(e) => updateMember(index, 'role', e.target.value)}
                        placeholder="分工角色"
                        className="flex-1 px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                      <select
                        value={item.member}
                        onChange={(e) => updateMember(index, 'member', e.target.value)}
                        className="flex-1 px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      >
                        <option value="">选择成员</option>
                        {MEMBERS_OPTIONS.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => removeMember(index)}
                        className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <i className="ri-delete-bin-line"></i>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-3">时间节点</label>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 mb-2">开始时间</label>
                    <input
                      type="date"
                      value={plan.startDate}
                      onChange={(e) => setPlan({ ...plan, startDate: e.target.value })}
                      className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-2">结束时间</label>
                    <input
                      type="date"
                      value={plan.endDate}
                      onChange={(e) => setPlan({ ...plan, endDate: e.target.value })}
                      className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={handleSavePlan}
                disabled={saving}
                className={`w-full px-6 py-3 text-white text-sm font-medium rounded-xl transition-colors whitespace-nowrap cursor-pointer flex items-center justify-center gap-2 ${
                  planSaved ? 'bg-green-600 hover:bg-green-700' : 'bg-green-500 hover:bg-green-600'
                } disabled:opacity-60`}
              >
                {saving ? (
                  <><i className="ri-loader-4-line animate-spin"></i>保存中...</>
                ) : planSaved ? (
                  <><i className="ri-checkbox-circle-line"></i>保存成功！</>
                ) : (
                  <><i className="ri-save-line"></i>保存调研计划</>
                )}
              </button>
            </div>
          )}

          {/* ══ 问卷调查 ══ */}
          {activeTab === 'survey' && (
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">问卷管理</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowAI(true)}
                    className="px-4 py-2 bg-gradient-to-r from-green-500 to-teal-500 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap cursor-pointer flex items-center gap-2"
                  >
                    <i className="ri-robot-line"></i>AI 生成问卷
                  </button>
                  <button
                    onClick={() => {
                      const newSurvey: Survey = {
                        id: `survey-${Date.now()}`,
                        title: '新建问卷',
                        status: '草稿',
                        questions: [],
                        collected: 0,
                        target: 100,
                        link: `https://survey.jxu.edu.cn/s/${Date.now()}`,
                        createdAt: new Date().toLocaleDateString('zh-CN'),
                      };
                      setSurveys([...surveys, newSurvey]);
                      showToast('新问卷已创建！');
                    }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <i className="ri-add-line mr-1"></i>手动创建
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {surveys.map((survey) => (
                  <div key={survey.id} className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-base font-bold text-gray-900">{survey.title}</h4>
                        {survey.fromPlan && (
                          <span className="px-2 py-0.5 bg-green-50 text-green-600 text-xs rounded-full whitespace-nowrap">
                            <i className="ri-robot-line mr-1"></i>AI生成
                          </span>
                        )}
                      </div>
                      <span className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap ${
                        survey.status === '进行中' ? 'bg-green-100 text-green-700'
                          : survey.status === '已完成' ? 'bg-gray-100 text-gray-600'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {survey.status}
                      </span>
                    </div>

                    <div className="space-y-2 mb-4">
                      {[
                        { label: '题目数量', value: `${survey.questions.length}题` },
                        { label: '已收集', value: `${survey.collected}份` },
                        { label: '目标数量', value: `${survey.target}份` },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">{item.label}</span>
                          <span className="font-medium text-gray-900">{item.value}</span>
                        </div>
                      ))}
                    </div>

                    <div className="mb-4">
                      <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                        <span>完成进度</span>
                        <span>{survey.target > 0 ? Math.round((survey.collected / survey.target) * 100) : 0}%</span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full transition-all"
                          style={{ width: `${survey.target > 0 ? Math.min((survey.collected / survey.target) * 100, 100) : 0}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {survey.status === '草稿' ? (
                        <>
                          <button
                            onClick={() => handlePublish(survey.id)}
                            className="flex-1 px-4 py-2 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-colors whitespace-nowrap cursor-pointer"
                          >
                            发布问卷
                          </button>
                          <button
                            onClick={() => handleViewSurveyDetail(survey)}
                            className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer"
                          >
                            <i className="ri-eye-line mr-1"></i>查看详情
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleViewSurveyDetail(survey)}
                            className="flex-1 px-4 py-2 bg-green-50 text-green-600 text-sm font-medium rounded-lg hover:bg-green-100 transition-colors whitespace-nowrap cursor-pointer"
                          >
                            <i className="ri-eye-line mr-1"></i>查看详情
                          </button>
                          <button
                            onClick={() => setShowQR(survey)}
                            className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer flex items-center justify-center gap-1"
                          >
                            <i className="ri-qr-code-line"></i>发放问卷
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══ 数据分析 ══ */}
          {activeTab === 'analysis' && (
            <div className="space-y-8">
              {/* 一键AI分析按钮 */}
              <div className="flex justify-end">
                <button
                  onClick={handleAiAnalysis}
                  disabled={isAiAnalyzing}
                  className="px-6 py-3 bg-gradient-to-r from-green-500 to-teal-500 text-white text-sm font-medium rounded-xl hover:opacity-90 transition-all shadow-lg cursor-pointer disabled:opacity-60 flex items-center gap-2 whitespace-nowrap"
                >
                  {isAiAnalyzing ? (
                    <><i className="ri-loader-4-line animate-spin"></i>AI分析中...</>
                  ) : (
                    <><i className="ri-sparkling-fill"></i>一键AI分析</>
                  )}
                </button>
              </div>

              {/* AI分析报告 */}
              {aiAnalysisReport.isVisible && aiAnalysisReport.data && (
                <div className="bg-gradient-to-br from-green-50 to-teal-50 rounded-xl p-6 border-2 border-green-200">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                        {aiAnalysisReport.data.score}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                          <i className="ri-sparkling-fill text-green-600"></i>
                          AI智能分析报告
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">基于 {totalCollected} 份问卷数据生成</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setAiAnalysisReport(prev => ({ ...prev, isExpanded: !prev.isExpanded }))}
                      className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-700 cursor-pointer"
                    >
                      <i className={`ri-arrow-${aiAnalysisReport.isExpanded ? 'up' : 'down'}-s-line text-xl`}></i>
                    </button>
                  </div>
                  {aiAnalysisReport.isExpanded && (
                    <div className="space-y-4 mt-4">
                      <div>
                        <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                          <i className="ri-lightbulb-flash-fill text-yellow-500"></i>核心结论
                        </h4>
                        {aiAnalysisReport.data.conclusions.map((c, i) => (
                          <div key={i} className="flex items-start gap-2 bg-white/70 rounded-lg p-3 mb-2">
                            <span className="text-green-600 font-semibold">{i + 1}.</span>
                            <span className="text-gray-700 text-sm">{c}</span>
                          </div>
                        ))}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                          <i className="ri-rocket-fill text-green-500"></i>市场机会
                        </h4>
                        {aiAnalysisReport.data.opportunities.map((o, i) => (
                          <div key={i} className="flex items-start gap-2 bg-green-50 rounded-lg p-3 mb-2">
                            <i className="ri-checkbox-circle-fill text-green-600 mt-0.5"></i>
                            <span className="text-gray-700 text-sm">{o}</span>
                          </div>
                        ))}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                          <i className="ri-alert-fill text-orange-500"></i>风险提示
                        </h4>
                        {aiAnalysisReport.data.risks.map((r, i) => (
                          <div key={i} className="flex items-start gap-2 bg-orange-50 rounded-lg p-3 mb-2">
                            <i className="ri-error-warning-fill text-orange-600 mt-0.5"></i>
                            <span className="text-gray-700 text-sm">{r}</span>
                          </div>
                        ))}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                          <i className="ri-compass-3-fill text-teal-500"></i>优化建议
                        </h4>
                        {aiAnalysisReport.data.suggestions.map((s, i) => (
                          <div key={i} className="flex items-start gap-2 bg-teal-50 rounded-lg p-3 mb-2">
                            <span className="text-teal-600 font-semibold">{i + 1}.</span>
                            <span className="text-gray-700 text-sm">{s}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Stats */}
              <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl p-6 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-white/80">问卷回收</span>
                    <i className="ri-file-list-3-line text-2xl text-white/80"></i>
                  </div>
                  <div className="text-3xl font-bold mb-1">{totalCollected}份</div>
                  <div className="text-xs text-white/80">来自 {surveys.filter(s => s.status === '进行中').length} 份进行中问卷</div>
                </div>
                <div className="bg-gradient-to-br from-teal-500 to-cyan-500 rounded-xl p-6 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-white/80">有效样本</span>
                    <i className="ri-checkbox-circle-line text-2xl text-white/80"></i>
                  </div>
                  <div className="text-3xl font-bold mb-1">{validSamples}份</div>
                  <div className="text-xs text-white/80">有效率91%</div>
                </div>
                <div className="bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl p-6 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-white/80">访谈记录</span>
                    <i className="ri-user-voice-line text-2xl text-white/80"></i>
                  </div>
                  <div className="text-3xl font-bold mb-1">24人</div>
                  <div className="text-xs text-white/80">深度访谈</div>
                </div>
              </div>

              {/* Charts */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="text-base font-bold text-gray-900 mb-4">
                    <i className="ri-pie-chart-line text-green-500 mr-2"></i>年龄分布
                  </h3>
                  <PieChart items={ageData} />
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="text-base font-bold text-gray-900 mb-4">
                    <i className="ri-pie-chart-2-line text-amber-500 mr-2"></i>月均消费分布
                  </h3>
                  <PieChart items={spendingData} />
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="text-base font-bold text-gray-900 mb-4">
                  <i className="ri-pie-chart-line text-teal-500 mr-2"></i>满意度分布
                </h3>
                <PieChart items={satisfactionData} />
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="text-base font-bold text-gray-900 mb-6">
                  <i className="ri-bar-chart-horizontal-line text-pink-500 mr-2"></i>用户改进需求排行
                </h3>
                <BarChart items={improvementData} />
              </div>

              {/* Key Findings */}
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h3 className="text-base font-bold text-gray-900 mb-4">核心发现</h3>
                <div className="space-y-4">
                  {[
                    { title: '用户痛点明确', desc: '85%的用户表示高峰期配送时间过长，平均等待超过45分钟' },
                    { title: '价格敏感度高', desc: '学生群体对配送费用敏感，72%希望配送费低于3元' },
                    { title: '市场机会存在', desc: '校园内配送场景独特，现有平台未能很好满足需求' },
                  ].map((item, i) => (
                    <div key={i} className="flex gap-4">
                      <div className="w-10 h-10 flex items-center justify-center bg-green-100 text-green-600 rounded-lg flex-shrink-0">
                        <i className="ri-check-line text-lg"></i>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-gray-900 mb-1">{item.title}</h4>
                        <p className="text-sm text-gray-600">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={handleExport}
                disabled={exporting}
                className={`w-full px-6 py-3 text-white text-sm font-medium rounded-xl transition-colors whitespace-nowrap cursor-pointer flex items-center justify-center gap-2 ${
                  exported ? 'bg-green-600 hover:bg-green-700' : 'bg-green-500 hover:bg-green-600'
                } disabled:opacity-60`}
              >
                {exporting ? (
                  <><i className="ri-loader-4-line animate-spin"></i>正在生成报告...</>
                ) : exported ? (
                  <><i className="ri-checkbox-circle-line"></i>报告已导出！</>
                ) : (
                  <><i className="ri-file-download-line"></i>导出调研报告</>
                )}
              </button>
            </div>
          )}

          {/* ══ 用户画像 ══ */}
          {activeTab === 'persona' && (
            <div className="space-y-8">
              <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                <p className="text-sm text-green-700">
                  <i className="ri-information-line mr-2"></i>
                  用户画像数据来源于问卷调查和数据分析模块，悬停卡片可编辑或删除画像
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                {personas.map((persona) => (
                  <div key={persona.id} className={`bg-white border-2 ${persona.borderColor} rounded-2xl p-8 relative group`}>
                    {/* Action buttons */}
                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setEditingPersona(persona)}
                        className="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 text-gray-500 hover:text-green-600 hover:border-green-300 rounded-lg shadow-sm transition-colors cursor-pointer"
                        title="编辑画像"
                      >
                        <i className="ri-edit-line text-sm"></i>
                      </button>
                      <button
                        onClick={() => handleDeletePersona(persona.id)}
                        className="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 text-gray-500 hover:text-red-500 hover:border-red-300 rounded-lg shadow-sm transition-colors cursor-pointer"
                        title="删除画像"
                      >
                        <i className="ri-delete-bin-line text-sm"></i>
                      </button>
                    </div>

                    <div className="flex items-start gap-6 mb-6">
                      <img
                        src={persona.avatar}
                        alt={persona.name}
                        className="w-24 h-24 rounded-full object-top object-cover border-4 border-gray-100 flex-shrink-0"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-2xl font-bold text-gray-900">{persona.name}</h3>
                          {persona.fromSurvey && (
                            <span className="px-2 py-0.5 bg-green-50 text-green-600 text-xs rounded-full whitespace-nowrap">
                              <i className="ri-survey-line mr-1"></i>来自调研
                            </span>
                          )}
                        </div>
                        <div className="space-y-1 text-sm text-gray-600">
                          <p><strong className="text-gray-900">年龄：</strong>{persona.age}岁</p>
                          <p><strong className="text-gray-900">职业：</strong>{persona.occupation}</p>
                          <p><strong className="text-gray-900">专业：</strong>{persona.major}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {[
                        { field: 'painPoints' as const, label: '核心痛点', icon: 'ri-heart-pulse-line' },
                        { field: 'needs' as const, label: '核心诉求', icon: 'ri-star-line' },
                        { field: 'habits' as const, label: '消费习惯', icon: 'ri-shopping-bag-line' },
                      ].map(({ field, label, icon }) => (
                        <div key={field}>
                          <h4 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                            <i className={`${icon} ${persona.accentColor}`}></i>
                            {label}
                          </h4>
                          <ul className="text-sm text-gray-600 space-y-1">
                            {persona[field].filter(Boolean).map((item, i) => (
                              <li key={i}>• {item}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => setEditingPersona(persona)}
                      className="mt-6 w-full py-2 border border-gray-200 text-gray-600 text-sm rounded-xl hover:border-green-300 hover:text-green-600 transition-colors cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                      <i className="ri-edit-line"></i>编辑此画像
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setShowAIGeneratePersona(true)}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-medium rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <i className="ri-robot-line"></i>AI 生成画像
                </button>
                <button
                  onClick={() => setShowCreatePersona(true)}
                  className="flex-1 px-6 py-3 bg-green-500 text-white text-sm font-medium rounded-xl hover:bg-green-600 transition-colors whitespace-nowrap cursor-pointer flex items-center justify-center gap-2"
                >
                  <i className="ri-add-line"></i>手动创建画像
                </button>
                <button
                  onClick={() => showToast('用户画像已导出 ✓')}
                  className="px-6 py-3 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-2"
                >
                  <i className="ri-download-line"></i>导出画像
                </button>
              </div>
            </div>
          )}

          {/* ══ 人机对抗 ══ */}
          {activeTab === 'challenge' && (
            <ChallengeTabInline savedTheme={savedTheme} />
          )}

        </div>
      </div>
    </div>
  );
}
