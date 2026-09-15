import { describe, expect, it } from "vitest";
import { COLS, createState, drop, objectiveMet, settle, type FusionState } from "../src/games/fusion/logic";
import { cloneState, hintColumn, search, solveLevel } from "../src/games/fusion/solver";
import { fusionLevelConfig } from "../src/games/fusion/levels";

function fresh(queue: number[]): FusionState {
  return createState("test", queue);
}

describe("fusion solver", () => {
  it("clones states independently", () => {
    const state = fresh([0, 0, 0, 0, 0, 0, 0, 0]);
    drop(state, 0);
    settle(state);
    const copy = cloneState(state);
    copy.columns[0]!.push({ id: 999, tier: 9, col: 0, y: 0 });
    copy.score = 12345;
    copy.maxTier = 9;
    expect(state.columns[0]!.length).toBe(copy.columns[0]!.length - 1);
    expect(state.score).toBe(0);
    expect(state.maxTier).toBe(0);
  });

  it("finds a merge line for a trivial queue", () => {
    const result = search(fresh([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), 1, 8);
    expect(result.solved).toBe(true);
    expect(result.firstCol).toBeGreaterThanOrEqual(0);
    expect(result.firstCol).toBeLessThan(COLS);
  });

  it("reports failure when the budget cannot reach the target", () => {
    const result = search(fresh([0, 1, 2, 3, 0, 1, 2, 3]), 9, 2);
    expect(result.solved).toBe(false);
    expect(result.firstCol).toBeNull();
  });

  it("solves an already-met objective with no move", () => {
    const state = fresh([0, 0, 0, 0]);
    drop(state, 0);
    settle(state);
    drop(state, 0);
    settle(state);
    expect(objectiveMet(state, 1)).toBe(true);
    const result = search(state, 1, 4);
    expect(result.solved).toBe(true);
    expect(result.firstCol).toBeNull();
  });

  it("returns legal hint columns for every provided level", () => {
    for (const level of [1, 40, 78, 105]) {
      const config = fusionLevelConfig(level);
      const state = fresh(config.queue);
      const col = hintColumn(state, config.target, config.budget);
      expect(col).not.toBeNull();
      expect(col!).toBeGreaterThanOrEqual(0);
      expect(col!).toBeLessThan(COLS);
    }
  });

  it("refuses a hint when the budget is exhausted", () => {
    const config = fusionLevelConfig(1);
    const state = fresh(config.queue);
    expect(hintColumn(state, config.target, 0)).toBeNull();
  });

  it("verifies a known solvable level end to end", () => {
    const config = fusionLevelConfig(60);
    const result = solveLevel(config.seed, config.queue, config.target, config.budget);
    expect(result.solved).toBe(true);
  });
});
