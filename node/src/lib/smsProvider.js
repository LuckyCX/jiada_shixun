import { logError } from './logError.js';
import { getConfigValue } from './systemConfig.js';

function parseJsonObject(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
  return {};
}

/**
 * 与 LearnItEasily 对齐的短信业务配置（发码路由接入后用于限流/开关）。
 */
export async function getSmsBizConfig() {
  const raw = parseJsonObject(await getConfigValue('sms_biz_config', false));
  const expireSeconds = Number(raw.expireSeconds);
  const cooldownSeconds = Number(raw.cooldownSeconds);
  const dailyLimit = Number(raw.dailyLimit);
  return {
    enabled: raw.enabled !== false,
    allowLogin: raw.allowLogin !== false,
    allowRegister: raw.allowRegister !== false,
    allowReset: raw.allowReset !== false,
    expireSeconds: Number.isFinite(expireSeconds) ? Math.max(60, Math.min(1800, Math.floor(expireSeconds))) : 300,
    cooldownSeconds: Number.isFinite(cooldownSeconds) ? Math.max(10, Math.min(300, Math.floor(cooldownSeconds))) : 60,
    dailyLimit: Number.isFinite(dailyLimit) ? Math.max(1, Math.min(100, Math.floor(dailyLimit))) : 20,
  };
}

/**
 * @returns {Promise<{
 *   accessKeyId: string;
 *   accessKeySecret: string;
 *   signName: string;
 *   templateLogin: string;
 *   templateRegister: string;
 *   templateReset: string;
 *   templateCode: string;
 *   regionId: string;
 *   endpoint: string;
 * }>}
 */
export async function getAliyunSmsConfig() {
  const cfg = parseJsonObject(await getConfigValue('aliyun_sms_config', false));
  return {
    accessKeyId: String(cfg.accessKeyId || '').trim(),
    accessKeySecret: String(cfg.accessKeySecret || '').trim(),
    signName: String(cfg.signName || '').trim(),
    templateLogin: String(cfg.templateLogin || '').trim(),
    templateRegister: String(cfg.templateRegister || '').trim(),
    templateReset: String(cfg.templateReset || '').trim(),
    templateCode: String(cfg.templateCode || '').trim(),
    regionId: String(cfg.regionId || 'cn-hangzhou').trim() || 'cn-hangzhou',
    endpoint: String(cfg.endpoint || 'dysmsapi.aliyuncs.com').trim() || 'dysmsapi.aliyuncs.com',
  };
}

/**
 * @param {Awaited<ReturnType<typeof getAliyunSmsConfig>>} smsCfg
 * @param {'login' | 'register' | 'reset'} scene
 */
export function resolveTemplateCode(smsCfg, scene) {
  const legacy = smsCfg.templateCode;
  if (scene === 'login') return smsCfg.templateLogin || legacy || '';
  if (scene === 'register') return smsCfg.templateRegister || legacy || '';
  return smsCfg.templateReset || smsCfg.templateLogin || legacy || '';
}

/**
 * @param {string} phone
 * @param {string} code
 * @param {'login' | 'register' | 'reset'} scene
 */
export async function sendSmsCode(phone, code, scene) {
  const smsCfg = await getAliyunSmsConfig();
  if (!smsCfg.accessKeyId || !smsCfg.accessKeySecret || !smsCfg.signName) {
    throw new Error('短信服务配置不完整：请填写阿里云 AccessKey、Secret 与签名');
  }
  const templateCode = resolveTemplateCode(smsCfg, scene);
  if (!templateCode) {
    throw new Error('短信模板未配置：请填写对应场景的模板 CODE（或旧版 templateCode）');
  }

  const dysms = await import('@alicloud/dysmsapi20170525');
  /** Node ESM 加载 CJS 包时 default 常为 { default: Client }，需取 default.default */
  const Client = dysms.default?.default ?? dysms.default;
  if (typeof Client !== 'function') {
    throw new Error('阿里云 SMS SDK 加载异常：未找到 Client 构造器，请检查 @alicloud/dysmsapi20170525 版本');
  }
  const { SendSmsRequest } = dysms;
  const client = new Client({
    accessKeyId: smsCfg.accessKeyId,
    accessKeySecret: smsCfg.accessKeySecret,
    endpoint: smsCfg.endpoint,
    regionId: smsCfg.regionId,
  });
  const request = new SendSmsRequest({
    phoneNumbers: phone,
    signName: smsCfg.signName,
    templateCode,
    templateParam: JSON.stringify({ code }),
  });
  try {
    const resp = await client.sendSms(request);
    const body = resp?.body || resp;
    const resultCode = String(body?.code || '');
    if (resultCode !== 'OK') {
      const message = String(body?.message || '未知错误');
      throw new Error(`短信发送失败：${message}`);
    }
  } catch (err) {
    logError('smsProvider.sendSmsCode', err);
    throw err;
  }
}
