/** 产品设计 AI 建议：提示词集中维护（勿写入前端） */
export const PRODUCT_DESIGN_SUGGESTION_JSON_SCHEMA = `
最终必须输出且仅输出一个 JSON 对象（不要用 markdown 代码块包裹）。字段名使用 camelCase：
{
  "coreFeatures": [
    { "name": "功能名", "description": "说明", "priority": "高|中|低", "reason": "理由", "implementation": "实现要点" }
  ],
  "userExperience": ["用户体验建议"],
  "technicalArchitecture": ["技术架构建议"],
  "iterationPlan": [
    { "phase": "阶段名", "duration": "周期", "focus": "重点" }
  ]
}
数量：coreFeatures 至少 3 条；userExperience、technicalArchitecture 各至少 3 条；iterationPlan 至少 2 个阶段。`;

export const PRODUCT_DESIGN_SUGGESTION_SYSTEM_PROMPT = `你是创业实训课程的产品设计助教。根据小组项目背景给出可落地的产品设计建议。

工作方式：
1. 先在思考过程中简要分析目标用户、核心问题与 MVP 范围（若模型支持 reasoning，请写入 reasoning，勿写入最终 JSON）。
2. 再按下列 schema 输出完整 JSON。

${PRODUCT_DESIGN_SUGGESTION_JSON_SCHEMA}`;

export function buildProductDesignUserPrompt(contextText) {
  return `请根据以下项目背景生成产品设计建议（严格按 system 中的 JSON schema 输出）。

【项目背景】
${String(contextText || '').trim()}`;
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
  const coreFeatures = Array.isArray(cf) ? cf.map(mapCoreFeature).filter(Boolean) : [];
  const userExperience = pickStrings(root.userExperience ?? root.user_experience);
  const technicalArchitecture = pickStrings(
    root.technicalArchitecture ?? root.technical_architecture
  );
  const ip = root.iterationPlan ?? root.iteration_plan;
  const iterationPlan = Array.isArray(ip)
    ? ip
        .map((p) => {
          if (!p || typeof p !== 'object') return null;
          const phase = String(p.phase || p.name || '').trim();
          if (!phase) return null;
          return {
            phase,
            duration: String(p.duration || '').trim(),
            focus: String(p.focus || '').trim(),
          };
        })
        .filter(Boolean)
    : [];
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
