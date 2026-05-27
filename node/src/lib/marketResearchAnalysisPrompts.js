const ANALYSIS_JSON_SCHEMA = `
仅输出一个 JSON 对象，不要 markdown 或解释。结构：
{
  "score": 0-100 的整数,
  "conclusions": ["字符串"],
  "opportunities": ["字符串"],
  "risks": ["字符串"],
  "suggestions": ["字符串"],
  "stats": {
    "totalCollected": 整数,
    "validSamples": 整数或 null,
    "activeSurveyCount": 整数
  },
  "charts": {
    "ageDistribution": [{"label":"", "value": 非负整数}],
    "spendingDistribution": [{"label":"", "value": 非负整数}],
    "satisfactionDistribution": [{"label":"", "value": 非负整数}],
    "improvementRanking": [{"label":"", "value": 0-100 整数}]
  },
  "keyFindings": [{"title":"", "desc":""}]
}
规则：
- stats.totalCollected、stats.activeSurveyCount 必须与材料中给出的数字一致，不得编造。
- 若问卷数据不足以支撑某类图表，对应数组必须为 []，并在 conclusions 中说明数据不足。
- charts 各 item 的 value 为计数或百分比权重（improvementRanking 为 0-100），不得虚构样本。
- validSamples 仅在材料可推断时填写，否则为 null。`;

export const MARKET_ANALYSIS_SYSTEM_PROMPT = `你是创业实训课程的市场调研数据分析助教。仅根据小组线上问卷的题目与回收统计，输出结构化分析结论。
${ANALYSIS_JSON_SCHEMA}`;

export function buildMarketAnalysisUserPrompt(contextText, hardStats) {
  return `请基于以下问卷材料进行分析。

【系统统计（必须使用）】
问卷回收总量：${hardStats.totalCollected}
进行中问卷数：${hardStats.activeSurveyCount}

${contextText}

请输出 JSON。`;
}

function unwrapAnalysisPayload(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  if (raw.score != null || raw.Score != null) return raw;
  if (raw.result && typeof raw.result === 'object') return raw.result;
  if (raw.data && typeof raw.data === 'object') return raw.data;
  return raw;
}

function parseScoreValue(raw) {
  const payload = unwrapAnalysisPayload(raw);
  if (!payload || typeof payload !== 'object') return NaN;
  let scoreRaw = payload.score ?? payload.Score ?? payload.评分;
  if (scoreRaw == null) return NaN;
  if (typeof scoreRaw === 'string') {
    const m = scoreRaw.match(/\d{1,3}/);
    scoreRaw = m ? m[0] : scoreRaw;
  }
  const score = Number(scoreRaw);
  if (!Number.isFinite(score)) return NaN;
  return Math.min(100, Math.max(0, Math.round(score)));
}

export function normalizeAnalysisResult(raw, hardStats) {
  const payload = unwrapAnalysisPayload(raw);
  if (!payload || typeof payload !== 'object') return { error: 'AI 返回格式无效' };
  const score = parseScoreValue(payload);
  if (!Number.isFinite(score)) {
    return { error: 'AI 未返回有效 score' };
  }
  const pickStrings = (arr) =>
    Array.isArray(arr) ? arr.map((s) => String(s).trim()).filter(Boolean) : [];
  const pickChart = (arr) => {
    if (!Array.isArray(arr)) return [];
    return arr
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const label = String(item.label || '').trim();
        const value = Number(item.value);
        if (!label || !Number.isFinite(value) || value < 0) return null;
        return { label, value: Math.round(value) };
      })
      .filter(Boolean);
  };
  const keyFindings = Array.isArray(payload.keyFindings)
    ? payload.keyFindings
        .map((k) => {
          if (!k || typeof k !== 'object') return null;
          const title = String(k.title || '').trim();
          const desc = String(k.desc || '').trim();
          if (!title) return null;
          return { title, desc };
        })
        .filter(Boolean)
    : [];
  const statsIn = payload.stats && typeof payload.stats === 'object' ? payload.stats : {};
  const validRaw = statsIn.validSamples;
  const validSamples =
    validRaw == null || validRaw === ''
      ? null
      : Number.isFinite(Number(validRaw))
        ? Math.max(0, Math.round(Number(validRaw)))
        : null;

  return {
    result: {
      score,
      conclusions: pickStrings(payload.conclusions),
      opportunities: pickStrings(payload.opportunities),
      risks: pickStrings(payload.risks),
      suggestions: pickStrings(payload.suggestions),
      stats: {
        totalCollected: hardStats.totalCollected,
        validSamples,
        activeSurveyCount: hardStats.activeSurveyCount,
      },
      charts: {
        ageDistribution: pickChart(payload.charts?.ageDistribution),
        spendingDistribution: pickChart(payload.charts?.spendingDistribution),
        satisfactionDistribution: pickChart(payload.charts?.satisfactionDistribution),
        improvementRanking: pickChart(payload.charts?.improvementRanking),
      },
      keyFindings,
    },
  };
}
