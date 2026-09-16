export const SAVE_KEY = "glowtrail:v1";
export const SAVE_VERSION = 1;

export const KNOWN_PACKS = ["pulse", "surge", "color-gates", "lattice", "wormhole", "vector", "daily"] as const;

export const DAILY_LENGTH = 5;
export const MAX_STARS = 3;

export interface SaveData {
  version: number;
  stars: Record<string, number>;
  solved: Record<string, boolean>;
  currentPack: string;
  tutorialDone: boolean;
  streak: number;
  lastDailyDate: string | null;
  dailyDate: string | null;
  dailyCompleted: boolean[];
  dailyStars: number[];
  muted: boolean;
  arcadeHighScores: Record<string, number>;
}

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    stars: {},
    solved: {},
    currentPack: "pulse",
    tutorialDone: false,
    streak: 0,
    lastDailyDate: null,
    dailyDate: null,
    dailyCompleted: Array.from({ length: DAILY_LENGTH }, () => false),
    dailyStars: Array.from({ length: DAILY_LENGTH }, () => 0),
    muted: false,
    arcadeHighScores: {},
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asBoolMap(value: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (!value || typeof value !== "object") return out;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "boolean") out[k] = v;
  }
  return out;
}

function clampStar(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(MAX_STARS, Math.round(value)));
}

function asStarMap(value: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!value || typeof value !== "object") return out;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = clampStar(v);
  }
  return out;
}

function asBoolArr(value: unknown, len: number): boolean[] {
  const base = Array.isArray(value) ? value : [];
  return Array.from({ length: len }, (_, i) => base[i] === true);
}

function asStarArr(value: unknown, len: number): number[] {
  const base = Array.isArray(value) ? value : [];
  return Array.from({ length: len }, (_, i) => clampStar(base[i]));
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateString(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (y === undefined || m === undefined || d === undefined) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function asDateOrNull(value: unknown): string | null {
  if (value === null) return null;
  return isDateString(value) ? value : null;
}

export function isKnownPack(value: unknown): value is string {
  return typeof value === "string" && (KNOWN_PACKS as readonly string[]).includes(value);
}

function asHighScoreMap(value: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!value || typeof value !== "object") return out;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
      out[k] = Math.floor(v);
    }
  }
  return out;
}

export function sanitizeSave(raw: unknown): SaveData {
  const d = defaultSave();
  if (raw == null || typeof raw !== "object") return d;
  const o = asRecord(raw);
  d.stars = asStarMap(o.stars);
  d.solved = asBoolMap(o.solved);
  if (isKnownPack(o.currentPack)) d.currentPack = o.currentPack;
  if (typeof o.tutorialDone === "boolean") d.tutorialDone = o.tutorialDone;
  if (typeof o.streak === "number" && Number.isFinite(o.streak) && o.streak >= 0) {
    d.streak = Math.floor(o.streak);
  }
  d.lastDailyDate = asDateOrNull(o.lastDailyDate);
  d.dailyDate = asDateOrNull(o.dailyDate);
  d.dailyCompleted = asBoolArr(o.dailyCompleted, DAILY_LENGTH);
  d.dailyStars = asStarArr(o.dailyStars, DAILY_LENGTH);
  if (typeof o.muted === "boolean") d.muted = o.muted;
  d.arcadeHighScores = asHighScoreMap(o.arcadeHighScores);
  d.version = SAVE_VERSION;
  return d;
}
