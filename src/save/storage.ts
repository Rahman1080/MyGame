import { daysBetween, localYmd } from "../gen/daily";
import { defaultSave, sanitizeSave, SAVE_KEY, type SaveData } from "./schema";

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
