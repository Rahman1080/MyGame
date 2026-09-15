export const TIERS = ["easy", "normal", "medium", "hard", "super", "extra", "mind"] as const;

export type Tier = (typeof TIERS)[number];

export const TIER_COUNT = TIERS.length;

export const TIER_LABELS: Record<Tier, string> = {
  easy: "EASY",
  normal: "NORMAL",
  medium: "MEDIUM",
  hard: "HARD",
  super: "SUPER HARD",
  extra: "EXTRA HARD",
  mind: "MIND BLOW",
};

const TIMER_BASE_MS: Record<Tier, number> = {
  easy: 0,
  normal: 0,
  medium: 150000,
  hard: 130000,
  super: 110000,
  extra: 90000,
  mind: 70000,
};

const TIMER_STEP_MS = 2000;

function clampLevel(level: number, total: number): number {
  const safeTotal = Math.max(1, Math.floor(total));
  return Math.min(safeTotal, Math.max(1, Math.floor(level)));
}

export function tierBand(total: number): number {
  return Math.max(1, Math.ceil(Math.max(1, Math.floor(total)) / TIER_COUNT));
}

export function tierForLevel(level: number, total: number): Tier {
  const safe = clampLevel(level, total);
  const index = Math.min(TIER_COUNT - 1, Math.floor((safe - 1) / tierBand(total)));
  return TIERS[index]!;
}

export interface TierRange {
  tier: Tier;
  from: number;
  to: number;
}

export function tierRanges(total: number): TierRange[] {
  const safeTotal = Math.max(1, Math.floor(total));
  const band = tierBand(safeTotal);
  return TIERS.map((tier, index) => {
    const from = index * band + 1;
    const to = index === TIER_COUNT - 1 ? safeTotal : Math.min(safeTotal, from + band - 1);
    return { tier, from, to };
  }).filter((range) => range.from <= range.to);
}

export function isTimedLevel(level: number, total: number): boolean {
  const tier = tierForLevel(level, total);
  if (tier === "easy" || tier === "normal") return false;
  if (tier === "medium") return clampLevel(level, total) % 5 === 0;
  return true;
}

export function timeLimitMs(level: number, total: number): number {
  if (!isTimedLevel(level, total)) return 0;
  const tier = tierForLevel(level, total);
  const safe = clampLevel(level, total);
  const within = (safe - 1) % tierBand(total);
  const base = TIMER_BASE_MS[tier];
  return Math.max(base - 20000, base - within * TIMER_STEP_MS);
}

export function timeLeftMs(limitMs: number, elapsedMs: number): number {
  if (limitMs <= 0) return 0;
  return Math.max(0, limitMs - Math.max(0, elapsedMs));
}

export function isExpired(limitMs: number, elapsedMs: number): boolean {
  return limitMs > 0 && elapsedMs >= limitMs;
}

export function hintGate(adsEnabled: boolean, granted: boolean): boolean {
  return !adsEnabled || granted;
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
