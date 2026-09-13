import { describe, expect, it } from "vitest";
import { canonicalPar, minimumRotationSolver, puzzleHasWarpMechanics } from "../src/engine";
import { DIR_DOWN, DIR_RIGHT, DIR_UP } from "../src/engine/types";
import type { Cell, Coord, Puzzle } from "../src/engine/types";
import { generateLevel } from "../src/gen/generator";
import { cell, fillGrid } from "./helpers";

function build(
  size: number,
  placed: Cell[],
  start: Coord,
  exit: Coord,
  pack = "wormhole",
): Puzzle {
  return {
    id: "solver-mechanics",
    seed: 1,
    size,
    cells: fillGrid(size, placed),
    start,
    exit,
    par: 0,
    difficulty: 1,
    pack,
  };
}

describe("puzzleHasWarpMechanics", () => {
  it("detects portals and walls", () => {
    const portal = build(
      3,
      [cell(0, 0, "start", DIR_RIGHT), cell(1, 1, "portal", undefined, { portalId: "p1", portalSide: "a" })],
      { row: 0, col: 0 },
      { row: 2, col: 2 },
    );
    const wall = build(
      3,
      [cell(0, 0, "start", DIR_RIGHT), cell(1, 1, "wall", undefined, { wallDir: DIR_RIGHT })],
      { row: 0, col: 0 },
      { row: 2, col: 2 },
      "vector",
    );
    expect(puzzleHasWarpMechanics(portal)).toBe(true);
    expect(puzzleHasWarpMechanics(wall)).toBe(true);
    expect(puzzleHasWarpMechanics(build(3, [cell(0, 0, "start", DIR_RIGHT)], { row: 0, col: 0 }, { row: 2, col: 2 }, "pulse"))).toBe(false);
  });
});

describe("warp minimum solver", () => {
  it("finds a cheaper portal route than the canonical route", () => {
    const p = build(
      3,
      [
        cell(0, 0, "start", DIR_RIGHT),
        cell(0, 1, "portal", undefined, { portalId: "p1", portalSide: "a" }),
        cell(2, 1, "portal", undefined, { portalId: "p1", portalSide: "b" }),
        cell(2, 2, "exit"),
        cell(1, 0, "arrow", DIR_UP, { canonicalDir: DIR_DOWN, required: false }),
      ],
      { row: 0, col: 0 },
      { row: 2, col: 2 },
    );
    const r = minimumRotationSolver(p);
    expect(r.exact).toBe(true);
    expect(r.solvable).toBe(true);
    expect(r.rotations).toBe(0);
    expect(r.rotations).toBeLessThan(canonicalPar(p.cells));
  });

  it("solves a wall maze and rotates the cell before the exit", () => {
    const p = build(
      3,
      [
        cell(0, 0, "start", DIR_RIGHT),
        cell(0, 1, "wall", undefined, { wallDir: DIR_RIGHT }),
        cell(0, 2, "arrow", DIR_RIGHT, { canonicalDir: DIR_DOWN }),
        cell(1, 2, "arrow", DIR_DOWN),
        cell(2, 2, "exit"),
      ],
      { row: 0, col: 0 },
      { row: 2, col: 2 },
      "vector",
    );
    const r = minimumRotationSolver(p);
    expect(r.exact).toBe(true);
    expect(r.solvable).toBe(true);
    expect(r.rotations).toBe(1);
    expect(r.routeDirs?.some((d) => d === DIR_DOWN)).toBe(true);
  });

  it("proves a wall-only puzzle unsolvable", () => {
    const p = build(
      2,
      [
        cell(0, 0, "start", DIR_DOWN),
        cell(1, 0, "wall", undefined, { wallDir: DIR_RIGHT }),
        cell(1, 1, "exit"),
      ],
      { row: 0, col: 0 },
      { row: 1, col: 1 },
      "vector",
    );
    const r = minimumRotationSolver(p);
    expect(r.exact).toBe(true);
    expect(r.solvable).toBe(false);
  });
});

describe("base solver is unchanged", () => {
  it("matches the stored minimum par for a no-warp level", () => {
    const p = generateLevel(30);
    expect(puzzleHasWarpMechanics(p)).toBe(false);
    const r = minimumRotationSolver(p);
    expect(r.exact).toBe(true);
    expect(r.solvable).toBe(true);
    expect(r.rotations).toBe(p.par);
  }, 60000);
});
