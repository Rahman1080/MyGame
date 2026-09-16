import { previousYmd } from "../../gen/daily";
import { ARROWS_SAVE_VERSION, type ArrowsDailyRecord, type ArrowsSave, type LevelRecord } from "../../save/schema";

export const ARROWS_TOTAL_LEVELS = 100;
export const ARROWS_MIN_SIZE = 4;
export const ARROWS_MAX_SIZE = 9;
export const ARROWS_MAX_LENGTH = 3;
export const ARROWS_SCORE_PER_STAR = 200;

/** Arrow headings, clockwise starting at up. */
export type Dir = 0 | 1 | 2 | 3;

export const DIR_NAMES = ["up", "right", "down", "left"] as const;

const DIR_DR = [-1, 0, 1, 0] as const;
const DIR_DC = [0, 1, 0, -1] as const;

export type ArrowsMode = "level" | "endless" | "daily";

/** There is no fail state: a board is either in play or fully cleared. */
export type ArrowsStatus = "playing" | "solved";

/** A fixed arrow. Its body extends opposite `dir` for `length` cells. */
export interface ArrowTile {
  id: number;
  dir: Dir;
  /** Cell the arrow head starts on. */
  head: number;
  /** Cells the arrow occupies, head included (1-3). */
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

/** Undo point. Arrows never move, so only the live set and counters change. */
export interface ArrowsSnapshot {
  alive: boolean[];
  escaped: number;
  launches: number;
  missteps: number;
}

export interface ArrowsState {
  mode: ArrowsMode;
  level: number;
  boardIndex: number;
  size: number;
  arrows: ArrowTile[];
  /** Which arrows are still on the board. */
  alive: boolean[];
  escaped: number;
  /** Successful launches (each clears exactly one arrow). */
  launches: number;
  /** Taps the game rejected because the arrow was blocked or locked. */
  missteps: number;
  hints: number;
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
  missteps: number;
  hints: number;
  arrows: number;
  stars: number;
}

export interface LaneInfo {
  /** Cells between the head and the edge, head-first. Ends at the blocker when blocked. */
  cells: number[];
  blocked: boolean;
  /** Cell index that blocks the launch, or -1 when the lane is clear. */
  blocker: number;
}

export interface LaunchOutcome {
  state: ArrowsState;
  moved: boolean;
  reason: "" | "blocked" | "locked" | "escaped" | "done";
  arrow: number;
  /** True when this rejected tap counted as a misstep. */
  misstep: boolean;
  lane: number[];
  blocker: number;
}

/* ------------------------------------------------------------------ geometry */

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

/** The cells a body of `length` cells occupies, head first. */
export function bodyCells(size: number, dir: Dir, head: number, length: number): number[] {
  const out: number[] = [];
  let cell = head;
  const back = oppositeDir(dir);
  for (let i = 0; i < length; i += 1) {
    if (cell < 0 || cell >= size * size) break;
    out.push(cell);
    cell = stepCell(size, cell, back);
  }
  return out;
}

/** Cells between the head and the board edge, head-first, excluding the head. */
export function lanePath(size: number, dir: Dir, head: number): number[] {
  const out: number[] = [];
  let cell = head;
  for (;;) {
    const next = stepCell(size, cell, dir);
    if (next < 0) return out;
    out.push(next);
    cell = next;
  }
}

/* ------------------------------------------------------------------- queries */

export function isEscaped(state: ArrowsState, index: number): boolean {
  return state.alive[index] !== true;
}

export function isLocked(state: ArrowsState, index: number): boolean {
  const arrow = state.arrows[index];
  if (!arrow) return false;
  return state.escaped < arrow.lock;
}

/** Every cell occupied by a live arrow, optionally skipping one index. */
export function occupiedCells(
  size: number,
  arrows: readonly ArrowTile[],
  alive: readonly boolean[],
  skip = -1,
): Set<number> {
  const set = new Set<number>();
  for (let i = 0; i < arrows.length; i += 1) {
    if (i === skip || alive[i] !== true) continue;
    const arrow = arrows[i]!;
    for (const cell of bodyCells(size, arrow.dir, arrow.head, arrow.length)) set.add(cell);
  }
  return set;
}

/** True when any other live arrow's body sits in `index`'s lane. */
export function laneBlocked(
  size: number,
  arrows: readonly ArrowTile[],
  alive: readonly boolean[],
  index: number,
): boolean {
  const arrow = arrows[index];
  if (!arrow) return true;
  const occupied = occupiedCells(size, arrows, alive, index);
  for (const cell of lanePath(size, arrow.dir, arrow.head)) {
    if (occupied.has(cell)) return true;
  }
  return false;
}

export function laneInfo(state: ArrowsState, index: number): LaneInfo {
  const arrow = state.arrows[index];
  if (!arrow || state.alive[index] !== true) return { cells: [], blocked: false, blocker: -1 };
  const occupied = occupiedCells(state.size, state.arrows, state.alive, index);
  const cells: number[] = [];
  let cell = arrow.head;
  for (;;) {
    const next = stepCell(state.size, cell, arrow.dir);
    if (next < 0) return { cells, blocked: false, blocker: -1 };
    cells.push(next);
    if (occupied.has(next)) return { cells, blocked: true, blocker: next };
    cell = next;
  }
}

export function canLaunch(state: ArrowsState, index: number): boolean {
  if (state.alive[index] !== true) return false;
  if (isLocked(state, index)) return false;
  return !laneBlocked(state.size, state.arrows, state.alive, index);
}

/** Ready arrows from raw arrays (used by the solver and generator). */
export function readyIndices(
  size: number,
  arrows: readonly ArrowTile[],
  alive: readonly boolean[],
  escaped: number,
): number[] {
  const out: number[] = [];
  for (let i = 0; i < arrows.length; i += 1) {
    const arrow = arrows[i]!;
    if (alive[i] !== true || escaped < arrow.lock) continue;
    if (!laneBlocked(size, arrows, alive, i)) out.push(i);
  }
  return out;
}

export function availableIndices(state: ArrowsState): number[] {
  if (state.status !== "playing") return [];
  return readyIndices(state.size, state.arrows, state.alive, state.escaped);
}

export function availableCount(state: ArrowsState): number {
  return availableIndices(state).length;
}

export function remainingArrows(state: ArrowsState): number {
  return state.alive.reduce((count, live) => (live ? count + 1 : count), 0);
}

export function isSolved(state: ArrowsState): boolean {
  return state.escaped >= state.arrows.length;
}

export function isStuck(state: ArrowsState): boolean {
  if (isSolved(state)) return false;
  return availableIndices(state).length === 0;
}

/* ------------------------------------------------------------------- actions */

export function snapshot(state: ArrowsState): ArrowsSnapshot {
  return {
    alive: state.alive.slice(),
    escaped: state.escaped,
    launches: state.launches,
    missteps: state.missteps,
  };
}

function settle(state: ArrowsState): ArrowsState {
  return isSolved(state) ? { ...state, status: "solved" } : state;
}

function reject(
  state: ArrowsState,
  index: number,
  reason: LaunchOutcome["reason"],
  lane: number[],
  blocker: number,
  misstep: boolean,
): LaunchOutcome {
  return {
    state: misstep ? { ...state, missteps: state.missteps + 1 } : state,
    moved: false,
    reason,
    arrow: index,
    misstep,
    lane,
    blocker,
  };
}

/**
 * Launch an arrow. It escapes (and is removed) only when its whole lane to the
 * edge is free of every other live arrow's body and its lock is satisfied.
 */
export function launch(state: ArrowsState, index: number): LaunchOutcome {
  const arrow = state.arrows[index];
  if (state.status !== "playing") return reject(state, index, "done", [], -1, false);
  if (!arrow || state.alive[index] !== true) return reject(state, index, "escaped", [], -1, false);
  const info = laneInfo(state, index);
  if (isLocked(state, index)) return reject(state, index, "locked", info.cells, info.blocker, true);
  if (info.blocked) return reject(state, index, "blocked", info.cells, info.blocker, true);

  const alive = state.alive.slice();
  alive[index] = false;
  const next = settle({
    ...state,
    alive,
    escaped: state.escaped + 1,
    launches: state.launches + 1,
    history: [...state.history, snapshot(state)],
  });
  return { state: next, moved: true, reason: "", arrow: index, misstep: false, lane: info.cells, blocker: -1 };
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

/** Stars reward a clean run: no hints and no wasted taps for three. */
export function starsForRun(hints: number, missteps: number): number {
  if (hints <= 0 && missteps <= 0) return 3;
  if (hints <= 1 && missteps <= 3) return 2;
  return 1;
}

export function levelScore(_launches: number, hints: number, stars: number): number {
  return Math.max(0, stars * ARROWS_SCORE_PER_STAR - hints * 40);
}

export function boardValue(arrows: number, ready: number): number {
  return Math.max(0, arrows) * 25 + Math.max(0, ready) * 8;
}

export function finalResult(state: ArrowsState): ArrowsResult {
  const solved = state.status === "solved";
  return {
    mode: state.mode,
    level: state.level,
    date: state.date,
    solved,
    launches: state.launches,
    missteps: state.missteps,
    hints: state.hints,
    arrows: state.arrows.length,
    stars: solved ? starsForRun(state.hints, state.missteps) : 0,
  };
}

/* -------------------------------------------------------------------- saves */

export function emptyArrowsSave(): ArrowsSave {
  return {
    version: ARROWS_SAVE_VERSION,
    levels: {},
    best: 0,
    runs: 0,
    boards: 0,
    bestRun: 0,
    perfect: 0,
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

/** A three-star level is by definition hint-free and misstep-free. */
export function perfectLevels(save: ArrowsSave): number {
  return Math.max(0, Math.floor(save.perfect));
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
  const stars = Math.max(prev?.stars ?? 0, result.stars);
  const record: LevelRecord = {
    won: true,
    stars,
    best: won && prev ? Math.min(prev.best, result.launches) : result.launches,
    bestTimeMs: null,
    hints: (prev?.hints ?? 0) + result.hints,
    attempts: (prev?.attempts ?? 0) + 1,
  };
  const wasPerfect = (prev?.stars ?? 0) >= 3;
  const gained = !wasPerfect && stars >= 3 ? 1 : 0;
  return {
    ...save,
    perfect: save.perfect + gained,
    boards: save.boards + 1,
    levels: { ...save.levels, [key]: record },
  };
}

/** Records a solved daily board once. Replays leave the save untouched. */
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
