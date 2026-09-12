export const SAVE_KEY = "glowtrail:v1";
export const SAVE_VERSION = 1;

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
    dailyCompleted: [false, false, false, false, false],
    dailyStars: [0, 0, 0, 0, 0],
    muted: false,
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

function asNumMap(value: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!value || typeof value !== "object") return out;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

function asBoolArr(value: unknown, len: number): boolean[] {
  const base = Array.isArray(value) ? value : [];
  return Array.from({ length: len }, (_, i) => base[i] === true);
}

function asNumArr(value: unknown, len: number): number[] {
  const base = Array.isArray(value) ? value : [];
  return Array.from({ length: len }, (_, i) => {
    const n = base[i];
    return typeof n === "number" && Number.isFinite(n) ? n : 0;
  });
}

export function sanitizeSave(raw: unknown): SaveData {
  const d = defaultSave();
  if (raw == null || typeof raw !== "object") return d;
  const o = asRecord(raw);
  d.stars = asNumMap(o.stars);
  d.solved = asBoolMap(o.solved);
  if (typeof o.currentPack === "string") d.currentPack = o.currentPack;
  if (typeof o.tutorialDone === "boolean") d.tutorialDone = o.tutorialDone;
  if (typeof o.streak === "number" && Number.isFinite(o.streak) && o.streak >= 0) d.streak = o.streak;
  if (o.lastDailyDate === null || typeof o.lastDailyDate === "string") d.lastDailyDate = o.lastDailyDate as string | null;
  if (o.dailyDate === null || typeof o.dailyDate === "string") d.dailyDate = o.dailyDate as string | null;
  d.dailyCompleted = asBoolArr(o.dailyCompleted, 5);
  d.dailyStars = asNumArr(o.dailyStars, 5);
  if (typeof o.muted === "boolean") d.muted = o.muted;
  d.version = SAVE_VERSION;
  return d;
}
