/**
 * AI 仿真演示。推演结果只留在 session，不写学生仿真记录。
 * 按天触发 day_result，与学生端流式体验对齐。
 */
import { generateDemoAi } from './demoApi';
import { DEMO_STUDENT_ID, DEMO_STUDENT_NAME, demoId, nowIso, parseLooseJson, readFlow, writeFlow } from './demoFlow';
import type {
  RoleSimulationDayResult,
  RoleSimulationDone,
  RoleSimulationMemberRecordsResponse,
  RoleSimulationOptimize,
  RoleSimulationRecordsResponse,
} from '../../../../lib/roleSimulationApi';

export type {
  RoleSimulationDayResult,
  RoleSimulationDone,
  RoleSimulationEntry,
  RoleSimulationMemberRecordsResponse,
  RoleSimulationOptimize,
  RoleSimulationRecordsResponse,
} from '../../../../lib/roleSimulationApi';

type SimRun = {
  id: string;
  runIndex: number;
  createdAt: string;
  config: unknown;
  tracking: RoleSimulationDone['tracking'];
  optimize: RoleSimulationOptimize;
};

function readRuns(classId: string) {
  return readFlow<SimRun[]>(classId, 'simulation', []);
}

export async function fetchRoleSimulationEntry(_classId: string) {
  return {
    allowed: true,
    prerequisiteModuleKey: '',
    requiredKnowledgePointCount: 0,
    passedKnowledgePointCount: 0,
    summary: '',
  };
}

function toRecords(runs: SimRun[]): RoleSimulationRecordsResponse {
  return {
    members: [
      {
        studentId: DEMO_STUDENT_ID,
        studentName: DEMO_STUDENT_NAME,
        records: runs.map((item) => ({
          id: item.id,
          runIndex: item.runIndex,
          createdAt: item.createdAt,
          summary: {
            users: item.tracking.users,
            revenue: item.tracking.revenue,
            cac: item.tracking.cac,
            ltv: item.tracking.ltv,
          },
        })),
      },
    ],
    progress: [
      {
        studentId: DEMO_STUDENT_ID,
        studentName: DEMO_STUDENT_NAME,
        runCount: runs.length,
        effectiveRounds: runs.length,
        qualified: runs.length > 0,
      },
    ],
    teamQualified: runs.length > 0,
  };
}

export async function fetchRoleSimulationRecords(classId: string) {
  return toRecords(readRuns(classId));
}

export async function fetchRoleSimulationMemberRecords(
  classId: string,
  studentId: string
): Promise<RoleSimulationMemberRecordsResponse> {
  const records = readRuns(classId).map((item) => ({
    id: item.id,
    runIndex: item.runIndex,
    createdAt: item.createdAt,
    config: item.config,
    tracking: item.tracking,
    optimize: item.optimize,
  }));
  return { studentId, records };
}

type SseEvent =
  | { event: 'thinking_delta'; data: { line?: string; lines?: string[] } }
  | { event: 'day_result'; data: RoleSimulationDayResult }
  | { event: 'final_snapshot'; data: { optimize: RoleSimulationOptimize } }
  | { event: 'done'; data: RoleSimulationDone }
  | { event: 'error'; data: { message: string } }
  | { event: 'start'; data: { runId: string; runIndex: number; createdAt?: string } };

/** 演示侧：累计营收 + 平台期 + 打破 users×定价 锁步 */
function normalizeDemoSimDays(
  days: Array<{ day: number; users: number; revenue: number; cac: number; ltv: number; type?: string }>,
  priceHint = 0
) {
  const sorted = [...days].sort((a, b) => a.day - b.day).map((d) => ({ ...d }));
  if (sorted.length < 2) return sorted;

  const revs = sorted.map((d) => Number(d.revenue || 0));
  const zeros = revs.filter((r) => r === 0).length;
  const looksDaily = zeros >= Math.floor(sorted.length * 0.25);
  if (looksDaily) {
    let cum = 0;
    for (let i = 0; i < sorted.length; i += 1) {
      cum += Math.max(0, Number(sorted[i].revenue || 0));
      sorted[i].revenue = cum;
    }
  } else {
    let maxR = 0;
    for (const d of sorted) {
      if (d.revenue < maxR) d.revenue = maxR;
      maxR = d.revenue;
    }
  }
  for (let i = 2; i < sorted.length; i += 3) {
    sorted[i].users = sorted[i - 1].users;
  }

  let price = Number(priceHint || 0);
  if (!(price > 0)) {
    const ltvs = sorted.map((d) => Number(d.ltv) || 0).filter((x) => x > 0).sort((a, b) => a - b);
    if (ltvs.length) price = ltvs[Math.floor(ltvs.length / 2)];
  }
  if (!(price > 0)) return sorted;

  let lockstep = 0;
  for (const d of sorted) {
    if (Math.abs(Number(d.revenue) - Number(d.users) * price) <= Math.max(1, price * 0.05)) lockstep += 1;
  }
  if (lockstep < Math.floor(sorted.length * 0.55)) return sorted;

  // 重算营收：试用未付费 vs 复购/加购，使两条曲线分叉
  let revenue = 0;
  for (let i = 0; i < sorted.length; i += 1) {
    const prevUsers = i > 0 ? Number(sorted[i - 1].users) || 0 : 0;
    const users = Number(sorted[i].users) || 0;
    const added = Math.max(0, users - prevUsers);
    const prevRevenue = revenue;
    if (added > 0) {
      const convert = i % 3 === 0 ? 0 : Math.max(1, Math.round(added * 0.65));
      revenue += convert * price;
      if (i % 11 === 0 && convert > 0) revenue += price;
    } else if (users > 0) {
      if (i % 4 === 0) revenue += Math.round(price * 0.45);
      if (i % 9 === 0) revenue += price;
    }
    if (revenue < prevRevenue) revenue = prevRevenue;
    sorted[i].revenue = Math.round(revenue);
  }
  return sorted;
}

/** 从模型文本抽出 JSON 对象（兼容 NDJSON / 多行美化） */
function extractJsonObjects(text: string): Record<string, unknown>[] {
  const objects: Record<string, unknown>[] = [];
  const s = String(text || '');
  let i = 0;
  while (i < s.length) {
    while (i < s.length && /\s/.test(s[i])) i += 1;
    if (i >= s.length) break;
    if (s[i] !== '{') {
      const next = s.indexOf('{', i);
      if (next < 0) break;
      i = next;
    }
    let depth = 0;
    let inStr = false;
    let esc = false;
    const start = i;
    let closed = false;
    for (; i < s.length; i += 1) {
      const c = s[i];
      if (inStr) {
        if (esc) {
          esc = false;
          continue;
        }
        if (c === '\\') {
          esc = true;
          continue;
        }
        if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') {
        inStr = true;
        continue;
      }
      if (c === '{') depth += 1;
      else if (c === '}') {
        depth -= 1;
        if (depth === 0) {
          try {
            objects.push(JSON.parse(s.slice(start, i + 1)) as Record<string, unknown>);
          } catch {
            /* ignore */
          }
          i += 1;
          closed = true;
          break;
        }
      }
    }
    if (!closed) break;
  }
  return objects;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function streamRoleSimulation(
  classId: string,
  body: { businessModel: string; config: unknown; prevRunId?: string; runId?: string },
  onEvent: (ev: SseEvent) => void,
  _signal?: AbortSignal
) {
  const runs = readRuns(classId);
  const runId = demoId();
  const runIndex = runs.length + 1;
  const createdAt = nowIso();
  onEvent({ event: 'start', data: { runId, runIndex, createdAt } });
  onEvent({ event: 'thinking_delta', data: { line: '正在做课堂推演…' } });

  // 演示侧同样抽样主基调，避免课堂每次都是上涨曲线
  const roll = Math.random();
  const toneHint =
    roll < 0.2
      ? '乐观（须有挫折与回撤）'
      : roll < 0.6
        ? '中性偏谨慎（拉锯、平台期）'
        : '悲观/失败倾向（禁止第14天翻盘成功）';

  let text = '';
  try {
    text = await generateDemoAi(
      classId,
      'simulation',
      `商业模式 ${body.businessModel}，配置 ${JSON.stringify(body.config || {})}\n本轮主基调：${toneHint}\n曲线要求：users与revenue均为累计值，用平台期表达淡季；禁止当日流水式0/高交替；禁止天天匀速上涨；至少4天profit为负。`
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : '推演失败';
    onEvent({ event: 'error', data: { message } });
    throw e;
  }

  const objects = extractJsonObjects(text);
  let days: RoleSimulationDayResult[] = objects
    .filter((o) => o?.type === 'day' && Number.isFinite(Number(o.day)))
    .map((o) => ({
      type: 'day' as const,
      day: Number(o.day),
      users: Number(o.users || 0),
      revenue: Number(o.revenue || 0),
      cac: Number(o.cac || 0),
      ltv: Number(o.ltv || 0),
      notes: String(o.notes || ''),
    }))
    .sort((a, b) => a.day - b.day);

  const finalObj = objects.find((o) => o?.type === 'final');
  let optimize: RoleSimulationOptimize =
    finalObj?.optimize && typeof finalObj.optimize === 'object'
      ? (finalObj.optimize as RoleSimulationOptimize)
      : {
          suggestions: [{ title: '课堂推演', desc: text.slice(0, 300), impact: '演示' }],
          comparison: { current: { summary: '' }, optimized: { summary: '' } },
        };

  // 兼容旧版单一 JSON（summary + series）
  if (!days.length) {
    const parsed = parseLooseJson<{
      summary?: string;
      users?: number;
      revenue?: number;
      cac?: number;
      ltv?: number;
      series?: { day: number; users: number; revenue: number }[];
    }>(text, {});
    const series = parsed.series?.length
      ? parsed.series
      : Array.from({ length: 7 }, (_, index) => ({
          day: index + 1,
          users: Number(parsed.users || 0),
          revenue: Number(parsed.revenue || 0),
        }));
    days = series.map((point) => ({
      type: 'day',
      day: Number(point.day || 0),
      users: Number(point.users || 0),
      revenue: Number(point.revenue || 0),
      cac: Number(parsed.cac || 0),
      ltv: Number(parsed.ltv || 0),
    }));
    if (parsed.summary) {
      optimize = {
        suggestions: [{ title: '课堂推演', desc: parsed.summary, impact: '演示' }],
        comparison: { current: { summary: parsed.summary }, optimized: { summary: parsed.summary } },
      };
    }
  }

  // 演示侧累计整形 + 打破 users/revenue 锁步（与学生端 normalize 语义对齐）
  const normalized = normalizeDemoSimDays(days, Number((body as any)?.config?.price || 0));

  for (const day of normalized) {
    onEvent({ event: 'day_result', data: day });
    await sleep(120);
  }

  const last = normalized[normalized.length - 1];
  const tracking = {
    days: normalized,
    users: Number(last?.users ?? 0),
    revenue: Number(last?.revenue ?? 0),
    cac: Number(last?.cac ?? 0),
    ltv: Number(last?.ltv ?? 0),
  };
  onEvent({ event: 'final_snapshot', data: { optimize } });
  const done: RoleSimulationDone = { runId, runIndex, createdAt, tracking, optimize };
  writeFlow(classId, 'simulation', [{ id: runId, runIndex, createdAt, config: body.config, tracking, optimize }, ...runs]);
  onEvent({ event: 'done', data: done });
}
