import type { Puzzle } from "../engine/types";
import { generatePuzzle } from "../gen/generator";
import { profileForLevel } from "../gen/difficulty";

export type EndlessDifficulty = "easy" | "medium" | "hard" | "master";

export interface EndlessConfig {
  difficulty: EndlessDifficulty;
  size: number;
}

const DIFFICULTY_MAP: Record<EndlessDifficulty, { level: number; size: number }> = {
  easy: { level: 8, size: 3 },
  medium: { level: 28, size: 4 },
  hard: { level: 68, size: 5 },
  master: { level: 108, size: 6 },
};

export function generateEndlessPuzzle(difficulty: EndlessDifficulty = "medium", seed?: number): Puzzle {
  const cfg = DIFFICULTY_MAP[difficulty];
  const actualSeed = seed ?? (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0;
  const profile = { ...profileForLevel(cfg.level), size: cfg.size };

  return generatePuzzle(actualSeed, {
    id: `zen-${difficulty}-${actualSeed.toString(16)}`,
    pack: "zen",
    profile,
    level: cfg.level,
  });
}
