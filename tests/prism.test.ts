import { describe, expect, it } from "vitest";
import {
  canPour,
  cloneTubes,
  createState,
  isSolved,
  isTubeComplete,
  isValidState,
  legalMoves,
  pour,
  pourCount,
  reset,
  stateKey,
  topColor,
  topRun,
  undo,
  type PrismState,
  type Tube,
} from "../src/games/prism/logic";
import { hint, solve } from "../src/games/prism/solver";
import {
  PRISM_DAILY_ID,
  PRISM_LEVELS,
  colorsForLevel,
  dailyPuzzle,
  dealTubes,
  generatePuzzle,
  levelPuzzle,
  puzzleById,
  puzzleTitle,
  starsForMoves,
} from "../src/games/prism/generate";
import { createSaveService } from "../src/platform/services/save";
import type { PrismSave } from "../src/save/schema";
import type { StorageLike } from "../src/save/storage";

class Mem implements StorageLike {
  map = new Map<string, string>();
  getItem(k: string): string | null {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v);
  }
}

function state(tubes: Tube[], capacity = 4, colors = 3, seed = "t"): PrismState {
  return createState(seed, tubes, colors, capacity);
}

function applySolution(s: PrismState, moves: { from: number; to: number }[]): boolean {
  for (const m of moves) {
    const before = s.moves.length;
    pour(s, m.from, m.to);
    if (s.moves.length !== before + 1) return false;
  }
  return isSolved(s);
}

function boardString(tubes: Tube[]): string {
  return tubes
    .filter((t) => t.length > 0)
    .map((t) => t.join(""))
    .sort()
    .join("|");
}

describe("prism core rules", () => {
  it("reads top color and top run", () => {
    expect(topColor([])).toBeNull();
    expect(topColor([0, 1, 1])).toBe(1);
    expect(topRun([])).toBe(0);
    expect(topRun([0, 1, 1, 1])).toBe(3);
    expect(topRun([1, 1, 1, 1])).toBe(4);
  });

  it("allows a pour only onto empty or matching tops", () => {
    const s = state([
      [0, 1],
      [1],
      [],
      [2, 2, 2, 2],
    ]);
    expect(canPour(s, 0, 1)).toBe(true);
    expect(canPour(s, 0, 2)).toBe(true);
    expect(canPour(s, 1, 0)).toBe(true);
    expect(canPour(s, 1, 3)).toBe(false);
    expect(canPour(s, 3, 0)).toBe(false);
    expect(canPour(s, 0, 0)).toBe(false);
    expect(canPour(s, 2, 1)).toBe(false);
  });

  it("rejects moves from empty or into full tubes", () => {
    const s = state([
      [],
      [1, 1, 1, 1],
      [0],
      [0],
    ]);
    expect(pourCount(s, 0, 2)).toBe(0);
    expect(pourCount(s, 1, 2)).toBe(0);
    expect(pour(s, 0, 2)).toBeNull();
    expect(pour(s, 1, 2)).toBeNull();
    expect(s.moves.length).toBe(0);
  });

  it("transfers a single top piece", () => {
    const s = state([
      [0, 1],
      [1, 1],
      [],
    ]);
    const move = pour(s, 0, 1);
    expect(move).toEqual({ from: 0, to: 1, color: 1, count: 1 });
    expect(s.tubes[0]).toEqual([0]);
    expect(s.tubes[1]).toEqual([1, 1, 1]);
  });

  it("transfers a whole top run into an empty tube", () => {
    const s = state([
      [0, 2, 2, 2],
      [],
      [],
    ]);
    const move = pour(s, 0, 1);
    expect(move?.count).toBe(3);
    expect(s.tubes[0]).toEqual([0]);
    expect(s.tubes[1]).toEqual([2, 2, 2]);
  });

  it("transfers only as much as the destination can accept", () => {
    const s = state([
      [2, 2, 2, 2],
      [2, 2],
      [],
    ]);
    const move = pour(s, 0, 1);
    expect(move?.count).toBe(2);
    expect(s.tubes[0]).toEqual([2, 2]);
    expect(s.tubes[1]).toEqual([2, 2, 2, 2]);
  });

  it("conserves every color count across arbitrary legal moves", () => {
    let s = state(dealTubes("prism:stress:1", 4, 4, 2), 4, 4);
    for (let i = 0; i < 200; i += 1) {
      const moves = legalMoves(s);
      if (moves.length === 0) break;
      const m = moves[(i * 7) % moves.length]!;
      pour(s, m.from, m.to);
      expect(isValidState(s)).toBe(true);
    }
  });
});

describe("prism solved state", () => {
  it("detects a solved board with full monochrome tubes and empties", () => {
    const s = state([
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [],
      [],
    ], 4, 2);
    expect(isSolved(s)).toBe(true);
    expect(isTubeComplete([0, 0, 0, 0], 2, 4)).toBe(true);
  });

  it("rejects partial or mixed tubes", () => {
    expect(isSolved(state([[0, 0, 0]], 4, 2))).toBe(false);
    expect(isSolved(state([[0, 0, 1, 1], [1, 1, 0, 0]], 4, 2))).toBe(false);
    expect(isTubeComplete([0, 0], 2, 4)).toBe(false);
  });

  it("flags completion automatically when the last pour finishes the board", () => {
    const s = state([
      [1, 1, 1],
      [1],
      [0, 0, 0, 0],
      [],
    ], 4, 2);
    expect(s.status).toBe("playing");
    pour(s, 1, 0);
    expect(isSolved(s)).toBe(true);
    expect(s.status).toBe("won");
  });
});

describe("prism undo and reset", () => {
  it("undo restores the exact previous board and move count", () => {
    const s = state(dealTubes("prism:undo:1", 4, 4, 2), 4, 4);
    const before = cloneTubes(s.tubes);
    const m = legalMoves(s)[0]!;
    pour(s, m.from, m.to);
    expect(s.moves.length).toBe(1);
    const reverted = undo(s);
    expect(reverted).toEqual(m);
    expect(s.tubes).toEqual(before);
    expect(s.moves.length).toBe(0);
    expect(undo(s)).toBeNull();
  });

  it("reset returns to the original board and clears history", () => {
    const initial = dealTubes("prism:reset:1", 4, 4, 2);
    const s = state(initial, 4, 4);
    pour(s, legalMoves(s)[0]!.from, legalMoves(s)[0]!.to);
    reset(s, initial);
    expect(s.tubes).toEqual(initial);
    expect(s.moves.length).toBe(0);
    expect(s.status).toBe("playing");
  });
});

describe("prism solver", () => {
  it("returns a legal solution that solves the board", () => {
    const p = levelPuzzle(1);
    const s = state(p.tubes, p.capacity, p.colors, p.seed);
    const result = solve(s);
    expect(result.solved).toBe(true);
    expect(result.solution.length).toBeGreaterThan(0);
    expect(applySolution(s, result.solution)).toBe(true);
  });

  it("reports an already-solved board with no moves", () => {
    const s = state([[0, 0, 0, 0], [1, 1, 1, 1], [], []], 4, 2);
    const result = solve(s);
    expect(result.solved).toBe(true);
    expect(result.solution).toEqual([]);
  });

  it("proves a deadlocked small board unsolvable", () => {
    const s = state([[0, 1], [1, 2], [2, 0]], 2, 3);
    expect(legalMoves(s).length).toBe(0);
    const result = solve(s);
    expect(result.solved).toBe(false);
    expect(result.exhausted).toBe(false);
  });

  it("is deterministic for the same position", () => {
    const p = levelPuzzle(2);
    const a = solve(state(p.tubes, p.capacity, p.colors, p.seed));
    const b = solve(state(p.tubes, p.capacity, p.colors, p.seed));
    expect(a.solution).toEqual(b.solution);
  });

  it("respects the expansion budget and flags exhaustion", () => {
    const p = levelPuzzle(1);
    const result = solve(state(p.tubes, p.capacity, p.colors, p.seed), { maxExpanded: 1 });
    expect(result.expanded).toBeLessThanOrEqual(1);
    if (!result.solved) expect(result.exhausted).toBe(true);
  });
});

describe("prism hints", () => {
  it("returns the solver's first safe move", () => {
    const p = levelPuzzle(3);
    const s = state(p.tubes, p.capacity, p.colors, p.seed);
    const h = hint(s);
    expect(h.kind).toBe("move");
    if (h.kind !== "move") return;
    expect(canPour(s, h.move.from, h.move.to)).toBe(true);
    pour(s, h.move.from, h.move.to);
    const after = solve(s);
    expect(after.solved).toBe(true);
  });

  it("never recommends a random or illegal move", () => {
    const p = levelPuzzle(4);
    const s = state(p.tubes, p.capacity, p.colors, p.seed);
    const first = hint(s);
    const second = hint(s);
    expect(first).toEqual(second);
    if (first.kind === "move") {
      const legal = legalMoves(s);
      expect(legal.some((m) => m.from === first.move.from && m.to === first.move.to)).toBe(true);
    }
  });

  it("reports solved for a finished board", () => {
    expect(hint(state([[0, 0, 0, 0], [1, 1, 1, 1], [], []], 4, 2)).kind).toBe("solved");
  });

  it("detects an unsolvable position and asks for a reset", () => {
    const s = state([[0, 1], [1, 2], [2, 0]], 2, 3);
    const h = hint(s);
    expect(h.kind).toBe("unsolvable");
    if (h.kind === "unsolvable") expect(h.certain).toBe(true);
  });
});

describe("prism generation", () => {
  it("generates a guaranteed-solvable board and solver-verified solution for early levels", () => {
    for (let level = 1; level <= 6; level += 1) {
      const p = levelPuzzle(level);
      const s = state(p.tubes, p.capacity, p.colors, p.seed);
      expect(isValidState(s)).toBe(true);
      expect(isSolved(s)).toBe(false);
      expect(applySolution(s, p.solution)).toBe(true);
      expect(p.colors).toBe(colorsForLevel(level));
    }
  });

  it("generates solvable boards for the hardest level and the daily", () => {
    for (const p of [levelPuzzle(PRISM_LEVELS), dailyPuzzle("2026-09-15")]) {
      const s = state(p.tubes, p.capacity, p.colors, p.seed);
      expect(isValidState(s)).toBe(true);
      const result = solve(s);
      expect(result.solved).toBe(true);
    }
  });

  it("is deterministic for a fixed seed", () => {
    const a = generatePuzzle("prism:fix:1", "prism-1", { colors: 4 });
    const b = generatePuzzle("prism:fix:1", "prism-1", { colors: 4 });
    expect(a.tubes).toEqual(b.tubes);
    expect(a.solution).toEqual(b.solution);
  });

  it("produces sufficiently different boards for different seeds", () => {
    const boards = Array.from({ length: 8 }, (_, i) =>
      boardString(generatePuzzle(`prism:differ:${i}`, `s${i}`, { colors: 4 }).tubes),
    );
    expect(new Set(boards).size).toBeGreaterThanOrEqual(6);
    let diff = 0;
    let pairs = 0;
    for (let i = 0; i < boards.length; i += 1) {
      for (let j = i + 1; j < boards.length; j += 1) {
        const a = boards[i]!;
        const b = boards[j]!;
        let d = Math.abs(a.length - b.length);
        for (let k = 0; k < Math.min(a.length, b.length); k += 1) if (a[k] !== b[k]) d += 1;
        diff += d / Math.max(a.length, b.length);
        pairs += 1;
      }
    }
    expect(diff / pairs).toBeGreaterThan(0.5);
  });

  it("rejects invalid generation inputs safely", () => {
    const p = generatePuzzle("prism:min:1", "min", { colors: 2, capacity: 2, empty: 1 });
    expect(isValidState(state(p.tubes, p.capacity, p.colors, p.seed))).toBe(true);
    expect(p.colors).toBe(2);
  });
});

describe("prism daily configuration", () => {
  it("is deterministic per date and distinct across dates", () => {
    const a = dailyPuzzle("2026-09-15");
    const b = dailyPuzzle("2026-09-15");
    const c = dailyPuzzle("2026-09-16");
    expect(a.tubes).toEqual(b.tubes);
    expect(a.id).toBe(`prism-daily-2026-09-15`);
    expect(a.tubes).not.toEqual(c.tubes);
  });

  it("resolves daily and numbered puzzles by id", () => {
    expect(puzzleById(PRISM_DAILY_ID, "2026-09-15")?.id).toBe("prism-daily-2026-09-15");
    expect(puzzleById("prism-3", "2026-09-15")?.id).toBe("prism-3");
    expect(puzzleById("nope", "2026-09-15")).toBeNull();
    expect(puzzleTitle(PRISM_DAILY_ID, "2026-09-15")).toContain("2026-09-15");
  });
});

describe("prism save slice", () => {
  it("persists solved ids and best move counts through glowtrail:v2", () => {
    const mem = new Mem();
    const svc = createSaveService(mem);
    const held = svc.get().games.prism;
    const patch: PrismSave = { solved: ["prism-1", "prism-2"], bestMoves: { "prism-1": 12 }, levels: {} };
    svc.mutate((draft) => {
      Object.assign(draft.games.prism, patch);
    });
    expect(svc.get().games.prism).toBe(held);
    const reloaded = createSaveService(mem).get().games.prism;
    expect(reloaded).toEqual(patch);
  });
});

describe("prism edge cases and stress", () => {
  it("ignores out-of-range tube indices", () => {
    const s = state([[0], [], []], 4, 2);
    expect(pourCount(s, 0, 9)).toBe(0);
    expect(pourCount(s, -1, 1)).toBe(0);
    expect(pour(s, 0, 9)).toBeNull();
  });

  it("rejects malformed boards", () => {
    expect(isValidState(state([[0, 0, 0, 0], [1]], 4, 2))).toBe(false);
    expect(isValidState(state([[0, 0, 0, 5], [1, 1, 1, 1]], 4, 2))).toBe(false);
    expect(isValidState(state([[0, 0, 0, 0, 0], [1, 1, 1, 1]], 4, 2))).toBe(false);
  });

  it("solves many generated seeds without producing invalid moves", () => {
    for (let i = 0; i < 12; i += 1) {
      const p = generatePuzzle(`prism:stress:${i}`, `stress-${i}`, { colors: 4 });
      const s = state(p.tubes, p.capacity, p.colors, p.seed);
      const result = solve(s);
      expect(result.solved).toBe(true);
      for (const m of result.solution) {
        expect(canPour(s, m.from, m.to)).toBe(true);
        pour(s, m.from, m.to);
        expect(isValidState(s)).toBe(true);
      }
      expect(isSolved(s)).toBe(true);
    }
  });

  it("stateKey is order-independent across tubes", () => {
    const a = state([[0, 1], [1], []], 4, 2);
    const b = state([[1], [], [0, 1]], 4, 2);
    expect(stateKey(a)).toBe(stateKey(b));
  });
});

describe("prism scoring", () => {
  it("awards three stars at par and degrades monotonically", () => {
    expect(starsForMoves(10, 10)).toBe(3);
    expect(starsForMoves(9, 10)).toBe(3);
    expect(starsForMoves(12, 10)).toBe(2);
    expect(starsForMoves(30, 10)).toBe(1);
    let prev = 4;
    for (let moves = 1; moves <= 40; moves += 1) {
      const stars = starsForMoves(moves, 10);
      expect(stars).toBeLessThanOrEqual(prev);
      expect(stars).toBeGreaterThanOrEqual(1);
      prev = stars;
    }
  });
});
