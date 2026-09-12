import { cloneCells } from "./grid";
import { simulatePuzzle } from "./simulation";
import { minRotationsToCanonical } from "./scoring";
import type { Cell, Puzzle, SimResult } from "./types";

export function applyCanonical(cells: Cell[]): Cell[] {
  return cells.map((c) => ({
    ...c,
    direction: c.canonicalDir ?? c.direction,
  }));
}

export function solvePuzzle(puzzle: Puzzle): SimResult {
  const solved = applyCanonical(puzzle.cells);
  return simulatePuzzle(puzzle, solved);
}

export function isSolvable(puzzle: Puzzle): boolean {
  return solvePuzzle(puzzle).outcome === "win";
}

export function simulateCurrent(puzzle: Puzzle, cells: Cell[]): SimResult {
  return simulatePuzzle(puzzle, cells);
}

export function parFromCanonical(cells: Cell[]): number {
  return minRotationsToCanonical(cells);
}

export function cloneAndSolve(puzzle: Puzzle): { result: SimResult; cells: Cell[] } {
  const cells = applyCanonical(cloneCells(puzzle.cells));
  return { result: simulatePuzzle(puzzle, cells), cells };
}
