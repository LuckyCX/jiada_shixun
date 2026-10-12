import { extractJsonFromLlmText } from './marketResearchSse.js';
import { coerceSections } from './businessPlanSections.js';

export const BUSINESS_PLAN_GENERATE_JSON_SCHEMA = `
最终必须输出且仅输出一个 JSON 对象（不要用 markdown 代码块包裹）。字段：
{
  "sections": [
    { "key": "与输入章节一致", "title": "章节标题", "content": "..." }
  ]
}
要求：
- sections 必须与「输入的章节列表」一一对应：key 必须使用输入提供的 key；title 使用输入标题（可原样返回）；不得丢章节、不得新增章节。
- 各 content 为非空字符串；可用轻量 Markdown（## 小标题、**加粗**、列表），系统会转为富文本；禁止输出 HTML 标签。
- 篇幅硬性要求：每一章 content 必须达到 500～800 汉字（按中文字符计，不含标点可略宽松，但正文信息量须达标）；禁止少于 500 字的短章，禁止三言两语概括。
- 每章须含背景说明、分点论证与可落地细节；可用轻量 Markdown 小标题/列表展开，但不要注水重复。
- 内容须基于给定资料，勿编造与资料明显矛盾的精确数据；资料不足处明确标注「假设/估算」。
- 不要输出思考过程、推理链或解释性前言，只输出 JSON。`;

export const BUSINESS_PLAN_GENERATE_SYSTEM_PROMPT = `你是创业实训课程的商业计划书助教。根据小组前期实训产出，一次性撰写完整商业计划书全部章节正文（结构化 JSON 输出）。

写作标准：像面向投资人/评审的正式计划书，逻辑完整、论据具体；不要写成提纲或口号堆砌。禁止输出思考过程。必须一次返回输入列表中的全部章节，不得漏章。每一章正文 500～800 汉字，不得偷工减料。

${BUSINESS_PLAN_GENERATE_JSON_SCHEMA}`;

export const BUSINESS_PLAN_FILL_SECTION_SYSTEM_PROMPT = `你是创业实训课程的商业计划书助教。你将只填充一个章节的内容。禁止输出思考过程。

最终必须输出且仅输出一个 JSON 对象（不要用 markdown 代码块包裹）。字段：
{
  "key": "章节 key（与输入一致）",
  "content": "章节内容（非空字符串）"
}
要求：
- content 可用轻量 Markdown（## 小标题、**加粗**、列表），禁止 HTML 标签。
- 篇幅硬性要求：content 必须 500～800 汉字，含论证与可落地细节，禁止短章概括。
- 内容须基于给定资料，勿编造与资料明显矛盾的数据；资料不足处可简要说明合理假设。`;

/** 仅生成章节大纲（标题结构），不写正文 */
export const BUSINESS_PLAN_OUTLINE_SYSTEM_PROMPT = `你是创业实训课程的商业计划书助教。根据小组前期实训产出，设计合适的商业计划书章节大纲。

#Objective#
只输出章节结构（key + title），不要撰写任何章节正文。

#Schema#
{
  "sections": [
    { "key": "英文蛇形命名，如 executive_summary", "title": "中文章节标题" }
  ]
}

#Rules#
1. 章节数量建议 6～10 个，按商业计划书常见逻辑排序。
2. 必须贴合项目资料（选题、市场、产品、商业模式、团队等）；资料不足处用通用但合理的章节，勿编造与资料矛盾的标题。
3. key 仅用小写字母、数字与下划线；同一份大纲内 key 唯一。
4. title 简洁明确，禁止空标题。
5. 禁止输出 content 字段；禁止 markdown 代码块；只能输出上述 JSON。`;

export function buildBusinessPlanOutlineUserPrompt(contextBundle) {
  return `请基于以下前期实训资料，生成商业计划书章节大纲（仅 key + title）。

【前期实训参考资料】
${String(contextBundle || '').trim() || '（暂无资料，请输出通用创业商业计划书章节结构）'}`;
}

export function normalizeOutlinePayload(raw) {
  const src = raw && typeof raw === 'object' ? raw : null;
  const list = Array.isArray(src?.sections) ? src.sections : Array.isArray(src) ? src : null;
  if (!list?.length) throw new Error('AI 返回章节大纲无效');
  const used = new Set();
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const item = list[i] || {};
    let key = String(item.key || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (!key) key = `sec_${i + 1}`;
    if (used.has(key)) key = `${key}_${i + 1}`;
    used.add(key);
    const title = String(item.title || item.name || '').trim() || `章节${i + 1}`;
    out.push({ key, title, content: '' });
  }
  if (!out.length) throw new Error('AI 返回章节大纲为空');
  return out;
}

export function buildBusinessPlanGenerateUserPrompt(contextBundle, sections) {
  const list = coerceSections(sections).map((s) => ({
    key: s.key,
    title: s.title,
    guide: String(s.guide || '').trim() || undefined,
  }));
  const n = list.length;
  return `请基于以下资料，一次性生成完整商业计划书：为「输入章节列表」中的每一章撰写充实正文。严格按 system 中的 JSON schema 输出（一个 JSON，必须含全部 ${n} 章）。不要输出思考过程，不要漏章。

【输入章节列表（必须全部生成，key 不得变更；共 ${n} 章）】
${JSON.stringify(list, null, 2)}

【篇幅与写作硬性要求】
- 每一章 content 必须 500～800 汉字；共 ${n} 章，全文正文合计约 ${n * 500}～${n * 800} 汉字，不得写成每章一两百字的提纲。
- 按章节结构输出，每章 content 独立展开（背景 + 分点 + 可落地细节），不要把多章内容塞进某一章。
- 章节之间可互相呼应，但不要重复粘贴同一段话。

${String(contextBundle || '').trim()}`;
}

export function buildBusinessPlanFillSectionUserPrompt(contextBundle, sections, sectionKey, mode) {
  const list = coerceSections(sections).map((s) => ({ key: s.key, title: s.title }));
  const key = String(sectionKey || '').trim();
  const m = String(mode || '').trim() === 'expand' ? 'expand' : 'overwrite';
  const current = coerceSections(sections).find((s) => s.key === key);
  const currentTitle = current?.title || key;
  const currentContent = String(current?.content || '').trim();
  return `你将只生成一个章节（key=${key}）的 content，不要生成其它章节。

【章节填充模式】
- overwrite：整体重写该章节内容
- expand：在已有文案基础上扩写与完善，保留原有信息点并补充细节
本次模式：${m}

【输入章节列表（仅作上下文，key 不得变更）】
${JSON.stringify(list, null, 2)}

【目标章节】
key: ${key}
title: ${currentTitle}
已有内容（可能为空）：
${currentContent || '（空）'}

【输出要求】
- 最终必须输出且仅输出一个 JSON 对象（不要用 markdown 代码块包裹）
- 格式：{ \"key\": \"${key}\", \"content\": \"...\" }
- content 必须 500～800 汉字，含分点与可落地细节；内容须基于给定资料，勿编造与资料明显矛盾的数据；资料不足处可简要说明合理假设。

【前期实训参考资料】
${String(contextBundle || '').trim()}`;
}

export const BUSINESS_PLAN_ANALYZE_SYSTEM_PROMPT = `你是创业实训课程的商业计划书评审助教。根据计划书正文与前期实训资料，输出结构化评审报告（纯文本 Markdown 风格，勿 JSON）。

报告须包含：
一、整体评价（含 0-100 质量分）
二、优点分析（分条）
三、改进建议（分条、可执行）
四、关键指标评估（市场分析、产品服务、商业模式、营销策略、财务规划、团队介绍，各 1-5 星简述）
五、下一步行动建议

语言简洁专业，勿空泛套话。`;

export const BUSINESS_PLAN_ANALYZE_JSON_SYSTEM_PROMPT = `你是创业实训课程的商业计划书评审助教。

#Context#
根据计划书正文与前期实训资料输出结构化评审数据。

#Objective#
输出页面可直接渲染的评审 JSON。

#Schema#
{
  "score": 0-100 整数,
  "overall": "整体评价（1-3句，非空）",
  "strengths": ["优点1", "优点2", "优点3"],
  "improvements": ["改进1", "改进2", "改进3"],
  "metrics": [
    { "name": "市场分析", "stars": 1-5, "comment": "一句简评" },
    { "name": "产品服务", "stars": 1-5, "comment": "一句简评" },
    { "name": "商业模式", "stars": 1-5, "comment": "一句简评" },
    { "name": "营销策略", "stars": 1-5, "comment": "一句简评" },
    { "name": "财务规划", "stars": 1-5, "comment": "一句简评" },
    { "name": "团队介绍", "stars": 1-5, "comment": "一句简评" }
  ],
  "nextActions": ["行动1", "行动2", "行动3"]
}
固定约束：strengths / improvements / nextActions 均恰好 3 条；metrics 必须恰好上述 6 个 name，顺序一致，禁止增删。

#Response#
- 只能输出上述键的 JSON，禁止 markdown。
- 表述具体可执行，避免空泛套话。`;

export function buildBusinessPlanAnalyzeUserPrompt(analyzeBundle) {
  return String(analyzeBundle || '').trim();
}

function coerceAnalyzeStringList(v) {
  if (Array.isArray(v)) return v.map((x) => String(x ?? '').trim()).filter(Boolean);
  if (typeof v === 'string' && v.trim()) {
    return v
      .split(/\n+/)
      .map((s) => s.replace(/^[\d一二三四五六七八九十]+[、.)．]\s*/, '').trim())
      .filter(Boolean);
  }
  return [];
}

/** 将模型 JSON（含中英文字段）规范为前端展示结构 */
export function normalizeBusinessPlanAnalyzePayload(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const nested = raw.analysis && typeof raw.analysis === 'object' ? raw.analysis : raw;

  let score = Math.round(Number(nested.score ?? nested.Score ?? nested.qualityScore ?? nested.质量分 ?? 0));
  if (!Number.isFinite(score)) score = 0;
  score = Math.max(0, Math.min(100, score));

  const overall = String(
    nested.overall ??
      nested.summary ??
      nested.evaluation ??
      nested.整体评价 ??
      nested['整体评价'] ??
      ''
  ).trim();

  const strengths = coerceAnalyzeStringList(
    nested.strengths ?? nested.优点 ?? nested.优点分析 ?? nested.strength
  );
  const improvements = coerceAnalyzeStringList(
    nested.improvements ?? nested.suggestions ?? nested.改进建议 ?? nested.improvement
  );
  const nextActions = coerceAnalyzeStringList(
    nested.nextActions ?? nested.next_steps ?? nested.下一步行动建议 ?? nested.actions
  );

  const mRaw = nested.metrics ?? nested.关键指标 ?? nested.indicators;
  let metrics = [];
  if (Array.isArray(mRaw)) {
    metrics = mRaw
      .map((m) => {
        if (!m || typeof m !== 'object') return null;
        const name = String(m.name ?? m.title ?? m.指标 ?? m.dimension ?? '').trim();
        let stars = Math.round(Number(m.stars ?? m.star ?? m.score ?? m.星级 ?? 0));
        if (!Number.isFinite(stars)) stars = 0;
        stars = Math.max(0, Math.min(5, stars));
        const comment = String(m.comment ?? m.desc ?? m.description ?? m.简评 ?? '').trim();
        if (!name && !comment) return null;
        return { name: name || '指标', stars, comment };
      })
      .filter(Boolean);
  }

  const hasBody =
    overall.length >= 4 ||
    strengths.length > 0 ||
    improvements.length > 0 ||
    metrics.length > 0 ||
    nextActions.length > 0;
  if (!hasBody) return null;

  return { score, overall, strengths, improvements, metrics, nextActions };
}

/** 从模型原文里抽出计划书 sections（兼容顶层数组 / {sections} / 代码块） */
export function parseBusinessPlanGenerateJson(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  const tryObj = (obj) => {
    if (!obj || typeof obj !== 'object') return null;
    if (Array.isArray(obj)) return obj;
    if (Array.isArray(obj.sections)) return obj.sections;
    if (Array.isArray(obj.data?.sections)) return obj.data.sections;
    if (Array.isArray(obj.result?.sections)) return obj.result.sections;
    return null;
  };

  try {
    const direct = JSON.parse(raw);
    const hit = tryObj(direct);
    if (hit) return hit;
  } catch {
    /* ignore */
  }

  const viaExtract = tryObj(extractJsonFromLlmText(raw));
  if (viaExtract) return viaExtract;

  // 截断/夹杂正文时：找含 sections 的最大平衡对象
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      const hit = tryObj(JSON.parse(fenced[1].trim()));
      if (hit) return hit;
    } catch {
      /* ignore */
    }
  }

  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      const hit = tryObj(JSON.parse(raw.slice(start, end + 1)));
      if (hit) return hit;
    } catch {
      /* ignore */
    }
  }
  return null;
}

export function normalizeGeneratePayload(text) {
  const sections = parseBusinessPlanGenerateJson(text);
  if (!sections?.length) {
    throw new Error('AI 返回格式无效，请稍后重试');
  }
  return coerceSections(sections);
}
