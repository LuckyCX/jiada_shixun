import { portalAuthenticatedFetch } from './authApi';

function adminFetch(path: string, opts: RequestInit = {}) {
  return portalAuthenticatedFetch('admin', path, opts);
}

export type AdminOperationLogType = 'all' | 'user' | 'class' | 'course' | 'system';
export type AdminOperationLogTimeRange = 'today' | '7days' | '30days';

export type AdminOperationLogRow = {
  id: string;
  type: Exclude<AdminOperationLogType, 'all'>;
  typeLabel: string;
  action: string;
  detail: string;
  operator: string;
  time: string;
  timestamp: string;
  icon: string;
  iconColor: string;
  bgColor: string;
};

export type AdminOperationLogListResponse = {
  list: AdminOperationLogRow[];
  total: number;
  page: number;
  pageSize: number;
  stats: { total: number; byType: Record<string, number> };
};

export async function fetchAdminOperationLogs(params: {
  type: AdminOperationLogType;
  timeRange: AdminOperationLogTimeRange;
  q: string;
  page: number;
  pageSize: number;
}): Promise<AdminOperationLogListResponse> {
  const qs = new URLSearchParams();
  qs.set('type', params.type);
  qs.set('timeRange', params.timeRange);
  if (params.q) qs.set('q', params.q);
  qs.set('page', String(params.page));
  qs.set('pageSize', String(params.pageSize));
  const j = (await adminFetch(`/api/admin/operation-logs?${qs.toString()}`)) as AdminOperationLogListResponse;
  return j;
}

