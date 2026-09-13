import { describe, expect, it } from "vitest";
import { resolveStep } from "../src/engine/movement";
import { DEFAULT_MECHANICS } from "../src/engine/mechanics";
import { DIR_DOWN, DIR_LEFT, DIR_RIGHT, DIR_UP } from "../src/engine/types";
import { cell, fillGrid } from "./helpers";

const F = DEFAULT_MECHANICS;

describe("resolveStep", () => {
  it("moves one cell in an open grid", () => {
    const cells = fillGrid(3, []);
    const r = resolveStep(cells, 3, { row: 0, col: 0 }, DIR_RIGHT, F);
    expect(r.kind).toBe("move");
    expect(r.landing).toEqual({ row: 0, col: 1 });
    expect(r.entered).toEqual([{ row: 0, col: 1 }]);
  });

  it("reports off-grid at the board edge", () => {
    const cells = fillGrid(3, []);
    const r = resolveStep(cells, 3, { row: 0, col: 2 }, DIR_RIGHT, F);
    expect(r.kind).toBe("offGrid");
  });

  it("allows crossing a one-way wall in its permitted direction", () => {
    const cells = fillGrid(3, [cell(1, 1, "wall", undefined, { wallDir: DIR_RIGHT })]);
    const r = resolveStep(cells, 3, { row: 1, col: 0 }, DIR_RIGHT, F);
    expect(r.kind).toBe("move");
    expect(r.landing).toEqual({ row: 1, col: 1 });
  });

  it("blocks crossing a one-way wall from the wrong direction", () => {
    const cells = fillGrid(3, [cell(1, 1, "wall", undefined, { wallDir: DIR_RIGHT })]);
    const r = resolveStep(cells, 3, { row: 0, col: 1 }, DIR_DOWN, F);
    expect(r.kind).toBe("blocked");
    expect(r.landing).toEqual({ row: 1, col: 1 });
  });

  it("teleports A to B preserving direction", () => {
    const cells = fillGrid(3, [
      cell(0, 1, "portal", undefined, { portalId: "p1", portalSide: "a" }),
      cell(2, 1, "portal", undefined, { portalId: "p1", portalSide: "b" }),
    ]);
    const r = resolveStep(cells, 3, { row: 0, col: 0 }, DIR_RIGHT, F);
    expect(r.kind).toBe("warp");
    expect(r.landing).toEqual({ row: 2, col: 2 });
    expect(r.entered).toEqual([
      { row: 0, col: 1 },
      { row: 2, col: 1 },
      { row: 2, col: 2 },
    ]);
  });

  it("teleports B to A in reverse", () => {
    const cells = fillGrid(3, [
      cell(0, 1, "portal", undefined, { portalId: "p1", portalSide: "b" }),
      cell(2, 1, "portal", undefined, { portalId: "p1", portalSide: "a" }),
    ]);
    const r = resolveStep(cells, 3, { row: 2, col: 0 }, DIR_RIGHT, F);
    expect(r.kind).toBe("warp");
    expect(r.landing).toEqual({ row: 0, col: 2 });
  });

  it("chains through multiple portal pairs", () => {
    const cells = fillGrid(3, [
      cell(0, 1, "portal", undefined, { portalId: "p1", portalSide: "a" }),
      cell(1, 1, "portal", undefined, { portalId: "p1", portalSide: "b" }),
      cell(1, 2, "portal", undefined, { portalId: "p2", portalSide: "a" }),
      cell(2, 1, "portal", undefined, { portalId: "p2", portalSide: "b" }),
    ]);
    const r = resolveStep(cells, 3, { row: 0, col: 0 }, DIR_RIGHT, F);
    expect(r.kind).toBe("warp");
    expect(r.landing).toEqual({ row: 2, col: 2 });
    expect(r.entered).toEqual([
      { row: 0, col: 1 },
      { row: 1, col: 1 },
      { row: 1, col: 2 },
      { row: 2, col: 1 },
      { row: 2, col: 2 },
    ]);
  });

  it("detects a repeated portal pair during one step", () => {
    const cells = fillGrid(3, [
      cell(0, 1, "portal", undefined, { portalId: "p1", portalSide: "a" }),
      cell(1, 1, "portal", undefined, { portalId: "p1", portalSide: "b" }),
      cell(1, 2, "portal", undefined, { portalId: "p1", portalSide: "a" }),
    ]);
    const r = resolveStep(cells, 3, { row: 0, col: 0 }, DIR_RIGHT, F);
    expect(r.kind).toBe("portalLoop");
  });

  it("honours disabled flags by ignoring the portal", () => {
    const cells = fillGrid(3, [
      cell(0, 1, "portal", undefined, { portalId: "p1", portalSide: "a" }),
      cell(2, 1, "portal", undefined, { portalId: "p1", portalSide: "b" }),
    ]);
    const flags = { ...F, portals: false };
    const r = resolveStep(cells, 3, { row: 0, col: 0 }, DIR_RIGHT, flags);
    expect(r.kind).toBe("move");
    expect(r.landing).toEqual({ row: 0, col: 1 });
  });

  it("keeps straight geometry for up and left", () => {
    const cells = fillGrid(3, []);
    expect(resolveStep(cells, 3, { row: 1, col: 1 }, DIR_LEFT, F).landing).toEqual({ row: 1, col: 0 });
    expect(resolveStep(cells, 3, { row: 1, col: 1 }, DIR_DOWN, F).landing).toEqual({ row: 2, col: 1 });
    expect(resolveStep(cells, 3, { row: 1, col: 1 }, DIR_UP, F).landing).toEqual({ row: 0, col: 1 });
  });
});
