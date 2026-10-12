/**
 * 六顶思考帽会话状态：顺序轮询 + 按需切换
 * 顺序：白 → 绿 → 黄 → 黑 → 红 → 蓝
 * 每顶帽子苏格拉底式追问，可进行 ROUNDS_PER_HAT 轮对话后再进入下一帽
 */

export const SIX_HATS_ORDER = ['white', 'green', 'yellow', 'black', 'red', 'blue'];

export const SIX_HAT_KEYS = new Set(SIX_HATS_ORDER);

/** 每顶帽子允许的对话轮次（学生作答次数） */
export const ROUNDS_PER_HAT = 3;

export function normalizeSixHat(h) {
  const s = String(h || '').trim().toLowerCase();
  if (SIX_HAT_KEYS.has(s)) return s;
  if (s.includes('白')) return 'white';
  if (s.includes('绿')) return 'green';
  if (s.includes('黄')) return 'yellow';
  if (s.includes('黑')) return 'black';
  if (s.includes('红')) return 'red';
  if (s.includes('蓝')) return 'blue';
  return null;
}

export function defaultHatSession() {
  return {
    mode: 'sequential',
    hatOrder: [...SIX_HATS_ORDER],
    completedHats: [],
    activeHat: 'white',
    resumeHat: null,
    sequentialDone: false,
    /** 当前帽是否已抛出追问、等待学生作答 */
    awaitingAnswer: false,
    /** 当前帽已完成的对话轮次（学生作答次数），满 ROUNDS_PER_HAT 后切换下一帽 */
    hatDialogueRound: 0,
  };
}

export function coerceHatSession(raw) {
  const base = defaultHatSession();
  if (!raw || typeof raw !== 'object') return base;
  const completed = Array.isArray(raw.completedHats)
    ? raw.completedHats.map(normalizeSixHat).filter(Boolean)
    : [];
  const activeHat = normalizeSixHat(raw.activeHat) || base.activeHat;
  const resumeHat = normalizeSixHat(raw.resumeHat);
  const sequentialDone = Boolean(raw.sequentialDone) || completed.length >= SIX_HATS_ORDER.length;
  const hatDialogueRound = Math.max(0, Math.min(ROUNDS_PER_HAT, Number(raw.hatDialogueRound) || 0));
  return {
    mode: sequentialDone ? 'free' : raw.mode === 'free' ? 'free' : 'sequential',
    hatOrder: [...SIX_HATS_ORDER],
    completedHats: [...new Set(completed)],
    activeHat,
    resumeHat: resumeHat || null,
    sequentialDone,
    awaitingAnswer: Boolean(raw.awaitingAnswer),
    hatDialogueRound,
  };
}

/** 顺序中下一个尚未完成的帽子 */
export function nextIncompleteHat(session) {
  const s = coerceHatSession(session);
  if (s.sequentialDone) return null;
  for (const h of SIX_HATS_ORDER) {
    if (!s.completedHats.includes(h)) return h;
  }
  return null;
}

/**
 * 手动切换视角：若顺序未完成，记录回切目标
 */
export function switchHatPerspective(session, targetHat) {
  const s = coerceHatSession(session);
  const hat = normalizeSixHat(targetHat);
  if (!hat) return { error: '无效的帽子视角' };
  if (s.sequentialDone || s.mode === 'free') {
    return {
      session: { ...s, mode: 'free', activeHat: hat, resumeHat: null, awaitingAnswer: false, hatDialogueRound: 0 },
    };
  }
  // 记录「切走前」应回到的下一未完成帽（若当前帽未完成则仍是当前帽）
  const resume = s.completedHats.includes(s.activeHat) ? nextIncompleteHat(s) : s.activeHat;
  return {
    session: {
      ...s,
      activeHat: hat,
      resumeHat: resume && resume !== hat ? resume : nextIncompleteHat({ ...s, completedHats: [...s.completedHats, hat].filter((x, i, a) => a.indexOf(x) === i) }) || resume,
      awaitingAnswer: false,
      hatDialogueRound: 0,
    },
  };
}

/**
 * 学生在当前视角作答后：若属顺序轮询且该帽未完成，则标记完成并切回下一未完成帽
 * （内部用：满 ROUNDS_PER_HAT 轮时调用）
 */
export function completeHatAfterAnswer(session, answeredHat) {
  const s = coerceHatSession(session);
  const hat = normalizeSixHat(answeredHat) || s.activeHat;
  if (s.sequentialDone || s.mode === 'free') {
    return { session: { ...s, activeHat: hat, awaitingAnswer: false, hatDialogueRound: 0 }, advanced: false };
  }
  // 仅当回答的是「尚未计入完成」的帽子时推进顺序
  const already = s.completedHats.includes(hat);
  let completedHats = s.completedHats;
  if (!already) {
    completedHats = [...s.completedHats, hat];
  }
  const sequentialDone = completedHats.length >= SIX_HATS_ORDER.length;
  if (sequentialDone) {
    return {
      session: {
        ...s,
        completedHats,
        sequentialDone: true,
        mode: 'free',
        activeHat: hat,
        resumeHat: null,
        awaitingAnswer: false,
        hatDialogueRound: 0,
      },
      advanced: !already,
    };
  }
  // 优先回到 resumeHat（若仍未完成），否则下一未完成
  let next = null;
  if (s.resumeHat && !completedHats.includes(s.resumeHat)) {
    next = s.resumeHat;
  } else {
    next = nextIncompleteHat({ ...s, completedHats });
  }
  return {
    session: {
      ...s,
      completedHats,
      activeHat: next || hat,
      resumeHat: null,
      awaitingAnswer: false,
      sequentialDone: false,
      mode: 'sequential',
      hatDialogueRound: 0,
    },
    advanced: !already,
  };
}

/**
 * 顺序模式下学生作答：累计本帽轮次；未满 3 轮则留在本帽，满 3 轮才切下一帽
 * @returns {{ session, advanced: boolean, stayOnHat: boolean }}
 */
export function afterHatStudentAnswer(session, answeredHat) {
  const s = coerceHatSession(session);
  const hat = normalizeSixHat(answeredHat) || s.activeHat;
  if (s.sequentialDone || s.mode === 'free') {
    return {
      session: { ...s, activeHat: hat, awaitingAnswer: false },
      advanced: false,
      stayOnHat: false,
    };
  }
  const baseRound = s.activeHat === hat ? s.hatDialogueRound : 0;
  const nextRound = baseRound + 1;
  if (nextRound < ROUNDS_PER_HAT) {
    return {
      session: {
        ...s,
        activeHat: hat,
        hatDialogueRound: nextRound,
        awaitingAnswer: true,
      },
      advanced: false,
      stayOnHat: true,
    };
  }
  const progressed = completeHatAfterAnswer({ ...s, hatDialogueRound: 0 }, hat);
  return {
    session: progressed.session,
    advanced: progressed.advanced,
    stayOnHat: false,
  };
}

export function markAwaitingAnswer(session, hat) {
  const s = coerceHatSession(session);
  const nextHat = normalizeSixHat(hat) || s.activeHat;
  // 换帽开追问时重置本帽轮次；同帽续问保留已累计轮次
  const sameHat = nextHat === s.activeHat;
  return {
    ...s,
    activeHat: nextHat,
    awaitingAnswer: true,
    hatDialogueRound: sameHat ? s.hatDialogueRound : 0,
  };
}
