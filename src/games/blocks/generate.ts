import { hashString, mulberry32, type Rng } from "../../gen/seededRng";

export type ShapeTier = "small" | "medium" | "large";

export type Coord = readonly [row: number, col: number];

export interface ShapeDef {
  /** Stable id used by tests and save-agnostic tooling. */
  readonly id: string;
  readonly label: string;
  /** Normalised cells, top-left anchored. Pieces never rotate by design. */
  readonly cells: readonly Coord[];
  readonly tier: ShapeTier;
  /** Palette id (1..5) from BLOCKS_PALETTE. */
  readonly color: number;
}

/**
 * A curated, balanced library. Pieces do not rotate: this keeps the puzzle
 * about placement and makes the daily seed exactly reproducible.
 */
export const SHAPES: readonly ShapeDef[] = [
  { id: "dot", label: "1 block", cells: [[0, 0]], tier: "small", color: 3 },
  { id: "line2h", label: "2 across", cells: [[0, 0], [0, 1]], tier: "small", color: 1 },
  { id: "line2v", label: "2 down", cells: [[0, 0], [1, 0]], tier: "small", color: 1 },
  { id: "corner3a", label: "3 corner", cells: [[0, 0], [0, 1], [1, 0]], tier: "small", color: 2 },
  { id: "corner3b", label: "3 corner", cells: [[0, 0], [1, 0], [1, 1]], tier: "small", color: 2 },
  { id: "line3h", label: "3 across", cells: [[0, 0], [0, 1], [0, 2]], tier: "medium", color: 1 },
  { id: "line3v", label: "3 down", cells: [[0, 0], [1, 0], [2, 0]], tier: "medium", color: 1 },
  { id: "square2", label: "2 by 2", cells: [[0, 0], [0, 1], [1, 0], [1, 1]], tier: "medium", color: 4 },
  { id: "line4h", label: "4 across", cells: [[0, 0], [0, 1], [0, 2], [0, 3]], tier: "large", color: 5 },
  { id: "line4v", label: "4 down", cells: [[0, 0], [1, 0], [2, 0], [3, 0]], tier: "large", color: 5 },
  { id: "L4a", label: "L block", cells: [[0, 0], [1, 0], [2, 0], [2, 1]], tier: "large", color: 2 },
  { id: "L4b", label: "J block", cells: [[0, 1], [1, 1], [2, 1], [2, 0]], tier: "large", color: 2 },
  { id: "T4", label: "T block", cells: [[0, 0], [0, 1], [0, 2], [1, 1]], tier: "large", color: 5 },
  { id: "S4", label: "S block", cells: [[0, 1], [0, 2], [1, 0], [1, 1]], tier: "large", color: 3 },
  { id: "Z4", label: "Z block", cells: [[0, 0], [0, 1], [1, 1], [1, 2]], tier: "large", color: 3 },
  { id: "square3", label: "3 by 3", cells: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]], tier: "large", color: 4 },
  { id: "rect2x3", label: "2 by 3", cells: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]], tier: "large", color: 4 },
];

const WEIGHTS: Record<string, number> = {
  dot: 1.4,
  line2h: 2.4,
  line2v: 2.4,
  corner3a: 2.2,
  corner3b: 2.2,
  line3h: 2.6,
  line3v: 2.6,
  square2: 2.4,
  line4h: 1.6,
  line4v: 1.6,
  L4a: 1.8,
  L4b: 1.8,
  T4: 1.8,
  S4: 1.7,
  Z4: 1.7,
  square3: 0.6,
  rect2x3: 0.7,
};

const BY_ID = new Map<string, ShapeDef>(SHAPES.map((s) => [s.id, s]));
const EASY_POOL = SHAPES.filter((s) => s.tier !== "large");

export function shapeById(id: string): ShapeDef | undefined {
  return BY_ID.get(id);
}

export function shapeIds(): string[] {
  return SHAPES.map((s) => s.id);
}

function weightOf(shape: ShapeDef): number {
  return WEIGHTS[shape.id] ?? 1;
}

function pickWeighted(rng: Rng, pool: readonly ShapeDef[]): ShapeDef {
  let total = 0;
  for (const shape of pool) total += weightOf(shape);
  let roll = rng() * total;
  for (const shape of pool) {
    roll -= weightOf(shape);
    if (roll < 0) return shape;
  }
  return pool[pool.length - 1]!;
}

function indexSeed(seed: string, index: number): string {
  return `${seed}#piece:${index}`;
}

/** Deterministic weighted pick for a stream position. */
export function pieceAt(seed: string, index: number): ShapeDef {
  return pickWeighted(mulberry32(hashString(indexSeed(seed, index))), SHAPES);
}

/** Deterministic pick restricted to small/medium shapes. */
export function easierPieceAt(seed: string, index: number): ShapeDef {
  return pickWeighted(mulberry32(hashString(`${indexSeed(seed, index)}:easy`)), EASY_POOL);
}

/**
 * Deal the next set of three pieces for a batch. Purely derived from
 * (seed, batch, board, size): identical input yields identical output.
 *
 * Two light fairness rules keep runs from being decided by a single ugly deal:
 * - a crowded board (>= 70% full) always gets at least one small/medium piece;
 * - a set is never entirely large shapes.
 * Neither rule guarantees a legal placement, so genuine game-overs still happen.
 */
export function deal(seed: string, batch: number, board: readonly number[], size: number): ShapeDef[] {
  const base = batch * 3;
  let pieces = [pieceAt(seed, base), pieceAt(seed, base + 1), pieceAt(seed, base + 2)];

  const filled = board.reduce((n, cell) => (cell !== 0 ? n + 1 : n), 0);
  const total = size > 0 ? size * size : board.length;
  const ratio = total > 0 ? filled / total : 0;
  if (ratio >= 0.7 && !pieces.some((p) => p.tier !== "large")) {
    pieces = [easierPieceAt(seed, base), pieces[1]!, pieces[2]!];
  }
  if (pieces.every((p) => p.tier === "large")) {
    pieces = [pieces[0]!, pieces[1]!, easierPieceAt(seed, base + 2)];
  }
  return pieces;
}
