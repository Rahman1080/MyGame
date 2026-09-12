import { describe, expect, it } from "vitest";
import { isSolvable, validatePuzzle } from "../src/engine";
import { generateLevel, generatePuzzle, seedForLevel } from "../src/gen/generator";
import { generateDailyRun } from "../src/gen/daily";
import { tutorialPuzzles } from "../src/gen/templates";

describe("generator", () => {
  it("tutorial puzzles are solvable with matching par", () => {
    for (const p of tutorialPuzzles()) {
      const v = validatePuzzle(p);
      expect(v.ok, v.errors.join(",")).toBe(true);
    }
  });

  it("same seed produces the same puzzle", () => {
    const a = generatePuzzle(12345, { id: "x", pack: "pulse", level: 12 });
    const b = generatePuzzle(12345, { id: "x", pack: "pulse", level: 12 });
    expect(a.cells.map((c) => c.direction)).toEqual(b.cells.map((c) => c.direction));
    expect(a.start).toEqual(b.start);
    expect(a.exit).toEqual(b.exit);
    expect(a.par).toBe(b.par);
  });

  it("different seeds usually differ", () => {
    const a = generatePuzzle(11, { id: "a", pack: "pulse", level: 22 });
    const b = generatePuzzle(99, { id: "b", pack: "pulse", level: 22 });
    const same =
      a.start.row === b.start.row &&
      a.start.col === b.start.col &&
      a.cells.every((c, i) => c.direction === b.cells[i]?.direction);
    expect(same).toBe(false);
  });

  it("stress: many seeds are solvable and terminate", () => {
    const t0 = Date.now();
    for (let i = 4; i <= 60; i += 1) {
      const p = generateLevel(i);
      expect(p.size).toBeGreaterThanOrEqual(3);
      expect(p.size).toBeLessThanOrEqual(6);
      expect(isSolvable(p)).toBe(true);
      expect(p.par).toBeGreaterThanOrEqual(0);
      const start = p.cells.find((c) => c.row === p.start.row && c.col === p.start.col);
      const exit = p.cells.find((c) => c.row === p.exit.row && c.col === p.exit.col);
      expect(start?.type).toBe("start");
      expect(exit?.type).toBe("exit");
    }
    expect(Date.now() - t0).toBeLessThan(15000);
  });

  it("daily run seeds are stable", () => {
    const a = generateDailyRun("2026-09-12");
    const b = generateDailyRun("2026-09-12");
    expect(a.map((p) => p.seed)).toEqual(b.map((p) => p.seed));
    expect(a).toHaveLength(5);
    const c = generateDailyRun("2026-09-13");
    expect(c.map((p) => p.seed)).not.toEqual(a.map((p) => p.seed));
  });

  it("seedForLevel is stable", () => {
    expect(seedForLevel(12)).toBe(seedForLevel(12));
  });
});
