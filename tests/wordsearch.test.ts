import { describe, expect, it } from "vitest";
import {
  commitSelection,
  createWordSearchGame,
  generateWordGrid,
  getRayCells,
  requestHint,
  updateSelection,
} from "../src/games/wordsearch/engine";

describe("Neon Word Search Engine", () => {
  it("generates a valid grid with placed words", () => {
    const { grid, placedWords } = generateWordGrid(8, ["CYBER", "NEON", "PIXEL"]);
    expect(grid.length).toBe(8);
    expect(grid[0]!.length).toBe(8);
    expect(placedWords.length).toBeGreaterThan(0);

    // Verify all placed words have valid coordinates within grid
    for (const pw of placedWords) {
      expect(pw.start.r).toBeGreaterThanOrEqual(0);
      expect(pw.start.r).toBeLessThan(8);
      expect(pw.start.c).toBeGreaterThanOrEqual(0);
      expect(pw.start.c).toBeLessThan(8);
      expect(pw.end.r).toBeGreaterThanOrEqual(0);
      expect(pw.end.r).toBeLessThan(8);
      expect(pw.end.c).toBeGreaterThanOrEqual(0);
      expect(pw.end.c).toBeLessThan(8);
      expect(pw.found).toBe(false);

      // Verify letters of placed word exist in grid along ray
      const cells = getRayCells(pw.start, pw.end, 8);
      const extracted = cells.map((cell) => grid[cell.r]![cell.c]).join("");
      expect(extracted).toBe(pw.word);
    }
  });

  it("snaps selection rays to horizontal, vertical, and diagonal directions", () => {
    // Horizontal right
    const horiz = getRayCells({ r: 2, c: 1 }, { r: 2, c: 5 }, 8);
    expect(horiz.length).toBe(5);
    expect(horiz[0]).toEqual({ r: 2, c: 1 });
    expect(horiz[4]).toEqual({ r: 2, c: 5 });

    // Vertical down
    const vert = getRayCells({ r: 1, c: 3 }, { r: 5, c: 3 }, 8);
    expect(vert.length).toBe(5);
    expect(vert[0]).toEqual({ r: 1, c: 3 });
    expect(vert[4]).toEqual({ r: 5, c: 3 });

    // Diagonal down-right
    const diag = getRayCells({ r: 0, c: 0 }, { r: 3, c: 3 }, 8);
    expect(diag.length).toBe(4);
    expect(diag[0]).toEqual({ r: 0, c: 0 });
    expect(diag[3]).toEqual({ r: 3, c: 3 });
  });

  it("matches selection and marks word as found", () => {
    const game = createWordSearchGame(1, 0, 8);
    expect(game.placedWords.length).toBeGreaterThan(0);

    const targetWord = game.placedWords[0]!;
    expect(targetWord.found).toBe(false);

    // Select target word coordinates
    updateSelection(game, targetWord.start, targetWord.end);
    expect(game.activeSelection).not.toBeNull();
    expect(game.activeSelection!.currentWord).toBe(targetWord.word);

    const matched = commitSelection(game);
    expect(matched).not.toBeNull();
    expect(matched!.word).toBe(targetWord.word);
    expect(targetWord.found).toBe(true);
    expect(game.score).toBeGreaterThan(0);
  });

  it("matches selection in reverse drag direction", () => {
    const game = createWordSearchGame(1, 0, 8);
    const targetWord = game.placedWords[0]!;

    // Drag in reverse (from end to start)
    updateSelection(game, targetWord.end, targetWord.start);
    const matched = commitSelection(game);
    expect(matched).not.toBeNull();
    expect(matched!.word).toBe(targetWord.word);
    expect(targetWord.found).toBe(true);
  });

  it("rejects invalid word selections", () => {
    const game = createWordSearchGame(1, 0, 8);
    updateSelection(game, { r: 0, c: 0 }, { r: 0, c: 1 });
    // Unless by coincidence "0,0 to 0,1" is a 2-letter placed word (all placed words are length >= 4)
    const matched = commitSelection(game);
    expect(matched).toBeNull();
  });

  it("provides hint for unfound words", () => {
    const game = createWordSearchGame(1, 0, 8);
    const hint = requestHint(game);
    expect(hint).not.toBeNull();
    expect(hint).toEqual(game.placedWords[0]!.start);
    expect(game.hintCell).toEqual(hint);
    expect(game.hintTimerMs).toBeGreaterThan(0);
  });

  it("flags level completion when all words are found", () => {
    const game = createWordSearchGame(1, 0, 8);
    expect(game.isCompleted).toBe(false);

    for (const pw of game.placedWords) {
      updateSelection(game, pw.start, pw.end);
      commitSelection(game);
    }

    expect(game.isCompleted).toBe(true);
  });

  it("scales grids and word lengths for easy, hard, and master difficulties", () => {
    const easy = createWordSearchGame(1, 0, "easy");
    expect(easy.size).toBe(8);
    expect(easy.grid.length).toBe(8);

    const hard = createWordSearchGame(1, 0, "hard");
    expect(hard.size).toBe(10);
    expect(hard.grid.length).toBe(10);

    const master = createWordSearchGame(1, 0, "master");
    expect(master.size).toBe(12);
    expect(master.grid.length).toBe(12);
    // Master grid supports long tricky words (e.g. >= 8 characters)
    expect(master.placedWords.some((w) => w.word.length >= 8)).toBe(true);
  });
});
