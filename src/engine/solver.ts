import { cloneCells, getCell } from "./grid";
import { simulatePuzzle } from "./simulation";
import { clockwiseDistance, rotateDirection } from "./rotation";
import type { Cell, Direction, Puzzle, ParKind, SimResult, SimStep } from "./types";

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
 *   Deterministic breadth-first search over rotation states. Every move rotates
 *   exactly one editable cell one 90-degree clockwise step (cost 1). Because BFS
 *   expands states in increasing cost order, the first winning state it reaches
 *   is a true minimum-rotation solution.
 *
 *   Search-space control (no exponential blow-up):
 *   - Only unlocked, non-empty/non-exit cells can be rotated.
 *   - Branching is limited to cells the token actually reaches in the current
 *     simulation. Rotating a cell the token never reaches cannot change the
 *     current route, and any such rotation in an optimal solution can be
 *     deferred until the token reaches it (order of rotations does not affect
 *     the final direction assignment). This preserves optimality while cutting
 *     the branching factor to the current route length.
 *   - A deterministic per-size state budget bounds work. If the budget is hit
 *     before a goal is found, the result is reported `exact: false` and callers
 *     fall back to the canonical-route par (an upper bound), never a false
 *     minimum claim.
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

function hintForCell(cell: Cell | undefined): HintMove | undefined {
  if (!cell || !cell.required || cell.locked) return undefined;
  if (cell.direction === undefined || cell.canonicalDir === undefined) return undefined;
  if (cell.direction === cell.canonicalDir) return undefined;
  return {
    row: cell.row,
    col: cell.col,
    from: cell.direction,
    to: rotateDirection(cell.direction, 1),
  };
}

/**
 * The next move a solver would make from the *current* board: the earliest cell
 * on the canonical route whose arrow is still wrong. Rotating it one clockwise
 * step always reduces its clockwise distance to the canonical direction, so the
 * hint is guaranteed progress. Falls back to a row-major scan when the canonical
 * route is unavailable.
 */
export function nextHint(puzzle: Puzzle, cells: Cell[]): HintMove | undefined {
  const seen = new Set<string>();
  const canonical = canonicalSolution(puzzle);
  if (canonical.result.outcome === "win") {
    for (const step of canonical.result.path) {
      const k = `${step.row},${step.col}`;
      if (seen.has(k)) continue;
      seen.add(k);
      const move = hintForCell(getCell(cells, step.row, step.col));
      if (move) return move;
    }
  }
  for (const cell of cells) {
    const move = hintForCell(cell);
    if (move) return move;
  }
  return undefined;
}

interface EditableCell {
  index: number;
  row: number;
  col: number;
}

function editableCells(cells: Cell[]): EditableCell[] {
  const out: EditableCell[] = [];
  cells.forEach((c, index) => {
    if (c.locked) return;
    if (c.direction === undefined) return;
    if (c.type === "empty" || c.type === "exit") return;
    out.push({ index, row: c.row, col: c.col });
  });
  return out;
}

// Deterministic search budgets per board size. Chosen so the exact search is
// cheap for small boards and bounded for large ones.
const STATE_BUDGET: Record<number, number> = {
  3: 20000,
  4: 20000,
  5: 30000,
  6: 20000,
};

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

export function minimumRotationSolver(
  puzzle: Puzzle,
  opts: MinSolveOptions = {},
): MinSolveResult {
  const editables = editableCells(puzzle.cells);
  const indexByKey = new Map<string, number>();
  puzzle.cells.forEach((c, i) => indexByKey.set(`${c.row},${c.col}`, i));
  const posByIndex = new Map<number, number>();
  editables.forEach((e, k) => posByIndex.set(e.index, k));

  const base = puzzle.cells.map((c) => ({ ...c }));
  const maxStates = opts.maxStates ?? STATE_BUDGET[puzzle.size] ?? 50000;

  const encode = (dirs: Direction[]) => dirs.join("");
  const startDirs = editables.map((e) => puzzle.cells[e.index]!.direction ?? 0) as Direction[];

  const visited = new Set<string>();
  visited.add(encode(startDirs));
  const queue: Array<{ dirs: Direction[]; cost: number }> = [{ dirs: startDirs, cost: 0 }];
  let head = 0;
  let explored = 0;

  while (head < queue.length) {
    const node = queue[head]!;
    head += 1;
    explored += 1;

    const cells = base.map((c) => ({ ...c }));
    for (let k = 0; k < editables.length; k += 1) {
      cells[editables[k]!.index]!.direction = node.dirs[k];
    }

    const result = simulatePuzzle(puzzle, cells);
    if (result.outcome === "win") {
      return {
        solvable: true,
        rotations: node.cost,
        exact: true,
        statesExplored: explored,
        path: result.path,
      };
    }

    // Branch only on cells the token actually reached.
    const branched = new Set<number>();
    for (const step of result.path) {
      const cellIndex = indexByKey.get(`${step.row},${step.col}`);
      if (cellIndex === undefined) continue;
      const k = posByIndex.get(cellIndex);
      if (k === undefined || branched.has(k)) continue;
      branched.add(k);

      const nextDirs = node.dirs.slice();
      nextDirs[k] = rotateDirection(nextDirs[k]!, 1);
      const encoded = encode(nextDirs);
      if (visited.has(encoded)) continue;
      if (visited.size >= maxStates) {
        return {
          solvable: false,
          rotations: -1,
          exact: false,
          statesExplored: explored,
          path: null,
        };
      }
      visited.add(encoded);
      queue.push({ dirs: nextDirs, cost: node.cost + 1 });
    }
  }

  return {
    solvable: false,
    rotations: -1,
    exact: true,
    statesExplored: explored,
    path: null,
  };
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
