import { Router } from 'express';
import { getAllConfigRaw, maskConfigForAdmin, patchConfig } from '../lib/systemConfig.js';
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

export default router;
