import { dailySeed } from "../../platform/dailySeed";
import { hashString, mulberry32, rngInt, type Rng } from "../../gen/seededRng";
import {
  ARROWS_TOTAL_LEVELS,
  type ArrowTile,
  type ArrowsBoard,
  type ArrowsMode,
  type ArrowsState,
  type Dir,
  bodyCells,
  isSolved,
  lanePath,
  readyIndices,
} from "./logic";

/** Bumping this invalidates every generated board. */
export const ARROWS_LEVEL_VERSION = "v3";

export interface BoardConfig {
  size: number;
  count: number;
  maxLock: number;
  maxLength: 1 | 2 | 3;
  /** Target range for the number of arrows launchable at the start. */
  minInitial: number;
  maxInitial: number;
  /** Minimum length of the forced single-choice chain at the start. */
  minChain: number;
}

/* --------------------------------------------------------------- placement */

function pickLength(rng: Rng, maxLength: number): number {
  if (maxLength <= 1) return 1;
  const r = rng();
  if (maxLength === 2) return r < 0.5 ? 1 : 2;
  return r < 0.45 ? 1 : r < 0.8 ? 2 : 3;
}

interface Placement {
  head: number;
  dir: Dir;
  length: number;
}

/**
 * Find a spot for the next-placed arrow such that neither its body nor its
 * escape lane touches an already placed arrow. `occupied` holds the bodies of
 * arrows that escape AFTER this one, so a clear lane here means the arrow can
 * always leave once they are gone.
 */
function findPlacement(size: number, occupied: Set<number>, rng: Rng, maxLength: number): Placement | null {
  for (let attempt = 0; attempt < 260; attempt += 1) {
    const head = rngInt(rng, 0, size * size - 1);
    const dir = rngInt(rng, 0, 3) as Dir;
    const length = pickLength(rng, maxLength);
    const body = bodyCells(size, dir, head, length);
    if (body.length < length) continue;
    if (body.some((cell) => occupied.has(cell))) continue;
    if (lanePath(size, dir, head).some((cell) => occupied.has(cell))) continue;
    return { head, dir, length };
  }
  return null;
}

/**
 * Build a board by placing arrows in reverse escape order: arrow `count - 1`
 * escapes last and is placed first. Because a new arrow may not enter the
 * already-occupied escape lanes of previously placed arrows, launching in
 * index order `0..count-1` always clears the board.
 */
export function plantBoard(cfg: BoardConfig, rng: Rng): ArrowsBoard | null {
  const size = cfg.size;
  const occupied = new Set<number>();
  const arrows: ArrowTile[] = new Array(cfg.count);
  for (let i = cfg.count - 1; i >= 0; i -= 1) {
    const placed = findPlacement(size, occupied, rng, cfg.maxLength);
    if (!placed) return null;
    for (const cell of bodyCells(size, placed.dir, placed.head, placed.length)) occupied.add(cell);
    const lockTop = Math.min(cfg.maxLock, i);
    const lock = lockTop > 0 && rng() < 0.45 ? rngInt(rng, 1, lockTop) : 0;
    arrows[i] = { id: i, dir: placed.dir, head: placed.head, length: placed.length, lock };
  }
  return { size, arrows, seed: "" };
}

/** Simple fallback with disjoint lanes; always solvable. */
function fallbackBoard(size: number): ArrowsBoard {
  const arrows: ArrowTile[] = [];
  for (let col = 0; col < size; col += 1) {
    arrows.push({ id: col, dir: 0, head: (size - 1) * size + col, length: 1, lock: 0 });
  }
  return { size, arrows, seed: "" };
}

/* ------------------------------------------------------------------ solver */

export interface SolveInfo {
  solvable: boolean;
  /** Canonical launch order (empty when unsolvable). */
  order: number[];
  /** Arrows launchable at the start. */
  initial: number[];
  /** Longest opening run where exactly one arrow is available. */
  chain: number;
  /** The largest number of arrows available at any single point. */
  maxReady: number;
}

/**
 * Greedy solve. Launching an available arrow only ever removes an arrow, which
 * can only clear lane cells and advance locks, so the relation is monotone and
 * a single pass is exact. If arrows remain and none is ready, the board is
 * unsolvable.
 */
export function solveBoard(size: number, arrows: readonly ArrowTile[], startAlive?: readonly boolean[]): SolveInfo {
  const alive = startAlive ? startAlive.slice() : arrows.map(() => true);
  let escaped = startAlive ? alive.reduce((count, live) => (live ? count : count + 1), 0) : 0;
  const order: number[] = [];
  let initial: number[] = [];
  let chain = 0;
  let chainClosed = false;
  let maxReady = 0;
  for (;;) {
    const ready = readyIndices(size, arrows, alive, escaped);
    if (ready.length === 0) break;
    if (order.length === 0) initial = ready.slice();
    maxReady = Math.max(maxReady, ready.length);
    if (!chainClosed) {
      if (ready.length === 1) chain += 1;
      else chainClosed = true;
    }
    const pick = ready[0]!;
    alive[pick] = false;
    escaped += 1;
    order.push(pick);
  }
  return { solvable: escaped === arrows.length, order, initial, chain, maxReady };
}

export interface Difficulty {
  initial: number;
  chain: number;
  maxReady: number;
}

export function analyzeDifficulty(board: ArrowsBoard): Difficulty {
  const info = solveBoard(board.size, board.arrows);
  return { initial: info.initial.length, chain: info.chain, maxReady: info.maxReady };
}

function bandMiss(info: SolveInfo, cfg: BoardConfig): number {
  let miss = 0;
  const initial = info.initial.length;
  if (initial < cfg.minInitial) miss += cfg.minInitial - initial;
  if (initial > cfg.maxInitial) miss += initial - cfg.maxInitial;
  if (info.chain < cfg.minChain) miss += cfg.minChain - info.chain;
  return miss;
}

function buildBoard(cfg: BoardConfig, rng: Rng, attempts = 90): ArrowsBoard {
  let best: ArrowsBoard | null = null;
  let bestMiss = Infinity;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const board = plantBoard(cfg, rng);
    if (!board) continue;
    const info = solveBoard(board.size, board.arrows);
    if (!info.solvable) continue;
    const miss = bandMiss(info, cfg);
    if (miss === 0) return board;
    if (miss < bestMiss) {
      bestMiss = miss;
      best = board;
    }
  }
  return best ?? fallbackBoard(cfg.size);
}

/* ------------------------------------------------------------------ configs */

export function levelConfig(level: number): BoardConfig {
  const L = Math.min(ARROWS_TOTAL_LEVELS, Math.max(1, Math.floor(level)));
  const lerp = (from: number, to: number, lo: number, hi: number): number => {
    const t = to === from ? 1 : (L - from) / (to - from);
    return Math.round(lo + (hi - lo) * Math.min(1, Math.max(0, t)));
  };
  if (L <= 10) {
    return { size: 4, count: lerp(1, 10, 4, 6), maxLock: 0, maxLength: 1, minInitial: 3, maxInitial: 6, minChain: 0 };
  }
  if (L <= 25) {
    return { size: 5, count: lerp(11, 25, 6, 10), maxLock: 1, maxLength: 2, minInitial: 2, maxInitial: 4, minChain: 1 };
  }
  if (L <= 45) {
    return { size: 6, count: lerp(26, 45, 9, 14), maxLock: 2, maxLength: 2, minInitial: 2, maxInitial: 3, minChain: 2 };
  }
  if (L <= 70) {
    return { size: 7, count: lerp(46, 70, 12, 18), maxLock: 3, maxLength: 3, minInitial: 1, maxInitial: 3, minChain: 3 };
  }
  if (L <= 85) {
    return { size: 8, count: lerp(71, 85, 15, 22), maxLock: 4, maxLength: 3, minInitial: 1, maxInitial: 2, minChain: 4 };
  }
  return { size: 9, count: lerp(86, 100, 18, 26), maxLock: 6, maxLength: 3, minInitial: 1, maxInitial: 2, minChain: 5 };
}

export function endlessConfig(index: number): BoardConfig {
  const i = Math.max(0, Math.floor(index));
  const size = Math.min(9, 4 + Math.floor(i / 4));
  const cap = Math.min(24, size * size - 6);
  return {
    size,
    count: Math.min(cap, size + 2 + Math.floor(i / 3)),
    maxLock: Math.min(6, Math.floor(i / 4)),
    maxLength: (Math.min(3, 1 + Math.floor(i / 6)) || 1) as 1 | 2 | 3,
    minInitial: 1,
    maxInitial: Math.max(2, 4 - Math.floor(i / 8)),
    minChain: Math.min(5, Math.floor(i / 5)),
  };
}

export function dailyConfig(): BoardConfig {
  return { size: 7, count: 13, maxLock: 2, maxLength: 2, minInitial: 1, maxInitial: 3, minChain: 2 };
}

/* ---------------------------------------------------------------- generators */

const boardCache = new Map<string, ArrowsBoard>();

function cachedBoard(seed: string, make: () => ArrowsBoard): ArrowsBoard {
  const hit = boardCache.get(seed);
  if (hit) return hit;
  const board = { ...make(), seed };
  boardCache.set(seed, board);
  return board;
}

export function generateLevel(level: number, seed = `arrows:level:${level}:${ARROWS_LEVEL_VERSION}`): ArrowsBoard {
  return cachedBoard(seed, () => buildBoard(levelConfig(level), mulberry32(hashString(seed))));
}

export function generateEndlessBoard(index: number, salt = "0"): ArrowsBoard {
  const seed = `arrows:endless:${salt}:${index}:${ARROWS_LEVEL_VERSION}`;
  return cachedBoard(seed, () => buildBoard(endlessConfig(index), mulberry32(hashString(seed))));
}

export function generateDailyBoard(date: string): ArrowsBoard {
  const seed = dailySeed(date, "arrows");
  return cachedBoard(seed, () => buildBoard(dailyConfig(), mulberry32(hashString(seed))));
}

/* -------------------------------------------------------------- state maker */

function stateFromBoard(
  board: ArrowsBoard,
  mode: ArrowsMode,
  level: number,
  boardIndex: number,
  date: string,
): ArrowsState {
  const state: ArrowsState = {
    mode,
    level,
    boardIndex,
    size: board.size,
    arrows: board.arrows,
    alive: board.arrows.map(() => true),
    escaped: 0,
    launches: 0,
    missteps: 0,
    hints: 0,
    seed: board.seed,
    date,
    status: "playing",
    history: [],
  };
  return isSolved(state) ? { ...state, status: "solved" } : state;
}

export function createLevelState(level: number, seed?: string): ArrowsState {
  const board = generateLevel(level, seed);
  return stateFromBoard(board, "level", level, 0, "");
}

export function createEndlessState(index: number, salt = "0"): ArrowsState {
  const board = generateEndlessBoard(index, salt);
  return stateFromBoard(board, "endless", 0, index, "");
}

export function createDailyState(date: string): ArrowsState {
  const board = generateDailyBoard(date);
  return stateFromBoard(board, "daily", 0, 0, date);
}

/* -------------------------------------------------------------------- hints */

export function hintIndex(state: ArrowsState): number | null {
  const ready = readyIndices(state.size, state.arrows, state.alive, state.escaped);
  if (ready.length === 0) return null;
  let best = ready[0]!;
  let bestGain = -1;
  for (const index of ready) {
    const alive = state.alive.slice();
    alive[index] = false;
    const gain = readyIndices(state.size, state.arrows, alive, state.escaped + 1).length;
    if (gain > bestGain) {
      bestGain = gain;
      best = index;
    }
  }
  return best;
}
