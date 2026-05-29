import { portalAuthenticatedFetch } from './authApi';

function adminFetch(path: string, opts: RequestInit = {}) {
  return portalAuthenticatedFetch('admin', path, opts);
}

export type AdminOverviewTimeRange = '7days' | '30days';

export type AdminOverviewResponse = {
  stats: {
    students: number;
    teachers: number;
    classes: number;
    activeTeams: number;
  };
  activityTrends: { date: string; value: number }[];
  recentOperations: {
    type: string;
    typeLabel: string;
    action: string;
    detail: string;
    operator: string;
    time: string;
    icon: string;
    iconColor: string;
    bgColor: string;
  }[];
};

export async function fetchAdminOverview(range: AdminOverviewTimeRange): Promise<AdminOverviewResponse> {
  const j = (await adminFetch(`/api/admin/overview?range=${encodeURIComponent(range)}`)) as AdminOverviewResponse;
  return j;
}

