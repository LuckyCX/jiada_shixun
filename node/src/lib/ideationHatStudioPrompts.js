import { extractJsonFromLlmText, findAllBalancedJsonObjects } from './marketResearchSse.js';

/** 六帽创想室工作区字段（讨论过程用，最终入库创意库） */
export const HAT_STUDIO_DRAFT_KEYS = [
  'ideaTitle',
  'problemInsight',
  'userValue',
  'solutionPoints',
  'riskDiff',
];

export const HAT_STUDIO_DRAFT_LABELS = {
  ideaTitle: '创意标题',
  problemInsight: '问题洞察',
  userValue: '用户价值',
  solutionPoints: '方案要点',
  riskDiff: '风险与差异',
};

const MIDDLE_HATS = ['red', 'black', 'yellow', 'green'];

export function shuffleMiddleHatOrder() {
  const arr = [...MIDDLE_HATS];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 每轮：白 → 中间四帽随机 → 蓝 */
export function buildHatStudioRoundOrder() {
  return ['white', ...shuffleMiddleHatOrder(), 'blue'];
}

export const HAT_ROLE_TEXT = {
  white: `白帽（数据分析师）：只基于客观事实和数据发言。补充目标场景规模、用户行为线索、同类方案公开信息等可验证事实，不主观评价。`,
  red: `红帽（用户代表）：以目标用户身份谈第一感受：会不会想用、哪里别扭、最在意什么体验。少讲大道理。`,
  black: `黑帽（风险预警员）：指出关键约束与风险，并给出可写入工作区的调整建议；禁止只做否定、不给可采纳写法。`,
  yellow: `黄帽（乐观倡导者）：挖掘优势、痛点机会、差异亮点，并推动某一工作区字段的可落地表述。`,
  green: `绿帽（创意设计师）：提出差异化创意：功能玩法、触达路径、与竞品不同点，尽量对应具体工作区字段。`,
  blue: `蓝帽（项目经理）：控场与总结。引导讨论、追问关键信息，总结已解决与待解决问题，建议下一步并推动工作区补全。`,
};

export const HAT_STUDIO_ROUND_JSON_SCHEMA = `{
  "messages": [
    {
      "hat": "white|red|black|yellow|green|blue",
      "content": "发言正文",
      "targetModule": "工作区键名或 null",
      "moduleContent": "当 targetModule 非 null 时的替换全文，否则空字符串"
    }
  ]
}
固定约束：messages 长度必须恰好为 6；hat 顺序必须与用户提示中的本轮发言顺序完全一致；禁止增删键。
targetModule 只能是以下之一或 null：
${HAT_STUDIO_DRAFT_KEYS.join(', ')}`;

export const HAT_STUDIO_ROUND_SYSTEM_PROMPT = `你是创业实训「六帽创想室」协作助手。

#Context#
学生会先陈述自己的创意，再由六顶思考帽围绕其内容做引导式讨论。请完整阅读辩论历史中的学生发言，不得忽略或遗忘其已表达的创意要点。

#Objective#
输出恰好 6 条消息的 JSON，对应本轮固定帽子顺序；讨论必须紧扣学生创意，并产出可一键写入工作区的要点。

#Style#
${HAT_ROLE_TEXT.white}
${HAT_ROLE_TEXT.red}
${HAT_ROLE_TEXT.black}
${HAT_ROLE_TEXT.yellow}
${HAT_ROLE_TEXT.green}
${HAT_ROLE_TEXT.blue}

#Schema#
${HAT_STUDIO_ROUND_JSON_SCHEMA}

#Response#
1. 每条消息对应一个帽子，严格按用户提示中的本轮发言顺序。
2. 白帽先基于学生创意摆事实与澄清；中间帽子推进某一工作区字段；蓝帽最后总结并 @学生姓名，给出下一步追问。
3. 至少 4 条消息应带 targetModule + moduleContent（可直接替换对应工作区字段的短文，勿空泛）。
4. 黑帽须给出可落地修正方向，禁止只否定。
5. 单条 content 约 100–220 字；要承接历史对话，避免重复已确认结论。
6. 只能输出 messages 一个顶层键的 JSON，禁止 markdown。`;

export const HAT_STUDIO_SINGLE_REPLY_SCHEMA = `{
  "hat": "white|red|black|yellow|green|blue",
  "content": "回复正文",
  "targetModule": "工作区键名或 null",
  "moduleContent": "单字段替换用要点或空字符串",
  "fills": [
    { "targetModule": "工作区键名", "moduleContent": "可直接写入该字段的全文" }
  ]
}
固定约束：上述五键必须齐全；fills 可为 []，但学生要求填写工作区时不得为空。
targetModule 只能是：
${HAT_STUDIO_DRAFT_KEYS.join(', ')}`;

export const HAT_STUDIO_SINGLE_REPLY_SYSTEM_PROMPT = `你是六帽创想室中的单一角色。

#Context#
学生可在多轮对话中 @ 某一顶帽子追问。请阅读完整辩论历史，紧扣学生已陈述的创意与最新问题作答，不得丢失上下文。

#Objective#
输出单条回复 JSON；尽量给出可写入工作区的 fills，便于学生一键采纳。

#Style#
（只能扮演用户提示【你的角色】中的那一顶帽子，禁止串戏）
${HAT_ROLE_TEXT.white}
${HAT_ROLE_TEXT.red}
${HAT_ROLE_TEXT.black}
${HAT_ROLE_TEXT.yellow}
${HAT_ROLE_TEXT.green}
${HAT_ROLE_TEXT.blue}

#Schema#
${HAT_STUDIO_SINGLE_REPLY_SCHEMA}

#Response#
- 必须严格按【你的角色】人设发言：语气、视角、关注点都要像该帽，不得混成其他帽子或通用助教口吻。
- 建设性、可落地，非反方辩论；承接历史已讨论内容。
- 优先填写 fills（或 targetModule+moduleContent），给出可一键写入工作区的短文。
- 只能输出 schema 规定键，禁止 markdown。`;

export function detectDraftKeysFromUserText(text) {
  const t = String(text || '');
  const rules = [
    { keys: ['ideaTitle'], re: /标题|取名|叫什么|命名/i },
    { keys: ['problemInsight'], re: /问题|痛点|洞察|困难/i },
    { keys: ['userValue'], re: /用户价值|价值|为什么用|收益/i },
    { keys: ['solutionPoints'], re: /方案|解决方案|怎么做|功能/i },
    { keys: ['riskDiff'], re: /风险|差异|竞品|劣势|优势/i },
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

export function buildHatStudioRoundUserPrompt({
  contextText,
  transcriptMessages,
  roundIndex,
  hatOrder,
  studentDisplayName,
  draftSnapshot,
}) {
  const orderDesc = hatOrder
    .map((h, i) => `${i + 1}. ${h}（${HAT_ROLE_TEXT[h]?.split('：')[0] || h}）`)
    .join('\n');
  const draftLines = HAT_STUDIO_DRAFT_KEYS.map((k) => {
    const cell = draftSnapshot?.[k];
    const c = cell?.content ? String(cell.content).trim() : '';
    return `- ${k}（${HAT_STUDIO_DRAFT_LABELS[k]}）：${c || '（空）'}`;
  }).join('\n');

  const latestUser = [...(transcriptMessages || [])]
    .reverse()
    .find((m) => m.hat === 'user');
  const latestUserText = String(latestUser?.content || '').trim();

  return `【团队创意库参考】
${String(contextText || '').trim() || '（尚无已入库创意）'}

【当前工作区】
${draftLines}

【辩论历史（须完整承接，勿遗忘学生已说内容）】
${formatTranscriptForPrompt(transcriptMessages)}

【学生本轮创意/发言（本轮讨论的核心依据）】
${latestUserText || '（学生尚未发言，请等待学生描述创意）'}

【本轮要求】
- 轮次：第 ${roundIndex + 1} 轮（引导式连续对话，保留全部上下文）
- 本轮 6 条消息的发言顺序（必须严格按此顺序生成 messages 数组）：
${orderDesc}
- 学生显示名：${studentDisplayName || '同学'}（蓝帽末条请 @${studentDisplayName || '同学'}，邀请其补充或选择采纳到工作区）
- 必须紧扣「学生本轮创意/发言」与历史对话；提炼标题/问题/用户价值/方案/风险等可写入点
- 至少 4 条消息应带 targetModule 与可采纳的 moduleContent
- 黑帽等角色禁止纯否定；须推动可写入工作区的可行表述`;
}

export function buildHatStudioSingleReplyUserPrompt({
  contextText,
  transcriptMessages,
  mentionedHat,
  userMessage,
  studentDisplayName,
  draftSnapshot,
}) {
  const draftLines = HAT_STUDIO_DRAFT_KEYS.map((k) => {
    const cell = draftSnapshot?.[k];
    return `- ${k}（${HAT_STUDIO_DRAFT_LABELS[k]}）：${cell?.content?.trim() || '（空）'}`;
  }).join('\n');

  return `【团队创意与背景】
${String(contextText || '').trim() || '（尚无已入库创意）'}

【当前工作区】
${draftLines}

【辩论历史】
${formatTranscriptForPrompt(transcriptMessages)}

【学生发言】@${studentDisplayName || '同学'}：${String(userMessage || '').trim()}

【你的角色】${HAT_ROLE_TEXT[mentionedHat] || mentionedHat}

${(() => {
  const keys = detectDraftKeysFromUserText(userMessage);
  if (!keys.length) return '';
  const labels = keys.map((k) => HAT_STUDIO_DRAFT_LABELS[k] || k).join('、');
  return `【学生本轮涉及的工作区】${labels}（键名：${keys.join(', ')}）。请在 fills 中为每一字段分别填写 moduleContent，使学生可点击采纳写入。`;
})()}

请以该角色身份回复一条消息，回应学生并推进创意工作区讨论。黑帽须带可采纳的修正建议，勿只做否定。`;
}

function collectFillsFromParsed(parsed) {
  const fills = [];
  const push = (targetModule, moduleContent) => {
    const k = normalizeDraftKey(targetModule);
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

function normalizeDraftKey(k) {
  const s = String(k || '').trim();
  if (!s || s === 'null') return null;
  if (HAT_STUDIO_DRAFT_KEYS.includes(s)) return s;
  const byLabel = Object.entries(HAT_STUDIO_DRAFT_LABELS).find(([, v]) => v === s);
  return byLabel ? byLabel[0] : null;
}

export function parseHatStudioRoundFromLlmText(text, expectedOrder) {
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
    const targetModule = normalizeDraftKey(item.targetModule);
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

export function parseHatStudioSingleReplyFromLlmText(text, mentionedHat) {
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

/** 工作区拼成入库用的 title / description */
export function draftToIdeaFields(draft) {
  const get = (k) => String(draft?.[k]?.content || '').trim();
  const ideaTitle = get('ideaTitle');
  const parts = [
    get('problemInsight') && `问题洞察：${get('problemInsight')}`,
    get('userValue') && `用户价值：${get('userValue')}`,
    get('solutionPoints') && `方案要点：${get('solutionPoints')}`,
    get('riskDiff') && `风险与差异：${get('riskDiff')}`,
  ].filter(Boolean);
  return {
    ideaTitle,
    title: ideaTitle,
    description: parts.join('\n') || ideaTitle,
    problemInsight: get('problemInsight'),
    userValue: get('userValue'),
    solutionPoints: get('solutionPoints'),
    riskDiff: get('riskDiff'),
  };
}
