export interface DifficultyProfile {
  size: number;
  minPath: number;
  maxPath: number;
  lockChance: number;
  emptyBias: number;
  scrambleMin: number;
  scrambleMax: number;
  gates: boolean;
  decoyChance: number;
  /** Preferred canonical par for this level. Generation retries to land near it. */
  targetPar?: number;
  /** Splice a warping portal pair into a straight segment of the route. */
  portals?: boolean;
  /** Number of portal pairs to attempt. Defaults to 1 when `portals`. */
  portalPairs?: number;
  /** Convert straight route cells into fixed one-way walls. */
  oneWayWalls?: boolean;
  /** Number of one-way walls to place on the route. Defaults to 1. */
  walls?: number;
}

function ramp(level: number, start: number, end: number, from: number, to: number): number {
  if (end <= start) return from;
  const t = Math.max(0, Math.min(1, (level - start) / (end - start)));
  return Math.round(from + (to - from) * t);
}

/**
 * Smooth 120-level schedule. Size steps 3 -> 4 -> 5 -> 6 while target par climbs
 * monotonically, and late packs add density, locks and decoys so every level-up
 * feels harder. Levels 81-100 (wormhole) add portal pairs; 101-120 (vector) add
 * one-way walls. Levels 1-3 are hand-authored tutorials and never reach this.
 */
export function profileForLevel(level: number): DifficultyProfile {
  if (level <= 12) {
    const targetPar = ramp(level, 4, 12, 2, 7);
    return { size: 3, minPath: 4, maxPath: 8, lockChance: 0, emptyBias: 0.2, scrambleMin: 2, scrambleMax: 5, gates: false, decoyChance: level >= 9 ? 0.03 : 0, targetPar };
  }
  if (level <= 20) {
    const targetPar = ramp(level, 13, 20, 7, 12);
    return { size: 4, minPath: 8, maxPath: 12, lockChance: 0.06, emptyBias: 0.16, scrambleMin: 3, scrambleMax: 7, gates: false, decoyChance: 0.05, targetPar };
  }
  if (level <= 30) {
    const targetPar = ramp(level, 21, 30, 12, 17);
    return { size: 4, minPath: 10, maxPath: 14, lockChance: 0.14, emptyBias: 0.12, scrambleMin: 4, scrambleMax: 9, gates: false, decoyChance: 0.07, targetPar };
  }
  if (level <= 40) {
    const targetPar = ramp(level, 31, 40, 17, 21);
    return { size: 4, minPath: 11, maxPath: 15, lockChance: 0.2, emptyBias: 0.1, scrambleMin: 5, scrambleMax: 10, gates: false, decoyChance: 0.1, targetPar };
  }
  if (level <= 50) {
    const targetPar = ramp(level, 41, 50, 21, 26);
    return { size: 5, minPath: 14, maxPath: 20, lockChance: 0.2, emptyBias: 0.12, scrambleMin: 5, scrambleMax: 11, gates: true, decoyChance: 0.09, targetPar };
  }
  if (level <= 60) {
    const targetPar = ramp(level, 51, 60, 26, 31);
    return { size: 5, minPath: 16, maxPath: 22, lockChance: 0.22, emptyBias: 0.1, scrambleMin: 6, scrambleMax: 13, gates: true, decoyChance: 0.1, targetPar };
  }
  if (level <= 70) {
    const targetPar = ramp(level, 61, 70, 31, 36);
    return { size: 5, minPath: 18, maxPath: 24, lockChance: 0.26, emptyBias: 0.08, scrambleMin: 7, scrambleMax: 14, gates: true, decoyChance: 0.12, targetPar };
  }
  if (level <= 80) {
    const targetPar = ramp(level, 71, 80, 36, 40);
    return { size: 6, minPath: 20, maxPath: 30, lockChance: 0.26, emptyBias: 0.08, scrambleMin: 8, scrambleMax: 15, gates: true, decoyChance: 0.12, targetPar };
  }
  if (level <= 90) {
    const targetPar = ramp(level, 81, 90, 40, 46);
    return { size: 5, minPath: 18, maxPath: 24, lockChance: 0.2, emptyBias: 0.08, scrambleMin: 7, scrambleMax: 14, gates: true, decoyChance: 0.12, portals: true, portalPairs: 1, targetPar };
  }
  if (level <= 100) {
    const targetPar = ramp(level, 91, 100, 46, 52);
    return { size: 6, minPath: 20, maxPath: 30, lockChance: 0.22, emptyBias: 0.08, scrambleMin: 8, scrambleMax: 15, gates: true, decoyChance: 0.12, portals: true, portalPairs: level >= 96 ? 2 : 1, targetPar };
  }
  if (level <= 110) {
    const targetPar = ramp(level, 101, 110, 46, 52);
    return { size: 5, minPath: 18, maxPath: 24, lockChance: 0.22, emptyBias: 0.08, scrambleMin: 7, scrambleMax: 14, gates: true, decoyChance: 0.12, oneWayWalls: true, walls: 2, targetPar };
  }
  const targetPar = ramp(level, 111, 120, 52, 58);
  return { size: 6, minPath: 20, maxPath: 30, lockChance: 0.24, emptyBias: 0.08, scrambleMin: 8, scrambleMax: 15, gates: true, decoyChance: 0.12, oneWayWalls: true, walls: 3, targetPar };
}

export function dailyProfile(index: number): DifficultyProfile {
  const table: DifficultyProfile[] = [
    { size: 3, minPath: 5, maxPath: 7, lockChance: 0, emptyBias: 0.18, scrambleMin: 2, scrambleMax: 3, gates: false, decoyChance: 0, targetPar: 3 },
    { size: 4, minPath: 9, maxPath: 12, lockChance: 0.1, emptyBias: 0.16, scrambleMin: 3, scrambleMax: 5, gates: false, decoyChance: 0.05, targetPar: 7 },
    { size: 4, minPath: 11, maxPath: 14, lockChance: 0.18, emptyBias: 0.12, scrambleMin: 4, scrambleMax: 7, gates: false, decoyChance: 0.06, targetPar: 12 },
    { size: 5, minPath: 15, maxPath: 20, lockChance: 0.22, emptyBias: 0.12, scrambleMin: 5, scrambleMax: 9, gates: false, decoyChance: 0.08, targetPar: 18 },
    { size: 5, minPath: 17, maxPath: 22, lockChance: 0.25, emptyBias: 0.1, scrambleMin: 6, scrambleMax: 12, gates: true, decoyChance: 0.08, targetPar: 24 },
  ];
  return table[index] ?? table[4]!;
}

/**
 * Modular difficulty model. The score is a weighted sum of independent
 * features; `rotationCount` is the canonical target par, so the score tracks
 * how many deliberate rotations the intended route really needs.
 */
export interface DifficultyFeatures {
  size: number;
  pathLength: number;
  rotationCount: number;
  locks: number;
  decoys: number;
  routeBranching: number;
  alternativeSolutions: number;
  density: number;
  portals: number;
  walls: number;
}

export interface DifficultyWeights {
  size: number;
  pathLength: number;
  rotationCount: number;
  locks: number;
  decoys: number;
  routeBranching: number;
  alternativeSolutions: number;
  density: number;
  portals: number;
  walls: number;
}

/**
 * `alternativeSolutions` is intentionally weighted to 0 and is always computed
 * as 0 by `featuresFor`. Counting genuinely distinct valid solutions is future
 * work; until it is implemented it must not contribute to the difficulty score.
 */
export const DIFFICULTY_WEIGHTS: DifficultyWeights = {
  size: 9,
  pathLength: 1.2,
  rotationCount: 2.4,
  locks: 2,
  decoys: 1.5,
  routeBranching: 1.2,
  alternativeSolutions: 0,
  density: 12,
  portals: 4,
  walls: 2,
};

export function emptyFeatures(): DifficultyFeatures {
  return {
    size: 0,
    pathLength: 0,
    rotationCount: 0,
    locks: 0,
    decoys: 0,
    routeBranching: 0,
    alternativeSolutions: 0,
    density: 0,
    portals: 0,
    walls: 0,
  };
}

export function scoreDifficulty(
  features: DifficultyFeatures,
  weights: DifficultyWeights = DIFFICULTY_WEIGHTS,
): number {
  return Math.round(
    features.size * weights.size +
      features.pathLength * weights.pathLength +
      features.rotationCount * weights.rotationCount +
      features.locks * weights.locks +
      features.decoys * weights.decoys +
      features.routeBranching * weights.routeBranching +
      features.alternativeSolutions * weights.alternativeSolutions +
      features.density * weights.density +
      features.portals * weights.portals +
      features.walls * weights.walls,
  );
}

/** Collapses the raw difficulty score into a 1-10 rating for the HUD. */
export function difficultyRating(score: number): number {
  return Math.max(1, Math.min(10, Math.round(1 + (score - 45) / 17)));
}
