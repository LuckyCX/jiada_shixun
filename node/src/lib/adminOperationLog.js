import { getPool } from './db.js';

export const ADMIN_LOG_MODULES = new Set([
  'admin_college',
  'admin_class',
  'admin_dictionary',
  'admin_system_config',
]);

export function adminLogTypeByModule(module) {
  const m = String(module || '').trim();
  if (m === 'admin_class' || m === 'admin_college') return { type: 'class', typeLabel: '班级管理' };
  if (m === 'admin_dictionary') return { type: 'system', typeLabel: '字典管理' };
  if (m === 'admin_system_config') return { type: 'system', typeLabel: '系统操作' };
  return { type: 'system', typeLabel: '系统操作' };
}

export function adminLogIconByType(type) {
  const t = String(type || '').trim();
  if (t === 'class') return { icon: 'ri-team-line', iconColor: 'text-purple-500', bgColor: 'bg-purple-50' };
  if (t === 'system') return { icon: 'ri-settings-3-line', iconColor: 'text-gray-500', bgColor: 'bg-gray-50' };
  if (t === 'course') return { icon: 'ri-book-2-line', iconColor: 'text-orange-500', bgColor: 'bg-orange-50' };
  return { icon: 'ri-information-line', iconColor: 'text-teal-500', bgColor: 'bg-teal-50' };
}

export function fmtRelativeZh(d) {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  const diff = Date.now() - dt.getTime();
  if (diff < 60 * 1000) return '刚刚';
  const min = Math.floor(diff / (60 * 1000));
  if (min < 60) return `${min}分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}小时前`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}天前`;
  return dt.toISOString().replace('T', ' ').slice(0, 16);
}

export async function insertAdminOperationLog({
  operatorId,
  module,
  action,
  detailText = '',
  detailJson = null,
  targetType = null,
  targetId = null,
}) {
  const opId = Number(operatorId);
  if (!Number.isFinite(opId) || opId <= 0) return;
  const m = String(module || '').trim();
  if (!ADMIN_LOG_MODULES.has(m)) return;
  const a = String(action || '').trim();
  if (!a) return;
  const pool = getPool();
  await pool.query(
    `INSERT INTO operation_logs (operator_id, operator_role, module, action, target_type, target_id, detail)
     VALUES ($1, 'admin', $2, $3, $4, $5, $6::jsonb)`,
    [
      opId,
      m,
      a,
      targetType ? String(targetType) : null,
      targetId != null ? Number(targetId) : null,
      JSON.stringify({
        text: String(detailText || '').trim(),
        ...(detailJson && typeof detailJson === 'object' ? { data: detailJson } : {}),
      }),
    ]
  );
}

