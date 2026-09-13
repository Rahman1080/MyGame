import { describe, expect, it } from "vitest";
import { DEFAULT_MECHANICS, hasMechanic, mechanicsForPack } from "../src/engine/mechanics";
import type { Cell } from "../src/engine";

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
