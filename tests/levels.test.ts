import { describe, expect, it } from "vitest";
import {
  TIERS,
  TIER_COUNT,
  TIER_LABELS,
  formatClock,
  hintGate,
  isExpired,
  isTimedLevel,
  tierBand,
  tierForLevel,
  tierRanges,
  timeLeftMs,
  timeLimitMs,
} from "../src/platform/levels";

describe("difficulty tiers", () => {
  it("defines seven ordered tiers with labels", () => {
    expect(TIER_COUNT).toBe(7);
    expect(TIERS).toEqual(["easy", "normal", "medium", "hard", "super", "extra", "mind"]);
    for (const tier of TIERS) expect(TIER_LABELS[tier].length).toBeGreaterThan(0);
  });

  it("bands levels in order and is total", () => {
    expect(tierBand(105)).toBe(15);
    expect(tierForLevel(1, 105)).toBe("easy");
    expect(tierForLevel(15, 105)).toBe("easy");
    expect(tierForLevel(16, 105)).toBe("normal");
    expect(tierForLevel(30, 105)).toBe("normal");
    expect(tierForLevel(31, 105)).toBe("medium");
    expect(tierForLevel(46, 105)).toBe("hard");
    expect(tierForLevel(61, 105)).toBe("super");
    expect(tierForLevel(76, 105)).toBe("extra");
    expect(tierForLevel(105, 105)).toBe("mind");
  });

  it("clamps out of range levels", () => {
    expect(tierForLevel(0, 105)).toBe("easy");
    expect(tierForLevel(-9, 105)).toBe("easy");
    expect(tierForLevel(999, 105)).toBe("mind");
  });

  it("produces contiguous, complete ranges", () => {
    const ranges = tierRanges(105);
    expect(ranges).toHaveLength(7);
    expect(ranges[0]).toEqual({ tier: "easy", from: 1, to: 15 });
    expect(ranges[6]).toEqual({ tier: "mind", from: 91, to: 105 });
    for (let i = 1; i < ranges.length; i += 1) {
      expect(ranges[i]!.from).toBe(ranges[i - 1]!.to + 1);
    }
    expect(ranges[ranges.length - 1]!.to).toBe(105);
  });
});

describe("timer policy", () => {
  it("keeps early tiers untimed", () => {
    expect(isTimedLevel(1, 105)).toBe(false);
    expect(isTimedLevel(20, 105)).toBe(false);
    expect(timeLimitMs(1, 105)).toBe(0);
    expect(timeLimitMs(20, 105)).toBe(0);
  });

  it("times only the RUSH levels in the medium tier", () => {
    expect(isTimedLevel(35, 105)).toBe(true);
    expect(isTimedLevel(33, 105)).toBe(false);
  });

  it("times every level from hard up", () => {
    expect(isTimedLevel(46, 105)).toBe(true);
    expect(isTimedLevel(105, 105)).toBe(true);
    expect(timeLimitMs(105, 105)).toBeGreaterThan(0);
  });

  it("gives later levels in a tier no more time", () => {
    expect(timeLimitMs(46, 105)).toBeGreaterThanOrEqual(timeLimitMs(60, 105));
  });

  it("computes remaining time and expiry", () => {
    expect(timeLeftMs(1000, 400)).toBe(600);
    expect(timeLeftMs(1000, 2000)).toBe(0);
    expect(timeLeftMs(0, 2000)).toBe(0);
    expect(isExpired(1000, 999)).toBe(false);
    expect(isExpired(1000, 1000)).toBe(true);
    expect(isExpired(0, 5000)).toBe(false);
  });

  it("formats a clock", () => {
    expect(formatClock(70000)).toBe("1:10");
    expect(formatClock(9000)).toBe("0:09");
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(-50)).toBe("0:00");
  });
});

describe("hint gate", () => {
  it("grants freely while ads are disabled", () => {
    expect(hintGate(false, false)).toBe(true);
    expect(hintGate(false, true)).toBe(true);
  });

  it("requires a completed ad once ads are enabled", () => {
    expect(hintGate(true, true)).toBe(true);
    expect(hintGate(true, false)).toBe(false);
  });
});
