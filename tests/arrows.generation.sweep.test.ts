import { describe, expect, it } from "vitest";
import {
  ARROWS_TOTAL_LEVELS,
  type ArrowsState,
  applyStep,
  bodyCells,
  isSolved,
  launch,
  movableIndices,
} from "../src/games/arrows/logic";
import {
  createDailyState,
  createLevelState,
  endlessConfig,
  generateDailyBoard,
  generateEndlessBoard,
  generateLevel,
  levelConfig,
  solvableFrom,
} from "../src/games/arrows/generate";

/** Independent DFS that returns a winning move list, or null within `cap`. */
function solvePath(state: ArrowsState, cap = 400000): number[] | null {
  const memo = new Set<string>();
  const prefix: number[] = [];
  let nodes = 0;
  const key = (h: readonly number[], b: readonly number[]): string => `${h.join(",")}|${b.join(",")}`;

  const dfs = (h: number[], b: number[]): boolean => {
    if (b.every((body) => body <= 0)) return true;
    if (nodes >= cap) return false;
    const k = key(h, b);
    if (memo.has(k)) return false;
    memo.add(k);
    nodes += 1;
    for (const i of movableIndices(state.size, state.arrows, h, b)) {
      const step = applyStep(state.size, state.arrows, h, b, i);
      prefix.push(i);
      if (dfs(step.heads, step.bodies)) return true;
      prefix.pop();
    }
    return false;
  };

  return dfs(state.heads.slice(), state.bodies.slice()) ? prefix.slice() : null;
}

/** Replays a move list through the public `launch` action. */
function replay(start: ArrowsState, path: number[]): ArrowsState {
  let state = start;
  for (const index of path) {
    const outcome = launch(state, index);
    if (!outcome.moved) throw new Error(`launch ${index} was rejected`);
    state = outcome.state;
  }
  return state;
}

describe("arrows generation", () => {
  it("generates a solvable 60-level campaign", { timeout: 60000 }, () => {
    for (let level = 1; level <= ARROWS_TOTAL_LEVELS; level += 1) {
      const state = createLevelState(level);
      expect(solvableFrom(state.size, state.arrows, state.heads, state.bodies).solvable, `level ${level}`).toBe(true);
    }
  });

  it("solutions replay to a full clear", { timeout: 60000 }, () => {
    for (const level of [1, 5, 9, 13, 20, 28, 33, 40, 46, 50, 55, 60]) {
      const state = createLevelState(level);
      const path = solvePath(state);
      expect(path, `level ${level} path`).not.toBeNull();
      expect(isSolved(replay(state, path!)), `level ${level} clear`).toBe(true);
    }
  });

  it("keeps every arrow inside the board without overlaps", { timeout: 60000 }, () => {
    for (let level = 1; level <= ARROWS_TOTAL_LEVELS; level += 1) {
      const state = createLevelState(level);
      const seen = new Set<number>();
      let free = 0;
      for (const arrow of state.arrows) {
        expect([1, 2]).toContain(arrow.length);
        expect(arrow.lock).toBeGreaterThanOrEqual(0);
        expect(arrow.lock).toBeLessThanOrEqual(levelConfig(level).maxLock);
        if (arrow.lock === 0) free += 1;
        const cells = bodyCells(state.size, arrow.dir, arrow.head, arrow.length);
        expect(cells).toHaveLength(arrow.length);
        for (const cell of cells) {
          expect(cell).toBeGreaterThanOrEqual(0);
          expect(cell).toBeLessThan(state.size * state.size);
          expect(seen.has(cell)).toBe(false);
          seen.add(cell);
        }
      }
      expect(free, `level ${level} has a free arrow`).toBeGreaterThan(0);
    }
  });

  it("is deterministic for a seeded level", () => {
    expect(JSON.stringify(generateLevel(11))).toBe(JSON.stringify(generateLevel(11)));
  });

  it("scales board size across the campaign", () => {
    expect(levelConfig(1).size).toBe(4);
    expect(levelConfig(20).size).toBe(5);
    expect(levelConfig(40).size).toBe(6);
    expect(levelConfig(55).size).toBe(7);
  });

  it("keeps endless boards solvable within count limits", { timeout: 60000 }, () => {
    for (let i = 0; i < 30; i += 1) {
      const cfg = endlessConfig(i);
      expect(cfg.count).toBeLessThanOrEqual(cfg.size * cfg.size);
      const board = generateEndlessBoard(i, "qa");
      expect(board.arrows.length).toBeLessThanOrEqual(board.size * board.size);
      expect(
        solvableFrom(board.size, board.arrows, board.arrows.map((a) => a.head), board.arrows.map((a) => a.length)).solvable,
        `endless ${i}`,
      ).toBe(true);
    }
  });

  it("builds a deterministic daily board", () => {
    const a = generateDailyBoard("2026-09-15");
    const b = generateDailyBoard("2026-09-15");
    expect(a.size).toBe(6);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(isSolved(createDailyState("2026-09-15"))).toBe(false);
  });

  it("escalates endless boards", () => {
    expect(generateEndlessBoard(0, "salt").size).toBe(4);
    expect(endlessConfig(5).size).toBe(5);
    expect(endlessConfig(10).size).toBe(6);
    expect(endlessConfig(15).size).toBe(7);
    expect(JSON.stringify(generateEndlessBoard(3, "a"))).toBe(JSON.stringify(generateEndlessBoard(3, "a")));
  });
});

