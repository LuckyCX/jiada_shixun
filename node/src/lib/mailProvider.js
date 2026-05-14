import nodemailer from 'nodemailer';
import { logError } from './logError.js';
import { getConfigValue } from './systemConfig.js';

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

/**
 * @param {unknown} raw
 * @returns {SmtpConfig}
 */
export function parseSmtpConfig(raw) {
  const obj = raw && typeof raw === 'object' ? raw : {};
  const host = String(obj.host || '').trim();
  const user = String(obj.user || '').trim();
  const pass = String(obj.pass || '').trim();
  const from = String(obj.from || '').trim();
  const portRaw = Number(obj.port);
  const port = Number.isFinite(portRaw) ? Math.floor(portRaw) : 465;
  const secure = parseBool(obj.secure, true);
  if (!host || !user || !pass || !from || !Number.isFinite(port) || port <= 0 || port > 65535) {
    throw new Error('SMTP 未配置完整：请在管理后台填写 Host、端口、用户名、密码与发件人');
  }
  return { host, user, pass, from, port, secure };
}

async function getSmtpConfig() {
  const raw = await getConfigValue('smtp_config', false);
  return parseSmtpConfig(raw);
}

/** 与 nanyangAgent 等系统一致：仅 host/port/secure/auth，默认 465 + SSL 便于 QQ 等常见配置 */
function createSmtpTransporter(cfg) {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });
}

/**
 * 将 nodemailer 错误转为前端可展示的说明（认证失败时附加常见排查项）。
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
      'QQ / Foxmail：设置中开启 SMTP；密码填「授权码」；465 端口通常开启 TLS/SSL，587 通常关闭 TLS/SSL。详见 https://help.mail.qq.com/detail/108/1023';
  }
  return `${msg} ${hint}`;
}

/**
 * @param {string} to
 * @param {{ subject?: string; text?: string; html?: string }} [opts]
 */
export async function sendSmtpMail(to, opts = {}) {
  const cfg = await getSmtpConfig();
  const fromAddress = normalizeFromAddress(cfg);
  const transporter = createSmtpTransporter(cfg);
  const subject = opts.subject || '实训平台 · 邮件通知';
  const text = opts.text || '';
  const html = opts.html || (text ? `<p>${text}</p>` : '');
  try {
    await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      text: text || undefined,
      html: html || undefined,
    });
  } catch (err) {
    logError('mailProvider.sendSmtpMail', err);
    throw err;
  }
}

/**
 * @param {string} to
 */
export async function sendSmtpTestMail(to) {
  const safeTo = String(to || '').trim();
  if (!safeTo) throw new Error('请填写测试收件人邮箱');
  await sendSmtpMail(safeTo, {
    subject: '实训平台 · SMTP 测试邮件',
    text: '这是一封 SMTP 连通性测试邮件。若收到说明配置可用。',
    html: '<p>这是一封 <b>SMTP 连通性测试</b> 邮件。若收到说明配置可用。</p>',
  });
}

/**
 * @param {string} email
 * @param {string} code
 * @param {'login' | 'register' | 'reset'} scene
 */
export async function sendEmailVerifyCode(email, code, scene) {
  const cfg = await getSmtpConfig();
  const fromAddress = normalizeFromAddress(cfg);
  const transporter = createSmtpTransporter(cfg);
  const biz = (await getConfigValue('sms_biz_config', false)) || {};
  const expireSec = Number(biz.expireSeconds);
  const minutes = Number.isFinite(expireSec) && expireSec > 0 ? Math.max(1, Math.ceil(expireSec / 60)) : 10;
  const sceneText = scene === 'register' ? '注册验证' : scene === 'reset' ? '重置密码验证' : '登录验证';
  try {
    await transporter.sendMail({
      from: fromAddress,
      to: email,
      subject: `${sceneText}码`,
      text: `你的验证码是 ${code}，${minutes} 分钟内有效。`,
      html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;">你的验证码是 <b style="font-size:20px;">${code}</b>，${minutes} 分钟内有效。</div>`,
    });
  } catch (err) {
    logError('mailProvider.sendEmailVerifyCode', err);
    throw err;
  }
}
