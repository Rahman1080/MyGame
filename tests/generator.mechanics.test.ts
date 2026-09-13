import { describe, expect, it } from "vitest";
import { generatePuzzle } from "../src/gen/generator";
import { profileForLevel } from "../src/gen/difficulty";
import { puzzleDigest } from "../src/gen/identity";
import { isCanonicalSolvable } from "../src/engine/solver";
import { validateStructure } from "../src/engine/validation";
import type { Puzzle } from "../src/engine/types";

function wormhole(seed: number, pairs = 1): Puzzle {
  const profile = { ...profileForLevel(87), portals: true, portalPairs: pairs };
  return generatePuzzle(seed, { id: `wormhole-${seed}`, pack: "wormhole", profile, parMode: "canonical" });
}

function vector(seed: number, walls = 2): Puzzle {
  const profile = { ...profileForLevel(107), oneWayWalls: true, walls };
  return generatePuzzle(seed, { id: `vector-${seed}`, pack: "vector", profile, parMode: "canonical" });
}

function portalPairs(puzzle: Puzzle): Map<string, number> {
  const counts = new Map<string, number>();
  for (const c of puzzle.cells) {
    if (c.type !== "portal") continue;
    counts.set(c.portalId ?? "<none>", (counts.get(c.portalId ?? "<none>") ?? 0) + 1);
  }
  return counts;
}

describe("generator mechanics", () => {
  it("wormhole levels splice balanced portal pairs and stay solvable", () => {
    for (let seed = 1; seed <= 8; seed += 1) {
      const p = wormhole(seed * 7919, seed % 2 === 0 ? 2 : 1);
      const pairs = portalPairs(p);
      expect(pairs.size).toBeGreaterThanOrEqual(1);
      for (const count of pairs.values()) expect(count).toBe(2);
      expect(validateStructure(p).ok).toBe(true);
      expect(isCanonicalSolvable(p)).toBe(true);
    }
  }, 60000);

  it("vector levels place one-way walls with an allowed direction", () => {
    for (let seed = 1; seed <= 8; seed += 1) {
      const p = vector(seed * 104729, 2);
      const walls = p.cells.filter((c) => c.type === "wall");
      expect(walls.length).toBeGreaterThanOrEqual(1);
      for (const w of walls) {
        expect(w.wallDir).toBeGreaterThanOrEqual(0);
        expect(w.wallDir).toBeLessThanOrEqual(3);
      }
      expect(validateStructure(p).ok).toBe(true);
      expect(isCanonicalSolvable(p)).toBe(true);
    }
  }, 60000);

  it("is deterministic for a fixed seed", () => {
    expect(puzzleDigest(wormhole(424242))).toBe(puzzleDigest(wormhole(424242)));
    expect(puzzleDigest(vector(424242))).toBe(puzzleDigest(vector(424242)));
  });

  it("keeps every required route cell reachable when splicing", () => {
    for (let seed = 1; seed <= 8; seed += 1) {
      const p = wormhole(seed * 31);
      const required = p.cells.filter((c) => c.required);
      expect(required.length).toBeGreaterThanOrEqual(3);
      expect(isCanonicalSolvable(p)).toBe(true);
    }
  }, 60000);
});
