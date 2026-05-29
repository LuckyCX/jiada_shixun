import { useEffect, useMemo, useState } from 'react';
import { Empty, Spin } from 'antd';
import {
  fetchTeacherMarketReportPreview,
  type TeacherMarketReportPreview,
} from '../../../lib/teacherMonitorApi';
import type { MarketAnalysisResult, MarketPersona, MarketSurveyQuestion } from '../../../lib/studentMarketResearchApi';

type TabKey = 'surveys' | 'personas' | 'analysis';

function personaInitial(name: string) {
  const t = String(name || '').trim();
  if (!t) return '?';
  return t.slice(0, 1);
}

function formatAnswer(q: MarketSurveyQuestion, val: unknown) {
  if (val == null || val === '') return '—';
  if (q.type === '多选' && Array.isArray(val)) return val.length ? val.join('、') : '—';
  return String(val);
}

type Props = {
  classId: string;
  teamId: number;
};

export default function MarketReportSubmissionPreview({ classId, teamId }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<TeacherMarketReportPreview | null>(null);
  const [tab, setTab] = useState<TabKey>('surveys');
  const [activeSurveyId, setActiveSurveyId] = useState<string | null>(null);
  const [selectedResponseId, setSelectedResponseId] = useState<string | null>(null);
  const [analysisExpanded, setAnalysisExpanded] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError('');
    void fetchTeacherMarketReportPreview(classId, teamId)
      .then((d) => {
        setData(d);
        const first = d.surveys[0]?.id ?? null;
        setActiveSurveyId(first);
        const firstResp = d.surveys[0]?.responses[0]?.id ?? null;
        setSelectedResponseId(firstResp);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : '加载失败');
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [classId, teamId]);

  const activeSurvey = useMemo(
    () => data?.surveys.find((s) => s.id === activeSurveyId) ?? null,
    [data, activeSurveyId]
  );

  const selectedResponse = useMemo(
    () => activeSurvey?.responses.find((r) => r.id === selectedResponseId) ?? null,
    [activeSurvey, selectedResponseId]
  );

  const analysis = data?.analysisResult as MarketAnalysisResult | null | undefined;

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'surveys', label: '问卷数据' },
    { key: 'personas', label: '用户画像' },
    { key: 'analysis', label: 'AI 分析报告' },
  ];

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <Spin />
      </div>
    );
  }
  if (error) {
    return <div className="text-sm text-red-600">{error}</div>;
  }
  if (!data) {
    return <Empty description="暂无数据" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-gray-100 pb-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
              tab === t.key ? 'bg-teal-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'surveys' && (
        <div className="space-y-4">
          {!data.surveys.length ? (
            <p className="text-sm text-gray-500">暂无问卷</p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4">
                {data.surveys.map((survey) => (
                  <div
                    key={survey.id}
                    className={`bg-white rounded-xl p-6 border transition-shadow flex flex-col cursor-pointer ${
                      activeSurveyId === survey.id
                        ? 'border-teal-400 shadow-md'
                        : 'border-gray-200 hover:shadow-lg'
                    }`}
                    onClick={() => {
                      setActiveSurveyId(survey.id);
                      setSelectedResponseId(survey.responses[0]?.id ?? null);
                    }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-base font-bold text-gray-900">{survey.title}</h4>
                        {survey.fromPlan && (
                          <span className="px-2 py-0.5 bg-green-50 text-green-600 text-xs rounded-full whitespace-nowrap">
                            <i className="ri-robot-line mr-1"></i>AI生成
                          </span>
                        )}
                      </div>
                      <span
                        className={`px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap ${
                          survey.status === '进行中'
                            ? 'bg-green-100 text-green-700'
                            : survey.status === '已撤回'
                              ? 'bg-gray-100 text-gray-600'
                              : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {survey.status}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">题目数量</span>
                        <span className="font-medium text-gray-900">{survey.questions.length}题</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">已回收</span>
                        <span className="font-medium text-green-600">{survey.collected}份</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {activeSurvey && (
                <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
                  <div className="text-sm font-semibold text-gray-900 mb-3">答卷详情 · {activeSurvey.title}</div>
                  {!activeSurvey.responses.length ? (
                    <Empty description="暂无答卷" />
                  ) : (
                    <div className="flex flex-col lg:flex-row gap-4 min-h-[280px] max-h-[50vh]">
                      <div className="w-full lg:w-56 flex-shrink-0 border border-gray-200 rounded-xl overflow-hidden flex flex-col bg-white">
                        <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-100 bg-gray-50">
                          匿名标识
                        </div>
                        <ul className="flex-1 overflow-y-auto py-1">
                          {activeSurvey.responses.map((r) => (
                            <li key={r.id}>
                              <button
                                type="button"
                                className={`w-full text-left px-2 py-2 border-l-2 ${
                                  selectedResponseId === r.id
                                    ? 'border-green-500 bg-green-50'
                                    : 'border-transparent hover:bg-gray-50'
                                }`}
                                onClick={() => setSelectedResponseId(r.id)}
                              >
                                <div className="text-xs font-mono text-gray-800 truncate" title={r.respondentToken}>
                                  {r.respondentToken.slice(0, 12)}
                                  {r.respondentToken.length > 12 ? '…' : ''}
                                </div>
                                <div className="text-[10px] text-gray-400 mt-0.5">{r.submittedAt}</div>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="flex-1 border border-gray-200 rounded-xl overflow-y-auto p-4 bg-white min-w-0">
                        {!selectedResponse ? (
                          <Empty description="请选择答卷" className="mt-8" />
                        ) : (
                          <div className="space-y-4">
                            <div className="text-xs text-gray-500 font-mono break-all">{selectedResponse.respondentToken}</div>
                            {activeSurvey.questions.map((q, idx) => (
                              <div key={q.id} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                                <div className="text-sm font-medium text-gray-900 mb-2">
                                  {idx + 1}. {q.text}
                                </div>
                                <div className="text-sm text-gray-700">
                                  {formatAnswer(q, selectedResponse.answers[q.id])}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'personas' && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-sm text-green-700">
              <i className="ri-information-line mr-2"></i>
              以下为团队提交调研报告时归档的用户画像
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {!data.personas.length && <p className="text-sm text-gray-500 col-span-2">暂无用户画像</p>}
            {(data.personas as MarketPersona[]).map((persona) => (
              <div
                key={persona.id}
                className={`bg-white border-2 ${persona.borderColor || 'border-green-200'} rounded-2xl p-8`}
              >
                <div className="flex items-start gap-6 mb-6">
                  <div
                    className={`w-24 h-24 rounded-full bg-gradient-to-br from-green-100 to-teal-100 flex items-center justify-center text-3xl font-bold ${persona.accentColor || 'text-green-600'} border-4 border-gray-100 flex-shrink-0`}
                  >
                    {personaInitial(persona.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-2xl font-bold text-gray-900">{persona.name}</h3>
                      {persona.fromSurvey && (
                        <span className="px-2 py-0.5 bg-green-50 text-green-600 text-xs rounded-full whitespace-nowrap">
                          <i className="ri-survey-line mr-1"></i>来自调研
                        </span>
                      )}
                    </div>
                    <div className="space-y-1 text-sm text-gray-600">
                      <p>
                        <strong className="text-gray-900">年龄：</strong>
                        {persona.age}岁
                      </p>
                      <p>
                        <strong className="text-gray-900">职业：</strong>
                        {persona.occupation}
                      </p>
                      <p>
                        <strong className="text-gray-900">专业：</strong>
                        {persona.major}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  {(
                    [
                      { field: 'painPoints' as const, label: '核心痛点', icon: 'ri-heart-pulse-line' },
                      { field: 'needs' as const, label: '核心诉求', icon: 'ri-star-line' },
                      { field: 'habits' as const, label: '消费习惯', icon: 'ri-shopping-bag-line' },
                    ] as const
                  ).map(({ field, label, icon }) => (
                    <div key={field}>
                      <h4 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                        <i className={`${icon} ${persona.accentColor || 'text-green-600'}`}></i>
                        {label}
                      </h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        {(persona[field] || []).filter(Boolean).map((item, i) => (
                          <li key={i}>• {item}</li>
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

      {tab === 'analysis' && (
        <div className="space-y-4">
          {!analysis ? (
            <p className="text-sm text-gray-500">暂无 AI 分析报告</p>
          ) : (
            <div className="bg-gradient-to-br from-green-50 to-teal-50 rounded-xl p-6 border-2 border-green-200">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                    {analysis.score}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                      <i className="ri-sparkling-fill text-green-600"></i>
                      AI智能分析报告
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      基于 {analysis.stats?.totalCollected ?? 0} 份问卷数据生成
                      {data.analysisGeneratedAt
                        ? ` · ${new Date(data.analysisGeneratedAt).toLocaleString('zh-CN')}`
                        : ''}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAnalysisExpanded((v) => !v)}
                  className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-700 cursor-pointer"
                >
                  <i className={`ri-arrow-${analysisExpanded ? 'up' : 'down'}-s-line text-xl`}></i>
                </button>
              </div>
              {analysisExpanded && (
                <div className="space-y-4 mt-4">
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-3">核心结论</h4>
                    {(analysis.conclusions || []).map((c, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 bg-white/70 rounded-lg p-3 mb-2 text-sm text-gray-700"
                      >
                        <span className="text-green-600 font-semibold">{i + 1}.</span>
                        {c}
                      </div>
                    ))}
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-3">市场机会</h4>
                    {(analysis.opportunities || []).map((o, i) => (
                      <div key={i} className="bg-green-50 rounded-lg p-3 mb-2 text-sm text-gray-700">
                        {o}
                      </div>
                    ))}
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-3">风险提示</h4>
                    {(analysis.risks || []).map((r, i) => (
                      <div key={i} className="bg-orange-50 rounded-lg p-3 mb-2 text-sm text-gray-700">
                        {r}
                      </div>
                    ))}
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-3">优化建议</h4>
                    {(analysis.suggestions || []).map((s, i) => (
                      <div key={i} className="bg-teal-50 rounded-lg p-3 mb-2 text-sm text-gray-700">
                        {s}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
