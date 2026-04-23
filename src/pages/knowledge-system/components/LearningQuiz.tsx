
import { useState } from 'react';

interface Question {
  id: string;
  type: 'single' | 'multiple' | 'short';
  question: string;
  options?: string[];
  correctAnswer?: number | number[];
  answer?: string;
  explanation: string;
}

interface LearningQuizProps {
  knowledgeName: string;
  onPass?: () => void;
  onFail?: () => void;
}

const quizData: Question[] = [
  {
    id: 'q1',
    type: 'single',
    question: '头脑风暴法的核心原则是什么？',
    options: [
      'A. 立即评价每个创意的可行性',
      'B. 延迟判断，在创意生成阶段禁止批评',
      'C. 只允许专家发言，确保质量',
      'D. 限制创意数量，追求精品',
    ],
    correctAnswer: 1,
    explanation: '头脑风暴法的核心原则是"延迟判断"——在创意生成阶段，禁止任何批评和评价，以数量带动质量，鼓励自由联想。',
  },
  {
    id: 'q2',
    type: 'single',
    question: '头脑风暴中出现"从众效应"时，最有效的解决方案是？',
    options: [
      'A. 让最有经验的人先发言',
      'B. 增加参与人数',
      'C. 让每人先独立思考5分钟再开始讨论',
      'D. 缩短讨论时间',
    ],
    correctAnswer: 2,
    explanation: '从众效应是指后发言者倾向于附和先发言者。解决方法是让每人先独立思考并记录想法，再进行集体讨论，避免被他人观点影响。',
  },
  {
    id: 'q3',
    type: 'multiple',
    question: '以下哪些是头脑风暴法的正确实施步骤？（多选）',
    options: [
      'A. 明确问题陈述，确保所有人理解目标',
      'B. 在发散阶段立即筛选掉不可行的创意',
      'C. 鼓励在他人想法基础上进行延伸和组合',
      'D. 对所有创意进行分类整理后再评估',
    ],
    correctAnswer: [0, 2, 3],
    explanation: '正确步骤包括：明确问题→热身→发散（不批评）→整理→评估。在发散阶段不应筛选创意，应保留所有想法。',
  },
  {
    id: 'q4',
    type: 'short',
    question: '请简述"书面头脑风暴（Brainwriting）"的适用场景及其优势。',
    explanation: '书面头脑风暴适用于：①团队中有内向成员，不善于当众发言；②需要避免从众效应；③希望收集更多独立、多元的想法。优势在于每人独立书写，不受他人影响，能产生更多元化的创意。',
  },
];

export default function LearningQuiz({
  knowledgeName,
  onPass,
  onFail,
}: LearningQuizProps) {
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<
    Record<string, number | number[] | string>
  >({});
  const [submitted, setSubmitted] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);

  const question = quizData[currentQ];
  const totalQ = quizData.length;

  const handleSingleSelect = (idx: number) => {
    if (submitted) return;
    setAnswers({ ...answers, [question.id]: idx });
  };

  const handleMultiSelect = (idx: number) => {
    if (submitted) return;
    const current = (answers[question.id] as number[]) || [];
    const updated = current.includes(idx)
      ? current.filter((i) => i !== idx)
      : [...current, idx].sort();
    setAnswers({ ...answers, [question.id]: updated });
  };

  const handleShortAnswer = (val: string) => {
    setAnswers({ ...answers, [question.id]: val });
  };

  const isAnswered = (q: Question) => {
    const ans = answers[q.id];
    if (q.type === 'short')
      return typeof ans === 'string' && ans.trim().length > 10;
    if (q.type === 'multiple') return Array.isArray(ans) && ans.length > 0;
    return ans !== undefined;
  };

  const calcScore = () => {
    let correct = 0;
    quizData.forEach((q) => {
      if (q.type === 'short') {
        const ans = answers[q.id] as string;
        if (ans && ans.trim().length > 20) correct++;
      } else if (q.type === 'single') {
        if (answers[q.id] === q.correctAnswer) correct++;
      } else if (q.type === 'multiple') {
        const ans = (answers[q.id] as number[]) || [];
        const correctAns = q.correctAnswer as number[];
        if (
          JSON.stringify(ans.sort()) === JSON.stringify(correctAns.sort())
        )
          correct++;
      }
    });
    return Math.round((correct / quizData.length) * 100);
  };

  const handleSubmit = () => {
    const s = calcScore();
    setScore(s);
    setSubmitted(true);
    setShowResult(true);
    if (s >= 60) onPass?.();
    else onFail?.();
  };

  const handleRetry = () => {
    setAnswers({});
    setSubmitted(false);
    setShowResult(false);
    setCurrentQ(0);
    setScore(0);
  };

  const isCorrect = (q: Question) => {
    if (q.type === 'short') return true;
    if (q.type === 'single') return answers[q.id] === q.correctAnswer;
    const ans = (answers[q.id] as number[]) || [];
    const ca = q.correctAnswer as number[];
    return JSON.stringify(ans.sort()) === JSON.stringify(ca.sort());
  };

  if (showResult) {
    const passed = score >= 60;
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
        {/* 结果头部 */}
        <div
          className={`rounded-2xl p-8 text-center mb-8 ${
            passed
              ? 'bg-gradient-to-br from-green-50 to-teal-50'
              : 'bg-gradient-to-br from-red-50 to-orange-50'
          }`}
        >
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg ${
              passed ? 'bg-green-500' : 'bg-red-400'
            }`}
          >
            <i
              className={`${
                passed ? 'ri-trophy-fill' : 'ri-close-circle-fill'
              } text-4xl text-white`}
            ></i>
          </div>
          <h3
            className={`text-2xl font-bold mb-2 ${
              passed ? 'text-green-700' : 'text-red-600'
            }`}
          >
            {passed ? '🎉 检测通过！' : '未达标，需重新学习'}
          </h3>
          <div
            className={`text-5xl font-bold mb-2 ${
              passed ? 'text-green-600' : 'text-red-500'
            }`}
          >
            {score}分
          </div>
          <p
            className={`text-sm ${
              passed ? 'text-green-600' : 'text-red-500'
            }`}
          >
            {passed
              ? `恭喜！你已掌握「${knowledgeName}」的核心知识，可以开始实践任务了！`
              : '建议重新学习知识点后再次检测，加油！'}
          </p>
          {passed && (
            <div className="mt-4 inline-flex items-center space-x-2 bg-green-100 text-green-700 px-4 py-2 rounded-full text-sm font-medium">
              <i className="ri-medal-fill"></i>
              <span>已解锁实践任务 · 获得能力点资格</span>
            </div>
          )}
        </div>

        {/* 答题详情 */}
        <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
          <i className="ri-file-list-3-line text-teal-600 mr-2"></i>
          答题详情
        </h4>
        <div className="space-y-4 mb-6">
          {quizData.map((q, idx) => {
            const correct = isCorrect(q);
            return (
              <div
                key={q.id}
                className={`rounded-xl p-5 border-2 ${
                  correct ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                }`}
              >
                <div className="flex items-start space-x-3 mb-3">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                      correct ? 'bg-green-500' : 'bg-red-400'
                    }`}
                  >
                    <i
                      className={`${
                        correct ? 'ri-check-line' : 'ri-close-line'
                      } text-white text-sm`}
                    ></i>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900 mb-1">
                      第{idx + 1}题 ·{' '}
                      {q.type === 'single'
                        ? '单选题'
                        : q.type === 'multiple'
                        ? '多选题'
                        : '简答题'}
                    </p>
                    <p className="text-sm text-gray-700">{q.question}</p>
                  </div>
                </div>
                <div className="ml-10 p-3 bg-white rounded-lg border border-gray-200">
                  <p className="text-xs font-semibold text-gray-500 mb-1">
                    解析：
                  </p>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {q.explanation}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex space-x-4">
          {!passed && (
            <button
              onClick={handleRetry}
              className="flex-1 py-3 bg-gradient-to-r from-teal-500 to-cyan-600 hover:shadow-lg text-white rounded-xl font-semibold transition-all whitespace-nowrap"
            >
              <i className="ri-refresh-line mr-2"></i>重新检测
            </button>
          )}
          {passed && (
            <button className="flex-1 py-3 bg-gradient-to-r from-green-500 to-teal-500 hover:shadow-lg text-white rounded-xl font-semibold transition-all whitespace-nowrap">
              <i className="ri-arrow-right-line mr-2"></i>开始实践任务
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* 顶部进度 */}
      <div className="bg-gradient-to-r from-teal-500 to-cyan-600 px-6 py-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-white font-bold text-lg">学习检测</h3>
            <p className="text-teal-100 text-sm mt-0.5">
              「{knowledgeName}」知识掌握度测试
            </p>
          </div>
          <div className="text-right">
            <div className="text-white text-2xl font-bold">
              {currentQ + 1}
              <span className="text-teal-200 text-base font-normal">
                /{totalQ}
              </span>
            </div>
            <p className="text-teal-200 text-xs">60分及格</p>
          </div>
        </div>
        <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-white rounded-full transition-all duration-500"
            style={{
              width: `${((currentQ + 1) / totalQ) * 100}%`,
            }}
          ></div>
        </div>
        {/* 题目导航点 */}
        <div className="flex items-center space-x-2 mt-3">
          {quizData.map((q, idx) => (
            <button
              key={q.id}
              onClick={() => setCurrentQ(idx)}
              className={`w-7 h-7 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                idx === currentQ
                  ? 'bg-white text-teal-600 shadow-lg scale-110'
                  : isAnswered(q)
                  ? 'bg-teal-300 text-white'
                  : 'bg-white/20 text-white'
              }`}
            >
              {idx + 1}
            </button>
          ))}
          <span className="text-teal-200 text-xs ml-2">
            已答 {quizData.filter(isAnswered).length}/{totalQ}
          </span>
        </div>
      </div>

      {/* 题目内容 */}
      <div className="p-6">
        <div className="mb-2 flex items-center space-x-2">
          <span
            className={`px-2 py-0.5 rounded-md text-xs font-medium ${
              question.type === 'single'
                ? 'bg-blue-100 text-blue-600'
                : question.type === 'multiple'
                ? 'bg-purple-100 text-purple-600'
                : 'bg-orange-100 text-orange-600'
            }`}
          >
            {question.type === 'single'
              ? '单选题'
              : question.type === 'multiple'
              ? '多选题'
              : '简答题'}
          </span>
          {question.type === 'multiple' && (
            <span className="text-xs text-gray-400">（可多选）</span>
          )}
        </div>

        <p className="text-base font-semibold text-gray-900 mb-5 leading-relaxed">
          {question.question}
        </p>

        {/* 选项 */}
        {question.type !== 'short' && question.options && (
          <div className="space-y-3">
            {question.options.map((opt, idx) => {
              const isSelected =
                question.type === 'single'
                  ? answers[question.id] === idx
                  : ((answers[question.id] as number[]) || []).includes(idx);
              return (
                <button
                  key={idx}
                  onClick={() =>
                    question.type === 'single'
                      ? handleSingleSelect(idx)
                      : handleMultiSelect(idx)
                  }
                  className={`w-full text-left px-4 py-3.5 rounded-xl border-2 transition-all text-sm font-medium whitespace-normal ${
                    isSelected
                      ? 'border-teal-500 bg-teal-50 text-teal-700'
                      : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-teal-300 hover:bg-teal-50/50'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-5 h-5 flex-shrink-0 rounded-${
                        question.type === 'multiple' ? 'md' : 'full'
                      } border-2 flex items-center justify-center transition-all ${
                        isSelected
                          ? 'border-teal-500 bg-teal-500'
                          : 'border-gray-300'
                      }`}
                    >
                      {isSelected && (
                        <i className="ri-check-line text-white text-xs"></i>
                      )}
                    </div>
                    <span>{opt}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* 简答题 */}
        {question.type === 'short' && (
          <div>
            <textarea
              value={(answers[question.id] as string) || ''}
              onChange={(e) => handleShortAnswer(e.target.value)}
              placeholder="请在此输入你的回答（至少20字）..."
              className="w-full border-2 border-gray-200 focus:border-teal-400 rounded-xl p-4 text-sm text-gray-700 resize-none focus:outline-none transition-colors leading-relaxed"
              rows={5}
              maxLength={500}
            />
            <div className="flex justify-between mt-1">
              <span className="text-xs text-gray-400">至少输入20个字</span>
              <span className="text-xs text-gray-400">
                {((answers[question.id] as string) || '').length}/500
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 底部操作 */}
      <div className="px-6 pb-6 flex items-center justify-between">
        <button
          onClick={() => setCurrentQ(Math.max(0, currentQ - 1))}
          disabled={currentQ === 0}
          className="flex items-center space-x-2 px-5 py-2.5 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 rounded-xl text-sm font-medium transition-all whitespace-nowrap"
        >
          <i className="ri-arrow-left-line"></i>
          <span>上一题</span>
        </button>

        {currentQ < totalQ - 1 ? (
          <button
            onClick={() => setCurrentQ(currentQ + 1)}
            disabled={!isAnswered(question)}
            className="flex items-center space-x-2 px-5 py-2.5 bg-teal-500 hover:bg-teal-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-all whitespace-nowrap"
          >
            <span>下一题</span>
            <i className="ri-arrow-right-line"></i>
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={quizData.filter(isAnswered).length < totalQ}
            className="flex items-center space-x-2 px-6 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-600 hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold transition-all whitespace-nowrap"
          >
            <i className="ri-send-plane-fill"></i>
            <span>提交检测</span>
          </button>
        )}
      </div>
    </div>
  );
}
