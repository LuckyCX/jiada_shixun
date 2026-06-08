/** PG `date` / ISO 字符串 → YYYY-MM-DD（不用 toISOString，避免 UTC 少一天） */
export function formatCalendarDateFromPg(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'string') {
    const m = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : '';
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    // node-pg 的 date 常为「本地零点」时刻，须用本地年月日，不能用 getUTC*（东八区会少一天）
    const y = value.getFullYear();
    const mo = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${mo}-${d}`;
  }
  return '';
}

/** 界面展示用：固定东八区，避免 Node 运行在 UTC 时与浏览器本地时间差 8 小时 */
export function formatDateTimeZhCN(value) {
  if (value == null || value === '') return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
  });
}

/** 按东八区日历日取 YYYY-MM-DD，用于与环节截止日比较 */
export function instantToChinaCalendarDate(isoOrDate) {
  const t = new Date(isoOrDate).getTime();
  if (Number.isNaN(t)) return '';
  const offsetMs = 8 * 60 * 60 * 1000;
  const c = new Date(t + offsetMs);
  const y = c.getUTCFullYear();
  const mo = String(c.getUTCMonth() + 1).padStart(2, '0');
  const d = String(c.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${d}`;
}
