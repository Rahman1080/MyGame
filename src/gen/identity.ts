import { hashString } from "./seededRng";
import type { Puzzle } from "../engine/types";

/**
 * Frozen generation identity. Bump this when the generator's output for the
 * same seed changes in a way that must produce *new* levels rather than mutate
 * existing history.
 *
 * - Story levels: `GLOWTRAIL:story:${version}:level:${level}`
 * - Daily runs:   `GLOWTRAIL:daily:${version}:${ymd}`
 *
 * Keeping the version in the seed namespace means a future generator can ship
 * `v2` without silently changing which puzzles belong to `v1`. The committed
 * manifest in `src/levels/manifest.ts` guards v1 against accidental drift.
 */
export const GENERATOR_VERSION = "v1" as const;

export function storySeed(level: number, version: string = GENERATOR_VERSION): number {
  return hashString(`GLOWTRAIL:story:${version}:level:${level}`);
}

export function dailySeed(ymd: string, version: string = GENERATOR_VERSION): number {
  return hashString(`GLOWTRAIL:daily:${version}:${ymd}`);
}

/** Stable, order-independent digest of a puzzle's playable content. */
export function puzzleDigest(puzzle: Puzzle): string {
  const parts: string[] = [
    `${puzzle.size}`,
    `${puzzle.start.row},${puzzle.start.col}`,
    `${puzzle.exit.row},${puzzle.exit.col}`,
    `${puzzle.par ?? ""}:${puzzle.parKind ?? ""}`,
  ];
  const cells = puzzle.cells
    .slice()
    .sort((a, b) => a.row - b.row || a.col - b.col)
    .map(
      (c) =>
        `${c.row},${c.col},${c.type},${c.direction ?? "x"},${c.canonicalDir ?? "x"},` +
        `${c.locked ? 1 : 0},${c.required ? 1 : 0},${c.color ?? "x"}`,
    );
  parts.push(cells.join(";"));
  return hashString(parts.join("|")).toString(16).padStart(8, "0");
}
