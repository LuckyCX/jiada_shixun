import {
  getPortalRefreshToken,
  getPortalToken,
  portalAuthenticatedFetch,
  refreshPortalAccessToken,
  redirectAdminSessionExpired,
  redirectStudentSessionExpired,
  redirectTeacherSessionExpired,
  type PortalRole,
} from './authApi';

export type AiTutorMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
};

export type AiTutorPreset = { id: string; question: string };

export type AiTutorKbEntry = {
  id: string;
  category: string;
  audience: 'student' | 'teacher' | 'both';
  question: string;
  answer: string;
  isPreset: boolean;
  sortOrder: number;
  enabled: boolean;
  updatedAt: string;
};

export async function fetchAiTutorPresets(role: 'teacher' | 'student') {
  const data = (await portalAuthenticatedFetch(role, '/api/ai-tutor/presets')) as { presets: AiTutorPreset[] };
  return data.presets || [];
}

export async function fetchAiTutorMessages(role: 'teacher' | 'student') {
  const data = (await portalAuthenticatedFetch(role, '/api/ai-tutor/messages')) as { messages: AiTutorMessage[] };
  return data.messages || [];
}

export type AiTutorStreamHandlers = {
  onContent?: (text: string) => void;
  onDone?: (reply: string) => void;
};

function redirectIfExpired(role: PortalRole) {
  if (role === 'teacher') redirectTeacherSessionExpired();
  else if (role === 'admin') redirectAdminSessionExpired();
  else redirectStudentSessionExpired();
}

/** 读取助教 SSE：content 增量，done 为落库后的完整正文 */
async function readAiTutorSse(role: PortalRole, path: string, body: Record<string, unknown>, handlers: AiTutorStreamHandlers) {
  const run = async (token: string) => {
    const r = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    return r;
  };

  let token = getPortalToken(role) || '';
  let r = await run(token);
  if (r.status === 401 && getPortalRefreshToken(role)) {
    const ok = await refreshPortalAccessToken(role);
    if (ok) {
      token = getPortalToken(role) || '';
      r = await run(token);
    }
  }
  if (r.status === 401) {
    redirectIfExpired(role);
    throw new Error('登录已失效');
  }
  if (!r.ok) {
    const j = (await r.json().catch(() => ({ message: '' }))) as { message?: string };
    throw new Error(j.message || `HTTP ${r.status}`);
  }
  const reader = r.body?.getReader();
  if (!reader) throw new Error('无法读取响应流');
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = 'message';
  let full = '';
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
      if (currentEvent === 'content' && typeof data.text === 'string') {
        full += data.text;
        handlers.onContent?.(data.text);
      } else if (currentEvent === 'done') {
        const reply = typeof data.reply === 'string' && data.reply ? data.reply : full;
        handlers.onDone?.(reply);
      } else if (currentEvent === 'error') {
        const msg = typeof data.message === 'string' ? data.message : '请求失败';
        throw new Error(msg);
      }
    }
  }
}

export async function sendAiTutorMessage(
  role: 'teacher' | 'student',
  message: string,
  handlers: AiTutorStreamHandlers = {}
) {
  await readAiTutorSse(role, '/api/ai-tutor/chat', { message }, handlers);
}

export async function fetchAdminAiTutorEntries() {
  const data = (await portalAuthenticatedFetch('admin' as PortalRole, '/api/admin/ai-tutor/entries')) as {
    entries: AiTutorKbEntry[];
  };
  return data.entries || [];
}

export async function saveAdminAiTutorEntry(body: Partial<AiTutorKbEntry> & { question: string; answer: string }, id?: string) {
  const path = id ? `/api/admin/ai-tutor/entries/${id}` : '/api/admin/ai-tutor/entries';
  const data = (await portalAuthenticatedFetch('admin', path, {
    method: id ? 'PATCH' : 'POST',
    body: JSON.stringify(body),
  })) as { entry: AiTutorKbEntry };
  return data.entry;
}

export async function deleteAdminAiTutorEntry(id: string) {
  await portalAuthenticatedFetch('admin', `/api/admin/ai-tutor/entries/${id}`, { method: 'DELETE' });
}

export async function testAdminAiTutor(
  audience: 'student' | 'teacher',
  message: string,
  history: { role: string; content: string }[],
  handlers: AiTutorStreamHandlers = {}
) {
  await readAiTutorSse('admin', '/api/admin/ai-tutor/test', { audience, message, history }, handlers);
}
