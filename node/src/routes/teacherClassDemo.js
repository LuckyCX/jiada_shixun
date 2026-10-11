/**
 * 教师教学演示接口。
 * 只给当前教师的班级做两件事：调用模型并返回文本、把文件存到演示目录。
 * 不写入团队、选题、问卷、计划书等学生业务表。
 */
import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { getPool } from '../lib/db.js';
import { logError } from '../lib/logError.js';
import { chatCompletion, getEnabledProvider } from '../lib/llmGateway.js';
import {
  WAR_ROOM_ROUND_SYSTEM_PROMPT,
  WAR_ROOM_SINGLE_REPLY_SYSTEM_PROMPT,
} from '../lib/businessModelWarRoomPrompts.js';
import {
  HAT_STUDIO_ROUND_SYSTEM_PROMPT,
  HAT_STUDIO_SINGLE_REPLY_SYSTEM_PROMPT,
} from '../lib/ideationHatStudioPrompts.js';
import {
  getMidwiferyGeneratePrompt,
  getMidwiferyTurnPrompt,
} from '../lib/ideationMidwiferyPrompts.js';
import { PRODUCT_DESIGN_SUGGESTION_JSON_SCHEMA } from '../lib/productDesignPrompts.js';
import { normalizeUploadFileName } from '../lib/uploadFileName.js';
import { requireAdmin, requireAuth, requireTeacher } from '../middleware/auth.js';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEMO_UPLOAD_ROOT = path.join(__dirname, '../../uploads/class-demo');
const ALLOWED_EXT = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.zip', '.txt', '.mp4', '.webm', '.mov']);

/** 进卡片/字段的场景禁止 Markdown，避免演示页露出 ** / ### */
const NO_MD = '不要使用 Markdown 符号（不要 **、###、---），用纯中文短句。';

const SCENES = {
  team: '根据能力测评回答，用中文写一段组队分析，并给出建议角色。只返回 JSON：summary、role（ceo/product_rd/market_director/marketing_ops/sales/finance 之一）、roleLabel、strategic、market、techRisk（0-100 的数字）。',
  ideation: `根据教师给出的课堂创意笔记，用中文写出 2～3 条可讲解的创业点子，每条包含名称、一句话描述、新颖性和可行性。${NO_MD}`,
  'market-persona': '根据调研笔记，用中文输出 2 个用户画像。只返回 JSON 数组，元素字段为 name、age、occupation、major、painPoints、needs、habits，值都是中文短句。',
  'market-challenge': `扮演挑剔的评审，用中文指出这份调研的 3 个漏洞，并各给一条改法。${NO_MD}`,
  'market-analysis': `用中文写一份简短调研结论，分「需求判断」「竞品差异」「建议动作」三节，不要英文键名。${NO_MD}`,
  product: `只返回可直接渲染的产品设计建议 JSON，不要其它说明。Schema：${PRODUCT_DESIGN_SUGGESTION_JSON_SCHEMA}`,
  business: `根据已有商业模式笔记，用中文补全或点评，分节输出，不要英文键名。${NO_MD}`,
  /** 演示虚拟董事会：整轮六帽 / 单帽 @ 回复，人设与学生端同一套提示 */
  'war-room-round': `${WAR_ROOM_ROUND_SYSTEM_PROMPT}\n（课堂演示：结果只显示在当前页，勿声称已写入学生档案。）`,
  'war-room-reply': `${WAR_ROOM_SINGLE_REPLY_SYSTEM_PROMPT}\n（课堂演示：必须严格按用户给出的【你的角色】人设回复，禁止串戏。）`,
  /** 演示六帽创想室：整轮 / 单帽 */
  'hat-studio-round': `${HAT_STUDIO_ROUND_SYSTEM_PROMPT}\n（课堂演示：结果只显示在当前页，勿声称已写入学生档案。）`,
  'hat-studio-reply': `${HAT_STUDIO_SINGLE_REPLY_SYSTEM_PROMPT}\n（课堂演示：必须严格按用户给出的【你的角色】人设回复，禁止串戏。）`,
  /** 演示思辨助产：与学生端同源提示词 */
  'ideation-midwifery-turn': `${getMidwiferyTurnPrompt()}\n（课堂演示：结果只显示在当前页，勿声称已写入学生档案。）`,
  'ideation-midwifery-generate': `${getMidwiferyGeneratePrompt()}\n（课堂演示：结果只显示在当前页，勿声称已写入学生档案。）`,
  /** 头脑风暴 / AI 创意对话生成结构化创意 JSON */
  'ideation-chat-generate': `根据课堂对话笔记生成一条可讲解的创业创意。只返回 JSON，键齐全：title、description、projectDirection、coreValue、targetUsers、coreProblem、solutionOverview、marketSize、competitiveAdvantage、overallScore(0-100)、novelty、feasibility、marketPotential、innovation(0-5)、summary、strengths/weaknesses/suggestions/tags（各恰好 3 项字符串）。${NO_MD}`,
  // 与学生端一致：逐行 NDJSON；须有峰谷/失败可能，禁止一路上涨
  simulation: `你是课堂仿真引擎。按「逐行 JSON / NDJSON」输出共 15 行：day=1..14 各一行，最后一行 type=final。
每行必须是可独立 JSON.parse 的单行对象，禁止把一个对象拆成多行，禁止 Markdown。
day 行：{"type":"day","day":1,"users":0,"revenue":0,"cac":0,"ltv":0,"profit":0,"notes":"当日中文简述（含波动原因）"}
final 行：{"type":"final","optimize":{"suggestions":[{"title":"课堂建议","desc":"可执行建议","impact":"预期影响"}],"comparison":{"current":{"summary":"当前路径问题"},"optimized":{"summary":"优化后预期"}}}}
结合投入配置与用户消息中的「本轮主基调」做推演：成功/失败都合理。
users、revenue 均为累计值（大体不减），用平台期（连续多日持平）表达淡季；禁止写成当日流水导致 0/高/0/高。
至少 4 天 profit 为负；悲观剧本禁止第 14 天强行翻盘。${NO_MD}`,
  'plan-comment': `用中文给这份商业计划书要点写一段课堂点评，并给出 0～100 的建议分，格式为「建议分：N」开头。${NO_MD}`,
};

const JSON_MODE_SCENES = new Set([
  // simulation 改为 NDJSON 多行，不能开 json_object 模式
  'market-persona',
  'team',
  'product',
  'war-room-round',
  'war-room-reply',
  'hat-studio-round',
  'hat-studio-reply',
  'ideation-midwifery-turn',
  'ideation-midwifery-generate',
  'ideation-chat-generate',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

function ok(req, res, data, message = 'OK') {
  return res.json({ code: 0, message, data, traceId: req.traceId });
}

function bad(req, res, status, code, message) {
  return res.status(status).json({ code, message, data: null, traceId: req.traceId });
}

function parseId(val) {
  const id = Number(String(val || '').trim());
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function ownsPersonalClass(teacherId, classId) {
  const { rows } = await getPool().query(
    `SELECT id FROM teacher_personal_classes WHERE id = $1 AND teacher_id = $2`,
    [classId, teacherId]
  );
  return Boolean(rows[0]);
}

let demoTableReady = null;

/** 演示文件表。本地库若还没跑增量脚本，第一次上传时补建，避免演示不可用。 */
function ensureDemoFileTable() {
  if (!demoTableReady) {
    demoTableReady = getPool().query(`
      CREATE TABLE IF NOT EXISTS teacher_class_demo_files (
        id bigserial PRIMARY KEY,
        teacher_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        teacher_personal_class_id bigint REFERENCES teacher_personal_classes (id) ON DELETE SET NULL,
        college_id bigint,
        major_id bigint,
        college_name varchar(128) NOT NULL DEFAULT '',
        major_name varchar(128) NOT NULL DEFAULT '',
        teacher_name varchar(128) NOT NULL DEFAULT '',
        teacher_username varchar(128) NOT NULL DEFAULT '',
        class_name varchar(128) NOT NULL DEFAULT '',
        origin_name varchar(512) NOT NULL,
        stored_name varchar(128) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `).catch((e) => {
      demoTableReady = null;
      throw e;
    });
  }
  return demoTableReady;
}

/** 只解析演示目录内的文件名，避免清理时删到学生业务文件。 */
function demoStoredPath(storedName) {
  const name = String(storedName || '');
  if (!/^[\w.-]+$/.test(name)) return null;
  const root = path.resolve(DEMO_UPLOAD_ROOT);
  const abs = path.resolve(root, name);
  if (abs !== root && !abs.startsWith(`${root}${path.sep}`)) return null;
  return abs;
}

async function teacherDemoMeta(teacherId, classId) {
  const { rows } = await getPool().query(
    `SELECT u.real_name AS "teacherName", u.username AS "teacherUsername",
            CASE WHEN u.department ~ '^[0-9]+$' THEN u.department::bigint ELSE NULL END AS "collegeId",
            u.major_id AS "majorId",
            COALESCE(col.name, '') AS "collegeName",
            COALESCE(mj.name, '') AS "majorName",
            t.name AS "className"
     FROM users u
     JOIN teacher_personal_classes t ON t.id = $2 AND t.teacher_id = u.id
     LEFT JOIN colleges col ON col.id = CASE WHEN u.department ~ '^[0-9]+$' THEN u.department::bigint ELSE NULL END
     LEFT JOIN majors mj ON mj.id = u.major_id
     WHERE u.id = $1`,
    [teacherId, classId]
  );
  return rows[0] || null;
}

function unlinkDemoFile(storedName) {
  const abs = demoStoredPath(storedName);
  if (!abs) return;
  try {
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch (e) {
    logError('teacherClassDemo.unlink', e);
  }
}

router.post('/teacher/personal-classes/:classId/demo/ai', requireAuth(), requireTeacher(), async (req, res) => {
  try {
    const teacherId = parseId(req.user?.sub);
    const classId = parseId(req.params.classId);
    const scene = String(req.body?.scene || '').trim();
    const context = String(req.body?.context || '').trim().slice(0, 12000);
    if (!teacherId || !classId) return bad(req, res, 400, 40001, '无效班级');
    if (!SCENES[scene]) return bad(req, res, 400, 40002, '无效演示场景');
    if (!context) return bad(req, res, 400, 40003, '请先填写演示内容');
    if (!(await ownsPersonalClass(teacherId, classId))) return bad(req, res, 404, 40401, '班级不存在');

    const provider = await getEnabledProvider('multimodal');
    const text = await chatCompletion({
      provider,
      system: `你是创新创业实训的课堂演示助教。教师正在演示学生操作，结果只显示在当前页面，不会写入学生成绩或团队档案。请用中文。不要声称已经保存到数据库。${SCENES[scene]}`,
      user: context,
      jsonMode: JSON_MODE_SCENES.has(scene),
    });
    return ok(req, res, { text });
  } catch (e) {
    logError('POST teacher class demo ai', e);
    return bad(req, res, 500, 50001, e.message || '演示生成失败');
  }
});

router.post('/teacher/personal-classes/:classId/demo/files', requireAuth(), requireTeacher(), (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return bad(req, res, 400, 40004, err.message || '上传失败');
    try {
      const teacherId = parseId(req.user?.sub);
      const classId = parseId(req.params.classId);
      if (!teacherId || !classId) return bad(req, res, 400, 40001, '无效班级');
      if (!(await ownsPersonalClass(teacherId, classId))) return bad(req, res, 404, 40401, '班级不存在');
      if (!req.file?.buffer) return bad(req, res, 400, 40005, '请选择文件');

      const originName = normalizeUploadFileName(req.file.originalname, 'file');
      const ext = path.extname(originName).toLowerCase();
      if (!ALLOWED_EXT.has(ext)) return bad(req, res, 400, 40006, '不支持的文件类型');

      await ensureDemoFileTable();
      const meta = await teacherDemoMeta(teacherId, classId);
      if (!meta) return bad(req, res, 404, 40401, '班级不存在');
      fs.mkdirSync(DEMO_UPLOAD_ROOT, { recursive: true });
      const stored = `${Date.now()}-${randomBytes(8).toString('hex')}${ext}`;
      fs.writeFileSync(path.join(DEMO_UPLOAD_ROOT, stored), req.file.buffer);
      await getPool().query(
        `INSERT INTO teacher_class_demo_files
          (teacher_id, teacher_personal_class_id, college_id, major_id, college_name, major_name,
           teacher_name, teacher_username, class_name, origin_name, stored_name)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          teacherId,
          classId,
          meta.collegeId,
          meta.majorId,
          meta.collegeName,
          meta.majorName,
          meta.teacherName || meta.teacherUsername || '',
          meta.teacherUsername || '',
          meta.className || '',
          originName,
          stored,
        ]
      );
      return ok(req, res, { name: originName, url: `/uploads/class-demo/${stored}` });
    } catch (e) {
      logError('POST teacher class demo file', e);
      return bad(req, res, 500, 50002, e.message || '上传失败');
    }
  });
});

function demoFileFilters(query) {
  const where = [];
  const params = [];
  const collegeId = parseId(query.collegeId);
  const majorId = parseId(query.majorId);
  const teacher = String(query.teacher || '').trim();
  const from = String(query.from || '').trim();
  const to = String(query.to || '').trim();
  if (collegeId) {
    params.push(collegeId);
    where.push(`college_id = $${params.length}`);
  }
  if (majorId) {
    params.push(majorId);
    where.push(`major_id = $${params.length}`);
  }
  if (teacher) {
    params.push(`%${teacher}%`);
    where.push(`(teacher_name ILIKE $${params.length} OR teacher_username ILIKE $${params.length})`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(from)) {
    params.push(from);
    where.push(`created_at >= $${params.length}::date`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    params.push(to);
    where.push(`created_at < ($${params.length}::date + interval '1 day')`);
  }
  return { where, params };
}

function mapDemoFile(row) {
  return {
    id: String(row.id),
    teacherName: row.teacher_name || '',
    teacherUsername: row.teacher_username || '',
    collegeName: row.college_name || '',
    majorName: row.major_name || '',
    className: row.class_name || '',
    originName: row.origin_name || '',
    url: `/uploads/class-demo/${row.stored_name}`,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : '',
  };
}

router.get('/admin/class-demo-files', requireAuth(), requireAdmin(), async (req, res) => {
  try {
    await ensureDemoFileTable();
    const { where, params } = demoFileFilters(req.query);
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const sqlWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const totalQ = await getPool().query(`SELECT COUNT(*)::int AS total FROM teacher_class_demo_files ${sqlWhere}`, params);
    const listParams = [...params, pageSize, (page - 1) * pageSize];
    const { rows } = await getPool().query(
      `SELECT id, teacher_name, teacher_username, college_name, major_name, class_name, origin_name, stored_name, created_at
       FROM teacher_class_demo_files
       ${sqlWhere}
       ORDER BY created_at DESC, id DESC
       LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams
    );
    return ok(req, res, { list: rows.map(mapDemoFile), total: totalQ.rows[0]?.total || 0, page, pageSize });
  } catch (e) {
    logError('GET admin class demo files', e);
    return bad(req, res, 500, 50003, e.message || '查询失败');
  }
});

async function deleteDemoRows(rows) {
  for (const row of rows) unlinkDemoFile(row.stored_name);
  if (!rows.length) return 0;
  await getPool().query(`DELETE FROM teacher_class_demo_files WHERE id = ANY($1::bigint[])`, [rows.map((row) => row.id)]);
  return rows.length;
}

router.delete('/admin/class-demo-files/:id', requireAuth(), requireAdmin(), async (req, res) => {
  try {
    await ensureDemoFileTable();
    const id = parseId(req.params.id);
    if (!id) return bad(req, res, 400, 40007, '无效记录');
    const { rows } = await getPool().query(`SELECT id, stored_name FROM teacher_class_demo_files WHERE id = $1`, [id]);
    if (!rows[0]) return bad(req, res, 404, 40402, '记录不存在');
    const deleted = await deleteDemoRows(rows);
    return ok(req, res, { deleted });
  } catch (e) {
    logError('DELETE admin class demo file', e);
    return bad(req, res, 500, 50004, e.message || '删除失败');
  }
});

router.post('/admin/class-demo-files/purge', requireAuth(), requireAdmin(), async (req, res) => {
  try {
    await ensureDemoFileTable();
    const { where, params } = demoFileFilters(req.body || {});
    const sqlWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const { rows } = await getPool().query(`SELECT id, stored_name FROM teacher_class_demo_files ${sqlWhere}`, params);
    const deleted = await deleteDemoRows(rows);
    return ok(req, res, { deleted });
  } catch (e) {
    logError('POST admin class demo purge', e);
    return bad(req, res, 500, 50005, e.message || '清空失败');
  }
});

export default router;
