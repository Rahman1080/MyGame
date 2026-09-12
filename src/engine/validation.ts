import { getCell, inBounds } from "./grid";
import { isSolvable } from "./solver";
import { calculatePar } from "./scoring";
import type { Puzzle } from "./types";

export interface Validation {
  ok: boolean;
  errors: string[];
}

export function validatePuzzle(puzzle: Puzzle): Validation {
  const errors: string[] = [];
  if (puzzle.size < 3 || puzzle.size > 6) errors.push("size");
  if (!inBounds(puzzle.size, puzzle.start.row, puzzle.start.col)) errors.push("start");
  if (!inBounds(puzzle.size, puzzle.exit.row, puzzle.exit.col)) errors.push("exit");
  const start = getCell(puzzle.cells, puzzle.start.row, puzzle.start.col);
  const exit = getCell(puzzle.cells, puzzle.exit.row, puzzle.exit.col);
  if (!start || start.type !== "start") errors.push("start-cell");
  if (!exit || exit.type !== "exit") errors.push("exit-cell");
  if (puzzle.cells.length !== puzzle.size * puzzle.size) errors.push("cell-count");
  for (const c of puzzle.cells) {
    if (!inBounds(puzzle.size, c.row, c.col)) errors.push("oob-cell");
    if (c.locked && c.direction === undefined) errors.push("locked-empty");
    if (c.required && c.type === "empty") errors.push("required-empty");
  }
  if (!isSolvable(puzzle)) errors.push("unsolvable");
  const par = calculatePar(puzzle);
  if (par !== puzzle.par) errors.push("par-mismatch");
  if (par < 0) errors.push("par");
  return { ok: errors.length === 0, errors };
}
