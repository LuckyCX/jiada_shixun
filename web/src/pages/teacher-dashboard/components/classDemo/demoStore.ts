/**
 * 教学演示只存在当前浏览器标签的 sessionStorage。
 * 刷新会读回；关闭标签由浏览器清空。不写学生业务库。
 */
export type DemoStageKey =
  | 'overview'
  | 'knowledge'
  | 'archive'
  | 'team'
  | 'ideation'
  | 'market'
  | 'product'
  | 'business'
  | 'simulation'
  | 'plan'
  | 'topicReview'
  | 'bmcReview'
  | 'planReview';

export type DemoArchiveItem = {
  id: string;
  kind: 'knowledge' | 'case' | 'task' | 'evaluation';
  title: string;
  detail: string;
  at: string;
};

export type DemoTeamSession = {
  answers: Record<string, string | string[]>;
  status: string | null;
  videoUrl: string | null;
  videoName: string | null;
  analysisText: string | null;
  dimensionProfile: { strategic: number; market: number; techRisk: number } | null;
  aiMatchedRole: string | null;
  aiMatchedRoleLabel: string | null;
  groupingPreference: 'solo' | 'pool' | null;
  teamName: string;
  introduction: string;
};

export type DemoFile = { name: string; url: string };

export type DemoMember = { id: string; name: string; role: string };

export type DemoPersona = {
  id: string;
  name: string;
  age: string;
  occupation: string;
  major: string;
  painPoints: string;
  needs: string;
  habits: string;
};

export type DemoSimPoint = { day: number; users: number; revenue: number };

export type DemoSimRound = {
  id: string;
  model: string;
  budget: string;
  note: string;
  summary: string;
  users: number;
  revenue: number;
  cac: number;
  ltv: number;
  series: DemoSimPoint[];
};

export type DemoState = {
  team: {
    mode: 'solo' | 'virtual';
    name: string;
    intro: string;
    members: DemoMember[];
    confirmed: boolean;
    assessmentAnswers: Record<string, number>;
    assessmentScore: number | null;
  };
  ideation: {
    notes: Record<string, string>;
    ideas: { id: string; title: string; detail: string }[];
    aiText: string;
    topic: string;
    topicDetail: string;
    reviewStatus: 'draft' | 'pending' | 'approved' | 'rejected';
    reviewComment: string;
  };
  market: {
    plan: string;
    assignment: string;
    surveyTitle: string;
    questions: { id: string; title: string }[];
    responses: { id: string; answers: string[] }[];
    personas: DemoPersona[];
    challenge: string;
    analysis: string;
    files: DemoFile[];
  };
  product: {
    brief: string;
    suggestion: string;
    toolNotes: string;
    files: DemoFile[];
  };
  business: {
    swot: { strengths: string; weaknesses: string; opportunities: string; threats: string };
    marketing: { product: string; price: string; place: string; promotion: string };
    finance: string;
    warroom: string;
    canvas: Record<string, string>;
  };
  simulation: { rounds: DemoSimRound[] };
  plan: {
    points: string;
    files: DemoFile[];
    submitted: boolean;
    score: string;
    comment: string;
  };
  learning: {
    resourceProgress: Record<string, number>;
    knowledgePassed: Record<string, boolean>;
    archive: DemoArchiveItem[];
  };
  teamSession: DemoTeamSession;
  /** 对标学生页的完整业务对象，只放 session，不进学生库。 */
  flows: Record<string, unknown>;
};

const CANVAS_KEYS = [
  'keyPartnerships',
  'keyActivities',
  'valueProposition',
  'customerRelationships',
  'customerSegments',
  'keyResources',
  'channels',
  'costStructure',
  'revenueStreams',
];

export function demoId() {
  return `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function emptyDemoState(): DemoState {
  const canvas: Record<string, string> = {};
  CANVAS_KEYS.forEach((key) => {
    canvas[key] = '';
  });
  return {
    team: {
      mode: 'solo',
      name: '',
      intro: '',
      members: [{ id: demoId(), name: '演示学员', role: '负责人' }],
      confirmed: false,
      assessmentAnswers: {},
      assessmentScore: null,
    },
    ideation: {
      notes: {},
      ideas: [],
      aiText: '',
      topic: '',
      topicDetail: '',
      reviewStatus: 'draft',
      reviewComment: '',
    },
    market: {
      plan: '',
      assignment: '',
      surveyTitle: '',
      questions: [],
      responses: [],
      personas: [],
      challenge: '',
      analysis: '',
      files: [],
    },
    product: { brief: '', suggestion: '', toolNotes: '', files: [] },
    business: {
      swot: { strengths: '', weaknesses: '', opportunities: '', threats: '' },
      marketing: { product: '', price: '', place: '', promotion: '' },
      finance: '',
      warroom: '',
      canvas,
    },
    simulation: { rounds: [] },
    plan: { points: '', files: [], submitted: false, score: '', comment: '' },
    learning: { resourceProgress: {}, knowledgePassed: {}, archive: [] },
    teamSession: {
      answers: {},
      status: null,
      videoUrl: null,
      videoName: null,
      analysisText: null,
      dimensionProfile: null,
      aiMatchedRole: null,
      aiMatchedRoleLabel: null,
      groupingPreference: null,
      teamName: '',
      introduction: '',
    },
    flows: {},
  };
}

function storageKey(classId: string) {
  return `teacher-class-demo:v1:${classId}`;
}

/** sessionStorage 大约 5MB，超长 AI 文本截断，避免整页保存失败。 */
function trimLongStrings(node: unknown) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach(trimLongStrings);
    return;
  }
  const rec = node as Record<string, unknown>;
  Object.keys(rec).forEach((key) => {
    const value = rec[key];
    if (typeof value === 'string' && value.length > 4000) rec[key] = `${value.slice(0, 4000)}…（已截断）`;
    else if (value && typeof value === 'object') trimLongStrings(value);
  });
}

function mergeDemo(base: DemoState, saved: Partial<DemoState>): DemoState {
  return {
    ...base,
    ...saved,
    team: {
      ...base.team,
      ...saved.team,
      members: saved.team?.members?.length ? saved.team.members : base.team.members,
      assessmentAnswers: { ...base.team.assessmentAnswers, ...saved.team?.assessmentAnswers },
    },
    ideation: { ...base.ideation, ...saved.ideation, notes: { ...base.ideation.notes, ...saved.ideation?.notes } },
    market: { ...base.market, ...saved.market },
    product: { ...base.product, ...saved.product },
    business: {
      ...base.business,
      ...saved.business,
      swot: { ...base.business.swot, ...saved.business?.swot },
      marketing: { ...base.business.marketing, ...saved.business?.marketing },
      canvas: { ...base.business.canvas, ...saved.business?.canvas },
    },
    simulation: { rounds: saved.simulation?.rounds || base.simulation.rounds },
    plan: { ...base.plan, ...saved.plan },
    learning: {
      ...base.learning,
      ...saved.learning,
      resourceProgress: { ...base.learning.resourceProgress, ...saved.learning?.resourceProgress },
      knowledgePassed: { ...base.learning.knowledgePassed, ...saved.learning?.knowledgePassed },
      archive: saved.learning?.archive || base.learning.archive,
    },
    teamSession: { ...base.teamSession, ...saved.teamSession, answers: { ...base.teamSession.answers, ...saved.teamSession?.answers } },
    flows: { ...(base.flows || {}), ...(saved.flows || {}) },
  };
}

export function updateDemoState(classId: string, updater: (prev: DemoState) => DemoState) {
  const next = updater(loadDemoState(classId));
  saveDemoState(classId, next);
  return next;
}

export function loadDemoState(classId: string): DemoState {
  if (!classId) return emptyDemoState();
  try {
    const raw = sessionStorage.getItem(storageKey(classId));
    if (!raw) return emptyDemoState();
    const parsed = JSON.parse(raw) as { v?: number; state?: DemoState };
    if (!parsed?.state) return emptyDemoState();
    return mergeDemo(emptyDemoState(), parsed.state);
  } catch (e) {
    console.error('[classDemo] 读取演示数据失败', e);
    return emptyDemoState();
  }
}

export function saveDemoState(classId: string, state: DemoState) {
  const next = JSON.parse(JSON.stringify(state)) as DemoState;
  let text = JSON.stringify({ v: 1, state: next });
  if (text.length > 3_500_000) {
    trimLongStrings(next);
    text = JSON.stringify({ v: 1, state: next });
  }
  try {
    sessionStorage.setItem(storageKey(classId), text);
  } catch (e) {
    console.error('[classDemo] 写入 sessionStorage 失败', e);
    throw new Error('演示数据过大，浏览器无法保存。请缩短文本后再试。');
  }
}

export function clearDemoState(classId: string) {
  sessionStorage.removeItem(storageKey(classId));
}
