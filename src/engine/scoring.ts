import type { Puzzle } from "./types";
import { STAR_PAR, STAR_PAR_PLUS } from "./types";
import { calculatePar } from "./solver";

export function calculateStars(rotations: number, par: number): 1 | 2 | 3 {
  if (rotations <= par + STAR_PAR) return 3;
  if (rotations <= par + STAR_PAR_PLUS) return 2;
  return 1;
}

export function starsForPuzzle(puzzle: Puzzle, rotations: number): 1 | 2 | 3 {
  return calculateStars(rotations, calculatePar(puzzle));
}
