export type Direction = 0 | 1 | 2 | 3;

export const DIR_UP = 0 as const;
export const DIR_RIGHT = 1 as const;
export const DIR_DOWN = 2 as const;
export const DIR_LEFT = 3 as const;

export type CellType = "empty" | "arrow" | "start" | "exit" | "gate";

export type ColorName = "cyan" | "magenta" | "amber" | "lime";

export type FailReason =
  | "DEAD_END"
  | "OFF_GRID"
  | "LOOP"
  | "EXIT_TOO_SOON"
  | "MISSED_NODE"
  | "WRONG_COLOR";

export interface Cell {
  row: number;
  col: number;
  type: CellType;
  direction?: Direction;
  canonicalDir?: Direction;
  locked?: boolean;
  required?: boolean;
  color?: ColorName;
}

export interface Coord {
  row: number;
  col: number;
}

// How `par` was derived.
//  - "minimum":   exact minimum rotations from the initial state to a valid
//                 solution (search-based solver completed within budget).
//  - "canonical": sum of clockwise steps from the initial state to the
//                 generator's canonical route. This is an upper bound on the
//                 true minimum and is used when the exact search is not run or
//                 exceeds its deterministic state budget.
export type ParKind = "minimum" | "canonical";

export interface Puzzle {
  id: string;
  seed: number;
  size: number;
  cells: Cell[];
  start: Coord;
  exit: Coord;
  par: number;
  parKind?: ParKind;
  difficulty: number;
  pack: string;
  tutorial?: boolean;
  tutorialStep?: 1 | 2 | 3;
  canonical?: Direction[];
}

export interface SimStep {
  row: number;
  col: number;
  color: ColorName;
}

export interface SimResult {
  outcome: "win" | "fail";
  reason?: FailReason;
  path: SimStep[];
}

export type SessionPhase = "idle" | "simulating" | "won" | "failed";

export interface PlaySession {
  puzzle: Puzzle;
  cells: Cell[];
  rotations: number;
  undoStack: { index: number; prev: Direction }[];
  hintUsed: boolean;
  hint: { row: number; col: number } | null;
  phase: SessionPhase;
  failReason?: FailReason;
  preLaunchCells: Cell[] | null;
  preLaunchRotations: number;
  lastResult: SimResult | null;
}

export const STAR_PAR = 0;
export const STAR_PAR_PLUS = 2;

export const COLORS: ColorName[] = ["cyan", "magenta", "amber", "lime"];
