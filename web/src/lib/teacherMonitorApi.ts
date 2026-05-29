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

