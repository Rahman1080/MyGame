import { cloneTubes, isSolved, legalMoves, pour, stateKey, undo, type PrismMove, type PrismState } from "./logic";

export interface SolveOptions {
  maxExpanded?: number;
}

export interface SolveResult {
  solved: boolean;
  solution: PrismMove[];
  expanded: number;
  exhausted: boolean;
}

export const SOLVE_BUDGET = 250000;

function moveScore(state: PrismState, move: PrismMove): number {
  const src = state.tubes[move.from]!;
  const dst = state.tubes[move.to]!;
  let score = 0;
  const dstAfter = dst.length + move.count;
  const srcAfter = src.length - move.count;
  if (dstAfter === state.capacity && (dst.length === 0 || dst.every((u) => u === move.color))) {
    score += 140;
  }
  if (dst.length > 0) score += 60;
  if (srcAfter === 0) score += 25;
  score += move.count * 4;
  const srcUniform = src.every((u) => u === src[0]);
  if (srcUniform && move.count === src.length && dst.length === 0) score -= 250;
  return score;
}

export function solve(state: PrismState, opts: SolveOptions = {}): SolveResult {
  const budget = Math.max(1, Math.floor(opts.maxExpanded ?? SOLVE_BUDGET));
  const working: PrismState = {
    seed: state.seed,
    colors: state.colors,
    capacity: state.capacity,
    tubes: cloneTubes(state.tubes),
    moves: [],
    status: state.status,
  };
  const visited = new Set<string>();
  const path: PrismMove[] = [];
  let expanded = 0;
  let ranOut = false;

  const dfs = (): boolean => {
    if (isSolved(working)) return true;
    if (expanded >= budget) {
      ranOut = true;
      return false;
    }
    const key = stateKey(working);
    if (visited.has(key)) return false;
    visited.add(key);
    expanded += 1;

    const moves = legalMoves(working)
      .map((move) => ({ move, score: moveScore(working, move) }))
      .sort((a, b) => b.score - a.score || a.move.from - b.move.from || a.move.to - b.move.to);

    for (const { move } of moves) {
      pour(working, move.from, move.to);
      path.push(move);
      if (dfs()) return true;
      path.pop();
      undo(working);
    }
    return false;
  };

  const solved = dfs();
  return {
    solved,
    solution: solved ? path.slice() : [],
    expanded,
    exhausted: solved ? false : ranOut,
  };
}

export type HintResult =
  | { kind: "solved" }
  | { kind: "move"; move: PrismMove }
  | { kind: "unsolvable"; certain: boolean };

export function hint(state: PrismState, opts: SolveOptions = {}): HintResult {
  if (isSolved(state)) return { kind: "solved" };
  const result = solve(state, opts);
  if (result.solved && result.solution.length > 0) {
    return { kind: "move", move: result.solution[0]! };
  }
  return { kind: "unsolvable", certain: !result.exhausted };
}
