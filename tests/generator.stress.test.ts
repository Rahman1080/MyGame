import { describe, expect, it } from "vitest";
import { validateFinal, validatePuzzle } from "../src/engine";
import { generatePuzzle } from "../src/gen/generator";
import { profileForLevel, dailyProfile } from "../src/gen/difficulty";

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
const N = Number(env?.STRESS_N ?? 300);

describe("generator stress", () => {
  it(`validates ${N} deterministic seeds through the full pipeline`, () => {
    const profiles = [
      profileForLevel(2),
      profileForLevel(8),
      profileForLevel(15),
      profileForLevel(25),
      profileForLevel(35),
      profileForLevel(45),
      profileForLevel(55),
      profileForLevel(65),
      dailyProfile(0),
      dailyProfile(1),
      dailyProfile(2),
      dailyProfile(3),
      dailyProfile(4),
    ];
    for (let i = 0; i < N; i += 1) {
      const profile = profiles[i % profiles.length]!;
      const seed = Math.imul(i + 1, 2654435761) >>> 0;
      const opts = { id: `stress-${i}`, pack: "stress", profile, parMode: "canonical" as const };
      const puzzle = generatePuzzle(seed, opts);

      expect(puzzle.size).toBe(profile.size);
      const v = validateFinal(puzzle);
      expect(v.ok, `seed ${seed}: ${v.errors.join(",")}`).toBe(true);
      expect(puzzle.par).toBeGreaterThanOrEqual(0);

      for (const c of puzzle.cells) {
        expect(c.row).toBeGreaterThanOrEqual(0);
        expect(c.col).toBeGreaterThanOrEqual(0);
        expect(c.row).toBeLessThan(puzzle.size);
        expect(c.col).toBeLessThan(puzzle.size);
      }

      const again = generatePuzzle(seed, opts);
      expect(again.cells.map((c) => c.direction)).toEqual(puzzle.cells.map((c) => c.direction));
      expect(again.par).toBe(puzzle.par);
      expect(again.start).toEqual(puzzle.start);
      expect(again.exit).toEqual(puzzle.exit);
    }
  }, 180000);

  it("never returns an unvalidated fallback", () => {
    const impossible = {
      size: 5,
      minPath: 1,
      maxPath: 2,
      lockChance: 0,
      emptyBias: 0.2,
      scrambleMin: 1,
      scrambleMax: 1,
      gates: false,
      decoyChance: 0,
    };
    for (let i = 0; i < 20; i += 1) {
      const p = generatePuzzle(i + 1, { id: `fb-${i}`, pack: "stress", profile: impossible });
      const v = validatePuzzle(p);
      expect(v.ok, v.errors.join(",")).toBe(true);
    }
  });
});
