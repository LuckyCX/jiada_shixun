import { getPortalToken, portalAuthenticatedFetch } from './authApi';

export type ProductSuggestionPayload = {
  coreFeatures: {
    name: string;
    description: string;
    priority: string;
    reason: string;
    implementation: string;
  }[];
  userExperience: string[];
  technicalArchitecture: string[];
  iterationPlan: { phase: string; duration: string; focus: string }[];
};

export type ProductSuggestionRecord = {
  id: string;
  studentId: string;
  studentName: string;
  payload: ProductSuggestionPayload;
  createdAt: string;
};

export async function fetchProductDesignContext(classId: string): Promise<{
  contextText: string;
  updatedAt: string;
  updatedBy: string;
}> {
  return portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/product-design/context`
  ) as Promise<{ contextText: string; updatedAt: string; updatedBy: string }>;
}

export async function saveProductDesignContext(classId: string, contextText: string): Promise<void> {
  await portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/product-design/context`,
    { method: 'PUT', body: JSON.stringify({ contextText }) }
  );
}

export async function fetchMyLatestProductSuggestion(classId: string): Promise<{
  latest: { id: string; payload: ProductSuggestionPayload; createdAt: string } | null;
}> {
  const q = new URLSearchParams({ scope: 'mine' });
  return portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/product-design/ai-suggestions?${q}`
  ) as Promise<{ latest: { id: string; payload: ProductSuggestionPayload; createdAt: string } | null }>;
}

export async function fetchAllProductSuggestions(classId: string): Promise<ProductSuggestionRecord[]> {
  const q = new URLSearchParams({ scope: 'all' });
  const data = await portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/product-design/ai-suggestions?${q}`
  );
  return Array.isArray(data) ? (data as ProductSuggestionRecord[]) : [];
}

type ProductDesignStreamHandlers = {
  onStatus?: (message: string) => void;
  onThinking?: (text: string) => void;
  onContent?: (text: string) => void;
  onError?: (message: string) => void;
  onDone?: (data: { id: string; payload: ProductSuggestionPayload; createdAt: string }) => void;
};

async function readProductDesignSse(
  classId: string,
  contextText: string,
  handlers: ProductDesignStreamHandlers
) {
  const { getPortalToken, redirectStudentSessionExpired } = await import('./authApi');
  const token = getPortalToken('student') || '';
  const r = await fetch(
    `/api/student/personal-classes/${encodeURIComponent(classId)}/product-design/ai-suggestions/stream`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ contextText }),
    }
  );
  if (r.status === 401) {
    redirectStudentSessionExpired();
    throw new Error('登录已失效');
  }
  if (!r.ok) {
    const j = await r.json().catch(() => ({ message: '' }));
    throw new Error((j as { message?: string }).message || `HTTP ${r.status}`);
  }
  const reader = r.body?.getReader();
  if (!reader) throw new Error('无法读取响应流');
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = 'message';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (line.startsWith('event:')) {
        currentEvent = line.slice(6).trim();
        continue;
      }
      if (!line.startsWith('data:')) continue;
      const raw = line.slice(5).trim();
      if (!raw) continue;
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        continue;
      }
      if (currentEvent === 'status' && typeof data.message === 'string') {
        handlers.onStatus?.(data.message);
      } else if (currentEvent === 'thinking' && typeof data.text === 'string') {
        handlers.onThinking?.(data.text);
      } else if (currentEvent === 'content' && typeof data.text === 'string') {
        handlers.onContent?.(data.text);
      } else if (currentEvent === 'done') {
        const payload = data.payload as ProductSuggestionPayload | undefined;
        if (payload) {
          handlers.onDone?.({
            id: String(data.id || ''),
            payload,
            createdAt: String(data.createdAt || ''),
          });
        }
      } else if (currentEvent === 'error') {
        const msg = typeof data.message === 'string' ? data.message : '请求失败';
        handlers.onError?.(msg);
        throw new Error(msg);
      }
    }
  }
}

export async function streamProductDesignSuggestion(
  classId: string,
  contextText: string,
  handlers: ProductDesignStreamHandlers
) {
  await readProductDesignSse(classId, contextText, handlers);
}

export type ProductPrototypeParticipation = {
  missingMembers: { id: string; name: string }[];
};

export async function fetchProductPrototypeParticipation(
  classId: string
): Promise<ProductPrototypeParticipation> {
  return portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/product-design/ai-suggestions/participation`
  ) as Promise<ProductPrototypeParticipation>;
}

export async function fetchTeamProductPrototypeStatus(classId: string): Promise<{
  uploaded: boolean;
  originName: string;
  uploadedAt: string;
  uploadedBy: string;
  sizeBytes: number;
}> {
  return portalAuthenticatedFetch(
    'student',
    `/api/student/personal-classes/${encodeURIComponent(classId)}/product-design/prototype`
  ) as Promise<{
    uploaded: boolean;
    originName: string;
    uploadedAt: string;
    uploadedBy: string;
    sizeBytes: number;
  }>;
}

export type UploadProductPrototypeError = Error & {
  missingMembers?: { id: string; name: string }[];
};

export async function uploadTeamProductPrototype(classId: string, file: File): Promise<{ uploaded: boolean }> {
  const token = getPortalToken('student');
  const form = new FormData();
  form.append('file', file);
  const r = await fetch(
    `/api/student/personal-classes/${encodeURIComponent(classId)}/product-design/prototype`,
    {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    }
  );
  const j = (await r.json().catch(() => ({ code: -1, message: '无效响应' }))) as {
    code: number;
    message?: string;
    data?: { uploaded?: boolean; missingMembers?: { id: string; name: string }[] };
  };
  if (!r.ok || j.code !== 0) {
    const err = new Error(typeof j.message === 'string' ? j.message : '上传失败') as UploadProductPrototypeError;
    if (j.data?.missingMembers?.length) err.missingMembers = j.data.missingMembers;
    throw err;
  }
  return { uploaded: Boolean(j.data?.uploaded) };
}
