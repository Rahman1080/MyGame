import { describe, expect, it } from "vitest";
import { TIERS, tierForLevel } from "../src/platform/levels";
import { TOTAL_LEVELS } from "../src/levels/packs";
import {
  GLOWTRAIL_TIME_SCALE,
  glowtrailClock,
  glowtrailTier,
  glowtrailTierLabel,
  glowtrailTimeLeftMs,
  glowtrailTimeLimitMs,
  glowtrailTimed,
} from "../src/games/glowtrail/levelRules";

describe("glowtrail level rules", () => {
  it("keeps 100+ levels", () => {
    expect(TOTAL_LEVELS).toBeGreaterThanOrEqual(100);
  });

  it("bands every level into the shared tier ladder in order", () => {
    let prev = -1;
    for (let level = 1; level <= TOTAL_LEVELS; level += 1) {
      const index = TIERS.indexOf(glowtrailTier(level));
      expect(index).toBeGreaterThanOrEqual(prev);
      prev = index;
    }
    expect(tierForLevel(TOTAL_LEVELS, TOTAL_LEVELS)).toBe("mind");
  });

  it("labels tiers for the extremes", () => {
    expect(glowtrailTierLabel(1)).toBe("EASY");
    expect(glowtrailTierLabel(TOTAL_LEVELS)).toBe("MIND BLOW");
  });

  it("leaves easy and normal untimed", () => {
    for (let level = 1; level <= 36; level += 1) {
      expect(glowtrailTimed(level)).toBe(false);
      expect(glowtrailTimeLimitMs(level)).toBe(0);
    }
  });

  it("times only every fifth medium level", () => {
    for (let level = 37; level <= 54; level += 1) {
      expect(glowtrailTimed(level)).toBe(level % 5 === 0);
    }
  });

  it("times hard tiers and above by default", () => {
    for (let level = 55; level <= TOTAL_LEVELS; level += 1) {
      expect(glowtrailTimed(level)).toBe(true);
      expect(glowtrailTimeLimitMs(level)).toBeGreaterThan(0);
    }
  });

  it("scales and tightens limits within a tier", () => {
    expect(glowtrailTimeLimitMs(55)).toBe(130000 * GLOWTRAIL_TIME_SCALE);
    expect(glowtrailTimeLimitMs(56)).toBeLessThan(glowtrailTimeLimitMs(55));
    expect(glowtrailTimeLimitMs(72)).toBeGreaterThanOrEqual((130000 - 20000) * GLOWTRAIL_TIME_SCALE);
  });

  it("computes time left and clamps at zero", () => {
    expect(glowtrailTimeLeftMs(1000, 250)).toBe(750);
    expect(glowtrailTimeLeftMs(1000, 4000)).toBe(0);
    expect(glowtrailTimeLeftMs(0, 500)).toBe(0);
  });

  it("formats a clock", () => {
    expect(glowtrailClock(0)).toBe("0:00");
    expect(glowtrailClock(65000)).toBe("1:05");
    expect(glowtrailClock(-100)).toBe("0:00");
  });
});
