import { clockwiseDistance } from "./rotation";
import type { Cell, Puzzle } from "./types";
import { STAR_PAR, STAR_PAR_PLUS } from "./types";

export function minRotationsToCanonical(cells: Cell[]): number {
  let total = 0;
  for (const c of cells) {
    if (c.locked) continue;
    if (c.direction === undefined || c.canonicalDir === undefined) continue;
    total += clockwiseDistance(c.direction, c.canonicalDir);
  }
  return total;
}

export function calculatePar(puzzle: Puzzle, cells: Cell[] = puzzle.cells): number {
  return minRotationsToCanonical(cells);
}

export function calculateStars(rotations: number, par: number): 1 | 2 | 3 {
  if (rotations <= par + STAR_PAR) return 3;
  if (rotations <= par + STAR_PAR_PLUS) return 2;
  return 1;
}
