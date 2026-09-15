import { hashString, mulberry32, rngShuffle } from "../../gen/seededRng";
import { dailySeed } from "../../platform/dailySeed";
import { createState, isSolved, isValidState, type PrismMove, type Tube } from "./logic";
import { solve } from "./solver";

export const PRISM_CAPACITY = 4;
export const PRISM_EMPTY = 2;
export const PRISM_LEVELS = 18;
export const PRISM_GEN_BUDGET = 200000;

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
  const l = Math.max(1, Math.floor(level));
  if (l <= 6) return 4;
  if (l <= 12) return 5;
  return 6;
}

export function levelSeed(level: number): string {
  return `prism:level:${Math.min(PRISM_LEVELS, Math.max(1, Math.floor(level)))}:v1`;
}

export function levelPuzzle(level: number): PrismPuzzle {
  const n = Math.min(PRISM_LEVELS, Math.max(1, Math.floor(level)));
  return generatePuzzle(levelSeed(n), `prism-${n}`, {
    colors: colorsForLevel(n),
    capacity: PRISM_CAPACITY,
    empty: PRISM_EMPTY,
  });
}

export const PRISM_DAILY_ID = "prism-daily";

export function dailyPuzzle(date: string): PrismPuzzle {
  return generatePuzzle(dailySeed(date, "prism"), `prism-daily-${date}`, {
    colors: 6,
    capacity: PRISM_CAPACITY,
    empty: PRISM_EMPTY,
  });
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
