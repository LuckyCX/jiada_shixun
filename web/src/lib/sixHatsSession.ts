/**
 * 六顶思考帽会话状态（前端演示 / 类型共用）
 * 顺序：白 → 绿 → 黄 → 黑 → 红 → 蓝；每帽最多 3 轮对话
 */

export const SIX_HATS_ORDER = ['white', 'green', 'yellow', 'black', 'red', 'blue'] as const;

export type SixHatKey = (typeof SIX_HATS_ORDER)[number];

export const ROUNDS_PER_HAT = 3;

export type HatSessionState = {
  mode: 'sequential' | 'free' | string;
  hatOrder: string[];
  completedHats: string[];
  activeHat: string;
  resumeHat: string | null;
  sequentialDone: boolean;
  awaitingAnswer: boolean;
  hatDialogueRound: number;
};

export function normalizeSixHat(h: unknown): SixHatKey | null {
  const s = String(h || '').trim().toLowerCase();
  if ((SIX_HATS_ORDER as readonly string[]).includes(s)) return s as SixHatKey;
  if (s.includes('白')) return 'white';
  if (s.includes('绿')) return 'green';
  if (s.includes('黄')) return 'yellow';
  if (s.includes('黑')) return 'black';
  if (s.includes('红')) return 'red';
  if (s.includes('蓝')) return 'blue';
  return null;
}

export function defaultHatSession(): HatSessionState {
  return {
    mode: 'sequential',
    hatOrder: [...SIX_HATS_ORDER],
    completedHats: [],
    activeHat: 'white',
    resumeHat: null,
    sequentialDone: false,
    awaitingAnswer: false,
    hatDialogueRound: 0,
  };
}

export function coerceHatSession(raw: unknown): HatSessionState {
  const base = defaultHatSession();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Record<string, unknown>;
  const completed = Array.isArray(r.completedHats)
    ? r.completedHats.map(normalizeSixHat).filter(Boolean)
    : [];
  const activeHat = normalizeSixHat(r.activeHat) || base.activeHat;
  const resumeHat = normalizeSixHat(r.resumeHat);
  const sequentialDone = Boolean(r.sequentialDone) || completed.length >= SIX_HATS_ORDER.length;
  const hatDialogueRound = Math.max(0, Math.min(ROUNDS_PER_HAT, Number(r.hatDialogueRound) || 0));
  return {
    mode: sequentialDone ? 'free' : r.mode === 'free' ? 'free' : 'sequential',
    hatOrder: [...SIX_HATS_ORDER],
    completedHats: [...new Set(completed as string[])],
    activeHat,
    resumeHat: resumeHat || null,
    sequentialDone,
    awaitingAnswer: Boolean(r.awaitingAnswer),
    hatDialogueRound,
  };
}

export function nextIncompleteHat(session: unknown): SixHatKey | null {
  const s = coerceHatSession(session);
  if (s.sequentialDone) return null;
  for (const h of SIX_HATS_ORDER) {
    if (!s.completedHats.includes(h)) return h;
  }
  return null;
}

export function switchHatPerspective(session: unknown, targetHat: unknown) {
  const s = coerceHatSession(session);
  const hat = normalizeSixHat(targetHat);
  if (!hat) return { error: '无效的帽子视角' as const };
  if (s.sequentialDone || s.mode === 'free') {
    return {
      session: { ...s, mode: 'free', activeHat: hat, resumeHat: null, awaitingAnswer: false, hatDialogueRound: 0 },
    };
  }
  const resume = s.completedHats.includes(s.activeHat) ? nextIncompleteHat(s) : s.activeHat;
  return {
    session: {
      ...s,
      activeHat: hat,
      resumeHat: resume && resume !== hat ? resume : nextIncompleteHat({ ...s, completedHats: [...s.completedHats, hat] }) || resume,
      awaitingAnswer: false,
      hatDialogueRound: 0,
    },
  };
}

export function completeHatAfterAnswer(session: unknown, answeredHat: unknown) {
  const s = coerceHatSession(session);
  const hat = normalizeSixHat(answeredHat) || (s.activeHat as SixHatKey);
  if (s.sequentialDone || s.mode === 'free') {
    return { session: { ...s, activeHat: hat, awaitingAnswer: false, hatDialogueRound: 0 }, advanced: false };
  }
  const already = s.completedHats.includes(hat);
  const completedHats = already ? s.completedHats : [...s.completedHats, hat];
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
  let next: string | null = null;
  if (s.resumeHat && !completedHats.includes(s.resumeHat)) next = s.resumeHat;
  else next = nextIncompleteHat({ ...s, completedHats });
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

/** 学生作答：未满 3 轮留在本帽，满 3 轮再切下一帽 */
export function afterHatStudentAnswer(session: unknown, answeredHat: unknown) {
  const s = coerceHatSession(session);
  const hat = normalizeSixHat(answeredHat) || (s.activeHat as SixHatKey);
  if (s.sequentialDone || s.mode === 'free') {
    return { session: { ...s, activeHat: hat, awaitingAnswer: false }, advanced: false, stayOnHat: false };
  }
  const baseRound = s.activeHat === hat ? s.hatDialogueRound : 0;
  const nextRound = baseRound + 1;
  if (nextRound < ROUNDS_PER_HAT) {
    return {
      session: { ...s, activeHat: hat, hatDialogueRound: nextRound, awaitingAnswer: true },
      advanced: false,
      stayOnHat: true,
    };
  }
  const progressed = completeHatAfterAnswer({ ...s, hatDialogueRound: 0 }, hat);
  return { session: progressed.session, advanced: progressed.advanced, stayOnHat: false };
}

export function markAwaitingAnswer(session: unknown, hat: unknown): HatSessionState {
  const s = coerceHatSession(session);
  const nextHat = normalizeSixHat(hat) || s.activeHat;
  const sameHat = nextHat === s.activeHat;
  return {
    ...s,
    activeHat: nextHat,
    awaitingAnswer: true,
    hatDialogueRound: sameHat ? s.hatDialogueRound : 0,
  };
}
