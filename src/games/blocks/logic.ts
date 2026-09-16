import { previousYmd } from "../../gen/daily";
import { dailySeed } from "../../platform/dailySeed";
import type { BlocksDailyRecord, BlocksSave } from "../../save/schema";
import { deal, shapeById, type ShapeDef, type ShapeTier } from "./generate";

export const BLOCKS_GRID = 8;
export const BLOCKS_SET_SIZE = 3;
export const BLOCKS_STAR_THRESHOLDS = [200, 700, 1500] as const;

export const BLOCKS_SCORE = {
  perCell: 2,
  lineUnit: 10,
  simultaneousBonus: 30,
  comboStep: 5,
  comboMax: 50,
  perfectBonus: 300,
} as const;

export interface PaletteColor {
  id: number;
  name: string;
  hex: string;
}

export const BLOCKS_PALETTE: readonly PaletteColor[] = [
  { id: 1, name: "cyan", hex: "#29DDF4" },
  { id: 2, name: "magenta", hex: "#E45CFF" },
  { id: 3, name: "lime", hex: "#9CFF4F" },
  { id: 4, name: "amber", hex: "#FFC857" },
  { id: 5, name: "violet", hex: "#7C6BFF" },
];

export function colorName(id: number): string {
  return BLOCKS_PALETTE.find((c) => c.id === id)?.name ?? "empty";
}

export function colorHex(id: number): string {
  return BLOCKS_PALETTE.find((c) => c.id === id)?.hex ?? "transparent";
}

/** Flat board of colour ids. 0 means an empty cell. */
export type Board = number[];

export interface Placement {
  row: number;
  col: number;
}

export interface LineClear {
  rows: number[];
  cols: number[];
  /** Unique cell indices covered by the cleared rows/cols. */
  cells: number[];
  lines: number;
}

export interface PlaceResult {
  board: Board;
  /** Board with the piece stamped but before any cleared lines were removed. */
  stamped: Board;
  placement: Placement;
  rows: number[];
  cols: number[];
  cells: number[];
  lines: number;
  perfect: boolean;
}

export interface BlocksState {
  size: number;
  board: Board;
  seed: string;
  mode: BlocksMode;
  date: string;
  batch: number;
  pieces: (ShapeDef | null)[];
  score: number;
  lines: number;
  combo: number;
  bestCombo: number;
  moves: number;
  status: "playing" | "over";
}

export type BlocksMode = "endless" | "daily";

export interface PlacementScore {
  points: number;
  combo: number;
  cells: number;
  lines: number;
  linePoints: number;
  comboBonus: number;
  simultaneous: boolean;
  perfect: boolean;
}

export interface BlocksResult {
  mode: BlocksMode;
  date: string;
  score: number;
  lines: number;
  bestCombo: number;
  moves: number;
  stars: number;
}

export interface PlaceOutcome {
  state: BlocksState;
  result: PlaceResult | null;
  illegal: boolean;
}

export function createBoard(size: number = BLOCKS_GRID): Board {
  return new Array<number>(size * size).fill(0);
}

export function idx(size: number, row: number, col: number): number {
  return row * size + col;
}

export function inBounds(size: number, row: number, col: number): boolean {
  return row >= 0 && col >= 0 && row < size && col < size;
}

export function cellAt(board: Board, size: number, row: number, col: number): number {
  if (!inBounds(size, row, col)) return -1;
  return board[idx(size, row, col)] ?? 0;
}

export function filledCount(board: Board): number {
  let n = 0;
  for (const c of board) if (c !== 0) n += 1;
  return n;
}

export function fillRatio(board: Board): number {
  return board.length === 0 ? 0 : filledCount(board) / board.length;
}

export function canPlace(board: Board, size: number, shape: ShapeDef, row: number, col: number): boolean {
  for (const [dr, dc] of shape.cells) {
    const r = row + dr;
    const c = col + dc;
    if (!inBounds(size, r, c)) return false;
    if (board[idx(size, r, c)] !== 0) return false;
  }
  return true;
}

export function findPlacements(board: Board, size: number, shape: ShapeDef): Placement[] {
  const out: Placement[] = [];
  const height = shapeHeight(shape);
  const width = shapeWidth(shape);
  for (let row = 0; row <= size - height; row += 1) {
    for (let col = 0; col <= size - width; col += 1) {
      if (canPlace(board, size, shape, row, col)) out.push({ row, col });
    }
  }
  return out;
}

export function hasPlacement(board: Board, size: number, shape: ShapeDef): boolean {
  const height = shapeHeight(shape);
  const width = shapeWidth(shape);
  for (let row = 0; row <= size - height; row += 1) {
    for (let col = 0; col <= size - width; col += 1) {
      if (canPlace(board, size, shape, row, col)) return true;
    }
  }
  return false;
}

export function shapeHeight(shape: ShapeDef): number {
  return shape.cells.reduce((m, [r]) => Math.max(m, r + 1), 0);
}

export function shapeWidth(shape: ShapeDef): number {
  return shape.cells.reduce((m, [, c]) => Math.max(m, c + 1), 0);
}

/** Immutably stamp a shape onto the board. Assumes the placement is legal. */
export function place(board: Board, size: number, shape: ShapeDef, row: number, col: number, color: number): Board {
  const next = board.slice();
  for (const [dr, dc] of shape.cells) {
    next[idx(size, row + dr, col + dc)] = color;
  }
  return next;
}

export function findFullRows(board: Board, size: number): number[] {
  const rows: number[] = [];
  for (let row = 0; row < size; row += 1) {
    let full = true;
    for (let col = 0; col < size; col += 1) {
      if (board[idx(size, row, col)] === 0) {
        full = false;
        break;
      }
    }
    if (full) rows.push(row);
  }
  return rows;
}

export function findFullCols(board: Board, size: number): number[] {
  const cols: number[] = [];
  for (let col = 0; col < size; col += 1) {
    let full = true;
    for (let row = 0; row < size; row += 1) {
      if (board[idx(size, row, col)] === 0) {
        full = false;
        break;
      }
    }
    if (full) cols.push(col);
  }
  return cols;
}

/** Detect completed rows and columns, deduping cells that sit on both. */
export function detectLines(board: Board, size: number): LineClear {
  const rows = findFullRows(board, size);
  const cols = findFullCols(board, size);
  const cells = new Set<number>();
  for (const row of rows) {
    for (let col = 0; col < size; col += 1) cells.add(idx(size, row, col));
  }
  for (const col of cols) {
    for (let row = 0; row < size; row += 1) cells.add(idx(size, row, col));
  }
  return { rows, cols, cells: [...cells], lines: rows.length + cols.length };
}

export function clearCells(board: Board, cells: readonly number[]): Board {
  const next = board.slice();
  for (const i of cells) next[i] = 0;
  return next;
}

export function applyPlacement(
  board: Board,
  size: number,
  shape: ShapeDef,
  row: number,
  col: number,
  color: number,
): PlaceResult | null {
  if (!canPlace(board, size, shape, row, col)) return null;
  const stamped = place(board, size, shape, row, col, color);
  const detected = detectLines(stamped, size);
  const cleared = detected.cells.length > 0 ? clearCells(stamped, detected.cells) : stamped;
  return {
    board: cleared,
    stamped,
    placement: { row, col },
    rows: detected.rows,
    cols: detected.cols,
    cells: detected.cells,
    lines: detected.lines,
    perfect: detected.lines > 0 && filledCount(cleared) === 0,
  };
}

export function lineScore(lines: number): number {
  if (lines <= 0) return 0;
  return lines * lines * BLOCKS_SCORE.lineUnit;
}

export function nextCombo(combo: number, lines: number): number {
  return lines > 0 ? combo + 1 : 0;
}

export function comboBonus(combo: number): number {
  const extra = Math.max(0, combo - 1);
  return Math.min(extra * BLOCKS_SCORE.comboStep, BLOCKS_SCORE.comboMax);
}

export function scorePlacement(opts: {
  cells: number;
  lines: number;
  rows: number;
  cols: number;
  combo: number;
  perfect: boolean;
}): PlacementScore {
  const simultaneous = opts.rows > 0 && opts.cols > 0;
  const linePoints = lineScore(opts.lines);
  const nextComboValue = nextCombo(opts.combo, opts.lines);
  const comboPoints = comboBonus(nextComboValue);
  const base = opts.cells * BLOCKS_SCORE.perCell;
  const simultaneousPoints = simultaneous ? BLOCKS_SCORE.simultaneousBonus : 0;
  const perfectPoints = opts.perfect ? BLOCKS_SCORE.perfectBonus : 0;
  return {
    points: base + linePoints + comboPoints + simultaneousPoints + perfectPoints,
    combo: nextComboValue,
    cells: opts.cells,
    lines: opts.lines,
    linePoints,
    comboBonus: comboPoints + simultaneousPoints + perfectPoints,
    simultaneous,
    perfect: opts.perfect,
  };
}

export function starsForScore(score: number): number {
  const safe = Math.max(0, Math.floor(score));
  if (safe >= BLOCKS_STAR_THRESHOLDS[2]) return 3;
  if (safe >= BLOCKS_STAR_THRESHOLDS[1]) return 2;
  if (safe >= BLOCKS_STAR_THRESHOLDS[0]) return 1;
  return 0;
}

export function createState(opts: { seed: string; mode: BlocksMode; date?: string; size?: number }): BlocksState {
  const size = Math.max(4, Math.floor(opts.size ?? BLOCKS_GRID));
  const base: BlocksState = {
    size,
    board: createBoard(size),
    seed: opts.seed,
    mode: opts.mode,
    date: opts.date ?? "",
    batch: 0,
    pieces: [null, null, null],
    score: 0,
    lines: 0,
    combo: 0,
    bestCombo: 0,
    moves: 0,
    status: "playing",
  };
  return withDealtPieces(base);
}

function withDealtPieces(state: BlocksState): BlocksState {
  const shapes = deal(state.seed, state.batch, state.board, state.size);
  const pieces: (ShapeDef | null)[] = shapes.map((s) => ({ ...s }));
  const next: BlocksState = { ...state, pieces, batch: state.batch + 1 };
  return { ...next, status: isDead(next) ? "over" : "playing" };
}

export function createDailyState(date: string): BlocksState {
  return createState({ seed: dailySeed(date, "blocks"), mode: "daily", date });
}

export function createEndlessState(seed: string): BlocksState {
  return createState({ seed, mode: "endless" });
}

export function remainingPieces(state: BlocksState): number {
  return state.pieces.filter((p) => p !== null).length;
}

export function activePieces(state: BlocksState): ShapeDef[] {
  return state.pieces.filter((p): p is ShapeDef => p !== null);
}

/** True when no remaining piece has a legal placement anywhere. */
export function isDead(state: BlocksState): boolean {
  const remaining = state.pieces.filter((p): p is ShapeDef => p !== null);
  if (remaining.length === 0) return false;
  for (const shape of remaining) {
    if (hasPlacement(state.board, state.size, shape)) return false;
  }
  return true;
}

export function isGameOver(state: BlocksState): boolean {
  return state.status === "over";
}

export function placePiece(state: BlocksState, pieceIndex: number, row: number, col: number): PlaceOutcome {
  if (state.status !== "playing") return { state, result: null, illegal: true };
  const shape = state.pieces[pieceIndex];
  if (!shape) return { state, result: null, illegal: true };
  const result = applyPlacement(state.board, state.size, shape, row, col, shape.color);
  if (!result) return { state, result: null, illegal: true };

  const scored = scorePlacement({
    cells: shape.cells.length,
    lines: result.lines,
    rows: result.rows.length,
    cols: result.cols.length,
    combo: state.combo,
    perfect: result.perfect,
  });
  const pieces = state.pieces.slice();
  pieces[pieceIndex] = null;

  let next: BlocksState = {
    ...state,
    board: result.board,
    pieces,
    score: state.score + scored.points,
    lines: state.lines + result.lines,
    combo: scored.combo,
    bestCombo: Math.max(state.bestCombo, scored.combo),
    moves: state.moves + 1,
  };
  if (next.pieces.every((p) => p === null)) next = withDealtPieces(next);
  else next = { ...next, status: isDead(next) ? "over" : "playing" };
  return { state: next, result, illegal: false };
}

export function finalResult(state: BlocksState): BlocksResult {
  return {
    mode: state.mode,
    date: state.date,
    score: state.score,
    lines: state.lines,
    bestCombo: state.bestCombo,
    moves: state.moves,
    stars: starsForScore(state.score),
  };
}

export function emptyBlocksSave(): BlocksSave {
  return {
    best: 0,
    runs: 0,
    lines: 0,
    bestCombo: 0,
    dailyStreak: 0,
    bestDailyStreak: 0,
    daily: {},
  };
}

export function isDailyDone(save: BlocksSave, date: string): boolean {
  return save.daily[date] !== undefined;
}

export function dailyRecordFor(save: BlocksSave, date: string): BlocksDailyRecord | null {
  return save.daily[date] ?? null;
}

export function dailyBestScore(save: BlocksSave, date: string): number {
  return save.daily[date]?.score ?? 0;
}

/**
 * Consecutive recorded daily dates ending at `date`. Derived from stored
 * records so replaying a completed day can never inflate the streak.
 */
export function dailyStreakOn(save: BlocksSave, date: string, limit = 400): number {
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

export function recordEndlessRun(save: BlocksSave, result: BlocksResult): BlocksSave {
  return {
    ...save,
    best: Math.max(save.best, result.score),
    runs: save.runs + 1,
    lines: save.lines + result.lines,
    bestCombo: Math.max(save.bestCombo, result.bestCombo),
  };
}

/** Records a daily run once. Replays leave the save untouched (no duplicate rewards). */
export function recordDailyRun(save: BlocksSave, result: BlocksResult): BlocksSave {
  if (result.mode !== "daily" || !result.date) return save;
  if (isDailyDone(save, result.date)) return save;
  const daily = {
    ...save.daily,
    [result.date]: { score: result.score, lines: result.lines, stars: result.stars },
  };
  const streak = dailyStreakOn({ ...save, daily }, result.date);
  return {
    ...save,
    best: Math.max(save.best, result.score),
    runs: save.runs + 1,
    lines: save.lines + result.lines,
    bestCombo: Math.max(save.bestCombo, result.bestCombo),
    dailyStreak: streak,
    bestDailyStreak: Math.max(save.bestDailyStreak, streak),
    daily,
  };
}

export function isLargeTier(tier: ShapeTier): boolean {
  return tier === "large";
}

export function shapeFromId(id: string): ShapeDef | undefined {
  return shapeById(id);
}
