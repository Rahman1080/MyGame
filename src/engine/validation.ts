import { getCell, inBounds } from "./grid";
import { calculatePar, computePar, isCanonicalSolvable } from "./solver";
import type { Puzzle } from "./types";

export interface Validation {
  ok: boolean;
  errors: string[];
}

/** Structural checks only: shape, coordinates, cell types, duplicates. */
export function validateStructure(puzzle: Puzzle): Validation {
  const errors: string[] = [];
  if (!Number.isInteger(puzzle.size) || puzzle.size < 3 || puzzle.size > 6) errors.push("size");
  if (!inBounds(puzzle.size, puzzle.start.row, puzzle.start.col)) errors.push("start");
  if (!inBounds(puzzle.size, puzzle.exit.row, puzzle.exit.col)) errors.push("exit");
  const start = getCell(puzzle.cells, puzzle.start.row, puzzle.start.col);
  const exit = getCell(puzzle.cells, puzzle.exit.row, puzzle.exit.col);
  if (!start || start.type !== "start") errors.push("start-cell");
  if (!exit || exit.type !== "exit") errors.push("exit-cell");
  if (puzzle.cells.length !== puzzle.size * puzzle.size) errors.push("cell-count");

  const seen = new Set<string>();
  const portalCounts = new Map<string, number>();
  let portalWithoutId = false;
  for (const c of puzzle.cells) {
    if (!inBounds(puzzle.size, c.row, c.col)) {
      errors.push("oob-cell");
      continue;
    }
    const k = `${c.row},${c.col}`;
    if (seen.has(k)) errors.push("duplicate-cell");
    seen.add(k);
    if (c.locked && c.direction === undefined) errors.push("locked-empty");
    if (c.required && c.type === "empty") errors.push("required-empty");
    if (c.required && c.type !== "exit" && c.direction === undefined) errors.push("required-no-dir");
    if (c.type === "wall" && c.wallDir === undefined) errors.push("wall-no-dir");
    if (c.type === "portal") {
      if (c.portalId === undefined) portalWithoutId = true;
      else portalCounts.set(c.portalId, (portalCounts.get(c.portalId) ?? 0) + 1);
    }
  }
  if (portalWithoutId) errors.push("portal-no-id");
  for (const count of portalCounts.values()) {
    if (count !== 2) errors.push("portal-unbalanced");
  }
  return { ok: errors.length === 0, errors };
}

/** The generator's canonical route must actually win. */
export function validateCanonicalSolution(puzzle: Puzzle): Validation {
  return isCanonicalSolvable(puzzle)
    ? { ok: true, errors: [] }
    : { ok: false, errors: ["unsolvable-canonical"] };
}

/** The solver must confirm solvability (canonical fallback also counts). */
export function validateSolverResult(puzzle: Puzzle): Validation {
  const info = computePar(puzzle, "minimum");
  if (info.solvable) return { ok: true, errors: [] };
  return isCanonicalSolvable(puzzle)
    ? { ok: true, errors: [] }
    : { ok: false, errors: ["unsolvable-solver"] };
}

/** Full pipeline: structure + solvability + par + difficulty sanity. */
export function validateFinal(puzzle: Puzzle): Validation {
  const errors: string[] = [];
  errors.push(...validateStructure(puzzle).errors);
  if (!isCanonicalSolvable(puzzle)) errors.push("unsolvable");
  const par = calculatePar(puzzle);
  if (!Number.isFinite(puzzle.par) || puzzle.par < 0) errors.push("par");
  if (par !== puzzle.par) errors.push("par-mismatch");
  if (!Number.isFinite(puzzle.difficulty) || puzzle.difficulty < 0) errors.push("difficulty");
  return { ok: errors.length === 0, errors };
}

export function validatePuzzle(puzzle: Puzzle): Validation {
  return validateFinal(puzzle);
}
