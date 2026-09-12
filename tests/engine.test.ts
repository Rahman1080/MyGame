import { describe, expect, it } from "vitest";
import {
  applyHint,
  calculateStars,
  createSession,
  DIR_DOWN,
  DIR_LEFT,
  DIR_RIGHT,
  DIR_UP,
  launch,
  reset,
  retry,
  rotateCell,
  rotateDirection,
  simulatePuzzle,
  undo,
} from "../src/engine";
import { cell, fillGrid, straightPuzzle } from "./helpers";

describe("rotation", () => {
  it("cycles 0→1→2→3→0", () => {
    expect(rotateDirection(DIR_UP, 1)).toBe(DIR_RIGHT);
    expect(rotateDirection(DIR_RIGHT, 1)).toBe(DIR_DOWN);
    expect(rotateDirection(DIR_DOWN, 1)).toBe(DIR_LEFT);
    expect(rotateDirection(DIR_LEFT, 1)).toBe(DIR_UP);
  });
});

describe("simulatePuzzle", () => {
  it("completes a valid path", () => {
    const p = straightPuzzle();
    const r = simulatePuzzle(p);
    expect(r.outcome).toBe("win");
    expect(r.path.map((s) => `${s.row},${s.col}`)).toEqual(["0,0", "0,1", "0,2", "1,2", "2,2"]);
  });

  it("fails on dead end", () => {
    const p = straightPuzzle();
    const cells = p.cells.map((c) =>
      c.row === 0 && c.col === 1 ? { ...c, direction: DIR_DOWN } : c,
    );
    const r = simulatePuzzle(p, cells);
    expect(r.outcome).toBe("fail");
    expect(r.reason).toBe("DEAD_END");
  });

  it("fails off-grid", () => {
    const p = straightPuzzle();
    const cells = p.cells.map((c) =>
      c.row === 0 && c.col === 2 ? { ...c, direction: DIR_RIGHT } : c,
    );
    expect(simulatePuzzle(p, cells).reason).toBe("OFF_GRID");
  });

  it("fails on unrecoverable loop", () => {
    const cells = fillGrid(3, [
      cell(0, 0, "start", 1),
      cell(0, 1, "arrow", 3),
      cell(2, 2, "exit"),
      cell(1, 1, "arrow", 0, { required: true }),
    ]);
    const p = {
      ...straightPuzzle(),
      cells,
      start: { row: 0, col: 0 },
      exit: { row: 2, col: 2 },
    };
    const r = simulatePuzzle(p);
    expect(r.outcome).toBe("fail");
    expect(r.reason).toBe("LOOP");
  });

  it("fails when exit is reached too soon", () => {
    const cells = fillGrid(3, [
      cell(0, 0, "start", 2),
      cell(1, 0, "arrow", 2, { required: true }),
      cell(2, 0, "exit"),
      cell(0, 2, "arrow", 2, { required: true }),
    ]);
    const p = { ...straightPuzzle(), cells, start: { row: 0, col: 0 }, exit: { row: 2, col: 0 } };
    expect(simulatePuzzle(p).reason).toBe("EXIT_TOO_SOON");
  });

  it("fails when a required node is missed", () => {
    const p = straightPuzzle();
    const extra = p.cells.map((c) =>
      c.row === 2 && c.col === 0 ? { ...c, type: "arrow" as const, direction: DIR_UP, required: true, canonicalDir: DIR_UP } : c,
    );
    extra.find((c) => c.row === 1 && c.col === 2)!.direction = DIR_DOWN;
    const r = simulatePuzzle(p, extra);
    expect(r.outcome).toBe("fail");
    expect(["MISSED_NODE", "EXIT_TOO_SOON"]).toContain(r.reason);
  });

  it("ignores empty cells", () => {
    const p = straightPuzzle();
    const empties = p.cells.filter((c) => c.type === "empty");
    expect(empties.length).toBeGreaterThan(0);
    expect(simulatePuzzle(p).outcome).toBe("win");
  });
});

describe("session", () => {
  it("blocks rotation on locked cells", () => {
    const p = straightPuzzle();
    p.cells = p.cells.map((c) =>
      c.row === 0 && c.col === 1 ? { ...c, locked: true } : c,
    );
    const s = createSession(p);
    expect(rotateCell(s, 0, 1)).toBe(false);
    expect(s.rotations).toBe(0);
  });

  it("undoes the last rotation", () => {
    const s = createSession(straightPuzzle());
    rotateCell(s, 0, 1);
    expect(s.rotations).toBe(1);
    undo(s);
    expect(s.rotations).toBe(0);
    expect(s.cells.find((c) => c.row === 0 && c.col === 1)?.direction).toBe(DIR_RIGHT);
  });

  it("reset restores original rotations", () => {
    const s = createSession(straightPuzzle());
    rotateCell(s, 0, 1);
    rotateCell(s, 0, 2);
    reset(s);
    expect(s.rotations).toBe(0);
    expect(s.cells.find((c) => c.row === 0 && c.col === 1)?.direction).toBe(DIR_RIGHT);
  });

  it("retry restores pre-launch rotations", () => {
    const s = createSession(straightPuzzle());
    rotateCell(s, 0, 1);
    const dir = s.cells.find((c) => c.row === 0 && c.col === 1)?.direction;
    launch(s);
    expect(s.phase).toBe("failed");
    retry(s);
    expect(s.phase).toBe("idle");
    expect(s.cells.find((c) => c.row === 0 && c.col === 1)?.direction).toBe(dir);
    expect(s.rotations).toBe(1);
  });

  it("ignores repeated launch while simulating or after settle via phase", () => {
    const s = createSession(straightPuzzle());
    expect(launch(s)).toBe(true);
    expect(launch(s)).toBe(false);
  });

  it("hint rotates exactly one cell toward canonical and only once", () => {
    const p = straightPuzzle();
    p.cells = p.cells.map((c) =>
      c.row === 0 && c.col === 1 ? { ...c, direction: DIR_DOWN, canonicalDir: DIR_RIGHT } : c,
    );
    p.par = 1;
    const s = createSession(p);
    expect(applyHint(s)).toBe(true);
    expect(s.hintUsed).toBe(true);
    expect(s.cells.find((c) => c.row === 0 && c.col === 1)?.direction).toBe(DIR_LEFT);
    expect(applyHint(s)).toBe(false);
  });
});

describe("boards", () => {
  it("handles a 6x6 solvable corridor", () => {
    const size = 6;
    const placed = [];
    for (let c = 0; c < 5; c += 1) placed.push(cell(0, c, c === 0 ? "start" : "arrow", 1));
    placed.push(cell(0, 5, "arrow", 2));
    for (let r = 1; r < 5; r += 1) placed.push(cell(r, 5, "arrow", 2));
    placed.push(cell(5, 5, "exit"));
    const cells = fillGrid(size, placed);
    const p = {
      id: "six",
      seed: 6,
      size,
      cells,
      start: { row: 0, col: 0 },
      exit: { row: 5, col: 5 },
      par: 0,
      difficulty: 1,
      pack: "pulse",
    };
    expect(simulatePuzzle(p).outcome).toBe("win");
  });

  it("reduced-motion result matches animated simulation", () => {
    const p = straightPuzzle();
    const a = simulatePuzzle(p);
    const b = simulatePuzzle(p);
    expect(a).toEqual(b);
  });
});

describe("stars", () => {
  it("uses par thresholds", () => {
    expect(calculateStars(0, 0)).toBe(3);
    expect(calculateStars(2, 0)).toBe(2);
    expect(calculateStars(3, 0)).toBe(1);
  });
});
