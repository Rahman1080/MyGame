import { dailySeed } from "../../platform/dailySeed";
import { hashString, mulberry32, rngShuffle, type Rng } from "../../gen/seededRng";
import {
  ARROWS_TOTAL_LEVELS,
  cellAt,
  colOf,
  createStateFrom,
  dirBetween,
  isSolved,
  rotateDirN,
  rowOf,
  stepCell,
  type ArrowsCell,
  type ArrowsLevel,
  type ArrowsSource,
  type ArrowsState,
  type Dir,
} from "./logic";

export const ARROWS_LEVEL_VERSION = "v1";

export interface ArrowsConfig {
  size: number;
  pathMin: number;
  pathTarget: number;
  wallChance: number;
  decoyChance: number;
  locked: number;
  scrambleCount: number;
  scrambleTurns: number;
  checkpoints: number;
  sources: number;
  limitSlack: number | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function pathBounds(size: number): { min: number; max: number } {
  return { min: Math.max(3, size - 1), max: size * size - 3 };
}

/** Difficulty curve for the 60 handcrafted-by-generation levels. */
export function levelConfig(level: number): ArrowsConfig {
  const clamped = clamp(Math.floor(level), 1, ARROWS_TOTAL_LEVELS);
  const t = (clamped - 1) / (ARROWS_TOTAL_LEVELS - 1);
  const size = clamped <= 12 ? 4 : clamped <= 27 ? 5 : clamped <= 45 ? 6 : 7;
  const bounds = pathBounds(size);
  return {
    size,
    pathMin: bounds.min,
    pathTarget: Math.min(bounds.max, Math.round(size + t * size * 1.5)),
    wallChance: clamped < 4 ? 0 : 0.05 + t * 0.14,
    decoyChance: clamped < 3 ? 0 : 0.16 + t * 0.38,
    locked: clamped < 9 ? 0 : Math.min(3, Math.floor((clamped - 8) / 14) + 1),
    scrambleCount: Math.max(1, Math.round(1 + t * size * 1.1)),
    scrambleTurns: 2,
    checkpoints: size >= 5 && clamped >= 24 && clamped % 6 === 0 ? 1 : 0,
    sources: clamped >= 50 ? 2 : 1,
    limitSlack: clamped >= 18 && clamped % 6 === 0 ? (clamped >= 48 ? 1 : clamped >= 30 ? 2 : 3) : null,
  };
}

/** Endless boards ramp difficulty by board index instead of by level. */
export function endlessConfig(index: number): ArrowsConfig {
  const safe = Math.max(0, Math.floor(index));
  const t = Math.min(1, safe / 18);
  const size = Math.min(7, 4 + Math.floor(safe / 3));
  const bounds = pathBounds(size);
  return {
    size,
    pathMin: bounds.min,
    pathTarget: Math.min(bounds.max, Math.round(size + t * size * 1.6) + 1),
    wallChance: safe < 2 ? 0 : 0.06 + t * 0.12,
    decoyChance: safe < 1 ? 0 : 0.18 + t * 0.34,
    locked: safe < 5 ? 0 : Math.min(3, 1 + Math.floor(safe / 10)),
    scrambleCount: Math.max(1, Math.round(1 + t * size * 0.9)),
    scrambleTurns: 2,
    checkpoints: 0,
    sources: safe >= 14 ? 2 : 1,
    limitSlack: safe < 3 ? 4 : safe < 8 ? 3 : safe < 15 ? 2 : 1,
  };
}

export function dailyConfig(): ArrowsConfig {
  return {
    size: 6,
    pathMin: 6,
    pathTarget: 12,
    wallChance: 0.1,
    decoyChance: 0.34,
    locked: 1,
    scrambleCount: 5,
    scrambleTurns: 2,
    checkpoints: 0,
    sources: 1,
    limitSlack: null,
  };
}

function randomDir(rng: Rng): Dir {
  return Math.floor(rng() * 4) as Dir;
}

function pick<T>(rng: Rng, items: readonly T[]): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(rng() * items.length)];
}

function pickDeterministic<T>(rng: Rng, items: readonly T[], count: number): T[] {
  if (count <= 0 || items.length === 0) return [];
  return rngShuffle(rng, items.slice()).slice(0, Math.min(count, items.length));
}

function pickStart(rng: Rng, size: number, used: ReadonlySet<number>): number {
  const border: number[] = [];
  const any: number[] = [];
  for (let cell = 0; cell < size * size; cell += 1) {
    if (used.has(cell)) continue;
    any.push(cell);
    const row = rowOf(size, cell);
    const col = colOf(size, cell);
    if (row === 0 || col === 0 || row === size - 1 || col === size - 1) border.push(cell);
  }
  return pick(rng, border.length > 0 ? border : any) ?? -1;
}

/** Self-avoiding random walk with a mild bias towards going straight. */
function growPath(
  rng: Rng,
  size: number,
  used: ReadonlySet<number>,
  minLen: number,
  target: number,
): number[] | null {
  const start = pickStart(rng, size, used);
  if (start < 0) return null;
  const local = new Set<number>([start]);
  const path = [start];
  let heading: Dir | null = null;
  while (path.length < target) {
    const current = path[path.length - 1]!;
    const options: { cell: number; dir: Dir }[] = [];
    for (let d = 0; d < 4; d += 1) {
      const next = stepCell(size, current, d as Dir);
      if (next >= 0 && !used.has(next) && !local.has(next)) options.push({ cell: next, dir: d as Dir });
    }
    if (options.length === 0) break;
    const straight: { cell: number; dir: Dir } | undefined = heading === null ? undefined : options.find((o) => o.dir === heading);
    const choice: { cell: number; dir: Dir } = (straight && rng() < 0.62 ? straight : pick(rng, options))!;
    path.push(choice.cell);
    local.add(choice.cell);
    heading = choice.dir;
  }
  return path.length >= minLen ? path : null;
}

function chooseExit(
  rng: Rng,
  size: number,
  path: number[],
  minLen: number,
  used: ReadonlySet<number>,
  exits: readonly number[],
): { path: number[]; exit: number } | null {
  const maxTrim = Math.max(0, path.length - minLen);
  for (let trim = 0; trim <= maxTrim; trim += 1) {
    const cut = trim === 0 ? path.slice() : path.slice(0, path.length - trim);
    const last = cut[cut.length - 1]!;
    const options: number[] = [];
    for (let d = 0; d < 4; d += 1) {
      const next = stepCell(size, last, d as Dir);
      if (next < 0) continue;
      if (cut.includes(next) || used.has(next) || exits.includes(next)) continue;
      options.push(next);
    }
    const exit = pick(rng, options);
    if (exit !== undefined) return { path: cut, exit };
  }
  return null;
}

/**
 * Builds one board from a seed. Returns null when the seed produces a board
 * that is already solved, cannot be verified, or cannot fit the difficulty.
 */
function buildBoard(cfg: ArrowsConfig, seed: string, boardIndex: number, levelNumber: number): ArrowsLevel | null {
  const total = cfg.size * cfg.size;
  const rng = mulberry32(hashString(seed));
  const cells: ArrowsCell[] = Array.from({ length: total }, () => ({ kind: "empty", dir: 0, locked: false }));
  const solution = new Array<number>(total).fill(-1);
  const order: number[] = [];
  const sources: ArrowsSource[] = [];
  const used = new Set<number>();
  const exits: number[] = [];

  for (let s = 0; s < cfg.sources; s += 1) {
    const target = Math.max(cfg.pathMin, cfg.pathTarget - s);
    const walk = growPath(rng, cfg.size, used, cfg.pathMin, target);
    if (!walk) return null;
    const placed = chooseExit(rng, cfg.size, walk, cfg.pathMin, used, exits);
    if (!placed) return null;
    const path = placed.path;
    const exit = placed.exit;
    const first = path[0]!;
    const second = path[1] ?? exit;
    sources.push({ cell: first, dir: dirBetween(cfg.size, first, second) ?? 0, exit });
    for (let i = 1; i < path.length; i += 1) {
      const cell = path[i]!;
      const next = i + 1 < path.length ? path[i + 1]! : exit;
      const dir = dirBetween(cfg.size, cell, next) ?? 0;
      cells[cell] = { kind: "arrow", dir, locked: false };
      solution[cell] = dir;
      order.push(cell);
    }
    cells[exit] = { kind: "exit", dir: 0, locked: false };
    for (const cell of path) used.add(cell);
    used.add(exit);
    exits.push(exit);
  }

  for (let cell = 0; cell < total; cell += 1) {
    if (used.has(cell)) continue;
    const roll = rng();
    if (roll < cfg.wallChance) cells[cell] = { kind: "wall", dir: 0, locked: false };
    else if (roll < cfg.wallChance + cfg.decoyChance) {
      cells[cell] = { kind: "arrow", dir: randomDir(rng), locked: false };
    } else {
      cells[cell] = { kind: "empty", dir: 0, locked: false };
    }
  }

  const needed = order.slice();
  if (cfg.locked > 0 && needed.length > cfg.scrambleCount) {
    const lockable = needed.filter((cell) => cells[cell]?.kind === "arrow");
    const locks = pickDeterministic(rng, lockable, Math.min(cfg.locked, lockable.length - cfg.scrambleCount));
    for (const cell of locks) {
      const value = cells[cell]!;
      cells[cell] = { ...value, locked: true };
    }
  }

  const checkpoints: number[] = [];
  if (cfg.checkpoints > 0 && cfg.sources === 1 && needed.length >= 4) {
    const candidates = needed
      .slice(1, needed.length - 1)
      .filter((cell) => cells[cell]?.kind === "arrow" && cells[cell]?.locked !== true);
    const chosen = pickDeterministic(rng, candidates, Math.min(cfg.checkpoints, candidates.length));
    for (const cell of chosen) {
      const value = cells[cell]!;
      cells[cell] = { kind: "checkpoint", dir: value.dir, locked: true };
      checkpoints.push(cell);
    }
  }

  const scramblable = needed.filter((cell) => {
    const value = cells[cell];
    return value?.kind === "arrow" && !value.locked;
  });
  const scrambled = pickDeterministic(rng, scramblable, Math.min(cfg.scrambleCount, scramblable.length));
  let par = 0;
  for (const cell of scrambled) {
    const value = cells[cell]!;
    const turns = 1 + Math.floor(rng() * cfg.scrambleTurns);
    cells[cell] = { ...value, dir: rotateDirN(value.dir, -turns) };
    par += turns;
  }
  if (par <= 0) return null;

  const level: ArrowsLevel = {
    level: levelNumber,
    boardIndex,
    size: cfg.size,
    cells,
    sources,
    checkpoints,
    solution,
    order,
    par,
    maxRotations: cfg.limitSlack === null ? null : par + cfg.limitSlack,
    seed,
  };

  const scrambledState = createStateFrom(level, "level");
  if (isSolved(scrambledState)) return null;

  const canonicalCells = cells.map((cell, cellIndex) =>
    solution[cellIndex]! >= 0 ? { ...cell, dir: solution[cellIndex] as Dir } : { ...cell },
  );
  if (!isSolved(createStateFrom({ ...level, cells: canonicalCells }, "level"))) return null;

  return level;
}

/** Straight-corridor board used when every generated attempt is rejected. */
function fallbackLevel(cfg: ArrowsConfig, level: number, seed: string): ArrowsLevel {
  const size = cfg.size;
  const row = Math.floor(size / 2);
  const total = size * size;
  const cells: ArrowsCell[] = Array.from({ length: total }, () => ({ kind: "empty", dir: 0, locked: false }));
  const solution = new Array<number>(total).fill(-1);
  const order: number[] = [];
  for (let col = 1; col <= size - 2; col += 1) {
    const cell = cellAt(size, row, col);
    cells[cell] = { kind: "arrow", dir: 1, locked: false };
    solution[cell] = 1;
    order.push(cell);
  }
  const exit = cellAt(size, row, size - 1);
  cells[exit] = { kind: "exit", dir: 0, locked: false };
  const source = cellAt(size, row, 0);
  const firstArrow = order[0]!;
  cells[firstArrow] = { kind: "arrow", dir: 0, locked: false };
  const sources: ArrowsSource[] = [{ cell: source, dir: 1, exit }];
  return {
    level,
    boardIndex: 0,
    size,
    cells,
    sources,
    checkpoints: [],
    solution,
    order,
    par: 1,
    maxRotations: cfg.limitSlack === null ? null : 1 + cfg.limitSlack,
    seed,
  };
}

export function generateLevel(level: number): ArrowsLevel {
  const cfg = levelConfig(level);
  const base = `arrows:level:${Math.floor(level)}:${ARROWS_LEVEL_VERSION}`;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const built = buildBoard(cfg, attempt === 0 ? base : `${base}#${attempt}`, 0, Math.floor(level));
    if (built) return built;
  }
  return fallbackLevel(cfg, level, base);
}

export function generateEndlessBoard(seed: string, index: number): ArrowsLevel {
  const safe = Math.max(0, Math.floor(index));
  const cfg = endlessConfig(safe);
  const base = `${seed}#board:${safe}`;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const built = buildBoard(cfg, attempt === 0 ? base : `${base}#${attempt}`, safe, 0);
    if (built) return built;
  }
  return fallbackLevel(cfg, 0, base);
}

export function generateDailyBoard(date: string): ArrowsLevel {
  const cfg = dailyConfig();
  const base = dailySeed(date, "arrows");
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const built = buildBoard(cfg, attempt === 0 ? base : `${base}#${attempt}`, 0, 0);
    if (built) return built;
  }
  return fallbackLevel(cfg, 0, base);
}

export function createLevelState(level: number): ArrowsState {
  return createStateFrom(generateLevel(level), "level");
}

export function createEndlessState(seed: string, index: number): ArrowsState {
  return createStateFrom(generateEndlessBoard(seed, index), "endless");
}

export function createDailyState(date: string): ArrowsState {
  return createStateFrom(generateDailyBoard(date), "daily", date);
}
