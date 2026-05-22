import { chatCompletionStream, getPromptModules, logPromptToConsole } from './llmGateway.js';
import { TEAM_ROLE_LABELS } from './teamFormationConstants.js';
import { logError } from './logError.js';

const MIN_TEAM_SIZE = 3;
const MAX_TEAM_SIZE = 6;
const MIN_PENDING_FOR_AI = 5;

export { MIN_TEAM_SIZE, MAX_TEAM_SIZE, MIN_PENDING_FOR_AI };

export const DEFAULT_AI_GROUP_SYSTEM = `你是创业实训平台的组队编排顾问。根据每名学生的 AI 匹配角色与三大能力维度得分，将待组队学生划分为若干创业小组。

硬性规则：
- 每个小组 3～6 人。
- 必须覆盖输入中的每一名待组队学生，且每人恰好属于一个小组。
- 每个小组内 aiMatchedRole 必须互不相同，禁止同一小组出现两名相同角色（如两个 CEO）。
- 若因人数或角色分布导致无法完全避免重复，优先在组间调配；仍无法消重时，将多出的同角色学生随机并入尚有空位且该角色尚未占满的小组。
- 优先保证组内角色互补，三维得分（战略统筹 strategic、市场运营 market、技术风控 techRisk）组内应有差异以形成互补。
- 不要依据学生姓名猜测，只使用提供的角色与分数。
- 不要输出团队平均能力或互补得分，仅输出分组 JSON。
- 每个小组的 name 须由你创意命名（2～12 字，积极有创业感，勿用「团队1」等编号式名称，可结合组内角色/能力特点）。

仅输出一个 JSON 对象，不要 markdown，格式：
{"teams":[{"name":"创意队名","memberStudentIds":["学号或id字符串",...],"rationale":"简短分组理由"}]}`;

export function buildStudentsPayloadForAi(students) {
  return students.map((s) => ({
    studentId: s.studentId || s.id,
    id: s.id,
    name: s.name,
    aiMatchedRole: s.aiMatchedRole,
    aiMatchedRoleLabel: s.aiMatchedRoleLabel || TEAM_ROLE_LABELS[s.aiMatchedRole] || s.aiMatchedRole,
    dimensionScores: s.profile || s.dimensionProfile || { strategic: 0, market: 0, techRisk: 0 },
  }));
}

export function extractAiGroupJson(text) {
  const t = String(text || '').trim();
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      /* ignore */
    }
  }
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(t.slice(start, end + 1));
    } catch {
      /* ignore */
    }
  }
  return null;
}

/**
 * 将 LLM 返回的 memberStudentIds 解析为内部 student id（支持 id 或学号）
 */
export function resolveMemberIds(memberIds, studentsById, studentsByNo) {
  const out = [];
  for (const raw of memberIds || []) {
    const key = String(raw).trim();
    if (!key) continue;
    if (studentsById.has(key)) {
      out.push(key);
      continue;
    }
    if (studentsByNo.has(key)) {
      out.push(studentsByNo.get(key));
      continue;
    }
  }
  return [...new Set(out)];
}

export function validateAiTeams(teams, allStudentIds) {
  const assigned = new Set();
  const parsed = [];
  if (!Array.isArray(teams) || teams.length === 0) {
    return { ok: false, message: 'AI 未返回有效 teams 数组' };
  }
  for (let i = 0; i < teams.length; i++) {
    const t = teams[i];
    const ids = Array.isArray(t.memberStudentIds) ? t.memberStudentIds.map(String) : [];
    if (ids.length < MIN_TEAM_SIZE || ids.length > MAX_TEAM_SIZE) {
      return { ok: false, message: `第 ${i + 1} 组人数须在 ${MIN_TEAM_SIZE}～${MAX_TEAM_SIZE} 人` };
    }
    parsed.push({
      name: String(t.name || `团队 ${i + 1}`).trim() || `团队 ${i + 1}`,
      memberStudentIds: ids,
      rationale: String(t.rationale || '').trim(),
    });
    for (const id of ids) {
      if (assigned.has(id)) return { ok: false, message: '存在学生被分到多个小组' };
      assigned.add(id);
    }
  }
  for (const sid of allStudentIds) {
    if (!assigned.has(String(sid))) {
      return { ok: false, message: '存在学生未被分到任何小组' };
    }
  }
  return { ok: true, teams: parsed };
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 组内角色去重；溢出成员随机插入仍有空位的组 */
export function enforceUniqueRolesPerTeam(teamList, pendingStudents) {
  const studentById = new Map(pendingStudents.map((s) => [String(s.id), s]));
  const teams = teamList.map((t) => ({
    name: t.name,
    rationale: t.rationale,
    sortOrder: t.sortOrder,
    memberIds: [...(t.memberIds || [])],
  }));
  const overflow = [];

  for (const team of teams) {
    const kept = [];
    const rolesSeen = new Set();
    for (const id of team.memberIds) {
      const role = String(studentById.get(String(id))?.aiMatchedRole || '').toLowerCase();
      if (!role || !rolesSeen.has(role)) {
        if (role) rolesSeen.add(role);
        kept.push(String(id));
      } else {
        overflow.push(String(id));
      }
    }
    team.memberIds = kept;
  }

  shuffleInPlace(overflow);
  for (const id of overflow) {
    const role = String(studentById.get(id)?.aiMatchedRole || '').toLowerCase();
    const candidates = shuffleInPlace([...teams]).filter((t) => t.memberIds.length < MAX_TEAM_SIZE);
    let placed = false;
    for (const team of candidates) {
      const hasRole =
        role &&
        team.memberIds.some((mid) => String(studentById.get(mid)?.aiMatchedRole || '').toLowerCase() === role);
      if (!hasRole) {
        team.memberIds.push(id);
        placed = true;
        break;
      }
    }
    if (!placed) {
      const withSpace = teams.filter((t) => t.memberIds.length < MAX_TEAM_SIZE);
      if (withSpace.length) {
        withSpace[Math.floor(Math.random() * withSpace.length)].memberIds.push(id);
      }
    }
  }

  const unassigned = pendingStudents
    .map((s) => String(s.id))
    .filter((id) => !teams.some((t) => t.memberIds.includes(id)));
  for (const id of unassigned) {
    const withSpace = teams.filter((t) => t.memberIds.length < MAX_TEAM_SIZE);
    if (withSpace.length) {
      withSpace[Math.floor(Math.random() * withSpace.length)].memberIds.push(id);
    }
  }

  return teams;
}

export function pickDefaultLeaderStudentId(memberIds, pendingStudents) {
  const studentById = new Map(pendingStudents.map((s) => [String(s.id), s]));
  const ceo = memberIds.find((id) => String(studentById.get(String(id))?.aiMatchedRole || '').toLowerCase() === 'ceo');
  return ceo ? String(ceo) : memberIds.length ? String(memberIds[0]) : null;
}

function forwardStreamChunk(text, handlers, state) {
  if (!text) return;
  let chunk = text;
  const thinkOpen = ['<', 'think', '>'].join('');
  const thinkClose = ['<', '/', 'think', '>'].join('');
  if (chunk.includes(thinkOpen)) {
    state.inThinkingTag = true;
    chunk = chunk.split(thinkOpen).join('');
  }
  if (chunk.includes(thinkClose)) {
    state.inThinkingTag = false;
    const parts = chunk.split(thinkClose);
    if (parts[0]) handlers.onThinking?.(parts[0]);
    chunk = parts.slice(1).join(thinkClose);
  }
  if (state.inThinkingTag) handlers.onThinking?.(chunk);
  else if (chunk) handlers.onContent?.(chunk);
}

/**
 * 流式调用模型分组；团队平均三维由业务侧按成员 dimensionScores 求均，不由 AI 计算。
 */
export async function runAiTeamGroupingStream(provider, pendingStudents, handlers = {}) {
  if (pendingStudents.length < MIN_PENDING_FOR_AI) {
    throw new Error(`待组队学生至少 ${MIN_PENDING_FOR_AI} 人`);
  }
  const prompts = await getPromptModules();
  const tf = prompts.team_formation || {};
  const system = String(tf.ai_group_system || DEFAULT_AI_GROUP_SYSTEM).trim();
  const payload = buildStudentsPayloadForAi(pendingStudents);
  const user = `${String(tf.ai_group_user_template || '请为以下待组队学生划分小组（JSON 输出）：').trim()}\n\n${JSON.stringify({ students: payload, rules: { minPerTeam: MIN_TEAM_SIZE, maxPerTeam: MAX_TEAM_SIZE } }, null, 2)}`;

  logPromptToConsole(provider, system, user);
  handlers.onStatus?.('正在连接模型进行智能分组…');

  const streamState = { inThinkingTag: false };
  let fullText = '';
  try {
    fullText = await chatCompletionStream({
      provider,
      system,
      user,
      onEvent: ({ kind, text }) => {
        if (!text) return;
        if (kind === 'thinking') {
          handlers.onThinking?.(text);
          return;
        }
        fullText += text;
        forwardStreamChunk(text, handlers, streamState);
      },
    });
  } catch (e) {
    logError('runAiTeamGroupingStream', e);
    throw e;
  }

  handlers.onStatus?.('正在解析分组结果…');
  return parseAiGroupingFromText(fullText, pendingStudents);
}

function parseAiGroupingFromText(raw, pendingStudents) {
  const parsed = extractAiGroupJson(raw);
  if (!parsed?.teams) throw new Error('AI 返回格式无效');

  const studentsById = new Map(pendingStudents.map((s) => [String(s.id), s]));
  const studentsByNo = new Map(
    pendingStudents.filter((s) => s.studentId).map((s) => [String(s.studentId), String(s.id)])
  );

  const resolvedTeams = parsed.teams.map((t) => ({
    name: t.name,
    rationale: t.rationale,
    memberIds: resolveMemberIds(t.memberStudentIds, studentsById, studentsByNo),
  }));

  const allIds = pendingStudents.map((s) => String(s.id));
  const flatCheck = validateAiTeams(
    resolvedTeams.map((t) => ({ name: t.name, memberStudentIds: t.memberIds, rationale: t.rationale })),
    allIds
  );
  if (!flatCheck.ok) throw new Error(flatCheck.message);

  const mapped = flatCheck.teams.map((t, idx) => ({
    name: t.name,
    rationale: t.rationale,
    memberIds: resolveMemberIds(t.memberStudentIds, studentsById, studentsByNo),
    sortOrder: idx,
  }));

  const balanced = enforceUniqueRolesPerTeam(mapped, pendingStudents);
  const recheck = validateAiTeams(
    balanced.map((t) => ({
      name: t.name,
      memberStudentIds: t.memberIds,
      rationale: t.rationale,
    })),
    allIds
  );
  if (!recheck.ok) throw new Error(recheck.message || '分组结果校验失败');
  return balanced;
}

/** @deprecated 请使用 runAiTeamGroupingStream */
export async function runAiTeamGrouping(provider, pendingStudents) {
  return runAiTeamGroupingStream(provider, pendingStudents, {});
}
