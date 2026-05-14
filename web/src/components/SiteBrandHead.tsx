import { useEffect } from 'react';
import { useSiteBrand } from '../lib/publicSite';

const DEFAULT_TITLE = '嘉兴大学创业实训平台 - AI赋能全流程数字化实训体验';

function faviconType(href: string) {
  if (href.startsWith('data:image/png')) return 'image/png';
  if (href.startsWith('data:image/jpeg') || href.startsWith('data:image/jpg')) return 'image/jpeg';
  if (href.startsWith('data:image/svg')) return 'image/svg+xml';
  if (href.endsWith('.svg')) return 'image/svg+xml';
  return 'image/png';
}

/**
 * 根据库内站点配置同步 document.title 与 favicon（需在 Router 内挂载以便 basename 与页面一致）。
 */
export default function SiteBrandHead() {
  const { siteTitle, logoUrl, loading } = useSiteBrand();

  useEffect(() => {
    if (loading) return;
    if (!siteTitle.trim() && !logoUrl) {
      document.title = DEFAULT_TITLE;
      const link = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
      if (link) {
        const base = (import.meta.env.BASE || '/').replace(/\/?$/, '/');
        link.href = `${base}vite.svg`.replace(/\/{2,}/g, '/');
        link.type = 'image/svg+xml';
      }
      return;
    }
    const titleBase = siteTitle.trim() || '嘉兴大学创业实训平台';
    document.title = `${titleBase} - 创业实训平台`;
    const link = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
    if (!link) return;
    if (logoUrl) {
      link.href = logoUrl;
      link.type = faviconType(logoUrl);
    } else {
      const base = (import.meta.env.BASE || '/').replace(/\/?$/, '/');
      link.href = `${base}vite.svg`.replace(/\/{2,}/g, '/');
      link.type = 'image/svg+xml';
    }
  }, [siteTitle, logoUrl, loading]);

  return null;
}
