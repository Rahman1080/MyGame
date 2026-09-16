import { isTimedLevel, tierForLevel, timeLimitMs, type Tier } from "../../platform/levels";
import { spawnQueueWith, type FusionState } from "./logic";
import { solveLevel } from "./solver";

export const FUSION_LEVELS = 105;
export const FUSION_TIME_SCALE = 4;
export const FUSION_SOLVER_WIDTH = 32;
export const FUSION_TARGET_MIN = 2;

export interface FusionLevelConfig {
  level: number;
  tier: Tier;
  target: number;
  budget: number;
  par: number;
  timed: boolean;
  timeLimitMs: number;
  seed: string;
  queue: number[];
}

interface TierSpec {
  target: number;
  budget: number;
  weights: readonly number[];
}

const TIER_SPECS: Record<Tier, TierSpec> = {
  easy: { target: 2, budget: 10, weights: [40, 34, 18, 8, 0] },
  normal: { target: 3, budget: 16, weights: [34, 30, 22, 12, 2] },
  medium: { target: 3, budget: 14, weights: [30, 28, 22, 14, 6] },
  hard: { target: 4, budget: 22, weights: [26, 26, 24, 16, 8] },
  super: { target: 4, budget: 18, weights: [24, 25, 24, 18, 9] },
  extra: { target: 5, budget: 30, weights: [16, 22, 26, 24, 12] },
  mind: { target: 5, budget: 26, weights: [14, 20, 26, 26, 14] },
};

function clampLevel(level: number): number {
  if (!Number.isFinite(level)) return 1;
  return Math.min(FUSION_LEVELS, Math.max(1, Math.floor(level)));
}

function parFor(budget: number): number {
  return Math.max(3, budget - 3);
}

function configFor(level: number, target: number, budget: number, seed: string, spec: TierSpec): FusionLevelConfig | null {
  const queue = spawnQueueWith(seed, spec.weights, budget + 24);
  const solved = solveLevel(seed, queue, target, budget, FUSION_SOLVER_WIDTH).solved;
  if (!solved) return null;
  const tier = tierForLevel(level, FUSION_LEVELS);
  const timed = isTimedLevel(level, FUSION_LEVELS);
  return {
    level,
    tier,
    target,
    budget,
    par: parFor(budget),
    timed,
    timeLimitMs: timed ? timeLimitMs(level, FUSION_LEVELS) * FUSION_TIME_SCALE : 0,
    seed,
    queue,
  };
}

function buildConfig(level: number): FusionLevelConfig {
  const safe = clampLevel(level);
  const spec = TIER_SPECS[tierForLevel(safe, FUSION_LEVELS)];
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const seed = `fusion:level:${safe}:v${attempt}`;
    const downgrade = attempt >= 8 ? 1 : 0;
    const target = Math.max(FUSION_TARGET_MIN, spec.target - downgrade);
    const budget = spec.budget + (attempt % 8);
    const config = configFor(safe, target, budget, seed, spec);
    if (config) return config;
  }
  for (let budget = spec.budget + 16; budget <= 140; budget += 12) {
    const seed = `fusion:level:${safe}:fallback`;
    const config = configFor(safe, FUSION_TARGET_MIN, budget, seed, spec);
    if (config) return config;
  }
  const seed = `fusion:level:${safe}:last`;
  const queue = spawnQueueWith(seed, spec.weights, 64);
  const tier = tierForLevel(safe, FUSION_LEVELS);
  return {
    level: safe,
    tier,
    target: 1,
    budget: 24,
    par: parFor(24),
    timed: isTimedLevel(safe, FUSION_LEVELS),
    timeLimitMs: 0,
    seed,
    queue,
  };
}

const cache = new Map<number, FusionLevelConfig>();

export function fusionLevelConfig(level: number): FusionLevelConfig {
  const safe = clampLevel(level);
  const hit = cache.get(safe);
  if (hit) return hit;
  const config = buildConfig(safe);
  cache.set(safe, config);
  return config;
}

export function fusionStarsForDrops(drops: number, par: number): number {
  const used = Math.max(0, Math.floor(drops));
  if (used <= par) return 3;
  if (used <= par + 3) return 2;
  return 1;
}

export function fusionIsObjectiveMet(state: FusionState, config: FusionLevelConfig): boolean {
  return state.maxTier >= config.target;
}
