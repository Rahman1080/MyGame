import { describe, expect, it } from "vitest";
import {
  createMatrixGame,
  moveMatrix,
  undoMatrix,
  canMove,
} from "../src/games/matrix/engine";

describe("Cyber 2048 Matrix Engine", () => {
  it("initializes a 4x4 matrix with 2 random tiles", () => {
    const game = createMatrixGame(4, 1000);
    expect(game.size).toBe(4);
    expect(game.highScore).toBe(1000);
    expect(game.score).toBe(0);

    let count = 0;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (game.grid[r]![c] !== null) count++;
      }
    }
    expect(count).toBe(2);
  });

  it("slides and merges matching tiles to the left", () => {
    const game = createMatrixGame(4);
    game.grid = [
      [2, 2, 4, 4],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];

    const res = moveMatrix(game, "left", () => 0);
    expect(res.moved).toBe(true);
    expect(game.grid[0]![0]).toBe(4);
    expect(game.grid[0]![1]).toBe(8);
    expect(res.scoreGained).toBe(12); // (2+2) + (4+4)
    expect(game.score).toBe(12);
  });

  it("undo restores the previous grid and score", () => {
    const game = createMatrixGame(4);
    game.grid = [
      [2, 2, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ];
    game.score = 0;

    moveMatrix(game, "left", () => 0);
    expect(game.score).toBe(4);

    const undoSuccess = undoMatrix(game);
    expect(undoSuccess).toBe(true);
    expect(game.grid[0]![0]).toBe(2);
    expect(game.grid[0]![1]).toBe(2);
    expect(game.score).toBe(0);
  });

  it("detects when no moves are possible", () => {
    const game = createMatrixGame(2);
    game.grid = [
      [2, 4],
      [8, 16],
    ];
    expect(canMove(game)).toBe(false);

    // If there's an adjacent match, it can move
    game.grid = [
      [2, 2],
      [8, 16],
    ];
    expect(canMove(game)).toBe(true);
  });
});
