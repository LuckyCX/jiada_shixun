import { useState } from 'react';
import { QuizConfig, QuizQuestion } from '../../../mocks/quizBank';

export type { QuizConfig, QuizQuestion };

interface QuizModalProps {
  config: QuizConfig;
  onClose: () => void;
  onPass: (knowledgeId: string, moduleId: string, score: number, answers: Record<string, number | number[] | string>) => void;
}

export default function QuizModal({ config, onClose, onPass }: QuizModalProps) {
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number | number[] | string>>({});
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [passed, setPassed] = useState(false);

  const { questions, passingScore, knowledgeName, moduleName } = config;
  const totalQ = questions.length;
  const question = questions[currentQ];

  /** ---------- Answer handlers ---------- **/
  const handleSingleSelect = (idx: number) => {
    setAnswers({ ...answers, [question.id]: idx });
  };

  const handleMultiSelect = (idx: number) => {
    const current = (answers[question.id] as number[]) || [];
    const updated = current.includes(idx)
      ? current.filter((i) => i !== idx)
      : [...current, idx].sort();
    setAnswers({ ...answers, [question.id]: updated });
  };

  const handleShortAnswer = (val: string) => {
    setAnswers({ ...answers, [question.id]: val });
  };

  /** ---------- Validation helpers ---------- **/
  const isAnswered = (q: QuizQuestion) => {
    const ans = answers[q.id];
    if (q.type === 'short')
      return typeof ans === 'string' && ans.trim().length >= 20;
    if (q.type === 'multiple')
      return Array.isArray(ans) && (ans as number[]).length > 0;
    return ans !== undefined;
  };

  /** ---------- Scoring logic ---------- **/
  const calcQuestionScore = (q: QuizQuestion): number => {
    if (q.type === 'short') {
      const ans = (answers[q.id] as string) || '';
      const trimmed = ans.trim();
      if (trimmed.length < 20) return 0;
      const keywords = q.keywords || [];
      const matchCount = keywords.filter((kw) => trimmed.includes(kw)).length;
      const keywordRatio = keywords.length > 0 ? matchCount / keywords.length : 1;
      const lengthBonus = Math.min(trimmed.length / 100, 1);
      return Math.round(
        q.score *
          Math.min(keywordRatio * 0.7 + lengthBonus * 0.3, 1)
      );
    }

    if (q.type === 'single') {
      return answers[q.id] === q.correctAnswer ? q.score : 0;
    }

    if (q.type === 'multiple') {
      const ans = ((answers[q.id] as number[]) || []).slice().sort();
      const ca = ((q.correctAnswer as number[]) || []).slice().sort();

      // 完全匹配得满分
      if (JSON.stringify(ans) === JSON.stringify(ca)) return q.score;

      const correctSelected = ans.filter((a) => ca.includes(a)).length;
      const wrongSelected = ans.filter((a) => !ca.includes(a)).length;

      // 只要有错误选项则得 0 分
      if (wrongSelected > 0) return 0;

      // 部分正确按比例计分（最高 50%）
      return Math.round((correctSelected / ca.length) * q.score * 0.5);
    }

    return 0;
  };

  const isCorrect = (q: QuizQuestion): boolean => {
    if (q.type === 'short') return calcQuestionScore(q) >= q.score * 0.6;
    if (q.type === 'single') return answers[q.id] === q.correctAnswer;
    const ans = ((answers[q.id] as number[]) || []).slice().sort();
    const ca = ((q.correctAnswer as number[]) || []).slice().sort();
    return JSON.stringify(ans) === JSON.stringify(ca);
  };

  /** ---------- Submit / Retry ---------- **/
  const handleSubmit = () => {
    const totalScore = questions.reduce((sum, q) => sum + calcQuestionScore(q), 0);
    const maxScore = questions.reduce((sum, q) => sum + q.score, 0);
    const finalScore = Math.round((totalScore / maxScore) * 100);
    setScore(finalScore);
    const isPass = finalScore >= passingScore;
    setPassed(isPass);
    setShowResult(true);
    if (isPass) {
      onPass(config.knowledgeId, config.moduleId, finalScore, answers);
    }
  };

  const handleRetry = () => {
    setAnswers({});
    setShowResult(false);
    setCurrentQ(0);
    setScore(0);
    setPassed(false);
  };

  const answeredCount = questions.filter(isAnswered).length;

  /** ---------- Result page ---------- **/
  if (showResult) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div
            className={`rounded-t-2xl p-8 text-center ${
              passed
                ? 'bg-gradient-to-br from-green-50 to-teal-50'
                : 'bg-gradient-to-br from-red-50 to-orange-50'
            }`}
          >
            <div
              className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg ${
                passed
                  ? 'bg-gradient-to-br from-green-400 to-teal-500'
                  : 'bg-gradient-to-br from-red-400 to-orange-500'
              }`}
            >
              <i
                className={`${
                  passed ? 'ri-trophy-fill' : 'ri-close-circle-fill'
                } text-4xl text-white`}
              />
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
              className={`text-sm ${passed ? 'text-green-600' : 'text-red-500'}`}
            >
              {passed
                ? `恭喜！你已掌握「${knowledgeName}」的核心知识，对应实训模块已解锁！`
                : `及格线 ${passingScore} 分，建议重新学习后再次检测。`}
            </p>
            {passed && (
              <div className="mt-4 inline-flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-full text-sm font-medium">
                <i className="ri-medal-fill" />
                <span>知识点已完成 · 对应实训模块已解锁</span>
              </div>
            )}
          </div>

          {/* Details */}
          <div className="p-6">
            <h4 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
              <i className="ri-file-list-3-line text-teal-600" />
              答题详情
            </h4>
            <div className="space-y-3 mb-6">
              {questions.map((q, idx) => {
                const correct = isCorrect(q);
                const qScore = calcQuestionScore(q);
                return (
                  <div
                    key={q.id}
                    className={`rounded-xl p-4 border-2 ${
                      correct ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                    }`}
                  >
                    <div className="flex items-start gap-3 mb-2">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          correct ? 'bg-green-500' : 'bg-red-400'
                        }`}
                      >
                        <i
                          className={`${
                            correct ? 'ri-check-line' : 'ri-close-line'
                          } text-white text-xs`}
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-gray-500">
                            第{idx + 1}题 ·{' '}
                            {q.type === 'single'
                              ? '单选'
                              : q.type === 'multiple'
                              ? '多选'
                              : '简答'}
                          </span>
                          <span
                            className={`text-xs font-bold ${
                              correct ? 'text-green-600' : 'text-red-500'
                            }`}
                          >
                            {qScore}/{q.score}分
                          </span>
                        </div>
                        <p className="text-sm text-gray-800 mb-2">{q.question}</p>
                        <div className="bg-white rounded-lg p-3 border border-gray-200">
                          <p className="text-xs font-semibold text-gray-400 mb-1">
                            解析：
                          </p>
                          <p className="text-xs text-gray-700 leading-relaxed">
                            {q.explanation}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3">
              {!passed && (
                <button
                  onClick={handleRetry}
                  className="flex-1 py-3 bg-gradient-to-r from-teal-500 to-cyan-600 hover:shadow-lg text-white rounded-xl font-semibold transition-all whitespace-nowrap cursor-pointer"
                >
                  <i className="ri-refresh-line mr-2" />
                  重新检测
                </button>
              )}
              <button
                onClick={onClose}
                className={`${
                  passed ? 'flex-1' : 'px-6'
                } py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-all whitespace-nowrap cursor-pointer`}
              >
                {passed ? (
                  <>
                    <i className="ri-arrow-right-line mr-2" />
                    返回知识点库
                  </>
                ) : (
                  '关闭'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /** ---------- Quiz page ---------- **/
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header with progress */}
        <div className="bg-gradient-to-r from-teal-500 to-cyan-600 px-6 py-5 rounded-t-2xl">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-white font-bold text-lg">学习检测</h3>
              <p className="text-teal-100 text-sm mt-0.5">
                「{knowledgeName}」· {moduleName}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-white text-2xl font-bold">
                  {currentQ + 1}
                  <span className="text-teal-200 text-base font-normal">
                    /{totalQ}
                  </span>
                </div>
                <p className="text-teal-200 text-xs">{passingScore}分及格</p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-all cursor-pointer"
              >
                <i className="ri-close-line text-white text-sm" />
              </button>
            </div>
          </div>
          <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden mb-3">
            <div
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${((currentQ + 1) / totalQ) * 100}%` }}
            />
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-2">
            {questions.map((q, idx) => (
              <button
                key={q.id}
                onClick={() => setCurrentQ(idx)}
                className={`w-7 h-7 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
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
              已答 {answeredCount}/{totalQ}
            </span>
          </div>
        </div>

        {/* Question body */}
        <div className="p-6">
          <div className="mb-3 flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                question.type === 'single'
                  ? 'bg-teal-100 text-teal-600'
                  : question.type === 'multiple'
                  ? 'bg-orange-100 text-orange-600'
                  : 'bg-green-100 text-green-600'
              }`}
            >
              {question.type === 'single'
                ? '单选题'
                : question.type === 'multiple'
                ? '多选题'
                : '简答题'}
            </span>
            <span className="text-xs text-gray-400 font-medium">
              {question.score}分
            </span>
            {question.type === 'multiple' && (
              <span className="text-xs text-gray-400">（可多选）</span>
            )}
          </div>

          <p className="text-base font-semibold text-gray-900 mb-5 leading-relaxed">
            {question.question}
          </p>

          {/* Options */}
          {question.type !== 'short' && question.options && (
            <div className="space-y-3">
              {question.options.map((opt, idx) => {
                const isSelected =
                  question.type === 'single'
                    ? answers[question.id] === idx
                    : ((answers[question.id] as number[]) || []).includes(
                        idx
                      );
                return (
                  <button
                    key={idx}
                    onClick={() =>
                      question.type === 'single'
                        ? handleSingleSelect(idx)
                        : handleMultiSelect(idx)
                    }
                    className={`w-full text-left px-4 py-3.5 rounded-xl border-2 transition-all text-sm font-medium whitespace-normal cursor-pointer ${
                      isSelected
                        ? 'border-teal-500 bg-teal-50 text-teal-700'
                        : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-teal-300 hover:bg-teal-50/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-5 h-5 flex-shrink-0 ${
                          question.type === 'multiple'
                            ? 'rounded-md'
                            : 'rounded-full'
                        } border-2 flex items-center justify-center transition-all ${
                          isSelected
                            ? 'border-teal-500 bg-teal-500'
                            : 'border-gray-300'
                        }`}
                      >
                        {isSelected && (
                          <i className="ri-check-line text-white text-xs" />
                        )}
                      </div>
                      <span>{opt}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Short answer */}
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
                  {(answers[question.id] as string || '').length}/500
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer navigation */}
        <div className="px-6 pb-6 flex items-center justify-between">
          <button
            onClick={() => setCurrentQ(Math.max(0, currentQ - 1))}
            disabled={currentQ === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 rounded-xl text-sm font-medium transition-all whitespace-nowrap cursor-pointer"
          >
            <i className="ri-arrow-left-line" />
            上一题
          </button>

          {currentQ < totalQ - 1 ? (
            <button
              onClick={() => setCurrentQ(currentQ + 1)}
              disabled={!isAnswered(question)}
              className="flex items-center gap-2 px-5 py-2.5 bg-teal-500 hover:bg-teal-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-all whitespace-nowrap cursor-pointer"
            >
              下一题
              <i className="ri-arrow-right-line" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={answeredCount < totalQ}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-600 hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold transition-all whitespace-nowrap cursor-pointer"
            >
              <i className="ri-send-plane-fill" />
              提交检测
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
