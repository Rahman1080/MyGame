import { describe, expect, it } from "vitest";
import {
  createStateFrom,
  type ArrowsCell,
  type ArrowsLevel,
  type ArrowsSource,
  type ArrowsState,
} from "../src/games/arrows/logic";
import { createLevelState, generateLevel } from "../src/games/arrows/generate";
import {
  beamSummary,
  boardHtml,
  helpHtml,
  hudHtml,
  liveStatusHtml,
  menuHtml,
  modeLabel,
  playShellHtml,
  resultCardHtml,
  starsText,
  statusText,
  type LevelOption,
  type MenuView,
  type PlayBody,
  type ResultView,
} from "../src/games/arrows/render";

function handmade(): ArrowsState {
  const size = 4;
  const cells: ArrowsCell[] = Array.from({ length: size * size }, () => ({ kind: "empty", dir: 0, locked: false }));
  cells[1] = { kind: "arrow", dir: 0, locked: false };
  cells[2] = { kind: "arrow", dir: 3, locked: true };
  cells[5] = { kind: "checkpoint", dir: 2, locked: true };
  cells[9] = { kind: "exit", dir: 0, locked: false };
  const sources: ArrowsSource[] = [{ cell: 3, dir: 3, exit: 9 }];
  const level: ArrowsLevel = {
    level: 1,
    boardIndex: 0,
    size,
    cells,
    sources,
    checkpoints: [5],
    solution: new Array<number>(size * size).fill(-1),
    order: [],
    par: 1,
    maxRotations: 3,
    seed: "render-seed",
  };
  return createStateFrom(level, "level");
}

function menuView(over: Partial<MenuView> = {}): MenuView {
  const levels: LevelOption[] = [
    { level: 1, stars: 3, unlocked: true },
    { level: 2, stars: 1, unlocked: true },
    { level: 3, stars: 0, unlocked: false },
  ];
  return {
    date: "2026-09-15",
    levels,
    totalStars: 4,
    nextLevel: 3,
    bestRun: 6,
    boards: 42,
    dailyDone: false,
    dailyStreak: 0,
    dailyBest: 0,
    ...over,
  };
}

describe("arrows board rendering", () => {
  it("renders a labelled grid with one cell per tile", () => {
    const html = boardHtml(createLevelState(1));
    expect(html).toContain('role="grid"');
    expect(html).toContain("Arrow board, 4 by 4");
    expect((html.match(/role="row"/g) ?? []).length).toBe(4);
    expect((html.match(/role="gridcell"/g) ?? []).length).toBe(16);
    expect(html).toContain("nar-cell");
  });

  it("renders arrows, exits, sources, locked tiles and checkpoints", () => {
    const html = boardHtml(handmade());
    expect(html).toContain("nar-cell arrow");
    expect(html).toContain("nar-glyph d3");
    expect(html).toContain("nar-cell checkpoint");
    expect(html).toContain("nar-cell exit");
    expect(html).toContain("nar-cell empty on source");
    expect(html).toContain("locked");
    expect(html).toContain('aria-label="Energy source at row 1 column 4, launching left"');
    expect(html).toContain("data-cell=&quot;5&quot;".replace(/&quot;/g, '"'));
    expect(html).toContain("activate to rotate");
  });

  it("marks the focused and hinted tiles", () => {
    const html = boardHtml(handmade(), { focus: 3, hint: 3 });
    expect(html).toContain("focus");
    expect(html).toContain("hint");
  });

  it("flags exits that a beam has reached", () => {
    const board = generateLevel(1);
    const cells = board.cells.map((cell, i) =>
      (board.solution[i] ?? -1) >= 0 ? { ...cell, dir: board.solution[i] as 0 | 1 | 2 | 3 } : { ...cell },
    );
    const solved = createStateFrom({ ...board, cells }, "level");
    expect(solved.status).toBe("solved");
    expect(boardHtml(solved)).toContain("nar-cell exit on ok");
  });
});

describe("arrows beam summary", () => {
  it("reports connected, blocked and looping beams", () => {
    const summary = beamSummary(createLevelState(1));
    expect(summary.total).toBeGreaterThanOrEqual(1);
    expect(summary.connected + summary.blocked + summary.loop + summary.out).toBe(summary.total);
  });

  it("writes human readable status text", () => {
    expect(statusText(createLevelState(1))).toMatch(/beam|portal|locked in/i);
    expect(statusText(handmade())).toMatch(/escaping|looping|blocked|checkpoint|portal|locked/i);
  });
});

describe("arrows hud rendering", () => {
  it("shows beams, rotations, par and remaining budget", () => {
    const state: ArrowsState = { ...createLevelState(1), rotations: 2, maxRotations: 5 };
    const html = hudHtml(state);
    expect(html).toContain("nar-hud");
    expect(html).toContain("BEAMS");
    expect(html).toContain("ROTATIONS");
    expect(html).toContain("PAR");
    expect(html).toContain("BUDGET");
    expect(html).toContain(">3<");
  });

  it("shows an unlimited budget as free", () => {
    const html = hudHtml({ ...createLevelState(1), maxRotations: null });
    expect(html).toContain(">FREE<");
    expect(html).toContain("BUDGET");
  });

  it("renders a polite live region", () => {
    const html = liveStatusHtml("A beam is escaping the grid.");
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("A beam is escaping the grid.");
  });
});

describe("arrows stars", () => {
  it("renders filled and empty stars", () => {
    expect(starsText(0)).toBe("☆☆☆");
    expect(starsText(2)).toBe("★★☆");
    expect(starsText(9)).toBe("★★★");
  });
});

describe("arrows menu rendering", () => {
  it("renders the title, daily card, call to action and levels", () => {
    const html = menuHtml(menuView(), false);
    expect(html).toContain("NEON ARROWS");
    expect(html).toContain("STEER THE BEAM");
    expect(html).toContain("NEON ARROWS DAILY");
    expect(html).toContain("2026-09-15");
    expect(html).toContain("CONTINUE · LEVEL 3");
    expect(html).toContain("4 / 9 STARS");
    expect(html).toContain("6 BOARD RUN");
    expect(html).toContain("data-level");
    expect(html).toContain("locked");
  });

  it("marks a completed daily and applies reduced motion", () => {
    const html = menuHtml(menuView({ dailyDone: true, dailyBest: 3, dailyStreak: 4 }), true);
    expect(html).toContain("nar-daily-card done");
    expect(html).toContain("★★★");
    expect(html).toContain("nar-shell reduce");
  });

  it("labels the campaign start for fresh saves", () => {
    expect(menuHtml(menuView({ nextLevel: 1 }), false)).toContain("START · LEVEL 1");
  });
});

describe("arrows result rendering", () => {
  function view(over: Partial<ResultView> = {}): ResultView {
    return {
      mode: "level",
      level: 7,
      date: "",
      solved: true,
      score: 640,
      rotations: 12,
      par: 12,
      hints: 0,
      stars: 3,
      boards: 1,
      isBest: false,
      ranked: false,
      hasNext: true,
      ...over,
    };
  }

  it("renders a solved level with a next-level action", () => {
    const html = resultCardHtml(view());
    expect(html).toContain("BOARD SOLVED");
    expect(html).toContain("LEVEL 7");
    expect(html).toContain(">640<");
    expect(html).toContain("NEXT LEVEL");
    expect(html).toContain('aria-label="3 of 3 stars"');
    expect(html).toContain("PLAY AGAIN");
    expect(html).toContain("BACK TO ARCADE");
  });

  it("reports running out of rotations", () => {
    const html = resultCardHtml(view({ solved: false, stars: 0, score: 0, hasNext: false }));
    expect(html).toContain("OUT OF ROTATIONS");
    expect(html).not.toContain("NEXT LEVEL");
  });

  it("renders endless and daily summaries", () => {
    const endless = resultCardHtml(view({ mode: "endless", isBest: true, boards: 9 }));
    expect(endless).toContain("RUN OVER");
    expect(endless).toContain("NEW BEST");
    const daily = resultCardHtml(view({ mode: "daily", date: "2026-09-15", ranked: true }));
    expect(daily).toContain("DAILY COMPLETE");
    expect(daily).toContain("RANKED");
    expect(resultCardHtml(view({ mode: "daily", date: "2026-09-15", ranked: false }))).toContain("PRACTICE");
  });
});

describe("arrows play shell", () => {
  function body(): PlayBody {
    const state = createLevelState(1);
    return { board: boardHtml(state), status: liveStatusHtml("Route every beam to its portal.") };
  }

  it("renders a header, hint, restart, board and status", () => {
    const html = playShellHtml(createLevelState(1), "LEVEL 1", body(), false);
    expect(html).toContain("shell nar-shell");
    expect(html).toContain("NEON ARROWS");
    expect(html).toContain("nar-badge");
    expect(html).toContain(">LEVEL 1<");
    expect(html).toContain('data-act="menu"');
    expect(html).toContain('data-act="hint"');
    expect(html).toContain('data-act="restart"');
    expect(html).toContain("nar-board-frame");
    expect(html).toContain("nar-board-wrap");
    expect(html).toContain('id="arrows-status"');
  });

  it("carries the reduced motion class and mode labels", () => {
    expect(playShellHtml(createLevelState(1), "LEVEL 1", body(), true)).toContain("nar-shell reduce");
    const endless = createStateFrom(generateLevel(1), "endless");
    expect(modeLabel("endless", endless)).toBe("ENDLESS");
    expect(modeLabel("level", createLevelState(2))).toBe("LEVEL 2");
  });
});

describe("arrows help rendering", () => {
  it("explains the rules and controls", () => {
    const html = helpHtml(false);
    expect(html).toContain("HOW TO PLAY");
    expect(html).toContain("Tap a tile");
    expect(html).toContain("portal");
    expect(html).toContain("arrow keys");
    expect(html).toContain("par");
  });

  it("honours reduced motion", () => {
    expect(helpHtml(true)).toContain("nar-shell reduce");
  });
});
