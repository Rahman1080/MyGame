import { describe, expect, it } from "vitest";
import {
  type ArrowTile,
  type ArrowsBoard,
  type ArrowsState,
  availableIndices,
  bodyCells,
  canLaunch,
  emptyArrowsSave,
  finalResult,
  isLocked,
  isSolved,
  isStuck,
  laneInfo,
  lanePath,
  launch,
  levelScore,
  levelStars,
  levelsWon,
  perfectLevels,
  recordLevelRun,
  remainingArrows,
  starsForRun,
  undo,
} from "../src/games/arrows/logic";
import { ARROWS_SAVE_VERSION } from "../src/save/schema";

const tile = (over: Partial<ArrowTile> & Pick<ArrowTile, "dir" | "head">): ArrowTile => ({
  id: 0,
  length: 1,
  lock: 0,
  ...over,
});

function board(size: number, arrows: ArrowTile[]): ArrowsBoard {
  return { size, arrows: arrows.map((arrow, id) => ({ ...arrow, id })), seed: "test" };
}

function stateFor(source: ArrowsBoard): ArrowsState {
  return {
    mode: "level",
    level: 1,
    boardIndex: 0,
    size: source.size,
    arrows: source.arrows,
    alive: source.arrows.map(() => true),
    escaped: 0,
    launches: 0,
    missteps: 0,
    hints: 0,
    seed: source.seed,
    date: "",
    status: "playing",
    history: [],
  };
}

describe("arrow geometry", () => {
  it("builds body cells head-first, extending backwards", () => {
    expect(bodyCells(4, 0, 8, 1)).toEqual([8]);
    expect(bodyCells(4, 1, 5, 2)).toEqual([5, 4]);
    expect(bodyCells(4, 2, 8, 3)).toEqual([8, 4, 0]);
  });

  it("walks the lane to the edge", () => {
    expect(lanePath(4, 1, 4)).toEqual([5, 6, 7]);
    expect(lanePath(4, 0, 0)).toEqual([]);
    expect(lanePath(4, 2, 1)).toEqual([5, 9, 13]);
  });
});

describe("arrow queries", () => {
  it("reads the lane and finds the blocker", () => {
    const state = stateFor(board(4, [tile({ dir: 1, head: 4 }), tile({ dir: 2, head: 6 })]));
    expect(laneInfo(state, 0)).toEqual({ cells: [5, 6], blocked: true, blocker: 6 });
    expect(canLaunch(state, 0)).toBe(false);
    expect(canLaunch(state, 1)).toBe(true);
  });

  it("reports a clear lane to the edge", () => {
    const state = stateFor(board(4, [tile({ dir: 1, head: 4 })]));
    expect(laneInfo(state, 0)).toEqual({ cells: [5, 6, 7], blocked: false, blocker: -1 });
    expect(canLaunch(state, 0)).toBe(true);
  });

  it("counts a long arrow body as a blocker", () => {
    const state = stateFor(board(4, [tile({ dir: 1, head: 4 }), tile({ dir: 2, head: 10, length: 2 })]));
    expect(laneInfo(state, 0).blocked).toBe(true);
    expect(laneInfo(state, 0).blocker).toBe(6);
  });

  it("gates an arrow behind its lock", () => {
    const state = stateFor(board(4, [tile({ dir: 1, head: 0 }), tile({ dir: 1, head: 4, lock: 2 })]));
    expect(isLocked(state, 1)).toBe(true);
    expect(canLaunch(state, 1)).toBe(false);
    const after = launch(state, 0).state;
    expect(isLocked(after, 1)).toBe(true);
    const second = launch(after, launch(after, 0).state.arrows.length ? 0 : 0);
    void second;
  });

  it("lists ready arrows", () => {
    const state = stateFor(board(4, [tile({ dir: 1, head: 4 }), tile({ dir: 2, head: 6 })]));
    expect(availableIndices(state)).toEqual([1]);
  });

  it("is stuck only when arrows remain and none can launch", () => {
    const open = stateFor(board(4, [tile({ dir: 1, head: 4 })]));
    expect(isStuck(open)).toBe(false);
    const deadlock = stateFor(board(2, [tile({ dir: 1, head: 0 }), tile({ dir: 3, head: 1 })]));
    expect(isStuck(deadlock)).toBe(true);
    expect(isSolved(deadlock)).toBe(false);
  });
});

describe("arrow launch", () => {
  it("escapes an arrow with a clear lane", () => {
    const start = stateFor(board(4, [tile({ dir: 1, head: 4 })]));
    const outcome = launch(start, 0);
    expect(outcome.moved).toBe(true);
    expect(outcome.state.alive[0]).toBe(false);
    expect(outcome.state.escaped).toBe(1);
    expect(outcome.state.launches).toBe(1);
    expect(outcome.state.status).toBe("solved");
    expect(remainingArrows(outcome.state)).toBe(0);
  });

  it("rejects a blocked launch and records a misstep", () => {
    const start = stateFor(board(4, [tile({ dir: 1, head: 4 }), tile({ dir: 2, head: 6 })]));
    const outcome = launch(start, 0);
    expect(outcome.moved).toBe(false);
    expect(outcome.reason).toBe("blocked");
    expect(outcome.misstep).toBe(true);
    expect(outcome.state.missteps).toBe(1);
    expect(outcome.state.launches).toBe(0);
    expect(outcome.state.alive[0]).toBe(true);
  });

  it("rejects a locked launch and records a misstep", () => {
    const start = stateFor(board(4, [tile({ dir: 1, head: 0 }), tile({ dir: 1, head: 4, lock: 2 })]));
    const outcome = launch(start, 1);
    expect(outcome.moved).toBe(false);
    expect(outcome.reason).toBe("locked");
    expect(outcome.state.missteps).toBe(1);
  });

  it("ignores launches after solving", () => {
    const start = stateFor(board(4, [tile({ dir: 1, head: 4 })]));
    const solved = launch(start, 0).state;
    const outcome = launch(solved, 0);
    expect(outcome.moved).toBe(false);
    expect(outcome.reason).toBe("done");
    expect(outcome.state.missteps).toBe(0);
  });

  it("undo restores the previous pose", () => {
    const start = stateFor(board(4, [tile({ dir: 1, head: 4 }), tile({ dir: 1, head: 8 })]));
    const after = launch(start, 0).state;
    expect(after.status).toBe("playing");
    const back = undo(after);
    expect(back.alive[0]).toBe(true);
    expect(back.escaped).toBe(0);
    expect(back.status).toBe("playing");
  });
});

describe("arrow scoring", () => {
  it("awards stars for clean runs", () => {
    expect(starsForRun(0, 0)).toBe(3);
    expect(starsForRun(1, 0)).toBe(2);
    expect(starsForRun(0, 3)).toBe(2);
    expect(starsForRun(2, 0)).toBe(1);
    expect(starsForRun(0, 4)).toBe(1);
  });

  it("scores a run", () => {
    expect(levelScore(12, 0, 3)).toBe(600);
    expect(levelScore(12, 2, 3)).toBe(520);
  });

  it("reports a result", () => {
    const start = stateFor(board(4, [tile({ dir: 1, head: 4 })]));
    const result = finalResult(launch(start, 0).state);
    expect(result).toEqual({
      mode: "level",
      level: 1,
      date: "",
      solved: true,
      launches: 1,
      missteps: 0,
      hints: 0,
      arrows: 1,
      stars: 3,
    });
  });
});

describe("arrow saves", () => {
  it("starts empty at the current save version", () => {
    const save = emptyArrowsSave();
    expect(save.version).toBe(ARROWS_SAVE_VERSION);
    expect(save.levels).toEqual({});
    expect(save.perfect).toBe(0);
  });

  it("records a solved level and its perfect count", () => {
    const start = stateFor(board(4, [tile({ dir: 1, head: 4 })]));
    const result = finalResult(launch(start, 0).state);
    const save = recordLevelRun(emptyArrowsSave(), result);
    expect(levelStars(save, 1)).toBe(3);
    expect(levelsWon(save)).toBe(1);
    expect(perfectLevels(save)).toBe(1);
    const again = recordLevelRun(save, result);
    expect(perfectLevels(again)).toBe(1);
  });
});
