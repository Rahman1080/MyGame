import { describe, expect, it } from "vitest";
import type { GlyphState } from "../src/games/glyph/logic";
import { emptyGlyphSave } from "../src/games/glyph/logic";
import type { GlyphSave } from "../src/save/schema";
import {
  announceGuess,
  boardHtml,
  cluesHtml,
  hintButtonHtml,
  hintChipsHtml,
  keyboardHtml,
  levelGridHtml,
  levelHeaderHtml,
  modifierBannerHtml,
  timerHtml,
} from "../src/games/glyph/render";

function state(over: Partial<GlyphState> = {}): GlyphState {
  return {
    date: "2026-09-15",
    answer: "train",
    category: "object",
    modifier: "clear",
    maxGuesses: 6,
    guesses: [],
    status: "playing",
    energy: 0,
    clues: [],
    doubleLetter: null,
    doubleHit: false,
    categoryRevealed: false,
    mode: "daily",
    level: 0,
    hinted: [],
    timeLimitMs: 0,
    timedOut: false,
    ...over,
  };
}

function tileClasses(html: string): string[] {
  return Array.from(html.matchAll(/class="glyph-tile ([a-z]+)"/g), (m) => m[1]!);
}

describe("glyph board rendering", () => {
  it("renders six rows of five tiles", () => {
    const html = boardHtml(state(), "");
    expect((html.match(/glyph-row/g) ?? []).length).toBe(6);
    expect(tileClasses(html)).toHaveLength(30);
    expect(new Set(tileClasses(html))).toEqual(new Set(["empty"]));
  });

  it("renders a typed draft as visible, non-empty tiles", () => {
    const html = boardHtml(state(), "sta");
    const classes = tileClasses(html);
    expect(classes.filter((c) => c === "draft")).toHaveLength(3);
    expect(classes.filter((c) => c === "empty")).toHaveLength(27);
    expect(html).toContain('aria-label="S pending"');
    expect(html).toContain(">S<");
    expect(html).toContain(">T<");
    expect(html).toContain(">A<");
  });

  it("renders evaluated guesses with marks and symbols", () => {
    const html = boardHtml(
      state({
        guesses: [{ word: "stair", marks: ["absent", "present", "correct", "correct", "present"] }],
      }),
      "",
    );
    const classes = tileClasses(html);
    expect(classes.slice(0, 5)).toEqual(["absent", "present", "correct", "correct", "present"]);
    expect(html).toContain('aria-label="T present"');
    expect(html).toContain("✓");
    expect(html).toContain("~");
  });

  it("does not render a draft row once the game is finished", () => {
    const html = boardHtml(state({ status: "won", guesses: [{ word: "train", marks: ["correct", "correct", "correct", "correct", "correct"] }] }), "ab");
    expect(html).not.toContain("draft");
  });
});

describe("glyph keyboard rendering", () => {
  it("renders 26 letters plus enter and back", () => {
    const html = keyboardHtml(state());
    expect((html.match(/data-key=/g) ?? []).length).toBe(28);
    expect(html).toContain('data-key="enter"');
    expect(html).toContain('data-key="back"');
  });

  it("reflects the best known mark per key", () => {
    const html = keyboardHtml(state({ guesses: [{ word: "stair", marks: ["absent", "present", "correct", "correct", "present"] }] }));
    expect(html).toContain('class="glyph-key absent" data-key="s"');
    expect(html).toContain('class="glyph-key correct" data-key="a"');
    expect(html).toContain('aria-label="A, correct"');
  });
});

describe("glyph modifier rendering", () => {
  it("shows an energy meter on energy days", () => {
    expect(modifierBannerHtml(state({ modifier: "energy", energy: 6 }))).toContain("ENERGY 6");
  });

  it("shows the category only once revealed", () => {
    expect(modifierBannerHtml(state({ modifier: "category" }))).not.toContain("OBJECT");
    expect(modifierBannerHtml(state({ modifier: "category", categoryRevealed: true }))).toContain("OBJECT");
  });

  it("lists revealed clues", () => {
    expect(cluesHtml(state())).toBe("");
    const html = cluesHtml(state({ clues: [{ index: 0, letter: "t" }] }));
    expect(html).toContain("1: T");
  });
});

describe("glyph announcements", () => {
  it("summarises the latest guess for screen readers", () => {
    const message = announceGuess(
      state({ guesses: [{ word: "stair", marks: ["absent", "present", "correct", "correct", "present"] }] }),
    );
    expect(message).toContain("STAIR");
    expect(message).toContain("2 correct");
    expect(message).toContain("2 present");
    expect(message).toContain("1 absent");
    expect(message).toContain("5 guesses left");
  });

  it("reveals the answer only after a loss", () => {
    const lost = state({
      status: "lost",
      guesses: [{ word: "stair", marks: ["absent", "present", "correct", "correct", "present"] }],
    });
    expect(announceGuess(lost)).toContain("TRAIN");
    expect(announceGuess(state())).not.toContain("TRAIN");
  });

  it("explains a timeout loss", () => {
    const timedOut = state({ status: "lost", timedOut: true });
    expect(announceGuess(timedOut)).toContain("Time ran out");
  });
});

describe("glyph hint rendering", () => {
  it("hides the chip row until a hint is taken", () => {
    expect(hintChipsHtml(state())).toBe("");
  });

  it("shows taken letters as IN THE WORD chips", () => {
    const html = hintChipsHtml(state({ hinted: ["t", "r"] }));
    expect(html).toContain("IN THE WORD");
    expect(html).toContain(">T<");
    expect(html).toContain(">R<");
  });

  it("renders a hint button and disables it once exhausted", () => {
    expect(hintButtonHtml(state())).toContain('data-action="hint"');
    expect(hintButtonHtml(state())).not.toContain("disabled");
    expect(hintButtonHtml(state({ hinted: ["t", "r", "a", "i", "n"] }))).toContain("disabled");
  });

  it("marks hinted keys as hint", () => {
    const html = keyboardHtml(state({ hinted: ["t"] }));
    expect(html).toContain('class="glyph-key hint" data-key="t"');
    expect(html).toContain('aria-label="T, in the word"');
  });
});

describe("glyph timer rendering", () => {
  it("renders nothing on untimed levels", () => {
    expect(timerHtml(state({ timeLimitMs: 0 }), 0)).toBe("");
  });

  it("renders a bar and clock on timed levels", () => {
    const html = timerHtml(state({ timeLimitMs: 60000 }), 30000);
    expect(html).toContain("glyph-timer-bar");
    expect(html).toContain("0:30");
    expect(html).toContain('role="timer"');
  });

  it("flags the low-time state", () => {
    expect(timerHtml(state({ timeLimitMs: 60000 }), 5000)).toContain("glyph-timer low");
  });
});

describe("glyph level grid rendering", () => {
  const save: GlyphSave = {
    ...emptyGlyphSave(),
    levels: {
      "1": { won: true, stars: 3, best: 200, bestTimeMs: 4000, hints: 0, attempts: 1 },
      "2": { won: false, stars: 0, best: 40, bestTimeMs: null, hints: 1, attempts: 2 },
    },
  };

  it("renders seven tier sections and 105 tiles", () => {
    const html = levelGridHtml(save);
    expect((html.match(/glyph-tier-name/g) ?? []).length).toBe(7);
    expect((html.match(/data-level=/g) ?? []).length).toBe(105);
    expect(html).toContain("EASY");
    expect(html).toContain("MIND BLOW");
  });

  it("marks solved, unlocked and locked tiles", () => {
    const html = levelGridHtml(save);
    expect(html).toContain('class="glyph-level-tile solved" data-level="1"');
    expect(html).toContain('class="glyph-level-tile" data-level="2"');
    expect(html).toContain('class="glyph-level-tile locked" data-level="3"');
    expect(html).toContain("Level 3, EASY, locked");
  });

  it("describes solved tiles for assistive tech", () => {
    const html = levelGridHtml(save);
    expect(html).toContain("Level 1, EASY, solved, 3 stars, best 200 points");
  });

  it("shows the level header only in level mode", () => {
    expect(levelHeaderHtml(state({ mode: "daily", level: 0 }))).toBe("");
    const html = levelHeaderHtml(state({ mode: "level", level: 16 }));
    expect(html).toContain("LEVEL 16");
    expect(html).toContain("NORMAL");
  });
});
