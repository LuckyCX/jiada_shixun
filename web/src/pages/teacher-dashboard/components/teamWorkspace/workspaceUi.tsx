import { useState, type ReactNode } from 'react';
import { message } from 'antd';
import { getPortalToken } from '../../../../lib/authApi';

/** 带教师鉴权的附件下载 */
export async function downloadWithAuth(downloadUrl: string, filename: string) {
  const token = getPortalToken('teacher');
  if (!token) {
    message.error('未登录');
    return;
  }
  try {
    const r = await fetch(downloadUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) {
      const j = await r.json().catch(() => null);
      message.error(j?.message || `下载失败（HTTP ${r.status}）`);
      return;
    }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'download';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e: any) {
    message.error(e?.message || '下载失败');
  }
}

/** 紧凑空态：手机端避免高大虚线框占满屏 */
export function EmptyHint({ text = '暂无内容' }: { text?: string }) {
  return (
    <p className="text-xs text-gray-400 leading-relaxed py-0.5">
      {text}
    </p>
  );
}

export function SectionCard({
  title,
  icon,
  children,
  extra,
  empty,
}: {
  title: string;
  icon?: string;
  children?: ReactNode;
  extra?: ReactNode;
  /** 无数据时传文案，卡片收成单行，不占大块空白 */
  empty?: string | false;
}) {
  const isEmpty = typeof empty === 'string';
  return (
    <section
      className={`bg-white rounded-xl md:rounded-2xl border border-gray-100 ${
        isEmpty ? 'px-3 py-2.5 md:px-4 md:py-3' : 'p-3 md:p-5 space-y-2.5 md:space-y-3'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 min-w-0">
          {icon ? <i className={`${icon} text-teal-500 shrink-0`} /> : null}
          <span className="truncate">{title}</span>
        </h3>
        {isEmpty ? (
          <span className="text-xs text-gray-400 shrink-0">{empty}</span>
        ) : (
          extra
        )}
      </div>
      {!isEmpty ? children : null}
    </section>
  );
}

/** 大 JSON / 过程稿默认折叠 */
export function JsonFold({ title, value, defaultOpen = false }: { title: string; value: unknown; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const text =
    value == null
      ? ''
      : typeof value === 'string'
        ? value
        : JSON.stringify(value, null, 2);
  if (!text || text === '{}' || text === '[]') {
    return (
      <div className="text-xs text-gray-400 border border-gray-100 rounded-lg px-3 py-2">
        {title}：空
      </div>
    );
  }
  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 cursor-pointer"
        onClick={() => setOpen((v) => !v)}
      >
        <span>{title}</span>
        <i className={open ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} />
      </button>
      {open ? (
        <pre className="text-[11px] leading-relaxed text-gray-700 p-3 overflow-x-auto max-h-80 whitespace-pre-wrap break-all bg-white">
          {text}
        </pre>
      ) : null}
    </div>
  );
}

export function MemberBlock({
  name,
  role,
  children,
  defaultOpen = false,
}: {
  name: string;
  role?: string;
  children: ReactNode;
  /** 默认折叠，减少手机端纵向空白 */
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-100 rounded-lg md:rounded-xl overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 cursor-pointer"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-sm font-medium text-gray-800 truncate">
          {name}
          {role ? <span className="ml-2 text-xs text-teal-600 font-normal">{role}</span> : null}
        </span>
        <i className={`text-gray-400 shrink-0 ${open ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'}`} />
      </button>
      {open ? <div className="p-2.5 md:p-3 space-y-2">{children}</div> : null}
    </div>
  );
}

export function FieldList({ fields }: { fields: [string, string][] }) {
  return (
    <div className="space-y-2">
      {fields.map(([label, value]) => (
        <div key={label}>
          <div className="text-xs font-semibold text-gray-500">{label}</div>
          <p className="text-sm text-gray-900 mt-0.5 whitespace-pre-wrap break-words">{value?.trim() || '未填写'}</p>
        </div>
      ))}
    </div>
  );
}
