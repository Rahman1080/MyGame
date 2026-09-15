import { describe, expect, it } from "vitest";
import {
  GLYPH_HINT_PENALTY,
  GLYPH_LEVELS,
  MODIFIERS,
  canHint,
  emptyGlyphSave,
  expireTimer,
  finalResult,
  hintableLetters,
  isLevelFirstWin,
  isLevelUnlocked,
  isLevelSolved,
  keyboardState,
  levelAnswer,
  levelConfig,
  levelRecordFor,
  levelTier,
  nextLevel,
  recordGlyphLevelResult,
  recordGlyphResult,
  scoreGlyph,
  starsForGlyph,
  startLevel,
  submitGuess,
  takeHint,
  type GlyphState,
  buildLevelShare,
} from "../src/games/glyph/logic";
import { TIERS, TIER_LABELS, isExpired, timeLeftMs } from "../src/platform/levels";
import { ANSWER_WORDS } from "../src/games/glyph/words";
import { sanitizeV2, type GlyphSave } from "../src/save/schema";

function state(over: Partial<GlyphState> = {}): GlyphState {
  return { ...startLevel(1), ...over };
}

function solve(current: GlyphState): GlyphState {
  const outcome = submitGuess(current, current.answer);
  expect(outcome.accepted).toBe(true);
  return outcome.state;
}

describe("glyph level configs", () => {
  it("is deterministic", () => {
    for (const level of [1, 7, 52, 105]) {
      expect(levelConfig(level)).toEqual(levelConfig(level));
    }
  });

  it("produces 105 unique, valid answers", () => {
    const answers = new Set<string>();
    const curated = new Set(ANSWER_WORDS.map((entry) => entry.word));
    for (let level = 1; level <= GLYPH_LEVELS; level += 1) {
      const config = levelConfig(level);
      expect(config.answer).toHaveLength(5);
      expect(curated.has(config.answer)).toBe(true);
      answers.add(config.answer);
    }
    expect(answers.size).toBe(GLYPH_LEVELS);
  });

  it("clamps out of range levels", () => {
    expect(levelConfig(0).level).toBe(1);
    expect(levelConfig(999).level).toBe(GLYPH_LEVELS);
    expect(levelConfig(0).answer).toBe(levelAnswer(1));
    expect(levelConfig(999).answer).toBe(levelAnswer(GLYPH_LEVELS));
  });

  it("bands 15 levels per tier", () => {
    expect(levelTier(1)).toBe("easy");
    expect(levelTier(15)).toBe("easy");
    expect(levelTier(16)).toBe("normal");
    expect(levelTier(105)).toBe("mind");
  });

  it("shows the full modifier set across the ladder", () => {
    const seen = new Set<string>();
    for (let level = 1; level <= GLYPH_LEVELS; level += 1) seen.add(levelConfig(level).modifier);
    expect(seen).toEqual(new Set(MODIFIERS));
  });

  it("carries tier labels in order", () => {
    expect(TIERS).toHaveLength(7);
    expect(TIER_LABELS.mind).toBe("MIND BLOW");
  });
});

describe("glyph level state", () => {
  it("starts in level mode with the right identity", () => {
    const s = startLevel(3);
    expect(s.mode).toBe("level");
    expect(s.level).toBe(3);
    expect(s.date).toBe("level-3");
    expect(s.status).toBe("playing");
    expect(s.hinted).toEqual([]);
    expect(s.timedOut).toBe(false);
  });

  it("marks early levels untimed and later levels timed", () => {
    expect(startLevel(1).timeLimitMs).toBe(0);
    expect(startLevel(50).timeLimitMs).toBeGreaterThan(0);
  });
});

describe("glyph hints", () => {
  it("offers answer letters left to right, skipping known ones", () => {
    const known = submitGuess(state({ answer: "train" }), "tiger");
    expect(known.accepted).toBe(true);
    const hintable = hintableLetters(known.state);
    expect(hintable).toEqual(["r", "a", "i", "n"]);
  });

  it("never leaks an absent letter or a position", () => {
    const s = state({ answer: "train" });
    const hintable = hintableLetters(s);
    for (const letter of hintable) expect(s.answer.includes(letter)).toBe(true);
    expect(hintable).not.toContain("z");
  });

  it("skips letters already hinted", () => {
    let s = state({ answer: "train" });
    s = takeHint(s);
    expect(s.hinted).toEqual(["t"]);
    s = takeHint(s);
    expect(s.hinted).toEqual(["t", "r"]);
    expect(hintableLetters(s)).not.toContain("t");
  });

  it("de-duplicates repeated answer letters", () => {
    const s = state({ answer: "eerie" });
    expect(hintableLetters(s)).toEqual(["e", "r", "i"]);
  });

  it("exhausts without leaking and no-ops after", () => {
    let s = state({ answer: "train" });
    for (let i = 0; i < 5; i += 1) s = takeHint(s);
    expect(s.hinted).toHaveLength(5);
    expect(canHint(s)).toBe(false);
    expect(takeHint(s)).toBe(s);
  });

  it("refuses hints once finished", () => {
    const lost = { ...state({ answer: "train" }), status: "lost" as const };
    expect(canHint(lost)).toBe(false);
    expect(takeHint(lost)).toBe(lost);
  });

  it("refuses a fresh hint while ads are gated (caller decides)", () => {
    expect(canHint(state({ answer: "train" }))).toBe(true);
  });

  it("marks hinted letters on the keyboard", () => {
    const s = takeHint(state({ answer: "train" }));
    expect(keyboardState(s).t).toBe("hint");
  });
});

describe("glyph scoring with hints", () => {
  it("subtracts a penalty per hint", () => {
    const clean = solve(state({ answer: "train" }));
    const hinted = solve(takeHint(state({ answer: "train" })));
    expect(scoreGlyph(hinted)).toBe(scoreGlyph(clean) - GLYPH_HINT_PENALTY);
  });

  it("caps stars at two once hints are used", () => {
    const clean = solve(state({ answer: "train" }));
    const hinted = solve(takeHint(state({ answer: "train" })));
    expect(starsForGlyph(clean)).toBe(3);
    expect(starsForGlyph(hinted)).toBe(2);
  });
});

describe("glyph timers", () => {
  it("expires a timed level into a loss", () => {
    const s = state({ answer: "train", timeLimitMs: 1000 });
    expect(timeLeftMs(1000, 250)).toBe(750);
    expect(isExpired(1000, 1000)).toBe(true);
    const expired = expireTimer(s);
    expect(expired.status).toBe("lost");
    expect(expired.timedOut).toBe(true);
  });

  it("never expires untimed levels", () => {
    const s = state({ answer: "train", timeLimitMs: 0 });
    expect(expireTimer(s)).toBe(s);
  });
});

describe("glyph level progression", () => {
  it("unlocks sequentially and allows replay", () => {
    const save = emptyGlyphSave();
    expect(isLevelUnlocked(save, 1)).toBe(true);
    expect(isLevelUnlocked(save, 2)).toBe(false);
    expect(isLevelFirstWin(save, 1)).toBe(true);

    const result = finalResult(solve(startLevel(1)), 0, 4200);
    const after = recordGlyphLevelResult(save, result);
    expect(isLevelSolved(after, 1)).toBe(true);
    expect(isLevelUnlocked(after, 2)).toBe(true);
    expect(isLevelUnlocked(after, 3)).toBe(false);
    expect(isLevelFirstWin(after, 1)).toBe(false);
    expect(nextLevel(after, 1)).toBe(2);
    expect(nextLevel(after, 2)).toBe(2);
  });

  it("keeps best score, stars and attempt count", () => {
    const save = emptyGlyphSave();
    const result = finalResult(solve(startLevel(1)), 0, 4000);
    const once = recordGlyphLevelResult(save, result);
    const twice = recordGlyphLevelResult(once, { ...result, score: result.score + 5, stars: 3 });
    const record = levelRecordFor(twice, 1);
    expect(record?.attempts).toBe(2);
    expect(record?.best).toBe(result.score + 5);
    expect(record?.stars).toBe(3);
    expect(record?.won).toBe(true);
    expect(record?.bestTimeMs).toBe(4000);
  });

  it("records a loss without unlocking the next level", () => {
    const save = emptyGlyphSave();
    const lost = { ...solve(startLevel(1)), status: "lost" as const };
    const after = recordGlyphLevelResult(save, finalResult(lost, 0, 0));
    expect(levelRecordFor(after, 1)?.won).toBe(false);
    expect(isLevelUnlocked(after, 2)).toBe(false);
  });

  it("ignores daily results and invalid levels", () => {
    const save = emptyGlyphSave();
    const daily = finalResult(state({ mode: "daily", level: 0 }), 0);
    expect(recordGlyphLevelResult(save, daily)).toBe(save);
    const zero = { ...daily, mode: "level" as const, level: 0 };
    expect(recordGlyphLevelResult(save, zero)).toBe(save);
  });

  it("builds a level share without spoiling the answer", () => {
    const share = buildLevelShare(finalResult(solve(startLevel(1)), 0, 0));
    expect(share).toContain("GLYPH LEVEL 1");
    expect(share).toContain("CLEARED");
  });
});

describe("glyph save integration", () => {
  it("keeps levels in empty save and daily records carry hints", () => {
    const result = finalResult(solve(startLevel(1)), 0, 0);
    const save = recordGlyphLevelResult(emptyGlyphSave(), result);
    expect(save.levels["1"]).toBeDefined();
    const dailyState = takeHint({ ...startLevel(1), mode: "daily", level: 0, date: "2026-09-15" });
    const dailyResult = finalResult(solve(dailyState), 0);
    const withDaily = recordGlyphResult(save, dailyResult);
    expect(withDaily.daily["2026-09-15"]?.hints).toBe(1);
  });

  it("sanitizes a v1-style save without levels", () => {
    const migrated = sanitizeV2({ version: 2, games: { glyph: { wins: 4, daily: {} } } });
    expect(migrated.games.glyph.levels).toBeDefined();
    expect(migrated.games.glyph.levels["1"]).toBeUndefined();
  });

  it("sanitizes level records with clamped values", () => {
    const glyph = {
      levels: {
        "3": { won: true, stars: 99, best: -5, bestTimeMs: -1, hints: "x", attempts: 2 },
        zero: { won: true },
        "-2": { won: true },
      },
    };
    const save: GlyphSave = sanitizeV2({ version: 2, games: { glyph } }).games.glyph;
    expect(save.levels["3"]).toEqual({
      won: true,
      stars: 3,
      best: 0,
      bestTimeMs: null,
      hints: 0,
      attempts: 2,
    });
    expect(save.levels["zero"]).toBeUndefined();
    expect(save.levels["-2"]).toBeUndefined();
  });
});
