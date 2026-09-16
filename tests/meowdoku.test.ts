import { describe, expect, it } from "vitest";
import {
  gridSizeForLevel,
  MeowdokuEngine,
} from "../src/games/meowdoku/engine";

describe("Meowdoku Engine", () => {
  it("determines correct grid sizes based on level ladder", () => {
    expect(gridSizeForLevel(1)).toBe(5);
    expect(gridSizeForLevel(3)).toBe(5);
    expect(gridSizeForLevel(4)).toBe(6);
    expect(gridSizeForLevel(7)).toBe(6);
    expect(gridSizeForLevel(8)).toBe(7);
    expect(gridSizeForLevel(12)).toBe(7);
    expect(gridSizeForLevel(13)).toBe(8);
    expect(gridSizeForLevel(19)).toBe(8);
    expect(gridSizeForLevel(20)).toBe(9);
    expect(gridSizeForLevel(50)).toBe(9);
  });

  it("generates a valid 5x5 puzzle for level 1", () => {
    const engine = new MeowdokuEngine();
    engine.newLevel(1, "test-seed-1");

    expect(engine.size).toBe(5);
    expect(engine.grid.length).toBe(5);
    expect(engine.grid[0]?.length).toBe(5);
    expect(engine.solution.length).toBe(5);
    expect(engine.hearts).toBe(3);
    expect(engine.phase).toBe("play");

    // Check that each region ID is 0..4
    const regions = new Set<number>();
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const reg = engine.grid[r]?.[c]?.region;
        if (reg !== undefined) {
          regions.add(reg);
        }
      }
    }
    expect(regions.size).toBe(5);

    // Verify the solution adheres to all 3 Meowdoku rules:
    // 1. One cat per row & column
    const solRows = new Set(engine.solution.map((s) => s.row));
    const solCols = new Set(engine.solution.map((s) => s.col));
    expect(solRows.size).toBe(5);
    expect(solCols.size).toBe(5);

    // 2. One cat per region
    const solRegions = new Set(
      engine.solution.map((s) => engine.grid[s.row]?.[s.col]?.region),
    );
    expect(solRegions.size).toBe(5);

    // 3. No touching (not even diagonally)
    for (let i = 0; i < engine.solution.length; i++) {
      for (let j = i + 1; j < engine.solution.length; j++) {
        const a = engine.solution[i]!;
        const b = engine.solution[j]!;
        const rowDiff = Math.abs(a.row - b.row);
        const colDiff = Math.abs(a.col - b.col);
        expect(rowDiff <= 1 && colDiff <= 1).toBe(false);
      }
    }
  });

  it("handles single-tap cell marking cycles (empty -> x -> empty)", () => {
    const engine = new MeowdokuEngine();
    engine.newLevel(1, "test-seed-2");

    // First tap -> marks X
    const res1 = engine.tapCell(0, 0);
    expect(res1).toBe("x");
    expect(engine.grid[0]?.[0]?.mark).toBe("x");

    // Second tap -> clears X
    const res2 = engine.tapCell(0, 0);
    expect(res2).toBe("cleared");
    expect(engine.grid[0]?.[0]?.mark).toBe("empty");
  });

  it("handles correct cat placement and win detection", () => {
    const engine = new MeowdokuEngine();
    engine.newLevel(1, "test-seed-3");

    // Place all correct solution cats
    for (let i = 0; i < engine.solution.length; i++) {
      const sol = engine.solution[i]!;
      const ok = engine.placeCat(sol.row, sol.col);
      expect(ok).toBe(true);
      expect(engine.grid[sol.row]?.[sol.col]?.mark).toBe("cat");
    }

    expect(engine.phase).toBe("won");
    expect(engine.catsPlaced).toBe(5);
    expect(engine.getStars()).toBe(3);
  });

  it("penalizes rule-breaking placements by decrementing hearts", () => {
    const engine = new MeowdokuEngine();
    engine.newLevel(1, "test-seed-4");

    const n = engine.size;
    const first = engine.solution[0]!;
    expect(engine.placeCat(first.row, first.col)).toBe(true);
    expect(engine.hearts).toBe(3);

    const conflicts = [
      { row: first.row, col: (first.col + 1) % n }, // same row
      { row: (first.row + 1) % n, col: first.col }, // same column
      {
        row: first.row + 1 < n ? first.row + 1 : first.row - 1,
        col: first.col + 1 < n ? first.col + 1 : first.col - 1,
      }, // touching diagonally
    ];

    for (const cell of conflicts) {
      const ok = engine.placeCat(cell.row, cell.col);
      expect(ok).toBe(false);
      expect(engine.grid[cell.row]?.[cell.col]?.mark).toBe("empty");
    }

    expect(engine.hearts).toBe(0);
    expect(engine.phase).toBe("over");
  });

  it("accepts any rule-valid placement, not just the generated solution", () => {
    const engine = new MeowdokuEngine();
    engine.newLevel(1, "test-seed-4b");

    // On an empty board every cell obeys the rules, even a non-solution cell.
    let nonSolution: { row: number; col: number } | null = null;
    for (let r = 0; r < engine.size && !nonSolution; r++) {
      for (let c = 0; c < engine.size; c++) {
        if (engine.grid[r]?.[c] && !engine.grid[r]![c]!.correct) {
          nonSolution = { row: r, col: c };
          break;
        }
      }
    }
    expect(nonSolution).not.toBeNull();

    const ok = engine.placeCat(nonSolution!.row, nonSolution!.col);
    expect(ok).toBe(true);
    expect(engine.grid[nonSolution!.row]?.[nonSolution!.col]?.mark).toBe("cat");
    expect(engine.hearts).toBe(3);
  });

  it("preserves an X and leaves no stale undo entry when a placement is rejected", () => {
    const engine = new MeowdokuEngine();
    engine.newLevel(1, "test-seed-4c");

    const n = engine.size;
    const first = engine.solution[0]!;
    const conflict = { row: first.row, col: (first.col + 1) % n };

    engine.tapCell(conflict.row, conflict.col); // -> x
    expect(engine.grid[conflict.row]?.[conflict.col]?.mark).toBe("x");

    engine.placeCat(first.row, first.col); // valid anchor
    const undoLen = engine.undoStack.length;

    const ok = engine.placeCat(conflict.row, conflict.col);
    expect(ok).toBe(false);
    expect(engine.grid[conflict.row]?.[conflict.col]?.mark).toBe("x");
    expect(engine.undoStack.length).toBe(undoLen);
  });

  it("makes removeCat undoable", () => {
    const engine = new MeowdokuEngine();
    engine.newLevel(1, "test-seed-4d");

    const sol = engine.solution[0]!;
    engine.placeCat(sol.row, sol.col);
    engine.removeCat(sol.row, sol.col);
    expect(engine.grid[sol.row]?.[sol.col]?.mark).toBe("empty");

    engine.undo();
    expect(engine.grid[sol.row]?.[sol.col]?.mark).toBe("cat");
    expect(engine.catsPlaced).toBe(1);
  });

  it("clears conflict highlighting after a hint", () => {
    const engine = new MeowdokuEngine();
    engine.newLevel(1, "test-seed-4e");

    const n = engine.size;
    const first = engine.solution[0]!;
    engine.placeCat(first.row, first.col);
    engine.placeCat(first.row, (first.col + 1) % n); // conflict
    expect(engine.invalidCells.length).toBeGreaterThan(0);

    engine.useHint();
    expect(engine.invalidCells.length).toBe(0);
  });

  it("supports undoing moves", () => {
    const engine = new MeowdokuEngine();
    engine.newLevel(1, "test-seed-5");

    engine.tapCell(1, 1); // marks x
    expect(engine.grid[1]?.[1]?.mark).toBe("x");

    const undo1 = engine.undo();
    expect(undo1).not.toBeNull();
    expect(engine.grid[1]?.[1]?.mark).toBe("empty");

    // Place correct cat
    const sol0 = engine.solution[0]!;
    engine.placeCat(sol0.row, sol0.col);
    expect(engine.grid[sol0.row]?.[sol0.col]?.mark).toBe("cat");

    const undo2 = engine.undo();
    expect(undo2).not.toBeNull();
    expect(engine.grid[sol0.row]?.[sol0.col]?.mark).toBe("empty");
    expect(engine.catsPlaced).toBe(0);
  });

  it("supports hints to reveal an unplaced solution cell", () => {
    const engine = new MeowdokuEngine();
    engine.newLevel(1, "test-seed-6");

    expect(engine.hintsRemaining).toBe(2);
    const hint = engine.useHint();
    expect(hint).not.toBeNull();
    expect(engine.hintsRemaining).toBe(1);
    expect(engine.grid[hint!.row]?.[hint!.col]?.mark).toBe("cat");
    expect(engine.catsPlaced).toBe(1);

    const hint2 = engine.useHint();
    expect(hint2).not.toBeNull();
    expect(engine.hintsRemaining).toBe(0);

    // No more hints left
    const hint3 = engine.useHint();
    expect(hint3).toBeNull();
  });

  it("produces deterministic puzzles with the same seed", () => {
    const eng1 = new MeowdokuEngine();
    eng1.newLevel(2, "identical-seed");

    const eng2 = new MeowdokuEngine();
    eng2.newLevel(2, "identical-seed");

    expect(eng1.solution).toEqual(eng2.solution);
    for (let r = 0; r < eng1.size; r++) {
      for (let c = 0; c < eng1.size; c++) {
        expect(eng1.grid[r]?.[c]?.region).toBe(eng2.grid[r]?.[c]?.region);
      }
    }
  });

  it("removes placed cats when tapCell is called on them or via removeCat", () => {
    const engine = new MeowdokuEngine();
    engine.newLevel(1, "test-seed-7");

    const sol0 = engine.solution[0]!;
    engine.placeCat(sol0.row, sol0.col);
    expect(engine.grid[sol0.row]?.[sol0.col]?.mark).toBe("cat");

    const res = engine.tapCell(sol0.row, sol0.col);
    expect(res).toBe("removed");
    expect(engine.grid[sol0.row]?.[sol0.col]?.mark).toBe("empty");
  });
});
