import { getPortalToken, portalAuthenticatedFetch } from './authApi';

export type RoleSimulationEntry = {
  allowed: boolean;
  prerequisiteModuleKey?: string;
  requiredKnowledgePointCount?: number;
  passedKnowledgePointCount?: number;
};

export type RoleSimulationDayResult = {
  type: 'day';
  day: number;
  users: number;
  revenue: number;
  cac: number;
  ltv: number;
  notes?: string;
};

export type RoleSimulationOptimize = {
  suggestions?: { title: string; desc: string; impact: string }[];
  comparison?: {
    current?: { summary?: string };
    optimized?: { summary?: string };
  };
};

export type RoleSimulationDone = {
  runId: string;
  runIndex: number;
  createdAt: string;
  tracking: {
    days: RoleSimulationDayResult[];
    users: number;
    revenue: number;
    cac: number;
    ltv: number;
  };
  optimize: RoleSimulationOptimize;
};

export type RoleSimulationRecordsResponse = {
  members: {
    studentId: string;
    studentName: string;
    records: { id: string; runIndex: number; createdAt: string; summary: { users: number; revenue: number; cac: number; ltv: number } }[];
  }[];
  progress: {
    studentId: string;
    studentName: string;
    runCount: number;
    effectiveRounds: number;
    qualified: boolean;
  }[];
  teamQualified: boolean;
};

export type RoleSimulationMemberRecordsResponse = {
  studentId: string;
  records: { id: string; runIndex: number; createdAt: string; config: any; tracking: any; optimize: any }[];
};

const base = (classId: string) =>
  `/api/student/personal-classes/${encodeURIComponent(classId)}/role-simulation`;

export async function fetchRoleSimulationEntry(classId: string): Promise<RoleSimulationEntry> {
  return portalAuthenticatedFetch('student', `${base(classId)}/entry`) as Promise<RoleSimulationEntry>;
}

export async function fetchRoleSimulationRecords(classId: string): Promise<RoleSimulationRecordsResponse> {
  return portalAuthenticatedFetch('student', `${base(classId)}/records`) as Promise<RoleSimulationRecordsResponse>;
}

export async function fetchRoleSimulationMemberRecords(
  classId: string,
  studentId: string
): Promise<RoleSimulationMemberRecordsResponse> {
  return portalAuthenticatedFetch(
    'student',
    `${base(classId)}/records/${encodeURIComponent(studentId)}`
  ) as Promise<RoleSimulationMemberRecordsResponse>;
}

type SseEvent =
  | { event: 'thinking_delta'; data: { line?: string; lines?: string[] } }
  | { event: 'day_result'; data: RoleSimulationDayResult }
  | { event: 'final_snapshot'; data: { optimize: RoleSimulationOptimize } }
  | { event: 'done'; data: RoleSimulationDone }
  | { event: 'error'; data: { message: string } }
  | { event: 'start'; data: { runId: string; runIndex: number; createdAt?: string } };

function parseSseChunks(text: string) {
  const events: SseEvent[] = [];
  const blocks = text.split('\n\n');
  for (const block of blocks) {
    const lines = block.split('\n');
    let event = '';
    let data = '';
    for (const line of lines) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      if (line.startsWith('data:')) data += line.slice(5).trim();
    }
    if (!event || !data) continue;
    try {
      const parsed = JSON.parse(data);
      events.push({ event: event as any, data: parsed } as any);
    } catch {
      // ignore
    }
  }
  return events;
}

export async function streamRoleSimulation(
  classId: string,
  body: { businessModel: string; config: any; prevRunId?: string; runId?: string },
  onEvent: (ev: SseEvent) => void,
  signal?: AbortSignal
) {
  const token = getPortalToken('student');
  const r = await fetch(`${base(classId)}/simulate/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({ message: '请求失败' }));
    throw new Error(typeof j?.message === 'string' ? j.message : `HTTP ${r.status}`);
  }
  if (!r.body) throw new Error('流式响应为空');

  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // 尽量按事件边界处理：SSE 以双换行分隔
    const idx = buffer.lastIndexOf('\n\n');
    if (idx < 0) continue;
    const chunk = buffer.slice(0, idx + 2);
    buffer = buffer.slice(idx + 2);
    const evs = parseSseChunks(chunk);
    evs.forEach(onEvent);
  }
  if (buffer.trim()) {
    parseSseChunks(buffer).forEach(onEvent);
  }
}

