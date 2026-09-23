/**
 * 口令强度：≥8，至少 1 大写、1 小写、1 数字（不要求特殊字符）
 * 前后端共用同一套规则文案。
 */

export const PASSWORD_POLICY_HINT =
  '密码至少 8 位，须同时包含大写字母、小写字母和数字';

/**
 * @param {unknown} password
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function validatePasswordStrength(password) {
  const s = password == null ? '' : String(password);
  if (s.length < 8) {
    return { ok: false, message: PASSWORD_POLICY_HINT };
  }
  if (!/[A-Z]/.test(s) || !/[a-z]/.test(s) || !/[0-9]/.test(s)) {
    return { ok: false, message: PASSWORD_POLICY_HINT };
  }
  return { ok: true };
}

/**
 * 不满足强度时抛出 Error（message 可直接给前端）
 * @param {unknown} password
 */
export function assertPasswordStrength(password) {
  const r = validatePasswordStrength(password);
  if (!r.ok) {
    const e = new Error(r.message);
    e.code = 40020;
    throw e;
  }
}
