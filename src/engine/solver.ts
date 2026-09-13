import { cloneCells, getCell } from "./grid";
import { simulatePuzzle } from "./simulation";
import { requiredExitColor } from "./colorRules";
import { clockwiseDistance, rotateDirection } from "./rotation";
import type { Cell, ColorName, Direction, Puzzle, ParKind, SimResult, SimStep } from "./types";

/**
 * SOLVER ARCHITECTURE
 *
 * canonicalSolution(puzzle)
 *   Applies every cell's `canonicalDir` and simulates it. This is the route the
 *   generator designed. It proves the puzzle *has* a solution.
 *
 * isCanonicalSolvable(puzzle)
 *   Boolean wrapper around canonicalSolution().
 *
 * minimumRotationSolver(puzzle)
 *   Exact branch-and-bound search over *routes*. Key theorem used here:
 *   a winning run never visits the same cell twice. If a route returned to a
 *   cell it had already visited, the cell's direction is fixed, so the run
 *   would repeat the same segment forever and the simulation state
 *   (position + required coverage + token color) would repeat, which the
 *   simulator reports as a LOOP. Therefore every win is a simple path from
 *   start to exit that covers every required cell.
 *
 *   The cost of a simple path is fixed: each cell on the path must point at its
 *   path successor, so it contributes clockwiseDistance(cell.direction,
 *   directionToSuccessor) rotations. Cells off the path are left untouched.
 *   So the true minimum rotation count is the minimum path cost over all
 *   simple start->exit paths that cover every required cell and satisfy the
 *   color gate rule.
 *
 *   Search-space control:
 *   - The canonical route is a known solution and seeds the upper bound, so any
 *     branch whose cost already meets it is pruned.
 *   - A deterministic exploration budget bounds work. If the budget is hit the
 *     result is `exact: false`; callers then fall back to the canonical par and
 *     never claim a minimum they did not prove.
 */

export type ParMode = "minimum" | "canonical";

export interface CanonicalSolution {
  cells: Cell[];
  result: SimResult;
}

export function applyCanonical(cells: Cell[]): Cell[] {
  return cells.map((c) => ({
    ...c,
    direction: c.canonicalDir ?? c.direction,
  }));
}

export function canonicalSolution(puzzle: Puzzle): CanonicalSolution {
  const cells = applyCanonical(cloneCells(puzzle.cells));
  return { cells, result: simulatePuzzle(puzzle, cells) };
}

export function isCanonicalSolvable(puzzle: Puzzle): boolean {
  return canonicalSolution(puzzle).result.outcome === "win";
}

export function solvePuzzle(puzzle: Puzzle): SimResult {
  return canonicalSolution(puzzle).result;
}

export function isSolvable(puzzle: Puzzle): boolean {
  return isCanonicalSolvable(puzzle);
}

export function simulateCurrent(puzzle: Puzzle, cells: Cell[]): SimResult {
  return simulatePuzzle(puzzle, cells);
}

/** Sum of clockwise 90-degree steps from each editable cell to its canonicalDir. */
export function canonicalPar(cells: Cell[]): number {
  let total = 0;
  for (const c of cells) {
    if (c.locked) continue;
    if (c.direction === undefined || c.canonicalDir === undefined) continue;
    total += clockwiseDistance(c.direction, c.canonicalDir);
  }
  return total;
}

export interface HintMove {
  row: number;
  col: number;
  from: Direction;
  to: Direction;
}

/** One clockwise step for an editable, still-wrong cell, or undefined. */
function stepToward(cell: Cell | undefined, wanted: Direction): HintMove | undefined {
  if (!cell || cell.locked) return undefined;
  if (cell.direction === undefined || cell.direction === wanted) return undefined;
  if (cell.type === "empty" || cell.type === "exit") return undefined;
  return {
    row: cell.row,
    col: cell.col,
    from: cell.direction,
    to: rotateDirection(cell.direction, 1),
  };
}

/** First cell on a solution route whose arrow is not yet correct. */
function firstWrongOnPath(cells: Cell[], path: SimStep[]): HintMove | undefined {
  for (let i = 0; i + 1 < path.length; i += 1) {
    const from = getCell(cells, path[i]!.row, path[i]!.col);
    const to = path[i + 1]!;
    if (!from) continue;
    const wanted = dirTo(from, to);
    if (wanted === undefined) continue;
    const move = stepToward(from, wanted);
    if (move) return move;
  }
  return undefined;
}

/**
 * The next move a solver would make from the *current* board.
 *
 * Preference order:
 *  1. the proven minimum solution from the current state (parKind-aware), so
 *     the hint always reduces the exact minimum distance by exactly one;
 *  2. the canonical route (a known valid solution) when the exact search cannot
 *     be completed within budget;
 *  3. any editable cell whose arrow still disagrees with its canonicalDir.
 *
 * Returns undefined only when no incorrect editable cell exists (already
 * solved) or no solution is known, so callers never crash on a missing hint.
 */
export function nextHint(puzzle: Puzzle, cells: Cell[]): HintMove | undefined {
  const current: Puzzle = { ...puzzle, cells };
  const min = minimumRotationSolver(current);
  if (min.exact && min.solvable && min.path) {
    return firstWrongOnPath(current.cells, min.path);
  }
  const canonical = canonicalSolution(current);
  if (canonical.result.outcome === "win") {
    const move = firstWrongOnPath(current.cells, canonical.result.path);
    if (move) return move;
  }
  for (const cell of cells) {
    if (cell.locked || cell.direction === undefined) continue;
    if (cell.type === "empty" || cell.type === "exit") continue;
    if (cell.canonicalDir !== undefined && cell.direction !== cell.canonicalDir) {
      return {
        row: cell.row,
        col: cell.col,
        from: cell.direction,
        to: rotateDirection(cell.direction, 1),
      };
    }
  }
  return undefined;
}

function dirTo(
  a: { row: number; col: number },
  b: { row: number; col: number },
): Direction | undefined {
  const dr = b.row - a.row;
  const dc = b.col - a.col;
  if (dr === -1 && dc === 0) return 0;
  if (dr === 0 && dc === 1) return 1;
  if (dr === 1 && dc === 0) return 2;
  if (dr === 0 && dc === -1) return 3;
  return undefined;
}

// Deterministic exploration budgets. Generous for small boards and bounded for
// large ones, so generation can never run an unbounded search.
const STATE_BUDGET: Record<number, number> = {
  3: 100000,
  4: 300000,
  5: 600000,
  6: 600000,
};

const BASE_COLOR: ColorName = "cyan";

export interface MinSolveOptions {
  maxStates?: number;
}

export interface MinSolveResult {
  solvable: boolean;
  rotations: number;
  exact: boolean;
  statesExplored: number;
  path: SimStep[] | null;
}

/** Rotations needed to point `cell` at `wanted`, or Infinity if impossible. */
function turnCost(cell: Cell, wanted: Direction): number {
  if (cell.direction === undefined) return Number.POSITIVE_INFINITY;
  if (cell.locked && cell.direction !== wanted) return Number.POSITIVE_INFINITY;
  return clockwiseDistance(cell.direction, wanted);
}

export function minimumRotationSolver(
  puzzle: Puzzle,
  opts: MinSolveOptions = {},
): MinSolveResult {
  const cells = puzzle.cells;
  const size = puzzle.size;
  const indexByKey = new Map<string, number>();
  cells.forEach((c, i) => indexByKey.set(`${c.row},${c.col}`, i));
  const startIndex = indexByKey.get(`${puzzle.start.row},${puzzle.start.col}`);
  const exitIndex = indexByKey.get(`${puzzle.exit.row},${puzzle.exit.col}`);
  const maxStates = opts.maxStates ?? STATE_BUDGET[size] ?? 600000;

  if (startIndex === undefined || exitIndex === undefined) {
    return { solvable: false, rotations: -1, exact: true, statesExplored: 0, path: null };
  }

  const required = cells.map((c) => c.required === true);
  const totalRequired = required.reduce((n, r) => n + (r ? 1 : 0), 0);
  const exitCell = cells[exitIndex]!;
  const wantedExit = requiredExitColor(exitCell);

  // Seed the upper bound with the canonical route when it wins.
  const canonical = canonicalSolution(puzzle);
  let best = Number.POSITIVE_INFINITY;
  let bestCoords: number[] | null = null;
  if (canonical.result.outcome === "win") {
    const coords: number[] = [];
    for (const step of canonical.result.path) {
      const idx = indexByKey.get(`${step.row},${step.col}`);
      if (idx === undefined) break;
      coords.push(idx);
    }
    if (coords.length === canonical.result.path.length && coords[0] === startIndex) {
      let total = 0;
      let ok = true;
      for (let i = 0; i + 1 < coords.length; i += 1) {
        const d = dirTo(cells[coords[i]!]!, cells[coords[i + 1]!]!);
        if (d === undefined) {
          ok = false;
          break;
        }
        const c = turnCost(cells[coords[i]!]!, d);
        if (!Number.isFinite(c)) {
          ok = false;
          break;
        }
        total += c;
      }
      if (ok) {
        best = total;
        bestCoords = coords;
      }
    }
  }

  const visitedCell = new Array<boolean>(cells.length).fill(false);
  const visitedReq = new Array<boolean>(cells.length).fill(false);
  const route: number[] = [startIndex];
  let reqCount = required[startIndex] ? 1 : 0;
  let color: ColorName =
    cells[startIndex]!.type === "gate" && cells[startIndex]!.color
      ? (cells[startIndex]!.color as ColorName)
      : BASE_COLOR;
  visitedCell[startIndex] = true;
  let explored = 0;
  let exact = true;

  const neighborsOf = (idx: number): number[] => {
    const c = cells[idx]!;
    const out: number[] = [];
    for (let d = 0 as Direction; d < 4; d = ((d + 1) as Direction)) {
      const dr = d === 0 ? -1 : d === 2 ? 1 : 0;
      const dc = d === 1 ? 1 : d === 3 ? -1 : 0;
      const nr = c.row + dr;
      const nc = c.col + dc;
      if (nr < 0 || nc < 0 || nr >= size || nc >= size) continue;
      const ni = indexByKey.get(`${nr},${nc}`);
      if (ni !== undefined) out.push(ni);
    }
    return out;
  };

  const dfs = (u: number, cost: number): void => {
    if (!exact) return;
    explored += 1;
    if (explored > maxStates) {
      exact = false;
      return;
    }

    const options: Array<{ to: number; d: Direction; isExit: boolean; cost: number }> = [];
    for (const v of neighborsOf(u)) {
      const d = dirTo(cells[u]!, cells[v]!);
      if (d === undefined) continue;
      const c = turnCost(cells[u]!, d);
      options.push({ to: v, d, isExit: v === exitIndex, cost: c });
    }
    options.sort((a, b) => {
      if (a.isExit !== b.isExit) return a.isExit ? 1 : -1;
      if (a.cost !== b.cost) return a.cost - b.cost;
      return a.to - b.to;
    });

    for (const mv of options) {
      if (!exact) return;
      if (!Number.isFinite(mv.cost)) continue;
      if (cost + mv.cost >= best) continue;
      if (mv.isExit) {
        if (reqCount === totalRequired && (wantedExit === undefined || color === wantedExit)) {
          best = cost + mv.cost;
          bestCoords = route.concat(exitIndex);
        }
        continue;
      }
      if (visitedCell[mv.to]) continue;
      const target = cells[mv.to]!;
      if (target.type === "empty") continue;

      const prevColor = color;
      const wasReq = required[mv.to] === true;
      visitedCell[mv.to] = true;
      if (wasReq) {
        visitedReq[mv.to] = true;
        reqCount += 1;
      }
      if (target.type === "gate" && target.color) color = target.color;
      route.push(mv.to);
      dfs(mv.to, cost + mv.cost);
      route.pop();
      color = prevColor;
      if (wasReq) {
        visitedReq[mv.to] = false;
        reqCount -= 1;
      }
      visitedCell[mv.to] = false;
    }
  };

  dfs(startIndex, 0);
  visitedCell[startIndex] = false;

  if (bestCoords) {
    const solved = cells.map((c) => ({ ...c }));
    for (let i = 0; i + 1 < bestCoords.length; i += 1) {
      const from = solved[bestCoords[i]!]!;
      const to = solved[bestCoords[i + 1]!]!;
      const d = dirTo(from, to);
      if (d !== undefined) from.direction = d;
    }
    const result = simulatePuzzle(puzzle, solved);
    if (result.outcome === "win") {
      return { solvable: true, rotations: best, exact, statesExplored: explored, path: result.path };
    }
    return { solvable: false, rotations: -1, exact: false, statesExplored: explored, path: null };
  }
  return { solvable: false, rotations: -1, exact, statesExplored: explored, path: null };
}

export interface ParResult {
  par: number;
  kind: ParKind;
  exact: boolean;
  solvable: boolean;
}

interface ParCacheEntry {
  signature: string;
  result: ParResult;
}

// Memoize par by puzzle identity + cell signature. Generation validates par
// immediately after computing it, so this halves the exact-solver work without
// affecting correctness (the signature changes if cells are mutated).
const parCache = new WeakMap<Puzzle, Partial<Record<ParMode, ParCacheEntry>>>();

function puzzleSignature(puzzle: Puzzle): string {
  const parts: string[] = [
    String(puzzle.size),
    `${puzzle.start.row},${puzzle.start.col}`,
    `${puzzle.exit.row},${puzzle.exit.col}`,
  ];
  for (const c of puzzle.cells) {
    parts.push(
      `${c.row},${c.col},${c.type},${c.direction ?? "x"},${c.canonicalDir ?? "x"},` +
        `${c.locked ? 1 : 0},${c.required ? 1 : 0},${c.color ?? "x"}`,
    );
  }
  return parts.join("|");
}

/**
 * Computes par for a puzzle.
 *  - "minimum" mode runs the search solver; when it completes exactly the true
 *    minimum is used ("minimum"). When the search exceeds its state budget the
 *    canonical-route par is used instead and flagged ("canonical").
 *  - "canonical" mode always uses the canonical route (fast, and the mode used
 *    by high-volume stress generation).
 */
export function computePar(puzzle: Puzzle, mode: ParMode = "minimum"): ParResult {
  const signature = puzzleSignature(puzzle);
  let bucket = parCache.get(puzzle);
  if (!bucket) {
    bucket = {};
    parCache.set(puzzle, bucket);
  }
  const cached = bucket[mode];
  if (cached && cached.signature === signature) return cached.result;

  const canonical = canonicalPar(puzzle.cells);
  const canonSolvable = isCanonicalSolvable(puzzle);
  let result: ParResult;
  if (mode === "canonical") {
    result = { par: canonical, kind: "canonical", exact: false, solvable: canonSolvable };
  } else {
    const solved = minimumRotationSolver(puzzle);
    result =
      solved.exact && solved.solvable
        ? { par: solved.rotations, kind: "minimum", exact: true, solvable: true }
        : { par: canonical, kind: "canonical", exact: false, solvable: canonSolvable };
  }
  bucket[mode] = { signature, result };
  return result;
}

/** Recomputes par using the mode recorded on the puzzle (defaults canonical). */
export function calculatePar(puzzle: Puzzle): number {
  const mode: ParMode = puzzle.parKind === "minimum" ? "minimum" : "canonical";
  return computePar(puzzle, mode).par;
}
