/** 创想小镇沙盒入口（开发经 Vite 代理到 game:5174；生产由 gateway 同域托管） */
export function openTownSandbox() {
  const path = '/town-sandbox/';
  window.location.assign(path);
}

export const TOWN_SANDBOX_PATH = '/town-sandbox/';
