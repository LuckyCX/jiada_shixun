import { message } from 'antd';
import { portalAuthenticatedFetch } from './authApi';
import { fetchPublicSite } from './publicSite';

/** 开发兜底：管理端未配置时指向本机 EconoVerse */
const DEV_FALLBACK_ORIGIN = (
  import.meta.env.VITE_ECONOVERSE_ORIGIN || 'http://localhost:5173'
).replace(/\/$/, '');

/**
 * 创世纪外链：优先读管理后台「站点配置 · econoverseOrigin」
 */
export async function resolveEconoverseOrigin(): Promise<string> {
  try {
    const site = await fetchPublicSite();
    const fromAdmin = String(site.econoverseOrigin || '')
      .trim()
      .replace(/\/$/, '');
    if (fromAdmin) return fromAdmin;
  } catch {
    /* 公开接口失败时走开发兜底 */
  }
  return DEV_FALLBACK_ORIGIN;
}

/**
 * 已登录学生：申请 hop 并跳转到创世纪（可反复进入，云档跟学号走）。
 */
export async function openEconoverse(): Promise<void> {
  try {
    const origin = await resolveEconoverseOrigin();
    if (!origin) {
      message.error('未配置创世纪地址，请管理员在「系统配置 → 站点」填写游戏外链');
      return;
    }
    const data = (await portalAuthenticatedFetch('student', '/api/auth/econoverse-ticket', {
      method: 'POST',
      body: '{}',
    })) as { ticket?: string };
    const ticket = typeof data?.ticket === 'string' ? data.ticket.trim() : '';
    if (!ticket) {
      message.error('未能签发跳转凭证，请稍后重试');
      return;
    }
    const url = `${origin}/?ticket=${encodeURIComponent(ticket)}`;
    window.location.assign(url);
  } catch (err) {
    message.error((err as Error).message || '进入创世纪失败');
  }
}
