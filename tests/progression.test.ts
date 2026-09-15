import { describe, expect, it } from "vitest";
import {
  levelForXp,
  xpForGame,
  xpForNextLevel,
  xpProgress,
  xpToReachLevel,
} from "../src/platform/progression";

describe("xp rewards", () => {
  it("increases with stars and rewards perfect runs", () => {
    const base = xpForGame({ score: 0 });
    expect(xpForGame({ score: 0, stars: 1 })).toBeGreaterThan(base);
    expect(xpForGame({ score: 0, stars: 2 })).toBeGreaterThan(xpForGame({ score: 0, stars: 1 }));
    expect(xpForGame({ score: 0, stars: 3 })).toBeGreaterThan(xpForGame({ score: 0, stars: 2 }));
  });

  it("clamps out-of-range stars and never returns negative xp", () => {
    expect(xpForGame({ score: 0, stars: -5 })).toBe(xpForGame({ score: 0, stars: 0 }));
    expect(xpForGame({ score: 0, stars: 99 })).toBe(xpForGame({ score: 0, stars: 3 }));
    expect(xpForGame({ score: 0 })).toBeGreaterThan(0);
  });
});

describe("level curve", () => {
  it("starts at level 1 and advances at exact thresholds", () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(xpToReachLevel(2) - 1)).toBe(1);
    expect(levelForXp(xpToReachLevel(2))).toBe(2);
    expect(levelForXp(xpToReachLevel(3))).toBe(3);
  });

  it("is monotonic non-decreasing", () => {
    let prev = 0;
    for (let xp = 0; xp <= 4000; xp += 7) {
      const level = levelForXp(xp);
      expect(level).toBeGreaterThanOrEqual(prev);
      prev = level;
    }
  });

  it("round-trips every level threshold", () => {
    for (let level = 1; level <= 25; level += 1) {
      expect(levelForXp(xpToReachLevel(level))).toBe(level);
    }
  });

  it("next-level cost grows by a fixed step", () => {
    expect(xpForNextLevel(1)).toBe(100);
    expect(xpForNextLevel(2)).toBe(200);
    expect(xpForNextLevel(3)).toBe(300);
  });

  it("progress always reconstructs the input xp", () => {
    for (let xp = 0; xp <= 2000; xp += 13) {
      const { level, into, need } = xpProgress(xp);
      expect(xpToReachLevel(level) + into).toBe(xp);
      expect(need).toBeGreaterThan(0);
      expect(into).toBeLessThan(need);
    }
  });
});
