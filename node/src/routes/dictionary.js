import { Router } from 'express';
import { getPool } from '../lib/db.js';
import { logError } from '../lib/logError.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

const CODE_RE = /^[a-z][a-z0-9_]*$/;

function ok(req, res, data, message = 'OK') {
  return res.json({ code: 0, message, data, traceId: req.traceId });
}

function bad(req, res, status, code, message) {
  return res.status(status).json({ code, message, data: null, traceId: req.traceId });
}

/** 公开：启用类型下启用项，供下拉等 */
router.get('/public/dict-items', async (req, res) => {
  try {
    const typeCode = String(req.query.typeCode || '').trim();
    if (!typeCode) {
      return bad(req, res, 400, 40001, '缺少 typeCode');
    }
    const { rows } = await getPool().query(
      `SELECT di.id, di.data_key AS "dataKey", di.name
       FROM dict_item di
       JOIN dict_type dt ON dt.id = di.dict_type_id
       WHERE dt.code = $1 AND dt.status = 1 AND di.status = 1
       ORDER BY di.sort_order ASC, di.id ASC`,
      [typeCode]
    );
    return ok(req, res, rows);
  } catch (e) {
    logError(`GET /api/public/dict-items traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.get('/admin/dict-types/:id', requireAuth(), requireAdmin(), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return bad(req, res, 400, 40001, '无效 id');
    const { rows } = await getPool().query(
      `SELECT id, name, code, status, remark, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM dict_type WHERE id = $1`,
      [id]
    );
    if (!rows.length) return bad(req, res, 404, 40401, '字典类型不存在');
    return ok(req, res, rows[0]);
  } catch (e) {
    logError(`GET /api/admin/dict-types/:id traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.get('/admin/dict-types', requireAuth(), requireAdmin(), async (req, res) => {
  try {
    const name = String(req.query.name || '').trim();
    const code = String(req.query.code || '').trim();
    const statusQ = req.query.status;
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize || '10'), 10) || 10));
    const offset = (page - 1) * pageSize;

    const cond = [];
    const params = [];
    let i = 1;
    if (name) {
      cond.push(`name ILIKE $${i++}`);
      params.push(`%${name}%`);
    }
    if (code) {
      cond.push(`code ILIKE $${i++}`);
      params.push(`%${code}%`);
    }
    if (statusQ !== undefined && statusQ !== '' && statusQ !== 'all') {
      cond.push(`status = $${i++}`);
      params.push(Number(statusQ));
    }
    cond.push(`code <> 'college'`);
    const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';

    const countR = await getPool().query(`SELECT COUNT(*)::int AS c FROM dict_type ${where}`, params);
    const total = countR.rows[0]?.c ?? 0;

    params.push(pageSize, offset);
    const { rows } = await getPool().query(
      `SELECT id, name, code, status, remark, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM dict_type ${where}
       ORDER BY id DESC
       LIMIT $${i} OFFSET $${i + 1}`,
      params
    );
    return ok(req, res, { list: rows, total, page, pageSize });
  } catch (e) {
    logError(`GET /api/admin/dict-types traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.post('/admin/dict-types', requireAuth(), requireAdmin(), async (req, res) => {
  try {
    const { name, code, status = 1, remark = null } = req.body || {};
    const n = String(name || '').trim();
    const c = String(code || '').trim();
    if (c === 'college') return bad(req, res, 400, 40003, '学院请在「学院管理」中维护，勿使用字典 code=college');
    if (!n) return bad(req, res, 400, 40001, '字典名称必填');
    if (!c || !CODE_RE.test(c)) return bad(req, res, 400, 40002, '字典 value（code）须为小写字母开头，仅含小写字母、数字、下划线');
    const st = Number(status) === 0 ? 0 : 1;
    const { rows } = await getPool().query(
      `INSERT INTO dict_type (name, code, status, remark) VALUES ($1, $2, $3, $4)
       RETURNING id, name, code, status, remark, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [n, c, st, remark ? String(remark) : null]
    );
    return ok(req, res, rows[0], '已创建');
  } catch (e) {
    if (e.code === '23505') return bad(req, res, 409, 40901, 'code 已存在');
    logError(`POST /api/admin/dict-types traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.patch('/admin/dict-types/:id', requireAuth(), requireAdmin(), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return bad(req, res, 400, 40001, '无效 id');
    const body = req.body || {};
    const fields = [];
    const params = [];
    let i = 1;
    if (body.name !== undefined) {
      const n = String(body.name || '').trim();
      if (!n) return bad(req, res, 400, 40001, '字典名称不能为空');
      fields.push(`name = $${i++}`);
      params.push(n);
    }
    if (body.code !== undefined) {
      const c = String(body.code || '').trim();
      if (!c || !CODE_RE.test(c)) return bad(req, res, 400, 40002, 'code 格式不合法');
      if (c === 'college') return bad(req, res, 400, 40003, '学院请在「学院管理」中维护，勿使用字典 code=college');
      fields.push(`code = $${i++}`);
      params.push(c);
    }
    if (body.status !== undefined) {
      fields.push(`status = $${i++}`);
      params.push(Number(body.status) === 0 ? 0 : 1);
    }
    if (body.remark !== undefined) {
      fields.push(`remark = $${i++}`);
      params.push(body.remark == null ? null : String(body.remark));
    }
    if (!fields.length) return bad(req, res, 400, 40001, '无更新字段');
    params.push(id);
    const { rows } = await getPool().query(
      `UPDATE dict_type SET ${fields.join(', ')} WHERE id = $${i}
       RETURNING id, name, code, status, remark, created_at AS "createdAt", updated_at AS "updatedAt"`,
      params
    );
    if (!rows.length) return bad(req, res, 404, 40401, '字典类型不存在');
    return ok(req, res, rows[0], '已保存');
  } catch (e) {
    if (e.code === '23505') return bad(req, res, 409, 40901, 'code 已存在');
    logError(`PATCH /api/admin/dict-types/:id traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.delete('/admin/dict-types/:id', requireAuth(), requireAdmin(), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return bad(req, res, 400, 40001, '无效 id');
    const cnt = await getPool().query('SELECT COUNT(*)::int AS c FROM dict_item WHERE dict_type_id = $1', [id]);
    if ((cnt.rows[0]?.c ?? 0) > 0) {
      return bad(req, res, 400, 40003, '存在字典数据项，请先在「数据管理」中删除子项后再删除类型');
    }
    const r = await getPool().query('DELETE FROM dict_type WHERE id = $1 RETURNING id', [id]);
    if (!r.rowCount) return bad(req, res, 404, 40401, '字典类型不存在');
    return ok(req, res, { id }, '已删除');
  } catch (e) {
    logError(`DELETE /api/admin/dict-types/:id traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.get('/admin/dict-types/:typeId/items', requireAuth(), requireAdmin(), async (req, res) => {
  try {
    const typeId = Number(req.params.typeId);
    if (!Number.isFinite(typeId) || typeId <= 0) return bad(req, res, 400, 40001, '无效 typeId');
    const name = String(req.query.name || '').trim();
    const statusQ = req.query.status;
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize || '10'), 10) || 10));
    const offset = (page - 1) * pageSize;

    const cond = ['dict_type_id = $1'];
    const params = [typeId];
    let i = 2;
    if (name) {
      cond.push(`name ILIKE $${i++}`);
      params.push(`%${name}%`);
    }
    if (statusQ !== undefined && statusQ !== '' && statusQ !== 'all') {
      cond.push(`status = $${i++}`);
      params.push(Number(statusQ));
    }
    const where = `WHERE ${cond.join(' AND ')}`;

    const countR = await getPool().query(`SELECT COUNT(*)::int AS c FROM dict_item ${where}`, params);
    const total = countR.rows[0]?.c ?? 0;
    params.push(pageSize, offset);
    const { rows } = await getPool().query(
      `SELECT id, dict_type_id AS "dictTypeId", name, data_key AS "dataKey", sort_order AS "sortOrder",
              status, remark, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM dict_item ${where}
       ORDER BY sort_order ASC, id ASC
       LIMIT $${i} OFFSET $${i + 1}`,
      params
    );
    return ok(req, res, { list: rows, total, page, pageSize });
  } catch (e) {
    logError(`GET /api/admin/dict-types/:typeId/items traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.post('/admin/dict-types/:typeId/items', requireAuth(), requireAdmin(), async (req, res) => {
  try {
    const typeId = Number(req.params.typeId);
    if (!Number.isFinite(typeId) || typeId <= 0) return bad(req, res, 400, 40001, '无效 typeId');
    const { name, dataKey, sortOrder = 0, status = 1, remark = null } = req.body || {};
    const n = String(name || '').trim();
    const dk = Math.floor(Number(dataKey));
    if (!n) return bad(req, res, 400, 40001, '字典名称必填');
    if (!Number.isFinite(dk)) return bad(req, res, 400, 40002, '数据键值 dataKey 须为整数');
    const st = Number(status) === 0 ? 0 : 1;
    const so = Math.floor(Number(sortOrder)) || 0;
    const { rows } = await getPool().query(
      `INSERT INTO dict_item (dict_type_id, name, data_key, sort_order, status, remark)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, dict_type_id AS "dictTypeId", name, data_key AS "dataKey", sort_order AS "sortOrder",
                 status, remark, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [typeId, n, dk, so, st, remark ? String(remark) : null]
    );
    return ok(req, res, rows[0], '已创建');
  } catch (e) {
    if (e.code === '23505') return bad(req, res, 409, 40901, '该类型下 data_key 已存在');
    if (e.code === '23503') return bad(req, res, 400, 40004, '字典类型不存在');
    logError(`POST /api/admin/dict-types/:typeId/items traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.patch('/admin/dict-items/:id', requireAuth(), requireAdmin(), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return bad(req, res, 400, 40001, '无效 id');
    const body = req.body || {};
    const fields = [];
    const params = [];
    let i = 1;
    if (body.name !== undefined) {
      const n = String(body.name || '').trim();
      if (!n) return bad(req, res, 400, 40001, '字典名称不能为空');
      fields.push(`name = $${i++}`);
      params.push(n);
    }
    if (body.dataKey !== undefined) {
      const dk = Math.floor(Number(body.dataKey));
      if (!Number.isFinite(dk)) return bad(req, res, 400, 40002, 'dataKey 须为整数');
      fields.push(`data_key = $${i++}`);
      params.push(dk);
    }
    if (body.sortOrder !== undefined) {
      fields.push(`sort_order = $${i++}`);
      params.push(Math.floor(Number(body.sortOrder)) || 0);
    }
    if (body.status !== undefined) {
      fields.push(`status = $${i++}`);
      params.push(Number(body.status) === 0 ? 0 : 1);
    }
    if (body.remark !== undefined) {
      fields.push(`remark = $${i++}`);
      params.push(body.remark == null ? null : String(body.remark));
    }
    if (!fields.length) return bad(req, res, 400, 40001, '无更新字段');
    params.push(id);
    const { rows } = await getPool().query(
      `UPDATE dict_item SET ${fields.join(', ')} WHERE id = $${i}
       RETURNING id, dict_type_id AS "dictTypeId", name, data_key AS "dataKey", sort_order AS "sortOrder",
                 status, remark, created_at AS "createdAt", updated_at AS "updatedAt"`,
      params
    );
    if (!rows.length) return bad(req, res, 404, 40401, '字典项不存在');
    return ok(req, res, rows[0], '已保存');
  } catch (e) {
    if (e.code === '23505') return bad(req, res, 409, 40901, '该类型下 data_key 已存在');
    logError(`PATCH /api/admin/dict-items/:id traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

router.delete('/admin/dict-items/:id', requireAuth(), requireAdmin(), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return bad(req, res, 400, 40001, '无效 id');
    const r = await getPool().query('DELETE FROM dict_item WHERE id = $1 RETURNING id', [id]);
    if (!r.rowCount) return bad(req, res, 404, 40401, '字典项不存在');
    return ok(req, res, { id }, '已删除');
  } catch (e) {
    logError(`DELETE /api/admin/dict-items/:id traceId=${req.traceId}`, e);
    return bad(req, res, 500, 50000, e.message);
  }
});

export default router;
