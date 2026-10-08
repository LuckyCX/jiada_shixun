/**
 * 《AI+创新创业理论与实践》课程创业计划书固定模板小节
 * 侧栏分组仅用于展示；可编辑内容只有 leaf 小节。
 */

export const BUSINESS_PLAN_SECTION_GROUPS = [
  { key: 'g1', title: '一、市场调研与用户画像' },
  { key: 'g2', title: '二、产品设计：传承与创新' },
  { key: 'g3', title: '三、商业模式与营销策略' },
  { key: 'g4', title: '四、财务成本分析' },
];

/** @type {{ key: string, title: string, groupKey: string, guide: string }[]} */
export const BUSINESS_PLAN_SECTION_DEFS = [
  {
    key: 's1_1',
    title: '1.1 市场痛点与机会分析',
    groupKey: 'g1',
    guide: '说明目标用户面临的核心痛点、未被满足的需求，以及由此产生的市场机会。',
  },
  {
    key: 's1_2',
    title: '1.2 目标市场界定与规模预估',
    groupKey: 'g1',
    guide: '界定目标市场边界（地域/人群/场景），并给出可核对的规模预估与依据。',
  },
  {
    key: 's1_3',
    title: '1.3 主要竞争对手与替代品分析',
    groupKey: 'g1',
    guide: '梳理主要竞品与替代方案，对比产品、定价、渠道与优劣势。',
  },
  {
    key: 's1_4_1',
    title: '1.4.1 基本信息（年龄、职业、收入、地域等）',
    groupKey: 'g1',
    guide: '为 1～2 个典型用户角色填写基本人口与社会属性信息。',
  },
  {
    key: 's1_4_2',
    title: '1.4.2 用户场景与核心需求',
    groupKey: 'g1',
    guide: '描述典型使用场景、触发条件与核心待办/需求。',
  },
  {
    key: 's1_4_3',
    title: '1.4.3 消费行为与价值观洞察',
    groupKey: 'g1',
    guide: '分析消费决策偏好、价格敏感度与价值观取向。',
  },
  {
    key: 's2_1',
    title: '2.1 产品/服务核心价值主张',
    groupKey: 'g2',
    guide: '一句话到一段话说清为谁、解决什么、独特价值是什么。',
  },
  {
    key: 's2_2',
    title: '2.2 “传承”要素分析',
    groupKey: 'g2',
    guide: '说明对经典文化、传统工艺、现有技术或既有模式的继承点。',
  },
  {
    key: 's2_3',
    title: '2.3 “创新”要素设计',
    groupKey: 'g2',
    guide: '说明功能、技术、设计、体验或商业模式上的创新点。',
  },
  {
    key: 's2_4',
    title: '2.4 产品描述与原型展示',
    groupKey: 'g2',
    guide: '描述产品形态与关键功能；可图文结合说明原型/界面/流程。',
  },
  {
    key: 's3_1',
    title: '3.1 商业模式画布',
    groupKey: 'g3',
    guide: '围绕客户细分、价值主张、渠道、收入与成本等要素说明商业模式。',
  },
  {
    key: 's3_2_1',
    title: '3.2.1 产品策略（线规划、品牌故事）',
    groupKey: 'g3',
    guide: '说明产品线规划、品牌定位与品牌故事。',
  },
  {
    key: 's3_2_2',
    title: '3.2.2 价格策略（定价方法与依据）',
    groupKey: 'g3',
    guide: '给出定价方法、价格带及依据（成本、竞品、用户支付意愿等）。',
  },
  {
    key: 's3_2_3',
    title: '3.2.3 渠道策略（线上线下销售/分发渠道）',
    groupKey: 'g3',
    guide: '说明线上线下销售或分发渠道选择与协同方式。',
  },
  {
    key: 's3_2_4',
    title: '3.2.4 推广策略（启动期关键活动与预算分配）',
    groupKey: 'g3',
    guide: '列出启动期关键推广活动及预算分配思路。',
  },
  {
    key: 's4_1_1',
    title: '4.1.1 固定成本（场地、设备、人员工资等）',
    groupKey: 'g4',
    guide: '列出主要固定成本项及粗略金额区间。',
  },
  {
    key: 's4_1_2',
    title: '4.1.2 可变成本（原材料、生产、营销费用等）',
    groupKey: 'g4',
    guide: '列出随销量变化的主要可变成本项。',
  },
  {
    key: 's4_2',
    title: '4.2 启动资金需求预估',
    groupKey: 'g4',
    guide: '汇总启动阶段资金需求，说明用途构成。',
  },
  {
    key: 's4_3',
    title: '4.3 盈亏平衡点初步测算',
    groupKey: 'g4',
    guide: '给出盈亏平衡点的初步测算思路与结果（可含假设说明）。',
  },
];

export function defaultSections() {
  return BUSINESS_PLAN_SECTION_DEFS.map((d) => ({
    key: d.key,
    title: d.title,
    content: '',
    guide: d.guide,
  }));
}

/**
 * 始终按固定模板顺序合并：同 key 保留 content，未知旧 key 丢弃
 * @param {unknown} input
 */
export function coerceSections(input) {
  const byKey = new Map();
  if (Array.isArray(input)) {
    for (const raw of input) {
      const key = String(raw?.key || '').trim();
      if (!key || byKey.has(key)) continue;
      byKey.set(key, String(raw?.content ?? ''));
    }
  }
  return BUSINESS_PLAN_SECTION_DEFS.map((d) => ({
    key: d.key,
    title: d.title,
    content: byKey.has(d.key) ? byKey.get(d.key) : '',
    guide: d.guide,
  }));
}

/** @deprecated 使用 coerceSections；保留别名便于路由层语义 */
export function mergeWithTemplate(input) {
  return coerceSections(input);
}

export function sectionsToFullText(sections) {
  return coerceSections(sections)
    .filter((s) => String(s.content || '').trim())
    .map((s) => `${s.title}\n\n${String(s.content || '').trim()}`)
    .join('\n\n');
}

export function countCompletedSections(sections) {
  return coerceSections(sections).filter((s) => String(s.content || '').trim().length > 0).length;
}

/** 空封面结构（members 长度由实际组队人数决定，默认空数组） */
export function defaultCover() {
  return {
    projectName: '',
    leader: '',
    members: [],
    collegeClass: '',
    advisor: '',
    dateYear: '',
    dateMonth: '',
    dateDay: '',
  };
}

/**
 * @param {unknown} raw
 */
export function coerceCover(raw) {
  const base = defaultCover();
  if (!raw || typeof raw !== 'object') return base;
  const o = raw;
  const membersIn = Array.isArray(o.members) ? o.members : [];
  // 保留实际成员槽位数，不再固定垫成 5 人
  const members = membersIn.map((m) => String(m ?? '').trim());
  return {
    projectName: String(o.projectName ?? '').trim(),
    leader: String(o.leader ?? '').trim(),
    members,
    collegeClass: String(o.collegeClass ?? '').trim(),
    advisor: String(o.advisor ?? '').trim(),
    dateYear: String(o.dateYear ?? '').trim(),
    dateMonth: String(o.dateMonth ?? '').trim(),
    dateDay: String(o.dateDay ?? '').trim(),
  };
}

/** 封面日期始终取当前本地时间对应的年月日 */
export function currentCoverDateParts(now = new Date()) {
  return {
    dateYear: String(now.getFullYear()),
    dateMonth: String(now.getMonth() + 1),
    dateDay: String(now.getDate()),
  };
}

/**
 * 用班级/组队/选题信息补齐封面只读字段
 * - 组长/成员/班级/教师/日期：始终以系统数据为准
 * - 项目名称：第二步选题有值则锁定；否则保留学生已填值
 * @param {ReturnType<typeof coerceCover>} cover
 * @param {{
 *   classMeta: { collegeClass: string, advisor: string },
 *   teamMembers: Array<{ id: string, name: string, studentNo: string, isLeader: boolean }>,
 *   isSolo: boolean,
 *   topicProjectName?: string,
 * }} meta
 */
export function enrichCoverWithTeamMeta(cover, meta) {
  const next = coerceCover(cover);
  const classMeta = meta?.classMeta || { collegeClass: '', advisor: '' };
  next.collegeClass = String(classMeta.collegeClass || '').trim();
  next.advisor = String(classMeta.advisor || '').trim();

  const teamMembers = Array.isArray(meta?.teamMembers) ? meta.teamMembers : [];
  const isSolo = Boolean(meta?.isSolo) || teamMembers.length <= 1;
  const leader = teamMembers.find((m) => m.isLeader) || teamMembers[0] || null;
  // 排除负责人本人，避免成员栏重复显示组长
  const others = isSolo ? [] : teamMembers.filter((m) => !leader || String(m.id) !== String(leader.id));

  const formatPerson = (m) => {
    if (!m) return '';
    const name = String(m.name || '').trim();
    const no = String(m.studentNo || '').trim();
    return no ? `${name} ${no}` : name;
  };

  next.leader = formatPerson(leader);
  next.members = others.map((m) => formatPerson(m));

  const topicName = String(meta?.topicProjectName || '').trim();
  if (topicName) next.projectName = topicName;

  Object.assign(next, currentCoverDateParts());
  return next;
}
