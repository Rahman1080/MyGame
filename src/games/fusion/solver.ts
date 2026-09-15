import {
  BIN_HEIGHT,
  COLS,
  OVERFLOW_Y,
  TIER_COUNT,
  createState,
  drop,
  dropsUsed,
  isOver,
  objectiveMet,
  orbRadius,
  settle,
  type FusionState,
} from "./logic";

export interface SolveResult {
  solved: boolean;
  firstCol: number | null;
  drops: number;
}

interface Beam {
  state: FusionState;
  firstCol: number | null;
}

export function cloneState(state: FusionState): FusionState {
  return {
    ...state,
    queue: state.queue.slice(),
    columns: state.columns.map((stack) => stack.map((orb) => ({ ...orb }))),
    falling: state.falling ? { ...state.falling } : null,
    lastMerge: state.lastMerge ? { ...state.lastMerge } : null,
  };
}

function heuristic(state: FusionState, target: number): number {
  let h = Math.min(state.maxTier, target) * 10000;
  const counts = new Array<number>(TIER_COUNT).fill(0);
  for (const stack of state.columns) {
    for (const orb of stack) counts[orb.tier] = (counts[orb.tier] ?? 0) + 1;
  }
  for (let t = 0; t < TIER_COUNT; t += 1) {
    const c = counts[t] ?? 0;
    h += c * t * 6;
    h += Math.floor(c / 2) * (t + 1) * 40;
  }
  let top = BIN_HEIGHT;
  for (const stack of state.columns) {
    const orb = stack[stack.length - 1];
    if (orb) top = Math.min(top, orb.y - orbRadius(orb.tier));
  }
  h -= Math.max(0, OVERFLOW_Y + 220 - top) * 8;
  h -= state.overflowTicks * 40;
  return h;
}

function stateKey(state: FusionState): string {
  return `${state.columns.map((stack) => stack.map((orb) => orb.tier).join("")).join("|")}:${state.nextTier}${state.previewTier}`;
}

export function search(state: FusionState, target: number, budget: number, width = 32): SolveResult {
  if (objectiveMet(state, target)) return { solved: true, firstCol: null, drops: 0 };
  const limit = Math.max(0, Math.floor(budget));
  let beam: Beam[] = [{ state: cloneState(state), firstCol: null }];
  for (let depth = 0; depth < limit; depth += 1) {
    const next: Beam[] = [];
    let solutionCol: number | null = null;
    for (const node of beam) {
      for (let col = 0; col < COLS; col += 1) {
        const child = cloneState(node.state);
        if (!drop(child, col)) continue;
        settle(child, 4000);
        if (isOver(child)) continue;
        const firstCol = node.firstCol ?? col;
        if (objectiveMet(child, target)) {
          solutionCol = firstCol;
          break;
        }
        next.push({ state: child, firstCol });
      }
      if (solutionCol !== null) break;
    }
    if (solutionCol !== null) return { solved: true, firstCol: solutionCol, drops: depth + 1 };
    if (next.length === 0) break;
    const seen = new Set<string>();
    const unique = next.filter((candidate) => {
      const key = stateKey(candidate.state);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    unique.sort((a, b) => heuristic(b.state, target) - heuristic(a.state, target));
    beam = unique.slice(0, Math.max(1, Math.floor(width)));
  }
  return { solved: false, firstCol: null, drops: 0 };
}

export function solveLevel(seed: string, queue: readonly number[], target: number, budget: number, width = 32): SolveResult {
  return search(createState(seed, queue), target, budget, width);
}

export function hintColumn(state: FusionState, target: number, budget: number, width = 32): number | null {
  const remaining = Math.max(0, Math.floor(budget) - dropsUsed(state));
  if (remaining <= 0 || state.falling || state.status !== "playing") return null;
  const result = search(state, target, remaining, width);
  return result.solved ? result.firstCol : null;
}
