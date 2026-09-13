import { describe, expect, it } from "vitest";
import { simulatePuzzle } from "../src/engine";
import type { Cell, Direction, Puzzle } from "../src/engine/types";
import { cell, fillGrid } from "./helpers";

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
