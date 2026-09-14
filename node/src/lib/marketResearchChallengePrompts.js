import { padStringList } from './llmJsonOutputRules.js';

export const CHALLENGE_PRESET_AGENTS = {
  'picky-user': {
    name: '挑剔用户',
    role: '从用户体验角度质疑产品价值',
  },
  investor: {
    name: '投资人',
    role: '从商业价值和盈利模式角度挑战',
  },
  competitor: {
    name: '竞争对手分析师',
    role: '从竞争格局角度发起攻击',
  },
  expert: {
    name: '行业专家',
    role: '从专业角度质疑可行性',
  },
};

export function totalChallengeRounds(agentCount) {
  if (agentCount <= 0) return 0;
  if (agentCount === 1) return 5;
  return agentCount * 2;
}

/** 按选择顺序：1 角色 5 轮同角色；多角色每角色 2 轮 */
export function agentIdForRound(selectedAgents, roundIndex) {
  const list = selectedAgents || [];
  if (!list.length) return null;
  if (list.length === 1) return list[0];
  const roundsPerAgent = 2;
  const agentIndex = Math.floor(roundIndex / roundsPerAgent);
  if (agentIndex >= list.length) return null;
  return list[agentIndex];
}

export function resolveAgentMeta(agentId, personaMap) {
  if (String(agentId).startsWith('persona:')) {
    const pid = String(agentId).slice('persona:'.length);
    const p = personaMap?.[pid];
    if (p) {
      return {
        id: agentId,
        name: p.name || '用户画像',
        role: `代表目标用户「${p.name}」的视角进行质疑`,
        personaDetail: p,
      };
    }
    return { id: agentId, name: '用户画像', role: '目标用户视角' };
  }
  const preset = CHALLENGE_PRESET_AGENTS[agentId];
  if (preset) return { id: agentId, ...preset };
  return { id: agentId, name: '挑战者', role: '质疑者' };
}

export const CHALLENGE_QUESTION_SYSTEM_PROMPT = `你是创业实训「人机对抗」中的挑战角色。

#Context#
根据项目信息与对话历史，以当前角色身份提出一个尖锐、具体的问题。

#Objective#
输出本轮挑战问题 JSON，供前端直接展示。

#Schema#
{"question":"问题正文（一两句话）","briefFeedback":"一句反馈或空字符串"}

#Examples#
{"question":"如果核心用户下周就不续费，你准备用什么指标在 14 天内验证？","briefFeedback":""}

#Response#
- 只能输出上述两个键的 JSON，禁止多键、禁止 markdown、禁止推理过程。
- question 非空；briefFeedback 可为 ""。`;

export const CHALLENGE_FINAL_REPORT_SYSTEM_PROMPT = `你是创业实训人机对抗裁判。

#Context#
根据项目信息与各轮问答，给出最终评估。

#Objective#
输出最终评估 JSON，供页面展示分数与要点。

#Schema#
{"totalScore":0-100整数,"strengths":["要点1","要点2","要点3"],"weaknesses":["要点1","要点2","要点3"],"suggestions":["要点1","要点2","要点3"]}

#Examples#
{"totalScore":72,"strengths":["问题回应具体","能引用用户场景","有一定数据意识"],"weaknesses":["商业闭环偏弱","风险预案不足","差异化不清晰"],"suggestions":["补齐转化指标","做小范围试点","明确竞争壁垒"]}

#Response#
- strengths / weaknesses / suggestions 均恰好 3 条，禁止多/少。
- 只能输出上述键，禁止 markdown 与多余说明。`;

export function buildChallengeQuestionUserPrompt({
  projectInfo,
  analysisSummary,
  agentMeta,
  roundIndex,
  totalRounds,
  history,
}) {
  const hist = (history || [])
    .map(
      (h, i) =>
        `第${i + 1}轮 [${h.agentName || ''}] 问：${h.question || ''}\n答：${h.answer || ''}`
    )
    .join('\n\n');
  return `【项目信息】
${JSON.stringify(projectInfo, null, 2)}

【数据分析报告摘要】
${analysisSummary || '（暂无）'}

【当前角色】${agentMeta.name} — ${agentMeta.role}
${agentMeta.personaDetail ? `画像细节：${JSON.stringify(agentMeta.personaDetail)}` : ''}

【进度】第 ${roundIndex + 1} / ${totalRounds} 轮

【历史问答】
${hist || '（首轮，无历史）'}

请以当前角色输出本轮问题 JSON。`;
}

export function buildChallengeFinalUserPrompt({ projectInfo, analysisSummary, rounds }) {
  const transcript = (rounds || [])
    .map(
      (r, i) =>
        `第${i + 1}轮 [${r.agentName}] 问：${r.question}\n答：${r.answer || ''}`
    )
    .join('\n\n');
  return `【项目信息】
${JSON.stringify(projectInfo, null, 2)}

【数据分析摘要】
${analysisSummary || '（暂无）'}

【完整问答】
${transcript}

输出最终报告 JSON。`;
}

export function normalizeChallengeQuestion(raw, fallbackText) {
  if (raw && typeof raw === 'object') {
    const q = String(raw.question || raw.问题 || '').trim();
    if (q) {
      return {
        question: q,
        briefFeedback: String(raw.briefFeedback || raw.feedback || '').trim(),
      };
    }
  }
  const t = String(fallbackText || '').trim();
  const fromText = t.match(/"question"\s*:\s*"([^"]+)"/);
  if (fromText?.[1]) {
    return { question: fromText[1].trim(), briefFeedback: '' };
  }
  const plain = t.replace(/```[\s\S]*?```/g, '').trim();
  if (plain.length > 10 && !plain.startsWith('{')) {
    return { question: plain.slice(0, 2000), briefFeedback: '' };
  }
  return { question: '请进一步说明你的方案如何验证市场需求？', briefFeedback: '' };
}

export function normalizeChallengeFinalReport(raw) {
  if (!raw || typeof raw !== 'object') return { error: 'AI 未返回有效报告' };
  const totalScore = Number(raw.totalScore);
  if (!Number.isFinite(totalScore)) return { error: 'AI 未返回 totalScore' };
  const pick = (arr, fb) =>
    padStringList(
      Array.isArray(arr) ? arr.map((s) => String(s).trim()).filter(Boolean) : [],
      3,
      fb
    ).slice(0, 3);
  return {
    report: {
      totalScore: Math.min(100, Math.max(0, Math.round(totalScore))),
      strengths: pick(raw.strengths, ['回应较具体', '有场景意识', '态度积极']),
      weaknesses: pick(raw.weaknesses, ['闭环不足', '证据偏弱', '风险预案少']),
      suggestions: pick(raw.suggestions, ['补齐验证指标', '小范围试点', '强化差异化']),
    },
  };
}
