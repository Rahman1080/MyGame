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

export const PACKS: PackInfo[] = [
  { id: "pulse", name: "Pulse", start: 1, end: 20, unlockAfter: 0 },
  { id: "surge", name: "Surge", start: 21, end: 40, unlockAfter: 20 },
  { id: "color-gates", name: "Color Gates", start: 41, end: 60, unlockAfter: 40 },
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

export function nextUnsolved(solved: Record<string, boolean>, from = 1): number {
  for (let i = from; i <= 60; i += 1) {
    const p = getLevel(i);
    if (!solved[p.id]) return i;
  }
  return 60;
}
