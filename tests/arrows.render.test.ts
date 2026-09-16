import { describe, expect, it } from "vitest";
import { type ArrowTile, type ArrowsBoard, type ArrowsState, launch } from "../src/games/arrows/logic";
import {
  boardHtml,
  helpHtml,
  hudHtml,
  laneCells,
  liveStatusHtml,
  menuHtml,
  resultCardHtml,
  statusText,
  type MenuView,
  type ResultView,
} from "../src/games/arrows/render";

const tile = (over: Partial<ArrowTile> & Pick<ArrowTile, "dir" | "head">): ArrowTile => ({
  id: 0,
  length: 1,
  lock: 0,
  ...over,
});

function board(size: number, arrows: ArrowTile[]): ArrowsBoard {
  return { size, arrows: arrows.map((arrow, id) => ({ ...arrow, id })), seed: "t" };
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

function menuView(over: Partial<MenuView> = {}): MenuView {
  return {
    date: "2026-09-15",
    levels: [
      { level: 1, stars: 3, unlocked: true },
      { level: 2, stars: 0, unlocked: true },
      { level: 3, stars: 0, unlocked: false },
    ],
    totalStars: 3,
    nextLevel: 2,
    perfect: 1,
    bestRun: 0,
    boards: 0,
    dailyDone: false,
    dailyStreak: 0,
    dailyBest: 0,
    ...over,
  };
}

function resultView(over: Partial<ResultView> = {}): ResultView {
  return {
    mode: "level",
    level: 4,
    date: "2026-09-15",
    solved: true,
    score: 600,
    launches: 12,
    missteps: 0,
    hints: 0,
    stars: 3,
    arrows: 12,
    boards: 1,
    isBest: false,
    ranked: false,
    hasNext: true,
    ...over,
  };
}

describe("arrows board render", () => {
  it("renders a grid sized from the board", () => {
    const html = boardHtml(stateFor(board(4, [tile({ dir: 1, head: 0 })])));
    expect(html).toContain("nar-board");
    expect(html).toContain("--nar-size:4");
    expect(html).toContain("d1");
    expect(html).toContain("nar-tip");
  });

  it("marks ready and held arrows", () => {
    const html = boardHtml(stateFor(board(4, [tile({ dir: 1, head: 4 }), tile({ dir: 2, head: 6 })])));
    expect(html).toContain("ready");
    expect(html).toContain("held");
  });

  it("marks length and head and tail cells", () => {
    const html = boardHtml(stateFor(board(4, [tile({ dir: 2, head: 8, length: 3 })])));
    expect(html).toContain("len3");
    expect(html).toContain("head");
    expect(html).toContain("tail");
  });

  it("marks locked arrows and shows a lock badge", () => {
    const html = boardHtml(stateFor(board(4, [tile({ dir: 1, head: 0 }), tile({ dir: 1, head: 4, lock: 2 })])));
    expect(html).toContain("locked");
    expect(html).toContain("nar-lock");
  });

  it("tints by lock tier", () => {
    const html = boardHtml(stateFor(board(4, [tile({ dir: 1, head: 0 }), tile({ dir: 2, head: 7, lock: 3 })])));
    expect(html).toContain("tier0");
    expect(html).toContain("tier3");
  });

  it("highlights focus and hint arrows", () => {
    const html = boardHtml(stateFor(board(4, [tile({ dir: 1, head: 0 })])), { focus: 0, hint: 0 });
    expect(html).toContain("focus");
    expect(html).toContain("hint");
  });
});

describe("arrows lane preview", () => {
  it("returns the whole lane when clear", () => {
    const preview = laneCells(stateFor(board(4, [tile({ dir: 1, head: 4 })])), 0);
    expect(preview.cells).toEqual([5, 6, 7]);
    expect(preview.blocked).toBe(false);
  });

  it("stops at the blocker", () => {
    const preview = laneCells(stateFor(board(4, [tile({ dir: 1, head: 4 }), tile({ dir: 2, head: 6 })])), 0);
    expect(preview.cells).toEqual([5, 6]);
    expect(preview.blocked).toBe(true);
    expect(preview.blocker).toBe(6);
  });

  it("shows lane classes on empty cells", () => {
    const html = boardHtml(stateFor(board(4, [tile({ dir: 1, head: 4 })])), { press: 0 });
    expect(html).toContain("lane");
  });
});

describe("arrows hud and status", () => {
  it("shows left, ready, missteps and hints", () => {
    const html = hudHtml(stateFor(board(4, [tile({ dir: 1, head: 0 }), tile({ dir: 2, head: 7 })])));
    expect(html).toContain("LEFT");
    expect(html).toContain("READY");
    expect(html).toContain("MISSTEPS");
    expect(html).toContain("HINTS");
    expect(html).toContain(">2<");
  });

  it("explains the ready count", () => {
    expect(statusText(stateFor(board(4, [tile({ dir: 1, head: 0 })])))).toContain("1 arrow is ready");
  });

  it("reflects missteps in the hud", () => {
    const start = stateFor(board(4, [tile({ dir: 1, head: 4 }), tile({ dir: 2, head: 6 })]));
    const after = launch(start, 0).state;
    expect(hudHtml(after)).toContain('data-hud="missteps">1<');
  });
});

describe("arrows menu, result and help", () => {
  it("renders the menu with records and levels", () => {
    const html = menuHtml(menuView(), false);
    expect(html).toContain("ARROW ESCAPE");
    expect(html).toContain("NEON ARROWS DAILY");
    expect(html).toContain("PERFECT");
    expect(html).toContain('data-level="2"');
    expect(html).toContain("CONTINUE · LEVEL 2");
  });

  it("shows a completed daily card", () => {
    const html = menuHtml(menuView({ dailyDone: true, dailyBest: 3, dailyStreak: 4 }), true);
    expect(html).toContain("TODAY · ★★★");
  });

  it("titles the result card by outcome", () => {
    expect(resultCardHtml(resultView())).toContain("BOARD CLEARED");
    expect(resultCardHtml(resultView({ mode: "endless", solved: false }))).toContain("RUN OVER");
    expect(resultCardHtml(resultView({ mode: "daily", solved: true }))).toContain("DAILY COMPLETE");
  });

  it("reports launches, missteps and hints", () => {
    const html = resultCardHtml(resultView());
    expect(html).toContain("LAUNCHES");
    expect(html).toContain("MISSTEPS");
    expect(html).toContain("HINTS");
  });

  it("mentions the lane and locks in help", () => {
    const html = helpHtml(false);
    expect(html).toContain("whole lane");
    expect(html).toContain("Locked");
    expect(html).toContain("dead end");
  });

  it("exposes a live status region", () => {
    expect(liveStatusHtml("Ready")).toContain('id="arrows-status"');
  });
});
