import { describe, expect, it } from "vitest";
import {
  calculatePar,
  canonicalPar,
  computePar,
  minimumRotationSolver,
  starsForPuzzle,
} from "../src/engine";
import { generateLevel, generatePuzzle } from "../src/gen/generator";
import { TOTAL_LEVELS } from "../src/levels/packs";
import { validateFinal } from "../src/engine";

describe("player-facing par is exact minimum", () => {
  it("proves exact minimum par for every story level", () => {
    for (let level = 1; level <= TOTAL_LEVELS; level += 1) {
      const puzzle = generateLevel(level);
      expect(puzzle.parKind).toBe("minimum");
      const r = minimumRotationSolver(puzzle);
      expect(r.exact, `level ${level} solver not exact`).toBe(true);
      expect(r.solvable).toBe(true);
      expect(r.rotations).toBe(puzzle.par);
      expect(computePar(puzzle, "minimum").kind).toBe("minimum");
    }
  }, 120000);

  it("is deterministic", () => {
    const a = generateLevel(58);
    const b = generateLevel(58);
    expect(a.par).toBe(b.par);
    expect(a.parKind).toBe("minimum");
    expect(b.parKind).toBe("minimum");
  });

  it("records a minimum that can be lower than the canonical route", () => {
    const a = canonicalPar(generateLevel(23).cells);
    let foundLower = false;
    for (let level = 4; level <= TOTAL_LEVELS; level += 1) {
      const puzzle = generateLevel(level);
      if (puzzle.par < canonicalPar(puzzle.cells)) foundLower = true;
    }
    expect(foundLower).toBe(true);
    expect(a).toBeGreaterThan(0);
  });
});

describe("canonical fallback is explicit", () => {
  it("labels the fast canonical mode as canonical", () => {
    const p = generatePuzzle(7, { id: "canon", pack: "pulse", level: 58, parMode: "canonical" });
    expect(p.parKind).toBe("canonical");
    expect(p.par).toBe(canonicalPar(p.cells));
  });

  it("never labels an unproven result as minimum", () => {
    const p = generatePuzzle(7, { id: "canon2", pack: "pulse", level: 58, parMode: "canonical" });
    expect(p.parKind).not.toBe("minimum");
    expect(validateFinal(p).ok).toBe(true);
  });

  it("keeps the deterministic fallback valid and labelled", () => {
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
    const p = generatePuzzle(42, { id: "fb", pack: "pulse", profile: impossible });
    expect(validateFinal(p).ok).toBe(true);
    expect(["minimum", "canonical"]).toContain(p.parKind);
    const again = generatePuzzle(42, { id: "fb", pack: "pulse", profile: impossible });
    expect(again.par).toBe(p.par);
    expect(again.parKind).toBe(p.parKind);
  });
});

describe("star scoring honours the recorded par kind", () => {
  it("uses calculatePar (kind-aware) for stars", () => {
    const p = generateLevel(30);
    expect(p.parKind).toBe("minimum");
    expect(calculatePar(p)).toBe(p.par);
    expect(starsForPuzzle(p, p.par)).toBe(3);
    expect(starsForPuzzle(p, p.par + 2)).toBe(2);
    expect(starsForPuzzle(p, p.par + 3)).toBe(1);
  });

  it("recomputes canonical par when the kind is canonical", () => {
    const p = generatePuzzle(7, { id: "canon-stars", pack: "pulse", level: 58, parMode: "canonical" });
    expect(p.parKind).toBe("canonical");
    expect(calculatePar(p)).toBe(canonicalPar(p.cells));
  });
});
