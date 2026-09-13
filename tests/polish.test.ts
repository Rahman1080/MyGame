import { describe, expect, it } from "vitest";
import { generateLevel, generatePuzzle } from "../src/gen/generator";
import { difficultyRating, profileForLevel } from "../src/gen/difficulty";
import {
  applyCanonical,
  applyHint,
  canonicalPar,
  createSession,
  nextHint,
  simulatePuzzle,
  type ColorName,
} from "../src/engine";

describe("difficulty curve", () => {
  it("lands canonical par within tolerance of the target ramp", () => {
    for (let level = 4; level <= 80; level += 1) {
      const puzzle = generateLevel(level);
      const target = profileForLevel(level).targetPar;
      expect(target).toBeDefined();
      expect(Math.abs(puzzle.par - target!)).toBeLessThanOrEqual(1);
    }
  }, 60000);

  it("grows clearly from early to late game", () => {
    expect(generateLevel(80).par).toBeGreaterThan(generateLevel(6).par + 10);
    expect(difficultyRating(generateLevel(80).difficulty)).toBeGreaterThan(
      difficultyRating(generateLevel(6).difficulty),
    );
  });

  it("uses the canonical target label for every generated level", () => {
    const puzzle = generatePuzzle(7, { id: "target", pack: "pulse", level: 8 });
    expect(puzzle.parKind).toBe("canonical");
    expect(puzzle.par).toBe(canonicalPar(puzzle.cells));
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
  it("reduces canonical distance by exactly one for every story level", () => {
    for (let level = 4; level <= 80; level += 1) {
      const puzzle = generateLevel(level);
      const before = canonicalPar(puzzle.cells);
      const move = nextHint(puzzle, puzzle.cells);
      expect(move).toBeDefined();
      const cells = puzzle.cells.map((c) =>
        c.row === move!.row && c.col === move!.col ? { ...c, direction: move!.to } : c,
      );
      expect(canonicalPar(cells)).toBe(before - 1);
    }
  }, 60000);

  it("records a visible hint and fires only once per puzzle", () => {
    const session = createSession(generateLevel(20));
    expect(applyHint(session)).toBe(true);
    expect(session.hint).not.toBeNull();
    expect(session.hintUsed).toBe(true);
    expect(applyHint(session)).toBe(false);
  });

  it("solves to canonical zero when the player follows hints", () => {
    const puzzle = generateLevel(30);
    const session = createSession(puzzle);
    let guard = 0;
    while (canonicalPar(session.cells) > 0 && guard < 400) {
      const move = nextHint(puzzle, session.cells);
      if (!move) break;
      const i = session.cells.findIndex((c) => c.row === move.row && c.col === move.col);
      session.cells[i] = { ...session.cells[i]!, direction: move.to };
      guard += 1;
    }
    expect(canonicalPar(session.cells)).toBe(0);
  });
});
