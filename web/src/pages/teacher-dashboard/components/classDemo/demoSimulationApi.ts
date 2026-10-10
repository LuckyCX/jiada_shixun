/**
 * AI 仿真演示。推演结果只留在 session，不写学生仿真记录。
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

export async function fetchRoleSimulationMemberRecords(classId: string, studentId: string): Promise<RoleSimulationMemberRecordsResponse> {
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
  let text = '';
  try {
    text = await generateDemoAi(
      classId,
      'simulation',
      `商业模式 ${body.businessModel}，配置 ${JSON.stringify(body.config || {})}`
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : '推演失败';
    onEvent({ event: 'error', data: { message } });
    throw e;
  }
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
    : Array.from({ length: 7 }, (_, index) => ({ day: index + 1, users: Number(parsed.users || 0), revenue: Number(parsed.revenue || 0) }));
  const days: RoleSimulationDayResult[] = series.map((point) => ({
    type: 'day',
    day: Number(point.day || 0),
    users: Number(point.users || 0),
    revenue: Number(point.revenue || 0),
    cac: Number(parsed.cac || 0),
    ltv: Number(parsed.ltv || 0),
  }));
  days.forEach((day) => onEvent({ event: 'day_result', data: day }));
  const last = days[days.length - 1];
  const optimize: RoleSimulationOptimize = {
    suggestions: [{ title: '课堂推演', desc: parsed.summary || text.slice(0, 300), impact: '演示' }],
    comparison: { current: { summary: parsed.summary || '' }, optimized: { summary: parsed.summary || '' } },
  };
  const tracking = {
    days,
    users: Number(parsed.users ?? last?.users ?? 0),
    revenue: Number(parsed.revenue ?? last?.revenue ?? 0),
    cac: Number(parsed.cac || 0),
    ltv: Number(parsed.ltv || 0),
  };
  onEvent({ event: 'final_snapshot', data: { optimize } });
  const done: RoleSimulationDone = { runId, runIndex, createdAt, tracking, optimize };
  writeFlow(classId, 'simulation', [{ id: runId, runIndex, createdAt, config: body.config, tracking, optimize }, ...runs]);
  onEvent({ event: 'done', data: done });
}
