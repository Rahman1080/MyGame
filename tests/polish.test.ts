import { describe, expect, it } from "vitest";
import { generateLevel, generatePuzzle } from "../src/gen/generator";
import { difficultyRating, profileForLevel } from "../src/gen/difficulty";
import { TOTAL_LEVELS } from "../src/levels/packs";
import {
  applyCanonical,
  applyHint,
  createSession,
  minimumRotationSolver,
  nextHint,
  simulatePuzzle,
  type Cell,
  type ColorName,
  type Puzzle,
} from "../src/engine";

function minPar(puzzle: Puzzle, cells: Cell[] = puzzle.cells): number {
  const r = minimumRotationSolver({ ...puzzle, cells });
  return r.solvable ? r.rotations : Number.POSITIVE_INFINITY;
}

describe("difficulty curve", () => {
  it("lands minimum par within tolerance of the target ramp", () => {
    for (let level = 4; level <= TOTAL_LEVELS; level += 1) {
      const puzzle = generateLevel(level);
      const profile = profileForLevel(level);
      const target = profile.targetPar;
      expect(target).toBeDefined();
      expect(Math.abs(puzzle.par - target!)).toBeLessThanOrEqual(profile.parTolerance ?? 2);
    }
  }, 60000);

  it("grows clearly from early to late game", () => {
    expect(generateLevel(80).par).toBeGreaterThan(generateLevel(6).par + 10);
    expect(difficultyRating(generateLevel(80).difficulty)).toBeGreaterThan(
      difficultyRating(generateLevel(6).difficulty),
    );
  });

  it("uses the proven minimum target label for generated levels", () => {
    const puzzle = generatePuzzle(7, { id: "target", pack: "pulse", level: 8 });
    expect(puzzle.parKind).toBe("minimum");
    expect(puzzle.par).toBe(minimumRotationSolver(puzzle).rotations);
  });
});

describe("color gates", () => {
  it("gated levels have gates, an exit color, and win on the canonical route", () => {
    for (const level of [47, 50, 52, 55, 58, 60, 65, 70, 75, 80]) {
      const puzzle = generateLevel(level);
      const gates = puzzle.cells.filter((c) => c.type === "gate");
      const exit = puzzle.cells.find((c) => c.type === "exit")!;
      expect(gates.length).toBeGreaterThan(0);
      expect(exit.color).toBeDefined();
      expect(simulatePuzzle(puzzle, applyCanonical(puzzle.cells)).outcome).toBe("win");
    }
  });

  it("fails with WRONG_COLOR when the exit color is not carried", () => {
    const puzzle = generateLevel(58);
    const exit = puzzle.cells.find((c) => c.type === "exit")!;
    const wrongColor: ColorName = exit.color === "lime" ? "amber" : "lime";
    const cells = applyCanonical(puzzle.cells).map((c) =>
      c.type === "gate" && c.color === exit.color ? { ...c, color: wrongColor } : c,
    );
    const result = simulatePuzzle(puzzle, cells);
    expect(result.outcome).toBe("fail");
    expect(result.reason).toBe("WRONG_COLOR");
  });

  it("plain levels carry no color requirement", () => {
    const puzzle = generateLevel(8);
    expect(puzzle.cells.some((c) => c.type === "gate")).toBe(false);
    expect(puzzle.cells.find((c) => c.type === "exit")!.color).toBeUndefined();
  });
});

describe("solver-guided hint", () => {
  it("reduces the exact minimum distance by exactly one for every story level", () => {
    for (let level = 4; level <= TOTAL_LEVELS; level += 1) {
      const puzzle = generateLevel(level);
      const before = minPar(puzzle);
      const move = nextHint(puzzle, puzzle.cells);
      expect(move, `level ${level} produced no hint`).toBeDefined();
      const cells = puzzle.cells.map((c) =>
        c.row === move!.row && c.col === move!.col ? { ...c, direction: move!.to } : c,
      );
      expect(minPar(puzzle, cells), `level ${level}`).toBe(before - 1);
    }
  }, 60000);

  it("records a visible hint and fires only once per puzzle", () => {
    const session = createSession(generateLevel(20));
    expect(applyHint(session)).toBe(true);
    expect(session.hint).not.toBeNull();
    expect(session.hintUsed).toBe(true);
    expect(applyHint(session)).toBe(false);
  });

  it("solves to the exact minimum zero when the player follows hints", () => {
    const puzzle = generateLevel(30);
    const session = createSession(puzzle);
    let guard = 0;
    while (minPar(puzzle, session.cells) > 0 && guard < 400) {
      const move = nextHint(puzzle, session.cells);
      if (!move) break;
      const i = session.cells.findIndex((c) => c.row === move.row && c.col === move.col);
      session.cells[i] = { ...session.cells[i]!, direction: move.to };
      guard += 1;
    }
    expect(minPar(puzzle, session.cells)).toBe(0);
  });

  it("returns no hint for an already-solved board", () => {
    const puzzle = applyCanonicalAndSolve(generateLevel(12));
    expect(nextHint(puzzle, puzzle.cells)).toBeUndefined();
  });

  it("returns no hint when no editable cell is wrong", () => {
    const puzzle = generatePuzzle(3, { id: "empty", pack: "pulse", level: 1 });
    expect(nextHint(puzzle, applyCanonical(puzzle.cells))).toBeUndefined();
  });
});

function applyCanonicalAndSolve(puzzle: Puzzle): Puzzle {
  return { ...puzzle, cells: applyCanonical(puzzle.cells) };
}
