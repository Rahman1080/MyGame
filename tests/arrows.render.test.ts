import { describe, expect, it } from "vitest";
import {
  type ArrowTile,
  type ArrowsBoard,
  type ArrowsState,
  parForBoard,
} from "../src/games/arrows/logic";
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

function board(size: number, arrows: ArrowTile[]): ArrowsBoard {
  return { size, arrows: arrows.map((arrow, id) => ({ ...arrow, id })), seed: "test" };
}

const tile = (head: number, dir: ArrowTile["dir"], extra: Partial<ArrowTile> = {}): ArrowTile => ({
  id: 0,
  dir,
  head,
  length: 1,
  lock: 0,
  ...extra,
});

function stateFor(source: ArrowsBoard): ArrowsState {
  return {
    mode: "level",
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

function menuView(over: Partial<MenuView> = {}): MenuView {
  return {
    date: "2026-09-15",
    levels: [
      { level: 1, stars: 3, unlocked: true },
      { level: 2, stars: 1, unlocked: true },
      { level: 3, stars: 0, unlocked: false },
    ],
    totalStars: 4,
    nextLevel: 3,
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
    stuck: false,
    score: 600,
    launches: 12,
    par: 12,
    hints: 0,
    stars: 3,
    arrows: 6,
    boards: 1,
    isBest: false,
    ranked: false,
    hasNext: true,
    ...over,
  };
}

describe("arrows board render", () => {
  it("renders a grid with arrow tiles and their directions", () => {
    const html = boardHtml(stateFor(board(4, [tile(0, 1), tile(5, 0)])));
    expect(html).toContain("nar-board");
    expect(html).toContain('--nar-size:4');
    expect(html).toContain("nar-tile d1 head");
    expect(html).toContain("nar-tile d0 head");
    expect(html).toContain("nar-tip");
  });

  it("marks ready and held arrows", () => {
    const html = boardHtml(stateFor(board(4, [tile(0, 1), tile(1, 1)])));
    expect(html).toContain("held");
    expect(html).toContain("ready");
  });

  it("marks locked arrows and shows a lock badge", () => {
    const html = boardHtml(stateFor(board(4, [tile(5, 0, { lock: 2 })])));
    expect(html).toContain("nar-tile");
    expect(html).toContain("locked");
    expect(html).toContain("nar-lock");
  });

  it("renders a long arrow head and tail", () => {
    const html = boardHtml(stateFor(board(4, [tile(8, 0, { length: 2 })])));
    expect(html).toContain("long");
    expect(html).toContain("head");
    expect(html).toContain("tail");
  });

  it("highlights focus and hint arrows", () => {
    const html = boardHtml(stateFor(board(4, [tile(0, 1)])), { focus: 0, hint: 0 });
    expect(html).toContain("focus");
    expect(html).toContain("hint");
  });
});

describe("arrows lane preview", () => {
  it("lists the cells in front of an arrow", () => {
    const preview = laneCells(stateFor(board(4, [tile(0, 1)])), 0);
    expect(preview.cells).toEqual([1, 2, 3]);
    expect(preview.blocked).toBe(false);
  });

  it("stops at the first obstruction", () => {
    const preview = laneCells(stateFor(board(4, [tile(0, 1), tile(2, 2)])), 0);
    expect(preview.cells).toEqual([1, 2]);
    expect(preview.blocked).toBe(true);
  });
});

describe("arrows hud and status", () => {
  it("shows left, launches, par and hints", () => {
    const html = hudHtml(stateFor(board(4, [tile(0, 1), tile(5, 0)])));
    expect(html).toContain("nar-hud");
    expect(html).toContain("LEFT");
    expect(html).toContain("LAUNCHES");
    expect(html).toContain("PAR");
    expect(html).toContain("HINTS");
    expect(html).toContain(">2<");
  });

  it("explains the ready count", () => {
    expect(statusText(stateFor(board(4, [tile(0, 1), tile(1, 1)])))).toContain("1 arrow is ready");
  });

  it("reports a dead end", () => {
    const stuck = { ...stateFor(board(4, [tile(0, 1), tile(1, 3)])), status: "stuck" as const };
    expect(statusText(stuck)).toContain("Dead end");
  });
});

describe("arrows menu, result and help", () => {
  it("renders the arrow escape menu", () => {
    const html = menuHtml(menuView(), false);
    expect(html).toContain("ARROW ESCAPE");
    expect(html).toContain("NEON ARROWS DAILY");
    expect(html).toContain('data-level="2"');
    expect(html).toContain("CONTINUE · LEVEL 3");
  });

  it("shows a completed daily card", () => {
    const html = menuHtml(menuView({ dailyDone: true, dailyBest: 3, dailyStreak: 4 }), true);
    expect(html).toContain("TODAY · ★★★");
  });

  it("titles the result card by outcome", () => {
    expect(resultCardHtml(resultView())).toContain("BOARD CLEARED");
    expect(resultCardHtml(resultView({ solved: false, stuck: true, stars: 0 }))).toContain("DEAD END");
    expect(resultCardHtml(resultView({ mode: "endless", solved: false }))).toContain("RUN OVER");
  });

  it("mentions launches and dead ends in help", () => {
    const html = helpHtml(false);
    expect(html).toContain("Launch");
    expect(html).toContain("dead end");
    expect(html).toContain("par");
  });

  it("exposes a live status region", () => {
    expect(liveStatusHtml("Ready")).toContain('id="arrows-status"');
  });
});
