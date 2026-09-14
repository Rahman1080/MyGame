import { describe, expect, it } from "vitest";
import {
  applyCanonical,
  buildSolution,
  createSession,
  getHint,
  hintLevel,
  minimumRotationSolver,
  rankCandidates,
  requestHint,
  reset,
  simulatePuzzle,
  solutionDistance,
  solvedPreview,
} from "../src/engine";
import { DIR_DOWN, DIR_LEFT, DIR_RIGHT, DIR_UP } from "../src/engine/types";
import type { Cell, Coord, Direction, Puzzle } from "../src/engine/types";
import { generateLevel } from "../src/gen/generator";
import { cell, fillGrid, straightPuzzle } from "./helpers";

function stateOf(puzzle: Puzzle, cells: Cell[] = puzzle.cells) {
  return {
    puzzleId: puzzle.id,
    cells,
    rotations: 0,
    hintUsed: false,
    strongHintUsed: false,
  };
}

function applyAction(cells: Cell[], action: { row: number; col: number; to: Direction }): Cell[] {
  return cells.map((c) =>
    c.row === action.row && c.col === action.col ? { ...c, direction: action.to } : c,
  );
}

function minRotations(puzzle: Puzzle, cells: Cell[] = puzzle.cells): number {
  const r = minimumRotationSolver({ ...puzzle, cells });
  return r.solvable ? r.rotations : Number.POSITIVE_INFINITY;
}

function build(size: number, placed: Cell[], start: Coord, exit: Coord, pack: string): Puzzle {
  return {
    id: "hint-test",
    seed: 1,
    size,
    cells: fillGrid(size, placed),
    start,
    exit,
    par: 0,
    difficulty: 1,
    pack,
  };
}

function deadEndPuzzle(): Puzzle {
  const p = straightPuzzle();
  return {
    ...p,
    cells: p.cells.map((c) => (c.row === 0 && c.col === 1 ? { ...c, direction: DIR_UP } : c)),
  };
}

describe("hint basics", () => {
  it("finds an incorrect cell and suggests exactly one clockwise rotation", () => {
    const p = deadEndPuzzle();
    const hint = getHint(p, stateOf(p));
    expect(hint.available).toBe(true);
    expect(hint.action).toEqual({ row: 0, col: 1, from: DIR_UP, to: DIR_RIGHT, clockwiseSteps: 1 });
  });

  it("preserves solvability and reduces the exact minimum by one", () => {
    for (let level = 4; level <= 40; level += 1) {
      const puzzle = generateLevel(level);
      const before = minRotations(puzzle);
      const hint = getHint(puzzle, stateOf(puzzle));
      expect(hint.available, `level ${level} produced no hint`).toBe(true);
      const after = applyAction(puzzle.cells, hint.action!);
      expect(minRotations(puzzle, after), `level ${level}`).toBe(before - 1);
      expect(hint.confidence, `level ${level}`).toBe("exact");
    }
  }, 60000);

  it("is deterministic for the same board", () => {
    const puzzle = generateLevel(24);
    const a = getHint(puzzle, stateOf(puzzle));
    const b = getHint(puzzle, stateOf(puzzle));
    expect(a).toEqual(b);
  });

  it("never targets a locked cell or a portal/wall", () => {
    for (const level of [8, 30, 58, 85, 105]) {
      const puzzle = generateLevel(level);
      const hint = getHint(puzzle, stateOf(puzzle));
      expect(hint.available, `level ${level}`).toBe(true);
      const target = puzzle.cells.find((c) => c.row === hint.action!.row && c.col === hint.action!.col)!;
      expect(target.locked, `level ${level} locked`).toBeFalsy();
      expect(["portal", "wall", "empty", "exit"]).not.toContain(target.type);
      expect(target.type === "portal" || target.type === "wall").toBe(false);
    }
  });

  it("returns no hint for an already solved board", () => {
    const puzzle = generateLevel(12);
    const solved = applyCanonical(puzzle.cells);
    expect(getHint(puzzle, stateOf(puzzle, solved)).available).toBe(false);
  });

  it("does not mutate the board", () => {
    const puzzle = generateLevel(20);
    const before = JSON.stringify(puzzle.cells);
    getHint(puzzle, stateOf(puzzle));
    expect(JSON.stringify(puzzle.cells)).toBe(before);
  });
});

describe("hint current-state analysis", () => {
  it("honours correct progress and never asks the player to undo it", () => {
    const puzzle = generateLevel(30);
    const solution = buildSolution(puzzle, puzzle.cells)!;
    const first = solution.actions[0]!;
    const cells = applyAction(puzzle.cells, first);
    const distance = solutionDistance(cells, solution);
    const hint = getHint(puzzle, stateOf(puzzle, cells));
    expect(hint.available).toBe(true);
    expect(hint.distance).toBe(distance);
    // The next hint makes further verified progress instead of undoing the move.
    expect(minRotations(puzzle, applyAction(cells, hint.action!))).toBe(distance - 1);
  });

  it("recovers from a dead end with a verified improving move", () => {
    const p = deadEndPuzzle();
    const hint = getHint(p, stateOf(p));
    expect(hint.available).toBe(true);
    expect(minRotations(p, applyAction(p.cells, hint.action!))).toBe(minRotations(p) - 1);
  });

  it("still helps after several bad rotations", () => {
    const puzzle = generateLevel(26);
    const bad = puzzle.cells.map((c, i) =>
      c.direction !== undefined && i % 3 === 0 ? { ...c, direction: ((c.direction + 1) % 4) as Direction } : c,
    );
    const hint = getHint(puzzle, stateOf(puzzle, bad));
    expect(hint.available).toBe(true);
    const after = applyAction(bad, hint.action!);
    const solved = minimumRotationSolver({ ...puzzle, cells: after });
    expect(solved.solvable).toBe(true);
  });

  it("can be one rotation from success", () => {
    const p = deadEndPuzzle();
    const hint = getHint(p, stateOf(p));
    expect(hint.distance).toBe(1);
    expect(hint.message).toBeDefined();
  });

  it("follows hints to an exact solve from any state", () => {
    const puzzle = generateLevel(35);
    let cells = puzzle.cells.map((c) => ({ ...c }));
    let guard = 0;
    while (minRotations(puzzle, cells) > 0 && guard < 400) {
      const hint = getHint(puzzle, stateOf(puzzle, cells));
      if (!hint.available) break;
      cells = applyAction(cells, hint.action!);
      guard += 1;
    }
    expect(minRotations(puzzle, cells)).toBe(0);
    expect(simulatePuzzle(puzzle, cells).outcome).toBe("win");
  });

  it("recovers a self-looping board", () => {
    const p = straightPuzzle();
    const looped = {
      ...p,
      cells: p.cells.map((c) => (c.row === 0 && c.col === 1 ? { ...c, direction: DIR_LEFT } : c)),
    };
    const hint = getHint(looped, stateOf(looped));
    expect(hint.available).toBe(true);
    expect(minRotations(looped, applyAction(looped.cells, hint.action!))).toBe(minRotations(looped) - 1);
  });

  it("excludes cells that already match the solution from candidates", () => {
    const puzzle = generateLevel(28);
    const solution = buildSolution(puzzle, puzzle.cells)!;
    const correct = solution.directions.findIndex(
      (d, i) => d !== undefined && puzzle.cells[i]!.direction === d,
    );
    expect(correct).toBeGreaterThanOrEqual(0);
    const candidates = rankCandidates(puzzle, puzzle.cells, solution);
    expect(candidates.every((c) => c.index !== correct)).toBe(true);
  });

  it("message matches the verified action, one clockwise step", () => {
    const puzzle = generateLevel(18);
    const hint = getHint(puzzle, stateOf(puzzle));
    expect(hint.available).toBe(true);
    expect(hint.action!.to).toBe(((hint.action!.from + 1) % 4) as Direction);
    expect(hint.message).toContain("clockwise");
  });
});

describe("hint mechanics", () => {
  it("verifies hints on color-gate levels", () => {
    const puzzle = generateLevel(58);
    const before = minRotations(puzzle);
    const hint = getHint(puzzle, stateOf(puzzle));
    expect(hint.available).toBe(true);
    expect(minRotations(puzzle, applyAction(puzzle.cells, hint.action!))).toBe(before - 1);
  });

  it("verifies hints on portal levels", () => {
    const puzzle = generateLevel(85);
    const before = minRotations(puzzle);
    const hint = getHint(puzzle, stateOf(puzzle));
    expect(hint.available).toBe(true);
    expect(minRotations(puzzle, applyAction(puzzle.cells, hint.action!))).toBe(before - 1);
  });

  it("verifies hints on one-way-wall levels", () => {
    const puzzle = generateLevel(105);
    const before = minRotations(puzzle);
    const hint = getHint(puzzle, stateOf(puzzle));
    expect(hint.available).toBe(true);
    expect(minRotations(puzzle, applyAction(puzzle.cells, hint.action!))).toBe(before - 1);
  });

  it("explains a blocked-wall failure with a verified move", () => {
    const puzzle = generateLevel(105);
    const hint = getHint(puzzle, { ...stateOf(puzzle), lastFailReason: "BLOCKED_WALL" });
    expect(hint.available).toBe(true);
    expect(hint.message).toContain("one-way wall");
  });

  it("handles future mechanic cells without emitting unsafe advice", () => {
    const p = build(
      3,
      [
        cell(0, 0, "start", DIR_RIGHT),
        cell(0, 1, "splitter", DIR_RIGHT),
        cell(0, 2, "arrow", DIR_DOWN),
        cell(1, 2, "exit"),
      ],
      { row: 0, col: 0 },
      { row: 1, col: 2 },
      "pulse",
    );
    const hint = getHint(p, stateOf(p));
    if (hint.available) {
      const after = applyAction(p.cells, hint.action!);
      expect(simulatePuzzle(p, after).outcome === "win" || minimumRotationSolver({ ...p, cells: after }).solvable).toBe(
        true,
      );
    }
  });
});

describe("hint sessions and second level", () => {
  it("shows a hint without rotating or altering the puzzle", () => {
    const puzzle = generateLevel(20);
    const session = createSession(puzzle);
    const before = JSON.stringify(session.cells);
    const result = requestHint(session, 1);
    expect(result?.available).toBe(true);
    expect(JSON.stringify(session.cells)).toBe(before);
    expect(session.rotations).toBe(0);
    expect(session.hintUsed).toBe(true);
    expect(session.hint?.message && session.hint.message.length > 0).toBe(true);
  });

  it("tracks the two-level hint flow", () => {
    const puzzle = generateLevel(40);
    const session = createSession(puzzle);
    expect(hintLevel(session)).toBe(1);
    const first = requestHint(session, 1);
    expect(first?.available).toBe(true);
    expect(hintLevel(session)).toBe(2);
    session.cells = applyAction(session.cells, first!.action!);
    session.rotations += 1;
    session.hint = null;
    const second = requestHint(session, 2);
    expect(second?.available).toBe(true);
    expect(second?.distance).toBe((first?.distance ?? 0) - 1);
    expect(hintLevel(session)).toBe(0);
    if (second?.secondAction) {
      const both = applyAction(session.cells, second.secondAction);
      const solved = minimumRotationSolver({ ...puzzle, cells: both });
      expect(solved.solvable).toBe(true);
    }
  });

  it("does not refund a spent first hint after reset", () => {
    const session = createSession(generateLevel(20));
    requestHint(session, 1);
    reset(session);
    expect(session.hintUsed).toBe(true);
    expect(requestHint(session, 1)).toBeNull();
  });

  it("rejects a second hint before the first is used", () => {
    const session = createSession(generateLevel(20));
    expect(requestHint(session, 2)).toBeNull();
  });

  it("uses failure information when a hint is requested", () => {
    const session = createSession(generateLevel(58));
    session.lastFailReason = "WRONG_COLOR";
    session.hintUsed = false;
    const result = requestHint(session, 1);
    expect(result?.available).toBe(true);
    expect(result?.message).toBeDefined();
  });
});

describe("solved preview", () => {
  it("returns a solved board whose route wins", () => {
    const p = straightPuzzle();
    const preview = solvedPreview(p);
    expect(preview).not.toBeNull();
    expect(preview!.cells).toHaveLength(p.cells.length);
    expect(preview!.path.length).toBeGreaterThan(1);
    expect(simulatePuzzle(p, preview!.cells).outcome).toBe("win");
  });

  it("reports an exact minimum for a proven board", () => {
    const p = deadEndPuzzle();
    const preview = solvedPreview(p)!;
    const minimum = minimumRotationSolver(p);
    expect(preview.exact).toBe(true);
    expect(preview.parKind).toBe("minimum");
    expect(preview.rotations).toBe(minimum.rotations);
  });

  it("is deterministic and does not mutate the input puzzle", () => {
    const p = straightPuzzle();
    const before = JSON.stringify(p.cells);
    const a = solvedPreview(p)!;
    const b = solvedPreview(p)!;
    expect(JSON.stringify(p.cells)).toBe(before);
    expect(a.cells.map((c) => c.direction)).toEqual(b.cells.map((c) => c.direction));
    expect(a.exact).toBe(b.exact);
  });

  it("preserves locked directions", () => {
    const p = straightPuzzle();
    const locked = {
      ...p,
      cells: p.cells.map((c) => (c.row === 0 && c.col === 1 ? { ...c, locked: true, direction: DIR_RIGHT } : c)),
    };
    const preview = solvedPreview(locked)!;
    const cellLocked = preview.cells.find((c) => c.row === 0 && c.col === 1)!;
    expect(cellLocked.direction).toBe(DIR_RIGHT);
    expect(simulatePuzzle(locked, preview.cells).outcome).toBe("win");
  });

  it("produces a winning preview across mechanics", () => {
    for (const level of [35, 58, 85, 105]) {
      const puzzle = generateLevel(level);
      const preview = solvedPreview(puzzle);
      expect(preview, `level ${level}`).not.toBeNull();
      expect(simulatePuzzle(puzzle, preview!.cells).outcome, `level ${level}`).toBe("win");
      if (preview!.exact) expect(preview!.parKind).toBe("minimum");
      else expect(preview!.parKind).toBe("canonical");
    }
  });
});
