import { hashString, mulberry32, rngShuffle } from "../../gen/seededRng";
import { dailySeed } from "../../platform/dailySeed";
import { isTimedLevel, tierForLevel, timeLimitMs, type Tier } from "../../platform/levels";
import { createState, isSolved, isValidState, type PrismMove, type Tube } from "./logic";
import { solve } from "./solver";

export const PRISM_CAPACITY = 4;
export const PRISM_EMPTY = 2;
export const PRISM_LEVELS = 105;
export const PRISM_GEN_BUDGET = 200000;
export const PRISM_TIME_SCALE = 3;

const COLORS_BY_TIER: Record<Tier, number> = {
  easy: 3,
  normal: 4,
  medium: 4,
  hard: 5,
  super: 5,
  extra: 6,
  mind: 6,
};

const EMPTY_BY_TIER: Record<Tier, number> = {
  easy: 3,
  normal: 2,
  medium: 2,
  hard: 2,
  super: 2,
  extra: 2,
  mind: 2,
};

export interface PrismPuzzle {
  id: string;
  seed: string;
  colors: number;
  capacity: number;
  empty: number;
  tubes: Tube[];
  solution: PrismMove[];
}

export interface GenOptions {
  colors?: number;
  capacity?: number;
  empty?: number;
  maxAttempts?: number;
  solveBudget?: number;
}

export function dealTubes(seed: string, colors: number, capacity: number, empty: number): Tube[] {
  const rng = mulberry32(hashString(`prism:deal:${seed}`));
  const units: number[] = [];
  for (let color = 0; color < colors; color += 1) {
    for (let i = 0; i < capacity; i += 1) units.push(color);
  }
  const shuffled = rngShuffle(rng, units);
  const tubes: Tube[] = [];
  for (let i = 0; i < colors; i += 1) {
    tubes.push(shuffled.slice(i * capacity, (i + 1) * capacity));
  }
  for (let i = 0; i < empty; i += 1) tubes.push([]);
  return tubes;
}

export function generatePuzzle(seed: string, id: string, opts: GenOptions = {}): PrismPuzzle {
  const colors = Math.max(2, Math.floor(opts.colors ?? 5));
  const capacity = Math.max(2, Math.floor(opts.capacity ?? PRISM_CAPACITY));
  const empty = Math.max(1, Math.floor(opts.empty ?? PRISM_EMPTY));
  const maxAttempts = Math.max(1, Math.floor(opts.maxAttempts ?? 32));
  const solveBudget = Math.max(1000, Math.floor(opts.solveBudget ?? PRISM_GEN_BUDGET));

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const attemptSeed = attempt === 0 ? seed : `${seed}#${attempt}`;
    const tubes = dealTubes(attemptSeed, colors, capacity, empty);
    const state = createState(attemptSeed, tubes, colors, capacity);
    if (!isValidState(state) || isSolved(state)) continue;
    const result = solve(state, { maxExpanded: solveBudget });
    if (result.solved && result.solution.length > 0) {
      return { id, seed: attemptSeed, colors, capacity, empty, tubes, solution: result.solution };
    }
  }
  throw new Error(`prism: no solvable puzzle for seed ${seed}`);
}

export function colorsForLevel(level: number): number {
  const l = Math.min(PRISM_LEVELS, Math.max(1, Math.floor(level)));
  return COLORS_BY_TIER[tierForLevel(l, PRISM_LEVELS)];
}

export function emptyForLevel(level: number): number {
  const l = Math.min(PRISM_LEVELS, Math.max(1, Math.floor(level)));
  return EMPTY_BY_TIER[tierForLevel(l, PRISM_LEVELS)];
}

export function levelTier(level: number): Tier {
  return tierForLevel(Math.min(PRISM_LEVELS, Math.max(1, Math.floor(level))), PRISM_LEVELS);
}

export function levelTimed(level: number): boolean {
  const l = Math.min(PRISM_LEVELS, Math.max(1, Math.floor(level)));
  return isTimedLevel(l, PRISM_LEVELS);
}

export function levelTimeLimitMs(level: number): number {
  const l = Math.min(PRISM_LEVELS, Math.max(1, Math.floor(level)));
  if (!isTimedLevel(l, PRISM_LEVELS)) return 0;
  return timeLimitMs(l, PRISM_LEVELS) * PRISM_TIME_SCALE;
}

export function levelSeed(level: number): string {
  return `prism:level:${Math.min(PRISM_LEVELS, Math.max(1, Math.floor(level)))}:v1`;
}

const levelCache = new Map<number, PrismPuzzle>();

export function levelPuzzle(level: number): PrismPuzzle {
  const n = Math.min(PRISM_LEVELS, Math.max(1, Math.floor(level)));
  const cached = levelCache.get(n);
  if (cached) return cached;
  const puzzle = generatePuzzle(levelSeed(n), `prism-${n}`, {
    colors: colorsForLevel(n),
    capacity: PRISM_CAPACITY,
    empty: emptyForLevel(n),
  });
  levelCache.set(n, puzzle);
  return puzzle;
}

export const PRISM_DAILY_ID = "prism-daily";

const dailyCache = new Map<string, PrismPuzzle>();

export function dailyPuzzle(date: string): PrismPuzzle {
  const cached = dailyCache.get(date);
  if (cached) return cached;
  const puzzle = generatePuzzle(dailySeed(date, "prism"), `prism-daily-${date}`, {
    colors: 6,
    capacity: PRISM_CAPACITY,
    empty: PRISM_EMPTY,
  });
  dailyCache.set(date, puzzle);
  return puzzle;
}

export function puzzleById(id: string, date: string): PrismPuzzle | null {
  if (id === PRISM_DAILY_ID) return dailyPuzzle(date);
  const match = /^prism-(\d+)$/.exec(id);
  if (match) {
    const n = Number(match[1]);
    if (n >= 1 && n <= PRISM_LEVELS) return levelPuzzle(n);
  }
  return null;
}

export function puzzleTitle(id: string, date: string): string {
  if (id === PRISM_DAILY_ID) return `DAILY ${date}`;
  const match = /^prism-(\d+)$/.exec(id);
  if (match) return `LEVEL ${match[1]}`;
  return id.toUpperCase();
}

export function starsForMoves(moves: number, par: number): number {
  const m = Math.max(0, Math.floor(moves));
  const p = Math.max(1, Math.floor(par));
  if (m <= p) return 3;
  if (m <= p + Math.max(2, Math.ceil(p * 0.25))) return 2;
  return 1;
}
