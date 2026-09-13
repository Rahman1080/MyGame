import type { Puzzle } from "../engine/types";
import { generateLevel } from "../gen/generator";
import { tutorialPuzzles } from "./tutorial";

export interface PackInfo {
  id: string;
  name: string;
  start: number;
  end: number;
  unlockAfter: number;
}

/** Total number of story levels. Single source of truth. */
export const TOTAL_LEVELS = 120;

export const PACKS: PackInfo[] = [
  { id: "pulse", name: "Pulse", start: 1, end: 20, unlockAfter: 0 },
  { id: "surge", name: "Surge", start: 21, end: 40, unlockAfter: 20 },
  { id: "color-gates", name: "Color Gates", start: 41, end: 60, unlockAfter: 40 },
  { id: "lattice", name: "Lattice", start: 61, end: 80, unlockAfter: 60 },
  { id: "wormhole", name: "Wormhole", start: 81, end: 100, unlockAfter: 80 },
  { id: "vector", name: "Vector", start: 101, end: TOTAL_LEVELS, unlockAfter: 100 },
];

const cache = new Map<number, Puzzle>();

export function getLevel(level: number): Puzzle {
  const hit = cache.get(level);
  if (hit) return hit;
  let puzzle: Puzzle;
  if (level >= 1 && level <= 3) {
    puzzle = tutorialPuzzles()[level - 1]!;
  } else {
    puzzle = generateLevel(level);
  }
  cache.set(level, puzzle);
  return puzzle;
}

export function packForLevel(level: number): PackInfo {
  return PACKS.find((p) => level >= p.start && level <= p.end) ?? PACKS[0]!;
}

/** Deterministic id for a level, matching the generator/tutorial ids. */
export function levelId(level: number): string {
  return `${packForLevel(level).id}-${level}`;
}

export function nextUnsolved(solved: Record<string, boolean>, from = 1): number {
  for (let i = Math.max(1, from); i <= TOTAL_LEVELS; i += 1) {
    if (!solved[levelId(i)]) return i;
  }
  return TOTAL_LEVELS;
}

export function highestSolvedLevel(solved: Record<string, boolean>): number {
  let highest = 0;
  for (let i = 1; i <= TOTAL_LEVELS; i += 1) {
    if (solved[levelId(i)]) highest = i;
  }
  return highest;
}

export function isLevelUnlocked(solved: Record<string, boolean>, level: number): boolean {
  if (level <= 1) return true;
  return level <= highestSolvedLevel(solved) + 1;
}
