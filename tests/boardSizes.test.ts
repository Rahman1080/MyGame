import { describe, expect, it } from "vitest";
import { generateLevel } from "../src/gen/generator";
import { isSolvable, minimumRotationSolver, validateFinal } from "../src/engine";

const CASES: Array<{ label: string; level: number; size: number }> = [
  { label: "3x3", level: 8, size: 3 },
  { label: "4x4", level: 35, size: 4 },
  { label: "5x5", level: 55, size: 5 },
  { label: "6x6", level: 80, size: 6 },
];

describe("board sizes are real, not implicit", () => {
  for (const c of CASES) {
    it(`${c.label}: level ${c.level} explicitly generates size ${c.size}`, () => {
      const p = generateLevel(c.level);
      expect(p.size).toBe(c.size);
      expect(p.cells).toHaveLength(c.size * c.size);
      expect(validateFinal(p).ok).toBe(true);
      expect(isSolvable(p)).toBe(true);
      const r = minimumRotationSolver(p);
      expect(r.exact).toBe(true);
      expect(r.rotations).toBe(p.par);
    });
  }

  it("steps size at the campaign band boundaries", () => {
    expect(generateLevel(4).size).toBe(3);
    expect(generateLevel(13).size).toBe(4);
    expect(generateLevel(41).size).toBe(5);
    expect(generateLevel(71).size).toBe(6);
    expect(generateLevel(80).size).toBe(6);
  });
});
