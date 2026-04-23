
import { useState } from 'react';
import { Survey, SurveyQuestion, ResearchPlan } from '../types';

interface Props {
  surveys: Survey[];
  plan: ResearchPlan;
  onSurveysChange: (surveys: Survey[]) => void;
}

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

function QRCodeModal({ survey, onClose }: { survey: Survey; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(survey.link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Generate a simple QR-like visual using the survey id as seed
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
          {/* QR Code visual */}
          <div className="inline-block p-4 bg-white border-2 border-gray-200 rounded-xl">
            <div className="grid gap-0" style={{ gridTemplateColumns: 'repeat(21, 10px)', width: 210 }}>
              {qrCells.map((filled, i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 ${filled ? 'bg-gray-900' : 'bg-white'}`}
                />
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
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                copied ? 'bg-green-500 text-white' : 'bg-purple-500 text-white hover:bg-purple-600'
              }`}
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
    if (!title.trim()) {
      setTitle('校园配送需求调研问卷');
    }
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
      { id: `custom-${Date.now()}`, text: '', type: '单选', options: ['选项A', '选项B'] },
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
            <div className="w-9 h-9 flex items-center justify-center bg-purple-100 text-purple-600 rounded-lg">
              <i className="ri-robot-line text-lg"></i>
            </div>
            <h3 className="text-lg font-bold text-gray-900">AI 协助生成问卷</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer">
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Plan summary */}
          {plan.goal && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
              <p className="text-xs font-medium text-purple-700 mb-1">
                <i className="ri-file-list-3-line mr-1"></i>基于调研计划自动生成
              </p>
              <p className="text-sm text-purple-800 line-clamp-2">{plan.goal}</p>
              {plan.methods.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {plan.methods.map((m) => (
                    <span key={m} className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">{m}</span>
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
              className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {!generated ? (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full py-3 bg-purple-500 text-white text-sm font-medium rounded-xl hover:bg-purple-600 transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
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
                <button
                  onClick={addQuestion}
                  className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1 cursor-pointer"
                >
                  <i className="ri-add-line"></i>添加题目
                </button>
              </div>
              {questions.map((q, idx) => (
                <div key={q.id} className="border border-gray-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-purple-100 text-purple-700 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
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
                          className="w-full text-sm border-b border-purple-400 focus:outline-none pb-1"
                        />
                      ) : (
                        <p
                          className="text-sm text-gray-800 cursor-pointer hover:text-purple-600"
                          onClick={() => setEditingIdx(idx)}
                        >
                          {q.text}
                        </p>
                      )}
                      <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">{q.type}</span>
                    </div>
                    <button
                      onClick={() => removeQuestion(idx)}
                      className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-red-400 rounded cursor-pointer"
                    >
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
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 py-3 bg-purple-500 text-white text-sm font-medium rounded-xl hover:bg-purple-600 transition-colors cursor-pointer"
            >
              <i className="ri-check-line mr-1"></i>确认创建问卷
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SurveyTab({ surveys, plan, onSurveysChange }: Props) {
  const [showQR, setShowQR] = useState<Survey | null>(null);
  const [showAI, setShowAI] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const handlePublish = (id: string) => {
    onSurveysChange(surveys.map((s) => (s.id === id ? { ...s, status: '进行中' } : s)));
    showToast('问卷已发布！');
  };

  const handleAIGenerate = (title: string, questions: SurveyQuestion[]) => {
    const newSurvey: Survey = {
      id: `survey-${Date.now()}`,
      title,
      status: '草稿',
      questions,
      collected: 0,
      target: 200,
      link: `https://survey.example.com/s/${Date.now()}`,
      createdAt: new Date().toLocaleDateString('zh-CN'),
      fromPlan: true,
    };
    onSurveysChange([...surveys, newSurvey]);
    setShowAI(false);
    showToast('问卷已创建，可发布后开始收集数据！');
  };

  return (
    <div className="space-y-8">
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-green-500 text-white px-5 py-3 rounded-xl shadow-lg text-sm flex items-center gap-2 animate-fade-in">
          <i className="ri-checkbox-circle-fill"></i>{toast}
        </div>
      )}

      {showQR && <QRCodeModal survey={showQR} onClose={() => setShowQR(null)} />}
      {showAI && <AIGenerateModal plan={plan} onGenerate={handleAIGenerate} onClose={() => setShowAI(false)} />}

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900">问卷管理</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAI(true)}
            className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap cursor-pointer flex items-center gap-2"
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
                link: `https://survey.example.com/s/${Date.now()}`,
                createdAt: new Date().toLocaleDateString('zh-CN'),
              };
              onSurveysChange([...surveys, newSurvey]);
              showToast('新问卷已创建！');
            }}
            className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer"
          >
            <i className="ri-add-line mr-1"></i>手动创建
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {surveys.map((survey) => (
          <div key={survey.id} className="border border-gray-200 rounded-xl p-6 hover:border-purple-200 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h4 className="text-base font-bold text-gray-900">{survey.title}</h4>
                {survey.fromPlan && (
                  <span className="px-2 py-0.5 bg-purple-50 text-purple-600 text-xs rounded-full whitespace-nowrap">
                    <i className="ri-robot-line mr-1"></i>AI生成
                  </span>
                )}
              </div>
              <span
                className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap ${
                  survey.status === '进行中'
                    ? 'bg-green-100 text-green-700'
                    : survey.status === '已完成'
                    ? 'bg-gray-100 text-gray-600'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                {survey.status}
              </span>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">题目数量</span>
                <span className="font-medium text-gray-900">{survey.questions.length}题</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">已收集</span>
                <span className="font-medium text-gray-900">{survey.collected}份</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">目标数量</span>
                <span className="font-medium text-gray-900">{survey.target}份</span>
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                <span>完成进度</span>
                <span>{survey.target > 0 ? Math.round((survey.collected / survey.target) * 100) : 0}%</span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all"
                  style={{ width: `${survey.target > 0 ? Math.min((survey.collected / survey.target) * 100, 100) : 0}%` }}
                />
              </div>
            </div>

            <div className="flex gap-2">
              {survey.status === '草稿' ? (
                <>
                  <button
                    onClick={() => handlePublish(survey.id)}
                    className="flex-1 px-4 py-2 bg-purple-500 text-white text-sm font-medium rounded-lg hover:bg-purple-600 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    发布问卷
                  </button>
                  <button
                    onClick={() => showToast('编辑功能开发中')}
                    className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    编辑
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => showToast('查看详情功能开发中')}
                    className="flex-1 px-4 py-2 bg-purple-50 text-purple-600 text-sm font-medium rounded-lg hover:bg-purple-100 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    查看详情
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
  );
}
