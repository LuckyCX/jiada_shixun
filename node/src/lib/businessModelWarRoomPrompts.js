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
  black: `黑帽（风险预警员）：指出关键约束与风险前提，并给出可写入画布的调整建议（分阶段收入、试点客户、保守条目等）；禁止只做否定、不下结论、不给可采纳写法。`,
  yellow: `黄帽（乐观倡导者）：挖掘优势、用户痛点、机会点、盈利模式亮点、增长可能，并推动某一格可落地的表述。`,
  green: `绿帽（创意设计师）：提出差异化创意：产品优化、新玩法/渠道/盈利模式、与竞品不同点，尽量对应具体画布格。`,
  blue: `蓝帽（项目经理）：控场与总结。引导讨论、追问关键信息，总结已解决与待解决问题，建议下一步并推动九格补全。`,
};

export const WAR_ROOM_ROUND_JSON_SCHEMA = `{
  "messages": [
    {
      "hat": "white|red|black|yellow|green|blue",
      "content": "发言正文",
      "targetModule": "九格键名或 null",
      "moduleContent": "当 targetModule 非 null 时的替换全文，否则空字符串"
    }
  ]
}
固定约束：messages 长度必须恰好为 6；hat 顺序必须与用户提示中的本轮发言顺序完全一致；禁止增删键。
targetModule 只能是以下之一或 null：
${WAR_ROOM_MODULE_KEYS.join(', ')}`;

export const WAR_ROOM_ROUND_SYSTEM_PROMPT = `你是创业实训「虚拟董事会」协作填画布助手。

#Context#
根据项目资料与 SWOT/4P/财务信息，生成一轮六顶思考帽讨论，帮助学生形成可落地的商业模式画布九格。

#Objective#
输出恰好 6 条消息的 JSON，对应本轮固定帽子顺序。

#Style#
${HAT_ROLE_TEXT.white}
${HAT_ROLE_TEXT.red}
${HAT_ROLE_TEXT.black}
${HAT_ROLE_TEXT.yellow}
${HAT_ROLE_TEXT.green}
${HAT_ROLE_TEXT.blue}

#Schema#
${WAR_ROOM_ROUND_JSON_SCHEMA}

#Response#
1. 每条消息对应一个帽子，严格按用户提示中的本轮发言顺序。
2. 白帽先摆事实；中间帽子推进某一格表述；蓝帽最后总结并 @学生姓名。
3. 可写入画布时填 targetModule + moduleContent（全文可直接替换该格）。
4. 黑帽须给出可落地修正方向，禁止只否定。
5. 单条 content 约 150–280 字。
6. 只能输出 messages 一个顶层键的 JSON，禁止 markdown。`;

export const WAR_ROOM_SINGLE_REPLY_SCHEMA = `{
  "hat": "white|red|black|yellow|green|blue",
  "content": "回复正文",
  "targetModule": "九格键名或 null",
  "moduleContent": "单格替换用要点或空字符串",
  "fills": [
    { "targetModule": "九格键名", "moduleContent": "可直接写入该格的全文" }
  ]
}
固定约束：上述五键必须齐全；fills 可为 []，但学生要求填格时不得为空。
targetModule 只能是：
${WAR_ROOM_MODULE_KEYS.join(', ')}`;

export const WAR_ROOM_SINGLE_REPLY_SYSTEM_PROMPT = `你是虚拟董事会中的单一角色。

#Context#
根据对话历史与学生最新发言，以该角色身份回复，协作填充商业模式画布九格。

#Objective#
输出单条回复 JSON；若学生要求填写画布，必须给出可写入内容。

#Schema#
${WAR_ROOM_SINGLE_REPLY_SCHEMA}

#Response#
- 建设性、可落地，非反方辩论。
- 学生提到画布模块/九格/填写某要素时，fills（或 targetModule+moduleContent）必须有可一键写入内容。
- 只能输出 schema 规定键，禁止 markdown。`;

const MODULE_HINT_ZH = {
  customerSegments: '客户细分',
  valueProposition: '价值主张',
  channels: '渠道通路',
  customerRelationships: '客户关系',
  revenueStreams: '收入来源',
  keyResources: '核心资源',
  keyActivities: '关键业务',
  keyPartnerships: '合作伙伴',
  costStructure: '成本结构',
};

export function detectModuleKeysFromUserText(text) {
  const t = String(text || '');
  const rules = [
    { keys: ['keyPartnerships'], re: /合作伙伴|合作方|关键合作/i },
    { keys: ['revenueStreams'], re: /收入来源|收入流|营收|盈利模式/i },
    { keys: ['customerSegments'], re: /客户细分|目标客户|用户群/i },
    { keys: ['valueProposition'], re: /价值主张/i },
    { keys: ['channels'], re: /渠道通路|渠道/i },
    { keys: ['customerRelationships'], re: /客户关系/i },
    { keys: ['keyResources'], re: /核心资源/i },
    { keys: ['keyActivities'], re: /关键业务|关键活动/i },
    { keys: ['costStructure'], re: /成本结构|成本/i },
  ];
  const found = [];
  for (const { keys, re } of rules) {
    if (re.test(t)) found.push(...keys);
  }
  return [...new Set(found)];
}

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
- 讨论须紧扣画布九要素，至少 3 条消息应带 targetModule 与可采纳的 moduleContent
- 黑帽等角色禁止纯否定；须推动可写入九格的可行表述`;
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

${(() => {
  const keys = detectModuleKeysFromUserText(userMessage);
  if (!keys.length) return '';
  const labels = keys.map((k) => MODULE_HINT_ZH[k] || k).join('、');
  return `【学生本轮涉及的画布格】${labels}（键名：${keys.join(', ')}）。请在 fills 中为每一格分别填写 moduleContent，使学生可点击采纳写入。`;
})()}

请以该角色身份回复一条消息，回应学生并推进画布讨论。黑帽须带可采纳的修正建议，勿只做否定。`;
}

function collectFillsFromParsed(parsed) {
  const fills = [];
  const push = (targetModule, moduleContent) => {
    const k = normalizeModuleKey(targetModule);
    const c = String(moduleContent || '').trim();
    if (!k || !c) return;
    if (fills.some((x) => x.targetModule === k)) return;
    fills.push({ targetModule: k, moduleContent: c });
  };
  if (Array.isArray(parsed.fills)) {
    for (const f of parsed.fills) {
      push(f?.targetModule, f?.moduleContent);
    }
  }
  push(parsed.targetModule, parsed.moduleContent);
  return fills;
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
  const fills = collectFillsFromParsed(parsed);
  const targetModule = fills[0]?.targetModule || null;
  const moduleContent = fills[0]?.moduleContent || '';
  return {
    message: {
      hat,
      content: String(parsed.content).trim(),
      targetModule,
      moduleContent,
      fills: fills.length ? fills : undefined,
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
