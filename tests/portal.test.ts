import { describe, expect, it } from "vitest";
import { simulatePuzzle } from "../src/engine/simulation";
import { DEFAULT_MECHANICS } from "../src/engine/mechanics";
import { DIR_RIGHT } from "../src/engine/types";
import type { Cell, Puzzle } from "../src/engine/types";
import { cell, fillGrid } from "./helpers";

function build(size: number, placed: Cell[], startRow: number, startCol: number): Puzzle {
  return {
    id: "portal-test",
    seed: 1,
    size,
    cells: fillGrid(size, placed),
    start: { row: startRow, col: startCol },
    exit: { row: 2, col: 2 },
    par: 0,
    difficulty: 1,
    pack: "wormhole",
  };
}

function portalPuzzle(): Puzzle {
  return build(
    3,
    [
      cell(0, 0, "start", DIR_RIGHT, { color: "cyan" }),
      cell(0, 1, "portal", undefined, { portalId: "p1", portalSide: "a" }),
      cell(2, 1, "portal", undefined, { portalId: "p1", portalSide: "b" }),
      cell(2, 2, "exit"),
    ],
    0,
    0,
  );
}

describe("simulatePuzzle with portals", () => {
  it("warps through a portal pair and wins", () => {
    expect(simulatePuzzle(portalPuzzle()).outcome).toBe("win");
  });

  it("records both portal cells along the route", () => {
    const result = simulatePuzzle(portalPuzzle());
    const coords = result.path.map((s) => `${s.row},${s.col}`);
    expect(coords).toEqual(["0,0", "0,1", "2,1", "2,2"]);
  });

  it("fails when the portal mechanic is disabled", () => {
    const p = portalPuzzle();
    const flags = { ...DEFAULT_MECHANICS, portals: false };
    expect(simulatePuzzle(p, p.cells, flags).outcome).toBe("fail");
  });

  it("detects a portal cycle as PORTAL_LOOP", () => {
    const p = build(
      3,
      [
        cell(0, 0, "start", DIR_RIGHT, { color: "cyan" }),
        cell(0, 1, "portal", undefined, { portalId: "p1", portalSide: "a" }),
        cell(1, 1, "portal", undefined, { portalId: "p1", portalSide: "b" }),
        cell(1, 2, "portal", undefined, { portalId: "p1", portalSide: "a" }),
        cell(2, 2, "exit"),
      ],
      0,
      0,
    );
    const result = simulatePuzzle(p);
    expect(result.outcome).toBe("fail");
    expect(result.reason).toBe("PORTAL_LOOP");
  });
});
