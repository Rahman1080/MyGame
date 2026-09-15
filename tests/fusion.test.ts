import { describe, expect, it } from "vitest";
import { hashString, mulberry32 } from "../src/gen/seededRng";
import { dailySeed } from "../src/platform/dailySeed";
import {
  BIN_HEIGHT,
  COLS,
  GRACE_TICKS,
  MAX_SPAWN_TIER,
  OVERFLOW_Y,
  TIER_COUNT,
  canMerge,
  columnOrbs,
  createState,
  drop,
  isOver,
  mergeResult,
  orbRadius,
  scoreForMerge,
  settle,
  spawnQueue,
  starsForScore,
  step,
  type FusionState,
} from "../src/games/fusion/logic";

function key(state: FusionState): string {
  return JSON.stringify(state);
}

function play(state: FusionState, cols: number[]): void {
  for (const col of cols) {
    drop(state, col);
    settle(state);
  }
}

function alt(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i % 2);
}

function assertColumnInvariants(state: FusionState): void {
  for (let col = 0; col < COLS; col += 1) {
    const stack = columnOrbs(state, col);
    for (let i = 0; i < stack.length; i += 1) {
      const orb = stack[i]!;
      expect(Number.isInteger(orb.y)).toBe(true);
      expect(orb.col).toBe(col);
      if (i === 0) {
        expect(orb.y).toBe(BIN_HEIGHT - orbRadius(orb.tier));
      } else {
        const below = stack[i - 1]!;
        expect(orb.y).toBe(below.y - orbRadius(below.tier) - orbRadius(orb.tier));
        expect(orb.tier).not.toBe(below.tier);
      }
    }
  }
}

describe("fusion rules", () => {
  it("merges only equal tiers", () => {
    expect(canMerge(2, 2)).toBe(true);
    expect(canMerge(2, 3)).toBe(false);
  });

  it("merge result increments tier and refuses unequal input", () => {
    expect(mergeResult(2, 2)).toBe(3);
    expect(mergeResult(8, 8)).toBe(9);
    expect(mergeResult(9, 9)).toBe(9);
    expect(mergeResult(2, 3)).toBe(-1);
  });

  it("higher tiers score more and combos multiply", () => {
    expect(scoreForMerge(3, 1)).toBeGreaterThan(scoreForMerge(2, 1));
    expect(scoreForMerge(3, 2)).toBe(scoreForMerge(3, 1) * 2);
    expect(scoreForMerge(0, 0)).toBe(10);
  });

  it("orb radius grows with tier", () => {
    for (let t = 1; t < TIER_COUNT; t += 1) {
      expect(orbRadius(t)).toBeGreaterThan(orbRadius(t - 1));
    }
  });
});

describe("fusion spawn queue", () => {
  it("is deterministic for a seed and differs across seeds", () => {
    expect(spawnQueue("2026-09-15")).toEqual(spawnQueue("2026-09-15"));
    expect(spawnQueue("2026-09-15")).not.toEqual(spawnQueue("2026-09-16"));
  });

  it("only spawns droppable low tiers", () => {
    const q = spawnQueue("range", 400);
    expect(q.every((t) => t >= 0 && t <= MAX_SPAWN_TIER)).toBe(true);
    expect(new Set(q).size).toBeGreaterThan(1);
  });
});

describe("fusion initial state", () => {
  it("is identical for the same seed", () => {
    expect(key(createState("same"))).toBe(key(createState("same")));
    expect(key(createState("a"))).not.toBe(key(createState("b")));
  });

  it("primes the dropper and preview from an explicit queue", () => {
    const state = createState("q", [3, 4, 0, 1]);
    expect(state.nextTier).toBe(3);
    expect(state.previewTier).toBe(4);
    expect(state.falling).toBeNull();
    expect(state.status).toBe("playing");
    expect(state.columns.every((c) => c.length === 0)).toBe(true);
  });
});

describe("fusion dropping", () => {
  it("rejects illegal drops", () => {
    const state = createState("d", [0, 0, 0]);
    expect(drop(state, -1)).toBe(false);
    expect(drop(state, COLS)).toBe(false);
    expect(drop(state, 1.5)).toBe(false);
    expect(drop(state, 0)).toBe(true);
    expect(drop(state, 1)).toBe(false);
    state.status = "over";
    state.falling = null;
    expect(drop(state, 0)).toBe(false);
  });

  it("lands the orb resting on the floor with no overlap", () => {
    const state = createState("land", [1, 1, 1, 2]);
    drop(state, 0);
    settle(state);
    assertColumnInvariants(state);
    expect(columnOrbs(state, 0)[0]!.y).toBe(BIN_HEIGHT - orbRadius(1));
  });

  it("merges two equal orbs that touch", () => {
    const state = createState("merge", [2, 2, 0]);
    play(state, [0, 0]);
    const stack = columnOrbs(state, 0);
    expect(stack).toHaveLength(1);
    expect(stack[0]!.tier).toBe(3);
    expect(state.merges).toBe(1);
    expect(state.maxTier).toBe(3);
    expect(state.score).toBe(scoreForMerge(3, 1));
    assertColumnInvariants(state);
  });

  it("chains merges caused by a single drop", () => {
    const state = createState("chain", [2, 2, 2, 2]);
    play(state, [0, 0, 0, 0]);
    const stack = columnOrbs(state, 0);
    expect(stack).toHaveLength(1);
    expect(stack[0]!.tier).toBe(4);
    expect(state.maxTier).toBe(4);
    expect(state.merges).toBe(3);
    expect(state.score).toBe(40 + 40 + 100);
    assertColumnInvariants(state);
  });

  it("keeps distinct tiers from merging", () => {
    const state = createState("distinct", [0, 1, 0, 1]);
    play(state, [0, 0, 0, 0]);
    expect(columnOrbs(state, 0).map((o) => o.tier)).toEqual([0, 1, 0, 1]);
    expect(state.merges).toBe(0);
  });

  it("clears two max-tier orbs instead of overflowing the tier range", () => {
    const max = TIER_COUNT - 1;
    const state = createState("max", [max, max, 0]);
    play(state, [0, 0]);
    expect(columnOrbs(state, 0)).toHaveLength(0);
    expect(state.merges).toBe(1);
    expect(state.maxTier).toBe(max);
    expect(state.score).toBe(scoreForMerge(max, 1));
  });
});

describe("fusion overflow", () => {
  it("ends the run after a resting orb sits above the line past the grace period", () => {
    const state = createState("overflow", alt(96));
    for (let i = 0; i < 80 && !isOver(state); i += 1) {
      drop(state, 0);
      settle(state);
      step(state, GRACE_TICKS + 1);
    }
    expect(isOver(state)).toBe(true);
    const top = columnOrbs(state, 0).at(-1)!;
    expect(top.y - orbRadius(top.tier)).toBeLessThan(OVERFLOW_Y);
  });

  it("does not overflow while below the line", () => {
    const state = createState("safe", alt(96));
    play(state, [0, 0, 0]);
    step(state, GRACE_TICKS * 3);
    expect(isOver(state)).toBe(false);
    expect(state.overflowTicks).toBe(0);
  });
});

describe("fusion determinism", () => {
  it("same seed and same drops produce identical results", () => {
    const a = createState("run-seed");
    const b = createState("run-seed");
    const cols = [0, 1, 2, 3, 4, 5, 2, 2, 1, 4, 0, 5, 3, 3, 2, 2];
    play(a, cols);
    play(b, cols);
    expect(key(b)).toBe(key(a));
  });

  it("is independent of how ticks are batched", () => {
    const a = createState("batch");
    const b = createState("batch");
    drop(a, 3);
    drop(b, 3);
    step(a, 40);
    for (let i = 0; i < 40; i += 1) step(b, 1);
    expect(key(b)).toBe(key(a));
  });

  it("step(state, 0) is a no-op", () => {
    const a = createState("noop", [3, 3, 3]);
    const before = key(a);
    step(a, 0);
    expect(key(a)).toBe(before);
  });

  it("daily seed is stable per date and distinct per game", () => {
    expect(dailySeed("2026-09-15", "fusion")).toBe(dailySeed("2026-09-15", "fusion"));
    expect(key(createState(dailySeed("2026-09-15", "fusion")))).toBe(
      key(createState(dailySeed("2026-09-15", "fusion"))),
    );
    expect(key(createState(dailySeed("2026-09-15", "fusion")))).not.toBe(
      key(createState(dailySeed("2026-09-16", "fusion"))),
    );
  });
});

describe("fusion daily determinism", () => {
  it("replaying the same drop sequence on the same seed yields the identical result", () => {
    const seed = dailySeed("2026-09-15", "fusion");
    const moves = [2, 2, 3, 1, 4, 0, 5, 2, 2, 3, 3, 1, 0, 4, 5, 5, 2, 1, 3, 0];
    const a = createState(seed);
    const b = createState(seed);
    for (const col of moves) {
      drop(a, col);
      settle(a);
      drop(b, col);
      settle(b);
    }
    expect(a.score).toBe(b.score);
    expect(a.merges).toBe(b.merges);
    expect(a.status).toBe(b.status);
    expect(a.maxTier).toBe(b.maxTier);
    expect(key(a)).toBe(key(b));
  });

  it("a different date can produce a different queue", () => {
    const queues = new Set<string>();
    for (const date of ["2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18"]) {
      const state = createState(dailySeed(date, "fusion"));
      queues.add(state.queue.slice(0, 12).join(","));
    }
    expect(queues.size).toBeGreaterThan(1);
  });
});

describe("fusion star thresholds", () => {
  it("maps score to 0-3 stars at the documented boundaries", () => {
    expect(starsForScore(0)).toBe(0);
    expect(starsForScore(499)).toBe(0);
    expect(starsForScore(500)).toBe(1);
    expect(starsForScore(1499)).toBe(1);
    expect(starsForScore(1500)).toBe(2);
    expect(starsForScore(3499)).toBe(2);
    expect(starsForScore(3500)).toBe(3);
    expect(starsForScore(999999)).toBe(3);
  });

  it("is monotonic and guards negative or fractional input", () => {
    let prev = -1;
    for (let score = -50; score <= 4000; score += 7.5) {
      const stars = starsForScore(score);
      expect(stars).toBeGreaterThanOrEqual(prev);
      expect(stars).toBeGreaterThanOrEqual(0);
      expect(stars).toBeLessThanOrEqual(3);
      prev = stars;
    }
  });
});

describe("fusion never reaches an invalid state", () => {
  it("keeps every column tangent, in-bounds and merge-free across many runs", () => {
    for (let seed = 0; seed < 24; seed += 1) {
      const rng = mulberry32(hashString(`stress-${seed}`));
      const state = createState(`stress-${seed}`);
      for (let move = 0; move < 160 && !isOver(state); move += 1) {
        drop(state, Math.floor(rng() * COLS));
        settle(state);
        assertColumnInvariants(state);
      }
    }
  });
});
