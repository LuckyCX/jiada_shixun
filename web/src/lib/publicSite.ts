import { useCallback, useEffect, useState } from 'react';

export type PublicSite = {
  siteTitle: string;
  logoUrl: string;
  /** 对外访问根地址，用于问卷外链等（如 https://train.example.com） */
  publicBaseUrl: string;
};

const empty: PublicSite = { siteTitle: '', logoUrl: '', publicBaseUrl: '' };

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
