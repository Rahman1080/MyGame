import { cloneCells, getCell, indexOfCell } from "./grid";
import { resolveStep } from "./movement";
import { DEFAULT_MECHANICS } from "./mechanics";
import { requiredExitColor } from "./colorRules";
import { applyCanonical, canonicalPar, canonicalSolution, minimumRotationSolver } from "./solver";
import { simulatePuzzle } from "./simulation";
import { clockwiseDistance, rotateDirection } from "./rotation";
import type {
  Cell,
  Direction,
  FailReason,
  MechanicFlags,
  ParKind,
  Puzzle,
  SimStep,
} from "./types";

/**
 * INTELLIGENT HINT SYSTEM
 *
 * A hint is always derived from the player's *current* board and verified by
 * the real engine before it is shown. The pipeline is:
 *
 *   current state -> build a verified solution -> rank candidate rotations
 *   -> simulate/solve each candidate -> choose -> explain -> show
 *
 * The engine never guesses and never inspects UI state. `getHint` is pure and
 * deterministic: the same puzzle + board always yields the same hint.
 */

export interface RotationAction {
  row: number;
  col: number;
  from: Direction;
  to: Direction;
  clockwiseSteps: number;
}

export interface Solution {
  /** Target outgoing direction per cell index; undefined = leave as-is. */
  directions: Array<Direction | undefined>;
  actions: RotationAction[];
  rotations: number;
  exact: boolean;
  parKind: ParKind;
  /** Route position per cell index, used to understand partial progress. */
  order: Map<number, number>;
}

export interface PlayerSolveState {
  puzzleId: string;
  cells: Cell[];
  rotations: number;
  hintUsed: boolean;
  strongHintUsed: boolean;
  lastFailReason?: FailReason;
}

export type HintMechanism = "portal" | "gate" | "wall" | "node" | "exit" | "arrow";

export interface HintCandidate {
  action: RotationAction;
  index: number;
  target: Direction;
  required: boolean;
  orderIndex: number;
  mechanism: HintMechanism;
  score: number;
}

export type HintConfidence = "exact" | "verified" | "fallback";

export interface HintResult {
  available: boolean;
  confidence: HintConfidence;
  action?: RotationAction;
  secondAction?: RotationAction;
  message?: string;
  explanation?: string;
  distance: number;
  candidates: HintCandidate[];
}

export interface HintOptions {
  /** 1 = precise first hint, 2 = stronger second hint. */
  level?: 1 | 2;
  flags?: MechanicFlags;
}

function key(row: number, col: number): string {
  return `${row},${col}`;
}

function indexByCoord(cells: Cell[]): Map<string, number> {
  const map = new Map<string, number>();
  cells.forEach((c, i) => map.set(key(c.row, c.col), i));
  return map;
}

function dirTo(a: { row: number; col: number }, b: { row: number; col: number }): Direction | undefined {
  const dr = b.row - a.row;
  const dc = b.col - a.col;
  if (dr === -1 && dc === 0) return 0;
  if (dr === 0 && dc === 1) return 1;
  if (dr === 1 && dc === 0) return 2;
  if (dr === 0 && dc === -1) return 3;
  return undefined;
}

/** A cell the player is allowed to rotate and whose arrow drives movement. */
function rotatableTarget(cell: Cell | undefined): boolean {
  if (!cell || cell.locked || cell.direction === undefined) return false;
  return cell.type !== "empty" && cell.type !== "exit" && cell.type !== "wall" && cell.type !== "portal";
}

function targetsFromPath(
  cells: Cell[],
  path: Array<{ row: number; col: number }>,
): { directions: Array<Direction | undefined>; order: Map<number, number> } {
  const idx = indexByCoord(cells);
  const directions = new Array<Direction | undefined>(cells.length).fill(undefined);
  const order = new Map<number, number>();
  for (let k = 0; k < path.length; k += 1) {
    const step = path[k]!;
    const i = idx.get(key(step.row, step.col));
    if (i !== undefined && !order.has(i)) order.set(i, k);
  }
  for (let k = 0; k + 1 < path.length; k += 1) {
    const a = path[k]!;
    const b = path[k + 1]!;
    const i = idx.get(key(a.row, a.col));
    if (i === undefined || !rotatableTarget(cells[i])) continue;
    const d = dirTo(a, b);
    if (d !== undefined) directions[i] = d;
  }
  return { directions, order };
}

function finishSolution(
  cells: Cell[],
  directions: Array<Direction | undefined>,
  order: Map<number, number>,
  rotations: number,
  exact: boolean,
  parKind: ParKind,
): Solution {
  const actions: RotationAction[] = [];
  for (let i = 0; i < cells.length; i += 1) {
    const target = directions[i];
    const cell = cells[i];
    if (target === undefined || !rotatableTarget(cell)) continue;
    if (cell!.direction === undefined || cell!.direction === target) continue;
    actions.push({
      row: cell!.row,
      col: cell!.col,
      from: cell!.direction,
      to: target,
      clockwiseSteps: clockwiseDistance(cell!.direction, target),
    });
  }
  actions.sort((a, b) => {
    const oa = order.get(indexOfCell(cells, a.row, a.col)) ?? Number.MAX_SAFE_INTEGER;
    const ob = order.get(indexOfCell(cells, b.row, b.col)) ?? Number.MAX_SAFE_INTEGER;
    if (oa !== ob) return oa - ob;
    if (a.row !== b.row) return a.row - b.row;
    return a.col - b.col;
  });
  return { directions, actions, rotations, exact, parKind, order };
}

/**
 * Build a verified solution from the player's current board.
 *
 * Prefers the proven exact-minimum solution (which honours the rotations the
 * player already made). Falls back to the canonical route only when the exact
 * search cannot complete, and only if that route is actually reachable from the
 * current board (no locked cell forced to an impossible direction).
 */
export function buildSolution(puzzle: Puzzle, cells: Cell[]): Solution | null {
  const current: Puzzle = { ...puzzle, cells };
  const exact = minimumRotationSolver(current);
  if (exact.exact && exact.solvable && exact.path) {
    const idx = indexByCoord(cells);
    const directions = new Array<Direction | undefined>(cells.length).fill(undefined);
    const order = new Map<number, number>();
    if (exact.routeDirs) {
      for (let i = 0; i < cells.length; i += 1) {
        const d = exact.routeDirs[i];
        if (d !== undefined && rotatableTarget(cells[i])) directions[i] = d;
      }
    } else {
      for (let k = 0; k + 1 < exact.path.length; k += 1) {
        const a = exact.path[k]!;
        const b = exact.path[k + 1]!;
        const i = idx.get(key(a.row, a.col));
        if (i === undefined || !rotatableTarget(cells[i])) continue;
        const d = dirTo(a, b);
        if (d !== undefined) directions[i] = d;
      }
    }
    for (let k = 0; k < exact.path.length; k += 1) {
      const step = exact.path[k]!;
      const i = idx.get(key(step.row, step.col));
      if (i !== undefined && !order.has(i)) order.set(i, k);
    }
    return finishSolution(cells, directions, order, exact.rotations, true, "minimum");
  }

  const canonical = canonicalSolution({ ...puzzle, cells });
  if (canonical.result.outcome === "win") {
    const directions = new Array<Direction | undefined>(cells.length).fill(undefined);
    for (let i = 0; i < cells.length; i += 1) {
      const cell = cells[i]!;
      const target = cell.canonicalDir;
      if (target === undefined) continue;
      if (cell.locked && cell.direction !== target) return null;
      if (rotatableTarget(cell)) directions[i] = target;
    }
    const { order } = targetsFromPath(cells, canonical.result.path);
    let rotations = 0;
    for (let i = 0; i < cells.length; i += 1) {
      const target = directions[i];
      const cell = cells[i]!;
      if (target === undefined || cell.direction === undefined) continue;
      rotations += clockwiseDistance(cell.direction, target);
    }
    return finishSolution(cells, directions, order, rotations, false, "canonical");
  }
  return null;
}

/** Clockwise rotations still needed to realise `solution` from `cells`. */
export function solutionDistance(cells: Cell[], solution: Solution): number {
  let total = 0;
  for (let i = 0; i < cells.length; i += 1) {
    const target = solution.directions[i];
    const cell = cells[i];
    if (target === undefined || !cell || cell.direction === undefined) continue;
    total += clockwiseDistance(cell.direction, target);
  }
  return total;
}

/** A complete solved board plus the winning route, for read-only display. */
export interface SolvedPreview {
  cells: Cell[];
  path: SimStep[];
  exact: boolean;
  parKind: ParKind;
  rotations: number;
}

function directionsAlongPath(cells: Cell[], path: Array<{ row: number; col: number }>): Array<Direction | undefined> {
  const idx = indexByCoord(cells);
  const directions = new Array<Direction | undefined>(cells.length).fill(undefined);
  for (let k = 0; k + 1 < path.length; k += 1) {
    const a = path[k]!;
    const b = path[k + 1]!;
    const i = idx.get(key(a.row, a.col));
    if (i === undefined || !rotatableTarget(cells[i])) continue;
    const d = dirTo(a, b);
    if (d !== undefined) directions[i] = d;
  }
  return directions;
}

/**
 * Build a solved board for inspection, independent of player progress.
 *
 * Prefers the proven exact-minimum solution and falls back to the canonical
 * route when the exact search is incomplete. Pure: it clones before mutating
 * and never touches the input puzzle.
 */
export function solvedPreview(puzzle: Puzzle, flags: MechanicFlags = DEFAULT_MECHANICS): SolvedPreview | null {
  const exact = minimumRotationSolver(puzzle);
  if (exact.exact && exact.solvable && exact.path) {
    const cells = cloneCells(puzzle.cells);
    const directions = exact.routeDirs
      ? exact.routeDirs.map((d, i) => (rotatableTarget(cells[i]) ? d : undefined))
      : directionsAlongPath(cells, exact.path);
    for (let i = 0; i < cells.length; i += 1) {
      const target = directions[i];
      const targetCell = cells[i];
      if (target === undefined || !targetCell || targetCell.direction === undefined) continue;
      if (rotatableTarget(targetCell)) targetCell.direction = target;
    }
    const result = simulatePuzzle(puzzle, cells, flags);
    if (result.outcome === "win") {
      return { cells, path: result.path, exact: true, parKind: "minimum", rotations: exact.rotations };
    }
  }

  const cells = applyCanonical(cloneCells(puzzle.cells));
  const result = simulatePuzzle(puzzle, cells, flags);
  if (result.outcome === "win") {
    return {
      cells,
      path: result.path,
      exact: false,
      parKind: "canonical",
      rotations: canonicalPar(puzzle.cells),
    };
  }
  return null;
}

function mechanismFor(
  puzzle: Puzzle,
  cells: Cell[],
  index: number,
  target: Direction,
  flags: MechanicFlags,
): HintMechanism {
  const cell = cells[index]!;
  if (cell.type === "gate") return "gate";
  const step = resolveStep(cells, puzzle.size, { row: cell.row, col: cell.col }, target, flags);
  if (step.kind === "warp") return "portal";
  if (step.kind === "blocked") return "wall";
  const landing = getCell(cells, step.landing.row, step.landing.col);
  if (landing?.type === "exit") return "exit";
  if (cell.required) return "node";
  return "arrow";
}

const MECHANISM_BONUS: Record<HintMechanism, number> = {
  portal: 30,
  gate: 25,
  wall: 22,
  exit: 18,
  node: 10,
  arrow: 0,
};

/**
 * Candidate rotations: the first clockwise step toward each still-wrong target
 * on the verified solution. Locked cells, empty cells, exits, walls and portals
 * are excluded because the player cannot usefully rotate them.
 */
export function rankCandidates(
  puzzle: Puzzle,
  cells: Cell[],
  solution: Solution,
  flags: MechanicFlags = DEFAULT_MECHANICS,
): HintCandidate[] {
  const candidates: HintCandidate[] = [];
  for (let i = 0; i < cells.length; i += 1) {
    const target = solution.directions[i];
    const cell = cells[i];
    if (target === undefined || !rotatableTarget(cell)) continue;
    if (cell!.direction === undefined || cell!.direction === target) continue;
    const mechanism = mechanismFor(puzzle, cells, i, target, flags);
    const orderIndex = solution.order.get(i) ?? Number.MAX_SAFE_INTEGER;
    const score =
      (cell!.required ? 40 : 0) +
      MECHANISM_BONUS[mechanism] +
      Math.max(0, 50 - Math.min(orderIndex, 50));
    candidates.push({
      action: {
        row: cell!.row,
        col: cell!.col,
        from: cell!.direction,
        to: rotateDirection(cell!.direction, 1),
        clockwiseSteps: 1,
      },
      index: i,
      target,
      required: cell!.required === true,
      orderIndex,
      mechanism,
      score,
    });
  }
  candidates.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex;
    if (a.action.row !== b.action.row) return a.action.row - b.action.row;
    return a.action.col - b.action.col;
  });
  return candidates;
}

function applyAction(cells: Cell[], action: RotationAction): Cell[] {
  const next = cloneCells(cells);
  const i = indexOfCell(next, action.row, action.col);
  if (i >= 0) next[i]!.direction = action.to;
  return next;
}

function remainingCanonicalWins(puzzle: Puzzle, cells: Cell[], flags: MechanicFlags): boolean {
  const solved = cloneCells(cells);
  for (const cell of solved) {
    if (!rotatableTarget(cell)) continue;
    if (cell.canonicalDir !== undefined) cell.direction = cell.canonicalDir;
  }
  return simulatePuzzle(puzzle, solved, flags).outcome === "win";
}

interface VerifiedCandidate {
  candidate: HintCandidate;
  confidence: HintConfidence;
  resultingDistance: number;
}

function pickVerified(
  puzzle: Puzzle,
  cells: Cell[],
  solution: Solution,
  candidates: HintCandidate[],
  distance: number,
  flags: MechanicFlags,
): VerifiedCandidate | null {
  let best: VerifiedCandidate | null = null;
  const cap = Math.min(candidates.length, 8);
  for (let n = 0; n < cap; n += 1) {
    const candidate = candidates[n]!;
    const next = applyAction(cells, candidate.action);
    if (solution.exact) {
      const solved = minimumRotationSolver({ ...puzzle, cells: next });
      if (!solved.exact || !solved.solvable) continue;
      if (solved.rotations >= distance) continue;
      const verified: VerifiedCandidate = {
        candidate,
        confidence: solved.rotations === distance - 1 ? "exact" : "verified",
        resultingDistance: solved.rotations,
      };
      // A single clockwise rotation can at best remove one rotation; accept it.
      return verified;
    }
    if (!remainingCanonicalWins(puzzle, next, flags)) continue;
    const candidateSolution = buildSolution(puzzle, next);
    const resultingDistance = candidateSolution ? solutionDistance(next, candidateSolution) : distance - 1;
    if (resultingDistance >= distance) continue;
    best = { candidate, confidence: "verified", resultingDistance };
    break;
  }
  return best;
}

function failurePrefix(
  puzzle: Puzzle,
  cells: Cell[],
  lastFailReason: FailReason | undefined,
): string {
  if (!lastFailReason) return "";
  switch (lastFailReason) {
    case "WRONG_COLOR": {
      const exit = getCell(cells, puzzle.exit.row, puzzle.exit.col);
      const wanted = requiredExitColor(exit);
      return wanted ? `Carry the ${wanted} glow into OUT. ` : "";
    }
    case "BLOCKED_WALL":
      return "You approached a one-way wall from the wrong side. ";
    case "EXIT_TOO_SOON":
    case "MISSED_NODE":
      return "Reach every node before OUT. ";
    case "PORTAL_LOOP":
      return "That portal pairing loops back on itself. ";
    case "DEAD_END":
    case "LOOP":
    case "OFF_GRID":
      return "This rotation restores a solvable route. ";
    default:
      return "";
  }
}

function messageFor(mechanism: HintMechanism, cell: Cell): string {
  switch (mechanism) {
    case "portal":
      return "Rotate the highlighted arrow clockwise to enter the portal.";
    case "gate": {
      const color = cell.color ? `${cell.color} ` : "";
      return `Rotate the highlighted arrow clockwise to route the orb through the ${color}gate.`;
    }
    case "wall":
      return "Rotate the highlighted arrow clockwise to approach the one-way wall from the correct side.";
    case "exit":
      return "Rotate the highlighted arrow clockwise once, then Launch.";
    case "node":
      return "Rotate the highlighted arrow clockwise to connect the route to the next node.";
    default:
      return "Rotate the highlighted arrow clockwise once.";
  }
}

function explanationFor(solution: Solution): string {
  return solution.exact
    ? "This move keeps a proven minimum solution reachable."
    : "This move keeps a valid solution reachable.";
}

function secondHint(
  puzzle: Puzzle,
  cells: Cell[],
  first: VerifiedCandidate,
  distance: number,
  flags: MechanicFlags,
): { secondAction?: RotationAction; suffix: string } {
  if (distance <= 1) return { suffix: " Then Launch." };
  const after = applyAction(cells, first.candidate.action);
  const solution = buildSolution(puzzle, after);
  if (!solution) return { suffix: "" };
  const d2 = solutionDistance(after, solution);
  if (d2 <= 0) return { suffix: " That was the last rotation — Launch!" };
  const candidates = rankCandidates(puzzle, after, solution, flags);
  const verified = pickVerified(puzzle, after, solution, candidates, d2, flags);
  if (!verified) return { suffix: "" };
  const second = applyAction(after, verified.candidate.action);
  const finalSolution = buildSolution(puzzle, second);
  if (!finalSolution || solutionDistance(second, finalSolution) >= d2) return { suffix: "" };
  return {
    secondAction: verified.candidate.action,
    suffix: ` Then rotate row ${verified.candidate.action.row + 1}, column ${verified.candidate.action.col + 1} clockwise once.`,
  };
}

/**
 * Compute the best verified hint for the current player state.
 *
 * Deterministic and side-effect free: it never mutates `state.cells` and never
 * touches the DOM. Returns `available: false` when the board is already solved
 * or no safe move can be verified.
 */
export function getHint(
  puzzle: Puzzle,
  state: PlayerSolveState,
  options: HintOptions = {},
): HintResult {
  const level = options.level ?? 1;
  const flags = options.flags ?? DEFAULT_MECHANICS;
  const cells = state.cells;
  const solution = buildSolution(puzzle, cells);
  if (!solution) {
    return { available: false, confidence: "fallback", distance: -1, candidates: [] };
  }
  const distance = solutionDistance(cells, solution);
  if (distance <= 0) {
    return { available: false, confidence: solution.exact ? "exact" : "verified", distance, candidates: [] };
  }
  const candidates = rankCandidates(puzzle, cells, solution, flags);
  if (candidates.length === 0) {
    return { available: false, confidence: solution.exact ? "exact" : "verified", distance, candidates };
  }
  const verified = pickVerified(puzzle, cells, solution, candidates, distance, flags);
  if (!verified) {
    return { available: false, confidence: "fallback", distance, candidates };
  }
  const cell = cells[verified.candidate.index]!;
  let message =
    failurePrefix(puzzle, cells, state.lastFailReason) +
    messageFor(verified.candidate.mechanism, cell);
  const base: HintResult = {
    available: true,
    confidence: verified.confidence,
    action: verified.candidate.action,
    message,
    explanation: explanationFor(solution),
    distance,
    candidates,
  };
  if (level >= 2) {
    const second = secondHint(puzzle, cells, verified, distance, flags);
    if (second.secondAction) base.secondAction = second.secondAction;
    if (second.suffix && !message.endsWith("Launch.")) {
      message = `${message}${second.suffix}`;
      base.message = message;
    }
  }
  return base;
}
