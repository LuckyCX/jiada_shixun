/**
 * 组队演示接口。界面与学生端相同，读写只进 sessionStorage，不调用学生组队接口。
 * 演示固定一名学员，选择组队池也会落成单人公司，避免没有其他同学时卡住。
 */
import { portalAuthenticatedFetch } from '../../../../lib/authApi';
import {
  isTeamFormationDone,
  normalizeTeamDimensionProfile,
  stripTeamAnalysisStreamDisplay,
  TEAM_DIMENSION_BARS,
  TEAM_ROLE_LABELS,
  type GroupingTeam,
  type TeamAnalyzeResult,
  type TeamAnalyzeStreamHandlers,
  type TeamDimensionProfile,
  type TeamFormationSubmission,
  type TeamFormationWithdrawEligibility,
  type TeamQuestion,
  type TeamRoleKey,
} from '../../../../lib/teamFormationApi';
import { generateDemoAi, uploadDemoFile } from './demoApi';
import { loadDemoState, updateDemoState, type DemoTeamSession } from './demoStore';

export {
  isTeamFormationDone,
  normalizeTeamDimensionProfile,
  stripTeamAnalysisStreamDisplay,
  TEAM_DIMENSION_BARS,
};
export type { GroupingTeam, TeamDimensionProfile, TeamQuestion };

const DEMO_STUDENT_ID = 'demo-student';

function sessionOf(classId: string): DemoTeamSession {
  return loadDemoState(classId).teamSession;
}

function patchSession(classId: string, patch: Partial<DemoTeamSession>) {
  return updateDemoState(classId, (prev) => ({
    ...prev,
    teamSession: { ...prev.teamSession, ...patch },
    team: {
      ...prev.team,
      confirmed: patch.status === 'grouped' || patch.status === 'confirmed' || (patch.status == null && prev.teamSession.status === 'grouped'),
      name: patch.teamName ?? prev.team.name,
      intro: patch.introduction ?? prev.team.intro,
    },
  })).teamSession;
}

function toSubmission(session: DemoTeamSession): TeamFormationSubmission {
  return {
    status: session.status,
    answers: session.answers || {},
    videoStorageKey: session.videoUrl,
    videoTranscript: null,
    aiMatchedRole: session.aiMatchedRole,
    aiMatchedRoleLabel: session.aiMatchedRoleLabel,
    dimensionProfile: session.dimensionProfile || undefined,
    analysisText: session.analysisText,
    submittedAt: session.status && session.status !== 'draft' ? new Date().toISOString() : null,
    groupingPreference: session.groupingPreference,
  };
}

function toTeam(classId: string): GroupingTeam | null {
  const session = sessionOf(classId);
  if (session.status !== 'grouped' && session.status !== 'confirmed') return null;
  const profile = session.dimensionProfile || { strategic: 0, market: 0, techRisk: 0 };
  return {
    id: 'demo-team',
    name: session.teamName || '演示学员的单人公司',
    introduction: session.introduction || '',
    leaderStudentId: DEMO_STUDENT_ID,
    groupingStatus: 'confirmed',
    isSolo: true,
    complementScore: null,
    createdAt: '',
    avgProfile: profile,
    members: [
      {
        id: DEMO_STUDENT_ID,
        name: '演示学员',
        studentId: DEMO_STUDENT_ID,
        aiMatchedRole: session.aiMatchedRole || '',
        aiMatchedRoleLabel: session.aiMatchedRoleLabel || '',
        isTeamLeader: true,
        profile,
        status: 'grouped',
      },
    ],
  };
}

export async function fetchTeamQuestions(classId: string): Promise<TeamQuestion[]> {
  const data = await portalAuthenticatedFetch(
    'teacher',
    `/api/teacher/personal-classes/${encodeURIComponent(classId)}/team-questions`
  );
  return Array.isArray(data) ? (data as TeamQuestion[]) : [];
}

export async function fetchTeamSubmission(classId: string): Promise<TeamFormationSubmission> {
  return toSubmission(sessionOf(classId));
}

export async function saveTeamAnswers(classId: string, answers: Record<string, string | string[]>) {
  const current = sessionOf(classId);
  patchSession(classId, { answers, status: current.status && current.status !== 'draft' ? current.status : 'draft' });
  return { saved: true };
}

export async function uploadTeamVideo(classId: string, file: File) {
  const saved = await uploadDemoFile(classId, file);
  patchSession(classId, { videoUrl: saved.url, videoName: saved.name });
  return { videoStorageKey: saved.url, fileName: saved.name };
}

export async function deleteTeamVideo(classId: string) {
  patchSession(classId, { videoUrl: null, videoName: null, analysisText: null, dimensionProfile: null, aiMatchedRole: null, aiMatchedRoleLabel: null });
  return { deleted: true };
}

export async function loadTeamIntroVideoObjectUrl(_role: 'student' | 'teacher', classId: string) {
  const url = sessionOf(classId).videoUrl;
  if (!url) throw new Error('还没有介绍视频');
  const r = await fetch(url);
  if (!r.ok) throw new Error('视频无法打开');
  return URL.createObjectURL(await r.blob());
}

export async function analyzeTeamFormationStream(classId: string, handlers: TeamAnalyzeStreamHandlers) {
  handlers.onStatus?.('正在生成演示分析');
  const session = sessionOf(classId);
  const text = await generateDemoAi(classId, 'team', JSON.stringify(session.answers || {}));
  handlers.onContent?.(text);
  let result: TeamAnalyzeResult = {
    aiMatchedRole: 'ceo',
    aiMatchedRoleLabel: TEAM_ROLE_LABELS.ceo,
    videoTranscript: '',
    summary: text,
    analysisText: text,
    dimensionProfile: { strategic: 60, market: 60, techRisk: 60 },
  };
  try {
    const raw = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const data = JSON.parse(raw) as Record<string, unknown>;
    const role = String(data.role || 'ceo') as TeamRoleKey;
    const safeRole = role in TEAM_ROLE_LABELS ? role : 'ceo';
    result = {
      aiMatchedRole: safeRole,
      aiMatchedRoleLabel: String(data.roleLabel || TEAM_ROLE_LABELS[safeRole]),
      videoTranscript: '',
      summary: String(data.summary || text),
      analysisText: String(data.summary || text),
      dimensionProfile: {
        strategic: Number(data.strategic || 0),
        market: Number(data.market || 0),
        techRisk: Number(data.techRisk || 0),
      },
    };
  } catch (e) {
    console.error('[classDemo] 组队分析不是 JSON，按原文保存', e);
  }
  patchSession(classId, {
    analysisText: result.analysisText || result.summary,
    dimensionProfile: result.dimensionProfile || null,
    aiMatchedRole: result.aiMatchedRole,
    aiMatchedRoleLabel: result.aiMatchedRoleLabel,
  });
  handlers.onDone?.(result);
}

export async function submitTeamFormation(classId: string, groupingPreference: 'pool' | 'solo' = 'pool') {
  const session = sessionOf(classId);
  patchSession(classId, {
    groupingPreference,
    status: 'grouped',
    teamName: session.teamName || '演示学员的单人公司',
  });
  updateDemoState(classId, (prev) => ({
    ...prev,
    team: { ...prev.team, confirmed: true, mode: 'solo', name: prev.teamSession.teamName || '演示学员的单人公司' },
    learning: {
      ...prev.learning,
      archive: [
        { id: `team-${Date.now()}`, kind: 'task', title: '完成组队', detail: '成立单人公司', at: new Date().toISOString() },
        ...prev.learning.archive,
      ],
    },
  }));
  return { status: 'grouped', groupingPreference: 'solo' as const, teamId: 'demo-team', solo: true };
}

export async function withdrawTeamFormationPool(classId: string) {
  patchSession(classId, { status: 'draft', groupingPreference: null });
  updateDemoState(classId, (prev) => ({ ...prev, team: { ...prev.team, confirmed: false } }));
  return { status: 'draft', withdrawn: true, dissolvedSolo: true };
}

export async function fetchTeamFormationWithdrawEligibility(classId: string): Promise<TeamFormationWithdrawEligibility> {
  const session = sessionOf(classId);
  const canWithdraw = session.status === 'grouped' || session.status === 'confirmed' || session.status === 'pending_teacher';
  return {
    canWithdraw,
    reason: canWithdraw ? '' : '当前还没有可撤回的组队结果',
    code: canWithdraw ? '' : 'not_submitted',
    isSolo: true,
  };
}

export async function resetTeamAssessment(classId: string) {
  const session = sessionOf(classId);
  patchSession(classId, {
    answers: {},
    status: null,
    analysisText: null,
    dimensionProfile: null,
    aiMatchedRole: null,
    aiMatchedRoleLabel: null,
    groupingPreference: null,
    videoUrl: session.videoUrl,
    videoName: session.videoName,
  });
  return { reset: true };
}

export async function updateStudentMyTeamProfile(classId: string, payload: { name: string; introduction: string }) {
  patchSession(classId, { teamName: payload.name, introduction: payload.introduction });
  return toTeam(classId);
}

export async function fetchStudentMyTeam(classId: string) {
  return toTeam(classId);
}

export async function fetchStudentTeamSquare(classId: string) {
  const team = toTeam(classId);
  return team ? [team] : [];
}
