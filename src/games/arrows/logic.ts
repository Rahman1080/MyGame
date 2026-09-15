import { previousYmd } from "../../gen/daily";
import type { ArrowsDailyRecord, ArrowsSave, LevelRecord } from "../../save/schema";

export const ARROWS_TOTAL_LEVELS = 60;
export const ARROWS_MIN_SIZE = 4;
export const ARROWS_MAX_SIZE = 7;
export const ARROWS_SCORE_PER_STAR = 200;

/** Arrow headings, clockwise starting at up. */
export type Dir = 0 | 1 | 2 | 3;

export const DIR_NAMES = ["up", "right", "down", "left"] as const;

const DIR_DR = [-1, 0, 1, 0] as const;
const DIR_DC = [0, 1, 0, -1] as const;

export type ArrowsMode = "level" | "endless" | "daily";

export type ArrowsStatus = "playing" | "solved" | "stuck";

/** A single movable arrow. Its body extends opposite `dir` for `length` cells. */
export interface ArrowTile {
  id: number;
  dir: Dir;
  /** Head cell at the start of play. */
  head: number;
  /** Cells occupied by this arrow, head included. */
  length: number;
  /** Escapes required before this arrow may launch. 0 = free immediately. */
  lock: number;
}

/** Static, fully generated board definition. */
export interface ArrowsBoard {
  size: number;
  arrows: ArrowTile[];
  seed: string;
}

export interface ArrowsSnapshot {
  heads: number[];
  bodies: number[];
  escaped: number;
  launches: number;
}

export interface ArrowsState {
  mode: ArrowsMode;
  level: number;
  boardIndex: number;
  size: number;
  arrows: ArrowTile[];
  /** Current head cell per arrow; -1 once fully escaped. */
  heads: number[];
  /** Remaining body cells per arrow; 0 once fully escaped. */
  bodies: number[];
  escaped: number;
  /** Successful launches: each advances one arrow by one cell or off the board. */
  launches: number;
  hints: number;
  /** Minimum number of successful launches needed to clear the board. */
  par: number;
  seed: string;
  date: string;
  status: ArrowsStatus;
  history: ArrowsSnapshot[];
}

export interface ArrowsResult {
  mode: ArrowsMode;
  level: number;
  date: string;
  solved: boolean;
  launches: number;
  par: number;
  hints: number;
  stars: number;
}

export interface LaunchOutcome {
  state: ArrowsState;
  moved: boolean;
  reason: "" | "blocked" | "locked" | "escaped" | "done";
  arrow: number;
  /** Cells the arrow occupied before the launch. */
  from: number[];
  /** Cells the arrow occupies after the launch (empty when it fully escaped). */
  to: number[];
  /** The head left the board during this launch. */
  exited: boolean;
  /** The whole arrow left the board during this launch. */
  cleared: boolean;
}

export function oppositeDir(dir: Dir): Dir {
  return ((dir + 2) % 4) as Dir;
}

export function dirName(dir: Dir): string {
  return DIR_NAMES[dir];
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

/** The cells a body of `body` cells occupies, head first. */
export function bodyCells(size: number, dir: Dir, head: number, body: number): number[] {
  const out: number[] = [];
  let cell = head;
  const back = oppositeDir(dir);
  for (let i = 0; i < body; i += 1) {
    if (cell < 0 || cell >= size * size) break;
    out.push(cell);
    cell = stepCell(size, cell, back);
  }
  return out;
}

/** Steps the head needs to leave the board from `head` in `dir` (always >= 1). */
export function frontDistance(size: number, dir: Dir, head: number): number {
  let cell = head;
  for (let d = 1; ; d += 1) {
    const next = stepCell(size, cell, dir);
    if (next < 0) return d;
    cell = next;
  }
}

/** Total successful launches needed to clear one arrow from its start. */
export function arrowSteps(size: number, arrow: ArrowTile): number {
  return frontDistance(size, arrow.dir, arrow.head) + Math.max(0, arrow.length - 1);
}

export function parForBoard(size: number, arrows: readonly ArrowTile[]): number {
  return arrows.reduce((sum, arrow) => sum + arrowSteps(size, arrow), 0);
}

/* ------------------------------------------------------------------ queries */

export function isLocked(state: ArrowsState, index: number): boolean {
  const arrow = state.arrows[index];
  if (!arrow) return false;
  return state.escaped < arrow.lock;
}

export function isEscaped(state: ArrowsState, index: number): boolean {
  return (state.bodies[index] ?? 0) <= 0;
}

export function escapedCount(bodies: readonly number[]): number {
  return bodies.reduce((count, body) => (body <= 0 ? count + 1 : count), 0);
}

/** Every cell occupied by a live arrow, optionally skipping one index. */
export function occupiedAt(
  size: number,
  arrows: readonly ArrowTile[],
  heads: readonly number[],
  bodies: readonly number[],
  skip = -1,
): Set<number> {
  const set = new Set<number>();
  for (let i = 0; i < arrows.length; i += 1) {
    if (i === skip || (bodies[i] ?? 0) <= 0) continue;
    for (const cell of bodyCells(size, arrows[i]!.dir, heads[i]!, bodies[i]!)) set.add(cell);
  }
  return set;
}

/** Every movable arrow: unlocked, still on the board, with a clear next cell. */
export function movableIndices(
  size: number,
  arrows: readonly ArrowTile[],
  heads: readonly number[],
  bodies: readonly number[],
): number[] {
  const occupied = occupiedAt(size, arrows, heads, bodies);
  const escaped = escapedCount(bodies);
  const out: number[] = [];
  for (let i = 0; i < arrows.length; i += 1) {
    const arrow = arrows[i]!;
    if ((bodies[i] ?? 0) <= 0 || escaped < arrow.lock) continue;
    const next = stepCell(size, heads[i]!, arrow.dir);
    if (next === -1 || !occupied.has(next)) out.push(i);
  }
  return out;
}

export function movableArrows(state: ArrowsState): number[] {
  if (state.status !== "playing") return [];
  return movableIndices(state.size, state.arrows, state.heads, state.bodies);
}

function occupiedByOthers(state: ArrowsState, index: number, cell: number): boolean {
  return occupiedAt(state.size, state.arrows, state.heads, state.bodies, index).has(cell);
}

export function isSolved(state: ArrowsState): boolean {
  return state.bodies.every((body) => body <= 0);
}

export function isStuck(state: ArrowsState): boolean {
  if (isSolved(state)) return false;
  return movableArrows(state).length === 0;
}

/* ------------------------------------------------------------------- actions */

export function snapshot(state: ArrowsState): ArrowsSnapshot {
  return {
    heads: state.heads.slice(),
    bodies: state.bodies.slice(),
    escaped: state.escaped,
    launches: state.launches,
  };
}

function settle(state: ArrowsState): ArrowsState {
  if (isSolved(state)) return { ...state, status: "solved" };
  if (isStuck(state)) return { ...state, status: "stuck" };
  return state;
}

/** Poses after advancing arrow `index` one step (or off the board). Pure. */
export function applyStep(
  size: number,
  arrows: readonly ArrowTile[],
  heads: readonly number[],
  bodies: readonly number[],
  index: number,
): { heads: number[]; bodies: number[] } {
  const arrow = arrows[index]!;
  const nextHeads = heads.slice();
  const nextBodies = bodies.slice();
  const cells = bodyCells(size, arrow.dir, heads[index]!, bodies[index]!);
  const next = stepCell(size, heads[index]!, arrow.dir);
  if (next === -1) {
    const remaining = cells
      .slice(1)
      .map((cell) => stepCell(size, cell, arrow.dir))
      .filter((cell) => cell >= 0);
    if (remaining.length === 0) {
      nextHeads[index] = -1;
      nextBodies[index] = 0;
    } else {
      nextHeads[index] = remaining[0]!;
      nextBodies[index] = remaining.length;
    }
  } else {
    nextHeads[index] = next;
  }
  return { heads: nextHeads, bodies: nextBodies };
}

function blankOutcome(state: ArrowsState, index: number, reason: LaunchOutcome["reason"]): LaunchOutcome {
  return { state, moved: false, reason, arrow: index, from: [], to: [], exited: false, cleared: false };
}

export function launch(state: ArrowsState, index: number): LaunchOutcome {
  if (state.status !== "playing") return blankOutcome(state, index, "done");
  const arrow = state.arrows[index];
  if (!arrow) return blankOutcome(state, index, "done");
  if (isEscaped(state, index)) return blankOutcome(state, index, "escaped");
  if (isLocked(state, index)) return blankOutcome(state, index, "locked");

  const from = bodyCells(state.size, arrow.dir, state.heads[index]!, state.bodies[index]!);
  const next = stepCell(state.size, state.heads[index]!, arrow.dir);
  if (next !== -1 && occupiedByOthers(state, index, next)) {
    return { ...blankOutcome(state, index, "blocked"), from };
  }

  const stepped = applyStep(state.size, state.arrows, state.heads, state.bodies, index);
  const cleared = (stepped.bodies[index] ?? 0) <= 0;
  const to =
    (stepped.bodies[index] ?? 0) > 0
      ? bodyCells(state.size, arrow.dir, stepped.heads[index]!, stepped.bodies[index]!)
      : [];

  const nextState = settle({
    ...state,
    heads: stepped.heads,
    bodies: stepped.bodies,
    escaped: escapedCount(stepped.bodies),
    launches: state.launches + 1,
    history: [...state.history, snapshot(state)],
  });

  return {
    state: nextState,
    moved: true,
    reason: "",
    arrow: index,
    from,
    to,
    exited: next === -1,
    cleared,
  };
}

export function canUndo(state: ArrowsState): boolean {
  return state.status === "playing" && state.history.length > 0;
}

export function undo(state: ArrowsState): ArrowsState {
  if (!canUndo(state)) return state;
  const history = state.history.slice();
  const last = history.pop();
  if (!last) return state;
  return { ...state, ...last, status: "playing", history };
}

/* ------------------------------------------------------------------ scoring */

/** Stars come from staying unaided: each hint costs a star. */
export function starsForRun(_launches: number, _par: number, hints: number): number {
  if (hints <= 0) return 3;
  if (hints === 1) return 2;
  return 1;
}

export function levelScore(_launches: number, _par: number, hints: number, stars: number): number {
  return Math.max(0, stars * ARROWS_SCORE_PER_STAR - hints * 40);
}

export function boardValue(arrows: number, par: number): number {
  return Math.max(0, arrows) * 25 + Math.max(0, par) * 4;
}

export function finalResult(state: ArrowsState): ArrowsResult {
  const solved = state.status === "solved";
  return {
    mode: state.mode,
    level: state.level,
    date: state.date,
    solved,
    launches: state.launches,
    par: state.par,
    hints: state.hints,
    stars: solved ? starsForRun(state.launches, state.par, state.hints) : 0,
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
  if (result.mode !== "level" || !result.solved) return save;
  const key = levelKey(result.level);
  const prev = save.levels[key];
  const won = prev?.won === true;
  const record: LevelRecord = {
    won: true,
    stars: Math.max(prev?.stars ?? 0, result.stars),
    best: won && prev ? Math.min(prev.best, result.launches) : result.launches,
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
    [result.date]: { solved: true, launches: result.launches, stars: result.stars },
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
