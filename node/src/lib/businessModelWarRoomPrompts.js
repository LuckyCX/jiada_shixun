import { extractJsonFromLlmText, findAllBalancedJsonObjects } from './marketResearchSse.js';

export const WAR_ROOM_MODULE_KEYS = [
  'customerSegments',
  'valueProposition',
  'channels',
  'customerRelationships',
  'revenueStreams',
  'keyResources',
  'keyActivities',
  'keyPartnerships',
  'costStructure',
];

const MIDDLE_HATS = ['red', 'black', 'yellow', 'green'];

export function shuffleMiddleHatOrder() {
  const arr = [...MIDDLE_HATS];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 第一轮：白 → 中间四帽随机 → 蓝 */
export function buildRoundHatOrder(isFirstRound) {
  if (!isFirstRound) {
    return ['white', ...shuffleMiddleHatOrder(), 'blue'];
  }
  return ['white', ...shuffleMiddleHatOrder(), 'blue'];
}

const HAT_ROLE_TEXT = {
  white: `白帽（数据分析师）：只基于客观事实和数据发言。补充市场规模、目标用户数量、竞品份额、成本利润测算、行业公开数据等。只说可验证事实，不主观评价。`,
  red: `红帽（用户代表）：只凭直觉和情绪，以目标用户身份说第一感受：会不会想用、舒服/别扭、在意什么体验。不解释理由。`,
  black: `黑帽（风险预警员）：从市场、技术、资金、政策、竞争挑问题，说潜在风险、逻辑漏洞、执行致命点。`,
  yellow: `黄帽（乐观倡导者）：挖掘优势、用户痛点、机会点、盈利模式亮点、增长可能。`,
  green: `绿帽（创意设计师）：提出差异化创意：产品优化、新玩法/渠道/盈利模式、与竞品不同点。`,
  blue: `蓝帽（项目经理）：控场与总结。引导讨论、追问关键信息，总结已解决与待解决问题，建议下一步。`,
};

export const WAR_ROOM_ROUND_JSON_SCHEMA = `
输出且仅输出一个 JSON 对象（不要用 markdown 代码块）：
{
  "messages": [
    {
      "hat": "white|red|black|yellow|green|blue",
      "content": "发言正文，可引用前文、自然对话",
      "targetModule": "九格键名或 null",
      "moduleContent": "当 targetModule 非 null 时，为该格替换用的要点文本（\\n 分隔），否则空字符串"
    }
  ]
}
messages 长度必须为 6。targetModule 只能是以下之一或 null：
${WAR_ROOM_MODULE_KEYS.join(', ')}`;

export const WAR_ROOM_ROUND_SYSTEM_PROMPT = `你是创业实训「虚拟董事会」辩论编排助手。根据项目资料与 SWOT/4P/财务信息，生成一轮六顶思考帽董事会讨论。

规则：
1. 每条消息对应一个帽子角色，严格按用户提示中的本轮发言顺序依次输出 6 条。
2. 讨论围绕商业模式画布九要素，可互相回应、追问，语气像真实会议，避免模板腔。
3. 白帽先摆事实；中间帽子可赞同或质疑前文；蓝帽最后总结并 @学生姓名 邀请其提问或补充。
4. 当某条建议可写入画布某一格时，填 targetModule 与 moduleContent（moduleContent 为可直接替换该格的全文，条理清晰）。
5. 黄帽与黑帽可搭配：先机会再风险，或针对前文风险再谈机会。

${WAR_ROOM_ROUND_JSON_SCHEMA}`;

export const WAR_ROOM_SINGLE_REPLY_SCHEMA = `
输出且仅输出一个 JSON 对象：
{
  "hat": "white|red|black|yellow|green|blue",
  "content": "回复正文",
  "targetModule": "九格键名或 null",
  "moduleContent": "替换用要点或空字符串"
}`;

export const WAR_ROOM_SINGLE_REPLY_SYSTEM_PROMPT = `你是虚拟董事会中的单一角色，根据对话历史与学生最新发言，以该角色身份回复一条消息。

${WAR_ROOM_SINGLE_REPLY_SCHEMA}`;

function formatTranscriptForPrompt(messages, maxChars = 12000) {
  const list = Array.isArray(messages) ? messages : [];
  const lines = list.map((m) => {
    const role = m.hat === 'user' ? '学生' : HAT_ROLE_TEXT[m.hat]?.slice(0, 8) || m.hat;
    return `[${role}] ${String(m.content || '').trim()}`;
  });
  let text = lines.join('\n\n');
  if (text.length > maxChars) text = `${text.slice(-maxChars)}\n（更早记录已省略）`;
  return text || '（尚无历史发言）';
}

function workspaceSummary(swot, marketing, finance) {
  const parts = [];
  if (swot && typeof swot === 'object') {
    parts.push(
      `【SWOT】优势：${swot.strengths || '（空）'}\n劣势：${swot.weaknesses || '（空）'}\n机会：${swot.opportunities || '（空）'}\n威胁：${swot.threats || '（空）'}`
    );
  }
  if (marketing && typeof marketing === 'object') {
    parts.push(
      `【4P】产品：${marketing.product || '（空）'}\n价格：${marketing.price || '（空）'}\n渠道：${marketing.place || '（空）'}\n推广：${marketing.promotion || '（空）'}`
    );
  }
  if (finance?.costs?.length || finance?.revenues?.length) {
    const costNames = (finance.costs || []).map((c) => `${c.category}:${c.name}`).join('、');
    const revNames = (finance.revenues || []).map((r) => r.source).join('、');
    parts.push(`【财务条目】成本项：${costNames || '（无）'}；收入项：${revNames || '（无）'}`);
  } else {
    parts.push('【财务条目】（尚未填写）');
  }
  return parts.join('\n\n');
}

export function buildWarRoomRoundUserPrompt({
  bundleText,
  swot,
  marketing,
  finance,
  transcriptMessages,
  roundIndex,
  hatOrder,
  studentDisplayName,
  canvasSnapshot,
}) {
  const orderDesc = hatOrder
    .map((h, i) => `${i + 1}. ${h}（${HAT_ROLE_TEXT[h]?.split('：')[0] || h}）`)
    .join('\n');
  const canvasLines = WAR_ROOM_MODULE_KEYS.map((k) => {
    const cell = canvasSnapshot?.[k];
    const c = cell?.content ? String(cell.content).trim() : '';
    return `- ${k}：${c || '（空）'}`;
  }).join('\n');

  return `【项目与前期资料】
${String(bundleText || '').trim()}

${workspaceSummary(swot, marketing, finance)}

【当前画布九格】
${canvasLines}

【辩论历史】
${formatTranscriptForPrompt(transcriptMessages)}

【本轮要求】
- 轮次：第 ${roundIndex + 1} 轮
- 本轮 6 条消息的发言顺序（必须严格按此顺序生成 messages 数组）：
${orderDesc}
- 学生显示名：${studentDisplayName || '同学'}（蓝帽末条请 @${studentDisplayName || '同学'} 邀请提问）
- 讨论须紧扣画布九要素，至少 3 条消息应带 targetModule 与可采纳的 moduleContent`;
}

export function buildWarRoomSingleReplyUserPrompt({
  bundleText,
  swot,
  marketing,
  finance,
  transcriptMessages,
  mentionedHat,
  userMessage,
  studentDisplayName,
  canvasSnapshot,
}) {
  const canvasLines = WAR_ROOM_MODULE_KEYS.map((k) => {
    const cell = canvasSnapshot?.[k];
    return `- ${k}：${cell?.content?.trim() || '（空）'}`;
  }).join('\n');

  return `【项目与前期资料】
${String(bundleText || '').trim()}

${workspaceSummary(swot, marketing, finance)}

【当前画布】
${canvasLines}

【辩论历史】
${formatTranscriptForPrompt(transcriptMessages)}

【学生发言】@${studentDisplayName || '同学'}：${String(userMessage || '').trim()}

【你的角色】${HAT_ROLE_TEXT[mentionedHat] || mentionedHat}

请以该角色身份回复一条消息，回应学生并推进画布讨论。`;
}

function normalizeHat(h) {
  const s = String(h || '').trim().toLowerCase();
  if (['white', 'red', 'black', 'yellow', 'green', 'blue'].includes(s)) return s;
  if (s.includes('白')) return 'white';
  if (s.includes('红')) return 'red';
  if (s.includes('黑')) return 'black';
  if (s.includes('黄')) return 'yellow';
  if (s.includes('绿')) return 'green';
  if (s.includes('蓝')) return 'blue';
  return null;
}

function normalizeModuleKey(k) {
  const s = String(k || '').trim();
  if (!s || s === 'null') return null;
  if (WAR_ROOM_MODULE_KEYS.includes(s)) return s;
  return null;
}

export function parseWarRoomRoundFromLlmText(text, expectedOrder) {
  let parsed = extractJsonFromLlmText(text);
  if (!parsed?.messages) {
    const all = findAllBalancedJsonObjects(String(text || ''));
    for (let i = all.length - 1; i >= 0; i--) {
      if (Array.isArray(all[i]?.messages)) {
        parsed = all[i];
        break;
      }
    }
  }
  if (!parsed?.messages || !Array.isArray(parsed.messages)) {
    return { error: 'AI 返回格式无效' };
  }
  const raw = parsed.messages.slice(0, 6);
  if (raw.length !== 6) return { error: '须返回 6 条发言' };

  const messages = raw.map((item, idx) => {
    const hat = normalizeHat(item.hat) || expectedOrder[idx];
    const targetModule = normalizeModuleKey(item.targetModule);
    let moduleContent = String(item.moduleContent || '').trim();
    if (!targetModule) moduleContent = '';
    return {
      hat,
      content: String(item.content || '').trim(),
      targetModule,
      moduleContent,
    };
  });

  for (let i = 0; i < 6; i++) {
    if (messages[i].hat !== expectedOrder[i]) {
      messages[i].hat = expectedOrder[i];
    }
    if (!messages[i].content) return { error: `第 ${i + 1} 条发言内容为空` };
  }

  return { messages };
}

export function parseWarRoomSingleReplyFromLlmText(text, mentionedHat) {
  let parsed = extractJsonFromLlmText(text);
  if (!parsed?.content) {
    const all = findAllBalancedJsonObjects(String(text || ''));
    for (let i = all.length - 1; i >= 0; i--) {
      if (all[i]?.content) {
        parsed = all[i];
        break;
      }
    }
  }
  if (!parsed?.content) return { error: 'AI 返回格式无效' };
  const hat = normalizeHat(parsed.hat) || mentionedHat;
  const targetModule = normalizeModuleKey(parsed.targetModule);
  let moduleContent = String(parsed.moduleContent || '').trim();
  if (!targetModule) moduleContent = '';
  return {
    message: {
      hat,
      content: String(parsed.content).trim(),
      targetModule,
      moduleContent,
    },
  };
}

export function parseMentionedHatFromText(text) {
  const t = String(text || '');
  const patterns = [
    { re: /@\s*白帽|@white/i, hat: 'white' },
    { re: /@\s*红帽|@red/i, hat: 'red' },
    { re: /@\s*黑帽|@black/i, hat: 'black' },
    { re: /@\s*黄帽|@yellow/i, hat: 'yellow' },
    { re: /@\s*绿帽|@green/i, hat: 'green' },
    { re: /@\s*蓝帽|@blue/i, hat: 'blue' },
  ];
  for (const p of patterns) {
    if (p.re.test(t)) return p.hat;
  }
  return null;
}
