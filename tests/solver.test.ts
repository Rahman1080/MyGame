import { describe, expect, it } from "vitest";
import {
  calculatePar,
  canonicalPar,
  canonicalSolution,
  computePar,
  isCanonicalSolvable,
  isSolvable,
  minimumRotationSolver,
  solvePuzzle,
} from "../src/engine";
import { generateLevel, generatePuzzle } from "../src/gen/generator";
import { straightPuzzle } from "./helpers";
import { DIR_DOWN, DIR_LEFT, DIR_RIGHT, DIR_UP } from "../src/engine/types";

describe("canonical solver", () => {
  it("finds a valid solution for the canonical path", () => {
    const p = straightPuzzle();
    expect(isCanonicalSolvable(p)).toBe(true);
    expect(canonicalSolution(p).result.outcome).toBe("win");
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
    expect(isCanonicalSolvable(p)).toBe(false);
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

describe("minimum rotation solver", () => {
  it("returns 0 for an already solved puzzle", () => {
    const p = straightPuzzle();
    const r = minimumRotationSolver(p);
    expect(r.exact).toBe(true);
    expect(r.solvable).toBe(true);
    expect(r.rotations).toBe(0);
  });

  it("finds an exact one-rotation solution", () => {
    const p = straightPuzzle();
    p.cells = p.cells.map((c) =>
      c.row === 0 && c.col === 1
        ? { ...c, direction: ((DIR_RIGHT + 3) % 4) as typeof DIR_RIGHT, canonicalDir: DIR_RIGHT }
        : c,
    );
    const r = minimumRotationSolver(p);
    expect(r.exact).toBe(true);
    expect(r.rotations).toBe(1);
  });

  it("finds an exact two-rotation solution", () => {
    const p = straightPuzzle();
    p.cells = p.cells.map((c) =>
      c.row === 0 && c.col === 1
        ? { ...c, direction: DIR_LEFT, canonicalDir: DIR_RIGHT }
        : c,
    );
    const r = minimumRotationSolver(p);
    expect(r.exact).toBe(true);
    expect(r.rotations).toBe(2);
  });

  it("reports exact unsolvable when no direction assignment can work", () => {
    const p = straightPuzzle();
    p.cells = p.cells.map((c) => {
      if (c.row === 0 && c.col === 0) return { ...c, direction: DIR_RIGHT, canonicalDir: DIR_RIGHT };
      if (c.row === 0 && c.col === 2) return { ...c, type: "exit" as const, required: false };
      if (c.row === 2 && c.col === 2) return { ...c, type: "arrow" as const, required: true };
      return { ...c, type: "empty" as const, direction: undefined, required: false };
    });
    p.start = { row: 0, col: 0 };
    p.exit = { row: 0, col: 2 };
    const r = minimumRotationSolver(p);
    expect(r.exact).toBe(true);
    expect(r.solvable).toBe(false);
  });

  it("is deterministic", () => {
    const p = straightPuzzle();
    p.cells = p.cells.map((c) =>
      c.row === 0 && c.col === 1
        ? { ...c, direction: DIR_DOWN, canonicalDir: DIR_RIGHT }
        : c,
    );
    expect(minimumRotationSolver(p)).toEqual(minimumRotationSolver(p));
  });

  it("never reports a minimum larger than the canonical route (small boards)", () => {
    for (let level = 4; level <= 20; level += 1) {
      const p = generateLevel(level);
      const r = minimumRotationSolver(p);
      if (r.exact) {
        expect(r.solvable).toBe(true);
        expect(r.rotations).toBeLessThanOrEqual(canonicalPar(p.cells));
      }
    }
  });
});

describe("par labelling", () => {
  it("labels player-facing par as the proven exact minimum", () => {
    const p = generatePuzzle(7, { id: "small", pack: "pulse", level: 8 });
    expect(p.parKind).toBe("minimum");
    expect(computePar(p, "minimum").kind).toBe("minimum");
    expect(p.par).toBeLessThanOrEqual(canonicalPar(p.cells));
  });

  it("keeps the fast canonical mode available and clearly labelled", () => {
    const p = generatePuzzle(7, { id: "small-canon", pack: "pulse", level: 8, parMode: "canonical" });
    expect(p.parKind).toBe("canonical");
    expect(p.par).toBe(canonicalPar(p.cells));
  });

  it("calculatePar matches the stored par for every story level", () => {
    for (let level = 1; level <= 80; level += 1) {
      const p = generateLevel(level);
      expect(calculatePar(p)).toBe(p.par);
    }
  }, 60000);
});
