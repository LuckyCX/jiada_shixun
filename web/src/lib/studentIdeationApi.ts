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

export type IdeationProjectTopicStatus = 'pending' | 'approved' | 'rejected';

export type IdeationProjectTopicInput = {
  projectName: string;
  projectDirection: string;
  projectDescription: string;
  coreValue: string;
  targetUsers: string;
  coreProblem: string;
  solutionOverview: string;
  marketSize: string;
  competitiveAdvantage: string;
};

export type IdeationProjectTopic = IdeationProjectTopicInput & {
  id: string;
  teamId: string;
  teamName: string;
  leaderName: string;
  memberCount: number;
  direction: string;
  description: string;
  submitTime: string;
  status: IdeationProjectTopicStatus;
  reviewComment: string;
  reviewTime: string;
};

export type IdeationProjectTopicDraft = IdeationProjectTopicInput & {
  savedAt: string;
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

export async function unlikeStudentIdeationIdea(classId: string, ideaId: string): Promise<StudentIdeationIdea> {
  return portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/ideation/ideas/${encodeURIComponent(ideaId)}/like`,
    { method: 'DELETE' }
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

export async function fetchStudentIdeationProjectTopic(classId: string): Promise<{
  topic: IdeationProjectTopic | null;
  draft: IdeationProjectTopicDraft | null;
}> {
  return portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/ideation/topic`
  ) as Promise<{ topic: IdeationProjectTopic | null; draft: IdeationProjectTopicDraft | null }>;
}

export async function saveStudentIdeationProjectTopicDraft(
  classId: string,
  body: IdeationProjectTopicInput
): Promise<IdeationProjectTopicDraft> {
  const res = await portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/ideation/topic-draft`,
    {
      method: 'PUT',
      body: JSON.stringify(body),
    }
  ) as { draft: IdeationProjectTopicDraft };
  return res.draft;
}

export async function submitStudentIdeationProjectTopic(
  classId: string,
  body: IdeationProjectTopicInput
): Promise<IdeationProjectTopic> {
  const res = await portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/ideation/topic`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  ) as { topic: IdeationProjectTopic };
  return res.topic;
}

export async function fetchTeacherIdeationProjectTopics(classId: string): Promise<{
  topics: IdeationProjectTopic[];
}> {
  return portalAuthenticatedFetch(
    'teacher',
    `/api/teacher/personal-classes/${encodeURIComponent(classId)}/ideation/topics`
  ) as Promise<{ topics: IdeationProjectTopic[] }>;
}

export async function reviewTeacherIdeationProjectTopic(
  classId: string,
  topicId: string,
  body: { status: 'approved' | 'rejected'; comment: string }
): Promise<IdeationProjectTopic> {
  const res = await portalAuthenticatedFetch(
    'teacher',
    `/api/teacher/personal-classes/${encodeURIComponent(classId)}/ideation/topics/${encodeURIComponent(topicId)}/review`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  ) as { topic: IdeationProjectTopic };
  return res.topic;
}
