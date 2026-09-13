import { describe, expect, it } from "vitest";
import { applyCanonical, simulatePuzzle } from "../src/engine";
import { generateLevel } from "../src/gen/generator";
import { TOTAL_LEVELS } from "../src/levels/packs";
import type { Cell, Direction, Puzzle } from "../src/engine/types";
import { cell, fillGrid, straightPuzzle } from "./helpers";

function snake(side: number): Puzzle {
  const order: Array<[number, number]> = [];
  for (let r = 0; r < side; r += 1) {
    const cols = r % 2 === 0
      ? Array.from({ length: side }, (_, i) => i)
      : Array.from({ length: side }, (_, i) => side - 1 - i);
    for (const c of cols) order.push([r, c]);
  }
  const placed: Cell[] = [];
  for (let i = 0; i < order.length; i += 1) {
    const [r, c] = order[i]!;
    if (i === order.length - 1) {
      placed.push(cell(r, c, "exit", undefined, { required: true }));
      continue;
    }
    const [nr, nc] = order[i + 1]!;
    const dr = nr - r;
    const dc = nc - c;
    const dir: Direction = dr === 1 ? 2 : dr === -1 ? 0 : dc === 1 ? 1 : 3;
    placed.push(cell(r, c, i === 0 ? "start" : "arrow", dir, { required: true }));
  }
  const last = order[order.length - 1]!;
  return {
    id: `snake-${side}`,
    seed: side,
    size: side,
    cells: fillGrid(side, placed),
    start: { row: order[0]![0], col: order[0]![1] },
    exit: { row: last[0], col: last[1] },
    par: 0,
    parKind: "canonical",
    difficulty: 0,
    pack: "test",
  };
}

function fixedLoopPuzzle(): Puzzle {
  const cells = fillGrid(3, [
    cell(0, 0, "start", 1, { required: false }),
    cell(0, 1, "arrow", 2, { required: true }),
    cell(1, 1, "arrow", 0, { required: true }),
    cell(2, 2, "exit"),
  ]);
  return {
    id: "coverage-loop",
    seed: 0,
    size: 3,
    cells,
    start: { row: 0, col: 0 },
    exit: { row: 2, col: 2 },
    par: 0,
    parKind: "canonical",
    difficulty: 0,
    pack: "test",
  };
}

describe("required-node tracking", () => {
  it("supports a full 6x6 board with 36 required nodes (beyond 32-bit masks)", () => {
    const p = snake(6);
    expect(p.cells.filter((c) => c.required)).toHaveLength(36);
    const r = simulatePuzzle(p);
    expect(r.outcome).toBe("win");
    expect(r.path).toHaveLength(36);
  });

  it("fails when a required node is missed after a rotation", () => {
    const p = snake(6);
    const cells = p.cells.map((c) =>
      c.row === 3 && c.col === 0 ? { ...c, direction: 1 as Direction } : c,
    );
    const r = simulatePuzzle(p, cells);
    expect(r.outcome).toBe("fail");
  });
});

describe("simulation outcomes", () => {
  it("detects a true loop (same position, coverage and color)", () => {
    const cells = fillGrid(3, [
      cell(0, 0, "start", 1, { required: false }),
      cell(0, 1, "arrow", 3, { required: false }),
      cell(2, 2, "exit"),
    ]);
    const p: Puzzle = {
      id: "loop",
      seed: 0,
      size: 3,
      cells,
      start: { row: 0, col: 0 },
      exit: { row: 2, col: 2 },
      par: 0,
      parKind: "canonical",
      difficulty: 0,
      pack: "test",
    };
    expect(simulatePuzzle(p).reason).toBe("LOOP");
  });

  it("does not treat a covered-cell revisit as a loop until the state repeats", () => {
    const cells = fillGrid(3, [
      cell(0, 0, "start", 1),
      cell(0, 1, "arrow", 2),
      cell(1, 1, "arrow", 1),
      cell(1, 2, "arrow", 0),
      cell(0, 2, "arrow", 3),
      cell(2, 2, "exit"),
    ]);
    const p: Puzzle = {
      id: "loop-state",
      seed: 0,
      size: 3,
      cells,
      start: { row: 0, col: 0 },
      exit: { row: 2, col: 2 },
      par: 0,
      parKind: "canonical",
      difficulty: 0,
      pack: "test",
    };
    const r = simulatePuzzle(p);
    expect(r.reason).toBe("LOOP");
    const seen = new Set<string>();
    let repeatedCoordinate = false;
    for (const step of r.path) {
      const k = `${step.row},${step.col}`;
      if (seen.has(k)) repeatedCoordinate = true;
      seen.add(k);
    }
    expect(repeatedCoordinate).toBe(true);
  });

  it("reports a dead end while required cells remain", () => {
    const cells = fillGrid(3, [
      cell(0, 0, "start", 1, { required: false }),
      cell(1, 1, "arrow", 1, { required: true }),
      cell(2, 2, "exit"),
    ]);
    const p: Puzzle = {
      id: "dead",
      seed: 0,
      size: 3,
      cells,
      start: { row: 0, col: 0 },
      exit: { row: 2, col: 2 },
      par: 0,
      parKind: "canonical",
      difficulty: 0,
      pack: "test",
    };
    const r = simulatePuzzle(p);
    expect(r.outcome).toBe("fail");
    expect(r.reason).toBe("DEAD_END");
  });

  it("reports an early exit", () => {
    const cells = fillGrid(3, [
      cell(0, 0, "start", 2),
      cell(1, 0, "arrow", 2, { required: true }),
      cell(2, 0, "exit"),
      cell(0, 2, "arrow", 2, { required: true }),
    ]);
    const p: Puzzle = {
      id: "early",
      seed: 0,
      size: 3,
      cells,
      start: { row: 0, col: 0 },
      exit: { row: 2, col: 0 },
      par: 0,
      parKind: "canonical",
      difficulty: 0,
      pack: "test",
    };
    expect(simulatePuzzle(p).reason).toBe("EXIT_TOO_SOON");
  });

  it("reports a missed node when the route stalls after covering every required cell", () => {
    const cells = fillGrid(3, [
      cell(0, 0, "start", 1),
      cell(0, 1, "arrow", 1, { required: true }),
      cell(2, 2, "exit"),
    ]);
    const p: Puzzle = {
      id: "missed",
      seed: 0,
      size: 3,
      cells,
      start: { row: 0, col: 0 },
      exit: { row: 2, col: 2 },
      par: 0,
      parKind: "canonical",
      difficulty: 0,
      pack: "test",
    };
    const r = simulatePuzzle(p);
    expect(r.outcome).toBe("fail");
    expect(r.reason).toBe("MISSED_NODE");
  });
});

describe("required-node coverage (all board sizes, safe for 36 cells)", () => {
  it("covers 36 required cells and reports a win without duplicate counting", () => {
    const p = snake(6);
    expect(p.cells.filter((c) => c.required)).toHaveLength(36);
    const r = simulatePuzzle(p);
    expect(r.outcome).toBe("win");
    expect(r.path).toHaveLength(36);
    expect(new Set(r.path.map((s) => `${s.row},${s.col}`)).size).toBe(36);
  });

  it("does not inflate the count when a required cell is visited twice", () => {
    const r = simulatePuzzle(fixedLoopPuzzle());
    const coords = r.path.map((s) => `${s.row},${s.col}`);
    expect(coords.filter((k) => k === "0,1").length).toBeGreaterThanOrEqual(2);
    // Coverage is complete after the second visit, so the only failure is a loop.
    expect(r.reason).toBe("LOOP");
  });

  it("ignores empty cells entirely", () => {
    const p = straightPuzzle();
    expect(p.cells.some((c) => c.type === "empty")).toBe(true);
    const r = simulatePuzzle(p);
    expect(r.outcome).toBe("win");
    expect(r.path).toHaveLength(5);
  });

  it("fails on partial coverage but wins on full coverage", () => {
    const p = snake(5);
    expect(simulatePuzzle(p).outcome).toBe("win");
    const partial = p.cells.map((c) =>
      c.row === 3 && c.col === 0 ? { ...c, direction: 1 as Direction } : c,
    );
    expect(simulatePuzzle(p, partial).outcome).toBe("fail");
  });
});

describe("deterministic loop detection", () => {
  it("is deterministic for a simple cycle", () => {
    const cells = fillGrid(3, [
      cell(0, 0, "start", 1, { required: false }),
      cell(0, 1, "arrow", 3, { required: false }),
      cell(2, 2, "exit"),
    ]);
    const p: Puzzle = {
      id: "cycle",
      seed: 0,
      size: 3,
      cells,
      start: { row: 0, col: 0 },
      exit: { row: 2, col: 2 },
      par: 0,
      parKind: "canonical",
      difficulty: 0,
      pack: "test",
    };
    const a = simulatePuzzle(p);
    const b = simulatePuzzle(p);
    expect(a).toEqual(b);
    expect(a.reason).toBe("LOOP");
  });

  it("continues past a coverage-increasing revisit before detecting repetition", () => {
    const r = simulatePuzzle(fixedLoopPuzzle());
    const coords = r.path.map((s) => `${s.row},${s.col}`);
    expect(coords).toContain("0,1");
    expect(coords).toContain("1,1");
    expect(r.reason).toBe("LOOP");
  });

  it("winning routes never repeat a coordinate (simple path theorem)", () => {
    for (let level = 4; level <= TOTAL_LEVELS; level += 1) {
      const p = generateLevel(level);
      const r = simulatePuzzle(p, applyCanonical(p.cells));
      expect(r.outcome).toBe("win");
      const coords = r.path.map((s) => `${s.row},${s.col}`);
      expect(new Set(coords).size).toBe(coords.length);
    }
  }, 60000);
});
