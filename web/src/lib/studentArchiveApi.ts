import { portalAuthenticatedFetch } from './authApi';

export type ArchiveStats = {
  knowledgeCount: number;
  caseCount: number;
  taskCount: number;
  evaluationCount: number;
};

export type ArchiveRecordType = 'case' | 'task' | 'evaluation';

export type ArchiveRecord = {
  id: string;
  type: ArchiveRecordType;
  title: string;
  module: string;
  date: string;
  status: string;
  score: number | null;
  content?: string | null;
};

export async function fetchStudentArchive(
  classId: string,
  opts: { limit?: number } = {}
): Promise<{ stats: ArchiveStats; records: ArchiveRecord[] }> {
  const q = new URLSearchParams();
  if (opts.limit != null) q.set('limit', String(opts.limit));
  const suffix = q.toString() ? `?${q}` : '';
  return portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/archive${suffix}`
  ) as Promise<{ stats: ArchiveStats; records: ArchiveRecord[] }>;
}

