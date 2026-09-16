import { describe, expect, it } from "vitest";
import { TIERS, tierForLevel } from "../src/platform/levels";
import {
  FUSION_LEVELS,
  fusionLevelConfig,
  fusionStarsForDrops,
  type FusionLevelConfig,
} from "../src/games/fusion/levels";
import { createState } from "../src/games/fusion/logic";
import { solveLevel } from "../src/games/fusion/solver";

function configs(): FusionLevelConfig[] {
  const out: FusionLevelConfig[] = [];
  for (let level = 1; level <= FUSION_LEVELS; level += 1) out.push(fusionLevelConfig(level));
  return out;
}

describe("fusion level configs", () => {
  it("ships 100+ levels", () => {
    expect(FUSION_LEVELS).toBeGreaterThanOrEqual(100);
  });

  it("bands every level into the shared tiers in order", () => {
    let prev = -1;
    for (let level = 1; level <= FUSION_LEVELS; level += 1) {
      const index = TIERS.indexOf(fusionLevelConfig(level).tier);
      expect(index).toBeGreaterThanOrEqual(prev);
      prev = index;
    }
    expect(fusionLevelConfig(FUSION_LEVELS).tier).toBe("mind");
  });

  it("is deterministic per level", () => {
    for (const level of [1, 37, 80, FUSION_LEVELS]) {
      const a = fusionLevelConfig(level);
      const b = fusionLevelConfig(level);
      expect(b.seed).toBe(a.seed);
      expect(b.target).toBe(a.target);
      expect(b.budget).toBe(a.budget);
      expect(b.queue).toEqual(a.queue);
    }
  });

  it("keeps budgets, pars and targets sane", () => {
    for (const config of configs()) {
      expect(config.target).toBeGreaterThanOrEqual(2);
      expect(config.budget).toBeGreaterThan(0);
      expect(config.par).toBeLessThanOrEqual(config.budget);
      expect(config.par).toBeGreaterThanOrEqual(3);
      expect(config.queue.length).toBeGreaterThan(config.budget);
      expect(config.tier).toBe(tierForLevel(config.level, FUSION_LEVELS));
    }
  });

  it("times hard tiers and untimes easy", () => {
    expect(fusionLevelConfig(1).timed).toBe(false);
    expect(fusionLevelConfig(20).timed).toBe(false);
    expect(fusionLevelConfig(FUSION_LEVELS).timed).toBe(true);
    expect(fusionLevelConfig(FUSION_LEVELS).timeLimitMs).toBeGreaterThan(0);
  });

  it("proves every level solvable within budget", () => {
    for (const config of configs()) {
      const result = solveLevel(config.seed, config.queue, config.target, config.budget);
      expect(result.solved, `level ${config.level}`).toBe(true);
    }
  });

  it("awards stars by drop count", () => {
    expect(fusionStarsForDrops(4, 6)).toBe(3);
    expect(fusionStarsForDrops(6, 6)).toBe(3);
    expect(fusionStarsForDrops(8, 6)).toBe(2);
    expect(fusionStarsForDrops(12, 6)).toBe(1);
  });

  it("creates a playable state from a config queue", () => {
    const config = fusionLevelConfig(1);
    const state = createState(config.seed, config.queue);
    expect(state.status).toBe("playing");
    expect(state.maxTier).toBeLessThan(config.target);
  });
});
