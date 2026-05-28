import { portalAuthenticatedFetch } from './authApi';
import type { BusinessPlan, ReviewFormData } from '../pages/teacher-dashboard/components/businessPlanReview/types';

function teacherFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  return portalAuthenticatedFetch('teacher', path, opts) as Promise<T>;
}

export async function fetchTeacherBusinessPlanSubmissions(
  classId: string,
  status: 'all' | 'pending' | 'approved' | 'rejected' = 'all'
): Promise<BusinessPlan[]> {
  const q = status === 'all' ? '' : `?status=${encodeURIComponent(status)}`;
  const data = await teacherFetch<{ plans: BusinessPlan[] }>(
    `/api/teacher/personal-classes/${classId}/business-plan/submissions${q}`
  );
  return data.plans || [];
}

export async function reviewTeacherBusinessPlanSubmission(
  classId: string,
  submissionId: string,
  body: ReviewFormData
): Promise<BusinessPlan> {
  const data = await teacherFetch<{ plan: BusinessPlan }>(
    `/api/teacher/personal-classes/${classId}/business-plan/submissions/${submissionId}/review`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  );
  return data.plan;
}
