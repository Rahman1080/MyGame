import type { GameResult } from "./types";

export const XP_BASE = 10;
export const XP_PER_STAR = 5;
export const XP_PERFECT_BONUS = 5;

export function xpForGame(result: GameResult): number {
  const stars = Math.max(0, Math.min(3, Math.floor(result.stars ?? 0)));
  let xp = XP_BASE + stars * XP_PER_STAR;
  if (stars >= 3) xp += XP_PERFECT_BONUS;
  return xp;
}

export function xpToReachLevel(level: number): number {
  const n = Math.max(1, Math.floor(level)) - 1;
  return 50 * n * (n + 1);
}

export function levelForXp(xp: number): number {
  const safe = Math.max(0, Math.floor(xp));
  let level = 1;
  while (xpToReachLevel(level + 1) <= safe) level += 1;
  return level;
}

export function xpForNextLevel(level: number): number {
  return 100 * Math.max(1, Math.floor(level));
}

export function xpProgress(xp: number): { level: number; into: number; need: number } {
  const safe = Math.max(0, Math.floor(xp));
  const level = levelForXp(safe);
  return { level, into: safe - xpToReachLevel(level), need: xpForNextLevel(level) };
}
