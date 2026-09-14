/** 产品设计 AI 建议：提示词集中维护（勿写入前端） */
import { buildStructuredSystemPrompt, padStringList } from './llmJsonOutputRules.js';

export const PRODUCT_DESIGN_SUGGESTION_JSON_SCHEMA = `{
  "coreFeatures": [
    { "name": "功能名", "description": "说明", "priority": "高|中|低", "reason": "理由", "implementation": "实现要点" }
  ],
  "userExperience": ["建议1", "建议2", "建议3"],
  "technicalArchitecture": ["建议1", "建议2", "建议3"],
  "iterationPlan": [
    { "phase": "阶段名", "duration": "周期", "focus": "重点" }
  ]
}
固定数量：coreFeatures 恰好 3 条；userExperience / technicalArchitecture 各恰好 3 条；iterationPlan 恰好 2 条。
priority 只能是「高」「中」「低」。禁止增删字段。`;

export const PRODUCT_DESIGN_SUGGESTION_SYSTEM_PROMPT = buildStructuredSystemPrompt({
  context: '你是创业实训课程的产品设计助教。根据小组项目背景给出可落地的产品设计建议。',
  objective: '输出可直接渲染的产品建议 JSON（功能、体验、架构、迭代）。',
  style: '具体可执行；优先 MVP 范围。',
  schemaBlock: PRODUCT_DESIGN_SUGGESTION_JSON_SCHEMA,
  exampleBlock: `{"coreFeatures":[{"name":"一键成片","description":"文本转短视频草稿","priority":"高","reason":"匹配主痛点","implementation":"模板+脚本引擎"}],"userExperience":["三步完成导出","默认手机竖屏","失败可一键重试"],"technicalArchitecture":["前端轻交互","异步渲染队列","对象存储成片"],"iterationPlan":[{"phase":"MVP","duration":"4周","focus":"核心成片链路"},{"phase":"增强","duration":"4周","focus":"模板与协作"}]}`,
});

export function buildProductDesignUserPrompt(contextText) {
  return `请根据以下项目背景生成产品设计建议（严格按 system #Schema#，数量不得多/少）。

###
【项目背景】
${String(contextText || '').trim() || '（无）'}
###`;
}

function unwrapSuggestionRoot(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  if (raw.coreFeatures || raw.core_features) return raw;
  for (const key of ['data', 'result', 'suggestion', 'payload', 'output', 'content']) {
    const inner = raw[key];
    if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
      const un = unwrapSuggestionRoot(inner);
      if (un?.coreFeatures || un?.core_features) return un;
    }
  }
  return raw;
}

function mapCoreFeature(f) {
  if (!f || typeof f !== 'object') return null;
  const name = String(f.name || f.title || '').trim();
  if (!name) return null;
  return {
    name,
    description: String(f.description || f.desc || '').trim(),
    priority: normalizePriority(f.priority),
    reason: String(f.reason || '').trim(),
    implementation: String(f.implementation || f.implement || '').trim(),
  };
}

function pickStrings(arr) {
  return Array.isArray(arr) ? arr.map((s) => String(s).trim()).filter(Boolean) : [];
}

function normalizePriority(p) {
  const s = String(p || '').trim();
  if (s === '高' || s === '中' || s === '低') return s;
  if (/high/i.test(s)) return '高';
  if (/low/i.test(s)) return '低';
  return '中';
}

export function normalizeProductSuggestionPayload(raw) {
  const root = unwrapSuggestionRoot(raw);
  if (!root || typeof root !== 'object') return { error: 'AI 返回格式无效' };
  const cf = root.coreFeatures ?? root.core_features;
  let coreFeatures = Array.isArray(cf) ? cf.map(mapCoreFeature).filter(Boolean) : [];
  while (coreFeatures.length < 3) {
    coreFeatures.push({
      name: `待明确功能${coreFeatures.length + 1}`,
      description: '材料不足，建议补充后再细化',
      priority: '中',
      reason: '占位补齐',
      implementation: '后续迭代',
    });
  }
  coreFeatures = coreFeatures.slice(0, 3);

  const userExperience = padStringList(
    pickStrings(root.userExperience ?? root.user_experience),
    3,
    ['降低上手门槛', '缩短关键路径', '提供失败可恢复反馈']
  ).slice(0, 3);
  const technicalArchitecture = padStringList(
    pickStrings(root.technicalArchitecture ?? root.technical_architecture),
    3,
    ['前后端分离', '异步任务处理', '对象存储与 CDN']
  ).slice(0, 3);

  const ip = root.iterationPlan ?? root.iteration_plan;
  let iterationPlan = Array.isArray(ip)
    ? ip
        .map((p) => {
          if (!p || typeof p !== 'object') return null;
          const phase = String(p.phase || p.name || '').trim();
          if (!phase) return null;
          return {
            phase,
            duration: String(p.duration || '').trim() || '2-4周',
            focus: String(p.focus || '').trim() || '核心验证',
          };
        })
        .filter(Boolean)
    : [];
  while (iterationPlan.length < 2) {
    iterationPlan.push({
      phase: iterationPlan.length === 0 ? 'MVP' : '增强',
      duration: '4周',
      focus: iterationPlan.length === 0 ? '核心链路' : '体验与增长',
    });
  }
  iterationPlan = iterationPlan.slice(0, 2);

  if (!coreFeatures.length && !userExperience.length) {
    return { error: 'AI 未返回有效建议内容' };
  }
  return {
    payload: { coreFeatures, userExperience, technicalArchitecture, iterationPlan },
  };
}

export function parseProductSuggestionFromLlmText(text, extractJsonFromLlmText, findAllBalancedJsonObjects) {
  let parsed = extractJsonFromLlmText(text);
  if (!parsed?.coreFeatures && !parsed?.core_features && findAllBalancedJsonObjects) {
    const all = findAllBalancedJsonObjects(text);
    for (let i = all.length - 1; i >= 0; i--) {
      if (all[i]?.coreFeatures || all[i]?.core_features) {
        parsed = all[i];
        break;
      }
    }
  }
  return normalizeProductSuggestionPayload(parsed);
}
