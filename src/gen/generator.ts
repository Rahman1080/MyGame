import type { Cell, ColorName, Direction, Puzzle } from "../engine/types";
import { COLORS } from "../engine/types";
import { canonicalPar, computePar, type ParMode } from "../engine/solver";
import { validateCanonicalSolution, validateFinal, validateStructure } from "../engine/validation";
import { fillFromMap } from "./fill";
import { storySeed } from "./identity";
import { mulberry32, rngInt, rngPick, rngShuffle, type Rng } from "./seededRng";
import {
  profileForLevel,
  scoreDifficulty,
  type DifficultyFeatures,
  type DifficultyProfile,
} from "./difficulty";

const DELTAS: Array<{ dr: number; dc: number; dir: Direction }> = [
  { dr: -1, dc: 0, dir: 0 },
  { dr: 0, dc: 1, dir: 1 },
  { dr: 1, dc: 0, dir: 2 },
  { dr: 0, dc: -1, dir: 3 },
];

function key(r: number, c: number): string {
  return `${r},${c}`;
}

function neighbors(size: number, r: number, c: number): typeof DELTAS {
  return DELTAS.filter((d) => {
    const nr = r + d.dr;
    const nc = c + d.dc;
    return nr >= 0 && nc >= 0 && nr < size && nc < size;
  });
}

function randomPath(
  rng: Rng,
  size: number,
  minLen: number,
  maxLen: number,
): Array<{ r: number; c: number }> | null {
  const cap = size * size - 1;
  const target = rngInt(rng, minLen, Math.min(maxLen, cap));
  const startR = rngInt(rng, 0, size - 1);
  const startC = rngInt(rng, 0, size - 1);
  const path = [{ r: startR, c: startC }];
  const used = new Set([key(startR, startC)]);
  let lastDir: Direction | null = null;

  while (path.length < target) {
    const cur = path[path.length - 1]!;
    const opts = neighbors(size, cur.r, cur.c).filter(
      (d) => !used.has(key(cur.r + d.dr, cur.c + d.dc)),
    );
    if (opts.length === 0) break;
    const straight: typeof DELTAS = lastDir === null ? [] : opts.filter((d) => d.dir === lastDir);
    const pickPool: typeof DELTAS = straight.length && rng() < 0.62 ? straight : opts;
    const n = rngPick(rng, rngShuffle(rng, pickPool));
    const nr = cur.r + n.dr;
    const nc = cur.c + n.dc;
    path.push({ r: nr, c: nc });
    used.add(key(nr, nc));
    lastDir = n.dir;
  }

  if (path.length < minLen) return null;
  return path;
}

function dirBetween(a: { r: number; c: number }, b: { r: number; c: number }): Direction {
  const dr = b.r - a.r;
  const dc = b.c - a.c;
  if (dr === -1 && dc === 0) return 0;
  if (dr === 0 && dc === 1) return 1;
  if (dr === 1 && dc === 0) return 2;
  return 3;
}

function scrambleAway(rng: Rng, dir: Direction): Direction {
  const steps = rng() < 0.7 ? 1 : rngInt(rng, 1, 3);
  return (((dir + steps) % 4) + 4) % 4 as Direction;
}

export interface GenerateOptions {
  id: string;
  pack: string;
  level?: number;
  profile?: DifficultyProfile;
  /** Par strategy. "minimum" (default) runs the exact solver; "canonical" is fast. */
  parMode?: ParMode;
  /**
   * When true (default for "minimum" mode), candidates whose exact minimum par
   * cannot be proven within the search budget are rejected instead of being
   * shipped with a less-trustworthy par. Development/stress can set false.
   */
  requireExactPar?: boolean;
  /** Optional dev-only counters. Populated in place; never affects output. */
  metrics?: GenerationMetrics;
}

/** Dev/stress instrumentation. All counters are best-effort and side-effect free. */
export interface GenerationMetrics {
  attempts: number;
  candidates: number;
  rejectedStructure: number;
  rejectedCanonical: number;
  rejectedInexact: number;
  usedClosest: boolean;
  usedFallback: boolean;
}

export function emptyMetrics(): GenerationMetrics {
  return {
    attempts: 0,
    candidates: 0,
    rejectedStructure: 0,
    rejectedCanonical: 0,
    rejectedInexact: 0,
    usedClosest: false,
    usedFallback: false,
  };
}

interface Candidate {
  puzzle: Puzzle;
  pathLength: number;
  locks: number;
}

function featuresFor(
  puzzle: Puzzle,
  pathLength: number,
  rotationCount: number,
  locks: number,
): DifficultyFeatures {
  const size = puzzle.size;
  const requiredKeys = new Set(
    puzzle.cells.filter((c) => c.required).map((c) => key(c.row, c.col)),
  );
  let routeBranching = 0;
  for (const c of puzzle.cells) {
    if (c.required || c.type !== "arrow") continue;
    const touches = DELTAS.some((d) => requiredKeys.has(key(c.row + d.dr, c.col + d.dc)));
    if (touches) routeBranching += 1;
  }
  return {
    size,
    pathLength,
    rotationCount,
    locks,
    decoys: puzzle.cells.filter((c) => !c.required && c.type === "arrow").length,
    routeBranching,
    alternativeSolutions: 0,
    density: size > 0 ? pathLength / (size * size) : 0,
  };
}

function buildCandidate(
  rng: Rng,
  seed: number,
  profile: DifficultyProfile,
  opts: GenerateOptions,
): Candidate | null {
  const path = randomPath(rng, profile.size, profile.minPath, profile.maxPath);
  if (!path || path.length < 3) return null;
  const occupancy = path.length / (profile.size * profile.size);
  if (occupancy < Math.max(0.45, 0.72 - profile.emptyBias)) return null;

  const start = path[0]!;
  const lastNode = path[path.length - 1]!;
  const exitCandidates = neighbors(profile.size, lastNode.r, lastNode.c).filter(
    (d) => !path.some((p) => p.r === lastNode.r + d.dr && p.c === lastNode.c + d.dc),
  );
  if (exitCandidates.length === 0) return null;
  const exitDelta = rngPick(rng, exitCandidates);
  const exit = { r: lastNode.r + exitDelta.dr, c: lastNode.c + exitDelta.dc };

  const map = new Map<string, Cell>();
  let lastGateColor: ColorName | null = null;
  for (let i = 0; i < path.length; i += 1) {
    const cur = path[i]!;
    const next = i < path.length - 1 ? path[i + 1]! : exit;
    const canonicalDir = dirBetween(cur, next);
    const isStart = i === 0;
    const color = COLORS[i % COLORS.length] as ColorName;
    const eligible = profile.gates && i > 1 && i < path.length - 1;
    const lastEligible = eligible && i === path.length - 2;
    const useGate: boolean = eligible && (rng() < 0.28 || (lastGateColor === null && lastEligible));
    const gateOptions = COLORS.filter((c) => c !== lastGateColor);
    const gateColor: ColorName | null = useGate ? rngPick(rng, gateOptions) : null;
    if (gateColor) lastGateColor = gateColor;
    map.set(key(cur.r, cur.c), {
      row: cur.r,
      col: cur.c,
      type: isStart ? "start" : useGate ? "gate" : "arrow",
      direction: canonicalDir,
      canonicalDir,
      required: true,
      color: gateColor ?? color,
      locked: false,
    });
  }
  map.set(key(exit.r, exit.c), {
    row: exit.r,
    col: exit.c,
    type: "exit",
    required: false,
    color: lastGateColor ?? undefined,
  });

  if (profile.decoyChance > 0) {
    for (let r = 0; r < profile.size; r += 1) {
      for (let c = 0; c < profile.size; c += 1) {
        if (map.has(key(r, c))) continue;
        if (rng() > profile.decoyChance) continue;
        const nbs = neighbors(profile.size, r, c);
        if (nbs.length === 0) continue;
        const dir = rngPick(rng, nbs).dir;
        map.set(key(r, c), {
          row: r,
          col: c,
          type: "arrow",
          direction: dir,
          canonicalDir: dir,
          required: false,
          color: rngPick(rng, COLORS),
          locked: false,
        });
      }
    }
  }

  const cells = fillFromMap(profile.size, map);
  const required = cells.filter((c) => c.required && c.canonicalDir !== undefined && !c.locked);
  const scrambleCount = Math.min(
    required.length,
    rngInt(rng, profile.scrambleMin, profile.scrambleMax),
  );
  const scrambleTargets = rngShuffle(rng, required).slice(0, scrambleCount);
  for (const t of scrambleTargets) {
    t.direction = scrambleAway(rng, t.canonicalDir as Direction);
  }

  let locks = 0;
  for (const c of cells) {
    if (!c.required || c.type === "start" || c.direction === undefined) continue;
    if (c.direction !== c.canonicalDir) continue;
    if (rng() < profile.lockChance) {
      c.locked = true;
      locks += 1;
    }
  }

  const puzzle: Puzzle = {
    id: opts.id,
    seed,
    size: profile.size,
    cells,
    start: { row: start.r, col: start.c },
    exit: { row: exit.r, col: exit.c },
    par: canonicalPar(cells),
    parKind: "canonical",
    difficulty: 0,
    pack: opts.pack,
  };

  return { puzzle, pathLength: path.length, locks };
}

/**
 * Validation pipeline for every generated puzzle:
 *   generate -> validate structure -> validate canonical solution
 *   -> calculate par -> calculate difficulty -> final validate -> return.
 *
 * Par is the deterministic canonical route (the intended solution), so it is
 * always fast and honest. When a profile sets `targetPar`, generation tries
 * fresh candidate seeds until the par lands within `PAR_TOLERANCE`; if none do,
 * the closest valid candidate is returned so the curve degrades gracefully.
 * If every candidate fails validation a deterministic fallback is built and
 * validated; an invalid fallback throws instead of shipping.
 */
const PAR_TOLERANCE = 2;
// Canonical par is a single cheap simulation per candidate. Exact minimum par
// is a bounded search per candidate, so it is more expensive; 400 attempts keeps
// the worst level (size 6) under a few hundred ms while still landing every
// story level within tolerance. Both are deterministic (no wall-clock cutoffs).
const CANONICAL_ATTEMPTS = 400;
const MINIMUM_ATTEMPTS = 400;

function devWarn(message: string): void {
  if (import.meta.env?.DEV) console.warn(`[glowtrail:generator] ${message}`);
}

/**
 * Validation pipeline for every generated puzzle:
 *   generate -> validate structure -> validate canonical solution
 *   -> compute par -> calculate difficulty -> final validate -> return.
 *
 * Player-facing par is the exact minimum rotation count. When the profile sets
 * `targetPar`, generation tries fresh candidate seeds until the minimum par
 * lands within `PAR_TOLERANCE`; if none do, the closest valid candidate is
 * returned so the curve degrades gracefully. Candidates whose exact minimum
 * cannot be proven within the search budget are rejected (unless
 * `requireExactPar` is explicitly disabled for dev/stress), and a puzzle is
 * never shipped labelled "minimum" unless the solver proved it. If every
 * candidate fails validation a deterministic fallback is built and validated;
 * an invalid fallback throws instead of shipping.
 */
export function generatePuzzle(seed: number, opts: GenerateOptions): Puzzle {
  const profile = opts.profile ?? profileForLevel(opts.level ?? 10);
  const mode: ParMode = opts.parMode ?? "minimum";
  const requireExact = opts.requireExactPar ?? mode === "minimum";
  const attempts = mode === "minimum" ? MINIMUM_ATTEMPTS : CANONICAL_ATTEMPTS;
  let best: Puzzle | null = null;
  let bestDelta = Number.POSITIVE_INFINITY;
  let rejectedInexact = 0;
  const metrics = opts.metrics;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (metrics) metrics.attempts += 1;
    const attemptSeed = (seed + Math.imul(attempt, 0x9e3779b1)) >>> 0;
    const rng = mulberry32(attemptSeed);
    const built = buildCandidate(rng, seed, profile, opts);
    if (!built) continue;
    const { puzzle, pathLength, locks } = built;
    if (metrics) metrics.candidates += 1;

    if (!validateStructure(puzzle).ok) {
      if (metrics) metrics.rejectedStructure += 1;
      continue;
    }
    if (!validateCanonicalSolution(puzzle).ok) {
      if (metrics) metrics.rejectedCanonical += 1;
      continue;
    }

    const parInfo = computePar(puzzle, mode);
    if (!parInfo.solvable) continue;

    if (mode === "minimum" && parInfo.kind !== "minimum") {
      rejectedInexact += 1;
      if (metrics) metrics.rejectedInexact += 1;
      if (requireExact) continue;
      devWarn(
        `rejected candidate for ${opts.id}: exact minimum not proven within budget; ` +
          `falling back to canonical par ${parInfo.par}`,
      );
    }

    puzzle.par = parInfo.par;
    puzzle.parKind = parInfo.kind;
    puzzle.difficulty = scoreDifficulty(featuresFor(puzzle, pathLength, parInfo.par, locks));

    if (!validateFinal(puzzle).ok) continue;

    if (profile.targetPar === undefined) return puzzle;
    const delta = Math.abs(puzzle.par - profile.targetPar);
    if (delta <= PAR_TOLERANCE) return puzzle;
    if (delta < bestDelta) {
      bestDelta = delta;
      best = puzzle;
    }
  }

  if (best) {
    if (metrics) metrics.usedClosest = true;
    if (rejectedInexact > 0) {
      devWarn(`${opts.id}: ${rejectedInexact} candidate(s) rejected for unproven minimum par`);
    }
    return best;
  }

  const fallback = buildFallback(seed, opts.id, opts.pack, profile.size);
  if (metrics) metrics.usedFallback = true;
  const parInfo = computePar(fallback, mode);
  fallback.par = parInfo.par;
  fallback.parKind = parInfo.kind;
  fallback.difficulty = scoreDifficulty(
    featuresFor(fallback, fallback.cells.filter((c) => c.required).length, parInfo.par, 0),
  );
  const check = validateFinal(fallback);
  if (!check.ok) {
    throw new Error(
      `generator: fallback puzzle invalid for size ${profile.size} (${check.errors.join(", ")})`,
    );
  }
  if (mode === "minimum" && fallback.parKind !== "minimum") {
    devWarn(`fallback ${opts.id} could not prove exact minimum; labelled canonical`);
  }
  return fallback;
}

function buildFallback(seed: number, id: string, pack: string, size: number): Puzzle {
  const map = new Map<string, Cell>();
  const path: Array<[number, number]> = [];
  for (let c = 0; c < size - 1; c += 1) path.push([0, c]);
  for (let r = 0; r < size; r += 1) path.push([r, size - 1]);
  const unique: Array<[number, number]> = [];
  const seen = new Set<string>();
  for (const p of path) {
    const k = key(p[0], p[1]);
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(p);
  }
  const exit = unique.pop()!;
  for (let i = 0; i < unique.length; i += 1) {
    const cur = unique[i]!;
    const next = i < unique.length - 1 ? unique[i + 1]! : exit;
    const dir = dirBetween({ r: cur[0], c: cur[1] }, { r: next[0], c: next[1] });
    map.set(key(cur[0], cur[1]), {
      row: cur[0],
      col: cur[1],
      type: i === 0 ? "start" : "arrow",
      direction: i === 1 ? (((dir + 1) % 4) as Direction) : dir,
      canonicalDir: dir,
      required: true,
      locked: false,
      color: COLORS[i % 4],
    });
  }
  map.set(key(exit[0], exit[1]), {
    row: exit[0],
    col: exit[1],
    type: "exit",
    required: false,
  });
  const cells = fillFromMap(size, map);
  return {
    id,
    seed,
    size,
    cells,
    start: { row: unique[0]![0], col: unique[0]![1] },
    exit: { row: exit[0], col: exit[1] },
    par: canonicalPar(cells),
    parKind: "canonical",
    difficulty: 0,
    pack,
  };
}

export function seedForLevel(level: number): number {
  return storySeed(level);
}

export function generateLevel(level: number): Puzzle {
  const pack = level <= 20 ? "pulse" : level <= 40 ? "surge" : level <= 60 ? "color-gates" : "lattice";
  return generatePuzzle(seedForLevel(level), {
    id: `${pack}-${level}`,
    pack,
    level,
  });
}
