export const ROLE_SIMULATION_SYSTEM_PROMPT = `你是创业实训的 AI 仿真引擎（非成功学叙事生成器）。

#Context#
基于学生真实创业项目背景（项目主题、用户画像/调研结论与风险、商业画布、投入配置等）生成 30 天市场模拟。
必须结合项目真实约束做情景推演；市场有不确定性，**成功与失败都合理**，禁止无视背景的「万能成功」「一路飙升」叙事。

#Objective#
按「NDJSON / 逐行 JSON」输出：共 31 行——30 行 day + 1 行 final。
**每一行必须是完整且可独立 JSON.parse 的单行对象**；禁止把一个对象拆成多行美化缩进；禁止 Markdown 代码块。
先综合项目证据 + 用户消息中的【本轮仿真随机指令】判定主基调，再生成**有峰谷波动**的 30 天轨迹。

#Scenario（评判逻辑）
1. 先评估项目健康度信号（负向信号越多，越应中性/悲观）：
   - 负向：调研样本不足、付费意愿含糊、定价相对预算/CAC 过高、渠道失衡、竞品强、合规/供应链重、产品未验证、痛点不清等
   - 正向：清晰刚需、可验证转化、预算与定价匹配、差异化明确、已有种子用户证据等
2. 主基调（须与【本轮仿真随机指令】一致；证据极强时可上下微调一档，但**不可改成无波动的单调上升**）：
   - 乐观：整体可走通，可出现正向现金流，但必须有获客波动、转化回落、客服/库存小事故等挫折
   - 中性：增长缓慢、指标来回拉锯、优化效果有限，平台期与小回撤是常态
   - 悲观/失败：关键假设被证伪、获客失败、转化崩、资金链承压；允许长期亏损、用户停滞或回撤，**禁止第 30 天强行翻盘成功**
3. **字段语义（必须遵守，前端按累计曲线展示）**：
   - users：**累计用户**（含试用/注册/付费客户口径自洽即可）。有平台期；退款时可小幅回撤
   - revenue：**累计营收**（大体不减）。用平台期表达淡季
   - **严禁 users 与 revenue 锁步**：禁止几乎每天都满足 revenue ≈ users × 定价（两条曲线会变成同形缩放，不合格）
   - 必须制造「不同步」事件，例如：
     - 用户增加但营收不变：试用未付费、B 端意向未回款、仅加社群
     - 营收增加但用户不变：复购配件、订阅续费、老客加购、一客多套
     - 营收增速与用户增速不必同日、同幅度
   - cac / ltv / profit：与定价、预算大致自洽；profit 为当日盈亏口径（可正可负）
4. **曲线形态（常规早期创业）**：
   - 两条曲线都应有平台期，但**平台期位置不要完全重合**
   - 30 天内 users、revenue 各自至少约 6～8 天平台期
   - 禁止天天匀速 +1 用户且营收同步 +定价
   - 至少 8 天 profit 为负；事件密度克制
5. 若有上一轮摘要：本轮应体现迭代差异（可能更好也可能更差）。
6. day.notes 写具体因果；涉及试用/复购/多套采购时写清楚，以便解释曲线分叉。
7. final.optimize 给 3 条可执行建议；comparison 诚实对比。

#Schema#
day 行（整行一例，勿换行）：{"type":"day","day":8,"users":5,"revenue":958,"cac":180,"ltv":320,"profit":-200,"notes":"新增1名试用用户未付费，营收持平；前序累计营收958"}
（反例：users=5,revenue=1595 且定价319 → 5×319，锁步不合格）
final 行（整行一例，勿换行）：{"type":"final","optimize":{"suggestions":[{"title":"","desc":"","impact":""},{"title":"","desc":"","impact":""},{"title":"","desc":"","impact":""}],"comparison":{"current":{"summary":""},"optimized":{"summary":""}}}}

#Response#
1. 禁止 Markdown 代码块，禁止前言/后记，禁止任何非 JSON 行。
2. 先连续输出 day=1..30；最后一行 type=final。
3. 自检：①累计语义；②users/revenue 曲线不同步（不能整段都是 users×定价）；③各自有平台期。
4. 接力时累计值须承接已生成末日数据。`;

/**
 * 每轮仿真抽样主基调：略偏中性/失败，避免模型默认「一路上涨」
 * @returns {{ tone: 'optimistic'|'neutral'|'pessimistic', label: string, seed: string }}
 */
export function rollSimulationScenario() {
  const r = Math.random();
  const seed = Math.random().toString(36).slice(2, 8).toUpperCase();
  // 约 20% 乐观 / 40% 中性 / 40% 悲观
  if (r < 0.2) {
    return { tone: 'optimistic', label: '乐观（仍须有挫折与回撤）', seed };
  }
  if (r < 0.6) {
    return { tone: 'neutral', label: '中性偏谨慎（拉锯、平台期为主）', seed };
  }
  return { tone: 'pessimistic', label: '悲观/失败倾向（关键假设承压，禁止强行翻盘）', seed };
}

/**
 * 整形仿真轨迹：消除「当日营收锯齿」、强制用户/收入平台期，使曲线像常规创业
 * @param {object[]} days
 * @param {{ price?: number, tone?: string }} [opts]
 * @returns {object[]}
 */
/** 从配置价 / LTV / users×单价锁步关系推断单价，供去锁步使用 */
function inferUnitPrice(days, fallbackPrice = 0) {
  const cfg = Number(fallbackPrice || 0);
  if (cfg > 0) return cfg;
  const ltvs = days.map((d) => Number(d.ltv) || 0).filter((x) => x > 0).sort((a, b) => a - b);
  if (ltvs.length) return ltvs[Math.floor(ltvs.length / 2)];
  const ratios = [];
  for (const d of days) {
    const u = Number(d.users) || 0;
    const r = Number(d.revenue) || 0;
    if (u > 0 && r > 0 && r % u === 0) ratios.push(r / u);
  }
  if (ratios.length >= 3) {
    ratios.sort((a, b) => a - b);
    return ratios[Math.floor(ratios.length / 2)];
  }
  return 0;
}

export function normalizeSimulationDays(days, opts = {}) {
  const tone = String(opts.tone || 'neutral');
  const sorted = [...(Array.isArray(days) ? days : [])]
    .filter((d) => d && Number(d.day) > 0)
    .sort((a, b) => Number(a.day) - Number(b.day))
    .map((d) => ({
      ...d,
      type: 'day',
      day: Number(d.day),
      users: Math.max(0, Math.round(Number(d.users) || 0)),
      revenue: Math.max(0, Math.round(Number(d.revenue) || 0)),
      cac: Math.max(0, Math.round(Number(d.cac) || 0)),
      ltv: Math.max(0, Math.round(Number(d.ltv) || 0)),
      profit: Math.round(Number(d.profit) || 0),
      notes: String(d.notes || ''),
    }));
  if (sorted.length < 2) return sorted;
  const price = inferUnitPrice(sorted, opts.price);

  const revs = sorted.map((d) => d.revenue);
  const zeroCount = revs.filter((r) => r === 0).length;
  let flip = 0;
  for (let i = 1; i < revs.length; i += 1) {
    if ((revs[i] === 0) !== (revs[i - 1] === 0)) flip += 1;
  }
  let decreases = 0;
  for (let i = 1; i < revs.length; i += 1) {
    if (revs[i] + 1 < revs[i - 1]) decreases += 1;
  }
  // 大量隔日归零，或频繁回落 → 按「当日营收」理解并转为累计
  const looksDaily = zeroCount >= Math.floor(sorted.length * 0.25) || flip >= Math.floor(sorted.length * 0.4) || decreases >= 6;

  let daily = revs.slice();
  if (looksDaily) {
    // 填平锯齿：孤立的 0 夹在成交日之间 → 给温和小额成交
    for (let i = 0; i < daily.length; i += 1) {
      const prev = i > 0 ? daily[i - 1] : 0;
      const next = i < daily.length - 1 ? daily[i + 1] : 0;
      if (daily[i] === 0 && prev > 0 && next > 0) {
        const soft = Math.round(((prev + next) / 2) * 0.35);
        if (price > 0) {
          const units = Math.max(0, Math.round(soft / price));
          daily[i] = units > 0 ? units * price : 0;
        } else {
          daily[i] = soft;
        }
      }
    }
    // 压低夹在两个 0 之间的尖峰
    for (let i = 1; i < daily.length - 1; i += 1) {
      if (daily[i] > 0 && daily[i - 1] === 0 && daily[i + 1] === 0) {
        daily[i] = price > 0 ? price : Math.round(daily[i] * 0.5);
      }
    }
    let cum = 0;
    for (let i = 0; i < sorted.length; i += 1) {
      cum += Math.max(0, daily[i]);
      sorted[i].revenue = cum;
    }
  } else {
    // 已是累计：修正异常回落
    let maxR = 0;
    for (const d of sorted) {
      if (d.revenue < maxR) d.revenue = maxR;
      maxR = d.revenue;
    }
  }

  // 用户：几乎天天涨 → 插入平台期；累计不减（悲观剧本允许 1 次小回撤）
  let increaseDays = 0;
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].users > sorted[i - 1].users) increaseDays += 1;
  }
  if (increaseDays >= Math.floor(sorted.length * 0.65)) {
    for (let i = 2; i < sorted.length; i += 3) {
      sorted[i].users = sorted[i - 1].users;
    }
  }
  // 前向修复：保证大体非减
  let maxU = 0;
  let dipUsed = false;
  for (let i = 0; i < sorted.length; i += 1) {
    if (sorted[i].users < maxU) {
      if (tone === 'pessimistic' && !dipUsed && i > sorted.length * 0.5 && maxU - sorted[i].users <= 2) {
        dipUsed = true;
        maxU = sorted[i].users;
      } else {
        sorted[i].users = maxU;
      }
    }
    maxU = Math.max(maxU, sorted[i].users);
  }

  // 收入累计再插平台期：若爬升过密，隔几天冻住
  let revUpDays = 0;
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].revenue > sorted[i - 1].revenue) revUpDays += 1;
  }
  if (revUpDays >= Math.floor(sorted.length * 0.7)) {
    for (let i = 2; i < sorted.length; i += 2) {
      sorted[i].revenue = sorted[i - 1].revenue;
    }
    let maxR2 = 0;
    for (const d of sorted) {
      if (d.revenue < maxR2) d.revenue = maxR2;
      maxR2 = d.revenue;
    }
  }

  // 打破「revenue ≈ users × 定价」锁步，避免两条曲线同形
  return decorrelateUsersAndRevenue(sorted, { price, tone });
}

/**
 * 若绝大多数日子 revenue≈users×price，则按「试用/复购/多套」重算累计营收，使波形分叉
 * @param {object[]} days
 * @param {{ price?: number, tone?: string }} opts
 */
function decorrelateUsersAndRevenue(days, opts = {}) {
  const price = Number(opts.price || 0);
  const tone = String(opts.tone || 'neutral');
  if (!days.length) return days;
  if (!(price > 0)) return days;

  let lockstep = 0;
  for (const d of days) {
    if (Math.abs(Number(d.revenue) - Number(d.users) * price) <= Math.max(1, price * 0.05)) lockstep += 1;
  }
  // 未锁步则只做轻量分叉增强
  const heavilyLocked = lockstep >= Math.floor(days.length * 0.55);

  let revenue = 0;
  const out = days.map((d, i) => {
    const prevUsers = i > 0 ? Number(days[i - 1].users) || 0 : 0;
    const users = Number(d.users) || 0;
    const added = Math.max(0, users - prevUsers);
    const prevRevenue = revenue;

    if (heavilyLocked) {
      if (added > 0) {
        // 新增用户：部分当日转化，部分仅试用（用户涨、营收少涨或不涨）
        const convert = i % 3 === 0 ? 0 : Math.max(1, Math.round(added * (tone === 'optimistic' ? 0.9 : 0.65)));
        revenue += convert * price;
        // 偶发一客多套
        if (i % 11 === 0 && convert > 0) revenue += price;
      } else if (users > 0) {
        // 用户平台期：偶发复购/订阅/配件，使营收单独爬升
        if (i % 4 === 0) revenue += Math.round(price * (tone === 'pessimistic' ? 0.25 : 0.45));
        if (i % 9 === 0) revenue += price;
      }
    } else {
      // 轻度增强：若本日与 users×price 锁步且用户未变，尝试加一笔小复购
      const lockedToday = Math.abs(Number(d.revenue) - users * price) <= Math.max(1, price * 0.05);
      revenue = Math.max(revenue, Number(d.revenue) || 0);
      if (lockedToday && added === 0 && users > 0 && i % 5 === 0) {
        revenue += Math.round(price * 0.4);
      }
      if (lockedToday && added > 0 && i % 4 === 0) {
        // 用户增加但延迟确认收入：本日少计一单
        revenue = Math.max(prevRevenue, revenue - price);
      }
    }

    if (revenue < prevRevenue) revenue = prevRevenue;
    const next = { ...d, revenue: Math.round(revenue) };
    // notes 仅在我们改写锁步时补一句分叉说明（避免空 notes）
    if (heavilyLocked && added > 0 && revenue === prevRevenue && !/试用|未付费/.test(next.notes)) {
      next.notes = `${next.notes || ''}（新增试用未付费，营收持平）`.trim();
    } else if (heavilyLocked && added === 0 && revenue > prevRevenue && !/复购|配件|订阅|加购/.test(next.notes)) {
      next.notes = `${next.notes || ''}（老客复购/加购，用户数不变）`.trim();
    }
    return next;
  });

  // 最终单调修复
  let maxR = 0;
  for (const d of out) {
    if (d.revenue < maxR) d.revenue = maxR;
    maxR = d.revenue;
  }
  return out;
}

/**
 * 从流式文本缓冲抽出完整 JSON 对象（兼容单行 NDJSON 与多行美化输出）
 * @param {string} buffer
 * @returns {{ objects: object[], rest: string }}
 */
export function extractJsonObjectsFromBuffer(buffer) {
  const objects = [];
  const s = String(buffer || '');
  let i = 0;
  while (i < s.length) {
    while (i < s.length && /\s/.test(s[i])) i += 1;
    if (i >= s.length) break;
    if (s[i] !== '{') {
      const next = s.indexOf('{', i);
      if (next < 0) return { objects, rest: s.slice(i) };
      i = next;
    }
    let depth = 0;
    let inStr = false;
    let esc = false;
    const start = i;
    let closed = false;
    for (; i < s.length; i += 1) {
      const c = s[i];
      if (inStr) {
        if (esc) {
          esc = false;
          continue;
        }
        if (c === '\\') {
          esc = true;
          continue;
        }
        if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') {
        inStr = true;
        continue;
      }
      if (c === '{') depth += 1;
      else if (c === '}') {
        depth -= 1;
        if (depth === 0) {
          const chunk = s.slice(start, i + 1);
          try {
            objects.push(JSON.parse(chunk));
          } catch {
            /* 残缺或非法，跳过该段 */
          }
          i += 1;
          closed = true;
          break;
        }
      }
    }
    if (!closed) return { objects, rest: s.slice(start) };
  }
  return { objects, rest: '' };
}

export function buildRoleSimulationUserPrompt({
  businessModel,
  config,
  prevSummary,
  contextText,
  businessModelWorkspaceText,
  resumeFromDay,
  scenario,
}) {
  const safeConfig = config && typeof config === 'object' ? config : {};
  const prev = prevSummary ? String(prevSummary).trim() : '';
  const startDay = Number(resumeFromDay || 0);
  const rolled = scenario && scenario.tone ? scenario : rollSimulationScenario();
  const toneLine =
    rolled.tone === 'optimistic'
      ? '本轮主基调：乐观。整体可走通，但要有缓坡起伏与短平台期，不是直线狂飙。'
      : rolled.tone === 'pessimistic'
        ? '本轮主基调：悲观/失败。增长乏力或下滑承压，允许长期亏损；第 30 天禁止大获成功翻盘。'
        : '本轮主基调：中性偏谨慎。增长缓慢、平台期与温和波动为主，优化效果有限。';

  const price = Number(safeConfig.price || 0);
  const priceHint =
    Number.isFinite(price) && price > 0
      ? `定价约 ${price}：累计营收每次爬升幅度多为 1～2 单金额，然后可连续平台期持平。`
      : '累计营收缓慢爬升，并穿插多日平台期。';

  return [
    contextText ? `###\n【创业项目背景汇总】\n${String(contextText).trim()}\n###` : '',
    businessModelWorkspaceText
      ? `###\n【商业模式与画布产出】\n${String(businessModelWorkspaceText).trim()}\n###`
      : '',
    `商业模型：${String(businessModel || '').trim() || '未指定'}`,
    `投入配置（JSON）：${JSON.stringify(safeConfig)}`,
    prev ? `上一次模拟结果摘要：${prev}` : '',
    startDay > 0
      ? `继续输出：已生成到第 ${startDay} 天，请从第 ${startDay + 1} 天开始输出剩余天数，并最终输出 final。users/revenue 为累计值，须承接已生成末日数据。`
      : '',
    `###\n【本轮仿真随机指令】（服务端抽样，必须遵守）\n扰动码：${rolled.seed}\n指定倾向：${rolled.label}\n${toneLine}\n${priceHint}\n形态约束：\n- users、revenue 均为累计值，大体不减\n- 严禁整段 revenue≈users×定价（曲线同形）；必须有「试用未付费」或「复购/一客多套」等不同步日\n- 两条曲线的平台期不要完全重合\n- 至少 8 天 profit 为负\n请结合项目背景自行评判，但不得违背主基调与形态约束。\n###`,
    '输出前自检：抽查第10/20/30天，若都接近 users×定价，必须改写使波形分叉。',
  ]
    .filter(Boolean)
    .join('\n');
}
