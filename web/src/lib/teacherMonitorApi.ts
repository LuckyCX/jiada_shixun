import { portalAuthenticatedFetch } from './authApi';

function teacherFetch(path: string, opts: RequestInit = {}) {
  return portalAuthenticatedFetch('teacher', path, opts);
}

export type TeacherMonitorTeam = {
  id: number;
  teamName: string;
  course: string;
  members: { name: string; avatar: string }[];
  leader: string;
  currentStage: string;
  overallProgress: number;
  stageProgress: {
    teamFormation: number;
    ideation: number;
    marketResearch: number;
    productDesign: number;
    businessModel: number;
    aiValidation: number;
    roleSimulation: number;
    businessPlan: number;
  };
  knowledgeProgress: number;
  abilityPoints: number;
  collaborationScore: number;
  qualityScore: number;
  lastActive: string;
  status: 'on-track' | 'at-risk' | 'delayed';
  warnings: string[];
  evaluationStatus: 'pending' | 'reviewed' | 'passed';
  iterationCount: number;
  submissionCount: number;
};

export async function fetchTeacherMonitorTeams(classId: string) {
  const j = (await teacherFetch(
    `/api/teacher/personal-classes/${encodeURIComponent(classId)}/monitor/teams`
  )) as { teams: TeacherMonitorTeam[] };
  return j.teams || [];
}

export type WeeklyActivityPoint = { day: string; value: number };

export async function fetchTeacherMonitorStats(classId: string) {
  const j = (await teacherFetch(
    `/api/teacher/personal-classes/${encodeURIComponent(classId)}/monitor/stats`
  )) as { weeklyActivityData: WeeklyActivityPoint[] };
  return j;
}

export type TeacherMonitorSubmissionItem =
  | {
      id: string;
      stageKey: string;
      stageName: string;
      submitTime: string;
      kind: 'data';
      title: string;
      payload: any;
    }
  | {
      id: string;
      stageKey: string;
      stageName: string;
      submitTime: string;
      kind: 'file';
      title: string;
      file: { name: string; downloadUrl: string };
    }
  | {
      id: string;
      stageKey: string;
      stageName: string;
      submitTime: string;
      kind: 'mixed';
      title: string;
      payload: any;
      files: { name: string; downloadUrl: string }[];
    };

export async function fetchTeacherMonitorTeamSubmissions(classId: string, teamId: number) {
  const j = (await teacherFetch(
    `/api/teacher/personal-classes/${encodeURIComponent(classId)}/monitor/teams/${teamId}/submissions`
  )) as { submissions: TeacherMonitorSubmissionItem[] };
  return j.submissions || [];
}

export type TeacherMarketReportSurveyPreview = {
  id: string;
  title: string;
  status: string;
  questions: { id: string; text: string; type: string; options?: string[] }[];
  collected: number;
  fromPlan?: boolean;
  responses: {
    id: string;
    respondentToken: string;
    submittedAt: string;
    answers: Record<string, unknown>;
  }[];
};

export type TeacherMarketReportPreview = {
  analysisResult: unknown;
  analysisGeneratedAt: string;
  surveys: TeacherMarketReportSurveyPreview[];
  personas: Record<string, unknown>[];
};

export async function fetchTeacherMarketReportPreview(
  classId: string,
  teamId: number
): Promise<TeacherMarketReportPreview> {
  return teacherFetch(
    `/api/teacher/personal-classes/${encodeURIComponent(classId)}/monitor/teams/${teamId}/market-report-preview`
  ) as Promise<TeacherMarketReportPreview>;
}

export async function submitTeacherMonitorBatchScoring(
  classId: string,
  body: { taskType: string; results: { teamId: number; score: number; comment: string }[] }
) {
  return teacherFetch(`/api/teacher/personal-classes/${encodeURIComponent(classId)}/monitor/scoring/batch`, {
    method: 'POST',
    body: JSON.stringify(body),
  }) as Promise<{ saved: boolean }>;
}

export type TeacherWorkspaceMember = {
  studentId: string;
  name: string;
  avatarUrl: string;
  aiMatchedRole: string;
  /** 中文角色名，如「财务负责人」 */
  aiMatchedRoleLabel?: string;
  dimensionProfile: Record<string, unknown>;
};

export type TeacherWorkspaceSummary = {
  team: {
    id: string;
    name: string;
    groupingStatus: string;
    introduction: string;
    leaderStudentId: string;
    leaderName: string;
    isSolo: boolean;
  };
  members: TeacherWorkspaceMember[];
  enabledOrder: string[];
  stages: {
    key: string;
    name: string;
    monitorKey: string;
    progress: number;
    /** 阶段完成时间（未完成为空） */
    completedAt?: string;
  }[];
  stageProgress: Record<string, number>;
  overallProgress: number;
  currentStage: string;
  status: 'on-track' | 'at-risk' | 'delayed';
  warnings: string[];
};

export async function fetchTeacherTeamWorkspaceSummary(
  classId: string,
  teamId: number | string
): Promise<TeacherWorkspaceSummary> {
  return teacherFetch(
    `/api/teacher/personal-classes/${encodeURIComponent(classId)}/monitor/teams/${teamId}/workspace-summary`
  ) as Promise<TeacherWorkspaceSummary>;
}

export type TeacherStageWorkspace = {
  team: TeacherWorkspaceSummary['team'];
  members: TeacherWorkspaceMember[];
  enabledOrder: string[];
  stage: {
    moduleKey: string;
    name: string;
    team: any;
    members: any[];
  };
};

export async function fetchTeacherTeamStageWorkspace(
  classId: string,
  teamId: number | string,
  moduleKey: string
): Promise<TeacherStageWorkspace> {
  return teacherFetch(
    `/api/teacher/personal-classes/${encodeURIComponent(classId)}/monitor/teams/${teamId}/stages/${encodeURIComponent(moduleKey)}`
  ) as Promise<TeacherStageWorkspace>;
}

export type TeacherCockpitStageScore = {
  key: string;
  name: string;
  skipped: boolean;
  weight: number;
  complete: boolean;
  status: string;
  totalScore: number | null;
  comment: string;
  dimensionScores: Record<string, number> | null;
  scoredAt: string;
  evidenceSummary: Record<string, unknown> | null;
};

export type TeacherTeamCockpitInteractionStats = {
  total: number;
  byModule: { key: string; name: string; count: number }[];
  byStudent: { studentId: number; name: string; count: number }[];
  byScene: { scene: string; count: number }[];
  dailyTrend: { day: string; count: number }[];
  recent: {
    id: number;
    moduleKey: string;
    moduleName: string;
    scene: string;
    role: string;
    content: string;
    studentName: string;
    createdAt: string;
  }[];
};

export type TeacherTeamCockpit = {
  team: {
    id: number;
    name: string;
    isSolo: boolean;
    leaderStudentId: number;
    groupingStatus: string;
    introduction: string;
  };
  members: {
    studentId: number;
    name: string;
    avatarUrl: string;
    aiMatchedRole: string;
    dimensionProfile: Record<string, unknown> | null;
  }[];
  weights: Record<string, number>;
  stages: TeacherCockpitStageScore[];
  weightedProcessScore: number | null;
  finalEvaluation: {
    status: string;
    weightedProcessScore: number | null;
    finalScore: number | null;
    summary: string;
    comment: string;
    dimensionScores: Record<string, number> | null;
    scoredAt: string;
  } | null;
  interactionCounts: Record<string, number>;
  interactionStats?: TeacherTeamCockpitInteractionStats;
  allScoringComplete: boolean;
};

export async function fetchTeacherTeamCockpit(
  classId: string,
  teamId: number | string
): Promise<TeacherTeamCockpit> {
  return teacherFetch(
    `/api/teacher/personal-classes/${encodeURIComponent(classId)}/monitor/teams/${teamId}/cockpit`
  ) as Promise<TeacherTeamCockpit>;
}

