import React from 'react';

function firstChar(name: string) {
  const s = String(name || '').trim();
  return [...(s || '?')][0] || '?';
}

function colorFromName(name: string) {
  const s = String(name || '').trim() || '?';
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) % 360;
  return `hsl(${h}, 60%, 55%)`;
}

export default function UserAvatar(props: {
  name: string;
  avatarUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const { name, avatarUrl, size = 'md', className = '' } = props;
  const sizeCls = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-12 h-12 text-base' : 'w-10 h-10 text-sm';
  const raw = String(avatarUrl || '').trim();
  const url =
    raw && raw.startsWith('/') && typeof window !== 'undefined'
      ? `${window.location.origin}${raw}`
      : raw;
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className={`rounded-full object-cover ${sizeCls} ${className}`}
      />
    );
  }
  return (
    <div
      className={`rounded-full flex items-center justify-center font-bold text-white ${sizeCls} ${className}`}
      style={{ background: colorFromName(name) }}
      aria-hidden
    >
      {firstChar(name)}
    </div>
  );
}

