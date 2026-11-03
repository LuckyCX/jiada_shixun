import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getPool } from '../lib/db.js';
import { getAllConfigRaw, getConfigValue, maskConfigForAdmin, patchConfig } from '../lib/systemConfig.js';
import { logError } from '../lib/logError.js';
import { humanizeSmtpError, sendSmtpTestMail } from '../lib/mailProvider.js';
import { sendSmsCode } from '../lib/smsProvider.js';
import { friendlyLlmErrorMessage, testLlmConnectivity } from '../lib/llmGateway.js';
import { requireAuth, requireAdmin, requireSuperAdmin } from '../middleware/auth.js';
import { insertAdminOperationLog } from '../lib/adminOperationLog.js';
import { validatePasswordStrength } from '../lib/passwordPolicy.js';
import { signAccessToken, signRefreshToken } from '../lib/authTokens.js';

const router = Router();

/** 管理端模型连通性测试共用逻辑（点击按钮才调用） */
async function handleTestLlm(req, res, category) {
  try {
    const providerId = String(req.body?.providerId || '').trim();
    const data = await testLlmConnectivity(category, providerId);
    return res.json({
      code: 0,
      message: `连通成功（${data.providerName} / ${data.modelId}，${data.latencyMs}ms）`,
      data,
      traceId: req.traceId,
    });
  } catch (e) {
    logError(`POST /api/admin/system-config/test-llm-${category} traceId=${req.traceId}`, e);
    return res.status(400).json({
      code: 40005,
      message: friendlyLlmErrorMessage(e),
      data: null,
      traceId: req.traceId,
    });
  }
}

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
    logError(`GET /api/public/site traceId=${req.traceId}`, e);
    return res.status(500).json({ code: 50000, message: e.message, data: null, traceId: req.traceId });
  }
});

router.get('/admin/system-config', requireAuth(), requireAdmin(), async (req, res) => {
  try {
    const all = await getAllConfigRaw();
    const masked = maskConfigForAdmin(all);
    // 子管理员仅可见站点品牌配置
    if (req.user?.role === 'sub_admin') {
      return res.json({
        code: 0,
        message: 'OK',
        data: { site: masked.site },
        traceId: req.traceId,
      });
    }
    return res.json({ code: 0, message: 'OK', data: masked, traceId: req.traceId });
  } catch (e) {
    logError(`GET /api/admin/system-config traceId=${req.traceId}`, e);
    return res.status(500).json({ code: 50000, message: e.message, data: null, traceId: req.traceId });
  }
});

router.patch('/admin/system-config', requireAuth(), requireAdmin(), async (req, res) => {
  try {
    const patches = req.body?.patches;
    if (!patches || typeof patches !== 'object') {
      return res.status(400).json({ code: 40001, message: 'patches 必须为对象', data: null, traceId: req.traceId });
    }
    // 子管理员只允许改站点品牌
    if (req.user?.role === 'sub_admin') {
      const keys = Object.keys(patches);
      if (keys.length !== 1 || keys[0] !== 'site') {
        return res.status(403).json({
          code: 40301,
          message: '子管理员仅可修改站点品牌配置',
          data: null,
          traceId: req.traceId,
        });
      }
    }
    const userId = Number(req.user.sub);
    await patchConfig(patches, userId);
    await insertAdminOperationLog({
      operatorId: userId,
      module: 'admin_system_config',
      action: 'update_system_config',
      detailText: `更新系统配置：${Object.keys(patches).slice(0, 6).join('、')}${Object.keys(patches).length > 6 ? '…' : ''}`,
      detailJson: { keys: Object.keys(patches) },
    });
    const all = await getAllConfigRaw(false);
    const masked = maskConfigForAdmin(all);
    return res.json({ code: 0, message: '已保存', data: masked, traceId: req.traceId });
  } catch (e) {
    logError(`PATCH /api/admin/system-config traceId=${req.traceId}`, e);
    return res.status(500).json({ code: 50000, message: e.message, data: null, traceId: req.traceId });
  }
});

/** 发送测试邮件（需完整 SMTP 配置，密码以库内为准；支持多账号 failover / 指定 accountId） */
router.post('/admin/system-config/test-smtp', requireAuth(), requireAdmin(), async (req, res) => {
  try {
    const to = req.body?.to;
    const accountId = String(req.body?.accountId || '').trim();
    const result = await sendSmtpTestMail(to, accountId ? { accountId } : {});
    const used = result?.diag?.usedAccountLabel || result?.diag?.usedAccountId || '';
    return res.json({
      code: 0,
      message: used ? `测试邮件已发送（经 ${used}），请检查收件箱或垃圾箱` : '测试邮件已发送，请检查收件箱或垃圾箱',
      data: result?.diag || null,
      traceId: req.traceId,
    });
  } catch (e) {
    logError(`POST /api/admin/system-config/test-smtp traceId=${req.traceId}`, e);
    let host = '';
    let diag = e?.smtpDiag || null;
    try {
      const raw = await getConfigValue('smtp_config', false);
      if (raw && typeof raw === 'object') {
        host = String(raw.host || '');
        if (!diag) {
          const { parseSmtpAccounts, describeSmtpConfigSafe, listReadySmtpAccounts } = await import(
            '../lib/mailProvider.js'
          );
          const accounts = parseSmtpAccounts(raw);
          diag = {
            accounts: accounts.map(describeSmtpConfigSafe),
            readyCount: listReadySmtpAccounts(raw).length,
          };
        }
      }
    } catch {
      /* ignore */
    }
    const message = e?.smtp ? String(e.message || '') : humanizeSmtpError(e, { host });
    return res.status(400).json({
      code: 40002,
      message,
      data: diag,
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
    logError(`POST /api/admin/system-config/test-sms traceId=${req.traceId}`, e);
    return res.status(400).json({
      code: 40004,
      message: e.message || '发送失败',
      data: null,
      traceId: req.traceId,
    });
  }
});

/**
 * 多模态模型连通性测试（本系统内部 API；仅点击按钮时由前端调用）。
 * body.providerId 可选：指定配置 id；缺省则测该类型已启用项。
 */
router.post('/admin/system-config/test-llm-multimodal', requireAuth(), requireAdmin(), async (req, res) => {
  return handleTestLlm(req, res, 'multimodal');
});

/**
 * 文件处理模型连通性测试（本系统内部 API；仅点击按钮时由前端调用）。
 */
router.post('/admin/system-config/test-llm-file-processing', requireAuth(), requireAdmin(), async (req, res) => {
  return handleTestLlm(req, res, 'file_processing');
});

/** 当前登录管理端账号资料（含子管理员菜单权限） */
router.get('/admin/me', requireAuth(), requireAdmin(), async (req, res) => {
  try {
    const adminId = Number(req.user?.sub);
    if (!Number.isFinite(adminId) || adminId <= 0) {
      return res.status(400).json({ code: 40001, message: '无效管理员', data: null, traceId: req.traceId });
    }
    const { rows } = await getPool().query(
      `SELECT id, username, real_name AS "realName", role, admin_menu_perms AS "adminMenuPerms"
       FROM users WHERE id = $1 AND role IN ('admin', 'sub_admin')`,
      [adminId]
    );
    if (!rows.length) {
      return res.status(404).json({ code: 40401, message: '账号不存在', data: null, traceId: req.traceId });
    }
    const r = rows[0];
    const perms = Array.isArray(r.adminMenuPerms) ? r.adminMenuPerms.map(String) : [];
    return res.json({
      code: 0,
      message: 'OK',
      data: {
        id: String(r.id),
        username: r.username,
        realName: r.realName || '',
        role: r.role,
        adminMenuPerms: perms,
      },
      traceId: req.traceId,
    });
  } catch (e) {
    logError(`GET /api/admin/me traceId=${req.traceId}`, e);
    return res.status(500).json({ code: 50000, message: e.message, data: null, traceId: req.traceId });
  }
});

const SUB_ADMIN_OPTIONAL_PERMS = new Set(['college-management', 'class-management']);

function normalizeSubAdminPerms(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return [...new Set(list.map(String).filter((x) => SUB_ADMIN_OPTIONAL_PERMS.has(x)))];
}

function mapSubAdminRow(r) {
  const perms = Array.isArray(r.adminMenuPerms) ? r.adminMenuPerms.map(String) : [];
  return {
    id: String(r.id),
    username: r.username,
    realName: r.realName || '',
    role: r.role,
    status: r.status || 'active',
    adminMenuPerms: perms.filter((x) => SUB_ADMIN_OPTIONAL_PERMS.has(x)),
    createdAt: r.createdAt || null,
  };
}

/** 超管：子管理员列表 */
router.get('/admin/sub-admins', requireAuth(), requireSuperAdmin(), async (req, res) => {
  try {
    const { rows } = await getPool().query(
      `SELECT id, username, real_name AS "realName", role, status,
              admin_menu_perms AS "adminMenuPerms", created_at AS "createdAt"
       FROM users
       WHERE role = 'sub_admin'
       ORDER BY id ASC`
    );
    return res.json({
      code: 0,
      message: 'OK',
      data: { list: rows.map(mapSubAdminRow) },
      traceId: req.traceId,
    });
  } catch (e) {
    logError(`GET /api/admin/sub-admins traceId=${req.traceId}`, e);
    return res.status(500).json({ code: 50000, message: e.message, data: null, traceId: req.traceId });
  }
});

/**
 * 超管更新子管理员：菜单权限 / 姓名 / 启停。
 * body: realName?, adminMenuPerms?, status? ('active'|'disabled')
 */
router.patch('/admin/sub-admins/:id', requireAuth(), requireSuperAdmin(), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ code: 40001, message: '无效账号', data: null, traceId: req.traceId });
    }
    const { rows: found } = await getPool().query(
      `SELECT id, username, real_name AS "realName", role, status, admin_menu_perms AS "adminMenuPerms"
       FROM users WHERE id = $1 AND role = 'sub_admin'`,
      [id]
    );
    if (!found.length) {
      return res.status(404).json({ code: 40401, message: '子管理员不存在', data: null, traceId: req.traceId });
    }
    const cur = found[0];
    const realName =
      req.body?.realName !== undefined ? String(req.body.realName || '').trim() : cur.realName || '';
    const adminMenuPerms =
      req.body?.adminMenuPerms !== undefined
        ? normalizeSubAdminPerms(req.body.adminMenuPerms)
        : normalizeSubAdminPerms(cur.adminMenuPerms);
    let status = cur.status || 'active';
    if (req.body?.status !== undefined) {
      const s = String(req.body.status || '').trim();
      if (s !== 'active' && s !== 'disabled') {
        return res.status(400).json({ code: 40002, message: 'status 仅支持 active / disabled', data: null, traceId: req.traceId });
      }
      status = s;
    }
    const { rows } = await getPool().query(
      `UPDATE users
       SET real_name = $1, admin_menu_perms = $2::jsonb, status = $3, updated_at = now()
       WHERE id = $4 AND role = 'sub_admin'
       RETURNING id, username, real_name AS "realName", role, status,
                 admin_menu_perms AS "adminMenuPerms", created_at AS "createdAt"`,
      [realName || null, JSON.stringify(adminMenuPerms), status, id]
    );
    await insertAdminOperationLog({
      operatorId: Number(req.user.sub),
      module: 'sub_admin',
      action: 'update',
      detailText: `更新子管理员 ${cur.username}`,
      detailJson: { id, adminMenuPerms, status, realName },
    });
    return res.json({ code: 0, message: '已更新', data: mapSubAdminRow(rows[0]), traceId: req.traceId });
  } catch (e) {
    logError(`PATCH /api/admin/sub-admins/:id traceId=${req.traceId}`, e);
    return res.status(500).json({ code: 50000, message: e.message, data: null, traceId: req.traceId });
  }
});

/**
 * 超管创建子管理员。
 * body: username, password, realName?, adminMenuPerms?: string[]
 */
router.post('/admin/sub-admins', requireAuth(), requireSuperAdmin(), async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');
    const realName = String(req.body?.realName || '').trim();
    const adminMenuPerms = normalizeSubAdminPerms(req.body?.adminMenuPerms);
    if (!username) {
      return res.status(400).json({ code: 40001, message: '请输入用户名', data: null, traceId: req.traceId });
    }
    const strength = validatePasswordStrength(password);
    if (!strength.ok) {
      return res.status(400).json({ code: 40020, message: strength.message, data: null, traceId: req.traceId });
    }
    const password_hash = await bcrypt.hash(password, 10);
    const { rows } = await getPool().query(
      `INSERT INTO users (username, password_hash, real_name, role, status, admin_menu_perms)
       VALUES ($1, $2, $3, 'sub_admin', 'active', $4::jsonb)
       RETURNING id, username, real_name AS "realName", role, status,
                 admin_menu_perms AS "adminMenuPerms", created_at AS "createdAt"`,
      [username, password_hash, realName || null, JSON.stringify(adminMenuPerms)]
    );
    const r = rows[0];
    await insertAdminOperationLog({
      operatorId: Number(req.user.sub),
      module: 'sub_admin',
      action: 'create',
      detailText: `创建子管理员 ${username}`,
      detailJson: { id: r.id, adminMenuPerms },
    });
    return res.json({
      code: 0,
      message: '已创建子管理员',
      data: mapSubAdminRow(r),
      traceId: req.traceId,
    });
  } catch (e) {
    if (String(e?.code) === '23505') {
      return res.status(400).json({ code: 40009, message: '用户名已存在', data: null, traceId: req.traceId });
    }
    logError(`POST /api/admin/sub-admins traceId=${req.traceId}`, e);
    return res.status(500).json({ code: 50000, message: e.message, data: null, traceId: req.traceId });
  }
});

/**
 * 当前管理员修改自己的登录密码：须校验旧密码，并确认两次新密码一致。
 */
router.post('/admin/me/password', requireAuth(), requireAdmin(), async (req, res) => {
  try {
    const adminId = Number(req.user?.sub);
    if (!Number.isFinite(adminId) || adminId <= 0) {
      return res.status(400).json({ code: 40001, message: '无效管理员', data: null, traceId: req.traceId });
    }
    const oldPassword = String(req.body?.oldPassword || '');
    const newPassword = String(req.body?.newPassword || '');
    const confirmPassword = String(req.body?.confirmPassword ?? req.body?.newPasswordConfirm ?? '');
    if (!oldPassword) {
      return res.status(400).json({ code: 40002, message: '请输入旧密码', data: null, traceId: req.traceId });
    }
    const strength = validatePasswordStrength(newPassword);
    if (!strength.ok) {
      return res.status(400).json({ code: 40020, message: strength.message, data: null, traceId: req.traceId });
    }
    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({ code: 40004, message: '两次输入的新密码不一致', data: null, traceId: req.traceId });
    }
    if (!confirmPassword) {
      return res.status(400).json({ code: 40004, message: '请再次输入新密码', data: null, traceId: req.traceId });
    }
    if (oldPassword === newPassword) {
      return res.status(400).json({ code: 40005, message: '新密码不能与旧密码相同', data: null, traceId: req.traceId });
    }

    const { rows } = await getPool().query(
      `SELECT id, username, role, password_hash FROM users WHERE id = $1 AND role IN ('admin', 'sub_admin')`,
      [adminId]
    );
    if (!rows.length) {
      return res.status(404).json({ code: 40401, message: '管理员不存在', data: null, traceId: req.traceId });
    }
    const okPwd = await bcrypt.compare(oldPassword, rows[0].password_hash);
    if (!okPwd) {
      return res.status(400).json({ code: 40006, message: '旧密码不正确', data: null, traceId: req.traceId });
    }

    const password_hash = await bcrypt.hash(newPassword, 10);
    await getPool().query(
      `UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2 AND role IN ('admin', 'sub_admin')`,
      [password_hash, adminId]
    );
    await insertAdminOperationLog({
      operatorId: adminId,
      module: 'admin_account',
      action: 'change_password',
      detailText: '管理员修改登录密码',
      detailJson: {},
    });
    const fresh = { id: rows[0].id, username: rows[0].username, role: rows[0].role };
    const token = await signAccessToken(fresh, { mustChangePassword: false });
    const refreshToken = await signRefreshToken(fresh, { mustChangePassword: false });
    return res.json({
      code: 0,
      message: '密码已更新',
      data: { saved: true, token, refreshToken, mustChangePassword: false },
      traceId: req.traceId,
    });
  } catch (e) {
    logError(`POST /api/admin/me/password traceId=${req.traceId}`, e);
    return res.status(500).json({ code: 50000, message: e.message || '修改失败', data: null, traceId: req.traceId });
  }
});

export default router;
