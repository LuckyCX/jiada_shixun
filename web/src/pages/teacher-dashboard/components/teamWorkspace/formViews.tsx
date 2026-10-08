import type { ReactNode } from 'react';
import { TEAM_ROLE_LABELS, type TeamRoleKey } from '../../../../lib/teamFormationApi';
import { WAR_ROOM_MODULE_DEFS } from '../../../../lib/studentBusinessModelApi';
import { EmptyHint } from './workspaceUi';

/** AI 匹配角色英文 key → 中文 */
export function roleLabel(key?: string | null): string {
  const k = String(key || '').trim();
  if (!k) return '—';
  return TEAM_ROLE_LABELS[k as TeamRoleKey] || k;
}

function asObj(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  if (typeof v === 'string') {
    try {
      const p = JSON.parse(v);
      return p && typeof p === 'object' && !Array.isArray(p) ? (p as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return {};
}

function str(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
}

function asStringList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => str(x).trim()).filter(Boolean);
  const s = str(v).trim();
  return s ? [s] : [];
}

/** 样式/元数据字段不展示给人看 */
const HIDDEN_PAYLOAD_KEYS = new Set([
  'fromSurvey',
  'accentColor',
  'borderColor',
  'id',
  'createdAt',
  'updatedAt',
  'source',
  'charts',
  'stats',
]);

/** 单字段只读块 */
export function FormField({ label, value }: { label: string; value?: string }) {
  const text = String(value || '').trim();
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2.5">
      <div className="text-xs font-semibold text-gray-500 mb-1">{label}</div>
      <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">{text || '未填写'}</p>
    </div>
  );
}

/** 驼峰/下划线 key → 简短可读标题 */
function humanizeKey(key: string): string {
  const s = String(key || '')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
  return s || key;
}

/** 对象按标签映射展示；未知 key 用人文化标题（可 onlyLabeled 仅展示已映射字段） */
export function LabeledObjectView({
  data,
  labels,
  emptyText = '暂无内容',
  onlyLabeled = false,
}: {
  data: unknown;
  labels: Record<string, string>;
  emptyText?: string;
  onlyLabeled?: boolean;
}) {
  if (typeof data === 'string') {
    const t = data.trim();
    return t ? <FormField label="内容" value={t} /> : <EmptyHint text={emptyText} />;
  }
  const obj = asObj(data);
  const labelKeys = Object.keys(labels);
  const dataKeys = Object.keys(obj).filter((k) => {
    if (HIDDEN_PAYLOAD_KEYS.has(k)) return false;
    if (onlyLabeled && !labels[k]) return false;
    const v = obj[k];
    if (v == null) return false;
    if (typeof v === 'string') return v.trim().length > 0;
    if (typeof v === 'number' || typeof v === 'boolean') return true;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return Object.keys(v).length > 0;
    return false;
  });
  if (!dataKeys.length && !labelKeys.some((k) => str(obj[k]).trim())) {
    return <EmptyHint text={emptyText} />;
  }
  const ordered = labelKeys.length
    ? [
        ...labelKeys.filter((k) => dataKeys.includes(k) || str(obj[k])),
        ...(onlyLabeled ? [] : dataKeys.filter((k) => !labels[k])),
      ]
    : dataKeys;
  const uniq = [...new Set(ordered)];
  return (
    <div className="space-y-2">
      {uniq.map((k) => {
        const v = obj[k];
        const label = labels[k] || humanizeKey(k);
        if (Array.isArray(v)) {
          const joined = v
            .map((x) => (typeof x === 'string' ? x : typeof x === 'object' && x ? str((x as any).title || (x as any).desc || (x as any).name) : str(x)))
            .filter(Boolean);
          return <FormField key={k} label={label} value={joined.join('；') || `共 ${v.length} 项`} />;
        }
        if (v && typeof v === 'object') {
          return (
            <div key={k} className="space-y-1">
              <div className="text-xs font-semibold text-gray-500">{label}</div>
              <LabeledObjectView data={v} labels={{}} onlyLabeled={false} />
            </div>
          );
        }
        return <FormField key={k} label={label} value={str(v)} />;
      })}
    </div>
  );
}

export function MarketAnalysisView({ result }: { result: unknown }) {
  // 纯文本报告：若本身是 JSON 字符串则走结构化展示
  if (typeof result === 'string') {
    const trimmed = result.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      const parsed = asObj(trimmed);
      if (Object.keys(parsed).length) return <MarketAnalysisView result={parsed} />;
    }
    return <FormField label="分析报告" value={result} />;
  }
  const obj = asObj(result);
  const stats = asObj(obj.stats);
  const conclusions = asStringList(obj.conclusions);
  const opportunities = asStringList(obj.opportunities || obj.marketOpportunities);
  const risks = asStringList(obj.risks || obj.riskWarnings);
  const suggestions = asStringList(obj.suggestions || obj.optimizations);
  const keyFindings = Array.isArray(obj.keyFindings) ? obj.keyFindings : [];
  const charts = asObj(obj.charts);
  const score = obj.score;
  if (!Object.keys(obj).length) return <EmptyHint text="暂无分析" />;

  const chartBlocks: { title: string; items: { label: string; value: unknown }[] }[] = [
    { title: '年龄分布', items: Array.isArray(charts.ageDistribution) ? (charts.ageDistribution as any[]) : [] },
    { title: '功能改进排序', items: Array.isArray(charts.improvementRanking) ? (charts.improvementRanking as any[]) : [] },
    { title: '消费分布', items: Array.isArray(charts.spendingDistribution) ? (charts.spendingDistribution as any[]) : [] },
    { title: '满意度分布', items: Array.isArray(charts.satisfactionDistribution) ? (charts.satisfactionDistribution as any[]) : [] },
  ].map((b) => ({
    ...b,
    items: b.items.map((x: any) => ({ label: str(x?.label), value: x?.value })),
  }));

  return (
    <div className="space-y-3">
      {score != null && score !== '' ? (
        <div className="flex items-center gap-3 rounded-xl border-2 border-green-200 bg-gradient-to-br from-green-50 to-teal-50 p-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-500 to-teal-500 text-white text-xl font-bold flex items-center justify-center shadow">
            {String(score)}
          </div>
          <div>
            <div className="text-sm font-bold text-gray-900">AI 分析评分</div>
            <div className="text-xs text-gray-500 mt-0.5">
              回收 {str(stats.totalCollected) || '—'} 份 · 进行中问卷 {str(stats.activeSurveyCount) || '—'} 份
            </div>
          </div>
        </div>
      ) : null}
      {conclusions.length ? (
        <div className="rounded-xl border border-gray-100 bg-white p-3 space-y-2">
          <div className="text-xs font-semibold text-gray-500">核心结论</div>
          {conclusions.map((c, i) => (
            <div key={i} className="text-sm text-gray-800 bg-gray-50 rounded-lg px-3 py-2">
              {i + 1}. {c}
            </div>
          ))}
        </div>
      ) : null}
      {[
        ['市场机会', opportunities, 'bg-green-50'],
        ['风险提示', risks, 'bg-orange-50'],
        ['优化建议', suggestions, 'bg-teal-50'],
      ].map(([title, items, bg]) =>
        (items as string[]).length ? (
          <div key={String(title)} className="rounded-xl border border-gray-100 bg-white p-3 space-y-2">
            <div className="text-xs font-semibold text-gray-500">{title as string}</div>
            {(items as string[]).map((t, i) => (
              <div key={i} className={`text-sm text-gray-800 rounded-lg px-3 py-2 ${bg as string}`}>
                {t}
              </div>
            ))}
          </div>
        ) : null
      )}
      {keyFindings.length ? (
        <div className="rounded-xl border border-gray-100 bg-white p-3 space-y-2">
          <div className="text-xs font-semibold text-gray-500">核心发现</div>
          {keyFindings.map((item: any, i: number) => (
            <div key={i} className="flex gap-3">
              <div className="w-8 h-8 flex items-center justify-center bg-green-100 text-green-600 rounded-lg shrink-0">
                <i className="ri-check-line" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-gray-900">{str(item?.title) || `发现 ${i + 1}`}</div>
                {item?.desc || item?.description ? (
                  <p className="text-sm text-gray-600 mt-0.5">{str(item.desc || item.description)}</p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {chartBlocks.some((b) => b.items.length) ? (
        <div className="grid sm:grid-cols-2 gap-2">
          {chartBlocks.map((b) =>
            b.items.length ? (
              <div key={b.title} className="rounded-xl border border-gray-100 bg-white p-3 space-y-1.5">
                <div className="text-xs font-semibold text-gray-500">{b.title}</div>
                {b.items.map((it, i) => (
                  <div key={i} className="flex justify-between gap-2 text-sm text-gray-800">
                    <span className="truncate">{it.label || '—'}</span>
                    <span className="font-medium text-teal-700 shrink-0">{str(it.value)}</span>
                  </div>
                ))}
              </div>
            ) : null
          )}
        </div>
      ) : null}
    </div>
  );
}

/** 与学生端 BusinessModelModule SWOT 卡片一致（只读 textarea） */
const SWOT_CARDS = [
  { key: 'strengths', title: '优势 (Strengths)', sub: '内部优势因素', icon: 'ri-thumb-up-line', color: 'from-green-500 to-emerald-500', border: 'border-green-200' },
  { key: 'weaknesses', title: '劣势 (Weaknesses)', sub: '内部劣势因素', icon: 'ri-thumb-down-line', color: 'from-amber-500 to-orange-500', border: 'border-amber-200' },
  { key: 'opportunities', title: '机会 (Opportunities)', sub: '外部机会因素', icon: 'ri-lightbulb-line', color: 'from-teal-500 to-cyan-500', border: 'border-teal-200' },
  { key: 'threats', title: '威胁 (Threats)', sub: '外部威胁因素', icon: 'ri-alert-line', color: 'from-red-500 to-rose-500', border: 'border-red-200' },
] as const;

export function SwotView({ data }: { data: unknown }) {
  const obj = asObj(data);
  const empty = !SWOT_CARDS.some((c) => str(obj[c.key]).trim());
  if (empty) return <EmptyHint text="暂无 SWOT 分析" />;
  return (
    <div className="space-y-6">
      <div className="bg-pink-50 border border-pink-200 rounded-xl p-6">
        <h3 className="text-base font-bold text-pink-900 mb-3">SWOT分析指南</h3>
        <p className="text-sm text-pink-700">从优势、劣势、机会、威胁四个维度全面分析项目</p>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        {SWOT_CARDS.map((item) => (
          <div key={item.key} className={`bg-white border-2 ${item.border} rounded-xl p-6`}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-12 h-12 bg-gradient-to-br ${item.color} rounded-xl flex items-center justify-center`}>
                <i className={`${item.icon} text-white text-xl`} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">{item.title}</h3>
                <p className="text-xs text-gray-500">{item.sub}</p>
              </div>
            </div>
            <textarea
              rows={6}
              readOnly
              value={str(obj[item.key])}
              className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl resize-none bg-gray-50/50 text-gray-900 cursor-default"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/** 与学生端 4P 营销卡片一致（只读） */
const MARKETING_CARDS = [
  { key: 'product', label: '产品 (Product)', icon: 'ri-product-hunt-line', color: 'from-teal-500 to-cyan-500', border: 'border-teal-200' },
  { key: 'price', label: '价格 (Price)', icon: 'ri-price-tag-3-line', color: 'from-green-500 to-emerald-500', border: 'border-green-200' },
  { key: 'place', label: '渠道 (Place)', icon: 'ri-store-3-line', color: 'from-purple-500 to-pink-500', border: 'border-purple-200' },
  { key: 'promotion', label: '推广 (Promotion)', icon: 'ri-megaphone-line', color: 'from-orange-500 to-amber-500', border: 'border-orange-200' },
] as const;

export function MarketingView({ data }: { data: unknown }) {
  const obj = asObj(data);
  const empty = !MARKETING_CARDS.some((c) => str(obj[c.key]).trim());
  if (empty) return <EmptyHint text="暂无营销策略" />;
  return (
    <div className="space-y-6">
      <div className="bg-pink-50 border border-pink-200 rounded-xl p-6">
        <h3 className="text-base font-bold text-pink-900 mb-3">营销策略指南</h3>
        <p className="text-sm text-pink-700">制定STP战略和4P策略，明确市场定位和推广方案</p>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-6">4P营销策略</h3>
        <div className="grid md:grid-cols-2 gap-6">
          {MARKETING_CARDS.map((item) => (
            <div key={item.key} className={`border-2 ${item.border} rounded-xl p-6`}>
              <div className="flex items-center gap-2 mb-4">
                <div className={`w-10 h-10 bg-gradient-to-br ${item.color} rounded-lg flex items-center justify-center`}>
                  <i className={`${item.icon} text-white text-lg`} />
                </div>
                <h4 className="text-base font-bold text-gray-900">{item.label}</h4>
              </div>
              <textarea
                rows={5}
                readOnly
                value={str(obj[item.key])}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none bg-gray-50/50 text-gray-900 cursor-default"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function FinanceView({ data }: { data: unknown }) {
  const obj = asObj(data);
  const costs = Array.isArray(obj.costs) ? obj.costs : [];
  const revenues = Array.isArray(obj.revenues) ? obj.revenues : [];
  const totalCost = costs.reduce((s: number, c: any) => s + Number(c?.amount || 0), 0);
  const totalRevenue = revenues.reduce((s: number, r: any) => s + Number(r?.monthly || 0) * 12, 0);
  const profit = totalRevenue - totalCost;

  if (!costs.length && !revenues.length) {
    // 兼容扁平字段
    if (Object.keys(obj).length) {
      return (
        <LabeledObjectView
          data={obj}
          labels={{
            totalCost: '总成本',
            totalRevenue: '预计收入',
            profit: '预计利润',
          }}
          emptyText="暂无财务数据"
        />
      );
    }
    return <EmptyHint text="暂无财务数据" />;
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {[
          ['总成本', totalCost],
          ['预计年收入', totalRevenue],
          ['预计利润', profit],
        ].map(([label, val]) => (
          <div key={String(label)} className="rounded-lg border border-gray-100 bg-teal-50/40 px-2 py-2 text-center">
            <div className="text-[10px] text-gray-500">{label}</div>
            <div className="text-sm font-semibold text-gray-900 mt-0.5">
              ¥{Number(val).toLocaleString('zh-CN')}
            </div>
          </div>
        ))}
      </div>
      <div>
        <div className="text-xs font-semibold text-gray-600 mb-1.5">成本明细</div>
        {costs.length ? (
          <div className="space-y-1">
            {costs.map((c: any, i: number) => (
              <div key={c?.id ?? i} className="flex justify-between gap-2 text-sm border border-gray-100 rounded-lg px-3 py-1.5">
                <span className="truncate text-gray-800">
                  <span className="text-xs text-gray-400 mr-1">{c?.category || '成本'}</span>
                  {c?.name || '未命名'}
                </span>
                <span className="shrink-0 text-gray-700">¥{Number(c?.amount || 0).toLocaleString('zh-CN')}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyHint text="暂无成本项" />
        )}
      </div>
      <div>
        <div className="text-xs font-semibold text-gray-600 mb-1.5">收入来源明细</div>
        {revenues.length ? (
          <div className="space-y-1">
            {revenues.map((r: any, i: number) => (
              <div key={r?.id ?? i} className="flex justify-between gap-2 text-sm border border-gray-100 rounded-lg px-3 py-1.5">
                <span className="truncate text-gray-800">{r?.source || '未命名'}</span>
                <span className="shrink-0 text-gray-700">
                  月均 ¥{Number(r?.monthly || 0).toLocaleString('zh-CN')}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyHint text="暂无收入项" />
        )}
      </div>
    </div>
  );
}

const BMC_FIELDS: { key: string; label: string }[] = [
  { key: 'keyPartnerships', label: '合作伙伴' },
  { key: 'keyActivities', label: '关键业务' },
  { key: 'valueProposition', label: '价值主张' },
  { key: 'customerRelationships', label: '客户关系' },
  { key: 'customerSegments', label: '客户细分' },
  { key: 'keyResources', label: '核心资源' },
  { key: 'channels', label: '渠道通路' },
  { key: 'costStructure', label: '成本结构' },
  { key: 'revenueStreams', label: '收入来源' },
];

function cellText(cell: unknown): string {
  if (typeof cell === 'string') return cell;
  if (cell && typeof cell === 'object') {
    const o = cell as Record<string, unknown>;
    return str(o.content || o.text);
  }
  return '';
}

export function BmcGridView({ canvas }: { canvas: unknown }) {
  const obj = asObj(canvas);
  const hasAny = BMC_FIELDS.some(({ key }) => cellText(obj[key]).trim());
  if (!hasAny && !Object.keys(obj).length) return <EmptyHint text="暂无商业画布" />;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3">
      {BMC_FIELDS.map(({ key, label }) => (
        <div key={key} className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-left">
          <div className="text-xs font-bold text-gray-600 mb-1.5">{label}</div>
          <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
            {cellText(obj[key]).trim() || '未填写'}
          </p>
        </div>
      ))}
    </div>
  );
}

const HAT_LABELS: Record<string, string> = {
  white: '白帽 · 数据分析师',
  red: '红帽 · 用户代表',
  black: '黑帽 · 风险预警员',
  yellow: '黄帽 · 乐观倡导者',
  green: '绿帽 · 创意设计师',
  blue: '蓝帽 · 项目经理',
  user: '学生发言',
};

/** 创新方法 / 六帽表单字段 → 学生端中文标签（严禁展示英文 key） */
const IDEA_FORM_LABELS: Record<string, string> = {
  title: '创意标题',
  ideaTitle: '创意标题',
  description: '创意描述',
  scamperDimension: '选择改进维度',
  problem: '问题描述',
  problemInsight: '问题洞察',
  solution: '解决方案',
  solutionPoints: '方案要点',
  domain: '目标领域',
  targetUser: '目标用户',
  painPoint: '核心痛点',
  userValue: '用户价值',
  value: '用户价值',
  risk: '风险与差异',
  riskDiff: '风险与差异',
  differentiation: '风险与差异',
  workspaceNotes: '工作区备注',
  aiSummarized: '是否已 AI 摘要',
};

/** 战情室 BMC 模块 + 六帽工作区字段，统一中文 */
const MODULE_TITLE: Record<string, string> = {
  ...Object.fromEntries(WAR_ROOM_MODULE_DEFS.map((d) => [d.key, d.title])),
  ...IDEA_FORM_LABELS,
};

function moduleLabelZh(key: string): string {
  const k = String(key || '').trim();
  if (!k) return '';
  return MODULE_TITLE[k] || '';
}

/** roundIndex 存 0 基，展示为第 1 轮起 */
function displayRound(roundIndex: unknown): number | null {
  if (roundIndex == null || roundIndex === '') return null;
  const n = Number(roundIndex);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n) + 1;
}

export function WarRoomTranscriptView({ transcript }: { transcript: unknown }) {
  const obj = asObj(transcript);
  const messages = Array.isArray(obj.messages) ? obj.messages : [];
  if (!messages.length) return <EmptyHint text="暂无讨论记录" />;
  return (
    <div className="space-y-2 max-h-96 overflow-y-auto">
      {messages.map((m: any, i: number) => {
        const hat = String(m?.hat || '');
        const adoptKeys = [
          ...(m?.targetModule ? [String(m.targetModule)] : []),
          ...(Array.isArray(m?.adoptedModules) ? m.adoptedModules.map((x: unknown) => String(x)) : []),
        ];
        const adoptLabels = [...new Set(adoptKeys.map(moduleLabelZh).filter(Boolean))];
        const roundNo = displayRound(m?.roundIndex);
        return (
          <div key={m?.id ?? i} className="rounded-lg border border-gray-100 px-3 py-2 bg-white">
            <div className="text-xs text-gray-500 mb-1 flex flex-wrap gap-x-2 gap-y-0.5">
              <span className="font-medium text-teal-700">{HAT_LABELS[hat] || '发言'}</span>
              {adoptLabels.length ? <span>采纳到「{adoptLabels.join('、')}」</span> : null}
              {roundNo != null ? <span>第 {roundNo} 轮</span> : null}
            </div>
            <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{str(m?.content) || '—'}</p>
          </div>
        );
      })}
    </div>
  );
}

const IDEA_FIELD_ORDER = [
  'title',
  'ideaTitle',
  'scamperDimension',
  'description',
  'problem',
  'problemInsight',
  'solution',
  'solutionPoints',
  'domain',
  'targetUser',
  'painPoint',
  'userValue',
  'value',
  'risk',
  'riskDiff',
  'differentiation',
  'workspaceNotes',
];

/** 六帽草稿可能是 { ideaTitle: { content } }，创意池是扁平 string */
function unwrapIdeaField(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'boolean') return v ? '是' : '否';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    if (o.content != null) return unwrapIdeaField(o.content);
    if (o.text != null) return unwrapIdeaField(o.text);
  }
  return '';
}

export function IdeaFormView({
  payload,
  omitKeys = [],
  emptyText,
}: {
  payload: unknown;
  /** 已在卡片标题区展示的字段，避免重复 */
  omitKeys?: string[];
  /** 无内容时是否提示；默认不渲染空态（卡片场景） */
  emptyText?: string;
}) {
  const obj = asObj(payload);
  const omit = new Set(omitKeys);
  // 只展示有中文标签且有实质内容的字段；同名中文标签只保留第一条
  const seenLabels = new Set<string>();
  const rows = IDEA_FIELD_ORDER.map((k) => {
    if (omit.has(k)) return null;
    const text = unwrapIdeaField(obj[k]).trim();
    if (!text) return null;
    const label = IDEA_FORM_LABELS[k];
    if (!label || seenLabels.has(label)) return null;
    seenLabels.add(label);
    return { key: k, label, text };
  }).filter(Boolean) as { key: string; label: string; text: string }[];

  if (!rows.length) {
    return emptyText ? <EmptyHint text={emptyText} /> : null;
  }
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.key}>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{r.label}</label>
          <textarea
            readOnly
            rows={r.key === 'title' || r.key === 'ideaTitle' || r.key === 'domain' || r.key === 'targetUser' ? 2 : 3}
            value={r.text}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none bg-gray-50/50 cursor-default"
          />
        </div>
      ))}
    </div>
  );
}

function ideaScoreGradient(score: number) {
  if (score >= 90) return 'from-emerald-500 to-green-500';
  if (score >= 75) return 'from-teal-500 to-cyan-500';
  if (score >= 60) return 'from-amber-500 to-yellow-500';
  return 'from-red-500 to-rose-500';
}

/** 创意 AI 评分：对齐学生端总分 + 四维细节 */
export function IdeaAiAnalysisView({ analysis }: { analysis: unknown }) {
  if (analysis == null || analysis === '') return null;
  if (typeof analysis === 'string') {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">AI 分析</label>
        <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{analysis}</p>
      </div>
    );
  }
  const obj = asObj(analysis);
  const overall = Number(obj.overallScore);
  const scoreItems = [
    { key: 'novelty', label: '新颖性', bar: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700' },
    { key: 'feasibility', label: '可行性', bar: 'bg-green-500', bg: 'bg-green-50', text: 'text-green-700' },
    { key: 'marketPotential', label: '市场潜力', bar: 'bg-rose-500', bg: 'bg-rose-50', text: 'text-rose-700' },
    { key: 'innovation', label: '创新价值', bar: 'bg-teal-500', bg: 'bg-teal-50', text: 'text-teal-700' },
  ];
  const hasDims = scoreItems.some((s) => obj[s.key] != null);
  const summary = str(obj.summary || obj.suggestion || obj.text || obj.comment);
  const strengths = asStringList(obj.strengths);
  const weaknesses = asStringList(obj.weaknesses);
  const suggestions = asStringList(obj.suggestions);
  if (!Number.isFinite(overall) && !hasDims && !summary && !strengths.length) return null;

  return (
    <div className="rounded-xl border border-teal-100 bg-gradient-to-br from-slate-50 to-teal-50/40 p-4 space-y-3">
      <div className="flex items-center gap-3">
        {Number.isFinite(overall) ? (
          <div
            className={`w-14 h-14 bg-gradient-to-br ${ideaScoreGradient(overall)} rounded-2xl flex flex-col items-center justify-center text-white shadow-md shrink-0`}
          >
            <span className="text-lg font-black leading-none">{overall}</span>
            <span className="text-[10px] opacity-90 mt-0.5">总分</span>
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <i className="ri-robot-2-line text-teal-500 text-sm" />
            <span className="text-sm font-bold text-gray-900">AI 创意评分</span>
          </div>
          {summary ? <p className="text-xs text-gray-600 leading-relaxed">{summary}</p> : null}
        </div>
      </div>
      {hasDims ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {scoreItems.map((s) => {
            const v = Number(obj[s.key]);
            const pct = Number.isFinite(v) ? Math.min(100, (v / 5) * 100) : 0;
            return (
              <div key={s.key} className={`${s.bg} rounded-xl p-2.5 text-center`}>
                <div className={`text-base font-black ${s.text}`}>{Number.isFinite(v) ? v : '—'}</div>
                <div className="text-[11px] text-gray-500 mb-1">{s.label}</div>
                <div className="h-1.5 bg-white rounded-full overflow-hidden">
                  <div className={`h-full ${s.bar} rounded-full`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
      {strengths.length || weaknesses.length ? (
        <div className="grid sm:grid-cols-2 gap-2">
          {strengths.length ? (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-2.5">
              <div className="text-xs font-bold text-emerald-800 mb-1.5">创意优势</div>
              <ul className="space-y-1">
                {strengths.map((t, i) => (
                  <li key={i} className="text-xs text-emerald-700 flex gap-1">
                    <i className="ri-check-line shrink-0 mt-0.5" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {weaknesses.length ? (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-2.5">
              <div className="text-xs font-bold text-amber-800 mb-1.5">待改进点</div>
              <ul className="space-y-1">
                {weaknesses.map((t, i) => (
                  <li key={i} className="text-xs text-amber-700 flex gap-1">
                    <i className="ri-arrow-right-line shrink-0 mt-0.5" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
      {suggestions.length ? (
        <div className="bg-white border border-teal-100 rounded-xl p-2.5">
          <div className="text-xs font-bold text-gray-800 mb-1.5">AI 优化建议</div>
          <ul className="space-y-1">
            {suggestions.map((t, i) => (
              <li key={i} className="text-xs text-gray-700">
                {i + 1}. {t}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

const SIM_BUSINESS_MODEL_LABELS: Record<string, string> = {
  b2c: 'B2C',
  b2b: 'B2B',
  c2c: 'C2C',
  freemium: 'Freemium',
  subscription: '订阅制',
  platform: '平台抽佣',
  saas: 'SaaS 订阅',
  marketplace: '平台撮合',
  ecommerce: '电商零售',
  advertising: '广告变现',
};

const SIM_TRACK_LABELS: Record<string, string> = {
  users: '累计用户',
  revenue: '累计收入',
  cac: '获客成本',
  ltv: '用户 LTV',
};

function formatYAxisTick(v: number, divisor: number) {
  const n = v / (divisor || 1);
  if (divisor >= 10000) return n >= 10 ? String(Math.round(n)) : n.toFixed(1);
  return n >= 1000 ? String(Math.round(n)) : String(Math.round(n * 10) / 10);
}

/** 与学生端仿真页同款的简易折线（只读） */
function SimLineChart({
  data,
  color,
  gradientId,
  currentDay,
  yLabel,
  yUnit,
  yValueDivisor = 1,
}: {
  data: number[];
  color: string;
  gradientId: string;
  currentDay: number;
  yLabel: string;
  yUnit: string;
  yValueDivisor?: number;
}) {
  const W = 780;
  const H = 180;
  const PAD = 10;
  const LPAD = 58;
  const validData = data.slice(0, Math.max(1, currentDay));
  if (!validData.length || !validData.some((v) => v > 0)) {
    return (
      <div className="h-40 flex items-center justify-center text-gray-400 text-sm">
        <i className="ri-line-chart-line mr-2" />
        暂无趋势数据
      </div>
    );
  }
  const maxValue = Math.max(...validData) || 1;
  const useYuanScale = yValueDivisor >= 10000 && maxValue < yValueDivisor;
  const axisDivisor = useYuanScale ? 1 : yValueDivisor;
  const axisUnit = useYuanScale ? '元' : yUnit;
  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => {
    const ratio = i / ticks;
    return {
      y: H - PAD - ratio * (H - PAD * 2),
      display: formatYAxisTick(maxValue * ratio, axisDivisor),
    };
  });
  const pts = validData.map((v, i) => ({
    x: LPAD + (i / 29) * (W - LPAD - PAD),
    y: H - PAD - (v / maxValue) * (H - PAD * 2),
  }));
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');
  const last = pts[pts.length - 1];
  const areaD = `${pathD} L ${last.x},${H - PAD} L ${LPAD},${H - PAD} Z`;
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H + 24}`} className="overflow-visible">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <text x={LPAD} y={12} textAnchor="start" fontSize="11" fill="#9ca3af">
        {yLabel}（{axisUnit}）
      </text>
      {yTicks.map((t, idx) => (
        <g key={idx}>
          <line x1={LPAD} y1={t.y} x2={W - PAD} y2={t.y} stroke="#f3f4f6" strokeWidth="1" />
          <text x={LPAD - 8} y={t.y + 4} textAnchor="end" fontSize="11" fill="#9ca3af">
            {t.display}
          </text>
        </g>
      ))}
      <path d={areaD} fill={`url(#${gradientId})`} />
      <path d={pathD} stroke={color} strokeWidth="3" fill="none" strokeLinejoin="round" />
      {[1, 8, 15, 22, 30].map((day) => (
        <text
          key={day}
          x={LPAD + ((day - 1) / 29) * (W - LPAD - PAD)}
          y={H + 18}
          textAnchor="middle"
          fontSize="11"
          fill="#9ca3af"
        >
          第{day}天
        </text>
      ))}
    </svg>
  );
}

/** 扁平化嵌套对象为一层 key→文本，用于仿真等 */
function flattenForLabels(data: unknown, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  if (data == null) return out;
  if (typeof data !== 'object') {
    if (prefix) out[prefix] = str(data);
    return out;
  }
  if (Array.isArray(data)) {
    if (prefix) out[prefix] = `共 ${data.length} 项`;
    return out;
  }
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      // 渠道分配等一层嵌套展开
      const nested = v as Record<string, unknown>;
      const simple = Object.values(nested).every((x) => typeof x !== 'object' || x == null);
      if (simple) {
        for (const [nk, nv] of Object.entries(nested)) {
          out[`${path}.${nk}`] = str(nv);
        }
      } else {
        out[path] = '（详见下方字段）';
        Object.assign(out, flattenForLabels(v, path));
      }
    } else if (Array.isArray(v)) {
      out[path] = `共 ${v.length} 项`;
    } else {
      out[path] = str(v);
    }
  }
  return out;
}

function readSimConfig(config: unknown) {
  const obj = asObj(config);
  const channels = asObj(obj.channels || obj.channelAllocation);
  return {
    businessModel: str(obj.businessModel),
    budget: Number(obj.budget ?? obj.marketingBudget ?? 0),
    price: Number(obj.price ?? obj.productPrice ?? 0),
    targetUsers: Number(obj.targetUsers ?? 0),
    channels: {
      social: Number(channels.social ?? obj.channelSocial ?? 0),
      search: Number(channels.search ?? obj.channelSearch ?? 0),
      offline: Number(channels.offline ?? obj.channelOffline ?? 0),
    },
  };
}

/** 教师端只读：对齐学生端投入配置卡片样式 */
export function SimulationConfigView({ config }: { config: unknown }) {
  const c = readSimConfig(config);
  if (!c.businessModel && !c.budget && !c.price && !c.targetUsers) {
    return <EmptyHint text="暂无投入配置" />;
  }
  const modelLabel = SIM_BUSINESS_MODEL_LABELS[c.businessModel] || c.businessModel || '未选择';
  return (
    <div className="space-y-3">
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h4 className="text-sm font-bold text-gray-900 mb-3">商业模型</h4>
        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-emerald-500 bg-emerald-50 text-emerald-700 text-sm font-medium">
          <i className="ri-briefcase-4-line" />
          {modelLabel}
        </div>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
        <h4 className="text-sm font-bold text-gray-900">基础参数</h4>
        {[
          { label: '营销预算', value: `¥${Number(c.budget || 0).toLocaleString()}` },
          { label: '产品定价', value: `¥${Number(c.price || 0).toLocaleString()}` },
          { label: '目标用户数', value: `${Number(c.targetUsers || 0).toLocaleString()}人` },
        ].map((row) => (
          <div key={row.label} className="flex items-center justify-between text-sm">
            <span className="text-gray-600">{row.label}</span>
            <span className="font-semibold text-emerald-600">{row.value}</span>
          </div>
        ))}
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <h4 className="text-sm font-bold text-gray-900">渠道分配</h4>
        {[
          { key: 'social', label: '社交媒体', icon: 'ri-share-line', color: 'text-pink-500', pct: c.channels.social },
          { key: 'search', label: '搜索引擎', icon: 'ri-search-line', color: 'text-blue-500', pct: c.channels.search },
          { key: 'offline', label: '线下推广', icon: 'ri-map-pin-line', color: 'text-orange-500', pct: c.channels.offline },
        ].map((ch) => (
          <div key={ch.key}>
            <div className="flex justify-between text-sm mb-1.5">
              <span className={`flex items-center gap-1 ${ch.color}`}>
                <i className={ch.icon} />
                {ch.label}
              </span>
              <span className="font-semibold text-gray-700">{ch.pct}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, Math.max(0, ch.pct))}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function seriesFromTracking(tracking: unknown): { users: number[]; revenue: number[]; day: number } {
  const obj = asObj(tracking);
  const days = Array.isArray(obj.days) ? obj.days : [];
  const users = Array(30).fill(0) as number[];
  const revenue = Array(30).fill(0) as number[];
  let maxDay = 0;
  for (const d of days) {
    const day = Number((d as any)?.day || 0);
    if (day >= 1 && day <= 30) {
      users[day - 1] = Number((d as any)?.users || 0);
      revenue[day - 1] = Number((d as any)?.revenue || 0);
      maxDay = Math.max(maxDay, day);
    }
  }
  if (!maxDay) maxDay = users.some((v) => v > 0) || revenue.some((v) => v > 0) ? 30 : 0;
  return { users, revenue, day: maxDay };
}

/** 单轮：指标卡 + 折线 + 优化建议（追踪与迭代合并） */
export function SimulationRoundResultView({
  runIndex,
  createdAt,
  tracking,
  summary,
  optimize,
}: {
  runIndex?: number | string;
  createdAt?: string;
  tracking: unknown;
  summary?: any;
  optimize?: unknown;
}) {
  const obj = asObj(tracking);
  const series = seriesFromTracking(tracking);
  const users = Number(summary?.users ?? obj.users ?? series.users[Math.max(0, series.day - 1)] ?? 0);
  const revenue = Number(summary?.revenue ?? obj.revenue ?? series.revenue[Math.max(0, series.day - 1)] ?? 0);
  const cac = Number(summary?.cac ?? obj.cac ?? 0);
  const ltv = Number(summary?.ltv ?? obj.ltv ?? 0);
  const opt = asObj(optimize);
  const suggestions = Array.isArray(opt.suggestions)
    ? opt.suggestions
    : Array.isArray(opt.items)
      ? opt.items
      : Array.isArray(optimize)
        ? (optimize as unknown[])
        : [];
  const gid = `sim-${String(runIndex || 'x')}-${String(createdAt || '').replace(/\D/g, '')}`;

  return (
    <div className="space-y-3 border border-emerald-100 rounded-xl p-3 bg-emerald-50/30">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-gray-900">第 {runIndex ?? '—'} 轮模拟</div>
        <div className="text-xs text-gray-500">{createdAt || ''}</div>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-700">模拟进度</span>
          <span className="text-sm text-emerald-600 font-bold">第 {series.day || 0} / 30 天</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${Math.min(100, ((series.day || 0) / 30) * 100)}%` }} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: SIM_TRACK_LABELS.users, value: `${users.toLocaleString()}人`, icon: 'ri-user-3-line', color: 'text-emerald-500' },
          { label: SIM_TRACK_LABELS.revenue, value: `¥${(revenue / 10000).toFixed(1)}万`, icon: 'ri-money-cny-circle-line', color: 'text-blue-500' },
          { label: SIM_TRACK_LABELS.cac, value: `¥${cac}`, icon: 'ri-funds-line', color: 'text-orange-500' },
          { label: SIM_TRACK_LABELS.ltv, value: `¥${ltv}`, icon: 'ri-vip-crown-line', color: 'text-purple-500' },
        ].map((m) => (
          <div key={m.label} className="bg-white border border-gray-200 rounded-xl p-3">
            <i className={`${m.icon} ${m.color} text-lg`} />
            <p className="text-xs text-gray-500 mt-1">{m.label}</p>
            <p className="text-sm font-bold text-gray-900 mt-0.5">{m.value}</p>
          </div>
        ))}
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-3">
        <h4 className="text-sm font-bold text-gray-900 mb-2">用户增长趋势</h4>
        <div className="h-44">
          <SimLineChart
            data={series.users}
            color="rgb(16,185,129)"
            gradientId={`${gid}-u`}
            currentDay={series.day || 30}
            yLabel="用户数"
            yUnit="人"
          />
        </div>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-3">
        <h4 className="text-sm font-bold text-gray-900 mb-2">收入增长趋势</h4>
        <div className="h-44">
          <SimLineChart
            data={series.revenue}
            color="rgb(59,130,246)"
            gradientId={`${gid}-r`}
            currentDay={series.day || 30}
            yLabel="收入"
            yUnit="万元"
            yValueDivisor={10000}
          />
        </div>
      </div>
      {suggestions.length ? (
        <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 flex items-center justify-center bg-emerald-100 rounded-lg">
              <i className="ri-robot-line text-emerald-600" />
            </div>
            <h4 className="text-sm font-bold text-gray-900">AI 优化建议</h4>
          </div>
          {suggestions.map((s: any, i: number) => (
            <div key={s?.id ?? i} className="border border-gray-100 rounded-xl p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{str(s?.title) || `建议 ${i + 1}`}</p>
                  {s?.desc || s?.description ? (
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed whitespace-pre-wrap">
                      {str(s.desc || s.description)}
                    </p>
                  ) : null}
                </div>
                {s?.impact ? (
                  <span className="text-xs bg-emerald-100 text-emerald-600 px-2 py-1 rounded-full whitespace-nowrap shrink-0">
                    {str(s.impact)}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function SimulationTrackingView({ tracking, summary }: { tracking: unknown; summary?: any }) {
  return <SimulationRoundResultView tracking={tracking} summary={summary} />;
}

export function SimulationOptimizeView({ optimize }: { optimize: unknown }) {
  return <SimulationRoundResultView tracking={{}} optimize={optimize} />;
}

function personaInitial(name: string) {
  const t = String(name || '').trim();
  return t ? t.slice(0, 1) : '?';
}

/** 与学生端用户画像卡片一致（不展示 accentColor / borderColor / fromSurvey 等元数据 key） */
export function PersonaCardView({ payload }: { payload: unknown }) {
  const obj = asObj(payload);
  const name = str(obj.name) || '未命名画像';
  const age = obj.age;
  const occupation = str(obj.occupation || obj.job);
  const major = str(obj.major);
  const accent = str(obj.accentColor) || 'text-green-500';
  const border = str(obj.borderColor) || 'border-green-200';
  const fromSurvey = Boolean(obj.fromSurvey);
  const lists = [
    { label: '核心痛点', icon: 'ri-heart-pulse-line', items: asStringList(obj.painPoints || obj.pain) },
    { label: '核心诉求', icon: 'ri-star-line', items: asStringList(obj.needs || obj.demands) },
    { label: '消费习惯', icon: 'ri-shopping-bag-line', items: asStringList(obj.habits || obj.consumption) },
  ];
  const hasBody = lists.some((l) => l.items.length) || occupation || major || age != null;
  if (!hasBody && !str(obj.name)) return <EmptyHint text="暂无画像内容" />;
  return (
    <div className={`bg-white border-2 ${border} rounded-2xl p-6 md:p-8 relative`}>
      <div className="flex items-start gap-5 md:gap-6 mb-6">
        <div
          className={`w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-green-100 to-teal-100 flex items-center justify-center text-2xl md:text-3xl font-bold ${accent} border-4 border-gray-100 shrink-0`}
        >
          {personaInitial(name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="text-xl md:text-2xl font-bold text-gray-900">{name}</h3>
            {fromSurvey ? (
              <span className="px-2 py-0.5 bg-green-50 text-green-600 text-xs rounded-full whitespace-nowrap">
                <i className="ri-survey-line mr-1" />
                来自调研
              </span>
            ) : null}
          </div>
          <div className="space-y-1 text-sm text-gray-600">
            <p>
              <strong className="text-gray-900">年龄：</strong>
              {age != null && String(age) !== '' ? `${age}岁` : '—'}
            </p>
            <p>
              <strong className="text-gray-900">职业：</strong>
              {occupation || '—'}
            </p>
            <p>
              <strong className="text-gray-900">专业：</strong>
              {major || '—'}
            </p>
          </div>
        </div>
      </div>
      <div className="space-y-4">
        {lists.map((block) =>
          block.items.length ? (
            <div key={block.label}>
              <h4 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                <i className={`${block.icon} ${accent}`} />
                {block.label}
              </h4>
              <ul className="text-sm text-gray-600 space-y-1">
                {block.items.map((item, i) => (
                  <li key={i}>• {item}</li>
                ))}
              </ul>
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}

/** 产品 AI 设计建议：对齐学生端分区卡片，不 dump 英文 key */
export function ProductSuggestionView({ payload }: { payload: unknown }) {
  const obj = asObj(payload);
  const features = Array.isArray(obj.coreFeatures) ? obj.coreFeatures : Array.isArray(obj.features) ? obj.features : [];
  const ux = asStringList(obj.userExperience || obj.ux);
  const tech = asStringList(obj.technicalArchitecture || obj.tech);
  const iteration = Array.isArray(obj.iterationPlan) ? obj.iterationPlan : Array.isArray(obj.iteration) ? obj.iteration : [];
  if (!features.length && !ux.length && !tech.length && !iteration.length) {
    return <EmptyHint text="暂无建议" />;
  }
  return (
    <div className="space-y-4">
      {features.length ? (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-4">
          <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <i className="ri-function-line text-blue-600" />
            核心功能建议
          </h4>
          <div className="space-y-3">
            {features.map((feature: any, idx: number) => (
              <div key={idx} className="bg-white rounded-xl p-4 border border-blue-200">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h5 className="text-sm font-bold text-gray-900">{str(feature?.name) || `功能 ${idx + 1}`}</h5>
                  {feature?.priority ? (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700 shrink-0">
                      {str(feature.priority)}优先级
                    </span>
                  ) : null}
                </div>
                {feature?.description ? <p className="text-sm text-gray-700 mb-2">{str(feature.description)}</p> : null}
                {feature?.reason ? <p className="text-xs text-blue-700 bg-blue-50 rounded-lg p-2 mb-1">{str(feature.reason)}</p> : null}
                {feature?.implementation ? (
                  <p className="text-xs text-gray-600 bg-gray-50 rounded-lg p-2">{str(feature.implementation)}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {ux.length ? (
        <div className="bg-gradient-to-br from-green-50 to-teal-50 border-2 border-green-200 rounded-2xl p-4">
          <h4 className="text-sm font-bold text-gray-900 mb-3">用户体验优化</h4>
          <div className="grid md:grid-cols-2 gap-2">
            {ux.map((s, idx) => (
              <div key={idx} className="bg-white rounded-lg p-3 border border-green-200 text-sm text-gray-700">
                {s}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {tech.length ? (
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-2xl p-4">
          <h4 className="text-sm font-bold text-gray-900 mb-3">技术架构建议</h4>
          <ul className="space-y-2">
            {tech.map((t, idx) => (
              <li key={idx} className="text-sm text-gray-700 bg-white rounded-lg p-3 border border-purple-200">
                {t}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {iteration.length ? (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-4">
          <h4 className="text-sm font-bold text-gray-900 mb-3">迭代计划建议</h4>
          <div className="space-y-3">
            {iteration.map((phase: any, idx: number) => (
              <div key={idx} className="bg-white rounded-xl p-4 border border-amber-200">
                <h5 className="font-bold text-gray-900 text-sm">{str(phase?.phase) || `阶段 ${idx + 1}`}</h5>
                {phase?.duration ? <p className="text-sm text-gray-600 mt-1">预计周期：{str(phase.duration)}</p> : null}
                {phase?.focus ? <p className="text-sm text-gray-700 mt-2">{str(phase.focus)}</p> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** 选题卡片：项目名突出 + 审核区 + 正文条目；可附带关联创意 AI 总分/分项 */
export function TopicCardView({ topic, aiAnalysis }: { topic: any; aiAnalysis?: unknown }) {
  if (!topic) return <EmptyHint text="尚未提交" />;
  const statusMap: Record<string, string> = {
    approved: '已通过',
    rejected: '已退回',
    pending: '待审核',
    draft: '草稿',
  };
  const status = statusMap[String(topic.status || '')] || String(topic.status || '—');
  const statusCls =
    topic.status === 'approved'
      ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
      : topic.status === 'rejected'
        ? 'bg-rose-100 text-rose-700 border-rose-200'
        : 'bg-amber-100 text-amber-700 border-amber-200';
  const headerIcon =
    topic.status === 'approved'
      ? 'ri-checkbox-circle-fill text-emerald-500'
      : topic.status === 'rejected'
        ? 'ri-close-circle-fill text-rose-500'
        : 'ri-time-fill text-amber-500';
  const rows: [string, string, string][] = [
    ['项目方向', String(topic.projectDirection || ''), 'ri-compass-3-line'],
    ['项目描述', String(topic.projectDescription || ''), 'ri-file-text-line'],
    ['目标用户', String(topic.targetUsers || ''), 'ri-user-heart-line'],
    ['核心价值主张', String(topic.coreValue || ''), 'ri-trophy-line'],
    ['解决的核心问题', String(topic.coreProblem || ''), 'ri-error-warning-line'],
    ['解决方案概述', String(topic.solutionOverview || ''), 'ri-lightbulb-line'],
    ['市场规模', String(topic.marketSize || ''), 'ri-pie-chart-line'],
    ['竞争优势', String(topic.competitiveAdvantage || ''), 'ri-sword-line'],
  ];
  const totalScore = topic.totalScore ?? topic.total_score;
  const scoreJson = asObj(topic.scoreJson || topic.score_json);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      <div className="bg-gradient-to-br from-teal-500 to-cyan-600 px-5 py-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-white/80 mb-1">项目选题</div>
            <h3 className="text-xl font-bold tracking-tight break-words">
              {String(topic.projectName || '').trim() || '未命名项目'}
            </h3>
            <p className="text-xs text-white/75 mt-2">提交于 {String(topic.submittedAt || '—')}</p>
          </div>
          <span
            className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border bg-white/95 ${statusCls}`}
          >
            <i className={headerIcon} />
            {status}
          </span>
        </div>
      </div>

      {(topic.reviewComment || totalScore != null || Object.keys(scoreJson).length > 0) && (
        <div className="mx-4 mt-4 rounded-xl border border-amber-100 bg-amber-50/70 p-3.5 space-y-2">
          <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
            <i className="ri-chat-check-line" />
            教师审核
          </div>
          {totalScore != null && totalScore !== '' ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-amber-800">总分</span>
              <span className="text-lg font-black text-teal-700">{String(totalScore)}</span>
            </div>
          ) : null}
          {Object.keys(scoreJson).length ? (
            <div className="grid sm:grid-cols-2 gap-1.5">
              {Object.entries(scoreJson).map(([k, v]) => (
                <div
                  key={k}
                  className="text-[11px] text-gray-600 flex justify-between gap-2 bg-white rounded-lg px-2 py-1.5 border border-amber-100/80"
                >
                  <span>{k}</span>
                  <span className="font-semibold text-gray-900">{str(v)}</span>
                </div>
              ))}
            </div>
          ) : null}
          {topic.reviewComment ? (
            <p className="text-sm text-amber-950 whitespace-pre-wrap break-words leading-relaxed m-0">
              {String(topic.reviewComment)}
            </p>
          ) : null}
        </div>
      )}

      {aiAnalysis ? (
        <div className="mx-4 mt-3">
          <div className="text-xs font-semibold text-gray-500 mb-2 px-0.5">关联创意 AI 评分（团队最高分）</div>
          <IdeaAiAnalysisView analysis={aiAnalysis} />
        </div>
      ) : null}

      <div className="p-4 space-y-2.5">
        {rows.map(([label, value, icon]) => (
          <div key={label} className="rounded-xl border border-gray-100 bg-gray-50/40 px-3.5 py-3">
            <div className="text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1.5">
              <i className={`${icon} text-teal-600`} />
              {label}
            </div>
            <p className="text-sm text-gray-900 whitespace-pre-wrap break-words leading-relaxed m-0">
              {value.trim() || '未填写'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SubTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: string; label: string }[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 px-1.5 py-1.5 overflow-x-auto">
      <div className="flex gap-1 min-w-max">
        {tabs.map((t) => {
          const on = t.key === active;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onChange(t.key)}
              className={`px-2.5 md:px-3 py-1.5 rounded-lg text-[11px] md:text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                on ? 'bg-teal-500 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Pane({ children }: { children: ReactNode }) {
  return <div className="mt-2 md:mt-3 space-y-2 md:space-y-3">{children}</div>;
}
