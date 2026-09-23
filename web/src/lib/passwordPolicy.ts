/** 与后端 passwordPolicy 一致：≥8，大写+小写+数字 */

export const PASSWORD_POLICY_HINT = '密码至少 8 位，须同时包含大写字母、小写字母和数字';

export function validatePasswordStrength(password: unknown): { ok: true } | { ok: false; message: string } {
  const s = password == null ? '' : String(password);
  if (s.length < 8) return { ok: false, message: PASSWORD_POLICY_HINT };
  if (!/[A-Z]/.test(s) || !/[a-z]/.test(s) || !/[0-9]/.test(s)) {
    return { ok: false, message: PASSWORD_POLICY_HINT };
  }
  return { ok: true };
}
