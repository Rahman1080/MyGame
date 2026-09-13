import { describe, expect, it } from "vitest";
import { DEFAULT_MECHANICS, hasMechanic, mechanicsForPack } from "../src/engine/mechanics";
import { validateStructure } from "../src/engine/validation";
import { DIR_RIGHT } from "../src/engine/types";
import type { Cell, Coord, Puzzle } from "../src/engine";
import { cell, fillGrid } from "./helpers";

function build(placed: Cell[], start: Coord = { row: 0, col: 0 }, exit: Coord = { row: 2, col: 2 }): Puzzle {
  return {
    id: "mechanics",
    seed: 1,
    size: 3,
    cells: fillGrid(3, placed),
    start,
    exit,
    par: 0,
    difficulty: 1,
    pack: "wormhole",
  };
}

describe("mechanic flags", () => {
  it("enables shipped mechanics and disables experimental ones", () => {
    expect(DEFAULT_MECHANICS.colorGates).toBe(true);
    expect(DEFAULT_MECHANICS.portals).toBe(true);
    expect(DEFAULT_MECHANICS.oneWayWalls).toBe(true);
    expect(DEFAULT_MECHANICS.splitters).toBe(false);
    expect(DEFAULT_MECHANICS.timedTiles).toBe(false);
    expect(DEFAULT_MECHANICS.switches).toBe(false);
    expect(DEFAULT_MECHANICS.rotators).toBe(false);
    expect(DEFAULT_MECHANICS.barriers).toBe(false);
    expect(DEFAULT_MECHANICS.checkpoints).toBe(false);
  });

  it("maps packs to their unlocked mechanics", () => {
    expect(hasMechanic(mechanicsForPack("pulse"), "portals")).toBe(false);
    expect(hasMechanic(mechanicsForPack("color-gates"), "colorGates")).toBe(true);
    expect(hasMechanic(mechanicsForPack("wormhole"), "portals")).toBe(true);
    expect(hasMechanic(mechanicsForPack("vector"), "oneWayWalls")).toBe(true);
    expect(hasMechanic(mechanicsForPack("daily"), "portals")).toBe(false);
  });

  it("supports new tile metadata on cells", () => {
    const portal: Cell = { row: 0, col: 0, type: "portal", portalId: "p1", portalSide: "a" };
    const wall: Cell = { row: 0, col: 0, type: "wall", wallDir: 1 };
    expect(portal.portalId).toBe("p1");
    expect(wall.wallDir).toBe(1);
  });
});

describe("mechanic structural validation", () => {
  const base = [cell(0, 0, "start", DIR_RIGHT), cell(2, 2, "exit")];

  it("accepts a balanced portal pair", () => {
    const p = build([
      ...base,
      cell(0, 1, "portal", undefined, { portalId: "p1", portalSide: "a" }),
      cell(2, 1, "portal", undefined, { portalId: "p1", portalSide: "b" }),
    ]);
    expect(validateStructure(p).ok).toBe(true);
  });

  it("rejects a portal without a pair", () => {
    const p = build([...base, cell(0, 1, "portal", undefined, { portalId: "p1", portalSide: "a" })]);
    const v = validateStructure(p);
    expect(v.ok).toBe(false);
    expect(v.errors).toContain("portal-unbalanced");
  });

  it("rejects an unbalanced portal id", () => {
    const p = build([
      ...base,
      cell(0, 1, "portal", undefined, { portalId: "p1", portalSide: "a" }),
      cell(1, 1, "portal", undefined, { portalId: "p1", portalSide: "b" }),
      cell(2, 1, "portal", undefined, { portalId: "p1", portalSide: "a" }),
    ]);
    expect(validateStructure(p).errors).toContain("portal-unbalanced");
  });

  it("rejects a portal without an id", () => {
    const p = build([...base, cell(0, 1, "portal", undefined, { portalSide: "a" })]);
    expect(validateStructure(p).errors).toContain("portal-no-id");
  });

  it("rejects a wall without a direction", () => {
    const p = build([...base, cell(0, 1, "wall")]);
    expect(validateStructure(p).errors).toContain("wall-no-dir");
  });
});
