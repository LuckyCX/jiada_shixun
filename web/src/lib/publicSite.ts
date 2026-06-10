import { useCallback, useEffect, useState } from 'react';

/** 管理端「恢复默认」与占位提示共用 */
export const SITE_HERO_DEFAULTS = {
  heroTitle: '大学生创业实训平台',
  heroSubtitle: '个性化教学班 · 实践课程 · 七阶段团队实训',
  heroDescription: '面向高校创新创业实践教学，融通课程学习、团队协作实训与教师全过程指导评价',
} as const;

export type PublicSite = {
  siteTitle: string;
  logoUrl: string;
  /** 对外访问根地址，用于问卷外链等（如 https://train.example.com） */
  publicBaseUrl: string;
  /** 首页 Hero 背景图（data URL 或 https 地址）；空则用内置默认图 */
  heroBackgroundUrl: string;
  /** 首页 Hero 主标题（与导航站点标题独立；留空则不展示） */
  heroTitle: string;
  heroSubtitle: string;
  heroDescription: string;
};

const empty: PublicSite = {
  siteTitle: '',
  logoUrl: '',
  publicBaseUrl: '',
  heroBackgroundUrl: '',
  heroTitle: '',
  heroSubtitle: '',
  heroDescription: '',
};

let cache: PublicSite | null = null;
let inflight: Promise<PublicSite> | null = null;

export const SITE_BRAND_UPDATED_EVENT = 'jiada-site-brand-updated';

export function invalidatePublicSiteCache() {
  cache = null;
}

export function notifySiteBrandUpdated() {
  invalidatePublicSiteCache();
  window.dispatchEvent(new CustomEvent(SITE_BRAND_UPDATED_EVENT));
}

function publicSiteUrl() {
  const base = (import.meta.env.BASE || '/').replace(/\/?$/, '/');
  return `${base}api/public/site`.replace(/\/{2,}/g, '/');
}

export async function fetchPublicSite(force = false): Promise<PublicSite> {
  if (!force && cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    const r = await fetch(publicSiteUrl());
    const j = await r.json().catch(() => ({ code: -1 }));
    if (!r.ok || j.code !== 0) {
      cache = { ...empty };
      return cache;
    }
    const d = j.data || {};
    cache = {
      siteTitle: String(d.siteTitle ?? '').trim(),
      logoUrl: String(d.logoUrl ?? '').trim(),
      publicBaseUrl: String(d.publicBaseUrl ?? '').trim().replace(/\/$/, ''),
      heroBackgroundUrl: String(d.heroBackgroundUrl ?? '').trim(),
      heroTitle: String(d.heroTitle ?? '').trim(),
      heroSubtitle: String(d.heroSubtitle ?? '').trim(),
      heroDescription: String(d.heroDescription ?? '').trim(),
    };
    return cache;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export function useSiteBrand() {
  const [state, setState] = useState<PublicSite & { loading: boolean }>({ ...empty, loading: true });

  const load = useCallback((force: boolean) => {
    fetchPublicSite(force).then((s) => {
      setState({ ...s, loading: false });
    });
  }, []);

  useEffect(() => {
    load(false);
    const onUpdate = () => load(true);
    window.addEventListener(SITE_BRAND_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(SITE_BRAND_UPDATED_EVENT, onUpdate);
  }, [load]);

  const refresh = useCallback(() => {
    load(true);
  }, [load]);

  return { ...state, refresh };
}
