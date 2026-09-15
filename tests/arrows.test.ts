import { describe, expect, it } from "vitest";
import {
  ARROWS_TOTAL_LEVELS,
  type ArrowTile,
  type ArrowsBoard,
  type ArrowsResult,
  type ArrowsState,
  bodyCells,
  dailyStreakOn,
  emptyArrowsSave,
  finalResult,
  isLevelSolved,
  isLevelUnlocked,
  isSolved,
  isStuck,
  launch,
  levelScore,
  movableIndices,
  parForBoard,
  recordDailyRun,
  recordLevelRun,
  starsForRun,
  undo,
} from "../src/games/arrows/logic";
import { createLevelState } from "../src/games/arrows/generate";

function board(size: number, arrows: ArrowTile[]): ArrowsBoard {
  return { size, arrows: arrows.map((arrow, id) => ({ ...arrow, id })), seed: "test" };
}

function stateFor(source: ArrowsBoard, mode: ArrowsState["mode"] = "level"): ArrowsState {
  return {
    mode,
    level: 1,
    boardIndex: 0,
    size: source.size,
    arrows: source.arrows,
    heads: source.arrows.map((arrow) => arrow.head),
    bodies: source.arrows.map((arrow) => arrow.length),
    escaped: 0,
    launches: 0,
    hints: 0,
    par: parForBoard(source.size, source.arrows),
    seed: source.seed,
    date: "",
    status: "playing",
    history: [],
  };
}

const tile = (head: number, dir: ArrowTile["dir"], extra: Partial<ArrowTile> = {}): ArrowTile => ({
  id: 0,
  dir,
  head,
  length: 1,
  lock: 0,
  ...extra,
});

describe("arrows geometry", () => {
  it("traces a body behind the head in the opposite direction", () => {
    expect(bodyCells(4, 0, 8, 2)).toEqual([8, 12]);
    expect(bodyCells(4, 1, 4, 1)).toEqual([4]);
  });

  it("computes par from distance to the edge plus body length", () => {
    const b = board(4, [tile(0, 1), tile(8, 0, { length: 2 })]);
    expect(parForBoard(4, b.arrows)).toBe(4 + 4);
  });
});

describe("arrows launch", () => {
  it("advances an arrow by one cell and records the launch", () => {
    const s = stateFor(board(4, [tile(0, 1)]));
    const out = launch(s, 0);
    expect(out.moved).toBe(true);
    expect(out.state.heads[0]).toBe(1);
    expect(out.state.launches).toBe(1);
    expect(out.state.history).toHaveLength(1);
  });

  it("blocks an arrow whose next cell is occupied", () => {
    const s = stateFor(board(4, [tile(0, 1), tile(1, 1)]));
    const out = launch(s, 0);
    expect(out.moved).toBe(false);
    expect(out.reason).toBe("blocked");
    expect(movableIndices(s.size, s.arrows, s.heads, s.bodies)).toEqual([1]);
  });

  it("refuses a locked arrow until enough arrows escape", () => {
    const s = stateFor(
      board(4, [
        tile(0, 0, { lock: 1 }),
        tile(5, 0),
      ]),
    );
    const blocked = launch(s, 0);
    expect(blocked.moved).toBe(false);
    expect(blocked.reason).toBe("locked");

    let current = launch(s, 1).state;
    expect(current.escaped).toBe(0);
    current = launch(current, 1).state;
    expect(current.escaped).toBe(1);
    const now = launch(current, 0);
    expect(now.moved).toBe(true);
  });

  it("escapes an arrow that reaches the edge", () => {
    let s = stateFor(board(4, [tile(0, 0)]));
    s = launch(s, 0).state;
    expect(s.escaped).toBe(1);
    expect(s.bodies[0]).toBe(0);
    expect(isSolved(s)).toBe(true);
    expect(s.status).toBe("solved");
  });

  it("takes extra launches to clear a long arrow", () => {
    const b = board(4, [tile(8, 0, { length: 2 })]);
    expect(parForBoard(4, b.arrows)).toBe(4);
    let s = stateFor(b);
    for (let i = 0; i < 4; i += 1) s = launch(s, 0).state;
    expect(s.escaped).toBe(1);
    expect(isSolved(s)).toBe(true);
  });

  it("detects a dead end when nothing can move", () => {
    const s = stateFor(board(4, [tile(0, 1), tile(1, 3)]));
    expect(isStuck(s)).toBe(true);
    expect(movableIndices(s.size, s.arrows, s.heads, s.bodies)).toEqual([]);
  });

  it("undo restores the previous pose", () => {
    const s = stateFor(board(4, [tile(0, 1)]));
    const moved = launch(s, 0).state;
    expect(moved.launches).toBe(1);
    const back = undo(moved);
    expect(back.heads[0]).toBe(0);
    expect(back.launches).toBe(0);
  });
});

describe("arrows scoring", () => {
  it("awards three stars only without hints", () => {
    expect(starsForRun(10, 10, 0)).toBe(3);
    expect(starsForRun(10, 10, 1)).toBe(2);
    expect(starsForRun(10, 10, 2)).toBe(1);
  });

  it("scores a solved level and reports it", () => {
    const s = { ...stateFor(board(4, [tile(0, 0)])), hints: 1 };
    const solved = launch(s, 0).state;
    const result = finalResult(solved);
    expect(result.solved).toBe(true);
    expect(result.stars).toBe(2);
    expect(levelScore(result.launches, result.par, result.hints, result.stars)).toBe(360);
  });
});

describe("arrows saves", () => {
  const result = (over: Partial<ArrowsResult> = {}): ArrowsResult => ({
    mode: "level",
    level: 2,
    date: "",
    solved: true,
    launches: 12,
    par: 12,
    hints: 0,
    stars: 3,
    ...over,
  });

  it("records a solved level once and unlocks the next", () => {
    const save = recordLevelRun(emptyArrowsSave(), result());
    expect(isLevelSolved(save, 2)).toBe(true);
    expect(isLevelUnlocked(save, 3)).toBe(true);
    expect(isLevelUnlocked(save, 4)).toBe(false);
    expect(recordLevelRun(save, result({ stars: 1 })).levels["2"]!.stars).toBe(3);
  });

  it("never records an unsolved level", () => {
    const save = recordLevelRun(emptyArrowsSave(), result({ solved: false }));
    expect(isLevelSolved(save, 2)).toBe(false);
  });

  it("records a daily solve and derives the streak", () => {
    let save = recordDailyRun(emptyArrowsSave(), result({ mode: "daily", date: "2026-09-14" }));
    save = recordDailyRun(save, result({ mode: "daily", date: "2026-09-15", launches: 9, stars: 2 }));
    expect(save.daily["2026-09-15"]).toEqual({ solved: true, launches: 9, stars: 2 });
    expect(dailyStreakOn(save, "2026-09-15")).toBe(2);
    const replay = recordDailyRun(save, result({ mode: "daily", date: "2026-09-15", stars: 1 }));
    expect(replay.daily["2026-09-15"]!.stars).toBe(2);
  });
});

describe("arrows level states", () => {
  it("builds the first level from a generated board", () => {
    const s = createLevelState(1);
    expect(s.size).toBe(4);
    expect(s.arrows.length).toBeGreaterThan(0);
    expect(s.bodies.every((body, i) => body === s.arrows[i]!.length)).toBe(true);
    expect(s.par).toBeGreaterThan(0);
  });

  it("has a full campaign", () => {
    expect(ARROWS_TOTAL_LEVELS).toBe(60);
  });
});
