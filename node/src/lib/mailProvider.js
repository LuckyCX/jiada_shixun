import nodemailer from 'nodemailer';
import { randomUUID } from 'crypto';
import { logError } from './logError.js';
import { getConfigValue } from './systemConfig.js';

/**
 * @typedef {{
 *   id: string;
 *   label: string;
 *   enabled: boolean;
 *   host: string;
 *   port: number;
 *   secure: boolean;
 *   user: string;
 *   pass: string;
 *   from: string;
 * }} SmtpAccount
 */

/**
 * @typedef {{ host: string; port: number; secure: boolean; user: string; pass: string; from: string }} SmtpConfig
 */

function extractEmail(input) {
  const s = String(input || '').trim();
  const m = s.match(/<\s*([^<>@\s]+@[^<>@\s]+)\s*>/);
  if (m?.[1]) return m[1].trim().toLowerCase();
  if (/^[^<>\s@]+@[^<>\s@]+$/.test(s)) return s.toLowerCase();
  return '';
}

function extractDisplayName(input) {
  const s = String(input || '').trim();
  const idx = s.indexOf('<');
  if (idx <= 0) return '';
  return s.slice(0, idx).trim().replace(/^"|"$/g, '');
}

function normalizeFromAddress(cfg) {
  const userEmail = extractEmail(cfg.user);
  const fromEmail = extractEmail(cfg.from);
  if (!userEmail) return cfg.from;
  if (fromEmail && fromEmail === userEmail) return cfg.from;
  const name = extractDisplayName(cfg.from);
  return name ? `"${name}" <${userEmail}>` : userEmail;
}

function parseBool(v, fallback) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(s)) return true;
    if (['0', 'false', 'no', 'off'].includes(s)) return false;
  }
  if (typeof v === 'number') return v !== 0;
  return fallback;
}

function isQqSmtpHost(host) {
  const h = String(host || '').toLowerCase();
  return h.includes('qq.com') || h.includes('foxmail.com');
}

/**
 * 解析单条账号字段（不做完整性校验）
 * @param {unknown} raw
 * @param {string} [fallbackId]
 * @returns {SmtpAccount | null}
 */
function coerceSmtpAccount(raw, fallbackId) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = /** @type {Record<string, unknown>} */ (raw);
  const host = String(obj.host || '').trim();
  const user = String(obj.user || '').trim();
  const pass = String(obj.pass || '').trim();
  const from = String(obj.from || '').trim();
  const portRaw = Number(obj.port);
  const port = Number.isFinite(portRaw) ? Math.floor(portRaw) : 465;
  const secure = parseBool(obj.secure, true);
  const id = String(obj.id || fallbackId || randomUUID()).trim() || randomUUID();
  const label = String(obj.label || user || host || `SMTP-${id.slice(0, 6)}`).trim();
  const enabled = obj.enabled === undefined ? true : parseBool(obj.enabled, true);
  return { id, label, enabled, host, port, secure, user, pass, from };
}

/**
 * 兼容旧版扁平 smtp_config，以及新版 { accounts: [...] }
 * @param {unknown} raw
 * @returns {SmtpAccount[]}
 */
export function parseSmtpAccounts(raw) {
  if (!raw || typeof raw !== 'object') return [];
  const obj = /** @type {Record<string, unknown>} */ (raw);
  if (Array.isArray(obj.accounts)) {
    return obj.accounts
      .map((item, i) => coerceSmtpAccount(item, `smtp-${i + 1}`))
      .filter(Boolean);
  }
  // 旧结构：顶层 host/user/...
  if (obj.host || obj.user || obj.from) {
    const one = coerceSmtpAccount(obj, 'smtp-primary');
    return one ? [one] : [];
  }
  return [];
}

/** 启用且字段齐全的账号（可实际发信） */
export function listReadySmtpAccounts(raw) {
  return parseSmtpAccounts(raw).filter((a) => {
    if (!a.enabled) return false;
    if (!a.host || !a.user || !a.pass || !a.from) return false;
    if (!Number.isFinite(a.port) || a.port <= 0 || a.port > 65535) return false;
    return true;
  });
}

/**
 * @param {unknown} raw
 * @returns {SmtpConfig}
 * @deprecated 请优先用 listReadySmtpAccounts；保留给诊断兼容
 */
export function parseSmtpConfig(raw) {
  const list = listReadySmtpAccounts(raw);
  if (!list.length) {
    throw new Error('SMTP 未配置完整：请在管理后台至少配置一个可用邮箱（Host、端口、用户名、密码与发件人）');
  }
  const a = list[0];
  return { host: a.host, port: a.port, secure: a.secure, user: a.user, pass: a.pass, from: a.from };
}

async function loadSmtpRaw() {
  return getConfigValue('smtp_config', false);
}

/** 与 nanyangAgent 等系统一致：仅 host/port/secure/auth，默认 465 + SSL 便于 QQ 等常见配置 */
function createSmtpTransporter(cfg) {
  const authUser = extractEmail(cfg.user) || String(cfg.user || '').trim();
  const authPass = String(cfg.pass || '').replace(/\s+/g, '');
  let secure = cfg.secure === true;
  // QQ 官方要求第三方客户端启用 SSL/TLS：465 必须走隐式 SSL
  // 参见 https://help.mail.qq.com/detail/108/1010
  if (isQqSmtpHost(cfg.host) && cfg.port === 465) secure = true;
  /** @type {import('nodemailer').TransportOptions} */
  const opts = {
    host: cfg.host,
    port: cfg.port,
    secure,
    auth: { user: authUser, pass: authPass },
  };
  if (!secure && (cfg.port === 587 || cfg.port === 25)) {
    opts.requireTLS = true;
  }
  return nodemailer.createTransport(opts);
}

/**
 * @param {unknown} err
 * @param {{ host?: string }} [ctx]
 */
export function humanizeSmtpError(err, ctx = {}) {
  const any = err && typeof err === 'object' ? err : {};
  const msg = String(any.message || err || '发送失败');
  const responseCode = any.responseCode;
  const host = String(ctx.host || '').toLowerCase();
  const authFail =
    responseCode === 535 ||
    responseCode === 534 ||
    responseCode === 530 ||
    /535|534|authentication failed|invalid login|login fail/i.test(msg);
  if (!authFail) return msg;
  let hint =
    '请确认：已开启邮箱 SMTP、用户名为完整邮箱、密码为「SMTP 授权码」而非网页登录密码、端口与 TLS/SSL 是否与服务商说明一致。';
  if (host.includes('qq.com') || host.includes('foxmail.com')) {
    hint =
      'QQ/Foxmail：请到邮箱设置重新生成「授权码」并粘贴到后台 SMTP 密码后点「保存 SMTP」再测；用户名须为完整邮箱；个人邮箱 Host 用 smtp.qq.com，企业邮箱用 smtp.exmail.qq.com；465+开 TLS 或 587+关 TLS。若提示账号异常/频率受限，需在 QQ 邮箱安全中心处理，并建议配置多个备用发件邮箱做自动切换。详见 https://help.mail.qq.com/detail/108/1023';
  } else if (host.includes('163.com') || host.includes('126.com') || host.includes('yeah.net')) {
    hint =
      '网易邮箱：须在网页版开启 SMTP 并使用「客户端授权密码」（不是登录密码）；Host 填 smtp.163.com / smtp.126.com；推荐端口 465 + 开启 TLS/SSL，用户名为完整邮箱。详见 https://help.mail.163.com/';
  }
  return `${msg} ${hint}`;
}

function throwSmtpError(err, cfg, extraMsg = '') {
  const base = humanizeSmtpError(err, { host: cfg?.host });
  const e = new Error(extraMsg ? `${extraMsg}${base}` : base);
  e.cause = err;
  e.smtp = true;
  e.status = 400;
  e.code = 40002;
  throw e;
}

/**
 * @param {SmtpAccount | SmtpConfig} cfg
 */
export function describeSmtpConfigSafe(cfg) {
  const authUser = extractEmail(cfg.user) || String(cfg.user || '').trim();
  const passLen = String(cfg.pass || '').replace(/\s+/g, '').length;
  const portOk =
    (cfg.port === 465 && cfg.secure === true) || (cfg.port === 587 && cfg.secure === false);
  return {
    id: 'id' in cfg ? cfg.id : undefined,
    label: 'label' in cfg ? cfg.label : undefined,
    enabled: 'enabled' in cfg ? cfg.enabled : true,
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    authUser,
    authUserLooksLikeEmail: Boolean(extractEmail(authUser)),
    passLength: passLen,
    passLooksTooShort: passLen > 0 && passLen < 6,
    portTlsPairLooksOdd: !portOk && (cfg.port === 465 || cfg.port === 587),
    fromNormalized: normalizeFromAddress(cfg),
    isQqPersonal: /smtp\.qq\.com/i.test(cfg.host),
    isQqExmail: /exmail\.qq\.com/i.test(cfg.host),
  };
}

/**
 * @param {string} to
 * @param {{ subject?: string; text?: string; html?: string; accountId?: string }} [opts]
 */
export async function sendSmtpMail(to, opts = {}) {
  const raw = await loadSmtpRaw();
  let accounts = listReadySmtpAccounts(raw);
  if (opts.accountId) {
    accounts = accounts.filter((a) => a.id === opts.accountId);
  }
  if (!accounts.length) {
    const e = new Error(
      opts.accountId
        ? '指定的 SMTP 账号不可用或不存在'
        : 'SMTP 未配置完整：请在管理后台至少配置一个可用邮箱'
    );
    e.smtp = true;
    e.status = 400;
    e.code = 40002;
    throw e;
  }

  const subject = opts.subject || '实训平台 · 邮件通知';
  const text = opts.text || '';
  const html = opts.html || (text ? `<p>${text}</p>` : '');
  /** @type {{ id: string; label: string; error: string }[]} */
  const failures = [];

  for (let i = 0; i < accounts.length; i++) {
    const cfg = accounts[i];
    const fromAddress = normalizeFromAddress(cfg);
    const transporter = createSmtpTransporter(cfg);
    try {
      await transporter.sendMail({
        from: fromAddress,
        to,
        subject,
        text: text || undefined,
        html: html || undefined,
      });
      if (failures.length) {
        logError(
          `mailProvider.sendSmtpMail failover ok account=${cfg.label || cfg.id} after ${failures.length} failure(s)`,
          new Error(failures.map((f) => `${f.label}:${f.error}`).join(' | '))
        );
      }
      return {
        usedAccountId: cfg.id,
        usedAccountLabel: cfg.label || cfg.user,
        attempted: i + 1,
        failedBefore: failures.length,
      };
    } catch (err) {
      const msg = humanizeSmtpError(err, { host: cfg.host });
      failures.push({ id: cfg.id, label: cfg.label || cfg.user || cfg.id, error: msg });
      logError(`mailProvider.sendSmtpMail account=${cfg.id} fail, try next`, err);
      // 立刻切换下一个备用号
    }
  }

  const summary = failures.map((f, idx) => `#${idx + 1} ${f.label}：${f.error}`).join('；');
  const e = new Error(`全部 SMTP 账号发送失败（共 ${failures.length} 个）。${summary}`);
  e.smtp = true;
  e.status = 400;
  e.code = 40002;
  e.smtpFailures = failures;
  throw e;
}

/**
 * @param {string} to
 * @param {{ accountId?: string }} [opts]
 */
export async function sendSmtpTestMail(to, opts = {}) {
  const safeTo = String(to || '').trim();
  if (!safeTo) throw new Error('请填写测试收件人邮箱');
  const raw = await loadSmtpRaw();
  const all = parseSmtpAccounts(raw);
  const ready = listReadySmtpAccounts(raw);
  const targetId = String(opts.accountId || '').trim();
  const toTest = targetId ? ready.filter((a) => a.id === targetId) : ready;
  if (!toTest.length) {
    const e = new Error(
      targetId
        ? '指定账号未启用或配置不完整'
        : '没有可用的 SMTP 账号，请至少完整配置并启用一个'
    );
    e.smtp = true;
    e.status = 400;
    e.code = 40002;
    e.smtpDiag = { accounts: all.map(describeSmtpConfigSafe), readyCount: ready.length };
    throw e;
  }

  // 单账号：先 verify 再发；多账号：直接走 failover 发送
  if (toTest.length === 1 || targetId) {
    const cfg = toTest[0];
    const diag = describeSmtpConfigSafe(cfg);
    try {
      await createSmtpTransporter(cfg).verify();
    } catch (err) {
      logError('mailProvider.sendSmtpTestMail.verify', err);
      const e = new Error(humanizeSmtpError(err, { host: cfg.host }));
      e.cause = err;
      e.smtp = true;
      e.status = 400;
      e.code = 40002;
      e.smtpDiag = diag;
      throw e;
    }
  }

  try {
    const result = await sendSmtpMail(safeTo, {
      accountId: targetId || undefined,
      subject: '实训平台 · SMTP 测试邮件',
      text: '这是一封 SMTP 连通性测试邮件。若收到说明配置可用。',
      html: '<p>这是一封 <b>SMTP 连通性测试</b> 邮件。若收到说明配置可用。</p>',
    });
    return {
      diag: {
        accounts: all.map(describeSmtpConfigSafe),
        readyCount: ready.length,
        usedAccountId: result.usedAccountId,
        usedAccountLabel: result.usedAccountLabel,
        failedBefore: result.failedBefore,
      },
    };
  } catch (err) {
    if (err?.smtp) {
      err.smtpDiag = {
        accounts: all.map(describeSmtpConfigSafe),
        readyCount: ready.length,
        failures: err.smtpFailures || [],
      };
    }
    throw err;
  }
}

/**
 * @param {string} email
 * @param {string} code
 * @param {'login' | 'register' | 'reset'} scene
 */
export async function sendEmailVerifyCode(email, code, scene) {
  const biz = (await getConfigValue('sms_biz_config', false)) || {};
  const expireSec = Number(biz.expireSeconds);
  const minutes = Number.isFinite(expireSec) && expireSec > 0 ? Math.max(1, Math.ceil(expireSec / 60)) : 10;
  const sceneText = scene === 'register' ? '注册验证' : scene === 'reset' ? '重置密码验证' : '登录验证';
  await sendSmtpMail(email, {
    subject: `${sceneText}码`,
    text: `你的验证码是 ${code}，${minutes} 分钟内有效。`,
    html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;">你的验证码是 <b style="font-size:20px;">${code}</b>，${minutes} 分钟内有效。</div>`,
  });
}
