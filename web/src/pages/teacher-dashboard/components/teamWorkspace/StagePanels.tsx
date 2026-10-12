import { useEffect, useMemo, useState } from 'react';
import { Modal } from 'antd';
import { ensurePlanEditorHtml } from '../../../../lib/planEditorHtml';
import { sanitizeRichText } from '../../../../lib/richText';
import {
  downloadWithAuth,
  EmptyHint,
  MemberBlock,
  SectionCard,
} from './workspaceUi';
import {
  BmcGridView,
  FinanceView,
  IdeaFormView,
  MarketingView,
  MarketAnalysisView,
  Pane,
  PersonaCardView,
  ProductSuggestionView,
  roleLabel,
  SimulationConfigView,
  SimulationRoundResultView,
  SubTabs,
  SwotView,
  TopicCardView,
  WarRoomTranscriptView,
  FormField,
  LabeledObjectView,
  IdeaAiAnalysisView,
} from './formViews';
import TeamFormationReadonly from './TeamFormationReadonly';

function surveyStatusLabel(status: string) {
  const s = String(status || '');
  if (s === 'published' || s === '进行中') return '进行中';
  if (s === 'draft' || s === '草稿') return '草稿';
  if (s === 'withdrawn' || s === '已撤回') return '已撤回';
  if (s === 'expired' || s === '已截止') return '已截止';
  return s || '—';
}

function parseAssignmentList(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

function memberNamesByIds(members: any[], ids: unknown): string {
  const list = Array.isArray(ids) ? ids.map((id) => String(id).trim()).filter(Boolean) : [];
  if (!list.length) return '';
  return list
    .map((id) => {
      const m = members.find((x) => String(x.studentId) === id || String(x.id) === id);
      return m?.studentName || m?.name || '';
    })
    .filter(Boolean)
    .join('、');
}

function PlanDocPreview({
  sections,
  fullText,
  meta,
  reviewComment,
}: {
  sections?: any[];
  fullText?: string;
  meta?: string;
  reviewComment?: string;
}) {
  const renderDocBody = (html: string) => (
    <div
      className="business-plan-doc text-[15px] text-gray-800 leading-[1.75] [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mb-1"
      dangerouslySetInnerHTML={{ __html: html || '<p class="text-gray-400">（本章暂无内容）</p>' }}
    />
  );
  const list = Array.isArray(sections) ? sections : [];
  const filled = list
    .map((s: any, idx: number) => {
      const title = String(s.title || s.key || `章节${idx + 1}`);
      const html = ensurePlanEditorHtml(String(s.content || ''));
      const plain = html.replace(/<[^>]+>/g, '').trim();
      if (!plain) return null;
      return { title, html, key: `${title}-${idx}` };
    })
    .filter(Boolean) as { title: string; html: string; key: string }[];

  return (
    <div className="bg-stone-200/70 rounded-lg p-3 sm:p-5 overflow-x-auto">
      <article className="mx-auto max-w-[210mm] bg-white shadow border border-stone-300/60 px-6 py-8 sm:px-10 sm:py-12">
        <header className="text-center mb-8 pb-4 border-b-2 border-stone-800/90">
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-[0.15em] font-serif">商业计划书</h1>
          {meta ? <p className="text-sm text-stone-500 mt-3">{meta}</p> : null}
        </header>
        {reviewComment ? (
          <aside className="mb-6 text-sm text-stone-600 bg-stone-50 border border-stone-200 rounded px-3 py-2">
            <span className="font-semibold text-stone-800">教师评语：</span>
            <span className="whitespace-pre-wrap break-words">{reviewComment}</span>
          </aside>
        ) : null}
        {filled.length > 0 ? (
          <div className="space-y-8">
            {filled.map((block, i) => (
              <section key={block.key}>
                <h2 className="text-base font-bold text-stone-900 mb-3 pb-1 border-b border-stone-300 font-serif">
                  {i + 1}．{block.title}
                </h2>
                {renderDocBody(block.html)}
              </section>
            ))}
          </div>
        ) : (
          <section>{renderDocBody(sanitizeRichText(String(fullText || '')))}</section>
        )}
      </article>
    </div>
  );
}

const SUB_TABS: Record<string, { key: string; label: string }[]> = {
  team: [
    { key: 'assessment', label: '能力测评' },
    { key: 'myteam', label: '我的团队' },
  ],
  ideation: [
    { key: 'methods', label: '创新方法工具' },
    { key: 'confirm', label: '确定项目选题' },
  ],
  market: [
    { key: 'plan', label: '调研计划' },
    { key: 'methods', label: '调研数据上传' },
    { key: 'survey', label: '线上问卷' },
    { key: 'persona', label: '用户画像' },
    { key: 'challenge', label: '对抗优化分析' },
    { key: 'analysis', label: '市场分析' },
  ],
  product: [
    { key: 'ai-suggestions', label: 'AI设计建议' },
    { key: 'upload', label: '原型上传' },
  ],
  business: [
    { key: 'swot', label: 'SWOT分析' },
    { key: 'marketing', label: '营销策略' },
    { key: 'finance', label: '成本分析' },
    { key: 'warroom', label: '虚拟董事会' },
    { key: 'canvas', label: '商业画布' },
  ],
  // 仿真：投入配置与模拟结果同页按轮次纵向展示，不再分子 Tab
  simulation: [],
  plan: [
    { key: 'plan', label: '撰写要点' },
    { key: 'submit', label: '提交审核' },
  ],
};

type Props = {
  classId: string;
  teamId: number;
  moduleKey: string;
  stage: any;
};

export default function StagePanels({ moduleKey, stage }: Props) {
  const uploadEnabled = stage?.features?.uploadEnabled !== false;
  const tabs = useMemo(() => {
    const base = SUB_TABS[moduleKey] || [];
    if (moduleKey === 'market' && !uploadEnabled) {
      return base.filter((t) => t.key !== 'methods');
    }
    return base;
  }, [moduleKey, uploadEnabled]);
  const [sub, setSub] = useState(tabs[0]?.key || '');

  useEffect(() => {
    const nextTabs = tabs;
    const first = nextTabs[0]?.key || '';
    // 仿真已无子 Tab；其它模块若当前 sub 不在列表中则回到第一项
    if (moduleKey === 'simulation') {
      if (sub) setSub('');
      return;
    }
    if (!nextTabs.some((t) => t.key === sub)) {
      setSub(first);
    }
  }, [moduleKey, sub, tabs]);

  if (!stage) return <EmptyHint text="加载中或暂无数据" />;
  const team = stage.team || {};
  const members = Array.isArray(stage.members) ? stage.members : [];

  return (
    <div>
      {tabs.length ? <SubTabs tabs={tabs} active={sub} onChange={setSub} /> : null}
      <Pane>
        {moduleKey === 'team' ? renderTeam(sub, team, members) : null}
        {moduleKey === 'ideation' ? renderIdeation(sub, team, members) : null}
        {moduleKey === 'market' ? renderMarket(sub, team, members) : null}
        {moduleKey === 'product' ? renderProduct(sub, team, members) : null}
        {moduleKey === 'business' ? renderBusiness(sub, team, members) : null}
        {moduleKey === 'simulation' ? renderSimulation(team, members) : null}
        {moduleKey === 'plan' ? renderPlan(sub, team) : null}
      </Pane>
    </div>
  );
}

function memberRoleText(m: any): string {
  return m.aiMatchedRoleLabel || roleLabel(m.aiMatchedRole);
}

function renderTeam(sub: string, team: any, members: any[]) {
  if (sub === 'myteam') {
    return (
      <SectionCard title="我的团队" icon="ri-team-line" empty={!(team.members || []).length ? '暂无' : false}>
        <div className="space-y-2">
          {(team.members || []).map((m: any) => (
            <div key={m.studentId} className="flex items-center justify-between text-sm border border-gray-100 rounded-lg px-3 py-2 gap-2">
              <span className="font-medium text-gray-800 truncate">{m.name}</span>
              <span className="text-xs text-teal-600 shrink-0">{memberRoleText(m)}</span>
            </div>
          ))}
        </div>
      </SectionCard>
    );
  }
  // assessment：原样复刻学生端问卷 + AI 结果卡
  return (
    <div className="space-y-3">
      {!members.length ? <EmptyHint text="暂无成员测评" /> : null}
      {members.map((m: any) => (
        <MemberBlock key={m.studentId} name={m.studentName} role={memberRoleText(m)} defaultOpen>
          <TeamFormationReadonly member={m} />
        </MemberBlock>
      ))}
    </div>
  );
}

/** 与学生端当前入口一致；scamper/triz 仅在有历史创意时展示（只读） */
const IDEATION_METHOD_TABS_CORE = [
  { key: 'midwifery', label: '启思智能体' },
  { key: 'brainstorm', label: '头脑风暴' },
  { key: 'ai', label: 'AI创意' },
  { key: 'six_hats', label: '六帽创想室' },
];
const IDEATION_METHOD_TABS_LEGACY = [
  { key: 'scamper', label: 'SCAMPER' },
  { key: 'triz', label: 'TRIZ' },
];

function IdeationMethodsPane({ team, members }: { team: any; members: any[] }) {
  const ideas = Array.isArray(team.ideas) ? team.ideas : [];
  const discussions = Array.isArray(team.discussions) ? team.discussions : [];
  const methodTabs = [
    ...IDEATION_METHOD_TABS_CORE,
    ...IDEATION_METHOD_TABS_LEGACY.filter((t) => ideas.some((i: any) => i.methodKey === t.key)),
  ];
  // 默认落到第一个「有记录」的方法，否则启思智能体
  const firstWithData =
    methodTabs.find((t) =>
      t.key === 'six_hats'
        ? members.some((m) => m.hatStudio) || ideas.some((i: any) => i.methodKey === 'six_hats')
        : ideas.some((i: any) => i.methodKey === t.key)
    )?.key || 'midwifery';
  const [method, setMethod] = useState(firstWithData);
  const filtered = ideas.filter((i: any) => i.methodKey === method);

  return (
    <div className="space-y-3">
      <SubTabs tabs={methodTabs} active={method} onChange={setMethod} />

      {method === 'six_hats' ? (
        <div className="space-y-3">
          <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
            <h4 className="text-sm font-bold text-violet-900 mb-1">六帽创想室</h4>
            <p className="text-xs text-violet-700">按成员查看六帽讨论稿与已沉淀创意</p>
          </div>
          {members.map((m: any) => (
            <MemberBlock
              key={m.studentId}
              name={m.studentName}
              role={m.hatStudio ? '有讨论稿' : '未开始'}
              defaultOpen={Boolean(m.hatStudio)}
            >
              {m.hatStudio ? (
                <>
                  {/* <div className="text-xs text-gray-500 mb-2">更新于 {m.hatStudio.updatedAt || '—'}</div>
                  <IdeaFormView payload={m.hatStudio.draft} emptyText="暂无工作区内容" /> */}
                  <div className="text-sm font-medium text-gray-700 mb-1">讨论记录</div>
                  <WarRoomTranscriptView transcript={m.hatStudio.transcript} />
                </>
              ) : (
                <EmptyHint text="该成员暂无六帽记录" />
              )}
            </MemberBlock>
          ))}
          {filtered.length ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-gray-800">已沉淀创意（{filtered.length}）</p>
              {filtered.map((idea: any) => (
                <IdeationIdeaCard key={idea.id} idea={idea} />
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          {method === 'midwifery' ? (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
              <h4 className="text-sm font-bold text-indigo-900 mb-1">启思智能体</h4>
              <p className="text-xs text-indigo-700">苏格拉底式多轮追问后生成的创意（只读）</p>
            </div>
          ) : null}
          {method === 'brainstorm' ? (
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
              <h4 className="text-sm font-bold text-teal-900 mb-1">头脑风暴法</h4>
              <p className="text-xs text-teal-700">自由发散思维，不限制创意方向，鼓励大胆想象</p>
            </div>
          ) : null}
          {method === 'scamper' ? (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <h4 className="text-sm font-bold text-orange-900 mb-1">SCAMPER奔驰法（历史）</h4>
              <p className="text-xs text-orange-700">历史方法记录，仅只读展示</p>
            </div>
          ) : null}
          {method === 'triz' ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <h4 className="text-sm font-bold text-green-900 mb-1">TRIZ创新原理（历史）</h4>
              <p className="text-xs text-green-700">历史方法记录，仅只读展示</p>
            </div>
          ) : null}
          {method === 'ai' ? (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
              <h4 className="text-sm font-bold text-rose-900 mb-1">AI智能创意生成</h4>
              <p className="text-xs text-rose-700">基于市场趋势和用户需求生成创新创意</p>
            </div>
          ) : null}

          {filtered.length ? (
            filtered.map((idea: any) => <IdeationIdeaCard key={idea.id} idea={idea} />)
          ) : (
            <EmptyHint text="该工具下暂无创意记录" />
          )}
        </div>
      )}

      {discussions.length && method === 'brainstorm' ? (
        <div className="rounded-2xl border border-teal-100 bg-gradient-to-br from-white to-teal-50/30 overflow-hidden">
          <div className="px-4 py-3 border-b border-teal-100 bg-white/80 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center">
              <i className="ri-chat-3-line text-teal-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">团队讨论</p>
              <p className="text-[11px] text-gray-500">共 {discussions.length} 条</p>
            </div>
          </div>
          <div className="p-3 space-y-2.5 max-h-80 overflow-y-auto">
            {discussions.map((d: any) => (
              <div
                key={d.id}
                className="rounded-xl border border-gray-100 bg-white px-3.5 py-3 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-100 to-cyan-100 flex items-center justify-center text-xs font-bold text-teal-700 shrink-0">
                    {String(d.authorName || '?').slice(0, 1)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 truncate">{d.authorName || '成员'}</div>
                    <div className="text-[11px] text-gray-400">{d.createdAt}</div>
                  </div>
                </div>
                <p className="text-sm text-gray-800 whitespace-pre-wrap break-words leading-relaxed">
                  {d.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function IdeationIdeaCard({ idea }: { idea: any }) {
  // 标题/描述在卡片头展示一次，表单里跳过同名字段，避免重复
  const description = String(idea.description || '').trim();
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
      <div>
        <div className="text-sm font-semibold text-gray-900">{idea.title || '未命名创意'}</div>
        <div className="text-xs text-gray-500 mt-0.5">
          {[idea.methodName, idea.authorName, idea.createdAt].filter(Boolean).join(' · ')}
        </div>
      </div>
      {description ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">创意描述</label>
          <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{description}</p>
        </div>
      ) : null}
      <IdeaFormView
        payload={idea.formPayload}
        omitKeys={['title', 'ideaTitle', 'description']}
      />
      <IdeaAiAnalysisView analysis={idea.aiAnalysis} />
    </div>
  );
}

/** 取团队创意中 AI 综合分最高的一条，供选题卡展示评分细节 */
function pickBestIdeaAnalysis(ideas: any[]): unknown {
  let best: any = null;
  let bestScore = -1;
  for (const idea of ideas || []) {
    let a = idea?.aiAnalysis;
    if (typeof a === 'string') {
      try {
        a = JSON.parse(a);
      } catch {
        continue;
      }
    }
    if (!a || typeof a !== 'object') continue;
    const score = Number((a as any).overallScore);
    if (!Number.isFinite(score)) continue;
    if (score > bestScore) {
      bestScore = score;
      best = a;
    }
  }
  return best;
}

function renderIdeation(sub: string, team: any, members: any[]) {
  if (sub === 'confirm') {
    const bestAnalysis = pickBestIdeaAnalysis(team.ideas);
    return (
      <div className="space-y-2 md:space-y-3">
        <SectionCard title="已提交选题" icon="ri-flag-line" empty={!team.topic ? '尚未提交' : false}>
          {team.topic ? <TopicCardView topic={team.topic} aiAnalysis={bestAnalysis} /> : null}
        </SectionCard>
        <SectionCard title="选题草稿" icon="ri-draft-line" empty={!team.draft ? '无草稿' : false}>
          {team.draft ? <TopicCardView topic={team.draft} /> : null}
        </SectionCard>
      </div>
    );
  }
  // 创新方法工具：启思智能体 / 头脑风暴 / AI创意 / 六帽（历史 SCAMPER/TRIZ 只读）
  return <IdeationMethodsPane team={team} members={members} />;
}

function MarketSurveyPane({ surveys }: { surveys: any[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [responseIndex, setResponseIndex] = useState(0);
  const active = useMemo(() => surveys.find((s) => String(s.id) === activeId) || null, [surveys, activeId]);
  const questions = Array.isArray(active?.questions) ? active.questions : [];
  const responses = Array.isArray(active?.responses) ? active.responses : [];
  const current = responses[responseIndex] || null;

  const openSurvey = (id: string) => {
    setActiveId(id);
    setResponseIndex(0);
  };

  const questionTypeLabel = (type: string) => {
    const t = String(type || '');
    if (t === 'single' || t === 'radio') return '单选';
    if (t === 'multiple' || t === 'checkbox') return '多选';
    if (t === 'text' || t === 'textarea') return '填空';
    if (t === 'rating' || t === 'score') return '评分';
    return t || '题目';
  };

  return (
    <>
      <SectionCard title={`线上问卷（${surveys.length}）`} icon="ri-survey-line" empty={!surveys.length ? '暂无' : false}>
        <div className="grid sm:grid-cols-2 gap-3">
          {surveys.map((sv: any) => {
            const count = Number(sv.collectedCount ?? (sv.responses || []).length ?? 0);
            return (
              <button
                key={sv.id}
                type="button"
                onClick={() => openSurvey(String(sv.id))}
                className="text-left rounded-xl border border-gray-200 bg-white p-4 hover:border-teal-300 hover:shadow-sm transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4 className="text-sm font-bold text-gray-900 line-clamp-2">{sv.title || '未命名问卷'}</h4>
                  <span className="shrink-0 px-2 py-0.5 rounded-full text-[11px] bg-teal-50 text-teal-700">
                    {surveyStatusLabel(sv.status)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{Array.isArray(sv.questions) ? sv.questions.length : 0} 题</span>
                  <span className="font-semibold text-teal-600">回收 {count} 份</span>
                </div>
                <div className="mt-2 text-[11px] text-gray-400">点击查看答卷详情</div>
              </button>
            );
          })}
        </div>
      </SectionCard>
      <Modal
        title={active ? `问卷答卷 · ${active.title || '未命名'}` : '问卷答卷'}
        open={Boolean(active)}
        onCancel={() => {
          setActiveId(null);
          setResponseIndex(0);
        }}
        footer={null}
        width={640}
        destroyOnClose
      >
        {active ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
              <span>
                {surveyStatusLabel(active.status)} · 共 {responses.length} 份答卷
              </span>
              {responses.length ? (
                <span className="font-medium text-teal-700">
                  第 {responseIndex + 1} / {responses.length} 份
                </span>
              ) : null}
            </div>

            {!responses.length ? (
              <EmptyHint text="暂无答卷" />
            ) : current ? (
              <>
                <div className="rounded-xl border border-teal-100 bg-teal-50/50 px-3 py-2 text-xs text-gray-600 flex flex-wrap gap-x-3 gap-y-1">
                  <span>答卷人：{current.respondentToken || '匿名'}</span>
                  <span>提交：{current.submittedAt || '—'}</span>
                </div>
                <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
                  {questions.length ? (
                    questions.map((q: any, qi: number) => {
                      const qid = String(q?.id ?? qi);
                      const ans =
                        current.answers?.[qid] ?? current.answers?.[q?.id] ?? current.answers?.[String(qi)];
                      const display = Array.isArray(ans)
                        ? ans.join('、')
                        : ans == null || ans === ''
                          ? '—'
                          : String(ans);
                      return (
                        <div
                          key={qid}
                          className="rounded-xl border border-gray-100 bg-white overflow-hidden shadow-sm"
                        >
                          <div className="px-3.5 py-2.5 bg-gray-50 border-b border-gray-100">
                            <div className="flex items-start gap-2">
                              <span className="shrink-0 w-6 h-6 rounded-md bg-teal-500 text-white text-xs font-bold flex items-center justify-center">
                                {qi + 1}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-gray-900 leading-relaxed">
                                  {q?.text || q?.title || '题目'}
                                </p>
                                <span className="text-[11px] text-gray-400">{questionTypeLabel(q?.type)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="px-3.5 py-3">
                            <div className="text-[11px] font-semibold text-teal-600 mb-1">回答</div>
                            <p className="text-sm text-gray-900 whitespace-pre-wrap break-words leading-relaxed">
                              {display}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <LabeledObjectView data={current.answers} labels={{}} emptyText="空答卷" onlyLabeled={false} />
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100">
                  <button
                    type="button"
                    disabled={responseIndex <= 0}
                    onClick={() => setResponseIndex((i) => Math.max(0, i - 1))}
                    className={`px-3 py-1.5 rounded-lg text-sm cursor-pointer ${
                      responseIndex <= 0
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-teal-700 hover:bg-teal-50'
                    }`}
                  >
                    <i className="ri-arrow-left-s-line mr-0.5" />
                    上一份
                  </button>
                  <span className="text-xs text-gray-400">一份一份查看</span>
                  <button
                    type="button"
                    disabled={responseIndex >= responses.length - 1}
                    onClick={() => setResponseIndex((i) => Math.min(responses.length - 1, i + 1))}
                    className={`px-3 py-1.5 rounded-lg text-sm cursor-pointer ${
                      responseIndex >= responses.length - 1
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-teal-700 hover:bg-teal-50'
                    }`}
                  >
                    下一份
                    <i className="ri-arrow-right-s-line ml-0.5" />
                  </button>
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </>
  );
}

function renderMarket(sub: string, team: any, members: any[]) {
  const uploads = team.uploads || [];
  const surveys = team.surveys || [];
  const personas = team.personas || [];

  if (sub === 'plan') {
    const methodsText = Array.isArray(team.plan?.methods)
      ? (team.plan.methods as unknown[]).map(String).join('、')
      : '';
    const assignments = parseAssignmentList(team.plan?.assignments);
    return (
      <SectionCard title="调研计划" icon="ri-calendar-check-line" empty={!team.plan ? '未保存' : false}>
        {team.plan ? (
          <div className="rounded-2xl border border-teal-100 bg-gradient-to-br from-white to-teal-50/40 overflow-hidden">
            <div className="px-4 py-3 border-b border-teal-100 bg-white/80 flex flex-wrap gap-3 text-xs text-gray-500">
              <span>
                周期：{String(team.plan.startDate || '—')} ~ {String(team.plan.endDate || '—')}
              </span>
              <span>保存于 {String(team.plan.savedAt || '—')}</span>
            </div>
            <div className="p-4 space-y-3">
              <div className="rounded-xl border border-gray-100 bg-white px-3 py-2.5">
                <div className="text-xs font-semibold text-gray-500 mb-1">调研目标</div>
                <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">
                  {String(team.plan.goal || '').trim() || '未填写'}
                </p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-white px-3 py-2.5">
                <div className="text-xs font-semibold text-gray-500 mb-1">调研方法</div>
                <p className="text-sm text-gray-900">{methodsText || '未填写'}</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-white px-3 py-2.5">
                <div className="text-xs font-semibold text-gray-500 mb-2">任务分工</div>
                {assignments.length ? (
                  <div className="space-y-2">
                    {assignments.map((a, i) => {
                      const namesFromApi = Array.isArray(a?.memberNames)
                        ? a.memberNames.map(String).filter(Boolean).join('、')
                        : '';
                      const names =
                        namesFromApi ||
                        memberNamesByIds(members, a?.memberIds || a?.members) ||
                        String(a?.assignee || a?.name || '').trim();
                      return (
                        <div
                          key={i}
                          className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2 text-sm"
                        >
                          <span className="font-medium text-gray-900">{a?.role || a?.task || `任务 ${i + 1}`}</span>
                          <span className="text-teal-700 font-medium">· {names || '未指定成员'}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyHint text="暂无分工" />
                )}
              </div>
            </div>
          </div>
        ) : null}
      </SectionCard>
    );
  }

  if (sub === 'methods') {
    return (
      <SectionCard
        title={`调研数据上传（${uploads.length}）`}
        icon="ri-folder-upload-line"
        empty={!uploads.length ? '暂无' : false}
      >
        <div className="space-y-2">
          {uploads.map((u: any) => (
            <div key={u.id} className="flex items-center justify-between gap-2 border border-gray-100 rounded-lg px-3 py-2">
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">{u.fileName}</div>
                <div className="text-xs text-gray-500">
                  {u.method} · {u.uploadedByName || u.uploadedBy} · {u.createdAt}
                </div>
              </div>
              <button
                type="button"
                className="shrink-0 text-xs text-teal-600 hover:underline cursor-pointer"
                onClick={() => downloadWithAuth(u.downloadUrl, u.fileName)}
              >
                下载
              </button>
            </div>
          ))}
        </div>
      </SectionCard>
    );
  }

  if (sub === 'survey') {
    return <MarketSurveyPane surveys={surveys} />;
  }

  if (sub === 'persona') {
    return (
      <SectionCard title="用户画像" icon="ri-user-heart-line" empty={!personas.length ? '暂无' : false}>
        <div className="grid md:grid-cols-2 gap-4">
          {personas.map((p: any) => (
            <div key={p.id} className="space-y-1">
              <div className="text-xs text-gray-400 px-1">{p.createdAt || ''}</div>
              <PersonaCardView payload={p.payload} />
            </div>
          ))}
        </div>
      </SectionCard>
    );
  }

  if (sub === 'challenge') {
    return (
      <SectionCard title="对抗优化分析" icon="ri-sword-line">
        <div className="space-y-2">
          {members.map((m: any) => (
            <MemberBlock
              key={m.studentId}
              name={m.studentName}
              role={m.challenge ? String(m.challenge.status || '已参与') : '未参与'}
              defaultOpen={Boolean(m.challenge)}
            >
              {m.challenge ? (
                <>
                  <div className="text-xs text-gray-500">
                    会话 {m.challenge.sessionCount || 1} · {m.challenge.createdAt}
                    {m.challenge.completedAt ? ` → ${m.challenge.completedAt}` : ''}
                  </div>
                  {Array.isArray(m.challenge.rounds) ? (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-gray-500">对抗回合</div>
                      {m.challenge.rounds.map((round: any, ri: number) => (
                        <div key={ri} className="border border-gray-100 rounded-lg px-3 py-2 text-sm">
                          <div className="text-xs text-gray-500 mb-1">
                            第 {ri + 1} 轮 · {round?.agent || round?.role || ''}
                          </div>
                          <p className="whitespace-pre-wrap break-words text-gray-800">
                            {typeof round === 'string'
                              ? round
                              : round?.question || round?.content || round?.answer || '—'}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {m.challenge.finalReport ? (
                    typeof m.challenge.finalReport === 'string' ? (
                      <FormField label="对抗报告" value={m.challenge.finalReport} />
                    ) : (
                      <div className="space-y-2">
                        {m.challenge.finalReport.totalScore != null ||
                        m.challenge.finalReport.score != null ? (
                          <div className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                            <span className="text-xs text-amber-700">综合评分</span>
                            <span className="text-lg font-bold text-amber-800">
                              {String(m.challenge.finalReport.totalScore ?? m.challenge.finalReport.score)}
                            </span>
                          </div>
                        ) : null}
                        <LabeledObjectView
                          data={m.challenge.finalReport}
                          onlyLabeled
                          labels={{
                            strengths: '项目优势',
                            weaknesses: '待改进点',
                            suggestions: '优化建议',
                            summary: '综合评述',
                          }}
                        />
                      </div>
                    )
                  ) : (
                    <EmptyHint text="暂无对抗报告" />
                  )}
                </>
              ) : (
                <EmptyHint text="暂无对抗记录" />
              )}
            </MemberBlock>
          ))}
        </div>
      </SectionCard>
    );
  }

  // analysis：仅保留 AI 市场分析（调研报告卡片已去掉）
  return (
    <div className="space-y-2 md:space-y-3">
      <SectionCard title="AI 市场分析" icon="ri-bar-chart-grouped-line" empty={!team.analysis ? '暂无' : false}>
        {team.analysis ? (
          <>
            {team.analysis.createdAt ? (
              <div className="text-xs text-gray-400 mb-2">生成于 {team.analysis.createdAt}</div>
            ) : null}
            <MarketAnalysisView result={team.analysis.result} />
          </>
        ) : null}
      </SectionCard>
    </div>
  );
}

function renderProduct(sub: string, team: any, members: any[]) {
  if (sub === 'upload') {
    return (
      <div className="space-y-2 md:space-y-3">
        <SectionCard title="产品上下文" icon="ri-file-text-line" empty={!team.contextText?.trim() ? '暂无' : false}>
          <>
            <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{team.contextText}</p>
            <div className="text-xs text-gray-400">更新于 {team.contextUpdatedAt || '—'}</div>
          </>
        </SectionCard>
        <SectionCard title="产品原型" icon="ri-archive-line" empty={!team.prototype ? '尚未上传' : false}>
          {team.prototype ? (
            <div className="flex items-center justify-between gap-2 border border-gray-100 rounded-lg px-3 py-2">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{team.prototype.fileName}</div>
                <div className="text-xs text-gray-500">{team.prototype.uploadedAt}</div>
              </div>
              <button
                type="button"
                className="text-xs text-teal-600 hover:underline cursor-pointer"
                onClick={() => downloadWithAuth(team.prototype.downloadUrl, team.prototype.fileName)}
              >
                下载
              </button>
            </div>
          ) : null}
        </SectionCard>
      </div>
    );
  }
  // ai-suggestions
  return (
    <SectionCard title="成员 AI 设计建议" icon="ri-robot-line">
      <div className="space-y-2">
        {members.map((m: any) => (
          <MemberBlock
            key={m.studentId}
            name={m.studentName}
            role={`${(m.suggestions || []).length} 条`}
            defaultOpen={(m.suggestions || []).length > 0}
          >
            {(m.suggestions || []).length ? (
              (m.suggestions || []).map((s: any) => (
                <div key={s.id} className="border border-gray-100 rounded-xl p-3 space-y-2">
                  <div className="text-xs text-gray-400">{s.createdAt}</div>
                  <ProductSuggestionView payload={s.payload} />
                </div>
              ))
            ) : (
              <EmptyHint text="暂无建议" />
            )}
          </MemberBlock>
        ))}
      </div>
    </SectionCard>
  );
}

function renderBusiness(sub: string, team: any, members: any[]) {
  // SWOT / 营销：直接复刻学生端表单布局，不再包一层自定义卡片标题
  if (sub === 'swot') {
    return (
      <div className="space-y-2">
        {team.swotSavedAt ? <p className="text-xs text-pink-600">上次保存：{team.swotSavedAt}</p> : null}
        <SwotView data={team.swot} />
      </div>
    );
  }
  if (sub === 'marketing') {
    return (
      <div className="space-y-2">
        {team.marketingSavedAt ? <p className="text-xs text-pink-600">上次保存：{team.marketingSavedAt}</p> : null}
        <MarketingView data={team.marketing} />
      </div>
    );
  }
  if (sub === 'finance') {
    return (
      <div className="space-y-2">
        {team.financeSavedAt ? <p className="text-xs text-pink-600">上次保存：{team.financeSavedAt}</p> : null}
        <FinanceView data={team.finance} />
      </div>
    );
  }
  if (sub === 'warroom') {
    return (
      <SectionCard title="虚拟董事会" icon="ri-radar-line">
        <div className="space-y-2">
          {members.map((m: any) => (
            <MemberBlock
              key={m.studentId}
              name={m.studentName}
              role={m.warRoom ? `已填 ${m.warRoom.filledCount || 0}/9` : '未开始'}
              defaultOpen={Boolean(m.warRoom)}
            >
              {m.warRoom ? (
                <>
                  <div className="text-xs text-gray-500">
                    更新 {m.warRoom.updatedAt || '—'}
                    {m.warRoom.savedAt ? ` · 保存 ${m.warRoom.savedAt}` : ''}
                  </div>
                  <BmcGridView canvas={m.warRoom.canvas} />
                  <div className="text-xs font-semibold text-gray-500 pt-1">讨论记录</div>
                  <WarRoomTranscriptView transcript={m.warRoom.transcript} />
                </>
              ) : (
                <EmptyHint text="暂无战情室记录" />
              )}
            </MemberBlock>
          ))}
        </div>
      </SectionCard>
    );
  }
  // canvas：画布 + AI 审查记录
  const reviews = Array.isArray(team.bmcAiReviews) ? team.bmcAiReviews : [];
  const reviewStatusLabel =
    team.bmcReviewStatus === 'approved'
      ? '已通过'
      : team.bmcReviewStatus === 'pending'
        ? '待教师审核'
        : team.bmcReviewStatus === 'rejected'
          ? `已驳回${team.bmcReviewComment ? `：${team.bmcReviewComment}` : ''}`
          : '未上传';
  return (
    <div className="space-y-2 md:space-y-3">
      <SectionCard
        title="商业画布"
        icon="ri-layout-masonry-line"
        empty={!team.bmc ? '暂无' : false}
        extra={
          <span className="text-xs text-gray-400">
            {team.bmcSavedAt || ''}
            {team.bmcReviewStatus ? ` · ${reviewStatusLabel}` : ''}
          </span>
        }
      >
        <BmcGridView canvas={team.bmc} />
      </SectionCard>
      <SectionCard
        title="审查记录"
        icon="ri-file-list-3-line"
        empty={reviews.length === 0 ? '暂无 AI 审查记录' : false}
      >
        <div className="space-y-3">
          {reviews.map((item: any) => (
            <div key={item.id} className="border border-gray-100 rounded-xl p-3 bg-gray-50/60">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 mb-1.5">
                <span>{item.submitterName || '同学'}</span>
                <span className="flex items-center gap-2">
                  {item.aiScore != null ? (
                    <span className="font-semibold text-teal-700">AI 评分 {item.aiScore}</span>
                  ) : null}
                  <span>{item.createdAt || '—'}</span>
                </span>
              </div>
              {item.selfNote ? (
                <p className="text-xs text-gray-600 mb-1.5 whitespace-pre-wrap break-words">
                  自述：{item.selfNote}
                </p>
              ) : (
                <p className="text-xs text-gray-400 mb-1.5">自述：（无）</p>
              )}
              <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                {item.aiResult?.summary || '—'}
              </p>
              {Array.isArray(item.aiResult?.suggestions) && item.aiResult.suggestions.length ? (
                <ul className="mt-2 list-disc pl-5 text-xs text-gray-600 space-y-0.5">
                  {item.aiResult.suggestions.map((s: string) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function renderSimulation(_team: any, members: any[]) {
  const QUALIFY = 3;
  const progressList = Array.isArray(_team.progress) ? _team.progress : [];
  const progressById = new Map(progressList.map((p: any) => [String(p.studentId), p]));
  // 与监控侧一致：按有效轮次占比估算团队进度
  const teamPct = (() => {
    if (!members.length) return 0;
    let earned = 0;
    for (const m of members) {
      const p = progressById.get(String(m.studentId));
      const fromRecords = (m.records || []).reduce(
        (mx: number, r: any) => Math.max(mx, Number(r.runIndex || 0)),
        0
      );
      const effective = Math.max(0, Number(p?.effectiveRounds ?? p?.runCount ?? fromRecords) || 0);
      earned += Math.min(QUALIFY, effective);
    }
    return Math.round((earned / (members.length * QUALIFY)) * 100);
  })();

  return (
    <SectionCard title="项目仿真" icon="ri-history-line">
      <div className="space-y-2">
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="font-semibold text-gray-800">
              {_team.teamQualified ? '全员已达标' : '尚未全员达标'}
            </span>
            <span className="font-bold text-emerald-700">{teamPct}%</span>
          </div>
          <div className="mt-1.5 h-1.5 bg-white rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${teamPct}%` }} />
          </div>
          <p className="text-[11px] text-gray-500 mt-1.5">
            达标规则：每位成员有效模拟轮次 ≥ {QUALIFY}；下方按轮次展示投入配置与模拟结果
          </p>
        </div>
        {members.map((m: any) => {
          // 多轮按 runIndex 升序：每轮先配置、后结果
          const records = [...(m.records || [])].sort(
            (a: any, b: any) => Number(a.runIndex || 0) - Number(b.runIndex || 0)
          );
          const p = progressById.get(String(m.studentId));
          const fromRecords = records.reduce((mx, r: any) => Math.max(mx, Number(r.runIndex || 0)), 0);
          const effective = Math.max(0, Number(p?.effectiveRounds ?? p?.runCount ?? fromRecords) || 0);
          const qualified = Boolean(p?.qualified ?? effective >= QUALIFY);
          return (
            <MemberBlock
              key={m.studentId}
              name={m.studentName}
              role={`有效 ${Math.min(QUALIFY, effective)}/${QUALIFY} 轮${qualified ? ' · 已达标' : ''}`}
              defaultOpen={records.length > 0}
            >
              {records.length ? (
                <div className="space-y-4">
                  {records.map((r: any) => (
                    <div
                      key={r.id}
                      className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm"
                    >
                      <div className="px-3.5 py-2.5 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100 flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-gray-900">第 {r.runIndex} 轮</span>
                        <span className="text-xs text-gray-500">{r.createdAt || ''}</span>
                      </div>
                      <div className="p-3 space-y-3">
                        <div>
                          <div className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
                            <i className="ri-settings-3-line text-emerald-600" />
                            投入配置
                          </div>
                          <SimulationConfigView config={r.config} />
                        </div>
                        <div className="border-t border-dashed border-gray-200 pt-3">
                          <div className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
                            <i className="ri-line-chart-line text-emerald-600" />
                            模拟结果
                          </div>
                          <SimulationRoundResultView
                            runIndex={r.runIndex}
                            createdAt={r.createdAt}
                            tracking={r.tracking}
                            summary={r.summary}
                            optimize={r.optimize}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyHint text="暂无仿真记录" />
              )}
            </MemberBlock>
          );
        })}
      </div>
    </SectionCard>
  );
}

function renderPlan(sub: string, team: any) {
  const versions = team.versions || [];
  const locks = team.locks || [];
  const submission = team.submission;

  if (sub === 'submit') {
    return (
      <div className="space-y-2 md:space-y-3">
        <SectionCard title="最新提交" icon="ri-send-plane-line" empty={!submission ? '尚未提交' : false}>
          {submission ? (
            <>
              <div className="text-xs text-gray-500 mb-2">
                状态 {submission.status} · v{submission.versionNo} · {submission.submittedAt}
                {submission.totalScore != null ? ` · 总分 ${submission.totalScore}` : ''}
              </div>
              <PlanDocPreview
                sections={submission.sections}
                fullText={submission.fullText}
                meta={`提交 v${submission.versionNo} · ${submission.status}`}
                reviewComment={submission.reviewComment}
              />
              {(submission.attachments || []).length ? (
                <div className="mt-3 space-y-2">
                  {(submission.attachments || []).map((a: any) => (
                    <div key={a.id} className="flex justify-between items-center border border-gray-100 rounded-lg px-3 py-2 gap-2">
                      <span className="text-sm truncate">
                        {a.isPpt ? '[PPT] ' : ''}
                        {a.fileName}
                      </span>
                      <button
                        type="button"
                        className="shrink-0 text-xs text-teal-600 hover:underline cursor-pointer"
                        onClick={() => downloadWithAuth(a.downloadUrl, a.fileName)}
                      >
                        下载
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
        </SectionCard>
        
      </div>
    );
  }

  // plan 撰写要点
  return (
    <div className="space-y-2 md:space-y-3">
      <SectionCard title="当前工作区" icon="ri-edit-box-line" empty={!team.workspace ? '暂无' : false}>
        {team.workspace ? (
          <>
            <div className="text-xs text-gray-500 mb-2">
              修订 {team.workspace.revision} · 更新于 {team.workspace.updatedAt || '—'}
            </div>
            <PlanDocPreview sections={team.workspace.sections} fullText={team.workspace.fullText} meta="工作区草稿" />
          </>
        ) : null}
      </SectionCard>
      <SectionCard title={`历史版本（${versions.length}）`} icon="ri-git-branch-line" empty={!versions.length ? '暂无' : false}>
        <div className="space-y-2">
          {versions.map((v: any) => (
            <details key={v.id} className="border border-gray-100 rounded-lg p-2.5">
              <summary className="cursor-pointer text-sm font-medium text-gray-800">
                v{v.versionNo} · {v.summary || '无摘要'} · {v.createdAt}
              </summary>
              <div className="mt-3">
                <PlanDocPreview sections={v.sections} meta={`版本 ${v.versionNo}`} />
              </div>
            </details>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
