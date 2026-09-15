import { describe, expect, it } from "vitest";
import {
  ANSWER_WORDS,
  EXTRA_VALID,
  VALID_WORDS,
} from "../src/games/glyph/words";
import {
  GLYPH_MAX_CLUES,
  GLYPH_MAX_GUESSES,
  GLYPH_SCORE,
  MODIFIERS,
  MODIFIER_HELP,
  MODIFIER_LABELS,
  buildShare,
  categoryFor,
  dailyConfig,
  dailyRecordFor,
  doubledLetter,
  emptyGlyphSave,
  evaluateGuess,
  finalResult,
  isDailyDone,
  isFinished,
  isValidWord,
  keyboardState,
  normalizeWord,
  recordGlyphResult,
  remainingGuesses,
  scoreGlyph,
  starsForGlyph,
  startDaily,
  submitGuess,
  validWordCount,
  type GlyphState,
} from "../src/games/glyph/logic";
import { isDateString, sanitizeV2, type GlyphSave } from "../src/save/schema";
import { dailySeed } from "../src/platform/dailySeed";
import { xpForGame } from "../src/platform/progression";
import { findGame } from "../src/platform/registry";

function state(over: Partial<GlyphState> = {}): GlyphState {
  return {
    date: "2026-01-01",
    answer: "train",
    category: "object",
    modifier: "clear",
    maxGuesses: GLYPH_MAX_GUESSES,
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

function play(current: GlyphState, words: string[]): GlyphState {
  let s = current;
  for (const word of words) {
    const outcome = submitGuess(s, word);
    expect(outcome.accepted).toBe(true);
    s = outcome.state;
  }
  return s;
}

describe("glyph word data", () => {
  it("keeps every answer a well-formed five letter word", () => {
    for (const entry of ANSWER_WORDS) {
      expect(entry.word).toMatch(/^[a-z]{5}$/);
      expect(entry.category.length).toBeGreaterThan(0);
    }
  });

  it("has unique answers and unique valid guess words", () => {
    const answers = ANSWER_WORDS.map((e) => e.word);
    expect(new Set(answers).size).toBe(answers.length);
    expect(new Set(VALID_WORDS).size).toBe(VALID_WORDS.length);
  });

  it("includes every answer in the valid guess dictionary", () => {
    for (const entry of ANSWER_WORDS) expect(isValidWord(entry.word)).toBe(true);
    expect(validWordCount()).toBeGreaterThanOrEqual(ANSWER_WORDS.length);
  });

  it("keeps extra valid guesses well formed", () => {
    for (const word of EXTRA_VALID) expect(word).toMatch(/^[a-z]{5}$/);
  });
});

describe("glyph word normalization", () => {
  it("accepts and lowercases well formed words", () => {
    expect(normalizeWord("  Train ")).toBe("train");
    expect(normalizeWord("CRANE")).toBe("crane");
  });

  it("rejects non-words and wrong lengths", () => {
    expect(normalizeWord("four")).toBeNull();
    expect(normalizeWord("sixsix")).toBeNull();
    expect(normalizeWord("tr4in")).toBeNull();
    expect(normalizeWord("")).toBeNull();
    expect(normalizeWord(42)).toBeNull();
    expect(normalizeWord(null)).toBeNull();
  });
});

describe("glyph two-pass duplicate evaluation", () => {
  it("marks exact matches", () => {
    expect(evaluateGuess("train", "train")).toEqual(["correct", "correct", "correct", "correct", "correct"]);
  });

  it("marks absent letters", () => {
    expect(evaluateGuess("train", "cough")).toEqual(["absent", "absent", "absent", "absent", "absent"]);
  });

  it("marks present letters in the wrong position", () => {
    expect(evaluateGuess("train", "stair")).toEqual(["absent", "present", "correct", "correct", "present"]);
  });

  it("never over-credits a duplicate in the guess", () => {
    expect(evaluateGuess("abbey", "kebab")).toEqual(["absent", "present", "correct", "present", "present"]);
  });

  it("leaves surplus duplicates absent once the answer count is spent", () => {
    expect(evaluateGuess("abbey", "bobby")).toEqual(["present", "absent", "correct", "absent", "correct"]);
  });

  it("handles the guess having more duplicates than the answer", () => {
    expect(evaluateGuess("trees", "eerie")).toEqual(["present", "present", "present", "absent", "absent"]);
  });

  it("gives green priority over yellow for duplicates", () => {
    expect(evaluateGuess("apple", "puppy")).toEqual(["present", "absent", "correct", "absent", "absent"]);
  });
});

describe("glyph guess validation", () => {
  it("rejects guesses that are too short or too long", () => {
    expect(submitGuess(state(), "four").error).toBe("length");
    expect(submitGuess(state(), "sixten").error).toBe("length");
    expect(submitGuess(state(), "").error).toBe("length");
  });

  it("rejects guesses containing non-letters", () => {
    expect(submitGuess(state(), "tr4in").error).toBe("letters");
    expect(submitGuess(state(), "tra n").error).toBe("letters");
    expect(submitGuess(state(), 7).error).toBe("letters");
  });

  it("rejects words outside the dictionary", () => {
    expect(submitGuess(state(), "zzzzz").error).toBe("unknown");
    expect(submitGuess(state(), "qwert").error).toBe("unknown");
  });

  it("accepts a valid guess and records its marks", () => {
    const outcome = submitGuess(state(), "stair");
    expect(outcome.accepted).toBe(true);
    expect(outcome.error).toBeNull();
    expect(outcome.state.guesses).toHaveLength(1);
    expect(outcome.state.status).toBe("playing");
  });

  it("does not accept guesses after the game has finished", () => {
    const done = { ...state(), status: "won" as const };
    expect(submitGuess(done, "stair").error).toBe("finished");
  });
});

describe("glyph win and loss", () => {
  it("wins on an exact guess and stops accepting input", () => {
    const won = play(state(), ["train"]);
    expect(won.status).toBe("won");
    expect(isFinished(won)).toBe(true);
    expect(remainingGuesses(won)).toBe(GLYPH_MAX_GUESSES - 1);
    expect(submitGuess(won, "stair").error).toBe("finished");
  });

  it("loses after six guesses", () => {
    const lost = play(state(), Array.from({ length: GLYPH_MAX_GUESSES }, () => "stair"));
    expect(lost.status).toBe("lost");
    expect(remainingGuesses(lost)).toBe(0);
    expect(isFinished(lost)).toBe(true);
  });

  it("does not lose early while guesses remain", () => {
    const mid = play(state(), ["stair", "stair", "stair"]);
    expect(mid.status).toBe("playing");
    expect(remainingGuesses(mid)).toBe(3);
  });
});

describe("glyph scoring and stars", () => {
  it("scores a first-guess solve with the perfect bonus", () => {
    const won = play(state(), ["train"]);
    const expected = GLYPH_SCORE.winBase + 5 * GLYPH_SCORE.perGuessLeft + GLYPH_SCORE.perfect;
    expect(scoreGlyph(won)).toBe(expected);
    expect(starsForGlyph(won)).toBe(3);
  });

  it("scores lower when more guesses are used", () => {
    const fast = play(state(), ["train"]);
    const slow = play(state(), ["stair", "stair", "stair", "train"]);
    expect(scoreGlyph(slow)).toBeLessThan(scoreGlyph(fast));
    expect(starsForGlyph(slow)).toBe(2);
  });

  it("awards one star for a late solve and none for a loss", () => {
    const late = play(state(), ["stair", "stair", "stair", "stair", "train"]);
    expect(starsForGlyph(late)).toBe(1);
    const lost = play(state(), Array.from({ length: GLYPH_MAX_GUESSES }, () => "stair"));
    expect(starsForGlyph(lost)).toBe(0);
    expect(scoreGlyph(lost)).toBe(GLYPH_SCORE.lossBase);
  });

  it("adds a bounded streak bonus", () => {
    const won = play(state(), ["stair", "train"]);
    expect(scoreGlyph(won, 3)).toBe(scoreGlyph(won, 0) + 3 * GLYPH_SCORE.streakStep);
    expect(scoreGlyph(won, 999)).toBe(scoreGlyph(won, 0) + GLYPH_SCORE.streakMax * GLYPH_SCORE.streakStep);
  });

  it("reports XP from the final result via the shared progression curve", () => {
    const result = finalResult(play(state(), ["train"]));
    expect(xpForGame({ score: result.score, stars: result.stars, solved: result.won })).toBeGreaterThan(0);
  });
});

describe("glyph daily determinism", () => {
  it("derives the answer from the shared daily seed", () => {
    expect(dailySeed("2026-09-15", "glyph")).toBe("daily:glyph:2026-09-15");
  });

  it("returns the same config for the same date", () => {
    expect(dailyConfig("2026-09-15")).toEqual(dailyConfig("2026-09-15"));
    expect(startDaily("2026-09-15")).toEqual(startDaily("2026-09-15"));
  });

  it("varies answers and modifiers across a span of days", () => {
    const answers = new Set<string>();
    const modifiers = new Set<string>();
    for (let day = 1; day <= 28; day += 1) {
      const date = `2026-02-${String(day).padStart(2, "0")}`;
      const config = dailyConfig(date);
      answers.add(config.answer);
      modifiers.add(config.modifier);
      expect(isValidWord(config.answer)).toBe(true);
      expect(MODIFIERS).toContain(config.modifier);
    }
    expect(answers.size).toBeGreaterThan(10);
    expect(modifiers.size).toBeGreaterThan(1);
  });

  it("produces a different daily puzzle for a different date", () => {
    const a = dailyConfig("2026-09-15");
    const b = dailyConfig("2026-09-16");
    expect(a.answer === b.answer && a.modifier === b.modifier).toBe(false);
  });

  it("exposes labels and help for every modifier", () => {
    for (const modifier of MODIFIERS) {
      expect(MODIFIER_LABELS[modifier].length).toBeGreaterThan(0);
      expect(MODIFIER_HELP[modifier].length).toBeGreaterThan(0);
    }
  });
});

describe("glyph modifier rules", () => {
  it("keeps clear days free of modifiers", () => {
    const next = play(state({ modifier: "clear", answer: "train" }), ["stair"]);
    expect(next.doubleLetter).toBeNull();
    expect(next.doubleHit).toBe(false);
    expect(next.energy).toBe(0);
    expect(next.clues).toHaveLength(0);
    expect(next.categoryRevealed).toBe(false);
  });

  it("reveals the category after the first guess only on category days", () => {
    const next = play(state({ modifier: "category", answer: "train" }), ["stair"]);
    expect(next.categoryRevealed).toBe(true);
    expect(categoryFor("train")).toBe("object");
  });

  it("flags a repeated answer letter on double letter days", () => {
    const withDouble = state({ modifier: "double", answer: "abbey", doubleLetter: "b" });
    expect(doubledLetter("abbey")).toBe("b");
    expect(doubledLetter("train")).toBeNull();
    const hit = play(withDouble, ["kebab"]);
    expect(hit.doubleHit).toBe(true);
    const missed = play(withDouble, ["stair"]);
    expect(missed.doubleHit).toBe(false);
  });

  it("adds a double point bonus only when the pair is matched", () => {
    const marks = ["correct", "correct", "correct", "correct", "correct"] as const;
    const guesses = [{ word: "abbey", marks: [...marks] }];
    const withBonus = state({
      modifier: "double",
      answer: "abbey",
      doubleLetter: "b",
      doubleHit: true,
      status: "won",
      guesses,
    });
    const without = state({
      modifier: "double",
      answer: "abbey",
      doubleLetter: null,
      doubleHit: false,
      status: "won",
      guesses,
    });
    expect(scoreGlyph(withBonus)).toBe(scoreGlyph(without) + GLYPH_SCORE.doubleBonus);
  });

  it("builds energy and grants bounded clues on letter energy days", () => {
    const one = play(state({ modifier: "energy", answer: "train" }), ["stair"]);
    expect(one.energy).toBe(4);
    expect(one.clues).toHaveLength(0);
    const two = play(state({ modifier: "energy", answer: "train" }), ["stair", "stair"]);
    expect(two.energy).toBe(0);
    expect(two.clues).toEqual([{ index: 0, letter: "t" }]);
    const many = play(
      state({ modifier: "energy", answer: "train" }),
      ["stair", "stair", "stair", "stair", "stair"],
    );
    expect(many.clues).toHaveLength(GLYPH_MAX_CLUES);
    expect(many.clues[1]).toEqual({ index: 1, letter: "r" });
  });
});

describe("glyph keyboard state", () => {
  it("keeps the best known mark per letter", () => {
    const kb = keyboardState(play(state(), ["stair", "train"]));
    expect(kb.s).toBe("absent");
    expect(kb.t).toBe("correct");
    expect(kb.a).toBe("correct");
  });
});

describe("glyph share output", () => {
  it("renders an original, spoiler free, text only result", () => {
    const won = play(state({ date: "2026-09-15", answer: "train" }), ["stair", "train"]);
    const share = buildShare(won, 4);
    expect(share).toContain("GLYPH 2026-09-15");
    expect(share).toContain(MODIFIER_LABELS.clear);
    expect(share).toContain("2/6");
    expect(share).toContain("streak 4");
    expect(share).toContain("GLOWTRAIL ARCADE");
    expect(share).not.toContain("train");
    expect(share).toMatch(/^[\x20-\x7E\n]+$/);
    expect(share.trim().split("\n")).toHaveLength(2 + 2 + 1 + 1);
  });

  it("marks a loss without revealing the answer", () => {
    const lost = play(state(), Array.from({ length: GLYPH_MAX_GUESSES }, () => "stair"));
    const share = buildShare(lost);
    expect(share).toContain("X/6");
    expect(share).not.toContain("train");
  });
});

describe("glyph save slice", () => {
  it("starts empty", () => {
    const save = emptyGlyphSave();
    expect(save.wins).toBe(0);
    expect(save.streak).toBe(0);
    expect(save.daily).toEqual({});
  });

  it("records a win, streak and best result", () => {
    const result = finalResult(play(state({ date: "2026-09-15" }), ["stair", "train"]), 0);
    const save = recordGlyphResult(emptyGlyphSave(), result);
    expect(save.wins).toBe(1);
    expect(save.losses).toBe(0);
    expect(save.streak).toBe(1);
    expect(save.bestStreak).toBe(1);
    expect(save.bestGuesses).toBe(2);
    expect(save.playDates).toEqual(["2026-09-15"]);
    expect(save.lastResult).toContain("SOLVED 2/6");
    expect(isDailyDone(save, "2026-09-15")).toBe(true);
    expect(dailyRecordFor(save, "2026-09-15")?.won).toBe(true);
  });

  it("is idempotent for an already completed daily", () => {
    const result = finalResult(play(state({ date: "2026-09-15" }), ["train"]));
    const once = recordGlyphResult(emptyGlyphSave(), result);
    const twice = recordGlyphResult(once, result);
    expect(twice).toBe(once);
    expect(twice.wins).toBe(1);
  });

  it("resets the streak on a loss and tracks the best streak", () => {
    const win = finalResult(play(state({ date: "2026-09-15" }), ["train"]));
    const loss = finalResult(
      play(state({ date: "2026-09-16" }), Array.from({ length: GLYPH_MAX_GUESSES }, () => "stair")),
    );
    const afterWin = recordGlyphResult(emptyGlyphSave(), win);
    const afterLoss = recordGlyphResult(afterWin, loss);
    expect(afterLoss.losses).toBe(1);
    expect(afterLoss.streak).toBe(0);
    expect(afterLoss.bestStreak).toBe(1);
    expect(isDailyDone(afterLoss, "2026-09-16")).toBe(true);
  });

  it("keeps a completed daily locked for reward purposes", () => {
    const result = finalResult(play(state({ date: "2026-09-15" }), ["train"]));
    const save: GlyphSave = recordGlyphResult(emptyGlyphSave(), result);
    expect(isDailyDone(save, "2026-09-15")).toBe(true);
    expect(isDailyDone(save, "2026-09-17")).toBe(false);
  });

  it("migrates a legacy v2 glyph slice without losing wins", () => {
    const legacy = {
      version: 2,
      profile: {},
      games: { glyph: { wins: 3, playDates: ["2026-01-01"], lastResult: "SOLVED 2/6 - 190 pts" } },
    };
    const save = sanitizeV2(legacy);
    expect(save.games.glyph.wins).toBe(3);
    expect(save.games.glyph.playDates).toEqual(["2026-01-01"]);
    expect(save.games.glyph.losses).toBe(0);
    expect(save.games.glyph.daily).toEqual({});
    expect(isDateString("2026-01-01")).toBe(true);
  });
});

describe("glyph registry and adapter", () => {
  it("registers glyph as ready with a lazy loader", () => {
    const desc = findGame("glyph");
    expect(desc?.meta.status).toBe("ready");
    expect(desc?.meta.hasGauntlet).toBe(false);
    expect(typeof desc?.load).toBe("function");
  });

  it("loads the adapter with a deterministic daily config", async () => {
    const desc = findGame("glyph");
    const mod = await desc!.load!();
    const game = mod.default;
    expect(game.meta.id).toBe("glyph");
    expect(game.daily("daily:glyph:2026-09-15")).toEqual({ date: "2026-09-15", seed: "daily:glyph:2026-09-15" });
  });
});
