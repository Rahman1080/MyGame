import { describe, expect, it } from "vitest";
import { dailySeed } from "../src/platform/dailySeed";
import { defaultSaveV2, sanitizeV2, SAVE_VERSION_V2, type BlocksSave } from "../src/save/schema";
import { SHAPES, deal, pieceAt, shapeById } from "../src/games/blocks/generate";
import {
  BLOCKS_GRID,
  BLOCKS_SCORE,
  applyPlacement,
  canPlace,
  clearCells,
  colorName,
  comboBonus,
  createBoard,
  createDailyState,
  createEndlessState,
  createState,
  dailyStreakOn,
  detectLines,
  emptyBlocksSave,
  finalResult,
  findFullCols,
  findFullRows,
  findPlacements,
  hasPlacement,
  idx,
  isDailyDone,
  isDead,
  lineScore,
  nextCombo,
  placePiece,
  recordDailyRun,
  recordEndlessRun,
  remainingPieces,
  scorePlacement,
  shapeHeight,
  shapeWidth,
  starsForScore,
  type BlocksResult,
  type BlocksState,
  type Board,
} from "../src/games/blocks/logic";

function shape(id: string) {
  const s = shapeById(id);
  if (!s) throw new Error(`missing shape ${id}`);
  return s;
}

function board(size: number, filled: Array<[number, number, number]> = []): Board {
  const b = createBoard(size);
  for (const [r, c, color] of filled) b[idx(size, r, c)] = color;
  return b;
}

function stateWith(over: Partial<BlocksState>): BlocksState {
  const base = createState({ seed: "test-seed", mode: "endless", size: over.size ?? BLOCKS_GRID });
  return { ...base, ...over };
}

function filledResult(score: number, lines: number, mode: BlocksResult["mode"] = "endless", date = ""): BlocksResult {
  return { mode, date, score, lines, bestCombo: 2, moves: 10, stars: starsForScore(score) };
}

describe("blocks board creation", () => {
  it("creates an empty square board", () => {
    const b = createBoard(8);
    expect(b).toHaveLength(64);
    expect(b.every((c) => c === 0)).toBe(true);
    expect(createBoard(9)).toHaveLength(81);
  });

  it("maps coordinates and reads out-of-bounds safely", () => {
    expect(idx(8, 3, 5)).toBe(29);
    expect(canPlace(createBoard(4), 4, shape("dot"), 4, 0)).toBe(false);
    expect(hasPlacement(createBoard(4), 4, shape("square3"))).toBe(true);
  });
});

describe("blocks piece library", () => {
  it("has unique ids and valid metadata", () => {
    const ids = SHAPES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SHAPES) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.color).toBeGreaterThanOrEqual(1);
      expect(s.color).toBeLessThanOrEqual(5);
      expect(s.cells.length).toBeGreaterThan(0);
    }
  });

  it("normalises every shape to a top-left anchored bounding box", () => {
    for (const s of SHAPES) {
      const minR = Math.min(...s.cells.map(([r]) => r));
      const minC = Math.min(...s.cells.map(([, c]) => c));
      expect(minR).toBe(0);
      expect(minC).toBe(0);
      expect(shapeHeight(s)).toBe(Math.max(...s.cells.map(([r]) => r)) + 1);
      expect(shapeWidth(s)).toBe(Math.max(...s.cells.map(([, c]) => c)) + 1);
    }
  });

  it("covers the required curated varieties", () => {
    for (const id of ["dot", "line2h", "line2v", "line3h", "line3v", "L4a", "line4h", "square2", "T4", "corner3a", "S4", "Z4"]) {
      expect(shapeById(id)).toBeDefined();
    }
    expect(shape("dot").cells).toHaveLength(1);
    expect(shape("square2").cells).toHaveLength(4);
    expect(shape("square3").cells).toHaveLength(9);
  });
});

describe("blocks placement legality", () => {
  it("accepts a legal placement", () => {
    const b = createBoard(8);
    expect(canPlace(b, 8, shape("L4a"), 0, 0)).toBe(true);
    expect(canPlace(b, 8, shape("T4"), 5, 5)).toBe(true);
  });

  it("rejects overlapping occupied cells", () => {
    const b = board(8, [[0, 0, 1], [0, 1, 1]]);
    expect(canPlace(b, 8, shape("line2h"), 0, 0)).toBe(false);
    expect(canPlace(b, 8, shape("line2h"), 0, 2)).toBe(true);
  });

  it("rejects out-of-bounds placements", () => {
    const b = createBoard(8);
    expect(canPlace(b, 8, shape("line3h"), 0, 6)).toBe(false);
    expect(canPlace(b, 8, shape("line3v"), 6, 0)).toBe(false);
    expect(canPlace(b, 8, shape("square2"), 7, 7)).toBe(false);
  });

  it("lists every legal placement position", () => {
    const b = createBoard(3);
    const positions = findPlacements(b, 3, shape("dot"));
    expect(positions).toHaveLength(9);
    expect(findPlacements(b, 3, shape("square2"))).toHaveLength(4);
    expect(findPlacements(b, 3, shape("line3h"))).toHaveLength(3);
  });

  it("updates the board immutably on placement", () => {
    const b = createBoard(4);
    const placed = applyPlacement(b, 4, shape("line2h"), 1, 1, 3);
    expect(placed).not.toBeNull();
    const next = placed!.board;
    expect(b.every((c) => c === 0)).toBe(true);
    expect(next[idx(4, 1, 1)]).toBe(3);
    expect(next[idx(4, 1, 2)]).toBe(3);
    expect(placed!.lines).toBe(0);
  });
});

describe("blocks line detection and clearing", () => {
  it("detects a completed row", () => {
    const b = board(4, [
      [0, 0, 1],
      [0, 1, 1],
      [0, 2, 1],
    ]);
    const result = applyPlacement(b, 4, shape("dot"), 0, 3, 2);
    expect(result!.rows).toEqual([0]);
    expect(result!.cols).toEqual([]);
    expect(result!.lines).toBe(1);
    expect(result!.board.every((c) => c === 0)).toBe(true);
    expect(result!.perfect).toBe(true);
  });

  it("detects a completed column", () => {
    const b = board(4, [
      [0, 2, 1],
      [1, 2, 1],
      [2, 2, 1],
    ]);
    const result = applyPlacement(b, 4, shape("dot"), 3, 2, 2);
    expect(result!.cols).toEqual([2]);
    expect(result!.rows).toEqual([]);
    expect(findFullCols(b, 4)).toEqual([]);
    expect(result!.board.filter((c) => c !== 0)).toHaveLength(0);
  });

  it("clears simultaneous rows and columns without double counting", () => {
    const size = 4;
    const cells: Array<[number, number, number]> = [];
    for (let c = 0; c < size - 1; c += 1) cells.push([0, c, 1]);
    for (let r = 1; r < size; r += 1) cells.push([r, size - 1, 1]);
    const b = board(size, cells);
    expect(findFullRows(b, size)).toEqual([]);
    expect(findFullCols(b, size)).toEqual([]);
    const result = applyPlacement(b, size, shape("dot"), 0, size - 1, 2);
    expect(result!.rows).toEqual([0]);
    expect(result!.cols).toEqual([size - 1]);
    expect(result!.lines).toBe(2);
    expect(result!.cells).toHaveLength(size * 2 - 1);
    expect(result!.board.every((c) => c === 0)).toBe(true);
  });

  it("detects multiple rows at once", () => {
    const size = 4;
    const cells: Array<[number, number, number]> = [];
    for (const r of [0, 1]) {
      for (let c = 0; c < size - 1; c += 1) cells.push([r, c, 1]);
    }
    const b = board(size, cells);
    const placed = applyPlacement(b, size, shape("line2v"), 0, size - 1, 5);
    expect(placed!.rows).toEqual([0, 1]);
    expect(placed!.lines).toBe(2);
  });

  it("clears only the requested cells", () => {
    const b = board(3, [[0, 0, 1], [1, 1, 2]]);
    const cleared = clearCells(b, [idx(3, 0, 0)]);
    expect(cleared[idx(3, 0, 0)]).toBe(0);
    expect(cleared[idx(3, 1, 1)]).toBe(2);
  });

  it("reports no lines on a partial board", () => {
    const detected = detectLines(board(8, [[0, 0, 1]]), 8);
    expect(detected.lines).toBe(0);
    expect(detected.cells).toHaveLength(0);
  });
});

describe("blocks scoring", () => {
  it("scores base cells and single lines", () => {
    expect(lineScore(0)).toBe(0);
    expect(lineScore(1)).toBe(10);
    expect(lineScore(2)).toBe(40);
    expect(lineScore(3)).toBe(90);
    const scored = scorePlacement({ cells: 2, lines: 1, rows: 1, cols: 0, combo: 0, perfect: false });
    expect(scored.points).toBe(2 * BLOCKS_SCORE.perCell + 10);
    expect(scored.combo).toBe(1);
    expect(scored.comboBonus).toBe(0);
  });

  it("gives increasing bonuses for multi-line clears", () => {
    const one = scorePlacement({ cells: 1, lines: 1, rows: 1, cols: 0, combo: 0, perfect: false }).points;
    const two = scorePlacement({ cells: 1, lines: 2, rows: 2, cols: 0, combo: 0, perfect: false }).points;
    const three = scorePlacement({ cells: 1, lines: 3, rows: 3, cols: 0, combo: 0, perfect: false }).points;
    expect(two).toBeGreaterThan(one * 2);
    expect(three).toBeGreaterThan(two);
  });

  it("adds a simultaneous row plus column bonus", () => {
    const both = scorePlacement({ cells: 1, lines: 2, rows: 1, cols: 1, combo: 0, perfect: false });
    expect(both.simultaneous).toBe(true);
    expect(both.comboBonus).toBe(BLOCKS_SCORE.simultaneousBonus);
  });

  it("tracks consecutive combo bonuses and resets on a miss", () => {
    expect(nextCombo(0, 1)).toBe(1);
    expect(nextCombo(2, 1)).toBe(3);
    expect(nextCombo(4, 0)).toBe(0);
    expect(comboBonus(1)).toBe(0);
    expect(comboBonus(2)).toBe(BLOCKS_SCORE.comboStep);
    expect(comboBonus(50)).toBe(BLOCKS_SCORE.comboMax);
  });

  it("awards a perfect clear bonus", () => {
    const perfect = scorePlacement({ cells: 1, lines: 2, rows: 1, cols: 1, combo: 0, perfect: true });
    const normal = scorePlacement({ cells: 1, lines: 2, rows: 1, cols: 1, combo: 0, perfect: false });
    expect(perfect.points - normal.points).toBe(BLOCKS_SCORE.perfectBonus);
  });

  it("maps scores to stars", () => {
    expect(starsForScore(0)).toBe(0);
    expect(starsForScore(199)).toBe(0);
    expect(starsForScore(200)).toBe(1);
    expect(starsForScore(699)).toBe(1);
    expect(starsForScore(700)).toBe(2);
    expect(starsForScore(1499)).toBe(2);
    expect(starsForScore(1500)).toBe(3);
    expect(starsForScore(999999)).toBe(3);
  });

  it("accumulates score, lines and combo across placements", () => {
    let s = stateWith({ size: 4, board: createBoard(4), pieces: [shape("dot"), shape("dot"), shape("dot")] });
    s = placePiece(s, 0, 0, 0).state;
    s = placePiece(s, 1, 0, 1).state;
    s = placePiece(s, 2, 0, 2).state;
    expect(s.moves).toBe(3);
    expect(s.score).toBeGreaterThan(0);
    expect(s.lines).toBe(0);
  });
});

describe("blocks deterministic generation", () => {
  it("returns the same piece for the same seed and index", () => {
    expect(pieceAt("seed-a", 0).id).toBe(pieceAt("seed-a", 0).id);
    expect(pieceAt("seed-a", 7).id).toBe(pieceAt("seed-a", 7).id);
  });

  it("deals identical sets for identical input", () => {
    const b = createBoard(8);
    const a = deal("seed-a", 0, b, 8).map((p) => p.id);
    const c = deal("seed-a", 0, b, 8).map((p) => p.id);
    expect(c).toEqual(a);
    expect(a).toHaveLength(3);
  });

  it("produces different sequences for different seeds", () => {
    const stream = (seed: string) => Array.from({ length: 12 }, (_, i) => pieceAt(seed, i).id).join(",");
    expect(stream("alpha")).not.toBe(stream("beta"));
  });

  it("keeps at least one small or medium piece on a crowded board", () => {
    const size = 8;
    const filled: Array<[number, number, number]> = [];
    for (let r = 0; r < size; r += 1) {
      for (let c = 0; c < size; c += 1) {
        if ((r * size + c) % 9 !== 0) filled.push([r, c, 1]);
      }
    }
    const crowded = board(size, filled);
    for (let batch = 0; batch < 12; batch += 1) {
      const pieces = deal("crowded-seed", batch, crowded, size);
      expect(pieces.some((p) => p.tier !== "large")).toBe(true);
    }
  });
});

describe("blocks daily determinism", () => {
  it("builds the same daily state for the same date", () => {
    const a = createDailyState("2026-09-15");
    const b = createDailyState("2026-09-15");
    expect(a.seed).toBe(dailySeed("2026-09-15", "blocks"));
    expect(a.pieces.map((p) => p?.id)).toEqual(b.pieces.map((p) => p?.id));
    expect(a.board).toEqual(b.board);
    expect(a.mode).toBe("daily");
    expect(a.date).toBe("2026-09-15");
  });

  it("produces a different challenge for a different date", () => {
    const a = createDailyState("2026-09-15");
    const b = createDailyState("2026-09-16");
    expect(a.seed).not.toBe(b.seed);
    const stream = (s: BlocksState) => s.pieces.map((p) => p?.id).join(",");
    expect(stream(a)).not.toBe(stream(b));
  });

  it("derives pieces from the shared daily seed", () => {
    const seed = dailySeed("2026-01-01", "blocks");
    expect(pieceAt(seed, 0).id).toBe(pieceAt(seed, 0).id);
    expect(createDailyState("2026-01-01").seed).toBe(seed);
  });
});

describe("blocks game over detection", () => {
  const size = 3;

  it("is not over when a remaining piece has a legal move", () => {
    const b = board(size, [
      [0, 0, 1],
      [0, 1, 1],
      [1, 0, 1],
      [1, 1, 1],
      [2, 0, 1],
      [2, 1, 1],
    ]);
    const s = stateWith({ size, board: b, pieces: [shape("dot"), shape("line2h"), shape("line2h")] });
    expect(isDead(s)).toBe(false);
    expect(hasPlacement(b, size, shape("dot"))).toBe(true);
  });

  it("is over when no remaining piece fits anywhere", () => {
    const b = board(size, [
      [0, 1, 1],
      [1, 0, 1],
      [1, 2, 1],
      [2, 1, 1],
    ]);
    const s = stateWith({ size, board: b, pieces: [shape("line2h"), shape("line3h"), shape("square2")] });
    expect(hasPlacement(b, size, shape("line2h"))).toBe(false);
    expect(isDead(s)).toBe(true);
  });

  it("ends the run through placePiece once nothing fits", () => {
    const size = 3;
    const b = board(size, [
      [0, 1, 1],
      [1, 0, 1],
      [1, 2, 1],
      [2, 1, 1],
    ]);
    const s = stateWith({ size, board: b, pieces: [shape("dot"), shape("line2h"), shape("line2v")] });
    const outcome = placePiece(s, 0, 0, 0);
    expect(outcome.illegal).toBe(false);
    expect(outcome.state.status).toBe("over");
    expect(outcome.state.pieces.some((p) => p !== null)).toBe(true);
  });

  it("keeps the run alive while a single dot can still be placed", () => {
    const size = 3;
    const b = board(size, [[1, 1, 1]]);
    const s = stateWith({ size, board: b, pieces: [shape("line3h"), shape("dot")] });
    expect(isDead(s)).toBe(false);
  });
});

describe("blocks piece queue flow", () => {
  it("deals the next deterministic set after all three pieces are placed", () => {
    const s = stateWith({ board: createBoard(8), pieces: [shape("dot"), shape("dot"), shape("dot")] });
    const first = placePiece(s, 0, 0, 0).state;
    const second = placePiece(first, 1, 7, 0).state;
    const third = placePiece(second, 2, 0, 7).state;
    expect(third.batch).toBe(2);
    expect(remainingPieces(third)).toBe(3);
    expect(third.pieces.every((p) => p !== null)).toBe(true);
    expect(third.batch).toBe(s.batch + 1);
  });

  it("refuses illegal placements without mutating state", () => {
    const s = stateWith({ size: 3, board: createBoard(3), pieces: [shape("line2h"), shape("dot"), shape("dot")] });
    const outcome = placePiece(s, 0, 0, 5);
    expect(outcome.illegal).toBe(true);
    expect(outcome.state).toBe(s);
  });

  it("reports a final result from the run", () => {
    const s = stateWith({ score: 742, lines: 9, bestCombo: 4, moves: 33, mode: "daily", date: "2026-09-15" });
    const result = finalResult(s);
    expect(result.score).toBe(742);
    expect(result.lines).toBe(9);
    expect(result.bestCombo).toBe(4);
    expect(result.mode).toBe("daily");
    expect(result.date).toBe("2026-09-15");
    expect(result.stars).toBe(starsForScore(742));
  });
});

describe("blocks save integration", () => {
  it("records endless runs and keeps the best", () => {
    let save: BlocksSave = emptyBlocksSave();
    save = recordEndlessRun(save, filledResult(300, 5));
    save = recordEndlessRun(save, filledResult(900, 12));
    save = recordEndlessRun(save, filledResult(200, 3));
    expect(save.best).toBe(900);
    expect(save.runs).toBe(3);
    expect(save.lines).toBe(20);
    expect(save.bestCombo).toBe(2);
  });

  it("records a daily run once and never duplicates rewards", () => {
    let save: BlocksSave = emptyBlocksSave();
    save = recordDailyRun(save, filledResult(500, 8, "daily", "2026-09-15"));
    const after = recordDailyRun(save, filledResult(9999, 50, "daily", "2026-09-15"));
    expect(after).toEqual(save);
    expect(after.runs).toBe(1);
    expect(after.daily["2026-09-15"]).toEqual({ score: 500, lines: 8, stars: starsForScore(500) });
    expect(isDailyDone(after, "2026-09-15")).toBe(true);
  });

  it("computes consecutive daily streaks from stored dates", () => {
    let save: BlocksSave = emptyBlocksSave();
    save = recordDailyRun(save, filledResult(300, 4, "daily", "2026-09-13"));
    save = recordDailyRun(save, filledResult(300, 4, "daily", "2026-09-14"));
    save = recordDailyRun(save, filledResult(300, 4, "daily", "2026-09-15"));
    expect(dailyStreakOn(save, "2026-09-15")).toBe(3);
    expect(save.dailyStreak).toBe(3);
    expect(save.bestDailyStreak).toBe(3);
    save = recordDailyRun(save, filledResult(300, 4, "daily", "2026-09-18"));
    expect(dailyStreakOn(save, "2026-09-18")).toBe(1);
    expect(save.bestDailyStreak).toBe(3);
  });
});

describe("blocks save schema compatibility", () => {
  it("ships a default blocks slice in a fresh v2 save", () => {
    const save = defaultSaveV2();
    expect(save.version).toBe(SAVE_VERSION_V2);
    expect(save.games.blocks).toEqual(emptyBlocksSave());
  });

  it("backfills blocks for saves written before the game existed", () => {
    const migrated = sanitizeV2({
      version: 2,
      profile: { xp: 120 },
      games: { glyph: { wins: 3 }, fusion: { best: 7 } },
    });
    expect(migrated.games.blocks).toEqual(emptyBlocksSave());
    expect(migrated.games.glyph.wins).toBe(3);
    expect(migrated.profile.xp).toBe(120);
  });

  it("sanitizes invalid blocks fields back to sane defaults", () => {
    const migrated = sanitizeV2({
      version: 2,
      games: {
        blocks: {
          best: -5,
          runs: "lots",
          lines: 12.9,
          bestCombo: Number.NaN,
          dailyStreak: 2,
          bestDailyStreak: 4,
          daily: {
            "2026-09-15": { score: 320, lines: 6, stars: 99 },
            "not-a-date": { score: 1, lines: 1, stars: 1 },
          },
        },
      },
    });
    expect(migrated.games.blocks.best).toBe(0);
    expect(migrated.games.blocks.runs).toBe(0);
    expect(migrated.games.blocks.lines).toBe(12);
    expect(migrated.games.blocks.bestCombo).toBe(0);
    expect(migrated.games.blocks.dailyStreak).toBe(2);
    expect(migrated.games.blocks.daily["2026-09-15"]).toEqual({ score: 320, lines: 6, stars: 3 });
    expect(migrated.games.blocks.daily["not-a-date"]).toBeUndefined();
  });
});

describe("blocks misc helpers", () => {
  it("names palette colours", () => {
    expect(colorName(1)).toBe("cyan");
    expect(colorName(5)).toBe("violet");
    expect(colorName(99)).toBe("empty");
  });

  it("defaults to an 8x8 grid for both modes", () => {
    expect(createEndlessState("x").size).toBe(BLOCKS_GRID);
    expect(createDailyState("2026-09-15").size).toBe(BLOCKS_GRID);
  });

  it("awards a perfect clear on a single cell board", () => {
    const result = applyPlacement(createBoard(1), 1, shape("dot"), 0, 0, 3);
    expect(result!.lines).toBe(2);
    expect(result!.perfect).toBe(true);
    expect(result!.board).toEqual([0]);
  });
});
