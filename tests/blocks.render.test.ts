import { describe, expect, it } from "vitest";
import { createBoard, createState, idx, type Board, type BlocksState } from "../src/games/blocks/logic";
import { shapeById } from "../src/games/blocks/generate";
import {
  boardHtml,
  helpHtml,
  hudHtml,
  liveStatusHtml,
  menuHtml,
  pieceShapeHtml,
  playShellHtml,
  resultCardHtml,
  starsText,
  trayHtml,
  type MenuView,
  type ResultView,
} from "../src/games/blocks/render";

function shape(id: string) {
  const s = shapeById(id);
  if (!s) throw new Error(`missing shape ${id}`);
  return s;
}

function boardState(over: Partial<BlocksState> = {}): BlocksState {
  return { ...createState({ seed: "render-seed", mode: "endless" }), ...over };
}

function boardWith(filled: Array<[number, number, number]>, size = 8): Board {
  const b = createBoard(size);
  for (const [r, c, color] of filled) b[idx(size, r, c)] = color;
  return b;
}

describe("blocks board rendering", () => {
  it("renders a labelled empty grid", () => {
    const html = boardHtml(boardState());
    expect(html).toContain('role="grid"');
    expect(html).toContain('aria-label="Board, 8 by 8"');
    expect((html.match(/role="row"/g) ?? []).length).toBe(8);
    expect((html.match(/role="gridcell"/g) ?? []).length).toBe(64);
    expect((html.match(/class="neon-cell empty"/g) ?? []).length).toBe(64);
  });

  it("renders patterns and colour labels for filled cells", () => {
    const state = boardState({ board: boardWith([[0, 0, 2], [3, 4, 5]]) });
    const html = boardHtml(state);
    expect(html).toContain("neon-cell p2 pat2");
    expect(html).toContain("neon-cell p5 pat5");
    expect(html).toContain('aria-label="magenta block"');
    expect(html).toContain('aria-label="violet block"');
  });

  it("marks valid, invalid, clearing, settle and cursor states", () => {
    const html = boardHtml(boardState(), {
      preview: [idx(8, 0, 0)],
      invalidPreview: [idx(8, 1, 1)],
      clearing: [idx(8, 2, 2)],
      placed: [idx(8, 5, 5)],
      origins: [idx(8, 3, 3)],
      cursor: idx(8, 4, 4),
    });
    expect(html).toContain("neon-cell empty preview");
    expect(html).toContain("invalid");
    expect(html).toContain("clearing");
    expect(html).toContain("settle");
    expect(html).toContain("origin");
    expect(html).toContain("cursor");
  });

  it("can render an alternate board for clear animations", () => {
    const state = boardState();
    const stamped = boardWith([[7, 7, 1]]);
    const html = boardHtml(state, {}, stamped);
    expect(html).toContain("neon-cell p1 pat1");
  });
});

describe("blocks tray rendering", () => {
  it("renders three slots with piece labels", () => {
    const state = boardState({ pieces: [shape("line3h"), null, shape("dot")] });
    const html = trayHtml(state, null);
    expect((html.match(/neon-piece-slot/g) ?? []).length).toBe(3);
    expect(html).toContain('data-piece="0"');
    expect(html).toContain('data-piece="2"');
    expect(html).toContain('aria-label="3 across, cyan"');
    expect(html).toContain('aria-label="1 block, lime"');
    expect(html).toContain("neon-piece-slot empty");
  });

  it("marks the selected piece for assistive tech", () => {
    const state = boardState({ pieces: [shape("dot"), shape("dot"), shape("dot")] });
    const html = trayHtml(state, 1);
    expect(html).toContain('data-piece="1" aria-pressed="true"');
    expect(html).toContain("selected");
  });
});

describe("blocks shape rendering", () => {
  it("draws one mini cell per bounding box slot", () => {
    const html = pieceShapeHtml(shape("square2"));
    expect((html.match(/neon-mini/g) ?? []).length).toBe(4);
    expect(html).not.toContain("neon-mini off");
  });

  it("hides empty slots inside a piece bounding box", () => {
    const html = pieceShapeHtml(shape("L4a"));
    expect((html.match(/neon-mini off/g) ?? []).length).toBe(2);
    expect(html).toContain("grid-template-columns:repeat(2,1fr)");
  });
});

describe("blocks hud rendering", () => {
  it("shows score, best, lines and combo", () => {
    const state = boardState({ score: 120, lines: 3, combo: 2 });
    const html = hudHtml(state, 400);
    expect(html).toContain(">120<");
    expect(html).toContain(">400<");
    expect(html).toContain("x2");
    expect(html).toContain("neon-stat combo hot");
  });

  it("uses the running score when it beats the stored best", () => {
    const html = hudHtml(boardState({ score: 900 }), 400);
    expect(html).toContain(">900<");
  });

  it("renders a polite live region", () => {
    const html = liveStatusHtml("Cleared 2 lines!");
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Cleared 2 lines!");
  });
});

describe("blocks stars", () => {
  it("renders filled and empty stars", () => {
    expect(starsText(0)).toBe("☆☆☆");
    expect(starsText(2)).toBe("★★☆");
    expect(starsText(3)).toBe("★★★");
    expect(starsText(9)).toBe("★★★");
  });
});

describe("blocks menu rendering", () => {
  const view: MenuView = {
    date: "2026-09-15",
    best: 1234,
    bestCombo: 5,
    runs: 12,
    dailyRecord: null,
    dailyStreak: 0,
    dailyBest: 0,
  };

  it("renders the title, daily card and stats", () => {
    const html = menuHtml(view, false);
    expect(html).toContain("NEON BLOCKS");
    expect(html).toContain("BLOCK PUZZLE");
    expect(html).toContain("NEON BLOCKS DAILY");
    expect(html).toContain("2026-09-15");
    expect(html).toContain("BEST <b>1234</b>");
    expect(html).toContain("data-act=&quot;endless&quot;".replace(/&quot;/g, '"'));
    expect(html).toContain("shell neon-shell");
  });

  it("shows the stored daily result once played", () => {
    const html = menuHtml({ ...view, dailyRecord: { score: 480, lines: 7, stars: 1 }, dailyBest: 480 }, false);
    expect(html).toContain("TODAY 480 PTS");
    expect(html).toContain("DAILY BEST 480");
    expect(html).toContain("neon-daily-card done");
  });

  it("applies the reduced motion class", () => {
    expect(menuHtml(view, true)).toContain("neon-shell reduce");
  });
});

describe("blocks result rendering", () => {
  function view(over: Partial<ResultView> = {}): ResultView {
    return {
      mode: "endless",
      date: "",
      score: 900,
      lines: 10,
      bestCombo: 4,
      stars: 2,
      best: 900,
      isBest: true,
      ranked: false,
      dailyBest: 0,
      ...over,
    };
  }

  it("renders an endless best badge and stats", () => {
    const html = resultCardHtml(view());
    expect(html).toContain("GAME OVER");
    expect(html).toContain("NEW BEST");
    expect(html).toContain(">900<");
    expect(html).toContain(">10<");
    expect(html).toContain("x4");
    expect(html).toContain('aria-label="2 of 3 stars"');
    expect(html).toContain("PLAY AGAIN");
    expect(html).toContain("BACK TO ARCADE");
  });

  it("renders a ranked daily card", () => {
    const html = resultCardHtml(view({ mode: "daily", date: "2026-09-15", ranked: true, isBest: false }));
    expect(html).toContain("DAILY COMPLETE");
    expect(html).toContain("RANKED");
    expect(html).toContain("DAILY BEST 900");
  });

  it("marks a replayed daily as practice", () => {
    const html = resultCardHtml(view({ mode: "daily", date: "2026-09-15", ranked: false, isBest: false }));
    expect(html).toContain("PRACTICE");
    expect(html).not.toContain("RANKED");
  });
});

describe("blocks play shell", () => {
  function body() {
    return { board: boardHtml(boardState()), tray: trayHtml(boardState(), null), status: liveStatusHtml("Place a piece to begin.") };
  }

  it("renders a balanced header, stats, board, tray and status", () => {
    const html = playShellHtml(boardState(), 400, "ENDLESS", body(), false);
    expect(html).toContain("shell neon-shell");
    expect(html).toContain("NEON BLOCKS");
    expect(html).toContain("neon-badge");
    expect(html).toContain(">ENDLESS<");
    expect(html).toContain('data-act="menu"');
    expect(html).toContain('data-act="restart"');
    expect(html).toContain("neon-hud");
    expect(html).toContain("neon-board-frame");
    expect(html).toContain("neon-board-wrap");
    expect(html).toContain("neon-tray-wrap");
    expect(html).toContain("YOUR PIECES");
    expect(html).toContain('id="blocks-status"');
  });

  it("carries the reduced motion class", () => {
    expect(playShellHtml(boardState(), 0, "ENDLESS", body(), true)).toContain("neon-shell reduce");
  });
});

describe("blocks help rendering", () => {
  it("explains the rules and controls", () => {
    const html = helpHtml(false);
    expect(html).toContain("HOW TO PLAY");
    expect(html).toContain("Tap a piece");
    expect(html).toContain("Valid placement preview");
    expect(html).toContain("arrow keys");
  });
});
