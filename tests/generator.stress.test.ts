import { describe, expect, it } from "vitest";
import { minimumRotationSolver, validateFinal, validatePuzzle } from "../src/engine";
import type { DifficultyProfile } from "../src/gen/difficulty";
import { emptyMetrics, generatePuzzle, type GenerationMetrics } from "../src/gen/generator";

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
const N = Number(env?.STRESS_N ?? 300);
const EXACT = Number(env?.STRESS_EXACT ?? 40);

const SIZES = [3, 4, 5, 6] as const;

function stressProfile(size: number): DifficultyProfile {
  switch (size) {
    case 3:
      return { size, minPath: 4, maxPath: 8, lockChance: 0, emptyBias: 0.2, scrambleMin: 2, scrambleMax: 5, gates: false, decoyChance: 0 };
    case 4:
      return { size, minPath: 9, maxPath: 13, lockChance: 0.1, emptyBias: 0.15, scrambleMin: 3, scrambleMax: 7, gates: false, decoyChance: 0.05 };
    case 5:
      return { size, minPath: 14, maxPath: 20, lockChance: 0.2, emptyBias: 0.12, scrambleMin: 5, scrambleMax: 11, gates: true, decoyChance: 0.08 };
    default:
      return { size, minPath: 20, maxPath: 30, lockChance: 0.24, emptyBias: 0.1, scrambleMin: 7, scrambleMax: 14, gates: true, decoyChance: 0.1 };
  }
}

function p95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]!;
}

/** Let vitest's worker RPC heartbeat run during long synchronous loops. */
function breathe(iteration: number): Promise<void> | void {
  if (iteration % 250 !== 0) return;
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function summarize(label: string, times: number[], states: number[], metrics: GenerationMetrics): void {
  const avg = times.reduce((a, b) => a + b, 0) / Math.max(1, times.length);
  const max = times.reduce((a, b) => Math.max(a, b), 0);
  const avgStates = states.reduce((a, b) => a + b, 0) / Math.max(1, states.length);
  const maxStates = states.reduce((a, b) => Math.max(a, b), 0);
  console.log(
    `[stress:${label}] n=${times.length} avg=${avg.toFixed(2)}ms p95=${p95(times).toFixed(2)}ms max=${max.toFixed(2)}ms ` +
      `statesAvg=${avgStates.toFixed(0)} statesMax=${maxStates} attempts=${metrics.attempts} ` +
      `candidates=${metrics.candidates} rejectedInexact=${metrics.rejectedInexact} ` +
      `closest=${metrics.usedClosest} fallback=${metrics.usedFallback}`,
  );
}

describe("generator stress", () => {
  it(`validates ${N} deterministic seeds across 3x3..6x6`, async () => {
    const times: number[] = [];
    const metrics = emptyMetrics();
    for (let i = 0; i < N; i += 1) {
      await breathe(i);
      const size = SIZES[i % SIZES.length]!;
      const profile = stressProfile(size);
      const seed = Math.imul(i + 1, 2654435761) >>> 0;
      const opts = {
        id: `stress-${i}`,
        pack: "stress",
        profile,
        parMode: "minimum" as const,
        requireExactPar: false,
        metrics: emptyMetrics(),
      };
      const t0 = performance.now();
      const puzzle = generatePuzzle(seed, opts);
      times.push(performance.now() - t0);

      expect(puzzle.size).toBe(size);
      const v = validateFinal(puzzle);
      expect(v.ok, `seed ${seed}: ${v.errors.join(",")}`).toBe(true);
      expect(puzzle.par).toBeGreaterThanOrEqual(0);

      for (const c of puzzle.cells) {
        expect(c.row).toBeGreaterThanOrEqual(0);
        expect(c.col).toBeGreaterThanOrEqual(0);
        expect(c.row).toBeLessThan(puzzle.size);
        expect(c.col).toBeLessThan(puzzle.size);
      }

      // A puzzle is only labelled "minimum" when the solver actually proved it.
      if (puzzle.parKind === "minimum") {
        const solved = minimumRotationSolver(puzzle);
        expect(solved.exact && solved.solvable).toBe(true);
        expect(puzzle.par).toBe(solved.rotations);
      }

      const again = generatePuzzle(seed, { ...opts, metrics: emptyMetrics() });
      expect(again.cells.map((c) => c.direction)).toEqual(puzzle.cells.map((c) => c.direction));
      expect(again.par).toBe(puzzle.par);
      expect(again.start).toEqual(puzzle.start);
      expect(again.exit).toEqual(puzzle.exit);

      metrics.attempts += opts.metrics.attempts;
      metrics.candidates += opts.metrics.candidates;
      metrics.rejectedInexact += opts.metrics.rejectedInexact;
      metrics.usedClosest ||= opts.metrics.usedClosest;
      metrics.usedFallback ||= opts.metrics.usedFallback;
    }
    summarize("structure", times, [], metrics);
    expect(metrics.usedFallback).toBe(false);
  }, 600000);

  it("proves exact minimum par across every board size", async () => {
    const times: number[] = [];
    const states: number[] = [];
    for (let i = 0; i < EXACT * SIZES.length; i += 1) {
      await breathe(i);
      const size = SIZES[i % SIZES.length]!;
      const seed = Math.imul(i + 7, 2246822519) >>> 0;
      const t0 = performance.now();
      const puzzle = generatePuzzle(seed, {
        id: `exact-${i}`,
        pack: "stress",
        profile: stressProfile(size),
        parMode: "minimum",
        requireExactPar: true,
      });
      times.push(performance.now() - t0);

      expect(validateFinal(puzzle).ok).toBe(true);
      expect(puzzle.parKind, `seed ${seed} fell back to canonical`).toBe("minimum");
      const solved = minimumRotationSolver(puzzle);
      expect(solved.exact && solved.solvable).toBe(true);
      expect(puzzle.par).toBe(solved.rotations);
      states.push(solved.statesExplored);
    }
    summarize("exact-min", times, states, emptyMetrics());
    expect(states.length).toBe(EXACT * SIZES.length);
  }, 600000);

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
