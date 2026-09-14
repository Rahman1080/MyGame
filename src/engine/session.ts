import { cloneCells, indexOfCell } from "./grid";
import { rotateDirection } from "./rotation";
import { getHint, type HintResult } from "./hints";
import { simulatePuzzle } from "./simulation";
import { calculateStars } from "./scoring";
import type { Cell, PlaySession, Puzzle } from "./types";

export function createSession(puzzle: Puzzle): PlaySession {
  return {
    puzzle,
    cells: cloneCells(puzzle.cells),
    rotations: 0,
    undoStack: [],
    hintUsed: false,
    strongHintUsed: false,
    hint: null,
    phase: "idle",
    failReason: undefined,
    lastFailReason: undefined,
    preLaunchCells: null,
    preLaunchRotations: 0,
    lastResult: null,
  };
}

function canEdit(session: PlaySession): boolean {
  return session.phase === "idle" || session.phase === "failed";
}

export function rotateCell(session: PlaySession, row: number, col: number): boolean {
  if (session.phase === "simulating" || session.phase === "won") return false;
  if (!canEdit(session) && session.phase !== "idle") return false;
  if (session.phase === "failed") return false;
  const i = indexOfCell(session.cells, row, col);
  if (i < 0) return false;
  const cell = session.cells[i];
  if (!cell || cell.locked) return false;
  if (cell.direction === undefined) return false;
  if (cell.type === "empty" || cell.type === "exit") return false;
  const prev = cell.direction;
  cell.direction = rotateDirection(prev, 1);
  session.undoStack.push({ index: i, prev });
  session.rotations += 1;
  session.hint = null;
  return true;
}

export function undo(session: PlaySession): boolean {
  if (session.phase !== "idle") return false;
  const last = session.undoStack.pop();
  if (!last) return false;
  const cell = session.cells[last.index];
  if (!cell) return false;
  cell.direction = last.prev;
  session.rotations = Math.max(0, session.rotations - 1);
  session.hint = null;
  return true;
}

export function reset(session: PlaySession): void {
  session.cells = cloneCells(session.puzzle.cells);
  session.rotations = 0;
  session.undoStack = [];
  session.phase = "idle";
  session.failReason = undefined;
  session.lastFailReason = undefined;
  session.preLaunchCells = null;
  session.lastResult = null;
  session.hint = null;
}

export function launch(session: PlaySession): boolean {
  if (session.phase === "simulating") return false;
  if (session.phase === "won") return false;
  if (session.phase === "failed") return false;
  session.preLaunchCells = cloneCells(session.cells);
  session.preLaunchRotations = session.rotations;
  session.phase = "simulating";
  session.hint = null;
  const result = simulatePuzzle(session.puzzle, session.cells);
  session.lastResult = result;
  session.lastFailReason = result.outcome === "win" ? undefined : result.reason;
  if (result.outcome === "win") {
    session.phase = "won";
    session.failReason = undefined;
  } else {
    session.phase = "failed";
    session.failReason = result.reason;
  }
  return true;
}

export function retry(session: PlaySession): boolean {
  if (session.phase !== "failed" && session.phase !== "won") return false;
  if (session.preLaunchCells) {
    session.cells = cloneCells(session.preLaunchCells);
    session.rotations = session.preLaunchRotations;
  }
  session.phase = "idle";
  session.failReason = undefined;
  session.lastResult = null;
  session.hint = null;
  return true;
}

export function hintTarget(session: PlaySession): Cell | undefined {
  const result = getHint(session.puzzle, {
    puzzleId: session.puzzle.id,
    cells: session.cells,
    rotations: session.rotations,
    hintUsed: session.hintUsed,
    strongHintUsed: session.strongHintUsed,
    lastFailReason: session.lastFailReason,
  });
  if (!result.available || !result.action) return undefined;
  return session.cells[indexOfCell(session.cells, result.action.row, result.action.col)];
}

/**
 * Hint tier still available for this puzzle: 1 = first precise hint,
 * 2 = optional stronger hint, 0 = none left.
 */
export function hintLevel(session: PlaySession): 1 | 2 | 0 {
  if (session.phase !== "idle") return 0;
  if (!session.hintUsed) return 1;
  if (!session.strongHintUsed) return 2;
  return 0;
}

/**
 * Compute and display a hint for the *current* board without rotating anything.
 * Recomputes every time so a stale highlight can never be reused.
 */
export function requestHint(session: PlaySession, level: 1 | 2 = 1): HintResult | null {
  if (session.phase !== "idle") return null;
  if (level === 1 && session.hintUsed) return null;
  if (level === 2 && (session.strongHintUsed || !session.hintUsed)) return null;
  const result = getHint(
    session.puzzle,
    {
      puzzleId: session.puzzle.id,
      cells: session.cells,
      rotations: session.rotations,
      hintUsed: session.hintUsed,
      strongHintUsed: session.strongHintUsed,
      lastFailReason: session.lastFailReason,
    },
    { level },
  );
  if (!result.available || !result.action) return result;
  session.hint = {
    row: result.action.row,
    col: result.action.col,
    to: result.action.to,
    message: result.message ?? "",
  };
  if (level === 1) session.hintUsed = true;
  else session.strongHintUsed = true;
  return result;
}

export function sessionStars(session: PlaySession): 1 | 2 | 3 {
  return calculateStars(session.rotations, session.puzzle.par);
}

export function snapshotCells(cells: Cell[]): Cell[] {
  return cloneCells(cells);
}
