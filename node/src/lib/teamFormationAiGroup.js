import { chatCompletionStream, getPromptModules, logPromptToConsole } from './llmGateway.js';
import { TEAM_ROLE_LABELS } from './teamFormationConstants.js';
import { logError } from './logError.js';

const MIN_TEAM_SIZE = 3;
const MAX_TEAM_SIZE = 6;
const MIN_PENDING_FOR_AI = 5;

export { MIN_TEAM_SIZE, MAX_TEAM_SIZE, MIN_PENDING_FOR_AI };

export const DEFAULT_AI_GROUP_SYSTEM = `你是创业实训平台的组队编排顾问。

#Context#
根据每名学生的 AI 匹配角色与三大能力维度得分，将待组队学生划分为若干创业小组。

#Objective#
输出分组 JSON，覆盖全部待组队学生。

#Schema#
{"teams":[{"name":"创意队名","memberStudentIds":["学号或id字符串"],"rationale":"简短分组理由"}]}

#Response#
硬性规则：
- 每个小组 3～6 人。
- 必须覆盖输入中每一名学生，且每人恰好属于一个小组。
- 组内 aiMatchedRole 尽量互不相同；无法消重时允许同角色。
- 待分组 3～6 人时优先合并为 1 组。
- 只使用提供的角色与分数，不依据姓名猜测。
- 队名 2～12 字，勿用「团队1」编号式。
- 只能输出 teams 一个顶层键的 JSON，禁止 markdown，禁止输出平均分等额外字段。`;

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

function roleKeyOf(studentById, studentId) {
  return String(studentById.get(String(studentId))?.aiMatchedRole || '').trim().toLowerCase();
}

function teamHasRole(team, role, studentById) {
  if (!role) return false;
  return team.memberIds.some((id) => roleKeyOf(studentById, id) === role);
}

/** 将 AI 分组结果修补为合法：每组 3～6 人、全员入组；优先角色不重复，不足时随机并入（允许重复） */
export function repairAiTeamsToValidShape(teamList, pendingStudents) {
  const allIds = pendingStudents.map((s) => String(s.id));
  const studentById = new Map(pendingStudents.map((s) => [String(s.id), s]));
  const idSet = new Set(allIds);
  const assigned = new Set();

  const teams = [];
  for (let i = 0; i < (teamList || []).length; i++) {
    const t = teamList[i];
    const memberIds = [];
    for (const raw of t.memberIds || t.memberStudentIds || []) {
      const id = String(raw);
      if (!idSet.has(id) || assigned.has(id)) continue;
      assigned.add(id);
      memberIds.push(id);
    }
    if (memberIds.length) {
      teams.push({
        name: String(t.name || `团队 ${teams.length + 1}`).trim() || `团队 ${teams.length + 1}`,
        rationale: String(t.rationale || '').trim(),
        sortOrder: teams.length,
        memberIds,
      });
    }
  }

  let pool = allIds.filter((id) => !assigned.has(id));

  const trimOverflow = () => {
    for (const team of teams) {
      while (team.memberIds.length > MAX_TEAM_SIZE) {
        pool.push(team.memberIds.pop());
      }
    }
  };

  const disbandSmallTeams = () => {
    const kept = [];
    for (const team of teams) {
      if (team.memberIds.length >= MIN_TEAM_SIZE) kept.push(team);
      else pool.push(...team.memberIds);
    }
    teams.length = 0;
    teams.push(...kept);
  };

  const placePool = (preferUniqueRole) => {
    shuffleInPlace(pool);
    for (let i = 0; i < pool.length; ) {
      const id = pool[i];
      const role = roleKeyOf(studentById, id);
      const candidates = shuffleInPlace([...teams]).filter((t) => t.memberIds.length < MAX_TEAM_SIZE);
      let placed = false;
      for (const team of candidates) {
        if (preferUniqueRole && role && teamHasRole(team, role, studentById)) continue;
        team.memberIds.push(id);
        pool.splice(i, 1);
        placed = true;
        break;
      }
      if (!placed) i++;
    }
  };

  const formNewTeamsFromPool = () => {
    while (pool.length >= MIN_TEAM_SIZE) {
      const memberIds = [];
      shuffleInPlace(pool);
      while (memberIds.length < MIN_TEAM_SIZE && pool.length) {
        let idx = pool.findIndex((id) => {
          const r = roleKeyOf(studentById, id);
          return !r || !memberIds.some((mid) => roleKeyOf(studentById, mid) === r);
        });
        if (idx < 0) idx = 0;
        memberIds.push(pool.splice(idx, 1)[0]);
      }
      while (memberIds.length < MAX_TEAM_SIZE && pool.length) {
        let idx = pool.findIndex((id) => {
          const r = roleKeyOf(studentById, id);
          return !r || !memberIds.some((mid) => roleKeyOf(studentById, mid) === r);
        });
        if (idx < 0) break;
        memberIds.push(pool.splice(idx, 1)[0]);
      }
      teams.push({
        name: `团队 ${teams.length + 1}`,
        rationale: '',
        sortOrder: teams.length,
        memberIds,
      });
    }
  };

  trimOverflow();
  disbandSmallTeams();
  placePool(true);
  placePool(false);
  formNewTeamsFromPool();
  placePool(true);
  placePool(false);
  trimOverflow();
  disbandSmallTeams();

  const everyone = [...new Set([...teams.flatMap((t) => t.memberIds), ...pool])];
  if (everyone.length !== allIds.length) {
    pool = allIds.filter((id) => !teams.flatMap((t) => t.memberIds).includes(id));
  }

  if (
    pool.length &&
    teams.length &&
    everyone.length <= MAX_TEAM_SIZE * Math.max(teams.length, 1)
  ) {
    placePool(false);
  }

  if (everyone.length >= MIN_TEAM_SIZE && everyone.length <= MAX_TEAM_SIZE) {
    const single = {
      name: teams[0]?.name || '新建团队',
      rationale: teams[0]?.rationale || '',
      sortOrder: 0,
      memberIds: [...allIds],
    };
    return [single];
  }

  if (!teams.length && pool.length >= MIN_TEAM_SIZE) {
    formNewTeamsFromPool();
  }

  if (pool.length) {
    placePool(false);
    if (pool.length >= MIN_TEAM_SIZE) formNewTeamsFromPool();
    else if (pool.length && teams.length) {
      for (const id of [...pool]) {
        const t = teams.find((x) => x.memberIds.length < MAX_TEAM_SIZE);
        if (t) {
          t.memberIds.push(id);
          pool = pool.filter((x) => x !== id);
        }
      }
    }
  }

  disbandSmallTeams();
  if (teams.some((t) => t.memberIds.length < MIN_TEAM_SIZE) || pool.length) {
    return buildTeamsGreedyFromIds(allIds, studentById, teams[0]?.name);
  }

  return teams.map((t, i) => ({ ...t, sortOrder: i }));
}

function buildTeamsGreedyFromIds(allIds, studentById, preferredName) {
  const teams = [];
  let pool = shuffleInPlace([...allIds]);
  while (pool.length >= MIN_TEAM_SIZE) {
    const memberIds = [];
    while (memberIds.length < MIN_TEAM_SIZE && pool.length) {
      let idx = pool.findIndex((id) => {
        const r = roleKeyOf(studentById, id);
        return !r || !memberIds.some((mid) => roleKeyOf(studentById, mid) === r);
      });
      if (idx < 0) idx = 0;
      memberIds.push(pool.splice(idx, 1)[0]);
    }
    while (memberIds.length < MAX_TEAM_SIZE && pool.length) {
      let idx = pool.findIndex((id) => {
        const r = roleKeyOf(studentById, id);
        return !r || !memberIds.some((mid) => roleKeyOf(studentById, mid) === r);
      });
      if (idx < 0) idx = 0;
      memberIds.push(pool.splice(idx, 1)[0]);
    }
    teams.push({
      name: teams.length === 0 && preferredName ? preferredName : `团队 ${teams.length + 1}`,
      rationale: '',
      sortOrder: teams.length,
      memberIds,
    });
  }
  if (pool.length && teams.length) {
    for (const id of pool) {
      const t = teams.find((x) => x.memberIds.length < MAX_TEAM_SIZE) || teams[teams.length - 1];
      t.memberIds.push(id);
    }
  } else if (pool.length && allIds.length >= MIN_TEAM_SIZE && allIds.length <= MAX_TEAM_SIZE) {
    return [
      {
        name: preferredName || '新建团队',
        rationale: '',
        sortOrder: 0,
        memberIds: [...allIds],
      },
    ];
  }
  return teams.map((t, i) => ({ ...t, sortOrder: i }));
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
export async function runAiTeamGroupingStream(provider, pendingStudents, handlers = {}, options = {}) {
  const minPending = options.minPending ?? MIN_PENDING_FOR_AI;
  if (pendingStudents.length < minPending) {
    throw new Error(`待组队学生至少 ${minPending} 人`);
  }
  const prompts = await getPromptModules();
  const tf = prompts.team_formation || {};
  const system = String(tf.ai_group_system || DEFAULT_AI_GROUP_SYSTEM).trim();
  const payload = buildStudentsPayloadForAi(pendingStudents);
  const n = pendingStudents.length;
  const incrementalNote = options.incrementalOnly
    ? `\n\n说明：仅为以下 ${n} 名剩余待组队学生新建小组，勿涉及或修改已有团队。` +
      ` 每人必须且仅能出现一次。每组必须 3～6 人：` +
      (n <= MAX_TEAM_SIZE
        ? `当前 ${n} 人请优先输出 1 个小组（memberStudentIds 包含全部 ${n} 人），不要拆成多个不足 3 人的小组。`
        : `请拆成若干组且每组 3～6 人。`) +
      ` 组内角色尽量互不相同；若无法避免重复，也须满足人数规则。`
    : '';
  const user = `${String(tf.ai_group_user_template || '请为以下待组队学生划分小组（JSON 输出）：').trim()}${incrementalNote}\n\n${JSON.stringify({ students: payload, rules: { minPerTeam: MIN_TEAM_SIZE, maxPerTeam: MAX_TEAM_SIZE } }, null, 2)}`;

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
  const teams = parseAiGroupingFromText(fullText, pendingStudents);
  handlers.onStatus?.('分组结果已校验并自动调剂完成');
  return teams;
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
  let mapped = repairAiTeamsToValidShape(resolvedTeams, pendingStudents);
  mapped = enforceUniqueRolesPerTeam(mapped, pendingStudents);
  mapped = repairAiTeamsToValidShape(mapped, pendingStudents);

  const recheck = validateAiTeams(
    mapped.map((t) => ({
      name: t.name,
      memberStudentIds: t.memberIds,
      rationale: t.rationale,
    })),
    allIds
  );
  if (!recheck.ok) {
    mapped = repairAiTeamsToValidShape(
      mapped.map((t) => ({ name: t.name, memberIds: t.memberIds, rationale: t.rationale })),
      pendingStudents
    );
  }
  return mapped;
}

/** @deprecated 请使用 runAiTeamGroupingStream */
export async function runAiTeamGrouping(provider, pendingStudents) {
  return runAiTeamGroupingStream(provider, pendingStudents, {});
}
