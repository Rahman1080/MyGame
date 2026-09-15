import { describe, expect, it } from "vitest";
import { isExpired, timeLimitMs } from "../src/platform/levels";
import { createState, isSolved, isValidState, pour, type PrismState } from "../src/games/prism/logic";
import { hint, solve } from "../src/games/prism/solver";
import {
  PRISM_CAPACITY,
  PRISM_LEVELS,
  PRISM_TIME_SCALE,
  colorsForLevel,
  dailyPuzzle,
  emptyForLevel,
  levelPuzzle,
  levelTier,
  levelTimeLimitMs,
  levelTimed,
  puzzleById,
} from "../src/games/prism/generate";
import {
  prismBumpAttempt,
  prismIsLevelSolved,
  prismIsLevelUnlocked,
  prismLevelId,
  prismLevelNumber,
  prismNextLevel,
  prismRecordWin,
} from "../src/games/prism/progress";
import { sanitizeV2, type PrismSave } from "../src/save/schema";
import { tierRanges } from "../src/platform/levels";

function applySolution(s: PrismState, moves: { from: number; to: number }[]): boolean {
  for (const m of moves) {
    const before = s.moves.length;
    pour(s, m.from, m.to);
    if (s.moves.length !== before + 1) return false;
  }
  return isSolved(s);
}

const empty: PrismSave = { solved: [], bestMoves: {}, levels: {} };

describe("prism level ladder", () => {
  it("ships at least 100 levels", () => {
    expect(PRISM_LEVELS).toBeGreaterThanOrEqual(100);
  });

  it("bands levels across the shared tiers", () => {
    expect(levelTier(1)).toBe("easy");
    expect(levelTier(15)).toBe("easy");
    expect(levelTier(16)).toBe("normal");
    expect(levelTier(105)).toBe("mind");
    expect(tierRanges(PRISM_LEVELS)).toHaveLength(7);
  });

  it("scales colours and empties monotonically", () => {
    let prevColors = 0;
    let prevEmpty = 99;
    for (let level = 1; level <= PRISM_LEVELS; level += 1) {
      expect(colorsForLevel(level)).toBeGreaterThanOrEqual(prevColors);
      expect(emptyForLevel(level)).toBeLessThanOrEqual(prevEmpty);
      prevColors = colorsForLevel(level);
      prevEmpty = emptyForLevel(level);
    }
    expect(colorsForLevel(1)).toBe(3);
    expect(colorsForLevel(PRISM_LEVELS)).toBe(6);
    expect(emptyForLevel(1)).toBe(3);
  });

  it("clamps out of range level numbers", () => {
    expect(colorsForLevel(0)).toBe(colorsForLevel(1));
    expect(colorsForLevel(999)).toBe(colorsForLevel(PRISM_LEVELS));
    expect(prismLevelId(0)).toBe("prism-1");
    expect(prismLevelId(999)).toBe(`prism-${PRISM_LEVELS}`);
    expect(prismLevelNumber("prism-3")).toBe(3);
    expect(prismLevelNumber("prism-999")).toBe(0);
    expect(prismLevelNumber("daily")).toBe(0);
  });
});

describe("prism level generation", () => {
  it("is deterministic and cached", () => {
    const a = levelPuzzle(20);
    const b = levelPuzzle(20);
    expect(a).toBe(b);
    expect(a.tubes).toEqual(b.tubes);
    expect(a.solution.length).toBeGreaterThan(0);
  });

  it("solver-verifies a representative level from every tier", () => {
    const levels = [1, 8, 23, 38, 53, 68, 83, 98, PRISM_LEVELS];
    for (const level of levels) {
      const p = levelPuzzle(level);
      const s = createState(p.seed, p.tubes, p.colors, p.capacity);
      expect(isValidState(s)).toBe(true);
      expect(isSolved(s)).toBe(false);
      expect(p.colors).toBe(colorsForLevel(level));
      expect(p.capacity).toBe(PRISM_CAPACITY);
      expect(applySolution(s, p.solution)).toBe(true);
    }
  });

  it("resolves numbered puzzles and rejects beyond the ladder", () => {
    expect(puzzleById("prism-1", "2026-09-15")?.id).toBe("prism-1");
    expect(puzzleById(`prism-${PRISM_LEVELS}`, "2026-09-15")?.id).toBe(`prism-${PRISM_LEVELS}`);
    expect(puzzleById(`prism-${PRISM_LEVELS + 1}`, "2026-09-15")).toBeNull();
    expect(puzzleById("prism-0", "2026-09-15")).toBeNull();
  });

  it("keeps the daily puzzle stable and separate", () => {
    expect(dailyPuzzle("2026-09-15")).toBe(dailyPuzzle("2026-09-15"));
    expect(dailyPuzzle("2026-09-15").id).not.toBe(levelPuzzle(1).id);
  });
});

describe("prism hints", () => {
  it("offers a legal move that keeps the board solvable", () => {
    const p = levelPuzzle(7);
    const s = createState(p.seed, p.tubes, p.colors, p.capacity);
    let hints = 0;
    for (let i = 0; i < 6 && !isSolved(s); i += 1) {
      const h = hint(s);
      expect(h.kind).toBe("move");
      if (h.kind !== "move") break;
      const before = s.moves.length;
      pour(s, h.move.from, h.move.to);
      expect(s.moves.length).toBe(before + 1);
      hints += 1;
      expect(isValidState(s)).toBe(true);
      expect(solve(s).solved).toBe(true);
    }
    expect(hints).toBeGreaterThan(0);
  });

  it("is unlimited", () => {
    const p = levelPuzzle(2);
    const s = createState(p.seed, p.tubes, p.colors, p.capacity);
    for (let i = 0; i < 5; i += 1) {
      const h = hint(s);
      if (h.kind !== "move") break;
      pour(s, h.move.from, h.move.to);
    }
    expect(s.moves.length).toBeGreaterThan(0);
  });
});

describe("prism timers", () => {
  it("leaves early tiers untimed", () => {
    expect(levelTimed(1)).toBe(false);
    expect(levelTimeLimitMs(1)).toBe(0);
    expect(levelTimeLimitMs(20)).toBe(0);
  });

  it("scales the shared limit by the game factor on timed levels", () => {
    expect(levelTimed(50)).toBe(true);
    expect(levelTimeLimitMs(50)).toBe(timeLimitMs(50, PRISM_LEVELS) * PRISM_TIME_SCALE);
    expect(levelTimeLimitMs(105)).toBeGreaterThan(0);
  });

  it("expires only when the clock runs past the limit", () => {
    const limit = levelTimeLimitMs(60);
    expect(isExpired(limit, limit - 1)).toBe(false);
    expect(isExpired(limit, limit)).toBe(true);
    expect(isExpired(0, 999999)).toBe(false);
  });
});

describe("prism level progress", () => {
  it("unlocks sequentially and keeps solved levels open", () => {
    expect(prismIsLevelUnlocked(empty, 1)).toBe(true);
    expect(prismIsLevelUnlocked(empty, 2)).toBe(false);
    const after = prismRecordWin(empty, 1, { moves: 10, stars: 3, timeMs: 5000, hints: 0 });
    expect(prismIsLevelSolved(after, 1)).toBe(true);
    expect(prismIsLevelUnlocked(after, 2)).toBe(true);
    expect(prismIsLevelUnlocked(after, 3)).toBe(false);
    expect(prismNextLevel(after, 1)).toBe(2);
    expect(prismNextLevel(after, 2)).toBe(2);
  });

  it("counts attempts without touching other records", () => {
    const once = prismBumpAttempt(empty, 4);
    const twice = prismBumpAttempt(once, 4);
    expect(twice.levels["4"]?.attempts).toBe(2);
    expect(twice.levels["5"]).toBeUndefined();
  });

  it("keeps the best move count and fastest time", () => {
    const first = prismRecordWin(empty, 3, { moves: 20, stars: 1, timeMs: 9000, hints: 2 });
    const second = prismRecordWin(first, 3, { moves: 12, stars: 3, timeMs: 6000, hints: 1 });
    const record = second.levels["3"];
    expect(record?.won).toBe(true);
    expect(record?.best).toBe(12);
    expect(record?.stars).toBe(3);
    expect(record?.bestTimeMs).toBe(6000);
    expect(record?.hints).toBe(3);
    expect(second.solved.filter((id) => id === "prism-3")).toHaveLength(1);
    expect(second.bestMoves["prism-3"]).toBe(12);
  });

  it("records a win with no time when the level is untimed", () => {
    const after = prismRecordWin(empty, 1, { moves: 8, stars: 3, timeMs: 0, hints: 0 });
    expect(after.levels["1"]?.bestTimeMs).toBeNull();
  });
});

describe("prism save migration", () => {
  it("adds an empty levels map to legacy v2 saves", () => {
    const save: PrismSave = sanitizeV2({
      version: 2,
      games: { prism: { solved: ["prism-1"], bestMoves: { "prism-1": 12 } } },
    }).games.prism;
    expect(save.solved).toEqual(["prism-1"]);
    expect(save.levels).toEqual({});
  });

  it("sanitizes stored level records", () => {
    const save: PrismSave = sanitizeV2({
      version: 2,
      games: {
        prism: {
          solved: [],
          bestMoves: {},
          levels: { "2": { won: true, stars: 9, best: -3, bestTimeMs: -1, hints: "x", attempts: 3 } },
        },
      },
    }).games.prism;
    expect(save.levels["2"]).toEqual({
      won: true,
      stars: 3,
      best: 0,
      bestTimeMs: null,
      hints: 0,
      attempts: 3,
    });
  });
});
