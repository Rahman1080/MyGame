import { describe, expect, it } from "vitest";
import { createGame, openBoard, tapCell, tick } from "../src/game/controller";
import { rotateDirection } from "../src/engine";

describe("rotation animation state", () => {
  it("stores OLD and NEW directions for a clockwise step", () => {
    const game = createGame();
    openBoard(game, "story", 1);
    const cell = game.session!.cells.find((c) => c.row === 1 && c.col === 1)!;
    const from = cell.direction!;
    expect(tapCell(game, 1, 1)).toBe(true);
    const rot = game.anim.rotating;
    expect(rot).not.toBeNull();
    expect(rot!.fromDirection).toBe(from);
    expect(rot!.toDirection).toBe(rotateDirection(from, 1));
    expect(rot!.t).toBe(0);
    expect(game.session!.cells.find((c) => c.row === 1 && c.col === 1)!.direction).toBe(
      rotateDirection(from, 1),
    );
  });

  it("snaps instantly under reduced motion", () => {
    const game = createGame();
    game.reduced = true;
    openBoard(game, "story", 1);
    expect(tapCell(game, 1, 1)).toBe(true);
    expect(game.anim.rotating).toBeNull();
  });

  it("completes after ~120ms", () => {
    const game = createGame();
    openBoard(game, "story", 1);
    tapCell(game, 1, 1);
    tick(game, 60);
    expect(game.anim.rotating?.t).toBeCloseTo(0.5, 5);
    tick(game, 60);
    expect(game.anim.rotating).toBeNull();
  });
});
