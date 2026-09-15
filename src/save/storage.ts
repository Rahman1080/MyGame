import { daysBetween, localYmd } from "../gen/daily";
import { migrateSave } from "./migration";
import {
  defaultSave,
  defaultSaveV2,
  sanitizeSave,
  sanitizeV2,
  SAVE_KEY,
  SAVE_KEY_V1,
  SAVE_KEY_V2,
  type SaveData,
  type SaveV2,
} from "./schema";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

class MemoryStorage implements StorageLike {
  private data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

function resolveStorage(): StorageLike {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return new MemoryStorage();
    ls.getItem(SAVE_KEY);
    return ls;
  } catch {
    return new MemoryStorage();
  }
}

export function loadSave(storage: StorageLike = resolveStorage()): SaveData {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    return sanitizeSave(JSON.parse(raw));
  } catch {
    return defaultSave();
  }
}

export function persistSave(data: SaveData, storage: StorageLike = resolveStorage()): void {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    /* never block gameplay */
  }
}

function safeGet(storage: StorageLike, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Load the shared v2 save. Prefers an existing valid `glowtrail:v2`; otherwise
 * migrates `glowtrail:v1` losslessly and persists v2 while leaving v1 untouched.
 * A corrupt v2 or v1 falls back to defaults instead of resetting the other key.
 */
export function loadSaveV2(storage: StorageLike = resolveStorage()): SaveV2 {
  const rawV2 = safeGet(storage, SAVE_KEY_V2);
  if (rawV2 !== null) {
    try {
      return sanitizeV2(JSON.parse(rawV2));
    } catch {
      /* corrupt v2: fall through and try v1 */
    }
  }
  const rawV1 = safeGet(storage, SAVE_KEY_V1);
  if (rawV1 !== null) {
    try {
      const migrated = migrateSave(JSON.parse(rawV1));
      persistSaveV2(migrated, storage);
      return migrated;
    } catch {
      /* corrupt v1: fall through to defaults */
    }
  }
  return defaultSaveV2();
}

export function persistSaveV2(data: SaveV2, storage: StorageLike = resolveStorage()): void {
  try {
    storage.setItem(SAVE_KEY_V2, JSON.stringify(data));
  } catch {
    /* never block gameplay */
  }
}

export function applyStreak(data: SaveData, today: string): SaveData {
  const next = { ...data };
  if (next.lastDailyDate === today) return next;
  if (!next.lastDailyDate) {
    next.streak = 1;
  } else {
    const gap = daysBetween(next.lastDailyDate, today);
    next.streak = gap === 1 ? next.streak + 1 : 1;
  }
  next.lastDailyDate = today;
  return next;
}

export function ensureDaily(data: SaveData, today: string = localYmd()): SaveData {
  if (data.dailyDate === today) return data;
  return {
    ...data,
    dailyDate: today,
    dailyCompleted: [false, false, false, false, false],
    dailyStars: [0, 0, 0, 0, 0],
  };
}

export function recordSolve(data: SaveData, puzzleId: string, stars: number): SaveData {
  const prev = data.stars[puzzleId] ?? 0;
  return {
    ...data,
    solved: { ...data.solved, [puzzleId]: true },
    stars: { ...data.stars, [puzzleId]: Math.max(prev, stars) },
  };
}

export function solvedCount(data: SaveData, ids: string[]): number {
  return ids.reduce((n, id) => n + (data.solved[id] ? 1 : 0), 0);
}

export function starTotal(data: SaveData, ids: string[]): number {
  return ids.reduce((n, id) => n + (data.stars[id] ?? 0), 0);
}
