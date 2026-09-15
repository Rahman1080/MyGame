import { describe, expect, it } from "vitest";
import {
  ARROWS_TOTAL_LEVELS,
  boardValue,
  cellAt,
  createStateFrom,
  dailyBestStars,
  dailyStreakOn,
  dirBetween,
  emptyArrowsSave,
  finalResult,
  hintCell,
  isDailyDone,
  isLevelSolved,
  isLevelUnlocked,
  isSolved,
  levelScore,
  levelStars,
  recordDailyRun,
  recordEndlessRun,
  recordLevelRun,
  rotateCell,
  rotateDir,
  rotateDirN,
  starsForRun,
  stepCell,
  traceAll,
  type ArrowsCell,
  type ArrowsLevel,
  type ArrowsResult,
  type ArrowsSource,
  type ArrowsState,
  type Dir,
} from "../src/games/arrows/logic";
import {
  createDailyState,
  createEndlessState,
  createLevelState,
  endlessConfig,
  generateDailyBoard,
  generateEndlessBoard,
  generateLevel,
  levelConfig,
} from "../src/games/arrows/generate";

function makeLevel(
  size: number,
  build: (cells: ArrowsCell[]) => void,
  sources: ArrowsSource[],
  exitCells: number[] = [],
): ArrowsLevel {
  const cells: ArrowsCell[] = Array.from({ length: size * size }, () => ({ kind: "empty", dir: 0, locked: false }));
  build(cells);
  for (const cell of exitCells) cells[cell] = { kind: "exit", dir: 0, locked: false };
  return {
    level: 1,
    boardIndex: 0,
    size,
    cells,
    sources,
    checkpoints: [],
    solution: new Array<number>(size * size).fill(-1),
    order: [],
    par: 0,
    maxRotations: null,
    seed: "tiny",
  };
}

function canonicalState(level: ArrowsLevel): ArrowsState {
  const cells = level.cells.map((cell, i) =>
    (level.solution[i] ?? -1) >= 0 ? { ...cell, dir: level.solution[i] as Dir } : { ...cell },
  );
  return createStateFrom({ ...level, cells }, "level");
}

function result(
  mode: ArrowsResult["mode"],
  over: Partial<ArrowsResult> = {},
): ArrowsResult {
  return { mode, level: 0, date: "", solved: true, rotations: 10, par: 10, hints: 0, stars: 3, ...over };
}

describe("arrows geometry", () => {
  it("rotates directions clockwise and wraps", () => {
    expect(rotateDir(0)).toBe(1);
    expect(rotateDir(3)).toBe(0);
    expect(rotateDirN(0, 1)).toBe(1);
    expect(rotateDirN(0, 3)).toBe(3);
    expect(rotateDirN(0, 5)).toBe(1);
    expect(rotateDirN(2, -1)).toBe(1);
  });

  it("steps inside the board and reports exits", () => {
    expect(stepCell(4, cellAt(4, 1, 1), 1)).toBe(cellAt(4, 1, 2));
    expect(stepCell(4, cellAt(4, 0, 0), 0)).toBe(-1);
    expect(stepCell(4, cellAt(4, 0, 0), 3)).toBe(-1);
    expect(stepCell(4, cellAt(4, 3, 3), 2)).toBe(-1);
    expect(dirBetween(4, cellAt(4, 1, 1), cellAt(4, 2, 1))).toBe(2);
    expect(dirBetween(4, cellAt(4, 1, 1), cellAt(4, 1, 0))).toBe(3);
    expect(dirBetween(4, cellAt(4, 0, 0), cellAt(4, 2, 0))).toBeNull();
  });
});

describe("arrows beam tracing", () => {
  it("reaches the exit", () => {
    const size = 4;
    const level = makeLevel(
      size,
      (cells) => {
        cells[cellAt(size, 1, 1)] = { kind: "arrow", dir: 1, locked: false };
        cells[cellAt(size, 1, 2)] = { kind: "arrow", dir: 0, locked: false };
      },
      [{ cell: cellAt(size, 1, 0), dir: 1, exit: cellAt(size, 0, 2) }],
      [cellAt(size, 0, 2)],
    );
    const state = createStateFrom(level, "level");
    const trace = traceAll(state)[0]!;
    expect(trace.status).toBe("exit");
    expect(trace.path).toEqual([cellAt(size, 1, 0), cellAt(size, 1, 1), cellAt(size, 1, 2), cellAt(size, 0, 2)]);
    expect(isSolved(state)).toBe(true);
  });

  it("detects a blocked beam", () => {
    const size = 4;
    const level = makeLevel(
      size,
      (cells) => {
        cells[cellAt(size, 0, 1)] = { kind: "wall", dir: 0, locked: false };
      },
      [{ cell: cellAt(size, 0, 0), dir: 1, exit: cellAt(size, 3, 3) }],
      [cellAt(size, 3, 3)],
    );
    expect(traceAll(createStateFrom(level, "level"))[0]!.status).toBe("blocked");
  });

  it("detects a looping beam", () => {
    const size = 4;
    const level = makeLevel(
      size,
      (cells) => {
        cells[cellAt(size, 1, 1)] = { kind: "arrow", dir: 1, locked: false };
        cells[cellAt(size, 1, 2)] = { kind: "arrow", dir: 3, locked: false };
      },
      [{ cell: cellAt(size, 1, 0), dir: 1, exit: cellAt(size, 3, 3) }],
      [cellAt(size, 3, 3)],
    );
    expect(traceAll(createStateFrom(level, "level"))[0]!.status).toBe("loop");
  });

  it("detects a beam leaving the grid", () => {
    const size = 4;
    const level = makeLevel(size, () => undefined, [{ cell: cellAt(size, 1, 0), dir: 3, exit: cellAt(size, 3, 3) }], [
      cellAt(size, 3, 3),
    ]);
    expect(traceAll(createStateFrom(level, "level"))[0]!.status).toBe("out");
  });
});

describe("arrows rotation", () => {
  function playable(): ArrowsState {
    const size = 4;
    const level = makeLevel(
      size,
      (cells) => {
        cells[cellAt(size, 1, 1)] = { kind: "arrow", dir: 0, locked: false };
      },
      [{ cell: cellAt(size, 1, 0), dir: 1, exit: cellAt(size, 1, 2) }],
      [cellAt(size, 1, 2)],
    );
    level.solution[cellAt(size, 1, 1)] = 1;
    level.order = [cellAt(size, 1, 1)];
    level.par = 1;
    return { ...createStateFrom(level, "level"), maxRotations: 2 };
  }

  it("rotates a tile, spends a rotation and solves", () => {
    const start = playable();
    const first = rotateCell(start, cellAt(4, 1, 1));
    expect(first.changed).toBe(true);
    expect(first.state.rotations).toBe(1);
    expect(first.state.status).toBe("solved");
    expect(isSolved(first.state)).toBe(true);
  });

  it("refuses to rotate locked tiles", () => {
    const start = playable();
    const cells = start.cells.slice();
    cells[cellAt(4, 1, 1)] = { ...cells[cellAt(4, 1, 1)]!, locked: true };
    const out = rotateCell({ ...start, cells }, cellAt(4, 1, 1));
    expect(out.changed).toBe(false);
    expect(out.reason).toBe("locked");
  });

  it("fails when the rotation budget runs out", () => {
    const start = playable();
    const cells = start.cells.slice();
    cells[cellAt(4, 1, 1)] = { ...cells[cellAt(4, 1, 1)]!, dir: 3 };
    const tight: ArrowsState = { ...start, cells, maxRotations: 1, par: 2 };
    const first = rotateCell(tight, cellAt(4, 1, 1));
    expect(first.changed).toBe(true);
    expect(first.state.rotations).toBe(1);
    expect(first.state.status).toBe("failed");
    const second = rotateCell(first.state, cellAt(4, 1, 1));
    expect(second.changed).toBe(false);
    expect(second.reason).toBe("done");
  });

  it("ignores non-arrow cells", () => {
    const start = playable();
    const out = rotateCell(start, cellAt(4, 0, 0));
    expect(out.changed).toBe(false);
    expect(out.reason).toBe("not-arrow");
  });
});

describe("arrows scoring", () => {
  it("awards stars by rotation efficiency and caps at two for hints", () => {
    expect(starsForRun(10, 10, 0)).toBe(3);
    expect(starsForRun(11, 10, 0)).toBe(2);
    expect(starsForRun(13, 10, 0)).toBe(2);
    expect(starsForRun(14, 10, 0)).toBe(1);
    expect(starsForRun(10, 10, 1)).toBe(2);
  });

  it("values a board and a level sensibly", () => {
    expect(boardValue(5, 8, 8)).toBeGreaterThan(0);
    expect(boardValue(5, 8, 5)).toBeGreaterThan(boardValue(5, 8, 20));
    expect(levelScore(10, 10, 0, 3)).toBeGreaterThan(levelScore(20, 10, 0, 1));
    expect(levelScore(10, 10, 2, 3)).toBeLessThan(levelScore(10, 10, 0, 3));
  });
});

describe("arrows level generation", () => {
  it("keeps config within sane bounds across the campaign", () => {
    for (let level = 1; level <= ARROWS_TOTAL_LEVELS; level += 1) {
      const cfg = levelConfig(level);
      expect(cfg.size).toBeGreaterThanOrEqual(4);
      expect(cfg.size).toBeLessThanOrEqual(7);
      expect(cfg.pathMin).toBeGreaterThanOrEqual(3);
      expect(cfg.pathTarget).toBeGreaterThanOrEqual(cfg.pathMin);
      expect(cfg.pathTarget).toBeLessThanOrEqual(cfg.size * cfg.size - 3);
      expect(cfg.sources).toBeGreaterThanOrEqual(1);
      if (cfg.limitSlack !== null) expect(cfg.limitSlack).toBeGreaterThan(0);
    }
    expect(endlessConfig(0).limitSlack).not.toBeNull();
  });

  it("generates every campaign level as a solvable, unsolved board", () => {
    for (let level = 1; level <= ARROWS_TOTAL_LEVELS; level += 1) {
      const board = generateLevel(level);
      expect(board.size).toBe(levelConfig(level).size);
      expect(board.cells).toHaveLength(board.size * board.size);
      expect(board.sources.length).toBeGreaterThanOrEqual(1);
      expect(board.order.length).toBeGreaterThanOrEqual(2);
      expect(board.par).toBeGreaterThan(0);
      if (board.maxRotations !== null) expect(board.maxRotations).toBeGreaterThanOrEqual(board.par);

      const start = createStateFrom(board, "level");
      expect(start.status).toBe("playing");

      const solved = canonicalState(board);
      expect(isSolved(solved)).toBe(true);
      for (const trace of traceAll(solved)) {
        expect(trace.status).toBe("exit");
        expect(trace.path[trace.path.length - 1]).toBe(board.sources[trace.source]?.exit);
      }
    }
  });

  it("is deterministic for a given level", () => {
    for (const level of [1, 9, 24, 42, 60]) {
      expect(JSON.stringify(generateLevel(level))).toBe(JSON.stringify(generateLevel(level)));
    }
  });

  it("can be fully solved by following the hints, never spending more than par", () => {
    for (const level of [1, 5, 18, 33, 51, 60]) {
      let state = createLevelState(level);
      let guard = 0;
      while (state.status === "playing" && guard < 600) {
        const cell = hintCell(state);
        if (cell === null) break;
        const out = rotateCell(state, cell);
        expect(out.changed).toBe(true);
        state = out.state;
        guard += 1;
      }
      expect(state.status).toBe("solved");
      expect(state.rotations).toBeGreaterThan(0);
      expect(state.rotations).toBeLessThanOrEqual(state.par);
      expect(isSolved(state)).toBe(true);
    }
  });

  it("reports no hint once the canonical board is reached", () => {
    const board = generateLevel(12);
    const solved = canonicalState(board);
    expect(hintCell(solved)).toBeNull();
  });

  it("keeps locked tiles and checkpoints pointing the correct way", () => {
    for (const level of [30, 36, 54]) {
      const board = generateLevel(level);
      for (let i = 0; i < board.cells.length; i += 1) {
        const cell = board.cells[i]!;
        if (cell.kind === "checkpoint") expect(cell.dir).toBe(board.solution[i]);
        if (cell.kind === "arrow" && cell.locked) expect(cell.dir).toBe(board.solution[i]);
      }
    }
  });

  it("generates deterministic endless and daily boards", () => {
    for (let index = 0; index < 12; index += 1) {
      const a = generateEndlessBoard("arrows:endless:test", index);
      const b = generateEndlessBoard("arrows:endless:test", index);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      expect(isSolved(canonicalState(a))).toBe(true);
      expect(createStateFrom(a, "endless").status).toBe("playing");
    }
    const d1 = generateDailyBoard("2026-09-15");
    const d2 = generateDailyBoard("2026-09-15");
    const d3 = generateDailyBoard("2026-09-16");
    expect(JSON.stringify(d1)).toBe(JSON.stringify(d2));
    expect(JSON.stringify(d1)).not.toBe(JSON.stringify(d3));
    expect(createEndlessState("arrows:endless:test", 3).mode).toBe("endless");
    expect(createDailyState("2026-09-15").date).toBe("2026-09-15");
  });
});

describe("arrows save progression", () => {
  it("records level wins, keeping the best stars and rotations", () => {
    let save = emptyArrowsSave();
    expect(isLevelUnlocked(save, 1)).toBe(true);
    expect(isLevelUnlocked(save, 2)).toBe(false);
    save = recordLevelRun(save, result("level", { level: 1, stars: 2, rotations: 12, hints: 1 }));
    expect(isLevelSolved(save, 1)).toBe(true);
    expect(levelStars(save, 1)).toBe(2);
    expect(isLevelUnlocked(save, 2)).toBe(true);
    save = recordLevelRun(save, result("level", { level: 1, stars: 3, rotations: 9, hints: 0 }));
    expect(levelStars(save, 1)).toBe(3);
    expect(save.levels["1"]?.best).toBe(9);
    expect(save.levels["1"]?.attempts).toBe(2);
    expect(save.boards).toBe(2);
  });

  it("only records a daily board when it is solved, once", () => {
    let save = emptyArrowsSave();
    save = recordDailyRun(save, result("daily", { date: "2026-09-15", solved: false, stars: 0 }));
    expect(isDailyDone(save, "2026-09-15")).toBe(false);
    save = recordDailyRun(save, result("daily", { date: "2026-09-15", solved: true, stars: 2 }));
    expect(isDailyDone(save, "2026-09-15")).toBe(true);
    expect(dailyBestStars(save, "2026-09-15")).toBe(2);
    save = recordDailyRun(save, result("daily", { date: "2026-09-15", solved: true, stars: 3 }));
    expect(dailyBestStars(save, "2026-09-15")).toBe(2);
    expect(save.boards).toBe(1);
  });

  it("derives a consecutive daily streak from stored dates", () => {
    let save = emptyArrowsSave();
    for (const date of ["2026-09-13", "2026-09-14", "2026-09-15"]) {
      save = recordDailyRun(save, result("daily", { date, solved: true, stars: 1 }));
    }
    expect(dailyStreakOn(save, "2026-09-15")).toBe(3);
    expect(save.bestDailyStreak).toBe(3);
    expect(dailyStreakOn(save, "2026-09-20")).toBe(0);
    save = recordDailyRun(save, result("daily", { date: "2026-09-17", solved: true, stars: 1 }));
    expect(dailyStreakOn(save, "2026-09-17")).toBe(1);
  });

  it("tracks endless bests and totals", () => {
    let save = emptyArrowsSave();
    save = recordEndlessRun(save, 800, 4);
    expect(save.best).toBe(800);
    expect(save.runs).toBe(1);
    expect(save.boards).toBe(4);
    expect(save.bestRun).toBe(4);
    save = recordEndlessRun(save, 500, 9);
    expect(save.best).toBe(800);
    expect(save.runs).toBe(2);
    expect(save.bestRun).toBe(9);
    expect(save.boards).toBe(13);
  });

  it("summarises a finished board", () => {
    const board = generateLevel(4);
    const solved = canonicalState(board);
    const finished: ArrowsState = { ...solved, status: "solved", rotations: board.par, hints: 1 };
    const summary = finalResult(finished);
    expect(summary.solved).toBe(true);
    expect(summary.stars).toBe(2);
    expect(summary.rotations).toBe(board.par);
  });
});
