import { describe, expect, it } from "vitest";
import {
  addIndexToPath,
  clearPath,
  createWordConnectGame,
  shuffleWheel,
  submitCurrentWord,
  useHint,
} from "../src/games/wordconnect/engine";

describe("Neon Word Connect Engine", () => {
  it("initializes level 1 with target slots and letter nodes", () => {
    const game = createWordConnectGame(1, 500);
    expect(game.level).toBe(1);
    expect(game.highScore).toBe(500);
    expect(game.letters).toEqual(["A", "R", "T"]);
    expect(game.slots.length).toBe(3);
    expect(game.slots.every((s) => !s.solved)).toBe(true);
    expect(game.isCompleted).toBe(false);
  });

  it("builds letter path without duplicates and supports back-tracking", () => {
    const game = createWordConnectGame(1);
    // Add index 0 ('A'), then 1 ('R')
    expect(addIndexToPath(game, 0)).toBe(true);
    expect(addIndexToPath(game, 1)).toBe(true);
    expect(game.currentWord).toBe("AR");
    expect(game.activePath).toEqual([0, 1]);

    // Cannot add index 1 again
    expect(addIndexToPath(game, 1)).toBe(false);

    // Clicking previous index 0 unselects index 1 (backtracking)
    expect(addIndexToPath(game, 0)).toBe(true);
    expect(game.activePath).toEqual([0]);
    expect(game.currentWord).toBe("A");

    clearPath(game);
    expect(game.activePath.length).toBe(0);
    expect(game.currentWord).toBe("");
  });

  it("validates target words, fills slots, and detects completion", () => {
    const game = createWordConnectGame(1); // target words: ART, RAT, TAR

    // Solve "ART" (indices 0, 1, 2)
    addIndexToPath(game, 0); // A
    addIndexToPath(game, 1); // R
    addIndexToPath(game, 2); // T
    const res1 = submitCurrentWord(game);
    expect(res1.type).toBe("target");
    expect(res1.word).toBe("ART");
    expect(res1.scoreGained).toBe(300);
    expect(game.slots.find((s) => s.word === "ART")?.solved).toBe(true);

    // Submitting again returns 'already'
    addIndexToPath(game, 0);
    addIndexToPath(game, 1);
    addIndexToPath(game, 2);
    const resAgain = submitCurrentWord(game);
    expect(resAgain.type).toBe("already");

    // Solve "RAT"
    addIndexToPath(game, 1); // R
    addIndexToPath(game, 0); // A
    addIndexToPath(game, 2); // T
    submitCurrentWord(game);

    // Solve "TAR"
    addIndexToPath(game, 2); // T
    addIndexToPath(game, 0); // A
    addIndexToPath(game, 1); // R
    const res3 = submitCurrentWord(game);
    expect(res3.type).toBe("target");

    // All slots are now solved!
    expect(game.isCompleted).toBe(true);
    expect(game.score).toBeGreaterThan(900); // 3x300 + 300 level clear bonus
  });

  it("recognizes bonus words and awards extra points", () => {
    const game = createWordConnectGame(3); // Level 3 has bonus words: ALE, LAP, PAL, PEA
    // Letters: E, A, P, L (0: E, 1: A, 2: P, 3: L)
    // Spell "ALE": A (1), L (3), E (0)
    addIndexToPath(game, 1);
    addIndexToPath(game, 3);
    addIndexToPath(game, 0);
    const res = submitCurrentWord(game);
    expect(res.type).toBe("bonus");
    expect(res.word).toBe("ALE");
    expect(res.scoreGained).toBe(50);
    expect(game.foundBonusWords).toContain("ALE");
  });

  it("shuffles letter order and increases rotation angle", () => {
    const game = createWordConnectGame(2);
    const initialAngle = game.shuffleAngle;
    shuffleWheel(game, () => 0.5);
    expect(game.shuffleAngle).toBeGreaterThan(initialAngle);
  });

  it("reveals letters when hint is used", () => {
    const game = createWordConnectGame(1);
    expect(game.hintsRemaining).toBe(3);

    const hint = useHint(game);
    expect(hint).not.toBeNull();
    expect(game.hintsRemaining).toBe(2);

    const slot = game.slots[hint!.slotIndex]!;
    expect(slot.revealedLetters[hint!.charIndex]).toBe(hint!.char);
  });
});
