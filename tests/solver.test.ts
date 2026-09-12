import { describe, expect, it } from "vitest";
import { calculatePar, isSolvable, solvePuzzle } from "../src/engine";
import { generateLevel } from "../src/gen/generator";
import { straightPuzzle } from "./helpers";
import { DIR_DOWN, DIR_RIGHT, DIR_UP } from "../src/engine/types";

describe("solver", () => {
  it("finds a valid solution for the canonical path", () => {
    const p = straightPuzzle();
    expect(solvePuzzle(p).outcome).toBe("win");
    expect(isSolvable(p)).toBe(true);
  });

  it("rejects an impossible layout", () => {
    const p = straightPuzzle();
    p.cells = p.cells.map((c) =>
      c.type === "arrow" || c.type === "start"
        ? { ...c, direction: DIR_UP, canonicalDir: DIR_UP }
        : c,
    );
    expect(solvePuzzle(p).outcome).toBe("fail");
  });

  it("par is deterministic", () => {
    const p = straightPuzzle();
    p.cells = p.cells.map((c) =>
      c.row === 0 && c.col === 1 ? { ...c, direction: DIR_DOWN, canonicalDir: DIR_RIGHT } : c,
    );
    p.par = 3;
    expect(calculatePar(p)).toBe(3);
    expect(calculatePar(p)).toBe(3);
  });

  it("generated 3x3 and 6x6 puzzles are solvable", () => {
    const a = generateLevel(8);
    const b = generateLevel(58);
    expect(a.size).toBeGreaterThanOrEqual(3);
    expect(b.size).toBeLessThanOrEqual(6);
    expect(isSolvable(a)).toBe(true);
    expect(isSolvable(b)).toBe(true);
  });
});
