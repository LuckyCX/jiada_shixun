import { extractJsonFromLlmText, findAllBalancedJsonObjects } from './marketResearchSse.js';
import { SIX_HATS_ORDER, normalizeSixHat } from './sixHatsSession.js';

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

/** @deprecated */
export function shuffleMiddleHatOrder() {
  return ['green', 'yellow', 'black', 'red'];
}

/** 固定顺序：白→绿→黄→黑→红→蓝 */
export function buildRoundHatOrder() {
  return [...SIX_HATS_ORDER];
}

export const HAT_ROLE_TEXT = {
  white: `白帽（客观事实思维｜补信息）：聚焦事实、数据、已知信息，不做主观评判。引导学生区分猜想与可验证信息。提问句式：你有哪些可验证的数据？这个说法依据是什么？还缺少哪些信息？`,
  green: `绿帽（发散创新思维｜找创新）：鼓励发散，挖掘差异化与替代路径，不否定原想法。提问句式：还有别的实现方式吗？可以增加什么新亮点？`,
  yellow: `黄帽（正向价值思维｜判价值）：挖掘价值、优势、收益。提问句式：最大价值是什么？用户为什么选择你？长期收益是什么？`,
  black: `黑帽（风险批判思维｜查风险）：审慎识别隐患与障碍，不是抬杠。提问句式：最大隐患是什么？哪一步最容易出问题？`,
  red: `红帽（用户共情思维｜贴需求）：站在用户感受与情绪。提问句式：用户第一感受是什么？会担心什么？何时会抵触？`,
  blue: `蓝帽（全局系统思维｜做统筹）：整合各维结论，规划下一步。提问句式：当前最需优先解决什么？整体框架如何调整？下一步验证什么？`,
};

export const WAR_ROOM_ASK_SCHEMA = `{
  "hat": "white|green|yellow|black|red|blue",
  "content": "面向学生的提问正文（1～3 个追问）",
  "questions": ["追问1", "追问2", "追问3"]
}
固定约束：提问不代改；不直接修改商业方案、不给标准答案、不代填画布；questions 1～3 条。`;

export const WAR_ROOM_ASK_SYSTEM_PROMPT = `你是创业实训「虚拟董事会」中的单一思考帽。

#原则#
提问不代改：从六维验证创业点子，淘汰不靠谱想法、收敛可行方向；只提问引导学生自查。

#Objective#
以指定帽子视角提出最多 3 个苏格拉底式追问。

#Style#
${Object.values(HAT_ROLE_TEXT).join('\n')}

#Schema#
${WAR_ROOM_ASK_SCHEMA}

#Response#
只能输出 json 对象；禁止用 markdown 代码块包裹整个 JSON。content 字段正文可用 markdown（**加粗**、有序/无序列表、换行）。`;

export const WAR_ROOM_SINGLE_REPLY_SCHEMA = `{
  "hat": "white|green|yellow|black|red|blue",
  "content": "回复正文（承接后继续提问引导；可用 markdown）"
}
固定约束：禁止代填画布、禁止标准答案、禁止直接改写方案。`;

export const WAR_ROOM_SINGLE_REPLY_SYSTEM_PROMPT = `你是虚拟董事会中的单一角色。

#原则#
提问不代改。从该帽维度验证点子，引导学生自主研判。

#Style#
${Object.values(HAT_ROLE_TEXT).join('\n')}

#Schema#
${WAR_ROOM_SINGLE_REPLY_SCHEMA}

#Response#
只能输出 json 对象；禁止用 markdown 代码块包裹整个 JSON。content 字段正文可用 markdown（**加粗**、有序/无序列表）。严格按【你的角色】发言；承接历史；继续提问引导。`;

/** 兼容旧名 */
export const WAR_ROOM_ROUND_SYSTEM_PROMPT = WAR_ROOM_ASK_SYSTEM_PROMPT;
export const WAR_ROOM_ROUND_JSON_SCHEMA = WAR_ROOM_ASK_SCHEMA;

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
    const role = m.hat === 'user' ? '学生' : HAT_ROLE_TEXT[m.hat]?.slice(0, 12) || m.hat;
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

export function buildWarRoomAskUserPrompt({
  bundleText,
  swot,
  marketing,
  finance,
  transcriptMessages,
  activeHat,
  studentDisplayName,
}) {
  return `【项目与前期资料（文本产物，不含上传压缩包/原型文件）】
${String(bundleText || '').trim()}

${workspaceSummary(swot, marketing, finance)}

【辩论历史】
${formatTranscriptForPrompt(transcriptMessages)}

【你的角色】${HAT_ROLE_TEXT[activeHat] || activeHat}

【任务】
面向 ${studentDisplayName || '同学'}，以该帽视角提出最多 3 个苏格拉底式追问，从该维度验证创业点子。提问不代改，不代填画布。`;
}

export function buildWarRoomRoundUserPrompt(args) {
  return buildWarRoomAskUserPrompt({
    ...args,
    activeHat: args.hatOrder?.[0] || args.activeHat || 'white',
  });
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
}) {
  return `【项目与前期资料（文本产物，不含上传文件）】
${String(bundleText || '').trim()}

${workspaceSummary(swot, marketing, finance)}

【辩论历史】
${formatTranscriptForPrompt(transcriptMessages)}

【学生发言】@${studentDisplayName || '同学'}：${String(userMessage || '').trim()}

【你的角色】${HAT_ROLE_TEXT[mentionedHat] || mentionedHat}

请以该角色身份回复：承接学生回答并继续提问引导（提问不代改，不代填画布）。`;
}

export function parseWarRoomAskFromLlmText(text, expectedHat) {
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

export function parseWarRoomRoundFromLlmText(text, expectedOrder) {
  const hat = Array.isArray(expectedOrder) ? expectedOrder[0] : expectedOrder;
  const r = parseWarRoomAskFromLlmText(text, hat || 'white');
  if (r.error) return r;
  return { messages: [r.message] };
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
  if (!parsed?.content) {
    // 容错：纯文本
    const plain = String(text || '').trim();
    if (!plain) return { error: 'AI 返回格式无效' };
    return {
      message: {
        hat: mentionedHat,
        content: plain,
        targetModule: null,
        moduleContent: '',
      },
    };
  }
  return {
    message: {
      hat: normalizeSixHat(parsed.hat) || mentionedHat,
      content: String(parsed.content).trim(),
      targetModule: null,
      moduleContent: '',
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

export { MODULE_HINT_ZH };
