import { Router } from 'express';
import { getAllConfigRaw, maskConfigForAdmin, patchConfig } from '../lib/systemConfig.js';
import { sendSmtpTestMail } from '../lib/mailProvider.js';
import { sendSmsCode } from '../lib/smsProvider.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

/** 公开：仅站点展示用 */
router.get('/public/site', async (req, res) => {
  try {
    const all = await getAllConfigRaw();
    const site = all.site?.value ?? {};
    return res.json({
      code: 0,
      message: 'OK',
      data: site,
      traceId: req.traceId,
    });
  } catch (e) {
    return res.status(500).json({ code: 50000, message: e.message, data: null, traceId: req.traceId });
  }
});

router.get('/admin/system-config', requireAuth(), requireAdmin(), async (req, res) => {
  try {
    const all = await getAllConfigRaw();
    const masked = maskConfigForAdmin(all);
    return res.json({ code: 0, message: 'OK', data: masked, traceId: req.traceId });
  } catch (e) {
    return res.status(500).json({ code: 50000, message: e.message, data: null, traceId: req.traceId });
  }
});

router.patch('/admin/system-config', requireAuth(), requireAdmin(), async (req, res) => {
  try {
    const patches = req.body?.patches;
    if (!patches || typeof patches !== 'object') {
      return res.status(400).json({ code: 40001, message: 'patches 必须为对象', data: null, traceId: req.traceId });
    }
    const userId = Number(req.user.sub);
    await patchConfig(patches, userId);
    const all = await getAllConfigRaw(false);
    const masked = maskConfigForAdmin(all);
    return res.json({ code: 0, message: '已保存', data: masked, traceId: req.traceId });
  } catch (e) {
    return res.status(500).json({ code: 50000, message: e.message, data: null, traceId: req.traceId });
  }
});

/** 发送测试邮件（需完整 SMTP 配置，密码以库内为准） */
router.post('/admin/system-config/test-smtp', requireAuth(), requireAdmin(), async (req, res) => {
  try {
    const to = req.body?.to;
    await sendSmtpTestMail(to);
    return res.json({
      code: 0,
      message: '测试邮件已发送，请检查收件箱或垃圾箱',
      data: null,
      traceId: req.traceId,
    });
  } catch (e) {
    return res.status(400).json({
      code: 40002,
      message: e.message || '发送失败',
      data: null,
      traceId: req.traceId,
    });
  }
});

/**
 * 发送测试短信（调用阿里云真实接口，会产生费用；模板与签名须已在阿里云审核通过）。
 */
router.post('/admin/system-config/test-sms', requireAuth(), requireAdmin(), async (req, res) => {
  try {
    const phone = String(req.body?.phone || '').trim();
    const sceneRaw = String(req.body?.scene || 'login').trim().toLowerCase();
    if (!/^1\d{10}$/.test(phone)) {
      return res.status(400).json({
        code: 40003,
        message: '请输入有效的 11 位中国大陆手机号',
        data: null,
        traceId: req.traceId,
      });
    }
    const scene = sceneRaw === 'register' || sceneRaw === 'reset' ? sceneRaw : 'login';
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await sendSmsCode(phone, code, scene);
    return res.json({
      code: 0,
      message: '测试短信已发送（已计费），请查收手机短信',
      data: null,
      traceId: req.traceId,
    });
  } catch (e) {
    return res.status(400).json({
      code: 40004,
      message: e.message || '发送失败',
      data: null,
      traceId: req.traceId,
    });
  }
});

export default router;
