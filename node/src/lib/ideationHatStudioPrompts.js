import { extractJsonFromLlmText, findAllBalancedJsonObjects } from './marketResearchSse.js';
import { SIX_HATS_ORDER, normalizeSixHat } from './sixHatsSession.js';

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

/** @deprecated 使用 SIX_HATS_ORDER；保留导出避免旧引用报错 */
export function buildHatStudioRoundOrder() {
  return [...SIX_HATS_ORDER];
}

export function shuffleMiddleHatOrder() {
  return ['green', 'yellow', 'black', 'red'];
}

/**
 * 提问不代改：各帽只抛出苏格拉底式问题，引导学生自查，不给标准答案、不直接改方案
 */
export const HAT_ROLE_TEXT = {
  white: `白帽（客观事实思维｜补信息）：聚焦事实、数据、已知信息，不做主观评判。引导学生区分「主观猜想」和「客观可验证信息」，找出缺少的资料、数据、前提条件。提问句式：你有哪些可验证的数据？这个说法依据是什么？还缺少哪些信息？`,
  green: `绿帽（发散创新思维｜找创新）：鼓励发散、跳出固有方案，挖掘创意可能性、替代方案、差异化亮点，不否定原有想法。提问句式：还有别的实现方式吗？可以增加什么新亮点？有没有不一样的解决思路？`,
  yellow: `黄帽（正向价值思维｜判价值）：挖掘项目的价值、优势、收益，思考为什么可行、用户能获得什么价值。提问句式：这个方案最大的价值是什么？用户为什么愿意选择你？长期能带来什么收益？`,
  black: `黑帽（风险批判思维｜查风险）：理性审视隐患、短板、潜在风险，识别方案漏洞与落地障碍，审慎评估而非抬杠。提问句式：这个方案最大隐患是什么？哪一步最容易出问题？有哪些不可控因素？`,
  red: `红帽（用户共情思维｜贴需求）：关注感受、情绪、直觉，站在用户视角体会好恶与真实感受。提问句式：用户看到这个方案第一感受是什么？用户会担心什么？什么场景下用户会抵触？`,
  blue: `蓝帽（全局系统思维｜做统筹）：把控整体框架，整合前面各帽结论，规划后续行动，收敛思路。提问句式：综合前面分析，当前最大问题是什么？下一步优先做什么？整体框架如何调整？`,
};

export const HAT_STUDIO_ASK_SCHEMA = `{
  "hat": "white|green|yellow|black|red|blue",
  "content": "面向学生的提问正文（可含 1～3 个编号追问）",
  "questions": ["追问1", "追问2", "追问3"]
}
固定约束：hat 必须与指定角色一致；questions 长度 1～3；content 须把追问组织成可读段落；禁止给出标准答案或直接改写创业方案；禁止 markdown 代码块。`;

export const HAT_STUDIO_ASK_SYSTEM_PROMPT = `你是创业实训「六帽创想室」中的单一思考帽。

#原则#
提问不代改：只抛出问题引导学生思考、自查，绝不直接修改创业方案、不给标准答案、不替学生填写工作区。

#Objective#
以指定帽子视角，一次性提出最多 3 个苏格拉底式追问。

#Style#
（只能扮演用户提示【你的角色】，禁止串戏）
${HAT_ROLE_TEXT.white}
${HAT_ROLE_TEXT.green}
${HAT_ROLE_TEXT.yellow}
${HAT_ROLE_TEXT.black}
${HAT_ROLE_TEXT.red}
${HAT_ROLE_TEXT.blue}

#Schema#
${HAT_STUDIO_ASK_SCHEMA}

#Response#
- 紧扣学生创意与完整辩论历史
- 最多 3 个问题，问题要具体、可作答
- 只能输出 schema 规定键的 JSON`;

export const HAT_STUDIO_SINGLE_REPLY_SCHEMA = `{
  "hat": "white|green|yellow|black|red|blue",
  "content": "回复正文（继续提问引导，或简要承接后追问）",
  "targetModule": "工作区键名或 null",
  "moduleContent": "可选：学生可自行采纳的摘录短句，禁止整段代写终稿",
  "fills": [
    { "targetModule": "工作区键名", "moduleContent": "可选摘录" }
  ]
}
固定约束：hat/content 必填；fills 可为 []；禁止给出标准答案或直接改写整份方案。
targetModule 只能是：
${HAT_STUDIO_DRAFT_KEYS.join(', ')}`;

export const HAT_STUDIO_SINGLE_REPLY_SYSTEM_PROMPT = `你是六帽创想室中的单一角色。

#原则#
提问不代改：承接学生回答后继续用问题引导，或简要复述学生要点后追问；不替学生改方案。

#Objective#
输出单条回复 JSON。

#Style#
（只能扮演【你的角色】，禁止串戏）
${Object.values(HAT_ROLE_TEXT).join('\n')}

#Schema#
${HAT_STUDIO_SINGLE_REPLY_SCHEMA}

#Response#
- 严格按角色视角
- 优先提问引导；fills 仅在学生表述已很清晰时可给出简短摘录供其自行采纳
- 禁止 markdown`;

/** 兼容旧 round 系统提示（已改为顺序单帽追问，保留常量名） */
export const HAT_STUDIO_ROUND_SYSTEM_PROMPT = HAT_STUDIO_ASK_SYSTEM_PROMPT;
export const HAT_STUDIO_ROUND_JSON_SCHEMA = HAT_STUDIO_ASK_SCHEMA;

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
    const role = m.hat === 'user' ? '学生' : HAT_ROLE_TEXT[m.hat]?.slice(0, 12) || m.hat;
    return `[${role}] ${String(m.content || '').trim()}`;
  });
  let text = lines.join('\n\n');
  if (text.length > maxChars) text = `${text.slice(-maxChars)}\n（更早记录已省略）`;
  return text || '（尚无历史发言）';
}

function draftLinesOf(draftSnapshot) {
  return HAT_STUDIO_DRAFT_KEYS.map((k) => {
    const cell = draftSnapshot?.[k];
    const c = cell?.content ? String(cell.content).trim() : '';
    return `- ${k}（${HAT_STUDIO_DRAFT_LABELS[k]}）：${c || '（空）'}`;
  }).join('\n');
}

/** 当前帽抛出最多 3 个追问 */
export function buildHatStudioAskUserPrompt({
  contextText,
  priorStageText,
  transcriptMessages,
  activeHat,
  studentDisplayName,
  draftSnapshot,
}) {
  return `【团队创意库参考】
${String(contextText || '').trim() || '（尚无已入库创意）'}

【前置实训文本产物（不含上传文件）】
${String(priorStageText || '').trim() || '（暂无）'}

【当前工作区（仅供参考，勿代填）】
${draftLinesOf(draftSnapshot)}

【辩论历史（须完整承接）】
${formatTranscriptForPrompt(transcriptMessages)}

【你的角色】${HAT_ROLE_TEXT[activeHat] || activeHat}

【任务】
面向 ${studentDisplayName || '同学'}，以该帽视角一次性提出最多 3 个苏格拉底式追问，帮助学生自查创业设想。提问不代改。`;
}

export function buildHatStudioSingleReplyUserPrompt({
  contextText,
  priorStageText,
  transcriptMessages,
  mentionedHat,
  userMessage,
  studentDisplayName,
  draftSnapshot,
}) {
  return `【团队创意与背景】
${String(contextText || '').trim() || '（尚无已入库创意）'}

【前置实训文本产物（不含上传文件）】
${String(priorStageText || '').trim() || '（暂无）'}

【当前工作区】
${draftLinesOf(draftSnapshot)}

【辩论历史】
${formatTranscriptForPrompt(transcriptMessages)}

【学生发言】@${studentDisplayName || '同学'}：${String(userMessage || '').trim()}

【你的角色】${HAT_ROLE_TEXT[mentionedHat] || mentionedHat}

请以该角色身份回复：承接学生回答并继续提问引导（提问不代改）。可附极简 fills 摘录供学生自行写入工作区，勿整段代写。`;
}

/** @deprecated 旧整轮 6 帽；现转为单帽追问 prompt */
export function buildHatStudioRoundUserPrompt(args) {
  return buildHatStudioAskUserPrompt({
    ...args,
    activeHat: args.hatOrder?.[0] || args.activeHat || 'white',
    priorStageText: args.priorStageText || '',
  });
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

function normalizeDraftKey(k) {
  const s = String(k || '').trim();
  if (!s || s === 'null') return null;
  if (HAT_STUDIO_DRAFT_KEYS.includes(s)) return s;
  const byLabel = Object.entries(HAT_STUDIO_DRAFT_LABELS).find(([, v]) => v === s);
  return byLabel ? byLabel[0] : null;
}

export function parseHatStudioAskFromLlmText(text, expectedHat) {
  let parsed = extractJsonFromLlmText(text);
  if (!parsed?.content && !Array.isArray(parsed?.questions)) {
    const all = findAllBalancedJsonObjects(String(text || ''));
    for (let i = all.length - 1; i >= 0; i--) {
      if (all[i]?.content || Array.isArray(all[i]?.questions)) {
        parsed = all[i];
        break;
      }
    }
  }
  const hat = normalizeSixHat(parsed?.hat) || expectedHat;
  let questions = Array.isArray(parsed?.questions)
    ? parsed.questions.map((q) => String(q || '').trim()).filter(Boolean).slice(0, 3)
    : [];
  let content = String(parsed?.content || '').trim();
  if (!content && questions.length) {
    content = questions.map((q, i) => `${i + 1}. ${q}`).join('\n');
  }
  if (!content) return { error: 'AI 返回格式无效' };
  if (!questions.length) {
    // 从 content 拆编号问句，兜底
    const lines = content.split(/\n+/).map((l) => l.replace(/^\d+[\.\)、]\s*/, '').trim()).filter(Boolean);
    questions = lines.slice(0, 3);
  }
  return {
    message: {
      hat,
      content,
      questions,
      targetModule: null,
      moduleContent: '',
    },
  };
}

/** 兼容旧 parseHatStudioRoundFromLlmText：改为单条 ask 消息 */
export function parseHatStudioRoundFromLlmText(text, expectedOrder) {
  const hat = Array.isArray(expectedOrder) ? expectedOrder[0] : expectedOrder;
  const r = parseHatStudioAskFromLlmText(text, hat || 'white');
  if (r.error) return r;
  return { messages: [r.message] };
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
  const hat = normalizeSixHat(parsed.hat) || mentionedHat;
  const fills = collectFillsFromParsed(parsed);
  return {
    message: {
      hat,
      content: String(parsed.content).trim(),
      targetModule: fills[0]?.targetModule || null,
      moduleContent: fills[0]?.moduleContent || '',
      fills: fills.length ? fills : undefined,
    },
  };
}

export function parseMentionedHatFromText(text) {
  const t = String(text || '');
  const patterns = [
    { re: /@\s*白帽|@white/i, hat: 'white' },
    { re: /@\s*绿帽|@green/i, hat: 'green' },
    { re: /@\s*黄帽|@yellow/i, hat: 'yellow' },
    { re: /@\s*黑帽|@black/i, hat: 'black' },
    { re: /@\s*红帽|@red/i, hat: 'red' },
    { re: /@\s*蓝帽|@blue/i, hat: 'blue' },
  ];
  for (const p of patterns) {
    if (p.re.test(t)) return p.hat;
  }
  return null;
}

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
