import { describe, expect, it } from "vitest";
import { simulatePuzzle } from "../src/engine/simulation";
import { DEFAULT_MECHANICS } from "../src/engine/mechanics";
import { DIR_DOWN, DIR_RIGHT } from "../src/engine/types";
import type { Cell, Coord, Puzzle } from "../src/engine/types";
import { cell, fillGrid } from "./helpers";

function build(size: number, placed: Cell[], start: Coord, exit: Coord): Puzzle {
  return {
    id: "wall-test",
    seed: 1,
    size,
    cells: fillGrid(size, placed),
    start,
    exit,
    par: 0,
    difficulty: 1,
    pack: "vector",
  };
}

describe("simulatePuzzle with one-way walls", () => {
  it("crosses a wall in its permitted direction and wins", () => {
    const p = build(
      3,
      [
        cell(0, 0, "start", DIR_RIGHT, { color: "cyan" }),
        cell(0, 1, "wall", undefined, { wallDir: DIR_RIGHT }),
        cell(0, 2, "exit"),
      ],
      { row: 0, col: 0 },
      { row: 0, col: 2 },
    );
    const result = simulatePuzzle(p);
    expect(result.outcome).toBe("win");
    expect(result.path.map((s) => `${s.row},${s.col}`)).toEqual(["0,0", "0,1", "0,2"]);
  });

  it("fails with BLOCKED_WALL when crossing against the arrow", () => {
    const p = build(
      3,
      [
        cell(0, 1, "start", DIR_DOWN, { color: "cyan" }),
        cell(1, 1, "wall", undefined, { wallDir: DIR_RIGHT }),
        cell(1, 2, "exit"),
      ],
      { row: 0, col: 1 },
      { row: 1, col: 2 },
    );
    const result = simulatePuzzle(p);
    expect(result.outcome).toBe("fail");
    expect(result.reason).toBe("BLOCKED_WALL");
  });

  it("ignores the wall when the mechanic is disabled", () => {
    const p = build(
      3,
      [
        cell(0, 1, "start", DIR_DOWN, { color: "cyan" }),
        cell(1, 1, "wall", undefined, { wallDir: DIR_RIGHT }),
        cell(1, 2, "exit"),
      ],
      { row: 0, col: 1 },
      { row: 1, col: 2 },
    );
    const flags = { ...DEFAULT_MECHANICS, oneWayWalls: false };
    expect(simulatePuzzle(p, p.cells, flags).outcome).toBe("win");
  });
});
