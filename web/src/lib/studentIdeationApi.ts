import { portalAuthenticatedFetch } from './authApi';

export type IdeationMethodKey = 'brainstorm' | 'scamper' | 'triz' | 'ai';

export type StudentIdeationAnalysis = {
  overallScore: number;
  novelty: number;
  feasibility: number;
  marketPotential: number;
  innovation: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  tags: string[];
};

export type StudentIdeationIdea = {
  id: string;
  methodKey: IdeationMethodKey;
  method: string;
  title: string;
  description: string;
  formPayload: Record<string, unknown>;
  author: string;
  authorId: string;
  votes: number;
  liked: boolean;
  novelty: number;
  feasibility: number;
  aiAnalysis: StudentIdeationAnalysis;
  createdAt: string;
};

export type StudentIdeationDiscussion = {
  id: string;
  text: string;
  author: string;
  authorId: string;
  createdAt: string;
};

export type StudentIdeationWorkspace = {
  team: { id: string; name: string } | null;
  ideas: StudentIdeationIdea[];
  discussions: StudentIdeationDiscussion[];
};

export type StudentIdeationPrerequisiteMember = {
  studentId: string;
  name: string;
};

export async function fetchStudentIdeationWorkspace(classId: string): Promise<StudentIdeationWorkspace> {
  return portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/ideation/workspace`
  ) as Promise<StudentIdeationWorkspace>;
}

export async function analyzeStudentIdeationIdea(
  classId: string,
  body: { methodKey: IdeationMethodKey; formPayload: Record<string, unknown> }
): Promise<StudentIdeationIdea> {
  return portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/ideation/ideas/analyze`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  ) as Promise<StudentIdeationIdea>;
}

export async function likeStudentIdeationIdea(classId: string, ideaId: string): Promise<StudentIdeationIdea> {
  return portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/ideation/ideas/${encodeURIComponent(ideaId)}/like`,
    { method: 'POST' }
  ) as Promise<StudentIdeationIdea>;
}

export async function sendStudentIdeationDiscussion(
  classId: string,
  content: string
): Promise<StudentIdeationDiscussion[]> {
  return portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/ideation/discussions`,
    {
      method: 'POST',
      body: JSON.stringify({ content }),
    }
  ) as Promise<StudentIdeationDiscussion[]>;
}

export async function fetchStudentIdeationTeamPrerequisites(classId: string): Promise<{
  incompleteMembers: StudentIdeationPrerequisiteMember[];
}> {
  return portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/ideation/team-prerequisites`
  ) as Promise<{ incompleteMembers: StudentIdeationPrerequisiteMember[] }>;
}
