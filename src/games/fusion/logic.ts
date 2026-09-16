import { hashString, mulberry32, type Rng } from "../../gen/seededRng";

export const TIER_COUNT = 10;
export const MAX_SPAWN_TIER = 4;
export const COLS = 6;
export const COL_WIDTH = 72;
export const BIN_WIDTH = COLS * COL_WIDTH;
export const BIN_HEIGHT = 600;
export const OVERFLOW_Y = 96;
export const FALL_SPEED = 26;
export const GRACE_TICKS = 90;
export const QUEUE_LEN = 512;

export const TIER_RADII: readonly number[] = [16, 20, 24, 29, 35, 42, 50, 60, 72, 86];

export const STAR_THRESHOLDS: readonly number[] = [0, 500, 1500, 3500];

const SPAWN_WEIGHTS: readonly number[] = [30, 28, 22, 14, 6];

export interface Orb {
  id: number;
  tier: number;
  col: number;
  y: number;
}

export interface MergeEvent {
  col: number;
  tier: number;
  combo: number;
  y: number;
}

export interface FusionState {
  seed: string;
  queue: number[];
  queueIndex: number;
  nextTier: number;
  previewTier: number;
  columns: Orb[][];
  falling: Orb | null;
  score: number;
  merges: number;
  combo: number;
  maxTier: number;
  overflowTicks: number;
  ticks: number;
  status: "playing" | "over";
  nextId: number;
  lastMerge: MergeEvent | null;
  mergeEvents: MergeEvent[];
}

export function orbRadius(tier: number): number {
  const i = Math.max(0, Math.min(TIER_COUNT - 1, Math.floor(tier)));
  return TIER_RADII[i]!;
}

export function columnFromX(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(COLS - 1, Math.floor(x / COL_WIDTH)));
}

export function canMerge(a: number, b: number): boolean {
  return a === b;
}

export function mergeResult(a: number, b: number): number {
  if (!canMerge(a, b)) return -1;
  return Math.min(a + 1, TIER_COUNT - 1);
}

export function scoreForMerge(tier: number, combo: number): number {
  const safeCombo = Math.max(1, Math.floor(combo));
  return (Math.max(0, Math.floor(tier)) + 1) * 10 * safeCombo;
}

export function starsForScore(score: number): number {
  const safe = Math.max(0, Math.floor(score));
  let stars = 0;
  for (let i = STAR_THRESHOLDS.length - 1; i >= 0; i -= 1) {
    if (safe >= STAR_THRESHOLDS[i]!) {
      stars = i;
      break;
    }
  }
  return stars;
}

function pickSpawnTier(rng: Rng, weights: readonly number[] = SPAWN_WEIGHTS): number {
  const counts = weights.length > 0 ? weights : SPAWN_WEIGHTS;
  const total = counts.reduce((sum, w) => sum + Math.max(0, w), 0) || 1;
  let roll = rng() * total;
  for (let t = 0; t < counts.length; t += 1) {
    roll -= Math.max(0, counts[t]!);
    if (roll < 0) return Math.min(t, TIER_COUNT - 1);
  }
  return 0;
}

export function spawnQueueWith(seed: string, weights: readonly number[], n: number = QUEUE_LEN): number[] {
  const rng = mulberry32(hashString(`fusion:${seed}`));
  const out: number[] = [];
  for (let i = 0; i < n; i += 1) out.push(pickSpawnTier(rng, weights));
  return out;
}

export function spawnQueue(seed: string, n: number = QUEUE_LEN): number[] {
  return spawnQueueWith(seed, SPAWN_WEIGHTS, n);
}

export function createState(seed: string, queue?: readonly number[]): FusionState {
  const q = queue ? queue.slice() : spawnQueue(seed);
  return {
    seed,
    queue: q,
    queueIndex: 2,
    nextTier: q[0] ?? 0,
    previewTier: q[1] ?? 0,
    columns: Array.from({ length: COLS }, () => [] as Orb[]),
    falling: null,
    score: 0,
    merges: 0,
    combo: 0,
    maxTier: 0,
    overflowTicks: 0,
    ticks: 0,
    status: "playing",
    nextId: 1,
    lastMerge: null,
    mergeEvents: [],
  };
}

export function columnOrbs(state: FusionState, col: number): readonly Orb[] {
  return state.columns[col] ?? [];
}

export function restingY(state: FusionState, col: number, r: number): number {
  const stack = columnOrbs(state, col);
  const top = stack[stack.length - 1];
  if (!top) return BIN_HEIGHT - r;
  return top.y - orbRadius(top.tier) - r;
}

export function isOver(state: FusionState): boolean {
  return state.status === "over";
}

export function activeOrbs(state: FusionState): Orb[] {
  const out: Orb[] = [];
  for (const stack of state.columns) for (const orb of stack) out.push(orb);
  if (state.falling) out.push(state.falling);
  return out;
}

function reflow(state: FusionState, col: number): void {
  const stack = state.columns[col]!;
  let cursor = BIN_HEIGHT;
  for (const orb of stack) {
    const r = orbRadius(orb.tier);
    orb.y = cursor - r;
    cursor = orb.y - r;
  }
}

function resolveMerges(state: FusionState, col: number): void {
  const stack = state.columns[col]!;
  let guard = 0;
  while (guard < 4096) {
    guard += 1;
    let at = -1;
    for (let i = 0; i + 1 < stack.length; i += 1) {
      if (stack[i]!.tier === stack[i + 1]!.tier) {
        at = i;
        break;
      }
    }
    if (at < 0) break;
    const lower = stack[at]!;
    const tier = lower.tier;
    stack.splice(at, 2);
    const cleared = tier >= TIER_COUNT - 1;
    const resultTier = cleared ? tier : tier + 1;
    if (!cleared) {
      stack.splice(at, 0, { id: state.nextId, tier: resultTier, col, y: lower.y });
      state.nextId += 1;
    }
    reflow(state, col);
    state.combo += 1;
    state.merges += 1;
    state.maxTier = Math.max(state.maxTier, resultTier);
    state.score += scoreForMerge(resultTier, state.combo);
    const placed = stack[at];
    const event: MergeEvent = {
      col,
      tier: resultTier,
      combo: state.combo,
      y: placed ? placed.y : lower.y,
    };
    state.lastMerge = event;
    state.mergeEvents.push(event);
  }
}

function land(state: FusionState, orb: Orb): void {
  state.columns[orb.col]!.push(orb);
  state.falling = null;
  state.combo = 0;
  resolveMerges(state, orb.col);
  reflow(state, orb.col);
}

function advanceFalling(state: FusionState): void {
  const orb = state.falling;
  if (!orb) return;
  const r = orbRadius(orb.tier);
  const target = restingY(state, orb.col, r);
  if (orb.y + FALL_SPEED >= target) {
    orb.y = target;
    land(state, orb);
  } else {
    orb.y += FALL_SPEED;
  }
}

function checkOverflow(state: FusionState): void {
  let over = false;
  for (const stack of state.columns) {
    for (const orb of stack) {
      if (orb.y - orbRadius(orb.tier) < OVERFLOW_Y) {
        over = true;
        break;
      }
    }
    if (over) break;
  }
  if (over) {
    state.overflowTicks += 1;
    if (state.overflowTicks >= GRACE_TICKS) state.status = "over";
  } else {
    state.overflowTicks = 0;
  }
}

export function drop(state: FusionState, col: number): boolean {
  if (state.status !== "playing" || state.falling) return false;
  if (!Number.isInteger(col) || col < 0 || col >= COLS) return false;
  const tier = state.nextTier;
  state.falling = { id: state.nextId, tier, col, y: -orbRadius(tier) };
  state.nextId += 1;
  state.nextTier = state.previewTier;
  state.previewTier = state.queue[state.queueIndex] ?? 0;
  state.queueIndex += 1;
  state.combo = 0;
  state.lastMerge = null;
  state.mergeEvents = [];
  return true;
}

export function step(state: FusionState, ticks: number): void {
  if (state.status !== "playing") return;
  const count = Math.max(0, Math.floor(ticks));
  for (let i = 0; i < count; i += 1) {
    state.ticks += 1;
    if (state.falling) advanceFalling(state);
    checkOverflow(state);
    if (isOver(state)) return;
  }
}

export function settle(state: FusionState, limit = 6000): void {
  const start = state.ticks;
  while (state.falling && state.status === "playing" && state.ticks - start < limit) {
    step(state, 1);
  }
}

export function dropsUsed(state: FusionState): number {
  return Math.max(0, state.queueIndex - 2);
}

export function objectiveMet(state: FusionState, targetTier: number): boolean {
  return state.maxTier >= Math.max(0, Math.floor(targetTier));
}
