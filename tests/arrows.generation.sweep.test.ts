import { describe, expect, it } from "vitest";
import {
  ARROWS_TOTAL_LEVELS,
  type ArrowTile,
  type ArrowsState,
  bodyCells,
  isSolved,
  launch,
} from "../src/games/arrows/logic";
import {
  createDailyState,
  createEndlessState,
  createLevelState,
  dailyConfig,
  endlessConfig,
  generateDailyBoard,
  generateEndlessBoard,
  generateLevel,
  levelConfig,
  solveBoard,
} from "../src/games/arrows/generate";

const heads = (arrows: readonly ArrowTile[]): number[] => arrows.map((a) => a.head);
const lens = (arrows: readonly ArrowTile[]): number[] => arrows.map((a) => a.length);

function cellsOverlap(size: number, arrows: readonly ArrowTile[]): boolean {
  const seen = new Set<number>();
  for (const arrow of arrows) {
    for (const cell of bodyCells(size, arrow.dir, arrow.head, arrow.length)) {
      if (seen.has(cell)) return true;
      seen.add(cell);
    }
  }
  return false;
}

/** Replays the canonical order through the public action. */
function replay(state: ArrowsState, order: number[]): ArrowsState {
  let out = state;
  for (const index of order) {
    const step = launch(out, index);
    if (!step.moved) throw new Error(`order rejected at arrow ${index}`);
    out = step.state;
  }
  return out;
}

describe("arrows generation", () => {
  it("generates 100 solvable levels", { timeout: 60000 }, () => {
    for (let level = 1; level <= ARROWS_TOTAL_LEVELS; level += 1) {
      const board = generateLevel(level);
      const info = solveBoard(board.size, board.arrows);
      expect(info.solvable, `level ${level}`).toBe(true);
      expect(info.order).toHaveLength(board.arrows.length);
    }
  });

  it("replays every canonical order to a clear", { timeout: 60000 }, () => {
    for (const level of [1, 10, 11, 25, 26, 45, 46, 70, 71, 85, 86, 100]) {
      const state = createLevelState(level);
      const info = solveBoard(state.size, state.arrows);
      expect(isSolved(replay(state, info.order)), `level ${level}`).toBe(true);
    }
  });

  it("never overlaps bodies and keeps lengths and locks valid", { timeout: 60000 }, () => {
    for (let level = 1; level <= ARROWS_TOTAL_LEVELS; level += 1) {
      const board = generateLevel(level);
      expect(cellsOverlap(board.size, board.arrows), `level ${level} overlap`).toBe(false);
      for (const arrow of board.arrows) {
        expect([1, 2, 3]).toContain(arrow.length);
        expect(arrow.length).toBeLessThanOrEqual(levelConfig(level).maxLength);
        expect(arrow.lock).toBeGreaterThanOrEqual(0);
        expect(arrow.lock).toBeLessThanOrEqual(levelConfig(level).maxLock);
      }
    }
  });

  it("keeps lock requirements satisfiable in the canonical order", { timeout: 60000 }, () => {
    for (let level = 1; level <= ARROWS_TOTAL_LEVELS; level += 1) {
      const board = generateLevel(level);
      const info = solveBoard(board.size, board.arrows);
      const position = new Map<number, number>();
      info.order.forEach((index, at) => position.set(index, at));
      for (const arrow of board.arrows) {
        const at = position.get(arrow.id) ?? 0;
        expect(arrow.lock, `level ${level} arrow ${arrow.id}`).toBeLessThanOrEqual(at);
      }
    }
  });

  it("is deterministic per seed", () => {
    expect(JSON.stringify(generateLevel(37))).toBe(JSON.stringify(generateLevel(37)));
    expect(JSON.stringify(generateEndlessBoard(4, "s"))).toBe(JSON.stringify(generateEndlessBoard(4, "s")));
    expect(JSON.stringify(generateDailyBoard("2026-09-15"))).toBe(JSON.stringify(generateDailyBoard("2026-09-15")));
  });

  it("scales board size across the campaign", () => {
    expect(levelConfig(1).size).toBe(4);
    expect(levelConfig(20).size).toBe(5);
    expect(levelConfig(35).size).toBe(6);
    expect(levelConfig(60).size).toBe(7);
    expect(levelConfig(80).size).toBe(8);
    expect(levelConfig(95).size).toBe(9);
  });

  it("escalates locks and lengths late in the campaign", () => {
    expect(levelConfig(1).maxLength).toBe(1);
    expect(levelConfig(60).maxLength).toBe(3);
    expect(levelConfig(95).maxLock).toBeGreaterThanOrEqual(4);
  });

  it("builds a solvable daily board", () => {
    const board = generateDailyBoard("2026-09-15");
    expect(board.size).toBe(dailyConfig().size);
    expect(solveBoard(board.size, board.arrows).solvable).toBe(true);
    expect(isSolved(createDailyState("2026-09-15"))).toBe(false);
  });

  it("builds solvable escalating endless boards", { timeout: 60000 }, () => {
    for (let i = 0; i < 30; i += 1) {
      const cfg = endlessConfig(i);
      expect(cfg.size).toBeLessThanOrEqual(9);
      const state = createEndlessState(i, "qa");
      expect(solveBoard(state.size, state.arrows).solvable, `endless ${i}`).toBe(true);
    }
  });

  it("generates the whole campaign within a bounded time", { timeout: 60000 }, () => {
    const start = Date.now();
    for (let level = 1; level <= ARROWS_TOTAL_LEVELS; level += 1) generateLevel(level);
    expect(Date.now() - start).toBeLessThan(20000);
  });
});

void heads;
void lens;
