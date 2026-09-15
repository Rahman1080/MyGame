import { describe, expect, it } from "vitest";
import type { GlyphState } from "../src/games/glyph/logic";
import {
  announceGuess,
  boardHtml,
  cluesHtml,
  keyboardHtml,
  modifierBannerHtml,
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
});
