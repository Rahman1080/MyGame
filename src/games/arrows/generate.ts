import { dailySeed } from "../../platform/dailySeed";
import { hashString, mulberry32, rngInt, type Rng } from "../../gen/seededRng";
import {
  ARROWS_TOTAL_LEVELS,
  type ArrowTile,
  type ArrowsBoard,
  type ArrowsMode,
  type ArrowsState,
  type Dir,
  applyStep,
  bodyCells,
  isSolved,
  movableIndices,
  parForBoard,
} from "./logic";

export const ARROWS_LEVEL_VERSION = "v2";
/** Solver node ceiling; beyond this we stop searching and treat as unknown. */
export const SOLVER_NODE_CAP = 12000;

export interface BoardConfig {
  size: number;
  count: number;
  maxLock: number;
  /** How many length-2 arrows to place. */
  length2: number;
  trap: "require" | "avoid" | "any";
}

/* --------------------------------------------------------------- placement */

/**
 * Scatter arrows across the board, rejecting overlaps. Because arrows may point
 * into each other, a candidate board can deadlock; solvability is verified with
 * the solver in `buildBoard` rather than guaranteed by construction. Random
 * scattering is what makes blocking (and therefore real dead ends) common,
 * which a strictly "planted" layout cannot produce.
 */
function tryBuildRandomBoard(cfg: BoardConfig, rng: Rng): ArrowsBoard | null {
  const size = cfg.size;
  const occupied = new Set<number>();
  const arrows: ArrowTile[] = [];
  let length2Left = cfg.length2;
  const maxLock = Math.min(cfg.maxLock, Math.max(0, cfg.count - 3));
  for (let id = 0; id < cfg.count; id += 1) {
    const wantLong = length2Left > 0 && rng() < 0.45 ? 2 : 1;
    let placed: ArrowTile | null = null;
    for (let tries = 0; tries < 120; tries += 1) {
      const head = rngInt(rng, 0, size * size - 1);
      const dir = rngInt(rng, 0, 3) as Dir;
      const cells = bodyCells(size, dir, head, wantLong);
      if (cells.length < wantLong) continue;
      if (cells.some((cell) => occupied.has(cell))) continue;
      placed = { id, dir, head, length: wantLong, lock: 0 };
      break;
    }
    if (!placed) return null;
    for (const cell of bodyCells(size, placed.dir, placed.head, placed.length)) occupied.add(cell);
    if (placed.length === 2) length2Left -= 1;
    arrows.push(placed);
  }
  // At least arrow 0 stays free so a locked opening position is impossible.
  for (let i = 1; i < arrows.length; i += 1) {
    if (maxLock > 0 && rng() < 0.3) arrows[i]!.lock = rngInt(rng, 1, maxLock);
  }
  return { size, arrows, seed: "" };
}

/** Simple fallback: one arrow per column pointing up, all lanes disjoint. */
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
  overflow: boolean;
  nodes: number;
}

/** Depth-first solvability check from a raw pose. Monotonic, so no cycles. */
export function solvableFrom(
  size: number,
  arrows: readonly ArrowTile[],
  heads: readonly number[],
  bodies: readonly number[],
  cap = SOLVER_NODE_CAP,
): SolveInfo {
  const memo = new Map<string, boolean>();
  let nodes = 0;
  let overflow = false;

  const key = (h: readonly number[], b: readonly number[]): string => `${h.join(",")}|${b.join(",")}`;

  const dfs = (h: number[], b: number[]): boolean => {
    if (b.every((body) => body <= 0)) return true;
    const k = key(h, b);
    const cached = memo.get(k);
    if (cached !== undefined) return cached;
    if (nodes >= cap) {
      overflow = true;
      return false;
    }
    nodes += 1;
    memo.set(k, false);
    for (const i of movableIndices(size, arrows, h, b)) {
      const step = applyStep(size, arrows, h, b, i);
      if (dfs(step.heads, step.bodies)) {
        memo.set(k, true);
        return true;
      }
    }
    return false;
  };

  const solvable = dfs(heads.slice(), bodies.slice());
  return { solvable, overflow: overflow && !solvable, nodes };
}

/* -------------------------------------------------------------- generation */

/**
 * Cheap trap detector: play the board forward with random legal launches and
 * report whether any run dead-ends (arrows remain but none can move). A dead
 * end found this way is a genuine reachable trap; a miss is only a false
 * negative, which generation tolerates by trying another candidate board.
 */
export function trapReachable(board: ArrowsBoard, rng: Rng, tries = 80): boolean {
  const arrows = board.arrows;
  const size = board.size;
  for (let t = 0; t < tries; t += 1) {
    let h = arrows.map((arrow) => arrow.head);
    let b = arrows.map((arrow) => arrow.length);
    let guard = 0;
    for (;;) {
      if (b.every((body) => body <= 0)) break;
      const moves = movableIndices(size, arrows, h, b);
      if (moves.length === 0) return true;
      const pick = moves[Math.floor(rng() * moves.length)] ?? moves[0]!;
      const step = applyStep(size, arrows, h, b, pick);
      h = step.heads;
      b = step.bodies;
      guard += 1;
      if (guard > 400) break;
    }
  }
  return false;
}

function isSolvable(board: ArrowsBoard): boolean {
  return solvableFrom(
    board.size,
    board.arrows,
    board.arrows.map((arrow) => arrow.head),
    board.arrows.map((arrow) => arrow.length),
  ).solvable;
}

function buildBoard(cfg: BoardConfig, rng: Rng, attempts = 60): ArrowsBoard {
  let last: ArrowsBoard | null = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const board = tryBuildRandomBoard(cfg, rng);
    if (!board) continue;
    last = board;
    // Random scattering already yields reachable dead ends on a large fraction
    // of boards, so only the cheap "avoid" case needs trap detection.
    if (cfg.trap === "avoid" && trapReachable(board, rng)) continue;
    if (!isSolvable(board)) continue;
    return board;
  }
  return last && isSolvable(last) ? last : fallbackBoard(cfg.size);
}

export function levelConfig(level: number): BoardConfig {
  const L = Math.min(ARROWS_TOTAL_LEVELS, Math.max(1, Math.floor(level)));
  if (L <= 12) {
    return {
      size: 4,
      count: Math.min(7, 4 + Math.floor((L - 1) / 4)),
      maxLock: L < 8 ? 0 : 1,
      length2: L < 5 ? 0 : 1,
      trap: L <= 3 ? "avoid" : "any",
    };
  }
  if (L <= 28) {
    return {
      size: 5,
      count: Math.min(8, 6 + Math.floor((L - 13) / 8)),
      maxLock: 2,
      length2: 1,
      trap: "any",
    };
  }
  if (L <= 46) {
    return {
      size: 6,
      count: Math.min(10, 8 + Math.floor((L - 29) / 9)),
      maxLock: 2,
      length2: 2,
      trap: "any",
    };
  }
  return {
    size: 7,
    count: Math.min(11, 10 + Math.floor((L - 47) / 10)),
    maxLock: 3,
    length2: 3,
    trap: "any",
  };
}

export function endlessConfig(index: number): BoardConfig {
  const i = Math.max(0, Math.floor(index));
  const size = Math.min(7, 4 + Math.floor(i / 5));
  return {
    size,
    count: Math.min(size + 3, size + 1 + Math.floor(i / 6)),
    maxLock: Math.min(3, 1 + Math.floor(i / 6)),
    length2: Math.min(3, 1 + Math.floor(i / 5)),
    trap: "any",
  };
}

export function dailyConfig(): BoardConfig {
  return { size: 6, count: 8, maxLock: 2, length2: 2, trap: "any" };
}

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
    heads: board.arrows.map((arrow) => arrow.head),
    bodies: board.arrows.map((arrow) => arrow.length),
    escaped: 0,
    launches: 0,
    hints: 0,
    par: parForBoard(board.size, board.arrows),
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

/**
 * A hint is a launch that keeps the board solvable. Falls back to any legal
 * move (or null) when the solver cannot decide within its node budget.
 */
export function safeLaunchIndex(state: ArrowsState): number | null {
  const moves = movableIndices(state.size, state.arrows, state.heads, state.bodies);
  if (moves.length === 0) return null;
  for (const i of moves) {
    const step = applyStep(state.size, state.arrows, state.heads, state.bodies, i);
    const info = solvableFrom(state.size, state.arrows, step.heads, step.bodies);
    if (info.solvable || info.overflow) return i;
  }
  return moves[0] ?? null;
}
