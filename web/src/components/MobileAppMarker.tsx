import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** 管理端路径不加手机适配标记，避免弹层/表格样式波及后台 */
function isAdminPath(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin-dashboard');
}

/**
 * 给原生表格的单元格补上表头文案，供手机卡片布局用 data-label 展示。
 * 弹层挂在 body 上，标记也必须写在 body，组件内部的 data 属性盖不到 Portal。
 */
function labelStackTables() {
  if (typeof document === 'undefined') return;
  if (!window.matchMedia('(max-width: 767px)').matches) return;
  document.querySelectorAll('table').forEach((table) => {
    const headers = Array.from(table.querySelectorAll('thead th')).map((th) =>
      (th.textContent || '').replace(/\s+/g, ' ').trim()
    );
    if (table.closest('.ant-picker-dropdown, .ant-picker-panel, .ant-cascader-menus')) return;
    if (!headers.length) return;
    table.setAttribute('data-mobile-stack', '1');
    table.querySelectorAll('tbody tr').forEach((tr) => {
      Array.from(tr.children).forEach((cell, index) => {
        if (!(cell instanceof HTMLTableCellElement) || cell.tagName !== 'TD') return;
        const label = headers[index] || '';
        if (label) cell.dataset.label = label;
        else delete cell.dataset.label;
      });
    });
  });
}

export default function MobileAppMarker() {
  const { pathname } = useLocation();
  const admin = isAdminPath(pathname);

  useEffect(() => {
    if (admin) {
      delete document.body.dataset.mobileApp;
      return;
    }
    document.body.dataset.mobileApp = '1';
    labelStackTables();
    let timer = 0;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(labelStackTables, 80);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', schedule);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', schedule);
      window.clearTimeout(timer);
      delete document.body.dataset.mobileApp;
    };
  }, [admin, pathname]);

  return null;
}
