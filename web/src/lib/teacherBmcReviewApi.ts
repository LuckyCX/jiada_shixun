import { teacherFetch } from '../pages/teacher-dashboard/teacherPortalApi';
import type { BmcPayload } from './studentBusinessModelApi';

export type TeacherBmcReviewItem = {
  teamId: string;
  teamName: string;
  bmc: BmcPayload;
  savedAt: string;
  submitterName: string;
  status: string;
  reviewComment: string;
  reviewedAt: string;
  reviewerName: string;
};

export async function fetchTeacherBmcReviews(
  classId: string,
  status: 'all' | 'pending' | 'approved' | 'rejected' = 'all'
): Promise<TeacherBmcReviewItem[]> {
  const q = status === 'all' ? '' : `?status=${encodeURIComponent(status)}`;
  const data = (await teacherFetch(`/api/teacher/personal-classes/${classId}/bmc-reviews${q}`)) as {
    items: TeacherBmcReviewItem[];
  };
  return data.items || [];
}

export async function reviewTeacherBmc(
  classId: string,
  teamId: string,
  body: { decision: 'approve' | 'reject'; comment: string }
): Promise<{ teamId: string; status: string; reviewComment: string }> {
  return teacherFetch(`/api/teacher/personal-classes/${classId}/bmc-reviews/${teamId}/review`, {
    method: 'POST',
    body: JSON.stringify(body),
  }) as Promise<{ teamId: string; status: string; reviewComment: string }>;
}
