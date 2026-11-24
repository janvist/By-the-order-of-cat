// Persistent progress: Authority, upgrades, cleared levels, regalia, idle treasury.
const KEY = "boc.save.v2";
const MAX_IDLE_HOURS = 8;

export interface SaveData {
  authority: number;
  upgrades: Record<string, number>;
  stars: Record<number, number>;
  regalia: string[];
  treasuryAt: number;     // timestamp the treasury was last emptied
  seenIntro: boolean;
}

const fresh = (): SaveData => ({ authority: 0, upgrades: {}, stars: {}, regalia: [], treasuryAt: Date.now(), seenIntro: false });

export const save: SaveData = (() => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...fresh(), ...JSON.parse(raw) };
  } catch { /* storage unavailable */ }
  return fresh();
})();

export function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* progress is kept for this session only */ }
}

export const upgradeLevel = (id: string) => save.upgrades[id] ?? 0;
export const clearedCount = () => Object.values(save.stars).filter((s) => s > 0).length;

/** Authority per hour from the treasury: clerks + a trickle per decree Bruno has obeyed. */
export function treasuryRate() {
  return upgradeLevel("clerk") * 6 + clearedCount() * 2;
}

export function treasuryPending() {
  const hours = Math.min(MAX_IDLE_HOURS, (Date.now() - save.treasuryAt) / 3_600_000);
  return treasuryRate() * hours;
}

export function collectTreasury() {
  const whole = Math.floor(treasuryPending());
  if (whole <= 0) return 0;
  save.authority += whole;
  // keep the fractional remainder ticking
  const rate = treasuryRate();
  const leftoverMs = rate > 0 ? ((treasuryPending() - whole) / rate) * 3_600_000 : 0;
  save.treasuryAt = Date.now() - leftoverMs;
  persist();
  return whole;
}

export function resetSave() {
  Object.assign(save, fresh());
  persist();
}

/** Call before the treasury rate changes, so a new rate never applies to past time. */
export function settleTreasury() {
  const whole = Math.floor(treasuryPending());
  save.authority += Math.max(0, whole);
  save.treasuryAt = Date.now();
  persist();
  return Math.max(0, whole);
}
