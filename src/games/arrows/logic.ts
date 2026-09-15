import { previousYmd } from "../../gen/daily";
import type { ArrowsDailyRecord, ArrowsSave, LevelRecord } from "../../save/schema";

export const ARROWS_TOTAL_LEVELS = 60;
export const ARROWS_MIN_SIZE = 4;
export const ARROWS_MAX_SIZE = 7;
export const ARROWS_START_RESERVE = 12;
export const ARROWS_SCORE_PER_STAR = 200;

/** Arrow directions, clockwise starting at up. */
export type Dir = 0 | 1 | 2 | 3;

export const DIR_NAMES = ["up", "right", "down", "left"] as const;

const DIR_DR = [-1, 0, 1, 0] as const;
const DIR_DC = [0, 1, 0, -1] as const;

export type ArrowsMode = "level" | "endless" | "daily";

export type ArrowsCellKind = "empty" | "wall" | "arrow" | "exit" | "checkpoint";

export interface ArrowsCell {
  kind: ArrowsCellKind;
  dir: Dir;
  locked: boolean;
}

/** A launch point. Each source carries the exit its own beam must reach. */
export interface ArrowsSource {
  cell: number;
  dir: Dir;
  exit: number;
}

export interface ArrowsState {
  mode: ArrowsMode;
  level: number;
  boardIndex: number;
  size: number;
  cells: ArrowsCell[];
  sources: ArrowsSource[];
  checkpoints: number[];
  /** Canonical direction per needed cell, -1 elsewhere. */
  solution: number[];
  /** Needed arrow cells in canonical traversal order (used for hints). */
  order: number[];
  par: number;
  maxRotations: number | null;
  rotations: number;
  hints: number;
  seed: string;
  date: string;
  status: "playing" | "solved" | "failed";
}

/** Static, fully generated board definition before play begins. */
export interface ArrowsLevel {
  level: number;
  boardIndex: number;
  size: number;
  cells: ArrowsCell[];
  sources: ArrowsSource[];
  checkpoints: number[];
  solution: number[];
  order: number[];
  par: number;
  maxRotations: number | null;
  seed: string;
}

export interface ArrowsResult {
  mode: ArrowsMode;
  level: number;
  date: string;
  solved: boolean;
  rotations: number;
  par: number;
  hints: number;
  stars: number;
}

export function dirName(dir: Dir): string {
  return DIR_NAMES[dir];
}

export function rotateDir(dir: Dir): Dir {
  return ((dir + 1) % 4) as Dir;
}

export function rotateDirN(dir: Dir, turns: number): Dir {
  const n = ((turns % 4) + 4) % 4;
  return ((dir + n) % 4) as Dir;
}

export function rowOf(size: number, cell: number): number {
  return Math.floor(cell / size);
}

export function colOf(size: number, cell: number): number {
  return cell % size;
}

export function cellAt(size: number, row: number, col: number): number {
  return row * size + col;
}

/** Cell index one step in `dir`, or -1 when it leaves the board. */
export function stepCell(size: number, cell: number, dir: Dir): number {
  const row = rowOf(size, cell) + DIR_DR[dir];
  const col = colOf(size, cell) + DIR_DC[dir];
  if (row < 0 || col < 0 || row >= size || col >= size) return -1;
  return row * size + col;
}

/** Direction from one cell to an orthogonally adjacent cell, or null. */
export function dirBetween(size: number, from: number, to: number): Dir | null {
  const row0 = rowOf(size, from);
  const col0 = colOf(size, from);
  const row1 = rowOf(size, to);
  const col1 = colOf(size, to);
  for (let d = 0; d < 4; d += 1) {
    if (row0 + DIR_DR[d]! === row1 && col0 + DIR_DC[d]! === col1) return d as Dir;
  }
  return null;
}

export function cellLabel(state: ArrowsState, cell: number): string {
  const value = state.cells[cell];
  if (!value) return "empty";
  if (value.kind === "wall") return "wall";
  if (value.kind === "exit") return "exit";
  if (value.kind === "checkpoint") {
    return `checkpoint, beam must pass here, pointing ${dirName(value.dir)}`;
  }
  if (value.kind === "arrow") {
    return `${value.locked ? "locked " : ""}arrow pointing ${dirName(value.dir)}`;
  }
  if (state.sources.some((s) => s.cell === cell)) {
    return `energy source, launches ${dirName(state.sources.find((s) => s.cell === cell)?.dir ?? 0)}`;
  }
  return "empty";
}

/* ------------------------------------------------------------------ tracing */

export type TraceStatus = "exit" | "loop" | "blocked" | "out";

export interface ArrowsTrace {
  source: number;
  status: TraceStatus;
  /** Visited cells in order, including the source and (when reached) the exit. */
  path: number[];
}

export function traceSource(state: ArrowsState, index: number): ArrowsTrace {
  const source = state.sources[index];
  if (!source) return { source: index, status: "out", path: [] };
  let pos = source.cell;
  let dir = source.dir;
  const path = [pos];
  const seen = new Set<number>();
  const guard = state.size * state.size * 4 + 8;
  for (let i = 0; i < guard; i += 1) {
    const key = pos * 4 + dir;
    if (seen.has(key)) return { source: index, status: "loop", path };
    seen.add(key);
    const next = stepCell(state.size, pos, dir);
    if (next < 0) return { source: index, status: "out", path };
    const cell = state.cells[next];
    if (!cell) return { source: index, status: "out", path };
    if (cell.kind === "wall") return { source: index, status: "blocked", path };
    path.push(next);
    if (next === source.exit) return { source: index, status: "exit", path };
    if (cell.kind === "arrow" || cell.kind === "checkpoint") dir = cell.dir;
    pos = next;
  }
  return { source: index, status: "loop", path };
}

export function traceAll(state: ArrowsState): ArrowsTrace[] {
  return state.sources.map((_, index) => traceSource(state, index));
}

export function traceCheckpointsMet(state: ArrowsState, trace: ArrowsTrace): boolean {
  if (state.checkpoints.length === 0) return true;
  const visited = new Set(trace.path);
  return state.checkpoints.every((cell) => visited.has(cell));
}

/** Every source's beam reaches its own exit (and checkpoints when required). */
export function isSolved(state: ArrowsState): boolean {
  if (state.sources.length === 0) return false;
  for (let i = 0; i < state.sources.length; i += 1) {
    const trace = traceSource(state, i);
    if (trace.status !== "exit") return false;
    if (!traceCheckpointsMet(state, trace)) return false;
  }
  return true;
}

/* ----------------------------------------------------------------- rotating */

export type RotateReason = "" | "locked" | "limit" | "not-arrow" | "done";

export interface RotateOutcome {
  state: ArrowsState;
  changed: boolean;
  reason: RotateReason;
}

export function isRotatable(state: ArrowsState, cell: number): boolean {
  const value = state.cells[cell];
  return value?.kind === "arrow" && !value.locked;
}

export function canRotate(state: ArrowsState, cell: number): boolean {
  if (state.status !== "playing" || !isRotatable(state, cell)) return false;
  return state.maxRotations === null || state.rotations < state.maxRotations;
}

export function rotateCell(state: ArrowsState, cell: number): RotateOutcome {
  if (state.status !== "playing") return { state, changed: false, reason: "done" };
  const value = state.cells[cell];
  if (!value || value.kind !== "arrow") return { state, changed: false, reason: "not-arrow" };
  if (value.locked) return { state, changed: false, reason: "locked" };
  if (state.maxRotations !== null && state.rotations >= state.maxRotations) {
    return { state, changed: false, reason: "limit" };
  }
  const cells = state.cells.slice();
  cells[cell] = { ...value, dir: rotateDir(value.dir) };
  const rotations = state.rotations + 1;
  let next: ArrowsState = { ...state, cells, rotations };
  if (isSolved(next)) next = { ...next, status: "solved" };
  else if (state.maxRotations !== null && rotations >= state.maxRotations) next = { ...next, status: "failed" };
  return { state: next, changed: true, reason: "" };
}

/* -------------------------------------------------------------- hint/score */

/** First needed arrow, in canonical order, that no longer points the right way. */
export function hintCell(state: ArrowsState): number | null {
  for (const cell of state.order) {
    const value = state.cells[cell];
    if (!value || value.kind !== "arrow" || value.locked) continue;
    const target = state.solution[cell];
    if (target === undefined || target < 0) continue;
    if (value.dir !== target) return cell;
  }
  return null;
}

export function starsForRun(rotations: number, par: number, hints: number): number {
  const base = rotations <= par ? 3 : rotations <= par + 3 ? 2 : 1;
  return hints > 0 ? Math.min(base, 2) : base;
}

export function levelScore(rotations: number, par: number, hints: number, stars: number): number {
  const efficiency = Math.max(0, par + 5 - rotations) * 25;
  return Math.max(0, stars * ARROWS_SCORE_PER_STAR + efficiency - hints * 40);
}

export function boardValue(size: number, par: number, used: number): number {
  return size * size * 2 + Math.max(0, par + 3 - used) * 6;
}

export function createStateFrom(level: ArrowsLevel, mode: ArrowsMode, date = ""): ArrowsState {
  const state: ArrowsState = {
    mode,
    level: level.level,
    boardIndex: level.boardIndex,
    size: level.size,
    cells: level.cells,
    sources: level.sources,
    checkpoints: level.checkpoints,
    solution: level.solution,
    order: level.order,
    par: level.par,
    maxRotations: level.maxRotations,
    rotations: 0,
    hints: 0,
    seed: level.seed,
    date,
    status: "playing",
  };
  return isSolved(state) ? { ...state, status: "solved" } : state;
}

export function finalResult(state: ArrowsState): ArrowsResult {
  return {
    mode: state.mode,
    level: state.level,
    date: state.date,
    solved: state.status === "solved",
    rotations: state.rotations,
    par: state.par,
    hints: state.hints,
    stars: state.status === "solved" ? starsForRun(state.rotations, state.par, state.hints) : 0,
  };
}

/* -------------------------------------------------------------------- saves */

export function emptyArrowsSave(): ArrowsSave {
  return {
    levels: {},
    best: 0,
    runs: 0,
    boards: 0,
    bestRun: 0,
    dailyStreak: 0,
    bestDailyStreak: 0,
    daily: {},
  };
}

export function levelKey(level: number): string {
  return String(level);
}

export function levelRecord(save: ArrowsSave, level: number): LevelRecord | null {
  return save.levels[levelKey(level)] ?? null;
}

export function levelStars(save: ArrowsSave, level: number): number {
  return save.levels[levelKey(level)]?.stars ?? 0;
}

export function isLevelSolved(save: ArrowsSave, level: number): boolean {
  return save.levels[levelKey(level)]?.won === true;
}

export function isLevelUnlocked(save: ArrowsSave, level: number): boolean {
  if (level <= 1) return true;
  return isLevelSolved(save, level - 1);
}

export function levelsWon(save: ArrowsSave): number {
  return Object.values(save.levels).filter((record) => record.won).length;
}

export function isDailyDone(save: ArrowsSave, date: string): boolean {
  return save.daily[date] !== undefined;
}

export function dailyRecordFor(save: ArrowsSave, date: string): ArrowsDailyRecord | null {
  return save.daily[date] ?? null;
}

export function dailyBestStars(save: ArrowsSave, date: string): number {
  return save.daily[date]?.stars ?? 0;
}

/**
 * Consecutive solved daily dates ending at `date`. Derived from stored records
 * so replaying a completed day can never inflate the streak.
 */
export function dailyStreakOn(save: ArrowsSave, date: string, limit = 400): number {
  if (!isDailyDone(save, date)) return 0;
  let streak = 0;
  let cursor = date;
  for (let i = 0; i < limit; i += 1) {
    if (!isDailyDone(save, cursor)) break;
    streak += 1;
    cursor = previousYmd(cursor);
  }
  return streak;
}

export function recordLevelRun(save: ArrowsSave, result: ArrowsResult): ArrowsSave {
  if (result.mode !== "level") return save;
  const key = levelKey(result.level);
  const prev = save.levels[key];
  const won = prev?.won === true;
  const record: LevelRecord = {
    won: true,
    stars: Math.max(prev?.stars ?? 0, result.stars),
    best: won && prev ? Math.min(prev.best, result.rotations) : result.rotations,
    bestTimeMs: null,
    hints: (prev?.hints ?? 0) + result.hints,
    attempts: (prev?.attempts ?? 0) + 1,
  };
  return { ...save, boards: save.boards + 1, levels: { ...save.levels, [key]: record } };
}

/** Records a solved daily board once. Fails and replays leave the save untouched. */
export function recordDailyRun(save: ArrowsSave, result: ArrowsResult): ArrowsSave {
  if (result.mode !== "daily" || !result.date) return save;
  if (!result.solved) return save;
  if (isDailyDone(save, result.date)) return save;
  const daily = {
    ...save.daily,
    [result.date]: { solved: result.solved, rotations: result.rotations, stars: result.stars },
  };
  const streak = dailyStreakOn({ ...save, daily }, result.date);
  return {
    ...save,
    boards: save.boards + 1,
    dailyStreak: streak,
    bestDailyStreak: Math.max(save.bestDailyStreak, streak),
    daily,
  };
}

export function recordEndlessRun(save: ArrowsSave, score: number, cleared: number): ArrowsSave {
  const boards = Math.max(0, Math.floor(cleared));
  return {
    ...save,
    best: Math.max(save.best, Math.max(0, Math.floor(score))),
    runs: save.runs + 1,
    boards: save.boards + boards,
    bestRun: Math.max(save.bestRun, boards),
  };
}
