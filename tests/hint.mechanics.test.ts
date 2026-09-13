import { describe, expect, it } from "vitest";
import { minimumRotationSolver, nextHint } from "../src/engine";
import { DIR_DOWN, DIR_RIGHT } from "../src/engine/types";
import type { Cell, Coord, Puzzle } from "../src/engine/types";
import { cell, fillGrid } from "./helpers";

function build(size: number, placed: Cell[], start: Coord, exit: Coord, pack: string): Puzzle {
  return {
    id: "hint-mechanics",
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

function wallMaze(): Puzzle {
  return build(
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
}

describe("hints on warp routes", () => {
  it("points at the rotatable route cell and reduces the exact minimum by one", () => {
    const p = wallMaze();
    const before = minimumRotationSolver(p);
    expect(before.exact).toBe(true);
    expect(before.rotations).toBe(1);

    const move = nextHint(p, p.cells);
    expect(move).toEqual({ row: 0, col: 2, from: DIR_RIGHT, to: DIR_DOWN });

    const nextCells = p.cells.map((c) =>
      c.row === move!.row && c.col === move!.col ? { ...c, direction: move!.to } : c,
    );
    const after = minimumRotationSolver({ ...p, cells: nextCells });
    expect(after.exact).toBe(true);
    expect(after.solvable).toBe(true);
    expect(after.rotations).toBe(before.rotations - 1);
  });

  it("never hints a portal or a wall", () => {
    const p = wallMaze();
    const move = nextHint(p, p.cells);
    const target = p.cells.find((c) => c.row === move!.row && c.col === move!.col);
    expect(target?.type).not.toBe("portal");
    expect(target?.type).not.toBe("wall");
  });
});
