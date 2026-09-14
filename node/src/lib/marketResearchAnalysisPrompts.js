import { buildStructuredSystemPrompt, padStringList } from './llmJsonOutputRules.js';

const ANALYSIS_SCHEMA = `{
  "score": 0-100 整数,
  "conclusions": ["结论1", "结论2", "结论3"],
  "opportunities": ["机会1", "机会2", "机会3"],
  "risks": ["风险1", "风险2", "风险3"],
  "suggestions": ["建议1", "建议2", "建议3"],
  "stats": {
    "totalCollected": 整数,
    "validSamples": 整数或 null,
    "activeSurveyCount": 整数
  },
  "charts": {
    "ageDistribution": [{"label":"标签","value":非负整数}],
    "spendingDistribution": [{"label":"标签","value":非负整数}],
    "satisfactionDistribution": [{"label":"标签","value":非负整数}],
    "improvementRanking": [{"label":"标签","value":0-100整数}]
  },
  "keyFindings": [
    {"title":"发现标题","desc":"一句话说明"},
    {"title":"发现标题","desc":"一句话说明"},
    {"title":"发现标题","desc":"一句话说明"}
  ]
}
固定约束：
- conclusions / opportunities / risks / suggestions 均恰好 3 条。
- keyFindings 恰好 3 条，title/desc 均非空。
- charts 四个键必须全部出现；无数据时对应值为 []（不可省略键）。
- stats.totalCollected、stats.activeSurveyCount 必须与用户消息【系统统计】一致，禁止改写。
- validSamples 仅在可推断时填整数，否则必须为 null。`;

const ANALYSIS_EXAMPLE = `{"score":68,"conclusions":["回收样本有限但方向清晰","核心痛点集中在效率","付费意愿中等"],"opportunities":["切入刚需场景","做轻量 MVP","借校园渠道获客"],"risks":["样本偏差","竞品同质","留存不确定"],"suggestions":["补齐目标用户访谈","先验证转化漏斗","明确差异化卖点"],"stats":{"totalCollected":42,"validSamples":40,"activeSurveyCount":1},"charts":{"ageDistribution":[{"label":"18-22岁","value":28}],"spendingDistribution":[{"label":"500-1500元","value":19}],"satisfactionDistribution":[{"label":"3分","value":12}],"improvementRanking":[{"label":"生成速度","value":78}]},"keyFindings":[{"title":"效率诉求突出","desc":"多数受访者希望缩短内容制作时间"},{"title":"价格敏感","desc":"更倾向先试用再付费"},{"title":"场景集中","desc":"短视频创作是高频场景"}]}`;

export const MARKET_ANALYSIS_SYSTEM_PROMPT = buildStructuredSystemPrompt({
  context: '你是创业实训课程的市场调研数据分析助教。仅根据小组线上问卷题目与回收统计做分析。',
  objective: '输出可直接用于页面展示的结构化分析 JSON，数字与图表须可被材料支撑。',
  style: '结论具体、可执行；不编造样本。',
  schemaBlock: ANALYSIS_SCHEMA,
  exampleBlock: `Output 示例（字段集合必须一致，数值随材料变化）：\n${ANALYSIS_EXAMPLE}`,
});

export function buildMarketAnalysisUserPrompt(contextText, hardStats) {
  return `请基于以下问卷材料进行分析，严格按 system #Schema# 输出（列表类字段各恰好 3 条）。

【系统统计（必须原样写入 stats）】
问卷回收总量：${hardStats.totalCollected}
进行中问卷数：${hardStats.activeSurveyCount}

###
【问卷材料】
${String(contextText || '').trim() || '（无）'}
###`;
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
  const pickStrings = (arr, fallbacks) =>
    padStringList(
      Array.isArray(arr) ? arr.map((s) => String(s).trim()).filter(Boolean) : [],
      3,
      fallbacks
    ).slice(0, 3);
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
  let keyFindings = Array.isArray(payload.keyFindings)
    ? payload.keyFindings
        .map((k) => {
          if (!k || typeof k !== 'object') return null;
          const title = String(k.title || '').trim();
          const desc = String(k.desc || '').trim();
          if (!title) return null;
          return { title, desc: desc || '详见问卷统计' };
        })
        .filter(Boolean)
    : [];
  while (keyFindings.length < 3) {
    keyFindings.push({
      title: `发现${keyFindings.length + 1}`,
      desc: '材料有限，建议补充样本后复盘',
    });
  }
  keyFindings = keyFindings.slice(0, 3);

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
      conclusions: pickStrings(payload.conclusions, ['样本揭示了基本需求方向', '痛点相对集中', '仍需扩大验证']),
      opportunities: pickStrings(payload.opportunities, ['可切入高频场景', '可做轻量方案', '渠道具备可达性']),
      risks: pickStrings(payload.risks, ['样本可能偏差', '竞争同质化', '转化不确定']),
      suggestions: pickStrings(payload.suggestions, ['补访目标用户', '验证核心假设', '明确差异化卖点']),
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
