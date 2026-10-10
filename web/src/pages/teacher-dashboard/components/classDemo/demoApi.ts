import { getPortalToken, portalAuthenticatedFetch } from '../../../../lib/authApi';
import type { DemoFile } from './demoStore';

export type DemoAiScene =
  | 'team'
  | 'ideation'
  | 'market-persona'
  | 'market-challenge'
  | 'market-analysis'
  | 'product'
  | 'business'
  | 'simulation'
  | 'plan-comment';

/** 演示 AI：只取返回文本，由页面写入 sessionStorage。 */
export async function generateDemoAi(classId: string, scene: DemoAiScene, context: string): Promise<string> {
  const data = (await portalAuthenticatedFetch('teacher', `/api/teacher/personal-classes/${classId}/demo/ai`, {
    method: 'POST',
    body: JSON.stringify({ scene, context }),
  })) as { text?: string };
  return String(data?.text || '').trim();
}

/** 演示文件上传。返回的地址只应记在 session，不进入团队提交。 */
export async function uploadDemoFile(classId: string, file: File): Promise<DemoFile> {
  const token = getPortalToken('teacher') || '';
  const form = new FormData();
  form.append('file', file);
  const r = await fetch(`/api/teacher/personal-classes/${classId}/demo/files`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const j = (await r.json().catch(() => ({ code: -1, message: '无效 JSON' }))) as {
    code?: number;
    message?: string;
    data?: DemoFile;
  };
  if (!r.ok || j.code !== 0 || !j.data?.url) {
    throw new Error(typeof j.message === 'string' ? j.message : '上传失败');
  }
  return { name: j.data.name || file.name, url: j.data.url };
}
