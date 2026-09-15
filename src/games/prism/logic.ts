export type Tube = number[];

export interface PrismMove {
  from: number;
  to: number;
  color: number;
  count: number;
}

export interface PrismState {
  seed: string;
  colors: number;
  capacity: number;
  tubes: Tube[];
  moves: PrismMove[];
  status: "playing" | "won";
}

export const PRISM_COLORS = 8;

export function cloneTubes(tubes: readonly Tube[]): Tube[] {
  return tubes.map((t) => t.slice());
}

export function createState(seed: string, tubes: readonly Tube[], colors: number, capacity: number): PrismState {
  const next: PrismState = {
    seed,
    colors,
    capacity,
    tubes: cloneTubes(tubes),
    moves: [],
    status: "playing",
  };
  next.status = isSolved(next) ? "won" : "playing";
  return next;
}

export function topColor(tube: readonly number[]): number | null {
  return tube.length > 0 ? tube[tube.length - 1]! : null;
}

export function topRun(tube: readonly number[]): number {
  if (tube.length === 0) return 0;
  const color = tube[tube.length - 1]!;
  let n = 1;
  for (let i = tube.length - 2; i >= 0; i -= 1) {
    if (tube[i] !== color) break;
    n += 1;
  }
  return n;
}

export function isMonochrome(tube: readonly number[]): boolean {
  if (tube.length <= 1) return true;
  const first = tube[0]!;
  for (let i = 1; i < tube.length; i += 1) if (tube[i] !== first) return false;
  return true;
}

export function isTubeComplete(tube: readonly number[], colors: number, capacity: number): boolean {
  if (tube.length !== capacity) return false;
  return isMonochrome(tube) && (tube[0] ?? 0) < colors;
}

export function pourCount(state: PrismState, from: number, to: number): number {
  const src = state.tubes[from];
  const dst = state.tubes[to];
  if (!src || !dst) return 0;
  if (from === to) return 0;
  if (src.length === 0 || dst.length >= state.capacity) return 0;
  const color = topColor(src);
  if (color === null) return 0;
  const dstTop = topColor(dst);
  if (dstTop !== null && dstTop !== color) return 0;
  return Math.min(topRun(src), state.capacity - dst.length);
}

export function canPour(state: PrismState, from: number, to: number): boolean {
  return pourCount(state, from, to) > 0;
}

export function pour(state: PrismState, from: number, to: number): PrismMove | null {
  const count = pourCount(state, from, to);
  if (count <= 0) return null;
  const src = state.tubes[from]!;
  const dst = state.tubes[to]!;
  const color = topColor(src)!;
  const moved = src.splice(src.length - count, count);
  for (const unit of moved) dst.push(unit);
  const move: PrismMove = { from, to, color, count };
  state.moves.push(move);
  if (isSolved(state)) state.status = "won";
  return move;
}

export function undo(state: PrismState): PrismMove | null {
  const move = state.moves.pop();
  if (!move) return null;
  const src = state.tubes[move.from]!;
  const dst = state.tubes[move.to]!;
  const restored = dst.splice(dst.length - move.count, move.count);
  for (const unit of restored) src.push(unit);
  state.status = isSolved(state) ? "won" : "playing";
  return move;
}

export function reset(state: PrismState, initial: readonly Tube[]): void {
  state.tubes = cloneTubes(initial);
  state.moves = [];
  state.status = isSolved(state) ? "won" : "playing";
}

export function isSolved(state: PrismState): boolean {
  for (const tube of state.tubes) {
    if (tube.length === 0) continue;
    if (tube.length !== state.capacity) return false;
    if (!isMonochrome(tube)) return false;
  }
  return true;
}

export function legalMoves(state: PrismState): PrismMove[] {
  const out: PrismMove[] = [];
  for (let from = 0; from < state.tubes.length; from += 1) {
    for (let to = 0; to < state.tubes.length; to += 1) {
      const count = pourCount(state, from, to);
      if (count > 0) out.push({ from, to, color: topColor(state.tubes[from]!)!, count });
    }
  }
  return out;
}

export function colorCounts(tubes: readonly Tube[], colors: number): number[] {
  const counts = Array.from({ length: colors }, () => 0);
  for (const tube of tubes) {
    for (const unit of tube) {
      if (unit >= 0 && unit < colors) counts[unit] = (counts[unit] ?? 0) + 1;
    }
  }
  return counts;
}

export function isValidState(state: PrismState): boolean {
  if (!Number.isInteger(state.colors) || state.colors < 2) return false;
  if (!Number.isInteger(state.capacity) || state.capacity < 2) return false;
  if (state.tubes.length < state.colors) return false;
  for (const tube of state.tubes) {
    if (tube.length > state.capacity) return false;
    for (const unit of tube) {
      if (!Number.isInteger(unit) || unit < 0 || unit >= state.colors) return false;
    }
  }
  const counts = colorCounts(state.tubes, state.colors);
  for (const color of counts) if (color !== state.capacity) return false;
  return true;
}

export function stateKey(state: PrismState): string {
  return state.tubes
    .map((t) => t.join(","))
    .sort()
    .join("|");
}
