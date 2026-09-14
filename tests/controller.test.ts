import { describe, expect, it } from "vitest";
import { createGame, doHint, doLaunch, openBoard, tapCell, tick } from "../src/game/controller";
import { DIR_RIGHT, DIR_UP, rotateDirection } from "../src/engine";
import { rotationAngle } from "../src/render/rotationAnim";

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

  it("cannot launch halfway through a rotation", () => {
    const game = createGame();
    openBoard(game, "story", 1);
    tapCell(game, 1, 1);
    expect(game.anim.rotating).not.toBeNull();
    doLaunch(game);
    expect(game.session!.phase).toBe("idle");
    expect(game.anim.rotating).not.toBeNull();
  });
});

describe("hint does not auto-rotate", () => {
  it("highlights a cell without changing the board", () => {
    const game = createGame();
    openBoard(game, "story", 5);
    const before = JSON.stringify(game.session!.cells);
    doHint(game);
    expect(game.session!.hint).not.toBeNull();
    expect(game.session!.rotations).toBe(0);
    expect(JSON.stringify(game.session!.cells)).toBe(before);
    expect(game.selected).toEqual({
      row: game.session!.hint!.row,
      col: game.session!.hint!.col,
    });
  });
});

describe("rotation interpolation", () => {
  it("renders the old direction at t=0, new at t=1, halfway between", () => {
    expect(rotationAngle(DIR_UP, DIR_RIGHT, 0)).toBe(0);
    expect(rotationAngle(DIR_UP, DIR_RIGHT, 1)).toBeCloseTo(Math.PI / 2, 10);
    expect(rotationAngle(DIR_UP, DIR_RIGHT, 0.5)).toBeCloseTo(Math.PI / 4, 10);
  });

  it("clamps progress outside [0,1]", () => {
    expect(rotationAngle(DIR_UP, DIR_RIGHT, -1)).toBe(0);
    expect(rotationAngle(DIR_UP, DIR_RIGHT, 2)).toBeCloseTo(Math.PI / 2, 10);
  });
});
